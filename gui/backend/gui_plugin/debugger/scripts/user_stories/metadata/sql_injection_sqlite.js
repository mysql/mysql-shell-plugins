ws.tokens["current_directory"] = "user_stories/metadata"
ws.tokens["current_test_name"] = "sql_injection"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute("__lib/connection/_add_sqlite.js")

ws.tokens["connection_id"] = ws.tokens.lib.connection.add_sqlite.result["connection_id"]

// Start db session
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.start_session",
    "args": {
        "connection": ws.tokens["connection_id"],
    }
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
    },
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "Connection was successfully opened."
        },
        "module_session_id": ws.lastModuleSessionId,
        "info": {},
        "default_schema": ws.ignore
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Schema",
        "name": "main\`; SELECT 'fake_main'; --"
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
            "type": "ERROR",
            "msg": "The schema 'main\`; SELECT 'fake_main'; --' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId,
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Schema",
        "name": "main`; SELECT 'fake_main'; --"
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
            "type": "ERROR",
            "msg": "The schema 'main`; SELECT 'fake_main'; --' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId,
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Schema",
        "name": "main``; SELECT 'fake_main'; --"
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
            "type": "ERROR",
            "msg": "The schema 'main``; SELECT 'fake_main'; --' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId,
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Table",
        "schema_name": "main`; SELECT 'MyTable'; --"
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
            "type": "ERROR",
            "msg": "no such table: main"
        },
        "request_id": ws.lastGeneratedRequestId,
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Table",
        "schema_name": "main\`; SELECT 'MyTable'; --"
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
            "type": "ERROR",
            "msg": "no such table: main\\"
        },
        "request_id": ws.lastGeneratedRequestId,
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Table",
        "schema_name": "main``; SELECT 'MyTable'; --"
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
            "type": "ERROR",
            "msg": "no such table: main`; SELECT 'MyTable'; --.sqlite_master"
        },
        "request_id": ws.lastGeneratedRequestId,
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Column",
        "schema_name": "main",
        "table_name": "sqlite_master`; SELECT 'MyTable'; --"
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
        "result": []
    }
])


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Column",
        "schema_name": "main",
        "table_name": "sqlite_master",
        "name": "type`; SELECT 'MyColumn'; --"
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
            "type": "ERROR",
            "msg": "The column 'main.type`; SELECT 'MyColumn'; --' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId,
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {"name": ""}
    }
])

// Finalize
// Remove connection
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.dbconnections.remove_db_connection",
    "args": {
        "profile_id": 1,
        "connection_id": ws.tokens["connection_id"]
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        }
    }
])

// Close db session
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.close_session",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, [{
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "result": "Completed"
}])

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
