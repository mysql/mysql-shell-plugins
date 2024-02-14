# Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

from gui_plugin.core.Db import GuiBackendDb


class MockWebSession():
    def __init__(self, user_id=3, local=False):
        "User id 3 is the first id for the test users"
        self.user_id = user_id
        self.session_uuid = f"test_uuid_{user_id}"
        self.is_local_session = local
        self.db = GuiBackendDb()

        self.module_sessions = {}
        self.callbacks = {}
        self._requests = {}

        self.request_id = None

    def register_callback(self, request_id, callback):
        self.callbacks[request_id] = callback

    def unregister_callback(self, request_id):
        if request_id in self.callbacks:
            del self.callbacks[request_id]

    def register_module_session(self, module_session):
        self.module_sessions[module_session.module_session_id] = module_session

    def unregister_module_session(self, module_session):
        if module_session.module_session_id in self.module_sessions:
            del self.module_sessions[module_session.module_session_id]

    def send_response_message(self, msg_type, msg, request_id=None,
                              values=None, api=True):
        if request_id is None:
            request_id = self.request_id
        if msg_type in ["OK", "ERROR", "CANCELLED"]:
            self.unregister_module_request(request_id)
        self.callbacks[request_id](msg_type, msg, request_id, values)

    def register_module_request(self, request_id, module_session_id):
        self._requests[request_id] = module_session_id

    def unregister_module_request(self, request_id):
        if request_id in self._requests:
            del self._requests[request_id]

    def send_command_response(self, request_id, values):
        if request_id is None:
            request_id = self.request_id
        self.unregister_module_request(request_id)
        self.callbacks[request_id]("", "", request_id, values)
