/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

import { mount } from "enzyme";

import { ConnectionBrowser } from "../../../../modules/db-editor/ConnectionBrowser.js";
import { DBType, IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";

describe("Connection browser tests", (): void => {

    it("Test ConnectionBrowser instantiation", () => {
        const connection1: IConnectionDetails = {
            id: 0,
            dbType: DBType.MySQL,
            caption: "",
            description: "",
            options: { type: "unknown" },
            useSSH: false,
            useMDS: false,
        };
        const component = mount<ConnectionBrowser>(
            <ConnectionBrowser
                connections={[connection1]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxillary: [] }}
                onAddConnection={jest.fn()}
                onUpdateConnection={jest.fn()}
                onDropConnection={jest.fn()}
            />,
        );
        const props = component.props();
        expect(props.connections).toEqual([connection1]);
        expect(component).toMatchSnapshot();
        component.unmount();
    });

});
