var defaults = ws.tokens.defaults
var responses = ws.tokens.responses
var requests = ws.tokens.requests
var default_mysql_options = defaults.database_connections.mysql[0].options


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_db_connection",
    "args": {
        "profile_id": 1,
        "connection": {
            "db_type": "MySQL",
            "caption": "This is a test MySQL database",
            "description": "This is a test MySQL database description",
            "options": {
                "scheme": default_mysql_options.scheme,
                "user": default_mysql_options.user,
                "password": default_mysql_options.password,
                "host": default_mysql_options.host,
                "port": default_mysql_options.port,
            }
        },
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

ws.tokens["db_connection_id"] = ws.lastResponse["result"]

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "done": true
})

var target_path = ws.tokens['testTempDir'] + "/" + "my-dump"

// Successfully dumps the only schema
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.start_session",
    "args": {
        "db_connection_id": ws.tokens["db_connection_id"],
        "shell_args": ["--", "util", "dump-schemas", "test_user_story", "--outputUrl", target_path]
    }
}, ws.matchList([
    { "request_state": { "type": "PENDING", "msg": "Execution started..." }, "request_id": ws.lastGeneratedRequestId },
    { "request_state": { "type": "PENDING", "msg": "Executing..." }, "request_id": ws.lastGeneratedRequestId, "result": { "status": "Initializing...\n" } },
    { "request_state": { "type": "PENDING", "msg": "Executing..." }, "request_id": ws.lastGeneratedRequestId, "result": { "info": "Acquiring global read lock\n" } },
    { "request_state": { "type": "PENDING", "msg": "Executing..." }, "request_id": ws.lastGeneratedRequestId, "result": { "status": "Running data dump using 4 threads.\n" } },
    { "request_state": { "type": "OK", "msg": "" }, "request_id": ws.lastGeneratedRequestId, "result": { "module_session_id": ws.ignore, "exit_status": 0 } }
], false))


// Now fails the dump as the target folder already exists
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.start_session",
    "args": {
        "db_connection_id": ws.tokens["db_connection_id"],
        "shell_args": ["--", "util", "dump-schemas", "test_user_story", "--outputUrl", target_path]
    }
}, ws.matchList([
    { "request_state": { "type": "PENDING", "msg": "Execution started..." }, "request_id": ws.lastGeneratedRequestId },
    { "request_state": { "type": "ERROR", "msg": ws.matchRegexp("Cannot proceed with the dump, the specified directory '.*' already exists at the target location .* and is not empty.\n") }, "request_id": ws.lastGeneratedRequestId, }
], false))
