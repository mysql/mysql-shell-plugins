ws.tokens["profileId"] = 1


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sql_editor.start_session",
    "args": {}
}, [{
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "PENDING",
        "msg": ""
    },
    "result": {
        "module_session_id": ws.matchRegexp("[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
    }
}, {
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "done": true
}
])


await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_db_connection",
    "args": {
        "profile_id": ws.tokens["profileId"],
        "connection": {
            "db_type": "Sqlite",
            "caption": "This is a test sqlite3 database",
            "description": "This is a test sqlite3 database description",
            "options": {
                "db_file": "tests_db_that_not_exists.sqlite3"
            }
        },
        "folder_path": "tests"
    }
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "PENDING",
        "msg": ws.ignore
    },
    "result": ws.matchRegexp("\\d+")
})

ws.tokens["connectionId"] = ws.lastResponse["result"]

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "done": true
})


await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sql_editor.open_connection",
    "args": {
        "db_connection_id": ws.tokens["connectionId"],
        "module_session_id": ws.lastModuleSessionId,
    }
})


ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "ERROR",
        "msg": ws.matchRegexp("The database file: .+ does not exist for '.+' database."),
        "code": 1002,
        "source": "MSG"
    }
})

