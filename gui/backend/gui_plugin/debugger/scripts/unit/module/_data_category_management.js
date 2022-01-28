var responses = ws.tokens.responses

// Verify initial values
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {
        "name": "Script",
        "module_id": "sqleditor"
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [],
    })
])

//  Add a new data category to the module
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data_category",
    "args": {
        "module_id": "sqleditor",
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
        "name": "MyDataCategory",
        "module_id": "sqleditor"
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
        "name": "MyDataCategory",
        "module_id": "sqleditor"
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [
            {"id": 1, "name": "MyDataCategory", "parent_category_id": null}
        ],
    })
])

// List all root categories for sqleditor module
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {
        "module_id": "sqleditor"
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [
            {"id": 1, "name": "MyDataCategory", "parent_category_id": null}
        ],
    })
])

// List all root categories for shell module
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {
        "module_id": "shell"
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [],
    })
])

//  verify it was not added to another module too
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {
        "name": "MyDataCategory",
        "module_id": "shell"
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [],
    })
])

//  Add an existing data category to the module
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.add_data_category",
    "args": {
        "module_id": "sqleditor",
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
        "module_id": "sqleditor",
        "name": "MyDataCategory"
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [{"id": 1, "name": "MyDataCategory", "parent_category_id": null}],
    })
])

// Require API to remove folder
// await ws.sendAndValidate({
//     "request": "execute",
//     "command": "gui.modules.add_data",
//     "args": {
//         "module_id": "sqleditor",
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
//         "module_id": "sqleditor",
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

//  Remove an existing data category from the module
await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.remove_data_category",
    "args": {
        "category_id": 1 // MyDataCategory
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "request_state": { "msg": "" }
    })
])

await ws.sendAndValidate({
    "request": "execute",
    "command": "gui.modules.list_data_categories",
    "args": {
        "module_id": "sqleditor",
        "name": "MyDataCategory"
    },
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
        "category_id": 1 // MyDataCategory
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
    "command": "gui.modules.list_data_categories",
    "args": {
        "module_id": "sqleditor",
        "name": "MyDataCategory"
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [],
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
        "module_id": "sqleditor",
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
    "command": "gui.modules.list_data_categories",
    "args": {
        "module_id": "sqleditor",
        "name": "MyDataCategory"
    },
    "request_id": ws.generateRequestId()
}, [
    Object.assign(Object(), responses.ok.default, {
        "result": [{"id": 1, "name": "MyDataCategory", "parent_category_id": null}],
    })
])
