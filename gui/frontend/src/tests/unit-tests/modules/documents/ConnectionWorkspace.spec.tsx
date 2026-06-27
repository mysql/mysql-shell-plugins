/*
 * Copyright (c) 2022, 2026, Oracle and/or its affiliates.
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

/* eslint-disable @typescript-eslint/unbound-method */

import { render } from "@testing-library/preact";
import { createRef, type RefObject } from "preact";
import { afterAll, beforeAll, describe, expect, it, vi, type Mock } from "vitest";

import { StoreType } from "../../../../app-logic/ApplicationDB.js";
import { registerUiLayer } from "../../../../app-logic/UILayer.js";
import type { IServicePasswordRequest } from "../../../../app-logic/general-types.js";
import type { IMdsChatData } from "../../../../communication/ProtocolMds.js";
import { ICodeEditorModel, IEditorPersistentState } from "../../../../components/ui/CodeEditor/CodeEditor.js";
import { CodeEditorMode, Monaco, type IScriptExecutionOptions } from "../../../../components/ui/CodeEditor/index.js";
import { ConnectionDataModel } from "../../../../data-models/ConnectionDataModel.js";
import { OdmEntityType, OpenDocumentDataModel } from "../../../../data-models/OpenDocumentDataModel.js";
import {
    ConnectionWorkspace, IOpenDocumentState, type IConnectionPresentationState, type QueryResult,
} from "../../../../modules/db-editor/ConnectionWorkspace.js";
import { LakehouseNavigatorTab } from "../../../../modules/db-editor/LakehouseNavigator.js";
import type { Notebook } from "../../../../modules/db-editor/Notebook.js";
import type { ScriptEditor } from "../../../../modules/db-editor/ScriptEditor.js";
import { SqlQueryExecutor } from "../../../../modules/db-editor/SqlQueryExecutor.js";
import { ExecutionWorkerPool } from "../../../../modules/db-editor/execution/ExecutionWorkerPool.js";
import { DocumentContext, type DocumentContextType } from "../../../../modules/db-editor/index.js";
import type { ExecutionContext } from "../../../../script-execution/ExecutionContext.js";
import { ExecutionContexts } from "../../../../script-execution/ExecutionContexts.js";
import { PresentationInterface } from "../../../../script-execution/PresentationInterface.js";
import { currentNotebookVersion } from "../../../../script-execution/index.js";
import {
    SQLExecutionContext, type IRuntimeErrorData, type IStacktraceInfo
} from "../../../../script-execution/SQLExecutionContext.js";
import { ScriptingLanguageServices } from "../../../../script-execution/ScriptingLanguageServices.js";
import { appParameters } from "../../../../supplement/AppParameters.js";
import type { IEditorExtendedExecutionOptions, IOpenFileDialogResult } from "../../../../supplement/RequisitionTypes.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import { DBType } from "../../../../supplement/ShellInterface/index.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import type { IScriptRequest, ISqlPageRequest } from "../../../../supplement/index.js";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher.js";
import * as helpers from "../../../../utilities/helpers.js";
import { uuid } from "../../../../utilities/helpers.js";
import { notebookDocumentMock } from "../../__mocks__/DocumentModuleMocks.js";
import { uiLayerMock } from "../../__mocks__/UILayerMock.js";
import { mockClassMethods, nextProcessTick, nextRunLoop, setupShellForTests } from "../../test-helpers.js";

// @ts-expect-error, we need access to a private members here.
class TestConnectionWorkspace extends ConnectionWorkspace {
    declare public static shiftMLEStacktraceLineNumbers: (
        stackTrace: QueryResult, jsStartLine: number) => IStacktraceInfo | undefined;

    public declare selectFile: (fileResult: IOpenFileDialogResult) => Promise<boolean>;
    public declare editorLoadNotebook: (details?: {
        id?: string;
        fileName?: string;
        content?: string;
        standalone?: boolean;
        createNew?: boolean;
    }) => Promise<boolean>;
    public declare handleAddEditor: () => Promise<string | undefined>;
    public declare notebookRef: RefObject<Notebook>;
    public declare scriptRef: RefObject<ScriptEditor>;
    public declare scriptWaiting: boolean;

    public declare findActiveEditor: () => IOpenDocumentState | undefined;
    public declare findOpenEditor: (editorId?: string) => IOpenDocumentState | undefined;
    public declare shouldAutoExecuteAbout: (editor: IOpenDocumentState) => boolean;
    public declare handleExecution: (context: ExecutionContext, options: IScriptExecutionOptions) => Promise<boolean>;
    public declare runSQLCode: (context: SQLExecutionContext, options: IScriptExecutionOptions) => Promise<void>;
    public declare explainError: (context: ExecutionContext) => Promise<boolean>;
}

interface IMLEStacktrace {
    stacktrace: string,
    jsStartline: number,
    shiftedStacktrace: string,
}

vi.mock("../../../../components/ui/CodeEditor/CodeEditor");
vi.mock("../../../../script-execution/ScriptingLanguageServices.js", async () => {
    const actual = await vi.importActual("../../../../script-execution/ScriptingLanguageServices.js");

    return {
        ...actual,
    };
});

mockClassMethods(ShellInterfaceSqlEditor, {
    execute: vi.fn(),
});

