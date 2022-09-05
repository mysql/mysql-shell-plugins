ws.tokens["current_directory"] = "user_stories/shell"
ws.tokens["current_test_name"] = "sql_command_success"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute("__lib/shell/_open_session.js")

// Execution
var options = ws.tokens.defaults.database_connections.mysql[0].options

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\c " + options.user + ":@" + options.host + ":" + options.portStr,
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_state": {"type": "PENDING","msg": "Execution started..."},
        "request_id": ws.lastGeneratedRequestId,
    },
    {
        'request_id': ws.lastGeneratedRequestId,
        'request_state': {'type': 'PENDING','msg': 'Executing...'},
        'result': {
            'info': "Creating a session to '" + options.user + "@" + options.host + ":" + options.portStr + "'\n"
        }
    },
    {
        "request_state": {"type": "PENDING","msg": "Executing..."},
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "info": ws.matchRegexp("Your MySQL connection id is \\d+\\nServer version: .+\n")
        }
    },
    {
        "request_state": {"type": "OK","msg": ws.ignore},
        "request_id": ws.lastGeneratedRequestId,
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
        "request_state": {"type": "PENDING","msg": "Execution started..."},
        "request_id": ws.lastGeneratedRequestId,
    },
    {
        "request_state": {"type": "PENDING","msg": "Executing..."},
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "info": "Switching to SQL mode... Commands end with ;\n"
        }
    },
    {
        "request_state": {"type": "OK","msg": ws.ignore},
        "request_id": ws.lastGeneratedRequestId,
    }
])


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "SELECT 1 as col1, 2 as col2, 3 as col3;",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_state": {"type": "PENDING","msg": "Execution started..."},
        "request_id": ws.lastGeneratedRequestId,
    },
    {
        "request_state": {"type": "PENDING", "msg": "Executing..."},
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "Field 1": {
                "Name": "`col1`",
                "Org_name": "``",
                "Catalog": "`def`",
                "Database": "``",
                "Table": "``",
                "Org_table": "``",
                "Type": "Integer",
                "DbType": "LONGLONG",
                "Collation": "binary (63)",
                "Length": "2",
                "Decimals": "0",
                "Flags": "NOT_NULL BINARY NUM"
            },
            "Field 2": {
                "Name": "`col2`",
                "Org_name": "``",
                "Catalog": "`def`",
                "Database": "``",
                "Table": "``",
                "Org_table": "``",
                "Type": "Integer",
                "DbType": "LONGLONG",
                "Collation": "binary (63)",
                "Length": "2",
                "Decimals": "0",
                "Flags": "NOT_NULL BINARY NUM"
            },
            "Field 3": {
                "Name": "`col3`",
                "Org_name": "``",
                "Catalog": "`def`",
                "Database": "``",
                "Table": "``",
                "Org_table": "``",
                "Type": "Integer",
                "DbType": "LONGLONG",
                "Collation": "binary (63)",
                "Length": "2",
                "Decimals": "0",
                "Flags": "NOT_NULL BINARY NUM"
            }
        }
    },
    {
        "request_state": {"type": "PENDING","msg": "Executing..."},
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "hasData": true,
            "rows": [
                {
                    "col1": 1,
                    "col2": 2,
                    "col3": 3
                }
            ],
            "executionTime": ws.ignore,
            "affectedRowCount": 0,
            "affectedItemsCount": 0,
            "warningCount": 0,
            "warningsCount": 0,
            "warnings": [],
            "info": "",
            "autoIncrementValue": 0
        }
    },
    {
        "request_state": {"type": "OK","msg": ws.ignore},
        "request_id": ws.lastGeneratedRequestId,
    }
])



//  Terminate
await ws.execute("__lib/shell/_close_session.js")

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
