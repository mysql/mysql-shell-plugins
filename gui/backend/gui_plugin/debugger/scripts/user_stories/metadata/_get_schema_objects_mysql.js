responses = ws.tokens['responses']
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
{ "name": "Primary Key", "type": "TABLE_OBJECT" },
{ "name": "Index", "type": "TABLE_OBJECT" },
{ "name": "Column", "type": "TABLE_OBJECT" }]

// We're assuming that schema `test_user_story` exists and contains all object listed in script below:
// CREATE DATABASE  IF NOT EXISTS `test_user_story`;
// USE `test_user_story`;
// ​
// CREATE TABLE `categories` (
//   `categoryID` int NOT NULL AUTO_INCREMENT,
//   `categoryName` varchar(100) NOT NULL,
//   PRIMARY KEY (`categoryID`)
// ) ENGINE=InnoDB;
// ​
// DELIMITER $$
// CREATE DEFINER=`root`@`localhost` TRIGGER `categories_AFTER_INSERT` AFTER INSERT ON `categories` FOR EACH ROW BEGIN
// SET @test=1;
// END$$
// DELIMITER ;
// ​
// CREATE TABLE `products` (
//   `productID` int NOT NULL AUTO_INCREMENT,
//   `productName` varchar(100) NOT NULL,
//   `categoryID` int DEFAULT NULL,
//   PRIMARY KEY (`productID`),
//   KEY `fk_category` (`categoryID`),
//   CONSTRAINT `fk_category` FOREIGN KEY (`categoryID`) REFERENCES `categories` (`categoryID`)
// ) ENGINE=InnoDB;
// ​
// ​
// CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `view_products`
// AS select `productName` from `products`;
// ​
// DELIMITER $$
// CREATE DEFINER=`root`@`localhost` PROCEDURE `procedure_get_names`()
// BEGIN
// SELECT productName from products;
// END$$
// DELIMITER ;
// ​
// DELIMITER $$
// CREATE DEFINER=`root`@`localhost` FUNCTION `function_count`() RETURNS int
//     NO SQL
// BEGIN
// RETURN 1;
// END$$
// DELIMITER ;
ws.tokens["schema"] = "test_user_story"
ws.tokens["table"] = "products"

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
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Table",
        "schema_name": ws.tokens["schema"]
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(["categories", "products", "test_no_pk_name", "test_pk_table"])
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
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Table",
        "schema_name": ws.tokens["schema"],
        "filter": "categories"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ["categories"]
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
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "View",
        "schema_name": ws.tokens["schema"]
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(["view_products"])
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
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "View",
        "schema_name": ws.tokens["schema"],
        "filter": "view_products"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ["view_products"]
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
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Routine",
        "schema_name": ws.tokens["schema"]
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(["function_count", "procedure_get_names"])
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
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Routine",
        "schema_name": ws.tokens["schema"],
        "filter": "function_count"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ["function_count"]
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
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Routine",
        "schema_name": ws.tokens["schema"],
        "routine_type": "procedure"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ["procedure_get_names"]
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
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Routine",
        "schema_name": ws.tokens["schema"],
        "routine_type": "procedure",
        "filter": "procedure_get_names"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ["procedure_get_names"]
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
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Routine",
        "schema_name": ws.tokens["schema"],
        "routine_type": "function"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ["function_count"]
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
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Routine",
        "schema_name": ws.tokens["schema"],
        "routine_type": "function",
        "filter": "function_count"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ["function_count"]
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
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Routine",
        "schema_name": ws.tokens["schema"],
        "routine_type": "function",
        "filter": ""
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": []
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
    "command": "gui.db.get_schema_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Event",
        "schema_name": ws.tokens["schema"]
    }
}, [
    responses.pending.executionStarted,
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
    "command": "gui.db.get_schema_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Table",
        "schema_name": ws.tokens["schema"],
        "name": "categories"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": { "name": "categories" }
    },
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": { "columns": ws.matchList(["categoryID", "categoryName"]) }
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
    "command": "gui.db.get_schema_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Table",
        "schema_name": ws.tokens["schema"],
        "name": "_user_story_table_"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The table 'test_user_story._user_story_table_' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_schema_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "View",
        "schema_name": ws.tokens["schema"],
        "name": "view_products"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": { "name": "view_products" }
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
    "command": "gui.db.get_schema_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "View",
        "schema_name": ws.tokens["schema"],
        "name": "users"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The view 'test_user_story.users' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_schema_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Routine",
        "schema_name": ws.tokens["schema"],
        "name": "procedure_get_names"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": { "name": "procedure_get_names" }
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
    "command": "gui.db.get_schema_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Routine",
        "schema_name": ws.tokens["schema"],
        "name": "users"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The routine 'test_user_story.users' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_schema_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Event",
        "schema_name": ws.tokens["schema"],
        "name": "event"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The event 'test_user_story.event' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Trigger",
        "schema_name": ws.tokens["schema"],
        "table_name": "categories",
        "name": "categories_AFTER_INSERT"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": { "name": "categories_AFTER_INSERT" }
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
    "command": "gui.db.get_table_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Trigger",
        "schema_name": ws.tokens["schema"],
        "table_name": "categories",
        "name": "after_insert"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The trigger 'categories.after_insert' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Foreign Key",
        "schema_name": ws.tokens["schema"],
        "table_name": "products",
        "name": "fk_category"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": { "name": "fk_category" }
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
    "command": "gui.db.get_table_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Foreign Key",
        "schema_name": ws.tokens["schema"],
        "table_name": "categories",
        "name": "fk_user"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The foreign key 'categories.fk_user' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Index",
        "schema_name": ws.tokens["schema"],
        "table_name": "products",
        "name": "fk_category"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": { "name": "fk_category" }
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
    "command": "gui.db.get_table_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Index",
        "schema_name": ws.tokens["schema"],
        "table_name": "categories",
        "name": "_user_story_index_"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "ERROR",
            "msg": "The index 'categories._user_story_index_' does not exist."
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_schema_object",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "schema_name": "",
        "type": "Schema",
        "name": "mysql,"
    }
}, [
    {
        "request_state": {
            "type": "ERROR",
            "msg": "Unsupported function for type CATALOG_OBJECT (get_schema_object)",
            "source": "MSG",
            "code": 1204
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_schema_objects",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Table",
        "schema_name": "test_user_story"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ["categories"]
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
    "command": "gui.db.get_schema_objects",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "View",
        "schema_name": "test_user_story"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ["view_products"]
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
    "command": "gui.db.get_schema_objects",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Routine",
        "schema_name": "test_user_story"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": [
            { "name": "function_count", "type": "FUNCTION", "language": "SQL"},
            { "name": "procedure_get_names", "type": "PROCEDURE", "language": "SQL"}
        ]
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
    "command": "gui.db.get_schema_objects",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Event",
        "schema_name": "test_user_story"
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": []
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
