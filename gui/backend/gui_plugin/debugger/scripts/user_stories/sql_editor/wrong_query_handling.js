var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_test_name"] = "wrong_query_handling"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.sql_editor.open_session.file)

//  Test for MySQL
lib.sql_editor.with_new_connection.params = {
    "database_settings": lib.connection.add_mysql_root,
    "test": user_stories.sql_editor.wrong_query_handling,
    "validation": lib.sql_editor.open_connection_validate_mysql,
    "initialization": lib.noop
}

await ws.execute(lib.sql_editor.with_new_connection.file)


//  Terminate
await ws.execute(lib.sql_editor.close_session.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")

