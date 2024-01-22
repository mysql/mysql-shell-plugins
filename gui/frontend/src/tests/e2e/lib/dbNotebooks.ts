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

import { until, WebElement, Key, error, WebDriver } from "selenium-webdriver";
import { explicitWait, IDBConnection } from "./misc.js";
import * as locator from "../lib/locators.js";

export const execFullBlockSql = "Execute the selection or everything in the current block and create a new block";
export const execFullBlockJs = "Execute everything in the current block and create a new block";
export const execCaret = "Execute the statement at the caret position";
export const execFullScript = "Execute full script";
export const find = "Find";
export const rollback = "Rollback DB changes";
export const commit = "Commit DB changes";
export const autoCommit = "Auto commit DB changes";
export const saveNotebook = "Save this Notebook";

export class DBNotebooks {

    /**
     * Selects the database type on the Database Connection Configuration dialog
     * @param driver The webdriver
     * @param value database type
     * @returns Promise resolving when the select is made
     */
    public static selectDBType = async (driver: WebDriver, value: string): Promise<void> => {
        await driver.findElement(locator.databaseConnectionConfiguration.databaseType.exists).click();
        const dropDownList = await driver.findElement(locator.databaseConnectionConfiguration.databaseType.list);
        const els = await dropDownList.findElements(locator.htmlTag.div);
        if (els.length > 0) {
            await dropDownList.findElement(locator.searchById(value)).click();
        }
    };

    /**
     * Selects the protocol on the Database Connection Configuration dialog
     * @param driver The webdriver
     * @param value protocol
     * @returns Promise resolving when the select is made
     */
    public static setProtocol = async (driver: WebDriver, value: string): Promise<void> => {
        await driver.findElement(locator.databaseConnectionConfiguration.mysql.basic.protocol.exists).click();
        const dropDownList = await driver
            .findElement(locator.databaseConnectionConfiguration.mysql.basic.protocol.list);
        await dropDownList.findElement(locator.searchById(value)).click();
    };

    /**
     * Selects the SSL Mode on the Database Connection Configuration dialog
     * @param driver The webdriver
     * @param value SSL Mode
     * @returns Promise resolving when the select is made
     */
    public static setSSLMode = async (driver: WebDriver, value: string): Promise<void> => {
        await driver.findElement(locator.databaseConnectionConfiguration.mysql.ssl.mode).click();
        const dropDownList = await driver
            .findElement(locator.databaseConnectionConfiguration.mysql.ssl.modeList.exists);
        await dropDownList.findElement(locator.searchById(value)).click();
    };

