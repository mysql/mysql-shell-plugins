await ws.execute("unit/authenticate/success_single_user_mode.js")

await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.users.get_user_id",
    "args": {
        "username": "LocalAdministrator"
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "Successfully obtained user id."
    },
    "id": ws.matchRegexp("\\d+"),
})

