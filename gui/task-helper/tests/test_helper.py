# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.

from __future__ import annotations

import codecs
import configparser
import importlib.machinery
import importlib.util
import json
import os
import plistlib
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from dataclasses import replace
from pathlib import Path, PurePath
from unittest import mock

HELPER_ROOT = Path(__file__).resolve().parents[1]
HELPER_PATH = HELPER_ROOT / "task-helper"
SETUP_PATH = HELPER_ROOT / "task-helper-setup"
SETUP_MODULE_PATH = HELPER_ROOT / "task_helper_setup.py"
HELPER_LOADER = importlib.machinery.SourceFileLoader("task_helper_script", HELPER_PATH.as_posix())
HELPER_SPEC = importlib.util.spec_from_loader(HELPER_LOADER.name, HELPER_LOADER)
helper = importlib.util.module_from_spec(HELPER_SPEC)
sys.modules[HELPER_LOADER.name] = helper
HELPER_LOADER.exec_module(helper)
SETUP_LOADER = importlib.machinery.SourceFileLoader("task_helper_setup", SETUP_MODULE_PATH.as_posix())
SETUP_SPEC = importlib.util.spec_from_loader(SETUP_LOADER.name, SETUP_LOADER)
setup_helper = importlib.util.module_from_spec(SETUP_SPEC)
sys.modules[SETUP_LOADER.name] = setup_helper
SETUP_LOADER.exec_module(setup_helper)

TARGET_USER_NAME = "mysqlbackup"
HELPER_VERSION = helper.HELPER_VERSION
helper_config = helper.helper_config
HelperError = helper.HelperError
install_managed_job_block = helper.install_managed_job_block
remove_managed_job_block = helper.remove_managed_job_block
handle_request = helper.handle_request
run_process_plan = helper.run_process_plan
validate_process_plan = helper.validate_process_plan
HelperConfig = helper.HelperConfig
ProcessPlan = helper.ProcessPlan
TargetUser = helper.TargetUser


def checks_by_id(result: dict[str, object]) -> dict[str, dict[str, str]]:
    return {check["id"]: check for check in result["checks"]}  # type: ignore[index]


def actions_by_id(result: dict[str, object]) -> dict[str, dict[str, str]]:
    return {action["id"]: action for action in result["actions"]}  # type: ignore[index]


def make_config(root: Path) -> HelperConfig:
    return HelperConfig(
        backup_home=(root / "backups").as_posix(),
        target_user_name="mysqlbackup",
        target_user=TargetUser(uid=1, gid=1),
        mysqlbackup="/usr/bin/mysqlbackup",
        login_file=(root / "backups" / ".mylogin.cnf").as_posix(),
        login_path="mysql_workbench_meb_test",
        crontab="/usr/bin/crontab",
        job_runner="/usr/bin/true",
        backup_roots=[(root / "backups").as_posix()],
        option_file_roots=[(root / "options").as_posix()],
        working_directory="/",
        timeout_ms=1000,
        max_output_bytes=65536,
        scheduler_backend="cron",
    )


def copy_config(config: HelperConfig, **overrides: object) -> HelperConfig:
    return replace(config, **overrides)


def write_runtime_config(root: Path, backup_home: Path, data_dir: Path) -> None:
    current_user = helper._current_user()
    parser = configparser.RawConfigParser()
    parser.add_section("meb")
    values = {
        "datadir": data_dir.as_posix(),
        "mysqlbackup": "/usr/bin/true",
        "backup_os_user": str(current_user["name"]),
        "backup_os_uid": str(current_user["uid"]),
        "backup_os_gid": str(current_user["gid"]),
        "login_file": (backup_home / ".mylogin.cnf").as_posix(),
        "login_path": "mysql_workbench_meb_test",
        "crontab": "/usr/bin/true",
        "job_runner": HELPER_PATH.as_posix(),
        "backup_root": (root / "backups").as_posix(),
        "option_file_root": backup_home.as_posix(),
        "working_directory": backup_home.as_posix(),
        "timeout_ms": "1000",
        "max_output_bytes": "65536",
        "launchctl": "/usr/bin/true",
        "schtasks": "/usr/bin/true",
        "scheduler_backend": "cron",
        "launchd_plist_dir": (backup_home / "launchd").as_posix(),
        "windows_task_folder": r"\MySQLWorkbench",
        "windows_logon_type": "InteractiveToken",
    }
    for key, value in values.items():
        parser.set("meb", key, value)

    config_path = backup_home / "backups.cnf"
    with config_path.open("w", encoding="utf-8") as config_file:
        parser.write(config_file)
    if os.name == "posix":
        config_path.chmod(0o600)


