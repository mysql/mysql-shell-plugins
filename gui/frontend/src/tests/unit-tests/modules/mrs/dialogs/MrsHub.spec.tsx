/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import { createRef, options } from "preact";

import { mount, shallow } from "enzyme";
import { IMySQLConnectionOptions, MySQLConnectionScheme } from "../../../../../communication/MySQL.js";
import { IShellDictionary } from "../../../../../communication/Protocol.js";
import {
    IMrsAddContentSetData,
    IMrsAuthAppData,
    IMrsAddAuthAppData,
    IMrsServiceData,
    IMrsUserRoleData,
    IShellMrsUpdateDbObjectKwargsValue,
    IMrsDbObjectData,
    IMrsTableColumnWithReference,
    IMrsDbObjectParameterData,
    IMrsObject,
    IMrsObjectFieldWithReference,
    IMrsSchemaData,
    ShellAPIMrs,
} from "../../../../../communication/ProtocolMrs.js";
import { MrsHub } from "../../../../../modules/mrs/MrsHub.js";
import { IMrsDbObjectEditRequest, requisitions } from "../../../../../supplement/Requisitions.js";
import { ShellInterface } from "../../../../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceSqlEditor } from "../../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { DBType, IConnectionDetails } from "../../../../../supplement/ShellInterface/index.js";
import { webSession } from "../../../../../supplement/WebSession.js";
import { MySQLShellLauncher } from "../../../../../utilities/MySQLShellLauncher.js";
import { KeyboardKeys, sleep, uuidBinary16Base64 } from "../../../../../utilities/helpers.js";
import {
    DialogHelper,
    JestReactWrapper,
    getDbCredentials,
    nextRunLoop,
    sendKeyPress,
    setupShellForTests,
} from "../../../test-helpers.js";
import {
    MrsDbObjectType,
    MrsObjectKind,
    MrsSdkLanguage,
} from "../../../../../modules/mrs/types.js";
import {
    IMrsObjectFieldEditorData,
    IMrsObjectFieldTreeItem,
    MrsObjectFieldEditor,
    MrsObjectFieldTreeEntryType,
} from "../../../../../modules/mrs/dialogs/MrsObjectFieldEditor.js";
import { CellComponent, RowComponent } from "tabulator-tables";
import { RowComponentMock } from "../../../__mocks__/RowComponentMock.js";
import { MockCellComponent } from "../../../__mocks__/CellComponentMock.js";
import { DataCallback } from "../../../../../communication/MessageScheduler.js";
import { Dropdown } from "../../../../../components/ui/Dropdown/Dropdown.js";

