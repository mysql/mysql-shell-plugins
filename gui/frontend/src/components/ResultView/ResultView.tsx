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

import "./ResultView.css";

import blobIcon from "../../assets/images/blob.svg";
import nullIcon from "../../assets/images/null.svg";

import { ComponentChild, createRef, render } from "preact";
import { CellComponent, ColumnComponent, ColumnDefinition, Formatter, FormatterParams } from "tabulator-tables";

import { ITreeGridOptions, SetDataAction, TreeGrid } from "../ui/TreeGrid/TreeGrid";
import { IResultSet, IResultSetRows } from "../../script-execution";
import { convertCamelToTitleCase } from "../../utilities/helpers";
import { DBDataType, IColumnInfo, MessageType } from "../../app-logic/Types";
import { requisitions } from "../../supplement/Requisitions";
import { Checkbox, CheckState } from "../ui/Checkbox/Checkbox";
import { IComponentProperties, ComponentBase, SelectionType, ComponentPlacement } from "../ui/Component/ComponentBase";
import { Container, Orientation } from "../ui/Container/Container";
import { Icon } from "../ui/Icon/Icon";
import { Menu } from "../ui/Menu/Menu";
import { MenuItem, IMenuItemProperties } from "../ui/Menu/MenuItem";

import { Buffer } from "buffer";

interface IResultViewProperties extends IComponentProperties {
    resultSet: IResultSet;

    // Triggered when the user edited data.
    onEdit?: (resultSet: IResultSet) => void;
}

// Implements a table for result data.
export class ResultView extends ComponentBase<IResultViewProperties> {

    private gridRef = createRef<TreeGrid>();

    // Keeps user defined (or computed) column widths across result set updates.
    private columnWidthCache = new Map<string, number>();

    private cellContextMenuRef = createRef<Menu>();
    private currentCell?: CellComponent;

    public constructor(props: IResultViewProperties) {
        super(props);

        this.state = {
        };

        this.addHandledProperties("resultSet", "onEdit");
    }

    public componentDidUpdate(): void {
        this.currentCell = undefined;
    }

