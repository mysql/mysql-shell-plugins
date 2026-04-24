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

import { CdmEntityType } from "../../../../data-models/ConnectionDataModel.js";
import { DocumentSideBar } from "../../../../modules/db-editor/DocumentSideBar/DocumentSideBar.js";
import type { DocumentContextType } from "../../../../modules/db-editor/index.js";
import { DBType } from "../../../../supplement/ShellInterface/index.js";

describe("DocumentSideBar", () => {
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
});
