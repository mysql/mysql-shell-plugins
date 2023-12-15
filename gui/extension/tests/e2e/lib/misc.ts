/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

import { spawnSync, execSync } from "child_process";
import clipboard from "clipboardy";
import fs from "fs/promises";
import addContext from "mochawesome/addContext";
import { platform } from "os";
import { join } from "path";
import {
    EditorView, error, InputBox, ITimeouts,
    Key, OutputView, until, VSBrowser,
    WebDriver, NotificationType,
    WebElement, Workbench, Notification, TerminalView, EditorTab,
} from "vscode-extension-tester";
import * as constants from "./constants";
import { keyboard, Key as nutKey } from "@nut-tree/nut-js";
import * as waitUntil from "./until";
import * as locator from "./locators";
import * as interfaces from "./interfaces";
import { Section } from "./treeViews/section";
import { Tree } from "./treeViews/tree";
export let driver: WebDriver;
export let browser: VSBrowser;

export class Misc {

    public static isLinux = (): boolean => {
        return platform() === "linux";
    };

    public static isMacOs = (): boolean => {
        return platform() === "darwin";
    };

    public static isWindows = (): boolean => {
        return platform() === "win32";
    };

    public static insideIframe = async (): Promise<boolean> => {
        return driver.executeScript("return (window.location !== window.parent.location);");
    };

