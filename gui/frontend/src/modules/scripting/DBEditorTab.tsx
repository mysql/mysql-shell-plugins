/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import "./assets/Scripting.css";

import React from "react";
import ts from "typescript";
import { isNil } from "lodash";
import { clearIntervalAsync, setIntervalAsync, SetIntervalAsyncTimer } from "set-interval-async/dynamic";

import {
    Component, SplitContainer, IComponentProperties, IComponentState, Orientation, Container, ContentAlignment,
    ISplitterPaneSizeInfo,
} from "../../components/ui";
import { DBType, ShellInterface, ShellInterfaceSqlEditor } from "../../supplement/ShellInterface";
import { EventType, ListenerEntry } from "../../supplement/Dispatch";
import {
    ICommResultSetEvent, ICommErrorEvent, IResultSetData, ICommModuleDataContentEvent,
} from "../../communication";
import { Explorer, IExplorerSectionState } from "./Explorer";
import { IEditorPersistentState } from "../../components/ui/CodeEditor/CodeEditor";
import { formatTime, formatWithNumber } from "../../utilities/string-helpers";
import { ScriptingConsole } from "./ScriptingConsole";
import { IEntityBase, EntityType, ISchemaTreeEntry, IModuleDataEntry, SchemaTreeType } from ".";
import { StandaloneScriptEditor } from "./StandaloneScriptEditor";
import { IPosition } from "../../components/ui/CodeEditor";
import { ExecutionContext, IResultSetRows, SQLExecutionContext } from "../../script-execution";
import { requisitions } from "../../supplement/Requisitions";
import { IConsoleWorkerResultData, ScriptingApi } from "./console.worker-types";
import { ExecutionWorkerPool } from "./execution/ExecutionWorkerPool";
import { CodeEditorLanguageServices } from "../../script-execution/ScriptingLanguageServices";
import { QueryType } from "../../parsing/parser-common";
import { DBEditorMainToolbar } from "./DBEditorMainToolbar";
import { IExecutionInfo, MessageType } from "../../app-logic/Types";
import { settings } from "../../supplement/Settings/Settings";
import { ApplicationDB } from "../../app-logic/ApplicationDB";
import {
    convertRows,
    EditorLanguage, generateColumnInfo, IRunQueryRequest, IRunScriptRequest, ISqlPageRequest,
} from "../../supplement";

interface IResultTimer {
    timer: SetIntervalAsyncTimer;
    results: IResultSetRows[];
}

export interface IOpenEditorState extends IEntityBase {
    state: IEditorPersistentState;

    // A copy of the script state data id, if this editor was created from a script.
    moduleDataId?: number;

    // The version number of the editor model when we last saved it (for entries that are actually saved).
    currentVersion: number;
}

export interface IDBEditorTabPersistentState {
    backend: ShellInterfaceSqlEditor;

    // Informations about the connected backend (where supported).
    serverVersion: number;
    serverEdition: string;
    sqlMode: string;

    editors: IOpenEditorState[];
    scripts: IModuleDataEntry[];
    schemaTree: ISchemaTreeEntry[];
    explorerState: Map<string, IExplorerSectionState>;

    activeEditor: string;
    currentSchema: string;

    // The size to be used for the explorer pane.
    explorerWidth: number;
}

export interface IDBEditorTabProperties extends IComponentProperties {
    connectionId: number;
    dbType: DBType;
    savedState: IDBEditorTabPersistentState;
    workerPool: ExecutionWorkerPool;

    // An element to render in this page's toolbar.
    toolbarInset?: React.ReactElement;

    showExplorer?: boolean; // If false, collapse the explorer split pane.
    showAbout: boolean;

    onHelpCommand?: (command: string, currentLanguage: EditorLanguage) => string | undefined;

    onAddEditor?: (id: string) => string | undefined;
    onRemoveEditor?: (id: string, editorId: string) => void;
    onSelectEditor?: (id: string, editorId: string) => void;
    onChangeEditor?: (id: string, editorId: string, newCaption: string) => void;

    onAddScript?: (id: string, language: EditorLanguage, dbType: DBType) => void;

    onSaveSchemaTree?: (id: string, schemaTree: ISchemaTreeEntry[]) => void;
    onSaveExplorerState?: (id: string, state: Map<string, IExplorerSectionState>) => void;

    onExplorerResize?: (id: string, size: number) => void;

    onExplorerMenuAction?: (id: string, itemId: string, params: unknown) => void;
}

interface IDBEditorTabState extends IComponentState {
    errorMessage?: string;

    backend?: ShellInterfaceSqlEditor;
}

// A tab page for a single connection (managed by the scripting module).
export class DBEditorTab extends Component<IDBEditorTabProperties, IDBEditorTabState> {

    private static aboutMessage = `Welcome to the MySQL Shell - SQL Notebook.

Press %modifier%+Enter to execute the current statement.

Execute \\sql to switch to SQL, \\js to JavaScript and \\ts to TypeScript mode.
Execute \\help or \\? for help;`;

    // Currently executing contexts.
    private runningContexts = new Map<string, ExecutionContext>();

    // Timers to throttle UI updates for incoming result data.
    private resultTimers = new Map<string, IResultTimer>();

