await ws.execute("unit/authenticate/success_single_user_mode.js")


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
            "path": "/some_directory"
        }
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
        "result": {
            "path": ws.tokens['testTempDir'] + "/inaccessible"
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
            "msg": "The supplied path does not exist.",
            "code": 1002,
            "source": "MSG"
        },
        "result": {
            "path": ws.tokens["homeDir"] + "/prn"
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
            "msg": "The supplied path does not exist.",
            "code": 1002,
            "source": "MSG"
        },
        "result": {
            "path": ws.tokens["homeDir"] + "/con"
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
            "msg": "The supplied path does not exist.",
            "code": 1002,
            "source": "MSG"
        },
        "result": {
            "path": ws.tokens["homeDir"] + "/con.txt"
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
            "msg": "The supplied path does not exist.",
            "code": 1002,
            "source": "MSG"
        },
        "result": {
            "path": ws.tokens["homeDir"] + "/c:\\windows\\con.txt"
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
            "msg": "The supplied path does not exist.",
            "code": 1002,
            "source": "MSG"
        },
        "result": {
            "path": ws.tokens["homeDir"] + "/con,txt"
        }
    }
])
