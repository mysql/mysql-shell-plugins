/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

/* eslint-disable dot-notation */
/* eslint-disable @typescript-eslint/unbound-method */

import { mount, shallow } from "enzyme";
import { StoreType } from "../../../../app-logic/ApplicationDB.js";
import { registerUiLayer } from "../../../../app-logic/UILayer.js";
import type { IServicePasswordRequest } from "../../../../app-logic/general-types.js";
import type { IMdsChatData } from "../../../../communication/ProtocolMds.js";
import { ICodeEditorModel, IEditorPersistentState } from "../../../../components/ui/CodeEditor/CodeEditor.js";
import { CodeEditorMode, Monaco } from "../../../../components/ui/CodeEditor/index.js";
import { ConnectionDataModel } from "../../../../data-models/ConnectionDataModel.js";
import { OdmEntityType, OpenDocumentDataModel } from "../../../../data-models/OpenDocumentDataModel.js";
import {
    DBConnectionTab, IOpenDocumentState, type IConnectionPresentationState,
} from "../../../../modules/db-editor/DBConnectionTab.js";
import { LakehouseNavigatorTab } from "../../../../modules/db-editor/LakehouseNavigator.js";
import type { ScriptEditor } from "../../../../modules/db-editor/ScriptEditor.js";
import { ExecutionWorkerPool } from "../../../../modules/db-editor/execution/ExecutionWorkerPool.js";
import { DBEditorContext, type DBEditorContextType } from "../../../../modules/db-editor/index.js";
import { ExecutionContexts } from "../../../../script-execution/ExecutionContexts.js";
import { PresentationInterface } from "../../../../script-execution/PresentationInterface.js";
import { SQLExecutionContext } from "../../../../script-execution/SQLExecutionContext.js";
import { ScriptingLanguageServices } from "../../../../script-execution/ScriptingLanguageServices.js";
import type { IEditorExtendedExecutionOptions } from "../../../../supplement/RequisitionTypes.js";
import { appParameters, requisitions } from "../../../../supplement/Requisitions.js";
import { DBType } from "../../../../supplement/ShellInterface/index.js";
import type { IScriptRequest, ISqlPageRequest } from "../../../../supplement/index.js";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher.js";
import { uuid } from "../../../../utilities/helpers.js";
import { notebookDocumentMock } from "../../__mocks__/DBEditorModuleMocks.js";
import { uiLayerMock } from "../../__mocks__/UILayerMock.js";
import { nextProcessTick, setupShellForTests } from "../../test-helpers.js";

jest.mock("../../../../components/ui/CodeEditor/CodeEditor");
jest.mock("../../../../script-execution/ScriptingLanguageServices.js", (): unknown => {
    return {
        __esModule: true, // this is important
        ...jest.requireActual("../../../../script-execution/ScriptingLanguageServices.js"),
    };
});

