var responses = ws.tokens["responses"]

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.complete",
    "args": {
        "data": "gui.",
        "offset" : 0,
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
            "offset": 4,
            "options": ws.matchList([
                "cluster",
                "core",
                "db",
                "dbconnections",
                "debugger",
                "help()",
                "mds",
                "modeler",
                "modules",
                "shell",
                "sqleditor",
                "start",
                "users"
                ], false)
        }
    },
    responses.ok.default
])

