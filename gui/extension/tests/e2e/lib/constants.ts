/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

// OCI E2E TESTS BASTION CREDENTIALS
export const bastionUsername = process.env.OCI_BASTION_USERNAME;
export const bastionPassword = process.env.OCI_BASTION_PASSWORD;

// TIMEOUTS
export const wait150MilliSeconds = 150;
export const wait1second = 1000;
export const wait2seconds = 2000;
export const wait3seconds = 3000;
export const wait5seconds = 5000;
export const wait10seconds = 10000;
export const wait15seconds = 15000; //queryWaits
export const wait20seconds = 20000; //loadingBarWait
export const wait25seconds = 25000; //ociTasksExplicitWait
export const wait1minute = 60000;
export const wait2minutes = 120000; //extensionReadyWait
export const wait5minutes = 300000;

// TREE SEARCH LEVELS
export const dbMaxLevel = 5;
export const ociMaxLevel = 5;
export const openEditorsMaxLevel = 5;
export const tasksMaxLevel = 1;

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
export const loadNotebook = "Replace this Notebook With Content from a file";
export const reloadConnections = "Reload the connection list";
export const reloadOci = "Reload the OCI Profile list";
export const createDBConnection = "Create New DB Connection";
export const configureOci = "Configure the OCI Profile list";
export const cancel = "Cancel";

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

// RESULT GRID CONTEXT MENU
export const resultGridContextMenu = {
    capitalizeText: "Capitalize Text",
    convertTextToLowerCase: "Covert Text to Lower Case",
    convertTextToUpperCase: "Covert Text to Upper Case",
    toggleForDeletion: "Toggle Row Deletion Mark",
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

// CELL ICONS
export const blob = "blob";
export const geometry = "geometry";
export const json = "json";
export const isNull = "null";

// CONTEXT MENUS ITEMS
export const executeBlock = "Execute Block";
export const executeBlockAndAdvance = "Execute Block and Advance";
export const restartInternalShell = "Restart the Internal MySQL Shell Process";
export const connectToExternalShell = "Connect to External MySQL Shell Process";
export const relaunchWelcomeWizard = "Relaunch Welcome Wizard";
export const resetExtension = "Reset MySQL Shell for VS Code Extension";
export const dropStoredRoutine = "Drop Stored Routine...";
export const openNewConnection = "Open New Database Connection";
export const connectToDB = "Connect to Database";
export const connectToDBNewTab = "Connect to Database on New Tab";
export const setDBConnDefault = "Set this DB Connection as Default";
export const editDBConnection = "Edit DB Connection";
export const dropEvent = "Drop Event...";
export const duplicateConnection = "Duplicate this DB Connection";
export const deleteDBConnection = "Delete DB Connection";
export const showSystemSchemas = "Show MySQL System Schemas";
export const loadScriptFromDisk = "Load SQL Script from Disk";
export const loadDumpFromDisk = "Load Dump from Disk";
export const openShellConnection = "Open New MySQL Shell Console for this Connection";
export const browseRESTDocs = "Browse the MySQL REST Service Documentation";
export const configureREST = "Configure Instance for MySQL REST Service Support";
export const setCurrentDBSchema = "Set As Current Database Schema";
export const dumpSchemaToDisk = "Dump Schema to Disk";
export const dumpSchemaToDiskToService = "Dump Schema to Disk for MySQL Database Service";
export const copyToClipboard = "Copy To Clipboard";
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
export const exportRestSdk = "Export REST Service SDK Files ...";
export const addNewAuthApp = "Add New Authentication App";
export const deleteRESTService = "Delete REST Service...";
export const mrsServiceDocs = "MRS Service Documentation";
export const editRESTSchema = "Edit REST Schema...";
export const dumpRESTSchemaToJSON = "Dump REST Schema To JSON File...";
export const loadRESTObjFromJSON = "Load REST Object From JSON File...";
export const deleteRESTSchema = "Delete REST Schema...";
export const editRESTObj = "Edit REST Object";
export const copyRESTObjReqPath = "Copy REST Object Request Path to Clipboard";
export const copyRESTObjReqPathBrowser = "Copy REST Object Request Path in Web Browser";
export const dumpRESTObjToJSON = "Dump REST Object To JSON File...";
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

export const checkNewTabAndWebView = "Check New Tab and WebView";
export const checkNewTab = "Check New Tab";
export const checkNotification = "Check Notification";
export const checkInput = "Check Input";
export const checkWebViewDialog = "Check Dialog inside a webview";
export const checkDialog = "Check Dialog";
export const checkWebView = "Check WebView";
export const checkTerminal = "Check terminal";

// REST COLUMN OPTIONS
export const rowOwnership = "Set as row ownership field";
export const allowSorting = "Allow sorting operations using this field";
export const preventFiltering = "Prevent filtering operations on this field";
export const preventUpdates = "Prevent updates on this field";
export const excludeETAG = "Exclude this field from ETAG calculations";

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
    [dumpSchemaToDisk, 2],
    [dumpSchemaToDiskToService, 3],
    [copyToClipboard, 4],
    [copyToClipboardName, 0],
    [copyToClipboardStat, 1],
    [loadDataToHW, 5],
    [addSchemaToREST, 6],
    [dropSchema, 7],
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
    [copyToClipboard, 1],
    [copyToClipboardName, 0],
    [copyToClipboardStat, 1],
    [copyToClipboardStatDel, 2],
    [copyToClipboardDropStatDel, 3],
    [addDBObjToREST, 2],
    [dropStoredRoutine, 3],
]);

