/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { WebElement, until, Key } from "selenium-webdriver";
import { driver } from "./driver.js";
import * as locator from "./locators.js";
import * as constants from "./constants.js";
import { Os } from "./os.js";

/** This class represents a Toast Notification and all its related functions */
export class Explorer {

    /**
     * Toggles a section
     * @param sectionName The section name
     * @param expand True to expand, false otherwise
     * @returns A promise resolving when the toggle is made
     */
    public toggleSection = async (sectionName: string, expand: boolean): Promise<void> => {

        const getSection = async (sectionName: string): Promise<WebElement | undefined> => {
            switch (sectionName) {
                case constants.openEditors: {
                    return driver
                        .findElement(locator.notebook.explorerHost.openEditors.exists)
                        .findElement(locator.notebook.explorerHost.openEditors.container);
                }

                case constants.schemas: {
                    return driver
                        .findElement(locator.notebook.explorerHost.schemas.exists)
                        .findElement(locator.notebook.explorerHost.schemas.container);
                }

                case constants.mysqlAdministration: {
                    return driver
                        .findElement(locator.notebook.explorerHost.administration.exists)
                        .findElement(locator.notebook.explorerHost.administration.container);
                }

                case constants.scripts: {
                    return driver
                        .findElement(locator.notebook.explorerHost.scripts.exists)
                        .findElement(locator.notebook.explorerHost.scripts.container);
                }

                default: {
                    break;
                }
            }
        };

        const isExpanded = async (section: string): Promise<boolean | undefined> => {
            return (await (await getSection(section))?.getAttribute("class"))?.includes("expanded");
        };

        if (expand && !(await isExpanded(sectionName))) {
            await driver.wait(async () => {
                const section = await getSection(sectionName);
                await section?.findElement(locator.htmlTag.label).click();
                await driver.sleep(500);

                return isExpanded(sectionName);
            }, constants.wait5seconds, `Section '${sectionName}' was not expanded`);
        }

        if (!expand && (await isExpanded(sectionName))) {
            await driver.wait(async () => {
                const section = await getSection(sectionName);
                await section?.findElement(locator.htmlTag.label).click();
                await driver.sleep(500);

                return !(await isExpanded(sectionName));
            }, constants.wait5seconds, `Section '${sectionName}' was not collapsed`);
        }

    };

    /**
     * Toggles (expand or collapse) a schema object/item on the explorer
     * @param name Name of the object
     * @param type Schema/Tables/Views/Routines/Events/Triggers/Foreign Keys/Indexes
     * @returns Promise resolving with the object
     */
    public toggleSchemasTreeObject = async (name: string, type: string): Promise<void> => {
        const obj = await this.getSchemasTreeElement(name, type);
        const toggle = await obj!.findElement(locator.notebook.explorerHost.schemas.treeToggle);
        await driver.executeScript("arguments[0].click()", toggle);
        await driver.sleep(1000);
    };

    /**
     * Gets an element from the Schemas tree
     * @param name The element name
     * @param type The element type (Schema, Tables, Views, Routines, Events, Triggers, Foreign keys, Indexes)
     * @returns A promise resolving with the element
     */
    public getSchemasTreeElement = async (name: string, type: string): Promise<WebElement | undefined> => {
        const scrollSection = await driver.wait(until.elementLocated(locator.notebook.explorerHost.schemas.scroll),
            constants.wait5seconds, "Table scroll was not found");

        await driver.executeScript("arguments[0].scrollBy(0,-1000)", scrollSection);

        const sectionHost = await driver.findElement(locator.notebook.explorerHost.schemas.exists);
        let level: number;
        switch (type) {
            case "Schema":
                level = 0;
                break;
            case "Tables":
            case "Views":
            case "Routines":
            case "Events":
            case "Triggers":
            case "Foreign keys":
            case "Indexes":
                level = 1;
                break;
            default:
                level = 2;
        }

        await driver.wait(
            async () => {
                try {
                    const objects = await sectionHost.findElements(
                        locator.notebook.explorerHost.schemas.objectByLevel(level),
                    );

                    return (
                        (await objects[0].findElement(locator.htmlTag.label).getText()) !==
                        "loading..."
                    );
                } catch (e) {
                    return true;
                }
            },
            constants.wait5seconds,
            "Still loading",
        );

        const findItem = async (scrollNumber: number): Promise<WebElement | undefined> => {

            if (scrollNumber <= 4) {
                const sectionHost = await driver.findElement(locator.notebook.explorerHost.schemas.exists);
                const objects = await sectionHost.findElements(
                    locator.notebook.explorerHost.schemas.objectByLevel(level),
                );
                let ref;
                try {

                    for (const object of objects) {
                        ref = object.findElement(locator.htmlTag.label);
                        await driver.executeScript("arguments[0].scrollIntoView(true);", ref);

                        if (await ref.getText() === name) {
                            return object;
                        }
                    }
                } catch (e) { null; }

                return findItem(scrollNumber + 1);
            } else {
                return undefined;
            }
        };

        const item: WebElement | undefined = await findItem(0);

        return item;
    };

