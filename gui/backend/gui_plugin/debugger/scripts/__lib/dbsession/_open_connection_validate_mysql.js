var lib = ws.tokens.lib
var _this = lib.dbsession.open_connection_validate_mysql

await ws.validateLastResponse(
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "Connection was successfully opened."
        },
        "result": {
            "module_session_id": ws.lastModuleSessionId,
            "info": {
                "version": ws.matchRegexp("\\d+\\.\\d+\\.\\d+"),
                "edition": ws.ignore,
                "sql_mode": ws.ignore
            },
            "default_schema": _this.params["default_schema"]
        }
    }
)
