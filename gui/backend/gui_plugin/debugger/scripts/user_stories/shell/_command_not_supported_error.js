var defaults = ws.tokens.defaults
var options = defaults.database_connections.mysql[1].options
var responses = ws.tokens["responses"]

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\system ls",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The requested command is not supported.",
            "source": "MSG",
            "code": 1500
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\source some_file",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The requested command is not supported.",
            "source": "MSG",
            "code": 1500
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\. some_file",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The requested command is not supported.",
            "source": "MSG",
            "code": 1500
        },
        "request_id": ws.lastGeneratedRequestId
    }
])
