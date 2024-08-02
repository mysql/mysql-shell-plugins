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
 * along with this program; if not, write to the Free Software Foundation, Inc.,s
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */
import { By } from "vscode-extension-tester";

export const dbConnectionDialog = {
    exists: By.css(".visible.valueEditDialog"),
    tab: By.css(".tabArea label"),
    databaseType: By.id("databaseType"),
    caption: By.id("caption"),
    description: By.id("description"),
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

export const passwordDialog = {
    exists: By.css(".visible.passwordDialog"),
    password: By.css("input"),
    ok: By.id("ok"),
};

export const notebook = {
    exists: By.id("contentHost"),
    codeEditor: {
        exists: By.className("codeEditor"),
        textArea: By.css("textarea"),
        editor: {
            exists: By.className("monaco-editor-background"),
            host: By.id("editorPaneHost"),
            lines: By.css(".view-overlays > div"),
            promptLine: By.css(".view-lines.monaco-mouse-cursor-text > div"),
            sentence: By.css(".view-lines.monaco-mouse-cursor-text > div > span"),
            wordInSentence: By.css(".view-lines.monaco-mouse-cursor-text > div > span span"),
            line: By.css("#contentHost .editorHost .view-line"),
            lineNumber: By.css(".margin-view-overlays .line-numbers"),
            currentLine: By.className("current-line"),
            statementStart: By.className("statementStart"),
            autoCompleteListItem: By.css(".monaco-list .monaco-highlighted-label"),
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
        },
        prompt: {
            exists: By.css(".codeEditor .margin-view-overlays > div"),
            current: By.className("editorPromptFirst"),
        },
        tooltip: By.className("tooltip"),
    },
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
};

export const shellSession = {
    exists: By.id("sessionSelector"),
    result: {
        label: By.className("actionLabel"),
        output: By.className("actionOutput"),
        outputText: By.css(".actionOutput span > span"),
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

export const mrsServiceDialog = {
    exists: By.id("mrsServiceDialog"),
    servicePath: By.id("servicePath"),
    settings: {
        mrsAdminUser: By.id("mrsAdminUser"),
        mrsAdminUserPassword: By.id("mrsAdminUserPassword"),
        comments: By.id("comments"),
        hostNameFilter: By.id("hostName"),
    },
    optionsTab: By.id("page1"),
    options: {
        options: By.id("options"),
    },
    authenticationTab: By.id("page2"),
    authentication: {
        authPath: By.id("authPath"),
        authCompletedUrl: By.id("authCompletedUrl"),
        authCompletedUrlValidation: By.id("authCompletedUrlValidation"),
        authCompletedPageContent: By.id("authCompletedPageContent"),
    },
    authenticationAppsTab: By.id("page3"),
    authenticationApps: {
        vendorNameList: By.id("authApps.authVendorNamePopup"),
        vendorName: By.id("authApps.authVendorName"),
        authAppsName: By.id("authApps.name"),
        authAppsDescription: By.id("authApps.description"),
        authAppsId: By.id("authApps.appId"),
        authAppsAccessToken: By.id("authApps.accessToken"),
        authAppsUrl: By.id("authApps.url"),
        authAppsUrlDirectAuth: By.id("authApps.urlDirectAuth"),
    },
    ok: By.id("ok"),
    cancel: By.id("cancel"),
};

export const mrsSchemaDialog = {
    exists: By.id("mrsSchemaDialog"),
    service: By.id("service"),
    serviceList: By.id("servicePopup"),
    serviceLabel: By.css("#service label"),
    requestPath: By.id("requestPath"),
    settings: {
        dbSchemaName: By.id("dbSchemaName"),
        itemsPerPage: By.id("itemsPerPage"),
        comments: By.id("comments"),
    },
    optionsTab: By.id("page1"),
    options: {
        options: By.id("options"),
    },
    ok: By.id("ok"),
    cancel: By.id("cancel"),
};

export const mrsAuthenticationAppDialog = {
    exists: By.id("mrsAuthenticationAppDialog"),
    authVendorName: By.id("authVendorName"),
    authVendorNameList: By.id("authVendorNamePopup"),
    authAppName: By.id("name"),
    description: By.id("description"),
    accessToken: By.id("accessToken"),
    authAppId: By.id("appId"),
    authAppUrl: By.id("url"),
    urlDirectAuth: By.id("urlDirectAuth"),
    defaultRoleName: By.id("defaultRoleName"),
    defaultRoleList: By.id("defaultRoleNamePopup"),
    authVendorNameLabel: By.css("#authVendorName label"),
    defaultRoleNameLabel: By.css("#defaultRoleName label"),
    ok: By.id("ok"),
    cancel: By.id("cancel"),
};

export const mrsUserDialog = {
    exists: By.id("mrsUserDialog"),
    username: By.id("name"),
    password: By.id("authString"),
    authApp: By.id("authApp"),
    authAppList: By.id("authAppPopup"),
    email: By.id("email"),
    roles: By.id("roles"),
    appOptions: By.id("appOptions"),
    vendorUserId: By.id("vendorUserId"),
    mappedUserId: By.id("mappedUserId"),
    rolesLabel: By.css("#roles label"),
    rolesList: By.id("rolesPopup"),
    ok: By.id("ok"),
    cancel: By.id("cancel"),
};

export const mrsDbObjectDialog = {
    exists: By.id("mrsDbObjectDialog"),
    service: By.id("service"),
    schema: By.id("schema"),
    requestPath: By.id("requestPath"),
    serviceLabel: By.css("#service label"),
    schemaLabel: By.css("#schema label"),
    schemaList: By.id("schemaPopup"),
    serviceList: By.id("servicePopup"),
    jsonDuality: {
        dbObject: By.id("dbObject"),
        sdkLanguage: By.id("sdkLanguage"),
        sdkLanguageList: By.id("sdkLanguagePopup"),
        crud: By.css(".crudDiv div"),
        dbObjJsonField: By.css(".mrsObjectJsonFieldDiv.withoutChildren"),
        fieldOptionIcon: By.css(".fieldOptions > .icon"),
        sdkLanguageLabel: By.css("#sdkLanguage label"),
    },
    settingsTab: By.id("page1"),
    settings: {
        resultFormat: By.id("crudOperationFormat"),
        selectedResultFormat: By.css("#crudOperationFormat label"),
        resultFormatList: By.id("crudOperationFormatPopup"),
        itemsPerPage: By.id("itemsPerPage"),
        comments: By.id("comments"),
        mediaType: By.id("mediaType"),
    },
    authorizationTab: By.id("page2"),
    authorization: {
        authStoredProcedure: By.id("authStoredProcedure"),
    },
    optionsTab: By.id("page3"),
    options: {
        options: By.id("options"),
    },
    ok: By.id("ok"),
    cancel: By.id("cancel"),
};

export const hwDialog = {
    exists: By.css("#mdsHWLoadDataDialog .valueEditDialog"),
    schemas: By.id("schemas"),
    schemasList: By.css("#schemasPopup .popup.visible"),
    mode: By.id("mode"),
    modeList: By.css("#modePopup .popup.visible"),
    output: By.id("output"),
    outputList: By.css("#outputPopup .popup.visible"),
    disableUnsupportedColumns: By.id("disableUnsupportedColumns"),
    optimizeLoadParallelism: By.id("optimizeLoadParallelism"),
    enableMemoryCheck: By.id("enableMemoryCheck"),
    sqlMode: By.id("sqlMode"),
    excludeList: By.id("excludeList"),
    ok: By.id("ok"),
};

export const section = {
    item: By.className("custom-view-tree-node-item-resourceLabel"),
    itemIcon: By.className("custom-view-tree-node-item-icon"),
    itemName: By.className("monaco-highlighted-label"),
    actionsBar: By.className("actions"),
    actions: (section: string): By => {
        return By.xpath(`//ul[contains(@aria-label, '${section} actions')]`);
    },
    moreActions: By.xpath(".//a[contains(@title, 'More Actions...')]"),
    itemAction: (name: string): By => {
        return By.xpath(`.//a[contains(@class, 'action-label') and @role='button' and @aria-label='${name}']`);
    },
    loadingBar: By.css(".monaco-progress-container.active.infinite"),
};

export const bottomBarPanel = {
    exists: By.id("workbench.parts.panel"),
    close: By.css("a.codicon-panel-close"),
    output: By.xpath("//a[contains(@aria-label, 'Output (')]"),
};

export const confirmDialog = {
    exists: By.className("confirmDialog"),
    title: By.css(".title label"),
    msg: By.id("dialogMessage"),
    refuse: By.id("refuse"),
    accept: By.id("accept"),
    cancel: By.id("alternative"),
    alternative: By.id("alternative"),
};

export const errorDialog = {
    exists: By.className("errorPanel"),
    message: By.id("errorMessage"),
};

export const dbConnectionOverview = {
    exists: By.id("connectionOverviewToolbar"),
    title: By.id("title"),
    newConsoleButton: By.id("newConsoleMenuButton"),
    browser: By.className("connectionBrowser"),
    newDBConnection: By.id("-1"),
    dbConnection: {
        tile: By.css("#tilesHost .connectionTile"),
        caption: By.className("tileCaption"),
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

export const mysqlAdministration = {
    title: By.css("#header h1"),
    section: By.css("#statusBoxHost .heading > label"),
    clientConnections: {
        properties: By.css("#connectionProps > label"),
        connectionsList: By.id("connectionList"),
        tableRow: By.className("tabulator-row"),
    },
    performanceDashboard: {
        dashboardGrid: By.id("dashboardGrid"),
        gridItems: By.css(".gridCell.title"),
    },
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

export const terminal = {
    exists: By.id("terminal"),
    textArea: By.css("#terminal textarea"),
    moreActions: By.xpath(".//a[contains(@title, 'Views and More Actions...')]"),
    moreActionsMenu: By.css(".monaco-menu-container.bottom.right"),
    moreActionsMenuItem: By.css("span.codicon-menu-selection > span.action-label"),
};

export const contextMenu = {
    exists: By.className("shadow-root-host"),
    menuContainer: By.className("monaco-menu-container"),
    menuItem: By.className("action-label"),
};

export const inputBox = {
    exists: By.className("quick-input-widget"),
};

export const iframe = {
    exists: By.css("iframe"),
    container: By.xpath("//div[@data-parent-flow-to-element-id]"),
    isActive: By.id("active-frame"),
    isLoading: By.id("waitForContent"),
    frameMsg: By.id("frame-msg"),
};

export const shellForVscode = {
    loadingIcon: By.className("progress-badge"),
};

export const welcomeWizard = {
    title: By.css("#page1 h3"),
    nextButton: By.id("nextBtn"),
};

export const mrsDocumentation = {
    title: By.css("h1"),
    restServiceProperties: By.id("rest-service-properties"),
};

export const checkBox = {
    unchecked: By.css(".checkbox.unchecked"),
    checkMark: By.className("checkMark"),
};

export const genericDialog = {
    exists: By.className("valueEditDialog"),
};

export const suggestWidget = {
    exists: By.css(".suggest-widget.visible"),
};

export const htmlTag = {
    img: By.css("img"),
    li: By.css("li"),
    a: By.css("a"),
    label: By.css("label"),
    labelClass: By.className("label"),
    span: By.css("span"),
    h2: By.css("h2"),
    input: By.css("input"),
    textArea: By.css("textarea"),
};

export const dialogBox = {
    exists: By.className("monaco-dialog-box"),
    buttons: By.css(".dialog-buttons > a"),
};

export const mrsSdkDialog = {
    exists: By.id("mrsSdkExportDialog"),
    directory: By.id("directory"),
    serviceUrl: By.id("serviceUrl"),
    sdkLanguageList: By.css("#sdkLanguagePopup .popup.visible"),
    sdkLanguage: By.id("sdkLanguage"),
    appBaseClass: By.id("addAppBaseClass"),
    appBaseClassList: By.css("#addAppBaseClassPopup .popup.visible"),
    sdkFileHeader: By.id("header"),
    ok: By.id("ok"),
    cancel: By.id("cancel"),
};

export const lakeHouseNavigator = {
    exists: By.id("lakehouseNavigatorToolbar"),
    overview: {
        tab: By.id("overview"),
        uploadFiles: By.css("div[caption='Upload Files >>']"),
        startLoad: By.css("div[caption='Start Load >>']"),
        manageLakeHouse: By.css("div[caption='Manage Lakehouse']"),
    },
    uploadToObjectStorage: {
        tab: By.id("upload"),
        objectStorageBrowser: {
            exists: By.className("objectStorageBrowser"),
            ociProfile: By.css(".panelToolbar .dropdown"),
            ociProfileList: {
                exists: By.id("objBrowserOciProfileDropdownPopup"),
                item: (id: string): By => {
                    return By.id(id);
                },
            },
            refresh: By.css(".panelToolbar .refreshBtn"),
            objectStorageItem: {
                item: {
                    exists: By.css(".tabulator-row-odd, .tabulator-row-even"),
                    existsByLevel: (level: string): By => {
                        return By.className(`tabulator-tree-level-${level}`);
                    },
                    isLoading: By.css(".tabulator-row .codicon-loading"),
                    treeToggle: By.className("treeToggle"),
                    caption: By.className("itemCaption"),
                    checkbox: By.className("checkbox"),
                },
            },
        },
        filesForUpload: {
            path: By.id("uploadTargetPath"),
            button: By.css(".loadingTaskActionButtons .button"),
            file: By.css(".loadingTaskItem .itemCaption"),
        },
    },
    loadIntoLakeHouse: {
        tab: By.id("load"),
        newLoadingTask: {
            exists: By.css(".loadingTaskPreview .mainPanel"),
            name: By.id("loadTaskTableName"),
            description: By.id("loadTaskDescription"),
            targetSchema: {
                exists: By.id("loadTaskTargetSchemaDropdown"),
                value: By.css("#loadTaskTargetSchemaDropdown > label"),
                list: By.id("loadTaskTargetSchemaDropdownPopup"),
                item: (id: string): By => {
                    return By.id(id);
                },
            },
            formats: {
                exists: By.id("loadTaskFormatsDropdown"),
                value: By.css("#loadTaskFormatsDropdown > label"),
                list: By.id("loadTaskFormatsDropdownPopup"),
                item: {
                    all: By.id("all"),
                    pdf: By.id("pdf"),
                    txt: By.id("txt"),
                    html: By.id("html"),
                    doc: By.id("doc"),
                    ppt: By.id("ppt"),
                },
            },
            loadingTaskItem: {
                caption: By.css(".loadingTaskItem .itemCaption"),
            },
            startLoadingTask: By.id("loadStartLoadingTaskBtn"),
        },
    },
    lakeHouseTables: {
        tab: By.id("manage"),
        deleteTableBtn: By.id("lakehouseDeleteTablesBtn"),
        databaseSchemas: {
            item: By.className("schemaNameField"),
        },
        lakeHouseTables: {
            refresh: By.id("lakehouseRefreshBtn"),
            row: By.css("#lakehouseTablesTreeGrid .tabulator-row"),
            cell: {
                tableName: {
                    label: By.css('div.tabulator-cell[tabulator-field="tableName"] label'),
                    progressBar: By.css("div.tabulator-cell[tabulator-field='tableName'] .progressBar"),
                },
                loaded: {
                    loadingSpinner: By.className("codicon-loading"),
                    label: By.css('div.tabulator-cell[tabulator-field="loaded"]'),
                },
                rows: By.css('div.tabulator-cell[tabulator-field="rows"]'),
                size: By.css('div.tabulator-cell[tabulator-field="dataLength"]'),
                date: By.css('div.tabulator-cell[tabulator-field="lastChange"]'),
                comment: By.css('div.tabulator-cell[tabulator-field="comment"]'),
            },
        },
        delete: By.id("lakehouseDeleteTablesBtn"),
        currentTaskList: {
            exists: By.className("taskListPanel"),
            row: By.className("tabulator-row"),
            cell: {
                task: {
                    label: By.css('div.tabulator-cell[tabulator-field="title"] label'),
                    progressBar: By.css("div.tabulator-cell[tabulator-field='title'] .progressBar"),
                },
                id: By.css('div.tabulator-cell[tabulator-field="id"]'),
                status: By.css('div.tabulator-cell[tabulator-field="status"] label'),
                startTime: By.css('div.tabulator-cell[tabulator-field="startingTime"] label'),
                endTime: By.css('div.tabulator-cell[tabulator-field="estimatedCompletionTime"] label'),
                message: By.css('div.tabulator-cell[tabulator-field="statusMessage"] label'),
            },
        },
    },
};

export const sideBarItems = By.css(".composite-bar .actions-container > li");
export const togglePrimarySideBar = By.xpath("//a[contains(@aria-label, 'Toggle Primary Side Bar')]");

