# Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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
from gui_plugin.db_connections import DbConnections, InternalData
from gui_plugin.core.Db import GuiBackendDb
from gui_plugin.users import UserManagement
import config
import json
import pytest


def validate_response(response):
    assert response is not None
    assert isinstance(response, list)


def get_server_status_cache(connection_id, user_id=None):
    return InternalData.get_server_status_cache(connection_id, user_id)


def validate_rows(rows, validate_function):
    assert len(rows) > 0

    for row in rows:
        validate_function(row)


def validate_connection_row(row):
    assert "id" in row
    assert "folder_path_id" in row
    assert "caption" in row
    assert "description" in row
    assert "db_type" in row

    assert isinstance(row["id"], int)
    assert row["id"] > 0

    assert isinstance(row["folder_path_id"], int)
    assert isinstance(row["caption"], str)
    assert isinstance(row["description"], str)

    assert isinstance(row["db_type"], str)
    assert row["db_type"] in ["MySQL", "Sqlite"]


def validate_db_type_row(type):
    assert isinstance(type, str)
    assert type in ("MySQL", "Sqlite")


class FakeServerVariablesResult:
    def __init__(self, rows):
        self.rows = iter(rows)

    def fetch_one(self):
        return next(self.rows, None)


class FakeServiceSession:
    database_type = "MySQL"

    def __init__(self, rows, connection_options=None):
        self.rows = rows
        self.lock_count = 0
        self.release_count = 0
        self.connection_options = connection_options or {
            "host": "localhost",
            "port": 3306,
        }

    def run_sql(self, sql):
        assert sql.startswith("SHOW GLOBAL VARIABLES WHERE Variable_name IN (")

        return FakeServerVariablesResult(self.rows)

    def lock(self):
        self.lock_count += 1

    def release(self):
        self.release_count += 1


def test_connection_tags_round_trip_with_connection_data():
    user_name = "test_connection_tags_user"
    user_id = UserManagement.create_user(user_name, "user1", role="User")
    assert user_id > 0
    profile = {
        "name": "Connection tags test profile",
        "description": "Profile for connection tags tests.",
        "options": {},
    }
    profile_id = UserManagement.add_profile(user_id, profile)
    assert profile_id > 0

    connection_ids = []
    try:
        DbConnections.update_connection_tags(
            profile_id,
            {
                "DEV": "#c2410c",
                "QA": "#1d4ed8",
            },
        )
        assert DbConnections.list_connection_tags(profile_id) == {
            "DEV": "#c2410c",
            "QA": "#1d4ed8",
        }

        result = DbConnections.add_db_connection(
            profile_id,
            {
                "db_type": "Sqlite",
                "caption": "Tagged sqlite database",
                "description": "Tagged sqlite database description",
                "options": {"db_file": "tests.sqlite3"},
                "settings": {"defaultEditor": "DB Notebook"},
                "tags": ["DEV", "QA"],
            },
        )
        connection_ids.append(result[0])

        result = DbConnections.add_db_connection(
            profile_id,
            {
                "db_type": "Sqlite",
                "caption": "Second tagged sqlite database",
                "description": "Second tagged sqlite database description",
                "options": {"db_file": "tests.sqlite3"},
                "settings": {"defaultEditor": "DB Notebook"},
                "tags": ["DEV", "QA"],
            },
        )
        connection_ids.append(result[0])

        latest = DbConnections.get_db_connection(connection_ids[0], profile_id)
        assert latest["tags"] == ["DEV", "QA"]
        assert latest["settings"]["defaultEditor"] == "DB Notebook"

        listed = DbConnections.list_db_connections(profile_id)
        listed_connection = next(item for item in listed if item["id"] == connection_ids[0])
        assert listed_connection["tags"] == ["DEV", "QA"]
        assert listed_connection["settings"]["defaultEditor"] == "DB Notebook"

        listed_all = DbConnections.list_all(profile_id)
        listed_all_connection = next(
            item for item in listed_all if item["type"] == "connection"
            and item["id"] == connection_ids[0]
        )
        assert listed_all_connection["tags"] == ["DEV", "QA"]

        DbConnections.update_db_connection(
            profile_id,
            connection_ids[0],
            {"tags": None},
        )
        latest = DbConnections.get_db_connection(connection_ids[0], profile_id)
        assert latest["tags"] == ["DEV", "QA"]

        DbConnections.update_db_connection(
            profile_id,
            connection_ids[0],
            {
                "settings": {"defaultEditor": "DB Script"},
                "tags": ["QA"],
            },
        )
        latest = DbConnections.get_db_connection(connection_ids[0], profile_id)
        assert latest["tags"] == ["QA"]
        assert latest["settings"]["defaultEditor"] == "DB Script"

        DbConnections.update_connection_tags(profile_id, {"QA": "#1d4ed8"})
        for connection_id in connection_ids:
            latest = DbConnections.get_db_connection(connection_id, profile_id)
            assert latest["tags"] == ["QA"]

        DbConnections.update_db_connection(
            profile_id,
            connection_ids[0],
            {"tags": []},
        )
        latest = DbConnections.get_db_connection(connection_ids[0], profile_id)
        assert latest["tags"] == []
    finally:
        for connection_id in connection_ids:
            DbConnections.remove_db_connection(profile_id, connection_id)
        DbConnections.update_connection_tags(profile_id, {})
        UserManagement.delete_profile(user_id, profile_id)

        groups = UserManagement.list_user_groups(user_id)
        for group in groups:
            group_id = group["id"]
            if group["name"] != user_name:
                UserManagement.remove_user_from_group(user_id, group_id)
                if group_id != 1:
                    UserManagement.remove_user_group(group_id)
        UserManagement.delete_user(user_name)


