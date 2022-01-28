/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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

import { Component, IComponentProperties } from "../Component/Component";
import { Icon, Container, Label } from "..";
import { Orientation, ContentAlignment } from "../Container/Container";
import { Codicon } from "../Codicon";

export interface IActivityBarItemProperties extends IComponentProperties {
    active?: boolean;
    expand?: boolean;
    caption?: string;
    image?: string | Codicon;
}

export class ActivityBarItem extends Component<IActivityBarItemProperties> {

    public static defaultProps = {
        active: false,
        disabled: false,
        expand: false,
    };

    public constructor(props: IActivityBarItemProperties) {
        super(props);

        this.addHandledProperties("active", "expand", "title", "image");
    }

    public render(): React.ReactNode {
        const { active, expand, caption, image } = this.mergedProps;
        const className = this.getEffectiveClassNames([
            "activityBarItem",
            this.classFromProperty(active, "active"),
            this.classFromProperty(expand, "expanded"),
        ]);

        return (
            <Container
                className={className}
                role="button"
                orientation={Orientation.TopDown}
                crossAlignment={ContentAlignment.Center}
                {...this.unhandledProperties}
            >
                {image && <Icon src={image} data-tooltip="inherit" />}
                {caption && <Label data-tooltip="inherit">{caption}</Label>}
            </Container>
        );
    }
}
