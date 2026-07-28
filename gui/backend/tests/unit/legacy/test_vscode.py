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
import sqlite3
import uuid
from pathlib import Path, PureWindowsPath

import pytest

import gui_plugin.legacy.vscode as vscode_module
from gui_plugin.core.Db import BackendDatabase
from gui_plugin.db_connections import DbConnections
from gui_plugin.legacy.paths import platform_source_roots
from gui_plugin.legacy.state import empty_state
from gui_plugin.legacy.vscode import (
    build_read_only_sqlite_uri,
    inspect_vscode_source,
    import_vscode_source,
    snapshot_sqlite_database,
)
from gui_plugin.users import UserManagement


VSCODE_DATABASE_FIXTURE = (
    Path(__file__).parent
    / "fixtures"
    / "vscode"
    / "mysqlsh_gui_backend_1.20.sql"
)


class FakeStore:
    def __init__(self):
        self.manifest = empty_state()

    def snapshot(self):
        return self.manifest

    def is_completed(self, phase_name):
        return phase_name in self.manifest["completedPhases"]

    def complete_phase(self, phase_name):
        self.manifest["completedPhases"].append(phase_name)


@pytest.fixture
def profile_id():
    user_name = f"legacy_vscode_{uuid.uuid4().hex}"
    user_id = UserManagement.create_user(user_name, "unused", role="User")
    created_profile_id = UserManagement.add_profile(
        user_id,
        {
            "name": "Electron profile",
            "description": "",
            "options": {},
        },
    )
    try:
        yield created_profile_id
    finally:
        with BackendDatabase() as db:
            connection_rows = db.select(
                """SELECT db_connection_id
                FROM profile_has_db_connection
                WHERE profile_id=?""",
                (created_profile_id,),
            )

        for row in connection_rows:
            DbConnections.remove_db_connection(
                created_profile_id,
                row["db_connection_id"],
            )

        UserManagement.delete_profile(user_id, created_profile_id)
        DbConnections.remove_empty_folders()
        groups = UserManagement.list_user_groups(user_id)

        for group in groups:
            group_id = group["id"]
            if group["name"] != user_name:
                UserManagement.remove_user_from_group(user_id, group_id)
                if group_id != 1:
                    UserManagement.remove_user_group(group_id)
        UserManagement.delete_user(user_name)


def create_source_database(
    database_path: Path,
    *,
    host: str = "db.example",
) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(database_path) as connection:
        connection.executescript(
            VSCODE_DATABASE_FIXTURE.read_text(encoding="utf8")
        )
        options = json.loads(
            connection.execute(
                "SELECT options FROM db_connection WHERE id=20"
            ).fetchone()[0]
        )
        options["host"] = host
        connection.execute(
            "UPDATE db_connection SET options=? WHERE id=20",
            (json.dumps(options),),
        )


def test_read_only_uri_encodes_portable_paths():
    posix_uri = build_read_only_sqlite_uri(
        Path("/tmp/legacy data/zażółć.sqlite3")
    )
    windows_uri = build_read_only_sqlite_uri(
        PureWindowsPath("C:/Users/Test User/legacy.sqlite3")
    )
    unc_uri = build_read_only_sqlite_uri(
        PureWindowsPath("//server/share/legacy data.sqlite3")
    )

    assert posix_uri.startswith("file:///tmp/legacy%20data/")
    assert "mode=ro" in posix_uri
    assert windows_uri.startswith("file:///C:/Users/Test%20User/")
    assert unc_uri.startswith("file://server/share/legacy%20data.sqlite3")


def test_snapshot_includes_uncheckpointed_wal_rows(tmp_path):
    source = tmp_path / "source.sqlite3"
    destination = tmp_path / "snapshot.sqlite3"
    source_connection = sqlite3.connect(source)
    try:
        source_connection.execute("PRAGMA journal_mode=WAL")
        source_connection.execute("CREATE TABLE sample(value TEXT)")
        source_connection.commit()
        source_connection.execute("INSERT INTO sample VALUES('wal row')")
        source_connection.commit()

        snapshot_sqlite_database(source, destination)
    finally:
        source_connection.close()

    with sqlite3.connect(destination) as snapshot:
        assert snapshot.execute("SELECT value FROM sample").fetchone() == (
            "wal row",
        )


