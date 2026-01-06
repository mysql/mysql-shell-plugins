/* eslint-disable @typescript-eslint/no-unsafe-call */
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

/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { render } from "@testing-library/preact";
import {
    beforeEach, describe, expect, it, vi, type MockedFunction
} from "vitest";

import { DialogResponseClosure } from "../../../../app-logic/general-types.js";
import { MigrationFilterInfo } from "../../../../app-logic/MigrationSubApp/MigrationFilterInfo.js";
import { SchemaFilterEditor } from "../../../../app-logic/MigrationSubApp/SchemaFilterEditor.js";
import { ISchemaObjects, ISchemaTables, PlanDataItemType } from "../../../../communication/ProtocolMigration.js";
import { ShellInterfaceMigration } from "../../../../supplement/ShellInterface/ShellInterfaceMigration.js";
import { mockClassMethods } from "../../test-helpers.js";

// Mock ValueEditDialog
const mockValueEditDialog = {
    show: vi.fn(),
    getDialogValues: vi.fn(),
    updateInputDescription: vi.fn(),
};

vi.mock("../../../../components/Dialogs/ValueEditDialog.js", () => {
    return {
        ValueEditDialog: vi.fn().mockImplementation(() => {
            return mockValueEditDialog;
        }),
        CommonDialogValueOption: {
            Disabled: "disabled",
        },
    };
});

// Mock CheckState
vi.mock("../../../../components/ui/Checkbox/Checkbox.js", () => {
    return {
        CheckState: {
            Checked: "checked",
            Unchecked: "unchecked",
        },
    };
});

const mockMigration = new ShellInterfaceMigration();

mockClassMethods(ShellInterfaceMigration, {
    planGetDataItem: vi.fn(),
});

