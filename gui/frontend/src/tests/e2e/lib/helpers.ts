/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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
import { By, until, Key, WebDriver, WebElement } from "selenium-webdriver";
import * as net from "net";

export const waitForHomePage = async (driver: WebDriver): Promise<void> => {
    await driver.wait(until.elementLocated(By.id("mainActivityBar")), 10000, "Blank page was displayed");
};

export const waitForLoginPage = async (driver: WebDriver): Promise<void> => {
    await driver.findElement(By.id("loginDialogSakilaLogo"));
};

export const getBackgroundColor = async (driver: WebDriver): Promise<void> => {
    const script =
        "return window.getComputedStyle(document.documentElement).getPropertyValue('--background'); ";

    return driver.executeScript(script);
};


export const selectAppColorTheme = async (driver: WebDriver, theme: string): Promise<void> => {
    await driver.findElement(By.id("theming.currentTheme")).click();
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    await dropDownList.findElement(By.id(theme)).click();
};

export const selectDatabaseType = async (driver: WebDriver, value: string): Promise<void> => {
    await driver.findElement(By.id("databaseType")).click();
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    const els = await dropDownList.findElements(By.css("div"));
    if (els.length > 0) {
        await dropDownList.findElement(By.id(value)).click();
    }
};

export const selectProtocol = async (driver: WebDriver, value: string): Promise<void> => {
    await driver.findElement(By.id("scheme")).click();
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    await dropDownList.findElement(By.id(value)).click();
};

export const selectSSLMode = async (driver: WebDriver, value: string): Promise<void> => {
    await driver.findElement(By.id("sslMode")).click();
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    await dropDownList.findElement(By.id(value)).click();
};

export interface IDbConfig {
    dbType: string;
    caption: string;
    description: string;
    hostname: string | undefined;
    protocol: string;
    port: string | undefined;
    username: string | undefined;
    password: string | undefined;
    schema: string | undefined;
    showAdvanced: boolean;
    sslMode: string;
    compression: string;
    timeout: string;
    attributes: string;
    portX: string;
}

export const createDBconnection = async (driver: WebDriver, dbConfig: IDbConfig,
    storePassword?: boolean, clearPassword?: boolean): Promise<void> => {
    await driver
        .findElement(By.css(".connectionBrowser"))
        .findElement(By.id("-1"))
        .click();
    const newConDialog = await driver.findElement(By.css(".valueEditDialog"));
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
    await newConDialog.findElement(By.id("hostName")).sendKeys(String(dbConfig.hostname));
    await selectProtocol(driver, dbConfig.protocol);
    await driver.findElement(By.css("#port input")).clear();
    await driver.findElement(By.css("#port input")).sendKeys(String(dbConfig.port));
    await newConDialog.findElement(By.id("userName")).sendKeys(String(dbConfig.username));
    await newConDialog
        .findElement(By.id("defaultSchema"))
        .sendKeys(String(dbConfig.schema));
    if (clearPassword) {
        await newConDialog.findElement(By.id("clearPassword")).click();
        try {
            const dialog = await driver.wait(until.elementsLocated(By.css(".errorPanel")), 500, "");
            await dialog[0].findElement(By.css("button")).click();
        } catch(e) {
            //continue
        }
    }
    if (storePassword) {
        const storeBtn = await newConDialog.findElement(By.id("storePassword"));
        await storeBtn.click();
        const dialog = await driver.wait(until.elementLocated(By.css(".passwordDialog")),
            2000, "No password dialog was found");
        await dialog.findElement(By.css("input")).sendKeys(String(dbConfig.password));
        await dialog.findElement(By.id("ok")).click();
    }
    await selectDatabaseType(driver, dbConfig.dbType);
    if (!dbConfig.showAdvanced) {
        const okBtn = await driver.findElement(By.id("ok"));
        await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
        await okBtn.click();
        expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(
            0,
        );
    } else {
        await driver.executeScript(
            "arguments[0].click();",
            await newConDialog.findElement(By.css(".checkMark")),
        );
        if (dbConfig.sslMode) {
            await selectSSLMode(driver, dbConfig.sslMode);
        } else {
            await selectSSLMode(driver, "Disable");
        }
        await newConDialog.findElement(By.id("page1")).click();
        await newConDialog
            .findElement(By.id("compressionType"))
            .sendKeys(dbConfig.compression);
        await newConDialog.findElement(By.id("timeout")).sendKeys(dbConfig.timeout);
        await newConDialog
            .findElement(By.id("others"))
            .sendKeys(dbConfig.attributes);
        const okBtn = await driver.findElement(By.id("ok"));
        await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
        await okBtn.click();
    }
};

