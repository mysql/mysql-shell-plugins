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

// TIMEOUTS
export const wait1second = 1000;
export const wait2seconds = 2000;
export const wait3seconds = 3000;
export const wait5seconds = 5000;
export const wait10seconds = 10000;
export const wait15seconds = 15000;
export const wait20seconds = 20000;
export const wait150MilliSeconds = 150;
export const wait250seconds = 250000;
export const wait1minute = 60000;

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
export const dbNotebook = "DB Notebook";

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

// EDIT RESULT GRIDS
export const doubleClick = "doubleClick";
export const editButton = "editButton";
export const pressEnter = "pressEnter";

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
