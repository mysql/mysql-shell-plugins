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
import { WebElement, until, Condition, Key, error } from "vscode-extension-tester";
import { driver, Misc } from "../Misc";
import * as constants from "../constants";
import * as locator from "../locators";
import { E2EToolbar } from "./E2EToolbar";
import * as errors from "../errors";
import { Os } from "../Os";
import { E2EShellConsole } from "./E2EShellConsole";
import { IDBConnection } from "../interfaces";
import { DatabaseConnectionDialog } from "./Dialogs/DatabaseConnectionDialog";

/**
 * This class represents the database connection overview page, and all its related functions
 */
export class DatabaseConnectionOverview {

    /** The toolbar*/
    public toolbar = new E2EToolbar();

    /**
     * Adds a new connection
     * 
     * @param connection The DB Connection
     */
    public addNewConnection = async (connection: IDBConnection): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
        await DatabaseConnectionDialog.setConnection(connection);

    };

    /**
     * Gets a Database connection from the DB Connection Overview
     * 
     * @param name The database connection caption
     * @returns A promise resolving with the connection
     */
    public getConnection = async (name: string): Promise<WebElement> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

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
                    if (e instanceof Error) {
                        return undefined;
                    }
                }
            }

            return undefined;
        }, constants.wait1second * 5, `The connection ${name} was not found on the Connection Browser`);

        return db!;
    };

    /**
     * Clicks on a database connection edit button
     * 
     * @param dbConnection The database connection caption
     * @param option The option to click
     * @returns A promise resolving with the connection details
     */
    public moreActions = async (dbConnection: string, option: string): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const connection = await this.getConnection(dbConnection);
        const moreActions = await connection.findElement(locator.dbConnectionOverview.dbConnection.moreActions);
        await driver.actions().move({ origin: moreActions }).perform();
        await driver.executeScript("arguments[0].click()", moreActions);
        const menu = await driver
            .wait(until.elementLocated(locator.dbConnectionOverview.dbConnection.moreActionsMenu.exists),
                constants.wait1second * 5, "More actions menu was not displayed");

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
     * 
     * @param dbConnection The database connection caption
     * @returns A promise resolving with the connection
     */
    public existsConnection = async (dbConnection: string): Promise<boolean> => {
        let found = false;

        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

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
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait1second * 5, "The connections were always stale");

        return found;
    };

    /**
     * Verifies if a Database connection exists on the DB Connection Overview
     * 
     * @param dbConnection The database connection caption
     * @returns A condition resolving to true if the connection exists, false otherwise
     */
    public untilConnectionExists = (dbConnection: string): Condition<boolean> => {
        return new Condition(`for ${dbConnection} to exist`, async () => {
            return this.existsConnection(dbConnection);
        });
    };

    /**
     * Verifies if a Database connection does not exists on the DB Connection Overview
     * 
     * @param dbConnection The database connection caption
     * @returns A condition resolving to true if the connection does not exists, false otherwise
     */
    public untilConnectionDoesNotExist = (dbConnection: string): Condition<boolean> => {
        return new Condition(`for ${dbConnection} to not exist`, async () => {
            return !(await this.existsConnection(dbConnection));
        });
    };

    /**
     * Opens a new notebook with (CMD|ALT)+click
     * 
     * @param dbConnectionCaption The DB Connection caption
     */
    public openNotebookUsingKeyboard = async (dbConnectionCaption: string): Promise<void> => {

        const dbConnection = await this.getConnection(dbConnectionCaption);
        await driver.actions()
            .move({ origin: dbConnection })
            .keyDown(Os.isMacOs() ? Key.COMMAND : Key.ALT)
            .click()
            .keyUp(Os.isMacOs() ? Key.COMMAND : Key.ALT)
            .perform();

    };

    /**
     * Clicks on the "Open New Shell Session" button and waits for the shell session to be opened
     */
    public openNewShellSession = async (): Promise<void> => {
        await Misc.switchToFrame();
        await driver.wait(until.elementLocated(locator.dbConnectionOverview.newConsoleButton),
            constants.waitForWebElement).click();
        await driver.wait(new E2EShellConsole().untilIsOpened(), constants.waitShellOpen,
            "Shell Console was not loaded");
    };

    /**
     * Gets the breadcrumb item links
     * 
     * @returns A promise resolving with the breadcrumb items as an array of WebElements
     */
    public getBreadCrumbLinks = async (): Promise<WebElement[]> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const breadCrumb = await driver.findElement(locator.dbConnectionOverview.breadCrumb.exists);

        return breadCrumb.findElements(locator.dbConnectionOverview.breadCrumb.item);
    };

    /**
     * Gets the breadcrumb items as full path
     * 
     * @returns A promise resolving with the breadcrumb items as an array of WebElements
     */
    public getBreadCrumb = async (): Promise<string> => {
        let breadcrumb: string[];

        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        await driver.wait(async () => {
            try {
                const breadCrumb = await driver.findElement(locator.dbConnectionOverview.breadCrumb.exists);
                const items = await breadCrumb.findElements(locator.dbConnectionOverview.breadCrumb.item);

                breadcrumb = await Promise.all(items.map(async (item: WebElement) => {
                    return (await item.getText()).replace(/\s/g, "");
                }));

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait1second * 3, "Could not get the breadcrumb items");

        return breadcrumb!.join("");
    };

    /**
     * Verifies if a group exists on the DB Connection Overview
     * 
     * @param name The group name
     * @returns A promise resolving to true if the group exists, false otherwise
     */
    public existsGroup = async (name: string): Promise<boolean> => {
        let found = false;

        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        await driver.wait(async () => {
            try {
                const hosts = await driver.findElements(locator.dbConnectionOverview.group.tile);
                for (const host of hosts) {
                    const hostCation = await host.findElement(locator.dbConnectionOverview.group.caption);
                    const textCaption = await hostCation.getText();
                    if (textCaption.match(new RegExp(name)) !== null) {
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
        }, constants.wait1second * 5, "The groups were always stale");

        return found;
    };

    /**
     * Clicks on a group and waits until the breadcrumb has the group name, ensuring the user is inside the group
     * 
     * @param name The group caption
     * @returns A promise resolving with the group
     */
    public joinGroup = async (name: string): Promise<void> => {
        await driver.wait(async () => {
            const breadCrump = await this.getBreadCrumb();

            if (!breadCrump.includes(name)) {
                const group = await this.getGroup(name);
                await group.click();
            } else {
                return true;
            }

        });
    };

    /**
     * Verifies if a group exists on the DB Connection Overview
     * 
     * @param name The group name
     * @returns A condition resolving to true if the group exists, false otherwise
     */
    public untilGroupExists = (name: string): Condition<boolean> => {
        return new Condition(`for group ${name} to exist`, async () => {
            return this.existsGroup(name);
        });
    };

    /**
     * Gets a group from the DB Connection Overview
     * 
     * @param name The group caption
     * @returns A promise resolving with the group
     */
    public getGroup = async (name: string): Promise<WebElement> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const group = await driver.wait(async () => {
            const groups = await driver.findElements(locator.dbConnectionOverview.group.tile);

            for (const grp of groups) {
                try {
                    const el = await (await grp
                        .findElement(locator.dbConnectionOverview.group.caption)).getText();
                    if (el.match(new RegExp(name)) !== null) {
                        return grp;
                    }
                } catch (e) {
                    if (e instanceof Error) {
                        return undefined;
                    }
                }
            }

            return undefined;
        }, constants.wait1second * 5, `The connection ${name} was not found on the Connection Browser`);

        return group!;
    };

    /**
     * Verifies if the breadcrumb is equal to a value
     * 
     * @param value The breadcrumb value
     * @returns A condition resolving to true when the breadcrumb is equal to the value
     */
    public untilBreadCrumbIs = (value: string): Condition<boolean> => {
        return new Condition(`for breadcrumb to be '${value}'`, async () => {
            return (await this.getBreadCrumb()) === value;
        });
    };

}
