/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import * as React from "react";

import { ApplicationDB } from "../../app-logic/ApplicationDB";
import {
    IColumnInfo, MessageType, IDictionary, IServicePasswordRequest, DBDataType, IExecutionInfo,
} from "../../app-logic/Types";

import {
    ICommShellEvent, IShellDocumentData, IShellObjectResult, IShellResultType, IShellRowData,
    IShellSimpleResult, IShellValueResult, IShellPromptValues, IShellColumnsMetaData,
} from "../../communication";
import {
    Component, Container, ContentAlignment, IComponentProperties, Orientation,
} from "../../components/ui";
import { IEditorPersistentState } from "../../components/ui/CodeEditor/CodeEditor";
import { ExecutionContext, IExecutionResult, ITextResultEntry, SQLExecutionContext } from "../../script-execution";
import { CodeEditorLanguageServices } from "../../script-execution/ScriptingLanguageServices";
import { convertRows, EditorLanguage, generateColumnInfo } from "../../supplement";
import { requisitions } from "../../supplement/Requisitions";
import { EventType } from "../../supplement/Dispatch";
import { settings } from "../../supplement/Settings/Settings";
import { DBType, ShellInterfaceDb, ShellInterfaceShellSession } from "../../supplement/ShellInterface";
import { flattenObject } from "../../utilities/helpers";
import { ShellConsole } from "./ShellConsole";
import { ShellPrompt } from "./ShellPrompt";
import { unquote } from "../../utilities/string-helpers";
import { MySQLConnectionScheme } from "../../communication/MySQL";
import { ShellPromptHandler } from "../common/ShellPromptHandler";
import { ResultTextLanguage } from "../../components/ResultView";

export interface IShellTabPersistentState extends IShellPromptValues {
    backend: ShellInterfaceShellSession;

    // Assigned when a DB connection (a global session in MySQL Shell terms) was established.
    dbSession?: ShellInterfaceDb;
    schemaList?: string[];

    state: IEditorPersistentState;

    // Informations about the connected backend (where supported).
    serverVersion: number;
    serverEdition: string;
    sqlMode: string;

    // For DB session handling.
    lastUserName?: string;
    lastPassword?: string;
    lastHost?: string;
    lastPort?: number;

    // Last executed statement
    lastCommand?: string;
}

export interface IShellTabProperties extends IComponentProperties {
    savedState: IShellTabPersistentState;

    onQuit: (id: string) => void;
}

export class ShellTab extends Component<IShellTabProperties> {

    private static aboutMessage = `Welcome to the MySQL Shell - GUI Console.

Press %modifier%+Enter to execute the current statement.

Execute \\sql to switch to SQL, \\js to JavaScript and \\py to Python mode.
Execute \\help or \\? for help; \\quit to close the session.`;

    private static languageMap = new Map<EditorLanguage, string>([
        ["javascript", "\\js"],
        ["python", "\\py"],
        ["sql", "\\sql"],
        ["mysql", "\\sql"],
    ]);

    private consoleRef = React.createRef<ShellConsole>();

    // Holds the current language that was last used by the user.
    // This way we know if we need to implicitly send a language command when the user executes arbitrary execution
    // blocks (which can have different languages).
    private currentLanguage: EditorLanguage = "text";

    public componentDidMount(): void {
        this.initialSetup();
    }

    public componentWillUnmount(): void {
        this.closeDbSession("");
    }

    public componentDidUpdate(): void {
        this.initialSetup();
    }

    public render(): React.ReactNode {
        const { savedState } = this.props;

        return (
            <>
                <Container
                    id="shellEditorHost"
                    orientation={Orientation.TopDown}
                    alignment={ContentAlignment.Stretch}
                >
                    <ShellPrompt
                        id="shellPrompt"
                        values={savedState}
                        getSchemas={this.listSchemas}
                        onSelectSchema={this.activateSchema}
                    />

                    <ShellConsole
                        id="shellEditor"
                        ref={this.consoleRef}
                        editorState={savedState.state}
                        onScriptExecution={this.handleExecution}
                    />
                </Container>
            </>
        );
    }

