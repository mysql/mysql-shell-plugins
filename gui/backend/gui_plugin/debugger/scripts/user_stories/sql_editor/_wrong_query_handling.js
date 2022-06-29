ws.log("Executing query")

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "select UUID_TO_BIN('1');",
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
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
            "type": "ERROR",
            "msg": "MySQL Error (1411): ClassicResult.fetch_one: Incorrect string value: '1' for function uuid_to_bin",
        }
    }
])
