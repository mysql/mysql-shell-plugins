ws.execute("__lib/_init.js")
var lib = ws.tokens.lib
var unit = ws.tokens["unit"]

ws.tokens["current_directory"] = "unit/sqleditor"
ws.tokens["current_test_name"] = "multiple_resultsets"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")


//  Initialize
await ws.execute(lib.login.admin.file)
await ws.execute(lib.sqleditor.open_session.file)

// //  Test for MySQL
// lib.sqleditor.with_new_connection.params = {
//     "database_settings": lib.connection.add_mysql_root,
//     "test": unit.sqleditor.multiple_resultsets,
//     "validation": lib.sqleditor.open_connection_validate_mysql
// }
// await ws.execute(lib.sqleditor.with_new_connection.file)

//  Test for MySQL X
lib.sqleditor.with_new_connection.params = {
    "database_settings": lib.connection.add_mysqlx,
    "test": unit.sqleditor.multiple_resultsets,
    "validation": lib.sqleditor.open_connection_validate_mysqlx,
    "initialization": lib.noop
}
await ws.execute(lib.sqleditor.with_new_connection.file)

//  Terminate
await ws.execute(lib.sqleditor.close_session.file)
await ws.execute(lib.login.logout.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
