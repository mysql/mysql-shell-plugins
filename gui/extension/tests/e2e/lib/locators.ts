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
    basicTab: By.id("page0"),
    sslTab: By.id("page1"),
    advancedTab: By.id("page2"),
    mdsTab: By.id("page3"),
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
            port: By.css("#port input"),
        },
        ssl: {
            modeList: By.id("sslModePopup"),
            mode: By.id("sslMode"),
            ca: By.id("sslCaFile"),
            cert: By.id("sslCertFile"),
            key: By.id("sslKeyFile"),
        },
        mds: {
            profileNameList: By.id("profileNamePopup"),
            profileName: By.id("profileName"),
            dbSystemId: By.id("mysqlDbSystemId"),
            dbSystemName: By.id("mysqlDbSystemName"),
            bastionId: By.id("bastionId"),
            bastionName: By.id("bastionName"),
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
                tableRow: By.css(".tabulator-selectable.tabulator-row-odd"),
                addedTableRow: By.css(".tabulator-row.added"),
                deletedTableRow: By.css(".tabulator-row.deleted"),
                tableHeaders: By.className("tabulator-headers"),
                tableColumnTitle: By.className("tabulator-col-title"),
                tableCell: By.className("tabulator-cell"),
                changedTableCell: By.css(".tabulator-cell.changed"),
                tableCellSelectList: {
                    exists: By.css(".cellEditorHost .dropdown"),
                    list: {
                        exists: By.id("Popup"),
                        item: By.css(".dropdownItem > label"),
                    },
                },
                tableCellUpDownInput: By.id("upDownInput"),
                tableCellDateTime: By.css("input.dateTime"),
                tableCellIcon: By.css(".iconHost .icon"),
                status: {
                    exists: By.className("resultStatus"),
                    text: By.css(".resultStatus > label"),
                    message: By.css(".containsMessage > div"),
                    maximize: By.id("toggleStateButton"),
                    normalize: By.id("normalizeResultStateButton"),
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
                tabSection: {
                    exists: By.className("tabAreaContainer"),
                    body: By.className("tabArea"),
                    tab: By.css(".tabArea .tabItem > label"),
                },
                text: By.css(".resultText > span"),
                graphHost: {
                    exists: By.className("graphHost"),
                    column: By.css("rect"),
                },
                json: {
                    pretty: By.css(".actionOutput .jsonView"),
                    exists: By.xpath(".//label[contains(@data-lang, 'json')]"),
                    field: By.css(".jsonView span > span"),
                },
                singleOutput: {
                    exists: By.className("outputHost"),
                    copy: By.className("copyButton"),
                },
                previewChanges: {
                    exists: By.className("sqlPreviewHost"),
                    title: By.className("sqlPreviewTitle"),
                    words: By.css(".sqlPreviewHost .Auto span > span"),
                },
                script: By.className("standaloneScriptHost"),
                textOutput: By.css(".actionOutput span > span"),
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
                },
            },
        },
        prompt: {
            exists: By.css(".codeEditor .margin-view-overlays > div"),
            current: By.className("editorPromptFirst"),
        },
    },
    toolbar: {
        exists: By.id("dbEditorToolbar"),
        button: {
            exists: By.className("button"),
            icon: By.className("icon"),
        },
        editorSelector: {
            exists: By.id("documentSelector"),
            item: By.css("div.visible.dropdownList > div"),
            itemIcon: By.css(".msg.icon"),
        },
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
    close: By.xpath(".//div[contains(@title, 'Close')]"),
};

export const mrsServiceDialog = {
    exists: By.id("mrsServiceDialog"),
    servicePath: By.id("servicePath"),
    settings: {
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
    authAppLabel: By.css("#authApp label"),
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
        rowOwnershipField: By.id("rowUserOwnershipColumn"),
        rowUserOwnershipFieldList: By.id("rowUserOwnershipColumnPopup"),
        authStoredProcedure: By.id("authStoredProcedure"),
        rowUserOwnershipColumnLabel: By.css("#rowUserOwnershipColumn label"),
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
            editConnection: By.id("edit"),
        },
        contextMenu: By.css(".noArrow.menu"),
    },
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
