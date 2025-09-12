/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import { Condition, WebElement, until, error } from "selenium-webdriver";
import { driver } from "../../lib/driver.js";
import * as constants from "../constants.js";
import * as locator from "../locators.js";
import * as interfaces from "../interfaces.js";
import { ConfirmDialog } from "../Dialogs/ConfirmationDialog.js";

export class E2ELakehouseTables {

    /**
     * Verifies if the Upload To Object Storage tab is selected
     * 
     * @returns A promise resolving to true if the tab is selected, false otherwise
     */
    public isOpened = async (): Promise<boolean> => {
        const tab = await driver.findElement(locator.lakeHouseNavigator.lakeHouseTables.tab);

        return (await tab.getAttribute("class")).includes("selected");
    };

    /**
     * Verifies if the Lakehouse Tables tab is selected
     * 
     * @returns A condition resolving to true if the tab is selected, false otherwise
     */
    public untilIsOpened = (): Condition<boolean> => {
        return new Condition(` for Lakehouse Tables tab to be opened`, async () => {
            return this.isOpened();
        });
    };

    /**
     * Gets the database schemas
     * 
     * @returns A promise resolving with the database schemas
     */
    public getDatabaseSchemas = async (): Promise<string[]> => {
        const refLocator = locator.lakeHouseNavigator.lakeHouseTables.databaseSchemas.item;
        const schemas = await driver.wait(until
            .elementsLocated(refLocator), constants.wait5seconds, "Could not find any database schemas");

        return Promise.all(
            schemas.map(async (item: WebElement) => {
                return item.getText();
            }));
    };

    /**
     * Verifies if there are lakehouse tables
     * 
     * @param name The lake house table name
     * @returns A condition resolving to true if exists lakehouse tables, false otherwise
     */
    public untilLakehouseTableDoesNotExist = (name: string): Condition<boolean> => {
        return new Condition(`for lakehouse table '${name}' to not exist`, async () => {
            return (await this.getLakehouseTable(name)) === undefined;
        });
    };

