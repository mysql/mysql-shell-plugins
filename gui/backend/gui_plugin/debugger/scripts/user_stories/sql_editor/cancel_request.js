var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_test_name"] = "cancel_request"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.sqleditor.open_session.file)

//  Test for MySQL
lib.sqleditor.with_new_connection.params = {
    "database_settings": lib.connection.add_mysql_root,
    "test": user_stories.sql_editor.cancel_request,
    "validation": lib.sqleditor.open_connection_validate_mysql,
    "initialization": lib.noop
}

await ws.execute(lib.sqleditor.with_new_connection.file)


//  Terminate
await ws.execute(lib.sqleditor.close_session.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")

