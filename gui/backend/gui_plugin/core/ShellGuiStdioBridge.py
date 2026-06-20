# Copyright (c) 2026, Oracle and/or its affiliates.
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
import inspect
import json
import re
import sys
import threading
import typing
import uuid
from contextlib import contextmanager
from queue import Empty, Queue

import mysqlsh

import gui_plugin as gui
import gui_plugin.core.Logger as logger
from gui_plugin.core.BackendDbLogger import BackendDbLogger
from gui_plugin.core.Db import GuiBackendDb
from gui_plugin.core.Filtering import FilterExpire, LogFilter
from gui_plugin.core.PluginCommandMocks import send_plugin_command_mock_response
from gui_plugin.core.Protocols import Response
from gui_plugin.core.RequestHandler import RequestHandler
from gui_plugin.core.dbms.DbMySQLSession import DbSession
from gui_plugin.core.lib.DataClassUtils import convert_value, is_dataclass_convertible
from gui_plugin.core.modules.DbModuleSession import DbModuleSession
from gui_plugin.core.modules.ModuleSession import ModuleSession
from gui_plugin.sql_editor.SqlEditorModuleSession import SqlEditorModuleSession
from gui_plugin.users.backend import get_id_personal_user_group
from mysqlsh.plugin_manager import registrar


