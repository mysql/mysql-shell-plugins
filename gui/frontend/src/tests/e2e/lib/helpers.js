/*
 * Copyright (c) 2021, Oracle and/or its affiliates.
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

import { By, until, Key } from "selenium-webdriver";

export async function waitForHomePage(driver) {
    await driver.findElement(By.id("sessions"));
}

export async function getPaddingTop(driver, element) {
    const script = "return window.getComputedStyle(arguments[0]).paddingTop";
    const padding = await driver.executeScript(script, element);

    return parseInt(padding.replace("px", ""));
}

export async function getBackgroundColor(driver) {
    const script =
        "return window.getComputedStyle(document.documentElement).getPropertyValue('--background'); ";

    return await driver.executeScript(script);
}

export async function selectAppColorTheme(driver, theme) {
    await driver.findElement(By.id("theming.currentTheme")).click();
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    await dropDownList.findElement(By.id(theme)).click();
}

export async function selectDatabaseType(driver, value) {
    await driver.findElement(By.id("databaseType")).click();
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    const els = await dropDownList.findElements(By.css("div"));
    if (els.length > 0) {
        await dropDownList.findElement(By.id(value)).click();
    }
}

export async function selectProtocol(driver, value) {
    await driver.findElement(By.id("scheme")).click();
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    await dropDownList.findElement(By.id(value)).click();
}

export async function selectSSLMode(driver, value) {
    await driver.findElement(By.id("sslMode")).click();
    const dropDownList = await driver.findElement(By.css(".dropdownList"));
    await dropDownList.findElement(By.id(value)).click();
}

export async function createDBconnection(driver, dbConfig) {
    await driver
        .findElement(By.css(".connectionBrowser"))
        .findElement(By.id("-1"))
        .click();
    const newConDialog = await driver.findElement(By.css(".valueEditDialog"));
    await newConDialog.findElement(By.id("caption")).clear();
    await newConDialog.findElement(By.id("caption")).clear();
    await newConDialog.findElement(By.id("caption")).sendKeys(dbConfig.caption);
    await newConDialog.findElement(By.id("description")).clear();
    await newConDialog
        .findElement(By.id("description"))
        .sendKeys(dbConfig.description);
    await newConDialog.findElement(By.id("hostName")).clear();
    await newConDialog.findElement(By.id("hostName")).sendKeys(dbConfig.hostname);
    await selectProtocol(driver, dbConfig.protocol);
    await driver.findElement(By.css("#port input")).clear();
    await driver.findElement(By.css("#port input")).sendKeys(dbConfig.port);
    await newConDialog.findElement(By.id("userName")).sendKeys(dbConfig.username);
    await newConDialog.findElement(By.id("password")).sendKeys(dbConfig.password);
    await newConDialog
        .findElement(By.id("defaultSchema"))
        .sendKeys(dbConfig.schema);
    await selectDatabaseType(driver, dbConfig.dbType);
    if (!dbConfig.showAdvanced) {
        await driver.findElement(By.id("ok")).click();
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
        await driver.findElement(By.id("ok")).click();
        expect((await driver.findElements(By.css(".valueEditDialog"))).length)
            .toBe(0, "[TS:" + Error().lineNumber + "]");
    }
}

export async function getDB(driver, name) {
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
}

export async function closeDBconnection(driver) {
    await driver.executeScript(
        "arguments[0].click();",
        await driver.findElement(By.css("button#connection_5\\.tab1 div")),
    );
}

export async function isDBconnectionOpened(driver) {
    const con = (
        await driver.findElements(By.css(".tabArea #connection_5\\.tab1 label"))
    ).length;

    return con > 0 ? true : false;
}

export async function getToolbarButton(driver, button) {
    const buttons = await driver.findElements(By.css("#contentHost button"));
    for (const button of buttons) {
        if ((await button.getAttribute("data-tooltip")) === button) {
            return button;
        }
    }

    return undefined;
}

export async function getResultStatus(driver, blockNbr) {
    let results;
    await driver.wait(
        async function (driver) {
            results = await driver.findElements(By.css(".resultStatus label"));
            await driver
                .actions()
                .move({
                    x: 21,
                    y: 90,
                    origin: await driver.findElement(
                        By.css("canvas.minimap-decorations-layer"),
                    ),
                })
                .press()
                .perform();

            return blockNbr === "last"
                ? results[results.length - 1] !== undefined
                : results[blockNbr - 1] !== undefined;
        },
        10000,
        "Result Status is undefined",
    );

    return blockNbr === "last"
        ? await results[results.length - 1].getText()
        : await results[blockNbr - 1].getText();
}

export async function getConnectionTab(driver, id) {
    const tabArea = await driver.findElement(By.css(".tabArea"));
    await driver.wait(
        async function () {
            return (
                (
                    await tabArea.findElements(
                        By.xpath("//div[contains(@id, 'tab" + id + "')]"),
                    )
                ).length > 0
            );
        },
        10000,
        "Connection was not opened",
    );

    return await tabArea.findElement(
        By.xpath("//div[contains(@id, 'tab" + id + "')]"),
    );
}

export async function setCodeEditorLanguage(driver, value) {
    await driver.findElement(By.id("settings")).click();
    const settings = await driver.findElement(By.id("settingsHost"));
    const settingsTreeRows = await settings.findElements(
        By.css(".settingsTreeCell label"),
    );
    await settingsTreeRows[3].click();
    await driver.findElement(By.id("dbEditor.startLanguage")).click();
    await driver.wait(until.elementLocated(By.css(".dropdownList")));
    await driver.findElement(By.id(value)).click();
}

export async function openShellSession(driver) {
    await driver.findElement(By.id("-1")).click();
    await driver.wait(
        until.elementLocated(By.id("session_1")),
        3000,
        "Session was not opened",
    );
    expect(
        await driver
            .findElement(By.id("session_1"))
            .findElement(By.css(".label"))
            .getText(),
    ).toBe("Session 1");
}

export async function shellSetText(driver, text) {
    await driver.findElement(".current-line").click();
    const letters = text.split("");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const letter of letters) {
        await driver.sendKeys(Key.ARROW_DOWN);
    }
}

export async function shellGetResult(driver) {
    const zoneHost = await driver.wait(until.elementLocated(By.css(".zoneHost")), 2000);
    const error = await zoneHost[zoneHost.length - 1].findElements(
        By.css(".error"),
    );

    if (error.length > 0) {
        return await error[error.length - 1].getText();
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
}

export async function shellGetJsonResult(driver) {
    let json = "";
    const zoneHosts = await driver.wait(until.elementLocated(By.css(".zoneHost")), 2000);
    const zoneHost = await zoneHosts[zoneHosts.length - 1].findElement(
        By.css("label"),
    );

    if ((await zoneHost.getAttribute("data-lang")) !== "json") {
        throw "Not a json result";
    } else {
        const spans = await zoneHost.findElements(
            By.xpath('//span[contains(@class, "mtk")]'),
        );
        for (const span of spans) {
            json += (span.getAttribute("innerHTML")).replace(/&nbsp;/g, "");
            if ((span.getAttribute("innerHTML")) === "]") {
                break;
            }
        }
    }

    return json;
}

export async function shellEnterCmd(driver, textArea, cmd) {
    await textArea.sendKeys(cmd);
    await driver.actions().keyDown(Key.ENTER).keyUp(Key.ENTER).perform();
    await driver
        .actions()
        .keyDown(Key.COMMAND)
        .keyDown(Key.ENTER)
        .keyUp(Key.COMMAND)
        .keyUp(Key.ENTER)
        .perform();
}

export async function shellGetResultTable(driver) {
    const results = await driver.wait(until.elementLocated(By.css(".zoneHost")), 2000);
    const error = await results[results.length - 1].findElements(
        By.css(".error"),
    );

    if (error.length > 0) {
        return await error[error.length - 1].getText();
    } else {
        return await results[results.length - 1].findElement(By.css(".tabulator"));
    }
}

export async function shellGetTotalRows(driver) {
    const results = await driver.wait(until.elementLocated(By.css(".zoneHost")), 2000);

    return await results[results.length - 1]
        .findElement(By.css(".resultStatus .info"))
        .getText();
}

export async function shellGetSession(driver, sessionNbr) {
    const buttons = await driver.findElements(By.css("#tilesHost button"));
    for (const  button of buttons) {
        if ((await button.getAttribute("id")) === sessionNbr) {
            return buttons[i];
        }
    }

    return undefined;
}

export async function shellGetTab(driver, sessionNbr) {
    const tabArea = await driver.findElement(By.css(".tabArea"));
    await driver.wait(
        async function () {
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

    return await tabArea.findElement(
        By.xpath("//div[contains(@id, 'session_" + sessionNbr + "')]"),
    );
}

export async function closeSession(driver, sessionNbr) {
    const tab = await shellGetTab(driver, sessionNbr);
    await tab.findElement(By.css(".closeButton")).click();
}

export async function shellGetTech(driver) {
    const divs = await driver.findElements(
        By.css(".margin-view-overlays div div"),
    );
    const lastDiv = divs[divs.length - 1];
    const classes = (await lastDiv.getAttribute("class")).split(" ");

    return classes[2];
}

export async function getCurrentProfile(driver) {
    const btns = await driver.findElements(By.css(".leftItems button"));
    for (const button of btns) {
        if ((await button.getAttribute("title")) === "Change profile") {
            return await button.getText();
        }
    }
}

export async function openProfileMenu(driver) {
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

                return await driver.findElement(By.css(".noArrow.menu"));
            }
        }
    }
}

export async function getProfile(driver, profile) {
    await openProfileMenu(driver);
    const menu = await driver.findElement(By.css(".noArrow.menu"));
    const items = await menu.findElements(By.css("div.menuItem"));

    for (const item of items) {
        if (Number.isInteger(parseInt(await item.getAttribute("id")))) {
            if ((await item.findElement(By.css("label")).getText()) === profile) {
                return item;
            }
        }
    }

    return undefined;
}

export async function addProfile(driver, profile, profile2copy) {
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
}

export async function getProfileToDelete(driver, profile) {
    const profiles = await driver.findElements(
        By.id("profileActivateDeactivate"),
    );
    for (const profile of profiles) {
        if ((await profile.getText()) === profile) {
            return profile;
        }
    }
}

export async function setProfilesToRemove(driver, profs) {
    let els;
    let label;
    const profiles = await driver.findElements(
        By.xpath('//div[contains(@id, "profileActivateDeactivate")]'),
    );
    const ids = [];
    for (const profile in profiles) {
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
}

//there are inputs that become stale after inserting 1 element
export async function setInputValue(driver, inputId, type, value) {
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
}

export async function setSetting(driver, settingId, type, value) {
    const settingsValueList = driver.findElement(By.id("settingsValueList"));
    switch (type) {
        case "input":
            const el = await settingsValueList.findElement(By.id(settingId));
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
            await settingsValueList.findElement(By.id(settingId)).click();
            const dropDownList = await driver.findElement(By.css(".dropdownList"));
            try {
                await dropDownList
                    .findElement(By.xpath("//div[contains(@id, '" + value + "')]"))
                    .click();
            } catch (e) {
                await dropDownList.findElement(By.id(value)).click();
            }
            break;
        case "checkbox":
            let check = await settingsValueList
                .findElement(By.id(settingId))
                .getAttribute("class");
            check = check.split(" ");
            if (value === "checked") {
                if (check.includes("unchecked")) {
                    await settingsValueList
                        .findElement(By.id(settingId))
                        .findElement(By.css("span"))
                        .click();
                }
                expect(
                    await (
                        await settingsValueList.findElement(By.id(settingId))
                    ).getAttribute("class"),
                ).toContain("checked");
            } else {
                if (check.includes("checked")) {
                    await settingsValueList
                        .findElement(By.id(settingId))
                        .findElement(By.css("span"))
                        .click();
                }
                expect(
                    await (
                        await settingsValueList.findElement(By.id(settingId))
                    ).getAttribute("class"),
                ).toContain("unchecked");
            }
            break;
        default:
            break;
    }
}

export async function clickSettingArea(driver, settingId) {
    const settings = await driver.findElement(By.id("settingsHost"));
    const settingsTreeRows = await settings.findElements(
        By.css(".settingsTreeCell label"),
    );

    if (settingId.indexOf("settings") !== -1) {
        await settingsTreeRows[0].click();
    } else if (settingId.indexOf("theming") !== -1) {
        await settingsTreeRows[1].click();
    } else if (settingId.indexOf("editor") !== -1) {
        await settingsTreeRows[2].click();
    } else if (settingId.indexOf("connectionBrowser") !== -1) {
        await settingsTreeRows[3].click();
    } else if (settingId.indexOf("sql") !== -1) {
        await settingsTreeRows[4].click();
    } else if (settingId.indexOf("session") !== -1) {
        await settingsTreeRows[5].click();
    } else {
        throw "unknown settingId";
    }
}

export async function getSettingValue(driver, settingId, type) {
    const settingsValueList = driver.findElement(By.id("settingsValueList"));
    await clickSettingArea(driver, settingId);
    switch (type) {
        case "input":
            if (
                (await (
                    await settingsValueList.findElement(By.id(settingId))
                ).getTagName()) === "input"
            ) {
                return await settingsValueList
                    .findElement(By.id(settingId))
                    .getAttribute("value");
            } else {
                return await settingsValueList
                    .findElement(By.id(settingId))
                    .findElement(By.css(type))
                    .getAttribute("value");
            }
        case "selectList":
            return (
                await settingsValueList
                    .findElement(By.id(settingId))
                    .findElement(By.css("label"))
            ).getText();
        case "checkbox":
            let check = await settingsValueList
                .findElement(By.id(settingId))
                .getAttribute("class");
            check = check.split(" ");
            if (check.includes("unchecked")) {
                return "unchecked";
            }
            if (check.includes("checked")) {
                return "checked";
            }
        default:
            break;
    }
}

export async function findInSelection(driver, flag) {
    const actions = await driver.findElements(By.css(".find-actions div"));
    for (const action of actions) {
        if (
            (await action.getAttribute("title")).indexOf("Find in selection") !==
            -1
        ) {
            const checked = eval(await actions[i].getAttribute("aria-checked"));
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
}

export async function closeFinder(driver) {
    const actions = await driver.findElements(By.css(".find-actions div"));
    for (const action of actions) {
        if ((await action.getAttribute("title")).indexOf("Close") !== -1) {
            await action.click();

            return;
        }
    }
}

export async function expandFinderReplace(driver, flag) {
    const divs = await driver.findElements(By.css("div"));
    for (const div of divs) {
        if ((await div.getAttribute("title")) === "Toggle Replace mode") {
            const expanded = eval(await div.getAttribute("aria-expanded"));
            if (flag) {
                if (!expanded) {
                    await div.click();
                }
            } else {
                if (expanded) {
                    await div.click();
                }
            }
        }
    }
}

export async function replacerGetButton(driver, button) {
    const replaceActions = await driver.findElements(
        By.css(".replace-actions div"),
    );
    for (const action of replaceActions) {
        if (
            (await action.getAttribute("title")).indexOf(button) !== -1
        ) {
            return await action;
        }
    }
}

export async function getSchemaObject(driver, objType, objName) {
    const sectionHost = await driver.findElement(By.id("schemaSectionHost"));
    let level;
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
        async function () {
            try {
                const objects = await sectionHost.findElements(
                    By.css(".tabulator-table .tabulator-tree-level-" + level),
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

    const objects = await sectionHost.findElements(
        By.css(".tabulator-table .tabulator-tree-level-" + level),
    );
    for (const object of objects) {
        if ((await object.findElement(By.css("label")).getText()) === objName) {
            return await object;
        }
    }
}

export async function toggleSchemaObject(driver, objType, objName) {
    const obj = await getSchemaObject(driver, objType, objName);
    const toggle = await obj.findElement(By.css(".treeToggle"));
    await driver.executeScript("arguments[0].click()", toggle);
}

export async function addScript(driver, scriptType) {
    const context = await driver.findElement(By.id("scriptSectionHost"));
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
}

export async function getOpenEditor(driver, editor) {
    const context = await driver.findElement(By.id("editorSectionHost"));
    const editors = await context.findElements(
        By.css("div.accordionItem.closable"),
    );
    for (const editor of editors) {
        if ((await editor.findElement(By.css("span.label")).getText()) === editor) {
            return editor;
        }
    }
}

export async function selectCurrentEditor(driver, editorName, editorType) {
    await driver.findElement(By.id("documentSelector")).click();
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
                await item.click();
                await driver.wait(
                    async function () {
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
                break;
            }
        }
    }
}

export async function getResultTab(driver, tabName) {
    await driver.wait(until.elementsLocated(By.css(".tabArea")), 5000, "Tabs were not found in time");
    const resultGroups = await driver.findElements(By.xpath("//div[contains(@id, 'resultGroup')]"));
    for(const result of resultGroups){
        if( await (await result.findElement(By.css("label"))).getText() === tabName ){
            return result;
        }
    }
}

export async function getResultColumnName(driver, columnName) {
    const resultSet = await driver.findElement(
        By.css(".resultHost .tabulator-headers"),
    );

    const resultHeaderRows = await resultSet.findElements(
        By.css(".tabulator-col-title"),
    );

    for(const row of resultHeaderRows){
        if( await row.getText() === columnName ){
            return row;
        }
    }
}
