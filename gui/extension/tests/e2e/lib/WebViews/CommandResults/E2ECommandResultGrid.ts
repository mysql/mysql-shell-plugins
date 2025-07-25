/*
 * Copyright (c) 2024, 2025 Oracle and/or its affiliates.
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
 * separately licensed software that they have included with
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

import { WebElement, until, Key, Condition, error, Button, Origin } from "selenium-webdriver";
import clipboard from "clipboardy";
import { keyboard, Key as nutKey } from "@nut-tree-fork/nut-js";
import { driver } from "../../Misc";
import * as constants from "../../constants";
import * as interfaces from "../../interfaces";
import * as locator from "../../locators";
import { Os } from "../../Os";
import { E2ECommandResult } from "./E2ECommandResult";
import { ConfirmDialog } from "../Dialogs/ConfirmationDialog";
import { E2ECodeEditor } from "../E2ECodeEditor";
import { E2ELogger } from "../../E2ELogger";

const gridLocator = locator.notebook.codeEditor.editor.result.grid;
const toolbarLocator = locator.notebook.codeEditor.editor.result.toolbar;

/**
 * This class represents a command result grid and all its related functions
 */
export class E2ECommandResultGrid extends E2ECommandResult {

    /** The columns of the result query, if exists*/
    #columnsMap: Map<string, string> | undefined;

    /** The result status*/
    #status: string | undefined;

    /**
     * Gets the columnsMap
     * @returns The columnsMap
     */
    public get columnsMap(): Map<string, string> | undefined {
        return this.#columnsMap;
    }

    /**
     * Gets the status
     * @returns The status
     */
    public get status(): string | undefined {
        return this.#status;
    }

    /**
     * Maps the result grid columns to the corresponding tabulator field number
     * @returns A promise resolving when the map is finished
     */
    public setColumnsMap = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                const columns = await this.resultContext
                    .findElements(locator.notebook.codeEditor.editor.result.grid.column);

                if (columns.length > 0) {
                    this.#columnsMap = new Map();

                    for (const column of columns) {
                        const title = await column
                            .findElement(locator.notebook.codeEditor.editor.result.grid.columnTitle);
                        this.#columnsMap.set(await title.getAttribute("innerHTML"),
                            await column.getAttribute("tabulator-field"));
                    }

