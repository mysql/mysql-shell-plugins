/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import { act, fireEvent, render, waitFor } from "@testing-library/preact";
import { createRef } from "preact";
import { afterEach, beforeAll, describe, expect, it, type Mock, vi } from "vitest";

const communicationDebuggerMock = vi.hoisted(() => {
    return {
        mount: vi.fn(),
        unmount: vi.fn(),
    };
});

vi.mock("../../../../components/CommunicationDebugger/CommunicationDebugger.js", async () => {
    const { Component, Fragment, h } = await vi.importActual<typeof import("preact")>("preact");
    const { createPortal } = await vi.importActual<typeof import("preact/compat")>("preact/compat");

    class MockCommunicationDebugger extends Component<{
        contentPortalTargetId?: string;
        sidebarPortalTargetId?: string;
    }> {
        public override componentDidMount(): void {
            communicationDebuggerMock.mount();
        }

        public override componentWillUnmount(): void {
            communicationDebuggerMock.unmount();
        }

        public override render(): preact.ComponentChild {
            const { contentPortalTargetId, sidebarPortalTargetId } = this.props;
            const contentTarget = contentPortalTargetId ? document.getElementById(contentPortalTargetId) : undefined;
            const sidebarTarget = sidebarPortalTargetId ? document.getElementById(sidebarPortalTargetId) : undefined;
            const content = h("div", { id: "mockCommunicationDebuggerBody" }, "Mock Debugger Body");
            const sidebar = h("div", { id: "mockCommunicationDebuggerSidebar" }, "Mock Debugger Sidebar");

            return h(Fragment, {}, [
                contentTarget ? createPortal(content, contentTarget) : content,
                sidebarTarget ? createPortal(sidebar, sidebarTarget) : null,
            ]);
        }
    }

    return {
        default: MockCommunicationDebugger,
    };
});

