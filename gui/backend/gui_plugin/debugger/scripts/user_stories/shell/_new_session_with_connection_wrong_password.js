var defaults = ws.tokens.defaults
var responses = ws.tokens.responses
var requests = ws.tokens.requests
var default_mysql_options = defaults.database_connections.mysql[0].options

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
    Object.assign(Object(), responses.pending.executing, {
        "result":
        {
            'module_session_id': ws.ignore,
            'defaultValue': '',
            'prompt': "Please provide the password for '" + ws.tokens["uri"] + "': ",
            'type': 'password'
        }
    })
], 0))

await ws.sendAndValidate({
    "request": "prompt_reply",
    "request_id": request_id,
    "type": "OK",
    "reply": "wrong-password",
    "module_session_id": ws.lastModuleSessionId,
}, [
    {
        "request_state":
        {
            "type": "ERROR",
            "msg": "MySQL Error 1045 (28000): Access denied for user 'root'@'localhost' (using password: YES)"
        },
        "request_id": request_id,
    }
])
