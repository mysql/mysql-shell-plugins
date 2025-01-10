ws.tokens["current_directory"] = "user_stories/shell"
ws.tokens["current_test_name"] = "new_session"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")


var default_mysql_options = ws.tokens.defaults.database_connections.mysql[0].options


//  Preconditions
await ws.execute("__lib/sql_editor/_create_test_sessions.js")


// Tests
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_db_connection",
    "args": {
        "profile_id": 1,
        "connection": {
            "db_type": "MySQL",
            "caption": "This is a test MySQL database",
            "description": "This is a test MySQL database description",
            "options": {
                "scheme": default_mysql_options.scheme,
                "user": default_mysql_options.user,
                "password": default_mysql_options.password,
                "host": default_mysql_options.host,
                "port": default_mysql_options.port,
            }
        },
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": ws.ignore
        },
        "result": ws.matchRegexp("\\d+")
    }
])

ws.tokens["db_connection_id"] = ws.lastResponse["result"]

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "done": true
})



await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.start_session",
    "args": {
        "db_connection_id": ws.tokens["db_connection_id"]
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": { "type": "PENDING", "msg": "Execution started..." }
    },
    {
        "request_state": { "type": "OK", "msg": ws.ignore },
        "request_id": ws.lastGeneratedRequestId,
        "request_state": { "msg": "New Shell Interactive session created successfully." },
        "result": { "prompt_descriptor": { "mode": "Py" }, "module_session_id": ws.lastModuleSessionId, "last_prompt": {} }
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\sql",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": { "type": "PENDING", "msg": "Execution started..." }
    },
    {
        "result": { "info": "Switching to SQL mode... Commands end with ;\n" }
    },
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": { "type": "OK", "msg": ws.ignore }
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "show databases;",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": { "type": "PENDING", "msg": "Execution started..." }
    },
    {
        "request_state": { "type": "PENDING", "msg": "Executing..." },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "Field 1": {
                "Name": "`Database`",
                "Org_name": "`Database`",
                "Catalog": "`def`",
                "Database": "``",
                "Table": "`SCHEMATA`",
                "Org_table": ws.ignore,
                "Type": "String",
                "DbType": "VAR_STRING",
                "Collation": "utf8mb4_0900_ai_ci (255)",
                "Length": "256",
                "Decimals": "0",
                "Flags": ws.ignore
            }
        }
    },
    {
        "request_state": { "type": "PENDING", "msg": "Executing..." },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            'hasData': 1,
            'rows': ws.matchList([
                { 'Database': 'information_schema' },
                { 'Database': 'mysql' },
                { 'Database': 'performance_schema' },
                { 'Database': 'sys' }
            ], 0),
            'executionTime': ws.ignore,
            'affectedItemsCount': 0,
            'warningsCount': 0,
            'warnings': [],
            'info': '',
            'autoIncrementValue': 0
        }
    },
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": { "type": "OK", "msg": ws.ignore }
    }
])






// Test with disable-heat-wave-check connection parameter
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_db_connection",
    "args": {
        "profile_id": 1,
        "connection": {
            "db_type": "MySQL",
            "caption": "This is a test MySQL database (disable-heat-wave-check)",
            "description": "This is a test MySQL database description with disable-heat-wave-check parameter",
            "options": {
                "scheme": default_mysql_options.scheme,
                "user": default_mysql_options.user,
                "password": default_mysql_options.password,
                "host": default_mysql_options.host,
                "port": default_mysql_options.port,
                "disable-heat-wave-check": true,
            }
        },
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": ws.ignore
        },
        "result": ws.matchRegexp("\\d+")
    }
])

ws.tokens["db_connection_id"] = ws.lastResponse["result"]

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "done": true
})



await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.start_session",
    "args": {
        "db_connection_id": ws.tokens["db_connection_id"]
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": { "type": "PENDING", "msg": "Execution started..." }
    },
    {
        "request_state": { "type": "OK", "msg": ws.ignore },
        "request_id": ws.lastGeneratedRequestId,
        "request_state": { "msg": "New Shell Interactive session created successfully." },
        "result": { "prompt_descriptor": { "mode": "Py" }, "module_session_id": ws.lastModuleSessionId, "last_prompt": {} }
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\sql",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": { "type": "PENDING", "msg": "Execution started..." }
    },
    {
        "result": { "info": "Switching to SQL mode... Commands end with ;\n" }
    },
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": { "type": "OK", "msg": ws.ignore }
    }
])


//  Terminate
await ws.execute("__lib/shell/_close_session.js")

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
