# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have either included with the
# program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from __future__ import annotations

import configparser
import glob
import io
import json
import os
import re
import shutil
import stat
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Literal, TextIO, cast

from .models import (
    MebActivityItem,
    MebBackupProfileInfo,
    MebLogContent,
    MebBackupProfile,
    MebProfileSchedule,
    MebStatus,
    MebStatusItem,
    MebValidationStatus,
)
from .os_utils import get_path_owner, write_text_private

SECRET_KEYS = {
    "cloud_access_key",
    "cloud_par_url",
    "cloud_password",
    "cloud_secret_access_key",
    "cloud_secret_key",
    "password",
    "encryption_password",
}

LOG_ACTIVITY_TAIL_BYTES = 8192
LOG_ARTIFACT_PATH_HEAD_BYTES = 64 * 1024
LOG_READ_MAX_BYTES = 1024 * 1024
PROGRESS_STATE_MAX_BYTES = 64 * 1024
BACKUP_SIZE_SCAN_MAX_ENTRIES = 100000
ACTIVITY_ID_PREFIX = "activity:v1:"
MANAGER_CONFIG_NAME = "backups.cnf"
JOB_LOG_DIR_NAME = "logs"
PROGRESS_STATE_NAME = ".backup-progress.json"
MYSQLBACKUP_PROGRESS_NAME = ".backup-progress"
RUN_LOCK_DIR_NAME = ".backup-run.lock"
IGNORED_PROFILE_CONFIGS = {
    MANAGER_CONFIG_NAME,
    ".mylogin.cnf",
    "mebmanager.cnf",
}
INCREMENTAL_BASE_VALUES = {
    "history:last_backup",
    "history:last_full_backup",
}
STORAGE_TYPES = {
    "local",
}
# Schedules are rendered as cron-style calendar fields on every platform.
# Larger intervals need persisted elapsed-time state, which is not supported yet.
SCHEDULE_INTERVAL_MAXIMUMS = {
    0: 23,
    1: 31,
    2: 1,
    3: 12,
}
LEGACY_MYSQLBACKUP_METADATA_OPTIONS = {
    "basedir",
    "command",
}
CLOUD_SERVICES = {
    "GCP",
    "OCI",
    "openstack",
    "s3",
}
CLOUD_OPTION_FIELDS = {
    "cloudService": "cloud_service",
    "cloudParUrl": "cloud_par_url",
    "cloudHost": "cloud_host",
    "cloudBucket": "cloud_bucket",
    "cloudAccessKeyId": "cloud_access_key_id",
    "cloudSecretAccessKey": "cloud_secret_access_key",
    "cloudAwsRegion": "cloud_aws_region",
    "cloudAccessKey": "cloud_access_key",
    "cloudSecretKey": "cloud_secret_key",
    "cloudContainer": "cloud_container",
    "cloudUserId": "cloud_user_id",
    "cloudPassword": "cloud_password",
    "cloudTempAuthUrl": "cloud_tempauth_url",
    "cloudBasicAuthUrl": "cloud_basicauth_url",
    "cloudIdentityUrl": "cloud_identity_url",
    "cloudTenant": "cloud_tenant",
    "cloudRegion": "cloud_region",
    "cloudChunkSize": "cloud_chunk_size",
    "cloudProxy": "cloud_proxy",
    "cloudCaInfo": "cloud_ca_info",
    "cloudCaPath": "cloud_ca_path",
    "cloudBufferSize": "cloud_buffer_size",
}


@dataclass(frozen=True)
class _ActivityLogStatus:
    detail: str
    status: str
    tone: str


@dataclass(frozen=True)
class ResolvedActivity:
    activity_id: str
    log_path: str
    backup_id: str | None
    profile_id: str | None
    activity_type: str | None
    backup_error: str | None = None

    def require_backup_id(self) -> str:
        if self.backup_id is None:
            raise ValueError(self.backup_error or "Backup data was not found for this activity entry")

        return self.backup_id

    def read_log_status(self) -> _ActivityLogStatus:
        return _activity_log_status(_read_text_tail(self.log_path, LOG_ACTIVITY_TAIL_BYTES))


@dataclass(frozen=True)
class _BackupRestorePoint:
    path: str
    is_incremental: bool
    start_lsn: int
    end_lsn: int


class _BackupMetadataNotFoundError(ValueError):
    pass


class _RestoreChainResolutionError(ValueError):
    def __init__(
        self,
        message: str,
        partial_chain: list[str],
        *,
        missing_predecessor: bool = False,
    ) -> None:
        super().__init__(message)
        self.partial_chain = partial_chain
        self.missing_predecessor = missing_predecessor


SECRET_CLOUD_OPTION_FIELDS = {
    "cloudAccessKey",
    "cloudParUrl",
    "cloudPassword",
    "cloudSecretAccessKey",
    "cloudSecretKey",
}
CLOUD_BOOL_OPTION_FIELDS = {
    "cloudChunkedTransfer": "cloud_chunked_transfer",
    "cloudTrace": "cloud_trace",
}
CLOUD_SERVICE_LABELS = {
    "GCP": "Google Cloud Storage",
    "OCI": "OCI",
    "openstack": "OpenStack",
    "s3": "S3",
}
CLOUD_REQUIRED_FIELDS = {
    "GCP": [
        ("bucket", ["cloudBucket"]),
        ("access key", ["cloudAccessKey"]),
        ("secret key", ["cloudSecretKey"]),
    ],
    "OCI": [
        ("PAR URL", ["cloudParUrl"]),
    ],
    "openstack": [
        ("container", ["cloudContainer"]),
        ("user ID", ["cloudUserId"]),
        ("password", ["cloudPassword"]),
        ("TempAuth, BasicAuth, or Identity URL", ["cloudTempAuthUrl", "cloudBasicAuthUrl", "cloudIdentityUrl"]),
    ],
    "s3": [
        ("bucket", ["cloudBucket"]),
        ("access key ID", ["cloudAccessKeyId"]),
        ("secret access key", ["cloudSecretAccessKey"]),
    ],
}
LEGACY_PARTIAL_BACKUP_CONVERSION_MESSAGE = (
    "This backup profile used legacy partial backup options. They were converted to table include "
    "filters for editing. Review the Contents tab before saving because the old databases list is "
    "now represented as a regular expression."
)


def _manager_config_path(backup_home_path: str) -> str:
    return os.path.join(backup_home_path, MANAGER_CONFIG_NAME)


def _empty_status(backup_home_path: str | None = None, message: str | None = None) -> MebStatus:
    return MebStatus(
        configured=False,
        backupHome=backup_home_path,
        statusItems=[
            MebStatusItem(
                label="MEB configuration",
                value=message or "No backup home directory path is available",
                tone="warn",
            ),
        ],
    )


def _read_config(path: str) -> configparser.RawConfigParser:
    with open(path, encoding="utf-8") as config_file:
        return _read_config_source(config_file)


def _read_config_text(content: str) -> configparser.RawConfigParser:
    return _read_config_source(io.StringIO(content))


def _read_config_source(source: TextIO) -> configparser.RawConfigParser:
    config = configparser.RawConfigParser()
    config.optionxform = str.lower
    config.read_file(source)

    return config


def _section_dict(config: configparser.RawConfigParser, section: str) -> dict[str, str]:
    if not config.has_section(section):
        return {}

    return {
        key: value
        for key, value in config.items(section)
        if key not in SECRET_KEYS
    }


def _manager_values(backup_home_path: str) -> dict[str, str]:
    path = _manager_config_path(backup_home_path)
    if not os.path.isfile(path):
        return {}

    try:
        config = _read_config(path)
    except (OSError, configparser.Error):
        return {}

    return _section_dict(config, "meb")


def _clean(value: Any) -> str | None:
    if value is None:
        return None

    value = str(value).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", "\""):
        return value[1:-1]

    return value or None


def _incremental_base(value: Any, *, strict: bool = False) -> str:
    result = _clean(value) or "history:last_backup"
    if result not in INCREMENTAL_BASE_VALUES:
        if not strict:
            return "history:last_backup"
        raise ValueError("Unsupported incremental backup base.")

    return result


def _storage_type(
    value: Any,
    *,
    strict: bool = False,
) -> Literal["local"]:
    result = _clean(value)
    result = result or "local"
    if result not in STORAGE_TYPES:
        if not strict:
            return "local"
        raise ValueError("Unsupported backup storage type.")

    return result


def _tts_mode(value: Any, *, strict: bool = False) -> Literal["0", "1", "2"]:
    result = _clean(value) or "0"
    if result in {"0", "1", "2"}:
        return cast(Literal["0", "1", "2"], result)
    if not strict:
        return "0"
    raise ValueError("Unsupported transportable tablespaces mode.")


def _cloud_service(value: Any, *, strict: bool = False) -> str | None:
    result = _clean(value)
    if not result:
        return None
    if result not in CLOUD_SERVICES:
        if not strict:
            return None
        raise ValueError("Unsupported cloud storage service.")

    return result


def _legacy_database_token_expression(token: str) -> str:
    parts = token.split(".", 1)
    schema = re.escape(parts[0])
    if len(parts) == 1:
        return r"%s\..*" % schema

    return r"%s\.%s" % (schema, re.escape(parts[1]))


def _legacy_databases_expression(value: str | None) -> str | None:
    tokens = [
        token.strip()
        for token in (value or "").split()
        if token.strip()
    ]
    if not tokens:
        return None

    alternatives = "|".join(_legacy_database_token_expression(token) for token in tokens)

    return r"^(?:%s)$" % alternatives


