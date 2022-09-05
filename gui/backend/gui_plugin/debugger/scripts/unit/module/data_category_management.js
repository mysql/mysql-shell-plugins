var lib = ws.tokens.lib
var unit = ws.tokens["unit"]

ws.tokens["current_directory"] = "unit/module"
ws.tokens["current_test_name"] = "data_category_management"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

await ws.execute(unit.module.data_category_management.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
