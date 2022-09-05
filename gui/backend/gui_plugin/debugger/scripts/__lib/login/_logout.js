
ws.log("Logging out")

await ws.send({
    "request": "logout",
    "request_id": ws.generateRequestId()
})

ws.validateLastResponse({
    "request_state": {
        "type": "OK",
        "msg": "User successfully logged out."
    },
    "request_id": ws.lastGeneratedRequestId
})

