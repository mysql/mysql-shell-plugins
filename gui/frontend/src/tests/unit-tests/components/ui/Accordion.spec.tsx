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

import imageImage from "../../../../assets/images/connections.svg";

import React from "react";
import { act } from "preact/test-utils";
import { mount } from "enzyme";

import { Accordion, Codicon, IAccordionProperties } from "../../../../components/ui";
import { snapshotFromWrapper } from "../../test-helpers";

describe("Accordion component tests", (): void => {

    it("Test Accordion callbacks", async () => {
        const event: unknown = {
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        };

        const component = mount(
            <Accordion
                id="sidebar1"
                style={{
                    borderWidth: "1px",
                    borderStyle: "solid",
                }}
                caption="SIDEBAR TITLE"
                footer={"Lorem ipsum dolor sit amen, consenter"}
                singleExpand={true}
                onSectionExpand={jest.fn()}
                onSectionAction={jest.fn()}

                sections={[
                    {
                        caption: "FIRST SECTION",
                        id: "first",
                        expanded: false,
                        content: [
                            <Accordion.Item id="item1" key="item1" caption="Item 1" />,
                            <Accordion.Item id="item2" key="item2" caption="Item 2" />,
                            <Accordion.Item id="item3" key="item3" caption="Item 3" />,
                        ],
                    },
                    {
                        caption: "SECOND SECTION",
                        actions: [
                            {
                                id: "addConsole",
                                icon: Codicon.NewFile,
                                tooltip: "Add new console",
                            },
                        ],
                        id: "second",
                        content: [
                            <Accordion.Item id="item5" key="item5" caption="Item 5" picture={imageImage} />,
                            <Accordion.Item id="item6" key="item6" caption="Item 6" picture={imageImage} />,
                            <Accordion.Item id="item7" key="item7" caption="Item 7" picture={imageImage} />,
                        ],
                    },
                    {
                        caption: "THIRD SECTION",
                        id: "third",
                        content: [
                            <Accordion.Item id="item9" key="item9" caption="Item 9" />,
                            <Accordion.Item id="item10" key="item10" caption="Item 10" />,
                            <Accordion.Item id="item11" key="item11" caption="Item 11" />,
                        ],
                    },
                ]}
            />,
        );

        expect(component).toBeTruthy();
        const instance = component.instance();
        const section1 = component.findWhere((node) => { return node.text() === "FIRST SECTION"; }).first();
        expect(section1).toHaveLength(1);

        const section2 = component.findWhere((node) => { return node.text() === "SECOND SECTION"; }).first();
        expect(section2).toHaveLength(1);

        const section3 = component.findWhere((node) => { return node.text() === "THIRD SECTION"; }).first();
        expect(section3).toHaveLength(1);

        const spyExpand = jest.spyOn(instance.props as IAccordionProperties, "onSectionExpand");
        expect(spyExpand).not.toBeCalled();

        let onClick = (section1.props() as IAccordionProperties).onClick;
        await act(() => {
            onClick?.(event as React.SyntheticEvent, { id: "2" });
        });
        expect(spyExpand).toBeCalled();

        const spyAction = jest.spyOn(instance.props as IAccordionProperties, "onSectionAction");
        expect(spyAction).not.toBeCalled();
        onClick = (component.find("#addConsole").first().props() as IAccordionProperties).onClick;
        expect(onClick).toBeDefined();

        await act(() => {
            onClick?.(event as React.SyntheticEvent, { id: "2" });
        });
        expect(spyAction).toBeCalled();

        component.unmount();
    });

    it("Test accordion output (Snapshot)", () => {
        const component = mount<Accordion>(
            <Accordion
                id="sidebar1"
                style={{
                    borderWidth: "1px",
                    borderStyle: "solid",
                }}
                caption="SIDEBAR TITLE"
                footer={"Lorem ipsum dolor sit amen, consenter"}
                singleExpand={true}

                sections={[
                    {
                        caption: "FIRST SECTION",
                        id: "first",
                        expanded: false,
                        content: [
                            <Accordion.Item id="item1" key="item1" caption="Item 1" />,
                            <Accordion.Item id="item2" key="item2" caption="Item 2" />,
                            <Accordion.Item id="item3" key="item3" caption="Item 3" />,
                        ],
                    },
                    {
                        caption: "SECOND SECTION",
                        id: "second",
                        content: [
                            <Accordion.Item id="item5" key="item5" caption="Item 5" picture={imageImage} />,
                            <Accordion.Item id="item6" key="item6" caption="Item 6" picture={imageImage} />,
                            <Accordion.Item id="item7" key="item7" caption="Item 7" picture={imageImage} />,
                        ],
                    },
                    {
                        caption: "THIRD SECTION",
                        id: "third",
                        content: [
                            <Accordion.Item id="item9" key="item9" caption="Item 9" />,
                            <Accordion.Item id="item10" key="item10" caption="Item 10" />,
                            <Accordion.Item id="item11" key="item11" caption="Item 11" />,
                        ],
                    },
                ]}
            />,
        );
        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.unmount();
    });
});
