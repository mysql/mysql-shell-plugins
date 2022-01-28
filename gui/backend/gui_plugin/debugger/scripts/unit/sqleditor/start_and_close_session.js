await ws.execute("unit/authenticate/success_admin.js")

await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.start_session",
    "args": {}
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "New SQL Editor session created successfully."
    },
    "module_session_id": ws.matchRegexp("[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
})

await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.close_session",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
})

ws.validateLastResponse({
    "module_session_id": ws.lastModuleSessionId,
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "SQL Editor session has been closed successfully."
    }
})

