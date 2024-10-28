/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { join } from "node:path";

// TIMEOUTS
export const wait1second = 1000;
export const wait2seconds = 2000;
export const wait3seconds = 3000;
export const wait5seconds = 5000;
export const wait10seconds = 10000;
export const wait15seconds = 15000;
export const wait20seconds = 20000;
export const wait25seconds = 25000;
export const wait150MilliSeconds = 150;
export const wait250seconds = 250000;
export const wait1minute = 60000;
export const wait2minutes = 120000;
export const wait30seconds = 30000;
export const queuePollTimeout = wait1minute * 5;

// BUTTONS
export const execCaret = "Execute the statement at the caret position";
export const execFullBlockJs = "Execute everything in the current block and create a new block";
export const execFullBlockSql = "Execute the selection or everything in the current block and create a new block";
export const execAsText = "Execute the block and print the result as text";
export const execFullScript = "Execute full script";
export const autoCommit = "Auto commit DB changes";
export const rollback = "Rollback DB changes";
export const commit = "Commit DB changes";
export const saveNotebook = "Save this Notebook";
export const loadNotebook = "Replace this Notebook With Content from a File";
export const dbNotebook = "DB Notebook";
export const showChatOptions = "Show Chat Options";

// RESULT GRID CONTEXT MENU
export const resultGridContextMenu = {
    capitalizeText: "Capitalize Text",
    convertTextToLowerCase: "Convert Text to Lower Case",
    convertTextToUpperCase: "Convert Text to Upper Case",
    toggleForDeletion: "Delete Row (Mark/Unmark)",
    copySingleRow: "Copy Single Row",
    copySingleRowContextMenu: {
        copyRow: "Copy Row",
        copyRowWithNames: "Copy Row With Names",
        copyRowUnquoted: "Copy Row Unquoted",
        copyRowWithNamesUnquoted: "Copy Row With Names, Unquoted",
        copyRowWithNamesTabSeparated: "Copy Row With Names, Tab Separated",
        copyRowTabSeparated: "Copy Row Tab Separated",
    },
    copyMultipleRows: "Copy Multiple Rows",
    copyMultipleRowsContextMenu: {
        copyAllRows: "Copy All Rows",
        copyAllRowsWithNames: "Copy All Rows With Names",
        copyAllRowsUnquoted: "Copy All Rows Unquoted",
        copyAllRowsWithNamesUnquoted: "Copy All Rows With Names, Unquoted",
        copyAllRowsWithNamesTabSeparated: "Copy All Rows With Names, Tab Separated",
        copyAllRowsTabSeparated: "Copy All Rows Tab Separated",
    },
    copyField: "Copy Field",
    copyFieldUnquoted: "Copy Field Unquoted",
    setFieldToNull: "Set Field to Null",
};

// DATABASE CONNECTION DIALOG
export const basicTab = "Basic";
export const sslTab = "SSL";
export const advancedTab = "Advanced";
export const sshTab = "SSH Tunnel";
export const mdsTab = "MDS/Bastion Service";

// DB CONNECTION OVERVIEW
export const dbConnectionOverview = "DB Connection Overview";
export const editConnection = "Edit Connection";
export const dupConnection = "Duplicate Connection";
export const removeConnection = "Remove Connection";

// EDIT RESULT GRIDS
export const doubleClick = "doubleClick";
export const editButton = "editButton";
export const pressEnter = "pressEnter";

// OCI
export const dbSystemType = "ociDbSystem";
export const bastionType = "ociBastion";
export const ociComputeType = "ociCompute";

// CELL ICONS
export const blob = "blob";
export const geometry = "geometry";
export const json = "json";
export const isNull = "null";

// RESULT GRID VIEW
export const gridView = "grid";
export const previewView = "preview";

// COMMAND RESULT TYPES
export const isText = "text";
export const isGrid = "grid";
export const isGridText = "gridText";
export const isJson = "json";
export const isGraph = "graph";
export const isSqlPreview = "preview";
export const isHWAboutInfo = "HeatWave About Info";
export const isChat = "chat";

// EXPLORER
export const openEditors = "open editors";
export const schemas = "schemas";
export const mysqlAdministration = "admin";
export const scripts = "scripts";

