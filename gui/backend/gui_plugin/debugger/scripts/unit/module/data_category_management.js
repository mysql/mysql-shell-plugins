ws.execute("__lib/_init.js")
var lib = ws.tokens.lib
var unit = ws.tokens["unit"]

ws.tokens["current_directory"] = "unit/module"
ws.tokens["current_test_name"] = "data_category_management"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.login.admin.file)
// await ws.execute(lib.shell.open_session.file)

await ws.execute(unit.module.data_category_management.file)


//  Terminate
// await ws.execute(lib.shell.close_session.file)
await ws.execute(lib.login.logout.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
