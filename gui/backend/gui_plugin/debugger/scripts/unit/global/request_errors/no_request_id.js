await ws.execute("unit/authenticate/success_admin.js")

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.users.list_users",
    "args": {}
}, [
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The message is missing the 'request_id' attribute.",
            "source": "MSG",
            "code": 1
        }
    }
])
