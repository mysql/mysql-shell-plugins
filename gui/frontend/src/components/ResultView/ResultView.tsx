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

import "./ResultView.css";

import blobIcon from "../../assets/images/data-icons/data-blob.svg";
import geometryIcon from "../../assets/images/data-icons/data-geometry.svg";
import nullIcon from "../../assets/images/data-icons/data-null.svg";
// import vectorIcon from "../../assets/images/data-icons/data-vector.svg";
import jsonIcon from "../../assets/images/data-icons/data-json.svg";

import addRowIcon from "../../assets/images/plus.svg";

import { ComponentChild, createRef, render } from "preact";
import {
    CellComponent, ColumnComponent, ColumnDefinition, Editor, EditorParams, EmptyCallback, Formatter, FormatterParams,
    RowComponent, ValueBooleanCallback, ValueVoidCallback,
} from "tabulator-tables";

import { DBDataType, DialogType, IColumnInfo, MessageType } from "../../app-logic/general-types.js";
import { IResultSet, IResultSetRows } from "../../script-execution/index.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import { KeyboardKeys, saveArrayAsFile, saveTextAsFile, selectFile } from "../../utilities/helpers.js";
import { convertCamelToTitleCase, convertHexToBase64, formatBase64ToHex } from "../../utilities/string-helpers.js";
import { Button, IButtonProperties } from "../ui/Button/Button.js";
import {
    ComponentBase, ComponentPlacement, IComponentProperties, SelectionType,
} from "../ui/Component/ComponentBase.js";
import { Container, Orientation } from "../ui/Container/Container.js";
import { DateTime, IDateTimeChangeProperties, IDateTimeValueType } from "../ui/DataTime/DateTime.js";
import { Dropdown } from "../ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../ui/Dropdown/DropdownItem.js";
import { Icon } from "../ui/Icon/Icon.js";
import { IInputChangeProperties, Input } from "../ui/Input/Input.js";
import { TextAlignment } from "../ui/Label/Label.js";
import { Menu } from "../ui/Menu/Menu.js";
import { IMenuItemProperties, MenuItem } from "../ui/Menu/MenuItem.js";
import { ITreeGridOptions, SetDataAction, TreeGrid } from "../ui/TreeGrid/TreeGrid.js";
import { UpDown } from "../ui/UpDown/UpDown.js";
import { FieldEditor } from "./FieldEditor.js";

/** How we structure the formatter params used for the individual cell formatters. */
interface IFormatterParams {
    info: IColumnInfo;
}

/** Records a single change in a cell. The row it belongs to is the owner of this change. */
export interface IResultCellChange {
    /** The field index in the data set, as string. */
    field: string;

    /** The value that was set. */
    value: unknown;
}

/**
 * A collection of all changes per row in a result set.
 * Making use of the sparse nature of the array, the row index is used as the key.
 */
export type ResultRowChanges = Array<{
    /** A list of changes the user did for that row. */
    changes: IResultCellChange[];

    /** Marks this row as a removal candidate. */
    deleted: boolean;

    /** Marks this row as being new. */
    added: boolean;

    /** The original values for PK columns. This list is empty for new rows. */
    pkValues: unknown[];
}>;

/** A type describing what was the last keyboard or mouse event before a field editor lost focus. */
type LastInputType = "mousedown" | "shiftTab" | "tab" | "other";

export interface IResultViewProperties extends IComponentProperties {
    /** The result data to show. */
    resultSet: IResultSet;

    /**
     * Indicates of the result set can be edited. Watch out: this is more than the `resultSet.updatable`
     * as this also takes into account the existence of a primary key.
     */
    editable: boolean;

    /** Set by the host to indicate the user has explicitly started edit mode. */
    editModeActive: boolean;

    /** Index of the row to scroll the grid to in this view. */
    topRowIndex?: number;

    /**
     * The list of changes in the result set. This is a sparse array, where the index of a row change is also the
     * index into the rows list. Setting this value will override topRowIndex.
     */
    rowChanges?: ResultRowChanges;

    /** Allows to specify the index of a row, which is selected on next render. */
    selectRow?: number;

    /** Triggered when the user has started editing a field. */
    onFieldEditStart?: (row: number, field: string) => void;

    /** Triggered when the user has finished editing a field. */
    onFieldEdited?: (row: number, field: string, value: unknown, previousValue: unknown) => Promise<void>;

    /** Triggered when the user cancelled editing a field. */
    onFieldEditCancel?: (row: number, field: string) => void;

    /** Triggered when the user wants to mark rows for deletion (or remove such a mark). */
    onToggleRowDeletionMarks?: (rows: number[]) => void;

    /**
     * Triggered whenever the grid is vertically scrolled. `rowIndex` represents the index of the row at top of the
     * grid at this moment.
     */
    onVerticalScroll?: (rowIndex: number) => void;

    onAction?: (action: string) => Promise<void>;
}

/** Implements a table for result data. */
export class ResultView extends ComponentBase<IResultViewProperties> {
    private gridRef = createRef<TreeGrid>();
    private editorRef = createRef<FieldEditor>();

    // Keeps user defined (or computed) column widths across result set updates.
    private columnWidthCache = new Map<string, number>();

    private cellContextMenuRef = createRef<Menu>();
    private selectedCell?: CellComponent;
    private editingCell?: CellComponent;

    #columnDefinitions: ColumnDefinition[] = [];

    #navigating = false;
    #lastInputType: LastInputType = "other";

    public constructor(props: IResultViewProperties) {
        super(props);

        this.addHandledProperties("resultSet", "editable", "editModeActive", "topRowIndex", "rowChanges", "selectRow",
            "onFieldEditStart", "onFieldEdited", "onFieldEditCancel", "onVerticalScroll");
    }

