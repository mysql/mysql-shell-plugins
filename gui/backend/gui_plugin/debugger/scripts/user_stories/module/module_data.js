var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_directory"] = "unit/module"
ws.tokens["current_test_name"] = "module_data"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

// Create module
await ws.execute(user_stories.module.module_data_create.file)

// Fail to share and delete
ws.execute("__lib/login/_logout.js")
lib.login.login.params = {
    "user": "success_admin2"
}
await ws.execute(lib.login.login.file)

await ws.execute(user_stories.module.module_data_fail_share_delete.file)

// Delete module
ws.execute("__lib/login/_logout.js")
lib.login.login.params = {
    "user": "success_admin"
}
await ws.execute(lib.login.login.file)
await ws.execute(user_stories.module.module_data_delete.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
