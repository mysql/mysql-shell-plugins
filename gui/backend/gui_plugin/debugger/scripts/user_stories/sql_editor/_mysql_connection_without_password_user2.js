var lib = ws.tokens.lib
var defaults = ws.tokens.defaults
var default_mysql_options = defaults.database_connections.mysql[3].options
ws.tokens["uri"] = default_mysql_options.user + '@' + default_mysql_options.host + ':' + default_mysql_options.portStr

ws.log("Opening connection user2 without password")

request_id = ws.generateRequestId()

await ws.sendAndValidate({
    "request": "execute",
    "request_id": request_id,
    "command": "gui.sqleditor.open_connection",
    "args": {
        "db_connection_id": lib.sqleditor.create_test_sessions['connection_id_user2_nopwd'],
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": request_id,
        "result":
        {
            "password": "Please provide the password for '" + ws.tokens["uri"] + "': "
        }
    }
])

var next_reply = "user2password"

if (ws.tokens["hasCredentialManager"]) {
    await ws.sendAndValidate({
        "request": "prompt_reply",
        "request_id": request_id,
        "type": "OK",
        "reply": next_reply,
        "module_session_id": ws.lastModuleSessionId,
    }, [
        {
            "request_state":
            {
                "type": "PENDING",
                "msg": "Executing..."
            },
            "request_id": request_id,
            "result":
            {
                "prompt": "Save password for '" + ws.tokens["uri"] + "'? [Y]es/[N]o/Ne[v]er (default No): "
            }
        }
    ])

    next_reply = "N"
} // endif

await ws.sendAndValidate({
    "request": "prompt_reply",
    "request_id": request_id,
    "type": "OK",
    "reply": next_reply,
    "module_session_id": ws.lastModuleSessionId,
}, [
    {
        "request_id": request_id,
        "request_state": {
            "type": "OK",
            "msg": "Connection was successfully opened."
        },
        "module_session_id": ws.lastModuleSessionId,
        "info": {},
        "default_schema": ws.ignore
    }
])
