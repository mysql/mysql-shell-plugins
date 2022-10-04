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
import { By, until, Key, WebElement } from "selenium-webdriver";
import { driver } from "../lib/engine";

/**
 * Waits for the homepage to be loaded
 *
 * @returns A promise resolving when the homepage is loaded.
 */
export const waitForHomePage = async (): Promise<void> => {
    await driver.wait(until.elementLocated(By.id("mainActivityBar")), 10000, "Blank page was displayed");
};

/**
 * Waits for the login page to be loaded
 *
 * @returns A promise resolving when the login page is loaded
 */
export const waitForLoginPage = async (): Promise<void> => {
    await driver.findElement(By.id("loginDialogSakilaLogo"));
};

/**
 * Returns the background color of the page
 *
 * @returns Promise resolving to the background color
 */
export const getBackgroundColor = async (): Promise<string> => {
    const script =
        "return window.getComputedStyle(document.documentElement).getPropertyValue('--background'); ";

    return driver.executeScript(script);
};

/**
 * Selects the color theme on Theme Editor section
 *
 * @param theme name of the theme
 * @returns Promise resolving when the select is made
 */
export const selectAppColorTheme = async (theme: string): Promise<void> => {
    await driver.findElement(By.id("theming.currentTheme")).click();
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    await dropDownList.findElement(By.id(theme)).click();
};

/**
 * Selects the database type on the Database Connection Configuration dialog
 *
 * @param value database type
 * @returns Promise resolving when the select is made
 */
export const selectDatabaseType = async (value: string): Promise<void> => {
    await driver.findElement(By.id("databaseType")).click();
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    const els = await dropDownList.findElements(By.css("div"));
    if (els.length > 0) {
        await dropDownList.findElement(By.id(value)).click();
    }
};

/**
 * Selects the protocol on the Database Connection Configuration dialog
 *
 * @param value protocol
 * @returns Promise resolving when the select is made
 */
export const selectProtocol = async (value: string): Promise<void> => {
    await driver.findElement(By.id("scheme")).click();
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    await dropDownList.findElement(By.id(value)).click();
};

/**
 * Selects the SSL Mode on the Database Connection Configuration dialog
 *
 * @param value SSL Mode
 * @returns Promise resolving when the select is made
 */
export const selectSSLMode = async (value: string): Promise<void> => {
    await driver.findElement(By.id("sslMode")).click();
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    await dropDownList.findElement(By.id(value)).click();
};

/**
 * DB Connection interface
 *
 */
export interface IDBConnection {
    dbType: string | undefined;
    caption: string;
    description: string;
    hostname: string;
    protocol: string;
    port: string;
    portX: string | undefined;
    username: string;
    password: string;
    schema: string;
    sslMode: string | undefined;
    sslCA: string | undefined;
    sslClientCert: string | undefined;
    sslClientKey: string | undefined;
}

/**
 * Creates a new database connection, from the DB Editor main page.
 * It verifies that the Connection dialog is closed, at the end.
 *
 * @param dbConfig SSL Mode
 * @param storePassword true saves the password
 * @param clearPassword true cleares the password
 * @returns Promise resolving when the connection is created
 */
export const createDBconnection = async (dbConfig: IDBConnection,
    storePassword?: boolean, clearPassword?: boolean): Promise<void> => {

    const ctx = await driver.findElement(By.css(".connectionBrowser"));
    await ctx.findElement(By.id("-1")).click();
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
    await selectProtocol(dbConfig.protocol);
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
        } catch (e) {
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

    if (dbConfig.dbType) {
        await selectDatabaseType(dbConfig.dbType);
    }

    if (dbConfig.sslMode) {
        await newConDialog.findElement(By.id("page1")).click();
        await newConDialog.findElement(By.id("sslMode")).click();
        const dropDownList = await driver.findElement(By.css(".noArrow.dropdownList"));
        await dropDownList.findElement(By.id(dbConfig.sslMode)).click();
        expect(await newConDialog.findElement(By.css("#sslMode label")).getText())
            .toBe(dbConfig.sslMode);

        const certsPath = process.env.SSLCERTSPATH as string;
        const paths = await newConDialog.findElements(By.css(".tabview.top input.msg"));
        await paths[0].sendKeys(`${certsPath}/ca-cert.pem`);
        await paths[1].sendKeys(`${certsPath}/client-cert.pem`);
        await paths[2].sendKeys(`${certsPath}/client-key.pem`);
    }

    const okBtn = await driver.findElement(By.id("ok"));
    await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
    await okBtn.click();
    expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(0);
};

/**
 * Returns the WebElement that represents the DB Connection, on the DB Connection main page
 * Throws an exception if not found.
 *
 * @param name Connection caption
 * @returns @returns Promise resolving with the DB Connection
 */
