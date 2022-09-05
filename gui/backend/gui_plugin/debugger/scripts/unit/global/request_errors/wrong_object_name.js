await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.ysers.list_users",
    "args": {}
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "ERROR",
        "msg": "Object 'gui' has no member named 'ysers'"
    }
})
