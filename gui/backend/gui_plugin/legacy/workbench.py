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

"""Classic Workbench startup connection import."""

from contextlib import nullcontext
from typing import Callable

from gui_plugin.core.Db import BackendTransaction
from gui_plugin.db_connections.WorkbenchImport import (
    MAX_XML_SIZE,
    import_workbench_xml,
)
from gui_plugin.legacy.connections import (
    validate_profile_for_session,
)
from gui_plugin.legacy.paths import (
    LegacySourceRoots,
    validate_source_path,
)

WORKBENCH_CONNECTION_PHASE = "workbenchConnections:v1"


def _empty_report() -> dict:
    return {
        "phase": "workbenchConnections",
        "imported": 0,
        "merged": 0,
        "skipped": 0,
        "warnings": [],
        "failed": [],
    }


def _existing_connection_records(store) -> dict:
    if not hasattr(store, "connection_mappings"):
        return {}

    return store.connection_mappings()


def import_workbench_sources(
    *,
    db,
    profile_id: int,
    source_roots: LegacySourceRoots,
    store,
    importer: Callable = import_workbench_xml,
    validate_profile: Callable = validate_profile_for_session,
) -> dict:
    """Import every validated Workbench source in deterministic order."""
    validate_profile(db, profile_id)
    if store.is_completed(WORKBENCH_CONNECTION_PHASE):
        return _empty_report()

    report = _empty_report()
    mappings = _existing_connection_records(store)
    source_processed = False
    transaction = (
        BackendTransaction(db)
        if hasattr(db, "start_transaction")
        else nullcontext()
    )
    with transaction:
        for candidate in source_roots.workbench_connections:
            if not candidate.path.exists():
                continue
            source_processed = True
            source_path = validate_source_path(
                candidate.path,
                approved_root=candidate.approved_root,
                target_root=source_roots.target_root,
                expect_directory=False,
            )
            if source_path.stat().st_size > MAX_XML_SIZE:
                raise ValueError(
                    f"Workbench XML document is too large: {source_path}"
                )
            xml_content = source_path.read_text(encoding="utf8")
            source_report = importer(
                db,
                profile_id,
                xml_content,
                candidate.source_id,
                mappings,
            )
            for count_name in ("imported", "merged", "skipped"):
                report[count_name] += source_report[count_name]
            report["warnings"].extend(source_report["warnings"])
            report["failed"].extend(source_report["failed"])

    if not source_processed:
        return report

    store.replace_connection_mappings(mappings)
    store.complete_phase(WORKBENCH_CONNECTION_PHASE)

    return report
