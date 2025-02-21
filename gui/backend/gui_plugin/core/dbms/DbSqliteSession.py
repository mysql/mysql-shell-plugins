# Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import os.path
import sqlite3
import time
import os
import stat

import gui_plugin.core.Error as Error
import gui_plugin.core.Logger as logger
from gui_plugin.core.Context import get_context
from gui_plugin.core.dbms.DbSession import (DbSession, DbSessionFactory,
                                            ReconnectionMode)
from gui_plugin.core.dbms.DbSessionTasks import check_supported_type
from gui_plugin.core.dbms.DbSqliteSessionTasks import (
    SqliteBaseObjectTask, SqliteGetAutoCommit, SqliteOneFieldListTask,
    SqliteSetCurrentSchemaTask, SqliteTableObjectTask, SqliteColumnObjectTask,
    SqliteColumnsMetadataTask, SqliteColumnsListTask)
from gui_plugin.core.Error import MSGException


def find_schema_name(config):
    if 'database_name' in config and config['database_name'] != '':
        return config['database_name']
    elif 'db_file' in config:
        return os.path.splitext(os.path.basename(config['db_file']))[0]
    else:
        return ''


class SqliteConnection(sqlite3.Connection):
    def cursor(self):
        self.row_factory = sqlite3.Row
        c = super(SqliteConnection, self).cursor(DbCursor)
        self.row_factory = None
        return c

    def commit(self):
        super(SqliteConnection, self).commit()
        return self

    def rollback(self):
        super(SqliteConnection, self).rollback()
        return self


class DbCursor(sqlite3.Cursor):
    _last_error = None
    last_execution_time = None

    def set_last_error(self, error):
        self._last_error = error

    @property
    def last_error(self):
        return self._last_error

    def execute(self, sql, params=None):
        # reset last error and execution time
        self.set_last_error(None)
        self.last_execution_time = None

        start_time = time.time()
        # call execute of parent class
        if params:
            res = super(DbCursor, self).execute(sql, params)
        else:
            res = super(DbCursor, self).execute(sql)
        end_time = time.time()
        # set executing time
        self.last_execution_time = end_time - start_time
        return res

    def fetch_one(self):
        return self.fetchone()

    def fetch_all(self):
        return self.fetchall()

    def get_last_execution_time(self):
        return self.last_execution_time

    def get_last_row_id(self):
        # cspell:ignore lastrowid
        return self.lastrowid


