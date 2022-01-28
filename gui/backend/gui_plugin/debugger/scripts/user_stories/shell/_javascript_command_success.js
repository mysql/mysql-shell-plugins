var responses = ws.tokens["responses"]

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\js",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "info": "Switching to JavaScript mode...\n"
        }
    },
    responses.ok.default
])


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "let myvar=[1,2,3]; myvar;",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "rows": [1, 2, 3]
        }
    },
    responses.ok.default
])

await ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request": "execute",
    "command": "gui.shell.execute",
    "args": {
        "command": "45+3",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "value": 48
        }
    },
    responses.ok.default
])