    public override componentDidMount(): void {
        const { editable, editModeActive, selectRow, resultSet, topRowIndex } = this.props;

        document.addEventListener("keydown", this.handleKeyDown);
        document.addEventListener("mouseup", this.handleMouseUp);

        if (this.gridRef.current) {
            const canEdit = Settings.get<boolean>("editor.editOnDoubleClick", true) || editModeActive;
            this.#columnDefinitions = this.generateColumnDefinitions(resultSet.columns, editable && canEdit);

            void this.gridRef.current.setColumns(this.#columnDefinitions).then(() => {
                void this.addData(resultSet.data as IResultSetRows, true).then(() => {
                    if (this.gridRef.current) {
                        if (selectRow !== undefined) {
                            this.gridRef.current.selectRows([selectRow + 1]);
                        }

                        if (topRowIndex !== undefined) {
                            void this.gridRef.current.scrollToRow(topRowIndex);
                        }
                    }
                });
            });
        }
    }

    public override componentWillUnmount(): void {
        document.removeEventListener("keydown", this.handleKeyDown);
        document.removeEventListener("mouseup", this.handleMouseUp);
    }

    public override componentDidUpdate(prevProps: IResultViewProperties): void {
        const { resultSet } = this.props;

        if (prevProps.resultSet.columns !== resultSet.columns) {
            void this.updateColumns(resultSet.columns);
        }

        if (!this.editingCell) {
            void this.addData(resultSet.data as IResultSetRows, true);
        }
    }

    public render(): ComponentChild {
        const { resultSet, editable, editModeActive } = this.props;

        const className = this.getEffectiveClassNames(["resultView"]);

        const options: ITreeGridOptions = {
            layout: "fitData",
            verticalGridLines: true,
            horizontalGridLines: true,
            alternatingRowBackgrounds: false,
            selectionType: SelectionType.Multi,
            resizableRows: true,
        };

        const executionInfo = resultSet.data.executionInfo;
        const gotError = executionInfo && executionInfo.type === MessageType.Error;
        const gotResponse = executionInfo && executionInfo.type === MessageType.Response;
        const canEdit = Settings.get<boolean>("editor.editOnDoubleClick", true) || editModeActive;

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
                {...this.unhandledProperties}
            >
                {
                    !gotError && !gotResponse && <TreeGrid
                        ref={this.gridRef}
                        options={options}
                        onColumnResized={this.handleColumnResized}
                        onCellContext={this.handleCellContext}
                        onVerticalScroll={this.handleVerticalScroll}
                        onFormatRow={this.handleFormatRow}
                        onCellClick={this.handleCellClick}
                    />
                }

                <Container className="actionHost" orientation={Orientation.LeftToRight}>
                    {editable && canEdit && <Button
                        id="addNewRow"
                        data-tooltip="Add New Row"
                        imageOnly={true}
                        focusOnClick={false}
                        onClick={this.handleAction}
                    >
                        <Icon src={addRowIcon} data-tooltip="inherit" />
                    </Button>}
                </Container>

                {!gotError && !gotResponse && <FieldEditor ref={this.editorRef} />}

                <Menu
                    id="cellContextMenu"
                    ref={this.cellContextMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleCellContextMenuItemClick}
                    isItemDisabled={this.handleCellMenuItemDisabled}
                >
                    <MenuItem command={{ title: "Open Value in Editor", command: "openValueMenuItem" }} />
                    <MenuItem command={{ title: "Set Field to Null", command: "setNullMenuItem" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Save Value to File...", command: "saveToFileMenuItem" }} />
                    <MenuItem command={{ title: "Load Value from File...", command: "loadFromFileMenuItem" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem id="copyRowSubmenu" command={{ title: "Copy Single Row", command: "" }}>
                        <MenuItem command={{ title: "Copy Row", command: "copyRowMenuItem1" }} />
                        <MenuItem command={{ title: "Copy Row With Names", command: "copyRowMenuItem2" }} />
                        <MenuItem command={{ title: "Copy Row Unquoted", command: "copyRowMenuItem3" }} />
                        <MenuItem command={{ title: "Copy Row With Names, Unquoted", command: "copyRowMenuItem4" }} />
                        <MenuItem
                            command={{ title: "Copy Row With Names, Tab Separated", command: "copyRowMenuItem5" }}
                        />
                        <MenuItem command={{ title: "Copy Row Tab Separated", command: "copyRowMenuItem6" }} />
                    </MenuItem>
                    <MenuItem id="copyRowsSubmenu" command={{ title: "Copy Multiple Rows", command: "" }}>
                        <MenuItem command={{ title: "Copy All Rows", command: "copyRowsMenuItem1" }} />
                        <MenuItem command={{ title: "Copy All Rows With Names", command: "copyRowsMenuItem2" }} />
                        <MenuItem command={{ title: "Copy All Rows Unquoted", command: "copyRowsMenuItem3" }} />
                        <MenuItem
                            command={{ title: "Copy All Rows With Names, Unquoted", command: "copyRowsMenuItem4" }}
                        />
                        <MenuItem
                            command={{ title: "Copy All Rows With Names, Tab Separated", command: "copyRowsMenuItem5" }}
                        />
                        <MenuItem command={{ title: "Copy All Rows Tab, Separated", command: "copyRowsMenuItem6" }} />
                        <MenuItem command={{ title: "Copy Selected Rows", command: "copyRowsMenuItem7" }} />
                        <MenuItem
                            command={{ title: "Copy Selected Rows, Tab Separated", command: "copyRowsMenuItem8" }}
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "Copy Field", command: "copyFieldMenuItem" }} />
                    <MenuItem command={{ title: "Copy Field Unquoted", command: "copyFieldUnquotedMenuItem" }} />
                    <MenuItem command={{ title: "Paste Row", command: "pasteRowMenuItem" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Delete Row (Mark/Unmark)", command: "deleteRowMenuItem" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Capitalize Text", command: "capitalizeMenuItem" }} />
                    <MenuItem command={{ title: "Convert Text to Lower Case", command: "lowerCaseMenuItem" }} />
                    <MenuItem command={{ title: "Convert Text to Upper Case", command: "upperCaseMenuItem" }} />
                </Menu>

            </Container >
        );
    }

    public updateColumns(columns: IColumnInfo[]): Promise<void> {
        // istanbul ignore next
        if (this.gridRef.current) {
            const { editable, editModeActive } = this.props;

            const canEdit = Settings.get<boolean>("editor.editOnDoubleClick", true) || editModeActive;
            this.#columnDefinitions = this.generateColumnDefinitions(columns, editable && canEdit);

            return this.gridRef.current.setColumns(this.#columnDefinitions);
        }

        return Promise.resolve();
    }

    /**
     * Direct data pump, to fill in data as quickly as possible. This does not re-render the entire grid, but
     * uses internal handling to add the new rows (and to update columns).
     * Data passed in here does not update the internal state of the view, except for the final response where
     * a status is given.
     *
     * @param newData The new data to add to the view. If columns are given with that, they replace any existing
     *                columns in the grid.
     * @param replace If true, the new data will actually replace the current result grid content.
     *
     * @returns A promise to wait for, before another call is made to add further data.
     */
    public async addData(newData: IResultSetRows, replace: boolean): Promise<void> {
        // istanbul ignore next
        if (this.gridRef.current) {
            if (replace) {
                await this.gridRef.current.setData(newData.rows, SetDataAction.Replace);
            } else {
                await this.gridRef.current.setData(newData.rows, SetDataAction.Add);
            }
        }
    }

    /**
     * This method exists solely to test certain internal paths in this component. Never use that outside of testing.
     *
     * @param cell The cell to set as current.
     */
    public setFakeCell(cell: CellComponent): void {
        this.selectedCell = cell;
    }

    public editFirstCell(): void {
        // istanbul ignore next
        if (this.gridRef.current) {
            const visibleRows = this.gridRef.current.getRows("visible");
            if (visibleRows.length > 0) {
                const cells = visibleRows[0].getCells();
                if (cells.length > 0) {
                    cells[0].edit();
                }
            }
        }
    }

    private generateColumnDefinitions = (columns: IColumnInfo[], editable: boolean): ColumnDefinition[] => {
        // Map column info from the backend to column definitions for
        return columns.map((info): ColumnDefinition => {
            let formatter;
            const formatterParams: FormatterParams = (): IFormatterParams => { return { info }; };
            const editorParams: EditorParams = () => { return { info }; };

            let minWidth = 50;
            let editor: Editor | undefined;

            switch (info.dataType.type) {
                case DBDataType.TinyInt:
                case DBDataType.SmallInt:
                case DBDataType.MediumInt:
                case DBDataType.Int:
                case DBDataType.Bigint: {
                    formatter = this.numberFormatter;
                    editor = this.editorHost;

                    break;
                }

                case DBDataType.Json: {
                    formatter = this.stringFormatter; // this.jsonFormatter; re-enable when we have a JSON editor
                    editor = this.editorHost;
                    minWidth = 150;

                    break;
                }

                case DBDataType.String:
                case DBDataType.Text:
                case DBDataType.MediumText:
                case DBDataType.LongText:
                case DBDataType.Enum:
                case DBDataType.Set: {
                    formatter = this.stringFormatter;
                    editor = this.editorHost;
                    minWidth = 150;

                    break;
                }

                case DBDataType.Binary:
                case DBDataType.Varbinary: {
                    // No in-place editor. Uses value editor popup.
                    formatter = this.binaryFormatter;
                    // For now, use built in text editor with HEX formatting
                    editor = this.editorHost;
                    minWidth = 150;

                    break;
                }

                case DBDataType.Geometry:
                case DBDataType.Point:
                case DBDataType.LineString:
                case DBDataType.Polygon:
                case DBDataType.GeometryCollection:
                case DBDataType.MultiPoint:
                case DBDataType.MultiLineString:
                case DBDataType.MultiPolygon: {
                    // No in-place editor. Uses value editor popup.
                    formatter = this.geometryFormatter;

                    // As a temporary solution allow editing as string.
                    editor = this.editorHost;
                    minWidth = 150;

                    break;
                }

                case DBDataType.TinyBlob:
                case DBDataType.Blob:
                case DBDataType.MediumBlob:
                case DBDataType.LongBlob: {
                    // No in-place editor. Uses value editor popup.
                    formatter = this.blobFormatter;

                    // As a temporary solution allow editing as string.
                    editor = this.editorHost;
                    minWidth = 150;

                    break;
                }

                case DBDataType.Date:
                case DBDataType.DateTime:
                case DBDataType.Time:
                case DBDataType.Year: {
                    formatter = this.dateFormatter;
                    editor = this.editorHost;

                    break;
                }

                case DBDataType.Boolean: {
                    formatter = this.booleanFormatter;
                    editor = this.editorHost;

                    break;
                }

                default: {
                    formatter = this.stringFormatter;
                    editor = this.editorHost;

                    break;
                }
            }

            const width = this.columnWidthCache.get(info.title);

            return {
                title: info.title,
                field: info.field,
                formatter: formatter as Formatter,
                formatterParams,
                formatterClipboard: formatter as Formatter,
                editor,
                editorParams,
                width,
                minWidth,
                resizable: true,
                editable: () => {
                    if (!this.editingCell) {
                        if (editable && editor != null) {
                            return true;
                        }
                    }

                    return false;
                },
                cellEditing: this.cellEditing,
                cellEdited: this.cellEdited,
                cellEditCancelled: this.cellEditCancelled,
            };
        });
    };

    /**
     * Triggered when the user starts editing a cell value.
     *
     * @param cell The cell component for the cell that will be edited now.
     */
    private cellEditing = (cell: CellComponent): void => {
        const { onFieldEditStart } = this.props;

        if (this.selectedCell && this.selectedCell.getElement()) {
            this.selectedCell.getElement().classList.remove("manualFocus");
            this.selectedCell = undefined;
        }

        this.editingCell = cell;

        onFieldEditStart?.(cell.getRow().getPosition() as number - 1, cell.getColumn().getField());
    };

    /**
     * Triggered when the user successfully edited a cell value.
     *
     * @param cell The component for the cell that was edited.
     */
    private cellEdited = (cell: CellComponent): void => {
        const { onFieldEdited } = this.props;

        const rowIndex = cell.getRow().getPosition() as number;
        const field = cell.getColumn().getField();

        // Rows are one-based? Odd.
        void onFieldEdited?.(rowIndex - 1, field, cell.getValue(), cell.getInitialValue()).then(() => {
            this.markIfChanged(cell);
        });

        this.editingCell = undefined;
    };

    /**
     * Triggered when the user cancelled editing a cell value.
     */
    private cellEditCancelled = (): void => {
        const { onFieldEditCancel } = this.props;

        if (this.editingCell) {
            onFieldEditCancel?.(this.editingCell.getRow().getPosition() as number - 1,
                this.editingCell.getColumn().getField());
            this.editingCell.getElement().focus();
            this.editingCell = undefined;
        }
    };

    private handleColumnResized = (column: ColumnComponent): void => {
        const field = column.getDefinition().field;
        if (field) {
            // We don't remove cached widths currently, to allow having preset widths also when the user
            // switches between different queries in the same execution block.
            this.columnWidthCache.set(field, column.getWidth());
        }
    };

    private handleCellMenuItemDisabled = (props: IMenuItemProperties): boolean => {
        const { editable } = this.props;

        // istanbul ignore next
        if (!this.selectedCell || !this.gridRef.current) {
            return true;
        }

        if (props.command.command === "") {
            // Sub menus.
            return false;
        }

        // istanbul ignore next
        const selectCount = this.gridRef.current.getSelectedRows().length ?? 0;

        //let needsValueEditor = false;
        let canLoadSave = false;
        const info = this.columnInfoFromCell(this.selectedCell);
        if (info) {
            switch (info.dataType.type) {
                case DBDataType.Geometry:
                case DBDataType.Point:
                case DBDataType.LineString:
                case DBDataType.Polygon:
                case DBDataType.GeometryCollection:
                case DBDataType.MultiPoint:
                case DBDataType.MultiLineString:
                case DBDataType.MultiPolygon:
                case DBDataType.Json: {
                    break;
                }

                case DBDataType.Blob:
                case DBDataType.TinyBlob:
                case DBDataType.MediumBlob:
                case DBDataType.LongBlob: {
                    //needsValueEditor = true;
                    canLoadSave = true;

                    break;
                }

                default:
            }
        }

        const command = props.command.command;
        switch (command) {
            case "editValueMenuItem": {
                return !editable;
            }

            case "openValueMenuItem": {
                return true; // !needsValueEditor || selectCount > 1; for now disable the value editor.
            }

            case "setNullMenuItem": {
                return !(editable && (info?.nullable ?? false));
            }

            case "saveToFileMenuItem": {
                return !canLoadSave || selectCount > 1;
            }

            case "loadFromFileMenuItem": {
                return !canLoadSave || selectCount > 1;
            }

            case "copyRowMenuItem1": {
                return selectCount > 1;
            }

            case "copyRowMenuItem2": {
                return selectCount > 1;
            }

            case "copyRowMenuItem3": {
                return selectCount > 1;
            }

            case "copyRowMenuItem4": {
                return selectCount > 1;
            }

            case "copyRowMenuItem5": {
                return selectCount > 1;
            }

            case "copyRowMenuItem6": {
                return selectCount > 1;
            }

            case "copyFieldMenuItem": {
                return selectCount > 1;
            }

            case "copyFieldUnquotedMenuItem": {
                return selectCount > 1;
            }

            case "copyRowsMenuItem1": {
                return false;
            }

            case "copyRowsMenuItem2": {
                return false;
            }

            case "copyRowsMenuItem3": {
                return false;
            }

            case "copyRowsMenuItem4": {
                return false;
            }

            case "copyRowsMenuItem5": {
                return false;
            }

            case "copyRowsMenuItem6": {
                return false;
            }

            case "copyRowsMenuItem7": {
                return selectCount === 0;
            }

            case "copyRowsMenuItem8": {
                return selectCount === 0;
            }

            case "pasteRowMenuItem": {
                return true; // selectCount > 1;
            }

            case "deleteRowMenuItem": {
                return !editable;
            }

            case "capitalizeMenuItem": {
                return selectCount > 1;
            }

            case "lowerCaseMenuItem": {
                return selectCount > 1;
            }

            case "upperCaseMenuItem": {
                return selectCount > 1;
            }

            default: {
                return true;
            }
        }
    };

    /**
     * Called when a context menu is requested for a cell.
     *
     * @param e The original event that triggered the context menu request.
     * @param cell The cell component for the cell that was clicked.
     */
    // We cannot test this method as it depends on Tabulator content (which is not rendered in tests).
    // istanbul ignore next
    private handleCellContext = (e: Event, cell: CellComponent): void => {
        if (this.selectedCell && this.selectedCell.getElement()) {
            this.selectedCell.getElement().classList.remove("manualFocus");
        }

        // Need to cancel editing here, or tabulator will crash when we set a value via cell.setValue().
        this.editingCell?.cancelEdit();
        this.selectedCell = cell;
        cell.getElement().classList.add("manualFocus");

        const event = e as MouseEvent;
        const targetRect = new DOMRect(event.clientX, event.clientY, 2, 2);

        this.cellContextMenuRef.current?.close();
        this.cellContextMenuRef.current?.open(targetRect, false, {});
    };

    private handleCellClick = (_event: Event, cell: CellComponent): void => {
        this.selectedCell = cell;
    };

    private handleVerticalScroll = (rowIndex: number): void => {
        const { onVerticalScroll } = this.props;
        this.cellContextMenuRef.current?.close();

        onVerticalScroll?.(rowIndex);
    };

    private handleFormatRow = (row: RowComponent): void => {
        const { rowChanges } = this.props;

        if (rowChanges) {
            const rowIndex = row.getPosition() as number - 1;

            const changes = rowChanges[rowIndex];
            if (changes) {
                if (changes.added) {
                    // An added row can never be marked deleted, because when deleting a new row, it is simply
                    // removed from the changes list.
                    row.getElement().classList.add("added");
                } else {
                    row.getElement().classList.remove("added");
                    if (changes.deleted) {
                        row.getElement().classList.add("deleted");
                    } else {
                        row.getElement().classList.remove("deleted");
                    }
                }
            } else {
                // Add and delete actions are removed from the row changes, if no other changes happened for a row.
                // That's why we need to remove the classes here.
                const element = row.getElement();
                element?.classList.remove("added");
                element?.classList.remove("deleted");
            }
        }
    };

    private handleAction = (e: Event, props: IButtonProperties): void => {
        const { onAction } = this.props;

        if (props.id === "addNewRow") {
            void onAction?.(props.id).then(() => {
                void this.gridRef.current?.scrollToBottom();
            });
        } else {
            void onAction?.(props.id!);
        }
    };

    /**
     * Formats a cell as string, either quoted or not
     *
     * @param cell The cell to format
     * @param unquoted Wether the cell value should be quoted (if valid in SQL) or not
     * @returns The cell value formatted as string
     */
    private formatCell = (cell: CellComponent, unquoted = false): string => {
        if (cell.getValue() === null) {
            // NULL, never gets quoted
            return "NULL";
        } else {
            const info = this.columnInfoFromCell(cell);
            if (info) {
                switch (info.dataType.type) {
                    // Binary data
                    case DBDataType.TinyBlob:
                    case DBDataType.Blob:
                    case DBDataType.MediumBlob:
                    case DBDataType.LongBlob:
                    case DBDataType.Binary:
                    case DBDataType.Varbinary: {
                        return formatBase64ToHex(String(cell.getValue()));
                    }


                    // Integer variants and Boolean, never get quoted
                    case DBDataType.TinyInt:
                    case DBDataType.SmallInt:
                    case DBDataType.MediumInt:
                    case DBDataType.Int:
                    case DBDataType.Bigint:
                    case DBDataType.Boolean: {
                        return String(cell.getValue());
                    }

                    default: {
                        if (unquoted) {
                            return String(cell.getValue());
                        } else {
                            return "'" + String(cell.getValue()) + "'";
                        }
                    }

                }
            } else {
                return String(cell.getValue());
            }
        }
    };

    private handleCellContextMenuItemClick = (props: IMenuItemProperties): boolean => {
        if (this.selectedCell) {
            let dataType = DBDataType.String;
            const info = this.columnInfoFromCell(this.selectedCell);
            if (info) {
                dataType = info.dataType.type;
            }

            const command = props.command.command;
            switch (command) {
                case "openValueMenuItem": {
                    let typeString = "Blob";
                    switch (dataType) {
                        case DBDataType.TinyBlob:
                        case DBDataType.Blob:
                        case DBDataType.MediumBlob:
                        case DBDataType.LongBlob: {
                            typeString = "Blob";
                            break;
                        }

                        case DBDataType.Geometry:
                        case DBDataType.Point:
                        case DBDataType.LineString:
                        case DBDataType.Polygon:
                        case DBDataType.GeometryCollection:
                        case DBDataType.MultiPoint:
                        case DBDataType.MultiLineString:
                        case DBDataType.MultiPolygon: {
                            typeString = "Geometry";
                            break;
                        }

                        case DBDataType.Json: {
                            typeString = "JSON";
                            break;
                        }

                        default: {
                            typeString = "String";
                            break;
                        }
                    }

                    void this.editorRef.current?.show({
                        id: "fieldEditor",
                        title: `Edit ${typeString} Data`,
                        type: DialogType.Prompt,
                        parameters: {
                            dataType,
                            value: this.selectedCell.getValue(),
                        },
                    });

                    break;
                }

                case "editValueMenuItem": {
                    this.cellContextMenuRef.current?.close();

                    this.selectedCell.edit();
                    break;
                }

                case "setNullMenuItem": {
                    this.selectedCell.setValue(null);
                    break;
                }

                case "saveToFileMenuItem": {
                    this.saveCurrentCellToFile();
                    break;
                }

                case "loadFromFileMenuItem": {
                    this.loadFileToCurrentCell();
                    break;
                }

                case "copyRowMenuItem1": {
                    this.copyRows(false, false);

                    break;
                }

                case "copyRowMenuItem2": {
                    this.copyRows(true, false);

                    break;
                }

                case "copyRowMenuItem3": {
                    this.copyRows(false, true);

                    break;
                }

                case "copyRowMenuItem4": {
                    this.copyRows(true, true);

                    break;
                }

                case "copyRowMenuItem5": {
                    this.copyRows(true, false, "\t");

                    break;
                }

                case "copyRowMenuItem6": {
                    this.copyRows(false, false, "\t");

                    break;
                }

                case "copyRowsMenuItem1": {
                    this.copyRows(false, false, ",", true);

                    break;
                }

                case "copyRowsMenuItem2": {
                    this.copyRows(true, false, ",", true);

                    break;
                }

                case "copyRowsMenuItem3": {
                    this.copyRows(false, true, ",", true);

                    break;
                }

                case "copyRowsMenuItem4": {
                    this.copyRows(true, true, ",", true);

                    break;
                }

                case "copyRowsMenuItem5": {
                    this.copyRows(true, false, "\t", true);

                    break;
                }

                case "copyRowsMenuItem6": {
                    this.copyRows(false, false, "\t", true);

                    break;
                }

                case "copyRowsMenuItem7": {
                    this.copyRows(true, false, "\t", false);

                    break;
                }

                case "copyRowsMenuItem8": {
                    this.copyRows(false, false, "\t", true);

                    break;
                }

                case "copyFieldMenuItem": {
                    void requisitions.writeToClipboard(this.formatCell(this.selectedCell));
                    break;
                }

                case "copyFieldUnquotedMenuItem": {
                    void requisitions.writeToClipboard(this.formatCell(this.selectedCell, true));

                    break;
                }

                case "pasteRowMenuItem": {
                    break;
                }

                case "deleteRowMenuItem": {
                    this.markRowsDeleted();
                    break;
                }

                case "capitalizeMenuItem": {
                    const value = this.selectedCell.getValue() as string;
                    this.selectedCell.setValue(convertCamelToTitleCase(value));

                    break;
                }

                case "lowerCaseMenuItem": {
                    const value = this.selectedCell.getValue() as string;
                    this.selectedCell.setValue(value.toLowerCase());

                    break;
                }

                case "upperCaseMenuItem": {
                    const value = this.selectedCell.getValue() as string;
                    this.selectedCell.setValue(value.toUpperCase());

                    break;
                }

                default:
            }

            if (this.selectedCell) {
                this.selectedCell.getElement()?.classList.remove("manualFocus");
                this.selectedCell = undefined;
            }
        }

        return true;
    };

    /**
     * Takes the content from the current cell and saves it to a file.
     */
    private saveCurrentCellToFile(): void {
        const value = this.selectedCell?.getValue();
        if (value === null || value === undefined) {
            return;
        }

        if (typeof value === "string") {
            saveTextAsFile(value, "data");
        } else if (value instanceof ArrayBuffer) {
            saveArrayAsFile(value, "data");
        } else {
            saveTextAsFile(String(value), "data");
        }
    }

    /**
     * Lets the user select a file and loads its content into the current cell as array buffer.
     */
    private loadFileToCurrentCell(): void {
        // Keep a reference to the selected cell, because it is reset while the file dialog is open.
        const cell = this.selectedCell;
        if (cell) {
            void selectFile([], false).then((files) => {
                if (files && files.length > 0) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        cell.setValue(e.target?.result);
                    };
                    reader.readAsArrayBuffer(files[0]);
                }
            });
        }
    }

    private copyRows(withNames: boolean, unquoted: boolean, separator = ", ", all = false): void {
        // istanbul ignore next
        let rows;
        if (all) {
            rows = this.gridRef.current?.getRows() ?? [];
        } else {
            rows = this.gridRef.current?.getSelectedRows() ?? [];
        }

        if (rows.length === 0 && this.selectedCell) {
            rows = [this.selectedCell.getRow()];
        }

        let content = "";

        if (withNames && rows.length > 0) {
            content += "# ";
            rows[0].getCells().forEach((cell) => {
                content += cell.getColumn().getDefinition().title + separator;
            });
            if (content.endsWith(separator)) {
                content = content.substring(0, content.length - separator.length);
            }
            content += "\n";

        }

        rows.forEach((row) => {
            row.getCells().forEach((cell) => {
                content += this.formatCell(cell, unquoted) + separator;
            });

            if (content.endsWith(separator)) {
                content = content.substring(0, content.length - separator.length);
            }

            content += "\n";
        });

        requisitions.writeToClipboard(content);

    }

    /**
     * Main entry point for editing operations in the result view. It takes a column's data type and renders one of
     * our UI elements for the given cell.
     *
     * @param cell The cell component for the editable cell.
     * @param onRendered Used to specify a function to be called when the editor actually has been rendered in the DOM.
     * @param success Function to call when editing was done successfully (passing in the new value).
     * @param cancel Function to call when editing was cancelled.
     * @param editorParams Parameters passed on by the column definition in the render method. This is where the column
     *                     meta data is passed in.
     *
     * @returns The new editor HTML element.
     */
    private editorHost = (cell: CellComponent, onRendered: EmptyCallback, success: ValueBooleanCallback,
        cancel: ValueVoidCallback, editorParams: EditorParams): HTMLElement | false => {

        cell.getTable().deselectRow();
        cell.getRow().select();

        const host = document.createElement("div");
        host.classList.add("cellEditorHost");

        this.renderCustomEditor(cell, host, cell.getValue(), success, cancel, editorParams);

        onRendered(() => {
            let inputs: HTMLCollectionOf<HTMLElement> = host.getElementsByTagName("textarea");
            if (inputs.length > 0) {
                const element = inputs[0];

                element.style.height = "0"; // This line is important or the scroll height will never shrink.
                element.style.height = `${element.scrollHeight}px`;

                cell.getRow().normalizeHeight();

                element.focus();
            } else {
                inputs = host.getElementsByTagName("input");
                if (inputs.length > 0) {
                    const element = inputs[0];
                    element.focus();
                } else {
                    const boxes = host.getElementsByClassName("checkbox");
                    if (boxes.length > 0) {
                        const element = boxes[0] as HTMLInputElement;
                        element.focus();
                    }
                }
            }
        });

        return host;
    };

    /**
     * Renders one of our UI elements as a cell editor, if there's no built-in editor already or we need different
     * functionality. This function is also called for each change in the editor it creates, because we use controlled
     * components.
     *
     * @param cell The cell being edited.
     * @param host The HTML element that will host our UI component.
     * @param value The value to set.
     * @param success A callback to be called when the edit operation was successfully finished.
     * @param cancel A callback to be called when the user cancelled the editor operation.
     * @param editorParams Additional parameters to configure the editor.
     */
    private renderCustomEditor(cell: CellComponent, host: HTMLDivElement, value: unknown,
        success: ValueBooleanCallback, cancel: ValueVoidCallback, editorParams: unknown): void {

        const params = (typeof editorParams === "function" ? editorParams(cell) : editorParams) as IDictionary;
        const info: IColumnInfo = params.info as IColumnInfo;

        let element;
        switch (info.dataType.type) {
            case DBDataType.TinyInt:
            case DBDataType.SmallInt:
            case DBDataType.MediumInt:
            case DBDataType.Int:
            case DBDataType.Bigint:
            case DBDataType.Year: {
                element = <UpDown
                    value={value as number ?? 0}
                    textAlignment={TextAlignment.Start}
                    onChange={(newValue): void => {
                        this.renderCustomEditor(cell, host, newValue, success, cancel, editorParams);
                    }}
                    onConfirm={(value: number): void => {
                        success(value);
                        this.handleConfirm(cell);
                    }}
                    onCancel={(): void => {
                        cancel(undefined);
                    }}
                    onBlur={this.handleBlurEvent.bind(this, cell, success, cancel)}
                />;

                break;
            }

            case DBDataType.Binary:
            case DBDataType.Varbinary:
            case DBDataType.Enum:
            case DBDataType.Set:
            case DBDataType.Geometry:
            case DBDataType.Point:
            case DBDataType.LineString:
            case DBDataType.Polygon:
            case DBDataType.GeometryCollection:
            case DBDataType.MultiPoint:
            case DBDataType.MultiLineString:
            case DBDataType.MultiPolygon:
            case DBDataType.Json:
            case DBDataType.Bit:
            case DBDataType.String:
            case DBDataType.Char:
            case DBDataType.Nchar:
            case DBDataType.Varchar:
            case DBDataType.Nvarchar:
            case DBDataType.TinyText:
            case DBDataType.Text:
            case DBDataType.MediumText:
            case DBDataType.LongText:
            case DBDataType.Float:
            case DBDataType.Double:
            case DBDataType.Decimal: {
                // Until we have a dedicated binary editor, use normal editor and edit in HEX
                if (info.dataType.type === DBDataType.Binary || info.dataType.type === DBDataType.Varbinary) {
                    // Convert back from HEX to Base64
                    if (value) {
                        value = formatBase64ToHex(value as string);
                    } else {
                        value = "";
                    }
                }
                element = <Input
                    value={value as string ?? ""}
                    multiLine={this.useMultiLineEditor(info.dataType.type)}
                    multiLineSwitchEnterKeyBehavior={true}
                    onChange={(e: InputEvent, props: IInputChangeProperties): void => {
                        // Auto grow the input field (limited by a max height CSS setting).
                        if (props.multiLine) {
                            const element = e.target as HTMLElement;
                            element.style.height = "0";
                            element.style.height = `${element.scrollHeight}px`;

                            cell.checkHeight();

                            this.renderCustomEditor(cell, host, props.value, success, cancel, editorParams);
                        }
                    }}
                    onConfirm={(e: KeyboardEvent, props: IInputChangeProperties): void => {
                        // Until we have a dedicated binary editor, use normal editor and edit in HEX
                        if (info.dataType.type === DBDataType.Binary || info.dataType.type === DBDataType.Varbinary) {
                            if (props.value) {
                                success(convertHexToBase64(props.value));
                            } else {
                                success(null);
                            }
                        } else {
                            success(props.value);
                        }
                        e.preventDefault();
                        this.handleConfirm(cell);
                    }}
                    onCancel={(): void => {
                        cancel(undefined);
                        cell.checkHeight();
                    }}
                    onBlur={this.handleBlurEvent.bind(this, cell, success, cancel)}
                />;

                break;
            }

            case DBDataType.Date: {
                element = <DateTime
                    type={IDateTimeValueType.Date}
                    value={value as string ?? ""}
                    onConfirm={(e: KeyboardEvent): void => {
                        success(value);
                        e.preventDefault();
                        this.handleConfirm(cell);
                    }}
                    onCancel={(): void => {
                        cancel(undefined);
                    }}
                    onBlur={this.handleBlurEvent.bind(this, cell, success, cancel)}
                />;

                break;
            }

            case DBDataType.DateTime: {
                element = <DateTime
                    type={IDateTimeValueType.DateTime}
                    value={value as string ?? ""}
                    onConfirm={(e: KeyboardEvent, props: IDateTimeChangeProperties): void => {
                        success(props.value);
                        this.handleConfirm(cell);
                    }}
                    onCancel={(): void => {
                        cancel(undefined);
                    }}
                    onBlur={this.handleBlurEvent.bind(this, cell, success, cancel)}
                />;

                break;
            }

            case DBDataType.Time: {
                element = <DateTime
                    type={IDateTimeValueType.Time}
                    value={value as string ?? ""}
                    onConfirm={(): void => {
                        success(value);
                        this.handleConfirm(cell);
                    }}
                    onCancel={(): void => {
                        cancel(undefined);
                    }}
                    onBlur={this.handleBlurEvent.bind(this, cell, success, cancel)}
                />;

                break;
            }

            case DBDataType.Boolean: {
                element = <Dropdown
                    autoFocus
                    selection={value === 0 ? "false" : "true"}
                    onSelect={(accept: boolean, selection: Set<string>): void => {
                        const newValue = selection.has("true") ? 1 : 0;
                        if (accept) {
                            if (value !== newValue) {
                                success(newValue);
                                this.handleConfirm(cell);
                            }
                        } else {
                            this.renderCustomEditor(cell, host, newValue, success, cancel, editorParams);
                        }
                    }}
                    onCancel={(): void => {
                        cancel(undefined);
                    }}
                    onBlur={this.handleBlurEvent.bind(this, cell, success, cancel)}
                >
                    <DropdownItem id="true" caption="true" />
                    <DropdownItem id="false" caption="false" />
                </Dropdown>;
                break;
            }

            default:
        }

        if (element) {
            render(element, host);
        }
    }

    // Also here: cannot test if it is not rendered.
    // istanbul ignore next
    private stringFormatter = (cell: CellComponent, formatterParams: IFormatterParams,
        onRendered: EmptyCallback): string | HTMLElement => {
        this.markIfChanged(cell);

        const value = cell.getValue();

        if (value == null) {
            const host = document.createElement("div");
            host.className = "iconHost";

            const element = <Icon src={nullIcon} />;
            render(element, host);

            return host;
        } else {
            onRendered(() => {
                const info = formatterParams.info;
                const element = cell.getElement();
                element.setAttribute("data-tooltip", "expand");
                if (info?.dataType.type === DBDataType.Json) {
                    element.setAttribute("data-tooltip-lang", "json");
                }
            });

            return String(value);
        }
    };

    // istanbul ignore next
    private jsonFormatter = (cell: CellComponent): string | HTMLElement => {
        this.markIfChanged(cell);

        const value = cell.getValue();

        const host = document.createElement("div");
        host.className = "iconHost";

        const element = <Icon src={value == null ? nullIcon : jsonIcon} />;
        render(element, host);

        return host;
    };

    // istanbul ignore next
    private numberFormatter = (cell: CellComponent, formatterParams: IFormatterParams,
        onRendered: EmptyCallback): string | HTMLElement => {
        this.markIfChanged(cell);

        const info = formatterParams.info;
        if (this.isNewRow(cell) && info?.autoIncrement) {
            return "AI";
        }

        const value = cell.getValue();
        if (value === null) {
            const host = document.createElement("div");
            host.className = "iconHost";

            const element = <Icon src={nullIcon} />;
            render(element, host);

            return host;
        }

        onRendered(() => {
            const element = cell.getElement();
            element.setAttribute("data-tooltip", "expand");
        });

        return String(value);
    };

    // istanbul ignore next
    private binaryFormatter = (cell: CellComponent, formatterParams: IFormatterParams,
        onRendered: EmptyCallback): string | HTMLElement => {
        this.markIfChanged(cell);

        let element;
        const value = cell.getValue();
        if (value === null) {
            const host = document.createElement("div");
            host.className = "iconHost";

            element = <Icon src={nullIcon} />;
            render(element, host);

            return host;
        } else {
            onRendered(() => {
                const element = cell.getElement();
                element.setAttribute("data-tooltip", "expand");
            });

            // Binary data is given as a based64 encoded string
            if (value) {
                return formatBase64ToHex(value, 64);
            } else {
                return "";
            }
        }
    };

    // istanbul ignore next
    private blobFormatter = (cell: CellComponent): string | HTMLElement => {
        this.markIfChanged(cell);

        const source = cell.getValue() === null ? nullIcon : blobIcon;
        const icon = <Icon src={source} />;

        const host = document.createElement("div");
        host.className = "iconHost";

        render(icon, host);

        return host;
    };

    // istanbul ignore next
    private geometryFormatter = (cell: CellComponent): string | HTMLElement => {
        this.markIfChanged(cell);

        const source = cell.getValue() === null ? nullIcon : geometryIcon;
        const icon = <Icon src={source} />;

        const host = document.createElement("div");
        host.className = "iconHost";

        render(icon, host);

        return host;
    };

    // istanbul ignore next
    private dateFormatter = (cell: CellComponent, formatterParams: IFormatterParams,
        onRendered: EmptyCallback): string | HTMLElement => {
        this.markIfChanged(cell);

        const value = cell.getValue();
        if (value === null) {
            const host = document.createElement("div");
            host.className = "iconHost";

            const element = <Icon src={nullIcon} />;
            render(element, host);

            return host;
        }

        onRendered(() => {
            const element = cell.getElement();
            element.setAttribute("data-tooltip", "expand");
        });

        const locale = Intl.DateTimeFormat().resolvedOptions().locale;
        const stringValue = String(value);
        const info = formatterParams.info;
        if (info) {
            let date: Date;
            const options: Intl.DateTimeFormatOptions = {};

            switch (info.dataType.type) {
                case DBDataType.Date:
                case DBDataType.DateTime: {
                    date = new Date(stringValue);
                    options.year = "numeric";
                    options.month = "2-digit";
                    options.day = "2-digit";

                    break;
                }

                case DBDataType.Time: {
                    date = new Date(`1970-01-01T${stringValue}`);
                    const formattedTime = date.toLocaleTimeString(locale);

                    return formattedTime;
                }

                case DBDataType.Year: {
                    date = new Date(stringValue);
                    options.year = "numeric";

                    break;
                }

                default: {
                    date = new Date(stringValue);

                    break;
                }
            }

            return date.toLocaleDateString(locale, options);
        }

        return stringValue;
    };

    private booleanFormatter = (cell: CellComponent, formatterParams: IFormatterParams,
        onRendered: EmptyCallback): string | HTMLElement => {
        this.markIfChanged(cell);

        const host = document.createElement("div");
        let element;
        if (cell.getValue() === null) {
            element = <Icon src={nullIcon} />;
            host.className = "iconHost";
            render(element, host);

            return host;
        } else {
            onRendered(() => {
                const element = cell.getElement();
                element.setAttribute("data-tooltip", "expand");
            });

            return cell.getValue() === 0 ? "false" : "true";
        }
    };

    /**
     * Sets the CSS class for changed cells on the given cell, if we have a change for that cell.
     *
     * @param cell The cell to check for changes.
     *
     * @returns True if the row the cell belongs to is new.
     */
    private markIfChanged(cell: CellComponent): boolean {
        const { rowChanges } = this.props;
        if (rowChanges) {
            const rowIndex = cell.getRow().getPosition() as number - 1;
            const rowChange = rowChanges[rowIndex];
            if (rowChange && !rowChange.added) {
                const changes = rowChanges[rowIndex]?.changes;
                if (changes) {
                    const field = cell.getColumn().getField();
                    const change = changes.find((change) => {
                        return change.field === field;
                    });

                    if (change !== undefined) {
                        const element = cell.getElement();
                        element.classList.add("changed");
                    }
                }
            }

            return rowChange?.added ?? false;
        }

        return false;
    }

    /**
     * @returns A boolean indicating if the given cell is part of a new row.
     *
     * @param cell The cell to check.
     */
    private isNewRow(cell: CellComponent): boolean {
        const { rowChanges } = this.props;
        if (rowChanges) {
            const rowIndex = cell.getRow().getPosition() as number - 1;
            const rowChange = rowChanges[rowIndex];

            return rowChange?.added ?? false;
        }

        return false;
    }

    /**
     * Toggles the deletion mark for the currently selected rows.
     */
    private markRowsDeleted(): void {
        let rows = this.gridRef.current?.getSelectedRows();

        if ((!rows || rows.length === 0) && this.selectedCell) {
            rows = [this.selectedCell.getRow()];
        }

        if (rows) {
            const { onToggleRowDeletionMarks } = this.props;
            const positions = rows.map((row) => {
                return row.getPosition() as number - 1;
            });

            onToggleRowDeletionMarks?.(positions);

            setTimeout(() => {
                rows.forEach((row) => {
                    this.handleFormatRow(row);
                });
            }, 0);
        }
    }

    /**
     * Determines if a multi-line editor should be used for the given data type.
     *
     * @param type The data type to check.
     *
     * @returns True if a multi-line editor should be used, false otherwise.
     */
    private useMultiLineEditor(type: DBDataType): boolean | undefined {
        switch (type) {
            case DBDataType.String:
            case DBDataType.Json:
            case DBDataType.Varchar:
            case DBDataType.Nvarchar:
            case DBDataType.MediumText:
            case DBDataType.LongText: {
                return true;
            }

            default: {
                return false;
            }
        }
    }

    private handleBlurEvent = (cell: CellComponent, success: ValueBooleanCallback, cancel: ValueVoidCallback,
        e: FocusEvent): void => {
        const element = e.target as HTMLElement & { value: string | number; };

        const value = cell.getValue();
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            if (String(element.value) !== String(value)) {
                // If this was using this.binaryFormatter then we have to convert back from HEX to Base64
                if (cell.getColumn().getDefinition().formatter === this.binaryFormatter) {
                    if (element.value) {
                        success(convertHexToBase64(element.value));
                    } else {
                        success(null);
                    }
                } else {
                    success(element.value);
                }
                this.markIfChanged(cell);
            } else {
                cancel(undefined);
            }

            cell.checkHeight();

            // If the blur event is finishing the edit operation, make sure to re-focus the current cell after
            // it has been re-rendered it ensure keyboard navigation
            if (this.editingCell) {
                // Ensure the editing is finished, otherwise editing will get stuck
                this.editingCell = undefined;

                // Since the actual rowComponent will be replaced internally by tabulator, store the row position
                const rowPos = cell.getRow().getPosition();
                const col = cell.getColumn();
                if (rowPos) {
                    // Wait till the table has been updated
                    setTimeout(() => {
                        // Lookup the new row
                        const rows = this.gridRef.current?.getRows();
                        if (rows && rows.length >= rowPos) {
                            // Get the correct cell and focus it
                            rows[rowPos - 1].getCell(col).getElement()?.focus();
                        }
                    }, 100);
                }
            }
        }

        if (this.#lastInputType === "tab" || this.#lastInputType === "shiftTab") {
            const target = (e.relatedTarget || document.activeElement) as HTMLElement;
            if (target.closest(".tabulator")) {
                this.#navigating = true;
                try {
                    if (this.#lastInputType === "tab") {
                        if (!cell.navigateRight()) {
                            cell.navigateNext();
                        }
                    } else {
                        if (!cell.navigateLeft()) {
                            cell.navigatePrev();
                        }
                    }
                } finally {
                    this.#navigating = false;
                }
            }
        }
    };

    private handleConfirm(cell: CellComponent): void {
        this.markIfChanged(cell);

        cell.checkHeight();
    }

    private columnInfoFromCell(cell: CellComponent): IColumnInfo | undefined {
        const formatterParams = cell.getColumn().getDefinition().formatterParams;
        if (formatterParams && typeof formatterParams === "function") {
            const formatterParamsFunc = formatterParams as (cell: CellComponent) => { info: IColumnInfo; };

            return formatterParamsFunc(cell).info;
        }

        return undefined;
    }

    /**
     * A handler for global mouse up. Used to track mouse clicks for focus-out handling.
     */
    private handleMouseUp = (): void => {
        this.#lastInputType = "other";
    };

    /**
     * A handler for global key down. Used to track tab presses for focus-out handling.
     * @param e The keyboard event.
     */
    private handleKeyDown = (e: KeyboardEvent): void => {
        const { editable, onAction } = this.props;

        switch (e.key) {
            // Support to start editing via Return/Enter key
            case (KeyboardKeys.Enter): {
                if (e.metaKey && onAction) {
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    void onAction("commit");
                } else if (editable && this.gridRef.current) {
                    let cell;
                    // If a cell has the focus, lookup the cell based on the HTMLElement and edit that sell
                    if (document.activeElement?.parentElement?.classList.contains("tabulator-row")) {
                        const activeRow = this.gridRef.current.getRow(document.activeElement.parentElement);
                        cell = activeRow?.getCells().find((cell) => {
                            return cell.getElement() === document.activeElement;
                        });
                    }

                    if (cell) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        cell.edit();
                        break;
                    }
                }

                this.#lastInputType = "other";
                break;
            }

            case (KeyboardKeys.Escape): {
                if (e.metaKey && onAction) {
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    void onAction("rollback");
                }

                this.#lastInputType = "other";
                break;
            }

            case (KeyboardKeys.Tab): {
                if (e.shiftKey) {
                    this.#lastInputType = "shiftTab";
                } else {
                    this.#lastInputType = "tab";
                }
                break;
            }

            default:
                this.#lastInputType = "other";
                break;
        }
    };
}
