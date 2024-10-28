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

import { registerUiLayer } from "../../../../../app-logic/UILayer.js";
import { IShellDictionary } from "../../../../../communication/Protocol.js";
import { IMrsServiceData } from "../../../../../communication/ProtocolMrs.js";
import { MrsHub } from "../../../../../modules/mrs/MrsHub.js";
import { ShellInterfaceSqlEditor } from "../../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { MySQLShellLauncher } from "../../../../../utilities/MySQLShellLauncher.js";
import { KeyboardKeys, sleep } from "../../../../../utilities/helpers.js";
import { uiLayerMock } from "../../../__mocks__/UILayerMock.js";
import {
    DialogHelper, JestReactWrapper, createBackend, recreateMrsData, sendKeyPress, setupShellForTests,
} from "../../../test-helpers.js";

describe("MRS Service dialog tests", () => {
    let host: JestReactWrapper;
    // let service: IMrsServiceData;
    let launcher: MySQLShellLauncher;
    const hubRef = createRef<MrsHub>();
    let dialogHelper: DialogHelper;
    let backend: ShellInterfaceSqlEditor;

    beforeAll(async () => {
        registerUiLayer(uiLayerMock);

        launcher = await setupShellForTests(false, true, "DEBUG2");

        await recreateMrsData();

        host = mount<MrsHub>(<MrsHub ref={hubRef} />);

        dialogHelper = new DialogHelper("mrsServiceDialog", "MySQL REST Service");
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

        backend.mrs.addService = async (urlContextRoot: string, name: string,
            urlProtocol: string[], urlHostName: string,
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
                name,
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
        dialogHelper.verifyErrors(["The service path must not be empty."]);

        await dialogHelper.setInputText("servicePath", "/mrs");
        await dialogHelper.clickOk();
        dialogHelper.verifyErrors(["The request path `/mrs` is reserved and cannot be used."]);

        await dialogHelper.setInputText("servicePath", "/MRS");
        await dialogHelper.clickOk();
        dialogHelper.verifyErrors(["The request path `/MRS` is reserved and cannot be used."]);

        await dialogHelper.setInputText("servicePath", "/myService2");

        await dialogHelper.setInputText("hostName", "localhost");

        await dialogHelper.clickOk();

        await promise;

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
    });
});