export const getDB = async (driver: WebDriver, name: string): Promise<WebElement | undefined> => {
    return driver.wait(async () => {
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
    }, 5000, `No ${name} DB was found`);
};

export const closeDBconnection = async (driver: WebDriver, name: string): Promise<void> => {

    const connections = await driver
        .findElements(By.xpath("//div[contains(@id, 'connection_') and contains(@class, 'selectorItem')]"));

    for (const connection of connections) {
        if (await connection.findElement(By.css("label")).getText() === name) {
            await connection.findElement(By.css(".closeButton > div")).click();
        }
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

export const getResultStatus = async (driver: WebDriver, blockNbr: number, isSelect?: boolean): Promise<string> => {
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
                    //if languange has been changed...
                    results.shift();
                }
            } else {
                return false;
            }

            return results[blockNbr - 1] !== undefined;
        },
        7000,
        `Result Status is undefined (block number ${blockNbr})`,
    );

    const block = await results![blockNbr - 1].findElement(By.css(obj));

    return block.getAttribute("innerHTML");
};

export const getConnectionTab = async (driver: WebDriver, id: string): Promise<WebElement> => {
    const tab = await driver.findElement(By.xpath("//div[contains(@id, 'tab" + id + "')]"));

    return tab.findElement(By.css(".label"));
};


const getSettingArea = async (driver: WebDriver, title: string): Promise<WebElement | undefined> => {
    const settings = await driver.findElement(By.id("settingsHost"));
    const settingsTreeRows = await settings.findElements(
        By.css(".settingsTreeCell label"),
    );

    for (const setting of settingsTreeRows) {
        if ((await setting.getText()) === title) {
            return setting;
        }
    }
};

export const setStartLanguage = async (driver: WebDriver, section: string, value: string): Promise<void> => {
    await driver.findElement(By.id("settings")).click();
    await (await getSettingArea(driver, section))!.click();
    if (section === "DB Editor") {
        await driver.findElement(By.id("dbEditor.startLanguage")).click();
    } else {
        await driver.findElement(By.id("shellSession.startLanguage")).click();
    }

    await driver.wait(until.elementLocated(By.css(".dropdownList")));
    await driver.findElement(By.id(value)).click();
};

