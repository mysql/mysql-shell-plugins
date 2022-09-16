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
    EditorView,
    until,
    Button,
    Key as key,
    SideBarView,
    CustomTreeItem,
    CustomTreeSection,
    BottomBarPanel,
    Workbench,
    OutputView,
    Key as selKey,
} from "vscode-extension-tester";
import { expect } from "chai";
import { keyboard, Key } from "@nut-tree/nut-js";
import { ChildProcess, spawn, execSync } from "child_process";
import { platform } from "os";
import addContext from "mochawesome/addContext";
import fs from "fs/promises";
import { TreeSection } from "monaco-page-objects/out/components/sidebar/tree/TreeSection";

let dbTreeSection: CustomTreeSection | undefined;
let ociTreeSection: CustomTreeSection | undefined;
let consolesTreeSection: CustomTreeSection | undefined;
let tasksTreeSection: CustomTreeSection | undefined;

export interface IDbConnection {
    caption: string;
    description: string;
    hostname: string;
    username: string;
    port: number;
    portX: number;
    schema: string;
    password: string;
}

let driver: WebDriver;

export const setDriver = async (): Promise<WebDriver | undefined> => {
    let browser: VSBrowser;

    let counter = 0;
    while (counter <= 10) {
        try {
            browser = VSBrowser.instance;
            await browser.waitForWorkbench();
            driver = browser.driver;
            await driver.manage().timeouts().implicitlyWait(5000);

            return driver;
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

export const takeScreenshot = async (context: Mocha.Context): Promise<void> => {
    const testName = context.currentTest?.title;
    const img = await driver.takeScreenshot();
    try {
        await fs.access("tests/e2e/screenshots");
    } catch (e) {
        await fs.mkdir("tests/e2e/screenshots");
    }
    const imgPath = `tests/e2e/screenshots/${String(testName)}.png`;
    await fs.writeFile(imgPath, img, "base64");

    addContext(context, { title: "Failure", value: `../${imgPath}` });
};

export const waitForWelcomePage = async (): Promise<void> => {
    await driver.wait(async () => {
        const editor = new EditorView();
        const titles = await editor.getOpenEditorTitles();

        return titles.includes("Welcome to MySQL Shell");
    }, 5000, "Welcome page was not loaded");

    await driver.wait(until.ableToSwitchToFrame(0), 5000, "frame 0 not loaded");
    await driver.wait(until.ableToSwitchToFrame(By.id("active-frame")), 5000, "frame 'active-frame not loaded'");
    await driver.findElement(By.id("nextBtn"));
    await driver.switchTo().defaultContent();
};

export const getLeftSection = async (name: string): Promise<WebElement> => {
    // eslint-disable-next-line no-useless-escape
    const leftSideBar = await driver.findElement(By.id("workbench\.view\.extension\.msg-view"));
    const sections = await leftSideBar.findElements(By.css(".split-view-view.visible"));
    let ctx: WebElement | undefined;
    for (const section of sections) {
        if (await section.findElement(By.css("h3.title")).getText() === name) {
            ctx = section;
            break;
        }
    }
    expect(ctx).to.exist;

    return ctx!;
};

export const waitForLoading = async (sectionName: string, timeout: number): Promise<void> => {
    // eslint-disable-next-line no-useless-escape
    const leftSideBar = await driver.findElement(By.id("workbench\.view\.extension\.msg-view"));
    const sections = await leftSideBar.findElements(By.css(".split-view-view.visible"));
    let ctx: WebElement | undefined;
    for (const section of sections) {
        if (await section.findElement(By.css("h3.title")).getText() === sectionName) {
            ctx = section;
            break;
        }
    }

    const progress = await ctx!.findElements(By.css(".monaco-progress-container.active.infinite"));
    if (progress.length > 0) {
        await driver.wait(async () => {
            return (await progress[0].getAttribute("class")).split(" ").includes("done");
        }, timeout, "Loading bar is still active");
    }
};

export const getTreeElement = async (section: string,
    el: string): Promise<WebElement> => {
    const sec = await getLeftSection(section);

    if (el.includes("*")) {
        return sec?.findElement(By.xpath(`//div[contains(@aria-label, '${el.replace("*", "")}')]`));
    } else {
        return sec?.findElement(By.xpath(`//div[@aria-label="${el} "]`));
    }
};

export const isDefaultItem = async (section: string, itemType: string,
    itemName: string): Promise<boolean | undefined> => {
    const root = await getTreeElement(section, itemName);
    const el = await root.findElement(By.css(".custom-view-tree-node-item > div"));
    const backImage = await el.getCssValue("background-image");

    switch (itemType) {
        case "profile":
            return backImage.indexOf("ociProfileCurrent") !== -1;
        case "compartment":
            return backImage.indexOf("folderCurrent") !== -1;
        case "bastion":
            return backImage.indexOf("ociBastionCurrent") !== -1;
        case "rest":
            return backImage.indexOf("mrsServiceDefault") !== -1;
        default:
            break;
    }

};

export const toggleBottomBar = async (expand: boolean): Promise<void> => {
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
            }, 5000, "");
            await output!.click();
        }
    }
};

export const selectItem = async (taps: Number): Promise<void> => {
    for (let i = 1; i <= taps; i++) {
        await keyboard.type(Key.Down);
    }
    await keyboard.type(Key.Enter);
};