    private consoleRef = React.createRef<ScriptingConsole>();
    private standaloneRef = React.createRef<StandaloneScriptEditor>();

    public constructor(props: IDBEditorTabProperties) {
        super(props);

        this.state = {
            backend: props.savedState.backend,
        };

        this.addHandledProperties("storageDb", "connectionId", "dbType", "savedState", "workerPool", "actionParams",
            "toolbarInset", "showExplorer", "showAbout",
            "onHelpCommand", "onAddEditor", "onRemoveEditor", "onSelectEditor", "onAddScript", "onSaveSchemaTree",
            "onSaveExplorerState", "onExplorerResize", "onExplorerMenuAction",
        );
    }

    public componentDidMount(): void {
        requisitions.register("editorStopExecution", this.editorStopExecution);
        requisitions.register("editorCommit", this.editorCommit);
        requisitions.register("editorRollback", this.editorRollback);
        requisitions.register("sqlShowDataAtPage", this.sqlShowDataAtPage);
        requisitions.register("editorRunQuery", this.editorRunQuery);
        requisitions.register("editorRunScript", this.editorRunScript);
        requisitions.register("editorInsertUserScript", this.editorInsertUserScript);

        this.consoleRef.current?.focus();
    }

    public componentWillUnmount(): void {
        this.resultTimers.forEach((resultTimer) => {
            void clearIntervalAsync(resultTimer.timer);
        });
        this.resultTimers.clear();

        requisitions.unregister("editorStopExecution", this.editorStopExecution);
        requisitions.unregister("editorCommit", this.editorCommit);
        requisitions.unregister("editorRollback", this.editorRollback);
        requisitions.unregister("sqlShowDataAtPage", this.sqlShowDataAtPage);
        requisitions.unregister("editorRunQuery", this.editorRunQuery);
        requisitions.unregister("editorRunScript", this.editorRunScript);
        requisitions.unregister("editorInsertUserScript", this.editorInsertUserScript);
    }

    public componentDidUpdate(prevProps: IDBEditorTabProperties): void {
        const { connectionId, savedState } = this.props;

        if (connectionId !== prevProps.connectionId) {
            this.setState({
                backend: savedState.backend,
            });
        }
    }

    public render(): React.ReactNode {
        const { toolbarInset, id, savedState, dbType, showExplorer = true, onHelpCommand, showAbout } = this.props;
        const { backend } = this.state;

        const className = this.getEffectiveClassNames(["connectionTabHost"]);

        // Determine editor to show from the editor state. There must always be at least a single editor.
        // If we cannot find the given active editor then pick the first one unconditionally.
        let activeEditor = savedState.editors.find(
            (entry: IOpenEditorState): boolean => {
                return entry.id === savedState.activeEditor;
            },
        );

        if (!activeEditor) {
            activeEditor = savedState.editors[0];
        }

        let document;
        switch (activeEditor.type) {
            case EntityType.Console: {
                document = <ScriptingConsole
                    ref={this.consoleRef}
                    editorState={activeEditor.state}
                    dbType={dbType}
                    showAbout={showAbout}
                    onHelpCommand={onHelpCommand}
                    onScriptExecution={this.handleExecution}
                />;
                break;
            }

            case EntityType.Script: {
                document = <StandaloneScriptEditor
                    ref={this.standaloneRef}
                    editorState={activeEditor.state}
                    onScriptExecution={this.handleExecution}
                />;

                break;
            }

            case EntityType.Table: {
                break;
            }

            default: {
                break;
            }
        }

        return (
            <SplitContainer
                className={className}
                panes={[
                    {
                        id: "explorer",
                        minSize: 150,
                        initialSize: savedState.explorerWidth > -1 ? savedState.explorerWidth : 250,
                        snap: true,
                        resizable: true,
                        collapsed: !showExplorer,
                        content: (
                            <Explorer
                                id={id}
                                dbType={dbType}
                                schemaTree={savedState.schemaTree}
                                state={savedState.explorerState}
                                editors={savedState.editors}
                                scripts={savedState.scripts}
                                selectedEntry={savedState.activeEditor}
                                markedSchema={savedState.currentSchema}
                                backend={savedState.backend}
                                onSelectItem={this.handleSelectEditor}
                                onCloseItem={this.handleCloseEditor}
                                onAddItem={this.handleAddEditor}
                                onChangeItem={this.handleChangeEditor}
                                onAddScript={this.handleAddScript}
                                onSaveSchemaTree={this.saveSchemaTree}
                                onSaveExplorerState={this.saveExplorerState}
                                onContextMenuItemClick={this.handleExplorerMenuAction}
                            />),
                    },
                    {
                        id: "content",
                        minSize: 350,
                        snap: false,
                        stretch: true,
                        content: <Container
                            orientation={Orientation.TopDown}
                            style={{
                                flex: "1 1 auto",
                            }}
                            mainAlignment={ContentAlignment.Stretch}
                        >
                            <DBEditorMainToolbar
                                inset={toolbarInset}
                                language={activeEditor.state.model.getLanguageId()}
                                activeEditor={savedState.activeEditor}
                                editors={savedState.editors}
                                backend={backend}
                                onSelectEditor={this.handleSelectEditor}
                            />
                            {document}
                        </Container>,
                    },
                ]}
                onPaneResized={this.handlePaneResize}
            />
        );
    }

