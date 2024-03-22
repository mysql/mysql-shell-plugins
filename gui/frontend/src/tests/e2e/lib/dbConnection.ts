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
import * as locator from "../lib/locators.js";
import * as interfaces from "../lib/interfaces.js";
import * as constants from "../lib/constants.js";
import { driver } from "../lib/driver.js";
import { Os } from "../lib/os.js";

export class DBConnection {

    /**
     * Verifies if the Connection Overview tab is selected/opened, on the DB Editor
     * @returns Promise resolving to true if it's opened, false otherwise
     */
    public static isConnectionOverviewOpened = async (): Promise<boolean> => {
        const connections = await driver.findElement(locator.dbConnections.tab);
        const classes = await connections.getAttribute("class");

        return classes.includes("selected");
    };

    /**
     * Closes the current opened connection tab, or an existing connection tab
     * Throws an exception if the existing connection tab is not found
     * @param name Connection tab name
     * @returns Promise resolving when the connection is closed
     */
    public static closeDBconnection = async (name: string): Promise<void> => {
        if (name === "current") {
            const tab = await driver.findElement(locator.notebook.connectionTab.opened);
            await tab.findElement(locator.notebook.connectionTab.close).click();
        } else {
            const tabs = await driver.findElements(locator.notebook.connectionTab.exists);
            for (const tab of tabs) {
                const text = await tab.findElement(locator.htmlTag.label).getAttribute("innerHTML");
                if (text.trim() === name) {
                    await tab.findElement(locator.notebook.connectionTab.close).click();

                    return;
                }
            }
            throw new Error(`Could not find connection tab with name '${name}'`);
        }
    };

    /**
     * Returns the current selected connection tab, on the DB Editor
     * @returns Promise resolving with the Connection tab name
     */
    public static getSelectedConnectionTab = async (): Promise<string> => {
        const tab = await driver.wait(until.elementLocated(locator.notebook.connectionTab.opened),
            constants.wait5seconds, "Selected tab was not found");

        const label = await tab.findElement(locator.htmlTag.label);

        return label.getText();
    };

