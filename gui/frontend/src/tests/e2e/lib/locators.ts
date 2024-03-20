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

export const searchById = (id: string): By => {
    return By.id(id);
};

export const searchByCss = (id: string): By => {
    return By.css(id);
};

// DATABASE CONNECTION CONFIGURATION
export const databaseConnectionConfiguration = {
    exists: By.className("valueEditDialog"),
    basicTab: By.id("page0"),
    sslTab: By.id("page1"),
    advancedTab: By.id("page2"),
    mdsTab: By.id("page3"),
    databaseType: {
        exists: By.id("databaseType"),
        list: By.className("dropdownList"),
        databaseTypeMysql: By.id("MySQL"),
        databaseTypeSqlite: By.id("Sqlite"),
    },
    caption: By.id("caption"),
    description: By.id("description"),
    mysql: {
        basic: {
            hostname: By.id("hostName"),
            protocol: {
                exists: By.id("scheme"),
                list: By.className("dropdownList"),
            },
            username: By.id("userName"),
            schema: By.id("defaultSchema"),
            port: By.css("#port input"),
        },
        ssl: {
            modeList: {
                exists: By.id("sslModePopup"),
                requireAndVerifyCA: By.id("Require and Verify CA"),
            },
            mode: By.id("sslMode"),
            modeLabel: By.css("#sslMode label"),
            ca: By.id("sslCaFile"),
            cert: By.id("sslCertFile"),
            key: By.id("sslKeyFile"),
            inputs: By.css(".tabview.top input.msg"),
        },
    },
    sqlite: {
        basic: {
            dbFilePath: By.id("dbFilePath"),
            dbName: By.id("dbName"),
        },
        advanced: {
            otherParams: By.id("otherParameters"),
        },
    },
    close: By.id("closeButton"),
    ok: By.id("ok"),
    cancel: By.id("cancel"),
    errors: By.css(".message.error"),
};

// CONFIRM DIALOG
export const confirmDialog = {
    exists: By.className("confirmDialog"),
    accept: By.id("accept"),
    refuse: By.id("refuse"),
    alternative: By.id("alternative"),
    title: By.css(".title label"),
    message: By.id("dialogMessage"),
    cancel: By.id("alternative"),
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
        item: By.css("#tilesHost .connectionTile"),
        caption: By.className("tileCaption"),
        description: By.className("tileDescription"),
        actions: {
            moreActions: By.id("tileMoreActionsAction"),
            newNotebook: By.id("tileNewNotebookAction"),
            newScript: By.id("tileNewScriptAction"),
            edit: By.id("edit"),
            duplicate: By.id("duplicate"),
            remove: By.id("remove"),
        },
    },
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
    headings: By.css(".gridCell.title"),
};

