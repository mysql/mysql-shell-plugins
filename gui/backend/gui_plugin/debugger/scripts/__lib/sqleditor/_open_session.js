//
//  Start a new sqleditor session
//  return:
//      session_id: the id of the session that was just opened
//
var lib = ws.tokens.lib
var _this = lib.sqleditor.open_session


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.start_session",
    "args": {}
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "New SQL Editor session created successfully."
        },
        "module_session_id": ws.matchRegexp("[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
    }
])

_this.result["session_id"] = ws.lastResponse['module_session_id']
