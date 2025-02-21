/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { ComponentChild, createRef } from "preact";
import { SetIntervalAsyncTimer, clearIntervalAsync, setIntervalAsync } from "set-interval-async/dynamic";

import { ApplicationDB } from "../../app-logic/ApplicationDB.js";
import {
    IColumnInfo, IDictionary,
    IStatusInfo, MessageType, uriPattern,
} from "../../app-logic/general-types.js";

import { ui } from "../../app-logic/UILayer.js";
import { MySQLConnectionScheme } from "../../communication/MySQL.js";
import {
    IShellColumnsMetaData, IShellDocumentData, IShellObjectResult, IShellPromptValues, IShellResultType, IShellRowData,
    IShellSimpleResult, IShellValueResult,
} from "../../communication/ProtocolGui.js";
import { IEditorPersistentState } from "../../components/ui/CodeEditor/CodeEditor.js";
import { IScriptExecutionOptions } from "../../components/ui/CodeEditor/index.js";
import { ComponentBase, IComponentProperties } from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../../components/ui/Container/Container.js";
import type { IOdmShellSessionEntry } from "../../data-models/OpenDocumentDataModel.js";
import { ExecutionContext } from "../../script-execution/ExecutionContext.js";
import { SQLExecutionContext } from "../../script-execution/SQLExecutionContext.js";
import { ScriptingLanguageServices } from "../../script-execution/ScriptingLanguageServices.js";
import { IExecutionResult, ITextResultEntry, ResultTextLanguage } from "../../script-execution/index.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import { ShellInterfaceDb } from "../../supplement/ShellInterface/ShellInterfaceDb.js";
import { ShellInterfaceShellSession } from "../../supplement/ShellInterface/ShellInterfaceShellSession.js";
import { DBType } from "../../supplement/ShellInterface/index.js";
import { EditorLanguage, convertRows, generateColumnInfo } from "../../supplement/index.js";
import { convertErrorToString, flattenObject, uuid } from "../../utilities/helpers.js";
import { unquote } from "../../utilities/string-helpers.js";
import { ShellPromptHandler } from "../common/ShellPromptHandler.js";
import { DocumentToolbar } from "../db-editor/DocumentToolbar.js";
import type { IToolbarItems } from "../db-editor/index.js";
import { ShellConsole } from "./ShellConsole.js";
import { ShellPrompt } from "./ShellPrompt.js";

interface IResultTimer {
    timer: SetIntervalAsyncTimer<unknown[]>;
    results: IExecutionResult[];
}

export interface IShellTabPersistentState extends IShellPromptValues {
    dataModelEntry: IOdmShellSessionEntry;

    backend: ShellInterfaceShellSession;

    /** Assigned when a DB connection (a global session in MySQL Shell terms) was established. */
    dbSession?: ShellInterfaceDb;
    schemaList?: string[];

    state: IEditorPersistentState;

    /** Informations about the connected backend (where supported). */
    serverVersion: number;
    serverEdition: string;
    sqlMode: string;

    /** For DB session handling. */
    lastUserName?: string;
    lastPassword?: string;
    lastHost?: string;
    lastPort?: number;

    /** Last executed statement */
    lastCommand?: string;
}

export interface IShellTabProperties extends IComponentProperties {
    savedState: IShellTabPersistentState;

    /** Top level toolbar items, to be integrated with page specific ones. */
    toolbarItemsTemplate: IToolbarItems;

    onQuit: (id: string) => void;
}

export class ShellTab extends ComponentBase<IShellTabProperties> {

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

    private consoleRef = createRef<ShellConsole>();

    // Holds the current language that was last used by the user.
    // This way we know if we need to implicitly send a language command when the user executes arbitrary execution
    // blocks (which can have different languages).
    private currentLanguage: EditorLanguage = "text";

    // Timers to serialize asynchronously incoming results.
    private resultTimers = new Map<string, IResultTimer>();

    public constructor(props: IShellTabProperties) {
        super(props);

        this.addHandledProperties("toolbarItemsTemplate", "savedState", "onQuit");
    }

    public override componentDidMount(): void {
        this.initialSetup();
    }

    public override componentWillUnmount(): void {
        this.closeDbSession("");
    }

    public override componentDidUpdate(): void {
        this.initialSetup();
    }