    /**
     * Creates a new database connection, from the DB Editor main page.
     * It verifies that the Connection dialog is closed, at the end.
     * @param driver The webdriver
     * @param dbConfig SSL Mode
     * @returns Promise resolving with the connection created
     */
    public static createDBconnection = async (driver: WebDriver, dbConfig: IDBConnection):
        Promise<WebElement | undefined> => {
        const ctx = await driver.wait(until.elementLocated(locator.dbConnections.browser),
            explicitWait, "DB Connection Overview page was not loaded");

        await driver.wait(async () => {
            const isDialogVisible = (await driver.findElements(locator.databaseConnectionConfiguration.exists))
                .length > 0;
            if (isDialogVisible) {
                return true;
            } else {
                try {
                    await ctx.findElement(locator.dbConnections.newConnection).click();
                } catch (e) {
                    if (!(e instanceof error.ElementClickInterceptedError)) {
                        throw e;
                    }
                }

                return false;
            }
        }, explicitWait, "Connection dialog was not displayed");

        const newConDialog = await driver.findElement(locator.databaseConnectionConfiguration.exists);

        await driver.wait(async () => {
            await newConDialog.findElement(locator.databaseConnectionConfiguration.caption).clear();

            return !(await driver.executeScript("return document.querySelector('#caption').value"));
        }, 3000, "caption was not cleared in time");
        await newConDialog.findElement(locator.databaseConnectionConfiguration.caption).sendKeys(dbConfig.caption);
        await newConDialog.findElement(locator.databaseConnectionConfiguration.description).clear();
        await newConDialog
            .findElement(locator.databaseConnectionConfiguration.description)
            .sendKeys(dbConfig.description);
        await newConDialog.findElement(locator.databaseConnectionConfiguration.mysql.basic.hostname).clear();
        await newConDialog.findElement(locator.databaseConnectionConfiguration.mysql.basic.hostname)
            .sendKeys(String(dbConfig.hostname));
        await DBNotebooks.setProtocol(driver, dbConfig.protocol);
        await driver.findElement(locator.databaseConnectionConfiguration.mysql.basic.port).clear();
        await driver.findElement(locator.databaseConnectionConfiguration.mysql.basic.port)
            .sendKeys(String(dbConfig.port));
        await newConDialog.findElement(locator.databaseConnectionConfiguration.mysql.basic.username)
            .sendKeys(String(dbConfig.username));
        await newConDialog
            .findElement(locator.databaseConnectionConfiguration.mysql.basic.schema)
            .sendKeys(String(dbConfig.schema));

        if (dbConfig.dbType) {
            await DBNotebooks.selectDBType(driver, dbConfig.dbType);
        }

        if (dbConfig.sslMode) {
            await newConDialog.findElement(locator.databaseConnectionConfiguration.sslTab).click();
            await newConDialog.findElement(locator.databaseConnectionConfiguration.mysql.ssl.mode).click();
            const dropDownList = await driver
                .findElement(locator.databaseConnectionConfiguration.mysql.ssl.modeList.exists);
            await dropDownList.findElement(locator.searchById(dbConfig.sslMode)).click();
            expect(await newConDialog
                .findElement(locator.databaseConnectionConfiguration.mysql.ssl.modeLabel).getText())
                .toBe(dbConfig.sslMode);

            const certsPath = process.env.SSLCERTSPATH as string;
            const paths = await newConDialog.findElements(locator.databaseConnectionConfiguration.mysql.ssl.inputs);
            await paths[0].sendKeys(`${certsPath}/ca-cert.pem`);
            await paths[1].sendKeys(`${certsPath}/client-cert.pem`);
            await paths[2].sendKeys(`${certsPath}/client-key.pem`);
        }

        const okBtn = await driver.findElement(locator.databaseConnectionConfiguration.ok);
        await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
        await okBtn.click();
        expect((await driver.findElements(locator.databaseConnectionConfiguration.exists)).length).toBe(0);

        return driver.wait(async () => {
            const connections = await driver.findElements(locator.dbConnections.connections.item);
            for (const connection of connections) {
                const el = await connection.findElement(locator.dbConnections.connections.caption);
                if ((await el.getAttribute("innerHTML")).includes(dbConfig.caption)) {
                    return connection;
                }
            }
        }, explicitWait, `'${dbConfig.caption}' was not created`);
    };

    /**
     * Returns the WebElement that represents the DB Connection, on the DB Connection main page
     * Throws an exception if not found.
     * @param driver The webdriver
     * @param name Connection caption
     * @returns @returns Promise resolving with the DB Connection
     */
    public static getConnection = async (driver: WebDriver, name: string): Promise<WebElement | undefined> => {

        return driver.wait(async () => {
            const connections = await driver.findElements(locator.dbConnections.connections.item);
            for (const connection of connections) {
                const el = await connection.findElement(locator.dbConnections.connections.caption);
                if ((await el.getAttribute("innerHTML")).includes(name)) {
                    return connection;
                }
            }
        }, 1500, "Could not find any connection");

    };

