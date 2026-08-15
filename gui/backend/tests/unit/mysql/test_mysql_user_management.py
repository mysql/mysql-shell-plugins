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

import pytest  # pyright: ignore[reportMissingImports] pylint: disable=import-error
import mysqlsh  # pyright: ignore[reportMissingImports] pylint: disable=import-error
from typing import Optional, cast

import gui_plugin.mysql.backend.user_management as user_management  # pylint: disable=import-error
from gui_plugin.mysql.backend.user_management import (  # pylint: disable=import-error
    LIST_USERS_QUERY,
    list_mysql_users,
    list_global_privilege_catalog,
    list_schema_privilege_catalog,
    list_object_privilege_schema_targets,
    list_authentication_plugins,
    get_create_user_defaults,
    list_user_global_privileges,
    list_user_schema_privileges,
    is_partial_revokes_enabled,
    set_user_global_privileges,
    set_user_object_privileges,
    set_granted_roles,
    get_mysql_user,
    create_mysql_user,
    delete_mysql_user,
    update_mysql_user,
)
from gui_plugin.mysql.backend.model import *  # pylint: disable=import-error
from gui_plugin.core.dbms.DbSession import DbSession


def object_privilege_target(
    kind: str = "",
    schema: str = "",
    object_name: Optional[str] = None,
    routine_type: Optional[str] = None,
    column: Optional[str] = None,
) -> ObjectPrivilegeTarget:
    return ObjectPrivilegeTarget(
        kind=kind,
        schema=schema,
        objectName=object_name,
        routineType=routine_type,
        column=column,
    )


class MockResultSet:
    data: list[dict]
    index: int = 0

    def __init__(self, data: dict | list[dict]):
        self.data = data if isinstance(data, list) else [data]

    def fetch_one_object(self):
        if self.index >= len(self.data):
            return None

        row = self.data[self.index]
        self.index += 1

        return row

    def get_columns(self):
        return []


class MockSession:
    sql: str = ""
    params: list = []
    result_set: Optional[MockResultSet] = None
    result_sets: Optional[list[MockResultSet]] = None
    history: list[tuple[str, list]] = []

    def __init__(
        self,
        result_set: Optional[MockResultSet | list[MockResultSet]] = None,
        data: Optional[dict] = None,
    ):
        if isinstance(result_set, list):
            self.result_sets = result_set
            self.result_set = None
        else:
            self.result_set = result_set
            self.result_sets = None
        self.history = []
        self.data = {} if data is None else data
        self.data_history: list[tuple] = []

    def run_sql(self, sql, params=None):
        params = params or []
        self.sql = sql
        self.params = params
        self.history.append((sql, params))

        if self.result_sets:
            return self.result_sets.pop(0)

        return self.result_set

    def set_data(self, option, value):
        self.data[option] = value
        self.data_history.append((option, value))


def test_list_mysql_users(session):
    session = session

    users = list_mysql_users(session)

    assert users


def test_list_mysql_users_includes_object_privilege_scopes():
    user = MySQLUserListItem(
        accountLocked=False,
        plugin="mysql_native_password",
        user="u",
        host="localhost",
        schemaPrivileges={"db1": ["SELECT"]},
        tablePrivileges=[
            MySQLTablePrivilege(schema="db1", table="t1", privileges=["INSERT"])
        ],
        columnPrivileges=[
            MySQLColumnPrivilege(
                schema="db1", table="t1", column="c1", privileges=["UPDATE"]
            )
        ],
        routinePrivileges=[
            MySQLRoutinePrivilege(
                schema="db1", routine="p1", routineType="PROCEDURE", privileges=["EXECUTE"]
            )
        ],
    )

    assert user.tablePrivileges == [
        MySQLTablePrivilege(schema="db1", table="t1", privileges=["INSERT"])
    ]
    assert user.columnPrivileges == [
        MySQLColumnPrivilege(
            schema="db1", table="t1", column="c1", privileges=["UPDATE"]
        )
    ]
    assert user.routinePrivileges == [
        MySQLRoutinePrivilege(
            schema="db1", routine="p1", routineType="PROCEDURE", privileges=["EXECUTE"]
        )
    ]
    assert "information_schema.`TABLE_PRIVILEGES`" in LIST_USERS_QUERY
    assert "information_schema.`COLUMN_PRIVILEGES`" in LIST_USERS_QUERY
    assert "information_schema.`USER_PRIVILEGES`" in LIST_USERS_QUERY
    assert "mysql.`procs_priv`" in LIST_USERS_QUERY
    assert "'routineType', r2.routine_type" in LIST_USERS_QUERY
    assert "global_privs_rows" not in LIST_USERS_QUERY
    assert "mysql.`global_grants`" not in LIST_USERS_QUERY
    assert "u.`User` AS `user`" in LIST_USERS_QUERY
    assert "u.`Host` AS `host`" in LIST_USERS_QUERY
    assert "CONCAT(u.`User`, '@', u.`Host`) AS `user`" not in LIST_USERS_QUERY
    assert "u.`password_expired` as passwordExpired" in LIST_USERS_QUERY
    assert "/*!90600 tal.`LOCKED` = 'YES', */" in LIST_USERS_QUERY
    assert (
        "/*!90600\nLEFT JOIN performance_schema.`temporary_account_locks` tal"
        in LIST_USERS_QUERY
    )
    assert "tal.`USER` = u.`User` AND tal.`HOST` = u.`Host`" in LIST_USERS_QUERY
    assert "u.`Host` = '%' AND u.`account_locked` = 'Y'" in LIST_USERS_QUERY
    assert "COALESCE(u.`authentication_string`, '') = '' AS isRole" in LIST_USERS_QUERY
    assert "AS tablePrivileges" in LIST_USERS_QUERY
    assert "AS columnPrivileges" in LIST_USERS_QUERY
    assert "AS routinePrivileges" in LIST_USERS_QUERY
    assert (
        "sa.`GRANTEE`   = CONCAT('''', u.`User`, '''@''', u.`Host`, '''')"
        in LIST_USERS_QUERY
    )
    assert (
        "ta.`GRANTEE`     = CONCAT('''', u.`User`, '''@''', u.`Host`, '''')"
        in LIST_USERS_QUERY
    )
    assert (
        "ca.`GRANTEE`    = CONCAT('''', u.`User`, '''@''', u.`Host`, '''')"
        in LIST_USERS_QUERY
    )
    assert (
        "ga.`GRANTEE`    = CONCAT('''', u.`User`, '''@''', u.`Host`, '''')"
        in LIST_USERS_QUERY
    )


class MockColumnType:
    data = "LONGLONG"


class MockColumn:
    def __init__(self, label: str):
        self.label = label

    def get_column_label(self):
        return self.label

    def get_type(self):
        return MockColumnType()


def test_convert_row_values_normalizes_is_role():
    assert (
        user_management._convert_row_values({"isRole": 1}, [MockColumn("isRole")])[
            "isRole"
        ]
        is True
    )
    assert (
        user_management._convert_row_values({"isRole": 0}, [MockColumn("isRole")])[
            "isRole"
        ]
        is False
    )


def test_convert_row_values_normalizes_temporary_account_lock():
    assert (
        user_management._convert_row_values(
            {"temporarilyLocked": 1}, [MockColumn("temporarilyLocked")]
        )["temporarilyLocked"]
        is True
    )
    assert (
        user_management._convert_row_values(
            {"temporarilyLocked": 0}, [MockColumn("temporarilyLocked")]
        )["temporarilyLocked"]
        is False
    )


def test_list_mysql_users_parses_partial_revoke_restrictions_as_stored():
    mock_session = MockSession(
        MockResultSet(
            {
                "accountLocked": False,
                "plugin": "caching_sha2_password",
                "user": "alice",
                "host": "localhost",
                "globalPrivileges": ["SELECT", "INSERT"],
                "roles": [],
                "schemaPrivileges": {},
                "tablePrivileges": {},
                "columnPrivileges": {},
                "routinePrivileges": {},
                "partialRevokes": [
                    {"Database": "mysql", "Privileges": ["select", " Insert "]},
                    {"Database": "ignored", "Privileges": []},
                ],
                "passwordExpiration": None,
                "sslOptions": None,
            }
        )
    )

    users = list_mysql_users(cast(DbSession, mock_session))

    assert users[0].partialRevokes == {
        "mysql": ["select", " Insert "],
        "ignored": [],
    }
    assert users[0].user == "alice"
    assert users[0].host == "localhost"
    assert "JSON_EXTRACT(u.`User_attributes`, '$.Restrictions')" in LIST_USERS_QUERY


