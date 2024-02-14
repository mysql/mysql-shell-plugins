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

import "./ActivityBar.css";

import { ComponentChild } from "preact";

import { IComponentProperties, ComponentBase } from "../Component/ComponentBase.js";
import { Orientation } from "../Container/Container.js";
import { Selector } from "../Selector/Selector.js";

interface IActivityBarProperties extends IComponentProperties {
    borderWidth?: number;
}

/** A very simple wrapper class for a selector. Most of the customization work is done in the activity bar item. */
export class ActivityBar extends ComponentBase<IActivityBarProperties> {

    public constructor(props: IActivityBarProperties) {
        super(props);

        this.addHandledProperties("borderWidth", "style");
    }

    public render(): ComponentChild {
        const { borderWidth, children, style } = this.mergedProps;

        const className = this.getEffectiveClassNames([
            "activityBar",
        ]);

        const newStyle = {
            ...style, ...{
                // eslint-disable-next-line @typescript-eslint/naming-convention
                "--borderWidth": `${borderWidth || 0}px`,
            },
        };

        return (
            <Selector
                className={className}
                orientation={Orientation.TopDown}
                style={newStyle}
                {...this.unhandledProperties}
            >
                {children}
            </Selector>
        );
    }

}
