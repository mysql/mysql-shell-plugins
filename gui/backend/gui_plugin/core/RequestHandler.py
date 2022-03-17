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

from threading import Thread, Event
from gui_plugin.core.Protocols import Response
import mysqlsh
import sys


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

    def __init__(self, request_id, func, kwargs, web_handler):
        super().__init__()
        self._request_id = request_id
        self._func = func
        self._kwargs = kwargs
        self._web_handler = web_handler
        self._text_cache = None

        # Prompt handling members
        self._prompt_event = None
        self._prompt_replied = False
        self._prompt_reply = None

    def send_response_message(self, type, text):
        """
        Used internally to send the information being printed as on the operation
        being executed to the caller as PENDING response messages.
        """
        if self._text_cache is None:
            self._text_cache = text
        else:
            self._web_handler.send_response_message("PENDING", "", request_id=self._request_id,
                                                    values={
                                                        type: self._text_cache + text},
                                                    api=True)
            self._text_cache = None

    def on_shell_prompt(self, text):
        self._web_handler.send_prompt_response(
            self._request_id, {"prompt": text}, self)

        self._prompt_event.wait()
        self._prompt_event.clear()

        return [self._prompt_replied, self._prompt_reply]

    def on_shell_password(self, text):
        self._web_handler.send_prompt_response(
            self._request_id, {"password": text}, self)

        self._prompt_event.wait()
        self._prompt_event.clear()

        return [self._prompt_replied, self._prompt_reply]

    def on_shell_print(self, text):
        self.send_response_message("info", text)

    def on_shell_print_diag(self, text):
        self.send_response_message("info", text)

    def on_shell_print_error(self, text):
        self.send_response_message("error", text)

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
        self._prompt_event = Event()

        shell = mysqlsh.globals.shell

        self._shell_ctx = shell.create_context({"printDelegate": lambda x: self.on_shell_print(x),
                                                "diagDelegate": lambda x: self.on_shell_print_diag(x),
                                                "errorDelegate": lambda x: self.on_shell_print_error(x),
                                                "promptDelegate": lambda x: self.on_shell_prompt(x),
                                                "passwordDelegate": lambda x: self.on_shell_password(x), })
        self._shell = self._shell_ctx.get_shell()

        result = None
        try:
            result = self._func(**self._kwargs)
        except Exception as e:
            result = Response.exception(e)

        if result is not None:
            self._web_handler.send_command_response(self._request_id, result)
        else:
            # This is the case of any plugin function that does not fail but
            # does not return anything, we should return an OK response anyway
            # to confirm it completed
            self._web_handler.send_command_response(
                self._request_id, Response.ok("Completed"))

        self._shell_ctx.finalize()