def test_partial_revokes_query_is_version_gated():
    assert (
        "COALESCE(/*!80016 @@GLOBAL.partial_revokes, */ FALSE)"
        in user_management.PARTIAL_REVOKES_QUERY
    )


@pytest.mark.parametrize(
    "value, expected",
    [
        (1, True),
        ("1", True),
        ("ON", True),
        ("off", False),
        (0, False),
    ],
)
def test_is_partial_revokes_enabled_handles_values(value, expected):
    mock_session = MockSession(MockResultSet({"partialRevokes": value}))

    assert is_partial_revokes_enabled(cast(DbSession, mock_session)) is expected
    assert mock_session.history == [(user_management.PARTIAL_REVOKES_QUERY, [])]


def test_is_partial_revokes_enabled_returns_false_when_missing():
    class FailingSession(MockSession):
        def run_sql(self, sql, params=None):
            raise RuntimeError("unknown system variable")

    assert is_partial_revokes_enabled(cast(DbSession, FailingSession())) is False


def test_get_mysql_user(session):
    session = session

    users = list_mysql_users(session)

    assert users

    for user_item in users:
        user_details: Optional[MySQLUser] = get_mysql_user(
            session, user_item.user, user_item.host
        )

        assert user_details

        assert (user_details.user, user_details.host) == (
            user_item.user,
            user_item.host,
        )

    # test that TLS-details are sent back as UTF8
    # we are not interested in the result, only asserting that the SQL query
    # performs the necessary conversions, however, we need to provide a dummy
    # result set that fulfills all the requirements of the dataclass
    mock_result_set = MockResultSet(
        {
            "host": None,
            "user": None,
            "sslType": None,
            "sslCipher": None,
            "x509Issuer": None,
            "x509Subject": None,
            "maxQuestions": None,
            "maxUpdates": None,
            "maxConnections": None,
            "maxUserConnections": None,
            "plugin": None,
            "passwordExpire": None,
            "passwordLastChanged": None,
            "passwordLifetime": None,
            "accountLocked": None,
            "passwordReuseHistory": None,
            "passwordReuseInterval": None,
            "passwordRequireCurrent": None,
            "comment": None,
            "failedLoginAttempts": None,
            "passwordLockTime": None,
        }
    )
    mock_session = MockSession(mock_result_set)
    get_mysql_user(cast(DbSession, mock_session), "foo", "bar")
    assert (
        "NULLIF(CONVERT(ssl_cipher USING utf8mb4),  '') as sslCipher"
        in mock_session.sql
    )
    assert (
        "NULLIF(CONVERT(x509_issuer USING utf8mb4),  '') as x509Issuer"
        in mock_session.sql
    )
    assert (
        "NULLIF(CONVERT(x509_subject USING utf8mb4),  '') as x509Subject"
        in mock_session.sql
    )
    assert "JSON_EXTRACT(User_attributes, '$.metadata.comment')" in mock_session.sql
    assert (
        "JSON_EXTRACT(User_attributes, '$.Password_locking.failed_login_attempts')"
        in mock_session.sql
    )
    assert (
        "JSON_EXTRACT(User_attributes, '$.Password_locking.password_lock_time_days')"
        in mock_session.sql
    )


def test_get_mysql_user_returns_comment_and_password_locking_fields():
    mock_session = MockSession(
        MockResultSet(
            {
                "host": "%",
                "user": "user1",
                "comment": "Managed account",
                "failedLoginAttempts": 3,
                "passwordLockTime": 7,
            }
        )
    )

    user = get_mysql_user(cast(DbSession, mock_session), "user1", "%")

    assert user is not None
    assert user.comment == "Managed account"
    assert user.failedLoginAttempts == 3
    assert user.passwordLockTime == 7


def test_list_global_privilege_catalog_maps_show_privileges_metadata():
    mock_session = MockSession(
        MockResultSet(
            [
                {
                    "Privilege": "Select",
                    "Context": "Tables",
                    "Comment": "To retrieve rows",
                },
                {
                    "Privilege": " Create   role ",
                    "Context": "Server Admin",
                    "Comment": "To create new roles",
                },
                {
                    "Privilege": "BACKUP_ADMIN",
                    "Context": "Server Admin",
                    "Comment": "Backup operations",
                },
                {
                    "Privilege": "Grant option",
                    "Context": "Databases,Tables",
                    "Comment": "To give to other users",
                },
                {
                    "Privilege": "All",
                    "Context": "Server Admin",
                    "Comment": "All privileges",
                },
                {
                    "Privilege": "Proxy",
                    "Context": "Server Admin",
                    "Comment": "Proxy user",
                },
                {
                    "Privilege": "Usage",
                    "Context": "Server Admin",
                    "Comment": "No privileges",
                },
            ]
        )
    )

    privileges = list_global_privilege_catalog(cast(DbSession, mock_session))

    assert privileges == [
        MySQLGlobalPrivilegeCatalogItem(
            privilege="BACKUP_ADMIN",
            category="Server Admin",
            description="Backup operations",
        ),
        MySQLGlobalPrivilegeCatalogItem(
            privilege="CREATE ROLE",
            category="Server Admin",
            description="To create new roles",
        ),
        MySQLGlobalPrivilegeCatalogItem(
            privilege="SELECT",
            category="Tables",
            description="To retrieve rows",
        ),
    ]


def test_list_global_privilege_catalog_caches_show_privileges_result():
    mock_session = MockSession(
        MockResultSet(
            [
                {
                    "Privilege": "Select",
                    "Context": "Tables",
                    "Comment": "To retrieve rows",
                },
            ]
        )
    )

    first_result = list_global_privilege_catalog(cast(DbSession, mock_session))
    second_result = list_global_privilege_catalog(cast(DbSession, mock_session))

    assert second_result == first_result
    assert mock_session.history == [("SHOW PRIVILEGES", [])]
    assert mock_session.data_history == [("global_privilege_catalog", first_result)]


def test_list_schema_privilege_catalog_filters_database_scope():
    mock_session = MockSession(
        MockResultSet(
            [
                {
                    "Privilege": "Select",
                    "Context": "Tables",
                    "Comment": "To retrieve rows",
                },
                {
                    "Privilege": "Create",
                    "Context": "Databases,Tables,Indexes",
                    "Comment": "To create databases",
                },
                {
                    "Privilege": "Grant option",
                    "Context": "Databases,Tables",
                    "Comment": "To give to other users",
                },
                {
                    "Privilege": "Create routine",
                    "Context": "Databases",
                    "Comment": "To use CREATE FUNCTION/PROCEDURE",
                },
                {
                    "Privilege": "Shutdown",
                    "Context": "Server Admin",
                    "Comment": "To shutdown server",
                },
                {
                    "Privilege": "Usage",
                    "Context": "Server Admin",
                    "Comment": "No privileges",
                },
            ]
        )
    )

    privileges = list_schema_privilege_catalog(cast(DbSession, mock_session))

    assert privileges == [
        MySQLGlobalPrivilegeCatalogItem(
            privilege="CREATE",
            category="Databases,Tables,Indexes",
            description="To create databases",
        ),
        MySQLGlobalPrivilegeCatalogItem(
            privilege="CREATE ROUTINE",
            category="Databases",
            description="To use CREATE FUNCTION/PROCEDURE",
        ),
        MySQLGlobalPrivilegeCatalogItem(
            privilege="SELECT",
            category="Tables",
            description="To retrieve rows",
        ),
    ]
    assert mock_session.history == [("SHOW PRIVILEGES", [])]


def test_list_schema_privilege_catalog_uses_global_privilege_catalog_cache():
    cached_catalog = [
        MySQLGlobalPrivilegeCatalogItem(
            privilege="SELECT",
            category="Tables",
            description="To retrieve rows",
        ),
        MySQLGlobalPrivilegeCatalogItem(
            privilege="SHUTDOWN",
            category="Server Admin",
            description="To shut down the server",
        ),
    ]
    mock_session = MockSession(data={"global_privilege_catalog": cached_catalog})

    privileges = list_schema_privilege_catalog(cast(DbSession, mock_session))

    assert privileges == [cached_catalog[0]]
    assert mock_session.history == []
    assert mock_session.data_history == []


