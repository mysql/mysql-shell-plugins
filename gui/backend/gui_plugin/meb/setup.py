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
import hashlib
import io
import json
import os
import re
import secrets
import select
import shlex
import shutil
import stat
import subprocess
import sys
import tempfile
import threading
import time
from datetime import datetime, timezone
from typing import Any, Callable
from xml.dom.minidom import parseString

import mysqlsh

import gui_plugin.core.Logger as logger
from gui_plugin.core.dbms.MySQLUserManagement import (
    create_mysql_user,
    grant_mysql_user_privileges,
    validate_mysql_user_grants,
    reset_mysql_user_password,
    reset_mysql_user_query_limit,
)
from gui_plugin.core.lib.SystemUtils import get_mysqlsh_install_path

from .backup_home import (
    IGNORED_PROFILE_CONFIGS,
    JOB_LOG_DIR_NAME,
    LEGACY_MYSQLBACKUP_METADATA_OPTIONS,
    SCHEDULE_INTERVAL_MAXIMUMS,
    ResolvedActivity,
    _BackupMetadataNotFoundError,
    build_status,
    resolve_activity,
    _dependent_incremental_backups,
    _restore_chain_for_backup,
    _canonical_path,
    _clean,
    delete_profile as _delete_profile,
    _manager_config_path,
    _manager_values,
    _read_config_text,
    _read_profiles,
    save_profile as _save_profile,
    _same_path,
    _validation,
)
from .context import create_local_backup_context
from .grant_policy import general_grant_requirements, recovery_grant_requirements
from .models import (
    MebBackupContent,
    MebBackupFileGroup,
    MebBackupContentRow,
    MebBackupRestoreChainEntry,
    MebBackupHomeValidation,
    MebLogContent,
    MebPrerequisitesValidation,
    MebMysqlBackupUserValidation,
    MebBackupProfile,
    MebRestoreProgress,
    MebRestoreResult,
    MebSetupState,
    MebStatus,
    MebValidationStatus,
)
from .os_utils import get_current_os_user, get_path_group, get_path_owner, write_text_private


DEFAULT_MYSQL_BACKUP_USER = "mysqlbackup"
WINDOWS_CONFIG_EDITOR_TIMEOUT_SECONDS = 30
DEFAULT_MYSQL_BACKUP_ACCOUNT = "mysqlbackup@localhost"
_TERMINAL_ESCAPE_SEQUENCE = re.compile(
    r"\x1b(?:\][^\x1b\x07]*(?:\x07|\x1b\\)|\[[0-?]*[ -/]*[@-~]|[@-_])"
)


def _fetch_one(result: Any) -> Any | None:
    if result is None:
        return None

    return result.fetch_one()


def _query_scalar(session: Any, sql: str, params: list[Any] | None = None) -> str | None:
    row = _fetch_one(session.run_sql(sql, params or []))
    if row is None or row[0] is None:
        return None

    return str(row[0])


def _scheduler_name(is_windows: bool) -> str:
    if is_windows:
        return "Task Scheduler"
    if sys.platform == "darwin":
        return "launchd"

    return "cron"


def _scheduler_backend(context: Any) -> str:
    if context.target.is_windows:
        return "schtasks"
    if sys.platform == "darwin":
        return "launchd"

    return "cron"


def _default_mysqlbackup_path(context: Any) -> str:
    basedir = (context.target.basedir or "").rstrip("\\/")
    binary_name = "mysqlbackup.exe" if context.target.is_windows else "mysqlbackup"
    if not basedir:
        return binary_name

    return context.target.join_path(basedir, "bin", binary_name)


def _product_helper_dir(context: Any) -> str:
    explicit_helper_dir = os.environ.get("MYSQLSH_GUI_HELPERS_DIR")
    if explicit_helper_dir:
        return os.path.abspath(explicit_helper_dir)

    return os.path.abspath(os.path.join(get_mysqlsh_install_path(), "..", "helpers"))


def _runtime_helper_source_path(context: Any) -> str:
    binary_name = "task-helper.cmd" if context.target.is_windows else "task-helper"
    return os.path.join(_product_helper_dir(context), binary_name)


def _executable_path(command_name: str, fallback: str | None = None) -> str | None:
    found = shutil.which(command_name)
    if found:
        return found
    if fallback:
        return fallback

    return None


def _mysql_config_editor_path(context: Any) -> str:
    basedir = (context.target.basedir or "").rstrip("\\/")
    binary_name = "mysql_config_editor.exe" if context.target.is_windows else "mysql_config_editor"
    if not basedir:
        return binary_name

    candidate = context.target.join_path(basedir, "bin", binary_name)
    if os.path.isfile(candidate):
        return candidate

    return binary_name


def _mysql_client_path(context: Any) -> str:
    binary_name = "mysql.exe" if context.target.is_windows else "mysql"
    mysqlbackup_path = _default_mysqlbackup_path(context)
    mysqlbackup_dir = os.path.dirname(mysqlbackup_path)
    if mysqlbackup_dir:
        candidate = os.path.join(mysqlbackup_dir, binary_name)
        if os.path.isfile(candidate):
            return candidate

    return binary_name


def _login_path(datadir: str | None) -> str:
    digest = hashlib.sha256((datadir or "").encode("utf-8")).hexdigest()[:12]

    return f"mysql_workbench_meb_{digest}"


def _login_file(backup_home_path: str) -> str:
    return os.path.join(backup_home_path, ".mylogin.cnf")


def _env_command(context: Any, env_name: str, env_value: str, command: str) -> str:
    if context.target.is_windows:
        return 'set "%s=%s" && %s' % (env_name, env_value.replace('"', '""'), command)

    return "%s=%s %s" % (env_name, shlex.quote(env_value), command)


def _local_account_host(context: Any) -> str:
    if context.target.is_windows and str(context.target.skip_name_resolve).upper() == "ON":
        return "::1"

    return "localhost"


def _parse_mysql_account(value: str | None, default_host: str) -> tuple[str, str]:
    account = (value or "").strip()
    if not account:
        return DEFAULT_MYSQL_BACKUP_USER, default_host

    def parse_part(position: int) -> tuple[str, int]:
        while position < len(account) and account[position].isspace():
            position += 1
        if position >= len(account):
            raise ValueError("MySQL account is missing a user or host")

        quote = account[position] if account[position] in ("'", "\"", "`") else None
        if quote is None:
            end = account.find("@", position)
            if end == -1:
                end = len(account)
            part = account[position:end].strip()
            position = end
        else:
            position += 1
            parts: list[str] = []
            while position < len(account):
                character = account[position]
                if character != quote:
                    parts.append(character)
                    position += 1
                    continue
                if position + 1 < len(account) and account[position + 1] == quote:
                    parts.append(quote)
                    position += 2
                    continue
                position += 1
                break
            else:
                raise ValueError("MySQL account has an unterminated quoted user or host")
            part = "".join(parts)

        if not part:
            raise ValueError("MySQL account is missing a user or host")
        while position < len(account) and account[position].isspace():
            position += 1
        return part, position

    user, position = parse_part(0)
    if position == len(account):
        return user, default_host
    if account[position] != "@":
        raise ValueError("MySQL account must separate user and host with '@'")

    host, position = parse_part(position + 1)
    if position != len(account):
        raise ValueError("MySQL account has unexpected trailing characters")

    return user, host


def _format_mysql_account(user: str, host: str) -> str:
    return f"{user}@{host}"


def _mysqlbackup_status(mysqlbackup_path: str | None) -> tuple[bool, MebValidationStatus]:
    if not mysqlbackup_path:
        return False, _validation("warn", "mysqlbackup path could not be derived from @@basedir.")

    if not os.path.exists(mysqlbackup_path):
        return False, _validation("warn", "mysqlbackup was not found at @@basedir/bin.")

    if not os.path.isfile(mysqlbackup_path):
        return False, _validation("warn", "mysqlbackup path is not a file.")

    if os.name != "nt" and not os.access(mysqlbackup_path, os.X_OK):
        return False, _validation("warn", "mysqlbackup exists but is not executable.")

    return True, _validation("ok", "mysqlbackup exists at @@basedir/bin.")


def _runtime_helper_json_response(output: list[str]) -> dict[str, Any] | None:
    for line in reversed("".join(output).splitlines()):
        candidate = line.strip()
        if not candidate:
            continue
        try:
            response = json.loads(candidate)
        except json.JSONDecodeError:
            continue

        return response if isinstance(response, dict) else None

    return None


def _run_runtime_helper_self_test(
    context: Any,
    helper_path: str,
    backup_home_path: str,
    require_config: bool,
) -> MebValidationStatus:
    output: list[str] = []
    rc = context.backend.execute_argv_with_input(
        [helper_path, "--backup-home", backup_home_path, "--self-test"],
        "",
        output_handler=output.append,
    )
    if rc != 0:
        return _validation("warn", "The MEB task helper could not be executed by the current OS user.")

    try:
        response = _runtime_helper_json_response(output)
        if not isinstance(response, dict):
            raise ValueError("missing JSON object")
    except Exception as err:
        return _validation("warn", f"The MEB task helper returned an invalid response: {err}")

    if not response.get("ok"):
        error = response.get("error")
        if isinstance(error, dict) and error.get("message"):
            return _validation("warn", str(error["message"]))

        return _validation("warn", "The MEB task helper reported an error.")

    if require_config and response.get("configLoaded") is not True:
        config_error = response.get("configError")
        if isinstance(config_error, str) and config_error:
            return _validation("warn", f"The backup-home task helper could not load backups.cnf: {config_error}.")

        return _validation("warn", "The backup-home task helper could not load backups.cnf.")

    return _validation("ok", "The MEB task helper can run as the current OS user.")


