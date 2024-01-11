/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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
import { WebElement, Key } from "vscode-extension-tester";
import { keyboard, Key as nutKey } from "@nut-tree/nut-js";
import clipboard from "clipboardy";
import { existsSync } from "fs";
import { spawnSync, execSync } from "child_process";
import fs from "fs/promises";
import { platform } from "os";
import { join } from "path";
import * as constants from "./constants";
import { driver, Misc } from "./misc";


/**
 * This class aggregates the functions that perform operating system related operations
 */
export class Os {

    /**
     * Verifies if the current os is Linux
     * @returns A promise resolving with true if the current os is linux, false otherwise
     */
    public static isLinux = (): boolean => {
        return platform() === "linux";
    };

    /**
     * Verifies if the current os is macos
     * @returns A promise resolving with true if the current os is macos, false otherwise
     */
    public static isMacOs = (): boolean => {
        return platform() === "darwin";
    };

    /**
     * Verifies if the current os is windows
     * @returns A promise resolving with true if the current os is windows, false otherwise
     */
    public static isWindows = (): boolean => {
        return platform() === "win32";
    };

    /**
     * Writes the router configuration file with the desired configurations
     * @param options The options
     * @returns A promise resolving when the configuration file is set
     */
    public static setRouterConfigFile = async (options: { [key: string]: string }): Promise<void> => {
        const keys = Object.keys(options);
        const configFile = Os.getRouterConfigFile();
        const file = await fs.readFile(configFile);
        const fileLines = file.toString().split("\n");
        for (let i = 0; i <= fileLines.length - 1; i++) {
            for (const key of keys) {
                if (fileLines[i].includes(key)) {
                    fileLines[i] = `${key}=${options[key]}`;
                }
            }
        }

        let text = "";
        for (const line of fileLines) {
            text += `${line}\n`;
        }

        await fs.writeFile(configFile, text);
    };

    /**
     * Deletes all credentials for database access using shell
     * @returns A promise resolving when the credetials are deleted
     */
    public static deleteCredentials = async (): Promise<void> => {
        const params = ["--js", "-e", "shell.deleteAllCredentials()"];
        let extDir = join(constants.workspace, `ext-${String(process.env.TEST_SUITE)}`);
        if (!existsSync(extDir)) {
            extDir = join(process.env.TEST_RESOURCES_PATH, `test-resources`, "ext");
        }
        const items = await fs.readdir(extDir);
        let extDirName = "";
        for (const item of items) {
            if (item.includes("oracle")) {
                extDirName = item;
                break;
            }
        }
        const mysqlsh = join(extDir, extDirName, "shell", "bin", "mysqlsh");
        spawnSync(mysqlsh, params);
    };

    /**
     * Gets the extension output logs folder
     * @returns A promise resolving with the location of the logs folder
     */
    public static getExtentionOutputLogsFolder = async (): Promise<string> => {
        let testResources: string;
        for (let i = 0; i <= process.argv.length - 1; i++) {
            if (process.argv[i] === "-s") {
                testResources = process.argv[i + 1];
                break;
            }
        }

        const today = new Date();
        const month = (`0${(today.getMonth() + 1)}`).slice(-2);
        const day = (`0${today.getDate()}`).slice(-2);
        const todaysDate = `${today.getFullYear()}${month}${day}`;

        let pathToLog = join(
            testResources,
            "settings",
            "logs",
        );
        const variableFolder = await fs.readdir(pathToLog);
        pathToLog = join(
            testResources,
            "settings",
            "logs",
            variableFolder[0],
            "window1",
            "exthost",
        );
        const folders = await fs.readdir(pathToLog);
        let outputLogging: string;
        for (const folder of folders) {
            if (folder.startsWith(`output_logging_${todaysDate}`)) {
                outputLogging = folder;
                break;
            }
        }
        pathToLog = join(
            testResources,
            "settings",
            "logs",
            variableFolder[0],
            "window1",
            "exthost",
            outputLogging,
        );

        return pathToLog;
    };

    /**
     * Prepares the extension logs to be exported on jenkins, by renaming the log files according with the test suite
     * @param testSuite The test suite
     * @returns A promise resolving when the logs are prepared
     */
    public static prepareExtensionLogsForExport = async (testSuite: string): Promise<void> => {
        const logPathFolder = await Os.getExtentionOutputLogsFolder();
        try {
            // rename the file
            await fs.rename(join(logPathFolder, constants.feLogFile),
                join(logPathFolder, `${testSuite}_output_tab.log`));
            // copy to workspace
            await fs.copyFile(join(logPathFolder, `${testSuite}_output_tab.log`),
                join(constants.workspace, `${testSuite}_output_tab.log`));
        } catch (e) {
            // continue
        }

    };

