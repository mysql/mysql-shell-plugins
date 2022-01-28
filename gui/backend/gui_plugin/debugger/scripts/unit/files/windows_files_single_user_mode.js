await ws.execute("unit/authenticate/success_single_user_mode.js")

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
            "type": "ERROR",
            "msg": "The supplied path does not exist.",
            "code": 1002,
            "source": "MSG"
        }, "result": {
            "path": ws.tokens["homeDir"] + "/inaccessible"
        }
    }
])


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
            "type": "OK",
            "msg": ""
        },
        "result": {
            "path": ws.ignore
        }
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
        "result": {
            "path": ws.matchRegexp("[C|c]:/some_directory")
        }
    }
])


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
            "type": "ERROR",
            "msg": "The supplied path does not exist.",
            "code": 1002,
            "source": "MSG"
        }
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
            "msg": "Reserved paths are not allowed.",
            "code": 1009,
            "source": "MSG"
        },
        "result": {
            "path": "prn"
        }
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
            "msg": "Reserved paths are not allowed.",
            "code": 1009,
            "source": "MSG"
        },
        "result": {
            "path": "con"
        }
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
            "msg": "Reserved paths are not allowed.",
            "code": 1009,
            "source": "MSG"
        },
        "result": {
            "path": "con.txt"
        }
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
            "msg": "Reserved paths are not allowed.",
            "code": 1009,
            "source": "MSG"
        },
        "result": {
            "path": "c:\\windows\\con.txt"
        }
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
            "msg": "Reserved paths are not allowed.",
            "code": 1009,
            "source": "MSG"
        },
        "result": {
            "path": "con,txt"
        }
    }
])
