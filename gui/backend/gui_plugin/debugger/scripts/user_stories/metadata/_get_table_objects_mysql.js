responses = ws.tokens['responses']
ws.tokens["profile_id"] = 1
ws.tokens["db_type"] = "MySQL"
ws.tokens["folder_path"] = "tests"
ws.tokens["types"] = [{"name": "Schema",        "type": "CATALOG_OBJECT"},
                      {"name": "User Variable", "type": "CATALOG_OBJECT"},
                      {"name": "User",          "type": "CATALOG_OBJECT"},
                      {"name": "Engine",        "type": "CATALOG_OBJECT"},
                      {"name": "Plugin",        "type": "CATALOG_OBJECT"},
                      {"name": "Character Set", "type": "CATALOG_OBJECT"},
                      {"name": "Table",         "type": "SCHEMA_OBJECT"},
                      {"name": "View",          "type": "SCHEMA_OBJECT"},
                      {"name": "Routine",       "type": "SCHEMA_OBJECT"},
                      {"name": "Event",         "type": "SCHEMA_OBJECT"},
                      {"name": "Trigger",       "type": "TABLE_OBJECT"},
                      {"name": "Foreign Key",   "type": "TABLE_OBJECT"},
                      {"name": "Index",         "type": "TABLE_OBJECT"},
                      {"name": "Column",        "type": "TABLE_OBJECT"}]

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

ws.log("Executing mysql metadata tests")

ws.log("Getting object types")
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Trigger",
        "schema_name": ws.tokens["schema"],
        "table_name": 'categories'
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(["categories_AFTER_INSERT"])
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Foreign Key",
        "schema_name": ws.tokens["schema"],
        "table_name": 'products'
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(["fk_category"])
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Index",
        "schema_name": ws.tokens["schema"],
        "table_name": 'products'
    }
}, ws.matchList([
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(["fk_category"], 0),
    }
 ], 0))


await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Trigger",
        "schema_name": ws.tokens["schema"],
        "table_name": 'categories'
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(["categories_AFTER_INSERT"])
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Foreign Key",
        "schema_name": ws.tokens["schema"],
        "table_name": 'products'
    }
}, [
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(["fk_category"])
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.db.get_table_object_names",
    "args": {
        "module_session_id": ws.lastModuleSessionId,
        "type": "Index",
        "schema_name": ws.tokens["schema"],
        "table_name": 'products'
    }
}, ws.matchList([
    responses.pending.executionStarted,
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": ws.matchList(["fk_category"], 0),
    }
 ], 0))