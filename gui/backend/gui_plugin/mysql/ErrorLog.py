# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms,
# as designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import json
import math
import os
import re
import shutil
import threading
from array import array
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Union

from mysqlsh.plugin_manager import plugin_function  # pylint: disable=no-name-in-module

import gui_plugin.core.Error as Error
from gui_plugin.core.Error import MSGException
from gui_plugin.db_connections import InternalData


_TEXT_ERROR_LOG_RE = re.compile(
    r"^(?P<logged>\d{4}-\d{2}-\d{2}[T ][^\s]+)"
    r"(?:\s+(?P<thread_id>\d+))?"
    r"(?:\s+\[(?P<prio>[^\]]+)\])?"
    r"(?:\s+\[(?P<error_code>MY-\d+)\])?"
    r"(?:\s+\[(?P<subsystem>[^\]]+)\])?"
    r"\s*(?P<data>.*)$"
)
ErrorLogRow = Dict[str, Union[int, str]]


@dataclass(frozen=True)
class _ErrorLogFileIndex:
    signature: tuple[int, int, int, int]
    start_offset: int
    line_count: int
    line_offset_checkpoints: tuple[int, ...]
    error_code_values: tuple[str, ...]
    subsystem_values: tuple[str, ...]


@dataclass(frozen=True)
class _FilteredErrorLogFileIndex:
    path: str
    signature: tuple[int, int, int, int]
    filters: tuple[Any, ...]
    matching_line_numbers: array


_ERROR_LOG_FILE_INDEX_LIMIT = 16
_ERROR_LOG_FILE_INDEX_STRIDE = 1000
_ERROR_LOG_FILE_READ_WINDOW_SIZE = 1024 * 1024 * 1024
_ERROR_LOG_FILE_MAX_LINES = 10_000_000
_error_log_file_indexes: dict[str, _ErrorLogFileIndex] = {}
_error_log_file_indexes_lock = threading.Lock()
_error_log_file_filter_index: Optional[_FilteredErrorLogFileIndex] = None


def _string_value(value: object) -> str:
    if value is None:
        return ""

    return str(value)


def _parse_json_error_log_line(line_number: int, line: str) -> Optional[ErrorLogRow]:
    try:
        payload = json.loads(line)
    except ValueError:
        return None

    if not isinstance(payload, dict):
        return None

    return {
        "line": line_number,
        "logged": _string_value(payload.get("time") or payload.get("logged")),
        "thread_id": _string_value(payload.get("thread") or payload.get("thread_id")),
        "prio": _string_value(payload.get("prio") or payload.get("priority")),
        "error_code": _string_value(payload.get("err_code") or payload.get("error_code")),
        "subsystem": _string_value(payload.get("subsystem")),
        "data": _string_value(payload.get("msg") or payload.get("data")),
    }


def _parse_text_error_log_line(line_number: int, line: str) -> ErrorLogRow:
    match = _TEXT_ERROR_LOG_RE.match(line)
    if not match:
        return {
            "line": line_number,
            "logged": "",
            "thread_id": "",
            "prio": "",
            "error_code": "",
            "subsystem": "",
            "data": line,
        }

    data = match.groupdict()

    return {
        "line": line_number,
        "logged": _string_value(data.get("logged")),
        "thread_id": _string_value(data.get("thread_id")),
        "prio": _string_value(data.get("prio")),
        "error_code": _string_value(data.get("error_code")),
        "subsystem": _string_value(data.get("subsystem")),
        "data": _string_value(data.get("data")),
    }


def _parse_error_log_line(line_number: int, line: str) -> ErrorLogRow:
    stripped = line.rstrip("\r\n")
    if stripped.startswith("{"):
        parsed_json = _parse_json_error_log_line(line_number, stripped)
        if parsed_json is not None:
            return parsed_json

    return _parse_text_error_log_line(line_number, stripped)


def _error_log_file_signature(log_path: Path) -> tuple[int, int, int, int]:
    stat = log_path.stat()

    return (stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns)


