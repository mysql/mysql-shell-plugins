# Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import datetime
import json
import os
import sqlite3
import time
import uuid
import stat

import mysqlsh
import pytest

import config
import gui_plugin.core.Logger as logger
from gui_plugin.core.dbms.DbMySQLSession import DbMysqlSession
from gui_plugin.core.dbms.DbSqliteSession import DbSqliteSession
from gui_plugin.dbconnections import DbConnections
from tests.lib.utils import backend_callback, backend_callback_with_pending


def create_sqlite3_db(db_path):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.close()


@pytest.fixture
def sqlite_session():  # pragma: no cover
    db_session_class = DbSqliteSession
    # We have to make sure that db exists
    db_path = os.path.abspath(os.path.join(mysqlsh.plugin_manager.general.get_shell_user_dir(),  # pylint: disable=no-member
                                           'plugin_data', 'gui_plugin', f'user_3', 'tests.sqlite3'))
    create_sqlite3_db(db_path)

    db_session = db_session_class(uuid.uuid1(), True, {
        "db_file": "tests.sqlite3"
    })

    db_session.execute("""CREATE TABLE IF NOT EXISTS log(
        event_time DATETIME NULL,
        event_type VARCHAR(45) NULL,
        message TEXT NULL)""")

    db_session.execute("DELETE FROM log")

    db_session.execute(
        "CREATE VIEW IF NOT EXISTS test_view AS SELECT * FROM db_connection")

    yield db_session

    db_session.close()


@pytest.fixture(scope='session')
def mysql_connections_exists():  # pragma: no cover
    results = []
    connection = config.Config.get_instance(
    ).database_connections[0]['options'].copy()
    del connection['portStr']
    # for connection in config.Config.get_instance().database_connections:

    result = DbConnections.add_db_connection(1, {
        "db_type": "MySQL",
        "caption": "This is a test MySQL database",
        "description": "This is a test MySQL database description",
        "options": connection
    }, 'tests')

    connection_id = result

    results.append({
        "id": connection_id,
        "connection": connection})

    yield results

    for result in results:
        DbConnections.remove_db_connection(1, result["id"])


@pytest.fixture(scope='session')
def mysql_sessions(mysql_connections_exists):  # pragma: no cover
    sessions = []

    # for connection in mysql_connections_exists:
    connection_options = mysql_connections_exists[0]['connection']
    try:
        db_session = DbMysqlSession(uuid.uuid1(), True, connection_options)

        db_session.execute("DROP SCHEMA IF EXISTS tests")
        db_session.execute("CREATE DATABASE IF NOT EXISTS tests")
        db_session.execute("""CREATE TABLE IF NOT EXISTS tests.test1 (
            `id` smallint unsigned NOT NULL AUTO_INCREMENT,
            `column1` varchar(45) NOT NULL,
            `column2` varchar(45) NOT NULL,
            `column3` json,
            `last_update` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
            ) ENGINE=InnoDB""")

        for index in range(10):
            json_object = {
                "key1": f"key1_value_{index}",
                "key2": f"key2_value_{index}"
            }

            db_session.execute(f'''INSERT INTO tests.test1 (column1, column2, column3, last_update)
                VALUES
                ('column1_{index}',
                'column2_{index}',
                '{json.dumps(json_object)}',
                '{time.strftime("%Y-%m-%d %H:%M:%S")}')''')

        sessions.append(db_session)

    except Exception as e:
        logger.exception(e, "GOT EXCEPTION INITIALIZING MYSQL SESSION!!!!")
        logger.debug(connection_options)
        # db_session.close()

    yield sessions

    for session in sessions:
        session.close()
        session._term_complete.wait()