def test_db_types():
    results = DbConnections.get_db_types()

    validate_response(results)
    validate_rows(results, validate_db_type_row)


def validate_connections_sort_order(connections, expected):
    i = 0
    for conn in connections:
        assert conn["caption"] == expected[i]["caption"]
        assert conn["index"] > 0 and conn["index"] <= len(connections)
        assert conn["index"] == expected[i]["index"]
        i += 1


class TestDbConnectionsSqlite:
    def test_add_db_connection(self):
        results1 = DbConnections.list_db_connections(1)

        result = DbConnections.add_db_connection(
            1,
            {
                "db_type": "Sqlite",
                "caption": "This is a test sqlite3 database",
                "description": "This is a test sqlite3 database description",
                "options": {
                    "db_file": "tests.sqlite3",
                    "attach": {
                        "database_name": "testdb1",
                        "db_file": "tests.attachment.sqlite3",
                    },
                },
            },
        )

        results2 = DbConnections.list_db_connections(1)

        validate_response(results2)
        validate_rows(results2, validate_connection_row)

        assert len(results2) == len(results1) + 1

        DbConnections.remove_db_connection(1, result[0])
        results3 = DbConnections.list_db_connections(1)

        assert len(results3) == len(results1)

    def test_update_db_connection(self):
        result = DbConnections.add_db_connection(
            1,
            {
                "db_type": "Sqlite",
                "caption": "This is a test sqlite3 database",
                "description": "This is a test sqlite3 database description",
                "options": {"db_file": "tests.sqlite3"},
            },
        )

        connection_id = result[0]

        DbConnections.update_db_connection(
            1, connection_id, {"caption": "Altered caption"}
        )
        latest = DbConnections.get_db_connection(connection_id)

        assert latest["caption"] == "Altered caption"
        assert latest["description"] == "This is a test sqlite3 database description"
        assert latest["options"] == {"db_file": "tests.sqlite3"}

        DbConnections.update_db_connection(
            1, connection_id, {"description": "Altered description"}
        )
        latest = DbConnections.get_db_connection(connection_id)

        assert latest["caption"] == "Altered caption"
        assert latest["description"] == "Altered description"
        assert latest["options"] == {"db_file": "tests.sqlite3"}

        DbConnections.update_db_connection(
            1, connection_id, {"options": {"item": "empty"}}
        )
        latest = DbConnections.get_db_connection(connection_id)

        assert latest["caption"] == "Altered caption"
        assert latest["description"] == "Altered description"
        assert latest["options"] == {"item": "empty"}

    def test_server_status_cache_is_backend_owned(self):
        result = DbConnections.add_db_connection(
            1,
            {
                "db_type": "Sqlite",
                "caption": "This is a test sqlite3 database",
                "description": "This is a test sqlite3 database description",
                "options": {"host": "localhost", "port": 3306},
                "settings": {
                    "defaultEditor": "DB Notebook",
                    "serverStatusCache": {
                        "sysvars": [{"name": "log_error", "value": "/tmp/untrusted"}],
                    },
                },
                "internal_data": {
                    "serverStatusCache": {
                        "sysvars": [{"name": "log_error", "value": "/tmp/untrusted"}],
                    },
                },
            },
        )
        connection_id = result[0]
        assert get_server_status_cache(connection_id) is None

        service_session = FakeServiceSession([
            ("hostname", "localhost"),
            ("datadir", "/usr/local/mysql/data"),
            ("log_error", "mysqld.err"),
            ("log_error_services", "log_filter_internal; log_sink_internal"),
            ("server_id", "42"),
            ("server_uuid", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
        ])
        DbConnections.refresh_server_status_cache(connection_id, service_session)

        cache = get_server_status_cache(connection_id)
        latest = DbConnections.get_db_connection(connection_id)

        assert cache["updatedAt"]
        assert cache["isLocal"] is True
        assert cache["sysvars"] == [
            {"name": "hostname", "value": "localhost"},
            {"name": "datadir", "value": "/usr/local/mysql/data"},
            {"name": "log_error", "value": "mysqld.err"},
            {
                "name": "log_error_services",
                "value": "log_filter_internal; log_sink_internal",
            },
            {"name": "server_id", "value": "42"},
            {
                "name": "server_uuid",
                "value": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            },
        ]
        assert service_session.lock_count == 1
        assert service_session.release_count == 1
        assert latest == {
            "id": connection_id,
            "db_type": "Sqlite",
            "caption": "This is a test sqlite3 database",
            "description": "This is a test sqlite3 database description",
            "options": {"host": "localhost", "port": 3306},
            "settings": {"defaultEditor": "DB Notebook"},
        }

    def test_server_status_cache_requires_profile_ownership(self):
        owner_id = UserManagement.create_user(
            "server_status_cache_owner", "password", role="User",
        )
        owner_profile_id = UserManagement.add_profile(owner_id, {
            "name": "Owner profile",
            "description": "Owns the cached connection.",
            "options": {},
        })
        other_user_id = UserManagement.create_user(
            "server_status_cache_other_user", "password", role="User",
        )
        UserManagement.add_profile(other_user_id, {
            "name": "Other profile",
            "description": "Must not read the cached connection.",
            "options": {},
        })
        connection_id = DbConnections.add_db_connection(
            owner_profile_id,
            {
                "db_type": "MySQL",
                "caption": "Cached MySQL connection",
                "description": "Cached MySQL connection",
                "options": {"host": "localhost", "port": 3306},
                "settings": {},
            },
        )[0]
        DbConnections.refresh_server_status_cache(
            connection_id,
            FakeServiceSession([("log_error", "mysqld.err")]),
        )

        assert get_server_status_cache(
            connection_id, user_id=owner_id,
        ) is not None
        assert get_server_status_cache(
            connection_id, user_id=other_user_id,
        ) is None

        DbConnections.remove_db_connection(1, connection_id)

    def test_server_status_cache_is_not_written_after_endpoint_changes(self):
        old_options = {"host": "old-host", "port": 3306}
        connection_id = DbConnections.add_db_connection(
            1,
            {
                "db_type": "MySQL",
                "caption": "Cached MySQL connection",
                "description": "Cached MySQL connection",
                "options": old_options,
            },
        )[0]
        service_session = FakeServiceSession(
            [("log_error", "mysqld.err")], old_options,
        )

        DbConnections.update_db_connection(
            1, connection_id, {"options": {"host": "new-host", "port": 3306}},
        )
        DbConnections.refresh_server_status_cache(
            connection_id, service_session,
        )

        assert get_server_status_cache(connection_id) is None
        DbConnections.remove_db_connection(1, connection_id)

    def test_server_status_cache_is_invalidated_with_connection_options(self):
        result = DbConnections.add_db_connection(
            1,
            {
                "db_type": "Sqlite",
                "caption": "This is a test sqlite3 database",
                "description": "This is a test sqlite3 database description",
                "options": {"host": "localhost", "port": 3306},
            },
        )
        connection_id = result[0]

        DbConnections.refresh_server_status_cache(
            connection_id,
            FakeServiceSession([("hostname", "localhost")]),
        )
        assert get_server_status_cache(connection_id) is not None

        DbConnections.update_db_connection(
            1,
            connection_id,
            {"options": {"host": "other-host", "port": 3306}},
        )
        assert get_server_status_cache(connection_id) is None

        DbConnections.remove_db_connection(1, connection_id)

    def test_server_status_cache_is_invalidated_with_database_type(self):
        result = DbConnections.add_db_connection(
            1,
            {
                "db_type": "Sqlite",
                "caption": "This is a test sqlite3 database",
                "description": "This is a test sqlite3 database description",
                "options": {"host": "localhost", "port": 3306},
            },
        )
        connection_id = result[0]

        DbConnections.refresh_server_status_cache(
            connection_id,
            FakeServiceSession([("hostname", "localhost")]),
        )
        assert get_server_status_cache(connection_id) is not None

        DbConnections.update_db_connection(
            1,
            connection_id,
            {"db_type": "MySQL"},
        )

        assert get_server_status_cache(connection_id) is None

        DbConnections.remove_db_connection(1, connection_id)

    def test_server_status_cache_is_preserved_with_unchanged_identity(self):
        options = {"host": "localhost", "port": 3306}
        result = DbConnections.add_db_connection(
            1,
            {
                "db_type": "Sqlite",
                "caption": "This is a test sqlite3 database",
                "description": "This is a test sqlite3 database description",
                "options": options,
            },
        )
        connection_id = result[0]

        DbConnections.refresh_server_status_cache(
            connection_id,
            FakeServiceSession([("hostname", "localhost")]),
        )

        DbConnections.update_db_connection(
            1,
            connection_id,
            {
                "db_type": "Sqlite",
                "caption": "Renamed sqlite database",
                "description": "Updated description",
                "options": options,
                "settings": {},
                "tags": None,
            },
        )

        assert get_server_status_cache(connection_id) is not None

        DbConnections.remove_db_connection(1, connection_id)

    def test_server_status_cache_missing_and_malformed_internal_data(self):
        result = DbConnections.add_db_connection(
            1,
            {
                "db_type": "Sqlite",
                "caption": "This is a test sqlite3 database",
                "description": "This is a test sqlite3 database description",
                "options": {"db_file": "tests.sqlite3"},
            },
        )
        connection_id = result[0]

        assert (
            get_server_status_cache(connection_id)
            is None
        )

        db = GuiBackendDb()
        db.execute(
            "UPDATE db_connection SET internal_data=? WHERE id=?",
            (json.dumps("invalid"), connection_id),
        )
        db.close()

        assert (
            get_server_status_cache(connection_id)
            is None
        )

        DbConnections.remove_db_connection(1, connection_id)


class TestDbConnectionMySQL:

    def test_remove_db_connection_deletes_credential(self, monkeypatch):
        default_root_config = config.Config.get_instance().database_connections[0]
        deleted_credentials = []
        monkeypatch.setattr(
            DbConnections,
            "delete_credential",
            lambda url: deleted_credentials.append(url),
        )

        result = DbConnections.add_db_connection(
            1,
            {
                "db_type": default_root_config["type"],
                "caption": "Connection credential deletion test",
                "description": "Connection credential deletion test",
                "options": default_root_config["options"],
            },
        )

        try:
            DbConnections.remove_db_connection(1, result[0])
        finally:
            if result[0] in [row["id"] for row in DbConnections.list_db_connections(1)]:
                DbConnections.remove_db_connection(1, result[0])

        options = default_root_config["options"]
        target = options.get("socket") or f"{options['host']}:{options['port']}"
        assert deleted_credentials == [f"{options['user']}@{target}"]

    def test_add_db_connection_mysql(self):
        results1 = DbConnections.list_db_connections(1)
        default_root_config = config.Config.get_instance().database_connections[0]

        result = DbConnections.add_db_connection(
            1,
            {
                "db_type": default_root_config["type"],
                "caption": "This is a test MySQL database",
                "description": "This is a test MySQL database description",
                "options": {
                    "host": default_root_config["options"]["host"],
                    "port": default_root_config["options"]["port"],
                    "user": default_root_config["options"]["user"],
                    "password": default_root_config["options"]["password"],
                    "scheme": default_root_config["options"]["scheme"],
                },
            },
        )

        results2 = DbConnections.list_db_connections(1)

        validate_response(results2)
        validate_rows(results2, validate_connection_row)

        assert len(results2) == len(results1) + 1

        DbConnections.remove_db_connection(1, result[0])
        results3 = DbConnections.list_db_connections(1)

        assert len(results3) == len(results1)

    def test_add_wrong_db_connection_mysql(self):
        default_root_config = config.Config.get_instance().database_connections[0]

        with pytest.raises(Exception) as exp:
            _ = DbConnections.add_db_connection(
                1,
                {
                    "caption": "This is a test MySQL database",
                    "description": "This is a test MySQL database description",
                    "options": {
                        "host": default_root_config["options"]["host"],
                        "port": default_root_config["options"]["port"],
                        "user": default_root_config["options"]["user"],
                        "password": default_root_config["options"]["password"],
                        "scheme": default_root_config["options"]["scheme"],
                    },
                },
            )

        assert (
            str(exp.value)
            == "Error[MSG-1012]: The connection must contain valid database type."
        )

        with pytest.raises(Exception) as exp:
            _ = DbConnections.add_db_connection(
                1,
                {
                    "db_type": "MSyQL",
                    "caption": "This is a test MySQL database",
                    "description": "This is a test MySQL database description",
                    "options": {
                        "host": default_root_config["options"]["host"],
                        "port": default_root_config["options"]["port"],
                        "user": default_root_config["options"]["user"],
                        "password": default_root_config["options"]["password"],
                        "scheme": default_root_config["options"]["scheme"],
                    },
                },
            )

        assert (
            str(exp.value)
            == "Error[MSG-1012]: The connection must contain valid database type."
        )

        with pytest.raises(Exception) as exp:
            _ = DbConnections.add_db_connection(
                1,
                {
                    "db_type": default_root_config["type"],
                    "description": "This is a test MySQL database description",
                    "options": {
                        "host": default_root_config["options"]["host"],
                        "port": default_root_config["options"]["port"],
                        "user": default_root_config["options"]["user"],
                        "password": default_root_config["options"]["password"],
                        "scheme": default_root_config["options"]["scheme"],
                    },
                },
            )

        assert (
            str(exp.value)
            == "Error[MSG-1012]: The connection must contain valid caption."
        )

    def test_sort_connection_mysql(self):
        default_root_config = config.Config.get_instance().database_connections[0]
        user_name = "test_sort_user"
        user_id = UserManagement.create_user(user_name, "user1", role="User")
        assert user_id > 0
        profile = {
            "name": "New test profile",
            "description": "Profile description.",
            "options": {},
        }

        profile_id = UserManagement.add_profile(user_id, profile)
        assert profile_id > 0

        result = DbConnections.add_db_connection(
            profile_id,
            {
                "db_type": default_root_config["type"],
                "caption": "This is a test MySQL database 1",
                "description": "This is a test MySQL database description 1",
                "options": {
                    "host": default_root_config["options"]["host"],
                    "port": default_root_config["options"]["port"],
                    "user": default_root_config["options"]["user"],
                    "password": default_root_config["options"]["password"],
                    "scheme": default_root_config["options"]["scheme"],
                },
            },
            "sort_tests",
        )
        conn1_id = result[0]

        result = DbConnections.add_db_connection(
            profile_id,
            {
                "db_type": default_root_config["type"],
                "caption": "This is a test MySQL database 2",
                "description": "This is a test MySQL database description 2",
                "options": {
                    "host": default_root_config["options"]["host"],
                    "port": default_root_config["options"]["port"],
                    "user": default_root_config["options"]["user"],
                    "password": default_root_config["options"]["password"],
                    "scheme": default_root_config["options"]["scheme"],
                },
            },
            "sort_tests",
        )
        conn2_id = result[0]

        result = DbConnections.add_db_connection(
            profile_id,
            {
                "db_type": default_root_config["type"],
                "caption": "This is a test MySQL database 3",
                "description": "This is a test MySQL database description 3",
                "options": {
                    "host": default_root_config["options"]["host"],
                    "port": default_root_config["options"]["port"],
                    "user": default_root_config["options"]["user"],
                    "password": default_root_config["options"]["password"],
                    "scheme": default_root_config["options"]["scheme"],
                },
            },
            "sort_tests",
        )
        conn3_id = result[0]

        result = DbConnections.add_db_connection(
            profile_id,
            {
                "db_type": default_root_config["type"],
                "caption": "This is a test MySQL database 4",
                "description": "This is a test MySQL database description 4",
                "options": {
                    "host": default_root_config["options"]["host"],
                    "port": default_root_config["options"]["port"],
                    "user": default_root_config["options"]["user"],
                    "password": default_root_config["options"]["password"],
                    "scheme": default_root_config["options"]["scheme"],
                },
            },
            "sort_tests",
        )
        conn4_id = result[0]

        # Before moving
        db_connections = DbConnections.list_db_connections(profile_id, "sort_tests")
        validate_connections_sort_order(
            db_connections,
            [
                {"caption": "This is a test MySQL database 1", "index": 1},
                {"caption": "This is a test MySQL database 2", "index": 2},
                {"caption": "This is a test MySQL database 3", "index": 3},
                {"caption": "This is a test MySQL database 4", "index": 4},
            ],
        )

        # Move 3 before 1
        status = DbConnections.move_connection(
            profile_id, "sort_tests", conn3_id, conn1_id, True
        )
        assert status is None

        db_connections = DbConnections.list_db_connections(profile_id, "sort_tests")
        validate_connections_sort_order(
            db_connections,
            [
                {"caption": "This is a test MySQL database 1", "index": 2},
                {"caption": "This is a test MySQL database 2", "index": 3},
                {"caption": "This is a test MySQL database 3", "index": 1},
                {"caption": "This is a test MySQL database 4", "index": 4},
            ],
        )

        # Move 3 after 1
        status = DbConnections.move_connection(
            profile_id, "sort_tests", conn3_id, conn1_id, False
        )
        assert status is None

        db_connections = DbConnections.list_db_connections(profile_id, "sort_tests")
        validate_connections_sort_order(
            db_connections,
            [
                {"caption": "This is a test MySQL database 1", "index": 1},
                {"caption": "This is a test MySQL database 2", "index": 3},
                {"caption": "This is a test MySQL database 3", "index": 2},
                {"caption": "This is a test MySQL database 4", "index": 4},
            ],
        )

        # Move 4 before 2
        status = DbConnections.move_connection(
            profile_id, "sort_tests", conn4_id, conn2_id, True
        )
        assert status is None

        db_connections = DbConnections.list_db_connections(profile_id, "sort_tests")
        validate_connections_sort_order(
            db_connections,
            [
                {"caption": "This is a test MySQL database 1", "index": 1},
                {"caption": "This is a test MySQL database 2", "index": 4},
                {"caption": "This is a test MySQL database 3", "index": 2},
                {"caption": "This is a test MySQL database 4", "index": 3},
            ],
        )

        # Move 4 after 2
        status = DbConnections.move_connection(
            profile_id, "sort_tests", conn4_id, conn2_id, False
        )
        assert status is None

        db_connections = DbConnections.list_db_connections(profile_id, "sort_tests")
        validate_connections_sort_order(
            db_connections,
            [
                {"caption": "This is a test MySQL database 1", "index": 1},
                {"caption": "This is a test MySQL database 2", "index": 3},
                {"caption": "This is a test MySQL database 3", "index": 2},
                {"caption": "This is a test MySQL database 4", "index": 4},
            ],
        )

        # Move 2 before 3
        status = DbConnections.move_connection(
            profile_id, "sort_tests", conn2_id, conn3_id, True
        )
        assert status is None

        db_connections = DbConnections.list_db_connections(profile_id, "sort_tests")
        validate_connections_sort_order(
            db_connections,
            [
                {"caption": "This is a test MySQL database 1", "index": 1},
                {"caption": "This is a test MySQL database 2", "index": 2},
                {"caption": "This is a test MySQL database 3", "index": 3},
                {"caption": "This is a test MySQL database 4", "index": 4},
            ],
        )

        # Move 2 before 4
        status = DbConnections.move_connection(
            profile_id, "sort_tests", conn2_id, conn4_id, True
        )
        assert status is None

        db_connections = DbConnections.list_db_connections(profile_id, "sort_tests")
        validate_connections_sort_order(
            db_connections,
            [
                {"caption": "This is a test MySQL database 1", "index": 1},
                {"caption": "This is a test MySQL database 2", "index": 3},
                {"caption": "This is a test MySQL database 3", "index": 2},
                {"caption": "This is a test MySQL database 4", "index": 4},
            ],
        )

        # Move 2 after 4
        status = DbConnections.move_connection(
            profile_id, "sort_tests", conn2_id, conn4_id, False
        )
        assert status is None

        db_connections = DbConnections.list_db_connections(profile_id, "sort_tests")
        validate_connections_sort_order(
            db_connections,
            [
                {"caption": "This is a test MySQL database 1", "index": 1},
                {"caption": "This is a test MySQL database 2", "index": 4},
                {"caption": "This is a test MySQL database 3", "index": 2},
                {"caption": "This is a test MySQL database 4", "index": 3},
            ],
        )

        # Move 1 before 4
        status = DbConnections.move_connection(
            profile_id, "sort_tests", conn1_id, conn4_id, True
        )
        assert status is None

        db_connections = DbConnections.list_db_connections(profile_id, "sort_tests")
        validate_connections_sort_order(
            db_connections,
            [
                {"caption": "This is a test MySQL database 1", "index": 2},
                {"caption": "This is a test MySQL database 2", "index": 4},
                {"caption": "This is a test MySQL database 3", "index": 1},
                {"caption": "This is a test MySQL database 4", "index": 3},
            ],
        )

        # Move 1 after 4
        status = DbConnections.move_connection(
            profile_id, "sort_tests", conn1_id, conn4_id, False
        )
        assert status is None

        db_connections = DbConnections.list_db_connections(profile_id, "sort_tests")
        validate_connections_sort_order(
            db_connections,
            [
                {"caption": "This is a test MySQL database 1", "index": 3},
                {"caption": "This is a test MySQL database 2", "index": 4},
                {"caption": "This is a test MySQL database 3", "index": 1},
                {"caption": "This is a test MySQL database 4", "index": 2},
            ],
        )

        # Move 3 before 4
        status = DbConnections.move_connection(
            profile_id, "sort_tests", conn3_id, conn4_id, True
        )
        assert status is None

        db_connections = DbConnections.list_db_connections(profile_id, "sort_tests")
        validate_connections_sort_order(
            db_connections,
            [
                {"caption": "This is a test MySQL database 1", "index": 3},
                {"caption": "This is a test MySQL database 2", "index": 4},
                {"caption": "This is a test MySQL database 3", "index": 1},
                {"caption": "This is a test MySQL database 4", "index": 2},
            ],
        )

        # Move 4 after 3
        status = DbConnections.move_connection(
            profile_id, "sort_tests", conn4_id, conn3_id, False
        )
        assert status is None

        db_connections = DbConnections.list_db_connections(profile_id, "sort_tests")
        validate_connections_sort_order(
            db_connections,
            [
                {"caption": "This is a test MySQL database 1", "index": 3},
                {"caption": "This is a test MySQL database 2", "index": 4},
                {"caption": "This is a test MySQL database 3", "index": 1},
                {"caption": "This is a test MySQL database 4", "index": 2},
            ],
        )

        DbConnections.remove_db_connection(profile_id, conn1_id)
        DbConnections.remove_db_connection(profile_id, conn2_id)
        DbConnections.remove_db_connection(profile_id, conn3_id)
        DbConnections.remove_db_connection(profile_id, conn4_id)

        UserManagement.delete_profile(user_id, profile_id)

        groups = UserManagement.list_user_groups(user_id)
        for group in groups:
            group_id = group["id"]
            if group["name"] != "test_sort_user":
                UserManagement.remove_user_from_group(user_id, group_id)
                if group_id != 1:
                    UserManagement.remove_user_group(group_id)
        UserManagement.delete_user(user_name)
