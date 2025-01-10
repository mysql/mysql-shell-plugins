# Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

test_session_id = ws.generateRequestId()

default_mysql_options = ws.tokens.defaults.database_connections.mysql[0].options


def get_session_id(session, session_id):
    res = session.run_sql(
        f"""SELECT PROCESSLIST_ID
            FROM performance_schema.session_connect_attrs
            WHERE ATTR_NAME='test_session_id'
            AND ATTR_VALUE='{session_id}'""")

    return res.fetch_one()[0]


def kill_session(session, id):
    session.run_sql(f"KILL {id}")


connection_options = {
    "host": default_mysql_options.host,
    "port": default_mysql_options.port,
    "user": default_mysql_options.user,
    "password": default_mysql_options.password,
    "scheme": default_mysql_options.scheme,
    "schema": "information_schema"
}

session = mysqlsh.globals.shell.open_session(connection_options)

params = {
    "connection": {
        "db_type": "MySQL",
        "caption": "This is a test database",
        "description": "This is a test database description",
        "options": {
            **connection_options,
            "connection-attributes": [f"test_session_id={test_session_id}"]
        }
    },
    "folder_path": "",
    "profile_id": 1,
}

await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_folder_path",
    "args": {
        "profile_id": 1,
        "caption": params["folder_path"]
    }
})

ws.validateLastResponse({
    "request_state": {
        "type": "PENDING",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": ws.ignore
})


ws.tokens['folder_path_id'] = ws.lastResponse['result']

ws.validateLastResponse({
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
})

ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_db_connection",
    "args": {
        "profile_id": params["profile_id"],
        "connection": params["connection"],
        "folder_path_id": ws.tokens['folder_path_id']
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {"type": "PENDING", "msg": ws.ignore},
        "result": ws.matchRegexp("\\d+")
    }
])

connection_id = ws.lastResponse["result"]

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {"type": "OK", "msg": ws.ignore},
    "done": True
})

ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.start_session",
    "args": {
        "connection": connection_id,
    }
}, [
    {
        "request_state": {"type": "PENDING", "msg": "Connection was successfully opened."},
        "result": {
            "module_session_id": ws.lastModuleSessionId,
            "info":
                {
                    "version": ws.ignore,
                    "edition": ws.ignore,
                    "sql_mode": "ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION",
                    "heat_wave_available": false
                },
            "default_schema": "information_schema",
        },
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "done": True
    }
])


# Kills the session and sends new statement which will retrigger automatic reconnection
session_id = get_session_id(session, test_session_id)
kill_session(session, session_id)

ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_catalog_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Schema"
    }
}, [
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
        "result": ws.matchList(["information_schema", "mysql", "performance_schema"], 0)
    },
    {
        "request_state": {"type": "OK", "msg": ""},
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])


# Validates that the session is new
id = get_session_id(session, test_session_id)
assert session_id != id, "Unexpected Session ID"


# Tests reconnection triggered by the user
ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.reconnect",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
    }
},
    [
        {
            "request_state": {"type": "PENDING", "msg": "Connection was successfully opened."},
            "result": {
                "module_session_id": ws.lastModuleSessionId,
                "info": {
                    "version": ws.matchRegexp("\\d+\\.\\d+\\.\\d+"),
                    "edition": ws.ignore,
                    "sql_mode": ws.ignore
                },
                "default_schema": params["connection"]["options"]["schema"],
            },
            "request_id": ws.lastGeneratedRequestId
        },
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "done": True
    }
]
)

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.remove_folder_path",
    "args": {
        "folder_path_id": ws.tokens['folder_path_id']
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "done": true
    }
])

# Validates that both sessions are new
id = get_session_id(session, test_session_id)
assert session_id != id, "Unexpected Service Session ID"

kill_session(session, id)
session.close()
