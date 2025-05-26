# Copyright (c) 2025, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.list_folder_paths",
    "args": {
        "parent_folder_id": 1
    }
},
[
    {
    'request_state': {
        'type': 'PENDING',
        'msg': ''
        },
    'result': [],
    'request_id': ws.lastGeneratedRequestId,
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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_folder_path",
    "args": {
        "profile_id": 1,
        "caption": "develop"
    }
},
[
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.ignore
    }
])

ws.tokens['develop_folder_path_id'] = ws.lastResponse['result']['id']

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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.list_folder_paths",
    "args": {
        "parent_folder_id": 1,
    }
},
[
    {
    'request_state': {
        'type': 'PENDING',
        'msg': ''
        },
    'result': [
            {
                "id": ws.tokens['develop_folder_path_id'],
                "parent_folder_id": 1,
                "caption": "develop",
                "index": ws.ignore,
                "settings": {}
            }
        ],
    'request_id': ws.lastGeneratedRequestId,
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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_folder_path",
    "args": {
        "profile_id": 1,
        "caption": "test",
    }
},
[
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.ignore
    }
])

ws.tokens['test_folder_path_id'] = ws.lastResponse['result']['id']

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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_folder_path",
    "args": {
        "profile_id": 1,
        "parent_folder_id": ws.tokens['develop_folder_path_id'],
        "caption": "sub_develop",
    }
},
[
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.ignore
    }
])

ws.tokens['sub_develop_folder_path_id'] = ws.lastResponse['result']['id']

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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.list_folder_paths",
    "args": {
        "parent_folder_id": 1,
    }
},
[
    {
    'request_state': {
        'type': 'PENDING',
        'msg': ''
        },
    'result': [
            {
                "id": ws.tokens['develop_folder_path_id'],
                "parent_folder_id": 1,
                "caption": "develop",
                "index": ws.ignore,
                "settings": {}
            },
            {
                "id": ws.tokens['test_folder_path_id'],
                "parent_folder_id": 1,
                "caption": "test",
                "index": ws.ignore,
                "settings": {}
            }
        ],
    'request_id': ws.lastGeneratedRequestId,
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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.list_folder_paths",
    "args": {
        "parent_folder_id": ws.tokens['develop_folder_path_id'],
    }
},
[
    {
    'request_state': {
        'type': 'PENDING',
        'msg': ''
        },
    'result': [
            {
                "id": ws.tokens['sub_develop_folder_path_id'],
                "parent_folder_id": ws.tokens['develop_folder_path_id'],
                "caption": "sub_develop",
                "index": ws.ignore,
                "settings": {}
            }
        ],
    'request_id': ws.lastGeneratedRequestId,
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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_folder_path",
    "args": {
        "profile_id": 1,
        "parent_folder_id": ws.tokens['test_folder_path_id'],
        "caption": "subfolder1",
    }
},
[
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.ignore
    }
])

ws.tokens['subfolder1_id'] = ws.lastResponse['result']['id']

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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_folder_path",
    "args": {
        "profile_id": 1,
        "parent_folder_id": ws.tokens['test_folder_path_id'],
        "caption": "subfolder2",
    }
},
[
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.ignore
    }
])

ws.tokens['subfolder2_id'] = ws.lastResponse['result']['id']

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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_folder_path",
    "args": {
        "profile_id": 1,
        "parent_folder_id": ws.tokens['test_folder_path_id'],
        "caption": "subfolder3",
    }
},
[
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.ignore
    }
])

ws.tokens['subfolder3_id'] = ws.lastResponse['result']['id']

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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.list_folder_paths",
    "args": {
        "parent_folder_id": ws.tokens['test_folder_path_id'],
    }
},
[
    {
    'request_state': {
        'type': 'PENDING',
        'msg': ''
        },
    'result': [
            {
                "id": ws.tokens['subfolder1_id'],
                "parent_folder_id": ws.tokens['test_folder_path_id'],
                "caption": "subfolder1",
                "index": ws.ignore,
                "settings": {}
            },
            {
                "id": ws.tokens['subfolder2_id'],
                "parent_folder_id": ws.tokens['test_folder_path_id'],
                "caption": "subfolder2",
                "index": ws.ignore,
                "settings": {}
            },
            {
                "id": ws.tokens['subfolder3_id'],
                "parent_folder_id": ws.tokens['test_folder_path_id'],
                "caption": "subfolder3",
                "index": ws.ignore,
                "settings": {}
            }
        ],
    'request_id': ws.lastGeneratedRequestId,
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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.rename_folder_path",
    "args": {
        "folder_path_id": ws.tokens['develop_folder_path_id'],
        "new_caption": "development"
    }
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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.rename_folder_path",
    "args": {
        "folder_path_id": ws.tokens['subfolder1_id'],
        "new_caption": "subfolder_one"
    }
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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.rename_folder_path",
    "args": {
        "folder_path_id": ws.tokens['subfolder2_id'],
        "new_caption": "subfolder_two"
    }
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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.list_folder_paths",
    "args": {
        "parent_folder_id": 1,
    }
}, [{
    'request_state': {
        'type': 'PENDING',
        'msg': ''
    },
    'result': [
        {
            "id": ws.tokens['develop_folder_path_id'],
            "parent_folder_id": 1,
            "caption": "development",
            "index": ws.ignore,
            "settings": {}
        },
        {
            "id": ws.tokens['test_folder_path_id'],
            "parent_folder_id": 1,
            "caption": "test",
            "index": ws.ignore,
            "settings": {}
        }
    ],
    'request_id': ws.lastGeneratedRequestId,
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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.list_folder_paths",
    "args": {
        "parent_folder_id": ws.tokens['test_folder_path_id'],
    }
}, [{
    'request_state': {
        'type': 'PENDING',
        'msg': ''
    },
    'result': [
        {
            "id": ws.tokens['subfolder1_id'],
            "parent_folder_id": ws.tokens['test_folder_path_id'],
            "caption": "subfolder_one",
            "index": ws.ignore,
            "settings": {}
        },
        {
            "id": ws.tokens['subfolder2_id'],
            "parent_folder_id": ws.tokens['test_folder_path_id'],
            "caption": "subfolder_two",
            "index": ws.ignore,
            "settings": {}
        },
        {
            "id": ws.tokens['subfolder3_id'],
            "parent_folder_id": ws.tokens['test_folder_path_id'],
            "caption": "subfolder3",
            "index": ws.ignore,
            "settings": {}
        }
    ],
    'request_id': ws.lastGeneratedRequestId,
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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.remove_folder_path",
    "args": {
        "folder_path_id": ws.tokens['sub_develop_folder_path_id']
    }
},
[
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "done": true
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.remove_folder_path",
    "args": {
        "folder_path_id": ws.tokens['develop_folder_path_id']
    }
},
[
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "done": true
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.remove_folder_path",
    "args": {
        "folder_path_id": ws.tokens['test_folder_path_id']
    }
},
[
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "done": true
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.list_folder_paths",
    "args": {
        "parent_folder_id": 1
    }
},
[
    {
    'request_state': {
        'type': 'PENDING',
        'msg': ''
        },
    'result': [],
    'request_id': ws.lastGeneratedRequestId,
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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_folder_path",
    "args": {
        "profile_id": 1,
        "caption": "test_recursive",
    }
},
[
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.ignore
    }
])

ws.tokens['recursive_folder_id'] = ws.lastResponse['result']['id']

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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_folder_path",
    "args": {
        "profile_id": 1,
        "parent_folder_id": ws.tokens['recursive_folder_id'],
        "caption": "sub_recursive1",
    }
},
[
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.ignore
    }
])

