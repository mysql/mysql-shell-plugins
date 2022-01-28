await ws.execute("unit/authenticate/success_admin.js")


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.list_files",
    "args": {
        "path": "inaccessible"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "Files in directory"
        },
        "result": []
    }
])


// validate with an write only path
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "inaccessible"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "result": {
            "path": "inaccessible"
        }
    }
])
