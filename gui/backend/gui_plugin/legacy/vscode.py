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

"""Import connection data from MySQL Shell for VS Code."""

import json
import re
import shutil
import sqlite3
import tempfile
from pathlib import Path, PurePath
from typing import Any
from urllib.parse import urlencode

from gui_plugin.core.Db import BackendTransaction
from gui_plugin.core.Files import (
    ensure_private_directory,
    ensure_private_file,
    secure_existing_file,
)
from gui_plugin.core.GuiBackendDbManager import (
    BackendSqliteDbManager,
)
from gui_plugin.db_connections.DbConnections import (
    ensure_folder_path,
    insert_db_connection,
)
from gui_plugin.legacy.connections import (
    validate_profile_for_session,
)
from gui_plugin.legacy.paths import (
    LegacySourceRoots,
    raise_injected_e2e_failure,
    validate_source_path,
)
from gui_plugin.users.backend import add_profile

VSCODE_CONNECTION_PHASE = "vscodeConnections:v1"
VSCODE_DATABASE_NAME = "mysqlsh_gui_backend.sqlite3"
VSCODE_LOG_NAME = "mysqlsh_gui_backend_log.sqlite3"
MAX_SOURCE_ROWS = 10000
MAX_ISSUES = 100
_APPROVED_LOG_NAME = re.compile(
    r"mysqlsh_gui_backend_log"
    r"(?:_\d+\.\d+\.\d+)?\.sqlite3"
    r"(?:(?:-wal|-shm)|(?:\.backup(?:\.old)?))?"
)


def build_read_only_sqlite_uri(database_path: PurePath) -> str:
    """Build a read-only SQLite URI without interpolating a raw path."""
    return f"{database_path.as_uri()}?{urlencode({'mode': 'ro'})}"


def snapshot_sqlite_database(source: Path, destination: Path) -> None:
    """Create a consistent SQLite snapshot, including committed WAL rows."""
    ensure_private_directory(destination.parent)
    ensure_private_file(destination)
    source_uri = build_read_only_sqlite_uri(source)
    try:
        with sqlite3.connect(
            source_uri,
            uri=True,
            timeout=10,
        ) as source_connection:
            with sqlite3.connect(destination, timeout=10) as target_connection:
                source_connection.backup(target_connection)
    except sqlite3.OperationalError as error:
        if "locked" in str(error).lower() or "busy" in str(error).lower():
            raise RuntimeError(
                "The VS Code database is busy. Close VS Code and retry."
            ) from error
        raise

    secure_existing_file(destination)


def upgrade_staged_database(staging_dir: Path) -> Path:
    """Upgrade a staged main database using the application's upgrade chain."""
    staged_database = staging_dir / VSCODE_DATABASE_NAME
    ensure_private_file(staging_dir / VSCODE_LOG_NAME)
    BackendSqliteDbManager.upgrade_database_file(staged_database)

    return staged_database


def _database_path(source_roots: LegacySourceRoots) -> Path:
    return (
        source_roots.vscode_extension
        / "plugin_data"
        / "gui_plugin"
        / VSCODE_DATABASE_NAME
    )


def _json_object(value: Any, field_name: str) -> dict:
    if value in (None, ""):
        return {}
    if isinstance(value, dict):
        return value
    if not isinstance(value, str) or len(value) > 1024 * 1024:
        raise ValueError(f"Invalid {field_name}")

    decoded = json.loads(value)
    if not isinstance(decoded, dict):
        raise ValueError(f"Invalid {field_name}")

    return decoded


def _read_rows(connection: sqlite3.Connection, table: str) -> list[dict]:
    allowed_tables = {
        "user",
        "profile",
        "folder_path",
        "db_connection",
        "profile_has_db_connection",
    }
    if table not in allowed_tables:
        raise ValueError(f"Unsupported source table: {table}")

    rows = connection.execute(f"SELECT * FROM `{table}`").fetchall()
    if len(rows) > MAX_SOURCE_ROWS:
        raise ValueError(f"Too many rows in legacy {table}")

    return [dict(row) for row in rows]


