var lib = ws.tokens.lib
var regression = ws.tokens["regression"]

ws.tokens["current_directory"] = "regression/sql_editor"
ws.tokens["current_test_name"] = "columns_ordered_by_ordinal_position"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.sql_editor.open_session.file)

// Initialize databases
lib.sql_editor.with_new_connection.params = {
    "database_settings": lib.connection.add_mysql_root,
    "test": lib.init_mysql,
    "validation": lib.sql_editor.open_connection_validate_mysql,
    "initialization": lib.noop
}
await ws.execute(lib.sql_editor.with_new_connection.file)


//  Prepare the params for when the test script is running
regression.sql_editor.columns_ordered_by_ordinal_position.params = {
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
lib.sql_editor.for_each_connection.params = {
    "mysql": regression.sql_editor.columns_ordered_by_ordinal_position,
    "mysqlx": regression.sql_editor.columns_ordered_by_ordinal_position,
    "sqlite": regression.sql_editor.columns_ordered_by_ordinal_position,
    "initialization": lib.noop
}
await ws.execute(lib.sql_editor.for_each_connection.file)


//  Terminate
await ws.execute(lib.sql_editor.close_session.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
