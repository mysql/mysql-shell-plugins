var defaults = ws.tokens.defaults
var responses = ws.tokens["responses"]
var options = defaults.database_connections.mysql[0].options
var originalRequestId = ws.generateRequestId()

await ws.sendAndValidate({
    "request": "execute",
    "request_id": originalRequestId,
    "command": "gui.shell.execute",
    "args": {
        "command": "\\c user1@" + options.host + ":" + options.portStr,
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
            "info": "Creating a session to 'user1@" + options.host + ":" + options.portStr + "'\n"
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,

        "result":
        {
            'defaultValue': '',
            'prompt': "Please provide the password for 'user1@" + options.host + ":" + options.portStr + "': ",
            'type': 'password'
        }
    }
])

await ws.sendAndValidate({
    "request": "prompt_reply",
    "request_id": originalRequestId,
    "type": "CANCEL",
    "reply": "",
    "module_session_id": ws.lastModuleSessionId,
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": originalRequestId,
        "result": {
            "error": "Cancelled\n"
        }
    },
    responses.ok.default
])

