ws.tokens["current_directory"] = "user_stories/shell"
ws.tokens["current_test_name"] = "new_session"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

// Test Execution
var default_mysql_options = ws.tokens.defaults.database_connections.mysql[0].options

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
                "host": default_mysql_options.host,
                "port": default_mysql_options.port,
            }
        },
    }
}, [
    {
        "request_state": { "type": "PENDING", "msg": ws.ignore },
        "request_id": ws.lastGeneratedRequestId,
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

ws.tokens["uri"] = default_mysql_options.user + '@' + default_mysql_options.host + ':' + default_mysql_options.portStr

request_id = ws.generateRequestId()

await ws.sendAndValidate({
    "request": "execute",
    "request_id": request_id,
    "command": "gui.shell.start_session",
    "args": {
        "db_connection_id": ws.tokens["db_connection_id"]
    }
}, ws.matchList([
    {
        "request_state": { "type": "PENDING", "msg": "Execution started..." },
        "request_id": ws.lastGeneratedRequestId,
    },
    {
        "request_state": { "type": "PENDING", "msg": "Executing..." },
        "request_id": ws.lastGeneratedRequestId,
        "result":
        {
            'module_session_id': ws.ignore,
            'defaultValue': '',
            'prompt': "Please provide the password for '" + ws.tokens["uri"] + "': ",
            'type': 'password'
        }
    }
], 0))

var next_reply = default_mysql_options.password

if (ws.tokens["hasCredentialManager"]) {
    await ws.sendAndValidate({
        "request": "prompt_reply",
        "request_id": request_id,
        "type": "OK",
        "reply": next_reply,
        "module_session_id": ws.lastModuleSessionId,
    }, [
        {
            "request_state": { "type": "PENDING", "msg": "Executing..." },
            "request_id": request_id,
            "result":
            {
                "alt": "Ne&ver",
                "defaultValue": "&No",
                "no": "&No",
                "prompt": "Save password for '" + ws.tokens["uri"] + "'?",
                "type": "confirm",
                "yes": "&Yes"
            }
        }
    ])

    next_reply = "N"
} // endif

await ws.sendAndValidate({
    "request": "prompt_reply",
    "request_id": request_id,
    "type": "OK",
    "reply": next_reply,
    "module_session_id": ws.lastModuleSessionId,
}, [
    {
        "request_state": { "msg": "New Shell Interactive session created successfully." },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "prompt_descriptor": {
                "mode": "Py"
            }
        }
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
        "request_state": { "type": "PENDING", "msg": "Execution started..." },
        "request_id": ws.lastGeneratedRequestId,
    },
    {
        "request_state": { "type": "PENDING", "msg": "Executing..." },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "info": "Switching to SQL mode... Commands end with ;\n"
        }
    },
    {
        "request_state": { "type": "OK", "msg": ws.ignore },
        "request_id": ws.lastGeneratedRequestId,
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
        "request_state": { "type": "PENDING", "msg": "Execution started..." },
        "request_id": ws.lastGeneratedRequestId,
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
        'result': {
            'hasData': true,
            'rows': ws.matchList([
                { 'Database': 'information_schema' },
                { 'Database': 'mysql' },
                { 'Database': 'performance_schema' },
                { 'Database': 'sys' }
            ], false),
            'executionTime': ws.ignore,
            'affectedItemsCount': 0,
            'warningsCount': 0,
            'warnings': [],
            'info': '',
            'autoIncrementValue': 0
        }
    },
    {
        "request_state": { "type": "OK", "msg": ws.ignore },
        "request_id": ws.lastGeneratedRequestId,
    }
])

//  Terminate
await ws.execute("__lib/shell/_close_session.js")

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")

