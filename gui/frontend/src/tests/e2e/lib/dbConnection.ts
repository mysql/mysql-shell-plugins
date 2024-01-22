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

import { until, Key, WebElement, error, WebDriver } from "selenium-webdriver";
import { explicitWait, Misc } from "./misc.js";
import * as locator from "../lib/locators.js";

export class DBConnection {

    /**
     * Verifies if the Connection Overview tab is selected/opened, on the DB Editor
     * @param driver The webdriver
     * @returns Promise resolving to true if it's opened, false otherwise
     */
    public static isConnectionOverviewOpened = async (driver: WebDriver): Promise<boolean> => {
        const connections = await driver.findElement(locator.dbConnections.tab);
        const classes = await connections.getAttribute("class");

        return classes.includes("selected");
    };

    /**
     * Closes the current opened connection tab, or an existing connection tab
     * Throws an exception if the existing connection tab is not found
     * @param driver The webdriver
     * @param name Connection tab name
     * @returns Promise resolving when the connection is closed
     */
    public static closeDBconnection = async (driver: WebDriver, name: string): Promise<void> => {
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
     * Returns the toolbar button on the DB Editor.
     * Throws an exception if the button is not found.
     * @param driver The webdriver
     * @param button Toolbar button tooltip
     * @returns Promise resolving with the Toolbar button
     */
    public static getToolbarButton = async (driver: WebDriver, button: string): Promise<WebElement | undefined> => {
        const buttons = await driver.findElement(locator.notebook.toolbar.exists)
            .findElements(locator.notebook.toolbar.button);
        for (const btn of buttons) {
            if ((await btn.getAttribute("data-tooltip")) === button) {
                return btn;
            }
        }

        throw new Error(`Could not find button '${button}'`);
    };

    /**
     * Clicks on a toolbar button and waits for the button to be active again.
     * Throws an exception if the button is not found.
     * @param driver The webdriver
     * @param button Toolbar button tooltip
     * @returns Promise resolving with the Toolbar button
     */
    public static clickToolbarButton = async (driver: WebDriver, button: string): Promise<void> => {
        const toolbarButton = await DBConnection.getToolbarButton(driver, button);
        await toolbarButton?.click();
        await driver.wait(async () => {
            return (await toolbarButton?.getAttribute("class"))?.includes("disabled");
        }, explicitWait, `The button ${button} should be disabled after clicking it`);
        await driver.wait(async () => {
            return (await toolbarButton?.getAttribute("class"))?.includes("disabled") === false;
        }, explicitWait, `The button ${button} should be enabled`);
    };

    /**
     * Returns the result status of a query or instruction on the DB Editor
     * @param driver The webdriver
     * @param isSelect if the expected result is from a select statement
     * @returns Promise resolving with the Result status. Ex. OK, 1 record returned
     */
    public static getResultStatus = async (driver: WebDriver, isSelect?: boolean): Promise<string> => {
        let results: WebElement[] | undefined;
        const obj = "";

        await driver.wait(
            async (driver) => {
                results = await driver.wait(until.elementsLocated(locator.notebook.codeEditor.editor.result.exists),
                    explicitWait, "Zone hosts were not found");

                const about = await results[0].findElements(locator.htmlTag.span);

                //first element is usually the about info
                if (about.length > 0 && (await about[0].getText()).indexOf("Welcome") !== -1) {
                    results.shift();
                }
                if (results.length > 0) {
                    if ((await results[0].findElements(locator.notebook.codeEditor.editor.result.info)).length > 0) {
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
            if (isSelect) {
                return results![results!.length - 1].findElements(locator.htmlTag.label);
            } else {
                return results![results!.length - 1].findElements(locator.htmlTag.span);
            }
        }), explicitWait, `${obj} was not found`);

        return block.getAttribute("innerHTML");
    };

    /**
     * Returns the current selected connection tab, on the DB Editor
     * @param driver The webdriver
     * @returns Promise resolving with the Connection tab name
     */
    public static getSelectedConnectionTab = async (driver: WebDriver): Promise<string> => {
        const tab = await driver.wait(until.elementLocated(locator.notebook.connectionTab.opened),
            explicitWait, "Selected tab was not found");

        const label = await tab.findElement(locator.htmlTag.label);

        return label.getText();
    };

    /**
     * Tell if the statement is a statement start (has a blue dot on the beginning)
     * @param driver The webdriver
     * @param statement statement
     * @returns Promise resolving with the number of statement starts
     */
    public static isStatementStart = async (driver: WebDriver, statement: string): Promise<boolean | undefined> => {

        const getLineSentence = async (ctx: WebElement): Promise<string> => {
            const spans = await ctx.findElements(locator.htmlTag.span);
            let sentence = "";
            for (const span of spans) {
                sentence += (await span.getText()).replace("&nbsp;", " ");
            }

            return sentence;
        };

        let flag: boolean | undefined;

        await driver.wait(async () => {
            try {
                const leftSideLines = await driver.findElements(locator.notebook.codeEditor.editor.promptLine);
                const rightSideLines = await driver.findElements(locator.notebook.codeEditor.editor.editorLine);
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
                flag = (await leftSideLines[index].findElements(locator.notebook.codeEditor.editor.statementStart))
                    .length > 0;

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
     * @param driver The webdriver
     * @param cmd cmd to write
     * @param slowWriting True to write like a human
     * @returns Promise resolving when the sql query is written
     */
    public static writeSQL = async (driver: WebDriver, cmd: string, slowWriting?: boolean): Promise<void> => {
        const textArea = await driver.wait(until.elementLocated(locator.notebook.codeEditor.textArea),
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
                    const editorLines = await driver.findElements(locator.notebook.codeEditor.editor.line);
                    await editorLines[editorLines.length - 1].click();
                } else {
                    throw e;
                }
            }
        }, explicitWait, "Text area was not interactable");
    };

    /**
     * Enables/Disables the Find in Selection button, on the Find and Replace box
     * @param driver The webdriver
     * @param el find widget
     * @param flag true to enable, false otherwise
     * @returns Promise resolving when the find is made
     */
    public static findInSelection = async (driver: WebDriver, el: WebElement, flag: boolean): Promise<void> => {
        const actions = await el.findElements(locator.findWidget.actions);
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
     * @param driver The webdriver
     * @returns Promise resolving with the finder is closed
     */
    public static closeFinder = async (driver: WebDriver): Promise<void> => {
        await driver.wait(async () => {
            const findWidget = await driver.findElements(locator.findWidget.isVisible);
            if (findWidget.length > 0) {
                const closeButton = await findWidget[0].findElement(locator.findWidget.close);
                await driver.executeScript("arguments[0].click()", closeButton);

                return (await driver.findElements(locator.findWidget.isVisible)).length === 0;
            } else {
                return true;
            }
        }, explicitWait, "Widget was not closed");
    };

    /**
     * Expands the finder to show the Replace text box
     *
     * @param el the finder
     * @param flag true to open, false otherwise
     * @returns Promise resolving when the action is made
     */
    public static expandFinderReplace = async (el: WebElement, flag: boolean): Promise<void> => {
        const divs = await el.findElements(locator.htmlTag.div);
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
        const replaceActions = await el.findElements(locator.findWidget.replacerActions);
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
     * @param driver The webdriver
     * @param objType Schema/Tables/Views/Routines/Events/Triggers/Foreign Keys/Indexes
     * @param objName Name of the object
     * @returns Promise resolving with the object
     */
    public static getSchemaObject = async (
        driver: WebDriver,
        objType: string,
        objName: string): Promise<WebElement | undefined> => {
        const scroll = await driver.wait(until.elementLocated(locator.notebook.explorerHost.schemas.scroll),
            explicitWait, "Table scroll was not found");

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
     * @param driver The webdriver
     * @param objType Schema/Tables/Views/Routines/Events/Triggers/Foreign Keys/Indexes
     * @param objName Name of the object
     * @returns Promise resolving with the object
     */
    public static toggleSchemaObject = async (driver: WebDriver, objType: string, objName: string): Promise<void> => {
        const obj = await DBConnection.getSchemaObject(driver, objType, objName);
        const toggle = await obj!.findElement(locator.notebook.explorerHost.schemas.treeToggle);
        await driver.executeScript("arguments[0].click()", toggle);
        await driver.sleep(1000);
    };

    /**
     * Adds a script on the DB Editor
     * @param driver The webdriver
     * @param scriptType JS/TS/SQL
     * @returns Promise resolving with the name of the created script
     */
    public static addScript = async (driver: WebDriver, scriptType: string): Promise<string> => {
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
        }, explicitWait * 2, "No script was created");

        return toReturn;
    };

    /**
     * Checks if a script exists on the DB Editor
     * @param driver The webdriver
     * @param scriptName Script name
     * @param scriptType javascript/typescript/mysql
     * @returns Promise resolving with true if exists, false otherwise
     */
    public static existsScript = async (driver: WebDriver, scriptName: string, scriptType: string):
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
     * @param driver The webdriver
     * @param editor Editor name
     * @returns Promise resolving with the Editor
     */
    public static getOpenEditor = async (driver: WebDriver, editor: string): Promise<WebElement | undefined> => {
        const context = await driver.findElement(locator.notebook.explorerHost.openEditors.exists);
        const editors = await context.findElements(
            locator.notebook.explorerHost.openEditors.item,
        );
        for (const refEditor of editors) {
            if ((await refEditor.findElement(locator.htmlTag.label).getText()) === editor) {
                return refEditor;
            }
        }
    };

    /**
     * Selects an editor from the drop down list on the DB Editor
     * @param driver The webdriver
     * @param editorName Editor name
     * @param editorType javascript/typescript/mysql
     * @returns Promise resolving when the select is made
     */
    public static selectCurrentEditor = async (driver: WebDriver, editorName: string, editorType: string):
        Promise<void> => {
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
                type = await item.findElement(locator.notebook.toolbar.editorSelector.iconType).getAttribute("style");
            }

            if (name === editorName) {
                if (type.indexOf(editorType) !== -1) {
                    await driver.wait(async () => {
                        await item.click();
                        const selector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
                        const selected = await selector.findElement(locator.htmlTag.label).getText();

                        return selected === editorName;
                    }, explicitWait, `${editorName} with type ${editorType} was not properly selected`);

                    await driver.wait(
                        async () => {
                            return (
                                (
                                    await driver.findElements(
                                        locator.notebook.toolbar.editorSelector.items,
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
        throw new Error(`Could not find ${editorName} with type ${editorType}`);
    };

    /**
     * Returns the result tab or a multi-query result, on the DB Editor
     * @param driver The webdriver
     * @param tabName Tab name
     * @returns Promise resolving with the tab
     */
    public static getResultTab = async (driver: WebDriver, tabName: string): Promise<WebElement | undefined> => {
        const zoneHosts = await driver.findElements(locator.notebook.codeEditor.editor.result.exists);
        const tabs = await zoneHosts[zoneHosts.length - 1]
            .findElements(locator.notebook.codeEditor.editor.result.tabSection.tabs);

        for (const tab of tabs) {
            if (await tab.getAttribute("id") !== "selectorItemStepDown" &&
                await tab.getAttribute("id") !== "selectorItemStepUp") {
                const label = await tab.findElement(locator.htmlTag.label);
                if ((await label.getAttribute("innerHTML")).indexOf(tabName) !== -1) {
                    return tab;
                }
            }
        }
    };

    /**
     * Returns the result tab names of a multi-query result, on the DB Editor
     * @param driver The webdriver
     * @returns Promise resolving with the tab names
     */
    public static getResultTabs = async (driver: WebDriver): Promise<String[]> => {
        const zoneHosts = await driver.findElements(locator.notebook.codeEditor.editor.result.exists);
        const tabs = await zoneHosts[zoneHosts.length - 1]
            .findElements(locator.notebook.codeEditor.editor.result.tabSection.tabs);
        const resultTabs = [];

        for (const tab of tabs) {
            if (await tab.getAttribute("id") !== "selectorItemStepDown" &&
                await tab.getAttribute("id") !== "selectorItemStepUp") {
                const label = await tab.findElement(locator.htmlTag.label);
                resultTabs.push(await label.getAttribute("innerHTML"));
            }
        }

        return resultTabs;
    };

    /**
     * Returns the result column name of a sql query, on the DB Editor
     * @param driver The webdriver
     * @param columnName Column name
     * @param retry Number of retries to get the column (default = 2)
     * @returns A promise resolving with the column
     */
    public static getResultColumnName = async (
        driver: WebDriver,
        columnName: string,
        retry?: number): Promise<WebElement | undefined> => {
        if (!retry) {
            retry = 0;
        } else {
            if (retry === 2) {
                throw new Error("Max retries for getting column name was reached");
            }
        }
        try {
            const resultHosts = await driver.wait(until
                .elementsLocated(locator.notebook.codeEditor.editor.result.exists),
                explicitWait, "Result host was not found");

            const resultSet = await driver.wait(until.elementLocated(async () => {
                return resultHosts[resultHosts.length - 1]
                    .findElements(locator.notebook.codeEditor.editor.result.tableHeaders);
            }), explicitWait, "Table headers not found");

            const resultHeaderRows = await driver.wait(until.elementsLocated(async () => {
                return resultSet.findElements(locator.notebook.codeEditor.editor.result.tableColumnTitle);
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
                await DBConnection.getResultColumnName(driver, columnName, retry + 1);
            }
        }
    };

    /**
     * Returns the graph resulting from a typescript script, on the DB Editor
     * @param driver The webdriver
     * @returns A promise resolving with the graph
     */
    public static getGraphHost = async (driver: WebDriver): Promise<WebElement> => {
        const resultHosts = await driver.findElements(locator.notebook.codeEditor.editor.result.exists);
        const lastResult = resultHosts[resultHosts.length - 1];

        return driver.wait(async () => {
            return lastResult.findElement(locator.notebook.codeEditor.editor.result.graphHost.exists);
        }, 10000, "Pie Chart was not displayed");
    };

    /**
     * Returns the output of switching language on the DB Editor
     * @param driver The webdriver
     * @param penultimate get the penultimate result
     * @returns A promise resolving with the output
     */
    public static getOutput = async (driver: WebDriver, penultimate?: boolean): Promise<string> => {
        let text = "";
        await driver.wait(async () => {
            try {
                const zoneHosts = await driver.findElements(locator.notebook.codeEditor.editor.result.exists);
                let context;
                if (penultimate) {
                    context = zoneHosts[zoneHosts.length - 2];
                } else {
                    context = zoneHosts[zoneHosts.length - 1];
                }

                let items = await context.findElements(locator.htmlTag.label);
                if (items.length > 0) {
                    text = await items[0].getText();
                } else {
                    items = await context.findElements(locator.notebook.codeEditor.editor.result.text.exists);
                    if (items.length > 0) {
                        text = await items[items.length - 1].getText();
                    } else {
                        items = await context.findElements(locator.notebook.codeEditor.editor.result.text.entry);
                        if (items.length) {
                            text = await items[items.length - 1].getText();
                        } else {
                            items = await context.findElements(locator.notebook.codeEditor.editor.result.text.info);
                            text = await items[0].getText();
                        }
                    }

                    return true;
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, explicitWait, "Could not find the output");

        return text;
    };

    /**
     * Returns the current language of the prompt on the DB Editor
     * @param driver The webdriver
     * @returns A promise resolving with the language
     */
    public static getEditorLanguage = async (driver: WebDriver): Promise<string> => {
        const editors = await driver.wait(until.elementsLocated(locator.notebook.codeEditor.prompt.current),
            explicitWait, "Could not find the editor prompts");
        const editorClasses = (await editors[editors.length - 1].getAttribute("class")).split(" ");

        return editorClasses[2].replace("my", "");
    };

    /**
     * Sets the language on the DB Editor
     * @param driver The webdriver
     * @param language sql/js/ts
     * @returns A promise resolving when the language is set
     */
    public static setEditorLanguage = async (driver: WebDriver, language: string): Promise<void> => {
        const curLang = await DBConnection.getEditorLanguage(driver);
        if (curLang !== language) {
            const contentHost = await driver.findElement(locator.notebook.exists);
            const textArea = await contentHost.findElement(locator.notebook.codeEditor.textArea);
            await Misc.execCmd(driver, textArea, "\\" + language.replace("my", ""));
            const results = await driver.findElements(locator.notebook.codeEditor.editor.result.info);
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
     * @param driver The webdriver
     * @param item Context menu item name
     * @returns A promise resolving when the click is made
     */
    public static clickContextItem = async (driver: WebDriver, item: string): Promise<void> => {

        const isCtxMenuDisplayed = async (): Promise<boolean> => {
            const el = await driver.executeScript(`return document.querySelector(".shadow-root-host").
                shadowRoot.querySelector("span[aria-label='${item}']")`);

            return el !== null;
        };

        await driver.wait(async () => {
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
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
     * @param driver The webdriver
     * @param menu menu name (open editors/schemas/admin/scripts)
     * @param expand True to expand, false to collapse
     * @param retries number of retries to try to expand or collapse
     * @returns A promise resolving when the expand or collapse is made
     */
    public static expandCollapseMenus = async (driver: WebDriver, menu: string, expand: boolean,
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
            console.log(e);
            await DBConnection.expandCollapseMenus(driver, menu, expand, retries + 1);
        }
    };

    /**
     * Scrolls down on the DB Editor
     * @param driver The webdriver
     * @returns A promise resolving when the scroll is made
     */
    public static promptScrollDown = async (driver: WebDriver): Promise<void> => {
        const el = await driver.findElement(locator.notebook.codeEditor.scroll);
        await driver.executeScript("arguments[0].scrollBy(0, 5000)", el);
    };

    /**
     * Verifies if a new prompt exists on the DB Editor
     * @param driver The webdriver
     * @returns A promise resolving with true if exists, false otherwise
     */
    public static hasNewPrompt = async (driver: WebDriver): Promise<boolean> => {
        let text: String;
        try {
            await DBConnection.promptScrollDown(driver);
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
     * Returns the latest html query result id
     * This function is useful to verify later if a new result id is displayed, after a query
     * @param driver The webdriver
     * @returns A promise resolving with the Id
     */
    public static getLastQueryResultId = async (driver: WebDriver): Promise<number> => {
        const zoneHosts = await driver.findElements(locator.notebook.codeEditor.editor.result.exists);
        if (zoneHosts.length > 0) {
            const zones = await driver.findElements(locator.notebook.codeEditor.editor.result.exists);

            return parseInt((await zones[zones.length - 1].getAttribute("monaco-view-zone")).match(/\d+/)![0], 10);
        } else {
            return 0;
        }
    };

    /**
     * Returns the result after executing a script, on the DB Editor
     * @param driver The webdriver
     * @param timeout wait
     * @returns A promise resolving with the result
     */
    public static getScriptResult = async (driver: WebDriver, timeout = explicitWait): Promise<string> => {
        let toReturn = "";
        await driver.wait(async () => {
            try {
                const resultHost = await driver.findElements(locator.notebook.codeEditor.editor.result.host);
                if (resultHost.length > 0) {
                    const content = await resultHost[0]
                        .findElements(locator.notebook.codeEditor.editor.result.anyResult);

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
     * @param driver The webdriver
     * @param item Item name
     * @returns A promise resolving when the click is made
     */
    public static clickAdminItem = async (driver: WebDriver, item: string): Promise<void> => {
        const els = await driver.wait(until.elementsLocated(locator.notebook.explorerHost.administration.itemToClick),
            explicitWait, "Admin section not found");
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
     * @param driver The webdriver
     * @returns A promise resolving with the editor
     */
    public static getCurrentEditor = async (driver: WebDriver): Promise<string> => {
        const selector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
        const label = await selector.findElement(locator.htmlTag.label);

        return label.getText();
    };

    /**
     * Selects an Editor from the drop down list, on the DB Editor
     * @param driver The webdriver
     * @param editor The editor
     * @returns A promise resolving when the select is made
     */
    public static selectEditor = async (driver: WebDriver, editor: string): Promise<void> => {
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
     * Opens a new notebook
     * @param driver The webdriver
     * @returns Promise resolving when the new notebook is opened
     *
     */
    public static openNewNotebook = async (driver: WebDriver): Promise<void> => {
        await driver.wait(async () => {
            try {
                await driver.executeScript(
                    "arguments[0].click()",
                    await driver.findElement(locator.notebook.explorerHost.openEditors.addConsole),
                );

                const input = await driver.wait(until.elementLocated(locator.notebook.explorerHost.openEditors.textBox),
                    explicitWait, "Editor host input was not found");

                await input.sendKeys(Key.ESCAPE);

                return true;
            } catch (e) {
                if (!(e instanceof error.ElementNotInteractableError)) {
                    throw e;
                }
            }
        }, explicitWait, "Add console or the input were not interactable");
    };

}
