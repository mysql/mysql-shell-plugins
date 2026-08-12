# Copyright (c) 2021, 2026, Oracle and/or its affiliates.
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

import os
import threading
from time import sleep

import mysqlsh
from mysqlsh import mysql
from gui_plugin.core.Files import get_plugin_data_path

import gui_plugin.core.Context as ctx
import gui_plugin.core.Error as Error
import gui_plugin.core.Logger as logger
from gui_plugin.core.Context import get_context
from gui_plugin.core.dbms import DbSessionFactory
from gui_plugin.core.dbms.DbSession import ReconnectionMode
from gui_plugin.core.dbms.DbSessionUtils import DbSessionData
from gui_plugin.core.dbms.DbSqliteSession import find_schema_name
from gui_plugin.core.Error import MSGException
from gui_plugin.core.modules.ModuleSession import ModuleSession
from gui_plugin.core.Protocols import Response


_PASSWORD_AUTHENTICATION_PLUGINS = {
    "password",
    "authentication_ldap_simple",
    "authentication_ldap_sasl",
    "authentication_pam",
}


def check_service_database_session(func):
    def wrapper(self, *args, **kwargs):
        if self._db_service_session is None:
            raise MSGException(
                Error.DB_NOT_OPEN,
                "The database session needs to be opened before SQL can be executed.",
            )
        return func(self, *args, **kwargs)

    return wrapper


