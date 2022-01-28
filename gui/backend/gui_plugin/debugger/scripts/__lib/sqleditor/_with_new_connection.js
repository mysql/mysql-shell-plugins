var lib = ws.tokens.lib
var _this = lib.sqleditor.with_new_connection
var settings = _this.params["database_settings"]

await ws.execute(settings.file)

lib.sqleditor.open_connection.params = {
    "connection_id": settings.result["connection_id"],
    "default_schema": settings.result["default_schema"],
    "validation": _this.params["validation"]
}

await ws.execute(lib.sqleditor.open_connection.file)

await ws.execute(_this.params["initialization"].file)

//  Parameters to the sub-script should be set in the caller script
await ws.execute(_this.params["test"].file)

lib.connection.remove.params = {
    "profile_id": settings.result["profile_id"],
    "connection_id": settings.result["connection_id"]
}

await ws.execute(lib.connection.remove.file)