def _runtime_helper_request(
    context: Any,
    backup_home_path: str,
    manager_values: dict[str, str],
    operation: str,
    params: dict[str, Any],
) -> dict[str, Any]:
    helper_path = _runtime_helper_source_path(context)
    output: list[str] = []
    rc = context.backend.execute_argv_with_input(
        [helper_path],
        json.dumps({
            "version": 1,
            "backupHome": backup_home_path,
            "operation": operation,
            "params": params,
        }),
        output_handler=output.append,
    )
    response = _runtime_helper_json_response(output)

    if not isinstance(response, dict):
        raise ValueError("The MEB task helper returned an invalid response.")
    if not response.get("ok"):
        error = response.get("error")
        if isinstance(error, dict):
            code = str(error.get("code") or "operation_failed")
            message = str(error.get("message") or "The MEB task helper reported an error.")
            if code == "backup_running":
                raise RuntimeError(message)
            raise ValueError(message)
        raise ValueError("The MEB task helper reported an error.")
    if rc != 0:
        raise ValueError("The MEB task helper failed.")

    result = response.get("result")
    if not isinstance(result, dict):
        raise ValueError("The MEB task helper returned an invalid result.")

    return result


def _current_user_datadir_access_status(
    context: Any,
) -> MebValidationStatus:
    datadir = context.target.datadir
    if not datadir:
        return _validation("warn", "The server data directory could not be detected.")

    try:
        context.backend.listdir(datadir)
    except Exception as err:
        current_user = get_current_os_user() or "the current OS user"
        return _validation("warn", f"{current_user} cannot read the MySQL data directory: {err}")

    return _validation("ok", "The current OS user can read the MySQL data directory.")


def validate_local_backup_access(session: Any) -> MebPrerequisitesValidation:
    context = create_local_backup_context(session=session)
    os_user = get_current_os_user() or ""
    mysqlbackup_path = _default_mysqlbackup_path(context)
    mysqlbackup_exists, mysqlbackup_status = _mysqlbackup_status(mysqlbackup_path)
    datadir = context.target.datadir
    datadir_owner = get_path_owner(datadir)
    datadir_group = get_path_group(datadir)
    scheduler_name = _scheduler_name(context.target.is_windows)

    if not os_user:
        user_status = _validation("warn", "The current OS user could not be detected.")
    elif os_user == "root":
        user_status = _validation(
            "warn",
            "Running mysqld and backups as root is strongly discouraged because of security risks.",
        )
    else:
        user_status = _validation("ok", f"MySQL Workbench is running as OS user '{os_user}'.")

    datadir_status = _current_user_datadir_access_status(context)
    valid = user_status.tone != "warn" and datadir_status.tone != "warn"

    return MebPrerequisitesValidation(
        valid=valid,
        osUser=os_user,
        mysqlbackupPath=mysqlbackup_path,
        mysqlbackupExists=mysqlbackup_exists,
        datadir=datadir,
        datadirOwner=datadir_owner,
        datadirGroup=datadir_group,
        currentOsUser=os_user or None,
        platform=sys.platform,
        schedulerName=scheduler_name,
        userStatus=user_status,
        mysqlbackupStatus=mysqlbackup_status,
        datadirStatus=datadir_status,
    )


def _backup_home_permissions_status(path: str, is_windows: bool) -> MebValidationStatus:
    if is_windows:
        return _validation(
            "info",
            "Windows ACL validation is limited; current-user access checks are enforced.",
        )

    try:
        mode = stat.S_IMODE(os.stat(path).st_mode)
    except OSError as err:
        return _validation("warn", f"Unable to read backup home permissions: {err}")

    if mode & 0o077:
        return _validation(
            "warn",
            "Backup home must be accessible only by its owner; remove group/other permissions.",
        )

    return _validation("ok", "Backup home permissions are owner-only.")


def _backup_home_reuse_status(
    backup_home_path: str,
    datadir: str | None,
) -> MebValidationStatus:
    manager_values = _manager_values(backup_home_path)
    configured_datadir = manager_values.get("datadir")
    if configured_datadir:
        if _same_path(configured_datadir, datadir):
            return _validation("ok", "Backup home is configured for this MySQL data directory.")

        return _validation(
            "warn",
            "backups.cnf identifies a different MySQL data directory.",
        )

    profiles = _read_profiles(backup_home_path)
    for profile in profiles:
        if profile.configPath and os.path.basename(profile.configPath) in IGNORED_PROFILE_CONFIGS:
            continue
        if profile.datadir and not _same_path(profile.datadir, datadir):
            return _validation(
                "warn",
                f"Profile '{profile.label}' appears to belong to another MySQL data directory.",
            )

    return _validation("ok", "Backup home is not configured for another MySQL instance.")


def validate_backup_home(
    session: Any,
    backup_home_path: str,
) -> MebBackupHomeValidation:
    context = create_local_backup_context(session=session)
    backup_home_path = _clean(backup_home_path)
    os_user = get_current_os_user()

    if not backup_home_path:
        status = _validation("warn", "Choose a backup home directory.")
        return MebBackupHomeValidation(status=status)

    backup_home_path = _canonical_path(backup_home_path)
    if not os.path.exists(backup_home_path):
        status = _validation("warn", "Backup home directory does not exist. Create it before continuing.")
        return MebBackupHomeValidation(backupHomePath=backup_home_path, exists=False, status=status)

    if not os.path.isdir(backup_home_path):
        status = _validation("warn", "Backup home path is not a directory.")
        return MebBackupHomeValidation(backupHomePath=backup_home_path, exists=True, status=status)

    owner = get_path_owner(backup_home_path)
    if owner and os_user and owner == os_user:
        ownership_status = _validation("ok", f"Backup home is owned by {owner}.")
    elif not os_user:
        ownership_status = _validation("warn", "The current OS user could not be detected.")
    elif owner and owner != os_user:
        ownership_status = _validation(
            "warn",
            f"Backup home must be owned by the current OS user '{os_user}'.",
        )
    else:
        ownership_status = _validation("warn", "Unable to determine backup home owner.")

    permissions_status = _backup_home_permissions_status(backup_home_path, context.target.is_windows)
    reuse_status = _backup_home_reuse_status(
        backup_home_path,
        context.target.datadir,
    )

    try:
        context.backend.listdir(backup_home_path)
        writable = context.backend.check_dir_writable(backup_home_path)
        access_status = _validation(
            "ok" if writable else "warn",
            "The current OS user can read and write the backup home."
            if writable else "The current OS user cannot write to the backup home.",
        )
    except Exception as err:
        access_status = _validation("warn", f"Unable to access backup home as the current OS user: {err}")

    valid = all(
        status.tone != "warn"
        for status in (ownership_status, permissions_status, reuse_status, access_status)
    )
    status = _validation(
        "ok" if valid else "warn",
        "Backup home is ready for MEB setup."
        if valid else "Backup home needs attention before setup can continue.",
    )

    return MebBackupHomeValidation(
        valid=valid,
        backupHomePath=backup_home_path,
        exists=True,
        owner=owner,
        status=status,
        ownershipStatus=ownership_status,
        permissionsStatus=permissions_status,
        reuseStatus=reuse_status,
        accessStatus=access_status,
    )


def _create_private_directory_recursive(path: str, is_windows: bool) -> None:
    if is_windows:
        os.makedirs(path, exist_ok=True)
        return

    missing: list[str] = []
    current = path
    while current and not os.path.exists(current):
        missing.append(current)
        parent = os.path.dirname(current)
        if parent == current:
            break
        current = parent

    for directory in reversed(missing):
        try:
            os.mkdir(directory, 0o700)
        except FileExistsError:
            pass

        file_stat = os.lstat(directory)
        if not stat.S_ISDIR(file_stat.st_mode):
            raise NotADirectoryError(f"'{directory}' is not a directory")
        os.chmod(directory, 0o700)


def create_backup_home(
    session: Any,
    backup_home_path: str,
) -> MebBackupHomeValidation:
    context = create_local_backup_context(session=session)
    backup_home_path = _clean(backup_home_path)

    if not backup_home_path:
        status = _validation("warn", "Enter a backup home directory to create.")
        return MebBackupHomeValidation(status=status)

    backup_home_path = _canonical_path(backup_home_path)
    if os.path.lexists(backup_home_path):
        if not os.path.isdir(backup_home_path):
            status = _validation("warn", "Backup home path exists but is not a directory.")
            return MebBackupHomeValidation(backupHomePath=backup_home_path, exists=True, status=status)

        return validate_backup_home(session, backup_home_path)

    try:
        _create_private_directory_recursive(backup_home_path, context.target.is_windows)
    except Exception as err:
        status = _validation("warn", f"Unable to create backup home directory: {err}")
        return MebBackupHomeValidation(backupHomePath=backup_home_path, status=status)

    return validate_backup_home(session, backup_home_path)


def _account_host(session: Any, mysql_user: str, preferred_host: str) -> str | None:
    result = session.run_sql(
        """
        SELECT Host FROM mysql.user
        WHERE User = ? AND Host = ?
        LIMIT 1
        """,
        [mysql_user, preferred_host],
    )
    row = _fetch_one(result)
    if row is None or row[0] is None:
        return None

    return str(row[0])


def _apply_backup_mysql_user_policy(
    session: Any,
    server_version: tuple[int, int, int],
    mysql_user: str,
    host: str,
) -> None:
    requirements = [
        *general_grant_requirements(server_version),
        *recovery_grant_requirements(),
    ]
    grant_mysql_user_privileges(
        session,
        mysql_user,
        host,
        requirements,
    )
    reset_mysql_user_query_limit(session, mysql_user, host)


