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

import { cleanup, fireEvent, render } from "@testing-library/preact";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "preact";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { registerUiLayer } from "../../../../../app-logic/UILayer.js";
import {
    IMrsAuthAppData, type IMrsAuthVendorData, type IMrsContentFileData, type IMrsContentSetData,
    type IMrsRoleData, type IMrsRouterData, type IMrsRouterService, type IMrsSchemaData, type IMrsServiceData,
    type IMrsStatusData, type IMrsUserData
} from "../../../../../communication/ProtocolMrs.js";
import { MrsHub } from "../../../../../modules/mrs/MrsHub.js";
import { ShellInterfaceMrs } from "../../../../../supplement/ShellInterface/ShellInterfaceMrs.js";
import { ShellInterfaceSqlEditor } from "../../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { uiLayerMock } from "../../../__mocks__/UILayerMock.js";
import {
    authAppsData, mrsContentFileData, mrsContentSetData, mrsRouterData, mrsSchemaData, mrsServiceData,
    mrsServicesData, mrsStatusMock, mrsUserData, routerServiceData
} from "../../../data-models/data-model-test-data.js";
import { DialogHelper, mockClassMethods, nextRunLoop } from "../../../test-helpers.js";

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
});

describe("MRS AuthApp dialog tests", () => {
    const localEvent = userEvent.setup();

    const hubRef = createRef<MrsHub>();
    let dialogHelper: DialogHelper;
    const backend = new ShellInterfaceSqlEditor();

    let unmount: () => boolean;

    beforeAll(() => {
        registerUiLayer(uiLayerMock);

        const result = render(<MrsHub ref={hubRef} />);
        unmount = result.unmount;

        dialogHelper = new DialogHelper("mrsAuthenticationAppDialog", "MySQL REST Authentication App");
    });

    afterAll(() => {
        unmount();
        cleanup();

        vi.resetAllMocks();
    });

    it("Show MRS Authentication App Dialog (snapshot) and escape", async () => {
        dialogHelper.actOnDialogAppearance("valueEditDialog", async (portal) => {
            expect(portal).toMatchSnapshot();
            await localEvent.keyboard("{Escape}");
        });

        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        await hubRef.current!.showMrsAuthAppDialog(backend);

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
    });

    it("Show MRS Authentication App Dialog (snapshot) and escape", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        dialogHelper.actOnDialogAppearance("valueEditDialog", (portal) => {
            expect(portal).toMatchSnapshot();
            const cancelButton = portal.querySelector("#cancel");
            fireEvent.click(cancelButton!);
        });

        await hubRef.current!.showMrsAuthAppDialog(backend);

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
    });

    it("Dialog error testing", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        dialogHelper.actOnDialogAppearance("valueEditDialog", async (portal) => {
            expect(portal).toMatchSnapshot();

            const okButton = portal.querySelector("#ok");

            await localEvent.clear(portal.querySelector(".input#name")!);
            fireEvent.click(okButton!);
            await nextRunLoop();

            dialogHelper.verifyErrors(["The name must not be empty."]);

            await dialogHelper.setInputText("name", "MyAuthApp");
            fireEvent.click(okButton!);
            dialogHelper.verifyErrors();
        });

        const authApp: IMrsAuthAppData = {
            authVendorId: "MRS",
            name: "",
            serviceId: "",
            enabled: true,
            limitToRegisteredUsers: false,
            defaultRoleId: "",
        };
        await hubRef.current!.showMrsAuthAppDialog(backend, authApp);

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
    });
});