@DbSessionFactory.register_session('Sqlite')
class DbSqliteSession(DbSession):
    _supported_types = [{"name": "Schema",      "type": "CATALOG_OBJECT"},
                        {"name": "Table",       "type": "SCHEMA_OBJECT"},
                        {"name": "View",        "type": "SCHEMA_OBJECT"},
                        {"name": "Trigger",     "type": "TABLE_OBJECT"},
                        {"name": "Primary Key", "type": "TABLE_OBJECT"},
                        {"name": "Index",       "type": "TABLE_OBJECT"},
                        {"name": "Column",      "type": "TABLE_OBJECT"}]

    def __init__(self, id, threaded, connection_options, data={}, auto_reconnect=ReconnectionMode.NONE, task_state_cb=None,
                 on_connected_cb=None, on_failed_cb=None, prompt_cb=None, pwd_prompt_cb=None,
                 message_callback=None):
        super().__init__(id, threaded, connection_options, data,
                         auto_reconnect=auto_reconnect, task_state_cb=task_state_cb)

        self._connected_cb = on_connected_cb
        self._failed_cb = on_failed_cb
        self.session = None

        self._databases = {}

        self._add_database(self._connection_options)

        self._default_schema = self._current_schema = list(
            self._databases.keys())[0]

        if 'attach' in self._connection_options:
            for attach in self._connection_options['attach']:
                self._add_database(attach)

        self.open()

    @property
    def database_type(self):
        return "SQLite"

    @property
    def databases(self):
        return self._databases

    def _add_database(self, config):
        # Set the database_name if not available
        db_name = find_schema_name(config)

        if 'db_file' in config and isinstance(config['db_file'], str) and config['db_file'] != "":
            self._databases[db_name] = config['db_file']
        else:
            raise MSGException(Error.DB_INVALID_OPTIONS,
                               "The 'db_file' option was not set for the '%s' database." % db_name)

    def _do_open_database(self, notify_success=True):
        try:
            self._on_connect()

            # open the database connection
            self.conn = sqlite3.connect(self._databases[self._current_schema], timeout=5, factory=SqliteConnection,
                                        isolation_level=None, check_same_thread=False)

            # restrict permissions to the database file
            os.chmod(self._databases[self._current_schema],
                     stat.S_IRUSR | stat.S_IWUSR)

            # Cursor to be used for statements from the owner of this instance
            self.cursor = None

            init_cursor = self.conn.execute("PRAGMA journal_mode = WAL")
            init_cursor.close()

            for (database_name, db_file) in self._databases.items():
                if database_name == self._current_schema:
                    continue
                self.conn.execute(f"ATTACH '{db_file}' AS '{database_name}';")

            if self._connected_cb is not None and notify_success:
                self._connected_cb(self)
        except Exception as e:
            if self._failed_cb is None:
                raise e
            else:
                self._failed_cb(e)
                return False
        return True

    def _reconnect(self, is_auto_reconnect):
        logger.debug3(f"Reconnecting session {self._id}...")
        self._close_database(False)
        self._open_database(is_auto_reconnect is False)

    def _do_close_database(self, finalize):
        self.conn.close()

    # DbSession overrides

    def do_execute(self, sql, params=None):
        try:
            self.lock()
            # NOTE: theoretically self.conn.execute(sql, params) should work.
            # Reasoning is that when the connection was created, it used SqliteConnection as factory.
            # SqliteConnection overrides the cursor() function to produce instances of DbCursor instead
            # of instances of sqlite3.Cursor when the execute function is called.
            #
            # In python 3.11.4 this stopped working, and self.conn.execute() started producing
            # instances of sqlite3.Cursor, leading to misc errors in our code which expects to be
            # using instances of DbCursor.
            #
            # A backwards compatible solution, is to explicitly create the cursor object (which guarantees =
            # it is an instance of DbCursor), and then call the execute() function in it.
            self.cursor = self.conn.cursor().execute(sql, params)
        finally:
            self.release()

        return self.cursor

    def _get_stats(self, resultset):
        return {
            "last_insert_id": resultset.lastrowid,
            "rows_affected": resultset.rowcount
        }

    def next_result(self):
        return False

    def row_generator(self):
        row = self.cursor.fetchone()

        while row:
            yield row
            row = self.cursor.fetchone()

    def get_column_info(self, row=None):
        # Because of limitation of Sqlite cursor, we cannot get info about Sqlite column type.
        # There is also no known workaround for this, so only way to get info about column type is
        # to use build-in python type function and accept python type instead Sqlite type.
        # However there is few limitations for this approach:
        #   - date, time and datetime becomes str
        #   - boolean cannot be distinguished from int
        #   - both real and numeric becomes float
        #   - if value is None, we have no clue about type, so we assume is str
        return [{"name": description[0], "type": "str" if type(row[i]).__name__ is None else type(row[i]).__name__}
                for i, description in enumerate(self.cursor.description)]

    def row_to_container(self, row, columns):
        return tuple(row)

    def info(self):
        return {}

    def start_transaction(self):
        self.execute('BEGIN TRANSACTION;')

    def kill_query(self, user_session):
        user_session._killed = True
        user_session.interrupt()

    def get_default_schema(self):
        return self._default_schema

    def get_current_schema(self, callback=None, options=None):
        return self._current_schema

    def set_active_schema(self, schema_name):
        self.conn.close()
        self._current_schema = schema_name
        self._do_open_database(False)

    def set_current_schema(self, schema_name, callback=None, options=None):
        if options is None:
            options = {}
        options['__new_current_schema__'] = schema_name
        context = get_context()
        task_id = context.request_id if context else None
        self.add_task(SqliteSetCurrentSchemaTask(self, task_id, params=[
                      schema_name], result_callback=callback, options=options))

    def get_auto_commit(self, callback=None, options=None):
        context = get_context()
        task_id = context.request_id if context else None
        self.add_task(SqliteGetAutoCommit(self, task_id,
                                          result_callback=callback, options=options))

    def set_auto_commit(self, state, callback=None, options=None):
        raise MSGException(Error.CORE_FEATURE_NOT_SUPPORTED,
                           "This feature is not supported.")

    def get_objects_types(self):
        return self._supported_types

    @check_supported_type
    def get_catalog_object_names(self, type, filter):
        if type == "Schema":

            sql = """SELECT name
                     FROM pragma_database_list()
                     WHERE name like ?
                     ORDER BY name;"""

            params = (filter,)

        if self.threaded:
            context = get_context()
            task_id = context.request_id if context else None
            self.add_task(SqliteOneFieldListTask(
                self, task_id=task_id, sql=sql, params=params))
        else:
            return self.execute(sql, params)

    @check_supported_type
    def get_schema_object_names(self, type, schema_name, filter, routine_type=None):
        if type == "Table":
            sql = f"""SELECT name
                    FROM `{schema_name}`.sqlite_master
                    WHERE type = 'table'
                    AND name like ?
                    ORDER BY name;"""
        elif type == "View":
            sql = f"""SELECT name
                    FROM `{schema_name}`.sqlite_master
                    WHERE type = 'view'
                    AND name like ?
                    ORDER BY name;"""
        params = (filter, )

        context = get_context()
        task_id = context.request_id if context else None
        self.add_task(SqliteOneFieldListTask(self, task_id=task_id, sql=sql,
                                             params=params))

    @check_supported_type
    def get_table_object_names(self, type, schema_name, table_name, filter):
        params = (table_name, filter)
        if type == "Trigger":
            sql = f"""SELECT name
                    FROM `{schema_name}`.sqlite_master
                    WHERE type = 'trigger'
                        AND tbl_name = ?
                        AND name like ?
                    ORDER BY name;"""
        elif type == "Primary Key":
            sql = """SELECT t.name
                    FROM pragma_table_info(?) as t
                    WHERE t.pk > 0
                        AND t.name like ?
                    ORDER BY t.pk;"""
        elif type == "Index":
            sql = f"""SELECT name
                    FROM `{schema_name}`.sqlite_master
                    WHERE type = 'index'
                        AND tbl_name = ?
                        AND name like ?
                    ORDER BY name;"""
        elif type == "Column":
            sql = f"""SELECT
                        c.name as column_name
                    FROM `{schema_name}`.pragma_table_info(?) AS c
                    LEFT OUTER JOIN (
                            SELECT DISTINCT m.name AS 'table_name',
                                ii.name AS 'table_column',
                                il.`unique` as UNIQUE_KEY
                            FROM sqlite_master AS m,
                                pragma_index_list(m.name) AS il,
                                pragma_index_info(il.name) AS ii
                            WHERE m.type='table' and m.tbl_name=? and
                                il.`unique`=1
                            ) ic
                    ON ic.table_name=? AND ic.table_column = c.name
                    WHERE c.name like ?
                    ORDER BY c.cid;"""
            params = (table_name, table_name, table_name, filter)

        context = get_context()
        task_id = context.request_id if context else None
        self.add_task(SqliteOneFieldListTask(self, task_id=task_id, sql=sql,
                                             params=params))

    @check_supported_type
    def get_catalog_object(self, type, name):
        if type == "Schema":
            sql = """SELECT name
                    FROM pragma_database_list()
                    WHERE name = ?"""
            params = (name,)

        context = get_context()
        task_id = context.request_id if context else None
        self.add_task(SqliteBaseObjectTask(self, task_id=task_id, sql=sql,
                                           type=type, name=name, params=params))

    @check_supported_type
    def get_schema_object(self, type, schema_name, name):
        params = (name,)
        context = get_context()
        task_id = context.request_id if context else None
        if type == "Table":
            sql = f"""SELECT name
                        FROM `{schema_name}`.sqlite_master
                        WHERE type = "table"
                            AND name = ?
                        ORDER BY name;""",

            self.add_task(SqliteTableObjectTask(self, task_id=task_id, sql=sql,
                                                name=f"{schema_name}.{name}", params=params))
        else:
            if type == "View":
                sql = f"""SELECT name
                        FROM `{schema_name}`.sqlite_master
                        WHERE type = 'view'
                            AND name = ?
                        ORDER BY name;"""

            self.add_task(SqliteBaseObjectTask(self, task_id=task_id, sql=sql,
                                               type=type, name=f"{schema_name}.{name}"))

    @check_supported_type
    def get_table_object(self, type, schema_name, table_name, name):
        params = (table_name, name)
        if type == "Trigger":
            sql = f"""SELECT name
                    FROM `{schema_name}`.sqlite_master
                    WHERE type = 'trigger'
                        AND tbl_name = ?
                        AND name = ?
                    ORDER BY name;"""
        elif type == "Primary Key":
            sql = """SELECT t.name
                    FROM pragma_table_info(?) as t
                    WHERE t.pk > 0
                        AND t.name = ?
                    ORDER BY t.pk;"""
        elif type == "Index":
            sql = f"""SELECT name
                    FROM `{schema_name}`.sqlite_master
                    WHERE type = 'index'
                        AND tbl_name = ?
                        AND name = ?
                    ORDER BY name;"""
        elif type == "Column":
            # cSpell:ignore dflt
            sql = f"""SELECT name, type, "notnull" as 'not_null', dflt_value as 'default',
                        pk as 'is_pk', pk as 'auto_increment'
                    FROM pragma_table_info('{table_name}', '{schema_name}')
                    WHERE name = ?
                    ORDER BY name;"""
            params = (name,)

        context = get_context()
        task_id = context.request_id if context else None
        if type == "Column":
            self.add_task(SqliteColumnObjectTask(self, task_id=task_id, sql=sql,
                                                 type=type, name=f"{schema_name}.{name}",
                                                 params=params))
        else:
            self.add_task(SqliteBaseObjectTask(self, task_id=task_id, sql=sql,
                                               type=type, name=f"{schema_name}.{name}",
                                               params=params))

    def get_columns_metadata(self, names):
        sql_parts = []
        params = []

        for name in names:
            sql_parts.append(f"""
                SELECT name, type, "notnull" as 'not_null', dflt_value as 'default',
                            pk as 'is_pk', pk as 'auto_increment',
                            '{name['table']}' as 'table', '{name['schema']}' as 'schema'
                        FROM pragma_table_info('{name['table']}', '{name['schema']}')
                        WHERE name = ?
            """)
            params.extend([name['column']])

        sql = " UNION ALL ".join(sql_parts)

        context = get_context()
        task_id = context.request_id if context else None
        self.add_task(SqliteColumnsMetadataTask(
            self, task_id=task_id, sql=sql, params=params))