def test_list_object_privilege_schema_targets_returns_tables_and_routines():
    mock_session = MockSession(
        MockResultSet(
            [
                {"kind": "table", "objectName": "orders", "routineType": None},
                {"kind": "routine", "objectName": "refresh_orders", "routineType": "PROCEDURE"},
            ]
        )
    )

    targets = list_object_privilege_schema_targets(cast(DbSession, mock_session), "app")

    assert targets == [
        MySQLObjectPrivilegeSchemaTarget(kind="table", objectName="orders"),
        MySQLObjectPrivilegeSchemaTarget(
            kind="routine", objectName="refresh_orders", routineType="PROCEDURE"
        ),
    ]
    assert mock_session.history == [
        (
            """
SELECT 'table' AS kind, t.`TABLE_NAME` AS objectName, NULL AS routineType
FROM information_schema.`TABLES` t
WHERE t.`TABLE_SCHEMA` = ?
  AND t.`TABLE_TYPE` = 'BASE TABLE'
UNION ALL
SELECT 'routine' AS kind, r.`ROUTINE_NAME` AS objectName, r.`ROUTINE_TYPE` AS routineType
FROM information_schema.`ROUTINES` r
WHERE r.`ROUTINE_SCHEMA` = ?
ORDER BY kind, objectName
""",
            ["app", "app"],
        )
    ]


def test_list_authentication_plugins_queries_active_non_deprecated_authentication_plugins():
    mock_session = MockSession(
        MockResultSet(
            [
                {"pluginName": "caching_sha2_password"},
                {"pluginName": "mysql_native_password"},
            ]
        )
    )

    plugins = list_authentication_plugins(cast(DbSession, mock_session))

    assert plugins == [
        "caching_sha2_password",
        "mysql_native_password",
    ]
    assert mock_session.history == [
        (
            """
SELECT p.`PLUGIN_NAME` AS pluginName
FROM information_schema.`PLUGINS` p
WHERE p.`PLUGIN_TYPE` = 'AUTHENTICATION'
  AND p.`PLUGIN_STATUS` = 'ACTIVE'
  AND p.`PLUGIN_NAME` <> 'sha256_password'
ORDER BY p.`PLUGIN_NAME`
""",
            [],
        )
    ]


@pytest.mark.parametrize(
    ("password_require_current", "expected_password_require_current"),
    [(0, False), (1, True)],
)
def test_get_create_user_defaults_normalizes_password_require_current(
    password_require_current, expected_password_require_current
):
    mock_session = MockSession(
        MockResultSet(
            {
                "passwordLifetime": 90,
                "passwordReuseHistory": 5,
                "passwordReuseInterval": 30,
                "passwordRequireCurrent": password_require_current,
                "maxUserConnections": 12,
            }
        )
    )

    defaults = get_create_user_defaults(cast(DbSession, mock_session))

    assert defaults == MySQLDefaultUserOptions(
        passwordLifetime=90,
        passwordReuseHistory=5,
        passwordReuseInterval=30,
        passwordRequireCurrent=expected_password_require_current,
        maxUserConnections=12,
    )
    assert defaults.passwordRequireCurrent is expected_password_require_current
    assert mock_session.history == [
        (
            """
SELECT
  @@GLOBAL.default_password_lifetime AS passwordLifetime,
  @@GLOBAL.password_history AS passwordReuseHistory,
  @@GLOBAL.password_reuse_interval AS passwordReuseInterval,
  @@GLOBAL.password_require_current AS passwordRequireCurrent,
  @@GLOBAL.max_user_connections AS maxUserConnections
""",
            [],
        )
    ]


def test_list_user_global_privileges_returns_privilege_names_from_user_privileges():
    mock_session = MockSession(
        MockResultSet(
            [
                {"privilege": "SELECT"},
                {"privilege": "BACKUP_ADMIN"},
            ]
        )
    )

    privileges = list_user_global_privileges(
        cast(DbSession, mock_session), "alice", "localhost"
    )

    assert privileges == ["SELECT", "BACKUP_ADMIN"]
    assert "FROM information_schema.`USER_PRIVILEGES` up" in mock_session.sql
    assert "up.`PRIVILEGE_TYPE` <> 'USAGE'" in mock_session.sql
    assert "FROM mysql.`global_grants`" not in mock_session.sql
    assert "UNION" not in mock_session.sql
    assert mock_session.params == ["'alice'@'localhost'"]


def test_list_user_global_privileges_uses_mysql_account_quoting():
    mock_session = MockSession(MockResultSet([]))

    list_user_global_privileges(cast(DbSession, mock_session), r"a\b", "a'b")

    assert "up.`GRANTEE` = ?" in mock_session.sql
    assert mock_session.params == [r"'a\b'@'a'b'"]


def test_list_user_schema_privileges_reads_one_schema_as_stored():
    mock_session = MockSession(
        MockResultSet(
            [
                {"privilege": "select"},
                {"privilege": "Grant Option"},
            ]
        )
    )

    privileges = list_user_schema_privileges(
        cast(DbSession, mock_session), "alice", "localhost", "sakila"
    )

    assert privileges == ["select", "Grant Option"]
    assert "information_schema.`SCHEMA_PRIVILEGES`" in mock_session.sql
    assert "sp.`GRANTEE` = ?" in mock_session.sql
    assert "sp.`TABLE_SCHEMA` = ?" in mock_session.sql
    assert mock_session.params == ["'alice'@'localhost'", "sakila"]


def test_list_mysql_users_reads_roles_granted_to_each_user():
    assert (
        "CONCAT(re.`from_user`, '@', re.`from_host`) AS role"
        in user_management.LIST_USERS_QUERY
    )
    assert (
        "CONCAT(dr.`DEFAULT_ROLE_USER`, '@', dr.`DEFAULT_ROLE_HOST`) AS role"
        in user_management.LIST_USERS_QUERY
    )
    assert (
        "LEFT JOIN roles_agg  ra ON ra.`to_user` = u.`User` AND ra.`to_host` = u.`Host`"
        in user_management.LIST_USERS_QUERY
    )


def test_list_mysql_users_marks_only_x509_or_identity_tls_as_certificate():
    assert "WHEN u.`ssl_type` = 'X509'" in user_management.LIST_USERS_QUERY
    assert (
        "NULLIF(CONVERT(u.`x509_issuer` USING utf8mb4), '') IS NOT NULL"
        in user_management.LIST_USERS_QUERY
    )
    assert (
        "NULLIF(CONVERT(u.`x509_subject` USING utf8mb4), '') IS NOT NULL"
        in user_management.LIST_USERS_QUERY
    )


def test_set_user_global_privileges_adds_and_revokes():
    mock_session = MockSession(
        [
            MockResultSet(
                [
                    {"privilege": "SELECT"},
                    {"privilege": "DELETE"},
                ]
            ),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Tables",
                        "Comment": "To retrieve rows",
                    },
                    {
                        "Privilege": "INSERT",
                        "Context": "Tables",
                        "Comment": "To insert rows",
                    },
                    {
                        "Privilege": "DELETE",
                        "Context": "Tables",
                        "Comment": "To delete rows",
                    },
                ]
            ),
        ]
    )

    set_user_global_privileges(
        cast(DbSession, mock_session), "alice", "localhost", ["SELECT", "INSERT"]
    )

    assert mock_session.history[0][1] == ["'alice'@'localhost'"]
    assert mock_session.history[1] == ("SHOW PRIVILEGES", [])
    assert mock_session.history[2:] == [
        ("GRANT INSERT ON *.* TO ?@?", ["alice", "localhost"]),
        ("REVOKE DELETE ON *.* FROM ?@?", ["alice", "localhost"]),
    ]
    assert mock_session.data_history[0][0] == "global_privilege_catalog"


def test_set_user_global_privileges_ignores_cached_privileges():
    mock_session = MockSession(
        [
            MockResultSet(
                [
                    {"privilege": "SELECT"},
                    {"privilege": "DELETE"},
                ]
            ),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Tables",
                        "Comment": "To retrieve rows",
                    },
                    {
                        "Privilege": "INSERT",
                        "Context": "Tables",
                        "Comment": "To insert rows",
                    },
                    {
                        "Privilege": "DELETE",
                        "Context": "Tables",
                        "Comment": "To delete rows",
                    },
                ]
            ),
        ],
        data={"user_privileges": ["SELECT", "DELETE"]},
    )

    set_user_global_privileges(
        cast(DbSession, mock_session), "alice", "localhost", ["SELECT", "INSERT"]
    )

    assert mock_session.history == [
        (user_management.USER_GLOBAL_PRIVILEGES_QUERY, ["'alice'@'localhost'"]),
        ("SHOW PRIVILEGES", []),
        ("GRANT INSERT ON *.* TO ?@?", ["alice", "localhost"]),
        ("REVOKE DELETE ON *.* FROM ?@?", ["alice", "localhost"]),
    ]
    assert mock_session.data_history[0][0] == "global_privilege_catalog"


