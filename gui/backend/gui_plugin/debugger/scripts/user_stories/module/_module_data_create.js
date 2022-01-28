var lib = ws.tokens.lib
await ws.execute(lib.login.admin.file)

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data_category",
    "args": {
        "module_id": "gui.sqleditor",
        "name": "Script"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId
}])

ws.tokens['category_script_id'] = ws.lastResponse['result']

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data",
    "args": {
        "caption": "test",
        "content": "import time; time.sleep(1)",
        "data_category_id": ws.tokens['category_script_id'],
        "tree_identifier": "SQLEditorScriptsTree",
        "folder_path": "test_path",
    },
    "request_id": ws.generateRequestId()
},[{
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId
}])

ws.tokens['module_data_id1'] = ws.lastResponse['result']

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data_category",
    "args": {
        "module_id": "gui.sqleditor",
        "name": "Python"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId
}])

ws.tokens['category_python_id'] = ws.lastResponse['result']

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data",
    "args": {
        "caption": "test python script",
        "content": "import time; time.sleep(100)",
        "data_category_id": ws.tokens['category_python_id'],
        "tree_identifier": "SQLEditorScriptsTree",
        "folder_path": "test_path"
    },
    "request_id": ws.generateRequestId()
},[{
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId
}])

ws.tokens['module_data_tmp_id'] = ws.lastResponse['result']

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data",
    "args": {
        "folder_id": 3
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": [{"id": ws.tokens['module_data_id1'], "data_category_id": ws.tokens['category_script_id'], "caption": "test", "created": ws.ignore, "last_update": ws.ignore},
             {"id": ws.tokens['module_data_tmp_id'], "data_category_id": ws.tokens['category_python_id'] , "caption": "test python script", "created": ws.ignore, "last_update": ws.ignore}]
}])


// Delete tmp data
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.delete_data",
    "args": {
        "id": ws.tokens['module_data_tmp_id'],
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
        "id": ws.tokens['module_data_tmp_id'],
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
    "command": "gui.modules.get_data_content",
    "args": {
        "id": ws.tokens['module_data_id1']
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": "import time; time.sleep(1)"
}])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.users.get_user_id",
    "args": {
        "username": "admin1"
    }
}, [{
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "Successfully obtained user id."
    },
    "id": ws.matchRegexp("\\d+"),
}])

ws.tokens['admin1_id'] = ws.lastResponse['id']

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.users.get_user_id",
    "args": {
        "username": "admin2"
    }
}, [{
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": "Successfully obtained user id."
    },
    "id": ws.matchRegexp("\\d+"),
}])

ws.tokens['admin2_id'] = ws.lastResponse['id']

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.users.add_profile",
    "args": {
        "user_id": ws.tokens['admin1_id'],
        "profile": {
            "name": "Test profile",
            "description": "This is test profile for admin user.",
            "options": {}
        }
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId
}])

ws.tokens['admin1_profile_id'] = ws.lastResponse['result']['profile_id']

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data_to_profile",
    "args": {
        "id": ws.tokens['module_data_id1'],
        "profile_id": ws.tokens['admin1_profile_id'],
        "read_only": 0,
        "tree_identifier": "SQLEditorScriptsTree2",
        "folder_path": "/new_test_path"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data",
    "args": {
        "caption": "test2",
        "content": "import time; time.sleep(1)",
        "data_category_id": ws.tokens['category_script_id'],
        "tree_identifier": "SQLEditorDevScriptsTree",
        "folder_path": "test_path2",
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId
}])

ws.tokens['module_data_id2'] = ws.lastResponse['result']

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data",
    "args": {
        "folder_id": 4
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": [{"id": ws.tokens['module_data_id1'], "data_category_id": ws.tokens['category_script_id'], "caption": "test", "created": ws.ignore, "last_update": ws.ignore}]
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data",
    "args": {
        "folder_id": 10
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": [{"id": ws.tokens['module_data_id2'], "data_category_id": ws.tokens['category_script_id'], "caption": "test2", "created": ws.ignore, "last_update": ws.ignore}]
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.get_data_content",
    "args": {
        "id": ws.tokens['module_data_id2']
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": "import time; time.sleep(1)"
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.update_data",
    "args": {
        "id": ws.tokens['module_data_id2'],
        "caption": "test3",
        "content": "import time; time.sleep(5)",
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
    "command": "gui.modules.get_data_content",
    "args": {
        "id": ws.tokens['module_data_id2']
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": "import time; time.sleep(5)"
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.users.create_user_group",
    "args": {
        "name": "Test group",
        "description": "Test group to share data"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": "User group created successfully."
    },
    "request_id": ws.lastGeneratedRequestId
}])

ws.tokens['user_group_id'] = ws.lastResponse['id']

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.users.add_user_to_group",
    "args": {
        "member_id": ws.tokens['admin1_id'],
        "group_id": ws.tokens['user_group_id'],
        "owner": 1
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": "User has been added to group successfully."
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.users.add_user_to_group",
    "args": {
        "member_id": ws.tokens['admin2_id'],
        "group_id": ws.tokens['user_group_id']
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": "User has been added to group successfully."
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.share_data_to_user_group",
    "args": {
        "id": ws.tokens['module_data_id2'],
        "user_group_id": ws.tokens['user_group_id'],
        "read_only": 1,
        "tree_identifier": "SQLEditorSharedScriptsTree",
        "folder_path": "/test_group_path"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data",
    "args": {
        "folder_id": 12
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": [{"id": ws.tokens['module_data_id2'], "data_category_id": ws.tokens['category_script_id'], "caption": "test3", "created": ws.ignore, "last_update": ws.ignore}]
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.get_profile_data_tree",
    "args": {
        "tree_identifier": "SQLEditorScriptsTree"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": [{"id": 1, "caption": "SQLEditorScriptsTree", "parent_folder_id": null},
               {"id": 3, "caption": "test_path", "parent_folder_id": 1}]
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.get_user_group_data_tree",
    "args": {
        "tree_identifier": "SQLEditorScriptsTree"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": [{"id": 2, "caption": "SQLEditorScriptsTree", "parent_folder_id": null},
               {"id": 4, "caption": "test_path", "parent_folder_id": 2}]
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.get_profile_tree_identifiers",
    "args": {},
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": [{"tree_identifier": "SQLEditorScriptsTree"},
               {"tree_identifier": "SQLEditorDevScriptsTree"}]
}])

await ws.execute(lib.login.logout.file)