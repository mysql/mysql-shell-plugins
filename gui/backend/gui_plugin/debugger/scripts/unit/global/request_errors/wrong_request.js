await ws.execute("unit/authenticate/success_admin.js")

await ws.send("gui.users.list_users")

ws.validateLastResponse({
    "request_state": {
        "type": "ERROR",
        "msg": "Unable to decode the JSON message.",
        "source": "MSG",
        "code": 1
    }
})

