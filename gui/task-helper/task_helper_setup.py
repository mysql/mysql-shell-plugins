#!/usr/bin/env python3
# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.

from __future__ import annotations

import configparser
import hashlib
import io
import json
import os
import shutil
import stat
import sys
import tempfile
from pathlib import Path
from typing import Any

if os.name == "posix":
    import pwd


HELPER_VERSION = "1"
CONFIG_NAME = "backups.cnf"
RUNTIME_HELPER_NAME = "task-helper"
BACKUP_HOME_MODE = 0o700
CONFIG_MODE = 0o600
DEFAULT_TIMEOUT_MS = 900000
DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024
MAX_REQUEST_BYTES = 1024 * 1024
CAPABILITIES = ["backupHome.setup"]
WINDOWS_LOGON_TYPES = frozenset({"InteractiveToken", "S4U"})

SAFE_CONFIG_KEYS = {
    "datadir": "dataDir",
    "basedir": "baseDir",
    "mysqlbackup": "mysqlbackup",
    "backup_os_user": "backupOsUser",
    "backup_os_uid": "backupOsUid",
    "backup_os_gid": "backupOsGid",
    "backup_mysql_user": "backupMysqlUser",
    "login_file": "loginFile",
    "login_path": "loginPath",
    "mysql_version": "mysqlVersion",
    "crontab": "crontab",
    "job_runner": "jobRunner",
    "backup_root": "backupRoot",
    "option_file_root": "optionFileRoot",
    "working_directory": "workingDirectory",
    "timeout_ms": "timeoutMs",
    "max_output_bytes": "maxOutputBytes",
    "launchctl": "launchctl",
    "schtasks": "schtasks",
    "scheduler_backend": "schedulerBackend",
    "launchd_plist_dir": "launchdPlistDir",
    "windows_task_folder": "windowsTaskFolder",
    "windows_logon_type": "windowsLogonType",
}