describe("MigrationFilterInfo", () => {
    let filterInfo: MigrationFilterInfo;

    beforeEach(() => {
        vi.clearAllMocks();
        filterInfo = new MigrationFilterInfo(mockMigration);
    });

    describe("constructor", () => {
        it("should create a new MigrationFilterInfo instance", () => {
            expect(filterInfo).toBeInstanceOf(MigrationFilterInfo);
            expect(filterInfo.migrateAllObjects).toBe(true);
            expect(filterInfo.migrateAllUsers).toBe(true);
        });
    });

    describe("isObjectTypeIncluded", () => {
        it("should return true for triggers when options.migrateTriggers is true", () => {
            filterInfo.setOptions({
                filter: {
                    schemas: { include: [], exclude: [] },
                    tables: { include: [], exclude: [] },
                    views: { include: [], exclude: [] },
                    routines: { include: [], exclude: [] },
                    events: { include: [], exclude: [] },
                    libraries: { include: [], exclude: [] },
                    triggers: { include: [], exclude: [] },
                    users: { include: [], exclude: [] }
                },
                migrateSchema: true,
                migrateData: true,
                migrateRoutines: true,
                migrateTriggers: true,
                migrateEvents: true,
                migrateLibraries: true,
                migrateUsers: true
            });

            expect(filterInfo.isObjectTypeIncluded("triggers")).toBe(true);
        });

        it("should return false for triggers when options.migrateTriggers is false", () => {
            filterInfo.setOptions({
                filter: {
                    schemas: { include: [], exclude: [] },
                    tables: { include: [], exclude: [] },
                    views: { include: [], exclude: [] },
                    routines: { include: [], exclude: [] },
                    events: { include: [], exclude: [] },
                    libraries: { include: [], exclude: [] },
                    triggers: { include: [], exclude: [] },
                    users: { include: [], exclude: [] }
                },
                migrateSchema: true,
                migrateData: true,
                migrateRoutines: true,
                migrateTriggers: false,
                migrateEvents: true,
                migrateLibraries: true,
                migrateUsers: true
            });

            expect(filterInfo.isObjectTypeIncluded("triggers")).toBe(false);
        });

        it("should return true for users", () => {
            filterInfo.setOptions({
                filter: {
                    schemas: { include: [], exclude: [] },
                    tables: { include: [], exclude: [] },
                    views: { include: [], exclude: [] },
                    routines: { include: [], exclude: [] },
                    events: { include: [], exclude: [] },
                    libraries: { include: [], exclude: [] },
                    triggers: { include: [], exclude: [] },
                    users: { include: [], exclude: [] }
                },
                migrateSchema: true,
                migrateData: true,
                migrateRoutines: true,
                migrateTriggers: true,
                migrateEvents: true,
                migrateLibraries: true,
                migrateUsers: true
            });

            expect(filterInfo.isObjectTypeIncluded("users")).toBe(true);
        });
    });

    describe("setObjectTypeIncluded", () => {
        it("should set migrateTriggers to true", () => {
            filterInfo.setOptions({
                filter: {
                    schemas: { include: [], exclude: [] },
                    tables: { include: [], exclude: [] },
                    views: { include: [], exclude: [] },
                    routines: { include: [], exclude: [] },
                    events: { include: [], exclude: [] },
                    libraries: { include: [], exclude: [] },
                    triggers: { include: [], exclude: [] },
                    users: { include: [], exclude: [] }
                },
                migrateSchema: true,
                migrateData: true,
                migrateRoutines: true,
                migrateTriggers: false,
                migrateEvents: true,
                migrateLibraries: true,
                migrateUsers: true
            });

            filterInfo.setObjectTypeIncluded("triggers", true);
            expect(filterInfo.isObjectTypeIncluded("triggers")).toBe(true);
        });

        it("should set migrateTriggers to false", () => {
            filterInfo.setOptions({
                filter: {
                    schemas: { include: [], exclude: [] },
                    tables: { include: [], exclude: [] },
                    views: { include: [], exclude: [] },
                    routines: { include: [], exclude: [] },
                    events: { include: [], exclude: [] },
                    libraries: { include: [], exclude: [] },
                    triggers: { include: [], exclude: [] },
                    users: { include: [], exclude: [] }
                },
                migrateSchema: true,
                migrateData: true,
                migrateRoutines: true,
                migrateTriggers: true,
                migrateEvents: true,
                migrateLibraries: true,
                migrateUsers: true
            });

            filterInfo.setObjectTypeIncluded("triggers", false);
            expect(filterInfo.isObjectTypeIncluded("triggers")).toBe(false);
        });
    });

    describe("isSchemaIncluded", () => {
        it("should return true for a schema by default", () => {
            expect(filterInfo.isSchemaIncluded("test_schema")).toBe(true);
        });

        it("should return true for an included schema", () => {
            filterInfo.setSchemaIncluded("test_schema", true);
            expect(filterInfo.isSchemaIncluded("test_schema")).toBe(true);
        });

        it("should return false for an excluded schema", () => {
            filterInfo.setSchemaIncluded("test_schema", false);
            expect(filterInfo.isSchemaIncluded("test_schema")).toBe(false);
        });
    });

    describe("isAccountIncluded", () => {
        it("should return true for a user not in exclude list", () => {
            filterInfo.setOptions({
                filter: {
                    schemas: { include: [], exclude: [] },
                    tables: { include: [], exclude: [] },
                    views: { include: [], exclude: [] },
                    routines: { include: [], exclude: [] },
                    events: { include: [], exclude: [] },
                    libraries: { include: [], exclude: [] },
                    triggers: { include: [], exclude: [] },
                    users: { include: [], exclude: ["user1@%"] }
                },
                migrateSchema: true,
                migrateData: true,
                migrateRoutines: true,
                migrateTriggers: true,
                migrateEvents: true,
                migrateLibraries: true,
                migrateUsers: true
            });

            expect(filterInfo.isAccountIncluded("user2")).toBe(true);
        });

        it("should return false for a user in exclude list", () => {
            filterInfo.setOptions({
                filter: {
                    schemas: { include: [], exclude: [] },
                    tables: { include: [], exclude: [] },
                    views: { include: [], exclude: [] },
                    routines: { include: [], exclude: [] },
                    events: { include: [], exclude: [] },
                    libraries: { include: [], exclude: [] },
                    triggers: { include: [], exclude: [] },
                    users: { include: [], exclude: ["user1@%"] }
                },
                migrateSchema: true,
                migrateData: true,
                migrateRoutines: true,
                migrateTriggers: true,
                migrateEvents: true,
                migrateLibraries: true,
                migrateUsers: true
            });

            expect(filterInfo.isAccountIncluded("user1@%")).toBe(false);
        });
    });

    describe("setAccountIncluded", () => {
        it("should remove user from exclude list when including", () => {
            filterInfo.setOptions({
                filter: {
                    schemas: { include: [], exclude: [] },
                    tables: { include: [], exclude: [] },
                    views: { include: [], exclude: [] },
                    routines: { include: [], exclude: [] },
                    events: { include: [], exclude: [] },
                    libraries: { include: [], exclude: [] },
                    triggers: { include: [], exclude: [] },
                    users: { include: [], exclude: ["user1@%"] }
                },
                migrateSchema: true,
                migrateData: true,
                migrateRoutines: true,
                migrateTriggers: true,
                migrateEvents: true,
                migrateLibraries: true,
                migrateUsers: true
            });

            filterInfo.setAccountIncluded("user1@%", true);
            expect(filterInfo.isAccountIncluded("user1@%")).toBe(true);
        });

        it("should add user to exclude list when excluding", () => {
            filterInfo.setOptions({
                filter: {
                    schemas: { include: [], exclude: [] },
                    tables: { include: [], exclude: [] },
                    views: { include: [], exclude: [] },
                    routines: { include: [], exclude: [] },
                    events: { include: [], exclude: [] },
                    libraries: { include: [], exclude: [] },
                    triggers: { include: [], exclude: [] },
                    users: { include: [], exclude: [] }
                },
                migrateSchema: true,
                migrateData: true,
                migrateRoutines: true,
                migrateTriggers: true,
                migrateEvents: true,
                migrateLibraries: true,
                migrateUsers: true
            });

            filterInfo.setAccountIncluded("user1@%", false);
            expect(filterInfo.isAccountIncluded("user1@%")).toBe(false);
        });
    });

    describe("isObjectExcluded", () => {
        it("should return false when no filter exists", () => {
            expect(filterInfo.isObjectExcluded("test_schema", "tables", "table1")).toBe(false);
        });

        it("should return true when object is in exclude list", () => {
            filterInfo.setObjectExcluded("test_schema", "tables", "table1", true);
            expect(filterInfo.isObjectExcluded("test_schema", "tables", "table1")).toBe(true);
        });

        it("should return false when object is not in exclude list", () => {
            filterInfo.setObjectExcluded("test_schema", "tables", "table1", true);
            expect(filterInfo.isObjectExcluded("test_schema", "tables", "table2")).toBe(false);
        });
    });

    describe("setObjectExcluded", () => {
        it("should remove object from exclude list when setting exclude to false", () => {
            filterInfo.setObjectExcluded("test_schema", "tables", "table1", true);
            filterInfo.setObjectExcluded("test_schema", "tables", "table1", false);
            expect(filterInfo.isObjectExcluded("test_schema", "tables", "table1")).toBe(false);
        });

        it("should add object to exclude list when setting exclude to true", () => {
            filterInfo.setObjectExcluded("test_schema", "tables", "table1", true);
            expect(filterInfo.isObjectExcluded("test_schema", "tables", "table1")).toBe(true);
        });
    });

    describe("setExcludeList", () => {
        it("should set the exclude list", () => {
            filterInfo.setExcludeList("test_schema", "tables", ["table1", "table2"]);
            expect(filterInfo.getExcludedObjects("test_schema", "tables")).toEqual(["table1", "table2"]);
        });
    });

    describe("getExcludedObjects", () => {
        it("should return exclude list", () => {
            filterInfo.setExcludeList("test_schema", "tables", ["table1"]);
            expect(filterInfo.getExcludedObjects("test_schema", "tables")).toEqual(["table1"]);
        });

        it("should return empty array when no filter", () => {
            expect(filterInfo.getExcludedObjects("test_schema", "tables")).toEqual([]);
        });
    });

    describe("getSchemaObjects", () => {
        it("should return undefined for unknown schema", () => {
            expect(filterInfo.getSchemaObjects("unknown_schema", "tables")).toBeUndefined();
        });

        it("should return cached objects", async () => {
            const mockData: ISchemaTables = {
                schema: "test_schema",
                tables: ["`table1`"],
                views: []
            };

            (mockMigration.planGetDataItem as MockedFunction<any>).mockResolvedValue(mockData);

            await filterInfo.fetchSchemaObjects("test_schema", "tables");
            expect(filterInfo.getSchemaObjects("test_schema", "tables")).toEqual(["`table1`"]);
        });
    });

    describe("fetchSchemaObjects", () => {
        it("should return cached objects if available", async () => {
            const mockData: ISchemaTables = {
                schema: "test_schema",
                tables: ["`table1`"],
                views: []
            };

            (mockMigration.planGetDataItem as MockedFunction<any>).mockResolvedValue(mockData);

            // First call caches the data
            await filterInfo.fetchSchemaObjects("test_schema", "tables");

            // Reset mock to check it's not called again
            vi.clearAllMocks();

            const result = await filterInfo.fetchSchemaObjects("test_schema", "tables");
            expect(result).toEqual(["`table1`"]);
            expect(mockMigration.planGetDataItem).not.toHaveBeenCalled();
        });

        it("should fetch tables and views for tables request", async () => {
            const mockData: ISchemaTables = {
                schema: "test_schema",
                tables: ["table1", "table2"],
                views: ["view1"]
            };

            (mockMigration.planGetDataItem as MockedFunction<any>).mockResolvedValue(mockData);

            const result = await filterInfo.fetchSchemaObjects("test_schema", "tables");
            expect(result).toEqual(["table1", "table2"]);
            expect(mockMigration.planGetDataItem).toHaveBeenCalledWith(PlanDataItemType.SCHEMA_TABLES, "test_schema");
        });

        it("should fetch views for views request", async () => {
            const mockData: ISchemaTables = {
                schema: "test_schema",
                tables: ["`table1`", "`table2`"],
                views: ["`view1`"]
            };

            (mockMigration.planGetDataItem as MockedFunction<any>).mockResolvedValue(mockData);

            const result = await filterInfo.fetchSchemaObjects("test_schema", "views");
            expect(result).toEqual(["`view1`"]);
            expect(mockMigration.planGetDataItem).toHaveBeenCalledWith(PlanDataItemType.SCHEMA_TABLES, "test_schema");
        });

        it("should fetch objects for other types", async () => {
            const mockData: ISchemaObjects = {
                schema: "test_schema",
                objects: ["routine1", "routine2"]
            };

            (mockMigration.planGetDataItem as MockedFunction<any>).mockResolvedValue(mockData);

            const result = await filterInfo.fetchSchemaObjects("test_schema", "routines");
            expect(result).toEqual(["routine1", "routine2"]);
            expect(mockMigration.planGetDataItem).toHaveBeenCalledWith(PlanDataItemType.SCHEMA_ROUTINES, "test_schema");
        });

        it("should throw error for invalid object type", async () => {
            await expect(filterInfo.fetchSchemaObjects("test_schema", "invalid" as any)).rejects.toThrow(
                "Invalid object type invalid",
            );
        });
    });

    describe("setOptions", () => {
        it("should set options and process schema filters", () => {
            const options = {
                filter: {
                    schemas: { include: ["`schema1`"], exclude: ["`schema2`"] },
                    tables: { include: [], exclude: [] },
                    views: { include: [], exclude: [] },
                    routines: { include: [], exclude: [] },
                    events: { include: [], exclude: [] },
                    libraries: { include: [], exclude: [] },
                    triggers: { include: [], exclude: [] },
                    users: { include: [], exclude: ["user1@%"] }
                },
                migrateSchema: true,
                migrateData: true,
                migrateRoutines: true,
                migrateTriggers: true,
                migrateEvents: true,
                migrateLibraries: true,
                migrateUsers: false
            };

            filterInfo.setOptions(options);

            expect(filterInfo.isSchemaIncluded("schema1")).toBe(true);
            expect(filterInfo.isSchemaIncluded("schema2")).toBe(false);
            expect(filterInfo.migrateAllObjects).toBe(false);
            expect(filterInfo.migrateAllUsers).toBe(false);
        });

        it("should process object filters", () => {
            const options = {
                filter: {
                    schemas: { include: [], exclude: [] },
                    tables: { include: [], exclude: ["`schema1`.`table1`"] },
                    views: { include: [], exclude: [] },
                    routines: { include: [], exclude: [] },
                    events: { include: [], exclude: [] },
                    libraries: { include: [], exclude: [] },
                    triggers: { include: [], exclude: [] },
                    users: { include: [], exclude: [] }
                },
                migrateSchema: true,
                migrateData: true,
                migrateRoutines: true,
                migrateTriggers: true,
                migrateEvents: true,
                migrateLibraries: true,
                migrateUsers: true
            };

            filterInfo.setOptions(options);

            expect(filterInfo.isObjectExcluded("schema1", "tables", "`table1`")).toBe(true);
            expect(filterInfo.migrateAllObjects).toBe(false);
        });
    });

    describe("getOptions", () => {
        it("should throw error when options not set", () => {
            expect(() => {
                filterInfo.getOptions();
            }).toThrow("options not set");
        });

        it("should return processed options", () => {
            const options = {
                filter: {
                    schemas: { include: [], exclude: [] },
                    tables: { include: [], exclude: [] },
                    views: { include: [], exclude: [] },
                    routines: { include: [], exclude: [] },
                    events: { include: [], exclude: [] },
                    libraries: { include: [], exclude: [] },
                    triggers: { include: [], exclude: [] },
                    users: { include: [], exclude: ["user1@%"] }
                },
                migrateSchema: true,
                migrateData: true,
                migrateRoutines: true,
                migrateTriggers: true,
                migrateEvents: true,
                migrateLibraries: true,
                migrateUsers: false
            };

            filterInfo.setOptions(options);
            filterInfo.setSchemaIncluded("schema1", false);
            filterInfo.migrateAllObjects = false; // Since we manually excluded a schema

            const result = filterInfo.getOptions();

            expect(result.filter).not.toBeNull();
            expect(result.filter!.schemas.exclude).toContain("`schema1`");
            expect(result.filter!.users.exclude).toEqual(["user1@%"]);
        });
    });
});