class HelperTests(unittest.TestCase):
    def run_setup_request(self, request: dict[str, object]) -> dict[str, object]:
        result = subprocess.run(
            [str(SETUP_PATH)],
            cwd=tempfile.gettempdir(),
            env={
                "PATH": os.environ.get("PATH", ""),
                "PYTHONDONTWRITEBYTECODE": "1",
            },
            input=json.dumps(request),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def make_fixture(self) -> tuple[Path, HelperConfig, Path, Path]:
        root = Path(tempfile.mkdtemp(prefix="task-helper-test-")).resolve()
        backup_dir = root / "backups" / "job-1"
        option_dir = root / "options"
        option_file = option_dir / "mysql.cnf"

        backup_dir.mkdir(parents=True)
        option_dir.mkdir(parents=True)
        option_file.write_text("[client]\n", encoding="utf-8")

        return root, make_config(root), backup_dir, option_file

    def make_backup_home_fixture(self) -> tuple[Path, HelperConfig, Path, Path, Path]:
        root = Path(tempfile.mkdtemp(prefix="task-helper-backup-home-")).resolve()
        backup_home = root / "backups" / "backup-home"
        data_dir = root / "mysql-data"
        config_file = backup_home / "backups.cnf"

        backup_home.mkdir(parents=True)
        data_dir.mkdir()
        config_file.write_text(f"[meb]\ndatadir = {data_dir.as_posix()}\n", encoding="utf-8")
        if os.name == "posix":
            backup_home.chmod(0o700)
            config_file.chmod(0o600)

        config = copy_config(
            make_config(root),
            backup_home=backup_home.as_posix(),
            option_file_roots=[backup_home.as_posix()],
        )

        return root, config, backup_home, data_dir, config_file

    def make_job_fixture(self) -> tuple[Path, HelperConfig, Path, Path, Path]:
        root, config, backup_home, _data_dir, _config_file = self.make_backup_home_fixture()
        output_dir = root / "backups" / "job-output"
        option_dir = root / "options"
        option_file = option_dir / "mysql.cnf"

        output_dir.mkdir()
        option_dir.mkdir()
        option_file.write_text("[client]\n", encoding="utf-8")

        return root, config, backup_home, output_dir, option_file

    def write_profile_config(
        self,
        backup_home: Path,
        output_dir: Path,
        profile_id: str = "nightly",
        storage_type: str = "local",
        cloud_service: str | None = None,
        incremental_base: str = "history:last_backup",
        full_schedule: bool = False,
        manager_options: dict[str, str] | None = None,
    ) -> Path:
        profile_path = backup_home / f"{profile_id}.cnf"
        profile_path.write_text("\n".join([
            "[meb_manager]",
            f"uuid = {profile_id}",
            f"storage_type = {storage_type}",
            *([f"{key} = {value}" for key, value in manager_options.items()] if manager_options else []),
            *([
                "full_backups_enabled = 1",
                "full_backups_frequency = 1",
                "full_backups_hour = 2",
                "full_backups_minute = 15",
            ] if full_schedule else []),
            "",
            "[mysqlbackup]",
            f"backup_dir = {output_dir.as_posix()}",
            f"incremental_base = {incremental_base}",
            *([f"cloud_service = {cloud_service}"] if cloud_service else []),
            "",
        ]), encoding="utf-8")
        if os.name == "posix":
            profile_path.chmod(0o600)

        return profile_path

    def create_single_profile(self, backup_home: Path, output_dir: Path) -> dict[str, object]:
        profile_path = self.write_profile_config(backup_home, output_dir)

        return {"profilePath": profile_path.as_posix()}

    def test_unknown_operations_are_rejected_before_planning(self) -> None:
        _, config, _, _ = self.make_fixture()

        response = handle_request({
            "operation": "process.run",
            "params": {},
            "dryRun": True,
        }, config, allow_dry_run=True)

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "unknown_operation")

    def test_public_requests_cannot_use_dry_run(self) -> None:
        _, config, _, _ = self.make_fixture()

        response = handle_request({
            "operation": "cron.removeManagedJob",
            "dryRun": True,
            "params": {
                "jobId": "nightly-backup-full",
            },
        }, config)

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "invalid_request")

    def test_self_test_reports_missing_bootstrap_config(self) -> None:
        result = subprocess.run(
            [str(HELPER_PATH), "--self-test"],
            cwd=tempfile.gettempdir(),
            env={
                "PATH": os.environ.get("PATH", ""),
                "PYTHONDONTWRITEBYTECODE": "1",
            },
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["version"], HELPER_VERSION)
        self.assertFalse(payload["configLoaded"])
        self.assertNotIn("backupHome.setup", payload["capabilities"])

    def test_self_test_loads_config_from_explicit_backup_home(self) -> None:
        root, _config, backup_home, data_dir, _config_file = self.make_backup_home_fixture()
        write_runtime_config(root, backup_home, data_dir)

        result = subprocess.run(
            [str(HELPER_PATH), "--backup-home", backup_home.as_posix(), "--self-test"],
            cwd=tempfile.gettempdir(),
            env={
                "PATH": os.environ.get("PATH", ""),
                "PYTHONDONTWRITEBYTECODE": "1",
            },
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertTrue(payload["configLoaded"], payload)

    def test_public_request_loads_config_from_explicit_backup_home(self) -> None:
        root, _config, backup_home, data_dir, _config_file = self.make_backup_home_fixture()
        write_runtime_config(root, backup_home, data_dir)

        response = handle_request({
            "backupHome": backup_home.as_posix(),
            "operation": "backupHome.readConfig",
            "params": {
                "backupHome": backup_home.as_posix(),
            },
        })

        self.assertTrue(response["ok"], response)
        self.assertEqual(response["result"]["backupHome"], backup_home.as_posix())

    def test_public_request_rejects_mismatched_operation_backup_home(self) -> None:
        root, _config, backup_home, data_dir, _config_file = self.make_backup_home_fixture()
        write_runtime_config(root, backup_home, data_dir)
        other_backup_home = root / "backups" / "other-home"
        other_backup_home.mkdir(mode=0o700)

        response = handle_request({
            "backupHome": backup_home.as_posix(),
            "operation": "backupHome.readConfig",
            "params": {
                "backupHome": other_backup_home.as_posix(),
            },
        })

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "invalid_request")
        self.assertIn("does not match", response["error"]["message"])

    def test_setup_self_test_reports_setup_capability(self) -> None:
        result = subprocess.run(
            [str(SETUP_PATH), "--self-test"],
            cwd=tempfile.gettempdir(),
            env={
                "PATH": os.environ.get("PATH", ""),
                "PYTHONDONTWRITEBYTECODE": "1",
            },
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["version"], HELPER_VERSION)
        self.assertEqual(payload["capabilities"], ["backupHome.setup"])
        self.assertEqual(setup_helper.CAPABILITIES, ["backupHome.setup"])

    def test_helper_rejects_unexpected_cli_arguments(self) -> None:
        result = subprocess.run(
            [str(HELPER_PATH), "--unexpected"],
            cwd=tempfile.gettempdir(),
            env={
                "PATH": os.environ.get("PATH", ""),
                "PYTHONDONTWRITEBYTECODE": "1",
            },
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 64, result.stderr)
        payload = json.loads(result.stdout)
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["error"]["code"], "invalid_request")

    def test_setup_rejects_unexpected_cli_arguments(self) -> None:
        result = subprocess.run(
            [str(SETUP_PATH), "--unexpected"],
            cwd=tempfile.gettempdir(),
            env={
                "PATH": os.environ.get("PATH", ""),
                "PYTHONDONTWRITEBYTECODE": "1",
            },
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 64, result.stderr)
        payload = json.loads(result.stdout)
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["error"]["code"], "invalid_request")

    def test_helper_tree_runs_standalone_after_copy(self) -> None:
        source_root = HELPER_ROOT
        target_root = Path(tempfile.mkdtemp(prefix="task-helper-standalone-")) / "helper"
        shutil.copytree(
            source_root,
            target_root,
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
        )

        result = subprocess.run(
            [str(target_root / "task-helper"), "--self-test"],
            cwd=tempfile.gettempdir(),
            env={
                "PATH": os.environ.get("PATH", ""),
                "PYTHONDONTWRITEBYTECODE": "1",
            },
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["version"], HELPER_VERSION)
        self.assertFalse(payload["configLoaded"])
        self.assertIn("jobs.execute", payload["capabilities"])
        self.assertIn("backups.verify", payload["capabilities"])
        self.assertNotIn("mysqlbackup.run", payload["capabilities"])
        self.assertNotIn("backupHome.setup", payload["capabilities"])

        setup_result = subprocess.run(
            [str(target_root / "task-helper-setup"), "--self-test"],
            cwd=tempfile.gettempdir(),
            env={
                "PATH": os.environ.get("PATH", ""),
                "PYTHONDONTWRITEBYTECODE": "1",
            },
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        self.assertEqual(setup_result.returncode, 0, setup_result.stderr)
        setup_payload = json.loads(setup_result.stdout)
        self.assertEqual(setup_payload["capabilities"], ["backupHome.setup"])

    def test_backup_home_setup_installs_helper_and_writes_manager_config(self) -> None:
        _root, _config, backup_home, data_dir, config_file = self.make_backup_home_fixture()
        safe_executable = Path("/bin/echo") if Path("/bin/echo").exists() else Path(sys.executable)
        config_file.unlink()

        response = self.run_setup_request({
            "operation": "backupHome.setup",
            "params": {
                "backupHome": backup_home.as_posix(),
                "dataDir": data_dir.as_posix(),
                "mysqlbackup": safe_executable.as_posix(),
                "crontab": safe_executable.as_posix(),
                "launchctl": safe_executable.as_posix(),
                "schtasks": safe_executable.as_posix(),
                "schedulerBackend": "cron",
            },
        })

        self.assertTrue(response["ok"], response)
        result = response["result"]
        self.assertEqual(result["status"], "setup")
        helper_path = backup_home / ("task-helper.cmd" if os.name == "nt" else "task-helper")
        self.assertEqual(result["helperPath"], helper_path.as_posix())
        self.assertTrue(helper_path.exists())
        self.assertTrue(config_file.exists())
        if os.name == "posix":
            self.assertEqual(oct(helper_path.stat().st_mode & 0o777), "0o700")
            self.assertEqual(oct(config_file.stat().st_mode & 0o777), "0o600")

        installed = subprocess.run(
            [str(helper_path), "--self-test"],
            cwd=tempfile.gettempdir(),
            env={
                "PATH": os.environ.get("PATH", ""),
                "PYTHONDONTWRITEBYTECODE": "1",
            },
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        self.assertEqual(installed.returncode, 0, installed.stderr)
        payload = json.loads(installed.stdout)
        self.assertTrue(payload["ok"])
        self.assertTrue(payload["configLoaded"])
        self.assertEqual(payload["targetUser"], result["effectiveUser"]["name"])
        self.assertEqual(payload["jobRunner"], helper_path.as_posix())

    def test_backup_home_setup_defaults_windows_logon_type_to_s4u(self) -> None:
        root, _config, backup_home, data_dir, _config_file = self.make_backup_home_fixture()
        helper_path = root / "task-helper"
        user = {"name": "backup-user", "uid": 1, "gid": 1}

        with mock.patch.object(
            setup_helper,
            "_setup_executable",
            side_effect=lambda value, _name, default: str(value or f"/usr/bin/{default}"),
        ):
            values = setup_helper._config_values({}, backup_home, data_dir, helper_path, user)

        self.assertEqual(values["windows_logon_type"], "S4U")

    def test_backup_home_setup_accepts_infinite_process_timeout(self) -> None:
        root, _config, backup_home, data_dir, _config_file = self.make_backup_home_fixture()
        helper_path = root / "task-helper"
        user = {"name": "backup-user", "uid": 1, "gid": 1}

        with mock.patch.object(
            setup_helper,
            "_setup_executable",
            side_effect=lambda value, _name, default: str(value or f"/usr/bin/{default}"),
        ):
            values = setup_helper._config_values(
                {"timeoutMs": 0},
                backup_home,
                data_dir,
                helper_path,
                user,
            )

        self.assertEqual(values["timeout_ms"], "0")

    def test_backup_home_setup_rejects_negative_process_timeout(self) -> None:
        root, _config, backup_home, data_dir, _config_file = self.make_backup_home_fixture()
        helper_path = root / "task-helper"
        user = {"name": "backup-user", "uid": 1, "gid": 1}

        with mock.patch.object(
            setup_helper,
            "_setup_executable",
            side_effect=lambda value, _name, default: str(value or f"/usr/bin/{default}"),
        ):
            with self.assertRaisesRegex(
                setup_helper.HelperError,
                r"timeoutMs must not be negative\.",
            ):
                setup_helper._config_values(
                    {"timeoutMs": -1},
                    backup_home,
                    data_dir,
                    helper_path,
                    user,
                )

    def test_backup_home_setup_rejects_unsupported_windows_logon_type(self) -> None:
        root, _config, backup_home, data_dir, _config_file = self.make_backup_home_fixture()
        helper_path = root / "task-helper"
        user = {"name": "backup-user", "uid": 1, "gid": 1}

        with mock.patch.object(
            setup_helper,
            "_setup_executable",
            side_effect=lambda value, _name, default: str(value or f"/usr/bin/{default}"),
        ):
            with self.assertRaisesRegex(
                setup_helper.HelperError,
                "Windows logon type Password is not supported\\.",
            ):
                setup_helper._config_values(
                    {"windowsLogonType": "Password"},
                    backup_home,
                    data_dir,
                    helper_path,
                    user,
                )

    def test_backup_home_setup_rejects_executable_from_writable_directory(self) -> None:
        root, _config, backup_home, data_dir, config_file = self.make_backup_home_fixture()
        if os.name != "posix":
            self.skipTest("POSIX executable trust test")
        unsafe_dir = root / "unsafe-bin"
        unsafe_dir.mkdir()
        unsafe_dir.chmod(0o777)
        unsafe_executable = unsafe_dir / "mysqlbackup"
        unsafe_executable.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
        unsafe_executable.chmod(0o755)
        safe_executable = Path("/bin/echo") if Path("/bin/echo").exists() else Path(sys.executable)
        config_file.unlink()

        response = self.run_setup_request({
            "operation": "backupHome.setup",
            "params": {
                "backupHome": backup_home.as_posix(),
                "dataDir": data_dir.as_posix(),
                "mysqlbackup": unsafe_executable.as_posix(),
                "crontab": safe_executable.as_posix(),
                "launchctl": safe_executable.as_posix(),
                "schtasks": safe_executable.as_posix(),
                "schedulerBackend": "cron",
            },
        })

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "invalid_request")
        self.assertFalse(config_file.exists())

    def test_backup_home_validate_accepts_expected_owner_permissions_and_datadir(self) -> None:
        _, config, backup_home, data_dir, _ = self.make_backup_home_fixture()

        response = handle_request({
            "operation": "backupHome.validate",
            "params": {
                "backupHome": backup_home.as_posix(),
                "dataDir": data_dir.as_posix(),
            },
        }, config)

        self.assertTrue(response["ok"])
        result = response["result"]
        self.assertEqual(result["status"], "valid")
        checks = checks_by_id(result)
        self.assertEqual(checks["backupHome.path"]["status"], "pass")
        self.assertEqual(checks["backupHome.owner"]["status"], "pass")
        self.assertEqual(checks["backupHome.permissions"]["status"], "pass")
        self.assertEqual(checks["config.path"]["status"], "pass")
        self.assertEqual(checks["config.dataDir"]["status"], "pass")

    def test_backup_home_validate_reports_datadir_mismatch(self) -> None:
        root, config, backup_home, data_dir, config_file = self.make_backup_home_fixture()
        other_data_dir = root / "other-data"
        other_data_dir.mkdir()
        config_file.write_text(f"[meb]\ndatadir = {other_data_dir.as_posix()}\n", encoding="utf-8")
        if os.name == "posix":
            config_file.chmod(0o600)

        response = handle_request({
            "operation": "backupHome.validate",
            "params": {
                "backupHome": backup_home.as_posix(),
                "dataDir": data_dir.as_posix(),
            },
        }, config)

        self.assertTrue(response["ok"])
        result = response["result"]
        self.assertEqual(result["status"], "invalid")
        checks = checks_by_id(result)
        self.assertEqual(checks["config.dataDir"]["status"], "fail")

    def test_backup_home_validate_does_not_echo_malformed_config_contents(self) -> None:
        _, config, backup_home, data_dir, config_file = self.make_backup_home_fixture()
        config_file.write_text("password=secret\n", encoding="utf-8")
        if os.name == "posix":
            config_file.chmod(0o600)

        response = handle_request({
            "operation": "backupHome.validate",
            "params": {
                "backupHome": backup_home.as_posix(),
                "dataDir": data_dir.as_posix(),
            },
        }, config)

        self.assertTrue(response["ok"])
        result = response["result"]
        checks = checks_by_id(result)
        self.assertEqual(checks["config.parse"]["status"], "fail")
        self.assertNotIn("secret", str(result))

    def test_backup_home_validate_coalesces_config_path_shape_checks(self) -> None:
        _, config, backup_home, data_dir, config_file = self.make_backup_home_fixture()
        config_file.unlink()

        response = handle_request({
            "operation": "backupHome.validate",
            "params": {
                "backupHome": backup_home.as_posix(),
                "dataDir": data_dir.as_posix(),
            },
        }, config)

        self.assertTrue(response["ok"])
        result = response["result"]
        self.assertEqual(result["status"], "invalid")
        check_ids = {check["id"] for check in result["checks"]}
        self.assertIn("config.path", check_ids)
        self.assertNotIn("config.exists", check_ids)
        self.assertNotIn("config.isRegularFile", check_ids)
        self.assertNotIn("config.notSymlink", check_ids)

    def test_backup_home_repair_fixes_owner_safe_file_modes(self) -> None:
        _, config, backup_home, data_dir, config_file = self.make_backup_home_fixture()
        if os.name != "posix":
            self.skipTest("POSIX file mode repair test")
        backup_home.chmod(0o777)
        config_file.chmod(0o666)

        response = handle_request({
            "operation": "backupHome.repair",
            "params": {
                "backupHome": backup_home.as_posix(),
            },
        }, config)

        self.assertTrue(response["ok"])
        result = response["result"]
        self.assertEqual(result["status"], "repaired")
        actions = actions_by_id(result)
        self.assertIn(actions["backupHome.permissions"]["status"], {"changed", "unchanged"})
        self.assertIn(actions["config.permissions"]["status"], {"changed", "unchanged"})

        validation = handle_request({
            "operation": "backupHome.validate",
            "params": {
                "backupHome": backup_home.as_posix(),
                "dataDir": data_dir.as_posix(),
            },
        }, config)

        self.assertTrue(validation["ok"])
        self.assertEqual(validation["result"]["status"], "valid")

    def test_backup_home_repair_refuses_paths_outside_backup_roots(self) -> None:
        root, config, _, _, _ = self.make_backup_home_fixture()
        if os.name != "posix":
            self.skipTest("POSIX file mode repair test")
        outside = root / "outside"
        outside.mkdir()
        outside.chmod(0o777)
        outside_config = copy_config(config, backup_home=outside.as_posix())

        response = handle_request({
            "operation": "backupHome.repair",
            "params": {
                "backupHome": outside.as_posix(),
            },
        }, outside_config)

        self.assertTrue(response["ok"])
        result = response["result"]
        self.assertEqual(result["status"], "failed")
        actions = actions_by_id(result)
        self.assertEqual(actions["backupHome.root"]["status"], "failed")
        self.assertEqual(oct(outside.stat().st_mode & 0o777), "0o777")

    def test_backup_home_write_and_read_config_use_safe_schema(self) -> None:
        _, config, backup_home, data_dir, config_file = self.make_backup_home_fixture()
        config_file.unlink()

        write_response = handle_request({
            "operation": "backupHome.writeConfig",
            "params": {
                "backupHome": backup_home.as_posix(),
                "dataDir": data_dir.as_posix(),
            },
        }, config)

        self.assertTrue(write_response["ok"])
        write_result = write_response["result"]
        self.assertEqual(write_result["status"], "written")
        self.assertEqual(write_result["config"]["dataDir"], data_dir.resolve().as_posix())
        self.assertEqual(write_result["config"]["mysqlbackup"], config.mysqlbackup)
        self.assertTrue(write_result["config"]["loginFile"].endswith("/.mylogin.cnf"))
        if os.name == "posix":
            self.assertEqual(oct(config_file.stat().st_mode & 0o777), "0o600")

        read_response = handle_request({
            "operation": "backupHome.readConfig",
            "params": {
                "backupHome": backup_home.as_posix(),
            },
        }, config)

        self.assertTrue(read_response["ok"])
        read_result = read_response["result"]
        self.assertEqual(read_result["status"], "read")
        self.assertEqual(read_result["sourceSection"], "meb")
        self.assertEqual(read_result["config"]["dataDir"], data_dir.resolve().as_posix())
        self.assertEqual(read_result["config"]["mysqlbackup"], config.mysqlbackup)

    def test_backup_home_read_config_does_not_return_secret_fields(self) -> None:
        _, config, backup_home, data_dir, config_file = self.make_backup_home_fixture()
        config_file.write_text(
            "\n".join([
                "[meb]",
                f"datadir = {data_dir.as_posix()}",
                "password = secret",
                "encryption_password = secret",
                "",
            ]),
            encoding="utf-8",
        )
        if os.name == "posix":
            config_file.chmod(0o600)

        response = handle_request({
            "operation": "backupHome.readConfig",
            "params": {
                "backupHome": backup_home.as_posix(),
            },
        }, config)

        self.assertTrue(response["ok"])
        result = response["result"]
        self.assertEqual(result["status"], "read")
        self.assertEqual(result["config"]["dataDir"], data_dir.as_posix())
        self.assertNotIn("secret", str(result))
        self.assertNotIn("password", result["config"])
        self.assertNotIn("encryptionPassword", result["config"])

    def test_backup_home_write_config_refuses_symlink_config_path(self) -> None:
        root, config, backup_home, data_dir, config_file = self.make_backup_home_fixture()
        if os.name != "posix":
            self.skipTest("POSIX symlink test")
        outside_config = root / "outside.cnf"
        outside_config.write_text("unchanged\n", encoding="utf-8")
        config_file.unlink()
        config_file.symlink_to(outside_config)

        response = handle_request({
            "operation": "backupHome.writeConfig",
            "params": {
                "backupHome": backup_home.as_posix(),
                "dataDir": data_dir.as_posix(),
            },
        }, config)

        self.assertTrue(response["ok"])
        result = response["result"]
        self.assertEqual(result["status"], "invalid")
        checks = checks_by_id(result)
        self.assertEqual(checks["config.path"]["status"], "fail")
        self.assertEqual(outside_config.read_text(encoding="utf-8"), "unchanged\n")

    def test_backup_home_write_config_rejects_arbitrary_config_fields(self) -> None:
        _, config, backup_home, data_dir, _ = self.make_backup_home_fixture()

        response = handle_request({
            "operation": "backupHome.writeConfig",
            "params": {
                "backupHome": backup_home.as_posix(),
                "dataDir": data_dir.as_posix(),
                "mysqlbackup": "/tmp/user-controlled",
            },
        }, config)

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "invalid_request")

    def test_jobs_list_derives_jobs_from_profile_configs(self) -> None:
        _, config, backup_home, output_dir, option_file = self.make_job_fixture()

        result = self.create_single_profile(backup_home, output_dir)

        response = handle_request({
            "operation": "jobs.list",
            "params": {
                "backupHome": backup_home.as_posix(),
            },
        }, config)

        self.assertTrue(response["ok"])
        jobs = response["result"]["jobs"]
        self.assertEqual([job["id"] for job in jobs], [
            "nightly-backup-full",
            "nightly-backup-incremental",
        ])
        self.assertEqual(jobs[0]["backupMode"], "full")
        self.assertEqual(jobs[0]["outputDirectory"], output_dir.as_posix())
        self.assertEqual(jobs[0]["defaultsFile"], result["profilePath"])

    def test_jobs_list_allows_unsupported_platform_metadata_checks(self) -> None:
        _, config, backup_home, output_dir, _option_file = self.make_job_fixture()
        self.create_single_profile(backup_home, output_dir)
        owner_check = {
            "id": "backupHome.owner",
            "status": "indeterminate",
            "expected": "owned by the effective helper user",
            "observed": "unsupported platform",
            "message": "Ownership validation is not available on this platform.",
        }
        mode_check = {
            "id": "backupHome.permissions",
            "status": "indeterminate",
            "expected": "0700",
            "observed": "unsupported platform",
            "message": "POSIX mode validation is not available on this platform.",
        }

        with mock.patch.object(helper, "_owner_check", return_value=owner_check):
            with mock.patch.object(helper, "_mode_check", return_value=mode_check):
                response = handle_request({
                    "operation": "jobs.list",
                    "params": {
                        "backupHome": backup_home.as_posix(),
                    },
                }, config)

        self.assertTrue(response["ok"], response)
        self.assertEqual(len(response["result"]["jobs"]), 2)

    def test_windows_profile_reader_ignores_unstable_stat_identifiers(self) -> None:
        _, _config, backup_home, output_dir, _option_file = self.make_job_fixture()
        profile_path = self.write_profile_config(backup_home, output_dir)
        file_stat = profile_path.stat()
        opened_stat = os.stat_result((
            file_stat.st_mode,
            file_stat.st_ino + 1,
            file_stat.st_dev + 1,
            file_stat.st_nlink,
            file_stat.st_uid,
            file_stat.st_gid,
            file_stat.st_size,
            file_stat.st_atime,
            file_stat.st_mtime,
            file_stat.st_ctime,
        ))

        read_error = None
        parser = None
        try:
            with mock.patch.object(helper.os, "name", "nt"):
                with mock.patch.object(helper.os, "fstat", return_value=opened_stat):
                    parser = helper._read_profile_config(profile_path, file_stat)
        except HelperError as error:
            read_error = error

        self.assertIsNone(read_error)
        self.assertIsNotNone(parser)
        self.assertTrue(parser.has_section("meb_manager"))

    def test_jobs_execute_dry_run_emits_fixed_argv_process_plan(self) -> None:
        _, config, backup_home, output_dir, option_file = self.make_job_fixture()
        self.write_profile_config(backup_home, output_dir, manager_options={"apply_log": "True"})

        response = handle_request({
            "operation": "jobs.execute",
            "dryRun": True,
            "params": {
                "backupHome": backup_home.as_posix(),
                "jobId": "nightly-backup-full",
            },
        }, config, allow_dry_run=True)

        self.assertTrue(response["ok"])
        plan = response["result"]["plan"]
        self.assertEqual(plan["executable"], "/usr/bin/mysqlbackup")
        self.assertEqual(plan["args"][-1], "backup-and-apply-log")
        self.assertIn("--login-path=mysql_workbench_meb_test", plan["args"])
        self.assertEqual(plan["env"]["PATH"], "/usr/bin:/bin")
        self.assertEqual(plan["env"]["MYSQL_TEST_LOGIN_FILE"], (backup_home.parent / ".mylogin.cnf").as_posix())
        self.assertEqual(plan["uid"], 1)
        self.assertEqual(plan["gid"], 1)
        self.assertIn(f"--show-progress=file:{backup_home / '.backup-progress'}", plan["args"])
        self.assertIn("--progress-interval=1", plan["args"])

        validate_process_plan(ProcessPlan(
            executable=plan["executable"],
            args=plan["args"],
            cwd=plan["cwd"],
            env=plan["env"],
            uid=plan["uid"],
            gid=plan["gid"],
            timeout_ms=plan["timeoutMs"],
            max_output_bytes=plan["maxOutputBytes"],
            audit_name=plan["auditName"],
        ))

    def test_jobs_execute_derives_job_from_profile_config(self) -> None:
        _root, config, backup_home, output_dir, _option_file = self.make_job_fixture()
        profile_path = self.write_profile_config(backup_home, output_dir)
        config = copy_config(config, option_file_roots=[backup_home.as_posix()])

        response = handle_request({
            "operation": "jobs.execute",
            "dryRun": True,
            "params": {
                "backupHome": backup_home.as_posix(),
                "jobId": "nightly-backup-full",
            },
        }, config, allow_dry_run=True)

        self.assertTrue(response["ok"], response)
        args = response["result"]["plan"]["args"]
        self.assertIn(f"--defaults-file={profile_path.as_posix()}", args)
        self.assertEqual(args[-1], "backup")

    def test_local_full_job_uses_profile_backup_options(self) -> None:
        _, config, backup_home, output_dir, _option_file = self.make_job_fixture()
        self.write_profile_config(backup_home, output_dir, manager_options={
            "apply_log": "False",
            "compress": "True",
            "compress_method": "zlib",
            "compress_level": "7",
            "skip_unused_pages": "True",
            "using_tts": "2",
        })

        response = handle_request({
            "operation": "jobs.execute",
            "dryRun": True,
            "params": {
                "backupHome": backup_home.as_posix(),
                "jobId": "nightly-backup-full",
            },
        }, config, allow_dry_run=True)

        self.assertTrue(response["ok"], response)
        args = response["result"]["plan"]["args"]
        self.assertIn("--compress-method=zlib", args)
        self.assertIn("--compress-level=7", args)
        self.assertIn("--skip-unused-pages", args)
        self.assertIn("--use-tts=with-full-locking", args)
        self.assertIn(f"--backup-dir={output_dir.as_posix()}", args)
        self.assertEqual(args[-1], "backup")

    def test_redo_only_incremental_job_uses_supported_process_plan(self) -> None:
        _, config, backup_home, output_dir, _option_file = self.make_job_fixture()
        profile_path = self.write_profile_config(backup_home, output_dir, manager_options={
            "compress": "True",
            "compress_method": "zlib",
            "compress_level": "7",
            "incremental_with_redo_log_only": "True",
            "using_tts": "1",
        })

        response = handle_request({
            "operation": "jobs.execute",
            "dryRun": True,
            "params": {
                "backupHome": backup_home.as_posix(),
                "jobId": "nightly-backup-incremental",
            },
        }, config, allow_dry_run=True)

        self.assertTrue(response["ok"], response)
        args = response["result"]["plan"]["args"]
        self.assertEqual(args, [
            f"--defaults-file={profile_path.as_posix()}",
            "--login-path=mysql_workbench_meb_test",
            "--with-timestamp",
            "--incremental-with-redo-log-only",
            "--incremental-base=history:last_backup",
            f"--incremental-backup-dir={output_dir.as_posix()}",
            f"--show-progress=file:{backup_home / '.backup-progress'}",
            "--progress-interval=1",
            "backup",
        ])

    def test_cloud_full_job_uses_backup_image_plan(self) -> None:
        _, config, backup_home, output_dir, _option_file = self.make_job_fixture()
        self.write_profile_config(backup_home, output_dir, "cloud-full", "cloud", "s3")

        response = handle_request({
            "operation": "jobs.execute",
            "dryRun": True,
            "params": {
                "backupHome": backup_home.as_posix(),
                "jobId": "cloud-full-backup-full",
            },
        }, config, allow_dry_run=True)

        self.assertTrue(response["ok"], response)
        args = response["result"]["plan"]["args"]
        self.assertIn(f"--backup-dir={output_dir.as_posix()}", args)
        self.assertIn("--backup-image=-", args)
        self.assertTrue(any(
            re.fullmatch(r"--cloud-object-key=\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}", arg)
            for arg in args
        ))
        self.assertEqual(args[-1], "backup-to-image")
        self.assertNotIn("backup-and-apply-log", args)

    def test_cloud_incremental_job_uses_backup_image_plan(self) -> None:
        _, config, backup_home, output_dir, _option_file = self.make_job_fixture()
        self.write_profile_config(
            backup_home,
            output_dir,
            "cloud-incremental",
            "cloud",
            "OCI",
            "history:last_full_backup",
            manager_options={"incremental_with_redo_log_only": "True"},
        )

        response = handle_request({
            "operation": "jobs.execute",
            "dryRun": True,
            "params": {
                "backupHome": backup_home.as_posix(),
                "jobId": "cloud-incremental-backup-incremental",
            },
        }, config, allow_dry_run=True)

        self.assertTrue(response["ok"], response)
        args = response["result"]["plan"]["args"]
        self.assertIn(f"--backup-dir={output_dir.as_posix()}", args)
        self.assertIn("--backup-image=-", args)
        self.assertTrue(any(
            re.fullmatch(r"--cloud-object=\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}", arg)
            for arg in args
        ))
        self.assertIn("--incremental-with-redo-log-only", args)
        self.assertIn("--incremental-base=history:last_full_backup", args)
        self.assertEqual(args[-1], "backup-to-image")
        self.assertFalse(any(arg.startswith("--incremental-backup-dir=") for arg in args))

    def test_incremental_jobs_execute_uses_configured_history_base(self) -> None:
        _, config, backup_home, output_dir, _option_file = self.make_job_fixture()
        self.write_profile_config(
            backup_home,
            output_dir,
            "incremental",
            incremental_base="history:last_full_backup",
        )

        response = handle_request({
            "operation": "jobs.execute",
            "dryRun": True,
            "params": {
                "backupHome": backup_home.as_posix(),
                "jobId": "incremental-backup-incremental",
            },
        }, config, allow_dry_run=True)

        self.assertTrue(response["ok"], response)
        self.assertIn(
            "--incremental-base=history:last_full_backup",
            response["result"]["plan"]["args"],
        )

    def test_manual_jobs_execute_is_blocked_by_existing_run_lock(self) -> None:
        _, config, backup_home, output_dir, option_file = self.make_job_fixture()
        self.create_single_profile(backup_home, output_dir)
        lock_dir = backup_home / ".backup-run.lock"
        lock_dir.mkdir()

        response = handle_request({
            "operation": "jobs.execute",
            "params": {
                "backupHome": backup_home.as_posix(),
                "jobId": "nightly-backup-full",
                "runMode": "manual",
            },
        }, config)

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "backup_running")

    def test_run_lock_cleans_up_after_owner_write_failure(self) -> None:
        _root, _config, backup_home, _data_dir, _config_file = self.make_backup_home_fixture()
        run_lock = helper.BackupRunLock(backup_home, "nightly", "manual")

        with mock.patch.object(
            helper,
            "_write_run_lock_owner",
            side_effect=HelperError("operation_failed", "write failed"),
        ):
            with self.assertRaises(HelperError):
                run_lock.try_acquire()

        self.assertFalse((backup_home / ".backup-run.lock").exists())

    def test_run_lock_reclaims_abandoned_initialization_directory(self) -> None:
        _root, _config, backup_home, _data_dir, _config_file = self.make_backup_home_fixture()
        lock_dir = backup_home / ".backup-run.lock"
        lock_dir.mkdir(mode=0o700)
        abandoned_time = time.time() - 60
        os.utime(lock_dir, (abandoned_time, abandoned_time))
        run_lock = helper.BackupRunLock(backup_home, "nightly", "manual")

        try:
            self.assertTrue(run_lock.try_acquire())
            owner = helper._read_run_lock_owner(lock_dir)
            self.assertEqual(owner["token"], run_lock.token)
        finally:
            run_lock.release()

    def test_run_lock_reclaims_abandoned_malformed_owner(self) -> None:
        _root, _config, backup_home, _data_dir, _config_file = self.make_backup_home_fixture()
        lock_dir = backup_home / ".backup-run.lock"
        lock_dir.mkdir(mode=0o700)
        owner_path = lock_dir / "owner.json"
        owner_path.write_text("{}\n", encoding="utf-8")
        abandoned_time = time.time() - 60
        os.utime(owner_path, (abandoned_time, abandoned_time))
        os.utime(lock_dir, (abandoned_time, abandoned_time))
        run_lock = helper.BackupRunLock(backup_home, "nightly", "manual")

        try:
            self.assertTrue(run_lock.try_acquire())
        finally:
            run_lock.release()

    def test_process_exists_uses_windows_process_check(self) -> None:
        with mock.patch.object(helper, "_windows_process_exists", return_value=False, create=True) as process_exists:
            with mock.patch.object(helper.os, "name", "nt"):
                self.assertFalse(helper._process_exists(424242))

        process_exists.assert_called_once_with(424242)

    def test_windows_current_account_matches_supported_aliases(self) -> None:
        with mock.patch.dict(helper.os.environ, {
            "USERNAME": "lroot",
            "USERDOMAIN": "WORKGROUP",
            "COMPUTERNAME": "PAWEL-ANDRUSZKI",
        }, clear=True):
            self.assertTrue(helper._windows_current_account_matches("lroot"))
            self.assertTrue(helper._windows_current_account_matches(
                r"WORKGROUP\lroot",
            ))
            self.assertTrue(helper._windows_current_account_matches(
                r"PAWEL-ANDRUSZKI\lroot",
            ))
            self.assertFalse(helper._windows_current_account_matches(
                r"OTHERDOMAIN\lroot",
            ))

    def test_scheduled_jobs_execute_waits_for_existing_run_lock(self) -> None:
        root, config, backup_home, output_dir, option_file = self.make_job_fixture()
        self.create_single_profile(backup_home, output_dir)
        if os.name != "posix":
            self.skipTest("POSIX process execution fixture")
        tool_dir = root / "tools"
        tool_dir.mkdir()
        tool_dir.chmod(0o700)
        mysqlbackup = tool_dir / "mysqlbackup"
        mysqlbackup.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
        mysqlbackup.chmod(0o700)
        current_user = helper._current_user()
        config = copy_config(
            config,
            target_user_name=current_user["name"],
            target_user=TargetUser(uid=current_user["uid"], gid=current_user["gid"], account=current_user["name"]),
            mysqlbackup=mysqlbackup.as_posix(),
        )
        lock_dir = backup_home / ".backup-run.lock"
        lock_dir.mkdir()
        response_holder: dict[str, object] = {}

        def run_scheduled() -> None:
            response_holder["response"] = handle_request({
                "operation": "jobs.execute",
                "params": {
                    "backupHome": backup_home.as_posix(),
                    "jobId": "nightly-backup-full",
                    "runMode": "scheduled",
                },
            }, config)

        thread = threading.Thread(target=run_scheduled)
        thread.start()
        time.sleep(0.2)
        self.assertTrue(thread.is_alive())
        lock_dir.rmdir()
        thread.join(timeout=5)

        self.assertFalse(thread.is_alive())
        response = response_holder["response"]
        self.assertTrue(response["ok"], response)  # type: ignore[index]
        self.assertEqual(response["result"]["exitCode"], 0)  # type: ignore[index]

    def test_jobs_list_rejects_overlapping_profile_schedules(self) -> None:
        _, config, backup_home, output_dir, _option_file = self.make_job_fixture()
        self.write_profile_config(backup_home, output_dir, "daily", full_schedule=True)
        self.write_profile_config(backup_home, output_dir, "weekly", full_schedule=True)

        response = handle_request({
            "operation": "jobs.list",
            "params": {
                "backupHome": backup_home.as_posix(),
            },
        }, config)

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "invalid_request")
        self.assertIn("overlapping schedules", response["error"]["message"])

    def test_profile_weekly_schedule_uses_numeric_week_days(self) -> None:
        schedule = helper._profile_schedule({
            "full_backups_enabled": "1",
            "full_backups_frequency": "2",
            "full_backups_hour": "2",
            "full_backups_minute": "15",
            "full_backups_week_days": "1,3,5",
        }, "full")

        self.assertEqual(schedule, {
            "minute": "15",
            "hour": "2",
            "dayOfMonth": "*",
            "month": "*",
            "dayOfWeek": "1,3,5",
        })

    def test_profile_weekly_schedule_rejects_invalid_week_days(self) -> None:
        options = {
            "full_backups_enabled": "1",
            "full_backups_frequency": "2",
            "full_backups_hour": "2",
            "full_backups_minute": "15",
        }

        for value in ("", "7", "-1", "one", "1,1"):
            with self.subTest(value=value):
                with self.assertRaises(HelperError):
                    helper._profile_schedule({
                        **options,
                        "full_backups_week_days": value,
                    }, "full")

    def test_jobs_execute_logs_process_output_to_disk(self) -> None:
        root, config, backup_home, output_dir, option_file = self.make_job_fixture()
        if os.name != "posix":
            self.skipTest("POSIX process log test")
        tool_dir = root / "tools"
        tool_dir.mkdir()
        tool_dir.chmod(0o700)
        mysqlbackup = tool_dir / "mysqlbackup"
        mysqlbackup.write_text(
            "#!/bin/sh\n"
            "echo meb stdout\n"
            "echo meb stderr >&2\n"
            "exit 7\n",
            encoding="utf-8",
        )
        mysqlbackup.chmod(0o700)
        current_user = helper._current_user()
        config = copy_config(
            config,
            target_user_name=current_user["name"],
            target_user=TargetUser(uid=current_user["uid"], gid=current_user["gid"], account=current_user["name"]),
            mysqlbackup=mysqlbackup.as_posix(),
        )
        self.create_single_profile(backup_home, output_dir)

        response = handle_request({
            "operation": "jobs.execute",
            "params": {
                "backupHome": backup_home.as_posix(),
                "jobId": "nightly-backup-full",
            },
        }, config)

        self.assertTrue(response["ok"], response)
        result = response["result"]
        self.assertEqual(result["exitCode"], 7)
        self.assertFalse(result["stdoutTruncated"])
        self.assertFalse(result["stderrTruncated"])
        self.assertNotIn("meb stdout", str(result))
        self.assertNotIn("meb stderr", str(result))

        log_path = Path(result["logPath"])
        self.assertEqual(log_path.parent, backup_home / "logs")
        self.assertEqual(oct(log_path.stat().st_mode & 0o777), "0o600")
        log_text = log_path.read_text(encoding="utf-8")
        self.assertIn("meb stdout", log_text)
        self.assertIn("meb stderr", log_text)
        self.assertIn("exitCode=7", log_text)

    def test_jobs_execute_records_mysqlbackup_progress_file(self) -> None:
        root, config, backup_home, output_dir, option_file = self.make_job_fixture()
        if os.name != "posix":
            self.skipTest("POSIX process progress test")
        tool_dir = root / "tools"
        tool_dir.mkdir()
        tool_dir.chmod(0o700)
        mysqlbackup = tool_dir / "mysqlbackup"
        mysqlbackup.write_text(
            "#!/bin/sh\n"
            "for arg in \"$@\"; do\n"
            "  case \"$arg\" in\n"
            "    --show-progress=file:*)\n"
            "      progress_file=${arg#--show-progress=file:}\n"
            "      echo 'Progress: 4 of 11 MB; state: Copying .ibd files' > \"$progress_file\"\n"
            "      ;;\n"
            "  esac\n"
            "done\n"
            "exit 0\n",
            encoding="utf-8",
        )
        mysqlbackup.chmod(0o700)
        current_user = helper._current_user()
        config = copy_config(
            config,
            target_user_name=current_user["name"],
            target_user=TargetUser(uid=current_user["uid"], gid=current_user["gid"], account=current_user["name"]),
            mysqlbackup=mysqlbackup.as_posix(),
        )
        self.create_single_profile(backup_home, output_dir)

        response = handle_request({
            "operation": "jobs.execute",
            "params": {
                "backupHome": backup_home.as_posix(),
                "jobId": "nightly-backup-full",
            },
        }, config)

        self.assertTrue(response["ok"], response)
        progress = json.loads((backup_home / ".backup-progress.json").read_text(encoding="utf-8"))
        self.assertEqual(progress["state"], "finished")
        self.assertEqual(progress["jobId"], "nightly-backup-full")
        self.assertEqual(progress["mysqlbackupProgressPath"], (backup_home / ".backup-progress").as_posix())
        self.assertIn("Progress: 4 of 11 MB; state: Copying .ibd files",
                      (backup_home / ".backup-progress").read_text(encoding="utf-8"))

    def test_backups_list_logs_read_and_backup_delete(self) -> None:
        _root, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        backup_dir = backup_home / "nightly" / "20260506T010203Z"
        backup_dir.mkdir(parents=True)
        (backup_dir / "meta.txt").write_text("backup metadata\n", encoding="utf-8")
        log_dir = backup_home / "logs"
        log_dir.mkdir()
        log_file = log_dir / "nightly.log"
        log_file.write_text("first line\nsecond line\n", encoding="utf-8")
        unrelated_log_file = log_dir / "other.log"
        unrelated_log_file.write_text("other backup\n", encoding="utf-8")
        progress_file = backup_home / ".backup-progress.json"
        progress_file.write_text(json.dumps({
            "version": 1,
            "state": "finished",
            "logPath": log_file.as_posix(),
            "mysqlbackupProgressPath": (backup_home / ".backup-progress").as_posix(),
        }), encoding="utf-8")
        mysqlbackup_progress_file = backup_home / ".backup-progress"
        mysqlbackup_progress_file.write_text("Progress: 4 of 11 MB\n", encoding="utf-8")
        if os.name == "posix":
            log_dir.chmod(0o700)
            log_file.chmod(0o600)
            unrelated_log_file.chmod(0o600)
            progress_file.chmod(0o600)
            mysqlbackup_progress_file.chmod(0o600)

        list_response = handle_request({
            "operation": "backups.list",
            "params": {
                "backupHome": backup_home.as_posix(),
            },
        }, config)

        self.assertTrue(list_response["ok"], list_response)
        backup_ids = {backup["id"] for backup in list_response["result"]["backups"]}
        self.assertIn("nightly", backup_ids)
        self.assertIn("nightly/20260506T010203Z", backup_ids)
        self.assertNotIn("logs", backup_ids)

        logs_response = handle_request({
            "operation": "backupLogs.list",
            "params": {
                "backupHome": backup_home.as_posix(),
            },
        }, config)

        self.assertTrue(logs_response["ok"], logs_response)
        self.assertEqual([log["id"] for log in logs_response["result"]["logs"]], ["nightly.log", "other.log"])

        log_response = handle_request({
            "operation": "backupLogs.read",
            "params": {
                "backupHome": backup_home.as_posix(),
                "logId": "nightly.log",
                "maxBytes": 12,
            },
        }, config)

        self.assertTrue(log_response["ok"], log_response)
        self.assertEqual(log_response["result"]["content"], "second line\n")
        self.assertTrue(log_response["result"]["truncated"])

        delete_response = handle_request({
            "operation": "backups.delete",
            "params": {
                "backupHome": backup_home.as_posix(),
                "backupId": "nightly/20260506T010203Z",
                "logId": "nightly.log",
            },
        }, config)

        self.assertTrue(delete_response["ok"], delete_response)
        self.assertEqual(delete_response["result"]["status"], "deleted")
        self.assertFalse(backup_dir.exists())
        self.assertFalse(log_file.exists())
        self.assertFalse(progress_file.exists())
        self.assertFalse(mysqlbackup_progress_file.exists())
        self.assertTrue((backup_home / "nightly").exists())
        self.assertTrue(unrelated_log_file.exists())

    def test_backup_logs_delete_removes_only_the_selected_log(self) -> None:
        _root, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        log_dir = backup_home / "logs"
        log_dir.mkdir()
        selected_log = log_dir / "restore.log"
        other_log = log_dir / "backup.log"
        selected_log.write_text("restore\n", encoding="utf-8")
        other_log.write_text("backup\n", encoding="utf-8")
        if os.name == "posix":
            log_dir.chmod(0o700)
            selected_log.chmod(0o600)
            other_log.chmod(0o600)

        response = handle_request({
            "operation": "backups.delete",
            "params": {"backupHome": backup_home.as_posix(), "logId": selected_log.name},
        }, config)

        self.assertTrue(response["ok"], response)
        self.assertEqual(response["result"]["status"], "deleted")
        self.assertFalse(selected_log.exists())
        self.assertTrue(other_log.exists())

    def test_backups_verify_dry_run_emits_validate_process_plan(self) -> None:
        _root, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        backup_dir = backup_home / "nightly" / "20260506T010203Z"
        backup_dir.mkdir(parents=True)

        response = handle_request({
            "operation": "backups.verify",
            "dryRun": True,
            "params": {
                "backupHome": backup_home.as_posix(),
                "backupId": "nightly/20260506T010203Z",
            },
        }, config, allow_dry_run=True)

        self.assertTrue(response["ok"], response)
        plan = response["result"]["plan"]
        self.assertEqual(plan["executable"], "/usr/bin/mysqlbackup")
        self.assertEqual(plan["args"], [
            "--login-path=mysql_workbench_meb_test",
            f"--backup-dir={backup_dir.as_posix()}",
            "validate",
        ])
        self.assertEqual(plan["env"]["PATH"], "/usr/bin:/bin")
        self.assertEqual(plan["env"]["MYSQL_TEST_LOGIN_FILE"], (backup_home.parent / ".mylogin.cnf").as_posix())
        self.assertEqual(plan["uid"], 1)
        self.assertEqual(plan["gid"], 1)

    def test_backups_verify_ignores_existing_run_lock(self) -> None:
        _root, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        backup_dir = backup_home / "nightly" / "20260506T010203Z"
        backup_dir.mkdir(parents=True)
        (backup_home / ".backup-run.lock").mkdir()

        process_result = {
            "exitCode": 0,
            "stdout": "Validate backup directory operation completed successfully.\n",
            "stderr": "",
            "output": "Validate backup directory operation completed successfully.\n",
            "timedOut": False,
            "stdoutTruncated": False,
            "stderrTruncated": False,
        }
        with mock.patch.object(helper, "run_process_plan", return_value=process_result):
            response = handle_request({
                "operation": "backups.verify",
                "params": {
                    "backupHome": backup_home.as_posix(),
                    "backupId": "nightly/20260506T010203Z",
                },
            }, config)

        self.assertTrue(response["ok"], response)
        self.assertEqual(response["result"]["status"], "verified")
        self.assertEqual(response["result"]["output"], "Validate backup directory operation completed successfully.\n")
        self.assertFalse((backup_home / "logs").exists())

    def test_backups_restore_dry_run_emits_restore_process_plan(self) -> None:
        root, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        backup_dir = backup_home / "nightly" / "20260506T010203Z"
        meta_dir = backup_dir / "meta"
        meta_dir.mkdir(parents=True)
        (meta_dir / "backup_variables.txt").write_text(
            "[backup_variables]\n"
            "is_incremental=0\n"
            "is_compressed=0\n"
            "apply_log_done=0\n",
            encoding="utf-8",
        )
        config = copy_config(config, datadir=(root / "mysql-data").as_posix())

        response = handle_request({
            "operation": "backups.restore",
            "dryRun": True,
            "params": {
                "backupHome": backup_home.as_posix(),
                "backupId": "nightly/20260506T010203Z",
                "operationId": "restore-20260506-010203",
                "force": True,
            },
        }, config, allow_dry_run=True)

        self.assertTrue(response["ok"], response)
        plan = response["result"]["plan"]
        self.assertEqual(plan["executable"], "/usr/bin/mysqlbackup")
        self.assertEqual(plan["args"], [
            f"--defaults-file={backup_dir / '.restore-dry-run.cnf'}",
            "--login-path=mysql_workbench_meb_test",
            f"--backup-dir={backup_dir.as_posix()}",
            "--force",
            f"--show-progress=file:{backup_home / '.backup-progress'}",
            "--progress-interval=1",
            "copy-back-and-apply-log",
        ])
        self.assertEqual(plan["env"]["PATH"], "/usr/bin:/bin")
        self.assertEqual(plan["env"]["MYSQL_TEST_LOGIN_FILE"], (backup_home.parent / ".mylogin.cnf").as_posix())
        self.assertEqual(plan["uid"], 1)
        self.assertEqual(plan["gid"], 1)

    def test_backups_apply_log_dry_run_requires_pending_logs(self) -> None:
        _root, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        backup_dir = backup_home / "nightly" / "20260506T010203Z"
        meta_dir = backup_dir / "meta"
        meta_dir.mkdir(parents=True)
        variables_path = meta_dir / "backup_variables.txt"
        variables_path.write_text(
            "[backup_variables]\napply_log_done=0\nis_compressed=1\n",
            encoding="utf-8",
        )
        response = handle_request({
            "operation": "backups.applyLog",
            "dryRun": True,
            "params": {"backupHome": backup_home.as_posix(), "backupId": "nightly/20260506T010203Z"},
        }, config, allow_dry_run=True)

        self.assertTrue(response["ok"], response)
        self.assertEqual(response["result"]["plan"]["args"], [
            f"--backup-dir={backup_dir.as_posix()}", "--uncompress", "apply-log",
        ])
        variables_path.write_text("[backup_variables]\napply_log_done=1\n", encoding="utf-8")
        response = handle_request({
            "operation": "backups.applyLog",
            "dryRun": True,
            "params": {"backupHome": backup_home.as_posix(), "backupId": "nightly/20260506T010203Z"},
        }, config, allow_dry_run=True)
        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "invalid_request")

    def test_backups_apply_log_ignores_existing_run_lock(self) -> None:
        _root, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        backup_dir = backup_home / "nightly" / "20260506T010203Z"
        meta_dir = backup_dir / "meta"
        meta_dir.mkdir(parents=True)
        (meta_dir / "backup_variables.txt").write_text(
            "[backup_variables]\napply_log_done=0\nis_compressed=0\n",
            encoding="utf-8",
        )
        (backup_home / ".backup-run.lock").mkdir()

        process_result = {
            "exitCode": 0,
            "timedOut": False,
            "stdoutTruncated": False,
            "stderrTruncated": False,
        }
        with mock.patch.object(helper, "run_process_plan", return_value=process_result):
            response = handle_request({
                "operation": "backups.applyLog",
                "params": {
                    "backupHome": backup_home.as_posix(),
                    "backupId": "nightly/20260506T010203Z",
                },
            }, config)

        self.assertTrue(response["ok"], response)
        self.assertEqual(response["result"]["status"], "applied")

    def test_failed_restore_returns_mysqlbackup_output(self) -> None:
        root, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        backup_dir = backup_home / "nightly" / "20260506T010203Z"
        meta_dir = backup_dir / "meta"
        meta_dir.mkdir(parents=True)
        (meta_dir / "backup_variables.txt").write_text(
            "[backup_variables]\n"
            "is_incremental=0\n"
            "is_compressed=0\n"
            "apply_log_done=0\n",
            encoding="utf-8",
        )
        config = copy_config(config, datadir=(root / "mysql-data").as_posix())
        original_run_process_plan = helper.run_process_plan
        plans = []

        try:
            def failed_process(plan: ProcessPlan) -> dict[str, object]:
                plans.append(plan)
                return {
                    "exitCode": 1,
                    "stdout": "copy-back started\n",
                    "stderr": "data directory is not empty\n",
                    "output": "copy-back started\ndata directory is not empty\n",
                    "timedOut": False,
                    "stdoutTruncated": False,
                    "stderrTruncated": False,
                    "logPath": plan.log_path,
                }

            helper.run_process_plan = failed_process
            response = helper.handle_backups_restore({
                "backupHome": backup_home.as_posix(),
                "backupId": "nightly/20260506T010203Z",
                "operationId": "restore-20260506-010203",
                "profileId": "profile-1",
                "force": False,
            }, config, dry_run=False)
        finally:
            helper.run_process_plan = original_run_process_plan

        self.assertEqual(response["status"], "failed")
        self.assertEqual(response["stdout"], "copy-back started\n")
        self.assertEqual(response["stderr"], "data directory is not empty\n")
        self.assertEqual(response["output"], "copy-back started\ndata directory is not empty\n")
        self.assertIn("-restore-profile-1-", plans[0].log_path)

    def test_restore_requires_operation_id(self) -> None:
        root, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        backup_dir = backup_home / "nightly" / "20260506T010203Z"
        (backup_dir / "meta").mkdir(parents=True)
        (backup_dir / "meta" / "backup_variables.txt").write_text(
            "[backup_variables]\napply_log_done=1\n",
            encoding="utf-8",
        )
        config = copy_config(config, datadir=(root / "mysql-data").as_posix())

        response = handle_request({
            "operation": "backups.restore",
            "dryRun": True,
            "params": {
                "backupHome": backup_home.as_posix(),
                "backupId": "nightly/20260506T010203Z",
            },
        }, config, allow_dry_run=True)

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "invalid_request")

    def test_restore_progress_returns_matching_live_output(self) -> None:
        _root, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        operation_id = "restore-20260506-010203"
        (backup_home / ".backup-progress.json").write_text(json.dumps({
            "version": 1,
            "state": "running",
            "backupMode": "restore",
            "operationId": operation_id,
            "pid": 424242,
        }), encoding="utf-8")
        output_path = backup_home / f".restore-output-{operation_id}.log"
        output_path.write_text("copy-back started\n37% complete\n", encoding="utf-8")
        if os.name == "posix":
            (backup_home / ".backup-progress.json").chmod(0o600)
            output_path.chmod(0o600)

        response = handle_request({
            "operation": "backups.restore.progress",
            "params": {
                "backupHome": backup_home.as_posix(),
                "operationId": operation_id,
            },
        }, config)

        self.assertTrue(response["ok"], response)
        self.assertEqual(response["result"]["state"], "running")
        self.assertEqual(response["result"]["output"], "copy-back started\n37% complete\n")

    def test_restore_abort_targets_only_matching_operation(self) -> None:
        _root, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        operation_id = "restore-20260506-010203"
        progress_path = backup_home / ".backup-progress.json"
        progress_path.write_text(json.dumps({
            "version": 1,
            "state": "running",
            "backupMode": "restore",
            "operationId": operation_id,
            "pid": 424242,
        }), encoding="utf-8")
        if os.name == "posix":
            progress_path.chmod(0o600)
        lock_dir = backup_home / ".backup-run.lock"
        lock_dir.mkdir()
        lock_owner_path = lock_dir / "owner.json"
        lock_owner_path.write_text(json.dumps({
            "version": 1,
            "host": helper.socket.gethostname(),
            "pid": os.getpid(),
            "jobId": "restore-backup",
            "runMode": "manual",
            "startedTime": int(time.time()),
            "token": "test-token",
            "operationId": operation_id,
        }), encoding="utf-8")
        if os.name == "posix":
            lock_dir.chmod(0o700)
            lock_owner_path.chmod(0o600)
        calls = []
        original_terminate = getattr(helper, "_terminate_process_group_by_pid", None)
        if original_terminate is not None:
            helper._terminate_process_group_by_pid = calls.append

        try:
            mismatch = handle_request({
                "operation": "backups.restore.abort",
                "params": {
                    "backupHome": backup_home.as_posix(),
                    "operationId": "restore-other-operation",
                },
            }, config)
            response = handle_request({
                "operation": "backups.restore.abort",
                "params": {
                    "backupHome": backup_home.as_posix(),
                    "operationId": operation_id,
                },
            }, config)
        finally:
            if original_terminate is not None:
                helper._terminate_process_group_by_pid = original_terminate

        self.assertFalse(mismatch["ok"])
        self.assertEqual(mismatch["error"]["code"], "invalid_request")
        self.assertTrue(response["ok"], response)
        self.assertEqual(response["result"]["state"], "aborting")
        self.assertEqual(calls, [424242])

    def test_restore_progress_and_abort_running_process(self) -> None:
        if os.name != "posix":
            self.skipTest("POSIX process-group integration test")

        root, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        operation_id = "restore-running-operation"
        executable = root / "restore-process.sh"
        executable.write_text(
            "#!/bin/sh\n"
            "printf 'copy-back started\\n'\n"
            "while true; do sleep 1; done\n",
            encoding="utf-8",
        )
        executable.chmod(0o700)
        output_path = backup_home / f".restore-output-{operation_id}.log"
        helper._prepare_private_file(output_path)
        config = copy_config(
            config,
            target_user=TargetUser(uid=os.getuid(), gid=os.getgid()),
        )
        result = {}

        def run_restore_process() -> None:
            plan = ProcessPlan(
                executable=executable.as_posix(),
                args=[],
                cwd="/",
                env={"PATH": "/usr/bin:/bin"},
                uid=os.getuid(),
                gid=os.getgid(),
                timeout_ms=10000,
                max_output_bytes=65536,
                audit_name="backups.restore",
                output_path=output_path.as_posix(),
                progress_path=(backup_home / ".backup-progress.json").as_posix(),
                progress_context={
                    "state": "starting",
                    "backupMode": "restore",
                    "operationId": operation_id,
                },
            )
            run_lock = helper.BackupRunLock(backup_home, "restore-backup", "manual", operation_id)
            result["lockAcquired"] = run_lock.try_acquire()
            if not result["lockAcquired"]:
                return
            with run_lock:
                result.update(run_process_plan(plan))

        restore_thread = threading.Thread(target=run_restore_process)
        restore_thread.start()
        deadline = time.monotonic() + 3
        progress_response = None
        while time.monotonic() < deadline:
            progress_response = handle_request({
                "operation": "backups.restore.progress",
                "params": {
                    "backupHome": backup_home.as_posix(),
                    "operationId": operation_id,
                },
            }, config)
            if (
                progress_response.get("ok")
                and progress_response["result"]["state"] == "running"
                and "copy-back started" in progress_response["result"]["output"]
            ):
                break
            time.sleep(0.05)

        self.assertIsNotNone(progress_response)
        self.assertTrue(result.get("lockAcquired"), result)
        self.assertTrue(progress_response["ok"], progress_response)
        self.assertEqual(progress_response["result"]["state"], "running")
        self.assertTrue(restore_thread.is_alive(), result)
        lock_owner = helper._read_run_lock_owner(backup_home / ".backup-run.lock")
        self.assertEqual(lock_owner["operationId"], operation_id, lock_owner)
        abort_response = handle_request({
            "operation": "backups.restore.abort",
            "params": {
                "backupHome": backup_home.as_posix(),
                "operationId": operation_id,
            },
        }, config)
        restore_thread.join(timeout=3)

        self.assertTrue(abort_response["ok"], abort_response)
        self.assertEqual(abort_response["result"]["state"], "aborting")
        self.assertFalse(restore_thread.is_alive())
        self.assertNotEqual(result["exitCode"], 0)
        self.assertIn("copy-back started", result["output"])

    def test_restore_reports_aborted_when_abort_marker_exists(self) -> None:
        root, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        backup_dir = backup_home / "nightly" / "20260506T010203Z"
        (backup_dir / "meta").mkdir(parents=True)
        (backup_dir / "meta" / "backup_variables.txt").write_text(
            "[backup_variables]\napply_log_done=1\n",
            encoding="utf-8",
        )
        config = copy_config(config, datadir=(root / "mysql-data").as_posix())
        operation_id = "restore-20260506-010203"
        original_run_process_plan = helper.run_process_plan

        try:
            def aborted_process(plan: ProcessPlan) -> dict[str, object]:
                marker_path = backup_home / f".restore-abort-{operation_id}"
                marker_path.write_text("abort\n", encoding="utf-8")
                return {
                    "exitCode": -15,
                    "stdout": "copy-back started\n",
                    "stderr": "",
                    "output": "copy-back started\n",
                    "timedOut": False,
                    "stdoutTruncated": False,
                    "stderrTruncated": False,
                    "logPath": plan.log_path,
                }

            helper.run_process_plan = aborted_process
            response = helper.handle_backups_restore({
                "backupHome": backup_home.as_posix(),
                "backupId": "nightly/20260506T010203Z",
                "operationId": operation_id,
                "force": False,
            }, config, dry_run=False)
        finally:
            helper.run_process_plan = original_run_process_plan

        self.assertEqual(response["status"], "aborted")
        self.assertEqual(response["output"], "copy-back started\n")

    def test_backups_delete_and_logs_read_reject_symlinks(self) -> None:
        root, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        if os.name != "posix":
            self.skipTest("POSIX symlink test")
        outside_backup = root / "outside-backup"
        outside_backup.mkdir()
        (backup_home / "linked").symlink_to(outside_backup)
        log_dir = backup_home / "logs"
        log_dir.mkdir()
        log_dir.chmod(0o700)
        outside_log = root / "outside.log"
        outside_log.write_text("secret\n", encoding="utf-8")
        (log_dir / "linked.log").symlink_to(outside_log)

        delete_response = handle_request({
            "operation": "backups.delete",
            "params": {
                "backupHome": backup_home.as_posix(),
                "backupId": "linked",
            },
        }, config)

        self.assertFalse(delete_response["ok"])
        self.assertEqual(delete_response["error"]["code"], "invalid_request")
        self.assertTrue(outside_backup.exists())

        log_response = handle_request({
            "operation": "backupLogs.read",
            "params": {
                "backupHome": backup_home.as_posix(),
                "logId": "linked.log",
            },
        }, config)

        self.assertFalse(log_response["ok"])
        self.assertEqual(log_response["error"]["code"], "invalid_request")
        self.assertEqual(outside_log.read_text(encoding="utf-8"), "secret\n")

        (log_dir / "linked.log").unlink()
        log_dir.rmdir()
        outside_log_dir = root / "outside-logs"
        outside_log_dir.mkdir()
        (outside_log_dir / "external.log").write_text("external\n", encoding="utf-8")
        log_dir.symlink_to(outside_log_dir)

        list_logs_response = handle_request({
            "operation": "backupLogs.list",
            "params": {
                "backupHome": backup_home.as_posix(),
            },
        }, config)

        self.assertFalse(list_logs_response["ok"])
        self.assertEqual(list_logs_response["error"]["code"], "invalid_request")

    def test_mysqlbackup_run_operation_is_removed(self) -> None:
        _, config, backup_home, output_dir, option_file = self.make_job_fixture()

        response = handle_request({
            "operation": "mysqlbackup.run",
            "dryRun": True,
            "params": {
                "backupHome": backup_home.as_posix(),
                "backupMode": "full",
                "outputDirectory": output_dir.as_posix(),
                "defaultsFile": option_file.as_posix(),
            },
        }, config, allow_dry_run=True)

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "unknown_operation")

    def test_jobs_list_rejects_profile_paths_outside_allowlisted_roots(self) -> None:
        _, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        outside = Path(tempfile.mkdtemp(prefix="task-helper-outside-")).resolve()
        self.write_profile_config(backup_home, outside)

        response = handle_request({
            "operation": "jobs.list",
            "params": {
                "backupHome": backup_home.as_posix(),
            },
        }, config)

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "invalid_request")

    def test_jobs_list_rejects_profile_with_missing_output_directory(self) -> None:
        root, config, backup_home, _output_dir, _option_file = self.make_job_fixture()
        self.write_profile_config(backup_home, root / "backups" / "missing")

        response = handle_request({
            "operation": "jobs.list",
            "params": {
                "backupHome": backup_home.as_posix(),
            },
        }, config)

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "invalid_request")

    def test_jobs_list_rejects_writable_profile_config(self) -> None:
        _, config, backup_home, output_dir, _option_file = self.make_job_fixture()
        if os.name != "posix":
            self.skipTest("POSIX file mode validation test")

        profile_path = self.write_profile_config(backup_home, output_dir)
        profile_path.chmod(0o666)

        response = handle_request({
            "operation": "jobs.list",
            "params": {
                "backupHome": backup_home.as_posix(),
            },
        }, config)

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "invalid_request")

    def test_windows_option_file_permissions_ignore_posix_mode_bits(self) -> None:
        root = Path(tempfile.mkdtemp(prefix="task-helper-windows-mode-")).resolve()
        option_file = root / "mysql.cnf"
        option_file.write_text("[client]\n", encoding="utf-8")
        option_file.chmod(0o666)

        validation_error = None
        try:
            with mock.patch.object(helper.os, "name", "nt"):
                helper._validate_option_file_permissions(option_file.as_posix(), None)
        except HelperError as error:
            validation_error = error

        self.assertIsNone(validation_error)

    def test_jobs_execute_does_not_return_raw_process_output(self) -> None:
        _, config, backup_home, output_dir, option_file = self.make_job_fixture()
        self.create_single_profile(backup_home, output_dir)
        original_run_process_plan = helper.run_process_plan

        try:
            helper.run_process_plan = lambda _plan: {
                "exitCode": 1,
                "stdout": "secret stdout",
                "stderr": "password stderr",
                "timedOut": False,
                "stdoutTruncated": False,
                "stderrTruncated": False,
            }
            result = helper.handle_jobs_execute({
                "backupHome": backup_home.as_posix(),
                "jobId": "nightly-backup-full",
            }, config, dry_run=False)
        finally:
            helper.run_process_plan = original_run_process_plan

        self.assertEqual(result["exitCode"], 1)
        self.assertNotIn("secret stdout", str(result))
        self.assertNotIn("password stderr", str(result))

    def test_cron_rejects_command_injection_shaped_input(self) -> None:
        _, config, _, _ = self.make_fixture()

        response = handle_request({
            "operation": "cron.installManagedJob",
            "dryRun": True,
            "params": {
                "jobId": "backup;rm",
                "schedule": {
                    "minute": "0",
                    "hour": "2",
                    "dayOfMonth": "*",
                    "month": "*",
                    "dayOfWeek": "*",
                },
            },
        }, config, allow_dry_run=True)

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "invalid_request")

    def test_cron_rejects_malformed_numeric_fields(self) -> None:
        _, config, _, _ = self.make_fixture()

        response = handle_request({
            "operation": "cron.installManagedJob",
            "dryRun": True,
            "params": {
                "jobId": "nightly",
                "schedule": {
                    "minute": "0,",
                    "hour": "2",
                    "dayOfMonth": "*",
                    "month": "*",
                    "dayOfWeek": "*",
                },
            },
        }, config, allow_dry_run=True)

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "invalid_request")

    def test_cron_monthly_schedule_uses_selected_days_at_one_time(self) -> None:
        _, config, _, _ = self.make_fixture()

        block = helper.render_managed_job_block(config, "monthly", {
            "minute": "30",
            "hour": "2",
            "dayOfMonth": "1,15,30",
            "month": "*",
            "dayOfWeek": "*",
        })

        self.assertIn("30 2 1,15,30 * *", block)

    def test_cron_dry_run_drops_to_target_user_instead_of_using_crontab_u(self) -> None:
        _, config, _, _ = self.make_fixture()

        response = handle_request({
            "operation": "cron.installManagedJob",
            "dryRun": True,
            "params": {
                "jobId": "nightly",
                "schedule": {
                    "minute": "0",
                    "hour": "2",
                    "dayOfMonth": "*",
                    "month": "*",
                    "dayOfWeek": "*",
                },
            },
        }, config, allow_dry_run=True)

        self.assertTrue(response["ok"])
        plan = response["result"]["plan"]
        self.assertEqual(plan["args"], ["-"])
        self.assertEqual(plan["uid"], 1)
        self.assertEqual(plan["gid"], 1)
        self.assertIn(
            f"{config.job_runner} --backup-home {config.backup_home} run-job nightly",
            response["result"]["generatedManagedBlock"],
        )

    def test_launchd_dry_run_generates_managed_plist(self) -> None:
        _, config, _, _ = self.make_fixture()
        launchd_config = copy_config(config, scheduler_backend="launchd")

        response = handle_request({
            "operation": "cron.installManagedJob",
            "dryRun": True,
            "params": {
                "jobId": "nightly",
                "schedule": {
                    "minute": "0",
                    "hour": "2",
                    "dayOfMonth": "*",
                    "month": "*",
                    "dayOfWeek": "*",
                },
            },
        }, launchd_config, allow_dry_run=True)

        self.assertTrue(response["ok"])
        self.assertIn("com.mysql.workbench.helper.nightly", response["result"]["plist"])
        self.assertIn("/usr/bin/true", response["result"]["plist"])
        self.assertIn("<string>--backup-home</string>", response["result"]["plist"])
        self.assertIn(f"<string>{launchd_config.backup_home}</string>", response["result"]["plist"])
        self.assertIn("<string>run-job</string>", response["result"]["plist"])
        self.assertIn("<string>nightly</string>", response["result"]["plist"])

    def test_launchd_monthly_schedule_expands_selected_days(self) -> None:
        _, config, _, _ = self.make_fixture()
        launchd_config = copy_config(config, scheduler_backend="launchd")

        response = handle_request({
            "operation": "cron.installManagedJob",
            "dryRun": True,
            "params": {
                "jobId": "monthly",
                "schedule": {
                    "minute": "30",
                    "hour": "2",
                    "dayOfMonth": "1,15,30",
                    "month": "*",
                    "dayOfWeek": "*",
                },
            },
        }, launchd_config, allow_dry_run=True)

        self.assertTrue(response["ok"])
        plist = plistlib.loads(response["result"]["plist"].encode("utf-8"))
        self.assertEqual(plist["StartCalendarInterval"], [
            {"Day": 1, "Hour": 2, "Minute": 30},
            {"Day": 15, "Hour": 2, "Minute": 30},
            {"Day": 30, "Hour": 2, "Minute": 30},
        ])

    def test_launchd_install_creates_managed_plist_directory(self) -> None:
        root, config, _, _ = self.make_fixture()
        plist_dir = root / "backups" / "launchd"
        launchd_config = copy_config(
            config,
            scheduler_backend="launchd",
            launchd_plist_dir=plist_dir.as_posix(),
        )
        original_run_process_plan = helper.run_process_plan
        plans = []

        try:
            def fake_run_process_plan(plan: ProcessPlan) -> dict[str, object]:
                plans.append(plan)

                return {
                    "exitCode": 0,
                    "stdout": "",
                    "stderr": "",
                    "timedOut": False,
                    "stdoutTruncated": False,
                    "stderrTruncated": False,
                }

            helper.run_process_plan = fake_run_process_plan
            response = handle_request({
                "operation": "cron.installManagedJob",
                "params": {
                    "jobId": "nightly",
                    "schedule": {
                        "minute": "0",
                        "hour": "2",
                        "dayOfMonth": "*",
                        "month": "*",
                        "dayOfWeek": "*",
                    },
                },
            }, launchd_config)
        finally:
            helper.run_process_plan = original_run_process_plan

        self.assertTrue(response["ok"])
        self.assertEqual(response["result"]["status"], "installed")
        self.assertTrue(plist_dir.is_dir())
        self.assertTrue((plist_dir / "com.mysql.workbench.helper.nightly.plist").is_file())
        self.assertEqual(plans[0].args, ["bootout", f"gui/{os.geteuid()}/com.mysql.workbench.helper.nightly"])
        self.assertEqual(plans[1].args, [
            "bootstrap",
            f"gui/{os.geteuid()}",
            (plist_dir / "com.mysql.workbench.helper.nightly.plist").as_posix(),
        ])

    def test_launchd_remove_boots_out_user_domain_job(self) -> None:
        root, config, _, _ = self.make_fixture()
        plist_dir = root / "backups" / "launchd"
        plist_dir.mkdir(parents=True)
        plist_path = plist_dir / "com.mysql.workbench.helper.nightly.plist"
        plist_path.write_text("plist", encoding="utf-8")
        launchd_config = copy_config(
            config,
            scheduler_backend="launchd",
            launchd_plist_dir=plist_dir.as_posix(),
        )
        original_run_process_plan = helper.run_process_plan
        plans = []

        try:
            def fake_run_process_plan(plan: ProcessPlan) -> dict[str, object]:
                plans.append(plan)

                return {
                    "exitCode": 0,
                    "stdout": "",
                    "stderr": "",
                    "timedOut": False,
                    "stdoutTruncated": False,
                    "stderrTruncated": False,
                }

            helper.run_process_plan = fake_run_process_plan
            response = handle_request({
                "operation": "cron.removeManagedJob",
                "params": {
                    "jobId": "nightly",
                },
            }, launchd_config)
        finally:
            helper.run_process_plan = original_run_process_plan

        self.assertTrue(response["ok"])
        self.assertEqual(response["result"]["status"], "removed")
        self.assertEqual(plans[0].args, ["bootout", f"gui/{os.geteuid()}/com.mysql.workbench.helper.nightly"])
        self.assertFalse(plist_path.exists())

    def test_launchd_remove_treats_missing_job_as_success(self) -> None:
        root, config, _, _ = self.make_fixture()
        plist_dir = root / "backups" / "launchd"
        plist_dir.mkdir(parents=True)
        plist_path = plist_dir / "com.mysql.workbench.helper.nightly.plist"
        plist_path.write_text("plist", encoding="utf-8")
        launchd_config = copy_config(
            config,
            scheduler_backend="launchd",
            launchd_plist_dir=plist_dir.as_posix(),
        )
        original_run_process_plan = helper.run_process_plan

        try:
            helper.run_process_plan = lambda _plan: {
                "exitCode": 3,
                "stdout": "",
                "stderr": "Boot-out failed: 3: No such process",
                "timedOut": False,
                "stdoutTruncated": False,
                "stderrTruncated": False,
            }
            response = handle_request({
                "operation": "cron.removeManagedJob",
                "params": {
                    "jobId": "nightly",
                },
            }, launchd_config)
        finally:
            helper.run_process_plan = original_run_process_plan

        self.assertTrue(response["ok"])
        self.assertEqual(response["result"]["status"], "notFound")
        self.assertFalse(plist_path.exists())

    def test_launchd_rejects_cron_day_or_semantics(self) -> None:
        _, config, _, _ = self.make_fixture()
        launchd_config = copy_config(config, scheduler_backend="launchd")

        response = handle_request({
            "operation": "cron.installManagedJob",
            "dryRun": True,
            "params": {
                "jobId": "nightly",
                "schedule": {
                    "minute": "0",
                    "hour": "2",
                    "dayOfMonth": "1",
                    "month": "*",
                    "dayOfWeek": "1",
                },
            },
        }, launchd_config, allow_dry_run=True)

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "invalid_request")

    def test_windows_task_scheduler_dry_run_uses_default_s4u(self) -> None:
        _, config, _, _ = self.make_fixture()
        windows_config = copy_config(
            config,
            scheduler_backend="schtasks",
            target_user=TargetUser(uid=1, gid=1, account=r"NT AUTHORITY\SYSTEM"),
            job_runner=r"C:\Windows\System32\cmd.exe",
            schtasks=r"C:\Windows\System32\schtasks.exe",
        )

        response = handle_request({
            "operation": "cron.installManagedJob",
            "dryRun": True,
            "params": {
                "jobId": "nightly",
                "schedule": {
                    "minute": "0",
                    "hour": "2",
                    "dayOfMonth": "*",
                    "month": "*",
                    "dayOfWeek": "*",
                },
            },
        }, windows_config, allow_dry_run=True)

        self.assertTrue(response["ok"])
        self.assertEqual(response["result"]["taskName"], r"\MySQLWorkbench\nightly")
        self.assertIn(r"C:\Windows\System32\cmd.exe", response["result"]["xml"])
        self.assertIn(
            f"<Arguments>--backup-home {windows_config.backup_home} run-job nightly</Arguments>",
            response["result"]["xml"],
        )
        self.assertIn("<MultipleInstancesPolicy>Queue</MultipleInstancesPolicy>", response["result"]["xml"])
        self.assertIn("<ExecutionTimeLimit>PT24H</ExecutionTimeLimit>", response["result"]["xml"])
        self.assertIn("NT AUTHORITY\\SYSTEM", response["result"]["xml"])
        self.assertIn("<LogonType>S4U</LogonType>", response["result"]["xml"])
        self.assertNotIn("<Repetition>", response["result"]["xml"])

    def test_windows_task_scheduler_dry_run_accepts_explicit_s4u(self) -> None:
        _, config, _, _ = self.make_fixture()
        windows_config = copy_config(
            config,
            scheduler_backend="schtasks",
            target_user=TargetUser(
                uid=1,
                gid=1,
                account=r"DOMAIN\backup-user",
                windows_logon_type="S4U",
            ),
            job_runner=r"C:\Windows\System32\cmd.exe",
            schtasks=r"C:\Windows\System32\schtasks.exe",
        )

        response = handle_request({
            "operation": "cron.installManagedJob",
            "dryRun": True,
            "params": {
                "jobId": "nightly",
                "schedule": {
                    "minute": "0",
                    "hour": "2",
                    "dayOfMonth": "*",
                    "month": "*",
                    "dayOfWeek": "*",
                },
            },
        }, windows_config, allow_dry_run=True)

        self.assertTrue(response["ok"], response)
        self.assertEqual(response["result"]["logonType"], "S4U")
        self.assertIn("<LogonType>S4U</LogonType>", response["result"]["xml"])

    def test_helper_config_rejects_unsupported_windows_logon_type(self) -> None:
        with tempfile.TemporaryDirectory(prefix="task-helper-config-", dir=HELPER_ROOT) as temporary:
            root = Path(temporary)
            backup_home = root / "backup-home"
            data_dir = root / "mysql-data"
            backup_home.mkdir()
            data_dir.mkdir()
            write_runtime_config(root, backup_home, data_dir)
            config_file = backup_home / "backups.cnf"
            parser = configparser.RawConfigParser()
            parser.read(config_file, encoding="utf-8")
            parser.set("meb", "windows_logon_type", "Password")
            with config_file.open("w", encoding="utf-8") as output:
                parser.write(output)

            with mock.patch.object(helper, "_read_helper_config_file", return_value=parser):
                with self.assertRaisesRegex(
                    HelperError,
                    "Windows logon type Password is not supported\\.",
                ):
                    helper.helper_config(backup_home)

    def test_helper_config_defaults_windows_logon_type_to_s4u(self) -> None:
        with tempfile.TemporaryDirectory(prefix="task-helper-config-", dir=HELPER_ROOT) as temporary:
            root = Path(temporary)
            backup_home = root / "backup-home"
            data_dir = root / "mysql-data"
            backup_home.mkdir()
            data_dir.mkdir()
            write_runtime_config(root, backup_home, data_dir)
            config_file = backup_home / "backups.cnf"
            parser = configparser.RawConfigParser()
            parser.read(config_file, encoding="utf-8")
            parser.remove_option("meb", "windows_logon_type")

            with mock.patch.object(helper, "_read_helper_config_file", return_value=parser):
                config = helper.helper_config(backup_home)

            self.assertEqual(config.target_user.windows_logon_type, "S4U")

    def test_helper_config_accepts_infinite_process_timeout(self) -> None:
        with tempfile.TemporaryDirectory(prefix="task-helper-config-", dir=HELPER_ROOT) as temporary:
            root = Path(temporary)
            backup_home = root / "backup-home"
            data_dir = root / "mysql-data"
            backup_home.mkdir()
            data_dir.mkdir()
            write_runtime_config(root, backup_home, data_dir)
            parser = configparser.RawConfigParser()
            parser.read(backup_home / "backups.cnf", encoding="utf-8")
            parser.set("meb", "timeout_ms", "0")

            with mock.patch.object(helper, "_read_helper_config_file", return_value=parser):
                config = helper.helper_config(backup_home)

            self.assertEqual(config.timeout_ms, 0)

    def test_helper_config_rejects_negative_process_timeout(self) -> None:
        with tempfile.TemporaryDirectory(prefix="task-helper-config-", dir=HELPER_ROOT) as temporary:
            root = Path(temporary)
            backup_home = root / "backup-home"
            data_dir = root / "mysql-data"
            backup_home.mkdir()
            data_dir.mkdir()
            write_runtime_config(root, backup_home, data_dir)
            parser = configparser.RawConfigParser()
            parser.read(backup_home / "backups.cnf", encoding="utf-8")
            parser.set("meb", "timeout_ms", "-1")

            with mock.patch.object(helper, "_read_helper_config_file", return_value=parser):
                with self.assertRaisesRegex(HelperError, r"timeout_ms must not be negative\."):
                    helper.helper_config(backup_home)

    def test_helper_config_rejects_zero_maximum_output_size(self) -> None:
        with tempfile.TemporaryDirectory(prefix="task-helper-config-", dir=HELPER_ROOT) as temporary:
            root = Path(temporary)
            backup_home = root / "backup-home"
            data_dir = root / "mysql-data"
            backup_home.mkdir()
            data_dir.mkdir()
            write_runtime_config(root, backup_home, data_dir)
            parser = configparser.RawConfigParser()
            parser.read(backup_home / "backups.cnf", encoding="utf-8")
            parser.set("meb", "max_output_bytes", "0")

            with mock.patch.object(helper, "_read_helper_config_file", return_value=parser):
                with self.assertRaisesRegex(HelperError, r"max_output_bytes must be positive\."):
                    helper.helper_config(backup_home)

    def test_windows_task_scheduler_reports_unsupported_logon_type(self) -> None:
        _, config, _, _ = self.make_fixture()
        windows_config = copy_config(
            config,
            scheduler_backend="schtasks",
            target_user=TargetUser(
                uid=1,
                gid=1,
                account=r"DOMAIN\backup-user",
                windows_logon_type="Password",
            ),
            job_runner=r"C:\Windows\System32\cmd.exe",
            schtasks=r"C:\Windows\System32\schtasks.exe",
        )

        response = handle_request({
            "operation": "cron.installManagedJob",
            "dryRun": True,
            "params": {
                "jobId": "nightly",
                "schedule": {
                    "minute": "0",
                    "hour": "2",
                    "dayOfMonth": "*",
                    "month": "*",
                    "dayOfWeek": "*",
                },
            },
        }, windows_config, allow_dry_run=True)

        self.assertFalse(response["ok"])
        self.assertEqual(
            response["error"]["message"],
            "Windows logon type Password is not supported.",
        )

    def test_windows_task_scheduler_reports_successful_logon_type(self) -> None:
        _, config, _, _ = self.make_fixture()
        schedule = {
            "minute": "0",
            "hour": "2",
            "dayOfMonth": "*",
            "month": "*",
            "dayOfWeek": "*",
        }

        for logon_type in ("InteractiveToken", "S4U"):
            with self.subTest(logon_type=logon_type):
                windows_config = copy_config(
                    config,
                    scheduler_backend="schtasks",
                    target_user=TargetUser(
                        uid=1,
                        gid=1,
                        account=r"DOMAIN\backup-user",
                        windows_logon_type=logon_type,
                    ),
                    job_runner=r"C:\Windows\System32\cmd.exe",
                    schtasks=r"C:\Windows\System32\schtasks.exe",
                )
                xml_paths: list[Path] = []
                xml_values: list[str] = []

                def install(plan: ProcessPlan) -> dict[str, object]:
                    self.assertIn("/HRESULT", plan.args)
                    xml_path = Path(plan.args[plan.args.index("/XML") + 1])
                    xml_paths.append(xml_path)
                    xml_values.append(xml_path.read_bytes().decode("utf-16"))

                    return {
                        "exitCode": 0,
                        "stdout": "",
                        "stderr": "",
                        "timedOut": False,
                        "stdoutTruncated": False,
                        "stderrTruncated": False,
                    }

                with mock.patch.object(helper, "run_process_plan", side_effect=install):
                    result = helper._install_windows_task(windows_config, "nightly", schedule, False)

                self.assertEqual(result["status"], "installed")
                self.assertEqual(result["logonType"], logon_type)
                self.assertEqual(len(xml_values), 1)
                self.assertIn(f"<LogonType>{logon_type}</LogonType>", xml_values[0])
                self.assertTrue(all(not path.exists() for path in xml_paths))

    def test_windows_task_scheduler_retries_s4u_access_denied(self) -> None:
        _, config, _, _ = self.make_fixture()
        windows_config = copy_config(
            config,
            scheduler_backend="schtasks",
            target_user=TargetUser(
                uid=1,
                gid=1,
                account=r"DOMAIN\backup-user",
                windows_logon_type="S4U",
            ),
            job_runner=r"C:\Windows\System32\cmd.exe",
            schtasks=r"C:\Windows\System32\schtasks.exe",
        )
        schedule = {
            "minute": "0",
            "hour": "2",
            "dayOfMonth": "*",
            "month": "*",
            "dayOfWeek": "*",
        }

        for access_denied in (0x80070005, -2147024891):
            with self.subTest(access_denied=access_denied):
                results = [
                    {
                        "exitCode": access_denied,
                        "stdout": "",
                        "stderr": "ERROR: Access is denied.",
                        "timedOut": False,
                        "stdoutTruncated": False,
                        "stderrTruncated": False,
                    },
                    {
                        "exitCode": 0,
                        "stdout": "",
                        "stderr": "",
                        "timedOut": False,
                        "stdoutTruncated": False,
                        "stderrTruncated": False,
                    },
                ]
                xml_paths: list[Path] = []
                xml_values: list[str] = []

                def install(plan: ProcessPlan) -> dict[str, object]:
                    self.assertIn("/HRESULT", plan.args)
                    xml_path = Path(plan.args[plan.args.index("/XML") + 1])
                    xml_paths.append(xml_path)
                    xml_values.append(xml_path.read_bytes().decode("utf-16"))

                    return results[len(xml_values) - 1]

                with mock.patch.object(helper, "run_process_plan", side_effect=install):
                    result = helper._install_windows_task(windows_config, "nightly", schedule, False)

                self.assertEqual(result["status"], "installed")
                self.assertEqual(result["logonType"], "InteractiveToken")
                self.assertEqual(len(xml_values), 2)
                self.assertIn("<LogonType>S4U</LogonType>", xml_values[0])
                self.assertIn("<LogonType>InteractiveToken</LogonType>", xml_values[1])
                self.assertTrue(all(not path.exists() for path in xml_paths))

    def test_windows_task_scheduler_does_not_retry_other_failures(self) -> None:
        _, config, _, _ = self.make_fixture()
        schedule = {
            "minute": "0",
            "hour": "2",
            "dayOfMonth": "*",
            "month": "*",
            "dayOfWeek": "*",
        }
        cases = (
            ("S4U", 0x80070002, False, False, False),
            ("S4U", 0x80070005, True, False, False),
            ("S4U", 0x80070005, False, True, False),
            ("S4U", 0x80070005, False, False, True),
            ("InteractiveToken", 0x80070005, False, False, False),
        )

        for logon_type, exit_code, timed_out, stdout_truncated, stderr_truncated in cases:
            with self.subTest(
                logon_type=logon_type,
                exit_code=exit_code,
                timed_out=timed_out,
                stdout_truncated=stdout_truncated,
                stderr_truncated=stderr_truncated,
            ):
                windows_config = copy_config(
                    config,
                    scheduler_backend="schtasks",
                    target_user=TargetUser(
                        uid=1,
                        gid=1,
                        account=r"DOMAIN\backup-user",
                        windows_logon_type=logon_type,
                    ),
                    job_runner=r"C:\Windows\System32\cmd.exe",
                    schtasks=r"C:\Windows\System32\schtasks.exe",
                )
                attempts = 0

                def install(_plan: ProcessPlan) -> dict[str, object]:
                    nonlocal attempts
                    attempts += 1

                    return {
                        "exitCode": exit_code,
                        "stdout": "",
                        "stderr": "ERROR: Registration failed.",
                        "timedOut": timed_out,
                        "stdoutTruncated": stdout_truncated,
                        "stderrTruncated": stderr_truncated,
                    }

                with mock.patch.object(helper, "run_process_plan", side_effect=install):
                    result = helper._install_windows_task(windows_config, "nightly", schedule, False)

                self.assertEqual(attempts, 1)
                self.assertEqual(result["status"], "failed")
                self.assertEqual(result["logonType"], logon_type)

    def test_windows_task_scheduler_reports_s4u_fallback_failure(self) -> None:
        _, config, _, _ = self.make_fixture()
        windows_config = copy_config(
            config,
            scheduler_backend="schtasks",
            target_user=TargetUser(
                uid=1,
                gid=1,
                account=r"DOMAIN\backup-user",
                windows_logon_type="S4U",
            ),
            job_runner=r"C:\Windows\System32\cmd.exe",
            schtasks=r"C:\Windows\System32\schtasks.exe",
        )
        results = [
            {
                "exitCode": 0x80070005,
                "stdout": "",
                "stderr": "ERROR: Access is denied.",
                "timedOut": False,
                "stdoutTruncated": False,
                "stderrTruncated": False,
            },
            {
                "exitCode": 0x80070002,
                "stdout": "",
                "stderr": "ERROR: The system cannot find the file specified.",
                "timedOut": False,
                "stdoutTruncated": False,
                "stderrTruncated": False,
            },
        ]
        attempts = 0

        def install(_plan: ProcessPlan) -> dict[str, object]:
            nonlocal attempts
            result = results[attempts]
            attempts += 1

            return result

        with mock.patch.object(helper, "run_process_plan", side_effect=install):
            result = helper._install_windows_task(
                windows_config,
                "nightly",
                {
                    "minute": "0",
                    "hour": "2",
                    "dayOfMonth": "*",
                    "month": "*",
                    "dayOfWeek": "*",
                },
                False,
            )

        self.assertEqual(attempts, 2)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["logonType"], "InteractiveToken")
        self.assertIn("S4U registration was denied", result["message"])
        self.assertIn("cannot find the file specified", result["message"])

    def test_windows_task_scheduler_removes_xml_after_write_failure(self) -> None:
        root, config, _, _ = self.make_fixture()
        task_xml_path = root / "task.xml"
        windows_config = copy_config(
            config,
            scheduler_backend="schtasks",
            target_user=TargetUser(uid=1, gid=1, account=r"DOMAIN\backup-user"),
            job_runner=r"C:\Windows\System32\cmd.exe",
            schtasks=r"C:\Windows\System32\schtasks.exe",
        )

        class FailingTemporaryFile:
            name = task_xml_path.as_posix()

            def __enter__(self) -> "FailingTemporaryFile":
                return self

            def __exit__(self, *args: object) -> None:
                return None

            def write(self, content: bytes) -> None:
                task_xml_path.write_bytes(content[:16])
                raise OSError("simulated XML write failure")

        with mock.patch.object(helper.tempfile, "NamedTemporaryFile", return_value=FailingTemporaryFile()):
            with self.assertRaisesRegex(OSError, "simulated XML write failure"):
                helper._install_windows_task(
                    windows_config,
                    "nightly",
                    {
                        "minute": "0",
                        "hour": "2",
                        "dayOfMonth": "*",
                        "month": "*",
                        "dayOfWeek": "*",
                    },
                    False,
                )

        self.assertFalse(task_xml_path.exists())

    def test_windows_task_scheduler_generates_hourly_repetition(self) -> None:
        _, config, _, _ = self.make_fixture()
        windows_config = copy_config(
            config,
            scheduler_backend="schtasks",
            target_user=TargetUser(uid=1, gid=1, account=r"NT AUTHORITY\SYSTEM"),
            job_runner=r"C:\Windows\System32\cmd.exe",
            schtasks=r"C:\Windows\System32\schtasks.exe",
        )

        for hour, interval in (("*", "PT1H"), ("*/4", "PT4H"), ("*/5", "PT5H")):
            with self.subTest(hour=hour):
                response = handle_request({
                    "operation": "cron.installManagedJob",
                    "dryRun": True,
                    "params": {
                        "jobId": "hourly",
                        "schedule": {
                            "minute": "17",
                            "hour": hour,
                            "dayOfMonth": "*",
                            "month": "*",
                            "dayOfWeek": "*",
                        },
                    },
                }, windows_config, allow_dry_run=True)

                self.assertTrue(response["ok"], response)
                xml = response["result"]["xml"]
                self.assertEqual(xml.count("<CalendarTrigger>"), 1)
                self.assertIn("<StartBoundary>2026-01-01T00:17:00</StartBoundary>", xml)
                self.assertIn(f"<Interval>{interval}</Interval>", xml)
                self.assertIn("<Duration>PT23H59M</Duration>", xml)
                self.assertNotIn("<StopAtDurationEnd>", xml)
                self.assertIn("<ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>", xml)

    def test_windows_task_scheduler_xml_uses_utf16_encoding(self) -> None:
        _, config, _, _ = self.make_fixture()
        windows_config = copy_config(
            config,
            target_user=TargetUser(uid=1, gid=1, account=r"NT AUTHORITY\SYSTEM"),
            job_runner=r"C:\Program Files\MySQL\Zażółć\task-helper.cmd",
        )

        task_xml = helper._render_windows_task_xml(
            windows_config,
            "nightly",
            {
                "minute": "0",
                "hour": "2",
                "dayOfMonth": "*",
                "month": "*",
                "dayOfWeek": "*",
            },
        )

        self.assertIn(task_xml[:2], (codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE))
        decoded_xml = task_xml.decode("utf-16")
        self.assertTrue(decoded_xml.startswith("<?xml version='1.0' encoding='utf-16'?>"))
        self.assertIn(f"<Command>{windows_config.job_runner}</Command>", decoded_xml)

    def test_windows_task_scheduler_plan_preserves_system_root(self) -> None:
        _, config, _, _ = self.make_fixture()
        windows_config = copy_config(
            config,
            scheduler_backend="schtasks",
            schtasks=r"D:\Windows\System32\schtasks.exe",
        )

        with mock.patch.dict(helper.os.environ, {"SystemRoot": r"D:\Windows"}, clear=True):
            plan = helper._schtasks_plan(windows_config, ["/Query"])

        self.assertEqual(plan.env.get("SYSTEMROOT"), r"D:\Windows")

    def test_windows_task_scheduler_accepts_cmd_job_runner(self) -> None:
        _, config, _, _ = self.make_fixture()
        root = Path(tempfile.mkdtemp(prefix="task-helper-windows-runner-")).resolve()
        job_runner = root / "task-helper.cmd"
        job_runner.write_text("@echo off\r\n", encoding="utf-8")
        windows_config = copy_config(
            config,
            backup_home=r"C:\Users\paandrus\backups new",
            target_user=TargetUser(uid=1, gid=1, account=r"NT AUTHORITY\SYSTEM"),
            job_runner=job_runner.as_posix(),
        )

        with mock.patch.object(helper.os, "name", "nt"):
            with mock.patch.object(helper, "Path", PurePath):
                xml = helper._render_windows_task_xml(
                    windows_config,
                    "nightly",
                    {
                        "minute": "0",
                        "hour": "2",
                        "dayOfMonth": "*",
                        "month": "*",
                        "dayOfWeek": "*",
                    },
                ).decode("utf-16")

        self.assertIn(f"<Command>{job_runner.as_posix()}</Command>", xml)
        self.assertIn(
            r'<Arguments>--backup-home "C:\Users\paandrus\backups new" run-job nightly</Arguments>',
            xml,
        )

    def test_windows_task_scheduler_generates_monthly_day_list(self) -> None:
        _, config, _, _ = self.make_fixture()
        windows_config = copy_config(
            config,
            scheduler_backend="schtasks",
            target_user=TargetUser(uid=1, gid=1, account=r"NT AUTHORITY\SYSTEM"),
            job_runner=r"C:\Windows\System32\cmd.exe",
            schtasks=r"C:\Windows\System32\schtasks.exe",
        )

        response = handle_request({
            "operation": "cron.installManagedJob",
            "dryRun": True,
            "params": {
                "jobId": "monthly",
                "schedule": {
                    "minute": "30",
                    "hour": "2",
                    "dayOfMonth": "1,15,30",
                    "month": "*",
                    "dayOfWeek": "*",
                },
            },
        }, windows_config, allow_dry_run=True)

        self.assertTrue(response["ok"])
        xml = response["result"]["xml"]
        self.assertIn("<ScheduleByMonth>", xml)
        self.assertIn("<Day>1</Day>", xml)
        self.assertIn("<Day>15</Day>", xml)
        self.assertIn("<Day>30</Day>", xml)

    def test_windows_task_remove_returns_detailed_failure(self) -> None:
        _, config, _, _ = self.make_fixture()
        windows_config = copy_config(
            config,
            scheduler_backend="schtasks",
            target_user=TargetUser(uid=1, gid=1, account=r"NT AUTHORITY\SYSTEM"),
            job_runner=r"C:\Windows\System32\cmd.exe",
            schtasks=r"C:\Windows\System32\schtasks.exe",
        )
        original_run_process_plan = helper.run_process_plan

        try:
            helper.run_process_plan = lambda _plan: {
                "exitCode": 5,
                "stdout": "",
                "stderr": "ERROR: Access is denied.",
                "timedOut": False,
                "stdoutTruncated": False,
                "stderrTruncated": False,
            }
            response = handle_request({
                "operation": "cron.removeManagedJob",
                "params": {
                    "jobId": "nightly",
                },
            }, windows_config)
        finally:
            helper.run_process_plan = original_run_process_plan

        self.assertTrue(response["ok"])
        self.assertEqual(response["result"]["status"], "failed")
        self.assertIn("Access is denied", response["result"]["message"])

    def test_windows_task_remove_treats_missing_task_as_success(self) -> None:
        _, config, _, _ = self.make_fixture()
        windows_config = copy_config(
            config,
            scheduler_backend="schtasks",
            target_user=TargetUser(uid=1, gid=1, account=r"NT AUTHORITY\SYSTEM"),
            job_runner=r"C:\Windows\System32\cmd.exe",
            schtasks=r"C:\Windows\System32\schtasks.exe",
        )
        original_run_process_plan = helper.run_process_plan

        try:
            helper.run_process_plan = lambda _plan: {
                "exitCode": 1,
                "stdout": "",
                "stderr": "ERROR: The system cannot find the file specified.",
                "timedOut": False,
                "stdoutTruncated": False,
                "stderrTruncated": False,
            }
            response = handle_request({
                "operation": "cron.removeManagedJob",
                "params": {
                    "jobId": "nightly",
                },
            }, windows_config)
        finally:
            helper.run_process_plan = original_run_process_plan

        self.assertTrue(response["ok"])
        self.assertEqual(response["result"]["status"], "notFound")

    def test_cron_rejects_job_runner_paths_that_are_unsafe_for_crontab(self) -> None:
        _, config, _, _ = self.make_fixture()
        unsafe_config = copy_config(config, job_runner="/opt/mysql-workbench-helper/bin/run-job;evil")

        response = handle_request({
            "operation": "cron.installManagedJob",
            "dryRun": True,
            "params": {
                "jobId": "nightly",
                "schedule": {
                    "minute": "0",
                    "hour": "2",
                    "dayOfMonth": "*",
                    "month": "*",
                    "dayOfWeek": "*",
                },
            },
        }, unsafe_config, allow_dry_run=True)

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "invalid_config")

    def test_managed_cron_block_replacement_preserves_unmanaged_lines(self) -> None:
        config = make_config(Path("/tmp"))
        existing = "\n".join([
            "MAILTO=dba@example.com",
            "",
            "# BEGIN mysql-workbench-managed:nightly",
            "0 1 * * * /old/run-job run-job nightly",
            "# END mysql-workbench-managed:nightly",
            "",
            "15 3 * * * /usr/local/bin/unmanaged",
        ])

        result = install_managed_job_block(existing, config, "nightly", {
            "minute": "30",
            "hour": "2",
            "dayOfMonth": "*",
            "month": "*",
            "dayOfWeek": "1-5",
        })

        self.assertIn("MAILTO=dba@example.com", result)
        self.assertIn("15 3 * * * /usr/local/bin/unmanaged", result)
        self.assertIn(
            f"30 2 * * 1-5 {config.job_runner} --backup-home {config.backup_home} run-job nightly",
            result,
        )
        self.assertNotIn("/old/run-job", result)

    def test_managed_cron_block_removal_does_not_remove_unmanaged_lines(self) -> None:
        existing = "\n".join([
            "MAILTO=dba@example.com",
            "# BEGIN mysql-workbench-managed:nightly",
            "0 1 * * * /opt/mysql-workbench-helper/bin/run-job run-job nightly",
            "# END mysql-workbench-managed:nightly",
            "15 3 * * * /usr/local/bin/unmanaged",
        ])

        result = remove_managed_job_block(existing, "nightly")

        self.assertIn("MAILTO=dba@example.com", result)
        self.assertIn("15 3 * * * /usr/local/bin/unmanaged", result)
        self.assertNotIn("mysql-workbench-managed:nightly", result)

    def test_cron_remove_returns_not_found_without_rewriting_crontab(self) -> None:
        _, config, _, _ = self.make_fixture()
        original_read_current_crontab = helper._read_current_crontab
        original_run_process_plan = helper.run_process_plan
        plans = []

        try:
            helper._read_current_crontab = lambda _config: "15 3 * * * /usr/local/bin/unmanaged\n"
            helper.run_process_plan = lambda plan: plans.append(plan) or {
                "exitCode": 0,
                "stdout": "",
                "stderr": "",
                "timedOut": False,
                "stdoutTruncated": False,
                "stderrTruncated": False,
            }
            response = handle_request({
                "operation": "cron.removeManagedJob",
                "params": {
                    "jobId": "nightly",
                },
            }, config)
        finally:
            helper._read_current_crontab = original_read_current_crontab
            helper.run_process_plan = original_run_process_plan

        self.assertTrue(response["ok"])
        self.assertEqual(response["result"]["status"], "notFound")
        self.assertEqual(plans, [])

    def test_cron_remove_returns_detailed_failure(self) -> None:
        _, config, _, _ = self.make_fixture()
        existing = "\n".join([
            "# BEGIN mysql-workbench-managed:nightly",
            "0 2 * * * /opt/mysql-workbench-helper/bin/run-job run-job nightly",
            "# END mysql-workbench-managed:nightly",
        ])
        original_read_current_crontab = helper._read_current_crontab
        original_run_process_plan = helper.run_process_plan

        try:
            helper._read_current_crontab = lambda _config: existing
            helper.run_process_plan = lambda _plan: {
                "exitCode": 1,
                "stdout": "",
                "stderr": "crontab: permission denied",
                "timedOut": False,
                "stdoutTruncated": False,
                "stderrTruncated": False,
            }
            response = handle_request({
                "operation": "cron.removeManagedJob",
                "params": {
                    "jobId": "nightly",
                },
            }, config)
        finally:
            helper._read_current_crontab = original_read_current_crontab
            helper.run_process_plan = original_run_process_plan

        self.assertTrue(response["ok"])
        self.assertEqual(response["result"]["status"], "failed")
        self.assertIn("permission denied", response["result"]["message"])

    def test_malformed_managed_cron_block_is_not_silently_rewritten(self) -> None:
        existing = "\n".join([
            "MAILTO=dba@example.com",
            "# BEGIN mysql-workbench-managed:nightly",
            "15 3 * * * /usr/local/bin/unmanaged",
        ])

        with self.assertRaisesRegex(Exception, "malformed"):
            remove_managed_job_block(existing, "nightly")

    def test_process_output_is_bounded(self) -> None:
        root = Path(tempfile.mkdtemp(prefix="task-helper-runner-")).resolve()
        executable = root / "output.sh"
        executable.write_text("#!/bin/sh\nprintf 1234567890\n", encoding="utf-8")
        executable.chmod(0o700)

        result = run_process_plan(ProcessPlan(
            executable=executable.as_posix(),
            args=[],
            cwd="/",
            env={"PATH": "/usr/bin:/bin"},
            uid=os.getuid(),
            gid=os.getgid(),
            timeout_ms=1000,
            max_output_bytes=4,
            audit_name="test.output",
        ))

        self.assertEqual(result["stdout"], "1234")
        self.assertEqual(result["output"], "1234")
        self.assertTrue(result["stdoutTruncated"])

    def test_process_runner_accepts_infinite_timeout(self) -> None:
        root = Path(tempfile.mkdtemp(prefix="task-helper-runner-")).resolve()
        executable = root / "delayed-output.sh"
        executable.write_text("#!/bin/sh\nsleep 0.1\nprintf done\n", encoding="utf-8")
        executable.chmod(0o700)

        with mock.patch.object(helper, "validate_executable_reference"):
            result = run_process_plan(ProcessPlan(
                executable=executable.as_posix(),
                args=[],
                cwd="/",
                env={"PATH": "/usr/bin:/bin"},
                uid=os.getuid(),
                gid=os.getgid(),
                timeout_ms=0,
                max_output_bytes=32,
                audit_name="test.infinite-timeout",
            ))

        self.assertEqual(result["exitCode"], 0)
        self.assertEqual(result["stdout"], "done")
        self.assertFalse(result["timedOut"])

    def test_process_plan_rejects_negative_timeout(self) -> None:
        with self.assertRaisesRegex(HelperError, r"timeoutMs must not be negative\."):
            validate_process_plan(ProcessPlan(
                executable="/usr/bin/true",
                args=[],
                cwd="/",
                env={"PATH": "/usr/bin:/bin"},
                uid=os.getuid(),
                gid=os.getgid(),
                timeout_ms=-1,
                max_output_bytes=32,
                audit_name="test.negative-timeout",
            ))

    def test_process_output_is_captured_when_log_file_is_used(self) -> None:
        root = Path(tempfile.mkdtemp(prefix="task-helper-runner-")).resolve()
        executable = root / "output.sh"
        log_path = root / "process.log"
        output_path = root / "process-output.log"
        executable.write_text("#!/bin/sh\nprintf stdout-text\nprintf stderr-text >&2\n", encoding="utf-8")
        executable.chmod(0o700)
        log_path.write_text("", encoding="utf-8")
        output_path.write_text("", encoding="utf-8")
        if os.name == "posix":
            log_path.chmod(0o600)
            output_path.chmod(0o600)

        result = run_process_plan(ProcessPlan(
            executable=executable.as_posix(),
            args=[],
            cwd="/",
            env={"PATH": "/usr/bin:/bin"},
            uid=os.getuid(),
            gid=os.getgid(),
            timeout_ms=1000,
            max_output_bytes=128,
            audit_name="test.output",
            log_path=log_path.as_posix(),
            output_path=output_path.as_posix(),
        ))

        self.assertEqual(result["stdout"], "stdout-text")
        self.assertEqual(result["stderr"], "stderr-text")
        self.assertIn("stdout-text", result["output"])
        self.assertIn("stderr-text", result["output"])
        self.assertEqual(output_path.read_text(encoding="utf-8"), result["output"])
        log_content = log_path.read_text(encoding="utf-8")
        self.assertIn("stdout-text", log_content)
        self.assertIn("stderr-text", log_content)

    def test_process_runner_rejects_symlink_executables(self) -> None:
        root = Path(tempfile.mkdtemp(prefix="task-helper-runner-")).resolve()
        executable = root / "output.sh"
        symlink = root / "output-link.sh"
        executable.write_text("#!/bin/sh\nprintf ok\n", encoding="utf-8")
        executable.chmod(0o700)
        symlink.symlink_to(executable)

        with self.assertRaises(HelperError):
            run_process_plan(ProcessPlan(
                executable=symlink.as_posix(),
                args=[],
                cwd="/",
                env={"PATH": "/usr/bin:/bin"},
                uid=os.getuid(),
                gid=os.getgid(),
                timeout_ms=1000,
                max_output_bytes=32,
                audit_name="test.symlink",
            ))


if __name__ == "__main__":
    unittest.main()
