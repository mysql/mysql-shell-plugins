responses = ws.tokens["responses"]

originalRequestId = ws.generateRequestId()

await ws.sendAndValidate({
    "request": "execute",
    "request_id": originalRequestId,
    "command": "gui.shell.execute",
    "args": {
        "command": "shell.prompt('type some info: ')",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "prompt": "type some info: "
        }
    }
])


await ws.sendAndValidate({
    "request": "prompt_reply",
    "request_id": originalRequestId,
    "type": "CANCEL",
    "reply": "",
    "module_session_id": ws.lastModuleSessionId,
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "error": "Traceback (most recent call last):\n  File \"<string>\", line 1, in <module>\nRuntimeError: Shell.prompt: Cancelled\n\n"
        }
    },
    responses.ok.default
])

passwordRequestId = ws.generateRequestId()

await ws.sendAndValidate({
    "request": "execute",
    "request_id": passwordRequestId,
    "command": "gui.shell.execute",
    "args": {
        "command": "shell.prompt('Gimme a password: ', {'type':'password'})",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "password": "Gimme a password: "
        }
    }
])

await ws.sendAndValidate({
    "request": "prompt_reply",
    "request_id": passwordRequestId,
    "type": "CANCEL",
    "reply": "",
    "module_session_id": ws.lastModuleSessionId,
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "error": "Traceback (most recent call last):\n  File \"<string>\", line 1, in <module>\nRuntimeError: Shell.prompt: Cancelled\n\n"
        }
    },
    responses.ok.default
])