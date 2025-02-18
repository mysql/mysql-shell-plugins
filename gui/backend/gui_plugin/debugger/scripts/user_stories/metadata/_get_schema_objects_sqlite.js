requests = ws.tokens['requests']
responses = ws.tokens['responses']

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Table",
        "schema_name": "main"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.ignore
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "View",
        "schema_name": "main"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.ignore
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])

