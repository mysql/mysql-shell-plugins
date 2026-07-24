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


from dataclasses import asdict
import json
import os
import shutil
from tabnanny import check
from typing import cast
import pytest
from gui_plugin.migration import lib
from gui_plugin.migration import plan_step
from gui_plugin.migration.lib.backend import model
from gui_plugin.migration.lib.project import Project
from gui_plugin.migration.lib import migration
import mysqlsh  # type: ignore

from .helpers import server_version
from .test_plan_step import fix_uri, set_source, plan

PROGRESS_TARGET_VERSION = "9.7.0"


def version_tuple(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in version.split("."))


@pytest.fixture(scope="session", autouse=True)
def test_environment(sandbox_session):
    sandbox_session.run_sql("drop schema if exists lots_of_procs")
    sandbox_session.run_sql("create schema lots_of_procs")
    for i in range(1234):
        sandbox_session.run_sql(
            f"create procedure lots_of_procs.proc_{i}() begin select {i}; end"
        )

    yield

    sandbox_session.run_sql("drop schema lots_of_procs")


def run_checks(plan):
    my_id = model.SubStepId.MIGRATION_CHECKS
    configs = {}

    # should not start by just pulling status
    update = plan_step.plan_update_sub_step(my_id, configs)
    check_data = cast(plan_step.MigrationChecksData, update.data)

    assert check_data.checkStatus == plan_step.MigrationCheckStatus.PENDING

    # should start checks when requested
    configs["values"] = {"runChecks": True}
    update = plan_step.plan_update_sub_step(my_id, configs)
    check_data = cast(plan_step.MigrationChecksData, update.data)

    assert check_data.checkStatus != plan_step.MigrationCheckStatus.PENDING

    upgrade_seen = False
    while 1:
        update = plan_step.plan_update_sub_step(my_id, {})
        check_data = cast(plan_step.MigrationChecksData, update.data)

        if check_data.checkStatus in (
            plan_step.MigrationCheckStatus.DONE,
            plan_step.MigrationCheckStatus.ERROR,
        ):
            break

        if (
            check_data.checkStatus
            == plan_step.MigrationCheckStatus.RUNNING_UPGRADE_CHECKS
        ):
            upgrade_seen = True
            assert check_data.checkProgress.totalChecks == 2 or (
                check_data.checkProgress.totalChecks == 0
                and check_data.checkProgress.currentCheck == -1
            )
            match check_data.checkProgress.currentCheck:
                case -1:
                    pass
                case 0:
                    assert check_data.checkProgress.detail in (
                        "",
                        "Collecting events to check",
                        "Collecting routines to check",
                        "Collecting triggers to check",
                        "Collecting tables to check",
                        "Checking syntax of database objects",
                    )
                    assert (
                        check_data.checkProgress.currentCheckTitle
                        == "MySQL syntax check for routine-like objects"
                    )
                    assert check_data.checkProgress.total in (0, 1234)
                case 1:
                    assert check_data.checkProgress.detail == ""
                    assert (
                        check_data.checkProgress.currentCheckTitle
                        == "Checks for foreign keys not referencing a full unique index"
                    )
                case 2:
                    assert check_data.checkProgress.detail == ""
                    assert check_data.checkProgress.currentCheckTitle == ""
                    assert check_data.checkProgress.total == 0
            import time

            time.sleep(0.5)
        elif (
            check_data.checkStatus
            == plan_step.MigrationCheckStatus.RUNNING_COMPATIBILITY_CHECKS
        ):
            print(check_data)
            # TODO

    assert upgrade_seen

    return check_data


def test_update_checks_progress(plan, sandbox_session):
    source_uri = fix_uri(sandbox_session, "admin")

    set_source(source_uri)

    if server_version(sandbox_session) >= version_tuple(PROGRESS_TARGET_VERSION):
        pytest.skip("Upgrade checks are skipped when source is not older than target")

    plan.options.targetMySQLOptions.mysqlVersion = PROGRESS_TARGET_VERSION

    check_data = run_checks(plan)
    assert check_data.checkStatus == plan_step.MigrationCheckStatus.DONE


def test_upgrade_checks_abort(plan, sandbox_session):
    source_uri = fix_uri(sandbox_session, "admin")

    set_source(source_uri)

    plan.options.targetMySQLOptions.mysqlVersion = PROGRESS_TARGET_VERSION

    my_id = model.SubStepId.MIGRATION_CHECKS
    configs = {"values": {"runChecks": True}}
    update = plan_step.plan_update_sub_step(my_id, configs)
    check_data = cast(plan_step.MigrationChecksData, update.data)

    assert check_data.checkStatus != plan_step.MigrationCheckStatus.PENDING

    # should abort checks when requested
    configs["values"]["abortChecks"] = True
    update = plan_step.plan_update_sub_step(my_id, configs)
    check_data = cast(plan_step.MigrationChecksData, update.data)

    assert check_data.checkStatus == plan_step.MigrationCheckStatus.ABORTED

    # still aborted
    update = plan_step.plan_update_sub_step(my_id, {})
    check_data = cast(plan_step.MigrationChecksData, update.data)

    assert check_data.checkStatus == plan_step.MigrationCheckStatus.ABORTED

    # run checks again
    configs["values"]["abortChecks"] = False
    update = plan_step.plan_update_sub_step(my_id, configs)
    check_data = cast(plan_step.MigrationChecksData, update.data)
