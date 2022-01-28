await ws.execute("unit/authenticate/success_single_user_mode.js")

//  list file without sending the path argument
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.list_files",
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "Files in directory"
    },
    "result": ws.ignore,
})


//  list files using an empty path
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.list_files",
    "args": {
        "path": ""
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "Files in directory"
    },
    "result": ws.ignore,
})


//  Check for <home>/.
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.list_files",
    "args": {
        "path": "."
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "Files in directory"
    },
    "result": ws.ignore,
})

//  Check for <home>/..
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.list_files",
    "args": {
        "path": ".."
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "Files in directory"
    },
    "result": ws.ignore,
})

//  invalid path
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.list_files",
    "args": {
        "path": ws.tokens["testTempDir"] + "/some_invalid_path"
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "ERROR",
        "msg": "The supplied path does not exist.",
        "code": 1002,
        "source": "MSG"
    }
})

//  not a directory
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.list_files",
    "args": {
        "path": ws.tokens["testTempDir"] + "/directory1/file1"
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "ERROR",
        "msg": "The supplied path is not a directory.",
        "code": 1004,
        "source": "MSG"
    }
})

//  absolute path
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.list_files",
    "args": {
        "path": ws.tokens["testTempDir"]
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "Files in directory"
    },
    "result": ws.matchList([ws.tokens["testTempDirPosix"] + "/directory1", ws.tokens["testTempDirPosix"] + "/inaccessible"], false)
})
