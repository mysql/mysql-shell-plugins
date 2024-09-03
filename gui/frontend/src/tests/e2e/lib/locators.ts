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
export const dbConnectionDialog = {
    exists: By.css(".visible.valueEditDialog"),
    tab: By.css(".tabArea label"),
    databaseType: By.id("databaseType"),
    caption: By.id("caption"),
    description: By.id("description"),
    clearPassword: By.id("clearPassword"),
    databaseTypeList: By.id("databaseTypePopup"),
    databaseTypeMysql: By.id("MySQL"),
    databaseTypeSqlite: By.id("Sqlite"),
    mysql: {
        basic: {
            hostname: By.id("hostName"),
            username: By.id("userName"),
            defaultSchema: By.id("defaultSchema"),
            protocol: By.id("scheme"),
            protocolList: By.id("schemePopup"),
            port: By.css("#port input"),
        },
        ssl: {
            modeList: By.id("sslModePopup"),
            mode: By.id("sslMode"),
            ciphers: By.id("sslCipher"),
            ca: By.id("sslCaFile"),
            cert: By.id("sslCertFile"),
            key: By.id("sslKeyFile"),
        },
        ssh: {
            uri: By.id("ssh"),
            privateKey: By.id("sshKeyFile"),
            customPath: By.id("sshConfigFilePath"),
        },
        mds: {
            profileNameList: By.id("profileNamePopup"),
            profileName: By.id("profileName"),
            sshPrivateKey: By.id("sshKeyFile"),
            sshPublicKey: By.id("sshPublicKeyFile"),
            dbSystemId: By.id("mysqlDbSystemId"),
            dbSystemName: By.id("mysqlDbSystemName"),
            bastionId: By.id("bastionId"),
            bastionName: By.id("bastionName"),
        },
        advanced: {
            sqlModeItem: By.css("#listContainer > label"),
            connectionTimeout: By.css("#content > input"),
            compression: By.id("compression"),
            compressionPopup: By.id("compressionPopup"),
            compressionLevel: By.css("#compressionLevel input"),
            compressionAlgorithms: By.id("compressionAlgorithms"),
            disableHeatwaveCheck: By.id("disableHeatwaveCheck"),
            addNewProperty: By.id("buttonAddEntry"),
            removeProperty: By.id("buttonRemoveEntry"),
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
    ok: By.id("ok"),
    cancel: By.id("cancel"),
    errorMessage: By.css(".message.error"),
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

// DB CONNECTION OVERVIEW
export const dbConnectionOverview = {
    tab: By.id("connections"),
    exists: By.id("connectionOverviewToolbar"),
    title: By.id("title"),
    newConsoleButton: By.id("newConsoleMenuButton"),
    browser: By.className("connectionBrowser"),
    newDBConnection: By.id("-1"),
    dbConnection: {
        tile: By.css("#tilesHost .connectionTile"),
        caption: By.className("tileCaption"),
        description: By.css(".tileDescription"),
        moreActions: By.id("tileMoreActionsAction"),
        moreActionsMenu: {
            exists: By.css("#tileActionMenu > div.popup.visible"),
            editConnection: By.id("edit"),
            duplicateConnection: By.id("duplicate"),
            removeConnection: By.id("remove"),
        },
        newNotebook: By.id("tileNewNotebookAction"),
        newScript: By.id("tileNewScriptAction"),
        contextMenu: By.css(".noArrow.menu"),
    },
    closeHeader: By.id("closeButton"),
};

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

export const errorDialog = {
    exists: By.className("errorPanel"),
    message: By.id("errorMessage"),
};

export const shellConsole = {
    editor: By.id("shellEditorHost"),
    connectionTab: {
        server: By.id("server"),
        schema: By.id("schema"),
        schemaMenu: By.css(".visible.shellPromptSchemaMenu"),
        schemaItem: By.css("div.menuItem > label"),
    },
    currentLine: By.className("current-line"),
    prompt: By.css(".margin-view-overlays div div"),
    title: By.id("title"),
};

// NOTEBOOK
export const notebook = {
    exists: By.id("notebookHost"),
    toolbar: {
        exists: By.id("dbEditorToolbar"),
        button: {
            exists: By.className("button"),
            icon: By.className("icon"),
        },
        editorSelector: {
            exists: By.id("documentSelector"),
            list: {
                exists: By.id("documentSelectorPopup"),
                item: By.css("div.visible.dropdownList > div"),
            },
            currentValue: {
                label: By.className("label"),
                image: By.className("image"),
                icon: By.className("icon"),
            },
        },
        closeEditor: By.id("itemCloseButton"),
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
            sentence: By.css(".view-lines.monaco-mouse-cursor-text > div > span"),
            scrollBar: By.className("editor-scrollable"),
            autoCompleteListItem: By.css(".monaco-list .monaco-highlighted-label"),
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
                        @monaco-view-zone='i${view}'
                        )]
                    `;

                    return By.xpath(xpath);
                },
                host: By.className("resultHost"),
                table: By.className("tabulator"),
                tableColumn: By.className("tabulator-col"),
                changedTableCell: By.css(".tabulator-cell.changed"),
                resultGridScrollBar: By.className("tabulator-tableholder"),
                grid: {
                    exists: By.css(".resultTabview .resultView"),
                    headers: By.className("tabulator-headers"),
                    status: By.css(".resultStatus label, .resultStatus .info"),
                    content: By.className("tabulator"),
                    row: {
                        exists: By.className("tabulator-row"),
                        isSelected: By.className("tabulator-selected"),
                        cell: {
                            exists: By.className("tabulator-cell"),
                            dateTimeInput: By.css("input.dateTime"),
                            upDownInput: By.id("upDownInput"),
                            selectList: {
                                exists: By.css(".cellEditorHost .dropdown"),
                                list: {
                                    exists: By.id("Popup"),
                                    item: By.css(".dropdownItem label"),
                                },
                            },
                            icon: By.css(".iconHost .icon"),
                            contextMenu: {
                                exists: By.css("#cellContextMenu .popup.visible"),
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
                    },
                    column: By.className("tabulator-col"),
                    columnTitle: By.className("tabulator-col-title"),
                    newAddedRow: By.css(".tabulator-row.added"),
                    deletedRow: By.css(".tabulator-row.deleted"),
                },
                toolbar: {
                    exists: By.className("toolbar"),
                    status: {
                        exists: By.className("resultStatus"),
                        text: By.css(".resultStatus > label, .resultStatus .info"),
                        message: By.css(".containsMessage > div"),
                    },
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
                    maximize: By.id("toggleStateButton"),
                    normalize: By.id("normalizeResultStateButton"),
                    view: {
                        exists: By.id("viewStyleDropDown"),
                        isVisible: By.css("#viewStyleDropDownPopup .popup.visible"),
                        grid: By.id("grid"),
                        preview: By.id("preview"),
                    },
                },
                tabs: {
                    exists: By.className("tabAreaContainer"),
                    tab: By.css(".tabArea div.tabItem"),
                    body: By.className("tabArea"),
                },
                graphHost: {
                    exists: By.className("graphHost"),
                    column: By.css("rect"),
                },
                json: {
                    pretty: By.xpath(".//label[contains(@data-lang, 'json')]"),
                    raw: By.className("jsonView"),
                },
                singleOutput: {
                    exists: By.className("actionOutput"),
                    text: {
                        exists: By.xpath(".//label[@tabindex]"),
                        words: By.css(".actionOutput span"),
                        children: By.xpath(".//*"),
                    },
                    copy: By.className("copyButton"),
                },
                previewChanges: {
                    exists: By.className("sqlPreviewHost"),
                    title: By.className("sqlPreviewTitle"),
                    words: By.css(".sqlPreviewItem span span"),
                    link: By.css(".sqlPreviewItem > span"),
                },
                script: By.className("standaloneScriptHost"),
                textOutput: By.css(".actionOutput span > span"),
                cellContextMenu: {
                    exists: By.css("#cellContextMenu .popup.visible"),
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
                chat: {
                    aboutInfo: By.className("aboutResultPanel"),
                    isProcessingResult: By.className("chatResultInfo"),
                    resultText: By.className("chatResultText"),
                    resultContent: By.className("chatResultPanel"),
                },
                chatOptions: {
                    button: By.id("ChatOptionsIcon"),
                    panel: By.className("chatOptionsPanel"),
                    history: {
                        row: By.css("#historySectionHost .scopeMultiItemRow .tabulator-row"),
                        cell: {
                            userMessage: By.css("div.tabulator-cell[tabulator-field='userMessage']"),
                            chatBotMessage: By.css("div.tabulator-cell[tabulator-field='chatBotMessage']"),
                        },
                    },
                    databaseTable: By.css("#tablesSectionHost .scopeTables label"),
                    matchedDocuments: {
                        row: By.css("#docsSectionHost .scopeMultiItemRow .tabulator-row"),
                        cell: {
                            title: By.css("div.tabulator-cell[tabulator-field='title']"),
                            segment: By.css("div.tabulator-cell[tabulator-field='segment']"),
                        },
                    },
                    model: {
                        selectList: By.css("#modelSectionHost .scopeModel"),
                        list: By.css("#Popup .popup"),
                        item: {
                            llama2: By.id("llama2-7b-v1"),
                            mistral: By.id("mistral-7b-instruct-v1"),
                        },
                    },
                    temp: By.css("#modelSectionHost .scopeTemp"),
                    runAgain: By.css("#modelSectionHost div[caption='Run Again']"),
                    startNewChat: By.css("#modelSectionHost div[caption='Start New Chat']"),
                },

            },
            promptLine: By.css(".view-lines.monaco-mouse-cursor-text > div"),
            editorLine: By.css(".view-lines.monaco-mouse-cursor-text > div > span"),
            wordInSentence: By.css(".view-lines.monaco-mouse-cursor-text > div > span span"),
            editorPrompt: By.css(".view-lines.monaco-mouse-cursor-text .view-line"),
            statementStart: By.className("statementStart"),
            cursorLine: By.css(".view-overlays > div"),
        },
        prompt: {
            current: By.className("editorPromptFirst"),
        },
        tooltip: By.className("tooltip"),
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
            label: By.css("#adminSectionHost .accordionItem .label"),
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
    exists: By.css(".find-widget.visible"),
    actions: By.css(".find-actions div"),
    toggleReplace: By.css(".button.toggle"),
    toggleReplaceCollapsed: By.css(".button.toggle.codicon-find-collapsed"),
    toggleReplaceExpanded: By.css(".button.toggle.codicon-find-expanded"),
    replaceActions: By.css(".replace-actions div"),
    matchesCount: By.className("matchesCount"),
    findMatch: By.css(".cdr.findMatch"),
    replacePart: By.className("replace-part"),
    close: By.xpath(".//div[contains(@aria-label, 'Close')]"),
    textAreaFind: By.xpath(".//textarea[@aria-label='Find']"),
    textAreaReplace: By.xpath(".//textarea[@aria-label='Replace']"),
};

export const htmlTag = {
    label: By.css("label"),
    span: By.css("span"),
    div: By.css("div"),
    img: By.css("img"),
    input: By.css("input"),
    textArea: By.css("textarea"),
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
        exists: By.className("sessionTile"),
        caption: By.className("tileCaption"),
        open: By.css("#shellModuleHost #tilesHost button"),
        newSession: By.css("#shellModuleHost #\\-1"),
        tile: By.css("#shellModuleHost #tilesHost .sessionTile"),
    },
    sessionTabs: By.xpath(".//div[contains(@id, 'session_') and contains(@class, 'tabItem')]"),
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
        wordWrapColumn: {
            exists: By.id("editor.wordWrapColumn"),
            up: By.css("#editor\\.wordWrapColumn #up"),
        },
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

export const toastNotification = {
    exists: By.xpath("//div[contains(@id, 'toast-')]"),
    existsById: (id: string): By => {
        return By.xpath(`//div[@id='${id}']`);
    },
    error: By.className("codicon-error"),
    info: By.className("codicon-info"),
    message: By.css("label"),
    close: By.className("codicon-close"),
};

export const statusBar = {
    bell: {
        exists: By.id("showNotificationHistory"),
        bellIcon: By.className("codicon-bell"),
        bellIconWithDot: By.className("codicon-bell-dot"),
        silentMode: By.xpath("//div[contains(@class, 'slash')]"),
    },
    editorPosition: By.id("editorPosition"),
    editorIndent: By.id("editorIndent"),
    editorEOL: By.id("editorEOL"),
    editorLanguage: By.id("editorLanguage"),
};

export const notificationsCenter = {
    exists: By.className("notificationCenter"),
    isOpened: By.css(".notificationCenter > #historyHeader"),
    title: By.css("#historyHeader > label"),
    clear: By.className("codicon-clear-all"),
    silentMode: By.className("codicon-bell-slash"),
    close: By.className("codicon-chevron-down"),
    notificationsList: {
        exists: By.id("historyContainer"),
        item: {
            exists: By.className("toast"),
            type: By.className("icon"),
            message: By.css("label"),
            close: By.className("closeButton"),
        },
    },
};

