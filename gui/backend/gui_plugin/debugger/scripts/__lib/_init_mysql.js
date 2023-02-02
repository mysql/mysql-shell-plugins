lib = ws.tokens.lib
responses = ws.tokens["responses"]


//  Drop the test schemas
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "DROP SCHEMA IF EXISTS tests",
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "rows": [],
            "total_row_count": 0,
            "execution_time": ws.ignore,
            "rows_affected": ws.matchRegexp("[0|1]")
        }
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

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "DROP SCHEMA IF EXISTS tests2",
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "rows": [],
            "total_row_count": 0,
            "execution_time": ws.ignore,
            "rows_affected": 0
        }
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

// Drop existing test users
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "DROP USER IF EXISTS user1",
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "rows": [],
            "total_row_count": 0,
            "execution_time": ws.ignore,
            "rows_affected": 0
        }
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

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "DROP USER IF EXISTS user2",
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "rows": [],
            "total_row_count": 0,
            "execution_time": ws.ignore,
            "rows_affected": 0
        }
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

//  Recreate the schemas
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "CREATE SCHEMA IF NOT EXISTS tests",
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "rows": [],
            "total_row_count": 0,
            "execution_time": ws.ignore,
            "rows_affected": 1
        }
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

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "CREATE SCHEMA IF NOT EXISTS tests2",
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "rows": [],
            "total_row_count": 0,
            "execution_time": ws.ignore,
            "rows_affected": 1
        }
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

// Create test users
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "CREATE USER IF NOT EXISTS `user1`@`localhost` IDENTIFIED BY 'user1password'",
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "rows": [],
            "total_row_count": 0,
            "execution_time": ws.ignore,
            "rows_affected": 0
        }
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

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "CREATE USER IF NOT EXISTS `user2`@`localhost` IDENTIFIED BY 'user2password'",
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "rows": [],
            "total_row_count": 0,
            "execution_time": ws.ignore,
            "rows_affected": 0
        }
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




// #pragma once
lib.init_mysql = lib.noop
