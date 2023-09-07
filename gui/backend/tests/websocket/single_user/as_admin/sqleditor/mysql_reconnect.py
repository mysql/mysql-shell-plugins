# Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

import mysqlsh

# pylint: disable-msg=W0631 for variable ws
from tests.websocket.TestWebSocket import TWebSocket

ws: TWebSocket

test_session_id = ws.tokens['test_session_id']

default_mysql_options = ws.tokens.defaults.database_connections.mysql[0].options

connection_options = {
    "host": default_mysql_options.host,
    "port": default_mysql_options.port,
    "user": default_mysql_options.user,
    "password": default_mysql_options.password,
    "scheme": default_mysql_options.scheme,
    "schema": "information_schema"
}


def get_session_ids(session, session_id):
    res = session.run_sql(
        f"""SELECT PROCESSLIST_ID
            FROM performance_schema.session_connect_attrs
            WHERE ATTR_NAME='test_session_id'
            AND ATTR_VALUE='{session_id}'
            ORDER BY PROCESSLIST_ID ASC""")

    id1 = res.fetch_one()[0]
    id2 = res.fetch_one()[0]

    return (id1, id2)


def kill_session(session, id):
    session.run_sql(f"KILL {id}")


session = mysqlsh.globals.shell.open_session(connection_options)

# Kills user session and sends new statement which will retrigger automatic reconnection
service_session_id, user_session_id = get_session_ids(session, test_session_id)
kill_session(session, user_session_id)

ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "SELECT 1 as result;",
        "module_session_id": ws.tokens["module_session_id"],
        "params": []
    }
},
    [
        {
            "request_id": ws.lastGeneratedRequestId,
            "request_state": {"type": "PENDING", "msg": "Execution started..."}
        },
        {
            "request_state": {"type": "PENDING", "msg": "Connection lost, reconnecting session..."},
            "request_id": ws.lastGeneratedRequestId
        },
        {
            "request_state": {"type": "PENDING", "msg": ""},
            "request_id": ws.lastGeneratedRequestId,
            "result": {
                "rows": [[1]],
                "columns": [{"name": "result", "type": "INT", "length": ws.ignore}],
                "total_row_count": 1,
                "execution_time": ws.ignore
            }
        },
        {
            "request_state": {"type": "OK", "msg": ""},
            "request_id": ws.lastGeneratedRequestId,
            "done": True
        }
]
)

# Validates that the user session is new (and so comes last)
id1, id2 = get_session_ids(session, test_session_id)
assert service_session_id == id1, "Unexpected Service Session ID"
assert user_session_id != id2, "Unexpected User Session ID"
user_session_id = id2

# Kills the service session and executes command that uses the Service Session
# Automatic reconnection happens with no notification for the FE
kill_session(session, service_session_id)
ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_catalog_object_names",
    "args": {
        "module_session_id": ws.tokens["module_session_id"],
        "type": "Schema"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {"type": "PENDING", "msg": "Execution started..."}
    },
    {
        "request_state": {"type": "PENDING", "msg": ""},
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(["information_schema", "mysql", "performance_schema"], 0)
    },
    {
        "request_state": {"type": "OK", "msg": ""},
        "request_id": ws.lastGeneratedRequestId,
        "done": True
    }
])

# Validates that the service session is new (and so comes last)
id1, id2 = get_session_ids(session, test_session_id)
assert service_session_id != id2, "Unexpected Service Session ID"
assert user_session_id == id1, "Unexpected User Session ID"
service_session_id = id2


# Tests reconnection triggered by the user
ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.reconnect",
    "args": {
        "module_session_id": ws.tokens["module_session_id"],
    }
},
    [
        {
            "request_state": {"type": "OK", "msg": "Connection was successfully opened."},
            "result":
            {
                "module_session_id": ws.tokens["module_session_id"],
                "info": {
                    "version": ws.matchRegexp("\\d+\\.\\d+\\.\\d+"),
                    "edition": ws.ignore,
                    "sql_mode": ws.ignore
                },
                "default_schema": connection_options["schema"],
            },
            "request_id": ws.lastGeneratedRequestId
        }
]
)

# Validates that both sessions are new (and so come in order)
id1, id2 = get_session_ids(session, test_session_id)
assert service_session_id != id1, "Unexpected Service Session ID"
assert user_session_id != id2, "Unexpected User Session ID"

kill_session(session, id1)
kill_session(session, id2)

session.close()