export const openShellSession = async (driver: WebDriver): Promise<void> => {
    await driver.findElement(By.id("-1")).click();
    await driver.wait(
        until.elementLocated(By.id("shellEditorHost")),
        15000,
        "Session was not opened",
    );
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

export const shellGetLangResult = async (driver: WebDriver): Promise<string> => {
    await driver.wait(until.elementLocated(By.css(".zoneHost")), 2000);
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const zoneHost = zoneHosts[zoneHosts.length - 1];

    const dataLang = await (await zoneHost.findElement(By.css("label"))).getAttribute("data-lang");

    return dataLang;
};

export const pressEnter = async (driver: WebDriver): Promise<void> => {
    if (platform() === "win32") {
        await driver
            .actions()
            .keyDown(Key.CONTROL)
            .keyDown(Key.ENTER)
            .keyUp(Key.CONTROL)
            .keyUp(Key.ENTER)
            .perform();
    } else if (platform() === "darwin") {
        await driver
            .actions()
            .keyDown(Key.COMMAND)
            .keyDown(Key.ENTER)
            .keyUp(Key.COMMAND)
            .keyUp(Key.ENTER)
            .perform();
    }
};

export const writeSQL = async (driver: WebDriver, sql: string): Promise<void> => {
    const textArea = await driver.findElement(By.css("textarea"));
    await textArea.sendKeys(sql);
    try {
        await driver.wait(until.elementLocated(By.css("div.contents")), 500, "none");
    } catch (e) {
        return;
    }
    await textArea.sendKeys(Key.ENTER);
};

export const enterCmd = async (driver: WebDriver, textArea: WebElement, cmd: string): Promise<void> => {
    cmd = cmd.replace(/(\r\n|\n|\r)/gm, "");
    const prevBlocks = await driver.findElements(By.css(".zoneHost"));
    await textArea.sendKeys(cmd);
    if (cmd.indexOf("\\") !== -1) {
        const codeMenu = await driver.findElements(By.css("div.contents"));
        if (codeMenu.length > 0) {
            await textArea.sendKeys(Key.ENTER);
        }
    } else {
        await textArea.sendKeys(Key.ENTER);
    }
    await pressEnter(driver);

    if (cmd !== "\\q") {
        await driver.wait(async () => {
            const blocks = await driver.findElements(By.css(".zoneHost"));

            return blocks.length > prevBlocks.length;
        }, 10000, "Command '" + cmd + "' did not triggered a new results block");
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

export const shellGetTotalRows = async (driver: WebDriver): Promise<string> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const zoneHost = zoneHosts[zoneHosts.length - 1];

    return zoneHost
        .findElement(By.css(".resultStatus .info"))
        .getText();
};


export const shellGetSession = async (driver: WebDriver, sessionNbr: string): Promise<WebElement | undefined> => {
    const buttons = await driver.findElements(By.css("#tilesHost button"));
    for (const button of buttons) {
        if ((await button.getAttribute("id")) === sessionNbr) {
            return button;
        }
    }

    return undefined;
};

const shellGetTab = async (driver: WebDriver, sessionNbr: string): Promise<WebElement> => {
    const tabArea = await driver.findElement(By.css(".tabArea"));
    await driver.wait(
        async () => {
            return (
                (
                    await tabArea.findElements(
                        By.xpath("//div[contains(@id, 'session_" + sessionNbr + "')]"),
                    )
                ).length > 0
            );
        },
        10000,
        "Session was not opened",
    );

    return tabArea.findElement(
        By.xpath("//div[contains(@id, 'session_" + sessionNbr + "')]"),
    );
};

export const closeSession = async (driver: WebDriver, sessionNbr: string): Promise<void> => {
    const tab = await shellGetTab(driver, sessionNbr);
    await tab.findElement(By.css(".closeButton")).click();
};

export const shellGetTech = async (driver: WebElement): Promise<string> => {
    const divs = await driver.findElements(
        By.css(".margin-view-overlays div div"),
    );
    const lastDiv = divs[divs.length - 1];
    const classes = (await lastDiv.getAttribute("class")).split(" ");

    return classes[2];
};

export const getCurrentProfile = async (driver: WebDriver): Promise<string | undefined> => {
    const btns = await driver.findElements(By.css(".leftItems button"));
    for (const button of btns) {
        if ((await button.getAttribute("title")) === "Change profile") {
            return button.getText();
        }
    }
};

export const openProfileMenu = async (driver: WebDriver): Promise<WebElement | undefined> => {
    let isOpened;
    if ((await driver.findElements(By.css(".noArrow.menu"))).length > 0) {
        isOpened = true;
    } else {
        isOpened = false;
    }

    if (!isOpened) {
        const btns = await driver.findElements(By.css(".leftItems button"));
        for (const button of btns) {
            if ((await button.getAttribute("title")) === "Change profile") {
                await button.click();
                await driver.wait(
                    until.elementLocated(By.css(".noArrow.menu")),
                    2000,
                    "Profile menu was not displayed",
                );

                return driver.findElement(By.css(".noArrow.menu"));
            }
        }
    }
};

export const getProfile = async (driver: WebDriver, profile: string): Promise<WebElement | undefined> => {
    await openProfileMenu(driver);
    const menu = await driver.findElement(By.css(".noArrow.menu"));
    const items = await menu.findElements(By.css("div.menuItem"));

    for (const item of items) {
        if (Number.isInteger(parseInt(await item.getAttribute("id"), 10))) {
            if ((await item.findElement(By.css("label")).getText()) === profile) {

                return item;
            }
        }
    }
};

export const addProfile = async (driver: WebDriver,
    profile: string, profile2copy: string | undefined): Promise<void> => {
    await openProfileMenu(driver);
    await driver.findElement(By.id("add")).click();
    const dialog = await driver.findElement(By.css(".valueEditDialog"));
    await dialog.findElement(By.id("profileName")).sendKeys(profile);
    if (profile2copy) {
        await driver.executeScript(
            "arguments[0].click()",
            await dialog
                .findElement(By.id("copyProfile"))
                .findElement(By.css(".checkMark")),
        );
        await dialog.findElement(By.id("definedProfiles")).click();
        const dropDownList = await driver.findElement(By.css(".dropdownList"));
        await dropDownList.findElement(By.id(profile2copy)).click();
    }
    await dialog.findElement(By.id("ok")).click();
};

export const setProfilesToRemove = async (driver: WebDriver, profs: string[]): Promise<void> => {
    let els;
    let label;
    const profiles = await driver.findElements(
        By.xpath('//div[contains(@id, "profileActivateDeactivate")]'),
    );
    const ids = [];
    for (const profile of profiles) {
        label = await profile.findElement(By.css("label"));
        els = (await label.getAttribute("class")).split(" ");
        if (profs.includes((await label.getText()).trim())) {
            if (els.includes("unchecked")) {
                ids.push(await profile.getAttribute("id"));
            }
        } else {
            if (els.includes("checked")) {
                ids.push(await profile.getAttribute("id"));
            }
        }
    }

    let toClick;
    for (const id of ids) {
        toClick = await driver.findElement(By.id(id));
        await driver.executeScript(
            "arguments[0].click();",
            await toClick.findElement(By.css("label")),
        );
    }
};

export const findInSelection = async (el: WebElement, flag: boolean): Promise<void> => {
    const actions = await el.findElements(By.css(".find-actions div"));
    for (const action of actions) {
        if (
            (await action.getAttribute("title")).indexOf("Find in selection") !==
            -1
        ) {
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

export const closeFinder = async (el: WebElement): Promise<void> => {
    const actions = await el.findElements(By.css(".find-actions div"));
    for (const action of actions) {
        if ((await action.getAttribute("title")).indexOf("Close") !== -1) {
            await action.click();
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
        if (
            (await action.getAttribute("title")).indexOf(button) !== -1
        ) {
            return action;
        }
    }
};

export const getSchemaObject = async (driver: WebDriver,
    objType: string, objName: string): Promise<WebElement | undefined> => {
    const scroll = await driver
        .findElement(By.id("schemaSectionHost"))
        .findElement(By.css(".tabulator-tableholder"));

    await driver.executeScript("arguments[0].scrollBy(0,-1000)", scroll);

    const sectionHost = await driver.findElement(By.id("schemaSectionHost"));
    let level: number;
    switch (objType) {
        case "Schema":
            level = 0;
            break;
        case "Tables":
        case "Views":
        case "Routines":
        case "Events":
        case "Triggers":
        case "Foreign keys":
        case "Indexes":
            level = 1;
            break;
        default:
            level = 2;
    }

    await driver.wait(
        async () => {
            try {
                const objects = await sectionHost.findElements(
                    By.css(`.tabulator-table .tabulator-tree-level-${level}`),
                );

                return (
                    (await objects[0].findElement(By.css("label")).getText()) !==
                    "loading..."
                );
            } catch (e) {
                return true;
            }
        },
        3000,
        "Still loading",
    );

    const findItem = async (scrollNumber: number): Promise<WebElement | undefined> => {
        if (scrollNumber <= 4) {
            const sectionHost = await driver.findElement(By.id("schemaSectionHost"));
            const objects = await sectionHost.findElements(
                By.css(`.tabulator-table .tabulator-tree-level-${level}`),
            );
            let ref;
            try {
                for (const object of objects) {
                    ref = object.findElement(By.css("label"));
                    await driver.executeScript("arguments[0].scrollIntoView(true);", ref);
                    if (await ref.getText() === objName) {
                        return object;
                    }
                }
            } catch (e) { null; }

            return findItem(scrollNumber + 1);
        } else {
            return undefined;
        }
    };

    const item: WebElement | undefined = await findItem(0);

    return item;
};

export const toggleSchemaObject = async (driver: WebDriver, objType: string, objName: string): Promise<void> => {
    const obj = await getSchemaObject(driver, objType, objName);
    const toggle = await obj!.findElement(By.css(".treeToggle"));
    await driver.executeScript("arguments[0].click()", toggle);
    await driver.sleep(1000);
};

export const addScript = async (driver: WebDriver, scriptType: string): Promise<string> => {
    const context = await driver.findElement(By.id("scriptSectionHost"));
    const items = await context.findElements(By.css("div.tabulator-row"));

    await driver.executeScript(
        "arguments[0].click()",
        await context.findElement(By.id("addScript")),
    );
    const menu = await driver.findElement(By.css("div.visible.noArrow.menu"));
    switch (scriptType) {
        case "JS":
            await menu.findElement(By.id("addJSScript")).click();
            break;
        case "TS":
            await menu.findElement(By.id("addTSScript")).click();
            break;
        case "SQL":
            await menu.findElement(By.id("addSQLScript")).click();
            break;
        default:
            break;
    }

    await driver.wait(async () => {
        return (await context.findElements(By.css("div.tabulator-row"))).length > items.length;
    }, 2000, "No script was created");

    return `Script ${(await context.findElements(By.css("div.tabulator-row"))).length}`;
};

export const existsScript = async (driver: WebDriver, scriptName: string, scriptType: string): Promise<boolean> => {
    const context = await driver.findElement(By.id("scriptSectionHost"));
    const items = await context.findElements(By.css("div.tabulator-row"));
    for(const item of items) {
        const label = await (await item.findElement(By.css(".schemaTreeEntry label"))).getText();
        const src = await (await item.findElement(By.css(".schemaTreeEntry img"))).getAttribute("src");
        if( label === scriptName && src.indexOf(scriptType) !== -1) {
            return true;
        }
    }

    return false;
};

export const getOpenEditor = async (driver: WebDriver, editor: string): Promise<WebElement | undefined> => {
    const context = await driver.findElement(By.id("editorSectionHost"));
    const editors = await context.findElements(
        By.css("div.accordionItem.closable"),
    );
    for (const edtr of editors) {
        if ((await edtr.findElement(By.css("span.label")).getText()) === editor) {
            return edtr;
        }
    }
};

export const selectCurrentEditor = async (driver: WebDriver, editorName: string, editorType: string): Promise<void> => {
    const selector = await driver.findElement(By.id("documentSelector"));
    await driver.executeScript("arguments[0].click()", selector);

    await driver.wait(async () => {
        return (await driver.findElements(By.css("div.visible.dropdownList > div"))).length > 1;
    }, 2000, "No elements located on dropdown");

    const dropDownItems = await driver.findElements(
        By.css("div.visible.dropdownList > div"),
    );

    for (const item of dropDownItems) {
        const name = await item.findElement(By.css("label")).getText();
        const type = await item
            .findElement(By.css("img"))
            .getAttribute("src");
        if (name === editorName) {
            if (type.indexOf(editorType) !== -1) {
                await driver.wait(async () => {
                    await item.click();
                    const selected = await selector.findElement(By.css("label")).getText();

                    return selected === editorName;
                }, 5000, `${editorName} with type ${editorType} was not properly selected`);

                await driver.wait(
                    async () => {
                        return (
                            (
                                await driver.findElements(
                                    By.css("div.visible.dropdownList > div"),
                                )
                            ).length === 0
                        );
                    },
                    2000,
                    "Dropdown list is still visible",
                );

                return;
            }
        }
    }
    throw new Error(`Coult not find ${editorName} with type ${editorType}`);
};

export const getResultTab = async (driver: WebDriver, tabName: string): Promise<WebElement | undefined> => {
    const tabs = await driver.wait(until.elementsLocated(By.css(".resultHost .tabArea div")),
        5000, "Tabs were not found in time");

    for (const tab of tabs) {
        if (await tab.getAttribute("id") !== "selectorItemstepDown" &&
            await tab.getAttribute("id") !== "selectorItemstepUp") {
            if (await (await tab.findElement(By.css("label"))).getText() === tabName) {

                return tab;
            }
        }
    }
};

export const getResultColumnName = async (driver: WebDriver, columnName: string): Promise<WebElement | undefined> => {
    const resultSet = await driver.findElement(
        By.css(".resultHost .tabulator-headers"),
    );

    const resultHeaderRows = await resultSet.findElements(
        By.css(".tabulator-col-title"),
    );

    for (const row of resultHeaderRows) {
        if (await row.getText() === columnName) {
            return row;
        }
    }
};

export const findFreePort = async (): Promise<number> => {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        let calledFn = false;

        server.on("error", (err) => {
            server.close();

            if (!calledFn) {
                calledFn = true;
                reject(err);
            }
        });

        server.listen(0, () => {
            const address = server.address();
            if (!address || typeof address === "string" || address.port === 0) {
                reject(new Error("Unable to get a port for the backend"));
            } else {
                server.close();

                if (!calledFn) {
                    calledFn = true;
                    resolve(address.port);
                }
            }
        });
    });
};

const existsAboutInformation = async (driver: WebDriver): Promise<boolean> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const span = await zoneHosts[0].findElements(By.css("span"));
    if (span.length > 0) {
        if ((await span[0].getText()).indexOf("Welcome") !== -1) {
            return true;
        }
    }

    return false;
};

export const getGraphHost = async (driver: WebDriver, blockNbr: number): Promise<WebElement> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    let context;
    if (await existsAboutInformation(driver)) {
        context = zoneHosts[blockNbr]; //first element is the about information
    } else {
        context = zoneHosts[blockNbr - 1];
    }

    return context.findElement(By.css(".graphHost"));
};

export const getOutput = async (driver: WebDriver, blockNbr: number): Promise<string> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    let context;
    if (await existsAboutInformation(driver)) {
        context = zoneHosts[blockNbr]; //first element is the about information
    } else {
        context = zoneHosts[blockNbr - 1];
    }

    let items = await context.findElements(By.css("label"));
    const otherItems = await context.findElements(By.css(".textHost span"));
    let text;

    if (items.length > 0) {
        text = await items[0].getText();
    } else if (otherItems.length > 0) {
        text = await otherItems[0].getText();
    } else {
        items = await context.findElements(By.css(".info"));
        text = await items[0].getText();
    }

    return text;
};

const getEditorLanguage = async (driver: WebDriver): Promise<string> => {
    const editors = await driver.findElements(By.css(".editorPromptFirst"));
    const editorClasses = (await editors[editors.length - 1].getAttribute("class")).split(" ");

    return editorClasses[2].replace("my", "");
};

export const setEditorLanguage = async (driver: WebDriver, language: string): Promise<void> => {
    const curLang = await getEditorLanguage(driver);
    if (curLang !== language) {
        const contentHost = await driver.findElement(By.id("contentHost"));
        const textArea = await contentHost.findElement(By.css("textarea"));
        await enterCmd(driver, textArea, "\\" + language.replace("my", ""));
        const result = await driver.findElement(By.css(".message.info"));
        switch (language) {
            case "sql":
                expect(await result.getText()).toBe("Switched to MySQL mode");
                break;
            case "js":
                expect(await result.getText()).toBe("Switched to JavaScript mode");
                break;
            case "ts":
                expect(await result.getText()).toBe("Switched to TypeScript mode");
                break;
            default:
                break;
        }
    }
};

export const toggleExplorerHost = async (driver: WebDriver, action: string): Promise<void> => {
    const guiSqlEditor = await driver.findElement(By.id("gui.sqleditor"));

    const explorerWidth = async (driver: WebDriver) => {
        const explorerHost = await driver.findElement(By.id("explorerHost"));
        const styles = (await explorerHost.getAttribute("style")).split(";");
        const getWidth = (element: string) => { return element.indexOf("width") !== -1; };
        const widthIdx = styles.findIndex(getWidth);
        const match = styles[widthIdx].match(/(\d+)/gm);

        return parseInt(match![0], 10);
    };

    if (action === "open") {
        if (await explorerWidth(driver) === 0) {
            await guiSqlEditor.click();
            await driver.wait(async () => {
                return await explorerWidth(driver) > 0;
            }, 3000, "Explorer was not opened");
        }
    } else {
        if (await explorerWidth(driver) > 0) {
            await guiSqlEditor.click();
            await driver.wait(async () => {
                return await explorerWidth(driver) === 0;
            }, 3000, "Explorer was not closed");
        }
    }
};

export const toggleUiColorsMenu = async (driver: WebDriver, menu: string, action: string): Promise<void> => {
    const isTabOpened = async (tab: WebElement) => {
        return (await tab.getAttribute("class")).includes("expanded");
    };

    const themeTabView = await driver.findElement(By.id("themeTabview"));

    await driver.wait(async () => {
        const els = await themeTabView.findElements(By.css(".tabulator-tableholder .tabulator-selectable"));

        try {
            await els[0].findElement(By.css("label")).getText();

            return true;
        } catch (e) {
            return false;
        }
    }, 2000, "Elements are stale");

    const uiColorsItems = await themeTabView.findElements(By.css(".tabulator-tableholder .tabulator-selectable"));

    for (let i = 0; i <= uiColorsItems.length - 1; i++) {
        if (await uiColorsItems[i].findElement(By.css("label")).getText() === menu) { //base colors
            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await uiColorsItems[i].findElement(By.css("label")));
            if (action === "open") {
                if (!(await isTabOpened(uiColorsItems[i]))) {
                    await uiColorsItems[i].findElement(By.css(".treeToggle")).click();
                }
            } else {
                if (await isTabOpened(uiColorsItems[i])) {
                    await uiColorsItems[i].findElement(By.css(".treeToggle")).click();
                }
            }
            break;
        }
    }
};

