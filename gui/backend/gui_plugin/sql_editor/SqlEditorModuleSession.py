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

from typing import Optional

import gui_plugin.core.Error as Error
from gui_plugin.core.dbms import DbSessionFactory
from gui_plugin.core.dbms.DbSession import ReconnectionMode
from gui_plugin.core.Error import MSGException
from gui_plugin.core.modules.DbModuleSession import (
    DbModuleSession,
    check_service_database_session,
)
from gui_plugin.core.Protocols import Response


def check_user_database_session(func):
    def wrapper(self, *args, **kwargs):
        if not self._db_user_session:
            raise MSGException(
                Error.DB_NOT_OPEN,
                "The database session needs to be opened before "
                "SQL can be executed.",
            )
        return func(self, *args, **kwargs)

    return wrapper


class SqlEditorModuleSession(DbModuleSession):
    def __init__(self):
        super().__init__(reconnection_mode=ReconnectionMode.EXTENDED)
        self._db_user_session = None

    def __del__(self):
        self.close()
        super().__del__()

    def close_connection(self, after_fail=False):
        # do cleanup
        user_session = getattr(self, "_db_user_session", None)
        if user_session is not None:
            user_session.close(after_fail)
            self._db_user_session = None

        super().close_connection(after_fail)

    # Overrides the on_connected function at the DBModuleSession to actually
    # trigger the user session connection, on this one no prompts are expected
    # as they were resolved on the service session connection
    def on_connected(self, db_session):
        if self._db_user_session is None:
            session_id = "UserSession-" + self._web_session.session_uuid
            self._db_user_session = DbSessionFactory.create(
                self._db_type,
                session_id,
                True,
                self._connection_options,
                None,
                ReconnectionMode.STANDARD,
                self._handle_api_response,
                self.on_user_session_connected,
                lambda x: self.on_fail_connecting(x),
                lambda x, o, a: self.on_shell_prompt(x, o, a),
                self.on_session_message,
                passwords_rejected_cb=self._reset_password_prompt_factors,
            )
        else:
            self._db_user_session.reconnect(self._connection_options)

    @check_service_database_session
    def reset_password(self, password: str, current_password: Optional[str] = None,
                       retain_current_password: bool = False, password_expired: bool = False,
                       user: Optional[str] = None, host: Optional[str] = None) -> None:
        from gui_plugin.core.dbms.DbMySQLSessionCommon import is_secure_mysql_transport

        if (user is None) != (host is None):
            raise ValueError("Both user and host must be specified together.")
        service = self._db_service_session
        if service.database_type != "MySQL" or not is_secure_mysql_transport(service.connection_options):
            raise ValueError("Password reset requires a secure MySQL connection.")

        service.lock()
        try:
            if not password_expired:
                service.activate_all_roles()

            sql = "ALTER USER USER()" if user is None else "ALTER USER ?@?"
            params = [] if user is None else [user, host]
            sql += " IDENTIFIED BY /*((*/ ? /*))*/"
            params.append(password)
            if current_password is not None:
                sql += (" /*((*/ /*!80013 REPLACE ? */ /*))*/" if password_expired
                        else " REPLACE /*((*/ ? /*))*/")
                params.append(current_password)
            if retain_current_password:
                sql += " RETAIN CURRENT PASSWORD"
            service.execute_thread(sql, params)

            # Intentionally leave cached credentials unchanged: explicit reconnect
            # prompts again if they are rejected, avoiding a lock on the user session.
        finally:
            service.release()

    def on_user_session_connected(self, db_session):
        info = db_session.info()
        if db_session.database_type == "MySQL":
            info["connection_id"] = db_session.connection_id
            info["service_connection_id"] = self._db_service_session.connection_id

        data = Response.pending(
            "Connection was successfully opened.",
            {
                "result": {
                    "module_session_id": self._module_session_id,
                    "info": info,
                    "default_schema": db_session.get_default_schema(),
                }
            },
        )
        self.send_command_response(self._current_request_id, data)
        self.completion_event.set()

    @check_user_database_session
    def default_user_schema(self):
        return self._db_user_session.get_default_schema()

    @check_user_database_session
    @check_service_database_session
    def kill_query(self):
        self._db_service_session.kill_query(self._db_user_session)

    @check_user_database_session
    @check_service_database_session
    def kill_session(self):
        self._db_service_session.kill_session(self._db_user_session)

    def cancel_request(self, request_id):
        self._db_service_session.cancel_request(request_id)