ws.tokens['sub_recursive1_id'] = ws.lastResponse['result']['id']

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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_folder_path",
    "args": {
        "profile_id": 1,
        "parent_folder_id": ws.tokens['sub_recursive1_id'],
        "caption": "subsub_recursive1",
    }
},
[
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.ignore
    }
])

ws.tokens['subsub_recursive1_id'] = ws.lastResponse['result']['id']

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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.list_folder_paths",
    "args": {
        "parent_folder_id": ws.tokens['recursive_folder_id'],
    }
},
[
    {
    'request_state': {
        'type': 'PENDING',
        'msg': ''
        },
    'result': [
            {
                "id": ws.tokens['sub_recursive1_id'],
                "parent_folder_id": ws.tokens['recursive_folder_id'],
                "caption": "sub_recursive1",
                "index": ws.ignore,
                "settings": {}
            }
        ],
    'request_id': ws.lastGeneratedRequestId,
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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.list_folder_paths",
    "args": {
        "parent_folder_id": ws.tokens['recursive_folder_id'],
        "recursive": true
    }
},
[
    {
    'request_state': {
        'type': 'PENDING',
        'msg': ''
        },
    'result': [
            {
                "id": ws.tokens['sub_recursive1_id'],
                "parent_folder_id": ws.tokens['recursive_folder_id'],
                "caption": "sub_recursive1",
                "index": ws.ignore,
                "settings": {}
            },
            {
                "id": ws.tokens['subsub_recursive1_id'],
                "parent_folder_id": ws.tokens['sub_recursive1_id'],
                "caption": "subsub_recursive1",
                "index": ws.ignore,
                "settings": {}
            }
        ],
    'request_id': ws.lastGeneratedRequestId,
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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.add_db_connection",
    "args": {
        "profile_id": 1,
        "folder_path_id": ws.tokens['recursive_folder_id'],
        "connection": {
            "db_type": "MySQL",
            "caption": "Test MySQL Connection",
            "description": "Connection for testing list_all function",
            "options": {
                "uri": "mysql://user@localhost:3306/test"
            }
        }
    }
},
[
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.ignore
    }
])

ws.tokens['test_connection_id'] = ws.lastResponse['result'][0]

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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.list_all",
    "args": {
        "profile_id": 1,
        "folder_id": ws.tokens['recursive_folder_id']
    }
},
[
    {
    'request_state': {
        'type': 'PENDING',
        'msg': ''
        },
    'result': [
            {
                "id": ws.tokens['sub_recursive1_id'],
                "caption": "sub_recursive1",
                "description": null,
                "db_type": null,
                "options": null,
                "settings": {},
                "index": ws.ignore,
                "type": "folder"
            },
            {
                "id": ws.tokens['test_connection_id'],
                "caption": "Test MySQL Connection",
                "description": "Connection for testing list_all function",
                "db_type": "MySQL",
                "options": ws.ignore,
                "settings": ws.ignore,
                "index": ws.ignore,
                "type": "connection"
            }
        ],
    'request_id': ws.lastGeneratedRequestId,
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
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.remove_db_connection",
    "args": {
        "profile_id": 1,
        "connection_id": ws.tokens['test_connection_id']
    }
},
[
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "done": true
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.remove_folder_path",
    "args": {
        "folder_path_id": ws.tokens['subsub_recursive1_id']
    }
},
[
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "done": true
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.remove_folder_path",
    "args": {
        "folder_path_id": ws.tokens['sub_recursive1_id']
    }
},
[
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "done": true
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db_connections.remove_folder_path",
    "args": {
        "folder_path_id": ws.tokens['recursive_folder_id']
    }
},
[
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "done": true
    }
])