ws.tokens["profile_id"] = 1
ws.tokens["db_type"] = "MySQL"
ws.tokens["folder_path"] = "tests"
ws.tokens["types"] = [{ "name": "Schema", "type": "CATALOG_OBJECT" },
{ "name": "User Variable", "type": "CATALOG_OBJECT" },
{ "name": "User", "type": "CATALOG_OBJECT" },
{ "name": "Engine", "type": "CATALOG_OBJECT" },
{ "name": "Plugin", "type": "CATALOG_OBJECT" },
{ "name": "Character Set", "type": "CATALOG_OBJECT" },
{ "name": "Table", "type": "SCHEMA_OBJECT" },
{ "name": "View", "type": "SCHEMA_OBJECT" },
{ "name": "Routine", "type": "SCHEMA_OBJECT" },
{ "name": "Event", "type": "SCHEMA_OBJECT" },
{ "name": "Trigger", "type": "TABLE_OBJECT" },
{ "name": "Foreign Key", "type": "TABLE_OBJECT" },
{ "name": "Index", "type": "TABLE_OBJECT" }]
ws.tokens["schema"] = "mysql"

ws.log("Executing mysql metadata tests")

ws.log("Getting object types")

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_objects_types",
    "args": {
        "module_session_id": ws.lastModuleSessionId
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "result": ws.tokens["types"]
    },
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "done": true
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_catalog_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Schema"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(["information_schema", "mysql", "performance_schema"], 0)
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
    "command": "gui.db.get_catalog_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Schema",
        "filter": "mysql"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ["mysql"]
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
    "command": "gui.db.get_catalog_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "User Variable"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList([], 0)
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
    "command": "gui.db.get_catalog_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "User"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(['root@localhost'], 0)
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
    "command": "gui.db.get_catalog_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Engine"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(['InnoDB', 'MyISAM'], 0)
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
    "command": "gui.db.get_catalog_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Plugin"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(["binlog"], 0)
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(["mysql_native_password"], 0)
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
    "command": "gui.db.get_catalog_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Character Set"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList([], 0)
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(["utf8mb4"], 0)
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
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Schema",
        "name": "mysql"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": { "name": "mysql" }
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
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Schema",
        "name": "_user_story_mysql_schema_"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The schema '_user_story_mysql_schema_' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId
    }
])


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "User Variable",
        "name": "var"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The user variable 'var' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "User",
        "name": "root@localhost"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": { "name": "root@localhost" }
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
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "User",
        "name": "_user_story_user_@localhost"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The user '_user_story_user_@localhost' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Engine",
        "name": "InnoDB"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": { "name": "InnoDB" }
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
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Engine",
        "name": "_user_story_engine_"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The engine '_user_story_engine_' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Plugin",
        "name": "sha256_password"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": { "name": "sha256_password" }
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
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Plugin",
        "name": "_user_story_plugin_"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The plugin '_user_story_plugin_' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Character Set",
        "name": "ascii"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": { "name": "ascii" }
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
    "command": "gui.db.get_catalog_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Character Set",
        "name": "_user_story_character_set_"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Execution started..."
        }
    },
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The character set '_user_story_character_set_' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId
    }
])
