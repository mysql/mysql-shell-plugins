/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { ReactWrapper, mount } from "enzyme";

import { DialogResponseClosure, IDialogRequest, MdsDialogType } from "../../../../../app-logic/general-types.js";
import type { IValueDialogBaseProperties } from "../../../../../components/Dialogs/ValueDialogBase.js";
import { IDialogSection, IDialogValues } from "../../../../../components/Dialogs/ValueEditDialog.js";
import { MdsHWClusterDialog } from "../../../../../modules/mds/dialogs/MdsHWClusterDialog.js";
import { sleep } from "../../../../../utilities/helpers.js";
import { DialogHelper, nextProcessTick } from "../../../test-helpers.js";

describe("MdsHWClusterDialog tests", () => {
    let component: ReactWrapper<IValueDialogBaseProperties, {}, MdsHWClusterDialog>;
    let dialogHelper: DialogHelper;

    beforeAll(() => {
        dialogHelper = new DialogHelper("mdsHWClusterDialog");
    });

    beforeEach(() => {
        component = mount<MdsHWClusterDialog>(
            <MdsHWClusterDialog
                onClose={jest.fn()}
            />,
        );
    });

    afterEach(() => {
        component.unmount();
    });

    it("Test render MdsHWClusterDialog", () => {
        expect(component).toMatchSnapshot();
    });

    it("Test call show method", () => {
        const portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);
        const request: IDialogRequest = {
            type: MdsDialogType.MdsHeatWaveCluster,
            id: "mdsHWClusterDialog",
            parameters: {
                shapes: [
                    { name: "shape1" },
                    { name: "shape2" },
                ],
            },
            values: {
                shapeName: "shape1",
                clusterSize: 4,
            },
        };
        const title = "Test Title";

        (component.instance()).show(request, title);
    });

    it("Test call onClose with DialogResponseClosure.Accept", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const onCloseMock = jest.fn();
        component.setProps({ onClose: onCloseMock });

        const request: IDialogRequest = {
            type: MdsDialogType.MdsHeatWaveCluster,
            id: "mdsHWClusterDialog",
            parameters: {
                shapes: [
                    { name: "shape1" },
                    { name: "shape2" },
                ],
            },
            values: {
                shapeName: "shape1",
                clusterSize: 4,
            },
        };
        const title = "Test Title";

        (component.instance()).show(request, title);

        await nextProcessTick();
        await sleep(500);

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        await dialogHelper.clickOk();

        expect(onCloseMock).toHaveBeenCalledTimes(1);
        expect(onCloseMock).toHaveBeenCalledWith(DialogResponseClosure.Accept, {
            clusterSize: 4,
            shapeName: "shape1",
        });

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);
    });

    it("Test call close dialog that not set shape default with Ok button", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const request: IDialogRequest = {
            type: MdsDialogType.MdsHeatWaveCluster,
            id: "mdsHWClusterDialog",
            parameters: {
                shapes: [
                    { name: "shape1" },
                    { name: "shape2" },
                ],
            },
            values: {
            },
        };
        const title = "Test Title";

        (component.instance()).show(request, title);

        await nextProcessTick();
        await sleep(500);

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        await dialogHelper.clickOk();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);
    });

    it("Test call onClose with DialogResponseClosure.Decline", async () => {
        const onCloseMock = jest.fn();

        component.setProps({ onClose: onCloseMock });

        const values: IDialogValues = {
            sections: new Map<string, IDialogSection>([
                [
                    "mainSection",
                    {
                        values: {
                            clusterSize: { value: 4, type: "number" },
                            shapeName: { value: "shape1", type: "text" },
                        },
                    },
                ],
            ]),
        };

        await (component.instance()).handleCloseDialog(DialogResponseClosure.Decline, values);

        expect(onCloseMock).toHaveBeenCalledWith(DialogResponseClosure.Decline);
    });

    it("Test call onClose with DialogResponseClosure.Cancel", async () => {
        const onCloseMock = jest.fn();

        component.setProps({ onClose: onCloseMock });

        const values: IDialogValues = {
            sections: new Map<string, IDialogSection>([
                [
                    "mainSection",
                    {
                        values: {
                            clusterSize: { value: 4, type: "number" },
                            shapeName: { value: "shape1", type: "text" },
                        },
                    },
                ],
            ]),
        };

        await (component.instance()).handleCloseDialog(DialogResponseClosure.Cancel, values);

        expect(onCloseMock).toHaveBeenCalledWith(DialogResponseClosure.Cancel);
    });

    it("Test return validation messages", () => {
        const values: IDialogValues = {
            sections: new Map<string, IDialogSection>([
                [
                    "mainSection",
                    {
                        values: {
                            clusterSize: { value: undefined, type: "number" },
                        },
                    },
                ],
            ]),
        };

        const result = (component.instance()).validateInput(true, values);

        expect(result.messages).toEqual({ name: "The cluster size must be specified." });
        expect(result.requiredContexts).toEqual([]);
    });

    it("Test return empty validation messages", () => {
        const values: IDialogValues = {
            sections: new Map<string, IDialogSection>([
                [
                    "mainSection",
                    {
                        values: {
                            clusterSize: { value: 4, type: "number" },
                        },
                    },
                ],
            ]),
        };

        const result = (component.instance()).validateInput(true, values);

        expect(result.messages).toEqual({});
        expect(result.requiredContexts).toEqual([]);
    });
});
