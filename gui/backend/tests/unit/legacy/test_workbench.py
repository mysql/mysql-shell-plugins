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

from pathlib import Path

import pytest

from gui_plugin.legacy.paths import (
    LegacySourceRoots,
    SourceCandidate,
)
from gui_plugin.legacy.workbench import import_workbench_sources


class FakeStore:
    def __init__(self):
        self.completed = False
        self.records = {}

    def is_completed(self, _phase):
        return self.completed

    def complete_phase(self, _phase):
        self.completed = True

    def connection_mappings(self):
        return self.records.get("connections", {})

    def replace_connection_mappings(self, mappings):
        self.records["connections"] = mappings


def roots(tmp_path: Path, *connections: Path) -> LegacySourceRoots:
    return LegacySourceRoots(
        workbench_connections=tuple(
            SourceCandidate(f"source-{index}", path, path.parent)
            for index, path in enumerate(connections)
        ),
        workbench_wrapper=tmp_path / "wrapper",
        vscode_extension=tmp_path / "vscode",
        target_root=tmp_path / "target",
    )


def test_startup_completes_only_after_all_sources_succeed(tmp_path):
    first = tmp_path / "first/connections.xml"
    second = tmp_path / "second/connections.xml"
    first.parent.mkdir()
    second.parent.mkdir()
    first.write_text("<first/>", encoding="utf8")
    second.write_text("<second/>", encoding="utf8")
    store = FakeStore()
    calls = []

    def importer(_db, _profile_id, xml_content, source, source_mappings):
        calls.append((xml_content, source))
        source_mappings[source] = {"targetConnectionId": len(calls)}

        return {
            "phase": "workbenchConnections",
            "imported": 1,
            "merged": 0,
            "skipped": 0,
            "warnings": [],
            "failed": [],
        }

    result = import_workbench_sources(
        db=object(),
        profile_id=7,
        source_roots=roots(tmp_path, first, second),
        store=store,
        importer=importer,
        validate_profile=lambda _db, _profile_id: 1,
    )

    assert calls == [
        ("<first/>", "source-0"),
        ("<second/>", "source-1"),
    ]
    assert result["imported"] == 2
    assert store.completed
    assert set(store.records["connections"]) == {"source-0", "source-1"}


def test_startup_failure_keeps_phase_retryable(tmp_path):
    first = tmp_path / "first/connections.xml"
    second = tmp_path / "second/connections.xml"
    first.parent.mkdir()
    second.parent.mkdir()
    first.write_text("<first/>", encoding="utf8")
    second.write_text("<second/>", encoding="utf8")
    store = FakeStore()

    class FakeDb:
        def __init__(self):
            self.committed = []
            self.pending = []

        def start_transaction(self):
            self.pending = []

        def commit(self):
            self.committed.extend(self.pending)
            self.pending = []

        def rollback(self):
            self.pending = []

    db = FakeDb()

    def importer(import_db, _profile_id, _xml_content, source, _source_mappings):
        import_db.pending.append(source)
        if source == "source-1":
            raise RuntimeError("second source failed")

        return {
            "phase": "workbenchConnections",
            "imported": 1,
            "merged": 0,
            "skipped": 0,
            "warnings": [],
            "failed": [],
        }

    with pytest.raises(RuntimeError, match="second source"):
        import_workbench_sources(
            db=db,
            profile_id=7,
            source_roots=roots(tmp_path, first, second),
            store=store,
            importer=importer,
            validate_profile=lambda _db, _profile_id: 1,
        )

    assert not store.completed
    assert db.committed == []


def test_startup_without_sources_does_not_complete_phase(tmp_path):
    store = FakeStore()

    result = import_workbench_sources(
        db=object(),
        profile_id=7,
        source_roots=roots(tmp_path),
        store=store,
        validate_profile=lambda _db, _profile_id: 1,
    )

    assert result["imported"] == 0
    assert not store.completed
