/*
 * Copyright (c) 2024, 2026, Oracle and/or its affiliates.
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

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { render } from "@testing-library/preact";
import { createRef } from "preact";

import { registerUiLayer } from "../../../../app-logic/UILayer.js";
import { LibraryDialogType } from "../../../../app-logic/general-types.js";
import { CreateLibraryDialog } from "../../../../components/Dialogs/CreateLibraryDialog.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher.js";
import { KeyboardKeys } from "../../../../utilities/helpers.js";
import { uiLayerMock } from "../../__mocks__/UILayerMock.js";
import { DialogHelper, createBackend, nextProcessTick, sendKeyPress, setupShellForTests } from "../../test-helpers.js";

describe("MRS SDK Export dialog tests", () => {
    const dialogRef = createRef<CreateLibraryDialog>();
    let unmount: () => boolean;

    let launcher: MySQLShellLauncher;
    let dialogHelper: DialogHelper;
    let backend: ShellInterfaceSqlEditor;

    beforeAll(async () => {
        registerUiLayer(uiLayerMock);
        launcher = await setupShellForTests(true, true, "DEBUG2", "CreateLibraryDialogTests");

        const result = render(<CreateLibraryDialog ref={dialogRef} />);
        unmount = result.unmount;

        dialogHelper = new DialogHelper("createLibraryDialog", "Create Library From");
    });

    afterAll(async () => {
        await backend.execute("DROP DATABASE IF EXISTS CREATE_LIBRARY_TEST");
        await backend.closeSession();
        await launcher.exitProcess();

        unmount();
    });

    beforeEach(async () => {
        backend = await createBackend();
    });

    it("Show Create Library Dialog (snapshot) and escape", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
        const data = {
            type: LibraryDialogType.CreateLibraryFrom,
            id: "createLibraryDialog",
            parameters: {},
            values: { schemaName: "CREATE_LIBRARY_TEST" },
        };
        const promise = dialogRef.current!.show(data);
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

    it("Show Create Library Dialog and cancel", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
        const data = {
            type: LibraryDialogType.CreateLibraryFrom,
            id: "createLibraryDialog",
            parameters: {},
            values: { schemaName: "CREATE_LIBRARY_TEST" },
        };
        const promise = dialogRef.current!.show(data);
        await dialogHelper.waitForDialog();

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        expect(portals[0]).toMatchSnapshot();

        await dialogHelper.clickCancel();

        await promise;

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
    });

    it("Show Create Library Dialog error testing", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
        const data = {
            type: LibraryDialogType.CreateLibraryFrom,
            id: "createLibraryDialog",
            parameters: {},
            values: { schemaName: "" },
        };
        const promise = dialogRef.current!.show(data);
        await dialogHelper.waitForDialog();

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        await dialogHelper.clickOk();
        await nextProcessTick();
        dialogHelper.verifyErrors(["Please select a file", "Schema name is missing"]);
        await nextProcessTick();
        await dialogHelper.setInputText("schemaName", "CREATE_LIBRARY_TEST2");

        await dialogHelper.clickOk();
        await nextProcessTick();
        dialogHelper.verifyErrors(["Please select a file"]);
        await nextProcessTick();
        await dialogHelper.clickCancel();
        await nextProcessTick();

        await promise;

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
    });
});
