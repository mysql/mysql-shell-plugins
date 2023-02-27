await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.get_backend_information",
    "args": {}
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "PENDING",
        "msg": ""
    },
    "result": {
        "major": ws.matchRegexp("\\d+"),
        "minor": ws.matchRegexp("\\d+"),
        "patch": ws.matchRegexp("\\d+"),
        "platform": ws.ignore,
        "architecture": ws.ignore,
        "server_major": ws.matchRegexp("\\d+"),
        "server_minor": ws.matchRegexp("\\d+"),
        "server_patch": ws.matchRegexp("\\d+"),
        "server_distribution": ws.ignore
    }
})

ws.validateLastResponse({
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
})
