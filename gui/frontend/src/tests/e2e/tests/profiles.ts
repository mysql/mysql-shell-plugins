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

import { By, until } from "selenium-webdriver";

import { Misc, driver } from "../lib/misc.js";
import { Profile } from "../lib/profile.js";

describe("Profiles", () => {
    let testFailed: boolean;

    beforeEach(async () => {
        await Misc.loadDriver();
        try {
            await Misc.loadPage(String(process.env.SHELL_UI_HOSTNAME));
            await Misc.waitForHomePage();
        } catch (e) {
            await driver.navigate().refresh();
            await Misc.waitForHomePage();
        }
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }
    });

    afterAll(async () => {
        await driver.quit();
    });

    // reason: Profiles section is under development
    xit("Add profile", async () => {
        try {
            await Profile.openProfileMenu();

            await driver.findElement(By.id("add")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            expect(await dialog.findElement(By.css(".title label")).getText())
                .toBe("Add/Edit Profile");

            expect(await dialog.findElement(By.id("dialogHeading")).getText())
                .toBe("Here you can add new profile for this application");

            expect(await dialog.findElement(By.id("profileName"))).toBeDefined();

            expect(await dialog.findElement(By.id("copyProfile"))).toBeDefined();

            expect(await dialog.findElement(By.id("definedProfiles"))).toBeDefined();

            expect(await dialog.findElement(By.id("ok"))).toBeDefined();

            expect(await dialog.findElement(By.id("cancel"))).toBeDefined();

            await dialog.findElement(By.id("profileName")).sendKeys("ClientQA1");

            await dialog.findElement(By.id("ok")).click();

            expect(await Profile.getProfile("ClientQA1")).toBeDefined();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    // reason: Profiles section is under development
    xit("Edit profile - change profile name", async () => {
        try {
            await Profile.addProfile("ClientQA1", undefined);

            await (await Profile.getProfile("ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await Profile.getCurrentProfile();

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            const menu = await Profile.openProfileMenu();

            await menu!.findElement(By.id("edit")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            const name = await dialog.findElement(By.id("profileNewName"));

            await name.clear();

            await name.sendKeys("ClientQA2");

            await dialog.findElement(By.id("ok")).click();

            expect(await Profile.getProfile("ClientQA2")).toBeDefined();

            expect(await Profile.getProfile("ClientQA1")).toBeUndefined();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    // reason: Profiles section is under development
    xit("Edit profile - set profile as default", async () => {
        try {
            await Profile.addProfile("ClientQA1", undefined);

            await (await Profile.getProfile("ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await Profile.getCurrentProfile();

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            const menu = await Profile.openProfileMenu();

            await menu!.findElement(By.id("edit")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            await dialog.findElement(By.id("setAsDefaultProfile")).click();

            await dialog.findElement(By.id("ok")).click();

            await driver.navigate().refresh();

            await Misc.waitForHomePage();

            expect(await Profile.getCurrentProfile()).toBe("ClientQA1");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    // reason: Profiles section is under development
    xit("Delete active profile", async () => {
        try {
            await Profile.addProfile("ClientQA1", undefined);

            await (await Profile.getProfile("ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await Profile.getCurrentProfile();

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            const menu = await Profile.openProfileMenu();

            await menu!.findElement(By.id("delete")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            expect(await dialog.findElement(By.id("dialogHeading")).getText())
                .toBe("Here you can activate/deactivate profiles for this application");

            await Profile.setProfilesToRemove(["ClientQA1"]);

            await dialog.findElement(By.id("ok")).click();

            expect(await dialog.findElement(By.css("label.error")).getText())
                .toBe("Active profile cannot be deleted");

            await dialog.findElement(By.id("cancel")).click();

            expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(
                0,
            );
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    // reason: Profiles section is under development
    xit("Delete non active profile", async () => {
        try {
            await Profile.addProfile("ClientQA1", undefined);

            await Profile.addProfile("ClientQA2", undefined);

            await (await Profile.getProfile("ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await Profile.getCurrentProfile();

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            const menu = await Profile.openProfileMenu();

            await menu!.findElement(By.id("delete")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            await Profile.setProfilesToRemove(["ClientQA2"]);

            expect((await dialog.findElements(By.css("label.error"))).length).toBe(0);

            await dialog.findElement(By.id("ok")).click();

            const confirmDialog = await driver.findElement(By.css(".confirmDialog"));

            expect(
                await confirmDialog
                    .findElement(By.css(".verticalCenterContent label"))
                    .getText(),
            ).toBe("Delete Profile");

            expect(
                await confirmDialog.findElement(By.css(".content label")).getText(),
            ).toBe("Are you sure you want to delete the selected profile");

            await confirmDialog.findElement(By.id("accept")).click();

            expect(await Profile.getProfile("ClientQA2")).toBeUndefined();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    // reason: Profiles section is under development
    xit("Delete default profile", async () => {
        try {
            await Profile.addProfile("ClientQA1", undefined);

            await (await Profile.getProfile("ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await Profile.getCurrentProfile();

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            const menu = await Profile.openProfileMenu();

            await menu!.findElement(By.id("delete")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            expect(await dialog.findElement(By.id("dialogHeading")).getText()).toBe(
                "Here you can activate/deactivate profiles for this application",
            );

            await Profile.setProfilesToRemove(["Default"]);

            await dialog.findElement(By.id("ok")).click();

            expect(await dialog.findElement(By.css("label.error")).getText())
                .toBe("Default profile cannot be deleted");

            await dialog.findElement(By.id("cancel")).click();

            expect((await driver.findElements(By.css(".valueEditDialog"))).length)
                .toBe(0);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    // reason: Profiles section is under development
    xit("Saving profile settings", async () => {
        try {
            await Profile.addProfile("ClientQA1", undefined);

            await (await Profile.getProfile("ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await Profile.getCurrentProfile();

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            await driver.findElement(By.id("settings")).click();

            await Profile.setSetting("settings.autoSaveInterval", "input", "500");

            await Profile.setSetting(
                "theming.currentTheme",
                "selectList",
                "Default Light",
            );

            expect(String(await Misc.getBackgroundColor()).trim()).toBe("#FFFFFF");

            await Profile.setSetting("dbEditor.startLanguage", "selectList", "python");

            await Profile.setSetting("editor.wordWrap", "selectList", "on");

            await Profile.setSetting("editor.wordWrapColumn", "input", "130");

            await Profile.setSetting("editor.showHidden", "checkbox", "checked");

            await Profile.setSetting("editor.dbVersion", "input", "8.0.26");

            await Profile.setSetting("editor.stopOnErrors", "checkbox", "checked");

            await Profile.setSetting(
                "editor.theming.decorationSet",
                "selectList",
                "alternative",
            );

            await Profile.setSetting(
                "dbEditor.connectionBrowser.showGreeting",
                "checkbox",
                "unchecked",
            );

            await Profile.setSetting("sql.limitRowCount", "input", "500");

            await Profile.setSetting(
                "shellSession.sessionBrowser.showGreeting",
                "checkbox",
                "unchecked",
            );

            await driver.wait(until.elementLocated(By.id("about")), 1000);
            await driver.navigate().refresh();
            await Misc.waitForHomePage();
            expect(await Profile.getCurrentProfile()).toBe("Default");
            await (await Profile.getProfile("ClientQA1"))!.click();
            await driver.wait(
                async () => {
                    const profile = await Profile.getCurrentProfile();

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            await driver.findElement(By.id("settings")).click();

            expect(
                await Profile.getSettingValue("settings.autoSaveInterval", "input"),
            ).toBe("500");

            expect(
                await Profile.getSettingValue("theming.currentTheme", "selectList"),
            ).toBe("Default Light");

            expect(
                await Profile.getSettingValue("dbEditor.startLanguage", "selectList"),
            ).toBe("Python");

            expect(await Profile.getSettingValue("editor.wordWrap", "selectList")).toBe("On");

            expect(
                await Profile.getSettingValue("editor.wordWrapColumn", "input"),
            ).toBe("130");

            expect(await Profile.getSettingValue("editor.showHidden", "checkbox")).toBe("checked");

            expect(await Profile.getSettingValue("editor.dbVersion", "input")).toBe("8.0.26");

            expect(
                await Profile.getSettingValue("editor.stopOnErrors", "checkbox"),
            ).toBe("checked");

            expect(
                await Profile.getSettingValue(
                    "editor.theming.decorationSet",
                    "selectList",
                ),
            ).toBe("Alternative Set");

            expect(
                await Profile.getSettingValue(
                    "dbEditor.connectionBrowser.showGreeting",
                    "checkbox",
                ),
            ).toBe("unchecked");

            expect(await Profile.getSettingValue("sql.limitRowCount", "input")).toBe("500");

            expect(
                await Profile.getSettingValue("shellSession.sessionBrowser.showGreeting", "checkbox"),
            ).toBe("unchecked");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });
});
