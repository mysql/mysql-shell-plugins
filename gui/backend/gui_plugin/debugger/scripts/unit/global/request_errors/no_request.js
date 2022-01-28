await ws.execute("unit/authenticate/success_admin.js")

await ws.send({
    "command": "gui.users.list_users",
    "args": {}
})

ws.validateLastResponse({
    "request_state": {
        "type": "ERROR",
        "msg": "The message is missing the 'request' attribute.",
        "source": "MSG",
        "code": 1
    }
})
