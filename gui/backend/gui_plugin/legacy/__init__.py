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

"""Backend API for importing classic Workbench and VS Code configuration."""

from typing import Any

from mysqlsh.plugin_manager import plugin_function

from gui_plugin.core.Db import BackendDatabase
from gui_plugin.legacy.discovery import (
    discover_sources,
    inspect_project_sources,
    inspect_workbench_sources,
    inspect_vscode_source,
)
from gui_plugin.legacy.model import (
    MigrationAssistantProjectImportOptions,
)
from gui_plugin.legacy.paths import (
    raise_injected_e2e_failure,
    resolve_source_roots,
)
from gui_plugin.legacy.projects import (
    import_migration_assistant_project_sources,
)
from gui_plugin.legacy.state import ConfigurationImportStateStore
from gui_plugin.legacy.workbench import import_workbench_sources
from gui_plugin.legacy.vscode import import_vscode_source


@plugin_function(
    "gui.legacy.discover",
    shell=False,
    cli=False,
    web=True,
)
def discover(be_session: Any = None) -> dict:
    """Discover validated legacy data that has not already been imported.

    Args:
        be_session (object): The current GUI backend session.

    Returns:
        dict: Validated actionable legacy data grouped by source.
    """
    del be_session
    raise_injected_e2e_failure("discovery")
    store = ConfigurationImportStateStore()
    roots = resolve_source_roots(
        target_root=store.path.parents[2],
    )

    return discover_sources(
        source_roots=roots,
        state=store.snapshot(),
        inspectors=[
            inspect_workbench_sources,
            inspect_vscode_source,
            inspect_project_sources,
        ],
    )


@plugin_function(
    "gui.legacy.importDiscoveredWorkbenchConnections",
    shell=False,
    cli=False,
    web=True,
)
def import_discovered_workbench_connections(
    profile_id: int,
    be_session: Any = None,
) -> dict:
    """Import discovered classic Workbench connections.

    Args:
        profile_id (int): The authenticated user's target profile.
        be_session (object): The current GUI backend session.

    Returns:
        dict: Counts and issues for the import.
    """
    store = ConfigurationImportStateStore()
    roots = resolve_source_roots(
        target_root=store.path.parents[2],
    )
    with BackendDatabase(be_session) as db:
        return import_workbench_sources(
            db=db,
            profile_id=profile_id,
            source_roots=roots,
            store=store,
        )


@plugin_function(
    "gui.legacy.importVsCode",
    shell=False,
    cli=False,
    web=True,
)
def import_vs_code(
    profile_id: int,
    be_session: Any = None,
) -> list[dict]:
    """Import VS Code connections and remove obsolete extension logs.

    Args:
        profile_id (int): The authenticated user's target profile.
        be_session (object): The current GUI backend session.

    Returns:
        list: Separate connection-import and log-cleanup reports.
    """
    store = ConfigurationImportStateStore()
    roots = resolve_source_roots(
        target_root=store.path.parents[2],
    )
    with BackendDatabase(be_session) as db:
        return import_vscode_source(
            db=db,
            profile_id=profile_id,
            source_roots=roots,
            store=store,
        )


@plugin_function(
    "gui.legacy.importMigrationAssistantProjects",
    shell=False,
    cli=False,
    web=True,
)
def import_migration_assistant_projects(
    options: MigrationAssistantProjectImportOptions,
    be_session: Any = None,
) -> list[dict]:
    """Copy and optionally remove legacy Migration Assistant projects.

    Args:
        options (dict): Source identifiers and project and SSH-key choices.
        be_session (object): The current GUI backend session.

    Returns:
        list: Independent copy and cleanup reports for each source.
    """
    del be_session
    store = ConfigurationImportStateStore()
    roots = resolve_source_roots(
        target_root=store.path.parents[2],
    )

    return import_migration_assistant_project_sources(
        source_roots=roots,
        store=store,
        options=options,
    )
