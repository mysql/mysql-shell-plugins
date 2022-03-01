ws.log("Creating test user variable")

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "SET @TEST=1;",
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
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "Full result set consisting of 0 rows transferred."
        }
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "User Variable",
        "name": "TEST"
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
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {"name": "TEST"}
    }
])