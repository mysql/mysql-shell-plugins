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

import type { RefObject } from "preact";
import type { RowComponent } from "tabulator-tables";
import { describe, expect, it, vi } from "vitest";

import type { AccordionSection } from "../../../../components/ui/Accordion/AccordionSection.js";
import { SetDataAction } from "../../../../components/ui/TreeGrid/TreeGrid.js";
import {
    CdmEntityType, type ConnectionDataModelEntry, type ICdmConnectionEntry,
} from "../../../../data-models/ConnectionDataModel.js";
import { DocumentSideBar } from "../../../../modules/db-editor/DocumentSideBar/DocumentSideBar.js";
import type { DocumentContextType, IConnectionTreeItem } from "../../../../modules/db-editor/index.js";
import { DBType } from "../../../../supplement/ShellInterface/index.js";
import { RowComponentMock } from "../../__mocks__/RowComponentMock.js";

interface ITestEntryState {
    expanded: boolean;
    expandedOnce: boolean;
    initialized: boolean;
    isLeaf: boolean;
}

interface ITestEntry {
    caption: string;
    connection?: ITestEntry;
    getChildren?: () => ITestEntry[];
    id: string;
    members?: ITestEntry[];
    parent?: ITestEntry;
    refresh?: () => Promise<boolean>;
    state: ITestEntryState;
    type: CdmEntityType;
}

interface ITestConnectionEntry extends ITestEntry {
    details: {
        dbType: DBType;
        id: number;
    };
    schemaEntries: ITestEntry[];
}

interface ITestDocumentSideBar {
    buildWorkspaceConnectionTreeItem(entry: ConnectionDataModelEntry): IConnectionTreeItem;
    expandWorkspaceConnectionTreeRow(
        row: RowComponent,
        sectionRef: RefObject<AccordionSection>,
    ): Promise<void>;
    refreshConnectionEntry(
        entry: ConnectionDataModelEntry,
        sectionRef?: RefObject<AccordionSection>,
    ): Promise<boolean>;
    refreshWorkspaceSchemas(connection: ICdmConnectionEntry): Promise<void>;
    schemasSectionRef: RefObject<AccordionSection>;
    schemasTableRef: {
        current: {
            setData(data: IConnectionTreeItem[], action: SetDataAction): Promise<void>;
        } | null;
    };
    state: {
        schemaSearchValues: {
            value?: string;
        };
    };
}

const createTreeState = (overrides: Partial<ITestEntryState> = {}): ITestEntryState => {
    return {
        expanded: false,
        expandedOnce: false,
        initialized: true,
        isLeaf: false,
        ...overrides,
    };
};

const createConnectionTree = (groupType = CdmEntityType.SchemaGroup): {
    connection: ITestConnectionEntry;
    schema: ITestEntry;
    tablesGroup: ITestEntry;
} => {
    const connection: ITestConnectionEntry = {
        id: "connection-42",
        caption: "Sidebar Connection",
        type: CdmEntityType.Connection,
        details: {
            id: 42,
            dbType: DBType.MySQL,
        },
        state: createTreeState({ expandedOnce: true }),
        schemaEntries: [],
        refresh: vi.fn().mockResolvedValue(true),
    };
    const tables: ITestEntry[] = ["actor", "film"].map((caption, index) => {
        return {
            id: `table-${index}`,
            caption,
            type: CdmEntityType.Table,
            connection,
            state: createTreeState(),
            getChildren: () => {
                return [];
            },
        };
    });
    const tablesGroup: ITestEntry = {
        id: "tables-group",
        caption: "Tables",
        type: groupType,
        connection,
        state: createTreeState({ expandedOnce: true }),
        members: tables,
        getChildren: () => {
            return tables;
        },
    };
    const schema: ITestEntry = {
        id: "schema-sakila",
        caption: "sakila",
        type: CdmEntityType.Schema,
        connection,
        state: createTreeState({ expanded: true, expandedOnce: true }),
        getChildren: () => {
            return [tablesGroup];
        },
    };

    tables.forEach((table) => {
        table.parent = tablesGroup;
    });
    tablesGroup.parent = schema;
    schema.parent = connection;
    connection.connection = connection;
    connection.schemaEntries = [schema];
    connection.getChildren = () => {
        return [schema];
    };

    return { connection, schema, tablesGroup };
};

