var lib = ws.tokens.lib
var unit = ws.tokens["unit"]

ws.tokens["current_directory"] = "unit/sql_editor"
ws.tokens["current_test_name"] = "auto_commit"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.sql_editor.open_session.file)

//  Run specific tests
lib.sql_editor.for_each_connection.params = {
    "mysql": unit.sql_editor.auto_commit_mysql,
    "mysqlx": unit.sql_editor.auto_commit_mysql,
    "sqlite": unit.sql_editor.auto_commit_sqlite,
    "initialization": lib.noop
}
await ws.execute(lib.sql_editor.for_each_connection.file)


//  Terminate
await ws.execute(lib.sql_editor.close_session.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
