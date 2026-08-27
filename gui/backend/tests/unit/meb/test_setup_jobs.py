# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.

from __future__ import annotations

import configparser
from contextlib import contextmanager
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
import types
import unittest
from pathlib import Path
from typing import Any, Callable
from unittest import mock


MEB_ROOT = Path(__file__).resolve().parents[3] / "gui_plugin" / "meb"
GUI_PLUGIN_ROOT = MEB_ROOT.parent
CORE_ROOT = GUI_PLUGIN_ROOT / "core"
DBMS_ROOT = CORE_ROOT / "dbms"

gui_plugin_package = types.ModuleType("gui_plugin")
gui_plugin_package.__path__ = [GUI_PLUGIN_ROOT.as_posix()]  # type: ignore[attr-defined]
meb_package = types.ModuleType("gui_plugin.meb")
meb_package.__path__ = [MEB_ROOT.as_posix()]  # type: ignore[attr-defined]
core_package = types.ModuleType("gui_plugin.core")
core_package.__path__ = [CORE_ROOT.as_posix()]  # type: ignore[attr-defined]
dbms_package = types.ModuleType("gui_plugin.core.dbms")
dbms_package.__path__ = [DBMS_ROOT.as_posix()]  # type: ignore[attr-defined]
core_lib_package = types.ModuleType("gui_plugin.core.lib")
core_lib_package.__path__ = [(CORE_ROOT / "lib").as_posix()]  # type: ignore[attr-defined]
system_utils_module = types.ModuleType("gui_plugin.core.lib.SystemUtils")
system_utils_module.get_mysqlsh_install_path = lambda: ""  # type: ignore[attr-defined]
mysqlsh_module = types.ModuleType("mysqlsh")
mysqlsh_module.DBError = RuntimeError  # type: ignore[attr-defined]
mysqlsh_module.mysql = types.SimpleNamespace(  # type: ignore[attr-defined]
    unquote_identifier=lambda value: value[1:-1].replace("``", "`"),
)
mysqlsh_plugin_manager_module = types.ModuleType("mysqlsh.plugin_manager")
mysqlsh_plugin_manager_module.plugin_function = lambda *args, **kwargs: (  # type: ignore[attr-defined]
    lambda function: function
)

sys.modules.setdefault("gui_plugin", gui_plugin_package)
sys.modules.setdefault("gui_plugin.meb", meb_package)
sys.modules.setdefault("gui_plugin.core", core_package)
sys.modules.setdefault("gui_plugin.core.dbms", dbms_package)
sys.modules.setdefault("gui_plugin.core.lib", core_lib_package)
sys.modules.setdefault("gui_plugin.core.lib.SystemUtils", system_utils_module)
sys.modules.setdefault("mysqlsh", mysqlsh_module)
sys.modules.setdefault("mysqlsh.plugin_manager", mysqlsh_plugin_manager_module)

context_module = types.ModuleType("gui_plugin.meb.context")
context_module.create_local_backup_context = lambda _session: None  # type: ignore[attr-defined]
sys.modules.setdefault("gui_plugin.meb.context", context_module)


def load_meb_module(name: str) -> types.ModuleType:
    module_name = f"gui_plugin.meb.{name}"
    spec = importlib.util.spec_from_file_location(module_name, MEB_ROOT / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)

    return module


def load_dbms_module(name: str) -> types.ModuleType:
    module_name = f"gui_plugin.core.dbms.{name}"
    spec = importlib.util.spec_from_file_location(module_name, DBMS_ROOT / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)

    return module


models = load_meb_module("models")
target_module = load_meb_module("target")
load_meb_module("os_utils")
backend_controller = load_meb_module("backend_controller")
backup_home = load_meb_module("backup_home")
load_dbms_module("MySQLUserManagement")
load_meb_module("grant_policy")
setup = load_meb_module("setup")


def resolve_activity_for_test(
    backup_home_path: str,
    activity_id: str,
    profiles: list[object],
) -> object:
    del profiles
    prefix = "activity:v1:"
    if not activity_id.startswith(prefix):
        raise ValueError("Invalid activity identifier")

    log_path = os.path.join(backup_home_path, *activity_id[len(prefix):].split("/"))
    if "20260618T120000Z" in activity_id:
        backup_id = "nightly/2026-06-18_12-00-00"
    elif "full" in activity_id:
        backup_id = "nightly/backup-1"
    else:
        backup_id = None
    if "full" in activity_id:
        activity_type = "Full Backup"
    elif "verify" in activity_id:
        activity_type = "Verify"
    else:
        activity_type = "Restore"

    return setup.ResolvedActivity(
        activity_id=activity_id,
        log_path=log_path,
        backup_id=backup_id,
        profile_id="profile-1" if "profile-1" in activity_id else None,
        activity_type=activity_type,
    )


setup.resolve_activity = resolve_activity_for_test


def resolved_activity(
    activity_id: str,
    log_path: str,
    backup_id: str | None,
    profile_id: str | None = "profile-1",
    activity_type: str | None = "Full Backup",
) -> object:
    return setup.ResolvedActivity(
        activity_id=activity_id,
        log_path=log_path,
        backup_id=backup_id,
        profile_id=profile_id,
        activity_type=activity_type,
    )


@contextmanager
def patched_setup(**replacements: object):
    originals = {name: getattr(setup, name) for name in replacements}
    try:
        for name, replacement in replacements.items():
            setattr(setup, name, replacement)
        yield
    finally:
        for name, original in originals.items():
            setattr(setup, name, original)


@contextmanager
def activity_setup(
    context: FakeContext,
    calls: list[object],
    profile: MebBackupProfileInfo | None = None,
    refreshed_status: MebStatus | None = None,
    **replacements: object,
):
    replacements = {
        "create_local_backup_context": lambda: context,
        "_manager_values": lambda _backup_home_path: {},
        "_install_runtime_helper": (
            lambda _context, _backup_home_path:
                calls.append("install") or "/backup-home/task-helper"
        ),
        "_read_profiles": lambda _backup_home_path: [profile] if profile else [],
        **replacements,
    }
    if refreshed_status is not None:
        replacements["build_status"] = (
            lambda _backup_home_path, _manager_values, _profiles: refreshed_status
        )

    with patched_setup(**replacements):
        yield


MebBackupProfileInfo = models.MebBackupProfileInfo
MebBackupHomeValidation = models.MebBackupHomeValidation
MebBackupProfile = models.MebBackupProfile
MebSetupState = models.MebSetupState
MebStatus = models.MebStatus
MebProfileSchedule = models.MebProfileSchedule
WINDOWS_CONFIG_EDITOR_TERMINAL_OUTPUT = (
    "\x1b[?9001h\x1b[?1004h\x1b[?25l"
    "\x1b[?9001l\x1b[?1004l\x1b[2J\x1b[m\x1b[H"
    "\x1b]0;C:\\mysql\\bin\\mysql_config_editor.exe\x07"
    "\x1b[?25h"
)
_install_runtime_helper = setup._install_runtime_helper
_manager_values = setup._manager_values
_profile_jobs = setup._profile_jobs
_remove_legacy_mysqlbackup_metadata_options = setup._remove_legacy_mysqlbackup_metadata_options
_runtime_helper_request = setup._runtime_helper_request
_delete_profile = setup._delete_profile
_read_profiles = setup._read_profiles
_save_profile = setup._save_profile
_sync_profile_jobs = setup._sync_profile_jobs
create_local_backup_context = setup.create_local_backup_context
get_setup_state = setup.get_setup_state
delete_profile = setup.delete_profile
save_profile = setup.save_profile
start_profile_execution = setup.start_profile_execution
validate_backup_home = setup.validate_backup_home


def daily_schedule(hour: str, minute: str, interval: str = "1") -> MebProfileSchedule:
    return MebProfileSchedule(
        enabled=True,
        interval=int(interval),
        frequency=1,
        hour=int(hour),
        minute=int(minute),
    )


def hourly_schedule(minute: str, interval: str = "1") -> MebProfileSchedule:
    return MebProfileSchedule(
        enabled=True,
        interval=int(interval),
        frequency=0,
        minute=int(minute),
    )


def monthly_schedule(hour: str, minute: str, month_days: str) -> MebProfileSchedule:
    return MebProfileSchedule(
        enabled=True,
        frequency=3,
        monthDays=[int(day) for day in month_days.split(",")],
        hour=int(hour),
        minute=int(minute),
    )


class FakeContext:
    pass


class FakeBackend:
    def __init__(self, files: dict[str, str]) -> None:
        self.files = files

    def get_file_content(self, path: str) -> str:
        return self.files[path]

    def set_file_content(self, path: str, content: str) -> None:
        self.files[path] = content


class FakeTarget:
    is_windows = False
    basedir = "/mysql"
    datadir = "/mysql/data"
    port = 3306
    skip_name_resolve = "OFF"
    socket = None
    version = "9.0.0"
    version_parts = (9, 0, 0)

    def join_path(self, *parts: str) -> str:
        return os.path.join(*parts)


class FakeResult:
    def __init__(self, row: list[str] | None) -> None:
        self.row = row

    def fetch_one(self) -> list[str] | None:
        return self.row


class FakeSession:
    def run_sql(self, _sql: str, _params: list[object] | None = None) -> FakeResult:
        return FakeResult(["localhost"])