export const setThemeEditorColors = async (driver: WebDriver, optionId: string,
    detail: string, value: string): Promise<void> => {

    await driver.wait(async () => {
        await driver.findElement(By.id(optionId)).click();

        return (await driver.findElements(By.css(".colorPopup"))).length > 0;
    }, 3000, "Color Pallete was not opened");

    const colorPopup = await driver.findElement(By.css(".colorPopup"));
    await colorPopup.findElement(By.id(detail)).clear();
    await colorPopup.findElement(By.id(detail)).sendKeys(value);
    await colorPopup.findElement(By.id(detail)).sendKeys(Key.ESCAPE);
};

export const getElementStyle = async (driver: WebDriver, element: WebElement, style: string): Promise<void> => {
    return driver.executeScript("return window.getComputedStyle(arguments[0])." + style, element);
};

export const rgbToHex = (r: string, g: string, b: string): string => {

    const componentToHex = (c: number) => {
        const hex = c.toString(16);

        return hex.length === 1 ? "0" + hex : hex;
    };

    const result = "#" + componentToHex(parseInt(r, 10)) +
        componentToHex(parseInt(g, 10)) + componentToHex(parseInt(b, 10));

    return result.toUpperCase();
};

export const hslToHex = (h: number, s: number, l: number): string => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);

        return Math.round(255 * color).toString(16)
            .padStart(2, "0");   // convert to Hex and prefix "0" if needed
    };

    return `#${f(0)}${f(8)}${f(4)}`;
};

