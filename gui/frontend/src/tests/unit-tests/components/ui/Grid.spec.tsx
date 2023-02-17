/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import chevronRight from "../../../../assets/images/chevron-right.svg";
import { mount } from "enzyme";

import { Grid } from "../../../../components/ui/Grid/Grid";
import { GridCell } from "../../../../components/ui/Grid/GridCell";
import { Icon } from "../../../../components/ui/Icon/Icon";
import { Input } from "../../../../components/ui/Input/Input";
import { Button } from "../../../../components/ui/Button/Button";

describe("Grid component test", (): void => {

    it("Standard Rendering", () => {
        const component = mount<Grid>(
            <Grid id="loginDialogControls" columns={[220, 40]} columnGap={8}>
                <GridCell>
                    <Input
                        id="loginUsername"
                        placeholder="Username"
                    />
                </GridCell>
                <GridCell
                    rowSpan={2}
                    columnSpan={2}
                ></GridCell>
                <GridCell>
                    <Input
                        password
                        id="loginPassword"
                        placeholder="Password"
                    />
                </GridCell>
                <GridCell>
                    <Button id="loginButton" round>
                        <Icon src={chevronRight} />
                    </Button>
                </GridCell>
            </Grid>,
        );
        expect(component).toMatchSnapshot();

        component.unmount();
    });
});
