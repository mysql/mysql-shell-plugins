await ws.execute("unit/authenticate/success_admin.js")

await ws.send({
    "request": "authenticate",
    "username": "admin1",
    "password": "admin1",
    "request_id": ws.generateRequestId()
})

ws.validateLastResponse({
    "request_state": {
        "type": "ERROR",
        "msg": "This session was already authenticated."
    },
    "request_id": ws.lastGeneratedRequestId
})

ws.sendAndValidate({
    "request": "logout",
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": "User successfully logged out."
    },
    "request_id": ws.lastGeneratedRequestId}])