def _converted_legacy_partial_include_filter(backup_options: dict[str, str]) -> tuple[str | None, bool]:
    include_tables = _clean(backup_options.get("include_tables"))
    if include_tables:
        return include_tables, False

    legacy_include = _clean(backup_options.get("include"))
    legacy_databases = _legacy_databases_expression(backup_options.get("databases"))
    converted = [
        value
        for value in (legacy_include, legacy_databases)
        if value
    ]
    if not converted:
        return None, False

    if len(converted) == 1:
        return converted[0], True

    return "|".join("(?:%s)" % value for value in converted), True


def _truthy(value: Any) -> bool:
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def _nonzero(value: Any) -> bool:
    try:
        return int(str(value).strip()) != 0
    except (TypeError, ValueError):
        return _truthy(value)


def _get(config: configparser.RawConfigParser, section: str, option: str, fallback: str | None = None) -> str | None:
    if config.has_option(section, option):
        return _clean(config.get(section, option))

    return fallback


def _canonical_path(path: str) -> str:
    return os.path.realpath(os.path.abspath(os.path.expanduser(path)))


def _same_path(left: str | None, right: str | None) -> bool:
    if not left or not right:
        return False

    return os.path.normcase(_canonical_path(left)) == os.path.normcase(_canonical_path(right))


def _path_state(path: str | None) -> str:
    if not path:
        return "Not configured"

    if os.path.exists(path):
        return "Executable" if os.access(path, os.X_OK) else "Exists, not executable"

    return "Not found"


def _profile_type(meb_options: dict[str, str], backup_options: dict[str, str]) -> str:
    modes: list[str] = []

    if _truthy(meb_options.get("partial")):
        modes.append("Partial")
    else:
        modes.append("Full")

    if backup_options.get("incremental_backup_dir") or _truthy(meb_options.get("inc_backups_enabled")):
        modes.append("incremental")

    if _nonzero(meb_options.get("using_tts")):
        modes.append("TTS")

    if _truthy(meb_options.get("compress")):
        modes.append("compressed")

    return " + ".join(modes)


def _schedule_summary(meb_options: dict[str, str], prefix: str) -> str:
    enabled = _truthy(meb_options.get(f"{prefix}_backups_enabled"))
    if not enabled:
        return "Manual"

    frequency_key = str(meb_options.get(f"{prefix}_backups_frequency", ""))
    interval = _schedule_int(meb_options.get(f"{prefix}_backups_interval"), 1, 999, 1)
    frequencies = {
        "0": ("hour", "Hourly"),
        "1": ("day", "Daily"),
        "2": ("week", "Weekly"),
        "3": ("month", "Monthly"),
    }
    frequency_unit, frequency = frequencies.get(frequency_key, ("", "Scheduled"))
    if interval > 1 and frequency_unit:
        frequency = f"Every {interval} {frequency_unit}s"
    hour = meb_options.get(f"{prefix}_backups_hour")
    minute = meb_options.get(f"{prefix}_backups_minute")
    if frequency_key == "0" and minute is not None:
        try:
            return f"{frequency} at minute {int(minute):02d}"
        except ValueError:
            return frequency

    if hour is not None and minute is not None:
        try:
            return f"{frequency} at {int(hour):02d}:{int(minute):02d}"
        except ValueError:
            return frequency

    return frequency


def _week_days_from_text(value: Any) -> list[bool]:
    if not value:
        return [False, False, False, False, False, False, False]

    parts = [part.strip() for part in str(value).split(",")]
    if not parts or any(part not in {"0", "1", "2", "3", "4", "5", "6"} for part in parts):
        raise ValueError("Week days must be a comma-separated list of days between 0 and 6.")

    days = {int(part) for part in parts}
    if len(days) != len(parts):
        raise ValueError("Week days must be a comma-separated list of unique days between 0 and 6.")

    return [index in days for index in range(7)]


def _schedule(meb_options: dict[str, str], prefix: str) -> MebProfileSchedule:
    return MebProfileSchedule(
        enabled=_truthy(meb_options.get(f"{prefix}_backups_enabled")),
        interval=_schedule_int(meb_options.get(f"{prefix}_backups_interval"), 1, 999, 1),
        frequency=_schedule_int(meb_options.get(f"{prefix}_backups_frequency"), 0, 3, 0),
        monthDays=sorted(_schedule_month_days(
            meb_options.get(f"{prefix}_backups_month_day", "1"),
            "Schedule days of month",
        )),
        weekDays=_week_days_from_text(meb_options.get(f"{prefix}_backups_week_days")),
        hour=_schedule_int(meb_options.get(f"{prefix}_backups_hour"), 0, 23, 0),
        minute=_schedule_int(meb_options.get(f"{prefix}_backups_minute"), 0, 59, 0),
    )


def _latest_timestamp(paths: list[str | None]) -> str:
    latest: float | None = None

    for path in paths:
        if not path or not os.path.isdir(path):
            continue

        for candidate in glob.glob(os.path.join(path, "*")):
            try:
                modified = os.path.getmtime(candidate)
            except OSError:
                continue

            if latest is None or modified > latest:
                latest = modified

    if latest is None:
        return "No backups"

    from datetime import datetime
    return datetime.fromtimestamp(latest).strftime("%Y-%m-%d %H:%M")


def _format_byte_size(size: int | float | None) -> str | None:
    if size is None or isinstance(size, bool) or size < 0:
        return None

    value = float(size)
    units = ["B", "KB", "MB", "GB", "TB", "PB"]
    for unit in units:
        if value < 1024 or unit == units[-1]:
            if unit == "B":
                return f"{int(value)} B"
            if value < 10:
                return f"{value:.1f} {unit}"

            return f"{value:.0f} {unit}"
        value /= 1024

    return None


def _backup_home_disk_usage(backup_home_path: str) -> tuple[
    str | None, str | None, str | None, float | None, float | None
]:
    try:
        usage = shutil.disk_usage(backup_home_path)
    except OSError:
        return None, None, None, None, None

    used_size = _path_size(backup_home_path)
    used_percent = None
    other_used_percent = None
    if usage.total > 0 and used_size is not None:
        used_percent = min(100.0, max(0.0, used_size / usage.total * 100.0))
        other_used = max(0, usage.used - used_size)
        other_used_percent = min(100.0, max(0.0, other_used / usage.total * 100.0))

    return (
        _format_byte_size(usage.free),
        _format_byte_size(used_size),
        _format_byte_size(usage.total),
        used_percent,
        other_used_percent,
    )


def _progress_size(progress: Any) -> str | None:
    if not isinstance(progress, dict):
        return None

    current = progress.get("current")
    total = progress.get("total")
    unit = progress.get("unit")
    if not isinstance(unit, str):
        return None

    unit_key = unit.lower()
    multipliers = {
        "b": 1,
        "byte": 1,
        "bytes": 1,
        "kb": 1024,
        "kib": 1024,
        "mb": 1024 ** 2,
        "mib": 1024 ** 2,
        "gb": 1024 ** 3,
        "gib": 1024 ** 3,
        "tb": 1024 ** 4,
        "tib": 1024 ** 4,
    }
    multiplier = multipliers.get(unit_key)
    if multiplier is None:
        return None

    current_size = current if isinstance(current, int | float) and not isinstance(current, bool) else None
    total_size = total if isinstance(total, int | float) and not isinstance(total, bool) else None
    formatted_current = _format_byte_size(current_size * multiplier) if current_size is not None else None
    formatted_total = _format_byte_size(total_size * multiplier) if total_size is not None else None

    return formatted_current or formatted_total


def _path_size(path: str) -> int | None:
    try:
        path_stat = os.lstat(path)
    except OSError:
        return None

    if stat.S_ISREG(path_stat.st_mode):
        return path_stat.st_size
    if not stat.S_ISDIR(path_stat.st_mode):
        return None

    total = 0
    scanned = 0
    pending = [path]
    while pending:
        current = pending.pop()
        try:
            with os.scandir(current) as entries:
                for entry in entries:
                    scanned += 1
                    if scanned > BACKUP_SIZE_SCAN_MAX_ENTRIES:
                        return None
                    try:
                        entry_stat = entry.stat(follow_symlinks=False)
                    except OSError:
                        continue
                    if stat.S_ISREG(entry_stat.st_mode):
                        total += entry_stat.st_size
                    elif stat.S_ISDIR(entry_stat.st_mode):
                        pending.append(entry.path)
        except OSError:
            continue

    return total


def _backup_artifacts(path: str | None) -> list[tuple[float, str]]:
    if not path or not os.path.isdir(path):
        return []

    artifacts: list[tuple[float, str]] = []
    ignored_names = {
        MANAGER_CONFIG_NAME,
        JOB_LOG_DIR_NAME,
        PROGRESS_STATE_NAME,
        MYSQLBACKUP_PROGRESS_NAME,
        RUN_LOCK_DIR_NAME,
        ".mylogin.cnf",
    }
    try:
        with os.scandir(path) as entries:
            for entry in entries:
                if entry.name in ignored_names or entry.name.endswith(".cnf"):
                    continue
                if entry.name.endswith(".log"):
                    continue
                try:
                    entry_stat = entry.stat(follow_symlinks=False)
                except OSError:
                    continue
                if not stat.S_ISDIR(entry_stat.st_mode) and not stat.S_ISREG(entry_stat.st_mode):
                    continue
                artifacts.append((_artifact_timestamp(entry.path, entry_stat.st_mtime), entry.path))
    except OSError:
        return []

    return artifacts