def _set_login_path(
    context: Any,
    login_file: str,
    login_path: str,
    mysql_user: str,
    password: str,
) -> MebValidationStatus:
    editor_path = _mysql_config_editor_path(context)
    command_data = [
        editor_path,
        "set",
        f"--login-path={login_path}",
        f"--host={_local_account_host(context)}",
        f"--user={mysql_user}",
        "--password",
        "--skip-warn",
    ]
    if context.target.port:
        command_data.append(f"--port={context.target.port}")
    if context.target.socket and not context.target.is_windows:
        command_data.append(f"--socket={context.target.socket}")

    output: list[str] = []
    if context.target.is_windows:
        env = os.environ.copy()
        env["MYSQL_TEST_LOGIN_FILE"] = login_file
        worker_command = [
            str(getattr(mysqlsh, "executable", sys.executable)),
            "--disable-plugins",
            "--disable-builtin-plugins",
            "--py",
            "-f",
            os.path.join(os.path.dirname(__file__), "windows_conpty.py"),
            "--stdin",
            "--",
            *command_data,
        ]

        rc = context.backend.execute_argv_with_input(
            worker_command,
            f"{password}\r",
            output_handler=lambda text: output.append(
                _redact_secret(text, password)
            ),
            env=env,
            timeout=WINDOWS_CONFIG_EDITOR_TIMEOUT_SECONDS,
        )
    else:
        command = _env_command(
            context,
            "MYSQL_TEST_LOGIN_FILE",
            login_file,
            context.backend.list2cmdline(command_data),
        )
        rc = _execute_password_prompt_command(
            command,
            f"{password}\n",
            password,
            output.append,
        )
    if rc != 0:
        detail = "".join(output).strip()
        failure = f"MEB mysql_config_editor failed with exit code {rc}"
        if detail:
            logger.error(f"{failure}: {detail}")
            display_detail = _clean_terminal_output(detail)
            if display_detail:
                return _validation(
                    "warn",
                    f"mysql_config_editor failed (exit code {rc}): {display_detail}",
                )
        else:
            logger.error(f"{failure}.")

        return _validation(
            "warn",
            f"mysql_config_editor failed (exit code {rc}).",
        )

    return _validation("ok", "Credentials were stored with mysql_config_editor.")


def _store_login_path(
    context: Any,
    backup_home_path: str,
    mysql_user: str,
    password: str,
) -> tuple[str, str, MebValidationStatus]:
    login_file = _login_file(backup_home_path)
    login_path = _login_path(context.target.datadir)
    status = _set_login_path(context, login_file, login_path, mysql_user, password)
    return login_file, login_path, status


def _validate_backup_account_connection(
    connected_account: tuple[str, str] | None,
    mysql_user: str,
    host: str,
    success_message: str,
) -> MebValidationStatus:
    if connected_account is None:
        return _validation("warn", "The backup MySQL account connected, but the authenticated user could not be verified.")

    connected_user, connected_host = connected_account
    if connected_user != mysql_user or connected_host != host:
        return _validation(
            "warn",
            (
                "Stored credentials authenticated as "
                f"{_format_mysql_account(connected_user, connected_host)}, expected "
                f"{_format_mysql_account(mysql_user, host)}."
            ),
        )

    return _validation("ok", success_message)


def _mysql_current_user_from_client(
    context: Any,
    args: list[str],
    login_file: str | None = None,
) -> tuple[int, str, str]:
    command = [
        _mysql_client_path(context),
        *args,
        "--batch",
        "--skip-column-names",
        "--execute=SELECT CURRENT_USER()",
    ]
    env = os.environ.copy()
    env["LANG"] = "C"
    if login_file:
        env["MYSQL_TEST_LOGIN_FILE"] = login_file

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            check=False,
            encoding="utf-8",
            env=env,
            timeout=30,
        )
    except subprocess.TimeoutExpired as err:
        return 1, "", f"mysql client timed out after {err.timeout} seconds"
    except OSError as err:
        return 1, "", str(err)

    return result.returncode, result.stdout, result.stderr


def _mysql_client_error(stderr: str, stdout: str) -> str:
    detail = (stderr or stdout).strip()
    if detail:
        return detail

    return "mysql client failed."


def _validate_stored_login_path(
    context: Any,
    backup_home_path: str,
    mysql_user: str,
    host: str,
) -> tuple[str, str, MebValidationStatus]:
    login_file = _login_file(backup_home_path)
    login_path = _login_path(context.target.datadir)
    if not os.path.isfile(login_file):
        return (
            login_file,
            login_path,
            _validation("warn", "Stored backup account credentials were not found in the backup home."),
        )

    rc, stdout, stderr = _mysql_current_user_from_client(
        context,
        [f"--login-path={login_path}"],
        login_file=login_file,
    )
    if rc != 0:
        return (
            login_file,
            login_path,
            _validation("warn", f"Stored backup account credentials could not connect: {_mysql_client_error(stderr, stdout)}"),
        )

    return login_file, login_path, _validate_backup_account_connection(
        _parse_mysql_account(stdout.strip().splitlines()[0], host) if stdout.strip() else None,
        mysql_user,
        host,
        "Stored backup account credentials were validated.",
    )


def _validate_backup_account_password(
    context: Any,
    mysql_user: str,
    host: str,
    password: str,
) -> MebValidationStatus:
    with tempfile.TemporaryDirectory(prefix="mysql-workbench-meb-") as directory:
        login_file = os.path.join(directory, "login.cnf")
        login_path = "mysql-workbench-meb-validation"
        status = _set_login_path(context, login_file, login_path, mysql_user, password)
        if status.tone == "warn":
            return _validation("warn", f"Backup account credentials could not be validated: {status.message}")

        rc, stdout, stderr = _mysql_current_user_from_client(
            context,
            [f"--login-path={login_path}"],
            login_file=login_file,
        )
        if rc != 0:
            return _validation("warn", f"Backup account credentials could not connect: {_mysql_client_error(stderr, stdout)}")

        return _validate_backup_account_connection(
            _parse_mysql_account(stdout.strip().splitlines()[0], host) if stdout.strip() else None,
            mysql_user,
            host,
            "Backup account password was validated.",
        )


def _execute_password_prompt_command(
    command: str,
    input_text: str,
    secret_text: str,
    output_handler: Callable[[str], Any] | None = None,
    timeout: int = 30,
) -> int:
    import pty

    script = "cd; " + command.strip(" ") + " ; exit $?"
    environment = os.environ.copy()
    environment["LANG"] = "C"

    pid, fd = pty.fork()
    if pid == 0:
        os.execve("/bin/sh", ["/bin/sh", "-c", script], environment)

    sent_input = False
    output = ""
    start_time = time.monotonic()
    exit_status = 1
    try:
        while True:
            if time.monotonic() - start_time > timeout:
                try:
                    os.kill(pid, 9)
                except OSError:
                    pass
                if output_handler:
                    output_handler("Timed out waiting for mysql_config_editor password prompt.")

                return 1

            readable, _, _ = select.select([fd], [], [], 0.1)
            if readable:
                try:
                    chunk = os.read(fd, 4096)
                except OSError:
                    chunk = b""
                if chunk:
                    text = chunk.decode("utf-8", errors="replace")
                    output += text
                    if output_handler:
                        output_handler(_redact_secret(text, secret_text))

                    if not sent_input and "password" in output.lower():
                        os.write(fd, input_text.encode("utf-8"))
                        sent_input = True

            wait_pid, status = os.waitpid(pid, os.WNOHANG)
            if wait_pid == pid:
                if os.WIFEXITED(status):
                    exit_status = os.WEXITSTATUS(status)
                elif os.WIFSIGNALED(status):
                    exit_status = 128 + os.WTERMSIG(status)
                break
    finally:
        try:
            os.close(fd)
        except OSError:
            pass

    return exit_status


def _redact_secret(text: str, secret: str) -> str:
    if not secret:
        return text

    return text.replace(secret, "<redacted>")


def _clean_terminal_output(text: str) -> str:
    plain_text = _TERMINAL_ESCAPE_SEQUENCE.sub("", text)
    printable_text = "".join(
        character if character.isprintable() or character in "\r\n\t" else " "
        for character in plain_text
    )

    return " ".join(printable_text.split())


def _install_runtime_helper(context: Any, _backup_home_path: str) -> str:
    return _runtime_helper_source_path(context)


def _manager_config_values(
    context: Any,
    backup_home_path: str,
    mysql_account: str,
    runtime_helper_path: str,
) -> dict[str, str]:
    datadir = context.target.datadir or ""
    values: dict[str, str] = {
        "datadir": _canonical_path(datadir) if datadir else "",
        "mysqlbackup": _default_mysqlbackup_path(context),
        "backup_os_user": get_current_os_user() or "",
        "backup_mysql_user": mysql_account,
        "login_file": _login_file(backup_home_path),
        "login_path": _login_path(datadir),
        "job_runner": runtime_helper_path,
        "backup_root": backup_home_path,
        "option_file_root": backup_home_path,
        "working_directory": backup_home_path,
        "timeout_ms": "3600000",
        "max_output_bytes": "1048576",
        "scheduler_backend": _scheduler_backend(context),
        "launchd_plist_dir": os.path.join(backup_home_path, "launchd"),
        "windows_task_folder": r"\MySQLWorkbench",
        "windows_logon_type": "S4U",
    }

    if context.target.basedir:
        values["basedir"] = context.target.basedir
    if context.target.version:
        values["mysql_version"] = context.target.version

    if context.target.is_windows:
        values["crontab"] = r"C:\Windows\System32\schtasks.exe"
        values["launchctl"] = r"C:\Windows\System32\schtasks.exe"
        values["schtasks"] = r"C:\Windows\System32\schtasks.exe"
    else:
        values["crontab"] = _executable_path("crontab", "/usr/bin/crontab") or "crontab"
        values["launchctl"] = "/bin/launchctl" if sys.platform == "darwin" else "/usr/bin/false"
        values["schtasks"] = "/usr/bin/false"
        if hasattr(os, "geteuid") and hasattr(os, "getegid"):
            values["backup_os_uid"] = str(os.geteuid())
            values["backup_os_gid"] = str(os.getegid())

    return values