class TestDbSessionSqlite():

    def test_instance(self):
        with pytest.raises(Exception) as exp:
            DbSqliteSession(uuid.uuid1(), True, None)
        assert str(
            exp.value) == "Error[MSG-1202]: No connection_options dict given."

        with pytest.raises(Exception) as exp:
            DbSqliteSession(uuid.uuid1(), True, {})
        assert str(
            exp.value) == "Error[MSG-1202]: The 'db_file' option was not set for the '' database."

        # TODO(rennox): This test should be at a different location, no longer part of the SqliteSession
        # with pytest.raises(Exception) as exp:
        #     DbSqliteSession(MockWebSession(), {
        #         "db_file": "../tests.sqlite3"
        #     })
        # assert str(
        #     exp.value) == "Error[MSG-1001]: Trying to access outside the user space on 'tests' database."

        # if sys.platform == 'win32':
        #     with pytest.raises(Exception) as exp:
        #         DbSqliteSession(uuid.uuid1(), False, {
        #             "db_file": r"c:\tests.sqlite3"
        #         })
        # else:
        #     with pytest.raises(Exception) as exp:
        #         DbSqliteSession(uuid.uuid1(), False, {
        #             "db_file": "/tests.sqlite3"
        #         })
        # assert str(
        #     exp.value) == "Error[MSG-1000]: Absolute paths are not allowed when running a remote session for 'tests' database."

        # db_path = os.path.abspath(os.path.join(mysqlsh.plugin_manager.general.get_shell_user_dir(),
        #                                        'plugin_data', 'gui_plugin', f'user_3', 'tests.sqlite3'))
        # create_sqlite3_db(db_path)
        # db_session = DbSqliteSession(MockWebSession(local=True), {
        #     "db_file": db_path
        # })
        # assert db_session is not None
        # db_session.close()

        db_session = DbSqliteSession(uuid.uuid1(), False, {
            "db_file": "tests.sqlite3"
        })
        assert db_session is not None
        db_session.close()

        assert os.path.isfile("tests.sqlite3")
        assert oct(os.stat("tests.sqlite3").st_mode) == oct(stat.S_IFREG | stat.S_IRUSR | stat.S_IWUSR) # '0o100600'

    # TODO(rennox): Duplicate tests for non threaded sessions
    def test_bad_query(self, sqlite_session):

        @backend_callback_with_pending()
        def func(state, message, request_id, values):
            assert state == "ERROR"
            assert 'syntax error' in message
            assert request_id == func.request_id
            assert values == {
                "request_state": {
                    "type": "ERROR",
                    "msg": 'near "SELECTAA": syntax error',
                    "source": "SQLITE"
                }
            }

            # assert sqlite_session.last_error is not None
            assert 'syntax error' in sqlite_session.last_error

        # cspell:ignore SELECTAA
        sqlite_session.execute(
            request_id=func.request_id, sql="SELECTAA * FROM unknown", callback=func, options=func.options)

        func.join_and_validate()

    # TODO(rennox): Duplicate tests for non threaded sessions
    def test_rollback(self, sqlite_session):
        @backend_callback_with_pending()
        def insert_callback(state, message, request_id, data):
            pass

        @backend_callback_with_pending()
        def verification_callback(state, message, request_id, data):
            pass

        now = datetime.datetime.now()
        sqlite_session.start_transaction()
        sqlite_session.execute('''INSERT INTO log(event_time, event_type, message)
            VALUES (?, ?, ?)''',
                               (now, 'error', 'just some message'),
                               callback=insert_callback,
                               request_id=insert_callback.request_id)

        insert_callback.join_and_validate()

        sqlite_session.rollback()
        rows = sqlite_session.execute(
            "SELECT * FROM log WHERE event_time=?", (now,),
            callback=verification_callback,
            request_id=verification_callback.request_id)

        verification_callback.join_and_validate()
        assert not rows

    # TODO(rennox): Duplicate tests for non threaded sessions

    def test_select(self, sqlite_session):
        @backend_callback_with_pending()
        def validate1(state, message, request_id, values):
            # Test for the select data
            assert 'total_row_count' in values
            assert 'rows' in values

            assert len(values['rows']) == 0
            assert values['total_row_count'] == 0

        @backend_callback_with_pending()
        def validate2(state, message, request_id, values):
            assert 'total_row_count' in values
            assert 'rows' in values

            assert len(values['rows']) == 5
            assert values['total_row_count'] == 5

            assert values["columns"] == [{'name': 'event_time', 'type': 'str'},
                                         {'name': 'event_type', 'type': 'str'},
                                         {'name': 'message', 'type': 'str'}]

            for index in range(5):
                row = values['rows'][index]
                assert len(row) == 3

                assert row[1] == 'error'
                assert row[2] == f'just some message {index}'

        @backend_callback(10)
        def insert_callback(state, message, request_id, values):
            pass

        sqlite_session.execute("SELECT * FROM log",
                               request_id=validate1.request_id, callback=validate1, options=validate1.options)

        validate1.join_and_validate()

        #  Insert 5 rows into the log table
        for index in range(5):
            now = datetime.datetime.now()
            sqlite_session.execute('''INSERT INTO log(event_time, event_type, message)
                VALUES (?, ?, ?)''',
                                   (now, 'error',
                                    f'just some message {index}'),
                                   callback=insert_callback,
                                   request_id=insert_callback.request_id)
        insert_callback.join_and_validate()

        # Check if the 5 log rows were inserted
        sqlite_session.execute("SELECT * FROM log",
                               request_id=validate2.request_id, callback=validate2, options=validate2.options)
        validate2.join_and_validate()

    # TODO(rennox): Duplicate tests for non threaded sessions
    def test_start_connection_commit(self, sqlite_session):
        now = str(datetime.datetime.now())
        event_type = 'error'
        log_message = 'just some message'

        @backend_callback_with_pending()
        def insert_callback(state, message, request_id, values):
            assert 'total_row_count' in values
            assert 'execution_time' in values
            assert 'last_insert_id' in values
            assert 'rows_affected' in values
            assert 'rows' in values

            assert values['total_row_count'] == 0
            assert values['rows_affected'] == 1
            assert values['last_insert_id'] == 1

        @backend_callback_with_pending()
        def verification_callback(state, message, request_id, values):
            assert 'total_row_count' in values
            assert 'execution_time' in values
            assert 'last_insert_id' in values
            assert 'rows' in values
            assert len(values['rows']) == 1
            assert values['last_insert_id'] == 1
            assert values['total_row_count'] == 1

            assert {'name': 'event_time', 'type': 'str'} in values['columns']
            assert {'name': 'event_type', 'type': 'str'} in values['columns']
            assert {'name': 'message', 'type': 'str'} in values['columns']
            assert values['rows'][0][0] == now
            assert values['rows'][0][1] == event_type
            assert values['rows'][0][2] == log_message

        sqlite_session.start_transaction()
        sqlite_session.execute('''INSERT INTO log(event_time, event_type, message)
            VALUES (?, ?, ?)''',
                               (now, event_type, log_message),
                               callback=insert_callback,
                               request_id=insert_callback.request_id)

        insert_callback.join_and_validate()

        sqlite_session.commit()

        sqlite_session.execute("SELECT * FROM log WHERE event_time=?",
                               (now, ),
                               callback=verification_callback,
                               request_id=verification_callback.request_id)
        verification_callback.join_and_validate()