def _select_source_user(
    users: list[dict],
    profiles: list[dict],
) -> dict:
    local_administrators = [
        user for user in users if user.get("name") == "LocalAdministrator"
    ]
    if len(local_administrators) > 1:
        raise ValueError("The VS Code database has ambiguous local users")
    if local_administrators:
        selected = local_administrators[0]
    else:
        owned_profiles = {
            (profile["user_id"], profile["id"])
            for profile in profiles
        }
        candidates = [
            user
            for user in users
            if (user["id"], user.get("default_profile_id")) in owned_profiles
        ]
        if len(candidates) != 1:
            raise ValueError("The VS Code database has ambiguous local users")
        selected = candidates[0]

    if (
        selected.get("default_profile_id") is None
        or not any(
            profile["id"] == selected["default_profile_id"]
            and profile["user_id"] == selected["id"]
            for profile in profiles
        )
    ):
        raise ValueError("The VS Code user's default profile is invalid")

    return selected


def _read_source(database_path: Path) -> dict:
    with sqlite3.connect(
        build_read_only_sqlite_uri(database_path),
        uri=True,
        timeout=10,
    ) as connection:
        connection.row_factory = sqlite3.Row
        source = {
            table: _read_rows(connection, table)
            for table in (
                "user",
                "profile",
                "folder_path",
                "db_connection",
                "profile_has_db_connection",
            )
        }
    selected_user = _select_source_user(source["user"], source["profile"])
    selected_profile_ids = {
        profile["id"]
        for profile in source["profile"]
        if profile["user_id"] == selected_user["id"]
    }
    source["selectedUser"] = selected_user
    source["selectedProfileIds"] = selected_profile_ids

    for connection in source["db_connection"]:
        connection["options"] = _json_object(
            connection.get("options"),
            "connection options",
        )
        connection["settings"] = _json_object(
            connection.get("settings"),
            "connection settings",
        )
    for profile in source["profile"]:
        profile["options"] = _json_object(
            profile.get("options"),
            "profile options",
        )
    for folder in source["folder_path"]:
        folder["settings"] = _json_object(
            folder.get("settings"),
            "folder settings",
        )

    return source


def _staged_source(
    source_roots: LegacySourceRoots,
) -> tuple[Path, Path]:
    source_database = validate_source_path(
        _database_path(source_roots),
        approved_root=source_roots.vscode_extension,
        target_root=source_roots.target_root,
        expect_directory=False,
    )
    staging_parent = source_roots.target_root
    ensure_private_directory(staging_parent)
    staging_directory = Path(
        tempfile.mkdtemp(
            prefix=".configuration-import-vscode-",
            dir=staging_parent,
        )
    )
    try:
        ensure_private_directory(staging_directory)
        staged_database = staging_directory / VSCODE_DATABASE_NAME
        snapshot_sqlite_database(source_database, staged_database)
        upgrade_staged_database(staging_directory)
    except Exception:
        shutil.rmtree(staging_directory, ignore_errors=True)
        raise

    return staging_directory, staged_database


def _unique_profile_name(db, user_id: int, source_name: str) -> str:
    existing = {
        row["name"]
        for row in db.select(
            "SELECT name FROM profile WHERE user_id=?",
            (user_id,),
        )
    }
    base_name = f"Imported from VS Code - {source_name or 'Profile'}"
    candidate = base_name
    suffix = 2
    while candidate in existing:
        candidate = f"{base_name} ({suffix})"
        suffix += 1

    return candidate


def _profile_maps(db, source: dict, profile_id: int, user_id: int) -> dict:
    default_profile_id = source["selectedUser"]["default_profile_id"]
    result = {default_profile_id: profile_id}
    for source_profile in sorted(source["profile"], key=lambda row: row["id"]):
        if source_profile["user_id"] != source["selectedUser"]["id"]:
            continue
        if source_profile["id"] == default_profile_id:
            continue
        result[source_profile["id"]] = int(
            add_profile(
                db,
                user_id,
                {
                    "name": _unique_profile_name(
                        db,
                        user_id,
                        str(source_profile.get("name") or ""),
                    ),
                    "description": source_profile.get("description") or "",
                    "options": source_profile.get("options") or {},
                },
            )
        )

    return result