describe("MrsHub Tests", () => {
    let host: JestReactWrapper;

    let launcher: MySQLShellLauncher;
    let backend: ShellInterfaceSqlEditor;

    let service: IMrsServiceData;
    let authApp: IMrsAuthAppData;
    let dialogHelper: DialogHelper;

    const hubRef = createRef<MrsHub>();

    const createBackend = async (): Promise<ShellInterfaceSqlEditor> => {
        const credentials = getDbCredentials();

        const options: IMySQLConnectionOptions = {
            scheme: MySQLConnectionScheme.MySQL,
            user: credentials.userName,
            password: credentials.password,
            host: credentials.host,
            port: credentials.port,
        };

        const testConnection: IConnectionDetails = {
            id: -1,
            dbType: DBType.MySQL,
            caption: "ShellInterfaceDb Test Connection 1",
            description: "ShellInterfaceDb Test Connection",
            options,
        };

        testConnection.id = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testConnection, "unit-tests") ?? -1;
        expect(testConnection.id).toBeGreaterThan(-1);

        const backend = new ShellInterfaceSqlEditor();
        await backend.startSession("mrsHubTests");
        await backend.openConnection(testConnection.id);

        return Promise.resolve(backend);
    };

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
        return Object.assign({}, {
            servicePath: "",
            dbSchemaName: "",
            dbSchemaPath: "",
            dbObject: {},
            crudOperations: [],
            createDbObject: false,
            defaultMrsObjectName: "",
            mrsObjects: [],
            showSdkOptions: MrsSdkLanguage.TypeScript,
            currentMrsObjectId: "",
            currentTreeItems: [],
        });
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
                        // representsReferenceId?: string,
                        parentReferenceId: "",
                        name: "Field",
                        position: 0,
                        // dbColumn?: IMrsTableColumn,
                        enabled: true,
                        allowFiltering: true,
                        allowSorting: true,
                        noCheck: true,
                        noUpdate: false,
                        // sdkOptions?: IMrsObjectFieldSdkOptions,
                        // comments?: string,
                        // objectReference?: IMrsObjectReference,
                        // lev?: number,
                        // caption?: string,
                        // storedDbColumn?: IMrsTableColumn,
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
                        // representsReferenceId?: string,
                        // parentReferenceId: "",
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
                        // sdkOptions?: IMrsObjectFieldSdkOptions,
                        // comments?: string,
                        // objectReference: {
                        //     id: "",
                        //     reduceToValueOfFieldId: "field_1",
                        //     referenceMapping: {
                        //         kind: "",
                        //         constraint: "",
                        //         toMany: true,
                        //         referencedSchema: "",
                        //         referencedTable: "",
                        //         columnMapping: [], //IMrsColumnMapping[]
                        //     }, // IMrsTableReference,
                        //     options: {
                        //         dualityViewInsert: true,
                        //     },
                        //     // unnest: true,
                        //     // crudOperations: ["READ", "UPDATE", "CREATE", "DELETE"],
                        //     // sdkOptions?: IMrsObjectReferenceSdkOptions,
                        //     // comments?: string,
                        //     // }, //IMrsObjectReference,
                        //     // lev?: number,
                        //     // caption?: string,
                        //     // storedDbColumn?: IMrsTableColumn,
                        // },
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
                        // sdkOptions?: IMrsObjectFieldSdkOptions,
                        // comments?: string,
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
                            // sdkOptions?: IMrsObjectReferenceSdkOptions,
                            // comments?: string,
                        }, //IMrsObjectReference,
                        // lev?: number,
                        // caption?: string,
                        // storedDbColumn?: IMrsTableColumn,
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

                // unnested?: IMrsObjectFieldUnnested; // Set if this field is an unnested copy

                field: {
                    id: "new_field",
                    objectId: "",
                    // representsReferenceId?: "",
                    // parentReferenceId?: "",
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
                    // objectReference: {},
                    // sdkOptions?: IMrsObjectFieldSdkOptions,
                    // comments?: "",
                    // objectReference?: IMrsObjectReference,
                    // lev?: number,
                    // caption?: "",
                    // storedDbColumn?: IMrsTableColumn,
                },

                // parent?: IMrsObjectFieldTreeItem;
                children: [{
                    type: MrsObjectFieldTreeEntryType.Field,
                    expanded: true,
                    expandedOnce: true,
                    // firstItem?: true,
                    // lastItem?: true,

                    // unnested?: IMrsObjectFieldUnnested; // Set if this field is an unnested copy

                    field: {
                        id: "",
                        objectId: "",
                        // representsReferenceId?: "",
                        // parentReferenceId?: "",
                        name: "",
                        position: 1,
                        // dbColumn?: IMrsTableColumn,
                        enabled: true,
                        allowFiltering: true,
                        allowSorting: true,
                        noCheck: true,
                        noUpdate: true,
                        // sdkOptions?: IMrsObjectFieldSdkOptions,
                        // comments?: "",
                        // objectReference?: IMrsObjectReference,
                        // lev?: 1,
                        // caption?: "",
                        // storedDbColumn?: IMrsTableColumn,
                    },

                    // parent?: IMrsObjectFieldTreeItem;
                    // children?: IMrsObjectFieldTreeItem[];
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
            // representsReferenceId?: "",
            // parentReferenceId?: "",
            name: "field_1",
            position: 0,
            dbColumn: {
                name: "param_1",
                datatype: "",
                notNull: true,
                isPrimary: true,
                isUnique: true,
                isGenerated: true,
                // idGeneration?: "",
                // comment?: "",
                // in?: true,
                // out?: true,
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
                // reduceToValueOfFieldId?: string,
                // rowOwnershipFieldId?: string,
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
                    unnest: true,
                    // options?: IMrsObjectOptions,
                    // sdkOptions?: IMrsObjectReferenceSdkOptions,
                    // comments?: string,
                }, //IMrsObjectReference,
                // lev?: 0,
                // caption?: "",
                storedDbColumn: {
                    name: "param_1",
                    datatype: "",
                    notNull: true,
                    isPrimary: true,
                    isUnique: true,
                    isGenerated: true,
                    // idGeneration?: "",
                    // comment?: "",
                    // in?: true,
                    // out?: true,
                }, //IMrsTableColumn,
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

        backend = await createBackend();

        // Some preparation for the tests.
        await backend.execute("DROP DATABASE IF EXISTS mysql_rest_service_metadata");
        await backend.execute("DROP DATABASE IF EXISTS MRS_TEST");
        await backend.execute("CREATE DATABASE MRS_TEST");
        await backend.execute("CREATE TABLE MRS_TEST.actor (actor_id INT NOT NULL, first_name VARCHAR(45) NOT NULL, " +
            "last_name VARCHAR(45) NOT NULL, last_update TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY " +
            "(actor_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci");
        await backend.execute("CREATE PROCEDURE MRS_TEST.actor_count (IN var1 CHAR(3), OUT actors INT)\n" +
            "BEGIN\n" +
            "   SELECT COUNT(*) + var1 INTO actors FROM MRS_TEST.actor;\n" +
            "END");

        await backend.mrs.configure();
        service = await backend.mrs.addService("/myService", ["HTTPS"], "", "", true, {}, "/unit-tests", "", "", "");

        const authAppId = await backend.mrs.addAuthApp(service.id, {
            authVendorId: "0x30000000000000000000000000000000",
            name: "MRS",
            serviceId: service.id,
            enabled: true,
            limitToRegisteredUsers: false,
            defaultRoleId: "0x31000000000000000000000000000000",
        }, []);
        authApp = await backend.mrs.getAuthApp(authAppId.authAppId);
        const schemaId = await backend.mrs.addSchema(service.id, "MRS_TEST", "/mrs-test", false, null, null);

        let newDbObjectId = uuidBinary16Base64();
        const dbObjectResult = await backend.mrs.addDbObject("actor", MrsDbObjectType.Table, false, "/actor", true,
            "FEED", false, false, null, null, schemaId,
            undefined, "<this is a comment>", undefined, undefined, null,
            [
                {
                    id: newDbObjectId,
                    dbObjectId: "",
                    name: "MyServiceAnalogPhoneBookAddresses",
                    position: 0,
                    kind: MrsObjectKind.Result,
                    fields: [
                        {
                            id: uuidBinary16Base64(),
                            objectId: newDbObjectId,
                            name: "id",
                            position: 1,
                            dbColumn: {
                                comment: "<comment for column 'id'>",
                                datatype: "int",
                                idGeneration: "",
                                isGenerated: false,
                                isPrimary: true,
                                isUnique: false,
                                name: "id",
                                notNull: true,
                                // srid:null,
                            },
                            enabled: true,
                            allowFiltering: true,
                            allowSorting: true,
                            noCheck: false,
                            noUpdate: false,
                        },
                        {
                            id: uuidBinary16Base64(),
                            objectId: newDbObjectId,
                            name: "addressLine",
                            position: 2,
                            dbColumn: {
                                comment: "<comment for column 'addressLine'>",
                                datatype: "varchar(256)",
                                idGeneration: "",
                                isGenerated: false,
                                isPrimary: false,
                                isUnique: false,
                                name: "address_line",
                                notNull: false,
                            },
                            enabled: true,
                            allowFiltering: true,
                            allowSorting: false,
                            noCheck: false,
                            noUpdate: false,
                        },
                        {
                            id: uuidBinary16Base64(),
                            objectId: newDbObjectId,
                            name: "city",
                            position: 3,
                            dbColumn: {
                                comment: "<comment for column 'city'>",
                                datatype: "varchar(128)",
                                idGeneration: "",
                                isGenerated: false,
                                isPrimary: false,
                                isUnique: false,
                                name: "city",
                                notNull: false,
                            },
                            enabled: true,
                            allowFiltering: true,
                            allowSorting: false,
                            noCheck: false,
                            noUpdate: false,
                        },
                    ],
                },
            ]);


        newDbObjectId = uuidBinary16Base64();
        const dbObjectResult2 = await backend.mrs.addDbObject("actor_count",
            MrsDbObjectType.Procedure, false, "/actor_count", true,
            "FEED", false, false, null, null, schemaId,
            undefined, "<this is a comment>", undefined, undefined, null,
            [
                {
                    id: newDbObjectId,
                    dbObjectId: "",
                    name: "MyServiceAnalogPhoneBookAddresses",
                    position: 0,
                    kind: MrsObjectKind.Result,
                    fields: [
                        {
                            id: uuidBinary16Base64(),
                            objectId: newDbObjectId,
                            name: "id",
                            position: 1,
                            dbColumn: {
                                comment: "<comment for column 'id'>",
                                datatype: "int",
                                idGeneration: "",
                                isGenerated: false,
                                isPrimary: true,
                                isUnique: false,
                                name: "id",
                                notNull: true,
                                // srid:null,
                            },
                            enabled: true,
                            allowFiltering: true,
                            allowSorting: true,
                            noCheck: false,
                            noUpdate: false,
                        },
                        {
                            id: uuidBinary16Base64(),
                            objectId: newDbObjectId,
                            name: "addressLine",
                            position: 2,
                            dbColumn: {
                                comment: "<comment for column 'addressLine'>",
                                datatype: "varchar(256)",
                                idGeneration: "",
                                isGenerated: false,
                                isPrimary: false,
                                isUnique: false,
                                name: "address_line",
                                notNull: false,
                            },
                            enabled: true,
                            allowFiltering: true,
                            allowSorting: false,
                            noCheck: false,
                            noUpdate: false,
                        },
                    ],
                },
            ]);
        await backend.mrs.getDbObject(dbObjectResult);

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

    describe("MRS Service dialog tests", () => {
        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsServiceDialog", "MySQL REST Service");
        });

        it("Show MRS Service Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            const promise = hubRef.current!.showMrsServiceDialog(backend);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            expect(portals[0]).toMatchSnapshot();

            setTimeout(() => {
                sendKeyPress(KeyboardKeys.Escape);
            }, 250);

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("Show MRS Service Dialog and cancel", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            const promise = hubRef.current!.showMrsServiceDialog(backend);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            await dialogHelper.clickCancel();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("Dialog error testing", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            backend.mrs.addService = async (urlContextRoot: string, urlProtocol: string[], urlHostName: string,
                comments: string, enabled: boolean, options: IShellDictionary | null,
                authPath: string, authCompletedUrl: string,
                authCompletedUrlValidation: string, authCompletedPageContent: string,
                metadata?: IShellDictionary, published = false): Promise<IMrsServiceData> => {
                return Promise.resolve({
                    enabled: Number(enabled),
                    published: Number(published),
                    hostCtx: "",
                    id: "",
                    isCurrent: 1,
                    urlContextRoot,
                    urlHostName,
                    urlProtocol: urlProtocol.join(","),
                    comments,
                    options: options ?? {},
                    authPath,
                    authCompletedUrl,
                    authCompletedUrlValidation,
                    authCompletedPageContent,
                    enableSqlEndpoint: 0,
                    customMetadataSchema: "",
                    metadata,
                });
            };

            backend.mrs.updateService = async (serviceId: string, urlContextRoot: string, urlHostName: string,
                value: IShellDictionary): Promise<void> => {
                expect(serviceId).toBeDefined();
                expect(urlContextRoot).toBeDefined();
                expect(urlHostName).toBeDefined();
                expect(value).toBeDefined();

                return Promise.resolve();
            };

            await sleep(500);
            const promise = hubRef.current!.showMrsServiceDialog(backend);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);
            dialogHelper.verifyErrors();

            expect(dialogHelper.getInputText("servicePath")).toBe("/myService");

            await dialogHelper.setInputText("servicePath", "");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The service name must not be empty."]);

            await dialogHelper.setInputText("servicePath", "/mrs");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The request path `/mrs` is reserved and cannot be used."]);

            await dialogHelper.setInputText("servicePath", "/MRS");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The request path `/MRS` is reserved and cannot be used."]);

            await dialogHelper.setInputText("servicePath", "/myService2");

            await dialogHelper.setInputText("comments", "some comments");
            await dialogHelper.setInputText("hostName", "localhost");

            await dialogHelper.clickOk();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });
    });

    describe("MRS Schema dialog tests", () => {
        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsSchemaDialog", "MySQL REST Schema");
        });

        it("Show MRS Schema Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            const promise = hubRef.current!.showMrsSchemaDialog(backend);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            expect(portals[0]).toMatchSnapshot();

            setTimeout(() => {
                sendKeyPress(KeyboardKeys.Escape);
            }, 250);

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("Show MRS Schema Dialog and cancel", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            const promise = hubRef.current!.showMrsSchemaDialog(backend);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            await dialogHelper.clickCancel();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("Dialog error testing", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            backend.mrs.addSchema = (serviceId: string, schemaName: string, requestPath: string, requiresAuth: boolean,
                options: IShellDictionary | null,
                itemsPerPage: number | null, comments?: string): Promise<string> => {
                expect(serviceId).not.toBeNull();
                expect(schemaName).toBe("mySchema");
                expect(requestPath).toBe("/schema");
                expect(requiresAuth).toBeFalsy();
                expect(itemsPerPage).toBeNull();
                expect(options).toBeNull();
                expect(comments).toBe("");

                return Promise.resolve("done");
            };

            const promise = hubRef.current!.showMrsSchemaDialog(backend);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            await dialogHelper.setInputText("dbSchemaName", "");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The database schema name must not be empty."]);

            await dialogHelper.setInputText("dbSchemaName", "mySchema");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });
    });

    describe("MRS AuthApp dialog tests", () => {
        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsAuthenticationAppDialog", "MySQL REST Authentication App");
        });

        it("Show MRS Authentication App Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            const promise = hubRef.current!.showMrsAuthAppDialog(backend);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            expect(portals[0]).toMatchSnapshot();

            setTimeout(() => {
                sendKeyPress(KeyboardKeys.Escape);
            }, 250);

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("Show MRS Authentication App Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            const promise = hubRef.current!.showMrsAuthAppDialog(backend);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            await dialogHelper.clickCancel();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("Dialog error testing", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            const promise = hubRef.current!.showMrsAuthAppDialog(backend);

            backend.mrs.addAuthApp = (serviceId: string, authApp: IMrsAuthAppData, registerUsers: [])
                : Promise<IMrsAddAuthAppData> => {
                expect(serviceId.length).toBeGreaterThan(0);
                expect(authApp.name).toBe("MyAuthApp");
                expect(authApp.appId?.length).toBeGreaterThan(0);

                expect(registerUsers).toBeDefined();

                return Promise.resolve({ authAppId: "can't calculate the id at this stage of the tests" });
            };

            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The vendor name must not be empty.", "The name must not be empty."]);

            await dialogHelper.setInputText("name", "MyAuthApp");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The vendor name must not be empty."]);

            await dialogHelper.setComboBoxItem("authVendorName", 3);
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });
    });

    describe("MRS User dialog tests", () => {
        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsUserDialog", "MySQL REST User");
        });

        it("Show MRS User Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            const promise = hubRef.current!.showMrsUserDialog(backend, authApp);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            expect(portals[0]).toMatchSnapshot();

            setTimeout(() => {
                sendKeyPress(KeyboardKeys.Escape);
            }, 250);

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("Show MRS User Dialog and cancel", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            const promise = hubRef.current!.showMrsUserDialog(backend, authApp);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            await dialogHelper.clickCancel();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("Dialog error testing", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            backend.mrs.addUser = (authAppId: string, name: string, email: string, vendorUserId: string,
                loginPermitted: boolean, mappedUserId: string, appOptions: IShellDictionary | null,
                authString: string, userRoles: IMrsUserRoleData[]): Promise<void> => {
                expect(name).toBe("MyUser");
                expect(authString).toBe("AAAAAA");
                expect(authAppId.length).toBeGreaterThan(0);

                expect(email).toBeDefined();
                expect(vendorUserId).toBeDefined();
                expect(loginPermitted).toBeDefined();
                expect(mappedUserId).toBeDefined();
                expect(appOptions).toBeDefined();
                expect(userRoles).toBeDefined();

                return Promise.resolve();
            };

            const promise = hubRef.current!.showMrsUserDialog(backend, authApp);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            await dialogHelper.setInputText("name", "");
            await dialogHelper.setInputText("authString", "");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors([
                "The authentication string is required for this app.",
                "The user name or email are required for this app.",
            ]);

            await dialogHelper.setInputText("name", "My User");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The authentication string is required for this app."]);

            await dialogHelper.setInputText("authString", "SomePassword");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

    });

    describe("MRS Content Set dialog tests", () => {
        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsContentSetDialog", "MRS Content Set");
        });

        it("Show MRS Content Set Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            const promise = hubRef.current!.showMrsContentSetDialog(backend);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            expect(portals[0]).toMatchSnapshot();

            setTimeout(() => {
                sendKeyPress(KeyboardKeys.Escape);
            }, 250);

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("Show MRS Content Set Dialog and cancel", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            const promise = hubRef.current!.showMrsContentSetDialog(backend);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            await dialogHelper.clickCancel();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("Dialog error testing", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            backend.mrs.addContentSet = (contentDir: string, requestPath: string,
                requiresAuth: boolean, options: IShellDictionary | null,
                serviceId?: string, comments?: string,
                enabled?: boolean, replaceExisting?: boolean,
                ignoreList?: string,
                callback?: DataCallback<ShellAPIMrs.MrsAddContentSet>): Promise<IMrsAddContentSetData> => {
                expect(requestPath).toBe("/someRequestPath");

                expect(contentDir).toBeDefined();
                expect(requiresAuth).toBeDefined();
                expect(options).toBeDefined();
                expect(serviceId).toBeDefined();
                expect(comments).toBeDefined();
                expect(enabled).toBeDefined();
                expect(replaceExisting).toBeDefined();
                expect(callback).toBeDefined();

                return Promise.resolve({});
            };

            const promise = hubRef.current!.showMrsContentSetDialog(backend);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            await dialogHelper.setInputText("requestPath", "");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The request path must not be empty."]);

            await dialogHelper.setInputText("requestPath", "someRequestPath");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The request path must start with /."]);

            await dialogHelper.setInputText("requestPath", "/someRequestPath");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });
    });

    describe("MRS SDK Export dialog tests", () => {
        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsSdkExportDialog", "Export MRS SDK for /myService");
        });

        it("Show MRS SDK Export Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
            const promise = hubRef.current!.showMrsSdkExportDialog(backend, service.id, 1);
            await dialogHelper.waitForDialog();


            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            expect(portals[0]).toMatchSnapshot();

            setTimeout(() => {
                sendKeyPress(KeyboardKeys.Escape);
            }, 250);

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("Show MRS SDK Export Dialog and cancel", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
            const promise = hubRef.current!.showMrsSdkExportDialog(backend, service.id, 1);
            await dialogHelper.waitForDialog();


            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            expect(portals[0]).toMatchSnapshot();

            await dialogHelper.clickCancel();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("Dialog error testing", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
            const promise = hubRef.current!.showMrsSdkExportDialog(backend, service.id, 1);
            await dialogHelper.waitForDialog();


            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            await dialogHelper.clickOk();
            dialogHelper.verifyErrors();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });
    });

    describe("MRS Db Object dialog tests", () => {
        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsDbObjectDialog", "MySQL REST Object");
        });

        it("Show MRS DB Object Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            const title = "Enter Configuration Values for the New MySQL REST Object";
            const schemas = await backend.mrs.listSchemas();
            const dbObjects = await backend.mrs.listDbObjects(schemas[0].id);
            const dialogRequest: IMrsDbObjectEditRequest = {
                id: "mrsDbObjectDialog",
                title,
                dbObject: dbObjects[0],
                createObject: false,
            };

            const promise = hubRef.current!.showMrsDbObjectDialog(backend, dialogRequest);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            // This check fails in CI, but not locally. A slider is not hidden in CI as it should be.
            // We have to rely on e2e tests for this.
            expect(portals[0]).toMatchSnapshot();

            setTimeout(() => {
                sendKeyPress(KeyboardKeys.Escape);
            }, 250);

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("Show MRS DB Object Dialog and cancel", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            const title = "Enter Configuration Values for the New MySQL REST Object";
            const schemas = await backend.mrs.listSchemas();
            const dbObjects = await backend.mrs.listDbObjects(schemas[0].id);
            const dialogRequest: IMrsDbObjectEditRequest = {
                id: "mrsDbObjectDialog",
                title,
                dbObject: dbObjects[0],
                createObject: false,
            };

            const promise = hubRef.current!.showMrsDbObjectDialog(backend, dialogRequest);
            await dialogHelper.waitForDialog();


            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            const [dataMappingTab, settingsTab, authorizationsTab, optionsTab]
                = dialogHelper.getTabItems(["Data Mapping", "Settings", "Authorization", "Options"]);

            {//  Data Mapping tab
                dataMappingTab.click();
                await nextRunLoop();

                const treeGrid = dialogHelper.searchChild<HTMLDivElement>({ class: "mrsObjectTreeGrid" });

                expect(treeGrid.children).toHaveLength(2);

                const treeGridHeader = treeGrid.children[0];

                expect(treeGridHeader.classList).toContain("tabulator-header");
                expect(treeGridHeader.classList).toContain("tabulator-header-hidden");

                // TODO: we should check the hidden column titles here...

                const treeGridTable = treeGrid.children[1] as HTMLElement;
                expect(treeGridTable.classList).toContain("tabulator-tableholder");

                //  TODO: the tree grid items are not showing up
                // expect(treeGridTable.children[0].childElementCount).toBe(6);

                // const treeGridRows = treeGridTable.children[0].children;

                // const tableName = dialogHelper.searchChildren({ class: "tableName", docRoot: treeGridTable });
            }
            {//  Settings tab
                settingsTab.click();
                await nextRunLoop();

                const contents = dialogHelper.searchChild<HTMLDivElement>({
                    class: "msg container fixedScrollbar content",
                });
                const gridCells = dialogHelper.searchChildren({ docRoot: contents, class: "gridCell" });

                expect(gridCells).toHaveLength(5);

                //  cell 1
                expect(gridCells[0].children[0].textContent).toBe("Result Format");
                expect(gridCells[0].children[1].firstElementChild?.textContent).toBe("FEED");

                // cell 2
                expect(gridCells[1].children[0].textContent).toBe("Items per Page");
                expect(gridCells[1].children[1].firstElementChild?.textContent).toBe("");

                // cell 3
                expect(gridCells[2].children[0].textContent).toBe("Comments");
                expect(gridCells[2].children[1].firstElementChild?.value).toBe("<this is a comment>");

                // cell 4
                expect(gridCells[3].children[0].textContent).toBe("Media Type");
                expect(gridCells[3].children[1].firstElementChild?.textContent).toBe("");

                // cell 5
                expect(gridCells[4].children[0].textContent).toBe("Automatically Detect Media Type");
                expect(gridCells[4].children[1].textContent).toBe("Automatically Detect Media Type");
            }

            //  authorization tab
            {
                authorizationsTab.click();
                await nextRunLoop();

                const contents = dialogHelper.searchChild<HTMLDivElement>({
                    class: "msg container fixedScrollbar content",
                });
                const gridCells = dialogHelper.searchChildren({ docRoot: contents, class: "gridCell" });

                expect(gridCells).toHaveLength(1);

                //  cell 1
                expect(gridCells[0].children[0].textContent).toBe("Custom Stored Procedure used for Authorization");
                expect(gridCells[0].children[1].firstElementChild?.textContent).toBe("");
            }

            //  opions tab
            {
                optionsTab.click();
                await nextRunLoop();

                const contents = dialogHelper.searchChild<HTMLDivElement>({
                    class: "msg container fixedScrollbar content",
                });
                const gridCells = dialogHelper.searchChildren({ docRoot: contents, class: "gridCell" });

                expect(gridCells).toHaveLength(2);

                //  cell 1
                expect(gridCells[0].children[0].textContent).toBe("Options");
                expect(gridCells[0].children[1].firstElementChild?.value).toBe("");
                expect(gridCells[0].children[2].textContent).toBe("Additional options in JSON format");

                //  cell 2
                expect(gridCells[1].children[0].textContent).toBe("Metadata");
                expect(gridCells[1].children[1].firstElementChild?.value).toBe("null");
                expect(gridCells[1].children[2].textContent).toBe("Metadata settings in JSON format");
            }

            await dialogHelper.clickCancel();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("Dialog error testing [table]", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            backend.mrs.updateDbObject = (dbObjectId: string, dbObjectName: string, requestPath: string,
                schemaId: string, value: IShellMrsUpdateDbObjectKwargsValue): Promise<void> => {
                // verify data here...
                expect(dbObjectName).toBe("actor");
                expect(requestPath).toBe("/actor");

                expect(value).toMatchObject({
                    name: "actor",
                    dbSchemaId: schemaId,
                    requestPath: "/SomePath",
                    requiresAuth: false,
                    autoDetectMediaType: false,
                    enabled: true,
                    itemsPerPage: null,
                    comments: "",
                    mediaType: null,
                    authStoredProcedure: null,
                    crudOperations: [
                        "READ",
                    ],
                    crudOperationFormat: "FEED",
                    options: null,
                    objects: [
                        {
                            // id: the returned id
                            dbObjectId,
                            name: "MyServiceMrsTestActor",
                            position: 0,
                            kind: "RESULT",
                            sdkOptions: {
                                languageOptions: [{
                                    language: MrsSdkLanguage.TypeScript,
                                }],
                            },
                            comments: undefined,
                            fields: [
                                {
                                    // id: the returned id
                                    // objectId: the returned objectId
                                    representsReferenceId: undefined,
                                    parentReferenceId: undefined,
                                    name: "actorId",
                                    position: 1,
                                    dbColumn: {
                                        comment: "",
                                        datatype: "int",
                                        idGeneration: null,
                                        isGenerated: false,
                                        isPrimary: true,
                                        isUnique: false,
                                        name: "actor_id",
                                        notNull: true,
                                        srid: null,
                                    },
                                    storedDbColumn: undefined,
                                    enabled: true,
                                    allowFiltering: true,
                                    allowSorting: true,
                                    noCheck: false,
                                    noUpdate: false,
                                    sdkOptions: {
                                        languageOptions: [{
                                            language: MrsSdkLanguage.TypeScript,
                                        }],
                                    },
                                    comments: undefined,
                                    objectReference: undefined,
                                },
                                {
                                    // id: the returned id
                                    // objectId: the returned objectId
                                    representsReferenceId: undefined,
                                    parentReferenceId: undefined,
                                    name: "firstName",
                                    position: 2,
                                    dbColumn: {
                                        comment: "",
                                        datatype: "varchar(45)",
                                        idGeneration: null,
                                        isGenerated: false,
                                        isPrimary: false,
                                        isUnique: false,
                                        name: "first_name",
                                        notNull: true,
                                        srid: null,
                                    },
                                    storedDbColumn: undefined,
                                    enabled: true,
                                    allowFiltering: true,
                                    allowSorting: false,
                                    noCheck: false,
                                    noUpdate: false,
                                    sdkOptions: {
                                        languageOptions: [{
                                            language: MrsSdkLanguage.TypeScript,
                                        }],
                                    },
                                    comments: undefined,
                                    objectReference: undefined,
                                },
                                {
                                    // id: the returned id
                                    // objectId: the returned objectId
                                    representsReferenceId: undefined,
                                    parentReferenceId: undefined,
                                    name: "lastName",
                                    position: 3,
                                    dbColumn: {
                                        comment: "",
                                        datatype: "varchar(45)",
                                        idGeneration: null,
                                        isGenerated: false,
                                        isPrimary: false,
                                        isUnique: false,
                                        name: "last_name",
                                        notNull: true,
                                        srid: null,
                                    },
                                    storedDbColumn: undefined,
                                    enabled: true,
                                    allowFiltering: true,
                                    allowSorting: false,
                                    noCheck: false,
                                    noUpdate: false,
                                    sdkOptions: {
                                        languageOptions: [{
                                            language: MrsSdkLanguage.TypeScript,
                                        }],
                                    },
                                    comments: undefined,
                                    objectReference: undefined,
                                },
                                {
                                    // id: the returned id
                                    // objectId: the returned objectId
                                    representsReferenceId: undefined,
                                    parentReferenceId: undefined,
                                    name: "lastUpdate",
                                    position: 4,
                                    dbColumn: {
                                        comment: "",
                                        datatype: "timestamp",
                                        idGeneration: null,
                                        isGenerated: false,
                                        isPrimary: false,
                                        isUnique: false,
                                        name: "last_update",
                                        notNull: true,
                                        srid: null,
                                    },
                                    storedDbColumn: undefined,
                                    enabled: true,
                                    allowFiltering: true,
                                    allowSorting: false,
                                    noCheck: false,
                                    noUpdate: false,
                                    sdkOptions: {
                                        languageOptions: [{
                                            language: MrsSdkLanguage.TypeScript,
                                        }],
                                    },
                                    comments: undefined,
                                    objectReference: undefined,
                                },
                            ],
                            storedFields: undefined,
                        },
                    ],
                });

                return Promise.resolve();
            };

            const title = "Enter Configuration Values for the New MySQL REST Object";
            const schemas = await backend.mrs.listSchemas();
            const dbObjects = await backend.mrs.listDbObjects(schemas[0].id);
            const dialogRequest: IMrsDbObjectEditRequest = {
                id: "mrsDbObjectDialog",
                title,
                dbObject: dbObjects[0],
                createObject: false,
            };

            const promise = hubRef.current!.showMrsDbObjectDialog(backend, dialogRequest);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            const [dataMappingTab, settingsTab, authorizationsTab, optionsTab]
                = dialogHelper.getTabItems(["Data Mapping", "Settings", "Authorization", "Options"]);

            dataMappingTab.click();
            await nextRunLoop();

            const table = dialogHelper.searchChild({
                class: "tabulator-table",
            });
            const cells = dialogHelper.searchChildren({
                class: "tabulator-row tabulator-row-odd firstItem tabulator-tree-level-0",
            });

            await dialogHelper.clickButton({ class: "msg button imageOnly sqlPreviewBtn" });

            const sqlText = dialogHelper.searchChild({
                class: "view-lines monaco-mouse-cursor-text",
            });
            const sqlTextLines = dialogHelper.searchChildren({
                class: "view-line",
            });

            expect(sqlTextLines.length).toBeGreaterThan(0);


            await dialogHelper.clickButton({ class: "msg button imageOnly sqlCopyBtn" });

            await dialogHelper.setInputText("requestPath", "");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The request path must not be empty."]);

            await dialogHelper.setInputText("requestPath", "SomePath");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The request path must start with '/'."]);

            await dialogHelper.setInputText("requestPath", "/SomePath");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("Dialog error testing [function]", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);

            backend.mrs.updateDbObject = (dbObjectId: string, dbObjectName: string, requestPath: string,
                schemaId: string, value: IShellMrsUpdateDbObjectKwargsValue): Promise<void> => {
                // verify data here...
                expect(dbObjectName).toBe("actor_count");
                expect(requestPath).toBe("/actor_count");

                expect(value).toMatchObject({
                    name: "actor_count",
                    dbSchemaId: schemaId,
                    requestPath: "/SomePath",
                    requiresAuth: false,
                    autoDetectMediaType: false,
                    enabled: true,
                    rowUserOwnershipEnforced: false,
                    rowUserOwnershipColumn: null,
                    itemsPerPage: null,
                    comments: "",
                    mediaType: null,
                    authStoredProcedure: null,
                    crudOperations: [
                        "READ",
                    ],
                    crudOperationFormat: "FEED",
                    options: null,
                    objects: [
                        {
                            // id: the returned id
                            dbObjectId,
                            name: "MyServiceMrsTestActor",
                            position: 0,
                            kind: "RESULT",
                            sdkOptions: {
                                languageOptions: [{
                                    language: MrsSdkLanguage.TypeScript,
                                }],
                            },
                            comments: undefined,
                            fields: [
                                {
                                    // id: the returned id
                                    // objectId: the returned objectId
                                    representsReferenceId: undefined,
                                    parentReferenceId: undefined,
                                    name: "actorId",
                                    position: 1,
                                    dbColumn: {
                                        comment: "",
                                        datatype: "int",
                                        idGeneration: null,
                                        isGenerated: false,
                                        isPrimary: true,
                                        isUnique: false,
                                        name: "actor_id",
                                        notNull: true,
                                        srid: null,
                                    },
                                    storedDbColumn: undefined,
                                    enabled: true,
                                    allowFiltering: true,
                                    allowSorting: true,
                                    noCheck: false,
                                    noUpdate: false,
                                    sdkOptions: {
                                        languageOptions: [{
                                            language: MrsSdkLanguage.TypeScript,
                                        }],
                                    },
                                    comments: undefined,
                                    objectReference: undefined,
                                },
                                {
                                    // id: the returned id
                                    // objectId: the returned objectId
                                    representsReferenceId: undefined,
                                    parentReferenceId: undefined,
                                    name: "firstName",
                                    position: 2,
                                    dbColumn: {
                                        comment: "",
                                        datatype: "varchar(45)",
                                        idGeneration: null,
                                        isGenerated: false,
                                        isPrimary: false,
                                        isUnique: false,
                                        name: "first_name",
                                        notNull: true,
                                        srid: null,
                                    },
                                    storedDbColumn: undefined,
                                    enabled: true,
                                    allowFiltering: true,
                                    allowSorting: false,
                                    noCheck: false,
                                    noUpdate: false,
                                    sdkOptions: {
                                        languageOptions: [{
                                            language: MrsSdkLanguage.TypeScript,
                                        }],
                                    },
                                    comments: undefined,
                                    objectReference: undefined,
                                },
                                {
                                    // id: the returned id
                                    // objectId: the returned objectId
                                    representsReferenceId: undefined,
                                    parentReferenceId: undefined,
                                    name: "lastName",
                                    position: 3,
                                    dbColumn: {
                                        comment: "",
                                        datatype: "varchar(45)",
                                        idGeneration: null,
                                        isGenerated: false,
                                        isPrimary: false,
                                        isUnique: false,
                                        name: "last_name",
                                        notNull: true,
                                        srid: null,
                                    },
                                    storedDbColumn: undefined,
                                    enabled: true,
                                    allowFiltering: true,
                                    allowSorting: false,
                                    noCheck: false,
                                    noUpdate: false,
                                    sdkOptions: {
                                        languageOptions: [{
                                            language: MrsSdkLanguage.TypeScript,
                                        }],
                                    },
                                    comments: undefined,
                                    objectReference: undefined,
                                },
                                {
                                    // id: the returned id
                                    // objectId: the returned objectId
                                    representsReferenceId: undefined,
                                    parentReferenceId: undefined,
                                    name: "lastUpdate",
                                    position: 4,
                                    dbColumn: {
                                        comment: "",
                                        datatype: "timestamp",
                                        idGeneration: null,
                                        isGenerated: false,
                                        isPrimary: false,
                                        isUnique: false,
                                        name: "last_update",
                                        notNull: true,
                                        srid: null,
                                    },
                                    storedDbColumn: undefined,
                                    enabled: true,
                                    allowFiltering: true,
                                    allowSorting: false,
                                    noCheck: false,
                                    noUpdate: false,
                                    sdkOptions: {
                                        languageOptions: [{
                                            language: MrsSdkLanguage.TypeScript,
                                        }],
                                    },
                                    comments: undefined,
                                    objectReference: undefined,
                                },
                            ],
                            storedFields: undefined,
                        },
                    ],
                });

                return Promise.resolve();
            };

            const title = "Enter Configuration Values for the New MySQL REST Object";
            const schemas = await backend.mrs.listSchemas();
            const dbObjects = await backend.mrs.listDbObjects(schemas[0].id);
            const dialogRequest: IMrsDbObjectEditRequest = {
                id: "mrsDbObjectDialog",
                title,
                dbObject: dbObjects[0],
                createObject: false,
            };

            const promise = hubRef.current!.showMrsDbObjectDialog(backend, dialogRequest);
            await dialogHelper.waitForDialog();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            await dialogHelper.setInputText("requestPath", "");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The request path must not be empty."]);

            await dialogHelper.setInputText("requestPath", "SomePath");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The request path must start with '/'."]);

            await dialogHelper.setInputText("requestPath", "/SomePath");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

    });

    describe("MRS Object field editor tests", () => {
        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsDbObjectDialog", "MySQL REST Object");
        });


        it("MrsObjectFieldEditor updateMrsObjectFields tests", async () => {
            const mountResult = await doMount();

            mountResult.backend.mrs.getDbFunctionReturnType =
                async (dbObjectName: string, dbSchemaName: string): Promise<string> => {
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

            dialogHelper = new DialogHelper("mrsObjectFieldEditor");

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

            // const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

            // portals = document.getElementsByClassName("portal");

            // expect(portals).toHaveLength(1);

            // await dialogHelper.setInputText("name", "New Name");
            // await dialogHelper.clickOk();

            // dialogHelper.verifyErrors();

            // await promise;
            mountResult.fieldEditorMount.unmount();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(0);
        });

        it("MrsObjectFieldEditor init tests", async () => {
            backend.mrs.getDbFunctionReturnType =
                async (dbObjectName: string, dbSchemaName: string): Promise<string> => {
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

            host = fieldEditor["treeGridJsonColumnFormatter"](new MockCellComponent() as CellComponent);

            expect(host).toBeInstanceOf(HTMLElement);
            // TODO: make more tests in host

            const cellData = createCellData();
            cellData.type = MrsObjectFieldTreeEntryType.DeletedField;

            host = fieldEditor["treeGridJsonColumnFormatter"](new MockCellComponent(cellData) as CellComponent);

            expect(host).toBeInstanceOf(HTMLElement);
            // TODO: make more tests in host

            cellData.type = MrsObjectFieldTreeEntryType.FieldListClose;

            host = fieldEditor["treeGridJsonColumnFormatter"](new MockCellComponent(cellData) as CellComponent);

            expect(host).toBeInstanceOf(HTMLElement);
            // TODO: make more tests in host

            cellData.type = MrsObjectFieldTreeEntryType.FieldListOpen;

            host = fieldEditor["treeGridJsonColumnFormatter"](new MockCellComponent(cellData) as CellComponent);

            expect(host).toBeInstanceOf(HTMLElement);
            // TODO: make more tests in host

            cellData.type = MrsObjectFieldTreeEntryType.LoadPlaceholder;

            host = fieldEditor["treeGridJsonColumnFormatter"](new MockCellComponent(cellData) as CellComponent);

            const cell = new MockCellComponent(cellData);
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
            const mockCellComponent = new MockCellComponent(cellData);
            mockCellComponent.data = createTreeItemData();
            mockCellComponent.row.prevRow = new RowComponentMock();


            fieldEditor["treeGridRelationalColumnFormatter"](mockCellComponent as CellComponent);

            // eslint-disable-next-line no-lone-blocks
            {
                cellData.type = MrsObjectFieldTreeEntryType.DeletedField;

                fieldEditor["treeGridRelationalColumnFormatter"](new MockCellComponent(cellData) as CellComponent);

                cellData.field.objectReference.referenceMapping.kind = "n:1";

                fieldEditor["treeGridRelationalColumnFormatter"](new MockCellComponent(cellData) as CellComponent);

                cellData.field.objectReference.referenceMapping.kind = "1:1";

                fieldEditor["treeGridRelationalColumnFormatter"](new MockCellComponent(cellData) as CellComponent);

                const objectReferenceBackup = cellData.field.objectReference;

                cellData.field.objectReference = undefined;

                fieldEditor["treeGridRelationalColumnFormatter"](new MockCellComponent(cellData) as CellComponent);

                cellData.field.objectReference = objectReferenceBackup;
            }

            cellData.type = MrsObjectFieldTreeEntryType.FieldListClose;

            fieldEditor["treeGridRelationalColumnFormatter"](new MockCellComponent(cellData) as CellComponent);

            cellData.type = MrsObjectFieldTreeEntryType.FieldListOpen;

            fieldEditor["treeGridRelationalColumnFormatter"](new MockCellComponent(cellData) as CellComponent);

            // eslint-disable-next-line no-lone-blocks
            {
                //  test for different dbObject types
                mountResult.values.dbObject.objectType = MrsDbObjectType.View;

                fieldEditor["treeGridRelationalColumnFormatter"](new MockCellComponent(cellData) as CellComponent);

                mountResult.values.dbObject.objectType = MrsDbObjectType.Procedure;

                fieldEditor["treeGridRelationalColumnFormatter"](new MockCellComponent(cellData) as CellComponent);

                mountResult.values.dbObject.objectType = MrsDbObjectType.Function;

                fieldEditor["treeGridRelationalColumnFormatter"](new MockCellComponent(cellData) as CellComponent);
            }

            cellData.type = MrsObjectFieldTreeEntryType.LoadPlaceholder;

            fieldEditor["treeGridRelationalColumnFormatter"](new MockCellComponent(cellData) as CellComponent);
        });

        it("MrsObjectFieldEditor.editorHost tests", async () => {
            const mountResult = await doMount(createFieldEditorMountValuesEmptyData());
            const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

            const cellData = createCellData();
            cellData.type = MrsObjectFieldTreeEntryType.DeletedField;
            const cell = new MockCellComponent(cellData);


            fieldEditor["editorHost"](cell, () => { }, (): boolean => { return true; }, () => { });
        });

        it("MrsObjectFieldEditor.renderCustomEditor tests", async () => {
            const mountResult = await doMount();
            const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

            const cellData = createCellData();
            cellData.type = MrsObjectFieldTreeEntryType.DeletedField;
            const cell = new MockCellComponent(cellData);

            const host = document.createElement("div");


            fieldEditor["renderCustomEditor"](cell, () => { }, host, {},
                (): boolean => { return true; }, () => { });

        });

        it("MrsObjectFieldEditor.handleCellEdited tests", async () => {
            const handleDbObjectChange = () => { };
            const handleGetCurrentDbObject = (): IMrsDbObjectData => {
                return createDbObjectData();
            };

            const cellData = createCellData();
            cellData.type = MrsObjectFieldTreeEntryType.FieldListOpen;
            cellData.field.id = "";
            cellData.field.name = "field name";
            const cell1 = new MockCellComponent(cellData);

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
                const tempCell = new MockCellComponent(cell2Data);
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
                const tempCell = new MockCellComponent(cell2Data);
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
                const tempCell = new MockCellComponent(cell2Data);
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
                const tempCell = new MockCellComponent(cell2Data);
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
                const tempCell = new MockCellComponent(cell2Data);
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

            const tempObjectReference: object = treeItem.field.objectReference;
            delete tempObjectReference["reduceToValueOfFieldId" as keyof object];

            // eslint-disable-next-line no-lone-blocks
            {

                await fieldEditor["performIconClick"](treeItem, 0);

                await fieldEditor["performIconClick"](treeItem, 0, "icon1"); // ActionIconName.Crud

                await fieldEditor["performIconClick"](treeItem, 0, "INSERT"); // ActionIconName.Crud

                await fieldEditor["performIconClick"](treeItem, 0, "UPDATE"); // ActionIconName.Crud

                await fieldEditor["performIconClick"](treeItem, 0, "DELETE"); // ActionIconName.Crud

                const optionsBackup = mountResult.values.mrsObjects[1].options;
                mountResult.values.mrsObjects[1].options = undefined;
                const treeItemOptionsBackup = treeItem.field.objectReference.options;
                treeItem.field.objectReference.options = undefined;

                await fieldEditor["performIconClick"](treeItem, 0, "DELETE"); // ActionIconName.Crud

                treeItem.field.representsReferenceId = undefined;

                await fieldEditor["performIconClick"](treeItem, 0, "DELETE"); // ActionIconName.Crud
                mountResult.values.mrsObjects[1].options = optionsBackup;
                treeItem.field.representsReferenceId = "";
            }


            await fieldEditor["performIconClick"](treeItem, 1, ""); // ActionIconName.Unnest

            await fieldEditor["performIconClick"](treeItem, 2, ""); // ActionIconName.Ownership

            await fieldEditor["performIconClick"](treeItem, 3, ""); // ActionIconName.Filtering

            await fieldEditor["performIconClick"](treeItem, 4, ""); // ActionIconName.Sorting

            await fieldEditor["performIconClick"](treeItem, 5, ""); // ActionIconName.Update

            // eslint-disable-next-line no-lone-blocks
            {
                treeItem.field.objectReference.options = undefined;

                await fieldEditor["performIconClick"](treeItem, 6, ""); // ActionIconName.Check

                treeItem.field.dbColumn = undefined;
                mountResult.values.mrsObjects[1].options = undefined;

                await fieldEditor["performIconClick"](treeItem, 6, ""); // ActionIconName.Check
            }

            await fieldEditor["performIconClick"](treeItem, 7, ""); // ActionIconName.CheckAll

            treeItem.expanded = true;
            const tempField: object = treeItem.children[0].field;

            delete tempField["objectReference" as keyof object];

            await fieldEditor["performIconClick"](treeItem, 8, ""); // ActionIconName.CheckNone

            await fieldEditor["performIconClick"](treeItem, 9, ""); // ActionIconName.Delete
        });

        it("MrsObjectFieldEditor.handleIconClick tests", async () => {
            const mountResult = await doMount();
            const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

            const cell = new MockCellComponent(createCellData());

            fieldEditor["handleIconClick"](cell, 0, "icon1"); // ActionIconName.Crud
        });

        it("MrsObjectFieldEditor.treeGridToggleEnableState tests", async () => {
            const mountResult = await doMount();
            const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

            const cell = createCellData();

            mountResult.values.currentTreeItems[0].field.enabled = false;
            // values.currentTreeItems[0].field.objectReference = {};

            fieldEditor["treeGridToggleEnableState"](new Event("treeGridToggleEnableState_Event"),
                new MockCellComponent(cell));

            mountResult.values.currentTreeItems[0].field.enabled = true;
            mountResult.values.currentTreeItems[0].field.objectReference = {
                reduceToValueOfFieldId: "",
            };

            fieldEditor["treeGridToggleEnableState"](new Event("treeGridToggleEnableState_Event"),
                new MockCellComponent(cell));
        });

        it("MrsObjectFieldEditor.handleRowExpanded tests", async () => {
            const mountResult = await doMount();
            const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

            const cell = createCellData();
            const row: RowComponent = new MockCellComponent(cell).getRow();


            fieldEditor["handleRowExpanded"](row);

            (row as RowComponentMock).row.field.objectReference!.unnest = true;

            fieldEditor["handleRowExpanded"](row);
        });

        it("MrsObjectFieldEditor.handleRowCollapsed tests", async () => {
            const mountResult = await doMount();
            const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

            const cell = createCellData();
            const row = new MockCellComponent(cell).getRow();

            fieldEditor["handleRowCollapsed"](row);
        });

        it("MrsObjectFieldEditor.isRowExpanded tests", async () => {
            const mountResult = await doMount();
            const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

            const cell = createCellData();
            const row = new MockCellComponent(cell).getRow();

            fieldEditor["isRowExpanded"](row);

            (row as RowComponentMock).row.expanded = true;

            fieldEditor["isRowExpanded"](row);
        });

        it("MrsObjectFieldEditor.addNewField tests", async () => {
            const mountResult = await doMount();
            const fieldEditor: MrsObjectFieldEditor = mountResult.fieldEditor;

            const cell = createCellData();
            const row = new MockCellComponent(cell).getRow();

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
                // sdkOptions?: IMrsObjectSdkOptions,
                // comments?: string,
                // fields?: IMrsObjectFieldWithReference[],
                // storedFields?: IMrsObjectFieldWithReference[],
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

            const host = document.createElement("div");

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
                // sdkOptions?: IMrsObjectSdkOptions,
                // comments?: string,
                // fields?: IMrsObjectFieldWithReference[],
                // storedFields?: IMrsObjectFieldWithReference[],
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
            // storedFields[0].dbColumn.name = "actor_id";

            await fieldEditor["addColumnsAsFields"](
                "actor",
                "MRS_TEST",
                "VIEW",
                storedFields, //IMrsObjectFieldWithReference[]
                currentMrsObject, //currentObject
                [], //parentTreeItemList
                [], //referredTreeItemsToLoad
            );

            columnWithReference.referenceMapping = undefined;

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

            mountResult.backend.mrs.getDbObjectParameters = (dbObjectName?: string,
                dbSchemaName?: string, dbObjectId?: string, dbType?: string): Promise<IMrsDbObjectParameterData[]> => {
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
                // sdkOptions?: IMrsObjectSdkOptions,
                // comments?: string,
                // fields?: IMrsObjectFieldWithReference[],
                // storedFields?: IMrsObjectFieldWithReference[],
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

            mountResult.values.mrsObjects[1].fields[0].options = {
                dualityViewUpdate: false,
            };
            mountResult.values.mrsObjects[1].options.dualityViewUpdate = false;
            mountResult.values.mrsObjects[1].fields[0].objectReference = {
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
                // unnest: true,
                // crudOperations: ["READ", "UPDATE", "CREATE", "DELETE"],
                // sdkOptions?: IMrsObjectReferenceSdkOptions,
                // comments?: string,
                // }, //IMrsObjectReference,
                // lev?: number,
                // caption?: string,
                // storedDbColumn?: IMrsTableColumn,
            };

            fieldEditor["updateDbObjectCrudOperations"]();

            mountResult.values.dbObject.objectType = MrsDbObjectType.Function;

            fieldEditor["updateDbObjectCrudOperations"]();
        });
    });
});
