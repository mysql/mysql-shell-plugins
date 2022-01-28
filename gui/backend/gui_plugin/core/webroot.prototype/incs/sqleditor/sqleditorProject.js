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

export { SqleditorProject };

import * as utils from '../utils.js';
import * as sqleditorCmd from './sqleditorCmd.js';

class SqleditorProject {
    constructor(app, tabId, dbConnection, moduleSessionId) {
        // Hold a reference to the mysqlshApp instance
        this.app = app;

        // The tabId that is holding the project
        this.tabId = tabId;

        // The module_session_id of this SQL Editor session
        this.moduleSessionId = moduleSessionId;

        // The db connection of this editor
        this.dbConnection = dbConnection;

        // The Monaco editor used for SQL editing
        this.editor = null;

        // Add resize function to refresh the Monaco editor
        this.app.onWindowResizeFunctions.push(this.onWindowResize.bind(this));
        // Add theme change response
        this.app.onThemeChangeFunctions.push(this.onThemeChange.bind(this));

        this.cmds = [];

        this.monacoDecoOwnerId = 4;
        this.editorLineCount = 0;
        this.refreshingAllCmdLineNumbers = false;
        this.scrolling = false;
        this.scrollingTimer = null;

        // The id of the Welcome View Zone
        this.welcomeViewZoneId = null;

        this.currentCmdLanguage = 'sql';

        // an sandboxed iframe for JavaScript execution
        this.jsSandboxIframe = null;


        // Initalize the project
        this.initProject();
    }

    async initProject() {
        // Load the project HTML content into the tab with the given tabId
        // and initalize the PixiApp
        await this.loadProjectTabContent();

        // Add event listeners for toolbar buttons and window resize
        this.addEventListeners();

        this.openDbConnection();

        // Initialize the Javascript sandbox environment
        this.jsSandboxIframe = this.getJsSandboxIframe();
    }

    openDbConnection() {
        const ws = this.app.webSocket;
        ws.doSend({
            "request": "execute",
            "module_session_id": this.moduleSessionId,
            "command": "gui_plugin.sqleditor.open_connection",
            "args": {
                "db_connection_id": this.dbConnection.id
            }
        }, (msg) => {
            if (msg.request_state.type === 'OK') {
                this.app.setStatusBarText(
                    'DB Connection opened successfully.');

                this.refreshExplorer();
            } else if (msg.request_state.type !== 'PENDING') {
                this.app.setStatusBarText(
                    `Cannot open DB Connection: ${msg.request_state.msg}`);
            }
        });
    }

    refreshExplorer() {
        const ws = this.app.webSocket;
        ws.doSend({
            "request": "execute",
            "module_session_id": this.moduleSessionId,
            "command": "gui_plugin.sqleditor.get_schemata",
        }, (msg) => {
            if (msg.request_state.type === 'OK') {
                let treeDiv = document.getElementById(this.tabId +
                    '_sql_editor_schema_treeview');
                for (const schema of msg.rows) {
                    const schemaDiv = document.createElement('div');
                    schemaDiv._id = schema.SCHEMA_NAME;
                    schemaDiv.classList.add('sql_editor_explorer_item');

                    const lbl = document.createTextNode('- ' + schema.SCHEMA_NAME);
                    schemaDiv.appendChild(lbl);

                    treeDiv.appendChild(schemaDiv);

                    // Load tables for the given schema
                    this.refreshSchemaTableList(schemaDiv);
                }
            } else if (msg.request_state.type !== 'PENDING') {
                this.app.setStatusBarText(
                    `Cannot get schemata list: ${msg.request_state.msg}`);
            }
        });
    }

