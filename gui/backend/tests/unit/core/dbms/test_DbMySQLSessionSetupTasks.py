# Copyright (c) 2022, 2026, Oracle and/or its affiliates.
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

import gui_plugin.core.dbms.DbMySQLSessionSetupTasks as Tasks
import gui_plugin.core.dbms.DbMySQLSession as DbMySQLSession
import gui_plugin.core.dbms.DbMySQLSessionCommon as common


class MockResult:
    def __init__(self, data) -> None:
        self._result = data
        self._next = 0

    def fetch_one(self):
        if self._next < len(self._result):
            self._next += 1
            return self._result[self._next - 1]
        return None

    def fetch_all(self):
        self._next = len(self._result)
        return self._result


class MockShellOptions:
    def __init__(self):
        self.values = {}

    def set(self, option, value):
        self.values[option] = value


class MockShell:
    def __init__(self):
        self.options = MockShellOptions()


class MockDbSession(DbMySQLSession.DbMysqlSession):
    def __init__(
        self,
        task_class,
        open_connection,
        connection_options,
        on_connect_connection_options,
        on_connected_data,
        known_data={},
        message_callback=None,
        expected_queries=[],
        shell=None,
    ):
        self._task_class = task_class
        self._open_connection = open_connection
        self._shell = shell
        self._original_connection_options = connection_options.copy()
        self._original_known_data = known_data.copy()
        self._on_connect_connection_options = on_connect_connection_options.copy()
        self._on_connected_data = on_connected_data
        self._expected_queries = expected_queries
        self._next_query = 0
        super().__init__(
            0,
            False,
            connection_options,
            data=known_data.copy(),
            message_callback=message_callback,
        )

        # Since the parent class already attempts connection, we can check here if the data is as expected
        assert self._on_connected_data == self.data, "Unexpected Session Data"

    def normalize_string(self, string):
        data = string.split("\n")
        trimmed = [line.strip() for line in data]
        return " ".join(trimmed).strip()

    def _initialize_setup_tasks(self):
        return [self._task_class(self)]

    def _do_open_database(self, notify_success=True):
        # No connection is really done on this mock, but we emulate it was done
        if self._open_connection:
            self._on_connect()

        return self._open_connection

    def _do_connect(self, notify_success=True):
        return self._open_connection

    def _reset_setup_tasks(self):
        super()._reset_setup_tasks()
        self._next_query = 0
        assert (
            self._original_connection_options == self.connection_options
        ), "Options did not go to the original state"
        assert (
            self._original_known_data == self.data
        ), "Data did not go to the original state"

    def _on_connect(self):
        super()._on_connect()
        assert (
            self._on_connect_connection_options == self.connection_options
        ), "Options were not cleaned up as expected"

    def _on_connected(self, notify_success):
        super()._on_connected(notify_success=notify_success)
        assert self._next_query == len(
            self._expected_queries
        ), "Not all the queries were executed"
        assert self._on_connected_data == self.data, "Unexpected data after connection"

    def execute_thread(self, sql, params, options=None):
        assert self._next_query < len(
            self._expected_queries
        ), f"Unexpected query received, no more expected: {sql}"

        (esql, eparams), result = self._expected_queries[self._next_query]
        assert self.normalize_string(esql) == self.normalize_string(
            sql
        ), f"Unexpected SQL Received, expected {esql}, received {sql}"
        assert (
            eparams == params
        ), f"Unexpected SQL Parameters Received, expected {eparams}, received {params}"
        self._next_query += 1
        return result


class TestSessionInfoTask:
    def test_connection(self):
        options = {"scheme": "mysql"}
        on_connect_options = options.copy()
        session = MockDbSession(
            Tasks.SessionInfoTask,
            True,
            options,
            on_connect_options,
            {
                common.MySQLData.CONNECTION_ID: 5,
                common.MySQLData.VERSION_INFO: "8.0.30",
                common.MySQLData.VERSION_COMMENT: "MySQL Community Server - GPL",
                common.MySQLData.SQL_MODE: "SOME SQL MODE",
            },
            expected_queries=[
                (
                    (
                        """SELECT connection_id(),
                        @@version,
                        @@version_comment,
                        @@SESSION.sql_mode""",
                        None,
                    ),
                    MockResult(
                        [
                            [
                                5,
                                "8.0.30",
                                "MySQL Community Server - GPL",
                                "SOME SQL MODE",
                            ]
                        ]
                    ),
                )
            ],
        )

        session.reconnect()


class TestSqlModeTask:
    def test_connection(self):
        options = {"scheme": "mysql", "sql-mode": ["ANSI_QUOTES", "STRICT_TRANS_TABLES"]}
        session = MockDbSession(
            Tasks.SqlModeTask,
            True,
            options,
            {"scheme": "mysql"},
            {},
            expected_queries=[
                (("SET SESSION sql_mode = ?", ["ANSI_QUOTES,STRICT_TRANS_TABLES"]), MockResult([])),
            ],
        )

        session.reconnect()


class TestExplainJsonFormatVersionTask:
    def test_connection_supported_version(self):
        options = {"scheme": "mysql"}
        on_connect_options = options.copy()
        data = {common.MySQLData.VERSION_INFO: "8.3.0"}
        session = MockDbSession(
            Tasks.ExplainJsonFormatVersionTask,
            True,
            options,
            on_connect_options,
            data,
            known_data=data,
            expected_queries=[
                (("SET SESSION explain_json_format_version=2", None), MockResult([]))
            ],
        )
        session.reconnect()