def test_set_user_global_privileges_does_not_cache_queried_privileges():
    mock_session = MockSession(
        [
            MockResultSet(
                [
                    {"privilege": "SELECT"},
                    {"privilege": "DELETE"},
                ]
            ),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Tables",
                        "Comment": "To retrieve rows",
                    },
                    {
                        "Privilege": "DELETE",
                        "Context": "Tables",
                        "Comment": "To delete rows",
                    },
                ]
            ),
        ]
    )

    set_user_global_privileges(
        cast(DbSession, mock_session), "alice", "localhost", ["SELECT"]
    )

    assert mock_session.history[0][1] == ["'alice'@'localhost'"]
    assert mock_session.history[1] == ("SHOW PRIVILEGES", [])
    assert "user_privileges" not in mock_session.data
    assert mock_session.data_history[0][0] == "global_privilege_catalog"


def test_set_user_global_privileges_requeries_after_direct_grant_then_revoke():
    mock_session = MockSession(
        [
            MockResultSet(
                [
                    {"privilege": "SELECT"},
                ]
            ),
            MockResultSet(
                [
                    {
                        "Privilege": "Select",
                        "Context": "Tables",
                        "Comment": "To retrieve rows",
                    },
                    {
                        "Privilege": "Insert",
                        "Context": "Tables",
                        "Comment": "To insert rows",
                    },
                ]
            ),
            MockResultSet([]),
            MockResultSet(
                [
                    {"privilege": "SELECT"},
                    {"privilege": "INSERT"},
                ]
            ),
        ]
    )

    set_user_global_privileges(
        cast(DbSession, mock_session), "alice", "localhost", ["SELECT", "INSERT"]
    )
    set_user_global_privileges(
        cast(DbSession, mock_session), "alice", "localhost", ["SELECT"]
    )

    assert mock_session.history == [
        (user_management.USER_GLOBAL_PRIVILEGES_QUERY, ["'alice'@'localhost'"]),
        ("SHOW PRIVILEGES", []),
        ("GRANT INSERT ON *.* TO ?@?", ["alice", "localhost"]),
        (user_management.USER_GLOBAL_PRIVILEGES_QUERY, ["'alice'@'localhost'"]),
        ("REVOKE INSERT ON *.* FROM ?@?", ["alice", "localhost"]),
    ]
    assert mock_session.data_history[0][0] == "global_privilege_catalog"


def test_set_user_global_privileges_rejects_new_grant_option_but_can_revoke_existing():
    grant_session = MockSession(
        [
            MockResultSet([]),
            MockResultSet(
                [
                    {
                        "Privilege": "GRANT OPTION",
                        "Context": "Databases,Tables",
                        "Comment": "To give to other users",
                    },
                ]
            ),
        ]
    )
    with pytest.raises(ValueError, match="Unknown global privilege\\(s\\): GRANT OPTION"):
        set_user_global_privileges(
            cast(DbSession, grant_session), "alice", "localhost", ["GRANT OPTION"]
        )

    assert len(grant_session.history) == 2

    revoke_session = MockSession(
        [
            MockResultSet(
                [
                    {"privilege": "GRANT OPTION"},
                ]
            ),
            MockResultSet(
                [
                    {
                        "Privilege": "GRANT OPTION",
                        "Context": "Databases,Tables",
                        "Comment": "To give to other users",
                    },
                ]
            ),
        ]
    )
    set_user_global_privileges(
        cast(DbSession, revoke_session), "alice", "localhost", []
    )
    assert revoke_session.history[2:] == [
        ("REVOKE GRANT OPTION ON *.* FROM ?@?", ["alice", "localhost"]),
    ]


def test_set_user_global_privileges_noop_emits_no_grant_or_revoke():
    mock_session = MockSession(
        [
            MockResultSet(
                [
                    {"privilege": "SELECT"},
                ]
            ),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Tables",
                        "Comment": "To retrieve rows",
                    },
                ]
            ),
        ]
    )

    set_user_global_privileges(
        cast(DbSession, mock_session), "alice", "localhost", ["SELECT"]
    )

    assert len(mock_session.history) == 2


def test_set_user_global_privileges_rejects_unknown_privileges():
    mock_session = MockSession(
        [
            MockResultSet([]),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Tables",
                        "Comment": "To retrieve rows",
                    },
                ]
            ),
        ]
    )

    with pytest.raises(ValueError, match="Unknown global privilege"):
        set_user_global_privileges(
            cast(DbSession, mock_session), "alice", "localhost", ["DROP DATABASE"]
        )

    assert len(mock_session.history) == 2


def test_set_user_global_privileges_rejects_unnormalized_privileges():
    mock_session = MockSession(
        [
            MockResultSet([]),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Tables",
                        "Comment": "To retrieve rows",
                    },
                ]
            ),
        ]
    )

    with pytest.raises(ValueError, match="Unknown global privilege"):
        set_user_global_privileges(
            cast(DbSession, mock_session), "alice", "localhost", ["select"]
        )

    assert len(mock_session.history) == 2


def test_set_user_object_privileges_adds_and_revokes_schema_privileges():
    mock_session = MockSession(
        [
            MockResultSet(
                [
                    {"privilege": "SELECT"},
                    {"privilege": "DELETE"},
                ]
            ),
            MockResultSet({"partialRevokes": "OFF"}),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Tables",
                        "Comment": "To retrieve rows",
                    },
                    {
                        "Privilege": "INSERT",
                        "Context": "Databases,Tables",
                        "Comment": "To insert rows",
                    },
                    {
                        "Privilege": "UPDATE",
                        "Context": "Databases,Tables",
                        "Comment": "To update rows",
                    },
                    {
                        "Privilege": "DELETE",
                        "Context": "Databases,Tables",
                        "Comment": "To delete rows",
                    },
                ]
            ),
        ]
    )

    set_user_object_privileges(
        cast(DbSession, mock_session),
        "alice",
        "localhost",
        object_privilege_target(kind="schema", schema="app`db"),
        ["SELECT", "INSERT", "UPDATE"],
    )

    assert mock_session.history[0][1] == ["'alice'@'localhost'", "app`db"]
    assert mock_session.history[1] == (
        user_management.PARTIAL_REVOKES_QUERY,
        [],
    )
    assert mock_session.history[2] == ("SHOW PRIVILEGES", [])
    assert mock_session.history[3:] == [
        ("GRANT INSERT, UPDATE ON `app``db`.* TO ?@?", ["alice", "localhost"]),
        ("REVOKE DELETE ON `app``db`.* FROM ?@?", ["alice", "localhost"]),
    ]


def test_set_user_object_privileges_rejects_new_schema_grant_option_but_can_revoke_existing():
    grant_session = MockSession(
        [
            MockResultSet([]),
            MockResultSet({"partialRevokes": "OFF"}),
            MockResultSet(
                [
                    {
                        "Privilege": "GRANT OPTION",
                        "Context": "Databases,Tables",
                        "Comment": "To give to other users",
                    },
                ]
            ),
        ]
    )
    with pytest.raises(ValueError, match="Unknown schema privilege\\(s\\): GRANT OPTION"):
        set_user_object_privileges(
            cast(DbSession, grant_session),
            "alice",
            "localhost",
            object_privilege_target(kind="schema", schema="sakila"),
            ["GRANT OPTION"],
        )

    assert len(grant_session.history) == 3

    revoke_session = MockSession(
        [
            MockResultSet(
                [
                    {"privilege": "GRANT OPTION"},
                ]
            ),
            MockResultSet({"partialRevokes": "OFF"}),
            MockResultSet(
                [
                    {
                        "Privilege": "GRANT OPTION",
                        "Context": "Databases,Tables",
                        "Comment": "To give to other users",
                    },
                ]
            ),
        ]
    )
    set_user_object_privileges(
        cast(DbSession, revoke_session),
        "alice",
        "localhost",
        object_privilege_target(kind="schema", schema="sakila"),
        [],
    )
    assert revoke_session.history[3:] == [
        ("REVOKE GRANT OPTION ON `sakila`.* FROM ?@?", ["alice", "localhost"]),
    ]