describe("DBConnectionTab tests", (): void => {
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
    const connectionsDataModel = new ConnectionDataModel(); // No need to initialize the data model.
    const documentDataModel = new OpenDocumentDataModel();

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
        dbType: DBType.MySQL,
        caption: "details1",
        description: "description1",
        options: {},
    });

    beforeAll(async () => {
        registerUiLayer(uiLayerMock);
        launcher = await setupShellForTests(false, true);
    });

    afterAll(async () => {
        await launcher.exitProcess();
    });

    it("Test DBConnectionTab snapshot", () => {
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
                }
                else if (typeof val === "string" && val === "name") {
                    nextName = true;
                }
                else if (typeof val === "string" && val === "timestamp") {
                    nextName = true;
                }

                return false;
            },
            print: (val, serialize) => {

                return serialize("MOCK_VALUE");
            },
        });

        const component = shallow<DBConnectionTab>(
            <DBConnectionTab
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Test DBConnectionTab instantiation", () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const props = component.props();
        expect(props.connection!.details.id).toEqual(123);
        expect(props.connection!.details.dbType).toEqual(DBType.MySQL);
        expect(props.savedState).toEqual(savedState);
        expect(props.workerPool).toEqual(wp);

        component.unmount();
    });

    it("Test editorStopExecution requisition function call", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const promise = connection.backend.execute("SELECT 1", undefined, undefined, () => {
            expect(false).toBe(true);
        });
        const result = await requisitions.execute("editorStopExecution", undefined);
        await promise;

        expect(result).toBe(true);

        component.unmount();
    });

    it("Test editorCommit requisition function call", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
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

        component.unmount();
    });

    it("Test editorRollback requisition function call", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
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

        component.unmount();
    });

    it("Test editorLoadScript requisition function call", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const onLoadScriptMock = jest.fn();

        component.setProps({ onLoadScript: onLoadScriptMock });

        const script: IScriptRequest = {
            id: "id2",
            caption: "",
            language: "python",
            content: `def test():
                          print("test function")

                      test()`,
        };
        const result = await requisitions.execute("editorLoadScript", script);

        expect(result).toBe(true);
        expect(onLoadScriptMock).toHaveBeenCalledWith("", script.id, script.content);

        component.unmount();
    });

    it("Test editorRenameScript requisition function call", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const onEditorRenameMock = jest.fn();

        component.setProps({ onEditorRename: onEditorRenameMock });

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

        component.unmount();
    });

    it("Test acceptMrsAuthentication requisition function call", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
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

        component.unmount();
    });

    it("Test cancelMrsAuthentication requisition function call", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
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

        component.unmount();
    });

    it("Test refreshMrsServiceSdk requisition function call", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const result = await requisitions.execute("refreshMrsServiceSdk", undefined);

        expect(result).toBe(false);

        component.unmount();
    });


    it("Test editorRunCode function call with active notebook", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const instance = component.instance();
        const notebookRef = instance["notebookRef"].current;
        const executeQueriesMock = jest.fn();
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

        component.unmount();
    });

    it("Test editorRunCode function call without active notebook", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const instance = component.instance();
        instance["notebookRef"].current = null;

        const options: IEditorExtendedExecutionOptions = {
            language: "mysql",
            code: "SELECT 1",
        };
        const result = await requisitions.execute("editorRunCode", options);

        expect(result).toBe(false);

        component.unmount();
    });


    it("Test editorRunScript when scriptWaiting is false", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const instance: DBConnectionTab = component.instance();

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
        expect(instance["scriptWaiting"]).toBe(true);

        component.unmount();
    });

    it("Test editorRunScript when scriptWaiting is true and scriptRef is current", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const instance = component.instance();
        instance["scriptWaiting"] = true;
        instance["scriptRef"].current = {
            executeWithMaximizedResult: jest.fn().mockResolvedValue(true),
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
        expect(instance["scriptRef"].current.executeWithMaximizedResult)
            .toHaveBeenCalledWith(script.content, script.forceSecondaryEngine);
        expect(instance["scriptWaiting"]).toBe(false);

        component.unmount();
    });

    it("Test editorRunScript when scriptWaiting is true and scriptRef is not current", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const instance = component.instance();
        instance["scriptWaiting"] = true;
        instance["scriptRef"].current = null;

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
        expect(instance["scriptWaiting"]).toBe(true);

        component.unmount();
    });

    it("Test sqlShowDataAtPage requisition function call", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const ctx = new SQLExecutionContext(
            new PresentationInterface("sql"),
            StoreType.DbEditor,
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

        const determineQueryTypeSpy = jest.spyOn(
            ScriptingLanguageServices.instance,
            "determineQueryType" as never,
        ).mockImplementation();

        const result = await requisitions.execute("sqlShowDataAtPage", data);

        expect(result).toBe(true);
        expect(determineQueryTypeSpy).toHaveBeenCalledTimes(1);

        determineQueryTypeSpy.mockRestore();
        component.unmount();
    });

    it("Test editorSaveNotebook with openState", async () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const instance = component.instance();
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
                        collectRawState: jest.fn().mockResolvedValue([]),
                    } as unknown as ExecutionContexts,
                    getValue: jest.fn().mockReturnValue("notebook content"),
                } as unknown as ICodeEditorModel,
                viewState: null,
                options: {},
            },
            document,
            currentVersion: 0,
        };
        instance["findActiveEditor"] = jest.fn().mockReturnValue(openState);

        const result = await requisitions.execute("editorSaveNotebook", undefined);
        expect(result).toBe(true);
        expect(openState.state?.model.getValue).toHaveBeenCalled();
        expect(openState.state?.model.executionContexts?.collectRawState).toHaveBeenCalled();

        appParameters.embedded = originalEmbedded;
        component.unmount();
    });

    it("Test showLakehouseNavigator requisition function call", async () => {
        const onSelectItemMock = jest.fn();

        const component = mount<DBConnectionTab>(
            <DBEditorContext.Provider
                value={{
                    connectionsDataModel,
                    documentDataModel,
                } as DBEditorContextType}>

                <DBConnectionTab
                    id="1"
                    connection={connection}
                    savedState={savedState}
                    workerPool={wp}
                    showAbout={false}
                    toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
                    onSelectItem={onSelectItemMock}
                />
            </DBEditorContext.Provider>,
        );

        const result = await requisitions.execute("showLakehouseNavigator", undefined);

        expect(result).toBe(true);
        expect(onSelectItemMock).toHaveBeenCalledWith(expect.objectContaining({
            tabId: "1",
            document: expect.objectContaining({
                type: OdmEntityType.AdminPage,
                caption: "Lakehouse Navigator",
                pageType: "lakehouseNavigator",
            }),
        }));

        component.unmount();
    });

    it("Test showChatOptions requisition function call", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const onChatOptionsChangeMock = jest.fn();

        component.setProps({ onChatOptionsChange: onChatOptionsChangeMock, id: "1" });

        const result = await requisitions.execute("showChatOptions", undefined);

        expect(result).toBe(true);
        expect(onChatOptionsChangeMock).toHaveBeenCalledWith("1", { chatOptionsExpanded: true });

        component.unmount();
    });

    it("Test selectFile requisition function call", async () => {
        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connection={connection}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const fileResultSaveValid = {
            resourceId: "saveChatOptions",
            path: ["/valid/path/to/save"],
        };

        const fileResultSaveInvalid = {
            resourceId: "saveChatOptions",
            path: [],
        };

        const fileResultLoadValid = {
            resourceId: "loadChatOptions",
            path: ["/valid/path/to/load"],
        };

        const fileResultLoadInvalid = {
            resourceId: "loadChatOptions",
            path: [],
        };

        const fileResultUnknown = {
            resourceId: "unknownResourceId",
            path: ["some/path"],
        };
        const options: IMdsChatData = { schemaName: "testSchema" };

        const saveMdsChatOptionsMock = jest.spyOn(connection.backend.mhs,
            "saveMdsChatOptions").mockResolvedValue(undefined);
        const loadMdsChatOptionsMock = jest.spyOn(connection.backend.mhs,
            "loadMdsChatOptions").mockResolvedValue(options);

        let result = await requisitions.execute("selectFile", fileResultSaveValid);
        expect(result).toBe(true);
        expect(saveMdsChatOptionsMock).toHaveBeenCalledWith("/valid/path/to/save", {});
        expect(uiLayerMock.showInformationMessage).toHaveBeenCalled();
        (uiLayerMock.showInformationMessage as jest.Mock).mockClear();

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
        expect(result).toBe(true);
        expect(saveMdsChatOptionsMock).toHaveBeenCalledTimes(0);
        expect(uiLayerMock.showInformationMessage).not.toHaveBeenCalled();

        saveMdsChatOptionsMock.mockRestore();
        loadMdsChatOptionsMock.mockRestore();
        component.unmount();
    });

});
