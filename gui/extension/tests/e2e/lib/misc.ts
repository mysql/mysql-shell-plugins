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
import { expect } from "chai";
import { ChildProcess, spawn, spawnSync } from "child_process";
import clipboard from "clipboardy";
import fs from "fs/promises";
import addContext from "mochawesome/addContext";
import { platform } from "os";
import { join } from "path";
import {
    BottomBarPanel, By, Condition, CustomTreeSection, EditorView, error, InputBox, ITimeouts,
    Key, OutputView, SideBarView, TreeItem, until, VSBrowser,
    WebDriver, ModalDialog,
    WebElement, Workbench, Button, Notification,
} from "vscode-extension-tester";
import { Database } from "./db";
import * as constants from "./constants";
import { keyboard, Key as nutKey } from "@nut-tree/nut-js";
import * as Until from "./until";
import * as interfaces from "./interfaces";
export let driver: WebDriver;
export let browser: VSBrowser;

export class Misc {

    public static getSection = async (name: string): Promise<CustomTreeSection> => {
        return new SideBarView().getContent().getSection(name);
    };

    public static isDefaultItem = async (
        section: string,
        treeItemName: string,
        itemType: string,
    ): Promise<boolean | undefined> => {

        const treeItem = await Misc.getTreeElement(section, treeItemName);
        const el = await treeItem.findElement(By.css(".custom-view-tree-node-item-icon"));
        const backImage = await el.getCssValue("background-image");

        switch (itemType) {
            case "profile": {
                return backImage.includes("ociProfileCurrent");
            }
            case "compartment": {
                return backImage.includes("folderCurrent");
            }
            case "bastion": {
                return backImage.includes("ociBastionCurrent");
            }
            case "rest": {
                return backImage.includes("mrsServiceDefault");
            }
            default: {
                break;
            }
        }
    };

    public static toggleBottomBar = async (expand: boolean): Promise<void> => {

        const bottombar = await driver.findElement(By.css(".basepanel.bottom"));
        const parent: WebElement = await driver.executeScript("return arguments[0].parentNode", bottombar);
        const parentClasses = (await parent.getAttribute("class")).split(" ");
        const isVisible = parentClasses.includes("visible");
        const closeBtn = await bottombar.findElement(By.css("a.codicon-panel-close"));

        if (isVisible) {
            if (expand === false) {
                await closeBtn.click();
            }
        } else {
            if (expand === true) {
                let output: WebElement;
                await driver.wait(async () => {
                    await driver.actions().sendKeys(Key.chord(Key.CONTROL, "j")).perform();
                    output = await bottombar.findElement(By.xpath("//a[contains(@aria-label, 'Output (')]"));

                    return output.isDisplayed();
                }, constants.explicitWait, "");
                await output.click();
            }
        }

    };

    public static openContextMenuItem = async (
        treeItem: TreeItem,
        ctxMenuItem: string | string[],
        verifyOption: string | undefined,
        map?: Map<string, number>,
    ): Promise<void> => {

        switch (verifyOption) {
            case constants.checkNewTabAndWebView: {
                await driver.wait(async () => {
                    try {
                        const prevOpenedTabs = await new EditorView().getOpenEditorTitles();
                        await Misc.selectContextMenuItem(treeItem, ctxMenuItem, map);
                        if (await Misc.existsNewTab(prevOpenedTabs.length)) {
                            await Misc.switchToFrame();

                            return true;
                        }
                    } catch (e) {
                        if (e instanceof Error) {
                            if (!e.message.includes("Could not find a visible iframe div")) {
                                throw e;
                            } else {
                                const activeTab = await (await new EditorView().getActiveTab()).getTitle();
                                await new EditorView().closeEditor(activeTab);
                            }
                        }
                    }
                }, constants.explicitWait * 2, `No new tab was opened after selecting ${ctxMenuItem.toString()}`);
                break;
            }
            case constants.checkNewTab: {
                await driver.wait(async () => {
                    const prevOpenedTabs = await new EditorView().getOpenEditorTitles();
                    await Misc.selectContextMenuItem(treeItem, ctxMenuItem, map);

                    return Misc.existsNewTab(prevOpenedTabs.length);
                }, constants.explicitWait * 2, `No new tab was opened after selecting ${ctxMenuItem.toString()}`);
                break;
            }
            case constants.checkWebView: {
                await driver.wait(async () => {
                    try {
                        await Misc.selectContextMenuItem(treeItem, ctxMenuItem, map);
                        await Misc.switchToFrame();

                        return true;
                    } catch (e) {
                        if (e instanceof Error) {
                            if (!e.message.includes("Could not find a visible iframe div")) {
                                throw e;
                            } else {
                                const activeTab = await (await new EditorView().getActiveTab()).getTitle();
                                await new EditorView().closeEditor(activeTab);
                            }
                        }
                    }
                }, constants.explicitWait * 2, `Could not switch to webview after selecting ${ctxMenuItem.toString()}`);
                break;
            }
            case constants.checkNotif: {
                await driver.wait(async () => {
                    await Misc.selectContextMenuItem(treeItem, ctxMenuItem, map);

                    return Misc.existsNotifications();
                }, constants.explicitWait * 2, `No new tab was opened after selecting ${ctxMenuItem.toString()}`);
                break;
            }
            case constants.checkInput: {
                await driver.wait(async () => {
                    await Misc.selectContextMenuItem(treeItem, ctxMenuItem, map);

                    return Misc.existsInput();
                }, constants.explicitWait * 2, `No input box was opened after selecting ${ctxMenuItem.toString()}`);
                break;
            }
            case constants.checkWebViewDialog: {
                const msg = `No Dialog inside a Web view was opened after selecting ${ctxMenuItem.toString()}`;
                await driver.wait(async () => {
                    try {
                        await Misc.selectContextMenuItem(treeItem, ctxMenuItem, map);
                        await Misc.switchToFrame();

                        return await Misc.existsWebViewDialog(true);
                    } catch (e) {
                        await driver.switchTo().defaultContent();
                    }
                }, constants.explicitWait * 2, msg);
                break;
            }
            case constants.checkDialog: {
                await driver.wait(async () => {
                    await Misc.selectContextMenuItem(treeItem, ctxMenuItem, map);

                    return Misc.existsDialog();
                }, constants.explicitWait * 2, `No Dialog was opened after selecting ${ctxMenuItem.toString()}`);
                break;
            }
            case constants.checkTerminal: {
                await driver.wait(async () => {
                    await Misc.selectContextMenuItem(treeItem, ctxMenuItem, map);

                    return Misc.existsTerminal();
                }, constants.explicitWait * 2, `No Dialog was opened after selecting ${ctxMenuItem.toString()}`);
                break;
            }
            default: {
                await Misc.selectContextMenuItem(treeItem, ctxMenuItem, map);
                break;
            }
        }
    };

