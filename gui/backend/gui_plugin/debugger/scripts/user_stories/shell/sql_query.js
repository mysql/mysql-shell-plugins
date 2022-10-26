ws.tokens["current_directory"] = "user_stories/shell"
ws.tokens["current_test_name"] = "sql_query"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute("__lib/shell/_open_session.js")

// Test Execution
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
            "info": ws.matchRegexp("Your MySQL connection id is \\d+\\nServer version: .+")
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
        "command": "SELECT user FROM mysql.user;",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_state": {"type": "PENDING","msg": "Execution started..."}
    },
    {
        "request_state": {"type": "PENDING", "msg": "Executing..."},
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "Field 1": {
                "Name": "`user`",
                "Org_name": "`User`",
                "Catalog": "`def`",
                "Database": "`mysql`",
                "Table": "`user`",
                "Org_table": "`user`",
                "Type": "String",
                "DbType": "STRING",
                "Collation": "utf8mb4_0900_ai_ci (255)",
                "Length": "128",
                "Decimals": "0",
                "Flags": "NOT_NULL PRI_KEY BINARY PART_KEY"
            }
        }
    },
    {
        "request_state": {"type": "PENDING","msg": "Executing..."},
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "hasData": true,
            "rows": [],
            "executionTime": ws.ignore,
            "affectedRowCount": 0,
            "affectedItemsCount": 0,
            "warningCount": 0,
            "warningsCount": 0,
            "warnings": [],
            "info": "", "autoIncrementValue": 0
        }
    },
    {
        "request_state": {"type": "OK","msg": ws.ignore},
        "request_id": ws.lastGeneratedRequestId,
    }    
])


await ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request": "execute",
    "command": "gui.shell.execute",
    "args": {
        "command": "insert into test_user_story.categories values (1, 'あほの酒田');",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        },
        "request_id": ws.lastGeneratedRequestId,
    },{
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "hasData": false,
            "rows": [],
            "executionTime": ws.ignore,
            "affectedRowCount": 1,
            "affectedItemsCount": 1,
            "warningCount": 0,
            "warningsCount": 0,
            "warnings": [],
            "info": "",
            "autoIncrementValue": 1
        }
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
    "request_id": ws.generateRequestId(),
    "request": "execute",
    "command": "gui.shell.execute",
    "args": {
        "command": "select * from test_user_story.categories;",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        },
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "Field 1": {
                "Name": "`categoryID`",
                "Org_name": "`categoryID`",
                "Catalog": "`def`",
                "Database": "`test_user_story`",
                "Table": "`categories`",
                "Org_table": "`categories`",
                "Type": "Integer",
                "DbType": "LONG",
                "Collation": "binary (63)",
                "Length": "11",
                "Decimals": "0",
                "Flags": "NOT_NULL PRI_KEY AUTO_INCREMENT NUM PART_KEY"
            },
            "Field 2": {
                "Name": "`categoryName`",
                "Org_name": "`categoryName`",
                "Catalog": "`def`",
                "Database": "`test_user_story`",
                "Table": "`categories`",
                "Org_table": "`categories`",
                "Type": "String",
                "DbType": "VAR_STRING",
                "Collation": "utf8mb4_0900_ai_ci (255)",
                "Length": "400",
                "Decimals": "0",
                "Flags": "NOT_NULL NO_DEFAULT_VALUE"
            }
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "hasData": true,
            "rows": [
                {
                    "categoryID": 1,
                    "categoryName": "あほの酒田"
                }
            ],
            "executionTime": ws.ignore,
            "affectedRowCount": 0,
            "affectedItemsCount": 0,
            "warningCount": 0,
            "warningsCount": 0,
            "warnings": [],
            "info": "",
            "autoIncrementValue": 1
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

//  Terminate
await ws.execute("__lib/shell/_close_session.js")

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
