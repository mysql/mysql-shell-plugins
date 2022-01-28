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

export { LoginDialog };

import * as utils from '../utils.js';

class LoginDialog {
    constructor(app, onSuccess) {
        // Hold a reference to the mysqlshApp instance
        this.app = app;

        // Callback that is called on successful login
        this._onSuccess = onSuccess;

        // Load the Login HTML
        this.loadLoginContent();
    }

    async loadLoginContent() {
        // Load tab content
        const content = document.getElementById('loginDialog');
        content.innerHTML = await utils.fetchHtmlAsText(
            './incs/login/login.html');

        this.addEventListeners();

        // Prepare login dialog
        const passwordInput = document.getElementById("loginPassword");
        passwordInput.focus();
        passwordInput.select();
    }

    addEventListeners() {
        document.loginForm.loginName.addEventListener(
            'keydown', e => {
                if (e.keyCode == 13) { this.doLogin(e); }
            });
        document.loginForm.loginPwd.addEventListener(
            'keydown', e => {
                if (e.keyCode == 13) { this.doLogin(e); }
            });
        document.getElementById('loginDialogProceedBtn').addEventListener(
            'click', e => {
                this.doLogin(e);
            });
    }

    doLogin(e) {
        // if the websocket is not connected yet, error out
        if (!ws.isConnected) {
            document.getElementById('loginStatus').innerHTML =
                "The websocket is not connected yet.";
        } else {
            // send the authenticate request and ...
            // register it as the 'Login' requestClass, so all classbacks that
            // are waiting for the requestClass 'Login' will be called
            this.app.webSocket.doSend('{"request": "authenticate", ' +
                '"username":"' + document.loginForm.loginName.value + '", ' +
                '"password":"' + document.loginForm.loginPwd.value + '"}',
                (msg) => this.handleLoginResponse(msg), null, null, 'Login');
        }
    }

    handleLoginResponse(msg) {
        if (msg.request_state.type == 'OK') {
            if (this._onSuccess) {
                this._onSuccess();
            }
            // Hide login overlay
            document.getElementById('loginDialog').style.display = 'none';
        } else {
            document.getElementById('loginStatus').innerHTML =
                msg.request_state.msg;
        }
    }
}
