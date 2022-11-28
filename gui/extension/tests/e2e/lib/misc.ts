/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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
    CustomTreeItem,
    CustomTreeSection,
    Workbench,
    OutputView,
    Key as selKey,
    Locator,
    ITimeouts,
} from "vscode-extension-tester";
import { expect } from "chai";
import { ChildProcess, spawn } from "child_process";
import { platform } from "os";
import addContext from "mochawesome/addContext";
import fs from "fs/promises";
import { TreeSection } from "monaco-page-objects/out/components/sidebar/tree/TreeSection";
import { IDBConnection } from "./db";
import { join } from "path";

let dbTreeSectionCust: CustomTreeSection | undefined;
let ociTreeSectionCust: CustomTreeSection | undefined;
let consolesTreeSectionCust: CustomTreeSection | undefined;
let tasksTreeSectionCust: CustomTreeSection | undefined;

export const dbTreeSection = "DATABASE CONNECTIONS";
export const ociTreeSection = "ORACLE CLOUD INFRASTRUCTURE";
export const consolesTreeSection = "MYSQL SHELL CONSOLES";
export const tasksTreeSection = "MYSQL SHELL TASKS";

export const explicitWait = 5000;
export const ociExplicitWait = 10000;
export const ociTasksExplicitWait = 50000;

export const mysqlshLog = join(String(process.env.APPDATA), "MySQL", "mysqlsh-gui", "mysqlsh.log");

export let driver: WebDriver;

export class Misc {

