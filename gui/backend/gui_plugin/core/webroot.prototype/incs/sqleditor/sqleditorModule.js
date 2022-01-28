/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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

// Set the default export
export default ["1.0"];

export { SqleditorModule };

import * as utils from '../utils.js';
import * as sqleditorProject from './sqleditorProject.js';

class SqleditorModule {
    constructor(app) {
        // Hold a reference to the mysqlshApp instance
        this.app = app;

        // The list of open SQL Editors
        this.editors = [];

        // Event handler function cache
        this.eventHandlerFunctions = [];

        // Load the dashboard HTML
        this.loadDashboardTab();

        // Load the project.css
        utils.loadCss('./incs/sqleditor/project.css');
        utils.loadCss('./incs/sqleditor/DbConnection.css');
    }

    /**
     * loadDashboardTab - Loads the MySQLaaS Dashboard tab content
     *
     * @return {void}
     */
    async loadDashboardTab() {
        // Add MySQLaaS Manager tab
        const tabId = 'sqleditor_dashboard_tab';
        this.createNewTab(tabId, 'SQL Editor',
            'images/icons/modules/gui.sqleditor.svg');

        // Switch to that tab
        this.switchTab(tabId);

        // Load tab content
        const content = document.getElementById(tabId + '_content');
        content.innerHTML = await utils.fetchHtmlAsText(
            './incs/sqleditor/dashboard.html');

        // Bind new DB Connection item clicks
        document.getElementById('sqleditor_new_db_connection_item')
            .addEventListener('click', (event) =>
                this.handleDbConnectionClick(event));

        // Listen to Enter keydowns
        content.addEventListener(
            'keydown', e => {
                if (e.keyCode == 13) {
                    // Call handleDbConnectionClick without event parameter
                    // to make it select the active DbConnection div

                    this.handleDbConnectionClick();
                }
            });

        // List current database connections
        this.listDbConnections(
            document.getElementById('sqleditor_db_connection_list'));
    }

    /**
     * List the user profile's database connections on the dashboard
     *
     * @return {void}
     */
    listDbConnections(itemListDiv) {
        const ws = this.app.webSocket;
        ws.doSend({
            "request": "execute",
            "command": "gui_plugin.dbconnections.list_db_connections",
            "args": {}
        }, (msg, itemListDiv) => {
            if (msg.request_state.type === 'OK') {
                const new_db_conn_item =
                    document.getElementById('sqleditor_new_db_connection_item');

                let firstItem = null;

                for (const item of msg.rows) {
                    // Create item div
                    const itemDiv = document.createElement('div');
                    itemDiv.id = 'db_connection_item_' + item.id;
                    itemDiv.classList.add('mod_dashboard_item');
                    itemDiv.setAttribute('tabindex', '0');

                    if (firstItem === null) {
                        firstItem = itemDiv;
                    }

                    // Add item object as itemData property
                    itemDiv.itemData = item;

                    // Add icon
                    const iconFilename =
                        'images/icons/sqleditor/db.connection.sqlite.svg';
                    const itemIcon = document.createElement('div');
                    itemIcon.style.maskImage = 'url(' + iconFilename + ')';
                    itemIcon.style.maskRepeat = 'no-repeat';
                    itemIcon.style.webkitMaskImage = 'url(' +
                        iconFilename + ')';
                    itemIcon.style.webkitMaskRepeat = 'no-repeat';
                    itemIcon.classList.add('item_icon');
                    itemDiv.appendChild(itemIcon);

                    // Add caption
                    const itemCaption = document.createElement('div');
                    let h3 = document.createElement("h3");
                    h3.innerHTML = item.caption;
                    itemCaption.appendChild(h3);
                    let p = document.createElement("p");
                    p.innerHTML = item.description;
                    itemCaption.appendChild(p);
                    itemDiv.appendChild(itemCaption);

                    // Add item to list div
                    //itemListDiv.appendChild(itemDiv);
                    itemListDiv.insertBefore(itemDiv, new_db_conn_item);

                    // Bind new project clicks
                    itemDiv.addEventListener('click', (event) =>
                        this.handleDbConnectionClick(event));
                }

                if (firstItem) {
                    firstItem.focus();
                }

            } else if (msg.request_state.type !== 'PENDING') {
                this.app.setStatusBarText(
                    `Cannot list DB Connections: ${msg.request_state.msg}`);
            }
        }, itemListDiv);
    }

