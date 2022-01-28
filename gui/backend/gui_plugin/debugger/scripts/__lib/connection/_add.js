
//
//  Add a new connection, using the supplied database settings
//  params:
//      profile_id:
//      connection:
//          db_type:
//          caption:
//          description:
//          options:
//      folder_path:
//  return:
//      returns the connection id that was just created
//
ws.log("Adding a new connection")
var lib = ws.tokens.lib

_this = lib.connection.add

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.dbconnections.add_db_connection",
    "args": {
        "profile_id": _this.params["profile_id"],
        "connection": _this.params["connection"],
        "folder_path": _this.params["folder_path"]
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "result": {
            "db_connection_id": ws.matchRegexp("\\d+")
        }
    }
])

_this.result["connection_id"] = ws.lastResponse['result']['db_connection_id']
