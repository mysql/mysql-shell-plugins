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

import React from "react";
import { mount } from "enzyme";
import Color from "color";

import { nextProcessTick, snapshotFromWrapper } from "../../../test-helpers";
import { ColorField, ColorPopup, Container } from "../../../../../components/ui";

describe("ColorField component tests", (): void => {

    it("Test ColorField output (snapshot)", () => {
        const component = mount<ColorField>(
            <ColorField />,
        );
        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.unmount();
    });

    it("Interaction tests", async () => {
        const component = mount(
            <Container>
                <ColorPopup />
                <ColorField id="testColorButton" initialColor={new Color("#FFAA88")} />,
            </Container>,
        );

        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        await nextProcessTick();

        expect(snapshotFromWrapper(component)).toMatchSnapshot("1");
        const field = component.find<ColorField>(ColorField);
        expect(field.state().currentColor?.toString()).toBe("rgb(255, 170, 136)");

        // Unsetting the color renders the default hash image.
        field.setState({ currentColor: undefined });
        expect(snapshotFromWrapper(component)).toMatchSnapshot("2");

        const div = field.getDOMNode();
        (div as HTMLDivElement).click();

        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        component.unmount();
    });

});
