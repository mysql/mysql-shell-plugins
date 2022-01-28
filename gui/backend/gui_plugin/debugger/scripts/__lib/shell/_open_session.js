//
//  Start a new sqleditor session
//  return:
//      session_id: the id of the session that was just opened
//
var lib = ws.tokens.lib
var responses = ws.tokens.responses
var _this = lib.shell.open_session


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.start_session",
    "args": {}
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

//_this.result["session_id"] = ws.lastResponse['module_session_id']
_this.result["prompt_descriptor"] = ws.lastResponse['result']['prompt_descriptor']
