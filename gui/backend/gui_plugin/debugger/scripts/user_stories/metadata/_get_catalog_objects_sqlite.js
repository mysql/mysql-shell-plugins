requests = ws.tokens['requests']
responses = ws.tokens['responses']
ws.tokens["types"] = [{"name": "Schema",  "type": "CATALOG_OBJECT"},
                      {"name": "Table",   "type": "SCHEMA_OBJECT"},
                      {"name": "View",    "type": "SCHEMA_OBJECT"},
                      {"name": "Trigger", "type": "TABLE_OBJECT"},
                      {"name": "Index",   "type": "TABLE_OBJECT"}]

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_objects_types",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": ws.tokens["types"]
    })
])


//  Catalog objects
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_catalog_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Schema"
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
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Schema",
        "name": "main"
    }
}, [
    responses.pending.executionStarted,
    Object.assign(Object(), responses.ok.default, {
        "result": {"name": "main"}
    })
])
