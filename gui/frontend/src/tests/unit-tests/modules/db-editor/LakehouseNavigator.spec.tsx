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

import { mount, shallow } from "enzyme";
import {
    ILakehouseNavigatorProperties, ILakehouseNavigatorSavedState, ILakehouseNavigatorState, LakehouseNavigator,
    LakehouseNavigatorTab,
} from "../../../../modules/db-editor/LakehouseNavigator.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";

describe("LakehouseNavigator tests", () => {
    const backend = new ShellInterfaceSqlEditor();

    const savedState: ILakehouseNavigatorSavedState = {
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
                profiles: [{ profile: "testProfile" }],
                objTreeItems: [],
                lakehouseTables: [],
                lakehouseTablesHash: "hash1",
                lakehouseTasks: [],
                lakehouseTasksHash: "hash2",
            },
        };
        const state = {
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

        instance.componentDidUpdate(prevProps as ILakehouseNavigatorProperties, prevState as ILakehouseNavigatorState);

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
            savedState: { activeSchema: undefined },
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
            savedState: { activeSchema: "savedSchema" },
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

        instance["handleProfileSelection"](true, new Set(), {});

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
        instance["handleSchemaSelection"](true, new Set([schemaId]), {});

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

        instance["handleSchemaSelection"](true, new Set(), {});

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
        instance["handleFormatSelection"](true, ids, {});

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
        instance["handleFormatSelection"](true, ids, {});

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
        instance["handleLanguageSelection"](true, ids, {});

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
        instance["handleLanguageSelection"](true, ids, {});

        expect(mockSetState).toHaveBeenCalledWith({
            task: {
                languageId: undefined,
            },
        });
        mockSetState.mockRestore();

        component.unmount();
    });
});

