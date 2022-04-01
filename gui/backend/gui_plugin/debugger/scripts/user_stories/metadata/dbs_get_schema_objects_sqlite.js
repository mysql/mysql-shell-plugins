ws.execute("__lib/_init.js")
var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_directory"] = "user_stories/metadata"
ws.tokens["current_test_name"] = "get_schema_objects_sqlite"
ws.log("-----=== [START] " + ws.tokens["current_test_name"] + " test ===-----")

//  Initialize
await ws.execute(lib.login.admin.file)
var settings = lib.connection.add_sqlite
lib.dbsession.init_db.params = {
    "database_settings": settings,
    "validation": lib.dbsession.open_connection_validate_sqlite,
    "init": lib.init_sqlite
}
await ws.execute(lib.dbsession.init_db.file)
lib.dbsession.open_db_session.params = {
    "database_settings": settings,
    "validation": lib.dbsession.open_connection_validate_sqlite
}
await ws.execute(lib.dbsession.open_db_session.file)

// Open DB session
lib.dbsession.open_db_session.params = {
    "database_settings": settings,
    "connection_id": settings.result["connection_id"],
    "validation": lib.dbsession.open_connection_validate_sqlite
}
await ws.execute(lib.dbsession.open_db_session.file)

// Test for MySQL
await ws.execute(user_stories.metadata.get_schema_objects_sqlite.file)

// Remove connection
lib.connection.remove.params = {
    "profile_id": settings.result["profile_id"],
    "connection_id": settings.result["connection_id"]
}

await ws.execute(lib.connection.remove.file)

//  Terminate
await ws.execute(lib.dbsession.close_db_session.file)
await ws.execute(lib.login.logout.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
