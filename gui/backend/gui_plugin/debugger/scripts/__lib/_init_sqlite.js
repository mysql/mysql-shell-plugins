requests = ws.tokens['requests']
responses = ws.tokens['responses']
lib = ws.tokens.lib

//  Make Sqlite initializations here
await ws.sendAndValidate(
    Object.assign(Object(), requests.sqleditor.execute, {
        "args": {
            "sql": "CREATE TABLE IF NOT EXISTS `tests_user` (`id` INTEGER NOT NULL, `name` VARCHAR(45) NULL, PRIMARY KEY (`id`))",
        }
    })
    , [
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

await ws.sendAndValidate(
    Object.assign(Object(), requests.sqleditor.execute, {
        "args": {
            "sql": "CREATE TABLE IF NOT EXISTS `tests_session` (`id` INTEGER NOT NULL, `user_id` INTEGER NULL, PRIMARY KEY (`id`))",
        }
    })
    , [
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

await ws.sendAndValidate(
    Object.assign(Object(), requests.sqleditor.execute, {
        "args": {
            "sql": "CREATE INDEX IF NOT EXISTS `fk_tests_session_users1_idx` ON `tests_session` (`user_id` ASC)",
        }
    })
    , [
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


await ws.sendAndValidate(
    Object.assign(Object(), requests.sqleditor.execute, {
        "args": {
            "sql": "CREATE TRIGGER IF NOT EXISTS update_tests_user_name UPDATE OF name ON tests_user BEGIN UPDATE tests_user SET name = new.name + 'aaa'; END;",
        }
    })
    , [
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




lib.init_mysql = lib.noop