def test_set_user_object_privileges_adds_schema_partial_revoke_for_inherited_global_privilege():
    mock_session = MockSession(
        [
            MockResultSet([]),
            MockResultSet({"partialRevokes": "ON"}),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Tables",
                        "Comment": "To retrieve rows",
                    },
                ]
            ),
            MockResultSet([{"privilege": "SELECT"}]),
            MockResultSet([]),
            MockResultSet({"partialRevokes": []}),
        ]
    )

    set_user_object_privileges(
        cast(DbSession, mock_session),
        "alice",
        "localhost",
        object_privilege_target(kind="schema", schema="app"),
        [],
    )

    assert mock_session.history[3][1] == ["'alice'@'localhost'"]
    assert mock_session.history[6:] == [
        ("REVOKE SELECT ON `app`.* FROM ?@?", ["alice", "localhost"]),
    ]


def test_set_user_object_privileges_adds_schema_partial_revoke_for_role_global_privilege():
    mock_session = MockSession(
        [
            MockResultSet([]),
            MockResultSet({"partialRevokes": "ON"}),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Tables",
                        "Comment": "To retrieve rows",
                    },
                ]
            ),
            MockResultSet([]),
            MockResultSet([{"privilege": "SELECT"}]),
            MockResultSet({"partialRevokes": []}),
        ]
    )

    set_user_object_privileges(
        cast(DbSession, mock_session),
        "alice",
        "localhost",
        object_privilege_target(kind="schema", schema="app"),
        [],
    )

    assert mock_session.history[6:] == [
        ("REVOKE SELECT ON `app`.* FROM ?@?", ["alice", "localhost"]),
    ]
    assert sum(
        "information_schema.`SCHEMA_PRIVILEGES`" in sql
        for sql, _ in mock_session.history
    ) == 1


def test_set_user_object_privileges_grants_schema_to_remove_partial_revoke():
    mock_session = MockSession(
        [
            MockResultSet([]),
            MockResultSet({"partialRevokes": "ON"}),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Tables",
                        "Comment": "To retrieve rows",
                    },
                ]
            ),
            MockResultSet([{"privilege": "SELECT"}]),
            MockResultSet([]),
            MockResultSet(
                {
                    "partialRevokes": [
                        {"Database": "app", "Privileges": ["SELECT"]},
                    ],
                }
            ),
        ]
    )

    set_user_object_privileges(
        cast(DbSession, mock_session),
        "alice",
        "localhost",
        object_privilege_target(kind="schema", schema="app"),
        ["SELECT"],
    )

    assert mock_session.history[6:] == [
        ("GRANT SELECT ON `app`.* TO ?@?", ["alice", "localhost"]),
    ]


def test_set_user_object_privileges_revokes_direct_then_partially_revokes_global_schema_privilege():
    mock_session = MockSession(
        [
            MockResultSet([{"privilege": "SELECT"}]),
            MockResultSet({"partialRevokes": "ON"}),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Databases,Tables",
                        "Comment": "To retrieve rows",
                    },
                ]
            ),
            MockResultSet([{"privilege": "SELECT"}]),
            MockResultSet([]),
            MockResultSet({"partialRevokes": []}),
        ]
    )

    set_user_object_privileges(
        cast(DbSession, mock_session),
        "alice",
        "localhost",
        object_privilege_target(kind="schema", schema="world"),
        [],
    )

    assert mock_session.history[6:] == [
        ("REVOKE SELECT ON `world`.* FROM ?@?", ["alice", "localhost"]),
    ]


def test_set_user_object_privileges_batches_schema_privileges_with_partial_revokes():
    mock_session = MockSession(
        [
            MockResultSet(
                [
                    {"privilege": "SELECT"},
                    {"privilege": "DELETE"},
                ]
            ),
            MockResultSet({"partialRevokes": "ON"}),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Databases,Tables",
                        "Comment": "To retrieve rows",
                    },
                    {
                        "Privilege": "INSERT",
                        "Context": "Databases,Tables",
                        "Comment": "To insert rows",
                    },
                    {
                        "Privilege": "UPDATE",
                        "Context": "Databases,Tables",
                        "Comment": "To update rows",
                    },
                    {
                        "Privilege": "DELETE",
                        "Context": "Databases,Tables",
                        "Comment": "To delete rows",
                    },
                ]
            ),
            MockResultSet(
                [
                    {"privilege": "SELECT"},
                    {"privilege": "DELETE"},
                ]
            ),
            MockResultSet([]),
            MockResultSet({"partialRevokes": []}),
        ]
    )

    set_user_object_privileges(
        cast(DbSession, mock_session),
        "alice",
        "localhost",
        object_privilege_target(kind="schema", schema="world"),
        ["INSERT", "UPDATE"],
    )

    assert mock_session.history[6:] == [
        ("GRANT INSERT, UPDATE ON `world`.* TO ?@?", ["alice", "localhost"]),
        ("REVOKE SELECT, DELETE ON `world`.* FROM ?@?", ["alice", "localhost"]),
    ]


def test_set_user_object_privileges_keeps_table_revokes_direct_only_with_partial_revokes_available():
    mock_session = MockSession(
        [
            MockResultSet([{"privilege": "SELECT"}]),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Databases,Tables",
                        "Comment": "To retrieve rows",
                    },
                ]
            ),
        ]
    )

    set_user_object_privileges(
        cast(DbSession, mock_session),
        "alice",
        "localhost",
        object_privilege_target(kind="table", schema="app", object_name="orders"),
        [],
    )

    assert all("@@GLOBAL.partial_revokes" not in sql for sql, _ in mock_session.history)
    assert mock_session.history[2:] == [
        ("REVOKE SELECT ON `app`.`orders` FROM ?@?", ["alice", "localhost"]),
    ]


def test_set_user_object_privileges_rejects_unknown_schema_privileges():
    mock_session = MockSession(
        [
            MockResultSet([]),
            MockResultSet({"partialRevokes": "OFF"}),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Databases,Tables",
                        "Comment": "To retrieve rows",
                    },
                ]
            ),
        ]
    )

    with pytest.raises(ValueError, match="Unknown schema privilege"):
        set_user_object_privileges(
            cast(DbSession, mock_session),
            "alice",
            "localhost",
            object_privilege_target(kind="schema", schema="sakila"),
            ["shutdown"],
        )

    assert len(mock_session.history) == 3


def test_set_user_object_privileges_adds_revokes_and_quotes_table_privileges():
    mock_session = MockSession(
        [
            MockResultSet(
                [
                    {"privilege": "SELECT"},
                    {"privilege": "DELETE"},
                ]
            ),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Databases,Tables",
                        "Comment": "To retrieve rows",
                    },
                    {
                        "Privilege": "INSERT",
                        "Context": "Databases,Tables",
                        "Comment": "To insert rows",
                    },
                    {
                        "Privilege": "DELETE",
                        "Context": "Databases,Tables",
                        "Comment": "To delete rows",
                    },
                ]
            ),
        ]
    )

    set_user_object_privileges(
        cast(DbSession, mock_session),
        "alice",
        "localhost",
        object_privilege_target(
            kind="table",
            schema="app`db",
            object_name="orders`2026",
        ),
        ["SELECT", "INSERT"],
    )

    assert "information_schema.`TABLE_PRIVILEGES`" in mock_session.history[0][0]
    assert "tp.`GRANTEE` = ?" in mock_session.history[0][0]
    assert mock_session.history[0][1] == [
        "'alice'@'localhost'",
        "app`db",
        "orders`2026",
    ]
    assert mock_session.history[2:] == [
        (
            "GRANT INSERT ON `app``db`.`orders``2026` TO ?@?",
            ["alice", "localhost"],
        ),
        (
            "REVOKE DELETE ON `app``db`.`orders``2026` FROM ?@?",
            ["alice", "localhost"],
        ),
    ]


