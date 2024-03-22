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

import fs from "fs/promises";
import { join } from "path";
import { Logs, logging } from "selenium-webdriver";
import { driver } from "../lib/driver.js";
import { platform } from "os";

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

export class Os {

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
        if (await this.fileExists(join(process.cwd(), feLog))) {
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
     * Reads and returns the content of the clipboard
     * @returns A promise revolved with the clipboard content
     */
    public static readClipboard = async (): Promise<string> => {
        return driver.executeScript("return await navigator.clipboard.readText()");
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
        const fileContent = await fs.readFile(mysqlSh);

        return fileContent.toString().match(/Error: Failed to initialize the default helper/) === null;
    };

    /**
     * Verifies if the current os is macos
     * @returns A promise resolving with true if the current os is macos, false otherwise
     */
    public static isMacOs = (): boolean => {
        return platform() === "darwin";
    };
}
