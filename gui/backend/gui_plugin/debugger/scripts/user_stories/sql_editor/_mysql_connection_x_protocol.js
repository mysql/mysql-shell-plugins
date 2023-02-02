var defaults = ws.tokens.defaults
var options = defaults.database_connections.mysql[1].options

ws.log("Executing mysql connection tests for X protocol")

ws.log("Executing query")

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "SELECT * FROM information_schema.schemata;",
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
            "type": "PENDING",
            "msg": ws.ignore
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "columns": [{ "name": "CATALOG_NAME", "type": "STRING" },
            { "name": "SCHEMA_NAME", "type": "STRING" },
            { "name": "DEFAULT_CHARACTER_SET_NAME", "type": "STRING" },
            { "name": "DEFAULT_COLLATION_NAME", "type": "STRING" },
            { "name": "SQL_PATH", "type": "BYTES" }],
            "rows": ws.ignore,
            "total_row_count": ws.matchRegexp("\\d+"),
            "execution_time": ws.ignore,
        }
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
