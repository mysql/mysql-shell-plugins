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

import "./List.css";

import React from "react";
import { FixedSizeList, VariableSizeList } from "react-window";

import { Component, IComponentProperties } from "../Component/Component";
import { DynamicItemSizeFunction } from "..";
import { IDictionary } from "../../../app-logic/Types";

export interface IDynamicListProperties extends IComponentProperties {
    // This control requires a fixed height.
    height: number;

    // The height of an item. Can be a number size all items the same, or a callback to compute individual heights.
    rowHeight: number | DynamicItemSizeFunction;

    // The UI structure to render for each element.
    template: React.ReactElement;

    // A list of objects with data to fill in.
    elements: IDictionary[];
}

interface IListChildComponentProps extends IComponentProperties {
    index: number;
    style: object;
}

// This list is virtual, which means items are only rendered when in view. That allows for million of entries.
// However, this list uses absolute positioning for the items and can therefore not be used for ul/ol.
export class DynamicList extends Component<IDynamicListProperties> {

    public static defaultProps = {
    };

    public constructor(props: IDynamicListProperties) {
        super(props);

        this.addHandledProperties("height", "rowHeight", "template", "elements");
    }

    public render(): React.ReactNode {
        const { id, height, rowHeight, template, elements } = this.mergedProps;

        const baseId = id ?? "dynamicList";
        const className = this.getEffectiveClassNames(["dynamicList"]);

        // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any
        const ListType: any = (typeof rowHeight === "number") ? FixedSizeList : VariableSizeList;

        return (
            <ListType
                height={height}
                itemCount={elements.length}
                itemSize={rowHeight}
                className={className}
                innerElementType={this.renderAs()}
                overscanCount={3}
                {...this.unhandledProperties}
            >
                {({ index, style }: IListChildComponentProps): React.ReactElement => {
                    const elementId = elements[index].id ?? `${baseId}${index}`;

                    return React.cloneElement(template, {
                        id: elementId,
                        key: elementId as string,
                        data: elements[index % elements.length],
                        tabIndex: 0,
                        style,
                    });
                }}
            </ListType>
        );
    }

}