def test_set_user_object_privileges_rejects_new_routine_grant_option_but_can_revoke_existing():
    grant_session = MockSession(
        [
            MockResultSet([]),
            MockResultSet(
                [
                    {
                        "Privilege": "EXECUTE",
                        "Context": "Functions,Procedures",
                        "Comment": "To execute routines",
                    },
                    {
                        "Privilege": "GRANT OPTION",
                        "Context": "Databases,Tables",
                        "Comment": "To give to other users",
                    },
                ]
            ),
        ]
    )

    with pytest.raises(ValueError, match="Unknown routine privilege\\(s\\): GRANT OPTION"):
        set_user_object_privileges(
            cast(DbSession, grant_session),
            "alice",
            "localhost",
            object_privilege_target(
                kind="routine",
                schema="app",
                object_name="refresh",
                routine_type="PROCEDURE",
            ),
            ["EXECUTE", "GRANT OPTION"],
        )

    assert len(grant_session.history) == 2

    revoke_session = MockSession(
        [
            MockResultSet(
                [
                    {"privilege": "EXECUTE"},
                    {"privilege": "GRANT OPTION"},
                ]
            ),
            MockResultSet(
                [
                    {
                        "Privilege": "EXECUTE",
                        "Context": "Functions,Procedures",
                        "Comment": "To execute routines",
                    },
                    {
                        "Privilege": "GRANT OPTION",
                        "Context": "Databases,Tables",
                        "Comment": "To give to other users",
                    },
                ]
            ),
        ]
    )

    set_user_object_privileges(
        cast(DbSession, revoke_session),
        "alice",
        "localhost",
        object_privilege_target(
            kind="routine",
            schema="app",
            object_name="refresh",
            routine_type="FUNCTION",
        ),
        [],
    )

    assert "pp.`Routine_type` = ?" in revoke_session.history[0][0]
    assert revoke_session.history[0][1] == [
        "alice", "localhost", "app", "refresh", "FUNCTION",
    ] * 3
    assert revoke_session.history[2:] == [
        ("REVOKE EXECUTE ON FUNCTION `app`.`refresh` FROM ?@?", ["alice", "localhost"]),
        (
            "REVOKE GRANT OPTION ON FUNCTION `app`.`refresh` FROM ?@?",
            ["alice", "localhost"],
        ),
    ]


def test_set_user_object_privileges_rejects_unnormalized_routine_type():
    mock_session = MockSession()

    with pytest.raises(ValueError, match="Routine type must be FUNCTION or PROCEDURE"):
        set_user_object_privileges(
            cast(DbSession, mock_session),
            "alice",
            "localhost",
            object_privilege_target(
                kind="routine",
                schema="app",
                object_name="refresh",
                routine_type="procedure",
            ),
            ["EXECUTE"],
        )

    assert mock_session.history == []


def test_set_user_object_privileges_adds_and_revokes_column_privileges():
    mock_session = MockSession(
        [
            MockResultSet(
                [
                    {"privilege": "SELECT"},
                    {"privilege": "UPDATE"},
                ]
            ),
            MockResultSet(
                [
                    {
                        "Privilege": "SELECT",
                        "Context": "Databases,Tables",
                        "Comment": "To retrieve rows",
                    },
                    {
                        "Privilege": "INSERT",
                        "Context": "Databases,Tables",
                        "Comment": "To insert rows",
                    },
                    {
                        "Privilege": "UPDATE",
                        "Context": "Databases,Tables",
                        "Comment": "To update rows",
                    },
                    {
                        "Privilege": "REFERENCES",
                        "Context": "Databases,Tables",
                        "Comment": "To refer to tables",
                    },
                ]
            ),
        ]
    )

    set_user_object_privileges(
        cast(DbSession, mock_session),
        "alice",
        "localhost",
        object_privilege_target(
            kind="column",
            schema="app",
            object_name="orders",
            column="total`amount",
        ),
        ["INSERT", "REFERENCES"],
    )

    assert "information_schema.`COLUMN_PRIVILEGES`" in mock_session.history[0][0]
    assert "cp.`GRANTEE` = ?" in mock_session.history[0][0]
    assert mock_session.history[0][1] == [
        "'alice'@'localhost'",
        "app",
        "orders",
        "total`amount",
    ]
    assert mock_session.history[2:] == [
        (
            "GRANT INSERT (`total``amount`), REFERENCES (`total``amount`) "
            "ON `app`.`orders` TO ?@?",
            ["alice", "localhost"],
        ),
        (
            "REVOKE SELECT (`total``amount`), UPDATE (`total``amount`) "
            "ON `app`.`orders` FROM ?@?",
            ["alice", "localhost"],
        ),
    ]


@pytest.mark.parametrize(
    "target, error",
    [
        (object_privilege_target(), "Object privilege target kind is required"),
        (
            object_privilege_target(kind="space", schema="app"),
            "Unknown object privilege target kind",
        ),
        (
            object_privilege_target(kind="table", schema="app"),
            "Object name is required",
        ),
        (
            object_privilege_target(kind="column", schema="app", object_name="orders"),
            "Column name is required",
        ),
    ],
)
def test_set_user_object_privileges_rejects_invalid_targets(target, error):
    mock_session = MockSession()

    with pytest.raises(ValueError, match=error):
        set_user_object_privileges(
            cast(DbSession, mock_session), "alice", "localhost", target, []
        )

    assert mock_session.history == []


def test_set_user_object_privileges_rejects_invalid_column_privileges():
    mock_session = MockSession(
        [
            MockResultSet([]),
            MockResultSet(
                [
                    {
                        "Privilege": "DELETE",
                        "Context": "Databases,Tables",
                        "Comment": "To delete rows",
                    },
                ]
            ),
        ]
    )

    with pytest.raises(ValueError, match="Unknown column privilege"):
        set_user_object_privileges(
            cast(DbSession, mock_session),
            "alice",
            "localhost",
            object_privilege_target(
                kind="column",
                schema="app",
                object_name="orders",
                column="id",
            ),
            ["delete"],
        )

    assert len(mock_session.history) == 2


def test_set_user_roles_adds_defaults_and_revokes():
    mock_session = MockSession(
        MockResultSet(
            [
                {"role": "legacy@%"},
                {"role": "reader@%"},
            ]
        )
    )

    set_granted_roles(
        cast(DbSession, mock_session),
        "alice",
        "localhost",
        ["reader@%", "auditor@localhost"],
        ["auditor@localhost"],
    )

    assert mock_session.history == [
        (
            """
SELECT CONCAT(re.`from_user`, '@', re.`from_host`) AS role
FROM mysql.`role_edges` re
WHERE re.`to_user` = ? AND re.`to_host` = ?
ORDER BY re.`from_user`, re.`from_host`
""",
            ["alice", "localhost"],
        ),
        ("GRANT ?@? TO ?@?", ["auditor", "localhost", "alice", "localhost"]),
        (
            "SET DEFAULT ROLE ?@? TO ?@?",
            ["auditor", "localhost", "alice", "localhost"],
        ),
        ("REVOKE ?@? FROM ?@?", ["legacy", "%", "alice", "localhost"]),
    ]


def test_set_granted_roles_clears_defaults_when_no_default_roles_selected():
    mock_session = MockSession(MockResultSet([{"role": "reader@%"}]))

    set_granted_roles(
        cast(DbSession, mock_session),
        "alice",
        "localhost",
        ["reader@%"],
        [],
    )

    assert mock_session.history == [
        (
            """
SELECT CONCAT(re.`from_user`, '@', re.`from_host`) AS role
FROM mysql.`role_edges` re
WHERE re.`to_user` = ? AND re.`to_host` = ?
ORDER BY re.`from_user`, re.`from_host`
""",
            ["alice", "localhost"],
        ),
        ("SET DEFAULT ROLE NONE TO ?@?", ["alice", "localhost"]),
    ]


def test_set_granted_roles_uses_default_roles_as_provided():
    mock_session = MockSession(MockResultSet([{"role": "reader@%"}]))

    set_granted_roles(
        cast(DbSession, mock_session),
        "alice",
        "localhost",
        ["reader@%"],
        ["missing@%"],
    )

    assert mock_session.history == [
        (
            """
SELECT CONCAT(re.`from_user`, '@', re.`from_host`) AS role
FROM mysql.`role_edges` re
WHERE re.`to_user` = ? AND re.`to_host` = ?
ORDER BY re.`from_user`, re.`from_host`
""",
            ["alice", "localhost"],
        ),
        ("SET DEFAULT ROLE ?@? TO ?@?", ["missing", "%", "alice", "localhost"]),
    ]


def test_set_granted_roles_clears_defaults_before_revoking_all():
    mock_session = MockSession(
        MockResultSet(
            [
                {"role": "reader@%"},
            ]
        )
    )

    set_granted_roles(cast(DbSession, mock_session), "alice", "localhost", [])

    assert mock_session.history == [
        (
            """
SELECT CONCAT(re.`from_user`, '@', re.`from_host`) AS role
FROM mysql.`role_edges` re
WHERE re.`to_user` = ? AND re.`to_host` = ?
ORDER BY re.`from_user`, re.`from_host`
""",
            ["alice", "localhost"],
        ),
        ("SET DEFAULT ROLE NONE TO ?@?", ["alice", "localhost"]),
        ("REVOKE ?@? FROM ?@?", ["reader", "%", "alice", "localhost"]),
    ]


