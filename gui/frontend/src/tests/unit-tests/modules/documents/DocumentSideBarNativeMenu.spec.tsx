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
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { cleanup, render } from "@testing-library/preact";
import type { ComponentChild } from "preact";

import { afterEach, describe, expect, it, vi } from "vitest";

import { Menu } from "../../../../components/ui/Menu/Menu.js";
import { CdmEntityType } from "../../../../data-models/ConnectionDataModel.js";
import { DocumentSideBar } from "../../../../modules/db-editor/DocumentSideBar/DocumentSideBar.js";
import { DBType } from "../../../../supplement/ShellInterface/index.js";
import { nextRunLoop } from "../../test-helpers.js";

const resetNativeMenuStatics = () => {
    const menuStatics = Menu as unknown as {
        menuStack: Menu[];
        nativeMenuRegistrations: Map<string, unknown>;
        nativeMenuHandlerRegistered: boolean;
        nativeMenuSequence: number;
    };

    menuStatics.menuStack.length = 0;
    menuStatics.nativeMenuRegistrations.clear();
    menuStatics.nativeMenuHandlerRegistered = false;
    menuStatics.nativeMenuSequence = 0;
};

const createSideBar = (sidebarMode: "classic" | "electronConnection" = "electronConnection") => {
    return new DocumentSideBar({
        selectedOpenDocument: "",
        markedSchema: "",
        overviewId: "overview",
        sidebarMode,
        activeWorkspaceConnectionId: 42,
        onConnectionTreeCommand: vi.fn().mockResolvedValue({ success: true }),
        onDocumentTreeCommand: vi.fn().mockResolvedValue({ success: true }),
        onOciTreeCommand: vi.fn().mockResolvedValue({ success: true }),
    });
};

const installElectronHost = () => {
    const showNativeMenu = vi.fn().mockResolvedValue(undefined);
    const closeNativeMenu = vi.fn().mockResolvedValue(undefined);
    let nativeMenuHandler: ((event: { type: "select"; requestId: string; itemId: string; }) => void) | undefined;

    Object.defineProperty(window, "electronHost", {
        configurable: true,
        value: {
            postMessage: vi.fn(),
            showNativeMenu,
            closeNativeMenu,
            setNativeMenuHandler: (handler: typeof nativeMenuHandler) => {
                nativeMenuHandler = handler;
            },
        },
    });

    return {
        showNativeMenu,
        emitSelect: (requestId: string, itemId: string) => {
            nativeMenuHandler?.({ type: "select", requestId, itemId });
        },
    };
};

const renderNativeMenus = (sideBar: DocumentSideBar) => {
    const typedSideBar = sideBar as unknown as {
        renderConnectionTreeContextMenus: () => ComponentChild;
        renderMrsTreeContextMenus: () => ComponentChild;
    };

    render(
        <>
            {typedSideBar.renderConnectionTreeContextMenus()}
            {typedSideBar.renderMrsTreeContextMenus()}
        </>,
    );
};

