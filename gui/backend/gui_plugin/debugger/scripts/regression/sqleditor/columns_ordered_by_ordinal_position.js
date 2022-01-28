ws.execute("__lib/_init.js")
var lib = ws.tokens.lib
var regression = ws.tokens["regression"]

ws.tokens["current_directory"] = "regression/sqleditor"
ws.tokens["current_test_name"] = "columns_ordered_by_ordinal_position"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.login.admin.file)
await ws.execute(lib.sqleditor.open_session.file)

// Initialize databases
lib.sqleditor.with_new_connection.params = {
    "database_settings": lib.connection.add_mysql_root,
    "test": lib.init_mysql,
    "validation": lib.sqleditor.open_connection_validate_mysql,
    "initialization": lib.noop
}
await ws.execute(lib.sqleditor.with_new_connection.file)


//  Prepare the params for when the test script is running
regression.sqleditor.columns_ordered_by_ordinal_position.params = {
    "mysql": {
        "schema_name": "tests",
        "table_name": ws.tokens["current_test_name"]
    },
    "mysqlx": {
        "schema_name": "tests",
        "table_name": ws.tokens["current_test_name"]
    },
    "sqlite": {
        "schema_name": "main",
        "table_name": ws.tokens["current_test_name"]
    },
    "current_database_type": ""
}

//  Run the tests on all database types
lib.sqleditor.for_each_connection.params = {
    "mysql": regression.sqleditor.columns_ordered_by_ordinal_position,
    "mysqlx": regression.sqleditor.columns_ordered_by_ordinal_position,
    "sqlite": regression.sqleditor.columns_ordered_by_ordinal_position,
    "initialization": lib.noop
}
await ws.execute(lib.sqleditor.for_each_connection.file)


//  Terminate
await ws.execute(lib.sqleditor.close_session.file)
await ws.execute(lib.login.logout.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
