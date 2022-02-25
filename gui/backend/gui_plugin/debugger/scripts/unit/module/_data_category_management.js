var responses = ws.tokens.responses

// Verify initial values
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {},
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [{'id': 1, 'name': 'Text', 'parent_category_id': None}],
    })
])

// Verify initial values
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {
        "category_id": 1
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result":  [{'id': 1, 'name': 'Text', 'parent_category_id': None},
                    {'id': 2, 'name': 'Script', 'parent_category_id': 1},
                    {'id': 3, 'name': 'JSON', 'parent_category_id': 1},
                    {'id': 4, 'name': 'MySQL Script', 'parent_category_id': 2},
                    {'id': 5, 'name': 'Python Script', 'parent_category_id': 2},
                    {'id': 6, 'name': 'JavaScript Script', 'parent_category_id': 2},
                    {'id': 7, 'name': 'TypeScript Script', 'parent_category_id': 2},
                    {'id': 8, 'name': 'SQLite Script', 'parent_category_id': 2}]
    })
])

// Verify initial values
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {
        "category_id": 2
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result":  [{'id': 2, 'name': 'Script', 'parent_category_id': 1},
                    {'id': 4, 'name': 'MySQL Script', 'parent_category_id': 2},
                    {'id': 5, 'name': 'Python Script', 'parent_category_id': 2},
                    {'id': 6, 'name': 'JavaScript Script', 'parent_category_id': 2},
                    {'id': 7, 'name': 'TypeScript Script', 'parent_category_id': 2},
                    {'id': 8, 'name': 'SQLite Script', 'parent_category_id': 2}]
    })
])

// Verify initial values
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {
        "category_id": 8
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result":  [{'id': 8, 'name': 'SQLite Script', 'parent_category_id': 2}]
    })
])

//  Add a new data category with empty name
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data_category",
    "args": {
        "name": ""
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.error.default, {
        "request_state": { "msg": "Parameter 'name' cannot be empty." }
    })
])

//  Add a new data category to the module
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data_category",
    "args": {
        "name": "MyDataCategory"
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "request_state": { "msg": "" }
    })
])

ws.tokens['data_category_id1'] = ws.lastResponse['result']

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.get_data_category_id",
    "args": {
        "name": "MyDataCategory"
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "request_state": { "msg": "" },
        "result": ws.tokens['data_category_id1']
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {
        "category_id": ws.tokens['data_category_id1']
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [
            {"id": 101, "name": "MyDataCategory", "parent_category_id": null}
        ],
    })
])

// List all root categories
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {},
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [{'id': 1, 'name': 'Text', 'parent_category_id': None},
                   {"id": 101, "name": "MyDataCategory", "parent_category_id": null}],
    })
])

// List categories for ShellCategory name
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {
        "category_id": 999
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.error.default, {
        "request_state": {
            "msg": "Data category does not exist.",
            "code": 1609
        }
    })
])

//  Add an existing data category
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data_category",
    "args": {
        "name": "MyDataCategory"
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.error.default, {
        "request_state": {
            "msg": "Data category already exists.",
            "code": 1609
        }
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {
        "category_id": ws.tokens['data_category_id1']
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [{"id": 101, "name": "MyDataCategory", "parent_category_id": null}],
    })
])

// Require API to remove folder
// await ws.sendAndValidate({
//     "request": "execute",
//     "command": "gui.modules.add_data",
//     "args": {
//         "data_category_id": 11, //MyDataCategory
//         "name": "test",
//         "folder_path": "/test_path",
//         "content": "import time; time.sleep(1)"
//     },
//     "request_id": ws.generateRequestId()
// },[{
//     "request_state": {
//         "type": "OK",
//         "msg": "Data added successfully."
//     },
//     "request_id": ws.lastGeneratedRequestId
// }])

// ws.tokens['module_data_id'] = ws.lastResponse['module_data_id']

// //  Remove an existing data category from the module
// await ws.sendAndValidate({
//     "request": "execute",
//     "command": "gui.modules.remove_data_category",
//     "args": {
//         "name": "MyDataCategory"
//     },
//     "request_id": ws.generateRequestId()
// }, [
//     Object.assign(Object(), responses.error.default, {
//         "request_state": {
//             "code": 1610,
//             "msg": "Can't delete data category associated with data."
//         }
//     })
// ])

