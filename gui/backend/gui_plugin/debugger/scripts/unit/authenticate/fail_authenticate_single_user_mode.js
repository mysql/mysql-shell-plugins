await ws.send({
    "request": "authenticate",
    "username": "admin1",
    "password": "admin1",
    "request_id": ws.generateRequestId()
})

ws.validateLastResponse({
    "request_state": {
        "type": "ERROR",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
})
