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

import base64
import sys
import time

import mysqlsh

import gui_plugin.core.dbms.DbMySQLSessionCommon as common
import gui_plugin.core.Error as Error
import gui_plugin.core.Logger as logger
from gui_plugin.core import Filtering
from gui_plugin.core.Context import get_context
from gui_plugin.core.dbms import DbMySQLSessionSetupTasks as SetupTasks
from gui_plugin.core.dbms import DbPingHandlerTask
from gui_plugin.core.dbms.DbMySQLSessionTasks import (MySQLBaseObjectTask,
                                                      MySQLColumnsMetadataTask,
                                                      MySQLOneFieldListTask,
                                                      MySQLOneFieldTask,
                                                      MySQLTableObjectTask,
                                                      MySQLColumnObjectTask,
                                                      MySQLColumnsListTask,
                                                      MySQLRoutinesListTask)
from gui_plugin.core.dbms.DbSession import (DbSession, DbSessionFactory,
                                            ReconnectionMode)
from gui_plugin.core.dbms.DbSessionTasks import (DbExecuteTask,
                                                 check_supported_type)
from gui_plugin.core.Error import MSGException
from gui_plugin.core.lib.OciUtils import BastionSessionRegistry

_MYSQL_INACTIVITY_TIMEOUT_ERROR = 4031
_MYSQL_SERVER_LOST_ERROR = 2013


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
                        {"name": "Primary Key",   "type": "TABLE_OBJECT"},
                        {"name": "Index",         "type": "TABLE_OBJECT"},
                        {"name": "Column",        "type": "TABLE_OBJECT"}]

    def __init__(self, id, threaded, connection_options, data={},
                 auto_reconnect=ReconnectionMode.NONE, task_state_cb=None, on_connected_cb=None, on_failed_cb=None,
                 prompt_cb=None, message_callback=None, session=None):
        super().__init__(id, threaded if session is None else False,
                         connection_options if session is None else {},
                         data if session is None else None,
                         auto_reconnect=auto_reconnect, task_state_cb=task_state_cb)

        self._prompt_cb = prompt_cb
        self._connected_cb = on_connected_cb
        self._failed_cb = on_failed_cb
        self.session = session
        self._message_callback = message_callback
        self._shell_ctx = None

        # When a Bastion Session is just created in OCI, it may get into
        # ACTIVE state and even so reject connections with "Access Denied"
        # error, the shell will then prompt if a Retry is needed, these
        # attributes are used to implement a retry logic on this specific case
        self._bastion_access_denied_retries = 0
        self._expired_bastion_session = False

        # If the session object is already provided, no connection will be created
        if self.session is None:
            if not 'scheme' in self._connection_options:
                raise MSGException(Error.DB_INVALID_OPTIONS,
                                   "MySQL scheme not defined in the connection options.")

            if self._connection_options["scheme"] not in ["mysql", "mysqlx"]:
                raise MSGException(Error.DB_INVALID_OPTIONS,
                                   "Invalid MySQL scheme defined in the connection options. Valid values are 'mysql' and 'mysqlx'.")

            self.open()

    def _initialize_setup_tasks(self):
        return [SetupTasks.SessionInfoTask(self),
                SetupTasks.HeatWaveCheckTask(self),
                SetupTasks.BastionHandlerTask(
                    self, lambda message: self._message_callback('PENDING', "", message)),
                SetupTasks.RemoveExternalOptionsTask(self),
                DbPingHandlerTask(self)]

    @property
    def database_type(self):
        return "MySQL"

    @property
    def connection_id(self):
        if common.MySQLData.CONNECTION_ID in self.data:
            return self.data[common.MySQLData.CONNECTION_ID]
        return None

    def is_connection_error(self, error):
        if self._auto_reconnect == ReconnectionMode.STANDARD:
            return error == _MYSQL_SERVER_LOST_ERROR
        elif self._auto_reconnect == ReconnectionMode.EXTENDED:
            return error in [_MYSQL_SERVER_LOST_ERROR, _MYSQL_INACTIVITY_TIMEOUT_ERROR]
        return False

    def run_sql(self, sql, args=None):
        return self.session.run_sql(sql, args)

    def on_shell_prompt(self, text, options):
        if 'type' in options:
            if options['type'] == 'password':
                logger.add_filter({
                    "type": "key",
                    "key": "reply",
                    "expire": Filtering.FilterExpire.OnUse
                })
            # On Bastion Sessions, this prompt is produced in 2 known scenarios:
            # - On a new connection through Bastion Session if the session is
            #   new, sometimes fails with "Access Denied" error and Shell
            #   triggers prompt to retry.
            # - When the reconnection logic is triggered with data for an
            #   expired Bastion Session
            elif self.bastion_session is not None and options['type'] == 'confirm' and text == "Access denied":
                # If this is a new Bastion Session, a retry logic is successfully enough
                # to make the connection succeed
                if self.bastion_session.is_new:
                    if self._bastion_access_denied_retries < 3:
                        self._bastion_access_denied_retries += 1
                        time.sleep(2)
                        return True, options['yes']
                # If this is not a new Bastion Session, then there's no reason to retry,
                # the credentials are wrong, i.e. maybe expired
                else:
                    return False, ''

        replied, value = self._prompt_cb(text, options)

        if 'type' in options and options['type'] == 'password':
            self.connection_options['password'] = value

        return replied, value

    def on_shell_print(self, text):
        sys.real_stdout.write(text)

    def on_shell_print_diag(self, text):
        sys.real_stderr.write(text)

    def on_shell_print_error(self, text):
        sys.real_stderr.write(text)

    def _do_open_database(self, notify_success=True):
        shell = mysqlsh.globals.shell

        self._shell_ctx = shell.create_context({"printDelegate": lambda x: self.on_shell_print(x),
                                                "diagDelegate": lambda x: self.on_shell_print_diag(x),
                                                "errorDelegate": lambda x: self.on_shell_print_error(x),
                                                "promptDelegate": lambda x, o: self.on_shell_prompt(x, o), })
        self._shell = self._shell_ctx.get_shell()

        return self._do_connect(failed_cb=self._failed_cb)

    def _on_connected(self, notify_success):
        # The connection succeeded, so the access_denied_retries get reset
        if self.bastion_session is not None:
            self._bastion_access_denied_retries = 0
            self.bastion_session.is_new = False

        super()._on_connected(notify_success)

        if self._connected_cb is not None and notify_success:
            self._connected_cb(self)

    def _do_connect(self, failed_cb=None):
        attempts = 3
        exception = None

        # This flag is used to control handling of SSH Bastion Session expiration once
        # otherwise it will re-create the Bastion Session up to "attempts" times which
        # is unnecessary
        handle_expired_tunnel = True
        while attempts > 0:
            try:
                self._on_connect()

                # Open Shell connection
                self.session = self._shell.open_session(
                    self._connection_options)

                return True
            except Exception as e:
                if self.bastion_session is not None and "Tunnel connection cancelled" in str(e) and handle_expired_tunnel:
                    # Try to recreate a new bastion session by expiring the
                    # current session first
                    handle_expired_tunnel = False
                    attempts -= 1
                    self.bastion_session.expire()
                    continue

                # If this is a issue during opening MySQL session
                # lets try 3 times to connect
                if "Error opening MySQL" in str(e):
                    attempts -= 1
                else:
                    attempts = 0
                exception = e

        if exception:
            # Notifies listeners about failed connection attempt
            self._on_failed_connection()

            if failed_cb is None:
                raise exception

            failed_cb(exception)
        return False

    def _do_close_database(self, finalize):
        if self.session and self.session.is_open():
            self.session.close()

        if finalize and self._shell_ctx is not None:
            self._shell_ctx.finalize()

    def _reconnect(self, is_auto_reconnect):
        logger.debug3(f"Reconnecting {self._id}...")

        # Send a notification to the FE so the user is aware about a reconnection happening
        if is_auto_reconnect and self._auto_reconnect == ReconnectionMode.STANDARD:
            self._message_callback(
                "PENDING", "Connection lost, reconnecting session...", None, self._current_task_id)

        self._close_database(False)

        # Reconnection attempts change, if it  is automatic reconnection then
        # uses 3 attempts, if it is user request then 1
        attempt_limit = 1
        if is_auto_reconnect:
            attempt_limit = 3

        # Automatic reconnection loop only if enabled and required
        for attempt in range(3):
            attempt += 1
            try:
                logger.debug3(f"Reconnecting {self._id}...")

                if self._do_connect():
                    self._on_connected(is_auto_reconnect is False)
                    return True
            except Exception as e:
                self._on_failed_connection()

                logger.error(f"Reconnecting session: {str(e)}")
                if attempt < attempt_limit:
                    time.sleep(5)

        return False

    def do_execute(self, sql, params=None):
        while True:
            try:
                self.cursor = self.session.run_sql(sql, params)
                return self.cursor
            except mysqlsh.DBError as e:
                if self.is_connection_error(e.code):
                    if self._auto_reconnect and self._reconnect(True):
                        continue
                raise
            # TODO(MiguelT): In what case we need to validate vs the error message?
            except RuntimeError as e:
                if "Not connected." in str(e):
                    if self._auto_reconnect and self._reconnect(True):
                        continue
                raise

    def next_result(self):
        return self.cursor.next_result()

    def row_generator(self):
        row = self.cursor.fetch_one()

        while row:
            yield row
            row = self.cursor.fetch_one()

    def get_column_info(self, row=None):
        columns = []
        for column in self.cursor.get_columns():
            columns.append({"name": column.get_column_label(),
                            "type": column.get_type().data,
                            "length": column.get_length()})

        return columns

    def row_to_container(self, row, columns):
        row_data = ()
        for index in range(len(columns)):
            # If the data is stored in bytes, convert to a base64 string.
            if type(row[index]) is bytes:
                row_data += (base64.b64encode(row[index]).decode("utf-8"), )
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
        ret_val = {}
        if common.MySQLData.VERSION_INFO in self.data:
            version_info = self.data[common.MySQLData.VERSION_INFO]
            ret_val["version"] = version_info.split('-')[0]
            ret_val["edition"] = version_info.split(
                '-')[1] if "-" in version_info else ""

        if common.MySQLData.SQL_MODE in self.data:
            ret_val["sql_mode"] = self.data[common.MySQLData.SQL_MODE]

        if common.MySQLData.HEATWAVE_AVAILABLE in self.data:
            ret_val["heat_wave_available"] = self.data[common.MySQLData.HEATWAVE_AVAILABLE]

        if common.MySQLData.MLE_AVAILABLE in self.data:
            ret_val["mle_available"] = self.data[common.MySQLData.MLE_AVAILABLE]

        return ret_val

    @property
    def bastion_session(self):
        if common.MySQLData.BASTION_SESSION in self.data:
            id = self.data[common.MySQLData.BASTION_SESSION]
            return BastionSessionRegistry().get_bastion_session(id)
        return None

    def start_transaction(self):
        self.execute("START TRANSACTION")

    def kill_query(self, user_session):
        user_session._killed = True
        self.session.run_sql(f"KILL QUERY {user_session.connection_id}")

    def get_default_schema(self):
        return self._connection_options['schema'] if 'schema' in self._connection_options else ''

    def get_current_schema(self, callback=None, options=None):
        if self.threaded:
            context = get_context()
            task_id = context.request_id if context else None
            self.add_task(MySQLOneFieldTask(self, task_id=task_id,
                                            sql="SELECT DATABASE()", result_callback=callback, options=options))
        else:
            return self.execute("SELECT DATABASE()")

    def set_current_schema(self, schema_name, callback=None, options=None):
        if self.threaded:
            context = get_context()
            task_id = context.request_id if context else None
            self.add_task(DbExecuteTask(self, task_id=task_id,
                                        sql=f"USE {schema_name}", result_callback=callback, options=options))
        else:
            return self.execute(f"USE {schema_name}")

    def get_auto_commit(self, callback=None, options=None):
        if self.threaded:
            context = get_context()
            task_id = context.request_id if context else None
            self.add_task(MySQLOneFieldTask(self, task_id=task_id,
                                            sql="SELECT @@AUTOCOMMIT", result_callback=callback, options=options))
        else:
            return self.execute("SELECT @@AUTOCOMMIT")

    def set_auto_commit(self, state, callback=None, options=None):
        if self.threaded:
            context = get_context()
            task_id = context.request_id if context else None
            self.add_task(DbExecuteTask(self, task_id=task_id,
                                        sql=f"SET AUTOCOMMIT={state}", result_callback=callback, options=options))
        else:
            self.execute("SET AUTOCOMMIT=?", (state,))

    def get_objects_types(self):
        return self._supported_types

    @check_supported_type
    def get_catalog_object_names(self, type, filter):
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

        if self.threaded:
            context = get_context()
            task_id = context.request_id if context else None
            self.add_task(MySQLOneFieldListTask(
                self, task_id=task_id, sql=sql, params=params))
        else:
            return self.execute(sql, params)

    @check_supported_type
    def get_schema_object_names(self, type, schema_name, filter, routine_type=None):
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
                sql += " AND ROUTINE_TYPE = ?"
            sql += " AND ROUTINE_NAME like ?"
            sql += " ORDER BY ROUTINE_NAME"
            params = (schema_name, routine_type.upper(),
                      filter) if routine_type else (schema_name, filter)
        elif type == "Event":
            sql = """SELECT EVENT_NAME
                    FROM information_schema.EVENTS
                    WHERE EVENT_SCHEMA = ?
                    AND EVENT_NAME like ?
                    ORDER BY EVENT_NAME"""

        if self.threaded:
            context = get_context()
            task_id = context.request_id if context else None
            self.add_task(MySQLOneFieldListTask(self,
                                                task_id=task_id,
                                                sql=sql,
                                                params=params))
        else:
            return self.execute(sql, params)

    @check_supported_type
    def get_table_object_names(self, type, schema_name, table_name, filter):
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
        elif type == "Primary Key":
            sql = """SELECT COLUMN_NAME
                    FROM information_schema.KEY_COLUMN_USAGE
                    WHERE CONSTRAINT_SCHEMA = ?
                        AND TABLE_NAME = ?
                        AND CONSTRAINT_NAME = 'PRIMARY'
                        AND COLUMN_NAME LIKE ?
                    ORDER BY COLUMN_NAME;"""
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

        if self.threaded:
            context = get_context()
            task_id = context.request_id if context else None
            self.add_task(MySQLOneFieldListTask(self,
                                                task_id=task_id,
                                                sql=sql,
                                                params=params))
        else:
            return self.execute(sql, params)

    @check_supported_type
    def get_catalog_object(self, type, name):
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

        if self.threaded:
            context = get_context()
            task_id = context.request_id if context else None
            self.add_task(MySQLBaseObjectTask(self,
                                              task_id=task_id,
                                              sql=sql,
                                              type=type,
                                              name=name,
                                              params=params))
        else:
            result = self.execute(sql, params).fetch_one()
            return {"name": result[0]} if result else {}

    @check_supported_type
    def get_schema_object(self, type, schema_name, name):
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

            if self.threaded:
                context = get_context()
                task_id = context.request_id if context else None
                self.add_task(MySQLTableObjectTask(self,
                                                   task_id=task_id,
                                                   sql=sql,
                                                   name=f"{schema_name}.{name}",
                                                   params=params))
            else:
                result = {}
                resultset = self.execute(sql[0], params).fetch_one()
                if not resultset:
                    raise MSGException(Error.DB_OBJECT_DOES_NOT_EXISTS,
                                       f"The table '{schema_name}.{name}' does not exist.")
                result["name"] = resultset[0] if resultset else ""
                resultset = self.execute(sql[1], params).fetch_all()
                result["columns"] = [name[0] for name in resultset]
                return result
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

            if self.threaded:
                context = get_context()
                task_id = context.request_id if context else None
                self.add_task(MySQLBaseObjectTask(self,
                                                  task_id=task_id,
                                                  sql=sql,
                                                  type=type,
                                                  name=f"{schema_name}.{name}",
                                                  params=params))
            else:
                result = self.execute(sql, params).fetch_one()
                if not result:
                    raise MSGException(Error.DB_OBJECT_DOES_NOT_EXISTS,
                                       f"The view '{schema_name}.{name}' does not exist.")
                return {"name": result[0]}

    @check_supported_type
    def get_table_object(self, type, schema_name, table_name, name):
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
        elif type == "Primary Key":
            sql = """SELECT COLUMN_NAME
                    FROM information_schema.KEY_COLUMN_USAGE
                    WHERE CONSTRAINT_SCHEMA = ?
                        AND TABLE_NAME = ?
                        AND CONSTRAINT_NAME = 'PRIMARY'
                        AND COLUMN_NAME = ?"""
        elif type == "Index":
            sql = """SELECT INDEX_NAME
                    FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = ?
                        AND TABLE_NAME = ?
                        AND INDEX_NAME LIKE ?"""
        elif type == "Column":
            sql = """SELECT COLUMN_NAME as 'name', COLUMN_TYPE as 'type',
                        IS_NULLABLE='NO' as 'not_null', COLUMN_DEFAULT as 'default',
                        COLUMN_KEY='PRI' as 'is_pk',
                        EXTRA='auto_increment' as 'auto_increment'
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = ?
                        AND TABLE_NAME = ?
                        AND COLUMN_NAME LIKE ?"""

        if self.threaded:
            context = get_context()
            task_id = context.request_id if context else None
            if type == "Column":
                self.add_task(MySQLColumnObjectTask(self,
                                                    task_id=task_id,
                                                    sql=sql,
                                                    type=type, name=f"{table_name}.{name}",
                                                    params=params))
            else:
                self.add_task(MySQLBaseObjectTask(self,
                                                  task_id=task_id,
                                                  sql=sql,
                                                  type=type, name=f"{table_name}.{name}",
                                                  params=params))
        else:
            result = self.execute(sql, params).fetch_one()
            if not result:
                raise MSGException(Error.DB_OBJECT_DOES_NOT_EXISTS,
                                   f"The {type.lower()} '{schema_name}.{name}' does not exist.")
            return {"name": result[0]}

    def get_columns_metadata(self, names):
        params = []
        where_clause = []

        sql = """SELECT COLUMN_NAME as 'name', COLUMN_TYPE as 'type',
                    IS_NULLABLE='NO' as 'not_null', COLUMN_DEFAULT as 'default',
                    COLUMN_KEY='PRI' as 'is_pk',
                    EXTRA='auto_increment' as 'auto_increment',
                    TABLE_SCHEMA as 'schema', TABLE_NAME as 'table'
                FROM information_schema.COLUMNS
                WHERE """
        for name in names:
            where_clause.append(
                "(TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?)")
            params.extend([name['schema'], name['table'], name['column']])

        sql += " OR ".join(where_clause)

        if self.threaded:
            context = get_context()
            task_id = context.request_id if context else None
            self.add_task(MySQLColumnsMetadataTask(
                self, task_id=task_id, sql=sql, params=params))
        else:
            result = self.execute(sql, params).fetch_all()
            if not result:
                column_names = [name['name'] for name in names]
                raise MSGException(Error.DB_OBJECT_DOES_NOT_EXISTS,
                                   f"The columns {column_names} do not exist.")
            return {"columns": result}


    def get_routines_metadata(self, schema_name):
        params = (schema_name,)

        has_external_language = self._column_exists("ROUTINES", "EXTERNAL_LANGUAGE")
        if has_external_language:
            sql = """SELECT ROUTINE_NAME as 'name', ROUTINE_TYPE as 'type', EXTERNAL_LANGUAGE as 'language'
                    FROM information_schema.ROUTINES
                    WHERE ROUTINE_SCHEMA = ?"""
        else:
            sql = """SELECT ROUTINE_NAME as 'name', ROUTINE_TYPE as 'type', 'SQL' as 'language'
                    FROM information_schema.ROUTINES
                    WHERE ROUTINE_SCHEMA = ?"""

        if self.threaded:
            context = get_context()
            task_id = context.request_id if context else None

            self.add_task(MySQLRoutinesListTask(self,
                                                task_id=task_id,
                                                sql=sql,
                                                params=params))
        else:
            cursor = self.execute(sql, params)
            if cursor:
                result = cursor.fetch_all()
            else:
                result = []
            if not result:
                raise MSGException(Error.DB_OBJECT_DOES_NOT_EXISTS,
                                    f"The '{schema_name}' does not exist.")
            return {"routines": result}


    def _column_exists(self, table_name, column_name):
        """Check if a column exists in INFORMATION_SCHEMA table."""

        sql = """SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'information_schema'
                    AND TABLE_NAME = ?
                    AND COLUMN_NAME = ?"""

        cursor = self.cursor = self.run_sql(sql, (table_name, column_name))

        if cursor:
            result = cursor.fetch_one()
            return result and result.get_field("count") > 0
        return False