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
import {
    VSBrowser,
    WebDriver,
    WebElement,
    By,
    until,
    Key as key,
    SideBarView,
    CustomTreeSection,
    Workbench,
    OutputView,
    Key as selKey,
    ITimeouts,
    ActivityBar,
    EditorView,
    error,
    TreeItem,
    InputBox,
    Condition,
    BottomBarPanel,
    Notification,
} from "vscode-extension-tester";
import clipboard from "clipboardy";
import { expect } from "chai";
import { ChildProcess, spawn } from "child_process";
import addContext from "mochawesome/addContext";
import fs from "fs/promises";
import { Database, IConnBasicMySQL, IDBConnection } from "./db";
import { join } from "path";

export const dbTreeSection = "DATABASE CONNECTIONS";
export const ociTreeSection = "ORACLE CLOUD INFRASTRUCTURE";
export const openEditorsTreeSection = "OPEN EDITORS";
export const tasksTreeSection = "MYSQL SHELL TASKS";
export const openEditorsDBNotebook = "DB Notebook";
export const dbEditorDefaultName = "MySQL Shell";
export const dbConnectionsLabel = "DB Connections";

export const explicitWait = 5000;
export const ociExplicitWait = 10000;
export const ociTasksExplicitWait = 50000;

export let isExtPrepared = false;
export const dbMaxLevel = 5;
export const ociMaxLevel = 5;
export const openEditorsMaxLevel = 5;
export const tasksMaxLevel = 1;
export let driver: WebDriver;

export class Misc {

    public static prepareExtension = async (): Promise<void> => {
        await Misc.loadDriver();
        let activityBar = new ActivityBar();
        await (await activityBar.getViewControl("MySQL Shell for VS Code"))?.openView();
        const openEditors = new EditorView();

        await driver.wait(async () => {
            return (await openEditors.getOpenEditorTitles()).includes("Welcome to MySQL Shell");
        }, explicitWait * 2, "Welcome tab was not displayed");

        await Misc.reloadVSCode();

        try {
            await fs.truncate(Misc.getMysqlshLog());
        } catch (e) {
            await driver.wait(async () => {
                try {
                    await fs.truncate(Misc.getMysqlshLog());

                    return true;
                } catch (e) {
                    // continue
                }
            }, explicitWait,
            `mysqlsh.log was not created for suite ${String(process.env.TEST_SUITE)}`);
        }

        await new EditorView().closeAllEditors();
        activityBar = new ActivityBar();
        await (await activityBar.getViewControl("MySQL Shell for VS Code"))?.openView();

        await Misc.checkCertificate();

        isExtPrepared = true;
    };

    public static getSection = async (name: string): Promise<CustomTreeSection> => {
        return await new SideBarView().getContent().getSection(name) as CustomTreeSection;
    };

