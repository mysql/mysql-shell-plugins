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

export { WsdebuggerModule };

import * as utils from '../utils.js';

class WsdebuggerModule {
    constructor(app, webSocket, onDebuggerContentLoaded) {
        // Hold a reference to the mysqlshApp instance
        this.app = app;

        // Hold a reference to the webSocket
        this._webSocket = webSocket;

        // Hold the callback that should be called after the content has been
        // loaded
        this._onDebuggerContentLoaded = onDebuggerContentLoaded;

        this.outputEditor = null;
        this.inputEditor = null;
        this.templateEditor = null;


        // Load the wsdebugger.css
        utils.loadCss('./incs/wsdebugger/wsdebugger.css');

        // Load the dashboard HTML
        this.loadDebuggerContent();

        this.registerWebSocketHandlers();

        // Add resize function to refresh the Monaco editor
        this.app.onWindowResizeFunctions.push(this.onWindowResize.bind(this));
    }

    /**
     * loadDashboardTab - Loads the MySQLaaS Dashboard tab content
     *
     * @return {void}
     */
    async loadDebuggerContent() {
        // Load tab content
        const content = document.getElementById('module_content_wsdebugger');
        content.innerHTML = await utils.fetchHtmlAsText(
            './incs/wsdebugger/wsdebugger.html');

        this.outputEditor = monaco.editor.create(
            document.getElementById('output_container'), {
            language: 'javascript',
            theme: 'vs-dark',
            automaticLayout: false,
            lineNumbers: 'off',
            folding: false,
            glyphMargin: true,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 0,
            scrollBeyondLastLine: false,
        });

        this.inputEditor = monaco.editor.create(document.getElementById('input_container'), {
            value: this.getInputEditorContent(),
            language: 'javascript',
            theme: 'vs-dark',
            automaticLayout: false,
            minimap: { enabled: false }
          });
          this.inputEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            this.executeScript();
          });

        this.templateEditor = monaco.editor.create(document.getElementById('template_container'), {
            value: this.getTemplateEditorContent(),
            language: 'javascript',
            theme: 'vs-dark',
            automaticLayout: false,
            lineNumbers: 'off',
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 0,
            minimap: { enabled: false }
          });

        // Prepare Toolbar buttons
        document.getElementById('ClearOutputBtn').addEventListener('click', e => {
            this.outputEditor.setValue('');
            this.inputEditor.focus();
            this.outputEditor.layout();
        });

        document.myform.sendButton.addEventListener('click', e => {
            this.executeScript();
        });
        document.myform.clearInputButton.addEventListener('click', e => {
            this.inputEditor.setValue('');
            this.inputEditor.focus();
        });
        document.myform.connectButton.addEventListener('click', e => {
            this._webSocket.doConnect();
        });
        document.myform.disconnectButton.addEventListener('click', e => {
            this._webSocket.doDisconnect();
        });
        document.myform.disconnectButton.disabled = true;

        if (this._onDebuggerContentLoaded) {
            this._onDebuggerContentLoaded();
        }
    }

    getInputEditorContent() {
        return `// Start SqlEditor session
ws.doSend({
    "request": "execute",
    "request_id": ws.generatedRequestId(),
    "command": "gui_plugin.sqleditor.start_session",
    "args": {}
});

// Open SqlEditor DBconnection
ws.doSend({
    "request": "execute",
    "request_id": ws.generatedRequestId(),
    "module_session_id": await ws.get_last_module_session_id_async(),
    "command": "gui_plugin.sqleditor.open_connection",
    "args": {
        "db_connection_id": 1
    }
});

// Run SQL Query
ws.doSend({
    "request": "execute",
    "request_id": ws.generatedRequestId(),
    "module_session_id": ws.last_module_session_id,
    "command": "gui_plugin.sqleditor.execute",
    "args": {
        "sql": "SELECT * FROM sqlite_master WHERE type = 'table' ORDER BY tbl_name"
    }
});`;
    }

    getTemplateEditorContent() {
        return `// Authenticate
ws.doSend({"request": "authenticate", "request_id": ws.generatedRequestId(), "username":"mike", "password":"1234"});

ws.doSend({"request": "authenticate", "request_id": ws.generatedRequestId(), "username":"jack", "password":"9876"});

// Commands
ws.doSend({"request": "execute", "request_id": ws.generatedRequestId(),
    "command":"gui_plugin.users.list_users", "args": {}});

ws.doSend({"request": "execute", "request_id": ws.generatedRequestId(),
    "command":"gui_plugin.users.list_user_roles", "args": {"username": "mike"}});

ws.doSend({"request": "execute", "request_id": ws.generatedRequestId(),
    "command":"gui_plugin.users.get_gui_module_list", "args": {}});

ws.doSend({"request": "execute", "request_id": ws.generatedRequestId(),
    "command":"gui_plugin.sqleditor.get_gui_module_display_info", "args": {}});

ws.doSend({"request": "execute", "request_id": ws.generatedRequestId(),
    "command": "gui_plugin.modules.get_module_options", "args": {"module_id":"gui_plugin.sqleditor"}});

ws.doSend({"request": "execute", "request_id": ws.generatedRequestId(),
    "command": "gui_plugin.modules.set_module_options", "args":
    {"module_id":"gui_plugin.sqleditor", "options": "{\\\"mySetting\\\": 1}"}});

ws.doSend({"request": "execute", "request_id": ws.generatedRequestId(),
    "command":"gui_plugin.modules.async_test_function", "args": {}});

// Add a profile
ws.doSend({
    "request": "execute",
    "request_id": ws.generatedRequestId(),
    "command": "gui_plugin.users.add_profile",
    "args": {
        "profile": {
            "name": "Development",
            "description": "This profile contains all settings for development.",
            "options": {
                "myOption": 23
            }
        }
    }
});

// Add a db connections
ws.doSend({
    "request": "execute",
    "request_id": ws.generatedRequestId(),
    "command": "gui_plugin.dbconnections.add_db_connection",
    "args": {
        "folder_path": "myConnections",
        "connection": {
            "caption": "Localhost 3306",
            "options": {
                "uri": "mysql://mike@localhost:3306/test",
                "password": "myPassword2BeStoredEncrypted"
            }
        }
    }
});

ws.doSend({
    "request": "execute",
    "request_id": ws.generatedRequestId(),
    "command": "gui_plugin.dbconnections.add_db_connection",
    "args": {
        "folder_path": "",
        "connection": {
            "caption": "MSG backend",
            "description": "MySQL Shell GUI backend",
            "db_type": "MySQL",
            "options": {
                "db_file": "/Users/mzinner/.mysqlsh/mysqlsh_gui_backend_0.0.5.sqlite3",
                "attach": [
                    {
                    "db_file": ":memory:",
                    "database_name": "MemoryDb"
                    }
                ]
                }
        }
    }
});

// List db connections
ws.doSend({"request": "execute",
    "request_id": ws.generatedRequestId(),
    "command":"gui_plugin.dbconnections.list_db_connections", "args": {}});

// get a db connection
ws.doSend({
    "request": "execute",
    "request_id": ws.generatedRequestId(),
    "command": "gui_plugin.dbconnections.get_db_connection",
    "args": {
        "db_connection_id": 2
    }
});

// Add module option
ws.doSend({
    "request": "execute",
    "request_id": ws.generatedRequestId(),
    "command": "gui_plugin.modules.set_module_options",
    "args": {
        "module_id": "gui_plugin.shell",
        "options": {
            "myOption": 1
        }
    }
});

// Start SqlEditor session
ws.doSend({
    "request": "execute",
    "request_id": ws.generatedRequestId(),
    "command": "gui_plugin.sqleditor.start_session",
    "args": {}
});

// Open SqlEditor DBconnection
ws.doSend({
    "request": "execute",
    "request_id": ws.generatedRequestId(),
    "module_session_id": await ws.get_last_module_session_id_async(),
    "command": "gui_plugin.sqleditor.open_connection",
    "args": {
        "db_connection_id": 1
    }
});

// Run SQL Query
ws.doSend({
    "request": "execute",
    "request_id": ws.generatedRequestId(),
    "module_session_id": ws.last_module_session_id,
    "command": "gui_plugin.sqleditor.execute",
    "args": {
        "sql": "SELECT * FROM sqlite_master WHERE type = 'table' AND tbl_name LIKE ? ORDER BY tbl_name",
        "params": ["user%"]
    }
});

// Get Schemata
ws.doSend({
    "request": "execute",
    "request_id": ws.generatedRequestId(),
    "module_session_id": ws.last_module_session_id,
    "command": "gui_plugin.sqleditor.get_schemata",
    "args": {}
});

// Get Schema Tables
ws.doSend({
    "request": "execute",
    "request_id": ws.generatedRequestId(),
    "module_session_id": ws.last_module_session_id,
    "command": "gui_plugin.sqleditor.get_schema_tables",
    "args": {
        "schema_name": "main"
    }
});

// Get Schema Table Columns
ws.doSend({
    "request": "execute",
    "request_id": ws.generatedRequestId(),
    "module_session_id": ws.last_module_session_id,
    "command": "gui_plugin.sqleditor.get_schema_table_columns",
    "args": {
        "schema_name": "main",
        "table_name": "user"
    }
});

// Close SqlEditor session
ws.doSend({
    "request": "execute",
    "request_id": ws.generatedRequestId(),
    "module_session_id": ws.last_module_session_id,
    "command": "gui_plugin.sqleditor.close_session",
    "args": {}
});
`;
    }

    registerWebSocketHandlers() {
        this._webSocket.addLogFunction(this.writeToScreen.bind(this))

        this._webSocket.addEventHandler('onopen', (event) => {
            document.myform.connectButton.disabled = true;
            document.myform.disconnectButton.disabled = false;
        });

        this._webSocket.addEventHandler('onclose', (event) => {
            document.myform.connectButton.disabled = false;
            document.myform.disconnectButton.disabled = true;
        });

        this._webSocket.addEventHandler('onerror', (event) => {
            document.myform.connectButton.disabled = false;
            document.myform.disconnectButton.disabled = true;
        });
    }

    editorAppendText(editor, text, isCommand = true) {
        if (!editor) {
            return;
        }
        let lastLineCount = editor.getModel().getLineCount();
        const lastLineLength = editor.getModel().getLineMaxColumn(lastLineCount);

        const range = new monaco.Range(
            lastLineCount,
            lastLineLength,
            lastLineCount,
            lastLineLength
        );

        editor.executeEdits('', [
            { range: range, text: text }
        ]);

        let lineCount = editor.getModel().getLineCount();
        editor.setPosition({ lineNumber: lineCount, column: 1 });
        editor.revealLine(lineCount);

        if (isCommand === true) {
            let decorations = editor.deltaDecorations([], [
                {
                    range: new monaco.Range(
                        lastLineCount, 1,
                        lineCount - 1, 1),
                    options: {
                        isWholeLine: true,
                        className: 'myContentClass',
                        glyphMarginClassName: 'myGlyphMarginClass'
                    }
                }
            ]);
        }
    }

    writeToScreen(message, isCommand = true) {
        this.editorAppendText(this.outputEditor, String(message), isCommand);
        this.editorAppendText(this.outputEditor, '\n', false);
    }

    executeScript() {
        let script = this.inputEditor.getValue().trim();

        this.editorAppendText(this.outputEditor, script + '\n', true);

        try {
            this._webSocket.logSendMessageCommands = false;
            eval('(async () => {' + script +
                '\n ws.logSendMessageCommands = true;})()');
        } catch (e) {
            this._webSocket.logSendMessageCommands = true;
            this.writeToScreen(`/* ERROR: ${e} */\n`, false);
        }
        this.editorAppendText(this.outputEditor, '\n', false);

        /*let msg = this.inputEditor.getValue();
        let re = /\s*ws\.doSend\s*\(((.|\n)*)\)\;/gm;
        let m = msg.match(re)
        msg = m[1]
        msg = msg.replace('ws.last_module_session_id', '"' +
          ws.last_module_session_id + '"')
        msg = msg.replace('ws.generatedRequestId()', '"' +
          ws.generatedRequestId() + '"')
        ws.doSend(msg);*/
        this.inputEditor.focus();
    }

    doDisconnect() {
        this._webSocket.close();
    }

    /**
     * Resizes the Monaco editor
     *
     * @return {void}
     */
    onWindowResize() {
        if (this.outputEditor) {
            this.outputEditor.layout();
        }
        if (this.inputEditor) {
            this.inputEditor.layout();
        }
        if (this.templateEditor) {
            this.templateEditor.layout();
        }
    }
}
