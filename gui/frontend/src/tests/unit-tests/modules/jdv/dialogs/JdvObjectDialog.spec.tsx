/*
 * Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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
import { beforeAll, describe, expect, it } from "vitest";

import { registerUiLayer } from "../../../../../app-logic/UILayer.js";
import { IJdvTableColumnWithReference, IJdvViewInfo } from "../../../../../communication/ProtocolGui.js";
import { JdvHub } from "../../../../../modules/jdv/JdvHub.js";
import { IJdvEditRequest } from "../../../../../supplement/RequisitionTypes.js";
import { ShellInterfaceSqlEditor } from "../../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { KeyboardKeys } from "../../../../../utilities/helpers.js";
import { uiLayerMock } from "../../../__mocks__/UILayerMock.js";
import { DialogHelper, sendKeyPress } from "../../../test-helpers.js";

describe("Jdv Object dialog tests", () => {
    const createBackend = (schema: string, tables: string[] = [],
        columns: IJdvTableColumnWithReference[] = [], includeSchema = false): ShellInterfaceSqlEditor => {
        return {
            getCatalogObjects: (): Promise<string[]> => {
                return Promise.resolve(includeSchema ? [schema] : []);
            },
            getSchemaObjectNames: (_schema: string, type: string): Promise<string[]> => {
                return Promise.resolve(type === "Table" ? tables : []);
            },
            getJdvTableColumnsWithReferences: (): Promise<IJdvTableColumnWithReference[]> => {
                return Promise.resolve(columns);
            },
            getTableObjectNames: (_schema: string, table: string, type: string): Promise<string[]> => {
                return Promise.resolve(type === "Primary Key" && tables.includes(table) ? ["id"] : []);
            },
        } as unknown as ShellInterfaceSqlEditor;
    };

    beforeAll(() => {
        registerUiLayer(uiLayerMock);
    });

    it("Standard Rendering (snapshot)", () => {
        const { container, unmount } = render(
            <JdvHub />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    // TODO: this currently test if the dialog opened with the correct fields
    // but does not test if the fields where populated correctly with the object values
    it("Show Jdv Object Dialog (snapshot) and escape", async () => {
        const backend = createBackend("test_schema");
        const dialogHelper = new DialogHelper("jdvObjectDialog", "Json Duality View Builder");

        const hostRef = createRef<JdvHub>();
        const { unmount } = render(
            <JdvHub ref={hostRef} />,
        );

        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        const jdvViewInfo: IJdvViewInfo = {
            id: "",
            name: "test_dv",
            schema: "test_schema",
            rootTableName: "test_table",
            rootTableSchema: "test_schema",
        };
        const dialogRequest: IJdvEditRequest = {
            jdvViewInfo,
            createView: true,
        };
        const promise = hostRef.current!.showJdvObjectDialog(backend, dialogRequest);
        await dialogHelper.waitForDialog();

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        expect(portals[0]).toMatchSnapshot();

        sendKeyPress(KeyboardKeys.Escape);

        await promise;

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        unmount();
    });

    it("Show Jdv Object Dialog and cancel", async () => {
        const backend = createBackend("jdv_missing_dialog");
        const dialogHelper = new DialogHelper("jdvObjectDialog", "Json Duality View Builder");

        const hostRef = createRef<JdvHub>();
        const { unmount } = render(
            <JdvHub ref={hostRef} />,
        );

        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        const jdvViewInfo: IJdvViewInfo = {
            id: "",
            name: "customer_jdv",
            schema: "jdv_missing_dialog",
            rootTableName: "customer",
            rootTableSchema: "jdv_missing_dialog",
        };
        const dialogRequest: IJdvEditRequest = {
            jdvViewInfo,
            createView: true,
        };
        const promise = hostRef.current!.showJdvObjectDialog(backend, dialogRequest);
        await dialogHelper.waitForDialog();

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        {
            const treeGrid = dialogHelper.searchChild<HTMLDivElement>({ class: "jdvObjectTreeGrid" });
            await waitFor(() => {
                expect(treeGrid.children).toHaveLength(2);
            });

            const treeGridHeader = treeGrid.children[0] as HTMLElement;
            expect(treeGridHeader.classList).toContain("tabulator-header");

            const treeGridTable = treeGrid.children[1] as HTMLElement;
            expect(treeGridTable.classList).toContain("tabulator-tableholder");
        }
        await dialogHelper.clickCancel();

        await promise;

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        unmount();
    });

    it("Jdv Object Dialog error testing [jdv name]", async () => {
        const columns: IJdvTableColumnWithReference[] = [
            {
                name: "id",
                position: 1,
                dbColumn: {
                    dbName: "id",
                    datatype: "int",
                    isPrimary: true,
                    isGenerated: false,
                    notNull: true,
                },
                table: "customer",
                schema: "jdv_test_dialog",
            },
            {
                name: "username",
                position: 2,
                dbColumn: {
                    dbName: "username",
                    datatype: "varchar",
                    isPrimary: false,
                    isGenerated: false,
                    notNull: true,
                },
                table: "customer",
                schema: "jdv_test_dialog",
            },
        ];
        const backend = createBackend("jdv_test_dialog", ["customer"], columns, true);
        const dialogHelper = new DialogHelper("jdvObjectDialog", "Json Duality View Builder");

        const hostRef = createRef<JdvHub>();
        const { unmount } = render(
            <JdvHub ref={hostRef} />,
        );

        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        const jdvViewInfo: IJdvViewInfo = {
            id: "",
            name: "customer_jdv",
            schema: "jdv_test_dialog",
            rootTableName: "customer",
            rootTableSchema: "jdv_test_dialog",
        };

        const dialogRequest: IJdvEditRequest = {
            jdvViewInfo,
            createView: true,
        };

        const promise = hostRef.current!.showJdvObjectDialog(backend, dialogRequest);
        await dialogHelper.waitForDialog();
        await waitFor(() => {
            expect(dialogHelper.searchChild<HTMLDivElement>({ class: "jdvObjectTreeGrid" })).toBeDefined();
        });

        try {
            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);

            await dialogHelper.setInputText("viewName", "");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["Json duality view name must not be empty."]);
        } finally {
            await dialogHelper.clickCancel();
            await promise;
        }

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        unmount();
    });
});
