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

"""Assemble validated legacy source discovery results."""

from typing import Any, Callable, Dict, Iterable

from gui_plugin.db_connections.WorkbenchImport import (
    MAX_XML_SIZE,
    WorkbenchImportError,
    parse_workbench_document,
)
from gui_plugin.legacy.model import (
    LegacyConfigurationImportDiscovery,
)
from gui_plugin.legacy.paths import (
    LegacySourceRoots,
    validate_source_path,
)
from gui_plugin.legacy.projects import inspect_project_sources
from gui_plugin.legacy.state import ConfigurationImportManifest
from gui_plugin.legacy.vscode import inspect_vscode_source
from gui_plugin.legacy.workbench import WORKBENCH_CONNECTION_PHASE

SourceInspector = Callable[
    [LegacySourceRoots, ConfigurationImportManifest],
    LegacyConfigurationImportDiscovery,
]


def inspect_workbench_sources(
    source_roots: LegacySourceRoots,
    state: ConfigurationImportManifest,
) -> LegacyConfigurationImportDiscovery:
    """Inspect non-secret Workbench connection records."""
    connection_count = 0
    issues = []
    source_found = False
    if WORKBENCH_CONNECTION_PHASE in state["completedPhases"]:
        return {}

    for candidate in source_roots.workbench_connections:
        if not candidate.path.exists():
            continue
        source_found = True
        try:
            source_path = validate_source_path(
                candidate.path,
                approved_root=candidate.approved_root,
                target_root=source_roots.target_root,
                expect_directory=False,
            )
            if source_path.stat().st_size > MAX_XML_SIZE:
                raise WorkbenchImportError(
                    "Workbench XML document is too large"
                )
            connections, source_issues = parse_workbench_document(
                source_path.read_text(encoding="utf8")
            )
            connection_count += len(connections)
            issues.extend(
                {
                    "item": f"{candidate.source_id}: {issue['item']}",
                    "message": issue["message"],
                }
                for issue in source_issues
            )
        except (OSError, UnicodeError, ValueError) as error:
            issues.append(
                {
                    "item": candidate.source_id,
                    "message": str(error),
                }
            )

    if not source_found:
        return {}

    return {
        "workbench": {
            "connectionCount": connection_count,
            "connectionsPending": True,
            "issues": issues[:100],
        }
    }


def discover_sources(
    *,
    source_roots: LegacySourceRoots,
    state: ConfigurationImportManifest,
    inspectors: Iterable[SourceInspector] = (),
) -> LegacyConfigurationImportDiscovery:
    """Run installed validators and combine their top-level source results."""
    discovery: Dict[str, Any] = {}
    for inspector in inspectors:
        inspected_sources = inspector(source_roots, state)
        duplicate_sources = discovery.keys() & inspected_sources.keys()
        if duplicate_sources:
            duplicate_list = ", ".join(sorted(duplicate_sources))
            raise ValueError(f"Duplicate legacy source results: {duplicate_list}")
        discovery.update(inspected_sources)

    return discovery
