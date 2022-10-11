# Copyright (c) 2022, Oracle and/or its affiliates.
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

# pylint: disable-msg=W0631 for variable ws
from tests.websocket.TestWebSocket import TWebSocket

ws: TWebSocket

test_session_id = ws.generateRequestId()

default_mysql_options = ws.tokens.defaults.database_connections.mysql[0].options

params = {
    "connection": {
        "db_type": "MySQL",
        "caption": "This is a test database",
        "description": "This is a test database description",
        "options": {
            "host": default_mysql_options.host,
            "port": default_mysql_options.port,
            "user": default_mysql_options.user,
            "password": default_mysql_options.password,
            "scheme": default_mysql_options.scheme,
            "schema": "information_schema",
            "connection-attributes": [f"test_session_id={test_session_id}"]
        }
    },
    "folder_path": "",
    "profile_id": 1,
}

ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.dbconnections.add_db_connection",
    "args": {
        "profile_id": params["profile_id"],
        "connection": params["connection"],
        "folder_path": params["folder_path"]
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "result": ws.matchRegexp("\\d+")
    }
])

connection_id = ws.lastResponse["result"]

ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.start_session",
    "args": {}
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "result": {
            "module_session_id": ws.matchRegexp("[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
        }
    }
])


ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.open_connection",
    "args": {
        "db_connection_id": connection_id,
        "module_session_id": ws.lastModuleSessionId,
    }
}, [{
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "Connection was successfully opened."
    },
    "module_session_id": ws.lastModuleSessionId,
    "info": {
        "version": ws.matchRegexp("8.0.[0-9][0-9]"),
        "edition": ws.ignore,
        "sql_mode": ws.ignore
    },
    "default_schema": params["connection"]["options"]["schema"]
}
])


ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": f"SELECT pl.Id, pl.STATE FROM performance_schema.session_connect_attrs AS attrs INNER JOIN INFORMATION_SCHEMA.PROCESSLIST as pl ON attrs.PROCESSLIST_ID = pl.Id WHERE attrs.ATTR_NAME='test_session_id' AND attrs.ATTR_VALUE='{test_session_id}'",
        "module_session_id": ws.lastModuleSessionId,
        "params": []
    }
},
    [
        {
            "request_id": ws.lastGeneratedRequestId,
            "request_state": {"type": "PENDING", "msg": "Execution started..."}
        },
        {
            "request_state": {"type": "OK", "msg": ""},
            "request_id": ws.lastGeneratedRequestId,
            "result": {
                "rows": [[ws.ignore, ws.ignore]],
                "columns": [
                    {"name": "Id", "type": "UINTEGER", "length": ws.ignore},
                    {"name": "STATE", "type": "STRING", "length": 256}
                ],
                "done": True,
                "total_row_count": ws.matchRegexp("\\d+"),
                "execution_time": ws.ignore
            }
        }
]
)

