/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import { By, until, WebElement, WebDriver } from "selenium-webdriver";

import { Misc } from "./misc.js";
import { Settings } from "./settings.js";

export class Profile {

    /**
     * Returns the current profile
     *
     * @returns Promise resolving with the the profile
     */
    public static getCurrentProfile = async (driver: WebDriver): Promise<string | undefined> => {
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
    public static openProfileMenu = async (driver: WebDriver): Promise<WebElement | undefined> => {
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
    public static getProfile = async (driver: WebDriver, profile: string): Promise<WebElement | undefined> => {
        await Profile.openProfileMenu(driver);
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
    public static addProfile = async (driver: WebDriver,
        profile: string, profile2copy: string | undefined): Promise<void> => {
        await Profile.openProfileMenu(driver);
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
    public static setProfilesToRemove = async (driver: WebDriver, profs: string[]): Promise<void> => {
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
     * Sets a setting on the Settings page
     *
     * @param settingId html id
     * @param type input/selectList/checkbox
     * @param value text to set
     * @returns A promise resolving with the set is made
     */
    public static setSetting = async (driver: WebDriver, settingId: string, type: string, value: string): Promise<void> => {
        const settingsValueList = driver.findElement(By.id("settingsValueList"));
        await Settings.clickSettingArea(driver, settingId);
        const el = settingsValueList.findElement(By.id(settingId));
        await driver.executeScript("arguments[0].scrollIntoView(true)", el);
        const dropDownList = await driver.findElement(By.css(".dropdownList"));
        const classes = (await el.getAttribute("class")).split(" ");
        switch (type) {
            case "input":
                await driver.executeScript("arguments[0].click()", el);
                if ((await el.getTagName()) === "input") {
                    await el.clear();
                    await Misc.setInputValue(driver, settingId, undefined, value);
                } else {
                    await el.findElement(By.css(type)).clear();
                    await Misc.setInputValue(driver, settingId, type, value);
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
    public static getSettingValue = async (driver: WebDriver, settingId: string, type: string): Promise<string> => {
        const settingsValueList = driver.findElement(By.id("settingsValueList"));
        await Settings.clickSettingArea(driver, settingId);
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

}