class HelperError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def require_dict(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise HelperError("invalid_request", f"{label} must be an object.")

    return value


def reject_unknown_fields(value: dict[str, Any], allowed_fields: set[str], label: str) -> None:
    for field in value:
        if field not in allowed_fields:
            raise HelperError("invalid_request", f"{label} contains unsupported field '{field}'.")


def require_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or len(value) == 0:
        raise HelperError("invalid_request", f"{label} must be a non-empty string.")
    if "\0" in value:
        raise HelperError("invalid_request", f"{label} must not contain NUL bytes.")

    return value


def require_int(value: Any, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise HelperError("invalid_request", f"{label} must be an integer.")

    return value


def _absolute_path(value: Any, label: str, fallback: str | None = None) -> str:
    if value is None:
        if fallback is None:
            raise HelperError("invalid_request", f"{label} is required.")
        value = fallback

    path = Path(require_string(value, label))
    if not path.is_absolute():
        raise HelperError("invalid_request", f"{label} must be an absolute path.")

    return path.as_posix()


def _current_user() -> dict[str, Any]:
    if os.name != "posix":
        return {
            "uid": None,
            "gid": None,
            "name": os.environ.get("USERNAME") or os.environ.get("USER"),
        }

    uid = os.geteuid()
    try:
        name = pwd.getpwuid(uid).pw_name
    except KeyError:
        name = None

    return {"uid": uid, "gid": os.getegid(), "name": name}


def _user_name(user: dict[str, Any]) -> str:
    if isinstance(user.get("name"), str) and user["name"]:
        return user["name"]
    if user.get("uid") is not None:
        return str(user["uid"])

    return "unknown"


def _check(check_id: str, status: str, expected: str, observed: str, message: str) -> dict[str, str]:
    return {
        "id": check_id,
        "status": status,
        "expected": expected,
        "observed": observed,
        "message": message,
    }


def _action(action_id: str, status: str, before: str, after: str, message: str) -> dict[str, str]:
    return {
        "id": action_id,
        "status": status,
        "before": before,
        "after": after,
        "message": message,
    }


def _summary(checks: list[dict[str, str]]) -> dict[str, int]:
    return {
        "passed": sum(1 for check in checks if check["status"] == "pass"),
        "failed": sum(1 for check in checks if check["status"] == "fail"),
        "indeterminate": sum(1 for check in checks if check["status"] == "indeterminate"),
    }


def _validation_status(checks: list[dict[str, str]]) -> str:
    counts = _summary(checks)
    if counts["failed"]:
        return "invalid"
    if counts["indeterminate"]:
        return "indeterminate"

    return "valid"


def _file_type(file_stat: os.stat_result) -> str:
    if stat.S_ISLNK(file_stat.st_mode):
        return "symlink"
    if stat.S_ISDIR(file_stat.st_mode):
        return "directory"
    if stat.S_ISREG(file_stat.st_mode):
        return "regular file"

    return "special file"


def _mode(file_stat: os.stat_result) -> str:
    return f"{stat.S_IMODE(file_stat.st_mode):04o}"


def _path_check(check_id: str, path: Path, kind: str) -> tuple[dict[str, str], os.stat_result | None]:
    expected = f"absolute {kind} path with no line breaks and no symlink"
    if not path.is_absolute():
        return _check(check_id, "fail", expected, "relative path", "Path must be absolute."), None
    if "\n" in path.as_posix() or "\r" in path.as_posix():
        return _check(check_id, "fail", expected, "contains line break", "Path must not contain line breaks."), None

    try:
        file_stat = path.lstat()
    except FileNotFoundError:
        return _check(check_id, "fail", expected, "missing", "Path does not exist."), None
    except OSError as error:
        return _check(check_id, "fail", expected, error.__class__.__name__, "Path is not usable."), None

    observed = _file_type(file_stat)
    if observed == "symlink":
        return _check(check_id, "fail", expected, observed, "Path must not be a symlink."), None
    if observed != kind:
        return _check(check_id, "fail", expected, observed, f"Path must be a {kind}."), None

    return _check(check_id, "pass", expected, observed, f"Path is a usable {kind}."), file_stat


def _access_check(check_id: str, path: Path, file_stat: os.stat_result | None, mask: int, label: str) -> dict[str, str]:
    if file_stat is None:
        return _check(check_id, "indeterminate", label, "path check failed", "Access was not checked.")

    try:
        ok = os.access(path, mask, effective_ids=True)
    except (NotImplementedError, TypeError):
        ok = os.access(path, mask)

    if ok:
        return _check(check_id, "pass", label, "available", "Access is available.")

    return _check(check_id, "fail", label, "not available", "Access is not available.")


def _config_parent_check(config_path: Path, user: dict[str, Any]) -> dict[str, str]:
    expected = "parent directories owned by root or effective helper user and not group/world writable"
    if os.name != "posix":
        return _check("config.parents", "indeterminate", expected, "unsupported platform", "POSIX parent validation is not available on this platform.")

    for parent in config_path.parents:
        try:
            parent_stat = parent.lstat()
        except OSError as error:
            return _check("config.parents", "fail", expected, error.__class__.__name__, "Config parent path could not be inspected.")
        if not stat.S_ISDIR(parent_stat.st_mode):
            return _check("config.parents", "fail", expected, _file_type(parent_stat), "Config parent path must be a directory.")
        if parent_stat.st_uid not in {0, user["uid"]}:
            return _check("config.parents", "fail", expected, f"uid={parent_stat.st_uid}", "Config parent path has the wrong owner.")
        if parent_stat.st_mode & 0o022:
            return _check("config.parents", "fail", expected, _mode(parent_stat), "Config parent path must not be group or world writable.")

    return _check("config.parents", "pass", expected, "safe", "Config parent paths are safe.")


def _chown_action(action_id: str, path: Path, file_stat: os.stat_result, user: dict[str, Any]) -> dict[str, str]:
    if os.name != "posix":
        return _action(action_id, "skipped", "unsupported platform", "unchanged", "Ownership repair is not available on this platform.")

    before = f"uid={file_stat.st_uid} gid={file_stat.st_gid}"
    after = f"uid={user['uid']}"
    if file_stat.st_uid == user["uid"]:
        return _action(action_id, "unchanged", before, after, "Owner is already correct.")

    try:
        os.chown(path, user["uid"], -1, follow_symlinks=False)
        repaired_stat = path.lstat()
    except OSError as error:
        return _action(action_id, "failed", before, after, f"Could not change owner: {error.__class__.__name__}.")

    return _action(action_id, "changed", before, f"uid={repaired_stat.st_uid} gid={repaired_stat.st_gid}", "Owner was updated.")


def _chmod_action(action_id: str, path: Path, file_stat: os.stat_result, mode: int) -> dict[str, str]:
    if os.name != "posix":
        return _action(action_id, "skipped", "unsupported platform", "unchanged", "POSIX mode repair is not available on this platform.")

    before = _mode(file_stat)
    after = f"{mode:04o}"
    if before == after:
        return _action(action_id, "unchanged", before, after, "Permissions are already correct.")

    try:
        os.chmod(path, mode, follow_symlinks=False)
        repaired_stat = path.lstat()
    except (NotImplementedError, OSError) as error:
        return _action(action_id, "failed", before, after, f"Could not change permissions: {error.__class__.__name__}.")

    return _action(action_id, "changed", before, _mode(repaired_stat), "Permissions were updated.")


def _validate_executable(path: str, label: str) -> str:
    candidate = Path(path)
    if not candidate.is_absolute():
        raise HelperError("invalid_request", f"{label} must be an absolute path.")

    try:
        file_stat = candidate.lstat()
    except OSError:
        raise HelperError("invalid_request", f"{label} must exist.")

    if not stat.S_ISREG(file_stat.st_mode):
        raise HelperError("invalid_request", f"{label} must be a regular file, not a symlink or directory.")

    if os.name != "posix":
        return candidate.as_posix()

    effective_uid = os.geteuid()
    if file_stat.st_uid not in {0, effective_uid}:
        raise HelperError("invalid_request", f"{label} must be owned by root or the effective helper user.")
    if file_stat.st_mode & 0o111 == 0:
        raise HelperError("invalid_request", f"{label} must be executable.")
    if file_stat.st_mode & 0o022:
        raise HelperError("invalid_request", f"{label} must not be group or world writable.")

    for parent in candidate.parents:
        parent_stat = parent.lstat()
        if not stat.S_ISDIR(parent_stat.st_mode):
            raise HelperError("invalid_request", f"{label} parent paths must be directories.")
        if parent_stat.st_uid not in {0, effective_uid}:
            raise HelperError("invalid_request", f"{label} parent paths must be owned by root or the effective helper user.")
        if parent_stat.st_mode & 0o022:
            raise HelperError("invalid_request", f"{label} parent paths must not be group or world writable.")

    return candidate.as_posix()


def _setup_executable(value: Any, label: str, command_name: str) -> str:
    if value is None:
        value = shutil.which(command_name)
        if value is None:
            raise HelperError("invalid_request", f"{label} was not found in PATH.")

    return _validate_executable(require_string(value, label), label)


def _atomic_write(path: Path, payload: bytes, mode: int) -> None:
    fd = None
    temp_name = None
    try:
        fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
        if os.name == "posix":
            os.chmod(temp_name, mode)
        with os.fdopen(fd, "wb") as file:
            fd = None
            file.write(payload)
            file.flush()
            os.fsync(file.fileno())

        os.replace(temp_name, path)
        temp_name = None
        if os.name == "posix":
            try:
                os.chmod(path, mode, follow_symlinks=False)
            except NotImplementedError:
                os.chmod(path, mode)
            directory_fd = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
    finally:
        if fd is not None:
            os.close(fd)
        if temp_name is not None:
            try:
                os.unlink(temp_name)
            except FileNotFoundError:
                pass


def _runtime_source_path() -> Path:
    root = Path(__file__).resolve().parent
    candidates = [root / RUNTIME_HELPER_NAME, root / f"{RUNTIME_HELPER_NAME}.py"]
    for candidate in candidates:
        try:
            candidate.lstat()
        except OSError:
            continue

        return candidate

    raise HelperError("invalid_request", "runtime helper source is missing.")


def _windows_script_command(script_name: str) -> str:
    executable = Path(sys.executable).resolve(strict=True)
    if executable.name.lower().startswith("mysqlsh"):
        return f"\"{executable}\" --py -f \"%~dp0{script_name}\" %*"

    return f"\"{executable}\" \"%~dp0{script_name}\" %*"


def _install_runtime_helper(backup_home: Path) -> Path:
    source = _runtime_source_path()
    _validate_executable(source.as_posix(), "runtime helper")

    if os.name == "nt":
        script_path = backup_home / f"{RUNTIME_HELPER_NAME}.py"
        entrypoint = backup_home / f"{RUNTIME_HELPER_NAME}.cmd"
        if source != script_path.resolve(strict=False):
            _atomic_write(script_path, source.read_bytes(), 0o700)
        _atomic_write(
            entrypoint,
            (
                "@echo off\r\n"
                "setlocal\r\n"
                f"{_windows_script_command(script_path.name)}\r\n"
                "exit /b %ERRORLEVEL%\r\n"
            ).encode("utf-8"),
            0o700,
        )

        return entrypoint

    entrypoint = backup_home / RUNTIME_HELPER_NAME
    if source != entrypoint.resolve(strict=False):
        _atomic_write(entrypoint, source.read_bytes(), 0o700)

    return entrypoint


def _login_path(data_dir: str) -> str:
    return f"mysql_workbench_meb_{hashlib.sha256(data_dir.encode('utf-8')).hexdigest()[:12]}"


def _optional_config_string(request: dict[str, Any], request_key: str, config_key: str) -> tuple[str, str] | None:
    value = request.get(request_key)
    if value is None:
        return None

    text = require_string(value, request_key).strip()
    if not text:
        return None
    if "\n" in text or "\r" in text:
        raise HelperError("invalid_request", f"{request_key} must not contain line breaks.")

    return config_key, text


def _optional_config_path(request: dict[str, Any], request_key: str, config_key: str) -> tuple[str, str] | None:
    value = _optional_config_string(request, request_key, config_key)
    if value is None:
        return None

    key, path = value
    if not Path(path).is_absolute():
        raise HelperError("invalid_request", f"{request_key} must be an absolute path.")

    return key, path


def _config_values(request: dict[str, Any], backup_home: Path, data_dir: Path, helper_path: Path, user: dict[str, Any]) -> dict[str, str]:
    scheduler_backend = require_string(request.get("schedulerBackend", "platform"), "schedulerBackend")
    if scheduler_backend not in {"platform", "cron", "launchd", "schtasks"}:
        raise HelperError("invalid_request", "schedulerBackend is not supported.")
    windows_logon_type = require_string(
        request.get("windowsLogonType", "S4U"),
        "windowsLogonType",
    )
    if windows_logon_type not in WINDOWS_LOGON_TYPES:
        raise HelperError(
            "invalid_request",
            f"Windows logon type {windows_logon_type} is not supported.",
        )

    timeout_ms = require_int(request.get("timeoutMs", DEFAULT_TIMEOUT_MS), "timeoutMs")
    max_output_bytes = require_int(request.get("maxOutputBytes", DEFAULT_MAX_OUTPUT_BYTES), "maxOutputBytes")
    if timeout_ms < 1 or max_output_bytes < 1:
        raise HelperError("invalid_request", "timeoutMs and maxOutputBytes must be positive.")

    backup_home_path = backup_home.resolve(strict=True).as_posix()
    data_dir_path = data_dir.resolve(strict=True).as_posix()
    if os.name == "nt":
        crontab = _absolute_path(request.get("crontab"), "crontab", r"C:\Windows\System32\schtasks.exe")
        schtasks = _absolute_path(request.get("schtasks"), "schtasks", r"C:\Windows\System32\schtasks.exe")
        launchctl = _absolute_path(request.get("launchctl"), "launchctl", r"C:\Windows\System32\schtasks.exe")
    else:
        crontab = _setup_executable(request.get("crontab"), "crontab", "crontab")
        schtasks = _absolute_path(request.get("schtasks"), "schtasks", "/usr/bin/false")
        launchctl = _absolute_path(request.get("launchctl"), "launchctl", "/bin/launchctl")

    values = {
        "datadir": data_dir_path,
        "mysqlbackup": _setup_executable(request.get("mysqlbackup"), "mysqlbackup", "mysqlbackup"),
        "backup_os_user": _user_name(user),
        "login_file": (backup_home / ".mylogin.cnf").as_posix(),
        "login_path": _login_path(data_dir_path),
        "crontab": crontab,
        "job_runner": helper_path.resolve(strict=False).as_posix(),
        "backup_root": backup_home_path,
        "option_file_root": backup_home_path,
        "working_directory": backup_home_path,
        "timeout_ms": str(timeout_ms),
        "max_output_bytes": str(max_output_bytes),
        "launchctl": launchctl,
        "schtasks": schtasks,
        "scheduler_backend": scheduler_backend,
        "launchd_plist_dir": (backup_home / "launchd").resolve(strict=False).as_posix(),
        "windows_task_folder": require_string(request.get("windowsTaskFolder", r"\MySQLWorkbench"), "windowsTaskFolder"),
        "windows_logon_type": windows_logon_type,
    }
    if user.get("uid") is not None and user.get("gid") is not None:
        values["backup_os_uid"] = str(user["uid"])
        values["backup_os_gid"] = str(user["gid"])

    extra_values = dict(
        value for value in (
            _optional_config_path(request, "baseDir", "basedir"),
            _optional_config_string(request, "backupMysqlUser", "backup_mysql_user"),
            _optional_config_string(request, "mysqlVersion", "mysql_version"),
        )
        if value is not None
    )
    values.update(extra_values)

    return values


def _write_config_file(config_path: Path, values: dict[str, str]) -> None:
    parser = configparser.RawConfigParser()
    parser.add_section("meb")
    for key, value in values.items():
        parser.set("meb", key, value)

    stream = io.StringIO()
    stream.write("# MySQL Enterprise Backup local support configuration\n")
    parser.write(stream)
    _atomic_write(config_path, stream.getvalue().encode("utf-8"), CONFIG_MODE)


def _safe_config(values: dict[str, str]) -> dict[str, str]:
    return {SAFE_CONFIG_KEYS[key]: value for key, value in values.items() if key in SAFE_CONFIG_KEYS}


def handle_backup_home_setup(params: Any, dry_run: bool = False) -> dict[str, Any]:
    request = require_dict(params, "backupHome.setup params")
    reject_unknown_fields(request, {
        "backupHome",
        "dataDir",
        "baseDir",
        "mysqlbackup",
        "backupMysqlUser",
        "mysqlVersion",
        "crontab",
        "launchctl",
        "schtasks",
        "schedulerBackend",
        "timeoutMs",
        "maxOutputBytes",
        "windowsTaskFolder",
        "windowsLogonType",
    }, "backupHome.setup params")

    backup_home = Path(require_string(request.get("backupHome"), "backupHome"))
    data_dir = Path(require_string(request.get("dataDir"), "dataDir"))
    config_path = backup_home / CONFIG_NAME
    helper_path = backup_home / (f"{RUNTIME_HELPER_NAME}.cmd" if os.name == "nt" else RUNTIME_HELPER_NAME)
    user = _current_user()
    checks: list[dict[str, str]] = []
    actions: list[dict[str, str]] = []

    backup_home_check, backup_home_stat = _path_check("backupHome.path", backup_home, "directory")
    checks.append(backup_home_check)
    data_dir_check, data_dir_stat = _path_check("dataDir.path", data_dir, "directory")
    checks.append(data_dir_check)
    checks.append(_access_check("dataDir.access", data_dir, data_dir_stat, os.R_OK | os.X_OK, "read/search"))
    if backup_home_stat is None or data_dir_stat is None or _validation_status(checks) != "valid":
        return {
            "status": "invalid",
            "backupHome": backup_home.as_posix(),
            "helperPath": helper_path.as_posix(),
            "configPath": config_path.as_posix(),
            "dataDir": data_dir.as_posix(),
            "effectiveUser": user,
            "checks": checks,
            "summary": _summary(checks),
        }

    if os.name == "posix":
        actions.append(_chown_action("backupHome.owner", backup_home, backup_home_stat, user))
        backup_home_stat = backup_home.lstat()
        actions.append(_chmod_action("backupHome.permissions", backup_home, backup_home_stat, BACKUP_HOME_MODE))
        if any(action["status"] == "failed" for action in actions):
            return {
                "status": "failed",
                "backupHome": backup_home.as_posix(),
                "helperPath": helper_path.as_posix(),
                "configPath": config_path.as_posix(),
                "dataDir": data_dir.resolve(strict=True).as_posix(),
                "effectiveUser": user,
                "actions": actions,
            }

    config_parent_check = _config_parent_check(config_path, user)
    checks.append(config_parent_check)
    if config_parent_check["status"] == "fail":
        return {
            "status": "invalid",
            "backupHome": backup_home.as_posix(),
            "helperPath": helper_path.as_posix(),
            "configPath": config_path.as_posix(),
            "dataDir": data_dir.resolve(strict=True).as_posix(),
            "effectiveUser": user,
            "checks": checks,
            "summary": _summary(checks),
            "actions": actions,
        }

    values = _config_values(request, backup_home, data_dir, helper_path, user)
    if dry_run:
        return {
            "status": "validated",
            "backupHome": backup_home.as_posix(),
            "helperPath": helper_path.as_posix(),
            "configPath": config_path.as_posix(),
            "dataDir": data_dir.resolve(strict=True).as_posix(),
            "effectiveUser": user,
            "actions": actions,
            "config": _safe_config(values),
        }

    try:
        helper_path = _install_runtime_helper(backup_home)
        values = _config_values(request, backup_home, data_dir, helper_path, user)
        _write_config_file(config_path, values)
    except OSError as error:
        return {
            "status": "failed",
            "backupHome": backup_home.as_posix(),
            "helperPath": helper_path.as_posix(),
            "configPath": config_path.as_posix(),
            "dataDir": data_dir.resolve(strict=True).as_posix(),
            "effectiveUser": user,
            "actions": actions,
            "error": error.__class__.__name__,
        }

    return {
        "status": "setup",
        "backupHome": backup_home.as_posix(),
        "helperPath": helper_path.as_posix(),
        "configPath": config_path.as_posix(),
        "dataDir": data_dir.resolve(strict=True).as_posix(),
        "effectiveUser": user,
        "actions": actions,
        "config": _safe_config(values),
    }


def handle_request(request_value: Any, allow_dry_run: bool = True) -> dict[str, Any]:
    request_id = None
    operation = None

    try:
        request = require_dict(request_value, "request")
        reject_unknown_fields(request, {"id", "version", "operation", "params", "dryRun"}, "request")
        if isinstance(request.get("id"), str):
            request_id = request["id"]
        if request.get("version") is not None and request.get("version") != 1:
            raise HelperError("invalid_request", "request.version is not supported.")
        if request.get("dryRun") is not None and not allow_dry_run:
            raise HelperError("invalid_request", "request.dryRun is not accepted by the setup helper.")

        operation = require_string(request.get("operation"), "operation")
        if operation != "backupHome.setup":
            raise HelperError("unknown_operation", f"operation '{operation}' is not registered.")

        return {
            "id": request_id,
            "ok": True,
            "operation": operation,
            "result": handle_backup_home_setup(request.get("params"), request.get("dryRun") is True),
        }
    except HelperError as error:
        return {
            "id": request_id,
            "ok": False,
            "operation": operation,
            "error": {
                "code": error.code,
                "message": error.message,
            },
        }
    except Exception:
        return {
            "id": request_id,
            "ok": False,
            "operation": operation,
            "error": {
                "code": "internal_error",
                "message": "Internal setup helper error.",
            },
        }


def _read_json_request() -> Any:
    payload = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
    if len(payload) > MAX_REQUEST_BYTES:
        raise RuntimeError("request exceeds maximum setup request size.")

    return json.loads(payload.decode("utf-8"))


def _write_json(value: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(value, separators=(",", ":")) + "\n")


def _self_test() -> dict[str, Any]:
    return {
        "ok": True,
        "version": HELPER_VERSION,
        "capabilities": CAPABILITIES,
    }


def main() -> int:
    try:
        args = sys.argv[1:]
        if args == ["--self-test"]:
            _write_json(_self_test())

            return 0
        if args:
            _write_json({
                "ok": False,
                "error": {
                    "code": "invalid_request",
                    "message": "Unsupported setup helper arguments.",
                },
            })

            return 64

        payload = _read_json_request()
        _write_json(handle_request(payload))

        return 0
    except Exception as error:
        _write_json({
            "ok": False,
            "error": {
                "code": "startup_error",
                "message": str(error),
            },
        })

        return 1


if __name__ == "__main__":
    raise SystemExit(main())
