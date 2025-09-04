/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

// cSpell: disable

import { createRef } from "preact";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { render } from "@testing-library/preact";
import {
    CellComponent, RowComponent, type EmptyCallback, type ValueBooleanCallback, type ValueVoidCallback
} from "tabulator-tables";
import { registerUiLayer } from "../../../../../app-logic/UILayer.js";
import {
    IMrsDbObjectData, IMrsObject, IMrsObjectFieldWithReference, type IMrsAuthAppData, type IMrsAuthVendorData,
    type IMrsContentFileData, type IMrsContentSetData, type IMrsDbObjectParameterData, type IMrsRoleData,
    type IMrsRouterData, type IMrsRouterService, type IMrsSchemaData, type IMrsServiceData, type IMrsStatusData,
    type IMrsTableColumnWithReference, type IMrsUserData
} from "../../../../../communication/ProtocolMrs.js";
import type { IComponentProperties } from "../../../../../components/ui/Component/ComponentBase.js";
import { MrsHub } from "../../../../../modules/mrs/MrsHub.js";
import {
    IMrsObjectFieldEditorData, IMrsObjectFieldTreeItem, MrsObjectFieldEditor, MrsObjectFieldTreeEntryType,
    type ActionIconName,
} from "../../../../../modules/mrs/dialogs/MrsObjectFieldEditor.js";
import { MrsDbObjectType, MrsObjectKind, MrsSdkLanguage } from "../../../../../modules/mrs/types.js";
import { ShellInterfaceMrs } from "../../../../../supplement/ShellInterface/ShellInterfaceMrs.js";
import { ShellInterfaceSqlEditor } from "../../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { CellComponentMock } from "../../../__mocks__/CellComponentMock.js";
import { RowComponentMock } from "../../../__mocks__/RowComponentMock.js";
import { uiLayerMock } from "../../../__mocks__/UILayerMock.js";
import {
    authAppsData, mrsContentFileData, mrsContentSetData, mrsDbObjectData, mrsRouterData, mrsSchemaData,
    mrsServiceData, mrsServicesData, mrsStatusMock, mrsUserData, routerServiceData
} from "../../../data-models/data-model-test-data.js";
import {
    mockClassMethods, nextRunLoop
} from "../../../test-helpers.js";

// @ts-expect-error, we need access to a private members here.
class TestMrsObjectFieldEditor extends MrsObjectFieldEditor {
    declare public treeGridJsonColumnFormatter: (cell: CellComponent) => string | HTMLElement;
    declare public treeGridRowFormatter: (row: RowComponent) => void;
    declare public treeGridRelationalColumnFormatter: (cell: CellComponent) => string | HTMLElement;
    declare public editorHost: (cell: CellComponent, onRendered: EmptyCallback, success: ValueBooleanCallback,
        cancel: ValueVoidCallback) => HTMLElement | false;
    declare public renderCustomEditor: (cell: CellComponent, onRendered: EmptyCallback, host: HTMLDivElement,
        value: unknown, success: ValueBooleanCallback, cancel: ValueVoidCallback) => void;
    declare public handleCellEdited: (cell: CellComponent) => void;
    declare public performTreeItemUnnestChange: (treeItem: IMrsObjectFieldTreeItem,
        setToUnnested: boolean) => Promise<void>;
    declare public performIconClick: (treeItem: IMrsObjectFieldTreeItem, iconGroup: ActionIconName,
        icon?: string) => Promise<void>;
    declare public handleIconClick: (cell: CellComponent, iconGroup: ActionIconName, icon?: string) => void;
    declare public treeGridToggleEnableState: (e: Event, cell: CellComponent) => void;
    declare public handleRowExpanded: (row: RowComponent) => void;
    declare public handleRowCollapsed: (row: RowComponent) => void;
    declare public isRowExpanded: (row: RowComponent) => boolean;
    declare public addNewField: (row: RowComponent | boolean) => void;
    declare public setCurrentMrsObject: (mrsObject: IMrsObject | undefined) => Promise<void>;
    declare public addMrsObject: (e: MouseEvent | KeyboardEvent, props: Readonly<IComponentProperties>) => void;
    declare public removeCurrentMrsObject: (e: MouseEvent | KeyboardEvent,
        props: Readonly<IComponentProperties>) => void;
    declare public getJsonDatatype: (dbDatatype: string) => string;
    declare public addColumnsAsFields: (dbObjectName: string, dbSchemaName: string,
        dbObjectType: string, storedFields: IMrsObjectFieldWithReference[],
        currentObject: IMrsObject, parentTreeItemList: IMrsObjectFieldTreeItem[],
        referredTreeItemsToLoad: IMrsObjectFieldTreeItem[],
        parentTreeItem?: IMrsObjectFieldTreeItem,
        initTreeItemsToUnnest?: IMrsObjectFieldTreeItem[],
        initTreeItemsToReduce?: IMrsObjectFieldTreeItem[]) => Promise<void>;
    declare public addParametersAsFields: (dbObjectName: string, dbSchemaName: string,
        dbObjectType: string, storedFields: IMrsObjectFieldWithReference[],
        currentObject: IMrsObject, parentTreeItemList: IMrsObjectFieldTreeItem[],
        referredTreeItemsToLoad: IMrsObjectFieldTreeItem[],
        parentTreeItem?: IMrsObjectFieldTreeItem) => Promise<void>;
    declare public initMrsObjects: () => Promise<void>;
    declare public updateDbObjectCrudOperations: () => void;
}