    public static setRouterConfig = async (options: { [key: string]: string }): Promise<void> => {
        const keys = Object.keys(options);
        const configFile = Misc.getRouterConfigFile();
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

    public static toggleBottomBar = async (expand: boolean): Promise<void> => {

        const bottombar = await driver.findElement(locator.bottomBarPanel.exists);
        const parent: WebElement = await driver.executeScript("return arguments[0].parentNode", bottombar);
        const parentClasses = (await parent.getAttribute("class")).split(" ");
        const isVisible = parentClasses.includes("visible");
        const closeBtn = await bottombar.findElement(locator.bottomBarPanel.close);

        if (isVisible) {
            if (expand === false) {
                await closeBtn.click();
            }
        } else {
            if (expand === true) {
                let output: WebElement;
                await driver.wait(async () => {
                    await driver.actions().sendKeys(Key.chord(Key.CONTROL, "j")).perform();
                    output = await bottombar.findElement(locator.bottomBarPanel.output);

                    return output.isDisplayed();
                }, constants.wait5seconds, "");
                await output.click();
            }
        }

    };

    public static pushDialogButton = async (buttonName: string): Promise<void> => {
        const dialogBox = await driver.wait(until.elementLocated(locator.dialogBox.exists),
            constants.wait5seconds, `Could not find dialog box`);
        const dialogButtons = await dialogBox.findElements(locator.dialogBox.buttons);
        for (const button of dialogButtons) {
            if (await button.getAttribute("title") === buttonName) {
                await button.click();

                return;
            }
        }
        throw new Error(`Could not find button ${buttonName}`);
    };

    public static restartShell = async (): Promise<void> => {
        const existsRootHost = async (): Promise<boolean> => {
            return (await driver.findElements(locator.contextMenu.exists)).length > 0;
        };

        const treeDBSection = await Section.getSection(constants.dbTreeSection);
        await driver.wait(waitUntil.sectionIsNotLoading(constants.dbTreeSection), constants.wait5seconds);
        await treeDBSection.click();
        const moreActions = await treeDBSection.findElement(locator.section.moreActions);
        await moreActions.click();

        if (Misc.isMacOs()) {
            await keyboard.type(nutKey.Right);
            await keyboard.type(nutKey.Enter);
        } else {
            const rootHost = await driver.findElement(locator.contextMenu.exists);
            const shadowRoot = await rootHost.getShadowRoot();
            const menu = await shadowRoot.findElement(locator.contextMenu.menuContainer);
            const menuItems = await menu.findElements(locator.contextMenu.menuItem);
            for (const item of menuItems) {
                if ((await item.getText()) === constants.restartInternalShell) {
                    await driver.wait(async () => {
                        try {
                            await item.click();

                            return (await existsRootHost()) === false;
                        } catch (e) {
                            if (e instanceof error.StaleElementReferenceError) {
                                return true;
                            }
                        }
                    }, constants.wait5seconds, "Could not click on Restart MySQL Shell");
                    break;
                }
            }
        }
        const notification = await Misc.getNotification("This will close all MySQL Shell tabs", false);
        await Misc.clickOnNotificationButton(notification, "Restart MySQL Shell");
        await driver.wait(async () => {
            return Misc.findOnMySQLShLog(/Info/);
        }, constants.wait5seconds * 3, "Shell server did not start");
    };

    public static cleanCredentials = async (): Promise<void> => {
        const params = ["--js", "-e", "shell.deleteAllCredentials()"];
        let extDir = join(constants.workspace, `ext-${String(process.env.TEST_SUITE)}`);
        try {
            await fs.access(extDir);
        } catch (e) {
            extDir = join(constants.basePath, `test-resources`, "ext");
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

    public static prepareExtensionLogsForExport = async (testSuite: string): Promise<void> => {
        const logPathFolder = await Misc.getExtentionOutputLogsFolder();
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

    public static killRouterFromTerminal = (): void => {
        if (Misc.isWindows()) {
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

    public static getRouterConfigFile = (): string => {
        return join(constants.basePath, `mysqlsh-${process.env.TEST_SUITE}`,
            "plugin_data", "mrs_plugin", "router_configs", "1", "mysqlrouter", "mysqlrouter.conf");
    };

    public static getRouterLogFile = async (): Promise<string> => {
        const routerConfigFilePath = Misc.getRouterConfigFile();
        const fileContent = (await fs.readFile(routerConfigFilePath)).toString();

        return join(fileContent.match(/logging_folder=(.*)/)[1], "mysqlrouter.log");
    };

    public static processFailure = async (testContext: Mocha.Context): Promise<void> => {

        await Misc.expandNotifications();
        const img = await driver.takeScreenshot();
        const testName = testContext.currentTest?.title ?? String(process.env.TEST_SUITE);
        const ssDir = join(process.cwd(), "../../../../", "screenshots");
        try {
            await fs.access(ssDir);
        } catch (e) {
            await fs.mkdir(ssDir);
        }
        const imgPath = join(ssDir, `${String(testName)}_screenshot.png`);
        await fs.writeFile(imgPath, img, "base64");

        addContext(testContext, { title: "Failure", value: `../screenshots/${String(testName)}_screenshot.png` });
    };

    public static switchToFrame = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                let visibleDiv: WebElement;
                await driver.wait(async () => {
                    const divs = await driver.findElements(locator.iframe.container);
                    for (const div of divs) {
                        const visibility = await div.getCssValue("visibility");
                        if (visibility.includes("visible")) {
                            visibleDiv = div;

                            return true;
                        }
                    }
                }, constants.wait5seconds, "Could not find a visible iframe div");
                const parentIframe = await visibleDiv.findElement(locator.iframe.exists);
                await driver.wait(waitUntil.webViewIsReady(parentIframe), constants.wait10seconds);
                await driver.wait(until.ableToSwitchToFrame(parentIframe),
                    constants.wait5seconds, "Could not enter the first iframe");
                const activeFrame = await driver.wait(until.elementLocated(locator.iframe.isActive),
                    constants.wait5seconds, "Web View content was not loaded");
                await driver.wait(until.ableToSwitchToFrame(activeFrame),
                    constants.wait5seconds, "Could not enter the active iframe");
                const iframe = await driver.findElements(locator.iframe.exists);
                if (iframe.length > 0) {
                    await driver.wait(until.ableToSwitchToFrame(iframe[0]),
                        constants.wait150MiliSeconds);
                    const deepestFrame = await driver.findElements(locator.iframe.exists);
                    if (deepestFrame.length > 0) {
                        await driver.executeScript("arguments[0].style.width='100%';", deepestFrame[0]);
                        await driver.executeScript("arguments[0].style.height='100%';", deepestFrame[0]);
                        await driver.executeScript("arguments[0].style.transform='scale(1)';", deepestFrame[0]);
                    }
                }

                return true;
            } catch (e: unknown) {
                if (e instanceof Error && e.message.includes("target frame detached")) {
                    throw e;
                }
            }
        }, constants.wait10seconds, "target frame detached");

    };

    public static isRouterInstalled = async (): Promise<boolean> => {
        if (Misc.isWindows()) {
            const dirFiles = await fs.readdir("C:/Program Files/MySQL");
            for (const item of dirFiles) {
                if (item.includes("MySQL Router")) {
                    return true;
                }
            }
        } else {
            let dirFiles = await fs.readdir("/usr/bin");
            for (const item of dirFiles) {
                if (item.includes("mysqlrouter")) {
                    return true;
                }
            }
            dirFiles = await fs.readdir("/usr/local/bin");
            for (const item of dirFiles) {
                if (item.includes("mysqlrouter")) {
                    return true;
                }
            }
        }
    };

    public static switchBackToTopFrame = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                await driver.switchTo().defaultContent();

                return true;
            } catch (e) {
                if (e instanceof Error && !e.message.includes("target frame detached")) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Could not switch back to top frame");
    };

    public static clearInputField = async (el: WebElement): Promise<void> => {
        await driver.wait(async () => {
            await el.clear();
            await el.click();
            if (Misc.isMacOs()) {
                await el.sendKeys(Key.chord(Key.COMMAND, "a"));
            } else {
                await el.sendKeys(Key.chord(Key.CONTROL, "a"));
            }
            await el.sendKeys(Key.BACK_SPACE);

            return (await el.getAttribute("value")).length === 0;
        }, constants.wait5seconds, `${await el.getId()} was not cleaned`);
    };

    public static getNotification = async (text: string, dismiss = true,
        expectFailure = false): Promise<Notification> => {
        let notif: Notification;
        const escapedText = text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

        await driver.wait(async () => {
            try {
                const ntfs = await new Workbench().getNotifications();
                for (const ntf of ntfs) {
                    if (expectFailure === false) {
                        if (await ntf.getType() === NotificationType.Error) {
                            throw new Error("An error has occurred");
                        }
                    }
                    if ((await ntf.getMessage()).match(new RegExp(escapedText)) !== null) {
                        notif = ntf;
                        if (dismiss) {
                            await Misc.dismissNotifications();
                        }

                        return true;
                    }
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not find '${text}' notification`);

        return notif;
    };

    public static clickOnNotificationButton = async (notification: Notification, button: string): Promise<void> => {
        await driver.wait(async () => {
            try {
                await notification.takeAction(button);

                return (await new Workbench().getNotifications()).length === 0;
            } catch (e) {
                if (e instanceof error.StaleElementReferenceError) {
                    return true;
                } else if (e instanceof error.ElementNotInteractableError) {
                    return false;
                } else {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not click on notification button '${button}'`);
    };

    public static dismissNotifications = async (): Promise<void> => {
        const ntfs = await new Workbench().getNotifications();
        for (const ntf of ntfs) {
            if (await ntf.hasProgress()) {
                await keyboard.type(nutKey.Escape);
            } else {
                await driver.wait(async () => {
                    try {
                        await ntf.dismiss();
                    } catch (e) {
                        if (e instanceof error.StaleElementReferenceError) {
                            return true;
                        } else {
                            if (e instanceof error.ElementNotInteractableError) {
                                return false;
                            } else {
                                throw e;
                            }
                        }
                    }

                    return (await new Workbench().getNotifications()).length === 0;
                }, constants.wait5seconds, "There are still notifications displayed");
            }
        }
    };

    public static execOnTerminal = async (cmd: string, timeout: number): Promise<void> => {
        timeout = timeout ?? constants.wait5seconds;

        if (Misc.isMacOs() || Misc.isLinux()) {
            await keyboard.type(cmd);
            await keyboard.type(nutKey.Enter);
        } else {
            const terminal = new TerminalView();
            await terminal.executeCommand(cmd, timeout);
        }

    };

    public static waitForTerminalText = async (textToSearch: string | string[],
        timeout: number): Promise<void> => {
        await driver.wait(async () => {
            const out = await Misc.getTerminalOutput();
            for (const item of textToSearch) {
                if (out.includes(item)) {
                    return true;
                }
            }
        }, timeout, `Could not find text '${textToSearch[0]}' on the terminal`);
    };

    public static terminalHasErrors = async (): Promise<boolean> => {
        const out = await Misc.getTerminalOutput();

        return out.includes("ERR") || out.includes("err");
    };

    public static findOutputText = async (textToSearch: string | RegExp | RegExp[]): Promise<boolean> => {
        const output = new OutputView();

        let clipBoardText = "";
        await driver.wait(async () => {
            try {
                clipBoardText = await output.getText();

                return true;
            } catch (e) {
                if (!(String(e).includes("Command failed")) &&
                    !(e instanceof error.StaleElementReferenceError) &&
                    !(e instanceof error.ElementNotInteractableError)
                ) {
                    throw e;
                }
            }
        }, constants.wait10seconds, "Could not get output text from clipboard");

        if (Array.isArray(textToSearch)) {
            for (const rex of textToSearch) {
                if (clipBoardText.toString().match(rex) === null) {
                    return false;
                }
            }

            return true;
        }
        if (textToSearch instanceof RegExp) {
            return (clipBoardText.match(textToSearch)) !== null;
        } else {
            return clipBoardText.includes(textToSearch);
        }
    };

    public static waitForOutputText = async (textToSearch: string | RegExp, timeout: number): Promise<void> => {
        await driver.wait(async () => {
            return Misc.findOutputText(textToSearch);
        }, timeout, `'${textToSearch.toString()}' was not found on Output view`);
    };

    public static setInputPassword = async (password: string): Promise<void> => {
        let inputBox: InputBox;
        await Misc.switchBackToTopFrame();
        try {
            inputBox = await InputBox.create(constants.wait1second);
        } catch (e) {
            return;
        }

        if (await inputBox.isPassword()) {
            await inputBox.setText(password);
            await inputBox.confirm();
        }

        if (waitUntil.credentialHelperOk) {
            await driver.wait(async () => {
                inputBox = await InputBox.create();
                if ((await inputBox.isPassword()) === false) {
                    await inputBox.setText("N");
                    await inputBox.confirm();

                    return true;
                }
            }, constants.wait5seconds, "Save password dialog was not displayed");
        }
    };

    public static isJson = (text: string): boolean => {
        try {
            JSON.parse(text);

            return true;
        } catch (e) {
            console.error(e);

            return false;
        }
    };

    public static getResultTabs = async (resultHost: WebElement): Promise<string[]> => {

        const result: string[] = [];
        const tabs = await resultHost.findElements(locator.notebook.codeEditor.editor.result.tabSection.tab);

        for (const tab of tabs) {
            if (await tab.getAttribute("id") !== "selectorItemstepDown" &&
                await tab.getAttribute("id") !== "selectorItemstepUp") {

                const label = await tab.findElement(locator.htmlTag.label);
                const tabLabel = await label.getAttribute("innerHTML");
                result.push(tabLabel);
            }
        }

        return result;
    };

    public static getResultTab = async (resultHost: WebElement, tabName: string): Promise<WebElement | undefined> => {
        const tabs = await resultHost.findElements(locator.notebook.codeEditor.editor.result.tabSection.tab);

        for (const tab of tabs) {
            if (await tab.getAttribute("id") !== "selectorItemstepDown" &&
                await tab.getAttribute("id") !== "selectorItemstepUp") {

                const label = await tab.findElement(locator.htmlTag.label);
                const tabLabel = await label.getAttribute("innerHTML");
                if (tabName === tabLabel) {
                    return tab;
                }
            }
        }
    };

    public static getResultColumns = async (resultHost: WebElement): Promise<string[]> => {

        const result: string[] = [];

        const resultSet = await driver.wait(async () => {
            return (await resultHost.findElements(locator.notebook.codeEditor.editor.result.tableHeaders))[0];
        }, constants.wait5seconds, "No tabulator-headers detected");

        const resultHeaderRows = await driver.wait(async () => {
            return resultSet.findElements(locator.notebook.codeEditor.editor.result.tableColumnTitle);
        }, constants.wait5seconds, "No tabulator-col-title detected");

        for (const row of resultHeaderRows) {
            const rowText = await row.getAttribute("innerHTML");
            result.push(rowText);
        }

        return result;

    };

    public static getMysqlshLog = (): string => {
        if (process.env.TEST_SUITE !== undefined) {
            return join(constants.basePath, `mysqlsh-${String(process.env.TEST_SUITE)}`, "mysqlsh.log");
        } else {
            throw new Error("TEST_SUITE env variable is not defined");
        }
    };

    public static isRouterProcessRunning = (): boolean => {
        if (Misc.isWindows()) {
            const cmdResult = execSync(`tasklist /fi "IMAGENAME eq mysqlrouter.exe"`);
            const resultLines = cmdResult.toString().split("\n");
            for (const line of resultLines) {
                if (line.match(/No tasks are running/) !== null) {
                    return false;
                }
            }

            return true;
        } else {
            const cmdResult = execSync("ps aux | grep mysqlrouter");
            const resultLines = cmdResult.toString().split("\n");
            for (const line of resultLines) {
                if (line.match(/\/usr\/.*\/mysql-router-.*-labs/) !== null) {
                    return true;
                }
            }

            return false;
        }
    };

    public static expandNotifications = async (): Promise<void> => {
        const notifs = await new Workbench().getNotifications();
        for (const notif of notifs) {
            await notif.expand();
        }
    };

    public static setInputPath = async (path: string): Promise<void> => {
        await Misc.switchBackToTopFrame();
        const input = await InputBox.create();
        await driver.wait(async () => {
            try {
                await input.clear();
                await input.setText(path);
                if ((await input.getText()) === path) {
                    await input.confirm();

                    return true;
                }
            } catch (e) {
                // continue trying
            }
        }, constants.wait10seconds, `Could not set ${path} on input box`);
    };

    public static loadDriver = async (): Promise<void> => {
        const timeout: ITimeouts = { implicit: 0 };
        let counter = 0;
        while (counter <= 10) {
            try {
                browser = VSBrowser.instance;
                await browser.waitForWorkbench();
                driver = browser.driver;
                await driver.manage().setTimeouts(timeout);

                return;
            } catch (e) {
                if (e instanceof Error) {
                    if (e.message.indexOf("target frame detached") === -1) {
                        throw new Error(String(e.stack));
                    }
                    counter++;
                }
            }
        }
    };

    public static getTerminalOutput = async (): Promise<string> => {
        let out: string;
        await driver.wait(until.elementLocated(locator.terminal.textArea),
            constants.wait5seconds, "Terminal was not opened");
        await driver.wait(async () => {
            try {
                const workbench = new Workbench();
                await workbench.executeCommand("terminal select all");
                await driver.sleep(1000);
                out = clipboard.readSync();
                clipboard.writeSync("");

                return true;
            } catch (e) {
                // continue. Clipboard may be in use by other tests
            }
        }, constants.wait10seconds, "Cliboard was in use after 10 secs");

        return out;
    };

    public static reloadVSCode = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                const workbench = new Workbench();
                await workbench.executeCommand("workbench.action.reloadWindow");
                await driver.sleep(constants.wait2seconds);

                return true;
            } catch (e) {
                return false;
            }
        }, constants.wait5seconds * 3, "Could not reload VSCode");
    };