describe("DocumentSideBar native menus", () => {
    afterEach(() => {
        cleanup();
        Reflect.deleteProperty(window, "electronHost");
        resetNativeMenuStatics();
        vi.restoreAllMocks();
    });

    it("resolves the connection menu system schemas toggle before serializing the native menu", async () => {
        const sideBar = createSideBar("classic");
        const refreshConnectionTreeEntryChildren = vi.fn().mockResolvedValue(undefined);
        (sideBar as unknown as {
            refreshConnectionTreeEntryChildren: typeof refreshConnectionTreeEntryChildren;
        }).refreshConnectionTreeEntryChildren = refreshConnectionTreeEntryChildren;
        const { showNativeMenu, emitSelect } = installElectronHost();
        renderNativeMenus(sideBar);

        const connection: {
            type: CdmEntityType.Connection;
            details: { dbType: DBType; };
            state: { payload: { showSystemSchemas: boolean; }; };
            connection?: unknown;
        } = {
            type: CdmEntityType.Connection,
            details: {
                dbType: DBType.MySQL,
            },
            state: {
                payload: {
                    showSystemSchemas: true,
                },
            },
        };
        connection.connection = connection;

        const menu = (sideBar as unknown as {
            cdmTypeToMenuRefMap: Map<CdmEntityType, { current: Menu | null; }>;
        }).cdmTypeToMenuRefMap.get(CdmEntityType.Connection)?.current;
        expect(menu).toBeTruthy();

        menu!.open(new DOMRect(12, 16, 2, 2), false, undefined, {
            dataModelEntry: connection,
        });
        await nextRunLoop();

        expect(showNativeMenu).toHaveBeenCalledTimes(1);
        const request = showNativeMenu.mock.calls[0][0] as {
            id: string;
            x?: number;
            y?: number;
            positioningItem?: number;
            items: Array<{ id: string; label?: string; }>;
        };
        expect(request.x).toBeUndefined();
        expect(request.y).toBeUndefined();
        expect(request.positioningItem).toBeUndefined();
        const hideSystemSchemasItem = request.items.find((item) => {
            return item.label === "Hide MySQL System Schemas";
        });
        expect(hideSystemSchemasItem).toBeTruthy();

        emitSelect(request.id, hideSystemSchemasItem!.id);
        await nextRunLoop();

        expect(connection.state.payload.showSystemSchemas).toBe(false);
        expect(refreshConnectionTreeEntryChildren).toHaveBeenCalledWith(connection, true);
    });

    it("resolves the MRS root private-items toggle before serializing the native menu", async () => {
        const sideBar = createSideBar();
        const refreshConnectionTreeEntryChildren = vi.fn().mockResolvedValue(undefined);
        (sideBar as unknown as {
            refreshConnectionTreeEntryChildren: typeof refreshConnectionTreeEntryChildren;
        }).refreshConnectionTreeEntryChildren = refreshConnectionTreeEntryChildren;

        const { showNativeMenu, emitSelect } = installElectronHost();
        renderNativeMenus(sideBar);

        const mrsRoot = {
            type: CdmEntityType.MrsRoot,
            showPrivateItems: true,
        };

        const menu = (sideBar as unknown as {
            cdmTypeToMenuRefMap: Map<CdmEntityType, { current: Menu | null; }>;
        }).cdmTypeToMenuRefMap.get(CdmEntityType.MrsRoot)?.current;
        expect(menu).toBeTruthy();

        menu!.open(new DOMRect(20, 24, 2, 2), false, undefined, {
            dataModelEntry: mrsRoot,
        });
        await nextRunLoop();

        expect(showNativeMenu).toHaveBeenCalledTimes(1);
        const request = showNativeMenu.mock.calls[0][0] as {
            id: string;
            positioningItem?: number;
            items: Array<{ id: string; label?: string; }>;
        };
        expect(request.positioningItem).toBeUndefined();
        const hidePrivateItems = request.items.find((item) => {
            return item.label === "Hide Private Items";
        });
        expect(hidePrivateItems).toBeTruthy();

        emitSelect(request.id, hidePrivateItems!.id);
        await nextRunLoop();

        expect(mrsRoot.showPrivateItems).toBe(false);
        expect(refreshConnectionTreeEntryChildren).toHaveBeenCalledWith(mrsRoot, false, true);
    });

    it("omits MRS actions from Electron database-object context menus", async () => {
        const sideBar = createSideBar();
        const { showNativeMenu } = installElectronHost();
        renderNativeMenus(sideBar);
        const menus = (sideBar as unknown as {
            cdmTypeToMenuRefMap: Map<CdmEntityType, { current: Menu | null; }>;
        }).cdmTypeToMenuRefMap;
        const connection = {
            details: {
                version: 90400,
            },
        };
        const cases: Array<{
            type: CdmEntityType;
            omittedLabel: string;
            retainedLabel: string;
        }> = [{
            type: CdmEntityType.Schema,
            omittedLabel: "Add Schema to REST Service...",
            retainedLabel: "Drop Schema...",
        }, {
            type: CdmEntityType.Table,
            omittedLabel: "Add Database Object to REST Service...",
            retainedLabel: "Drop Table...",
        }, {
            type: CdmEntityType.View,
            omittedLabel: "Add Database Object to REST Service...",
            retainedLabel: "Drop View ...",
        }, {
            type: CdmEntityType.StoredProcedure,
            omittedLabel: "Add Database Object to REST Service...",
            retainedLabel: "Drop Stored Routine ...",
        }, {
            type: CdmEntityType.StoredFunction,
            omittedLabel: "Add Database Object to REST Service...",
            retainedLabel: "Drop Stored Routine ...",
        }];

        for (const testCase of cases) {
            const menu = menus.get(testCase.type)?.current;
            expect(menu).toBeTruthy();
            menu!.open(new DOMRect(12, 16, 2, 2), false, undefined, {
                dataModelEntry: {
                    type: testCase.type,
                    connection,
                },
            });
            await nextRunLoop();

            const request = showNativeMenu.mock.calls.at(-1)?.[0] as {
                items: Array<{ label?: string; }>;
            };
            const labels = request.items.map((item) => {
                return item.label;
            });
            expect(labels).toContain(testCase.retainedLabel);
            expect(labels).not.toContain(testCase.omittedLabel);
        }
    });

    it("serializes routine invocation actions for procedure and function context menus", async () => {
        const sideBar = createSideBar();
        const { showNativeMenu } = installElectronHost();
        renderNativeMenus(sideBar);
        const menus = (sideBar as unknown as {
            cdmTypeToMenuRefMap: Map<CdmEntityType, { current: Menu | null; }>;
        }).cdmTypeToMenuRefMap;

        const openMenu = async (type: CdmEntityType.StoredProcedure | CdmEntityType.StoredFunction) => {
            const menu = menus.get(type)?.current;
            expect(menu).toBeTruthy();
            menu!.open(new DOMRect(12, 16, 2, 2), false, undefined, {
                dataModelEntry: { type },
            });
            await nextRunLoop();

            return showNativeMenu.mock.calls.at(-1)?.[0] as {
                items: Array<{ label?: string; submenu?: Array<{ label?: string; }>; }>;
            };
        };

        const procedureMenu = await openMenu(CdmEntityType.StoredProcedure);
        const procedureInvocationMenus = procedureMenu.items.filter((item) => {
            return item.label === "Copy to Clipboard" || item.label === "Send to SQL Editor";
        });
        expect(procedureInvocationMenus).toHaveLength(2);
        for (const menu of procedureInvocationMenus) {
            expect(menu.submenu?.map((item) => {
                return item.label;
            })).toContain("CALL Statement");
            expect(menu.submenu?.map((item) => {
                return item.label;
            })).not.toContain("SELECT Statement");
        }

        const functionMenu = await openMenu(CdmEntityType.StoredFunction);
        const functionInvocationMenus = functionMenu.items.filter((item) => {
            return item.label === "Copy to Clipboard" || item.label === "Send to SQL Editor";
        });
        expect(functionInvocationMenus).toHaveLength(2);
        for (const menu of functionInvocationMenus) {
            expect(menu.submenu?.map((item) => {
                return item.label;
            })).toContain("Function Call");
            expect(menu.submenu?.map((item) => {
                return item.label;
            })).not.toContain("SELECT Statement");
        }
    });

    it("filters hidden MySQL system schemas from the Electron schema tree", () => {
        const sideBar = createSideBar();
        const getSchemasTreeItems = (sideBar as unknown as {
            getSchemasTreeItems: (connection: unknown, filterValue: string) => Array<{ caption: string; }>;
        }).getSchemasTreeItems;
        const schemaEntries = ["app", "mysql", "mysql_tasks"].map((caption) => {
            return {
                id: caption,
                caption,
                type: CdmEntityType.Schema,
                state: {
                    isLeaf: false,
                    expandedOnce: false,
                },
            };
        });
        const connection = {
            type: CdmEntityType.Connection,
            details: {
                id: 42,
                dbType: DBType.MySQL,
            },
            state: {
                payload: {
                    showSystemSchemas: false,
                },
            },
            schemaEntries,
        };

        expect(getSchemasTreeItems.call(sideBar, connection, "").map((item) => {
            return item.caption;
        })).toEqual(["app"]);
        expect(getSchemasTreeItems.call(sideBar, connection, "mysql")).toHaveLength(0);

        connection.state.payload.showSystemSchemas = true;
        expect(getSchemasTreeItems.call(sideBar, connection, "mysql").map((item) => {
            return item.caption;
        })).toEqual(["mysql", "mysql_tasks"]);
    });

    it("clears and reloads schema search data when refreshing searched schemas", async () => {
        const sideBar = createSideBar();
        const connection = {
            type: CdmEntityType.Connection,
            details: {
                id: 42,
                dbType: DBType.MySQL,
            },
            state: {
                initialized: true,
                payload: {},
            },
            schemaEntries: [],
        };
        const typedSideBar = sideBar as unknown as {
            schemaSearchLoadedConnectionId?: number;
            state: { schemaSearchValues: { value: string; }; };
            schemasSectionRef: unknown;
            getActiveWorkspaceConnectionEntry: () => unknown;
            refreshConnectionEntry: (entry: unknown, sectionRef: unknown) => Promise<boolean>;
            loadSchemaSearchData: (entry: unknown) => Promise<void>;
            handleSectionAction: (command: { command: string; title: string; }) => void;
        };

        typedSideBar.schemaSearchLoadedConnectionId = 42;
        typedSideBar.state.schemaSearchValues = {
            value: "app",
        };
        typedSideBar.getActiveWorkspaceConnectionEntry = () => {
            return connection;
        };
        typedSideBar.refreshConnectionEntry = vi.fn().mockImplementation(() => {
            expect(typedSideBar.schemaSearchLoadedConnectionId).toBeUndefined();

            return Promise.resolve(true);
        });
        typedSideBar.loadSchemaSearchData = vi.fn().mockResolvedValue(undefined);

        typedSideBar.handleSectionAction({
            command: "msg.electronSchemas.refresh",
            title: "Refresh Schemas",
        });
        await nextRunLoop();
        await nextRunLoop();

        expect(typedSideBar.refreshConnectionEntry).toHaveBeenCalledWith(connection, typedSideBar.schemasSectionRef);
        expect(typedSideBar.loadSchemaSearchData).toHaveBeenCalledWith(connection);
    });
});
