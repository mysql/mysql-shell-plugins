# Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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
import datetime
import hashlib
import inspect
import json
import re
import sys
import threading
import uuid
from contextlib import contextmanager
from queue import Empty, Queue

import mysqlsh

import gui_plugin as gui
import gui_plugin.core.Logger as logger
import gui_plugin.core.WebSocketCommon as WebSocket
from gui_plugin.core.BackendDbLogger import BackendDbLogger
from gui_plugin.core.Db import GuiBackendDb
from gui_plugin.core.dbms.DbMySQLSession import DbSession
from gui_plugin.core.HTTPWebSocketsHandler import HTTPWebSocketsHandler
from gui_plugin.core.modules.DbModuleSession import DbModuleSession
from gui_plugin.core.modules.ModuleSession import ModuleSession
from gui_plugin.core.Protocols import Response
from gui_plugin.core.RequestHandler import RequestHandler
from gui_plugin.sql_editor.SqlEditorModuleSession import SqlEditorModuleSession
from gui_plugin.users import backend as user_handler
from gui_plugin.users.backend import get_id_personal_user_group


class ShellGuiWebSocketHandler(HTTPWebSocketsHandler):

    def _is_shell_object(self, object):
        return type(object).__name__ in ['Dict', 'List']

    def setup(self):
        super(ShellGuiWebSocketHandler, self).setup()
        self.extensions_map.update({
            ".js": "application/javascript"
        })
        self._db = None
        self._session_user_id = None
        self._session_user_personal_group_id = None
        self._active_profile_id = None
        self._module_sessions = {}
        self._requests = {}
        self._requests_mutex = threading.Lock()
        self.key = None
        self.packets = {}

        # Registry of handlers for prompt requests sent to the FE
        self._prompt_handlers = {}

        # A thread will be processing all the responses
        self._response_queue = Queue()
        self._response_thread = threading.Thread(target=self.process_responses)

    def process_responses(self):
        while self.connected:
            try:
                json_message = self._response_queue.get(timeout=1)
            except Empty as e:
                continue

            self.send_message(json.dumps(json_message, default=str))

    def process_message(self, json_message):
        request = json_message.get('request')
        if request == 'authenticate':
            if not self.is_authenticated:
                self.authenticate_session(json_message)
            else:
                self.send_response_message('ERROR',
                                           'This session was already '
                                           'authenticated.',
                                           json_message.get('request_id'))
        elif request == 'logout':
            if self.is_authenticated:
                self._session_user_id = None
                self.send_response_message('OK',
                                           f'User successfully logged out.',
                                           json_message.get('request_id'))

            else:
                self.send_response_message('ERROR',
                                           'This session is not '
                                           'authenticated.',
                                           json_message.get('request_id'))
        elif not self.is_authenticated:
            self.send_response_message('ERROR',
                                       'This session is not yet '
                                       'authenticated.',
                                       json_message.get('request_id'))
        elif request == 'execute':
            self.execute_command_request(json_message)
        elif request == 'cancel':
            self.cancel_request(json_message)
        elif request == 'prompt_reply':
            self.prompt_reply(json_message)
        else:
            self.send_response_message('ERROR',
                                       f'Unknown request: {request}.',
                                       json_message.get('request_id'))

    def on_ws_message(self, frame: WebSocket.Frame):
        if frame.is_initial_fragment:
            self.packets[self.session_uuid] = WebSocket.Packet()

        self.packets[self.session_uuid].append(frame)

        if self.packets[self.session_uuid].done():
            message = self.packets[self.session_uuid].message
            del self.packets[self.session_uuid]

            logger.debug2(message=message, sensitive=True, prefix="<- ")
            try:
                json_message = None
                try:
                    json_message = json.loads(message)
                except Exception as e:
                    raise Exception("Unable to decode the JSON message.")

                if 'request' not in json_message:
                    raise Exception(
                        "The message is missing the 'request' attribute.")

                if 'request_id' not in json_message:
                    raise Exception(
                        "The message is missing the 'request_id' attribute.")

                if not json_message["request_id"]:
                    raise Exception('No request_id given. '
                                    'Please provide the request_id.')

                request_id = json_message["request_id"]

                # log message, if logging does not work, do not process
                # the message due to security concerns
                if not BackendDbLogger.message(self.session_id, json.dumps(message), is_response=False,
                                               request_id=request_id):
                    raise Exception("Unable to process the request.")

                self.process_message(json_message)
            except Exception as e:
                # Add the request id to the response if we have it available
                args = {}
                if json_message and 'request_id' in json_message:
                    args['request_id'] = json_message["request_id"]

                # log the original message
                BackendDbLogger.message(self.session_id,
                                        json.dumps(message), is_response=False)
                self.send_json_response(Response.exception(e, args))

    def on_ws_connected(self):
        logger.info("Websocket connected")

        reset_session = False
        if 'SessionId' in self.cookies.keys():
            requested_session_id = self.cookies['SessionId']
            self.session_uuid = str(requested_session_id)

            try:
                with self.db_tx() as db:
                    row = db.execute(
                        """SELECT * FROM session
                            WHERE uuid=? AND source_ip=?
                            ORDER BY id DESC
                            LIMIT 1""", (requested_session_id, self.client_address[0])).fetch_one()

                    if row is not None:
                        if row['ended'] is not None:
                            # recover the session by using a continued session
                            db.execute(
                                'INSERT INTO session(uuid, continued_session_id, user_id, started, source_ip) VALUES(?, ?, ?, ?, ?)',
                                (requested_session_id, row['continued_session_id'] + 1, row['user_id'], datetime.datetime.now(), self.client_address[0]))

                            # In transaction context so the right id is returned
                            self.session_id = db.get_last_row_id()

                            row = db.execute(
                                "SELECT * FROM session WHERE id=?", (self.session_id, )).fetch_one()

                        if row['user_id'] and row['uuid']:
                            self.session_uuid = requested_session_id
                            self.session_id = row['uuid']
                            self._session_user_id = row['user_id']
                            self._session_user_personal_group_id = get_id_personal_user_group(
                                db, self._session_user_id)

                            default_profile = user_handler.get_default_profile(
                                db, self._session_user_id)
                            self.set_active_profile_id(
                                default_profile["id"])

                            threading.current_thread(
                            ).name = f'wss-{self.session_uuid}'

                            self.send_response_message('OK', 'Session recovered', values={
                                "session_uuid": self.session_uuid,
                                "local_user_mode": self.is_local_session,
                                "active_profile": default_profile})

                            # Starts the response processor...
                            self._response_thread.start()

                            return

                    # If reaches this point it means the session id on the cookie was not valid at the end
                    # so we make sure a new session is created with the right UUID
                    reset_session = True
            except Exception as e:
                # No problem, we continue to create the new session
                pass

        # define a session uuid
        if reset_session:
            self.db.close()
            self._db = None

        self.session_uuid = str(uuid.uuid1())
        # set the name of the current thread to the session_uuid
        threading.current_thread().name = f'wss-{self.session_uuid}'

        # insert this new session into the session table
        try:
            logger.info("Registering session...")
            with self.db_tx() as db:
                db.execute(
                    'INSERT INTO session(uuid, continued_session_id, started, source_ip) VALUES(?, ?, ?, ?)',
                    (self.session_uuid, 0, datetime.datetime.now(), self.client_address[0]))
                self.session_id = db.get_last_row_id()
        except Exception as e:  # pragma: no cover
            logger.error(f'Session could not be inserted into db. {e}')

            self.send_json_response(Response.exception(e))

            self._ws_close()
            return

        # send the session uuid back to the browser
        logger.info("Sending session response...")
        self.send_response_message('OK', 'A new session has been created',
                                   values={"session_uuid": self.session_uuid,
                                           "local_user_mode": self.is_local_session})

        # Starts the response processor...
        self._response_thread.start()

    def on_ws_closed(self):
        # if the database connection for this thread was opened, close it
        if self._db:
            if self.session_uuid:
                self.db.execute("UPDATE session SET ended=? WHERE uuid=?",
                                (datetime.datetime.now(), self.session_uuid))
            self._db.close()
            self._db = None

        # close module sessions. use a copy so that we don't change the dict during the for
        for module_session in dict(self._module_sessions).values():
            module_session.close()

        if self._response_thread.is_alive():
            self._response_thread.join()

        logger.info("Websocket closed")

    def on_ws_sending_message(self, message):
        json_message = json.loads(message)
        if BackendDbLogger.message(self.session_id, message, is_response=True,
                                   request_id=json_message.get('request_id', None)):
            return message
        logger.error("Failed to log message in the database.")

        return json.dumps(Response.error(
            "Response cancelled by the application.", {
                "request_id": json_message["request_id"]
            }))

    def check_credentials(self, auth_header):
        if self.cached_successful_auth == auth_header:
            return True

        # decode provided credentials
        credentials = base64.b64decode(
            auth_header[6:].encode("utf8")).decode("utf-8").split(':')

        username = credentials[0]
        password = credentials[1]

        # since this function is called from outside a websocket session
        # use separate GuiBackendDb() instance that needs to be closed
        db = GuiBackendDb()
        success = False
        try:
            res = db.execute('''SELECT id, password_hash
                                    FROM user
                                    WHERE name = ?''',
                             (username, )).fetch_one()
            if res:
                salt = res['password_hash'][:64]
                password_hash = hashlib.pbkdf2_hmac(
                    'sha256', password.encode(), salt.encode(), 100000).hex()

                if res['password_hash'][64:] == password_hash:
                    success = True
                    self.cached_successful_auth = auth_header
        except Exception as e:
            error_msg = f'User could not be authenticated. {str(e)}.'
            logger.error(error_msg)
        finally:
            db.close()

        return success

    def send_json_response(self, json_message):
        # Special handling required for shell objects
        if self._is_shell_object(json_message):
            json_message = json.loads(str(json_message).replace("\n", "\\n"))

        self._response_queue.put(json_message)

    def send_response_message(self, msg_type, msg, request_id=None,
                              values=None, api=False):
        # get message text which is either a Dict that is converted to JSON or
        # a str
        msg_text = json.dumps(msg) if isinstance(msg, dict) else msg

        # if a request_id is given, add it to the message
        id_arg = {"request_id": request_id} if request_id else {}

        values_arg = {}
        if not values is None:
            # Special handling required for shell objects
            if self._is_shell_object(values):
                values = json.loads(str(values).replace("\n", "\\n"))

            if api:
                values_arg = {"result": values}
            else:
                # TODO(rennox): We should normalize the returning of responses
                # there is no reason to have different flavors based on the
                # type of values being returned
                values_arg = values if isinstance(values, dict) else {
                    "result": values}

        full_response = Response.standard(
            msg_type, msg_text, {**id_arg, **values_arg})

        # send the response message
        self.send_json_response(full_response)

        if msg_type in ["OK", "ERROR", "CANCELLED"]:
            self.unregister_module_request(request_id)

    def send_command_response(self, request_id, values):
        # TODO(rennox): This function has to do weird magic because it
        # is called to send the response from different commands, the
        # PROBLEM is that the commands should NEVER be creating the
        # response themselves, they should be implemented as simple APIs
        # and their either succeed and return whatever value they return... or
        # they should throw exceptions
        def convert_binary_values(value):
            if isinstance(value, bytes):
                return str(base64.b64encode(value), 'utf-8')
            if isinstance(value, dict) or "Dict" in type(value).__name__:
                result = {}
                for key, val in value.items():
                    result[key] = convert_binary_values(val)
                return result
            if isinstance(value, list) or "List" in type(value).__name__:
                return [convert_binary_values(val) for val in value]
            return value

        values = convert_binary_values(values)
        if isinstance(values, dict) and 'request_state' in values:
            values["request_id"] = request_id

            # send the response message
            self.send_json_response(values)

            self.unregister_module_request(request_id)
        else:
            self.send_response_message(
                "OK", "", request_id=request_id, values=values, api=True)

    def send_command_done(self, request_id):
        self.send_json_response(Response.standard(
            "OK", "", {"request_id": request_id, "done": True}))

        self.unregister_module_request(request_id)

    @property
    def is_authenticated(self):
        return self.session_user_id is not None

    @property
    def session_user_id(self):
        return self._session_user_id

    @property
    def user_personal_group_id(self):
        return self._session_user_personal_group_id

    @property
    def user_personal_group_id(self):
        return self._session_user_personal_group_id

    @property
    def session_active_profile_id(self):
        return self._active_profile_id

    def set_active_profile_id(self, profile_id):
        self._active_profile_id = profile_id

    @property
    def db(self):
        # if the db object has not yet been initialized for this thread
        if not self._db:
            # open the database connection for this thread
            self._db = GuiBackendDb(
                log_rotation=True, session_uuid=self.session_uuid)
        return self._db

    @contextmanager
    def db_tx(self):
        close = False
        if threading.current_thread().getName() == self.session_uuid:
            db = self.db
        # if not, initialize a new database connection since SQLite objects
        # can only be used in the thread they were created in
        else:
            close = True
            db = GuiBackendDb()

        try:
            db.start_transaction()
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            if close:
                db.close()

    def get_module_session_object(self, module_session_id) -> ModuleSession:
        # Check if there is a module_session with the given
        # module_session_id in the module_session cache
        module_session = self._module_sessions.get(module_session_id)
        if not module_session:
            raise Exception(f'There is no module_session in the cache that has '
                            f'the module_session_id '
                            f'{module_session_id} assigned.')
        return module_session

    def authenticate_session(self, json_msg):
        request_id = json_msg.get('request_id')
        username = json_msg.get('username')
        try:
            if self.is_local_session:
                if username != gui.users.backend.LOCAL_USERNAME:
                    raise Exception('Incorrect username or password')
                gui.users.backend.create_local_user(self.db)
            row = self.db.execute(
                'SELECT id, password_hash FROM user '
                'WHERE upper(name) = upper(?)',
                (username,)).fetch_one()
            if row:
                password_hash = None
                if not self.is_local_session:
                    salt = row['password_hash'][64:]
                    password_hash = hashlib.pbkdf2_hmac(
                        'sha256', json_msg['password'].encode(), salt.encode(), 100000).hex()

                if self.is_local_session or row[1] == password_hash + salt:
                    with self.db_tx() as db:
                        db.execute('UPDATE session SET user_id=? WHERE uuid=?',
                                   (row['id'], self.session_uuid))

                        self._session_user_id = row[0]
                        self._session_user_personal_group_id = get_id_personal_user_group(
                            db, self._session_user_id)

                    # get default profile for the user
                    default_profile = gui.users.get_default_profile(
                        row[0], self.db)
                    self.set_active_profile_id(default_profile["id"])
                    values = {"active_profile": default_profile}

                    self.send_response_message('OK',
                                               f'User {username} was '
                                               f'successfully authenticated.',
                                               request_id, values)

                    # TODO
                    # Update web_session with self.session_user_id

                    # TODO
                    # Cache the user's privileges
                else:
                    # raise Exception(f'The given password for user '
                    #     f'{json_msg.get("username")} is incorrect.')
                    raise Exception('Incorrect username or password')

            else:
                # raise Exception(f'There is no user account with the name '
                #     f'{json_msg.get("username")}.')
                raise Exception('Incorrect username or password')

        except Exception as e:
            error_msg = f'User could not be authenticated. {str(e)}.'
            logger.exception(error_msg)

            self.send_response_message('ERROR', error_msg, request_id)

    def execute_command_request(self, json_msg):
        request_id = json_msg.get('request_id')
        try:
            cmd = json_msg.get('command')
            if not cmd:
                raise Exception(
                    'No command given. Please provide the command.')

            # Check if user is allowed to execute this command
            allowed = False
            res = self.db.execute(
                '''SELECT p.name, p.access_pattern
                FROM privilege p
                    INNER JOIN role_has_privilege r_p
                        ON p.id = r_p.privilege_id
                    INNER JOIN user_has_role u_r
                        ON r_p.role_id = u_r.role_id
                WHERE u_r.user_id = ? AND p.privilege_type_id = 1''',
                (self.session_user_id,)).fetch_all()
            for row in res:
                p = re.compile(row[1])
                m = p.match(cmd)
                if not m:
                    raise Exception(f'This user account has no privileges to '
                                    f'execute the command {cmd}')
                allowed = True
                break

            if not allowed:
                raise Exception(f'This user does not have the necessary '
                                f'privileges to execute the command {cmd}.')

            # Argument need to be passed in a dict using the argument names as
            # the keys
            args = json_msg.get('args', {})
            kwargs = json_msg.get('kwargs', {})

            kwargs = {**args, **kwargs}

            # Inspect the function arguments and check if there are arguments
            # named user_id, profile_id, web_session, request_id,
            # module_session, async_web_session or session.
            # If so, replace them with session variables
            f_args = []

            # Loop over all chained objects/functions of the given cmd and find
            # the function to call
            matches = re.findall(r'(\w+)\.', cmd + '.')
            parent_obj = None
            func = None

            if len(matches) < 2:
                raise Exception(
                    f"The command '{cmd}' is using wrong format. "
                    "Use <global>[.<object>]*.<function>")

            # Last entry is a function name
            function_name = matches[-1]

            # Rest is a chain of objects
            objects = matches[:-1]

            found_objects = []

            # Selects the parent object
            if objects[0] == 'gui':
                parent_obj = gui
                objects = objects[1:]
                found_objects.append('gui')
            else:
                parent_obj = mysqlsh.globals

            # Searches the object hierarchy
            for object in objects:
                try:
                    # Convert from camelCase to snake_case
                    object = re.sub(r'(?<!^)(?=[A-Z])', '_', object).lower()

                    child = getattr(parent_obj, object)

                    # Set the parent_obj for the next object evaluation
                    parent_obj = child
                    found_objects.append(object)
                except:
                    if len(found_objects) == 0:
                        raise Exception(
                            f"The '{object}' global object does not exist")
                    else:
                        raise Exception(
                            f"Object '{'.'.join(found_objects)}' has no member named '{object}'")

            # Searches the target function
            try:
                func = getattr(parent_obj, function_name)
            except:
                raise Exception(
                    f"Object '{'.'.join(found_objects)}' has no member function named '{function_name}'")

            f_args = {}
            if func:
                f_args = self.get_function_arguments(
                    func=func, mod=parent_obj, mod_cmd=function_name)

            lock_session = False

            if found_objects[0] == 'gui':
                # This is the `user_id` that needs to be provided by the user
                # like for the function `add_profile(user_id, profile)`
                if "user_id" in f_args:
                    # Return error if user_id does not match self.session_user_id
                    if self.session_user_id is None or "user_id" not in kwargs \
                            or kwargs["user_id"] != self.session_user_id:
                        raise Exception(f'The function argument user_id must not '
                                        f'be set to a different user_id than the '
                                        f'one used in the '
                                        f'authenticated session.')

                    kwargs.update({"user_id": self.session_user_id})

                # The `_user_id` here is for internal use only
                # it's not exposed to the user and it's replaced
                # always by session_user_id
                if "_user_id" in f_args and not self.is_local_session:
                    kwargs.update({"_user_id": self.session_user_id})

                if "profile_id" in f_args:
                    if "profile_id" not in kwargs:
                        kwargs.update({"profile_id":
                                       self.session_active_profile_id})

                if "web_session" in f_args:
                    raise Exception(
                        f'Argument web_session not allowed for function: {cmd}.')

                if "request_id" in f_args:
                    raise Exception(
                        f'Argument request_id not allowed for function: {cmd}.')
                if "be_session" in f_args:
                    kwargs.update({"be_session": self.db})

            if "interactive" in f_args:
                kwargs.update({"interactive": False})

            # If the function may receive a message handler, adds the kwarg so the
            # RequestHandler properly sets the callback
            if "send_gui_message" in f_args:
                kwargs.update({"send_gui_message": True})

            lock_session = False
            if "session" in f_args:
                # If the called function requires a session parameter,
                # get it from the given module_session
                if not 'module_session_id' in kwargs:
                    raise Exception(
                        f'The function {cmd} requires the module_session_id '
                        'argument to be set.')
                module_session = self.get_module_session_object(
                    kwargs['module_session_id'])
                if not isinstance(module_session, DbModuleSession):
                    raise Exception(
                        f'The function {cmd} needs a module_session_id '
                        'argument set to a DbModuleSession.')

                user_session_functions = ["gui.sql_editor.execute",
                                          "gui.sql_editor.default_user_schema", "gui.sql_editor.get_current_schema",
                                          "gui.sql_editor.set_current_schema", "gui.sql_editor.get_auto_commit",
                                          "gui.sql_editor.set_auto_commit"]
                if isinstance(module_session, SqlEditorModuleSession) and cmd in user_session_functions:
                    db_module_session = module_session._db_user_session
                else:
                    db_module_session = module_session._db_service_session
                if not isinstance(db_module_session, DbSession):
                    raise Exception(
                        f'The function {cmd} needs a module_session_id '
                        'argument set to a DbSession.')

                self.register_module_request(
                    request_id, kwargs['module_session_id'])

                kwargs.update({"session": db_module_session})

                # The plugins written for the Shell that work with standard Shell session fall on this branch,
                # the session must be locked while the function is executed to avoid race conditions that may
                # lead to shell failures
                if found_objects[0] != 'gui':
                    lock_session = True

                del kwargs['module_session_id']

            module_session = None
            if "module_session" in f_args:
                if "module_session_id" not in kwargs:
                    raise Exception('No module_session_id given. Please '
                                    'provide the module_session_id.')

                # swap 'module_session_id' with 'module_session'
                module_session = self.get_module_session_object(
                    kwargs['module_session_id'])
                kwargs.update({"module_session": module_session})
                self.register_module_request(
                    request_id, kwargs['module_session_id'])
                del kwargs['module_session_id']

            thread = RequestHandler(
                request_id, func, kwargs, self, lock_session=lock_session)
            thread.start()
            result = None

        except Exception as e:
            logger.exception(e)
            result = Response.exception(e)

        if result is not None:
            self.send_command_response(request_id, result)

    def get_function_arguments(self, func, mod, mod_cmd):
        get_args_from_help = False
        try:
            # try to use the regular inspection function to get the function
            # arguments
            sig = inspect.signature(func)
            f_args = [p.name for p in sig.parameters.values()]
        except:  # pragma: no cover
            # if that fails, fall back to parsing the help output of that
            # function
            get_args_from_help = True

        if get_args_from_help or 'kwargs' in f_args:
            help_func = getattr(mod, 'help')
            help_output = help_func(f'{mod_cmd}')

            match = re.match(r'(.|\s)*?SYNTAX(.|\s)*?\(([\w,\[\]\s]*)',
                             help_output, flags=re.MULTILINE)
            arguments = match[3].replace('[', '').replace(']', '').\
                replace('\n', '').replace(' ', '')

            f_args = arguments.split(",")

            # Include the kwargs
            if 'kwargs' in f_args:
                f_args.remove('kwargs')
                desc_idx = help_output.find(
                    'The kwargs parameter accepts the following options:')
                desc = help_output[desc_idx + 53:]
                matches = re.findall(r'-\s(\w*)\:', desc, flags=re.MULTILINE)
                for match in matches:
                    f_args.append(match)

        return f_args

    def register_module_session(self, module_session):
        self._module_sessions[module_session.module_session_id] = module_session

    def unregister_module_session(self, module_session):
        if module_session.module_session_id in self._module_sessions:
            # If we close module we need also clean up requests registry for that module
            with self._requests_mutex:
                self._requests = {k: v for k, v in self._requests.items(
                ) if v != module_session.module_session_id}
            del self._module_sessions[module_session.module_session_id]

    def register_module_request(self, request_id, module_session_id):
        with self._requests_mutex:
            self._requests[request_id] = module_session_id

    def unregister_module_request(self, request_id):
        with self._requests_mutex:
            if request_id in self._requests:
                del self._requests[request_id]

    def cancel_request(self, json_msg):
        request_id = json_msg.get('request_id')
        try:
            if not request_id:
                raise Exception('No request_id given. '
                                'Please provide the request_id.')

            module_session = self.get_module_session_object(
                self._requests[request_id])

            if not hasattr(module_session, 'cancel_request'):
                raise Exception(
                    f"Module {type(module_session)} doesn't support cancel_request.")

            module_session.cancel_request(request_id)

            self.send_response_message('OK', 'Request cancelled.', request_id)
        except Exception as e:
            logger.error(e)

            self.send_response_message('ERROR', str(e).strip(), request_id)

    def send_prompt_response(self, request_id, prompt, handler):
        self._prompt_handlers[request_id] = handler

        self.send_response_message("PENDING",
                                   'Executing...',
                                   request_id,
                                   prompt,
                                   api=True)

    def prompt_reply(self, json_msg):
        request_id = json_msg.get('request_id')
        try:
            if not request_id:
                raise Exception('No request_id given. '
                                'Please provide the request_id.')

            prompt_handler = self._prompt_handlers.pop(request_id)

            prompt_handler.process_prompt_reply(json_msg)
        except KeyError as e:
            logger.error(e)
            self.send_response_message(
                'ERROR', f'Unexpected prompt for request_id=\'{request_id}\'')
        except Exception as e:
            logger.error(e)

            self.send_response_message('ERROR', str(e).strip(), request_id)
