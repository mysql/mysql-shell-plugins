/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import "./Icon.css";

import { ComponentChild } from "preact";

import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";
import { convertPropValue } from "../../../utilities/string-helpers.js";
import { Codicon, iconNameMap } from "../Codicon.js";

// Icons are images whose color can be set. Colors in the image itself are ignored.
export interface IIconProperties extends IComponentProperties {
    disabled?: boolean;
    src?: string | Codicon;
    width?: string | number;
    height?: string | number;
    color?: string;
}

export class Icon extends ComponentBase<IIconProperties> {
    public static override defaultProps = {
        disabled: false,
    };

    public constructor(props: IIconProperties) {
        super(props);

        this.addHandledProperties("disabled", "src", "style", "height", "width", "color");
    }

    public render(): ComponentChild {
        const { disabled, src, style, height, width, color } = this.props;
        let className = this.getEffectiveClassNames([
            "icon",
            this.classFromProperty(disabled, "disabled"),
        ]);

        let newStyle;
        if (typeof src === "string") {
            // A path was given.
            newStyle = {
                maskImage: `url("${src}")`,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                WebkitMaskImage: `url("${src}")`,
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

        return (
            <div
                className={className}
                style={newStyle}
                {...this.unhandledProperties}
            />
        );
    }

}
