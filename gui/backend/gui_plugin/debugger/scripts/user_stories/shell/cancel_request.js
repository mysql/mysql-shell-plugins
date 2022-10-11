await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.start_session",
    "args": {}
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "New Shell Interactive session created successfully."
        },
        "result": {
            "module_session_id": ws.lastModuleSessionId,
            "last_prompt": {},
        }
    }
])

ws.tokens["task1_req_id"] = ws.generateRequestId()
ws.tokens["task2_req_id"] = ws.generateRequestId()

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.tokens["task1_req_id"],
    "command": "gui.shell.execute",
    "args": {
        "command": "import time; time.sleep(5)",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_id": ws.tokens["task1_req_id"],
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.tokens["task2_req_id"],
    "command": "gui.shell.execute",
    "args": {
        "command": "import time; time.sleep(5)",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_id": ws.tokens["task2_req_id"],
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    }
])

await ws.sendAndValidate({
    "request": "cancel",
    "request_id": ws.tokens["task2_req_id"]
}, ws.matchList([
    {
        "request_state": {
            "type": "OK",
            "msg": "Request cancelled."
        },
        "request_id": ws.tokens["task2_req_id"],
    },
    {
        'request_state': {
            'type': 'OK',
            'msg': ''
        },
        'request_id': ws.tokens["task1_req_id"]
    },
    {
        "request_state": {
            "type": "CANCELLED",
            "msg": ""
        },
        "request_id": ws.tokens["task2_req_id"],
    }
], 0))

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.close_session",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ""
        }
    }
])
