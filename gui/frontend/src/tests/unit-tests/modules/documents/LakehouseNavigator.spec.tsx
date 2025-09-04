/*
 * Copyright (c) 2024, 2025 Oracle and/or its affiliates.
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
 * separately licensed software that they have included with
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

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { act, render } from "@testing-library/preact";
import { createRef, type ComponentChild } from "preact";

import { CellComponent, RowComponent, type EmptyCallback } from "tabulator-tables";
import { DialogHost } from "../../../../app-logic/DialogHost.js";
import {
    DialogResponseClosure, DialogType, type IDialogRequest, type IDialogResponse,
} from "../../../../app-logic/general-types.js";
import type { DataCallback } from "../../../../communication/MessageScheduler.js";
import type { IDbEditorResultSetData, ShellAPIGui } from "../../../../communication/ProtocolGui.js";
import { CheckState } from "../../../../components/ui/Checkbox/Checkbox.js";
import type { ISplitterPaneSizeInfo } from "../../../../components/ui/SplitContainer/SplitContainer.js";
import {
    ILakehouseNavigatorProperties, ILakehouseNavigatorSavedState, ILakehouseNavigatorState, ILakehouseTable,
    ILakehouseTask, ILakehouseTaskItem, IObjectStorageTreeItem, LakehouseNavigator, LakehouseNavigatorTab,
    ObjectStorageTreeItemType,
} from "../../../../modules/db-editor/LakehouseNavigator.js";
import { appParameters } from "../../../../supplement/AppParameters.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import type {
    IOpenFileDialogResult, IRequestTypeMap, IRequisitionCallbackValues
} from "../../../../supplement/RequisitionTypes.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { nextProcessTick, nextRunLoop } from "../../test-helpers.js";

// @ts-expect-error, we need access to a private members here.
class TestLakehouseNavigator extends LakehouseNavigator {
    declare public updateValues: () => Promise<void>;

    declare public updateObjStorageTreeGrid: () => void;
    declare public updateLakehouseTablesTreeGrid: () => void;
    declare public updateLakehouseTasksTreeGrid: () => void;
    declare public refreshObjTreeItems: () => Promise<void>;
    declare public getUploadTabContent: () => ComponentChild;
    declare public getObjectStoreBrowserContent: () => ComponentChild;
    declare public getLoadTabContent: () => ComponentChild;
    declare public getTablesAndTasksTabContent: () => ComponentChild;
    declare public refreshAvailableDatabaseSchemas: () => void;
    declare public handleSelectTab: (id: string) => void;
    declare public onStartUploadClick: () => void;
    declare public onStartLoadClick: () => void;
    declare public onManageClick: () => void;
    declare public handleProfileSelection: (_accept: boolean, ids: Set<string>) => void;
    declare public handleSchemaSelection: (_accept: boolean, ids: Set<string>) => void;
    declare public handleFormatSelection: (_accept: boolean, ids: Set<string>) => void;
    declare public handleLanguageSelection: (_accept: boolean, ids: Set<string>) => void;
    declare public objectStoreTreeGridCaptionColumnFormatter: (cell: CellComponent) => string | HTMLElement;
    declare public objectStoreTreeGridColumnFormatter: (cell: CellComponent, formatterParams: {},
        onRendered: EmptyCallback) => string | HTMLElement;
    declare public schemasTreeGridColumnFormatter: (cell: CellComponent, formatterParams: {},
        onRendered: EmptyCallback) => string | HTMLElement;
    declare public tablesTreeGridRowFormatter: (row: RowComponent) => void;
    declare public tablesTreeGridColumnFormatter: (cell: CellComponent, formatterParams: {},
        onRendered: EmptyCallback) => string | HTMLElement;
    declare public taskTreeGridRowFormatter: (row: RowComponent) => void;
    declare public taskTreeGridColumnFormatter: (cell: CellComponent) => string | HTMLElement;
    declare public objTreeHandleRowExpanded: (row: RowComponent) => void;
    declare public objTreeHandleRowCollapsed: (row: RowComponent) => void;
    declare public objTreeIsRowExpanded: (row: RowComponent) => boolean;
    declare public objTreeToggleSelectedState: (_e: Event, cell: CellComponent) => void;
    declare public generateVectorTableName: (items: ILakehouseTaskItem[]) => string;
    declare public checkMysqlPrivileges: () => Promise<boolean>;
    declare public setActiveDatabaseSchema: (schemaName: string) => void;
    declare public getDefaultTaskDescription: (task?: ILakehouseTask) => string;
    declare public toggleAutoRefresh: (_e: InputEvent, _checkState: CheckState) => void;
    declare public refreshObjTreeItem: (targetId: string) => Promise<void>;
    declare public handleAddFilesForUpload: (_e: MouseEvent | KeyboardEvent) => void;
    declare public selectFile: (openFileResult: IOpenFileDialogResult) => Promise<boolean>;
    declare public handlePaneResize: (info: ISplitterPaneSizeInfo[]) => void;
    declare public showConfirmDlg: (title: string, prompt: string) => Promise<boolean>;

    declare public getObjectStorageTreeChildren: (
        parent: IObjectStorageTreeItem) => Promise<IObjectStorageTreeItem[]>;
    declare public autoRefreshTrees: () => Promise<void>;
}

describe("LakehouseNavigator tests", () => {
    const backend = new ShellInterfaceSqlEditor();

    const savedState: ILakehouseNavigatorSavedState = {
        activeTabId: LakehouseNavigatorTab.Overview,
        objTreeItems: [],
        lakehouseTables: [],
        lakehouseTablesHash: "hash1",
        lakehouseTasks: [],
        lakehouseTasksHash: "hash2",
        heatWaveVersionSupported: true,
    };

    const props: ILakehouseNavigatorProperties = {
        savedState,
        backend,
        toolbarItems: {
            navigation: [],
            execution: [],
            editor: [],
            auxiliary: [],
        },
        onLakehouseNavigatorStateChange: vi.fn(),
    };

    it("Test LakehouseNavigator instantiation", () => {
        const { container, unmount } = render(
            <LakehouseNavigator
                {...props}
            />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Test getDerivedStateFromProps function when state is undefined", () => {
        const props = {
            savedState: {
                activeTabId: LakehouseNavigatorTab.Overview,
                profiles: [{ profile: "testProfile" }],
                objTreeItems: [],
                lakehouseTables: [],
                lakehouseTablesHash: "hash1",
                lakehouseTasks: [],
                lakehouseTasksHash: "hash2",
            },
        };
        const state = {
            activeTabId: LakehouseNavigatorTab.Overview,
            profiles: undefined,
            heatWaveVersionSupported: true,
        };

        const result = LakehouseNavigator.getDerivedStateFromProps(
            props as unknown as ILakehouseNavigatorProperties,
            state,
        );
        expect(result).toEqual(props.savedState);
    });

    it("Test getDerivedStateFromProps function when state is defined", () => {
        const props = {
            savedState: {
                profiles: [{ profile: "testProfile" }],
                objTreeItems: [],
                lakehouseTables: [],
                lakehouseTablesHash: "hash1",
                lakehouseTasks: [],
                lakehouseTasksHash: "hash2",
            },
        };
        const state = {
            profiles: [{ profile: "existingProfile" }],
        };

        const result = LakehouseNavigator.getDerivedStateFromProps(
            props as unknown as ILakehouseNavigatorProperties,
            state as ILakehouseNavigatorSavedState,
        );
        expect(result).toEqual({});
    });

    it("Test getUploadTabContent with files for upload", async () => {
        const state: ILakehouseNavigatorState = {
            activeTabId: LakehouseNavigatorTab.Upload,
            filesForUpload: [
                { filePath: "file1.txt", fileSize: 1000, bytesUploadedTotal: 500, uploadComplete: false },
                { filePath: "file2.txt", fileSize: 2000, bytesUploadedTotal: 2000, uploadComplete: true },
            ],
            uploadTarget: {
                id: "",
                data: {
                    type: ObjectStorageTreeItemType.Bucket,
                    name: "bucket1",
                    namespace: "",
                    compartmentId: "",
                    createdBy: "",
                    timeCreated: new Date(),
                    etag: "",

                },
            },
            uploadRunning: false,
            uploadComplete: false,
            filesForUploadPanelWidth: 400,
            fileUploadTargetPath: "path/to/upload",
        };

        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { container, unmount } = render(
            <TestLakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        navigatorRef.current!.setState(state as unknown as ILakehouseNavigatorState);

        const content = navigatorRef.current!.getUploadTabContent();
        expect(content).toMatchSnapshot();

        let cmp = container.querySelector(".filesForUploadPanel");
        expect(cmp).toBeDefined();

        cmp = container.querySelector(".uploadTarget");
        expect(cmp).toBeDefined();

        unmount();
    });

    it("Test getUploadTabContent with no files for upload", async () => {
        const state = {
            filesForUpload: [],
            lastFileUploadError: null,
            uploadTarget: { data: { type: "Bucket", name: "bucket1" } },
            uploadRunning: false,
            uploadComplete: false,
            filesForUploadPanelWidth: 400,
            fileUploadTargetPath: "path/to/upload",
        };

        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { container, unmount } = render(
            <TestLakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        navigatorRef.current!.setState(state as unknown as ILakehouseNavigatorState);

        const content = navigatorRef.current!.getUploadTabContent();
        expect(content).toMatchSnapshot();

        let cmp = container.querySelector(".filesForUploadPanel");
        expect(cmp).not.toBeUndefined();

        cmp = container.querySelector(".uploadTarget");
        expect(cmp).not.toBeUndefined();

        unmount();
    });

    it("Test getUploadTabContent with upload error", async () => {
        const state = {
            filesForUpload: [],
            lastFileUploadError: "Upload failed",
            uploadTarget: { data: { type: "Bucket", name: "bucket1" } },
            uploadRunning: false,
            uploadComplete: false,
            filesForUploadPanelWidth: 400,
            fileUploadTargetPath: "path/to/upload",
        };

        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { container, unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        navigatorRef.current!.setState(state as unknown as ILakehouseNavigatorState);

        const content = navigatorRef.current!.getUploadTabContent();
        expect(content).toMatchSnapshot();

        let cmp = container.querySelector(".filesForUploadPanel");
        expect(cmp).not.toBeUndefined();

        cmp = container.querySelector(".uploadTarget");
        expect(cmp).not.toBeUndefined();

        unmount();
    });

    it("Test getObjectStoreBrowserContent with active profile and profiles", async () => {
        const state = {
            activeProfile: { profile: "testProfile" },
            profiles: [{ profile: "testProfile" }, { profile: "anotherProfile" }],
        };

        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { container, unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        navigatorRef.current!.setState(state as unknown as ILakehouseNavigatorState);

        const content = navigatorRef.current!.getObjectStoreBrowserContent();
        expect(content).toMatchSnapshot();

        const cmp = container.querySelector(".objectStoreBrowserPanel");
        expect(cmp).toBeDefined();

        unmount();
    });

    it("Test getObjectStoreBrowserContent with no active profile", async () => {
        const state = {
            activeProfile: undefined,
            profiles: [{ profile: "testProfile" }, { profile: "anotherProfile" }],
        };

        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { container, unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        navigatorRef.current!.setState(state as unknown as ILakehouseNavigatorState);

        const content = navigatorRef.current!.getObjectStoreBrowserContent();
        expect(content).toMatchSnapshot();

        let cmp = container.querySelector(".objectStoreBrowserPanel");
        expect(cmp).toBeDefined();

        cmp = container.querySelector(".activeProfile");
        expect(cmp).toBeDefined();

        unmount();
    });

    it("Test getObjectStoreBrowserContent with no profiles", async () => {
        const state = {
            activeProfile: undefined,
            profiles: [],
        };

        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { container, unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        navigatorRef.current!.setState(state);

        const content = navigatorRef.current!.getObjectStoreBrowserContent();
        expect(content).toMatchSnapshot();

        const cmp = container.querySelector(".objectStoreBrowserPanel");
        expect(cmp).toBeDefined();

        unmount();
    });

    it("Test getLoadTabContent with task items", async () => {
        const state = {
            activeSchema: "testSchema",
            task: {
                items: [
                    { id: "1", caption: "Item 1", uri: "uri1", iconSrc: "icon1" },
                    { id: "2", caption: "Item 2", uri: "uri2", iconSrc: "icon2" },
                ],
            },
            availableDatabaseSchemas: ["testSchema", "anotherSchema"],
            formats: [
                { caption: "PDF (Portable Document Format Files)", id: "pdf" },
                { caption: "TXT (Plain Text Files)", id: "txt" },
            ],
            lastTaskScheduleError: null,
            newTaskPanelWidth: 400,
        };

        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { container, unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        navigatorRef.current!.setState(state as unknown as ILakehouseNavigatorState);

        const content = navigatorRef.current!.getLoadTabContent();
        expect(content).toMatchSnapshot();

        let cmp = container.querySelector(".newTaskPanel");
        expect(cmp).toBeDefined();

        cmp = container.querySelector(".taskItems");
        expect(cmp).toBeDefined();

        unmount();
    });

    it("Test getLoadTabContent with no task items", async () => {
        const state = {
            activeSchema: "testSchema",
            task: {
                items: [],
            },
            availableDatabaseSchemas: ["testSchema", "anotherSchema"],
            formats: [
                { caption: "PDF (Portable Document Format Files)", id: "pdf" },
                { caption: "TXT (Plain Text Files)", id: "txt" },
            ],
            lastTaskScheduleError: null,
            newTaskPanelWidth: 400,
        };

        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { container, unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        navigatorRef.current!.setState(state as unknown as ILakehouseNavigatorState);

        const content = navigatorRef.current!.getLoadTabContent();
        expect(content).toMatchSnapshot();

        const cmp = container.querySelector(".newTaskPanel");
        expect(cmp).toBeDefined();

        unmount();
    });

    it("Test getLoadTabContent with task schedule error", async () => {
        const state = {
            activeSchema: "testSchema",
            task: {
                items: [],
            },
            availableDatabaseSchemas: ["testSchema", "anotherSchema"],
            formats: [
                { caption: "PDF (Portable Document Format Files)", id: "pdf" },
                { caption: "TXT (Plain Text Files)", id: "txt" },
            ],
            lastTaskScheduleError: "Error scheduling task",
            newTaskPanelWidth: 400,
        };

        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { container, unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        navigatorRef.current!.setState(state);

        const content = navigatorRef.current!.getLoadTabContent();
        expect(content).toMatchSnapshot();

        const cmp = container.querySelector(".newTaskPanel");
        expect(cmp).toBeDefined();

        unmount();
    });

    it("Test getTablesAndTasksTabContent with tables and tasks", async () => {
        const state = {
            activeSchema: "testSchema",
            availableDatabaseSchemas: ["testSchema", "anotherSchema"],
            autoRefreshTablesAndTasks: true,
            taskTableTopRowIndex: 0,
            heatWaveMemoryTotal: 1000,
            heatWaveMemoryUsed: 500,
            lastTaskListError: undefined,
            taskListPanelHeight: 200,
        };

        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { container, unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        navigatorRef.current!.setState(state);

        const content = navigatorRef.current!.getTablesAndTasksTabContent();
        expect(content).toMatchSnapshot();

        let cmp = container.querySelector(".tablesAndTasksPanel");
        expect(cmp).toBeDefined();

        cmp = container.querySelector(".taskList");
        expect(cmp).toBeDefined();

        unmount();
    });

    it("Test getTablesAndTasksTabContent with no tables and tasks", async () => {
        const state = {
            activeTabId: LakehouseNavigatorTab.Overview,
            activeSchema: "testSchema",
            availableDatabaseSchemas: ["testSchema", "anotherSchema"],
            autoRefreshTablesAndTasks: true,
            taskTableTopRowIndex: 0,
            heatWaveMemoryTotal: 1000,
            heatWaveMemoryUsed: 500,
            lastTaskListError: undefined,
            taskListPanelHeight: 200,
            lakehouseTables: [],
            lakehouseTasks: [],
            heatWaveVersionSupported: true,
        };

        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { container, unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        navigatorRef.current!.setState(state);

        const content = navigatorRef.current!.getTablesAndTasksTabContent();
        expect(content).toMatchSnapshot();

        const cmp = container.querySelector(".tablesAndTasksPanel");
        expect(cmp).toBeDefined();

        unmount();
    });

    it("Test getTablesAndTasksTabContent with error", async () => {
        const state = {
            activeSchema: "testSchema",
            availableDatabaseSchemas: ["testSchema", "anotherSchema"],
            autoRefreshTablesAndTasks: true,
            taskTableTopRowIndex: 0,
            heatWaveMemoryTotal: 1000,
            heatWaveMemoryUsed: 500,
            lastTaskListError: "Error loading tasks",
            taskListPanelHeight: 200,
        };

        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { container, unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        navigatorRef.current!.setState(state);

        const content = navigatorRef.current!.getTablesAndTasksTabContent();
        expect(content).toMatchSnapshot();

        let cmp = container.querySelector(".tablesAndTasksPanel");
        expect(cmp).toBeDefined();

        cmp = container.querySelector(".taskList");
        expect(cmp).toBeDefined();

        unmount();
    });

    it("Test refreshAvailableDatabaseSchemas with valid schemas", async () => {
        const mockGetCatalogObjects = vi.spyOn(backend, "getCatalogObjects").mockResolvedValue([
            "mysql", "sys", "information_schema", "performance_schema", "testSchema1", "testSchema2",
        ]);

        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        navigatorRef.current!.refreshAvailableDatabaseSchemas();

        expect(mockGetCatalogObjects).toHaveBeenCalledWith("Schema");
        mockGetCatalogObjects.mockRestore();

        unmount();
    });

    it("Test refreshAvailableDatabaseSchemas with backend error", async () => {
        const mockGetCatalogObjects = vi.spyOn(backend, "getCatalogObjects")
            .mockRejectedValue(new Error("Backend error"));
        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        navigatorRef.current!.refreshAvailableDatabaseSchemas();

        expect(navigatorRef.current!.state.availableDatabaseSchemas).toBeUndefined();

        expect(mockGetCatalogObjects).toHaveBeenCalledWith("Schema");
        mockGetCatalogObjects.mockRestore();

        unmount();
    });

    it("Test handleSelectTab with valid tab id", async () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        const mockSetState = vi.spyOn(navigatorRef.current!, "setState");

        navigatorRef.current!.handleSelectTab(LakehouseNavigatorTab.Upload);

        expect(mockSetState).toHaveBeenCalledWith({ activeTabId: LakehouseNavigatorTab.Upload });
        mockSetState.mockRestore();

        unmount();
    });

    it("Test updateValues with undefined activeSchema and profiles", async () => {
        const mockExecute = vi.spyOn(backend, "execute").mockResolvedValue({ rows: [["testSchema"]] });
        const mockGetMdsConfigProfiles = vi.spyOn(backend.mhs, "getMdsConfigProfiles")
            .mockResolvedValue([{
                profile: "testProfile",
                isCurrent: true,
                fingerprint: "",
                keyFile: "",
                region: "",
                tenancy: "",
                user: "",
            }]);

        const newProps: ILakehouseNavigatorProperties = {
            ...props,
            savedState: {
                activeTabId: LakehouseNavigatorTab.Overview, activeSchema: undefined,
                heatWaveVersionSupported: true,
            },
        };

        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...newProps} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        const mockSetState = vi.spyOn(navigatorRef.current!, "setState");

        await navigatorRef.current!.updateValues();

        expect(mockExecute).toHaveBeenNthCalledWith(1, "SELECT DATABASE()");
        expect(mockExecute).toHaveBeenNthCalledWith(2, "SELECT DATABASE()");
        expect(mockSetState).toHaveBeenCalled();

        mockSetState.mockRestore();
        mockExecute.mockRestore();
        mockGetMdsConfigProfiles.mockRestore();

        unmount();
    });

    it("Test updateValues with defined activeSchema and undefined profiles", async () => {
        const mockExecute = vi.spyOn(backend, "execute").mockResolvedValue({ rows: [["testSchema"]] });
        const mockGetMdsConfigProfiles = vi.spyOn(backend.mhs, "getMdsConfigProfiles")
            .mockResolvedValue([{
                profile: "testProfile",
                isCurrent: true,
                fingerprint: "",
                keyFile: "",
                region: "",
                tenancy: "",
                user: "",
            }]);

        const newProps: ILakehouseNavigatorProperties = {
            ...props,
            savedState: {
                activeTabId: LakehouseNavigatorTab.Overview, activeSchema: "savedSchema",
                heatWaveVersionSupported: true,
            },
        };

        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...newProps} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        const mockSetState = vi.spyOn(navigatorRef.current!, "setState");

        await navigatorRef.current!.updateValues();

        expect(mockExecute).toHaveBeenCalledTimes(0);
        expect(mockSetState).toHaveBeenCalled();

        mockSetState.mockRestore();
        mockExecute.mockRestore();
        mockGetMdsConfigProfiles.mockRestore();

        unmount();
    });

    it("Test onStartUploadClick", async () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        const mockSetState = vi.spyOn(navigatorRef.current!, "setState").mockImplementation(() => { /**/ });

        navigatorRef.current!.onStartUploadClick();

        expect(mockSetState).toHaveBeenCalledWith({ activeTabId: LakehouseNavigatorTab.Upload });
        mockSetState.mockRestore();

        unmount();
    });

    it("Test onStartLoadClick", async () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        const mockSetState = vi.spyOn(navigatorRef.current!, "setState").mockImplementation(() => { /**/ });

        navigatorRef.current!.onStartLoadClick();

        expect(mockSetState).toHaveBeenCalledWith({ activeTabId: LakehouseNavigatorTab.Load });
        mockSetState.mockRestore();

        unmount();
    });

    it("Test onManageClick sets the active tab to Manage", async () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        const mockSetState = vi.spyOn(navigatorRef.current!, "setState").mockImplementation(() => { /**/ });

        navigatorRef.current!.onManageClick();

        expect(mockSetState).toHaveBeenCalledWith({ activeTabId: LakehouseNavigatorTab.Manage });
        mockSetState.mockRestore();

        unmount();
    });

    it("Test handleProfileSelection with empty profile set", async () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        const profiles = [{ profile: "testProfile" }, { profile: "anotherProfile" }];
        navigatorRef.current!.setState({ profiles } as ILakehouseNavigatorState);

        navigatorRef.current!.handleProfileSelection(true, new Set());

        expect(navigatorRef.current!.state.activeProfile).toBeUndefined();

        unmount();
    });

    it("Test handleSchemaSelection with valid schema id", async () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        const state = {
            task: {
                schemaName: "oldSchema",
            },
            activeSchema: "oldSchema",
        };

        const schemaId = "newSchema";
        await act(() => {
            navigatorRef.current!.setState(state);

            navigatorRef.current!.handleSchemaSelection(true, new Set([schemaId]));
        });

        expect(navigatorRef.current!.state.task!.schemaName).toBe(schemaId);
        expect(navigatorRef.current!.state.activeSchema).toBe(schemaId);

        unmount();
    });

    it("Test handleSchemaSelection with empty schema id", async () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        const state = {
            task: {
                schemaName: "oldSchema",
            },
            activeSchema: "oldSchema",
        };

        await act(() => {
            navigatorRef.current!.setState(state);
            navigatorRef.current!.handleSchemaSelection(true, new Set());
        });

        expect(navigatorRef.current!.state.task!.schemaName).toBe(undefined);
        expect(navigatorRef.current!.state.activeSchema).toBe(undefined);

        unmount();
    });

    it("Test handleFormatSelection with valid format id", async () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        const state = {
            task: {
                activeFormat: undefined,
            },
        };
        navigatorRef.current!.setState(state);

        const mockSetState = vi.spyOn(navigatorRef.current!, "setState").mockImplementation(() => { /**/ });

        const ids = new Set<string>(["pdf"]);
        navigatorRef.current!.handleFormatSelection(true, ids);

        expect(mockSetState).toHaveBeenCalledWith({
            task: {
                activeFormat: "pdf",
            },
        });
        mockSetState.mockRestore();

        unmount();
    });

    it("Test handleFormatSelection with 'all' format id", async () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        const state = {
            task: {
                activeFormat: "pdf",
            },
        };
        navigatorRef.current!.setState(state);

        const mockSetState = vi.spyOn(navigatorRef.current!, "setState").mockImplementation(() => { /**/ });

        const ids = new Set<string>(["all"]);
        navigatorRef.current!.handleFormatSelection(true, ids);

        expect(mockSetState).toHaveBeenCalledWith({
            task: {
                activeFormat: undefined,
            },
        });
        mockSetState.mockRestore();

        unmount();
    });

    it("Test handleLanguageSelection with valid language ID", async () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        const state = {
            task: {
                languageId: undefined,
            },
        };
        navigatorRef.current!.setState(state);
        const mockSetState = vi.spyOn(navigatorRef.current!, "setState").mockImplementation(() => { /**/ });

        const ids = new Set<string>(["fr"]);
        navigatorRef.current!.handleLanguageSelection(true, ids);

        expect(mockSetState).toHaveBeenCalledWith({
            task: {
                languageId: "fr",
            },
        });
        mockSetState.mockRestore();

        unmount();
    });

    it("Test handleLanguageSelection with default language ID", async () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        const { unmount } = render(
            <LakehouseNavigator ref={navigatorRef} {...props} />,
        );

        await nextRunLoop();
        expect(navigatorRef.current).toBeDefined();

        const state = {
            task: {
                languageId: "fr",
            },
        };
        navigatorRef.current!.setState(state);

        const mockSetState = vi.spyOn(navigatorRef.current!, "setState").mockImplementation(() => { /**/ });

        const ids = new Set<string>(["en"]);
        navigatorRef.current!.handleLanguageSelection(true, ids);

        expect(mockSetState).toHaveBeenCalledWith({
            task: {
                languageId: undefined,
            },
        });
        mockSetState.mockRestore();

        unmount();
    });

    describe("objectStoreTreeGridCaptionColumnFormatter tests", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        beforeEach(async () => {
            const props = {
                savedState,
                backend,
                toolbarItems: {
                    navigation: [],
                    execution: [],
                    editor: [],
                    auxiliary: [],
                },
                onLakehouseNavigatorStateChange: vi.fn(),
            };

            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;

            await nextRunLoop();
            expect(navigatorRef.current).toBeDefined();
        });

        afterEach(() => {
            unmount();
        });

        it("should format compartment item correctly", () => {
            const cell = {
                getData: vi.fn().mockReturnValue({
                    data: { type: ObjectStorageTreeItemType.Compartment, isCurrent: true, name: "Compartment" },
                }),
                getColumn: vi.fn(),
            } as unknown as CellComponent;

            const result = navigatorRef.current!.objectStoreTreeGridCaptionColumnFormatter(cell);

            expect((result as HTMLElement).querySelector(".itemCaption")?.textContent).toBe("Compartment");
        });

        it("should format bucket item correctly", () => {
            const cell = {
                getData: vi.fn().mockReturnValue({
                    data: { type: ObjectStorageTreeItemType.Bucket, name: "Bucket" },
                }),
                getColumn: vi.fn(),
            } as unknown as CellComponent;

            const result = navigatorRef.current!.objectStoreTreeGridCaptionColumnFormatter(cell);

            expect((result as HTMLElement).querySelector(".itemCaption")?.textContent).toBe("Bucket");
        });

        it("should format prefix item correctly", () => {
            const cell = {
                getData: vi.fn().mockReturnValue({
                    data: { type: ObjectStorageTreeItemType.Prefix, name: "prefix/" },
                }),
                getColumn: vi.fn(),
            } as unknown as CellComponent;

            const result = navigatorRef.current!.objectStoreTreeGridCaptionColumnFormatter(cell);

            expect((result as HTMLElement).querySelector(".itemCaption")?.textContent).toBe("prefix");
        });

        it("should format file item correctly", () => {
            const cell = {
                getData: vi.fn().mockReturnValue({
                    data: { type: ObjectStorageTreeItemType.File, name: "file.txt" },
                }),
                getColumn: vi.fn(),
            } as unknown as CellComponent;

            const result = navigatorRef.current!.objectStoreTreeGridCaptionColumnFormatter(cell);

            expect((result as HTMLElement).querySelector(".itemCaption")?.textContent).toBe("file.txt");
        });

        it("should format placeholder item correctly", () => {
            const cell = {
                getData: vi.fn().mockReturnValue({
                    data: { type: ObjectStorageTreeItemType.Placeholder },
                }),
                getColumn: vi.fn(),
            } as unknown as CellComponent;

            const result = navigatorRef.current!.objectStoreTreeGridCaptionColumnFormatter(cell);

            expect((result as HTMLElement).querySelector(".itemCaption")?.textContent).toBe("Loading ...");
        });

        it("should format error item correctly", () => {
            const cell = {
                getData: vi.fn().mockReturnValue({
                    data: { type: ObjectStorageTreeItemType.Error, name: "Error" },
                }),
                getColumn: vi.fn(),
            } as unknown as CellComponent;

            const result = navigatorRef.current!.objectStoreTreeGridCaptionColumnFormatter(cell);

            expect((result as HTMLElement).querySelector(".itemCaption")?.textContent).toBe("Error");
        });
    });

    describe("objectStoreTreeGridColumnFormatter tests", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;
        const onRendered = vi.fn((callback) => {
            return callback();
        });

        let cell: CellComponent;

        beforeEach(() => {
            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;

            cell = {
                getData: vi.fn(),
                getColumn: vi.fn(),
                getElement: vi.fn(),
            } as unknown as CellComponent;
        });

        afterEach(() => {
            unmount();
        });

        it("should format file size correctly", () => {
            const fileData = {
                data: {
                    type: ObjectStorageTreeItemType.File,
                    size: 1024,
                },
            } as unknown as IObjectStorageTreeItem;

            cell.getData = vi.fn().mockReturnValue(fileData);
            cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                return "size";
            } });
            const element = document.createElement("div");
            cell.getElement = vi.fn().mockReturnValue(element);

            const result = navigatorRef.current!.objectStoreTreeGridColumnFormatter(cell, {}, onRendered);

            expect(result).toBe("1.00 KB");
            expect(element.classList.contains("sizeField")).toBe(true);
            expect(onRendered).toHaveBeenCalled();
        });

        it("should show dash for placeholder size", () => {
            const dirData = {
                data: {
                    type: ObjectStorageTreeItemType.Placeholder,
                },
            } as IObjectStorageTreeItem;

            cell.getData = vi.fn().mockReturnValue(dirData);
            cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                return "size";
            } });
            const element = document.createElement("div");
            cell.getElement = vi.fn().mockReturnValue(element);

            const result = navigatorRef.current!.objectStoreTreeGridColumnFormatter(cell, {}, onRendered);

            expect(result).toBe("-");
            expect(element.classList.contains("sizeField")).toBe(true);
        });

        it("should format modified date correctly", () => {
            const testDate = new Date("2024-01-15T14:30:00");
            const fileData = {
                data: {
                    type: ObjectStorageTreeItemType.File,
                    timeModified: testDate.toISOString(),
                },
            } as unknown as IObjectStorageTreeItem;

            cell.getData = vi.fn().mockReturnValue(fileData);
            cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                return "modified";
            } });
            const element = document.createElement("div");
            cell.getElement = vi.fn().mockReturnValue(element);

            const result = navigatorRef.current!.objectStoreTreeGridColumnFormatter(cell, {}, onRendered);

            expect(result).toMatch(/01\/15\/24.*14:30/);
            expect(element.classList.contains("modifiedField")).toBe(true);
        });

        it("should show dash for placeholder modified date", () => {
            const dirData = {
                data: {
                    type: ObjectStorageTreeItemType.Placeholder,
                },
            } as IObjectStorageTreeItem;

            cell.getData = vi.fn().mockReturnValue(dirData);
            cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                return "modified";
            } });
            const element = document.createElement("div");
            cell.getElement = vi.fn().mockReturnValue(element);

            const result = navigatorRef.current!.objectStoreTreeGridColumnFormatter(cell, {}, onRendered);

            expect(result).toBe("-");
            expect(element.classList.contains("modifiedField")).toBe(true);
        });

        it("should handle unknown column field", () => {
            const fileData = {
                data: {
                    type: ObjectStorageTreeItemType.File,
                },
            } as IObjectStorageTreeItem;

            cell.getData = vi.fn().mockReturnValue(fileData);
            cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                return "unknown";
            } });
            const element = document.createElement("div");
            cell.getElement = vi.fn().mockReturnValue(element);

            const result = navigatorRef.current!.objectStoreTreeGridColumnFormatter(cell, {}, onRendered);

            expect(result).toBe("-");
            expect(onRendered).toHaveBeenCalled();
        });
    });

    describe("schemasTreeGridColumnFormatter tests", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        beforeEach(() => {
            const props = {
                savedState,
                backend,
                toolbarItems: {
                    navigation: [],
                    execution: [],
                    editor: [],
                    auxiliary: [],
                },
                onLakehouseNavigatorStateChange: vi.fn(),
            };

            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;
        });

        afterEach(() => {
            unmount();
        });

        it("should format schema name correctly", () => {
            const schemaName = "testSchema";
            const cell = {
                getData: vi.fn().mockReturnValue({ schemaName }),
                getColumn: vi.fn().mockReturnValue({ getField: () => {
                    return "schemaName";
                } }),
            } as unknown as CellComponent;

            const result = navigatorRef.current!.schemasTreeGridColumnFormatter(cell, {}, vi.fn());

            expect(result).toBe(schemaName);
        });

        it("should add correct class to the cell element", () => {
            const schemaName = "testSchema";
            const cell = {
                getData: vi.fn().mockReturnValue({ schemaName }),
                getColumn: vi.fn().mockReturnValue({ getField: () => {
                    return "schemaName";
                } }),
            } as unknown as CellComponent;

            const onRendered = vi.fn((callback) => {
                return callback();
            });
            const cellElement = document.createElement("div");
            cell.getElement = vi.fn().mockReturnValue(cellElement);

            navigatorRef.current!.schemasTreeGridColumnFormatter(cell, {}, onRendered);

            expect(cellElement.classList.contains("tableField")).toBe(true);
            expect(cellElement.classList.contains("schemaNameField")).toBe(true);
        });
    });

    describe("tablesTreeGridRowFormatter tests", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        let row: RowComponent;
        let element: HTMLElement;

        beforeEach(() => {
            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;

            element = document.createElement("div");
            row = {
                getData: vi.fn(),
                getElement: vi.fn().mockReturnValue(element),
            } as unknown as RowComponent;
        });

        afterEach(() => {
            unmount();
        });

        it("should add notLoaded class when table is not loaded and progress is 0", () => {
            const rowData = {
                loaded: false,
                progress: 0,
            } as ILakehouseTable;

            row.getData = vi.fn().mockReturnValue(rowData);

            navigatorRef.current!.tablesTreeGridRowFormatter(row);

            expect(element.classList.contains("notLoaded")).toBe(true);
            expect(element.classList.contains("loading")).toBe(false);
            expect(element.classList.contains("loaded")).toBe(false);
        });

        it("should add loading class when table is not loaded but has progress", () => {
            const rowData = {
                loaded: false,
                progress: 50,
            } as ILakehouseTable;

            row.getData = vi.fn().mockReturnValue(rowData);

            navigatorRef.current!.tablesTreeGridRowFormatter(row);

            expect(element.classList.contains("notLoaded")).toBe(false);
            expect(element.classList.contains("loading")).toBe(true);
            expect(element.classList.contains("loaded")).toBe(false);
        });

        it("should add loaded class when table is loaded", () => {
            const rowData = {
                loaded: true,
                progress: 100,
            } as ILakehouseTable;

            row.getData = vi.fn().mockReturnValue(rowData);

            navigatorRef.current!.tablesTreeGridRowFormatter(row);

            expect(element.classList.contains("notLoaded")).toBe(false);
            expect(element.classList.contains("loading")).toBe(false);
            expect(element.classList.contains("loaded")).toBe(true);
        });
    });

    describe("tablesTreeGridColumnFormatter tests", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        let cell: CellComponent;
        const onRendered = vi.fn((callback) => {
            return callback();
        });

        beforeEach(() => {
            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;

            const element = document.createElement("div");
            cell = {
                getData: vi.fn(),
                getColumn: vi.fn(),
                getElement: vi.fn().mockReturnValue(element),
            } as unknown as CellComponent;
        });

        afterEach(() => {
            unmount();
        });

        it("should format tableName column for loaded table", () => {
            const cellData = {
                tableName: "test_table",
                loaded: true,
                progress: 100,
            } as ILakehouseTable;

            cell.getData = vi.fn().mockReturnValue(cellData);
            cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                return "tableName";
            } });

            const result = navigatorRef.current!.tablesTreeGridColumnFormatter(cell, {}, onRendered) as HTMLElement;

            expect(result.classList.contains("tableField")).toBe(true);
            const statusIcon = result.querySelector(".itemLoaded");
            expect(statusIcon).toBeTruthy();
            expect(result.textContent).toContain("test_table");
        });

        it("should format tableName column for loading table", () => {
            const cellData = {
                tableName: "loading_table",
                loaded: false,
                progress: 50,
            } as ILakehouseTable;

            cell.getData = vi.fn().mockReturnValue(cellData);
            cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                return "tableName";
            } });

            const result = navigatorRef.current!.tablesTreeGridColumnFormatter(cell, {}, onRendered) as HTMLElement;

            expect(result.classList.contains("tableField")).toBe(true);
            const statusIcon = result.querySelector(".itemLoading");
            expect(statusIcon).toBeTruthy();
            const progressBar = result.querySelector(".progressBar");
            expect(progressBar).toBeTruthy();
            expect(result.textContent).toContain("loading_table");
        });

        it("should format rows column", () => {
            const cellData = {
                rows: 1234567,
            } as ILakehouseTable;

            cell.getData = vi.fn().mockReturnValue(cellData);
            cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                return "rows";
            } });

            const result = navigatorRef.current!.tablesTreeGridColumnFormatter(cell, {}, onRendered);

            expect(result).toBe("1.2m");
            expect(cell.getElement().classList.contains("sizeField")).toBe(true);
        });

        it("should format dataLength column", () => {
            const cellData = {
                dataLength: 1024 * 1024, // 1MB
            } as ILakehouseTable;

            cell.getData = vi.fn().mockReturnValue(cellData);
            cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                return "dataLength";
            } });

            const result = navigatorRef.current!.tablesTreeGridColumnFormatter(cell, {}, onRendered);

            expect(result).toBe("1.00 MB");
            expect(cell.getElement().classList.contains("sizeField")).toBe(true);
        });

        it("should format lastChange column", () => {
            const cellData = {
                lastChange: "2024-01-15 14:30:00",
            } as ILakehouseTable;

            cell.getData = vi.fn().mockReturnValue(cellData);
            cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                return "lastChange";
            } });

            const result = navigatorRef.current!.tablesTreeGridColumnFormatter(cell, {}, onRendered);

            expect(result).toBe("2024-01-15 14:30:00");
            expect(cell.getElement().classList.contains("dateField")).toBe(true);
        });

        it("should format comment column", () => {
            const cellData = {
                comment: "Test comment",
            } as ILakehouseTable;

            cell.getData = vi.fn().mockReturnValue(cellData);
            cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                return "comment";
            } });

            const result = navigatorRef.current!.tablesTreeGridColumnFormatter(cell, {}, onRendered);

            expect(result).toBe("Test comment");
            expect(cell.getElement().classList.contains("commentField")).toBe(true);
        });

        it("should handle empty rows value", () => {
            const cellData = {
                rows: 0,
            } as ILakehouseTable;

            cell.getData = vi.fn().mockReturnValue(cellData);
            cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                return "rows";
            } });

            const result = navigatorRef.current!.tablesTreeGridColumnFormatter(cell, {}, onRendered);

            expect(result).toBe("-");
            expect(cell.getElement().classList.contains("sizeField")).toBe(true);
        });

        it("should handle empty dataLength value", () => {
            const cellData = {
                dataLength: 0,
            } as ILakehouseTable;

            cell.getData = vi.fn().mockReturnValue(cellData);
            cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                return "dataLength";
            } });

            const result = navigatorRef.current!.tablesTreeGridColumnFormatter(cell, {}, onRendered);

            expect(result).toBe("-");
            expect(cell.getElement().classList.contains("sizeField")).toBe(true);
        });
    });

    describe("taskTreeGridRowFormatter tests", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        let row: RowComponent;
        let element: HTMLElement;

        beforeEach(() => {
            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;

            element = document.createElement("div");
            row = {
                getData: vi.fn(),
                getElement: vi.fn().mockReturnValue(element),
            } as unknown as RowComponent;
        });

        afterEach(() => {
            unmount();
        });

        it("should not add error class for task with non-ERROR status", () => {
            const rowData = {
                status: "SUCCESS",
                type: "TASK",
            } as ILakehouseTask;

            row.getData = vi.fn().mockReturnValue(rowData);

            navigatorRef.current!.taskTreeGridRowFormatter(row);

            expect(element.classList.contains("error")).toBe(false);
        });

        it("should not add any classes for task item", () => {
            const rowData = {
                type: "TASK_ITEM",
            } as unknown as ILakehouseTaskItem;

            row.getData = vi.fn().mockReturnValue(rowData);

            navigatorRef.current!.taskTreeGridRowFormatter(row);

            expect(element.classList.length).toBe(0);
        });
    });

    describe("taskTreeGridColumnFormatter tests", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        let cell: CellComponent;

        beforeEach(() => {
            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;

            cell = {
                getData: vi.fn(),
                getColumn: vi.fn(),
                getElement: vi.fn(),
                getRow: vi.fn(),
            } as unknown as CellComponent;
        });

        afterEach(() => {
            unmount();
        });

        describe("Task Item formatting", () => {
            it("should format title column for task", () => {
                const taskData = {
                    type: "TASK",
                    name: "Test Task",
                    status: "RUNNING",
                    description: "Task description",
                } as ILakehouseTask;

                cell.getData = vi.fn().mockReturnValue(taskData);
                cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                    return "name";
                } });

                const result = navigatorRef.current!.taskTreeGridColumnFormatter(cell) as HTMLElement;

                expect(result.classList.contains("itemField")).toBe(true);
                expect(result.textContent).toContain("Test Task");
                const statusIcon = result.querySelector(".running");
                expect(statusIcon).toBeTruthy();
            });

            it("should format title column for task item", () => {
                const taskItemData = {
                    type: "TASK_ITEM",
                    tableName: "test_table",
                } as unknown as ILakehouseTaskItem;

                const parentTask = {
                    type: "TASK",
                    schemaName: "test_schema",
                } as ILakehouseTask;

                cell.getData = vi.fn().mockReturnValue(taskItemData);
                cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                    return "name";
                } });
                cell.getRow = vi.fn().mockReturnValue({
                    getTreeParent: () => {
                        return {
                            getData: parentTask,
                        };
                    },
                });

                const result = navigatorRef.current!.taskTreeGridColumnFormatter(cell) as HTMLElement;

                expect(result.classList.contains("itemField")).toBe(true);
                expect(result.textContent).toContain("test_schema.test_table");
            });

            it("should format status column for task item", () => {
                const taskItemData = {
                    type: "TASK_ITEM",
                    progress: 75,
                } as unknown as ILakehouseTaskItem;

                cell.getData = vi.fn().mockReturnValue(taskItemData);
                cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                    return "status";
                } });

                const result = navigatorRef.current!.taskTreeGridColumnFormatter(cell) as HTMLElement;

                expect(result.classList.contains("itemField")).toBe(true);
                expect(result.textContent).toBe("75%");
            });

            it("should format description column for task item", () => {
                const taskItemData = {
                    type: "TASK_ITEM",
                    uri: "s3://bucket/path/to/file",
                } as unknown as ILakehouseTaskItem;

                cell.getData = vi.fn().mockReturnValue(taskItemData);
                cell.getColumn = vi.fn().mockReturnValue({ getField: () => {
                    return "description";
                } });

                const result = navigatorRef.current!.taskTreeGridColumnFormatter(cell) as HTMLElement;

                expect(result.classList.contains("itemField")).toBe(true);
                expect(result.textContent).toBe("s3://bucket/path/to/file");
            });
        });
    });

    describe("Object Tree Row Handling", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        let row: RowComponent;
        let getObjectStorageTreeChildrenSpy: MockInstance<(
            parent: IObjectStorageTreeItem) => Promise<IObjectStorageTreeItem[]>>;

        beforeEach(() => {
            const result = render(
                <TestLakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;

            row = {
                getData: vi.fn(),
                update: vi.fn(),
            } as unknown as RowComponent;

            getObjectStorageTreeChildrenSpy = vi.spyOn(navigatorRef.current!, "getObjectStorageTreeChildren");
        });

        afterEach(() => {
            getObjectStorageTreeChildrenSpy.mockRestore();
            unmount();
        });

        describe("objTreeHandleRowExpanded", () => {
            it("should handle row expansion for new item", () => {
                const treeItem = {
                    id: "test-id",
                    expanded: false,
                    expandedOnce: false,
                    data: {
                        type: ObjectStorageTreeItemType.Bucket,
                    },
                } as IObjectStorageTreeItem;

                row.getData = vi.fn().mockReturnValue(treeItem);

                navigatorRef.current!.objTreeHandleRowExpanded(row);

                expect(treeItem.expanded).toBe(true);
                expect(getObjectStorageTreeChildrenSpy).toHaveBeenCalledWith(treeItem);
            });

            it("should not load children for already expanded item", () => {
                const treeItem = {
                    id: "test-id",
                    expanded: false,
                    expandedOnce: true,
                    data: {
                        type: ObjectStorageTreeItemType.Bucket,
                    },
                } as IObjectStorageTreeItem;

                row.getData = vi.fn().mockReturnValue(treeItem);

                navigatorRef.current!.objTreeHandleRowExpanded(row);

                expect(treeItem.expanded).toBe(true);
                expect(getObjectStorageTreeChildrenSpy).not.toHaveBeenCalled();
            });

            it("should not load children for non-container item", () => {
                const treeItem = {
                    id: "test-id",
                    expanded: false,
                    expandedOnce: false,
                    data: {
                        type: ObjectStorageTreeItemType.File,
                    },
                } as IObjectStorageTreeItem;

                row.getData = vi.fn().mockReturnValue(treeItem);

                navigatorRef.current!.objTreeHandleRowExpanded(row);

                expect(treeItem.expanded).toBe(true);
                expect(getObjectStorageTreeChildrenSpy).not.toHaveBeenCalled();
            });
        });

        describe("objTreeHandleRowCollapsed", () => {
            it("should handle row collapse", () => {
                const treeItem = {
                    id: "test-id",
                    expanded: true,
                } as IObjectStorageTreeItem;

                navigatorRef.current!.setState({ expandedObjTreeItems: ["test-id", "other-id"] });
                row.getData = vi.fn().mockReturnValue(treeItem);

                navigatorRef.current!.objTreeHandleRowCollapsed(row);

                expect(treeItem.expanded).toBe(false);
            });
        });

        describe("objTreeIsRowExpanded", () => {
            it("should return false and not trigger expansion for collapsed item", () => {
                const treeItem = {
                    expanded: false,
                } as IObjectStorageTreeItem;

                row.getData = vi.fn().mockReturnValue(treeItem);

                const result = navigatorRef.current!.objTreeIsRowExpanded(row);

                expect(result).toBe(false);
                expect(getObjectStorageTreeChildrenSpy).not.toHaveBeenCalled();
            });
        });
    });

    describe("objTreeToggleSelectedState", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        let cell: CellComponent;

        beforeEach(() => {
            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;

            cell = {
                getData: vi.fn(),
            } as unknown as CellComponent;
        });

        afterEach(() => {
            unmount();
        });

        describe("Upload tab", () => {
            beforeEach(() => {
                navigatorRef.current!.setState({ activeTabId: LakehouseNavigatorTab.Upload });
            });

            it("should set upload target when selecting new item", () => {
                const treeItem = {
                    id: "test-id",
                    data: {
                        type: ObjectStorageTreeItemType.Bucket,
                        name: "test-bucket",
                    },
                } as IObjectStorageTreeItem;

                cell.getData = vi.fn().mockReturnValue(treeItem);

                navigatorRef.current!.objTreeToggleSelectedState(new Event("click"), cell);

                expect(navigatorRef.current!.state.fileUploadTargetPath).toBeUndefined();
            });

            it("should clear upload target when selecting same item", () => {
                const treeItem = {
                    id: "test-id",
                    data: {
                        type: ObjectStorageTreeItemType.Bucket,
                        name: "test-bucket",
                    },
                } as IObjectStorageTreeItem;

                navigatorRef.current!.setState({ uploadTarget: treeItem });
                cell.getData = vi.fn().mockReturnValue(treeItem);

                navigatorRef.current!.objTreeToggleSelectedState(new Event("click"), cell);

                expect(navigatorRef.current!.state.uploadTarget).toBeUndefined();
                expect(navigatorRef.current!.state.fileUploadTargetPath).toBeUndefined();
            });
        });
    });

    describe("generateVectorTableName", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        beforeEach(() => {
            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;
        });

        afterEach(() => {
            unmount();
        });

        it("should return empty string for empty items array", () => {
            const tableName = navigatorRef.current!.generateVectorTableName([]);
            expect(tableName).toBe("");
        });

        it("should extract table name from single file URI", () => {
            const items: ILakehouseTaskItem[] = [{
                id: "test-id",
                uri: "oci://bucket/folder/test_data.csv",
                caption: "test_data.csv",
            }] as unknown as ILakehouseTaskItem[];

            const tableName = navigatorRef.current!.generateVectorTableName(items);
            expect(tableName).toBe("test_data");
        });

        it("should handle single file URI with trailing slash", () => {
            const items: ILakehouseTaskItem[] = [{
                id: "test-id",
                uri: "oci://bucket/folder/test_data/",
                caption: "test_data",
            }] as unknown as ILakehouseTaskItem[];

            const tableName = navigatorRef.current!.generateVectorTableName(items);
            expect(tableName).toBe("test_data");
        });

        it("should extract common part from multiple URIs", () => {
            const items: ILakehouseTaskItem[] = [
                {
                    id: "test-id-1",
                    uri: "oci://bucket/common_folder/file1.csv",
                    caption: "file1.csv",
                },
                {
                    id: "test-id-2",
                    uri: "oci://bucket/common_folder/file2.csv",
                    caption: "file2.csv",
                },
            ] as unknown as ILakehouseTaskItem[];

            const tableName = navigatorRef.current!.generateVectorTableName(items);
            expect(tableName).toBe("file");
        });

        it("should handle multiple URIs with trailing slashes", () => {
            const items: ILakehouseTaskItem[] = [
                {
                    id: "test-id-1",
                    uri: "oci://bucket/common_folder/subfolder1/",
                    caption: "subfolder1",
                },
                {
                    id: "test-id-2",
                    uri: "oci://bucket/common_folder/subfolder2/",
                    caption: "subfolder2",
                },
            ] as unknown as ILakehouseTaskItem[];

            const tableName = navigatorRef.current!.generateVectorTableName(items);
            expect(tableName).toBe("subfolder");
        });

        it("should fallback to vector_table when no common part found", () => {
            const items: ILakehouseTaskItem[] = [
                {
                    id: "test-id-1",
                    uri: "oci://bucket1/folder1/file1.csv",
                    caption: "file1.csv",
                },
                {
                    id: "test-id-2",
                    uri: "oci://bucket2/folder2/file2.csv",
                    caption: "file2.csv",
                },
            ] as unknown as ILakehouseTaskItem[];

            const tableName = navigatorRef.current!.generateVectorTableName(items);
            expect(tableName).toBe("bucket");
        });
    });

    describe("checkMysqlPrivileges", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        let executeSpy: MockInstance<(sql: string, params?: string[], requestId?: string,
            callback?: DataCallback<ShellAPIGui.GuiSqlEditorExecute>,
        ) => Promise<IDbEditorResultSetData | undefined>>;

        beforeEach(() => {
            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;

            executeSpy = vi.spyOn(props.backend, "execute");
        });

        afterEach(() => {
            vi.clearAllMocks();
            unmount();
        });

        it("should return true when all required views are accessible", async () => {
            executeSpy.mockResolvedValueOnce({
                rows: [
                    ["mysql_tasks", "task_i", "VIEW"],
                    ["mysql_tasks", "task_log_i", "VIEW"],
                ],
            });

            const result = await navigatorRef.current!.checkMysqlPrivileges();
            expect(result).toBe(true);

            expect(executeSpy).toHaveBeenCalledWith(
                expect.stringMatching(/SELECT.*FROM INFORMATION_SCHEMA\.TABLES.*mysql_tasks.*/s),
            );
        });

        it("should return false when not all views are accessible", async () => {
            executeSpy.mockResolvedValueOnce({
                rows: [
                    ["mysql_tasks", "task_i", "VIEW"],
                ],
            });

            const result = await navigatorRef.current!.checkMysqlPrivileges();
            expect(result).toBe(false);
        });

        it("should return false when no views are accessible", async () => {
            executeSpy.mockResolvedValueOnce({
                rows: [],
            });

            const result = await navigatorRef.current!.checkMysqlPrivileges();
            expect(result).toBe(false);
        });

        it("should return false when execute returns undefined", async () => {
            executeSpy.mockResolvedValueOnce(undefined);

            const result = await navigatorRef.current!.checkMysqlPrivileges();
            expect(result).toBe(false);
        });

        it("should return false when execute returns null rows", async () => {
            executeSpy.mockResolvedValueOnce({
                rows: undefined,
            });

            const result = await navigatorRef.current!.checkMysqlPrivileges();
            expect(result).toBe(false);
        });
    });

    describe("setActiveDatabaseSchema", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        let autoRefreshTreesSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            const result = render(
                <TestLakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;

            autoRefreshTreesSpy = vi.spyOn(navigatorRef.current!, "autoRefreshTrees").mockResolvedValue(undefined);
        });

        afterEach(() => {
            vi.restoreAllMocks();
            unmount();
        });

        it("should update state when schema changes", async () => {
            const newSchema = "newSchema";
            const currentTask = { schemaName: "oldSchema", items: [] };
            navigatorRef.current!.setState({ activeSchema: "oldSchema", task: currentTask });

            navigatorRef.current!.setActiveDatabaseSchema(newSchema);

            await nextProcessTick();

            expect(navigatorRef.current!.state.activeSchema).toBe(newSchema);
            expect(navigatorRef.current!.state.task!.schemaName).toBe(newSchema);
        });

        it("should not update state when schema is the same", () => {
            const schema = "sameSchema";
            navigatorRef.current!.setState({ activeSchema: schema });

            navigatorRef.current!.setActiveDatabaseSchema(schema);

            expect(autoRefreshTreesSpy).not.toHaveBeenCalled();
        });

        it("should trigger autoRefreshTrees and forceUpdate when schema changes", async () => {
            const forceUpdateSpy = vi.spyOn(navigatorRef.current!, "forceUpdate");

            navigatorRef.current!.setActiveDatabaseSchema("newSchema");

            await nextProcessTick();

            expect(autoRefreshTreesSpy).toHaveBeenCalled();
            expect(forceUpdateSpy).toHaveBeenCalled();
        });

        it("should preserve task items when updating schema", async () => {
            const currentTask = {
                schemaName: "oldSchema",
                items: [
                    { id: 1, name: "item1" } as unknown as ILakehouseTaskItem,
                    { id: 2, name: "item2" } as unknown as ILakehouseTaskItem,
                ],
            };
            navigatorRef.current!.setState({
                activeSchema: "oldSchema",
                task: currentTask,
            });

            navigatorRef.current!.setActiveDatabaseSchema("newSchema");

            await nextProcessTick();

            expect(navigatorRef.current!.state.task!.schemaName).toBe("newSchema");
        });

        it("should handle setState callback chain correctly", async () => {
            const forceUpdateSpy = vi.spyOn(navigatorRef.current!, "forceUpdate");
            autoRefreshTreesSpy.mockImplementation(() => {
                return Promise.resolve();
            });

            navigatorRef.current!.setActiveDatabaseSchema("newSchema");

            await nextProcessTick();

            expect(autoRefreshTreesSpy).toHaveBeenCalledTimes(1);
            expect(forceUpdateSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("getDefaultTaskDescription", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        beforeEach(() => {
            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;
        });

        afterEach(() => {
            unmount();
        });

        it("should return default description when task is undefined", () => {
            const result = navigatorRef.current!.getDefaultTaskDescription(undefined);
            expect(result).toBe("Data from Object Storage");
        });

        it("should return default description when task items are undefined", () => {
            const task = { schemaName: "testSchema" };
            const result = navigatorRef.current!.getDefaultTaskDescription(task);
            expect(result).toBe("Data from Object Storage");
        });

        it("should return default description when task items are empty", () => {
            const task = { schemaName: "testSchema", items: [] };
            const result = navigatorRef.current!.getDefaultTaskDescription(task);
            expect(result).toBe("Data from Object Storage");
        });

        it("should return bucket name in description when task has items", () => {
            const task: ILakehouseTask = {
                schemaName: "testSchema",
                items: [{
                    id: "1",
                    uri: "test//my-bucket/path/to/file.csv",
                }],
            } as unknown as ILakehouseTask;
            const result = navigatorRef.current!.getDefaultTaskDescription(task);
            expect(result).toBe("Data from Bucket my-bucket");
        });

        it("should use first item's bucket name when multiple items exist", () => {
            const task: ILakehouseTask = {
                schemaName: "testSchema",
                items: [
                    { id: "1", uri: "test//bucket1/file1.csv" },
                    { id: "2", uri: "test//bucket2/file2.csv" },
                ],
            } as unknown as ILakehouseTask;
            const result = navigatorRef.current!.getDefaultTaskDescription(task);
            expect(result).toBe("Data from Bucket bucket1");
        });
    });

    describe("toggleAutoRefresh", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        beforeEach(() => {
            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;
        });

        afterEach(() => {
            vi.restoreAllMocks();
            unmount();
        });

        it("should toggle autoRefreshTablesAndTasks state from false to true", () => {
            navigatorRef.current!.setState({ autoRefreshTablesAndTasks: false });

            navigatorRef.current!.toggleAutoRefresh({} as InputEvent, CheckState.Unchecked);

            expect(navigatorRef.current!.state.autoRefreshTablesAndTasks).toBe(true);
        });

        it("should not clear timer if it was already null", () => {
            navigatorRef.current!.setState({ autoRefreshTablesAndTasks: true });
            const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

            navigatorRef.current!.toggleAutoRefresh({} as InputEvent, CheckState.Unchecked);

            expect(clearTimeoutSpy).not.toHaveBeenCalled();
        });
    });

    describe("updateObjStorageTreeGrid", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        let setDataSpy: ReturnType<typeof vi.fn>;
        let getSelectedRowsSpy: ReturnType<typeof vi.fn>;
        let deselectRowSpy: ReturnType<typeof vi.fn>;
        let selectRowSpy: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;

            // Setup tree grid spies
            setDataSpy = vi.fn().mockResolvedValue(undefined);
            getSelectedRowsSpy = vi.fn();
            deselectRowSpy = vi.fn();
            selectRowSpy = vi.fn();
        });

        afterEach(() => {
            vi.restoreAllMocks();
            unmount();
        });

        it("should do nothing when tree items are undefined", () => {
            navigatorRef.current!.updateObjStorageTreeGrid();

            expect(setDataSpy).not.toHaveBeenCalled();
        });

        it("should handle items without ids in selection", async () => {
            const itemWithoutId = { name: "item1" };
            getSelectedRowsSpy.mockReturnValue([{ getData: () => {
                return itemWithoutId;
            } }]);

            navigatorRef.current!.updateObjStorageTreeGrid();
            await nextProcessTick();

            expect(selectRowSpy).not.toHaveBeenCalled();
        });

        it("should not restore selection if no rows were selected", async () => {
            getSelectedRowsSpy.mockReturnValue([]);

            navigatorRef.current!.updateObjStorageTreeGrid();
            await nextProcessTick();

            expect(deselectRowSpy).not.toHaveBeenCalled();
            expect(selectRowSpy).not.toHaveBeenCalled();
        });
    });

    describe("refreshObjTreeItem", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        let getObjectStorageTreeChildrenSpy: MockInstance<(
            parent: IObjectStorageTreeItem) => Promise<IObjectStorageTreeItem[]>>;

        let updateObjStorageTreeGridSpy: MockInstance<() => void>;

        beforeEach(() => {
            const result = render(
                <TestLakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;

            getObjectStorageTreeChildrenSpy = vi.spyOn(navigatorRef.current!, "getObjectStorageTreeChildren")
                .mockResolvedValue([]);
            updateObjStorageTreeGridSpy = vi.spyOn(navigatorRef.current!, "updateObjStorageTreeGrid")
                .mockImplementation(() => { /**/ });
        });

        afterEach(() => {
            vi.restoreAllMocks();
            unmount();
        });

        it("should do nothing when tree item is not found", async () => {
            await navigatorRef.current!.refreshObjTreeItem("nonexistent");

            expect(getObjectStorageTreeChildrenSpy).not.toHaveBeenCalled();
            expect(updateObjStorageTreeGridSpy).toHaveBeenCalled();
        });

        it("should handle undefined objTreeItems", async () => {
            await navigatorRef.current!.refreshObjTreeItem("any");

            expect(getObjectStorageTreeChildrenSpy).not.toHaveBeenCalled();
            expect(updateObjStorageTreeGridSpy).toHaveBeenCalled();
        });
    });

    describe("handleAddFilesForUpload", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        let executeRemoteSpy: MockInstance<<K extends keyof IRequestTypeMap>(requestType: K,
            parameter: IRequisitionCallbackValues<K>)=> boolean>;

        beforeEach(() => {
            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;

            executeRemoteSpy = vi.spyOn(requisitions, "executeRemote");
            appParameters.embedded = true;
        });

        afterEach(() => {
            vi.restoreAllMocks();
            appParameters.embedded = false;
            unmount();
        });

        it("should show open dialog with correct options", () => {
            navigatorRef.current!.handleAddFilesForUpload({} as MouseEvent);

            expect(executeRemoteSpy).toHaveBeenCalledWith("showOpenDialog", {
                id: "lakehouseFileUpload",
                title: "Add files for upload",
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: true,
                openLabel: "Add",
            });
        });
    });

    describe("selectFile", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        beforeEach(() => {
            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;

        });

        afterEach(() => {
            unmount();
        });

        it("should return false for non-matching resourceId", async () => {
            const result = await navigatorRef.current!.selectFile({
                resourceId: "wrongId",
                file: [],
            });

            expect(result).toBe(false);
        });

        it("should handle empty filesForUpload state", async () => {
            navigatorRef.current!.setState({ filesForUpload: undefined });

            const result = await navigatorRef.current!.selectFile({
                resourceId: "lakehouseFileUpload",
                file: [{ path: "file://path/to/file.txt", content: new ArrayBuffer(10) }],
            });

            expect(result).toBe(true);
            expect(navigatorRef.current!.state.filesForUpload).toEqual([
                { filePath: "path/to/file.txt", uploadComplete: false },
            ]);
        });

        it("should handle multiple file paths", async () => {
            const result = await navigatorRef.current!.selectFile({
                resourceId: "lakehouseFileUpload",
                file: [
                    { path: "file://path/to/file1.txt", content: new ArrayBuffer(10) },
                    { path: "file://path/to/file2.txt", content: new ArrayBuffer(10) },
                ],
            });

            expect(result).toBe(true);
            expect(navigatorRef.current!.state.filesForUpload).toEqual([
                { filePath: "path/to/file1.txt", uploadComplete: false },
                { filePath: "path/to/file2.txt", uploadComplete: false },
            ]);
        });

        it("should handle paths without file:// prefix", async () => {
            const result = await navigatorRef.current!.selectFile({
                resourceId: "lakehouseFileUpload",
                file: [
                    { path: "path/to/file1.txt", content: new ArrayBuffer(10) },
                    { path: "file://path/to/file2.txt", content: new ArrayBuffer(10) },
                ],
            });

            expect(result).toBe(true);
            expect(navigatorRef.current!.state.filesForUpload).toEqual([
                { filePath: "path/to/file1.txt", uploadComplete: false },
                { filePath: "path/to/file2.txt", uploadComplete: false },
            ]);
        });

        it("should handle URI encoded paths", async () => {
            const result = await navigatorRef.current!.selectFile({
                resourceId: "lakehouseFileUpload",
                file: [
                    { path: "file://path/to/file%20with%20spaces.txt", content: new ArrayBuffer(10) },
                ],
            });

            expect(result).toBe(true);
            expect(navigatorRef.current!.state.filesForUpload).toEqual([
                { filePath: "path/to/file with spaces.txt", uploadComplete: false },
            ]);
        });

        it("should not update state if no paths are provided", async () => {
            navigatorRef.current!.setState({ filesForUpload: undefined });

            const result = await navigatorRef.current!.selectFile({
                resourceId: "lakehouseFileUpload",
                file: [],
            });

            expect(result).toBe(true);
            expect(navigatorRef.current!.state.filesForUpload).toBeUndefined();
        });
    });

    describe("handlePaneResize", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        beforeEach(() => {
            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;
        });

        afterEach(() => {
            unmount();
        });

        it("should update newTaskPanelWidth state", async () => {
            const info = [{
                id: "newLoadTask",
                currentSize: 300,
            }];

            navigatorRef.current!.handlePaneResize(info);
            await nextProcessTick();

            expect(navigatorRef.current!.state.newTaskPanelWidth).toBe(300);
        });

        it("should update filesForUploadPanelWidth state", async () => {
            const info = [{
                id: "filesForUpload",
                currentSize: 400,
            }];

            navigatorRef.current!.handlePaneResize(info);
            await nextProcessTick();

            expect(navigatorRef.current!.state.filesForUploadPanelWidth).toBe(400);
        });

        it("should update taskListPanelHeight state", async () => {
            const info = [{
                id: "taskListPanel",
                currentSize: 500,
            }];

            navigatorRef.current!.handlePaneResize(info);
            await nextProcessTick();

            expect(navigatorRef.current!.state.taskListPanelHeight).toBe(500);
        });

        it("should handle multiple pane resizes at once", async () => {
            const info = [
                {
                    id: "newLoadTask",
                    currentSize: 300,
                },
                {
                    id: "filesForUpload",
                    currentSize: 400,
                },
                {
                    id: "taskListPanel",
                    currentSize: 500,
                },
            ];

            navigatorRef.current!.handlePaneResize(info);
            await nextProcessTick();

            expect(navigatorRef.current!.state.newTaskPanelWidth).toBe(300);
            expect(navigatorRef.current!.state.filesForUploadPanelWidth).toBe(400);
            expect(navigatorRef.current!.state.taskListPanelHeight).toBe(500);
        });

        it("should ignore unknown pane ids", async () => {
            const info = [
                {
                    id: "unknownPane",
                    currentSize: 300,
                },
            ];

            const initialState = { ...navigatorRef.current!.state };
            navigatorRef.current!.handlePaneResize(info);
            await nextProcessTick();

            expect(navigatorRef.current!.state).toEqual(initialState);
        });

        it("should handle empty info array", async () => {
            const initialState = { ...navigatorRef.current!.state };
            navigatorRef.current!.handlePaneResize([]);
            await nextProcessTick();

            expect(navigatorRef.current!.state).toEqual(initialState);
        });
    });

    describe("showConfirmDlg", () => {
        const navigatorRef = createRef<TestLakehouseNavigator>();
        let unmount: () => boolean;

        let showDialogSpy: MockInstance<(request: IDialogRequest) => Promise<IDialogResponse>>;

        beforeEach(() => {
            const result = render(
                <LakehouseNavigator ref={navigatorRef} {...props} />,
            );
            unmount = result.unmount;
            showDialogSpy = vi.spyOn(DialogHost, "showDialog");
        });

        afterEach(() => {
            vi.restoreAllMocks();
            unmount();
        });

        it("should show dialog with correct parameters", async () => {
            showDialogSpy.mockResolvedValue(
                { closure: DialogResponseClosure.Accept, id: "1", type: DialogType.Confirm });

            await navigatorRef.current!.showConfirmDlg("Test Title", "Test Prompt");

            expect(showDialogSpy).toHaveBeenCalledWith({
                id: "commitOrCancelChanges",
                type: DialogType.Confirm,
                parameters: {
                    title: "Test Title",
                    prompt: "Test Prompt",
                    accept: "Yes",
                    refuse: "No",
                    default: "Yes",
                },
            });
        });

        it("should return true when user accepts", async () => {
            showDialogSpy.mockResolvedValue(
                { closure: DialogResponseClosure.Accept, id: "1", type: DialogType.Confirm });

            const result = await navigatorRef.current!.showConfirmDlg("Test Title", "Test Prompt");

            expect(result).toBe(true);
        });

        it("should return false when dialog is cancelled", async () => {
            showDialogSpy.mockResolvedValue(
                { closure: DialogResponseClosure.Decline, id: "1", type: DialogType.Confirm });

            const result = await navigatorRef.current!.showConfirmDlg("Test Title", "Test Prompt");

            expect(result).toBe(false);
        });

        it("should handle dialog error", async () => {
            showDialogSpy.mockRejectedValue(new Error("Dialog error"));

            await expect(navigatorRef.current!.showConfirmDlg("Test Title", "Test Prompt"))
                .rejects.toThrow("Dialog error");
        });
    });

});
