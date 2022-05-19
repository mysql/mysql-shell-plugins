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
            "prompt": "type some info: ",
            "type": "text"
        }
    }
])


await ws.sendAndValidate({
    "request": "prompt_reply",
    "request_id": originalRequestId,
    "type": "OK",
    "reply": "inserting some info...",
    "module_session_id": ws.lastModuleSessionId,
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        }, "request_id": originalRequestId,
        "result": {
            "value": "inserting some info..."
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": originalRequestId
    }
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
        "result": 
        {
            'prompt': 'Gimme a password: ',
            'type': 'password'
        }
    }
])

await ws.sendAndValidate({
    "request": "prompt_reply",
    "request_id": passwordRequestId,
    "type": "OK",
    "reply": "somepassword",
    "module_session_id": ws.lastModuleSessionId,
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        }, "request_id": passwordRequestId,
        "result": {
            "value": "somepassword"
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": passwordRequestId
    }
])