for row in ws.lastResponse["result"]["rows"]:
    if row[1] == "executing":
        user_session_id1 = row[0]
    else:
        service_session_id1 = row[0]

ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": f"KILL {user_session_id1};",
        "module_session_id": ws.lastModuleSessionId,
        "params": []
    }
},
    [
        {
            "request_id": ws.lastGeneratedRequestId,
            "request_state": {"type": "PENDING", "msg": "Execution started..."}
        },
        {
            "result": {
                "request_state": {
                    "type": "ERROR",
                    "msg": "ClassicSession.run_sql: Query execution was interrupted",
                    "source": "MYSQL",
                    "code": 1317,
                    "sqlstate": None
                }
            },
            "request_id": ws.lastGeneratedRequestId
        }
]
)

ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "SELECT 1 as result;",
        "module_session_id": ws.lastModuleSessionId,
        "params": []
    }
},
    [
        {
            "request_id": ws.lastGeneratedRequestId,
            "request_state": {"type": "PENDING", "msg": "Execution started..."}
        },
        {
            "result": {
                "request_state": {
                    "type": "ERROR",
                    "msg": "ClassicSession.run_sql: Lost connection to MySQL server during query",
                    "source": "MYSQL",
                    "code": 2013,
                    "sqlstate": None
                }
            },
            "request_id": ws.lastGeneratedRequestId
        }
]
)

ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.reconnect",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
    }
},
    [
        {
            "request_state": {"type": "OK", "msg": "Connection was successfully opened."},
            "module_session_id": ws.lastModuleSessionId,
            "info": {
                "version": ws.matchRegexp("8.0.[0-9][0-9]"),
                "edition": ws.ignore,
                "sql_mode": ws.ignore
            },
            "default_schema": params["connection"]["options"]["schema"],
            "request_id": ws.lastGeneratedRequestId
        }
]
)

ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "SELECT 1 as result;",
        "module_session_id": ws.lastModuleSessionId,
        "params": []
    }
},
    [
        {
            "request_id": ws.lastGeneratedRequestId,
            "request_state": {"type": "PENDING", "msg": "Execution started..."}
        },
        {
            "request_state": {"type": "OK", "msg": ""},
            "request_id": ws.lastGeneratedRequestId,
            "result": {
                "rows": [[1]],
                "columns": [{"name": "result", "type": "INTEGER", "length": ws.ignore}],
                "done": True,
                "total_row_count": 1,
                "execution_time": ws.ignore
            }
        }
]
)

ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": f"SELECT pl.Id, pl.STATE FROM performance_schema.session_connect_attrs AS attrs INNER JOIN INFORMATION_SCHEMA.PROCESSLIST as pl ON attrs.PROCESSLIST_ID = pl.Id WHERE attrs.ATTR_NAME='test_session_id' AND attrs.ATTR_VALUE='{test_session_id}'",
        "module_session_id": ws.lastModuleSessionId,
        "params": []
    }
},
    [
        {
            "request_id": ws.lastGeneratedRequestId,
            "request_state": {"type": "PENDING", "msg": "Execution started..."}
        },
        {
            "request_state": {"type": "OK", "msg": ""},
            "request_id": ws.lastGeneratedRequestId,
            "result": {
                "rows": [[ws.ignore, ws.ignore]],
                "columns": [
                    {"name": "Id", "type": "UINTEGER", "length": ws.ignore},
                    {"name": "STATE", "type": "STRING", "length": 256}
                ],
                "done": True,
                "total_row_count": ws.matchRegexp("\\d+"),
                "execution_time": ws.ignore
            }
        }
]
)

for row in ws.lastResponse["result"]["rows"]:
    if row[1] == "executing":
        user_session_id2 = row[0]
    else:
        service_session_id2 = row[0]

assert user_session_id2 > user_session_id1
assert service_session_id2 > service_session_id1


ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": f"KILL {service_session_id2};",
        "module_session_id": ws.lastModuleSessionId,
        "params": []
    }
},
    [
        {
            "request_id": ws.lastGeneratedRequestId,
            "request_state": {"type": "PENDING", "msg": "Execution started..."}
        },
        {
            "request_state": {"type": "OK", "msg": ""},
            "request_id": ws.lastGeneratedRequestId,
            "result": {
                "rows": [],
                "done": True,
                "total_row_count": 0,
                "execution_time": ws.ignore
            }
        }
]
)

ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request": "execute",
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Table",
        "schema_name": "sys",
        "filter": "%"
    }
}, [
    {
        "request_state": {"type": "PENDING", "msg": "Execution started..."},
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_state": {"type": "OK", "msg": ""},
        "request_id": ws.lastGeneratedRequestId,
        "result": []
    }
])


ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": f"SELECT pl.Id, pl.STATE FROM performance_schema.session_connect_attrs AS attrs INNER JOIN INFORMATION_SCHEMA.PROCESSLIST as pl ON attrs.PROCESSLIST_ID = pl.Id WHERE attrs.ATTR_NAME='test_session_id' AND attrs.ATTR_VALUE='{test_session_id}'",
        "module_session_id": ws.lastModuleSessionId,
        "params": []
    }
},
    [
        {
            "request_id": ws.lastGeneratedRequestId,
            "request_state": {"type": "PENDING", "msg": "Execution started..."}
        },
        {
            "request_state": {"type": "OK", "msg": ""},
            "request_id": ws.lastGeneratedRequestId,
            "result": {
                "rows": [[ws.ignore, ws.ignore]],
                "columns": [
                    {"name": "Id", "type": "UINTEGER", "length": ws.ignore},
                    {"name": "STATE", "type": "STRING", "length": 256}
                ],
                "done": True,
                "total_row_count": ws.matchRegexp("\\d+"),
                "execution_time": ws.ignore
            }
        }
]
)

for row in ws.lastResponse["result"]["rows"]:
    if row[1] == "executing":
        user_session_id3 = row[0]
    else:
        service_session_id3 = row[0]


assert user_session_id3 == user_session_id2
#assert service_session_id3 > service_session_id2