    /**
     * Gets the lakehouse tables
     * 
     * @returns A promise resolving with the database schemas
     */
    public getLakehouseTables = async (): Promise<interfaces.ILakeHouseTable[]> => {
        let toReturn: interfaces.ILakeHouseTable[];

        await driver.wait(async () => {
            try {
                const lakeHouseTablesLocator = locator.lakeHouseNavigator.lakeHouseTables.lakeHouseTables;
                const tableRows = await driver.findElements(lakeHouseTablesLocator.row);

                toReturn = await Promise.all(
                    tableRows.map(async (cell: WebElement) => {
                        return {
                            tableName: await cell.findElement(lakeHouseTablesLocator.cell.tableName.label).getText(),
                            hasProgressBar: (await cell.findElements(lakeHouseTablesLocator.cell.tableName.progressBar))
                                .length > 0,
                            loaded: await cell.findElement(lakeHouseTablesLocator.cell.loaded.label).getText(),
                            hasLoadingSpinner: (await cell
                                .findElements(lakeHouseTablesLocator.cell.loaded.loadingSpinner)).length > 0,
                            rows: await cell.findElement(lakeHouseTablesLocator.cell.rows).getText(),
                            size: await cell.findElement(lakeHouseTablesLocator.cell.size).getText(),
                            date: await cell.findElement(lakeHouseTablesLocator.cell.date).getText(),
                            comment: await cell.findElement(lakeHouseTablesLocator.cell.comment).getText(),
                        };
                    }));

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Could not get the Lakehouse tables");

        return toReturn!;
    };

    /**
     * Clicks on the refresh button of the Lakehouse tables
     * 
     * @returns A promise resolving when the button is clicked
     */
    public refreshLakehouseTables = async (): Promise<void> => {
        await driver.findElement(locator.lakeHouseNavigator.lakeHouseTables.lakeHouseTables.refresh).click();
    };

    /**
     * Gets a lakehouse table row
     * 
     * @param tableLabel The table label
     * @returns A promise resolving with the table row
     */
    public getLakehouseTableElement = async (tableLabel: string): Promise<WebElement> => {
        const lakeHouseTablesLocator = locator.lakeHouseNavigator.lakeHouseTables.lakeHouseTables;
        let table: WebElement;
        await driver.wait(async () => {
            await this.refreshLakehouseTables();
            const tableRows = await driver.findElements(lakeHouseTablesLocator.row);

            for (const row of tableRows) {
                const label = await row.findElement(lakeHouseTablesLocator.cell.tableName.label);
                const textLabel = await label.getText();

                if (tableLabel === textLabel) {
                    table = row;

                    return true;
                }
            }

        }, constants.wait10seconds, `Could not find '${tableLabel}' on Lakehouse tables`);

        return table!;
    };

    /**
     * Gets a lakehouse table
     * 
     * @param tableLabel The table label
     * @returns A promise resolving with the table
     */
    public getLakehouseTable = async (tableLabel: string): Promise<interfaces.ILakeHouseTable | undefined> => {
        const tables = await this.getLakehouseTables();

        return tables.find((item: interfaces.ILakeHouseTable) => {
            return item.tableName === tableLabel;
        });
    };

    /**
     * Gets the current tasks
     * 
     * @returns A promise resolving with the task
     */
    public getLakeHouseTasks = async (): Promise<interfaces.ICurrentTask[]> => {
        let toReturn: interfaces.ICurrentTask[];

        await driver.wait(async () => {
            try {
                const taskListLocator = locator.lakeHouseNavigator.lakeHouseTables.currentTaskList;
                const grid = await driver.findElement(taskListLocator.exists);
                const taskRows = await grid
                    .findElements(taskListLocator.row);

                toReturn = await Promise.all(
                    taskRows.map(async (cell: WebElement) => {
                        return {
                            name: await cell.findElement(taskListLocator.cell.task.label).getText(),
                            hasProgressBar: (await cell.findElements(taskListLocator.cell.task.progressBar)).length > 0,
                            status: await cell.findElement(taskListLocator.cell.status).getText(),
                            startTime: await cell.findElement(taskListLocator.cell.startTime).getText(),
                            endTime: await cell.findElement(taskListLocator.cell.endTime).getText(),
                            message: await cell.findElement(taskListLocator.cell.message).getText(),
                        };
                    }));

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Could not get the Lakehouse tasks");

        return toReturn!;
    };

    /**
     * Verifies if all tasks matching the task name are completed
     * 
     * @param task The task name
     * @returns A promise resolving with true, if the tasks are completed, false otherwise
     */
    public untilTaskIsCompleted = (task: string): Condition<boolean | undefined> => {
        return new Condition(` for all tasks with name '${task}' to be completed`, async () => {
            const tasks = await this.getLakeHouseTasks();
            if (tasks.length > 0) {
                for (const task of tasks) {
                    if (task.name === `Loading ${task}` && task.status === `RUNNING`) {
                        return false;
                    }
                }
                console.log(tasks);
                console.log("Should be completed");

                return true;
            }
        });
    };

    /**
     * Verifies if the lakehouse table exists
     * 
     * @param tableLabel The table label
     * @returns A promise resolving with true, if the table is loading, false otherwise
     */
    public untilExistsLakeHouseTable = (tableLabel: string): Condition<boolean> => {
        return new Condition(` for lakehouse table '${tableLabel}' to be loading`, async () => {
            return (await this.getLakehouseTable(tableLabel)) !== undefined;
        });
    };

    /**
     * Verifies if the lakehouse row is loading
     * 
     * @param tableLabel The table label
     * @returns A promise resolving with true, if the table is loading, false otherwise
     */
    public untilLakeHouseTableIsLoading = (tableLabel: string): Condition<boolean | undefined> => {
        return new Condition(` for lakehouse table '${tableLabel}' to be loading`, async () => {
            const tableRows = await driver.wait(async () => {
                const rows = await this.getLakehouseTables();
                if (rows.length > 0) {
                    return rows;
                }
            }, constants.wait5seconds, "Could not find any lake house table");

            const wantedTable = tableRows!.find((item) => {
                return item.tableName === tableLabel;
            });

            return wantedTable!.hasProgressBar && wantedTable!.hasLoadingSpinner;
        });
    };

    /**
     * Verifies if the lakehouse row is loaded
     * 
     * @param tableLabel The table label
     * @returns A promise resolving with true, if the table is loaded, false otherwise
     */
    public untilLakeHouseTableIsLoaded = (tableLabel: string): Condition<boolean> => {
        return new Condition(` for lakehouse table '${tableLabel}' to be loading`, async () => {
            const tableRows = await driver.wait(async () => {
                const rows = await this.getLakehouseTables();
                if (rows.length > 0) {
                    return rows;
                }
            }, constants.wait5seconds, "Could not find any lake house table");

            const wantedTable = tableRows!.find((item) => {
                return item.tableName === tableLabel;
            });

            return wantedTable!.loaded === "Yes";
        });
    };

    /**
     * Deletes a lakehouse table and verifies its deletion
     * 
     * @param tableLabel The table name
     * @returns A promise resolving with true, if the task is completed, false otherwise
     */
    public deleteLakeHouseTable = async (tableLabel: string): Promise<void> => {
        const wantedTable = await this.getLakehouseTableElement(tableLabel);
        await driver.executeScript("arguments[0].click()", wantedTable);
        await driver.findElement(locator.lakeHouseNavigator.lakeHouseTables.deleteTableBtn).click();
        const dialog = await new ConfirmDialog().untilExists();
        await dialog.accept();
        await this.refreshLakehouseTables();
        await driver.wait(this.untilLakehouseTableDoesNotExist(tableLabel), constants.wait5seconds,
            `The lake house table '${tableLabel}' was not deleted`);
    };

}
