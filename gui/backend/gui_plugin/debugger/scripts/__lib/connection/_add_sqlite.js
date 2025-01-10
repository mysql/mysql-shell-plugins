//
//  Creates a new Sqlite file and adds a new connection in the backend.
//  return:
//      connection_id: the id of the connection that was just created
//      default_schema: the default schema configured for these options
//      profile_id: the profile id used to create the connection
//
var lib = ws.tokens.lib
var _this = lib.connection.add_sqlite

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.delete_file",
    "args": {
        "path": ws.tokens["current_test_name"] + ".sqlite3"
    }
}, [
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.core.create_file",
    "args": {
        "path": ws.tokens["current_test_name"] + ".sqlite3"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": ws.tokens["current_test_name"] + ".sqlite3",
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])

// ws.tokens[subScriptName] = {
lib.connection.add.params = {
    "connection": {
        "db_type": "Sqlite",
        "caption": "This is a test database",
        "description": "This is a test database description",
        "options": {
            "db_file": ws.tokens["current_test_name"] + ".sqlite3"
        }
    },
    "profile_id": 1,
}

await ws.execute(lib.connection.add.file)

_this.result["connection_id"] = lib.connection.add.result["connection_id"]
_this.result["default_schema"] = ws.tokens["current_test_name"]
_this.result["profile_id"] = 1
