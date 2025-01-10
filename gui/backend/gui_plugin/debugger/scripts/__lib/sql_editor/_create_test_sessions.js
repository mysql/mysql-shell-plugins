var lib = ws.tokens.lib
var _this = lib.sql_editor.create_test_sessions

var defaults = ws.tokens.defaults
var user1_options = {
    "host": defaults.database_connections.mysql[2].options.host,
    "port": defaults.database_connections.mysql[2].options.port,
    "user": defaults.database_connections.mysql[2].options.user,
    "password": defaults.database_connections.mysql[2].options.password,
    "scheme": defaults.database_connections.mysql[2].options.scheme,
}

var user2_options = {
    "host": defaults.database_connections.mysql[3].options.host,
    "port": defaults.database_connections.mysql[3].options.port,
    "user": defaults.database_connections.mysql[3].options.user,
    "password": defaults.database_connections.mysql[3].options.password,
    "scheme": defaults.database_connections.mysql[3].options.scheme,
}

var user2_no_pwd_options = {
    "host": defaults.database_connections.mysql[3].options.host,
    "port": defaults.database_connections.mysql[3].options.port,
    "user": defaults.database_connections.mysql[3].options.user,
    "scheme": defaults.database_connections.mysql[3].options.scheme,
}

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
            "options": user1_options
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

_this["connection_id_user1"] = ws.lastResponse["result"]

await ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "done": true
})

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
            "options": user2_options
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

_this["connection_id_user2"] = ws.lastResponse["result"]

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "done": true
})

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
            "options": user2_no_pwd_options
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

_this["connection_id_user2_nopwd"] = ws.lastResponse["result"]

ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "done": true
})