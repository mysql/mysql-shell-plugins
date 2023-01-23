ws.tokens["profile_id"] = 1
ws.tokens["db_type"] = "Sqlite"
ws.tokens["db_file"] = "tests_add_sqlite_connection.sqlite3"
ws.tokens["folder_path"] = "tests"

await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.start_session",
    "args": {}
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "result": {
        "module_session_id": ws.matchRegexp("[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
    }
})

await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.create_file",
    "args": {
        "path": ws.tokens["db_file"]
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "result": ws.tokens["db_file"]
})

await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.dbconnections.add_db_connection",
    "args": {
        "profile_id": ws.tokens["profile_id"],
        "connection": {
            "db_type": ws.tokens["db_type"],
            "caption": "This is a test sqlite3 database",
            "description": "This is a test sqlite3 database description",
            "options": {
                "db_file": ws.tokens["db_file"]
            }
        },
        "folder_path": ws.tokens["folder_path"]
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "result": ws.matchRegexp("\\d+")
})

ws.tokens["connection_id"] = ws.lastResponse["result"]

await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.open_connection",
    "args": {
        "db_connection_id": ws.tokens["connection_id"],
        "module_session_id": ws.lastModuleSessionId,
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "Connection was successfully opened."
    },
    "result": {
        "module_session_id": ws.lastModuleSessionId,
        "info": {},
        "default_schema": "tests_add_sqlite_connection"
    }
})

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
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "columns": [{"name": "seq", "type": "int"},
                        {"name": "name", "type": "str"},
                        {"name": "file", "type": "str"}],
            "rows": ws.ignore,
            "total_row_count": 1,
            "execution_time": ws.ignore
        }
    }
])

await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.close_session",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "result": "Completed"
})

await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.dbconnections.remove_db_connection",
    "args": {
        "profile_id": ws.tokens["profile_id"],
        "connection_id": ws.tokens["connection_id"]
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    }
})
