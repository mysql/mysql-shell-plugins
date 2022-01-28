var responses = ws.tokens.responses
var requests = ws.tokens.requests

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\py",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.pending.executionStarted,
    //  No message about switching to python mode because it should be already in python mode
    responses.ok.default
])


await ws.sendAndValidate(
    Object.assign(Object(), requests.shell.execute, {
        "args": { "command": "list([1,2,3])" }
    }),
    [
        responses.pending.executionStarted,
        Object.assign(Object(), responses.pending.executing, {
            "result": { "rows": [1, 2, 3] }
        }),
        responses.ok.default
    ]
)

await ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request": "execute",
    "command": "gui.shell.execute",
    "args": {
        "command": "45+3",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "value": 48
        }
    },
    responses.ok.default
])

