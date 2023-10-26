/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import "tabulator-tables//dist/css/tabulator_simple.min.css";
import "./TreeGrid.css";

import {
    Tabulator, DataTreeModule, SelectRowModule, ReactiveDataModule, MenuModule, ResizeTableModule,
    ResizeColumnsModule, FormatModule, InteractionModule, EditModule, FilterModule, SortModule, ResizeRowsModule,
    RowComponent, ColumnComponent, ColumnDefinition, CellComponent, Options,
} from "tabulator-tables";

import { ComponentChild, createRef } from "preact";

import { waitFor } from "../../../utilities/helpers.js";
import { appParameters } from "../../../supplement/Requisitions.js";
import { SelectionType, IComponentProperties, ComponentBase } from "../Component/ComponentBase.js";

/** This type excludes methods from the Tabulator type, which are implemented in the TreeGrid. */
export type TabulatorProxy = Omit<Tabulator, "setData" | "setColumns" | "getSelectedRows">;

export enum SetDataAction {
    /** Like Set, but doesn't do any additional handling like scrolling, filtering, sorting and so on. */
    Replace,

    /** Requires an index field in each row and updates only existing data (for matching indexes) */
    Update,

    /** Adds new records to existing data. */
    Add,

    /** Full update of the grid content. */
    Set,
}

interface ITreeGridMenuEntry {
    label?: string | ((component: RowComponent) => string);
    disabled?: boolean;
    separator?: boolean;

    menu?: ITreeGridMenuEntry[]; // For sub menus.

    action?: (e: Event, column: ColumnComponent) => void;
}

/** Options to fine tune the behavior/look of the tree beyond the component properties. */
export interface ITreeGridOptions {
    /** The field name in the tree data, which uniquely identifies a record/row (default: "id") */
    index?: string;

    /** The field name in the tree data, which contains child node data (default: children). */
    childKey?: string;

    /**
     * The field name of the column to use for the outline.
     * If specified it enables the display of a tree in that column.
     */
    treeColumn?: string;

    /** The number of pixels child nodes should be indented */
    treeChildIndent?: number;

    /** Determines how columns are initially layed out (default: none). */
    layout?: "fitData" | "fitDataFill" | "fitDataStretch" | "fitDataTable" | "fitColumns";

    /** If true then columns are laid out again when new data arrives (default: false). */
    layoutColumnsOnNewData?: boolean;

    /** If false, no header is shown (default: true). */
    showHeader?: boolean;

    /** If true horizontal and/or vertical grid lines are shown. */
    verticalGridLines?: boolean;
    horizontalGridLines?: boolean;

    /** If true, odd rows get a slightly lighter background. */
    alternatingRowBackgrounds?: boolean;

    selectionType?: SelectionType;

    /** Used to expand specific levels in the tree on first display. */
    expandedLevels?: boolean[];

    /** If true then the user can vertically resize rows using the mouse. */
    resizableRows?: boolean;

    /** If true then the grid content is scrolled to the first selected item if the selection is modified. */
    autoScrollOnSelect?: boolean;
}

interface ITreeGridProperties extends IComponentProperties {
    height?: string | number;

    /**
     * For convenience these fields allow to specify initial (or static) data.
     * Most of the time you want to use `setColumns` and `setData` instead.
     */
    columns?: ColumnDefinition[];
    tableData?: unknown[];

    /**
     * A list of row IDs that should be selected initially.
     * Note that the specified selection mode might limit that list (no selection or single selection).
     */
    selectedIds?: string[];
    options?: ITreeGridOptions;

    /** Menu entries for Tabulator provided menu. Do not mix with the `onRowContext` member. */
    rowContextMenu?: ITreeGridMenuEntry[];

    onRowExpanded?: (row: RowComponent, level: number) => void;
    onRowCollapsed?: (row: RowComponent, level: number) => void;

    /** Return the initial expansion state of the given row. */
    isRowExpanded?: (row: RowComponent, level: number) => boolean;

    onFormatRow?: (row: RowComponent) => void;

    /** Triggered when a row context is required. It allows to show an own menu implementation. */
    onRowContext?: (event: Event, row: RowComponent) => void;

    /** Ditto for single cells. */
    onCellContext?: (event: Event, cell: CellComponent) => void;

    onRowSelected?: (row: RowComponent) => void;
    onRowDeselected?: (row: RowComponent) => void;
    onVerticalScroll?: (top: number) => void;
    onColumnResized?: (column: ColumnComponent) => void;
}

/**
 * This component shows data in dynamic lists with or without a tree column, or can show only a tree.
 * It differs in the way data is added from other controls. Data (columns, rows) can be passed in as properties and
 * can also be added on demand using the methods `setColumns` and `setRows`.
 */
export class TreeGrid extends ComponentBase<ITreeGridProperties> {

    private hostRef = createRef<HTMLDivElement>();
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