export const setDBEditorPassword = async (driver: WebDriver, dbConfig: IDbConfig): Promise<void> => {
    const dialog = await driver.wait(until.elementsLocated(By.css(".passwordDialog")),
        500, "No Password dialog was found");

    const title = await dialog[0].findElement(By.css(".title .label"));
    const gridDivs = await dialog[0].findElements(By.css("div.grid > div"));

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

    expect(service).toBe(`${String(dbConfig.username)}@${String(dbConfig.hostname)}:${String(dbConfig.port)}`);
    expect(username).toBe(dbConfig.username);

    expect(await title.getText()).toBe("Open MySQL Connection in Shell Session");

    await dialog[0].findElement(By.css("input")).sendKeys(String(dbConfig.password));
    await dialog[0].findElement(By.id("ok")).click();
};

export const setFeedbackRequested = async (driver: WebDriver, dbConfig: IDbConfig, value: string): Promise<void> => {
    const feedbackDialog = await driver.wait(until.elementsLocated(By.css(".valueEditDialog")),
        500, "No Feedback Request dialog was found");

    expect(await feedbackDialog[0].findElement(By.css(".title label")).getText()).toBe("Feedback Requested");

    expect(await feedbackDialog[0].findElement(By.css(".valueTitle")).getText())
        .toContain(`${String(dbConfig.username)}@${String(dbConfig.hostname)}:${String(dbConfig.port)}`);

    expect(await feedbackDialog[0].findElement(By.css(".valueTitle")).getText())
        .toContain("? [Y]es/[N]o/Ne[v]er (default No):");

    const input = await feedbackDialog[0].findElement(By.css("input"));
    await input.sendKeys(value);
    await feedbackDialog[0].findElement(By.id("ok")).click();
};