export const treeToggle = By.css("span.treeToggle");
export const treeContextMenu = {
    exists: By.css(".noArrow.menu"),
    selectRows: By.id("selectRowsMenuItem"),
};

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
            iconType: By.css(".msg.icon"),
        },
        button: {
            exists: By.className("button"),
            icon: By.className("icon"),
        },
    },
    codeEditor: {
        textArea: By.css("textarea"),
        editor: {
            exists: By.className("monaco-editor-background"),
            line: By.css("#contentHost .editorHost .view-line"),
            linesContent: By.className("lines-content"),
            currentLine: By.className("current-line"),
            lineNumber: By.css(".margin-view-overlays .line-numbers"),
            host: By.id("editorPaneHost"),
            editorHost: By.className("editorHost"),
            scrollBar: By.className("editor-scrollable"),
            result: {
                exists: By.className("zoneHost"),
                hasContent: By.className("content"),
                existsById: (view: string): By => {
                    let xpath = `//div[@class='zoneHost' and (`;
                    xpath += `
                        @monaco-view-zone='b${view}' or
                        @monaco-view-zone='c${view}' or
                        @monaco-view-zone='d${view}' or
                        @monaco-view-zone='e${view}' or
                        @monaco-view-zone='f${view}' or
                        @monaco-view-zone='g${view}' or
                        @monaco-view-zone='h${view}' or
                        @monaco-view-zone='i${view}' or
                        @monaco-view-zone='j${view}' or
                        @monaco-view-zone='l${view}'
                        )]
                    `;

                    return By.xpath(xpath);
                },
                table: By.className("tabulator"),
                tableHeaders: By.className("tabulator-headers"),
                tableColumnTitle: By.className("tabulator-col-title"),
                tableRow: By.css(".tabulator-selectable.tabulator-row-odd"),
                tableRows: By.css(".tabulator-selectable.tabulator-row-odd"),
                addedTableRow: By.css(".tabulator-row.added"),
                tableCellUpDownInput: By.id("upDownInput"),
                deletedTableRow: By.css(".tabulator-row.deleted"),
                tableCell: By.className("tabulator-cell"),
                host: By.className("resultHost"),
                changedTableCell: By.css(".tabulator-cell.changed"),
                tableCellSelectList: {
                    exists: By.css(".cellEditorHost .dropdown"),
                    list: {
                        exists: By.id("Popup"),
                        item: By.css(".dropdownItem > label"),
                    },
                },
                tableCellDateTime: By.css("input.dateTime"),
                tableCellIcon: By.css(".iconHost .icon"),
                status: {
                    exists: By.className("resultStatus"),
                    text: By.css(".resultStatus > label"),
                    message: By.css(".containsMessage > div"),
                    toolbar: {
                        exists: By.css(".resultStatus .toolbar"),
                        showActionMenu: {
                            open: By.id("showActionMenu"),
                            exists: By.css(".popup.visible"),
                            closeResultSet: By.id("closeMenuItem"),
                        },
                        applyButton: By.id("applyButton"),
                        rollbackButton: By.id("rollbackButton"),
                        previewButton: By.id("previewButton"),
                        editButton: By.id("editButton"),
                        addNewRowButton: By.id("addNewRow"),
                    },
                },
                graphHost: {
                    exists: By.className("graphHost"),
                    column: By.css("rect"),
                },
                singleOutput: {
                    exists: By.className("outputHost"),
                    copy: By.className("copyButton"),
                },
                info: By.css(".message.info"),
                tabSection: {
                    exists: By.className("tabAreaContainer"),
                    tabs: By.css(".resultHost .tabArea div"),
                    tab: By.css(".tabArea .tabItem > label"),
                },
                text: {
                    exists: By.css(".textHost span, .resultText > span"),
                    entry: By.css(".entry > span"),
                    info: By.className("info"),
                },
                anyResult: By.css(".resultStatus .label,.actionOutput span > span"),
                script: By.className("standaloneScriptHost"),
                json: {
                    exists: By.css(".actionOutput .jsonView, label[data-lang='json']"),
                    field: By.css(".jsonView span > span"),
                },
                textOutput: By.css(".actionOutput span > span"),
                previewChanges: {
                    exists: By.className("sqlPreviewHost"),
                    title: By.className("sqlPreviewTitle"),
                    words: By.css(".sqlPreviewHost .Auto span > span"),
                },
                cellContextMenu: {
                    exists: By.id("cellContextMenu"),
                    capitalize: By.id("capitalizeMenuItem"),
                    lowerCase: By.id("lowerCaseMenuItem"),
                    upperCase: By.id("upperCaseMenuItem"),
                    toggleForDeletion: By.id("deleteRowMenuItem"),
                    copySingleRow: {
                        exists: By.id("copyRowSubmenu"),
                        subMenu: {
                            exists: By.css("#copyRowSubmenu .popup.visible"),
                            copyRow: By.id("copyRowMenuItem1"),
                            copyRowWithNames: By.id("copyRowMenuItem2"),
                            copyRowUnquoted: By.id("copyRowMenuItem3"),
                            copyRowWithNamesUnquoted: By.id("copyRowMenuItem4"),
                            copyRowWithNamesTabSeparated: By.id("copyRowMenuItem5"),
                            copyRowTabSeparated: By.id("copyRowMenuItem6"),
                        },
                    },
                    copyAllRows: {
                        exists: By.id("copyRowsSubmenu"),
                        subMenu: {
                            exists: By.css("#copyRowsSubmenu .popup.visible"),
                            copyAllRows: By.id("copyRowsMenuItem1"),
                            copyAllRowsWithNames: By.id("copyRowsMenuItem2"),
                            copyAllRowsUnquoted: By.id("copyRowsMenuItem3"),
                            copyAllRowsWithNamesUnquoted: By.id("copyRowsMenuItem4"),
                            copyAllRowsWithNamesTabSeparated: By.id("copyRowsMenuItem5"),
                            copyAllRowsTabSeparated: By.id("copyRowsMenuItem6"),
                        },
                    },
                    setFieldToNull: By.id("setNullMenuItem"),
                    copyField: By.id("copyFieldMenuItem"),
                    copyFieldUnquoted: By.id("copyFieldUnquotedMenuItem"),
                },
            },
            promptLine: By.css(".margin-view-overlays > div"),
            editorLine: By.css(".view-lines.monaco-mouse-cursor-text > div > span"),
            wordInSentence: By.css(".view-lines.monaco-mouse-cursor-text > div > span span"),
            editorPrompt: By.css(".view-lines.monaco-mouse-cursor-text .view-line"),
            statementStart: By.className("statementStart"),
            cursorLine: By.css(".view-overlays > div"),
        },
        prompt: {
            current: By.className("editorPromptFirst"),
        },
        scroll: By.css(".codeEditor .monaco-scrollable-element"),
        autoCompleteItems: By.css(".monaco-list .monaco-highlighted-label"),
        suggestionsMenu: By.css("div.contents"),
    },
    explorerHost: {
        exists: By.id("explorerHost"),
        openEditors: {
            exists: By.id("editorSectionHost"),
            container: By.css("div.container.section"),
            addConsole: By.id("addConsole"),
            textBox: By.css("#editorSectionHost input"),
            close: By.css("span.codicon-close"),
            item: By.css("div.accordionItem.closable"),
        },
        schemas: {
            exists: By.id("schemaSectionHost"),
            container: By.css("div.container.section"),
            default: By.css("#schemaSectionHost div.marked label"),
            treeToggle: By.css("span.treeToggle"),
            scroll: By.css("#schemaSectionHost .tabulator-tableholder"),
            objectByLevel: (level: number): By => {
                return By.css(`.tabulator-table .tabulator-tree-level-${level}`);
            },
            object: By.css(".schemaTreeEntry label"),
            table: By.className("tabulator-table"),
        },
        administration: {
            exists: By.id("adminSectionHost"),
            container: By.css("div.container.section"),
            scrollBar: By.className("fixedScrollbar"),
            item: By.className("accordionItem"),
            itemToClick: By.css("#adminSectionHost .accordionItem .label"),
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
            item: By.className("accordionItem"),
        },
    },
    serverStatus: {
        tableCells: By.css("#statusBoxHost .gridCell"),
    },
    connectionTab: {
        exists: By.className("hasAuxillary"),
        opened: By.css(".hasAuxillary.selected"),
        close: By.css("#auxillary .closeButton"),
    },
};

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
    toggleReplace: By.css(".button.toggle"),
    toggleReplaceExpanded: By.css(".button.toggle.codicon-find-expanded"),
};