    /**
     * Returns an object/item within the schema section on the DB Editor
     * @param objType Schema/Tables/Views/Routines/Events/Triggers/Foreign Keys/Indexes
     * @param objName Name of the object
     * @returns Promise resolving with the object
     */
    public static getSchemaObject = async (
        objType: string,
        objName: string): Promise<WebElement | undefined> => {
        const scroll = await driver.wait(until.elementLocated(locator.notebook.explorerHost.schemas.scroll),
            constants.wait5seconds, "Table scroll was not found");

        await driver.executeScript("arguments[0].scrollBy(0,-1000)", scroll);

        const sectionHost = await driver.findElement(locator.notebook.explorerHost.schemas.exists);
        let level: number;
        switch (objType) {
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
            3000,
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
                        if (await ref.getText() === objName) {
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
     * Toggles (expand or collapse) a schema object/item on the DB Editor
     * @param objType Schema/Tables/Views/Routines/Events/Triggers/Foreign Keys/Indexes
     * @param objName Name of the object
     * @returns Promise resolving with the object
     */
    public static toggleSchemaObject = async (objType: string, objName: string): Promise<void> => {
        const obj = await DBConnection.getSchemaObject(objType, objName);
        const toggle = await obj!.findElement(locator.notebook.explorerHost.schemas.treeToggle);
        await driver.executeScript("arguments[0].click()", toggle);
        await driver.sleep(1000);
    };

    /**
     * Adds a script on the DB Editor
     * @param scriptType JS/TS/SQL
     * @returns Promise resolving with the name of the created script
     */
    public static addScript = async (scriptType: string): Promise<string> => {
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
                    case "JS":
                        await menu.findElement(locator.notebook.explorerHost.scripts.contextMenu.addJSScript).click();
                        break;
                    case "TS":
                        await menu.findElement(locator.notebook.explorerHost.scripts.contextMenu.addTSScript).click();
                        break;
                    case "SQL":
                        await menu.findElement(locator.notebook.explorerHost.scripts.contextMenu.addSQLScript).click();
                        break;
                    default:
                        break;
                }
                await driver.wait(async () => {
                    return (await context.findElements(locator.notebook.explorerHost.scripts.script))
                        .length > items.length;
                }, 2000, "No script was created");
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
     * Checks if a script exists on the DB Editor
     * @param scriptName Script name
     * @param scriptType javascript/typescript/mysql
     * @returns Promise resolving with true if exists, false otherwise
     */
    public static existsScript = async (scriptName: string, scriptType: string):
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

    /**
     * Returns the opened editor
     * @param editor Editor name
     * @returns Promise resolving with the Editor
     */
    public static getOpenEditor = async (editor: string | RegExp): Promise<WebElement | undefined> => {
        const context = await driver.findElement(locator.notebook.explorerHost.openEditors.exists);
        const editors = await context.findElements(
            locator.notebook.explorerHost.openEditors.item,
        );
        for (const refEditor of editors) {
            if ((await refEditor.findElement(locator.htmlTag.label).getText()).match(editor) !== null) {
                return refEditor;
            }
        }
    };

    /**
     * Selects an editor from the drop down list on the DB Editor
     * @param editorName Editor name
     * @param editorType javascript/typescript/mysql
     * @returns Promise resolving when the select is made
     */
    public static selectCurrentEditor = async (editorName: string | RegExp, editorType: string):
        Promise<void> => {

        await driver.wait(async () => {
            try {
                const selector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
                await driver.executeScript("arguments[0].click()", selector);

                await driver.wait(async () => {
                    return (await driver.findElements(locator.notebook.toolbar.editorSelector.items)).length > 1;
                }, 2000, "No elements located on dropdown");

                const dropDownItems = await driver.findElements(locator.notebook.toolbar.editorSelector.items);

                for (const item of dropDownItems) {
                    const name = await item.findElement(locator.htmlTag.label).getText();
                    const el = await item.findElements(locator.htmlTag.img);

                    let type = "";

                    if (el.length > 0) {
                        type = await el[0].getAttribute("src");
                    } else {
                        type = await item.findElement(locator.notebook.toolbar.editorSelector.iconType)
                            .getAttribute("style");
                    }

                    if (name.match(editorName) !== null) {
                        if (type.indexOf(editorType) !== -1) {
                            await item.click();

                            return true;
                        }
                    }
                }
                throw new Error(`Could not find ${editorName} with type ${editorType}`);
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "The elements were always stale selecting the editor");
    };

    /**
     * Clicks on the DB Editor Context menu
     * @param item Context menu item name
     * @returns A promise resolving when the click is made
     */
    public static clickContextItem = async (item: string): Promise<void> => {

        const isCtxMenuDisplayed = async (): Promise<boolean> => {
            const el = await driver.executeScript(`return document.querySelector(".shadow-root-host").
                shadowRoot.querySelector("span[aria-label='${item}']")`);

            return el !== null;
        };

        await driver.wait(async () => {
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await driver.actions().contextClick(textArea).perform();

            return isCtxMenuDisplayed();

        }, constants.wait5seconds, "Context menu was not displayed");

        await driver.wait(async () => {
            try {
                const el: WebElement = await driver.executeScript(`return document.querySelector(".shadow-root-host").
                shadowRoot.querySelector("span[aria-label='${item}']")`);
                await el.click();

                return !(await isCtxMenuDisplayed());
            } catch (e) {
                if (e instanceof TypeError) {
                    return true;
                }
            }
        }, constants.wait5seconds, "Context menu is still displayed");
    };

    /**
     * Expand or Collapses a menu on the DB Editor
     * @param menu menu name (open editors/schemas/admin/scripts)
     * @param expand True to expand, false to collapse
     * @param retries number of retries to try to expand or collapse
     * @returns A promise resolving when the expand or collapse is made
     */
    public static expandCollapseMenus = async (menu: string, expand: boolean,
        retries: number): Promise<void> => {
        if (retries === 3) {
            throw new Error(`Max retries reached on expanding collapse '${menu}'`);
        }
        try {
            let elToClick;
            let elToVerify;

            switch (menu) {
                case "open editors":
                    elToClick = await driver
                        .findElement(locator.notebook.explorerHost.openEditors.exists)
                        .findElement(locator.notebook.explorerHost.openEditors.container)
                        .findElement(locator.htmlTag.label);
                    elToVerify = await driver.findElement(locator.notebook.explorerHost.openEditors.item);
                    break;
                case "schemas":
                    elToClick = await driver
                        .findElement(locator.notebook.explorerHost.schemas.exists)
                        .findElement(locator.notebook.explorerHost.schemas.container)
                        .findElement(locator.htmlTag.label);
                    elToVerify = await driver
                        .findElement(locator.notebook.explorerHost.schemas.exists)
                        .findElement(locator.notebook.explorerHost.schemas.table);
                    break;
                case "admin":
                    elToClick = await driver
                        .findElement(locator.notebook.explorerHost.administration.exists)
                        .findElement(locator.notebook.explorerHost.administration.container)
                        .findElement(locator.htmlTag.label);
                    elToVerify = await driver
                        .findElement(locator.notebook.explorerHost.administration.exists)
                        .findElement(locator.notebook.explorerHost.administration.item);
                    break;
                case "scripts":
                    elToClick = await driver
                        .findElement(locator.notebook.explorerHost.scripts.exists)
                        .findElement(locator.notebook.explorerHost.scripts.container)
                        .findElement(locator.htmlTag.label);
                    elToVerify = await driver
                        .findElement(locator.notebook.explorerHost.scripts.exists)
                        .findElements(locator.notebook.explorerHost.scripts.table);
                    if (elToVerify.length === 0) {
                        elToVerify = await driver
                            .findElement(locator.notebook.explorerHost.scripts.exists)
                            .findElement(locator.notebook.explorerHost.scripts.item);
                    } else {
                        elToVerify = elToVerify[0];
                    }
                    break;
                default:
                    break;
            }

            if (!expand) {
                if (await elToVerify?.isDisplayed()) {
                    await elToClick?.click();
                    await driver.wait(
                        until.elementIsNotVisible(elToVerify as WebElement),
                        3000,
                        "Element is still visible",
                    );
                }
            } else {
                if (!await elToVerify?.isDisplayed()) {
                    await elToClick?.click();
                    await driver.wait(
                        until.elementIsNotVisible(elToVerify as WebElement),
                        3000,
                        "Element is still visible",
                    );
                }
            }
        } catch (e) {
            await driver.sleep(1000);
            await DBConnection.expandCollapseMenus(menu, expand, retries + 1);
        }
    };

    /**
     * Scrolls down on the DB Editor
     * @returns A promise resolving when the scroll is made
     */
    public static promptScrollDown = async (): Promise<void> => {
        const el = await driver.findElement(locator.notebook.codeEditor.scroll);
        await driver.executeScript("arguments[0].scrollBy(0, 5000)", el);
    };

    /**
     * Verifies if a new prompt exists on the DB Editor
     * @returns A promise resolving with true if exists, false otherwise
     */
    public static hasNewPrompt = async (): Promise<boolean> => {
        let text: String;
        try {
            await DBConnection.promptScrollDown();
            const context = await driver.findElement(locator.notebook.codeEditor.editor.exists);
            const prompts = await context.findElements(locator.notebook.codeEditor.editor.editorPrompt);
            const lastPrompt = await prompts[prompts.length - 1]
                .findElement(locator.htmlTag.span)
                .findElement(locator.htmlTag.span);
            text = await lastPrompt.getText();
        } catch (e) {
            if (e instanceof Error) {
                if (String(e).indexOf("StaleElementReferenceError") === -1) {
                    throw new Error(String(e.stack));
                } else {
                    await driver.sleep(500);
                    const context = await driver.findElement(locator.notebook.codeEditor.editor.exists);
                    const prompts = await context
                        .findElements(locator.notebook.codeEditor.editor.editorPrompt);
                    const lastPrompt = await prompts[prompts.length - 1]
                        .findElement(locator.htmlTag.span)
                        .findElement(locator.htmlTag.span);
                    text = await lastPrompt.getText();
                }
            }
        }

        return String(text!).length === 0;
    };

    /**
     * Clicks on an item under the MySQL Administration section, on the DB Editor
     * @param item Item name
     * @returns A promise resolving when the click is made
     */
    public static clickAdminItem = async (item: string): Promise<void> => {
        const els = await driver.wait(until.elementsLocated(locator.notebook.explorerHost.administration.itemToClick),
            constants.wait5seconds, "Admin section not found");
        for (const el of els) {
            const label = await el.getText();
            if (label === item) {
                await el.click();

                return;
            }
        }
        throw new Error(`Could not find the item '${item}'`);
    };

    /**
     * Returns the current selected Editor, on the select list, on the DB Editor
     * @returns A promise resolving with the editor
     */
    public static getCurrentEditor = async (): Promise<string> => {
        const selector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
        const label = await selector.findElement(locator.htmlTag.label);

        return label.getText();
    };

    /**
     * Selects an Editor from the drop down list, on the DB Editor
     * @param editor The editor
     * @returns A promise resolving when the select is made
     */
    public static selectEditor = async (editor: string): Promise<void> => {
        const selector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
        await selector.click();
        const items = await driver.findElements(locator.notebook.toolbar.editorSelector.items);

        for (const item of items) {
            const label = await item.findElement(locator.htmlTag.label);
            const text = await label.getAttribute("innerHTML");
            if (text === editor) {
                await item.click();

                return;
            }
        }
        throw new Error(`Could not find ${editor}`);
    };

    /**
     * Sets the database credentials on the password dialog
     * @param data The credentials
     * @param timeout The max number of time the function should wait until the connection is successful
     * @returns A promise resolving when the credentials are set
     */
    public static setCredentials = async (data: interfaces.IDBConnection,
        timeout?: number): Promise<void> => {
        await DBConnection.setPassword(data);
        await DBConnection.setConfirm("no", timeout);
    };

    /**
     * Sets the database connection password
     * @param dbConfig The database configuration
     * @returns A promise resolving when the password is set
     */
    private static setPassword = async (dbConfig: interfaces.IDBConnection): Promise<void> => {
        const dialog = await driver.wait(until.elementLocated((locator.passwordDialog.exists)),
            constants.wait5seconds, "No password dialog was found");
        const passwordField = await dialog.findElement(locator.passwordDialog.password);
        await passwordField.sendKeys((dbConfig.basic as interfaces.IConnBasicMySQL).password as string);
        await dialog.findElement(locator.passwordDialog.ok).click();
    };

    /**
     * Sets the database connection confirm dialog
     * @param value The value. (Y, N, A)
     * @param timeoutDialog The time to wait for the confirm dialog
     * @returns A promise resolving when the password is set
     */
    private static setConfirm = async (value: string,
        timeoutDialog = constants.wait10seconds): Promise<void> => {

        if (await Os.existsCredentialHelper()) {
            const confirmDialog = await driver.wait(until.elementsLocated(locator.confirmDialog.exists),
                timeoutDialog, "No confirm dialog was found");

            const noBtn = await confirmDialog[0].findElement(locator.confirmDialog.refuse);
            const yesBtn = await confirmDialog[0].findElement(locator.confirmDialog.accept);
            const neverBtn = await confirmDialog[0].findElement(locator.confirmDialog.alternative);

            switch (value) {
                case "yes": {
                    await yesBtn.click();
                    break;
                }
                case "no": {
                    await noBtn.click();
                    break;
                }
                case "never": {
                    await neverBtn.click();
                    break;
                }
                default: {
                    break;
                }
            }
        } else {
            await driver.wait(until.elementLocated(locator.errorPanel.close),
                constants.wait2seconds)
                .then(async (el) => {
                    await el.click();
                })
                .catch(() => {
                    // continue, dialog was not found
                });
        }
    };
}