export const clickDBEditorContextItem = async (driver: WebDriver, itemName: string): Promise<void> => {
    let taps = 0;
    switch (itemName) {
        case "Execute Block":
            taps = 7;
            break;
        case "Execute Block and Advance":
            taps = 8;
            break;
        case "Cut":
            taps = 10;
            break;
        case "Copy":
            taps = 11;
            break;
        case "Paste":
            taps = 12;
            break;
        case "Command Pallete":
            taps = 13;
            break;
        default: break;
    }

    const lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));
    const el = lines[lines.length - 1];
    await driver
        .actions()
        .contextClick(el)
        .perform();

    await driver.sleep(500);
    const action = driver.actions();
    for (let i = 1; i <= taps; i++) {
        action.keyDown(Key.ARROW_DOWN).keyUp(Key.ARROW_DOWN).pause(100);
    }
    await action.keyDown(Key.ENTER).keyUp(Key.ENTER).perform();
};

export const clickSettingArea = async (driver: WebDriver, settingId: string): Promise<void> => {
    if (settingId.indexOf("settings") !== -1) {
        await (await getSettingArea(driver, "Settings"))!.click();
    } else if (settingId.indexOf("theming.") !== -1) {
        await (await getSettingArea(driver, "Theme Settings"))!.click();
    } else if (settingId.indexOf("editor.") !== -1) {
        await (await getSettingArea(driver, "Code Editor"))!.click();
    } else if (settingId.indexOf("dbEditor.") !== -1) {
        await (await getSettingArea(driver, "DB Editor"))!.click();
    } else if (settingId.indexOf("sql") !== -1) {
        await (await getSettingArea(driver, "SQL Execution"))!.click();
    } else if (settingId.indexOf("session") !== -1) {
        await (await getSettingArea(driver, "Shell Session"))!.click();
    } else {
        throw new Error("unknown settingId: " + settingId);
    }
};

