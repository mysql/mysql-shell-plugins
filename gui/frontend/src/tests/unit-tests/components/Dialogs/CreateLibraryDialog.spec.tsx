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

import { createRef } from "preact";

import { mount } from "enzyme";
import { CreateLibraryDialog } from "../../../../components/Dialogs/CreateLibraryDialog.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher.js";
import { KeyboardKeys } from "../../../../utilities/helpers.js";
import {
    DialogHelper,
    JestReactWrapper,
    createBackend,
    sendKeyPress,
    setupShellForTests,
} from "../../test-helpers.js";
import { uiLayerMock } from "../../__mocks__/UILayerMock.js";
import { registerUiLayer } from "../../../../app-logic/UILayer.js";
import { LibraryDialogType } from "../../../../app-logic/general-types.js";

describe("MRS SDK Export dialog tests", () => {
    let host: JestReactWrapper;
    let launcher: MySQLShellLauncher;
    const dialogRef = createRef<CreateLibraryDialog>();
    let dialogHelper: DialogHelper;
    let backend: ShellInterfaceSqlEditor;

    beforeAll(async () => {
        registerUiLayer(uiLayerMock);
        launcher = await setupShellForTests(false, true, "DEBUG2");

        host = mount<CreateLibraryDialog>(<CreateLibraryDialog ref={dialogRef} />);

        dialogHelper = new DialogHelper("createLibraryDialog", "Create Library From");
    });

    afterAll(async () => {
        await backend.execute("DROP DATABASE IF EXISTS CREATE_LIBRARY_TEST");
        await backend.closeSession();
        await launcher.exitProcess();
        host.unmount();
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
        dialogHelper.verifyErrors(["Path is missing", "Schema name is missing"]);
        await dialogHelper.setInputText("schemaName", "CREATE_LIBRARY_TEST2");
        // it has to be an actual file, not just a random file path
        await dialogHelper.setInputText("localFilePath", "/my/path/to.js");

        await dialogHelper.clickOk();
        dialogHelper.verifyErrors(["File is empty"]);
        await dialogHelper.clickCancel();

        await promise;

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
    });
});
