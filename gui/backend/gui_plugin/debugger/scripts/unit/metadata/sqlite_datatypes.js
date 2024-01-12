var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_directory"] = "user_stories/metadata"
ws.tokens["current_test_name"] = "sqlite_datatypes"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
var settings = lib.connection.add_sqlite
lib.dbsession.init_db.params = {
    "database_settings": settings,
    "validation": lib.dbsession.open_connection_validate_sqlite,
    "init": lib.init_sqlite
}
await ws.execute(lib.dbsession.init_db.file)

// Open DB session
lib.dbsession.open_db_session.params = {
    "database_settings": settings,
    "connection_id": settings.result["connection_id"],
    "validation": lib.dbsession.open_connection_validate_sqlite
}
await ws.execute(lib.dbsession.open_db_session.file)

requests = ws.tokens['requests']
responses = ws.tokens['responses']

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "SELECT * FROM `test_table`",
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
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "rows": [
                [1, "Sample text", 42, 3.14, 123.456, "b'\\x01\\x02\\x03\\x04'", 1, "2024-01-11", "12:34:56", "2024-01-11 12:34:56"]
            ],
            "columns": [
                { "name": "id", "type": "int" },
                { "name": "text_column", "type": "str" },
                { "name": "integer_column", "type": "int" },
                { "name": "real_column", "type": "float" },
                { "name": "numeric_column", "type": "float" },
                { "name": "blob_column", "type": "bytes" },
                { "name": "boolean_column", "type": "int" },
                { "name": "date_column", "type": "str" },
                { "name": "time_column", "type": "str" },
                { "name": "datetime_column", "type": "str" }
            ],
            "total_row_count": 1,
            "execution_time": ws.ignore,
            "rows_affected": 0
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


// Remove connection
lib.connection.remove.params = {
    "profile_id": settings.result["profile_id"],
    "connection_id": settings.result["connection_id"]
}

await ws.execute(lib.connection.remove.file)

//  Terminate
await ws.execute(lib.dbsession.close_db_session.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
