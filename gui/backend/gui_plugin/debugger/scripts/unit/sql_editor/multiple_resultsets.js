var lib = ws.tokens.lib
var unit = ws.tokens["unit"]

ws.tokens["current_directory"] = "unit/sql_editor"
ws.tokens["current_test_name"] = "multiple_resultsets"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")


//  Initialize
await ws.execute(lib.sql_editor.open_session.file)

// //  Test for MySQL
// lib.sql_editor.with_new_connection.params = {
//     "database_settings": lib.connection.add_mysql_root,
//     "test": unit.sql_editor.multiple_resultsets,
//     "validation": lib.sql_editor.open_connection_validate_mysql
// }
// await ws.execute(lib.sql_editor.with_new_connection.file)

//  Test for MySQL X
lib.sql_editor.with_new_connection.params = {
    "database_settings": lib.connection.add_mysqlx,
    "test": unit.sql_editor.multiple_resultsets,
    "validation": lib.sql_editor.open_connection_validate_mysqlx,
    "initialization": lib.noop
}
await ws.execute(lib.sql_editor.with_new_connection.file)

//  Terminate
await ws.execute(lib.sql_editor.close_session.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