def _error_log_file_start_offset(
    log_path: Path, signature: tuple[int, int, int, int]
) -> int:
    if signature[2] <= _ERROR_LOG_FILE_READ_WINDOW_SIZE:
        return 0

    start_offset = signature[2] - _ERROR_LOG_FILE_READ_WINDOW_SIZE
    with log_path.open("rb") as log_file:
        log_file.seek(start_offset - 1)
        if log_file.read(1) == b"\n":
            return start_offset
        log_file.seek(start_offset)
        log_file.readline()
        return log_file.tell()


def _build_error_log_file_index(
    log_path: Path, signature: tuple[int, int, int, int], start_offset: int,
    previous_index: Optional[_ErrorLogFileIndex] = None,
) -> _ErrorLogFileIndex:
    if previous_index is None:
        line_offset_checkpoints = []
        error_code_values = set()
        subsystem_values = set()
        line_count = 0
        read_offset = start_offset
    else:
        line_offset_checkpoints = list(previous_index.line_offset_checkpoints)
        error_code_values = set(previous_index.error_code_values)
        subsystem_values = set(previous_index.subsystem_values)
        line_count = previous_index.line_count
        read_offset = previous_index.signature[2]
        start_offset = previous_index.start_offset

    with log_path.open("rb") as log_file:
        log_file.seek(read_offset)
        while log_file.tell() < signature[2]:
            offset = log_file.tell()
            line = log_file.readline(signature[2] - offset)
            if not line:
                break

            decoded_line = line.decode("utf-8", errors="replace")

            if line_count % _ERROR_LOG_FILE_INDEX_STRIDE == 0:
                line_offset_checkpoints.append(offset)
            line_count += 1
            if line_count > _ERROR_LOG_FILE_MAX_LINES:
                raise MSGException(
                    Error.CORE_INVALID_DATA_FORMAT,
                    "The error log contains too many lines to display.",
                )

            parsed_row = _parse_error_log_line(line_count, decoded_line)
            if parsed_row["error_code"]:
                error_code_values.add(parsed_row["error_code"])
            if parsed_row["subsystem"]:
                subsystem_values.add(parsed_row["subsystem"])

    return _ErrorLogFileIndex(
        signature=signature,
        start_offset=start_offset,
        line_count=line_count,
        line_offset_checkpoints=tuple(line_offset_checkpoints),
        error_code_values=tuple(sorted(error_code_values)),
        subsystem_values=tuple(sorted(subsystem_values)),
    )


def _get_error_log_file_index(log_path: Path) -> _ErrorLogFileIndex:
    cache_key = str(log_path)
    signature = _error_log_file_signature(log_path)
    start_offset = _error_log_file_start_offset(log_path, signature)

    with _error_log_file_indexes_lock:
        cached = _error_log_file_indexes.get(cache_key)
        if cached is not None and cached.signature == signature:
            return cached

    previous_index = None
    # Keep the initial window as the file grows. Same-inode growth is treated
    # as an append; detecting copytruncate after regrowth needs extra state.
    if (
        cached is not None
        and signature[:2] == cached.signature[:2]
        and signature[2] > cached.signature[2]
    ):
        if cached.signature[2] == 0:
            previous_index = cached
        else:
            with log_path.open("rb") as log_file:
                log_file.seek(cached.signature[2] - 1)
                if log_file.read(1) == b"\n":
                    previous_index = cached

    index = _build_error_log_file_index(
        log_path, signature, start_offset, previous_index,
    )
    with _error_log_file_indexes_lock:
        cached = _error_log_file_indexes.get(cache_key)
        if cached is not None and cached.signature == signature:
            return cached
        if (
            cache_key not in _error_log_file_indexes
            and len(_error_log_file_indexes) >= _ERROR_LOG_FILE_INDEX_LIMIT
        ):
            del _error_log_file_indexes[next(iter(_error_log_file_indexes))]
        _error_log_file_indexes[cache_key] = index

        return index


