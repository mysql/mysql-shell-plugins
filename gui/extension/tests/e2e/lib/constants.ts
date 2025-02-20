/*
 * Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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

import { join } from "path";

// EXTENSION NAME
export const extensionName = "MySQL Shell for VS Code";
export const feLogFile = "1-MySQL Shell for VS Code.log";

// BASE PATH
export const basePath = process.env.USERPROFILE ?? process.env.HOME;

// WORKSPACE - shell_plugins folder
export const workspace = join(process.cwd(), "..", "..", "..", "..");

// TREE SECTIONS
export const dbTreeSection = "DATABASE CONNECTIONS";
export const ociTreeSection = "ORACLE CLOUD INFRASTRUCTURE";
export const openEditorsTreeSection = "OPEN EDITORS";
export const tasksTreeSection = "MYSQL SHELL TASKS";

// OCI
export const dbSystemType = "ociDbSystem";
export const bastionType = "ociBastion";
export const ociComputeType = "ociCompute";

// TIMEOUTS
export const wait150MilliSeconds = 150;
export const wait1second = 1000;
export const wait2seconds = 2000;
export const wait3seconds = 3000;
export const wait5seconds = 5000;
export const wait10seconds = 10000;
export const wait15seconds = 15000;
export const wait20seconds = 20000;
export const wait25seconds = 25000;
export const wait30seconds = 30000;
export const wait1minute = 60000;
export const queuePollTimeout = wait1minute * 5;

// TREE SEARCH LEVELS
export const dbMaxLevel = 5;
export const ociMaxLevel = 5;
export const openEditorsMaxLevel = 5;
export const tasksMaxLevel = 1;

export const darkModern = "Dark Modern";

export const close = "Close";
export const closeAll = "Close All";
export const closeOthers = "Close Others";
export const closeToTheRight = "Close to the Right";

// BUTTONS
export const execFullBlockSql = "Execute the selection or everything in the current block and create a new block";
export const execFullBlockJs = "Execute everything in the current block and create a new block";
export const execCaret = "Execute the statement at the caret position";
export const execAsText = "Execute the block and print the result as text";
export const execFullScript = "Execute full script";
export const find = "Find";
export const rollback = "Rollback DB changes";
export const commit = "Commit DB changes";
export const autoCommit = "Auto commit DB changes";
export const saveNotebook = "Save this Notebook";
export const loadNotebook = "Replace this Notebook With Content from a File";
export const reloadConnections = "Reload the Connection List";
export const reloadOci = "Reload the OCI Profile list";
export const createDBConnection = "Create New DB Connection";
export const configureOci = "Configure the OCI Profile list";
export const cancel = "Cancel";
export const openLakeHouseNavigator = "Open Lakehouse Navigator";
export const showChatOptions = "Show Chat Options";

// TABS
export const dbDefaultEditor = "MySQL Shell";
export const mysqlShellConsoles = "MySQL Shell Consoles";
export const addMRSService = "Add MRS Service";
export const editMRSService = "Edit MRS Service";
export const addMRSSchema = "Add MRS Schema";
export const editMRSSchema = "Edit MRS Schema";
export const addAuthApp = "Add Auth App";
export const editAuthApp = "Edit Auth App";
export const addUser = "Add MRS User";
export const editUser = "Edit MRS User";
export const mrsDocs = "MRS Docs";
export const welcomeTab = "Welcome to MySQL Shell";

// DATABASE CONNECTION DIALOG
export const basicTab = "Basic";
export const sslTab = "SSL";
export const advancedTab = "Advanced";
export const sshTab = "SSH Tunnel";
export const mdsTab = "MDS/Bastion Service";

// DB CONNECTION OVERVIEW
export const editConnection = "Edit Connection";
export const dupConnection = "Duplicate Connection";
export const removeConnection = "Remove Connection";

// MISC
export const openEditorsDBNotebook = "DB Notebook";
export const dbConnectionsLabel = "DB Connection Overview";
export const lakehouseNavigator = "Lakehouse Navigator";
export const serverStatus = "Server Status";
export const clientConns = "Client Connections";
export const perfDash = "Performance Dashboard";
export const mysqlAdmin = "MySQL Administration";
export const vscodeChannel = "MySQL Shell for VS Code";
export const collapseAll = "Collapse All";
export const mysqlRestService = "MySQL REST Service";
export const welcome = "Welcome to MySQL Shell for VS Code.";

// EDITOR ICONS
export const connOverviewIcon = "overviewPage";
export const mysqlConnectionIcon = "connectionMysql";
export const notebookIcon = "notebook";
export const adminServerStatusIcon = "adminServerStatus";
export const clientConnectionsIcon = "clientConnections";
export const adminPerformanceDashboardIcon = "adminPerformanceDashboard";
export const mysqlScriptIcon = "scriptMysql";
export const jsScriptIcon = "scriptJs";
export const tsScriptIcon = "scriptTs";

// COMMAND RESULT TYPES
export const isText = "text";
export const isGrid = "grid";
export const isGridText = "gridText";
export const isJson = "json";
export const isGraph = "graph";
export const isSqlPreview = "preview";
export const isHWAboutInfo = "HeatWave About Info";
export const isChat = "chat";

// LAKE HOUSE NAVIGATOR
export const lakeHouseNavigatorEditor = "Lakehouse Navigator";
export const overviewTab = "Overview";
export const uploadToObjectStorageTab = "Upload to Object Storage";
export const loadIntoLakeHouseTab = "Load into Lakehouse";
export const lakeHouseTablesTab = "Lakehouse Tables";
export const addFiles = "Add Files";
export const startFileUpload = "Start File Upload";

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

// HEATWAVE PROFILE EDITOR
export const modelLlama2 = "Llama2";
export const modelMistral = "Mistral";

// RESULT GRID VIEW
export const gridView = "grid";
export const previewView = "preview";

// CELL ICONS
export const blob = "blob";
export const geometry = "geometry";
export const json = "json";
export const isNull = "null";
export const closeEditor = "Close Editor";

// SCRIPT TYPES
export const mysqlType = "Mysql";
export const tsType = "scriptTs";
export const jsType = "scriptJs";

// EDIT RESULT GRIDS
export const doubleClick = "doubleClick";
export const editButton = "editButton";
export const pressEnter = "pressEnter";

// CONTEXT MENUS ITEMS
export const executeBlock = "Execute Block";
export const executeBlockAndAdvance = "Execute Block and Advance";
export const restartInternalShell = "Restart the Internal MySQL Shell Process";
export const connectToExternalShell = "Connect to External MySQL Shell Process";
export const relaunchWelcomeWizard = "Relaunch Welcome Wizard";
export const resetExtension = "Reset MySQL Shell for VS Code Extension";
export const dropStoredRoutine = "Drop Stored Routine...";
export const openNewConnectionUsingNotebook = "Open New Connection using Notebook";
export const openNewConnection = "Open New Database Connection";
export const connectToDB = "Connect to Database";
export const connectToDBNewTab = "Connect to Database on New Tab";
export const setDBConnDefault = "Set this DB Connection as Default";
export const editDBConnection = "Edit DB Connection";
export const dropEvent = "Drop Event...";
export const duplicateConnection = "Duplicate this DB Connection";
export const deleteDBConnection = "Delete DB Connection";
export const showSystemSchemas = "Show MySQL System Schemas";
export const loadScriptFromDisk = "Load SQL Script from Disk...";
export const loadDumpFromDisk = "Load Dump from Disk...";
export const openShellConnection = "Open New MySQL Shell Console for this Connection";
export const browseRESTDocs = "Browse the MySQL REST Service Documentation";
export const configureREST = "Configure Instance for MySQL REST Service Support";
export const setCurrentDBSchema = "Set As Current Database Schema";
export const dumpToDisk = "Dump to Disk";
export const databaseSchemaDump = "Database Schema Dump";
export const databaseSchemaDumpRest = "Database Schema Dump for MySQL Database Service";

export const copyToClipboard = "Copy to Clipboard";
export const copyToClipboardName = "Name";
export const copyToClipboardStat = "CREATE Statement";
export const copyToClipboardStatDel = "CREATE Statement with DELIMITERs";
export const copyToClipboardDropStatDel = "DROP & CREATE Statement with DELIMITERs";
export const loadDataToHW = "Load Data to HeatWave Cluster";
export const addSchemaToREST = "Add Schema to REST Service";
export const dropSchema = "Drop Schema...";
export const selectRowsInNotebook = "Select Rows in DB Notebook";
export const showData = "Show Data";
export const addDBObjToREST = "Add Database Object to REST Service";
export const dropTable = "Drop Table...";
export const dropView = "Drop View...";
export const addRESTService = "Add REST Service...";
export const enableRESTService = "Enable MySQL REST Service";
export const disableRESTService = "Disable MySQL REST Service";
export const bootstrapRouter = "Bootstrap Local MySQL Router Instance";
export const startRouter = "Start Local MySQL Router Instance";
export const stopRouter = "Stop Local MySQL Router Instance";
export const deleteRouter = "Delete Router...";
export const killRouters = "Kill Local MySQL Router Instances";
export const editRESTService = "Edit REST Service...";
export const setAsCurrentREST = "Set as Current REST Service";
export const loadRESTSchemaFromJSON = "Load REST Schema From JSON File...";
export const exportRestSdk = "Export REST Service SDK Files...";
export const addNewAuthenticationApp = "Add New Authentication App";
export const addAndLinkNewAuthApp = "Add and Link REST Authentication App...";
export const linkNewAuthApp = "Link REST Authentication App...";
export const deleteRESTService = "Delete REST Service...";
export const mrsServiceDocs = "MRS Service Documentation";
export const editRESTSchema = "Edit REST Schema...";
export const dumpRESTSchemaToJSON = "REST Schema To JSON File...";
export const loadRESTObjFromJSON = "Load REST Object From JSON File...";
export const deleteRESTSchema = "Delete REST Schema...";
export const editRESTObj = "Edit REST Object...";
export const copyRESTObjReqPath = "Copy REST Object Request Path to Clipboard";
export const copyRESTObjReqPathBrowser = "Copy REST Object Request Path in Web Browser";
export const dumpRESTObjToJSON = "Dump REST Object To JSON File...";
export const exportCreateRestObjSt = "Export CREATE REST OBJECT Statement...";
export const copyCreateRestObjSt = "Copy CREATE REST OBJECT Statement...";
export const exportCreateRestSchemaSt = "Export CREATE REST SCHEMA Statement...";
export const copyCreateRestSchemaSt = "Copy CREATE REST SCHEMA Statement...";
export const exportCreateRestServiceSt = "Export CREATE REST SERVICE Statement...";
export const copyCreateRestServiceSt = "Copy CREATE REST SERVICE Statement...";
export const dumpRestSchemaSQL = "Dump Rest Schema SQL...";
export const deleteRESTObj = "Delete REST Object";
export const viewConfigProfileInfo = "View Config Profile Information";
export const setDefaultConfigProfile = "Set as New Default Config Profile";
export const viewCompartmentInfo = "View Compartment Information";
export const setCurrentCompartment = "Set as Current Compartment";
export const viewDBSystemInfo = "View DB System Information";
export const createConnWithBastion = "Create Connection with Bastion Service";
export const startDBSystem = "Start the DB System";
export const restartDBSystem = "Restart the DB System";
export const stopDBSystem = "Stop the DB System";
export const deleteDBSystem = "Delete the DB System";
export const createRouterEndpoint = "Create MySQL Router Endpoint on new Compute Instance";
export const openNewShellConsole = "Open New MySQL Shell Console";
export const newMySQLScript = "New MySQL Script";
export const newJS = "New JavaScript Script";
export const newTS = "New TypeScript Script";
export const newMySQLNotebook = "New MySQL Notebook";
export const openNotebookWithConn = "Open the Notebook with connection...";
export const getBastionInfo = "Get Bastion Information";
export const viewComputeInstanceInfo = "View Compute Instance Information";
export const setAsCurrentBastion = "Set as Current Bastion";
export const refreshBastion = "Refresh When Bastion Reaches Active State";
export const deleteBastion = "Delete Bastion";
export const deleteComputeInstance = "Delete Compute Instance";
export const deleteUser = "Delete User";
export const editAuthenticationApp = "Edit Authentication App";
export const deleteAuthenticationApp = "Delete Authentication App";
export const addRESTUser = "Add User";
export const editRESTUser = "Edit User";
export const deleteRESTUser = "Delete User";
export const vendorOCIOAuth2 = "OCI OAuth2";

export const checkNewTabAndWebView = "Check New Tab and WebView";
export const checkNewTab = "Check New Tab";
export const checkNotification = "Check Notification";
export const checkInput = "Check Input";
export const checkWebViewDialog = "Check Dialog inside a webview";
export const checkDialog = "Check Dialog";
export const checkWebView = "Check WebView";
export const checkTerminal = "Check terminal";

export const accessControlEnabled = "enabled";
export const accessControlDisabled = "disabled";
export const accessControlPrivate = "private";

// REST COLUMN OPTIONS
export const rowOwnership = "Set as row ownership field";
export const allowSorting = "Allow sorting operations using this field";
export const preventFiltering = "Prevent filtering operations on this field";
export const preventUpdates = "Prevent updates on this field";
export const excludeETAG = "Exclude this field from ETAG calculations";

export const lockFlag = join(process.cwd(), "locked");

export const perfDashServerTab = "Server Performance";
export const perfDashMLETab = "MLE Performance";

export const dbMainCtxMenu = new Map([
    [restartInternalShell, 1],
    [connectToExternalShell, 2],
    [relaunchWelcomeWizard, 3],
    [resetExtension, 4],
]);

export const dbConnectionCtxMenu = new Map([
    [openNewConnection, 1],
    [setDBConnDefault, 2],
    [editDBConnection, 3],
    [duplicateConnection, 4],
    [deleteDBConnection, 5],
    [showSystemSchemas, 6],
    [loadScriptFromDisk, 7],
    [loadDumpFromDisk, 8],
    [openShellConnection, 9],
    [browseRESTDocs, 10],
    [configureREST, 11],
]);

export const dbConnectionSqliteCtxMenu = new Map([
    [openNewConnection, 1],
    [editDBConnection, 2],
    [duplicateConnection, 3],
    [deleteDBConnection, 4],
    [loadScriptFromDisk, 5],
]);

export const schemaCtxMenu = new Map([
    [setCurrentDBSchema, 1],
    [dumpToDisk, 2],
    [databaseSchemaDump, 0],
    [databaseSchemaDumpRest, 1],
    [copyToClipboard, 3],
    [copyToClipboardName, 0],
    [copyToClipboardStat, 1],
    [loadDataToHW, 4],
    [addSchemaToREST, 5],
    [dropSchema, 6],
]);

export const dbObjectCtxMenu = new Map([
    [selectRowsInNotebook, 1],
    [showData, 2],
    [copyToClipboard, 3],
    [copyToClipboardName, 0],
    [copyToClipboardStat, 1],
    [addDBObjToREST, 4],
    [dropTable, 5],
    [dropView, 5],
]);

export const routinesCtxMenu = new Map([
    [copyToClipboard, 2],
    [copyToClipboardName, 0],
    [copyToClipboardStat, 1],
    [copyToClipboardStatDel, 2],
    [copyToClipboardDropStatDel, 3],
    [addDBObjToREST, 2],
    [dropStoredRoutine, 4],
]);

export const eventsCtxMenu = new Map([
    [dropEvent, 1],
]);

export const restMainCtxMenu = new Map([
    [addRESTService, 1],
    [enableRESTService, 2],
    [disableRESTService, 3],
    [bootstrapRouter, 5],
    [startRouter, 6],
    [stopRouter, 7],
    [killRouters, 8],
    [browseRESTDocs, 9],
]);

export const dumpRESTSchemaToSQL = "Rest Schema SQL...";
export const loadFromDisk = "Load from Disk";
export const restObjectFromJSONFile = "REST Object From JSON File...";
export const restSchemaFromJSONFile = "REST Schema From JSON File...";
export const restClientSDKFiles = "REST Client SDK Files ...";

export const exportCreateServiceStatement = "Export CREATE REST SERVICE Statement...";
export const exportCreateServiceStatementAll = "Export CREATE REST SERVICE Statement Including All Objects...";
export const copyCreateServiceStatement = "Copy CREATE REST SERVICE Statement";
export const copyCreateServiceStatementAll = "Copy CREATE REST SERVICE Statement Including All Objects";

export const exportCreateSchemaStatement = "Export CREATE REST SCHEMA Statement...";
export const exportCreateSchemaStatementAll = "Export CREATE REST SCHEMA Statement Including All Objects...";
export const copyCreateSchemaStatement = "Copy CREATE REST SCHEMA Statement";
export const copyCreateSchemaStatementAll = "Copy CREATE REST SCHEMA Statement Including All Objects";

export const createStatement = "Create Statement";
export const createStatement3Dots = `${createStatement}...`;
export const createStatementIncludingAllObjects = "Create Statement Including All Objects";
export const createStatementIncludingAllObjects3Dots = `${createStatementIncludingAllObjects}...`;
export const restAuthenticationApps = "REST Authentication Apps";

export const restAuthenticationAppsCtxMenu = new Map([
    [addNewAuthenticationApp, 1],
]);

export const restServiceCtxMenu = new Map([
    [editRESTService, 1],
    [setAsCurrentREST, 2],
    [loadFromDisk, 3],
    [restSchemaFromJSONFile, 0],
    [dumpToDisk, 4],
    [restClientSDKFiles, 0],
    [exportCreateServiceStatement, 1],
    [exportCreateServiceStatementAll, 2],
    [copyToClipboard, 5],
    [copyCreateServiceStatement, 0],
    [copyCreateServiceStatementAll, 1],
    [addAndLinkNewAuthApp, 6],
    [linkNewAuthApp, 7],
    [deleteRESTService, 10],
    [mrsServiceDocs, 11],
]);

export const restSchemaCtxMenu = new Map([
    [editRESTSchema, 1],
    [loadFromDisk, 2],
    [restObjectFromJSONFile, 0],
    [dumpToDisk, 3],
    [dumpRESTSchemaToJSON, 0],
    [dumpRESTSchemaToSQL, 1],
    [exportCreateSchemaStatement, 2],
    [exportCreateSchemaStatementAll, 3],
    [copyToClipboard, 4],
    [copyCreateSchemaStatement, 0],
    [copyCreateSchemaStatementAll, 1],
    [deleteRESTSchema, 5],
]);

export const restObjectToJSONFile = "REST Object To JSON File...";
export const restObjectRequestPath = "Copy REST Object Request Path";

export const restObjCtxMenu = new Map([
    [editRESTObj, 1],
    [copyRESTObjReqPath, 2],
    [dumpToDisk, 3],
    [restObjectToJSONFile, 0],
    [createStatement3Dots, 1],
    [copyToClipboard, 4],
    [restObjectRequestPath, 0],
    [createStatement, 1],
    [deleteRESTObj, 5],
]);

export const restAppCtxMenu1 = new Map([
    [dumpToDisk, 2],
    [createStatement3Dots, 0],
    [createStatementIncludingAllObjects3Dots, 1],
    [copyToClipboard, 3],
    [createStatement, 0],
    [createStatementIncludingAllObjects, 1],
]);

export const restAppCtxMenu2 = new Map([
    [editAuthenticationApp, 1],
    [addRESTUser, 2],
    [deleteAuthenticationApp, 3],
]);

export const restUserCtxMenu = new Map([
    [editRESTUser, 1],
    [deleteRESTUser, 2],
    [dumpToDisk, 3],
    [createStatement3Dots, 1],
    [createStatementIncludingAllObjects3Dots, 2],
    [copyToClipboard, 4],
    [createStatement, 0],
    [createStatement3Dots, 1],
]);

export const routerCtxMenu = new Map([
    [deleteRouter, 1],
]);

export const ociConfigCtxMenu = new Map([
    [viewConfigProfileInfo, 1],
    [setDefaultConfigProfile, 2],
]);

export const ociCompCtxMenu = new Map([
    [viewCompartmentInfo, 1],
    [setCurrentCompartment, 2],
]);

export const ociDBSCtxMenu = new Map([
    [viewDBSystemInfo, 1],
    [createConnWithBastion, 2],
    [startDBSystem, 3],
    [restartDBSystem, 4],
    [stopDBSystem, 5],
    [deleteDBSystem, 6],
    [createRouterEndpoint, 7],
]);

export const ociBastionCtxMenu = new Map([
    [getBastionInfo, 1],
    [setAsCurrentBastion, 2],
    [refreshBastion, 4],
    [deleteBastion, 3],
]);

export const openEditCtxMenu = new Map([
    [openNewShellConsole, 1],
    [newMySQLScript, 1],
    [newJS, 2],
    [newTS, 3],
]);

export const miscCtxMenu = new Map([
    [openNotebookWithConn, 5],
]);

export const ociComputeInstanceCtxMenu = new Map([
    [viewComputeInstanceInfo, 1],
    [deleteComputeInstance, 3],
]);

export const restServiceMetadataSchema = "mysql_rest_service_metadata";
export const ociFailure = "OCI Failure";
export const mysqlRouters = "MySQL Routers";
export const reloadDataBaseInformation = "Reload Database Information";