    /**
     * addAndCacheEventHandler - Adds an event handler function to an element
     * using .bind() to enable access to this.
     *
     * @param   {object}  element    The element to get the event handler function
     * @param   {string}  eventType  The type of the event, e.g. 'click'
     * @param   {object}  func       The event handler function
     * @param   {object}  handlerCache      The cache array, optional
     * @return  {void}
     */
    addAndCacheEventHandler(element, eventType, handlerFunc, handlerCache) {
        const cache = handlerCache ? handlerCache : this.eventHandlerFunctions,
            funcBind = handlerFunc.bind(this);

        // Add { element, type, func } to cache
        cache.push({
            element: element,
            eventType: eventType,
            funcBind: funcBind
        });

        element.addEventListener(eventType, funcBind);
    }

    /**
     * removeCachedEventHandlers - Remove all cached event handler functions
     *
     * @param   {object}  handlerCache      The cache array, optional
     * @return  {void}
     */
    removeCachedEventHandlers(handlerCache) {
        const cache = handlerCache ? handlerCache : this.eventHandlerFunctions;
        let item;

        while (item = cache.pop()) {
            item.element.removeEventListener(item.eventType, item.funcBind);
        }
    }

    /**
     * Create a new DB Connection
     *
     * @return {void}
     */
    async createNewDbConnection() {
        // TODO
        this.app.setStatusBarText('Create new database connection');

        // Load dialog content
        const content = document.getElementById('overlayDialog');
        content.innerHTML = await utils.fetchHtmlAsText(
            './incs/sqleditor/DbConnection.html');

        // Show the dialog
        document.getElementById('overlayDialogBg').style.display = 'inherit';

        document.getElementById('dbConnectionCaption').focus();
        document.getElementById('dbConnectionCaption').select();

        // Register Button event listener
        this.addAndCacheEventHandler(
            document.getElementById('overlayDialogOKBtn'), 'click',
            this.handleDbConnectionDlgOk);
        this.addAndCacheEventHandler(
            document.getElementById('overlayDialogCancelBtn'), 'click',
            this.handleDbConnectionDlgCancel);
        this.addAndCacheEventHandler(
            document, 'keydown',
            this.handleDbConnectionDlgKey);
    }

    handleDbConnectionDlgCancel(event) {
        const dlgContainer = document.getElementById('overlayDialogBg');
        // Hide dialog
        dlgContainer.style.display = 'none';

        this.removeCachedEventHandlers();
    }

    handleDbConnectionDlgOk(event) {
        const addDbConnForm =
                document.getElementById("addDbConnectionForm"),
            dbCaption = addDbConnForm.elements["dbConnectionCaption"],
            dbDescription = addDbConnForm.elements["dbConnectionDescription"],
            dbType = addDbConnForm.elements["dbType"],
            sqliteDetailsForm =
                document.getElementById("sqliteConnectionDetails"),
            dbFilePath = sqliteDetailsForm.elements["dbFilePath"];

        const ws = this.app.webSocket;
        ws.doSend({
            "request": "execute",
            "command": "gui_plugin.dbconnections.add_db_connection",
            "args": {
                "folder_path": "",
                "connection": {
                    "caption": dbCaption.value,
                    "description": dbDescription.value,
                    "db_type_id": dbType.options[dbType.selectedIndex].value,
                    "options": {
                        "db_file": dbFilePath.value,
                        "attach": [
                        ]
                        }
                }
            }
        }, (msg, data) =>
            this.addDbConnectionResponseHandler(msg, data));

        // Hide dialog
        this.handleDbConnectionDlgCancel(event)
    }

    addDbConnectionResponseHandler(msg, data) {
        const dbConnectionListDiv =
            document.getElementById('sqleditor_db_connection_list');

        // Clear current list of database connections, except Add DB Connection
        while (dbConnectionListDiv.firstChild.id !==
            'sqleditor_new_db_connection_item') {
            dbConnectionListDiv.removeChild(dbConnectionListDiv.firstChild);
        }

        // List current database connections
        this.listDbConnections(dbConnectionListDiv);
    }

    handleDbConnectionDlgKey(event) {
        if (event.key === "Enter") {
            if (event.target.tagName === "INPUT" ||
                event.target.tagName === "SELECT") {
                event.preventDefault();
                utils.focusNextElement(event.target,
                    document.getElementById('overlayDialogBg'));
                return;
            } else if (event.target.tagName === "TEXTAREA") {
                if (event.metaKey) {
                    event.preventDefault();
                    utils.focusNextElement(event.target,
                        document.getElementById('overlayDialogBg'));
                    return;
                } else {
                    return;
                }
            }
            this.handleDbConnectionDlgOk(event);
        } else if (event.key === "Escape") {
            this.handleDbConnectionDlgCancel(event);
        }
    }