@pytest.mark.parametrize(
    ("user", "host"),
    [
        ("a@b'\"", "%"),
        ("back`tick", "host`tick"),
        ("quote'\"mix", "space host"),
        ("semi;DROP USER root", "%'; --"),
    ],
)
def test_mysql_user_account_sql_uses_parameters_for_qa_style_values(user, host):
    mock_session = MockSession()

    create_mysql_user(
        cast(DbSession, mock_session),
        MySQLUser(
            user=user,
            host=host,
            randomPassword=True,
        ),
    )
    assert mock_session.sql == """CREATE USER ?@?
    IDENTIFIED BY RANDOM PASSWORD"""
    assert mock_session.params == [user, host]

    update_mysql_user(cast(DbSession, mock_session), MySQLUser(user=user, host=host))
    assert mock_session.sql == """ALTER USER ?@?"""
    assert mock_session.params == [user, host]

    delete_mysql_user(cast(DbSession, mock_session), user, host)
    assert mock_session.sql == "DROP USER ?@?"
    assert mock_session.params == [user, host]


def test_create_mysql_user_returns_generated_password():
    mock_session = MockSession(
        MockResultSet({"generated password": "generated-password"})
    )

    generated_password = create_mysql_user(
        cast(DbSession, mock_session),
        MySQLUser(
            user="user1",
            host="%",
            randomPassword=True,
        ),
    )

    assert generated_password == "generated-password"
    assert mock_session.sql == """CREATE USER ?@?
    IDENTIFIED BY RANDOM PASSWORD"""


def test_update_mysql_user_returns_generated_password():
    mock_session = MockSession(
        MockResultSet({"generated password": "generated-password"})
    )

    generated_password = update_mysql_user(
        cast(DbSession, mock_session),
        MySQLUser(
            user="user1",
            host="%",
            plugin="caching_sha2_password",
            randomPassword=True,
        ),
    )

    assert generated_password == "generated-password"
    assert mock_session.sql == """ALTER USER ?@?
    IDENTIFIED WITH ? BY RANDOM PASSWORD"""
    assert mock_session.params == ["user1", "%", "caching_sha2_password"]


def test_create_mysql_user(session):
    mock_session = MockSession()

    def validate_user_creation(user_options: MySQLUser):
        assert get_mysql_user(session, user_options.user, user_options.host) is None

        create_mysql_user(session, user_options)

        assert get_mysql_user(session, user_options.user, user_options.host) is not None

        delete_mysql_user(session, user_options.user, user_options.host)

        assert get_mysql_user(session, user_options.user, user_options.host) is None

    # password1 = "$A$00A$G}co}^A;^Tvv(lh^SWk.V ZtBBeryFinSWBojNieYIaliR9SO3gosKKmdka5LEJi50" # hash for 'password1'
    password1 = bytes.fromhex(
        "24412430304124477D636F7D013B147676286C6813576B2E56205A74424265727946696E5357426F6A4E69655949616C695239534F33676F734B4B6D646B61354C454A693530"
    )
    password1 = password1.decode("utf-8", errors="strict")
    user_options = MySQLUser(
        **{
            "user": "user1",
            "host": "%",
            "authString": None,
            "randomPassword": True,
            "accountLocked": None,
            "comment": "Comment for this user",
        }
    )

    create_mysql_user(cast(DbSession, mock_session), user_options)

    assert mock_session.sql == """CREATE USER ?@?
    IDENTIFIED BY RANDOM PASSWORD
    COMMENT ?"""

    assert mock_session.params == [
        "user1",
        "%",
        "Comment for this user",
    ]

    validate_user_creation(user_options)

    # add an auth string
    user_options.authString = password1

    create_mysql_user(cast(DbSession, mock_session), user_options)

    assert mock_session.sql == """CREATE USER ?@?
    IDENTIFIED BY /*((*/ ? /*))*/
    COMMENT ?"""

    assert mock_session.params == [
        "user1",
        "%",
        password1,
        "Comment for this user",
    ]

    validate_user_creation(user_options)

    # add a plugin
    user_options.plugin = "caching_sha2_password"

    create_mysql_user(cast(DbSession, mock_session), user_options)

    assert mock_session.sql == """CREATE USER ?@?
    IDENTIFIED WITH caching_sha2_password BY /*((*/ ? /*))*/
    COMMENT ?"""

    assert mock_session.params == [
        "user1",
        "%",
        password1,
        "Comment for this user",
    ]

    validate_user_creation(user_options)

    # add a TLS and resource management
    user_options.sslType = "ANY"
    user_options.maxQuestions = 1
    user_options.maxUpdates = 1
    user_options.maxConnections = 1
    user_options.maxUserConnections = 1

    create_mysql_user(cast(DbSession, mock_session), user_options)

    assert mock_session.sql == """CREATE USER ?@?
    IDENTIFIED WITH caching_sha2_password BY /*((*/ ? /*))*/
    REQUIRE SSL
    WITH MAX_QUERIES_PER_HOUR ? MAX_UPDATES_PER_HOUR ? MAX_CONNECTIONS_PER_HOUR ? MAX_USER_CONNECTIONS ?
    COMMENT ?"""

    assert mock_session.params == [
        "user1",
        "%",
        password1,
        1,
        1,
        1,
        1,
        "Comment for this user",
    ]

    validate_user_creation(user_options)

    # resource options with no clauses should not add a WITH clause
    user_options.maxQuestions = None
    user_options.maxUpdates = None
    user_options.maxConnections = None
    user_options.maxUserConnections = None

    create_mysql_user(cast(DbSession, mock_session), user_options)

    assert mock_session.sql == """CREATE USER ?@?
    IDENTIFIED WITH caching_sha2_password BY /*((*/ ? /*))*/
    REQUIRE SSL
    COMMENT ?"""

    assert mock_session.params == [
        "user1",
        "%",
        password1,
        "Comment for this user",
    ]

    validate_user_creation(user_options)

    # add password options
    user_options.passwordLifetime = 10
    user_options.passwordReuseHistory = 10
    user_options.passwordReuseInterval = 7
    user_options.passwordRequireCurrent = True
    user_options.failedLoginAttempts = 3
    user_options.passwordLockTime = 2

    create_mysql_user(cast(DbSession, mock_session), user_options)

    assert mock_session.sql == """CREATE USER ?@?
    IDENTIFIED WITH caching_sha2_password BY /*((*/ ? /*))*/
    REQUIRE SSL
    PASSWORD EXPIRE INTERVAL ? DAY
    PASSWORD HISTORY ?
    PASSWORD REUSE INTERVAL ? DAY
    PASSWORD REQUIRE CURRENT
    FAILED_LOGIN_ATTEMPTS ?
    PASSWORD_LOCK_TIME ?
    COMMENT ?"""

    assert mock_session.params == [
        "user1",
        "%",
        password1,
        10,
        10,
        7,
        3,
        2,
        "Comment for this user",
    ]

    validate_user_creation(user_options)


@pytest.mark.parametrize(
    ("lock_option", "lock_clause"),
    [
        (True, "ACCOUNT LOCK"),
        (False, "ACCOUNT UNLOCK"),
    ],
)
def test_create_mysql_user_applies_account_lock_option(lock_option, lock_clause):
    mock_session = MockSession()

    create_mysql_user(
        cast(DbSession, mock_session),
        MySQLUser(
            user="user1",
            host="%",
            authString="password1",
            accountLocked=lock_option,
        ),
    )

    assert mock_session.sql == f"""CREATE USER ?@?
    IDENTIFIED BY /*((*/ ? /*))*/
    {lock_clause}"""
    assert mock_session.params == ["user1", "%", "password1"]


def test_create_mysql_user_uses_password_history_option():
    mock_session = MockSession()

    create_mysql_user(
        cast(DbSession, mock_session),
        MySQLUser(
            user="user1",
            host="%",
            passwordLifetime=10,
            passwordReuseHistory=12,
        ),
    )

    assert mock_session.sql == """CREATE USER ?@?
    PASSWORD EXPIRE INTERVAL ? DAY
    PASSWORD HISTORY ?"""
    assert mock_session.params == ["user1", "%", 10, 12]


