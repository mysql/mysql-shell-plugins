var defaults = ws.tokens.defaults
var responses = ws.tokens.responses
var requests = ws.tokens.requests

var options = defaults.database_connections.mysql[1].options

await ws.sendAndValidate(Object.assign(Object(), requests.shell.execute, {
    "args": {
        "command": "\\c " + options.user + ":@" + options.host + ":" + options.portStr + "/mysql",
        "module_session_id": ws.lastModuleSessionId,
    }
}), [
    responses.pending.executionStarted,
    Object.assign(Object(), responses.pending.executing, {
        'result': {
            'info': "Creating a session to '" + options.user + "@" + options.host + ":" + options.portStr + "/mysql'\n"
        }
    }),
    Object.assign(Object(), responses.pending.executing, {
        "result": {
            "info": ws.matchRegexp("Your MySQL connection id is \\d+ \\(X protocol\\)\\nServer version: .+")
        }
    }),
    Object.assign(Object(), responses.ok.default, {
        "result": {
            "prompt_descriptor": {
                "host": options.host,
                "port": options.portStr,
                "schema": "mysql",
                "mode": "Py",
                "session": 'x',
                "ssl": true,
                "is_production": false
            }
        }
    })
])
