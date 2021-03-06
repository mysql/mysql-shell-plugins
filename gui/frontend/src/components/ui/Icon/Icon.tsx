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

import "./Icon.css";

import React from "react";

import { Component, IComponentProperties } from "../Component/Component";
import { convertPropValue } from "../../../utilities/string-helpers";
import { Codicon, iconNameMap } from "../Codicon";

// Icons are images whose color can be set. Colors in the image itself are ignored.
interface IIconProperties extends IComponentProperties {
    disabled?: boolean;
    src?: string | Codicon;
    width?: string | number;
    height?: string | number;
    color?: string;
}

export class Icon extends Component<IIconProperties> {
    public static defaultProps = {
        disabled: false,
    };

    public constructor(props: IIconProperties) {
        super(props);

        this.addHandledProperties("disabled", "src", "style", "height", "width", "color");
    }

    public render(): React.ReactNode {
        const { disabled, src, style, height, width, color } = this.mergedProps;
        let className = this.getEffectiveClassNames([
            "icon",
            this.classFromProperty(disabled, "disabled"),
        ]);

        let newStyle;
        if (typeof src === "string") {
            // A path was given.
            newStyle = {
                maskImage: `url(${src})`,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                WebkitMaskImage: `url(${src})`,
                ...style,
                width: convertPropValue(width),
                height: convertPropValue(height),
                backgroundColor: color,
            };
        } else if (src) {
            // Otherwise it's a codicon.
            newStyle = style;
            className += " codicon codicon-" + iconNameMap.get(src)!;
        }

        // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any
        const ElementType: any = this.renderAs();

        return (
            <ElementType
                className={className}
                style={newStyle}
                {...this.unhandledProperties}
            />
        );
    }

}
