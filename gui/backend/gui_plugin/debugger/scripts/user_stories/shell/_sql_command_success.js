var defaults = ws.tokens.defaults
var responses = ws.tokens["responses"]

var options = defaults.database_connections.mysql[0].options

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\c " + options.user + ":@" + options.host + ":" + options.portStr,
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.pending.executionStarted,
    {
        'request_state': {
            'type': 'PENDING',
            'msg': 'Executing...'
        },
        'request_id': ws.lastGeneratedRequestId,
        'result': {
            'info': "Creating a session to '" + options.user + "@" + options.host + ":" + options.portStr + "'\n"
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "info": ws.matchRegexp("Your MySQL connection id is \\d+\\nServer version: .+\n")
        }
    },
    responses.ok.default
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
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "info": "Switching to SQL mode... Commands end with ;\n"
        }
    },
    responses.ok.default
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
    responses.pending.executionStarted,
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
    responses.ok.default
])

