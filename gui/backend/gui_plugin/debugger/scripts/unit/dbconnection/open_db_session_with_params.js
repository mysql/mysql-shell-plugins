await ws.execute("unit/authenticate/success_admin.js")

var default_mysql_options = ws.tokens.defaults.database_connections.mysql[0].options

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.start_session",
    "args": {
        "connection": {
            "db_type": "MySQL",
            "options": {
                "host": default_mysql_options.host,
                "port": default_mysql_options.port,
                "user": default_mysql_options.user,
                "password": default_mysql_options.password,
                "scheme": default_mysql_options.scheme,
                "schema": "information_schema"
            }
        },
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "New DB session created successfully."
        },
        "module_session_id": ws.matchRegexp("[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
    },
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "Connection was successfully opened."
        },
        "module_session_id": ws.matchRegexp("[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
    }
])


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.close_session",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, [
    {
        "module_session_id": ws.lastModuleSessionId,
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": "DB session has been closed successfully."
        }
    }
])
