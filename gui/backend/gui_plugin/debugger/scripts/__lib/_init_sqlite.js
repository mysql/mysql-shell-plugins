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

await ws.sendAndValidate(
    Object.assign(Object(), requests.sqleditor.execute, {
        "args": {
            "sql": "CREATE TABLE `test_table` (`id` INTEGER PRIMARY KEY, `text_column` TEXT, `integer_column` INTEGER, `real_column` REAL, `numeric_column` NUMERIC, `blob_column` BLOB, `boolean_column` BOOLEAN, `date_column` DATE, `time_column` TIME, `datetime_column` DATETIME)",
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
            "sql": "INSERT INTO test_table(text_column, integer_column, real_column, numeric_column, blob_column, boolean_column, date_column, time_column, datetime_column) VALUES('Sample text', 42, 3.14, 123.456, X'01020304', 1, '2024-01-11', '12:34:56', '2024-01-11 12:34:56');"
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
