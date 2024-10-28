/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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
import { WebElement, until, Condition, error } from "selenium-webdriver";
import { driver } from "./driver.js";
import * as constants from "./constants.js";
import * as locator from "./locators.js";
import { E2EToolbar } from "./E2EToolbar.js";

/**
 * This class represents the database connection overview page, and all its related functions
 */
export class E2EDatabaseConnectionOverview {

    /** The toolbar*/
    public toolbar = new E2EToolbar();

    /**
     * Verifies if the Connection Overview page is opened
     * @returns A condition resolving to true if the page exists, false otherwise
     */
    public untilExists = (): Condition<boolean> => {
        return new Condition("for the Connection Overview page to be opened", async () => {
            return (await driver.findElements(locator.dbConnectionOverview.exists)).length > 0;
        });
    };

    /**
     * Gets a Database connection from the DB Connection Overview
     * @param name The database connection caption
     * @returns A promise resolving with the connection
     */
    public getConnection = async (name: string): Promise<WebElement> => {
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

        return db!;
    };

    /**
     * Clicks on a database connection more actions button
     * @param dbConnection The database connection caption
     * @param option The option to click
     */
    public moreActions = async (dbConnection: string, option: string): Promise<void> => {
        const connection = await this.getConnection(dbConnection);
        const moreActions = await connection.findElement(locator.dbConnectionOverview.dbConnection.moreActions);
        await driver.actions().move({ origin: moreActions }).perform();
        await driver.executeScript("arguments[0].click()", moreActions);
        const menu = await driver
            .wait(until.elementLocated(locator.dbConnectionOverview.dbConnection.moreActionsMenu.exists),
                constants.wait5seconds, "More actions menu was not displayed");

        const menuItems = await menu.findElements(locator.dbConnectionOverview.dbConnection.moreActionsMenu.item);

        for (const item of menuItems) {
            const label = await item.getText();

            if (label.includes(option)) {
                await item.click();
                break;
            }
        }
    };

    /**
     * Verifies if a Database connection exists on the DB Connection Overview
     * @param dbConnection The database connection caption
     * @returns A promise resolving with the connection
     */
    public existsConnection = async (dbConnection: string): Promise<boolean> => {
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

    /**
     * Verifies if a Database connection exists on the DB Connection Overview
     * @param dbConnection The database connection caption
     * @returns A condition resolving to true if the connection exists, false otherwise
     */
    public untilConnectionExists = (dbConnection: string): Condition<boolean> => {
        return new Condition(`for ${dbConnection} to exist`, async () => {
            return this.existsConnection(dbConnection);
        });
    };

    /**
     * Opens a new Shell Console
     */
    public openNewShellConsole = async (): Promise<void> => {
        await (await driver.wait(until.elementLocated(locator.dbConnectionOverview.newConsoleButton),
            constants.wait3seconds,
            "Could not find the button to open a new shell console")).click();
    };

}
