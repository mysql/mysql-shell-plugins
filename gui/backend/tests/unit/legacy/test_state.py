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

import json
import os
import stat

import pytest

import gui_plugin.legacy.state as state_module
from gui_plugin.legacy.state import ConfigurationImportStateStore


def test_manifest_contains_only_required_state_and_is_private(tmp_path):
    store = ConfigurationImportStateStore(tmp_path)

    store.complete_phase("workbenchConnections:v1")

    data = json.loads(store.path.read_text(encoding="utf8"))
    assert data == {
        "completedPhases": ["workbenchConnections:v1"],
        "records": {
            "connections": {},
        },
        "version": 1,
    }
    assert not list(store.path.parent.glob(".*.tmp"))
    if os.name != "nt":
        assert stat.S_IMODE(store.path.stat().st_mode) == 0o600


def test_failed_manifest_write_preserves_previous_state(tmp_path, monkeypatch):
    store = ConfigurationImportStateStore(tmp_path)
    store.complete_phase("workbenchConnections:v1")

    def fail_after_partial_write(_manifest, manifest_file, **_kwargs):
        manifest_file.write("{")
        raise OSError("injected manifest write failure")

    monkeypatch.setattr(state_module.json, "dump", fail_after_partial_write)

    with pytest.raises(OSError, match="injected manifest write failure"):
        store.complete_phase("vscodeConnections:v1")

    assert store.snapshot()["completedPhases"] == [
        "workbenchConnections:v1",
    ]
    assert not list(store.path.parent.glob(".*.tmp"))


def test_connection_mappings_use_explicit_state_operations(tmp_path):
    store = ConfigurationImportStateStore(tmp_path)
    mappings = {
        "classic-workbench:local": {
            "targetConnectionId": 17,
            "targetFingerprint": '{"host":"localhost"}',
        },
    }

    store.replace_connection_mappings(mappings)

    stored = store.connection_mappings()
    assert stored == mappings
    stored.clear()
    assert store.connection_mappings() == mappings
