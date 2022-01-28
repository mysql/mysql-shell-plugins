var requests = ws.tokens["requests"]
var responses = ws.tokens["responses"]

await ws.sendAndValidate(
    Object.assign(Object(), requests.sqleditor.execute, {
        "args": { "sql": "SELECT SCHEMA_NAME FROM information_schema.schemata;" }
    }),
    [
        responses.pending.executionStarted,
        {
            "request_state": {
                "type": "OK",
                "msg": ws.ignore
            },
            "request_id": ws.lastGeneratedRequestId,
            "columns": [{'name': 'SCHEMA_NAME', 'type': 'STRING'}],
            "rows": ws.matchList([['mysql'], ['information_schema'], ['performance_schema']], 0),
            "total_row_count": ws.matchRegexp("\\d+"),
            "execution_time": ws.ignore
        }
    ]
)

await ws.sendAndValidate(
    Object.assign(Object(), requests.sqleditor.execute, {
        "args": { "sql": "SELECT SCHEMA_NAME FROM information_schema.schemata;" }
    }),
    [
        responses.pending.executionStarted,
        {
            "request_state": {
                "type": "OK",
                "msg": ws.ignore
            },
            "request_id": ws.lastGeneratedRequestId,
            "columns": [{'name': 'SCHEMA_NAME', 'type': 'STRING'}],
            "rows": ws.matchList([['mysql'], ['information_schema'], ['performance_schema']], 0),
            "total_row_count": ws.matchRegexp("\\d+"),
            "execution_time": ws.ignore
        }
    ]
)
