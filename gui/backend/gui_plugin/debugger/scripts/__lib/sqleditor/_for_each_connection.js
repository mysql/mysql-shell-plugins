//
//  Run test scripts for all database types. The database options to use are
//  default ones originated on the specific database scripts (add_mysql_root,
//  add_mysqlx and add_sqlite).
//  This also allows to run different scripts for each type. Before running the
//  test script, the 'current_database_type' parameter is set, so the test scrip
//  knows which type is being tested.
//  params:
//      mysql: the MySQL entry to be tested
//      mysqlx: the MySQL X entry to be tested
//      sqlite: the Sqlite entry to be tested
//
var lib = ws.tokens.lib
var _this = lib.sqleditor.for_each_connection

print("\n---FOR EACH CONNECTION START---\n")
//  MySQL
print("\n---FOR EACH CONNECTION : MYSQL START---\n")
var subscript = _this.params["mysql"]
subscript.params["current_database_type"] = "mysql"
lib.sqleditor.with_new_connection.params = {
    "database_settings": lib.connection.add_mysql_root,
    "test": subscript,
    "validation": lib.sqleditor.open_connection_validate_mysql,
    "initialization": lib.noop
}
await ws.execute(lib.sqleditor.with_new_connection.file)

//  MySQL X
print("\n---FOR EACH CONNECTION : MYSQLX START---\n")
subscript = _this.params["mysqlx"]
subscript.params["current_database_type"] = "mysqlx"
lib.sqleditor.with_new_connection.params = {
    "database_settings": lib.connection.add_mysqlx,
    "test": subscript,
    "validation": lib.sqleditor.open_connection_validate_mysqlx,
    "initialization": lib.noop
}
await ws.execute(lib.sqleditor.with_new_connection.file)

//  Sqlite
print("\n---FOR EACH CONNECTION : SQLITE START---\n")
subscript = _this.params["sqlite"]
subscript.params["current_database_type"] = "sqlite"
lib.sqleditor.with_new_connection.params = {
    "database_settings": lib.connection.add_sqlite,
    "test": subscript,
    "validation": lib.sqleditor.open_connection_validate_sqlite,
    "initialization": lib.noop
}
await ws.execute(lib.sqleditor.with_new_connection.file)

print("\n---FOR EACH CONNECTION END---\n")