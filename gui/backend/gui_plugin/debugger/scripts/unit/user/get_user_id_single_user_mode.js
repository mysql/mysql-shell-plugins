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
        "type": "PENDING",
        "msg": ""
    },
    "result": ws.matchRegexp("\\d+"),
})

ws.validateLastResponse({
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
})