def _write_manager_config(path: str, values: dict[str, str]) -> None:
    parser = configparser.RawConfigParser()
    parser.add_section("meb")
    for key, value in values.items():
        if value is not None:
            parser.set("meb", key, str(value))

    stream = io.StringIO()
    stream.write("# MySQL Enterprise Backup local support configuration\n")
    parser.write(stream)
    write_text_private(path, stream.getvalue(), "MEB support configuration")


def validate_backup_mysql_user(
    session: Any,
    backup_home_path: str,
    mysql_user: str,
    password: str | None = None,
) -> MebMysqlBackupUserValidation:
    context = create_local_backup_context(session=session)
    backup_home_path = _canonical_path(_clean(backup_home_path) or "")
    mysql_user, requested_host = _parse_mysql_account(mysql_user, _local_account_host(context))
    password = _clean(password)
    host = _account_host(session, mysql_user, requested_host)
    exists = host is not None

    if not exists:
        return MebMysqlBackupUserValidation(
            exists=False,
            status=_validation("warn", "Backup MySQL account does not exist."),
            passwordStatus=_validation("info", "Use Create User to create it with a generated password."),
        )

    requirements = [
        *general_grant_requirements(context.target.version_parts),
        *recovery_grant_requirements(),
    ]
    grant_validation = validate_mysql_user_grants(session, mysql_user, host, requirements)
    if not grant_validation.valid:
        missing_grants = [
            f"{', '.join(requirement.privileges)} ON {requirement.target_quoted}"
            for requirement in grant_validation.missing_requirements
        ]
        grant_status = _validation("warn", "Backup MySQL account is missing required grants.")
    else:
        missing_grants = []
        grant_status = _validation("ok", f"Backup MySQL account exists as {_format_mysql_account(mysql_user, host)}.")

    if not password:
        login_file, login_path, password_status = _validate_stored_login_path(
            context,
            backup_home_path,
            mysql_user,
            host,
        )
        password_valid = password_status.tone != "warn"

        return MebMysqlBackupUserValidation(
            valid=password_valid and grant_validation.valid,
            exists=True,
            host=host,
            passwordStored=password_valid,
            loginFile=login_file,
            loginPath=login_path,
            missingGrants=missing_grants,
            status=grant_status,
            passwordStatus=password_status,
        )

    password_status = _validate_backup_account_password(
        context,
        mysql_user,
        host,
        password,
    )
    if password_status.tone == "warn":
        return MebMysqlBackupUserValidation(
            exists=True,
            host=host,
            missingGrants=missing_grants,
            status=grant_status,
            passwordStatus=password_status,
        )

    login_file, login_path, store_status = _store_login_path(
        context,
        backup_home_path,
        mysql_user,
        password,
    )
    password_stored = store_status.tone != "warn"

    return MebMysqlBackupUserValidation(
        valid=password_stored and grant_validation.valid,
        exists=True,
        host=host,
        passwordStored=password_stored,
        loginFile=login_file,
        loginPath=login_path,
        missingGrants=missing_grants,
        status=grant_status,
        passwordStatus=store_status if not password_stored else password_status,
    )


def fix_backup_mysql_user(
    session: Any,
    backup_home_path: str,
    mysql_user: str,
) -> MebMysqlBackupUserValidation:
    context = create_local_backup_context(session=session)
    mysql_user, requested_host = _parse_mysql_account(mysql_user, _local_account_host(context))
    host = _account_host(session, mysql_user, requested_host)
    if host is None:
        return MebMysqlBackupUserValidation(
            exists=False,
            status=_validation("warn", "Backup MySQL account does not exist."),
            passwordStatus=_validation("info", "Use Create User to create it with a generated password."),
        )

    _apply_backup_mysql_user_policy(session, context.target.version_parts, mysql_user, host)

    return validate_backup_mysql_user(
        session,
        backup_home_path,
        _format_mysql_account(mysql_user, host),
    )


def create_backup_mysql_user(
    session: Any,
    backup_home_path: str,
    mysql_user: str,
) -> MebMysqlBackupUserValidation:
    context = create_local_backup_context(session=session)
    backup_home_path = _canonical_path(_clean(backup_home_path) or "")
    mysql_user, host = _parse_mysql_account(mysql_user, _local_account_host(context))
    existing_host = _account_host(session, mysql_user, host)
    if existing_host:
        return MebMysqlBackupUserValidation(
            exists=True,
            host=existing_host,
            status=_validation(
                "warn",
                f"Backup MySQL account already exists as {_format_mysql_account(mysql_user, existing_host)}.",
            ),
        )

    password = secrets.token_urlsafe(24)
    version = context.target.version_parts
    create_mysql_user(session, mysql_user, host, password)
    _apply_backup_mysql_user_policy(session, version, mysql_user, host)

    password_status = _validate_backup_account_password(
        context,
        mysql_user,
        host,
        password,
    )
    if password_status.tone == "warn":
        return MebMysqlBackupUserValidation(
            exists=True,
            host=host,
            status=_validation("warn", "Backup MySQL account was created, but its password could not be validated."),
            passwordStatus=password_status,
        )

    login_file, login_path, store_status = _store_login_path(
        context,
        backup_home_path,
        mysql_user,
        password,
    )
    valid = store_status.tone != "warn"

    return MebMysqlBackupUserValidation(
        valid=valid,
        exists=True,
        host=host,
        passwordStored=valid,
        loginFile=login_file,
        loginPath=login_path,
        status=_validation("ok" if valid else "warn", "Backup MySQL account was created with required grants."),
        passwordStatus=store_status if not valid else password_status,
    )


def reset_backup_mysql_user_password(
    session: Any,
    backup_home_path: str,
    mysql_user: str,
    password: str | None = None,
) -> MebMysqlBackupUserValidation:
    context = create_local_backup_context(session=session)
    backup_home_path = _canonical_path(_clean(backup_home_path) or "")
    mysql_user, requested_host = _parse_mysql_account(mysql_user, _local_account_host(context))
    password = _clean(password) or secrets.token_urlsafe(24)
    host = _account_host(session, mysql_user, requested_host)
    if host is None:
        return MebMysqlBackupUserValidation(
            exists=False,
            status=_validation("warn", "Backup MySQL account does not exist."),
            passwordStatus=_validation("info", "Use Create User to create it with a generated password."),
        )

    version = context.target.version_parts
    reset_mysql_user_password(session, mysql_user, host, password)
    _apply_backup_mysql_user_policy(session, version, mysql_user, host)

    password_status = _validate_backup_account_password(
        context,
        mysql_user,
        host,
        password,
    )
    if password_status.tone == "warn":
        return MebMysqlBackupUserValidation(
            exists=True,
            host=host,
            status=_validation("warn", "Backup MySQL account password was reset, but it could not be validated."),
            passwordStatus=password_status,
        )

    login_file, login_path, store_status = _store_login_path(
        context,
        backup_home_path,
        mysql_user,
        password,
    )
    valid = store_status.tone != "warn"

    return MebMysqlBackupUserValidation(
        valid=valid,
        exists=True,
        host=host,
        passwordStored=valid,
        loginFile=login_file,
        loginPath=login_path,
        status=_validation("ok" if valid else "warn", "Backup MySQL account password was reset."),
        passwordStatus=store_status if not valid else password_status,
    )


def _write_backups_config(
    context: Any,
    backup_home_path: str,
    mysql_account: str,
) -> None:
    runtime_helper_path = _install_runtime_helper(context, backup_home_path)
    values = _manager_config_values(context, backup_home_path, mysql_account, runtime_helper_path)
    _write_manager_config(_manager_config_path(backup_home_path), values)


def apply_setup(
    session: Any,
    backup_home_path: str,
    mysql_user: str,
) -> MebSetupState:
    context = create_local_backup_context(session=session)
    backup_home_path = _canonical_path(_clean(backup_home_path) or "")
    mysql_user, preferred_host = _parse_mysql_account(mysql_user, _local_account_host(context))
    mysql_host = _account_host(session, mysql_user, preferred_host)
    if mysql_host is None:
        raise ValueError("Backup MySQL account does not exist.")
    mysql_account = _format_mysql_account(mysql_user, mysql_host)

    home_validation = validate_backup_home(session, backup_home_path)
    if not home_validation.valid:
        raise ValueError(home_validation.status.message)

    _apply_backup_mysql_user_policy(
        session,
        context.target.version_parts,
        mysql_user,
        mysql_host,
    )
    _write_backups_config(context, backup_home_path, mysql_account)

    return get_setup_state(session, backup_home_path)


def _schedule_interval(schedule: Any, maximum: int) -> int:
    try:
        interval = int(str(getattr(schedule, "interval", "1")))
    except (TypeError, ValueError):
        raise ValueError(f"Backup schedule interval must be between 1 and {maximum}.") from None

    if interval < 1 or interval > maximum:
        raise ValueError(f"Backup schedule interval must be between 1 and {maximum}.")

    return interval


