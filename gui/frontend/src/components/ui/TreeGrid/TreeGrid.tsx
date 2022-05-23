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
    ResizeColumnsModule, FormatModule, InteractionModule, EditModule, FilterModule, SortModule, ResizeRowsModule,
} from "tabulator-tables";

import React from "react";
import { isNil } from "lodash";

import { IComponentProperties, Component, SelectionType } from "..";
import { waitFor } from "../../../utilities/helpers";
import { appParameters } from "../../../supplement/Requisitions";

export { Tabulator } from "tabulator-tables";

// This type excludes methods from the Tabulator type, which are implemented in the TreeGrid.
export type TabulatorProxy = Omit<Tabulator, "setData" | "setColumns" | "getSelectedRows">;

export enum SetDataAction {
    Replace, // Like Set, but doesn't do any additional handling like scrolling, filtering, sorting and so on.
    Update,  // Requires an index field in each row and updates only existing data (for matching indexes).
    Add,     // Adds new records to existing data.
    Set,     // Full update of the grid content.
}

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

    resizableRows?: boolean;
}

export interface ITreeGridProperties extends IComponentProperties {
    height?: string | number;

    // For convenience these fields allow to specify initial (or static) data.
    // Most of the time you want to use `setColumns` and `setData` instead.
    columns?: Tabulator.ColumnDefinition[];
    tableData?: unknown[];

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
// It differs in the way data is added from other controls. Data (columns, rows) can be passed in as properties and
// can also be added on demand using the methods `setColumns` and `setRows`.
export class TreeGrid extends Component<ITreeGridProperties> {

    private hostRef = React.createRef<HTMLDivElement>();
    private tabulator?: Tabulator;
    private tableReady = false;
    private timeoutId: ReturnType<typeof setTimeout> | null;

    // A counter to manage redraw blocks.
    private updateCount = 0;

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
            ResizeColumnsModule, FormatModule, InteractionModule, EditModule, FilterModule, SortModule,
            ResizeRowsModule]);
    }

    public componentDidMount(): void {
        const { onVerticalScroll } = this.mergedProps;

        if (this.hostRef.current) {
            // Defer the creation of the table a bit, because it directly manipulates the DOM and that randomly
            // fails with preact, if the table is created directly on mount.
            this.timeoutId = setTimeout(() => {

                // The tabulator options can contain data, passed in as properties.
                this.timeoutId = null;
                this.tabulator = new Tabulator(this.hostRef.current!, this.tabulatorOptions);
                this.tabulator.on("tableBuilt", () => {
                    const { selectedIds } = this.mergedProps;
                    if (this.tabulator) {
                        this.tabulator.off("tableBuilt");
                        if (selectedIds) {
                            this.tabulator.selectRow(selectedIds);
                        }
                    }

                    // Assign the table holder class our fixed scrollbar class too.
                    if (this.hostRef.current) {
                        (this.hostRef.current.lastChild as HTMLElement).classList.add("fixedScrollbar");
                    }
                    this.tableReady = true;
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
            }, 10);
        }
    }

    public componentWillUnmount(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    public componentDidUpdate(): void {
        if (this.tabulator && this.tableReady) {
            const { selectedIds, columns, tableData } = this.mergedProps;

            if (columns) {
                this.tabulator.setColumns(columns);
            }

            if (tableData) {
                void this.tabulator.setData(tableData);
            }

            if (selectedIds) {
                this.tabulator.selectRow(selectedIds);
            }
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
     * @returns The table when it is available otherwise undefined.
     */
    public get table(): Promise<TabulatorProxy | undefined> {
        return new Promise((resolve) => {
            void waitFor(1000, () => {
                return this.tableReady;
            }).then((success) => {
                if (success) {
                    resolve(this.tabulator);
                } else {
                    resolve(undefined);
                }
            });
        });
    }

    public setColumns(columns: Tabulator.ColumnDefinition[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this.table.then(() => {
                this.tabulator?.setColumns(columns);
                resolve();
            }).catch((reason) => {
                reject(reason);
            });
        });
    }

    public setData(data: unknown[], action: SetDataAction): Promise<void> {
        return new Promise((resolve) => {
            void this.table.then((table) => {
                if (!table) {
                    resolve();

                    return;
                }

                switch (action) {
                    case SetDataAction.Add: {
                        void table.addData(data as Array<{}>).then(() => {
                            resolve();
                        });
                        break;
                    }

                    case SetDataAction.Replace: {
                        void table.replaceData(data as Array<{}>).then(() => {
                            resolve();
                        });
                        break;
                    }

                    case SetDataAction.Update: {
                        void table.updateData(data as Array<{}>).then(() => {
                            resolve();
                        });
                        break;
                    }

                    case SetDataAction.Set: {
                        void (table as Tabulator).setData(data as Array<{}>).then(() => {
                            resolve();
                        });
                        break;
                    }

                    default: {
                        resolve();
                    }
                }
            });
        });
    }

    public getSelectedRows(): Tabulator.RowComponent[] {
        if (this.tableReady && this.tabulator) {
            return this.tabulator.getSelectedRows();
        }

        return [];
    }

    /**
     * Sets the grid to a special mode where no visual updates are done until `endUpdate()` was called.
     * Calls to `beginUpdate()` and `endUpdate()` must be balanced to avoid a complete redraw block.
     */
    public beginUpdate(): void {
        if (this.tableReady && this.tabulator) {
            ++this.updateCount;
            if (this.updateCount === 1) {
                this.tabulator.blockRedraw();
            }
        }
    }

    /**
     * Decreases the update counter. If that counter becomes 0, normal rendering is enabled again.
     * Calls to `beginUpdate()` and `endUpdate()` must be balanced to avoid a complete redraw block.
     */
    public endUpdate(): void {
        if (this.tableReady && this.tabulator) {
            if (this.updateCount > 0) {
                --this.updateCount;
                if (this.updateCount === 0) {
                    this.tabulator.restoreRedraw();
                }
            }
        }
    }

    /**
     * Transforms the component properties into a tabulator options object.
     *
     * @returns The tabulator options.
     */
    private get tabulatorOptions(): Tabulator.Options {
        const {
            height = "100%", columns = [], tableData = [], options, rowContextMenu, isRowExpanded, onFormatRow,
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
            debugInvalidOptions: appParameters.inDevelopment,

            columns,
            data: tableData,

            dataTree: !isNil(options?.treeColumn),
            dataTreeChildField: options?.childKey ?? "children",
            dataTreeElementColumn: options?.treeColumn,
            dataTreeExpandElement: "<span class='treeToggle' />",
            dataTreeCollapseElement: "<span class='treeToggle expanded' />",
            dataTreeBranchElement: true,
            dataTreeChildIndent: 0,
            dataTreeStartExpanded: options?.expandedLevels ?? false,

            rowFormatter: onFormatRow,

            headerVisible: options?.showHeader ?? true,
            selectable,
            selectableRangeMode: "click",
            reactiveData: false, // Very slow when enabled.

            rowContextMenu,

            autoResize: false,
            layoutColumnsOnNewData: options?.layoutColumnsOnNewData,
            resizableRows: options?.resizableRows,

            // We have to set a fixed height to enable the virtual DOM in Tabulator. However this is a severe
            // limitation in flex box layouts, which need extra counter measures.
            height,
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

// TODO: replace with static initializer, once we can raise eslint to support ES2022.
TreeGrid.initialize();