export const schemaType = "Schema";
export const tablesType = "Tables";
export const viewsType = "Views";
export const objectType = "obj";

export const expand = "expand";
export const collapse = "collapse";

export const serverStatus = "Server Status";
export const clientConnections = "Client Connections";
export const performanceDashboard = "Performance Dashboard";
export const lakeHouseNavigator = "Lakehouse Navigator";
export const perfDashMLETab = "MLE Performance";
export const perfDashServerTab = "Server Performance";

// LAKE HOUSE NAVIGATOR
export const lakeHouseNavigatorEditor = "Lakehouse Navigator";
export const overviewTab = "Overview";
export const uploadToObjectStorageTab = "Upload to Object Storage";
export const loadIntoLakeHouseTab = "Load into Lakehouse";
export const lakeHouseTablesTab = "Lakehouse Tables";
export const addFiles = "Add Files";
export const startFileUpload = "Start File Upload";

// HEATWAVE PROFILE EDITOR
export const modelLlama2 = "Llama2";
export const modelMistral = "Mistral";
export const dbTreeSection = "DATABASE CONNECTIONS";
export const ociTreeSection = "ORACLE CLOUD INFRASTRUCTURE";
export const openEditorsTreeSection = "OPEN EDITORS";
export const createNewDatabaseConnection = "Create New DB Connection";
export const refreshConnectionList = "Refresh the connection list";
export const collapseAll = "Collapse All";
export const addConsole = "Add new console";
export const reloadOCIProfiles = "Reload OCI profiles";
export const openNewDatabaseConnectionOnNewTab = "Open New Database Connection on New Tab";
export const refreshConnection = "Refresh Connection";

// CONTEXT MENUS

// COMMON
export const selectRows = "Select Rows";
export const addDatabaseObjectToRestService = "Add Database Object to REST Service...";
export const copyToClipboard = {
    exists: "Copy to Clipboard",
    name: "Name",
    createStatement: "Create Statement",
};
export const sendToSQLEditor = {
    exists: "Send to SQL Editor",
    name: "Name",
    createStatement: "Create Statement",
};

// DB CONNECTION
export const openNewDatabaseConnection = "Open New Database Connection";
export const editDBConnection = "Edit DB Connection";
export const duplicateThisDBConnection = "Duplicate this DB Connection";
export const deleteDBConnection = "Delete DB Connection...";
export const showMySQLSystemSchemas = "Show MySQL System Schemas";
export const loadSQLScriptFromDisk = "Load SQL Script from Disk...";
export const openNewMySQLShellConsoleForThisConnection = "Open New MySQL Shell Console for this Connection";
export const openNewMySQLShellConsole = "Open New MySQL Shell Console";
export const browseTheMySQLRestTServiceDocumentation = "Browse the MySQL REST Service Documentation";
export const configureInstanceForMySQLRestServiceSupport = "Configure Instance for MySQL REST Service Support";

// SCHEMA
export const setAsCurrentDatabaseSchema = "Set As Current Database Schema";
export const addSchemaToRestService = "Add Schema to REST Service...";
export const dropSchema = "Drop Schema...";

// TABLE
export const dropTable = "Drop Table...";

// PROCEDURE
export const dropProcedure = "Drop Procedure...";

// FUNCTION
export const dropFunction = "Drop Function...";

// OCI PROFILE
export const viewConfigProfileInformation = "View Config Profile Information";
export const setAsNewDefaultConfigProfile = "Set as New Default Config Profile";

// COMPARTMENT
export const viewCompartmentInformation = "View Compartment Information";
export const setAsCurrentCompartment = "Set as Current Compartment";

// DB SYSTEM
export const viewDBSystemInformation = "View DB System Information";
export const createConnectionWithBastionService = "Create Connection with Bastion Service";

// COMPUTE INSTANCE
export const viewComputeInstanceInformation = "View Compute Instance Information";

// BASTION
export const getBastionInformation = "Get Bastion Information";
export const setAsCurrentBastion = "Set as Current Bastion";

