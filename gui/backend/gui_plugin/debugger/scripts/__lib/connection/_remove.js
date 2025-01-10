//
//  Remove a connection from the backend
//
var lib = ws.tokens.lib
var _this = lib.connection.remove

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.remove_db_connection",
    "args": {
        "profile_id": _this.params["profile_id"],
        "connection_id": _this.params["connection_id"]
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "done": true
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.remove_folder_path",
    "args": {
        "folder_path_id": ws.tokens['base_tests_folder_path_id']
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "done": true
    }
])
