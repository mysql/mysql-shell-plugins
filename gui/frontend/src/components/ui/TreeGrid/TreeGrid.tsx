/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import "./TreeGrid.css";

import {
    Tabulator, DataTreeModule, SelectRowModule, ReactiveDataModule, MenuModule, ResizeTableModule,
    ResizeColumnsModule, FormatModule, InteractionModule, EditModule, FilterModule, SortModule,
} from "tabulator-tables";

import React from "react";
import { isNil } from "lodash";

import { IComponentProperties, Component, SelectionType } from "..";

export { Tabulator } from "tabulator-tables";

export interface ITreeGridMenuEntry {
    label?: string | ((component: Tabulator.RowComponent) => string);
    disabled?: boolean;
    separator?: boolean;

    menu?: ITreeGridMenuEntry[]; // For sub menus.

    action?: (e: Event, column: Tabulator.ColumnComponent) => void;
}

// Options to fine tune the behavior/look of the tree beyond the component properties.
export interface ITreeGridOptions {
    // The field name in the tree data, which contains child node data (default: children).
    childKey?: string;

    // The field name of the column to use for the outline.
    // If specified it enables the display of a tree in that column.
    treeColumn?: string;

    // Determines how columns are initially layed out (default: none).
    layout?: "fitData" | "fitDataFill" | "fitDataStretch" | "fitDataTable" | "fitColumns";

    // If true then columns are laid out again when new data arrives (default: false).
    layoutColumnsOnNewData?: boolean;

    // If false, no header is shown (default: true).
    showHeader?: boolean;

    // If true horizontal and/or vertical grid lines are shown.
    verticalGridLines?: boolean;
    horizontalGridLines?: boolean;

    // If true, odd rows get a slightly lighter background.
    alternatingRowBackgrounds?: boolean;

    selectionType?: SelectionType;

    // Used to expand specific levels in the tree on first display.
    expandedLevels?: boolean[];

}

export interface ITreeGridProperties extends IComponentProperties {
    height?: number;
    columns: Tabulator.ColumnDefinition[];

    // A list of objects each with a member for each column.
    tableData: unknown[];

    // A list of row IDs that should be selected initially.
    // Note that the specified selection mode might limit that list (no selection or single selection).
    selectedIds?: string[];
    options?: ITreeGridOptions;

    // Menu entries for Tabulator provided menu. Do not mix with the `onRowContext` member.
    rowContextMenu?: ITreeGridMenuEntry[];

    onRowExpanded?: (row: Tabulator.RowComponent, level: number) => void;
    onRowCollapsed?: (row: Tabulator.RowComponent, level: number) => void;

    // Return the initial expansion state of the given row.
    isRowExpanded?: (row: Tabulator.RowComponent, level: number) => boolean;

    onFormatRow?: (row: Tabulator.RowComponent) => void;

    // Triggered when a row context is required. It allows to show an own menu implementation.
    onRowContext?: (event: Event, row: Tabulator.RowComponent) => void;

    // Ditto for single cells.
    onCellContext?: (event: Event, cell: Tabulator.CellComponent) => void;

    onRowSelected?: (row: Tabulator.RowComponent) => void;
    onRowDeselected?: (row: Tabulator.RowComponent) => void;

    onVerticalScroll?: (top: number) => void;

    onColumnResized?: (column: Tabulator.ColumnComponent) => void;
}

// This component shows data in dynamic lists with or without a tree column, or can show only a tree.
// Currently this component is neither fully controlled, nor fully uncontrolled, which implies some problems.
export class TreeGrid extends Component<ITreeGridProperties> {

    private hostRef = React.createRef<HTMLDivElement>();
    private tabulator?: Tabulator;
    private tableReady = false;

    public constructor(props: ITreeGridProperties) {
        super(props);

        this.addHandledProperties(
            "height", "columns", "tableData", "options", "selectedIds", "rowContextMenu", "onRowExpanded",
            "onRowCollapsed", "isRowExpanded", "onFormatRow", "onRowContext", "onCellContext", "onRowSelected",
            "onRowDeselected", "onVerticalScroll", "onColumnResized",
        );
    }

    public static initialize(): void {
        Tabulator.registerModule([DataTreeModule, SelectRowModule, ReactiveDataModule, MenuModule, ResizeTableModule,
            ResizeColumnsModule, FormatModule, InteractionModule, EditModule, FilterModule, SortModule]);
    }

    public componentDidMount(): void {
        const { onVerticalScroll } = this.mergedProps;

        if (this.hostRef.current) {
            this.tabulator = new Tabulator(this.hostRef.current, this.tabulatorOptions);
            this.tabulator.on("tableBuilt", () => {
                const { selectedIds, tableData, columns } = this.mergedProps;

                this.tableReady = true;
                if (this.tabulator) {
                    this.tabulator.off("tableBuilt");

                    if (selectedIds) {
                        this.tabulator.selectRow(selectedIds);
                    }

                    this.tabulator.setColumns(columns);
                    void this.tabulator.setData(tableData);
                }

                // Assign the table holder class our fixed scrollbar class too.
                if (this.hostRef.current) {
                    (this.hostRef.current.lastChild as HTMLElement).classList.add("fixedScrollbar");
                }
            });

            this.tabulator.on("dataTreeRowExpanded", this.handleRowExpanded);
            this.tabulator.on("dataTreeRowCollapsed", this.handleRowCollapsed);
            this.tabulator.on("rowContext", this.handleRowContext);
            this.tabulator.on("cellContext", this.handleCellContext);
            this.tabulator.on("rowSelected", this.handleRowSelected);
            this.tabulator.on("rowDeselected", this.handleRowDeselected);
            this.tabulator.on("columnResized", this.handleColumnResized);

            if (onVerticalScroll) {
                this.tabulator.on("scrollVertical", onVerticalScroll);
            }

            const { selectedIds } = this.mergedProps;

            if (selectedIds) {
                this.tabulator.selectRow(selectedIds);
            }

        }
    }

