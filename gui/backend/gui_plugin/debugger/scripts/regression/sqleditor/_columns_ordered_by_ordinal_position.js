var responses = ws.tokens["responses"]
var regression = ws.tokens["regression"]
var database_type = regression.sqleditor.columns_ordered_by_ordinal_position.params["current_database_type"]
var params = regression.sqleditor.columns_ordered_by_ordinal_position.params[database_type]
var fullTableName = params["schema_name"] + "." + params["table_name"]

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "DROP TABLE IF EXISTS " + fullTableName,
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
    }
}, [
    responses.pending.executionStarted,
    responses.ok.sqlZeroRows
])


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "CREATE TABLE " + fullTableName + " (aaaa INTEGER, cccc INTEGER, bbbb INTEGER);",
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
    }
}, [
    responses.pending.executionStarted,
    responses.ok.sqlZeroRows
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Column",
        "schema_name": params["schema_name"],
        "table_name": params["table_name"]
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ["aaaa", "cccc", "bbbb"]
    }
])


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "DROP TABLE " + fullTableName + ";",
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
    }
}, [
    responses.pending.executionStarted,
    responses.ok.sqlZeroRows
])