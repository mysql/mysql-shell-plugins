/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import { until, WebElement, error } from "selenium-webdriver";
import * as locator from "./locators.js";
import * as constants from "./constants.js";
import { driver } from "./driver.js";
import * as interfaces from "./interfaces.js";
import { DatabaseConnectionDialog } from "./databaseConnectionDialog.js";

export class DatabaseConnectionOverview {

    /**
     * Creates a new database connection, from the DB Editor main page.
     * It verifies that the Connection dialog is closed, at the end.
     * @param dbConfig Database Config object
     * @returns Promise resolving with the connection created
     */
    public static createDataBaseConnection = async (dbConfig: interfaces.IDBConnection): Promise<void> => {
        const ctx = await driver.wait(until.elementLocated(locator.dbConnectionOverview.browser),
            constants.wait5seconds, "DB Connection Overview page was not loaded");

        await driver.wait(async () => {
            const isDialogVisible = (await driver.findElements(locator.dbConnectionDialog.exists))
                .length > 0;

            if (isDialogVisible) {
                return true;
            } else {
                try {
                    await ctx.findElement(locator.dbConnectionOverview.newDBConnection).click();
                } catch (e) {
                    if (!(e instanceof error.ElementClickInterceptedError)) {
                        throw e;
                    }
                }

                return false;
            }
        }, constants.wait5seconds, "Connection dialog was not displayed");
        await DatabaseConnectionDialog.setConnection(dbConfig);
    };

    /**
     * Verifies if the Connection Overview tab is selected/opened, on the DB Editor
     * @returns Promise resolving to true if it's opened, false otherwise
     */
    public static isOpened = async (): Promise<boolean> => {
        const connections = await driver.findElement(locator.dbConnectionOverview.tab);
        const classes = await connections.getAttribute("class");

        return classes.includes("selected");
    };

    /**
     * Returns the current selected connection tab, on the DB Editor
     * @returns Promise resolving with the Connection tab name
     */
    public static getSelectedTab = async (): Promise<string> => {
        const tab = await driver.wait(until.elementLocated(locator.notebook.connectionTab.opened),
            constants.wait5seconds, "Selected tab was not found");

        const label = await tab.findElement(locator.htmlTag.label);

        return label.getText();
    };

    /**
     * Gets a Database connection from the DB Connection Overview
     * @param name The database connection caption
     * @returns A promise resolving with the connection
     */
    public static getConnection = async (name: string): Promise<WebElement | undefined> => {
        const db = await driver.wait(async () => {
            const hosts = await driver.findElements(locator.dbConnectionOverview.dbConnection.tile);
            for (const host of hosts) {
                try {
                    const el = await (await host
                        .findElement(locator.dbConnectionOverview.dbConnection.caption)).getText();

                    if (el.match(new RegExp(name)) !== null) {
                        return host;
                    }
                } catch (e) {
                    return undefined;
                }
            }

            return undefined;
        }, constants.wait5seconds, `The connection ${name} was not found on the Connection Browser`);

        return db;
    };

    /**
     * Clicks on a database connection edit button
     * @param dbConnection The database connection caption
     * @param option The option to click
     * @returns A promise resolving with the connection details
     */
    public static moreActions = async (dbConnection: string, option: string): Promise<void> => {
        const connection = await DatabaseConnectionOverview.getConnection(dbConnection);
        const moreActions = await connection!.findElement(locator.dbConnectionOverview.dbConnection.moreActions);
        await driver.actions().move({ origin: moreActions }).perform();
        await driver.executeScript("arguments[0].click()", moreActions);
        await driver.wait(until.elementLocated(locator.dbConnectionOverview.dbConnection.moreActionsMenu.exists),
            constants.wait5seconds, "More actions menu was not displayed");
        switch (option) {

            case constants.editConnection: {
                await driver.findElement(locator.dbConnectionOverview.dbConnection.moreActionsMenu.editConnection)
                    .click();
                break;
            }

            case constants.dupConnection: {
                await driver.findElement(locator.dbConnectionOverview.dbConnection.moreActionsMenu.duplicateConnection)
                    .click();
                break;
            }

            case constants.removeConnection: {
                await driver.findElement(locator.dbConnectionOverview.dbConnection.moreActionsMenu.removeConnection)
                    .click();
                break;
            }

            default: {
                break;
            }
        }
    };

    /**
     * Verifies if a Database connection exists on the DB Connection Overview
     * @param dbConnection The database connection caption
     * @returns A promise resolving with the connection
     */
    public static existsConnection = async (dbConnection: string): Promise<boolean> => {
        let found = false;

        await driver.wait(async () => {
            try {
                const hosts = await driver.findElements(locator.dbConnectionOverview.dbConnection.tile);

                for (const host of hosts) {
                    const hostCation = await host.findElement(locator.dbConnectionOverview.dbConnection.caption);
                    const textCaption = await hostCation.getText();

                    if (textCaption.match(new RegExp(dbConnection)) !== null) {
                        found = true;

                        break;
                    }
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "The connections were always stale");

        return found;
    };

}
