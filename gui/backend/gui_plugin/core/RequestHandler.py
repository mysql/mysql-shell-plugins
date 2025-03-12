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

import threading
from threading import Event, Thread

import mysqlsh

from gui_plugin.core.Protocols import Response


class RequestHandler(Thread):
    """
    This class will handle web requests to execute a specific API on the shell
    out of the context of either:

    - A SQLEditor Module Session
    - A Shell Module Session

    This handler is meant for operations to be executed on the Shell instance
    running the Web Server.

    This handler adds the following features:

    - Supports prompts
    - Causes information printed by the API being executed to be sent as PENDING
      responses to the caller.
    """

    def __init__(self, request_id, func, kwargs, web_handler, lock_session=False):
        super().__init__()
        self._request_id = request_id
        self._func = func
        self._kwargs = kwargs
        self._web_handler = web_handler
        self._text_cache = None
        self._thread_context = None
        self._lock_session = lock_session

        # Prompt handling members
        self._prompt_event = None
        self._prompt_replied = False
        self._prompt_reply = None
        self._confirm_complete = True

        if "send_gui_message" in self._kwargs:
            self._kwargs.update({"send_gui_message": self.handle_gui_message})

    def get_context(self):
        return self._thread_context

    @property
    def request_id(self):
        return self._request_id

    @property
    def web_handler(self):
        return self._web_handler

    def handle_gui_message(self, type, text):
        """
        Callback to pass messages to the GUI from plugin functions
        through the send_gui_message callback.
        """
        self.web_handler.send_response_message("PENDING", "", request_id=self.request_id,
                                               values={type: text},
                                               api=True)

    def handle_print(self, type, text):
        """
        Used internally to send the information being printed as on the operation
        being executed to the caller as PENDING response messages.
        """
        if self._text_cache is None:
            self._text_cache = text
        else:
            self.web_handler.send_response_message("PENDING", "", request_id=self.request_id,
                                                   values={
                                                       type: self._text_cache + text},
                                                   api=True)
            self._text_cache = None

    def on_shell_prompt(self, text, options):
        # Append the message into the prompt
        options["prompt"] = text

        if not "type" in options:
            options["type"] = "text"

        self.web_handler.send_prompt_response(
            self.request_id, options, self)

        self._prompt_event.wait()
        self._prompt_event.clear()

        return [self._prompt_replied, self._prompt_reply]

    def on_shell_print(self, text):
        self.handle_print("info", text)

    def on_shell_print_diag(self, text):
        self.handle_print("info", text)

    def on_shell_print_error(self, text):
        self.handle_print("error", text)

    def process_prompt_reply(self, reply):
        request_id = reply['request_id']
        if not self._request_id == request_id:
            raise Exception(
                f"Unexpected request_id in prompt reply: {request_id}")
        self._prompt_replied = reply['type'] == "OK"
        self._prompt_reply = reply['reply']
        self._prompt_event.set()

    def run(self):
        """
        Thread function to setup the shell callbacks for print and prompt
        functions.
        """
        self._thread_context = threading.local()
        self._thread_context.request_id = self._request_id
        self._thread_context.web_handler = self._web_handler
        self._prompt_event = Event()

        shell = mysqlsh.globals.shell

        self._shell_ctx = shell.create_context({"printDelegate": lambda x: self.on_shell_print(x),
                                                "diagDelegate": lambda x: self.on_shell_print_diag(x),
                                                "errorDelegate": lambda x: self.on_shell_print_error(x),
                                                "promptDelegate": lambda x, y: self.on_shell_prompt(x, y), })
        self._shell = self._shell_ctx.get_shell()

        self._do_execute()

        self._shell_ctx.finalize()

    def _do_execute(self):
        result = None
        try:
            if self._lock_session:
                # The session will be used by an external (non GUI) plugin,
                # the session needs to be locked and it needs to notify a task
                # will begin execution
                self._kwargs["session"].lock()
                self._kwargs["session"].notify_task_execution_state(
                    None, "started")
            result = self._func(**self._kwargs)
            if hasattr(self._thread_context, "completion_event"):
                self._thread_context.completion_event.wait()
        except Exception as e:
            # dump stack trace to raw stderr
            import traceback
            import sys
            sys.real_stderr.write(traceback.format_exc())
            result = Response.exception(e)
        finally:
            if self._lock_session:
                self._kwargs["session"].notify_task_execution_state(
                    None, "finished")
                self._kwargs["session"].release()

        if result is not None:
            if isinstance(result, dict) and "request_state" in result:
                self._confirm_complete = result["request_state"]["type"] != "ERROR"
                self.web_handler.send_command_response(self.request_id, result)
            else:
                self.web_handler.send_command_response(
                    self.request_id, Response.pending(msg="", args={"result": result}))
        elif hasattr(self._thread_context, "completion_event"):
            if self._thread_context.completion_event.has_errors:
                self._confirm_complete = False
                for error in self._thread_context.completion_event.get_errors():
                    self.web_handler.send_command_response(
                        self.request_id, Response.exception(error))
            elif self._thread_context.completion_event.is_cancelled:
                self._confirm_complete = False
                self.web_handler.send_command_response(
                    self.request_id, Response.cancelled(""))

        # This is the case of any plugin function that does not fail but
        # does not return anything, we should return an OK response anyway
        # to confirm it completed
        if self._confirm_complete:
            self.web_handler.send_command_done(self.request_id)
