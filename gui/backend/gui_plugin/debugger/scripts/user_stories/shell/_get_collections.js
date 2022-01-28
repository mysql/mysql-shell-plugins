var defaults = ws.tokens.defaults
var options = defaults.database_connections.mysql[1].options
var requests = ws.tokens.requests
var responses = ws.tokens.responses

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\c " + options.user + ":@" + options.host + ":" + options.portStr + "/mysql",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.pending.executionStarted,
    {
        'request_state': {
            'type': 'PENDING',
            'msg': 'Executing...'
        },
        'request_id': ws.lastGeneratedRequestId,
        'result': {
            'info': "Creating a session to '" + options.user + "@" + options.host + ":" + options.portStr + "/mysql'\n"
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "info": ws.matchRegexp("Your MySQL connection id is \\d+ \\(X protocol\\)\\nServer version: .+\n")

        }
    },
    responses.ok.default
])

// Drop the collection. Will be ignored if it doesn't exit
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "db.drop_collection('collection_1')",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.pending.executionStarted,
    responses.ok.default
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "db.drop_collection('collection_2')",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.pending.executionStarted,
    responses.ok.default
])

// Create test collections
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "db.create_collection('collection_1')",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.pending.executionStarted,
    {
        'request_state': {
            'type': 'PENDING',
            'msg': 'Executing...'
        },
        'request_id': ws.lastGeneratedRequestId,
        'result': {
            "class": "Collection",
            "name": "collection_1"
        }
    },
    responses.ok.default
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "db.create_collection('collection_2')",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.pending.executionStarted,
    {
        'request_state': {
            'type': 'PENDING',
            'msg': 'Executing...'
        },
        'request_id': ws.lastGeneratedRequestId,
        'result': {
            "class": "Collection",
            "name": "collection_2"
        }
    },
    responses.ok.default
])

await ws.sendAndValidate(
    Object.assign(Object(), requests.shell.execute, {
        "args": { "command": "db.get_collections()" }
    }), [
        responses.pending.executionStarted,
        Object.assign(Object(), responses.pending.executing, {
            "result": {
                "rows": [
                    { "class": "Collection", "name": "collection_1" },
                    { "class": "Collection", "name": "collection_2" }
                ]
            }
        }),
        responses.ok.default
    ]
)