await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.add_execution_history_entry",
    "args": {
        "connection_id": 1,
        "code": "SELECT * FROM table1",
        "language_id": "SQL",
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": ws.matchRegexp("\d")
}, {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.get_execution_history_entry",
    "args": {
        "connection_id": 1,
        "index": 0,
    },
    "request_id": ws.generateRequestId()
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": {
            "code": "SELECT * FROM table1",
            "language_id": "SQL",
            "current_timestamp": ws.ignore,
        },
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.get_execution_history_entries",
    "args": {
        "connection_id": 1,
    },
    "request_id": ws.generateRequestId()
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": [{
            "code": "SELECT * FROM table1",
            "language_id": "SQL",
            "current_timestamp": ws.ignore,
        }],
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.add_execution_history_entry",
    "args": {
        "connection_id": 1,
        "code": "SELECT * FROM table1",
        "language_id": "SQL",
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": ws.matchRegexp("\d")
}, {
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.get_execution_history_entries",
    "args": {
        "connection_id": 1,
    },
    "request_id": ws.generateRequestId()
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": [{
            "code": "SELECT * FROM table1",
            "language_id": "SQL",
            "current_timestamp": ws.ignore,
        }],
        "request_id": ws.lastGeneratedRequestId
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

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.add_execution_history_entry",
    "args": {
        "connection_id": 1,
        "code": "console.log('Hello, World!');",
        "language_id": "JS",
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": ws.matchRegexp("\d")
}, {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.get_execution_history_entry",
    "args": {
        "connection_id": 1,
        "index": 0,
    },
    "request_id": ws.generateRequestId()
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": {
            "code": "console.log('Hello, World!');",
            "language_id": "JS",
            "current_timestamp": ws.ignore,
        },
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.get_execution_history_entries",
    "args": {
        "connection_id": 1,
    },
    "request_id": ws.generateRequestId()
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": [{
            "code": "console.log('Hello, World!');",
            "language_id": "JS",
            "current_timestamp": ws.ignore,
        }, {
            "code": "SELECT * FROM table1",
            "language_id": "SQL",
            "current_timestamp": ws.ignore,
        }],
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.add_execution_history_entry",
    "args": {
        "connection_id": 1,
        "code": "console.log('Hello, World!');",
        "language_id": "JS",
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": ws.matchRegexp("\d")
}, {
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.get_execution_history_entries",
    "args": {
        "connection_id": 1,
    },
    "request_id": ws.generateRequestId()
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": [{
            "code": "console.log('Hello, World!');",
            "language_id": "JS",
            "current_timestamp": ws.ignore,
        }, {
            "code": "SELECT * FROM table1",
            "language_id": "SQL",
            "current_timestamp": ws.ignore,
        }],
        "request_id": ws.lastGeneratedRequestId
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

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.add_execution_history_entry",
    "args": {
        "connection_id": 2,
        "code": "let greet: string = 'Hello, TypeScript!'; console.log(greet);",
        "language_id": "TS",
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": ws.matchRegexp("\d")
}, {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.get_execution_history_entry",
    "args": {
        "connection_id": 2,
        "index": 0,
    },
    "request_id": ws.generateRequestId()
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": {
            "code": "let greet: string = 'Hello, TypeScript!'; console.log(greet);",
            "language_id": "TS",
            "current_timestamp": ws.ignore,
        },
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.get_execution_history_entries",
    "args": {
        "connection_id": 2,
    },
    "request_id": ws.generateRequestId()
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": [{
            "code": "let greet: string = 'Hello, TypeScript!'; console.log(greet);",
            "language_id": "TS",
            "current_timestamp": ws.ignore,
        }],
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.add_execution_history_entry",
    "args": {
        "connection_id": 1,
        "code": "let greet: string = 'Hello, TypeScript!'; console.log(greet);",
        "language_id": "TS",
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": ws.matchRegexp("\d")
}, {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.get_execution_history_entry",
    "args": {
        "connection_id": 1,
        "index": 0,
    },
    "request_id": ws.generateRequestId()
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": {
            "code": "let greet: string = 'Hello, TypeScript!'; console.log(greet);",
            "language_id": "TS",
            "current_timestamp": ws.ignore,
        },
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.get_execution_history_entries",
    "args": {
        "connection_id": 1,
    },
    "request_id": ws.generateRequestId()
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": [{
            "code": "let greet: string = 'Hello, TypeScript!'; console.log(greet);",
            "language_id": "TS",
            "current_timestamp": ws.ignore,
        }, {
            "code": "console.log('Hello, World!');",
            "language_id": "JS",
            "current_timestamp": ws.ignore,
        }, {
            "code": "SELECT * FROM table1",
            "language_id": "SQL",
            "current_timestamp": ws.ignore,
        }],
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.add_execution_history_entry",
    "args": {
        "connection_id": 2,
        "code": "console.log('Hello, World!');",
        "language_id": "JS",
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": ws.matchRegexp("\d")
}, {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.get_execution_history_entry",
    "args": {
        "connection_id": 2,
        "index": 0,
    },
    "request_id": ws.generateRequestId()
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": {
            "code": "console.log('Hello, World!');",
            "language_id": "JS",
            "current_timestamp": ws.ignore,
        },
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.get_execution_history_entries",
    "args": {
        "connection_id": 2,
    },
    "request_id": ws.generateRequestId()
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": [{
            "code": "console.log('Hello, World!');",
            "language_id": "JS",
            "current_timestamp": ws.ignore,
        }, {
            "code": "let greet: string = 'Hello, TypeScript!'; console.log(greet);",
            "language_id": "TS",
            "current_timestamp": ws.ignore,
        }],
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.remove_execution_history_entry",
    "args": {
        "connection_id": 2,
        "index": 0,
    },
    "request_id": ws.generateRequestId()
}, [{
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.get_execution_history_entries",
    "args": {
        "connection_id": 2,
    },
    "request_id": ws.generateRequestId()
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": [{
            "code": "let greet: string = 'Hello, TypeScript!'; console.log(greet);",
            "language_id": "TS",
            "current_timestamp": ws.ignore,
        }],
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.remove_execution_history_entry",
    "args": {
        "connection_id": 2,
        "index": 0,
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.get_execution_history_entries",
    "args": {
        "connection_id": 2,
    },
    "request_id": ws.generateRequestId()
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": [],
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.remove_execution_history_entry",
    "args": {
        "connection_id": 2,
        "index": 0,
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "ERROR",
        "msg": "Parameter 'index' is out of range.",
        "source": "MSG",
        "code": 1012
    },
    "request_id": ws.lastGeneratedRequestId,
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.remove_execution_history_entry",
    "args": {
        "connection_id": 1,
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.sql_editor.get_execution_history_entries",
    "args": {
        "connection_id": 1,
    },
    "request_id": ws.generateRequestId()
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": [],
        "request_id": ws.lastGeneratedRequestId
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
}])