    /**
     * Adds a new console on the Open Editors section
     * @param name The console name
     * @returns A promise resolving when the new console is created
     */
    public addNewConsole = async (name: string): Promise<void> => {
        await driver.executeScript(
            "arguments[0].click()",
            await driver.findElement(locator.notebook.explorerHost.openEditors.addConsole),
        );
        const input = await driver.wait(until.elementLocated(locator.notebook.explorerHost.openEditors.textBox),
            constants.wait5seconds, "Input box was not displayed for the console");

        if (Os.isMacOs()) {
            await input.sendKeys(Key.chord(Key.COMMAND, "a"));
        } else {
            await input.sendKeys(Key.chord(Key.CONTROL, "a"));
        }

        await input.sendKeys(Key.BACK_SPACE);
        await input.sendKeys(name);
        await input.sendKeys(Key.ENTER);
    };

    /**
     * Closes a console on the Open Editors section
     * @param name The console name
     * @returns A promise resolving when the console is closed
     */
    public closeConsole = async (name: string): Promise<void> => {
        const console = await this.getOpenEditor(name);
        await console!.findElement(locator.notebook.explorerHost.openEditors.close).click();
    };

    /**
     * Returns the opened editor
     * @param editor Editor name
     * @returns Promise resolving with the Editor
     */
    public getOpenEditor = async (editor: string | RegExp): Promise<WebElement | undefined> => {
        const context = await driver.findElement(locator.notebook.explorerHost.openEditors.exists);
        const editors = await context.findElements(
            locator.notebook.explorerHost.openEditors.item,
        );

        for (const refEditor of editors) {
            const label = await refEditor.findElement(locator.htmlTag.label).getText();

            if (label.match(editor) !== null) {
                return refEditor;
            }
        }
    };

    /**
     * Adds a script on the Explorer
     * @param scriptType JS/TS/SQL
     * @returns A promise resolving with the name of the created script
     */
    public addScript = async (scriptType: string): Promise<string> => {
        let toReturn = "";

        await driver.wait(async () => {
            try {
                const context = await driver.findElement(locator.notebook.explorerHost.scripts.exists);
                const items = await context.findElements(locator.notebook.explorerHost.scripts.script);
                await driver.executeScript(
                    "arguments[0].click()",
                    await context.findElement(locator.notebook.explorerHost.scripts.addScript),
                );
                const menu = await driver.findElement(locator.notebook.explorerHost.scripts.contextMenu.exists);

                switch (scriptType) {

                    case "JS": {
                        await menu.findElement(locator.notebook.explorerHost.scripts.contextMenu.addJSScript).click();
                        break;
                    }

                    case "TS": {
                        await menu.findElement(locator.notebook.explorerHost.scripts.contextMenu.addTSScript).click();
                        break;
                    }

                    case "SQL": {
                        await menu.findElement(locator.notebook.explorerHost.scripts.contextMenu.addSQLScript).click();
                        break;
                    }

                    default: {
                        break;
                    }

                }

                await driver.wait(async () => {
                    return (await context.findElements(locator.notebook.explorerHost.scripts.script))
                        .length > items.length;
                }, constants.wait5seconds, "No script was created");
                const entries = await context.findElements(locator.notebook.explorerHost.schemas.object);
                toReturn = await entries[entries.length - 1].getText();

                return true;
            } catch (e) {
                return false;
            }
        }, constants.wait10seconds, "No script was created");

        return toReturn;
    };

    /**
     * Gets an element from the MySQL Administration section
     * @param name The element name
     * @returns A promise resolving with the element
     */
    public getMySQLAdminElement = async (name: string): Promise<WebElement> => {
        const els = await driver.wait(until.elementsLocated(locator.notebook.explorerHost.administration.label),
            constants.wait5seconds, "Admin section not found");

        for (const el of els) {
            const label = await el.getText();

            if (label === name) {
                return el;
            }
        }
        throw new Error(`Could not find the item '${name}'`);

    };

    /**
     * Checks if a script exists on the DB Editor
     * @param scriptName Script name
     * @param scriptType javascript/typescript/mysql
     * @returns Promise resolving with true if exists, false otherwise
     */
    public existsScript = async (scriptName: string, scriptType: string):
        Promise<boolean> => {
        const context = await driver.findElement(locator.notebook.explorerHost.scripts.exists);
        const items = await context.findElements(locator.notebook.explorerHost.scripts.script);

        for (const item of items) {
            const label = await (await item.findElement(locator.notebook.explorerHost.scripts.object)).getText();
            const src = await (await item.findElement(locator.notebook.explorerHost.scripts.objectImage))
                .getAttribute("src");

            if (label === scriptName && src.indexOf(scriptType) !== -1) {
                return true;
            }
        }

        return false;
    };


}
