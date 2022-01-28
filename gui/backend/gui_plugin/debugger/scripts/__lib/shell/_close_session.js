//
//  Closes the current connection used by the module identified byt the module id
//
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.close_session",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, [
    {
        "module_session_id": ws.lastModuleSessionId,
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "The Shell Interactive session has been closed successfully."
        }
    }
])
