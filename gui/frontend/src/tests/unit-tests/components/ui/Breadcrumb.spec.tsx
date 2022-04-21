/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import { mount } from "enzyme";
import { act } from "preact/test-utils";
import React from "react";

import { Breadcrumb, IBreadcrumbProperties, Button, Label, IButtonProperties } from "../../../../components/ui";
import { snapshotFromWrapper } from "../../test-helpers";
import { eventMock } from "../../__mocks__/MockEvents";

describe("Breadcrumb render testing", (): void => {

    it("Test Breadcrumb onSelect callback", async () => {
        const component = mount(
            <Breadcrumb
                id="breadcrumb1"
                path={["root", "folder", "subfolder"]}
                className="dropShadow"
                selected={2}
                onSelect={jest.fn()}
            />,
        );
        expect(component).toBeTruthy();
        const buttons = component.find("button");
        expect(buttons).toHaveLength(4);
        const instance = component.instance();
        const spyOnChange = jest.spyOn(instance.props as IBreadcrumbProperties, "onSelect");
        const onClick = (buttons.first().props() as IButtonProperties).onClick;
        await act(() => {
            onClick?.(eventMock, {});
        });
        expect(spyOnChange).toBeCalled();

        component.unmount();
    });

    it("Test Breadcrumb (Snapshot) 1", () => {
        const component = mount<Breadcrumb>(
            <Breadcrumb
                id="breadcrumb1"
                path={["root", "folder", "subfolder"]}
                className="dropShadow"
            />,
        );

        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.unmount();
    });

    it("Test Breadcrumb (Snapshot) 2", () => {
        const component = mount<Breadcrumb>(
            <Breadcrumb
                id="breadcrumb2"
                path={["root", "folder", "subfolder", "subfolder2"]}
                separator="☞"
            />,
        );

        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.unmount();
    });

    it("Test Breadcrumb (Snapshot) 3", () => {
        const component = mount<Breadcrumb>(
            <Breadcrumb id="breadcrumb3">
                <Button style={{ backgroundColor: "white", color: "white" }}>
                    <span style={{ color: "#00758f" }}>My</span>
                    <span style={{ color: "#f29111" }}>SQL</span>
                </Button>
                <Button style={{ backgroundColor: "#505050" }}>
                    <Label>localhost:3307</Label>
                </Button>
                <Button
                    caption="mysql"
                    style={{ backgroundColor: "gray" }}
                ></Button>
                <Button
                    caption="SQL"
                    style={{ backgroundColor: "darkorange", color: "white" }}
                ></Button>
            </Breadcrumb>,
        );

        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.unmount();
    });

});
