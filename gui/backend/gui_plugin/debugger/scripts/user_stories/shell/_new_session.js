var defaults = ws.tokens.defaults
var responses = ws.tokens.responses
var requests = ws.tokens.requests
var default_mysql_options = defaults.database_connections.mysql[0].options

await ws.sendAndValidate(
    Object.assign(Object(), requests.shell.execute,  {
        "args": { "command": "\\option -l", }
    // }), ws.matchList([
    }), ws.matchList([
    responses.pending.executionStarted,
    Object.assign(Object(), responses.pending.executing, {
        "result": {"info": " autocomplete.nameCache          false\n"},
    }),
    Object.assign(Object(), responses.pending.executing, {
        "result": {"info": " batchContinueOnError            false\n"}
    }),
    responses.ok.default
], false))


await ws.sendAndValidate(
    Object.assign(Object(), requests.shell.execute, {
        "args": {
            "command": "\\c " + default_mysql_options.user + ":@" + default_mysql_options.host + ":" + default_mysql_options.portStr,
        }
    }), [
    responses.pending.executionStarted,
    Object.assign(Object(), responses.pending.executing, {
        "result": {
            "info": "Creating a session to '" + default_mysql_options.user + "@" + default_mysql_options.host + ":" + default_mysql_options.portStr + "'\n"
        }
    }),
    Object.assign(Object(), responses.pending.executing, {
        "result": {
            "info": ws.matchRegexp("Your MySQL connection id is \\d+\nServer version: .+")
        }
    }),
    responses.ok.default
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\sql",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.pending.executionStarted,
    Object.assign(Object(), responses.pending.executing, {
        "result": {
            "info": "Switching to SQL mode... Commands end with ;\n"
        }
    }),
    responses.ok.default
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "show databases;",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.pending.executionStarted,
    Object.assign(Object(), responses.pending.executing, {
        'result': {
            'hasData': 1,
            'rows': ws.matchList([
                {'Database': 'information_schema'},
                {'Database': 'mysql'},
                {'Database': 'performance_schema'},
                {'Database': 'sys'}
            ], 0),
            'executionTime': ws.ignore,
            'affectedRowCount': 0,
            'affectedItemsCount': 0,
            'warningCount': 0,
            'warningsCount': 0,
            'warnings': [],
            'info': '',
            'autoIncrementValue': 0
        }
    }),
    responses.ok.default
])
