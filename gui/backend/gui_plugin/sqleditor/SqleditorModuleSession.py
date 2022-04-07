# Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

from gui_plugin.core.DbSession import DbSessionFactory
from gui_plugin.core.modules.DbModuleSession import DbModuleSession
from gui_plugin.core.modules.DbModuleSession import check_service_database_session
from gui_plugin.core.modules.ModuleSession import cancellable
from gui_plugin.core.Error import MSGException
import gui_plugin.core.Error as Error
from gui_plugin.core.Protocols import Response


def check_user_database_session(func):
    def wrapper(self, *args, **kwargs):
        if not self._db_user_session:
            raise MSGException(Error.DB_NOT_OPEN, 'The database session needs to be opened before '
                               'SQL can be executed.')
        return func(self, *args, **kwargs)
    return wrapper


class SqleditorModuleSession(DbModuleSession):
    def __init__(self, web_session):
        super().__init__(web_session)
        self._db_user_session = None

    def __del__(self):
        self.close()
        super().__del__()

    def close_connection(self):
        # do cleanup
        if self._db_user_session is not None:
            self._db_user_session.close()
            self._db_user_session = None

        super().close_connection()

    def reconnect(self, request_id):
        self._db_user_session.close()
        self._db_user_session = None
        super().reconnect(request_id=request_id)

    # Overrides the on_connected function at the DBModuleSession to actually
    # trigger the user session connection, on this one no prompts are expected
    # as they were resolved on the service session connection
    def on_connected(self, db_session):
        if self._db_user_session is None:
            session_id = "UserSession-" + self._web_session.session_uuid
            self._db_user_session = DbSessionFactory.create(
                self._db_type, session_id, True,
                db_session.connection_options,
                self._ping_interval,
                False,
                self.on_user_session_connected,
                lambda x: self.on_fail_connecting(x),
                lambda x: self.on_shell_prompt(x),
                lambda x: self.on_shell_password(x),
                self.on_session_message)

    def on_user_session_connected(self, db_session):
        data = Response.ok("Connection was successfully opened.", {
            "module_session_id": self._module_session_id,
            "info": db_session.info(),
            "default_schema": db_session.get_default_schema()
        })
        self.send_command_response(self._current_request_id, data)

    @cancellable
    @check_user_database_session
    def execute(self, sql, request_id, params=None, options=None):
        self._db_user_session.execute(sql=sql, request_id=request_id,
                                      params=params,
                                      callback=self._handle_db_response,
                                      options=options)

    @check_user_database_session
    def default_user_schema(self):
        return self._db_user_session.get_default_schema()

    @cancellable
    @check_user_database_session
    def get_current_schema(self, request_id, options=None):
        return self._db_user_session.get_current_schema(request_id, callback=self._handle_api_response,
                                                        options=options)

    @cancellable
    @check_user_database_session
    def set_current_schema(self, request_id, schema_name, options=None):
        return self._db_user_session.set_current_schema(request_id=request_id, schema_name=schema_name,
                                                        callback=self._handle_api_response,
                                                        options=options)

    @cancellable
    @check_user_database_session
    def get_auto_commit(self, request_id, options=None):
        return self._db_user_session.get_auto_commit(request_id=request_id, callback=self._handle_api_response,
                                                     options=options)

    @cancellable
    @check_user_database_session
    def set_auto_commit(self, request_id, state, options=None):
        return self._db_user_session.set_auto_commit(request_id=request_id, state=state, callback=self._handle_api_response,
                                                     options=options)

    @check_user_database_session
    @check_service_database_session
    def kill_query(self):
        self._db_service_session.kill_query(self._db_user_session)

    def cancel_request(self, request_id):
        self._db_service_session.cancel_request(request_id)

    def cancel_request(self, request_id):
        self._db_service_session.cancel_request(request_id)