def test_update_mysql_user(session):
    mock_session = MockSession()

    user_options = MySQLUser(
        **{
            "user": "user1",
            "host": "%",
            "accountLocked": None,
            "comment": None,
        }
    )

    update_mysql_user(cast(DbSession, mock_session), user_options)

    assert mock_session.sql == """ALTER USER ?@?"""
    assert mock_session.params == ["user1", "%"]

    # Add TLS requirements
    user_options.sslType = "X509"
    user_options.sslCipher = "EDH-RSA-DES-CBC3-SHA"

    update_mysql_user(cast(DbSession, mock_session), user_options)

    assert mock_session.sql == """ALTER USER ?@?
    REQUIRE X509 AND CIPHER ?"""
    assert mock_session.params == ["user1", "%", "EDH-RSA-DES-CBC3-SHA"]

    # Add a comment through MySQL's dedicated COMMENT option.
    user_options.comment = "This is the updated comment"

    update_mysql_user(cast(DbSession, mock_session), user_options)

    assert mock_session.sql == """ALTER USER ?@?
    REQUIRE X509 AND CIPHER ?
    COMMENT ?"""

    assert mock_session.params == [
        "user1",
        "%",
        "EDH-RSA-DES-CBC3-SHA",
        "This is the updated comment",
    ]


def test_update_mysql_user_clears_comment():
    mock_session = MockSession()

    update_mysql_user(
        cast(DbSession, mock_session),
        MySQLUser(user="user1", host="%", comment=""),
    )

    assert mock_session.sql == """ALTER USER ?@?
    COMMENT ?"""
    assert mock_session.params == ["user1", "%", ""]


@pytest.mark.parametrize(
    ("plugin", "expected_sql", "expected_params"),
    [
        (
            None,
            """ALTER USER ?@?
    IDENTIFIED BY /*((*/ ? /*))*/""",
            ["user1", "%", "password1"],
        ),
        (
            "caching_sha2_password",
            """ALTER USER ?@?
    IDENTIFIED WITH ? BY /*((*/ ? /*))*/""",
            ["user1", "%", "caching_sha2_password", "password1"],
        ),
    ],
)
def test_update_mysql_user_redacts_authentication_string(
    plugin: Optional[str], expected_sql: str, expected_params: list[str]
) -> None:
    mock_session = MockSession()

    update_mysql_user(
        cast(DbSession, mock_session),
        MySQLUser(
            user="user1",
            host="%",
            plugin=plugin,
            authString="password1",
        ),
    )

    assert mock_session.sql == expected_sql
    assert mock_session.params == expected_params


@pytest.mark.parametrize(
    ("lock_option", "lock_clause"),
    [
        (True, "ACCOUNT LOCK"),
        (False, "ACCOUNT UNLOCK"),
    ],
)
def test_update_mysql_user_applies_account_lock_option(lock_option, lock_clause):
    mock_session = MockSession()

    update_mysql_user(
        cast(DbSession, mock_session),
        MySQLUser(user="user1", host="%", accountLocked=lock_option),
    )

    assert mock_session.sql == f"""ALTER USER ?@?
    {lock_clause}"""
    assert mock_session.params == ["user1", "%"]


def test_update_mysql_user_makes_current_password_optional():
    mock_session = MockSession()

    update_mysql_user(
        cast(DbSession, mock_session),
        MySQLUser(user="user1", host="%", passwordRequireCurrent=False),
    )

    assert mock_session.sql == """ALTER USER ?@?
    PASSWORD REQUIRE CURRENT OPTIONAL"""
    assert mock_session.params == ["user1", "%"]


def test_update_mysql_user_keeps_tls_before_password_options():
    mock_session = MockSession()

    user_options = MySQLUser(
        **{
            "user": "user1",
            "host": "%",
            "plugin": "mysql_native_password",
            "authString": None,
            "randomPassword": True,
            "sslType": "ANY",
            "passwordLifetime": 0,
            "passwordReuseHistory": 0,
            "passwordReuseInterval": 0,
            "passwordRequireCurrent": False,
            "failedLoginAttempts": 0,
            "passwordLockTime": None,
            "accountLocked": None,
            "comment": None,
        }
    )

    update_mysql_user(cast(DbSession, mock_session), user_options)

    assert mock_session.sql == """ALTER USER ?@?
    IDENTIFIED WITH ? BY RANDOM PASSWORD
    REQUIRE SSL
    PASSWORD EXPIRE NEVER
    PASSWORD HISTORY ?
    PASSWORD REUSE INTERVAL ? DAY
    PASSWORD REQUIRE CURRENT OPTIONAL
    FAILED_LOGIN_ATTEMPTS ?"""
    assert mock_session.params == [
        "user1",
        "%",
        "mysql_native_password",
        0,
        0,
        0,
    ]


def test_update_mysql_user_uses_password_history_option():
    mock_session = MockSession()

    update_mysql_user(
        cast(DbSession, mock_session),
        MySQLUser(
            user="user1",
            host="%",
            passwordLifetime=10,
            passwordReuseHistory=12,
        ),
    )

    assert mock_session.sql == """ALTER USER ?@?
    PASSWORD EXPIRE INTERVAL ? DAY
    PASSWORD HISTORY ?"""
    assert mock_session.params == ["user1", "%", 10, 12]


@pytest.mark.parametrize(
    ("function", "options"),
    [
        (
            create_mysql_user,
            MySQLUser(
                user="user1",
                host="%",
                passwordExpire=True,
            ),
        ),
        (
            update_mysql_user,
            MySQLUser(
                user="user1",
                host="%",
                passwordExpire=True,
            ),
        ),
    ],
)
def test_user_password_can_be_expired_immediately(function, options):
    mock_session = MockSession()

    function(cast(DbSession, mock_session), options)

    assert mock_session.sql == """%s USER ?@?
    PASSWORD EXPIRE""" % ("CREATE" if function is create_mysql_user else "ALTER")
    assert mock_session.params == ["user1", "%"]


def test_update_mysql_user_uses_cipher_tls_option_without_ssl_prefix():
    mock_session = MockSession()

    user_options = MySQLUser(
        **{
            "user": "user1",
            "host": "%",
            "sslType": "SPECIFIED",
            "sslCipher": "EDH-RSA-DES-CBC3-SHA",
            "accountLocked": None,
            "comment": None,
        }
    )

    update_mysql_user(cast(DbSession, mock_session), user_options)

    assert mock_session.sql == """ALTER USER ?@?
    REQUIRE CIPHER ?"""
    assert mock_session.params == [
        "user1",
        "%",
        "EDH-RSA-DES-CBC3-SHA",
    ]


def test_update_mysql_user_clears_tls_requirements():
    mock_session = MockSession()

    update_mysql_user(
        cast(DbSession, mock_session),
        MySQLUser(user="user1", host="%", sslType="NONE"),
    )

    assert mock_session.sql == """ALTER USER ?@?
    REQUIRE NONE"""
    assert mock_session.params == ["user1", "%"]


@pytest.mark.parametrize(
    ("function", "options", "statement"),
    [
        (
            create_mysql_user,
            MySQLUser(
                user="user1",
                host="%",
                maxUserConnections=3,
            ),
            "CREATE USER ?@?",
        ),
        (
            update_mysql_user,
            MySQLUser(
                user="user1",
                host="%",
                maxUserConnections=3,
            ),
            "ALTER USER ?@?",
        ),
    ],
)
def test_user_resource_options_use_bound_parameters(function, options, statement):
    mock_session = MockSession()

    function(cast(DbSession, mock_session), options)

    assert mock_session.sql == f"""{statement}
    WITH MAX_USER_CONNECTIONS ?"""
    assert mock_session.params == ["user1", "%", 3]


@pytest.mark.parametrize(
    ("function", "options"),
    [
        (
            create_mysql_user,
            MySQLUser(
                user="user1",
                host="%",
                sslType="SPECIFIED",
                sslCipher="cipher' OR 1=1 -- ",
            ),
        ),
        (
            update_mysql_user,
            MySQLUser(
                user="user1",
                host="%",
                sslType="SPECIFIED",
                sslCipher="cipher' OR 1=1 -- ",
            ),
        ),
    ],
)
def test_user_tls_values_use_bound_parameters(function, options):
    mock_session = MockSession()

    function(cast(DbSession, mock_session), options)

    assert mock_session.sql == "%s USER ?@?\n    REQUIRE CIPHER ?" % (
        "CREATE" if function is create_mysql_user else "ALTER"
    )
    assert mock_session.params == ["user1", "%", "cipher' OR 1=1 -- "]


@pytest.mark.parametrize(
    ("function", "options"),
    [
        (
            create_mysql_user,
            MySQLUser(
                user="user1",
                host="%",
                plugin="mysql_native_password; DROP USER root",
                authString="password",
            ),
        ),
    ],
)
def test_user_authentication_plugins_reject_sql_syntax(function, options):
    with pytest.raises(ValueError, match="Invalid authentication plugin"):
        function(cast(DbSession, MockSession()), options)
