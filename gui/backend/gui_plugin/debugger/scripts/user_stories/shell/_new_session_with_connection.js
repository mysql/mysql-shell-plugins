var defaults = ws.tokens.defaults
var responses = ws.tokens.responses
var requests = ws.tokens.requests
var default_mysql_options = defaults.database_connections.mysql[0].options


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.dbconnections.add_db_connection",
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
        "folder_path": ""
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "result": {
            "db_connection_id": ws.matchRegexp("\\d+")
        }
    }
])

ws.tokens["db_connection_id"] = ws.lastResponse['result']['db_connection_id']



await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.start_session",
    "args": {
        "db_connection_id": ws.tokens["db_connection_id"]
    }
}, [
    responses.pending.executionStarted,
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "New Shell session initiated..."
        },
        "module_session_id": ws.lastModuleSessionId,
        "result": {}
    },
    Object.assign(Object(), responses.ok.default, {
        "request_state": { "msg": "New Shell Interactive session created successfully." },
        "result": {
            "prompt_descriptor": {
                "mode": "Py"
            }
        }
    })
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
    Object.assign(Object(), responses.pending.executing, {
        "result": {
            "info": "Switching to SQL mode... Commands end with ;\n"
        }
    }),
    responses.ok.default
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
    responses.pending.executionStarted,
    Object.assign(Object(), responses.pending.executing, {
        'result': {
            'hasData': 1,
            'rows': ws.matchList([
                {'Database': 'information_schema'},
                {'Database': 'mysql'},
                {'Database': 'performance_schema'},
                {'Database': 'sys'}
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
    }),
    responses.ok.default
])