def _enabled_schedule_to_cron(schedule: Any) -> dict[str, str] | None:
    if not getattr(schedule, "enabled", False):
        return None

    frequency = getattr(schedule, "frequency", 0)
    minute = str(getattr(schedule, "minute", "0"))
    hour = str(getattr(schedule, "hour", "0"))
    if frequency == 0:
        interval = _schedule_interval(schedule, 23)
        return {
            "minute": minute,
            "hour": "*" if interval == 1 else f"*/{interval}",
            "dayOfMonth": "*",
            "month": "*",
            "dayOfWeek": "*",
        }
    if frequency == 1:
        interval = _schedule_interval(schedule, 31)
        return {
            "minute": minute,
            "hour": hour,
            "dayOfMonth": "*" if interval == 1 else f"*/{interval}",
            "month": "*",
            "dayOfWeek": "*",
        }
    if frequency == 2:
        _schedule_interval(schedule, SCHEDULE_INTERVAL_MAXIMUMS[2])
        week_days = getattr(schedule, "weekDays", [])
        days = [str(index) for index, enabled in enumerate(week_days[:7]) if enabled]
        return {
            "minute": minute,
            "hour": hour,
            "dayOfMonth": "*",
            "month": "*",
            "dayOfWeek": ",".join(days) if days else "*",
        }
    if frequency == 3:
        interval = _schedule_interval(schedule, 12)
        return {
            "minute": minute,
            "hour": hour,
            "dayOfMonth": ",".join(str(day) for day in getattr(schedule, "monthDays", [1])),
            "month": "*" if interval == 1 else f"*/{interval}",
            "dayOfWeek": "*",
        }

    raise ValueError("Unsupported backup schedule frequency.")


def _profile_job_id(profile_uuid: str, backup_mode: str) -> str:
    if backup_mode == "full":
        return f"{profile_uuid}-backup-full"
    if backup_mode == "incremental":
        return f"{profile_uuid}-backup-incremental"

    raise ValueError("Backup mode must be full or incremental.")


def _job_for_profile(profile: Any, backup_mode: str) -> dict[str, Any] | None:
    if not profile.uuid:
        return None
    if backup_mode == "full":
        output_directory = profile.destination
        schedule = _enabled_schedule_to_cron(profile.fullSchedule)
        job: dict[str, Any] = {
            "id": _profile_job_id(profile.uuid, "full"),
            "backupMode": "full",
            "outputDirectory": output_directory,
            "storageType": profile.storageType,
            "defaultsFile": profile.configPath,
        }
    else:
        if not profile.destination or profile.destination == "Not configured":
            return None
        output_directory = profile.destination
        schedule = _enabled_schedule_to_cron(profile.incSchedule)
        job = {
            "id": _profile_job_id(profile.uuid, "incremental"),
            "backupMode": "incremental",
            "outputDirectory": output_directory,
            "storageType": profile.storageType,
            "incrementalBase": profile.incrementalBase,
            "defaultsFile": profile.configPath,
        }

    if not output_directory or not profile.configPath:
        return None
    if schedule is not None:
        job["schedule"] = schedule

    return job


def _profile_jobs(profiles: list[Any], scheduled_only: bool) -> list[dict[str, Any]]:
    jobs: list[dict[str, Any]] = []
    for profile in profiles:
        for backup_mode in ("full", "incremental"):
            job = _job_for_profile(profile, backup_mode)
            if job is not None:
                if scheduled_only and not isinstance(job.get("schedule"), dict):
                    continue
                jobs.append(job)

    return jobs


def _profile_job_ids(profiles: list[Any]) -> set[str]:
    result: set[str] = set()
    for profile in profiles:
        if not profile.uuid:
            continue
        result.add(_profile_job_id(profile.uuid, "full"))
        result.add(_profile_job_id(profile.uuid, "incremental"))

    return result


def _remove_legacy_mysqlbackup_metadata_options(context: Any, profiles: list[Any]) -> None:
    for profile in profiles:
        config_path = getattr(profile, "configPath", None)
        if not config_path:
            continue

        try:
            config = _read_config_text(context.backend.get_file_content(config_path))
        except (OSError, configparser.Error):
            continue

        if not config.has_section("mysqlbackup"):
            continue

        changed = False
        for option in LEGACY_MYSQLBACKUP_METADATA_OPTIONS:
            if config.has_option("mysqlbackup", option):
                config.remove_option("mysqlbackup", option)
                changed = True

        if not changed:
            continue

        if not config.has_section("meb_manager"):
            config.add_section("meb_manager")

        if getattr(profile, "command", None) and not config.has_option("meb_manager", "command"):
            config.set("meb_manager", "command", profile.command)
        if getattr(profile, "mysqlBasedir", None) and not config.has_option("meb_manager", "basedir"):
            config.set("meb_manager", "basedir", profile.mysqlBasedir)

        stream = io.StringIO()
        config.write(stream)
        context.backend.set_file_content(config_path, stream.getvalue())


def _require_scheduler_success(
    result: dict[str, Any],
    successful_statuses: set[str],
    action: str,
    job_id: str,
) -> None:
    if result.get("status") in successful_statuses:
        return

    detail = _clean(result.get("message"))
    if detail and detail.casefold() not in {"failed", "failure"}:
        raise ValueError(f"Could not {action} scheduled backup job '{job_id}': {detail}")

    if result.get("timedOut"):
        raise ValueError(f"Could not {action} scheduled backup job '{job_id}': operation timed out.")

    exit_code = result.get("exitCode")
    if exit_code is not None:
        raise ValueError(
            f"Could not {action} scheduled backup job '{job_id}' (exit code {exit_code})."
        )

    raise ValueError(f"Could not {action} scheduled backup job '{job_id}': unknown scheduler error.")


def _sync_profile_jobs(
    context: Any,
    backup_home_path: str,
    manager_values: dict[str, str],
    status: MebStatus,
    scheduled_only: bool,
    extra_job_ids_to_remove: set[str] | None = None,
) -> bool:
    manager_config_changed = False
    jobs = _profile_jobs(status.profiles, scheduled_only=scheduled_only)
    scheduled_job_ids = {
        job["id"] for job in jobs
        if isinstance(job.get("schedule"), dict)
    }
    for job in jobs:
        job_id = job["id"]
        if isinstance(job.get("schedule"), dict):
            result = _runtime_helper_request(context, backup_home_path, manager_values, "cron.installManagedJob", {
                "jobId": job_id,
                "schedule": job["schedule"],
            })
            _require_scheduler_success(result, {"installed"}, "install", job_id)
            logon_type = result.get("logonType")
            if (
                logon_type in {"InteractiveToken", "S4U"}
                and logon_type != manager_values.get("windows_logon_type")
            ):
                manager_values["windows_logon_type"] = logon_type
                _write_manager_config(_manager_config_path(backup_home_path), manager_values)
                manager_config_changed = True

    job_ids_to_remove = _profile_job_ids(status.profiles)
    if extra_job_ids_to_remove is not None:
        job_ids_to_remove.update(extra_job_ids_to_remove)

    for job_id in sorted(job_ids_to_remove):
        if job_id not in scheduled_job_ids:
            result = _runtime_helper_request(context, backup_home_path, manager_values, "cron.removeManagedJob", {
                "jobId": job_id,
            })
            _require_scheduler_success(result, {"removed", "notFound"}, "remove", job_id)

    return manager_config_changed


def save_profile(
    session: Any,
    backup_home_path: str,
    profile: MebBackupProfile,
) -> MebStatus:
    context = create_local_backup_context(session=session)
    backup_home_path = _canonical_path(_clean(backup_home_path) or "")
    manager_values = _manager_values(backup_home_path)
    os_user = manager_values.get("backup_os_user")
    current_user = get_current_os_user()
    if os_user and current_user and os_user != current_user:
        raise ValueError("This backup home is configured for another OS user. Run Workbench as that user.")

    home_validation = validate_backup_home(session, backup_home_path)
    if not home_validation.valid:
        raise ValueError(home_validation.status.message)

    def path_exists(path: str) -> bool:
        return context.backend.file_exists(path)

    def read_profile_config(path: str) -> str:
        return context.backend.get_file_content(path)

    def write_profile_config(path: str, config: configparser.RawConfigParser) -> None:
        stream = io.StringIO()
        config.write(stream)
        context.backend.set_file_content(path, stream.getvalue())

    if profile.user:
        profile.user = _parse_mysql_account(profile.user, _local_account_host(context))[0]

    manager_values["job_runner"] = _install_runtime_helper(context, backup_home_path)

    _save_profile(
        backup_home_path,
        profile,
        write_profile_config=write_profile_config,
        read_profile_config=read_profile_config,
        path_exists=path_exists,
        create_directory_recursive=context.backend.create_directory_recursive,
        validate_directory=False,
        mysqlbackup_command=manager_values.get("mysqlbackup"),
    )
    state = get_setup_state(session, backup_home_path)
    if state.status is None:
        raise ValueError(state.message or "Unable to refresh MEB status after saving the profile.")

    _remove_legacy_mysqlbackup_metadata_options(context, state.status.profiles)
    manager_config_changed = _sync_profile_jobs(
        context,
        backup_home_path,
        manager_values,
        state.status,
        scheduled_only=True,
    )
    if manager_config_changed:
        state = get_setup_state(session, backup_home_path)
        if state.status is None:
            raise ValueError(state.message or "Unable to refresh MEB status after saving the profile.")

    return state.status


