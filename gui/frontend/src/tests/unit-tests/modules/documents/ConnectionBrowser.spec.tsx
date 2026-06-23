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

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../utilities/helpers.js", async () => {
    const actual = await vi.importActual("../../../../utilities/helpers.js");

    return {
        ...actual,
        isStandalone: vi.fn(() => {
            return false;
        }),
    };
});

import { ConnectionBrowser } from "../../../../modules/db-editor/ConnectionBrowser.js";
import { render, waitFor } from "@testing-library/preact";
import { DialogResponseClosure } from "../../../../app-logic/general-types.js";
import { ComponentPlacement } from "../../../../components/ui/Component/ComponentBase.js";
import { CdmEntityType } from "../../../../data-models/ConnectionDataModel.js";
import { DocumentContext, type DocumentContextType } from "../../../../modules/db-editor/index.js";
import { ui } from "../../../../app-logic/UILayer.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import { appParameters } from "../../../../supplement/AppParameters.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { DBType } from "../../../../supplement/ShellInterface/index.js";
import { isStandalone } from "../../../../utilities/helpers.js";

describe("Connection browser tests", (): void => {
    const createGroup = (id: number, caption: string, parent?: Record<string, unknown>) => {
        return {
            id: `group-${id}`,
            caption,
            type: CdmEntityType.ConnectionGroup,
            parent,
            entries: [],
            state: {},
            folderPath: { id, caption, index: 0 },
            refresh: vi.fn().mockResolvedValue(true),
        };
    };

    const createConnection = (parent?: Record<string, unknown>, folderPath = "/") => {
        return {
            id: "connection-entry",
            caption: "Test Connection",
            type: CdmEntityType.Connection,
            parent,
            details: {
                id: 42,
                caption: "Test Connection",
                description: "",
                dbType: DBType.MySQL,
                index: 0,
                options: {},
                folderPath,
            },
        };
    };

    const createBrowser = () => {
        return new ConnectionBrowser({
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
            onAddConnection: vi.fn(),
            onUpdateConnection: vi.fn(),
            onRemoveConnection: vi.fn(),
        });
    };

    const renderBrowserWithRoots = (roots: unknown[]) => {
        const dataModel = {
            roots,
            subscribe: vi.fn(),
            unsubscribe: vi.fn(),
        };

        return render(
            <DocumentContext.Provider value={{ connectionsDataModel: dataModel } as DocumentContextType}>
                <ConnectionBrowser
                    toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
                    onAddConnection={vi.fn()}
                    onUpdateConnection={vi.fn()}
                    onRemoveConnection={vi.fn()}
                />
            </DocumentContext.Provider>,
        );
    };

    const findVNodeById = (node: unknown, id: string): {
        props: Record<string, unknown>;
    } | undefined => {
        if (Array.isArray(node)) {
            for (const entry of node) {
                const found = findVNodeById(entry, id);
                if (found) {
                    return found;
                }
            }

            return undefined;
        }

        if (!node || typeof node !== "object") {
            return undefined;
        }

        const vnode = node as {
            props?: Record<string, unknown>;
        };

        if (vnode.props?.id === id) {
            return vnode as { props: Record<string, unknown>; };
        }

        return findVNodeById(vnode.props?.children, id);
    };

    afterEach(() => {
        Reflect.deleteProperty(window, "electronHost");
        appParameters.inExtension = false;
        vi.restoreAllMocks();
    });

    it("Test ConnectionBrowser instantiation", () => {
        vi.mocked(isStandalone).mockReturnValue(false);

        const { container, unmount } = render(
            <ConnectionBrowser
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
                onAddConnection={vi.fn()}
                onUpdateConnection={vi.fn()}
                onRemoveConnection={vi.fn()}
            />,
        );

        expect(container).toMatchSnapshot();
        unmount();
    });

    it("shows the Workbench welcome banner in standalone mode", () => {
        vi.mocked(isStandalone).mockReturnValue(false);
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        const { getByText, unmount } = render(
            <ConnectionBrowser
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
                onAddConnection={vi.fn()}
                onUpdateConnection={vi.fn()}
                onRemoveConnection={vi.fn()}
            />,
        );

        expect(getByText("Welcome to MySQL Workbench")).toBeTruthy();
        unmount();
    });

    it("anchors tile action menus to the right edge of the tile button", () => {
        const browser = createBrowser();
        const output = browser.render();

        const connectionMenu = findVNodeById(output, "connectionTileActionMenu");
        const groupMenu = findVNodeById(output, "groupTileActionMenu");

        expect(connectionMenu?.props.placement).toBe(ComponentPlacement.BottomRight);
        expect(groupMenu?.props.placement).toBe(ComponentPlacement.BottomRight);
    });

    it("hides the breadcrumb when no connection groups exist", () => {
        const { container, unmount } = renderBrowserWithRoots([createConnection()]);

        expect(container.querySelector(".breadcrumb")).toBeNull();
        unmount();
    });

    it("shows the breadcrumb when connection groups exist", () => {
        const { container, unmount } = renderBrowserWithRoots([createGroup(2, "Projects")]);

        expect(container.querySelector(".breadcrumb")).toBeTruthy();
        unmount();
    });

    it("forces a new connection tab for tile actions outside the extension", () => {
        const executeSpy = vi.spyOn(requisitions, "execute").mockResolvedValue(true);
        const executeRemoteSpy = vi.spyOn(requisitions, "executeRemote").mockResolvedValue(true);
        appParameters.inExtension = false;

        const browser = createBrowser();

        const entry = {
            type: CdmEntityType.Connection,
            caption: "Test Connection",
            details: {
                id: 42,
                caption: "Test Connection",
                dbType: 0,
            },
        };

        (browser as unknown as {
            doHandleTileAction: (action: string, entry: unknown, options?: unknown) => void;
        }).doHandleTileAction("open", entry, { editor: "script" });

        expect(executeSpy).toHaveBeenCalledWith("openConnectionTab", {
            connection: entry,
            force: true,
            initialEditor: "script",
        });
        expect(executeRemoteSpy).toHaveBeenCalledWith("selectConnectionTab", { connectionId: 42 });
    });

    it("uses the configured default editor for plain connection tile clicks", () => {
        const executeSpy = vi.spyOn(requisitions, "execute").mockResolvedValue(true);
        vi.spyOn(requisitions, "executeRemote").mockResolvedValue(true);
        const browser = createBrowser();
        const entry = createConnection();

        (browser as unknown as {
            doHandleTileAction: (action: string, entry: unknown, options?: unknown) => void;
        }).doHandleTileAction("open", entry, {});

        expect(executeSpy).toHaveBeenCalledWith("openConnectionTab", {
            connection: entry,
            force: true,
            initialEditor: "default",
        });
    });

    it("treats only non-root connections as movable back to root", () => {
        const rootGroup = createGroup(1, "/");
        const childGroup = createGroup(2, "Projects", rootGroup);
        const browser = createBrowser();

        expect((browser as unknown as {
            isConnectionInRoot: (entry: unknown) => boolean;
        }).isConnectionInRoot(createConnection(rootGroup))).toBe(true);

        expect((browser as unknown as {
            isConnectionInRoot: (entry: unknown) => boolean;
        }).isConnectionInRoot(createConnection(childGroup, "/Projects"))).toBe(false);
    });

    it("rejects duplicate folder names in the browser and defaults to folder", async () => {
        const rootGroup = createGroup(1, "/");
        const currentGroup = createGroup(2, "Projects", rootGroup);
        const existingFolder = createGroup(3, "folder", currentGroup);
        currentGroup.entries = [existingFolder];

        const browser = createBrowser();
        const dataModel = {
            roots: [currentGroup],
            groupFromPath: vi.fn().mockResolvedValue(rootGroup),
        };

        (browser as unknown as {
            context: unknown;
            state: unknown;
            handleNewFolderClick: () => Promise<void>;
        }).context = { connectionsDataModel: dataModel };
        (browser as unknown as { state: unknown; }).state = {
            currentGroup,
            moveTargetGroups: [],
        };

        const showInputBoxSpy = vi.spyOn(ui, "showInputBox")
            .mockResolvedValueOnce("folder")
            .mockResolvedValueOnce("archive");
        const showErrorMessageSpy = vi.spyOn(ui, "showErrorMessage").mockResolvedValue(undefined);
        const addFolderPathSpy = vi.spyOn(ShellInterface.dbConnections, "addFolderPath").mockResolvedValue({
            id: 4,
            caption: "archive",
            index: 0,
        });
        const executeRemoteSpy = vi.spyOn(requisitions, "executeRemote").mockResolvedValue(true);

        await (browser as unknown as {
            handleNewFolderClick: () => Promise<void>;
        }).handleNewFolderClick();

        expect(showInputBoxSpy).toHaveBeenNthCalledWith(
            1,
            "Create New Folder",
            "Folder name",
            "Enter the name of the new folder.",
            "folder",
        );
        expect(showErrorMessageSpy).toHaveBeenCalledWith(
            "A folder named \"folder\" already exists here.",
            {},
        );
        expect(addFolderPathSpy).toHaveBeenCalledWith(expect.anything(), "archive", 2);
        expect(currentGroup.refresh).toHaveBeenCalled();
        expect(executeRemoteSpy).toHaveBeenCalledWith("refreshConnectionGroup", currentGroup.folderPath);
    });

    it("moves a connection to an existing folder from the tile menu", async () => {
        const rootGroup = createGroup(1, "/");
        const sourceGroup = createGroup(2, "Source", rootGroup);
        const targetGroup = createGroup(3, "Archive", rootGroup);
        const entry = createConnection(sourceGroup, "/Source");

        const browser = createBrowser();
        const dataModel = {
            roots: [sourceGroup, targetGroup],
            groupFromPath: vi.fn().mockResolvedValue(rootGroup),
        };

        (browser as unknown as {
            context: unknown;
            state: unknown;
            handleMoveToFolderAction: (action: string, entry: unknown) => Promise<void>;
        }).context = { connectionsDataModel: dataModel };
        (browser as unknown as { state: unknown; }).state = {
            moveTargetGroups: [targetGroup],
        };

        const updateDbConnectionSpy = vi.spyOn(ShellInterface.dbConnections, "updateDbConnection")
            .mockResolvedValue(undefined);
        const executeRemoteSpy = vi.spyOn(requisitions, "executeRemote").mockResolvedValue(true);

        await (browser as unknown as {
            handleMoveToFolderAction: (action: string, entry: unknown) => Promise<void>;
        }).handleMoveToFolderAction("move:folder:3", entry);

        expect(updateDbConnectionSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ folderPath: "/Archive" }),
            3,
        );
        expect(sourceGroup.refresh).toHaveBeenCalled();
        expect(targetGroup.refresh).toHaveBeenCalled();
        expect(executeRemoteSpy).toHaveBeenCalledWith("refreshConnectionGroup", sourceGroup.folderPath);
        expect(executeRemoteSpy).toHaveBeenCalledWith("refreshConnectionGroup", targetGroup.folderPath);
        expect(executeRemoteSpy).toHaveBeenCalledWith(
            "connectionUpdated",
            expect.objectContaining({ folderPath: "/Archive" }),
        );
    });

    it("routes tile menu move commands through the current connection entry", () => {
        const rootGroup = createGroup(1, "/");
        const sourceGroup = createGroup(2, "Source", rootGroup);
        const entry = createConnection(sourceGroup, "/Source");
        const browser = createBrowser();

        const moveSpy = vi.spyOn(browser as unknown as {
            handleMoveToFolderAction: (action: string, entry: unknown) => Promise<void>;
        }, "handleMoveToFolderAction").mockResolvedValue(undefined);

        (browser as unknown as {
            currentActionMenuEntry: unknown;
            handleConnectionMenuItemClick: (props: { command: { command: string; }; children?: unknown; }) => boolean;
        }).currentActionMenuEntry = entry;

        const handled = (browser as unknown as {
            handleConnectionMenuItemClick: (props: { command: { command: string; }; children?: unknown; }) => boolean;
        }).handleConnectionMenuItemClick({
            command: { title: "Back to Root", command: "move:root" },
        });

        expect(handled).toBe(true);
        expect(moveSpy).toHaveBeenCalledWith("move:root", entry);
    });

    it("ignores stale asynchronous connection tile menu openings", async () => {
        const rootGroup = createGroup(1, "/");
        const sourceGroup = createGroup(2, "Source", rootGroup);
        const archiveGroup = createGroup(3, "Archive", rootGroup);
        const firstEntry = createConnection(sourceGroup, "/Source");
        const secondEntry = createConnection(archiveGroup, "/Archive");
        const browser = createBrowser();

        let resolveFirstGroups: (groups: unknown[]) => void = vi.fn();
        const firstGroups = new Promise<unknown[]>((resolve) => {
            resolveFirstGroups = resolve;
        });

        vi.spyOn(browser as unknown as {
            getMoveTargetGroups: (entry: unknown) => Promise<unknown[]>;
        }, "getMoveTargetGroups")
            .mockReturnValueOnce(firstGroups)
            .mockResolvedValueOnce([]);

        const openSpy = vi.fn();
        (browser as unknown as { connectionActionMenuRef: { current: unknown; }; })
            .connectionActionMenuRef.current = { open: openSpy };

        vi.spyOn(browser as unknown as {
            setState: (state: unknown, callback?: () => void) => void;
        }, "setState").mockImplementation((state: unknown, callback?: () => void) => {
            (browser as unknown as { state: unknown; }).state = {
                ...(browser as unknown as { state: object; }).state,
                ...state as object,
            };
            callback?.();
        });

        const firstOpen = (browser as unknown as {
            openTileActionMenu: (entry: unknown, target: HTMLElement) => Promise<void>;
        }).openTileActionMenu(firstEntry, document.createElement("div"));
        await (browser as unknown as {
            openTileActionMenu: (entry: unknown, target: HTMLElement) => Promise<void>;
        }).openTileActionMenu(secondEntry, document.createElement("div"));

        expect(openSpy).toHaveBeenCalledTimes(1);
        expect((browser as unknown as { currentActionMenuEntry: unknown; }).currentActionMenuEntry)
            .toBe(secondEntry);

        resolveFirstGroups([archiveGroup]);
        await firstOpen;

        expect(openSpy).toHaveBeenCalledTimes(1);
        expect((browser as unknown as { currentActionMenuEntry: unknown; }).currentActionMenuEntry)
            .toBe(secondEntry);
    });

    it("moves a connection back to root from the tile menu", async () => {
        const rootGroup = createGroup(1, "/");
        const sourceGroup = createGroup(2, "Source", rootGroup);
        const entry = createConnection(sourceGroup, "/Source");

        const browser = createBrowser();
        const dataModel = {
            roots: [sourceGroup],
            groupFromPath: vi.fn().mockResolvedValue(rootGroup),
        };

        (browser as unknown as {
            context: unknown;
            state: unknown;
            handleMoveToFolderAction: (action: string, entry: unknown) => Promise<void>;
        }).context = { connectionsDataModel: dataModel };
        (browser as unknown as { state: unknown; }).state = {
            moveTargetGroups: [],
        };

        const updateDbConnectionSpy = vi.spyOn(ShellInterface.dbConnections, "updateDbConnection")
            .mockResolvedValue(undefined);
        const executeRemoteSpy = vi.spyOn(requisitions, "executeRemote").mockResolvedValue(true);

        await (browser as unknown as {
            handleMoveToFolderAction: (action: string, entry: unknown) => Promise<void>;
        }).handleMoveToFolderAction("move:root", entry);

        expect(updateDbConnectionSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ folderPath: "/" }),
            1,
        );
        expect(sourceGroup.refresh).toHaveBeenCalled();
        expect(rootGroup.refresh).toHaveBeenCalled();
        expect(executeRemoteSpy).toHaveBeenCalledWith("refreshConnectionGroup", sourceGroup.folderPath);
        expect(executeRemoteSpy).toHaveBeenCalledWith("refreshConnectionGroup", rootGroup.folderPath);
        expect(executeRemoteSpy).toHaveBeenCalledWith(
            "connectionUpdated",
            expect.objectContaining({ folderPath: "/" }),
        );
    });

    it("routes tile menu remove commands through the current connection entry", () => {
        const rootGroup = createGroup(1, "/");
        const sourceGroup = createGroup(2, "Source", rootGroup);
        const entry = createConnection(sourceGroup, "/Source");
        const browser = createBrowser();

        const confirmSpy = vi.spyOn(browser as unknown as {
            confirmTileRemoval: (entry: unknown) => void;
        }, "confirmTileRemoval").mockImplementation(() => {
            return undefined;
        });

        (browser as unknown as {
            currentActionMenuEntry: unknown;
            handleConnectionMenuItemClick: (props: { command: { command: string; }; children?: unknown; }) => boolean;
        }).currentActionMenuEntry = entry;

        const handled = (browser as unknown as {
            handleConnectionMenuItemClick: (props: { command: { command: string; }; children?: unknown; }) => boolean;
        }).handleConnectionMenuItemClick({
            command: { title: "Delete Connection…", command: "remove" },
        });

        expect(handled).toBe(true);
        expect(confirmSpy).toHaveBeenCalledWith(entry);
    });

    it.each([
        ["open:script", "script"],
        ["open:notebook", "notebook"],
    ] as const)("routes tile menu %s commands to a new %s editor", (command, initialEditor) => {
        const rootGroup = createGroup(1, "/");
        const sourceGroup = createGroup(2, "Source", rootGroup);
        const entry = createConnection(sourceGroup, "/Source");
        const browser = createBrowser();
        const executeSpy = vi.spyOn(requisitions, "execute").mockResolvedValue(true);
        const executeRemoteSpy = vi.spyOn(requisitions, "executeRemote").mockResolvedValue(true);

        (browser as unknown as {
            currentActionMenuEntry: unknown;
            handleConnectionMenuItemClick: (props: { command: { command: string; }; children?: unknown; }) => boolean;
        }).currentActionMenuEntry = entry;

        const handled = (browser as unknown as {
            handleConnectionMenuItemClick: (props: { command: { command: string; }; children?: unknown; }) => boolean;
        }).handleConnectionMenuItemClick({
            command: { title: command, command },
        });

        expect(handled).toBe(true);
        expect(executeSpy).toHaveBeenCalledWith("openConnectionTab", {
            connection: entry,
            force: true,
            initialEditor,
        });
        expect(executeRemoteSpy).toHaveBeenCalledWith("selectConnectionTab", { connectionId: 42 });
    });

    it("routes the migration assistant menu command through the Electron host", async () => {
        const rootGroup = createGroup(1, "/");
        const sourceGroup = createGroup(2, "Source", rootGroup);
        const entry = createConnection(sourceGroup, "/Source");
        const browser = createBrowser();
        const executeRemoteSpy = vi.spyOn(requisitions, "executeRemote").mockResolvedValue(true);
        vi.spyOn(ui, "requestPassword").mockResolvedValue("secret");
        vi.spyOn(ShellInterface.dbConnections, "testConnection").mockResolvedValue(true);

        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
                setMessageHandler: vi.fn(),
            },
        });

        (browser as unknown as {
            currentActionMenuEntry: unknown;
            handleConnectionMenuItemClick: (props: { command: { command: string; }; children?: unknown; }) => boolean;
        }).currentActionMenuEntry = entry;

        const handled = (browser as unknown as {
            handleConnectionMenuItemClick: (props: { command: { command: string; }; children?: unknown; }) => boolean;
        }).handleConnectionMenuItemClick({
            command: {
                title: "Start MySQL Cloud Migration Assistant",
                command: "msg.startMySQLCloudMigrationAssistant",
            },
        });

        expect(handled).toBe(true);
        await waitFor(() => {
            expect(executeRemoteSpy).toHaveBeenCalledWith("startMigrationAssistant", {
                ...entry.details,
                password: "secret",
            });
        });
    });

    it("deletes a folder recursively after confirmation", async () => {
        const rootGroup = createGroup(1, "/");
        const group = createGroup(2, "Projects", rootGroup);
        const connectionA = createConnection(group, "/Projects");
        const connectionB = createConnection(group, "/Projects");
        const nestedGroup = createGroup(3, "Archive", group);

        const browser = createBrowser();
        const dataModel = {
            flattenGroupList: vi.fn().mockResolvedValue({
                groups: [group, nestedGroup],
                connections: [connectionA, connectionB],
            }),
            dropItem: vi.fn().mockResolvedValue(undefined),
            removeEntry: vi.fn().mockResolvedValue(undefined),
        };
        vi.spyOn(ui, "showInformationMessage").mockResolvedValue(undefined);

        (browser as unknown as {
            context: unknown;
            dialogResponse: (response: unknown) => Promise<boolean>;
        }).context = { connectionsDataModel: dataModel };

        await (browser as unknown as {
            dialogResponse: (response: unknown) => Promise<boolean>;
        }).dialogResponse({
            id: "deleteFolder",
            closure: DialogResponseClosure.Accept,
            data: { entry: group },
        });

        expect(dataModel.flattenGroupList).toHaveBeenCalledWith(group);
        expect(dataModel.dropItem).toHaveBeenNthCalledWith(1, connectionB);
        expect(dataModel.dropItem).toHaveBeenNthCalledWith(2, connectionA);
        expect(dataModel.dropItem).toHaveBeenNthCalledWith(3, nestedGroup);
        expect(dataModel.dropItem).toHaveBeenNthCalledWith(4, group);
        expect(dataModel.removeEntry).toHaveBeenNthCalledWith(1, connectionB);
        expect(dataModel.removeEntry).toHaveBeenNthCalledWith(2, connectionA);
        expect(dataModel.removeEntry).toHaveBeenNthCalledWith(3, nestedGroup);
        expect(dataModel.removeEntry).toHaveBeenNthCalledWith(4, group);
    });

    it("deletes an empty folder immediately without showing confirmation", async () => {
        const rootGroup = createGroup(1, "/");
        const group = createGroup(2, "Projects", rootGroup);
        const browser = createBrowser();
        const dataModel = {
            flattenGroupList: vi.fn().mockResolvedValue({
                groups: [group],
                connections: [],
            }),
        };

        const deleteFolderSpy = vi.spyOn(browser as unknown as {
            deleteFolder: (entry: unknown) => Promise<void>;
        }, "deleteFolder").mockResolvedValue(undefined);
        const executeSpy = vi.spyOn(requisitions, "execute").mockResolvedValue(true);

        (browser as unknown as {
            context: unknown;
            showFolderRemovalDialog: (entry: unknown) => Promise<void>;
        }).context = { connectionsDataModel: dataModel };

        await (browser as unknown as {
            showFolderRemovalDialog: (entry: unknown) => Promise<void>;
        }).showFolderRemovalDialog(group);

        expect(deleteFolderSpy).toHaveBeenCalledWith(group);
        expect(executeSpy).not.toHaveBeenCalledWith("showDialog", expect.anything());
    });

    it("creates a new sibling folder before moving the connection", async () => {
        const rootGroup = createGroup(1, "/");
        const sourceGroup = createGroup(2, "Source", rootGroup);
        const newGroup = createGroup(4, "folder", sourceGroup);
        const entry = createConnection(sourceGroup, "/Source");

        const browser = createBrowser();
        const dataModel = {
            roots: [sourceGroup],
            groupFromPath: vi.fn().mockImplementation((path: string) => {
                if (path === "/Source/folder") {
                    return Promise.resolve(newGroup);
                }

                return Promise.resolve(rootGroup);
            }),
        };

        (browser as unknown as {
            context: unknown;
            state: unknown;
            handleMoveToFolderAction: (action: string, entry: unknown) => Promise<void>;
        }).context = { connectionsDataModel: dataModel };
        (browser as unknown as { state: unknown; }).state = {
            moveTargetGroups: [],
        };

        vi.spyOn(ui, "showInputBox").mockResolvedValue("folder");
        vi.spyOn(ui, "showErrorMessage").mockResolvedValue(undefined);
        const addFolderPathSpy = vi.spyOn(ShellInterface.dbConnections, "addFolderPath").mockResolvedValue({
            id: 4,
            caption: "folder",
            index: 0,
        });
        const updateDbConnectionSpy = vi.spyOn(ShellInterface.dbConnections, "updateDbConnection")
            .mockResolvedValue(undefined);

        await (browser as unknown as {
            handleMoveToFolderAction: (action: string, entry: unknown) => Promise<void>;
        }).handleMoveToFolderAction("move:newFolder", entry);

        expect(addFolderPathSpy).toHaveBeenCalledWith(expect.anything(), "folder", 2);
        expect(updateDbConnectionSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ folderPath: "/Source/folder" }),
            4,
        );
        expect(sourceGroup.refresh).toHaveBeenCalled();
        expect(newGroup.refresh).toHaveBeenCalled();
    });
});
