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

export { MysqlshGuiApp };

import * as mysqlshWebsocket from './mysqlshWebsocket.js';
import * as loginDialog from './login/loginDialog.js';
import * as wsdebuggerModule from './wsdebugger/wsdebuggerModule.js';
import * as sqleditorModule from './sqleditor/sqleditorModule.js';

class MysqlshGuiApp {
    constructor() {
        // Check if the current browser session is using https
        let usingSecureConnection = window.location.protocol === 'https:';

        // Initialize the websocket connection
        this._webSocket = new mysqlshWebsocket.MysqlshWebsocket(
            usingSecureConnection);

        this.onWindowResizeFunctions = [];
        this.onThemeChangeFunctions = [];

        // Initialize the wsdebuggerModule and open the websocket connection
        // to the server after the debugger has been loaded
        this.wsdebuggerModule = new wsdebuggerModule.WsdebuggerModule(
            this, this.webSocket, () => this.openWebsocket());

        // Holds the list of open modules, initalize with the wsdebuggerModule
        this.modules = [this.wsdebuggerModule];

        // Add event listeners
        this.addEventListeners();

        // Load and display the Login dialog
        this._loginDialog = new loginDialog.LoginDialog(this,
            () => this.loginSuccess());
    }

    get webSocket() {
        return this._webSocket;
    }

    addEventListeners() {
        // Add event handler for settings icon click
        document.getElementById('nav_settings_icon')
            .addEventListener('click',
                () => this.handleSettingsIconClick);

        let sidenavModuleSqleditor = document.getElementById('sidenav_module_sqleditor'),
            sidenavIconSqleditor = document.getElementById('sidenav_icon_sqleditor'),
            moduleContentSqleditor = document.getElementById('module_content_sqleditor'),
            sidenavModuleWsdebugger = document.getElementById('sidenav_module_wsdebugger'),
            sidenavIconWsdebugger = document.getElementById('sidenav_icon_wsdebugger'),
            moduleContentWsdebugger = document.getElementById('module_content_wsdebugger');

        sidenavIconSqleditor.addEventListener('click', e => {
            sidenavModuleWsdebugger.classList.remove("sidenav_module_selected");
            sidenavIconWsdebugger.classList.remove("sidenav_icon_selected");
            sidenavModuleSqleditor.classList.add("sidenav_module_selected");
            sidenavIconSqleditor.classList.add("sidenav_icon_selected");

            moduleContentWsdebugger.classList.add('content_container_not_active');
            moduleContentSqleditor.classList.remove('content_container_not_active');

            // Call all registered Resize functions
            window.mysqlshGuiApp.onWindowResizeFunctions.forEach(
                resizeFunc => resizeFunc());
        });

        sidenavIconWsdebugger.addEventListener('click', e => {
            sidenavModuleSqleditor.classList.remove("sidenav_module_selected");
            sidenavIconSqleditor.classList.remove("sidenav_icon_selected");
            sidenavModuleWsdebugger.classList.add("sidenav_module_selected");
            sidenavIconWsdebugger.classList.add("sidenav_icon_selected");

            moduleContentSqleditor.classList.add('content_container_not_active');
            moduleContentWsdebugger.classList.remove('content_container_not_active');

            // Call all registered Resize functions
            window.mysqlshGuiApp.onWindowResizeFunctions.forEach(
                resizeFunc => resizeFunc());
        });
    }

    openWebsocket() {
        // Assign the websocket to a global ws variable so it can be easily accessed
        window.ws = this.webSocket;

        // Open the websocket connection
        this._webSocket.doConnect();

        // To demo the RequestClass handling, register a callback that will
        // be for a requestClass 'Login' response
        this._webSocket.addRequestClassListener('Login', (msg) => {
            this.setStatusBarText(msg.request_state.msg);
        });
    }

    setStatusBarText(txt) {
        document.getElementById('status_bar_text').innerHTML = txt;
    }

    loginSuccess() {
        // Hide wsdebugger module for now
        document.getElementById('module_content_wsdebugger')
            .classList.add('content_container_not_active');

        // Load Sqleditor module
        this.modules.push(new sqleditorModule.SqleditorModule(this));
    }

    /**
     * Event handler for settings icon click
     *
     * @return {void}
     */
    handleSettingsIconClick(event) {
        const docEl = document.documentElement;
        docEl.classList.add('color-theme-in-transition');
        docEl.setAttribute('data-theme',
            (docEl.getAttribute('data-theme') === 'light') ?
                'dark' : 'light');
        window.setTimeout(function () {
            document.documentElement.classList.remove(
                'color-theme-in-transition')
        }, 1000);

        window.mysqlshGuiApp.onThemeChangeFunctions.forEach(
            themeChangeFunc => themeChangeFunc(
                docEl.getAttribute('data-theme')));
    }
}

window.onload = function () {
    // Get Dark Mode preference
    const prefersColorSchemeDark = window.matchMedia('(prefers-color-scheme: dark)');
    if (prefersColorSchemeDark.matches) {
        // Apply a light color scheme
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }

    window.mysqlshGuiApp = new MysqlshGuiApp()
}

window.onresize = () => {
    // Call all registered Resize functions
    window.mysqlshGuiApp.onWindowResizeFunctions.forEach(
        resizeFunc => resizeFunc());
};

window.onbeforeunload = () => {
    return 'Are you sure you want to close the MySQL Shell GUI?';
}
