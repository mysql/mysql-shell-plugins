ws.execute("__lib/_init.js")
var lib = ws.tokens.lib
var user_stories = ws.tokens["user_stories"]

ws.tokens["current_directory"] = "user_stories/metadata"
ws.tokens["current_test_name"] = "get_table_objects_sqlite"
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
await ws.execute(lib.dbsession.open_db_session.file)

//  Test for Sqlite
lib.dbsession.with_new_connection.params = {
    "database_settings": settings,
    "test": user_stories.metadata.get_table_objects_sqlite,
    "validation": lib.dbsession.open_connection_validate_sqlite
}

await ws.execute(lib.dbsession.with_new_connection.file)


//  Terminate
await ws.execute(lib.dbsession.close_db_session.file)
await ws.execute(lib.login.logout.file)

ws.log("-----=== [END] " + ws.tokens["current_test_name"] + " test ===-----")
