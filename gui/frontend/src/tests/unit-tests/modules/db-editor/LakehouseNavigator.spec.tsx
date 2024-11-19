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

/* eslint-disable dot-notation */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { mount, shallow } from "enzyme";
import { CellComponent, RowComponent } from "tabulator-tables";
import { DialogHost } from "../../../../app-logic/DialogHost.js";
import { DialogResponseClosure, DialogType } from "../../../../app-logic/general-types.js";
import { CheckState } from "../../../../components/ui/Checkbox/Checkbox.js";
import {
    ILakehouseNavigatorProperties, ILakehouseNavigatorSavedState, ILakehouseNavigatorState, ILakehouseTable,
    ILakehouseTask, ILakehouseTaskItem, IObjectStorageTreeItem, LakehouseNavigator, LakehouseNavigatorTab,
    ObjectStorageTreeItemType,
} from "../../../../modules/db-editor/LakehouseNavigator.js";
import { appParameters, requisitions } from "../../../../supplement/Requisitions.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { nextProcessTick } from "../../test-helpers.js";

describe("LakehouseNavigator tests", () => {
    const backend = new ShellInterfaceSqlEditor();

    const savedState: ILakehouseNavigatorSavedState = {
        activeTabId: LakehouseNavigatorTab.Overview,
        objTreeItems: [],
        lakehouseTables: [],
        lakehouseTablesHash: "hash1",
        lakehouseTasks: [],
        lakehouseTasksHash: "hash2",
    };

    const props: ILakehouseNavigatorProperties = {
        savedState,
        backend,
        toolbarItems: {
            navigation: [],
            execution: [],
            editor: [],
            auxillary: [],
        },
        onLakehouseNavigatorStateChange: jest.fn(),
    };

    it("Test LakehouseNavigator instantiation", () => {
        const component = shallow<LakehouseNavigator>(
            <LakehouseNavigator
                {...props}
            />,
        );

        const instance = component.instance();

        expect(instance.state.autoRefreshTablesAndTasks).toBe(true);

        expect(component).toMatchSnapshot();
        component.unmount();
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

    it("Test componentDidMount", () => {
        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        const originalUpdateValues = component.instance()["updateValues"];
        const originalUpdateObjStorageTreeGrid = component.instance()["updateObjStorageTreeGrid"];
        const originalUpdateLakehouseTablesTreeGrid = component.instance()["updateLakehouseTablesTreeGrid"];
        const originalUpdateLakehouseTasksTreeGrid = component.instance()["updateLakehouseTasksTreeGrid"];
        const instance = component.instance();

        const spyUpdateValues = jest.fn();
        const spyUpdateObjStorageTreeGrid = jest.fn();
        const spyUpdateLakehouseTablesTreeGrid = jest.fn();
        const spyUpdateLakehouseTasksTreeGrid = jest.fn();

        instance["updateValues"] = spyUpdateValues;
        instance["updateObjStorageTreeGrid"] = spyUpdateObjStorageTreeGrid;
        instance["updateLakehouseTablesTreeGrid"] = spyUpdateLakehouseTablesTreeGrid;
        instance["updateLakehouseTasksTreeGrid"] = spyUpdateLakehouseTasksTreeGrid;

        instance.componentDidMount();

        expect(spyUpdateValues).toHaveBeenCalled();
        expect(spyUpdateObjStorageTreeGrid).toHaveBeenCalled();
        expect(spyUpdateLakehouseTablesTreeGrid).toHaveBeenCalled();
        expect(spyUpdateLakehouseTasksTreeGrid).toHaveBeenCalled();

        instance["updateValues"] = originalUpdateValues;
        instance["updateObjStorageTreeGrid"] = originalUpdateObjStorageTreeGrid;
        instance["updateLakehouseTablesTreeGrid"] = originalUpdateLakehouseTablesTreeGrid;
        instance["updateLakehouseTasksTreeGrid"] = originalUpdateLakehouseTasksTreeGrid;

        component.unmount();
    });

    it("Test componentWillUnmount", () => {
        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        const instance = component.instance();
        const spyOnLakehouseNavigatorStateChange = jest.spyOn(props, "onLakehouseNavigatorStateChange");

        instance.componentWillUnmount();

        expect(spyOnLakehouseNavigatorStateChange).toHaveBeenCalledWith({
            activeTabId: LakehouseNavigatorTab.Overview,
            autoRefreshTablesAndTasks: true,
            lakehouseTables: [],
            lakehouseTablesHash: "hash1",
            lakehouseTasks: [],
            lakehouseTasksHash: "hash2",
            objTreeItems: [],
        });

        component.unmount();
    });

    it("Test componentDidUpdate", () => {
        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        const spyUpdateValues = jest.fn();
        const spyRefreshObjTreeItems = jest.fn();

        const instance = component.instance();
        const originalUpdateValues = instance["updateValues"];
        const originalRefreshObjTreeItems = instance["refreshObjTreeItems"];
        instance["updateValues"] = spyUpdateValues;
        instance["refreshObjTreeItems"] = spyRefreshObjTreeItems;

        const prevProps = { ...props, backend: {} };
        const prevState = { ...instance.state, activeProfile: { profile: "oldProfile" } };

        instance.componentDidUpdate(
            prevProps as ILakehouseNavigatorProperties,
            prevState as ILakehouseNavigatorState,
        );

        expect(spyUpdateValues).toHaveBeenCalled();
        expect(spyRefreshObjTreeItems).toHaveBeenCalled();

        instance["updateValues"] = originalUpdateValues;
        instance["refreshObjTreeItems"] = originalRefreshObjTreeItems;

        component.unmount();
    });

    it("Test getUploadTabContent with files for upload", () => {
        const state = {
            filesForUpload: [
                { filePath: "file1.txt", fileSize: 1000, bytesUploadedTotal: 500, uploadComplete: false },
                { filePath: "file2.txt", fileSize: 2000, bytesUploadedTotal: 2000, uploadComplete: true },
            ],
            lastFileUploadError: null,
            uploadTarget: { data: { type: "Bucket", name: "bucket1" } },
            uploadRunning: false,
            uploadComplete: false,
            filesForUploadPanelWidth: 400,
            fileUploadTargetPath: "path/to/upload",
        };

        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        component.setState(state as unknown as ILakehouseNavigatorState);

        const content = component.instance()["getUploadTabContent"]();
        expect(content).toMatchSnapshot();

        let cmp = component.find(".filesForUploadPanel");
        expect(cmp).toBeDefined();

        cmp = component.find(".uploadTarget");
        expect(cmp).toBeDefined();

        component.unmount();
    });

    it("Test getUploadTabContent with no files for upload", () => {
        const state = {
            filesForUpload: [],
            lastFileUploadError: null,
            uploadTarget: { data: { type: "Bucket", name: "bucket1" } },
            uploadRunning: false,
            uploadComplete: false,
            filesForUploadPanelWidth: 400,
            fileUploadTargetPath: "path/to/upload",
        };

        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        component.setState(state as unknown as ILakehouseNavigatorState);

        const content = component.instance()["getUploadTabContent"]();
        expect(content).toMatchSnapshot();

        let cmp = component.find(".filesForUploadPanel");
        expect(cmp).not.toBeUndefined();

        cmp = component.find(".uploadTarget");
        expect(cmp).not.toBeUndefined();

        component.unmount();
    });

    it("Test getUploadTabContent with upload error", () => {
        const state = {
            filesForUpload: [],
            lastFileUploadError: "Upload failed",
            uploadTarget: { data: { type: "Bucket", name: "bucket1" } },
            uploadRunning: false,
            uploadComplete: false,
            filesForUploadPanelWidth: 400,
            fileUploadTargetPath: "path/to/upload",
        };

        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        component.setState(state as unknown as ILakehouseNavigatorState);

        const content = component.instance()["getUploadTabContent"]();
        expect(content).toMatchSnapshot();

        let cmp = component.find(".filesForUploadPanel");
        expect(cmp).not.toBeUndefined();

        cmp = component.find(".uploadTarget");
        expect(cmp).not.toBeUndefined();

        component.unmount();
    });

    it("Test getObjectStoreBrowserContent with active profile and profiles", () => {
        const state = {
            activeProfile: { profile: "testProfile" },
            profiles: [{ profile: "testProfile" }, { profile: "anotherProfile" }],
        };

        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        component.setState(state as unknown as ILakehouseNavigatorState);

        const content = component.instance()["getObjectStoreBrowserContent"]();
        expect(content).toMatchSnapshot();

        const cmp = component.find(".objectStoreBrowserPanel");
        expect(cmp).toBeDefined();

        component.unmount();
    });

    it("Test getObjectStoreBrowserContent with no active profile", () => {
        const state = {
            activeProfile: undefined,
            profiles: [{ profile: "testProfile" }, { profile: "anotherProfile" }],
        };

        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        component.setState(state as unknown as ILakehouseNavigatorState);

        const content = component.instance()["getObjectStoreBrowserContent"]();
        expect(content).toMatchSnapshot();

        let cmp = component.find(".objectStoreBrowserPanel");
        expect(cmp).toBeDefined();

        cmp = component.find(".activeProfile");
        expect(cmp).toBeDefined();

        component.unmount();
    });

    it("Test getObjectStoreBrowserContent with no profiles", () => {
        const state = {
            activeProfile: undefined,
            profiles: [],
        };

        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        component.setState(state);

        const content = component.instance()["getObjectStoreBrowserContent"]();
        expect(content).toMatchSnapshot();

        const cmp = component.find(".objectStoreBrowserPanel");
        expect(cmp).toBeDefined();

        component.unmount();
    });

    it("Test getLoadTabContent with task items", () => {
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

        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        component.setState(state as unknown as ILakehouseNavigatorState);

        const content = component.instance()["getLoadTabContent"]();
        expect(content).toMatchSnapshot();

        let cmp = component.find(".newTaskPanel");
        expect(cmp).toBeDefined();

        cmp = component.find(".taskItems");
        expect(cmp).toBeDefined();

        component.unmount();
    });

    it("Test getLoadTabContent with no task items", () => {
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

        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        component.setState(state as unknown as ILakehouseNavigatorState);

        const content = component.instance()["getLoadTabContent"]();
        expect(content).toMatchSnapshot();

        const cmp = component.find(".newTaskPanel");
        expect(cmp).toBeDefined();

        component.unmount();
    });

    it("Test getLoadTabContent with task schedule error", () => {
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

        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        component.setState(state);

        const content = component.instance()["getLoadTabContent"]();
        expect(content).toMatchSnapshot();

        const cmp = component.find(".newTaskPanel");
        expect(cmp).toBeDefined();

        component.unmount();
    });

    it("Test getTablesAndTasksTabContent with tables and tasks", () => {
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

        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        component.setState(state);

        const content = component.instance()["getTablesAndTasksTabContent"]();
        expect(content).toMatchSnapshot();

        let cmp = component.find(".tablesAndTasksPanel");
        expect(cmp).toBeDefined();

        cmp = component.find(".taskList");
        expect(cmp).toBeDefined();

        component.unmount();
    });

    it("Test getTablesAndTasksTabContent with no tables and tasks", () => {
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
        };

        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        component.setState(state);

        const content = component.instance()["getTablesAndTasksTabContent"]();
        expect(content).toMatchSnapshot();

        const cmp = component.find(".tablesAndTasksPanel");
        expect(cmp).toBeDefined();

        component.unmount();
    });

    it("Test getTablesAndTasksTabContent with error", () => {
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

        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        component.setState(state);

        const content = component.instance()["getTablesAndTasksTabContent"]();
        expect(content).toMatchSnapshot();

        let cmp = component.find(".tablesAndTasksPanel");
        expect(cmp).toBeDefined();

        cmp = component.find(".taskList");
        expect(cmp).toBeDefined();

        component.unmount();
    });

    it("Test refreshAvailableDatabaseSchemas with valid schemas", () => {
        const mockGetCatalogObjects = jest.spyOn(backend, "getCatalogObjects").mockResolvedValue([
            "mysql", "sys", "information_schema", "performance_schema", "testSchema1", "testSchema2",
        ]);

        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        const instance = component.instance();

        instance["refreshAvailableDatabaseSchemas"]();

        expect(mockGetCatalogObjects).toHaveBeenCalledWith("Schema");
        mockGetCatalogObjects.mockRestore();

        component.unmount();
    });

    it("Test refreshAvailableDatabaseSchemas with backend error", () => {
        const mockGetCatalogObjects = jest.spyOn(backend, "getCatalogObjects")
            .mockRejectedValue(new Error("Backend error"));
        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} backend={backend} />,
        );

        component.instance()["refreshAvailableDatabaseSchemas"]();

        expect(component.state("availableDatabaseSchemas")).toBeUndefined();

        expect(mockGetCatalogObjects).toHaveBeenCalledWith("Schema");
        mockGetCatalogObjects.mockRestore();

        component.unmount();
    });

    it("Test handleSelectTab with valid tab id", () => {
        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        const instance = component.instance();

        const mockSetState = jest.spyOn(instance, "setState");

        instance["handleSelectTab"](LakehouseNavigatorTab.Upload);

        expect(mockSetState).toHaveBeenCalledWith({ activeTabId: LakehouseNavigatorTab.Upload });
        mockSetState.mockRestore();

        component.unmount();
    });

    it("Test updateValues with undefined activeSchema and profiles", async () => {
        const mockExecute = jest.spyOn(backend, "execute").mockResolvedValue({ rows: [["testSchema"]] });
        const mockGetMdsConfigProfiles = jest.spyOn(backend.mhs, "getMdsConfigProfiles")
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
            savedState: { activeTabId: LakehouseNavigatorTab.Overview, activeSchema: undefined },
        };

        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...newProps} />,
        );

        const instance = component.instance();

        const mockSetState = jest.spyOn(instance, "setState");

        await instance["updateValues"]();

        expect(mockExecute).toHaveBeenNthCalledWith(1, "SELECT DATABASE()");
        expect(mockExecute).toHaveBeenNthCalledWith(2, "SELECT DATABASE()");
        expect(mockSetState).toHaveBeenCalled();

        mockSetState.mockRestore();
        mockExecute.mockRestore();
        mockGetMdsConfigProfiles.mockRestore();

        component.unmount();
    });

    it("Test updateValues with defined activeSchema and undefined profiles", async () => {
        const mockExecute = jest.spyOn(backend, "execute").mockResolvedValue({ rows: [["testSchema"]] });
        const mockGetMdsConfigProfiles = jest.spyOn(backend.mhs, "getMdsConfigProfiles")
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
            savedState: { activeTabId: LakehouseNavigatorTab.Overview, activeSchema: "savedSchema" },
        };

        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...newProps} />,
        );

        const instance = component.instance();

        const mockSetState = jest.spyOn(instance, "setState");

        await instance["updateValues"]();

        expect(mockExecute).toHaveBeenCalledTimes(0);
        expect(mockSetState).toHaveBeenCalled();

        mockSetState.mockRestore();
        mockExecute.mockRestore();
        mockGetMdsConfigProfiles.mockRestore();

        component.unmount();
    });

    it("Test onStartUploadClick", () => {
        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        const instance = component.instance();

        const mockSetState = jest.spyOn(instance, "setState").mockImplementation();

        instance["onStartUploadClick"]();

        expect(mockSetState).toHaveBeenCalledWith({ activeTabId: LakehouseNavigatorTab.Upload });
        mockSetState.mockRestore();

        component.unmount();
    });

    it("Test onStartLoadClick", () => {
        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        const instance = component.instance();

        const mockSetState = jest.spyOn(instance, "setState").mockImplementation();

        instance["onStartLoadClick"]();

        expect(mockSetState).toHaveBeenCalledWith({ activeTabId: LakehouseNavigatorTab.Load });
        mockSetState.mockRestore();

        component.unmount();
    });

    it("Test onManageClick sets the active tab to Manage", () => {
        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        const instance = component.instance();

        const mockSetState = jest.spyOn(instance, "setState").mockImplementation();

        instance["onManageClick"]();

        expect(mockSetState).toHaveBeenCalledWith({ activeTabId: LakehouseNavigatorTab.Manage });
        mockSetState.mockRestore();

        component.unmount();
    });

    it("Test handleProfileSelection with empty profile set", () => {
        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        const instance = component.instance();
        const profiles = [{ profile: "testProfile" }, { profile: "anotherProfile" }];
        component.setState({ profiles } as ILakehouseNavigatorState);

        instance["handleProfileSelection"](true, new Set());

        expect(component.state("activeProfile")).toBeUndefined();

        component.unmount();
    });

    it("Test handleSchemaSelection with valid schema id", () => {
        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        const instance = component.instance();
        const state = {
            task: {
                schemaName: "oldSchema",
            },
            activeSchema: "oldSchema",
        };
        component.setState(state);

        const schemaId = "newSchema";
        instance["handleSchemaSelection"](true, new Set([schemaId]));

        expect(component.state("task")!.schemaName).toBe(schemaId);
        expect(component.state("activeSchema")).toBe(schemaId);

        component.unmount();
    });

    it("Test handleSchemaSelection with empty schema id", () => {
        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        const instance = component.instance();
        const state = {
            task: {
                schemaName: "oldSchema",
            },
            activeSchema: "oldSchema",
        };
        component.setState(state);

        instance["handleSchemaSelection"](true, new Set());

        expect(component.state("task")!.schemaName).toBe(undefined);
        expect(component.state("activeSchema")).toBe(undefined);

        component.unmount();
    });

    it("Test handleFormatSelection with valid format id", () => {
        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        const instance = component.instance();
        const state = {
            task: {
                activeFormat: undefined,
            },
        };
        component.setState(state);

        const mockSetState = jest.spyOn(instance, "setState").mockImplementation();

        const ids = new Set<string>(["pdf"]);
        instance["handleFormatSelection"](true, ids);

        expect(mockSetState).toHaveBeenCalledWith({
            task: {
                activeFormat: "pdf",
            },
        });
        mockSetState.mockRestore();

        component.unmount();
    });

    it("Test handleFormatSelection with 'all' format id", () => {
        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        const instance = component.instance();
        const state = {
            task: {
                activeFormat: "pdf",
            },
        };
        component.setState(state);

        const mockSetState = jest.spyOn(instance, "setState").mockImplementation();

        const ids = new Set<string>(["all"]);
        instance["handleFormatSelection"](true, ids);

        expect(mockSetState).toHaveBeenCalledWith({
            task: {
                activeFormat: undefined,
            },
        });
        mockSetState.mockRestore();

        component.unmount();
    });

    it("Test handleLanguageSelection with valid language ID", () => {
        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        const instance = component.instance();
        const state = {
            task: {
                languageId: undefined,
            },
        };
        component.setState(state);
        const mockSetState = jest.spyOn(instance, "setState").mockImplementation();

        const ids = new Set<string>(["fr"]);
        instance["handleLanguageSelection"](true, ids);

        expect(mockSetState).toHaveBeenCalledWith({
            task: {
                languageId: "fr",
            },
        });
        mockSetState.mockRestore();

        component.unmount();
    });

    it("Test handleLanguageSelection with default language ID", () => {
        const component = mount<LakehouseNavigator>(
            <LakehouseNavigator {...props} />,
        );

        const instance = component.instance();
        const state = {
            task: {
                languageId: "fr",
            },
        };
        component.setState(state);

        const mockSetState = jest.spyOn(instance, "setState").mockImplementation();

        const ids = new Set<string>(["en"]);
        instance["handleLanguageSelection"](true, ids);

        expect(mockSetState).toHaveBeenCalledWith({
            task: {
                languageId: undefined,
            },
        });
        mockSetState.mockRestore();

        component.unmount();
    });

    describe("objectStoreTreeGridCaptionColumnFormatter tests", () => {
        let instance: LakehouseNavigator;

        beforeEach(() => {
            const props = {
                savedState,
                backend,
                toolbarItems: {
                    navigation: [],
                    execution: [],
                    editor: [],
                    auxillary: [],
                },
                onLakehouseNavigatorStateChange: jest.fn(),
            };

            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );

            instance = component.instance();
        });

        it("should format compartment item correctly", () => {
            const cell = {
                getData: jest.fn().mockReturnValue({
                    data: { type: ObjectStorageTreeItemType.Compartment, isCurrent: true, name: "Compartment" },
                }),
                getColumn: jest.fn(),
            } as unknown as CellComponent;

            const result = instance["objectStoreTreeGridCaptionColumnFormatter"](cell);

            expect((result as HTMLElement).querySelector(".itemCaption")?.textContent).toBe("Compartment");
        });

        it("should format bucket item correctly", () => {
            const cell = {
                getData: jest.fn().mockReturnValue({
                    data: { type: ObjectStorageTreeItemType.Bucket, name: "Bucket" },
                }),
                getColumn: jest.fn(),
            } as unknown as CellComponent;

            const result = instance["objectStoreTreeGridCaptionColumnFormatter"](cell);

            expect((result as HTMLElement).querySelector(".itemCaption")?.textContent).toBe("Bucket");
        });

        it("should format prefix item correctly", () => {
            const cell = {
                getData: jest.fn().mockReturnValue({
                    data: { type: ObjectStorageTreeItemType.Prefix, name: "prefix/" },
                }),
                getColumn: jest.fn(),
            } as unknown as CellComponent;

            const result = instance["objectStoreTreeGridCaptionColumnFormatter"](cell);

            expect((result as HTMLElement).querySelector(".itemCaption")?.textContent).toBe("prefix");
        });

        it("should format file item correctly", () => {
            const cell = {
                getData: jest.fn().mockReturnValue({
                    data: { type: ObjectStorageTreeItemType.File, name: "file.txt" },
                }),
                getColumn: jest.fn(),
            } as unknown as CellComponent;

            const result = instance["objectStoreTreeGridCaptionColumnFormatter"](cell);

            expect((result as HTMLElement).querySelector(".itemCaption")?.textContent).toBe("file.txt");
        });

        it("should format placeholder item correctly", () => {
            const cell = {
                getData: jest.fn().mockReturnValue({
                    data: { type: ObjectStorageTreeItemType.Placeholder },
                }),
                getColumn: jest.fn(),
            } as unknown as CellComponent;

            const result = instance["objectStoreTreeGridCaptionColumnFormatter"](cell);

            expect((result as HTMLElement).querySelector(".itemCaption")?.textContent).toBe("Loading ...");
        });

        it("should format error item correctly", () => {
            const cell = {
                getData: jest.fn().mockReturnValue({
                    data: { type: ObjectStorageTreeItemType.Error, name: "Error" },
                }),
                getColumn: jest.fn(),
            } as unknown as CellComponent;

            const result = instance["objectStoreTreeGridCaptionColumnFormatter"](cell);

            expect((result as HTMLElement).querySelector(".itemCaption")?.textContent).toBe("Error");
        });
    });

    describe("objectStoreTreeGridColumnFormatter tests", () => {
        let instance: LakehouseNavigator;
        let cell: CellComponent;
        let onRendered: jest.Mock;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
            cell = {
                getData: jest.fn(),
                getColumn: jest.fn(),
                getElement: jest.fn(),
            } as unknown as CellComponent;
            onRendered = jest.fn((callback) => { return callback(); });
        });

        it("should format file size correctly", () => {
            const fileData = {
                data: {
                    type: ObjectStorageTreeItemType.File,
                    size: 1024,
                },
            } as unknown as IObjectStorageTreeItem;

            cell.getData = jest.fn().mockReturnValue(fileData);
            cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "size"; } });
            const element = document.createElement("div");
            cell.getElement = jest.fn().mockReturnValue(element);

            const result = instance["objectStoreTreeGridColumnFormatter"](cell, {}, onRendered);

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

            cell.getData = jest.fn().mockReturnValue(dirData);
            cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "size"; } });
            const element = document.createElement("div");
            cell.getElement = jest.fn().mockReturnValue(element);

            const result = instance["objectStoreTreeGridColumnFormatter"](cell, {}, onRendered);

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

            cell.getData = jest.fn().mockReturnValue(fileData);
            cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "modified"; } });
            const element = document.createElement("div");
            cell.getElement = jest.fn().mockReturnValue(element);

            const result = instance["objectStoreTreeGridColumnFormatter"](cell, {}, onRendered);

            expect(result).toMatch(/01\/15\/24.*14:30/);
            expect(element.classList.contains("modifiedField")).toBe(true);
        });

        it("should show dash for placeholder modified date", () => {
            const dirData = {
                data: {
                    type: ObjectStorageTreeItemType.Placeholder,
                },
            } as IObjectStorageTreeItem;

            cell.getData = jest.fn().mockReturnValue(dirData);
            cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "modified"; } });
            const element = document.createElement("div");
            cell.getElement = jest.fn().mockReturnValue(element);

            const result = instance["objectStoreTreeGridColumnFormatter"](cell, {}, onRendered);

            expect(result).toBe("-");
            expect(element.classList.contains("modifiedField")).toBe(true);
        });

        it("should handle unknown column field", () => {
            const fileData = {
                data: {
                    type: ObjectStorageTreeItemType.File,
                },
            } as IObjectStorageTreeItem;

            cell.getData = jest.fn().mockReturnValue(fileData);
            cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "unknown"; } });
            const element = document.createElement("div");
            cell.getElement = jest.fn().mockReturnValue(element);

            const result = instance["objectStoreTreeGridColumnFormatter"](cell, {}, onRendered);

            expect(result).toBe("-");
            expect(onRendered).toHaveBeenCalled();
        });
    });

    describe("schemasTreeGridColumnFormatter tests", () => {
        let instance: LakehouseNavigator;

        beforeEach(() => {
            const props = {
                savedState,
                backend,
                toolbarItems: {
                    navigation: [],
                    execution: [],
                    editor: [],
                    auxillary: [],
                },
                onLakehouseNavigatorStateChange: jest.fn(),
            };

            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );

            instance = component.instance();
        });

        it("should format schema name correctly", () => {
            const schemaName = "testSchema";
            const cell = {
                getData: jest.fn().mockReturnValue({ schemaName }),
                getColumn: jest.fn().mockReturnValue({ getField: () => { return "schemaName"; } }),
            } as unknown as CellComponent;

            const result = instance["schemasTreeGridColumnFormatter"](cell, {}, jest.fn());

            expect(result).toBe(schemaName);
        });

        it("should add correct class to the cell element", () => {
            const schemaName = "testSchema";
            const cell = {
                getData: jest.fn().mockReturnValue({ schemaName }),
                getColumn: jest.fn().mockReturnValue({ getField: () => { return "schemaName"; } }),
            } as unknown as CellComponent;

            const onRendered = jest.fn((callback) => { return callback(); });
            const cellElement = document.createElement("div");
            cell.getElement = jest.fn().mockReturnValue(cellElement);

            instance["schemasTreeGridColumnFormatter"](cell, {}, onRendered);

            expect(cellElement.classList.contains("tableField")).toBe(true);
            expect(cellElement.classList.contains("schemaNameField")).toBe(true);
        });
    });

    describe("tablesTreeGridRowFormatter tests", () => {
        let instance: LakehouseNavigator;
        let row: RowComponent;
        let element: HTMLElement;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
            element = document.createElement("div");
            row = {
                getData: jest.fn(),
                getElement: jest.fn().mockReturnValue(element),
            } as unknown as RowComponent;
        });

        it("should add notLoaded class when table is not loaded and progress is 0", () => {
            const rowData = {
                loaded: false,
                progress: 0,
            } as ILakehouseTable;

            row.getData = jest.fn().mockReturnValue(rowData);

            instance["tablesTreeGridRowFormatter"](row);

            expect(element.classList.contains("notLoaded")).toBe(true);
            expect(element.classList.contains("loading")).toBe(false);
            expect(element.classList.contains("loaded")).toBe(false);
        });

        it("should add loading class when table is not loaded but has progress", () => {
            const rowData = {
                loaded: false,
                progress: 50,
            } as ILakehouseTable;

            row.getData = jest.fn().mockReturnValue(rowData);

            instance["tablesTreeGridRowFormatter"](row);

            expect(element.classList.contains("notLoaded")).toBe(false);
            expect(element.classList.contains("loading")).toBe(true);
            expect(element.classList.contains("loaded")).toBe(false);
        });

        it("should add loaded class when table is loaded", () => {
            const rowData = {
                loaded: true,
                progress: 100,
            } as ILakehouseTable;

            row.getData = jest.fn().mockReturnValue(rowData);

            instance["tablesTreeGridRowFormatter"](row);

            expect(element.classList.contains("notLoaded")).toBe(false);
            expect(element.classList.contains("loading")).toBe(false);
            expect(element.classList.contains("loaded")).toBe(true);
        });
    });

    describe("tablesTreeGridColumnFormatter tests", () => {
        let instance: LakehouseNavigator;
        let cell: CellComponent;
        let onRendered: jest.Mock;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
            const element = document.createElement("div");
            cell = {
                getData: jest.fn(),
                getColumn: jest.fn(),
                getElement: jest.fn().mockReturnValue(element),
            } as unknown as CellComponent;
            onRendered = jest.fn((callback) => { return callback(); });
        });

        it("should format tableName column for loaded table", () => {
            const cellData = {
                tableName: "test_table",
                loaded: true,
                progress: 100,
            } as ILakehouseTable;

            cell.getData = jest.fn().mockReturnValue(cellData);
            cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "tableName"; } });

            const result = instance["tablesTreeGridColumnFormatter"](cell, {}, onRendered) as HTMLElement;

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

            cell.getData = jest.fn().mockReturnValue(cellData);
            cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "tableName"; } });

            const result = instance["tablesTreeGridColumnFormatter"](cell, {}, onRendered) as HTMLElement;

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

            cell.getData = jest.fn().mockReturnValue(cellData);
            cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "rows"; } });

            const result = instance["tablesTreeGridColumnFormatter"](cell, {}, onRendered);

            expect(result).toBe("1.2m");
            expect(cell.getElement().classList.contains("sizeField")).toBe(true);
        });

        it("should format dataLength column", () => {
            const cellData = {
                dataLength: 1024 * 1024, // 1MB
            } as ILakehouseTable;

            cell.getData = jest.fn().mockReturnValue(cellData);
            cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "dataLength"; } });

            const result = instance["tablesTreeGridColumnFormatter"](cell, {}, onRendered);

            expect(result).toBe("1.00 MB");
            expect(cell.getElement().classList.contains("sizeField")).toBe(true);
        });

        it("should format lastChange column", () => {
            const cellData = {
                lastChange: "2024-01-15 14:30:00",
            } as ILakehouseTable;

            cell.getData = jest.fn().mockReturnValue(cellData);
            cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "lastChange"; } });

            const result = instance["tablesTreeGridColumnFormatter"](cell, {}, onRendered);

            expect(result).toBe("2024-01-15 14:30:00");
            expect(cell.getElement().classList.contains("dateField")).toBe(true);
        });

        it("should format comment column", () => {
            const cellData = {
                comment: "Test comment",
            } as ILakehouseTable;

            cell.getData = jest.fn().mockReturnValue(cellData);
            cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "comment"; } });

            const result = instance["tablesTreeGridColumnFormatter"](cell, {}, onRendered);

            expect(result).toBe("Test comment");
            expect(cell.getElement().classList.contains("commentField")).toBe(true);
        });

        it("should handle empty rows value", () => {
            const cellData = {
                rows: 0,
            } as ILakehouseTable;

            cell.getData = jest.fn().mockReturnValue(cellData);
            cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "rows"; } });

            const result = instance["tablesTreeGridColumnFormatter"](cell, {}, onRendered);

            expect(result).toBe("-");
            expect(cell.getElement().classList.contains("sizeField")).toBe(true);
        });

        it("should handle empty dataLength value", () => {
            const cellData = {
                dataLength: 0,
            } as ILakehouseTable;

            cell.getData = jest.fn().mockReturnValue(cellData);
            cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "dataLength"; } });

            const result = instance["tablesTreeGridColumnFormatter"](cell, {}, onRendered);

            expect(result).toBe("-");
            expect(cell.getElement().classList.contains("sizeField")).toBe(true);
        });
    });

    describe("taskTreeGridRowFormatter tests", () => {
        let instance: LakehouseNavigator;
        let row: RowComponent;
        let element: HTMLElement;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
            element = document.createElement("div");
            row = {
                getData: jest.fn(),
                getElement: jest.fn().mockReturnValue(element),
            } as unknown as RowComponent;
        });

        it("should not add error class for task with non-ERROR status", () => {
            const rowData = {
                status: "SUCCESS",
                type: "TASK",
            } as ILakehouseTask;

            row.getData = jest.fn().mockReturnValue(rowData);

            instance["taskTreeGridRowFormatter"](row);

            expect(element.classList.contains("error")).toBe(false);
        });

        it("should not add any classes for task item", () => {
            const rowData = {
                type: "TASK_ITEM",
            } as unknown as ILakehouseTaskItem;

            row.getData = jest.fn().mockReturnValue(rowData);

            instance["taskTreeGridRowFormatter"](row);

            expect(element.classList.length).toBe(0);
        });
    });

    describe("taskTreeGridColumnFormatter tests", () => {
        let instance: LakehouseNavigator;
        let cell: CellComponent;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
            cell = {
                getData: jest.fn(),
                getColumn: jest.fn(),
                getElement: jest.fn(),
                getRow: jest.fn(),
            } as unknown as CellComponent;
        });

        describe("Task Item formatting", () => {
            it("should format title column for task", () => {
                const taskData = {
                    type: "TASK",
                    title: "Test Task",
                    status: "RUNNING",
                    description: "Task description",
                } as ILakehouseTask;

                cell.getData = jest.fn().mockReturnValue(taskData);
                cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "title"; } });

                const result = instance["taskTreeGridColumnFormatter"](cell) as HTMLElement;

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

                cell.getData = jest.fn().mockReturnValue(taskItemData);
                cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "title"; } });
                cell.getRow = jest.fn().mockReturnValue({
                    getTreeParent: () => {
                        return {
                            getData: parentTask,
                        };
                    },
                });

                const result = instance["taskTreeGridColumnFormatter"](cell) as HTMLElement;

                expect(result.classList.contains("itemField")).toBe(true);
                expect(result.textContent).toContain("test_schema.test_table");
            });

            it("should format status column for task item", () => {
                const taskItemData = {
                    type: "TASK_ITEM",
                    progress: 75,
                } as unknown as ILakehouseTaskItem;

                cell.getData = jest.fn().mockReturnValue(taskItemData);
                cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "status"; } });

                const result = instance["taskTreeGridColumnFormatter"](cell) as HTMLElement;

                expect(result.classList.contains("itemField")).toBe(true);
                expect(result.textContent).toBe("75%");
            });

            it("should format description column for task item", () => {
                const taskItemData = {
                    type: "TASK_ITEM",
                    uri: "s3://bucket/path/to/file",
                } as unknown as ILakehouseTaskItem;

                cell.getData = jest.fn().mockReturnValue(taskItemData);
                cell.getColumn = jest.fn().mockReturnValue({ getField: () => { return "description"; } });

                const result = instance["taskTreeGridColumnFormatter"](cell) as HTMLElement;

                expect(result.classList.contains("itemField")).toBe(true);
                expect(result.textContent).toBe("s3://bucket/path/to/file");
            });
        });
    });

    describe("Object Tree Row Handling", () => {
        let instance: LakehouseNavigator;
        let row: RowComponent;
        let getObjectStorageTreeChildrenSpy: jest.SpyInstance;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
            row = {
                getData: jest.fn(),
                update: jest.fn(),
            } as unknown as RowComponent;

            getObjectStorageTreeChildrenSpy = jest.spyOn(instance as any, "getObjectStorageTreeChildren")
                .mockResolvedValue([]);
        });

        afterEach(() => {
            getObjectStorageTreeChildrenSpy.mockRestore();
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

                row.getData = jest.fn().mockReturnValue(treeItem);

                instance["objTreeHandleRowExpanded"](row);

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

                row.getData = jest.fn().mockReturnValue(treeItem);

                instance["objTreeHandleRowExpanded"](row);

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

                row.getData = jest.fn().mockReturnValue(treeItem);

                instance["objTreeHandleRowExpanded"](row);

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

                instance.setState({ expandedObjTreeItems: ["test-id", "other-id"] });
                row.getData = jest.fn().mockReturnValue(treeItem);

                instance["objTreeHandleRowCollapsed"](row);

                expect(treeItem.expanded).toBe(false);
            });
        });

        describe("objTreeIsRowExpanded", () => {
            it("should return false and not trigger expansion for collapsed item", () => {
                const treeItem = {
                    expanded: false,
                } as IObjectStorageTreeItem;

                row.getData = jest.fn().mockReturnValue(treeItem);

                const result = instance["objTreeIsRowExpanded"](row);

                expect(result).toBe(false);
                expect(getObjectStorageTreeChildrenSpy).not.toHaveBeenCalled();
            });
        });
    });

    describe("objTreeToggleSelectedState", () => {
        let instance: LakehouseNavigator;
        let cell: CellComponent;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
            cell = {
                getData: jest.fn(),
            } as unknown as CellComponent;
        });

        describe("Upload tab", () => {
            beforeEach(() => {
                instance.setState({ activeTabId: LakehouseNavigatorTab.Upload });
            });

            it("should set upload target when selecting new item", () => {
                const treeItem = {
                    id: "test-id",
                    data: {
                        type: ObjectStorageTreeItemType.Bucket,
                        name: "test-bucket",
                    },
                } as IObjectStorageTreeItem;

                cell.getData = jest.fn().mockReturnValue(treeItem);

                instance["objTreeToggleSelectedState"](new Event("click"), cell);

                expect(instance.state.fileUploadTargetPath).toBeUndefined();
            });

            it("should clear upload target when selecting same item", () => {
                const treeItem = {
                    id: "test-id",
                    data: {
                        type: ObjectStorageTreeItemType.Bucket,
                        name: "test-bucket",
                    },
                } as IObjectStorageTreeItem;

                instance.setState({ uploadTarget: treeItem });
                cell.getData = jest.fn().mockReturnValue(treeItem);

                instance["objTreeToggleSelectedState"](new Event("click"), cell);

                expect(instance.state.uploadTarget).toBeUndefined();
                expect(instance.state.fileUploadTargetPath).toBeUndefined();
            });
        });
    });

    describe("generateVectorTableName", () => {
        let instance: LakehouseNavigator;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
        });

        it("should return empty string for empty items array", () => {
            const tableName = instance["generateVectorTableName"]([]);
            expect(tableName).toBe("");
        });

        it("should extract table name from single file URI", () => {
            const items: ILakehouseTaskItem[] = [{
                id: "test-id",
                uri: "oci://bucket/folder/test_data.csv",
                caption: "test_data.csv",
            }] as unknown as ILakehouseTaskItem[];

            const tableName = instance["generateVectorTableName"](items);
            expect(tableName).toBe("test_data");
        });

        it("should handle single file URI with trailing slash", () => {
            const items: ILakehouseTaskItem[] = [{
                id: "test-id",
                uri: "oci://bucket/folder/test_data/",
                caption: "test_data",
            }] as unknown as ILakehouseTaskItem[];

            const tableName = instance["generateVectorTableName"](items);
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

            const tableName = instance["generateVectorTableName"](items);
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

            const tableName = instance["generateVectorTableName"](items);
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

            const tableName = instance["generateVectorTableName"](items);
            expect(tableName).toBe("bucket");
        });
    });

    describe("checkMysqlPrivileges", () => {
        let instance: LakehouseNavigator;
        let executeSpy: jest.SpyInstance;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
            executeSpy = jest.spyOn(props.backend, "execute");
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it("should return true when all required views are accessible", async () => {
            executeSpy.mockResolvedValueOnce({
                rows: [
                    ["mysql_task_management", "task", "VIEW"],
                    ["mysql_task_management", "task_log", "VIEW"],
                    ["mysql_task_management", "task_status", "VIEW"],
                ],
            });

            const result = await instance["checkMysqlPrivileges"]();
            expect(result).toBe(true);

            expect(executeSpy).toHaveBeenCalledWith(
                expect.stringMatching(/SELECT.*FROM INFORMATION_SCHEMA\.TABLES.*mysql_task_management.*/s),
            );
        });

        it("should return false when not all views are accessible", async () => {
            executeSpy.mockResolvedValueOnce({
                rows: [
                    ["mysql_task_management", "task", "VIEW"],
                    ["mysql_task_management", "task_log", "VIEW"],
                ],
            });

            const result = await instance["checkMysqlPrivileges"]();
            expect(result).toBe(false);
        });

        it("should return false when no views are accessible", async () => {
            executeSpy.mockResolvedValueOnce({
                rows: [],
            });

            const result = await instance["checkMysqlPrivileges"]();
            expect(result).toBe(false);
        });

        it("should return false when execute returns undefined", async () => {
            executeSpy.mockResolvedValueOnce(undefined);

            const result = await instance["checkMysqlPrivileges"]();
            expect(result).toBe(false);
        });

        it("should return false when execute returns null rows", async () => {
            executeSpy.mockResolvedValueOnce({
                rows: null,
            });

            const result = await instance["checkMysqlPrivileges"]();
            expect(result).toBe(false);
        });
    });

    describe("setActiveDatabaseSchema", () => {
        let instance: LakehouseNavigator;
        let autoRefreshTreesSpy: jest.SpyInstance;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
            autoRefreshTreesSpy = jest.spyOn(instance as any, "autoRefreshTrees").mockResolvedValue(undefined);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("should update state when schema changes", async () => {
            const newSchema = "newSchema";
            const currentTask = { schemaName: "oldSchema", items: [] };
            instance.setState({ activeSchema: "oldSchema", task: currentTask });

            instance["setActiveDatabaseSchema"](newSchema);

            await nextProcessTick();

            expect(instance.state.activeSchema).toBe(newSchema);
            expect(instance.state.task!.schemaName).toBe(newSchema);
        });

        it("should not update state when schema is the same", () => {
            const schema = "sameSchema";
            instance.setState({ activeSchema: schema });

            instance["setActiveDatabaseSchema"](schema);

            expect(autoRefreshTreesSpy).not.toHaveBeenCalled();
        });

        it("should trigger autoRefreshTrees and forceUpdate when schema changes", async () => {
            const forceUpdateSpy = jest.spyOn(instance, "forceUpdate");

            instance["setActiveDatabaseSchema"]("newSchema");

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
            instance.setState({
                activeSchema: "oldSchema",
                task: currentTask,
            });

            instance["setActiveDatabaseSchema"]("newSchema");

            await nextProcessTick();

            expect(instance.state.task!.schemaName).toBe("newSchema");
        });

        it("should handle setState callback chain correctly", async () => {
            const forceUpdateSpy = jest.spyOn(instance, "forceUpdate");
            autoRefreshTreesSpy.mockImplementation(() => { return Promise.resolve(); });

            instance["setActiveDatabaseSchema"]("newSchema");

            await nextProcessTick();

            expect(autoRefreshTreesSpy).toHaveBeenCalledTimes(1);
            expect(forceUpdateSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("getDefaultTaskDescription", () => {
        let instance: LakehouseNavigator;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
        });

        it("should return default description when task is undefined", () => {
            const result = instance["getDefaultTaskDescription"](undefined);
            expect(result).toBe("Data from Object Storage");
        });

        it("should return default description when task items are undefined", () => {
            const task = { schemaName: "testSchema" };
            const result = instance["getDefaultTaskDescription"](task);
            expect(result).toBe("Data from Object Storage");
        });

        it("should return default description when task items are empty", () => {
            const task = { schemaName: "testSchema", items: [] };
            const result = instance["getDefaultTaskDescription"](task);
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
            const result = instance["getDefaultTaskDescription"](task);
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
            const result = instance["getDefaultTaskDescription"](task);
            expect(result).toBe("Data from Bucket bucket1");
        });
    });

    describe("toggleAutoRefresh", () => {
        let instance: LakehouseNavigator;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("should toggle autoRefreshTablesAndTasks state from false to true", () => {
            instance.setState({ autoRefreshTablesAndTasks: false });

            instance["toggleAutoRefresh"]({} as InputEvent, CheckState.Unchecked);

            expect(instance.state.autoRefreshTablesAndTasks).toBe(true);
        });

        it("should not clear timer if it was already null", () => {
            instance.setState({ autoRefreshTablesAndTasks: true });
            const clearTimeoutSpy = jest.spyOn(window, "clearTimeout");

            instance["toggleAutoRefresh"]({} as InputEvent, CheckState.Unchecked);

            expect(clearTimeoutSpy).not.toHaveBeenCalled();
        });
    });

    describe("updateObjStorageTreeGrid", () => {
        let instance: LakehouseNavigator;
        let setDataSpy: jest.Mock;
        let getSelectedRowsSpy: jest.Mock;
        let deselectRowSpy: jest.Mock;
        let selectRowSpy: jest.Mock;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();

            // Setup tree grid spies
            setDataSpy = jest.fn().mockResolvedValue(undefined);
            getSelectedRowsSpy = jest.fn();
            deselectRowSpy = jest.fn();
            selectRowSpy = jest.fn();
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("should do nothing when tree items are undefined", () => {
            instance["updateObjStorageTreeGrid"]();

            expect(setDataSpy).not.toHaveBeenCalled();
        });

        it("should handle items without ids in selection", async () => {
            const itemWithoutId = { name: "item1" };
            getSelectedRowsSpy.mockReturnValue([{ getData: () => { return itemWithoutId; } }]);

            instance["updateObjStorageTreeGrid"]();
            await nextProcessTick();

            expect(selectRowSpy).not.toHaveBeenCalled();
        });

        it("should not restore selection if no rows were selected", async () => {
            getSelectedRowsSpy.mockReturnValue([]);

            instance["updateObjStorageTreeGrid"]();
            await nextProcessTick();

            expect(deselectRowSpy).not.toHaveBeenCalled();
            expect(selectRowSpy).not.toHaveBeenCalled();
        });
    });

    describe("refreshObjTreeItem", () => {
        let instance: LakehouseNavigator;
        let getObjectStorageTreeChildrenSpy: jest.SpyInstance;
        let updateObjStorageTreeGridSpy: jest.SpyInstance;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
            getObjectStorageTreeChildrenSpy = jest.spyOn(instance as any, "getObjectStorageTreeChildren")
                .mockResolvedValue([]);
            updateObjStorageTreeGridSpy = jest.spyOn(instance as any, "updateObjStorageTreeGrid")
                .mockImplementation();
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("should do nothing when tree item is not found", async () => {
            await instance["refreshObjTreeItem"]("nonexistent");

            expect(getObjectStorageTreeChildrenSpy).not.toHaveBeenCalled();
            expect(updateObjStorageTreeGridSpy).toHaveBeenCalled();
        });

        it("should handle undefined objTreeItems", async () => {
            await instance["refreshObjTreeItem"]("any");

            expect(getObjectStorageTreeChildrenSpy).not.toHaveBeenCalled();
            expect(updateObjStorageTreeGridSpy).toHaveBeenCalled();
        });
    });

    describe("handleAddFilesForUpload", () => {
        let instance: LakehouseNavigator;
        let executeRemoteSpy: jest.SpyInstance;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
            executeRemoteSpy = jest.spyOn(requisitions, "executeRemote").mockImplementation();
            appParameters.embedded = true;
        });

        afterEach(() => {
            jest.restoreAllMocks();
            appParameters.embedded = false;
        });

        it("should show open dialog with correct options", () => {
            instance["handleAddFilesForUpload"]({} as MouseEvent);

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
        let instance: LakehouseNavigator;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
        });

        it("should return false for non-matching resourceId", async () => {
            const result = await instance["selectFile"]({
                resourceId: "wrongId",
                path: [],
            });

            expect(result).toBe(false);
        });

        it("should handle empty filesForUpload state", async () => {
            instance.setState({ filesForUpload: undefined });

            const result = await instance["selectFile"]({
                resourceId: "lakehouseFileUpload",
                path: ["file://path/to/file.txt"],
            });

            expect(result).toBe(true);
            expect(instance.state.filesForUpload).toEqual([
                { filePath: "path/to/file.txt", uploadComplete: false },
            ]);
        });

        it("should handle multiple file paths", async () => {
            const result = await instance["selectFile"]({
                resourceId: "lakehouseFileUpload",
                path: [
                    "file://path/to/file1.txt",
                    "file://path/to/file2.txt",
                ],
            });

            expect(result).toBe(true);
            expect(instance.state.filesForUpload).toEqual([
                { filePath: "path/to/file1.txt", uploadComplete: false },
                { filePath: "path/to/file2.txt", uploadComplete: false },
            ]);
        });

        it("should handle paths without file:// prefix", async () => {
            const result = await instance["selectFile"]({
                resourceId: "lakehouseFileUpload",
                path: [
                    "path/to/file1.txt",
                    "file://path/to/file2.txt",
                ],
            });

            expect(result).toBe(true);
            expect(instance.state.filesForUpload).toEqual([
                { filePath: "path/to/file1.txt", uploadComplete: false },
                { filePath: "path/to/file2.txt", uploadComplete: false },
            ]);
        });

        it("should handle URI encoded paths", async () => {
            const result = await instance["selectFile"]({
                resourceId: "lakehouseFileUpload",
                path: [
                    "file://path/to/file%20with%20spaces.txt",
                ],
            });

            expect(result).toBe(true);
            expect(instance.state.filesForUpload).toEqual([
                { filePath: "path/to/file with spaces.txt", uploadComplete: false },
            ]);
        });

        it("should not update state if no paths are provided", async () => {
            instance.setState({ filesForUpload: undefined });

            const result = await instance["selectFile"]({
                resourceId: "lakehouseFileUpload",
                path: [],
            });

            expect(result).toBe(true);
            expect(instance.state.filesForUpload).toBeUndefined();
        });
    });

    describe("handlePaneResize", () => {
        let instance: LakehouseNavigator;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
        });

        it("should update newTaskPanelWidth state", async () => {
            const info = [{
                id: "newLoadTask",
                currentSize: 300,
            }];

            instance["handlePaneResize"](info);
            await nextProcessTick();

            expect(instance.state.newTaskPanelWidth).toBe(300);
        });

        it("should update filesForUploadPanelWidth state", async () => {
            const info = [{
                id: "filesForUpload",
                currentSize: 400,
            }];

            instance["handlePaneResize"](info);
            await nextProcessTick();

            expect(instance.state.filesForUploadPanelWidth).toBe(400);
        });

        it("should update taskListPanelHeight state", async () => {
            const info = [{
                id: "taskListPanel",
                currentSize: 500,
            }];

            instance["handlePaneResize"](info);
            await nextProcessTick();

            expect(instance.state.taskListPanelHeight).toBe(500);
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

            instance["handlePaneResize"](info);
            await nextProcessTick();

            expect(instance.state.newTaskPanelWidth).toBe(300);
            expect(instance.state.filesForUploadPanelWidth).toBe(400);
            expect(instance.state.taskListPanelHeight).toBe(500);
        });

        it("should ignore unknown pane ids", async () => {
            const info = [
                {
                    id: "unknownPane",
                    currentSize: 300,
                },
            ];

            const initialState = { ...instance.state };
            instance["handlePaneResize"](info);
            await nextProcessTick();

            expect(instance.state).toEqual(initialState);
        });

        it("should handle empty info array", async () => {
            const initialState = { ...instance.state };
            instance["handlePaneResize"]([]);
            await nextProcessTick();

            expect(instance.state).toEqual(initialState);
        });
    });

    describe("showConfirmDlg", () => {
        let instance: LakehouseNavigator;
        let showDialogSpy: jest.SpyInstance;

        beforeEach(() => {
            const component = mount<LakehouseNavigator>(
                <LakehouseNavigator {...props} />,
            );
            instance = component.instance();
            showDialogSpy = jest.spyOn(DialogHost, "showDialog");
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("should show dialog with correct parameters", async () => {
            showDialogSpy.mockResolvedValue({ closure: DialogResponseClosure.Accept });

            await instance["showConfirmDlg"]("Test Title", "Test Prompt");

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
            showDialogSpy.mockResolvedValue({ closure: DialogResponseClosure.Accept });

            const result = await instance["showConfirmDlg"]("Test Title", "Test Prompt");

            expect(result).toBe(true);
        });

        it("should return false when dialog is cancelled", async () => {
            showDialogSpy.mockResolvedValue({ closure: DialogResponseClosure.Cancel });

            const result = await instance["showConfirmDlg"]("Test Title", "Test Prompt");

            expect(result).toBe(false);
        });

        it("should handle dialog error", async () => {
            showDialogSpy.mockRejectedValue(new Error("Dialog error"));

            await expect(instance["showConfirmDlg"]("Test Title", "Test Prompt"))
                .rejects.toThrow("Dialog error");
        });
    });

});