    /**
     * This method is necessary to update the grid on re-render (e.g. when switching between tabs, each having
     * a grid on it).
     */
    public componentDidUpdate(): void {
        if (this.tabulator && this.tableReady) {
            const { selectedIds, tableData, columns } = this.mergedProps;

            if (selectedIds) {
                this.tabulator.selectRow(selectedIds);
            }

            this.tabulator.setColumns(columns);
            void this.tabulator.setData(tableData);
        }
    }

    public render(): React.ReactNode {
        const { options } = this.mergedProps;

        const className = this.getEffectiveClassNames([
            "treeGrid",
            this.classFromProperty(options?.horizontalGridLines, "horizontalGrid"),
            this.classFromProperty(options?.verticalGridLines, "verticalGrid"),
            this.classFromProperty(options?.alternatingRowBackgrounds, "alternatingRows"),
        ]);

        return (
            <div
                ref={this.hostRef}
                className={className}
                {...this.unhandledProperties}
            />
        );
    }

    /**
     * Provides access to the underlying Tabulator table object.
     *
     * @returns The table directly if it is already mounted and built. Otherwise a promise is returned which resolves
     *          once the table is accessible.
     */
    public get table(): Promise<Tabulator> | Tabulator {
        if (this.tableReady) {
            return this.tabulator!;
        }

        const resolver = (resolve: (value: Tabulator | PromiseLike<Tabulator>) => void): void => {
            if (this.tableReady && this.tabulator) {
                resolve(this.tabulator);
            } else {
                setTimeout(() => { resolver(resolve); }, 100);
            }
        };

        return new Promise((resolve) => {
            setTimeout(() => { resolver(resolve); }, 100);
        });
    }

    /**
     * Transforms the component properties into a tabulator options object.
     *
     * @returns The tabulator options.
     */
    private get tabulatorOptions(): Tabulator.Options {
        const {
            columns, tableData, options, rowContextMenu, isRowExpanded, onFormatRow,
        } = this.mergedProps;

        let selectable: number | boolean | "highlight";
        switch (options?.selectionType) {
            case SelectionType.Highlight: {
                selectable = "highlight";
                break;
            }

            case SelectionType.Single: {
                selectable = 1;
                break;
            }

            case SelectionType.Multi: {
                selectable = true;
                break;
            }

            default: {
                selectable = false;
                break;
            }
        }

        const result: Tabulator.Options = {
            debugInvalidOptions: true,

            columns,
            data: tableData,

            dataTree: !isNil(options?.treeColumn),
            dataTreeChildField: options?.childKey ?? "children",
            dataTreeElementColumn: options?.treeColumn,
            dataTreeExpandElement: "<span class='treeToggle' />",
            dataTreeCollapseElement: "<span class='treeToggle expanded' />",
            dataTreeBranchElement: true,
            dataTreeChildIndent: 18,
            dataTreeStartExpanded: options?.expandedLevels ?? false,

            rowFormatter: onFormatRow,

            headerVisible: options?.showHeader ?? true,
            selectable,
            selectableRangeMode: "click",
            reactiveData: false, // Very slow when enabled.

            rowContextMenu,

            autoResize: true,
            layoutColumnsOnNewData: options?.layoutColumnsOnNewData,

            // We have to set a fixed height to enable the virtual DOM in Tabulator. However this is a severe
            // limitation in flex box layouts, which need extra counter measures.
            height: "100%",
        };

        // Tabulator is not consistent when dealing with missing callback functions. In some situations it tests for
        // null before accessing a callback, and sometimes it does not and creates an exception when null is assigned.
        if (isRowExpanded) {
            result.dataTreeStartExpanded = isRowExpanded;
        }

        if (options?.layout) {
            result.layout = options.layout;
        }

        return result;
    }

    private handleRowExpanded = (row: Tabulator.RowComponent, level: number): void => {
        const { onRowExpanded } = this.mergedProps;
        row.getElement().classList.add("expanded");

        onRowExpanded?.(row, level);
    };

    private handleRowCollapsed = (row: Tabulator.RowComponent, level: number): void => {
        const { onRowCollapsed } = this.mergedProps;

        row.getElement().classList.remove("expanded");

        onRowCollapsed?.(row, level);
    };

    private handleRowContext = (event: Event, row: Tabulator.RowComponent): void => {
        const { onRowContext } = this.mergedProps;

        onRowContext?.(event, row);
    };

    private handleCellContext = (event: Event, cell: Tabulator.CellComponent): void => {
        const { onCellContext } = this.mergedProps;

        onCellContext?.(event, cell);
    };

    private handleRowSelected = (row: Tabulator.RowComponent): void => {
        const { options } = this.mergedProps;
        if (!isNil(options?.treeColumn)) {
            // Toggle the selected row if this is actually a tree.
            row.treeToggle();
        }

        const { onRowSelected } = this.mergedProps;

        onRowSelected?.(row);
    };

    private handleRowDeselected = (row: Tabulator.RowComponent): void => {
        const { onRowDeselected } = this.mergedProps;

        onRowDeselected?.(row);
    };

    private handleColumnResized = (column: Tabulator.ColumnComponent): void => {
        const { onColumnResized } = this.mergedProps;

        onColumnResized?.(column);
    };
}

TreeGrid.initialize();