def test_completed_vscode_source_without_logs_is_not_discovered(tmp_path):
    roots = platform_source_roots(
        home=tmp_path / "home",
        app_data=tmp_path / "app-data",
        platform="linux",
        target_root=tmp_path / "electron",
    )
    source_database = (
        roots.vscode_extension
        / "plugin_data/gui_plugin/mysqlsh_gui_backend.sqlite3"
    )
    create_source_database(source_database)
    state = empty_state()
    state["completedPhases"].append("vscodeConnections:v1")

    assert inspect_vscode_source(roots, state) == {}


def test_failed_database_snapshot_removes_its_temporary_directory(
    tmp_path,
    monkeypatch,
):
    roots = platform_source_roots(
        home=tmp_path / "home",
        app_data=tmp_path / "app-data",
        platform="linux",
        target_root=tmp_path / "electron",
    )
    source_database = (
        roots.vscode_extension
        / "plugin_data/gui_plugin/mysqlsh_gui_backend.sqlite3"
    )
    create_source_database(source_database)

    def fail_snapshot(_source, _destination):
        raise OSError("injected snapshot failure")

    monkeypatch.setattr(
        vscode_module,
        "snapshot_sqlite_database",
        fail_snapshot,
    )
    discovery = inspect_vscode_source(roots, empty_state())

    assert discovery["vscode"]["issues"][0]["message"] == (
        "injected snapshot failure"
    )
    assert list(roots.target_root.glob(".configuration-import-vscode-*")) == []


def test_vscode_import_preserves_structure_and_deletes_logs(
    tmp_path,
    profile_id,
):
    roots = platform_source_roots(
        home=tmp_path / "home",
        app_data=tmp_path / "app-data",
        platform="linux",
        target_root=tmp_path / "electron",
    )
    source_database = (
        roots.vscode_extension
        / "plugin_data/gui_plugin/mysqlsh_gui_backend.sqlite3"
    )
    create_source_database(source_database)
    log_file = source_database.with_name("mysqlsh_gui_backend_log.sqlite3")
    log_file.write_bytes(b"legacy log")
    store = FakeStore()

    with BackendDatabase() as db:
        reports = import_vscode_source(
            db=db,
            profile_id=profile_id,
            source_roots=roots,
            store=store,
        )

    with BackendDatabase() as db:
        imported = db.select(
            """SELECT dc.id, dc.caption, fp.caption AS folder
            FROM db_connection dc
            JOIN profile_has_db_connection phdc
                ON phdc.db_connection_id=dc.id
            JOIN folder_path fp ON fp.id=phdc.folder_path_id
            WHERE phdc.profile_id=? AND dc.caption='VS Code Production'""",
            (profile_id,),
        )
        imported_profiles = db.select(
            """SELECT imported.name, imported.description,
                imported.options, imported.state
            FROM profile current
            JOIN profile imported ON imported.user_id=current.user_id
            WHERE current.id=?
                AND imported.name='Imported from VS Code - Analytics'""",
            (profile_id,),
        )
    assert len(imported) == 1
    assert imported[0]["folder"] == "Production"
    assert imported_profiles == [
        {
            "name": "Imported from VS Code - Analytics",
            "description": "Secondary profile",
            "options": {"theme": "dark"},
            "state": {},
        }
    ]
    assert reports[0] == {
        "phase": "vscodeConnections",
        "imported": 1,
        "merged": 0,
        "skipped": 0,
        "warnings": [],
        "failed": [],
    }
    assert reports[1]["cleanup"] == {
        "deleted": 1,
        "retained": 0,
        "failed": [],
    }
    assert not log_file.exists()
    assert store.is_completed("vscodeConnections:v1")
    assert not (roots.target_root / "legacy_configuration_import_staging").exists()


