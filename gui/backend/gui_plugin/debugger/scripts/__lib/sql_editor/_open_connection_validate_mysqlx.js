var lib = ws.tokens.lib
lib.sql_editor.open_connection_validate_mysql.params["default_schema"] = lib.sql_editor.open_connection_validate_mysqlx.params["default_schema"]
ws.execute(lib.sql_editor.open_connection_validate_mysql.file)