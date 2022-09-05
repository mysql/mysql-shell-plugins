var lib = ws.tokens.lib
var unit = ws.tokens["unit"]

ws.tokens["current_directory"] = "unit/sqleditor"
ws.tokens["current_test_name"] = "auto_commit"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.sqleditor.open_session.file)

//  Run specific tests
lib.sqleditor.for_each_connection.params = {
    "mysql": unit.sqleditor.auto_commit_mysql,
    "mysqlx": unit.sqleditor.auto_commit_mysql,
    "sqlite": unit.sqleditor.auto_commit_sqlite,
    "initialization": lib.noop
}
await ws.execute(lib.sqleditor.for_each_connection.file)


//  Terminate
await ws.execute(lib.sqleditor.close_session.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
