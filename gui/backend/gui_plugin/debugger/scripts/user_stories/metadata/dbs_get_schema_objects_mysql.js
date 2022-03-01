ws.execute("__lib/_init.js")
var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_directory"] = "user_stories/metadata"
ws.tokens["current_test_name"] = "get_schema_objects_mysql"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.login.admin.file)
var settings = lib.connection.add_mysql_root
lib.dbsession.init_db.params = {
    "database_settings": settings,
    "validation": lib.dbsession.open_connection_validate_mysql,
    "init": lib.init_mysql
}
await ws.execute(lib.dbsession.init_db.file)
await ws.execute(lib.dbsession.open_db_session.file)

//  Test for MySQL
lib.dbsession.with_new_connection.params = {
    "database_settings": settings,
    "test": user_stories.metadata.get_schema_objects_mysql,
    "validation": lib.dbsession.open_connection_validate_mysql
}

await ws.execute(lib.dbsession.with_new_connection.file)


//  Terminate
await ws.execute(lib.dbsession.close_db_session.file)
await ws.execute(lib.login.logout.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
