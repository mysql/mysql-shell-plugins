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

import { getDriver, load } from "../lib/engine";
import { By } from "selenium-webdriver";
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
import { checkEnv, startServer, cleanDataDir } from "../lib/teardowns";

describe("Profiles", function () {
    let driver;
    beforeAll(async function () {
        try {
            await checkEnv();
        } catch (e) {
            console.error(e);
            await new Promise((resolve) => {return setTimeout(resolve, 500);});
            process.exit(1);
        }
    });

    beforeEach(async function () {
        __CHILD__= await startServer();
        driver = getDriver();
        await load(driver);
        await waitForHomePage(driver);
    });

    afterEach(async function () {
        await driver.close();
        await cleanDataDir();
        __CHILD__.kill();
    });

    afterAll(async function () {
        await driver.quit();
    });

    it("Add profile", async function () {
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
    });

    //edit profile does not work
    xit("Edit profile - change profile name", async function () {
        await addProfile(driver, "ClientQA1");

        await (await getProfile(driver, "ClientQA1")).click();

        await driver.wait(
            async function () {
                const profile = await getCurrentProfile(driver);

                return profile === "ClientQA1";
            },
            2000,
            "Profile not loaded",
        );

        const menu = await openProfileMenu(driver);

        await menu.findElement(By.id("edit")).click();

        const dialog = await driver.findElement(By.css(".valueEditDialog"));

        const name = await dialog.findElement(By.id("profileNewName"));

        await name.clear();

        await name.sendKeys("ClientQA2");

        await dialog.findElement(By.id("ok")).click();

        expect(await getProfile(driver, "ClientQA2")).toBeDefined();

        expect(await getProfile(driver, "ClientQA1")).toBeUndefined();
    });

    //not working yet
    xit("Edit profile - set profile as default", async function () {
        await addProfile(driver, "ClientQA1");

        await (await getProfile(driver, "ClientQA1")).click();

        await driver.wait(
            async function () {
                const profile = await getCurrentProfile(driver);

                return profile === "ClientQA1";
            },
            2000,
            "Profile not loaded",
        );

        const menu = await openProfileMenu(driver);

        await menu.findElement(By.id("edit")).click();

        const dialog = await driver.findElement(By.css(".valueEditDialog"));

        await dialog.findElement(By.id("setAsDefaultProfile")).click();

        await dialog.findElement(By.id("ok")).click();

        await driver.navigate().refresh();

        await waitForHomePage(driver);

        expect(await getCurrentProfile(driver)).toBe("ClientQA1");
    });

    it("Delete active profile", async function () {
        await addProfile(driver, "ClientQA1");

        await (await getProfile(driver, "ClientQA1")).click();

        await driver.wait(
            async function () {
                const profile = await getCurrentProfile(driver);

                return profile === "ClientQA1";
            },
            2000,
            "Profile not loaded",
        );

        const menu = await openProfileMenu(driver);

        await menu.findElement(By.id("delete")).click();

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
    });

    it("Delete non active profile", async function () {
        await addProfile(driver, "ClientQA1");

        await addProfile(driver, "ClientQA2");

        await (await getProfile(driver, "ClientQA1")).click();

        await driver.wait(
            async function () {
                const profile = await getCurrentProfile(driver);

                return profile === "ClientQA1";
            },
            2000,
            "Profile not loaded",
        );

        const menu = await openProfileMenu(driver);

        await menu.findElement(By.id("delete")).click();

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
    });

    it("Delete default profile", async function () {
        await addProfile(driver, "ClientQA1");

        await (await getProfile(driver, "ClientQA1")).click();

        await driver.wait(
            async function () {
                const profile = await getCurrentProfile(driver);

                return profile === "ClientQA1";
            },
            2000,
            "Profile not loaded",
        );

        const menu = await openProfileMenu(driver);

        await menu.findElement(By.id("delete")).click();

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
    });

    it("Saving profile settings", async function () {
        await addProfile(driver, "ClientQA1");

        await (await getProfile(driver, "ClientQA1")).click();

        await driver.wait(
            async function () {
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

        expect(
            (
                await getBackgroundColor(driver, driver.findElement(By.css("html")))
            ).trim(),
        ).toBe("#FFFFFF");

        await setSetting(driver, "dbEditor.startLanguage", "selectList", "Python");

        await setSetting(driver, "editor.wordWrap", "selectList", "on");

        await setSetting(driver, "editor.wordWrapColumn", "input", "130");

        await setSetting(driver, "editor.showHidden", "checkbox", "checked");

        await setSetting(driver, "editor.dbVersion", "input", "8.0.26");

        await setSetting(driver, "editor.stopOnErrors", "checkbox", "checked");

        await setSetting(
            driver,
            "editor.theming.decorationSet",
            "selectList",
            "Alternative Set",
        );

        await setSetting(
            driver,
            "connectionBrowser.showGreeting",
            "checkbox",
            "unchecked",
        );

        await setSetting(driver, "sql.limitRowCount", "input", "500");

        await setSetting(
            driver,
            "sessionBrowser.showGreeting",
            "checkbox",
            "unchecked",
        );

        await driver.wait(until.elementLocated(By.id("about")).click(), 1000);
        await driver.navigate().refresh();
        await waitForHomePage(driver);
        expect(await getCurrentProfile(driver)).toBe("Default");
        await (await getProfile(driver, "ClientQA1")).click();
        await driver.wait(
            async function () {
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

        expect(await getSettingValue(driver, "editor.wordWrap", "selectList")).toBe("on");

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
                "connectionBrowser.showGreeting",
                "checkbox",
            ),
        ).toBe("unchecked");

        expect(await getSettingValue(driver, "sql.limitRowCount", "input")).toBe("500");

        expect(
            await getSettingValue(driver, "sessionBrowser.showGreeting", "checkbox"),
        ).toBe("unchecked");
    });
});
