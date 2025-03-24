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
from http.server import HTTPServer
from socketserver import ThreadingMixIn
from typing import Optional

from gui_plugin.core.BackendDbLogger import BackendDbLogger

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handle requests in a separate thread."""
    stopped: bool = False
    single_instance_token: Optional[str] = None
    single_server: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None

    def serve_forever(self, _=0.5):
        """This is the main http server loop"""
        self.timeout = 0.1

        while not self.stopped:
            self.handle_request()

        BackendDbLogger.close()

    def force_stop(self):
        """Make the server stop in the next iteration"""
        self.stopped = True
