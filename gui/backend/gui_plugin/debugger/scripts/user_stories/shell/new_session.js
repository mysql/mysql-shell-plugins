ws.tokens["current_directory"] = "user_stories/shell"
ws.tokens["current_test_name"] = "new_session"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute("__lib/shell/_open_session.js")

var default_mysql_options = ws.tokens.defaults.database_connections.mysql[0].options

await ws.sendAndValidate(
    {
        "request": "execute",
        "request_id": ws.generateRequestId(true),
        "command": "gui.shell.execute",
        "args": {
            "command": "\\option -l",
            "module_session_id": ws.lastModuleSessionId,
        }
    }, ws.matchList([
        {
            "request_state": { "type": "PENDING", "msg": "Execution started..." },
            "request_id": ws.lastGeneratedRequestId,
        },
        {
            "result": { "info": " autocomplete.nameCache          false\n" },
        },
        {
            "result": { "info": " batchContinueOnError            false\n" }
        },
        {
            "request_state": { "type": "OK", "msg": ws.ignore },
            "request_id": ws.lastGeneratedRequestId,
        }], false))


await ws.sendAndValidate(
    {
        "request": "execute",
        "request_id": ws.generateRequestId(true),
        "command": "gui.shell.execute",
        "args": {
            "command": "\\c " + default_mysql_options.user + ":@" + default_mysql_options.host + ":" + default_mysql_options.portStr,
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
            "info": "Creating a session to '" + default_mysql_options.user + "@" + default_mysql_options.host + ":" + default_mysql_options.portStr + "'\n"
        }
    },
    {
        "request_state": { "type": "PENDING", "msg": "Executing..." },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "info": ws.matchRegexp("Your MySQL connection id is \\d+\nServer version: .+")
        }
    },
    {
        "request_state": { "type": "OK", "msg": ws.ignore },
        "request_id": ws.lastGeneratedRequestId,
    }])

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
    }])

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
            'hasData': 1,
            'rows': ws.matchList([
                { 'Database': 'information_schema' },
                { 'Database': 'mysql' },
                { 'Database': 'performance_schema' },
                { 'Database': 'sys' }
            ], 0),
            'executionTime': ws.ignore,
            'affectedRowCount': 0,
            'affectedItemsCount': 0,
            'warningCount': 0,
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