class MebSetupJobTests(unittest.TestCase):
    def test_account_host_lookup_uses_exact_account(self) -> None:
        calls: list[tuple[str, list[object]]] = []

        class Session:
            def run_sql(self, sql: str, params: list[object]) -> FakeResult:
                calls.append((sql, params))

                return FakeResult(None)

        self.assertIsNone(setup._account_host(Session(), "mysqlbackup", "localhost"))
        sql, params = calls[0]
        self.assertIn("WHERE User = ? AND Host = ?", sql)
        self.assertEqual(params, ["mysqlbackup", "localhost"])

    def test_runtime_helper_path_uses_workbench_helper_directory(self) -> None:
        context = FakeContext()
        context.target = FakeTarget()
        original_product_helper_dir = setup._product_helper_dir
        try:
            setup._product_helper_dir = lambda _context: "/workbench/Helpers"

            helper_path = setup._runtime_helper_source_path(context)
        finally:
            setup._product_helper_dir = original_product_helper_dir

        self.assertEqual(helper_path, "/workbench/Helpers/task-helper")

    def test_runtime_helper_path_uses_workbench_windows_entrypoint(self) -> None:
        context = FakeContext()
        context.target = FakeTarget()
        context.target.is_windows = True
        original_product_helper_dir = setup._product_helper_dir
        try:
            setup._product_helper_dir = lambda _context: "C:/Workbench/Helpers"

            helper_path = setup._runtime_helper_source_path(context)
        finally:
            setup._product_helper_dir = original_product_helper_dir

        self.assertEqual(helper_path, "C:/Workbench/Helpers/task-helper.cmd")

    def test_runtime_helper_request_selects_backup_home(self) -> None:
        calls: list[tuple[list[str], dict[str, Any]]] = []

        class RequestBackend:
            def execute_argv_with_input(
                self,
                command: list[str],
                input_text: str,
                output_handler: Callable[[str], Any],
                env: dict[str, str] | None = None,
                timeout: float | None = None,
            ) -> int:
                del env, timeout
                calls.append((command, json.loads(input_text)))
                output_handler(json.dumps({"ok": True, "result": {}}))

                return 0

        context = FakeContext()
        context.target = FakeTarget()
        context.backend = RequestBackend()

        with patched_setup(
            _runtime_helper_source_path=lambda _context: "/workbench new/helpers/task-helper",
        ):
            setup._runtime_helper_request(
                context,
                "/backup home",
                {},
                "cron.removeManagedJob",
                {"jobId": "nightly"},
            )

        self.assertEqual(calls[0][0], ["/workbench new/helpers/task-helper"])
        self.assertEqual(calls[0][1]["backupHome"], "/backup home")

    def test_windows_backup_home_validation_stops_when_ascii_path_is_unavailable(self) -> None:
        class WindowsBackend:
            def listdir(self, _path: str) -> list[str]:
                raise AssertionError("Backup home contents must not be inspected.")

            def check_dir_writable(self, _path: str) -> bool:
                raise AssertionError("Backup home writability must not be inspected.")

        context = FakeContext()
        context.target = FakeTarget()
        context.target.is_windows = True
        context.backend = WindowsBackend()

        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "テスト"
            backup_home.mkdir()

            with (
                patched_setup(
                    create_local_backup_context=lambda session: context,
                    get_current_os_user=lambda: "lroot",
                    get_path_owner=lambda path: self.fail("Backup home owner must not be inspected."),
                    _backup_home_permissions_status=(
                        lambda path, is_windows: self.fail("Backup home permissions must not be inspected.")
                    ),
                    _backup_home_reuse_status=(
                        lambda path, datadir: self.fail("Backup home reuse must not be inspected.")
                    ),
                ),
                mock.patch.object(
                    setup,
                    "windows_ascii_directory_path",
                    side_effect=OSError("short path unavailable"),
                    create=True,
                ),
            ):
                result = setup.validate_backup_home(object(), backup_home.as_posix())

        self.assertFalse(result.valid)
        self.assertIn("ASCII short path", result.status.message)

    def test_runtime_helper_self_test_preserves_windows_argv(self) -> None:
        calls: list[tuple[list[str], str]] = []

        class RequestBackend:
            def execute_argv_with_input(
                self,
                command: list[str],
                input_text: str,
                output_handler: Callable[[str], Any],
                env: dict[str, str] | None = None,
                timeout: float | None = None,
            ) -> int:
                del env, timeout
                calls.append((command, input_text))
                output_handler(json.dumps({"ok": True, "configLoaded": True}))

                return 0

        context = FakeContext()
        context.backend = RequestBackend()
        result = setup._run_runtime_helper_self_test(
            context,
            r"C:\Workbench new\helpers\task-helper.cmd",
            r"C:\backups new",
            True,
        )

        self.assertEqual(result.tone, "ok")
        self.assertEqual(calls, [([
            r"C:\Workbench new\helpers\task-helper.cmd",
            "--backup-home",
            r"C:\backups new",
            "--self-test",
        ], "")])

    def test_windows_login_path_storage_launches_isolated_mysqlsh_worker(self) -> None:
        calls = {"argv": [], "command": []}

        class WindowsBackend:
            def list2cmdline(self, command: list[str]) -> str:
                return " ".join(command)

            def execute_command_with_input(
                self,
                command: str,
                input_text: str,
                output_handler: object,
            ) -> int:
                calls["command"].append((command, input_text, output_handler))

                return 0

            def execute_argv_with_input(
                self,
                command: list[str],
                input_text: str,
                output_handler: object,
                env: dict[str, str],
                timeout: float | None = None,
            ) -> int:
                calls["argv"].append((command, input_text, output_handler, env, timeout))

                return 0

        context = FakeContext()
        context.target = FakeTarget()
        context.target.is_windows = True
        context.backend = WindowsBackend()
        mysql_user = "backup&calc.exe&rem"

        with mock.patch.object(
            setup.mysqlsh,
            "executable",
            r"C:\workbench\mysqlsh.exe",
            create=True,
        ):
            login_file, login_path, result = setup._store_login_path(
                context,
                r"C:\backup-home",
                mysql_user,
                "secret",
            )

        self.assertEqual(result.tone, "ok")
        self.assertEqual(calls["command"], [])
        command, input_text, _output_handler, env, timeout = calls["argv"][0]
        self.assertEqual(command[:5], [
            r"C:\workbench\mysqlsh.exe",
            "--disable-plugins",
            "--disable-builtin-plugins",
            "--py",
            "-f",
        ])
        self.assertEqual(Path(command[5]).name, "windows_conpty.py")
        self.assertEqual(command[6:], [
            "--stdin",
            "--",
            "mysql_config_editor.exe",
            "set",
            f"--login-path={login_path}",
            "--host=localhost",
            f"--user={mysql_user}",
            "--password",
            "--skip-warn",
            "--port=3306",
        ])
        self.assertEqual(input_text, "secret\r")
        self.assertEqual(
            env["MYSQL_TEST_LOGIN_FILE"],
            os.path.join(r"C:\backup-home", ".mylogin.cnf"),
        )
        self.assertNotIn("secret", command)
        self.assertNotIn("secret", env.values())
        self.assertEqual(timeout, 30)

    def test_windows_login_path_storage_uses_short_login_file_without_cwd(self) -> None:
        calls = []

        class WindowsBackend:
            def execute_argv_with_input(
                self,
                command: list[str],
                input_text: str,
                output_handler: object,
                env: dict[str, str],
                timeout: float | None = None,
            ) -> int:
                calls.append((command, input_text, output_handler, env, timeout))

                return 0

        context = FakeContext()
        context.target = FakeTarget()
        context.target.is_windows = True
        context.backend = WindowsBackend()
        backup_home = r"C:\Users\lroot\scratch\テスト"
        short_backup_home = r"C:\Users\lroot\scratch\95F2~1"

        with (
            mock.patch.object(
                setup,
                "windows_ascii_directory_path",
                return_value=short_backup_home,
            ),
            mock.patch.object(
                setup.mysqlsh,
                "executable",
                r"C:\workbench\mysqlsh.exe",
                create=True,
            ),
        ):
            setup._store_login_path(
                context,
                backup_home,
                "mysqlbackup",
                "secret",
            )

        command, _input_text, _output_handler, env, _timeout = calls[0]
        self.assertEqual(
            env["MYSQL_TEST_LOGIN_FILE"],
            os.path.join(short_backup_home, ".mylogin.cnf"),
        )
        self.assertNotIn("--cwd", command)

    def test_windows_login_path_storage_redacts_worker_output(self) -> None:
        class FailingWindowsBackend:
            def execute_argv_with_input(
                self,
                command: list[str],
                input_text: str,
                output_handler: Callable[[str], Any],
                env: dict[str, str],
                timeout: float | None = None,
            ) -> int:
                del command, input_text, env, timeout
                output_handler("mysql_config_editor rejected secret")

                return 3221225786

        context = FakeContext()
        context.target = FakeTarget()
        context.target.is_windows = True
        context.backend = FailingWindowsBackend()

        result = setup._set_login_path(
            context,
            r"C:\backup-home\.mylogin.cnf",
            "backup-login",
            "mysqlbackup",
            "secret",
        )

        self.assertEqual(result.tone, "warn")
        self.assertIn("exit code 3221225786", result.message)
        self.assertIn("<redacted>", result.message)
        self.assertNotIn("secret", result.message)

    def test_windows_login_path_storage_cleans_terminal_sequences_from_failure(self) -> None:
        class FailingWindowsBackend:
            def execute_argv_with_input(
                self,
                command: list[str],
                input_text: str,
                output_handler: Callable[[str], Any],
                env: dict[str, str],
                timeout: float | None = None,
            ) -> int:
                del command, input_text, env, timeout
                output_handler(
                    WINDOWS_CONFIG_EDITOR_TERMINAL_OUTPUT
                    + "\r\nmysql_config_editor rejected secret\r\n"
                )

                return 3221225786

        context = FakeContext()
        context.target = FakeTarget()
        context.target.is_windows = True
        context.backend = FailingWindowsBackend()

        result = setup._set_login_path(
            context,
            r"C:\backup-home\.mylogin.cnf",
            "backup-login",
            "mysqlbackup",
            "secret",
        )

        self.assertEqual(
            result.message,
            "mysql_config_editor failed (exit code 3221225786): "
            "mysql_config_editor rejected <redacted>",
        )

    def test_windows_login_path_storage_omits_terminal_only_failure_details(self) -> None:
        class FailingWindowsBackend:
            def execute_argv_with_input(
                self,
                command: list[str],
                input_text: str,
                output_handler: Callable[[str], Any],
                env: dict[str, str],
                timeout: float | None = None,
            ) -> int:
                del command, input_text, env, timeout
                output_handler(WINDOWS_CONFIG_EDITOR_TERMINAL_OUTPUT)

                return 3221225786

        context = FakeContext()
        context.target = FakeTarget()
        context.target.is_windows = True
        context.backend = FailingWindowsBackend()

        result = setup._set_login_path(
            context,
            r"C:\backup-home\.mylogin.cnf",
            "backup-login",
            "mysqlbackup",
            "secret",
        )

        self.assertEqual(
            result.message,
            "mysql_config_editor failed (exit code 3221225786).",
        )

    def test_windows_login_path_storage_logs_redacted_failure_details(self) -> None:
        class FailingWindowsBackend:
            def execute_argv_with_input(
                self,
                command: list[str],
                input_text: str,
                output_handler: Callable[[str], Any],
                env: dict[str, str],
                timeout: float | None = None,
            ) -> int:
                del command, input_text, env, timeout
                output_handler(
                    WINDOWS_CONFIG_EDITOR_TERMINAL_OUTPUT
                    + "\r\nmysql_config_editor rejected secret\r\n"
                )

                return 3221225786

        context = FakeContext()
        context.target = FakeTarget()
        context.target.is_windows = True
        context.backend = FailingWindowsBackend()
        logger = types.SimpleNamespace(error=mock.Mock())

        with mock.patch.object(setup, "logger", logger, create=True):
            setup._set_login_path(
                context,
                r"C:\backup-home\.mylogin.cnf",
                "backup-login",
                "mysqlbackup",
                "secret",
            )

        logger.error.assert_called_once()
        logged_message = logger.error.call_args.args[0]
        self.assertIn("\x1b[?9001h", logged_message)
        self.assertIn("\x1b]0;C:\\mysql\\bin\\mysql_config_editor.exe\x07", logged_message)
        self.assertIn("mysql_config_editor rejected <redacted>", logged_message)
        self.assertNotIn("secret", logged_message)

    def test_windows_login_path_storage_reports_empty_failure_details(self) -> None:
        class FailingWindowsBackend:
            def execute_argv_with_input(
                self,
                command: list[str],
                input_text: str,
                output_handler: Callable[[str], Any],
                env: dict[str, str],
                timeout: float | None = None,
            ) -> int:
                del command, input_text, output_handler, env, timeout

                return 7

        context = FakeContext()
        context.target = FakeTarget()
        context.target.is_windows = True
        context.backend = FailingWindowsBackend()
        logger = types.SimpleNamespace(error=mock.Mock())

        with mock.patch.object(setup, "logger", logger, create=True):
            result = setup._set_login_path(
                context,
                r"C:\backup-home\.mylogin.cnf",
                "backup-login",
                "mysqlbackup",
                "secret",
            )

        self.assertEqual(
            result.message,
            "mysql_config_editor failed (exit code 7).",
        )
        logger.error.assert_called_once_with(
            "MEB mysql_config_editor failed with exit code 7."
        )

    def test_execute_argv_with_input_kills_timed_out_process(self) -> None:
        target = target_module.BackupTarget(is_windows=True)
        helper = backend_controller.LocalMebServerHelper(target)
        process = mock.Mock()
        process.communicate.side_effect = [
            subprocess.TimeoutExpired(["worker"], 3),
            ("worker output", None),
        ]
        output: list[str] = []

        with mock.patch.object(
            backend_controller.subprocess,
            "Popen",
            return_value=process,
        ) as popen:
            result = helper.execute_argv_with_input(
                ["worker"],
                "secret\n",
                output_handler=output.append,
                timeout=3,
            )

        self.assertEqual(result, 124)
        process.kill.assert_called_once_with()
        self.assertEqual(process.communicate.call_args_list, [
            mock.call(input="secret\n", timeout=3),
            mock.call(),
        ])
        self.assertIn("worker output", "".join(output))
        self.assertIn("timed out after 3 seconds", "".join(output))
        self.assertNotIn("secret", "".join(output))
        popen.assert_called_once_with(
            ["worker"],
            shell=False,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=None,
        )

    def test_apply_setup_grants_existing_backup_account(self) -> None:
        context = FakeContext()
        context.target = FakeTarget()
        session = FakeSession()
        calls = []
        state = MebSetupState()

        original_create_context = setup.create_local_backup_context
        original_account_host = setup._account_host
        original_validate_home = setup.validate_backup_home
        original_apply_policy = getattr(setup, "_apply_backup_mysql_user_policy", None)
        original_write_config = setup._write_backups_config
        original_get_state = setup.get_setup_state
        try:
            setup.create_local_backup_context = lambda session: context
            setup._account_host = lambda session, user, host: "localhost"
            setup.validate_backup_home = lambda session, path: MebBackupHomeValidation(valid=True)
            setup._apply_backup_mysql_user_policy = (
                lambda active_session, version, user, host:
                    calls.append(("grant", active_session, version, user, host))
            )
            setup._write_backups_config = (
                lambda ctx, path, account: calls.append(("write", ctx, path, account))
            )
            setup.get_setup_state = lambda active_session, path: state

            result = setup.apply_setup(
                session,
                "/backup-home",
                "mysqlbackup@localhost",
            )
        finally:
            setup.create_local_backup_context = original_create_context
            setup._account_host = original_account_host
            setup.validate_backup_home = original_validate_home
            if original_apply_policy is None:
                delattr(setup, "_apply_backup_mysql_user_policy")
            else:
                setup._apply_backup_mysql_user_policy = original_apply_policy
            setup._write_backups_config = original_write_config
            setup.get_setup_state = original_get_state

        self.assertIs(result, state)
        self.assertEqual(calls, [
            ("grant", session, (9, 0, 0), "mysqlbackup", "localhost"),
            ("write", context, "/backup-home", "mysqlbackup@localhost"),
        ])

    def test_backup_mysql_password_validation_uses_temporary_login_path(self) -> None:
        context = FakeContext()
        context.target = FakeTarget()
        client_calls = []
        login_path_calls = []

        class FakeCompletedProcess:
            returncode = 0
            stdout = "mysqlbackup@localhost\n"
            stderr = ""

        original_isfile = setup.os.path.isfile
        original_run = setup.subprocess.run
        original_set_login_path = setup._set_login_path

        def fake_isfile(path: str) -> bool:
            return path == "/mysql/bin/mysql" or original_isfile(path)

        def fake_run(command: list[str], **kwargs: object) -> FakeCompletedProcess:
            client_calls.append((command, kwargs))

            return FakeCompletedProcess()

        def fake_set_login_path(
            _context: object,
            login_file: str,
            login_path: str,
            mysql_user: str,
            password: str,
        ) -> models.MebValidationStatus:
            login_path_calls.append((login_file, login_path, mysql_user, password))

            return models.MebValidationStatus("ok", "Credentials were stored.")

        try:
            setup.os.path.isfile = fake_isfile
            setup.subprocess.run = fake_run
            setup._set_login_path = fake_set_login_path

            result = setup._validate_backup_account_password(
                context,
                "mysqlbackup",
                "localhost",
                "secret",
            )
        finally:
            setup.os.path.isfile = original_isfile
            setup.subprocess.run = original_run
            setup._set_login_path = original_set_login_path

        self.assertEqual(result.tone, "ok")
        self.assertEqual(len(login_path_calls), 1)
        login_file, login_path, mysql_user, password = login_path_calls[0]
        self.assertTrue(login_file.endswith("/login.cnf"))
        self.assertEqual(login_path, "mysql-workbench-meb-validation")
        self.assertEqual(mysql_user, "mysqlbackup")
        self.assertEqual(password, "secret")
        self.assertEqual(len(client_calls), 1)
        command, kwargs = client_calls[0]
        self.assertEqual(command[0], "/mysql/bin/mysql")
        self.assertIn(f"--login-path={login_path}", command)
        self.assertIn("--execute=SELECT CURRENT_USER()", command)
        self.assertNotIn("secret", " ".join(command))
        self.assertEqual(kwargs["env"]["MYSQL_TEST_LOGIN_FILE"], login_file)  # type: ignore[index]

    def test_windows_backup_mysql_password_validation_uses_ascii_temporary_login_file(self) -> None:
        editor_calls = []
        client_calls = []

        class WindowsBackend:
            def execute_argv_with_input(
                self,
                command: list[str],
                input_text: str,
                output_handler: object,
                env: dict[str, str],
                timeout: float | None = None,
            ) -> int:
                editor_calls.append((command, input_text, output_handler, env, timeout))

                return 0

        class FakeCompletedProcess:
            returncode = 0
            stdout = "mysqlbackup@localhost\n"
            stderr = ""

        context = FakeContext()
        context.target = FakeTarget()
        context.target.is_windows = True
        context.backend = WindowsBackend()

        def fake_isfile(path: str) -> bool:
            return path == "/mysql/bin/mysql.exe"

        def fake_run(command: list[str], **kwargs: object) -> FakeCompletedProcess:
            client_calls.append((command, kwargs))

            return FakeCompletedProcess()

        with (
            mock.patch.object(setup.os.path, "isfile", side_effect=fake_isfile),
            mock.patch.object(setup.subprocess, "run", side_effect=fake_run),
            mock.patch.object(
                setup.mysqlsh,
                "executable",
                r"C:\workbench\mysqlsh.exe",
                create=True,
            ),
        ):
            result = setup._validate_backup_account_password(
                context,
                "mysqlbackup",
                "localhost",
                "secret",
            )

        self.assertEqual(result.tone, "ok")
        self.assertEqual(len(editor_calls), 1)
        editor_command, input_text, _output_handler, editor_env, timeout = editor_calls[0]
        process_login_file = editor_env["MYSQL_TEST_LOGIN_FILE"]
        self.assertTrue(process_login_file.isascii())
        self.assertEqual(os.path.basename(process_login_file), "login.cnf")
        self.assertNotIn("--cwd", editor_command)
        self.assertEqual(input_text, "secret\r")
        self.assertEqual(timeout, 30)

        self.assertEqual(len(client_calls), 1)
        client_command, client_options = client_calls[0]
        self.assertEqual(
            client_options["env"]["MYSQL_TEST_LOGIN_FILE"],
            process_login_file,
        )  # type: ignore[index]
        self.assertNotIn("cwd", client_options)
        self.assertNotIn("secret", client_command)
        self.assertNotIn("secret", editor_env.values())

    def test_stored_backup_mysql_password_validation_uses_login_file_with_mysql_client(self) -> None:
        context = FakeContext()
        context.target = FakeTarget()
        calls = []

        class FakeCompletedProcess:
            returncode = 0
            stdout = "mysqlbackup@localhost\n"
            stderr = ""

        original_isfile = setup.os.path.isfile
        original_run = setup.subprocess.run

        def fake_isfile(path: str) -> bool:
            return path in ("/backup-home/.mylogin.cnf", "/mysql/bin/mysql") or original_isfile(path)

        def fake_run(command: list[str], **kwargs: object) -> FakeCompletedProcess:
            calls.append((command, kwargs))

            return FakeCompletedProcess()

        try:
            setup.os.path.isfile = fake_isfile
            setup.subprocess.run = fake_run

            login_file, login_path, result = setup._validate_stored_login_path(
                context,
                "/backup-home",
                "mysqlbackup",
                "localhost",
            )
        finally:
            setup.os.path.isfile = original_isfile
            setup.subprocess.run = original_run

        self.assertEqual(result.tone, "ok")
        self.assertEqual(login_file, "/backup-home/.mylogin.cnf")
        self.assertEqual(login_path, "mysql_workbench_meb_4a7d11d27fec")
        self.assertEqual(len(calls), 1)
        command, kwargs = calls[0]
        self.assertEqual(command[0], "/mysql/bin/mysql")
        self.assertIn(f"--login-path={login_path}", command)
        self.assertIn("--execute=SELECT CURRENT_USER()", command)
        self.assertEqual(kwargs["env"]["MYSQL_TEST_LOGIN_FILE"], login_file)  # type: ignore[index]
        self.assertNotIn("cwd", kwargs)

    def test_windows_stored_backup_mysql_password_validation_uses_ascii_login_file(self) -> None:
        context = FakeContext()
        context.target = FakeTarget()
        context.target.is_windows = True
        calls = []

        class FakeCompletedProcess:
            returncode = 0
            stdout = "mysqlbackup@localhost\n"
            stderr = ""

        original_isfile = setup.os.path.isfile
        original_run = setup.subprocess.run

        def fake_isfile(path: str) -> bool:
            return path in (
                "/backup-home/テスト/.mylogin.cnf",
                "/mysql/bin/mysql.exe",
            ) or original_isfile(path)

        def fake_run(command: list[str], **kwargs: object) -> FakeCompletedProcess:
            calls.append((command, kwargs))

            return FakeCompletedProcess()

        try:
            setup.os.path.isfile = fake_isfile
            setup.subprocess.run = fake_run

            with mock.patch.object(
                setup,
                "windows_ascii_directory_path",
                return_value="/backup-home/95F2~1",
            ):
                login_file, _login_path, result = setup._validate_stored_login_path(
                    context,
                    "/backup-home/テスト",
                    "mysqlbackup",
                    "localhost",
                )
        finally:
            setup.os.path.isfile = original_isfile
            setup.subprocess.run = original_run

        self.assertEqual(result.tone, "ok")
        self.assertEqual(login_file, "/backup-home/テスト/.mylogin.cnf")
        self.assertEqual(len(calls), 1)
        _command, kwargs = calls[0]
        self.assertEqual(
            kwargs["env"]["MYSQL_TEST_LOGIN_FILE"],
            "/backup-home/95F2~1/.mylogin.cnf",
        )  # type: ignore[index]
        self.assertNotIn("cwd", kwargs)

    def test_create_backup_mysql_user_stores_generated_password_after_direct_login_validation(self) -> None:
        context = FakeContext()
        context.target = FakeTarget()
        calls = []

        original_create_context = setup.create_local_backup_context
        original_account_host = setup._account_host
        original_validate_password = setup._validate_backup_account_password
        original_store_login = setup._store_login_path
        original_create_mysql_user = setup.create_mysql_user
        original_apply_policy = setup._apply_backup_mysql_user_policy

        try:
            setup.create_local_backup_context = lambda session: context
            setup._account_host = lambda session, mysql_user, host: None
            setup.create_mysql_user = (
                lambda session, mysql_user, host, password:
                    calls.append(("create", mysql_user, host, bool(password)))
            )
            setup._apply_backup_mysql_user_policy = (
                lambda session, version, mysql_user, host:
                    calls.append(("policy", version, mysql_user, host))
            )
            setup._validate_backup_account_password = (
                lambda ctx, mysql_user, host, password:
                    calls.append(("direct-login", mysql_user, host, bool(password)))
                    or models.MebValidationStatus("ok", "Backup account password was validated.")
            )
            setup._store_login_path = (
                lambda ctx, backup_home_path, mysql_user, password: (
                    calls.append(("store", backup_home_path, mysql_user, bool(password)))
                    or (
                        "/backup-home/.mylogin.cnf",
                        "mysql_workbench_meb_stored",
                        models.MebValidationStatus("ok", "Credentials were stored."),
                    )
                )
            )

            result = setup.create_backup_mysql_user(
                FakeSession(),
                "/backup-home",
                "mysqlbackup@localhost",
            )
        finally:
            setup.create_local_backup_context = original_create_context
            setup._account_host = original_account_host
            setup._validate_backup_account_password = original_validate_password
            setup._store_login_path = original_store_login
            setup.create_mysql_user = original_create_mysql_user
            setup._apply_backup_mysql_user_policy = original_apply_policy

        self.assertTrue(result.passwordStored)
        self.assertEqual(result.loginFile, "/backup-home/.mylogin.cnf")
        self.assertEqual(calls, [
            ("create", "mysqlbackup", "localhost", True),
            ("policy", (9, 0, 0), "mysqlbackup", "localhost"),
            ("direct-login", "mysqlbackup", "localhost", True),
            ("store", "/backup-home", "mysqlbackup", True),
        ])

    def test_existing_backup_mysql_user_validates_stored_login_path_without_password(self) -> None:
        context = FakeContext()
        context.target = FakeTarget()
        calls = []

        original_create_context = setup.create_local_backup_context
        original_validate_stored_login = getattr(setup, "_validate_stored_login_path", None)
        original_grant_validation = setup.validate_mysql_user_grants

        def fake_validate_stored_login_path(
            _context: object,
            backup_home_path: str,
            mysql_user: str,
            host: str,
        ) -> tuple[str, str, models.MebValidationStatus]:
            calls.append((backup_home_path, mysql_user, host))

            return (
                "/backup-home/.mylogin.cnf",
                "mysql_workbench_meb_stored",
                models.MebValidationStatus("ok", "Stored credentials were validated."),
            )

        try:
            setup.create_local_backup_context = lambda session: context
            setup._validate_stored_login_path = fake_validate_stored_login_path
            setup.validate_mysql_user_grants = lambda session, user, host, requirements: types.SimpleNamespace(
                valid=True,
                missing_requirements=(),
            )

            result = setup.validate_backup_mysql_user(
                FakeSession(),
                "/backup-home",
                "mysqlbackup@localhost",
            )
        finally:
            setup.create_local_backup_context = original_create_context
            if original_validate_stored_login is None:
                delattr(setup, "_validate_stored_login_path")
            else:
                setup._validate_stored_login_path = original_validate_stored_login
            setup.validate_mysql_user_grants = original_grant_validation

        self.assertTrue(result.valid)
        self.assertTrue(result.passwordStored)
        self.assertEqual(result.loginFile, "/backup-home/.mylogin.cnf")
        self.assertEqual(result.loginPath, "mysql_workbench_meb_stored")
        self.assertEqual(calls, [("/backup-home", "mysqlbackup", "localhost")])

    def test_existing_backup_mysql_user_with_missing_grants_is_invalid(self) -> None:
        context = FakeContext()
        context.target = FakeTarget()
        original_create_context = setup.create_local_backup_context
        original_validate_stored_login = setup._validate_stored_login_path
        original_grant_validation = setup.validate_mysql_user_grants

        try:
            setup.create_local_backup_context = lambda session: context
            setup._validate_stored_login_path = lambda context, path, user, host: (
                "/backup-home/.mylogin.cnf",
                "mysql_workbench_meb_stored",
                models.MebValidationStatus("ok", "Stored credentials were validated."),
            )
            setup.validate_mysql_user_grants = lambda session, user, host, requirements: types.SimpleNamespace(
                valid=False,
                missing_requirements=(types.SimpleNamespace(target_quoted="*.*", privileges=("BACKUP_ADMIN",)),),
            )

            result = setup.validate_backup_mysql_user(
                FakeSession(),
                "/backup-home",
                "mysqlbackup@localhost",
            )
        finally:
            setup.create_local_backup_context = original_create_context
            setup._validate_stored_login_path = original_validate_stored_login
            setup.validate_mysql_user_grants = original_grant_validation

        self.assertFalse(result.valid)
        self.assertTrue(result.passwordStored)
        self.assertEqual(result.status.tone, "warn")
        self.assertEqual(result.status.message, "Backup MySQL account is missing required grants.")
        self.assertEqual(result.missingGrants, ["BACKUP_ADMIN ON *.*"])

    def test_reset_backup_mysql_user_uses_generic_password_and_policy_operations(self) -> None:
        context = FakeContext()
        context.target = FakeTarget()
        calls = []

        original_create_context = setup.create_local_backup_context
        original_account_host = setup._account_host
        original_reset_password = setup.reset_mysql_user_password
        original_apply_policy = setup._apply_backup_mysql_user_policy
        original_validate_password = setup._validate_backup_account_password
        original_store_login = setup._store_login_path
        try:
            setup.create_local_backup_context = lambda session: context
            setup._account_host = lambda session, mysql_user, host: "localhost"
            setup.reset_mysql_user_password = (
                lambda session, mysql_user, host, password:
                    calls.append(("reset", mysql_user, host, password))
            )
            setup._apply_backup_mysql_user_policy = (
                lambda session, version, mysql_user, host:
                    calls.append(("policy", version, mysql_user, host))
            )
            setup._validate_backup_account_password = (
                lambda ctx, mysql_user, host, password:
                    models.MebValidationStatus("ok", "Password validated.")
            )
            setup._store_login_path = (
                lambda ctx, backup_home_path, mysql_user, password: (
                    "/backup-home/.mylogin.cnf",
                    "mysql_workbench_meb_stored",
                    models.MebValidationStatus("ok", "Credentials stored."),
                )
            )

            result = setup.reset_backup_mysql_user_password(
                FakeSession(),
                "/backup-home",
                "mysqlbackup@localhost",
                "new-secret",
            )
        finally:
            setup.create_local_backup_context = original_create_context
            setup._account_host = original_account_host
            setup.reset_mysql_user_password = original_reset_password
            setup._apply_backup_mysql_user_policy = original_apply_policy
            setup._validate_backup_account_password = original_validate_password
            setup._store_login_path = original_store_login

        self.assertTrue(result.valid)
        self.assertEqual(calls, [
            ("reset", "mysqlbackup", "localhost", "new-secret"),
            ("policy", (9, 0, 0), "mysqlbackup", "localhost"),
        ])

    def test_fix_backup_mysql_user_reapplies_policy_and_revalidates_account(self) -> None:
        context = FakeContext()
        context.target = FakeTarget()
        session = FakeSession()
        calls = []
        expected = models.MebMysqlBackupUserValidation(valid=True, exists=True, passwordStored=True)

        original_create_context = setup.create_local_backup_context
        original_account_host = setup._account_host
        original_apply_policy = setup._apply_backup_mysql_user_policy
        original_validate_user = setup.validate_backup_mysql_user
        try:
            setup.create_local_backup_context = lambda session: context
            setup._account_host = lambda session, mysql_user, host: "localhost"
            setup._apply_backup_mysql_user_policy = (
                lambda active_session, version, mysql_user, host:
                    calls.append((active_session, version, mysql_user, host))
            )
            setup.validate_backup_mysql_user = (
                lambda active_session, backup_home_path, mysql_user: (
                    self.assertIs(active_session, session)
                    or self.assertEqual(backup_home_path, "/backup-home")
                    or self.assertEqual(mysql_user, "mysqlbackup@localhost")
                    or expected
                )
            )

            result = setup.fix_backup_mysql_user(session, "/backup-home", "mysqlbackup@localhost")
        finally:
            setup.create_local_backup_context = original_create_context
            setup._account_host = original_account_host
            setup._apply_backup_mysql_user_policy = original_apply_policy
            setup.validate_backup_mysql_user = original_validate_user

        self.assertIs(result, expected)
        self.assertEqual(calls, [(session, (9, 0, 0), "mysqlbackup", "localhost")])

    def test_save_profile_reinstalls_runtime_helper_before_syncing_jobs(self) -> None:
        calls = []
        context = FakeContext()
        context.backend = FakeBackend({})
        context.backend.create_directory_recursive = lambda path: calls.append(("mkdir", path))  # type: ignore[attr-defined]
        state = MebSetupState(status=MebStatus(profiles=[]))
        profile = MebBackupProfile(label="nightly", destination="/backup-home/nightly")

        try:
            setup.create_local_backup_context = lambda session: context
            setup._manager_values = lambda backup_home_path: {}
            setup.validate_backup_home = lambda session, backup_home_path: MebBackupHomeValidation(valid=True)
            setup._install_runtime_helper = lambda ctx, backup_home_path: calls.append("install") or "/backup-home/task-helper"
            setup._save_profile = lambda *args, **kwargs: calls.append("save")
            setup.get_setup_state = lambda session, backup_home_path: state
            setup._sync_profile_jobs = (
                lambda ctx, backup_home_path, manager_values, status, scheduled_only:
                    calls.append(("sync", manager_values.get("job_runner")))
            )

            save_profile(object(), "/backup-home", profile)
        finally:
            setup.create_local_backup_context = create_local_backup_context
            setup._manager_values = _manager_values
            setup.validate_backup_home = validate_backup_home
            setup._install_runtime_helper = _install_runtime_helper
            setup._save_profile = _save_profile
            setup.get_setup_state = get_setup_state
            setup._sync_profile_jobs = _sync_profile_jobs

        self.assertEqual(calls, [
            "install",
            "save",
            ("sync", "/backup-home/task-helper"),
        ])

    def test_save_profile_refreshes_status_after_logon_mode_fallback(self) -> None:
        context = FakeContext()
        context.backend = FakeBackend({})
        context.backend.create_directory_recursive = lambda _path: None  # type: ignore[attr-defined]
        profile = MebBackupProfile(label="nightly", destination="/backup-home/nightly")
        initial_status = MebStatus(profiles=[])
        refreshed_status = MebStatus(
            profiles=[MebBackupProfileInfo(schedulerLoginRequirement="required")],
        )
        states = [
            MebSetupState(status=initial_status),
            MebSetupState(status=refreshed_status),
        ]

        with patched_setup(
            create_local_backup_context=lambda session: context,
            _manager_values=lambda backup_home_path: {},
            validate_backup_home=lambda session, backup_home_path: MebBackupHomeValidation(valid=True),
            _install_runtime_helper=lambda ctx, backup_home_path: "/backup-home/task-helper",
            _save_profile=lambda *args, **kwargs: None,
            get_setup_state=lambda session, backup_home_path: states.pop(0),
            _sync_profile_jobs=lambda *args, **kwargs: True,
        ):
            status = save_profile(object(), "/backup-home", profile)

        self.assertIs(status, refreshed_status)
        self.assertEqual(states, [])

    def test_save_profile_uses_target_windows_path_rules(self) -> None:
        context = FakeContext()
        context.target = FakeTarget()
        context.target.is_windows = True
        context.backend = FakeBackend({})
        context.backend.create_directory_recursive = lambda _path: None  # type: ignore[attr-defined]
        profile = MebBackupProfile(label="nightly", destination="/backup-home/nightly")
        saved_options: dict[str, object] = {}
        state = MebSetupState(status=MebStatus(profiles=[]))

        with patched_setup(
            create_local_backup_context=lambda session: context,
            _manager_values=lambda backup_home_path: {},
            validate_backup_home=lambda session, backup_home_path: MebBackupHomeValidation(valid=True),
            _install_runtime_helper=lambda ctx, backup_home_path: "/backup-home/task-helper.cmd",
            _save_profile=lambda *args, **kwargs: saved_options.update(kwargs),
            get_setup_state=lambda session, backup_home_path: state,
            _sync_profile_jobs=lambda *args, **kwargs: False,
        ):
            save_profile(object(), "/backup-home", profile)

        self.assertTrue(saved_options["windows_path_rules"])

    def test_windows_manager_config_defaults_to_s4u(self) -> None:
        context = FakeContext()
        context.target = FakeTarget()
        context.target.is_windows = True

        values = setup._manager_config_values(
            context,
            r"C:\Users\backup-user\backups",
            "mysqlbackup@localhost",
            r"C:\Users\backup-user\backups\task-helper.cmd",
        )

        self.assertEqual(values["windows_logon_type"], "S4U")
        self.assertEqual(values["timeout_ms"], "0")

    def test_windows_manager_config_records_short_path_use(self) -> None:
        context = FakeContext()
        context.target = FakeTarget()
        context.target.is_windows = True
        backup_home = r"C:\Users\lroot\scratch\テスト"

        with mock.patch.object(
            setup,
            "windows_ascii_directory_path",
            return_value=r"C:\Users\lroot\scratch\95F2~1",
        ):
            values = setup._manager_config_values(
                context,
                backup_home,
                "mysqlbackup@localhost",
                os.path.join(backup_home, "task-helper.cmd"),
            )

        self.assertEqual(values["windows_use_short_paths"], "True")

    def test_delete_profile_removes_deleted_profile_jobs_from_cron(self) -> None:
        calls = []
        context = FakeContext()
        old_profile = MebBackupProfileInfo(
            uuid="profile-1",
            label="nightly",
            destination="/backup-home/nightly",
            configPath="/backup-home/nightly.cnf",
        )
        state = MebSetupState(status=MebStatus(profiles=[]))

        try:
            setup.create_local_backup_context = lambda session: context
            setup._manager_values = lambda backup_home_path: {}
            setup.validate_backup_home = lambda session, backup_home_path: MebBackupHomeValidation(valid=True)
            setup._install_runtime_helper = lambda ctx, backup_home_path: calls.append("install") or "/backup-home/task-helper"
            setup._read_profiles = lambda backup_home_path: [old_profile]
            setup._delete_profile = (
                lambda backup_home_path, profile_uuid, delete_profile_config:
                    calls.append(("delete", backup_home_path, profile_uuid))
            )
            setup.get_setup_state = lambda session, backup_home_path: state
            setup._runtime_helper_request = (
                lambda ctx, backup_home_path, manager_values, operation, params:
                    calls.append((operation, params))
                    or {"status": "removed", "exitCode": 0, "timedOut": False}
            )

            status = delete_profile(object(), "/backup-home", "profile-1")
        finally:
            setup.create_local_backup_context = create_local_backup_context
            setup._manager_values = _manager_values
            setup.validate_backup_home = validate_backup_home
            setup._install_runtime_helper = _install_runtime_helper
            setup._read_profiles = _read_profiles
            setup._delete_profile = _delete_profile
            setup.get_setup_state = get_setup_state
            setup._runtime_helper_request = _runtime_helper_request

        self.assertIs(status, state.status)
        self.assertEqual(calls, [
            "install",
            ("delete", "/backup-home", "profile-1"),
            ("cron.removeManagedJob", {
                "jobId": "profile-1-backup-full",
            }),
            ("cron.removeManagedJob", {
                "jobId": "profile-1-backup-incremental",
            }),
        ])

    def test_delete_profile_refreshes_status_after_logon_mode_fallback(self) -> None:
        context = FakeContext()
        old_profile = MebBackupProfileInfo(uuid="profile-1")
        initial_status = MebStatus(profiles=[])
        refreshed_status = MebStatus(
            profiles=[MebBackupProfileInfo(schedulerLoginRequirement="required")],
        )
        states = [
            MebSetupState(status=initial_status),
            MebSetupState(status=refreshed_status),
        ]

        with patched_setup(
            create_local_backup_context=lambda session: context,
            _manager_values=lambda backup_home_path: {},
            validate_backup_home=lambda session, backup_home_path: MebBackupHomeValidation(valid=True),
            _install_runtime_helper=lambda ctx, backup_home_path: "/backup-home/task-helper",
            _read_profiles=lambda backup_home_path: [old_profile],
            _delete_profile=lambda *args, **kwargs: None,
            get_setup_state=lambda session, backup_home_path: states.pop(0),
            _sync_profile_jobs=lambda *args, **kwargs: True,
        ):
            status = delete_profile(object(), "/backup-home", "profile-1")

        self.assertIs(status, refreshed_status)
        self.assertEqual(states, [])

    def test_start_profile_execution_returns_running_progress_status(self) -> None:
        calls = []
        context = FakeContext()
        profile = MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination="/backup-home/nightly")
        running_activity = models.MebActivityItem(
            title="Backup running: Nightly",
            detail="4 of 11 MB; Copying .ibd files",
            tone="info",
        )
        prepared_state = MebSetupState(status=MebStatus(profiles=[profile]))
        running_state = MebSetupState(status=MebStatus(profiles=[profile], recentActivity=[running_activity]))
        helper_started = threading.Event()
        helper_release = threading.Event()

        def fake_get_setup_state(_session: object, _backup_home_path: str) -> MebSetupState:
            return running_state if helper_started.is_set() else prepared_state

        def fake_runtime_helper_request(*_args: object, **_kwargs: object) -> dict[str, object]:
            calls.append("execute")
            helper_started.set()
            helper_release.wait(timeout=5)

            return {}

        try:
            setup.create_local_backup_context = lambda session: context
            setup._manager_values = lambda backup_home_path: {}
            setup._install_runtime_helper = lambda ctx, backup_home_path: calls.append("install") or "/backup-home/task-helper"
            setup.get_setup_state = fake_get_setup_state
            setup._sync_profile_jobs = (
                lambda ctx, backup_home_path, manager_values, status, scheduled_only:
                    calls.append(("sync", manager_values.get("job_runner"), scheduled_only))
            )
            setup._runtime_helper_request = fake_runtime_helper_request

            started = time.time()
            status = start_profile_execution(object(), "/backup-home", "profile-1", "full")
            elapsed = time.time() - started
        finally:
            helper_release.set()
            setup.create_local_backup_context = create_local_backup_context
            setup._manager_values = _manager_values
            setup._install_runtime_helper = _install_runtime_helper
            setup.get_setup_state = get_setup_state
            setup._sync_profile_jobs = _sync_profile_jobs
            setup._runtime_helper_request = _runtime_helper_request

        self.assertLess(elapsed, 1)
        self.assertEqual(status.recentActivity[0].title, "Backup running: Nightly")
        self.assertEqual(calls, [
            "install",
            ("sync", "/backup-home/task-helper", False),
            "execute",
        ])

    def test_delete_activity_backup_uses_resolved_activity(self) -> None:
        calls = []
        context = FakeContext()
        profile = MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination="/backup-home/nightly")
        refreshed_status = MebStatus(profiles=[profile])
        with activity_setup(
            context,
            calls,
            profile,
            refreshed_status,
            resolve_activity=(
                lambda backup_home_path, activity_id, profiles:
                    calls.append(("resolve", backup_home_path, activity_id, len(profiles)))
                    or resolved_activity(
                        activity_id,
                        "/backup-home/logs/20260618T120000Z-profile-1-full-test.log",
                        "nightly/2026-06-18_12-00-00",
                    )
            ),
            _runtime_helper_request=(
                lambda _context, backup_home_path, _manager_values, operation, params:
                    calls.append((operation, params)) or {"status": "deleted"}
            ),
            _dependent_incremental_backups=lambda _backup_home_path, _backup_id: [],
        ):
            status = setup.delete_activity_backup(
                "/backup-home",
                "activity:v1:logs/20260618T120000Z-profile-1-full-test.log",
            )

        self.assertIs(status, refreshed_status)
        self.assertEqual(calls, [
            (
                "resolve",
                "/backup-home",
                "activity:v1:logs/20260618T120000Z-profile-1-full-test.log",
                1,
            ),
            "install",
            ("backups.delete", {
                "backupHome": "/backup-home",
                "backupId": "nightly/2026-06-18_12-00-00",
                "logId": "20260618T120000Z-profile-1-full-test.log",
            }),
        ])

    def test_delete_failed_activity_backup_without_restore_metadata(self) -> None:
        calls: list[object] = []
        context = FakeContext()
        refreshed_status = MebStatus()
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            backup_path = backup_home_path / "Backup" / "2026-08-19_11-03-00"
            log_path = backup_home_path / "logs" / "20260819T110300Z-profile-1-full-test.log"
            backup_path.mkdir(parents=True)
            log_path.parent.mkdir()
            log_path.write_text(
                f"Backup directory created: '{backup_path}'\n"
                "MAIN: [ERROR] Back_systablespace::back_doublewrite_init: "
                "source file should be open.\n",
                encoding="utf-8",
            )
            profile = MebBackupProfileInfo(
                uuid="profile-1",
                label="Backup",
                destination=(backup_home_path / "Backup").as_posix(),
            )
            activity_id = f"activity:v1:logs/{log_path.name}"

            with activity_setup(
                context,
                calls,
                profile,
                refreshed_status,
                resolve_activity=backup_home.resolve_activity,
                _runtime_helper_request=(
                    lambda _context, _backup_home_path, _manager_values, operation, params:
                        calls.append((operation, params)) or {"status": "deleted"}
                ),
            ):
                status = setup.delete_activity_backup(backup_home_path.as_posix(), activity_id)

        self.assertIs(status, refreshed_status)
        self.assertEqual(calls, [
            "install",
            ("backups.delete", {
                "backupHome": backup_home_path.resolve().as_posix(),
                "backupId": "Backup/2026-08-19_11-03-00",
                "logId": log_path.name,
            }),
        ])

    def test_delete_failed_activity_backup_rejects_unreadable_restore_metadata(self) -> None:
        calls: list[object] = []
        context = FakeContext()
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            backup_path = backup_home_path / "Backup" / "2026-08-19_11-03-00"
            log_path = backup_home_path / "logs" / "20260819T110300Z-profile-1-full-test.log"
            metadata_path = backup_path / "meta" / "backup_variables.txt"
            metadata_path.parent.mkdir(parents=True)
            metadata_path.write_text(
                "[backup_variables]\n"
                "is_incremental=0\n"
                "start_lsn=10\n"
                "end_lsn=20\n",
                encoding="utf-8",
            )
            log_path.parent.mkdir()
            log_path.write_text(
                f"Backup directory created: '{backup_path}'\n"
                "MAIN: [ERROR] Back_systablespace::back_doublewrite_init: "
                "source file should be open.\n",
                encoding="utf-8",
            )
            profile = MebBackupProfileInfo(
                uuid="profile-1",
                label="Backup",
                destination=(backup_home_path / "Backup").as_posix(),
            )
            activity_id = f"activity:v1:logs/{log_path.name}"
            real_open = open

            def open_with_unreadable_metadata(path: Any, *args: Any, **kwargs: Any) -> Any:
                if Path(path).resolve() == metadata_path.resolve():
                    raise PermissionError("Metadata access denied")

                return real_open(path, *args, **kwargs)

            with activity_setup(
                context,
                calls,
                profile,
                resolve_activity=backup_home.resolve_activity,
                _runtime_helper_request=(
                    lambda _context, _backup_home_path, _manager_values, operation, params:
                        calls.append((operation, params)) or {"status": "deleted"}
                ),
            ), mock.patch("builtins.open", side_effect=open_with_unreadable_metadata):
                with self.assertRaisesRegex(ValueError, "Backup metadata could not be read"):
                    setup.delete_activity_backup(backup_home_path.as_posix(), activity_id)

        self.assertEqual(calls, [])

    def test_delete_failed_activity_backup_rejects_malformed_restore_metadata(self) -> None:
        calls: list[object] = []
        context = FakeContext()
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            backup_path = backup_home_path / "Backup" / "2026-08-19_11-03-00"
            log_path = backup_home_path / "logs" / "20260819T110300Z-profile-1-full-test.log"
            metadata_path = backup_path / "meta" / "backup_variables.txt"
            metadata_path.parent.mkdir(parents=True)
            metadata_path.write_text("[unexpected]\nvalue=1\n", encoding="utf-8")
            log_path.parent.mkdir()
            log_path.write_text(
                f"Backup directory created: '{backup_path}'\n"
                "MAIN: [ERROR] Back_systablespace::back_doublewrite_init: "
                "source file should be open.\n",
                encoding="utf-8",
            )
            profile = MebBackupProfileInfo(
                uuid="profile-1",
                label="Backup",
                destination=(backup_home_path / "Backup").as_posix(),
            )
            activity_id = f"activity:v1:logs/{log_path.name}"

            with activity_setup(
                context,
                calls,
                profile,
                MebStatus(),
                resolve_activity=backup_home.resolve_activity,
                _runtime_helper_request=(
                    lambda _context, _backup_home_path, _manager_values, operation, params:
                        calls.append((operation, params)) or {"status": "deleted"}
                ),
            ):
                with self.assertRaisesRegex(ValueError, "Backup metadata is malformed"):
                    setup.delete_activity_backup(backup_home_path.as_posix(), activity_id)

        self.assertEqual(calls, [])

    def test_delete_completed_activity_backup_requires_restore_metadata(self) -> None:
        calls: list[object] = []
        context = FakeContext()
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            backup_path = backup_home_path / "Backup" / "2026-08-19_11-03-00"
            log_path = backup_home_path / "logs" / "20260819T110300Z-profile-1-full-test.log"
            backup_path.mkdir(parents=True)
            log_path.parent.mkdir()
            log_path.write_text(
                f"Backup directory created: '{backup_path}'\n"
                "mysqlbackup completed OK!\n",
                encoding="utf-8",
            )
            profile = MebBackupProfileInfo(
                uuid="profile-1",
                label="Backup",
                destination=(backup_home_path / "Backup").as_posix(),
            )
            activity_id = f"activity:v1:logs/{log_path.name}"

            with activity_setup(
                context,
                calls,
                profile,
                resolve_activity=backup_home.resolve_activity,
            ):
                with self.assertRaisesRegex(ValueError, "Backup metadata could not be read"):
                    setup.delete_activity_backup(backup_home_path.as_posix(), activity_id)

        self.assertEqual(calls, [])

    def test_delete_activity_backup_rejects_incremental_backup_dependencies(self) -> None:
        context = FakeContext()
        original_create_context = setup.create_local_backup_context
        original_read_profiles = setup._read_profiles
        original_resolve_activity = setup.resolve_activity
        original_dependent_backups = setup._dependent_incremental_backups

        try:
            setup.create_local_backup_context = lambda: context
            setup._read_profiles = lambda backup_home_path: []
            setup.resolve_activity = lambda backup_home_path, activity_id, profiles: resolved_activity(
                activity_id,
                "/backup-home/logs/20260618T120000Z-profile-1-full-test.log",
                "nightly/full",
            )
            setup._dependent_incremental_backups = lambda backup_home_path, backup_id: [
                "/backup-home/nightly/inc/incremental-1",
            ]

            with self.assertRaisesRegex(ValueError, "incremental backups depend on it: incremental-1"):
                setup.delete_activity_backup(
                    "/backup-home",
                    "activity:v1:logs/20260618T120000Z-profile-1-full-test.log",
                )
        finally:
            setup.create_local_backup_context = original_create_context
            setup._read_profiles = original_read_profiles
            setup.resolve_activity = original_resolve_activity
            setup._dependent_incremental_backups = original_dependent_backups

    def test_verify_activity_backup_uses_resolved_activity(self) -> None:
        calls = []
        context = FakeContext()
        profile = MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination="/backup-home/nightly")
        with activity_setup(
            context,
            calls,
            profile,
            resolve_activity=(
                lambda backup_home_path, activity_id, profiles:
                    calls.append(("resolve", backup_home_path, activity_id, len(profiles)))
                    or types.SimpleNamespace(
                        log_path="/backup-home/logs/20260618T120000Z-profile-1-full-test.log",
                        profile_id="profile-1",
                        require_backup_id=lambda: "nightly/2026-06-18_12-00-00",
                    )
            ),
            _runtime_helper_request=(
                lambda _context, backup_home_path, _manager_values, operation, params:
                    calls.append((operation, params))
                    or {"status": "verified", "output": "verification output"}
            ),
            _restore_chain_for_backup=lambda _backup_home_path, _backup_id: [
                "/backup-home/nightly/2026-06-18_12-00-00",
            ],
        ):
            output = setup.verify_activity_backup(
                "/backup-home",
                "activity:v1:logs/20260618T120000Z-profile-1-full-test.log",
            )

        self.assertEqual(output.displayName, "Backup verification output")
        self.assertEqual(output.content, "verification output")
        self.assertEqual(output.warnings, [])
        self.assertEqual(calls, [
            "install",
            (
                "resolve",
                "/backup-home",
                "activity:v1:logs/20260618T120000Z-profile-1-full-test.log",
                1,
            ),
            ("backups.verify", {
                "backupHome": "/backup-home",
                "backupId": "nightly/2026-06-18_12-00-00",
            }),
        ])

    def test_verify_activity_backup_warns_when_restore_chain_cannot_be_resolved(self) -> None:
        context = FakeContext()
        original_create_context = setup.create_local_backup_context
        original_manager_values = setup._manager_values
        original_install_helper = setup._install_runtime_helper
        original_read_profiles = setup._read_profiles
        original_runtime_helper_request = setup._runtime_helper_request
        original_resolve_activity = getattr(setup, "resolve_activity", None)
        original_restore_chain = setup._restore_chain_for_backup

        try:
            setup.create_local_backup_context = lambda: context
            setup._manager_values = lambda backup_home_path: {}
            setup._install_runtime_helper = lambda ctx, backup_home_path: "/backup-home/task-helper"
            setup._read_profiles = lambda backup_home_path: []
            setup.resolve_activity = lambda backup_home_path, activity_id, profiles: types.SimpleNamespace(
                require_backup_id=lambda: "nightly/inc/2026-06-18_12-00-00",
            )
            setup._restore_chain_for_backup = lambda backup_home_path, backup_id: (
                (_ for _ in ()).throw(ValueError("The preceding backup was not found"))
            )
            setup._runtime_helper_request = lambda ctx, backup_home_path, manager_values, operation, params: {
                "status": "verified",
                "output": "verification output",
            }

            output = setup.verify_activity_backup(
                "/backup-home",
                "activity:v1:logs/20260618T120000Z-profile-1-incremental-test.log",
            )
        finally:
            setup.create_local_backup_context = original_create_context
            setup._manager_values = original_manager_values
            setup._install_runtime_helper = original_install_helper
            setup._read_profiles = original_read_profiles
            setup._runtime_helper_request = original_runtime_helper_request
            setup._restore_chain_for_backup = original_restore_chain
            if original_resolve_activity is None:
                delattr(setup, "resolve_activity")
            else:
                setup.resolve_activity = original_resolve_activity

        self.assertEqual(output.warnings, [
            "The restore chain could not be resolved: The preceding backup was not found",
        ])

    def test_apply_activity_backup_logs_uses_resolved_activity(self) -> None:
        calls = []
        context = FakeContext()
        profile = MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination="/backup-home/nightly")
        refreshed_status = MebStatus(profiles=[profile])
        with activity_setup(
            context,
            calls,
            profile,
            refreshed_status,
            resolve_activity=(
                lambda backup_home_path, activity_id, profiles:
                    calls.append(("resolve", backup_home_path, activity_id, len(profiles)))
                    or resolved_activity(
                        activity_id,
                        "/backup-home/logs/20260618T120000Z-profile-1-full-test.log",
                        "nightly/backup-1",
                    )
            ),
            _runtime_helper_request=(
                lambda _context, backup_home_path, _manager_values, operation, params:
                    calls.append((operation, params)) or {"status": "applied"}
            ),
        ):
            status = setup.apply_activity_backup_logs(
                "/backup-home",
                "activity:v1:logs/20260618T120000Z-profile-1-full-test.log",
            )

        self.assertIs(status, refreshed_status)
        self.assertEqual(calls, [
            "install",
            (
                "resolve",
                "/backup-home",
                "activity:v1:logs/20260618T120000Z-profile-1-full-test.log",
                1,
            ),
            ("backups.applyLog", {
                "backupHome": "/backup-home",
                "backupId": "nightly/backup-1",
                "profileId": "profile-1",
            }),
        ])

    def test_restore_activity_backup_uses_resolved_activity(self) -> None:
        calls = []
        context = FakeContext()
        profile = MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination="/backup-home/nightly")
        refreshed_status = MebStatus(profiles=[profile])
        with activity_setup(
            context,
            calls,
            profile,
            refreshed_status,
            resolve_activity=(
                lambda backup_home_path, activity_id, profiles:
                    calls.append(("resolve", backup_home_path, activity_id, len(profiles)))
                    or resolved_activity(
                        activity_id,
                        "/backup-home/logs/20260618T120000Z-profile-1-full-test.log",
                        "nightly/2026-06-18_12-00-00",
                    )
            ),
            _runtime_helper_request=(
                lambda _context, backup_home_path, _manager_values, operation, params:
                    calls.append((operation, params)) or {"status": "restored"}
            ),
        ):
            result = setup.restore_activity_backup(
                "/backup-home",
                "activity:v1:logs/20260618T120000Z-profile-1-full-test.log",
                "restore-operation-1",
                True,
            )

        self.assertTrue(result.succeeded)
        self.assertIs(result.status, refreshed_status)
        self.assertEqual(result.output, "")
        self.assertEqual(calls, [
            "install",
            (
                "resolve",
                "/backup-home",
                "activity:v1:logs/20260618T120000Z-profile-1-full-test.log",
                1,
            ),
            ("backups.restore", {
                "backupHome": "/backup-home",
                "backupId": "nightly/2026-06-18_12-00-00",
                "operationId": "restore-operation-1",
                "profileId": "profile-1",
                "force": True,
            }),
        ])

    def test_restore_activity_backup_includes_mysqlbackup_output_in_failure(self) -> None:
        context = FakeContext()
        profile = MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination="/backup-home/nightly")
        original_create_context = setup.create_local_backup_context
        original_manager_values = setup._manager_values
        original_install_helper = setup._install_runtime_helper
        original_read_profiles = setup._read_profiles
        original_runtime_helper_request = setup._runtime_helper_request

        try:
            setup.create_local_backup_context = lambda: context
            setup._manager_values = lambda backup_home_path: {}
            setup._install_runtime_helper = lambda ctx, backup_home_path: "/backup-home/task-helper"
            setup._read_profiles = lambda backup_home_path: [profile]
            setup._runtime_helper_request = lambda ctx, backup_home_path, manager_values, operation, params: {
                "status": "failed",
                "stdout": "copy-back started\n",
                "stderr": "data directory is not empty\n",
                "output": "copy-back started\ndata directory is not empty\n",
            }

            result = setup.restore_activity_backup(
                "/backup-home",
                "activity:v1:logs/20260618T120000Z-profile-1-full-test.log",
                "restore-operation-1",
            )
        finally:
            setup.create_local_backup_context = original_create_context
            setup._manager_values = original_manager_values
            setup._install_runtime_helper = original_install_helper
            setup._read_profiles = original_read_profiles
            setup._runtime_helper_request = original_runtime_helper_request

        self.assertFalse(result.succeeded)
        self.assertIsNone(result.status)
        self.assertEqual(result.message, "MySQL Enterprise Backup restore failed.")
        self.assertEqual(result.output, "copy-back started\ndata directory is not empty\n")

    def test_restore_activity_backup_rejects_incremental_backup_with_broken_chain(self) -> None:
        calls = []
        context = FakeContext()
        profile = MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination="/backup-home/nightly")
        original_create_context = setup.create_local_backup_context
        original_manager_values = setup._manager_values
        original_install_helper = setup._install_runtime_helper
        original_read_profiles = setup._read_profiles
        original_resolve_activity = setup.resolve_activity
        original_restore_chain = setup._restore_chain_for_backup
        original_runtime_helper_request = setup._runtime_helper_request

        try:
            setup.create_local_backup_context = lambda: context
            setup._manager_values = lambda backup_home_path: {}
            setup._install_runtime_helper = lambda ctx, backup_home_path: calls.append("install") or "/backup-home/task-helper"
            setup._read_profiles = lambda backup_home_path: [profile]
            setup.resolve_activity = lambda backup_home_path, activity_id, profiles: resolved_activity(
                activity_id,
                "/backup-home/logs/20260618T120000Z-profile-1-incremental-test.log",
                "nightly/inc/2026-06-18_12-00-00",
                activity_type="Incremental Backup",
            )

            def broken_restore_chain(backup_home_path: str, backup_id: str) -> list[str]:
                raise ValueError("The preceding backup required for this incremental backup was not found")

            setup._restore_chain_for_backup = broken_restore_chain
            setup._runtime_helper_request = lambda *args: calls.append("restore") or {"status": "restored"}

            result = setup.restore_activity_backup(
                "/backup-home",
                "activity:v1:logs/20260618T120000Z-profile-1-incremental-test.log",
                "restore-operation-1",
            )
        finally:
            setup.create_local_backup_context = original_create_context
            setup._manager_values = original_manager_values
            setup._install_runtime_helper = original_install_helper
            setup._read_profiles = original_read_profiles
            setup.resolve_activity = original_resolve_activity
            setup._restore_chain_for_backup = original_restore_chain
            setup._runtime_helper_request = original_runtime_helper_request

        self.assertFalse(result.succeeded)
        self.assertEqual(result.message, "Cannot restore incremental backup because its restore chain is incomplete.")
        self.assertEqual(result.output, "The preceding backup required for this incremental backup was not found")
        self.assertEqual(calls, ["install"])

    def test_restore_progress_and_abort_use_operation_id(self) -> None:
        calls = []
        context = FakeContext()
        original_create_context = setup.create_local_backup_context
        original_manager_values = setup._manager_values
        original_install_helper = setup._install_runtime_helper
        original_runtime_helper_request = setup._runtime_helper_request

        try:
            setup.create_local_backup_context = lambda: context
            setup._manager_values = lambda backup_home_path: {}
            setup._install_runtime_helper = lambda ctx, backup_home_path: "/backup-home/task-helper"
            setup._runtime_helper_request = (
                lambda ctx, backup_home_path, manager_values, operation, params:
                    calls.append((operation, params))
                    or {"state": "running", "operationId": "restore-operation-1", "output": "copying\n"}
            )

            progress = setup.get_activity_restore_progress(
                "/backup-home", "restore-operation-1",
            )
            abort_progress = setup.abort_activity_backup_restore(
                "/backup-home", "restore-operation-1",
            )
        finally:
            setup.create_local_backup_context = original_create_context
            setup._manager_values = original_manager_values
            setup._install_runtime_helper = original_install_helper
            setup._runtime_helper_request = original_runtime_helper_request

        self.assertEqual(progress.state, "running")
        self.assertEqual(progress.output, "copying\n")
        self.assertEqual(abort_progress.operationId, "restore-operation-1")
        self.assertEqual(calls, [
            ("backups.restore.progress", {
                "backupHome": "/backup-home",
                "operationId": "restore-operation-1",
            }),
            ("backups.restore.abort", {
                "backupHome": "/backup-home",
                "operationId": "restore-operation-1",
            }),
        ])

    def test_restore_activity_backup_reports_aborted_result(self) -> None:
        context = FakeContext()
        original_create_context = setup.create_local_backup_context
        original_manager_values = setup._manager_values
        original_install_helper = setup._install_runtime_helper
        original_read_profiles = setup._read_profiles
        original_runtime_helper_request = setup._runtime_helper_request

        try:
            setup.create_local_backup_context = lambda: context
            setup._manager_values = lambda backup_home_path: {}
            setup._install_runtime_helper = lambda ctx, backup_home_path: "/backup-home/task-helper"
            setup._read_profiles = lambda backup_home_path: []
            setup._runtime_helper_request = lambda *args: {
                "status": "aborted",
                "output": "copy-back started\n",
            }

            result = setup.restore_activity_backup(
                "/backup-home", "activity:v1:logs/full.log", "restore-operation-1",
            )
        finally:
            setup.create_local_backup_context = original_create_context
            setup._manager_values = original_manager_values
            setup._install_runtime_helper = original_install_helper
            setup._read_profiles = original_read_profiles
            setup._runtime_helper_request = original_runtime_helper_request

        self.assertFalse(result.succeeded)
        self.assertTrue(result.aborted)
        self.assertEqual(result.message, "MySQL Enterprise Backup restore was aborted.")
        self.assertEqual(result.output, "copy-back started\n")

    def test_restore_activity_backup_uses_local_profile_state(self) -> None:
        calls = []
        context = FakeContext()
        profile = MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination="/backup-home/nightly")
        refreshed_status = MebStatus(profiles=[profile])
        original_create_context = setup.create_local_backup_context
        original_manager_values = setup._manager_values
        original_install_helper = setup._install_runtime_helper
        original_read_profiles = setup._read_profiles
        original_runtime_helper_request = setup._runtime_helper_request
        original_build_status = setup.build_status

        try:
            setup.create_local_backup_context = lambda session=None: context
            setup._manager_values = lambda backup_home_path: {"datadir": "/mysql/data"}
            setup._install_runtime_helper = lambda ctx, backup_home_path: "/workbench/task-helper"
            setup._read_profiles = lambda backup_home_path: [profile]
            setup._runtime_helper_request = (
                lambda ctx, backup_home_path, manager_values, operation, params:
                    calls.append((operation, params)) or {"status": "restored"}
            )
            setup.build_status = lambda backup_home_path, manager_values, profiles: refreshed_status

            result = setup.restore_activity_backup(
                "/backup-home",
                "activity:v1:logs/20260707T120000Z-profile-1-full.log",
                "restore-1",
            )
        finally:
            setup.create_local_backup_context = original_create_context
            setup._manager_values = original_manager_values
            setup._install_runtime_helper = original_install_helper
            setup._read_profiles = original_read_profiles
            setup._runtime_helper_request = original_runtime_helper_request
            setup.build_status = original_build_status

        self.assertTrue(result.succeeded)
        self.assertIs(result.status, refreshed_status)
        self.assertEqual(calls, [("backups.restore", {
            "backupHome": "/backup-home",
            "backupId": "nightly/backup-1",
            "operationId": "restore-1",
            "force": False,
            "profileId": "profile-1",
        })])

    def test_delete_activity_backup_deletes_a_standalone_managed_log(self) -> None:
        calls = []
        context = FakeContext()
        refreshed_status = MebStatus()
        original_create_context = setup.create_local_backup_context
        original_manager_values = setup._manager_values
        original_install_helper = setup._install_runtime_helper
        original_runtime_helper_request = setup._runtime_helper_request
        original_read_profiles = setup._read_profiles
        original_build_status = setup.build_status

        try:
            setup.create_local_backup_context = lambda: context
            setup._manager_values = lambda backup_home_path: {}
            setup._install_runtime_helper = lambda ctx, backup_home_path: "/backup-home/task-helper"
            setup._read_profiles = lambda backup_home_path: []
            setup._runtime_helper_request = (
                lambda ctx, backup_home_path, manager_values, operation, params:
                    calls.append((operation, params)) or {"status": "deleted"}
            )
            setup.build_status = lambda backup_home_path, manager_values, profiles: refreshed_status

            status = setup.delete_activity_backup(
                "/backup-home",
                "activity:v1:logs/restore.log",
            )
        finally:
            setup.create_local_backup_context = original_create_context
            setup._manager_values = original_manager_values
            setup._install_runtime_helper = original_install_helper
            setup._runtime_helper_request = original_runtime_helper_request
            setup._read_profiles = original_read_profiles
            setup.build_status = original_build_status

        self.assertIs(status, refreshed_status)
        self.assertEqual(calls, [("backups.delete", {
            "backupHome": "/backup-home",
            "logId": "restore.log",
        })])

    def test_delete_activity_backup_deletes_a_verify_log_without_backup_data(self) -> None:
        calls = []
        context = FakeContext()
        profile = MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination="/backup-home/nightly")
        refreshed_status = MebStatus(profiles=[profile])
        original_create_context = setup.create_local_backup_context
        original_manager_values = setup._manager_values
        original_install_helper = setup._install_runtime_helper
        original_read_profiles = setup._read_profiles
        original_resolve_activity = setup.resolve_activity
        original_runtime_helper_request = setup._runtime_helper_request
        original_build_status = setup.build_status

        try:
            setup.create_local_backup_context = lambda: context
            setup._manager_values = lambda backup_home_path: {}
            setup._install_runtime_helper = lambda ctx, backup_home_path: "/backup-home/task-helper"
            setup._read_profiles = lambda backup_home_path: [profile]
            setup.resolve_activity = lambda backup_home_path, activity_id, profiles: resolved_activity(
                activity_id,
                "/backup-home/logs/20260707T120000Z-verify-profile-1-backup-1.log",
                None,
                activity_type="Verify",
            )
            setup._runtime_helper_request = (
                lambda ctx, backup_home_path, manager_values, operation, params:
                    calls.append((operation, params)) or {"status": "deleted"}
            )
            setup.build_status = lambda backup_home_path, manager_values, profiles: refreshed_status

            status = setup.delete_activity_backup("/backup-home", "activity:v1:logs/verify.log")
        finally:
            setup.create_local_backup_context = original_create_context
            setup._manager_values = original_manager_values
            setup._install_runtime_helper = original_install_helper
            setup._read_profiles = original_read_profiles
            setup.resolve_activity = original_resolve_activity
            setup._runtime_helper_request = original_runtime_helper_request
            setup.build_status = original_build_status

        self.assertIs(status, refreshed_status)
        self.assertEqual(calls, [("backups.delete", {
            "backupHome": "/backup-home",
            "logId": "20260707T120000Z-verify-profile-1-backup-1.log",
        })])

    def test_read_activity_backup_content_returns_manifest_rows(self) -> None:
        manifest_path = "/backup-home/nightly/2026-06-18_12-00-00/meta/backup_content.xml"
        full_backup_path = "/backup-home/nightly/2026-06-17_12-00-00"
        full_variables_path = f"{full_backup_path}/meta/backup_variables.txt"
        incremental_variables_path = "/backup-home/nightly/2026-06-18_12-00-00/meta/backup_variables.txt"
        context = FakeContext()
        context.target = FakeTarget()
        context.backend = FakeBackend({
            manifest_path: (
                "<manifest_backup_content>"
                "<backup_content>"
                "<definitions>"
                "<database><name>data</name><table><name>`app`.`orders`</name><engine>InnoDB</engine></table></database>"
                "</definitions>"
                "<file><name>meta/backup_variables.txt</name></file>"
                "<file><name>app/orders.ibd</name></file>"
                "</backup_content>"
                "</manifest_backup_content>"
            ),
            full_variables_path: "[backup_variables]\nis_incremental=0\nstart_time_utc=1781697600000000\n",
            incremental_variables_path: "[backup_variables]\nis_incremental=1\nstart_time_utc=1781784000000000\n",
        })
        context.has_connection = False
        profile = MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination="/backup-home/nightly")
        original_create_context = setup.create_local_backup_context
        original_read_profiles = setup._read_profiles
        original_restore_chain = setup._restore_chain_for_backup

        try:
            setup.create_local_backup_context = lambda session: context
            setup._read_profiles = lambda backup_home_path: [profile]
            setup._restore_chain_for_backup = lambda backup_home_path, backup_id: [
                full_backup_path,
                "/backup-home/nightly/2026-06-18_12-00-00",
            ]

            content = setup.read_activity_backup_content(
                None,
                "/backup-home",
                "activity:v1:logs/20260618T120000Z-profile-1-full-test.log",
            )
        finally:
            setup.create_local_backup_context = original_create_context
            setup._read_profiles = original_read_profiles
            setup._restore_chain_for_backup = original_restore_chain

        self.assertEqual(
            content.activityId,
            "activity:v1:logs/20260618T120000Z-profile-1-full-test.log",
        )
        self.assertEqual(content.backupLabel, "2026-06-18_12-00-00")
        self.assertEqual([(entry.name, entry.type, entry.timestamp) for entry in content.restoreChain], [
            ("2026-06-18_12-00-00", "Incremental", "2026-06-18 12:00:00 UTC"),
            ("2026-06-17_12-00-00", "Full", "2026-06-17 12:00:00 UTC"),
        ])
        self.assertFalse(content.hasInstanceData)
        self.assertEqual([group.category for group in content.fileGroups], ["Backup metadata", "Data files"])
        self.assertEqual([group.fileCount for group in content.fileGroups], [1, 1])
        self.assertEqual([group.files for group in content.fileGroups], [
            ["meta/backup_variables.txt"],
            ["app/orders.ibd"],
        ])
        self.assertEqual(len(content.rows), 1)
        self.assertEqual(content.rows[0].schema, "app")
        self.assertEqual(content.rows[0].table, "orders")
        self.assertEqual(content.rows[0].scope, "User")
        self.assertEqual(content.rows[0].coverage, "Logical table definition")
        self.assertTrue(content.rows[0].inBackup)
        self.assertFalse(content.rows[0].inInstance)
        self.assertEqual(content.rows[0].action, "Will be created")

    def test_read_activity_backup_content_marks_missing_previous_backup_in_restore_chain(self) -> None:
        manifest_path = "/backup-home/nightly/2026-06-18_12-00-00/meta/backup_content.xml"
        incremental_variables_path = "/backup-home/nightly/2026-06-18_12-00-00/meta/backup_variables.txt"
        context = FakeContext()
        context.target = FakeTarget()
        context.backend = FakeBackend({
            manifest_path: "<manifest_backup_content><backup_content /></manifest_backup_content>",
            incremental_variables_path: "[backup_variables]\nis_incremental=1\nstart_time_utc=1781784000000000\n",
        })
        context.has_connection = False
        profile = MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination="/backup-home/nightly")
        resolution_error = ValueError("The preceding backup required for this incremental backup was not found")
        resolution_error.partial_chain = ["/backup-home/nightly/2026-06-18_12-00-00"]  # type: ignore[attr-defined]
        resolution_error.missing_predecessor = True  # type: ignore[attr-defined]
        original_create_context = setup.create_local_backup_context
        original_read_profiles = setup._read_profiles
        original_restore_chain = setup._restore_chain_for_backup

        try:
            setup.create_local_backup_context = lambda session: context
            setup._read_profiles = lambda backup_home_path: [profile]

            def restore_chain_error(backup_home_path: str, backup_id: str) -> list[str]:
                raise resolution_error

            setup._restore_chain_for_backup = restore_chain_error
            content = setup.read_activity_backup_content(
                None,
                "/backup-home",
                "activity:v1:logs/20260618T120000Z-profile-1-full-test.log",
            )
        finally:
            setup.create_local_backup_context = original_create_context
            setup._read_profiles = original_read_profiles
            setup._restore_chain_for_backup = original_restore_chain

        self.assertEqual([(entry.name, entry.type, entry.timestamp) for entry in content.restoreChain], [
            ("2026-06-18_12-00-00", "Incremental", "2026-06-18 12:00:00 UTC"),
            ("Previous backup not found", None, None),
        ])

    def test_backup_content_rows_map_instance_impact(self) -> None:
        backup_content = types.SimpleNamespace(
            _sorted_schemas=["app"],
            _schema_data={
                "app": {
                    "sorted_tables": ["existing", "gone", "myisam", "new"],
                    "tables": {
                        "existing": {"include": True, "on_db": True, "engine": "InnoDB"},
                        "gone": {"include": False, "on_db": True, "engine": "InnoDB"},
                        "myisam": {"include": False, "on_db": True, "engine": "MyISAM"},
                        "new": {"include": True, "on_db": False, "engine": "Unknown"},
                    },
                },
            },
        )

        rows = setup._backup_content_rows(backup_content)

        self.assertEqual([row.action for row in rows], [
            "Table will be updated",
            "Table will be deleted",
            "Table will not be affected",
            "Will be created",
        ])

    def test_backup_content_rows_do_not_diff_system_schemas_at_table_level(self) -> None:
        backup_content = types.SimpleNamespace(
            _sorted_schemas=["mysql"],
            _schema_data={
                "mysql": {
                    "sorted_tables": ["backup_history", "user"],
                    "tables": {
                        "backup_history": {"include": True, "on_db": True, "engine": "InnoDB"},
                        "user": {"include": False, "on_db": True, "engine": "InnoDB"},
                    },
                },
            },
        )

        rows = setup._backup_content_rows(backup_content)

        self.assertEqual([row.scope for row in rows], ["System", "System"])
        self.assertEqual([row.coverage for row in rows], ["System metadata listed", "Current system object"])
        self.assertEqual([row.action for row in rows], [
            "Not evaluated at table level",
            "Not evaluated at table level",
        ])

    def test_manifest_file_groups_summarize_server_files(self) -> None:
        manifest = {
            "backup_content": {
                "file": [
                    {"name": "meta/backup_content.xml"},
                    {"name": "mysql/user.ibd"},
                    {"name": "#innodb_redo/ib_redo0"},
                    {"name": "binlog.000001"},
                ],
            },
        }

        groups = setup._manifest_file_groups(manifest)

        self.assertEqual(
            [(group.category, group.fileCount) for group in groups],
            [
                ("Backup metadata", 1),
                ("Binary and relay logs", 1),
                ("Data files", 1),
                ("Redo log files", 1),
            ],
        )
        self.assertEqual(
            [group.files for group in groups],
            [
                ["meta/backup_content.xml"],
                ["binlog.000001"],
                ["mysql/user.ibd"],
                ["#innodb_redo/ib_redo0"],
            ],
        )

    def test_workbench8_mysqlbackup_metadata_is_migrated_before_job_sync(self) -> None:
        path = "/backup-home/nightly.cnf"
        context = FakeContext()
        context.backend = FakeBackend({
            path: "\n".join([
                "[meb_manager]",
                "uuid = profile-1",
                "",
                "[mysqlbackup]",
                "backup_dir = /backup-home/nightly",
                "command = /usr/bin/mysqlbackup",
                "basedir = /usr",
                "",
            ]),
        })
        profile = MebBackupProfileInfo(
            uuid="profile-1",
            command="/usr/bin/mysqlbackup",
            mysqlBasedir="/usr",
            configPath=path,
        )

        _remove_legacy_mysqlbackup_metadata_options(context, [profile])

        config = configparser.RawConfigParser()
        config.read_string(context.backend.files[path])
        self.assertEqual(config.get("meb_manager", "command"), "/usr/bin/mysqlbackup")
        self.assertEqual(config.get("meb_manager", "basedir"), "/usr")
        self.assertFalse(config.has_option("mysqlbackup", "command"))
        self.assertFalse(config.has_option("mysqlbackup", "basedir"))

    def test_incremental_jobs_include_incremental_options(self) -> None:
        profile = MebBackupProfileInfo(
            uuid="profile-1",
            label="nightly",
            destination="/backups/full",
            configPath="/backup-home/nightly.cnf",
            fullSchedule=daily_schedule("1", "00"),
            incSchedule=daily_schedule("2", "00"),
            incrementalBase="history:last_full_backup",
        )

        jobs = _profile_jobs([profile], scheduled_only=True)

        full_job = next(job for job in jobs if job["backupMode"] == "full")
        incremental_job = next(job for job in jobs if job["backupMode"] == "incremental")
        self.assertEqual(full_job["id"], "profile-1-backup-full")
        self.assertEqual(incremental_job["id"], "profile-1-backup-incremental")
        self.assertEqual(incremental_job["incrementalBase"], "history:last_full_backup")
        self.assertEqual(incremental_job["outputDirectory"], "/backups/full")

    def test_daily_schedule_interval_is_written_as_cron_step(self) -> None:
        profile = MebBackupProfileInfo(
            uuid="profile-1",
            label="nightly",
            destination="/backups/full",
            configPath="/backup-home/nightly.cnf",
            fullSchedule=daily_schedule("1", "00", interval="3"),
        )

        jobs = _profile_jobs([profile], scheduled_only=True)

        self.assertEqual(jobs[0]["schedule"]["dayOfMonth"], "*/3")

    def test_hourly_schedule_interval_is_written_as_cron_step(self) -> None:
        profile = MebBackupProfileInfo(
            uuid="profile-1",
            label="nightly",
            destination="/backups/full",
            configPath="/backup-home/nightly.cnf",
            fullSchedule=hourly_schedule("15", interval="4"),
        )

        jobs = _profile_jobs([profile], scheduled_only=True)

        self.assertEqual(jobs[0]["schedule"]["hour"], "*/4")

    def test_schedule_conversion_enforces_frequency_interval_limit(self) -> None:
        for schedule, maximum in (
            (hourly_schedule("15", interval="24"), 23),
            (MebProfileSchedule(
                enabled=True,
                interval=2,
                frequency=2,
                weekDays=[False, True, False, False, False, False, False],
            ), 1),
        ):
            with self.subTest(frequency=schedule.frequency):
                profile = MebBackupProfileInfo(
                    uuid="profile-1",
                    destination="/backups/full",
                    configPath="/backup-home/nightly.cnf",
                    fullSchedule=schedule,
                )

                with self.assertRaisesRegex(
                    ValueError,
                    f"interval must be between 1 and {maximum}",
                ):
                    _profile_jobs([profile], scheduled_only=True)

    def test_sync_profile_jobs_reports_scheduler_install_failure(self) -> None:
        profile = MebBackupProfileInfo(
            uuid="profile-1",
            label="nightly",
            destination="/backup-home/nightly",
            configPath="/backup-home/profile-1.cnf",
            fullSchedule=daily_schedule("1", "00"),
        )
        original_runtime_helper_request = setup._runtime_helper_request

        try:
            for result in (
                {
                    "status": "failed",
                    "message": "ERROR: Access is denied.",
                    "exitCode": 1,
                    "timedOut": False,
                },
                {
                    "status": "failed",
                    "message": "Installing the scheduled backup job timed out.",
                    "exitCode": 0,
                    "timedOut": True,
                },
            ):
                with self.subTest(result=result):
                    setup._runtime_helper_request = lambda *args: result

                    with self.assertRaisesRegex(
                        ValueError,
                        f"profile-1-backup-full.*{re.escape(result['message'])}",
                    ):
                        _sync_profile_jobs(
                            FakeContext(),
                            "/backup-home",
                            {},
                            MebStatus(profiles=[profile]),
                            scheduled_only=True,
                        )
        finally:
            setup._runtime_helper_request = original_runtime_helper_request

    def test_sync_profile_jobs_accepts_scheduler_job_already_absent(self) -> None:
        profile = MebBackupProfileInfo(
            uuid="profile-1",
            label="nightly",
            destination="/backup-home/nightly",
            configPath="/backup-home/profile-1.cnf",
        )
        original_runtime_helper_request = setup._runtime_helper_request
        calls = []

        try:
            def remove_job(*args: object) -> dict[str, object]:
                calls.append(args)

                return {
                    "status": "notFound",
                    "message": "Scheduled backup job was already absent.",
                    "exitCode": 0,
                    "timedOut": False,
                }

            setup._runtime_helper_request = remove_job

            _sync_profile_jobs(
                FakeContext(),
                "/backup-home",
                {},
                MebStatus(profiles=[profile]),
                scheduled_only=True,
            )
        finally:
            setup._runtime_helper_request = original_runtime_helper_request

        self.assertEqual(len(calls), 2)

    def test_sync_profile_jobs_persists_interactive_fallback_before_next_install(self) -> None:
        profile = MebBackupProfileInfo(
            uuid="profile-1",
            label="nightly",
            destination="/backup-home/nightly",
            configPath="/backup-home/profile-1.cnf",
            fullSchedule=daily_schedule("1", "00"),
            incSchedule=daily_schedule("2", "00"),
        )
        manager_values = {
            "scheduler_backend": "schtasks",
            "windows_logon_type": "S4U",
        }
        events: list[tuple[object, ...]] = []

        def request(
            _context: object,
            _backup_home_path: str,
            values: dict[str, str],
            operation: str,
            params: dict[str, str],
        ) -> dict[str, object]:
            events.append(("install", params["jobId"], values["windows_logon_type"]))

            return {
                "status": "installed",
                "exitCode": 0,
                "timedOut": False,
                "stdoutTruncated": False,
                "stderrTruncated": False,
                "logonType": "InteractiveToken",
            }

        def write_config(path: str, values: dict[str, str]) -> None:
            events.append(("write", path, values["windows_logon_type"]))

        with patched_setup(
            _runtime_helper_request=request,
            _write_manager_config=write_config,
        ):
            changed = _sync_profile_jobs(
                FakeContext(),
                "/backup-home",
                manager_values,
                MebStatus(profiles=[profile]),
                scheduled_only=True,
            )

        self.assertTrue(changed)
        self.assertEqual(manager_values["windows_logon_type"], "InteractiveToken")
        self.assertEqual(events, [
            ("install", "profile-1-backup-full", "S4U"),
            ("write", "/backup-home/backups.cnf", "InteractiveToken"),
            ("install", "profile-1-backup-incremental", "InteractiveToken"),
        ])

    def test_sync_profile_jobs_reports_scheduler_removal_failure_details(self) -> None:
        profile = MebBackupProfileInfo(
            uuid="profile-1",
            label="nightly",
            destination="/backup-home/nightly",
            configPath="/backup-home/profile-1.cnf",
        )
        original_runtime_helper_request = setup._runtime_helper_request

        try:
            setup._runtime_helper_request = lambda *args: {
                "status": "failed",
                "message": "ERROR: Access is denied.",
                "exitCode": 5,
                "timedOut": False,
            }

            with self.assertRaisesRegex(
                ValueError,
                "profile-1-backup-.*ERROR: Access is denied",
            ):
                _sync_profile_jobs(
                    FakeContext(),
                    "/backup-home",
                    {},
                    MebStatus(profiles=[profile]),
                    scheduled_only=True,
                )
        finally:
            setup._runtime_helper_request = original_runtime_helper_request

    def test_monthly_schedule_writes_all_selected_days(self) -> None:
        profile = MebBackupProfileInfo(
            uuid="profile-1",
            label="monthly",
            destination="/backups/monthly",
            configPath="/backup-home/monthly.cnf",
            fullSchedule=monthly_schedule("2", "30", "1,15,30"),
        )

        jobs = _profile_jobs([profile], scheduled_only=True)

        self.assertEqual(jobs[0]["schedule"]["dayOfMonth"], "1,15,30")
        self.assertEqual(jobs[0]["schedule"]["hour"], "2")
        self.assertEqual(jobs[0]["schedule"]["minute"], "30")

if __name__ == "__main__":
    unittest.main()
