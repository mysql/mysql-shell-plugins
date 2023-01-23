//  validate '..' path
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": ".."
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "ERROR",
            "msg": "No permissions to write in the supplied path.",
            "code": 1005,
            "source": "MSG"
        },
    }
])

//  validate with an invalid absolute path
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "/some_directory"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "ERROR",
            "msg": "The supplied path does not exist.",
            "code": 1002,
            "source": "MSG"
        },
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": ws.tokens['testTempDir'] + "/inaccessible"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "ERROR",
            "msg": "No permissions to read from the supplied path.",
            "code": 1005,
            "source": "MSG"
        },
    }
])

//  validate with "prn"
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "prn"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "ERROR",
            "msg": "The supplied path does not exist.",
            "code": 1002,
            "source": "MSG"
        },
    }
])

//  validate with "con"
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "con"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "ERROR",
            "msg": "The supplied path does not exist.",
            "code": 1002,
            "source": "MSG"
        },
    }
])


//  validate with "con.txt"
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "con.txt"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "ERROR",
            "msg": "The supplied path does not exist.",
            "code": 1002,
            "source": "MSG"
        },
    }
])

//  validate with "c:\\windows\\con.txt"
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "c:\\windows\\con.txt"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "ERROR",
            "msg": "The supplied path does not exist.",
            "code": 1002,
            "source": "MSG"
        },
    }
])

//  validate with "con,txt"
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "con,txt"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "ERROR",
            "msg": "The supplied path does not exist.",
            "code": 1002,
            "source": "MSG"
        },
    }
])
