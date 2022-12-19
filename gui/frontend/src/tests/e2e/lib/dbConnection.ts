/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { By, until, WebElement, error } from "selenium-webdriver";
import { driver, explicitWait, Misc } from "./misc";

export class DBConnection {

    /**
     * Verifies if the Connection Overview tab is selected/opened, on the DB Editor
     *
     * @returns Promise resolving to true if it's opened, false otherwise
     */
    public static isConnectionOverviewOpened = async (): Promise<boolean> => {
        const connections = await driver.findElement(By.id("connections"));
        const classes = await connections.getAttribute("class");

        return classes.includes("selected");
    };

    /**
     * Closes the current opened connection tab, or an existing connection tab
     * Throws an exception if the existing connection tab is not found
     *
     * @param name Connection tab name
     * @returns Promise resolving when the connection is closed
     */
    public static closeDBconnection = async (name: string): Promise<void> => {
        if (name === "current") {
            const tab = await driver.findElement(By.css(".hasAuxillary.selected"));
            await tab.findElement(By.css("#auxillary > button")).click();
        } else {
            const tabs = await driver.findElements(By.css(".hasAuxillary"));
            for (const tab of tabs) {
                const text = await tab.findElement(By.css("label")).getAttribute("innerHTML");
                if (text.trim() === name) {
                    await tab.findElement(By.css("#auxillary > button")).click();

                    return;
                }
            }
            throw new Error(`Could not find connection tab with name '${name}'`);
        }
    };

    /**
     * Returns the toolbar button on the DB Editor.
     * Throws an exception if the button is not found.
     *
     * @param button Toolbar button tooltip
     * @returns Promise resolving with the Toolbar button
     */
    public static getToolbarButton = async (button: string): Promise<WebElement | undefined> => {
        const buttons = await driver.findElements(By.css("#contentHost button"));
        for (const btn of buttons) {
            if ((await btn.getAttribute("data-tooltip")) === button) {
                return btn;
            }
        }

        throw new Error(`Could not find button '${button}'`);
    };

    /**
     * Returns the current selected connection tab, on the DB Editor
     *
     * @returns Promise resolving with the Connection tab name
     */
    public static getSelectedConnectionTab = async (): Promise<string> => {
        const tab = await driver.wait(until.elementLocated(By.css(".selected.hasAuxillary")),
            explicitWait, "Selected tab was not found");

        const label = await tab.findElement(By.css(".label"));

        return label.getText();
    };

    /**
     * Enables/Disables the Find in Selection button, on the Find and Replace box
     *
     * @param el find widget
     * @param flag true to enable, false otherwise
     * @returns Promise resolving when the find is made
     */
    public static findInSelection = async (el: WebElement, flag: boolean): Promise<void> => {
        const actions = await el.findElements(By.css(".find-actions div"));
        for (const action of actions) {
            if (
                (await action.getAttribute("title")).indexOf("Find in selection") !==
            -1
            ) {
                const checked = await action.getAttribute("aria-checked");
                if (checked === "true") {
                    if (!flag) {
                        await action.click();
                    }
                } else {
                    if (flag) {
                        await action.click();
                    }
                }

                return;
            }
        }
    };

    /**
     * Closes the finder on DB Editor
     *
     * @param el element to close
     * @returns Promise resolving with the finder is closed
     */
    public static closeFinder = async (el: WebElement): Promise<void> => {
        const actions = await el.findElements(By.css(".find-actions div"));
        for (const action of actions) {
            if ((await action.getAttribute("title")).indexOf("Close") !== -1) {
                await action.click();
            }
        }
    };

    /**
     * Expands the finder to show the Replace text box
     *
     * @param el the finder
     * @param flag true to open, false otherwise
     * @returns Promise resolving when the action is made
     */
    public static expandFinderReplace = async (el: WebElement, flag: boolean): Promise<void> => {
        const divs = await el.findElements(By.css("div"));
        for (const div of divs) {
            if ((await div.getAttribute("title")) === "Toggle Replace") {
                const expanded = await div.getAttribute("aria-expanded");
                if (flag) {
                    if (expanded === "false") {
                        await div.click();
                    }
                } else {
                    if (expanded === "true") {
                        await div.click();
                    }
                }
            }
        }
    };

    /**
     * Returns a button on the finder box dialog
     *
     * @param el the finder
     * @param button button name
     * @returns Promise resolving with the button
     */
    public static replacerGetButton = async (el: WebElement, button: string): Promise<WebElement | undefined> => {
        const replaceActions = await el.findElements(
            By.css(".replace-actions div"),
        );
        for (const action of replaceActions) {
            if (
                (await action.getAttribute("title")).indexOf(button) !== -1
            ) {
                return action;
            }
        }
    };

