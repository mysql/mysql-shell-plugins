var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_directory"] = "user_stories/shell"
ws.tokens["current_test_name"] = "python_command_success"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.shell.open_session.file)

await ws.execute(user_stories.shell.python_command_success.file)


//  Terminate
await ws.execute(lib.shell.close_session.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
