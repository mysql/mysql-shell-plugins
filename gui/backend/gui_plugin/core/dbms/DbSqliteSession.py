# Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

from asyncio.log import logger
import sqlite3
import mysqlsh
import os.path
import time
from pathlib import Path
from gui_plugin.core.DbSession import DbSession, DbSessionFactory
from gui_plugin.core.dbms.DbSqliteSessionTasks import SqliteOneFieldListTask, SqliteSetCurrentSchemaTask
from gui_plugin.core.dbms.DbSqliteSessionTasks import SqliteBaseObjectTask, SqliteTableObjectTask, SqliteGetAutoCommit
from gui_plugin.core.Error import MSGException
import gui_plugin.core.Error as Error
from gui_plugin.core.DbSessionTasks import check_supported_type
import gui_plugin.core.Logger as logger


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
        if self._last_error:
            return self._last_error
        else:
            return None

    def execute(self, sql, params=None):
        # reset last error and execution time
        self.set_last_error(None)
        self.last_execution_time = None

        start_time = time.time()
        # call excute of parent class
        #res = super(DbCursor, self).execute(sql, params)
        if params:
            res = super(DbCursor, self).execute(sql, params)
        else:
            res = super(DbCursor, self).execute(sql)
        #res = self.execute(sql, params)
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
    _supported_types = [{"name": "Schema", "type": "CATALOG_OBJECT"},
                        {"name": "Table",  "type": "SCHEMA_OBJECT"},
                        {"name": "View",   "type": "SCHEMA_OBJECT"},
                        {"name": "Trigger",   "type": "TABLE_OBJECT"},
                        {"name": "Index",   "type": "TABLE_OBJECT"},
                        {"name": "Column",   "type": "TABLE_OBJECT"}]

    def __init__(self, id, threaded, connection_options, ping_interval=None, auto_reconnect=True,
                 on_connected_cb=None, on_failed_cb=None, prompt_cb=None, pwd_prompt_cb=None,
                 message_callback=None, check_same_thread=True):
        super().__init__(id, threaded, connection_options, ping_interval=ping_interval,
                         auto_reconnect=auto_reconnect)

        self._connected_cb = on_connected_cb
        self._failed_cb = on_failed_cb
        self.session = None
        self.check_same_thread = check_same_thread

        self._databases = {}

        self._add_database(self._connection_options)

        self._default_schema = self._current_schema = list(
            self._databases.keys())[0]

        if 'attach' in self._connection_options:
            for attach in self._connection_options['attach']:
                self._add_database(attach)

        self.open()

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

    def _open_database(self, notify_success=True):
        try:
            self.conn = sqlite3.connect(self._databases[self._current_schema], timeout=5, factory=SqliteConnection,
                                        isolation_level=None, check_same_thread=self.check_same_thread)
            self.cursor = self.conn.cursor()

            init_cursor = self.conn.cursor()
            init_cursor.execute("PRAGMA journal_mode = WAL")
            init_cursor.close()

            for (database_name, db_file) in self._databases.items():
                if database_name == self._current_schema:
                    continue
                self.cursor.execute(
                    f"ATTACH '{db_file}' AS '{database_name}';")

            if not self._connected_cb is None and notify_success:
                self._connected_cb(self)
        except Exception as e:
            if self._failed_cb is None:
                raise e
            else:
                self._failed_cb(e)

    def _reconnect(self, auto_reconnect=False):
        logger.debug3(f"Reconnecting {self._id}...")
        self._close_database(False)
        self._open_database(auto_reconnect is False)

    def _close_database(self, finalize):
        self.conn.close()

    # DbSession overrides

    def do_execute(self, sql, params=None):
        self.cursor = self.cursor.execute(sql, params)
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

    def get_current_schema(self, request_id, callback=None, options=None):
        # In SQLITE, 'main' is always the default database
        callback("OK", "", request_id, self._current_schema)

    def set_active_schema(self, schema_name):
        self.conn.close()
        self._current_schema = schema_name
        self._open_database(False)

    def set_current_schema(self, request_id, schema_name, callback=None, options=None):
        if options is None:
            options = {}
        options['__new_current_schema__'] = schema_name
        self.add_task(SqliteSetCurrentSchemaTask(self, request_id, params=[
                      schema_name], result_callback=callback, options=options))

    def get_auto_commit(self, request_id, callback=None, options=None):
        self.add_task(SqliteGetAutoCommit(self, request_id,
                                          result_callback=callback, options=options))

    def set_auto_commit(self, request_id, state, callback=None, options=None):
        raise MSGException(Error.CORE_FEATURE_NOT_SUPPORTED,
                           "This feature is not supported.")

    def get_objects_types(self, request_id, callback=None):
        callback("OK", "", request_id, self._supported_types)

    @check_supported_type
    def get_catalog_object_names(self, request_id, type, filter, callback=None):
        if type == "Schema":

            sql = """SELECT name
                    FROM pragma_database_list()"""
            if filter:
                sql += f" WHERE name like '{filter}'"
            sql += " ORDER BY name;"

        self.add_task(SqliteOneFieldListTask(self, request_id, sql,
                                             result_callback=callback))

    @check_supported_type
    def get_schema_object_names(self, request_id, type, schema_name, filter, routine_type=None, callback=None):
        if type == "Table":
            sql = f"""SELECT name
                       FROM `{schema_name}`.sqlite_master
                       WHERE type = 'table'"""
            if filter:
                sql += f" AND name like '{filter}'"
            sql += " ORDER BY name;"
        elif type == "View":
            sql = f"""SELECT name
                       FROM `{schema_name}`.sqlite_master
                       WHERE type = 'view'"""
            if filter:
                sql += f" AND name like '{filter}'"
            sql += " ORDER BY name;"

        self.add_task(SqliteOneFieldListTask(self, request_id, sql,
                                             result_callback=callback))

    @check_supported_type
    def get_table_object_names(self, request_id, type, schema_name, table_name, filter, callback=None):
        params = None
        if type == "Trigger":
            sql = f"""SELECT name
                      FROM `{schema_name}`.sqlite_master
                      WHERE type = 'trigger'
                        AND tbl_name = ?
                      ORDER BY name;"""
            params = (table_name, )
        elif type == "Index":
            sql = f"""SELECT name
                      FROM `{schema_name}`.sqlite_master
                      WHERE type = "index"
                        AND tbl_name = ?
                      ORDER BY name;"""
            params = (table_name, )
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
                      ORDER BY c.cid;"""
            params = (table_name, table_name, table_name)

        self.add_task(SqliteOneFieldListTask(self, request_id, sql,
                                             result_callback=callback,
                                             params=params))

    @check_supported_type
    def get_catalog_object(self, request_id, type, name, callback=None):
        if type == "Schema":

            sql = f"""SELECT name
                    FROM pragma_database_list()
                    WHERE name = '{name}'"""

        self.add_task(SqliteBaseObjectTask(self, request_id, sql,
                                           result_callback=callback,
                                           type=type,
                                           name=name))

    @check_supported_type
    def get_schema_object(self, request_id, type, schema_name, name, callback=None):
        if type == "Table":
            sql = [f"""SELECT name
                        FROM `{schema_name}`.sqlite_master
                        WHERE type = "table"
                            AND name = '{name}'
                        ORDER BY name;""",
                   ]

            self.add_task(SqliteTableObjectTask(self, request_id, sql,
                                                result_callback=callback,
                                                name=f"{schema_name}.{name}"))
        else:
            if type == "View":
                sql = f"""SELECT name
                        FROM `{schema_name}`.sqlite_master
                        WHERE type = 'view'
                            AND name = '{name}'
                        ORDER BY name;"""

            self.add_task(SqliteBaseObjectTask(self, request_id, sql,
                                               result_callback=callback,
                                               type=type,
                                               name=f"{schema_name}.{name}"))

    @check_supported_type
    def get_table_object(self, request_id, type, schema_name, table_name, name, callback=None):
        if type == "Trigger":
            sql = f"""SELECT name
                    FROM `{schema_name}`.sqlite_master
                    WHERE type = 'trigger'
                        AND tbl_name = '{table_name}'
                        AND name = '{name}'
                    ORDER BY name;"""
        elif type == "Index":
            sql = f"""SELECT name
                      FROM `{schema_name}`.sqlite_master
                      WHERE type = 'index'
                        AND tbl_name = '{table_name}'
                        AND name = '{name}'
                      ORDER BY name;"""
        elif type == "Column":
            sql = f"""SELECT name
                      FROM pragma_table_info('{table_name}', '{schema_name}')
                      WHERE name = '{name}'
                      ORDER BY name;"""

        self.add_task(SqliteBaseObjectTask(self, request_id, sql,
                                           result_callback=callback,
                                           type=type,
                                           name=f"{schema_name}.{name}"))
