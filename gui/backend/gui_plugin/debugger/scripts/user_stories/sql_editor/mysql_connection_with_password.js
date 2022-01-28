ws.execute("__lib/_init.js")
var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_test_name"] = "mysql_connection_with_password"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.login.admin.file)
await ws.execute(lib.sqleditor.open_session.file)
await ws.execute(lib.sqleditor.create_test_sessions.file)

// //  Test for MySQL
// lib.sqleditor.with_new_connection.params = {
//     "database_settings": lib.connection.add_mysql_root,
//     "test": user_stories.sql_editor.mysql_connection_with_password,
//     "validation": lib.sqleditor.open_connection_validate_mysql
// }

ws.execute(user_stories.sql_editor.mysql_connection_with_password_user1.file)
ws.execute(user_stories.sql_editor.mysql_connection_with_password_user2.file)

// // Test user1
// lib.sqleditor.with_new_connection.params = {
//     "database_settings": lib.connection.add_mysql_user1,
//     "test": user_stories.sql_editor.mysql_connection_with_password_user1,
//     "validation": lib.sqleditor.open_connection_validate_mysql
// }

// // Test user2
// lib.sqleditor.with_new_connection.params = {
//     "database_settings": lib.connection.add_mysql_user2,
//     "test": user_stories.sql_editor.mysql_connection_with_password_user2,
//     "validation": lib.sqleditor.open_connection_validate_mysql
// }

// await ws.execute(lib.sqleditor.with_new_connection.file)


//  Terminate
await ws.execute(lib.sqleditor.close_session.file)
await ws.execute(lib.login.logout.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")