export const getDB = async (name: string): Promise<WebElement | undefined> => {
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

/**
 * Verifies if the Connection Overview tab is selected/opened, on the DB Editor
 *
 * @returns Promise resolving to true if it's opened, false otherwise
 */
export const isConnectionOverviewOpened = async (): Promise<boolean> => {
    const connections = await driver.findElement(By.id("connections"));
    const classes = await connections.getAttribute("class");

    return classes.includes("selected");
};

/**
 * Closes the current opened connection tab, or an existing connection tab
 * Throws an exception if the existing connection tab is not found
 *
 * @param name Connection tab name
 * @returns Promise resolving when the connection is closed
 */
export const closeDBconnection = async (name: string): Promise<void> => {
    if (name === "current") {
        const tab = await driver.findElement(By.css(".hasAuxillary.selected"));
        await tab.findElement(By.css("#auxillary > button")).click();
    } else {
        const tabs = await driver.findElements(By.css(".hasAuxillary"));
        for (const tab of tabs) {
            const text = await tab.findElement(By.css("label")).getAttribute("innerHTML");
            if (text.trim() === name) {
                await tab.findElement(By.css("#auxillary > button")).click();

                return;
            }
        }
        throw new Error(`Could not find connection tab with name '${name}'`);
    }
};

/**
 * Returns the toolbar button on the DB Editor.
 * Throws an exception if the button is not found.
 *
 * @param button Toolbar button tooltip
 * @returns Promise resolving with the Toolbar button
 */
export const getToolbarButton = async (button: string): Promise<WebElement | undefined> => {
    const buttons = await driver.findElements(By.css("#contentHost button"));
    for (const btn of buttons) {
        if ((await btn.getAttribute("data-tooltip")) === button) {
            return btn;
        }
    }

    throw new Error(`Could not find button '${button}'`);
};

/**
 * Returns the result status of a query or instruction on the DB Editor
 *
 * @param isSelect if the expected result is from a select statement
 * @returns Promise resolving with the Result status. Ex. OK, 1 record returned
 */
export const getResultStatus = async (isSelect?: boolean): Promise<string> => {
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

/**
 * Returns the current selected connection tab, on the DB Editor
 *
 * @returns Promise resolving with the Connection tab name
 */
export const getSelectedConnectionTab = async (): Promise<WebElement> => {
    const tab = await driver.findElement(By.css(".selected.hasAuxillary"));

    return tab.findElement(By.css(".label"));
};

/**
 * Returns the selected Setting (Theme Settings, Code Editor, etc), on the Settings page.
 * Throws an exception if the setting is not found
 *
 * @param title name of the Setting
 * @returns Promise resolving with the setting area
 */
const getSettingArea = async (title: string): Promise<WebElement> => {
    const settings = await driver.findElement(By.id("settingsHost"));
    const settingsTreeRows = await settings.findElements(
        By.css(".settingsTreeCell label"),
    );

    for (const setting of settingsTreeRows) {
        if ((await setting.getText()) === title) {
            return setting;
        }
    }
    throw new Error(`Could not find the setting '${title}'`);
};

/**
 * Sets the start language on the Settings page
 * Throws an exception if the setting is not found
 *
 * @param section DB Editor or Shell
 * @param value Language
 * @returns Promise resolving when the language is set
 */
export const setStartLanguage = async (section: string, value: string): Promise<void> => {
    await driver.findElement(By.id("settings")).click();
    await (await getSettingArea(section))!.click();
    if (section === "DB Editor") {
        await driver.findElement(By.id("dbEditor.startLanguage")).click();
    } else {
        await driver.findElement(By.id("shellSession.startLanguage")).click();
    }

    await driver.wait(until.elementLocated(By.css(".dropdownList")));
    await driver.findElement(By.id(value)).click();
};

/**
 * Opens a new Shell session, from the Shell Sessions page
 * Throws an exception if the session was not opened
 *
 * @param id Id of the session. If this parameter is set, the function will open.
 * the session with the provided id
 * @returns Promise resolving when session is opened
 */
export const openShellSession = async (id?: number): Promise<void> => {
    if (id) {
        const buttons = await driver.findElements(By.css("#tilesHost button"));
        for (const button of buttons) {
            if ( (await button.getAttribute("id")) === String(id) ) {
                await button.click();
                break;
            }
        }
    } else {
        await driver.findElement(By.id("-1")).click();
    }

    await driver.wait(
        until.elementLocated(By.id("shellEditorHost")),
        15000,
        "Session was not opened",
    );
};

/**
 * Returns the result of a shell session query or instruction
 *
 * @returns Promise resolving whith the result
 *
 */
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

/**
 * Returns the result language of a shell session query or instruction. Ex. json
 *
 * @returns Promise resolving with the result language
 */
export const shellGetLangResult = async (): Promise<string> => {
    await driver.wait(until.elementLocated(By.css(".zoneHost")), 2000);
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const zoneHost = zoneHosts[zoneHosts.length - 1];

    const dataLang = await (await zoneHost.findElement(By.css("label"))).getAttribute("data-lang");

    return dataLang;
};

/**
 * Press the combination keys to execute a statement on the DB Editor or Shell session (CTRL+ENTER)
 *
 * @returns Promise resolving when the key combination is pressed
 */
export const pressEnter = async (): Promise<void> => {
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

/**
 * Returns the prompt text within a line, on the DB Editor
 *
 * @param prompt last (last line), last-1 (line before the last line), last-2 (line before the 2 last lines)
 * @returns Promise resolving with the text on the selected line
 */
export const getPromptTextLine = async (prompt: string): Promise<String> => {
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

/**
 * Writes an SQL query on the DB Editor
 *
 * @param sql sql query
 * @param dealWithBox True if the sql query should produce the context suggestion box.
 * It will press Enter key to make it disappear.
 * @returns Promise resolving when the sql query is written
 */
export const writeSQL = async (sql: string, dealWithBox?: boolean): Promise<void> => {
    const textArea = await driver.findElement(By.css("textarea"));
    await textArea.sendKeys(sql);
    if (dealWithBox) {
        try {
            await driver.wait(until.elementLocated(By.css("div.contents")), 500, "none");
        } catch (e) {
            return;
        }
        await textArea.sendKeys(Key.ENTER);
    }
};

/**
 * Writes an SQL query and executes it
 *
 * @param textArea text area to send the query
 * @param cmd command to execute
 * @returns Promise resolving when the command is executed
 */
export const enterCmd = async (textArea: WebElement, cmd: string): Promise<void> => {
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

    await pressEnter();

    if (cmd !== "\\q" && cmd !== "\\d") {
        await driver.wait(async () => {
            const blocks = await driver.findElements(By.css(".zoneHost"));

            return blocks.length > prevBlocks.length;
        }, 10000, "Command '" + cmd + "' did not triggered a new results block");
    }
};

/**
 * Returns the total number of rows affected, after executing a query on a Shell session
 *
 * @returns Promise resolving with the the total number of rows
 */
export const shellGetTotalRows = async (): Promise<string> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const zoneHost = zoneHosts[zoneHosts.length - 1];

    return zoneHost
        .findElement(By.css(".resultStatus label.msg.label"))
        .getText();
};

/**
 * Returns the session with the provided session number, from the Shell Sessions main page
 *
 * @param sessionNbr the session number
 * @returns Promise resolving with the session button
 */
export const shellGetSession = async (sessionNbr: string): Promise<WebElement | undefined> => {
    const buttons = await driver.findElements(By.css("#tilesHost button"));
    for (const button of buttons) {
        if ((await button.getAttribute("id")) === sessionNbr) {
            return button;
        }
    }

    return undefined;
};

/**
 * Returns the shell session tab
 *
 * @param sessionNbr the session number
 * @returns Promise resolving with the the Session tab
 */
const shellGetTab = async (sessionNbr: string): Promise<WebElement> => {
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

/**
 * Closes a shell session
 *
 * @param sessionNbr the session number
 * @returns Promise resolving when the session is closed
 */
export const closeSession = async (sessionNbr: string): Promise<void> => {
    const tab = await shellGetTab(sessionNbr);
    await tab.findElement(By.css(".closeButton")).click();
};

/**
 * Returns the Shell tech/language after switching to javascript/python/mysql
 *
 * @returns Promise resolving with the the session shell language
 */
export const shellGetTech = async (): Promise<string> => {
    const editorsPrompt = await driver.findElements(By.css(".editorPromptFirst"));
    const lastEditorClasses = await editorsPrompt[editorsPrompt.length - 1].getAttribute("class");

    return lastEditorClasses.split(" ")[2];
};

/**
 * Returns the current profile
 *
 * @returns Promise resolving with the the profile
 */
export const getCurrentProfile = async (): Promise<string | undefined> => {
    const btns = await driver.findElements(By.css(".leftItems button"));
    for (const button of btns) {
        if ((await button.getAttribute("title")) === "Change profile") {
            return button.getText();
        }
    }
};

/**
 * Opens the profile menu
 *
 * @returns Promise resolving with the the menu
 */
export const openProfileMenu = async (): Promise<WebElement | undefined> => {
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

/**
 * Returns the profile within the profiles menu
 *
 * @param profile profile name
 * @returns Promise resolving with the the menu
 */
export const getProfile = async (profile: string): Promise<WebElement | undefined> => {
    await openProfileMenu();
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

/**
 * Adds a profile
 *
 * @param profile profile name
 * @param profile2copy profile to copy from
 * @returns Promise resolving when the script is added
 */
export const addProfile = async (
    profile: string, profile2copy: string | undefined): Promise<void> => {
    await openProfileMenu();
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

/**
 * Mark the profiles to remove from the Delete Profile dialog
 *
 * @param profs profiles to mark to remove
 * @returns Promise resolving when the profiles are marked
 */
export const setProfilesToRemove = async (profs: string[]): Promise<void> => {
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

/**
 * Enables/Disables the Find in Selection button, on the Find and Replace box
 *
 * @param el find widget
 * @param flag true to enable, false otherwise
 * @returns Promise resolving when the find is made
 */
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

/**
 * Closes the finder on DB Editor
 *
 * @param el element to close
 * @returns Promise resolving with the finder is closed
 */
export const closeFinder = async (el: WebElement): Promise<void> => {
    const actions = await el.findElements(By.css(".find-actions div"));
    for (const action of actions) {
        if ((await action.getAttribute("title")).indexOf("Close") !== -1) {
            await action.click();
        }
    }
};

/**
 * Expands the finder to show the Replace text box
 *
 * @param el the finder
 * @param flag true to open, false otherwise
 * @returns Promise resolving when the action is made
 */
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

/**
 * Returns a button on the finder box dialog
 *
 * @param el the finder
 * @param button button name
 * @returns Promise resolving with the button
 */
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

/**
 * Returns an object/item within the schema section on the DB Editor
 *
 * @param objType Schema/Tables/Views/Routines/Events/Triggers/Foreign Keys/Indexes
 * @param objName Name of the object
 * @returns Promise resolving with the object
 */
export const getSchemaObject = async (
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

/**
 * Toggles (expand or collapse) a schema object/item on the DB Editor
 *
 * @param objType Schema/Tables/Views/Routines/Events/Triggers/Foreign Keys/Indexes
 * @param objName Name of the object
 * @returns Promise resolving with the object
 */
export const toggleSchemaObject = async (objType: string, objName: string): Promise<void> => {
    const obj = await getSchemaObject(objType, objName);
    const toggle = await obj!.findElement(By.css(".treeToggle"));
    await driver.executeScript("arguments[0].click()", toggle);
    await driver.sleep(1000);
};

/**
 * Adds a script on the DB Editor
 *
 * @param scriptType JS/TS/SQL
 * @returns Promise resolving with the name of the created script
 */
export const addScript = async (scriptType: string): Promise<string> => {
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

    const entries = await context.findElements(By.css(".schemaTreeEntry label"));

    return entries[entries.length-1].getText();
};

/**
 * Checks if a script exists on the DB Editor
 *
 * @param scriptName Script name
 * @param scriptType javascript/typescript/mysql
 * @returns Promise resolving with true if exists, false otherwise
 */
export const existsScript = async (scriptName: string, scriptType: string): Promise<boolean> => {
    const context = await driver.findElement(By.id("scriptSectionHost"));
    const items = await context.findElements(By.css("div.tabulator-row"));
    for (const item of items) {
        const label = await (await item.findElement(By.css(".schemaTreeEntry label"))).getText();
        const src = await (await item.findElement(By.css(".schemaTreeEntry img"))).getAttribute("src");
        if (label === scriptName && src.indexOf(scriptType) !== -1) {
            return true;
        }
    }

    return false;
};

/**
 * Returns the open editor
 *
 * @param editor Editor name
 * @returns Promise resolving with the Editor
 */
export const getOpenEditor = async (editor: string): Promise<WebElement | undefined> => {
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

/**
 * Selects an editor from the drop down list on the DB Editor
 *
 * @param editorName Editor name
 * @param editorType javascript/typescript/mysql
 * @returns Promise resolving when the select is made
 */
export const selectCurrentEditor = async (editorName: string, editorType: string): Promise<void> => {
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

/**
 * Returns the result tab or a multi-query result, on the DB Editor
 *
 * @param tabName Tab name
 * @returns Promise resolving with the tab
 */
export const getResultTab = async (tabName: string): Promise<WebElement | undefined> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const tabs = await zoneHosts[zoneHosts.length-1].findElements(By.css(".resultHost .tabArea div"));

    for (const tab of tabs) {
        if (await tab.getAttribute("id") !== "selectorItemstepDown" &&
            await tab.getAttribute("id") !== "selectorItemstepUp") {
            const label = await tab.findElement(By.css("label"));
            if ((await label.getAttribute("innerHTML")).indexOf(tabName) !== -1) {
                return tab;
            }
        }
    }
};

/**
 * Returns the result column name of a sql query, on the DB Editor
 *
 * @param columnName Column name
 * @param retry Number of retries to get the column (default = 2)
 * @returns A promise resolving with the column
 */
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
        const resultSet = await resultHosts[resultHosts.length-1].findElement(
            By.css(".tabulator-headers"),
        );

        const resultHeaderRows = await resultSet.findElements(
            By.css(".tabulator-col-title"),
        );

        for (const row of resultHeaderRows) {
            if ((await row.getText()) === columnName) {
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

/**
 * Returns the graph resulting from a typescript script, on the DB Editor
 *
 * @returns A promise resolving with the graph
 */
export const getGraphHost = async (): Promise<WebElement> => {
    const resultHosts = await driver.findElements(By.css(".zoneHost"));
    const lastResult = resultHosts[resultHosts.length-1];

    return driver.wait(async () => {
        return lastResult.findElement(By.css(".graphHost"));
    }, 10000, "Pie Chart was not displayed");
};

/**
 * Returns the output of switching language on the DB Editor
 *
 * @param penultimate get the penultimate result
 * @returns A promise resolving with the output
 */
export const getOutput = async (penultimate?: boolean): Promise<string> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    let context;
    if (penultimate) {
        context = zoneHosts[zoneHosts.length-2];
    } else {
        context = zoneHosts[zoneHosts.length-1];
    }

    let items = await context.findElements(By.css("label"));
    const otherItems = await context.findElements(By.css(".textHost span"));
    let text;

    if (items.length > 0) {
        text = await items[0].getText();
    } else if (otherItems.length > 0) {
        text = await otherItems[otherItems.length-1].getText();
    } else {
        items = await context.findElements(By.css(".info"));
        text = await items[0].getText();
    }

    return text;
};

/**
 * Returns the current language of the prompt on the DB Editor
 *
 * @returns A promise resolving with the language
 */
const getEditorLanguage = async (): Promise<string> => {
    const editors = await driver.findElements(By.css(".editorPromptFirst"));
    const editorClasses = (await editors[editors.length - 1].getAttribute("class")).split(" ");

    return editorClasses[2].replace("my", "");
};

/**
 * Sets the language on the DB Editor
 *
 * @param language sql/js/ts
 * @returns A promise resolving when the language is set
 */
export const setEditorLanguage = async (language: string): Promise<void> => {
    const curLang = await getEditorLanguage();
    if (curLang !== language) {
        const contentHost = await driver.findElement(By.id("contentHost"));
        const textArea = await contentHost.findElement(By.css("textarea"));
        await enterCmd(textArea, "\\" + language.replace("my", ""));
        const results = await driver.findElements(By.css(".message.info"));
        switch (language) {
            case "sql":
                expect(await results[results.length-1].getText()).toBe("Switched to MySQL mode");
                break;
            case "js":
                expect(await results[results.length-1].getText()).toBe("Switched to JavaScript mode");
                break;
            case "ts":
                expect(await results[results.length-1].getText()).toBe("Switched to TypeScript mode");
                break;
            default:
                break;
        }
    }
};

/**
 * Toggles a Theme Editor UI Colors menu
 *
 * @param menu Menu name
 * @param action open/close
 * @param scroll True to scroll down (menu is invisible)
 * @returns A promise resolving when the toggel is made
 */
export const toggleUiColorsMenu = async (menu: string,
    action: string, scroll?: boolean): Promise<void> => {
    const isTabOpened = async (tab: WebElement) => {
        return (await tab.getAttribute("class")).includes("expanded");
    };

    const themeTabView = await driver.findElement(By.id("themeTabview"));

    if (scroll) {
        await driver.executeScript("arguments[0].scrollBy(0,500)",
            await driver.findElement(By.css("#themeTabview .tabulator-tableholder")));
    }

    await driver.wait(async () => {
        const els = await themeTabView.findElements(By.css(".tabulator-tableholder .tabulator-selectable"));

        try {
            await els[0].findElement(By.css("label")).getText();

            return true;
        } catch (e) {
            return false;
        }
    }, 5000, "Elements are stale");

    const toggle = async () => {
        const uiColorsItems = await themeTabView.findElements(By.css(".tabulator-tableholder .tabulator-selectable"));
        for (let i = 0; i <= uiColorsItems.length - 1; i++) {
            if (await uiColorsItems[i].findElement(By.css("label")).getText() === menu) { //base colors
                await driver.executeScript("arguments[0].scrollIntoView(true)",
                    await uiColorsItems[i].findElement(By.css("label")));
                if (action === "open") {
                    if (!(await isTabOpened(uiColorsItems[i]))) {
                        await driver.wait(async () => {
                            await uiColorsItems[i].findElement(By.css(".treeToggle")).click();

                            return isTabOpened(uiColorsItems[i]);
                        }, 3000, `${menu} did not open`);
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

    try {
        await toggle();
    } catch (e) {
        if (e instanceof Error) {
            if (e.message.indexOf("StaleElementReferenceError") === -1) {
                await toggle();
            } else {
                throw e;
            }
        }
    }
};

/**
 * Checks if the UI Colors menu is expanded, on the Theme Editor
 *
 * @param menuName Menu name
 * @param scroll True to scroll down (menu is invisible)
 * @returns A promise resolving to true if it's expanded, false otherwise. Undefined if the menu is not found
 */
export const isUiColorsMenuExpanded = async(
    menuName: string, scroll?: boolean): Promise<boolean | undefined> => {
    const isTabOpened = async (tab: WebElement) => {
        return (await tab.getAttribute("class")).includes("expanded");
    };

    const check = async () => {
        const themeTabView = await driver.findElement(By.id("themeTabview"));
        const scrollBar = await driver.findElement(By.css("#themeTabview .tabulator-tableholder"));
        if (scroll) {
            await driver.executeScript("arguments[0].scrollBy(0,500)", scrollBar);
        }
        const uiColorsItems = await themeTabView.findElements(By.css(".tabulator-tableholder .tabulator-selectable"));
        for (let i = 0; i <= uiColorsItems.length - 1; i++) {
            if (await uiColorsItems[i].findElement(By.css("label")).getText() === menuName) { //base colors
                await driver.executeScript("arguments[0].scrollIntoView(true)",
                    await uiColorsItems[i].findElement(By.css("label")));

                return isTabOpened(uiColorsItems[i]);
            }
        }
        const scrollPosition: number = await driver.executeScript("return arguments[0].scrollTop", scrollBar);
        if (scrollPosition === 0) {
            return false;
        } else {
            throw new Error(`Could not find the menu with name ${menuName}`);
        }
    };

    try {
        const result = await check();

        return result;
    } catch (e) {
        if (e instanceof Error) {
            if (e.message.indexOf("StaleElementReferenceError") === -1) {
                const result = await check();

                return result;
            } else {
                throw e;
            }
        }
    }
};

/**
 * Sets the color (using the color pad) of a menu item, on the Theme Editor
 *
 * @param sectionColors Menu item name
 * @param optionId the html id of the option color
 * @param detail the field on the color pad
 * @param value the value to set
 * @param scroll True to scroll down (menu is invisible)
 * @returns A promise resolving when the set is made
 */
export const setThemeEditorColors = async (sectionColors: string, optionId: string,
    detail: string, value: string, scroll?: boolean): Promise<void> => {

    await toggleUiColorsMenu(sectionColors, "open", scroll);

    const openColorPad = async () => {
        await driver.wait(async () => {
            await driver.findElement(By.id(optionId)).click();

            return (await driver.findElements(By.css(".colorPopup"))).length > 0;
        }, 3000, "Color Pallete was not opened");
    };

    try {
        await openColorPad();
    } catch (e) {
        await toggleUiColorsMenu(sectionColors, "open", scroll);
        await openColorPad();
    }

    const colorPopup = await driver.findElement(By.css(".colorPopup"));
    await colorPopup.findElement(By.id(detail)).clear();
    await colorPopup.findElement(By.id(detail)).sendKeys(value);
    await colorPopup.findElement(By.id(detail)).sendKeys(Key.ESCAPE);

    await driver.wait(async () => {
        return !(await isUiColorsMenuExpanded(sectionColors, scroll));
    }, 7000, `${sectionColors} menu is not collapsed`);
};

/**
 * Returns the css computed style of an element
 *
 * @param element The Element
 * @param style The style
 * @returns A promise resolving with the element style
 */
export const getElementStyle = async (element: WebElement, style: string): Promise<string> => {
    return driver.executeScript("return window.getComputedStyle(arguments[0])." + style, element);
};

/**
 * Converts and RGB code to hex
 *
 * @param r value
 * @param g value
 * @param b value
 * @returns A promise resolving with the hex value
 */
export const rgbToHex = (r: string, g: string, b: string): string => {

    const componentToHex = (c: number) => {
        const hex = c.toString(16);

        return hex.length === 1 ? "0" + hex : hex;
    };

    const result = "#" + componentToHex(parseInt(r, 10)) +
        componentToHex(parseInt(g, 10)) + componentToHex(parseInt(b, 10));

    return result.toUpperCase();
};

/**
 * Sets the DB Editor password for a connection, on the Password dialog
 *
 * @param dbConfig connection object
 * @returns A promise resolving when the password is set
 */
export const setDBEditorPassword = async (dbConfig: IDBConnection): Promise<void> => {
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

    expect(await title.getText()).toBe("Open MySQL Connection");

    await dialog[0].findElement(By.css("input")).sendKeys(String(dbConfig.password));
    await dialog[0].findElement(By.id("ok")).click();
};

/**
 * Sets the DB Editor confirm dialog value, for a password storage
 *
 * @param dbConfig connection object
 * @param value yes/no/never
 * @returns A promise resolving when the set is made
 */
export const setConfirmDialog = async (dbConfig: IDBConnection, value: string): Promise<void> => {
    const confirmDialog = await driver.wait(until.elementsLocated(By.css(".confirmDialog")),
        500, "No confirm dialog was found");

    expect(await confirmDialog[0].findElement(By.css(".title label")).getText()).toBe("Confirm");

    expect(await confirmDialog[0].findElement(By.id("dialogMessage")).getText())
        .toContain(
            `Save password for '${String(dbConfig.username)}@${String(dbConfig.hostname)}:${String(dbConfig.port)}'?`);

    const noBtn = await confirmDialog[0].findElement(By.id("refuse"));
    const yesBtn = await confirmDialog[0].findElement(By.id("accept"));
    const neverBtn = await confirmDialog[0].findElement(By.id("alternative"));

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

/**
 * Clicks on the DB Editor Context menu
 *
 * @param itemName Contex menu item name
 * @returns A promise resolving when the click is made
 */
export const clickDBEditorContextItem = async (itemName: string): Promise<void> => {
    const lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));
    const el = lines[lines.length - 1];
    await driver
        .actions()
        .contextClick(el)
        .perform();

    const shadowRootHost = await driver.wait(until.elementLocated(By.css(".shadow-root-host")),
        2000, "Context menu was not displayed");

    const shadowRoot: WebElement = await driver.executeScript("return arguments[0].shadowRoot", shadowRootHost);

    const menuItems = await shadowRoot.findElements(By.css("a.action-menu-item"));

    for (const menuItem of menuItems) {
        const item = await menuItem.findElement(By.css("span.action-label"));
        const text = await item.getText();
        if (text === itemName) {
            await menuItem.click();

            return;
        }
    }
    throw new Error(`Could not find item '${itemName}'`);
};

/**
 * Clicks an item on the Settings page main items section
 *
 * @param settingId Setting name
 * @returns A promise resolving when the click is made
 */
const clickSettingArea = async (settingId: string): Promise<void> => {
    if (settingId.indexOf("settings") !== -1) {
        await (await getSettingArea("Settings"))!.click();
    } else if (settingId.indexOf("theming.") !== -1) {
        await (await getSettingArea("Theme Settings"))!.click();
    } else if (settingId.indexOf("editor.") !== -1) {
        await (await getSettingArea("Code Editor"))!.click();
    } else if (settingId.indexOf("dbEditor.") !== -1) {
        await (await getSettingArea("DB Editor"))!.click();
    } else if (settingId.indexOf("sql") !== -1) {
        await (await getSettingArea("SQL Execution"))!.click();
    } else if (settingId.indexOf("session") !== -1) {
        await (await getSettingArea("Shell Session"))!.click();
    } else {
        throw new Error("unknown settingId: " + settingId);
    }
};

/**
 * Inserts texts on an input box or other element, on a safer way (avoiding Stale Elements)
 *
 * @param inputId html input id
 * @param type input/selectList/checkbox
 * @param value text to set
 * @returns A promise resolving with the set is made
 */
const setInputValue = async (inputId: string,
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

/**
 * Sets a setting on the Settings page
 *
 * @param settingId html id
 * @param type input/selectList/checkbox
 * @param value text to set
 * @returns A promise resolving with the set is made
 */
export const setSetting = async (settingId: string, type: string, value: string): Promise<void> => {
    const settingsValueList = driver.findElement(By.id("settingsValueList"));
    await clickSettingArea(settingId);
    const el = settingsValueList.findElement(By.id(settingId));
    await driver.executeScript("arguments[0].scrollIntoView(true)", el);
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    const classes = (await el.getAttribute("class")).split(" ");
    switch (type) {
        case "input":
            await driver.executeScript("arguments[0].click()", el);
            if ((await el.getTagName()) === "input") {
                await el.clear();
                await setInputValue(settingId, undefined, value);
            } else {
                await el.findElement(By.css(type)).clear();
                await setInputValue(settingId, type, value);
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

/**
 * Returns the value of a setting on the Settings page
 *
 * @param settingId html id
 * @param type input/selectList/checkbox
 * @returns A promise resolving with the value of the setting
 */
export const getSettingValue = async (settingId: string, type: string): Promise<string> => {
    const settingsValueList = driver.findElement(By.id("settingsValueList"));
    await clickSettingArea(settingId);
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

/**
 * Checks if the Db Type drop down list is stale, on the Connections dialog
 * Because of the tests speed, sometimes we need to reload the dialog
 *
 * @returns A promise resolving when the init is made
 */
export const initConDialog = async (): Promise<void> => {
    await driver
        .findElement(By.css(".connectionBrowser"))
        .findElement(By.id("-1"))
        .click();

    const dialog = driver.findElement(By.css(".valueEditDialog"));
    await dialog.findElement(By.id("cancel")).click();
    await driver.wait(until.stalenessOf(dialog), 2000, "Connection dialog is still displayed");
    await driver.findElement(By.id("gui.shell")).click();
    await driver.findElement(By.id("gui.sqleditor")).click();
};

/**
 * Expand or Collapses a menu on the DB Editor
 *
 * @param menu menu name (open editors/schemas/admin/scripts)
 * @param expand True to expand, false to collapse
 * @param retries number of retries to try to expand or collapse
 * @returns A promise resolving when the expand or collapse is made
 */
export const expandCollapseDBEditorMenus = async (menu: string, expand: boolean,
    retries: number): Promise<void> => {
    if (retries === 3) {
        throw new Error(`Max retries reached on expanding collapse '${menu}'`);
    }
    try {
        let elToClick;
        let elToVerify;

        switch (menu) {
            case "open editors":
                elToClick = await driver.findElement(
                    By.id("editorSectionHost")).findElement(By.css("div.container.section label"));
                elToVerify = await driver.findElement(By.css("#editorSectionHost .accordionItem"));
                break;
            case "schemas":
                elToClick = await driver.findElement(
                    By.id("schemaSectionHost")).findElement(By.css("div.container.section label"));
                elToVerify = await driver.findElement(
                    By.id("schemaSectionHost")).findElement(By.css(".tabulator-table"));

                break;
            case "admin":
                elToClick = await driver.findElement(
                    By.id("adminSectionHost")).findElement(By.css("div.container.section label"));
                elToVerify = await driver.findElement(
                    By.id("adminSectionHost")).findElement(By.css(".accordionItem"));
                break;
            case "scripts":
                elToClick = await driver.findElement(
                    By.id("scriptSectionHost")).findElement(By.css("div.container.section label"));

                elToVerify = await driver.findElement(
                    By.id("scriptSectionHost")).findElements(By.css(".tabulator-table"));
                if (elToVerify.length === 0) {
                    elToVerify = await driver.findElement(
                        By.id("scriptSectionHost")).findElement(By.css(".accordionItem"));
                } else {
                    elToVerify = elToVerify[0];
                }
                break;
            default:
                break;
        }

        if (!expand) {
            if (await elToVerify?.isDisplayed()) {
                await elToClick?.click();
                await driver.wait(
                    until.elementIsNotVisible(elToVerify as WebElement),
                    3000,
                    "Element is still visible",
                );
            }
        } else {
            if (!await elToVerify?.isDisplayed()) {
                await elToClick?.click();
                await driver.wait(
                    until.elementIsNotVisible(elToVerify as WebElement),
                    3000,
                    "Element is still visible",
                );
            }
        }
    } catch (e) {
        await driver.sleep(1000);
        console.log(e);
        await expandCollapseDBEditorMenus(menu, expand, retries + 1);
    }
};

/**
 * Returns the CSS value of a color pad
 *
 * @param position position of the color pad (1 for first, 2 for second...)
 * @returns A promise resolving with the css value
 */
export const getColorPadCss = async (position: number): Promise<string> => {
    const colors = await driver.findElements(By.css("#colorPadCell > div"));
    await colors[position].click();
    const colorPopup = await driver.findElement(By.css(".colorPopup"));
    const value = await colorPopup.findElement(By.id("hexValueInput")).getAttribute("value");
    await colorPopup.findElement(By.id("hexValueInput")).sendKeys(Key.ESCAPE);

    return value;
};

/**
 * Scrolls down on the DB Editor
 *
 * @returns A promise resolving when the scroll is made
 */
const scrollDBEditorDown = async (): Promise<void> => {
    const el = await driver.findElement(By.css(".codeEditor .monaco-scrollable-element"));
    await driver.executeScript("arguments[0].scrollBy(0, 5000)", el);
};

/**
 * Verifies if a new prompt exists on the DB Editor
 *
 * @returns A promise resolving with true if exists, false otherwise
 */
export const hasNewPrompt = async (): Promise<boolean> => {
    let text: String;
    try {
        await scrollDBEditorDown();
        const context = await driver.findElement(By.css(".monaco-editor-background"));
        const prompts = await context.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
        const lastPrompt = await prompts[prompts.length-1].findElement(By.css("span > span"));
        text = await lastPrompt.getText();
    } catch(e) {
        if (e instanceof Error) {
            if (String(e).indexOf("StaleElementReferenceError") === -1) {
                throw new Error(String(e.stack));
            } else {
                await driver.sleep(500);
                const context = await driver.findElement(By.css(".monaco-editor-background"));
                const prompts = await context.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
                const lastPrompt = await prompts[prompts.length-1].findElement(By.css("span > span"));
                text = await lastPrompt.getText();
            }
        }
    }

    return String(text!).length === 0;
};

/**
 * Removes all the existing text on the DB Editor textarea
 *
 * @returns A promise resolving when the clean is made
 */
export const cleanEditor = async (): Promise<void> => {
    const textArea = await driver.findElement(By.css("textarea"));
    if (platform() === "win32") {
        await textArea
            .sendKeys(Key.chord(Key.CONTROL, "a", "a"));
    } else if (platform() === "darwin") {
        await textArea
            .sendKeys(Key.chord(Key.COMMAND, "a", "a"));
    }
    await textArea.sendKeys(Key.BACK_SPACE);
    await driver.wait(async () => {
        return await getPromptTextLine("last") === "";
    }, 3000, "Prompt was not cleaned");
};

/**
 * Returns the latest html query result id
 * This function is useful to verify later if a new result id is displayed, after a query
 *
 * @returns A promise resolving with the Id
 */
export const getLastQueryResultId = async (): Promise<number> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    if (zoneHosts.length > 0) {
        const zones = await driver.findElements(By.css(".zoneHost"));

        return parseInt((await zones[zones.length-1].getAttribute("monaco-view-zone")).match(/\d+/)![0], 10);
    } else {
        return 0;
    }
};

/**
 * Verifies if a value is present on a query result data set
 *
 * @param value value to search for
 * @returns A promise resolving with true if exists, false otherwise
 */
export const isValueOnDataSet = async (value: string): Promise<boolean> => {
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

/**
 * Returns the text within the server tab on a shell session
 *
 * @returns A promise resolving with the text on the tab
 */
export const getShellServerTabStatus = async (): Promise<string> => {
    const server = await driver.findElement(By.id("server"));

    return server.getAttribute("data-tooltip");
};

/**
 * Returns the text within the schema tab on a shell session
 *
 * @returns A promise resolving with the text on the tab
 */
export const getShellSchemaTabStatus = async (): Promise<string> => {
    const schema = await driver.findElement(By.id("schema"));

    return schema.getAttribute("innerHTML");
};

/**
 * Verifies if a text is present on a json result, returned by a query
 *
 * @param value value to search for
 * @returns A promise resolving with true if exists, false otherwise
 */
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

/**
 * Returns the result after executing a script, on the DB Editor
 *
 * @returns A promise resolving with the result
 */
export const getScriptResult = async (): Promise<string> => {
    const host = await driver.findElement(By.id("resultPaneHost"));
    const result = await host.findElement(By.css(".label"));

    return result.getText();
};

/**
 * Clicks on an item under the MySQL Administration section, on the DB Editor
 *
 * @param item Item name
 * @returns A promise resolving when the click is made
 */
export const clickAdminItem = async (item: string): Promise<void> => {
    const els = await driver.findElements(By.css("#adminSectionHost .accordionItem .label"));
    for (const el of els) {
        const label = await el.getText();
        if (label === item) {
            await el.click();

            return;
        }
    }
    throw new Error(`Could not find the item '${item}'`);
};

/**
 * Returns the current selected Editor, on the select list, on the DB Editor
 *
 * @returns A promise resolving whith the editor
 */
export const getCurrentEditor = async (): Promise<string> => {
    const selector = await driver.findElement(By.id("documentSelector"));
    const label = await selector.findElement(By.css("label"));

    return label.getText();
};

/**
 * Selects an Editor from the drop down list, on the DB Editor
 *
 * @param editor The editor
 * @returns A promise resolving when the select is made
 */
export const selectEditor = async (editor: string): Promise<void> => {
    const selector = await driver.findElement(By.id("documentSelector"));
    await selector.click();
    const list = await driver.findElement(By.css(".dropdownList"));
    const items = await list.findElements(By.css(".dropdownItem"));

    for (const item of items) {
        const label = await item.findElement(By.css("label"));
        const text = await label.getAttribute("innerHTML");
        if (text === editor) {
            await item.click();

            return;
        }
    }
    throw new Error(`Could not find ${editor}`);
};