    public static writeMySQLshLogs = async (): Promise<void> => {
        const text = await fs.readFile(Misc.getMysqlshLog());
        console.log(text.toString());
    };

    public static findOnMySQLShLog = async (textToFind: RegExp[] | RegExp): Promise<boolean> => {
        const text = await fs.readFile(Misc.getMysqlshLog());
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

    public static closeEditor = async (editor: string): Promise<void> => {
        await Misc.switchBackToTopFrame();
        await new EditorView().closeEditor(editor);
    };

    public static closeAllEditors = async (): Promise<void> => {
        await Misc.switchBackToTopFrame();
        await new EditorView().closeAllEditors();
    };

    public static getOpenEditorTitles = async (): Promise<string[]> => {
        await Misc.switchBackToTopFrame();

        return new EditorView().getOpenEditorTitles();
    };

    public static getActiveTab = async (): Promise<EditorTab> => {
        await Misc.switchBackToTopFrame();

        return new EditorView().getActiveTab();
    };

    public static openEditor = async (editor: string): Promise<void> => {
        await Misc.switchBackToTopFrame();
        await new EditorView().openEditor(editor);
    };

    public static requiresMRSMetadataUpgrade = async (dbConnection: interfaces.IDBConnection): Promise<boolean> => {
        await Misc.switchBackToTopFrame();

        await Misc.dismissNotifications();
        const dbTreeConnection = await Tree.getElement(constants.dbTreeSection, dbConnection.caption);
        await Misc.cleanCredentials();
        await Tree.expandDatabaseConnection(dbTreeConnection,
            (dbConnection.basic as interfaces.IConnBasicMySQL).password);
        if ((await Misc.existsNotifications(constants.wait2seconds)) === true) {
            return (await Misc.getNotification("This MySQL Shell version requires a new minor version")) !== undefined;
        }
    };

    public static upgradeMRSMetadata = async (): Promise<void> => {
        const notification = await Misc.getNotification("This MySQL Shell version requires a new minor version");
        await Misc.clickOnNotificationButton(notification, "Yes");
        await Misc.getNotification("The MySQL REST Service Metadata Schema has been updated");
    };

    public static existsWebViewDialog = async (wait = false): Promise<boolean> => {
        if (wait === false) {
            return (await driver.findElements(locator.genericDialog.exists)).length > 0;
        } else {
            return driver.wait(async () => {
                const genericDialog = await driver.findElements(locator.genericDialog.exists);
                const confirmDialog = await driver.findElements(locator.confirmDialog.exists);

                return (genericDialog).length > 0 || confirmDialog.length > 0;
            }, constants.wait5seconds).catch(() => {
                return false;
            });
        }
    };

    public static removeInternalDB = async (): Promise<void> => {
        const pluginDataFolder = join(constants.basePath, `mysqlsh-${String(process.env.TEST_SUITE)}`,
            "plugin_data", "gui_plugin");
        const files = await fs.readdir(pluginDataFolder);
        for (const file of files) {
            if (file.match(/mysqlsh/) !== null) {
                console.log(`Removing db file ${file}`);
                await fs.unlink(join(pluginDataFolder, file));
            }
        }
    };

    public static keyboardSelectAll = async (el: WebElement): Promise<void> => {
        if (Misc.isMacOs()) {
            await driver.executeScript("arguments[0].click()", el);
            await el.sendKeys(Key.chord(Key.COMMAND, "a"));
        } else {
            await driver.executeScript("arguments[0].click()", el);
            await el.sendKeys(Key.chord(Key.CONTROL, "a"));
        }
    };

    public static keyboardCopy = async (el?: WebElement): Promise<void> => {
        if (Misc.isMacOs()) {
            await driver.executeScript("arguments[0].click()", el);
            await el.sendKeys(Key.chord(Key.COMMAND, "c"));
        } else {
            await driver.executeScript("arguments[0].click()", el);
            await el.sendKeys(Key.chord(Key.CONTROL, "c"));
        }
    };

    public static keyboardPaste = async (el?: WebElement): Promise<void> => {
        if (Misc.isMacOs()) {
            await driver.executeScript("arguments[0].click()", el);
            await el.sendKeys(Key.chord(Key.COMMAND, "v"));
        } else {
            await driver.executeScript("arguments[0].click()", el);
            await el.sendKeys(Key.chord(Key.CONTROL, "v"));
        }
    };

    public static keyboardCut = async (el?: WebElement): Promise<void> => {
        if (Misc.isMacOs()) {
            await driver.executeScript("arguments[0].click()", el);
            await el.sendKeys(Key.chord(Key.COMMAND, "x"));
        } else {
            await driver.executeScript("arguments[0].click()", el);
            await el.sendKeys(Key.chord(Key.CONTROL, "x"));
        }
    };

    public static getValueFromMap = (item: string, map?: Map<string, number>): number => {
        if (map) {
            return map.get(item);
        } else {
            const objects = Object.entries(constants);
            for (const object of objects) {
                for (const obj of object) {
                    if (obj instanceof Map) {
                        if (obj.has(item)) {
                            return obj.get(item);
                        }
                    }
                }
            }
            throw new Error(`Could not find ${item} on any map`);
        }
    };

    public static existsNewTab = async (prevTabs: number): Promise<boolean> => {
        return driver.wait(async () => {
            const currentOpenedTabs = await new EditorView().getOpenEditorTitles();

            return currentOpenedTabs.length > prevTabs || currentOpenedTabs.length > 0;
        }, constants.wait5seconds).catch(() => {
            return false;
        });

    };

    public static existsInput = async (): Promise<boolean> => {
        return driver.wait(async () => {
            const widget = await driver.findElement(locator.inputBox.exists);
            const display = await widget.getCssValue("display");

            return !display.includes("none");
        }, constants.wait5seconds).catch(() => {
            return false;
        });
    };

    public static existsNotifications = async (timeout = constants.wait5seconds): Promise<boolean> => {
        return driver.wait(async () => {
            return (await new Workbench().getNotifications()).length > 0;
        }, timeout).catch(() => {
            return false;
        });
    };

    public static existsTerminal = async (): Promise<boolean> => {
        return driver.wait(async () => {
            return (await driver.findElements(locator.terminal.exists)).length > 0;
        }, constants.wait5seconds).catch(() => {
            return false;
        });
    };

    public static getCmdResultToolbar = async (zoneHost: WebElement): Promise<WebElement | undefined> => {
        let context: WebElement;
        if (zoneHost) {
            context = zoneHost;
        } else {
            const blocks = await driver.wait(until.elementsLocated(locator.notebook.codeEditor.editor.result.exists),
                constants.wait5seconds, "No zone hosts were found");
            context = blocks[blocks.length - 1];
        }

        const toolbar = await context.findElements(locator.notebook.codeEditor.editor.result.status.toolbar);
        if (toolbar.length > 0) {
            return toolbar[0];
        }
    };

    public static selectItemMacOS = async (item: string, map?: Map<string, number>): Promise<void> => {
        const taps = Misc.getValueFromMap(item, map);
        for (let i = 0; i <= taps - 1; i++) {
            await keyboard.type(nutKey.Down);
        }
        await keyboard.type(nutKey.Enter);
    };
}