import { registerUiLayer } from "../../../../app-logic/UILayer.js";
import { CdmEntityType } from "../../../../data-models/ConnectionDataModel.js";
import type { AdminPageType } from "../../../../data-models/data-model-types.js";
import { OdmEntityType } from "../../../../data-models/OpenDocumentDataModel.js";
import { uiLayerMock } from "../../__mocks__/UILayerMock.js";
import { ConnectionWorkspace } from "../../../../modules/db-editor/ConnectionWorkspace.js";
import { ConnectionTags, connectionTagsChangedKey } from "../../../../modules/db-editor/ConnectionTags.js";
import { DocumentModule } from "../../../../modules/db-editor/DocumentModule.js";
import { Notebook } from "../../../../modules/db-editor/Notebook.js";
import { SimpleEditor } from "../../../../modules/db-editor/SimpleEditor.js";
import { ScriptEditor } from "../../../../modules/db-editor/ScriptEditor.js";
import { Menu } from "../../../../components/ui/Menu/Menu.js";
import { desktopCommandRegistry } from "../../../../supplement/DesktopCommandRegistry.js";
import { appParameters } from "../../../../supplement/AppParameters.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import { Settings } from "../../../../supplement/Settings/Settings.js";
import { DBType, type IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { RunMode, webSession } from "../../../../supplement/WebSession.js";
import { LoadingState } from "../../../../script-execution/index.js";
import { nextRunLoop } from "../../test-helpers.js";

class TestDocumentModule extends DocumentModule { }

describe("Document module desktop commands", () => {
    const restoreMatchMediaMock = (): void => {
        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: vi.fn().mockImplementation((query: unknown) => {
                return {
                    matches: false,
                    media: query,
                    onchange: null,
                    addListener: vi.fn(),
                    removeListener: vi.fn(),
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                    dispatchEvent: vi.fn(),
                };
            }),
        });
    };

    const restoreUiLayerMock = (): void => {
        vi.mocked(uiLayerMock.showInformationMessage).mockResolvedValue(undefined);
        vi.mocked(uiLayerMock.showWarningMessage).mockResolvedValue(undefined);
        vi.mocked(uiLayerMock.showErrorMessage).mockResolvedValue(undefined);
        vi.mocked(uiLayerMock.createStatusBarItem).mockImplementation(() => {
            return {
                id: "mock",
                alignment: 1,
                text: "mock",
                tooltip: "mock",
                color: "mock",
                command: "mock",
                visible: true,
                show: vi.fn(),
                hide: vi.fn(),
                dispose: vi.fn(),
            };
        });
        vi.mocked(uiLayerMock.setStatusBarMessage).mockImplementation(() => { /**/ });
        vi.mocked(uiLayerMock.confirm).mockResolvedValue(undefined);
        vi.mocked(uiLayerMock.requestPassword).mockResolvedValue(undefined);
    };

    const connectionDetails: IConnectionDetails = {
        id: 42,
        dbType: DBType.MySQL,
        caption: "Desktop Commands Connection",
        description: "Desktop Commands Connection",
        folderPath: "/",
        index: 0,
        options: {
            user: "shell",
            host: "db.internal",
        },
        version: 80403,
        versionComment: "MySQL Community Server - GPL",
    };

    const createTreeState = (overrides: Record<string, unknown> = {}) => {
        return {
            isLeaf: false,
            initialized: true,
            expanded: false,
            expandedOnce: false,
            ...overrides,
        };
    };

    const createConnectionPresentationState = (documents: Array<{ id: string; } & Record<string, unknown>> = [],
        activeEntry?: string) => {
        return {
            documents,
            documentStates: documents.map((document) => {
                return {
                    document,
                    currentVersion: 0,
                };
            }),
            activeEntry: activeEntry ?? documents[0]?.id ?? "",
            heatWaveEnabled: false,
            mleEnabled: false,
            isCloudInstance: false,
            adminPageStates: {},
            graphData: {},
            chatOptionsState: {},
            executionHistory: [],
            currentExecutionHistoryIndex: 0,
            hasExplainError: false,
        };
    };

    const createElectronWorkspaceConnection = (options?: {
        adminPages?: Array<{ id: string; caption: string; pageType: AdminPageType; }>;
        tableNames?: string[];
    }) => {
        const tableNames = options?.tableNames ?? ["actor"];
        const connection: Record<string, unknown> = {
            id: "shared-connection-42",
            caption: connectionDetails.caption,
            type: CdmEntityType.Connection,
            details: connectionDetails,
            state: createTreeState({ expandedOnce: true }),
            schemaEntries: [],
            currentSchema: "",
            isOpen: true,
            refresh: vi.fn().mockResolvedValue(true),
        };

        const tables: Array<Record<string, unknown>> = tableNames.map((tableName, index) => {
            return {
                id: `table-${index}`,
                caption: tableName,
                type: CdmEntityType.Table,
                parent: undefined,
                connection,
                state: createTreeState({ isLeaf: true }),
                refresh: vi.fn().mockResolvedValue(true),
                getChildren: vi.fn().mockReturnValue(undefined),
            };
        });

        const tablesGroup: Record<string, unknown> = {
            id: "schema-group-tables",
            caption: "Tables",
            type: CdmEntityType.TableGroup,
            subType: CdmEntityType.Table,
            parent: undefined,
            connection,
            state: createTreeState({ expandedOnce: true }),
            members: tables,
            refresh: vi.fn().mockResolvedValue(true),
            getChildren: vi.fn().mockImplementation(() => {
                return tables;
            }),
        };

        const schema: Record<string, unknown> = {
            id: "schema-sakila",
            caption: "sakila",
            type: CdmEntityType.Schema,
            parent: connection,
            connection,
            state: createTreeState({ expandedOnce: true }),
            refresh: vi.fn().mockResolvedValue(true),
            getChildren: vi.fn().mockImplementation(() => {
                return [tablesGroup];
            }),
        };

        tables.forEach((table) => {
            table.parent = tablesGroup;
        });
        tablesGroup.parent = schema;

        const adminPages: Array<Record<string, unknown>> = (options?.adminPages ?? [{
            id: "admin-server-status",
            caption: "Server Information",
            pageType: "serverStatus" as const,
        }]).map((page) => {
            return {
                id: page.id,
                caption: page.caption,
                type: CdmEntityType.AdminPage,
                pageType: page.pageType,
                parent: undefined,
                connection,
                state: createTreeState({ isLeaf: true }),
                refresh: vi.fn().mockResolvedValue(true),
                getChildren: vi.fn().mockReturnValue(undefined),
            };
        });

        const adminEntry: Record<string, unknown> = {
            id: "admin-root",
            caption: "MySQL Administration",
            type: CdmEntityType.Admin,
            parent: connection,
            connection,
            pages: adminPages,
            state: createTreeState({ expandedOnce: true }),
            refresh: vi.fn().mockResolvedValue(true),
            getChildren: vi.fn().mockImplementation(() => {
                return adminPages;
            }),
        };

        adminPages.forEach((page) => {
            page.parent = adminEntry;
        });

        connection.connection = connection;
        connection.schemaEntries = [schema];
        connection.adminEntry = adminPages.length > 0 ? adminEntry : {
            ...adminEntry,
            pages: [],
            getChildren: vi.fn().mockReturnValue([]),
        };
        connection.getChildren = vi.fn().mockImplementation(() => {
            return [...(connection.schemaEntries as unknown[]), ...(connection.adminEntry
                ? [connection.adminEntry]
                : [])];
        });

        return {
            connection,
            schema,
            tablesGroup,
            tables,
            adminEntry: connection.adminEntry,
            adminPages,
        };
    };

    beforeAll(() => {
        registerUiLayer(uiLayerMock);
    });

    afterEach(() => {
        Reflect.deleteProperty(window, "electronHost");
        Settings.set("editor.showHidden", false);
        Settings.set("editor.showConnectionInfo", false);
        Settings.set("editor.wordWrap", "off");
        vi.useRealTimers();
        vi.restoreAllMocks();
        communicationDebuggerMock.mount.mockClear();
        communicationDebuggerMock.unmount.mockClear();
        restoreMatchMediaMock();
        restoreUiLayerMock();
    });

    it("toggles the sidebar from the desktop titlebar button", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();
        expect(moduleRef.current!.state.showSidebar).toBe(true);

        let button = container.querySelector("#desktopWorkspaceSidebarToggle");
        expect(button).toBeTruthy();
        expect(button?.closest("#desktopSidebarHeader")).toBeTruthy();

        await act(async () => {
            fireEvent.click(button!);
        });

        expect(moduleRef.current!.state.showSidebar).toBe(false);
        button = container.querySelector("#desktopWorkspaceSidebarToggle");
        expect(button).toBeTruthy();
        expect(button?.closest("#desktopWorkspaceTitlebar")).toBeTruthy();

        await act(async () => {
            fireEvent.click(button!);
        });

        expect(moduleRef.current!.state.showSidebar).toBe(true);
        button = container.querySelector("#desktopWorkspaceSidebarToggle");
        expect(button?.closest("#desktopSidebarHeader")).toBeTruthy();

        unmount();
    });

    it("hides the content toolbar on the Home workspace", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        const { container, unmount } = render(<TestDocumentModule />);

        await nextRunLoop();

        expect(container.querySelector("#connectionOverviewToolbar")).toBeFalsy();
        expect(container.querySelector("#documentSelectorPreviousButton")).toBeFalsy();
        expect(container.querySelector("#documentSelectorNextButton")).toBeFalsy();
        expect(container.querySelector("#documentSelector")).toBeFalsy();
        expect(container.textContent).not.toContain("Editor:");

        unmount();
    });

    it("updates desktop titlebar tags when connection tag settings change", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        let tagColors = {
            DEV: "#c2410c",
        };
        vi.spyOn(ConnectionTags, "getCached").mockImplementation(() => {
            return tagColors;
        });
        const updateCacheSpy = vi.spyOn(ConnectionTags, "updateCache");

        const taggedDetails = {
            ...connectionDetails,
            tags: ["DEV"],
        };
        const sharedConnection = createElectronWorkspaceConnection();
        sharedConnection.connection.details = taggedDetails;
        const fakePage = {
            id: "page-1",
            caption: taggedDetails.caption,
            details: taggedDetails,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: sharedConnection.connection,
            suppressAbout: false,
        };
        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        const roots = (moduleRef.current as any).connectionsDataModel.roots as unknown[];
        roots.splice(0, roots.length, sharedConnection.connection);
        act(() => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });
        await nextRunLoop();

        let titlebarTag = container.querySelector<HTMLElement>(".desktopWorkspaceSelectorTag");
        expect(titlebarTag?.textContent).toBe("DEV");
        expect(titlebarTag?.style.backgroundColor).toBe("rgb(194, 65, 12)");
        const selectorHost = titlebarTag?.closest(".desktopWorkspaceSelectorHost");
        expect(selectorHost?.querySelector("#workspaceSelector + .desktopWorkspaceSelectorTags")).toBeTruthy();
        tagColors = {
            DEV: "#1d4ed8",
        };

        await act(async () => {
            await requisitions.execute("settingsChanged", {
                key: connectionTagsChangedKey,
                value: tagColors,
            });
        });
        await nextRunLoop();

        titlebarTag = container.querySelector<HTMLElement>(".desktopWorkspaceSelectorTag");
        expect(updateCacheSpy).toHaveBeenCalledWith(tagColors);
        expect(titlebarTag?.textContent).toBe("DEV");
        expect(titlebarTag?.style.backgroundColor).toBe("rgb(29, 78, 216)");

        unmount();
    });

    it("renders CONNECTIONS and not DATABASE CONNECTIONS on the Electron Home workspace", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();

        const sharedConnection = createElectronWorkspaceConnection();
        const roots = (moduleRef.current as any).connectionsDataModel.roots as unknown[];
        roots.splice(0, roots.length, sharedConnection.connection);

        await act(async () => {
            moduleRef.current!.forceUpdate();
        });
        await nextRunLoop();

        expect(container.textContent).not.toContain("DATABASE CONNECTIONS");
        expect(container.textContent).toContain("CONNECTIONS");
        expect(container.textContent).toContain(connectionDetails.caption);
        expect(container.textContent).not.toContain("SCHEMAS");
        expect(container.textContent).not.toContain("ADMINISTRATION");
        expect(container.textContent).not.toContain("Show MySQL System Schemas");
        expect(container.textContent).not.toContain("Browse the MySQL REST Service Documentation");
        expect(container.textContent).not.toContain("Configure Instance for MySQL REST Service Support");
        expect(container.querySelector("#connectionSection")).toBeTruthy();
        expect(container.querySelector("[data-tooltip='Refresh the Connection List']")).toBeFalsy();
        expect(container.querySelector("[data-tooltip='Refresh Connection']")).toBeFalsy();
        expect(container.querySelector("[data-tooltip='Collapse All']")).toBeFalsy();
        expect(container.querySelector("#ociSection")).toBeTruthy();
        expect(container.querySelector("#ociSection")?.classList.contains("expanded")).toBe(false);

        unmount();
    });

    it("shows the General workspace only when it has content", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(SimpleEditor.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(SimpleEditor.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        await act(async () => {
            fireEvent.click(container.querySelector("#workspaceSelector")!);
        });
        await nextRunLoop();

        let itemCaptions = Array.from(document.querySelectorAll("#workspaceSelectorPopup .dropdownItem .label"))
            .map((node) => {
                return node.textContent?.trim() ?? "";
            }).filter(Boolean);

        expect(itemCaptions).toContain("Home");
        expect(itemCaptions).not.toContain("General");

        const generalDocument = {
            id: "general-doc-1",
            caption: "General Script",
            type: OdmEntityType.StandaloneDocument,
            language: "mysql",
        };

        await act(async () => {
            moduleRef.current!.setState({
                documentTabs: [{
                    dataModelEntry: generalDocument,
                    savedState: {} as never,
                }] as never,
                selectedPage: generalDocument.id,
                selectedWorkspace: "__workspace_general__",
                loading: false,
            });
        });

        await act(async () => {
            fireEvent.click(container.querySelector("#workspaceSelector")!);
        });
        await nextRunLoop();

        itemCaptions = Array.from(document.querySelectorAll("#workspaceSelectorPopup .dropdownItem .label"))
            .map((node) => {
                return node.textContent?.trim() ?? "";
            }).filter(Boolean);

        expect(itemCaptions).toContain("General");

        unmount();
    });

    it("opens the communication debugger through the Electron workspace selector", async () => {
        const originalRunMode = webSession.runMode;
        const originalEmbedded = appParameters.embedded;
        webSession.runMode = RunMode.LocalUser;
        appParameters.embedded = true;
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        try {
            await nextRunLoop();

            expect(container.querySelector("#desktopWorkspaceHost")).toBeTruthy();
            expect(container.querySelector("#communicationDebuggerWorkspacePage")).toBeFalsy();
            expect(desktopCommandRegistry.getState().find((entry) => {
                return entry.id === "dev.toggleDebugger";
            })).toMatchObject({
                enabled: true,
                checked: false,
            });

            await act(async () => {
                expect(await desktopCommandRegistry.execute("dev.toggleDebugger")).toBe(true);
            });
            await nextRunLoop();

            expect(moduleRef.current!.state.debuggerWorkspaceVisible).toBe(true);
            expect(moduleRef.current!.state.selectedWorkspace).toBe("__workspace_debugger__");
            expect(moduleRef.current!.state.selectedPage).toBe("__workspace_debugger_page__");
            expect(container.querySelector("#desktopWorkspaceHost")).toBeTruthy();
            expect(container.querySelector("#communicationDebuggerWorkspacePage")).toBeTruthy();
            expect(container.querySelector("#communicationDebuggerSidebarHost")).toBeTruthy();
            expect(container.querySelector("#communicationDebuggerWorkspacePage")?.closest(".dbModuleTabview"))
                .toBeFalsy();
            expect(container.querySelector("#documentSideBar")).toBeFalsy();
            await waitFor(() => {
                expect(container.textContent).toContain("Mock Debugger Body");
            });
            expect(communicationDebuggerMock.mount).toHaveBeenCalledTimes(1);
            expect(communicationDebuggerMock.unmount).not.toHaveBeenCalled();
            expect(desktopCommandRegistry.getState().find((entry) => {
                return entry.id === "dev.toggleDebugger";
            })).toMatchObject({
                enabled: true,
                checked: true,
            });

            await act(async () => {
                fireEvent.click(container.querySelector("#workspaceSelector")!);
            });
            await nextRunLoop();

            const itemCaptions = Array.from(document.querySelectorAll("#workspaceSelectorPopup .dropdownItem .label"))
                .map((node) => {
                    return node.textContent?.trim() ?? "";
                }).filter(Boolean);

            expect(itemCaptions).toContain("Home");
            expect(itemCaptions).toContain("Communication Debugger");

            const fakePage = {
                id: "page-1",
                caption: connectionDetails.caption,
                details: connectionDetails,
            };
            const fakeConnectionWorkspace = {
                dataModelEntry: fakePage,
                connection: {
                    details: connectionDetails,
                    isOpen: true,
                    currentSchema: "",
                },
                suppressAbout: false,
            };

            (moduleRef.current as any).connectionPresentation.set(fakePage,
                createConnectionPresentationState([], ""));
            await act(async () => {
                moduleRef.current!.setState({
                    connectionWorkspaces: [fakeConnectionWorkspace] as never,
                    selectedPage: fakePage.id,
                    selectedWorkspace: "connection:42",
                    debuggerWorkspaceVisible: true,
                    loading: false,
                });
            });
            await nextRunLoop();

            expect(container.querySelector("#communicationDebuggerWorkspacePage")).toBeFalsy();
            expect(container.querySelector("#communicationDebuggerSidebarHost")).toBeFalsy();
            expect(container.querySelector("#documentSideBar")).toBeTruthy();

            await act(async () => {
                fireEvent.click(container.querySelector("#workspaceSelector")!);
            });
            await nextRunLoop();

            const debuggerItem = Array.from(document.querySelectorAll("#workspaceSelectorPopup .dropdownItem"))
                .find((item) => {
                    return item.textContent?.includes("Communication Debugger") ?? false;
                });
            expect(debuggerItem).toBeTruthy();

            await act(async () => {
                fireEvent.click(debuggerItem!);
            });
            await nextRunLoop();

            expect(moduleRef.current!.state.selectedWorkspace).toBe("__workspace_debugger__");
            expect(moduleRef.current!.state.selectedPage).toBe("__workspace_debugger_page__");
            expect(container.querySelector("#communicationDebuggerWorkspacePage")).toBeTruthy();
            expect(container.querySelector("#communicationDebuggerSidebarHost")).toBeTruthy();
            expect(container.querySelector("#documentSideBar")).toBeFalsy();

            await act(async () => {
                moduleRef.current!.setState({
                    selectedPage: moduleRef.current!.state.overviewId,
                    selectedWorkspace: "__workspace_home__",
                });
            });
            await nextRunLoop();

            expect(container.querySelector("#communicationDebuggerWorkspacePage")).toBeFalsy();
            expect(container.querySelector("#communicationDebuggerSidebarHost")).toBeFalsy();
            expect(container.querySelector("#documentSideBar")).toBeTruthy();
            expect(communicationDebuggerMock.unmount).not.toHaveBeenCalled();

            await act(async () => {
                moduleRef.current!.setState({
                    selectedPage: "__workspace_debugger_page__",
                    selectedWorkspace: "__workspace_debugger__",
                });
            });
            await nextRunLoop();

            expect(container.querySelector("#communicationDebuggerWorkspacePage")).toBeTruthy();
            expect(container.querySelector("#communicationDebuggerSidebarHost")).toBeTruthy();
            expect(communicationDebuggerMock.mount).toHaveBeenCalledTimes(1);
            expect(communicationDebuggerMock.unmount).not.toHaveBeenCalled();

            await act(async () => {
                expect(await desktopCommandRegistry.execute("dev.toggleDebugger")).toBe(true);
            });
            await nextRunLoop();

            expect(moduleRef.current!.state.debuggerWorkspaceVisible).toBe(false);
            expect(moduleRef.current!.state.selectedWorkspace).toBe("__workspace_home__");
            expect(moduleRef.current!.state.selectedPage).toBe(moduleRef.current!.state.overviewId);
            expect(container.querySelector("#communicationDebuggerWorkspacePage")).toBeFalsy();
            expect(container.querySelector("#communicationDebuggerSidebarHost")).toBeFalsy();
            expect(container.querySelector("#documentSideBar")).toBeTruthy();
            expect(communicationDebuggerMock.unmount).toHaveBeenCalledTimes(1);
        } finally {
            unmount();
            webSession.runMode = originalRunMode;
            appParameters.embedded = originalEmbedded;
        }
    });

    it("closes connection workspaces from the workspace selector", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
                close: vi.fn().mockResolvedValue(undefined),
            },
            suppressAbout: false,
        };

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedWorkspace: "__workspace_home__",
                loading: false,
            });
        });

        await act(async () => {
            fireEvent.click(container.querySelector("#workspaceSelector")!);
        });
        await nextRunLoop();

        const closeButton = document.querySelector("#workspaceSelectorPopup .workspaceSelectorCloseButton");
        expect(closeButton).toBeTruthy();
        const workspaceItems = Array.from(document.querySelectorAll("#workspaceSelectorPopup .dropdownItem"));
        expect(workspaceItems.length).toBeGreaterThan(1);
        expect(workspaceItems.every((item) => {
            return getComputedStyle(item).height === getComputedStyle(workspaceItems[0]).height;
        })).toBe(true);

        await act(async () => {
            fireEvent.click(closeButton!);
        });
        await nextRunLoop();

        expect(moduleRef.current!.state.connectionWorkspaces).toHaveLength(0);

        unmount();
    });

    it("responds to desktop window close requests after checking for unsaved documents", async () => {
        const confirmMock = uiLayerMock.confirm as Mock;
        confirmMock.mockClear();
        confirmMock.mockResolvedValueOnce("Cancel");

        const executeRemoteSpy = vi.spyOn(requisitions, "executeRemote").mockReturnValue(true);
        const moduleRef = createRef<TestDocumentModule>();
        const { unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        await act(async () => {
            moduleRef.current!.setState({
                documentTabs: [{
                    dataModelEntry: {
                        id: "standalone-doc-1",
                        caption: "Info.json",
                        type: OdmEntityType.StandaloneDocument,
                        language: "json",
                    },
                    savedState: {
                        model: {
                            getVersionId: vi.fn().mockReturnValue(2),
                        },
                    },
                    currentVersion: 1,
                }] as never,
                selectedPage: moduleRef.current!.state.overviewId,
                selectedWorkspace: "__workspace_home__",
                loading: false,
            });
        });

        const handled = await requisitions.execute("desktopWindowCloseRequested", { requestId: "close-1" });

        expect(handled).toBe(true);
        expect(confirmMock).toHaveBeenCalledWith(
            "There are unsaved documents. Do you want to discard them and close the window?",
            "Discard",
            "Cancel",
        );
        expect(executeRemoteSpy).toHaveBeenCalledWith("desktopWindowCloseResponse", {
            requestId: "close-1",
            allow: false,
        });

        unmount();
    });

    it("does not render the script editor document selector after removing the editor toolbar", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeDocument = {
            id: "doc-1",
            caption: "Script 1",
            type: OdmEntityType.Script,
            language: "mysql",
            parent: fakePage,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        (moduleRef.current as any).connectionPresentation.set(fakePage, {
            documents: [fakeDocument],
            documentStates: [{
                document: fakeDocument,
                currentVersion: 0,
                fileName: "/tmp/query-results.sql",
            }],
            activeEntry: fakeDocument.id,
            heatWaveEnabled: false,
            mleEnabled: false,
            isCloudInstance: false,
            adminPageStates: {},
            graphData: {},
            chatOptionsState: {},
            executionHistory: [],
            currentExecutionHistoryIndex: 0,
            hasExplainError: false,
        });

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });
        expect(container.querySelector("#documentSelector")).toBeFalsy();
        expect(container.querySelector("#documentSelectorPreviousButton")).toBeFalsy();
        expect(container.querySelector("#documentSelectorNextButton")).toBeFalsy();

        unmount();
    });

    it("preserves the file name when creating a script document from file", async () => {
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
                backend: {} as never,
            },
            suppressAbout: false,
        };
        const connectionState = createConnectionPresentationState([]);
        (moduleRef.current as any).connectionPresentation.set(fakePage, connectionState);

        const showPageSpy = vi.spyOn(moduleRef.current as any, "showPage").mockResolvedValue(true);

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });

        await act(async () => {
            await (moduleRef.current as any).createAndSelectScriptDocument(
                connectionDetails,
                "loaded-query.sql",
                "mysql",
                "select 1;",
                fakePage.id,
                "/tmp/loaded-query.sql",
            );
        });

        const openState = connectionState.documentStates[0];
        expect(showPageSpy).toHaveBeenCalledWith({
            connectionId: connectionDetails.id,
            pageId: fakePage.id,
            editor: "none",
            serviceOnly: false,
        });
        expect(openState?.fileName).toBe("/tmp/loaded-query.sql");
        expect(openState?.document.caption).toBe("loaded-query.sql");

        unmount();
    });

    it("falls back to the numeric MySQL version when versionComment is unavailable", () => {
        const module = new TestDocumentModule({});

        expect((module as unknown as {
            formatConnectionWorkspaceVersion: (details: IConnectionDetails) => string | undefined;
        }).formatConnectionWorkspaceVersion({
            ...connectionDetails,
            versionComment: undefined,
        })).toBe("MySQL 8.4.3");
    });

    it("keeps the generic MySQL versionComment readable while still including the version", () => {
        const module = new TestDocumentModule({});

        expect((module as unknown as {
            formatConnectionWorkspaceVersion: (details: IConnectionDetails) => string | undefined;
        }).formatConnectionWorkspaceVersion({
            ...connectionDetails,
            versionComment: "MySQL",
        })).toBe("MySQL 8.4.3");
    });

    it("includes the TCP port in the desktop status area connection target", () => {
        const module = new TestDocumentModule({});

        expect((module as unknown as {
            formatConnectionWorkspaceTarget: (details: IConnectionDetails) => string | undefined;
        }).formatConnectionWorkspaceTarget({
            ...connectionDetails,
            options: {
                ...connectionDetails.options,
                port: 3307,
            },
        })).toBe("shell@db.internal:3307");
    });

    it("omits the port from socket connection status area targets", () => {
        const module = new TestDocumentModule({});

        expect((module as unknown as {
            formatConnectionWorkspaceTarget: (details: IConnectionDetails) => string | undefined;
        }).formatConnectionWorkspaceTarget({
            ...connectionDetails,
            options: {
                ...connectionDetails.options,
                port: 3307,
                socket: "/tmp/mysql.sock",
            },
        })).toBe("shell@db.internal");
    });

    it("backfills the desktop status area versionComment from the live MySQL session when it is missing", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        let resolveExecute: ((value: { rows: string[][]; }) => void) | undefined;
        const executeSpy = vi.fn().mockImplementation(() => {
            return new Promise<{ rows: string[][]; }>((resolve) => {
                resolveExecute = resolve;
            });
        });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const details: IConnectionDetails = {
            ...connectionDetails,
            versionComment: undefined,
        };
        const fakePage = {
            id: "page-1",
            caption: details.caption,
            details,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                backend: {
                    executeService: executeSpy,
                },
                details,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });

        expect(executeSpy).toHaveBeenCalledWith("SELECT @@version_comment");
        expect(container.textContent).toContain("MySQL 8.4.3");
        expect(container.textContent).not.toContain("MySQL Community Server - GPL (8.4.3)");

        await act(async () => {
            resolveExecute?.({ rows: [["MySQL Community Server - GPL"]] });
            await nextRunLoop();
        });

        expect(details.versionComment).toBe("MySQL Community Server - GPL");
        expect(container.textContent).toContain("MySQL Community Server - GPL (8.4.3)");

        unmount();
    });

    it("prefers live connection details over cached workspace details for the desktop status area", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const staleWorkspaceDetails: IConnectionDetails = {
            ...connectionDetails,
            versionComment: undefined,
        };
        const liveConnectionDetails: IConnectionDetails = {
            ...connectionDetails,
            versionComment: "MySQL Community Server - GPL",
        };
        const fakePage = {
            id: "page-1",
            caption: liveConnectionDetails.caption,
            details: liveConnectionDetails,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                backend: {},
                details: liveConnectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        (moduleRef.current as any).getWorkspaces = () => [{
            id: "connection:42",
            kind: "connection",
            caption: liveConnectionDetails.caption,
            connectionId: 42,
            connectionDetails: staleWorkspaceDetails,
            connectionWorkspace: fakeConnectionWorkspace,
            pageIds: [fakePage.id],
        }];
        (moduleRef.current as any).currentConnectionWorkspaceRef.current = {
            getActiveDesktopDocumentType: () => "script",
            getDesktopRunState: () => ({
                canExecute: true,
                canExecuteSubparts: true,
                canStop: false,
                autoCommit: true,
                transactionOpen: false,
                stopOnErrors: true,
            }),
        };

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });
        await nextRunLoop();

        expect(container.textContent).toContain("MySQL Community Server - GPL (8.4.3)");

        unmount();
    });

    it("updates the desktop status area from the selected connection workspace", async () => {
        Settings.set("editor.showConnectionInfo", true);
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const userConnectionDetails: IConnectionDetails = {
            ...connectionDetails,
            options: {
                user: "shell",
                host: "user-db.internal",
                port: 3308,
            },
            versionComment: "User MySQL",
        };
        const serviceConnectionDetails: IConnectionDetails = {
            ...connectionDetails,
            options: {
                user: "service",
                host: "service-db.internal",
                port: 4407,
            },
            versionComment: "Service MySQL",
        };
        const userPage = {
            id: "user-page-1",
            caption: userConnectionDetails.caption,
            details: userConnectionDetails,
        };
        const servicePage = {
            id: "service-page-1",
            caption: serviceConnectionDetails.caption,
            details: serviceConnectionDetails,
        };
        const userConnectionWorkspace = {
            dataModelEntry: userPage,
            connection: {
                backend: {},
                details: userConnectionDetails,
                isOpen: true,
                currentSchema: "",
                userConnectionId: 18,
                serviceConnectionId: 19,
            },
            suppressAbout: false,
        };
        const serviceConnectionWorkspace = {
            dataModelEntry: servicePage,
            connection: {
                backend: {},
                details: serviceConnectionDetails,
                isOpen: true,
                currentSchema: "",
                userConnectionId: 20,
                serviceConnectionId: 21,
            },
            suppressAbout: false,
        };

        (moduleRef.current as any).connectionPresentation.set(userPage, createConnectionPresentationState());
        (moduleRef.current as any).connectionPresentation.set(servicePage, createConnectionPresentationState());
        (moduleRef.current as any).serviceOnlyConnectionPages.add(servicePage.id);

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [userConnectionWorkspace, serviceConnectionWorkspace] as never,
                selectedPage: userPage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });

        expect(container.querySelector("#desktopStatusArea")?.textContent).toContain("shell@user-db.internal:3308");
        expect(container.querySelector("#desktopStatusArea")?.textContent).not.toContain("service@service-db.internal");
        expect(container.querySelector(".desktopStatusConnectionInfo")?.getAttribute("data-tooltip")).toBeNull();
        expect(container.querySelector(".desktopStatusPrimary")?.getAttribute("data-tooltip")).toBe("expand");

        const indicators = container.querySelector(".desktopStatusIndicators");
        const connectionInfoIndicator = container.querySelector("#desktopStatusConnectionInfoIndicator");
        expect(connectionInfoIndicator?.textContent).toBe("Conn: U:18 S:19");
        expect(connectionInfoIndicator?.getAttribute("data-tooltip"))
            .toBe("User connection ID: 18\nService connection ID: 19");
        expect(indicators?.children[0]?.id).toBe("desktopStatusTransactionIndicator");
        expect(indicators?.children[1]).toBe(connectionInfoIndicator);

        const workspaceProbe = moduleRef.current as unknown as {
            doSwitchTab: (pageId: string) => void;
        };
        await act(async () => {
            workspaceProbe.doSwitchTab(servicePage.id);
            await nextRunLoop();
        });

        expect(container.querySelector("#desktopStatusArea")?.textContent).toContain("service@service-db.internal:4407");
        expect(container.querySelector("#desktopStatusArea")?.textContent).not.toContain("shell@user-db.internal");
        expect(container.querySelector("#desktopStatusConnectionInfoIndicator")?.textContent)
            .toBe("Conn: U:20 S:21");
        expect(container.querySelector("#desktopStatusConnectionInfoIndicator")?.getAttribute("data-tooltip"))
            .toBe("User connection ID: 20\nService connection ID: 21");
        expect(container.querySelector("#desktopStatusTransactionIndicator")?.textContent).toBe("AUTO-COMMIT OFF");

        unmount();
    });

    it("keeps SQLite status area version formatting unchanged", () => {
        const module = new TestDocumentModule({});
        const sqliteDetails: IConnectionDetails = {
            id: 7,
            dbType: DBType.Sqlite,
            caption: "Local SQLite",
            description: "Local SQLite",
            index: 0,
            options: {
                dbFile: "/tmp/local.db",
            },
            version: 30500,
        };

        expect((module as unknown as {
            formatConnectionWorkspaceVersion: (details: IConnectionDetails) => string | undefined;
        }).formatConnectionWorkspaceVersion(sqliteDetails)).toBe("SQLite 3.5.0");
    });

    it("does not render previous and next document buttons after removing the script editor toolbar", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const firstDocument = {
            id: "doc-1",
            caption: "Script 1",
            type: OdmEntityType.Script,
            language: "mysql",
            parent: fakePage,
        };
        const secondDocument = {
            id: "doc-2",
            caption: "Script 2",
            type: OdmEntityType.Script,
            language: "mysql",
            parent: fakePage,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        (moduleRef.current as any).connectionPresentation.set(fakePage, {
            documents: [firstDocument, secondDocument],
            documentStates: [{
                document: firstDocument,
                currentVersion: 0,
                fileName: "/tmp/first.sql",
            }, {
                document: secondDocument,
                currentVersion: 0,
                fileName: "/tmp/second.sql",
            }],
            activeEntry: secondDocument.id,
            heatWaveEnabled: false,
            mleEnabled: false,
            isCloudInstance: false,
            adminPageStates: {},
            graphData: {},
            chatOptionsState: {},
            executionHistory: [],
            currentExecutionHistoryIndex: 0,
            hasExplainError: false,
        });

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });
        await nextRunLoop();
        expect(container.querySelector("#documentSelectorPreviousButton")).toBeFalsy();
        expect(container.querySelector("#documentSelectorNextButton")).toBeFalsy();
        expect(container.querySelector("#documentSelector")).toBeFalsy();

        unmount();
    });

    it("renders the top workspace tabview even when a connection workspace has a single tab", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        (moduleRef.current as any).connectionPresentation.set(fakePage, {
            documents: [],
            documentStates: [],
            activeEntry: "",
            heatWaveEnabled: false,
            mleEnabled: false,
            isCloudInstance: false,
            adminPageStates: {},
            graphData: {},
            chatOptionsState: {},
            executionHistory: [],
            currentExecutionHistoryIndex: 0,
            hasExplainError: false,
        });

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });
        await nextRunLoop();

        expect(container.querySelector("#dbModuleTabHost > .tabview")).toBeTruthy();
        expect(container.querySelector("#dbModuleTabHost .tabAreaContainer")).toBeTruthy();
        expect(container.querySelector("#page-1")).toBeTruthy();

        unmount();
    });

    it("renders one workspace tab per open connection document", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const firstDocument = {
            id: "doc-1",
            caption: "Script 1",
            type: OdmEntityType.Script,
            language: "mysql",
            parent: fakePage,
        };
        const secondDocument = {
            id: "doc-2",
            caption: "Script 2",
            type: OdmEntityType.Script,
            language: "mysql",
            parent: fakePage,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        (moduleRef.current as any).connectionPresentation.set(fakePage, {
            documents: [firstDocument, secondDocument],
            documentStates: [{
                document: firstDocument,
                currentVersion: 0,
                fileName: "/tmp/first.sql",
            }, {
                document: secondDocument,
                currentVersion: 0,
                fileName: "/tmp/second.sql",
            }],
            activeEntry: secondDocument.id,
            heatWaveEnabled: false,
            mleEnabled: false,
            isCloudInstance: false,
            adminPageStates: {},
            graphData: {},
            chatOptionsState: {},
            executionHistory: [],
            currentExecutionHistoryIndex: 0,
            hasExplainError: false,
        });

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });
        await nextRunLoop();

        expect(container.querySelector("#dbModuleTabHost .tabItem#doc-1")).toBeTruthy();
        expect(container.querySelector("#dbModuleTabHost .tabItem#doc-2")).toBeTruthy();
        expect(container.querySelector("#dbModuleTabHost .tabItem.selected#doc-2")).toBeTruthy();

        (moduleRef.current as any).currentConnectionWorkspaceRef.current = null;

        await act(async () => {
            fireEvent.click(container.querySelector("#dbModuleTabHost .tabItem#doc-1")!);
        });

        expect((moduleRef.current as any).connectionPresentation.get(fakePage).activeEntry).toBe(firstDocument.id);
        expect(container.querySelector("#dbModuleTabHost .tabItem.selected#doc-1")).toBeTruthy();

        unmount();
    });

    it("renders SCHEMAS and hides DATABASE CONNECTIONS in Electron connection workspaces", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };
        const sharedConnection = createElectronWorkspaceConnection();
        const roots = (moduleRef.current as any).connectionsDataModel.roots as unknown[];
        roots.splice(0, roots.length, sharedConnection.connection);

        (moduleRef.current as any).connectionPresentation.set(fakePage, createConnectionPresentationState());

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });
        await nextRunLoop();

        expect(container.textContent).not.toContain("DATABASE CONNECTIONS");
        expect(container.textContent).toContain("SCHEMAS");

        unmount();
    });

    it("renders ADMINISTRATION in Electron connection workspaces when admin pages exist", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };
        const sharedConnection = createElectronWorkspaceConnection();
        const roots = (moduleRef.current as any).connectionsDataModel.roots as unknown[];
        roots.splice(0, roots.length, sharedConnection.connection);

        (moduleRef.current as any).connectionPresentation.set(fakePage, createConnectionPresentationState());

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });
        await nextRunLoop();

        expect(container.textContent).toContain("ADMINISTRATION");
        expect(container.querySelector("#administrationSection")).toBeTruthy();
        expect(container.querySelector("#schemasSection")).toBeTruthy();
        expect(
            (container.querySelector("#administrationSection")!.compareDocumentPosition(
                container.querySelector("#schemasSection")!,
            ) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        ).toBe(true);

        unmount();
    });

    it("hides ADMINISTRATION in Electron connection workspaces when no admin pages exist", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };
        const sharedConnection = createElectronWorkspaceConnection({ adminPages: [] });
        const roots = (moduleRef.current as any).connectionsDataModel.roots as unknown[];
        roots.splice(0, roots.length, sharedConnection.connection);

        (moduleRef.current as any).connectionPresentation.set(fakePage, createConnectionPresentationState());

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });
        await nextRunLoop();

        expect(container.textContent).not.toContain("ADMINISTRATION");

        unmount();
    });

    it("opens Electron administration items through the existing admin-page flow", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };
        const sharedConnection = createElectronWorkspaceConnection();
        const roots = (moduleRef.current as any).connectionsDataModel.roots as unknown[];
        roots.splice(0, roots.length, sharedConnection.connection);

        (moduleRef.current as any).connectionPresentation.set(fakePage, createConnectionPresentationState());

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });
        await nextRunLoop();

        expect(container.textContent).toContain("ADMINISTRATION");

        const servicePage = {
            id: "service-page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const serviceConnectionWorkspace = {
            dataModelEntry: servicePage,
            connection: {
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };
        (moduleRef.current as any).connectionPresentation.set(servicePage, createConnectionPresentationState());
        (moduleRef.current as any).serviceOnlyConnectionPages.add(servicePage.id);
        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace, serviceConnectionWorkspace] as never,
            });
        });

        vi.spyOn(moduleRef.current as any, "showPage").mockResolvedValue(true);
        (moduleRef.current as any).currentConnectionWorkspaceRef.current = null;

        await act(async () => {
            await (moduleRef.current as any).handleConnectionEntrySelection(sharedConnection.adminPages[0]);
        });
        await nextRunLoop();

        const connectionState = (moduleRef.current as any).connectionPresentation.get(fakePage);
        expect(connectionState.documentStates).toHaveLength(1);
        expect(connectionState.documentStates[0].document.type).toBe(OdmEntityType.AdminPage);
        expect(connectionState.documentStates[0].document.caption).toBe(sharedConnection.adminPages[0].caption);
        expect(connectionState.activeEntry).toBe(connectionState.documentStates[0].document.id);

        unmount();
    });

    it("keeps connection-bound tabs in their owning workspace", () => {
        const module = new TestDocumentModule({});
        const firstPage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const secondPage = {
            id: "page-2",
            caption: `${connectionDetails.caption} (2)`,
            details: connectionDetails,
        };

        module.state.connectionWorkspaces = [{
            dataModelEntry: firstPage,
            connection: { details: connectionDetails },
            suppressAbout: false,
        }, {
            dataModelEntry: secondPage,
            connection: { details: connectionDetails },
            suppressAbout: false,
        }] as never;
        module.state.shellSessionTabs = [{
            dataModelEntry: {
                id: "shell-1",
                caption: `Session to ${connectionDetails.caption}`,
                details: {
                    dbConnectionId: connectionDetails.id,
                },
            },
            savedState: {},
            workspaceId: "connection:42:page-1",
        }] as never;

        const workspaces = (module as unknown as {
            getWorkspaces: () => Array<{ id: string; pageIds: string[]; }>;
        }).getWorkspaces();

        expect(workspaces.find((workspace) => {
            return workspace.id === "connection:42:page-1";
        })?.pageIds).toContain("shell-1");
        expect(workspaces.find((workspace) => {
            return workspace.id === "connection:42:page-2";
        })?.pageIds).not.toContain("shell-1");
    });

    it("uses unique workspace tab captions and mirrors saved file names", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const firstDocument = {
            id: "doc-1",
            caption: "Script 1",
            type: OdmEntityType.Script,
            language: "mysql",
            parent: fakePage,
        };
        const secondDocument = {
            id: "doc-2",
            caption: "Script 2",
            type: OdmEntityType.Script,
            language: "mysql",
            parent: fakePage,
        };
        const thirdDocument = {
            id: "doc-3",
            caption: "Script 3",
            type: OdmEntityType.Script,
            language: "mysql",
            parent: fakePage,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        (moduleRef.current as any).connectionPresentation.set(fakePage, {
            documents: [firstDocument, secondDocument, thirdDocument],
            documentStates: [{
                document: firstDocument,
                currentVersion: 0,
            }, {
                document: secondDocument,
                currentVersion: 0,
            }, {
                document: thirdDocument,
                currentVersion: 0,
                fileName: "/tmp/report.sql",
            }],
            activeEntry: thirdDocument.id,
            heatWaveEnabled: false,
            mleEnabled: false,
            isCloudInstance: false,
            adminPageStates: {},
            graphData: {},
            chatOptionsState: {},
            executionHistory: [],
            currentExecutionHistoryIndex: 0,
            hasExplainError: false,
        });

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });
        await nextRunLoop();

        expect(container.querySelector("#dbModuleTabHost .tabItem#doc-1 .tabCaption")?.textContent).toContain("Untitled");
        expect(container.querySelector("#dbModuleTabHost .tabItem#doc-2 .tabCaption")?.textContent)
            .toContain("Untitled-1");
        expect(container.querySelector("#dbModuleTabHost .tabItem#doc-3 .tabCaption")?.textContent)
            .toContain("report");

        unmount();
    });

    it("hides titlebar run, add, and more actions outside connection workspaces", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(SimpleEditor.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(SimpleEditor.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        (moduleRef.current as any).currentConnectionWorkspaceRef.current = {
            getActiveDesktopDocumentType: () => "script",
            getDesktopRunState: () => ({
                canExecute: true,
                canExecuteSubparts: true,
                canStop: false,
                autoCommit: false,
                stopOnErrors: true,
            }),
        };

        await act(async () => {
            moduleRef.current!.forceUpdate();
        });

        expect(container.querySelector("#desktopTitlebarRunButton")).toBeFalsy();
        expect(container.querySelector("#desktopTitlebarAddButton")).toBeFalsy();
        expect(container.querySelector("#desktopTitlebarMoreButton")).toBeFalsy();

        const generalDocument = {
            id: "general-doc-1",
            caption: "General Script",
            type: OdmEntityType.StandaloneDocument,
            language: "mysql",
        };

        await act(async () => {
            moduleRef.current!.setState({
                documentTabs: [{
                    dataModelEntry: generalDocument,
                    savedState: {} as never,
                }] as never,
                selectedPage: generalDocument.id,
                selectedWorkspace: "__workspace_general__",
                loading: false,
            });
        });

        expect(container.querySelector("#desktopTitlebarRunButton")).toBeFalsy();
        expect(container.querySelector("#desktopTitlebarAddButton")).toBeFalsy();
        expect(container.querySelector("#desktopTitlebarMoreButton")).toBeFalsy();

        unmount();
    });

    it("shows the titlebar add menu for connection workspaces even when no run context is available", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: "page-1",
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });

        expect(container.querySelector("#desktopTitlebarRunButton")).toBeFalsy();
        expect(container.querySelector("#desktopTitlebarAddButton")).toBeTruthy();
        expect(container.querySelector("#desktopTitlebarMoreButton")).toBeFalsy();

        unmount();
    });

    it("keeps the run button enabled for an active script while editor run state is still initializing", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeDocument = {
            id: "doc-1",
            caption: "Script 1",
            type: OdmEntityType.Script,
            language: "mysql",
            parent: fakePage,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        (moduleRef.current as any).connectionPresentation.set(fakePage, {
            documents: [fakeDocument],
            documentStates: [{
                document: fakeDocument,
                currentVersion: 0,
            }],
            activeEntry: fakeDocument.id,
            heatWaveEnabled: false,
            mleEnabled: false,
            isCloudInstance: false,
            adminPageStates: {},
            graphData: {},
            chatOptionsState: {},
            executionHistory: [],
            currentExecutionHistoryIndex: 0,
            hasExplainError: false,
        });

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });

        (moduleRef.current as any).currentConnectionWorkspaceRef.current = {
            getActiveDesktopDocumentType: () => "script",
            getDesktopRunState: () => undefined,
        };

        await act(async () => {
            moduleRef.current!.forceUpdate();
        });

        const runButton = container.querySelector("#desktopTitlebarRunButton");
        expect(runButton).toBeTruthy();
        expect(runButton?.classList.contains("disabled")).toBe(false);

        unmount();
    });

    it("hides the notebook toolbar in electron and passes history controls to the editor", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        const notebook = new Notebook({
            standaloneMode: false,
            toolbarItemsTemplate: {
                navigation: [],
                execution: [],
                editor: [],
                auxiliary: [],
            },
            savedState: {
                documents: [],
                documentStates: [{
                    document: {
                        id: "notebook-1",
                        caption: "Notebook 1",
                        type: OdmEntityType.Notebook,
                        parent: undefined,
                    },
                    currentVersion: 0,
                }],
                activeEntry: "notebook-1",
                heatWaveEnabled: false,
                mleEnabled: false,
                isCloudInstance: false,
                adminPageStates: {} as never,
                graphData: {} as never,
                chatOptionsState: {} as never,
                executionHistory: [{
                    index: 0,
                    code: "select 1",
                    languageId: "mysql",
                    currentTimestamp: new Date().toISOString(),
                }],
                currentExecutionHistoryIndex: 1,
                hasExplainError: false,
            },
            dbType: DBType.MySQL,
            showAbout: false,
            onNavigateHistory: vi.fn(),
        } as never);

        const rendered = notebook.render() as { props: { children: unknown[]; }; };
        const children = (Array.isArray(rendered.props.children)
            ? rendered.props.children
            : [rendered.props.children]).filter(Boolean);
        const editor = children[0] as {
            props: {
                notebookHistory: {
                    canGoBack: boolean;
                    canGoForward: boolean;
                };
            };
        };

        expect(children).toHaveLength(1);
        expect(editor.props.notebookHistory.canGoBack).toBe(false);
        expect(editor.props.notebookHistory.canGoForward).toBe(true);
    });

    it("keeps notebook history buttons in the toolbar outside electron", async () => {
        delete (window as Window & { electronHost?: unknown; }).electronHost;

        const notebook = new Notebook({
            standaloneMode: false,
            toolbarItemsTemplate: {
                navigation: [],
                execution: [],
                editor: [],
                auxiliary: [],
            },
            savedState: {
                documents: [],
                documentStates: [{
                    document: {
                        id: "notebook-1",
                        caption: "Notebook 1",
                        type: OdmEntityType.Notebook,
                        parent: undefined,
                    },
                    currentVersion: 0,
                }],
                activeEntry: "notebook-1",
                heatWaveEnabled: false,
                mleEnabled: false,
                isCloudInstance: false,
                adminPageStates: {} as never,
                graphData: {} as never,
                chatOptionsState: {} as never,
                executionHistory: [{
                    index: 0,
                    code: "select 1",
                    languageId: "mysql",
                    currentTimestamp: new Date().toISOString(),
                }],
                currentExecutionHistoryIndex: 1,
                hasExplainError: false,
            },
            dbType: DBType.MySQL,
            showAbout: false,
            onNavigateHistory: vi.fn(),
        } as never);

        const rendered = notebook.render() as { props: { children: unknown[]; }; };
        const children = (Array.isArray(rendered.props.children)
            ? rendered.props.children
            : [rendered.props.children]).filter(Boolean);
        const toolbar = children[0] as {
            props: {
                toolbarItems: {
                    navigation: Array<{ key: string | null; props: { id?: string; }; }>;
                };
            };
        };

        expect(toolbar.props.toolbarItems.navigation[0]?.key).toBe("editorNotebookHistoryBackButton");
        expect(toolbar.props.toolbarItems.navigation[1]?.key).toBe("editorNotebookHistoryForwardButton");
    });

    it("renders the titlebar run split button and routes run actions through the existing handlers", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const killQuerySpy = vi.fn().mockResolvedValue(undefined);
        const killSessionSpy = vi.fn().mockResolvedValue(undefined);
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                backend: {
                    killQuery: killQuerySpy,
                    killSession: killSessionSpy,
                },
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: "page-1",
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });

        const requisitionSpy = vi.spyOn(requisitions, "execute").mockImplementation(async (requestType: string) => {
            return [
                "editorFind",
                "editorExecuteSelectedOrAll",
                "editorExecute",
                "editorVisualExplain",
                "editorLoadNotebook",
            ].includes(requestType);
        });
        const sideBarDocumentCommandSpy = vi.spyOn(moduleRef.current as any, "handleSideBarDocumentCommand")
            .mockResolvedValue({ success: true });
        const addNotebookSpy = vi.spyOn(moduleRef.current as any, "handleAddNotebook")
            .mockReturnValue("new-notebook-id");
        const runState = {
            canExecute: true,
            canExecuteSubparts: true,
            canStop: false,
            autoCommit: false,
            transactionOpen: true,
            stopOnErrors: true,
        };
        (moduleRef.current as any).currentConnectionWorkspaceRef.current = {
            getActiveDesktopDocumentType: () => "script",
            getDesktopRunState: () => runState,
        };

        await act(async () => {
            moduleRef.current!.forceUpdate();
        });

        const statusArea = container.querySelector("#desktopStatusArea");
        expect(statusArea).toBeTruthy();
        expect(container.textContent).toContain("shell@db.internal");
        expect(container.textContent).toContain("MySQL Community Server - GPL (8.4.3)");
        expect(container.textContent).toContain("Connected");
        expect(statusArea?.querySelector("#desktopStatusTransactionIndicator")?.textContent).toBe("TX OPEN");
        expect(statusArea?.querySelector("#desktopStatusTransactionIndicator")?.classList.contains(
            "desktopStatusIndicatorActive",
        )).toBe(true);
        expect(container.querySelector("#desktopTitlebarRunButton")).toBeTruthy();
        expect(container.querySelector("#desktopTitlebarAddButton")).toBeTruthy();
        expect(container.querySelector("#desktopTitlebarMoreButton")).toBeFalsy();
        expect(statusArea?.querySelector("#desktopTitlebarStopButton")).toBeFalsy();
        expect(statusArea?.querySelector("#desktopStatusTimer")).toBeFalsy();
        expect(statusArea?.querySelector(".desktopStatusSpinner")).toBeFalsy();
        expect(container.querySelector("#desktopTitlebarRunButton")?.closest("#desktopWorkspaceTitlebar")).toBeTruthy();
        expect(
            (container.querySelector("#desktopTitlebarRunButton")!.compareDocumentPosition(
                container.querySelector("#desktopTitlebarAddButton")!,
            ) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        ).toBe(true);

        await act(async () => {
            fireEvent.click(container.querySelector("#desktopTitlebarRunButton .splitButtonPrimary")!);
        });
        expect(requisitionSpy).toHaveBeenCalledWith("editorExecuteSelectedOrAll", {
            advance: false,
            forceSecondaryEngine: false,
            asText: false,
            is3rdLanguage: undefined,
        });

        await act(async () => {
            fireEvent.click(container.querySelector("#desktopTitlebarRunButton .splitButtonTrigger")!);
        });
        await nextRunLoop();
        expect(document.getElementById("desktopTitlebarRunExecuteCurrentItem")).toBeTruthy();

        await act(async () => {
            fireEvent.click(document.getElementById("desktopTitlebarRunExecuteCurrentItem")!);
        });
        expect(requisitionSpy).toHaveBeenCalledWith("editorExecute", {
            advance: false,
            forceSecondaryEngine: false,
            asText: false,
            is3rdLanguage: undefined,
        });
        await nextRunLoop();

        await act(async () => {
            fireEvent.click(container.querySelector("#desktopTitlebarRunButton .splitButtonTrigger")!);
        });
        await nextRunLoop();
        expect(document.getElementById("desktopTitlebarRunExecuteAsTextItem")).toBeTruthy();
        expect(document.getElementById("desktopTitlebarRunExplainSeparator")).toBeTruthy();
        expect(document.getElementById("desktopTitlebarRunExplainItem")).toBeTruthy();
        expect(document.getElementById("desktopTitlebarRunExplainAnalyzeItem")).toBeTruthy();
        expect(document.getElementById("desktopTitlebarRunVisualExplainItem")).toBeTruthy();
        expect(document.getElementById("desktopTitlebarRunVisualExplainAnalyzeItem")).toBeTruthy();

        await act(async () => {
            fireEvent.click(document.getElementById("desktopTitlebarRunExplainItem")!);
        });
        expect(requisitionSpy).toHaveBeenCalledWith("editorExecute", {
            advance: false,
            forceSecondaryEngine: false,
            asText: true,
            explain: true,
            is3rdLanguage: undefined,
        });
        await nextRunLoop();

        await act(async () => {
            fireEvent.click(container.querySelector("#desktopTitlebarRunButton .splitButtonTrigger")!);
        });
        await nextRunLoop();
        expect(document.getElementById("desktopTitlebarRunExplainAnalyzeItem")).toBeTruthy();

        await act(async () => {
            fireEvent.click(document.getElementById("desktopTitlebarRunExplainAnalyzeItem")!);
        });
        expect(requisitionSpy).toHaveBeenCalledWith("editorExecute", {
            advance: false,
            forceSecondaryEngine: false,
            asText: true,
            explainAnalyze: true,
            is3rdLanguage: undefined,
        });
        await nextRunLoop();

        await act(async () => {
            fireEvent.click(container.querySelector("#desktopTitlebarRunButton .splitButtonTrigger")!);
        });
        await nextRunLoop();
        expect(document.getElementById("desktopTitlebarRunVisualExplainItem")).toBeTruthy();

        await act(async () => {
            fireEvent.click(document.getElementById("desktopTitlebarRunVisualExplainItem")!);
        });
        expect(requisitionSpy).toHaveBeenCalledWith("editorVisualExplain", {
            is3rdLanguage: undefined,
        });
        await nextRunLoop();

        await act(async () => {
            fireEvent.click(container.querySelector("#desktopTitlebarRunButton .splitButtonTrigger")!);
        });
        await nextRunLoop();
        expect(document.getElementById("desktopTitlebarRunVisualExplainAnalyzeItem")).toBeTruthy();

        await act(async () => {
            fireEvent.click(document.getElementById("desktopTitlebarRunVisualExplainAnalyzeItem")!);
        });
        expect(requisitionSpy).toHaveBeenCalledWith("editorVisualExplain", {
            is3rdLanguage: undefined,
            visualExplainAnalyze: true,
        });
        await nextRunLoop();

        await act(async () => {
            fireEvent.click(container.querySelector("#desktopTitlebarRunButton .splitButtonTrigger")!);
        });
        await nextRunLoop();
        expect(document.getElementById("desktopTitlebarRunExecuteAsTextItem")).toBeTruthy();

        await act(async () => {
            fireEvent.click(document.getElementById("desktopTitlebarRunExecuteAsTextItem")!);
        });
        expect(requisitionSpy).toHaveBeenCalledWith("editorExecuteSelectedOrAll", {
            advance: true,
            forceSecondaryEngine: false,
            asText: true,
            is3rdLanguage: undefined,
        });

        const menuOpenSpy = vi.spyOn(Menu.prototype, "open");
        await act(async () => {
            fireEvent.click(container.querySelector("#desktopTitlebarAddButton")!, {
                clientX: 420,
                clientY: 80,
            });
        });
        await nextRunLoop();
        expect(menuOpenSpy).toHaveBeenLastCalledWith(expect.objectContaining({
            x: 420,
            y: 80,
            width: 2,
            height: 2,
        }), false);
        expect(document.getElementById("desktopTitlebarAddNewScriptItem")).toBeTruthy();
        expect(document.getElementById("desktopTitlebarAddNewNotebookItem")).toBeTruthy();
        expect(document.getElementById("desktopTitlebarAddOpenScriptItem")).toBeTruthy();
        expect(document.getElementById("desktopTitlebarAddOpenNotebookItem")).toBeTruthy();

        await act(async () => {
            fireEvent.click(document.getElementById("desktopTitlebarAddNewScriptItem")!);
            await nextRunLoop();
        });
        expect(sideBarDocumentCommandSpy).toHaveBeenCalledWith({ title: "", command: "msg.addScript" }, fakePage);

        await act(async () => {
            fireEvent.click(container.querySelector("#desktopTitlebarAddButton")!);
        });
        await nextRunLoop();
        await act(async () => {
            fireEvent.click(document.getElementById("desktopTitlebarAddNewNotebookItem")!);
            await nextRunLoop();
        });
        expect(addNotebookSpy).toHaveBeenCalledWith("page-1");

        await act(async () => {
            fireEvent.click(container.querySelector("#desktopTitlebarAddButton")!);
        });
        await nextRunLoop();
        await act(async () => {
            fireEvent.click(document.getElementById("desktopTitlebarAddOpenScriptItem")!);
            await nextRunLoop();
        });
        expect(sideBarDocumentCommandSpy).toHaveBeenCalledWith(
            { title: "", command: "msg.loadScriptFromDisk" },
            fakePage,
        );

        await act(async () => {
            fireEvent.click(container.querySelector("#desktopTitlebarAddButton")!);
        });
        await nextRunLoop();
        await act(async () => {
            fireEvent.click(document.getElementById("desktopTitlebarAddOpenNotebookItem")!);
            await nextRunLoop();
        });
        expect(addNotebookSpy).toHaveBeenCalledTimes(1);
        expect(requisitionSpy).toHaveBeenCalledWith("editorLoadNotebook", { createNew: true });

        const showNativeMenu = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
                showNativeMenu,
                closeNativeMenu: vi.fn().mockResolvedValue(undefined),
                setNativeMenuHandler: vi.fn(),
            },
        });

        await act(async () => {
            fireEvent.click(container.querySelector("#desktopTitlebarAddButton")!, {
                clientX: 460,
                clientY: 90,
            });
            await nextRunLoop();
        });
        expect(showNativeMenu).toHaveBeenCalledWith(expect.objectContaining({
            x: undefined,
            y: undefined,
            items: expect.arrayContaining([
                expect.objectContaining({ label: "New Script" }),
                expect.objectContaining({ label: "New Notebook" }),
                expect.objectContaining({ label: "Open Script..." }),
                expect.objectContaining({ label: "Open Notebook..." }),
            ]),
        }));

        showNativeMenu.mockClear();
        await act(async () => {
            fireEvent.click(container.querySelector("#desktopTitlebarRunButton .splitButtonTrigger")!, {
                clientX: 500,
                clientY: 90,
            });
            await nextRunLoop();
        });
        expect(showNativeMenu).toHaveBeenCalledWith(expect.objectContaining({
            x: undefined,
            y: undefined,
            items: expect.arrayContaining([
                expect.objectContaining({ label: "Run Script", accelerator: "CmdOrCtrl+Enter" }),
                expect.objectContaining({
                    label: "Run Current Statement",
                    accelerator: "Shift+CmdOrCtrl+Enter",
                }),
                expect.objectContaining({ label: "Run (Results as Text)", accelerator: "Alt+Enter" }),
                expect.objectContaining({ label: "Explain" }),
                expect.objectContaining({ label: "Explain Analyze" }),
                expect.objectContaining({ label: "Visual Explain" }),
                expect.objectContaining({ label: "Visual Explain Analyze" }),
            ]),
        }));

        vi.useRealTimers();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
        runState.canStop = true;
        await act(async () => {
            moduleRef.current!.forceUpdate();
        });

        expect(statusArea?.querySelector("#desktopTitlebarStopButton")).toBeFalsy();
        expect(container.querySelector("#desktopTitlebarRunButton")?.textContent).toContain("Stop");
        expect(container.querySelector("#desktopTitlebarRunButton .splitButtonTrigger")).toBeTruthy();
        expect(statusArea?.querySelector(".desktopStatusSpinner")).toBeTruthy();
        expect(statusArea?.querySelector("#desktopStatusTimer")?.textContent).toBe("0s");
        expect(container.textContent).toContain("Executing SQL");

        await act(async () => {
            vi.advanceTimersByTime(2000);
        });
        expect(statusArea?.querySelector("#desktopStatusTimer")?.textContent).toBe("2s");

        showNativeMenu.mockClear();
        await act(async () => {
            fireEvent.click(container.querySelector("#desktopTitlebarRunButton .splitButtonTrigger")!, {
                clientX: 520,
                clientY: 90,
            });
            await Promise.resolve();
        });
        expect(showNativeMenu).toHaveBeenCalledWith(expect.objectContaining({
            x: undefined,
            y: undefined,
            items: expect.arrayContaining([
                expect.objectContaining({ label: "Kill Query" }),
                expect.objectContaining({ label: "Kill Session" }),
            ]),
        }));

        await act(async () => {
            fireEvent.click(container.querySelector("#desktopTitlebarRunButton .splitButtonPrimary")!);
        });
        expect(killQuerySpy).toHaveBeenCalled();

        await act(async () => {
            (moduleRef.current as any).handleDesktopTitlebarRunMenuItemClick({
                command: { command: "run.killSession" },
            });
            await Promise.resolve();
        });
        expect(killSessionSpy).toHaveBeenCalled();

        unmount();
    });

    it("renders offline connection workspaces as disconnected and disables editor actions", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const offlineDetails = {
            ...connectionDetails,
            options: {
                ...connectionDetails.options,
                host: "localhost",
                port: 3306,
            },
        };
        const fakePage = {
            id: "offline-page-1",
            caption: offlineDetails.caption,
            details: offlineDetails,
        };
        const fakeConnection = {
            backend: {},
            close: vi.fn().mockResolvedValue(undefined),
            details: offlineDetails,
            isOpen: false,
            isOffline: true,
            currentSchema: "",
        };
        const adminPage = {
            id: "offline-server-status",
            caption: "Server Status",
            type: OdmEntityType.AdminPage,
            pageType: "serverStatus",
            parent: fakePage,
            state: {
                isLeaf: true,
                initialized: true,
                expanded: true,
                expandedOnce: true,
            },
            connection: fakeConnection,
            getChildren: () => {
                return [];
            },
        };
        const adminEntry = {
            pages: [adminPage],
        };
        Object.assign(fakeConnection, { adminEntry });
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: fakeConnection,
            suppressAbout: false,
        };

        (moduleRef.current as any).connectionPresentation.set(fakePage, createConnectionPresentationState([
            adminPage,
        ], adminPage.id));

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });

        const statusArea = container.querySelector("#desktopStatusArea");
        expect(statusArea?.textContent).toContain("shell@localhost:3306");
        expect(statusArea?.textContent).toContain("OFFLINE");
        expect(statusArea?.textContent).toContain("Disconnected");
        expect(statusArea?.textContent).not.toContain("MySQL Community Server - GPL");
        expect(statusArea?.querySelector("#desktopStatusTransactionIndicator")).toBeFalsy();

        const commandState = desktopCommandRegistry.getState();
        expect(commandState.find((entry) => {
            return entry.id === "desktop.newScriptTab";
        })?.enabled).toBe(false);
        expect(commandState.find((entry) => {
            return entry.id === "desktop.newNotebookTab";
        })?.enabled).toBe(false);
        expect(commandState.find((entry) => {
            return entry.id === "run.execute";
        })?.enabled).toBe(false);
        expect(commandState.find((entry) => {
            return entry.id === "database.admin.serverStatus";
        })?.enabled).toBe(true);
        expect(commandState.find((entry) => {
            return entry.id === "database.admin.clientConnections";
        })?.enabled).toBe(false);
        expect(commandState.find((entry) => {
            return entry.id === "database.admin.performanceDashboard";
        })?.enabled).toBe(false);
        expect(commandState.find((entry) => {
            return entry.id === "database.admin.lakehouseNavigator";
        })?.enabled).toBe(false);

        const activateConnectionWorkspaceSpy = vi.spyOn(moduleRef.current as any, "activateConnectionWorkspace");
        expect(await desktopCommandRegistry.execute("database.admin.serverStatus")).toBe(true);
        expect(activateConnectionWorkspaceSpy).not.toHaveBeenCalled();

        unmount();
    });

    it("renders numeric auto-commit state as active in the desktop status area", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                backend: {
                    killQuery: vi.fn().mockResolvedValue(undefined),
                },
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: "page-1",
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });

        (moduleRef.current as any).currentConnectionWorkspaceRef.current = {
            getActiveDesktopDocumentType: () => "script",
            getDesktopRunState: () => ({
                canExecute: true,
                canExecuteSubparts: true,
                canStop: false,
                autoCommit: 1,
                transactionOpen: 0,
                stopOnErrors: true,
            }),
        };

        await act(async () => {
            moduleRef.current!.forceUpdate();
        });

        const transactionIndicator = container.querySelector("#desktopStatusTransactionIndicator");
        expect(transactionIndicator?.textContent).toBe("AUTO-COMMIT ON");
        expect(transactionIndicator?.classList.contains("desktopStatusIndicatorActive")).toBe(true);

        unmount();
    });

    it("opens the titlebar run menu with the native menu implementation", async () => {
        const showNativeMenu = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
                showNativeMenu,
                closeNativeMenu: vi.fn().mockResolvedValue(undefined),
                setNativeMenuHandler: vi.fn(),
            },
        });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: "page-1",
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });

        (moduleRef.current as any).currentConnectionWorkspaceRef.current = {
            getActiveDesktopDocumentType: () => "script",
            getDesktopRunState: () => ({
                canExecute: true,
                canExecuteSubparts: true,
                canStop: false,
                autoCommit: false,
                stopOnErrors: true,
            }),
        };

        await act(async () => {
            moduleRef.current!.forceUpdate();
        });

        const runTrigger = container.querySelector("#desktopTitlebarRunButton .splitButtonTrigger")!;
        await act(async () => {
            fireEvent.click(runTrigger, {
                clientX: 240,
                clientY: 25,
            });
        });
        await nextRunLoop();

        expect(showNativeMenu).toHaveBeenCalledWith(expect.objectContaining({
            x: undefined,
            y: undefined,
            items: expect.arrayContaining([
                expect.objectContaining({ label: "Run Current Statement" }),
                expect.objectContaining({ label: "Run (Results as Text)" }),
                expect.objectContaining({ label: "Explain" }),
                expect.objectContaining({ label: "Explain Analyze" }),
                expect.objectContaining({ label: "Visual Explain" }),
                expect.objectContaining({ label: "Visual Explain Analyze" }),
            ]),
        }));

        unmount();
    });

    it("clears the titlebar stopping state when the active execution context becomes idle", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentDidUpdate").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentWillUnmount").mockImplementation(() => { });
        vi.spyOn(desktopCommandRegistry, "notifyHostStateChanged").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeDocument = {
            id: "doc-1",
            caption: "Script 1",
            type: OdmEntityType.Script,
            language: "mysql",
            parent: fakePage,
        };
        const killQuerySpy = vi.fn().mockImplementation(() => {
            return new Promise<void>(() => {
                // Keep the backend stop request unresolved to model the live transport race.
            });
        });
        const fakeExecutionContext = {
            loadingState: LoadingState.Loading,
            isSQLLike: true,
            executionEnded: () => {
                fakeExecutionContext.loadingState = LoadingState.Idle;
            },
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                backend: {
                    killQuery: killQuerySpy,
                },
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        (moduleRef.current as any).connectionPresentation.set(fakePage, {
            documents: [fakeDocument],
            documentStates: [{
                document: fakeDocument,
                currentVersion: 0,
                state: {
                    model: {
                        getLanguageId: () => {
                            return "mysql";
                        },
                        getVersionId: () => {
                            return 0;
                        },
                        is3rdLanguage: false,
                        executionContexts: {
                            dispose: () => { },
                            cursorPosition: {},
                            contextFromPosition: () => {
                                return fakeExecutionContext;
                            },
                        },
                        dispose: () => { },
                    },
                },
            }],
            activeEntry: fakeDocument.id,
            heatWaveEnabled: false,
            mleEnabled: false,
            isCloudInstance: false,
            adminPageStates: {},
            graphData: {},
            chatOptionsState: {},
            executionHistory: [],
            currentExecutionHistoryIndex: 0,
            hasExplainError: false,
        });

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });

        const selectedConnectionWorkspaceRef = (moduleRef.current as any).connectionWorkspaceRefs.get(fakePage.id);
        expect(selectedConnectionWorkspaceRef).toBeDefined();
        vi.spyOn(selectedConnectionWorkspaceRef, "getActiveDesktopDocumentType").mockReturnValue("script");
        vi.spyOn(selectedConnectionWorkspaceRef, "getDesktopRunState").mockImplementation(() => {
            return {
                canExecute: false,
                canExecuteSubparts: true,
                canStop: fakeExecutionContext.loadingState !== LoadingState.Idle,
                autoCommit: false,
                stopOnErrors: true,
            };
        });
        vi.spyOn(moduleRef.current as any, "getActiveDesktopExecutionContext").mockImplementation(() => {
            return {
                activeType: "script",
                activeConnectionState: (moduleRef.current as any).connectionPresentation.get(fakePage),
                activeDocumentState: (moduleRef.current as any).connectionPresentation.get(fakePage).documentStates[0],
                editorExecutionContext: fakeExecutionContext,
                desktopRunState: {
                    canExecute: fakeExecutionContext.loadingState === LoadingState.Idle,
                    canExecuteSubparts: true,
                    canStop: fakeExecutionContext.loadingState !== LoadingState.Idle,
                    autoCommit: false,
                    stopOnErrors: true,
                },
            };
        });

        await act(async () => {
            moduleRef.current!.forceUpdate();
        });

        await act(async () => {
            expect(await (moduleRef.current as any).stopActiveDesktopExecution()).toBe(true);
            await nextRunLoop();
        });

        expect(killQuerySpy).toHaveBeenCalled();
        expect((moduleRef.current as any).state.desktopStoppingWorkspaces).toContain("connection:42:page-1");

        await act(async () => {
            await new Promise<void>((resolve) => {
                setTimeout(resolve, 1100);
            });
        });

        expect(fakeExecutionContext.loadingState).toBe(LoadingState.Loading);
        expect((moduleRef.current as any).state.desktopStoppingWorkspaces).not.toContain("connection:42:page-1");

        unmount();
    });

    it("updates command enablement for the active connection page and reuses existing handlers", async () => {
        const postMessage = vi.fn();
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage,
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentDidUpdate").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const initialState = desktopCommandRegistry.getState();
        expect(initialState.find((entry) => entry.id === "desktop.newScriptTab")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "desktop.newNotebookTab")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "file.closeDocument")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "file.close")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "edit.previousCommand")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "edit.nextCommand")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "edit.reformat")).toEqual(expect.objectContaining({
            enabled: false,
            accelerator: "Shift+Alt+F",
        }));
        expect(initialState.find((entry) => entry.id === "view.find")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "view.toggleSidebar")).toEqual(expect.objectContaining({
            enabled: true,
            accelerator: "CmdOrCtrl+B",
        }));
        expect(initialState.find((entry) => entry.id === "view.showHiddenCharacters")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "view.softWrap")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "view.schemas.showSystemSchemas")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "run.execute")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "run.executeCurrent")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "run.executeAsText")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "run.explain")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "run.explainAnalyze")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "run.visualExplain")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "run.visualExplainAnalyze")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "run.stop")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "run.stopOnError")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "run.autoCommit")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "database.admin.serverStatus")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "database.admin.clientConnections")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "database.admin.userAccounts")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "database.admin.performanceDashboard")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "database.admin.enterpriseBackup")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "database.admin.lakehouseNavigator")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "database.mrs.configure")?.enabled).toBe(false);
        expect(initialState.find((entry) => entry.id === "database.mrs.browseDocs")?.enabled).toBe(true);

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeDocument = {
            id: "doc-1",
            caption: "Script 1",
            type: OdmEntityType.Script,
            language: "mysql",
            parent: fakePage,
        };
        const killQuerySpy = vi.fn().mockResolvedValue(undefined);
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                backend: {
                    killQuery: killQuerySpy,
                },
                close: vi.fn().mockResolvedValue(undefined),
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        (moduleRef.current as any).connectionPresentation.set(fakePage, {
            documents: [fakeDocument],
            documentStates: [{
                document: fakeDocument,
                currentVersion: 0,
            }],
            activeEntry: fakeDocument.id,
            heatWaveEnabled: false,
            mleEnabled: false,
            isCloudInstance: false,
            adminPageStates: {},
            graphData: {},
            chatOptionsState: {},
            executionHistory: [],
            currentExecutionHistoryIndex: 0,
            hasExplainError: false,
        });

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: "page-1",
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });

        const activePageState = desktopCommandRegistry.getState();
        expect(activePageState.find((entry) => {
            return entry.id === "file.open";
        })?.enabled).toBe(true);
        expect(activePageState.find((entry) => {
            return entry.id === "desktop.newScriptTab";
        })?.enabled).toBe(true);
        expect(activePageState.find((entry) => {
            return entry.id === "desktop.newNotebookTab";
        })?.enabled).toBe(true);

        const selectedConnectionWorkspaceRef = (moduleRef.current as any).connectionWorkspaceRefs.get(fakePage.id);
        expect(selectedConnectionWorkspaceRef).toBeDefined();

        const saveActiveDocumentSpy = vi.spyOn(selectedConnectionWorkspaceRef, "saveActiveDocument")
            .mockResolvedValue(true);
        const confirmCloseSpy = vi.spyOn(selectedConnectionWorkspaceRef, "confirmClose")
            .mockResolvedValue(true);
        vi.spyOn(selectedConnectionWorkspaceRef, "getActiveDesktopDocumentType").mockReturnValue("script");
        vi.spyOn(selectedConnectionWorkspaceRef, "getDesktopRunState").mockReturnValue({
            canExecute: true,
            canExecuteSubparts: true,
            canStop: false,
            autoCommit: false,
            stopOnErrors: true,
        });
        vi.spyOn(selectedConnectionWorkspaceRef, "canNavigateHistory").mockImplementation((backwards: boolean) => {
            return backwards;
        });
        const requisitionSpy = vi.spyOn(requisitions, "execute").mockImplementation(async (requestType: string) => {
            return [
                "editorFind",
                "editorFormat",
                "editorExecuteSelectedOrAll",
                "editorExecute",
                "editorVisualExplain",
                "editorToggleStopExecutionOnError",
                "editorToggleAutoCommit",
            ].includes(requestType);
        });
        desktopCommandRegistry.notifyHostStateChanged();

        const desktopFileState = desktopCommandRegistry.getState();
        expect(desktopFileState.find((entry) => entry.id === "file.open")?.enabled).toBe(true);
        expect(desktopFileState.find((entry) => entry.id === "file.save")?.enabled).toBe(true);
        expect(desktopFileState.find((entry) => entry.id === "file.saveAs")?.enabled).toBe(true);
        expect(desktopFileState.find((entry) => entry.id === "file.closeDocument")?.enabled).toBe(true);
        expect(desktopFileState.find((entry) => entry.id === "file.close")?.enabled).toBe(true);
        expect(desktopFileState.find((entry) => entry.id === "edit.previousCommand")?.enabled).toBe(false);
        expect(desktopFileState.find((entry) => entry.id === "edit.nextCommand")?.enabled).toBe(false);
        expect(desktopFileState.find((entry) => entry.id === "edit.reformat")).toEqual(expect.objectContaining({
            enabled: true,
            accelerator: "Shift+Alt+F",
        }));
        expect(desktopFileState.find((entry) => entry.id === "view.find")?.enabled).toBe(true);
        expect(desktopFileState.find((entry) => entry.id === "view.showHiddenCharacters")?.checked).toBe(false);
        expect(desktopFileState.find((entry) => entry.id === "view.softWrap")?.checked).toBe(false);
        expect(desktopFileState.find((entry) => entry.id === "view.schemas.showSystemSchemas")?.checked).toBe(false);
        expect(desktopFileState.find((entry) => entry.id === "run.execute")?.enabled).toBe(true);
        expect(desktopFileState.find((entry) => entry.id === "run.executeCurrent")?.enabled).toBe(true);
        expect(desktopFileState.find((entry) => entry.id === "run.executeAsText")?.enabled).toBe(true);
        expect(desktopFileState.find((entry) => entry.id === "run.explain")?.enabled).toBe(true);
        expect(desktopFileState.find((entry) => entry.id === "run.explainAnalyze")?.enabled).toBe(true);
        expect(desktopFileState.find((entry) => entry.id === "run.visualExplain")?.enabled).toBe(true);
        expect(desktopFileState.find((entry) => entry.id === "run.visualExplainAnalyze")?.enabled).toBe(true);
        expect(desktopFileState.find((entry) => entry.id === "run.stop")?.enabled).toBe(false);
        expect(desktopFileState.find((entry) => entry.id === "run.stopOnError")?.checked).toBe(true);
        expect(desktopFileState.find((entry) => entry.id === "run.autoCommit")?.checked).toBe(false);
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            command: "desktopCommandStateChanged",
            data: expect.objectContaining({
                commands: expect.arrayContaining([
                    expect.objectContaining({ id: "file.open", enabled: true }),
                    expect.objectContaining({ id: "file.save", enabled: true }),
                    expect.objectContaining({ id: "file.saveAs", enabled: true }),
                    expect.objectContaining({ id: "file.closeDocument", enabled: true }),
                    expect.objectContaining({ id: "file.close", enabled: true }),
                    expect.objectContaining({ id: "edit.previousCommand", enabled: false }),
                    expect.objectContaining({ id: "edit.nextCommand", enabled: false }),
                    expect.objectContaining({ id: "desktop.newScriptTab", enabled: true }),
                    expect.objectContaining({ id: "desktop.newNotebookTab", enabled: true }),
                    expect.objectContaining({
                        id: "edit.reformat",
                        enabled: true,
                        accelerator: "Shift+Alt+F",
                    }),
                    expect.objectContaining({ id: "view.find", enabled: true }),
                    expect.objectContaining({ id: "view.toggleSidebar", enabled: true }),
                    expect.objectContaining({ id: "view.showHiddenCharacters", enabled: true, checked: false }),
                    expect.objectContaining({ id: "view.softWrap", enabled: true, checked: false }),
                    expect.objectContaining({ id: "view.schemas.showSystemSchemas", enabled: true, checked: false }),
                    expect.objectContaining({ id: "run.execute", enabled: true }),
                    expect.objectContaining({ id: "run.executeCurrent", enabled: true }),
                    expect.objectContaining({ id: "run.executeAsText", enabled: true }),
                    expect.objectContaining({ id: "run.explain", enabled: true }),
                    expect.objectContaining({ id: "run.explainAnalyze", enabled: true }),
                    expect.objectContaining({ id: "run.visualExplain", enabled: true }),
                    expect.objectContaining({ id: "run.visualExplainAnalyze", enabled: true }),
                    expect.objectContaining({ id: "run.stop", enabled: false }),
                    expect.objectContaining({ id: "run.stopOnError", enabled: true, checked: true }),
                    expect.objectContaining({ id: "run.autoCommit", enabled: true, checked: false }),
                ]),
            }),
        }));

        const openSupportedFileSpy = vi.spyOn(moduleRef.current as any,
            "openDesktopSupportedFileFromDisk").mockResolvedValue(true);
        const createScriptSpy = vi.spyOn(moduleRef.current as any,
            "createAndSelectScriptDocument").mockResolvedValue(undefined);
        const addNotebookSpy = vi.spyOn(moduleRef.current as any, "handleAddNotebook").mockReturnValue("notebook-1");
        const closeConnectionDocumentSpy = vi.spyOn(moduleRef.current as any,
            "closeConnectionDocument").mockResolvedValue(true);
        const removeTabsSpy = vi.spyOn(moduleRef.current as any, "removeTabs").mockResolvedValue(true);

        expect(await desktopCommandRegistry.execute("desktop.newScriptTab")).toBe(true);
        expect(createScriptSpy).toHaveBeenLastCalledWith(
            connectionDetails,
            expect.stringContaining("Script"),
            "mysql",
            "",
            "page-1",
        );

        expect(await desktopCommandRegistry.execute("desktop.newNotebookTab")).toBe(true);
        expect(addNotebookSpy).toHaveBeenCalledWith("page-1");

        expect(await desktopCommandRegistry.execute("file.open")).toBe(true);
        expect(openSupportedFileSpy).toHaveBeenCalled();

        expect(await desktopCommandRegistry.execute("file.save")).toBe(true);
        expect(saveActiveDocumentSpy).toHaveBeenCalledWith(false);

        expect(await desktopCommandRegistry.execute("file.saveAs")).toBe(true);
        expect(saveActiveDocumentSpy).toHaveBeenCalledWith(true);

        expect(await desktopCommandRegistry.execute("view.find")).toBe(true);
        expect(requisitionSpy).toHaveBeenCalledWith("editorFind", undefined);

        expect(await desktopCommandRegistry.execute("edit.reformat")).toBe(true);
        expect(requisitionSpy).toHaveBeenCalledWith("editorFormat", undefined);

        expect(await desktopCommandRegistry.execute("view.showHiddenCharacters")).toBe(true);
        expect(Settings.get("editor.showHidden", false)).toBe(true);
        expect(desktopCommandRegistry.getState().find((entry) => {
            return entry.id === "view.showHiddenCharacters";
        })?.checked).toBe(true);

        expect(await desktopCommandRegistry.execute("view.softWrap")).toBe(true);
        expect(Settings.get("editor.wordWrap", "off")).toBe("on");
        expect(desktopCommandRegistry.getState().find((entry) => {
            return entry.id === "view.softWrap";
        })?.checked).toBe(true);

        await act(async () => {
            expect(await desktopCommandRegistry.execute("view.toggleSidebar")).toBe(true);
        });
        expect(moduleRef.current!.state.showSidebar).toBe(false);

        expect(await desktopCommandRegistry.execute("run.execute")).toBe(true);
        expect(requisitionSpy).toHaveBeenCalledWith("editorExecuteSelectedOrAll", {
            advance: false,
            forceSecondaryEngine: false,
            asText: false,
            is3rdLanguage: undefined,
        });

        expect(await desktopCommandRegistry.execute("run.executeCurrent")).toBe(true);
        expect(requisitionSpy).toHaveBeenCalledWith("editorExecute", {
            advance: false,
            forceSecondaryEngine: false,
            asText: false,
            is3rdLanguage: undefined,
        });

        expect(await desktopCommandRegistry.execute("run.executeAsText")).toBe(true);
        expect(requisitionSpy).toHaveBeenCalledWith("editorExecuteSelectedOrAll", {
            advance: true,
            forceSecondaryEngine: false,
            asText: true,
            is3rdLanguage: undefined,
        });

        expect(await desktopCommandRegistry.execute("run.explain")).toBe(true);
        expect(requisitionSpy).toHaveBeenCalledWith("editorExecute", {
            advance: false,
            forceSecondaryEngine: false,
            asText: true,
            explain: true,
            is3rdLanguage: undefined,
        });

        expect(await desktopCommandRegistry.execute("run.explainAnalyze")).toBe(true);
        expect(requisitionSpy).toHaveBeenCalledWith("editorExecute", {
            advance: false,
            forceSecondaryEngine: false,
            asText: true,
            explainAnalyze: true,
            is3rdLanguage: undefined,
        });

        expect(await desktopCommandRegistry.execute("run.visualExplain")).toBe(true);
        expect(requisitionSpy).toHaveBeenCalledWith("editorVisualExplain", {
            is3rdLanguage: undefined,
        });

        expect(await desktopCommandRegistry.execute("run.visualExplainAnalyze")).toBe(true);
        expect(requisitionSpy).toHaveBeenCalledWith("editorVisualExplain", {
            is3rdLanguage: undefined,
            visualExplainAnalyze: true,
        });

        expect(await desktopCommandRegistry.execute("run.stop")).toBe(true);
        expect(killQuerySpy).toHaveBeenCalled();

        expect(await desktopCommandRegistry.execute("run.stopOnError")).toBe(true);
        expect(requisitionSpy).toHaveBeenCalledWith("editorToggleStopExecutionOnError", true);

        expect(await desktopCommandRegistry.execute("run.autoCommit")).toBe(true);
        expect(requisitionSpy).toHaveBeenCalledWith("editorToggleAutoCommit", undefined);

        expect(await desktopCommandRegistry.execute("file.closeDocument")).toBe(true);
        expect(closeConnectionDocumentSpy).toHaveBeenCalledWith(expect.objectContaining({
            workspace: fakeConnectionWorkspace,
            documentState: expect.objectContaining({
                document: fakeDocument,
            }),
        }), false);
        expect(removeTabsSpy).not.toHaveBeenCalled();
        expect(confirmCloseSpy).toHaveBeenCalled();

        expect(await desktopCommandRegistry.execute("file.close")).toBe(true);
        expect(removeTabsSpy).toHaveBeenCalledWith(["page-1"]);

        unmount();
    });

    it("publishes and routes View and Database menu commands for the active workspace connection", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { container, unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const sharedConnection = createElectronWorkspaceConnection({
            adminPages: [{
                id: "admin-server-status",
                caption: "Server Information",
                pageType: "serverStatus",
            }, {
                id: "admin-client-connections",
                caption: "Client Connections",
                pageType: "clientConnections",
            }, {
                id: "admin-user-accounts",
                caption: "User Accounts",
                pageType: "userAccounts",
            }, {
                id: "admin-performance-dashboard",
                caption: "Performance Reports",
                pageType: "performanceDashboard",
            }, {
                id: "admin-enterprise-backup",
                caption: "Enterprise Backup",
                pageType: "enterpriseBackup",
            }, {
                id: "admin-lakehouse-navigator",
                caption: "Lakehouse Navigator",
                pageType: "lakehouseNavigator",
            }],
        });
        sharedConnection.connection.userConnectionId = 31;
        sharedConnection.connection.serviceConnectionId = 32;
        const roots = (moduleRef.current as any).connectionsDataModel.roots as unknown[];
        roots.splice(0, roots.length, sharedConnection.connection);

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: sharedConnection.connection,
            suppressAbout: false,
        };

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });

        const desktopState = desktopCommandRegistry.getState();
        expect(desktopState).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: "view.showConnectionInfo",
                label: "Show Connection Info",
                enabled: true,
                checked: false,
            }),
            expect.objectContaining({
                id: "database.admin.serverStatus",
                label: "Server Information",
                enabled: true,
            }),
            expect.objectContaining({
                id: "database.admin.clientConnections",
                label: "Client Connections",
                enabled: true,
            }),
            expect.objectContaining({
                id: "database.admin.userAccounts",
                label: "User Accounts",
                enabled: true,
            }),
            expect.objectContaining({
                id: "database.admin.performanceDashboard",
                label: "Performance Reports",
                enabled: true,
            }),
            expect.objectContaining({
                id: "database.admin.enterpriseBackup",
                label: "Enterprise Backup",
                enabled: true,
            }),
            expect.objectContaining({
                id: "database.admin.lakehouseNavigator",
                label: "Lakehouse Navigator",
                enabled: true,
            }),
            expect.objectContaining({
                id: "database.mrs.configure",
                label: "Configure MySQL REST Service",
                enabled: true,
            }),
            expect.objectContaining({
                id: "database.mrs.browseDocs",
                label: "Browse MySQL REST Service Documentation",
                enabled: true,
            }),
            expect.objectContaining({
                id: "view.schemas.showSystemSchemas",
                label: "Show System Schemas",
                enabled: true,
                checked: false,
            }),
        ]));

        expect(await desktopCommandRegistry.execute("view.showConnectionInfo")).toBe(true);
        await nextRunLoop();
        expect(Settings.get("editor.showConnectionInfo", false)).toBe(true);
        expect(container.querySelector("#desktopStatusConnectionInfoIndicator")?.textContent)
            .toBe("Conn: U:31 S:32");
        expect(desktopCommandRegistry.getState()).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: "view.showConnectionInfo",
                checked: true,
            }),
        ]));

        const selectAdminPageSpy = vi.spyOn(moduleRef.current as any, "handleConnectionEntrySelection")
            .mockResolvedValue(undefined);
        const enterpriseBackupPage = sharedConnection.adminPages.find((page) => {
            return page.pageType === "enterpriseBackup";
        });
        expect(await desktopCommandRegistry.execute("database.admin.enterpriseBackup")).toBe(true);
        expect(selectAdminPageSpy).toHaveBeenCalledWith(enterpriseBackupPage);

        const lakehouseNavigatorPage = sharedConnection.adminPages.find((page) => {
            return page.pageType === "lakehouseNavigator";
        });
        expect(await desktopCommandRegistry.execute("database.admin.lakehouseNavigator")).toBe(true);
        expect(selectAdminPageSpy).toHaveBeenCalledWith(lakehouseNavigatorPage);

        const sideBarCommandSpy = vi.spyOn(moduleRef.current as any, "handleSideBarConnectionCommand")
            .mockResolvedValue({ success: true });
        expect(await desktopCommandRegistry.execute("database.mrs.configure")).toBe(true);
        expect(sideBarCommandSpy).toHaveBeenCalledWith({
            title: "Configure MRS",
            command: "msg.mrs.configureMySQLRestService",
        }, sharedConnection.connection);

        sideBarCommandSpy.mockClear();
        expect(await desktopCommandRegistry.execute("database.mrs.browseDocs")).toBe(true);
        expect(sideBarCommandSpy).toHaveBeenCalledWith({
            title: "Browse MRS Docs",
            command: "msg.mrs.docs",
        });

        expect(await desktopCommandRegistry.execute("view.schemas.showSystemSchemas")).toBe(true);
        expect((sharedConnection.connection.state as { payload?: { showSystemSchemas?: boolean; }; })
            .payload?.showSystemSchemas).toBe(true);
        expect(sharedConnection.connection.refresh as Mock).toHaveBeenCalled();
        expect(desktopCommandRegistry.getState()).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: "view.schemas.showSystemSchemas",
                checked: true,
            }),
        ]));

        unmount();
    });

    it("opens administration pages in the active connection workspace", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });

        const moduleRef = createRef<TestDocumentModule>();
        const { unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const sharedConnection = createElectronWorkspaceConnection({
            adminPages: [{
                id: "admin-client-connections",
                caption: "Client Connections",
                pageType: "clientConnections",
            }],
        });
        const roots = (moduleRef.current as any).connectionsDataModel.roots as unknown[];
        roots.splice(0, roots.length, sharedConnection.connection);

        const notebookPage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const notebookConnectionWorkspace = {
            dataModelEntry: notebookPage,
            connection: sharedConnection.connection,
            suppressAbout: false,
        };
        (moduleRef.current as any).connectionPresentation.set(notebookPage, createConnectionPresentationState([{
            id: "notebook-1",
            caption: "Notebook 1",
            type: OdmEntityType.Notebook,
            parent: notebookPage,
        }], "notebook-1"));

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [notebookConnectionWorkspace] as never,
                selectedPage: notebookPage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });
        vi.spyOn(moduleRef.current as any, "showPage").mockResolvedValue(true);
        (moduleRef.current as any).currentConnectionWorkspaceRef.current = null;

        await act(async () => {
            await (moduleRef.current as any).handleConnectionEntrySelection(sharedConnection.adminPages[0]);
        });

        const connectionState = (moduleRef.current as any).connectionPresentation.get(notebookPage);
        expect(connectionState.documentStates.map((state: { document: { type: OdmEntityType; }; }) => {
            return state.document.type;
        })).toEqual([OdmEntityType.Notebook, OdmEntityType.AdminPage]);
        expect(connectionState.activeEntry).toBe(connectionState.documentStates[1].document.id);
        expect(moduleRef.current!.state.selectedWorkspace).toBe("connection:42");

        unmount();
    });

    it("keeps user and service connection pages separate", () => {
        const module = new TestDocumentModule({});
        const sharedConnection = createElectronWorkspaceConnection({
            adminPages: [{
                id: "admin-client-connections",
                caption: "Client Connections",
                pageType: "clientConnections",
            }],
        });
        const userPage = {
            id: "user-page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const adminPage = {
            id: "admin-page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const scriptDocument = {
            id: "script-1",
            caption: "Script 1",
            type: OdmEntityType.Script,
            parent: userPage,
        };
        const adminDocument = {
            id: "admin-doc-1",
            caption: "Client Connections",
            type: OdmEntityType.AdminPage,
            pageType: "clientConnections",
            parent: adminPage,
        };

        module.state = {
            selectedPage: adminPage.id,
            selectedWorkspace: "connection:42",
            connectionWorkspaces: [{
                dataModelEntry: userPage,
                connection: sharedConnection.connection,
                suppressAbout: false,
            }, {
                dataModelEntry: adminPage,
                connection: sharedConnection.connection,
                suppressAbout: false,
            }] as never,
            documentTabs: [],
            shellSessionTabs: [],
            schemaDiagramTabs: [],
            sidebarState: new Map(),
            showSidebar: false,
            showTabs: true,
            loading: false,
            progressMessage: "",
            overviewId: "overview",
        };
        (module as any).connectionPresentation.set(userPage, createConnectionPresentationState(
            [scriptDocument], scriptDocument.id,
        ));
        (module as any).connectionPresentation.set(adminPage, createConnectionPresentationState(
            [adminDocument], adminDocument.id,
        ));
        (module as any).serviceOnlyConnectionPages.add(adminPage.id);
        (module as any).latestPagesByConnection.set(sharedConnection.connection.details.id, userPage.id);
        (module as any).servicePagesByConnection.set(sharedConnection.connection.details.id, adminPage.id);

        expect((module as any).resolveLatestPageId(sharedConnection.connection)).toBe(userPage.id);
        expect((module as any).resolveServiceConnectionPageId(sharedConnection.connection)).toBe(adminPage.id);
        expect((module as any).getSelectedUserConnectionWorkspace()?.dataModelEntry.id).toBe(userPage.id);
    });

    it("shares one service page across administration documents and reuses matching documents", async () => {
        const module = new TestDocumentModule({});
        const sharedConnection = createElectronWorkspaceConnection({
            adminPages: [{
                id: "admin-server-status",
                caption: "Server Status",
                pageType: "serverStatus",
            }, {
                id: "admin-client-connections",
                caption: "Client Connections",
                pageType: "clientConnections",
            }],
        });
        const servicePage = {
            id: "service-page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
            documents: [],
        };
        const serviceConnectionWorkspace = {
            dataModelEntry: servicePage,
            connection: sharedConnection.connection,
            suppressAbout: false,
        };

        module.state = {
            selectedPage: servicePage.id,
            selectedWorkspace: "connection:42",
            connectionWorkspaces: [serviceConnectionWorkspace] as never,
            documentTabs: [],
            shellSessionTabs: [],
            schemaDiagramTabs: [],
            sidebarState: new Map(),
            showSidebar: false,
            showTabs: true,
            loading: false,
            progressMessage: "",
            overviewId: "overview",
        };
        (module as any).connectionPresentation.set(servicePage, createConnectionPresentationState());
        (module as any).serviceOnlyConnectionPages.add(servicePage.id);
        (module as any).documentDataModel = {
            openDocument: vi.fn((_provider, data) => {
                const parameters = data.parameters as { id: string; caption: string; pageType: AdminPageType; };
                let document = servicePage.documents.find((candidate: { id: string; }) => {
                    return candidate.id === parameters.id;
                });
                if (!document) {
                    document = {
                        id: parameters.id,
                        caption: parameters.caption,
                        type: OdmEntityType.AdminPage,
                        pageType: parameters.pageType,
                        parent: servicePage,
                    };
                    servicePage.documents.push(document as never);
                }

                return document;
            }),
        };
        vi.spyOn(module as any, "showPage").mockResolvedValue(true);

        await (module as any).handleConnectionEntrySelection(sharedConnection.adminPages[0]);
        await (module as any).handleConnectionEntrySelection(sharedConnection.adminPages[1]);
        await (module as any).handleConnectionEntrySelection(sharedConnection.adminPages[0]);

        const connectionState = (module as any).connectionPresentation.get(servicePage);
        expect(connectionState.documentStates).toHaveLength(2);
        expect(connectionState.documentStates.map((state: { document: { id: string; }; }) => {
            return state.document.id;
        })).toEqual([
            "admin-server-status__service-page-1",
            "admin-client-connections__service-page-1",
        ]);
        expect(connectionState.activeEntry).toBe("admin-server-status__service-page-1");
    });

    it("does not reuse a stale script tab ref after switching to a service tab", () => {
        const module = new TestDocumentModule({});
        const sharedConnection = createElectronWorkspaceConnection({
            adminPages: [{
                id: "admin-client-connections",
                caption: "Client Connections",
                pageType: "clientConnections",
            }],
        });
        const userPage = {
            id: "user-page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const servicePage = {
            id: "service-page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const scriptDocument = {
            id: "script-1",
            caption: "Script 1",
            type: OdmEntityType.Script,
            parent: userPage,
        };
        const adminDocument = {
            id: "admin-doc-1",
            caption: "Client Connections",
            type: OdmEntityType.AdminPage,
            pageType: "clientConnections",
            parent: servicePage,
        };

        module.state = {
            selectedPage: servicePage.id,
            selectedWorkspace: "connection:42",
            connectionWorkspaces: [{
                dataModelEntry: userPage,
                connection: sharedConnection.connection,
                suppressAbout: false,
            }, {
                dataModelEntry: servicePage,
                connection: sharedConnection.connection,
                suppressAbout: false,
            }] as never,
            documentTabs: [],
            shellSessionTabs: [],
            schemaDiagramTabs: [],
            sidebarState: new Map(),
            showSidebar: false,
            showTabs: true,
            loading: false,
            progressMessage: "",
            overviewId: "overview",
        };
        (module as any).connectionPresentation.set(userPage, createConnectionPresentationState(
            [scriptDocument], scriptDocument.id,
        ));
        (module as any).connectionPresentation.set(servicePage, createConnectionPresentationState(
            [adminDocument], adminDocument.id,
        ));
        (module as any).currentConnectionWorkspaceRef.current = {
            props: { id: userPage.id },
            getActiveDesktopDocumentType: () => {
                return "script";
            },
            getDesktopRunState: () => {
                return {
                    canExecute: false,
                    canExecuteSubparts: true,
                    canStop: true,
                    autoCommit: true,
                    transactionOpen: false,
                    stopOnErrors: true,
                };
            },
        };

        expect((module as any).getSelectedConnectionWorkspaceRef()).toBeNull();
        expect((module as any).getActiveDesktopExecutionContext()).toBeUndefined();
    });

    it("enables and routes previous and next command only for active notebooks", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        const moduleRef = createRef<TestDocumentModule>();
        const { unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                backend: {},
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        (moduleRef.current as any).connectionPresentation.set(fakePage, createConnectionPresentationState([{
            id: "notebook-1",
            caption: "Notebook 1",
            type: OdmEntityType.Notebook,
            parent: fakePage,
        }], "notebook-1"));

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: "page-1",
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });

        const selectedConnectionWorkspaceRef = (moduleRef.current as any).connectionWorkspaceRefs.get(fakePage.id);
        expect(selectedConnectionWorkspaceRef).toBeDefined();

        vi.spyOn(selectedConnectionWorkspaceRef, "getActiveDesktopDocumentType").mockReturnValue("notebook");
        vi.spyOn(selectedConnectionWorkspaceRef, "canNavigateHistory").mockImplementation((backwards: boolean) => {
            return backwards;
        });
        const navigateHistorySpy = vi.spyOn(selectedConnectionWorkspaceRef, "navigateHistory").mockReturnValue(true);

        desktopCommandRegistry.notifyHostStateChanged();

        expect(desktopCommandRegistry.getState().find((entry) => {
            return entry.id === "edit.previousCommand";
        })?.enabled).toBe(true);
        expect(desktopCommandRegistry.getState().find((entry) => {
            return entry.id === "edit.nextCommand";
        })?.enabled).toBe(false);

        expect(await desktopCommandRegistry.execute("edit.previousCommand")).toBe(true);
        expect(navigateHistorySpy).toHaveBeenCalledWith(true);

        expect(await desktopCommandRegistry.execute("edit.nextCommand")).toBe(true);
        expect(navigateHistorySpy).toHaveBeenCalledWith(false);

        unmount();
    });

    it("routes file.close through the close guard", async () => {
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentDidUpdate").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentWillUnmount").mockImplementation(() => { });
        const moduleRef = createRef<TestDocumentModule>();
        const { unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [{
                    dataModelEntry: {
                        id: "page-1",
                        caption: connectionDetails.caption,
                        details: connectionDetails,
                    },
                    connection: {
                        close: vi.fn().mockResolvedValue(undefined),
                        details: connectionDetails,
                        isOpen: true,
                        currentSchema: "",
                    },
                    suppressAbout: false,
                }] as never,
                selectedPage: "page-1",
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });

        const canCloseTabSpy = vi.spyOn(moduleRef.current as any, "canCloseTab").mockResolvedValue(false);
        const removeTabsSpy = vi.spyOn(moduleRef.current as any, "removeTabs").mockResolvedValue(true);

        expect(await desktopCommandRegistry.execute("file.close")).toBe(true);
        expect(canCloseTabSpy).toHaveBeenCalledWith("page-1");
        expect(removeTabsSpy).not.toHaveBeenCalled();

        unmount();
    });

    it("routes file.closeDocument through the document close guard", async () => {
        vi.spyOn(ConnectionWorkspace.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ConnectionWorkspace.prototype, "componentWillUnmount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentDidMount").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentDidUpdate").mockImplementation(() => { });
        vi.spyOn(ScriptEditor.prototype, "componentWillUnmount").mockImplementation(() => { });
        const moduleRef = createRef<TestDocumentModule>();
        const { unmount } = render(<TestDocumentModule ref={moduleRef} />);

        await nextRunLoop();
        expect(moduleRef.current).toBeDefined();

        const fakePage = {
            id: "page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const fakeDocument = {
            id: "doc-1",
            caption: "Script 1",
            type: OdmEntityType.Script,
            language: "mysql",
            parent: fakePage,
        };
        const fakeConnectionWorkspace = {
            dataModelEntry: fakePage,
            connection: {
                close: vi.fn().mockResolvedValue(undefined),
                details: connectionDetails,
                isOpen: true,
                currentSchema: "",
            },
            suppressAbout: false,
        };

        (moduleRef.current as any).connectionPresentation.set(fakePage, {
            documents: [fakeDocument],
            documentStates: [{
                document: fakeDocument,
                currentVersion: 0,
            }],
            activeEntry: fakeDocument.id,
            heatWaveEnabled: false,
            mleEnabled: false,
            isCloudInstance: false,
            adminPageStates: {},
            graphData: {},
            chatOptionsState: {},
            executionHistory: [],
            currentExecutionHistoryIndex: 0,
            hasExplainError: false,
        });

        await act(async () => {
            moduleRef.current!.setState({
                connectionWorkspaces: [fakeConnectionWorkspace] as never,
                selectedPage: fakePage.id,
                selectedWorkspace: "connection:42",
                loading: false,
            });
        });

        const canCloseTabSpy = vi.spyOn(moduleRef.current as any, "canCloseTab").mockResolvedValue(false);
        const closeConnectionDocumentSpy = vi.spyOn(moduleRef.current as any,
            "closeConnectionDocument").mockResolvedValue(true);

        expect(await desktopCommandRegistry.execute("file.closeDocument")).toBe(true);
        expect(canCloseTabSpy).toHaveBeenCalledWith(fakeDocument.id);
        expect(closeConnectionDocumentSpy).not.toHaveBeenCalled();

        unmount();
    });

    it("uses the connection workspace added by showPage when creating a new script", async () => {
        const module = new TestDocumentModule({});
        const createdDocument = {
            id: "doc-2",
            caption: "Script 2",
            type: OdmEntityType.Script,
        };

        module.state = {
            selectedPage: "page-1",
            selectedWorkspace: "connection:42",
            connectionWorkspaces: [],
            documentTabs: [],
            shellSessionTabs: [],
            schemaDiagramTabs: [],
            sidebarState: new Map(),
            showSidebar: false,
            showTabs: true,
            loading: false,
            progressMessage: "",
            overviewId: "overview",
        };

        vi.spyOn(module as any, "showPage").mockImplementation(async () => {
            module.state.connectionWorkspaces = [{
                dataModelEntry: {
                    id: "page-1",
                    caption: connectionDetails.caption,
                    details: connectionDetails,
                },
                connection: {
                    details: connectionDetails,
                    isOpen: true,
                    currentSchema: "",
                },
                suppressAbout: false,
            }] as never;
        });

        const openDocument = vi.fn().mockReturnValue(createdDocument);
        (module as any).documentDataModel = { openDocument };

        const handleSelectItemSpy = vi.spyOn(module as any, "handleSelectItem").mockImplementation(() => { });

        await (module as any).createAndSelectScriptDocument(connectionDetails, "Script 2", "mysql", "", "page-1");

        expect(openDocument).toHaveBeenCalledWith(undefined, expect.objectContaining({
            type: OdmEntityType.Script,
            parameters: expect.objectContaining({
                pageId: "page-1",
                connection: connectionDetails,
                caption: "Script 2",
                language: "mysql",
            }),
        }));
        expect(handleSelectItemSpy).toHaveBeenCalledWith({
            document: createdDocument,
            pageId: "page-1",
            content: "",
        });
    });

    it("reuses the workspace user connection when opening another user tab", async () => {
        const module = new TestDocumentModule({});
        const sharedConnection = createElectronWorkspaceConnection();
        const existingUserConnection = sharedConnection.connection;
        const userPage = {
            id: "user-page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };

        module.state = {
            selectedPage: userPage.id,
            selectedWorkspace: "connection:42",
            connectionWorkspaces: [{
                dataModelEntry: userPage,
                connection: existingUserConnection,
                suppressAbout: false,
            }] as never,
            documentTabs: [],
            shellSessionTabs: [],
            schemaDiagramTabs: [],
            sidebarState: new Map(),
            showSidebar: false,
            showTabs: true,
            loading: false,
            progressMessage: "",
            overviewId: "overview",
        };
        (module as any).connectionPresentation.set(userPage, createConnectionPresentationState());
        const addConnectionWorkspaceSpy = vi.spyOn(module as any, "addConnectionWorkspace").mockResolvedValue(true);
        vi.spyOn(module as any, "setStatePromise").mockImplementation((state: Record<string, unknown>) => {
            module.state = { ...module.state, ...state };

            return Promise.resolve();
        });

        await (module as any).activateConnectionWorkspace(existingUserConnection, false, false, "script", false);

        expect(addConnectionWorkspaceSpy).not.toHaveBeenCalled();
        expect(module.state.connectionWorkspaces).toHaveLength(1);
        expect(module.state.selectedPage).toBe(userPage.id);
    });

    it("reuses the workspace service connection when opening another admin tab", async () => {
        const module = new TestDocumentModule({});
        const sharedConnection = createElectronWorkspaceConnection();
        const existingServiceConnection = sharedConnection.connection;
        const servicePage = {
            id: "service-page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };

        module.state = {
            selectedPage: servicePage.id,
            selectedWorkspace: "connection:42",
            connectionWorkspaces: [{
                dataModelEntry: servicePage,
                connection: existingServiceConnection,
                suppressAbout: false,
            }] as never,
            documentTabs: [],
            shellSessionTabs: [],
            schemaDiagramTabs: [],
            sidebarState: new Map(),
            showSidebar: false,
            showTabs: true,
            loading: false,
            progressMessage: "",
            overviewId: "overview",
        };
        (module as any).connectionPresentation.set(servicePage, createConnectionPresentationState());
        (module as any).serviceOnlyConnectionPages.add(servicePage.id);
        const addConnectionWorkspaceSpy = vi.spyOn(module as any, "addConnectionWorkspace").mockResolvedValue(true);
        vi.spyOn(module as any, "setStatePromise").mockImplementation((state: Record<string, unknown>) => {
            module.state = { ...module.state, ...state };

            return Promise.resolve();
        });

        await (module as any).activateConnectionWorkspace(existingServiceConnection, false, false, "none", true);

        expect(addConnectionWorkspaceSpy).not.toHaveBeenCalled();
        expect(module.state.connectionWorkspaces).toHaveLength(1);
        expect(module.state.selectedPage).toBe(servicePage.id);
    });

    it("switches offline admin pages through the workspace service connection", async () => {
        const module = new TestDocumentModule({});
        const servicePage = {
            id: "service-page-1",
            caption: connectionDetails.caption,
            details: connectionDetails,
        };
        const openServiceConnection = {
            details: connectionDetails,
            isOpen: false,
            isOffline: true,
            currentSchema: "",
        };
        const selectedAdminConnection = {
            ...openServiceConnection,
        };
        const adminPage = {
            id: "admin-server-status",
            caption: "Server Status",
            type: CdmEntityType.AdminPage,
            pageType: "serverStatus",
            connection: selectedAdminConnection,
            parent: {
                connection: selectedAdminConnection,
            },
        };
        const openedDocument = {
            id: "admin-doc-1",
            caption: "Server Status",
            type: OdmEntityType.AdminPage,
            pageType: "serverStatus",
        };

        module.state = {
            selectedPage: servicePage.id,
            selectedWorkspace: "connection:42",
            connectionWorkspaces: [{
                dataModelEntry: servicePage,
                connection: openServiceConnection,
                suppressAbout: false,
            }] as never,
            documentTabs: [],
            shellSessionTabs: [],
            schemaDiagramTabs: [],
            sidebarState: new Map(),
            showSidebar: false,
            showTabs: true,
            loading: false,
            progressMessage: "",
            overviewId: "overview",
        };
        (module as any).connectionPresentation.set(servicePage, createConnectionPresentationState());
        (module as any).serviceOnlyConnectionPages.add(servicePage.id);
        vi.spyOn(module as any, "canCurrentTabClose").mockResolvedValue(true);
        const showPageSpy = vi.spyOn(module as any, "showPage").mockResolvedValue(true);
        const handleSelectItemSpy = vi.spyOn(module as any, "handleSelectItem").mockImplementation(() => { });
        const openDocument = vi.fn().mockReturnValue(openedDocument);
        (module as any).documentDataModel = { openDocument };

        await (module as any).handleConnectionEntrySelection(adminPage);

        expect(showPageSpy).not.toHaveBeenCalled();
        expect(openDocument).toHaveBeenCalledWith(undefined, expect.objectContaining({
            type: OdmEntityType.AdminPage,
            parameters: expect.objectContaining({
                pageId: servicePage.id,
                connection: connectionDetails,
                caption: "Server Status",
                pageType: "serverStatus",
            }),
        }));
        expect(handleSelectItemSpy).toHaveBeenCalledWith({
            pageId: servicePage.id,
            document: openedDocument,
        });
    });
});