    /**
     * Open a DB Connection with the given id
     *
     * @return {void}
     */
    openDbConnection(dbConnection, secondaryEditorCount) {
        const ws = this.app.webSocket;
        ws.doSend({
            "request": "execute",
            "command": "gui_plugin.sqleditor.start_session",
            "args": {}
        }, (msg, data) =>
            this.openDbConnectionResponseHandler(msg, data),
            {
                "dbConnection": dbConnection,
                "secondaryEditorCount": secondaryEditorCount
            });
    }

    openDbConnectionResponseHandler(msg, data) {
        if (msg.request_state.type == 'OK') {
            const dbConnection = data.dbConnection;
            const secondaryEditorCount = data.secondaryEditorCount;
            const tabs = document.getElementById('sqleditor_tabs');
            const tabId = 'sqleditor_project_tab_' + (tabs.childElementCount - 1);

            let caption = dbConnection.caption;
            if (secondaryEditorCount > 0) {
                caption = caption + ` (${(secondaryEditorCount + 1)})`;
            }

            this.createNewTab(tabId, caption,
                'images/icons/sqleditor/db.connection.sqlite.svg');

            // Switch to that tab
            this.switchTab(tabId);

            // Create new MySQLaaS project
            this.editors.push(
                new sqleditorProject.SqleditorProject(this.app, tabId,
                    dbConnection, msg.module_session_id));
        } else {
            this.app.setStatusBarText(
                `Cannot open editor: ${msg.request_state.msg}`);
        }
    }

    handleDbConnectionClick(event) {
        let itemData = null,
            openConnectionEditorCount = 0;

        if (event) {
            // If the clicked div has a itemData property assigned, open the
            // connection with the given itemData.id
            itemData = event.currentTarget.itemData;
        } else {
            // if no parameter is given, take the active element
            itemData = document.activeElement.itemData;
        }

        if (itemData) {
            // Check if editor for this connection is already open,
            // switch to the tab of the editor if user does not hold cmd

            for (const editor of this.editors) {
                if (editor.dbConnection.id == itemData.id) {
                    if (!event.metaKey) {
                        this.switchTab(editor.tabId);
                        return;
                    }
                    openConnectionEditorCount++;
                }
            }


            this.openDbConnection(itemData, openConnectionEditorCount);
        } else {
            // Create a new
            this.createNewDbConnection();
        }

    }

    createNewTab(tabId, caption, iconFilename) {
        // Add new tab
        const tabs = document.getElementById('sqleditor_tabs'),
            tabContentContainer =
                document.getElementById('sqleditor_tab_content_container');

        // Add new tab
        const tabDiv = document.createElement('div');
        tabDiv.id = tabId;
        tabDiv.classList.add('tab');

        const tabIcon = document.createElement('div');
        tabIcon.style.maskImage = 'url(' + iconFilename + ')';
        tabIcon.style.maskRepeat = 'no-repeat';
        tabIcon.style.webkitMaskImage = 'url(' + iconFilename + ')';
        tabIcon.style.webkitMaskRepeat = 'no-repeat';
        tabIcon.classList.add('tab_icon');
        tabDiv.appendChild(tabIcon);

        const tabTxt = document.createTextNode(caption);
        tabDiv.appendChild(tabTxt);

        tabs.appendChild(tabDiv);

        // Add event listener to tab
        document.getElementById(tabId).addEventListener('click',
            this.handleTabClick.bind(this));

        // Add corresponding tab container
        const tabContentDiv = document.createElement('div');
        tabContentDiv.id = tabId + '_content';
        tabContentDiv.classList.add('tab_content');
        tabContentContainer.appendChild(tabContentDiv);
    }

    handleTabClick(event) {
        this.switchTab(event.target.id);
    }

    /**
     * switchTab - switches to a specific tab and content, hide all others and
     * their content
     *
     * @param  {Object} targetTabId  the id of the tab to switch to as string
     * @return {void}
     */
    switchTab(targetTabId) {
        const tabs = document.getElementById('sqleditor_tabs').childNodes;

        // Loop over all tabs
        for (let i = 0; i < tabs.length; i++) {
            const tab = tabs[i];
            if (tab.classList && tab.classList.contains('tab')) {
                // Show clicked tab with selected style
                if (tab.id === targetTabId) {
                    tab.classList.add('tab_selected');
                } else {
                    // Hide tab content of all other tabs
                    const tabContent =
                        document.getElementById(tab.id + '_content');
                    if (tabContent) {
                        tabContent.style.display = 'none';
                    }
                    // Remove selected style of all other tabs
                    tab.classList.remove('tab_selected');
                }
            }
        }
        // Show selected tab content
        const tabContent = document.getElementById(targetTabId + '_content');
        if (tabContent) {
            tabContent.style.display = 'flex';
        }
    }
}
