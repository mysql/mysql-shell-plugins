ws.log(": Auto-commit Sqlite specific tests")

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.get_auto_commit",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": 1
    }
])

//  Check double gets
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.get_auto_commit",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": 1
    }
])

//  Try to set the auto-commit and get an error
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.set_auto_commit",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "state": 0
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "ERROR",
            "msg": "This feature is not supported.",
            "source": "MSG",
            "code": 1011
        }
    }
])


//  Start a transaction to deactivate auto-commit
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "BEGIN TRANSACTION;",
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": "Full result set consisting of 0 rows transferred."
        },
        "request_id": ws.lastGeneratedRequestId,
        "rows": ws.ignore,
        "total_row_count": 0,
        "execution_time": ws.ignore
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.get_auto_commit",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": 0
    }
])


//  Rollback the transaction to activate the auto-commit back
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "ROLLBACK;",
        "module_session_id": ws.lastModuleSessionId,
        "params": [],
        "options": {}
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": "Full result set consisting of 0 rows transferred."
        },
        "request_id": ws.lastGeneratedRequestId,
        "rows": ws.ignore,
        "total_row_count": 0,
        "execution_time": ws.ignore
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sqleditor.get_auto_commit",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": 1
    }
])