def _backup_artifact_search_roots(
    backup_home_path: str,
    profiles: list[MebBackupProfileInfo],
) -> list[str]:
    roots: list[str] = []

    def add_root(path: str | None) -> None:
        if not path or path == "Not configured":
            return
        try:
            canonical_path = _canonical_path(path)
        except OSError:
            return
        if not _path_in_directory(backup_home_path, canonical_path) and canonical_path != backup_home_path:
            return
        first_part = os.path.relpath(canonical_path, backup_home_path).split(os.sep, 1)[0]
        if first_part in {
            MANAGER_CONFIG_NAME,
            JOB_LOG_DIR_NAME,
            PROGRESS_STATE_NAME,
            MYSQLBACKUP_PROGRESS_NAME,
            RUN_LOCK_DIR_NAME,
            ".mylogin.cnf",
        }:
            return
        if canonical_path not in roots:
            roots.append(canonical_path)

    for profile in profiles:
        if profile.storageType == "local":
            add_root(profile.destination)

    try:
        with os.scandir(backup_home_path) as entries:
            for entry in entries:
                if not entry.is_dir(follow_symlinks=False):
                    continue
                add_root(entry.path)
    except OSError:
        pass

    add_root(backup_home_path)

    return roots


def _activity_backup_artifact(
    backup_home_path: str,
    log_path: str,
    profiles: list[MebBackupProfileInfo],
) -> str | None:
    profile = _profile_for_log(log_path, profiles)
    candidate_roots = [profile.destination] if profile is not None and profile.storageType == "local" else []
    candidate_roots.extend(_backup_artifact_search_roots(backup_home_path, profiles))

    seen_roots: set[str] = set()
    for root in candidate_roots:
        try:
            canonical_root = _canonical_path(root)
        except (TypeError, ValueError, OSError):
            continue
        if canonical_root in seen_roots:
            continue
        seen_roots.add(canonical_root)

        artifact = _matching_backup_artifact(canonical_root, log_path)
        if artifact and _path_in_directory(canonical_root, artifact):
            return artifact

    return None


def _artifact_timestamp(path: str, fallback: float) -> float:
    name = os.path.basename(path)
    for pattern in ("%Y-%m-%d_%H-%M-%S", "%Y-%m-%d_%H%M%S"):
        try:
            return datetime.strptime(name, pattern).timestamp()
        except ValueError:
            continue

    return fallback


def _backup_artifact_path_from_log(log_path: str) -> str | None:
    try:
        content = _read_text_head(log_path, LOG_ARTIFACT_PATH_HEAD_BYTES)
    except (OSError, ValueError):
        return None

    matches = re.findall(r"Backup directory created:\s*'(?P<path>.*)'\s*$", content, re.MULTILINE)
    return matches[-1] if matches else None


def _matching_backup_artifact(path: str | None, log_path: str) -> str | None:
    if not path:
        return None
    artifact = _backup_artifact_path_from_log(log_path)
    if artifact is None:
        return None
    try:
        artifact = _canonical_path(artifact)
    except (TypeError, ValueError, OSError):
        return None
    if not os.path.isdir(artifact) or not _path_in_directory(path, artifact):
        return None

    return artifact


def _profile_for_log(log_path: str, profiles: list[MebBackupProfileInfo]) -> MebBackupProfileInfo | None:
    name = os.path.basename(log_path)
    matches = [
        profile for profile in profiles
        if profile.uuid and f"-{profile.uuid}-" in name
    ]
    if matches:
        return max(matches, key=lambda profile: len(profile.uuid))

    operation_match = re.match(r"^\d{8}T\d{6}Z-(restore|apply-logs|verify)-", name)
    if operation_match is None:
        return None

    artifact_matches: list[tuple[int, MebBackupProfileInfo]] = []
    operation = operation_match.group(1)
    for profile in profiles:
        for _artifact_time, artifact_path in _backup_artifacts(profile.destination):
            artifact_name = os.path.basename(artifact_path)
            if f"-{operation}-{artifact_name}-" in name:
                artifact_matches.append((len(artifact_name), profile))

    if not artifact_matches:
        return None

    return max(artifact_matches, key=lambda match: match[0])[1]


def _activity_backup_size(log_path: str, root: str, profiles: list[MebBackupProfileInfo]) -> str | None:
    profile = _profile_for_log(log_path, profiles)
    if profile is not None:
        return _format_activity_artifact_size(log_path, profile)

    log_directory = os.path.dirname(log_path)
    if _canonical_path(log_directory) != _canonical_path(root):
        formatted = _format_byte_size(_path_size(log_directory))
        if formatted:
            return formatted

    return None


def _format_activity_artifact_size(log_path: str, profile: MebBackupProfileInfo) -> str | None:
    artifact = _matching_backup_artifact(profile.destination, log_path)
    if artifact and _path_in_directory(profile.destination, artifact):
        return _format_byte_size(_path_size(artifact))

    return None


def _activity_log_allowed_roots(backup_home_path: str, profiles: list[MebBackupProfileInfo]) -> list[str]:
    allowed_roots = [os.path.join(backup_home_path, JOB_LOG_DIR_NAME)]
    for profile in profiles:
        if profile.destination and profile.destination != "Not configured":
            allowed_roots.append(profile.destination)

    return allowed_roots


def _validate_activity_log_path(
    backup_home_path: str,
    log_path: str,
    profiles: list[MebBackupProfileInfo],
) -> str:
    if not any(_path_in_directory(root, log_path) for root in _activity_log_allowed_roots(backup_home_path, profiles)):
        raise ValueError("Log file is not below a configured backup destination")

    resolved_log_path = _canonical_path(log_path)
    if not os.path.isfile(resolved_log_path):
        raise ValueError("Log file was not found")

    return resolved_log_path


def activity_id_for_log(
    backup_home_path: str,
    log_path: str,
    profiles: list[MebBackupProfileInfo] | None = None,
) -> str:
    """Returns the opaque activity identifier for a managed MEB log."""

    backup_home_path = _clean(backup_home_path)
    log_path = _clean(log_path)
    if not backup_home_path or not log_path:
        raise ValueError("Backup home and log path are required")

    backup_home_path = _canonical_path(backup_home_path)
    profiles = profiles if profiles is not None else _read_profiles(backup_home_path)
    resolved_log_path = _validate_activity_log_path(backup_home_path, log_path, profiles)
    if not _path_in_directory(backup_home_path, resolved_log_path):
        raise ValueError("Log file is outside the configured backup home")

    relative_path = os.path.relpath(resolved_log_path, backup_home_path).replace(os.sep, "/")
    parts = relative_path.split("/")
    if "\\" in relative_path or ":" in relative_path or any(
        not part or part in {".", ".."} for part in parts
    ):
        raise ValueError("Log file cannot be represented by an activity identifier")

    return f"{ACTIVITY_ID_PREFIX}{relative_path}"


def activity_log_path(
    backup_home_path: str,
    activity_id: str,
    profiles: list[MebBackupProfileInfo] | None = None,
) -> str:
    """Resolves an opaque activity identifier to a managed MEB log path."""

    backup_home_path = _clean(backup_home_path)
    if not isinstance(activity_id, str) or activity_id != activity_id.strip():
        raise ValueError("Invalid activity identifier")
    activity_id = _clean(activity_id)
    if not backup_home_path or not activity_id:
        raise ValueError("Backup home and activity ID are required")
    if not activity_id.startswith(ACTIVITY_ID_PREFIX):
        raise ValueError("Invalid activity identifier")

    relative_path = activity_id[len(ACTIVITY_ID_PREFIX):]
    parts = relative_path.split("/")
    if "\\" in relative_path or ":" in relative_path or any(
        not part or part in {".", ".."} for part in parts
    ):
        raise ValueError("Invalid activity identifier")

    backup_home_path = _canonical_path(backup_home_path)
    resolved_log_path = _canonical_path(os.path.join(backup_home_path, *parts))
    if not _path_in_directory(backup_home_path, resolved_log_path):
        raise ValueError("Activity log is outside the configured backup home")

    profiles = profiles if profiles is not None else _read_profiles(backup_home_path)
    return _validate_activity_log_path(backup_home_path, resolved_log_path, profiles)


def resolve_activity(
    backup_home_path: str,
    activity_id: str,
    profiles: list[MebBackupProfileInfo] | None = None,
) -> ResolvedActivity:
    """Resolves an activity identifier and its optional backup association."""

    backup_home_path = _canonical_path(_clean(backup_home_path) or "")
    profiles = profiles if profiles is not None else _read_profiles(backup_home_path)
    log_path = activity_log_path(backup_home_path, activity_id, profiles)
    profile = _profile_for_log(log_path, profiles)
    profile_id = profile.uuid if profile is not None else None
    backup_id = None
    backup_error = None
    if profile is not None and profile.storageType != "local":
        backup_error = "Only local backup data can be managed from recent activity"
    else:
        artifact = _activity_backup_artifact(backup_home_path, log_path, profiles)
        if artifact is None:
            backup_error = "Backup data was not found for this activity entry"
        else:
            artifact = _canonical_path(artifact)
            if not _path_in_directory(backup_home_path, artifact):
                backup_error = "Backup data is outside the configured backup home"
            else:
                candidate_id = os.path.relpath(artifact, backup_home_path).replace(os.sep, "/")
                if candidate_id.split("/", 1)[0] in {
                    MANAGER_CONFIG_NAME,
                    JOB_LOG_DIR_NAME,
                    PROGRESS_STATE_NAME,
                    MYSQLBACKUP_PROGRESS_NAME,
                    RUN_LOCK_DIR_NAME,
                    ".mylogin.cnf",
                }:
                    backup_error = "Backup data was not found for this activity entry"
                else:
                    backup_id = candidate_id

    return ResolvedActivity(
        activity_id=activity_id,
        log_path=log_path,
        backup_id=backup_id,
        profile_id=profile_id,
        activity_type=_activity_backup_type(log_path, profiles),
        backup_error=backup_error,
    )


