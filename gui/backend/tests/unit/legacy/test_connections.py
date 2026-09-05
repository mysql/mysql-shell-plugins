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

import uuid

import pytest

from gui_plugin.core.Db import BackendDatabase, BackendTransaction
from gui_plugin.db_connections import DbConnections
from gui_plugin.legacy.connections import (
    connection_fingerprint,
    merge_connections,
    validate_profile_for_session,
)
from gui_plugin.users import UserManagement


@pytest.fixture
def profile_id():
    user_name = f"legacy_connections_{uuid.uuid4().hex}"
    user_id = UserManagement.create_user(user_name, "unused", role="User")
    created_profile_id = UserManagement.add_profile(
        user_id,
        {
            "name": "Legacy connection test profile",
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


def connection(**options):
    return {
        "db_type": "MySQL",
        "caption": "Ignored",
        "description": "Ignored",
        "options": options,
        "settings": {"serverStatusCache": {"hostname": "ignored"}},
    }


def test_connection_fingerprint_uses_the_exact_stored_definition():
    first = connection(host="DB.EXAMPLE.")
    second = connection(host="db.example", port=3306)

    assert connection_fingerprint(first) != connection_fingerprint(second)


def test_profile_must_belong_to_authenticated_session_user():
    class FakeDb:
        _session_uuid = "session-1"

        def select(self, statement, _parameters):
            if "FROM profile" in statement:
                return [{"user_id": 7}]

            return [{"user_id": 8}]

    with pytest.raises(ValueError, match="authenticated session user"):
        validate_profile_for_session(FakeDb(), 42)


def test_equivalent_existing_connection_is_not_merged(profile_id):
    target_id = DbConnections.add_db_connection(
        profile_id,
        {
            "db_type": "MySQL",
            "caption": "Mine",
            "description": "Existing",
            "options": {
                "scheme": "mysql",
                "user": "scott",
                "host": "db.example",
            },
            "settings": {},
        },
    )[0]
    try:
        with BackendDatabase() as db:
            with BackendTransaction(db):
                result = merge_connections(
                    db,
                    profile_id,
                    "classic-workbench",
                    [
                        {
                            "db_type": "MySQL",
                            "caption": "Legacy",
                            "description": "Legacy",
                            "options": {
                                "scheme": "mysql",
                                "user": "scott",
                                "host": "DB.EXAMPLE",
                                "port": 3306,
                            },
                            "settings": {},
                        }
                    ],
                )

        with BackendDatabase() as db:
            connections = db.select(
                """SELECT db_connection_id
                FROM profile_has_db_connection
                WHERE profile_id=?""",
                (profile_id,),
            )
        assert result["merged"] == 0
        assert result["imported"] == 1
        assert len(connections) == 2
    finally:
        DbConnections.remove_db_connection(profile_id, target_id)


def test_same_caption_different_endpoint_keeps_both_in_source_folder(profile_id):
    existing_id = DbConnections.add_db_connection(
        profile_id,
        {
            "db_type": "MySQL",
            "caption": "Production",
            "description": "",
            "options": {
                "scheme": "mysql",
                "host": "one.example",
            },
            "settings": {},
        },
    )[0]
    imported_id = None
    try:
        mappings = {}
        with BackendDatabase() as db:
            with BackendTransaction(db):
                result = merge_connections(
                    db,
                    profile_id,
                    "classic-workbench",
                    [
                        {
                            "db_type": "MySQL",
                            "caption": "Production",
                            "description": "",
                            "options": {
                                "scheme": "mysql",
                                "host": "two.example",
                            },
                            "settings": {},
                        }
                    ],
                    mappings,
                )
            imported_id = next(iter(mappings.values()))["targetConnectionId"]
            folder = db.select(
                """SELECT fp.caption
                FROM profile_has_db_connection phdc
                JOIN folder_path fp ON fp.id=phdc.folder_path_id
                WHERE phdc.profile_id=? AND phdc.db_connection_id=?""",
                (profile_id, imported_id),
            )[0]

        assert result["imported"] == 1
        assert result["merged"] == 0
        assert folder["caption"] == "Imported from MySQL Workbench"
    finally:
        if imported_id is not None:
            DbConnections.remove_db_connection(profile_id, imported_id)
        DbConnections.remove_db_connection(profile_id, existing_id)


def test_retry_uses_the_mapping_from_the_same_source(profile_id):
    imported_id = None
    legacy_connection = {
        "db_type": "MySQL",
        "caption": "Recovered",
        "description": "",
        "options": {
            "scheme": "mysql",
            "host": "recovered.example",
        },
        "settings": {},
    }
    try:
        first_mappings = {}
        with BackendDatabase() as db:
            with BackendTransaction(db):
                merge_connections(
                    db,
                    profile_id,
                    "classic-workbench",
                    [legacy_connection],
                    first_mappings,
                )
            imported_id = next(iter(first_mappings.values()))[
                "targetConnectionId"
            ]

            with BackendTransaction(db):
                result = merge_connections(
                    db,
                    profile_id,
                    "classic-workbench",
                    [legacy_connection],
                    first_mappings,
                )

        retry_mapping = next(iter(first_mappings.values()))
        assert result["merged"] == 1
        assert retry_mapping["targetConnectionId"] == imported_id
    finally:
        if imported_id is not None:
            DbConnections.remove_db_connection(profile_id, imported_id)
