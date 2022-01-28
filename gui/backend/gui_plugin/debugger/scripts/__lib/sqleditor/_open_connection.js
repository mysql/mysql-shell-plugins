//
//  Open a configured connection
//  params:
//      connection_id: the connection id to open
//
var lib = ws.tokens.lib
var _this = lib.sqleditor.open_connection

await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.open_connection",
    "args": {
        "db_connection_id": _this.params["connection_id"],
        "module_session_id": ws.lastModuleSessionId,
    }
})

_this.params["validation"].params["default_schema"] = _this.params["default_schema"]
ws.execute(_this.params["validation"].file)

_this.result["info"] = ws.lastResponse['info']