def test_vscode_import_ignores_unsupported_tags_and_groups(
    tmp_path,
    profile_id,
):
    roots = platform_source_roots(
        home=tmp_path / "home",
        app_data=tmp_path / "app-data",
        platform="linux",
        target_root=tmp_path / "electron",
    )
    source_database = (
        roots.vscode_extension
        / "plugin_data/gui_plugin/mysqlsh_gui_backend.sqlite3"
    )
    create_source_database(source_database)
    with sqlite3.connect(source_database) as connection:
        connection.execute(
            "INSERT INTO tag VALUES(30, 1, 'Unsupported tag', '#123456')"
        )
        connection.execute(
            "INSERT INTO db_connection_has_tag VALUES(10, 20, 30)"
        )
        connection.execute(
            """INSERT INTO db_connection_group
            VALUES(40, 'Unsupported group', 'Not used by VS Code')"""
        )

    with BackendDatabase() as db:
        import_vscode_source(
            db=db,
            profile_id=profile_id,
            source_roots=roots,
            store=FakeStore(),
        )
        imported_tags = db.select(
            "SELECT id FROM tag WHERE caption='Unsupported tag'"
        )
        imported_groups = db.select(
            """SELECT id FROM db_connection_group
            WHERE caption='Unsupported group'"""
        )

    assert imported_tags == []
    assert imported_groups == []


def test_failed_log_cleanup_is_reported_without_reimporting_connections(
    tmp_path,
    profile_id,
    monkeypatch,
):
    roots = platform_source_roots(
        home=tmp_path / "home",
        app_data=tmp_path / "app-data",
        platform="linux",
        target_root=tmp_path / "electron",
    )
    source_database = (
        roots.vscode_extension
        / "plugin_data/gui_plugin/mysqlsh_gui_backend.sqlite3"
    )
    create_source_database(source_database, host="retry.example")
    log_file = source_database.with_name("mysqlsh_gui_backend_log.sqlite3")
    log_file.write_bytes(b"legacy log")
    store = FakeStore()
    original_unlink = Path.unlink

    def fail_log_unlink(path, *args, **kwargs):
        if path == log_file:
            raise PermissionError("file is in use")

        return original_unlink(path, *args, **kwargs)

    monkeypatch.setattr(Path, "unlink", fail_log_unlink)
    with BackendDatabase() as db:
        first_reports = import_vscode_source(
            db=db,
            profile_id=profile_id,
            source_roots=roots,
            store=store,
        )

    assert (
        first_reports[0]["imported"] + first_reports[0]["merged"]
        == 1
    )
    assert first_reports[1]["cleanup"]["failed"][0]["item"] == log_file.name
    assert first_reports[1]["failed"] == []
    assert store.is_completed("vscodeConnections:v1")

    monkeypatch.setattr(Path, "unlink", original_unlink)
    with BackendDatabase() as db:
        retry_reports = import_vscode_source(
            db=db,
            profile_id=profile_id,
            source_roots=roots,
            store=store,
        )
        imported_count = db.select(
            """SELECT COUNT(*) AS count
            FROM profile_has_db_connection
            WHERE profile_id=?""",
            (profile_id,),
        )[0]["count"]

    assert retry_reports == []
    assert imported_count == 1
    assert log_file.exists()


def test_vscode_does_not_replace_an_existing_equivalent_connection(
    tmp_path,
    profile_id,
):
    roots = platform_source_roots(
        home=tmp_path / "home",
        app_data=tmp_path / "app-data",
        platform="linux",
        target_root=tmp_path / "electron",
    )
    source_database = (
        roots.vscode_extension
        / "plugin_data/gui_plugin/mysqlsh_gui_backend.sqlite3"
    )
    create_source_database(source_database)
    target_id = DbConnections.add_db_connection(
        profile_id,
        {
            "db_type": "MySQL",
            "caption": "Workbench Production",
            "description": "From Workbench",
            "options": {
                "scheme": "mysql",
                "user": "scott",
                "host": "db.example",
                "port": 3306,
            },
            "settings": {},
        },
    )[0]
    store = FakeStore()
    with BackendDatabase() as db:
        reports = import_vscode_source(
            db=db,
            profile_id=profile_id,
            source_roots=roots,
            store=store,
        )

    updated = DbConnections.get_db_connection(target_id)
    assert reports[0]["merged"] == 0
    assert reports[0]["imported"] == 1
    assert updated["caption"] == "Workbench Production"
    assert updated["description"] == "From Workbench"
