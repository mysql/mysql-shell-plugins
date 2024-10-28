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

import { ComponentChild } from "preact";

import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";
import { IDictionary } from "../../../app-logic/general-types.js";
import { Orientation, ContentAlignment, Container } from "../Container/Container.js";

/**
 * Grid cells use a container as HTML element and hence support its content layout.
 * If a custom HTML element is used for a cell then it must be using the flex layout
 * for these settings to have an effect.
 */
interface IGridCellProperties extends IComponentProperties {
    columnSpan?: number;
    rowSpan?: number;
    orientation?: Orientation;
    mainAlignment?: ContentAlignment;
    crossAlignment?: ContentAlignment;
}

// A single row in a grid layout.
export class GridCell extends ComponentBase<IGridCellProperties> {

    public constructor(props: IGridCellProperties) {
        super(props);

        this.addHandledProperties("columnSpan", "rowSpan", "orientation", "mainAlignment", "crossAlignment", "style");
    }

    public render(): ComponentChild {
        const {
            style = {}, columnSpan, rowSpan, orientation, mainAlignment, crossAlignment, children,
        } = this.props;

        if (rowSpan) {
            style.gridRow = `span ${rowSpan}`;
        }
        if (columnSpan) {
            style.gridColumn = `span ${columnSpan}`;
        }

        const className = this.getEffectiveClassNames(["gridCell"]);

        const otherProps: IDictionary = {};
        otherProps.mainAlignment = mainAlignment;
        otherProps.crossAlignment = crossAlignment;
        otherProps.orientation = orientation;

        return (
            <Container
                className={className}
                style={style}
                {...otherProps}
                {...this.unhandledProperties}
            >
                {children}
            </Container >
        );
    }

}