def _read_error_log_file_rows(
    log_path: Path, index: _ErrorLogFileIndex, start_line: int, end_line: int
) -> list[ErrorLogRow]:
    if start_line >= index.line_count:
        return []

    checkpoint_index = start_line // _ERROR_LOG_FILE_INDEX_STRIDE
    checkpoint_line = checkpoint_index * _ERROR_LOG_FILE_INDEX_STRIDE
    rows = []
    with log_path.open("r", encoding="utf-8", errors="replace") as log_file:
        log_file.seek(index.line_offset_checkpoints[checkpoint_index])
        for _ in range(checkpoint_line, start_line):
            log_file.readline()
        for line_index in range(start_line, end_line):
            rows.append(_parse_error_log_line(line_index + 1, log_file.readline()))

    return rows


def _normalize_error_log_filters(filters: Optional[dict]) -> dict[str, Any]:
    if filters is None:
        return {
            "minTimestamp": None,
            "priorities": set(),
            "errorCodes": set(),
            "subsystems": set(),
            "message": "",
        }
    if not isinstance(filters, dict):
        raise MSGException(Error.CORE_INVALID_PARAMETER,
                           "The filters parameter must be a dictionary.")

    normalized: dict[str, Any] = {}
    min_timestamp = filters.get("minTimestamp")
    if min_timestamp is not None:
        if isinstance(min_timestamp, bool):
            raise MSGException(Error.CORE_INVALID_PARAMETER,
                               "The minimum timestamp must be a number.")
        try:
            min_timestamp = float(min_timestamp)
        except (TypeError, ValueError) as exc:
            raise MSGException(Error.CORE_INVALID_PARAMETER,
                               "The minimum timestamp must be a number.") from exc
        if not math.isfinite(min_timestamp) or min_timestamp < 0:
            raise MSGException(Error.CORE_INVALID_PARAMETER,
                               "The minimum timestamp is invalid.")
    normalized["minTimestamp"] = min_timestamp

    for name in ("priorities", "errorCodes", "subsystems"):
        values = filters.get(name, [])
        if (
            not isinstance(values, list)
            or len(values) > 100
            or any(not isinstance(value, str) or len(value) > 200 for value in values)
        ):
            raise MSGException(
                Error.CORE_INVALID_PARAMETER,
                f"The {name} filter must be a list of strings.",
            )
        normalized[name] = {
            value.lower() if name == "priorities" else value for value in values
        }

    message = filters.get("message", "")
    if not isinstance(message, str) or len(message) > 1000:
        raise MSGException(Error.CORE_INVALID_PARAMETER,
                           "The message filter must be a string.")
    normalized["message"] = message.strip().lower()

    return normalized


def _error_log_timestamp(value: str) -> Optional[float]:
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None

    return timestamp.timestamp()


def _matches_error_log_filters(row: ErrorLogRow, filters: dict[str, Any]) -> bool:
    min_timestamp = filters["minTimestamp"]
    if min_timestamp is not None:
        logged = _error_log_timestamp(str(row["logged"]))
        if logged is None or logged < min_timestamp:
            return False

    if filters["priorities"] and str(row["prio"]).lower() not in filters["priorities"]:
        return False
    if filters["errorCodes"] and row["error_code"] not in filters["errorCodes"]:
        return False
    if filters["subsystems"] and row["subsystem"] not in filters["subsystems"]:
        return False

    return not filters["message"] or filters["message"] in str(row["data"]).lower()


def _error_log_filter_key(filters: dict[str, Any]) -> tuple[Any, ...]:
    return (
        filters["minTimestamp"],
        tuple(sorted(filters["priorities"])),
        tuple(sorted(filters["errorCodes"])),
        tuple(sorted(filters["subsystems"])),
        filters["message"],
    )


