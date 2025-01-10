//
//  Add a new MySQL connection in the backend.
//  return:
//      connection_id: the id of the connection that was just created
//      default_schema: the default schema configured for these options
//      profile_id: the profile id used to create the connection
//
var lib = ws.tokens.lib
var defaults = ws.tokens.defaults
var default_mysql_options = defaults.database_connections.mysql[2].options

_this = lib.connection.add_mysql_user1

lib.connection.add.params = {
    "connection": {
        "db_type": "MySQL",
        "caption": "This is a test database",
        "description": "This is a test database description",
        "options": {
            "host": default_mysql_options.host,
            "port": default_mysql_options.port,
            "user": default_mysql_options.user,
            "password": default_mysql_options.password,
            "scheme": default_mysql_options.scheme,
            "schema": "information_schema"
        }
    },
    "profile_id": 1,
}

await ws.execute(lib.connection.add.file)

_this.result["connection_id"] = lib.connection.add.result["connection_id"]
_this.result["default_schema"] = "information_schema"
_this.result["profile_id"] = 1
