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


import { existsSync } from "fs";
import { spawnSync } from "child_process";
import { appendFile, readFile, writeFile } from "fs/promises";
import { platform } from "os";
import { join } from "path";
import { Logs, logging, WebElement, Key, error } from "selenium-webdriver";
import * as constants from "./constants.js";
import * as locators from "./locators.js";
import { driver } from "../lib/driver.js";

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
    ["notifications.spec.ts", 3],
]);

export class Os {

    /**
     * Writes the FE logs to a file
     *
     * @param testName Name of the test
     * @param content Logs content
     * @returns A promise resolving when the logs are written
     */
    public static writeFELogs = async (testName: string, content: Logs): Promise<void> => {

        if (existsSync(join(process.cwd(), feLog))) {
            await appendFile(feLog, `\n---- ${testName} ------`);
        } else {
            await writeFile(feLog, `---- ${testName} -----\n`);
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
                await appendFile(feLog, line);
            }
        }
    };

    /**
     * Reads and returns the content of the clipboard
     * @returns A promise revolved with the clipboard content
     */
    public static readClipboard = async (): Promise<string | undefined> => {
        try {
            return driver.executeScript("return await navigator.clipboard.readText()");
        } catch (e) {
            if (e instanceof error.JavascriptError) {
                return constants.jsError;
            }
        }
    };

    /**
     * Gets the clipboard content and applies the following rules:
     * - Removes all line breaks (\n characters)
     * - Removes hours, minutes and seconds (useful for clipboard content coming from result grids)
     * @returns A promise resolving with the clipboard content as a string or array of string, if there are line breaks
     */
    public static getClipboardContent = async (): Promise<string | string[] | undefined> => {
        let content: string[] | string | undefined;

        await driver.wait(async () => {
            try {
                const clipboardData = (await this.readClipboard())!.split("\n").filter((item) => { return item; });
                const replacers = [/\n/, / (\d+):(\d+):(\d+)/];

                if (clipboardData.length > 1) {
                    for (let i = 0; i <= clipboardData.length - 1; i++) {
                        for (const replacer of replacers) {
                            clipboardData[i] = clipboardData[i].replace(replacer, "").trim();
                        }
                    }

                    content = clipboardData;

                    return true;
                } else {
                    for (const replacer of replacers) {
                        clipboardData[0] = clipboardData[0].replace(replacer, "").trim();
                    }

                    content = clipboardData;[0];

                    return true;
                }
            } catch (e) {
                console.log(e);
                if (!(e instanceof error.JavascriptError)) {
                    throw e;
                }
            }
        }, constants.wait3seconds);

        return content;
    };

    /**
     * Writes content to the clipboard
     * @param text The text to write
     * @returns A promise revolved when the clipboard ir written
     */
    public static writeToClipboard = async (text: string): Promise<string> => {
        return driver.executeScript(`return await navigator.clipboard.writeText('${text}')`);
    };

    /**
     * Checks if the credential helper exists/has errors
     * @returns A promise revolved with the existence of the credentials helper
     */
    public static existsCredentialHelper = async (): Promise<boolean> => {
        const mysqlSh = join(process.cwd(), "src", "tests", "e2e", "port_8000", "mysqlsh.log");
        const fileContent = await readFile(mysqlSh);

        return fileContent.toString().match(/Error: Failed to initialize the default helper/) === null;
    };

    /**
     * Verifies if the current os is macos
     * @returns A promise resolving with true if the current os is macos, false otherwise
     */
    public static isMacOs = (): boolean => {
        return platform() === "darwin";
    };

    /**
     * Verifies if the current os is linux
     * @returns A promise resolving with true if the current os is macos, false otherwise
     */
    public static isLinux = (): boolean => {
        return platform() === "linux";
    };

    /**
     * Presses CTRL+V
     * @param el The element to perform the action on
     * @returns A promise resolving when the command is executed
     */
    public static keyboardPaste = async (el?: WebElement): Promise<void> => {
        await driver.executeScript("arguments[0].click()", el);
        await driver.sleep(500);
        await el!.sendKeys(Key.chord(Os.isMacOs() ? Key.COMMAND : Key.CONTROL, "v"));
    };

    /**
     * Presses CTRL+A
     * @param el The element to perform the action on
     * @returns A promise resolving when the command is executed
     */
    public static keyboardSelectAll = async (el: WebElement): Promise<void> => {
        const key = Os.isMacOs() ? Key.COMMAND : Key.CONTROL;
        await driver.executeScript("arguments[0].click()", el);
        await el.sendKeys(Key.chord(key, "a"));
    };

    /**
     * Presses CTRL+C
     * @param el The element to perform the action on
     * @returns A promise resolving when the command is executed
     */
    public static keyboardCopy = async (el?: WebElement): Promise<void> => {
        const key = Os.isMacOs() ? Key.COMMAND : Key.CONTROL;

        await driver.wait(async () => {
            if (el) {
                await driver.executeScript("arguments[0].click()", el);
                await el.sendKeys(Key.chord(key, "c"));
            } else {
                await driver.actions().keyDown(key).sendKeys("c").keyUp(key).perform();
            }

            return (await this.readClipboard()) !== "";
        }, constants.wait5seconds, `The clipboard is empty`);
    };

    /**
     * Selects and deletes the current line text
     * @param line The line to delete
     */
    public static keyboardDeleteLine = async (line: string): Promise<void> => {
        const textArea = await driver.findElement(locators.notebook.codeEditor.textArea);
        const letters = line.split("");

        for (let i = 0; i <= letters.length + 3; i++) {
            await textArea.sendKeys(Key.BACK_SPACE);
            await driver.sleep(50);
        }
    };

    /**
     * Presses CTRL+X
     * @param el The element to perform the action on
     * @returns A promise resolving when the command is executed
     */
    public static keyboardCut = async (el?: WebElement): Promise<void> => {
        if (Os.isMacOs()) {
            await driver.executeScript("arguments[0].click()", el);
            await el!.sendKeys(Key.chord(Key.COMMAND, "X"));
        } else {
            await driver.executeScript("arguments[0].click()", el);
            await el!.sendKeys(Key.chord(Key.CONTROL, "X"));
        }
    };

    /**
     * Deletes all credentials for database access using shell
     */
    public static deleteShellCredentials = (): void => {
        const params = ["--js", "-e", "shell.deleteAllCredentials()"];
        const response = spawnSync("mysqlsh", params);

        if (response.status !== 0) {
            throw response.error;
        }
    };
}