export const eventsCtxMenu = new Map([
    [dropEvent, 1],
]);

export const restMainCtxMenu = new Map([
    [addRESTService, 1],
    [enableRESTService, 2],
    [disableRESTService, 3],
    [bootstrapRouter, 4],
    [startRouter, 5],
    [stopRouter, 6],
    [killRouters, 7],
    [browseRESTDocs, 8],
]);

export const restServiceCtxMenu = new Map([
    [editRESTService, 1],
    [setAsCurrentREST, 2],
    [loadRESTSchemaFromJSON, 3],
    [exportRestSdk, 4],
    [addNewAuthApp, 5],
    [deleteRESTService, 6],
    [mrsServiceDocs, 7],
]);

export const restSchemaCtxMenu = new Map([
    [editRESTSchema, 1],
    [dumpRESTSchemaToJSON, 2],
    [loadRESTObjFromJSON, 3],
    [deleteRESTSchema, 4],
]);

export const restObjCtxMenu = new Map([
    [editRESTObj, 1],
    [copyRESTObjReqPath, 2],
    [copyRESTObjReqPathBrowser, 3],
    [dumpRESTObjToJSON, 4],
    [deleteRESTObj, 5],
]);

export const restAppCtxMenu = new Map([
    [editAuthenticationApp, 1],
    [addRESTUser, 2],
    [deleteAuthenticationApp, 3],
]);