class TestHeatWaveCheckTask:
    def test_connection_hw_check(self):
        try:
            # Each item is composed of the known value and the expected value.
            test_data = [
                (None, False),  # unknown, detected as unavailable
                (True, True),  # known to be available
                (False, False),  # known to be unavailable
            ]

            for tuple in test_data:
                known, expected = tuple

                options = {"scheme": "mysql"}
                on_connect_options = {"scheme": "mysql"}

                known_data = {}
                if known is not None:
                    known_data[common.MySQLData.HEATWAVE_AVAILABLE] = known
                    known_data[common.MySQLData.IS_CLOUD_INSTANCE] = known
                    known_data[common.MySQLData.MLE_AVAILABLE] = False
                    known_data[common.MySQLData.HAS_EXPLAIN_ERROR] = False

                expected_data = {
                    common.MySQLData.MLE_AVAILABLE: False,
                    common.MySQLData.HAS_EXPLAIN_ERROR: False,
                    common.MySQLData.HEATWAVE_AVAILABLE: expected,
                    common.MySQLData.IS_CLOUD_INSTANCE: expected,
                }

                expected_queries = []
                if known is None:
                    if expected:
                        result = MockResult([["rpd_nodes"]])
                    else:
                        result = MockResult([])

                    expected_queries = [
                        (
                            (
                                """SELECT TABLE_NAME, @@version AS version FROM `information_schema`.`TABLES`
                    WHERE TABLE_SCHEMA = 'performance_schema'
                        AND TABLE_NAME = 'rpd_nodes'""",
                                None,
                        ),
                        result,
                    ),
                    (("SHOW STATUS LIKE 'mle_status'", None), result),
                ]

                session = MockDbSession(
                    Tasks.HeatWaveCheckTask,
                    True,
                    options,
                    on_connect_options,
                    expected_data,
                    known_data=known_data,
                    expected_queries=expected_queries,
                )
                session.reconnect()
        except Exception as e:
            assert False, f"Unexpected Error Happened: {str(e)}"

    def test_connection_checks_mle_when_heatwave_is_known_unavailable(self):
        options = {"scheme": "mysql"}
        known_data = {
            common.MySQLData.HEATWAVE_AVAILABLE: False,
            common.MySQLData.IS_CLOUD_INSTANCE: False,
        }
        expected_data = {
            **known_data,
            common.MySQLData.MLE_AVAILABLE: False,
            common.MySQLData.HAS_EXPLAIN_ERROR: False,
        }

        session = MockDbSession(
            Tasks.HeatWaveCheckTask,
            True,
            options,
            options,
            expected_data,
            known_data=known_data,
            expected_queries=[(("SHOW STATUS LIKE 'mle_status'", None), MockResult([]))],
        )
        session.reconnect()

    def test_explain_error_probe_is_compatible_with_ansi_quotes(self):
        options = {"scheme": "mysql"}
        known_data = {
            common.MySQLData.HEATWAVE_AVAILABLE: True,
            common.MySQLData.IS_CLOUD_INSTANCE: True,
            common.MySQLData.MLE_AVAILABLE: True,
        }
        expected_data = {
            **known_data,
            common.MySQLData.HAS_EXPLAIN_ERROR: True,
        }

        session = MockDbSession(
            Tasks.HeatWaveCheckTask,
            True,
            options,
            options,
            expected_data,
            known_data=known_data,
            expected_queries=[
                (
                    (
                        """SELECT ROUTINE_NAME
                        FROM information_schema.routines
                        WHERE ROUTINE_SCHEMA='sys'
                          AND ROUTINE_NAME='mle_explain_error'
                          AND ROUTINE_TYPE='PROCEDURE'""",
                        None,
                    ),
                    MockResult([["mle_explain_error"]]),
                ),
            ],
        )
        session.reconnect()


class TestRemoveExternalOptionsTask:
    def test_connection_authentication_hints(self):
        shell = MockShell()
        options = {
            "scheme": "mysql",
            "auth-method": "mysql_clear_password",
            "authentication_hints": {
                "factors": [
                "authentication_ldap_simple",
                "authentication_pam",
                "authentication_webauthn",
                ],
                "plugin_dir": "/opt/mysql/plugins",
            },
            "plugin-authentication-kerberos-client-mode": "GSSAPI",
            "plugin-authentication-webauthn-device": "security-key",
            "oci-config-file": "/home/user/.oci/config",
            "authentication-oci-client-config-profile": "database",
            "authentication-openid-connect-client-id-token-file": "/home/user/oidc-token",
        }
        session = MockDbSession(
            Tasks.RemoveExternalOptionsTask,
            True,
            options,
            {
                "scheme": "mysql",
                "auth-method": "mysql_clear_password",
                "plugin-authentication-kerberos-client-mode": "GSSAPI",
                "plugin-authentication-webauthn-device": "security-key",
                "oci-config-file": "/home/user/.oci/config",
                "authentication-oci-client-config-profile": "database",
                "authentication-openid-connect-client-id-token-file": "/home/user/oidc-token",
            },
            {},
            shell=shell,
        )

        session.reconnect()
        assert shell.options.values == {
            "mysqlPluginDir": "/opt/mysql/plugins",
        }