class DbModuleSession(ModuleSession):
    def __init__(self, reconnection_mode=ReconnectionMode.STANDARD):
        super().__init__()
        self._db_type = None
        self._db_connection_id = None
        self._connection_options = None
        self._db_service_session = None
        self._bastion_options = None
        self._user_id = None
        self._profile_id = None
        self._offline = False
        self._offline_profile_id = None
        self._reconnection_mode = reconnection_mode
        self.completion_event = None
        self._connection_passwords = {}
        self._password_prompt_factors = []

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
        self._db_connection_id = None
        self._user_id = None
        self._profile_id = None
        self._offline = False
        self._offline_profile_id = None
        connection_passwords = getattr(self, "_connection_passwords", None)
        if connection_passwords is not None:
            connection_passwords.clear()
        password_prompt_factors = getattr(self, "_password_prompt_factors", None)
        if password_prompt_factors is not None:
            password_prompt_factors.clear()

        service_session = getattr(self, "_db_service_session", None)
        if service_session is not None:
            service_session.close(after_fail)
            self._db_service_session = None

    def _bind_connection_profile(self, connection_id):
        if self._web_session is None:
            raise MSGException(
                Error.CORE_PERMISSION_DENIED,
                "A database connection requires an authenticated web session.",
            )

        profile_id = self._web_session.session_active_profile_id
        user_id = self._web_session.session_user_id
        if profile_id is None or user_id is None:
            raise MSGException(
                Error.CORE_PERMISSION_DENIED,
                "A database connection requires an active user profile.",
            )

        membership = self._web_session.db.select(
            """SELECT 1
            FROM profile_has_db_connection pdc
                JOIN profile p ON pdc.profile_id = p.id
            WHERE pdc.profile_id=? AND pdc.db_connection_id=? AND p.user_id=?""",
            (profile_id, connection_id, user_id),
        )
        if not membership:
            raise MSGException(
                Error.CORE_PERMISSION_DENIED,
                "The connection is not available in the active user profile.",
            )

        self._user_id = user_id
        self._profile_id = profile_id

    def open_offline_connection(self, connection_id):
        """Binds this module session to an offline administration connection."""
        self.close_connection()
        self._bind_connection_profile(connection_id)
        self._db_connection_id = connection_id
        self._offline = True
        self._offline_profile_id = self._profile_id

    def get_bound_connection_id(self):
        """Returns the connection bound to this authenticated module session."""
        if (
            self._db_connection_id is None
            or self._user_id is None
            or self._profile_id is None
            or self._web_session is None
        ):
            raise MSGException(
                Error.CORE_PERMISSION_DENIED,
                "This module session is not bound to a saved connection.",
            )

        if (
            self._web_session.session_user_id != self._user_id
            or self._web_session.session_active_profile_id != self._profile_id
        ):
            raise MSGException(
                Error.CORE_PERMISSION_DENIED,
                "The module session belongs to a different profile.",
            )

        return self._db_connection_id

    def get_offline_connection_id(self):
        """Returns the connection bound for offline administration requests."""
        if not self._offline or self._offline_profile_id is None:
            raise MSGException(
                Error.CORE_PERMISSION_DENIED,
                "This module session is not authorized for offline administration.",
            )

        return self.get_bound_connection_id()

    def reconnect(self):
        context = get_context()
        self._current_request_id = context.request_id if context else None

        if self._db_service_session is None:
            raise MSGException(
                Error.DB_NOT_OPEN, "A database session is required to reconnect."
            )
        else:
            self._db_service_session.reconnect()

    # This is the former path validation in DbSqliteSession
    def _validate_connection_config(self, config):
        path = config["db_file"]
        database_name = find_schema_name(config)

        # Only allow absolute paths when running a local session.
        if os.path.isabs(path):
            if self._web_session and not self._web_session.is_local_session:
                raise MSGException(
                    Error.CORE_ABSPATH_NOT_ALLOWED,
                    f"Absolute paths are not allowed when running a remote session for '{database_name}' database.",
                )
        else:
            user_dir = get_plugin_data_path(
                "gui_plugin", f"user_{self._web_session.session_user_id}"
            )

            path = os.path.join(user_dir, path)

            if not os.path.abspath(path).startswith(user_dir):
                raise MSGException(
                    Error.CORE_ACCESS_OUTSIDE_USERSPACE,
                    f"Trying to access outside the user space on '{database_name}' database.",
                )

        if not os.path.isfile(path):
            raise MSGException(
                Error.CORE_PATH_NOT_EXIST,
                f"The database file: {path} does not exist for '{database_name}' database.",
            )

        return path

    def on_session_message(self, type, message, result, request_id=None):
        self._web_session.send_response_message(
            msg_type=type,
            msg=message,
            request_id=self._current_request_id if request_id is None else request_id,
            values=result,
            api=False,
        )

    # Note that this function is executed in the DBSession thread
    # def _handle_db_response(self, request_id, values):
    def _handle_db_response(self, state, message, request_id, data=None):
        if state == "ERROR":
            self._web_session.send_command_response(request_id, data)
        elif state == "OK":
            msg = ""
            if not message is None:
                msg = message
            elif "total_row_count" in data.keys():
                row_count = data["total_row_count"]
                plural = "" if row_count == 1 else "s"
                msg = (
                    f"Full result set consisting of {row_count} row{plural}"
                    f" transferred."
                )

            self._web_session.send_response_message("OK", msg, request_id, data)
        elif state == "CANCELLED":
            msg = ""
            if not message is None:
                msg = message

            self._web_session.send_response_message("CANCELLED", msg, request_id, data)
        else:
            msg = ""
            if not message is None:
                msg = message
            else:
                msg = "Executing..."
            self._web_session.send_response_message("PENDING", msg, request_id, data)

    def open_connection(self, connection, password):
        self.completion_event = ctx.set_completion_event()
        # Closes the existing connections if any
        self.close_connection()

        context = get_context()
        self._current_request_id = context.request_id if context else None

        if isinstance(connection, int):
            self._bind_connection_profile(connection)
            self._db_connection_id = connection
            self._db_type, options, settings = self._web_session.db.get_connection_details(
                connection
            )
            options = options.copy()
            authentication_hints = (
                settings.get("authentication_hints")
                if isinstance(settings, dict)
                else None
            )
            if isinstance(authentication_hints, dict):
                options["authentication_hints"] = authentication_hints
        elif isinstance(connection, dict):
            self._db_connection_id = None
            self._db_type = connection["db_type"]
            options = connection["options"].copy()
            settings = connection.get("settings")
            authentication_hints = (
                settings.get("authentication_hints")
                if isinstance(settings, dict)
                else None
            )
            if isinstance(authentication_hints, dict):
                options["authentication_hints"] = authentication_hints

        self._configure_authentication_passwords(options, authentication_hints, password)

        # In SQLIte connections we validate the configuration is valid
        if self._db_type == "Sqlite":
            options["db_file"] = self._validate_connection_config(options)

        self._connection_options = options

        try:
            self.connect()
        except Exception as ex:
            self.completion_event.add_error(ex)

        sleep(1)

    def _configure_authentication_passwords(self, options, authentication_hints, password=None):
        factors = []
        if isinstance(authentication_hints, dict):
            factors = authentication_hints.get("factors", [])

        if not isinstance(factors, list) or not factors:
            factors = ["password"]

        self._password_prompt_factors = []
        webauthn_registration = (
            "register-factor" in options
            and factors[0] == "authentication_webauthn"
        )
        if webauthn_registration:
            options.pop("no-password", None)

        password_factor = next(
            (index for index, plugin in enumerate(factors[:3])
             if plugin in _PASSWORD_AUTHENTICATION_PLUGINS),
            None,
        )
        if webauthn_registration:
            password_factor = 0

        for index, plugin in enumerate(factors[:3]):
            option = "password" if index == 0 else f"password{index + 1}"
            if (
                plugin not in _PASSWORD_AUTHENTICATION_PLUGINS
                and not (webauthn_registration and index == 0)
            ):
                if index == 0:
                    options["no-password"] = True
                options.pop(option, None)
                continue

            if index == password_factor and password is not None:
                options[option] = password

            if options.get(option) is not None:
                self._connection_passwords[index] = options[option]
            elif index in self._connection_passwords:
                options[option] = self._connection_passwords[index]
            else:
                options[option] = None
                self._password_prompt_factors.append(index)

    def _reset_password_prompt_factors(self):
        self._password_prompt_factors = sorted(self._connection_passwords)

    def connect(self):
        session_id = "ServiceSession-" + self.web_session.session_uuid
        service_connection_options = self._connection_options.copy()
        service_connection_options.pop("sql-mode", None)

        self._db_service_session = DbSessionFactory.create(
            self._db_type,
            session_id,
            True,
            service_connection_options,
            {
                DbSessionData.CONNECTION_ESTABLISHED_CALLBACK:
                    self._refresh_server_status_cache
            },
            self._reconnection_mode,
            self._handle_api_response,
            self.on_connected,
            lambda x: self.on_fail_connecting(x),
            lambda x, o, a: self.on_shell_prompt(x, o, a),
            self.on_session_message,
            passwords_rejected_cb=self._reset_password_prompt_factors,
        )

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

    def on_shell_prompt(self, caption, options, attributes):
        prompt_event = threading.Event()
        options["prompt"] = caption

        # FE requires type to always be present on prompts
        if not "type" in options:
            options["type"] = "text"

        self.send_prompt_response(
            self._current_request_id, options, lambda: prompt_event.set()
        )

        prompt_event.wait()

        # Stored credentials can skip any factor's prompt. Use Shell's explicit
        # password label rather than the order in which replies arrive.
        factor = next((index for index in range(3) if caption.startswith(
            f"Please provide the password{index + 1 if index else ''} for '"
        )), None)
        if (
            self._prompt_replied
            and options["type"] == "password"
            and not attributes.get("auth")
            and "ssh://" not in caption
            and factor is not None
        ):
            if factor in self._password_prompt_factors:
                self._password_prompt_factors.remove(factor)
            option = "password" if factor == 0 else f"password{factor + 1}"
            self._connection_passwords[factor] = self._prompt_reply
            self._connection_options[option] = self._prompt_reply
            if self._db_service_session is not None:
                self._db_service_session.connection_options[option] = self._prompt_reply

        return self._prompt_replied, self._prompt_reply

    def on_connected(self, db_session):
        data = Response.pending(
            "Connection was successfully opened.",
            {
                "result": {
                    "module_session_id": self._module_session_id,
                    "info": db_session.info(),
                    "default_schema": db_session.get_default_schema(),
                }
            },
        )
        self.send_command_response(self._current_request_id, data)
        self.completion_event.set()

    def _refresh_server_status_cache(self, db_session):
        if self._db_connection_id is None:
            return

        try:
            from gui_plugin.db_connections import DbConnections

            DbConnections.refresh_server_status_cache(
                self._db_connection_id, db_session
            )
        except Exception as exc:  # Cache failures must not fail connection setup.
            logger.exception(exc)

    def on_fail_connecting(self, exc):
        if (
            isinstance(exc, mysqlsh.DBError)
            and exc.code in (
                mysql.ErrorCode.ER_MUST_CHANGE_PASSWORD,
                mysql.ErrorCode.ER_MUST_CHANGE_PASSWORD_LOGIN,
            )
        ):
            logger.info("Connection opened for expired-password reset.")
        else:
            logger.exception(exc)
            self.close_connection(True)

        self.completion_event.add_error(exc)
        self.completion_event.set()

    def cancel_request(self, request_id):
        raise NotImplementedError()