//there are inputs that become stale after inserting 1 element
export const setInputValue = async (driver: WebDriver, inputId: string,
    type: string | undefined, value: string): Promise<void> => {
    let el = await driver.findElement(By.id(inputId));
    const letters = value.split("");
    for (const letter of letters) {
        if (type) {
            el = await driver.findElement(By.id(inputId)).findElement(By.css(type));
        } else {
            el = await driver.findElement(By.id(inputId));
        }
        await el.sendKeys(letter);
    }
};

export const setSetting = async (driver: WebDriver, settingId: string, type: string, value: string): Promise<void> => {
    const settingsValueList = driver.findElement(By.id("settingsValueList"));
    await clickSettingArea(driver, settingId);
    const el = settingsValueList.findElement(By.id(settingId));
    await driver.executeScript("arguments[0].scrollIntoView(true)", el);
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    const classes = (await el.getAttribute("class")).split(" ");
    switch (type) {
        case "input":
            await driver.executeScript("arguments[0].click()", el);
            if ((await el.getTagName()) === "input") {
                await el.clear();
                await setInputValue(driver, settingId, undefined, value);
            } else {
                await el.findElement(By.css(type)).clear();
                await setInputValue(driver, settingId, type, value);
            }
            break;
        case "selectList":
            await el.click();
            try {
                await dropDownList
                    .findElement(By.xpath("//div[contains(@id, '" + value + "')]"))
                    .click();
            } catch (e) {
                await dropDownList.findElement(By.id(value)).click();
            }
            break;
        case "checkbox":
            if (value === "checked") {
                if (classes.includes("unchecked")) {
                    await el.findElement(By.css("span")).click();
                }
                expect(await el.getAttribute("class")).toContain("checked");
            } else {
                if (classes.includes("checked")) {
                    await driver.wait(async () => {
                        let attrs = (await el.getAttribute("class")).split(" ");
                        if (attrs.includes("checked")) {
                            await el.findElement(By.css("span")).click();
                        }
                        attrs = (await settingsValueList.findElement(By.id(settingId))
                            .getAttribute("class")).split(" ");

                        return attrs.includes("unchecked");
                    }, 3000, "Error on force check/uncheck");
                }
                expect(await (await settingsValueList.findElement(By.id(settingId)))
                    .getAttribute("class")).toContain("unchecked");
            }
            break;
        default:
            break;
    }
};