mockClassMethods(ShellInterfaceMrs, {
    status: (): Promise<IMrsStatusData> => {
        return Promise.resolve(mrsStatusMock);
    },
    listServices: (): Promise<IMrsServiceData[]> => {
        return Promise.resolve(mrsServicesData);
    },
    listSchemas: (): Promise<IMrsSchemaData[]> => {
        return Promise.resolve(mrsSchemaData);
    },
    listRouters: (): Promise<IMrsRouterData[]> => {
        return Promise.resolve(mrsRouterData);
    },
    listContentSets: (): Promise<IMrsContentSetData[]> => {
        return Promise.resolve(mrsContentSetData);
    },
    listUsers: (): Promise<IMrsUserData[]> => {
        return Promise.resolve(mrsUserData);
    },
    listContentFiles: (): Promise<IMrsContentFileData[]> => {
        return Promise.resolve(mrsContentFileData);
    },
    getService: (): Promise<IMrsServiceData> => {
        return Promise.resolve(mrsServiceData);
    },
    getSchema: (): Promise<IMrsSchemaData> => {
        return Promise.resolve(mrsSchemaData[0]);
    },
    getRouterServices: (): Promise<IMrsRouterService[]> => {
        return Promise.resolve(routerServiceData);
    },
    listAuthApps: (): Promise<IMrsAuthAppData[]> => {
        return Promise.resolve(authAppsData);
    },
    listAppServices: (_appId?: string): Promise<IMrsServiceData[]> => {
        return Promise.resolve([]);
    },
    listRoles: (): Promise<IMrsRoleData[]> => {
        return Promise.resolve([]);
    },
    listDbObjects: (schemaId: string): Promise<IMrsDbObjectData[]> => {
        return Promise.resolve(mrsDbObjectData);
    },
    updateAuthApp: (): Promise<void> => {
        return Promise.resolve();
    },
    getAuthVendors: (): Promise<IMrsAuthVendorData[]> => {
        return Promise.resolve([{
            id: "MRS",
            name: "MRS",
            enabled: true,
        }]);
    },
    getTableColumnsWithReferences: (requestPath?: string, dbObjectName?: string,
        dbObjectId?: string, schemaId?: string, schemaName?: string,
        dbObjectType?: string): Promise<IMrsTableColumnWithReference[]> => {
        return Promise.resolve([{
            position: 1,
            name: "actorId",
            refColumnNames: "actor_id",
            tableSchema: "myschema",
            tableName: "actor",
        }]);
    },
    getDbFunctionReturnType: (_dbObjectName: string, _dbSchemaName: string): Promise<string> => {
        return Promise.resolve("__RETURN_TYPE__");
    },
    getDbObjectParameters: (dbObjectName?: string, dbSchemaName?: string, dbObjectId?: string,
        dbType?: string): Promise<IMrsDbObjectParameterData[]> => {
        return Promise.resolve([]);
    }
});