def delete_profile(
    session: Any,
    backup_home_path: str,
    profile_uuid: str,
) -> MebStatus:
    context = create_local_backup_context(session=session)
    backup_home_path = _canonical_path(_clean(backup_home_path) or "")
    manager_values = _manager_values(backup_home_path)
    os_user = manager_values.get("backup_os_user")
    current_user = get_current_os_user()
    if os_user and current_user and os_user != current_user:
        raise ValueError("This backup home is configured for another OS user. Run Workbench as that user.")

    home_validation = validate_backup_home(session, backup_home_path)
    if not home_validation.valid:
        raise ValueError(home_validation.status.message)

    old_profile_job_ids = _profile_job_ids(_read_profiles(backup_home_path))
    manager_values["job_runner"] = _install_runtime_helper(context, backup_home_path)

    _delete_profile(
        backup_home_path,
        profile_uuid,
        delete_profile_config=lambda path: context.backend.delete_file(path),
    )
    state = get_setup_state(session, backup_home_path)
    if state.status is None:
        raise ValueError(state.message or "Unable to refresh MEB status after deleting the profile.")

    manager_config_changed = _sync_profile_jobs(
        context,
        backup_home_path,
        manager_values,
        state.status,
        scheduled_only=True,
        extra_job_ids_to_remove=old_profile_job_ids - _profile_job_ids(state.status.profiles),
    )
    if manager_config_changed:
        state = get_setup_state(session, backup_home_path)
        if state.status is None:
            raise ValueError(state.message or "Unable to refresh MEB status after deleting the profile.")

    return state.status


def _prepare_profile_execution(
    session: Any,
    backup_home_path: str,
    profile_uuid: str,
    backup_mode: str,
) -> tuple[Any, str, dict[str, str], dict[str, str]]:
    context = create_local_backup_context(session=session)
    backup_home_path = _canonical_path(_clean(backup_home_path) or "")
    manager_values = _manager_values(backup_home_path)
    if backup_mode not in {"full", "incremental"}:
        raise ValueError("Backup mode must be full or incremental.")

    manager_values["job_runner"] = _install_runtime_helper(context, backup_home_path)

    state = get_setup_state(session, backup_home_path)
    if state.status is None:
        raise ValueError(state.message or "MEB support is not configured.")

    profile = next((item for item in state.status.profiles if item.uuid == profile_uuid), None)
    if profile is None:
        raise ValueError("Backup profile was not found.")

    _remove_legacy_mysqlbackup_metadata_options(context, state.status.profiles)
    _sync_profile_jobs(context, backup_home_path, manager_values, state.status, scheduled_only=False)

    return context, backup_home_path, manager_values, {
        "backupHome": backup_home_path,
        "jobId": _profile_job_id(profile.uuid, backup_mode),
        "runMode": "manual",
    }


def start_profile_execution(
    session: Any,
    backup_home_path: str,
    profile_uuid: str,
    backup_mode: str,
) -> MebStatus:
    context, backup_home_path, manager_values, request = _prepare_profile_execution(
        session, backup_home_path, profile_uuid, backup_mode,
    )

    errors: list[Exception] = []

    def run_helper() -> None:
        try:
            _runtime_helper_request(context, backup_home_path, manager_values, "jobs.execute", request)
        except Exception as err:
            errors.append(err)
            import traceback

            traceback.print_exc()

    thread = threading.Thread(target=run_helper, name="meb-profile-execution", daemon=True)
    thread.start()

    started_at = time.time()
    while time.time() - started_at < 2:
        refreshed_state = get_setup_state(session, backup_home_path)
        if refreshed_state.status is None:
            raise ValueError(refreshed_state.message or "Unable to refresh MEB status after starting the profile.")
        if refreshed_state.status.recentActivity and refreshed_state.status.recentActivity[0].title.startswith(
            "Backup running",
        ):
            return refreshed_state.status
        if not thread.is_alive():
            break
        time.sleep(0.1)

    if errors:
        raise errors[0]

    refreshed_state = get_setup_state(session, backup_home_path)
    if refreshed_state.status is None:
        raise ValueError(refreshed_state.message or "Unable to refresh MEB status after starting the profile.")

    return refreshed_state.status


def _prepare_activity_operation(
    backup_home_path: str,
    *,
    install_helper: bool = True,
) -> tuple[Any, str, dict[str, str]]:
    context = create_local_backup_context()
    backup_home_path = _clean(backup_home_path)
    if not backup_home_path:
        raise ValueError("Backup home directory is required.")

    backup_home_path = _canonical_path(backup_home_path)
    manager_values = _manager_values(backup_home_path)
    if install_helper:
        manager_values["job_runner"] = _install_runtime_helper(context, backup_home_path)

    return context, backup_home_path, manager_values


def _run_activity_backup_operation(
    backup_home_path: str,
    activity_id: str,
    operation: str,
    resolved_activity: ResolvedActivity | None = None,
) -> MebStatus:
    context, backup_home_path, manager_values = _prepare_activity_operation(backup_home_path)

    profiles = _read_profiles(backup_home_path)

    resolved = resolved_activity or resolve_activity(backup_home_path, activity_id, profiles)
    backup_id = resolved.require_backup_id()
    params = {
        "backupHome": backup_home_path,
        "backupId": backup_id,
    }
    if operation == "backups.delete":
        params["logId"] = os.path.basename(resolved.log_path)
    result = _runtime_helper_request(context, backup_home_path, manager_values, operation, params)
    if operation == "backups.delete" and result.get("status") != "deleted":
        raise ValueError("Backup could not be deleted.")
    if operation == "backups.verify" and result.get("status") != "verified":
        raise ValueError("Backup verification failed.")
    if operation == "backups.applyLog" and result.get("status") != "applied":
        raise ValueError("Applying backup logs failed.")

    return build_status(backup_home_path, manager_values, _read_profiles(backup_home_path))


def delete_activity_backup(
    backup_home_path: str,
    activity_id: str,
) -> MebStatus:
    context = create_local_backup_context()
    backup_home_path = _canonical_path(_clean(backup_home_path) or "")
    profiles = _read_profiles(backup_home_path)
    resolved = resolve_activity(backup_home_path, activity_id, profiles)
    log_id = os.path.basename(resolved.log_path)
    expected_log_path = _canonical_path(os.path.join(backup_home_path, JOB_LOG_DIR_NAME, log_id))

    is_backup_activity = resolved.activity_type in {"Full Backup", "Incremental Backup"}
    if resolved.log_path == expected_log_path and not is_backup_activity:
        manager_values = _manager_values(backup_home_path)
        manager_values["job_runner"] = _install_runtime_helper(context, backup_home_path)
        result = _runtime_helper_request(context, backup_home_path, manager_values, "backups.delete", {
            "backupHome": backup_home_path,
            "logId": log_id,
        })
        if result.get("status") != "deleted":
            raise ValueError("Activity entry could not be deleted.")

        return build_status(backup_home_path, manager_values, _read_profiles(backup_home_path))

    backup_id = resolved.require_backup_id()
    try:
        dependent_backups = _dependent_incremental_backups(backup_home_path, backup_id)
    except _BackupMetadataNotFoundError:
        # A failed backup may leave its directory before writing metadata and cannot be
        # a valid incremental base. Otherwise, dependencies cannot be checked safely.
        if resolved.read_log_status().status != "Failed":
            raise

        dependent_backups = []

    if dependent_backups:
        dependent_labels = ", ".join(os.path.basename(path) for path in dependent_backups)
        raise ValueError(
            "Cannot delete this backup because incremental backups depend on it: %s" % dependent_labels
        )

    return _run_activity_backup_operation(
        backup_home_path,
        activity_id,
        "backups.delete",
        resolved,
    )


def verify_activity_backup(
    backup_home_path: str,
    activity_id: str,
) -> MebLogContent:
    context, backup_home_path, manager_values = _prepare_activity_operation(backup_home_path)

    resolved = resolve_activity(backup_home_path, activity_id, _read_profiles(backup_home_path))
    backup_id = resolved.require_backup_id()
    warnings: list[str] = []
    try:
        _restore_chain_for_backup(backup_home_path, backup_id)
    except ValueError as err:
        warnings.append("The restore chain could not be resolved: %s" % err)
    result = _runtime_helper_request(context, backup_home_path, manager_values, "backups.verify", {
        "backupHome": backup_home_path,
        "backupId": backup_id,
    })
    output = str(result.get("output") or "")
    if not output:
        output = "Backup verification completed successfully." if result.get("status") == "verified" else \
            "Backup verification failed."

    return MebLogContent(
        activityId=activity_id,
        displayName="Backup verification output",
        content=output,
        warnings=warnings,
    )


def apply_activity_backup_logs(backup_home_path: str, activity_id: str) -> MebStatus:
    return _run_activity_backup_operation(backup_home_path, activity_id, "backups.applyLog")


def restore_activity_backup(
    backup_home_path: str,
    activity_id: str,
    operation_id: str,
    force: bool = False,
) -> MebRestoreResult:
    context, backup_home_path, manager_values = _prepare_activity_operation(backup_home_path)

    profiles = _read_profiles(backup_home_path)

    resolved = resolve_activity(backup_home_path, activity_id, profiles)
    backup_id = resolved.require_backup_id()
    if resolved.activity_type == "Incremental Backup":
        try:
            _restore_chain_for_backup(backup_home_path, backup_id)
        except ValueError as err:
            return MebRestoreResult(
                succeeded=False,
                message="Cannot restore incremental backup because its restore chain is incomplete.",
                output=str(err),
            )
    params = {
        "backupHome": backup_home_path,
        "backupId": backup_id,
        "operationId": operation_id,
        "force": bool(force),
    }
    if resolved.profile_id is not None:
        params["profileId"] = resolved.profile_id
    result = _runtime_helper_request(context, backup_home_path, manager_values, "backups.restore", params)
    if result.get("status") != "restored":
        output = result.get("output")
        if not isinstance(output, str):
            output = ""

        aborted = result.get("status") == "aborted"
        return MebRestoreResult(
            succeeded=False,
            aborted=aborted,
            message=(
                "MySQL Enterprise Backup restore was aborted."
                if aborted else "MySQL Enterprise Backup restore failed."
            ),
            output=output,
        )

    return MebRestoreResult(succeeded=True, status=build_status(backup_home_path, manager_values, _read_profiles(backup_home_path)))