    /**
     * Returns an object/item within the schema section on the DB Editor
     *
     * @param objType Schema/Tables/Views/Routines/Events/Triggers/Foreign Keys/Indexes
     * @param objName Name of the object
     * @returns Promise resolving with the object
     */
    public static getSchemaObject = async (
        objType: string, objName: string): Promise<WebElement | undefined> => {
        const scroll = await driver.wait(until.elementLocated(By.css("#schemaSectionHost .tabulator-tableholder")),
            explicitWait, "Table scroll was not found");

        await driver.executeScript("arguments[0].scrollBy(0,-1000)", scroll);

        const sectionHost = await driver.findElement(By.id("schemaSectionHost"));
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
                        By.css(`.tabulator-table .tabulator-tree-level-${level}`),
                    );

                    return (
                        (await objects[0].findElement(By.css("label")).getText()) !==
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
                const sectionHost = await driver.findElement(By.id("schemaSectionHost"));
                const objects = await sectionHost.findElements(
                    By.css(`.tabulator-table .tabulator-tree-level-${level}`),
                );
                let ref;
                try {
                    for (const object of objects) {
                        ref = object.findElement(By.css("label"));
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
     *
     * @param objType Schema/Tables/Views/Routines/Events/Triggers/Foreign Keys/Indexes
     * @param objName Name of the object
     * @returns Promise resolving with the object
     */
    public static toggleSchemaObject = async (objType: string, objName: string): Promise<void> => {
        const obj = await DBConnection.getSchemaObject(objType, objName);
        const toggle = await obj!.findElement(By.css(".treeToggle"));
        await driver.executeScript("arguments[0].click()", toggle);
        await driver.sleep(1000);
    };

    /**
     * Adds a script on the DB Editor
     *
     * @param scriptType JS/TS/SQL
     * @returns Promise resolving with the name of the created script
     */
    public static addScript = async (scriptType: string): Promise<string> => {
        const context = await driver.findElement(By.id("scriptSectionHost"));
        const items = await context.findElements(By.css("div.tabulator-row"));

        await driver.executeScript(
            "arguments[0].click()",
            await context.findElement(By.id("addScript")),
        );
        const menu = await driver.findElement(By.css("div.visible.noArrow.menu"));
        switch (scriptType) {
            case "JS":
                await menu.findElement(By.id("addJSScript")).click();
                break;
            case "TS":
                await menu.findElement(By.id("addTSScript")).click();
                break;
            case "SQL":
                await menu.findElement(By.id("addSQLScript")).click();
                break;
            default:
                break;
        }

        await driver.wait(async () => {
            return (await context.findElements(By.css("div.tabulator-row"))).length > items.length;
        }, 2000, "No script was created");

        const entries = await context.findElements(By.css(".schemaTreeEntry label"));

        return entries[entries.length-1].getText();
    };

    /**
     * Checks if a script exists on the DB Editor
     *
     * @param scriptName Script name
     * @param scriptType javascript/typescript/mysql
     * @returns Promise resolving with true if exists, false otherwise
     */
    public static existsScript = async (scriptName: string, scriptType: string): Promise<boolean> => {
        const context = await driver.findElement(By.id("scriptSectionHost"));
        const items = await context.findElements(By.css("div.tabulator-row"));
        for (const item of items) {
            const label = await (await item.findElement(By.css(".schemaTreeEntry label"))).getText();
            const src = await (await item.findElement(By.css(".schemaTreeEntry img"))).getAttribute("src");
            if (label === scriptName && src.indexOf(scriptType) !== -1) {
                return true;
            }
        }

        return false;
    };

    /**
     * Returns the opened editor
     *
     * @param editor Editor name
     * @returns Promise resolving with the Editor
     */
    public static getOpenEditor = async (editor: string): Promise<WebElement | undefined> => {
        const context = await driver.findElement(By.id("editorSectionHost"));
        const editors = await context.findElements(
            By.css("div.accordionItem.closable"),
        );
        for (const edtr of editors) {
            if ((await edtr.findElement(By.css("span.label")).getText()) === editor) {
                return edtr;
            }
        }
    };

    /**
     * Selects an editor from the drop down list on the DB Editor
     *
     * @param editorName Editor name
     * @param editorType javascript/typescript/mysql
     * @returns Promise resolving when the select is made
     */
    public static selectCurrentEditor = async (editorName: string, editorType: string): Promise<void> => {
        const selector = await driver.findElement(By.id("documentSelector"));
        await driver.executeScript("arguments[0].click()", selector);

        await driver.wait(async () => {
            return (await driver.findElements(By.css("div.visible.dropdownList > div"))).length > 1;
        }, 2000, "No elements located on dropdown");

        const dropDownItems = await driver.findElements(
            By.css("div.visible.dropdownList > div"),
        );

        for (const item of dropDownItems) {
            const name = await item.findElement(By.css("label")).getText();
            const type = await item
                .findElement(By.css("img"))
                .getAttribute("src");
            if (name === editorName) {
                if (type.indexOf(editorType) !== -1) {
                    await driver.wait(async () => {
                        await item.click();
                        const selected = await selector.findElement(By.css("label")).getText();

                        return selected === editorName;
                    }, 5000, `${editorName} with type ${editorType} was not properly selected`);

                    await driver.wait(
                        async () => {
                            return (
                                (
                                    await driver.findElements(
                                        By.css("div.visible.dropdownList > div"),
                                    )
                                ).length === 0
                            );
                        },
                        2000,
                        "Dropdown list is still visible",
                    );

                    return;
                }
            }
        }
        throw new Error(`Coult not find ${editorName} with type ${editorType}`);
    };

    /**
     * Clicks on the DB Editor Context menu
     *
     * @param itemName Contex menu item name
     * @returns A promise resolving when the click is made
     */
    public static clickContextItem = async (itemName: string): Promise<void> => {
        await driver.wait(async () => {
            try {
                const lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));
                const el = lines[lines.length - 1];
                await driver
                    .actions()
                    .contextClick(el)
                    .perform();

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, explicitWait, "Line was still stale");


        const shadowRootHost = await driver.wait(until.elementLocated(By.css(".shadow-root-host")),
            2000, "Context menu was not displayed");

        const shadowRoot: WebElement = await driver.executeScript("return arguments[0].shadowRoot", shadowRootHost);

        const menuItems = await shadowRoot.findElements(By.css("a.action-menu-item"));

        for (const menuItem of menuItems) {
            const item = await menuItem.findElement(By.css("span.action-label"));
            const text = await item.getText();
            if (text === itemName) {
                await menuItem.click();

                return;
            }
        }
        throw new Error(`Could not find item '${itemName}'`);
    };

    /**
     * Expand or Collapses a menu on the DB Editor
     *
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
                    elToClick = await driver.findElement(
                        By.id("editorSectionHost")).findElement(By.css("div.container.section label"));
                    elToVerify = await driver.findElement(By.css("#editorSectionHost .accordionItem"));
                    break;
                case "schemas":
                    elToClick = await driver.findElement(
                        By.id("schemaSectionHost")).findElement(By.css("div.container.section label"));
                    elToVerify = await driver.findElement(
                        By.id("schemaSectionHost")).findElement(By.css(".tabulator-table"));

                    break;
                case "admin":
                    elToClick = await driver.findElement(
                        By.id("adminSectionHost")).findElement(By.css("div.container.section label"));
                    elToVerify = await driver.findElement(
                        By.id("adminSectionHost")).findElement(By.css(".accordionItem"));
                    break;
                case "scripts":
                    elToClick = await driver.findElement(
                        By.id("scriptSectionHost")).findElement(By.css("div.container.section label"));

                    elToVerify = await driver.findElement(
                        By.id("scriptSectionHost")).findElements(By.css(".tabulator-table"));
                    if (elToVerify.length === 0) {
                        elToVerify = await driver.findElement(
                            By.id("scriptSectionHost")).findElement(By.css(".accordionItem"));
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
            await driver.sleep(500);
            await DBConnection.expandCollapseMenus(menu, expand, retries + 1);
        }
    };

    /**
     * Verifies if a new prompt exists on the DB Editor
     *
     * @returns A promise resolving with true if exists, false otherwise
     */
    public static hasNewPrompt = async (): Promise<boolean | undefined> => {
        let text = "";
        await driver.wait(async () => {
            try {
                await DBConnection.promptScrollDown();
                const context = await driver.findElement(By.css(".monaco-editor-background"));
                const prompts = await context.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
                const lastPrompt = await prompts[prompts.length-1].findElement(By.css("span > span"));
                text = await lastPrompt.getText();

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, explicitWait, "Could not determine if there is a new prompt");

        return text.length === 0;
    };

    /**
     * Clicks on an item under the MySQL Administration section, on the DB Editor
     *
     * @param item Item name
     * @returns A promise resolving when the click is made
     */
    public static clickAdminItem = async (item: string): Promise<void> => {
        const els = await driver.wait(until.elementsLocated(By.css("#adminSectionHost .accordionItem .label")),
            explicitWait, "Admin items not found");
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
     *
     * @returns A promise resolving whith the editor
     */
    public static getCurrentEditor = async (): Promise<string> => {
        const selector = await driver.findElement(By.id("documentSelector"));
        const label = await selector.findElement(By.css("label"));

        return label.getText();
    };

    /**
     * Selects an Editor from the drop down list, on the DB Editor
     *
     * @param editor The editor
     * @returns A promise resolving when the select is made
     */
    public static selectEditor = async (editor: string): Promise<void> => {
        const selector = await driver.findElement(By.id("documentSelector"));
        await selector.click();
        const list = await driver.findElement(By.css(".dropdownList"));
        const items = await list.findElements(By.css(".dropdownItem"));

        for (const item of items) {
            const label = await item.findElement(By.css("label"));
            const text = await label.getAttribute("innerHTML");
            if (text === editor) {
                await item.click();

                return;
            }
        }
        throw new Error(`Could not find ${editor}`);
    };

    /**
     * Checks if a statement has the blue dot , indicating that it's a statement start
     *
     * @param statement query
     * @returns Promise resolving if the statement is has the blue dot, or not
     */
    public static isStatementStart = async (statement: string): Promise <boolean | undefined> => {

        const getLineSentence = async (ctx: WebElement): Promise<string> => {
            const spans = await ctx.findElements(By.css("span"));
            let sentence = "";
            for (const span of spans) {
                sentence += (await span.getText()).replace("&nbsp;", " ");
            }

            return sentence;
        };

        let flag: boolean | undefined;

        await driver.wait(async () => {
            try {
                const leftSideLines = await driver.findElements(By.css(".margin-view-overlays > div"));
                const rightSideLines = await driver.findElements(
                    By.css(".view-lines.monaco-mouse-cursor-text > div > span"));

                let index = -1;

                for (let i=0; i <= rightSideLines.length - 1; i++) {
                    const lineSentence = await getLineSentence(rightSideLines[i]);
                    if (lineSentence.trim() === statement) {
                        index = i;
                        break;
                    }
                }

                if (index === -1) {
                    throw new Error(`Could not find statement ${statement}`);
                }

                flag = (await leftSideLines[index].findElements(By.css(".statementStart"))).length > 0;

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, explicitWait, "Lines were stale");

        return flag;
    };

    /**
     * Executes a scripts
     *
     * @param cmd to execute
     * @param timeout wait for results
     * @param slowWriting write the command similar to a human
     * @returns Promise resolving when the command is executed and the results are generated.
     * The returned array contains 2 positions. First one, has command result (OK, 1 record retrieved).
     * The second position has the WebElement which contains the results block
     */
    public static execScript = async (cmd: string, timeout?: number,
        slowWriting?: boolean): Promise<Array<string | WebElement>> => {

        const textArea = await driver?.findElement(By.css("textarea"));
        if (slowWriting) {
            await Misc.writeCmd(cmd, slowWriting);
        } else {
            await textArea.sendKeys(cmd.substring(0, 1));
            await textArea.sendKeys(cmd.substring(1));
        }

        await Misc.execOnEditor();
        timeout = timeout ?? 5000;

        const toReturn: Array<string | WebElement> = [];
        await driver.wait(async () => {
            try {
                const resultPaneHost = await driver.findElements(By.id("resultPaneHost"));
                const height = parseInt((await resultPaneHost[0].getCssValue("height")).replace("px", ""), 10);
                if (height > 0) {
                    const resultHost = await driver.findElements(By.css(".resultHost"));
                    if (resultHost.length > 0) {
                        const resultStatus = await resultHost[0].findElements(By.css(".resultStatus .label"));
                        if (resultStatus.length > 0) {
                            toReturn.push(await resultStatus[0].getAttribute("innerHTML"));
                            toReturn.push(await resultHost[0].findElement(By.css(".resultTabview")));

                            return true;
                        }


                        const content = await resultHost[0].findElements(By.css(".actionOutput .label"));
                        if (content.length) {
                            const temp = await content[0].getAttribute("innerHTML");
                            toReturn.push(temp);

                            return temp;
                        }
                    }
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }

        }, timeout, `No results were found from the script execution - '${cmd}'`);

        return toReturn;
    };

    /**
     * Scrolls down on the DB Editor
     *
     * @returns A promise resolving when the scroll is made
     */
    private static promptScrollDown = async (): Promise<void> => {
        const el = await driver.findElement(By.css(".codeEditor .monaco-scrollable-element"));
        await driver.executeScript("arguments[0].scrollBy(0, 5000)", el);
    };

}
