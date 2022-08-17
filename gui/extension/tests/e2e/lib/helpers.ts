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
    DefaultTreeSection,
    DefaultTreeItem,
    BottomBarPanel,
    Workbench,
    TitleBar,
    OutputView,
    TitleBarItem,
    Key as selKey,
} from "vscode-extension-tester";
import { expect } from "chai";
import { keyboard, Key } from "@nut-tree/nut-js";
import { ChildProcess, spawn, execSync } from "child_process";
import { platform } from "os";
import addContext from "mochawesome/addContext";
import fs from "fs/promises";
import { join } from "path";

const uiTestsFile = fs.readFile(join("tests", "e2e", "tests", "ui-tests.ts"));
let treeSection: DefaultTreeSection;

export const moreActionsContextMenu = new Map<string, Number>([
    ["Restart the Internal MySQL Shell Process", 1],
    ["Connect to External MySQL Shell Process", 2],
    ["Relaunch Welcome Wizard", 3],
    ["Reset MySQL Shell for VS Code Extension", 4],
]);

export const connContextMenu = new Map<string, Number>([
    ["Open DB Connection", 1],
    ["Open DB Connection in New Tab", 2],
    ["Open MySQL Shell GUI Console for this Connection", 3],
    ["Edit MySQL Connection", 5],
    ["Duplicate this MySQL Connection", 6],
    ["Delete MySQL Connection", 7],
    ["Show MySQL System Schemas", 8],
    ["Configure MySQL REST Service", 10],
]);

export const schemaContextMenu = new Map<string, Number>([
    ["Copy To Clipboard", 3],
    ["Drop Schema...", 5],
]);

export const restContextMenu = new Map<string, Number>([
    ["Add REST Service", 1],
]);

export const clipBoardContextMenu = new Map<string, Number>([
    ["Name", 0],
    ["Create Statement", 1],
]);

export const tableContextMenu = new Map<string, Number>([
    ["Show Data...", 1],
    ["Add Table to REST Service", 2],
    ["Copy To Clipboard", 3],
    ["Drop Table...", 4],
]);

export const viewContextMenu = new Map<string, Number>([
    ["Show Data...", 1],
    ["Copy To Clipboard", 2],
    ["Drop View...", 3],
]);

export const ociProfileContextMenu = new Map<string, Number>([
    ["View Config Profile Information", 1],
    ["Set as New Default Config Profile", 2],
]);

export const ociCompartmentContextMenu = new Map<string, Number>([
    ["View Compartment Information", 1],
    ["Set as Current Compartment", 2],
]);

export const ociDBSystemContextMenu = new Map<string, Number>([
    ["View DB System Information", 1],
    ["Create Connection with Bastion Service", 2],
    ["Start the DB System", 3],
    ["Restart the DB System", 4],
    ["Stop the DB System", 5],
    ["Delete the DB System", 6],
    ["Create MySQL Router Endpoint on new Compute Instace", 7],
]);

export const ociBastionContextMenu = new Map<string, Number>([
    ["Get Bastion Information", 1],
    ["Set as Current Bastion", 2],
    ["Delete Bastion", 3],
    ["Refresh When Bastion Reaches Active State", 4],
]);

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

export const getDriver = async (): Promise<WebDriver | undefined> => {
    let browser: VSBrowser;
    let driver: WebDriver;

    let counter = 0;
    while(counter <= 10) {
        try {
            browser = VSBrowser.instance;
            await browser.waitForWorkbench();
            driver = browser.driver;
            await driver.manage().timeouts().implicitlyWait(5000);

            return driver;
        } catch(e) {
            if (e instanceof Error) {
                if (e.message.indexOf("target frame detached") === -1) {
                    throw new Error(String(e.stack));
                }
                counter++;
            }
        }
    }
};

