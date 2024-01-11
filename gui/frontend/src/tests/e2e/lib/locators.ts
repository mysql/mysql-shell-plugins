/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import { By } from "selenium-webdriver";

// MAIN PAGE
export const sqlEditor = By.id("gui.sqleditor");

// DATABASE CONNECTION CONFIGURATION
export const databaseConnectionConfiguration = {
    exists: By.css(".valueEditDialog"),
    type: By.css("#databaseType label"),
    caption: By.id("caption"),
    description: By.id("description"),
    sslTab: By.id("page1"),
    mysql: {
        basic: {
            hostname: By.id("hostName"),
            protocol: By.css("#scheme label"),
            username: By.id("userName"),
            schema: By.id("defaultSchema"),
            port: By.css("#port input"),
        },
        ssl: {
            modeList: {
                exists: By.id("sslModePopup"),
                requireAndVerifyCA: By.id("Require and Verify CA")
            },
            mode: By.id("sslMode"),
            modeLabel: By.css("#sslMode label"),
            ca: By.id("sslCaFile"),
            cert: By.id("sslCertFile"),
            key: By.id("sslKeyFile"),
        },
    },
    sqlite: {
        basic: {
            dbFilePath: By.id("dbFilePath"),
            dbName: By.id("dbName"),
        },
    },
    close: By.id("closeButton"),
    ok: By.id("ok"),
    cancel: By.id("cancel"),
    errors: By.css(".message.error"),
};

// CONFIRM DIALOG
export const confirmDialog = {
    exists: By.css(".confirmDialog"),
    accept: By.id("accept"),
};

// DB CONNECTIONS
export const dbConnections = {
    browser: By.className("connectionBrowser"),
    description: By.css(".tileDescription"),
    existsByCaption: (name: string): By => {
        return By.xpath(`//label[contains(text(), '${name}')]`);
    },
    newConnection: By.id("-1"),
    title: By.id("title"),
    tabName: By.css("#connections > label")
};

// NOTEBOOK

// ADMINISTRATION 
export const serverStatusHeadings = By.css(".grid .heading label");
export const clientConnections = {
    properties: By.css("#connectionProps label"),
    connectionListRows: By.css("#connectionList .tabulator-row"),
};
export const performanceDashboardGrid = {
    exists: By.id("dashboardGrid"),
    headings: By.css(".gridCell.title")
};

export const treeToggle = By.css("span.treeToggle");
export const treeContextMenu = {
    exists: By.css(".noArrow.menu"),
    selectRows: By.id("selectRowsMenuItem")
}

// NOTEBOOK
export const notebook = {
    codeEditor: {
        textArea: By.css("textarea"),
    },
    result: {
        exists: By.className("zoneHost"),
        tableHeaders: By.className("tabulator-headers"),
        tableColumnTitle: By.className("tabulator-col-title"),
        host: By.className("resultHost"),
        status: {
            exists: By.className("resultStatus"),
            text: By.css(".resultStatus > label"),
        }
    }
}

export const htmlTag = {
    label: By.css("label"),
};