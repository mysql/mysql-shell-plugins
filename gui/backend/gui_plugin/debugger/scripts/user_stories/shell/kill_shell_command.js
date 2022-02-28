await ws.execute("unit/authenticate/success_admin.js")

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
            "type": "PENDING",
            "msg": "New Shell session initiated..."
        },
        "module_session_id": ws.lastModuleSessionId,
        "result": {}
    },
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "New Shell Interactive session created successfully."
        },
    }
])

ws.tokens["task1_req_id"] = ws.generateRequestId()

await ws.send({
    "request": "execute",
    "request_id": ws.tokens["task1_req_id"],
    "command": "gui.shell.execute",
    "args": {
        "command": "import time; time.sleep(2)",
        "module_session_id": ws.lastModuleSessionId,
    }
})

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.kill_task",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, ws.matchList([
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": "Command killed"
    }
], 0))

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.kill_task",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, ws.matchList([
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": "Nothing to kill"
    }
], 0))