    public static clickSectionToolbarButton = async (section: CustomTreeSection, button: string): Promise<void> => {
        let sectionActions: WebElement;
        await driver.wait(async () => {
            await driver.actions().move({ origin: section }).perform();
            sectionActions = await driver
                .findElement(By.xpath(`//ul[contains(@aria-label, '${await section.getTitle()} actions')]`));

            return sectionActions.isDisplayed();
        }, constants.explicitWait, `Toolbar buttons for ${await section.getTitle()} were not displayed`);

        const actionItems = await sectionActions.findElements(By.css("li"));
        for (const action of actionItems) {
            const title = await action.getAttribute("title");
            if (title === button) {
                await action.findElement(By.css("a")).click();

                return;
            }
        }
        throw new Error(`Could not find the ${button} button`);
    };

    public static restartShell = async (): Promise<void> => {
        const existsRootHost = async (): Promise<boolean> => {
            return (await driver.findElements(By.className("shadow-root-host"))).length > 0;
        };

        const treeDBSection = await Misc.getSection(constants.dbTreeSection);
        await driver.wait(Until.isNotLoading(constants.dbTreeSection), constants.explicitWait * 4,
            `${await treeDBSection.getTitle()} is still loading`);
        await treeDBSection.click();
        const moreActions = await treeDBSection.findElement(By.xpath(".//a[contains(@title, 'More Actions...')]"));
        await moreActions.click();

        if (platform() === "darwin") {
            await keyboard.type(nutKey.Right);
            await keyboard.type(nutKey.Enter);
        } else {
            const rootHost = await driver.findElement(By.className("shadow-root-host"));
            const shadowRoot = await rootHost.getShadowRoot();
            const menu = await shadowRoot.findElement(By.className("monaco-menu-container"));
            const menuItems = await menu.findElements(By.className("action-label"));
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
                    }, constants.explicitWait, "Could not click on Restart MySQL Shell");
                    break;
                }
            }
        }
        const notification = await Misc.getNotification("This will close all MySQL Shell tabs", false);
        await Misc.clickOnNotificationButton(notification, "Restart MySQL Shell");
        await driver.wait(async () => {
            return Misc.findOnMySQLShLog(/Info/);
        }, constants.explicitWait * 3, "Shell server did not start");
    };

    public static selectMoreActionsItem = async (
        section: CustomTreeSection,
        item: string,
    ): Promise<void> => {

        const button = await section?.getAction("More Actions...");

        await driver.wait(async () => {
            await section.click();

            return button?.isDisplayed();
        }, constants.explicitWait, `'More Actions...' button was not visible`);

        if (platform() === "darwin") {
            const moreActions = await section.findElement(By.xpath(".//a[contains(@title, 'More Actions...')]"));
            await moreActions.click();
            await driver.sleep(500);
            const taps = Misc.getValueFromMap(item);
            for (let i = 0; i <= taps - 1; i++) {
                await keyboard.type(nutKey.Down);
            }
            await keyboard.type(nutKey.Enter);
        } else {
            const moreActions = await section?.moreActions();
            const moreActionsItem = await moreActions?.getItem(item);
            await moreActionsItem?.select();
        }
    };

    public static cleanCredentials = async (): Promise<void> => {
        const params = ["--js", "-e", "shell.deleteAllCredentials()"];
        let extDir = join(constants.basePath, `test-resources-${String(process.env.TEST_SUITE)}`, "ext");
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

    public static startServer = async (): Promise<ChildProcess> => {
        const params = ["--py", "-e", "gui.start.web_server(port=8500)"];
        const prc = spawn("mysqlsh", params, {
            env: {
                detached: "true",
                // eslint-disable-next-line @typescript-eslint/naming-convention
                PATH: process.env.PATH,
                stdio: "inherit",
            },
        });

        let serverOutput = "";
        let serverErr = "";
        prc.stdout.on("data", (data) => {
            serverOutput += data as string;
        });
        prc.stderr.on("data", (data) => {
            serverErr += data as string;
        });

        try {
            await driver.wait(() => {
                if (serverOutput.indexOf("Starting MySQL Shell GUI web server...") !== -1) {
                    return true;
                }
            }, 10000, "mysqlsh server was not started correctly");
        } catch (e) {
            prc.kill();
            throw serverErr[serverErr.length - 1];
        }

        return prc;
    };

    public static execOnEditor = async (): Promise<void> => {
        if (platform() === "darwin") {
            await driver.findElement(By.css("textarea")).sendKeys(Key.chord(Key.COMMAND, Key.ENTER));
        } else {
            await driver.findElement(By.css("textarea")).sendKeys(Key.chord(Key.CONTROL, Key.ENTER));
        }
    };

    public static getNextResultBlockId = async (): Promise<string | undefined> => {
        await driver.wait(until.elementLocated(By.css("textarea")),
            constants.explicitWait, "Could not find the text area");
        const prevBlocks = await driver.findElements(By.css(".zoneHost"));
        if (prevBlocks.length > 0) {
            const x = await prevBlocks[prevBlocks.length - 1].getAttribute("monaco-view-zone");
            const id = x.match(/(\d+)/)![0];
            const nextId = parseInt(id, 10) + 1;
            const letter = x.match(/\D+/)![0];

            return letter + String(nextId);
        }

        return "0";
    };

    public static writeCmd = async (cmd: string, slowWriting?: boolean): Promise<void> => {
        const textArea = await driver.wait(until.elementLocated(By.css("textarea")),
            constants.explicitWait, "Could not find the textarea");
        const txtLength = (await textArea.getAttribute("value")).length;
        await driver.executeScript(
            "arguments[0].click();",
            await driver.findElement(By.css(".current-line")),
        );
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

                return ((await textArea.getAttribute("value")).length) > txtLength - 1;
            } catch (e) {
                if (e instanceof error.ElementNotInteractableError) {
                    const editorLines = await driver.findElements(By.css("#appHostPaneHost .view-line"));
                    await editorLines[editorLines.length - 1].click();
                } else {
                    throw e;
                }
            }
        }, constants.explicitWait, "Text area was not interactable");
    };

    public static execCmd = async (
        cmd: string,
        button?: string,
        timeout?: number,
        slowWriting?: boolean): Promise<Array<string | WebElement | boolean | undefined>> => {

        cmd = cmd.replace(/(\r\n|\n|\r)/gm, "");
        const count = (cmd.match(/;|select|SELECT/g) || []).length;
        const hasMultipleQueries = count >= 3 && cmd.toLowerCase().startsWith("select");
        let nextBlockId = await Misc.getNextResultBlockId();
        timeout = timeout ?? 5000;

        if (cmd.length > 0) {
            await Misc.writeCmd(cmd, slowWriting);
        }

        if (button === constants.execCaret) {
            const prevBlocks = await driver.findElements(By.css(".zoneHost"));
            const block = await prevBlocks[prevBlocks.length - 1].getAttribute("monaco-view-zone");
            nextBlockId = `${block}, ${String(nextBlockId)}`;
        }

        return driver.wait(async () => {
            try {
                if (button) {
                    const btn = await Database.getToolbarButton(button);
                    await btn?.click();
                } else {
                    await Misc.execOnEditor();
                }
                const result = await Misc.getCmdResult(cmd, nextBlockId, timeout, hasMultipleQueries);

                return result;
            } catch (e) {
                if (e instanceof Error) {
                    if (!(e.message.includes("Could not get the result block"))) {
                        throw e;
                    }
                }
            }
        }, constants.explicitWait * 2, `Could not get the result block for ${cmd}`);

    };

    public static execCmdByContextItem = async (
        cmd: string,
        item: string,
        timeout?: number,
        slowWriting?: boolean): Promise<Array<string | WebElement | boolean | undefined>> => {

        cmd = cmd.replace(/(\r\n|\n|\r)/gm, "");
        const count = (cmd.match(/;|select|SELECT/g) || []).length;
        const hasMultipleQueries = count >= 3 && cmd.toLowerCase().startsWith("select");

        const nextBlockId = await Misc.getNextResultBlockId();

        if (cmd.length > 0) {
            await Misc.writeCmd(cmd, slowWriting);
        }

        await Database.clickContextItem(item);
        timeout = timeout ?? 5000;

        return Misc.getCmdResult(cmd, String(nextBlockId), timeout, hasMultipleQueries);
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

    public static expandDBConnectionTree = async (conn: TreeItem, password: string): Promise<void> => {
        await driver.wait(async () => {
            await conn.expand();

            return conn.isExpanded();
        }, constants.explicitWait, `Could not expand ${await conn.getLabel()}`);

        await driver.wait(async () => {
            const inputWidget = await driver.wait(until.elementLocated(By.css(".quick-input-widget")), 500)
                .catch(() => { return undefined; });
            if (inputWidget && (await (inputWidget as WebElement).isDisplayed())) {
                await Misc.setInputPassword(conn, password);

                return driver.wait(async () => {
                    return conn.hasChildren();
                }, constants.explicitWait * 2,
                    `${await conn.getLabel()} should have children after setting the password`);
            } else if (await conn.hasChildren()) {
                return true;
            }
        }, constants.explicitWait * 2,
            `The input password was not displayed nor the ${await conn.getLabel()} has children`);
    };

    public static switchToFrame = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                const visibleDiv = await driver.wait(async () => {
                    const divs = await driver.findElements(By.css(".file-icons-enabled > div"));
                    for (const div of divs) {
                        try {
                            const id = await div.getAttribute("id");
                            if (id !== "") {
                                const visibility = await div.getCssValue("visibility");
                                if (visibility.includes("visible")) {
                                    return div;
                                }
                            }
                        } catch (e) {
                            // continue
                        }
                    }
                }, constants.explicitWait, "Could not find a visible iframe div");

                const expectedFrames = 2;

                const firstIframe = await visibleDiv.findElement(By.css("iframe"));
                await driver.wait(until.ableToSwitchToFrame(firstIframe),
                    constants.explicitWait, "Could not enter the first iframe");

                for (let i = 0; i <= expectedFrames - 1; i++) {
                    const frame = await driver.findElements(By.css("iframe"));
                    if (frame.length > 0) {
                        await driver.wait(until.ableToSwitchToFrame(frame[0]),
                            constants.explicitWait, "Could not enter the second iframe");
                        const deepestFrame = await driver.findElements(By.css("iframe"));
                        if (deepestFrame.length > 0) {
                            await driver.executeScript("arguments[0].style.width='100%';", deepestFrame[0]);
                            await driver.executeScript("arguments[0].style.height='100%';", deepestFrame[0]);
                            await driver.executeScript("arguments[0].style.transform='scale(1)';", deepestFrame[0]);
                        }
                    }
                    else {
                        break;
                    }
                }

                return true;
            } catch (e: unknown) {
                if (e instanceof Error && e.message.includes("target frame detached")) {
                    throw e;
                }
            }
        }, constants.explicitWait * 2, "target frame detached");

    };

    public static isRouterInstalled = async (): Promise<boolean> => {
        if (platform() === "win32") {
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
        }, constants.explicitWait, "Could not switch back to top frame");
    };

    public static getNotification = async (text: string, dismiss = true): Promise<Notification> => {

        let notif: Notification;
        await driver.wait(async () => {
            try {
                const ntfs = await new Workbench().getNotifications();
                if (ntfs.length > 0) {
                    for (const ntf of ntfs) {
                        if ((await ntf.getMessage()).includes(text)) {
                            notif = ntf;
                            if (dismiss) {
                                await Misc.dismissNotifications();
                            }

                            return true;
                        }
                    }
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.explicitWait * 2, `Could not find '${text}' notification`);

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
        }, constants.explicitWait, `Could not click on notification button '${button}'`);
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
                }, constants.explicitWait, "There are still notifications displayed");
            }
        }
    };

    public static removeInternalDB = async (): Promise<void> => {
        const path = join(constants.basePath, `mysqlsh-${String(process.env.TEST_SUITE)}`,
            "plugin_data", "gui_plugin");
        const files = await fs.readdir(path);
        for (const file of files) {
            if (file.match(/mysqlsh_gui/) !== null) {
                await fs.rm(join(path, file), { force: true });
                console.log(`Removed file '${join(path, file)}'`);
            }
        }
    };

    public static execOnTerminal = async (cmd: string, timeout: number): Promise<void> => {
        timeout = timeout ?? constants.explicitWait;

        if (platform() === "darwin" || platform() === "linux") {
            await keyboard.type(cmd);
            await keyboard.type(nutKey.Enter);
        } else {
            const bootomBar = new BottomBarPanel();
            const terminal = await bootomBar.openTerminalView();
            await terminal.executeCommand(cmd, timeout);
        }

    };

    public static clearTerminal = async (): Promise<void> => {
        const bottomBar = new BottomBarPanel();
        const dots = await bottomBar.findElement(By.xpath(".//a[contains(@title, 'Views and More Actions...')]"));
        await dots.click();
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

    public static writeOutputText = async (): Promise<void> => {
        console.log("<<<<OUTPUT TAB LOGS>>>");
        await driver.wait(async () => {
            try {
                const output = await new OutputView().getText();
                console.log(output);

                return true;
            } catch (e) {
                if (e instanceof Error) {
                    if (!(e.message.includes("Command failed")) &&
                        !(e instanceof error.StaleElementReferenceError) &&
                        !(e instanceof error.ElementNotInteractableError)
                    ) {
                        throw e;
                    }
                }
            }
        }, constants.explicitWait);
    };

    public static findOutputText = async (textToSearch: string | RegExp | RegExp[]): Promise<boolean> => {
        let output: OutputView;
        await new BottomBarPanel().openOutputView();
        output = new OutputView();

        let clipBoardText = "";
        await driver.wait(async () => {
            try {
                output = new OutputView();
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
        }, constants.explicitWait * 2, "Could not get output text from clipboard");

        console.log(clipBoardText);

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

    public static setInputPassword = async (connection: TreeItem, password: string): Promise<void> => {
        let inputBox: InputBox;

        inputBox = await InputBox.create();
        if (await inputBox.isPassword()) {
            await inputBox.setText(password);
            await inputBox.confirm();
        }

        if (Until.credentialHelperOk) {
            await driver.wait(async () => {
                inputBox = await InputBox.create();
                if ((await inputBox.isPassword()) === false) {
                    await inputBox.setText("N");
                    await inputBox.confirm();

                    return true;
                }
            }, constants.explicitWait, "Save password dialog was not displayed");
        }
    };

    public static setConfirmDialog = async (dbConfig: interfaces.IDBConnection, value: string,
        timeoutDialog = constants.explicitWait * 2): Promise<void> => {

        await driver.wait(until.elementsLocated(By.css(".confirmDialog")),
            timeoutDialog, "No confirm dialog was found");

        const confirmDialog = await driver.findElement(By.css(".confirmDialog"));

        expect(await confirmDialog.findElement(By.css(".title label")).getText()).to.equals("Confirm");

        const username = String((dbConfig.basic as interfaces.IConnBasicMySQL).username);
        const hostname = String((dbConfig.basic as interfaces.IConnBasicMySQL).hostname);
        const port = String((dbConfig.basic as interfaces.IConnBasicMySQL).port);

        const uri = `Save password for '${username}@${hostname}:${port}'?`;

        expect(await confirmDialog.findElement(By.id("dialogMessage")).getText()).to.contain(uri);

        const noBtn = await confirmDialog.findElement(By.id("refuse"));
        const yesBtn = await confirmDialog.findElement(By.id("accept"));
        const neverBtn = await confirmDialog.findElement(By.id("alternative"));

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

    public static cleanEditor = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                const textArea = await driver.findElement(By.css("textarea"));
                if (platform() === "darwin") {
                    await textArea.sendKeys(Key.chord(Key.COMMAND, "a", "a"));
                } else {
                    await textArea.sendKeys(Key.chord(Key.CONTROL, "a", "a"));
                }

                await textArea.sendKeys(Key.BACK_SPACE);
                await driver.wait(async () => {
                    return await this.getPromptTextLine("last") === "";
                }, 3000, "Prompt was not cleaned");

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.explicitWait, "Editor was not cleaned");
    };

    public static getResultTabs = async (resultHost: WebElement): Promise<string[]> => {

        const result: string[] = [];
        const tabs = await resultHost.findElements(By.css(".tabArea div"));

        for (const tab of tabs) {
            if (await tab.getAttribute("id") !== "selectorItemstepDown" &&
                await tab.getAttribute("id") !== "selectorItemstepUp") {

                const label = await tab.findElement(By.css("label"));
                const tabLabel = await label.getAttribute("innerHTML");
                result.push(tabLabel);
            }
        }

        return result;
    };

    public static getResultTab = async (resultHost: WebElement, tabName: string): Promise<WebElement | undefined> => {
        const tabs = await resultHost.findElements(By.css(".tabArea div"));

        for (const tab of tabs) {
            if (await tab.getAttribute("id") !== "selectorItemstepDown" &&
                await tab.getAttribute("id") !== "selectorItemstepUp") {

                const label = await tab.findElement(By.css("label"));
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
            return (await resultHost.findElements(By.css(".tabulator-headers")))[0];
        }, constants.explicitWait, "No tabulator-headers detected");

        const resultHeaderRows = await driver.wait(async () => {
            return resultSet.findElements(By.css(".tabulator-col-title"));
        }, constants.explicitWait, "No tabulator-col-title detected");

        for (const row of resultHeaderRows) {
            const rowText = await row.getAttribute("innerHTML");
            result.push(rowText);
        }

        return result;

    };

    public static isDBSystemStopped = async (dbSystem: TreeItem): Promise<boolean> => {
        const itemIcon = await dbSystem.findElement(By.css(".custom-view-tree-node-item-icon"));
        const itemStyle = await itemIcon.getAttribute("style");

        return itemStyle.includes("ociDbSystemStopped");
    };

    public static isMRSDisabled = async (mrsTreeItem: TreeItem): Promise<boolean> => {
        const itemIcon = await mrsTreeItem.findElement(By.css(".custom-view-tree-node-item-icon"));
        const itemStyle = await itemIcon.getAttribute("style");

        return itemStyle.includes("mrsDisabled");
    };

    public static getCmdResultMsg = async (zoneHost?: WebElement, timeout?: number): Promise<string | undefined> => {
        let resultToReturn = "";
        timeout = timeout ?? 5000;
        await driver.wait(async () => {
            try {
                let context: WebElement;
                if (zoneHost) {
                    context = zoneHost;
                } else {
                    const blocks = await driver.wait(until.elementsLocated(By.css(".zoneHost")),
                        constants.explicitWait, "No zone hosts were found");
                    context = blocks[blocks.length - 1];
                }

                const resultStatus = await context.findElements(By.css(".resultStatus"));
                if (resultStatus.length > 0) {
                    const elements: WebElement[] = await driver.executeScript("return arguments[0].childNodes;",
                        resultStatus[0]);

                    resultToReturn = await elements[0].getAttribute("innerHTML");

                    return resultToReturn;
                }

                const resultTexts = await context.findElements(By.css(".resultText"));
                if (resultTexts.length > 0) {
                    let result = "";
                    for (const resultText of resultTexts) {
                        const span = await resultText.findElement(By.css("span"));
                        result += await span.getAttribute("innerHTML");
                    }

                    resultToReturn = result.trim();

                    return resultToReturn;
                }

                const actionLabel = await context.findElements(By.css(".actionLabel"));
                if (actionLabel.length > 0) {
                    resultToReturn = await actionLabel[actionLabel.length - 1].getAttribute("innerHTML");

                    return resultToReturn;
                }

                const actionOutput = await context.findElements(By.css(".actionOutput"));
                if (actionOutput.length > 0) {
                    const info = await actionOutput[actionOutput.length - 1].findElements(By.css(".info"));
                    if (info.length > 0) {
                        resultToReturn = await info[info.length - 1].getAttribute("innerHTML");

                        return resultToReturn;
                    }
                    const json = await actionOutput[actionOutput.length - 1]
                        .findElements(By.css(".jsonView span > span"));
                    if (json.length > 0) {
                        resultToReturn = await json[json.length - 1].getAttribute("innerHTML");

                        return resultToReturn;
                    }
                }

                const graphHost = await context.findElements(By.css(".graphHost"));
                if (graphHost.length > 0) {
                    resultToReturn = "graph";

                    return resultToReturn;
                }

            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                } else {
                    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
                    zoneHost = zoneHosts[zoneHosts.length - 1];
                }
            }

        }, timeout, "Could not return the last result command");

        return resultToReturn;
    };

    public static getActionButton = async (treeItem: TreeItem, actionButton: string): Promise<WebElement> => {
        return driver.wait(async () => {
            try {
                let locator = ".//a[contains(@class, 'action-label') ";
                locator += `and @role='button' and @aria-label='${actionButton}']`;

                const btn = await treeItem.findElement(By.xpath(locator));

                const treeItemCoord = await treeItem.getRect();
                await driver.actions().move({
                    x: Math.floor(treeItemCoord.x),
                    y: Math.floor(treeItemCoord.y),
                }).perform();
                await driver.wait(until.elementIsVisible(btn),
                    constants.explicitWait, `'${actionButton}' button was not visible`);

                return btn;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.explicitWait, `Could not get icon for '${await treeItem.getLabel()}' (button was always stale)`);
    };

    public static getMysqlshLog = (): string => {
        if (process.env.TEST_SUITE !== undefined) {
            return join(constants.basePath, `mysqlsh-${String(process.env.TEST_SUITE)}`, "mysqlsh.log");
        } else {
            throw new Error("TEST_SUITE env variable is not defined");
        }
    };

    public static isRouterActive = async (treeItem: TreeItem): Promise<boolean> => {
        const icon = await treeItem.findElement(By.css(".custom-view-tree-node-item-icon"));
        const style = await icon.getAttribute("style");

        return !style.includes("routerNotActive");
    };

    public static sectionFocus = async (section: string): Promise<void> => {
        const treeDBSection = await Misc.getSection(constants.dbTreeSection);
        const treeOCISection = await Misc.getSection(constants.ociTreeSection);
        const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
        const treeTasksSection = await Misc.getSection(constants.tasksTreeSection);

        if ((await treeDBSection.getTitle()) === section) {
            await driver.wait(new Condition("", async () => {
                try {
                    await treeDBSection.expand();
                    await treeOCISection.collapse();
                    await treeOpenEditorsSection.collapse();
                    await treeTasksSection.collapse();

                    return (await treeDBSection.isExpanded()) &&
                        !(await treeOCISection.isExpanded()) &&
                        !(await treeOpenEditorsSection.isExpanded()) &&
                        !(await treeTasksSection.isExpanded());
                } catch (e) {
                    if (!(e instanceof error.TimeoutError || e instanceof error.ElementClickInterceptedError)) {
                        throw e;
                    }
                }
            }), constants.explicitWait, `${section} was not focused`);
        } else if ((await treeOCISection.getTitle()) === section) {
            await driver.wait(new Condition("", async () => {
                try {
                    await treeOCISection.expand();
                    await treeDBSection.collapse();
                    await treeOpenEditorsSection.collapse();
                    await treeTasksSection.collapse();

                    return (await treeOCISection.isExpanded()) &&
                        !(await treeDBSection.isExpanded()) &&
                        !(await treeOpenEditorsSection.isExpanded()) &&
                        !(await treeTasksSection.isExpanded());
                } catch (e) {
                    if (!(e instanceof error.TimeoutError || e instanceof error.ElementClickInterceptedError)) {
                        throw e;
                    }
                }
            }), constants.explicitWait, `${section} was not focused`);
        } else if ((await treeOpenEditorsSection.getTitle()) === section) {
            await driver.wait(new Condition("", async () => {
                try {
                    await treeOpenEditorsSection.expand();
                    await treeDBSection.collapse();
                    await treeOCISection.collapse();
                    await treeTasksSection.collapse();

                    return (await treeOpenEditorsSection.isExpanded()) &&
                        !(await treeDBSection.isExpanded()) &&
                        !(await treeOCISection.isExpanded()) &&
                        !(await treeTasksSection.isExpanded());
                } catch (e) {
                    if (!(e instanceof error.TimeoutError || e instanceof error.ElementClickInterceptedError)) {
                        throw e;
                    }
                }
            }), constants.explicitWait, `${section} was not focused`);
        } else if ((await treeTasksSection.getTitle()) === section) {
            await driver.wait(new Condition("", async () => {
                try {
                    await treeTasksSection.expand();
                    await treeDBSection.collapse();
                    await treeOCISection.collapse();
                    await treeOpenEditorsSection.collapse();

                    return (await treeTasksSection.isExpanded()) &&
                        !(await treeDBSection.isExpanded()) &&
                        !(await treeOCISection.isExpanded()) &&
                        !(await treeOpenEditorsSection.isExpanded());
                } catch (e) {
                    if (!(e instanceof error.TimeoutError || e instanceof error.ElementClickInterceptedError)) {
                        throw e;
                    }
                }

            }), constants.explicitWait, `${section} was not focused`);
        } else {
            throw new Error(`Unknow section: ${section}`);
        }
    };

    public static getTreeScript = async (section: CustomTreeSection,
        partialName: string, type: string): Promise<TreeItem> => {
        return driver.wait(new Condition("", async () => {
            section = await Misc.getSection(await section.getTitle());
            const treeVisibleItems = await section.getVisibleItems();
            for (const item of treeVisibleItems) {
                if ((await item.getLabel()).includes(partialName)) {
                    const itemIcon = await item.findElement(By.css(".custom-view-tree-node-item-icon"));
                    if ((await itemIcon.getAttribute("style")).includes(type)) {
                        return item;
                    }
                }
            }
        }), constants.explicitWait,
            `Could not find the script '${partialName}' with type '${type}' on the Open Editors tree`);
    };

    public static expandNotifications = async (): Promise<void> => {
        const notifs = await new Workbench().getNotifications();
        for (const notif of notifs) {
            await notif.expand();
        }
    };

    public static getTreeElement = async (
        section: string,
        itemName: string | RegExp,
    ): Promise<TreeItem> => {
        let el: TreeItem;
        let reloadLabel: string;

        if (section === constants.dbTreeSection) {
            reloadLabel = constants.reloadConnections;
        } else if (section === constants.ociTreeSection) {
            reloadLabel = constants.reloadOci;
        }

        const sectionTree = await Misc.getSection(section);
        await driver.wait(Until.isNotLoading(section), constants.loadingBarWait,
            `${await sectionTree.getTitle()} is still loading`);
        let reload = false;

        await driver.wait(async () => {
            try {
                if (reload) {
                    if (section === constants.dbTreeSection || section === constants.ociTreeSection) {
                        await Misc.clickSectionToolbarButton(sectionTree, reloadLabel);
                        await driver.wait(Until.isNotLoading(section), constants.loadingBarWait,
                            `${await sectionTree.getTitle()} is still loading`);
                    }
                }
                if (itemName instanceof RegExp) {
                    const treeItems = await sectionTree.getVisibleItems();
                    for (const item of treeItems) {
                        if ((await item.getLabel()).match(itemName) !== null) {
                            el = item;
                            break;
                        }
                    }
                } else {
                    el = await sectionTree.findItem(itemName, 5);
                }

                if (el === undefined) {
                    reload = true;
                } else {
                    return true;
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.explicitWait * 2, `${itemName.toString()} on section ${section} was not found`);

        return el;
    };

    public static existsTreeElement = async (section: string, itemName: string | RegExp): Promise<boolean> => {
        let reloadLabel: string;
        const sectionTree = await Misc.getSection(section);
        await driver.wait(Until.isNotLoading(section), constants.explicitWait * 2,
            `${await sectionTree.getTitle()} is still loading`);
        if (section === constants.dbTreeSection || section === constants.ociTreeSection) {
            if (section === constants.dbTreeSection) {
                reloadLabel = "Reload the connection list";
            } else if (section === constants.ociTreeSection) {
                reloadLabel = "Reload the OCI Profile list";
            }
            await Misc.clickSectionToolbarButton(sectionTree, reloadLabel);
            await driver.wait(Until.isNotLoading(section), constants.loadingBarWait,
                `${await sectionTree.getTitle()} is still loading`);
        }

        if (itemName instanceof RegExp) {
            const treeItems = await sectionTree.getVisibleItems();
            for (const item of treeItems) {
                if ((await item.getLabel()).match(itemName) !== null) {
                    return true;
                }
            }

            return false;
        } else {
            return (await sectionTree.findItem(itemName, 5)) !== undefined;
        }
    };

    public static setInputPath = async (path: string): Promise<void> => {
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
        }, constants.explicitWait * 2, `Could not set ${path} on input box`);
    };

    public static deleteConnection = async (dbName: string): Promise<void> => {

        const treeItem = await Misc.getTreeElement(constants.dbTreeSection, dbName);
        await Misc.selectContextMenuItem(treeItem, constants.deleteDBConnection);
        const editorView = new EditorView();
        await driver.wait(async () => {
            const activeTab = await editorView.getActiveTab();

            return await activeTab?.getTitle() === "MySQL Shell";
        }, 3000, "error");

        await Misc.switchToFrame();
        const dialog = await driver.wait(until.elementLocated(
            By.css(".visible.confirmDialog")), 7000, "confirm dialog was not found");
        await dialog.findElement(By.id("accept")).click();
        await driver.switchTo().defaultContent();
        await driver.wait(async () => {
            try {
                const treeSection = await Misc.getSection(constants.dbTreeSection);
                await Misc.clickSectionToolbarButton(treeSection, "Reload the connection list");

                return (await treeSection.findItem(dbName)) === undefined;
            } catch (e) {
                return false;
            }
        }, constants.explicitWait, `${dbName} was not deleted`);
    };

    public static getTreeDBConnections = async (): Promise<string[]> => {

        const section = await Misc.getSection(constants.dbTreeSection);
        const treeItems = await section.findElements(By.xpath(".//div[contains(@role, 'treeitem')]"));
        const connections: string[] = [];
        for (const item of treeItems) {
            const name = await item.findElement(By.css("a.label-name > span"));
            connections.push(await name.getText());
        }

        return connections;
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

    public static connectToExternalShellProcess = async (): Promise<void> => {
        const existsRootHost = async (): Promise<boolean> => {
            return (await driver.findElements(By.className("shadow-root-host"))).length > 0;
        };

        const treeDBSection = await Misc.getSection(constants.dbTreeSection);
        await driver.wait(Until.isNotLoading(constants.dbTreeSection), constants.explicitWait * 4,
            `${await treeDBSection.getTitle()} is still loading`);
        await treeDBSection.click();
        const moreActions = await treeDBSection.findElement(By.xpath(".//a[contains(@title, 'More Actions...')]"));
        await moreActions.click();

        if (platform() === "darwin") {
            await keyboard.type(nutKey.Right);
            await keyboard.type(nutKey.Down);
            await keyboard.type(nutKey.Enter);
        } else {
            const rootHost = await driver.findElement(By.className("shadow-root-host"));
            const shadowRoot = await rootHost.getShadowRoot();
            const menu = await shadowRoot.findElement(By.className("monaco-menu-container"));
            const menuItems = await menu.findElements(By.className("action-label"));
            for (const item of menuItems) {
                if ((await item.getText()) === constants.connectToExternalShell) {
                    await driver.wait(async () => {
                        try {
                            await item.click();

                            return (await existsRootHost()) === false;
                        } catch (e) {
                            if (e instanceof error.StaleElementReferenceError) {
                                return true;
                            }
                        }
                    }, constants.explicitWait, "Could not click on Connect to External Shell process");
                    break;
                }
            }
        }

        await Misc.setInputPath(`http://localhost:${String(process.env.MYSQLSH_GUI_CUSTOM_PORT)}/?token=vscode`);
        await driver.wait(async () => {
            return Misc.findOutputText(/application did start/);
        }, constants.explicitWait * 3, "Shell server did not start");
    };

    public static getTerminalOutput = async (): Promise<string> => {
        let out: string;
        const bootomBar = new BottomBarPanel();
        await bootomBar.openTerminalView();
        await driver.wait(until.elementLocated(By.css("#terminal textarea")),
            constants.explicitWait, "Terminal was not opened");
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
        }, constants.explicitWait * 2, "Cliboard was in use after 10 secs");

        return out;
    };

    public static expandTreeSection = async (section: string): Promise<void> => {
        const sec = await Misc.getSection(section);
        if (!(await sec.isExpanded())) {
            await driver.wait(async () => {
                await sec.expand();

                return sec.isExpanded();
            }, constants.explicitWait, `Could not expand '${section}' section`);
        }
    };

    public static collapseTreeSection = async (section: string): Promise<void> => {
        const sec = await Misc.getSection(section);
        if (await sec.isExpanded()) {
            await driver.wait(async () => {
                await sec.collapse();

                return (await sec.isExpanded()) === false;
            }, constants.explicitWait, `Could not expand '${section}' section`);
        }
    };

    public static reloadVSCode = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                const workbench = new Workbench();
                await workbench.executeCommand("workbench.action.reloadWindow");
                await driver.sleep(2000);

                return true;
            } catch (e) {
                return false;
            }
        }, constants.explicitWait * 3, "Could not reload VSCode");
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

    public static selectContextMenuItem = async (
        treeItem: TreeItem,
        ctxMenuItem: string | string[],
        itemMap?: Map<string, number>,
    ): Promise<void> => {

        const selectItemMacOS = async (item: string, map?: Map<string, number>): Promise<void> => {
            const taps = Misc.getValueFromMap(item, map);
            for (let i = 0; i <= taps - 1; i++) {
                await keyboard.type(nutKey.Down);
            }
            await keyboard.type(nutKey.Enter);
        };

        if (treeItem) {
            await driver.wait(async () => {
                if (platform() === "darwin") {
                    await driver.actions()
                        .move({ origin: treeItem })
                        .press(Button.RIGHT)
                        .pause(500)
                        .perform();
                    if (Array.isArray(ctxMenuItem)) {
                        for (const item of ctxMenuItem) {
                            await selectItemMacOS(item, itemMap);
                        }
                    } else {
                        await selectItemMacOS(ctxMenuItem, itemMap);
                    }

                    return true;
                } else {
                    try {
                        let ctxMenuItems: string | string[];
                        if (Array.isArray(ctxMenuItem)) {
                            ctxMenuItems = [ctxMenuItem[0], ctxMenuItem[1]];
                        } else {
                            ctxMenuItems = [ctxMenuItem];
                        }

                        const menu = await treeItem.openContextMenu();
                        const menuItem = await menu.getItem(ctxMenuItems[0].trim());
                        const anotherMenu = await menuItem.select();
                        if (ctxMenuItems.length > 1) {
                            await (await anotherMenu.getItem(ctxMenuItems[1].trim())).select();
                        }

                        return true;
                    } catch (e) {
                        console.log(e);

                        return false;
                    }
                }
            }, constants.explicitWait,
                `Could not select '${ctxMenuItem.toString()}' for tree item '${await treeItem.getLabel()}'`);
        } else {
            throw new Error(`TreeItem for context menu '${ctxMenuItem.toString()}' is undefined`);
        }
    };

    public static existsWebViewDialog = async (wait = false): Promise<boolean> => {
        if (wait === false) {
            return (await driver.findElements(By.css(".portal .visible.valueEditDialog"))).length > 0;
        } else {
            return driver.wait(async () => {
                return (await driver.findElements(By.css(".portal .visible.valueEditDialog"))).length > 0;
            }, constants.explicitWait).catch(() => {
                return false;
            });
        }
    };

    public static expandTree = async (section: string, treeItems: Array<string | RegExp>,
        loadingTimeout = constants.explicitWait * 2): Promise<void> => {
        const sec = await Misc.getSection(section);
        if (!(await sec.isExpanded())) {
            await sec.expand();
        }

        for (const item of treeItems) {
            const treeItem = await Misc.getTreeElement(section, item);
            if (!(await treeItem.isExpanded())) {
                await treeItem.expand();
                await driver.wait(Until.isNotLoading(section), loadingTimeout,
                    `${section} is still loading`);
            }
        }
    };

    private static existsNewTab = async (prevTabs: number): Promise<boolean> => {
        return driver.wait(async () => {
            const currentOpenedTabs = await new EditorView().getOpenEditorTitles();

            return currentOpenedTabs.length > prevTabs || currentOpenedTabs.length > 0;
        }, constants.explicitWait).catch(() => {
            return false;
        });

    };

    private static existsNotifications = async (): Promise<boolean> => {
        return driver.wait(async () => {
            return (await new Workbench().getNotifications()).length > 0;
        }, constants.explicitWait).catch(() => {
            return false;
        });
    };

    private static existsInput = async (): Promise<boolean> => {
        return driver.wait(async () => {
            const widget = await driver.findElement(By.css(".quick-input-widget"));
            const display = await widget.getCssValue("display");

            return !display.includes("none");
        }, constants.explicitWait).catch(() => {
            return false;
        });
    };

    private static existsTerminal = async (): Promise<boolean> => {
        return driver.wait(async () => {
            return (await driver.findElements(By.id("terminal"))).length > 0;
        }, constants.explicitWait).catch(() => {
            return false;
        });
    };

    private static existsDialog = (): Promise<boolean> => {
        return driver.wait(async () => {
            try {
                const dialog = new ModalDialog();

                return (await dialog.getMessage()).length > 0;
            } catch (e) {
                if (!(e instanceof error.NoSuchElementError) &&
                    !(e instanceof error.StaleElementReferenceError) &&
                    !(e instanceof error.ElementNotInteractableError)
                ) {
                    throw e;
                }
            }
        }, constants.explicitWait, "The dialog was not opened").catch(() => {
            return false;
        });
    };

    private static getCmdResultContent = async (multipleQueries: boolean,
        zoneHost: WebElement, timeout?: number): Promise<WebElement | undefined> => {
        timeout = timeout ?? 5000;
        let toReturn: WebElement | undefined;

        await driver.wait(async () => {
            try {
                const resultTabview = await zoneHost.findElements(By.css(".resultTabview"));
                if (resultTabview.length > 0) {
                    if (multipleQueries) {
                        const tabArea = await zoneHost.findElements(By.css(".tabArea"));
                        if (tabArea.length > 0) {
                            toReturn = resultTabview[resultTabview.length - 1];

                            return true;
                        } else {
                            return undefined;
                        }
                    } else {
                        toReturn = resultTabview[resultTabview.length - 1];

                        return true;
                    }
                }

                const renderTarget = await zoneHost.findElements(By.css(".renderTarget"));
                if (renderTarget.length > 0 && !multipleQueries) {
                    toReturn = renderTarget[renderTarget.length - 1];

                    return true;
                }
            } catch (e) {
                if (e instanceof error.StaleElementReferenceError) {
                    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
                    zoneHost = zoneHosts[zoneHosts.length - 1];
                } else {
                    throw e;
                }
            }
        }, timeout, "Could not return the last result content");

        return toReturn;
    };

    private static getCmdResultToolbar = async (zoneHost: WebElement): Promise<WebElement | undefined> => {
        let context: WebElement;
        if (zoneHost) {
            context = zoneHost;
        } else {
            const blocks = await driver.wait(until.elementsLocated(By.css(".zoneHost")),
                constants.explicitWait, "No zone hosts were found");
            context = blocks[blocks.length - 1];
        }

        const toolbar = await context.findElements(By.css(".resultStatus .toolbar"));
        if (toolbar.length > 0) {
            return toolbar[0];
        }
    };

    private static getCmdResult = async (
        cmd: string,
        blockId: string,
        timeout: number,
        hasMultipleQueries: boolean,
    ): Promise<Array<string | WebElement | boolean | undefined>> => {

        const toReturn: Array<string | WebElement | boolean | undefined> = [];
        let zoneHost: WebElement;

        if (!cmd.includes("disconnect")) {
            if (blockId === "0") {
                const zoneHosts = await driver.wait(until.elementsLocated(By.css(".zoneHost")), timeout,
                    `zoneHosts not found for '${cmd}'`);
                zoneHost = zoneHosts[zoneHosts.length - 1];
            } else {
                if (blockId.includes(",")) {
                    const blocks = blockId.split(",");
                    try {
                        zoneHost = await driver.findElement(
                            By.xpath(`//div[@class='zoneHost' and @monaco-view-zone='${blocks[0]}']`));
                    } catch (e) {
                        zoneHost = await driver.findElement(
                            By.xpath(`//div[@class='zoneHost' and @monaco-view-zone='${blocks[1]}']`));
                    }
                } else {
                    zoneHost = await driver.wait(
                        until.elementLocated(By.xpath(`//div[@class='zoneHost' and @monaco-view-zone='${blockId}']`)),
                        timeout, `Could not get the result block '${blockId}' for '${cmd}'`);
                }
            }

            await Misc.getCmdResultMsg(zoneHost, timeout)
                .then((result) => {
                    toReturn.push(result);
                })
                .catch(async (e) => {
                    if (String(e).includes("Could not return")) {
                        console.log(await zoneHost.getAttribute("outerHTML"));
                        throw new Error(`Could not get result for '${cmd}'`);
                    } else {
                        throw e;
                    }
                });

            await Misc.getCmdResultContent(hasMultipleQueries, zoneHost, timeout)
                .then((result) => {
                    toReturn.push(result);
                })
                .catch((e) => {
                    if (String(e).includes("Could not return")) {
                        throw new Error(`Could not get content for '${cmd}'`);
                    } else {
                        throw e;
                    }
                });

            toReturn.push(await Misc.getCmdResultToolbar(zoneHost));
        } else {
            await driver.wait(until.elementLocated(
                By.xpath(`//div[@class='zoneHost' and @monaco-view-zone='d${blockId}']`)),
                150, "")
                .then(async (zoneHost: WebElement) => {
                    await Misc.getCmdResultMsg(zoneHost, timeout)
                        .then((result) => {
                            toReturn.push(result);
                        })
                        .catch((e) => {
                            if (String(e).includes("Could not return")) {
                                throw new Error(`Could not get result for '${cmd}'`);
                            } else {
                                throw e;
                            }
                        });
                })
                .catch(() => {
                    toReturn.push("");
                });
        }

        return toReturn;
    };

    private static getPromptTextLine = async (prompt: String): Promise<String> => {
        const context = await driver.findElement(By.css(".monaco-editor-background"));
        const lines = await context.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));

        let tags: WebElement[];
        switch (prompt) {
            case "last": {
                tags = await lines[lines.length - 1].findElements(By.css("span > span"));
                break;
            }
            case "last-1": {
                tags = await lines[lines.length - 2].findElements(By.css("span > span"));
                break;
            }
            case "last-2": {
                tags = await lines[lines.length - 3].findElements(By.css("span > span"));
                break;
            }
            default: {
                throw new Error("Error getting line");
            }
        }

        let sentence = "";
        for (const tag of tags) {
            sentence += (await tag.getText()).replace("&nbsp;", " ");
        }

        return sentence;
    };

    private static getValueFromMap = (item: string, map?: Map<string, number>): number => {
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
}
