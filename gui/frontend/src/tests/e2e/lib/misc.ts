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

import { platform } from "os";
import fs from "fs/promises";
import { join } from "path";
import {
    until, Key, WebElement, WebDriver, error, Logs, logging,
} from "selenium-webdriver";
import { DBConnection } from "./dbConnection.js";
import { execFullBlockJs, execFullBlockSql } from "./dbNotebooks.js";
import * as locator from "../lib/locators.js";
import * as constants from "../lib/constants.js";
import { driver } from "../lib/driver.js";

export const explicitWait = 5000;
export const feLog = "fe.log";

export const shellServers = new Map([
    ["admin.spec.ts", 0],
    ["db_connections.spec.ts", 1],
    ["notebook.spec.ts", 1],
    ["scripts.spec.ts", 1],
    ["main.spec.ts", 0],
    ["guiconsole.spec.ts", 0],
    ["sessions.spec.ts", 2],
    ["shell_connections.spec.ts", 2],
]);

/**
 * DB Connection interface
 *
 */
export interface IDBConnection {
    dbType: string | undefined;
    caption: string;
    description: string;
    hostname: string;
    protocol: string;
    port: string;
    portX: string | undefined;
    username: string;
    password: string;
    schema: string;
    sslMode: string | undefined;
    sslCA: string | undefined;
    sslClientCert: string | undefined;
    sslClientKey: string | undefined;
}

export class Misc {

    /**
     * Checks if a file exists
     *
     * @param path to the file
     * @returns true if exists, false otherwise
     */
    public static fileExists = async (path: string): Promise<boolean> => {
        try {
            await fs.access(path);

            return true;
        } catch (e) {
            return false;
        }
    };

