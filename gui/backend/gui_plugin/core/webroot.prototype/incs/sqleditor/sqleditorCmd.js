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

export { SqleditorCmd };

class SqleditorCmd {
    constructor(sqlEditor, lineNumber) {
        this.startLineNumber = lineNumber;
        this.endLineNumber = lineNumber;
        this.overlayDomNode = null;
        this.viewZone = null;
        this.viewZoneId = null;
        this.viewZoneTop = null;
        this.viewZoneHeight = null;
        this.cmdDecoId = '';
        this.statementDecoId = '';
        this.cmd = '';
        this.jsFunc = null;
        this.sqlEditor = sqlEditor;
        this.language = sqlEditor.currentCmdLanguage;

        // Add command to the sqlEditor's list of commands and set the command's
        // index Nr
        this.cmdIndex = this.sqlEditor.cmds.push(this) - 1;

        // Add a cmd deco
        let ids = this.sqlEditor.editor.deltaDecorations(
            [], [{
                range: new monaco.Range(this.startLineNumber, 1,
                    this.startLineNumber, 1),
                options: {
                    isWholeLine: true,
                    linesDecorationsClassName:
                        'sqleditorPromptDecoration_' + this.language,
                }
            }]);
        // Store the cmd deco id
        this.cmdDecoId = ids[0];

        // Update the statement decos
        let model = this.sqlEditor.editor.getModel();
        ids = this.sqlEditor.editor.deltaDecorations(
            [], [{
                range: new monaco.Range(this.startLineNumber,
                    1,
                    this.endLineNumber,
                    model.getLineLength(this.endLineNumber)),
                options: {
                    isWholeLine: true,
                    linesDecorationsClassName:
                        'sqleditorStatementLineDecoration',
                }
            }]);
        // Store the statement deco id
        this.statementDecoId = ids[0];
    }

    refreshOverlayWidgetPosition() {
        // Reposition overlay widgets if needed
        if (this.viewZone &&
            this.viewZone.afterLineNumber != this.endLineNumber) {
            this.viewZone.afterLineNumber = this.endLineNumber;
            this.sqlEditor.editor.changeViewZones((changeAccessor) => {
                changeAccessor.layoutZone(this.viewZoneId);
            });
        }
    }

    addOverlayWidget() {
        /*if (cmdIndex > this.cmds.length - 1) {
            return;
        }
        const cmd = this.cmds[cmdIndex];*/

        // If an cmd.overlayDomNode already exist, use that
        if (this.overlayDomNode) {
            return;
        }
        this.overlayDomNode = this.getOverlayWidget()

        this.sqlEditor.editor.addOverlayWidget({
            //cmd: this,
            getId: () => {
                let id = 'my.overlay.widget' + this.cmdIndex;
                return id;
            },
            getDomNode: () => {
                let overlayDomNode = this.overlayDomNode;
                return overlayDomNode;
            },
            getPosition: function () { return null; }
        });

        this.sqlEditor.editor.changeViewZones((changeAccessor) => {
            const domNode = document.createElement('div');
            this.viewZone = {
                //cmd: this,
                afterLineNumber: this.endLineNumber,
                heightInPx: 20 + 10,
                domNode,
                onDomNodeTop: (top) => {
                    this.viewZoneTop = top;
                    this.layoutOverlayWidget();
                },
                onComputedHeight: (height) => {
                    this.viewZoneHeight = height;
                    this.layoutOverlayWidget();
                },
            };
            this.viewZoneId = changeAccessor.addZone(this.viewZone);
        });
    }

    layoutOverlayWidget() {
        if (!this.viewZoneTop || !this.viewZoneHeight) {
            return;
        }
        const layoutInfo = this.sqlEditor.editor.getLayoutInfo();
        const width = layoutInfo.width - layoutInfo.minimapWidth -
            layoutInfo.decorationsWidth - 16;

        this.overlayDomNode.style.width =
            `${width}px`;
        this.overlayDomNode.style.top =
            `${this.viewZoneTop}px`;
        this.overlayDomNode.style.height =
            `${this.viewZoneHeight - 10}px`;
    }

