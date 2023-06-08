/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
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

// EXTENSION NAME
export const extensionName = "MySQL Shell for VS Code";

// BASE PATH
export const basePath = process.env.USERPROFILE ?? process.env.HOME;

// TREE SECTIONS
export const dbTreeSection = "DATABASE CONNECTIONS";
export const ociTreeSection = "ORACLE CLOUD INFRASTRUCTURE";
export const openEditorsTreeSection = "OPEN EDITORS";
export const tasksTreeSection = "MYSQL SHELL TASKS";

// TIMEOUTS
export const explicitWait = 5000;
export const ociExplicitWait = explicitWait * 2;
export const ociTasksExplicitWait = explicitWait * 5;

// TREE SEARCH LEVELS
export const dbMaxLevel = 5;
export const ociMaxLevel = 5;
export const openEditorsMaxLevel = 5;
export const tasksMaxLevel = 1;

// BUTTONS
export const execFullBlockSql = "Execute the selection or everything in the current block and create a new block";
export const execFullBlockJs = "Execute everything in the current block and create a new block";
export const execCaret = "Execute the statement at the caret position";
export const execFullScript = "Execute full script";
export const find = "Find";
export const rollback = "Rollback DB changes";
export const commit = "Commit DB changes";
export const autoCommit = "Auto commit DB changes";
export const saveNotebook = "Save this Notebook";
export const loadNotebook = "Load a new Notebook from a file";

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

// MISC
export const openEditorsDBNotebook = "DB Notebook";
export const dbConnectionsLabel = "DB Connection Overview";
