# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.

from __future__ import annotations

import configparser
import json
import os
import tempfile
import unittest
import importlib.util
import sys
import types
from datetime import datetime, timezone
from typing import Literal, get_type_hints
from unittest import mock
from pathlib import Path


MEB_ROOT = Path(__file__).resolve().parents[3] / "gui_plugin" / "meb"
GUI_PLUGIN_ROOT = MEB_ROOT.parent

gui_plugin_package = types.ModuleType("gui_plugin")
gui_plugin_package.__path__ = [GUI_PLUGIN_ROOT.as_posix()]  # type: ignore[attr-defined]
meb_package = types.ModuleType("gui_plugin.meb")
meb_package.__path__ = [MEB_ROOT.as_posix()]  # type: ignore[attr-defined]
sys.modules.setdefault("gui_plugin", gui_plugin_package)
sys.modules.setdefault("gui_plugin.meb", meb_package)

def load_meb_module(name: str) -> types.ModuleType:
    module_name = f"gui_plugin.meb.{name}"
    spec = importlib.util.spec_from_file_location(module_name, MEB_ROOT / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)

    return module


models = load_meb_module("models")
load_meb_module("os_utils")
backup_home = load_meb_module("backup_home")

MebBackupProfile = models.MebBackupProfile
MebProfileSchedule = models.MebProfileSchedule
MebBackupProfileInfo = models.MebBackupProfileInfo
_read_profiles = backup_home._read_profiles
build_status = backup_home.build_status
delete_profile = backup_home.delete_profile
save_profile = backup_home.save_profile


def local_artifact_name(log_timestamp: str) -> str:
    timestamp = datetime.strptime(log_timestamp, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).timestamp()

    return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d_%H-%M-%S")


def completed_backup_log(artifact: Path) -> str:
    return f"Backup directory created: '{artifact}'\nmysqlbackup completed OK!\n"


def write_backup_variables(path: Path, *, is_incremental: bool, start_lsn: int, end_lsn: int) -> None:
    metadata_dir = path / "meta"
    metadata_dir.mkdir(parents=True)
    (metadata_dir / "backup_variables.txt").write_text(
        "[backup_variables]\n"
        f"is_incremental={int(is_incremental)}\n"
        f"start_lsn={start_lsn}\n"
        f"end_lsn={end_lsn}\n",
        encoding="utf-8",
    )


def read_config(path: str) -> configparser.RawConfigParser:
    config = configparser.RawConfigParser()
    config.optionxform = str.lower
    with open(path, encoding="utf-8") as config_file:
        config.read_file(config_file)

    return config


def daily_schedule(hour: str, minute: str, interval: str = "1") -> MebProfileSchedule:
    return MebProfileSchedule(
        enabled=True,
        interval=int(interval),
        frequency=1,
        hour=int(hour),
        minute=int(minute),
    )


def weekly_schedule(hour: str, minute: str, week_day: int) -> MebProfileSchedule:
    week_days = [False] * 7
    week_days[week_day] = True

    return MebProfileSchedule(
        enabled=True,
        frequency=2,
        hour=int(hour),
        minute=int(minute),
        weekDays=week_days,
    )


def monthly_schedule(hour: str, minute: str, month_days: str) -> MebProfileSchedule:
    return MebProfileSchedule(
        enabled=True,
        frequency=3,
        monthDays=[int(day) for day in month_days.split(",")],
        hour=int(hour),
        minute=int(minute),
    )


def profile(label: str, destination: Path, schedule: MebProfileSchedule) -> MebBackupProfile:
    return MebBackupProfile(
        label=label,
        destination=destination.as_posix(),
        fullSchedule=schedule,
    )