export const getLeftSection = async (driver: WebDriver, name: string): Promise<WebElement> => {
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

export const waitForLoading = async (driver: WebDriver, sectionName: string, timeout: number): Promise<void> => {
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

export const getTreeElement = async (driver: WebDriver, section: string, el: string): Promise<WebElement> => {
    const sec = await getLeftSection(driver, section);

    return sec?.findElement(By.xpath("//div[contains(@aria-label, '" + el + "')]"));
};

export const isDefaultItem = async (driver: WebDriver, itemType: string,
    itemName: string): Promise<boolean | undefined> => {
    const root = await getTreeElement(driver, "ORACLE CLOUD INFRASTRUCTURE", itemName);
    const el = await root.findElement(By.css(".custom-view-tree-node-item > div"));
    const backImage = await el.getCssValue("background-image");

    switch (itemType) {
        case "profile":
            return backImage.indexOf("ociProfileCurrent") !== -1;
        case "compartment":
            return backImage.indexOf("folderCurrent") !== -1;
        case "bastion":
            return backImage.indexOf("ociBastionCurrent") !== -1;
        default:
            break;
    }

};

export const selectItem = async (taps: Number): Promise<void> => {
    for (let i = 1; i <= taps; i++) {
        await keyboard.type(Key.Down);
    }
    await keyboard.type(Key.Enter);
};

export const initTree = async (section: string): Promise<void> => {
    treeSection = await new SideBarView().getContent().getSection(section) as DefaultTreeSection;
};

export const selectContextMenuItem = async (driver: WebDriver,
    section: string, treeItem: string, ctxMenu: string,
    ctxMenuItem: string): Promise<void> => {
    const ctxMenuItems = ctxMenuItem.split("->");
    if (platform() === "win32") {
        const item = await getTreeElement(driver, section, treeItem);
        const cstTreeItem = new DefaultTreeItem(item, treeSection);
        const ctx = await cstTreeItem?.openContextMenu();
        const ctxItem = await ctx?.getItem(ctxMenuItems[0].trim());
        const menu = await ctxItem!.select();
        if (ctxMenuItems.length > 1) {
            await (await menu?.getItem(ctxMenuItems[1].trim()))!.select();
        }

    } else if (platform() === "darwin") {
        const el = await getTreeElement(driver, section, treeItem);
        await driver.actions()
            .mouseMove(el)
            .click(Button.RIGHT)
            .perform();

        await driver.sleep(500);
        switch (ctxMenu) {
            case "connection":
                await selectItem(connContextMenu.get(ctxMenuItems[0].trim()) as Number);
                break;
            case "rest":
                await selectItem(restContextMenu.get(ctxMenuItems[0].trim()) as Number);
                break;
            case "schema":
                await selectItem(schemaContextMenu.get(ctxMenuItems[0].trim()) as Number);
                break;
            case "table":
                await selectItem(tableContextMenu.get(ctxMenuItems[0].trim()) as Number);
                break;
            case "view":
                await selectItem(viewContextMenu.get(ctxMenuItems[0].trim()) as Number);
                break;
            case "ociCompartment":
                await selectItem(ociCompartmentContextMenu.get(ctxMenuItems[0].trim()) as Number);
                break;
            case "ociProfile":
                await selectItem(ociProfileContextMenu.get(ctxMenuItems[0].trim()) as Number);
                break;
            case "ociDBSystem":
                await selectItem(ociDBSystemContextMenu.get(ctxMenuItems[0].trim()) as Number);
                break;
            case "ociBastion":
                await selectItem(ociBastionContextMenu.get(ctxMenuItems[0].trim()) as Number);
                break;
            default:
                break;
        }
        if (ctxMenuItems.length > 1) {
            await keyboard.type(Key.Right);
            await selectItem(clipBoardContextMenu.get(ctxMenuItems[1].trim()) as Number);
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

export const getLeftSectionButton = async (driver: WebDriver,
    sectionName: string,
    buttonName: string): Promise<WebElement> => {

    const section = await getLeftSection(driver, sectionName);
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

export const selectMoreActionsItem = async (driver: WebDriver,
    section: string, item: string): Promise<void> => {

    const sec = await getLeftSection(driver, section);
    await sec.click();

    const moreActionsBtn = await getLeftSectionButton(driver, section, "More Actions...");
    await moreActionsBtn.click();

    await driver.wait(async () => {
        const el: WebElement = await driver.executeScript(`return document.querySelector(".shadow-root-host").
        shadowRoot.querySelector("span[aria-label='${item}']")`);

        return el !== undefined;
    }, 2000,
    "More Actions Context menu was not displayed");

    const el: WebElement = await driver.executeScript(`return document.querySelector(".shadow-root-host").
            shadowRoot.querySelector("span[aria-label='${item}']")`);

    await driver.wait(async () => {
        try {
            await el.click();
        } catch(e) {
            if (String(e).indexOf("StaleElementReferenceError") !== -1) {
                return true;
            }
        }

    }, 3000 ,"More Actions context menu is still displayed");
};

export const createDBconnection = async (driver: WebDriver, dbConfig: IDbConnection): Promise<void> => {
    const createConnBtn = await getLeftSectionButton(driver, "DATABASE", "Create New MySQL Connection");
    await createConnBtn?.click();

    const editorView = new EditorView();
    const editor = await editorView.openEditor("SQL Connections");
    expect(await editor.getTitle()).to.equals("SQL Connections");

    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
    await driver.switchTo().frame(await driver.findElement(By.id("frame:SQL Connections")));

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

export const getDB = async (driver: WebDriver, name: string, useFrame = true): Promise<WebElement> => {

    if (useFrame) {
        await driver.switchTo().frame(0);
        await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
        await driver.switchTo().frame(await driver.findElement(By.id("frame:SQL Connections")));
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

export const startServer = async (driver: WebDriver): Promise<ChildProcess> => {
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

export const setDBEditorPassword = async (driver: WebDriver, dbConfig: IDbConnection): Promise<void> => {
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

export const setFeedbackRequested = async (driver: WebDriver,
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

export const toggleTreeElement = async (driver: WebDriver, section: string,
    el: string, expanded: boolean): Promise<void> => {
    await driver.wait(async () => {
        const element = await getTreeElement(driver, section, el);
        if (await element.getAttribute("aria-expanded") !== String(expanded)) {
            const toggle = await element?.findElement(By.css(".codicon-tree-item-expanded"));
            await toggle?.click();
            await driver.sleep(200);

            return false;
        } else {

            return true;
        }
    }, 5000, `${section} > ${el} was not toggled`);
};

export const hasTreeChildren = async (driver: WebDriver, section: string,
    parent: string, checkChild?: string): Promise<boolean> => {
    const parentNode = await getTreeElement(driver, section, parent);
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

export const toggleSection = async (driver: WebDriver, section: string, open: boolean): Promise<void> => {
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

export const deleteDBConnection = async (driver: WebDriver, dbName: string): Promise<void> => {

    await selectContextMenuItem(driver, "DATABASE", dbName, "connection", "Delete MySQL Connection");

    const editorView = new EditorView();
    await driver.wait(async () => {
        const activeTab = await editorView.getActiveTab();

        return await activeTab?.getTitle() === "SQL Connections";
    }, 3000, "error");

    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
    await driver.switchTo().frame(await driver.findElement(By.id("frame:SQL Connections")));

    const item = driver.findElement(By.xpath("//label[contains(text(),'" + dbName + "')]"));
    const dialog = await driver.wait(until.elementLocated(
        By.css(".visible.confirmDialog")), 7000, "confirm dialog was not found");
    await dialog.findElement(By.id("accept")).click();

    await driver.wait(until.stalenessOf(item), 5000, "Database was not deleted");
    await driver.switchTo().defaultContent();
};

export const clearPassword = async (driver: WebDriver, dbName: string): Promise<void> => {
    const el = await getTreeElement(driver, "DATABASE", dbName);
    expect(el).to.exist;

    await driver.actions()
        .mouseMove(el)
        .click(Button.RIGHT)
        .perform();

    await driver.sleep(500);
    await selectItem(4);
    const editorView = new EditorView();
    const editors = await editorView.getOpenEditorTitles();
    expect(editors.includes("SQL Connections")).to.be.true;
    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
    await driver.switchTo().frame(await driver.findElement(By.id("frame:SQL Connections")));
    const newConDialog = await driver.findElement(By.css(".valueEditDialog"));
    await newConDialog.findElement(By.id("Clear Password")).click();
    await driver.switchTo().defaultContent();
};

export const pressEnter = async (driver: WebDriver): Promise<void> => {
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

export const enterCmd = async (driver: WebDriver, textArea: WebElement, cmd: string,
    timeout?: number): Promise<void> => {
    cmd = cmd.replace(/(\r\n|\n|\r)/gm, "");
    const prevBlocks = await driver.findElements(By.css(".zoneHost"));
    await textArea.sendKeys(cmd);
    await textArea.sendKeys(key.ENTER);

    await pressEnter(driver);

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

export const getOutput = async (driver: WebDriver, penultimate?: boolean): Promise<string> => {
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

export const setEditorLanguage = async (driver: WebDriver, language: string): Promise<void> => {

    const contentHost = await driver.wait(until.elementLocated(
        By.id("shellEditorHost")), 15000, "Console was not loaded");

    const textArea = await contentHost.findElement(By.css("textarea"));
    await enterCmd(driver, textArea, "\\" + language.replace("my", ""));
    const result = await getOutput(driver);
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

export const waitForSystemDialog = async (driver: WebDriver, deleteCert?: boolean): Promise<void> => {
    const cmd = (() => {
        switch (process.platform) {
            case "win32": return `tasklist /fi "imagename eq certutil.exe"`;
            case "darwin":
                if (deleteCert) {
                    return `ps -ax | grep delete-certificate`;
                } else {
                    return `ps -ax | grep add-trusted-cert`;
                }
            default: break;
        }
    })();

    const isProcessRunning = (deleteCert?: boolean): Promise<boolean> => {
        const result = execSync(String(cmd));
        const lines = String(result).split("\n");
        let search = "";
        if (process.platform === "darwin") {
            if (deleteCert) {
                search = "login.keychain-db";
            } else {
                search = "rootCA.crt";
            }

        } else {
            search = "certutil.exe";
        }
        for (const line of lines) {
            if (line.indexOf(search) !== -1) {
                return new Promise((resolve) => { resolve(true); });
            }
        }

        return new Promise((resolve) => { resolve(false); });
    };

    await driver.wait(async () => {
        return isProcessRunning(deleteCert);
    }, 10000, "system dialog was not displayed");
};

export const writePassword = async (driver: WebDriver): Promise<void> => {
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

export const installCertificate = async (driver: WebDriver): Promise<void> => {
    const editorView = new EditorView();
    await driver.wait(async () => {
        const tabs = await editorView.getOpenTabs();
        for (const tab of tabs) {
            if (await tab.getTitle() === "Welcome to MySQL Shell") {
                return true;
            }
        }
    }, 10000, "Welcome to MySQL Shell tab was not opened");

    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));

    const welcome = await driver.findElement(By.id("welcome"));
    expect(welcome).to.exist;

    await driver.findElement(By.id("nextBtn")).click();

    const h3 = await driver.wait(until.elementLocated(By.css("#page3 h3")), 5000, "Title was not found");
    expect(await h3.getText()).to.equals("Installation of Certificate.");

    await driver.findElement(By.id("nextBtn")).click();
    await waitForSystemDialog(driver);

    await writePassword(driver);
    const installResult = await driver.findElement(By.css("#page5 h3"));
    await driver.wait(until.elementTextContains(installResult, "Installation Completed"), 5000,
        "Installation was not completed");

    const reload = await driver.findElement(By.id("nextBtn"));
    await reload.click();
    await driver.sleep(2000);
};

export const waitForShell = async (driver: WebDriver): Promise<void> => {
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

const isBottomBarVisible = async (driver: WebDriver): Promise<boolean> => {
    const bottomBar = await driver.findElement(By.id("workbench.parts.panel"));
    const parentNode = await driver.executeScript("return arguments[0].parentNode", bottomBar);
    const parentNodeClasses = await (parentNode as WebElement).getAttribute("class");
    const arrayClass = parentNodeClasses.split(" ");
    if (arrayClass.includes("visible")) {
        return true;
    } else {
        return false;
    }
};

export const waitForExtensionChannel = async (driver: WebDriver): Promise<void> => {

    if (platform() === "darwin") {
        await driver.wait(async () => {
            try {
                const bottomBar = new BottomBarPanel();
                await bottomBar.openOutputView();

                return true;
            } catch (e) {
                if (String(e).indexOf("StaleElementReferenceError") !== -1) {
                    return false;
                } else {
                    throw e;
                }
            }
        }, 3000, "bottomBar still stale");

    } else {
        if (!(await isBottomBarVisible(driver))) {
            let titleBar: TitleBar;
            let viewMenu: TitleBarItem | undefined;
            await driver.wait(async () => {
                try {
                    titleBar = new TitleBar();
                    viewMenu = await titleBar.getItem("View");

                    return true;
                } catch (e) {
                    if (String(e).indexOf("StaleElementReferenceError") !== -1) {
                        return false;
                    } else {
                        throw e;
                    }
                }
            }, 3000, "bottomBar still stale");

            const contexMenu = await viewMenu?.select();
            const outputItem = await contexMenu?.getItem("Output");
            await outputItem?.click();
        }
    }

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
            if (String(e).indexOf("StaleElementReferenceError") !== -1) {
                return false;
            } else {
                throw new Error(String(e));
            }
        }

    }, 60000, "MySQL Shell for VS Code channel was not found");
};

export const isCertificateInstalled = async (driver: WebDriver): Promise<boolean> => {

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

export const reloadVSCode = async (driver: WebDriver): Promise<void> => {
    const workbench = new Workbench();
    await workbench.executeCommand("workbench.action.reloadWindow");
    await driver.sleep(2000);
};

export const existsTreeElement = async (driver: WebDriver, section: string, el: string): Promise<boolean> => {
    const sec = await getLeftSection(driver, section);
    const els = await sec?.findElements(By.xpath("//div[contains(@aria-label, '" + el + "')]"));

    return els.length > 0;
};

export const reloadSection = async (driver: WebDriver, sectionName: string): Promise<void> => {
    const section = await getLeftSection(driver, sectionName);
    await section.click();
    let btnName = "";
    switch (sectionName) {
        case "DATABASE":
            btnName = "Reload the connection list";
            break;
        case "ORACLE CLOUD INFRASTRUCTURE":
            btnName = "Reload the OCI Profile list";
            break;
        default:
            break;

    }
    const reloadConnsBtn = await getLeftSectionButton(driver, sectionName, btnName);
    await reloadConnsBtn.click();
};

export const reloadConnection = async (driver: WebDriver, connName: string): Promise<void> => {
    const context = await getTreeElement(driver, "DATABASE", connName);
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

export const postActions = async (driver: WebDriver, testContext: Mocha.Context): Promise<void> => {
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

        const codeLines = (await uiTestsFile).toString().split("\n");
        for (let i = 0; i <= codeLines.length - 1; i++) {
            if (codeLines[i].indexOf(testName) !== -1) {
                if (codeLines[i - 1].indexOf("mybug.mysql.oraclecorp.com") !== -1) {
                    const bugLink = codeLines[i - 1].replace("// bug: ", "").trim();
                    addContext(testContext, `---->  HAS A BUG  <----- : ${bugLink}"`);
                }
            }
        }
    }
};

export const isDBConnectionSuccessful = async (driver: WebDriver, connection: string): Promise<boolean> => {
    await driver.switchTo().defaultContent();
    const edView = new EditorView();
    const editors = await edView.getOpenEditorTitles();
    expect(editors).to.include(connection);

    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
    await driver.switchTo().frame(await driver.findElement(By.id("frame:SQL Connections")));

    expect(await driver.findElement(By.css(".zoneHost"))).to.exist;

    return true;
};

export const closeDBconnection = async (driver: WebDriver, name: string): Promise<void> => {
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

export const setConfirmDialog = async (driver: WebDriver, dbConfig: IDbConnection, value: string): Promise<void> => {

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

export const selectDatabaseType = async (driver: WebDriver, value: string): Promise<void> => {
    await driver.findElement(By.id("databaseType")).click();
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    const els = await dropDownList.findElements(By.css("div"));
    if (els.length > 0) {
        await dropDownList.findElement(By.id(value)).click();
    }
};

export const getToolbarButton = async (driver: WebDriver, button: string): Promise<WebElement | undefined> => {
    const buttons = await driver.findElements(By.css("#contentHost button"));
    for (const btn of buttons) {
        if ((await btn.getAttribute("data-tooltip")) === button) {
            return btn;
        }
    }

    return undefined;
};

export const writeSQL = async (driver: WebDriver, sql: string): Promise<void> => {
    const textArea = await driver.findElement(By.css("textarea"));
    await textArea.sendKeys(sql);
    try {
        await driver.wait(until.elementLocated(By.css("div.contents")), 500, "none");
    } catch (e) {
        return;
    }
    await textArea.sendKeys(selKey.ENTER);
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

export const getResultTab = async (driver: WebDriver, tabName: string): Promise<WebElement | undefined> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const tabs = await zoneHosts[zoneHosts.length-1].findElements(By.css(".resultHost .tabArea div"));

    for (const tab of tabs) {
        if (await tab.getAttribute("id") !== "selectorItemstepDown" &&
            await tab.getAttribute("id") !== "selectorItemstepUp") {
            if (await (await tab.findElement(By.css("label"))).getText() === tabName) {

                return tab;
            }
        }
    }
};

export const getResultColumnName = async (driver: WebDriver, columnName: string,
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
        const resultSet = await resultHosts[resultHosts.length-1].findElement(
            By.css(".tabulator-headers"),
        );

        const resultHeaderRows = await resultSet.findElements(
            By.css(".tabulator-col-title"),
        );

        for (const row of resultHeaderRows) {
            if (await row.getText() === columnName) {
                return row;
            }
        }
    } catch (e) {
        if (e instanceof Error) {
            if (e.message.indexOf("stale") === -1) {
                throw e;
            }
        } else {
            await getResultColumnName(driver, columnName, retry + 1);
        }
    }
};

const getEditorLanguage = async (driver: WebDriver): Promise<string> => {
    const editors = await driver.findElements(By.css(".editorPromptFirst"));
    const editorClasses = (await editors[editors.length - 1].getAttribute("class")).split(" ");

    return editorClasses[2].replace("my", "");
};

export const setDBEditorLanguage = async (driver: WebDriver, language: string): Promise<void> => {
    const curLang = await getEditorLanguage(driver);
    if (curLang !== language) {
        const contentHost = await driver.findElement(By.id("contentHost"));
        const textArea = await contentHost.findElement(By.css("textarea"));
        await enterCmd(driver, textArea, "\\" + language.replace("my", ""));
        const results = await driver.findElements(By.css(".message.info"));
        switch (language) {
            case "sql":
                expect(await results[results.length-1].getText()).equals("Switched to MySQL mode");
                break;
            case "js":
                expect(await results[results.length-1].getText()).equals("Switched to JavaScript mode");
                break;
            case "ts":
                expect(await results[results.length-1].getText()).equals("Switched to TypeScript mode");
                break;
            default:
                break;
        }
    }
};

export const getResultStatus = async (driver: WebDriver, isSelect?: boolean): Promise<string> => {
    let results: WebElement[] | undefined;
    let obj = "";
    if (isSelect) {
        obj = "label";
    } else {
        obj = "span";
    }
    await driver.wait(
        async (driver) => {
            results = await driver.findElements(By.css(".zoneHost"));
            const about = await results[0].findElement(By.css("span"));
            //first element is usually the about info
            if ((await about.getText()).indexOf("Welcome") !== -1) {
                results.shift();
            }
            if (results.length > 0) {
                if ((await results[0].findElements(By.css(".message.info"))).length > 0) {
                    //if language has been changed...
                    results.shift();
                }
            } else {
                return false;
            }

            return results[results.length - 1] !== undefined;
        },
        10000,
        `Result Status is undefined`,
    );

    const block = await results![results!.length - 1].findElement(By.css(obj));

    return block.getAttribute("innerHTML");
};

export const clickContextMenuItem = async (driver:WebDriver, refEl: WebElement, item: string): Promise<void> => {

    await driver.wait(async () => {
        await refEl.click();
        await driver.actions().click(Button.RIGHT).perform();

        try {
            const el: WebElement = await driver.executeScript(`return document.querySelector(".shadow-root-host").
            shadowRoot.querySelector("span[aria-label='${item}']")`);

            return el !== undefined;
        } catch(e) {
            return false;
        }

    }, 5000,
    "Context menu was not displayed");

    const el: WebElement = await driver.executeScript(`return document.querySelector(".shadow-root-host").
            shadowRoot.querySelector("span[aria-label='${item}']")`);

    await driver.wait(async () => {
        try {
            await el.click();
        } catch(e) {
            if (String(e).indexOf("StaleElementReferenceError") !== -1) {
                return true;
            }
        }

    }, 3000 ,"Context menu is still displayed");
};

export const getGraphHost = async (driver: WebDriver): Promise<WebElement> => {
    const resultHosts = await driver.findElements(By.css(".zoneHost"));
    const lastResult = resultHosts[resultHosts.length - 1];

    return driver.wait(async () => {
        return lastResult.findElement(By.css(".graphHost"));
    }, 10000, "Pie Chart was not displayed");
};

export const hasNewPrompt = async (driver: WebDriver): Promise<boolean | undefined> => {
    let text: String;
    try {
        const prompts = await driver.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
        const lastPrompt = await prompts[prompts.length-1].findElement(By.css("span > span"));
        text = await lastPrompt.getText();
    } catch(e) {
        if (String(e).indexOf("StaleElementReferenceError") === -1) {
            throw new Error(String(e.stack));
        } else {
            await driver.sleep(500);
            const prompts = await driver.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
            const lastPrompt = await prompts[prompts.length-1].findElement(By.css("span > span"));
            text = await lastPrompt.getText();
        }
    }

    return String(text).length === 0;
};

export const getLastQueryResultId = async (driver: WebDriver): Promise<number> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    if (zoneHosts.length > 0) {
        const zones = await driver.findElements(By.css(".zoneHost"));

        return parseInt((await zones[zones.length-1].getAttribute("monaco-view-zone")).match(/\d+/)![0], 10);
    } else {
        return 0;
    }
};

export const switchToFrame = async (driver: WebDriver, frame: string): Promise<void> => {
    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
    await driver.switchTo().frame(await driver.findElement(By.id(`frame:${frame}`)));
};

export const shellGetResult = async (driver: WebDriver): Promise<string> => {
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

export const shellGetResultTable = async (driver: WebDriver): Promise<WebElement | string> => {
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

export const getPromptTextLine = async (driver: WebDriver, prompt: String): Promise<String> => {
    const context = await driver.findElement(By.css(".monaco-editor-background"));
    const lines = await context.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));

    let tags;
    switch(prompt) {
        case "last":
            tags = await lines[lines.length-1].findElements(By.css("span > span"));
            break;
        case "last-1":
            tags = await lines[lines.length-2].findElements(By.css("span > span"));
            break;
        case "last-2":
            tags = await lines[lines.length-3].findElements(By.css("span > span"));
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

export const cleanEditor = async (driver: WebDriver): Promise<void> => {
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
        return await getPromptTextLine(driver, "last") === "";
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

export const shellGetTotalRows = async (driver: WebDriver): Promise<string> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const zoneHost = zoneHosts[zoneHosts.length - 1];

    return zoneHost
        .findElement(By.css(".resultStatus .info"))
        .getText();
};

export const shellGetLangResult = async (driver: WebDriver): Promise<string> => {
    await driver.wait(until.elementLocated(By.css(".zoneHost")), 2000);
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const zoneHost = zoneHosts[zoneHosts.length - 1];

    const dataLang = await (await zoneHost.findElement(By.css("label"))).getAttribute("data-lang");

    return dataLang;
};

export const isValueOnDataSet = async (driver: WebDriver, value: String): Promise<boolean> => {
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
