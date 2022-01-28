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

import "./Grid.css";

import React from "react";
import { VariableSizeGrid, FixedSizeGrid, GridChildComponentProps } from "react-window";

import { Component, IComponentProperties } from "../Component/Component";
import { DynamicItemSizeFunction } from "..";

export interface IDynamicGridProperties extends IComponentProperties {
    height: number;  // This control requires fixed dimensions.
    width: number;

    columnCount: number;
    columnWidth: number | DynamicItemSizeFunction;

    rowCount: number;
    rowHeight: number | DynamicItemSizeFunction;

    onRenderCell?: (row: number, column: number, style: React.CSSProperties) => React.ReactNode;
}

// A component with dynamic grid layout (not using CSS grid box).
export class DynamicGrid extends Component<IDynamicGridProperties> {

    public static defaultProps = {
    };

    public constructor(props: IDynamicGridProperties) {
        super(props);

        this.addHandledProperties("heigh", "width", "columnCount", "columnWidth", "rowCount", "rowHeight",
            "onRenderCell");
    }

    public render(): React.ReactNode {
        const { height, width, columnCount, columnWidth, rowCount, rowHeight, onRenderCell } = this.mergedProps;
        const className = this.getEffectiveClassNames(["dynamicGrid"]);
        const outerElementType = this.renderAs(undefined); // Use the default type of the grid if nothing was specified.

        // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any
        const GridType: any =
            typeof columnWidth === "number" && typeof rowHeight === "number" ? FixedSizeGrid : VariableSizeGrid;

        return (
            <GridType
                outerElementType={outerElementType}
                width={width}
                height={height}
                className={className}
                columnCount={columnCount}
                rowCount={rowCount}
                columnWidth={columnWidth}
                rowHeight={rowHeight}
                overscanColumnCount={5}
                overscanRowCount={5}
                {...this.unhandledProperties}
            >
                {({ columnIndex, rowIndex, style }: GridChildComponentProps): React.ReactNode => {
                    return onRenderCell?.(rowIndex, columnIndex, style);
                }}
            </GridType>
        );
    }

}