    private initialSetup(): void {
        const { savedState } = this.props;
        const version = savedState.state.model.getVersionId();
        if (version === 1) {
            // If there was never a change in the editor so far it means that this is the first time it is shown.
            // In this case we can run our one-time initialization.
            this.consoleRef.current?.executeCommand("\\about");

            const language = settings.get("shellSession.startLanguage", "javascript").toLowerCase() as EditorLanguage;
            const languageSwitch = ShellTab.languageMap.get(language) ?? "\\js";
            this.currentLanguage = language;
            savedState.backend.execute(languageSwitch).then((event: ICommShellEvent) => {
                // Update the prompt after executing the first command. This is important
                // if the shell session was started with a dbConnectionId to connect to.
                if (event && event.data && event.eventType === EventType.FinalResponse) {
                    // Need to cast to any, as some of the result types do not have a prompt descriptor.
                    const result = event.data.result;
                    if (result && this.hasPromptDescriptor(result)) {
                        savedState.promptDescriptor = result.promptDescriptor;
                        void requisitions.execute("updateShellPrompt", result);
                    }
                }
            }).catch((event) => {
                void requisitions.execute("showError", ["Shell Language Switch Error", String(event.message)]);
            });
        }
    }

    /**
     * Handles all incoming execution requests from the editors.
     *
     * @param context The context containing the code to be executed.
     * @param params Additional named parameters.
     *
     * @returns True if something was actually executed, false otherwise.
     */
    private handleExecution = async (context: ExecutionContext, params?: Array<[string, string]>): Promise<boolean> => {
        const { savedState } = this.props;

        const command = context.code.trim();
        if (command.length === 0) {
            return Promise.resolve(false);
        }

        // First check for special commands.
        const parts = command.split(" ");
        if (parts.length > 0) {
            const temp = parts[0].toLowerCase();

            // If this is a language switch, store it for later comparison. For SQL, however, only when it doesn't do
            // ad hoc execution.
            switch (temp) {
                case "\\quit":
                case "\\exit":
                case "\\q":
                case "\\e": {
                    setImmediate(() => {
                        const { id, onQuit } = this.props;

                        onQuit(id ?? "");
                    });

                    return Promise.resolve(true);
                }

                case "\\about": {
                    const isMac = navigator.userAgent.includes("Macintosh");
                    const content = ShellTab.aboutMessage.replace("%modifier%", isMac ? "Cmd" : "Ctrl");
                    context?.setResult({
                        type: "text",
                        requestId: "",
                        text: [{ type: MessageType.Info, content, language: "ansi" }],
                    });

                    return Promise.resolve(true);
                }

                case "\\js": {
                    this.currentLanguage = "javascript";
                    break;
                }

                case "\\py": {
                    this.currentLanguage = "python";
                    break;
                }

                case "\\sql": {
                    if (parts.length === 1) {
                        this.currentLanguage = "sql";
                    }
                    break;
                }

                default: {
                    const language = context.language === "mysql" ? "sql" : context.language;
                    if (language !== this.currentLanguage) {
                        const languageSwitch = ShellTab.languageMap.get(context.language);
                        if (languageSwitch) {
                            return new Promise((resolve) => {
                                savedState.backend.execute(languageSwitch).then((event: ICommShellEvent) => {
                                    if (event.eventType === EventType.FinalResponse) {
                                        this.currentLanguage = language;
                                        void this.processCommand(command, context, params).then(() => {
                                            resolve(true);
                                        });
                                    }
                                }).catch((event) => {
                                    void requisitions.execute("showError",
                                        ["Shell Language Switch Error", String(event.message)]);

                                    resolve(false);
                                });
                            });
                        }
                    }
                }
            }
        }

        await this.processCommand(command, context, params);

        return Promise.resolve(true);
    };

    /**
     * Does language dependent processing before the command is actually sent to the backend.
     *
     * @param command The command to execute.
     * @param context The context for the execution and target for the results.
     * @param params Additional named parameters.
     */
    private async processCommand(command: string, context: ExecutionContext,
        params?: Array<[string, string]>): Promise<void> {
        if (!command.startsWith("\\") && context.isSQLLike) {
            const statements = (context as SQLExecutionContext).statements;

            let index = 0;
            while (true) {
                const statement = statements.shift();
                if (!statement) {
                    break;
                }
                await this.executeQuery(context as SQLExecutionContext, statement.text, index++, params);
            }
        } else {
            void this.doExecution(command, context, -1, params);
        }
    }