class ShellGuiStdioBridge:
    """JSON transport for trusted local frontends.

    Transport model:
    - stdio is local-only and single-user-only.
    - The session uses the local desktop GUI user, so there is no separate
      authenticate round-trip before requests can be processed.
    - stdout is reserved for JSON protocol messages.

    This differs intentionally from the HTTP/WebSocket transport, which may
    serve local or remote clients and must support both single-user and
    multi-user deployments.
    """

    REQUEST_THREAD_CLOSE_TIMEOUT_SECONDS = 5.0

    def __init__(
        self,
        stdin: typing.Optional[typing.TextIO] = None,
        stdout: typing.Optional[typing.TextIO] = None,
    ) -> None:
        self._stdin: typing.TextIO = stdin if stdin is not None else sys.stdin
        self._stdout: typing.TextIO = stdout if stdout is not None else sys.stdout
        self._stdout_lock: threading.Lock = threading.Lock()

        self._db: typing.Optional[GuiBackendDb] = None
        self.session_uuid: str = ""
        self.session_id: typing.Optional[int] = None
        self._session_user_id: typing.Optional[int] = None
        self._session_user_personal_group_id: typing.Optional[int] = None
        self._active_profile_id: typing.Optional[int] = None
        self._active_log_filters: dict[typing.Optional[str], list[LogFilter]] = {}

        self._module_sessions: dict[str, ModuleSession] = {}
        self._requests: dict[typing.Optional[str], str] = {}
        self._requests_mutex: threading.Lock = threading.Lock()
        self._request_threads: list[RequestHandler] = []
        self._request_threads_mutex: threading.Lock = threading.Lock()
        self._prompt_handlers: dict[typing.Optional[str], typing.Any] = {}
        self._response_queue: Queue[tuple[typing.Any, typing.Optional[str]]] = Queue()
        self._response_thread: typing.Optional[threading.Thread] = None

        self._web_functions: dict[str, typing.Any] = {}
        for definition in registrar.get_registry():
            if definition.web:
                tokens = definition.fully_qualified_name.split(".")
                tokens[-1] = re.sub(r"(?<!^)(?=[A-Z])", "_", tokens[-1]).lower()
                self._web_functions[".".join(tokens)] = definition

        self.connected: bool = False

    def __enter__(self) -> "ShellGuiStdioBridge":
        return self

    def __exit__(
        self,
        exc_type: typing.Optional[type[BaseException]],
        exc_value: typing.Optional[BaseException],
        traceback: typing.Optional[typing.Any],
    ) -> bool:
        self.close()

        return False

    @staticmethod
    def _is_shell_object(value: typing.Any) -> bool:
        return type(value).__name__ in ["Dict", "List"]

    def _emit_json_line(self, payload: str) -> None:
        with self._stdout_lock:
            self._stdout.write(payload)
            self._stdout.write("\n")
            self._stdout.flush()

    def _create_response_thread(self) -> threading.Thread:
        return threading.Thread(
            target=self._process_responses,
            name="msg-stdio-response",
            daemon=True,
        )

    def _process_responses(self) -> None:
        while self.connected or not self._response_queue.empty():
            try:
                json_message, completion_request_id = self._response_queue.get(
                    timeout=0.1
                )
            except Empty:
                continue

            try:
                payload = json.dumps(json_message, default=str)
                request_id = None
                if isinstance(json_message, dict):
                    request_id = json_message.get("request_id", None)

                if not BackendDbLogger.message(
                    self.session_id, payload, is_response=True, request_id=request_id
                ):
                    logger.error("Failed to log message in the database.")
                    args = {"request_id": request_id} if request_id is not None else {}
                    payload = json.dumps(
                        Response.error("Response cancelled by the application.", args),
                        default=str,
                    )

                self._emit_json_line(payload)

                if (
                    completion_request_id
                    and completion_request_id in self._active_log_filters
                ):
                    for active_filter in self._active_log_filters[
                        completion_request_id
                    ]:
                        active_filter.expire()

                    del self._active_log_filters[completion_request_id]
            except Exception as exc:
                logger.exception(exc)

    def _start_session(self) -> None:
        self.session_uuid = str(uuid.uuid1())
        threading.current_thread().name = f"stdio-{self.session_uuid}"

        try:
            logger.info("Registering desktop bridge session...")
            with self.db_tx() as db:
                # The stdio transport session is only a lifecycle and logging
                # anchor: BackendDbLogger stores every protocol message with a
                # non-null session_id foreign key, and teardown marks this row
                # ended. Authentication and request authorization are not
                # derived from it for stdio.
                db.execute(
                    "INSERT INTO session(uuid, continued_session_id, started, source_ip) VALUES(?, ?, ?, ?)",
                    (self.session_uuid, 0, datetime.datetime.now(), "127.0.0.1"),
                )
                self.session_id = db.get_last_row_id()
        except Exception as exc:
            logger.error(f"Session could not be inserted into db. {exc}")
            raise

        BackendDbLogger.get_instance()
        self.connected = True
        self._response_thread = self._create_response_thread()
        self._response_thread.start()
        values = {
            "session_uuid": self.session_uuid,
            "local_user_mode": True,
        }

        try:
            # Stdio sessions expose the local desktop profile immediately,
            # with no authenticate request in the protocol.
            gui.users.backend.create_local_user(self.db)  # type: ignore
            row = self.db.execute(
                "SELECT id FROM user WHERE upper(name) = upper(?)",
                (gui.users.backend.LOCAL_USERNAME,),
            ).fetch_one()
            if not row:
                raise RuntimeError("The local desktop user could not be created.")

            with self.db_tx() as db:
                self._session_user_id = row["id"]
                self._session_user_personal_group_id = get_id_personal_user_group(
                    db, self._session_user_id
                )
                db.execute(
                    "UPDATE session SET user_id=? WHERE uuid=?",
                    (self._session_user_id, self.session_uuid),
                )

            default_profile = gui.users.get_default_profile(self._session_user_id, self.db)  # type: ignore
            self.set_active_profile_id(default_profile["id"])
            values["active_profile"] = default_profile
        except Exception as exc:
            logger.exception(f"Failed to bootstrap local desktop session. {exc}")
            raise

        self._emit_json_line(
            json.dumps(
                {"event": "ready", "data": {"transport": "stdio", **values}},
                default=str,
            )
        )

        self.send_response_message(
            "OK",
            "A new session has been created",
            values=values,
        )

    def run(self) -> None:
        self._start_session()

        try:
            for raw_line in self._stdin:
                line = raw_line.strip()
                if not line:
                    continue

                json_message = None
                try:
                    json_message = json.loads(line)
                    if "request" not in json_message:
                        raise Exception(
                            "The message is missing the 'request' attribute."
                        )
                    if "request_id" not in json_message:
                        raise Exception(
                            "The message is missing the 'request_id' attribute."
                        )
                    if not json_message["request_id"]:
                        raise Exception(
                            "No request_id given. Please provide the request_id."
                        )

                    if not BackendDbLogger.message(
                        self.session_id,
                        line,
                        is_response=False,
                        request_id=json_message["request_id"],
                    ):
                        raise Exception("Unable to process the request.")

                    self.process_message(json_message)
                except Exception as exc:
                    logger.debug2(message=line, sensitive=True, prefix="<- ")

                    args = {}
                    if json_message and "request_id" in json_message:
                        args["request_id"] = json_message["request_id"]

                    BackendDbLogger.message(self.session_id, line, is_response=False)
                    self.send_json_response(Response.exception(exc, args))
        finally:
            self.close()

    def close(self) -> None:
        if (
            not self.connected
            and not self._db
            and not self._module_sessions
            and not self._response_thread
        ):
            return

        if self.connected:
            self._cancel_prompt_handlers()
            self._cancel_active_requests()
            self._wait_for_request_threads(self.REQUEST_THREAD_CLOSE_TIMEOUT_SECONDS)

        try:
            self._teardown()
        finally:
            self.connected = False

            if self._response_thread and self._response_thread.is_alive():
                self._response_thread.join()
            self._response_thread = None

            BackendDbLogger.close()

    def process_message(self, json_message: dict[str, typing.Any]) -> None:
        request = json_message.get("request")

        if request != "execute":
            logger.debug2(
                message=json.dumps(json_message), sensitive=True, prefix="<- "
            )

        if request not in ["execute", "cancel", "prompt_reply"]:
            self.send_response_message(
                "ERROR",
                f"Unknown request: {request}.",
                json_message.get("request_id"),
            )
        elif request == "execute":
            self.execute_command_request(json_message)
        elif request == "cancel":
            self.cancel_request(json_message)
        elif request == "prompt_reply":
            self.prompt_reply(json_message)

    def _teardown(self) -> None:
        if self._db:
            try:
                if self.session_uuid and self.session_id is not None:
                    self.db.execute(
                        "UPDATE session SET ended=? WHERE uuid=?",
                        (datetime.datetime.now(), self.session_uuid),
                    )
            finally:
                self._db.close()
                self._db = None

        for module_session in dict(self._module_sessions).values():
            module_session.close()

    def send_json_response(
        self,
        json_message: typing.Any,
        completion_request_id: typing.Optional[str] = None,
    ) -> None:
        if self._is_shell_object(json_message):
            json_message = json.loads(str(json_message).replace("\n", "\\n"))

        self._response_queue.put((json_message, completion_request_id))

    def send_response_message(
        self,
        msg_type: str,
        msg: typing.Any,
        request_id: typing.Optional[str] = None,
        values: typing.Any = None,
        api: bool = False,
        completed: bool = False,
    ) -> None:
        msg_text = json.dumps(msg) if isinstance(msg, dict) else msg
        id_arg = {"request_id": request_id} if request_id else {}

        values_arg = {}
        if values is not None:
            if self._is_shell_object(values):
                values = json.loads(str(values).replace("\n", "\\n"))

            if api:
                values_arg = {"result": values}
            else:
                values_arg = values if isinstance(values, dict) else {"result": values}

        full_response = Response.standard(msg_type, msg_text, {**id_arg, **values_arg})
        self.send_json_response(
            full_response,
            completion_request_id=request_id if completed else None,
        )

        if msg_type in ["OK", "ERROR", "CANCELLED"]:
            self.unregister_module_request(request_id)

    def send_command_response(
        self,
        request_id: typing.Optional[str],
        values: typing.Any,
        completed: bool = False,
    ) -> None:
        def convert_binary_values(value: typing.Any) -> typing.Any:
            if isinstance(value, bytes):
                return str(base64.b64encode(value), "utf-8")
            if isinstance(value, dict) or "Dict" in type(value).__name__:
                result = {}
                for key, val in value.items():
                    result[key] = convert_binary_values(val)
                return result
            if isinstance(value, list) or "List" in type(value).__name__:
                return [convert_binary_values(val) for val in value]
            return value

        values = convert_binary_values(values)
        if isinstance(values, dict) and "request_state" in values:
            values["request_id"] = request_id
            self.send_json_response(values, request_id if completed else None)
            self.unregister_module_request(request_id)
        else:
            self.send_response_message(
                "OK",
                "",
                request_id=request_id,
                values=values,
                api=True,
                completed=completed,
            )

    def send_command_done(self, request_id: typing.Optional[str]) -> None:
        self.send_json_response(
            Response.standard("OK", "", {"request_id": request_id, "done": True}),
            completion_request_id=request_id,
        )
        self.unregister_module_request(request_id)

    @property
    def is_local_session(self) -> bool:
        return True

    @property
    def session_user_id(self) -> typing.Optional[int]:
        return self._session_user_id

    @property
    def user_personal_group_id(self) -> typing.Optional[int]:
        return self._session_user_personal_group_id

    @property
    def session_active_profile_id(self) -> typing.Optional[int]:
        return self._active_profile_id

    def set_active_profile_id(self, profile_id: typing.Any) -> None:
        self._active_profile_id = profile_id

    @property
    def db(self) -> GuiBackendDb:
        if not self._db:
            self._db = GuiBackendDb(log_rotation=True, session_uuid=self.session_uuid)
        return self._db

    @contextmanager
    def db_tx(self) -> typing.Iterator[GuiBackendDb]:
        close = False
        if threading.current_thread().name in [
            self.session_uuid,
            f"stdio-{self.session_uuid}",
        ]:
            db = self.db
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

    def get_module_session_object(self, module_session_id: str) -> ModuleSession:
        module_session = self._module_sessions.get(module_session_id)
        if not module_session:
            raise Exception(
                "There is no module_session in the cache that has the module_session_id "
                f"{module_session_id} assigned."
            )
        return module_session

    def execute_command_request(self, json_msg: dict[str, typing.Any]) -> None:
        request_id = json_msg.get("request_id")
        try:
            cmd = json_msg.get("command")
            if not cmd:
                raise Exception("No command given. Please provide the command.")

            if send_plugin_command_mock_response(cmd, request_id, self):
                result = None

                return

            args = json_msg.get("args", {})
            kwargs = json_msg.get("kwargs", {})
            kwargs = {**args, **kwargs}

            request_filters: list[LogFilter] = []
            if cmd in self._web_functions:
                definition = self._web_functions[cmd]
                hints = typing.get_type_hints(definition.function)

                for param_name, expected_type in hints.items():
                    if param_name not in kwargs:
                        continue

                    if is_dataclass_convertible(expected_type):
                        kwargs[param_name] = convert_value(
                            expected_type, kwargs[param_name]
                        )

                if isinstance(definition.web, dict) and "logfilters" in definition.web:
                    for request_filter in definition.web["logfilters"]:
                        request_filters.append(logger.add_filter(request_filter))

            if request_filters:
                self._active_log_filters[request_id] = request_filters

            logger.debug2(message=json.dumps(json_msg), sensitive=True, prefix="<- ")

            matches = re.findall(r"(\w+)\.", cmd + ".")
            parent_obj = None
            func = None

            if len(matches) < 2:
                raise Exception(
                    f"The command '{cmd}' is using wrong format. Use <global>[.<object>]*.<function>"
                )

            function_name = matches[-1]
            objects = matches[:-1]
            found_objects = []

            if objects[0] == "gui":
                parent_obj = gui
                objects = objects[1:]
                found_objects.append("gui")
            else:
                parent_obj = mysqlsh.globals

            for object_name in objects:
                try:
                    object_name = re.sub(r"(?<!^)(?=[A-Z])", "_", object_name).lower()
                    child = getattr(parent_obj, object_name)
                    parent_obj = child
                    found_objects.append(object_name)
                except Exception:
                    if len(found_objects) == 0:
                        raise Exception(
                            f"The '{object_name}' global object does not exist"
                        )
                    raise Exception(
                        f"Object '{'.'.join(found_objects)}' has no member named '{object_name}'"
                    )

            try:
                func = getattr(parent_obj, function_name)
            except Exception:
                raise Exception(
                    f"Object '{'.'.join(found_objects)}' has no member function named '{function_name}'"
                )

            f_args = {}
            if func:
                f_args = self._get_function_arguments(
                    func=func, mod=parent_obj, mod_cmd=function_name
                )

            lock_session = False

            if found_objects[0] == "gui":
                if "user_id" in f_args:
                    if (
                        self.session_user_id is None
                        or "user_id" not in kwargs
                        or kwargs["user_id"] != self.session_user_id
                    ):
                        raise Exception(
                            "The function argument user_id must not be set to a different user_id "
                            "than the one used in the authenticated session."
                        )

                    kwargs.update({"user_id": self.session_user_id})

                if "_user_id" in f_args and not self.is_local_session:
                    kwargs.update({"_user_id": self.session_user_id})

                if "profile_id" in f_args:
                    if "profile_id" not in kwargs:
                        kwargs.update({"profile_id": self.session_active_profile_id})

                if "web_session" in f_args:
                    raise Exception(
                        f"Argument web_session not allowed for function: {cmd}."
                    )

                if "request_id" in f_args:
                    raise Exception(
                        f"Argument request_id not allowed for function: {cmd}."
                    )

                if "be_session" in f_args:
                    kwargs.update({"be_session": self.db})

            if "interactive" in f_args:
                kwargs.update({"interactive": False})

            if "send_gui_message" in f_args:
                kwargs.update({"send_gui_message": True})

            if "session" in f_args:
                if "module_session_id" not in kwargs:
                    raise Exception(
                        f"The function {cmd} requires the module_session_id argument to be set."
                    )
                module_session = self.get_module_session_object(
                    kwargs["module_session_id"]
                )
                if not isinstance(module_session, DbModuleSession):
                    raise Exception(
                        f"The function {cmd} needs a module_session_id argument set to a DbModuleSession."
                    )

                user_session_functions = [
                    "execute",
                    "start_transaction",
                    "commit_transaction",
                    "rollback_transaction",
                    "default_user_schema",
                    "get_current_schema",
                    "set_current_schema",
                    "get_auto_commit",
                    "set_auto_commit",
                ]
                if (
                    isinstance(module_session, SqlEditorModuleSession)
                    and found_objects == ["gui", "sql_editor"]
                    and function_name in user_session_functions
                ):
                    db_module_session = module_session._db_user_session
                else:
                    db_module_session = module_session._db_service_session
                if not isinstance(db_module_session, DbSession):
                    raise Exception(
                        f"The function {cmd} needs a module_session_id argument set to a DbSession."
                    )

                self.register_module_request(request_id, kwargs["module_session_id"])
                kwargs.update({"session": db_module_session})

                if found_objects[0] != "gui":
                    lock_session = True

                del kwargs["module_session_id"]

            if "module_session" in f_args:
                if "module_session_id" not in kwargs:
                    raise Exception(
                        "No module_session_id given. Please provide the module_session_id."
                    )

                module_session = self.get_module_session_object(
                    kwargs["module_session_id"]
                )
                kwargs.update({"module_session": module_session})
                self.register_module_request(request_id, kwargs["module_session_id"])
                del kwargs["module_session_id"]

            thread = RequestHandler(
                request_id, func, kwargs, self, lock_session=lock_session
            )
            self._start_request_thread(thread)
            result = None

        except Exception as exc:
            logger.exception(exc)
            result = Response.exception(exc)

        if result is not None:
            self.send_command_response(request_id, result, completed=True)

    def _get_function_arguments(
        self,
        func: typing.Callable[..., typing.Any],
        mod: typing.Any,
        mod_cmd: str,
    ) -> list[str]:
        try:
            sig = inspect.signature(func)
            f_args = [parameter.name for parameter in sig.parameters.values()]
        except Exception:
            f_args = ["kwargs"]

        if "kwargs" in f_args:
            help_func = getattr(mod, "help")
            help_output = help_func(f"{mod_cmd}")

            match = re.match(
                r"(.|\s)*?SYNTAX(.|\s)*?\(([\w,\[\]\s]*)",
                help_output,
                flags=re.MULTILINE,
            )
            if match:
                arguments = (
                    match[3]
                    .replace("[", "")
                    .replace("]", "")
                    .replace("\n", "")
                    .replace(" ", "")
                )
                f_args = arguments.split(",")
            else:
                f_args = []

            if "kwargs" in f_args:
                f_args.remove("kwargs")
                desc_idx = help_output.find(
                    "The kwargs parameter accepts the following options:"
                )
                desc = help_output[desc_idx + 53 :]
                matches = re.findall(r"-\s(\w*)\:", desc, flags=re.MULTILINE)
                for match in matches:
                    f_args.append(match)

        return f_args

    def _wait_for_request_threads(
        self, timeout: typing.Optional[float] = None
    ) -> None:
        with self._request_threads_mutex:
            threads = list(self._request_threads)

        for thread in threads:
            thread.join(timeout)

        with self._request_threads_mutex:
            self._request_threads = [
                thread for thread in self._request_threads if thread.is_alive()
            ]

    def _start_request_thread(self, thread: RequestHandler) -> None:
        original_run = thread.run

        def run_with_cleanup() -> None:
            try:
                original_run()
            finally:
                self._unregister_request_thread(thread)

        thread.run = run_with_cleanup
        thread.daemon = True

        with self._request_threads_mutex:
            self._request_threads.append(thread)

        thread.start()

    def _unregister_request_thread(self, thread: RequestHandler) -> None:
        with self._request_threads_mutex:
            if thread in self._request_threads:
                self._request_threads.remove(thread)

    def _cancel_prompt_handlers(self) -> None:
        prompt_handlers = list(self._prompt_handlers.items())
        self._prompt_handlers.clear()

        for request_id, prompt_handler in prompt_handlers:
            try:
                prompt_handler.process_prompt_reply(
                    {"request_id": request_id, "type": "CANCEL", "reply": ""}
                )
            except Exception as exc:
                logger.exception(exc)

    def _cancel_active_requests(self) -> None:
        with self._requests_mutex:
            requests = list(self._requests.items())

        for request_id, module_session_id in requests:
            module_session = self._module_sessions.get(module_session_id)
            if not module_session or not hasattr(module_session, "cancel_request"):
                continue

            try:
                module_session.cancel_request(request_id)
            except Exception as exc:
                logger.exception(exc)

    def register_module_session(self, module_session: ModuleSession) -> None:
        self._module_sessions[module_session.module_session_id] = module_session

    def unregister_module_session(self, module_session: ModuleSession) -> None:
        if module_session.module_session_id in self._module_sessions:
            with self._requests_mutex:
                self._requests = {
                    key: value
                    for key, value in self._requests.items()
                    if value != module_session.module_session_id
                }
            self._module_sessions.pop(module_session.module_session_id, None)

    def register_module_request(
        self,
        request_id: typing.Optional[str],
        module_session_id: str,
    ) -> None:
        with self._requests_mutex:
            self._requests[request_id] = module_session_id

    def unregister_module_request(self, request_id: typing.Optional[str]) -> None:
        with self._requests_mutex:
            self._requests.pop(request_id, None)

    def cancel_request(self, json_msg: dict[str, typing.Any]) -> None:
        request_id = json_msg.get("request_id")
        try:
            if not request_id:
                raise Exception("No request_id given. Please provide the request_id.")

            module_session = self.get_module_session_object(self._requests[request_id])

            if not hasattr(module_session, "cancel_request"):
                raise Exception(
                    f"Module {type(module_session)} doesn't support cancel_request."
                )

            module_session.cancel_request(request_id)
            self.send_response_message("OK", "Request cancelled.", request_id)
        except Exception as exc:
            logger.error(exc)
            self.send_response_message("ERROR", str(exc).strip(), request_id)

    def send_prompt_response(
        self,
        request_id: typing.Optional[str],
        prompt: dict[str, typing.Any],
        handler: typing.Any,
    ) -> None:
        self._prompt_handlers[request_id] = handler

        if prompt["type"] == "password":
            logger.add_filter(
                {
                    "type": "key",
                    "keys": ["reply"],
                    "expire": FilterExpire.OnUse,
                }
            )

        self.send_response_message(
            "PENDING",
            "Executing...",
            request_id,
            prompt,
            api=True,
        )

    def prompt_reply(self, json_msg: dict[str, typing.Any]) -> None:
        request_id = json_msg.get("request_id")
        try:
            if not request_id:
                raise Exception("No request_id given. Please provide the request_id.")

            prompt_handler = self._prompt_handlers.pop(request_id)
            prompt_handler.process_prompt_reply(json_msg)
        except KeyError as exc:
            logger.error(exc)
            self.send_response_message(
                "ERROR",
                f"Unexpected prompt for request_id='{request_id}'",
            )
        except Exception as exc:
            logger.error(exc)
            self.send_response_message("ERROR", str(exc).strip(), request_id)
