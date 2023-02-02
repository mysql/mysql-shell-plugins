var requests = ws.tokens.requests
var responses = ws.tokens.responses

await ws.sendAndValidate(
    Object.assign(Object(), requests.sqleditor.execute, {
        "args": { "sql": "CREATE SCHEMA IF NOT EXISTS tests;" }
    }),
    [
        responses.pending.executionStarted,
        {
            "request_state":
            {
                "type": "PENDING", "msg": ""
            },
            "request_id": ws.lastGeneratedRequestId,
            "result":
            {
                "rows": [],
                "total_row_count": 0,
                "execution_time": ws.ignore,
                "rows_affected": ws.matchRegexp("[0|1]")
            }
        },
        {
            "request_state":
            {
                "type": "OK", "msg": ""
            },
            "request_id": ws.lastGeneratedRequestId,
            "done": true
        }
    ]
)

await ws.sendAndValidate(
    Object.assign(Object(), requests.sqleditor.execute, {
        "args": { "sql": "DROP PROCEDURE IF EXISTS tests.test_procedure_1" }
    }),
    [
        responses.pending.executionStarted,
        {
            "request_id": ws.lastGeneratedRequestId,
            "request_state": { "type": "PENDING", "msg": "" },
            "result": {
                "rows": [],
                "total_row_count": 0,
                "execution_time": ws.ignore
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
    ]
)

await ws.sendAndValidate(
    Object.assign(Object(), requests.sqleditor.execute, {
        "args": { "sql": "CREATE DEFINER=`root`@`localhost` PROCEDURE `tests`.`test_procedure_1`() BEGIN SELECT 'column1' as 'colA', 'column2' as 'colB'; SELECT 'column1' as 'col1', 'column2' as 'col2', 'column3' as 'col3'; SELECT 'column1' as 'col1A', 'column2' as 'col2B', 'column3' as 'col3C', 'column4' as 'col4D'; END" }
    }),
    [
        responses.pending.executionStarted,
        {
            "request_id": ws.lastGeneratedRequestId,
            "request_state": { "type": "PENDING", "msg": "" },
            "result": {
                "rows": [],
                "total_row_count": 0,
                "execution_time": ws.ignore
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
    ]
)

await ws.sendAndValidate(
    Object.assign(Object(), requests.sqleditor.execute, {
        "args": { "sql": "CALL tests.test_procedure_1()" }
    }),
    [
        responses.pending.executionStarted,
        {
            "request_state": {
                "type": "PENDING",
                "msg": ""
            },
            "request_id": ws.lastGeneratedRequestId,
            "result": {
                "rows": [["column1", "column2"]],
                "columns": [{ "name": "colA", "type": "STRING" }, { "name": "colB", "type": "STRING" }],
                "total_row_count": 1,
                "execution_time": ws.ignore
            }
        },
        {
            "request_state": {
                "type": "PENDING",
                "msg": ""
            },
            "request_id": ws.lastGeneratedRequestId,
            "result": {
                "rows": [["column1", "column2", "column3"]],
                "columns": [{ "name": "col1", "type": "STRING" },
                { "name": "col2", "type": "STRING" },
                { "name": "col3", "type": "STRING" }],
                "total_row_count": 1,
                "execution_time": ws.ignore
            }
        },
        {
            "request_state": {
                "type": "PENDING",
                "msg": ""
            },
            "request_id": ws.lastGeneratedRequestId,
            "result": {
                "rows": [["column1", "column2", "column3", "column4"]],
                "columns": [{ "name": "col1A", "type": "STRING" },
                { "name": "col2B", "type": "STRING" },
                { "name": "col3C", "type": "STRING" },
                { "name": "col4D", "type": "STRING" }],
                "total_row_count": 1,
                "execution_time": ws.ignore
            }
        },
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
    ]
)
