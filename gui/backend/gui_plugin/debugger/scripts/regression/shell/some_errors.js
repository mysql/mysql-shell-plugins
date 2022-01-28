ws.execute("__lib/_init.js")
var lib = ws.tokens.lib
var regression = ws.tokens.regression

ws.tokens["current_directory"] = "regression/shell"
ws.tokens["current_test_name"] = "some_errors"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.login.admin.file)
await ws.execute(lib.shell.open_session.file)
await ws.execute(lib.shell.connect_database_default.file)

await ws.execute(regression.shell.some_errors.file)


//  Terminate
await ws.execute(lib.shell.close_session.file)
await ws.execute(lib.login.logout.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