export const htmlTag = {
    label: By.css("label"),
    span: By.css("span"),
    div: By.css("div"),
    img: By.css("img"),
    input: By.css("input"),
    mix: (...locators: string[]): By => {
        return By.css(locators.join(" > "));
    },
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
        docs: By.linkText("Documentation >"),
    },
    contentTitle: By.css("#shellModuleHost #contentTitle"),
    sessions: {
        caption: By.className("tileCaption"),
        open: By.css("#shellModuleHost #tilesHost button"),
        newSession: By.css("#shellModuleHost #\\-1"),
        tile: By.css("#shellModuleHost #tilesHost .sessionTile"),
    },
};

export const shellSession = {
    exists: By.id("shellEditorHost"),
    currentLine: By.className("current-line"),
    textArea: By.css("textArea"),
    schemaTabSelector: By.id("schema"),
    result: {
        exists: By.className("zoneHost"),
        action: By.css(".actionLabel"),
        info: By.css(".resultStatus .info"),
        json: By.css(".zoneHost .jsonView .arrElem, .outputHost .jsonView"),
        tabs: By.css(".tabArea"),
        searchBySessionId: (id: string): By => {
            return By.xpath("//div[contains(@id, 'session_" + id + "')]");
        },
        dataSet: {
            cells: By.className("tabulator-cell"),
        },
        outputText: By.css(".actionOutput span > span"),
    },
    close: By.className("closeButton"),
    language: By.className("editorPromptFirst"),
    server: By.id("server"),
    schema: By.id("schema"),
    tabContextMenu: By.css(".visible.shellPromptSchemaMenu"),
    tabContextMenuItem: By.css("div.menuItem > label"),
    schemaItem: By.css("div.menuItem > label"),
};

