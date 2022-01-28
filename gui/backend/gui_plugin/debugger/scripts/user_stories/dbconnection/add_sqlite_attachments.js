await ws.execute("unit/authenticate/success_admin.js")

ws.tokens["profile_id"] = 1
ws.tokens["db_type"] = "Sqlite"
ws.tokens["schema1"] = "schema_1.sqlite3"
ws.tokens["schema2"] = "schema_2.sqlite3"
ws.tokens["schema3"] = "schema_3.sqlite3"
ws.tokens["folder_path"] = "tests"

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.start_session",
    "args": {}
}, [{
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "New SQL Editor session created successfully."
    },
    "module_session_id": ws.matchRegexp("[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
}])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.create_file",
    "args": {
        "path": ws.tokens["schema1"]
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "The file was created"
        },
        "result": ws.tokens["schema1"]
    }
])


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.create_file",
    "args": {
        "path": ws.tokens["schema2"]
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "The file was created"
        },
        "result": ws.tokens["schema2"]
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.create_file",
    "args": {
        "path": ws.tokens["schema3"]
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "The file was created"
        },
        "result": ws.tokens["schema3"]
    }
])


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.dbconnections.add_db_connection",
    "args": {
        "profile_id": ws.tokens["profile_id"],
        "connection": {
            "db_type": ws.tokens["db_type"],
            "caption": "This is a test sqlite3 database cluster",
            "description": "This is a test sqlite3 database cluster description",
            "options": {
                "db_file": ws.tokens["schema1"],
                "database_name": "schema1",
                "attach": [
                    {
                        "db_file": ws.tokens["schema2"],
                        "database_name": "schema2"
                    },
                    {
                        "db_file": ws.tokens["schema3"],
                        "database_name": "schema3"
                    }
                ]
            },
        },
        "folder_path": ws.tokens["folder_path"]
    }
}, [{
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "result": {
        "db_connection_id": ws.matchRegexp("\\d+")
    }
}])


ws.tokens["connection_id"] = ws.lastResponse['result']['db_connection_id']

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.open_connection",
    "args": {
        "db_connection_id": ws.tokens["connection_id"],
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "Connection was successfully opened."
        },
        "module_session_id": ws.lastModuleSessionId,
        "info": {},
        "default_schema": "schema1"
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.get_current_schema",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": "schema1"
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "SELECT * FROM pragma_database_list();",
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": "Full result set consisting of 3 rows transferred."
        },
        "request_id": ws.lastGeneratedRequestId,
        "columns": [{"name": "seq", "type": "int"},
                    {"name": "name", "type": "str"},
                    {"name": "file", "type": "str"}],
        "rows": ws.matchList([
            [
                0, 'main', ws.ignore
            ],
            [
                2, "schema2", ws.ignore
            ],
            [
                3, "schema3", ws.ignore
            ]
        ]),
        "total_row_count": 3,
        "execution_time": ws.ignore
    }
])


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.set_current_schema",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "schema_name": "invalid_name"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "ERROR",
            "msg": "The schema 'invalid_name' is invalid"
        }
    }
])


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.set_current_schema",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "schema_name": "schema2"
    }
}, [
    {
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "PENDING",
        "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.get_current_schema",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": "schema2",
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.close_session",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, [{
    "module_session_id": ws.lastModuleSessionId,
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "SQL Editor session has been closed successfully."
    }
}])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.dbconnections.remove_db_connection",
    "args": {
        "profile_id": ws.tokens["profile_id"],
        "connection_id": ws.tokens["connection_id"]
    }
}, [{
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    }
}])

