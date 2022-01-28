await ws.execute("unit/authenticate/success_admin.js")

ws.tokens["profileId"] = 1


await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.start_session",
    "args": {}
})

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "New SQL Editor session created successfully."
    },
    "module_session_id": ws.matchRegexp("[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
})


await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.dbconnections.add_db_connection",
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
        "type": "OK",
        "msg": ws.ignore
    },
    "result": {
        "db_connection_id": ws.matchRegexp("^[0-9]+$")
    }
})

ws.tokens["connectionId"] = ws.lastResponse['result']['db_connection_id']


await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.open_connection",
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

