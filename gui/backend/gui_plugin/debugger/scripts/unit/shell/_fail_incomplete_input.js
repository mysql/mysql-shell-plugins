var responses = ws.tokens["responses"]

// Tests incomplete input in JavaScript Mode
await ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request": "execute",
    "command": "gui.shell.execute",
    "args": {
        "command": "\\js",
        "module_session_id": ws.lastModuleSessionId
    }
},[
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "info": "Switching to JavaScript mode...\n"
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "prompt_descriptor": {
                "mode": "JS"
            }
        }
    }
]);

await ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request": "execute",
    "command": "gui.shell.execute",
    "args": {
        "command": "function sample(data){\n    print(data);",
        "module_session_id": ws.lastModuleSessionId
    }
},[
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "error": "Expected } but found eof (SyntaxError)\n"
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId
    }
]);


// Tests incomplete input in Python Mode
await ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request": "execute",
    "command": "gui.shell.execute",
    "args": {
        "command": "\\py",
        "module_session_id": ws.lastModuleSessionId
    }
},[
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "info": "Switching to Python mode...\n"
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "prompt_descriptor": {
                "mode": "Py"
            }
        }
    }
]);

await ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request": "execute",
    "command": "gui.shell.execute",
    "args": {
        "command": "def sample(data):",
        "module_session_id": ws.lastModuleSessionId
    }
},[
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "error": ws.matchRegexp(".*[SyntaxError: unexpected EOF while parsing|IndentationError: expected an indented block].*")
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId
    }
]);



// Tests incomplete input in SQL Mode
await ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request": "execute",
    "command": "gui.shell.execute",
    "args": {
        "command": "\\sql",
        "module_session_id": ws.lastModuleSessionId
    }
},[
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "info": "Switching to SQL mode... Commands end with ;\n"
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "prompt_descriptor": {
                "mode": "SQL"
            }
        }
    }
]);

var defaults = ws.tokens.defaults
var default_mysql_options = defaults.database_connections.mysql[0].options


await ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request": "execute",
    "command": "gui.shell.execute",
    "args": {
        "command": "\\c " + default_mysql_options.user + ":@" + default_mysql_options.host + ":" + default_mysql_options.portStr,
        "module_session_id": ws.lastModuleSessionId
    }
},[
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "info": "Creating a session to '" + default_mysql_options.user + "@" + default_mysql_options.host + ":" + default_mysql_options.portStr + "'\n"
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "info": ws.matchRegexp("Your MySQL connection id is \\d+\nServer version: .+")
        }
    },
    responses.ok.default
])

await ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request": "execute",
    "command": "gui.shell.execute",
    "args": {
        "command": "select *\nfrom",
        "module_session_id": ws.lastModuleSessionId
    }
},[
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "error": {
                "code": 1064,
                "message": "You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near '' at line 2",
                "state": "42000",
                "type": "MySQL Error"
            }
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId
    }
]);

await ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request": "execute",
    "command": "gui.shell.execute",
    "args": {
        "command": "\\disconnect",
        "module_session_id": ws.lastModuleSessionId
    }
},[
    responses.pending.executionStarted,
    responses.ok.default
]);