    getOverlayWidget() {
        // Create main zone div
        let domNode = document.createElement('div');
        domNode.classList.add('sqleditorCommandZone');

        // Create sqlEditorResult div
        let sqlEditorResult = document.createElement('div');
        sqlEditorResult.classList.add('sqlEditorResult');
        domNode.appendChild(sqlEditorResult);
        domNode._sqlEditorResult = sqlEditorResult;

        // Create sqlEditorResult/sqlEditorResultTextOutput div
        let sqlEditorResultTextOutput = document.createElement('div');
        sqlEditorResultTextOutput.classList.add('sqlEditorResultTextOutput');
        sqlEditorResult.appendChild(sqlEditorResultTextOutput);
        domNode._sqlEditorResultTextOutput = sqlEditorResultTextOutput;

        // Create sqlEditorResultStatus div
        let sqlEditorResultStatus = document.createElement('div');
        sqlEditorResultStatus.classList.add('sqlEditorResultStatus');
        let sqlEditorResultStatusText = document.createElement('p');
        sqlEditorResultStatusText.appendChild(
            document.createTextNode('Executing...'));
        sqlEditorResultStatus.appendChild(sqlEditorResultStatusText);
        domNode._sqlEditorResultStatus = sqlEditorResultStatus;
        domNode._sqlEditorResultStatusText = sqlEditorResultStatusText;

        domNode.appendChild(sqlEditorResultStatus);


        /*domNode._scrollStart = null;

        domNode.addEventListener('mousedown', (e) => {
            e.target._scrollStart = e.target.scrollTop;
            e.target._scrollMousePos = e.y;
        });

        domNode.addEventListener('mousemove', (e) => {
            if (e.target._scrollStart !== null) {
                e.target.scrollTop = e.target._scrollStart +
                    e.target._scrollMousePos - e.y;
            }
        });

        domNode.addEventListener('mouseup', (e) => {
            e.target._scrollStart = null;
        });

        domNode.addEventListener('mouseout', (e) => {
            e.target._scrollStart = null;
        });*/

        sqlEditorResult.addEventListener('wheel', (e) => {
            if (!this.sqlEditor.scrolling) {
                e.currentTarget.scrollTop += Math.sign(e.deltaY) * 2;
                //e.preventDefault();
                e.stopPropagation();
            }
        });

        return domNode;
    }

    executeCommand() {
        const model = this.sqlEditor.editor.getModel();
        if (model === null) {
            return false;
        }
        // Get command statement
        let stmt = '';
        for (let i = this.startLineNumber; i <= this.endLineNumber; i++) {
            stmt += model.getLineContent(i) + '\n';
        }
        this.stmt = stmt.trim();

        // if statement is empty, return false
        if (this.stmt === '') {
            return false;
        }

        // Add overlay result div
        this.addOverlayWidget();

        // If \js or \sql are given, switch mode
        if (this.stmt === '\\js') {
            this.sqlEditor.currentCmdLanguage = 'js';
            this.setStatusText('Switched to JavaScript language.');

            return true;
        } else if (this.stmt === '\\sql') {
            this.sqlEditor.currentCmdLanguage = 'sql';
            this.setStatusText('Switched to SQL language.');
            return true;
        }

        if (this.language === 'sql') {
            // Check if help was requested
            if (this.stmt.startsWith('\\?')) {
                this.print(this.getSqlHelp(this.stmt));

                return true;
            }

            // Execute the given SQL statement
            const ws = this.sqlEditor.app.webSocket;
            ws.doSend({
                "request": "execute",
                "module_session_id": this.sqlEditor.moduleSessionId,
                "command": "gui_plugin.sqleditor.execute",
                "args": {
                    "sql": stmt,
                    "params": this.getSqlParameters(stmt)
                }
            }, (msg, cmd) => {
                if (msg.request_state.type === 'OK' ||
                    msg.request_state.type === 'PENDING') {
                    cmd.appendResultSetRows(msg);
                } else if (msg.request_state.type === 'ERROR') {
                    cmd.setStatusText(msg.error, true);
                }
            }, this);
        }
        else if (this.language === 'js') {
            // Clear previous result
            this.setStatusText('');
            if (this.overlayDomNode) {
                // Clear sqlEditorResultTextOutput
                this.overlayDomNode._sqlEditorResultTextOutput
                    .innerHTML = '';
                this.overlayDomNode._sqlEditorResultTextOutput.style
                    .display = 'none';
            }

            // Check if help was requested
            if (this.stmt.startsWith('\\?')) {
                this.print(this.getJavascriptHelp(this.stmt));

                return true;
            }

            // Execute the JS statements
            try {
                this.sqlEditor.runJsSandboxCode(stmt, this.cmdIndex);
            } catch (e) {
                this.setStatusText(e, true);
            }
        }

        return true;
    }

