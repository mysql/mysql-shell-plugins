var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_test_name"] = "mysql_connection_with_password"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.sqleditor.open_session.file)
await ws.execute(lib.sqleditor.create_test_sessions.file)


ws.execute(user_stories.sql_editor.mysql_connection_without_password_user2.file)


//  Terminate
await ws.execute(lib.sqleditor.close_session.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")