    /**
     * Kills the router process from the command line terminal
     */
    public static killRouterFromTerminal = (): void => {
        if (Os.isWindows()) {
            try {
                execSync("taskkill /f /im mysqlrouter.exe");
            } catch (e) {
                if (!String(e).includes(`ERROR: The process "mysqlrouter.exe" not found`)) {
                    throw e;
                }
            }
        } else {
            spawnSync("killall", ["-9", "mysqlrouter"]);
        }
    };

    /**
     * Gets the location of the router configuration file
     * @returns A promise resolving with the location of the router configuration file
     */
    public static getRouterConfigFile = (): string => {
        return join(process.env.TEST_RESOURCES_PATH, `mysqlsh-${process.env.TEST_SUITE}`,
            "plugin_data", "mrs_plugin", "router_configs", "1", "mysqlrouter", "mysqlrouter.conf");
    };

    /**
     * Gets the location of the router log file
     * @returns A promise resolving with the location of the router log file
     */
    public static getRouterLogFile = async (): Promise<string> => {
        const routerConfigFilePath = Os.getRouterConfigFile();
        const fileContent = (await fs.readFile(routerConfigFilePath)).toString();

        return join(fileContent.match(/logging_folder=(.*)/)[1], "mysqlrouter.log");
    };

    /**
     * Gets the location of the mysqlsh log file
     * @returns A promise resolving with the location of the mysqlsh log file
     */
    public static getMysqlshLog = (): string => {
        if (process.env.TEST_SUITE !== undefined) {
            return join(process.env.TEST_RESOURCES_PATH, `mysqlsh-${String(process.env.TEST_SUITE)}`, "mysqlsh.log");
        } else {
            throw new Error("TEST_SUITE env variable is not defined");
        }
    };

    /**
     * Presses CTRL+A
     * @param el The element to perform the action on
     * @returns A promise resolving when the command is executed
     */
    public static keyboardSelectAll = async (el: WebElement): Promise<void> => {
        if (Os.isMacOs()) {
            await driver.executeScript("arguments[0].click()", el);
            await el.sendKeys(Key.chord(Key.COMMAND, "a"));
        } else {
            await driver.executeScript("arguments[0].click()", el);
            await el.sendKeys(Key.chord(Key.CONTROL, "a"));
        }
    };

    /**
     * Presses CTRL+C
     * @param el The element to perform the action on
     * @returns A promise resolving when the command is executed
     */
    public static keyboardCopy = async (el?: WebElement): Promise<void> => {
        await driver.wait(async () => {
            if (Os.isMacOs()) {
                await driver.executeScript("arguments[0].click()", el);
                await el.sendKeys(Key.chord(Key.COMMAND, "c"));
            } else {
                await driver.executeScript("arguments[0].click()", el);
                await el.sendKeys(Key.chord(Key.CONTROL, "c"));
            }

            return clipboard.readSync() !== "";
        }, constants.wait5seconds, `The clipboard is empty`);
    };

    /**
     * Presses CTRL+V
     * @param el The element to perform the action on
     * @returns A promise resolving when the command is executed
     */
    public static keyboardPaste = async (el?: WebElement): Promise<void> => {
        if (Os.isMacOs()) {
            await driver.executeScript("arguments[0].click()", el);
            await el.sendKeys(Key.chord(Key.COMMAND, "v"));
        } else {
            await driver.executeScript("arguments[0].click()", el);
            await el.sendKeys(Key.chord(Key.CONTROL, "v"));
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
            await el.sendKeys(Key.chord(Key.COMMAND, "X"));
        } else {
            await driver.executeScript("arguments[0].click()", el);
            await el.sendKeys(Key.chord(Key.CONTROL, "X"));
        }
    };

    /**
     * Right clicks on a tree element and select the desired item menu using the keyboard
     * @param item The element to perform the action on
     * @param map The map of the context menu elements
     * @returns A promise resolving when the command is executed
     */
    public static selectItemMacOS = async (item: string, map?: Map<string, number>): Promise<void> => {
        const taps = Misc.getValueFromMap(item, map);
        for (let i = 0; i <= taps - 1; i++) {
            await keyboard.type(nutKey.Down);
            await driver.sleep(50);
        }
        await keyboard.type(nutKey.Enter);
    };

    /**
     * Writes the mysqlsh logs into the console
     * @returns A promise resolving when the logs are written
     */
    public static writeMySQLshLogs = async (): Promise<void> => {
        const text = await fs.readFile(Os.getMysqlshLog());
        console.log(text.toString());
    };

    /**
     * Finds a text on the mysqlsh logs
     * @param textToFind The text
     * @returns A promise resolving with true if the text is found, false otherwise
     */
    public static findOnMySQLShLog = async (textToFind: RegExp[] | RegExp): Promise<boolean> => {
        const text = await fs.readFile(Os.getMysqlshLog());
        if (Array.isArray(textToFind)) {
            for (const rex of textToFind) {
                if (text.toString().match(rex) === null) {
                    return false;
                }
            }

            return true;
        } else {
            return text.toString().match(textToFind) !== null;
        }
    };

}
