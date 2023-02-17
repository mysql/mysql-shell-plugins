/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import "./Grid.css";

import { ComponentChild } from "preact";

import { convertPropValue } from "../../../utilities/string-helpers";
import { IComponentProperties, ComponentBase } from "../Component/ComponentBase";

interface IGridProperties extends IComponentProperties {
    rowGap?: string | number;    // Spacing between rows in the grid.
    columnGap?: string | number; // Ditto for columns;
    equalHeight?: boolean;       // If true, all rows have the same height (that of the largest row).

    // Column definition: a single number means just column count. An array specifies both, count and widths.
    columns: number | Array<number | string>;

    innerRef?: preact.RefObject<HTMLElement>;
}

// A standard CSS grid container with static cells.
export class Grid extends ComponentBase<IGridProperties> {

    public constructor(props: IGridProperties) {
        super(props);

        this.addHandledProperties("rowGap", "columnGap", "equalHeight", "columns", "style", "innerRef");
    }

    public render(): ComponentChild {
        const { children, rowGap, columnGap, equalHeight, columns, style, innerRef } = this.mergedProps;
        const className = this.getEffectiveClassNames([
            "grid",
            this.classFromProperty(equalHeight, "equalHeight"),
        ]);

        let columnsSpec;
        if (typeof columns === "number") {
            columnsSpec = `repeat(${columns}, 1fr)`;
        } else {
            const sizes = columns.map((column): string | undefined => {
                return convertPropValue(column);
            });

            columnsSpec = sizes.join(" ");
        }

        const newStyle = {
            ...style,
            gridTemplateColumns: columnsSpec,
            rowGap: convertPropValue(rowGap),
            columnGap: convertPropValue(columnGap),
        };

        return (
            <div
                ref={innerRef as preact.RefObject<HTMLDivElement>}
                className={className}
                style={newStyle}
                {...this.unhandledProperties}
            >
                {children}
            </div>
        );
    }

}
