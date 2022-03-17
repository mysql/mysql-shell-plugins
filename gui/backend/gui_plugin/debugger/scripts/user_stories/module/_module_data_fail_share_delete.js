var lib = ws.tokens.lib
lib.login.login.params = {
    "user": "success_admin2"
}
await ws.execute(lib.login.login.file)

ws.tokens['admin2_active_profile_id'] = ws.lastResponse["active_profile"]["id"]

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
    "command": "gui.modules.get_data_content",
    "args": {
        "id": ws.tokens['module_data_id1']
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "ERROR",
        "msg": ws.matchRegexp("User have no privileges for data id '\\d+'.")
    },
    "request_id": ws.lastGeneratedRequestId,
}])


await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data_to_profile",
    "args": {
        "id": ws.tokens['module_data_id2'],
        "profile_id": ws.tokens['admin2_active_profile_id'],
        "read_only": 1,
        "tree_identifier": "SQLEditorPersonalScriptsTree",
        "folder_path": "/admin2_new_test_path"
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
    "command": "gui.users.add_profile",
    "args": {
        "user_id": ws.tokens['admin2_id'],
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

ws.tokens['admin2_profile_id'] = ws.lastResponse['result']['id']

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data_to_profile",
    "args": {
        "id": ws.tokens['module_data_id2'],
        "profile_id": ws.tokens['admin2_profile_id'],
        "read_only": 0,
        "tree_identifier": "SQLEditorPersonalScripts2Tree",
        "folder_path": "/new_admin2_test_path"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "ERROR",
        "msg": "Cannot assign data to profile with higher permission than user has."
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data_to_profile",
    "args": {
        "id": ws.tokens['module_data_id2'],
        "profile_id": ws.tokens['admin2_profile_id'],
        "read_only": 1,
        "tree_identifier": "SQLEditorPersonalScripts2Tree",
        "folder_path": "/new_admin2_test_path"
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
    "command": "gui.modules.update_data",
    "args": {
        "id": ws.tokens['module_data_id2'],
        "caption": "test4",
        "content": "import time; time.sleep(2)",
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "ERROR",
        "msg": "User have no privileges to perform operation."
    },
    "request_id": ws.lastGeneratedRequestId
}])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.users.create_user_group",
    "args": {
        "name": "Test group admin2",
        "description": "Test group to share data for admin2"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "OK",
        "msg": "User group created successfully."
    },
    "request_id": ws.lastGeneratedRequestId
}])

ws.tokens['user_group_id2'] = ws.lastResponse['id']

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.users.add_user_to_group",
    "args": {
        "member_id": ws.tokens['admin2_id'],
        "group_id": ws.tokens['user_group_id2'],
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
        "member_id": ws.tokens['admin1_id'],
        "group_id": ws.tokens['user_group_id2']
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
        "user_group_id": ws.tokens['user_group_id2'],
        "read_only": 0,
        "tree_identifier": "SQLEditorSharedScripts2Tree",
        "folder_path": "/test_admin2_group_path"
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "ERROR",
        "msg": "Cannot share data with higher permission than user has."
    },
    "request_id": ws.lastGeneratedRequestId
}])


await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.share_data_to_user_group",
    "args": {
        "id": ws.tokens['module_data_id2'],
        "user_group_id": ws.tokens['user_group_id2'],
        "read_only": 1,
        "tree_identifier": "SQLEditorSharedScripts2Tree",
        "folder_path": "/test_admin2_group_path"
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
    "command": "gui.modules.delete_data",
    "args": {
        "id": ws.tokens['module_data_id1'],
        "folder_id": 4
    },
    "request_id": ws.generateRequestId()
}, [{
    "request_state": {
        "type": "ERROR",
        "msg": ws.matchRegexp("User have no privileges for data id '\\d+'.")
    },
    "request_id": ws.lastGeneratedRequestId
}])
