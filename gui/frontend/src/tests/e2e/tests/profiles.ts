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

import { promises as fsPromises } from "fs";
import { driver, loadDriver, loadPage } from "../lib/engine";
import { By, until } from "selenium-webdriver";
import {
    waitForHomePage,
    openProfileMenu,
    getProfile,
    addProfile,
    getCurrentProfile,
    setProfilesToRemove,
    setSetting,
    getBackgroundColor,
    getSettingValue,
} from "../lib/helpers";

describe("Profiles", () => {
    let testFailed: boolean;

    beforeEach(async () => {
        await loadDriver();
        try {
            await loadPage(String(process.env.SHELL_UI_HOSTNAME));
            await waitForHomePage();
        } catch (e) {
            await driver.navigate().refresh();
            await waitForHomePage();
        }
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            const img = await driver.takeScreenshot();
            const testName: string = expect.getState().currentTestName
                .toLowerCase().replace(/\s/g, "_");
            try {
                await fsPromises.access("src/tests/e2e/screenshots");
            } catch(e) {
                await fsPromises.mkdir("src/tests/e2e/screenshots");
            }
            await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");
        }
    });

    afterAll( async () => {
        await driver.quit();
    });

    // reason: Profiles section is under development
    xit("Add profile", async () => {
        try {
            await openProfileMenu();

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

            expect(await getProfile("ClientQA1")).toBeDefined();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    // reason: Profiles section is under development
    xit("Edit profile - change profile name", async () => {
        try {
            await addProfile("ClientQA1", undefined);

            await (await getProfile("ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await getCurrentProfile();

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            const menu = await openProfileMenu();

            await menu!.findElement(By.id("edit")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            const name = await dialog.findElement(By.id("profileNewName"));

            await name.clear();

            await name.sendKeys("ClientQA2");

            await dialog.findElement(By.id("ok")).click();

            expect(await getProfile("ClientQA2")).toBeDefined();

            expect(await getProfile("ClientQA1")).toBeUndefined();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    // reason: Profiles section is under development
    xit("Edit profile - set profile as default", async () => {
        try {
            await addProfile("ClientQA1", undefined);

            await (await getProfile("ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await getCurrentProfile();

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            const menu = await openProfileMenu();

            await menu!.findElement(By.id("edit")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            await dialog.findElement(By.id("setAsDefaultProfile")).click();

            await dialog.findElement(By.id("ok")).click();

            await driver.navigate().refresh();

            await waitForHomePage();

            expect(await getCurrentProfile()).toBe("ClientQA1");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    // reason: Profiles section is under development
    xit("Delete active profile", async () => {
        try {
            await addProfile("ClientQA1", undefined);

            await (await getProfile("ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await getCurrentProfile();

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            const menu = await openProfileMenu();

            await menu!.findElement(By.id("delete")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            expect(await dialog.findElement(By.id("dialogHeading")).getText())
                .toBe("Here you can activate/deactivate profiles for this application");

            await setProfilesToRemove(["ClientQA1"]);

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
            await addProfile("ClientQA1", undefined);

            await addProfile("ClientQA2", undefined);

            await (await getProfile("ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await getCurrentProfile();

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            const menu = await openProfileMenu();

            await menu!.findElement(By.id("delete")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            await setProfilesToRemove(["ClientQA2"]);

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

            expect(await getProfile("ClientQA2")).toBeUndefined();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    // reason: Profiles section is under development
    xit("Delete default profile", async () => {
        try {
            await addProfile("ClientQA1", undefined);

            await (await getProfile("ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await getCurrentProfile();

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            const menu = await openProfileMenu();

            await menu!.findElement(By.id("delete")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            expect(await dialog.findElement(By.id("dialogHeading")).getText()).toBe(
                "Here you can activate/deactivate profiles for this application",
            );

            await setProfilesToRemove(["Default"]);

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
            await addProfile("ClientQA1", undefined);

            await (await getProfile("ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await getCurrentProfile();

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            await driver.findElement(By.id("settings")).click();

            await setSetting("settings.autoSaveInterval", "input", "500");

            await setSetting(
                "theming.currentTheme",
                "selectList",
                "Default Light",
            );

            expect(String(await getBackgroundColor()).trim()).toBe("#FFFFFF");

            await setSetting("dbEditor.startLanguage", "selectList", "python");

            await setSetting("editor.wordWrap", "selectList", "on");

            await setSetting("editor.wordWrapColumn", "input", "130");

            await setSetting("editor.showHidden", "checkbox", "checked");

            await setSetting("editor.dbVersion", "input", "8.0.26");

            await setSetting("editor.stopOnErrors", "checkbox", "checked");

            await setSetting(
                "editor.theming.decorationSet",
                "selectList",
                "alternative",
            );

            await setSetting(
                "dbEditor.connectionBrowser.showGreeting",
                "checkbox",
                "unchecked",
            );

            await setSetting("sql.limitRowCount", "input", "500");

            await setSetting(
                "shellSession.sessionBrowser.showGreeting",
                "checkbox",
                "unchecked",
            );

            await driver.wait(until.elementLocated(By.id("about")), 1000);
            await driver.navigate().refresh();
            await waitForHomePage();
            expect(await getCurrentProfile()).toBe("Default");
            await (await getProfile("ClientQA1"))!.click();
            await driver.wait(
                async () => {
                    const profile = await getCurrentProfile();

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            await driver.findElement(By.id("settings")).click();

            expect(
                await getSettingValue("settings.autoSaveInterval", "input"),
            ).toBe("500");

            expect(
                await getSettingValue("theming.currentTheme", "selectList"),
            ).toBe("Default Light");

            expect(
                await getSettingValue("dbEditor.startLanguage", "selectList"),
            ).toBe("Python");

            expect(await getSettingValue("editor.wordWrap", "selectList")).toBe("On");

            expect(
                await getSettingValue("editor.wordWrapColumn", "input"),
            ).toBe("130");

            expect(await getSettingValue("editor.showHidden", "checkbox")).toBe("checked");

            expect(await getSettingValue("editor.dbVersion", "input")).toBe("8.0.26");

            expect(
                await getSettingValue("editor.stopOnErrors", "checkbox"),
            ).toBe("checked");

            expect(
                await getSettingValue(
                    "editor.theming.decorationSet",
                    "selectList",
                ),
            ).toBe("Alternative Set");

            expect(
                await getSettingValue(
                    "dbEditor.connectionBrowser.showGreeting",
                    "checkbox",
                ),
            ).toBe("unchecked");

            expect(await getSettingValue("sql.limitRowCount", "input")).toBe("500");

            expect(
                await getSettingValue("shellSession.sessionBrowser.showGreeting", "checkbox"),
            ).toBe("unchecked");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });
});
