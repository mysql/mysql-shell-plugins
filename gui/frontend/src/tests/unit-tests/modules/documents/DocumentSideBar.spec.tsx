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

import { describe, expect, it, vi } from "vitest";

import {
    CdmEntityType, type ICdmConnectionEntry, type ICdmConnectionGroupEntry,
} from "../../../../data-models/ConnectionDataModel.js";
import { SetDataAction } from "../../../../components/ui/TreeGrid/TreeGrid.js";
import { DocumentSideBar } from "../../../../modules/db-editor/DocumentSideBar/DocumentSideBar.js";
import type { DocumentContextType } from "../../../../modules/db-editor/index.js";
import { DBType } from "../../../../supplement/ShellInterface/index.js";
import { RowComponentMock } from "../../__mocks__/RowComponentMock.js";

describe("DocumentSideBar", () => {
    interface IAccordionSectionTestData {
        id: string;
        expanded?: boolean;
    }

    interface IRenderedNode {
        props: {
            id?: string;
            children?: unknown;
            sections?: IAccordionSectionTestData[];
        };
    }

    interface IConnectionTreeItemTestData {
        id: string;
        dataModelEntry: ICdmConnectionEntry | ICdmConnectionGroupEntry;
        caption: string;
        children?: IConnectionTreeItemTestData[];
    }

    interface ITestDocumentSideBar {
        buildHomeConnectionTreeItem(entry: ICdmConnectionEntry | ICdmConnectionGroupEntry): IConnectionTreeItemTestData;
        buildWorkspaceConnectionTreeItem(entry: Record<string, unknown>): IConnectionTreeItemTestData;
        handleConnectionTreeRowExpanded(row: RowComponentMock): void;
        handleSchemasTreeRowExpanded(row: RowComponentMock): void;
        handleSectionExpand(props: unknown, sectionId: string, expanded: boolean): void;
        schemasTableRef: {
            current: {
                setData(data: unknown[], action: SetDataAction): Promise<void>;
            } | null;
        };
    }

    const isRenderedNode = (value: unknown): value is IRenderedNode => {
        return typeof value === "object" && value !== null && "props" in value;
    };

    const getAccordionSections = (sideBar: DocumentSideBar) => {
        const result = sideBar.render();
        const children = isRenderedNode(result) && Array.isArray(result.props.children)
            ? result.props.children
            : [isRenderedNode(result) ? result.props.children : undefined];
        const accordion = children.find((child): child is IRenderedNode => {
            return isRenderedNode(child) && child.props.id === "documentSideBar";
        });

        return accordion?.props.sections ?? [];
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

    const createConnectionTree = () => {
        const connection: Record<string, unknown> = {
            id: "shared-connection-42",
            caption: "Sidebar Connection",
            type: CdmEntityType.Connection,
            details: {
                id: 42,
                dbType: DBType.MySQL,
                caption: "Sidebar Connection",
                description: "Sidebar Connection",
                folderPath: "/",
                index: 0,
                options: {},
                version: 80403,
            },
            state: createTreeState({ expandedOnce: true }),
            schemaEntries: [],
            currentSchema: "",
            isOpen: true,
            refresh: vi.fn().mockResolvedValue(true),
        };

        const filmColumns: Array<Record<string, unknown>> = ["id", "title"].map((caption, index) => {
            return {
                id: `film-column-${index}`,
                caption,
                type: CdmEntityType.Column,
                parent: undefined,
                connection,
                state: createTreeState({ isLeaf: true }),
                refresh: vi.fn().mockResolvedValue(true),
                getChildren: vi.fn().mockReturnValue(undefined),
            };
        });

        const tables: Array<Record<string, unknown>> = ["actor", "film"].map((caption, index) => {
            const columnsGroup: Record<string, unknown> = {
                id: `${caption}-columns-group`,
                caption: "Columns",
                type: CdmEntityType.TableGroup,
                subType: CdmEntityType.Column,
                parent: undefined,
                connection,
                state: createTreeState({ expandedOnce: true }),
                members: caption === "film" ? filmColumns : [],
                refresh: vi.fn().mockResolvedValue(true),
                getChildren: vi.fn().mockImplementation(() => {
                    return caption === "film" ? filmColumns : [];
                }),
            };

            filmColumns.forEach((column) => {
                column.parent = columnsGroup;
            });

            return {
                id: `table-${index}`,
                caption,
                type: CdmEntityType.Table,
                parent: undefined,
                connection,
                state: createTreeState({ expandedOnce: true }),
                refresh: vi.fn().mockResolvedValue(true),
                getChildren: vi.fn().mockReturnValue([columnsGroup]),
            };
        });

        const tablesGroup: Record<string, unknown> = {
            id: "tables-group",
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

        connection.connection = connection;
        connection.schemaEntries = [schema];
        connection.getChildren = vi.fn().mockImplementation(() => {
            return [schema];
        });

        return { connection };
    };

    const createContext = (connection: Record<string, unknown>): DocumentContextType => {
        return {
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
    };

    it("filters schema search results to matching branches and restores the full tree when cleared", () => {
        const { connection } = createConnectionTree();
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

        (sideBar as unknown as { context: DocumentContextType; }).context = createContext(connection);

        const filtered = (sideBar as any).getSchemasTreeItems(connection, "actor");
        expect(filtered).toHaveLength(1);
        expect(filtered[0].caption).toBe("sakila");
        expect(filtered[0].children).toHaveLength(1);
        expect(filtered[0].children?.[0].caption).toBe("Tables");
        expect(filtered[0].children?.[0].children).toHaveLength(1);
        expect(filtered[0].children?.[0].children?.[0].caption).toBe("actor");

        const cleared = (sideBar as any).getSchemasTreeItems(connection, "");
        expect(cleared).toHaveLength(1);
        expect(cleared[0].children).toHaveLength(1);
        expect(cleared[0].children?.[0].children).toHaveLength(2);
        expect(cleared[0].children?.[0].children?.map((entry: { caption: string; }) => {
            return entry.caption;
        })).toEqual(["actor", "film"]);
    });

    it("fuzzily filters schema search results by captions and qualified identifiers", () => {
        const { connection } = createConnectionTree();
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

        (sideBar as unknown as { context: DocumentContextType; }).context = createContext(connection);

        let filtered = (sideBar as any).getSchemasTreeItems(connection, "flm");
        expect(filtered[0].children?.[0].children?.map((entry: { caption: string; }) => {
            return entry.caption;
        })).toEqual(["film"]);

        filtered = (sideBar as any).getSchemasTreeItems(connection, "sakila.film");
        expect(filtered[0].children?.[0].children?.map((entry: { caption: string; }) => {
            return entry.caption;
        })).toEqual(["film"]);
        expect(filtered[0].children?.[0].children?.[0].children).toEqual([]);

        filtered = (sideBar as any).getSchemasTreeItems(connection, "film.id");
        expect(filtered[0].children?.[0].children?.[0].children?.[0].children?.map((entry: { caption: string; }) => {
            return entry.caption;
        })).toEqual(["id"]);

        filtered = (sideBar as any).getSchemasTreeItems(connection, "`sakila`.`film`.`id`");
        expect(filtered[0].children?.[0].children?.[0].children?.[0].children?.map((entry: { caption: string; }) => {
            return entry.caption;
        })).toEqual(["id"]);

        filtered = (sideBar as any).getSchemasTreeItems(connection, "sakila.id");
        expect(filtered).toHaveLength(0);

        filtered = (sideBar as any).getSchemasTreeItems(connection, "sakila.actor.id");
        expect(filtered).toHaveLength(0);
    });

    it("highlights fuzzy schema search matches in tree captions", () => {
        const { connection } = createConnectionTree();
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

        (sideBar as unknown as { context: DocumentContextType; }).context = createContext(connection);
        (sideBar as unknown as { state: { schemaSearchValues: { value: string; }; }; }).state.schemaSearchValues = {
            value: "sakila.film",
        };

        const filtered = (sideBar as any).getSchemasTreeItems(connection, "sakila.film");
        const host = (sideBar as any).connectionTreeCellFormatter({
            getData: () => {
                return filtered[0].children?.[0].children?.[0];
            },
        }) as HTMLElement;

        expect([...host.querySelectorAll(".schemaSearchMatch")].map((element) => {
            return element.textContent;
        }).join("")).toBe("film");
    });

    it("renders the current schema icon as marked", () => {
        const { connection } = createConnectionTree();
        const sideBar = new DocumentSideBar({
            selectedOpenDocument: "",
            markedSchema: "sakila",
            overviewId: "overview",
            sidebarMode: "electronConnection",
            activeWorkspaceConnectionId: 42,
            onConnectionTreeCommand: vi.fn().mockResolvedValue({ success: true }),
            onDocumentTreeCommand: vi.fn().mockResolvedValue({ success: true }),
            onOciTreeCommand: vi.fn().mockResolvedValue({ success: true }),
        });

        const schema = (connection.schemaEntries as Array<Record<string, unknown>>)[0];
        const treeItem = (sideBar as any).buildWorkspaceConnectionTreeItem(schema);
        const host = (sideBar as any).connectionTreeCellFormatter({
            getData: () => {
                return treeItem;
            },
        }) as HTMLElement;

        expect(host.classList.contains("marked")).toBe(true);
        expect(host.querySelector(".icon")?.classList.contains("markedSchemaIcon")).toBe(true);
        expect(host.querySelector("#mainCaption")?.classList.contains("markedSchemaPill")).toBe(false);
    });

    it("persists auto-expansion of the current schema across schema refresh", () => {
        const { connection } = createConnectionTree();
        const sideBar = new DocumentSideBar({
            selectedOpenDocument: "",
            markedSchema: "sakila",
            overviewId: "overview",
            sidebarMode: "electronConnection",
            activeWorkspaceConnectionId: 42,
            onConnectionTreeCommand: vi.fn().mockResolvedValue({ success: true }),
            onDocumentTreeCommand: vi.fn().mockResolvedValue({ success: true }),
            onOciTreeCommand: vi.fn().mockResolvedValue({ success: true }),
        });

        const schema = (connection.schemaEntries as Array<Record<string, unknown>>)[0];
        schema.state = createTreeState();
        const treeItem = (sideBar as any).buildWorkspaceConnectionTreeItem(schema);
        const row = new RowComponentMock(treeItem as never);

        expect((sideBar as any).isConnectionTreeRowExpanded(row)).toBe(true);
        expect((schema.state as { expanded: boolean; }).expanded).toBe(true);
    });

    it("updates schema tree data after first expansion", async () => {
        const { connection } = createConnectionTree();
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
        (sideBar as unknown as { context: DocumentContextType; }).context = createContext(connection);

        const schema = (connection.schemaEntries as Array<Record<string, unknown>>)[0];
        schema.state = createTreeState();
        const testSideBar = sideBar as unknown as ITestDocumentSideBar;
        const setData = vi.fn().mockResolvedValue(undefined);
        testSideBar.schemasTableRef.current = { setData };
        const treeItem = testSideBar.buildWorkspaceConnectionTreeItem(schema);
        const row = new RowComponentMock(treeItem as unknown as ConstructorParameters<typeof RowComponentMock>[0]);

        testSideBar.handleSchemasTreeRowExpanded(row);
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });

        expect(schema.refresh).toHaveBeenCalled();
        expect(setData).toHaveBeenCalledWith([
            expect.objectContaining({
                id: "schema-sakila",
                children: [
                    expect.objectContaining({
                        id: "tables-group",
                    }),
                ],
            }),
        ], SetDataAction.Replace);
        expect((schema.state as { expandedOnce: boolean; }).expandedOnce).toBe(true);
    });

    it("shows the home connection section by default", () => {
        const { connection } = createConnectionTree();
        const sideBar = new DocumentSideBar({
            selectedOpenDocument: "",
            markedSchema: "",
            overviewId: "overview",
            sidebarMode: "electronHome",
            onConnectionTreeCommand: vi.fn().mockResolvedValue({ success: true }),
            onDocumentTreeCommand: vi.fn().mockResolvedValue({ success: true }),
            onOciTreeCommand: vi.fn().mockResolvedValue({ success: true }),
        });

        (sideBar as unknown as { context: DocumentContextType; }).context = createContext(connection);

        const connectionSection = getAccordionSections(sideBar).find((section) => {
            return section.id === "connectionSection";
        });

        expect(connectionSection?.expanded).toBe(true);
    });

    it("loads Home sidebar group contents on first expansion", async () => {
        const { connection } = createConnectionTree();
        const groupEntries: Array<ICdmConnectionEntry | ICdmConnectionGroupEntry> = [];
        const group = {
            id: "group-projects",
            caption: "Projects",
            type: CdmEntityType.ConnectionGroup,
            entries: groupEntries,
            state: createTreeState(),
            folderPath: { id: 2, caption: "Projects", index: 0 },
            getChildren: () => {
                return group.entries;
            },
            refresh: vi.fn().mockImplementation(() => {
                group.entries.push(connection as unknown as ICdmConnectionEntry);

                return Promise.resolve(true);
            }),
        } as unknown as ICdmConnectionGroupEntry;
        const sideBar = new DocumentSideBar({
            selectedOpenDocument: "",
            markedSchema: "",
            overviewId: "overview",
            sidebarMode: "electronHome",
            onConnectionTreeCommand: vi.fn().mockResolvedValue({ success: true }),
            onDocumentTreeCommand: vi.fn().mockResolvedValue({ success: true }),
            onOciTreeCommand: vi.fn().mockResolvedValue({ success: true }),
        });

        (sideBar as unknown as { context: DocumentContextType; }).context = createContext(group);

        const testSideBar = sideBar as unknown as ITestDocumentSideBar;
        const treeItem = testSideBar.buildHomeConnectionTreeItem(group);
        const row = new RowComponentMock(treeItem as unknown as ConstructorParameters<typeof RowComponentMock>[0]);
        testSideBar.handleConnectionTreeRowExpanded(row);
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });

        expect(group.refresh).toHaveBeenCalled();
        expect((group.state as { expandedOnce: boolean; }).expandedOnce).toBe(true);
        expect(group.entries).toEqual([connection]);
    });

    it("keeps sidebar expansion state isolated by workspace type", () => {
        const { connection } = createConnectionTree();
        const savedSectionState = new Map([
            ["classic.connectionSection", { expanded: false }],
        ]);
        const sideBar = new DocumentSideBar({
            selectedOpenDocument: "",
            markedSchema: "",
            overviewId: "overview",
            sidebarMode: "electronHome",
            savedSectionState,
            onConnectionTreeCommand: vi.fn().mockResolvedValue({ success: true }),
            onDocumentTreeCommand: vi.fn().mockResolvedValue({ success: true }),
            onOciTreeCommand: vi.fn().mockResolvedValue({ success: true }),
        });

        (sideBar as unknown as { context: DocumentContextType; }).context = createContext(connection);

        const connectionSection = getAccordionSections(sideBar).find((section) => {
            return section.id === "connectionSection";
        });

        expect(connectionSection?.expanded).toBe(true);
    });

    it("stores sidebar expansion state under the workspace type", () => {
        const onSaveState = vi.fn();
        const sideBar = new DocumentSideBar({
            selectedOpenDocument: "",
            markedSchema: "",
            overviewId: "overview",
            sidebarMode: "electronHome",
            onSaveState,
            onConnectionTreeCommand: vi.fn().mockResolvedValue({ success: true }),
            onDocumentTreeCommand: vi.fn().mockResolvedValue({ success: true }),
            onOciTreeCommand: vi.fn().mockResolvedValue({ success: true }),
        });

        (sideBar as unknown as ITestDocumentSideBar).handleSectionExpand({}, "connectionSection", true);

        const savedState = onSaveState.mock.calls[0][0] as Map<string, { expanded?: boolean; }>;
        expect(savedState.get("electronHome.connectionSection")?.expanded).toBe(true);
        expect(savedState.has("connectionSection")).toBe(false);
    });
});