    public render(): ComponentChild {
        const { resultSet } = this.mergedProps;

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

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
                {...this.unhandledProperties}
            >
                {
                    !gotError && !gotResponse && <TreeGrid
                        ref={this.gridRef}
                        style={{ fontSize: "10pt" }}
                        options={options}
                        columns={this.generateColumnDefinitions(resultSet.columns)}
                        tableData={resultSet.data.rows}
                        onColumnResized={this.handleColumnResized}
                        onCellContext={this.handleCellContext}
                    />
                }

                <Menu
                    id="cellContextMenu"
                    ref={this.cellContextMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleCellContextMenuItemClick}
                >
                    <MenuItem
                        id="openValueMenuItem"
                        caption="Open Value in Editor"
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem
                        id="setNullMenuItem"
                        caption="Set Field to Null"
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem caption="-" disabled />
                    <MenuItem
                        id="saveToFileMenuItem"
                        caption="Save Value to File..."
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem
                        id="loadFromFileMenuItem"
                        caption="Load Value from File..."
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem
                        caption="-" disabled />

                    <MenuItem
                        id="copyRowMenuItem1"
                        caption="Copy Row"
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem
                        id="copyRowMenuItem2"
                        caption="Copy Row With Names"
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem
                        id="copyRowMenuItem3"
                        caption="Copy Row Unquoted"
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem
                        id="copyRowMenuItem4"
                        caption="Copy Row With Names, Unquoted"
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem
                        id="copyRowMenuItem5"
                        caption="Copy Row With Names, Tab Separated"
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem
                        id="copyRowMenuItem6"
                        caption="Copy Row Tab Separated"
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem
                        id="copyFieldMenuItem"
                        caption="Copy Field"
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem
                        id="copyFieldUnquotedMenuItem"
                        caption="Copy Field Unquoted"
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem
                        id="pasteRowMenuItem"
                        caption="Paste Row"
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem
                        caption="-" disabled
                    />

                    <MenuItem
                        id="deleteRowMenuItem"
                        caption="Delete Row"
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem
                        caption="-" disabled
                    />

                    <MenuItem
                        id="capitalizeMenuItem"
                        caption="Capitalize Text"
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem
                        id="lowerCaseMenuItem"
                        caption="Convert Text to Lower Case"
                        disabled={this.handleCellMenuItemDisabled}
                    />
                    <MenuItem
                        id="upperCaseMenuItem"
                        caption="Convert Text to Upper Case"
                        disabled={this.handleCellMenuItemDisabled}
                    />
                </Menu>

            </Container>
        );
    }

    public updateColumns(columns: IColumnInfo[]): Promise<void> {
        // istanbul ignore next
        if (this.gridRef.current) {
            return this.gridRef.current.setColumns(this.generateColumnDefinitions(columns));
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

            if (newData.executionInfo) {
                this.setState({
                    dirty: false,
                });
            }
        }
    }

    /**
     * This method exists solely to test certain internal paths in this component. Never use that outside of testing.
     *
     * @param cell The cell to set as current.
     */
    public setFakeCell(cell: CellComponent): void {
        this.currentCell = cell;
    }

    private generateColumnDefinitions = (columns: IColumnInfo[]): ColumnDefinition[] => {
        // Map column info from the backend to column definitions for Tabulator.
        return columns.map((info): ColumnDefinition => {
            let formatter: Formatter | undefined;
            let formatterParams: FormatterParams = { dbDataType: info.dataType.type };
            let minWidth = 50;

            // TODO: Enable editing related functionality again.
            // let editor: Tabulator.Editor | undefined;
            // let editorParams: Tabulator.EditorParams | undefined;

            switch (info.dataType.type) {
                case DBDataType.TinyInt:
                case DBDataType.SmallInt:
                case DBDataType.MediumInt:
                case DBDataType.Int:
                case DBDataType.Bigint: {
                    formatter = "plaintext";
                    //editor = this.editorHost;
                    //editorParams = (): { info: IColumnInfo } => { return { info }; };

                    break;
                }

                case DBDataType.String:
                case DBDataType.Text:
                case DBDataType.MediumText:
                case DBDataType.LongText:
                case DBDataType.Geometry:
                case DBDataType.Point:
                case DBDataType.LineString:
                case DBDataType.Polygon:
                case DBDataType.GeometryCollection:
                case DBDataType.MultiPoint:
                case DBDataType.MultiLineString:
                case DBDataType.MultiPolygon:
                case DBDataType.Json:
                case DBDataType.Enum:
                case DBDataType.Set: {
                    formatter = this.stringFormatter;
                    //editor = this.editorHost;
                    //editorParams = (): { info: IColumnInfo } => { return { info }; };
                    minWidth = 150;

                    break;
                }

                case DBDataType.Binary:
                case DBDataType.Varbinary: {
                    formatter = this.binaryFormatter;
                    // No in-place editor. Uses value editor popup.

                    break;
                }

                case DBDataType.TinyBlob:
                case DBDataType.Blob:
                case DBDataType.MediumBlob:
                case DBDataType.LongBlob: {
                    formatter = this.blobFormatter;
                    // No in-place editor. Uses value editor popup.

                    break;
                }

                case DBDataType.Date:
                case DBDataType.DateTime:
                case DBDataType.DateTime_f: {
                    //formatter = "datetime";
                    formatter = "plaintext";
                    //editor = true;

                    break;
                }

                case DBDataType.Time:
                case DBDataType.Time_f: {
                    formatter = "datetime";
                        // TODO: make this locale dependent.
                    formatterParams.outputFormat = "HH:mm:ss";
                    //editor = true;

                    break;
                }

                case DBDataType.Year: {
                    formatter = "datetime";
                    formatterParams = {
                        outputFormat: "YYYY",
                    };
                    //editor = true;

                    break;
                }


                case DBDataType.Boolean: {
                    formatter = this.booleanFormatter;
                    //editor = this.editorHost;
                    //editorParams = (): { info: IColumnInfo } => { return { info }; };

                    break;
                }

                default: {
                    formatter = "textarea";
                    //editor = this.editorHost;
                    /*editorParams = (): { info: IColumnInfo; verticalNavigation: string } => {
                        return {
                            info,
                            verticalNavigation: "editor",
                        };
                    };*/

                    break;
                }
            }

            const width = this.columnWidthCache.get(info.title);

            return {
                title: info.title,
                field: info.field,
                formatter,
                formatterParams,
                formatterClipboard: formatter,
                //editor,
                //editorParams,
                width,
                minWidth,
                resizable: true,
                //editable: this.checkEditable,

                //cellEditing: this.cellEditing,
                //cellEdited: this.cellEdited,
            };
        });
    };

    /**
     * Triggered when the user starts editing a cell value.
     */
    /*
    private cellEditing = (): void => {
        if (this.currentCell) {
            this.currentCell.getElement().classList.remove("manualFocus");
            this.currentCell = undefined;
        }
    };
    */

    /**
     * Triggered when the user successfully edited a cell value.
     */
    /*
    private cellEdited = (): void => {
        const { resultSet, onEdit } = this.mergedProps;
        onEdit?.(resultSet);
    };
    */

    private handleColumnResized = (column: ColumnComponent): void => {
        const field = column.getDefinition().field;
        if (field) {
            // We don't remove cached widths currently, to allow having preset widths also when the user
            // switches between different queries in the same execution block.
            this.columnWidthCache.set(field, column.getWidth());
        }
    };

    private handleCellMenuItemDisabled = (props: IMenuItemProperties): boolean => {
        // istanbul ignore next
        if (!this.currentCell || !this.gridRef.current) {
            return true;
        }

        // istanbul ignore next
        const selectCount = this.gridRef.current.getSelectedRows().length ?? 0;

        switch (props.id!) {
            case "openValueMenuItem": {
                return true; // selectCount > 1;
            }

            case "setNullMenuItem": {
                return true; // selectCount > 1;
            }

            case "saveToFileMenuItem": {
                return true; // selectCount > 1;
            }

            case "loadFromFileMenuItem": {
                return true; // selectCount > 1;
            }

            case "copyRowMenuItem1": {
                return false;
            }

            case "copyRowMenuItem2": {
                return false;
            }

            case "copyRowMenuItem3": {
                return false;
            }

            case "copyRowMenuItem4": {
                return false;
            }

            case "copyRowMenuItem5": {
                return false;
            }

            case "copyRowMenuItem6": {
                return false;
            }

            case "copyFieldMenuItem": {
                return selectCount > 1;
            }

            case "copyFieldUnquotedMenuItem": {
                return selectCount > 1;
            }

            case "pasteRowMenuItem": {
                return true; // selectCount > 1;
            }

            case "deleteRowMenuItem": {
                return true;
            }

            case "capitalizeMenuItem": {
                return true; // selectCount > 1;
            }

            case "lowerCaseMenuItem": {
                return true; // selectCount > 1;
            }

            case "upperCaseMenuItem": {
                return true; // selectCount > 1;
            }

            default: {
                return true;
            }
        }
    };

    // We cannot test this method as it depends on Tabulator content (which is not rendered in tests).
    // istanbul ignore next
    private handleCellContext = (e: Event, cell: CellComponent): void => {
        if (this.currentCell) {
            this.currentCell.getElement().classList.remove("manualFocus");
        }

        this.currentCell?.cancelEdit();
        this.currentCell = cell;
        cell.getElement().classList.add("manualFocus");

        const event = e as MouseEvent;
        const targetRect = new DOMRect(event.clientX, event.clientY, 2, 2);

        this.cellContextMenuRef.current?.close();
        this.cellContextMenuRef.current?.open(targetRect, false, {});
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
            const formatterParams = cell.getColumn().getDefinition().formatterParams;
            if (formatterParams && "dbDataType" in formatterParams) {
                switch (formatterParams.dbDataType) {
                    // Binary data
                    case DBDataType.TinyBlob:
                    case DBDataType.Blob:
                    case DBDataType.MediumBlob:
                    case DBDataType.LongBlob:
                    case DBDataType.Binary:
                    case DBDataType.Varbinary: {
                        const buffer = Buffer.from(String(cell.getValue()), "base64");
                        // Convert to a HEX string
                        const bufString = buffer.toString("hex");

                        return "0x" + bufString;
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

    private handleCellContextMenuItemClick = (e: MouseEvent, props: IMenuItemProperties): boolean => {
        if (this.currentCell) {
            /*const editorParams = this.currentCell.getColumn().getDefinition().editorParams;
            if (editorParams && editorParams instanceof Function) {
                const params = editorParams(this.currentCell) as { info: IColumnInfo };

            }*/

            switch (props.id!) {
                case "openValueMenuItem": {
                    break;
                }

                case "setNullMenuItem": {
                    this.currentCell.setValue(null);
                    break;
                }

                case "saveToFileMenuItem": {
                    break;
                }

                case "loadFromFileMenuItem": {
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

                case "copyFieldMenuItem": {
                    void requisitions.writeToClipboard(this.formatCell(this.currentCell));
                    break;
                }

                case "copyFieldUnquotedMenuItem": {
                    void requisitions.writeToClipboard(this.formatCell(this.currentCell, true));

                    break;
                }

                case "pasteRowMenuItem": {
                    break;
                }

                case "deleteRowMenuItem": {
                    break;
                }

                case "capitalizeMenuItem": {
                    const value = this.currentCell.getValue() as string;
                    this.currentCell.setValue(convertCamelToTitleCase(value));

                    break;
                }

                case "lowerCaseMenuItem": {
                    const value = this.currentCell.getValue() as string;
                    this.currentCell.setValue(value.toLowerCase());

                    break;
                }

                case "upperCaseMenuItem": {
                    const value = this.currentCell.getValue() as string;
                    this.currentCell.setValue(value.toUpperCase());

                    break;
                }

                default:
            }
        }

        return true;
    };

    private copyRows = (withNames: boolean, unquoted: boolean, separator = ", "): void => {
        // istanbul ignore next
        let rows = this.gridRef.current?.getSelectedRows() ?? [];
        if (rows.length === 0 && this.currentCell) {
            rows = [this.currentCell.getRow()];
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

    };

    /*
    private checkEditable = (_cell: Tabulator.CellComponent): boolean => {
        const { status } = this.state;

        if (isNil(status) || !cell.getRow().isSelected()) {
            // No editing while loading the result or the row is not selected (allowing so the row to select,
            // without starting editing immediately).
            return false;
        }

        const editorParams = cell.getColumn().getDefinition().editorParams;
        if (editorParams && editorParams instanceof Function) {
            const params = editorParams(cell) as { info: IColumnInfo };

            return params.info.dataType.type !== DBDataType.Blob;
        }

        return true;
    };*/

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
    /*
    private editorHost = (cell: Tabulator.CellComponent, onRendered: Tabulator.EmptyCallback,
        success: Tabulator.ValueBooleanCallback, cancel: Tabulator.ValueVoidCallback,
        editorParams: Tabulator.EditorParams): HTMLElement | false => {

        cell.getTable().deselectRow();
        cell.getRow().select();

        const host = document.createElement("div");
        host.classList.add("cellEditorHost");

        this.renderCustomEditor(cell, host, cell.getValue(), success, cancel, editorParams);

        onRendered(() => {
            const inputs = host.getElementsByTagName("textarea");
            if (inputs.length > 0) {
                const element = inputs[0] as HTMLElement;

                element.style.height = "0"; // This line is important or the scroll height will never shrink.
                element.style.height = `${element.scrollHeight}px`;

                cell.getRow().normalizeHeight();

                element.focus();
            }
        });

        return host;
    };*/

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
    /*
    private renderCustomEditor = (cell: Tabulator.CellComponent, host: HTMLDivElement, value: unknown,
        success: Tabulator.ValueBooleanCallback, cancel: Tabulator.ValueVoidCallback, editorParams: unknown): void => {

        const params = (typeof editorParams === "function" ? editorParams(cell) : editorParams) as IDictionary;
        const info: IColumnInfo = params.info as IColumnInfo;

        let element;
        switch (info.dataType.type) {
            case DBDataType.TinyInt:
            case DBDataType.SmallInt:
            case DBDataType.MediumInt:
            case DBDataType.Int:
            case DBDataType.Bigint: {
                element = <UpDown
                    value={value as number ?? 0}
                    textAlignment={TextAlignment.Start}
                    onChange={(newValue): void => {
                        this.renderCustomEditor(cell, host, newValue, success, cancel, editorParams);
                    }}
                    onConfirm={(): void => {
                        success(value);
                    }}
                    onCancel={(): void => {
                        cancel(undefined);
                    }}
                    onBlur={(): void => {
                        success(value);
                    }}
                />;

                break;
            }

            case DBDataType.String:
            case DBDataType.Char:
            case DBDataType.Nchar:
            case DBDataType.Varchar:
            case DBDataType.Nvarchar:
            case DBDataType.TinyText:
            case DBDataType.Text:
            case DBDataType.MediumText:
            case DBDataType.LongText: {
                element = <Input
                    value={value as string ?? ""}
                    multiLine
                    onChange={(e: InputEvent<Element>, props: IInputChangeProperties): void => {
                        // Auto grow the input field (limited by a max height CSS setting).
                        const element = e.target as HTMLElement;
                        element.style.height = "0";
                        element.style.height = `${element.scrollHeight}px`;

                        cell.checkHeight();

                        this.renderCustomEditor(cell, host, props.value, success, cancel, editorParams);
                    }}
                    onConfirm={(): void => {
                        success(value);
                        cell.checkHeight();
                    }}
                    onCancel={(): void => {
                        cancel(undefined);
                        cell.checkHeight();
                    }}
                    onBlur={(): void => {
                        success(value);
                        cell.checkHeight();
                    }}
                />;

                break;
            }
            case DBDataType.Date:
            case DBDataType.DateTime:
            case DBDataType.DateTime_f: {
                // TODO: decide if we want a custom editor here.
                break;
            }

            case DBDataType.Time:
            case DBDataType.Time_f:
            case DBDataType.Year: {
                // TODO: decide if we want a custom editor here.
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
                // TODO: decide if we want a custom editor here.

                break;
            }

            case DBDataType.Json: {

                break;
            }

            case DBDataType.Bit: {

                break;
            }

            case DBDataType.Boolean: {

                break;
            }

            case DBDataType.Enum: {

                break;
            }

            case DBDataType.Set: {

                break;
            }

            default:
        }

        if (element) {
            render(element, host);
        }
    };*/

    // Also here: cannot test if it is not rendered.
    // istanbul ignore next
    private stringFormatter = (cell: CellComponent): string | HTMLElement => {
        let element;
        const value = cell.getValue();
        if (value == null) {
            const host = document.createElement("div");
            host.className = "iconHost";

            element = <Icon src={nullIcon} width={30} height={11} />;
            render(element, host);

            return host;
        } else {
            return value as string;
        }
    };

    // istanbul ignore next
    private binaryFormatter = (cell: CellComponent): string | HTMLElement => {
        let element;
        if (cell.getValue() === null) {
            const host = document.createElement("div");
            host.className = "iconHost";

            element = <Icon src={nullIcon} width={30} height={11} />;
            render(element, host);

            return host;
        } else {
            // Binary data is given as a based64 encoded string
            const val = cell.getValue() as string;
            if (val) {
                const buffer = Buffer.from(val, "base64");
                // Convert to a HEX string and truncate at 32 bytes
                const bufString = buffer.toString("hex");

                return "0x" + ((bufString.length > 64) ? bufString.substring(0, 63) + "&hellip;" : bufString);
            } else {
                return "";
            }
        }
    };

    // istanbul ignore next
    private blobFormatter = (cell: CellComponent): string | HTMLElement => {
        const source = cell.getValue() === null ? nullIcon : blobIcon;
        const icon = <Icon src={source} width={30} height={11} />;

        const host = document.createElement("div");
        host.className = "iconHost";

        render(icon, host);

        return host;
    };

    // istanbul ignore next
    private booleanFormatter = (cell: CellComponent): string | HTMLElement => {
        const host = document.createElement("div");
        let element;
        if (cell.getValue() === null) {
            element = <Icon src={nullIcon} width={30} height={11} />;
            host.className = "iconHost";
        } else {
            element = <Checkbox checkState={cell.getValue() === 0 ? CheckState.Unchecked : CheckState.Checked} />;
            host.className = "checkBoxHost";
        }

        render(element, host);

        return host;
    };

}
