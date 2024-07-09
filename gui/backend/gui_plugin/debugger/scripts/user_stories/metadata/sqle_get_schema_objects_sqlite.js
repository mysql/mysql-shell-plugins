var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_directory"] = "unit/sql_editor"
ws.tokens["current_test_name"] = "get_schema_objects_sqlite"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.sql_editor.open_session.file)

//  Test for Sqlite
lib.sql_editor.with_new_connection.params = {
    "database_settings": lib.connection.add_sqlite,
    "test": user_stories.metadata.get_schema_objects_sqlite,
    "validation": lib.sql_editor.open_connection_validate_sqlite,
    "initialization": lib.init_sqlite
}

await ws.execute(lib.sql_editor.with_new_connection.file)


//  Terminate
await ws.execute(lib.sql_editor.close_session.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