class MebBackupHomeTests(unittest.TestCase):
    def test_profile_storage_type_contract_is_local(self) -> None:
        self.assertEqual(get_type_hints(MebBackupProfileInfo)["storageType"], Literal["local"])
        self.assertEqual(get_type_hints(MebBackupProfile)["storageType"], Literal["local"])
        self.assertEqual(MebBackupProfileInfo().storageType, "local")
        self.assertEqual(MebBackupProfile().storageType, "local")

    def test_profile_tts_contract_uses_config_values(self) -> None:
        expected = Literal["0", "1", "2"]
        self.assertEqual(get_type_hints(MebBackupProfileInfo)["usingTts"], expected)
        self.assertEqual(get_type_hints(MebBackupProfile)["usingTts"], expected)
        self.assertEqual(MebBackupProfileInfo().usingTts, "0")
        self.assertEqual(MebBackupProfile().usingTts, "0")

    def test_profile_partial_contract_is_boolean(self) -> None:
        self.assertIs(get_type_hints(MebBackupProfileInfo)["partial"], bool)
        self.assertIs(get_type_hints(MebBackupProfile)["partial"], bool)
        self.assertFalse(MebBackupProfileInfo().partial)
        self.assertFalse(MebBackupProfile().partial)

    def test_profile_tts_mode_round_trips_through_config_value(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            draft = profile("nightly", backup_home / "nightly", daily_schedule("2", "15"))
            draft.usingTts = "1"

            save_profile(backup_home.as_posix(), draft)

            saved_profile = _read_profiles(backup_home.as_posix())[0]
            config = read_config(saved_profile.configPath)
            self.assertEqual(config.get("meb_manager", "using_tts"), "1")
            self.assertEqual(saved_profile.usingTts, "1")

    def test_build_status_returns_profile_template_from_manager_values(self) -> None:
        status = build_status(
            "/backup-home",
            {
                "mysqlbackup": "/usr/bin/mysqlbackup",
                "backup_mysql_user": "mysqlbackup@localhost",
                "datadir": "/var/lib/mysql",
                "basedir": "/usr",
            },
            [],
        )

        self.assertEqual(status.profileTemplate.label, "Backup")
        self.assertEqual(status.profileTemplate.destination, "/backup-home")
        self.assertEqual(status.profileTemplate.command, "/usr/bin/mysqlbackup")
        self.assertEqual(status.profileTemplate.user, "mysqlbackup@localhost")
        self.assertEqual(status.profileTemplate.datadir, "/var/lib/mysql")
        self.assertEqual(status.profileTemplate.mysqlBasedir, "/usr")
        self.assertEqual(status.profileTemplate.fullSchedule.weekDays, [False] * 7)
        self.assertEqual(status.profileTemplate.incSchedule.weekDays, [False] * 7)

    def test_read_profiles_imports_workbench8_profile(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            backup_home.mkdir()
            destination = backup_home / "nightly"
            profile_path = backup_home / "workbench8.cnf"
            profile_path.write_text(
                "\n".join([
                    "[meb_manager]",
                    "uuid = workbench8-profile",
                    "label = Workbench 8 Profile",
                    "partial = True",
                    "compress = True",
                    "compress_method = zlib",
                    "compress_level = 7",
                    "apply_log = True",
                    "using_tts = 1",
                    "",
                    "[client]",
                    "user = mysqlbackup@localhost",
                    "",
                    "[mysqlbackup]",
                    "backup_dir = %s" % destination.as_posix(),
                    "incremental_backup_dir = %s" % (destination / "inc").as_posix(),
                    "incremental_base = history:last_full_backup",
                    "command = /opt/mysql/meb/bin/mysqlbackup",
                    "basedir = /opt/mysql/server",
                    "comments = Imported profile",
                    "include = ^sales\\.",
                    "databases = sakila world.city weird$name.tmp*",
                    "exclude_tables = ^sales\\.scratch",
                    "",
                    "[mysqld]",
                    "datadir = /var/lib/mysql",
                    "",
                ]),
                encoding="utf-8",
            )

            profiles = _read_profiles(backup_home.as_posix())

            self.assertEqual(len(profiles), 1)
            imported = profiles[0]
            self.assertEqual(imported.uuid, "workbench8-profile")
            self.assertEqual(imported.label, "Workbench 8 Profile")
            self.assertEqual(imported.destination, destination.as_posix())
            self.assertEqual(imported.command, "/opt/mysql/meb/bin/mysqlbackup")
            self.assertEqual(imported.mysqlBasedir, "/opt/mysql/server")
            self.assertEqual(imported.datadir, "/var/lib/mysql")
            self.assertEqual(imported.user, "mysqlbackup@localhost")
            self.assertEqual(imported.comments, "Imported profile")
            self.assertTrue(imported.partial)
            self.assertTrue(imported.compress)
            self.assertEqual(imported.compressMethod, "zlib")
            self.assertEqual(imported.compressLevel, "7")
            self.assertTrue(imported.applyLog)
            self.assertEqual(imported.usingTts, "1")
            self.assertEqual(imported.incrementalBase, "history:last_full_backup")
            self.assertEqual(imported.excludeTables, "^sales\\.scratch")
            self.assertEqual(
                imported.includeTables,
                r"(?:^sales\.)|(?:^(?:sakila\..*|world\.city|weird\$name\.tmp\*)$)",
            )
            self.assertTrue(imported.legacyPartialBackupConverted)
            self.assertIn("legacy partial backup options",
                          imported.legacyPartialBackupConversionMessage or "")

    def test_read_profiles_keeps_explicit_include_tables_without_conversion(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            backup_home.mkdir()
            profile_path = backup_home / "modern.cnf"
            profile_path.write_text(
                "\n".join([
                    "[mysqlbackup]",
                    "backup_dir = %s" % (backup_home / "nightly").as_posix(),
                    "include = ^legacy\\.",
                    "databases = sakila",
                    "include_tables = ^modern\\.",
                    "",
                    "[meb_manager]",
                    "uuid = modern",
                    "label = Modern",
                    "partial = True",
                    "",
                ]),
                encoding="utf-8",
            )

            profiles = _read_profiles(backup_home.as_posix())

            self.assertEqual(len(profiles), 1)
            self.assertEqual(profiles[0].includeTables, "^modern\\.")
            self.assertFalse(profiles[0].legacyPartialBackupConverted)

    def test_build_status_reports_backup_home_disk_usage(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            backup_home_path.mkdir()
            (backup_home_path / "backups.cnf").write_bytes(b"x" * 512)
            backup_directory = backup_home_path / "nightly"
            backup_directory.mkdir()
            (backup_directory / "backup.img").write_bytes(b"x" * 1024)

            disk_usage = mock.Mock(total=1024 * 1024 + 1024 * 5, used=1024 * 1024, free=1024 * 5)
            with mock.patch.object(backup_home.shutil, "disk_usage", return_value=disk_usage):
                status = build_status(backup_home_path.as_posix(), {}, [])

        self.assertEqual(status.spaceAvailable, "5.0 KB")
        self.assertEqual(status.spaceUsed, "1.5 KB")
        self.assertEqual(status.spaceTotal, "1.0 MB")
        self.assertAlmostEqual(status.spaceUsedPercent or 0, 0.15, places=2)
        self.assertAlmostEqual(status.spaceOtherUsedPercent or 0, 99.37, places=2)

    def test_build_status_deduplicates_recent_activity_for_shared_destinations(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            log_dir = backup_home / "logs"
            log_dir.mkdir(parents=True)
            log_file = log_dir / "mysqlbackup.log"
            log_file.write_text("mysqlbackup completed OK!\n", encoding="utf-8")

            status = build_status(
                backup_home.as_posix(),
                {},
                [
                    MebBackupProfileInfo(destination=backup_home.as_posix()),
                    MebBackupProfileInfo(destination=backup_home.as_posix()),
                ],
            )

            self.assertEqual(len(status.recentActivity), 1)
            self.assertEqual(status.recentActivity[0].activityId, "activity:v1:logs/mysqlbackup.log")

    def test_build_status_adds_running_progress_to_recent_activity(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            backup_home.mkdir()
            (backup_home / ".backup-run.lock").mkdir()
            log_path = backup_home / "logs" / "nightly.log"
            log_path.parent.mkdir()
            log_path.write_text("backup running\n", encoding="utf-8")
            (backup_home / ".backup-progress.json").write_text(json.dumps({
                "version": 1,
                "state": "running",
                "jobId": "profile-1-backup-full",
                "runMode": "manual",
                "startedTime": 1_781_522_400,
                "updatedTime": 1_781_522_430,
                "logPath": log_path.as_posix(),
                "mysqlbackupProgressPath": (backup_home / ".backup-progress").as_posix(),
            }), encoding="utf-8")
            (backup_home / ".backup-progress").write_text(
                "Progress: 4 of 11 MB; state: Copying .ibd files\n",
                encoding="utf-8",
            )

            status = build_status(
                backup_home.as_posix(),
                {},
                [MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination=(backup_home / "full").as_posix())],
            )

            self.assertEqual(status.recentActivity[0].title, "Backup running: Nightly")
            self.assertEqual(status.recentActivity[0].profile, "Nightly")
            self.assertEqual(status.recentActivity[0].status, "Running")
            self.assertEqual(status.recentActivity[0].backupType, "Full Backup")
            self.assertTrue(status.recentActivity[0].isBackup)
            self.assertEqual(status.recentActivity[0].detail, "4 of 11 MB; Copying .ibd files")
            self.assertEqual(status.recentActivity[0].tone, "info")
            self.assertEqual(status.recentActivity[0].activityId, "activity:v1:logs/nightly.log")
            self.assertEqual(status.recentActivity[0].size, "4.0 MB")

    def test_build_status_adds_local_backup_size_to_recent_activity(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            log_dir = backup_home / "logs"
            backup_dir = backup_home / "nightly"
            artifact = backup_dir / local_artifact_name("20260618T120000Z")
            artifact.mkdir(parents=True)
            log_dir.mkdir()
            (artifact / "backup.img").write_bytes(b"x" * 1536)
            log_file = log_dir / "20260618T120000Z-profile-1-full-test.log"
            log_file.write_text(completed_backup_log(artifact), encoding="utf-8")

            status = build_status(
                backup_home.as_posix(),
                {},
                [MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination=backup_dir.as_posix())],
            )

            self.assertEqual(
                status.recentActivity[0].activityId,
                "activity:v1:logs/20260618T120000Z-profile-1-full-test.log",
            )
            self.assertEqual(status.recentActivity[0].title, "Nightly")
            self.assertEqual(status.recentActivity[0].profile, "Nightly")
            self.assertEqual(status.recentActivity[0].profileId, "profile-1")
            self.assertEqual(status.recentActivity[0].status, "Completed OK")
            self.assertEqual(status.recentActivity[0].backupType, "Full Backup")
            self.assertEqual(status.recentActivity[0].size, "1.5 KB")

    def test_resolve_activity_returns_log_backup_and_profile_identity(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            log_dir = backup_home_path / "logs"
            backup_dir = backup_home_path / "nightly"
            artifact = backup_dir / local_artifact_name("20260618T120000Z")
            artifact.mkdir(parents=True)
            log_dir.mkdir()
            log_file = log_dir / "20260618T120000Z-profile-1-full-test.log"
            log_file.write_text(completed_backup_log(artifact), encoding="utf-8")
            activity_id = "activity:v1:logs/20260618T120000Z-profile-1-full-test.log"

            resolved = backup_home.resolve_activity(
                backup_home_path.as_posix(),
                activity_id,
                [MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination=backup_dir.as_posix())],
            )

        self.assertEqual(resolved.activity_id, activity_id)
        self.assertEqual(resolved.log_path, log_file.resolve().as_posix())
        self.assertEqual(resolved.backup_id, f"nightly/{artifact.name}")
        self.assertEqual(resolved.profile_id, "profile-1")
        self.assertEqual(resolved.activity_type, "Full Backup")
        self.assertEqual(resolved.require_backup_id(), f"nightly/{artifact.name}")

    def test_resolved_activity_reads_named_log_status_on_demand(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            log_path = Path(temporary) / "backup.log"
            resolved = backup_home.ResolvedActivity(
                activity_id="activity:v1:logs/backup.log",
                log_path=log_path.as_posix(),
                backup_id=None,
                profile_id=None,
                activity_type="Full Backup",
            )
            log_path.write_text("mysqlbackup failed\n", encoding="utf-8")

            log_status = resolved.read_log_status()

        self.assertEqual(log_status.detail, "Errors reported in mysqlbackup log")
        self.assertEqual(log_status.status, "Failed")
        self.assertEqual(log_status.tone, "warn")

    def test_backup_path_for_activity_returns_canonical_backup_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            log_dir = backup_home_path / "logs"
            backup_dir = backup_home_path / "nightly"
            artifact = backup_dir / local_artifact_name("20260618T120000Z")
            artifact.mkdir(parents=True)
            log_dir.mkdir()
            log_file = log_dir / "20260618T120000Z-profile-1-full-test.log"
            log_file.write_text(completed_backup_log(artifact), encoding="utf-8")

            backup_path = backup_home.backup_path_for_activity(
                backup_home_path.as_posix(),
                "activity:v1:logs/20260618T120000Z-profile-1-full-test.log",
            )

        self.assertEqual(backup_path, artifact.resolve().as_posix())

    def test_restore_chain_for_incremental_backup_starts_at_full_backup(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            full_backup = backup_home_path / "nightly" / "full"
            first_incremental = backup_home_path / "nightly" / "inc" / "incremental-1"
            second_incremental = backup_home_path / "nightly" / "inc" / "incremental-2"
            write_backup_variables(full_backup, is_incremental=False, start_lsn=10, end_lsn=20)
            write_backup_variables(first_incremental, is_incremental=True, start_lsn=21, end_lsn=30)
            write_backup_variables(second_incremental, is_incremental=True, start_lsn=31, end_lsn=40)

            chain = backup_home._restore_chain_for_backup(
                backup_home_path.as_posix(),
                "nightly/inc/incremental-2",
            )

        self.assertEqual(chain, [
            full_backup.resolve().as_posix(),
            first_incremental.resolve().as_posix(),
            second_incremental.resolve().as_posix(),
        ])

    def test_restore_chain_for_full_backup_contains_only_that_backup(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            full_backup = backup_home_path / "nightly" / "full" / "2026-06-17_12-00-00"
            write_backup_variables(full_backup, is_incremental=False, start_lsn=10, end_lsn=20)

            chain = backup_home._restore_chain_for_backup(
                backup_home_path.as_posix(),
                "nightly/full/2026-06-17_12-00-00",
            )

        self.assertEqual(chain, [full_backup.resolve().as_posix()])

    def test_restore_chain_discovers_full_and_incremental_sibling_directories(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            full_backup = backup_home_path / "nightly" / "full" / "2026-06-17_12-00-00"
            incremental = backup_home_path / "nightly" / "inc" / "2026-06-18_12-00-00"
            write_backup_variables(full_backup, is_incremental=False, start_lsn=10, end_lsn=20)
            write_backup_variables(incremental, is_incremental=True, start_lsn=21, end_lsn=30)

            chain = backup_home._restore_chain_for_backup(
                backup_home_path.as_posix(),
                "nightly/inc/2026-06-18_12-00-00",
            )

        self.assertEqual(chain, [
            full_backup.resolve().as_posix(),
            incremental.resolve().as_posix(),
        ])

    def test_dependent_incremental_backups_includes_indirect_dependents(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            full_backup = backup_home_path / "nightly" / "full"
            first_incremental = backup_home_path / "nightly" / "inc" / "incremental-1"
            second_incremental = backup_home_path / "nightly" / "inc" / "incremental-2"
            write_backup_variables(full_backup, is_incremental=False, start_lsn=10, end_lsn=20)
            write_backup_variables(first_incremental, is_incremental=True, start_lsn=21, end_lsn=30)
            write_backup_variables(second_incremental, is_incremental=True, start_lsn=31, end_lsn=40)

            dependents = backup_home._dependent_incremental_backups(
                backup_home_path.as_posix(),
                "nightly/full",
            )

        self.assertEqual(dependents, [
            first_incremental.resolve().as_posix(),
            second_incremental.resolve().as_posix(),
        ])

    def test_dependent_incremental_backups_does_not_require_target_predecessor(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            first_incremental = backup_home_path / "nightly" / "inc" / "incremental-1"
            second_incremental = backup_home_path / "nightly" / "inc" / "incremental-2"
            write_backup_variables(first_incremental, is_incremental=True, start_lsn=20, end_lsn=30)
            write_backup_variables(second_incremental, is_incremental=True, start_lsn=31, end_lsn=40)

            dependents = backup_home._dependent_incremental_backups(
                backup_home_path.as_posix(),
                "nightly/inc/incremental-1",
            )

        self.assertEqual(dependents, [second_incremental.resolve().as_posix()])

    def test_restore_chain_for_incremental_backup_requires_preceding_backup(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            incremental = backup_home_path / "nightly" / "inc" / "incremental"
            write_backup_variables(incremental, is_incremental=True, start_lsn=21, end_lsn=30)

            with self.assertRaisesRegex(ValueError, "preceding backup.*not found") as error:
                backup_home._restore_chain_for_backup(
                    backup_home_path.as_posix(),
                    "nightly/inc/incremental",
                )

        self.assertEqual(error.exception.partial_chain, [incremental.resolve().as_posix()])
        self.assertTrue(error.exception.missing_predecessor)

    def test_restore_chain_reports_resolved_tail_when_an_earlier_predecessor_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            first_incremental = backup_home_path / "nightly" / "inc" / "incremental-1"
            second_incremental = backup_home_path / "nightly" / "inc" / "incremental-2"
            write_backup_variables(first_incremental, is_incremental=True, start_lsn=101, end_lsn=110)
            write_backup_variables(second_incremental, is_incremental=True, start_lsn=111, end_lsn=120)

            with self.assertRaisesRegex(ValueError, "preceding backup.*not found") as error:
                backup_home._restore_chain_for_backup(
                    backup_home_path.as_posix(),
                    "nightly/inc/incremental-2",
                )

        self.assertEqual(error.exception.partial_chain, [
            first_incremental.resolve().as_posix(),
            second_incremental.resolve().as_posix(),
        ])
        self.assertTrue(error.exception.missing_predecessor)

    def test_restore_chain_for_incremental_backup_rejects_ambiguous_predecessor(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            full_backup = backup_home_path / "nightly" / "full"
            alternate_backup = backup_home_path / "nightly" / "alternate"
            incremental = backup_home_path / "nightly" / "inc" / "incremental"
            write_backup_variables(full_backup, is_incremental=False, start_lsn=10, end_lsn=20)
            write_backup_variables(alternate_backup, is_incremental=False, start_lsn=11, end_lsn=20)
            write_backup_variables(incremental, is_incremental=True, start_lsn=21, end_lsn=30)

            with self.assertRaisesRegex(ValueError, "preceding backup.*ambiguous"):
                backup_home._restore_chain_for_backup(
                    backup_home_path.as_posix(),
                    "nightly/inc/incremental",
                )

    def test_restore_chain_for_incremental_backup_rejects_cycles(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            first_incremental = backup_home_path / "nightly" / "inc" / "incremental-1"
            second_incremental = backup_home_path / "nightly" / "inc" / "incremental-2"
            write_backup_variables(first_incremental, is_incremental=True, start_lsn=41, end_lsn=30)
            write_backup_variables(second_incremental, is_incremental=True, start_lsn=31, end_lsn=40)

            with self.assertRaisesRegex(ValueError, "chain contains a cycle"):
                backup_home._restore_chain_for_backup(
                    backup_home_path.as_posix(),
                    "nightly/inc/incremental-2",
                )

    def test_activity_id_round_trips_managed_logs(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            log_dir = backup_home_path / "logs"
            profile_dir = backup_home_path / "nightly"
            log_dir.mkdir(parents=True)
            profile_dir.mkdir()
            manager_log = log_dir / "manager.log"
            profile_log = profile_dir / "20260618T120000Z-profile-1-full-test.log"
            manager_log.write_text("manager output\n", encoding="utf-8")
            profile_log.write_text("mysqlbackup completed OK!\n", encoding="utf-8")
            profiles = [
                MebBackupProfileInfo(
                    uuid="profile-1",
                    label="Nightly",
                    destination=profile_dir.as_posix(),
                ),
            ]

            manager_id = backup_home.activity_id_for_log(
                backup_home_path.as_posix(),
                manager_log.as_posix(),
                profiles,
            )
            profile_id = backup_home.activity_id_for_log(
                backup_home_path.as_posix(),
                profile_log.as_posix(),
                profiles,
            )

            self.assertEqual(manager_id, "activity:v1:logs/manager.log")
            self.assertEqual(
                profile_id,
                "activity:v1:nightly/20260618T120000Z-profile-1-full-test.log",
            )
            self.assertEqual(
                backup_home.activity_log_path(backup_home_path.as_posix(), manager_id, profiles),
                manager_log.resolve().as_posix(),
            )
            self.assertEqual(
                backup_home.activity_log_path(backup_home_path.as_posix(), profile_id, profiles),
                profile_log.resolve().as_posix(),
            )

    def test_activity_id_rejects_invalid_or_unmanaged_logs(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            backup_home_path = root / "backup-home"
            log_dir = backup_home_path / "logs"
            log_dir.mkdir(parents=True)
            managed_log = log_dir / "managed.log"
            managed_log.write_text("managed\n", encoding="utf-8")

            invalid_ids = [
                "activity:v2:logs/managed.log",
                "activity:v1:",
                "activity:v1:/logs/managed.log",
                "activity:v1:logs/../managed.log",
                "activity:v1:logs\\managed.log",
                "activity:v1:logs//managed.log",
                "activity:v1:logs/missing.log",
                " activity:v1:logs/managed.log",
                "activity:v1:logs/managed.log ",
                "not-an-activity-id",
            ]
            for activity_id in invalid_ids:
                with self.subTest(activity_id=activity_id):
                    with self.assertRaises(ValueError):
                        backup_home.activity_log_path(
                            backup_home_path.as_posix(),
                            activity_id,
                            [],
                        )

            unmanaged_log = backup_home_path / "unmanaged.log"
            unmanaged_log.write_text("unmanaged\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "configured backup destination"):
                backup_home.activity_id_for_log(
                    backup_home_path.as_posix(),
                    unmanaged_log.as_posix(),
                    [],
                )

            nonportable_log = log_dir / "bad:name.log"
            nonportable_log.write_text("nonportable\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "represented by an activity identifier"):
                backup_home.activity_id_for_log(
                    backup_home_path.as_posix(),
                    nonportable_log.as_posix(),
                    [],
                )

            outside_log = root / "outside.log"
            outside_log.write_text("outside\n", encoding="utf-8")
            escaping_log = log_dir / "escaping.log"
            escaping_log.symlink_to(outside_log)
            with self.assertRaises(ValueError):
                backup_home.activity_log_path(
                    backup_home_path.as_posix(),
                    "activity:v1:logs/escaping.log",
                    [],
                )

    def test_read_log_returns_activity_identity_and_display_name(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            log_dir = backup_home_path / "logs"
            log_dir.mkdir(parents=True)
            log_file = log_dir / "backup-full.log"
            log_file.write_text("mysqlbackup output\n", encoding="utf-8")
            activity_id = "activity:v1:logs/backup-full.log"

            content = backup_home.read_log(backup_home_path.as_posix(), activity_id)

            self.assertEqual(content.activityId, activity_id)
            self.assertEqual(content.displayName, "backup-full.log")
            self.assertEqual(content.content, "mysqlbackup output\n")

            with self.assertRaisesRegex(ValueError, "Invalid activity identifier"):
                backup_home.read_log(
                    backup_home_path.as_posix(),
                    f" {activity_id}",
                )

    def test_resolve_activity_finds_backup_without_current_profile(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            log_dir = backup_home_path / "logs"
            backup_dir = backup_home_path / "nightly"
            artifact = backup_dir / local_artifact_name("20260618T120000Z")
            artifact.mkdir(parents=True)
            log_dir.mkdir()
            log_file = log_dir / "20260618T120000Z-deleted-profile-full-test.log"
            log_file.write_text(completed_backup_log(artifact), encoding="utf-8")

            activity_id = backup_home.activity_id_for_log(
                backup_home_path.as_posix(),
                log_file.as_posix(),
                [],
            )
            backup_id = backup_home.resolve_activity(
                backup_home_path.as_posix(),
                activity_id,
                [],
            ).require_backup_id()

        self.assertEqual(backup_id, f"nightly/{artifact.name}")

    def test_resolved_activity_rejects_log_directory_as_backup(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            log_dir = backup_home_path / "logs"
            log_dir.mkdir(parents=True)
            log_file = log_dir / "20260618T120000Z-profile-1-full-test.log"
            log_file.write_text("mysqlbackup completed OK!\n", encoding="utf-8")
            activity_id = "activity:v1:logs/20260618T120000Z-profile-1-full-test.log"

            with self.assertRaisesRegex(ValueError, "Backup data was not found"):
                backup_home.resolve_activity(
                    backup_home_path.as_posix(),
                    activity_id,
                    [MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination=log_dir.as_posix())],
                ).require_backup_id()

    def test_resolve_activity_uses_backup_directory_recorded_in_log(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            log_dir = backup_home_path / "logs"
            backup_dir = backup_home_path / "nightly"
            artifact = backup_dir / local_artifact_name("20260618T121000Z")
            artifact.mkdir(parents=True)
            log_dir.mkdir()
            log_file = log_dir / "20260618T120000Z-profile-1-full-test.log"
            log_file.write_text(completed_backup_log(artifact), encoding="utf-8")
            activity_id = "activity:v1:logs/20260618T120000Z-profile-1-full-test.log"

            backup_id = backup_home.resolve_activity(
                backup_home_path.as_posix(),
                activity_id,
                [MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination=backup_dir.as_posix())],
            ).require_backup_id()

        self.assertEqual(backup_id, f"nightly/{artifact.name}")

    def test_resolved_activity_reports_missing_backup_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            log_dir = backup_home_path / "logs"
            backup_dir = backup_home_path / "nightly"
            backup_dir.mkdir(parents=True)
            log_dir.mkdir()
            log_file = log_dir / "20260618T120000Z-profile-1-full-test.log"
            log_file.write_text("mysqlbackup completed OK!\n", encoding="utf-8")
            activity_id = "activity:v1:logs/20260618T120000Z-profile-1-full-test.log"

            with self.assertRaisesRegex(ValueError, "Backup data was not found"):
                backup_home.resolve_activity(
                    backup_home_path.as_posix(),
                    activity_id,
                    [MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination=backup_dir.as_posix())],
                ).require_backup_id()

    def test_build_status_matches_completed_size_to_activity_time(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            log_dir = backup_home / "logs"
            first_artifact = backup_home / local_artifact_name("20260618T120000Z")
            second_artifact = backup_home / local_artifact_name("20260619T120000Z")
            first_artifact.mkdir(parents=True)
            second_artifact.mkdir()
            log_dir.mkdir()
            (first_artifact / "backup.img").write_bytes(b"x" * 1536)
            (second_artifact / "backup.img").write_bytes(b"x" * 3072)
            first_log = log_dir / "20260618T120000Z-profile-1-full-test.log"
            second_log = log_dir / "20260619T120000Z-profile-1-full-test.log"
            first_log.write_text(completed_backup_log(first_artifact), encoding="utf-8")
            second_log.write_text(completed_backup_log(second_artifact), encoding="utf-8")

            status = build_status(
                backup_home.as_posix(),
                {},
                [MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination=backup_home.as_posix())],
            )

            self.assertEqual([item.size for item in status.recentActivity], ["3.0 KB", "1.5 KB"])

    def test_build_status_uses_backup_directory_recorded_in_log(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            log_dir = backup_home / "logs"
            artifact = backup_home / local_artifact_name("20260618T121000Z")
            artifact.mkdir(parents=True)
            log_dir.mkdir()
            (artifact / "backup.img").write_bytes(b"x" * 1536)
            log_file = log_dir / "20260618T120000Z-profile-1-full-test.log"
            log_file.write_text(completed_backup_log(artifact), encoding="utf-8")

            status = build_status(
                backup_home.as_posix(),
                {},
                [MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination=backup_home.as_posix())],
            )

            self.assertEqual(status.recentActivity[0].size, "1.5 KB")
            self.assertEqual(status.recentActivity[0].status, "Completed OK")

    def test_build_status_reports_missing_activity_backup(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            log_dir = backup_home_path / "logs"
            artifact = backup_home_path / local_artifact_name("20260621T070433Z")
            artifact.mkdir(parents=True)
            log_dir.mkdir()
            (artifact / "backup.img").write_bytes(b"x" * 3072)
            missing_backup_log = log_dir / "20260621T070300Z-profile-1-full-test.log"
            matching_backup_log = log_dir / "20260621T070433Z-profile-1-full-test.log"
            missing_backup_log.write_text("mysqlbackup completed OK!\n", encoding="utf-8")
            matching_backup_log.write_text(completed_backup_log(artifact), encoding="utf-8")
            os.utime(missing_backup_log, (1000, 1000))
            os.utime(matching_backup_log, (1001, 1001))

            status = build_status(
                backup_home_path.as_posix(),
                {},
                [MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination=backup_home_path.as_posix())],
            )

            self.assertEqual([item.size for item in status.recentActivity], ["3.0 KB", None])
            self.assertEqual([item.status for item in status.recentActivity], ["Completed OK", "Backup missing"])
            self.assertEqual([item.tone for item in status.recentActivity], ["ok", "warn"])
            missing_activity_id = backup_home.activity_id_for_log(
                backup_home_path.as_posix(),
                missing_backup_log.as_posix(),
                [MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination=backup_home_path.as_posix())],
            )
            with self.assertRaisesRegex(ValueError, "Backup data was not found"):
                backup_home.resolve_activity(
                    backup_home_path.as_posix(),
                    missing_activity_id,
                    [MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination=backup_home_path.as_posix())],
                ).require_backup_id()

    def test_build_status_adds_incremental_type_to_recent_activity(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            log_dir = backup_home / "logs"
            backup_dir = backup_home / "nightly"
            artifact = backup_dir / local_artifact_name("20260618T120000Z")
            artifact.mkdir(parents=True)
            (artifact / "backup.img").write_bytes(b"x")
            log_dir.mkdir(parents=True)
            log_file = log_dir / "20260618T120000Z-profile-1-incremental-test.log"
            log_file.write_text(completed_backup_log(artifact), encoding="utf-8")

            status = build_status(
                backup_home.as_posix(),
                {},
                [MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination=backup_dir.as_posix())],
            )

            self.assertEqual(status.recentActivity[0].profile, "Nightly")
            self.assertEqual(status.recentActivity[0].status, "Completed OK")
            self.assertEqual(status.recentActivity[0].backupType, "Incremental Backup")

    def test_build_status_reads_type_from_task_helper_job_log_name(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            log_dir = backup_home / "logs"
            backup_dir = backup_home / "nightly"
            artifact = backup_dir / local_artifact_name("20260618T120000Z")
            artifact.mkdir(parents=True)
            (artifact / "backup.img").write_bytes(b"x")
            log_dir.mkdir(parents=True)
            log_file = log_dir / "20260618T120000Z-profile-1-backup-full-random.log"
            log_file.write_text(completed_backup_log(artifact), encoding="utf-8")

            status = build_status(
                backup_home.as_posix(),
                {},
                [MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination=backup_dir.as_posix())],
            )

            self.assertEqual(status.recentActivity[0].backupType, "Full Backup")

    def test_activity_type_describes_backup_operations(self) -> None:
        profiles = [MebBackupProfileInfo(uuid="profile-1", label="Nightly")]

        self.assertEqual(
            backup_home._activity_backup_type("/logs/20260618T120000Z-restore-backup-123.log", profiles),
            "Restore",
        )
        self.assertEqual(
            backup_home._activity_backup_type("/logs/20260618T120000Z-apply-logs-backup-123.log", profiles),
            "Apply Logs",
        )
        self.assertEqual(
            backup_home._activity_backup_type("/logs/20260618T120000Z-verify-backup-123.log", profiles),
            "Verify",
        )

    def test_build_status_marks_restore_activity_as_non_backup(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            log_dir = backup_home_path / "logs"
            log_dir.mkdir(parents=True)
            log_file = log_dir / "20260618T120000Z-restore-backup-123-random.log"
            log_file.write_text("mysqlbackup completed OK!\n", encoding="utf-8")

            status = build_status(backup_home_path.as_posix(), {}, [])

            self.assertEqual(status.recentActivity[0].backupType, "Restore")
            self.assertFalse(status.recentActivity[0].isBackup)

    def test_build_status_associates_restore_activity_with_profile(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            log_dir = backup_home_path / "logs"
            log_dir.mkdir(parents=True)
            log_file = log_dir / "20260618T120000Z-restore-profile-1-backup-123-random.log"
            log_file.write_text("mysqlbackup completed OK!\n", encoding="utf-8")
            profiles = [MebBackupProfileInfo(uuid="profile-1", label="Nightly")]

            status = build_status(backup_home_path.as_posix(), {}, profiles)

            self.assertEqual(status.recentActivity[0].profile, "Nightly")

    def test_build_status_failed_activity_takes_precedence_over_completed_text(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            log_dir = backup_home / "logs"
            log_dir.mkdir(parents=True)
            log_file = log_dir / "20260618T120000Z-profile-1-full-test.log"
            log_file.write_text(
                "mysqlbackup completed OK!\n"
                "MAIN: [ERROR] unknown variable 'command=/usr/bin/mysqlbackup'.\n"
                "mysqlbackup exit code: 7, Invalid Argument\n"
                "# mysqlbackup finished exitCode=7 timedOut=false\n",
                encoding="utf-8",
            )

            status = build_status(
                backup_home.as_posix(),
                {},
                [MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination=(backup_home / "nightly").as_posix())],
            )

            self.assertEqual(status.recentActivity[0].profile, "Nightly")
            self.assertEqual(status.recentActivity[0].status, "Failed")
            self.assertEqual(status.recentActivity[0].tone, "warn")

    def test_build_status_reports_successful_verify_result_from_helper_footer(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            log_dir = backup_home_path / "logs"
            log_dir.mkdir(parents=True)
            log_file = log_dir / "20260629T061538Z-verify-backup-random.log"
            log_file.write_text(
                "Validate backup directory operation completed successfully.\n"
                "m\n--- stderr ---\nysqlbackup completed OK!\n"
                "# backups.verify finished exitCode=0 timedOut=false "
                "stdoutTruncated=false stderrTruncated=false\n",
                encoding="utf-8",
            )

            status = build_status(backup_home_path.as_posix(), {}, [])

            self.assertEqual(status.recentActivity[0].status, "Verified")
            self.assertEqual(status.recentActivity[0].detail, "Backup verification completed successfully")
            self.assertEqual(status.recentActivity[0].tone, "ok")

    def test_build_status_requires_completed_ok_on_own_line(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            log_dir = backup_home / "logs"
            log_dir.mkdir(parents=True)
            log_file = log_dir / "20260618T120000Z-profile-1-full-test.log"
            log_file.write_text(
                "message prefix mysqlbackup completed OK! suffix\n",
                encoding="utf-8",
            )

            status = build_status(
                backup_home.as_posix(),
                {},
                [MebBackupProfileInfo(uuid="profile-1", label="Nightly", destination=(backup_home / "nightly").as_posix())],
            )

            self.assertEqual(status.recentActivity[0].profile, "Nightly")
            self.assertEqual(status.recentActivity[0].status, "Updated")
            self.assertEqual(status.recentActivity[0].tone, "info")

    def test_save_profile_rejects_duplicate_exact_schedule(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            first = profile("first", backup_home / "first", daily_schedule("2", "15"))
            second = profile("second", backup_home / "second", daily_schedule("2", "15"))

            save_profile(backup_home.as_posix(), first)

            with self.assertRaisesRegex(ValueError, "overlaps"):
                save_profile(backup_home.as_posix(), second)

    def test_save_profile_rejects_overlapping_schedule(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            first = profile("first", backup_home / "first", daily_schedule("2", "15"))
            second = profile("second", backup_home / "second", weekly_schedule("2", "15", 1))

            save_profile(backup_home.as_posix(), first)

            with self.assertRaisesRegex(ValueError, "overlaps"):
                save_profile(backup_home.as_posix(), second)

    def test_save_profile_rejects_overlapping_monthly_day_list(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            first = profile(
                "first",
                backup_home / "first",
                monthly_schedule("2", "30", "1,15,30"),
            )
            second = profile(
                "second",
                backup_home / "second",
                monthly_schedule("2", "30", "15"),
            )

            save_profile(backup_home.as_posix(), first)

            with self.assertRaisesRegex(ValueError, "overlaps"):
                save_profile(backup_home.as_posix(), second)

    def test_save_profile_creates_backup_destination(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            backup_destination = backup_home / "nightly"
            draft = profile("nightly", backup_destination, daily_schedule("2", "15"))

            save_profile(backup_home.as_posix(), draft)

            self.assertTrue(backup_destination.is_dir())
            self.assertTrue((backup_destination / "inc").is_dir())

            profiles = _read_profiles(backup_home.as_posix())
            config = read_config(profiles[0].configPath)
            self.assertEqual(config.get("mysqlbackup", "backup_dir"), backup_destination.as_posix())
            self.assertEqual(config.get("mysqlbackup", "incremental_backup_dir"),
                             (backup_destination / "inc").as_posix())

    def test_save_profile_uses_uuid_config_filename(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            draft = profile("nightly", backup_home / "nightly", daily_schedule("2", "15"))

            save_profile(backup_home.as_posix(), draft)

            profiles = _read_profiles(backup_home.as_posix())
            self.assertEqual(len(profiles), 1)
            self.assertEqual(profiles[0].label, "nightly")
            self.assertRegex(Path(profiles[0].configPath).name, r"^[0-9a-f]{8}"
                             r"-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.cnf$")
            self.assertEqual(profiles[0].uuid, Path(profiles[0].configPath).stem)
            config = read_config(profiles[0].configPath)
            self.assertEqual(config.get("meb_manager", "uuid"), Path(profiles[0].configPath).stem)

    def test_save_profile_keeps_workbench_metadata_out_of_mysqlbackup_defaults(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            draft = profile("nightly", backup_home / "nightly", daily_schedule("2", "15"))
            draft.datadir = "/var/lib/mysql"
            draft.mysqlBasedir = "/usr"

            save_profile(
                backup_home.as_posix(),
                draft,
                mysqlbackup_command="/usr/bin/mysqlbackup",
            )

            profiles = _read_profiles(backup_home.as_posix())
            self.assertEqual(len(profiles), 1)
            self.assertEqual(profiles[0].command, "/usr/bin/mysqlbackup")
            self.assertEqual(profiles[0].mysqlBasedir, "/usr")

            config = read_config(profiles[0].configPath)
            self.assertEqual(config.get("meb_manager", "command"), "/usr/bin/mysqlbackup")
            self.assertEqual(config.get("meb_manager", "basedir"), "/usr")
            self.assertFalse(config.has_option("mysqlbackup", "command"))
            self.assertFalse(config.has_option("mysqlbackup", "basedir"))

    def test_save_profile_serializes_week_days_as_numeric_list(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            schedule = weekly_schedule("2", "15", 0)
            schedule.weekDays[2] = True
            schedule.weekDays[6] = True

            save_profile(backup_home.as_posix(), profile("weekly", backup_home / "weekly", schedule))

            saved_profile = _read_profiles(backup_home.as_posix())[0]
            config = read_config(saved_profile.configPath)
            self.assertEqual(config.get("meb_manager", "full_backups_week_days"), "0,2,6")
            self.assertEqual(saved_profile.fullSchedule.weekDays, [True, False, True, False, False, False, True])

    def test_week_day_lists_reject_invalid_values(self) -> None:
        for value, message in (("7", "days between 0 and 6"), ("-1", "days between 0 and 6"),
                               ("one", "days between 0 and 6"), ("1,1", "unique days")):
            with self.subTest(value=value):
                with self.assertRaisesRegex(ValueError, message):
                    backup_home._week_days_from_text(value)

    def test_profile_schedule_round_trip_uses_numeric_api_values(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home_path = Path(temporary) / "backup-home"
            schedule = MebProfileSchedule(
                enabled=True,
                interval=2,
                frequency=3,
                monthDays=[1, 15, 30],
                weekDays=[False] * 7,
                hour=4,
                minute=45,
            )
            draft = profile("monthly", backup_home_path / "monthly", schedule)
            draft.incrementalBase = "history:last_full_backup"

            save_profile(backup_home_path.as_posix(), draft)

            saved_profile = _read_profiles(backup_home_path.as_posix())[0]
            saved_schedule = saved_profile.fullSchedule
            self.assertEqual(saved_profile.incrementalBase, "history:last_full_backup")
            self.assertEqual(saved_schedule.interval, 2)
            self.assertEqual(saved_schedule.frequency, 3)
            self.assertEqual(saved_schedule.monthDays, [1, 15, 30])
            self.assertEqual(saved_schedule.hour, 4)
            self.assertEqual(saved_schedule.minute, 45)

    def test_delete_profile_removes_profile_config(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            draft = profile("nightly", backup_home / "nightly", daily_schedule("2", "15"))

            save_profile(backup_home.as_posix(), draft)
            profiles = _read_profiles(backup_home.as_posix())
            config_path = profiles[0].configPath

            status = delete_profile(backup_home.as_posix(), profiles[0].uuid)

            self.assertEqual(status.profiles, [])
            self.assertFalse(Path(config_path).exists())

    def test_delete_profile_rejects_profile_with_existing_backup_data(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            draft = profile("nightly", backup_home / "nightly", daily_schedule("2", "15"))

            save_profile(backup_home.as_posix(), draft)
            saved_profile = _read_profiles(backup_home.as_posix())[0]
            artifact = Path(saved_profile.destination) / local_artifact_name("20260618T120000Z")
            artifact.mkdir(parents=True)
            (artifact / "backup.img").write_bytes(b"x")
            log_dir = backup_home / "logs"
            log_dir.mkdir()
            log_file = log_dir / f"20260618T120000Z-{saved_profile.uuid}-full-test.log"
            log_file.write_text(completed_backup_log(artifact), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "existing backups"):
                delete_profile(backup_home.as_posix(), saved_profile.uuid)

            self.assertTrue(Path(saved_profile.configPath).exists())

    def test_save_profile_rejects_destination_outside_backup_home(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            draft = profile("nightly", backup_home / ".." / "outside", daily_schedule("2", "15"))

            with self.assertRaisesRegex(ValueError, "inside the backup home"):
                save_profile(backup_home.as_posix(), draft)

            self.assertEqual(list(backup_home.glob("*.cnf")), [])

    def test_save_profile_rejects_invalid_schedule_before_writing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            draft = profile("nightly", backup_home / "nightly", daily_schedule("25", "15"))

            with self.assertRaisesRegex(ValueError, "hour must be between 0 and 23"):
                save_profile(backup_home.as_posix(), draft)

            self.assertEqual(list(backup_home.glob("*.cnf")), [])

    def test_save_profile_enforces_frequency_interval_limit(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            backup_home = Path(temporary) / "backup-home"
            draft = profile("weekly", backup_home / "weekly", weekly_schedule("2", "15", 1))
            draft.fullSchedule.interval = 2

            with self.assertRaisesRegex(ValueError, "interval must be between 1 and 1"):
                save_profile(backup_home.as_posix(), draft)

            self.assertEqual(list(backup_home.glob("*.cnf")), [])

if __name__ == "__main__":
    unittest.main()
