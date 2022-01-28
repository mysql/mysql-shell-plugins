await ws.execute("unit/authenticate/success_single_user_mode.js")

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
        "path": ws.ignore
    }
})

ws.tokens['homePath'] = ws.lastResponse['result']['path']

//  list files from the user directory
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
    "result": []
})

ws.tokens['homePathList'] = ws.lastResponse['result']

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
        "path": ws.tokens['homePath']
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
        "path": ws.tokens['homePath']
    }
})


//  validate with an invalid relative path
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "some_directory/sub_directory"
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
        "path": ws.tokens['homePath'] + "/some_directory/sub_directory"
    }
})

//  validate with a valid path
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": ws.tokens['homePathList'][0]
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "result": {
            "path": ws.tokens['homePathList'][0]
        }
    }
])

//  validate with an invalid file
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": "file5"
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
            "path": ws.tokens['homePath'] + "/file5"
        }
    }
])


//  validate and return the resolved path
await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.validate_path",
    "args": {
        "path": ws.tokens['testTempDir'] + "/directory1/../directory1/../directory1/file1"
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "result": {
        "path": ws.tokens["testTempDirPosix"] + "/directory1/file1"
    }
})