    /**
     * Executes a single query. The query is amended with a LIMIT clause, if the given count is > 0 (the page size)
     * and no other top level LIMIT clause already exists.
     *
     * @param context The context to send results to.
     * @param sql The query to execute.
     * @param index The index of the query being executed.
     * @param params Additional named parameters.
     *
     * @returns A promise which resolves when the query execution is finished.
     */
    private executeQuery = async (context: SQLExecutionContext, sql: string, index: number,
        params?: Array<[string, string]>): Promise<void> => {
        if (sql.trim().length === 0) {
            return;
        }

        return new Promise((resolve, reject) => {
            const services = CodeEditorLanguageServices.instance;

            void services.checkAndAddSemicolon(context, sql).then(([query]) => {
                void this.doExecution(query, context, index, params)
                    .then(() => { resolve(); })
                    .catch((reason) => { reject(reason); });
            });
        });
    };

    private doExecution(command: string, context: ExecutionContext, index: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        params?: Array<[string, string]>): Promise<void> {
        const { savedState } = this.props;
        const columns: IColumnInfo[] = [];

        savedState.lastCommand = command;

        return new Promise((resolve, reject) => {
            savedState.backend.execute(command).then((event: ICommShellEvent) => {
                if (!event.data) {
                    return;
                }

                const { id = "" } = this.props;

                const requestId = event.data.requestId!;
                const result = event.data.result;

                const addResultData = (data: IExecutionResult): void => {
                    void context.addResultData(data).then((added) => {
                        if (added) {
                            context.updateResultDisplay();
                        }
                    });
                };

                switch (event.eventType) {
                    case EventType.ErrorResponse: {
                        // This is just here to complete the picture. Shell execute responses don't use ERROR types,
                        // but instead return error conditions in the normal OK/PENDING responses.
                        break;
                    }

                    case EventType.StartResponse: {
                        if (index < 0) {
                            // For anything but SQL.
                            context.setResult();
                        } else if (index === 0) {
                            // For the first SQL result.
                            context.setResult({
                                type: "resultSets",
                                sets: [{
                                    index,
                                    head: {
                                        requestId,
                                        sql: "",
                                    },
                                    data: {
                                        requestId,
                                        rows: [],
                                        columns: [],
                                        currentPage: 0,
                                    },
                                }],
                            });
                        } else {
                            // For any further SQL result from the same execution context.
                            context.addResultPage({
                                type: "resultSets",
                                sets: [{
                                    index,
                                    head: {
                                        requestId,
                                        sql: "",
                                    },
                                    data: {
                                        requestId,
                                        rows: [],
                                        columns: [],
                                        currentPage: 0,
                                    },
                                }],
                            });
                        }

                        break;
                    }

                    case EventType.DataResponse: {
                        if (!result) {
                            break;
                        }

                        // Shell response results can have many different fields. There's no other way but to test
                        // for each possible field to see what a response is about.
                        if (this.isShellShellDocumentData(result)) {
                            // Document data must be handled first, as that includes an info field,
                            // like the simple result.
                            if (result.hasData) {
                                const documentString = result.documents.length === 1 ? "document" : "documents";
                                const status = {
                                    type: MessageType.Info,
                                    text: `${result.documents.length} ${documentString} in set ` +
                                        `(${result.executionTime})`,
                                };

                                if (result.warningCount > 0) {
                                    status.type = MessageType.Warning;
                                    status.text += `, ${result.warningCount} ` +
                                        `${result.warningCount === 1 ? "warning" : "warnings"}`;
                                }

                                const text: ITextResultEntry[] = [{
                                    type: MessageType.Info,
                                    index,
                                    content: JSON.stringify(result.documents, undefined, "\t"),
                                    language: "json",
                                }];

                                result.warnings.forEach((warning) => {
                                    text.push({
                                        type: MessageType.Warning,
                                        index,
                                        content: `\n${warning.message}`,
                                    });
                                });

                                addResultData({
                                    type: "text",
                                    text,
                                    executionInfo: status,
                                });
                            } else {
                                // No data was returned. Use the info field for the status message then.
                                addResultData({
                                    type: "text",
                                    text: [{
                                        type: MessageType.Info,
                                        index,
                                        content: result.info,
                                        language: "ansi",
                                    }],
                                    executionInfo: { text: "" },
                                });
                            }
                        } else if (this.isShellShellColumnsMetaData(result)) {
                            const rawColumns = Object.values(result).map((value) => {
                                return {
                                    name: unquote(value.Name),
                                    type: value.Type,
                                    length: value.Length,
                                };
                            });
                            columns.push(...generateColumnInfo(
                                context.language === "mysql" ? DBType.MySQL : DBType.Sqlite, rawColumns, true));
                        } else if (this.isShellShellRowData(result)) {
                            // Some APIs return rows, which are not result sets (have no keys). Print them
                            // as simple results.
                            if (result.rows.length === 0 || typeof result.rows[0] !== "object") {
                                let text = "";
                                if (result.rows.length > 0) {
                                    text = "[\n";
                                    result.rows.forEach((value) => {
                                        text += `\t${String(value)}\n`;
                                    });
                                    text += "]";
                                }
                                if (text !== "") {
                                    text += "\n";
                                }
                                const resultText = result.warningCount > 0 ?
                                    `finished with warnings (${result.warningCount})` : "OK";
                                text += `Query ${resultText}, ${result.affectedRowCount ?? 0} row affected ` +
                                    `(${result.executionTime})`;

                                addResultData({
                                    type: "text",
                                    requestId: event.data.requestId,
                                    text: [{
                                        type: MessageType.Info,
                                        index,
                                        content: text,
                                        language: "xml",
                                    }],
                                    executionInfo: { text: "OK" },
                                });
                            } else {

                                const rowString = result.rows.length === 1 ? "row" : "rows";
                                const status = {
                                    type: MessageType.Info,
                                    text: `${result.rows.length} ${rowString} in set (${result.executionTime})`,
                                };

                                if (result.warningCount > 0) {
                                    status.type = MessageType.Warning;
                                    status.text += `, ${result.warningCount} ` +
                                        `${result.warningCount === 1 ? "warning" : "warnings"}`;
                                }

                                // Flatten nested objects + arrays.
                                result.rows.forEach((value) => {
                                    flattenObject(value as IDictionary);
                                });

                                // XXX: temporary workaround: create generic columns from data.
                                // Column info should actually be return in the columns meta data response above.
                                if (columns.length === 0 && result.rows.length > 0) {
                                    const row = result.rows[0] as object;
                                    Object.keys(row).forEach((value, index) => {
                                        columns.push({
                                            title: value,
                                            field: String(index),
                                            dataType: {
                                                type: DBDataType.String,
                                            },
                                        });
                                    });
                                }

                                const rows = convertRows(columns, result.rows);

                                void ApplicationDB.db.add("shellModuleResultData", {
                                    tabId: id,
                                    requestId,
                                    rows,
                                    columns,
                                    executionInfo: status,
                                    index,
                                });

                                if (index === -1) {
                                    // An index of -1 indicates that we are handling non-SQL mode results and have not
                                    // set an initial result record in the execution context. Have to do that now.
                                    index = -2;
                                    context.setResult({
                                        type: "resultSets",
                                        sets: [{
                                            index,
                                            head: {
                                                requestId,
                                                sql: "",
                                            },
                                            data: {
                                                requestId,
                                                rows,
                                                columns,
                                                currentPage: 0,
                                                executionInfo: status,
                                            },
                                        }],
                                    });
                                } else {
                                    addResultData({
                                        type: "resultSetRows",
                                        requestId,
                                        rows,
                                        columns,
                                        currentPage: 0,
                                        executionInfo: status,
                                    });
                                }
                            }
                        } else if (this.isShellShellData(result)) {
                            // Unspecified shell data (no documents, no rows). Just print the info as status, for now.
                            addResultData({
                                type: "text",
                                requestId: event.data.requestId,
                                text: [{
                                    type: MessageType.Info,
                                    index,
                                    content: result.info,
                                    language: "ansi",
                                }],
                                executionInfo: { text: "" },
                            });
                        } else if (this.isShellObjectListResult(result)) {
                            let text = "[\n";
                            result.forEach((value) => {
                                text += "\t<" + value.class;
                                if (value.name) {
                                    text += ":" + value.name;
                                }
                                text += ">\n";
                            });
                            text += "]";
                            addResultData({
                                type: "text",
                                requestId: event.data.requestId,
                                text: [{
                                    type: MessageType.Info,
                                    index,
                                    content: text,
                                    language: "xml",
                                }],
                            });
                        } else if (this.isShellSimpleResult(result)) {
                            if (result.error) {
                                // Errors can be a string or an object with a string.
                                const text = typeof result.error === "string" ? result.error : result.error.message;
                                addResultData({
                                    type: "text",
                                    requestId: event.data.requestId,
                                    text: [{
                                        type: MessageType.Error,
                                        index,
                                        content: text,
                                        language: "ansi",
                                    }],
                                    executionInfo: { type: MessageType.Error, text: "" },
                                });
                            } else if (result.warning) {
                                // Errors can be a string or an object with a string.
                                addResultData({
                                    type: "text",
                                    requestId: event.data.requestId,
                                    text: [{
                                        type: MessageType.Info,
                                        index,
                                        content: result.warning,
                                        language: "ansi",
                                    }],
                                    executionInfo: { type: MessageType.Warning, text: "" },
                                });
                            } else {
                                // See if a new session is going to be established. That's our sign to
                                // remove a previously stored password.
                                if (result.info && result.info.startsWith("Creating a session to")) {
                                    this.closeDbSession(result.info);
                                }

                                const content = (result.info ?? result.note ?? result.status)!;
                                addResultData({
                                    type: "text",
                                    requestId: event.data.requestId,
                                    text: [{
                                        type: MessageType.Info,
                                        index,
                                        content,
                                        language: "ansi",
                                    }],
                                    executionInfo: { type: MessageType.Interactive, text: "" },
                                });
                            }
                        } else if (this.isShellValueResult(result)) {
                            addResultData({
                                type: "text",
                                requestId: event.data.requestId,
                                text: [{
                                    type: MessageType.Info,
                                    index,
                                    content: String(result.value),
                                    language: "ansi",
                                }],
                            });
                        } else {
                            // Temporarily listen to password requests, to be able to record any new password for this
                            // session.
                            requisitions.register("acceptPassword", this.acceptPassword);

                            if (!ShellPromptHandler.handleShellPrompt(result, requestId, savedState.backend)) {
                                requisitions.unregister("acceptPassword", this.acceptPassword);

                                if (this.isShellObjectResult(result)) {
                                    let text = "<" + result.class;
                                    if (result.name) {
                                        text += ":" + result.name;
                                    }
                                    text += ">";
                                    addResultData({
                                        type: "text",
                                        requestId: event.data.requestId,
                                        text: [{
                                            type: MessageType.Info,
                                            index,
                                            content: text,
                                            language: "xml",
                                        }],
                                    });
                                } else {
                                    // no data and pending
                                    if (event.data.requestState.type === "PENDING" && result &&
                                        typeof result === "object" && Object.keys(result).length === 0) {
                                        break;
                                    }
                                    // If no specialized result then print as is.
                                    const executionInfo: IExecutionInfo = {
                                        text: result ? "" : JSON.stringify(event.data.requestState, undefined, "\t"),
                                    };

                                    const text = !result ? [] : [{
                                        type: MessageType.Info,
                                        index,
                                        content: JSON.stringify(result, undefined, "\t"),
                                        language: "json" as ResultTextLanguage,
                                    }];

                                    addResultData({
                                        type: "text",
                                        text,
                                        executionInfo,
                                    });
                                }
                            }
                        }

                        break;
                    }

                    case EventType.FinalResponse: {
                        if (result && this.hasPromptDescriptor(result)) {
                            // A descriptor change occurs when any of the following change types occur:
                            // 1) Changes involving an active session update:
                            //    1.1) A new active shell session was established
                            //    1.2) The active shell session got disconnected
                            // 2) Changes not involving changes on the active session:
                            //   2.1) The active schema changed
                            //   2.2) The Shell Console mode changed
                            const hadOpenSession = savedState.dbSession !== undefined;
                            const needsOpenSession = (result.promptDescriptor?.host !== undefined)
                                || (result.promptDescriptor?.socket !== undefined);

                            const existing = savedState.promptDescriptor;
                            let newSessionRequired = (!hadOpenSession && needsOpenSession);
                            if (!newSessionRequired) {
                                newSessionRequired = (existing?.user !== result.promptDescriptor?.user)
                                    || (existing?.host !== result.promptDescriptor?.host)
                                    || (existing?.port !== result.promptDescriptor?.port)
                                    || (existing?.socket !== result.promptDescriptor?.socket)
                                    || (existing?.ssl !== result.promptDescriptor?.ssl)
                                    || (existing?.session !== result.promptDescriptor?.session);
                            }


                            // Prompt needs to be updated the first time a descriptio
                            let refreshRequired = !savedState.promptDescriptor
                                || newSessionRequired
                                || (hadOpenSession !== needsOpenSession);

                            if (!refreshRequired) {
                                refreshRequired = (existing?.isProduction !== result.promptDescriptor?.isProduction)
                                    || (existing?.mode !== result.promptDescriptor?.mode)
                                    || (existing?.schema !== result.promptDescriptor?.schema);
                            }

                            savedState.promptDescriptor = result.promptDescriptor;

                            if (hadOpenSession && !needsOpenSession) {
                                // 1.2) There was an active session and got closed
                                this.closeDbSession("");
                                void requisitions.execute("updateShellPrompt", result);
                                resolve();

                            } else if (newSessionRequired) {
                                // A new session will be created, however if password is not available, it attempts to
                                // get it from the last executed command (common case when password is given in the
                                // connection string)
                                if (savedState.lastPassword === undefined) {
                                    savedState.lastPassword = this.getPasswordFromLastCommand();
                                }

                                // Only trigger the creation of the Session if the password was defined (even if empty)
                                // otherwise the start session will be requiring shell prompt handling
                                if (savedState.lastPassword !== undefined) {
                                    // 1.1) The active session got created or updated
                                    void this.openDbSession().then(() => {
                                        void requisitions.execute("updateShellPrompt", result);

                                        resolve();
                                    });
                                } else {
                                    void requisitions.execute("updateShellPrompt", result);
                                    resolve();
                                }
                            } else if (refreshRequired) {
                                // 2) Changes not related to a session update were detected
                                void requisitions.execute("updateShellPrompt", result);
                                resolve();
                            } else {
                                resolve();
                            }
                        } else {

                            // Note: we don't send a final result display update call from here. Currently the shell
                            //       sends all relevant data in data responses. The final response doesn't really add
                            //       anything, so we do updates in the data responses instead (and get live resizes).
                            resolve();
                        }

                        break;
                    }

                    default: {
                        break;
                    }
                }

            }).catch((event) => {
                const message = event.message ? String(event.message) : "No further information";
                void requisitions.execute("showError", ["Shell Execution Error", message]);
                reject(message);
            });

        });
    }

