await ws.execute("unit/authenticate/success_user.js")

await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.users.list_users",
    "args": {}
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "ERROR",
        "msg": "This user account has no privileges to execute the command gui.users.list_users"
    }
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