// await ws.sendAndValidate({
//     "request": "execute",
//     "command": "gui.modules.delete_data",
//     "args": {
//         "module_data_id": ws.tokens['module_data_id']
//     },
//     "request_id": ws.generateRequestId()
// }, [{
//     "request_state": {
//         "type": "OK",
//         "msg": ws.ignore
//     },
//     "request_id": ws.lastGeneratedRequestId
// }])

//  Add a new data category
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data_category",
    "args": {
        "name": "MyDataSubCategory",
        "parent_category_id": ws.tokens['data_category_id1']
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "request_state": { "msg": "" }
    })
])

ws.tokens['data_subcategory_id1'] = ws.lastResponse['result']

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.get_data_category_id",
    "args": {
        "name": "MyDataSubCategory"
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "request_state": { "msg": "" },
        "result": ws.tokens['data_subcategory_id1']
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {},
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [{'id': 1, 'name': 'Text', 'parent_category_id': None},
                   {"id": ws.tokens['data_category_id1'], "name": "MyDataCategory", "parent_category_id": null}
        ],
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {
        "category_id": ws.tokens['data_category_id1']
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [
            {"id": ws.tokens['data_category_id1'], "name": "MyDataCategory", "parent_category_id": null},
            {"id": ws.tokens['data_subcategory_id1'], "name": "MyDataSubCategory", "parent_category_id": ws.tokens['data_category_id1']}
        ],
    })
])

//  Remove an existing top data category
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.remove_data_category",
    "args": {
        "category_id": ws.tokens['data_category_id1'] // MyDataCategory
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.error.default, {
        "request_state": {
            "code": 1610,
            "msg": "Can't delete data category associated with sub categories."
        }
    })
])

//  Remove a data category that doesn't exist
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.remove_data_category",
    "args": {
        "category_id": 999 // Non existing category
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.error.default, {
        "request_state": {
            "code": 1609,
            "msg": "Data category does not exist."
        }
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.remove_data_category",
    "args": {
        "category_id": 1
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.error.default, {
        "request_state": {
            "code": 1610,
            "msg": "Can't delete predefined data category."
        }
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {
        "category_id": ws.tokens['data_category_id1']
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [
            {"id": ws.tokens['data_category_id1'], "name": "MyDataCategory", "parent_category_id": null},
            {"id": ws.tokens['data_subcategory_id1'], "name": "MyDataSubCategory", "parent_category_id": ws.tokens['data_category_id1']}
        ],
    })
])

//  Remove an existing sub data category
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.remove_data_category",
    "args": {
        "category_id": ws.tokens['data_subcategory_id1'] // MyDataSubCategory
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "request_state": {
            "msg": ""
        }
    })
])

//  Remove an existing top data category
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.remove_data_category",
    "args": {
        "category_id": ws.tokens['data_category_id1'] // MyDataCategory
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "request_state": {
            "msg": ""
        }
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {
        "category_id": ws.tokens['data_category_id1']
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.error.default, {
        "request_state": {
            "msg": "Data category does not exist.",
            "code": 1609
        }
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {},
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [],
    })
])

//  Remove a data category that doesn't exist any more
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.remove_data_category",
    "args": {
        "category_id": 101 // MyDataCategory
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.error.default, {
        "request_state": {
            "code": 1609,
            "msg": "Data category does not exist."
        }
    })
])

//  Try to remove a stock data category
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.remove_data_category",
    "args": {
        "category_id": 999
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.error.default, {
        "request_state": {
            "code": 1609,
            "msg": "Data category does not exist."
        }
    })
])

//  re-enable data category
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data_category",
    "args": {
        "name": "MyDataCategory"
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "request_state": { "msg": "" }
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.get_data_category_id",
    "args": {
        "name": "MyDataSubCategory"
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.error.default, {
        "request_state": {
            "code": 1609,
            "msg": "Data category does not exist."
        }
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.get_data_category_id",
    "args": {
        "name": "MyDataCategory"
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "request_state": {
            "msg": ""
        },
        "result": ws.tokens['data_category_id1']
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {
        "category_id": ws.tokens['data_category_id1']
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [{"id": ws.tokens['data_category_id1'], "name": "MyDataCategory", "parent_category_id": null}],
    })
])
