await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.users.set_current_profile",
    "args": {
        "profile_id": 1
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "Profile set successfully."
    }
})

ws.tokens["active_profile"]["id"] = 1
