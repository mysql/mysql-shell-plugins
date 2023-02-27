var requests = ws.tokens["requests"]
var responses = ws.tokens["responses"]

ws.tokens["task1_req_id"] = ws.generateRequestId()
ws.tokens["task2_req_id"] = ws.generateRequestId()
ws.tokens["task3_req_id"] = ws.generateRequestId()
ws.tokens["task4_req_id"] = ws.generateRequestId()
ws.tokens["task5_req_id"] = ws.generateRequestId()
ws.tokens["task6_req_id"] = ws.generateRequestId()

await ws.send(
    Object.assign(Object(), requests.sqleditor.execute, {
        "request_id": ws.tokens["task1_req_id"],
        "args": { "sql": "SELECT SLEEP(8)" }
    }),
)

await ws.send(
    Object.assign(Object(), requests.sqleditor.execute, {
        "request_id": ws.tokens["task2_req_id"],
        "args": { "sql": "SELECT SLEEP(8)" }
    }),
)

await ws.send({
    "request": "execute",
    "request_id": ws.tokens["task3_req_id"],
    "command": "gui.sqleditor.set_current_schema",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "schema_name": "mysql"
    }
})

await ws.send({
    "request": "execute",
    "request_id": ws.tokens["task4_req_id"],
    "command": "gui.sqleditor.get_current_schema",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
})

await ws.send({
    "request": "execute",
    "request_id": ws.tokens["task5_req_id"],
    "command": "gui.sqleditor.set_auto_commit",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "state": 0
    }
})

await ws.send({
    "request": "execute",
    "request_id": ws.tokens["task6_req_id"],
    "command": "gui.sqleditor.get_auto_commit",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
})

await ws.send({
    "request": "cancel",
    "request_id": ws.tokens["task2_req_id"],
})

await ws.send({
    "request": "cancel",
    "request_id": ws.tokens["task3_req_id"],
})

await ws.send({
    "request": "cancel",
    "request_id": ws.tokens["task4_req_id"],
})

await ws.send({
    "request": "cancel",
    "request_id": ws.tokens["task5_req_id"],
})

await ws.sendAndValidate({
    "request": "cancel",
    "request_id": ws.tokens["task6_req_id"],
}, ws.matchList([
    {
        "request_state": {
            "type": "OK",
            "msg": "Request cancelled."
        },
        "request_id": ws.tokens["task2_req_id"],
    },
    {
        "request_state": {
            "type": "OK",
            "msg": "Request cancelled."
        },
        "request_id": ws.tokens["task3_req_id"],
    },
    {
        "request_state": {
            "type": "OK",
            "msg": "Request cancelled."
        },
        "request_id": ws.tokens["task4_req_id"],
    },
    {
        "request_state": {
            "type": "OK",
            "msg": "Request cancelled."
        },
        "request_id": ws.tokens["task5_req_id"],
    },
    {
        "request_state": {
            "type": "OK",
            "msg": "Request cancelled."
        },
        "request_id": ws.tokens["task6_req_id"],
    },
    {
        "request_state": {
            "type": "CANCELLED",
            "msg": ""
        },
        "request_id": ws.tokens["task2_req_id"],
    }, {
        "request_state": {
            "type": "CANCELLED",
            "msg": ""
        },
        "request_id": ws.tokens["task3_req_id"],
    },
    {
        "request_state": {
            "type": "CANCELLED",
            "msg": ""
        },
        "request_id": ws.tokens["task4_req_id"],
    },
    {
        "request_state": {
            "type": "CANCELLED",
            "msg": ""
        },
        "request_id": ws.tokens["task5_req_id"],
    },
    {
        "request_state": {
            "type": "CANCELLED",
            "msg": ""
        },
        "request_id": ws.tokens["task6_req_id"],
    }
], 0)
)