describe("DBConnectionWorkspace tests", (): void => {
    let content = `\nprint("typescript");\n\\js\n`;
    content += `\nprint("javascript");\n\\sql\n`;
    content += `\nselect "(my)sql" from dual;\n\\py\n`;
    content += `\nprint("python");\n`;

    const model: ICodeEditorModel = Object.assign(Monaco.createModel("", "msg"), {
        executionContexts: new ExecutionContexts(),
        editorMode: CodeEditorMode.Standard,
    });

    if (model.getEndOfLineSequence() !== Monaco.EndOfLineSequence.LF) {
        model.setEOL(Monaco.EndOfLineSequence.LF);
    } else {
        // Necessary to counter the model version increase that happens when the other branch is taken.
        model.setValue(content);
    }

    model.setValue(content);

    let launcher: MySQLShellLauncher;
    const connectionsDataModel = new ConnectionDataModel(false); // No need to initialize the data model.
    const documentDataModel = new OpenDocumentDataModel(false);

    const wp = new ExecutionWorkerPool();
    const eps: IEditorPersistentState = {
        viewState: null,
        model,
        options: {},
    };

    const edState: IOpenDocumentState = {
        document: notebookDocumentMock,
        state: eps,
        currentVersion: 0,
    };

    const savedState: IConnectionPresentationState = {
        heatWaveEnabled: false,
        documents: [],
        documentStates: [edState],
        mleEnabled: false,
        isCloudInstance: false,
        hasExplainError: false,
        activeEntry: "SQLEditor",
        graphData: {
            timestamp: new Date().getTime(),
            activeColorScheme: "grays",
            displayInterval: 300,
            currentValues: new Map(),
            computedValues: {},
            series: new Map(),
        },
        adminPageStates: {
            lakehouseNavigatorState: {
                autoRefreshTablesAndTasks: true,
                activeTabId: LakehouseNavigatorTab.Overview,
            },
        },
        chatOptionsState: {
            chatOptionsExpanded: false,
            chatOptionsWidth: -1,
        },
        executionHistory: [],
        currentExecutionHistoryIndex: 0,
    };

    const connection = connectionsDataModel.createConnectionEntry({
        id: 123,
        index: -1,
        dbType: DBType.MySQL,
        caption: "details1",
        description: "description1",
        options: {},
    });

    const mleStacktraces: IMLEStacktrace[] = [
        {
            stacktrace: "<js> execute(/mysql/sql:455:15421-15464)\n<js> my_proc:6:14-31\n",
            jsStartline: 3,
            shiftedStacktrace:
                "Exception Stack Trace: \n<js> execute(/mysql/sql:455:15421-15464)\n<js> my_proc:9:14-31",
        },
        {
            stacktrace: "<js> execute(/mysql/sql:455:15421-15464)\n<js> my_proc:6:14-31\n",
            jsStartline: 3,
            shiftedStacktrace:
                "Exception Stack Trace: \n<js> execute(/mysql/sql:455:15421-15464)\n<js> my_proc:9:14-31",
        },
        {
            stacktrace: "<js> my_proc:2:7-35\n",
            jsStartline: 5,
            shiftedStacktrace:
                "Exception Stack Trace: \n<js> my_proc:7:7-35",
        },
        {
            stacktrace: "<js> js_throw_exception_mult_line:1-6:7-32\n",
            jsStartline: 2,
            shiftedStacktrace:
                "Exception Stack Trace: \n<js> js_throw_exception_mult_line:3-8:7-32",
        },
        {
            stacktrace: "<js> my_proc:4:7-33\n",
            jsStartline: 3,
            shiftedStacktrace:
                "Exception Stack Trace: \n<js> my_proc:7:7-33",
        },
        {
            stacktrace: "<js> my_proc:6:7-35\n",
            jsStartline: 3,
            shiftedStacktrace:
                "Exception Stack Trace: \n<js> my_proc:9:7-35",
        },
        {
            stacktrace: "<js> js_throw_exception_one_line:1:19-44\n",
            jsStartline: 2,
            shiftedStacktrace:
                "Exception Stack Trace: \n<js> js_throw_exception_one_line:3:19-44",
        },
        {
            stacktrace: "<js> fun:2:7-27\n<js> my_proc:4:1-5\n",
            jsStartline: 3,
            shiftedStacktrace:
                "Exception Stack Trace: \n<js> fun:5:7-27\n<js> my_proc:7:1-5",
        },
        {

            stacktrace: "<js> fun3:2:7-27\n<js> fun2:5:1-6\n<js> fun1:8:1-6\n<js> fun:11:1-6\n<js> my_proc:13:1-5\n",
            jsStartline: 3,
            shiftedStacktrace:
                // eslint-disable-next-line max-len
                `Exception Stack Trace: \n<js> fun3:5:7-27\n<js> fun2:8:1-6\n<js> fun1:11:1-6\n<js> fun:14:1-6\n<js> my_proc:16:1-5`,
        },
        {
            stacktrace: "<js> pc00120075:1:1-6\n",
            jsStartline: 3,
            shiftedStacktrace:
                "Exception Stack Trace: \n<js> pc00120075:4:1-6",
        },
    ];

    const mleStacktraceShiftingFunc = TestConnectionWorkspace.shiftMLEStacktraceLineNumbers;

    beforeAll(async () => {
        registerUiLayer(uiLayerMock);
        launcher = await setupShellForTests(true, true, "DEBUG2", "ConnectionWorkspaceTests");
    });

    afterAll(async () => {
        await launcher.exitProcess();
        vi.resetAllMocks();
    });

    it.each(mleStacktraces)("Test shifting MLE stacktrace", ({ stacktrace, jsStartline, shiftedStacktrace }) => {
        const result = mleStacktraceShiftingFunc({ rows: [[stacktrace]] }, jsStartline);
        expect(result?.message).toEqual(shiftedStacktrace);
    });

    it("auto-executes about only for the first notebook in a connection workspace", () => {
        const firstNotebookState: IOpenDocumentState = {
            ...edState,
            document: { ...notebookDocumentMock, id: "notebook1" },
            autoExecuteAbout: true,
        };
        const secondNotebookState: IOpenDocumentState = {
            ...edState,
            document: { ...notebookDocumentMock, id: "notebook2" },
            autoExecuteAbout: false,
        };
        const tab = new TestConnectionWorkspace({
            connection,
            savedState: {
                ...savedState,
                activeEntry: "notebook1",
                documentStates: [firstNotebookState, secondNotebookState],
            },
            workerPool: wp,
            showAbout: true,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        });

        expect(tab.shouldAutoExecuteAbout(firstNotebookState)).toBe(true);
        expect(tab.shouldAutoExecuteAbout(secondNotebookState)).toBe(false);
    });

    it("Test DBConnectionWorkspace snapshot", () => {
        let nextName = false;
        let nextTimestamp = false;
        expect.addSnapshotSerializer({
            test: (val) => {
                if (nextName) {
                    nextName = false;

                    return true;
                } else if (nextTimestamp) {
                    nextTimestamp = false;

                    return true;
                } else if (typeof val === "string" && val === "name") {
                    nextName = true;
                } else if (typeof val === "string" && val === "timestamp") {
                    nextName = true;
                }

                return false;
            },
            print: (val, serialize) => {

                return serialize("MOCK_VALUE");
            },
        });

        const { container, unmount } = render(
            <ConnectionWorkspace
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        expect(container).toMatchSnapshot();
        unmount();
    });

    it("updates SQL execution when switching between transient connections for the same saved connection", () => {
        const secondConnection = connectionsDataModel.createConnectionEntry({ ...connection.details });
        const connectionSetter = vi.spyOn(SqlQueryExecutor.prototype, "connection", "set");
        const workspace = (activeConnection: typeof connection) => {
            return <ConnectionWorkspace
                connection={activeConnection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />;
        };
        const { rerender, unmount } = render(workspace(connection));

        rerender(workspace(secondConnection));

        expect(connectionSetter).toHaveBeenCalledWith(secondConnection);

        connectionSetter.mockRestore();
        unmount();
    });

    it("Test editorStopExecution requisition function call", async () => {
        const { unmount } = render(
            <ConnectionWorkspace
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const callback = vi.fn();
        const promise = connection.backend.execute("SELECT 1", undefined, undefined, callback);
        const result = await requisitions.execute("editorStopExecution", undefined);
        await promise;

        expect(result).toBe(true);
        expect(callback).not.toHaveBeenCalled();

        unmount();
    });

    it("Test editorCommit requisition function call", async () => {
        const { unmount } = render(
            <ConnectionWorkspace
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        let sqlTransactionFunctionCalled = false;

        requisitions.register("sqlTransactionChanged", async () => {
            sqlTransactionFunctionCalled = true;
            await nextProcessTick();

            return false;
        });

        const result = await requisitions.execute("editorCommit", undefined);

        expect(result).toBe(true);
        expect(sqlTransactionFunctionCalled).toBe(true);
        expect(uiLayerMock.showInformationMessage).toHaveBeenCalled();

        requisitions.unregister("sqlTransactionChanged");

        unmount();
    });

    it("Test editorRollback requisition function call", async () => {
        const { unmount } = render(
            <ConnectionWorkspace
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        let sqlTransactionChangedFunctionCalled = false;

        requisitions.register("sqlTransactionChanged", async () => {
            sqlTransactionChangedFunctionCalled = true;
            await nextProcessTick();

            return false;
        });
        const result = await requisitions.execute("editorRollback", undefined);

        expect(result).toBe(true);
        expect(sqlTransactionChangedFunctionCalled).toBe(true);

        requisitions.unregister("sqlTransactionChanged");

        unmount();
    });

    it("prefers connection-scoped auto-commit state in desktop run state", () => {
        const tab = new TestConnectionWorkspace({
            connection,
            savedState,
            workerPool: wp,
            showAbout: false,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        });

        vi.spyOn(tab, "getActiveDesktopDocumentType").mockReturnValue("script");
        tab.state = {
            ...tab.state,
            autoCommit: false,
        };
        tab.scriptRef.current = {
            getDesktopRunState: () => ({
                canExecute: true,
                canExecuteSubparts: true,
                canStop: false,
                autoCommit: true,
                transactionOpen: false,
                stopOnErrors: true,
            }),
        } as unknown as ScriptEditor;

        expect(tab.getDesktopRunState()?.autoCommit).toBe(false);
    });

    it("stores execution history only for notebook executions", async () => {
        const originalAddExecutionHistoryEntry = connection.backend.addExecutionHistoryEntry;
        const addExecutionHistoryEntry = vi.fn().mockResolvedValue(1);
        connection.backend.addExecutionHistoryEntry = addExecutionHistoryEntry;

        const createTab = (documentType: OdmEntityType.Notebook | OdmEntityType.Script): TestConnectionWorkspace => {
            const id = documentType === OdmEntityType.Notebook ? "notebook-history" : "script-history";
            const document = documentType === OdmEntityType.Notebook
                ? { ...notebookDocumentMock, id }
                : {
                    id,
                    caption: "Script",
                    type: OdmEntityType.Script,
                    language: "mysql",
                } as IOpenDocumentState["document"];

            const tab = new TestConnectionWorkspace({
                connection,
                savedState: {
                    ...savedState,
                    activeEntry: id,
                    documentStates: [{
                        ...edState,
                        document,
                    }],
                    executionHistory: [],
                    currentExecutionHistoryIndex: 0,
                },
                workerPool: wp,
                showAbout: false,
                toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
            });

            tab.runSQLCode = vi.fn().mockResolvedValue(undefined);

            return tab;
        };

        const createContext = (id: string): SQLExecutionContext => {
            return {
                id,
                code: "select 1",
                language: "mysql",
                clearResult: vi.fn().mockResolvedValue(undefined),
            } as unknown as SQLExecutionContext;
        };

        try {
            await createTab(OdmEntityType.Notebook).handleExecution(createContext("notebook-context"), {});

            expect(addExecutionHistoryEntry).toHaveBeenCalledWith(connection.details.id, "select 1", "mysql");

            addExecutionHistoryEntry.mockClear();

            await createTab(OdmEntityType.Script).handleExecution(createContext("script-context"), {});

            expect(addExecutionHistoryEntry).not.toHaveBeenCalled();
        } finally {
            connection.backend.addExecutionHistoryEntry = originalAddExecutionHistoryEntry;
        }
    });

    it("does not navigate notebook history when the requested direction is unavailable", () => {
        const historyState = {
            ...savedState,
            executionHistory: [],
            currentExecutionHistoryIndex: 0,
        };
        const tab = new TestConnectionWorkspace({
            connection,
            savedState: historyState,
            workerPool: wp,
            showAbout: false,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        });
        const getExecutionHistoryEntry = vi.fn();

        connection.backend.getExecutionHistoryEntry = getExecutionHistoryEntry;
        tab.notebookRef.current = {
            restoreHistoryState: vi.fn(),
        } as unknown as Notebook;

        expect(tab.navigateHistory(true)).toBe(false);
        expect(tab.navigateHistory(false)).toBe(false);
        expect(getExecutionHistoryEntry).not.toHaveBeenCalled();
    });

    it("restores the previous notebook history entry through the shared navigation path", async () => {
        const historyState = {
            ...savedState,
            executionHistory: [{
                index: 0,
                code: "select 1",
                languageId: "mysql",
                currentTimestamp: new Date().toISOString(),
            }],
            currentExecutionHistoryIndex: 0,
        };
        const tab = new TestConnectionWorkspace({
            connection,
            savedState: historyState,
            workerPool: wp,
            showAbout: false,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        });
        const restoreHistoryState = vi.fn();
        const getExecutionHistoryEntry = vi.fn().mockResolvedValue({
            index: 0,
            code: "select 1",
            languageId: "mysql",
            currentTimestamp: new Date().toISOString(),
        });

        connection.backend.getExecutionHistoryEntry = getExecutionHistoryEntry;
        tab.notebookRef.current = {
            currentContext: {
                code: "select 2",
                language: "mysql",
            },
            restoreHistoryState,
        } as unknown as Notebook;

        expect(tab.navigateHistory(true)).toBe(true);
        await Promise.resolve();

        expect(historyState.executionHistoryUnsavedCode).toBe("select 2");
        expect(getExecutionHistoryEntry).toHaveBeenCalledWith(connection.details.id, 0);
        expect(restoreHistoryState).toHaveBeenCalledWith(expect.objectContaining({
            code: "select 1",
            languageId: "mysql",
        }));
    });

    it("Test editorLoadScript requisition function call", async () => {
        const onLoadScriptMock = vi.fn();
        const onEditorRenameMock = vi.fn();
        const tabRef = createRef<TestConnectionWorkspace>();
        const openState = {
            document: {
                id: "id2",
                caption: "Untitled",
                type: OdmEntityType.Script,
            },
            currentVersion: 0,
        } as unknown as IOpenDocumentState;

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
                onEditorRename={onEditorRenameMock}
                onLoadScript={onLoadScriptMock}
            />,
        );
        tabRef.current!.findOpenEditor = vi.fn().mockReturnValue(openState);

        const script: IScriptRequest = {
            id: "id2",
            caption: "loaded-query.sql",
            fileName: "/tmp/loaded-query.sql",
            language: "python",
            content: `def test():
                          print("test function")

                      test()`,
        };
        const result = await requisitions.execute("editorLoadScript", script);

        expect(result).toBe(true);
        expect(openState.fileName).toBe("/tmp/loaded-query.sql");
        expect(onEditorRenameMock).toHaveBeenCalledWith("", script.id, script.caption);
        expect(onLoadScriptMock).toHaveBeenCalledWith("", script.id, script.content);

        unmount();
    });

    it("Test editorRenameScript requisition function call", async () => {
        const onEditorRenameMock = vi.fn();

        const { unmount } = render(
            <ConnectionWorkspace
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
                onEditorRename={onEditorRenameMock}
            />,
        );

        const script: IScriptRequest = {
            id: "id2",
            language: "python",
            content: `def test():
                          print("test function")

                      test()`,
            caption: "testScript",
        };

        const result = await requisitions.execute("editorRenameScript", script);

        expect(result).toBe(true);
        expect(onEditorRenameMock).toHaveBeenCalledWith("", script.id, script.caption);

        unmount();
    });

    it("Test acceptMrsAuthentication requisition function call", async () => {
        const { unmount } = render(
            <ConnectionWorkspace
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const request: IServicePasswordRequest = {
            requestId: "1",
            caption: "Enter Password",
            service: "UT",
            user: "root",
            payload: {},
        };

        let result = await requisitions.execute("acceptMrsAuthentication", { request, password: "test123" });

        expect(result).toBe(false);

        request.payload = {
            loginResult: 1,
            contextId: "1",
        };

        result = await requisitions.execute("acceptMrsAuthentication", { request, password: "test123" });

        expect(result).toBe(true);

        unmount();
    });

    it("Test cancelMrsAuthentication requisition function call", async () => {
        const { unmount } = render(
            <ConnectionWorkspace
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const request: IServicePasswordRequest = {
            requestId: "1",
            caption: "Enter Password",
            service: "UT",
            user: "root",
            payload: {},
        };

        let result = await requisitions.execute("cancelMrsAuthentication", request);

        expect(result).toBe(false);

        request.payload = {
            contextId: "1",
        };

        result = await requisitions.execute("cancelMrsAuthentication", request);

        expect(result).toBe(true);

        unmount();
    });

    it("Test refreshMrsServiceSdk requisition function call", async () => {
        const { unmount } = render(
            <ConnectionWorkspace
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const result = await requisitions.execute("refreshMrsServiceSdk", undefined);

        expect(result).toBe(false);

        unmount();
    });

    it("Test editorRunCode function call with active notebook", async () => {
        const tabRef = createRef<TestConnectionWorkspace>();

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextProcessTick();
        expect(tabRef.current).toBeDefined();

        const notebookRef = tabRef.current!.notebookRef.current;
        const executeQueriesMock = vi.fn();
        if (notebookRef) {
            notebookRef.executeQueries = executeQueriesMock;
        }

        let options: IEditorExtendedExecutionOptions = {
            language: "mysql",
            code: "SELECT 1",
        };
        let result = await requisitions.execute("editorRunCode", options);

        expect(result).toBe(true);
        expect(executeQueriesMock).toHaveBeenCalledWith({ params: options.params }, options.code, undefined);

        options = {
            language: "mysql",
            code: "SELECT 1",
        };
        result = await requisitions.execute("editorRunCode", options);

        expect(result).toBe(true);
        expect(executeQueriesMock).toHaveBeenCalledWith({ params: options.params }, options.code, undefined);

        unmount();
    });

    it("Test editorRunCode function call without active notebook", async () => {
        const tabRef = createRef<TestConnectionWorkspace>();

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextProcessTick();
        expect(tabRef.current).toBeDefined();
        tabRef.current!.notebookRef.current = null;

        const options: IEditorExtendedExecutionOptions = {
            language: "mysql",
            code: "SELECT 1",
        };
        const result = await requisitions.execute("editorRunCode", options);

        expect(result).toBe(false);

        unmount();
    });

    it("Test editorRunScript when scriptWaiting is false", async () => {
        const tabRef = createRef<TestConnectionWorkspace>();

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextProcessTick();
        expect(tabRef.current).toBeDefined();

        const script: IScriptRequest = {
            id: "id1",
            caption: "test",
            language: "javascript",
            content: `function editorRunScript() {
                          console.log("Hello, World!");
                      }

                      editorRunScript();`,
            forceSecondaryEngine: false,
        };

        const result = await requisitions.execute("editorRunScript", script);

        expect(result).toBe(false);
        expect(tabRef.current!.scriptWaiting).toBe(true);

        unmount();
    });

    it("Test editorRunScript when scriptWaiting is true and scriptRef is current", async () => {
        const tabRef = createRef<TestConnectionWorkspace>();

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextProcessTick();
        expect(tabRef.current).toBeDefined();

        tabRef.current!.scriptWaiting = true;
        tabRef.current!.scriptRef.current = {
            executeWithMaximizedResult: vi.fn().mockResolvedValue(true),
        } as unknown as ScriptEditor;

        const script: IScriptRequest = {
            id: "id1",
            caption: "test",
            language: "javascript",
            content: `function editorRunScript() {
                          console.log("Hello, World!");
                      }

                      editorRunScript();`,
            forceSecondaryEngine: false,
        };

        const result = await requisitions.execute("editorRunScript", script);

        expect(result).toBe(true);
        expect(tabRef.current!.scriptRef.current.executeWithMaximizedResult)
            .toHaveBeenCalledWith(script.content, script.forceSecondaryEngine);
        expect(tabRef.current!.scriptWaiting).toBe(false);

        unmount();
    });

    it("Test editorRunScript when scriptWaiting is true and scriptRef is not current", async () => {
        const tabRef = createRef<TestConnectionWorkspace>();

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextProcessTick();
        expect(tabRef.current).toBeDefined();

        tabRef.current!.scriptWaiting = true;
        tabRef.current!.scriptRef.current = null;

        const script: IScriptRequest = {
            id: "id1",
            caption: "test",
            language: "javascript",
            content: `function editorRunScript() {
                          console.log("Hello, World!");
                      }

                      editorRunScript();`,
            forceSecondaryEngine: false,
        };

        const result = await requisitions.execute("editorRunScript", script);

        expect(result).toBe(false);
        expect(tabRef.current!.scriptWaiting).toBe(true);

        unmount();
    });

    it("Test sqlShowDataAtPage requisition function call", async () => {
        const { unmount } = render(
            <ConnectionWorkspace
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const ctx = new SQLExecutionContext(
            new PresentationInterface("sql"),
            StoreType.Document,
            80024,
            "TRADITIONAL",
            "",
        );

        const data: ISqlPageRequest = {
            context: ctx,
            page: 1,
            sql: "SELECT 1;",
            oldResultId: "oldResultId",
        };

        const determineQueryTypeSpy = vi.spyOn(
            ScriptingLanguageServices.instance,
            "determineQueryType" as never,
        );

        const result = await requisitions.execute("sqlShowDataAtPage", data);

        expect(result).toBe(true);
        expect(determineQueryTypeSpy).toHaveBeenCalledTimes(1);

        determineQueryTypeSpy.mockRestore();
        unmount();
    }, 10000);

    it("Test editorSaveNotebook with openState", async () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;
        const executeRemoteSpy = vi.spyOn(requisitions, "executeRemote").mockReturnValue(true);
        const onEditorRenameMock = vi.fn();

        const tabRef = createRef<TestConnectionWorkspace>();

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
                onEditorRename={onEditorRenameMock}
            />,
        );

        await nextProcessTick();
        expect(tabRef.current).toBeDefined();

        const document = documentDataModel.openDocument(undefined, {
            type: OdmEntityType.Notebook,
            parameters: {
                pageId: "1",
                id: uuid(),
                connection: connection.details,
                caption: "test",
            },
        })!;

        const openState: IOpenDocumentState = {
            state: {
                model: {
                    executionContexts: {
                        collectRawState: vi.fn().mockResolvedValue([]),
                    } as unknown as ExecutionContexts,
                    getValue: vi.fn().mockReturnValue("notebook content"),
                } as unknown as ICodeEditorModel,
                viewState: null,
                options: {},
            },
            document,
            currentVersion: 0,
        };
        tabRef.current!.findOpenEditor = vi.fn().mockReturnValue(openState);

        const result = await requisitions.execute("editorSaveNotebook", undefined);
        expect(result).toBe(true);
        expect(openState.state?.model.getValue).toHaveBeenCalled();
        expect(openState.state?.model.executionContexts?.collectRawState).toHaveBeenCalled();
        const notebookSaveCall = executeRemoteSpy.mock.calls.find(([requestType]) => {
            return requestType === "editorSaveNotebook";
        });

        expect(notebookSaveCall?.[1]).toMatchObject({
            id: document.id,
            fileName: undefined,
            defaultFileName: "Untitled.mysql-notebook",
            saveAs: false,
        });
        expect(onEditorRenameMock).not.toHaveBeenCalled();

        const saveResult = await requisitions.execute("editorSaveNotebook", {
            id: document.id,
            fileName: "/tmp/saved.mysql-notebook",
        });
        expect(saveResult).toBe(true);
        expect(openState.fileName).toBe("/tmp/saved.mysql-notebook");
        expect(onEditorRenameMock).toHaveBeenCalledWith("", document.id, document.caption);

        appParameters.embedded = originalEmbedded;
        unmount();
    });

    it("Test editorSaveNotebook default file name matches the second notebook tab title", async () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;
        const executeRemoteSpy = vi.spyOn(requisitions, "executeRemote").mockReturnValue(true);

        const tabRef = createRef<TestConnectionWorkspace>();

        const firstDocument = documentDataModel.openDocument(undefined, {
            type: OdmEntityType.Notebook,
            parameters: {
                pageId: "1",
                id: uuid(),
                connection: connection.details,
                caption: "DB Notebook 1",
            },
        })!;
        const secondDocument = documentDataModel.openDocument(undefined, {
            type: OdmEntityType.Notebook,
            parameters: {
                pageId: "1",
                id: uuid(),
                connection: connection.details,
                caption: "DB Notebook 2",
            },
        })!;

        const firstOpenState: IOpenDocumentState = {
            state: {
                model: {
                    getVersionId: vi.fn().mockReturnValue(0),
                    executionContexts: {
                        cursorPosition: { lineNumber: 1, column: 1 },
                        contextFromPosition: vi.fn().mockReturnValue(undefined),
                        collectRawState: vi.fn().mockResolvedValue([]),
                    } as unknown as ExecutionContexts,
                    getValue: vi.fn().mockReturnValue("first notebook"),
                } as unknown as ICodeEditorModel,
                viewState: null,
                options: {},
            },
            document: firstDocument,
            currentVersion: 0,
        };
        const secondOpenState: IOpenDocumentState = {
            state: {
                model: {
                    getVersionId: vi.fn().mockReturnValue(0),
                    executionContexts: {
                        cursorPosition: { lineNumber: 1, column: 1 },
                        contextFromPosition: vi.fn().mockReturnValue(undefined),
                        collectRawState: vi.fn().mockResolvedValue([]),
                    } as unknown as ExecutionContexts,
                    getValue: vi.fn().mockReturnValue("second notebook"),
                } as unknown as ICodeEditorModel,
                viewState: null,
                options: {},
            },
            document: secondDocument,
            currentVersion: 0,
        };
        const localSavedState: IConnectionPresentationState = {
            ...savedState,
            documentStates: [firstOpenState, secondOpenState],
            activeEntry: secondDocument.id,
        };

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                caption="details1"
                connection={connection}
                savedState={localSavedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextProcessTick();
        expect(tabRef.current).toBeDefined();

        tabRef.current!.findOpenEditor = vi.fn().mockImplementation((id?: string) => {
            if (id === secondDocument.id || id === undefined) {
                return secondOpenState;
            }

            return firstOpenState;
        });

        const result = await requisitions.execute("editorSaveNotebook", { id: secondDocument.id });

        expect(result).toBe(true);
        const notebookSaveCall = executeRemoteSpy.mock.calls.find(([requestType]) => {
            return requestType === "editorSaveNotebook";
        });

        expect(notebookSaveCall?.[1]).toMatchObject({
            id: secondDocument.id,
            fileName: undefined,
            defaultFileName: "Untitled-1.mysql-notebook",
            saveAs: false,
        });

        appParameters.embedded = originalEmbedded;
        unmount();
    });

    it("Test editorLoadNotebook updates the notebook title", async () => {
        const onEditorRenameMock = vi.fn();
        const tabRef = createRef<TestConnectionWorkspace>();

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
                onEditorRename={onEditorRenameMock}
            />,
        );

        await nextProcessTick();
        expect(tabRef.current).toBeDefined();

        const document = documentDataModel.openDocument(undefined, {
            type: OdmEntityType.Notebook,
            parameters: {
                pageId: "1",
                id: uuid(),
                connection: connection.details,
                caption: "Notebook 1",
            },
        })!;

        const openState: IOpenDocumentState = {
            state: {
                model: {
                    executionContexts: {
                        collectRawState: vi.fn().mockResolvedValue([]),
                    } as unknown as ExecutionContexts,
                    getValue: vi.fn().mockReturnValue(""),
                    setValue: vi.fn(),
                } as unknown as ICodeEditorModel,
                viewState: null,
                options: {},
            },
            document,
            currentVersion: 0,
        };
        tabRef.current!.findOpenEditor = vi.fn().mockReturnValue(openState);

        const notebookFile = {
            type: "MySQLNotebook",
            version: currentNotebookVersion,
            caption: "Loaded Notebook",
            content: "select 1;",
            options: {},
            viewState: null,
            contexts: [],
        };

        const result = await requisitions.execute("editorLoadNotebook", {
            id: document.id,
            fileName: "/tmp/loaded.mysql-notebook",
            content: JSON.stringify(notebookFile),
            standalone: false,
        });

        expect(result).toBe(true);
        expect(openState.fileName).toBe("/tmp/loaded.mysql-notebook");
        expect(openState.document.caption).toBe("Loaded Notebook");
        expect(onEditorRenameMock).toHaveBeenCalledWith("", document.id, "Loaded Notebook");

        unmount();
    });

    it("Test selectFile preserves create-new notebook intent", async () => {
        const tabRef = createRef<TestConnectionWorkspace>();

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextProcessTick();
        expect(tabRef.current).toBeDefined();

        const editorLoadNotebook = vi.fn().mockResolvedValue(true);
        tabRef.current!.editorLoadNotebook = editorLoadNotebook;

        const notebookFile = JSON.stringify({
            type: "MySQLNotebook",
            version: currentNotebookVersion,
            caption: "Loaded Notebook",
            content: "select 1;",
            options: {},
            viewState: null,
            contexts: [],
        });

        const result = await tabRef.current!.selectFile({
            resourceId: "loadNewNotebook",
            file: [{
                path: "/tmp/loaded.mysql-notebook",
                content: new TextEncoder().encode(notebookFile).buffer,
            }],
        });

        expect(result).toBe(true);
        expect(editorLoadNotebook).toHaveBeenCalledWith({
            fileName: "/tmp/loaded.mysql-notebook",
            content: notebookFile,
            standalone: false,
            createNew: true,
        });

        unmount();
    });

    it("Test editorLoadNotebook with createNew loads into a new notebook", async () => {
        const tabRef = createRef<TestConnectionWorkspace>();

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextProcessTick();
        expect(tabRef.current).toBeDefined();

        const activeDocument = documentDataModel.openDocument(undefined, {
            type: OdmEntityType.Script,
            parameters: {
                pageId: "1",
                id: uuid(),
                connection: connection.details,
                caption: "Script 1",
                language: "mysql",
            },
        })!;
        const newNotebookDocument = documentDataModel.openDocument(undefined, {
            type: OdmEntityType.Notebook,
            parameters: {
                pageId: "1",
                id: "new-notebook",
                connection: connection.details,
                caption: "DB Notebook 2",
            },
        })!;

        const activeSetValue = vi.fn();
        const newSetValue = vi.fn();
        const activeOpenState: IOpenDocumentState = {
            state: {
                model: {
                    getVersionId: vi.fn().mockReturnValue(0),
                    setValue: activeSetValue,
                } as unknown as ICodeEditorModel,
                viewState: null,
                options: {},
            },
            document: activeDocument,
            currentVersion: 0,
        };
        const newOpenState: IOpenDocumentState = {
            state: {
                model: {
                    getVersionId: vi.fn().mockReturnValue(0),
                    setValue: newSetValue,
                } as unknown as ICodeEditorModel,
                viewState: null,
                options: {},
            },
            document: newNotebookDocument,
            currentVersion: 0,
        };

        let newEditorReady = false;
        const handleAddEditor = vi.fn().mockImplementation(async () => {
            setTimeout(() => {
                newEditorReady = true;
            }, 50);

            return "new-notebook";
        });
        tabRef.current!.handleAddEditor = handleAddEditor;
        tabRef.current!.findOpenEditor = vi.fn((editorId?: string) => {
            if (editorId === "new-notebook") {
                return newEditorReady ? newOpenState : undefined;
            }

            return activeOpenState;
        });

        const notebookFile = JSON.stringify({
            type: "MySQLNotebook",
            version: currentNotebookVersion,
            caption: "Loaded Notebook",
            content: "select 1;",
            options: {},
            viewState: null,
            contexts: [],
        });

        const result = await requisitions.execute("editorLoadNotebook", {
            fileName: "loaded.mysql-notebook",
            content: notebookFile,
            standalone: false,
            createNew: true,
        });

        expect(result).toBe(true);
        expect(handleAddEditor).toHaveBeenCalled();
        expect(activeSetValue).not.toHaveBeenCalled();
        expect(newSetValue).toHaveBeenCalledWith("select 1;");
        expect(newOpenState.fileName).toBe("loaded.mysql-notebook");
        expect(newOpenState.document.caption).toBe("Loaded Notebook");

        unmount();
    });

    it("Test editorLoadNotebook with createNew keeps the selected browser file path", async () => {
        const originalEmbedded = appParameters.embedded;
        const originalInExtension = appParameters.inExtension;
        appParameters.embedded = false;
        appParameters.inExtension = false;

        const tabRef = createRef<TestConnectionWorkspace>();

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextProcessTick();
        expect(tabRef.current).toBeDefined();

        const newNotebookDocument = documentDataModel.openDocument(undefined, {
            type: OdmEntityType.Notebook,
            parameters: {
                pageId: "1",
                id: "new-notebook-from-browser",
                connection: connection.details,
                caption: "DB Notebook 3",
            },
        })!;

        const newSetValue = vi.fn();
        const newOpenState: IOpenDocumentState = {
            state: {
                model: {
                    getVersionId: vi.fn().mockReturnValue(0),
                    setValue: newSetValue,
                } as unknown as ICodeEditorModel,
                viewState: null,
                options: {},
            },
            document: newNotebookDocument,
            currentVersion: 0,
        };

        let newEditorReady = false;
        tabRef.current!.handleAddEditor = vi.fn().mockImplementation(async () => {
            setTimeout(() => {
                newEditorReady = true;
            }, 50);

            return "new-notebook-from-browser";
        });
        tabRef.current!.findOpenEditor = vi.fn((editorId?: string) => {
            if (editorId === "new-notebook-from-browser") {
                return newEditorReady ? newOpenState : undefined;
            }

            return undefined;
        });

        const notebookFile = JSON.stringify({
            type: "MySQLNotebook",
            version: currentNotebookVersion,
            caption: "Loaded Notebook",
            content: "select 1;",
            options: {},
            viewState: null,
            contexts: [],
        });

        const browserFile = {
            name: "loaded.mysql-notebook",
            path: "/tmp/loaded.mysql-notebook",
        } as File & { path: string; };

        const selectFileSpy = vi.spyOn(helpers, "selectFileInBrowser").mockResolvedValue([browserFile]);
        const loadFileAsTextSpy = vi.spyOn(helpers, "loadFileAsText").mockResolvedValue(notebookFile);

        const result = await requisitions.execute("editorLoadNotebook", {
            createNew: true,
        });

        expect(result).toBe(true);
        expect(selectFileSpy).toHaveBeenCalledWith([".mysql-notebook"], false);
        expect(loadFileAsTextSpy).toHaveBeenCalledWith(browserFile);
        expect(newSetValue).toHaveBeenCalledWith("select 1;");
        expect(newOpenState.fileName).toBe("/tmp/loaded.mysql-notebook");
        expect(newOpenState.document.caption).toBe("Loaded Notebook");

        appParameters.embedded = originalEmbedded;
        appParameters.inExtension = originalInExtension;
        unmount();
    });

    it("Test confirmClose allows closing a clean script tab without a confirm dialog", async () => {
        const tabRef = createRef<TestConnectionWorkspace>();
        const confirmMock = uiLayerMock.confirm as Mock;

        confirmMock.mockClear();

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextProcessTick();
        expect(tabRef.current).toBeDefined();

        tabRef.current!.notebookRef.current = null;
        tabRef.current!.findActiveEditor = vi.fn().mockReturnValue({
            document: {
                id: "script-1",
                caption: "Untitled",
                type: OdmEntityType.Script,
            },
            currentVersion: 3,
            state: {
                model: {
                    getVersionId: vi.fn().mockReturnValue(3),
                },
            },
        } as Partial<IOpenDocumentState>);

        const result = await tabRef.current!.confirmClose();

        expect(result).toBe(true);
        expect(confirmMock).not.toHaveBeenCalled();

        unmount();
    });

    it("Test confirmClose asks before closing a dirty script tab", async () => {
        const tabRef = createRef<TestConnectionWorkspace>();
        const confirmMock = uiLayerMock.confirm as Mock;

        confirmMock.mockClear();
        confirmMock.mockResolvedValueOnce("Cancel");

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextProcessTick();
        expect(tabRef.current).toBeDefined();

        tabRef.current!.notebookRef.current = null;
        tabRef.current!.findActiveEditor = vi.fn().mockReturnValue({
            document: {
                id: "script-1",
                caption: "Untitled",
                type: OdmEntityType.Script,
            },
            currentVersion: 2,
            state: {
                model: {
                    getVersionId: vi.fn().mockReturnValue(5),
                },
            },
        } as Partial<IOpenDocumentState>);

        const result = await tabRef.current!.confirmClose();

        expect(result).toBe(false);
        expect(confirmMock).toHaveBeenCalledWith(
            "This tab has unsaved changes. Do you want to discard them and close the tab?",
            "Discard",
            "Cancel",
        );

        unmount();
    });

    it("Test confirmClose asks before closing a dirty notebook tab", async () => {
        const tabRef = createRef<TestConnectionWorkspace>();
        const confirmMock = uiLayerMock.confirm as Mock;

        confirmMock.mockClear();
        confirmMock.mockResolvedValueOnce("Discard");

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextProcessTick();
        expect(tabRef.current).toBeDefined();

        tabRef.current!.notebookRef.current = {
            canClose: vi.fn().mockResolvedValue(true),
        } as unknown as Notebook;
        tabRef.current!.findActiveEditor = vi.fn().mockReturnValue({
            document: {
                id: "notebook-1",
                caption: "Notebook 1",
                type: OdmEntityType.Notebook,
            },
            currentVersion: 1,
            state: {
                model: {
                    getVersionId: vi.fn().mockReturnValue(2),
                },
            },
        } as Partial<IOpenDocumentState>);

        const result = await tabRef.current!.confirmClose();

        expect(result).toBe(true);
        expect(tabRef.current!.notebookRef.current.canClose).toHaveBeenCalled();
        expect(confirmMock).toHaveBeenCalledWith(
            "This tab has unsaved changes. Do you want to discard them and close the tab?",
            "Discard",
            "Cancel",
        );

        unmount();
    });

    it("Test confirmClose stops when the notebook refuses to close", async () => {
        const tabRef = createRef<TestConnectionWorkspace>();
        const confirmMock = uiLayerMock.confirm as Mock;

        confirmMock.mockClear();

        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextProcessTick();
        expect(tabRef.current).toBeDefined();

        tabRef.current!.notebookRef.current = {
            canClose: vi.fn().mockResolvedValue(false),
        } as unknown as Notebook;
        tabRef.current!.findActiveEditor = vi.fn().mockReturnValue({
            document: {
                id: "notebook-1",
                caption: "Notebook 1",
                type: OdmEntityType.Notebook,
            },
            currentVersion: 1,
            state: {
                model: {
                    getVersionId: vi.fn().mockReturnValue(2),
                },
            },
        } as Partial<IOpenDocumentState>);

        const result = await tabRef.current!.confirmClose();

        expect(result).toBe(false);
        expect(tabRef.current!.notebookRef.current.canClose).toHaveBeenCalled();
        expect(confirmMock).not.toHaveBeenCalled();

        unmount();
    });

    it("Test confirmCloseAll asks before closing an inactive dirty script tab", async () => {
        const confirmMock = uiLayerMock.confirm as Mock;

        confirmMock.mockClear();
        confirmMock.mockResolvedValueOnce("Cancel");

        const activeState = {
            document: {
                id: "script-1",
                caption: "Script 1",
                type: OdmEntityType.Script,
            },
            currentVersion: 1,
            state: {
                model: {
                    getVersionId: vi.fn().mockReturnValue(1),
                },
            },
        } as Partial<IOpenDocumentState> as IOpenDocumentState;
        const inactiveDirtyState = {
            document: {
                id: "script-2",
                caption: "Script 2",
                type: OdmEntityType.Script,
            },
            currentVersion: 1,
            state: {
                model: {
                    getVersionId: vi.fn().mockReturnValue(2),
                },
            },
        } as Partial<IOpenDocumentState> as IOpenDocumentState;
        const tab = new TestConnectionWorkspace({
            connection,
            savedState: {
                ...savedState,
                activeEntry: "script-1",
                documentStates: [activeState, inactiveDirtyState],
            },
            workerPool: wp,
            showAbout: false,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        });

        const result = await tab.confirmCloseAll();

        expect(result).toBe(false);
        expect(confirmMock).toHaveBeenCalledWith(
            "This tab has unsaved changes. Do you want to discard them and close the tab?",
            "Discard",
            "Cancel",
        );
    });

    it("Test showLakehouseNavigator requisition function call", async () => {
        const onSelectItemMock = vi.fn();

        const { unmount } = render(
            <DocumentContext.Provider
                value={{
                    connectionsDataModel,
                    documentDataModel,
                } as DocumentContextType}>

                <ConnectionWorkspace
                    id="1"
                    connection={connection}
                    savedState={savedState}
                    workerPool={wp}
                    showAbout={false}
                    toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
                    onSelectItem={onSelectItemMock}
                />
            </DocumentContext.Provider>,
        );

        const result = await requisitions.execute("showLakehouseNavigator", undefined);

        expect(result).toBe(true);
        expect(onSelectItemMock).toHaveBeenCalledWith(expect.objectContaining({
            pageId: "1",
            document: expect.objectContaining({
                type: OdmEntityType.AdminPage,
                caption: "Lakehouse Navigator",
                pageType: "lakehouseNavigator",
            }) as Partial<{ type: OdmEntityType; caption: string; pageType: string; }>,
        }));

        unmount();
    });

    it("Test showChatOptions requisition function call", async () => {
        const onChatOptionsChangeMock = vi.fn();
        const { unmount } = render(
            <ConnectionWorkspace
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
                onChatOptionsChange={onChatOptionsChangeMock}
                id="1"
            />,
        );

        const result = await requisitions.execute("showChatOptions", undefined);

        expect(result).toBe(true);
        expect(onChatOptionsChangeMock).toHaveBeenCalledWith("1", { chatOptionsExpanded: true });

        unmount();
    });

    it("Test selectFile requisition function call", async () => {
        const { unmount } = render(
            <ConnectionWorkspace
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const fileResultSaveValid = {
            resourceId: "saveChatOptions",
            file: [{ path: "/valid/path/to/save", content: new ArrayBuffer(16) }],
        };

        const fileResultSaveInvalid = {
            resourceId: "saveChatOptions",
            file: [],
        };

        const fileResultLoadValid = {
            resourceId: "loadChatOptions",
            file: [{ path: "/valid/path/to/load", content: new ArrayBuffer(16) }],
        };

        const fileResultLoadInvalid = {
            resourceId: "loadChatOptions",
            file: [],
        };

        const fileResultUnknown = {
            resourceId: "unknownResourceId",
            file: [{ path: "some/path", content: new ArrayBuffer(16) }],
        };
        const options: IMdsChatData = { schemaName: "testSchema" };

        const saveMdsChatOptionsMock = vi.spyOn(connection.backend.mhs,
            "saveMdsChatOptions").mockResolvedValue(undefined);
        const loadMdsChatOptionsMock = vi.spyOn(connection.backend.mhs,
            "loadMdsChatOptions").mockResolvedValue(options);

        let result = await requisitions.execute("selectFile", fileResultSaveValid);
        expect(result).toBe(true);
        expect(saveMdsChatOptionsMock).toHaveBeenCalledWith("/valid/path/to/save", {});
        expect(uiLayerMock.showInformationMessage).toHaveBeenCalled();
        (uiLayerMock.showInformationMessage as Mock).mockClear();

        saveMdsChatOptionsMock.mockReset();

        result = await requisitions.execute("selectFile", fileResultSaveInvalid);
        expect(result).toBe(true);
        expect(saveMdsChatOptionsMock).toHaveBeenCalledTimes(0);

        result = await requisitions.execute("selectFile", fileResultLoadValid);
        expect(result).toBe(true);
        expect(loadMdsChatOptionsMock).toHaveBeenCalledWith("/valid/path/to/load");

        loadMdsChatOptionsMock.mockReset();

        result = await requisitions.execute("selectFile", fileResultLoadInvalid);
        expect(result).toBe(true);
        expect(saveMdsChatOptionsMock).toHaveBeenCalledTimes(0);

        loadMdsChatOptionsMock.mockReset();

        result = await requisitions.execute("selectFile", fileResultUnknown);
        expect(result).toBe(false);
        expect(saveMdsChatOptionsMock).toHaveBeenCalledTimes(0);
        expect(uiLayerMock.showInformationMessage).not.toHaveBeenCalled();

        saveMdsChatOptionsMock.mockRestore();
        loadMdsChatOptionsMock.mockRestore();
        unmount();
    });

    it("Test explainError function", async () => {
        const tabRef = createRef<TestConnectionWorkspace>();
        const { unmount } = render(
            <ConnectionWorkspace
                ref={tabRef}
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextRunLoop();
        expect(tabRef.current).toBeDefined();

        const lowercaseSpDef = {
            includes: vi.fn(),
        } as unknown as string;

        const spDef = {
            toLowerCase: vi.fn().mockReturnValue(lowercaseSpDef),
        } as unknown as string;

        const getRuntimeErrorDataMock = vi.fn();
        getRuntimeErrorDataMock.mockReturnValue(
            {
                queryStatement: "a query",
                createStatement: spDef,
                stacktraceInfo: {
                    message: "a message",
                    range: {
                        startLineNumber: 0,
                        startColumn: 0,
                        endLineNumber: 1,
                        endColumn: 1,
                    },
                },
            } as IRuntimeErrorData,
        );

        const executionContext = {
            id: "test-context-1",
            code: "",
            language: "sql",
            clearResult: vi.fn(),
            addResultData: vi.fn(),
            getRuntimeErrorData: getRuntimeErrorDataMock,
            executionStarts: vi.fn(),
            executionEnded: vi.fn(),
        } as unknown as SQLExecutionContext;

        const result = await tabRef.current!.explainError(executionContext);

        expect(result).toBe(true);
        expect(executionContext.addResultData).not.toHaveBeenCalled();
        expect(executionContext.getRuntimeErrorData).toHaveBeenCalled();
        expect(executionContext.executionStarts).toHaveBeenCalled();
        expect(spDef.toLowerCase).toHaveBeenCalled();
        expect(lowercaseSpDef.includes).toHaveBeenCalled();
        expect(executionContext.executionEnded).toHaveBeenCalled();

        unmount();
    });

});