                    return true;
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait1second * 5, `Could not set the columns map for command ${this.command}`);
    };

    /**
     * Sets the toolbar status message
     * @returns A promise resolving when the toolbar status message is set
     */
    public setStatus = async (): Promise<void> => {
        let status: WebElement | undefined;

        await driver.wait(async () => {
            status = await this.resultContext.findElement(toolbarLocator.status.text);

            return (await status.getAttribute("innerHTML")) !== "";
        }, constants.wait1second * 5, `The status is empty for cmd ${this.command}`);

        this.#status = await status.getAttribute("innerHTML");
    };

    /**
     * Verifies if the grid is editable
     * @returns A condition resolving to true if the grid is editable
     */
    public untilIsEditable = (): Condition<boolean> => {
        return new Condition(`for result grid to be editable`, async () => {
            const editButton = await this.resultContext
                .findElement(locator.notebook.codeEditor.editor.result.toolbar.editButton);

            return (await editButton.getAttribute("class")).includes("disabled") === false;
        });
    };

    /**
     * Gets the edit button
     * @returns A promise resolving with the edit button
     */
    public getEditButton = (): Promise<WebElement | undefined> => {
        return this.resultContext.findElement(toolbarLocator.editButton);
    };

    /**
     * Starts the editing of a grid
     * @returns A promise resolving when the edit button is clicked
     */
    public edit = async (): Promise<void> => {
        await (await this.getEditButton()).click();
    };

    /**
     * Refreshes a result grid
     * @returns A promise resolving when the refresh button is clicked
     */
    public refresh = async (): Promise<void> => {
        await this.resultContext.findElement(toolbarLocator.refreshButton).click();
    };

    /**
     * Edits a cell from a result grid
     * @param cells The result grid cells
     * @param method The method to edit the cells (double-click, keyboard, button)
     * @returns A promise resolving when the new value is set
     */
    public editCells = async (cells: interfaces.IResultGridCell[], method: string): Promise<void> => {
        await driver.wait(this.untilIsEditable(), constants.wait1second * 5,
            `The grid is not editable`);

        const updateValue = async (cellRef: interfaces.IResultGridCell): Promise<void> => {

            const cell = await this.getCell(cellRef.rowNumber, cellRef.columnName); // avoid stale
            const expectInput = typeof cellRef.value === "string";

            if (expectInput) {
                let input: WebElement;
                const inputBox = await cell.findElements(locator.htmlTag.input);
                const textArea = await cell.findElements(locator.htmlTag.textArea);

                if (inputBox.length > 0) {
                    input = inputBox[0];
                } else if (textArea.length > 0) {
                    input = textArea[0];
                } else {
                    throw new Error(`Could not find an input nor a textarea when editing cell for ${cellRef
                        .columnName}`);
                }

                const isDateTime = (await cell
                    .findElements(gridLocator.row.cell.dateTimeInput)).length > 0;

                if (!isDateTime) {
                    await this.clearCellInputField(input);
                    if (!isNaN(parseInt(cellRef.value as string, 10))) {
                        await input.sendKeys(cellRef.value as string); // is a number
                    } else {
                        await driver.executeScript("arguments[0].value=arguments[1]", input, cellRef.value as string);
                    }
                } else {
                    await driver.executeScript("arguments[0].value=arguments[1]", input, cellRef.value as string);
                }
            } else {
                await this.setCellBooleanValue(cellRef.rowNumber, cellRef.columnName,
                    cellRef.value as boolean);
            }
        };

        const saveCellChanges = async (cellRef: interfaces.IResultGridCell
            , method?: string): Promise<void> => {
            let isDate = false;

            const cell = await this.getCell(cellRef.rowNumber, cellRef.columnName); // avoid stale
            const isDateTime = (await cell
                .findElements(gridLocator.row.cell.dateTimeInput)).length > 0;

            if (!isDateTime) {
                if (method === constants.editButton) {
                    await keyboard.type(nutKey.Tab);
                } else {
                    await this.resultContext
                        .findElement(locator.notebook.codeEditor.editor.result.toolbar.exists).click();
                }

            } else {
                isDate = true;
                if (method === constants.editButton) {
                    await keyboard.type(nutKey.Tab);
                } else {
                    await this.resultContext
                        .findElement(locator.notebook.codeEditor.editor.result.toolbar.exists).click();
                }
            }

            if (isDate) {
                await driver.wait(async () => {
                    return (await this.getCellValue(cellRef.rowNumber,
                        cellRef.columnName)) !== "Invalid Date";
                }, constants.wait1second * 2, `Invalid Date was found after inserting value '${cellRef.value}'`);
            }

            await driver.wait(async () => {
                const cell = await this.getCell(cellRef.rowNumber, cellRef.columnName);

                return (await cell.getAttribute("class")).includes("changed");
            }, constants.wait1second * 2,
                `Yellow background does not exist on cell after inserting value '${cellRef.value}'`);
        };

        if (method === constants.editButton) {
            const tableColumns: string[] = [];
            for (const key of this.columnsMap.keys()) {
                tableColumns.push(key);
            }

            await driver.wait(async () => {
                try {
                    await this.edit();
                    await driver.wait(this.untilIsEditing(cells[0].rowNumber, tableColumns[0]),
                        constants.wait1second * 3);

                    return true;
                } catch (e) {
                    if (!(e instanceof error.TimeoutError)) {
                        throw e;
                    }
                }
            }, constants.wait1second * 10, `Could not start editing row ${cells[0].rowNumber}`);

            for (let i = 0; i <= cells.length - 1; i++) {
                await driver.wait(async () => {
                    try {
                        if (await this.isEditing(cells[i].rowNumber, cells[i].columnName)) {
                            await updateValue(cells[i]);

                            if (i === cells.length - 1) {
                                await saveCellChanges(cells[i], constants.pressEnter);
                            } else {
                                await saveCellChanges(cells[i], method);
                            }

                        } else {
                            await keyboard.type(nutKey.Tab);
                        }

                        return true;
                    } catch (err) {
                        if (err instanceof error.StaleElementReferenceError) {
                            await driver.actions().sendKeys(Key.ESCAPE).perform();
                        } else if (String(err).includes("Could not find an input")) {
                            i--;
                        } else {
                            throw err;
                        }
                    }
                }, constants.wait1second * 10, `The cell on column ${cells[i].columnName} was always stale`);
            }
        } else {
            for (let i = 0; i <= cells.length - 1; i++) {
                await driver.wait(async () => {
                    try {
                        await this.startEditCell(cells[i].rowNumber, cells[i].columnName, method);
                        await updateValue(cells[i]);

                        if (i === cells.length - 1 && method === constants.editButton) {
                            await saveCellChanges(cells[i], constants.pressEnter);
                        } else {
                            await saveCellChanges(cells[i], method);
                        }

                        return true;
                    } catch (err) {
                        if (err instanceof error.StaleElementReferenceError ||
                            err instanceof error.ElementNotInteractableError ||
                            String(err).includes("Could not find an input")
                        ) {
                            await driver.actions().sendKeys(Key.ESCAPE).perform();
                        } else {
                            throw err;
                        }
                    }
                }, constants.wait1second * 10, `The cell on column ${cells[i].columnName} was always stale`);
            }
        }
    };

    /**
     * Gets the value of a cell from a result grid
     * @param gridRow The row number. If the row number is -1, the function returns the last added row
     * @param gridRowColumn The column
     * @returns A promise resolving with the cell value.
     */
    public getCellValue = async (gridRow: number, gridRowColumn: string): Promise<string> => {
        let toReturn = "";

        await driver.wait(async () => {
            try {
                const cell = await this.getCell(gridRow, gridRowColumn);
                await driver.executeScript("arguments[0].scrollIntoView()", cell);
                const isSelectList = (await cell
                    .findElements(gridLocator.row.cell.selectList.exists))
                    .length > 0;
                const isIcon = (await cell.findElements(gridLocator.row.cell.icon))
                    .length > 0;
                if (isSelectList) {
                    const selectList = cell
                        .findElement(gridLocator.row.cell.selectList.exists);
                    toReturn = await (await selectList.findElement(locator.htmlTag.label)).getText();
                } else if (isIcon) {
                    const img = await cell.findElements(gridLocator.row.cell.icon);
                    const icon = (await img[0].getAttribute("style")).match(/assets\/data-(.*)-/)[1];
                    toReturn = icon;
                } else {
                    toReturn = await cell.getText();
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait1second * 5, `Cell ${gridRowColumn} was always stale`);

        return toReturn;
    };

    /**
     * Verifies if the cell value equals to @value
     * @param gridRow The row number. If the row number is -1, the function returns the last added row
     * @param gridRowColumn The column
     * @param value The expected value
     * @returns A condition resolving to true if the value equals to @value.
     */
    public untilCellValueIs = (gridRow: number, gridRowColumn: string, value: string): Condition<boolean> => {
        return new Condition(`for cell value to be '${value}'`, async () => {
            return (await this.getCellValue(gridRow, gridRowColumn)) === value;
        });
    };

    /**
     * Adds a row into a result grid
     * @param cells The cells
     * @returns A promise resolving when the new value is set
     */
    public addRow = async (cells: interfaces.IResultGridCell[]): Promise<void> => {
        await driver.sleep(2000); // hack to face the issue of non-NULL default values on some data types
        await this.clickAddNewRowButton();
        await driver.wait(this.untilNewRowExists(), constants.wait1second * 5);

        const performAdd = async (cell: interfaces.IResultGridCell): Promise<void> => {
            let isDate = false;
            const refCell = await this.getCell(-1, cell.columnName);
            const expectInput = typeof cell.value === "string";
            await this.startEditCell(-1, cell.columnName, constants.doubleClick);

            if (expectInput) {
                let input: WebElement;
                const inputBox = await refCell.findElements(locator.htmlTag.input);
                const textArea = await refCell.findElements(locator.htmlTag.textArea);

                if (inputBox.length > 0) {
                    input = inputBox[0];
                } else if (textArea.length > 0) {
                    input = textArea[0];
                } else {
                    throw new Error(`Could not find an input nor a textarea when editing cell for ${cell
                        .columnName}`);
                }

                const isDateTime = (await refCell
                    .findElements(gridLocator.row.cell.dateTimeInput)).length > 0;

                if (!isDateTime) {
                    isDate = false;
                    await this.clearCellInputField(input);
                    await input.sendKeys(cell.value as string);
                } else {
                    isDate = true;
                    await driver.executeScript("arguments[0].value=arguments[1]", input, cell.value as string);
                }

                await this.resultContext
                    .findElement(locator.notebook.codeEditor.editor.result.toolbar.exists).click();
            } else {
                await this.setCellBooleanValue(-1, cell.columnName, cell.value as boolean);
            }

            if (isDate) {
                await driver.wait(async () => {
                    return (await this.getCellValue(-1, cell.columnName)) !== "Invalid Date";
                }, constants.wait1second * 2, `Invalid Date was found after inserting value '${cell.value}'`);
            }
        };

        for (const cell of cells) {
            await driver.wait(async () => {
                try {
                    await performAdd(cell);

                    return true;
                } catch (err) {
                    if (err instanceof error.StaleElementReferenceError) {
                        await driver.actions().sendKeys(Key.ESCAPE).perform();
                    } else {
                        throw err;
                    }
                }
            }, constants.wait1second * 10, `The cell on column ${cell.columnName} was always stale`);
        }
    };

    /**
     * Gets the cell icon type
     * @param gridRow The row number. If the row number is -1, the function returns the last added row
     * @param gridRowColumn The column
     * @returns A promise resolving with the cell icon type
     */
    public getCellIconType = async (gridRow: number, gridRowColumn: string): Promise<string | undefined> => {
        let icon = "";
        await driver.wait(async () => {
            try {
                const cell = await this.getCell(gridRow, gridRowColumn);
                const img = await cell.findElements(gridLocator.row.cell.icon);
                icon = (await img[0].getAttribute("style")).match(/assets\/data-(.*)-/)[1];

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait1second * 5, "Unable to get the cell icon type");

        return icon;
    };

    /**
     * Sets a result grid cell with
     * @param gridRow The row number. If the row number is -1, the function returns the last added row
     * @param gridRowColumn The column
     * @param reduce The method to reduce (selenium/js). Js will reduce the cell using js, otherwise selenium
     * @returns A promise resolving when the cell is resized
     */
    public reduceCellWidth = async (gridRow: number, gridRowColumn: string, reduce = "selenium"): Promise<void> => {
        await driver.wait(async () => {
            try {
                let counter = 0;
                let cell = await this.getCell(gridRow, gridRowColumn);
                const getCellWidth =
                    "return window.getComputedStyle(arguments[0]).getPropertyValue('width'); ";
                const cellWidth: string = await driver.executeScript(getCellWidth, cell);

                if (counter > 0) {
                    reduce = "js";
                }

                if (reduce === "selenium") {
                    try {
                        const rect = await cell.getRect();
                        await driver.actions().move({
                            x: Math.round(rect.width / 2),
                            y: Math.round((rect.height / 2) * -1),
                            origin: cell,
                        })
                            .press(Button.LEFT)
                            .move({
                                x: Math.round((rect.width * 0.8) * -1),
                                origin: Origin.POINTER,
                            })
                            .release(Button.LEFT)
                            .perform();
                        counter++;
                    } catch (e) {
                        if (e instanceof error.MoveTargetOutOfBoundsError) {
                            cell = await this.getCell(gridRow, gridRowColumn);
                            await driver
                                .executeScript(`arguments[0].setAttribute("style", "width: 40px; height: 24px;")`,
                                    cell);
                        } else {
                            throw e;
                        }
                    }
                } else {
                    await driver.executeScript(`arguments[0].setAttribute("style", "width: 30px; height: 24px;")`,
                        cell);
                }

                cell = await this.getCell(gridRow, gridRowColumn);
                const newCellWidth: string = await driver.executeScript(getCellWidth, cell);

                return parseInt(newCellWidth.replace("px", ""), 10) < parseInt(cellWidth.replace("px", ""), 10);
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait1second * 3, `The cell width was not reduced on column ${gridRowColumn}`);

    };

    /**
     * Gets a cell tooltip
     * @param gridRow The row number
     * @param columnName The column name
     * @returns A promise resolving with the cell tooltip
     */
    public getCellTooltip = async (gridRow: number, columnName: string): Promise<string | undefined> => {
        let tooltipText: string | undefined;

        await driver.wait(async () => {
            try {
                const cell = await this.getCell(gridRow, columnName);
                await driver.actions().move({
                    origin: cell,
                    x: -5,
                    y: -5,
                }).perform();

                tooltipText = await driver.wait(async () => {
                    const tooltip = await driver.findElements(locator.notebook.codeEditor.tooltip);
                    if (tooltip.length > 0) {
                        return tooltip[0].getText();
                    }
                }, constants.wait1second * 5,
                    `Could not find tooltip for cell on row '${gridRow}' and column '${columnName}'`);

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait1second * 10,
            `Could not get the tooltip for cell on row '${gridRow}' and column '${columnName}'`);

        return tooltipText;
    };

    /**
     * Opens the context menu for a result grid cell and selects a value from the menu
     * @param gridRow The row number
     * @param columnName The column name
     * @param contextMenuItem The menu item to select
     * @param subContextMenuItem The sub menu item to select
     * @returns A promise resolving when menu item is clicked
     */
    public openCellContextMenuAndSelect = async (gridRow: number, columnName: string,
        contextMenuItem: string,
        subContextMenuItem?: string): Promise<void> => {

        const cellContextMenu = locator.notebook.codeEditor.editor.result.grid.row.cell.contextMenu;

        const getCellMenuItem = async (contextMenu: WebElement, itemName: string): Promise<WebElement> => {
            const items = await contextMenu.findElements(cellContextMenu.item);
            for (const item of items) {
                if (await item.getText() === itemName) {
                    return item;
                }
            }

            throw new Error(`Could not find item '${itemName}' on cell context menu`);
        };

        await driver.wait(async () => {
            try {
                await driver.findElement(locator.notebook.codeEditor.textArea)
                    .sendKeys(Key.ESCAPE); // Remove context menu if exists
                const cell = await this.getCell(gridRow, columnName);
                await driver
                    // eslint-disable-next-line max-len
                    .executeScript("arguments[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button: 2 }));"
                        , cell);
                const contextMenu = await driver.wait(until
                    .elementLocated(cellContextMenu.exists),
                    constants.wait1second * 5, "Cell context menu was not displayed");
                const cellMenuItem = await getCellMenuItem(contextMenu, contextMenuItem);
                await driver.actions().move({ origin: cellMenuItem }).perform();

                if (subContextMenuItem) {
                    let subMenu: WebElement | undefined;
                    if (contextMenuItem === constants.resultGridContextMenu.copySingleRow) {
                        subMenu = await driver.wait(until
                            .elementLocated(cellContextMenu.copySingleRowSubMenu),
                            constants.wait1second * 5, "Copy Row sub menu was not displayed");
                    } else {
                        subMenu = await driver.wait(until
                            .elementLocated(cellContextMenu.copyAllRowsSubMenu),
                            constants.wait1second * 5, "Copy All Rows sub menu was not displayed");
                    }
                    await (await getCellMenuItem(subMenu, subContextMenuItem)).click();
                } else {
                    await cellMenuItem.click();
                }

                return driver.wait(until.stalenessOf(contextMenu), constants.wait150MilliSeconds,
                    `The context menu should have been closed, after clicking ${contextMenuItem}, 
                    ${subContextMenuItem}`).then(() => {
                        return true;
                    }).catch(() => {
                        return false;
                    });
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait1second * 5,
            // eslint-disable-next-line max-len
            `Clicking on Item ${contextMenuItem}/${subContextMenuItem ? subContextMenuItem : ""} did not generate any outcome`);
    };

    /**
     * Right-clicks on a cell and selects the Copy Row item, until the item is copied
     * @param row The row number
     * @param column The column name
     * @returns A promise resolving when menu item is copied
     */
    public copyRow = async (row: number, column: string): Promise<string> => {

        const allColumns = Array.from(this.columnsMap.keys());

        await driver.wait(async () => {
            await this.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copySingleRow,
                constants.resultGridContextMenu.copySingleRowContextMenu.copyRow);
            const fieldValues = clipboard.readSync().split(",");

            if (fieldValues.length !== allColumns.length) {
                E2ELogger.debug(`clipboard: ${fieldValues.join(",")}`);
            } else {
                return true;
            }
        }, constants.wait1second * 5, `Copy row - Copied field values don't match the number of table column`);

        return ((await this.getCellValues(row)).map((item, index) => {
            if (item.match(/(.*)\/(.*)\/(.*)/)) {
                return this.formatCellDate(item, true);
            } else {
                return index !== 0 ? `'${item}'` : item;
            }
        })).join(", ");

    };

    /**
     * Right-clicks on a cell and selects the Copy Row with Names item, until the item is copied
     * @param row The row number
     * @param column The column name
     * @returns A promise resolving when menu item is copied
     */
    public copyRowWithNames = async (row: number, column: string): Promise<string[]> => {

        const allColumns = Array.from(this.columnsMap.keys());

        await driver.wait(async () => {
            await this.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copySingleRow,
                constants.resultGridContextMenu.copySingleRowContextMenu.copyRowWithNames);
            const columns = clipboard.readSync().split("\n");

            if (columns[0].split(",").length !== allColumns.length) {
                E2ELogger.debug(`clipboard: ${columns.join("\n")}`);
            } else {
                return true;
            }

            return columns[0].split(",").length === allColumns.length;
        }, constants.wait1second * 5,
            `Copy row with names - Copied field values don't match the number of table column`);

        return [
            `# ${allColumns.join(", ")}`,
            ((await this.getCellValues(row)).map((item, index) => {
                if (item.match(/(.*)\/(.*)\/(.*)/)) {
                    return this.formatCellDate(item, true);
                } else {
                    return index !== 0 ? `'${item}'` : item;
                }
            })).join(", "),
        ];

    };

    /**
     * Right-clicks on a cell and selects the Copy Row Unquoted item, until the item is copied
     * @param row The row number
     * @param column The column name
     * @returns A promise resolving when menu item is copied
     */
    public copyRowUnquoted = async (row: number, column: string): Promise<string> => {

        const allColumns = Array.from(this.columnsMap.keys());

        await driver.wait(async () => {
            await this.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copySingleRow,
                constants.resultGridContextMenu.copySingleRowContextMenu.copyRowUnquoted);
            const fieldValues = clipboard.readSync().split(",");

            if (fieldValues.length !== allColumns.length) {
                E2ELogger.debug(`clipboard: ${fieldValues.join(",")}`);
            } else {
                return true;
            }
        }, constants.wait1second * 5, `Copy row unquoted - Copied field values don't match the number of table column`);

        return ((await this.getCellValues(row)).map((item) => {
            if (item.match(/(.*)\/(.*)\/(.*)/)) {
                return this.formatCellDate(item, false);
            } else {
                return item;
            }
        })).join(", ");

    };

    /**
     * Right-clicks on a cell and selects the Copy Row With Names, Unquoted item, until the item is copied
     * @param row The row number
     * @param column The column name
     * @returns A promise resolving when menu item is copied
     */
    public copyRowWithNamesUnquoted = async (row: number, column: string): Promise<string[]> => {

        const allColumns = Array.from(this.columnsMap.keys());

        await driver.wait(async () => {
            await this.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copySingleRow,
                constants.resultGridContextMenu.copySingleRowContextMenu.copyRowWithNamesUnquoted);
            const fieldValues = clipboard.readSync().split("\n");

            if (fieldValues[0].split(",").length !== allColumns.length) {
                E2ELogger.debug(`clipboard: ${fieldValues.join("\n")}`);
            } else {
                return true;
            }
        }, constants.wait1second * 5,
            `Copy row with names unquoted - Copied field values don't match the number of table column`);

        return [
            `# ${allColumns.join(", ")}`,
            ((await this.getCellValues(row)).map((item) => {
                if (item.match(/(.*)\/(.*)\/(.*)/)) {
                    return this.formatCellDate(item, false);
                } else {
                    return item;
                }
            })).join(", "),
        ];

    };

    /**
     * Right-clicks on a cell and selects the Copy Row With Names, tab separated item, until the item is copied
     * @param row The row number
     * @param column The column name
     * @returns A promise resolving when menu item is copied
     */
    public copyRowWithNamesTabSeparated = async (row: number, column: string): Promise<string[]> => {

        const allColumns = Array.from(this.columnsMap.keys());

        await driver.wait(async () => {
            await this.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copySingleRow,
                constants.resultGridContextMenu.copySingleRowContextMenu.copyRowWithNamesTabSeparated);
            const fieldValues = clipboard.readSync().split("\n");

            if (fieldValues[0].split("\t").length !== allColumns.length) {
                E2ELogger.debug(`clipboard: ${fieldValues.join("\n")}`);
            } else {
                return true;
            }
        }, constants.wait1second * 5,
            `Copy row with names, tab separated - Copied field values don't match the number of table column`);

        return [
            `# ${allColumns.join("\t")}`,
            ((await this.getCellValues(row)).map((item, index) => {
                if (item.match(/(.*)\/(.*)\/(.*)/)) {
                    return this.formatCellDate(item, true);
                } else {
                    return index !== 0 ? `'${item}'` : item;
                }
            })).join("\t"),
        ];

    };

    /**
     * Right-clicks on a cell and selects the Copy Row, tab separated item, until the item is copied
     * @param row The row number
     * @param column The column name
     * @returns A promise resolving when menu item is copied
     */
    public copyRowTabSeparated = async (row: number, column: string): Promise<string> => {

        const allColumns = Array.from(this.columnsMap.keys());

        await driver.wait(async () => {
            await this.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copySingleRow,
                constants.resultGridContextMenu.copySingleRowContextMenu.copyRowTabSeparated);
            const fieldValues = clipboard.readSync().split("\t");

            if (fieldValues.length !== allColumns.length) {
                E2ELogger.debug(`clipboard: ${fieldValues.join("\t")}`);
            } else {
                return true;
            }
        }, constants.wait1second * 5,
            `Copy row, tab separated - Copied field values don't match the number of table column`);

        return ((await this.getCellValues(row)).map((item, index) => {
            if (item.match(/(.*)\/(.*)\/(.*)/)) {
                return this.formatCellDate(item, true);
            } else {
                return index !== 0 ? `'${item}'` : item;
            }
        })).join("\t");

    };

    /**
     * Right-clicks on a cell and selects the Copy All Rows, until the item is copied
     * @param row The row number
     * @param column The column name
     * @returns A promise resolving when menu item is copied
     */
    public copyAllRows = async (row: number, column: string): Promise<string[]> => {

        const allColumns = Array.from(this.columnsMap.keys());

        await driver.wait(async () => {
            await this.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copyMultipleRows,
                constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRows);

            if (Os.getClipboardContent()[0].split(",").length !== allColumns.length) {
                E2ELogger.debug(`clipboard: ${Os.getClipboardContent().toString()}`);
            } else {
                return true;
            }
        }, constants.wait1second * 5,
            `Copy all rows - Copied field values don't match the number of table column`);

        const toReturn: string[] = [];
        const rows = await this.resultContext.findElements(gridLocator.row.exists);

        for (let i = 0; i <= rows.length - 1; i++) {
            toReturn.push(((await this.getCellValues(i)).map((item, index) => {
                if (item.match(/(.*)\/(.*)\/(.*)/)) {
                    return this.formatCellDate(item, true);
                } else {
                    return index !== 0 ? `'${item}'` : item;
                }
            })).join(","));
        }

        return toReturn;
    };

    /**
     * Right-clicks on a cell and selects the Copy All Rows with Names, until the items are copied
     * @param row The row number
     * @param column The column name
     * @returns A promise resolving when menu item is copied
     */
    public copyAllRowsWithNames = async (row: number, column: string): Promise<string[]> => {

        const allColumns = Array.from(this.columnsMap.keys());

        await driver.wait(async () => {
            await this.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copyMultipleRows,
                constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRowsWithNames);

            if (Os.getClipboardContent()[0].split(",").length !== allColumns.length) {
                E2ELogger.debug(`clipboard: ${Os.getClipboardContent().toString()}`);
            } else {
                return true;
            }
        }, constants.wait1second * 5,
            `Copy all rows with names - Copied field values don't match the number of table column`);

        const toReturn: string[] = [`# ${allColumns.join(",")}`];
        const rows = await this.resultContext.findElements(gridLocator.row.exists);

        for (let i = 0; i <= rows.length - 1; i++) {
            toReturn.push(((await this.getCellValues(i)).map((item, index) => {
                if (item.match(/(.*)\/(.*)\/(.*)/)) {
                    return this.formatCellDate(item, true);
                } else {
                    return index !== 0 ? `'${item}'` : item;
                }
            })).join(","));
        }

        return toReturn;
    };

    /**
     * Right-clicks on a cell and selects the Copy All Rows Unquoted, until the items are copied
     * @param row The row number
     * @param column The column name
     * @returns A promise resolving when menu item is copied
     */
    public copyAllRowsUnquoted = async (row: number, column: string): Promise<string[]> => {

        const allColumns = Array.from(this.columnsMap.keys());

        await driver.wait(async () => {
            await this.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copyMultipleRows,
                constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRowsUnquoted);

            if (Os.getClipboardContent()[0].split(",").length !== allColumns.length) {
                E2ELogger.debug(`clipboard: ${Os.getClipboardContent().toString()}`);
            } else {
                return true;
            }
        }, constants.wait1second * 5,
            `Copy all rows unquoted - Copied field values don't match the number of table column`);

        const toReturn: string[] = [];
        const rows = await this.resultContext.findElements(gridLocator.row.exists);

        for (let i = 0; i <= rows.length - 1; i++) {
            toReturn.push(((await this.getCellValues(i)).map((item) => {
                if (item.match(/(.*)\/(.*)\/(.*)/)) {
                    return this.formatCellDate(item, false);
                } else {
                    return item;
                }
            })).join(","));
        }

        return toReturn;
    };

    /**
     * Right-clicks on a cell and selects the Copy All Rows With Names Unquoted, until the items are copied
     * @param row The row number
     * @param column The column name
     * @returns A promise resolving when menu item is copied
     */
    public copyAllRowsWithNamesUnquoted = async (row: number, column: string): Promise<string[]> => {

        const allColumns = Array.from(this.columnsMap.keys());

        await driver.wait(async () => {
            await this.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copyMultipleRows,
                constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRowsWithNamesUnquoted);

            if (Os.getClipboardContent()[0].split(",").length !== allColumns.length) {
                E2ELogger.debug(`clipboard: ${Os.getClipboardContent().toString()}`);
            } else {
                return true;
            }
        }, constants.wait1second * 5,
            `Copy all rows with names unquoted - Copied field values don't match the number of table column`);

        const toReturn: string[] = [`# ${allColumns.join(",")}`];
        const rows = await this.resultContext.findElements(gridLocator.row.exists);

        for (let i = 0; i <= rows.length - 1; i++) {
            toReturn.push(((await this.getCellValues(i)).map((item) => {
                if (item.match(/(.*)\/(.*)\/(.*)/)) {
                    return this.formatCellDate(item, false);
                } else {
                    return item;
                }
            })).join(","));
        }

        return toReturn;
    };

    /**
     * Right-clicks on a cell and selects the Copy All Rows With Names Tab Separated, until the items are copied
     * @param row The row number
     * @param column The column name
     * @returns A promise resolving when menu item is copied
     */
    public copyAllRowsWithNamesTabSeparated = async (row: number, column: string): Promise<string[]> => {

        const allColumns = Array.from(this.columnsMap.keys());

        await driver.wait(async () => {
            await this.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copyMultipleRows,
                constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRowsWithNamesTabSeparated);

            if (Os.getClipboardContent()[0].split("\t").length !== allColumns.length) {
                E2ELogger.debug(`clipboard: ${Os.getClipboardContent().toString()}`);
            } else {
                return true;
            }
        }, constants.wait1second * 5,
            `Copy all rows with names tab separated - Copied field values don't match the number of table column`);

        const toReturn: string[] = [`# ${allColumns.join("\t")}`];
        const rows = await this.resultContext.findElements(gridLocator.row.exists);

        for (let i = 0; i <= rows.length - 1; i++) {
            toReturn.push(((await this.getCellValues(i)).map((item, index) => {
                if (item.match(/(.*)\/(.*)\/(.*)/)) {
                    return this.formatCellDate(item, true);
                } else {
                    return index !== 0 ? `'${item}'` : item;
                }
            })).join("\t"));
        }

        return toReturn;
    };

    /**
     * Right-clicks on a cell and selects the Copy All Rows Tab Separated, until the items are copied
     * @param row The row number
     * @param column The column name
     * @returns A promise resolving when menu item is copied
     */
    public copyAllRowsTabSeparated = async (row: number, column: string): Promise<string[]> => {

        const allColumns = Array.from(this.columnsMap.keys());

        await driver.wait(async () => {
            await this.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copyMultipleRows,
                constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRowsTabSeparated);

            if (Os.getClipboardContent()[0].split("\t").length !== allColumns.length) {
                E2ELogger.debug(`clipboard: ${Os.getClipboardContent().toString()}`);
            } else {
                return true;
            }
        }, constants.wait1second * 5,
            `Copy all rows tab separated - Copied field values don't match the number of table column`);

        const toReturn: string[] = [];
        const rows = await this.resultContext.findElements(gridLocator.row.exists);

        for (let i = 0; i <= rows.length - 1; i++) {
            toReturn.push(((await this.getCellValues(i)).map((item, index) => {
                if (item.match(/(.*)\/(.*)\/(.*)/)) {
                    return this.formatCellDate(item, true);
                } else {
                    return index !== 0 ? `'${item}'` : item;
                }
            })).join("\t"));
        }

        return toReturn;
    };

    /**
     * Right-clicks on a cell and selects the Copy Field from the context menu, until the item is copied
     * @param row The row number
     * @param column The column name
     * @returns A promise resolving when menu item is copied
     */
    public copyField = async (row: number, column: string): Promise<string> => {
        await driver.wait(async () => {
            await this.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copyField);

            return clipboard.readSync().match(/'.*'|(\d+)/) !== null;
        }, constants.wait1second * 5, `The Copy Field did not copied anything to the clipboard for column '${column}'`);

        const cellValue = await this.getCellValue(row, column);

        if (cellValue.match(/(.*)\/(.*)\/(.*)/)) {
            const dateItems = cellValue.split("/");

            if (Os.isMacOs()) {
                return `'${dateItems[2]}-${dateItems[1]}-${dateItems[0]}'`;
            }

            return `'${dateItems[2]}-${dateItems[0]}-${dateItems[1]}'`;
        } else {
            return `'${cellValue}'`;
        }
    };

    /**
     * Right-clicks on a cell and selects the Copy Field Unquoted from the context menu, until the item is copied
     * @param row The row number
     * @param column The column name
     * @returns A promise resolving when menu item is copied
     */
    public copyFieldUnquoted = async (row: number, column: string): Promise<string> => {
        await driver.wait(async () => {
            await this.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copyFieldUnquoted);

            return clipboard.readSync().match(/.*/) !== null;
        }, constants.wait1second * 5,
            `The Copy Field Unquoted did not copied anything to the clipboard for column '${column}'`);

        const cellValue = await this.getCellValue(row, column);

        if (cellValue.match(/(.*)\/(.*)\/(.*)/)) {
            const dateItems = cellValue.split("/");

            if (Os.isMacOs()) {
                return `${dateItems[2]}-${dateItems[1]}-${dateItems[0]}`;
            }

            return `${dateItems[2]}-${dateItems[0]}-${dateItems[1]}`;
        } else {
            return cellValue;
        }
    };

    /**
     * Verifies the row is marked for deletion (red background)
     * @param gridRow The row number
     * @returns A condition resolving to true if the row is marked for deletion, false otherwise
     */
    public untilRowIsMarkedForDeletion = (gridRow: number): Condition<boolean> => {
        return new Condition(`for row to be marked for deletion`, async () => {
            const row = await this.getRow(gridRow);

            return (await row.getAttribute("class")).includes("deleted");
        });
    };

    /**
     * Verifies if the tooltip is equal to the expected value
     * @param rowNumber The row number
     * @param rowColumn The column name
     * @param expectedTooltip The expected tooltip
     * @returns A condition resolving to true if the tooltip is equal to the expected value, false otherwise
     */
    public untilCellTooltipIs = (
        rowNumber: number,
        rowColumn: string,
        expectedTooltip: string): Condition<boolean> => {
        return new Condition(` tooltip to be '${expectedTooltip}'`, async () => {
            const tooltip = await this.getCellTooltip(rowNumber, rowColumn);

            return tooltip.replace(/\s/g, "") === expectedTooltip.replace(/\s/g, "");
        });
    };

    /**
     *Verifies if the result grid cells were changed
     * @param changed The expected number of changed cells
     * @returns A condition resolving to true if the cells were changed, false otherwise
     */
    public untilCellsWereChanged = (changed: number): Condition<boolean> => {
        return new Condition(`for changed ${changed} cells to be marked has changed (yellow background)`, async () => {
            return (await this.resultContext
                .findElements(locator.notebook.codeEditor.editor.result.changedTableCell)).length === changed;
        });
    };

    /**
     * Gets the rows of a result grid
     * @returns A promise resolving with the rows
     */
    public getRows = async (): Promise<WebElement[]> => {
        return this.resultContext.findElements(gridLocator.row.exists);
    };

    /**
     * Gets a row of a result grid
     * @param gridRow The row number or the row as WebElement
     * @returns A promise resolving with the row
     */
    public getRow = async (gridRow: number): Promise<WebElement> => {
        const rows = await this.getRows();

        return rows[gridRow];
    };

    /**
     * Gets the row cell values of a result grid
     * @param rowNumber The row number
     * @returns A promise resolving with the row values as an array of strings
     */
    public getCellValues = async (rowNumber: number): Promise<string[]> => {
        let values: string[] = [];

        await driver.wait(async () => {
            try {
                const rows = await this.resultContext.findElements(gridLocator.row.exists);
                const cells = await rows[rowNumber].findElements(gridLocator.row.cell.exists);

                for (const cell of cells) {
                    await driver.executeScript("arguments[0].scrollIntoView()", cell);
                    const isSelectList = (await cell
                        .findElements(gridLocator.row.cell.selectList.exists))
                        .length > 0;
                    const isIcon = (await cell.findElements(gridLocator.row.cell.icon))
                        .length > 0;
                    if (isSelectList) {
                        const selectList = cell
                            .findElement(gridLocator.row.cell.selectList.exists);
                        values.push(await (await selectList.findElement(locator.htmlTag.label)).getText());
                    } else if (isIcon) {
                        const img = await cell.findElements(gridLocator.row.cell.icon);
                        const icon = (await img[0].getAttribute("style")).match(/assets\/data-(.*)-/)[1];
                        values.push(icon);
                    } else {
                        values.push(await cell.getText());
                    }
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                } else {
                    values = [];
                }
            }
        }, constants.wait1second * 5, `Could not get the row values for row number ${rowNumber}`);

        return values;
    };

    /**
     * Verifies if the status matches a regex
     * @param regex The regex
     * @returns A condition resolving to true if status matches the regex
     */
    public untilStatusMatches = (regex: RegExp): Condition<boolean> => {
        return new Condition(`for status to match '${regex.toString()}'`, async () => {
            const codeEditor = new E2ECodeEditor(this.id);
            const result = await codeEditor.getResult(this.command, this.id);
            this.resultContext = result;
            await this.setStatus();

            return this.status.match(regex) !== null;
        });
    };

    /**
     * Verifies if a row is highlighted
     * @param gridRow The row
     * @returns A condition resolving to true if the row is highlighted, false otherwise
     */
    public untilRowIsHighlighted = (gridRow: number): Condition<boolean> => {
        return new Condition(`for row ${gridRow} to be highlighted`, async () => {
            const rows = await this.resultContext.findElements(gridLocator.row.exists);

            if (rows.length > 0) {
                return (await rows[gridRow].getAttribute("class")).includes("tabulator-selected");
            } else {
                return false;
            }
        });
    };

    /**
     * Starts the focus on the result grid by pressing keys (CMD/META + ALT + ENTER)
     * @returns A promise resolving when the first result grid cell is focused
     */
    public startFocus = async (): Promise<void> => {
        await driver.wait(async () => {
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await driver.executeScript("arguments[0].click()", textArea);
            await textArea.sendKeys(Key.chord(Key.ALT, Key.UP));
            await driver.sleep(150);
            const activeElement = await driver.switchTo().activeElement();

            return (await activeElement.getAttribute("class")).includes("tabulator-cell") &&
                (await activeElement.getAttribute("tabulator-field")).includes("0");
        }, constants.wait1second * 10, `Could not start the focus on result grid`);
    };

    /**
     * Maximizes the result grid
     * @returns A promise resolving when the result is maximized
     */
    public maximize = async (): Promise<void> => {
        await this.resultContext.findElement(toolbarLocator.maximize).click();
        await driver.wait(this.untilIsMaximized(), constants.wait1second * 5);
    };

    /**
     * Selects a view
     * @param name The view name
     * @returns A promise resolving when the view is selected
     */
    public selectView = async (name: string): Promise<void> => {
        const view = await this.resultContext.findElement(toolbarLocator.view.exists);
        await view.click();
        await driver.wait(until.elementLocated(toolbarLocator.view.isVisible), constants.wait1second * 5,
            "Could not find the result grid view drop down list");

        if (name === constants.gridView) {
            await driver.findElement(toolbarLocator.view.grid).click();
        } else if (name === constants.previewView) {
            await driver.findElement(toolbarLocator.view.preview).click();
        } else {
            throw new Error(`Could not find the view with name ${name}`);
        }
    };

    /**
     * Gets the SQL Preview generated for a string
     * @returns A promise resolving with the sql preview
     */
    public selectSqlPreview = async (): Promise<void> => {
        await this.resultContext.findElement(toolbarLocator.previewButton).click();
    };

    /**
     * Clicks on the Apply Changes button of a result grid
     * @returns A promise resolving when the button is clicked
     */
    public applyChanges = async (): Promise<void> => {
        await driver.executeScript("arguments[0].click()",
            await this.resultContext.findElement(toolbarLocator.applyButton));
    };

    /**
     * Clicks on the Rollback Changes button of a result grid
     * @returns A promise resolving when the button is clicked
     */
    public rollbackChanges = async (): Promise<void> => {
        await this.resultContext.findElement(toolbarLocator.rollbackButton).click();
        const dialog = await new ConfirmDialog().untilExists();
        await dialog.accept();
    };

    /**
     * Closes the current result set
     * @returns A promise resolving when the result set is closed
     */
    public closeResultSet = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                await driver.wait(async () => {
                    return (await this.resultContext
                        .findElements(toolbarLocator.showActionMenu.open)).length > 0;
                }, constants.wait1second * 5, "Could not find Show Actions button");

                const showActions = await this.resultContext
                    .findElement(toolbarLocator.showActionMenu.open);
                await driver.executeScript("arguments[0].click()", showActions);

                await driver.wait(async () => {
                    return (await driver.findElements(toolbarLocator.showActionMenu.exists))
                        .length > 0;
                }, constants.wait1second * 5, "Action menu was not displayed");

                const menu = await driver.findElement(toolbarLocator.showActionMenu.exists);
                await menu.findElement(toolbarLocator.showActionMenu.closeResultSet).click();

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait1second * 10, "Show actions button was not interactable");

        this.id--;
    };

    /**
     * Selects a result grid tab
     * @param tabName The tab name to select
     */
    public selectTab = async (tabName: string): Promise<void> => {
        if (this.tabs.length > 0) {
            await this.tabs.find((item: interfaces.ICommandResultTab) => {
                return item.name === tabName;
            }).element.click();
        } else {
            throw new Error(`The result grid does not have tabs to select`);
        }

        const result = await new E2ECodeEditor().getResult(this.command, this.id);
        this.resultContext = result;
        await this.setColumnsMap();
    };

    /**
     * Gets a cell of a result grid
     * @param gridRow The row number. If the row number is -1, the function returns the last added row
     * @param gridColumn The column
     * @returns A promise resolving with the cell
     */
    private getCell = async (gridRow: number, gridColumn: string): Promise<WebElement> => {
        let cells: WebElement[];
        let cellToReturn: WebElement | undefined;

        await driver.wait(async () => {
            try {
                if (gridRow === -1) {
                    const addedTableRows = await this.resultContext
                        .findElements(gridLocator.newAddedRow);
                    cells = await addedTableRows[addedTableRows.length - 1]
                        .findElements(gridLocator.row.cell.exists);
                } else {
                    const rows = await this.resultContext.findElements(gridLocator.row.exists);

                    if (rows.length > 0) {

                        cells = await rows[gridRow].findElements(gridLocator.row.cell.exists);
                    } else {
                        return false;
                    }
                }

                cellToReturn = cells[parseInt(this.columnsMap.get(gridColumn), 10)];

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait1second * 10, `Could not get cell for row: ${gridRow}; column ${gridColumn}`);

        return cellToReturn;
    };

    /**
     * Verifies if a new row exists
     * @returns A condition resolving to true if a row was added, false otherwise
     */
    private untilNewRowExists = (): Condition<boolean> => {
        return new Condition(`for added table row`, async () => {
            return (await this.resultContext.findElements(gridLocator.newAddedRow)).length > 0;
        });
    };

    /**
     * Clicks the add new row button in a result grid, by moving the mouse to the table headers to display the button
     * @returns A promise resolving when the button is clicked
     */
    private clickAddNewRowButton = async (): Promise<void> => {
        const resultLocator = locator.notebook.codeEditor.editor.result;
        await driver.wait(async () => {
            const tableHeader = await this.resultContext.findElement(gridLocator.headers);
            await driver.actions().move({ origin: tableHeader }).perform();

            return (await this.resultContext
                .findElements(resultLocator.toolbar.addNewRowButton))
                .length > 0;
        }, constants.wait1second * 5, "Add new button was not displayed");

        await driver.executeScript("arguments[0].click()",
            await (this.resultContext).findElement(resultLocator.toolbar.addNewRowButton));
    };

    /**
     * Sets a boolean value on a cell
     * @param rowNumber The row number
     * @param columnName The column name
     * @param value The value
     * @returns A promise resolving when the value is set
     */
    private setCellBooleanValue = async (rowNumber: number,
        columnName: string, value: boolean): Promise<void> => {
        const cell = await this.getCell(rowNumber, columnName);
        const selectList = cell.findElement(gridLocator.row.cell.selectList.exists);
        await selectList.click();
        await driver.wait(async () => {
            return (await driver
                .findElements(gridLocator.row.cell.selectList.exists))
                .length > 0;
        }, constants.wait1second * 2, "List was not displayed");
        const list = await driver
            .findElement(gridLocator.row.cell.selectList.list.exists);
        const items = await list
            .findElements(gridLocator.row.cell.selectList.list.item);

        let item = await Promise.all(items.map(async (item: WebElement) => {
            if ((await item.getText()) === value.toString()) {
                return item;
            }
        }));

        item = item.filter((el) => { return el !== undefined; });

        if (item.length > 0) {
            await item[0].click();
        } else {
            throw new Error(`Could not find '${value}' on the select list`);
        }
    };

    /**
     * Clears an input field
     * @param el The element
     * @returns A promise resolving when the field is cleared
     */
    private clearCellInputField = async (el: WebElement): Promise<void> => {
        await driver.executeScript("arguments[0].click()", el);
        if (Os.isMacOs()) {
            await el.sendKeys(Key.chord(Key.COMMAND, "a"));
        } else {
            await el.sendKeys(Key.chord(Key.CONTROL, "a"));
        }
        await el.sendKeys(Key.BACK_SPACE);
    };

    /**
     * Focus a cell, by pressing the keyboard TAB key
     * @param rowNumber The row number
     * @param columnName The column name
     * @returns A promise resolving when the field is cleared
     */
    private focusCell = async (rowNumber: number, columnName: string): Promise<void> => {

        const isCellFocused = async (row: number, column: string): Promise<boolean> => {
            const refCell = await this.getCell(row, column);
            const focusedCell = await driver.switchTo().activeElement();

            if ((await focusedCell.getAttribute("class")).includes("tabulator-cell")) {
                return (await refCell.getAttribute("tabulator-field")) ===
                    (await focusedCell.getAttribute("tabulator-field"));
            } else {
                await driver.executeScript(
                    "arguments[0].click();",
                    await driver.findElement(locator.notebook.codeEditor.editor.currentLine));
                await this.startFocus();
            }
        };

        const maxTries = 5;
        let tryNbr = 0;

        while (!(await isCellFocused(rowNumber, columnName)) && tryNbr <= maxTries) {
            if (Os.isWindows()) {
                await driver.actions().keyDown(Key.TAB).keyUp(Key.TAB).perform();
            } else {
                await keyboard.type(nutKey.Tab);
            }
            tryNbr++;
        }

        if (!(await isCellFocused(rowNumber, columnName))) {
            throw new Error(`Could not focus on cell ${columnName} on row ${rowNumber}`);
        }
    };

    /**
     * Checks if a cell is being edited
     * @param rowNumber The row number
     * @param columnName The column name
     * @returns A promise revolving to true if the cell is being edited, false otherwise
     */
    private isEditing = async (rowNumber: number, columnName: string): Promise<boolean> => {
        const cell = await this.getCell(rowNumber, columnName);

        return (await cell.getAttribute("class")).includes("tabulator-editing");
    };

    /**
     * Checks if a cell is being edited
     * @param rowNumber The row number
     * @param columnName The column name
     * @returns A condition revolving to true if the cell is being edited, false otherwise
     */
    private untilIsEditing = (rowNumber: number, columnName: string): Condition<boolean> => {
        return new Condition(`for cell on row ${rowNumber} and column '${columnName}' to be editing`, async () => {
            return this.isEditing(rowNumber, columnName);
        });
    };

    /**
     * Starts to edit a cell.
     * @param rowNumber The row number
     * @param columnName The column name
     * @param method The method to edit the cells (double-click, keyboard, button)
     * @returns The table name
     */
    private startEditCell = async (rowNumber: number, columnName: string, method: string): Promise<void> => {
        const doubleClickEvent = "arguments[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));";

        await driver.wait(async () => {
            const cell = await this.getCell(rowNumber, columnName);
            try {
                if (await this.isEditing(rowNumber, columnName)) {
                    return true;
                } else {
                    switch (method) {

                        case constants.doubleClick: {
                            await driver.executeScript(doubleClickEvent, cell);
                            break;
                        }

                        case constants.pressEnter: {
                            await this.focusCell(rowNumber, columnName);

                            if (Os.isWindows()) {
                                await driver.actions().keyDown(Key.ENTER).keyUp(Key.ENTER).perform();
                            } else {
                                await keyboard.type(nutKey.Enter);
                            }
                            break;
                        }

                        default: {
                            break;
                        }
                    }

                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError) &&
                    !(e instanceof error.ElementNotInteractableError)) {
                    throw e;
                }
            }
        }, constants.wait1second * 10, `Could not start editing cell on column ${columnName}`);
    };

    /**
     * Formats a date from a cell
     * @param value The date
     * @param quoted True to return the date quoted, false otherwise
     * @returns The formatted date
     */
    private formatCellDate = (value: string, quoted: boolean): string => {
        const dateItems = value.split("/");
        if (Os.isMacOs()) {
            if (quoted) {
                return `'${dateItems[2]}-${dateItems[1]}-${dateItems[0]}'`;
            } else {
                return `${dateItems[2]}-${dateItems[1]}-${dateItems[0]}`;
            }
        }

        if (quoted) {
            return `'${dateItems[2]}-${dateItems[0]}-${dateItems[1]}'`;
        } else {
            return `${dateItems[2]}-${dateItems[0]}-${dateItems[1]}`;
        }
    };

}