class TestDbMysqlSession:
    def test_instance(self, mysql_connections_exists):
        connection_config = mysql_connections_exists[0]['connection']

        with pytest.raises(Exception) as excinfo:
            session = DbMysqlSession(uuid.uuid1(), True, 'some string')
        assert 'No connection_options dict given.' in str(excinfo)

        session = DbMysqlSession(uuid.uuid1(), True, connection_config)

        session.close()

    def test_bad_query(self, mysql_sessions):
        session = mysql_sessions[0]

        @backend_callback_with_pending()
        def func(state, message, request_id, data=None):
            assert state == 'ERROR'

        session.execute("SELECT INSERT SHOW",
                        request_id=func.request_id,
                        callback=func,
                        options=func.options)
        func.join_and_validate()

    def test_select(self, mysql_sessions):
        session = mysql_sessions[0]

        @backend_callback_with_pending()
        def func(state, message, request_id, values):
            assert "rows" in values
            assert len(values['rows']) > 0

            assert 'columns' in values
            assert len(values['columns']) > 0

            row0 = values['rows'][0]

            if 'result_format' not in func.options or func.options['result_format'] == 'list':
                assert values["columns"] == [{'length': 5, 'name': 'id', 'type': 'SMALLINT'},
                                             {'length': 180, 'name': 'column1',
                                                 'type': 'STRING'},
                                             {'length': 180, 'name': 'column2',
                                                 'type': 'STRING'},
                                             {'length': 4294967295,
                                                 'name': 'column3', 'type': 'JSON'},
                                             {'length': 19, 'name': 'last_update', 'type': 'DATETIME'}]
                assert row0[1] == 'column1_0'
                assert row0[2] == 'column2_0'
                assert json.loads(row0[3]) == {
                    "key1": "key1_value_0", "key2": "key2_value_0"}
                return

            assert 'column1' in row0
            assert row0['column1'] == 'column1_0'
            assert 'column2' in row0
            assert row0['column2'] == 'column2_0'
            assert 'column3' in row0
            assert isinstance(row0['column3'], dict)

            assert 'last_update' in row0

        @backend_callback_with_pending()
        def func_empty(state, message, request_id, values):
            assert "rows" in values
            assert len(values['rows']) == 0

        session.execute("SELECT * FROM tests.test1 where column1 like ? AND column2 like ?",
                        request_id=func.request_id,
                        params=['column1_%', 'column2_%'],
                        callback=func,
                        options=func.options)
        func.join_and_validate()
        func.reset()

        session.execute("SELECT * FROM tests.test1 where column1 like ? AND column2 like ?",
                        request_id=func.request_id,
                        params=['column1_%', 'column2_%'],
                        callback=func,
                        options=func.options)
        func.join_and_validate()

        session.execute("SELECT * FROM tests.test1 where column1 like ? AND column2 like ?",
                        request_id=func_empty.request_id,
                        params=['aaaa%', 'bbbb%'],
                        callback=func_empty,
                        options=func_empty.options)
        func_empty.join_and_validate()

    def test_insert(self, mysql_sessions):
        session = mysql_sessions[0]
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        @backend_callback_with_pending()
        def func(state, message, request_id, values):
            assert "rows" in values
            assert "total_row_count" in values
            assert "execution_time" in values
            assert "rows_affected" in values
            assert "last_insert_id" in values
            assert values['rows_affected'] == 1

        session.execute(f'''INSERT INTO tests.test1 (column1, column2, column3, last_update)
            VALUES
            ('transaction_column1', 'transaction_column2', '{json.dumps(func.options)}', '{now}')''',
                        request_id=func.request_id,
                        callback=func,
                        options=func.options)
        func.join_and_validate()

    # @pytest.mark.skip("Test failing due to Bug #104225")
    def test_start_transaction_commit(self, mysql_sessions):
        session = mysql_sessions[0]

        @backend_callback_with_pending()
        def func(state, message, request_id, values):
            # Verify the values structure
            assert "rows" in values
            assert "total_row_count" in values
            assert "execution_time" in values

        @backend_callback_with_pending()
        def count_callback(state, message, request_id, values):
            # Verify the values structure
            assert "rows" in values
            assert "total_row_count" in values
            assert "execution_time" in values
            assert len(values['rows']) > 0

            result = values['rows'][0]

            assert {'length': 21, 'name': 'cnt',
                    'type': 'INT'} in values["columns"]

            if count_callback.row_count == -1:
                count_callback.row_count = result[0]
            else:
                assert result[0] == count_callback.row_count + 1

        count_callback.row_count = -1
        session.execute(f'''SELECT COUNT(*) as cnt FROM tests.test1''',
                        request_id=count_callback.request_id,
                        callback=count_callback,
                        options=count_callback.options)

        count_callback.join_and_validate()

        now = datetime.datetime.now()

        session.start_transaction()
        session.execute(f'''INSERT INTO tests.test1 (column1, column2, column3, last_update)
            VALUES
            ('transaction_column1',
            'transaction_column2',
            '{json.dumps(func.options)}',
            '{now.strftime("%Y-%m-%d %H:%M:%S")}')''',
                        request_id=func.request_id,
                        callback=func,
                        options=func.options)
        session.commit()
        func.join_and_validate()

        count_callback.reset()
        session.execute(f'''SELECT COUNT(*) as cnt FROM tests.test1''',
                        request_id=count_callback.request_id,
                        callback=count_callback,
                        options=count_callback.options)
        count_callback.join_and_validate()

    # @pytest.mark.skip("Test failing due to Bug #104225")
    def test_start_transaction_rollback(self, mysql_sessions):
        session = mysql_sessions[0]

        @backend_callback_with_pending()
        def func(state, message, request_id, values):
            # Verify the values structure
            assert "rows" in values
            assert "total_row_count" in values
            assert "execution_time" in values

        @backend_callback_with_pending()
        def count_callback(state, message, request_id, values):
            # Verify the values structure
            assert "rows" in values
            assert "total_row_count" in values
            assert "execution_time" in values
            assert len(values['rows']) > 0

            result = values['rows'][0]

            assert {'length': 21, 'name': 'cnt',
                    'type': 'INT'} in values['columns']

            if count_callback.row_count == -1:
                count_callback.row_count = result[0]
            else:
                assert result[0] == count_callback.row_count

        count_callback.row_count = -1

        session.execute(f'''SELECT COUNT(*) as cnt FROM tests.test1''',
                        request_id=count_callback.request_id,
                        callback=count_callback,
                        options=count_callback.options)

        count_callback.join_and_validate()

        now = datetime.datetime.now()

        session.start_transaction()
        session.execute(f'''INSERT INTO tests.test1 (column1, column2, column3, last_update)
            VALUES
            ('transaction_column1',
            'transaction_column2',
            '{json.dumps(func.options)}',
            '{now.strftime("%Y-%m-%d %H:%M:%S")}')''',
                        request_id=func.request_id,
                        callback=func,
                        options=func.options)

        session.rollback()

        count_callback.reset()
        session.execute(f'''SELECT COUNT(*) as cnt FROM tests.test1''',
                        request_id=count_callback.request_id,
                        callback=count_callback,
                        options=count_callback.options)

        count_callback.join_and_validate()

    def test_execution_time(self, mysql_sessions):
        session = mysql_sessions[0]

        @backend_callback_with_pending()
        def func(state, message, request_id, values):
            assert "rows" in values
            assert len(values['rows']) > 0

        func.counter = 0
        session.execute(sql='SELECT * FROM mysql.user',
                        request_id=func.request_id, callback=func, options=func.options)
        func.join_and_validate()

        assert session.last_execution_time is not None
        assert session.last_execution_time >= 0
