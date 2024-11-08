var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_test_name"] = "execute_with_options"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.sql_editor.open_session.file)

//  Test for MySQL
lib.sql_editor.with_new_connection.params = {
    "database_settings": lib.connection.add_mysql_root,
    "test": user_stories.sql_editor.execute_with_options,
    "validation": lib.sql_editor.open_connection_validate_mysql,
    "initialization": lib.noop
}

await ws.execute(lib.sql_editor.with_new_connection.file)

//  Test for MySQL X
lib.sql_editor.with_new_connection.params = {
    "database_settings": lib.connection.add_mysqlx,
    "test": user_stories.sql_editor.execute_with_options,
    "validation": lib.sql_editor.open_connection_validate_mysqlx,
    "initialization": lib.noop
}
await ws.execute(lib.sql_editor.with_new_connection.file)

//  Terminate
await ws.execute(lib.sql_editor.close_session.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")

