/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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
// cSpell: disable

import { createRef } from "preact";

import { mount } from "enzyme";
import { CellComponent, RowComponent } from "tabulator-tables";
import {
    IMrsDbObjectData, IMrsDbObjectParameterData, IMrsObject, IMrsObjectFieldWithReference, IMrsObjectReference,
    IMrsTableColumnWithReference,
} from "../../../../../communication/ProtocolMrs.js";
import { MrsHub } from "../../../../../modules/mrs/MrsHub.js";
import {
    IMrsObjectFieldEditorData, IMrsObjectFieldTreeItem, MrsObjectFieldEditor, MrsObjectFieldTreeEntryType,
} from "../../../../../modules/mrs/dialogs/MrsObjectFieldEditor.js";
import { MrsDbObjectType, MrsObjectKind, MrsSdkLanguage } from "../../../../../modules/mrs/types.js";
import { ShellInterfaceSqlEditor } from "../../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { MySQLShellLauncher } from "../../../../../utilities/MySQLShellLauncher.js";
import { CellComponentMock } from "../../../__mocks__/CellComponentMock.js";
import { RowComponentMock } from "../../../__mocks__/RowComponentMock.js";
import {
    JestReactWrapper, createBackend, nextRunLoop, recreateMrsData, setupShellForTests,
} from "../../../test-helpers.js";


