//
//  Start a new db session
//  return:
//      session_id: the id of the session that was just opened
//
var lib = ws.tokens.lib
var _this = lib.dbsession.open_db_session
var settings = _this.params["database_settings"]


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.start_session",
    "args": {
        "connection": settings.result["connection_id"],
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "New DB session created successfully."
        },
        "module_session_id": ws.matchRegexp("[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
    }
])

_this.result["session_id"] = ws.lastResponse['module_session_id']

// Validation of opened connection
_this.params["validation"].params["default_schema"] = settings.result["default_schema"]
ws.execute(_this.params["validation"].file)

