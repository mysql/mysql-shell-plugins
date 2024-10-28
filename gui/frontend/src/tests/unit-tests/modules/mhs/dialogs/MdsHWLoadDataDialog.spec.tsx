/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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
import { MdsHWLoadDataDialog } from "../../../../../modules/mds/dialogs/MdsHWLoadDataDialog.js";
import { DialogResponseClosure, IDialogRequest, MdsDialogType } from "../../../../../app-logic/general-types.js";
import { DialogHelper, nextProcessTick } from "../../../test-helpers.js";
import { sleep } from "../../../../../utilities/helpers.js";
import { IDialogSection } from "../../../../../components/Dialogs/ValueEditDialog.js";

describe("MdsHWLoadDataDialog tests", () => {
    let component: unknown;
    let dialogHelper: DialogHelper;

    beforeAll(() => {
        dialogHelper = new DialogHelper("mdsHWLoadDataDialog");
    });

    beforeEach(() => {
        component = mount<MdsHWLoadDataDialog>(
            <MdsHWLoadDataDialog
                onClose={jest.fn()}
            />,
        );
    });

    afterEach(() => {
        if (component instanceof ReactWrapper) {
            component.unmount();
        }
    });

    it("Test render MdsHWLoadDataDialog", () => {
        const component = mount<MdsHWLoadDataDialog>(
            <MdsHWLoadDataDialog
                onClose={jest.fn()}
            />,
        );
        expect(component).toMatchSnapshot();
    });

    it("Test call onClose with DialogResponseClosure.Accept", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const onCloseMock = jest.fn();
        if (component instanceof ReactWrapper) {
            component.setProps({ onClose: onCloseMock });
        }

        const request: IDialogRequest = {
            type: MdsDialogType.MdsHeatWaveLoadData,
            id: "mdsHWLoadDataDialog",
            values: {
                allSchemas: ["schema1", "schema2"],
                selectedSchemas: ["schema1"],
            },
        };
        const title = "Test Title";

        if (component instanceof ReactWrapper) {
            (component.instance() as MdsHWLoadDataDialog).show(request, title);
        }

        await nextProcessTick();
        await sleep(500);

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        await dialogHelper.clickOk();

        await nextProcessTick();
        await sleep(500);

        expect(onCloseMock).toHaveBeenCalledTimes(1);
        expect(onCloseMock).toHaveBeenCalledWith(DialogResponseClosure.Accept, {
            disableUnsupportedColumns: true,
            enableMemoryCheck: true,
            excludeList: "",
            mode: "normal",
            optimizeLoadParallelism: true,
            output: "normal",
            schemas: [
                "schema1",
            ],
            sqlMode: "",
        });

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);
    });

    it("Test call onClose with DialogResponseClosure.Decline", () => {
        const onCloseMock = jest.fn();
        if (component instanceof ReactWrapper) {
            component.setProps({ onClose: onCloseMock });
            const mainSection: IDialogSection = {
                values: {
                    schemas: { value: [], type: "set", tagSet: [] },
                    excludeList: { value: "invalid", type: "text" },
                },
            };
            (component.instance() as MdsHWLoadDataDialog).handleCloseDialog(DialogResponseClosure.Decline,
                { sections: new Map<string, IDialogSection>([["mainSection", mainSection]]) });
            expect(onCloseMock).toHaveBeenCalledWith(DialogResponseClosure.Decline);
        }
    });

    it("Test call onClose with DialogResponseClosure.Cancel", () => {
        const onCloseMock = jest.fn();
        if (component instanceof ReactWrapper) {
            component.setProps({ onClose: onCloseMock });
            const mainSection: IDialogSection = {
                values: {
                    schemas: { value: [], type: "set", tagSet: [] },
                    excludeList: { value: "invalid", type: "text" },
                },
            };
            (component.instance() as MdsHWLoadDataDialog).handleCloseDialog(DialogResponseClosure.Cancel,
                { sections: new Map<string, IDialogSection>([["mainSection", mainSection]]) });
            expect(onCloseMock).toHaveBeenCalledWith(DialogResponseClosure.Cancel);
        }
    });

    it("Test validate the input", () => {
        const request: IDialogRequest = {
            type: MdsDialogType.MdsHeatWaveLoadData,
            id: "mdsHWLoadDataDialog",
            values: {
                allSchemas: [],
                selectedSchemas: [],
            },
        };
        const title = "Test Title";
        if (component instanceof ReactWrapper) {
            (component.instance() as MdsHWLoadDataDialog).show(request, title);

            const mainSection: IDialogSection = {
                values: {
                    schemas: { value: [], type: "set", tagSet: [] },
                    excludeList: { value: "invalid", type: "text" },
                },
            };

            const validations = (component.instance() as MdsHWLoadDataDialog).validateInput(true, {
                sections: new Map<string, IDialogSection>([["mainSection", mainSection]]),
            });

            expect(validations.messages).toEqual({
                schemas: "At least one schema needs to be selected.",
                excludeList:
                    "The Exclude List needs to contain a list of quoted object names, " +
                    "e.g.\"mySchema.myTable\", \"myOtherSchema.myOtherTable\"",
            });
        }
    });
});