    public static clickConnectionItem = async (driver: WebDriver, conn: WebElement, item: string): Promise<void> => {
        const moreActions = await conn.findElement(locator.dbConnections.connections.actions.moreActions);
        const moreActionsRect = await moreActions.getRect();
        await driver.actions().move({
            x: parseInt(`${moreActionsRect.x}`, 10),
            y: parseInt(`${moreActionsRect.y}`, 10),
        }).perform();
        switch (item) {
            case "notebook": {
                await conn.findElement(locator.dbConnections.connections.actions.newNotebook).click();
                break;
            }
            case "script": {
                await conn.findElement(locator.dbConnections.connections.actions.newScript).click();
                break;
            }
            case "edit": {
                await moreActions.click();
                await driver.wait(until.elementLocated(locator.dbConnections.connections.actions.edit),
                    explicitWait, "Edit button not found").click();
                break;
            }
            case "duplicate": {
                await moreActions.click();
                await driver.wait(until.elementLocated(locator.dbConnections.connections.actions.duplicate),
                    explicitWait, "Duplicate button not found").click();
                break;
            }
            case "remove": {
                await moreActions.click();
                await driver.wait(until.elementLocated(locator.dbConnections.connections.actions.remove),
                    explicitWait, "Remove button not found").click();
                break;
            }
            default: {
                break;
            }
        }
    };

    /**
     * Returns the autocomplete context item list
     * @param driver The webdriver
     * @returns A promise resolving when the list is fulfilled
     */
    public static getAutoCompleteMenuItems = async (driver: WebDriver): Promise<string[]> => {
        const els = [];
        let items = await driver.wait(until.elementsLocated(locator.notebook.codeEditor.autoCompleteItems),
            explicitWait, "Auto complete items were not displayed");

        for (const item of items) {
            els.push(await item.getText());
        }

        await driver.actions().sendKeys(Key.ARROW_UP).perform();

        items = await driver.wait(until.elementsLocated(locator.notebook.codeEditor.autoCompleteItems),
            explicitWait, "Auto complete items were not displayed");

        for (const item of items) {
            els.push(await item.getText());
        }

        return [...new Set(els)];
    };

    /**
     * Gets the line number where the mouse cursor is
     * @param driver The webdriver
     * @returns A promise resolving with the line number
     */
    public static getMouseCursorLine = async (driver: WebDriver): Promise<number | undefined> => {
        const lines = await driver.findElements(locator.notebook.codeEditor.editor.cursorLine);
        for (let i = 0; i <= lines.length - 1; i++) {
            const curLine = await lines[i].findElements(locator.notebook.codeEditor.editor.currentLine);
            if (curLine.length > 0) {
                return i;
            }
        }
    };

    /**
     * Gets the line number where a word is found
     * @param driver The webdriver
     * @param wordRef The word
     * @returns A promise resolving with the line number
     */
    public static getLineFromWord = async (driver: WebDriver, wordRef: string): Promise<number> => {
        const regex = wordRef
            .replace(/\*/g, "\\*")
            .replace(/\./g, ".*")
            .replace(/;/g, ".*")
            .replace(/\s/g, ".*");
        let line;
        await driver.wait(async () => {
            try {
                const lines = await driver.findElements(locator.notebook.codeEditor.editor.editorPrompt);
                for (let i = 0; i <= lines.length - 1; i++) {
                    const lineContent = await lines[i].getAttribute("innerHTML");
                    if (lineContent.match(regex)) {
                        line = i;

                        return true;
                    }
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, explicitWait, "The lines were always stale");

        if (!line) {
            throw new Error(`Could not find the line of word ${wordRef}`);
        } else {
            return line;
        }
    };

    /**
     * Sets the mouse cursor at the editor line where the specified word is
     * @param driver The webdriver
     * @param word The word or command
     * @returns A promise resolving when the mouse cursor is placed at the desired spot
     */
    public static setMouseCursorAt = async (driver: WebDriver, word: string): Promise<void> => {
        const mouseCursorIs = await DBNotebooks.getMouseCursorLine(driver);
        const mouseCursorShouldBe = await DBNotebooks.getLineFromWord(driver, word);
        const taps = mouseCursorShouldBe - mouseCursorIs!;
        const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
        if (taps > 0) {
            for (let i = 0; i < taps; i++) {
                await textArea.sendKeys(Key.ARROW_DOWN);
                await driver.sleep(300);
            }
        } else if (taps < 0) {
            for (let i = 0; i < Math.abs(taps); i++) {
                await textArea.sendKeys(Key.ARROW_UP);
                await driver.sleep(300);
            }
        }
    };
}