def _get_filtered_error_log_file_line_numbers(
    log_path: Path, index: _ErrorLogFileIndex, filters: dict[str, Any]
) -> array:
    global _error_log_file_filter_index

    path = str(log_path)
    filter_key = _error_log_filter_key(filters)
    with _error_log_file_indexes_lock:
        cached = _error_log_file_filter_index
        if (
            cached is not None
            and cached.path == path
            and cached.signature == index.signature
            and cached.filters == filter_key
        ):
            return cached.matching_line_numbers

    matching_line_numbers = array("I")
    with log_path.open("rb") as log_file:
        log_file.seek(index.start_offset)
        line_number = 0
        while log_file.tell() < index.signature[2]:
            offset = log_file.tell()
            line = log_file.readline(index.signature[2] - offset)
            if not line:
                break

            line_number += 1
            row = _parse_error_log_line(
                line_number, line.decode("utf-8", errors="replace"),
            )
            if _matches_error_log_filters(row, filters):
                matching_line_numbers.append(line_number)

    with _error_log_file_indexes_lock:
        _error_log_file_filter_index = _FilteredErrorLogFileIndex(
            path, index.signature, filter_key, matching_line_numbers,
        )

    return matching_line_numbers


def _read_error_log_file_rows_at_lines(
    log_path: Path, index: _ErrorLogFileIndex, line_numbers: array
) -> list[ErrorLogRow]:
    rows = []
    with log_path.open("r", encoding="utf-8", errors="replace") as log_file:
        for line_number in line_numbers:
            line_index = line_number - 1
            checkpoint_index = line_index // _ERROR_LOG_FILE_INDEX_STRIDE
            checkpoint_line = checkpoint_index * _ERROR_LOG_FILE_INDEX_STRIDE
            log_file.seek(index.line_offset_checkpoints[checkpoint_index])
            for _ in range(checkpoint_line, line_index):
                log_file.readline()
            rows.append(_parse_error_log_line(line_number, log_file.readline()))

    return rows


def _resolve_local_error_log_path(path: str, data_dir: Optional[str] = None) -> Path:
    if not path:
        raise MSGException(Error.CORE_PATH_NOT_SUPPLIED,
                           "The supplied path is empty.")

    if os.path.isabs(path):
        return Path(os.path.abspath(path))

    if data_dir:
        return Path(os.path.abspath(os.path.join(data_dir, path)))

    return Path(os.path.abspath(path))


def _has_local_error_log_sink(log_error_services: str) -> bool:
    return "log_sink_internal" in {
        service.strip().lower() for service in log_error_services.replace(",", ";").split(";")
    }


def _resolve_export_path(path: str) -> Path:
    if not isinstance(path, str) or not path.strip():
        raise MSGException(Error.CORE_PATH_NOT_SUPPLIED,
                           "The supplied export path is empty.")

    export_path = Path(os.path.abspath(path))
    parent = export_path.parent
    if not parent.exists():
        raise MSGException(Error.CORE_PATH_NOT_EXIST,
                           "The directory for the supplied export path does not exist.")

    if not parent.is_dir():
        raise MSGException(Error.CORE_NOT_FILE,
                           "The directory for the supplied export path is not a directory.")

    if export_path.exists() and export_path.is_dir():
        raise MSGException(Error.CORE_NOT_FILE,
                           "The supplied export path is a directory.")

    if not os.access(parent, os.W_OK):
        raise MSGException(Error.CORE_PERMISSION_DENIED,
                           "No permissions to write to the supplied export path.")

    return export_path


