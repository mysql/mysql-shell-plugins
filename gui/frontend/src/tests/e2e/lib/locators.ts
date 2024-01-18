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

import { By, Locator } from "selenium-webdriver";

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
    tab: By.id("connections"),
    tabName: By.css("#connections > label"),
    connections: {
        caption: By.className("tileCaption"),
        description: By.className("tileDescription")
    }
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
    exists: By.id("contentHost"),
    toolbar: {
        exists: By.id("dbEditorToolbar"),
        editorSelector: {
            exists: By.id("documentSelector"),
            currentValue: By.css("label"),
            currentIcon: By.className("icon"),
            currentImage: By.css("img"),
            items: By.css("div.visible.dropdownList > div"),
            iconType: By.css(".msg.icon")
        },
        button: By.className("button")
    },
    codeEditor: {
        textArea: By.css("textarea"),
        editor: {
            exists: By.className("monaco-editor-background"),
            line: By.css("#contentHost .editorHost .view-line"),
            linesContent: By.className("lines-content"),
            currentLine: By.className("current-line"),
            host: By.id("editorPaneHost"),
            editorHost: By.className("editorHost"),
            result: {
                exists: By.className("zoneHost"),
                tableHeaders: By.className("tabulator-headers"),
                tableColumnTitle: By.className("tabulator-col-title"),
                host: By.className("resultHost"),
                status: {
                    exists: By.className("resultStatus"),
                    text: By.css(".resultStatus > label"),
                    copy: By.className("copyButton"),
                },
                graphHost: {
                    exists: By.className("graphHost"),
                    column: By.css("rect"),
                },
                singleOutput: By.className("outputHost"),
                info: By.css(".message.info"),
                tabSection: {
                    tabs: By.css(".resultHost .tabArea div"),
                },
                text: {
                    exists: By.css(".textHost span"),
                    entry: By.css(".entry > span"),
                    info: By.className("info")
                },
                anyResult: By.css(".resultStatus .label,.actionOutput span > span"),
            },
            promptLine: By.css(".margin-view-overlays > div"),
            editorLine: By.css(".view-lines.monaco-mouse-cursor-text > div > span"),
            editorPrompt: By.css(".view-lines.monaco-mouse-cursor-text .view-line"),
            statementStart: By.className("statementStart")
        },
        prompt: {
            current: By.className("editorPromptFirst"),
        },
        scroll: By.css(".codeEditor .monaco-scrollable-element")
    },
    explorerHost: {
        exists: By.id("explorerHost"),
        openEditors: {
            exists: By.id("editorSectionHost"),
            container: By.css("div.container.section"),
            addConsole: By.id("addConsole"),
            textBox: By.css("#editorSectionHost input"),
            close: By.css("span.codicon-close"),
            item: By.css("div.accordionItem.closable")
        },
        schemas: {
            exists: By.id("schemaSectionHost"),
            container: By.css("div.container.section"),
            default: By.css("#schemaSectionHost div.marked label"),
            treeToggle: By.css("span.treeToggle"),
            scroll: By.css("#schemaSectionHost .tabulator-tableholder"),
            objectByLevel: (level: number): By => {
                return By.css(`.tabulator-table .tabulator-tree-level-${level}`)
            },
            object: By.css(".schemaTreeEntry label"),
            table: By.className("tabulator-table")
        },
        administration: {
            exists: By.id("adminSectionHost"),
            container: By.css("div.container.section"),
            scrollBar: By.className("fixedScrollbar"),
            item: By.className("accordionItem"),
            itemToClick: By.css("#adminSectionHost .accordionItem .label")
        },
        scripts: {
            exists: By.id("scriptSectionHost"),
            container: By.css("div.container.section"),
            script: By.css("div.tabulator-row"),
            object: By.css(".schemaTreeEntry label"),
            objectImage: By.css(".schemaTreeEntry img"),
            addScript: By.id("addScript"),
            contextMenu: {
                exists: By.css("div.visible.noArrow.menu"),
                addJSScript: By.id("addJSScript"),
                addTSScript: By.id("addTSScript"),
                addSQLScript: By.id("addSQLScript"),
            },
            table: By.className("tabulator-table"),
            item: By.className("accordionItem")
        }
    },
    serverStatus: {
        tableCells: By.css("#statusBoxHost .gridCell")
    },
    connectionTab: {
        exists: By.className("hasAuxillary"),
        opened: By.css(".hasAuxillary.selected"),
        close: By.css("#auxillary .closeButton"),
    }
}

