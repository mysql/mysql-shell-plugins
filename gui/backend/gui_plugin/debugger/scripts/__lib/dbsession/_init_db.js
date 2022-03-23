var lib = ws.tokens.lib
var _this = lib.dbsession.init_db
var settings = _this.params["database_settings"]

await ws.execute(settings.file)
await ws.execute(lib.sqleditor.open_session.file)
lib.sqleditor.open_connection.params = {
    "connection_id": settings.result["connection_id"],
    "default_schema": settings.result["default_schema"],
    "validation": _this.params["validation"]
}
await ws.execute(lib.sqleditor.open_connection.file)
await ws.execute(_this.params["init"].file)
await ws.execute(lib.sqleditor.close_session.file)
