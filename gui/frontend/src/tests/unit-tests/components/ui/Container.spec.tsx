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

import overviewPageIcon from "../../../../assets/images/overviewPage.svg";

import { mount } from "enzyme";

import { Container, IContainerProperties, Orientation } from "../../../../components/ui/Container/Container";
import { Icon } from "../../../../components/ui/Icon/Icon";
import { Button } from "../../../../components/ui/Button/Button";

describe("Container component tests", (): void => {

    it("Test Container output (snapshot)", () => {
        const component = mount<Container<IContainerProperties>>(
            <Container className="demoContainer">
                <Container
                    orientation={Orientation.TopDown}
                    style={{ margin: "20px" }}
                >
                    <Icon src={overviewPageIcon} />
                    <Icon src={overviewPageIcon} />
                    <Icon src={overviewPageIcon} />
                    <Icon src={overviewPageIcon} />
                    <Icon src={overviewPageIcon} />
                    <Icon src={overviewPageIcon} />
                </Container>
                <Container
                    orientation={Orientation.BottomUp}
                    style={{ margin: "20px" }}
                >
                    <Button round>M</Button>
                    <Button round>M</Button>
                    <Button round>M</Button>
                    <Button round>M</Button>
                    <Button round>M</Button>
                </Container>
            </Container>,
        );
        expect(component).toMatchSnapshot();

        component.unmount();
    });

});