def backup_path_for_activity(backup_home_path: str, activity_id: str) -> str:
    """Returns the canonical local backup directory for a recent activity."""

    backup_home_path = _canonical_path(_clean(backup_home_path) or "")
    resolved = resolve_activity(backup_home_path, activity_id)
    backup_path = _canonical_path(os.path.join(backup_home_path, *resolved.require_backup_id().split("/")))
    if not _path_in_directory(backup_home_path, backup_path):
        raise ValueError("Backup data is outside the configured backup home")

    return backup_path


def _restore_chain_for_backup(backup_home_path: str, backup_id: str) -> list[str]:
    """Returns the full-to-target local directory-backup restore chain."""

    backup_home_path = _clean(backup_home_path)
    if not isinstance(backup_id, str) or backup_id != backup_id.strip():
        raise ValueError("Invalid backup identifier")
    backup_id = _clean(backup_id)
    if not backup_home_path or not backup_id:
        raise ValueError("Backup home and backup ID are required")
    backup_home_path = _canonical_path(backup_home_path)

    parts = backup_id.split("/")
    if "\\" in backup_id or ":" in backup_id or any(
        not part or part in {".", ".."} for part in parts
    ):
        raise ValueError("Invalid backup identifier")

    backup_path = _canonical_path(os.path.join(backup_home_path, *parts))
    if not _path_in_directory(backup_home_path, backup_path) or not os.path.isdir(backup_path):
        raise ValueError("Backup data was not found")

    target = _read_backup_restore_point(backup_path, required=True)
    assert target is not None
    if not target.is_incremental:
        return [target.path]

    points = _backup_restore_points_for_backup_home(backup_home_path, backup_path)
    points_by_end_lsn: dict[int, list[_BackupRestorePoint]] = {}
    for point in points:
        points_by_end_lsn.setdefault(point.end_lsn, []).append(point)

    chain = [target]
    visited = {target.path}
    current = target
    while current.is_incremental:
        # In backup_variables.txt, an incremental start_lsn is the first included
        # LSN, one greater than the --start-lsn input and its predecessor's end_lsn.
        expected_end_lsn = current.start_lsn - 1
        predecessors = [
            point for point in points_by_end_lsn.get(expected_end_lsn, [])
            if point.path != current.path
        ]
        if not predecessors:
            raise _RestoreChainResolutionError(
                "The preceding backup required for this incremental backup was not found",
                [point.path for point in reversed(chain)],
                missing_predecessor=True,
            )
        if len(predecessors) > 1:
            raise _RestoreChainResolutionError(
                "The preceding backup for this incremental backup is ambiguous",
                [point.path for point in reversed(chain)],
            )

        current = predecessors[0]
        if current.path in visited:
            raise ValueError("The incremental backup chain contains a cycle")
        visited.add(current.path)
        chain.append(current)

    return [point.path for point in reversed(chain)]


def _dependent_incremental_backups(backup_home_path: str, backup_id: str) -> list[str]:
    """Returns incremental backups whose restore chains include the given backup."""

    backup_home_path = _canonical_path(backup_home_path)
    if not isinstance(backup_id, str) or backup_id != backup_id.strip():
        raise ValueError("Invalid backup identifier")
    backup_id = _clean(backup_id)
    if not backup_id:
        raise ValueError("Backup ID is required")
    parts = backup_id.split("/")
    if "\\" in backup_id or ":" in backup_id or any(
        not part or part in {".", ".."} for part in parts
    ):
        raise ValueError("Invalid backup identifier")

    target_path = _canonical_path(os.path.join(backup_home_path, *parts))
    if not _path_in_directory(backup_home_path, target_path) or not os.path.isdir(target_path):
        raise ValueError("Backup data was not found")
    target = _read_backup_restore_point(target_path, required=True)
    assert target is not None
    points = _backup_restore_points_for_backup_home(backup_home_path, target_path)
    dependents_by_predecessor_end_lsn: dict[int, list[_BackupRestorePoint]] = {}
    for point in points:
        if point.is_incremental:
            # Incremental metadata starts one LSN after the predecessor's end_lsn.
            dependents_by_predecessor_end_lsn.setdefault(point.start_lsn - 1, []).append(point)

    dependents: list[str] = []
    pending = [target]
    visited = {target.path}
    while pending:
        predecessor = pending.pop()
        for dependent in dependents_by_predecessor_end_lsn.get(predecessor.end_lsn, []):
            if dependent.path in visited:
                continue
            visited.add(dependent.path)
            dependents.append(dependent.path)
            pending.append(dependent)

    return sorted(dependents)


def _backup_restore_points_for_backup_home(
    backup_home_path: str,
    backup_path: str,
) -> list[_BackupRestorePoint]:
    backup_relative_path = os.path.relpath(backup_path, backup_home_path)
    backup_root = os.path.join(backup_home_path, backup_relative_path.split(os.sep, 1)[0])
    points: list[_BackupRestorePoint] = []
    seen_paths: set[str] = set()
    try:
        for directory, directories, _files in os.walk(backup_root, followlinks=False):
            point = _read_backup_restore_point(directory, required=False)
            if point is None:
                continue
            directories.clear()
            if point.path not in seen_paths:
                seen_paths.add(point.path)
                points.append(point)
    except OSError:
        pass

    return points


def _read_backup_restore_point(path: str, *, required: bool) -> _BackupRestorePoint | None:
    variables_path = os.path.join(path, "meta", "backup_variables.txt")
    parser = configparser.RawConfigParser()
    try:
        with open(variables_path, encoding="utf-8") as variables_file:
            parser.read_file(variables_file)
    except FileNotFoundError:
        if required:
            raise _BackupMetadataNotFoundError("Backup metadata could not be read")
        return None
    except (OSError, configparser.Error):
        if required:
            raise ValueError("Backup metadata could not be read")
        return None

    if not parser.has_section("backup_variables"):
        if required:
            raise ValueError("Backup metadata is malformed")
        return None

    variables = dict(parser.items("backup_variables"))
    is_incremental = variables.get("is_incremental")
    if is_incremental not in {"0", "1"}:
        if required:
            raise ValueError("Backup metadata does not identify the backup type")
        return None

    try:
        start_lsn = int(variables["start_lsn"])
        end_lsn = int(variables["end_lsn"])
    except (KeyError, TypeError, ValueError):
        if required:
            raise ValueError("Backup metadata does not contain valid LSN values")
        return None
    if start_lsn < 0 or end_lsn < 0:
        if required:
            raise ValueError("Backup metadata does not contain valid LSN values")
        return None

    return _BackupRestorePoint(
        path=_canonical_path(path),
        is_incremental=is_incremental == "1",
        start_lsn=start_lsn,
        end_lsn=end_lsn,
    )