export const sqlEditorPage = {
    icon: By.id("gui.sqleditor"),
    tabName: By.css("#connections > .label"),
    title: By.css(".connectionBrowser #title"),
    contentTitle: By.css(".connectionBrowser #contentTitle"),
};

export const debuggerPage = {
    icon: By.id("debugger"),
    scripts: By.css("#scriptSectionHost .label"),
    toolbar: {
        item: By.css("#messageOutputHost .label"),
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
    },
};

export const aboutPage = {
    tab: By.id("about"),
    title: By.id("headingLabel"),
    sakilaLogo: By.id("sakilaLogo"),
    links: By.css("#aboutBoxLinks a"),
    otherTitle: By.css(".gridCell.heading > label"),
    leftTableCells: By.css(".gridCell.left"),
    rightTableCells: By.css(".gridCell.right"),
    copyright: By.css(".copyright"),
};

export const themeEditorPage = {
    tab: By.id("themeEditor"),
    themeEditorTitle: By.css(".themeEditor > label"),
    themeSelectorArea: {
        exists: By.id("themeSelectorContainer"),
        sectionTitle: By.css("#themeSelectorContainer .gridCell label"),
        colorPad: {
            exists: By.id("colorPadCell"),
            colors: By.css("#colorPadCell > div"),
        },
        selector: By.id("theming.currentTheme"),
        selectorList: By.className("dropdownList"),
        colorPopup: By.className("colorPopup"),
    },
    themeEditorTabs: {
        container: By.id("themeTabview"),
        syntaxColors: By.id("syntaxColors"),
        uiColors: By.id("uiColors"),
        scroll: By.className("tabulator-tableholder"),
        tabElements: By.css(".tabulator-tableholder .tabulator-selectable"),
        toggleElement: By.className("treeToggle"),
    },
    themePreview: {
        title: By.id("previewTitle"),
        section: By.css("#previewRoot p"),
    },
};

export const errorPanel = {
    exists: By.css(".visible.errorPanel"),
    title: By.css(".title label"),
    content: By.css(".content label"),
    close: By.css(".visible.errorPanel .button"),
};

export const passwordDialog = {
    exists: By.css(".passwordDialog"),
    title: By.css(".title .label"),
    cancel: By.id("cancel"),
    ok: By.id("ok"),
    items: By.css("div.grid > div"),
    itemsText: By.css(".resultText span"),
    password: By.css("input"),
};

export const loginPage = {
    sakilaLogo: By.id("loginDialogSakilaLogo"),
};

export const mainActivityBar = By.id("mainActivityBar");

export const suggestWidget = {
    exists: By.css(".suggest-widget.visible"),
};

export const checkBox = {
    unchecked: By.css(".checkbox.unchecked"),
    checkMark: By.className("checkMark"),
};

export const genericDialog = {
    exists: By.className("valueEditDialog"),
};