def _activity_restore_progress_request(
    backup_home_path: str,
    operation_id: str,
    operation: str,
) -> MebRestoreProgress:
    context, backup_home_path, manager_values = _prepare_activity_operation(
        backup_home_path,
        install_helper=False,
    )
    result = _runtime_helper_request(context, backup_home_path, manager_values, operation, {
        "backupHome": backup_home_path,
        "operationId": operation_id,
    })

    return MebRestoreProgress(
        state=str(result.get("state") or "starting"),
        operationId=str(result.get("operationId") or operation_id),
        output=str(result.get("output") or ""),
    )


def get_activity_restore_progress(
    backup_home_path: str,
    operation_id: str,
) -> MebRestoreProgress:
    return _activity_restore_progress_request(
        backup_home_path, operation_id, "backups.restore.progress",
    )


def abort_activity_backup_restore(
    backup_home_path: str,
    operation_id: str,
) -> MebRestoreProgress:
    return _activity_restore_progress_request(
        backup_home_path, operation_id, "backups.restore.abort",
    )


def _split_manifest_table_name(name: str) -> tuple[str, str] | None:
    match = re.fullmatch(r"(`(?:``|[^`])+`)\.(`(?:``|[^`])+`)", name)
    if match is None:
        return None

    return (
        mysqlsh.mysql.unquote_identifier(match.group(1)),
        mysqlsh.mysql.unquote_identifier(match.group(2)),
    )


def _include_manifest_schema(backup_content: Any, schema_definition: Any) -> None:
    if not isinstance(schema_definition, dict):
        return

    table_definition = schema_definition.get("table")

    def include_table(table: Any) -> None:
        if not isinstance(table, dict) or not isinstance(table.get("name"), str):
            return

        table_name = _split_manifest_table_name(table["name"])
        if table_name is None:
            return

        schema, name = table_name
        backup_content.include_table(schema, name, True, str(table.get("engine", "Unknown")))

    if isinstance(table_definition, list):
        for table in table_definition:
            include_table(table)
    else:
        include_table(table_definition)


def _load_manifest_content(backup_content: Any, manifest: Any) -> None:
    if not isinstance(manifest, dict):
        return

    definitions = manifest.get("backup_content", {}).get("definitions", {})
    if not isinstance(definitions, dict):
        return

    database_definition = definitions.get("database")
    if isinstance(database_definition, list):
        for schema_definition in database_definition:
            _include_manifest_schema(backup_content, schema_definition)
    else:
        _include_manifest_schema(backup_content, database_definition)


def _manifest_file_path(file_definition: dict[str, Any]) -> str | None:
    for key in ("path", "name", "file", "filename"):
        value = file_definition.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    return None


def _collect_manifest_files(value: Any, parent_key: str = "") -> list[str]:
    files: list[str] = []
    if isinstance(value, list):
        for item in value:
            files.extend(_collect_manifest_files(item, parent_key))
        return files

    if not isinstance(value, dict):
        return files

    if parent_key in {"file", "data_file", "log_file", "metadata_file"}:
        file_path = _manifest_file_path(value)
        if file_path is not None:
            files.append(file_path)

    for key, child in value.items():
        files.extend(_collect_manifest_files(child, key))

    return files


def _backup_file_group_category(file_path: str) -> tuple[str, str]:
    normalized = file_path.replace("\\", "/").lower()
    basename = os.path.basename(normalized)
    if normalized.startswith("meta/") or "/meta/" in normalized:
        return "Backup metadata", "Manifest, variables, and metadata files written by MEB."
    if (
        basename.startswith(("ib_logfile", "#innodb_redo"))
        or normalized.startswith("#innodb_redo/")
        or "/#innodb_redo/" in normalized
    ):
        return "Redo log files", "Redo log files included with the backup."
    if basename.startswith(("undo_", "#innodb_temp")) or "/undo" in normalized:
        return "Undo/temp files", "Undo or temporary InnoDB files included with the backup."
    if basename.endswith((".ibd", ".isl", ".cfg", ".sdi", ".frm", ".myd", ".myi")) or basename == "ibdata1":
        return "Data files", "Tablespace and table data files included in the backup."
    if "binlog" in basename or "relay-log" in basename:
        return "Binary and relay logs", "Binary or relay log files included with the backup."

    return "Other files", "Additional files included in the backup image."


def _manifest_file_groups(manifest: Any) -> list[MebBackupFileGroup]:
    if not isinstance(manifest, dict):
        return []

    grouped: dict[str, dict[str, Any]] = {}
    for file_path in sorted(set(_collect_manifest_files(manifest))):
        category, description = _backup_file_group_category(file_path)
        group = grouped.setdefault(category, {
            "description": description,
            "files": [],
        })
        group["files"].append(file_path)

    return [
        MebBackupFileGroup(
            category=category,
            fileCount=len(values["files"]),
            description=str(values["description"]),
            sample=str(values["files"][0]),
            files=[str(file_path) for file_path in values["files"]],
        )
        for category, values in sorted(grouped.items())
    ]


SYSTEM_BACKUP_SCHEMAS = {"INFORMATION_SCHEMA", "MYSQL", "PERFORMANCE_SCHEMA", "SYS"}


def _backup_content_row_scope(schema: str) -> str:
    return "System" if schema.upper() in SYSTEM_BACKUP_SCHEMAS else "User"


def _backup_content_coverage(schema: str, table_data: dict[str, Any]) -> str:
    if _backup_content_row_scope(schema) == "System":
        return "System metadata listed" if bool(table_data.get("include")) else "Current system object"

    return "Logical table definition" if bool(table_data.get("include")) else "Current instance only"


def _backup_content_action(schema: str, table_data: dict[str, Any]) -> str:
    if _backup_content_row_scope(schema) == "System":
        return "Not evaluated at table level"

    in_backup = bool(table_data.get("include"))
    in_instance = bool(table_data.get("on_db"))
    if in_instance and in_backup:
        return "Table will be updated"
    if in_instance:
        if str(table_data.get("engine", "")).upper() == "INNODB":
            return "Table will be deleted"

        return "Table will not be affected"
    if in_backup:
        return "Will be created"

    return ""


def _backup_content_rows(backup_content: Any) -> list[MebBackupContentRow]:
    rows: list[MebBackupContentRow] = []
    for schema in backup_content._sorted_schemas:
        schema_data = backup_content._schema_data[schema]
        for table in schema_data["sorted_tables"]:
            table_data = schema_data["tables"][table]
            rows.append(MebBackupContentRow(
                schema=schema,
                table=table,
                engine=str(table_data.get("engine", "")),
                scope=_backup_content_row_scope(schema),
                coverage=_backup_content_coverage(schema, table_data),
                inBackup=bool(table_data.get("include")),
                inInstance=bool(table_data.get("on_db")),
                action=_backup_content_action(schema, table_data),
            ))

    return rows


def _backup_create_mysql_version(content: str) -> str | None:
    try:
        doc = parseString(content)
    except Exception:
        return None

    elements = doc.getElementsByTagName("mysql-version")
    for element in elements:
        if element.firstChild is not None and element.firstChild.nodeValue:
            return element.firstChild.nodeValue.strip() or None

    for server_info in doc.getElementsByTagName("server_info"):
        for child in server_info.childNodes:
            if child.nodeName == "version" and child.firstChild is not None and child.firstChild.nodeValue:
                return child.firstChild.nodeValue.strip() or None

    return None


def _read_optional_backup_file(context: Any, path: str) -> str | None:
    try:
        return context.backend.get_file_content(path).strip()
    except Exception:
        return None


def _backup_content_scope(metadata: dict[str, str]) -> str | None:
    is_partial = metadata.get("is_partial")
    if is_partial == "1":
        return "Partial"
    if is_partial == "0":
        return "Full"

    return None


def _backup_restore_chain_timestamp(variables_content: str | None, backup_path: str) -> str | None:
    if variables_content is not None:
        parser = configparser.RawConfigParser()
        try:
            parser.read_file(io.StringIO(variables_content))
            start_time_utc = parser.get("backup_variables", "start_time_utc")
            timestamp = datetime.fromtimestamp(int(start_time_utc) / 1_000_000, timezone.utc)
            return timestamp.strftime("%Y-%m-%d %H:%M:%S UTC")
        except (configparser.Error, OSError, OverflowError, TypeError, ValueError):
            pass

    name = os.path.basename(backup_path)
    for timestamp_format in ("%Y-%m-%d_%H-%M-%S", "%Y-%m-%d_%H%M%S"):
        try:
            return datetime.strptime(name, timestamp_format).strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue

    return None


def _backup_restore_chain_type(variables_content: str | None) -> str | None:
    if variables_content is None:
        return None

    parser = configparser.RawConfigParser()
    try:
        parser.read_file(io.StringIO(variables_content))
        is_incremental = parser.get("backup_variables", "is_incremental")
    except configparser.Error:
        return None

    if is_incremental == "0":
        return "Full"
    if is_incremental == "1":
        return "Incremental"

    return None


