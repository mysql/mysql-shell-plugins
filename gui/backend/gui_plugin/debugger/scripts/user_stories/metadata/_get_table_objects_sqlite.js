requests = ws.tokens['requests']
responses = ws.tokens['responses']

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Trigger",
        "schema_name": "main",
        "table_name": "sqlite_master"
    }
}, [
    responses.pending.executionStarted,
    Object.assign(Object(), responses.ok.default, {
        "result": ws.ignore
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Index",
        "schema_name": "main",
        "table_name": "sqlite_master"
    }
}, [
    responses.pending.executionStarted,
    Object.assign(Object(), responses.ok.default, {
        "result": ws.ignore
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Column",
        "schema_name": "main",
        "table_name": "sqlite_master"
    }
}, [
    responses.pending.executionStarted,
    Object.assign(Object(), responses.ok.default, {
        "result": ["type", "name", "tbl_name", "rootpage", "sql"]
    })
])


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Column",
        "schema_name": "main",
        "table_name": "sqlite_master",
        "name": "type"
    }
}, [
    responses.pending.executionStarted,
    Object.assign(Object(), responses.ok.default, {
        "result": ws.ignore
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Column",
        "schema_name": "main",
        "table_name": "sqlite_master",
        "name": "type"
    }
}, [
    responses.pending.executionStarted,
    Object.assign(Object(), responses.ok.default, {
        "result": {"name": "type"}
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Index",
        "schema_name": "main",
        "table_name": "tests_session",
        "name": "fk_tests_session_users1_idx"
    }
}, [
    responses.pending.executionStarted,
    Object.assign(Object(), responses.ok.default, {
        "result": {"name": "fk_tests_session_users1_idx"}
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Trigger",
        "schema_name": "main",
        "table_name": "tests_user",
        "name": "update_tests_user_name"
    }
}, [
    responses.pending.executionStarted,
    Object.assign(Object(), responses.ok.default, {
        "result": {"name": "update_tests_user_name"}
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Trigger",
        "schema_name": "main",
        "table_name": "tests_user",
        "name": "unexisting_name"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The trigger 'main.unexisting_name' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId
    },
    responses.ok.default
])