var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_directory"] = "unit/module"
ws.tokens["current_test_name"] = "db_notebook_code_history"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

await ws.execute(user_stories.sql_editor.db_notebook_code_history.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