    refreshSchemaTableList(schemaDiv) {
        const ws = this.app.webSocket;
        ws.doSend({
            "request": "execute",
            "module_session_id": this.moduleSessionId,
            "command": "gui_plugin.sqleditor.get_schema_tables",
            "args": {
                "schema_name": schemaDiv._id
            }
        }, (msg, schemaDiv) => {
            if (msg.request_state.type === 'OK') {
                for (const table of msg.rows) {
                    const tableDiv = document.createElement('div');
                    tableDiv._id = table.TABLE_NAME;
                    tableDiv.classList.add('sql_editor_explorer_item');

                    const lbl = document.createTextNode('+ ' +
                        table.TABLE_NAME);
                    tableDiv.appendChild(lbl);
                    tableDiv.addEventListener('click', (e) => {
                        this.editor.trigger('keyboard', 'type',
                            { text: `SELECT * FROM \`${e.currentTarget._id}\`;` });
                        this.editor.focus();
                    })

                    schemaDiv.appendChild(tableDiv);
                }
            } else if (msg.request_state.type !== 'PENDING') {
                this.app.setStatusBarText(
                    `Cannot get schemata list: ${msg.request_state.msg}`);
            }
        }, schemaDiv);
    }


    /**
     * loadProjectTabContent - Load the MySQLaaS Project tab
     *
     * @param  {Object} tabId  the id of the tab that will hold the project
     *                         content
     * @return {void}
     */
    async loadProjectTabContent(tabId) {
        // Load tab HTML content
        const content = document.getElementById(this.tabId + '_content');
        content.innerHTML = await utils.fetchHtmlAsText(
            './incs/sqleditor/project.html');

        document.getElementById('sqleditorClearOutputButton').id =
            this.tabId + '_sqleditorClearOutputButton';
        document.getElementById('sqleditorRefreshButton').id =
            this.tabId + '_sqleditorRefreshButton';
        document.getElementById('sql_editor_container').id =
            this.tabId + '_sql_editor_container';
        document.getElementById('sql_editor_schema_treeview').id =
            this.tabId + '_sql_editor_schema_treeview';
        document.getElementById('sql_editor_area').id =
            this.tabId + '_sql_editor_area';

        require("vs/editor/editor.main");

        monaco.editor.defineTheme('mysqlsh-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                /*{ token: 'green', background: 'FF0000', foreground: '00FF00', fontStyle: 'italic'},
                { token: 'red', foreground: 'FF0000' , fontStyle: 'bold underline'},
                { background: '000000' },
                { foreground: 'FFFFFF' }*/
            ],
            colors: {
                'editor.background': '#1D1D20',
            }
        });

        monaco.editor.defineTheme('mysqlsh-light', {
            base: 'vs',
            inherit: true,
            rules: [
                /*{ token: 'green', background: 'FF0000', foreground: '00FF00', fontStyle: 'italic'},
                { token: 'red', foreground: 'FF0000' , fontStyle: 'bold underline'},
                { background: '000000' },
                { foreground: 'FFFFFF' }*/
            ],
            colors: {
                'editor.background': '#E7E7E9',
            }
        });

        this.editor = monaco.editor.create(document.getElementById(this.tabId + '_sql_editor_container'), {
            language: 'sql',
            theme: 'mysqlsh-dark',
            automaticLayout: false,
            lineNumbers: 'off',
            folding: false,
            glyphMargin: false,
            lineDecorationsWidth: 40,
            lineNumbersMinChars: 0,
            //renderLineHighlight: 'line',
            //scrollBeyondLastLine: false,
            fontFamily: 'SourceCodePro+Powerline+Awesome+MySQL',
            fontSize: '14px',
            fontLigatures: true,
            value: ''
        });
        // Add command for CMD + Enter
        this.editor.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
            () => {
                this.handleEditorEnterKeyCommand(monaco.KeyMod.CtrlCmd);
            },
            'editorTextFocus && !suggestWidgetVisible && !renameInputVisible ' +
            '&& !inSnippetMode && !quickFixWidgetVisible');
        // Add command for Shift + Enter
        this.editor.addCommand(
            monaco.KeyMod.Shift | monaco.KeyCode.Enter,
            () => {
                this.handleEditorEnterKeyCommand(monaco.KeyMod.Shift)
            },
            'editorTextFocus && !suggestWidgetVisible && !renameInputVisible ' +
            '&& !inSnippetMode && !quickFixWidgetVisible');

        // Add line decoration change handler
        this.editor.onDidChangeModelDecorations(() => {
            // Make sure to refresh all cmd line numbers if a decoration
            // has changed
            this.refreshAllCmdLineNumbers();
        });
        // Add content change handler
        this.editor.onDidChangeModelContent(e => {
            /*const versionId = editor.getModel().getAlternativeVersionId();

            this.refreshingAllCmdLineNumbers = false;*/


        })

        this.editor.onDidScrollChange(() => {
            this.scrolling = true;
            if (this.scrollingTimer) {
                clearTimeout(this.scrollingTimer);
            }
            this.scrollingTimer = setTimeout(() => {
                this.scrolling = false;
                clearTimeout(this.scrollingTimer);

                this.scrollingTimer = null;
            }, 600);
        });

        // Add welcome zone
        this.addWelcomeZone();

        // Add first cmd and statementLine deco
        this.addCmd(this.editor.getModel().getLineCount());

        // Perform initial layout of the editor
        this.editor.layout();

        // Set the active focus to the editor
        this.editor.focus();
    };

    handleEditorEnterKeyCommand(modifier) {
        // Update cmd.startLineNumber & endLineNumber
        this.refreshAllCmdLineNumbers();

        // The get the current cmd index, lookup current line in the list
        // of cmds
        let cmdIndex = -1;
        let cmd = null;
        let currentLine = this.editor.getPosition().lineNumber;
        for (let i = 0; i < this.cmds.length; i++) {
            cmd = this.cmds[i];
            if (currentLine >= cmd.startLineNumber &&
                currentLine <= cmd.endLineNumber) {
                cmdIndex = i;
                break;
            }
        }
        if (cmdIndex > -1) {
            // Execute the statement, don't add a new prompt if there was
            // nothing to execute
            if (!cmd.executeCommand()) {
                return;
            }
        }

        // If modifier was Ctrl (Windows) or CMD and cursor is currently on
        // last statement, add new cmd at the end
        if (modifier == monaco.KeyMod.CtrlCmd &&
            cmdIndex == this.cmds.length - 1) {
            // Add a new line at the end of
            let lastLineCount = this.editor.getModel().getLineCount();
            const lastLineLength =
                this.editor.getModel().getLineMaxColumn(lastLineCount);

            const range = new monaco.Range(
                lastLineCount, lastLineLength, lastLineCount, lastLineLength
            );

            // Add line and set cursor onto the beginning of that line
            this.editor.executeEdits(
                '',
                [{ range: range, text: '\n' }],
                () => {
                    let sel = new monaco.Selection(lastLineCount + 1, 1,
                        lastLineCount + 1, 1);
                    return [sel];
                });

            // Add cmd on last line
            this.addCmd(lastLineCount + 1);

            // Make sure to scroll to the last line
            this.editor.revealLine(lastLineCount + 1);
        }
        // If modifier was Ctrl (Windows) or CMD and cursor is currently not on
        // last statement, simply position the cursor at the end of the next
        // statement
        else if (modifier == monaco.KeyMod.CtrlCmd &&
            cmdIndex < this.cmds.length - 1) {
            let nextCmd = this.cmds[cmdIndex + 1];
            if (nextCmd) {
                this.editor.setPosition(
                    {
                        lineNumber: nextCmd.endLineNumber,
                        column: this.editor.getModel().
                            getLineMaxColumn(nextCmd.endLineNumber)
                    });
                this.editor.revealLine(nextCmd.endLineNumber);
            }
        }
    }

    addWelcomeZone() {
        this.editor.changeViewZones((changeAccessor) => {
            const domNode = document.createElement('div');
            domNode.appendChild(document.createElement('p')).innerHTML =
                '<br>Welcome to the SQL Editor\'s interactive prompt.<br>' +
                '<br>' +
                'Press Shift+Enter to execute the statement.<br>' +
                'Press Cmd+Enter to execute the statement and move to next.' +
                '<br><br>' +
                'Execute \\js to switch to Javascript mode, \\sql to switch ' +
                'back to SQL.<br><br>' +
                'Execute \\? to get help.'
            domNode.classList.add('sql_editor_welcome');

            let viewZone = {
                afterLineNumber: 0,
                heightInPx: 164,
                domNode,
            };
            this.welcomeViewZoneId = changeAccessor.addZone(viewZone);
        });
    }

    addCmd(lineNumber) {
        // Create a new command, passing this sqlEditor and the line number
        // where to create the prompt.
        new sqleditorCmd.SqleditorCmd(this, lineNumber);

        // Update the cursor position and show line
        this.editor.setPosition({ lineNumber: lineNumber, column: 1 });
        this.editor.revealLine(lineNumber);
    }

    // TODO: Add handling for deleting complete cmds
    refreshAllCmdLineNumbers() {
        if (this.refreshingAllCmdLineNumbers) {
            return;
        }
        const model = this.editor.getModel();
        if (model === null /*|| model.getModeId() !== "sql"*/) {
            return;
        }

        // Prevent recursive calls of the function as we change the decorations
        // as part of this implementation
        this.refreshingAllCmdLineNumbers = true;
        try {
            // Get all decorations, filter based on ownerId
            const decos = model.getAllDecorations(this.monacoDecoOwnerId, true);

            /*// Debug
            let cmdDebug = '';
            let cmdDecosDebug = '', stmtDecosDebug = '';*/

            // Update startLineNumber and endLineNumber of all cmds
            let cmdIndex = 0;
            // Do a reverse loop so cmds are updated from last to first. This
            // is important to check for overlapping statementDeco
            for (cmdIndex = this.cmds.length - 1; cmdIndex >= 0;
                cmdIndex--) {
                let cmd = this.cmds[cmdIndex];
                if (!cmd.cmdDecoId || !cmd.statementDecoId) {
                    continue;
                }
                // Find the corresponding cmd matching the deco.id
                let cmdDeco = decos.find(({ id }) =>
                    cmd.cmdDecoId === id);
                let stmtDeco = decos.find(({ id }) =>
                    cmd.statementDecoId === id);

                // prevent cmdDeco from expanding
                if (cmdDeco.options && cmdDeco.range &&
                    cmdDeco.range.endLineNumber !==
                    cmdDeco.range.startLineNumber) {

                    let ids = this.editor.deltaDecorations(
                        [cmdDeco.id], [
                        {
                            range: new monaco.Range(
                                cmdDeco.range.startLineNumber, 1,
                                cmdDeco.range.startLineNumber, 1),
                            options: {
                                isWholeLine: true,
                                linesDecorationsClassName:
                                    'sqleditorPromptDecoration_' +
                                    cmd.language,
                            }
                        }
                    ]);

                    /*// DEBUG
                    cmdDecosDebug =
                        'PD[' + cmdDeco.id + '=>' + ids[0] + ']=(' +
                        cmdDeco.range.startLineNumber + ',' +
                        cmdDeco.range.endLineNumber + ') | ' +
                        cmdDecosDebug;*/

                    cmd.cmdDecoId = ids[0];
                }
                /*// DEBUG
                else {
                    cmdDecosDebug =
                        'PD[' + cmdDeco.id + ']=(' +
                        cmdDeco.range.startLineNumber + ',' +
                        cmdDeco.range.endLineNumber + ') | ' +
                        cmdDecosDebug;
                }*/

                // update cmd.startLineNumber
                if (cmd.startLineNumber !=
                    cmdDeco.range.startLineNumber) {
                    cmd.startLineNumber = cmdDeco.range.startLineNumber;
                }

                // Update the cmd.endLineNumber and ensure that there is
                // no overlapping of line numbers
                let newEndLineNumber = stmtDeco.range.endLineNumber;
                if (cmdIndex < this.cmds.length - 1) {
                    let nextCmdStartLineNumber =
                        this.cmds[cmdIndex + 1].startLineNumber;
                    // If there is an overlap
                    if (stmtDeco.range.endLineNumber >=
                        nextCmdStartLineNumber) {
                        newEndLineNumber = nextCmdStartLineNumber - 1;
                    }
                    // If there is an statement deco overlap bigger than 1
                    // reset it to end the statement deco on the line of
                    // the next statement, so that enter at the end of the
                    // line will still extend the current statement
                    if (stmtDeco.range.endLineNumber >
                        nextCmdStartLineNumber) {
                        let ids = this.editor.deltaDecorations(
                            [stmtDeco.id], [
                            {
                                range: new monaco.Range(
                                    stmtDeco.range.startLineNumber, 1,
                                    nextCmdStartLineNumber, 1),
                                options: {
                                    isWholeLine: true,
                                    linesDecorationsClassName:
                                        'sqleditorStatementLineDecoration'
                                }
                            }
                        ]);

                        /*// DEBUG
                        stmtDecosDebug =
                            'PS[' + stmtDeco.id + '=>' + ids[0] + ']=(' +
                            stmtDeco.range.startLineNumber + ',' +
                            stmtDeco.range.endLineNumber + ') | ' +
                            stmtDecosDebug;*/

                        // Update the stored cmd.statementDecoId
                        cmd.statementDecoId = ids[0];
                    }
                    /*// DEBUG
                    else {
                        stmtDecosDebug =
                            'PS[' + stmtDeco.id + ']=(' +
                            stmtDeco.range.startLineNumber + ',' +
                            stmtDeco.range.endLineNumber + ') | ' +
                            stmtDecosDebug;
                    }*/
                }
                /*// DEBUG
                else {
                    stmtDecosDebug =
                        'PS[' + stmtDeco.id + ']=(' +
                        stmtDeco.range.startLineNumber + ',' +
                        stmtDeco.range.endLineNumber + ') | ' + stmtDecosDebug;
                }*/

                if (cmd.endLineNumber != newEndLineNumber) {
                    cmd.endLineNumber = newEndLineNumber;

                    cmd.refreshOverlayWidgetPosition();
                }

                /*// DEBUG
                cmdDebug =
                    'P[' + cmdIndex + ']=(' + cmd.startLineNumber + ',' +
                    cmd.endLineNumber + ':' + cmd.cmdDecoId + ':' +
                    cmd.statementDecoId + ') | ' + cmdDebug;*/
            }

            // DEBUG
            /*this.app.setStatusBarText(cmdDebug + '### ' + cmdDecosDebug +
                '### ' + stmtDecosDebug);*/
        }
        finally {
            this.refreshingAllCmdLineNumbers = false;
        }
    }

    /**
     * Resizes the Monaco editor
     *
     * @return {void}
     */
    onWindowResize() {
        if (this.editor) {
            this.editor.layout();
        }
    }

    onThemeChange(theme) {
        if (theme === 'light') {
            monaco.editor.setTheme('mysqlsh-light');
        } else {
            monaco.editor.setTheme('mysqlsh-dark');
        }
    }

    /**
     * Adds event listeners for toolbar button events and
     * window resize event
     *
     * @return {void}
     */
    addEventListeners() {
    }

    getJsSandboxIframe() {
        let iframe = document.createElement("iframe");
        iframe.id = this.tabId + '_sql_editor_area_sandbox_iframe';
        iframe.sandbox = 'allow-scripts';
        iframe.style.display = "none";
        iframe.srcdoc = `<script>
                window.sqlRequests = [];

                window.addEventListener('message', function (e) {
                    let mainWindow = e.source;
                    let result = '';
                    window.print = (value) => {
                        mainWindow.postMessage(
                            {result: value, cmdIndex: e.data.cmdIndex},
                            e.origin);
                    }

                    // Keep track of the ongoing sqlRequests and remember
                    // which callbacks to call for each requestId
                    window.runSql = (sql, callback, params) => {
                        let sqlRequest = {
                            requestId: window.sqlRequests.length,
                            callback: callback,
                            cmdIndex: e.data.cmdIndex
                        }
                        window.sqlRequests.push(sqlRequest)

                        mainWindow.postMessage(
                            {
                                runSql: sql,
                                params: params,
                                requestId: sqlRequest.requestId,
                                cmdIndex: e.data.cmdIndex
                            },
                            e.origin);
                    }

                    // If there is code to execute, run it
                    if (e.data.code) {
                        try {
                            result = eval(e.data.code);
                        } catch (e) {
                            result = 'eval() threw an exception. ' + e;
                        }
                        mainWindow.postMessage(
                            {result: result, cmdIndex: e.data.cmdIndex},
                            e.origin);
                    }
                    // If there is an sql result
                    else if (e.data.sqlResult && (e.data.requestId != null) &&
                        e.data.requestId < window.sqlRequests.length) {
                        let sqlRequest = window.sqlRequests[e.data.requestId];

                        sqlRequest.callback(e.data.sqlResult);
                    }
                });
            </script>`;
        document.getElementById(this.tabId + '_sql_editor_area')
            .appendChild(iframe);

        window.addEventListener('message',
            (e) => {
                // Sandboxed iframes which lack the 'allow-same-origin'
                // header have "null" rather than a valid origin. This means you still
                // have to be careful about accepting data via the messaging API you
                // create. Check that source, and validate those inputs!
                if (e.origin === "null" &&
                    e.source === this.jsSandboxIframe.contentWindow) {
                    // If the runSql property is set, execute the given SQL
                    if (e.data.runSql) {
                        const ws = this.app.webSocket;
                        ws.doSend({
                            "request": "execute",
                            "module_session_id": this.moduleSessionId,
                            "command": "gui_plugin.sqleditor.execute",
                            "args": {
                                "sql": e.data.runSql,
                                "params": e.data.params,
                                "options": {
                                    "row_packet_size": -1
                                }
                            }
                        }, (msg, data) => {
                            if (msg.request_state.type === 'OK' ||
                                msg.request_state.type === 'PENDING' ||
                                msg.request_state.type === 'ERROR') {
                                // Filter out pending messages with no results
                                // or errors
                                if (msg.rows || msg.error) {
                                    this.jsSandboxIframe.contentWindow
                                        .postMessage(
                                            {
                                                sqlResult: msg,
                                                requestId: data.requestId,
                                                cmdIndex: data.cmdIndex
                                            }, '*');
                                }
                            } else {
                                this.app.setStatusBarText(
                                    `Cannot execute sql command: ${msg.error}`);
                            }
                        }, {
                            requestId: e.data.requestId,
                            cmdIndex: e.data.cmdIndex
                        });
                    }
                    // Print the result
                    else if (e.data.cmdIndex < this.cmds.length) {
                        this.cmds[e.data.cmdIndex].print(e.data.result);
                    }
                }
            });

        return iframe;
    }

    runJsSandboxCode(code, cmdIndex) {
        // Note that we're sending the message to "*", rather than some specific
        // origin. Sandboxed iframes which lack the 'allow-same-origin' header
        // don't have an origin which you can target: you'll have to send to any
        // origin, which might alow some esoteric attacks. Validate your output!
        this.jsSandboxIframe.contentWindow.postMessage(
            { code: code, cmdIndex: cmdIndex }, '*');
    }

}
