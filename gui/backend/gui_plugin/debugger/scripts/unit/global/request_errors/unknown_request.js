await ws.execute("unit/authenticate/success_admin.js")

await ws.send({
    "request": "execute1",
    "request_id": ws.generateRequestId(),
    "command": "gui.users.list_users",
    "args": {}
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "ERROR",
        "msg": "Unknown request: execute1."
    }
})