export const initTreeSection = async (section: string): Promise<void> => {
    switch (section) {
        case "DATABASE CONNECTIONS":
            if (!dbTreeSection) {
                dbTreeSection = await new SideBarView().getContent().getSection("DATABASE CONNECTIONS") as CustomTreeSection;
            }
            break;
        case "ORACLE CLOUD INFRASTRUCTURE":
            if (!ociTreeSection) {
                ociTreeSection = await new SideBarView().getContent()
                    .getSection("ORACLE CLOUD INFRASTRUCTURE") as CustomTreeSection;
            }
            break;
        case "MYSQL SHELL CONSOLES":
            if (!consolesTreeSection) {
                consolesTreeSection = await new SideBarView().getContent()
                    .getSection("MYSQL SHELL CONSOLES") as CustomTreeSection;
            }
            break;
        case "MYSQL SHELL TASKS":
            if (!tasksTreeSection) {
                tasksTreeSection = await new SideBarView().getContent()
                    .getSection("MYSQL SHELL TASKS") as CustomTreeSection;
            }
            break;
        default:
            break;
    }
};

export const getExistingConnections = async (): Promise<string[]> => {
    const sec = await getLeftSection("DATABASE CONNECTIONS");
    const els = await sec?.findElements(By.xpath(`//div[contains(@aria-label, 'conn')]`));
    const connections = [];
    for (const el of els) {
        const text = (await el.getAttribute("aria-label")).trim();
        connections.push(text);
    }

    return connections;
};