    /**
     * Closes the current DB session (if one is open), because a new session is currently being opened.
     *
     * @param startText The text sent back for the new session. We use that to get the new user name from it.
     */
    private closeDbSession = (startText: string): void => {
        const { savedState } = this.props;

        if (savedState.dbSession) {
            void savedState.dbSession.closeSession().then(() => {
                savedState.dbSession = undefined;
            });
        }
        savedState.lastPassword = undefined;
        savedState.lastUserName = undefined;
        savedState.lastHost = undefined;
        savedState.lastPort = undefined;
        savedState.schemaList = undefined;

        // The user is enclosed in quotes.
        const match = startText.match(/^[^']+('.+')/);
        let connectionString = match?.[1];
        if (connectionString) {
            connectionString = unquote(connectionString);
            try {
                // Check if the protocol has been supplied. If not, add it
                const matchProtocol = connectionString.toLowerCase().match(/^(mysql(x)?:\/\/)/);
                if (!matchProtocol?.[0]) {
                    connectionString = "http://" + connectionString;
                } else {
                    connectionString.replace("mysql://", "http://");
                    // cSpell:ignore mysqlx
                    connectionString.replace("mysqlx://", "http://");
                }

                const url = new URL(connectionString);

                savedState.lastUserName = (url.username === "") ? undefined : url.username;
                savedState.lastHost = url.hostname;
                savedState.lastPassword = (url.password === "") ? undefined : url.password;
                savedState.lastPort = (url.port === "") ? undefined : parseInt(url.port, 10);
            } catch (e) {
                // Ignore invalid connection strings.
            }
        }
    };

    /**
     * Opens a new DB session for the current shell global session (MySQL connection).
     */
    private openDbSession = async (): Promise<void> => {
        const { savedState } = this.props;

        try {
            if (savedState.dbSession) {
                await savedState.dbSession.closeSession();
            }

            savedState.dbSession = new ShellInterfaceDb();
            const useXProtocol = savedState.promptDescriptor?.session === "x" ?? false;
            await savedState.dbSession.startSession("shellTab", {
                dbType: DBType.MySQL,
                caption: "Shell Tab DB Session",
                description: "",
                options: {
                    scheme: useXProtocol ? MySQLConnectionScheme.MySQLx : MySQLConnectionScheme.MySQL,
                    user: savedState.lastUserName,
                    password: savedState.lastPassword,
                    host: savedState.lastHost,
                    port: savedState.lastPort,

                },
            });
        } catch (reason) {
            void requisitions.execute("showError", ["Shell DB Session Error", reason as string]);
        }
    };

    private acceptPassword = (data: { request: IServicePasswordRequest; password: string }): Promise<boolean> => {
        // This password notification is a one-shot event, used only for handling password shell requests.
        requisitions.unregister("acceptPassword", this.acceptPassword);

        const { savedState } = this.props;

        savedState.lastPassword = data.password;

        return Promise.resolve(false);
    };

    private getPasswordFromLastCommand = (): string | undefined => {
        const { savedState } = this.props;

        if (savedState.lastCommand) {
            // Expression to handle URI strings defined as [mysql[x]://]user[:password]@host[:port]
            // Grouping positions return:
            // 0 - Full Match
            // 2 - Scheme
            // 4 - User
            // 6 - Password
            // 8 - Host
            // 9 - Port
            const uriRegexp = /((mysql(x)?):\/\/)?(\w+)(:(\w*))?(@)(\w+)(:(\d+))?/g;
            const matches = [...savedState.lastCommand.matchAll(uriRegexp)];

            if (matches && matches[0][4] && matches[0][8]) {
                // If password is defined it will be returned (even if it is defined as empty)
                // otherwise undefined will be returned
                return matches[0][6];
            }
        }

        return undefined;
    };

    private listSchemas = (): Promise<string[]> => {
        return new Promise((resolve) => {
            const { savedState } = this.props;

            if (!savedState.dbSession) {
                resolve([]);
            } else {
                if (!savedState.schemaList) {
                    void savedState.dbSession.getCatalogObjects("Schema").then((schemas) => {
                        savedState.schemaList = schemas;
                        resolve(schemas);
                    });
                } else {
                    resolve(savedState.schemaList);
                }
            }
        });
    };

    private activateSchema = (schemaName: string): void => {
        this.consoleRef.current?.executeCommand(`\\u ${schemaName}`);
    };

    // Different type guards below, to keep various shell results apart.

    private isShellObjectListResult(response: IShellResultType): response is IShellObjectResult[] {
        return Array.isArray(response);
    }

    private isShellObjectResult(response: IShellResultType): response is IShellObjectResult {
        return (response as IShellObjectResult).class !== undefined;
    }

    private isShellValueResult(response: IShellResultType): response is IShellValueResult {
        return (response as IShellValueResult).value !== undefined;
    }

    private isShellSimpleResult(response: IShellResultType): response is IShellSimpleResult {
        const candidate = response as IShellSimpleResult;

        return (candidate.error !== undefined || candidate.info !== undefined || candidate.note !== undefined
            || candidate.status !== undefined || candidate.warning !== undefined)
            && Object.keys(candidate).length === 1;
    }

    private isShellShellDocumentData(response: IShellResultType): response is IShellDocumentData {
        return (response as IShellDocumentData).documents !== undefined;
    }

    private isShellShellColumnsMetaData(response: IShellResultType): response is IShellColumnsMetaData {
        return (response as IShellColumnsMetaData)["Field 1"] !== undefined;
    }

    private isShellShellRowData(response: IShellResultType): response is IShellRowData {
        return (response as IShellRowData).rows !== undefined;
    }

    private isShellShellData(response: IShellResultType): response is IShellDocumentData {
        return (response as IShellDocumentData).hasData !== undefined;
    }

    private hasPromptDescriptor(response: IShellResultType): response is IShellPromptValues {
        return (response as IShellPromptValues).promptDescriptor !== undefined;
    }

}