    public static isDefaultItem = async (
        treeItem: TreeItem,
        itemType: string,
    ): Promise<boolean | undefined> => {

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
                    await driver.actions().sendKeys(selKey.chord(selKey.CONTROL, "j")).perform();
                    output = await bottombar.findElement(By.xpath("//a[contains(@aria-label, 'Output (')]"));

                    return output.isDisplayed();
                }, explicitWait, "");
                await output!.click();
            }
        }

    };

    public static selectContextMenuItem = async (
        treeItem: TreeItem,
        ctxMenuItem: string,
    ): Promise<void> => {

        if (treeItem) {
            await driver.wait(async () => {
                try {
                    const ctxMenuItems = ctxMenuItem.split("->");
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
            }, explicitWait, `Could not select '${ctxMenuItem}' for Tree Item '${await treeItem.getLabel()}'`);
        } else {
            throw new Error(`TreeItem for context menu '${ctxMenuItem}' is undefined`);
        }
    };

    public static clickSectionToolbarButton = async (
        section: CustomTreeSection,
        buttonName: string): Promise<void> => {

        const button = await section?.getAction(buttonName);

        const tryClick = async (): Promise<void> => {
            try {
                await button?.click();
            } catch (e) {
                if (!(e instanceof error.ElementNotInteractableError)) {
                    throw e;
                } else {
                    const sectionRect = await section.getRect();
                    await driver.actions().move(
                        {
                            x: sectionRect.x + 50,
                            y: sectionRect.y + 50,
                        },
                    ).perform();
                    await button?.click();
                }
            }
        };

        await tryClick();

        await driver.wait(async () => {
            if (buttonName !== "Collapse All" &&
                buttonName !== "Configure the OCI Profile list" &&
                !buttonName.includes("Reload")) {
                try {
                    await driver.wait(until.elementsLocated(By.xpath("//div[contains(@id, 'webview-')]")),
                        3000, "No frames were found");

                    return true;
                } catch (e) {
                    await tryClick();

                    return false;
                }
            }

            return true;
        }, explicitWait, `Clicking on '${buttonName}' did not opened the corresponding tab`);
    };

    public static selectMoreActionsItem = async (
        section: CustomTreeSection,
        item: string): Promise<void> => {

        const button = await section?.getAction("More Actions...");

        await driver.wait(async () => {
            await section.click();

            return button?.isDisplayed();
        }, explicitWait, `'More Actions...' button was not visible`);

        const moreActions = await section?.moreActions();
        const moreActionsItem = await moreActions?.getItem(item);
        await moreActionsItem?.select();
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
        await driver
            .actions()
            .keyDown(key.CONTROL)
            .sendKeys(key.ENTER)
            .keyUp(key.CONTROL)
            .perform();
    };

    public static getNextResultBlockId = async (): Promise<string | undefined> => {
        await driver.wait(until.elementLocated(By.css("textarea")), explicitWait, "Could not find the text area");
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

    public static execCmd = async (
        cmd: string,
        button?: string,
        timeout?: number,
        slowWriting?: boolean): Promise<Array<string | WebElement | boolean | undefined>> => {

        cmd = cmd.replace(/(\r\n|\n|\r)/gm, "");
        const count = (cmd.match(/;|select|SELECT/g) || []).length;
        const hasMultipleQueries = count >= 3 && cmd.toLowerCase().startsWith("select");

        const nextBlockId = await Misc.getNextResultBlockId();

        if (cmd.length > 0) {
            await Misc.writeCmd(cmd, slowWriting);
        }

        if (button) {
            const btn = await Database.getToolbarButton(button);
            await btn?.click();
        } else {
            await Misc.execOnEditor();
        }

        timeout = timeout ?? 5000;

        return Misc.getCmdResult(cmd, String(nextBlockId), timeout, hasMultipleQueries);
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

        const img = await driver.takeScreenshot();
        const testName = testContext.currentTest?.title;
        const ssDir = `${String(process.env.WORKSPACE)}/screenshots`;
        try {
            await fs.access(ssDir);
        } catch (e) {
            await fs.mkdir(ssDir);
        }
        const imgPath = join(ssDir, `${String(testName)}_screenshot.png`);
        await fs.writeFile(imgPath, img, "base64");

        addContext(testContext, { title: "Failure", value: `../screenshots/${String(testName)}_screenshot.png` });

    };

    public static switchToWebView = async (): Promise<void> => {
        const iframeDivs = await driver.wait(until.elementsLocated(By.xpath("//div[contains(@id, 'webview-')]")),
            ociExplicitWait, "No frames were found");
        let refIframe: WebElement | undefined;

        for (const iframeDiv of iframeDivs) {
            const style = await iframeDiv.getAttribute("style");
            if (style.includes("visibility: visible")) {
                refIframe = await iframeDiv.findElement(By.css("iframe"));
                break;
            }
        }

        await driver.wait(until.ableToSwitchToFrame(refIframe as WebElement),
            ociExplicitWait, "Not able to switch to first iframe");

        await driver.wait(until.ableToSwitchToFrame(
            By.id("active-frame")), ociExplicitWait, `Not able to switch to 'active-frame'`);

        try {
            const webViewFrame = await driver.findElement(By.css("iframe")).getAttribute("id");

            await driver.wait(until.ableToSwitchToFrame(By.id(webViewFrame))
                ,explicitWait, `Not able to switch to frame 'frame:${webViewFrame}'`);
        } catch (e) {
            //continue, no more iframes
        }

    };

    public static isRouterInstalled = async (): Promise <boolean> => {
        const dirFiles = await fs.readdir("C:/Program Files/MySQL");
        for (const item of dirFiles) {
            if (item.includes("MySQL Router")) {
                return true;
            }
        }
    };

    public static verifyNotification = async (text: string, waitToDisappear = false): Promise<void> => {
        let ntfs: Notification[];

        await driver.wait(new Condition("", async () => {
            ntfs = await new Workbench().getNotifications();

            return ntfs.length > 0;
        }), ociExplicitWait, "Could not find any notification");

        for (const ntf of ntfs) {
            if ((await ntf.getMessage()).includes(text)) {
                if (waitToDisappear) {
                    await driver.wait(until.stalenessOf(ntf), ociExplicitWait, `'${text}' is still displayed`);
                }

                return;
            }
        }
        throw new Error(`Could not find notification '${text}'`);
    };

    public static execOnTerminal = async (cmd: string, timeout: number): Promise<void> => {
        const bootomBar = new BottomBarPanel();
        const terminal = await bootomBar.openTerminalView();
        timeout = timeout ?? explicitWait;
        await terminal.executeCommand(cmd, timeout);
    };

    public static waitForTerminalText = async (textToSearch: string,
        timeout: number): Promise<void> => {
        await driver.wait(async () => {
            const out = await Misc.getTerminalOutput();

            return out.includes(textToSearch);
        }, timeout, `Could not find text '${textToSearch}' on the terminal`);
    };

    public static terminalHasErrors = async (): Promise<boolean> => {
        const out = await Misc.getTerminalOutput();

        return out.includes("ERR") || out.includes("err");
    };


    public static waitForOutputText = async (textToSearch: string,
        timeout: number): Promise<void> => {
        await driver.wait(async () => {
            try {
                const scrollEl = await driver.findElements(By.css("#workbench.panel.output .editor-scrollable"));
                if (scrollEl.length > 0) {
                    await driver.executeScript("arguments[0].scrollBy(0, 500)", scrollEl);
                }
                const output = new OutputView();
                const text = await output.getText();

                return text.includes(textToSearch);
            } catch (e) {
                console.error(e);

                return false;
            }

        }, timeout, `'${textToSearch}' was not found on Output view`);
    };

    public static isNotLoading = (section: CustomTreeSection): Condition<boolean> => {
        return new Condition("", async () => {
            const loading = await section.findElements(By.css(".monaco-progress-container.active"));

            return loading.length === 0;
        });
    };

    public static setInputPassword = async (password: string): Promise<void> => {
        await driver.wait(async () => {
            try {
                const input = new InputBox();
                await input.setText(password);
                await input.confirm();
                try {
                    await input.setText("N");
                    await input.confirm();
                } catch (e) {
                    // continue
                }

                return true;
            } catch (e) {
                return false;
            }
        }, explicitWait, "Input password was not displayed");
    };


    public static setConfirmDialog = async (dbConfig: IDBConnection, value: string,
        timeoutDialog = 500): Promise<void> => {

        await driver.wait(until.elementsLocated(By.css(".confirmDialog")),
            timeoutDialog, "No confirm dialog was found");

        const confirmDialog = await driver.findElement(By.css(".confirmDialog"));

        expect(await confirmDialog.findElement(By.css(".title label")).getText()).to.equals("Confirm");

        const username = String((dbConfig.basic as IConnBasicMySQL).username);
        const hostname = String((dbConfig.basic as IConnBasicMySQL).hostname);
        const port = String((dbConfig.basic as IConnBasicMySQL).port);

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
        const textArea = await driver.findElement(By.css("textarea"));
        await textArea
            .sendKeys(selKey.chord(selKey.CONTROL, "a", "a"));

        await textArea.sendKeys(selKey.BACK_SPACE);
        await driver.wait(async () => {
            return await this.getPromptTextLine("last") === "";
        }, 3000, "Prompt was not cleaned");
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

        const result = [];

        const resultSet = await driver.wait(async () => {
            return (await resultHost.findElements(By.css(".tabulator-headers")))[0];
        }, explicitWait, "No tabulator-headers detected");

        const resultHeaderRows = await driver.wait(async () => {
            return resultSet.findElements(By.css(".tabulator-col-title"));
        }, explicitWait, "No tabulator-col-title detected");

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
                let context;
                if (zoneHost) {
                    context = zoneHost;
                } else {
                    const blocks = await driver.wait(until.elementsLocated(By.css(".zoneHost")),
                        explicitWait, "No zone hosts were found");
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
                    resultToReturn = await actionLabel[0].getAttribute("innerHTML");

                    return resultToReturn;
                }

                const actionOutput = await context.findElements(By.css(".actionOutput"));
                if (actionOutput.length > 0) {
                    resultToReturn = await actionOutput[0].findElement(By.css(".info")).getAttribute("innerHTML");

                    return resultToReturn;
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

    public static getActionButton = async (treeItem: TreeItem, actionButton: string): Promise <WebElement> => {
        return driver.wait(async () => {
            try {
                let locator = ".//a[contains(@class, 'action-label') ";
                locator += `and @role='button' and @aria-label='${actionButton}']`;

                const btn = await treeItem.findElement(By.xpath(locator));

                const treeItemCoord = await treeItem.getRect();
                await driver.actions().move({ x: treeItemCoord.x, y: treeItemCoord.y }).perform();
                await driver.wait(until.elementIsVisible(btn),
                    explicitWait, `'${actionButton}' button was not visible`);

                return btn;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, explicitWait, `Could not get icon for '${await treeItem.getLabel()}' (button was always stale)`);
    };

    public static getMysqlshLog = (): string => {
        if (process.env.TEST_SUITE !== undefined) {
            return join(String(process.env.USERPROFILE), `mysqlsh-${String(process.env.TEST_SUITE)}`, "mysqlsh.log");
        } else {
            return join(String(process.env.APPDATA), "MySQL", "mysqlsh-gui", "mysqlsh.log");
        }
    };

    public static isRouterActive = async (treeItem: TreeItem): Promise<boolean> => {
        const icon = await treeItem.findElement(By.css(".custom-view-tree-node-item-icon"));
        const style = await icon.getAttribute("style");

        return !style.includes("routerNotActive");
    };

    public static sectionFocus = async (section: string): Promise <void> => {
        const treeDBSection = await Misc.getSection(dbTreeSection);
        const treeOCISection = await Misc.getSection(ociTreeSection);
        const treeOpenEditorsSection = await Misc.getSection(openEditorsTreeSection);
        const treeTasksSection = await Misc.getSection(tasksTreeSection);

        if ((await treeDBSection.getTitle()) === section) {
            await driver.wait(new Condition("", async () => {

                await treeDBSection.expand();
                await treeOCISection.collapse();
                await treeOpenEditorsSection.collapse();
                await treeTasksSection.collapse();

                return (await treeDBSection.isExpanded()) &&
                     (!await treeOCISection.isExpanded()) &&
                     (!await treeOpenEditorsSection.isExpanded()) &&
                     (!await treeTasksSection.isExpanded());

            }), explicitWait, `${section} was not focused`);
        } else if ((await treeOCISection.getTitle()) === section) {
            await driver.wait(new Condition("", async () => {

                await treeOCISection.expand();
                await treeDBSection.collapse();
                await treeOpenEditorsSection.collapse();
                await treeTasksSection.collapse();

                return (await treeOCISection.isExpanded()) &&
                     (!await treeDBSection.isExpanded()) &&
                     (!await treeOpenEditorsSection.isExpanded()) &&
                     (!await treeTasksSection.isExpanded());

            }), explicitWait, `${section} was not focused`);
        } else if ((await treeOpenEditorsSection.getTitle()) === section) {
            await driver.wait(new Condition("", async () => {

                await treeOpenEditorsSection.expand();
                await treeDBSection.collapse();
                await treeOCISection.collapse();
                await treeTasksSection.collapse();

                return (await treeOpenEditorsSection.isExpanded()) &&
                     (!await treeDBSection.isExpanded()) &&
                     (!await treeOCISection.isExpanded()) &&
                     (!await treeTasksSection.isExpanded());

            }), explicitWait, `${section} was not focused`);
        } else if ((await treeTasksSection.getTitle()) === section) {
            await driver.wait(new Condition("", async () => {

                await treeTasksSection.expand();
                await treeDBSection.collapse();
                await treeOCISection.collapse();
                await treeOpenEditorsSection.collapse();

                return (await treeTasksSection.isExpanded()) &&
                     (!await treeDBSection.isExpanded()) &&
                     (!await treeOCISection.isExpanded()) &&
                     (!await treeOpenEditorsSection.isExpanded());

            }), explicitWait, `${section} was not focused`);
        } else {
            throw new Error(`Unknow section: ${section}`);
        }
    };

    public static getTreeScript = async (section: CustomTreeSection,
        partialName: string, type: string): Promise <TreeItem> => {
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
        }), explicitWait, `Could not find the script '${partialName}' with type '${type}' on the Open Editors tree`);
    };

    private static getTerminalOutput = async (): Promise<string> => {
        const workbench = new Workbench();
        await workbench.executeCommand("terminal select all");
        await driver.sleep(1000);
        const terminal = await driver.findElement(By.css("#terminal textarea"));
        await terminal.sendKeys(selKey.chord(key.CONTROL, "c"));
        const out = clipboard.readSync();
        clipboard.writeSync("");

        return out;
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

    private static getCmdResultToolbar = async (zoneHost: WebElement): Promise <WebElement | undefined> => {
        let context;
        if (zoneHost) {
            context = zoneHost;
        } else {
            const blocks = await driver.wait(until.elementsLocated(By.css(".zoneHost")),
                explicitWait, "No zone hosts were found");
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
        let zoneHost;

        if (!cmd.includes("disconnect")) {
            if (blockId === "0") {
                const zoneHosts = await driver.wait(until.elementsLocated(By.css(".zoneHost")), timeout,
                    `zoneHosts not found for '${cmd}'`);
                zoneHost = zoneHosts[zoneHosts.length - 1];
            } else {
                zoneHost = await driver.wait(
                    until.elementLocated(By.xpath(`//div[@class='zoneHost' and @monaco-view-zone='${blockId}']`)),
                    timeout, `Could not get the result block '${blockId}' for '${cmd}'`);
            }

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

    private static loadDriver = async (): Promise<void> => {

        let browser: VSBrowser;
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

    private static reloadVSCode = async (): Promise<void> => {
        const reload = async () => {
            const workbench = new Workbench();
            await workbench.executeCommand("workbench.action.reloadWindow");
            await driver.sleep(2000);
        };

        try {
            await reload();
        } catch (e) {
            await reload();
        }

    };

    private static hasNotifications = async (): Promise<boolean> => {
        try {
            const workbench = new Workbench();

            return (await workbench.getNotifications()).length > 0;
        } catch (e) {
            if (e instanceof error.StaleElementReferenceError) {
                return false;
            } else {
                throw e;
            }
        }
    };

    private static getPromptTextLine = async (prompt: String): Promise<String> => {
        const context = await driver.findElement(By.css(".monaco-editor-background"));
        const lines = await context.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));

        let tags;
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

    private static checkCertificate = async (): Promise<void> => {
        await driver.wait(async () => {
            const text = await fs.readFile(Misc.getMysqlshLog());
            if (text.includes("Certificate is not installed")) {
                throw new Error("Certificate is not installed");
            } else if (
                text.includes("Mode: Single user") ||
                text.includes("Certificate is installed")
            ) {
                return true;
            }
        }, 15000, "Could not verify certificate installation");
    };
}