def _backup_restore_chain_entries(context: Any, backup_paths: list[str]) -> list[MebBackupRestoreChainEntry]:
    entries: list[MebBackupRestoreChainEntry] = []
    for backup_path in backup_paths:
        variables_path = context.target.join_path(backup_path, "meta", "backup_variables.txt")
        variables_content = _read_optional_backup_file(context, variables_path)
        entries.append(MebBackupRestoreChainEntry(
            name=os.path.basename(backup_path),
            type=_backup_restore_chain_type(variables_content),
            timestamp=_backup_restore_chain_timestamp(variables_content, backup_path),
        ))

    return entries


def read_activity_backup_content(
    session: Any | None,
    backup_home_path: str,
    activity_id: str,
) -> MebBackupContent:
    from .backup_entry import BackupEntry
    from .content import BackupContent

    context = create_local_backup_context(session=session)
    backup_home_path = _clean(backup_home_path)
    if not backup_home_path:
        raise ValueError("Backup home directory is required.")
    backup_home_path = _canonical_path(backup_home_path)

    if session is None:
        profiles = _read_profiles(backup_home_path)
    else:
        state = get_setup_state(session, backup_home_path)
        if state.status is None:
            raise ValueError(state.message or "MEB support is not configured.")
        profiles = state.status.profiles

    resolved = resolve_activity(backup_home_path, activity_id, profiles)
    backup_id = resolved.require_backup_id()
    backup_path = os.path.join(backup_home_path, *backup_id.split("/"))
    warnings: list[str] = []
    try:
        restore_chain = _backup_restore_chain_entries(
            context,
            list(reversed(_restore_chain_for_backup(backup_home_path, backup_id))),
        )
    except ValueError as err:
        partial_chain = getattr(err, "partial_chain", [backup_path])
        restore_chain = _backup_restore_chain_entries(context, list(reversed(partial_chain)))
        if getattr(err, "missing_predecessor", False):
            restore_chain.append(MebBackupRestoreChainEntry(name="Previous backup not found"))
        warnings.append("Restore chain could not be determined: %s" % err)
    manifest_path = context.target.join_path(backup_path, "meta", "backup_content.xml")
    variables_path = context.target.join_path(backup_path, "meta", "backup_variables.txt")
    create_manifest_path = context.target.join_path(backup_path, "meta", "backup_create.xml")
    backup_entry = BackupEntry(context, backup_path, resolved.log_path)
    variables_content = _read_optional_backup_file(context, variables_path)
    if variables_content is not None:
        backup_entry.process_variables_txt(variables_content)
    try:
        manifest_content = context.backend.get_file_content(manifest_path).strip()
        backup_entry.process_contents(manifest_content)
    except Exception as err:
        raise ValueError("Backup contents info could not be read: %s" % err) from err
    try:
        backup_entry.process_metadata(manifest_content)
    except Exception:
        pass

    backup_content = BackupContent(context, True)
    has_instance_data = False
    if context.has_connection:
        try:
            backup_content.load_db_data()
            has_instance_data = True
        except Exception as err:
            warnings.append("Current instance content could not be read: %s" % err)

    _load_manifest_content(backup_content, backup_entry.manifest)
    create_manifest_content = _read_optional_backup_file(context, create_manifest_path)

    return MebBackupContent(
        backupHome=backup_home_path,
        activityId=activity_id,
        backupLabel=os.path.basename(backup_id),
        backupScope=_backup_content_scope(backup_entry.metadata),
        applyLogDone=backup_entry.apply_log_done,
        hasInstanceData=has_instance_data,
        mysqlVersion=(
            backup_entry.metadata.get("mysql_version")
            or (_backup_create_mysql_version(create_manifest_content) if create_manifest_content is not None else None)
        ),
        gtidExecuted=backup_entry.other_metadata.get("gtid_executed"),
        startTime=backup_entry.other_metadata.get("start_time"),
        endTime=backup_entry.other_metadata.get("end_time"),
        binlogFile=backup_entry.other_metadata.get("binlog_file"),
        binlogPosition=backup_entry.other_metadata.get("binlog_pos"),
        restoreChain=restore_chain,
        fileGroups=_manifest_file_groups(backup_entry.manifest),
        rows=_backup_content_rows(backup_content),
        warnings=warnings,
    )


def get_setup_state(
    session: Any,
    backup_home_path: str | None = None,
) -> MebSetupState:
    context = create_local_backup_context(session=session)
    backup_home_path = _clean(backup_home_path)
    mysqlbackup_path = _default_mysqlbackup_path(context)
    mysqlbackup_exists, _ = _mysqlbackup_status(mysqlbackup_path)
    datadir_owner = get_path_owner(context.target.datadir)
    datadir_group = get_path_group(context.target.datadir)
    mysql_edition = None
    try:
        mysql_edition = _query_scalar(session, "SELECT @@version_comment", [])
    except Exception:
        mysql_edition = None

    base_state = {
        "localSupported": True,
        "mysqlbackupPath": mysqlbackup_path,
        "mysqlbackupExists": mysqlbackup_exists,
        "datadir": context.target.datadir,
        "datadirOwner": datadir_owner,
        "datadirGroup": datadir_group,
        "currentOsUser": get_current_os_user(),
        "platform": sys.platform,
        "mysqlVersion": context.target.version or None,
        "mysqlEdition": mysql_edition,
        "mysqlBasedir": context.target.basedir or None,
        "schedulerName": _scheduler_name(context.target.is_windows),
    }

    if not backup_home_path:
        return MebSetupState(
            **base_state,
            message="MEB support is not configured for this connection.",
            messageTone="info",
        )

    backup_home_path = _canonical_path(backup_home_path)
    if not os.path.isdir(backup_home_path):
        return MebSetupState(
            **base_state,
            backupHomePath=backup_home_path,
            message="Configured backup home directory was not found.",
            messageTone="warn",
        )

    manager_path = _manager_config_path(backup_home_path)
    backup_home_owner = get_path_owner(backup_home_path)
    try:
        manager_exists = context.backend.file_exists(manager_path)
    except Exception:
        return MebSetupState(
            **base_state,
            backupHomePath=backup_home_path,
            backupOsUser=backup_home_owner,
            runtimeHelperPath=_runtime_helper_source_path(context),
            message="Unable to inspect the configured backup home as the current OS user.",
            messageTone="warn",
        )

    if not manager_exists:
        return MebSetupState(
            **base_state,
            backupHomePath=backup_home_path,
            message="Backup home does not contain backups.cnf.",
            messageTone="warn",
        )

    try:
        manager_values = _manager_values(backup_home_path)
    except Exception:
        return MebSetupState(
            **base_state,
            backupHomePath=backup_home_path,
            backupOsUser=backup_home_owner,
            runtimeHelperPath=_runtime_helper_source_path(context),
            message="Unable to read backups.cnf as the current OS user.",
            messageTone="warn",
        )

    os_user = manager_values.get("backup_os_user") or backup_home_owner
    current_user = get_current_os_user()
    if os_user and current_user and os_user != current_user:
        return MebSetupState(
            **base_state,
            backupHomePath=backup_home_path,
            backupOsUser=os_user,
            runtimeHelperPath=_runtime_helper_source_path(context),
            mysqlBackupUser=manager_values.get("backup_mysql_user") or DEFAULT_MYSQL_BACKUP_ACCOUNT,
            loginFile=manager_values.get("login_file"),
            loginPath=manager_values.get("login_path"),
            message="Backup home is configured for another OS user. This version requires direct current-user access.",
            messageTone="warn",
        )

    mysql_user = manager_values.get("backup_mysql_user") or DEFAULT_MYSQL_BACKUP_ACCOUNT
    runtime_helper_path = _runtime_helper_source_path(context)
    home_validation = validate_backup_home(session, backup_home_path)
    if not home_validation.valid:
        return MebSetupState(
            **base_state,
            backupHomePath=backup_home_path,
            backupOsUser=os_user,
            runtimeHelperPath=runtime_helper_path,
            mysqlBackupUser=mysql_user,
            loginFile=manager_values.get("login_file"),
            loginPath=manager_values.get("login_path"),
            message=home_validation.status.message,
            messageTone="warn",
        )

    configured_datadir = manager_values.get("datadir")
    if configured_datadir and not _same_path(configured_datadir, context.target.datadir):
        return MebSetupState(
            **base_state,
            backupHomePath=backup_home_path,
            backupOsUser=os_user,
            runtimeHelperPath=runtime_helper_path,
            mysqlBackupUser=mysql_user,
            loginFile=manager_values.get("login_file"),
            loginPath=manager_values.get("login_path"),
            message="Backup home is configured for another MySQL data directory.",
            messageTone="warn",
        )

    helper_status = _run_runtime_helper_self_test(
        context,
        runtime_helper_path,
        backup_home_path,
        require_config=True,
    )
    if helper_status.tone == "warn":
        return MebSetupState(
            **base_state,
            backupHomePath=backup_home_path,
            backupOsUser=os_user,
            runtimeHelperPath=runtime_helper_path,
            mysqlBackupUser=mysql_user,
            loginFile=manager_values.get("login_file"),
            loginPath=manager_values.get("login_path"),
            message=helper_status.message,
            messageTone="warn",
        )

    profiles = _read_profiles(backup_home_path)
    status = build_status(backup_home_path, manager_values, profiles)
    return MebSetupState(
        **base_state,
        configured=True,
        needsSetup=False,
        backupHomePath=backup_home_path,
        backupOsUser=os_user,
        runtimeHelperPath=runtime_helper_path,
        mysqlBackupUser=mysql_user,
        loginFile=manager_values.get("login_file"),
        loginPath=manager_values.get("login_path"),
        message="MEB support is configured.",
        messageTone="ok",
        status=status,
    )
