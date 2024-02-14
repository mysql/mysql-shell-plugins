# Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import mysqlsh

# pylint: disable-msg=W0631 for variable ws
from tests.websocket.TestWebSocket import TWebSocket

ws: TWebSocket

execute_request_id = ws.generateRequestId()

ws.sendAndValidate({
    "request": "execute",
    "request_id": execute_request_id,
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "SELECT SLEEP(3);",
        "module_session_id": ws.tokens["module_session_id"],
        "params": []
    }
}, [
    {
        "request_state": {"type": "PENDING", "msg": "Execution started..."},
        "request_id": execute_request_id
    }
])

ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.kill_query",
    "args": {
        "module_session_id": ws.tokens["module_session_id"],
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {"type": "OK", "msg": ""},
        "done": True
    },
    {
        "request_id": execute_request_id,
        "request_state": {"type": "ERROR", "msg": "Error[MSG-1201]: Query killed"},
    }
])
