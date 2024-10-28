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

import mysqlIcon from "../../../../../assets/images/file-icons/scriptMysql.svg";

import { mount } from "enzyme";

import { DBType, IConnectionDetails } from "../../../../../supplement/ShellInterface/index.js";
import { BrowserTileType } from "../../../../../components/ui/BrowserTile/BrowserTile.js";
import { ConnectionTile } from "../../../../../components/ui/ConnectionTile/ConnectionTile.js";

describe("ConnectionTile component tests", (): void => {

    const details: IConnectionDetails = {
        id: 1,
        dbType: DBType.MySQL,
        caption: "Tile 1",
        description: "A description",
        options: {},
    };

    it("Test ConnectionTile output (Snapshot)", () => {
        const component = mount<ConnectionTile>(
            <ConnectionTile
                id="tile1"
                tileId={1}
                caption={details.caption}
                description={details.description}
                type={BrowserTileType.Open}
                icon={mysqlIcon}

            />,
        );
        expect(component).toMatchSnapshot();

        component.unmount();
    });
});
