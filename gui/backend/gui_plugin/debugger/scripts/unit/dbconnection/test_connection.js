await ws.execute("unit/authenticate/success_admin.js")

var default_mysql_options = ws.tokens.defaults.database_connections.mysql[0].options

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.dbconnections.test_connection",
    "args": {
        "connection": {
            "db_type": "MySQL",
            "options": {
                "host": default_mysql_options.host,
                "port": default_mysql_options.port,
                "user": default_mysql_options.user,
                "password": "FAKE WRONG PASSWORD",
                "scheme": default_mysql_options.scheme,
                "schema": "information_schema"
            }
        },
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "ERROR",
            "msg": ws.matchRegexp(".*Access denied for user.*")
        }
    }
])

var originalRequestId = ws.generateRequestId()

await ws.sendAndValidate({
    "request": "execute",
    "request_id": originalRequestId,
    "command": "gui.dbconnections.test_connection",
    "args": {
        "connection": {
            "db_type": "MySQL",
            "options": {
                "host": default_mysql_options.host,
                "port": default_mysql_options.port,
                "user": default_mysql_options.user,
                "scheme": default_mysql_options.scheme,
                "schema": "information_schema"
            }
        },
    }
}, [
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": originalRequestId
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": originalRequestId,
        "result":
        {
            'defaultValue': '',
            'prompt': ws.matchRegexp(".*Please provide the password for.*"),
            'type': 'password'
        }
    }
])


ws.tokens["uri"] = default_mysql_options.user + '@' + default_mysql_options.host + ':' + default_mysql_options.portStr

var next_reply = default_mysql_options.password

if (ws.tokens["hasCredentialManager"]) {
    await ws.sendAndValidate({
        "request": "prompt_reply",
        "request_id": originalRequestId,
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
            "request_id": originalRequestId,
            "result":
            {
                "alt": "Ne&ver",
                "defaultValue": "&No",
                "no": "&No",
                "prompt": "Save password for '" + ws.tokens["uri"] + "'?",
                "type": "confirm",
                "yes": "&Yes"
            }
        }
    ])

    next_reply = "N"
} // endif

await ws.sendAndValidate({
    "request": "prompt_reply",
    "request_id": originalRequestId,
    "type": "OK",
    "reply": next_reply,
    "module_session_id": ws.lastModuleSessionId,
}, [
    {
        "request_id": originalRequestId,
        "request_state": {
            "type": "OK",
            "msg": "Connection was successfully opened."
        },
        "module_session_id": ws.lastModuleSessionId,
        "info": {},
        "default_schema": ws.ignore
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": originalRequestId,
    "command": "gui.db.close_session",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, [{
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "result": "Completed"
}])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.dbconnections.test_connection",
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
            "msg": "Connection was successfully opened."
        }
    }
])

