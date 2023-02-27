var defaults = ws.tokens.defaults
var options = defaults.database_connections.mysql[0].options
options.schema = "information_schema"

responses = ws.tokens["responses"]

ws.tokens["profile_id"] = 1
ws.tokens["db_type"] = "MySQL"
ws.tokens["folder_path"] = "tests"

ws.log("Executing mysql connection tests for classical protocol")


ws.log("Get current schema")

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.get_current_schema",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": options.schema
    }
])

ws.tokens['initialSchema'] = ws.lastResponse['result']

ws.validateLastResponse({
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
})

ws.log("Set current schema")

// Change to mysql schema

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.set_current_schema",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "schema_name": "mysql"
    }
}, [
    responses.pending.executionStarted,
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
        "module_session_id": ws.lastModuleSessionId
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": "mysql"
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])

// Change to mysql information_schema

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.set_current_schema",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "schema_name": "information_schema"
    }
}, [
    responses.pending.executionStarted,
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
    "command": "gui.sqleditor.get_current_schema",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": "information_schema"
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])


// Change back to the original schema

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.set_current_schema",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "schema_name": ws.tokens['initialSchema']
    }
}, [
    responses.pending.executionStarted,
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
        "module_session_id": ws.lastModuleSessionId
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.tokens['initialSchema']
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])


ws.log("Executing query")

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "SELECT * FROM information_schema.schemata;",
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ws.ignore
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "columns": [{ "name": "CATALOG_NAME", "type": "STRING" },
            { "name": "SCHEMA_NAME", "type": "STRING" },
            { "name": "DEFAULT_CHARACTER_SET_NAME", "type": "STRING" },
            { "name": "DEFAULT_COLLATION_NAME", "type": "STRING" },
            { "name": "SQL_PATH", "type": "NULL" }],
            "rows": ws.ignore,
            "total_row_count": ws.matchRegexp("\\d+"),
            "execution_time": ws.ignore,
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "SHOW DATABASES LIKE ?;",
        "module_session_id": ws.lastModuleSessionId,
        "params": ['mysql'],
        "options": {}
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ws.ignore
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "columns": [{ "name": "Database (mysql)", "type": "STRING" }],
            "rows": ws.ignore,
            "total_row_count": ws.matchRegexp("\\d+"),
            "execution_time": ws.ignore,
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])


await ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request": "execute",
    "command": "gui.sqleditor.reconnect",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Connection was successfully opened."
        },
        "result": {
            "module_session_id": ws.lastModuleSessionId,
            "info": {
                "version": ws.matchRegexp("\\d+\\.\\d+\\.\\d+"),
                "edition": ws.ignore,
                "sql_mode": ws.ignore
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
        "done": true
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "SHOW DATABASES LIKE ?;",
        "module_session_id": ws.lastModuleSessionId,
        "params": ['mysql'],
        "options": {}
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ws.ignore
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "columns": [{ "name": "Database (mysql)", "type": "STRING" }],
            "rows": ws.ignore,
            "total_row_count": ws.matchRegexp("\\d+"),
            "execution_time": ws.ignore,
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])
