await ws.execute("unit/authenticate/success_admin.js")

//  validate empty path
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": ""
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "result": {
        "path": "."
    }
})

//  validate '.' path
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "."
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "result": {
        "path": "."
    }
})

//  validate './' path
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "./"
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "result": {
        "path": "."
    }
})


//  validate '..' path
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": ".."
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "ERROR",
        "msg": "Trying to access outside the user directory.",
        "code": 1001,
        "source": "MSG"
    },
    "result": {
        "path": ".."
    }
})

//  validate with absolute path
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "/some_directory"
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "ERROR",
        "msg": "Absolute paths are not allowed.",
        "code": 1000,
        "source": "MSG"
    },
    "result": {
        "path": "/some_directory"
    }
})

//  validate with an invalid path
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "some_directory/sub_directory"
    },
    "result": "some_directory/sub_directory"
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "ERROR",
        "msg": "The supplied path does not exist.",
        "code": 1002,
        "source": "MSG"
    },
    "result": {
        "path": "some_directory/sub_directory"
    }
})

//  validate with an valid subdirectory
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "directory1/subdirectory1"
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "result": {
        "path": "directory1/subdirectory1"
    }
})

//  validate with an valid file
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "directory1/subdirectory1/file1"
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "result": {
        "path": "directory1/subdirectory1/file1"
    }
})

//  validate with an invalid file
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "directory1/subdirectory1/file5"
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "ERROR",
        "msg": "The supplied path does not exist.",
        "code": 1002,
        "source": "MSG"
    },
    "result": {
        "path": "directory1/subdirectory1/file5"
    }
})


//  validate and return the resolved path
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "directory1/../directory1/subdirectory1/../../directory1/subdirectory1/file1"
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "result": {
        "path": "directory1/subdirectory1/file1"
    }
})