describe("MRS Object field editor tests", () => {
    let host: JestReactWrapper;

    let launcher: MySQLShellLauncher;
    let backend: ShellInterfaceSqlEditor;

    const hubRef = createRef<MrsHub>();

    const createTreeItemData = (): IMrsObjectFieldTreeItem => {
        return Object.assign({}, {
            type: MrsObjectFieldTreeEntryType.Field,
            expanded: false,     // Currently expanded?
            expandedOnce: true, // Was expanded before?
            firstItem: false,
            lastItem: false,

            unnested: {
                schemaTable: "",
                referenceFieldName: "",
                originalFieldName: "",
            },

            field: {
                id: "field_1",
                objectId: "field_1",
                representsReferenceId: "",
                parentReferenceId: "",
                name: "",
                position: 0,
                dbColumn: {
                    name: "",
                    datatype: "",
                    notNull: false,
                    isPrimary: false,
                    isUnique: false,
                    isGenerated: false,
                    idGeneration: "",
                    comment: "",
                    in: false,
                    out: false,
                },
                enabled: false,
                allowFiltering: false,
                allowSorting: false,
                noCheck: false,
                noUpdate: false,
                sdkOptions: {
                    datatypeName: "",
                    languageOptions: [{ language: "", fieldName: "" }],
                },
                comments: "",
                objectReference: {
                    id: "field_1",
                    reduceToValueOfFieldId: "",
                    referenceMapping: {
                        kind: "n:1",
                        constraint: "",
                        toMany: false,
                        referencedSchema: "",
                        referencedTable: "",
                        columnMapping: [],  //IMrsColumnMapping[]
                    },
                    unnest: false,
                    crudOperations: "",
                    sdkOptions: {
                        datatypeName: "",
                        languageOptions: [{ language: "", fieldName: "" }],
                    },
                    comments: "",
                    options: {
                        dualityViewInsert: true,
                        dualityViewUpdate: true,
                        dualityViewDelete: true,
                        dualityViewNoCheck: true,
                    },
                },
                lev: 0,
                caption: "",
                storedDbColumn: {
                    name: "",
                    datatype: "",
                    notNull: false,
                    isPrimary: false,
                    isUnique: false,
                    isGenerated: false,
                    idGeneration: "",
                    comment: "",
                    in: false,
                    out: false,
                },
            },
            comments: "",
            objectReference: {
                id: "",
                reduceToValueOfFieldId: "",
                referenceMapping: {
                    kind: "",
                    constraint: "",
                    toMany: false,
                    referencedSchema: "",
                    referencedTable: "",
                    columnMapping: [], //IMrsColumnMapping[]
                },
                unnest: false,
                crudOperations: "",
                sdkOptions: {
                    datatypeName: "",
                    languageOptions: [{ language: "", fieldName: "" }],
                },
                comments: "",
            },
            lev: 0,
            caption: "",
            storedDbColumn: {
                name: "",
                datatype: "",
                notNull: false,
                isPrimary: false,
                isUnique: false,
                isGenerated: false,
                idGeneration: "",
                comment: "",
                in: false,
                out: false,
            },
            parent: undefined, //IMrsObjectFieldTreeItem
            children: [
                {
                    type: MrsObjectFieldTreeEntryType.LoadPlaceholder,
                    expanded: false,     // Currently expanded?
                    expandedOnce: false, // Was expanded before?
                    firstItem: false,
                    lastItem: false,

                    unnested: {
                        schemaTable: "",
                        referenceFieldName: "",
                        originalFieldName: "",
                    }, // Set if this field is an unnested copy

                    field: {
                        id: "",
                        objectId: "",
                        representsReferenceId: "",
                        parentReferenceId: "",
                        name: "",
                        position: 0,
                        dbColumn: {
                            name: "",
                            datatype: "",
                            notNull: false,
                            isPrimary: false,
                            isUnique: false,
                            isGenerated: false,
                            idGeneration: "",
                            comment: "",
                            in: false,
                            out: false,
                        },
                        enabled: false,
                        allowFiltering: false,
                        allowSorting: false,
                        noCheck: false,
                        noUpdate: false,
                        sdkOptions: {
                            datatypeName: "",
                            languageOptions: [{ language: "", fieldName: "" }],
                        },
                        comments: "",
                        objectReference: {
                            id: "",
                            reduceToValueOfFieldId: "",
                            referenceMapping: {
                                kind: "",
                                constraint: "",
                                toMany: false,
                                referencedSchema: "",
                                referencedTable: "",
                                columnMapping: [],//IMrsColumnMapping[]
                            }, //IMrsTableReference
                            unnest: false,
                            crudOperations: "",
                            sdkOptions: {
                                datatypeName: "",
                                languageOptions: [{ language: "", fieldName: "" }],
                            },
                            comments: "",
                        },
                        lev: 0,
                        caption: "",
                        storedDbColumn: {
                            name: "",
                            datatype: "",
                            notNull: false,
                            isPrimary: false,
                            isUnique: false,
                            isGenerated: false,
                            idGeneration: "",
                            comment: "",
                            in: false,
                            out: false,
                        },
                    },

                    parent: undefined, //IMrsObjectFieldTreeItem
                    children: [], // IMrsObjectFieldTreeItem[]
                }, {
                    type: MrsObjectFieldTreeEntryType.Field,
                    expanded: false,     // Currently expanded?
                    expandedOnce: false, // Was expanded before?
                    firstItem: false,
                    lastItem: false,

                    unnested: {
                        schemaTable: "",
                        referenceFieldName: "",
                        originalFieldName: "",
                    }, // Set if this field is an unnested copy

                    field: {
                        id: "",
                        objectId: "",
                        representsReferenceId: "",
                        parentReferenceId: "",
                        name: "",
                        position: 0,
                        dbColumn: {
                            name: "",
                            datatype: "",
                            notNull: false,
                            isPrimary: false,
                            isUnique: false,
                            isGenerated: false,
                            idGeneration: "",
                            comment: "",
                            in: false,
                            out: false,
                        },
                        enabled: false,
                        allowFiltering: false,
                        allowSorting: false,
                        noCheck: false,
                        noUpdate: false,
                        sdkOptions: {
                            datatypeName: "",
                            languageOptions: [{ language: "", fieldName: "" }],
                        },
                        comments: "",
                        objectReference: {
                            id: "",
                            reduceToValueOfFieldId: "",
                            referenceMapping: {
                                kind: "",
                                constraint: "",
                                toMany: false,
                                referencedSchema: "",
                                referencedTable: "",
                                columnMapping: [],//IMrsColumnMapping[]
                            }, //IMrsTableReference
                            unnest: false,
                            crudOperations: "",
                            sdkOptions: {
                                datatypeName: "",
                                languageOptions: [{ language: "", fieldName: "" }],
                            },
                            comments: "",
                        },
                        lev: 0,
                        caption: "",
                        storedDbColumn: {
                            name: "",
                            datatype: "",
                            notNull: false,
                            isPrimary: false,
                            isUnique: false,
                            isGenerated: false,
                            idGeneration: "",
                            comment: "",
                            in: false,
                            out: false,
                        },
                    },

                    parent: undefined, //IMrsObjectFieldTreeItem
                    children: [], // IMrsObjectFieldTreeItem[]
                },
            ], //IMrsObjectFieldTreeItem[]
        });
    };

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
                        dualityViewInsert: true,
                        dualityViewUpdate: true,
                        dualityViewDelete: true,
                        dualityViewNoCheck: true,
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
            dbSchemaName: "",
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
                        dualityViewInsert: true,
                        dualityViewUpdate: true,
                        dualityViewDelete: true,
                        dualityViewNoCheck: true,
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
                        dualityViewInsert: true,
                        dualityViewUpdate: true,
                        dualityViewDelete: true,
                        dualityViewNoCheck: true,
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

    const createStoredFields = (): IMrsObjectFieldWithReference[] => {
        return [{
            id: "",
            objectId: "",
            name: "field_1",
            position: 0,
            dbColumn: {
                name: "param_1",
                datatype: "",
                notNull: true,
                isPrimary: true,
                isUnique: true,
                isGenerated: true,
            }, //IMrsTableColumn,
            enabled: true,
            allowFiltering: true,
            allowSorting: true,
            noCheck: true,
            noUpdate: true,
            sdkOptions: {}, //IMrsObjectFieldSdkOptions,
            comments: "some comments",
            objectReference: {
                id: "",
                unnest: true,
                referenceMapping: {
                    kind: "",
                    constraint: "",
                    toMany: false,
                    referencedSchema: "some_schema",
                    referencedTable: "",
                    columnMapping: [{
                        base: "",
                        ref: "",
                    }], //IMrsTableReference,
                }, //IMrsObjectReference,
            },
        }];
    };

    const doMount = async (values?: IDictionary,
        dbObjectChangeHandler?: () => void, getCurrentDbObjectHandler?: () => IMrsDbObjectData,
        backend?: ShellInterfaceSqlEditor) => {

        if (!dbObjectChangeHandler) { dbObjectChangeHandler = (): void => { }; }
        if (!getCurrentDbObjectHandler) {
            getCurrentDbObjectHandler = (): IMrsDbObjectData => {
                return createDbObjectData();
            };
        }
        if (values === undefined) {
            values = createFieldEditorMountValuesData();
        }
        if (!backend) {
            backend = await createBackend();
        }

        const fieldEditorMount = mount<MrsObjectFieldEditor>(<MrsObjectFieldEditor
            backend={backend}
            dbObjectChange={dbObjectChangeHandler}
            getCurrentDbObject={getCurrentDbObjectHandler}
            values={values} />);
        const fieldEditor: MrsObjectFieldEditor = fieldEditorMount.instance();

        //  This is required because initMrsObjects is async and is called in the ctor
        //  and the ctor can not be async.
        await nextRunLoop();

        return { fieldEditorMount, fieldEditor, values, backend };
    };


    beforeAll(async () => {
        launcher = await setupShellForTests(false, true, "DEBUG2");

        await recreateMrsData();

        host = mount<MrsHub>(<MrsHub ref={hubRef} />);
    });

    afterAll(async () => {
        await backend.execute("DROP DATABASE IF EXISTS mysql_rest_service_metadata");
        await backend.execute("DROP DATABASE IF EXISTS MRS_TEST");
        await backend.closeSession();
        await launcher.exitProcess();
        host.unmount();
    });

    beforeEach(async () => {
        backend = await createBackend();
    });

    it("Standard Rendering (snapshot)", () => {
        // The host itself has no properties, but implicit children (the different dialogs).
        expect(host.props().children).toEqual([]);
        expect(host).toMatchSnapshot();
    });

    it("MrsObjectFieldEditor updateMrsObjectFields tests", async () => {
        const mountResult = await doMount();

        mountResult.backend.mrs.getDbFunctionReturnType =
            async (_dbObjectName: string, _dbSchemaName: string): Promise<string> => {
                return Promise.resolve("__RETURN_TYPE__");
            };

        const data = mountResult.fieldEditor.props.values as IMrsObjectFieldEditorData;

        expect(data.mrsObjects.length).toBe(2);

        const fieldEditorData = createFieldEditorMountValuesData();

        MrsObjectFieldEditor.updateMrsObjectFields(fieldEditorData);
    });

    it("MrsObjectFieldEditor tests basic", async () => {
        // const backend = await createBackend();

        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        const handleDbObjectChange = () => { };
        const handleGetCurrentDbObject = (): IMrsDbObjectData => {
            return createDbObjectData();
        };
        const badMount = () => {
            mount<MrsObjectFieldEditor>(<MrsObjectFieldEditor
                backend={backend}
                dbObjectChange={handleDbObjectChange}
                getCurrentDbObject={handleGetCurrentDbObject}
                values={undefined}
            />);
        };

        expect(badMount)
            .toThrow("The value of the MrsRestObjectFieldEditor custom control needs to be initialized.");

        const mountResult = await doMount();

        mountResult.fieldEditorMount.unmount();

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
    });

    it("MrsObjectFieldEditor init tests", async () => {
        backend.mrs.getDbFunctionReturnType =
            async (_dbObjectName: string, _dbSchemaName: string): Promise<string> => {
                return Promise.resolve("__RETURN_TYPE__");
            };

        const mountResult = await doMount();

        const data = mountResult.fieldEditor.props.values as IMrsObjectFieldEditorData;

        expect(data.mrsObjects.length).toBe(2);

        // TODO: make other tests on the 'data' object. Check 'initMrsObjects'.
    });

    it("MrsObjectFieldEditor.treeGridJsonColumnFormatter tests", async () => {
        const mountResult = await doMount();

        const fieldEditor = mountResult.fieldEditor; //MrsObjectFieldEditor = fieldEditorMount.instance();
        let host: string | HTMLElement;

        host = fieldEditor["treeGridJsonColumnFormatter"](new CellComponentMock() as CellComponent);

        expect(host).toBeInstanceOf(HTMLElement);
        // TODO: make more tests in host

        const cellData = createCellData();
        cellData.type = MrsObjectFieldTreeEntryType.DeletedField;

        host = fieldEditor["treeGridJsonColumnFormatter"](new CellComponentMock(cellData) as CellComponent);

        expect(host).toBeInstanceOf(HTMLElement);
        // TODO: make more tests in host

        cellData.type = MrsObjectFieldTreeEntryType.FieldListClose;

        host = fieldEditor["treeGridJsonColumnFormatter"](new CellComponentMock(cellData) as CellComponent);

        expect(host).toBeInstanceOf(HTMLElement);
        // TODO: make more tests in host

        cellData.type = MrsObjectFieldTreeEntryType.FieldListOpen;

        host = fieldEditor["treeGridJsonColumnFormatter"](new CellComponentMock(cellData) as CellComponent);

        expect(host).toBeInstanceOf(HTMLElement);
        // TODO: make more tests in host

        cellData.type = MrsObjectFieldTreeEntryType.LoadPlaceholder;

        host = fieldEditor["treeGridJsonColumnFormatter"](new CellComponentMock(cellData) as CellComponent);

        const cell = new CellComponentMock(cellData);
        cell.parent = new RowComponentMock(createRowData());
        cell.parent.prevRow = new RowComponentMock(createRowData());

        host = fieldEditor["treeGridJsonColumnFormatter"](cell as CellComponent);

        expect(host).toBeInstanceOf(HTMLElement);
        // TODO: make more tests in host
    });

    it("MrsObjectFieldEditor.treeGridRowFormatter tests", async () => {
        const mountResult = await doMount();
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        const rowData = createRowData();
        let row = new RowComponentMock(rowData);

        fieldEditor["treeGridRowFormatter"](row);
        expect(row.getElement().classList.contains("fk11")).toBe(true);
        expect(row.getElement().classList.contains("fkN1")).toBe(false);
        expect(row.getElement().classList.contains("fk1N")).toBe(false);
        expect(row.getElement().classList.contains("referenceRow")).toBe(true);
        expect(row.getElement().classList.contains("deleted")).toBe(false);


        rowData.field.objectReference.referenceMapping.kind = "n:1";
        row = new RowComponentMock(rowData);

        fieldEditor["treeGridRowFormatter"](row);
        expect(row.getElement().classList.contains("fkN1")).toBe(true);

        rowData.field.objectReference.referenceMapping.kind = "1:n";
        row = new RowComponentMock(rowData);

        fieldEditor["treeGridRowFormatter"](row);
        expect(row.getElement().classList.contains("fk1N")).toBe(true);

        rowData.expanded = true;
        row = new RowComponentMock(rowData);

        fieldEditor["treeGridRowFormatter"](row);
        expect(row.getElement().classList.contains("expanded")).toBe(true);

        rowData.expanded = false;
        row = new RowComponentMock(rowData);

        fieldEditor["treeGridRowFormatter"](row);
        expect(row.getElement().classList.contains("expanded")).toBe(false);

        rowData.firstItem = true;
        row = new RowComponentMock(rowData);

        fieldEditor["treeGridRowFormatter"](row);
        expect(row.getElement().classList.contains("firstItem")).toBe(true);

        rowData.firstItem = false;
        row = new RowComponentMock(rowData);

        fieldEditor["treeGridRowFormatter"](row);
        expect(row.getElement().classList.contains("firstItem")).toBe(false);

        rowData.lastItem = true;
        row = new RowComponentMock(rowData);

        fieldEditor["treeGridRowFormatter"](row);
        expect(row.getElement().classList.contains("lastItem")).toBe(true);

        rowData.lastItem = false;
        row = new RowComponentMock(rowData);

        fieldEditor["treeGridRowFormatter"](row);
        expect(row.getElement().classList.contains("lastItem")).toBe(false);

        rowData.type = MrsObjectFieldTreeEntryType.DeletedField;
        row = new RowComponentMock(rowData);

        fieldEditor["treeGridRowFormatter"](row);
        expect(row.getElement().classList.contains("deleted")).toBe(true);
    });

    it("MrsObjectFieldEditor.treeGridRelationalColumnFormatter tests", async () => {
        const mountResult = await doMount(createFieldEditorMountValuesEmptyData());
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        const cellData = createCellData();
        const mockInstance = new CellComponentMock(cellData);
        mockInstance.data = createTreeItemData();
        mockInstance.row.prevRow = new RowComponentMock();


        fieldEditor["treeGridRelationalColumnFormatter"](mockInstance as CellComponent);

        // eslint-disable-next-line no-lone-blocks
        {
            cellData.type = MrsObjectFieldTreeEntryType.DeletedField;

            fieldEditor["treeGridRelationalColumnFormatter"](new CellComponentMock(cellData) as CellComponent);

            cellData.field.objectReference!.referenceMapping.kind = "n:1";

            fieldEditor["treeGridRelationalColumnFormatter"](new CellComponentMock(cellData) as CellComponent);

            cellData.field.objectReference!.referenceMapping.kind = "1:1";

            fieldEditor["treeGridRelationalColumnFormatter"](new CellComponentMock(cellData) as CellComponent);

            const objectReferenceBackup = cellData.field.objectReference;

            cellData.field.objectReference = undefined;

            fieldEditor["treeGridRelationalColumnFormatter"](new CellComponentMock(cellData) as CellComponent);

            cellData.field.objectReference = objectReferenceBackup;
        }

        cellData.type = MrsObjectFieldTreeEntryType.FieldListClose;

        fieldEditor["treeGridRelationalColumnFormatter"](new CellComponentMock(cellData) as CellComponent);

        cellData.type = MrsObjectFieldTreeEntryType.FieldListOpen;

        fieldEditor["treeGridRelationalColumnFormatter"](new CellComponentMock(cellData) as CellComponent);

        // eslint-disable-next-line no-lone-blocks
        {
            //  test for different dbObject types
            (mountResult.values.dbObject as IMrsDbObjectData).objectType = MrsDbObjectType.View;

            fieldEditor["treeGridRelationalColumnFormatter"](new CellComponentMock(cellData) as CellComponent);

            (mountResult.values.dbObject as IMrsDbObjectData).objectType = MrsDbObjectType.Procedure;

            fieldEditor["treeGridRelationalColumnFormatter"](new CellComponentMock(cellData) as CellComponent);

            (mountResult.values.dbObject as IMrsDbObjectData).objectType = MrsDbObjectType.Function;

            fieldEditor["treeGridRelationalColumnFormatter"](new CellComponentMock(cellData) as CellComponent);
        }

        cellData.type = MrsObjectFieldTreeEntryType.LoadPlaceholder;

        fieldEditor["treeGridRelationalColumnFormatter"](new CellComponentMock(cellData) as CellComponent);
    });

    it("MrsObjectFieldEditor.editorHost tests", async () => {
        const mountResult = await doMount(createFieldEditorMountValuesEmptyData());
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        const cellData = createCellData();
        cellData.type = MrsObjectFieldTreeEntryType.DeletedField;
        const cell = new CellComponentMock(cellData);


        fieldEditor["editorHost"](cell, () => { }, (): boolean => { return true; }, () => { });
    });

    it("MrsObjectFieldEditor.renderCustomEditor tests", async () => {
        const mountResult = await doMount();
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        const cellData = createCellData();
        cellData.type = MrsObjectFieldTreeEntryType.DeletedField;
        const cell = new CellComponentMock(cellData);

        const host = document.createElement("div");


        fieldEditor["renderCustomEditor"](cell, () => { }, host, {},
            (): boolean => { return true; }, () => { });

    });

    it("MrsObjectFieldEditor.handleCellEdited tests", () => {
        const handleDbObjectChange = () => { };
        const handleGetCurrentDbObject = (): IMrsDbObjectData => {
            return createDbObjectData();
        };

        const cellData = createCellData();
        cellData.type = MrsObjectFieldTreeEntryType.FieldListOpen;
        cellData.field.id = "";
        cellData.field.name = "field name";
        const cell1 = new CellComponentMock(cellData);

        const cell2Data = createCellData();

        const values = createFieldEditorMountValuesData();

        {
            expect(values.currentTreeItems[0]?.field.dbColumn?.name).toBe("new_field");
            const tempValues = Object.assign({}, values);
            const tempCell = cell1;
            const fieldEditorMount = mount<MrsObjectFieldEditor>(<MrsObjectFieldEditor
                backend={backend}
                dbObjectChange={handleDbObjectChange}
                getCurrentDbObject={handleGetCurrentDbObject}
                values={tempValues} />);

            const fieldEditor: MrsObjectFieldEditor = fieldEditorMount.instance();


            fieldEditor["handleCellEdited"](tempCell);
        }
        {
            expect(values.currentTreeItems[0]?.field.dbColumn?.name).toBe("new_field");
            const tempValues = JSON.parse(JSON.stringify(values));
            const tempCell = new CellComponentMock(cell2Data);
            const fieldEditorMount = mount<MrsObjectFieldEditor>(<MrsObjectFieldEditor
                backend={backend}
                dbObjectChange={handleDbObjectChange}
                getCurrentDbObject={handleGetCurrentDbObject}
                values={tempValues} />);

            const fieldEditor: MrsObjectFieldEditor = fieldEditorMount.instance();


            fieldEditor["handleCellEdited"](tempCell as CellComponent);
        }
        {
            expect(values.currentTreeItems[0]?.field.dbColumn?.name).toBe("new_field");
            const tempValues = JSON.parse(JSON.stringify(values));
            const tempCell = new CellComponentMock(cell2Data);
            const fieldEditorMount = mount<MrsObjectFieldEditor>(<MrsObjectFieldEditor
                backend={backend}
                dbObjectChange={handleDbObjectChange}
                getCurrentDbObject={handleGetCurrentDbObject}
                values={tempValues} />);

            const fieldEditor: MrsObjectFieldEditor = fieldEditorMount.instance();


            tempCell["value"] = "Animal:number";

            fieldEditor["handleCellEdited"](tempCell);
        }
        {
            expect(values.currentTreeItems[0]?.field.dbColumn?.name).toBe("new_field");
            const tempValues = JSON.parse(JSON.stringify(values));
            const tempCell = new CellComponentMock(cell2Data);
            const fieldEditorMount = mount<MrsObjectFieldEditor>(<MrsObjectFieldEditor
                backend={backend}
                dbObjectChange={handleDbObjectChange}
                getCurrentDbObject={handleGetCurrentDbObject}
                values={tempValues} />);

            const fieldEditor: MrsObjectFieldEditor = fieldEditorMount.instance();


            tempCell["value"] = "Animal:boolean";

            fieldEditor["handleCellEdited"](tempCell);
        }
        {
            expect(values.currentTreeItems[0]?.field.dbColumn?.name).toBe("new_field");
            const tempValues = JSON.parse(JSON.stringify(values));
            const tempCell = new CellComponentMock(cell2Data);
            const fieldEditorMount = mount<MrsObjectFieldEditor>(<MrsObjectFieldEditor
                backend={backend}
                dbObjectChange={handleDbObjectChange}
                getCurrentDbObject={handleGetCurrentDbObject}
                values={tempValues} />);

            const fieldEditor: MrsObjectFieldEditor = fieldEditorMount.instance();


            tempCell["value"] = "Animal:object";

            fieldEditor["handleCellEdited"](tempCell);
        }
        {
            expect(values.currentTreeItems[0]?.field.dbColumn?.name).toBe("new_field");
            const tempValues = JSON.parse(JSON.stringify(values));
            const tempCell = new CellComponentMock(cell2Data);
            const fieldEditorMount = mount<MrsObjectFieldEditor>(<MrsObjectFieldEditor
                backend={backend}
                dbObjectChange={handleDbObjectChange}
                getCurrentDbObject={handleGetCurrentDbObject}
                values={tempValues} />);

            const fieldEditor: MrsObjectFieldEditor = fieldEditorMount.instance();


            tempCell["value"] = "Animal:boolean";
            tempCell.fieldType = "relational";

            fieldEditor["handleCellEdited"](tempCell);
        }
    });

    it("MrsObjectFieldEditor.performTreeItemUnnestChange tests", async () => {
        const mountResult = await doMount(createFieldEditorMountValuesEmptyData());
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        const treeItem = createTreeItemData();

        await fieldEditor["performTreeItemUnnestChange"](treeItem, false);

        await fieldEditor["performTreeItemUnnestChange"](treeItem, true);
    });

    it("MrsObjectFieldEditor.performIconClick tests", async () => {
        const mountResult = await doMount();
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;
        const treeItem = createTreeItemData();

        const tempObjectReference = treeItem.field.objectReference;
        delete tempObjectReference!["reduceToValueOfFieldId" as keyof object];

        // eslint-disable-next-line no-lone-blocks
        {

            await fieldEditor["performIconClick"](treeItem, 0);

            await fieldEditor["performIconClick"](treeItem, 0, "icon1"); // ActionIconName.Crud

            await fieldEditor["performIconClick"](treeItem, 0, "INSERT"); // ActionIconName.Crud

            await fieldEditor["performIconClick"](treeItem, 0, "UPDATE"); // ActionIconName.Crud

            await fieldEditor["performIconClick"](treeItem, 0, "DELETE"); // ActionIconName.Crud

            const optionsBackup = (mountResult.values as IMrsObjectFieldEditorData).mrsObjects[1].options;
            (mountResult.values as IMrsObjectFieldEditorData).mrsObjects[1].options = undefined;
            treeItem.field.objectReference!.options = undefined;

            await fieldEditor["performIconClick"](treeItem, 0, "DELETE"); // ActionIconName.Crud

            treeItem.field.representsReferenceId = undefined;

            await fieldEditor["performIconClick"](treeItem, 0, "DELETE"); // ActionIconName.Crud
            (mountResult.values as IMrsObjectFieldEditorData).mrsObjects[1].options = optionsBackup;
            treeItem.field.representsReferenceId = "";
        }


        await fieldEditor["performIconClick"](treeItem, 1, ""); // ActionIconName.Unnest

        await fieldEditor["performIconClick"](treeItem, 2, ""); // ActionIconName.Ownership

        await fieldEditor["performIconClick"](treeItem, 3, ""); // ActionIconName.Filtering

        await fieldEditor["performIconClick"](treeItem, 4, ""); // ActionIconName.Sorting

        await fieldEditor["performIconClick"](treeItem, 5, ""); // ActionIconName.Update

        // eslint-disable-next-line no-lone-blocks
        {
            treeItem.field.objectReference!.options = undefined;

            await fieldEditor["performIconClick"](treeItem, 6, ""); // ActionIconName.Check

            treeItem.field.dbColumn = undefined;
            (mountResult.values as IMrsObjectFieldEditorData).mrsObjects[1].options = undefined;

            await fieldEditor["performIconClick"](treeItem, 6, ""); // ActionIconName.Check
        }

        await fieldEditor["performIconClick"](treeItem, 7, ""); // ActionIconName.CheckAll

        treeItem.expanded = true;
        const tempField: object = treeItem.children![0].field;

        delete tempField["objectReference" as keyof object];

        await fieldEditor["performIconClick"](treeItem, 8, ""); // ActionIconName.CheckNone

        await fieldEditor["performIconClick"](treeItem, 9, ""); // ActionIconName.Delete
    });

    it("MrsObjectFieldEditor.handleIconClick tests", async () => {
        const mountResult = await doMount();
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        const cell = new CellComponentMock(createCellData());

        fieldEditor["handleIconClick"](cell, 0, "icon1"); // ActionIconName.Crud
    });

    it("MrsObjectFieldEditor.treeGridToggleEnableState tests", async () => {
        const mountResult = await doMount();
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        const cell = createCellData();

        (mountResult.values as IMrsObjectFieldEditorData).currentTreeItems[0].field.enabled = false;

        fieldEditor["treeGridToggleEnableState"](new Event("treeGridToggleEnableState_Event"),
            new CellComponentMock(cell));

        (mountResult.values as IMrsObjectFieldEditorData).currentTreeItems[0].field.enabled = true;
        (mountResult.values as IMrsObjectFieldEditorData).currentTreeItems[0].field.objectReference = {
            reduceToValueOfFieldId: "",
        } as IMrsObjectReference;

        fieldEditor["treeGridToggleEnableState"](new Event("treeGridToggleEnableState_Event"),
            new CellComponentMock(cell));
    });

    it("MrsObjectFieldEditor.handleRowExpanded tests", async () => {
        const mountResult = await doMount();
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        const cell = createCellData();
        const row: RowComponent = new CellComponentMock(cell).getRow();


        fieldEditor["handleRowExpanded"](row);

        (row as RowComponentMock).row!.field.objectReference!.unnest = true;

        fieldEditor["handleRowExpanded"](row);
    });

    it("MrsObjectFieldEditor.handleRowCollapsed tests", async () => {
        const mountResult = await doMount();
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        const cell = createCellData();
        const row = new CellComponentMock(cell).getRow();

        fieldEditor["handleRowCollapsed"](row);
    });

    it("MrsObjectFieldEditor.isRowExpanded tests", async () => {
        const mountResult = await doMount();
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        const cell = createCellData();
        const row = new CellComponentMock(cell).getRow();

        fieldEditor["isRowExpanded"](row);

        (row as RowComponentMock).row!.expanded = true;

        fieldEditor["isRowExpanded"](row);
    });

    it("MrsObjectFieldEditor.addNewField tests", async () => {
        const mountResult = await doMount();
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        const cell = createCellData();
        const row = new CellComponentMock(cell).getRow();

        fieldEditor["addNewField"](row);
    });

    it("MrsObjectFieldEditor.setCurrentMrsObject tests", async () => {
        const mountResult = await doMount();
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        const mrsObject: IMrsObject = {
            id: "",
            dbObjectId: "",
            name: "",
            position: 0,
            kind: MrsObjectKind.Parameters,
        };

        await fieldEditor["setCurrentMrsObject"](undefined);

        await fieldEditor["setCurrentMrsObject"](mrsObject);
    });

    it("MrsObjectFieldEditor.addMrsObject tests", async () => {
        const mountResult = await doMount();
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        fieldEditor["addMrsObject"](new MouseEvent("testEvent"), {});
    });

    it("MrsObjectFieldEditor.removeCurrentMrsObject tests", async () => {
        const mountResult = await doMount();
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        fieldEditor["removeCurrentMrsObject"](new MouseEvent("testEvent"), {});
    });

    it("MrsObjectFieldEditor.getJsonDatatype tests", async () => {
        const mountResult = await doMount(createFieldEditorMountValuesEmptyData());
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        document.createElement("div");

        expect(fieldEditor["getJsonDatatype"]("tinyint(1) ")).toBe("boolean");
        expect(fieldEditor["getJsonDatatype"]("bit(1) ")).toBe("boolean");
        expect(fieldEditor["getJsonDatatype"]("tinyint ")).toBe("number");
        expect(fieldEditor["getJsonDatatype"]("smallint ")).toBe("number");
        expect(fieldEditor["getJsonDatatype"]("mediumint ")).toBe("number");
        expect(fieldEditor["getJsonDatatype"]("int ")).toBe("number");
        expect(fieldEditor["getJsonDatatype"]("bigint ")).toBe("number");
        expect(fieldEditor["getJsonDatatype"]("decimal ")).toBe("number");
        expect(fieldEditor["getJsonDatatype"]("numeric ")).toBe("number");
        expect(fieldEditor["getJsonDatatype"]("float ")).toBe("number");
        expect(fieldEditor["getJsonDatatype"]("double ")).toBe("number");
        expect(fieldEditor["getJsonDatatype"]("json ")).toBe("unknown");
        expect(fieldEditor["getJsonDatatype"]("geometry ")).toBe("object");
        expect(fieldEditor["getJsonDatatype"]("aaaaa")).toBe("string");
    });

    it("MrsObjectFieldEditor.addColumnsAsFields tests", async () => {
        const mountResult = await doMount();
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        const createColumnWithReference = () => {
            return Object.assign({}, {
                position: 0,
                name: "param_1",
                refColumnNames: "",
                dbColumn: {
                    name: "",
                    datatype: "",
                    notNull: false,
                    isPrimary: false,
                    isUnique: false,
                    isGenerated: false,
                    idGeneration: "",
                    comment: "",
                    in: false,
                    out: false,
                },
                referenceMapping: {
                    kind: "",
                    constraint: "",
                    toMany: false,
                    referencedSchema: "some_schema",
                    referencedTable: "",
                    columnMapping: [{
                        base: "",
                        ref: "",
                    }],
                    unnest: true,
                },
                tableSchema: "",
                tableName: "",
            });
        };

        const columnWithReference = createColumnWithReference();

        mountResult.backend.mrs.getTableColumnsWithReferences =
            async (requestPath?: string, dbObjectName?: string,
                dbObjectId?: string, schemaId?: string, schemaName?: string,
                dbObjectType?: string): Promise<IMrsTableColumnWithReference[]> => {

                columnWithReference.dbColumn.datatype = dbObjectType || "";
                columnWithReference.tableSchema = schemaName || "";
                columnWithReference.tableName = dbObjectName || "";

                return Promise.resolve([columnWithReference]);
            };

        const currentMrsObject: IMrsObject = {
            id: "",
            dbObjectId: "",
            name: "",
            position: 0,
            kind: MrsObjectKind.Parameters,
        }; //currentObject


        await fieldEditor["addColumnsAsFields"](
            "actor",
            "MRS_TEST",
            "VIEW",
            [], //storedFields
            currentMrsObject, //currentObject
            [], //parentTreeItemList
            [], //referredTreeItemsToLoad
        );

        const storedFields = createStoredFields();

        await fieldEditor["addColumnsAsFields"](
            "actor",
            "MRS_TEST",
            "VIEW",
            storedFields, //IMrsObjectFieldWithReference[]
            currentMrsObject, //currentObject
            [], //parentTreeItemList
            [], //referredTreeItemsToLoad
        );

        await fieldEditor["addColumnsAsFields"](
            "actor",
            "MRS_TEST",
            "VIEW",
            storedFields, //IMrsObjectFieldWithReference[]
            currentMrsObject, //currentObject
            [], //parentTreeItemList
            [], //referredTreeItemsToLoad
        );
    });

    it("MrsObjectFieldEditor.addParametersAsFields tests", async () => {
        const mountResult = await doMount(createFieldEditorMountValuesEmptyData());
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        mountResult.backend.mrs.getDbObjectParameters = (_dbObjectName?: string,
            _dbSchemaName?: string,
            _dbObjectId?: string,
            _dbType?: string,
        ): Promise<IMrsDbObjectParameterData[]> => {
            return Promise.resolve([{
                id: "",
                position: 0,
                name: "param_1",
                mode: "",
                datatype: "",
            }]);
        };

        const currentMrsObject: IMrsObject = {
            id: "",
            dbObjectId: "",
            name: "",
            position: 0,
            kind: MrsObjectKind.Parameters,
        }; //currentObject


        await fieldEditor["addParametersAsFields"](
            "actor",
            "MRS_TEST",
            "VIEW",
            [], //IMrsObjectFieldWithReference[]
            currentMrsObject, //currentObject
            [], //parentTreeItemList
            [], //referredTreeItemsToLoad
        );


        await fieldEditor["addParametersAsFields"](
            "actor",
            "MRS_TEST",
            "VIEW",
            createStoredFields(), //IMrsObjectFieldWithReference[]
            currentMrsObject, //currentObject
            [], //parentTreeItemList
            [], //referredTreeItemsToLoad
        );
    });

    it("MrsObjectFieldEditor.buildDataMappingViewSql tests", async () => {
        await doMount(createFieldEditorMountValuesEmptyData());

        const data = createFieldEditorMountValuesData();
        MrsObjectFieldEditor.buildDataMappingViewSql(data);

        expect(data.mrsObjects[1].fields?.length).toBeGreaterThan(0);
        expect(data.mrsObjects[1].fields![0].dbColumn).toBeDefined();

        data.mrsObjects[1].fields![0].dbColumn!.out = true;
        data.mrsObjects[1].fields![0].dbColumn!.in = false;
        MrsObjectFieldEditor.buildDataMappingViewSql(data);

        data.mrsObjects[1].fields![0].dbColumn!.out = false;
        data.mrsObjects[1].fields![0].dbColumn!.in = true;
        data.mrsObjects[1].fields![0].noUpdate = true;
        data.mrsObjects[1].fields![0].allowFiltering = false;
        MrsObjectFieldEditor.buildDataMappingViewSql(data);

        data.mrsObjects[1].fields![1].objectReference!.options = {
            dualityViewDelete: true,
            dualityViewInsert: true,
            dualityViewNoCheck: true,
            dualityViewUpdate: true,
        };
        MrsObjectFieldEditor.buildDataMappingViewSql(data);

        data.dbObject.objectType = MrsDbObjectType.Procedure;
        MrsObjectFieldEditor.buildDataMappingViewSql(data);

        data.dbObject.requiresAuth = 1;
        data.dbObject.mediaType = "SOME TYPE";
        data.dbObject.authStoredProcedure = "SOME PROCEDURE";
        MrsObjectFieldEditor.buildDataMappingViewSql(data);
    });

    it("MrsObjectFieldEditor.initMrsObjects tests", async () => {
        const mountResult = await doMount(createFieldEditorMountValuesEmptyData());
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        mountResult.backend.mrs.getDbFunctionReturnType =
            async (dbObjectName: string, dbSchemaName: string): Promise<string> => {
                expect(dbObjectName).toBe("myFunc");
                expect(dbSchemaName).toBe("mySchema");

                return Promise.resolve("void");
            };

        (mountResult.values.dbObject as IMrsDbObjectData).id = "";
        (mountResult.values.dbObject as IMrsDbObjectData).objectType = MrsDbObjectType.Function;
        (mountResult.values.dbObject as IMrsDbObjectData).name = "myFunc";
        (mountResult.values.dbObject as IMrsDbObjectData).dbSchemaName = "mySchema";

        await fieldEditor["initMrsObjects"]();
    });

    it("MrsObjectFieldEditor.updateDbObjectCrudOperations tests", async () => {
        const mountResult = await doMount();
        const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

        fieldEditor["updateDbObjectCrudOperations"]();

        (mountResult.values as IMrsObjectFieldEditorData).mrsObjects[1].options = {
            dualityViewUpdate: false,
        };
        (mountResult.values as IMrsObjectFieldEditorData).mrsObjects[1].options!.dualityViewUpdate = false;
        (mountResult.values as IMrsObjectFieldEditorData).mrsObjects[1].fields![0].objectReference = {
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
            options: {
                dualityViewInsert: true,
            },
            unnest: true,
        };

        fieldEditor["updateDbObjectCrudOperations"]();

        (mountResult.values.dbObject as IMrsDbObjectData).objectType = MrsDbObjectType.Function;

        fieldEditor["updateDbObjectCrudOperations"]();
    });
});
