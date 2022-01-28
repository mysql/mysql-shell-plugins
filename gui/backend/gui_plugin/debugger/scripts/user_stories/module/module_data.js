ws.execute("__lib/_init.js")
var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_directory"] = "unit/module"
ws.tokens["current_test_name"] = "module_data"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

// Create module
await ws.execute(user_stories.module.module_data_create.file)
ws.reset()

// Fail to share and delete
await ws.execute(user_stories.module.module_data_fail_share_delete.file)
ws.reset()

// Delete module
await ws.execute(user_stories.module.module_data_delete.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
