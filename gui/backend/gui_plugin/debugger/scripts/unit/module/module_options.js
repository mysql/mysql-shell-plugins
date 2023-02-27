ws.tokens["module_option_1"] = { 'test_option': 10 }
ws.tokens["module_option_2"] = { 'test_option': 20 }
ws.tokens["module_option_3"] = { 'test_option': 30 }

// Setting option for sqleditor

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data_category",
    "args": {
        "name": "SQL Editor Module Option"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ""
    },
    "result": ws.matchRegexp("\d"),
    "request_id": ws.lastGeneratedRequestId
}])

ws.tokens['category_sqleditor_id'] = ws.lastResponse['result']

await ws.validateLastResponse({
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
})

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data",
    "args": {
        "caption": "SQL Editor Options",
        "content": ws.tokens["module_option_1"],
        "data_category_id": ws.tokens['category_sqleditor_id'],
        "tree_identifier": "SQLEditorOptionsTree",
        "folder_path": "/Options/sqleditor"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": ws.matchRegexp("\d")
}])

ws.tokens['module_data_sqleditor_id'] = ws.lastResponse['result']

ws.validateLastResponse({
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
})

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data",
    "args": {
        "folder_id": 4
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": [{
        "id": ws.tokens['module_data_sqleditor_id'],
        "data_category_id": ws.tokens['category_sqleditor_id'],
        "caption": "SQL Editor Options",
        "created": ws.ignore,
        "last_update": ws.ignore
    }]
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
    "command": "gui.modules.get_data_content",
    "args": {
        "id": ws.tokens['module_data_sqleditor_id']
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": ws.tokens["module_option_1"]
}, {
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
}])

// Setting option for Shell

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data_category",
    "args": {
        "name": "Shell Module Option"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ""
    },
    "result": ws.matchRegexp("\d"),
    "request_id": ws.lastGeneratedRequestId
}])

ws.tokens['category_shell_id'] = ws.lastResponse['result']

await ws.validateLastResponse({
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
})

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data",
    "args": {
        "caption": "Shell Options",
        "content": ws.tokens["module_option_1"],
        "data_category_id": ws.tokens['category_shell_id'],
        "tree_identifier": "ShellOptionsTree",
        "folder_path": "/Options/shell"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": ws.matchRegexp("\d")
}])

ws.tokens['module_data_shell_id'] = ws.lastResponse['result']

ws.validateLastResponse({
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
})

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data",
    "args": {
        "folder_id": 10
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": [{
        "id": ws.tokens['module_data_shell_id'],
        "data_category_id": ws.tokens['category_shell_id'],
        "caption": "Shell Options",
        "created": ws.ignore,
        "last_update": ws.ignore
    }]
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
    "command": "gui.modules.get_data_content",
    "args": {
        "id": ws.tokens['module_data_shell_id']
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": ws.tokens["module_option_1"]
}, {
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
}])

// Updating option for sqleditor

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.update_data",
    "args": {
        "id": ws.tokens['module_data_sqleditor_id'],
        "content": ws.tokens["module_option_2"],
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ws.ignore
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

// Updating option for shell

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.update_data",
    "args": {
        "id": ws.tokens['module_data_shell_id'],
        "content": ws.tokens["module_option_3"],
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ws.ignore
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

// Getting options for sqleditor

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.get_data_content",
    "args": {
        "id": ws.tokens['module_data_sqleditor_id']
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": ws.tokens["module_option_2"]
}, {
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
}])

// Getting option for shell

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.get_data_content",
    "args": {
        "id": ws.tokens['module_data_shell_id']
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": ws.tokens["module_option_3"]
}, {
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId,
    "done": true
}])

// Getting option for not existing module id

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.get_data_content",
    "args": {
        "id": 9999
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "ERROR",
        "msg": "There is no data for the given module id: 9999."
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.delete_data",
    "args": {
        "id": ws.tokens['module_data_sqleditor_id'],
        "folder_id": 4
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ws.ignore
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
    "command": "gui.modules.delete_data",
    "args": {
        "id": ws.tokens['module_data_sqleditor_id'],
        "folder_id": 6
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ws.ignore
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
    "command": "gui.modules.delete_data",
    "args": {
        "id": ws.tokens['module_data_shell_id'],
        "folder_id": 10
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ws.ignore
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
    "command": "gui.modules.delete_data",
    "args": {
        "id": ws.tokens['module_data_shell_id'],
        "folder_id": 12
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "PENDING",
        "msg": ws.ignore
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