export const selectContextMenuItem = async (
    section: string, treeItem: string,
    ctxMenuItem: string): Promise<void> => {
    const ctxMenuItems = ctxMenuItem.split("->");

    let treeSection: CustomTreeSection | undefined;

    switch (section) {
        case "DATABASE CONNECTIONS":
            treeSection = dbTreeSection;
            break;
        case "ORACLE CLOUD INFRASTRUCTURE":
            treeSection = ociTreeSection;
            break;
        case "MYSQL SHELL CONSOLES":
            treeSection = consolesTreeSection;
            break;
        case "MYSQL SHELL TASKS":
            treeSection = tasksTreeSection;
            break;
        default:
            break;
    }

    const perform = async () => {
        const item = await getTreeElement(section, treeItem);
        const cstTreeItem = new CustomTreeItem(item, treeSection as TreeSection);
        const ctx = await cstTreeItem?.openContextMenu();
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

export const isJson = (text: string): boolean => {
    try {
        JSON.parse(text);

        return true;
    } catch (e) {
        console.error(e);

        return false;
    }
};

export const getLeftSectionButton = async (
    sectionName: string,
    buttonName: string): Promise<WebElement> => {

    const section = await getLeftSection(sectionName);
    expect(section).to.exist;
    await section.click();

    let btn: WebElement | undefined;
    const buttons = await section.findElements(By.css(".actions li"));
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

    await section.click();
    await driver.wait(until.elementIsVisible(btn!), 2000, `${buttonName} is not visible`);

    return btn!;
};

export const selectMoreActionsItem = async (
    section: string, item: string): Promise<void> => {

    const sec = await getLeftSection(section);
    await sec.click();

    const moreActionsBtn = await getLeftSectionButton(section, "More Actions...");
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

export const createDBconnection = async (dbConfig: IDbConnection): Promise<void> => {
    const createConnBtn = await getLeftSectionButton("DATABASE CONNECTIONS", "Create New MySQL Connection");
    await createConnBtn?.click();

    const editorView = new EditorView();
    const editor = await editorView.openEditor("DB Connections");
    expect(await editor.getTitle()).to.equals("DB Connections");

    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
    await driver.switchTo().frame(await driver.findElement(By.id("frame:DB Connections")));

    const newConDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
        10000, "Connection dialog was not loaded");
    await driver.wait(async () => {
        await newConDialog.findElement(By.id("caption")).clear();

        return !(await driver.executeScript("return document.querySelector('#caption').value"));
    }, 3000, "caption was not cleared in time");
    await newConDialog.findElement(By.id("caption")).sendKeys(dbConfig.caption);
    await newConDialog.findElement(By.id("description")).clear();
    await newConDialog
        .findElement(By.id("description"))
        .sendKeys(dbConfig.description);
    await newConDialog.findElement(By.id("hostName")).clear();
    await newConDialog.findElement(By.id("hostName")).sendKeys(dbConfig.hostname);
    await driver.findElement(By.css("#port input")).clear();
    await driver.findElement(By.css("#port input")).sendKeys(dbConfig.port);
    await newConDialog.findElement(By.id("userName")).sendKeys(dbConfig.username);
    await newConDialog
        .findElement(By.id("defaultSchema"))
        .sendKeys(dbConfig.schema);

    await newConDialog.findElement(By.id("storePassword")).click();
    const passwordDialog = await driver.findElement(By.css(".passwordDialog"));
    await passwordDialog.findElement(By.css("input")).sendKeys(dbConfig.password);
    await passwordDialog.findElement(By.id("ok")).click();

    const okBtn = await driver.findElement(By.id("ok"));
    await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
    await okBtn.click();
    await driver.switchTo().defaultContent();
};

export const getDB = async (name: string, useFrame = true): Promise<WebElement> => {

    if (useFrame) {
        await driver.switchTo().frame(0);
        await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
        await driver.switchTo().frame(await driver.findElement(By.id("frame:DB Connections")));
    }

    const db = await driver.wait(async () => {
        const hosts = await driver.findElements(By.css("#tilesHost button"));
        for (const host of hosts) {
            try {
                const el = await host.findElement(By.css(".textHost .tileCaption"));
                if ((await el.getText()) === name) {
                    return host;
                }
            } catch (e) {
                return undefined;
            }
        }

        return undefined;
    }, 5000, "No DB was found");

    if (useFrame) {
        await driver.switchTo().defaultContent();
    }

    return db!;
};

export const startServer = async (): Promise<ChildProcess> => {
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

export const setDBEditorPassword = async (dbConfig: IDbConnection): Promise<void> => {
    const dialog = await driver.wait(until.elementLocated(
        By.css(".passwordDialog")), 10000, "No password dialog was found");
    const title = await dialog.findElement(By.css(".title .label"));
    const gridDivs = await dialog.findElements(By.css("div.grid > div"));

    let service;
    let username;
    for (let i = 0; i <= gridDivs.length - 1; i++) {
        if (await gridDivs[i].getText() === "Service:") {
            service = await gridDivs[i + 1].findElement(By.css(".resultText span")).getText();
        }
        if (await gridDivs[i].getText() === "User Name:") {
            username = await gridDivs[i + 1].findElement(By.css(".resultText span")).getText();
        }
    }

    expect(service).to.equals(`${dbConfig.username}@${dbConfig.hostname}:${dbConfig.port}`);
    expect(username).to.equals(dbConfig.username);

    expect(await title.getText()).to.equals("Open MySQL Connection");

    await dialog.findElement(By.css("input")).sendKeys(dbConfig.password);
    await dialog.findElement(By.id("ok")).click();
};

export const setFeedbackRequested = async (
    dbConfig: IDbConnection, value: string): Promise<void> => {

    const feedbackDialog = await driver.wait(until.elementLocated(
        By.css(".valueEditDialog")), 5000, "Feedback Requested dialog was not found");
    expect(await feedbackDialog.findElement(By.css(".title label")).getText()).to.equals("Feedback Requested");

    expect(await feedbackDialog.findElement(By.css(".valueTitle")).getText())
        .to.contain(`${dbConfig.username}@${dbConfig.hostname}:${dbConfig.port}`);

    expect(await feedbackDialog.findElement(By.css(".valueTitle")).getText())
        .to.contain("? [Y]es/[N]o/Ne[v]er (default No):");

    await feedbackDialog.findElement(By.css("input")).sendKeys(value);
    await feedbackDialog.findElement(By.id("ok")).click();
};

export const toggleTreeElement = async (section: string,
    el: string, expanded: boolean): Promise<void> => {

    await driver.wait(async () => {
        const element = await getTreeElement(section, el);
        const ariaExpanded = await element.getAttribute("aria-expanded");
        if (ariaExpanded !== String(expanded)) {
            const toggle = await element?.findElement(By.css(".codicon-tree-item-expanded"));
            await toggle?.click();
            await driver.sleep(500);

            return false;
        } else {

            return true;
        }
    }, 5000, `${section} > ${el} was not toggled`);
};

export const getFirstTreeChild = async (section: string, parent: string): Promise<string> => {

    await toggleTreeElement(section, parent, true);
    const parentNode = await getTreeElement(section, parent);
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

export const hasTreeChildren = async (section: string,
    parent: string, checkChild?: string): Promise<boolean> => {
    const parentNode = await getTreeElement(section, parent);
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

export const toggleSection = async (section: string, open: boolean): Promise<void> => {
    await driver.wait(async () => {
        const btn = await driver.findElement(By.xpath("//div[contains(@aria-label, '" + section + " Section')]/div"));
        await driver.executeScript("arguments[0].click()", btn);
        const el = await driver.findElement(By.xpath("//div[contains(@aria-label, '" + section + " Section')]"));
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

export const welcomeMySQLShell = async (): Promise<boolean> => {
    const editorView = new EditorView();
    const tabs = await editorView.getOpenTabs();
    let flag = false;
    for (const tab of tabs) {
        if (await tab.getTitle() === "Welcome to MySQL Shell") {
            flag = true;
        }
    }

    return flag;
};

export const deleteDBConnection = async (dbName: string): Promise<void> => {

    await selectContextMenuItem("DATABASE CONNECTIONS", dbName, "Delete MySQL Connection");

    const editorView = new EditorView();
    await driver.wait(async () => {
        const activeTab = await editorView.getActiveTab();

        return await activeTab?.getTitle() === "DB Connections";
    }, 3000, "error");

    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
    await driver.switchTo().frame(await driver.findElement(By.id("frame:DB Connections")));

    const item = driver.findElement(By.xpath("//label[contains(text(),'" + dbName + "')]"));
    const dialog = await driver.wait(until.elementLocated(
        By.css(".visible.confirmDialog")), 7000, "confirm dialog was not found");
    await dialog.findElement(By.id("accept")).click();

    await driver.wait(until.stalenessOf(item), 5000, "Database was not deleted");
    await driver.switchTo().defaultContent();
};

export const clearPassword = async (dbName: string): Promise<void> => {
    const el = await getTreeElement("DATABASE CONNECTIONS", dbName);
    expect(el).to.exist;

    await driver.actions()
        .mouseMove(el)
        .click(Button.RIGHT)
        .perform();

    await driver.sleep(500);
    await selectItem(4);
    const editorView = new EditorView();
    const editors = await editorView.getOpenEditorTitles();
    expect(editors.includes("DB Connections")).to.be.true;
    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
    await driver.switchTo().frame(await driver.findElement(By.id("frame:DB Connections")));
    const newConDialog = await driver.findElement(By.css(".valueEditDialog"));
    await newConDialog.findElement(By.id("Clear Password")).click();
    await driver.switchTo().defaultContent();
};

export const pressEnter = async (): Promise<void> => {
    if (platform() === "win32") {
        await driver
            .actions()
            .keyDown(key.CONTROL)
            .sendKeys(key.ENTER)
            .keyUp(key.CONTROL)
            .perform();
    } else if (platform() === "darwin") {
        await driver
            .actions()
            .keyDown(key.COMMAND)
            .sendKeys(key.ENTER)
            .keyUp(key.COMMAND)
            .perform();
    }
};

export const openNewNotebook = async (): Promise<void> => {
    const button = await driver.findElement(By.id("newMenuButton"));
    await button.click();
    const notebook = await driver.wait(until.elementLocated(By.id("addEditor")), 2000, "Scripts menu was not opened");
    await notebook.click();
};

export const enterCmd = async (textArea: WebElement, cmd: string,
    timeout?: number): Promise<void> => {
    cmd = cmd.replace(/(\r\n|\n|\r)/gm, "");
    const prevBlocks = await driver.findElements(By.css(".zoneHost"));
    await textArea.sendKeys(cmd);
    await textArea.sendKeys(key.ENTER);

    await pressEnter();

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

export const getOutput = async (penultimate?: boolean): Promise<string> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    let context;
    if (penultimate) {
        context = zoneHosts[zoneHosts.length - 2];
    } else {
        context = zoneHosts[zoneHosts.length - 1];
    }

    let items = await context.findElements(By.css("label"));
    const otherItems = await context.findElements(By.css(".textHost span"));
    let text;

    if (items.length > 0) {
        text = await items[0].getText();
    } else if (otherItems.length > 0) {
        text = await otherItems[otherItems.length - 1].getText();
    } else {
        items = await context.findElements(By.css(".info"));
        text = await items[0].getText();
    }

    return text;
};

export const setEditorLanguage = async (language: string): Promise<void> => {

    const contentHost = await driver.wait(until.elementLocated(
        By.id("shellEditorHost")), 15000, "Console was not loaded");

    const textArea = await contentHost.findElement(By.css("textarea"));
    await enterCmd(textArea, "\\" + language.replace("my", ""));
    const result = await getOutput();
    switch (language) {
        case "sql":
            expect(result).to.contain("Switching to SQL mode");
            break;
        case "js":
            expect(result).equals("Switched to JavaScript mode");
            break;
        case "ts":
            expect(result).equals("Switched to TypeScript mode");
            break;
        default:
            break;
    }
};

export const writePassword = async (): Promise<void> => {
    await driver.sleep(1000);
    if (platform() === "darwin") {
        await keyboard.type(String(process.env.PASSWORD));
        await keyboard.type(Key.Enter);
    } else {
        await keyboard.type(Key.Left);
        await driver.sleep(500);
        await keyboard.type(Key.Enter);
    }
};

export const waitForShell = async (): Promise<void> => {
    const bottomBar = new BottomBarPanel();
    const outputView = await bottomBar.openOutputView();

    await driver.wait(async () => {
        const text = await outputView.getText();
        if (text.indexOf("Mode: Single user") !== -1) {
            return true;
        }
    }, 15000, "MySQL Shell process was not loaded in time");

    await bottomBar.toggle(false);
};

export const waitForExtensionChannel = async (): Promise<void> => {

    await driver.wait(async () => {
        try {
            const bottomBar = new BottomBarPanel();
            await bottomBar.openOutputView();

            return true;
        } catch (e) {
            if (typeof e === "object" && String(e).includes("StaleElementReferenceError")) {
                return false;
            } else {
                throw e;
            }
        }
    }, 3000, "bottomBar still stale");

    await driver.wait(async () => {
        try {
            const select = await driver.findElement(By.xpath("//select[contains(@aria-label, 'Output Channels')]"));
            await select.click();
            await driver.sleep(500);
            const options = await select.findElements(By.css("option"));

            for (const option of options) {
                if (await option.getAttribute("value") === "MySQL Shell for VS Code") {
                    await option.click();

                    return true;
                }
            }
        } catch (e) {
            if (typeof e === "object" && String(e).includes("StaleElementReferenceError")) {
                return false;
            } else {
                throw new Error(String(e));
            }
        }

    }, 60000, "MySQL Shell for VS Code channel was not found");
};

export const isCertificateInstalled = async (): Promise<boolean> => {

    const bottomBar = new BottomBarPanel();
    const outputView = new OutputView(bottomBar);

    await driver.wait(async () => {
        try {
            return (await outputView.getText()).indexOf("Certificate is") !== -1;
        } catch (e) {
            return false;
        }

    }, 30000, "Could not retrieve the logs to verify certificate installation");

    const text = await outputView.getText();
    let flag: boolean;
    if (text.indexOf("Certificate is not installed") !== -1) {
        flag = false;
    } else if (text.indexOf("Mode: Single user") !== -1) {
        flag = true;
    } else if (text.indexOf("Certificate is installed") !== -1) {
        flag = true;
    } else {
        console.error(text);
        throw new Error("Could not verify certificate installation");
    }

    await bottomBar.toggle(false);

    return flag;
};

export const reloadVSCode = async (): Promise<void> => {
    const workbench = new Workbench();
    await workbench.executeCommand("workbench.action.reloadWindow");
    await driver.sleep(2000);
};

export const existsTreeElement = async (
    section: string, el: string): Promise<boolean> => {
    const sec = await getLeftSection(section);
    let els: WebElement[];
    if (el.includes("*")) {
        els = await sec?.findElements(By.xpath("//div[contains(@aria-label, '" + el.replace("*", "") + "')]"));
    } else {
        els = await sec?.findElements(By.xpath(`//div[@aria-label="${el} "]`));
    }

    return els.length > 0;
};

export const reloadSection = async (sectionName: string): Promise<void> => {
    const section = await getLeftSection(sectionName);
    await section.click();
    let btnName = "";
    switch (sectionName) {
        case "DATABASE CONNECTIONS":
            btnName = "Reload the connection list";
            break;
        case "ORACLE CLOUD INFRASTRUCTURE":
            btnName = "Reload the OCI Profile list";
            break;
        default:
            break;

    }
    const reloadConnsBtn = await getLeftSectionButton(sectionName, btnName);
    await reloadConnsBtn.click();
};

export const reloadConnection = async (connName: string): Promise<void> => {
    const context = await getTreeElement("DATABASE CONNECTIONS", connName);
    await driver.actions().mouseMove(context).perform();
    const btns = await context.findElements(By.css(".actions a"));
    for (const btn of btns) {
        if ((await btn.getAttribute("aria-label")) === "Reload Database Information") {
            await btn.click();

            return;
        }
    }
    throw new Error(`Could not find the Reload button on connection ${connName}`);
};

export const postActions = async (testContext: Mocha.Context): Promise<void> => {
    if (testContext.currentTest?.state === "failed") {
        const img = await driver.takeScreenshot();
        const testName = testContext.currentTest?.title;
        try {
            await fs.access("tests/e2e/screenshots");
        } catch (e) {
            await fs.mkdir("tests/e2e/screenshots");
        }
        const imgPath = `tests/e2e/screenshots/${testName}_screenshot.png`;
        await fs.writeFile(imgPath, img, "base64");

        addContext(testContext, { title: "Failure", value: `../${imgPath}` });
    }
};

export const isDBConnectionSuccessful = async (connection: string): Promise<boolean> => {
    await driver.switchTo().defaultContent();
    const edView = new EditorView();
    const editors = await edView.getOpenEditorTitles();
    expect(editors).to.include(connection);

    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
    await driver.switchTo().frame(await driver.findElement(By.id("frame:DB Connections")));

    expect(await driver.findElement(By.css(".zoneHost"))).to.exist;

    return true;
};

export const closeDBconnection = async (name: string): Promise<void> => {
    await driver.switchTo().defaultContent();
    const edView = new EditorView();
    const editors = await edView.getOpenEditorTitles();
    for (const editor of editors) {
        if (editor === name) {
            await edView.closeEditor(editor);
            break;
        }
    }
};

export const setConfirmDialog = async (dbConfig: IDbConnection, value: string): Promise<void> => {

    await driver.wait(until.elementsLocated(By.css(".confirmDialog")),
        500, "No confirm dialog was found");

    const confirmDialog = await driver.findElement(By.css(".confirmDialog"));

    expect(await confirmDialog.findElement(By.css(".title label")).getText()).to.equals("Confirm");

    expect(await confirmDialog.findElement(By.id("dialogMessage")).getText())
        .to.contain(
            `Save password for '${String(dbConfig.username)}@${String(dbConfig.hostname)}:${String(dbConfig.port)}'?`);

    const noBtn = await confirmDialog.findElement(By.id("refuse"));
    const yesBtn = await confirmDialog.findElement(By.id("accept"));
    const neverBtn = await confirmDialog.findElement(By.id("alternative"));

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

export const selectDatabaseType = async (value: string): Promise<void> => {
    await driver.findElement(By.id("databaseType")).click();
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    const els = await dropDownList.findElements(By.css("div"));
    if (els.length > 0) {
        await dropDownList.findElement(By.id(value)).click();
    }
};

export const getToolbarButton = async (button: string): Promise<WebElement | undefined> => {
    const buttons = await driver.findElements(By.css("#contentHost button"));
    for (const btn of buttons) {
        if ((await btn.getAttribute("data-tooltip")) === button) {
            return btn;
        }
    }

    throw new Error(`Could not find '${button}' button`);
};

export const writeSQL = async (sql: string, dealWithBox?: boolean): Promise<void> => {
    const textArea = await driver.findElement(By.css("textarea"));
    await textArea.sendKeys(sql);
    if (dealWithBox) {
        try {
            await driver.wait(until.elementLocated(By.css("div.contents")), 500, "none");
        } catch (e) {
            return;
        }
        await textArea.sendKeys(selKey.ENTER);
    }
};

export const findInSelection = async (el: WebElement, flag: boolean): Promise<void> => {
    const actions = await el.findElements(By.css(".find-actions div"));
    for (const action of actions) {
        if ((await action.getAttribute("title")).indexOf("Find in selection") !== -1) {
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

export const expandFinderReplace = async (el: WebElement, flag: boolean): Promise<void> => {
    const divs = await el.findElements(By.css("div"));
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

export const replacerGetButton = async (el: WebElement, button: string): Promise<WebElement | undefined> => {
    const replaceActions = await el.findElements(
        By.css(".replace-actions div"),
    );
    for (const action of replaceActions) {
        if ((await action.getAttribute("title")).indexOf(button) !== -1) {
            return action;
        }
    }
};

export const closeFinder = async (el: WebElement): Promise<void> => {
    const actions = await el.findElements(By.css(".find-actions div"));
    for (const action of actions) {
        if ((await action.getAttribute("title")).indexOf("Close") !== -1) {
            await action.click();
        }
    }
};

export const getResultTab = async (tabName: string): Promise<WebElement | undefined> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const tabs = await zoneHosts[zoneHosts.length - 1].findElements(By.css(".resultHost .tabArea div"));

    for (const tab of tabs) {
        if (await tab.getAttribute("id") !== "selectorItemstepDown" &&
            await tab.getAttribute("id") !== "selectorItemstepUp") {
            const label = await tab.findElement(By.css("label"));
            if (await label.getAttribute("innerHTML") === tabName) {

                return tab;
            }
        }
    }
};

export const getResultColumnName = async (columnName: string,
    retry?: number): Promise<WebElement | undefined> => {
    if (!retry) {
        retry = 0;
    } else {
        if (retry === 2) {
            throw new Error("Max retries for getting column name was reached");
        }
    }
    try {
        const resultHosts = await driver.findElements(By.css(".resultHost"));
        const resultSet = await resultHosts[resultHosts.length - 1].findElement(
            By.css(".tabulator-headers"),
        );

        const resultHeaderRows = await resultSet.findElements(
            By.css(".tabulator-col-title"),
        );

        for (const row of resultHeaderRows) {
            const rowText = await row.getAttribute("innerHTML");
            if (rowText === columnName) {
                return row;
            }
        }
    } catch (e) {
        if (e instanceof Error) {
            if (e.message.indexOf("stale") === -1) {
                throw e;
            }
        } else {
            await getResultColumnName(columnName, retry + 1);
        }
    }
};

const getEditorLanguage = async (): Promise<string> => {
    const editors = await driver.findElements(By.css(".editorPromptFirst"));
    const editorClasses = (await editors[editors.length - 1].getAttribute("class")).split(" ");

    return editorClasses[2].replace("my", "");
};

export const setDBEditorLanguage = async (language: string): Promise<void> => {
    const curLang = await getEditorLanguage();
    if (curLang !== language) {
        const contentHost = await driver.findElement(By.id("contentHost"));
        const textArea = await contentHost.findElement(By.css("textarea"));
        await enterCmd(textArea, "\\" + language.replace("my", ""));
        const results = await driver.findElements(By.css(".message.info"));
        switch (language) {
            case "sql":
                expect(await results[results.length - 1].getText()).equals("Switched to MySQL mode");
                break;
            case "js":
                expect(await results[results.length - 1].getText()).equals("Switched to JavaScript mode");
                break;
            case "ts":
                expect(await results[results.length - 1].getText()).equals("Switched to TypeScript mode");
                break;
            default:
                break;
        }
    }
};

export const getResultStatus = async (isSelect?: boolean): Promise<string> => {
    let zoneHosts: WebElement[] | undefined;
    let block: WebElement;
    let obj = "";
    if (isSelect) {
        obj = "label";
    } else {
        obj = "span";
    }

    await driver.wait(
        async (driver) => {
            zoneHosts = await driver.findElements(By.css(".zoneHost"));
            const about = await zoneHosts[0].findElement(By.css("span"));
            //first element is usually the about info
            if ((await about.getText()).indexOf("Welcome") !== -1) {
                zoneHosts.shift();
            }
            if (zoneHosts.length > 0) {
                if ((await zoneHosts[0].findElements(By.css(".message.info"))).length > 0) {
                    //if language has been changed...
                    zoneHosts.shift();
                }
            } else {
                return false;
            }

            return zoneHosts[zoneHosts.length - 1] !== undefined;
        },
        10000,
        `Result Status is undefined`,
    );

    await driver.wait(async () => {
        try {
            block = await zoneHosts![zoneHosts!.length - 1].findElement(By.css(obj));

            return true;
        } catch (e) {
            return false;
        }

    }, 10000, "Result Status content was not found");

    return block!.getAttribute("innerHTML");
};

export const clickContextMenuItem = async (refEl: WebElement, item: string): Promise<void> => {

    await driver.wait(async () => {
        await refEl.click();
        await driver.actions().click(Button.RIGHT).perform();

        try {
            const el: WebElement = await driver.executeScript(`return document.querySelector(".shadow-root-host").
            shadowRoot.querySelector("span[aria-label='${item}']")`);

            return el !== undefined;
        } catch (e) {
            return false;
        }

    }, 5000,
        "Context menu was not displayed");

    await driver.wait(async () => {
        try {
            const el: WebElement = await driver.executeScript(`return document.querySelector(".shadow-root-host").
            shadowRoot.querySelector("span[aria-label='${item}']")`);
            await el.click();

            return true;
        } catch (e) {
            if (typeof e === "object" && String(e).includes("StaleElementReferenceError")) {
                return true;
            }
        }

    }, 3000, "Context menu is still displayed");
};

export const getGraphHost = async (): Promise<WebElement> => {
    const resultHosts = await driver.findElements(By.css(".zoneHost"));
    const lastResult = resultHosts[resultHosts.length - 1];

    return driver.wait(async () => {
        return lastResult.findElement(By.css(".graphHost"));
    }, 10000, "Pie Chart was not displayed");
};

export const hasNewPrompt = async (): Promise<boolean | undefined> => {
    let text: String;
    try {
        const prompts = await driver.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
        const lastPrompt = await prompts[prompts.length - 1].findElement(By.css("span > span"));
        text = await lastPrompt.getText();
    } catch (e) {
        if (String(e).indexOf("StaleElementReferenceError") === -1) {
            throw new Error(String(e.stack));
        } else {
            await driver.sleep(500);
            const prompts = await driver.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
            const lastPrompt = await prompts[prompts.length - 1].findElement(By.css("span > span"));
            text = await lastPrompt.getText();
        }
    }

    return String(text).length === 0;
};

export const getLastQueryResultId = async (): Promise<number> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    if (zoneHosts.length > 0) {
        const zones = await driver.findElements(By.css(".zoneHost"));

        return parseInt((await zones[zones.length - 1].getAttribute("monaco-view-zone")).match(/\d+/)![0], 10);
    } else {
        return 0;
    }
};

export const switchToFrame = async (frame: string): Promise<void> => {
    await driver.wait(until.ableToSwitchToFrame(0), 5000, "Not able to switch to frame 0");
    await driver.wait(until.ableToSwitchToFrame(
        By.id("active-frame")), 5000, "Not able to switch to frame active-frame");
    await driver.wait(until.ableToSwitchToFrame(
        By.id(`frame:${frame}`)), 5000, `Not able to switch to frame ${frame}`);
};

export const shellGetResult = async (): Promise<string> => {
    const zoneHost = await driver.findElements(By.css(".zoneHost"));
    const error = await zoneHost[zoneHost.length - 1].findElements(
        By.css(".error"),
    );

    if (error.length > 0) {
        return error[error.length - 1].getText();
    } else {
        let text = "";
        let results = await zoneHost[zoneHost.length - 1].findElements(
            By.css("code span"),
        );
        if (results.length > 0) {
            for (const result of results) {
                text += (await result.getAttribute("innerHTML")) + "\n";
            }

            return text.trim();
        } else {
            results = await zoneHost[zoneHost.length - 1].findElements(
                By.css("span span"),
            );
            for (const result of results) {
                text += await result.getAttribute("innerHTML");
            }

            return text.trim();
        }
    }
};

export const shellGetResultTable = async (): Promise<WebElement | string> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const zoneHost = zoneHosts[zoneHosts.length - 1];
    const error = await zoneHost.findElements(
        By.css(".error"),
    );

    if (error.length > 0) {
        const last = error.length - 1;

        return error[last].getText();
    } else {

        return zoneHost.findElement(By.css(".tabulator"));
    }
};

export const getPromptTextLine = async (prompt: String): Promise<String> => {
    const context = await driver.findElement(By.css(".monaco-editor-background"));
    const lines = await context.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));

    let tags;
    switch (prompt) {
        case "last":
            tags = await lines[lines.length - 1].findElements(By.css("span > span"));
            break;
        case "last-1":
            tags = await lines[lines.length - 2].findElements(By.css("span > span"));
            break;
        case "last-2":
            tags = await lines[lines.length - 3].findElements(By.css("span > span"));
            break;
        default:
            throw new Error("Error getting line");
    }

    let sentence = "";
    for (const tag of tags) {
        sentence += (await tag.getText()).replace("&nbsp;", " ");
    }

    return sentence;
};

export const cleanEditor = async (): Promise<void> => {
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
        return await getPromptTextLine("last") === "";
    }, 3000, "Prompt was not cleaned");
};

export const shellGetTech = async (driver: WebElement): Promise<string> => {
    const divs = await driver.findElements(
        By.css(".margin-view-overlays div div"),
    );
    const lastDiv = divs[divs.length - 1];
    const classes = (await lastDiv.getAttribute("class")).split(" ");

    return classes[2];
};

export const shellGetTotalRows = async (): Promise<string> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const zoneHost = zoneHosts[zoneHosts.length - 1];

    return zoneHost
        .findElement(By.css(".resultStatus label.msg.label"))
        .getText();
};

export const shellGetLangResult = async (): Promise<string> => {
    await driver.wait(until.elementLocated(By.css(".zoneHost")), 2000);
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const zoneHost = zoneHosts[zoneHosts.length - 1];

    const dataLang = await (await zoneHost.findElement(By.css("label"))).getAttribute("data-lang");

    return dataLang;
};

export const isValueOnJsonResult = async (value: string): Promise<boolean> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const zoneHost = zoneHosts[zoneHosts.length - 1];
    const spans = await zoneHost.findElements(By.css("label > span > span"));

    for (const span of spans) {
        const spanText = await span.getText();
        if (spanText.indexOf(value) !== -1) {
            return true;
        }
    }

    return false;
};

export const isValueOnDataSet = async (value: String): Promise<boolean> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const cells = await zoneHosts[zoneHosts.length - 1].findElements(By.css(".zoneHost .tabulator-cell"));
    for (const cell of cells) {
        const text = await cell.getText();
        if (text === value) {
            return true;
        }
    }

    return false;
};

export const getShellServerTabStatus = async (): Promise<string> => {
    const server = await driver.findElement(By.id("server"));

    return server.getAttribute("data-tooltip");
};

export const getShellSchemaTabStatus = async (): Promise<string> => {
    const schema = await driver.findElement(By.id("schema"));

    return schema.getAttribute("innerHTML");
};

export const setRestService = async (serviceName: string,
    comments: string, hostname: string,
    https: boolean, http: boolean, mrsDefault: boolean, mrsEnabled: boolean): Promise<void> => {

    const dialog = await driver.findElement(By.id("mrsServiceDialog"));

    const inputServName = await dialog.findElement(By.id("serviceName"));
    await inputServName.clear();
    await inputServName.sendKeys(serviceName);

    const inputComments = await dialog.findElement(By.id("comments"));
    await inputComments.clear();
    await inputComments.sendKeys(comments);

    const inputHost = await dialog.findElement(By.id("hostName"));
    await inputHost.clear();
    await inputHost.sendKeys(hostname);

    const inputHttps = await dialog.findElement(By.id("protocolHTTPS"));
    const httpsClasses = await inputHttps.getAttribute("class");
    let classes = httpsClasses.split(" ");
    if (https === true) {
        if (classes.includes("unchecked")) {
            await inputHttps.findElement(By.css(".checkMark")).click();
        }
    } else {
        if (classes.includes("checked")) {
            await inputHttps.findElement(By.css(".checkMark")).click();
        }
    }

    const inputHttp = await dialog.findElement(By.id("protocolHTTP"));
    const httpClasses = await inputHttp.getAttribute("class");
    classes = httpClasses.split(" ");
    if (http === true) {
        if (classes.includes("unchecked")) {
            await inputHttp.findElement(By.css(".checkMark")).click();
        }
    } else {
        if (classes.includes("checked")) {
            await inputHttp.findElement(By.css(".checkMark")).click();
        }
    }

    const inputMrsDef = await dialog.findElement(By.id("makeDefault"));
    const inputMrsDefClasses = await inputMrsDef.getAttribute("class");
    classes = inputMrsDefClasses.split(" ");
    if (mrsDefault === true) {
        if (classes.includes("unchecked")) {
            await inputMrsDef.findElement(By.css(".checkMark")).click();
        }
    } else {
        if (classes.includes("checked")) {
            await inputMrsDef.findElement(By.css(".checkMark")).click();
        }
    }

    const inputMrsEnabled = await dialog.findElement(By.id("enabled"));
    const inputMrsEnabledClasses = await inputMrsEnabled.getAttribute("class");
    classes = inputMrsEnabledClasses.split(" ");
    if (mrsEnabled === true) {
        if (classes.includes("unchecked")) {
            await inputMrsEnabled.findElement(By.css(".checkMark")).click();
        }
    } else {
        if (classes.includes("checked")) {
            await inputMrsEnabled.findElement(By.css(".checkMark")).click();
        }
    }

    await dialog.findElement(By.id("ok")).click();
};

export const setRestSchema = async (schemaName: string,
    mrsService: string, requestPath: string, itemsPerPage: number,
    authentication: boolean, enabled: boolean, comments: string): Promise<void> => {

    const dialog = await driver.findElement(By.id("mrsSchemaDialog"));

    const inputSchemaName = await dialog.findElement(By.id("name"));
    await inputSchemaName.clear();
    await inputSchemaName.sendKeys(schemaName);

    const selectService = await dialog.findElement(By.id("service"));
    await selectService.click();
    await driver.findElement(By.id(mrsService)).click();

    const inputRequestPath = await dialog.findElement(By.id("requestPath"));
    await inputRequestPath.clear();
    await inputRequestPath.sendKeys(requestPath);

    const inputRequiresAuth = await dialog.findElement(By.id("requiresAuth"));
    const inputRequiresAuthClasses = await inputRequiresAuth.getAttribute("class");
    let classes = inputRequiresAuthClasses.split(" ");
    if (authentication === true) {
        if (classes.includes("unchecked")) {
            await inputRequiresAuth.findElement(By.css(".checkMark")).click();
        }
    } else {
        if (classes.includes("checked")) {
            await inputRequiresAuth.findElement(By.css(".checkMark")).click();
        }
    }

    const inputEnabled = await dialog.findElement(By.id("enabled"));
    const inputEnabledClasses = await inputEnabled.getAttribute("class");
    classes = inputEnabledClasses.split(" ");
    if (enabled === true) {
        if (classes.includes("unchecked")) {
            await inputEnabled.findElement(By.css(".checkMark")).click();
        }
    } else {
        if (classes.includes("checked")) {
            await inputEnabled.findElement(By.css(".checkMark")).click();
        }
    }

    if (itemsPerPage !== 0 || itemsPerPage !== undefined) {
        if ((await dialog.findElements(By.id("up"))).length > 0) {
            let ref: WebElement;
            if (itemsPerPage > 0) {
                ref = await dialog.findElement(By.id("up"));
            } else {
                ref = await dialog.findElement(By.id("down"));
            }

            const clicks = parseInt((String(itemsPerPage).replace("-", "")), 10);
            let count = 1;

            while (count < clicks) {
                await ref.click();
                count++;
            }
        } else {
            const inputItemsPerPage = await dialog.findElement(By.id("itemsPerPage"));
            await inputItemsPerPage.sendKeys(itemsPerPage);
        }
    }

    const inputComments = await dialog.findElement(By.id("comments"));
    await inputComments.clear();
    await inputComments.sendKeys(comments);

    await dialog.findElement(By.id("ok")).click();
};
