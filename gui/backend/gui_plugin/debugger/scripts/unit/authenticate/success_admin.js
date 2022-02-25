await ws.send({
    "request": "authenticate",
    "username": "admin1",
    "password": "admin1",
    "request_id": ws.generateRequestId()
})

ws.validateLastResponse({
    "request_state": {
        "type": "OK",
        "msg": "User admin1 was successfully authenticated."
    },
    "request_id": ws.lastGeneratedRequestId,
    "active_profile": {
        "id": ws.matchRegexp("\\d+"),
        "user_id": ws.matchRegexp("\\d+"),
        "name": "Default",
        "description": "Default Profile",
        "options": {},
    }
})