    public render(): ComponentChild {
        const { savedState, toolbarItemsTemplate } = this.props;

        return (
            <Container
                id="shellEditorHost"
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Stretch}
            >
                <DocumentToolbar
                    toolbarItems={toolbarItemsTemplate}
                    language="msg"
                    activeDocument={savedState.dataModelEntry.id}
                    heatWaveEnabled={false}
                    documentState={[]}
                />

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
        );
    }

    private initialSetup(): void {
        const { savedState } = this.props;
        const version = savedState.state.model.getVersionId();
        if (version === 2) {
            // If there was never a change in the editor so far it means that this is the first time it is shown.
            // In this case we can run our one-time initialization.
            this.consoleRef.current?.executeCommand("\\about");

            const language = Settings.get("shellSession.startLanguage", "javascript").toLowerCase() as EditorLanguage;
            const languageSwitch = ShellTab.languageMap.get(language) ?? "\\js";
            this.currentLanguage = language;

            savedState.backend.execute(languageSwitch).then((result) => {
                // Update the prompt after executing the first command. This is important
                // if the shell session was started with a dbConnectionId to connect to.
                if (result && this.hasPromptDescriptor(result)) {
                    savedState.promptDescriptor = result.promptDescriptor;
                    void requisitions.execute("updateShellPrompt", result);
                }
            }).catch((reason) => {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`Shell Language Switch Error: ${message}`, {});
            });
        }
    }

    /**
     * Handles all incoming execution requests from the editors.
     *
     * @param context The context containing the code to be executed.
     * @param options Content and details for script execution.
     *
     * @returns True if something was actually executed, false otherwise.
     */
    private handleExecution = async (context: ExecutionContext, options: IScriptExecutionOptions): Promise<boolean> => {
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
                    setTimeout(() => {
                        const { id, onQuit } = this.props;

                        onQuit(id ?? "");
                    }, 0);

                    return true;
                }

                case "\\about": {
                    const isMac = navigator.userAgent.includes("Macintosh");
                    const content = ShellTab.aboutMessage.replace("%modifier%", isMac ? "Cmd" : "Ctrl");
                    await context?.addResultData({
                        type: "text",
                        text: [{ type: MessageType.Info, content, language: "ansi" }],
                    }, { resultId: "" });

                    return true;
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
                                savedState.backend.execute(languageSwitch).then(() => {
                                    this.currentLanguage = language;
                                    void this.processCommand(command, context, options.params).then(() => {
                                        resolve(true);
                                    });
                                }).catch((reason) => {
                                    const message = convertErrorToString(reason);
                                    void ui.showErrorMessage(`Shell Language Switch Error: ${message}`, {});

                                    resolve(false);
                                });
                            });
                        }
                    }
                }
            }
        }

        await this.processCommand(command, context, options.params);

        return true;
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
        await context.clearResult();
        if (!command.startsWith("\\") && context.isSQLLike) {
            const statements = await (context as SQLExecutionContext).getExecutableStatements();

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

        const services = ScriptingLanguageServices.instance;

        const [query] = await services.checkAndAddSemicolon(context, sql);
        await this.doExecution(query, context, index, params);
    };

    private async doExecution(command: string, context: ExecutionContext, index: number,
        _params?: Array<[string, string]>): Promise<void> {
        const { savedState } = this.props;

        savedState.lastCommand = command;

        try {
            const { id = "" } = this.props;

            let columns: IColumnInfo[] = [];
            let resultId = uuid();

            const finalResult = await savedState.backend.execute(command, undefined, (data, requestId) => {
                if (!data.result) {
                    return;
                }

                const result = data.result;

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

                        if (result.warningsCount > 0) {
                            status.type = MessageType.Warning;
                            status.text += `, ${result.warningsCount} ` +
                                `${result.warningsCount === 1 ? "warning" : "warnings"}`;
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

                        this.addTimedResult(context, {
                            type: "text",
                            text,
                            executionInfo: status,
                        }, resultId);
                    } else {
                        // No data was returned. Use the info field for the status message then.
                        this.addTimedResult(context, {
                            type: "text",
                            text: [{
                                type: MessageType.Info,
                                index,
                                content: result.info,
                                language: "ansi",
                            }],
                            executionInfo: { text: "" },
                        }, resultId);
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
                    // If we have column info at this point then we got SQL mode results (show the result grid).
                    // Otherwise display the result as JSON text.
                    if (columns.length === 0) {
                        const resultText = result.warningsCount > 0 ?
                            `finished with warnings (${result.warningsCount})` : "OK";
                        let info = `Query ${resultText}, ${result.affectedItemsCount || result.rows.length} ` +
                            `rows affected`;
                        if (result.executionTime) {
                            info += ` (${result.executionTime})`;
                        }

                        // If we have data show it as result otherwise only the execution info.
                        if (result.rows.length > 0) {
                            const content = JSON.stringify(result.rows, undefined, "\t") + "\n";

                            this.addTimedResult(context, {
                                type: "text",
                                text: [{
                                    type: MessageType.Info,
                                    index,
                                    content,
                                    language: "json",
                                }],
                                executionInfo: { type: MessageType.Response, text: info },
                            }, resultId);
                        } else {
                            this.addTimedResult(context, {
                                type: "text",
                                executionInfo: { type: MessageType.Info, text: info },
                            }, resultId);
                        }
                    } else {
                        const rowString = result.rows.length === 1 ? "row" : "rows";
                        const status = {
                            type: MessageType.Info,
                            text: `${result.rows.length} ${rowString} in set (${result.executionTime})`,
                        };

                        if (result.warningsCount > 0) {
                            status.type = MessageType.Warning;
                            status.text += `, ${result.warningsCount} ` +
                                `${result.warningsCount === 1 ? "warning" : "warnings"}`;
                        }

                        // Flatten nested objects + arrays.
                        result.rows.forEach((value) => {
                            flattenObject(value as IDictionary);
                        });

                        const rows = convertRows(columns, result.rows);

                        void ApplicationDB.db.add("shellModuleResultData", {
                            tabId: id,
                            resultId,
                            rows,
                            columns,
                            executionInfo: status,
                            index,
                        });

                        this.addTimedResult(context, {
                            type: "resultSetRows",
                            rows,
                            columns,
                            currentPage: 0,
                            executionInfo: status,
                        }, resultId);
                    }

                    // We got the final data. Start a new result.
                    resultId = uuid();
                    columns = [];
                } else if (this.isShellShellData(result)) {
                    // Unspecified shell data (no documents, no rows). Just print the info as status, for now.
                    this.addTimedResult(context, {
                        type: "text",
                        text: [{
                            type: MessageType.Info,
                            index,
                            content: result.info,
                            language: "ansi",
                        }],
                        executionInfo: { text: "" },
                    }, resultId);
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
                    this.addTimedResult(context, {
                        type: "text",
                        text: [{
                            type: MessageType.Info,
                            index,
                            content: text,
                            language: "xml",
                        }],
                    }, resultId);
                } else if (this.isShellSimpleResult(result)) {
                    if (result.error) {
                        // Errors can be a string or an object with a string.
                        const text = typeof result.error === "string" ? result.error : result.error.message;
                        this.addTimedResult(context, {
                            type: "text",
                            text: [{
                                type: MessageType.Error,
                                index,
                                content: text,
                                language: "ansi",
                            }],
                            executionInfo: { type: MessageType.Error, text: "" },
                        }, resultId);
                    } else if (result.warning) {
                        // Errors can be a string or an object with a string.
                        this.addTimedResult(context, {
                            type: "text",
                            text: [{
                                type: MessageType.Info,
                                index,
                                content: result.warning,
                                language: "ansi",
                            }],
                            executionInfo: { type: MessageType.Warning, text: "" },
                        }, resultId);
                    } else {
                        // See if a new session is going to be established. That's our sign to
                        // remove a previously stored password.
                        // If the scheme is explicit, the message will include the type of session that is being
                        // created ("Classic" or "X"). We can be open-ended and look for any kind of session, even
                        // those types that do not yet exist.
                        const newSessionPattern = /^Creating (a|an)([\s\w]+)? session to/;
                        if (result.info && newSessionPattern.test(result.info)) {
                            this.closeDbSession(result.info);
                        }

                        const content = (result.info ?? result.note ?? result.status)!;
                        this.addTimedResult(context, {
                            type: "text",
                            text: [{
                                type: MessageType.Info,
                                index,
                                content,
                                language: "ansi",
                            }],
                            executionInfo: { type: MessageType.Info, text: "" },
                        }, resultId);
                    }

                    // We got a full result. Start a new one.
                    resultId = uuid();
                    columns = [];
                } else if (this.isShellValueResult(result)) {
                    this.addTimedResult(context, {
                        type: "text",
                        text: [{
                            type: MessageType.Info,
                            index,
                            content: String(result.value),
                            language: "ansi",
                        }],
                    }, resultId);
                } else {
                    // XXX: The password requisition is no longer available. Find a different way to capture
                    //      the password.
                    //requisitions.register("acceptPassword", this.acceptPassword);

                    if (!ShellPromptHandler.handleShellPrompt(result, requestId, savedState.backend)) {
                        if (this.isShellObjectResult(result)) {
                            let text = "<" + result.class;
                            if (result.name) {
                                text += ":" + result.name;
                            }
                            text += ">";
                            this.addTimedResult(context, {
                                type: "text",
                                text: [{
                                    type: MessageType.Info,
                                    index,
                                    content: text,
                                    language: "xml",
                                }],
                            }, resultId);
                        } else {
                            // If no specialized result then print as is.
                            const executionInfo: IStatusInfo = {
                                text: result ? "" : JSON.stringify(result, undefined, "\t"),
                            };

                            const text = !result ? [] : [{
                                type: MessageType.Info,
                                index,
                                content: JSON.stringify(result, undefined, "\t"),
                                language: "json" as ResultTextLanguage,
                            }];

                            this.addTimedResult(context, {
                                type: "text",
                                text,
                                executionInfo,
                            }, resultId);
                        }
                    }
                }
            });

            // Handling the final response here.
            if (finalResult && this.hasPromptDescriptor(finalResult)) {
                // A descriptor change occurs when any of the following change types occur:
                // 1) Changes involving an active session update:
                //    1.1) A new active shell session was established
                //    1.2) The active shell session got disconnected
                // 2) Changes not involving changes on the active session:
                //   2.1) The active schema changed
                //   2.2) The Shell Console mode changed
                const hadOpenSession = savedState.dbSession !== undefined;
                const needsOpenSession = (finalResult.promptDescriptor?.host !== undefined)
                    || (finalResult.promptDescriptor?.socket !== undefined);

                const existing = savedState.promptDescriptor;
                let newSessionRequired = (!hadOpenSession && needsOpenSession);
                if (!newSessionRequired) {
                    newSessionRequired = (existing?.user !== finalResult.promptDescriptor?.user)
                        || (existing?.host !== finalResult.promptDescriptor?.host)
                        || (existing?.port !== finalResult.promptDescriptor?.port)
                        || (existing?.socket !== finalResult.promptDescriptor?.socket)
                        || (existing?.ssl !== finalResult.promptDescriptor?.ssl)
                        || (existing?.session !== finalResult.promptDescriptor?.session);
                }

                // Prompt needs to be updated the first time a descriptor comes in.
                let refreshRequired = !savedState.promptDescriptor
                    || newSessionRequired
                    || (hadOpenSession !== needsOpenSession);

                if (!refreshRequired) {
                    refreshRequired = (existing?.isProduction !== finalResult.promptDescriptor?.isProduction)
                        || (existing?.mode !== finalResult.promptDescriptor?.mode)
                        || (existing?.schema !== finalResult.promptDescriptor?.schema);
                }

                savedState.promptDescriptor = finalResult.promptDescriptor;

                if (hadOpenSession && !needsOpenSession) {
                    // 1.2) There was an active session and got closed
                    this.closeDbSession("");
                    void requisitions.execute("updateShellPrompt", finalResult);
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
                        await this.openDbSession();
                    }
                    await requisitions.execute("updateShellPrompt", finalResult);
                } else if (refreshRequired) {
                    // 2) Changes not related to a session update were detected
                    await requisitions.execute("updateShellPrompt", finalResult);
                }
            }
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Shell Execution Error: ${message}`, {});

            throw reason;
        }
    }

    /**
     * Adds the given data to the result timer for the specified request ID. If no timer exists yet, one is created.
     * The timer, whenever it triggers, sends the next result to the target context.
     *
     * @param context The context to send the result data to.
     * @param data The data to send.
     * @param resultId The unique identification of the result. Per execution request there can be multiple blocks
     *                 of data (chunking, but single result ID) or multiple results (multiple result IDs).
     */
    private addTimedResult(context: ExecutionContext, data: IExecutionResult, resultId: string): void {
        const resultTimer = this.resultTimers.get(resultId);
        if (!resultTimer) {
            // Create the timer, if it doesn't exist.
            const newTimer: IResultTimer = {
                timer: setIntervalAsync(async (id: string) => {
                    const resultTimer = this.resultTimers.get(id);
                    if (resultTimer) {
                        const pendingResult = resultTimer.results.shift();
                        if (pendingResult) {
                            await context.addResultData(pendingResult, { resultId: id });
                        } else {
                            // No results left. Stop the timer.
                            void clearIntervalAsync(resultTimer.timer).then(() => {
                                this.resultTimers.delete(id);
                            });
                        }
                    }
                }, 50, resultId),

                results: [data],
            };

            this.resultTimers.set(resultId, newTimer);
        } else {
            resultTimer.results.push(data);
        }
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
            const useXProtocol = savedState.promptDescriptor?.session === "x";
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
                settings: {},
            });
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Shell DB Session Error: ${message}`, {});
        }
    };

    private getPasswordFromLastCommand = (): string | undefined => {
        const { savedState } = this.props;

        if (savedState.lastCommand) {
            const matches = [...savedState.lastCommand.matchAll(uriPattern)];

            // Tests for the mandatory fields in case password is present in the URI
            if (matches[0] && matches[0][4] && matches[0][6] && matches[0][8]) {
                // At this point, we know the connection string has a valid URI inside
                // However, the password might be percent encoded
                return decodeURIComponent(matches[0][6]);
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
        return "Field 1" in response;
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