export const getSettingValue = async (driver: WebDriver, settingId: string, type: string): Promise<string> => {
    const settingsValueList = driver.findElement(By.id("settingsValueList"));
    await clickSettingArea(driver, settingId);
    const el = settingsValueList.findElement(By.id(settingId));
    await driver.executeScript("arguments[0].scrollIntoView(true)", el);
    let settingValue = "";
    const classes = (await el.getAttribute("class")).split(" ");
    switch (type) {
        case "input":
            if ((await el.getTagName()) === "input") {
                return el.getAttribute("value");
            } else {
                settingValue = await el.findElement(By.css(type)).getAttribute("value");
            }
            break;
        case "selectList":
            settingValue = await el.findElement(By.css("label")).getText();
            break;
        case "checkbox":
            if (classes.includes("unchecked")) {
                settingValue = "unchecked";
            }
            if (classes.includes("checked")) {
                settingValue = "checked";
            }
            break;
        default:
            break;
    }

    return settingValue;
};

export const setDBEditorStartLang = async (driver: WebDriver, lang: string): Promise<void> => {
    await driver.findElement(By.id("settings")).click();
    const settings = await driver.findElement(By.id("settingsHost"));
    const settingsTreeRows = await settings.findElements(
        By.css(".settingsTreeCell label"),
    );
    await settingsTreeRows[2].click();
    await driver.findElement(By.id("dbEditor.startLanguage")).click();
    const dropDown = await driver.wait(until.elementLocated(By.css(".dropdownList.manualFocus")),
        3000, "dropDown not displayed");
    await dropDown.findElement(By.id(lang)).click();
};

//This function checks if the Db Type drop down list is stale.
//Because of the tests speed, sometimes we need to reload the dialog
export const initConDialog = async (driver: WebDriver): Promise <void> => {
    await driver
        .findElement(By.css(".connectionBrowser"))
        .findElement(By.id("-1"))
        .click();

    const dialog = driver.findElement(By.css(".valueEditDialog"));
    await dialog.findElement(By.id("cancel")).click();
    await driver.wait(until.stalenessOf(dialog), 2000, "Connection dialog is still displayed");
};
