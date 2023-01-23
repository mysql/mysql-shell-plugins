# Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import uuid
from gui_plugin.core.Context import get_context

class ModuleSession():
    def __init__(self):
        context = get_context()
        self._web_session = context.web_handler if context else None

        # define a module session uuid
        self._module_session_id = str(uuid.uuid1())

        # register this module session on the web_session
        self._web_session.register_module_session(self)

        # Set the _expected_prompt to the request_id if a prompt is expected
        self._expected_prompt = None

    def __del__(self):
        pass

    def close(self):
        # do cleanup

        # unregister itself from web_session
        self._web_session.unregister_module_session(self)

    @property
    def module_session_id(self):
        return self._module_session_id

    @property
    def web_session(self):
        return self._web_session

    def send_command_response(self, request_id, values):
        self._web_session.send_command_response(request_id, values)

    def _handle_api_response(self, type, message, request_id, result=None):
        self._web_session.send_response_message(type,
                                                message if message else '',
                                                request_id,
                                                result,
                                                api=True)

    def send_prompt_response(self, request_id, prompt, prompt_event_cb):
        """
        Sends a prompt response to the FE for an operation being attended in
        the BE.

        NOTE: Prompts are responses to some requests from the FE that may or
        may not require user interaction for that reason such messages should
        be attended in the BE in an asynchronous way, this is, BE should start
        processing such requests but return immediately.

        The reason for this is that if interaction is required, a dialog
        between BE and FE will start to resolve anything that needs to be
        resolved before the original message can actually be attended.

        To achieve this, these messages should be attended in the BE in a
        separate thread which if needed, will call this function to have the
        dialog with the FE.

        NOW, even the communication with the FE is asynchronous, at the BE
        itself it is a synchronous process, so the caller thread should wait
        for the FE to reply to this prompt; for that reason the prompt_cb is
        a lambda function in the form of:

        lambda : event.set()

        Where event is a threading Event being waited in the caller thread.

        The lambda function will be executed when the FE responds to this
        prompt at process_prompt_reply.
        """
        self._expected_prompt = request_id
        self._prompt_event_callback = prompt_event_cb
        self._web_session.send_prompt_response(request_id, prompt, self)

    def process_prompt_reply(self, reply):
        request_id = reply['request_id']

        if not self._expected_prompt == request_id:
            raise Exception(
                f"Unexpected request_id in prompt reply: {request_id}")

        self._prompt_replied = reply['type'] == "OK"
        self._prompt_reply = reply['reply']

        self._prompt_event_callback()
        self._expected_prompt = None
        self._prompt_event_callback = None

    def cancel_request(self, request_id):  # pragma: no cover
        raise NotImplementedError()
