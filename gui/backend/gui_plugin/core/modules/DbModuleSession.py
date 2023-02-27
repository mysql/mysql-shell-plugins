# Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import os
import threading

import mysqlsh

import gui_plugin.core.Context as ctx
import gui_plugin.core.Error as Error
import gui_plugin.core.Logger as logger
from gui_plugin.core.Context import get_context
from gui_plugin.core.dbms import DbSessionFactory
from gui_plugin.core.dbms.DbSession import ReconnectionMode
from gui_plugin.core.dbms.DbSqliteSession import find_schema_name
from gui_plugin.core.Error import MSGException
from gui_plugin.core.modules.ModuleSession import ModuleSession
from gui_plugin.core.Protocols import Response


def check_service_database_session(func):
    def wrapper(self, *args, **kwargs):
        if self._db_service_session is None:
            raise MSGException(Error.DB_NOT_OPEN,
                               'The database session needs to be opened before SQL can be executed.')
        return func(self, *args, **kwargs)
    return wrapper


class DbModuleSession(ModuleSession):
    def __init__(self, reconnection_mode=ReconnectionMode.STANDARD):
        super().__init__()
        self._db_type = None
        self._connection_options = None
        self._db_service_session = None
        self._bastion_options = None
        self._reconnection_mode = reconnection_mode
        self.completion_event = None

    def __del__(self):
        self.close()
        super().__del__()

    def close(self):
        self.close_connection()
        super().close()

    def close_connection(self, after_fail=False):
        # do cleanup
        self._connection_options = None
        self._db_type = None

        if self._db_service_session is not None:
            self._db_service_session.lock()
            self._db_service_session.close(after_fail)
            self._db_service_session.release()
            self._db_service_session = None

    def reconnect(self):
        context = get_context()
        self._current_request_id = context.request_id if context else None

        if self._db_service_session is None:
            raise MSGException(Error.DB_NOT_OPEN,
                               'A database session is required to reconnect.')
        else:
            self._db_service_session.reconnect()

    # This is the former path validation in DbSqliteSession
    def _validate_connection_config(self, config):
        path = config['db_file']
        database_name = find_schema_name(config)

        # Only allow absolute paths when running a local session.
        if os.path.isabs(path):
            if self._web_session and not self._web_session.is_local_session:
                raise MSGException(Error.CORE_ABSPATH_NOT_ALLOWED,
                                   f"Absolute paths are not allowed when running a remote session for '{database_name}' database.")
        else:
            user_dir = os.path.abspath(mysqlsh.plugin_manager.general.get_shell_user_dir(
                'plugin_data', 'gui_plugin', f'user_{self._web_session.session_user_id}'))

            path = os.path.join(user_dir, path)

            if not os.path.abspath(path).startswith(user_dir):
                raise MSGException(Error.CORE_ACCESS_OUTSIDE_USERSPACE,
                                   f"Trying to access outside the user space on '{database_name}' database.")

        if not os.path.isfile(path):
            raise MSGException(Error.CORE_PATH_NOT_EXIST,
                               f"The database file: {path} does not exist for '{database_name}' database.")

        return path

    def on_session_message(self, type, message, result, request_id=None):
        self._web_session.send_response_message(
            msg_type=type,
            msg=message,
            request_id=self._current_request_id if request_id is None else request_id,
            values=result, api=False)

    # Note that this function is executed in the DBSession thread
    # def _handle_db_response(self, request_id, values):
    def _handle_db_response(self, state, message, request_id, data=None):
        if state == 'ERROR':
            self._web_session.send_command_response(request_id, data)
        elif state == "OK":
            msg = ""
            if not message is None:
                msg = message
            elif "total_row_count" in data.keys():
                row_count = data["total_row_count"]
                plural = '' if row_count == 1 else 's'
                msg = f'Full result set consisting of {row_count} row{plural}' \
                    f' transferred.'

            self._web_session.send_response_message('OK',
                                                    msg,
                                                    request_id,
                                                    data)
        elif state == "CANCELLED":
            msg = ""
            if not message is None:
                msg = message

            self._web_session.send_response_message('CANCELLED',
                                                    msg,
                                                    request_id,
                                                    data)
        else:
            msg = ""
            if not message is None:
                msg = message
            else:
                msg = "Executing..."
            self._web_session.send_response_message('PENDING',
                                                    msg,
                                                    request_id,
                                                    data)

    def open_connection(self, connection, password):
        self.completion_event = ctx.set_completion_event()
        # Closes the existing connections if any
        self.close_connection()

        context = get_context()
        self._current_request_id = context.request_id if context else None

        if isinstance(connection, int):
            self._db_type, options = self._web_session.db.get_connection_details(
                connection)
        elif isinstance(connection, dict):
            self._db_type = connection['db_type']
            options = connection['options']

        if password is not None:
            # Override the password
            options['password'] = password

        # In SQLIte connections we validate the configuration is valid
        if self._db_type == "Sqlite":
            options['db_file'] = self._validate_connection_config(options)

        self._connection_options = options

        try:
            self.connect()
        except Exception as ex:
            self.completion_event.add_error(ex)

    def connect(self):
        session_id = "ServiceSession-" + self.web_session.session_uuid
        self._db_service_session = DbSessionFactory.create(
            self._db_type, session_id, True,
            self._connection_options,
            None,
            self._reconnection_mode,
            self._handle_api_response,
            self.on_connected,
            lambda x: self.on_fail_connecting(x),
            lambda x, o: self.on_shell_prompt(x, o),
            self.on_session_message)

    # Temporary hack, right thing would be that the shell unparse_uri
    # supports passing the needed tokens
    def _get_simplified_uri(self, options):
        uri_data = {}
        keys = options.keys()
        if "user" in keys:
            uri_data["user"] = options["user"]

        if "host" in keys:
            uri_data["host"] = options["host"]

        if "port" in keys:
            uri_data["port"] = options["port"]

        return mysqlsh.globals.shell.unparse_uri(uri_data)

    def on_shell_prompt(self, caption, options):
        prompt_event = threading.Event()
        options["prompt"] = caption

        # FE requires type to always be present on prompts
        if not "type" in options:
            options["type"] = "text"

        self.send_prompt_response(
            self._current_request_id, options, lambda: prompt_event.set())

        prompt_event.wait()

        # If password is prompted, stores it on the connection data
        # TODO: avoid keeping the password
        if self._prompt_replied and options.type == "password":
            self._connection_options["password"] = self._prompt_reply

        return self._prompt_replied, self._prompt_reply

    def on_connected(self, db_session):
        data = Response.pending("Connection was successfully opened.", {"result": {
            "module_session_id": self._module_session_id,
            "info": db_session.info(),
            "default_schema": db_session.get_default_schema()
        }})
        self.send_command_response(self._current_request_id, data)
        self.completion_event.set()

    def on_fail_connecting(self, exc):
        logger.exception(exc)

        self.close_connection(True)

        self.completion_event.add_error(exc)
        self.completion_event.set()

    def cancel_request(self, request_id):
        raise NotImplementedError()
