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

import "./List.css";

import { cloneElement, ComponentChild, render, VNode } from "preact";

import { CellComponent, ColumnDefinition } from "tabulator-tables";

import { ComponentBase, IComponentProperties, IComponentState, SelectionType } from "../Component/ComponentBase.js";
import { IDictionary } from "../../../app-logic/Types.js";
import { ITreeGridOptions, TreeGrid } from "../TreeGrid/TreeGrid.js";

interface IDynamicListProperties extends IComponentProperties {
    // This control requires a fixed height.
    height: number;

    // The height of an item. Can be a number size all items the same, or a callback to compute individual heights.
    rowHeight?: number;

    // The UI structure to render for each element.
    template: VNode;

    // A list of objects with data to fill in.
    elements: IDictionary[];
}

interface IDynamicListState extends IComponentState {
    columnField: string;
}


// This list is virtual, which means items are only rendered when in view. That allows for million of entries.
// However, this list uses absolute positioning for the items and can therefore not be used for ul/ol.
export class DynamicList extends ComponentBase<IDynamicListProperties, IDynamicListState> {

    public constructor(props: IDynamicListProperties) {
        super(props);

        this.state = {
            columnField: this.columnField,
        };

        this.addHandledProperties("height", "rowHeight", "template", "elements");
    }

    public override componentDidUpdate(prevProps: IDynamicListProperties): void {
        const { elements } = this.mergedProps;

        // Note: we only do simple checks here. If the data changed in place no re-rendering will happen!
        if (prevProps.elements !== elements || prevProps.elements.length !== elements.length) {
            this.setState({ columnField: this.columnField });
        }
    }

    public render(): ComponentChild {
        const { height, elements } = this.mergedProps;
        const { columnField } = this.state;

        const className = this.getEffectiveClassNames(["dynamicList"]);

        const columns: ColumnDefinition[] = [{
            title: "",
            field: columnField,
            formatter: this.cellFormatter,
        }];

        const options: ITreeGridOptions = {
            layout: "fitColumns",
            verticalGridLines: false,
            horizontalGridLines: false,
            alternatingRowBackgrounds: false,
            selectionType: SelectionType.Highlight,
            showHeader: false,
        };

        return (
            <TreeGrid
                height={height}
                className={className}
                tableData={elements}
                columns={columns}
                options={options}
                {...this.unhandledProperties}
            />
        );
    }

    private cellFormatter = (cell: CellComponent): string | HTMLElement => {
        const { template, rowHeight } = this.mergedProps;
        const { columnField } = this.state;

        const host = document.createElement("div");
        host.classList.add("dynamicListEntry");
        if (rowHeight) {
            host.style.height = `${rowHeight}px`;
        }

        const element = cloneElement(template, {
            data: { [columnField]: cell.getValue() },
            tabIndex: 0,
        });

        render(element, host);

        return host;
    };

    /**
     * Determines the field ID to be used for column, to create an association between that and the data.
     *
     * @returns A string which can be used for the column field.
     */
    private get columnField(): string {
        const { elements } = this.mergedProps;

        // Take the column field id from the first element entry. All entries must have the same structure.
        if (elements.length > 0) {
            const keys = Object.keys(elements[0]);
            if (keys.length > 0) {
                return keys[0];
            }
        }

        return "data";
    }
}
