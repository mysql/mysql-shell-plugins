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

import { render } from "@testing-library/preact";
import { createRef } from "preact";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { registerUiLayer } from "../../../../../app-logic/UILayer.js";
import { IJdvViewInfo } from "../../../../../communication/ProtocolGui.js";
import { JdvHub } from "../../../../../modules/jdv/JdvHub.js";
import { IJdvEditRequest } from "../../../../../supplement/RequisitionTypes.js";
import { ShellInterfaceSqlEditor } from "../../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { KeyboardKeys } from "../../../../../utilities/helpers.js";
import { MySQLShellLauncher } from "../../../../../utilities/MySQLShellLauncher.js";
import { uiLayerMock } from "../../../__mocks__/UILayerMock.js";
import {
    DialogHelper, createBackend, createJdvData, nextRunLoop, sendKeyPress, setupShellForTests,
} from "../../../test-helpers.js";

describe("Jdv Object dialog tests", () => {
    let launcher: MySQLShellLauncher;
    let backend: ShellInterfaceSqlEditor;
    let dialogHelper: DialogHelper;

    beforeAll(async () => {
        registerUiLayer(uiLayerMock);
        launcher = await setupShellForTests(true, true, "DEBUG2", "JdvObjectDialogTests");

        dialogHelper = new DialogHelper("jdvObjectDialog", "Json Duality View Builder");
        backend = await createBackend();
    });

    afterAll(async () => {
        await backend.closeSession();
        await launcher.exitProcess();
    });

    it("Standard Rendering (snapshot)", () => {
        const { container, unmount } = render(
            <JdvHub />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    // TODO: this currently test if the dialog opened with the correct fields
    // but does not test if the filds where populated correctly with the object values
    it("Show Jdv Object Dialog (snapshot) and escape", async () => {
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

        setTimeout(() => {
            sendKeyPress(KeyboardKeys.Escape);
        }, 250);

        await promise;

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        unmount();
    });

    it("Show Jdv Object Dialog and cancel", async () => {
        const hostRef = createRef<JdvHub>();
        const { unmount } = render(
            <JdvHub ref={hostRef} />,
        );

        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        const jdvViewInfo: IJdvViewInfo = {
            id: "",
            name: "customer_jdv",
            schema: "jdv_test",
            rootTableName: "customer",
            rootTableSchema: "jdv_test",
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
            await nextRunLoop();
            const treeGrid = dialogHelper.searchChild<HTMLDivElement>({ class: "jdvObjectTreeGrid" });
            expect(treeGrid.children).toHaveLength(2);

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

        await createJdvData(backend);

        const hostRef = createRef<JdvHub>();
        const { unmount } = render(
            <JdvHub ref={hostRef} />,
        );

        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        const jdvViewInfo: IJdvViewInfo = {
            id: "",
            name: "customer_jdv",
            schema: "jdv_test",
            rootTableName: "customer",
            rootTableSchema: "jdv_test",
        };

        const dialogRequest: IJdvEditRequest = {
            jdvViewInfo,
            createView: true,
        };

        const promise = hostRef.current!.showJdvObjectDialog(backend, dialogRequest);
        await dialogHelper.waitForDialog();

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
