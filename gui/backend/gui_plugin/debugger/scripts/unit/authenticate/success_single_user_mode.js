await ws.send({
    "request": "authenticate",
    "username": "LocalAdministrator",
    "request_id": ws.generateRequestId()
})

ws.validateLastResponse({
    "request_state": {
        "type": "OK",
        "msg": "User LocalAdministrator was successfully authenticated."
    },
    "request_id": ws.lastGeneratedRequestId,
    "active_profile": {
        "id": ws.matchRegexp("\\d+"),
        "user_id": ws.matchRegexp("\\d+"),
        "name": "Default",
        "description": "Default Profile",
        "options": {}
    }
})