def _get_cached_local_error_log_path(connection_id: int) -> Optional[Path]:
    cache = InternalData.get_server_status_cache(connection_id)
    if cache is None or not cache["isLocal"]:
        raise MSGException(Error.CORE_FEATURE_NOT_SUPPORTED,
                           "Reading server log files is only supported for local sessions.")

    values = {
        sysvar["name"].lower(): sysvar["value"]
        for sysvar in cache["sysvars"]
    }
    path = values.get("log_error", "")
    data_dir = values.get("datadir")
    log_error_services = values.get("log_error_services")
    if isinstance(path, str) and path.strip().lower() == "stderr":
        return None
    if (
        log_error_services is not None
        and not _has_local_error_log_sink(log_error_services)
    ):
        raise MSGException(Error.CORE_FEATURE_NOT_SUPPORTED,
                           "The configured error log does not use the local file sink.")

    log_path = _resolve_local_error_log_path(path, data_dir)
    if not log_path.exists():
        raise MSGException(Error.CORE_PATH_NOT_EXIST,
                           "The supplied path does not exist.")

    if not log_path.is_file():
        raise MSGException(Error.CORE_NOT_FILE,
                           "The supplied path is not a file.")

    if not os.access(log_path, os.R_OK):
        raise MSGException(Error.CORE_PERMISSION_DENIED,
                           "No permissions to read from the supplied path.")

    return log_path


def _get_bound_connection_id(module_session: object) -> int:
    try:
        return module_session.get_bound_connection_id()
    except AttributeError as exc:
        raise MSGException(
            Error.CORE_PERMISSION_DENIED,
            "A profile-bound module session is required.",
        ) from exc


def _ensure_export_is_not_source(export_path: Path, source_path: Path) -> None:
    if (export_path.resolve() == source_path.resolve()
            or (export_path.exists() and source_path.exists()
                and export_path.samefile(source_path))):
        raise MSGException(Error.CORE_INVALID_PARAMETER,
                           "The export path must be different from the source path.")


