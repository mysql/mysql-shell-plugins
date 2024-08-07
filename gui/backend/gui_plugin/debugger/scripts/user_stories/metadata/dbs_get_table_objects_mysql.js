var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_directory"] = "user_stories/metadata"
ws.tokens["current_test_name"] = "get_table_objects_mysql"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
var settings = lib.connection.add_mysql_root
lib.dbsession.init_db.params = {
    "database_settings": settings,
    "validation": lib.dbsession.open_connection_validate_mysql,
    "init": lib.init_mysql
}
await ws.execute(lib.dbsession.init_db.file)
lib.dbsession.open_db_session.params = {
    "database_settings": settings,
    "validation": lib.dbsession.open_connection_validate_mysql
}

// Open DB session
lib.dbsession.open_db_session.params = {
    "database_settings": settings,
    "connection_id": settings.result["connection_id"],
    "validation": lib.dbsession.open_connection_validate_mysql
}
await ws.execute(lib.dbsession.open_db_session.file)

// Test for MySQL
await ws.execute(user_stories.metadata.get_table_objects_mysql.file)

// Remove connection
lib.connection.remove.params = {
    "profile_id": settings.result["profile_id"],
    "connection_id": settings.result["connection_id"]
}

//  Terminate
await ws.execute(lib.dbsession.close_db_session.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
