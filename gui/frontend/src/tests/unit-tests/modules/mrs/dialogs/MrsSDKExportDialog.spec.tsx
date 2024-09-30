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
import { IMrsServiceData } from "../../../../../communication/ProtocolMrs.js";
import { MrsHub } from "../../../../../modules/mrs/MrsHub.js";
import { ShellInterfaceSqlEditor } from "../../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { MySQLShellLauncher } from "../../../../../utilities/MySQLShellLauncher.js";
import { KeyboardKeys } from "../../../../../utilities/helpers.js";
import {
    DialogHelper,
    JestReactWrapper,
    createBackend,
    recreateMrsData,
    sendKeyPress,
    setupShellForTests,
} from "../../../test-helpers.js";

describe("MRS SDK Export dialog tests", () => {
    let host: JestReactWrapper;
    let service: IMrsServiceData;
    let launcher: MySQLShellLauncher;
    const hubRef = createRef<MrsHub>();
    let dialogHelper: DialogHelper;
    let backend: ShellInterfaceSqlEditor;

    beforeAll(async () => {
        launcher = await setupShellForTests(false, true, "DEBUG2");

        const result = await recreateMrsData();
        service = result.service;

        host = mount<MrsHub>(<MrsHub ref={hubRef} />);

        dialogHelper = new DialogHelper("mrsSdkExportDialog", "Export MRS SDK for /myService");
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
