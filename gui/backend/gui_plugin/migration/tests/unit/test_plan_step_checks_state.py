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

from unittest.mock import patch

import pytest

from gui_plugin.migration.lib import migration
from gui_plugin.migration.lib.backend import model
from gui_plugin.migration.plan_step import (
    MigrationChecksSubStep,
    MigrationCheckStatus,
    MigrationStepStatus,
)


@pytest.fixture
def plan_context(tmp_path):
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()

    shared_keys_dir = tmp_path / "shared-keys"
    shared_keys_dir.mkdir()

    with patch(
        "gui_plugin.migration.lib.core.default_projects_directory",
        return_value=str(projects_dir),
    ), patch(
        "gui_plugin.migration.lib.core.default_shared_ssh_key_directory",
        return_value=str(shared_keys_dir),
    ), patch(
        "gui_plugin.migration.lib.core.default_oci_config_file",
        return_value=str(tmp_path / "oci-config"),
    ):
        context = migration.new_project(name="test", source_url="root@localhost")
        try:
            yield context
        finally:
            migration.close_all_projects()


def _make_notice_issue(check_id: str, objects: list[str]) -> model.CheckResult:
    return model.CheckResult(
        checkId=check_id,
        level=model.MessageLevel.NOTICE,
        title="Test Issue",
        result="Object is excluded from migration.",
        description="Regression coverage for excluded-object state handling.",
        objects=objects,
        choices=[model.CompatibilityFlags.EXCLUDE_OBJECT],
        status=model.CheckStatus.OK,
    )


@pytest.mark.parametrize(
    ("objects", "filter_attr", "expected_excludes"),
    [
        (["user:'app'@'%'"], "users", ["'app'@'%'"]),
        (["view:`sakila`.`customer_list`"], "views", ["`sakila`.`customer_list`"]),
    ],
)
def test_migration_checks_refresh_after_commit_preserves_issues(
    plan_context,
    objects,
    filter_attr,
    expected_excludes,
):
    checks_step = plan_context.plan_step.get_step(model.SubStepId.MIGRATION_CHECKS)
    issue = _make_notice_issue("excluded/object", objects)

    checks_step._started = True
    checks_step._check_status = MigrationCheckStatus.DONE
    checks_step._compatibility_check_summary.issues = {issue.checkId: issue}
    checks_step._issue_resolution = {
        issue.checkId: model.CompatibilityFlags.EXCLUDE_OBJECT,
    }
    checks_step._current_selection = model.SchemaSelectionOptions()

    committed = plan_context.plan_step.commit(model.SubStepId.MIGRATION_CHECKS)

    assert committed.status == MigrationStepStatus.FINISHED
    committed_excludes = getattr(
        plan_context.project.options.schemaSelection.filter,
        filter_attr,
    ).exclude
    assert committed_excludes == expected_excludes
    assert (
        checks_step._current_selection == plan_context.project.options.schemaSelection
    )

    refreshed = plan_context.plan_step.update(model.SubStepId.MIGRATION_CHECKS, {})

    assert refreshed.status == MigrationStepStatus.FINISHED
    assert refreshed.data is not None
    assert refreshed.data.checkStatus == MigrationCheckStatus.DONE
    assert [result.checkId for result in refreshed.data.issues] == [issue.checkId]
    assert refreshed.data.issues[0].objects == issue.objects


def test_migration_checks_unique_preserving_order():
    assert MigrationChecksSubStep._unique_preserving_order(
        ["`db`.`b`", "`db`.`a`", "`db`.`b`", "`db`.`c`", "`db`.`a`"]
    ) == ["`db`.`b`", "`db`.`a`", "`db`.`c`"]


def test_migration_checks_start_does_not_require_target_options(plan_context):
    source_step = plan_context.plan_step.get_step(model.SubStepId.SOURCE_SELECTION)
    target_step = plan_context.plan_step.get_step(model.SubStepId.TARGET_OPTIONS)
    checks_step = plan_context.plan_step.get_step(model.SubStepId.MIGRATION_CHECKS)

    source_step._done = True

    assert target_step.current_status != MigrationStepStatus.FINISHED

    checks_step.start()

    assert checks_step._started
