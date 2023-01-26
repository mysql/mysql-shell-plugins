var lib = ws.tokens.lib
var _this = lib.sqleditor.open_connection_validate_sqlite

await ws.validateLastResponse(
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "Connection was successfully opened."
        },
        "result": {
            "module_session_id": ws.lastModuleSessionId,
            "info": {},
            "default_schema": _this.params["default_schema"]
        }
    }
)
