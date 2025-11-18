/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import { render, waitFor } from "@testing-library/preact";
import { createRef } from "preact";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { registerUiLayer } from "../../../../../app-logic/UILayer.js";
import {
    IJdvObjectFieldWithReference, IJdvTableColumn, IJdvTableReference, IJdvViewInfo
} from "../../../../../communication/ProtocolGui.js";
import {
    IJdvObjectFieldEditorData, IJdvObjectFieldTreeItem, JdvObjectFieldEditor, JdvObjectFieldTreeEntryType,
    JdvObjectFieldValidatorType,
} from "../../../../../modules/jdv/dialogs/JdvObjectFieldEditor.js";
import { ShellInterfaceSqlEditor } from "../../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { MySQLShellLauncher } from "../../../../../utilities/MySQLShellLauncher.js";
import { uiLayerMock } from "../../../__mocks__/UILayerMock.js";
import { createBackend, createJdvData, normalizeWhitespace, setupShellForTests, } from "../../../test-helpers.js";

// @ts-expect-error, we need access to a private members here.
class JdvObjectFieldEditorMock extends JdvObjectFieldEditor {
    declare public validateJdvObjectFieldTreeItem: (treeItem: IJdvObjectFieldTreeItem,
        validationTypes?: JdvObjectFieldValidatorType[]) => Promise<void>;
}