    /**
     * Writes the FE logs to a file
     *
     * @param testName Name of the test
     * @param content Logs content
     * @returns A promise resolving when the logs are written
     */
    public static writeFELogs = async (testName: string, content: Logs): Promise<void> => {
        if (await Misc.fileExists(join(process.cwd(), feLog))) {
            await fs.appendFile(feLog, `\n---- ${testName} ------`);
        } else {
            await fs.writeFile(feLog, `---- ${testName} -----\n`);
        }

        const logTypes = [
            logging.Type.BROWSER,
            logging.Type.DRIVER,
        ];
        let line = "";
        let logs: logging.Entry[];
        for (const logType of logTypes) {
            line = `---> ${logType}\n`;
            logs = await content.get(logType);
            for (const log of logs) {
                const date = new Date(log.timestamp);
                let time = `${date.getDate()}-${date.getMonth()}-${date.getFullYear()} `;
                time += `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
                line += `\n${time} [${String(log.level)}] ${log.message}`;
                await fs.appendFile(feLog, line);
            }
        }
    };

    /**
     * Waits until a page loads
     *
     * @param filename filename of the test suite
     * @returns A promise resolving when the url is set
     */
    public static getUrl = (filename: string): string => {
        let url = process.env.SHELL_UI_HOSTNAME;
        if (process.env.MAX_WORKERS) {
            const port = shellServers.get(filename);
            url += `:800${String(port)}/?token=${String(process.env.TOKEN)}`;
        } else {
            url += `:${String(process.env.HOSTNAME_PORT)}/?token=${String(process.env.TOKEN)}`;
        }

        return String(url);
    };

    /**
     * Waits until the homepage loads
     * @param url URL of the page
     * @param loginPage True if the home page is expected to be the login page, false otherwise
     * @returns A promise resolving when the page is loaded
     */
    public static waitForHomePage = async (url: string, loginPage = false): Promise<void> => {
        await driver.get(url);
        if (loginPage) {
            await driver.wait(until.elementLocated(locator.loginPage.sakilaLogo), 10000, "Sakila logo was not found");
        } else {
            await driver.wait(until.elementLocated(locator.mainActivityBar), 10000, "Activity bar was not found");
        }
    };

    /**
     * Returns the background color of the page
     * @param driver The webdriver
     * @returns Promise resolving to the background color
     */
    public static getBackgroundColor = async (driver: WebDriver): Promise<string> => {
        const script =
            "return window.getComputedStyle(document.getElementById('root')).getPropertyValue('--background'); ";

        return driver.executeScript(script);
    };

    /**
     * Press the combination keys to execute a statement on the DB Editor or Shell session (CTRL+ENTER)
     * @param driver The webdriver
     * @returns Promise resolving when the key combination is pressed
     */
    public static pressEnter = async (driver: WebDriver): Promise<void> => {
        if (platform() === "darwin") {
            await driver
                .actions()
                .keyDown(Key.COMMAND)
                .keyDown(Key.ENTER)
                .keyUp(Key.COMMAND)
                .keyUp(Key.ENTER)
                .perform();
        } else {
            await driver
                .actions()
                .keyDown(Key.CONTROL)
                .keyDown(Key.ENTER)
                .keyUp(Key.CONTROL)
                .keyUp(Key.ENTER)
                .perform();
        }
    };

    /**
     * Writes an SQL query and executes it
     * @param driver The webdriver
     * @param textArea text area to send the query
     * @param cmd command to execute
     * @param timeout wait for results
     * @param useBtn use exec button on toolbar
     * @param slowWriting write the cmd as a human
     * @returns Promise resolving when the command is executed
     */
    public static execCmd = async (
        driver: WebDriver,
        textArea: WebElement,
        cmd: string,
        timeout?: number,
        useBtn?: boolean,
        slowWriting = false,
    ): Promise<void> => {
        cmd = cmd.replace(/(\r\n|\n|\r)/gm, "");
        const prevBlocks = await driver.findElements(locator.notebook.codeEditor.editor.result.exists);
        if (slowWriting === true) {
            const items = cmd.split("");
            for (const item of items) {
                await textArea.sendKeys(item);
                await driver.sleep(20);
            }
        } else {
            await textArea.sendKeys(cmd);
        }
        await textArea.sendKeys(Key.ESCAPE);
        if (cmd.indexOf("\\") !== -1) {
            const codeMenu = await driver.findElements(locator.notebook.codeEditor.suggestionsMenu);
            if (codeMenu.length > 0) {
                await textArea.sendKeys(Key.ENTER);
            }
        }

        if (useBtn) {
            try {
                await (
                    await DBConnection.getToolbarButton(execFullBlockSql))!.click();

            } catch (e) {
                if (String(e).includes("Could not find button")) {
                    await (
                        await DBConnection.getToolbarButton(execFullBlockJs))!.click();
                }
            }

        } else {
            await Misc.pressEnter(driver);
        }


        if (!timeout) {
            timeout = 10000;
        }

        if (cmd.match(/(\\js|\\javascript|\\ts|\\typescript|\\sql|\\q|\\d)/) === null) {
            await driver.wait(async () => {
                const blocks = await driver.findElements(locator.notebook.codeEditor.editor.result.exists);
                if (prevBlocks.length > 0) {
                    if (blocks.length > 0) {
                        const viewZone = await blocks[blocks.length - 1].getAttribute("monaco-view-zone");
                        let prevViewZone = "";
                        try {
                            prevViewZone = await prevBlocks[prevBlocks.length - 1].getAttribute("monaco-view-zone");
                        } catch (e) {
                            if (!(e instanceof error.StaleElementReferenceError)) {
                                throw e;
                            }
                        }

                        return blocks.length > prevBlocks.length || viewZone !== prevViewZone;
                    }
                } else {
                    return blocks.length > prevBlocks.length;
                }
            }, timeout, "Command '" + cmd + "' did not triggered a new results block");
        }
    };

    /**
     * Returns the css computed style of an element
     * @param element The Element
     * @param style The style
     * @returns A promise resolving with the element style
     */
    public static getElementStyle = async (element: WebElement, style: string): Promise<string> => {
        return driver.executeScript("return window.getComputedStyle(arguments[0])." + style, element);
    };

    /**
     * Converts and RGB code to hex
     *
     * @param r value
     * @param g value
     * @param b value
     * @returns A promise resolving with the hex value
     */
    public static rgbToHex = (r: string, g: string, b: string): string => {

        const componentToHex = (c: number) => {
            const hex = c.toString(16);

            return hex.length === 1 ? "0" + hex : hex;
        };

        const result = "#" + componentToHex(parseInt(r, 10)) +
            componentToHex(parseInt(g, 10)) + componentToHex(parseInt(b, 10));

        return result.toUpperCase();
    };

    /**
     * Sets the password for a connection, on the Password dialog
     * @param dbConfig connection object
     * @returns A promise resolving when the password is set
     */
    public static setPassword = async (dbConfig: IDBConnection): Promise<void> => {
        const dialog = await driver.wait(until.elementsLocated(locator.passwordDialog.exists),
            500, "No Password dialog was found");

        const title = await dialog[0].findElement(locator.passwordDialog.title);
        const gridDivs = await dialog[0].findElements(locator.passwordDialog.items);

        let service;
        let username;
        for (let i = 0; i <= gridDivs.length - 1; i++) {
            if (await gridDivs[i].getText() === "Service:") {
                service = await gridDivs[i + 1].findElement(locator.passwordDialog.itemsText).getText();
            }
            if (await gridDivs[i].getText() === "User Name:") {
                username = await gridDivs[i + 1].findElement(locator.passwordDialog.itemsText).getText();
            }
        }

        expect(service).toBe(`${String(dbConfig.username)}@${String(dbConfig.hostname)}:${String(dbConfig.port)}`);
        expect(username).toBe(dbConfig.username);
        expect(await title.getText()).toBe("Open MySQL Connection");
        await dialog[0].findElement(locator.htmlTag.input).sendKeys(String(dbConfig.password));
        await dialog[0].findElement(locator.passwordDialog.ok).click();
    };

    /**
     * Sets the confirm dialog value, for a password storage
     * @param dbConfig connection object
     * @param value yes/no/never
     * @returns A promise resolving when the set is made
     */
    public static setConfirmDialog = async (dbConfig: IDBConnection, value: string):
        Promise<void> => {
        const confirmDialog = await driver.wait(until.elementsLocated(locator.confirmDialog.exists),
            explicitWait, "No confirm dialog was found");

        expect(await confirmDialog[0].findElement(locator.confirmDialog.title).getText()).toBe("Confirm");

        let text = `Save password for '${String(dbConfig.username)}@${String(dbConfig.hostname)}:`;
        text += `${String(dbConfig.port)}'?`;

        expect(await confirmDialog[0].findElement(locator.confirmDialog.message).getText()).toContain(text);

        const noBtn = await confirmDialog[0].findElement(locator.confirmDialog.refuse);
        const yesBtn = await confirmDialog[0].findElement(locator.confirmDialog.accept);
        const neverBtn = await confirmDialog[0].findElement(locator.confirmDialog.alternative);

        switch (value) {
            case "yes":
                await yesBtn.click();
                break;
            case "no":
                await noBtn.click();
                break;
            case "never":
                await neverBtn.click();
                break;
            default:
                break;
        }
    };

    /**
     * Inserts texts on an input box or other element, on a safer way (avoiding Stale Elements)
     * @param inputId html input id
     * @param type input/selectList/checkbox
     * @param value text to set
     * @returns A promise resolving with the set is made
     */
    public static setInputValue = async (inputId: string,
        type: string | undefined, value: string): Promise<void> => {
        let el = await driver.findElement(locator.searchById(inputId));
        const letters = value.split("");
        for (const letter of letters) {
            if (type) {
                el = await driver.findElement(locator.searchById(inputId)).findElement(locator.searchByCss(type));
            } else {
                el = await driver.findElement(locator.searchById(inputId));
            }
            await el.sendKeys(letter);
        }
    };

    /**
     * Returns the prompt text within a line, on the prompt
     * @param prompt last (last line), last-1 (line before the last line), last-2 (line before the 2 last lines)
     * @returns Promise resolving with the text on the selected line
     */
    public static getPromptTextLine = async (prompt: string): Promise<String> => {
        const context = await driver.findElement(locator.notebook.codeEditor.editor.exists);

        let position: number;
        let tags;
        switch (prompt) {
            case "last":
                position = 1;
                break;
            case "last-1":
                position = 2;
                break;
            case "last-2":
                position = 3;
                break;
            default:
                throw new Error("Error getting line");
        }

        let sentence = "";
        await driver.wait(async () => {
            try {
                const lines = await context.findElements(locator.notebook.codeEditor.editor.editorPrompt);
                const words = locator.htmlTag.mix(locator.htmlTag.span.value, locator.htmlTag.span.value);
                if (lines.length > 0) {
                    tags = await lines[lines.length - position].findElements(words);
                    for (const tag of tags) {
                        sentence += (await tag.getText()).replace("&nbsp;", " ");
                    }

                    return true;
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, explicitWait, "Elements were stale");

        return sentence;
    };

    /**
     * Removes all the existing text on the prompt
     * @returns A promise resolving when the clean is made
     */
    public static cleanPrompt = async (): Promise<void> => {
        const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
        if (platform() === "win32") {
            await textArea
                .sendKeys(Key.chord(Key.CONTROL, "a", "a"));
        } else if (platform() === "darwin") {
            await textArea
                .sendKeys(Key.chord(Key.COMMAND, "a", "a"));
        }
        await textArea.sendKeys(Key.BACK_SPACE);
        await driver.wait(async () => {
            return await Misc.getPromptTextLine("last") === "";
        }, 3000, "Prompt was not cleaned");
    };

    /**
     * Waits for the blue dot to appear on the editor current line, which indicates that the editor
     * is ready to receive queries
     * @param driver The webdriver
     * @returns A promise resolving when the blue dot (statement start) is displayed
     */
    public static waitForEditorToStart = async (driver: WebDriver): Promise<void> => {
        const word = "it";
        const letters = word.split("").length;
        const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
        const promptLines = await driver.findElements(locator.notebook.codeEditor.editor.line);
        await promptLines[promptLines.length - 1].click();

        await driver.wait(async () => {
            await textArea.sendKeys(word);
            for (let i = 0; i <= letters - 1; i++) {
                await textArea.sendKeys(Key.BACK_SPACE);
                await driver.sleep(500);
            }

            return (await driver.findElements(locator.notebook.codeEditor.editor.statementStart)).length > 1;
        }, 30000, "Editor did not started");

    };

    /**
     * Retrieves the name of the current test and returns it with some transformations applied.
     *
     * @returns The adjusted test name.
     */
    public static currentTestName(): string | undefined {
        return expect.getState().currentTestName?.toLowerCase().replace(/\s/g, "_");
    }

    /**
     * Takes a screen shot of the current browser window and stores it on disk.
     * @param name test name
     * @returns file path
     */
    public static async storeScreenShot(name?: string): Promise<string> {
        const img = await driver.takeScreenshot();
        let testName = "";
        if (!name) {
            testName = Misc.currentTestName() ?? "<unknown test>";
        } else {
            testName = name;
        }
        await fs.mkdir("src/tests/e2e/screenshots", { recursive: true });
        await fs.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");

        return `screenshots/${testName}_screenshot.png`;
    }

    /**
     * Clears an input field
     * @param el The element
     * @returns A promise resolving when the field is cleared
     */
    public static clearInputField = async (el: WebElement): Promise<void> => {

        await driver.wait(async () => {
            await driver.executeScript("arguments[0].click()", el);
            if (platform() === "darwin") {
                await el.sendKeys(Key.chord(Key.COMMAND, "a"));
            } else {
                await el.sendKeys(Key.chord(Key.CONTROL, "a"));
            }
            await el.sendKeys(Key.BACK_SPACE);

            return (await el.getAttribute("value")).length === 0;
        }, constants.wait5seconds, `${await el.getId()} was not cleaned`);
    };

    /**
     * Transforms a given string into a string with escaped characters to be used as regex
     * @param value The word
     *  @returns A regex with escaped characters
     */
    public static transformToMatch = (value: string): RegExp => {
        const regex = value
            .replace(/\*/g, "\\*")
            .replace(/\./g, ".*")
            .replace(/;/g, ".*")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)")
            .replace(/\{/g, "\\{")
            .replace(/\}/g, "\\}")
            .replace(/\s/g, ".*");

        return new RegExp(regex);
    };

    /**
     * Gets the index of a column, from a table
     * @param tableName The table
     * @param columnName The column name
     *  @returns The index of the column
     */
    public static getDbTableColumnIndex = (tableName: string, columnName: string): number => {
        let index: number | undefined;
        for (const table of constants.dbTables) {
            if (table.name === tableName) {
                index = table.columns.indexOf(columnName);
                break;
            }
        }
        if (index === undefined) {
            throw new Error(`Could not find index on table '${tableName}' and column '${columnName}'`);
        } else {
            return index;
        }
    };

    /**
     * Converts a time to a 12h time string (AM/PM)
     * @param time The time
     * @returns The converted time
     */
    public static convertTimeTo12H = (time: string): string => {
        const timeString12hr = new Date("1970-01-01T" + time + "Z")
            .toLocaleTimeString("en-US",
                { timeZone: "UTC", hour12: true, hour: "numeric", minute: "numeric", second: "numeric" },
            );

        return timeString12hr;
    };

    /**
     * Converts a date to ISO format
     * @param date The date
     * @returns The converted date
     */
    public static convertDateToISO = (date: string): string => {
        const toReturn = new Date(date).toISOString();
        const splitted = toReturn.split("T");

        return `${splitted[0]} ${splitted[1].replace(":00.000Z", "")}`;
    };

    /**
     * Reads and returns the content of the clipboard
     * @returns A promise revolved with the clipboard content
     */
    public static readClipboard = async (): Promise<string> => {
        return driver.executeScript("return await navigator.clipboard.readText()");
    };
}
