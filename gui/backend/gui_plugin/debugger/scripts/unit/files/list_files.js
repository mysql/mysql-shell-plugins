await ws.execute("unit/authenticate/success_admin.js")

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

//  list files using "."
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

//  list files using "./"
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.list_files",
    "args": {
        "path": "./"
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


//  Check for <mysqlsh_home>/.
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

//  Check for <mysqlsh_home>/..
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
        "type": "ERROR",
        "msg": "Trying to access outside the user directory.",
        "code": 1001,
        "source": "MSG"
    }
})

//  Check inside directory
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.list_files",
    "args": {
        "path": "directory1"
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "Files in directory"
    },
    "result": ["directory1/subdirectory1"],
})

//  Check inside subdirectory
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.list_files",
    "args": {
        "path": "directory1/subdirectory1"
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "Files in directory"
    },
    "result": ws.matchList(["directory1/subdirectory1/file1", "directory1/subdirectory1/file2"], 0),
})


//  Resolve directories
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.list_files",
    "args": {
        "path": "directory1/subdirectory1/../../directory1/subdirectory1/../../directory1/subdirectory1"
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "Files in directory"
    },
    "result": ws.matchList(["directory1/subdirectory1/file1", "directory1/subdirectory1/file2"], 0),
})

//  invalid path
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.list_files",
    "args": {
        "path": "some_invalid_path"
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
        "path": "some_file"
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
        "path": "/"
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "ERROR",
        "msg": "Absolute paths are not allowed.",
        "code": 1000,
        "source": "MSG"
    }
})