    private editorStopExecution = (): Promise<boolean> => {
        const { backend } = this.state;

        if (backend) {
            return new Promise((resolve) => {
                backend.killQuery().then(() => { resolve(true); });
            });
        }

        return Promise.resolve(false);
    };

    private editorCommit = (): Promise<boolean> => {
        const { backend } = this.state;

        if (!backend) {
            return Promise.resolve(false);
        }

        return new Promise((resolve) => {
            backend.execute("commit").then((event: ICommResultSetEvent): void => {
                switch (event.eventType) {
                    case EventType.ErrorResponse: {
                        void requisitions.execute("showError", ["Execution Error", String(event.message)]);
                        break;
                    }

                    case EventType.FinalResponse: {
                        void requisitions.execute("sqlTransactionChanged", undefined).then(() => { resolve(true); });

                        // TODO: give a visual feedback (e.g. message toast) for the execution.

                        break;
                    }

                    default: {
                        break;
                    }
                }
            });
        });
    };

    private editorRollback = (): Promise<boolean> => {
        const { backend } = this.state;

        if (!backend) {
            return Promise.resolve(false);
        }

        return new Promise((resolve) => {
            backend.execute("rollback").then((): void => {
                void requisitions.execute("sqlTransactionChanged", undefined).then(() => { resolve(true); });

                // TODO: give a visual feedback (e.g. message toast) for the execution.
            });
        });
    };

    private sqlShowDataAtPage = (data: ISqlPageRequest): Promise<boolean> => {
        return new Promise((resolve) => {
            const pageSize = settings.get("sql.limitRowCount", 1000);
            void this.executeQuery(data.context as SQLExecutionContext, data.sql, 0, data.page, pageSize, undefined,
                data.oldRequestId).then(() => { resolve(true); });
        });
    };

    private editorRunQuery = (details: IRunQueryRequest): Promise<boolean> => {
        if (this.consoleRef.current) {
            this.consoleRef.current.executeQuery(details.query, details.parameters, details.linkId);
        } else if (this.standaloneRef.current) {
            this.standaloneRef.current.executeQuery(details.query);
        }

        return Promise.resolve(true);
    };

    private editorRunScript = (details: IRunScriptRequest): Promise<boolean> => {
        return new Promise((resolve) => {
            if (this.consoleRef.current) {
                void this.consoleRef.current.executeScript(details.content).then((handled) => {
                    resolve(handled);
                });
            } else if (this.standaloneRef.current) {
                this.standaloneRef.current.executeQuery(details.content);
                resolve(true);
            } else {
                resolve(false);
            }
        });
    };

    private editorInsertUserScript = (data: { language: EditorLanguage; resourceId: number }): Promise<boolean> => {
        return new Promise((resolve, reject) => {
            ShellInterface.modules.getDataContent(data.resourceId)
                .then((event: ICommModuleDataContentEvent) => {
                    const content = event.data?.result ?? "";
                    if (this.consoleRef.current) {
                        this.consoleRef.current.insertScriptText(data.language, content);
                    } else if (this.standaloneRef.current) {
                        this.standaloneRef.current.insertScriptText(data.language, content);
                    }

                    resolve(true);
                }).catch((event) => {
                    reject();

                    void requisitions.execute("showError",
                        ["Loading Error", "Cannot load scripts content:", String(event.message)]);
                });
        });
    };

    /**
     * Called for SQL code from a code editor. All result sets start at 0 offset in this scenario.
     *
     * @param context The context with the code to execute.
     * @param params Any additional named parameters for placeholders in the query.
     * @param source Determines where the SQL code comes from that must be executed. If that's a position it means
     *               to run only the code at that (caret) position. If a string is specified then it means to run
     *               this (single) query only. If not given at all run the statements touched by the editor selection
     *               or all statements, if there's no selection.
     */
    private runSQLCode = async (context: SQLExecutionContext, params?: Array<[string, string]>,
        source?: IPosition | string): Promise<void> => {

        const pageSize = settings.get("sql.limitRowCount", 1000);

        if (source) {
            let statement: string | undefined;
            if (typeof source === "string") {
                statement = source;
            } else {
                statement = context.getStatementAtPosition(source)?.text;
            }

            if (statement) {
                await this.executeQuery(context, statement, 0, 0, pageSize, params);
            }
        } else {
            const statements = context.statements;

            let index = 0;
            while (true) {
                const statement = statements.shift();
                if (!statement) {
                    break;
                }

                await this.executeQuery(context, statement.text, index++, 0, pageSize, params);
            }
        }
    };

