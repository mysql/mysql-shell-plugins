ws.execute("__lib/_init.js")
var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_directory"] = "user_stories/shell"
ws.tokens["current_test_name"] = "new_session"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.login.admin.file)
await ws.execute(lib.sqleditor.create_test_sessions.file)

await ws.execute(user_stories.shell.new_session_with_connection_and_command.file)

//  Terminate
await ws.execute(lib.login.logout.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