describe("JDV Object field editor tests", () => {
    let launcher: MySQLShellLauncher;
    let backend: ShellInterfaceSqlEditor;

    const createEmptyJdvViewInfoObject = (): IJdvViewInfo => {
        return {
            id: "",
            name: "jdv1",
            schema: "schema",
            rootTableName: "table1",
            rootTableSchema: "schema",
        };
    };

    const createEmptyFieldEditorMountValuesData = (): IJdvObjectFieldEditorData => {
        return {
            jdvSchema: "schema",
            defaultJdvName: "jdv1",
            createView: true,
            jdvViewInfo: createEmptyJdvViewInfoObject(),
            jdvObjects: [],
            rootJdvObjectId: undefined,
            currentTreeItems: [],
        };
    };

    const createColumnTreeItem = (keyname?: string, dbColumn?: IJdvTableColumn,
        parent?: IJdvObjectFieldTreeItem): IJdvObjectFieldTreeItem => {
        return {
            type: JdvObjectFieldTreeEntryType.Field,
            expanded: false,
            expandedOnce: false,
            field: {
                fieldId: "",
                parentReferenceId: "0",
                jsonKeyname: keyname ?? "jsonKeyname1",
                dbName: dbColumn?.dbName ?? "col1",
                position: 1,
                dbColumn: dbColumn ?? {
                    dbName: "col1",
                    datatype: "string",
                    isPrimary: false,
                    isGenerated: false,
                    notNull: false,
                },
                lev: 2,
                selected: false,
            },
            parent,
            validators: new Map(),
        };
    };

    const createReferenceTreeItem = (keyname?: string, objectReferenceId?: string,
        objectReference?: IJdvTableReference,
        parent?: IJdvObjectFieldTreeItem): IJdvObjectFieldTreeItem => {
        return {
            type: JdvObjectFieldTreeEntryType.Field,
            expanded: false,
            expandedOnce: false,
            field: {
                fieldId: "",
                parentReferenceId: "",
                jsonKeyname: keyname ?? "jsonKeyname1",
                dbName: objectReference?.referencedTable ?? "table1",
                position: 1,
                objectReferenceId: objectReferenceId ?? "1",
                objectReference: objectReference ?? {
                    kind: "1:n",
                    baseColumn: "pk",
                    referencedColumn: "fk1",
                    referencedTable: "table1",
                    referencedSchema: "schema",
                },
                lev: 2,
                selected: false,
            },
            parent,
            validators: new Map(),
        };
    };

    const createJdvExampleDDL = (): string => {
        return "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW jdv_test.customer_orders_jdv AS\n" +
            "SELECT\n" +
            "JSON_DUALITY_OBJECT(\n" +
            "    '_id'       : id,\n" +
            "    'user'      : username,\n" +
            "    'purchases' : (\n" +
            "        SELECT JSON_ARRAYAGG(\n" +
            "            JSON_DUALITY_OBJECT(\n" +
            "            WITH(INSERT, UPDATE, DELETE)\n" +
            "                'order_id'        : id\n" +
            "            )  ABSENT ON NULL\n" +
            "        )\n" +
            "        FROM jdv_test.order\n" +
            "        WHERE jdv_test.customer.id = jdv_test.order.customer_id\n" +
            "    )\n" +
            ")\n" +
            "FROM jdv_test.customer;";
    };

    const createJdvExampleStoredFields = (jdvObjectId: string): IJdvObjectFieldWithReference[] => {
        if (jdvObjectId === "0") {
            return [
                {
                    "dbName": "id",
                    "fieldId": "",
                    "jsonKeyname": "_id",
                    "objectReferenceId": undefined,
                    "parentReferenceId": "0",
                    "position": 0,
                    "lev": 1,
                    "selected": true,
                },
                {
                    "dbName": "username",
                    "fieldId": "",
                    "jsonKeyname": "user",
                    "objectReferenceId": undefined,
                    "parentReferenceId": "0",
                    "position": 0,
                    "lev": 1,
                    "selected": true,
                },
                {
                    "dbName": "jdv_test.order",
                    "fieldId": "",
                    "jsonKeyname": "purchases",
                    "objectReference": {
                        "baseColumn": "id",
                        "kind": "1:n",
                        "referencedColumn": "customer_id",
                        "referencedSchema": "jdv_test",
                        "referencedTable": "order",
                    },
                    "objectReferenceId": "1",
                    "options": {
                        "dataMappingViewDelete": true,
                        "dataMappingViewInsert": true,
                        "dataMappingViewUpdate": true,
                    },
                    "parentReferenceId": "0",
                    "position": 1,
                    "lev": 1,
                    "selected": true,
                },
            ];
        } else if (jdvObjectId === "1") {
            return [
                {
                    "dbName": "id",
                    "fieldId": "",
                    "jsonKeyname": "order_id",
                    "objectReferenceId": undefined,
                    "parentReferenceId": "1",
                    "position": 0,
                    "lev": 2,
                    "selected": true,
                }
            ];
        } else {
            return [];
        }
    };

    const createJdvExampleFieldEditorValuesData = (): IJdvObjectFieldEditorData => {
        return {
            createView: false,
            currentTreeItems: [
                {
                    expanded: false,
                    expandedOnce: false,
                    field: {
                        dbName: "jdv_test.customer",
                        fieldId: "",
                        jsonKeyname: "customer",
                        lev: 1,
                        position: 0,
                        selected: false
                    },
                    firstItem: true,
                    type: JdvObjectFieldTreeEntryType.FieldListOpen,
                    validators: new Map()
                },
                {
                    expanded: false,
                    expandedOnce: false,
                    field: {
                        dbColumn: {
                            datatype: "int",
                            dbName: "id",
                            isGenerated: false,
                            isPrimary: true,
                            notNull: true
                        },
                        dbName: "id",
                        fieldId: "",
                        jsonKeyname: "_id",
                        lev: 1,
                        parentReferenceId: "0",
                        position: 1,
                        selected: true
                    },
                    type: JdvObjectFieldTreeEntryType.Field,
                    validators: new Map([
                        [
                            JdvObjectFieldValidatorType.Column,
                            {
                                message: "Primary key should always be selected.",
                                unsupported: true
                            }
                        ]
                    ])
                },
                {
                    expanded: false,
                    expandedOnce: false,
                    field: {
                        dbColumn: {
                            datatype: "varchar(50)",
                            dbName: "username",
                            isGenerated: false,
                            isPrimary: false,
                            notNull: true
                        },
                        dbName: "username",
                        fieldId: "",
                        jsonKeyname: "user",
                        lev: 1,
                        parentReferenceId: "0",
                        position: 2,
                        selected: true
                    },
                    type: JdvObjectFieldTreeEntryType.Field,
                    validators: new Map()
                },
                // Nested structure for purchases
                {
                    children: [
                        {
                            expanded: false,
                            expandedOnce: false,
                            field: {
                                dbName: "jdv_test.order",
                                dbReference: {
                                    baseColumn: "id",
                                    kind: "1:n",
                                    referencedColumn: "customer_id",
                                    referencedSchema: "jdv_test",
                                    referencedTable: "order"
                                },
                                fieldId: "",
                                jsonKeyname: "order",
                                lev: 2,
                                objectReference: {
                                    baseColumn: "id",
                                    kind: "1:n",
                                    referencedColumn: "customer_id",
                                    referencedSchema: "jdv_test",
                                    referencedTable: "order"
                                },
                                objectReferenceId: "1",
                                position: 0,
                                selected: false
                            },
                            firstItem: true,
                            type: JdvObjectFieldTreeEntryType.FieldListOpen,
                            validators: new Map()
                        },
                        {
                            expanded: false,
                            expandedOnce: false,
                            field: {
                                dbColumn: {
                                    datatype: "int",
                                    dbName: "id",
                                    isGenerated: false,
                                    isPrimary: true,
                                    notNull: true
                                },
                                dbName: "id",
                                fieldId: "",
                                jsonKeyname: "order_id",
                                lev: 2,
                                parentReferenceId: "1",
                                position: 1,
                                selected: true
                            },
                            type: JdvObjectFieldTreeEntryType.Field,
                            validators: new Map([
                                [
                                    JdvObjectFieldValidatorType.Column,
                                    {
                                        message: "Primary key should always be selected.",
                                        unsupported: true
                                    }
                                ]
                            ])
                        },
                        {
                            expanded: false,
                            expandedOnce: false,
                            field: {
                                dbColumn: {
                                    datatype: "int",
                                    dbName: "customer_id",
                                    isGenerated: false,
                                    isPrimary: false,
                                    notNull: true
                                },
                                dbName: "customer_id",
                                fieldId: "",
                                jsonKeyname: "customer_id",
                                lev: 2,
                                parentReferenceId: "1",
                                position: 2,
                                selected: false
                            },
                            type: JdvObjectFieldTreeEntryType.Field,
                            validators: new Map()
                        },
                        {
                            children: [
                                {
                                    expanded: false,
                                    expandedOnce: false,
                                    field: {
                                        dbName: "",
                                        fieldId: "",
                                        jsonKeyname: "Loading...",
                                        lev: 0,
                                        position: 1,
                                        selected: false,
                                    },
                                    type: JdvObjectFieldTreeEntryType.LoadPlaceholder,
                                    validators: new Map()
                                }
                            ],
                            expanded: false,
                            expandedOnce: false,
                            field: {
                                dbName: "jdv_test.customer",
                                dbReference: {
                                    baseColumn: "customer_id",
                                    kind: "n:1",
                                    referencedColumn: "id",
                                    referencedSchema: "jdv_test",
                                    referencedTable: "customer"
                                },
                                fieldId: "",
                                jsonKeyname: "customer",
                                lev: 2,
                                objectReference: {
                                    baseColumn: "customer_id",
                                    kind: "n:1",
                                    referencedColumn: "id",
                                    referencedSchema: "jdv_test",
                                    referencedTable: "customer"
                                },
                                objectReferenceId: "9FZiEkztTtvWNVfD/sRdbQ==",
                                parentReferenceId: "1",
                                position: 1001,
                                selected: false
                            },
                            type: JdvObjectFieldTreeEntryType.Field,
                            validators: new Map()
                        },
                        {
                            expanded: false,
                            expandedOnce: false,
                            field: {
                                dbName: "jdv_test.order",
                                dbReference: {
                                    baseColumn: "id",
                                    kind: "1:n",
                                    referencedColumn: "customer_id",
                                    referencedSchema: "jdv_test",
                                    referencedTable: "order"
                                },
                                fieldId: "",
                                jsonKeyname: "order",
                                lev: 2,
                                objectReference: {
                                    baseColumn: "id",
                                    kind: "1:n",
                                    referencedColumn: "customer_id",
                                    referencedSchema: "jdv_test",
                                    referencedTable: "order"
                                },
                                objectReferenceId: "1",
                                position: 0,
                                selected: false
                            },
                            lastItem: true,
                            type: JdvObjectFieldTreeEntryType.FieldListClose,
                            validators: new Map()
                        }
                    ],
                    expanded: true,
                    expandedOnce: true,
                    field: {
                        dbName: "jdv_test.order",
                        dbReference: {
                            baseColumn: "id",
                            kind: "1:n",
                            referencedColumn: "customer_id",
                            referencedSchema: "jdv_test",
                            referencedTable: "order"
                        },
                        fieldId: "",
                        jsonKeyname: "purchases",
                        lev: 1,
                        objectReference: {
                            baseColumn: "id",
                            kind: "1:n",
                            referencedColumn: "customer_id",
                            referencedSchema: "jdv_test",
                            referencedTable: "order"
                        },
                        objectReferenceId: "1",
                        options: {
                            dataMappingViewDelete: true,
                            dataMappingViewInsert: true,
                            dataMappingViewUpdate: true,
                        },
                        parentReferenceId: "0",
                        position: 2001,
                        selected: true
                    },
                    type: JdvObjectFieldTreeEntryType.Field,
                    validators: new Map()
                },
                {
                    expanded: false,
                    expandedOnce: false,
                    field: {
                        dbName: "jdv_test.customer",
                        fieldId: "",
                        jsonKeyname: "customer",
                        lev: 1,
                        position: 0,
                        selected: false
                    },
                    lastItem: true,
                    type: JdvObjectFieldTreeEntryType.FieldListClose,
                    validators: new Map()
                }
            ],
            defaultJdvName: "customer_orders_jdv",
            jdvObjects: [
                {
                    id: "0",
                    isRoot: true,
                    options: {
                        dataMappingViewDelete: false,
                        dataMappingViewInsert: false,
                        dataMappingViewUpdate: false,
                    },
                    schema: "jdv_test",
                    table: "customer"
                },
                {
                    id: "1",
                    isRoot: false,
                    options: {
                        dataMappingViewDelete: true,
                        dataMappingViewInsert: true,
                        dataMappingViewUpdate: true,
                    },
                    schema: "jdv_test",
                    table: "order"
                }
            ],
            jdvSchema: "jdv_test",
            jdvViewInfo: {
                id: "",
                name: "customer_orders_jdv",
                objects: [
                    {
                        id: "0",
                        isRoot: true,
                        options: {
                            dataMappingViewDelete: false,
                            dataMappingViewInsert: false,
                            dataMappingViewUpdate: false,
                        },
                        schema: "jdv_test",
                        table: "customer"
                    },
                    {
                        id: "1",
                        isRoot: false,
                        options: {
                            dataMappingViewDelete: true,
                            dataMappingViewInsert: true,
                            dataMappingViewUpdate: true,
                        },
                        schema: "jdv_test",
                        table: "order"
                    }
                ],
                rootTableName: "customer",
                rootTableSchema: "jdv_test",
                schema: "jdv_test"
            },
            rootJdvObjectId: "0"
        };
    };

    const doMount = async (values?: IDictionary,
        backend?: ShellInterfaceSqlEditor,
        schemasWithTables?: Record<string, string[]>,
        getCurrentJdvInfoHandler?: () => IJdvViewInfo) => {

        getCurrentJdvInfoHandler ??= (): IJdvViewInfo => {
            return createEmptyJdvViewInfoObject();
        };
        values ??= createEmptyFieldEditorMountValuesData();
        backend ??= await createBackend();
        schemasWithTables ??= {};

        const editorRef = createRef<JdvObjectFieldEditorMock>();
        const { unmount } = render(<JdvObjectFieldEditorMock
            ref={editorRef}
            backend={backend}
            schemasWithTables={schemasWithTables}
            getCurrentJdvInfo={getCurrentJdvInfoHandler}
            values={values} />);

        // This is required because initMrsObjects is async and is called in the ctor
        // and the ctor can not be async.
        await waitFor(() => {
            const data = editorRef.current!.props.values as IJdvObjectFieldEditorData;
            const treeItems = data.currentTreeItems;
            expect(treeItems[treeItems.length - 1].lastItem).toBe(true);
        }, { timeout: 3000 });

        return { unmount, editorRef, values, backend };
    };

    beforeAll(async () => {
        registerUiLayer(uiLayerMock);
        launcher = await setupShellForTests(false, true, "DEBUG2");
    });

    afterAll(async () => {
        await backend.execute("DROP DATABASE IF EXISTS jdv_test");
        await backend.closeSession();
        await launcher.exitProcess();
    });

    beforeEach(async () => {
        backend = await createBackend();
        await backend.execute("DROP DATABASE IF EXISTS jdv_test");
        await backend.execute("CREATE DATABASE IF NOT EXISTS jdv_test");
    });

    it.skip("JdvObjectFieldEditor test fillTreeBasedOnJdvObjectFields [create JDV]", async () => {
        const schemasWithTables = await createJdvData(backend);
        const values: IJdvObjectFieldEditorData = {
            jdvSchema: "jdv_test",
            defaultJdvName: "customer_jdv",
            createView: true,
            jdvViewInfo: {
                id: "",
                name: "customer_jdv",
                schema: "jdv_test",
                rootTableName: "customer",
                rootTableSchema: "jdv_test",
            },
            jdvObjects: [],
            rootJdvObjectId: undefined,
            currentTreeItems: [],
        };
        const { unmount, editorRef } = await doMount(values, backend, schemasWithTables, () => {
            return values.jdvViewInfo;
        });

        const data = editorRef.current!.props.values as IJdvObjectFieldEditorData;
        expect(data.jdvObjects).toHaveLength(1);
        expect(data.currentTreeItems).toHaveLength(5);

        const columnItems = data.currentTreeItems.filter((item) => {
            return item.field.dbColumn;
        });
        expect(columnItems).toHaveLength(2);
        for (const columnItem of columnItems) {
            if (columnItem.field.dbColumn?.isPrimary) {
                expect(columnItem.field.selected).toBe(true);
                expect(columnItem.field.jsonKeyname).toEqual("_id");
                expect(columnItem.validators.get(JdvObjectFieldValidatorType.Column)).toBeDefined();
            } else {
                expect(columnItem.field.selected).toBe(false);
                expect(columnItem.field.jsonKeyname).toEqual(columnItem.field.dbColumn?.dbName);
            }
        }

        const referenceItems = data.currentTreeItems.filter((item) => {
            return item.field.objectReference;
        });
        expect(referenceItems).toHaveLength(1);
        expect(referenceItems[0].field.selected).toBe(false);
        expect(referenceItems[0].field.jsonKeyname).toEqual(referenceItems[0].field.objectReference?.referencedTable);
        expect(referenceItems[0].children).toHaveLength(1);

        unmount();
    });

    it.skip("JdvObjectFieldEditor test fillTreeBasedOnJdvObjectFields [edit JDV]", async () => {
        const schemasWithTables = await createJdvData(backend);
        const exampleDDL = createJdvExampleDDL();
        await backend.execute(exampleDDL);

        const jdvViewInfo = await backend.getJdvViewInfo("jdv_test", "customer_orders_jdv");
        if (jdvViewInfo.objects) {
            jdvViewInfo.objects[0].storedFields = createJdvExampleStoredFields("0");
            jdvViewInfo.objects[1].storedFields = createJdvExampleStoredFields("1");
        }

        const values: IJdvObjectFieldEditorData = {
            jdvSchema: jdvViewInfo.schema,
            defaultJdvName: jdvViewInfo.name,
            createView: false,
            jdvViewInfo: {
                id: "",
                name: jdvViewInfo.name,
                schema: jdvViewInfo.schema,
                rootTableName: jdvViewInfo.rootTableName,
                rootTableSchema: jdvViewInfo.rootTableSchema,
                objects: jdvViewInfo.objects,
            },
            jdvObjects: [],
            rootJdvObjectId: undefined,
            currentTreeItems: [],
        };
        const { unmount, editorRef } = await doMount(values, backend, schemasWithTables, () => {
            return values.jdvViewInfo;
        });

        const data = editorRef.current!.props.values as IJdvObjectFieldEditorData;
        expect(data.jdvObjects).toHaveLength(2);
        expect(data.currentTreeItems).toHaveLength(5);

        const usernameItem = data.currentTreeItems.find((item) => {
            return item.field.dbName === "username";
        });
        expect(usernameItem).toBeDefined();
        expect(usernameItem?.field.selected).toBe(true);
        expect(usernameItem?.field.jsonKeyname).toEqual("user");

        const orderItem = data.currentTreeItems.find((item) => {
            return item.field.dbName === "jdv_test.order";
        });
        expect(orderItem).toBeDefined();
        expect(orderItem?.field.selected).toBe(true);
        expect(orderItem?.field.jsonKeyname).toEqual("purchases");
        expect(orderItem?.expanded).toBe(true);
        expect(orderItem?.children).toHaveLength(5);

        unmount();
    });

    it("JdvObjectFieldEditor test fillTreeBasedOnJdvObjectFields [invalid root table]", async () => {
        const schemasWithTables: Record<string, string[]> = {};

        // root table with no primary key
        await backend.execute("CREATE TABLE IF NOT EXISTS jdv_test.product_rating (" +
            "rating TINYINT UNSIGNED DEFAULT 0 CHECK (rating BETWEEN 0 AND 5))");
        schemasWithTables.jdv_test = ["product_rating"];
        const values1: IJdvObjectFieldEditorData = {
            jdvSchema: "jdv_test",
            defaultJdvName: "product_rating_jdv",
            createView: true,
            jdvViewInfo: {
                id: "",
                name: "product_rating_jdv",
                schema: "jdv_test",
                rootTableName: "product_rating",
                rootTableSchema: "jdv_test",
            },
            jdvObjects: [],
            rootJdvObjectId: undefined,
            currentTreeItems: [],
        };

        const { unmount, editorRef } = await doMount(values1, backend, schemasWithTables, () => {
            return values1.jdvViewInfo;
        });

        let data = editorRef.current!.props.values as IJdvObjectFieldEditorData;
        expect(data.currentTreeItems).toHaveLength(1);
        expect(data.currentTreeItems[0].validators.size).toEqual(1);
        expect(data.currentTreeItems[0].validators.get(JdvObjectFieldValidatorType.Table)).toEqual({
            invalid: true,
            message: "Table has no primary key.",
            additionalMessage: `Table jdv_test.product_rating is not valid: `,
        });
        let errors = JdvObjectFieldEditor.validateJdvObjectFields(data);
        expect(errors).toHaveLength(1);

        unmount();

        // root table with composite primary key
        await backend.execute("CREATE TABLE IF NOT EXISTS jdv_test.delivery_info (" +
            "id INT NOT NULL," +
            "purchase_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
            "PRIMARY KEY (id, purchase_date))");
        schemasWithTables.jdv_test = ["delivery_info"];
        const values2: IJdvObjectFieldEditorData = {
            jdvSchema: "jdv_test",
            defaultJdvName: "delivery_info_jdv",
            createView: true,
            jdvViewInfo: {
                id: "",
                name: "delivery_info_jdv",
                schema: "jdv_test",
                rootTableName: "delivery_info",
                rootTableSchema: "jdv_test",
            },
            jdvObjects: [],
            rootJdvObjectId: undefined,
            currentTreeItems: [],
        };

        const { unmount: unmount2, editorRef: editorRef2 } = await doMount(values2, backend, schemasWithTables, () => {
            return values2.jdvViewInfo;
        });

        data = editorRef2.current!.props.values as IJdvObjectFieldEditorData;
        expect(data.currentTreeItems).toHaveLength(1);
        expect(data.currentTreeItems[0].validators.size).toEqual(1);
        expect(data.currentTreeItems[0].validators.get(JdvObjectFieldValidatorType.Table)).toEqual({
            invalid: true,
            message: "Table has composite primary key.",
            additionalMessage: `Table jdv_test.delivery_info is not valid: `,
        });
        errors = JdvObjectFieldEditor.validateJdvObjectFields(data);
        expect(errors).toHaveLength(1);

        unmount2();
    });

    it("JdvObjectFieldEditor test validateJdvObjectFieldTreeItem [unsupported columns]", async () => {
        const { unmount, editorRef } = await doMount();
        let treeItem;

        treeItem = createColumnTreeItem("jsonKeyname1", {
            dbName: "col1",
            datatype: "json",
            isPrimary: false,
            isGenerated: false,
            notNull: false,
        });
        treeItem.field.selected = true;

        await editorRef.current!.validateJdvObjectFieldTreeItem(treeItem);
        expect(treeItem.validators.size).toEqual(1);
        expect(treeItem.field.selected).toBe(false);
        expect(treeItem.validators.get(JdvObjectFieldValidatorType.Column)).toEqual({
            unsupported: true,
            message: `Column datatype 'json' is not supported.`,
        });

        treeItem = createColumnTreeItem("jsonKeyname1", {
            dbName: "col1",
            datatype: "string",
            isPrimary: false,
            isGenerated: true,
            notNull: false,
        });
        treeItem.field.selected = true;
        await editorRef.current!.validateJdvObjectFieldTreeItem(treeItem);
        expect(treeItem.validators.size).toEqual(1);
        expect(treeItem.field.selected).toBe(false);
        expect(treeItem.validators.get(JdvObjectFieldValidatorType.Column)).toEqual({
            unsupported: true,
            message: `Generated columns are not supported.`,
        });

        unmount();
    });

    it("JdvObjectFieldEditor test validateJdvObjectFieldTreeItem [invalid json keyname]", async () => {
        const { unmount, editorRef } = await doMount();

        // empty value
        let treeItem = createColumnTreeItem("");
        await editorRef.current!.validateJdvObjectFieldTreeItem(treeItem);
        expect(treeItem.validators.size).toEqual(1);
        expect(treeItem.validators.get(JdvObjectFieldValidatorType.JsonKeyName)).toEqual({
            invalid: true,
            message: `Key name cannot be empty.`,
            additionalMessage: `Json keyname for schema.table1.col1 is not valid: `,
        });

        // invalid value for column item
        treeItem = createColumnTreeItem("_metadata");
        await editorRef.current!.validateJdvObjectFieldTreeItem(treeItem);
        expect(treeItem.validators.size).toEqual(1);
        expect(treeItem.validators.get(JdvObjectFieldValidatorType.JsonKeyName)).toEqual({
            invalid: true,
            message: `Cannot use _metadata as json key.`,
            additionalMessage: `Json keyname for schema.table1.col1 is not valid: `,
        });

        // invalid value for reference item
        treeItem = createReferenceTreeItem("");
        await editorRef.current!.validateJdvObjectFieldTreeItem(treeItem);
        expect(treeItem.validators.size).toEqual(1);
        expect(treeItem.validators.get(JdvObjectFieldValidatorType.JsonKeyName)).toEqual({
            invalid: true,
            message: `Key name cannot be empty.`,
            additionalMessage: `Json keyname for schema.table1 is not valid: `,
        });

        // after fixing the invalid value
        treeItem.field.jsonKeyname = "jsonKeyname1";
        await editorRef.current!.validateJdvObjectFieldTreeItem(treeItem);
        expect(treeItem.validators.size).toEqual(0);

        // columns with duplicate json key names
        const colTreeItem1 = createColumnTreeItem("dupKeyname", {
            dbName: "col1",
            datatype: "string",
            isPrimary: false,
            isGenerated: false,
            notNull: false,
        }, treeItem);

        const colTreeItem2 = createColumnTreeItem("dupKeyname", {
            dbName: "col2",
            datatype: "string",
            isPrimary: false,
            isGenerated: false,
            notNull: false,
        }, treeItem);

        treeItem.children = [colTreeItem1, colTreeItem2];
        await editorRef.current!.validateJdvObjectFieldTreeItem(colTreeItem1);
        expect(colTreeItem1.validators.size).toEqual(1);
        expect(colTreeItem1.validators.get(JdvObjectFieldValidatorType.JsonKeyName)).toEqual({
            invalid: true,
            message: `Cannot use duplicate json keys in the same table.`,
            additionalMessage: `Json keyname for schema.table1.col1 is not valid: `,
            kwargs: { dupKeyname: "dupKeyname" },
        });
        expect(colTreeItem2.validators.size).toEqual(1);

        colTreeItem2.field.jsonKeyname = "uniqueKeyname";
        await editorRef.current!.validateJdvObjectFieldTreeItem(colTreeItem2);
        expect(colTreeItem1.validators.size).toEqual(0);
        expect(colTreeItem2.validators.size).toEqual(0);

        unmount();
    });

    it("JdvObjectFieldEditor test validateJdvObjectFieldTreeItem [invalid link]", async () => {
        const { unmount, editorRef } = await doMount();

        // test validator empty if link is valid
        const parentTreeItem = createReferenceTreeItem("ref1", "1");
        const childTreeItem = createReferenceTreeItem("ref2", "2");

        parentTreeItem.children = [
            createColumnTreeItem("pk", {
                dbName: "pk",
                datatype: "string",
                isPrimary: true,
                isGenerated: false,
                notNull: false,
            }),
            createColumnTreeItem("col1"),
            childTreeItem,
        ];

        childTreeItem.children = [
            createColumnTreeItem("pk", {
                dbName: "pk",
                datatype: "string",
                isPrimary: true,
                isGenerated: false,
                notNull: false,
            }),
            createColumnTreeItem("fk1", {
                dbName: "fk1",
                datatype: "string",
                isPrimary: false,
                isGenerated: false,
                notNull: false,
            }),
        ];
        childTreeItem.parent = parentTreeItem;

        await editorRef.current!.validateJdvObjectFieldTreeItem(childTreeItem);
        expect(childTreeItem.validators.size).toEqual(0);

        // test columns not selected
        childTreeItem.field.objectReference = {
            kind: "1:n",
            baseColumn: "",
            referencedColumn: "",
            referencedTable: "table1",
            referencedSchema: "schema",
        };
        await editorRef.current!.validateJdvObjectFieldTreeItem(childTreeItem);
        expect(childTreeItem.validators.size).toEqual(1);
        expect(childTreeItem.field.objectReference.kind).toEqual("");
        expect(childTreeItem.validators.get(JdvObjectFieldValidatorType.ObjectReference)).toEqual({
            invalid: true,
            message: "Parent and child columns must be selected.",
            additionalMessage: `Link between schema.table1 and schema.table1 is not valid: `,
        });

        // test selected columns are not primary
        childTreeItem.field.objectReference = {
            kind: "1:n",
            baseColumn: "col1",
            referencedColumn: "fk1",
            referencedTable: "table1",
            referencedSchema: "schema",
        };
        await editorRef.current!.validateJdvObjectFieldTreeItem(childTreeItem);
        expect(childTreeItem.validators.size).toEqual(1);
        expect(childTreeItem.field.objectReference.kind).toEqual("");
        expect(childTreeItem.validators.get(JdvObjectFieldValidatorType.ObjectReference)).toEqual({
            invalid: true,
            message: "The primary key for at least one of the two tables must be selected.",
            additionalMessage: `Link between schema.table1 and schema.table1 is not valid: `,
        });

        unmount();
    });

    it("JdvObjectFieldEditor test buildDataMappingViewSql", () => {
        const exampleDDL = createJdvExampleDDL();

        const exampleData = createJdvExampleFieldEditorValuesData();
        const generatedDDL = JdvObjectFieldEditor.buildDataMappingViewSql(exampleData);

        expect(normalizeWhitespace(generatedDDL)).toEqual(normalizeWhitespace(exampleDDL));
    });
});