export const restUserCtxMenu = new Map([
    [editRESTUser, 1],
    [deleteRESTUser, 2],
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

export const dbTables = [
    {
        name: "all_data_types_ints",
        columns: [
            `id`,
            `test_smallint`,
            `test_mediumint`,
            `test_integer`,
            `test_bigint`,
            `test_decimal`,
            `test_float`,
            `test_double`,
            `test_boolean`,
        ],
        columnRegexWithQuotes: [
            /(\d+)/, // id
            /(\d+)/, // smallint
            /(\d+)/, // med int
            /(\d+)/, // int
            /(\d+)/, // big int
            /'(\d+).(\d+)'/, // decimal
            /'(\d+).(\d+)'/, // float
            /'(\d+).(\d+)'/, // double
            /(\d+)/, // boolean
        ],
        columnRegex: [
            /(\d+)/, // id
            /(\d+)/, // smallint
            /(\d+)/, // med int
            /(\d+)/, // int
            /(\d+)/, // big int
            /(\d+).(\d+)/, // decimal
            /(\d+).(\d+)/, // float
            /(\d+).(\d+)/, // double
            /(\d+)/, // boolean
        ],
    },
    {
        name: "all_data_types_dates",
        columns: [
            `id`,
            `test_date`,
            `test_datetime`,
            `test_timestamp`,
            `test_time`,
            `test_year`,
        ],
        columnRegexWithQuotes: [
            /(\d+)/, // id
            /'(\d+)-(\d+)-(\d+)'/, // date
            /'(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)'/, // date time
            /'(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)'/, // timestamp
            /'(\d+):(\d+):(\d+)'/, // time
            /(\d+)/, // year
        ],
        columnRegex: [
            /(\d+)/, // id
            /(\d+)-(\d+)-(\d+)/, // date
            /(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)/, // date time
            /(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)/, // timestamp
            /(\d+):(\d+):(\d+)/, // time
            /(\d+)/, // year
        ],
    },
    {
        name: "all_data_types_chars",
        columns: [
            `id`,
            `test_char`,
            `test_varchar`,
            `test_tinytext`,
            `test_text`,
            `test_mediumtext`,
            `test_longtext`,
            `test_enum`,
            `test_set`,
            `test_json`,
        ],
        columnRegexWithQuotes: [
            /(\d+)/, // id
            /'.*'/, // char
            /'.*'/, // var char
            /'.*'/, // tiny text
            /'.*'/, // text
            /'.*'/, // med text
            /'.*'/, // long text
            /'.*'/, // enum
            /'.*'/, // set
            /\{".*": ".*"\}/, // json
        ],
        columnRegex: [
            /(\d+)/, // id
            /.*/, // char
            /.*/, // var char
            /.*/, // tiny text
            /.*/, // text
            /.*/, // med text
            /.*/, // long text
            /.*/, // enum
            /.*/, // set
            /\{".*": ".*"\}/, // json
        ],
    },
    {
        name: "all_data_types_blobs",
        columns: [
            `id`,
            `test_tinyblob`,
            `test_blob`,
            `test_mediumblob`,
            `test_longblob`,
            `test_binary`,
            `test_varbinary`,
        ],
        columnRegexWithQuotes: [
            /(\d+)/, // id
            /0x/, // tiny blob
            /0x/, // blob
            /0x/, // med blob
            /0x/, // long blob
            /0x/, // binary
            /0x/, // var binary
        ],
        columnRegex: [
            /(\d+)/, // id
            /0x/, // tiny blob
            /0x/, // blob
            /0x/, // med blob
            /0x/, // long blob
            /0x/, // binary
            /0x/, // var binary
        ],
    },
    {
        name: "all_data_types_geometries",
        columns: [
            `id`,
            `test_bit`,
            `test_point`,
            `test_linestring`,
            `test_polygon`,
            `test_multipoint`,
            `test_multilinestring`,
            `test_multipolygon`,
            `test_geometrycollection`,
        ],
        columnRegexWithQuotes: [
            /(\d+)/, // id
            /0x/, // tiny blob
            /0x/, // blob
            /0x/, // med blob
            /0x/, // long blob
            /'.*'/, // enum
            /'.*'/, // set
            /0x/, // binary
            /0x/, // var binary
            /\{".*": ".*"\}/, // json
        ],
        columnRegex: [
            /(\d+)/, // id
            /(\d+)/, // bit
            /\s/, // point
            /\s/, // linestring
            /\s/, // polygon
            /\s/, // multipoint
            /\s/, // multilinestring
            /\s/, // multipolygon
            /\s/, // geo collection
        ],
    },
    {
        name: "result_sets",
        columns: [
            "id",
            "text_field",
            "long_text_field",
            "bool_field",
            "date_field",
            "blob_field",
        ],
    },
    {
        name: "actor",
        columns: [
            "actor_id",
            "first_name",
            "last_name",
            "last_update",
        ],
        columnRegex: [
            /(\d+)/,
            /.*/,
            /.*/,
            /(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)/,
        ],
        columnRegexWithQuotes: [
            /(\d+)/,
            /'.*'/,
            /'.*'/,
            /'(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)'/,
        ],
    },
];
