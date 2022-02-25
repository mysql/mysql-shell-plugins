var lib = ws.tokens.lib
await ws.execute(lib.login.admin.file)

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.move_data",
    "args": {
        "id": ws.tokens['module_data_id1'],
        "tree_identifier": "SQLEditorScriptsTree",
        "linked_to": "protile",
        "link_id": 1,
        "source_path": "test_path",
        "target_path": "new_target_test_path"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "ERROR",
        "msg": "Parameter 'linked_to' can only take value 'profile' or 'group'."
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.move_data",
    "args": {
        "id": ws.tokens['module_data_id1'],
        "tree_identifier": "SQLEditorScriptsTree",
        "linked_to": "profile",
        "link_id": 1,
        "source_path": "test_path",
        "target_path": "test_path"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "ERROR",
        "msg": "Parameters 'source_path' and 'target_path' are the same."
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.move_data",
    "args": {
        "id": ws.tokens['module_data_id1'],
        "tree_identifier": "",
        "linked_to": "profile",
        "link_id": 1,
        "source_path": "test_path",
        "target_path": "new_target_test_path"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "ERROR",
        "msg": "Parameter 'tree_identifier' cannot be empty."
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.move_data",
    "args": {
        "id": ws.tokens['module_data_id1'],
        "tree_identifier": "SQLEditorScriptsTree",
        "linked_to": "profile",
        "link_id": 1,
        "source_path": "wrong_test_path",
        "target_path": "new_target_test_path"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "ERROR",
        "msg": "Cannot find the given 'source_path'."
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.move_data",
    "args": {
        "id": ws.tokens['module_data_id1'],
        "tree_identifier": "SQLEditorScriptsTreeeee",
        "linked_to": "profile",
        "link_id": 1,
        "source_path": "test_path",
        "target_path": "new_target_test_path"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "ERROR",
        "msg": "Cannot find root folder id for the given 'tree_identifier'."
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.delete_data",
    "args": {
        "id": ws.tokens['module_data_id1'],
        "folder_id": 3
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.delete_data",
    "args": {
        "id": ws.tokens['module_data_id1'],
        "folder_id": 4
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.delete_data",
    "args": {
        "id": ws.tokens['module_data_id1'],
        "folder_id": 6
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.delete_data",
    "args": {
        "id": ws.tokens['module_data_id2'],
        "folder_id": 9
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.delete_data",
    "args": {
        "id": ws.tokens['module_data_id2'],
        "folder_id": 10
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.delete_data",
    "args": {
        "id": ws.tokens['module_data_id2'],
        "folder_id": 12
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.delete_data",
    "args": {
        "id": ws.tokens['module_data_id2'],
        "folder_id": 14
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.delete_data",
    "args": {
        "id": ws.tokens['module_data_id2'],
        "folder_id": 16
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId
}])


await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.delete_data",
    "args": {
        "id": ws.tokens['module_data_id2'],
        "folder_id": 18
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.execute(lib.login.logout.file)