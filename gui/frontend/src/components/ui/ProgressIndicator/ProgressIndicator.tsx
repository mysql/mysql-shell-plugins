/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import "./ProgressIndicator.css";

import { ComponentChild } from "preact";

import { IComponentProperties, ComponentBase } from "../Component/ComponentBase.js";
import { Container, Orientation, ContentAlignment } from "../Container/Container.js";

interface IProgressIndicatorProperties extends IComponentProperties {
    /** The opacity of the indicator host container (default: 1). */
    backgroundOpacity?: number;

    /** True for a linear indicator, false for a circular one (default: false). */
    linear?: boolean;

    /**
     * A value between 0 and 1 (inclusive, default: undefined).
     * If no position is specified, the indicator will be indeterminate.
     */
    position?: number;

    /**
     * Manually specify a width and height value for the indicator itself (not the host).
     * If not given default values are used, depending on the indicator style.
     * For circular indicators both values should be equal.
     */
    indicatorWidth?: number;
    indicatorHeight?: number;
    stroke?: number;
}

export class ProgressIndicator extends ComponentBase<IProgressIndicatorProperties> {

    public render(): ComponentChild {
        const {
            id, backgroundOpacity = 1, linear = false, position, indicatorWidth,
            indicatorHeight, style, stroke,
        } = this.props;
        const className = this.getEffectiveClassNames(["progressIndicatorHost"]);

        const strokeWidth = stroke ?? 5; // Only for circles. Make this configurable?

        let indicator;
        let width = indicatorWidth ?? 400;
        let height = indicatorHeight ?? 10;
        if (linear) {
            const barClassName = position == null ? "linear animated" : "linear";
            indicator = <div className="linearBackground">
                <div className={barClassName} />
            </div>;
        } else {
            width = indicatorWidth ?? 80;
            height = indicatorHeight ?? 80;

            const circleClassName = position == null ? "circleBackground animated" : "circleBackground";
            const radius = (width - 2 * strokeWidth) / 2;
            const offset = (width - strokeWidth) / 2;
            indicator = <svg className={circleClassName}>
                <circle cx={offset} cy={offset} r={radius} />
                <circle cx={offset} cy={offset} r={radius} />
            </svg>;
        }

        const indicatorStyle = {
            ...{
                /* eslint-disable @typescript-eslint/naming-convention */
                "opacity": backgroundOpacity,
                "--position": position ?? 0,
                "--width": width,
                "--height": height,
                "--strokeWidth": strokeWidth,
                /* eslint-enable @typescript-eslint/naming-convention */
            }, ...style,
        };

        return (
            <Container
                id={id}
                className={className}
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Center}
                crossAlignment={ContentAlignment.Center}
                style={indicatorStyle}
            >
                {indicator}
            </Container>
        );
    }
}