    /**
     * Executes a single query. The query is amended with a LIMIT clause, if the given count is > 0 (the page size)
     * and no other top level LIMIT clause already exists.
     *
     * @param context The context to send results to.
     * @param sql The query to execute.
     * @param index The index of the query being executed.
     * @param page The page number for the LIMIT clause.
     * @param count The size of a page.
     * @param params Any additional named parameters for executing a query.
     * @param oldRequestId An optional request ID which points to an existing result set. If given this is used,
     *                     to replace that old result set with the new data. Otherwise a new result set is generated.
     *
     * @returns A promise which resolves when the query execution is finished.
     */
    private executeQuery = async (context: SQLExecutionContext, sql: string, index: number, page: number, count: number,
        params?: Array<[string, string]>, oldRequestId?: string): Promise<boolean> => {

        if (sql.trim().length === 0) {
            return Promise.resolve(true);
        }

        return new Promise((resolve, reject) => {
            const { backend } = this.state;

            if (backend) {
                // Extract embedded parameters.
                const services = CodeEditorLanguageServices.instance;
                void services.extractQueryParameters(sql, context.dbVersion, context.sqlMode)
                    .then((embeddedParams: Array<[string, string]>) => {
                        // Create a list of parameter values (order is important) out from embedded parameters.
                        // Passed-in parameters can override embedded ones.
                        const actualParams: string[] = [];
                        embeddedParams.forEach((param) => {
                            const externalParam = params?.find((candidate) => {
                                return candidate[0] === param[0];
                            });

                            if (externalParam) {
                                actualParams.push(externalParam[1]);
                            } else {
                                actualParams.push(param[1]);
                            }
                        });

                        if (count > 0) {
                            // Add a top-level LIMIT clause if paging is enabled and no such LIMIT clause
                            // exists already...
                            // plus one row - this way we can determine if another page exists after this one.
                            const offset = page * count;

                            services.checkAndApplyLimits(context, sql, offset, count + 1).then(([query, changed]) => {
                                this.processListener(backend.execute(query, actualParams), context, sql, index,
                                    changed, page, oldRequestId)
                                    .then(() => {
                                        resolve(true);
                                    }).catch((reason) => {
                                        reject(reason);
                                    });
                            }).catch((reason) => {
                                reject(reason);
                            });

                        } else {
                            const listener = backend.execute(sql, actualParams);
                            this.processListener(listener, context, sql, index, false, page, oldRequestId).then(() => {
                                resolve(true);
                            }).catch((reason) => {
                                reject(reason);
                            });
                        }
                    });
            } else {
                resolve(true);
            }
        });
    };

