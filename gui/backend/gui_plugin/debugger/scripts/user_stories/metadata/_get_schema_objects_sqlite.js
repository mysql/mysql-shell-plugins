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
    Object.assign(Object(), responses.ok.default, {
        "result": ws.ignore
    })
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
    Object.assign(Object(), responses.ok.default, {
        "result": ws.ignore
    })
])
