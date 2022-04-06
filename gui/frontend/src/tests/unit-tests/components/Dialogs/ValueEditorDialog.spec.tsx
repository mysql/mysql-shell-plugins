/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { render } from "@testing-library/preact";
import { mount } from "enzyme";
import React from "react";
import { IDialogSection, ValueEditDialog } from "../../../../components/Dialogs/ValueEditDialog";

const dialogRef = React.createRef<ValueEditDialog>();

describe("Value Editor Dialog output tests", (): void => {
    it("Action output elements", () => {
        const component = mount<ValueEditDialog>(
            <ValueEditDialog
                ref={dialogRef}
                caption="Enter a name for the new theme"
                onValidate={jest.fn()}
                onClose={jest.fn()}
            />,
        );
        const instance = component.instance();
        const nameSection: IDialogSection = {
            values: {
                input: {
                    caption: "input",
                    value: "",
                    span: 8,
                },
            },
        };

        instance.show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["name", nameSection],
                ]),
            },
            [],
        );
        // const spyOnValidate = jest.spyOn(instance.props as IValueEditDialogProperties, "onValidate");
        // const spyOnOk = jest.spyOn(instance.props as IValueEditDialogProperties, "onClose");
        expect(component).toBeTruthy();
    });

    it("Value Editor Dialog (Snapshot) 1", () => {
        const component = render(
            <ValueEditDialog
                ref={dialogRef}
                caption="Enter a name for the new theme"
                onValidate={jest.fn()}
                onClose={jest.fn()}
            />,
        );
        expect(component).toMatchSnapshot();
    });

});
