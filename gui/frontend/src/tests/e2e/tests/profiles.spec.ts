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
import { getDriver, load } from "../lib/engine";
import { By, until, WebDriver } from "selenium-webdriver";
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

xdescribe("Profiles", () => {
    let driver: WebDriver;
    let testFailed: boolean;

    beforeEach(async () => {
        driver = await getDriver();
        await load(driver, String(process.env.SHELL_UI_HOSTNAME));
        await waitForHomePage(driver);
    });

    afterEach(async () => {
        if(testFailed) {
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

    it("Add profile", async () => {
        try {
            await openProfileMenu(driver);

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

            expect(await getProfile(driver, "ClientQA1")).toBeDefined();
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    //has bug
    it("Edit profile - change profile name", async () => {
        try {
            await addProfile(driver, "ClientQA1", undefined);

            await (await getProfile(driver, "ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await getCurrentProfile(driver);

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            const menu = await openProfileMenu(driver);

            await menu!.findElement(By.id("edit")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            const name = await dialog.findElement(By.id("profileNewName"));

            await name.clear();

            await name.sendKeys("ClientQA2");

            await dialog.findElement(By.id("ok")).click();

            expect(await getProfile(driver, "ClientQA2")).toBeDefined();

            expect(await getProfile(driver, "ClientQA1")).toBeUndefined();
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    //has bug
    it("Edit profile - set profile as default", async () => {
        try {
            await addProfile(driver, "ClientQA1", undefined);

            await (await getProfile(driver, "ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await getCurrentProfile(driver);

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            const menu = await openProfileMenu(driver);

            await menu!.findElement(By.id("edit")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            await dialog.findElement(By.id("setAsDefaultProfile")).click();

            await dialog.findElement(By.id("ok")).click();

            await driver.navigate().refresh();

            await waitForHomePage(driver);

            expect(await getCurrentProfile(driver)).toBe("ClientQA1");
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Delete active profile", async () => {
        try {
            await addProfile(driver, "ClientQA1", undefined);

            await (await getProfile(driver, "ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await getCurrentProfile(driver);

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            const menu = await openProfileMenu(driver);

            await menu!.findElement(By.id("delete")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            expect(await dialog.findElement(By.id("dialogHeading")).getText())
                .toBe("Here you can activate/deactivate profiles for this application");

            await setProfilesToRemove(driver, ["ClientQA1"]);

            await dialog.findElement(By.id("ok")).click();

            expect(await dialog.findElement(By.css("label.error")).getText())
                .toBe("Active profile cannot be deleted");

            await dialog.findElement(By.id("cancel")).click();

            expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(
                0,
            );
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Delete non active profile", async () => {
        try {
            await addProfile(driver, "ClientQA1", undefined);

            await addProfile(driver, "ClientQA2", undefined);

            await (await getProfile(driver, "ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await getCurrentProfile(driver);

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            const menu = await openProfileMenu(driver);

            await menu!.findElement(By.id("delete")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            await setProfilesToRemove(driver, ["ClientQA2"]);

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

            expect(await getProfile(driver, "ClientQA2")).toBeUndefined();
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Delete default profile", async () => {
        try {
            await addProfile(driver, "ClientQA1", undefined);

            await (await getProfile(driver, "ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await getCurrentProfile(driver);

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            const menu = await openProfileMenu(driver);

            await menu!.findElement(By.id("delete")).click();

            const dialog = await driver.findElement(By.css(".valueEditDialog"));

            expect(await dialog.findElement(By.id("dialogHeading")).getText()).toBe(
                "Here you can activate/deactivate profiles for this application",
            );

            await setProfilesToRemove(driver, ["Default"]);

            await dialog.findElement(By.id("ok")).click();

            expect(await dialog.findElement(By.css("label.error")).getText())
                .toBe("Default profile cannot be deleted");

            await dialog.findElement(By.id("cancel")).click();

            expect((await driver.findElements(By.css(".valueEditDialog"))).length)
                .toBe(0);
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Saving profile settings", async () => {
        try {
            await addProfile(driver, "ClientQA1", undefined);

            await (await getProfile(driver, "ClientQA1"))!.click();

            await driver.wait(
                async () => {
                    const profile = await getCurrentProfile(driver);

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            await driver.findElement(By.id("settings")).click();

            await setSetting(driver, "settings.autoSaveInterval", "input", "500");

            await setSetting(
                driver,
                "theming.currentTheme",
                "selectList",
                "Default Light",
            );

            expect( String(await getBackgroundColor(driver)).trim()).toBe("#FFFFFF");

            await setSetting(driver, "dbEditor.startLanguage", "selectList", "python");

            await setSetting(driver, "editor.wordWrap", "selectList", "on");

            await setSetting(driver, "editor.wordWrapColumn", "input", "130");

            await setSetting(driver, "editor.showHidden", "checkbox", "checked");

            await setSetting(driver, "editor.dbVersion", "input", "8.0.26");

            await setSetting(driver, "editor.stopOnErrors", "checkbox", "checked");

            await setSetting(
                driver,
                "editor.theming.decorationSet",
                "selectList",
                "alternative",
            );

            await setSetting(
                driver,
                "dbEditor.connectionBrowser.showGreeting",
                "checkbox",
                "unchecked",
            );

            await setSetting(driver, "sql.limitRowCount", "input", "500");

            await setSetting(
                driver,
                "shellSession.sessionBrowser.showGreeting",
                "checkbox",
                "unchecked",
            );

            await driver.wait(until.elementLocated(By.id("about")), 1000);
            await driver.navigate().refresh();
            await waitForHomePage(driver);
            expect(await getCurrentProfile(driver)).toBe("Default");
            await (await getProfile(driver, "ClientQA1"))!.click();
            await driver.wait(
                async () => {
                    const profile = await getCurrentProfile(driver);

                    return profile === "ClientQA1";
                },
                2000,
                "Profile not loaded",
            );

            await driver.findElement(By.id("settings")).click();

            expect(
                await getSettingValue(driver, "settings.autoSaveInterval", "input"),
            ).toBe("500");

            expect(
                await getSettingValue(driver, "theming.currentTheme", "selectList"),
            ).toBe("Default Light");

            expect(
                await getSettingValue(driver, "dbEditor.startLanguage", "selectList"),
            ).toBe("Python");

            expect(await getSettingValue(driver, "editor.wordWrap", "selectList")).toBe("On");

            expect(
                await getSettingValue(driver, "editor.wordWrapColumn", "input"),
            ).toBe("130");

            expect(await getSettingValue(driver, "editor.showHidden", "checkbox")).toBe("checked");

            expect(await getSettingValue(driver, "editor.dbVersion", "input")).toBe("8.0.26");

            expect(
                await getSettingValue(driver, "editor.stopOnErrors", "checkbox"),
            ).toBe("checked");

            expect(
                await getSettingValue(
                    driver,
                    "editor.theming.decorationSet",
                    "selectList",
                ),
            ).toBe("Alternative Set");

            expect(
                await getSettingValue(
                    driver,
                    "dbEditor.connectionBrowser.showGreeting",
                    "checkbox",
                ),
            ).toBe("unchecked");

            expect(await getSettingValue(driver, "sql.limitRowCount", "input")).toBe("500");

            expect(
                await getSettingValue(driver, "shellSession.sessionBrowser.showGreeting", "checkbox"),
            ).toBe("unchecked");
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });
});