def _format_backup_type(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.lower()
    if normalized == "full":
        return "Full Backup"
    if normalized == "incremental":
        return "Incremental Backup"

    return None


def _activity_backup_type(log_path: str, profiles: list[MebBackupProfileInfo]) -> str | None:
    name = os.path.basename(log_path)
    operation_match = re.match(r"^\d{8}T\d{6}Z-(restore|apply-logs|verify)-", name)
    if operation_match is not None:
        return {
            "restore": "Restore",
            "apply-logs": "Apply Logs",
            "verify": "Verify",
        }[operation_match.group(1)]

    profile = _profile_for_log(log_path, profiles)
    if profile is not None and profile.uuid:
        prefix = f"-{profile.uuid}-"
        position = name.find(prefix)
        if position >= 0:
            suffix = name[position + len(prefix):]
            match = re.match(r"(?:backup-)?(full|incremental)(?:-|$)", suffix)
            if match is None:
                return None

            return _format_backup_type(match.group(1))

    return None


def _activity_log_status(content: str) -> _ActivityLogStatus:
    lower_content = content.lower()
    verify_result = re.search(
        r"(?im)^# backups\.verify finished exitCode=(-?\d+) timedOut=(true|false)\b",
        content,
    )
    if verify_result is not None:
        exit_code = int(verify_result.group(1))
        timed_out = verify_result.group(2).lower() == "true"
        if exit_code == 0 and not timed_out:
            return _ActivityLogStatus("Backup verification completed successfully", "Verified", "ok")

        return _ActivityLogStatus("Backup verification failed", "Failed", "warn")

    helper_failure = re.search(r"\bfinished exitcode=(?!0\b)\d+", lower_content) is not None
    mysqlbackup_failure = (
        "error" in lower_content
        or "failed" in lower_content
        or "mysqlbackup exit code:" in lower_content
        or helper_failure
    )
    if mysqlbackup_failure:
        return _ActivityLogStatus("Errors reported in mysqlbackup log", "Failed", "warn")
    if re.search(r"(?im)^\s*mysqlbackup completed ok!\s*$", content) is not None:
        return _ActivityLogStatus("mysqlbackup completed OK", "Completed OK", "ok")

    return _ActivityLogStatus("Log file updated", "Updated", "info")


def _collect_log_activity(
    backup_home_path: str,
    paths: list[str | None],
    profiles: list[MebBackupProfileInfo],
) -> list[MebActivityItem]:
    log_files: list[tuple[float, str, str]] = []
    seen_roots: set[str] = set()
    seen_log_paths: set[str] = set()

    def add_log_file(root: str, candidate: str) -> None:
        try:
            if not _path_in_directory(root, candidate) or not os.path.isfile(candidate):
                return
            canonical_candidate = _canonical_path(candidate)
            if canonical_candidate in seen_log_paths:
                return

            seen_log_paths.add(canonical_candidate)
            log_files.append((os.path.getmtime(candidate), candidate, root))
        except OSError:
            return

    for path in paths:
        if not path or not os.path.isdir(path):
            continue
        canonical_path = _canonical_path(path)
        if canonical_path in seen_roots:
            continue
        seen_roots.add(canonical_path)

        for candidate in glob.glob(os.path.join(path, "*.log")):
            add_log_file(path, candidate)

        for child in glob.glob(os.path.join(path, "*")):
            if not os.path.isdir(child):
                continue

            for candidate in glob.glob(os.path.join(child, "*.log")):
                add_log_file(path, candidate)

    log_files.sort(reverse=True)

    activity: list[MebActivityItem] = []
    for modified, path, root in log_files:
        try:
            content = _read_text_tail(path, LOG_ACTIVITY_TAIL_BYTES)
            activity_id = activity_id_for_log(backup_home_path, path, profiles)
        except (OSError, ValueError):
            continue

        log_status = _activity_log_status(content)
        detail = log_status.detail
        status = log_status.status
        tone = log_status.tone
        profile = _profile_for_log(path, profiles)
        size = _activity_backup_size(path, root, profiles)
        activity_type = _activity_backup_type(path, profiles)
        if (
            profile is not None
            and profile.storageType == "local"
            and activity_type in {"Full Backup", "Incremental Backup"}
            and status == "Completed OK"
            and size is None
        ):
            detail = "Backup log exists, but backup files were not found"
            status = "Backup missing"
            tone = "warn"

        from datetime import datetime
        activity.append(MebActivityItem(
            time=datetime.fromtimestamp(modified).strftime("%Y-%m-%d %H:%M"),
            title=profile.label if profile is not None else "Unknown profile",
            detail=detail,
            tone=tone,
            activityId=activity_id,
            size=size,
            profile=profile.label if profile is not None else "Unknown profile",
            profileId=profile.uuid if profile is not None else None,
            status=status,
            backupType=activity_type,
            isBackup=activity_type in {"Full Backup", "Incremental Backup"},
        ))

    return activity


def _profile_has_backup_data(backup_home_path: str, profile: MebBackupProfileInfo) -> bool:
    paths = [os.path.join(backup_home_path, JOB_LOG_DIR_NAME), profile.destination]
    seen_roots: set[str] = set()

    for path in paths:
        if not path or not os.path.isdir(path):
            continue
        root = _canonical_path(path)
        if root in seen_roots:
            continue
        seen_roots.add(root)

        candidates = glob.glob(os.path.join(root, "*.log"))
        for child in glob.glob(os.path.join(root, "*")):
            if os.path.isdir(child):
                candidates.extend(glob.glob(os.path.join(child, "*.log")))

        for candidate in candidates:
            try:
                if not _path_in_directory(root, candidate) or not os.path.isfile(candidate):
                    continue
                resolved_candidate = _canonical_path(candidate)
                if _profile_for_log(resolved_candidate, [profile]) is None:
                    continue
                status = _activity_log_status(_read_text_tail(
                    resolved_candidate,
                    LOG_ACTIVITY_TAIL_BYTES,
                )).status
            except (OSError, ValueError):
                continue

            if status != "Completed OK":
                continue
            if profile.storageType != "local":
                return True

            artifact = _matching_backup_artifact(profile.destination, resolved_candidate)
            if artifact and _path_in_directory(profile.destination, artifact):
                return True

    return False


def _read_progress_state(backup_home_path: str) -> dict[str, Any] | None:
    path = os.path.join(backup_home_path, PROGRESS_STATE_NAME)
    if not _path_in_directory(backup_home_path, path):
        return None

    flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW

    fd = None
    try:
        fd = os.open(path, flags)
        file_stat = os.fstat(fd)
        if not stat.S_ISREG(file_stat.st_mode) or getattr(file_stat, "st_nlink", 1) > 1:
            return None
        data = os.read(fd, PROGRESS_STATE_MAX_BYTES + 1)
    except OSError:
        return None
    finally:
        if fd is not None:
            os.close(fd)

    if len(data) > PROGRESS_STATE_MAX_BYTES:
        return None

    try:
        value = json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None

    return value if isinstance(value, dict) else None


def _format_progress_value(value: Any) -> str | None:
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else str(value)

    return None


MYSQLBACKUP_PROGRESS_RE = re.compile(
    r"Progress:\s*"
    r"(?P<current>\d+(?:\.\d+)?)\s+of\s+"
    r"(?P<total>\d+(?:\.\d+)?)\s+"
    r"(?P<unit>[A-Za-z]+)"
    r"(?:;\s*state:\s*(?P<message>[^\r\n;]+))?"
    r"(?:;\s*compression:\s*(?P<compression>[^\r\n;]+))?",
    re.IGNORECASE,
)


def _progress_number(value: str) -> int | float:
    number = float(value)

    return int(number) if number.is_integer() else number


def _parse_mysqlbackup_progress(text: str) -> dict[str, Any] | None:
    latest = None
    for latest in MYSQLBACKUP_PROGRESS_RE.finditer(text):
        pass
    if latest is None:
        return None

    progress = {
        "current": _progress_number(latest.group("current")),
        "total": _progress_number(latest.group("total")),
        "unit": latest.group("unit"),
        "text": latest.group(0).strip(),
    }
    message = latest.group("message")
    if message:
        progress["message"] = message.strip()
    compression = latest.group("compression")
    if compression:
        progress["compression"] = compression.strip()

    return progress


def _read_mysqlbackup_progress(backup_home_path: str, state: dict[str, Any]) -> dict[str, Any] | None:
    path = state.get("mysqlbackupProgressPath")
    if not isinstance(path, str) or not path:
        path = os.path.join(backup_home_path, MYSQLBACKUP_PROGRESS_NAME)
    if not _path_in_directory(backup_home_path, path):
        return None

    try:
        return _parse_mysqlbackup_progress(_read_text_tail(path, PROGRESS_STATE_MAX_BYTES))
    except (OSError, ValueError):
        return None


def _running_progress_detail(progress: Any) -> str:
    if not isinstance(progress, dict):
        return "Waiting for mysqlbackup progress"

    current = _format_progress_value(progress.get("current"))
    total = _format_progress_value(progress.get("total"))
    unit = progress.get("unit")
    message = progress.get("message")
    parts = []
    if current is not None and total is not None and isinstance(unit, str) and unit:
        parts.append(f"{current} of {total} {unit}")
    if isinstance(message, str) and message.strip():
        parts.append(message.strip())

    return "; ".join(parts) if parts else "Waiting for mysqlbackup progress"


def _running_progress_title(state: dict[str, Any], profiles: list[MebBackupProfileInfo]) -> str:
    if state.get("backupMode") == "restore":
        return "Restore running"

    job_id = state.get("jobId")
    if isinstance(job_id, str) and job_id:
        for profile in profiles:
            if profile.uuid and job_id.startswith(f"{profile.uuid}-"):
                return f"Backup running: {profile.label}"

        return f"Backup running: {job_id}"

    return "Backup running"


def _running_progress_profile(state: dict[str, Any], profiles: list[MebBackupProfileInfo]) -> str:
    if state.get("backupMode") == "restore":
        return "Restore"

    job_id = state.get("jobId")
    if isinstance(job_id, str) and job_id:
        for profile in profiles:
            if profile.uuid and job_id.startswith(f"{profile.uuid}-"):
                return profile.label

    return "Unknown profile"


def _running_progress_profile_id(state: dict[str, Any], profiles: list[MebBackupProfileInfo]) -> str | None:
    if state.get("backupMode") == "restore":
        return None

    job_id = state.get("jobId")
    if isinstance(job_id, str) and job_id:
        for profile in profiles:
            if profile.uuid and job_id.startswith(f"{profile.uuid}-"):
                return profile.uuid

    return None


def _running_progress_backup_type(state: dict[str, Any]) -> str | None:
    if state.get("backupMode") == "restore":
        return "Restore"

    backup_type = _format_backup_type(state.get("backupMode"))
    if backup_type:
        return backup_type

    job_id = state.get("jobId")
    if isinstance(job_id, str):
        if job_id.endswith("-backup-full"):
            return "Full Backup"
        if job_id.endswith("-backup-incremental"):
            return "Incremental Backup"

    return None


def _running_progress_activity(backup_home_path: str, profiles: list[MebBackupProfileInfo]) -> MebActivityItem | None:
    if not os.path.isdir(os.path.join(backup_home_path, RUN_LOCK_DIR_NAME)):
        return None

    state = _read_progress_state(backup_home_path)
    if state is None or state.get("state") != "running":
        return None

    timestamp = state.get("updatedTime") or state.get("startedTime")
    if not isinstance(timestamp, int):
        timestamp = None

    log_path = state.get("logPath")
    if not isinstance(log_path, str) or not _path_in_directory(backup_home_path, log_path):
        log_path = None

    activity_id = None
    if log_path is not None and os.path.isfile(log_path):
        try:
            activity_id = activity_id_for_log(backup_home_path, log_path, profiles)
        except ValueError:
            activity_id = None

    progress = _read_mysqlbackup_progress(backup_home_path, state) or state.get("progress")

    from datetime import datetime
    activity_type = _running_progress_backup_type(state)
    return MebActivityItem(
        time=datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M") if timestamp else "Running",
        title=_running_progress_title(state, profiles),
        detail=_running_progress_detail(progress),
        tone="info",
        activityId=activity_id,
        size=_progress_size(progress),
        profile=_running_progress_profile(state, profiles),
        profileId=_running_progress_profile_id(state, profiles),
        status="Running",
        backupType=activity_type,
        isBackup=activity_type in {"Full Backup", "Incremental Backup"},
    )


def _read_text_tail(path: str, byte_limit: int, include_truncation_marker: bool = False) -> str:
    flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW

    fd = os.open(path, flags)
    try:
        file_stat = os.fstat(fd)
        if not stat.S_ISREG(file_stat.st_mode):
            raise ValueError("Log file must be a regular file")
        if getattr(file_stat, "st_nlink", 1) > 1:
            raise ValueError("Log file cannot be a hard link")

        size = file_stat.st_size
        truncated = size > byte_limit
        if truncated:
            os.lseek(fd, -byte_limit, os.SEEK_END)
        data = os.read(fd, byte_limit)
    finally:
        os.close(fd)

    content = data.decode("utf-8", errors="replace")
    if truncated and include_truncation_marker:
        return "[Log truncated to last %d bytes]\n%s" % (byte_limit, content)

    return content


def _read_text_head(path: str, byte_limit: int) -> str:
    flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW

    fd = os.open(path, flags)
    try:
        file_stat = os.fstat(fd)
        if not stat.S_ISREG(file_stat.st_mode):
            raise ValueError("Log file must be a regular file")
        if getattr(file_stat, "st_nlink", 1) > 1:
            raise ValueError("Log file cannot be a hard link")
        data = os.read(fd, byte_limit)
    finally:
        os.close(fd)

    return data.decode("utf-8", errors="replace")


def _profile_from_config(
    path: str,
    config: configparser.RawConfigParser,
    latest_resolver: Callable[[list[str | None]], str] | None = _latest_timestamp,
) -> MebBackupProfileInfo:
    meb_options = _section_dict(config, "meb_manager")
    backup_options = _section_dict(config, "mysqlbackup")
    backup_dir = _get(config, "mysqlbackup", "backup_dir")
    command = meb_options.get("command") or _get(config, "mysqlbackup", "command")
    storage_type = _storage_type(meb_options.get("storage_type"))
    include_tables, legacy_partial_backup_converted = _converted_legacy_partial_include_filter(backup_options)

    label = meb_options.get("label") or Path(path).stem

    return MebBackupProfileInfo(
        uuid=meb_options.get("uuid") or Path(path).stem,
        label=label,
        type=_profile_type(meb_options, backup_options),
        destination=backup_dir or "Not configured",
        latest=latest_resolver([backup_dir]) if latest_resolver else "No backups",
        nextFull=_schedule_summary(meb_options, "full"),
        nextIncremental=_schedule_summary(meb_options, "inc"),
        status="Configured" if backup_dir else "Needs review",
        command=command,
        user=_get(config, "client", "user"),
        comments=_get(config, "mysqlbackup", "comments"),
        storageType=storage_type,
        cloudService=_cloud_service(backup_options.get("cloud_service")) or MebBackupProfileInfo().cloudService,
        cloudObject=backup_options.get("cloud_object"),
        cloudHost=backup_options.get("cloud_host"),
        cloudBucket=backup_options.get("cloud_bucket"),
        cloudObjectKey=backup_options.get("cloud_object_key"),
        cloudAccessKeyId=backup_options.get("cloud_access_key_id"),
        cloudAwsRegion=backup_options.get("cloud_aws_region"),
        cloudContainer=backup_options.get("cloud_container"),
        cloudUserId=backup_options.get("cloud_user_id"),
        cloudTempAuthUrl=backup_options.get("cloud_tempauth_url"),
        cloudBasicAuthUrl=backup_options.get("cloud_basicauth_url"),
        cloudIdentityUrl=backup_options.get("cloud_identity_url"),
        cloudTenant=backup_options.get("cloud_tenant"),
        cloudRegion=backup_options.get("cloud_region"),
        cloudChunkedTransfer=_truthy(backup_options.get("cloud_chunked_transfer")),
        cloudChunkSize=backup_options.get("cloud_chunk_size"),
        cloudProxy=backup_options.get("cloud_proxy"),
        cloudCaInfo=backup_options.get("cloud_ca_info"),
        cloudCaPath=backup_options.get("cloud_ca_path"),
        cloudBufferSize=backup_options.get("cloud_buffer_size"),
        cloudTrace=_truthy(backup_options.get("cloud_trace")),
        partial=_truthy(meb_options.get("partial")),
        includeTables=include_tables,
        legacyPartialBackupConverted=legacy_partial_backup_converted,
        legacyPartialBackupConversionMessage=(
            LEGACY_PARTIAL_BACKUP_CONVERSION_MESSAGE if legacy_partial_backup_converted else None
        ),
        excludeTables=_get(config, "mysqlbackup", "exclude_tables"),
        incrementalBase=_incremental_base(backup_options.get("incremental_base")),
        usingTts=_tts_mode(meb_options.get("using_tts")),
        compress=_truthy(meb_options.get("compress")),
        compressMethod=meb_options.get("compress_method") or "lz4",
        compressLevel=str(meb_options.get("compress_level", "1")),
        applyLog=_truthy(meb_options.get("apply_log")),
        skipUnusedPages=_truthy(meb_options.get("skip_unused_pages")),
        incrementalWithRedoLogOnly=_truthy(meb_options.get("incremental_with_redo_log_only")),
        fullSchedule=_schedule(meb_options, "full"),
        incSchedule=_schedule(meb_options, "inc"),
        datadir=(
            _get(config, "mysqlbackup", "datadir") or meb_options.get("datadir")
            or _get(config, "mysqld", "datadir")
        ),
        mysqlBasedir=(
            meb_options.get("basedir") or _get(config, "mysqlbackup", "basedir")
            or _get(config, "mysqld", "basedir")
        ),
        mysqlVersion=meb_options.get("version"),
        configPath=path,
    )


def _read_profiles(backup_home: str | None) -> list[MebBackupProfileInfo]:
    if not backup_home or not os.path.isdir(backup_home):
        return []

    profiles: list[MebBackupProfileInfo] = []
    for path in sorted(glob.glob(os.path.join(backup_home, "*.cnf"))):
        if os.path.basename(path) in IGNORED_PROFILE_CONFIGS:
            continue

        if not _path_in_directory(backup_home, path):
            continue

        try:
            config = _read_config(path)
        except (OSError, configparser.Error):
            continue

        profiles.append(_profile_from_config(path, config))

    return profiles


def _first_profile_value(profiles: list[MebBackupProfileInfo], key: str) -> Any:
    for profile in profiles:
        value = getattr(profile, key, None)
        if value:
            return value

    return None


def _profile_template(
    backup_home_path: str,
    command: str | None,
    backup_user: str | None,
    datadir: str | None,
    mysql_basedir: str | None,
    mysql_version: str | None,
) -> MebBackupProfileInfo:
    return MebBackupProfileInfo(
        destination=backup_home_path,
        command=command,
        user=backup_user,
        datadir=datadir,
        mysqlBasedir=mysql_basedir,
        mysqlVersion=mysql_version,
    )


def _scheduler_login_requirement(
    manager_values: dict[str, str],
) -> Literal["required", "notRequired"] | None:
    scheduler_backend = manager_values.get("scheduler_backend")
    if scheduler_backend == "cron":
        return "notRequired"

    if scheduler_backend == "launchd":
        return "required"

    if scheduler_backend == "schtasks":
        windows_logon_type = manager_values.get("windows_logon_type", "S4U")
        if windows_logon_type == "S4U":
            return "notRequired"

        if windows_logon_type == "InteractiveToken":
            return "required"

    return None


def build_status(backup_home_path: str, manager_values: dict[str, str], profiles: list[MebBackupProfileInfo]) -> MebStatus:
    scheduler_login_requirement = _scheduler_login_requirement(manager_values)
    for profile in profiles:
        if profile.fullSchedule.enabled or profile.incSchedule.enabled:
            profile.schedulerLoginRequirement = scheduler_login_requirement
        else:
            profile.schedulerLoginRequirement = None

    profile_paths = [
        profile.destination
        for profile in profiles
        if profile.destination and profile.destination != "Not configured"
    ]
    command = (
        manager_values.get("mysqlbackup")
        or _first_profile_value(profiles, "command")
    )
    backup_user = (
        manager_values.get("backup_mysql_user")
        or _first_profile_value(profiles, "user")
    )
    datadir = manager_values.get("datadir") or _first_profile_value(profiles, "datadir")
    mysql_basedir = manager_values.get("basedir") or _first_profile_value(profiles, "mysqlBasedir")
    mysql_version = manager_values.get("mysql_version") or _first_profile_value(profiles, "mysqlVersion")
    recent_activity = _collect_log_activity(backup_home_path, [backup_home_path, *profile_paths], profiles)
    running_activity = _running_progress_activity(backup_home_path, profiles)
    if running_activity is not None:
        recent_activity = [
            running_activity,
            *[
                item for item in recent_activity
                if not running_activity.activityId or item.activityId != running_activity.activityId
            ],
        ][:6]

    (
        space_available,
        space_used,
        space_total,
        space_used_percent,
        space_other_used_percent,
    ) = _backup_home_disk_usage(backup_home_path)

    return MebStatus(
        configured=True,
        mysqlbackupCommand=command,
        backupHome=backup_home_path,
        backupUser=backup_user,
        mysqlVersion=mysql_version,
        mysqlEdition=None,
        mysqlBasedir=mysql_basedir,
        datadir=datadir,
        spaceAvailable=space_available,
        spaceUsed=space_used,
        spaceTotal=space_total,
        spaceUsedPercent=space_used_percent,
        spaceOtherUsedPercent=space_other_used_percent,
        profileTemplate=_profile_template(
            backup_home_path,
            command,
            backup_user,
            datadir,
            mysql_basedir,
            mysql_version,
        ),
        profiles=profiles,
        statusItems=[
            MebStatusItem(
                label="mysqlbackup",
                value=f"{command or 'Not configured'} ({_path_state(command)})",
                tone="ok" if command and os.path.exists(command) and os.access(command, os.X_OK) else "warn",
            ),
            MebStatusItem(
                label="Backup home",
                value=backup_home_path,
                tone="ok",
            ),
            MebStatusItem(
                label="Backup account",
                value=backup_user or "Not configured",
                tone="ok" if backup_user else "warn",
            ),
            MebStatusItem(
                label="Data directory",
                value=datadir or "Not configured",
                tone="ok" if datadir and os.path.isdir(datadir) else "info",
            ),
        ],
        recentActivity=recent_activity,
    )


def _validation(tone: str, message: str) -> MebValidationStatus:
    return MebValidationStatus(tone=tone, message=message)


def _path_in_directory(directory: str, path: str) -> bool:
    directory = _canonical_path(directory)
    path = _canonical_path(path)

    try:
        return os.path.commonpath([directory, path]) == directory
    except ValueError:
        return False


def _profile_config_path(
    backup_home_path: str,
    profile: MebBackupProfile,
    path_exists: Callable[[str], bool] = os.path.exists,
) -> str:
    config_path = _clean(profile.configPath)

    if config_path:
        config_path = _canonical_path(config_path)
        if not _path_in_directory(backup_home_path, config_path):
            raise ValueError("Profile configuration must be inside the backup home directory")

        if os.path.basename(config_path) in IGNORED_PROFILE_CONFIGS:
            raise ValueError("%s cannot be used as a backup profile" % os.path.basename(config_path))

        return config_path

    for _ in range(1000):
        candidate = _canonical_path(os.path.join(backup_home_path, f"{uuid.uuid4()}.cnf"))
        if not _path_in_directory(backup_home_path, candidate):
            raise ValueError("Profile configuration must be inside the backup home directory")

        if not path_exists(candidate):
            return candidate

    raise ValueError("Unable to allocate a unique profile file name")


def _set_if_value(config: configparser.RawConfigParser, section: str, option: str, value: Any) -> None:
    value = _clean(value)
    if value is not None:
        config.set(section, option, value)


def _set_cloud_options(
    config: configparser.RawConfigParser,
    profile: MebBackupProfile,
    existing: configparser.RawConfigParser | None,
) -> None:
    storage_type = _storage_type(profile.storageType, strict=True)
    config.set("meb_manager", "storage_type", storage_type)
    if storage_type != "cloud":
        return

    cloud_service = _cloud_service(profile.cloudService, strict=True)
    if cloud_service is None:
        raise ValueError("Cloud storage service is required.")

    for field, option in CLOUD_OPTION_FIELDS.items():
        value = _cloud_option_value(profile, existing, field)
        if value is not None:
            config.set("mysqlbackup", option, value)

    for field, option in CLOUD_BOOL_OPTION_FIELDS.items():
        config.set("mysqlbackup", option, _bool_string(getattr(profile, field, False)))


def _bool_string(value: Any) -> str:
    return "True" if bool(value) else "False"


def _cloud_option_value(
    profile: MebBackupProfile,
    existing: configparser.RawConfigParser | None,
    field: str,
) -> str | None:
    value = _clean(getattr(profile, field, None))
    if value is None and field in SECRET_CLOUD_OPTION_FIELDS and existing is not None:
        value = _get(existing, "mysqlbackup", CLOUD_OPTION_FIELDS[field])

    return value


def _validate_backup_destination(backup_home_path: str, backup_dir: str) -> None:
    if not _path_in_directory(backup_home_path, backup_dir):
        raise ValueError("Backup destination must be inside the backup home directory")


def _validate_cloud_options(
    profile: MebBackupProfile,
    existing: configparser.RawConfigParser | None,
) -> None:
    storage_type = _storage_type(profile.storageType, strict=True)
    if storage_type != "cloud":
        return

    cloud_service = _cloud_service(profile.cloudService, strict=True)
    if cloud_service is None:
        raise ValueError("Cloud storage service is required.")

    for caption, fields in CLOUD_REQUIRED_FIELDS[cloud_service]:
        if not any(_cloud_option_value(profile, existing, field) for field in fields):
            label = CLOUD_SERVICE_LABELS[cloud_service]
            raise ValueError(f"{label} cloud storage requires {caption}.")


def _validate_schedule_int(value: Any, minimum: int, maximum: int, label: str) -> None:
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{label} must be between {minimum} and {maximum}.") from None

    if value < minimum or value > maximum:
        raise ValueError(f"{label} must be between {minimum} and {maximum}.")


def _schedule_month_days(value: Any, label: str) -> frozenset[int]:
    from_api = isinstance(value, list)
    parts = value if from_api else str(value).split(",")
    days: set[int] = set()
    if not parts:
        raise ValueError(f"{label} must be a comma-separated list of days between 1 and 31.")

    for part in parts:
        if (
            isinstance(part, bool)
            or (from_api and not isinstance(part, int))
            or (not from_api and (not isinstance(part, str) or not part.isdigit()))
        ):
            raise ValueError(f"{label} must be a comma-separated list of days between 1 and 31.")
        day = int(part)
        if day < 1 or day > 31:
            raise ValueError(f"{label} must be a comma-separated list of days between 1 and 31.")
        days.add(day)

    if len(days) != len(parts):
        raise ValueError(f"{label} must contain unique days between 1 and 31.")

    return frozenset(days)


def _validate_schedule(schedule: MebProfileSchedule, description: str) -> None:
    if not schedule.enabled:
        return

    frequency = schedule.frequency
    if not isinstance(frequency, int) or isinstance(frequency, bool) or frequency not in {0, 1, 2, 3}:
        raise ValueError(f"{description} frequency is not supported.")

    maximum_interval = SCHEDULE_INTERVAL_MAXIMUMS[frequency]
    _validate_schedule_int(schedule.interval, 1, maximum_interval, f"{description} interval")
    if frequency == 3:
        _schedule_month_days(schedule.monthDays, f"{description} days of month")

    if frequency == 2:
        week_days = schedule.weekDays if isinstance(schedule.weekDays, list) else []
        if not any(week_days[:7]):
            raise ValueError(f"Weekly {description.lower()} has no days selected.")

    if frequency != 0:
        _validate_schedule_int(schedule.hour, 0, 23, f"{description} hour")
    _validate_schedule_int(schedule.minute, 0, 59, f"{description} minute")


def _validate_profile_schedules(profile: MebBackupProfile) -> None:
    _validate_schedule(profile.fullSchedule, "Full backup schedule")
    _validate_schedule(profile.incSchedule, "Incremental backup schedule")


def _schedule_value(schedule: MebProfileSchedule, key: str, fallback: str) -> str:
    value = getattr(schedule, key, None)
    return str(value if value is not None else fallback)


def _week_days_text(schedule: MebProfileSchedule) -> str:
    week_days = schedule.weekDays
    if not isinstance(week_days, list):
        return ""

    return ",".join(str(index) for index, enabled in enumerate(week_days[:7]) if enabled)


def _write_schedule(config: configparser.RawConfigParser, prefix: str, schedule: MebProfileSchedule) -> None:
    config.set("meb_manager", f"{prefix}_backups_enabled", _bool_string(schedule.enabled))
    config.set("meb_manager", f"{prefix}_backups_interval", _schedule_value(schedule, "interval", "1"))
    config.set("meb_manager", f"{prefix}_backups_frequency", _schedule_value(schedule, "frequency", "0"))
    config.set("meb_manager", f"{prefix}_backups_month_day", ",".join(str(day) for day in schedule.monthDays))
    config.set("meb_manager", f"{prefix}_backups_week_days", _week_days_text(schedule))
    config.set("meb_manager", f"{prefix}_backups_hour", _schedule_value(schedule, "hour", "0"))
    config.set("meb_manager", f"{prefix}_backups_minute", _schedule_value(schedule, "minute", "0"))


def _schedule_int(value: Any, minimum: int, maximum: int, default: int) -> int:
    try:
        result = int(str(value))
    except (TypeError, ValueError):
        result = default

    return min(max(result, minimum), maximum)


def _schedule_range(minimum: int, maximum: int) -> frozenset[int]:
    return frozenset(range(minimum, maximum + 1))


def _schedule_window(schedule: MebProfileSchedule) -> tuple[frozenset[int], ...] | None:
    if not schedule.enabled:
        return None

    frequency = schedule.frequency
    minute = frozenset({_schedule_int(schedule.minute, 0, 59, 0)})
    hour = frozenset({_schedule_int(schedule.hour, 0, 23, 0)})
    day_of_month = _schedule_range(1, 31)
    month = _schedule_range(1, 12)
    day_of_week = _schedule_range(0, 6)
    if frequency == 0:
        hour = _schedule_range(0, 23)
    elif frequency == 1:
        pass
    elif frequency == 2:
        week_days = schedule.weekDays if isinstance(schedule.weekDays, list) else []
        selected_days = {index for index, enabled in enumerate(week_days[:7]) if enabled}
        if selected_days:
            day_of_week = frozenset(selected_days)
    elif frequency == 3:
        day_of_month = _schedule_month_days(schedule.monthDays, "Schedule days of month")

    return minute, hour, day_of_month, month, day_of_week


def _schedule_windows_overlap(first: tuple[frozenset[int], ...], second: tuple[frozenset[int], ...]) -> bool:
    return all(bool(first[index] & second[index]) for index in range(len(first)))


def _scheduled_profile_entries(
    profile: MebBackupProfileInfo | MebBackupProfile,
    label: str,
) -> list[tuple[tuple[Any, ...], str]]:
    entries: list[tuple[tuple[Any, ...], str]] = []
    full_schedule = _schedule_window(profile.fullSchedule)
    if full_schedule is not None:
        entries.append((full_schedule, f"{label} full"))
    inc_schedule = _schedule_window(profile.incSchedule)
    if inc_schedule is not None:
        entries.append((inc_schedule, f"{label} incremental"))

    return entries


def _validate_no_schedule_conflicts(
    profiles: list[MebBackupProfileInfo],
    profile: MebBackupProfile,
    config_path: str,
    existing_uuid: str | None,
) -> None:
    seen: list[tuple[tuple[Any, ...], str]] = []
    for existing in profiles:
        same_profile = False
        if existing_uuid and existing.uuid == existing_uuid:
            same_profile = True
        elif existing.configPath and _same_path(existing.configPath, config_path):
            same_profile = True
        if same_profile:
            continue

        seen.extend(_scheduled_profile_entries(existing, existing.label))

    for key, description in _scheduled_profile_entries(profile, _clean(profile.label) or "Current profile"):
        for existing_key, existing_description in seen:
            if _schedule_windows_overlap(key, existing_key):
                raise ValueError(f"Schedule for {description} overlaps with {existing_description}.")
        seen.append((key, description))


def _write_profile_config(path: str, config: configparser.RawConfigParser) -> None:
    stream = io.StringIO()
    config.write(stream)
    write_text_private(path, stream.getvalue(), "Profile configuration")


def get_status(backup_home_path: str | None = None) -> MebStatus:
    """Returns local MySQL Enterprise Backup configuration and profile status.

    Args:
        backup_home_path (str): The local MySQL Enterprise Backup home directory path.

    Returns:
        MebStatus: Local MySQL Enterprise Backup status information.
    """

    if not backup_home_path:
        return _empty_status()

    backup_home_path = _clean(backup_home_path)
    if not backup_home_path:
        return _empty_status()

    if not os.path.isdir(backup_home_path):
        return _empty_status(
            backup_home_path=backup_home_path,
            message="Backup home directory was not found",
        )

    if not os.path.isfile(_manager_config_path(backup_home_path)):
        return _empty_status(
            backup_home_path=backup_home_path,
            message="Backup home directory does not contain backups.cnf",
        )

    manager_values = _manager_values(backup_home_path)
    profiles = _read_profiles(backup_home_path)

    return build_status(backup_home_path, manager_values, profiles)


def save_profile(
    backup_home_path: str,
    profile: MebBackupProfile,
    write_profile_config: Callable[[str, configparser.RawConfigParser], None] | None = None,
    read_profile_config: Callable[[str], str] | None = None,
    path_exists: Callable[[str], bool] = os.path.exists,
    create_directory_recursive: Callable[[str], None] | None = None,
    validate_directory: bool = True,
    mysqlbackup_command: str | None = None,
) -> MebStatus:
    """Creates or updates a MySQL Enterprise Backup profile in the backup home directory.

    Args:
        backup_home_path (str): The local MySQL Enterprise Backup home directory path.
        profile (MebBackupProfile): Profile fields collected by the frontend.

    Returns:
        MebStatus: Refreshed local MySQL Enterprise Backup status information.
    """

    backup_home_path = _clean(backup_home_path)
    if not backup_home_path:
        raise ValueError("Backup home directory is required")

    backup_home_path = _canonical_path(backup_home_path)
    if validate_directory and os.path.exists(backup_home_path) and not os.path.isdir(backup_home_path):
        raise ValueError("Backup home path is not a directory")

    if validate_directory:
        os.makedirs(backup_home_path, exist_ok=True)

    label = _clean(profile.label)
    backup_dir = _clean(profile.destination)
    if not label:
        raise ValueError("Profile name is required")

    if not backup_dir:
        raise ValueError("Backup destination is required")
    _validate_backup_destination(backup_home_path, backup_dir)
    incremental_backup_dir = os.path.join(backup_dir, "inc")
    if create_directory_recursive:
        create_directory_recursive(backup_dir)
        create_directory_recursive(incremental_backup_dir)
    else:
        os.makedirs(backup_dir, mode=0o700, exist_ok=True)
        os.makedirs(incremental_backup_dir, mode=0o700, exist_ok=True)
    if validate_directory and not os.path.isdir(backup_dir):
        raise ValueError("Backup destination path is not a directory")
    if validate_directory and not os.path.isdir(incremental_backup_dir):
        raise ValueError("Incremental backup destination path is not a directory")

    config_path = _profile_config_path(backup_home_path, profile, path_exists)
    existing_uuid = None
    existing_config = None
    if path_exists(config_path):
        try:
            existing_config = (
                _read_config_text(read_profile_config(config_path))
                if read_profile_config else _read_config(config_path)
            )
            existing_uuid = _get(existing_config, "meb_manager", "uuid")
        except (OSError, configparser.Error):
            existing_config = None
            existing_uuid = None

    _validate_cloud_options(profile, existing_config)
    _validate_profile_schedules(profile)
    _validate_no_schedule_conflicts(_read_profiles(backup_home_path), profile, config_path, existing_uuid)

    config = configparser.RawConfigParser()
    config.optionxform = str.lower
    for section in ("meb_manager", "client", "mysqlbackup"):
        config.add_section(section)

    try:
        profile_uuid = existing_uuid or str(uuid.UUID(Path(config_path).stem))
    except ValueError:
        profile_uuid = str(uuid.uuid4())
    config.set("meb_manager", "uuid", profile_uuid)
    config.set("meb_manager", "label", label)
    config.set("meb_manager", "host", "localhost")
    config.set("meb_manager", "compress", _bool_string(profile.compress))
    config.set("meb_manager", "compress_method", _clean(profile.compressMethod) or "lz4")
    config.set("meb_manager", "compress_level", _clean(profile.compressLevel) or "1")
    _set_cloud_options(config, profile, existing_config)
    config.set("meb_manager", "apply_log", _bool_string(profile.applyLog))
    config.set("meb_manager", "skip_unused_pages", _bool_string(profile.skipUnusedPages))
    config.set("meb_manager", "incremental_with_redo_log_only",
               _bool_string(profile.incrementalWithRedoLogOnly))
    config.set("meb_manager", "partial", _bool_string(profile.partial))
    _write_schedule(config, "full", profile.fullSchedule)
    _write_schedule(config, "inc", profile.incSchedule)
    config.set("meb_manager", "using_tts", _tts_mode(profile.usingTts, strict=True))
    _set_if_value(
        config,
        "meb_manager",
        "command",
        _clean(mysqlbackup_command) or (
            _get(existing_config, "meb_manager", "command") if existing_config else None
        ),
    )
    _set_if_value(config, "meb_manager", "basedir", profile.mysqlBasedir)
    config.set("meb_manager", "version", "1")

    _set_if_value(config, "client", "user", profile.user)

    config.set("mysqlbackup", "backup_dir", backup_dir)
    config.set("mysqlbackup", "incremental_backup_dir", incremental_backup_dir)
    config.set("mysqlbackup", "incremental_base", _incremental_base(profile.incrementalBase, strict=True))
    _set_if_value(config, "mysqlbackup", "comments", profile.comments)
    if profile.partial:
        _set_if_value(config, "mysqlbackup", "include_tables", profile.includeTables)
        _set_if_value(config, "mysqlbackup", "exclude_tables", profile.excludeTables)
    _set_if_value(config, "mysqlbackup", "datadir", profile.datadir)

    if write_profile_config:
        write_profile_config(config_path, config)
    else:
        _write_profile_config(config_path, config)

    return get_status(backup_home_path)


def delete_profile(
    backup_home_path: str,
    profile_uuid: str,
    delete_profile_config: Callable[[str], None] | None = None,
) -> MebStatus:
    """Deletes a MySQL Enterprise Backup profile from the backup home directory."""

    backup_home_path = _clean(backup_home_path)
    if not backup_home_path:
        raise ValueError("Backup home directory is required")

    profile_uuid = _clean(profile_uuid)
    if not profile_uuid:
        raise ValueError("Backup profile UUID is required")

    backup_home_path = _canonical_path(backup_home_path)
    profiles = [profile for profile in _read_profiles(backup_home_path) if profile.uuid == profile_uuid]
    if not profiles:
        raise ValueError("Backup profile was not found")
    if len(profiles) > 1:
        raise ValueError("Backup profile UUID is not unique")

    config_path = _clean(profiles[0].configPath)
    if not config_path:
        raise ValueError("Backup profile configuration path is missing")
    if not _path_in_directory(backup_home_path, config_path):
        raise ValueError("Backup profile configuration must be inside the backup home directory")
    if os.path.basename(config_path) in IGNORED_PROFILE_CONFIGS:
        raise ValueError("%s cannot be deleted as a backup profile" % os.path.basename(config_path))
    if _profile_has_backup_data(backup_home_path, profiles[0]):
        raise ValueError("Backup profile has existing backups. Delete the backup data before deleting the job.")

    if delete_profile_config:
        delete_profile_config(config_path)
    else:
        os.unlink(config_path)

    return get_status(backup_home_path)


def read_log(backup_home_path: str, activity_id: str) -> MebLogContent:
    """Reads a mysqlbackup log file discovered below a configured backup home.

    Args:
        backup_home_path (str): The local MySQL Enterprise Backup home directory path.
        activity_id (str): Opaque identifier returned in recent activity.

    Returns:
        MebLogContent: Activity identifier and log content.
    """

    backup_home_path = _clean(backup_home_path)

    if not backup_home_path or not activity_id:
        raise ValueError("Backup home and activity ID are required")

    backup_home_path = _canonical_path(backup_home_path)
    profiles = _read_profiles(backup_home_path)
    resolved_log_path = activity_log_path(backup_home_path, activity_id, profiles)

    return MebLogContent(
        activityId=activity_id,
        displayName=os.path.basename(resolved_log_path),
        content=_read_text_tail(resolved_log_path, LOG_READ_MAX_BYTES, include_truncation_marker=True),
    )
