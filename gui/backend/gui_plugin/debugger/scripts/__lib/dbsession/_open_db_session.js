//
//  Start a new db session
//  return:
//      session_id: the id of the session that was just opened
//
var lib = ws.tokens.lib
var _this = lib.dbsession.open_db_session
var settings = _this.params["database_settings"]


await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.start_session",
    "args": {
        "connection": settings.result["connection_id"],
    }
})

// Validation of opened connection
_this.params["validation"].params["default_schema"] = settings.result["default_schema"]
ws.execute(_this.params["validation"].file)

_this.result["session_id"] = _this.params["validation"].result['module_session_id']