def _folder_maps(db, source: dict, profile_ids: dict) -> dict:
    source_folders = {
        folder["id"]: folder
        for folder in source["folder_path"]
    }
    result: dict[tuple[int, int], int] = {}
    for source_profile_id, target_profile_id in profile_ids.items():
        imported_root = ensure_folder_path(
            db,
            target_profile_id,
            "Imported from VS Code",
            parent_folder_id=1,
        )["id"]
        result[(source_profile_id, 1)] = imported_root
        pending = {
            folder_id
            for folder_id in source_folders
            if folder_id != 1
        }
        while pending:
            progressed = False
            for folder_id in sorted(pending):
                folder = source_folders[folder_id]
                parent_key = (
                    source_profile_id,
                    folder["parent_folder_id"],
                )
                if parent_key not in result:
                    continue
                target_folder = ensure_folder_path(
                    db,
                    target_profile_id,
                    str(folder["caption"]),
                    settings=folder.get("settings") or {},
                    parent_folder_id=result[parent_key],
                )
                result[(source_profile_id, folder_id)] = target_folder["id"]
                pending.remove(folder_id)
                progressed = True
                break
            if not progressed:
                raise ValueError("The VS Code folder hierarchy is invalid")

    return result


def _attach_connection(
    db,
    profile_id: int,
    connection_id: int,
    folder_id: int,
    index: int,
) -> None:
    existing = db.select(
        """SELECT folder_path_id FROM profile_has_db_connection
        WHERE profile_id=? AND db_connection_id=?""",
        (profile_id, connection_id),
    )
    if existing:
        return
    db.execute(
        """INSERT INTO profile_has_db_connection(
        profile_id, db_connection_id, folder_path_id, `index`)
        VALUES(?, ?, ?, ?)""",
        (profile_id, connection_id, folder_id, index),
    )


def _merge_source(db, source: dict, profile_id: int) -> dict:
    user_id = validate_profile_for_session(db, profile_id)
    profile_ids = _profile_maps(db, source, profile_id, user_id)
    folder_ids = _folder_maps(db, source, profile_ids)
    source_connections = {
        row["id"]: row
        for row in source["db_connection"]
    }
    connection_ids: dict[int, int] = {}
    imported = 0
    merged = 0

    relations = [
        row
        for row in source["profile_has_db_connection"]
        if row["profile_id"] in source["selectedProfileIds"]
    ]
    for relation in sorted(
        relations,
        key=lambda row: (
            row["profile_id"],
            row.get("index") or 0,
            row["db_connection_id"],
        ),
    ):
        source_connection = source_connections.get(
            relation["db_connection_id"]
        )
        if source_connection is None:
            raise ValueError("A VS Code profile references a missing connection")
        target_connection_id = connection_ids.get(
            relation["db_connection_id"]
        )
        if target_connection_id is None:
            target_connection_id, _folder_id, _index = insert_db_connection(
                db,
                profile_ids[relation["profile_id"]],
                source_connection,
                folder_ids[
                    (relation["profile_id"], relation["folder_path_id"])
                ],
            )
            imported += 1
        else:
            _attach_connection(
                db,
                profile_ids[relation["profile_id"]],
                target_connection_id,
                folder_ids[
                    (relation["profile_id"], relation["folder_path_id"])
                ],
                int(relation.get("index") or 0),
            )
        connection_ids[relation["db_connection_id"]] = target_connection_id

    return {
        "phase": "vscodeConnections",
        "imported": imported,
        "merged": merged,
        "skipped": 0,
        "warnings": [],
        "failed": [],
    }