    /**
     * Parses the given statement and returns the list of parameters specified
     * in the statement comments. Example:
     *     SELECT * FROM user
     *     WHERE name = ? -- ("mike")
     *
     * @param  {String} stmt  the statement to parse
     * @return {List} the list of parameters
     */
    getSqlParameters(stmt) {
        // Get parameter definition string that has been provided as part of
        // a SQL comment, e.g. -- ("mike", 2)
        let matches = stmt.matchAll(/--\s*(\((.*?)\))/g);
        let paramsStr = '';

        for (const match of matches) {
            if (paramsStr === '') {
                paramsStr = match[2];
            } else {
                paramsStr += ', ' + match[2];
            }
        }

        // Get parameter list, consider , inside ""
        let params = [];
        matches = paramsStr.matchAll(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
        for (const match of matches) {
            // trim spaces and remove leading and trailing "
            params.push(match[0].trim().replace(/^"(.*)"$/, '$1'));
        }

        return params;
    }

    appendResultSetRows(msg) {
        /*if (cmdIndex >= this.cmds.length) {
            return;
        }
        const cmd = this.cmds[cmdIndex];*/

        // The first message for this result set contains the list of columns
        if (msg.columns) {
            const sqlEditorResult = this.overlayDomNode._sqlEditorResult;
            if (sqlEditorResult) {
                sqlEditorResult.style.display = 'inherit';

                // if there was a table before, remove it
                while (sqlEditorResult.firstChild) {
                    sqlEditorResult.removeChild(sqlEditorResult.lastChild);
                }
            }

            // Create result set table
            let tbl = document.createElement('table'),
                tblHead = document.createElement('thead'),
                tblBody = document.createElement('tbody'),
                tblTr = document.createElement('tr');
            // Set header CSS
            //tblTr.classList.add('grey');

            for (const column of msg.columns) {
                let tblTh = document.createElement('th');
                tblTh.appendChild(document.createTextNode(column));
                tblTr.appendChild(tblTh);
            }

            tblHead.appendChild(tblTr);
            tbl.appendChild(tblHead);
            tbl.appendChild(tblBody);
            tbl._body = tblBody;

            this.overlayDomNode._sqlEditorResult.appendChild(tbl);
            this.overlayDomNode._resultTable = tbl;
        }

        // Add the rows
        if (msg.rows) {
            const tbl = this.overlayDomNode._resultTable;

            for (const row of msg.rows) {
                let tblTr = document.createElement('tr');

                for (const column of row) {
                    let tblTd = document.createElement('td');
                    tblTd.appendChild(document.createTextNode(column));
                    tblTr.appendChild(tblTd);
                }

                tbl._body.appendChild(tblTr);
            }
        } else if (msg.total_row_count == 0) {
            this.setStatusText(`Total number of rows: ${msg.total_row_count}`);
        }

        if (msg.total_row_count && this.viewZoneHeight) {
            const tableHeight =
                this.overlayDomNode._resultTable.clientHeight;

            // Check if a scrollbar will be displayed
            const layoutInfo = this.sqlEditor.editor.getLayoutInfo();
            const width = layoutInfo.width - layoutInfo.minimapWidth -
                layoutInfo.decorationsWidth - 16;
            let scrollbarHeight = 0;
            if (this.overlayDomNode._resultTable.clientWidth > width - 7) {
                scrollbarHeight = 8;
            }

            let newHeight = tableHeight + scrollbarHeight + 20 + 10;
            // Maximum of 8,5 lines
            if (newHeight > 214) {
                newHeight = 214;
            }

            this.resizeViewZone(newHeight);

            this.setStatusText(`Total number of rows: ${msg.total_row_count}`);
        }
    }

    resizeViewZone(newHeight) {
        if (newHeight != this.viewZoneHeight) {
            this.viewZone.heightInPx = newHeight;

            this.sqlEditor.editor.changeViewZones(
                (changeAccessor) => {
                    changeAccessor.layoutZone(this.viewZoneId);
                });
        }
    }

    setStatusText(txt, isError) {
        if (this.overlayDomNode) {
            const statusLbl = this.overlayDomNode._sqlEditorResultStatusText;
            // if no text was passed along, hide the status text
            if (!txt || txt === '') {
                this.overlayDomNode._sqlEditorResultStatus.style.display = 'none';
            } else {
                this.overlayDomNode._sqlEditorResultStatus.style.display = 'inherit';

                if (isError) {
                    // Add Error CSS class to sqlEditorResultStatus
                    statusLbl.classList.add('sqlEditorResultStatusError');

                    this.viewZone.heightInPx = 20 + 10;
                    if (this.overlayDomNode._sqlEditorResult) {
                        this.overlayDomNode._sqlEditorResult.style.display =
                            'none';
                    }

                    this.sqlEditor.editor.changeViewZones(
                        (changeAccessor) => {
                            changeAccessor.layoutZone(this.viewZoneId);
                        });
                } else {
                    // Remove Error CSS Class from sqlEditorResultStatus
                    statusLbl.classList.remove('sqlEditorResultStatusError');
                }
                statusLbl.innerHTML = (isError) ? `ERROR: ${txt}` : txt;
            }
        }
    }

    getSqlHelp(stmt) {
        const txt =
            `The SQL Editor's interactive prompt is currently running in SQL mode.
Execute \\js to switch to Javascript mode.

Use ? as placeholders, provide values as a list in a comment.
EXAMPLES
    SELECT * FROM user
    WHERE name = ? -- ("mike")
\n`;
        return txt;
    }

    getJavascriptHelp(stmt) {
        if (stmt.toUpperCase() === '\\? print'.toUpperCase()) {
            const txt = `<b>Name
    print</b> - Prints the given value to the screen.
SYNTAX
    print(value)
WHERE
    value: The value to print. Can be of value any JS type.
DESCRIPTION
    Prints the given value on the screen. Depending on the type, the value
    will be converted to string first.
EXAMPLES
    print("Hello\nworld!");\n`;
            return txt;
        } else if (stmt.toUpperCase() === '\\? runSql'.toUpperCase()) {
            const txt = `<b>Name
    runSql</b> - Runs an SQL statement.
SYNTAX
    runSql(sql, callback[, parameterList])
WHERE
    sql: The SQL statement to execute.
    callback: The callback to be called for the server response.
    parameterList: An optional list of parameters when parameters are used.
DESCRIPTION
    Executes the given sql statement and calls the provided callback function
    with the response from the server.
EXAMPLES
    runSql("SELECT * FROM user", (res) => {
        print(res.rows);
    });

    runSql("SELECT * FROM user WHERE name = ?", (res) => {
        print(res.rows);
    }, ['mike']);\n`;
            return txt;
        }
        else {
            const txt =
                `The SQL Editor's interactive prompt is currently running in Javascript mode.
Execute \\sql to switch to SQL mode.

<b>GLOBAL FUNCTIONS</b>
    - print(value)                           Prints the given value
    - runSql(sql, callback[, parameterList]) Runs an SQL query.

Type \\? function to get more information about a function, e.g. \\? runSql\n`;
            return txt;
        }
    }

    print(value) {
        if (this.overlayDomNode) {
            // Set text
            let res = this.overlayDomNode._sqlEditorResultTextOutput;

            if (typeof (value) === "string") {
                // Replace linebreaks with <br>
                res.innerHTML += value.replace(/(?:\r\n|\r|\n)/g, '<br>');
            } else if (typeof (value) === "object") {
                let objvalue = JSON.stringify(value, null, 4) + '<br>';

                // Replace linebreaks with <br>
                res.innerHTML += objvalue.replace(/(?:\r\n|\r|\n)/g, '<br>');
            } else if (value === undefined) {
                // If there is no response and there was no previous output,
                // hide the result
                if (res.innerHTML === '') {
                    res.style.display = 'none';
                }
            } else {
                res.innerHTML += value;
            }


            res.style.display = 'inherit';
            // Hide Status
            this.overlayDomNode._sqlEditorResultStatus.style.display =
                'none';

            // Resize Zone,

            // Count <br> + 1
            let lineCount = (res.innerHTML.match(/<br>/g) || []).length + 1;

            const resultHeight = lineCount * 16;

            // Check if a scrollbar will be displayed
            const layoutInfo = this.sqlEditor.editor.getLayoutInfo();
            const width = layoutInfo.width - layoutInfo.minimapWidth -
                layoutInfo.decorationsWidth - 16;
            let scrollbarHeight = 0;
            if (this.overlayDomNode._sqlEditorResultTextOutput.clientWidth >
                width - 7) {
                scrollbarHeight = 8;
            }

            let newHeight = resultHeight + scrollbarHeight + 16;
            if (newHeight > 226) {
                newHeight = 226;
            }

            this.resizeViewZone(newHeight);
        }
    }
}
