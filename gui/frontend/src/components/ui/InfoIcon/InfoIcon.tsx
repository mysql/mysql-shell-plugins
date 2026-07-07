/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
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

import "./InfoIcon.css";

import { ComponentChild } from "preact";

import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";
import { Codicon } from "../Codicon.js";
import { Icon } from "../Icon/Icon.js";

export interface IInfoIconProperties extends IComponentProperties {
    tooltip: string;
}

/** A reusable information icon with the application's standard hover tooltip. */
export class InfoIcon extends ComponentBase<IInfoIconProperties> {
    public constructor(props: IInfoIconProperties) {
        super(props);

        this.addHandledProperties("tooltip");
    }

    public render(): ComponentChild {
        const { tooltip } = this.props;

        return (
            <Icon
                className={this.getEffectiveClassNames(["infoIcon"])}
                src={Codicon.Info}
                data-tooltip={tooltip}
                aria-label={tooltip}
                {...this.unhandledProperties}
            />
        );
    }
}