export const mysqlAdministrationTreeElement = "MySQL Administration";
export const mysqlShellConsoles = "MySQL Shell Consoles";
export const workspace = join(process.cwd(), "..", "..", "..", "..");
export const mysqlScriptIcon = "scriptMysql";
export const jsScriptIcon = "scriptJs";
export const tsScriptIcon = "scriptTs";
export const mysqlShell = "MySQL Shell";
export const startDBSystem = "Start the DB System";
export const restartDBSystem = "Restart the DB System";
export const stopDBSystem = "Stop the DB System";
export const deleteDBSystem = "Delete the DB System";
export const openNewConnectionUsingNotebook = "Open New Connection using Notebook";
export const openNewShellConsole = "Open New Shell Console";
export const newMySQLScript = "New MySQL Script";
export const newJS = "New JavaScript Script";
export const newTS = "New TypeScript Script";
export const closeEditor = "Close Editor";

// SCRIPT TYPES
export const mysqlType = "Mysql";
export const tsType = "scriptTs";
export const jsType = "scriptJs";

export const rowOwnership = "Set as row ownership field";
export const allowSorting = "Allow sorting operations using this field";
export const preventFiltering = "Prevent filtering operations on this field";
export const preventUpdates = "Prevent updates on this field";
export const excludeETAG = "Exclude this field from ETAG calculations";
export const name = "name";
export const isSelected = "isSelected";
export const showSystemSchemas = "Show MySQL System Schemas";
export const mysqlRestService = "MySQL REST Service";
export const disableRESTService = "Disable MySQL REST Service";
export const enableRESTService = "Enable MySQL REST Service";
export const browseRESTDocs = "Browse the MySQL REST Service Documentation";
export const mrsDocs = "MRS Docs";
export const addRESTService = "Add REST Service...";
export const editRESTService = "Edit REST Service...";
export const addSchemaToREST = "Add Schema to REST Service...";
export const setAsCurrentREST = "Set as Current REST Service";
export const loadRESTSchemaFromJSON = "Load REST Schema From JSON File...";
export const exportRestSdk = "Export REST Service SDK Files ...";
export const addNewAuthApp = "Add New Authentication App";
export const deleteRESTService = "Delete REST Service...";
export const mrsServiceDocs = "MRS Service Documentation";
export const editRESTSchema = "Edit REST Schema...";
export const dumpRESTSchemaToJSON = "Dump REST Schema To JSON File...";
export const loadRESTObjFromJSON = "Load REST Object From JSON File...";
export const deleteRESTSchema = "Delete REST Schema...";
export const editRESTObj = "Edit REST Object...";
export const copyRESTObjReqPath = "Copy REST Object Request Path to Clipboard";
export const openRESTObjReqPathInBrowser = "Open REST Object Request Path in Web Browser";
export const copyRESTObjReqPathBrowser = "Copy REST Object Request Path in Web Browser";
export const dumpRESTObjToJSON = "Dump REST Object To JSON File...";
export const exportCreateRestObjSt = "Export CREATE REST OBJECT Statement...";
export const copyCreateRestObjSt = "Copy CREATE REST OBJECT Statement...";
export const exportCreateRestSchemaSt = "Export CREATE REST SCHEMA Statement...";
export const copyCreateRestSchemaSt = "Copy CREATE REST SCHEMA Statement";
export const exportCreateRestServiceSt = "Export CREATE REST SERVICE Statement...";
export const copyCreateRestServiceSt = "Copy CREATE REST SERVICE Statement...";
export const dumpRestSchemaSQL = "Dump Rest Schema SQL...";
export const deleteRESTObj = "Delete REST Object...";
export const addDBObjToREST = "Add Database Object to REST Service...";
export const deleteAuthenticationApp = "Delete Auth App...";
export const addRESTUser = "Add User...";
export const editRESTUser = "Edit User...";
export const deleteRESTUser = "Delete User...";
export const editAuthenticationApp = "Edit Auth App...";
export const lockFlag = join(process.cwd(), "locked");

// THEMES
export const darkModern = "Dark Modern";

export const accessControlEnabled = "enabled";
export const accessControlDisabled = "disabled";
export const accessControlPrivate = "private";
export const vendorOCIOAuth2 = "OCI OAuth2";
