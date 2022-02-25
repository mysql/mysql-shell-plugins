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

import gui_plugin.core.Logger as logger

class BaseTask():
    def __init__(self, request_id, result_queue=None, result_callback=None, options=None):
        self.request_id = request_id
        self.result_queue = result_queue
        self.result_callback = result_callback
        self.options = options if options else {}
        self.cancelled = False

    def dispatch_result(self, state, message=None, data=None):
        if not self.result_queue is None:
            if not message is None:
                self.result_queue.put(message)

            if not data is None:
                self.result_queue.put(data)

        if not self.result_callback is None:
            try:
                self.result_callback(state, message, self.request_id, data)
            except Exception as e:
                logger.error("There was an unhandled exception during the callback")
                logger.debug(self.result_callback)
                logger.exception(e)
                raise

    def do_execute(self):
        raise NotImplementedError()

    def cancel(self):
        self.cancelled = True

    def execute(self):
        self.do_execute() if not self.cancelled else self.dispatch_result("CANCELLED")


class CommandTask(BaseTask):
    def __init__(self, request_id, command, params=None, result_queue=None, result_callback=None, options=None):
        super().__init__(request_id, result_queue, result_callback, options)
        self.command = command
        self.params = params