    /**
     * Implements the handling of listener events that come in as a result of the backend responses.
     *
     * @param listener The listener that triggers events.
     * @param context The context to send result to.
     * @param sql The original query sent by the caller (does not include and auto LIMIT clause).
     * @param index The index of the query being executed.
     * @param explicitPaging True if the executed query was amended with a LIMIT clause for paging.
     * @param currentPage The current result set page that is shown.
     * @param oldRequestId If given, the results of this request replace an existing result set.
     *
     * @returns A promise that resolves when all responses have been received.
     */
    private processListener = (listener: ListenerEntry, context: SQLExecutionContext, sql: string,
        index: number, explicitPaging: boolean, currentPage: number, oldRequestId?: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            const { id } = this.props;

            listener.then((event: ICommResultSetEvent): void => {
                if (!event.data) {
                    return;
                }

                const requestId = event.data.requestId!;

                switch (event.eventType) {
                    case EventType.ErrorResponse: {
                        void requisitions.execute("showError", ["Execution Error", String(event.message)]);
                        break;
                    }

                    // No result timer will be set for the initial response.
                    case EventType.StartResponse: {
                        if (oldRequestId) {
                            // We are going to replace result data, instead of adding a complete new set.
                            // In this case remove the old data first from the storage.
                            const tx = ApplicationDB.db.transaction("dbModuleResultData", "readwrite");
                            const index = tx.store.index("resultIndex");
                            void index.openCursor(oldRequestId).then(async (cursor) => {
                                while (cursor) {
                                    await cursor.delete();
                                    cursor = await cursor.continue();
                                }
                            });
                        }

                        void ApplicationDB.db.put("dbModuleResultData", {
                            tabId: id!,
                            requestId,
                            rows: [],
                            sql,
                            currentPage,
                            hasMoreRows: false,
                            index,
                        });

                        if (index === 0 && isNil(oldRequestId)) {
                            context.setResult({
                                type: "resultSets",
                                sets: [{
                                    index,
                                    head: {
                                        requestId,
                                        sql,
                                    },
                                    data: {
                                        requestId,
                                        columns: [],
                                        rows: [],
                                        currentPage: 0,
                                    },
                                }],
                            });
                        } else {
                            context.addResultPage({
                                type: "resultSets",
                                sets: [{
                                    index,
                                    head: {
                                        requestId,
                                        oldRequestId,
                                        sql,
                                    },
                                    data: {
                                        requestId,
                                        columns: [],
                                        rows: [],
                                        currentPage: 0,
                                    },
                                }],
                            });
                        }

                        break;
                    }

                    case EventType.DataResponse: {
                        const { dbType } = this.props;
                        const columns = generateColumnInfo(dbType, event.data.columns);
                        const rows = convertRows(columns, event.data.rows);

                        void ApplicationDB.db.add("dbModuleResultData", {
                            tabId: id!,
                            requestId,
                            rows,
                            columns,
                            hasMoreRows: false,
                            currentPage,
                            index,
                        });

                        this.addTimedResult(context, {
                            type: "resultSetRows",
                            requestId,
                            rows,
                            columns,
                            currentPage,
                        });

                        break;
                    }

                    case EventType.FinalResponse: {
                        const { dbType } = this.props;

                        this.inspectQuery(context, sql);

                        let hasMoreRows = false;
                        let rowCount = event.data.totalRowCount ?? 0;
                        if (explicitPaging) {
                            // We added 1 to the total count for the LIMIT clause to allow determining if
                            // more pages are available. That's why we have to decrement the row count for display.
                            const pageSize = settings.get("sql.limitRowCount", 1000);
                            if (pageSize < rowCount) {
                                --rowCount;
                                event.data.rows?.pop();

                                hasMoreRows = true;
                            }
                        }

                        const status: IExecutionInfo = {
                            text: event.data.requestState.type + ", " + formatWithNumber("record", rowCount) +
                                " retrieved in " + formatTime(event.data.executionTime),
                        };

                        if (rowCount === 0) {
                            // Indicate that this data is a simple response (no data actually).
                            status.type = MessageType.Response;
                        }

                        const columns = generateColumnInfo(dbType, event.data.columns);
                        const rows = convertRows(columns, event.data.rows);

                        void ApplicationDB.db.add("dbModuleResultData", {
                            tabId: id!,
                            requestId,
                            rows,
                            columns,
                            executionInfo: status,
                            hasMoreRows,
                            currentPage,
                            index,
                        });

                        this.addTimedResult(context, {
                            type: "resultSetRows",
                            requestId,
                            rows,
                            columns,
                            hasMoreRows,
                            currentPage,
                            totalRowCount: event.data.totalRowCount ?? 0,
                            executionInfo: status,
                        });

                        resolve();

                        break;
                    }

                    default: {
                        // TODO: handle in log
                        resolve();

                        break;
                    }
                }
            }).catch((event): void => {
                if (event.data?.requestId) { // Only ICommErrorEvent contains a request ID.
                    const resultTimer = this.resultTimers.get(event.data.requestId as string);
                    if (resultTimer) {
                        void clearIntervalAsync(resultTimer.timer).then(() => {
                            this.resultTimers.delete(event.data.requestId as string);
                        });
                    }

                    const status = { type: MessageType.Error, text: `Error: ${event.message as string}` };

                    // For now test the error message, but it should come in as final response, instead.
                    if (event.message === "Query killed") {
                        status.type = MessageType.Warning;
                        status.text = "Cancelled: query was prematurely stopped";
                    }

                    void ApplicationDB.db.add("dbModuleResultData", {
                        tabId: id!,
                        requestId: event.data.requestId,
                        rows: [],
                        executionInfo: status,
                        hasMoreRows: false,
                        currentPage,
                        index,
                    });

                    void context.addResultData({
                        type: "resultSetRows",
                        requestId: event.data.requestId,
                        columns: [],
                        rows: [],
                        executionInfo: status,
                        currentPage,
                    }).then(() => {
                        context.updateResultDisplay();
                    });

                    resolve(); // No promise error at this point, as we handled the error already.
                } else {
                    reject(event);
                }
            });
        });
    };

    private reconnect = async (context: ExecutionContext): Promise<boolean> => {
        return new Promise((resolve, reject) => {
            const { backend } = this.state;

            if (backend) {
                this.processReconnectListener(backend.reconnect(), context).then(() => {
                    resolve(true);
                }).catch((reason) => {
                    reject(reason);
                });
            } else {
                resolve(true);
            }
        });
    };

    /**
     * Implements the handling of listener events that come in as a result of the backend responses.
     *
     * @param listener The listener that triggers events.
     * @param context The context to send result to.
     *
     * @returns A promise that resolves when all responses have been received.
     */
    private processReconnectListener = (listener: ListenerEntry, context: ExecutionContext): Promise<void> => {
        return new Promise((resolve) => {
            listener.then((event: ICommResultSetEvent): void => {
                if (!event.data) {
                    return;
                }

                // const requestId = event.data.requestId!;

                switch (event.eventType) {
                    case EventType.FinalResponse: {
                        void context.addResultData({
                            type: "text",
                            requestId: "",
                            text: [{
                                type: MessageType.Info,
                                index: 0,
                                content: event.message,
                                language: "ansi",
                            }],
                        }).then(() => {
                            context.updateResultDisplay();
                            resolve();
                        });

                        break;
                    }

                    default: {
                        // TODO: handle in log
                        resolve();

                        break;
                    }
                }
            }).catch((event): void => {
                void context.addResultData({
                    type: "text",
                    requestId: "",
                    text: [{
                        type: MessageType.Error,
                        index: 0,
                        content: event.message,
                        language: "ansi",
                    }],
                }).then(() => {
                    context.updateResultDisplay();
                    resolve(); // No promise error at this point, as we handled the error already.
                });
            });
        });
    };


    /**
     * Adds the given data to the result timer for the specified request ID. If no timer exists yet, one is created.
     *
     * @param context The context to send the result data to.
     * @param result The result data to schedule.
     */
    private addTimedResult(context: SQLExecutionContext, result: IResultSetRows): void {
        const resultTimer = this.resultTimers.get(result.requestId);

        if (resultTimer) {
            resultTimer.results.push(result);
        } else {
            // If no timer exists yet it means this is the first response with real data.
            // Send this directly to the context to have a quick first visual update.
            // Then create the timer with no rows, waiting for more to come.
            void context.addResultData(result).then((added) => {
                if (added) {
                    context.updateResultDisplay();
                }
            });

            const newTimer: IResultTimer = {
                timer: setIntervalAsync(async (requestId: string) => {
                    const resultTimer = this.resultTimers.get(requestId);
                    if (resultTimer) {
                        const pendingResult = resultTimer.results.shift();
                        if (pendingResult) {
                            await context.addResultData(pendingResult);
                        } else {
                            // No results left. Stop the timer.
                            void clearIntervalAsync(resultTimer.timer).then(() => {
                                this.resultTimers.delete(requestId);
                            });
                            context.updateResultDisplay();
                        }
                    }
                }, 250, result.requestId),

                results: [], // Rows are sent already before timer creation.
            };

            this.resultTimers.set(result.requestId, newTimer);
        }
    }

    /**
     * Determines the type of the given statement to learn if it affects any of our states used in the UI, like
     * auto commit mode, SQL mode, current schema etc.
     *
     * For certain types commands are triggered to allow other parts of the app to update their data.
     *
     * @param context The execution environment.
     * @param statement The statement to inspect.
     */
    private inspectQuery = (context: ExecutionContext, statement: string): void => {
        const { id, connectionId } = this.props;
        const { backend } = this.state;
        const services = CodeEditorLanguageServices.instance;

        services.determineQueryType(context, statement).then((type) => {
            switch (type) {
                case QueryType.SetAutoCommit:
                case QueryType.StartTransaction:
                case QueryType.BeginWork:
                case QueryType.Commit:
                case QueryType.RollbackWork: {
                    void requisitions.execute("sqlTransactionChanged", undefined);

                    break;
                }

                case QueryType.Use: {
                    // The user wants to change the current schema.
                    // This may have failed so query the backend for the current schema and then trigger the command.
                    void backend?.getCurrentSchema().then((schema: string) => {
                        void requisitions.execute("sqlSetCurrentSchema",
                            { id: id ?? "", connectionId, schema });
                    });

                    break;
                }

                default: {
                    break;
                }
            }
        }).catch(() => {
            // Ignore.
        });


    };

    /**
     * Handles all incoming execution requests from the editors.
     *
     * @param context The context containing the code to be executed.
     * @param params Additional named parameters to be used in SQL queries.
     * @param source An optional caret position to provide the execute-at-position feature or a query to execute.
     */
    private handleExecution = (context: ExecutionContext, params?: Array<[string, string]>,
        source?: IPosition | string): void => {
        const { workerPool } = this.props;
        this.runningContexts.set(context.id, context);

        const command = context.code.trim();
        const parts = command.split(" ");
        let runExecution = true;

        if (parts.length > 0) {
            const temp = parts[0].toLowerCase();
            switch (temp) {
                case "\\about": {
                    const isMac = navigator.userAgent.includes("Macintosh");
                    const content = DBEditorTab.aboutMessage.replace("%modifier%", isMac ? "Cmd" : "Ctrl");
                    context?.setResult({
                        type: "text",
                        requestId: "",
                        text: [{ type: MessageType.Info, content, language: "ansi" }],
                    });
                    runExecution = false;

                    break;
                }

                case "\\reconnect": {
                    context?.setResult({
                        type: "text",
                        requestId: "",
                        text: [{
                            type: MessageType.Info,
                            content: "Reconnecting the current DB connection ...\n",
                            language: "ansi",
                        }],
                    });
                    void this.reconnect(context);
                    runExecution = false;

                    break;
                }

                default: {
                    break;
                }
            }
        }

        if (runExecution) {
            switch (context.language) {
                case "javascript": {
                    //context.setResult();
                    workerPool.runTask({ api: ScriptingApi.Request, code: context.code, contextId: context.id })
                        .then(this.handleTaskResult);

                    break;
                }

                case "typescript": {
                    //context.setResult();
                    workerPool.runTask({
                        api: ScriptingApi.Request,
                        code: ts.transpile(context.code),
                        contextId: context.id,
                    }).then(this.handleTaskResult);

                    break;
                }

                case "sql":
                case "mysql": {
                    void this.runSQLCode(context as SQLExecutionContext, params, source);
                    break;
                }

                default:
                    break;
            }
        }
    };

    /**
     * Called when data from a task (which we have scheduled above) arrives.
     *
     * @param taskId The ID of the task. Used to add further requests to it.
     * @param data The data returned by the worker.
     */
    private handleTaskResult = (taskId: number, data: IConsoleWorkerResultData): void => {
        const { workerPool } = this.props;
        const { backend } = this.state;

        try {
            switch (data.api) {
                case ScriptingApi.QueryStatus: {
                    const result = data.result as IResultSetData;
                    const status = `${result.requestState.type}, ` +
                        `${formatWithNumber("record", result.totalRowCount || 0)} retrieved in ` +
                        `${formatTime(result.executionTime)}`;

                    const context = this.runningContexts.get(data.contextId);
                    void context?.addResultData({
                        type: "text",
                        text: [{
                            type: MessageType.Info,
                            content: status,
                            language: "ansi",
                        }],
                        executionInfo: { text: "" },
                    }).then((added) => {
                        if (added) {
                            context?.updateResultDisplay();
                        }
                    });

                    break;
                }

                case ScriptingApi.Result: { // Evaluation result.
                    if (data.result && data.result !== "PENDING") {
                        const context = this.runningContexts.get(data.contextId);
                        if (context) {
                            if (data.isError) {
                                void context?.addResultData({
                                    type: "text",
                                    text: [{
                                        type: MessageType.Error,
                                        content: String(data.result),
                                        language: "ansi",
                                    }],
                                    executionInfo: { type: MessageType.Error, text: "" },
                                }).then((added) => {
                                    if (added) {
                                        context?.updateResultDisplay();
                                    }
                                });
                            } else {
                                void context?.addResultData({
                                    type: "text",
                                    text: [{
                                        type: MessageType.Info,
                                        content: String(data.result),
                                    }],
                                }).then((added) => {
                                    if (added) {
                                        context?.updateResultDisplay();
                                    }
                                });
                            }

                        }
                    }

                    break;
                }

                case ScriptingApi.RunSql: {
                    if (backend) {
                        // Make sure the task we are running currently on, stays assigned to this loop.
                        workerPool.retainTask(taskId);

                        let columns: Array<{ name: string; type: string }>;
                        let result: Array<Record<string, unknown>> = [];

                        backend.execute(data.code!, data.params as string[])
                            .then((event: ICommResultSetEvent): void => {
                                switch (event.eventType) {
                                    case EventType.DataResponse:
                                    case EventType.FinalResponse: {
                                        if (event.data) {
                                            // First result holds column information
                                            if (event.data.columns) {
                                                columns = event.data.columns;
                                                result = [];
                                            }

                                            if (event.data.rows) {
                                                for (const row of event.data.rows) {
                                                    // Convert rows to objects.
                                                    const rowForRes: Record<string, unknown> = {};
                                                    if (Array.isArray(row)) {
                                                        for (let i = 0; i < row.length; i++) {
                                                            rowForRes[columns[i].name] = row[i];
                                                        }
                                                    }
                                                    result.push(rowForRes);
                                                }
                                            }
                                        }

                                        if (event.eventType === EventType.FinalResponse) {
                                            // Send back the result data to the worker to allow the user to act on
                                            // that in their JS code. If the `final` member of the data is set to
                                            // true, the task is implicitly released and freed.
                                            workerPool.continueTask(taskId, {
                                                api: ScriptingApi.Request,
                                                result,
                                                contextId: data.contextId,
                                                final: true,
                                            });
                                        }

                                        break;
                                    }

                                    default: {
                                        break;
                                    }
                                }
                            })
                            .catch((event: ICommErrorEvent): void => {
                                const context = this.runningContexts.get(data.contextId);
                                context?.setResult({
                                    type: "text",
                                    executionInfo: {
                                        type: MessageType.Error,
                                        text: `Error: ${event.data?.requestState.msg ?? "<unknown>"}`,
                                    },
                                });

                                workerPool.releaseTask(taskId);
                            });
                    }

                    break;
                }


                case ScriptingApi.RunSqlIterative: {
                    if (backend) {
                        // Make sure the task we are running currently on, stays assigned to this loop.
                        workerPool.retainTask(taskId);

                        backend.execute(data.code!, data.params as string[])
                            .then((event: ICommResultSetEvent): void => {
                                switch (event.eventType) {
                                    case EventType.DataResponse:
                                    case EventType.FinalResponse: {
                                        // Send back the result data to the worker to allow the user to act on that in
                                        // their JS code. If the `final` member of the data is set to true, the task is
                                        // implicitly released and freed.
                                        workerPool.continueTask(taskId, {
                                            api: ScriptingApi.Request,
                                            result: event.data,
                                            contextId: data.contextId,
                                            final: event.eventType === EventType.FinalResponse,
                                        });

                                        break;
                                    }

                                    default: {
                                        break;
                                    }
                                }
                            })
                            .catch((event: ICommErrorEvent): void => {
                                const context = this.runningContexts.get(data.contextId);
                                context?.setResult({
                                    type: "text",
                                    executionInfo: {
                                        type: MessageType.Error,
                                        text: `Error: ${event.data?.requestState.msg ?? "<unknown>"}`,
                                    },
                                });

                                workerPool.releaseTask(taskId);
                            });
                    }

                    break;
                }

                case ScriptingApi.Print: {
                    const context = this.runningContexts.get(data.contextId);

                    if (!isNil(data.value)) {
                        void context?.addResultData({
                            type: "text",
                            text: [{
                                type: MessageType.Info,
                                content: String(data.value),
                            }],
                        }).then((added) => {
                            if (added) {
                                context?.updateResultDisplay();
                            }
                        });
                    }

                    break;
                }

                case ScriptingApi.Graph: {
                    const context = this.runningContexts.get(data.contextId);
                    context?.setResult({
                        type: "graphData",
                        options: data.options,
                    });

                    break;
                }

                default: {
                    break;
                }
            }
        } catch (error) {
            const context = this.runningContexts.get(data.contextId);
            void context?.addResultData({
                type: "text",
                text: [{
                    type: MessageType.Error,
                    content: error instanceof Error ? (error.stack ?? error.message) : String(error),
                }],
                executionInfo: { type: MessageType.Error, text: "" },
            }).then((added) => {
                if (added) {
                    context?.updateResultDisplay();
                }
            });

        }
    };

    private handleSelectEditor = (editorId: string): void => {
        const { id, onSelectEditor } = this.props;

        onSelectEditor?.(id!, editorId);
    };

    private handleCloseEditor = (editorId: string): void => {
        const { id, onRemoveEditor } = this.props;

        onRemoveEditor?.(id!, editorId);
    };

    private handleAddEditor = (): string | undefined => {
        const { id, onAddEditor } = this.props;

        return onAddEditor?.(id!);
    };

    private handleChangeEditor = (editorId: string, newCaption: string): void => {
        const { id, onChangeEditor } = this.props;

        return onChangeEditor?.(id!, editorId, newCaption);
    };

    private handleEditorSelectorChange = (selectedId: string | number): void => {
        const { id, onSelectEditor } = this.props;

        onSelectEditor?.(id!, selectedId as string);
    };

    private handleAddScript = (language: EditorLanguage): void => {
        const { id, onAddScript, dbType } = this.props;

        onAddScript?.(id!, language, dbType);
    };

    private saveSchemaTree = (id: string, schemaTree: ISchemaTreeEntry[]): void => {
        const { onSaveSchemaTree } = this.props;

        onSaveSchemaTree?.(id, schemaTree);
    };

    private saveExplorerState = (id: string, state: Map<string, IExplorerSectionState>): void => {
        const { onSaveExplorerState } = this.props;

        onSaveExplorerState?.(id, state);
    };

    private handleExplorerMenuAction = (id: string, actionId: string, params?: unknown): void => {
        const { connectionId } = this.props;
        const { backend } = this.state;

        const data = params as ISchemaTreeEntry;
        switch (actionId) {
            case "setDefaultMenuItem": {
                backend?.setCurrentSchema(data.qualifiedName.schema).then(() => {
                    void requisitions.execute("sqlSetCurrentSchema",
                        { id, connectionId, schema: data.qualifiedName.schema });
                }).catch((errorEvent: ICommErrorEvent) => {
                    void requisitions.execute("showError", ["Cannot set default schema", errorEvent.message]);
                });

                break;
            }

            case "filterMenuItem": {
                break;
            }

            case "inspectorMenuItem": {
                break;
            }

            case "clipboardNameMenuItem": {
                requisitions.writeToClipboard(data.caption);
                break;
            }

            case "clipboardCreateStatementMenuItem": {
                let type;
                let qualifier = `\`${data.qualifiedName.schema}\`.`;
                let index = 1; // The column index in the result row.
                switch (data.type) {
                    case SchemaTreeType.Schema: {
                        type = "schema";
                        qualifier = "";
                        break;
                    }

                    case SchemaTreeType.Table: {
                        type = "table";
                        break;
                    }

                    case SchemaTreeType.View: {
                        type = "view";
                        break;
                    }

                    case SchemaTreeType.StoredFunction: {
                        index = 2;
                        type = "function";
                        break;
                    }

                    case SchemaTreeType.StoredProcedure: {
                        index = 2;
                        type = "procedure";
                        break;
                    }

                    case SchemaTreeType.Trigger: {
                        type = "trigger";
                        break;
                    }

                    case SchemaTreeType.Event: {
                        type = "event";
                        break;
                    }

                    case SchemaTreeType.User: {
                        type = "user";
                        break;
                    }

                    default:
                }

                if (type) {
                    backend?.execute(`show create ${type} ${qualifier}\`${data.caption}\``)
                        .then((event: ICommResultSetEvent) => {
                            if (event.data?.rows && event.data.rows.length > 0) {
                                // Returns one row with 2 columns.
                                const row = event.data.rows[0] as string[];
                                if (row.length > index) {
                                    requisitions.writeToClipboard(row[index]);
                                }
                            }
                        });
                }

                break;
            }

            case "editorNameMenuItem": {
                break;
            }

            case "editorCreateStatementMenuItem": {
                break;
            }

            case "createSchemaMenuItem": {
                break;
            }

            case "alterSchemaMenuItem": {
                break;
            }

            case "dropSchemaMenuItem": {
                break;
            }

            case "refreshMenuItem": {
                break;
            }

            default: {
                // Forward any other menu action to the model.
                const { id, onExplorerMenuAction } = this.props;
                onExplorerMenuAction?.(id!, actionId, params);

                break;
            }
        }
    };

    private handlePaneResize = (first: ISplitterPaneSizeInfo): void => {
        if (first.paneId === "explorer") {
            const { id = "", onExplorerResize } = this.props;

            onExplorerResize?.(id, first.size);
        }
    };

}
