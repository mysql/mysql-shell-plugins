await ws.execute("unit/authenticate/success_admin.js")

await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.users.kist_users",
    "args": {}
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "ERROR",
        "msg": "Object 'gui.users' has no member function named 'kist_users'"
    }
})