        // Defer the creation of the table a bit, because it directly manipulates the DOM and that randomly
        // fails with preact, if the table is created directly on mount.
        this.timeoutId = setTimeout(() => {
            // istanbul ignore else
            if (this.hostRef.current) {
                // The tabulator options can contain data, passed in as properties.
                this.timeoutId = null;
                this.tabulator = new Tabulator(this.hostRef.current, this.tabulatorOptions);
                this.tabulator.on("tableBuilt", () => {
                    const { selectedIds } = this.mergedProps;

                    // The tabulator field must be assigned. We are in one of its events.
                    this.tabulator!.off("tableBuilt");
                    if (selectedIds) {
                        this.tabulator!.selectRow(selectedIds);
                    }

                    // Assign the table holder class our fixed scrollbar class too.
                    if (this.hostRef.current) {
                        (this.hostRef.current?.lastChild as HTMLElement).classList.add("fixedScrollbar");
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
            }
        }, 10);
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

            // Determine the current vertical scroll position.
            const scrollPosition = this.tabulator.rowManager.scrollTop;
            if (tableData) {
                // The call to replaceData does not change the scroll position.
                void this.tabulator.replaceData(tableData as Array<{}>).then(() => {
                    if (columns) {
                        // The call to setColumns does.
                        this.tabulator?.setColumns(columns);
                    }

                    // Both columns and rows have been set. Now update the UI.
                    this.tabulator?.redraw();
                    if (selectedIds) {
                        this.tabulator?.selectRow(selectedIds);
                    }

                    // Restore the scroll position.
                    this.tabulator!.rowManager.scrollTop = scrollPosition;
                    this.tabulator!.rowManager.element.scrollTop = scrollPosition;

                });
            } else if (selectedIds) {
                if (columns) {
                    this.tabulator.setColumns(columns);
                }

                this.tabulator.selectRow(selectedIds);
            }
        }
    }

    public render(): ComponentChild {
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

    public setColumns(columns: ColumnDefinition[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this.table.then(() => {
                this.tabulator?.setColumns(columns);
                resolve();
            }).catch((reason) => {
                reject(reason);
            });
        });
    }

    public async setData(data: unknown[], action: SetDataAction): Promise<void> {
        const table = await this.table;

        switch (action) {
            case SetDataAction.Replace: {
                await table?.replaceData(data as Array<{}>);

                break;
            }

            case SetDataAction.Update: {
                await table?.updateData(data as Array<{}>);

                break;
            }

            case SetDataAction.Set: {
                await (table as Tabulator)?.setData(data);

                break;
            }

            default: { // Add
                await table?.addData(data as Array<{}>);

                break;
            }
        }
    }

    /**
     * @returns all rows currently in the table.
     */
    public getRows(): RowComponent[] {
        if (this.tableReady && this.tabulator) {
            return this.tabulator.getRows();
        }

        return [];
    }

    /** @returns the currently selected rows in the table. */
    public getSelectedRows(): RowComponent[] {
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
    private get tabulatorOptions(): Options {
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

        const result: Options = {
            debugInvalidOptions: appParameters.inDevelopment,

            index: options?.index ?? "id",
            columns,
            data: tableData,

            dataTree: options?.treeColumn != null,
            dataTreeChildIndent: options?.treeChildIndent ?? 0,
            dataTreeChildField: options?.childKey ?? "children",
            dataTreeElementColumn: options?.treeColumn,
            dataTreeExpandElement: "<span class='treeToggle' />",
            dataTreeCollapseElement: "<span class='treeToggle expanded' />",
            dataTreeBranchElement: true,
            // dataTreeChildIndent: 0,
            dataTreeStartExpanded: options?.expandedLevels ?? false,

            rowFormatter: onFormatRow,

            headerVisible: options?.showHeader ?? true,
            selectable,
            selectableRangeMode: "click",
            reactiveData: false, // Very slow when enabled.

            rowContextMenu,

            autoResize: true,
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

    private handleRowExpanded = (row: RowComponent, level: number): void => {
        const { onRowExpanded } = this.mergedProps;
        row.getElement().classList.add("expanded");

        onRowExpanded?.(row, level);
    };

    private handleRowCollapsed = (row: RowComponent, level: number): void => {
        const { onRowCollapsed } = this.mergedProps;

        row.getElement().classList.remove("expanded");

        onRowCollapsed?.(row, level);
    };

    private handleRowContext = (event: Event, row: RowComponent): void => {
        const { onRowContext } = this.mergedProps;

        onRowContext?.(event, row);
    };

    private handleCellContext = (event: Event, cell: CellComponent): void => {
        const { onCellContext } = this.mergedProps;

        onCellContext?.(event, cell);
    };

    private handleRowSelected = (row: RowComponent): void => {
        const { options } = this.mergedProps;
        if (options?.treeColumn) {
            // Toggle the selected row if this is actually a tree.
            row.treeToggle();
        }

        if (options?.autoScrollOnSelect) {
            const selected = this.tabulator?.getSelectedRows() ?? [];
            if (selected.length > 0) {
                void this.tabulator?.scrollToRow(selected[0], "center", false);
            }
        }

        const { onRowSelected } = this.mergedProps;

        onRowSelected?.(row);
    };

    private handleRowDeselected = (row: RowComponent): void => {
        const { onRowDeselected } = this.mergedProps;

        onRowDeselected?.(row);
    };

    private handleColumnResized = (column: ColumnComponent): void => {
        const { onColumnResized } = this.mergedProps;

        onColumnResized?.(column);
    };
}

// TODO: replace with static initializer, once we can raise eslint to support ES2022.
TreeGrid.initialize();
