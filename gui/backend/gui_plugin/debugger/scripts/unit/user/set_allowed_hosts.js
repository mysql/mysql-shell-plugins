await ws.execute("unit/authenticate/success_admin.js")

ws.tokens["user_id"] = ws.lastResponse["active_profile"]["user_id"]
ws.tokens["allowed_hosts"] = "localhost"

await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.users.set_allowed_hosts",
    "args": {
        "user_id": ws.tokens["user_id"],
        "allowed_hosts": ws.tokens["allowed_hosts"]
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "Allowed hosts set successfully."
    }
})

