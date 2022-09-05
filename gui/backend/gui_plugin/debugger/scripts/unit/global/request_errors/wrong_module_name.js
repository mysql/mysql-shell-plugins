await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "dui.users.list_users",
    "args": {}
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "ERROR",
        "msg": "The 'dui' global object does not exist"
    }
})
