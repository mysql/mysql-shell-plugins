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

import mysqlsh
from gui_plugin.core.DbSession import DbSession, DbSessionFactory
from gui_plugin.core.DbSessionTasks import DbExecuteTask, check_supported_type
from gui_plugin.core.Error import MSGException
import gui_plugin.core.Error as Error
from gui_plugin.core.dbms.DbMySQLSessionTasks import MySQLOneFieldTask, MySQLOneFieldListTask
from gui_plugin.core.dbms.DbMySQLSessionTasks import MySQLBaseObjectTask, MySQLTableObjectTask
from gui_plugin.core.lib.OciUtils import BastionHandler
from gui_plugin.core import Filtering
import base64
import gui_plugin.core.Logger as logger
import sys
import time


@DbSessionFactory.register_session('MySQL')
class DbMysqlSession(DbSession):
    _supported_types = [{"name": "Schema",        "type": "CATALOG_OBJECT"},
                        {"name": "User Variable", "type": "CATALOG_OBJECT"},
                        {"name": "User",          "type": "CATALOG_OBJECT"},
                        {"name": "Engine",        "type": "CATALOG_OBJECT"},
                        {"name": "Plugin",        "type": "CATALOG_OBJECT"},
                        {"name": "Character Set", "type": "CATALOG_OBJECT"},
                        {"name": "Table",         "type": "SCHEMA_OBJECT"},
                        {"name": "View",          "type": "SCHEMA_OBJECT"},
                        {"name": "Routine",       "type": "SCHEMA_OBJECT"},
                        {"name": "Event",         "type": "SCHEMA_OBJECT"},
                        {"name": "Trigger",       "type": "TABLE_OBJECT"},
                        {"name": "Foreign Key",   "type": "TABLE_OBJECT"},
                        {"name": "Index",         "type": "TABLE_OBJECT"},
                        {"name": "Column",        "type": "TABLE_OBJECT"}]

    def __init__(self, id, threaded, connection_options, ping_interval=None,
                 auto_reconnect=False, on_connected_cb=None, on_failed_cb=None,
                 prompt_cb=None, pwd_prompt_cb=None, message_callback=None):
        super().__init__(id, threaded, connection_options, ping_interval=ping_interval,
                         auto_reconnect=auto_reconnect)

        self._connection_options_backup = connection_options.copy()
        self._pwd_prompt_cb = pwd_prompt_cb
        self._prompt_cb = prompt_cb
        self._connected_cb = on_connected_cb
        self._failed_cb = on_failed_cb
        self.session = None
        self._message_callback = message_callback if message_callback is not None else message_callback
        self._shell_ctx = None

        if not 'scheme' in self._connection_options:
            raise MSGException(Error.DB_INVALID_OPTIONS,
                               "MySQL scheme not defined in the connection options.")

        if self._connection_options["scheme"] not in ["mysql", "mysqlx"]:
            raise MSGException(Error.DB_INVALID_OPTIONS,
                               "Invalid MySQL scheme defined in the connection options. Valid values are 'mysql' and 'mysqlx'.")

        self.open()

    def on_shell_prompt(self, text, options):
        if 'type' in options and options['type'] == 'password':
            logger.add_filter({
                "type": "key",
                "key": "reply",
                "expire": Filtering.FilterExpire.OnUse
            })

        return self._prompt_cb(text, options)

    def on_shell_print(self, text):
        sys.real_stdout.write(text)

    def on_shell_print_diag(self, text):
        sys.real_stderr.write(text)

    def on_shell_print_error(self, text):
        sys.real_stderr.write(text)

    def _open_database(self, notify_success=True):
        shell = mysqlsh.globals.shell

        self._shell_ctx = shell.create_context({"printDelegate": lambda x: self.on_shell_print(x),
                                                "diagDelegate": lambda x: self.on_shell_print_diag(x),
                                                "errorDelegate": lambda x: self.on_shell_print_error(x),
                                                "promptDelegate": lambda x, o: self.on_shell_prompt(x, o), })
        self._shell = self._shell_ctx.get_shell()

        self._do_connect(notify_success=notify_success)

    def _setup_bastion_session(self):
        bastion_handler = BastionHandler(
            lambda message: self._message_callback('PENDING', message))

        # Database ping interval of 60 seconds
        self._ping_interval = 60

        # Restore the MDS connection options required to create the new bastion
        missing = self._connection_options_backup.keys() - self._connection_options.keys()
        for k in missing:
            self._connection_options[k] = self._connection_options_backup[k]

        # Performs the setup and updates the connection options
        self._connection_options = bastion_handler.establish_connection(
            self._connection_options)

    def _do_connect(self, notify_success=True):
        try:
            # Check if MDS options have been specified
            if 'mysql-db-system-id' in self._connection_options_backup:
                self._setup_bastion_session()

            self.session = self._shell.open_session(self._connection_options)

            result = self.session.run_sql(
                """SELECT connection_id(),
                        @@version,
                        @@SESSION.sql_mode""").fetch_all()[0]

            self.connection_id = result[0]
            self.version_info = result[1]
            self.initial_sql_mode = result[2]

            if not self._connected_cb is None and notify_success:
                self._connected_cb(self)
            return True
        except Exception as e:
            if self._failed_cb is None:
                raise e

            self._failed_cb(e)
        return False

    def _close_database(self, finalize):
        if self.session and self.session.is_open():
            self.session.close()

        if finalize and not self._shell_ctx is None:
            self._shell_ctx.finalize()

    def _reconnect(self, auto_reconnect=False):
        self._close_database(False)

        if auto_reconnect and self._auto_reconnect:
            # Automatic reconnection loop only if enabled and required
            for attempts in range(3):
                try:
                    logger.debug3(f"Reconnecting {self._id}...")
                    if self._do_connect(False):
                        return True
                except Exception as e:
                    logger.error(f"Reconnecting session: {str(e)}")
                    if attempts < 2:
                        time.sleep(5)
        else:
            # Executed when the reconnection is triggered by the user
            logger.debug3(f"Reconnecting {self._id}...")
            return self._do_connect(True)

        return False

    def do_execute(self, sql, params=None):
        while True:
            try:
                self.cursor = self.session.run_sql(sql, params)
                return self.cursor
            except mysqlsh.DBError as e:
                if e.code == 2013:
                    if self._auto_reconnect and self._reconnect(auto_reconnect=True):
                        continue
                raise
            except RuntimeError as e:
                if "Not connected." in str(e):
                    if self._auto_reconnect and self._reconnect(auto_reconnect=True):
                        continue
                raise

    def next_result(self):
        return self.cursor.next_result()

    def row_generator(self):
        row = self.cursor.fetch_one()

        while row:
            yield row
            row = self.cursor.fetch_one()

    def _strip_type_name(self, type_name):
        if not isinstance(type_name, str):
            type_name = str(type_name)
        return type_name[6:-1] if "<Type." in type_name else type_name

    def get_column_info(self, row=None):
        columns = []
        for column in self.cursor.get_columns():
            columns.append({"name": column.get_column_label(),
                            "type": self._strip_type_name(column.get_type()),
                            "length": column.get_length()})

        return columns

    def row_to_container(self, row, columns):
        row_data = ()
        for index in range(len(columns)):
            # If the data is stored in bytes, convert to a base64 string but truncate at 257 bytes
            if type(row[index]) is bytes:
                row_data += (base64.b64encode(row[index]
                             [0:256]).decode("utf-8"), )
            else:
                row_data += (row[index], )

        return row_data

    def _get_stats(self, resultset):
        last_insert_id = None
        try:
            last_insert_id = resultset.get_auto_increment_value()
        finally:
            return {
                "last_insert_id": last_insert_id,
                "rows_affected": resultset.get_affected_items_count()
            }

    def info(self):
        return {
            "version": self.version_info.split('-')[0],
            "edition": self.version_info.split('-')[1] if "-" in self.version_info else "",
            "sql_mode": self.initial_sql_mode
        }

    def start_transaction(self):
        self.execute("START TRANSACTION")

    def kill_query(self, user_session):
        user_session._killed = True
        self.session.run_sql(f"KILL QUERY {user_session.connection_id}")

    def get_default_schema(self):
        return self._connection_options['schema'] if 'schema' in self._connection_options else ''

    def get_current_schema(self, request_id, callback=None, options=None):
        self.add_task(MySQLOneFieldTask(self, request_id,
                                        "SELECT DATABASE()", result_callback=callback, options=options))

    def set_current_schema(self, request_id, schema_name, callback=None, options=None):
        self.add_task(DbExecuteTask(self, request_id,
                                    f"USE {schema_name}", result_callback=callback, options=options))

    def get_auto_commit(self, request_id, callback=None, options=None):
        self.add_task(MySQLOneFieldTask(self, request_id,
                                        "SELECT @@AUTOCOMMIT", result_callback=callback, options=options))

    def set_auto_commit(self, request_id, state, callback=None, options=None):
        self.add_task(DbExecuteTask(self, request_id,
                                    f"SET AUTOCOMMIT={1 if state == True else 0}", result_callback=callback, options=options))

    def get_objects_types(self, request_id, callback=None):
        callback("OK", "", request_id, self._supported_types)

    @check_supported_type
    def get_catalog_object_names(self, request_id, type, filter, callback=None):
        params = (filter,)
        if type == "Schema":
            sql = """SELECT SCHEMA_NAME
                    FROM information_schema.schemata
                    WHERE SCHEMA_NAME like ?
                    ORDER BY SCHEMA_NAME"""
        elif type == "User Variable":
            sql = """SELECT VARIABLE_NAME
                    FROM performance_schema.user_variables_by_thread
                    WHERE VARIABLE_NAME like ?
                    ORDER BY VARIABLE_NAME"""
        elif type == "User":
            sql = """SELECT concat(User, '@', Host)
                    FROM mysql.user
                    WHERE concat(User, '@', Host)  like ?
                    ORDER BY concat(User, '@', Host)"""
        elif type == "Engine":
            sql = """SELECT ENGINE
                    FROM information_schema.ENGINES
                    WHERE ENGINE like ?
                    ORDER BY ENGINE"""
        elif type == "Plugin":
            sql = """SELECT PLUGIN_NAME
                    FROM information_schema.PLUGINS
                    WHERE PLUGIN_NAME like ?
                    ORDER BY PLUGIN_NAME"""
        elif type == "Character Set":
            sql = """SELECT CHARACTER_SET_NAME
                    FROM information_schema.CHARACTER_SETS
                    WHERE CHARACTER_SET_NAME like ?
                    ORDER BY CHARACTER_SET_NAME"""

        self.add_task(MySQLOneFieldListTask(self, request_id, sql,
                                            result_callback=callback,
                                            params=params))

    @check_supported_type
    def get_schema_object_names(self, request_id, type, schema_name, filter, routine_type=None, callback=None):
        params = (schema_name, filter)
        if type == "Table":
            sql = """SELECT TABLE_NAME
                    FROM information_schema.tables
                    WHERE TABLE_TYPE='BASE TABLE' AND table_schema = ?
                    AND TABLE_NAME like ?
                    ORDER BY TABLE_NAME"""
        elif type == "View":
            sql = """SELECT TABLE_NAME
                    FROM information_schema.views
                    WHERE table_schema = ?
                    UNION
                    SELECT TABLE_NAME
                    FROM information_schema.tables
                    WHERE TABLE_TYPE='SYSTEM VIEW' AND table_schema = ?
                    AND TABLE_NAME like ?
                    ORDER BY TABLE_NAME"""
            params = (schema_name, schema_name, filter)
        elif type == "Routine":
            sql = """SELECT ROUTINE_NAME
                    FROM information_schema.ROUTINES
                    WHERE ROUTINE_SCHEMA = ?"""
            if routine_type:
                sql += f" AND ROUTINE_TYPE = ?"
            if filter:
                sql += f" AND ROUTINE_NAME like ?"
            sql += " ORDER BY ROUTINE_NAME"
            params = (schema_name, routine_type.upper(), filter) if routine_type else (schema_name, filter)
        elif type == "Event":
            sql = """SELECT EVENT_NAME
                    FROM information_schema.EVENTS
                    WHERE EVENT_SCHEMA = ?
                    AND EVENT_NAME like ?
                    ORDER BY EVENT_NAME"""

        self.add_task(MySQLOneFieldListTask(self, request_id, sql,
                                            result_callback=callback,
                                            params=params))

    @check_supported_type
    def get_table_object_names(self, request_id, type, schema_name, table_name, filter, callback=None):
        params = (schema_name, table_name, filter)
        if type == "Trigger":
            sql = """SELECT TRIGGER_NAME
                    FROM information_schema.TRIGGERS
                    WHERE TRIGGER_SCHEMA = ?
                        AND EVENT_OBJECT_TABLE = ?
                        AND TRIGGER_NAME LIKE ?
                    ORDER BY TRIGGER_NAME"""
        elif type == "Foreign Key":
            sql = """SELECT CONSTRAINT_NAME
                    FROM information_schema.KEY_COLUMN_USAGE
                    WHERE CONSTRAINT_SCHEMA = ?
                        AND TABLE_NAME = ?
                        AND REFERENCED_TABLE_NAME is not NULL
                        AND CONSTRAINT_NAME LIKE ?
                    ORDER BY CONSTRAINT_NAME"""
        elif type == "Index":
            sql = """SELECT INDEX_NAME
                    FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = ?
                        AND TABLE_NAME = ?
                        AND INDEX_NAME LIKE ?
                    ORDER BY INDEX_NAME"""
        elif type == "Column":
            sql = """SELECT COLUMN_NAME
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = ?
                        AND TABLE_NAME = ?
                        AND COLUMN_NAME LIKE ?
                    ORDER BY ORDINAL_POSITION"""

        self.add_task(MySQLOneFieldListTask(self, request_id, sql,
                                            result_callback=callback,
                                            params=params))

    @check_supported_type
    def get_catalog_object(self, request_id, type, name, callback=None):
        params = (name, )
        if type == "Schema":
            sql = """SELECT SCHEMA_NAME
                    FROM information_schema.schemata
                    WHERE schema_name = ?"""
        elif type == "User Variable":
            sql = """SELECT VARIABLE_NAME
                    FROM performance_schema.user_variables_by_thread
                    WHERE VARIABLE_NAME = ?"""
        elif type == "User":
            sql = """SELECT concat(User, '@', Host)
                    FROM mysql.user
                    WHERE concat(User, '@', Host)  = ?"""
        elif type == "Engine":
            sql = """SELECT ENGINE
                    FROM information_schema.ENGINES
                    WHERE ENGINE = ?"""
        elif type == "Plugin":
            sql = """SELECT PLUGIN_NAME
                    FROM information_schema.PLUGINS
                    WHERE PLUGIN_NAME = ?"""
        elif type == "Character Set":
            sql = """SELECT CHARACTER_SET_NAME
                    FROM information_schema.CHARACTER_SETS
                    WHERE CHARACTER_SET_NAME = ?"""

        self.add_task(MySQLBaseObjectTask(self, request_id, sql,
                                          result_callback=callback,
                                          type=type,
                                          name=name,
                                          params=params))

    @check_supported_type
    def get_schema_object(self, request_id, type, schema_name, name, callback=None):
        params = (schema_name, name)

        if type == "Table":
            sql = ["""SELECT TABLE_NAME
                    FROM information_schema.tables
                    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?""",
                """SELECT COLUMN_NAME
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA=? AND TABLE_NAME=?
                    ORDER BY ORDINAL_POSITION"""
                ]

            self.add_task(MySQLTableObjectTask(self, request_id, sql,
                                            result_callback=callback,
                                            name=f"{schema_name}.{name}",
                                            params=params))
        else:
            if type == "View":
                sql = """SELECT TABLE_NAME
                        FROM information_schema.views
                        WHERE table_schema = ? AND TABLE_NAME = ?"""
            elif type == "Routine":
                sql = """SELECT ROUTINE_NAME
                        FROM information_schema.ROUTINES
                        WHERE ROUTINE_SCHEMA = ? AND ROUTINE_NAME = ?"""
            elif type == "Event":
                sql = """SELECT EVENT_NAME
                        FROM information_schema.EVENTS
                        WHERE EVENT_SCHEMA = ? AND EVENT_NAME = ?"""

            self.add_task(MySQLBaseObjectTask(self, request_id, sql,
                                              result_callback=callback,
                                              type=type,
                                              name=f"{schema_name}.{name}",
                                              params=params))

    @check_supported_type
    def get_table_object(self, request_id, type, schema_name, table_name, name, callback=None):
        params = (schema_name, table_name, name)
        if type == "Trigger":
            sql = """SELECT TRIGGER_NAME
                    FROM information_schema.TRIGGERS
                    WHERE TRIGGER_SCHEMA = ?
                        AND EVENT_OBJECT_TABLE = ?
                        AND TRIGGER_NAME LIKE ?"""
        elif type == "Foreign Key":
            sql = """SELECT CONSTRAINT_NAME
                    FROM information_schema.KEY_COLUMN_USAGE
                    WHERE CONSTRAINT_SCHEMA = ?
                        AND TABLE_NAME = ?
                        AND REFERENCED_TABLE_NAME is not NULL
                        AND CONSTRAINT_NAME LIKE ?"""
        elif type == "Index":
            sql = """SELECT INDEX_NAME
                    FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = ?
                        AND TABLE_NAME = ?
                        AND INDEX_NAME LIKE ?"""
        elif type == "Column":
            sql = """SELECT COLUMN_NAME
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = ?
                        AND TABLE_NAME = ?
                        AND COLUMN_NAME LIKE ?"""

        self.add_task(MySQLBaseObjectTask(self, request_id, sql,
                                          result_callback=callback,
                                          type=type,
                                          name=f"{schema_name}.{name}",
                                          params=params))
