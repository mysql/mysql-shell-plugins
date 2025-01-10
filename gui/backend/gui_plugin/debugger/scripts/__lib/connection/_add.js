
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

await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_folder_path",
    "args": {
        "profile_id": 1,
        "caption": "tests"
    }
})

ws.validateLastResponse({
    "request_state": {
        "type": "PENDING",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": ws.ignore
})


_this.params['folder_path_id'] = ws.lastResponse['result']
ws.tokens['base_tests_folder_path_id'] = ws.lastResponse['result']

ws.validateLastResponse({
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
})

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_db_connection",
    "args": {
        "profile_id": _this.params["profile_id"],
        "connection": _this.params["connection"],
        "folder_path_id": _this.params["folder_path_id"]
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": ws.ignore
        },
        "result": ws.matchRegexp("\\d+")
    }
])

_this.result["connection_id"] = ws.lastResponse["result"]

await ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "done": true
})
