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

import "./Dropdown.css";

import React from "react";
import { isNil } from "lodash";

import { Component, IComponentProperties, Checkbox, Label, Container, Image, Icon, CheckState } from "..";
import { ContentAlignment, Orientation } from "../Container/Container";

export interface IDropdownItemProperties extends IComponentProperties {
    caption?: string;
    picture?: React.ReactElement<Image | Icon>;
    description?: string;
    selected?: boolean;
    checked?: boolean; // If given then a checkbox is shown (and checked/unchecked).
}

export class DropdownItem<T extends IDropdownItemProperties> extends Component<T> {

    public constructor(props: T) {
        super(props);

        this.addHandledProperties("caption", "picture", "description", "checked");
    }

    public render(): React.ReactNode {
        const { caption, picture, selected, checked, children } = this.mergedProps;
        const className = this.getEffectiveClassNames([
            "dropdownItem",
            "ellipsis",
            "verticalCenterContent",
            this.classFromProperty(selected, "selected"),
        ]);

        let content = children as React.ReactNode | React.ReactNode[] | undefined;
        if (!content) {
            if (!isNil(checked)) {
                content = <Checkbox
                    checkState={checked ? CheckState.Checked : CheckState.Unchecked}
                    caption={caption}
                />;

            } else {
                if (picture) {
                    content = <Container
                        orientation={Orientation.LeftToRight}
                        crossAlignment={ContentAlignment.Center}
                    >
                        {picture}
                        {caption && <Label>{caption}</Label>}
                    </Container>;
                } else {
                    content = <Label>{caption}</Label>;
                }
            }
        }

        return (
            <Container
                className={className}
                {...this.unhandledProperties}
            >
                {content}
            </Container>
        );
    }

}
