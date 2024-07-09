var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_directory"] = "unit/sql_editor"
ws.tokens["current_test_name"] = "get_table_objects_mysql"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.sql_editor.open_session.file)

//  Test for MySQL
lib.sql_editor.with_new_connection.params = {
    "database_settings": lib.connection.add_mysql_root,
    "test": user_stories.metadata.get_table_objects_mysql,
    "validation": lib.sql_editor.open_connection_validate_mysql,
    "initialization": lib.noop
}

await ws.execute(lib.sql_editor.with_new_connection.file)


//  Terminate
await ws.execute(lib.sql_editor.close_session.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
