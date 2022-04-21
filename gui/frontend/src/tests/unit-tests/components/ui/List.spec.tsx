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

import image from "../../../../assets/images/blob.svg";
import dummy from "../../../../assets/images/add.svg";

import React from "react";
import { mount } from "enzyme";

import {
    Label, List, Image, Container, Orientation, ContentAlignment, Icon, DynamicList,
} from "../../../../components/ui";
import { IDictionary } from "../../../../app-logic/Types";

import { loremIpsum, snapshotFromWrapper } from "../../test-helpers";

describe("List component test", (): void => {
    const simpleListEntry = <Label dataId="l" />;
    const containerListEntry = (
        <Container id="listContainer" className="verticalCenterContent">
            <Image id="img" src={image} />
            <Label id="containerLabel1" dataId="cl" />
            <Label
                id="containerLabel2"
                dataId="cl"
                style={{
                    fontWeight: "800",
                    color: "yellowgreen",
                    marginLeft: "12px",
                }}
            />
        </Container>
    );

    const dynamicListEntry = (
        <Container
            orientation={Orientation.LeftToRight}
            className="verticalCenterContent"
        >
            <Image dataId="iconImage" />
            <Label dataId="cl" />
            <Container
                id="innerComplexContainer"
                orientation={Orientation.TopDown}
            >
                <Icon dataId="iconImage2" />
                <Icon dataId="iconImage2" />
            </Container>
        </Container>
    );

    const dynamicItems: IDictionary[] = [];
    for (let i = 0; i < 20; ++i) {
        dynamicItems.push({
            id: `item${i}`,
            iconImage: image,
            iconImage2: dummy,
            cl: `(${i}) ${loremIpsum}`,
        });
    }

    it("Test Static unordered list output", () => {
        const component = mount<List>(
            <List
                template={simpleListEntry}
                elements={[
                    { l: "Entry 1" },
                    { l: "Entry 2" },
                    { l: "Entry 3" },
                    { l: "Entry 4" },
                ]}
            />,
        );
        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.unmount();
    });

    it("Test Static container list output", () => {
        const component = mount<List>(
            <List
                as={Container}
                {...{
                    orientation: Orientation.TopDown,
                    crossAlignment: ContentAlignment.Start,
                }}
                template={containerListEntry}
                elements={[
                    { cl: "Entry 1" },
                    { cl: "Entry 2" },
                    { cl: "Entry 3" },
                    { cl: "Entry 4" },
                ]}
            />,
        );
        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.unmount();
    });

    it("Test Dynamic container list output", () => {
        const component = mount<DynamicList>(
            <DynamicList
                id="list3"
                height={300}
                rowHeight={100}
                template={dynamicListEntry}
                elements={dynamicItems}
            />,
        );
        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.unmount();
    });
});
