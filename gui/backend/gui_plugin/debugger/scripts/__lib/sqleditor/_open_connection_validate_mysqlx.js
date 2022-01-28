var lib = ws.tokens.lib
lib.sqleditor.open_connection_validate_mysql.params["default_schema"] = lib.sqleditor.open_connection_validate_mysqlx.params["default_schema"]
ws.execute(lib.sqleditor.open_connection_validate_mysql.file)