describe("MRS Object field editor tests", () => {
    const backend = new ShellInterfaceSqlEditor();

    const hubRef = createRef<MrsHub>();
    let unmount: () => boolean;
    let container: HTMLDivElement;

    const createCellData = (): IMrsObjectFieldTreeItem => {
        return Object.assign({}, {
            type: MrsObjectFieldTreeEntryType.Field,
            expanded: true,
            expandedOnce: false,
            firstItem: true,
            lastItem: false,
            unnested: undefined,
            children: [{
                type: MrsObjectFieldTreeEntryType.Field,
                expanded: false,
                expandedOnce: false,
                field: {
                    id: "",
                    objectId: "",
                    representsReferenceId: "",
                    parentReferenceId: "",
                    name: "",
                    position: 0,
                    dbColumn: undefined,
                    enabled: true,
                    allowFiltering: true,
                    allowSorting: true,
                    noCheck: true,
                    noUpdate: true,
                    sdkOptions: {
                        languageOptions: [{
                            language: MrsSdkLanguage.TypeScript,
                        }],
                    },
                    comments: "",
                    objectReference: undefined,
                    lev: 0,
                    caption: "",
                    storedDbColumn: undefined,
                },
            }],
            field: {
                id: "new_field",
                objectId: "",
                representsReferenceId: "",
                parentReferenceId: "",
                name: "specificFieldName",
                position: 0,
                dbColumn: undefined,
                enabled: true,
                allowFiltering: true,
                allowSorting: true,
                noCheck: true,
                noUpdate: true,
                sdkOptions: {
                    languageOptions: [{
                        language: MrsSdkLanguage.TypeScript,
                    }],
                },
                comments: "",
                objectReference: {
                    id: "",
                    unnest: false,
                    crudOperations: "",
                    referenceMapping: {
                        constraint: "",
                        referencedSchema: "",
                        referencedTable: "",
                        columnMapping: [{
                            base: "one",
                            ref: "ref_one",
                        }, {
                            base: "two",
                            ref: "ref_two",
                        }],
                        toMany: true,
                        kind: "1:n",
                    },
                    options: {
                        dataMappingViewInsert: true,
                        dataMappingViewUpdate: true,
                        dataMappingViewDelete: true,
                        dataMappingViewNoCheck: true,
                    },
                },
                lev: 0,
                caption: "",
                storedDbColumn: {
                    name: "column name",
                    datatype: "",
                    notNull: false,
                    isPrimary: false,
                    isUnique: false,
                    isGenerated: false,
                },
            },
        });
    };

    const createRowData = () => {
        return Object.assign({}, {
            type: 1,
            expanded: false,
            expandedOnce: false,
            field: {
                id: "WpEezaKITIHsIVbnhP7kKA==",
                objectId: "EbIyADFqTITr774mzWjfng==",
                name: "actor",
                position: 0,
                enabled: false,
                allowFiltering: false,
                allowSorting: false,
                noCheck: false,
                noUpdate: false,
                objectReference: {
                    id: "",
                    referenceMapping: {
                        kind: "1:1",
                        constraint: "",
                        toMany: false,
                        referencedSchema: "",
                        referencedTable: "",
                        columnMapping: [],
                    },
                    unnest: false,
                    crudOperations: "",
                    sdkOptions: {
                        languageOptions: [{
                            language: MrsSdkLanguage.TypeScript,
                        }],
                    },
                    comments: "",
                },
            },
            firstItem: true,
            lastItem: true,
        });
    };

    const createFieldEditorMountValuesEmptyData = (): IMrsObjectFieldEditorData => {
        return {
            servicePath: "",
            dbSchemaName: "mySchema",
            dbSchemaPath: "",
            dbObject: {} as IMrsDbObjectData,
            crudOperations: [],
            createDbObject: false,
            defaultMrsObjectName: "",
            mrsObjects: [],
            showSdkOptions: MrsSdkLanguage.TypeScript,
            currentMrsObjectId: "",
            currentTreeItems: [],
        };
    };

    const createFieldEditorMountValuesData = (): IMrsObjectFieldEditorData => {
        return Object.assign({}, {
            servicePath: "",
            dbSchemaName: "",
            dbSchemaPath: "",
            dbObject: {
                comments: "",
                crudOperations: ["READ", "UPDATE", "CREATE", "DELETE"],
                crudOperationFormat: "",
                changedAt: "",
                dbSchemaId: "",
                enabled: 0,
                hostCtx: "",
                id: "",
                itemsPerPage: 30,
                name: "",
                objectType: MrsDbObjectType.View,
                requestPath: "",
                requiresAuth: 0,
                rowUserOwnershipColumn: "",
                rowUserOwnershipEnforced: 0,
                schemaRequestPath: "",
                schemaName: "",
                qualifiedName: "",
                serviceId: "",
                mediaType: "",
                autoDetectMediaType: 0,
                authStoredProcedure: "",
                options: {}, //IShellDictionary
                objects: [], //IMrsObject[]
                metadata: {
                    field1: "data1",
                    field2: "data2",
                },
            },
            crudOperations: ["READ", "UPDATE", "CREATE", "DELETE"],
            createDbObject: false,
            defaultMrsObjectName: "",
            mrsObjects: [
                {
                    id: "mrs_object_id_0",
                    dbObjectId: "",
                    name: "",
                    position: 0,
                    kind: MrsObjectKind.Result,
                    sdkOptions: undefined, //IMrsObjectSdkOptions
                    comments: "",
                    options: {
                        dataMappingViewInsert: true,
                        dataMappingViewUpdate: true,
                        dataMappingViewDelete: true,
                        dataMappingViewNoCheck: true,
                    },
                    fields: [{
                        id: "",
                        objectId: "",
                        parentReferenceId: "",
                        name: "Field",
                        position: 0,
                        enabled: true,
                        allowFiltering: true,
                        allowSorting: true,
                        noCheck: true,
                        noUpdate: false,
                    }],//IMrsObjectFieldWithReference[]
                    storedFields: [], //IMrsObjectFieldWithReference[]
                }, {
                    id: "mrs_object_id_1",
                    dbObjectId: "",
                    name: "param1",
                    position: 0,
                    kind: MrsObjectKind.Parameters,
                    sdkOptions: undefined, //IMrsObjectSdkOptions
                    comments: "",
                    options: {
                        dataMappingViewInsert: true,
                        dataMappingViewUpdate: true,
                        dataMappingViewDelete: true,
                        dataMappingViewNoCheck: true,
                    },
                    fields: [{
                        id: "field_1",
                        objectId: "",
                        name: "field_1 name",
                        position: 0,
                        dbColumn: {
                            name: "",
                            datatype: "",
                            notNull: true,
                            isPrimary: true,
                            isUnique: true,
                            isGenerated: true,
                            idGeneration: "",
                            comment: "",
                            in: true,
                            out: true,
                        }, //IMrsTableColumn,
                        enabled: true,
                        allowFiltering: true,
                        allowSorting: true,
                        noCheck: true,
                        noUpdate: false,
                    }, {
                        id: "field_2",
                        objectId: "",
                        representsReferenceId: "field_1",
                        // parentReferenceId: "field_1",
                        name: "field_2 name",
                        position: 0,
                        dbColumn: {
                            name: "column_1",
                            datatype: "int",
                            notNull: true,
                            isPrimary: true,
                            isUnique: true,
                            isGenerated: true,
                            idGeneration: "",
                            comment: "",
                            in: true,
                            out: true,
                        }, //IMrsTableColumn
                        enabled: true,
                        allowFiltering: true,
                        allowSorting: true,
                        noCheck: true,
                        noUpdate: false,
                        objectReference: {
                            id: "",
                            reduceToValueOfFieldId: "field_1",
                            referenceMapping: {
                                kind: "",
                                constraint: "",
                                toMany: true,
                                referencedSchema: "",
                                referencedTable: "",
                                columnMapping: [], //IMrsColumnMapping[]
                            }, // IMrsTableReference,
                            unnest: true,
                            crudOperations: ["READ", "UPDATE", "CREATE", "DELETE"],
                        }, //IMrsObjectReference,
                    }],//IMrsObjectFieldWithReference[]
                    storedFields: [], //IMrsObjectFieldWithReference[]
                },
            ], //  IMrsObject[]
            showSdkOptions: MrsSdkLanguage.TypeScript,
            currentMrsObjectId: "mrs_object_id_1",
            currentTreeItems: [{
                type: MrsObjectFieldTreeEntryType.Field,
                expanded: false,     // Currently expanded?
                expandedOnce: false, // Was expanded before?
                firstItem: false,
                lastItem: false,

                field: {
                    id: "new_field",
                    objectId: "",
                    name: "specificFieldName",
                    position: 0,
                    dbColumn: {
                        name: "new_field",
                        datatype: "number",
                        notNull: true,
                        isPrimary: true,
                        isUnique: true,
                        isGenerated: false,
                        idGeneration: undefined,
                        comment: "new field comment",
                        in: true,
                        out: true,
                    },
                    enabled: false,
                    allowFiltering: false,
                    allowSorting: false,
                    noCheck: false,
                    noUpdate: false,
                },

                children: [{
                    type: MrsObjectFieldTreeEntryType.Field,
                    expanded: true,
                    expandedOnce: true,
                    field: {
                        id: "",
                        objectId: "",
                        name: "",
                        position: 1,
                        enabled: true,
                        allowFiltering: true,
                        allowSorting: true,
                        noCheck: true,
                        noUpdate: true,
                    },
                }],
            }], // IMrsObjectFieldTreeItem[]
        }) as IMrsObjectFieldEditorData;  // IMrsObjectFieldEditorData
    };

    const createDbObjectData = () => {
        return Object.assign({}, {
            changedAt: "",
            comments: "",
            crudOperations: [],
            crudOperationFormat: "",
            dbSchemaId: "",
            enabled: 0,
            hostCtx: "",
            id: "",
            itemsPerPage: 0,
            name: "",
            objectType: MrsDbObjectType.Table,
            requestPath: "/somePath",
            requiresAuth: 0,
            rowUserOwnershipColumn: "",
            rowUserOwnershipEnforced: 0,
            schemaRequestPath: "/somePath",
            schemaName: "",
            qualifiedName: "",
            serviceId: "",
            mediaType: "",
            autoDetectMediaType: 0,
            authStoredProcedure: "",
            options: undefined,
            objects: [],
        });
    };

    const doMount = async (values?: IDictionary, dbObjectChangeHandler?: () => void,
        getCurrentDbObjectHandler?: () => IMrsDbObjectData) => {

        dbObjectChangeHandler ??= (): void => { /**/ };
        getCurrentDbObjectHandler ??= (): IMrsDbObjectData => {
            return createDbObjectData();
        };

        values ??= createFieldEditorMountValuesData();
        const editorRef = createRef<TestMrsObjectFieldEditor>();
        const { unmount } = render(<TestMrsObjectFieldEditor
            ref={editorRef}
            backend={backend}
            dbObjectChange={dbObjectChangeHandler}
            getCurrentDbObject={getCurrentDbObjectHandler}
            values={values} />);

        // This is required because initMrsObjects is async and is called in the ctor
        // and the ctor can not be async.
        await nextRunLoop();

        return { unmount, editorRef, values };
    };

    beforeAll(() => {
        registerUiLayer(uiLayerMock);

        const result = render(<MrsHub ref={hubRef} />);
        container = result.container as HTMLDivElement;
        unmount = result.unmount;
    });

    afterAll(() => {
        unmount();

        vi.resetAllMocks();
    });

    it("Standard Rendering (snapshot)", () => {
        // The host itself has no properties, but implicit children (the different dialogs).
        expect(container).toMatchSnapshot();
    });

    it("MrsObjectFieldEditor updateMrsObjectFields tests", async () => {
        const mountResult = await doMount();

        const data = mountResult.editorRef.current!.props.values as IMrsObjectFieldEditorData;
        expect(data.mrsObjects.length).toBe(2);

        const fieldEditorData = createFieldEditorMountValuesData();

        MrsObjectFieldEditor.updateMrsObjectFields(fieldEditorData);
    });

    it("MrsObjectFieldEditor tests basic", async () => {
        // const backend = await createBackend();

        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        const handleDbObjectChange = () => { /**/ };
        const handleGetCurrentDbObject = (): IMrsDbObjectData => {
            return createDbObjectData();
        };

        const badMount = () => {
            render(<TestMrsObjectFieldEditor
                backend={backend}
                dbObjectChange={handleDbObjectChange}
                getCurrentDbObject={handleGetCurrentDbObject}
                values={undefined}
            />);
        };

        expect(badMount)
            .toThrow("The value of the MrsRestObjectFieldEditor custom control needs to be initialized.");

        const mountResult = await doMount();

        mountResult.unmount();

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
    });

    it("MrsObjectFieldEditor init tests", async () => {
        const mountResult = await doMount();

        const data = mountResult.editorRef.current!.props.values as IMrsObjectFieldEditorData;

        expect(data.mrsObjects.length).toBe(2);

        // TODO: make other tests on the 'data' object. Check 'initMrsObjects'.
    });

    it("MrsObjectFieldEditor.treeGridJsonColumnFormatter tests", async () => {
        const mountResult = await doMount();

        const fieldEditor = mountResult.editorRef.current!;
        let host: string | HTMLElement;

        host = fieldEditor.treeGridJsonColumnFormatter(new CellComponentMock() as CellComponent);

        expect(host).toBeInstanceOf(HTMLElement);

        const cellData = createCellData();
        cellData.type = MrsObjectFieldTreeEntryType.DeletedField;

        host = fieldEditor.treeGridJsonColumnFormatter(new CellComponentMock(cellData) as CellComponent);

        expect(host).toBeInstanceOf(HTMLElement);

        cellData.type = MrsObjectFieldTreeEntryType.FieldListClose;

        host = fieldEditor.treeGridJsonColumnFormatter(new CellComponentMock(cellData) as CellComponent);

        expect(host).toBeInstanceOf(HTMLElement);

        cellData.type = MrsObjectFieldTreeEntryType.FieldListOpen;

        host = fieldEditor.treeGridJsonColumnFormatter(new CellComponentMock(cellData) as CellComponent);

        expect(host).toBeInstanceOf(HTMLElement);

        cellData.type = MrsObjectFieldTreeEntryType.LoadPlaceholder;

        host = fieldEditor.treeGridJsonColumnFormatter(new CellComponentMock(cellData) as CellComponent);

        const cell = new CellComponentMock(cellData);
        cell.parent = new RowComponentMock(createRowData());
        cell.parent.prevRow = new RowComponentMock(createRowData());

        host = fieldEditor.treeGridJsonColumnFormatter(cell as CellComponent);

        expect(host).toBeInstanceOf(HTMLElement);

    });

    it("MrsObjectFieldEditor.treeGridRowFormatter tests", async () => {
        const mountResult = await doMount();
        const fieldEditor = mountResult.editorRef.current!;

        const rowData = createRowData();
        let row = new RowComponentMock(rowData);

        fieldEditor.treeGridRowFormatter(row);
        expect(row.getElement().classList.contains("fk11")).toBe(true);
        expect(row.getElement().classList.contains("fkN1")).toBe(false);
        expect(row.getElement().classList.contains("fk1N")).toBe(false);
        expect(row.getElement().classList.contains("referenceRow")).toBe(true);
        expect(row.getElement().classList.contains("deleted")).toBe(false);

        rowData.field.objectReference.referenceMapping.kind = "n:1";
        row = new RowComponentMock(rowData);

        fieldEditor.treeGridRowFormatter(row);
        expect(row.getElement().classList.contains("fkN1")).toBe(true);

        rowData.field.objectReference.referenceMapping.kind = "1:n";
        row = new RowComponentMock(rowData);

        fieldEditor.treeGridRowFormatter(row);
        expect(row.getElement().classList.contains("fk1N")).toBe(true);

        rowData.expanded = true;
        row = new RowComponentMock(rowData);

        fieldEditor.treeGridRowFormatter(row);
        expect(row.getElement().classList.contains("expanded")).toBe(true);

        rowData.expanded = false;
        row = new RowComponentMock(rowData);

        fieldEditor.treeGridRowFormatter(row);
        expect(row.getElement().classList.contains("expanded")).toBe(false);

        rowData.firstItem = true;
        row = new RowComponentMock(rowData);

        fieldEditor.treeGridRowFormatter(row);
        expect(row.getElement().classList.contains("firstItem")).toBe(true);

        rowData.firstItem = false;
        row = new RowComponentMock(rowData);

        fieldEditor.treeGridRowFormatter(row);
        expect(row.getElement().classList.contains("firstItem")).toBe(false);

        rowData.lastItem = true;
        row = new RowComponentMock(rowData);

        fieldEditor.treeGridRowFormatter(row);
        expect(row.getElement().classList.contains("lastItem")).toBe(true);

        rowData.lastItem = false;
        row = new RowComponentMock(rowData);

        fieldEditor.treeGridRowFormatter(row);
        expect(row.getElement().classList.contains("lastItem")).toBe(false);

        rowData.type = MrsObjectFieldTreeEntryType.DeletedField;
        row = new RowComponentMock(rowData);

        fieldEditor.treeGridRowFormatter(row);
        expect(row.getElement().classList.contains("deleted")).toBe(true);
    });

    it("MrsObjectFieldEditor.getJsonDatatype tests", async () => {
        const mountResult = await doMount(createFieldEditorMountValuesEmptyData());
        const fieldEditor = mountResult.editorRef.current!;

        document.createElement("div");

        expect(fieldEditor.getJsonDatatype("tinyint(1) ")).toBe("boolean");
        expect(fieldEditor.getJsonDatatype("bit(1) ")).toBe("boolean");
        expect(fieldEditor.getJsonDatatype("tinyint ")).toBe("number");
        expect(fieldEditor.getJsonDatatype("smallint ")).toBe("number");
        expect(fieldEditor.getJsonDatatype("mediumint ")).toBe("number");
        expect(fieldEditor.getJsonDatatype("int ")).toBe("number");
        expect(fieldEditor.getJsonDatatype("bigint ")).toBe("number");
        expect(fieldEditor.getJsonDatatype("decimal ")).toBe("number");
        expect(fieldEditor.getJsonDatatype("numeric ")).toBe("number");
        expect(fieldEditor.getJsonDatatype("float ")).toBe("number");
        expect(fieldEditor.getJsonDatatype("double ")).toBe("number");
        expect(fieldEditor.getJsonDatatype("json ")).toBe("unknown");
        expect(fieldEditor.getJsonDatatype("geometry ")).toBe("object");
        expect(fieldEditor.getJsonDatatype("aaaaa")).toBe("string");
    });

    it("MrsObjectFieldEditor.initMrsObjects tests", async () => {
        const mountResult = await doMount(createFieldEditorMountValuesEmptyData());
        const fieldEditor = mountResult.editorRef.current!;

        vi.spyOn(ShellInterfaceMrs.prototype, "getDbFunctionReturnType").mockImplementation(
            async (dbObjectName: string, dbSchemaName: string): Promise<string> => {
                expect(dbObjectName).toBe("myFunc");
                expect(dbSchemaName).toBe("mySchema");

                return Promise.resolve("void");
            });

        (mountResult.values.dbObject as IMrsDbObjectData).id = "";
        (mountResult.values.dbObject as IMrsDbObjectData).objectType = MrsDbObjectType.Function;
        (mountResult.values.dbObject as IMrsDbObjectData).name = "myFunc";
        (mountResult.values.dbObject as IMrsDbObjectData).dbSchemaName = "mySchema";

        await fieldEditor.initMrsObjects(); // TODO: make this a real test.
    });
});