describe("SchemaFilterEditor", () => {
    let filterInfo: MigrationFilterInfo;
    let editor: SchemaFilterEditor;
    let onCloseMock: MockedFunction<any>;

    beforeEach(() => {
        vi.clearAllMocks();
        filterInfo = new MigrationFilterInfo(mockMigration);
        onCloseMock = vi.fn();
        editor = new SchemaFilterEditor({
            filterInfo,
            onClose: onCloseMock,
        });
        // Set up the mock ref manually
        (editor as any).editorRef.current = mockValueEditDialog;
    });

    describe("constructor", () => {
        it("should create a new SchemaFilterEditor instance", () => {
            expect(editor).toBeInstanceOf(SchemaFilterEditor);
            expect((editor as any).editorRef).toBeDefined();
        });
    });

    describe("render", () => {
        it("should render the component", () => {
            const { container } = render(editor.render());
            expect(container).toBeDefined();
        });
    });

    describe("show", () => {
        it("should fetch objects and show the dialog", async () => {
            const mockData: ISchemaTables = {
                schema: "test_schema",
                tables: ["table1", "table2"],
                views: []
            };

            (mockMigration.planGetDataItem as MockedFunction<any>).mockResolvedValue(mockData);

            await editor.show("tables", "test_schema");

            expect(mockMigration.planGetDataItem).toHaveBeenCalledWith(PlanDataItemType.SCHEMA_TABLES, "test_schema");
            expect(mockValueEditDialog.show).toHaveBeenCalled();
        });
    });

    describe("generateEditorConfig", () => {
        it("should generate config for objects with data", () => {
            const objects = ["table1", "table2"];

            const result = (editor as any).generateEditorConfig("tables", "test_schema", objects);

            expect(result.id).toBe("schemaFilterEditor");
            expect(result.sections.get("common")?.values.filteredObjects.checkList).toHaveLength(2);
        });

        it("should generate config for empty objects", () => {
            const objects: string[] = [];

            const result = (editor as any).generateEditorConfig("tables", "test_schema", objects);

            expect(result.sections.get("common")?.values.filteredObjects.checkList).toEqual([]);
            expect(result.sections.get("common")?.values.filteredObjects.description).
                toBe("There are no tables in this schema");
        });
    });

    describe("getSelectedObjects", () => {
        it("should return selected objects from dialog", () => {
            const mockDialogValues = {
                sections: new Map([
                    ["common", {
                        values: {
                            filteredObjects: {
                                checkList: [
                                    { data: { id: "table1", checkState: "checked" } },
                                    { data: { id: "table2", checkState: "unchecked" } },
                                ]
                            }
                        }
                    }]
                ])
            };

            mockValueEditDialog.getDialogValues.mockReturnValue(mockDialogValues);

            const result = (editor as any).getSelectedObjects();

            expect(result).toEqual(["table1"]);
        });
    });

    describe("handleOptionsDialogClose", () => {
        it("should call onClose with false when cancelled", () => {
            (editor as any).handleOptionsDialogClose(DialogResponseClosure.Cancel, {}, undefined);

            expect(onCloseMock).toHaveBeenCalledWith(false, "tables", "");
        });

        it("should call onClose with true when accepted", () => {
            (editor as any).handleOptionsDialogClose(DialogResponseClosure.Accept, {}, undefined);

            expect(onCloseMock).toHaveBeenCalledWith(true, "tables", "");
        });
    });
});