const createSideBar = (connection: ITestConnectionEntry): ITestDocumentSideBar => {
    const sideBar = new DocumentSideBar({
        selectedOpenDocument: "",
        markedSchema: "",
        overviewId: "overview",
        sidebarMode: "electronConnection",
        activeWorkspaceConnectionId: 42,
        onConnectionTreeCommand: vi.fn().mockResolvedValue({ success: true }),
        onDocumentTreeCommand: vi.fn().mockResolvedValue({ success: true }),
        onOciTreeCommand: vi.fn().mockResolvedValue({ success: true }),
    });
    const context = {
        connectionsDataModel: {
            roots: [connection],
            subscribe: vi.fn(),
            unsubscribe: vi.fn(),
        },
        documentDataModel: {
            roots: [],
            subscribe: vi.fn(),
            unsubscribe: vi.fn(),
        },
        ociDataModel: {
            profiles: [],
            updateProfiles: vi.fn(),
        },
        shellTaskDataModel: {},
    } as unknown as DocumentContextType;

    (sideBar as unknown as { context: DocumentContextType; }).context = context;

    return sideBar as unknown as ITestDocumentSideBar;
};

const addTable = (connection: ITestConnectionEntry, tablesGroup: ITestEntry): void => {
    tablesGroup.members?.push({
        id: "table-2",
        caption: "new_table",
        type: CdmEntityType.Table,
        parent: tablesGroup,
        connection,
        state: createTreeState(),
        getChildren: () => {
            return [];
        },
    });
    tablesGroup.state.initialized = true;
};

const tableCaptions = (treeData: IConnectionTreeItem[] | undefined): string[] | undefined => {
    return treeData?.[0].children?.[0].children?.map((entry) => {
        return entry.caption;
    });
};

