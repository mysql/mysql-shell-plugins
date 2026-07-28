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

from gui_plugin.legacy.discovery import (
    discover_sources,
    inspect_workbench_sources,
)
from gui_plugin.legacy.paths import (
    LegacySourceRoots,
    platform_source_roots,
    raise_injected_e2e_failure,
    resolve_source_roots,
    validate_source_path,
)
from gui_plugin.legacy.state import empty_state


def empty_roots(tmp_path: Path) -> LegacySourceRoots:
    return platform_source_roots(
        home=tmp_path / "home",
        app_data=tmp_path / "app-data",
        platform="linux",
        target_root=tmp_path / "electron",
    )


def test_absent_source_is_not_marked_completed(tmp_path):
    state = empty_state()

    discovery = discover_sources(
        source_roots=empty_roots(tmp_path),
        state=state,
    )

    assert discovery == {}
    assert "workbenchConnections:v1" not in state["completedPhases"]


def test_mac_workbench_candidates_have_stable_order_and_ids(tmp_path):
    roots = platform_source_roots(
        home=tmp_path / "home",
        app_data=tmp_path / "app-data",
        platform="darwin",
        target_root=tmp_path / "electron",
    )

    assert [
        (candidate.source_id, candidate.path)
        for candidate in roots.workbench_connections
    ] == [
        (
            "classic-workbench-application-support",
            tmp_path
            / "home/Library/Application Support/MySQL/Workbench/connections.xml",
        ),
        (
            "classic-workbench-dot-mysql",
            tmp_path / "home/.mysql/workbench/connections.xml",
        ),
    ]


def test_e2e_source_root_overrides_are_strictly_gated(
    tmp_path,
    monkeypatch,
):
    target_root = tmp_path / "electron"
    fake_home = tmp_path / "fake-home"
    fake_app_data = tmp_path / "fake-app-data"
    monkeypatch.setenv("ELECTRON_E2E_LEGACY_HOME", str(fake_home))
    monkeypatch.setenv(
        "ELECTRON_E2E_LEGACY_APP_DATA",
        str(fake_app_data),
    )

    production_roots = resolve_source_roots(
        target_root=target_root,
        home=tmp_path / "real-home",
        app_data=tmp_path / "real-app-data",
        platform="linux",
    )

    assert production_roots.workbench_wrapper == (
        tmp_path / "real-home/.mysqlsh-wb"
    )

    monkeypatch.setenv("ELECTRON_E2E", "1")
    test_roots = resolve_source_roots(
        target_root=target_root,
        home=tmp_path / "real-home",
        app_data=tmp_path / "real-app-data",
        platform="linux",
    )

    assert test_roots.workbench_wrapper == fake_home / ".mysqlsh-wb"
    assert test_roots.vscode_extension == fake_home / ".mysqlsh-gui"


def test_e2e_failure_markers_are_strictly_gated(tmp_path, monkeypatch):
    failure_root = tmp_path / "failures"
    failure_root.mkdir()
    (failure_root / "discovery").touch()
    monkeypatch.setenv(
        "ELECTRON_E2E_LEGACY_FAILURE_ROOT",
        str(failure_root),
    )

    raise_injected_e2e_failure("discovery")

    monkeypatch.setenv("ELECTRON_E2E", "1")
    with pytest.raises(OSError, match="discovery"):
        raise_injected_e2e_failure("discovery")


def test_source_path_accepts_in_root_links_and_rejects_target_root(tmp_path):
    legacy_root = tmp_path / "legacy"
    legacy_root.mkdir()
    source_parent = legacy_root / "source-parent"
    source_parent.mkdir()
    source = source_parent / "source"
    source.mkdir()
    target_root = tmp_path / "electron"
    target_root.mkdir()

    assert validate_source_path(
        source,
        approved_root=legacy_root,
        target_root=target_root,
        expect_directory=True,
    ) == source.resolve()

    with pytest.raises(ValueError, match="target data root"):
        validate_source_path(
            target_root,
            approved_root=tmp_path,
            target_root=target_root,
            expect_directory=True,
        )

    linked_parent = legacy_root / "linked-parent"
    linked_parent.symlink_to(source_parent, target_is_directory=True)
    assert validate_source_path(
        linked_parent / "source",
        approved_root=legacy_root,
        target_root=target_root,
        expect_directory=True,
    ) == source.resolve()


def test_discovery_assembles_injected_inspector_results(tmp_path):
    roots = empty_roots(tmp_path)
    state = empty_state()

    discovery = discover_sources(
        source_roots=roots,
        state=state,
        inspectors=[
            lambda _roots, _state: {
                "vscode": {
                    "connectionCount": 2,
                    "profileCount": 1,
                    "logFileCount": 3,
                    "connectionsPending": True,
                    "issues": [],
                }
            },
            lambda _roots, _state: {
                "projects": {
                    "sources": [],
                    "issues": [
                        {
                            "item": "project",
                            "message": "Invalid project",
                        }
                    ],
                }
            },
        ],
    )

    assert discovery["vscode"]["connectionCount"] == 2
    assert discovery["projects"]["issues"][0]["item"] == "project"


def test_workbench_inspector_counts_valid_records_and_keeps_errors_visible(
    tmp_path,
):
    roots = empty_roots(tmp_path)
    candidate = roots.workbench_connections[0]
    candidate.path.parent.mkdir(parents=True)
    candidate.path.write_text(
        """<data><value type="list" content-type="object"
        content-struct-name="db.mgmt.Connection">
        <value type="object" struct-name="db.mgmt.Connection">
        <link key="driver">com.mysql.rdbms.mysql.driver.native</link>
        <value key="parameterValues">
        <value key="hostName">db.example</value>
        </value>
        <value key="name">Production</value>
        </value>
        <value type="object" struct-name="db.mgmt.Connection">
        <link key="driver">unsupported</link>
        <value key="name">Unsupported</value>
        </value>
        </value></data>""",
        encoding="utf8",
    )

    discovery = discover_sources(
        source_roots=roots,
        state=empty_state(),
        inspectors=[inspect_workbench_sources],
    )

    assert discovery["workbench"]["connectionCount"] == 1
    assert discovery["workbench"]["connectionsPending"] is True
    assert len(discovery["workbench"]["issues"]) == 1
    assert candidate.source_id in discovery["workbench"]["issues"][0]["item"]


def test_completed_workbench_connection_phase_is_not_actionable(tmp_path):
    state = empty_state()
    state["completedPhases"].append("workbenchConnections:v1")

    assert inspect_workbench_sources(
        empty_roots(tmp_path),
        state,
    ) == {}