def _approved_log_files(source_roots: LegacySourceRoots) -> list[Path]:
    log_root = _database_path(source_roots).parent
    if not log_root.exists():
        return []
    validated_root = validate_source_path(
        log_root,
        approved_root=source_roots.vscode_extension,
        target_root=source_roots.target_root,
        expect_directory=True,
    )
    approved = []
    for entry in validated_root.iterdir():
        if not _APPROVED_LOG_NAME.fullmatch(entry.name):
            continue
        path = validate_source_path(
            entry,
            approved_root=validated_root,
            target_root=source_roots.target_root,
            expect_directory=False,
        )
        approved.append(path)

    return sorted(approved, key=lambda path: path.name)


def _cleanup_logs(
    source_roots: LegacySourceRoots,
) -> dict:
    report = {
        "phase": "vscodeLogCleanup",
        "imported": 0,
        "merged": 0,
        "skipped": 0,
        "warnings": [],
        "failed": [],
        "cleanup": {
            "deleted": 0,
            "retained": 0,
            "failed": [],
        },
    }
    cleanup = report["cleanup"]
    approved = _approved_log_files(source_roots)
    for log_path in approved:
        try:
            raise_injected_e2e_failure(
                f"vscode-log-delete-{log_path.name}"
            )
            log_path.unlink(missing_ok=True)
            cleanup["deleted"] += 1
        except OSError as error:
            cleanup["failed"].append(
                {
                    "item": log_path.name,
                    "message": str(error),
                }
            )
    cleanup["retained"] = len(cleanup["failed"])

    return report


def inspect_vscode_source(
    source_roots: LegacySourceRoots,
    state: dict,
) -> dict:
    """Inspect validated VS Code connection and log data."""
    connection_pending = VSCODE_CONNECTION_PHASE not in state[
        "completedPhases"
    ]
    database_path = _database_path(source_roots)
    if not connection_pending or not database_path.exists():
        return {}

    log_files = _approved_log_files(source_roots)

    connection_count = 0
    profile_count = 0
    issues = []
    if connection_pending and database_path.exists():
        staging_directory = None
        try:
            staging_directory, staged_database = _staged_source(source_roots)
            source = _read_source(staged_database)
            profile_count = len(source["selectedProfileIds"])
            selected_connections = {
                relation["db_connection_id"]
                for relation in source["profile_has_db_connection"]
                if relation["profile_id"] in source["selectedProfileIds"]
            }
            connection_count = len(selected_connections)
            ignored_profiles = (
                len(source["profile"]) - profile_count
            )
            if ignored_profiles:
                issues.append(
                    {
                        "item": "profiles",
                        "message": (
                            f"{ignored_profiles} profile(s) owned by other "
                            "legacy users will be ignored"
                        ),
                    }
                )
        except (OSError, sqlite3.Error, ValueError, RuntimeError) as error:
            issues.append(
                {
                    "item": VSCODE_DATABASE_NAME,
                    "message": str(error),
                }
            )
        finally:
            if staging_directory is not None:
                shutil.rmtree(staging_directory, ignore_errors=True)

    return {
        "vscode": {
            "connectionCount": connection_count,
            "profileCount": profile_count,
            "logFileCount": len(log_files),
            "connectionsPending": True,
            "issues": issues[:MAX_ISSUES],
        }
    }


def import_vscode_source(
    *,
    db,
    profile_id: int,
    source_roots: LegacySourceRoots,
    store,
) -> list[dict]:
    """Import VS Code connections and remove obsolete extension logs."""
    validate_profile_for_session(db, profile_id)
    reports = []
    if not store.is_completed(VSCODE_CONNECTION_PHASE):
        staging_directory = None
        try:
            staging_directory, staged_database = _staged_source(source_roots)
            source = _read_source(staged_database)
            with BackendTransaction(db):
                report = _merge_source(
                    db,
                    source,
                    profile_id,
                )
            store.complete_phase(VSCODE_CONNECTION_PHASE)
            reports.append(report)
            reports.append(_cleanup_logs(source_roots))
        finally:
            if staging_directory is not None:
                shutil.rmtree(staging_directory, ignore_errors=True)

    return reports
