# Copyright (c) 2025, 2026 Oracle and/or its affiliates.
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

"""Migration functions"""

# cSpell:ignore mysqlsh

from mysqlsh.plugin_manager import plugin_function
from .lib.logging import plugin_log
from .lib.backend.model import ProjectData, MigrationSteps
from .plan_step import MigrationPlanStep


@plugin_log
@plugin_function('migration.getSteps', shell=True, cli=False, web=True)
def get_migration_steps() -> list[MigrationSteps]:
    """Returns the list of migration steps
    Returns:
        dict
    """
    from .work_step import MigrationWorkStep

    MIGRATION_STEPS = [
        MigrationSteps(
            1000,
            "Migration Plan",
            MigrationPlanStep.get_sub_steps()),
        MigrationSteps(
            2000,
            "Provisioning",
            MigrationWorkStep.get_sub_steps(2000)),
        MigrationSteps(
            3000,
            "Database Migration",
            MigrationWorkStep.get_sub_steps(3000)),
        MigrationSteps(
            4000,
            "Data Synchronization",
            MigrationWorkStep.get_sub_steps(4000)),
        MigrationSteps(
            5000,
            "Finalize",
            MigrationWorkStep.get_sub_steps(5000)),
    ]

    return MIGRATION_STEPS


@plugin_function('migration.newProject', shell=True, cli=False, web=True)
@plugin_log
def new_project(name: str, source_url: str = "") -> ProjectData:
    """Returns the migration plan status for a new migration project

    Args:
        name (str): The name of the migration project.
        source_url (str): Optional URL of the source database.

    Returns:
        dict
    """
    import migration_plugin.lib as lib

    project = lib.migration.new_project(
        name=name,
        source_url=source_url
    )
    return project.data()


@plugin_function("migration.openProject", shell=True, cli=False, web=True)
@plugin_log
def open_project(id: str) -> ProjectData:
    """Returns the migration plan status for an existing migration project
    Args:
        id (str): The id of the migration project.
    Returns:
        dict
    """
    import migration_plugin.lib as lib

    return lib.migration.open_project(id).data()


@plugin_function("migration.closeProject", shell=True, cli=False, web=True)
@plugin_log
def close_project(id: str) -> None:
    """Closes an existing migration project
    Args:
        id (str): The id of the migration project.
    """
    import migration_plugin.lib as lib

    return lib.migration.close_project(id)


@plugin_function("migration.listProjects", shell=True, cli=False, web=True)
def list_projects() -> list[ProjectData]:
    """Returns the existing migration projects"""
    import migration_plugin.lib as lib

    return lib.migration.list_projects()