describe("DocumentSideBar schema refresh", () => {
    it("skips progress handling when an entry has no refresh function", async () => {
        const { tablesGroup } = createConnectionTree();
        const sideBar = createSideBar(tablesGroup.connection as ITestConnectionEntry);
        const progressUpdates: boolean[] = [];
        const sectionRef = {
            current: {
                set showProgress(value: boolean) {
                    progressUpdates.push(value);
                },
            } as AccordionSection,
        };
        tablesGroup.refresh = undefined;

        const refreshed = await sideBar.refreshConnectionEntry(
            tablesGroup as unknown as ConnectionDataModelEntry,
            sectionRef,
        );

        expect(refreshed).toBe(true);
        expect(progressUpdates).toEqual([]);
    });

    it("refreshes a schema entry only once on first expansion", async () => {
        const { connection, tablesGroup } = createConnectionTree();
        const sideBar = createSideBar(connection);
        tablesGroup.state.expandedOnce = false;
        tablesGroup.state.initialized = false;
        const refresh = vi.fn().mockResolvedValue(true);
        tablesGroup.refresh = refresh;
        const treeItem = sideBar.buildWorkspaceConnectionTreeItem(
            tablesGroup as unknown as ConnectionDataModelEntry,
        );
        const row = new RowComponentMock(treeItem);

        await sideBar.expandWorkspaceConnectionTreeRow(
            row as unknown as RowComponent,
            sideBar.schemasSectionRef,
        );

        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("refreshes an expanded Tables entry without clearing its cached rows", async () => {
        const { connection, tablesGroup } = createConnectionTree();
        const sideBar = createSideBar(connection);
        const setData = vi.fn<(data: IConnectionTreeItem[], action: SetDataAction) => Promise<void>>()
            .mockResolvedValue(undefined);
        sideBar.schemasTableRef.current = { setData };
        tablesGroup.state.expanded = true;
        let completeRefresh: (() => void) | undefined;
        let notifyRefreshStarted: (() => void) | undefined;
        const refreshStarted = new Promise<void>((resolve) => {
            notifyRefreshStarted = resolve;
        });
        tablesGroup.refresh = vi.fn().mockImplementation(() => {
            notifyRefreshStarted?.();

            return new Promise<boolean>((resolve) => {
                completeRefresh = () => {
                    addTable(connection, tablesGroup);
                    resolve(true);
                };
            });
        });

        const refresh = sideBar.refreshWorkspaceSchemas(connection as unknown as ICdmConnectionEntry);
        await refreshStarted;

        expect(setData).not.toHaveBeenCalled();

        completeRefresh?.();
        await refresh;

        expect(tableCaptions(setData.mock.calls.at(-1)?.[0])).toEqual(["actor", "film", "new_table"]);
    });

    it.each([
        ["TableGroup", CdmEntityType.TableGroup],
        ["ViewGroup", CdmEntityType.ViewGroup],
        ["EventGroup", CdmEntityType.EventGroup],
        ["ProcedureGroup", CdmEntityType.ProcedureGroup],
        ["FunctionGroup", CdmEntityType.FunctionGroup],
    ] as const)("refreshes an expanded %s entry", async (_caption, groupType) => {
        const { connection, tablesGroup } = createConnectionTree(groupType);
        const sideBar = createSideBar(connection);
        const setData = vi.fn<(data: IConnectionTreeItem[], action: SetDataAction) => Promise<void>>()
            .mockResolvedValue(undefined);
        sideBar.schemasTableRef.current = { setData };
        tablesGroup.state.expanded = true;
        tablesGroup.refresh = vi.fn().mockImplementation(() => {
            addTable(connection, tablesGroup);

            return Promise.resolve(true);
        });

        await sideBar.refreshWorkspaceSchemas(connection as unknown as ICdmConnectionEntry);

        expect(tableCaptions(setData.mock.calls.at(-1)?.[0])).toEqual(["actor", "film", "new_table"]);
    });

    it("replaces the tree once after refreshing all expanded entries", async () => {
        const { connection, schema, tablesGroup } = createConnectionTree();
        const sideBar = createSideBar(connection);
        const setData = vi.fn<(data: IConnectionTreeItem[], action: SetDataAction) => Promise<void>>()
            .mockResolvedValue(undefined);
        sideBar.schemasTableRef.current = { setData };
        tablesGroup.state.expanded = true;
        tablesGroup.refresh = vi.fn().mockImplementation(() => {
            tablesGroup.state.initialized = true;

            return Promise.resolve(true);
        });
        const viewsGroup: ITestEntry = {
            id: "views-group",
            caption: "Views",
            type: CdmEntityType.SchemaGroup,
            parent: schema,
            connection,
            state: createTreeState({ expanded: true, expandedOnce: true }),
            members: [],
            getChildren: () => {
                return viewsGroup.members ?? [];
            },
            refresh: vi.fn().mockImplementation(() => {
                viewsGroup.state.initialized = true;

                return Promise.resolve(true);
            }),
        };
        schema.getChildren = () => {
            return [tablesGroup, viewsGroup];
        };

        await sideBar.refreshWorkspaceSchemas(connection as unknown as ICdmConnectionEntry);

        expect(setData).toHaveBeenCalledTimes(1);
    });

    it("replaces a filtered tree once after refreshing its schema data", async () => {
        const { connection } = createConnectionTree();
        const sideBar = createSideBar(connection);
        const setData = vi.fn<(data: IConnectionTreeItem[], action: SetDataAction) => Promise<void>>()
            .mockResolvedValue(undefined);
        sideBar.schemasTableRef.current = { setData };
        sideBar.state.schemaSearchValues.value = "actor";

        await sideBar.refreshWorkspaceSchemas(connection as unknown as ICdmConnectionEntry);

        expect(setData).toHaveBeenCalledTimes(1);
    });

    it("refreshes a stale collapsed Tables entry when it is expanded again", async () => {
        const { connection, tablesGroup } = createConnectionTree();
        const sideBar = createSideBar(connection);
        const setData = vi.fn<(data: IConnectionTreeItem[], action: SetDataAction) => Promise<void>>()
            .mockResolvedValue(undefined);
        sideBar.schemasTableRef.current = { setData };
        tablesGroup.refresh = vi.fn().mockImplementation(() => {
            addTable(connection, tablesGroup);

            return Promise.resolve(true);
        });

        await sideBar.refreshWorkspaceSchemas(connection as unknown as ICdmConnectionEntry);

        expect(tableCaptions(setData.mock.calls.at(-1)?.[0])).toEqual(["actor", "film"]);
        expect(tablesGroup.state.initialized).toBe(false);

        const treeItem = sideBar.buildWorkspaceConnectionTreeItem(
            tablesGroup as unknown as ConnectionDataModelEntry,
        );
        const row = new RowComponentMock(treeItem);
        await sideBar.expandWorkspaceConnectionTreeRow(
            row as unknown as RowComponent,
            sideBar.schemasSectionRef,
        );

        expect(tableCaptions(setData.mock.calls.at(-1)?.[0])).toEqual(["actor", "film", "new_table"]);
    });

    it("marks any loaded schema entry with a refresh function stale", async () => {
        const { connection, tablesGroup } = createConnectionTree();
        const sideBar = createSideBar(connection);
        const refreshableView: ITestEntry = {
            id: "view-address",
            caption: "address",
            type: CdmEntityType.View,
            parent: tablesGroup,
            connection,
            state: createTreeState({ isLeaf: true }),
            refresh: vi.fn().mockResolvedValue(true),
        };
        tablesGroup.members?.push(refreshableView);

        await sideBar.refreshWorkspaceSchemas(connection as unknown as ICdmConnectionEntry);

        expect(refreshableView.state.initialized).toBe(false);
    });
});