@plugin_function("gui.mysql.readErrorLogFilePage", shell=True, web=True)
def read_error_log_file_page(module_session: object, page: int = 0, page_size: int = 100,
                              filters: Optional[dict] = None,
                              _user_id: Optional[int] = None):
    """Reads one local MySQL error log page using backend-cached configuration.

    Args:
        module_session (object): The profile-bound module session.
        page (int): The zero-based page number.
        page_size (int): The number of lines to read.
        filters (dict): Optional filters applied before pagination.
        _user_id (int): The id of the user.

    Returns:
        dict: parsed page information and log rows
    """
    if _user_id is not None:
        raise MSGException(Error.CORE_FEATURE_NOT_SUPPORTED,
                           "Reading server log files is only supported for local sessions.")

    log_path = _get_cached_local_error_log_path(
        _get_bound_connection_id(module_session)
    )
    if log_path is None:
        return None

    try:
        page = int(page)
        page_size = int(page_size)
    except (TypeError, ValueError) as exc:
        raise MSGException(Error.CORE_INVALID_PARAMETER,
                           "The page and page_size parameters must be numbers.") from exc

    if page < 0:
        raise MSGException(Error.CORE_INVALID_PARAMETER,
                           "The page parameter must not be negative.")

    if page_size < 1 or page_size > 1000:
        raise MSGException(Error.CORE_INVALID_PARAMETER,
                           "The page_size parameter must be between 1 and 1000.")

    index = _get_error_log_file_index(log_path)
    start_line = page * page_size
    normalized_filters = _normalize_error_log_filters(filters)
    has_filters = any((
        normalized_filters["minTimestamp"] is not None,
        normalized_filters["priorities"],
        normalized_filters["errorCodes"],
        normalized_filters["subsystems"],
        normalized_filters["message"],
    ))
    if has_filters:
        matching_line_numbers = _get_filtered_error_log_file_line_numbers(
            log_path, index, normalized_filters,
        )
        total_lines = len(matching_line_numbers)
        rows = _read_error_log_file_rows_at_lines(
            log_path, index, matching_line_numbers[start_line:start_line + page_size],
        )
    else:
        total_lines = index.line_count
        end_line = min(start_line + page_size, total_lines)
        rows = _read_error_log_file_rows(log_path, index, start_line, end_line)

    total_pages = max(1, (total_lines + page_size - 1) // page_size)

    return {
        "path": str(log_path),
        "is_truncated": index.start_offset > 0,
        "page": page,
        "page_size": page_size,
        "start_line": start_line + 1,
        "total_lines": total_lines,
        "total_pages": total_pages,
        "error_code_values": list(index.error_code_values),
        "subsystem_values": list(index.subsystem_values),
        "has_next": page < total_pages - 1,
        "rows": rows,
    }


@plugin_function("gui.mysql.exportErrorLogFile", shell=True, web=True)
def export_error_log_file(module_session: object, target_path: str,
                           _user_id: Optional[int] = None) -> None:
    """Copies the cached local MySQL error log file to a user-selected path.

    Args:
        module_session (object): The profile-bound module session.
        target_path (str): The destination path selected by the user.
        _user_id (int): The id of the user.

    Returns:
        None: The file was copied successfully.
    """
    if _user_id is not None:
        raise MSGException(Error.CORE_FEATURE_NOT_SUPPORTED,
                           "Exporting server log files is only supported for local sessions.")

    source_path = _get_cached_local_error_log_path(
        _get_bound_connection_id(module_session)
    )
    if source_path is None:
        raise MSGException(Error.CORE_FEATURE_NOT_SUPPORTED,
                           "The configured error log writes to standard error.")
    export_path = _resolve_export_path(target_path)
    _ensure_export_is_not_source(export_path, source_path)

    try:
        shutil.copyfile(source_path, export_path)
    except OSError as exc:
        raise MSGException(Error.CORE_PERMISSION_DENIED,
                           "The error log could not be exported.") from exc
_ERROR_LOG_TABLE_QUERY = (
    "SELECT LOGGED, THREAD_ID, PRIO, ERROR_CODE, SUBSYSTEM, DATA "
    "FROM performance_schema.error_log ORDER BY LOGGED DESC"
)


def _format_error_log_table_row(row: object) -> str:
    try:
        values = list(row)  # type: ignore[arg-type]
    except TypeError:
        values = []
    logged, thread_id, prio, error_code, subsystem, data = [
        _string_value(values[index]) if index < len(values) else ""
        for index in range(6)
    ]
    fields = [value for value in (logged, thread_id) if value]
    fields.extend(f"[{value}]" for value in (prio, error_code, subsystem) if value)
    if data:
        fields.append(data)

    return " ".join(fields) + "\n"


@plugin_function("gui.mysql.exportErrorLogs", shell=True, web=True)
def export_error_logs(target_path: str, module_session: object,
                       _user_id: Optional[int] = None) -> None:
    """Exports all rows from the connected performance schema error log.

    Args:
        target_path (str): The destination path selected by the user.
        module_session (object): The module session that owns the database service session.
        _user_id (int): The id of the user.

    Returns:
        None: The rows were exported successfully.
    """
    if _user_id is not None:
        raise MSGException(Error.CORE_FEATURE_NOT_SUPPORTED,
                           "Exporting server logs is only supported for local sessions.")

    session = getattr(module_session, "_db_service_session", None)
    if session is None:
        raise MSGException(Error.DB_NOT_OPEN,
                           "The database service session needs to be opened before exporting logs.")

    export_path = _resolve_export_path(target_path)
    session.lock()
    try:
        if InternalData._is_local_session(session):
            values = {
                sysvar["name"].lower(): sysvar["value"]
                for sysvar in InternalData._read_server_status_sysvars(session)
            }
            if values.get("log_error"):
                source_path = _resolve_local_error_log_path(values["log_error"], values.get("datadir"))
                _ensure_export_is_not_source(export_path, source_path)

        result = session.run_sql(_ERROR_LOG_TABLE_QUERY)
        with export_path.open("w", encoding="utf-8", newline="") as log_file:
            while True:
                row = result.fetch_one()
                if row is None:
                    break

                log_file.write(_format_error_log_table_row(row))
    except OSError as exc:
        raise MSGException(Error.CORE_PERMISSION_DENIED,
                           "The error log could not be exported.") from exc
    finally:
        session.release()