export const findWidget = {
    exists: By.className("find-widget"),
    isVisible: By.css(".find-widget.visible"),
    textArea: By.css("textarea"),
    matchesCount: By.className("matchesCount"),
    findMatch: By.css(".cdr.findMatch"),
    replacePart: By.className("replace-part"),
    actions: By.css(".find-actions div"),
    close: By.xpath(".//div[contains(@title, 'Close')]"),
    replacerActions: By.css(".replace-actions div"),
}

export const htmlTag = {
    label: By.css("label"),
    span: By.css("span"),
    div: By.css("div"),
    img: By.css("img"),
};

export const adminPage = {
    headingText: By.id("headingSubLabel"),
    links: By.css("#loginDialogLinks a"),
    username: By.id("loginUsername"),
    password: By.id("loginPassword"),
    loginButton: By.id("loginButton"),
    error: By.css("div.message.error"),
};

export const shellPage = {
    icon: By.id("gui.shell"),
    guiConsoleTab: By.id("sessions"),
    title: By.css("#shellModuleHost #title"),
    links: {
        learnMore: By.linkText("Learn More >"),
        browseTutorial: By.linkText("Browse Tutorial >"),
        readDocs: By.linkText("Read Docs >"),
    },
    contentTitle: By.css("#shellModuleHost #contentTitle"),
    sessions: {
        caption: By.className("tileCaption")
    }
};

export const shellSession = {
    exists: By.id("shellEditorHost"),
    currentLine: By.className("current-line"),
    textArea: By.css("textArea"),
    schemaTabSelector: By.id("schema"),
}

export const sqlEditorPage = {
    icon: By.id("gui.sqleditor"),
    tabName: By.css("#connections > .label"),
    title: By.css(".connectionBrowser #title"),
    contentTitle: By.css(".connectionBrowser #contentTitle")
};

export const debuggerPage = {
    icon: By.id("debugger"),
    scripts: By.css("#scriptSectionHost .label"),
    toolbar: {
        item: By.css("#messageOutputHost .label")
    },
    outputHost: By.id("outputPaneHost"),
    inputConsoleItem: By.css("#inputAreaHost .label"),
};

export const settingsPage = {
    exists: By.id("settingsHost"),
    icon: By.id("settings"),
    menuItem: By.css(".settingsTreeCell label"),
    settingsList: {
        exists: By.id("settingsValueList"),
        currentTheme: By.id("theming.currentTheme"),
        openThemeEditorButton: By.xpath("//div[contains(@caption, 'Click to Open the Theme Editor')]"),
        wordWrap: By.id("editor.wordWrap"),
        wordWrapColumn: By.id("editor.wordWrapColumn"),
        invisibleCharacters: By.id("editor.showHidden"),
        mysqlDBVersion: By.id("editor.dbVersion"),
        sqlMode: By.id("editor.sqlMode"),
        stopOnErrors: By.id("editor.stopOnErrors"),
        dbEditorShowGreeting: By.id("dbEditor.connectionBrowser.showGreeting"),
        limitCount: By.id("sql.limitRowCount"),
        limitRowCount: By.id("sql.limitRowCount"),
        shellShowGreeting: By.id("shellSession.sessionBrowser.showGreeting"),
    }
}

export const aboutPage = {
    tab: By.id("about"),
    title: By.id("headingLabel"),
    sakilaLogo: By.id("sakilaLogo"),
    links: By.css("#aboutBoxLinks a"),
    otherTitle: By.css(".gridCell.heading > label"),
    leftTableCells: By.css(".gridCell.left"),
    rightTableCells: By.css(".gridCell.right"),
    copyright: By.css(".copyright"),
}

export const themeEditorPage = {
    tab: By.id("themeEditor"),
    themeEditorTitle: By.css(".themeEditor > label"),
    themeSelectorArea: {
        exists: By.id("themeSelectorContainer"),
        sectionTitle: By.css("#themeSelectorContainer .gridCell label"),
        colorPad: By.id("colorPadCell"),

    },
    themeEditorTabs: {
        syntaxColors: By.id("syntaxColors"),
        uiColors: By.id("uiColors")
    },
    themePreview: {
        title: By.id("previewTitle"),
        section: By.css("#previewRoot p"),
    }
}

export const errorPanel = {
    exists: By.css(".visible.errorPanel"),
    title: By.css(".title label"),
    content: By.css(".content label")
}

export const passwordDialog = {
    exists: By.css(".passwordDialog"),
    cancel: By.id("cancel")
}