# Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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

"""Plugin registration

This file is automatically loaded by the MySQL Shell at startup time.

It registers the plugin objects and then imports all sub-modules to
register the plugin object member functions.
"""

import sys
from pathlib import Path
from typing import Optional

from mysqlsh.plugin_manager.registrar import plugin_function
from gui_plugin.migration.lib.backend.model import LogInfo, SubStepId, WorkStatusInfo
from gui_plugin.migration.lib.backend.plan_types import (
    MigrationPlanState,
    PlanDataItem,
    PlanDataItemType,
)

# The plugin loader restores sys.path after init.py finishes, so any deferred
# absolute import needs to add the plugin parent back first.
_PLUGIN_PARENT = str(Path(__file__).resolve().parents[2])


def _load_impl(module: str, name: str):
    if _PLUGIN_PARENT not in sys.path:
        sys.path.insert(0, _PLUGIN_PARENT)

    imported = __import__(module, fromlist=[name])
    return getattr(imported, name)


# cSpell:ignore mrs, mysqlsh, InnoDB


def _work_step_impl(name: str):
    return _load_impl("gui_plugin.migration.work_step", name)


def _plan_step_impl(name: str):
    return _load_impl("gui_plugin.migration.plan_step", name)


@plugin_function("gui.migration.workStart", shell=True, cli=False, web=True)
def work_start() -> WorkStatusInfo:
    """
    Starts the work step
    """
    return _work_step_impl("work_start")()


@plugin_function("gui.migration.workAbort", shell=True, cli=False, web=True)
def work_abort() -> None:
    """
    Aborts the work step
    """
    return _work_step_impl("work_abort")()


@plugin_function("gui.migration.workClean", shell=True, cli=False, web=True)
def work_clean(options: dict) -> None:
    """
    Deletes OCI resources created for the migration.

    Args:
        options (dict): specifies the resources to be deleted
    """
    return _work_step_impl("work_cleanup")(options)


@plugin_function("gui.migration.workStatus", shell=True, cli=False, web=True)
def work_status() -> WorkStatusInfo:
    """
    Retrieves the status of the work step
    """
    return _work_step_impl("work_status")()


@plugin_function("gui.migration.workRetry", shell=True, cli=False, web=True)
def work_retry() -> None:
    """
    Retries the work step
    """
    return _work_step_impl("work_retry")()


@plugin_function("gui.migration.skipTransactions", shell=True, cli=False, web=True)
def skip_transactions(gtids: str) -> None:
    """
    Skips transactions on the work step

    Args:
        gtids (str): the GTID to skip
    """
    return _work_step_impl("skip_transactions")(gtids)


@plugin_function("gui.migration.fetchLogs", shell=True, cli=False, web=True)
def fetch_logs(sub_step_id: Optional[SubStepId] = None, offset: int = 0) -> LogInfo:
    """
    Fetch logs for the given step or the log file.

    Args:
        sub_step_id (int): the step for which to fetch logs or None to fetch mysqlsh.log
        offset (int): offset for the 1st entry to fetch

    Returns: LogInfo object with the log data and offset to use to fetch later entries
    """
    return _work_step_impl("fetch_logs")(sub_step_id, offset)


# Import all API modules so their decorated functions are registered as
# members of gui.migration.
from gui_plugin.migration import general, migration


k_log_filters = {
    "logfilters": [
        {"type": "key", "keys": ["password", "adminPassword", "adminPasswordConfirm"]}
    ]
}


@plugin_function("gui.migration.planUpdate", shell=True, cli=False, web=k_log_filters)
def plan_update(configs: list[dict]) -> list[MigrationPlanState]:
    """
    Update migration plan sub-step with user input.

    Args:
        configs (list): list of {"id", "values":[]} sub-steps to update
    """
    return _plan_step_impl("plan_update")(configs)


@plugin_function(
    "gui.migration.planGetDataItem", shell=True, cli=False, web=k_log_filters
)
def plan_get_data_item(what: PlanDataItemType, detail: str) -> PlanDataItem:
    """
    Get additional data for frontend use.

    Args:
        what (str): the piece of info to be retrieved
        detail (str): additional argument for the piece of info being retrieved
    """
    return _plan_step_impl("plan_get_data_item")(what, detail)


@plugin_function(
    "gui.migration.planUpdateSubStep", shell=True, cli=False, web=k_log_filters
)
def plan_update_sub_step(
    sub_step_id: SubStepId, configs: dict
) -> MigrationPlanState:
    """
    Fetch and/or update migration plan sub-step with user input.

    Args:
        sub_step_id (int): id of the sub-step to be updated
        configs (dict): sub-step updates to make
    """
    return _plan_step_impl("plan_update_sub_step")(sub_step_id, configs)


@plugin_function("gui.migration.planCommit", shell=True, cli=False, web=k_log_filters)
def plan_commit(sub_step_id: SubStepId) -> MigrationPlanState:
    """
    Commit changes to the given sub-step and performs checks.
    Call before switching from a sub-step to the next one.

    Args:
        sub_step_id (int): the id of the sub-step to be committed
    """
    return _plan_step_impl("plan_commit")(sub_step_id)


@plugin_function("gui.migration.ociSignIn", shell=True, cli=False, web=True)
def oci_sign_in(sign_up: bool = False) -> None:
    """
    Call to Sign In to OCI, create a session and bootstrap a OCI profile.
    If signing-in, region must have been already picked in the OCIProfile
    sub-step.

    Args:
        sign_up (bool): if True, opens browser on OCI sign-up page instead
    """
    return _plan_step_impl("oci_sign_in")(sign_up)