    public static loadDriver = async (): Promise<void> => {

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

    public static getSection = async (name: string): Promise<WebElement | undefined> => {

        const leftSideBar = await driver.findElement(By.id("workbench.view.extension.msg-view"));
        const sections = await leftSideBar.findElements(By.css(".split-view-view.visible"));
        for (const section of sections) {
            if (await section.findElement(By.css("h3.title")).getText() === name) {
                return section;
            }
        }

        throw new Error(`Could not find section named ${name}`);
    };

    public static getTreeElement = async (section: string,
        el: string): Promise<WebElement> => {

        const sec = await this.getSection(section);

        if (el.includes("*")) {
            return sec!.findElement(By.xpath(`//div[contains(@aria-label, '${el.replace("*", "")}')]`));
        } else {
            return sec!.findElement(By.xpath(`//div[@aria-label="${el} "]`));
        }

    };

    public static isDefaultItem = async (section: string, itemType: string,
        itemName: string): Promise<boolean | undefined> => {

        const root = await this.getTreeElement(section, itemName);
        const el = await root.findElement(By.css(".custom-view-tree-node-item-icon"));
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

    public static initTreeSection = async (section: string): Promise<void> => {

        switch (section) {
            case dbTreeSection: {
                if (!dbTreeSectionCust) {
                    dbTreeSectionCust = await new SideBarView().getContent()
                        .getSection(dbTreeSection) as CustomTreeSection;
                }
                break;
            }
            case ociTreeSection: {
                if (!ociTreeSectionCust) {
                    ociTreeSectionCust = await new SideBarView().getContent()
                        .getSection(ociTreeSection) as CustomTreeSection;

                }
                break;
            }
            case consolesTreeSection: {
                if (!consolesTreeSectionCust) {
                    consolesTreeSectionCust = await new SideBarView().getContent()
                        .getSection(consolesTreeSection) as CustomTreeSection;
                }
                break;
            }
            case tasksTreeSection: {
                if (!tasksTreeSectionCust) {
                    tasksTreeSectionCust = await new SideBarView().getContent()
                        .getSection(tasksTreeSection) as CustomTreeSection;
                }
                break;
            }
            default: {
                break;
            }
        }

    };

    public static selectContextMenuItem = async (
        section: string, treeItem: string,
        ctxMenuItem: string): Promise<void> => {
        const ctxMenuItems = ctxMenuItem.split("->");

        let treeSection: CustomTreeSection | undefined;

        switch (section) {
            case dbTreeSection: {
                treeSection = dbTreeSectionCust;
                break;
            }
            case ociTreeSection: {
                treeSection = ociTreeSectionCust;
                break;
            }
            case consolesTreeSection: {
                treeSection = consolesTreeSectionCust;
                break;
            }
            case tasksTreeSection: {
                treeSection = tasksTreeSectionCust;
                break;
            }
            default: {
                break;
            }
        }

        const perform = async () => {
            const item = await this.getTreeElement(section, treeItem);
            const cstTreeItem = new CustomTreeItem(item, treeSection as TreeSection);
            const ctx = await cstTreeItem?.openContextMenu();
            await ctx.wait(5000);
            const ctxItem = await ctx?.getItem(ctxMenuItems[0].trim());
            const menu = await ctxItem!.select();
            if (ctxMenuItems.length > 1) {
                await (await menu?.getItem(ctxMenuItems[1].trim()))!.select();
            }
        };

        try {
            await perform();
        } catch (e) {
            if (typeof e === "object" && String(e).includes("StaleElementReferenceError")) {
                await perform();
            } else {
                throw e;
            }
        }

    };

    public static getSectionToolbarButton = async (
        sectionName: string,
        buttonName: string): Promise<WebElement> => {

        const section = await this.getSection(sectionName);
        expect(section).to.exist;
        await section!.click();

        let btn: WebElement | undefined;
        const buttons = await section!.findElements(By.css(".actions li"));
        for (const button of buttons) {
            let title = await button.getAttribute("title");
            if (title === "") {
                title = await (await button.findElement(By.css("a"))).getAttribute("title");
            }
            if (title === buttonName) {
                btn = button;
                break;
            }
        }

        await section!.click();
        await driver.wait(until.elementIsVisible(btn!), 2000, `${buttonName} is not visible`);

        return btn!;

    };

    public static selectMoreActionsItem = async (
        section: string, item: string): Promise<void> => {

        const sec = await this.getSection(section);
        await sec!.click();

        const moreActionsBtn = await this.getSectionToolbarButton(section, "More Actions...");
        await moreActionsBtn.click();

        await driver.wait(async () => {
            return (await driver.findElements(By.css(".context-menu-visible"))).length === 1;
        }, 2000,
        "More Actions Context menu was not displayed");


        await driver.wait(async () => {
            try {
                const el: WebElement = await driver.executeScript(`return document.querySelector(".shadow-root-host").
                shadowRoot.querySelector("span[aria-label='${item}']")`);

                await el.click();

                return (await driver.findElements(By.css(".context-menu-visible"))).length === 0;
            } catch (e) {
                if (typeof e === "object" && String(e).includes("StaleElementReferenceError")) {
                    return false;
                }
            }

        }, 3000, "More Actions context menu is still displayed");

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

    public static toggleTreeElement = async (section: string,
        el: string, expanded: boolean): Promise<void> => {

        await driver.wait(async () => {
            const element = await this.getTreeElement(section, el);
            const ariaExpanded = await element.getAttribute("aria-expanded");
            if (ariaExpanded !== String(expanded)) {
                const toggle = await element?.findElement(By.css(".codicon-tree-item-expanded"));
                await toggle?.click();
                await driver.sleep(500);

                return false;
            } else {

                return true;
            }
        }, explicitWait, `${section} > ${el} was not toggled`);
    };

    public static getFirstTreeChild = async (section: string, parent: string): Promise<string> => {

        await this.toggleTreeElement(section, parent, true);
        const parentNode = await this.getTreeElement(section, parent);
        const parentNodeId = await parentNode.getAttribute("id");
        const parentNodeLevel = await parentNode.getAttribute("aria-level");
        const parentIds = parentNodeId.match(/list_id_(\d+)_(\d+)/);
        const childId = `list_id_${parentIds![1]}_${Number(parentIds![2]) + 1}`;
        const childLevel = Number(parentNodeLevel) + 1;

        const childs = await driver.findElements(By.xpath(`//div[@id='${childId}' and @aria-level='${childLevel}']`));
        if (childs.length > 0) {
            return (await childs[0].getAttribute("aria-label")).trim();
        } else {
            throw new Error(`Tree item '${parent}' does not have childs`);
        }
    };

    public static hasTreeChildren = async (section: string,
        parent: string, checkChild?: string): Promise<boolean> => {
        const parentNode = await this.getTreeElement(section, parent);
        const parentNodeId = await parentNode.getAttribute("id");
        const parentNodeLevel = await parentNode.getAttribute("aria-level");
        const parentIds = parentNodeId.match(/list_id_(\d+)_(\d+)/);
        const childId = `list_id_${parentIds![1]}_${Number(parentIds![2]) + 1}`;
        const childLevel = Number(parentNodeLevel) + 1;

        const childs = await driver.findElements(By.xpath(`//div[@id='${childId}' and @aria-level='${childLevel}']`));

        if (checkChild) {
            for (const child of childs) {
                const name = await child.getAttribute("aria-label");
                if (name.indexOf(checkChild) !== -1) {
                    return true;
                }
            }

            return false;
        } else {
            return childs.length > 0;
        }

    };

    public static toggleSection = async (section: string, open: boolean): Promise<void> => {
        await driver.wait(async () => {
            const btn = await driver.findElement(By.xpath(`//div[contains(@aria-label, '${section} Section')]/div`));
            await driver.executeScript("arguments[0].click()", btn);
            const el = await driver.findElement(By.xpath(`//div[contains(@aria-label, '${section} Section')]`));
            const result = JSON.parse(await el.getAttribute("aria-expanded"));
            if (open) {
                if (result) {
                    return true;
                } else {
                    return false;
                }
            } else {
                if (result) {
                    return false;
                } else {
                    return true;
                }
            }
        }, 2000, "Toggle was not expanded/collapsed");
    };

    public static execOnEditor = async (): Promise<void> => {
        await driver
            .actions()
            .keyDown(key.CONTROL)
            .sendKeys(key.ENTER)
            .keyUp(key.CONTROL)
            .perform();
    };

    public static execCmd = async (textArea: WebElement, cmd: string,
        timeout?: number): Promise<void> => {

        cmd = cmd.replace(/(\r\n|\n|\r)/gm, "");
        const prevBlocks = await driver.findElements(By.css(".zoneHost"));

        await textArea.sendKeys(cmd);

        await textArea.sendKeys(key.ENTER);

        await this.execOnEditor();

        if (!timeout) {
            timeout = 3000;
        }

        if (cmd !== "\\q" && cmd !== "\\d") {
            await driver.wait(async () => {
                const blocks = await driver.findElements(By.css(".zoneHost"));

                return blocks.length > prevBlocks.length;
            }, timeout, "Command '" + cmd + "' did not triggered a new results block");
        }
    };

    public static reloadVSCode = async (): Promise<void> => {
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

    public static existsTreeElement = async (
        section: string, el: string): Promise<boolean> => {
        const sec = await this.getSection(section);
        let locator: Locator;
        if (el.includes("*")) {
            locator = By.xpath("//div[contains(@aria-label, '" + el.replace("*", "") + "')]");
        } else {
            locator = By.xpath(`//div[@aria-label="${el} "]`);
        }

        try {
            await driver.wait(async () => {
                return (await sec!.findElements(locator)).length > 0;
            }, 3000, `${el} was not found`);

            return true;
        } catch (e) {
            return false;
        }
    };

    public static reloadSection = async (sectionName: string): Promise<void> => {
        const section = await this.getSection(sectionName);
        await section!.click();
        let btnName = "";
        switch (sectionName) {
            case dbTreeSection: {
                btnName = "Reload the connection list";
                break;
            }
            case ociTreeSection: {
                btnName = "Reload the OCI Profile list";
                break;
            }
            default: {
                break;
            }
        }
        const reloadConnsBtn = await this.getSectionToolbarButton(sectionName, btnName);
        await reloadConnsBtn.click();
    };

    public static processFailure = async (testContext: Mocha.Context): Promise<void> => {

        const img = await driver.takeScreenshot();
        const testName = testContext.currentTest?.title;
        try {
            await fs.access("tests/e2e/screenshots");
        } catch (e) {
            await fs.mkdir("tests/e2e/screenshots");
        }
        const imgPath = `tests/e2e/screenshots/${String(testName)}_screenshot.png`;
        await fs.writeFile(imgPath, img, "base64");

        addContext(testContext, { title: "Failure", value: `../${imgPath}` });

    };

    public static switchToWebView = async (): Promise<void> => {
        await driver.wait(until.ableToSwitchToFrame(0), explicitWait, "Not able to switch to frame 0");
        await driver.wait(until.ableToSwitchToFrame(
            By.id("active-frame")), explicitWait, "Not able to switch to frame 2");
        const nextFrame = await driver.findElement(By.css("iframe")).getAttribute("id");
        await driver.wait(until.ableToSwitchToFrame(
            By.id(nextFrame)), explicitWait, "Not able to switch to frame 3");

        await driver.wait(async () => {
            try {
                await driver.findElements(By.css(".zoneHost"));

                return true;
            } catch (e) {
                return false;
            }
        }, 10000, "WebView content was not loaded");
    };

    public static hasNotifications = async (): Promise<boolean> => {
        try {
            const workbench = new Workbench();

            return (await workbench.getNotifications()).length > 0;
        } catch (e) {
            if (typeof e === "object" && String(e).includes("StaleElementReferenceError")) {
                return false;
            } else {
                throw e;
            }
        }
    };

    public static verifyNotification = async (text: string, waitToDisappear = false): Promise<void> => {
        await driver.wait(async () => {
            try {
                const workbench = new Workbench();

                const ntfs = await workbench.getNotifications();

                return (await ntfs[ntfs.length - 1].getMessage()).includes(text);
            } catch (e) {
                return false;
            }
        }, ociExplicitWait, `Notification with text '${text}' was not found`);

        if (waitToDisappear) {
            await driver.wait(async () => {
                return (await Misc.hasNotifications()) === false;
            }, explicitWait, `'${text}' notification is still visible`);
        }

    };

    public static waitForOutputText = async (view: OutputView, textToSearch: string,
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

    public static hasLoadingBar = async (section: string): Promise<boolean> => {
        const sectionObj = await this.getSection(section);

        return (await sectionObj!.findElements(By.css(".monaco-progress-container.active"))).length > 0;
    };

    public static setConfirmDialog = async (dbConfig: IDBConnection, value: string): Promise<void> => {

        await driver.wait(until.elementsLocated(By.css(".confirmDialog")),
            500, "No confirm dialog was found");

        const confirmDialog = await driver.findElement(By.css(".confirmDialog"));

        expect(await confirmDialog.findElement(By.css(".title label")).getText()).to.equals("Confirm");

        let uri = `Save password for '${String(dbConfig.username)}@${String(dbConfig.hostname)}:`;
        uri += `${String(dbConfig.port)}'?`;

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

    public static getPromptTextLine = async (prompt: String): Promise<String> => {
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

    public static cleanEditor = async (): Promise<void> => {
        const textArea = await driver.findElement(By.css("textarea"));
        if (platform() === "win32") {
            await textArea
                .sendKeys(selKey.chord(selKey.CONTROL, "a", "a"));
        } else if (platform() === "darwin") {
            await textArea
                .sendKeys(selKey.chord(selKey.COMMAND, "a", "a"));
        }
        await textArea.sendKeys(selKey.BACK_SPACE);
        await driver.wait(async () => {
            return await this.getPromptTextLine("last") === "";
        }, 3000, "Prompt was not cleaned");
    };

    public static hideSection = async (section:string, hide: boolean): Promise <void> => {
        const context = await driver.findElement(By.xpath("//a[@aria-label='Views and More Actions...']"));
        await context.click();

        const contextMenu = await driver.wait(until.elementLocated(By.css(".context-view.monaco-menu-container")),
            3000, "Could not find the context menu");

        const items = await contextMenu.findElements(By.css("li.action-item a"));
        for (const item of items) {
            const label = await item.getAttribute("innerHTML");
            if (label.includes(section) ) {
                const isChecked = (await item.getAttribute("class")).includes("checked");
                if ((isChecked && hide) || (!isChecked && !hide)) {
                    await item.click();

                    break;
                }
            }
        }

        await driver.wait(async () => {
            if (!hide) {
                return (await this.getSection(section)) !== undefined;
            } else {
                return (await this.getSection(section)) === undefined;
            }
        }, 3000, `${section} was not hidden/displayed`);
    };

    public static checkCertificate = async (): Promise<void> => {

        await driver.wait(async () => {
            const text = await fs.readFile(mysqlshLog);
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
