await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.users.list_users",
    "args": {}
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "PENDING",
        "msg": ws.ignore
    },
    "result": [
        { "name": "admin1" },
        { "name": "admin2" },
        { "name": "power1" },
        { "name": "power2" },
        { "name": "user1" },
        { "name": "user2" },
        { "name": "user3" }
    ]
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "done": true
})
