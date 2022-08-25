# Copyright (c) 2022, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is also distributed with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have included with MySQL.
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import pytest
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
            return self._result[self._next-1]
        return None

    def fetch_all(self):
        self._next = len(self._result)
        return self._result


class MockDbSession(DbMySQLSession.DbMysqlSession):
    def __init__(self, task_class, open_connection, connection_options, on_connect_connection_options, on_connected_data, known_data={}, message_callback=None, expected_queries=[]):
        self._task_class = task_class
        self._open_connection = open_connection
        self._original_connection_options = connection_options.copy()
        self._original_known_data = known_data.copy()
        self._on_connect_connection_options = on_connect_connection_options.copy()
        self._on_connected_data = on_connected_data
        self._expected_queries = expected_queries
        self._next_query = 0
        super().__init__(0, False, connection_options,
                         data=known_data.copy(), message_callback=message_callback)

        # Since the parent class already attempts connection, we can check here if the data is as expected
        assert self._on_connected_data == self.data, "Unexpected Session Data"

    def normalize_string(self, string):
        data = string.split("\n")
        trimmed = [line.strip() for line in data]
        return " ".join(trimmed).strip()

    def _initialize_setup_tasks(self):
        return [self._task_class(self)]

    def _do_open_database(self, notify_success=True):
        return self._open_connection

    def _do_connect(self, notify_success=True):
        return self._open_connection

    def _reset_setup_tasks(self):
        super()._reset_setup_tasks()
        self._next_query = 0
        assert self._original_connection_options == self.connection_options, "Options did not go to the original state"
        assert self._original_known_data == self.data, "Data did not go to the original state"

    def _on_connect(self):
        super()._on_connect()
        assert self._on_connect_connection_options == self.connection_options, "Options were not cleaned up as expected"

    def _on_connected(self, notify_success):
        super()._on_connected(notify_success=notify_success)
        assert self._next_query == len(
            self._expected_queries), "Not all the queries were executed"
        assert self._on_connected_data == self.data, "Unexpected data after connection"

    def execute_thread(self, sql, params):
        assert self._next_query < len(
            self._expected_queries), f"Unexpected query received, no more expected: {sql}"

        ((esql, eparams), result) = self._expected_queries[self._next_query]
        assert self.normalize_string(esql) == self.normalize_string(
            sql), f"Unexpected SQL Received, expected {esql}, received {sql}"
        assert eparams == params, f"Unexpected SQL Parameters Received, expected {eparams}, received {params}"
        self._next_query += 1
        return result


class TestSessionInfoTask:
    def test_initialization(self):
        try:
            options = {'scheme': 'mysql'}
            on_connect_options = options.copy()

            session = MockDbSession(Tasks.SessionInfoTask,
                                    False,
                                    options,
                                    on_connect_options, {})
        except Exception as e:
            assert False, f"Unexpected Error Happened: {str(e)}"

    def test_connection(self):
        try:
            options = {'scheme': 'mysql'}
            on_connect_options = options.copy()
            session = MockDbSession(Tasks.SessionInfoTask,
                                    True,
                                    options,
                                    on_connect_options,
                                    {
                                        common.MySQLData.CONNECTION_ID: 5,
                                        common.MySQLData.VERSION_INFO: "8.0.30",
                                        common.MySQLData.SQL_MODE: "SOME SQL MODE"
                                    },
                                    expected_queries=[(("""SELECT connection_id(),
                            @@version,
                            @@SESSION.sql_mode""", None), MockResult([[5, "8.0.30", "SOME SQL MODE"]]))])

            session.reconnect()

        except Exception as e:
            assert False, f"Unexpected Error Happened: {str(e)}"


class TestHeatWaveCheckTask:
    def test_initialization(self):
        try:
            options = {'scheme': 'mysql', Tasks.HeatWaveCheckTask._OPT: True}
            on_connect_options = options.copy()
            on_connect_options.pop(Tasks.HeatWaveCheckTask._OPT)
            session = MockDbSession(Tasks.HeatWaveCheckTask,
                                    False,
                                    options,
                                    on_connect_options,
                                    {
                                        common.MySQLData.HEATWAVE_AVAILABLE: False
                                    })
        except Exception as e:
            assert False, f"Unexpected Error Happened: {str(e)}"

    def test_connection_hw_check_already_known(self):
        try:
            # Each item is compsed of
            # check skipped
            # known value
            # expected value
            test_data = [
                (True, None, False),  # skipped, unknown
                (True, True, True),  # skipped, known to be True
                (True, False, False),  # skipped, known to be False
                (False, True, True),  # not skipped, known to be True
                (False, False, False),  # not skipped, known to be False
                (False, None, True),  # not skipped, should be True
                (False, None, False),  # not skipped, should be False

                # Backwards compatibility tests for the case where the option
                # is missing on the connection data
                (None, True, True),  # skipped not set, known to be True
                (None, False, False),  # skipped not set, known to be False
                (None, None, True),  # skipped not set, should be True
                (None, None, False),  # skipped not set, should be False
            ]

            for tuple in test_data:
                skipped, known, expected = tuple

                options = {'scheme': 'mysql'}
                on_connect_options = options.copy()

                if skipped is not None:
                    options[Tasks.HeatWaveCheckTask._OPT] = skipped

                known_data = {}
                if known is not None:
                    known_data[common.MySQLData.HEATWAVE_AVAILABLE] = known

                expected_data = {
                    common.MySQLData.HEATWAVE_AVAILABLE: expected
                }

                expected_queries = []
                if not skipped and known is None:
                    if expected:
                        result = MockResult([['rpd_nodes']])
                    else:
                        result = MockResult([])
                    expected_queries = [(("""SELECT TABLE_NAME FROM `information_schema`.`TABLES`
                    WHERE TABLE_SCHEMA = 'performance_schema'
                        AND TABLE_NAME = 'rpd_nodes'""", None), result)]

                session = MockDbSession(Tasks.HeatWaveCheckTask,
                                        True,
                                        options,
                                        on_connect_options,
                                        expected_data,
                                        known_data=known_data,
                                        expected_queries=expected_queries)
                session.reconnect()
        except Exception as e:
            assert False, f"Unexpected Error Happened: {str(e)}"
