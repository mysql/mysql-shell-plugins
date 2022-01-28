var defaults = ws.tokens.defaults
var responses = ws.tokens["responses"]
var options = defaults.database_connections.mysql[0].options
var originalRequestId = ws.generateRequestId()

await ws.sendAndValidate({
    "request": "execute",
    "request_id": originalRequestId,
    "command": "gui.shell.execute",
    "args": {
        "command": "\\c msandbox@" + options.host + ":" + options.portStr,
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
            "info": "Creating a session to 'msandbox@" + options.host + ":" + options.portStr + "'\n"
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "password": "Please provide the password for 'msandbox@" + options.host + ":" + options.portStr + "': "
        }
    }
])

await ws.sendAndValidate({
    "request": "prompt_reply",
    "request_id": originalRequestId,
    "type": "OK",
    "reply": "somepassword",
    "module_session_id": ws.lastModuleSessionId,
}, [
    {
        'request_state': {
            'type': 'PENDING',
            'msg': 'Executing...'
        },
        'request_id': originalRequestId,
        'result': {
            "error":"MySQL Error 1045 (28000): Access denied for user 'msandbox'@'" + options.host + "' (using password: YES)\n"
        }
    },
    responses.ok.default
])

