var lib = ws.tokens.lib
var unit = ws.tokens["unit"]

ws.tokens["current_directory"] = "unit/shell"
ws.tokens["current_test_name"] = "fail_incomplete_input"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.shell.open_session.file)

await ws.execute(unit.shell.fail_incomplete_input.file)


//  Terminate
await ws.execute(lib.shell.close_session.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
