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
import { DialogResponseClosure } from "../../../../../app-logic/Types.js";
import { DialogHelper, nextProcessTick } from "../../../test-helpers.js";
import { sleep } from "../../../../../utilities/helpers.js";

describe("MdsHWLoadDataDialog tests", () => {
    let component: unknown;
    let dialogHelper: DialogHelper;

    beforeAll(() => {
        dialogHelper = new DialogHelper("mdsHWLoadDataDialog");
    });

    beforeEach(() => {
        component = mount(<MdsHWLoadDataDialog />);
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

        const request = { values: { allSchemas: ["schema1", "schema2"], selectedSchemas: ["schema1"] } };
        const title = "Test Title";

        let promise;

        if (component instanceof ReactWrapper) {
            promise = component.instance().show(request, title);
        }

        await nextProcessTick();
        await sleep(500);

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        await dialogHelper.clickOk();

        await promise;

        await nextProcessTick();
        await sleep(500);

        expect(onCloseMock).toHaveBeenCalledTimes(1);
        expect(onCloseMock).toHaveBeenCalledWith(DialogResponseClosure.Accept, {
            "disableUnsupportedColumns": true,
            "enableMemoryCheck": true,
            "excludeList": "",
               "mode": "normal",
               "optimizeLoadParallelism": true,
               "output": "normal",
               "schemas": [
                    "schema1",
                ],
               "sqlMode": "",
});

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);
    });

    it("Test call onClose with DialogResponseClosure.Decline", () => {
        const onCloseMock = jest.fn();
        if (component instanceof ReactWrapper) {
            component.setProps({ onClose: onCloseMock });
            component.instance().handleCloseDialog(DialogResponseClosure.Decline, {}, {});
            expect(onCloseMock).toHaveBeenCalledWith(DialogResponseClosure.Decline);
        }
    });

    it("Test call onClose with DialogResponseClosure.Cancel", () => {
        const onCloseMock = jest.fn();
        if (component instanceof ReactWrapper) {
            component.setProps({ onClose: onCloseMock });
            component.instance().handleCloseDialog(DialogResponseClosure.Cancel, {}, {});
            expect(onCloseMock).toHaveBeenCalledWith(DialogResponseClosure.Cancel);
        }
    });

    it("Test validate the input", () => {
        const request = { values: { allSchemas: [], selectedSchemas: [] } };
        const title = "Test Title";
        if (component instanceof ReactWrapper) {
            component.instance().show(request, title);

            const mainSection = {
                values: {
                    schemas: { value: [] },
                    excludeList: { value: "invalid" },
                },
            };

            const validations = component.instance().validateInput(true, { sections: new Map([["mainSection", mainSection]]) });

            expect(validations.messages).toEqual({
                schemas: "At least one schema needs to be selected.",
                excludeList:
                    "The Exclude List needs to contain a list of quoted object names, e.g.\"mySchema.myTable\", \"myOtherSchema.myOtherTable\"",
            });
        }
    });
});