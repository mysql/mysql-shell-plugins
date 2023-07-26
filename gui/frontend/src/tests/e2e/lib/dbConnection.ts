/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import { By, until, Key, WebElement, error } from "selenium-webdriver";
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
            await tab.findElement(By.css("#auxillary .closeButton")).click();
        } else {
            const tabs = await driver.findElements(By.css(".hasAuxillary"));
            for (const tab of tabs) {
                const text = await tab.findElement(By.css("label")).getAttribute("innerHTML");
                if (text.trim() === name) {
                    await tab.findElement(By.css("#auxillary .closeButton")).click();

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
        const buttons = await driver.findElements(By.css("#contentHost .button"));
        for (const btn of buttons) {
            if ((await btn.getAttribute("data-tooltip")) === button) {
                return btn;
            }
        }

        throw new Error(`Could not find button '${button}'`);
    };

    /**
     * Returns the result status of a query or instruction on the DB Editor
     *
     * @param isSelect if the expected result is from a select statement
     * @returns Promise resolving with the Result status. Ex. OK, 1 record returned
     */
    public static getResultStatus = async (isSelect?: boolean): Promise<string> => {
        let results: WebElement[] | undefined;
        let obj = "";
        if (isSelect) {
            obj = "label";
        } else {
            obj = "span";
        }
        await driver.wait(
            async (driver) => {
                results = await driver.wait(until.elementsLocated(By.css(".zoneHost")),
                    explicitWait, "Zone hosts were not found");

                const about = await results[0].findElements(By.css("span"));

                //first element is usually the about info
                if (about.length > 0 && (await about[0].getText()).indexOf("Welcome") !== -1) {
                    results.shift();
                }
                if (results.length > 0) {
                    if ((await results[0].findElements(By.css(".message.info"))).length > 0) {
                        //if language has been changed...
                        results.shift();
                    }
                } else {
                    return false;
                }

                return results[results.length - 1] !== undefined;
            },
            10000,
            `Result Status is undefined`,
        );

        const block = await driver.wait(until.elementLocated(async () => {
            return results![results!.length - 1].findElements(By.css(obj));
        }), explicitWait, `${obj} was not found`);

        return block.getAttribute("innerHTML");
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
     * Returns the number of statement starts (blue dots) on the editor
     *
     * @returns Promise resolving with the number of statement starts
     */
    public static getStatementStarts = async (): Promise<number> => {
        return (await driver.findElements(By.css(".statementStart"))).length;
    };

    /**
     * Tell if the statement is a statement start (has a blue dot on the beginning)
     *
     * @param statement statement
     * @returns Promise resolving with the number of statement starts
     */
    public static isStatementStart = async (statement: string): Promise<boolean | undefined> => {

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

                for (let i = 0; i <= rightSideLines.length - 1; i++) {
                    const lineSentence = await getLineSentence(rightSideLines[i]);
                    if (lineSentence.includes(statement)) {
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
                if (e instanceof error.StaleElementReferenceError) {
                    return false;
                } else {
                    throw e;
                }
            }
        }, explicitWait, "Lines were stale");

        return flag;
    };

    /**
     * Writes a command on the displayed textarea
     *
     * @param cmd cmd to write
     * @param slowWriting True to write like a human
     * @returns Promise resolving when the sql query is written
     */
    public static writeSQL = async (cmd: string, slowWriting?: boolean): Promise<void> => {
        const textArea = await driver.wait(until.elementLocated(By.css("textarea")),
            explicitWait, "Could not find the textarea");
        await driver.wait(async () => {
            try {
                if (slowWriting) {
                    const items = cmd.split("");
                    for (const item of items) {
                        await textArea.sendKeys(item);
                        await driver.sleep(20);
                    }
                } else {
                    await textArea.sendKeys(cmd);
                }

                return true;
            } catch (e) {
                if (e instanceof error.ElementNotInteractableError) {
                    const editorLines = await driver.findElements(By.css("#appHostPaneHost .view-line"));
                    await editorLines[editorLines.length - 1].click();
                } else {
                    throw e;
                }
            }
        }, explicitWait, "Text area was not interactable");
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

        return entries[entries.length - 1].getText();
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
            if ((await edtr.findElement(By.css("label")).getText()) === editor) {
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
            const el = await item.findElements(By.css("img"));

            let type = "";

            if (el.length > 0) {
                type = await el[0].getAttribute("src");
            } else {
                type = await item.findElement(By.css(".msg.icon")).getAttribute("style");
            }

            if (name === editorName) {
                if (type.indexOf(editorType) !== -1) {
                    await driver.wait(async () => {
                        await item.click();
                        const selector = await driver.findElement(By.id("documentSelector"));
                        const selected = await selector.findElement(By.css("label")).getText();

                        return selected === editorName;
                    }, explicitWait, `${editorName} with type ${editorType} was not properly selected`);

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
     * Returns the result tab or a multi-query result, on the DB Editor
     *
     * @param tabName Tab name
     * @returns Promise resolving with the tab
     */
    public static getResultTab = async (tabName: string): Promise<WebElement | undefined> => {
        const zoneHosts = await driver.findElements(By.css(".zoneHost"));
        const tabs = await zoneHosts[zoneHosts.length - 1].findElements(By.css(".resultHost .tabArea div"));

        for (const tab of tabs) {
            if (await tab.getAttribute("id") !== "selectorItemstepDown" &&
                await tab.getAttribute("id") !== "selectorItemstepUp") {
                const label = await tab.findElement(By.css("label"));
                if ((await label.getAttribute("innerHTML")).indexOf(tabName) !== -1) {
                    return tab;
                }
            }
        }
    };

    /**
     * Returns the result tab names of a multi-query result, on the DB Editor
     *
     * @returns Promise resolving with the tab names
     */
    public static getResultTabs = async (): Promise<String[]> => {
        const zoneHosts = await driver.findElements(By.css(".zoneHost"));
        const tabs = await zoneHosts[zoneHosts.length - 1].findElements(By.css(".resultHost .tabArea div"));
        const resultTabs = [];

        for (const tab of tabs) {
            if (await tab.getAttribute("id") !== "selectorItemstepDown" &&
                await tab.getAttribute("id") !== "selectorItemstepUp") {
                const label = await tab.findElement(By.css("label"));
                resultTabs.push(await label.getAttribute("innerHTML"));
            }
        }

        return resultTabs;
    };

    /**
     * Returns the result column name of a sql query, on the DB Editor
     *
     * @param columnName Column name
     * @param retry Number of retries to get the column (default = 2)
     * @returns A promise resolving with the column
     */
    public static getResultColumnName = async (columnName: string,
        retry?: number): Promise<WebElement | undefined> => {
        if (!retry) {
            retry = 0;
        } else {
            if (retry === 2) {
                throw new Error("Max retries for getting column name was reached");
            }
        }
        try {
            const resultHosts = await driver.wait(until.elementsLocated(By.css(".resultHost")),
                explicitWait, "Result host was not found");

            const resultSet = await driver.wait(until.elementLocated(async () => {
                return resultHosts[resultHosts.length - 1].findElements(By.css(".tabulator-headers"));
            }), explicitWait, "Table headers not found");

            const resultHeaderRows = await driver.wait(until.elementsLocated(async () => {
                return resultSet.findElements(By.css(".tabulator-col-title"));
            }), explicitWait, "Table column titles not found");

            for (const row of resultHeaderRows) {
                if ((await row.getText()) === columnName) {
                    return row;
                }
            }

        } catch (e) {
            if (e instanceof Error) {
                if (e.message.indexOf("stale") === -1) {
                    throw e;
                }
            } else {
                await DBConnection.getResultColumnName(columnName, retry + 1);
            }
        }
    };

    /**
     * Returns the graph resulting from a typescript script, on the DB Editor
     *
     * @returns A promise resolving with the graph
     */
    public static getGraphHost = async (): Promise<WebElement> => {
        const resultHosts = await driver.findElements(By.css(".zoneHost"));
        const lastResult = resultHosts[resultHosts.length - 1];

        return driver.wait(async () => {
            return lastResult.findElement(By.css(".graphHost"));
        }, 10000, "Pie Chart was not displayed");
    };

    /**
     * Returns the output of switching language on the DB Editor
     *
     * @param penultimate get the penultimate result
     * @returns A promise resolving with the output
     */
    public static getOutput = async (penultimate?: boolean): Promise<string> => {
        const zoneHosts = await driver.findElements(By.css(".zoneHost"));
        let context;
        if (penultimate) {
            context = zoneHosts[zoneHosts.length - 2];
        } else {
            context = zoneHosts[zoneHosts.length - 1];
        }

        let items = await context.findElements(By.css("label"));
        //const otherItems = await context.findElements(By.css(".textHost span"));
        let text;

        if (items.length > 0) {
            text = await items[0].getText();
        } else {
            items = await context.findElements(By.css(".textHost span"));
            if (items.length > 0) {
                text = await items[items.length - 1].getText();
            } else {
                items = await context.findElements(By.css(".entry > span"));
                if (items.length) {
                    text = await items[items.length - 1].getText();
                } else {
                    items = await context.findElements(By.css(".info"));
                    text = await items[0].getText();
                }
            }
        }

        return text;
    };

    /**
     * Returns the current language of the prompt on the DB Editor
     *
     * @returns A promise resolving with the language
     */
    public static getEditorLanguage = async (): Promise<string> => {
        const editors = await driver.wait(until.elementsLocated(By.css(".editorPromptFirst")),
            explicitWait, "Could not find the editor prompts");
        const editorClasses = (await editors[editors.length - 1].getAttribute("class")).split(" ");

        return editorClasses[2].replace("my", "");
    };

    /**
     * Sets the language on the DB Editor
     *
     * @param language sql/js/ts
     * @returns A promise resolving when the language is set
     */
    public static setEditorLanguage = async (language: string): Promise<void> => {
        const curLang = await DBConnection.getEditorLanguage();
        if (curLang !== language) {
            const contentHost = await driver.findElement(By.id("contentHost"));
            const textArea = await contentHost.findElement(By.css("textarea"));
            await Misc.execCmd(textArea, "\\" + language.replace("my", ""));
            const results = await driver.findElements(By.css(".message.info"));
            switch (language) {
                case "sql":
                    expect(await results[results.length - 1].getText()).toBe("Switched to MySQL mode");
                    break;
                case "js":
                    expect(await results[results.length - 1].getText()).toBe("Switched to JavaScript mode");
                    break;
                case "ts":
                    expect(await results[results.length - 1].getText()).toBe("Switched to TypeScript mode");
                    break;
                default:
                    break;
            }
        }
    };

    /**
     * Clicks on the DB Editor Context menu
     *
     * @param item Contex menu item name
     * @returns A promise resolving when the click is made
     */
    public static clickContextItem = async (item: string): Promise<void> => {

        const isCtxMenuDisplayed = async (): Promise<boolean> => {
            const el = await driver.executeScript(`return document.querySelector(".shadow-root-host").
                shadowRoot.querySelector("span[aria-label='${item}']")`);

            return el !== null;
        };

        await driver.wait(async () => {
            const textArea = await driver.findElement(By.css("textarea"));
            await driver.actions().contextClick(textArea).perform();

            return isCtxMenuDisplayed();

        }, explicitWait, "Context menu was not displayed");

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
        }, explicitWait, "Context menu is still displayed");
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
            await driver.sleep(1000);
            console.log(e);
            await DBConnection.expandCollapseMenus(menu, expand, retries + 1);
        }
    };

    /**
     * Scrolls down on the DB Editor
     *
     * @returns A promise resolving when the scroll is made
     */
    public static promptScrollDown = async (): Promise<void> => {
        const el = await driver.findElement(By.css(".codeEditor .monaco-scrollable-element"));
        await driver.executeScript("arguments[0].scrollBy(0, 5000)", el);
    };

    /**
     * Verifies if a new prompt exists on the DB Editor
     *
     * @returns A promise resolving with true if exists, false otherwise
     */
    public static hasNewPrompt = async (): Promise<boolean> => {
        let text: String;
        try {
            await DBConnection.promptScrollDown();
            const context = await driver.findElement(By.css(".monaco-editor-background"));
            const prompts = await context.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
            const lastPrompt = await prompts[prompts.length - 1].findElement(By.css("span > span"));
            text = await lastPrompt.getText();
        } catch (e) {
            if (e instanceof Error) {
                if (String(e).indexOf("StaleElementReferenceError") === -1) {
                    throw new Error(String(e.stack));
                } else {
                    await driver.sleep(500);
                    const context = await driver.findElement(By.css(".monaco-editor-background"));
                    const prompts = await context
                        .findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
                    const lastPrompt = await prompts[prompts.length - 1].findElement(By.css("span > span"));
                    text = await lastPrompt.getText();
                }
            }
        }

        return String(text!).length === 0;
    };

    /**
     * Returns the latest html query result id
     * This function is useful to verify later if a new result id is displayed, after a query
     *
     * @returns A promise resolving with the Id
     */
    public static getLastQueryResultId = async (): Promise<number> => {
        const zoneHosts = await driver.findElements(By.css(".zoneHost"));
        if (zoneHosts.length > 0) {
            const zones = await driver.findElements(By.css(".zoneHost"));

            return parseInt((await zones[zones.length - 1].getAttribute("monaco-view-zone")).match(/\d+/)![0], 10);
        } else {
            return 0;
        }
    };

    /**
     * Returns the result after executing a script, on the DB Editor
     *
     * @param timeout wait
     * @returns A promise resolving with the result
     */
    public static getScriptResult = async (timeout = explicitWait): Promise<string> => {
        let toReturn = "";
        await driver.wait(async () => {
            try {
                const resultHost = await driver.findElements(By.css(".resultHost"));
                if (resultHost.length > 0) {
                    const content = await resultHost[0]
                        .findElements(By.css(".resultStatus .label,.actionOutput span > span"));

                    if (content.length) {
                        toReturn = await content[0].getAttribute("innerHTML");

                        return true;
                    }
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }

        }, timeout, `No results were found`);

        return toReturn;
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
     * Opens a new notebook
     *
     * @returns Promise resolving when the new notebook is opened
     *
     */
    public static openNewNotebook = async (): Promise<void> => {
        await driver.executeScript(
            "arguments[0].click()",
            await driver.findElement(By.id("addConsole")),
        );

        const input = await driver.wait(until.elementLocated(By.css("#editorSectionHost input")),
            explicitWait, "Editor host input was not found");

        await input.sendKeys(Key.ESCAPE);

    };

}
