/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { WebElement, until } from "selenium-webdriver";
import { basename } from "path";
import { Misc } from "../../lib/misc.js";
import * as locator from "../../lib/locators.js";
import { driver, loadDriver } from "../../lib/driver.js";
import * as constants from "../../lib/constants.js";
import { Os } from "../../lib/os.js";
import { E2EToastNotification } from "../../lib/E2EToastNotification.js";
import * as interfaces from "../../lib/interfaces.js";
import { PasswordDialog } from "../../lib/Dialogs/PasswordDialog.js";
import { E2ENotificationsCenter } from "../../lib/E2ENotificationsCenter.js";
import { DatabaseConnectionOverview } from "../../lib/databaseConnectionOverview.js";
import { DatabaseConnectionDialog } from "../../lib/databaseConnectionDialog.js";
import { E2EStatusBar } from "../../lib/E2EStatusBar.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

const localConn: interfaces.IDBConnection = {
    dbType: "MySQL",
    caption: `connNotebooks`,
    description: "Local connection",
    basic: {
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: String(process.env.DBUSERNAME2),
        port: parseInt(process.env.DBPORT!, 10),
        portX: parseInt(process.env.DBPORTX!, 10),
        schema: "sakila",
        password: String(process.env.DBUSERNAME2PWD),
    },
};

describe("Notifications", () => {

    let testFailed = false;

    beforeAll(async () => {
        await loadDriver();
        await driver.get(url);

        await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds, "Home page was not loaded")
            .catch(async (e) => {
                await Misc.storeScreenShot("beforeAll_Notifications");
                throw e;
            });
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }
    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    it("Verify Info notification", async () => {

        try {
            await driver.wait(until.elementLocated(locator.settingsPage.icon), constants.wait5seconds).click();
            const infoNotificationTrigger = await driver.wait(until
                .elementLocated(locator.settingsPage.settingsList.invisibleCharacters),
                constants.wait5seconds, "Invisible characters checkbox wat not found");
            await infoNotificationTrigger.click();
            const notification = await new E2EToastNotification().create();
            expect(notification.type).toBe("info");
            expect(notification.message).toBe("Profile updated successfully.");
            const statusBar = new E2EStatusBar();
            expect(await statusBar.hasNotifications()).toBe(true);
            await notification.close();
            await driver.wait(notification.untilIsClosed(), constants.wait5seconds, "The notification was not closed");
            expect(await statusBar.hasNotifications()).toBe(false);
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Verify Error notification", async () => {

        try {
            await driver.executeScript("arguments[0].click()", await driver.findElement(locator.sqlEditorPage.icon));
            await DatabaseConnectionOverview.createDataBaseConnection(localConn);
            await DatabaseConnectionOverview.moreActions(localConn.caption!, constants.editConnection);
            await DatabaseConnectionDialog.clearPassword();

            await driver.executeScript("arguments[0].click();",
                await DatabaseConnectionOverview.getConnection(localConn.caption!));
            await PasswordDialog.cancel();

            const notification = await new E2EToastNotification().create();
            expect(notification.type).toBe("error");
            expect(notification.message).toContain("Cancelled");
            const statusBar = new E2EStatusBar();
            expect(await statusBar.hasNotifications()).toBe(true);
            await notification.close();
            await driver.wait(notification.untilIsClosed(), constants.wait3seconds, "The notification was not closed");
            expect(await statusBar.hasNotifications()).toBe(false);
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Verify maximum notifications allowed on screen", async () => {

        const getWordWrappingUpButton = async (): Promise<WebElement> => {
            return driver.wait(until
                .elementLocated(locator.settingsPage.settingsList.wordWrapColumn.up),
                constants.wait5seconds, "Word wrap column up button wat not found");
        };

        try {
            await driver.findElement(locator.settingsPage.icon).click();
            const clicks = 5;

            for (let i = 1; i <= clicks; i++) {
                const prevNotifications = await Misc.getToastNotifications();
                const infoNotificationTrigger = await getWordWrappingUpButton();
                await infoNotificationTrigger.click();
                await driver.wait(async () => {
                    const notifications = await Misc.getToastNotifications();
                    if (notifications.length > prevNotifications.length) {
                        return true;
                    } else if (notifications.length === prevNotifications.length) {
                        if (notifications.length > 0) {
                            return (notifications[0].id !== prevNotifications[0].id);
                        }
                    }
                }, constants.wait5seconds, `Number of notifications did not changed`);
            }

            await driver.wait(async () => {
                return (await Misc.getToastNotifications()).length <= 3;
            }, constants.wait5seconds, "Number of notifications should not be higher than 3");

            const notifications = await Misc.getToastNotifications();

            for (const notification of notifications) {
                await notification.close();
                await driver.wait(notification.untilIsClosed(), constants.wait3seconds,
                    `Notification ${notification.id} was not closed`);
            }

        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Notifications center - Clear notifications", async () => {

        try {
            await driver.wait(async () => {
                await driver.findElement(locator.settingsPage.icon).click();

                return (await driver.findElements(locator.settingsPage.settingsList.invisibleCharacters)).length > 0;
            }, constants.wait5seconds, "Settings page was not opened");

            const notificationsCenter = await new E2ENotificationsCenter().open();
            const infoNotificationTrigger = await driver.wait(until
                .elementLocated(locator.settingsPage.settingsList.wordWrapColumn.up),
                constants.wait5seconds, "Word wrap column up button wat not found");
            await infoNotificationTrigger.click();
            await driver.wait(notificationsCenter!.untilNotificationsExists(), constants.wait5seconds);
            await notificationsCenter?.clearNotifications();
            expect(((await notificationsCenter!.getNotifications()).length)).toBe(0);
            await notificationsCenter?.hide();
            expect((await driver.findElements(locator.notificationsCenter.isOpened)).length).toBe(0);
            await new E2EToastNotification().create(undefined, 500)
                .then(async (el: E2EToastNotification) => {
                    await el.close();
                    await driver.wait(el.untilIsClosed(), constants.wait5seconds, "The notification was not closed");
                }).catch(() => {
                    // continue
                });
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Verify Notifications center - Title and items", async () => {

        try {
            const existingNotifications = await Misc.getToastNotifications();
            for (const notification of existingNotifications) {
                await notification.close();
                await driver.wait(notification.untilIsClosed(), constants.wait5seconds,
                    "Existing notification was not closed");
            }
            const notificationsCenter = await new E2ENotificationsCenter().open();
            expect(await notificationsCenter?.getTitle()).toMatch(/NO.*NOTIFICATIONS/);
            const infoNotificationTrigger = await driver.wait(until
                .elementLocated(locator.settingsPage.settingsList.invisibleCharacters),
                constants.wait5seconds, "Invisible characters checkbox wat not found");
            await driver.executeScript("arguments[0].click()", infoNotificationTrigger);
            await driver.wait(notificationsCenter!.untilNotificationsExists(), constants.wait5seconds);
            const notifications = await notificationsCenter!.getNotifications();
            expect(notifications.length).toBe(1);
            expect(notifications[0].type).toBe("info");
            expect(notifications[0].message).toBe("Profile updated successfully.");
            expect(await notificationsCenter?.getTitle()).toBe("1 NEW NOTIFICATION");
            await notificationsCenter?.closeNotification(0);
            expect(((await notificationsCenter!.getNotifications()).length)).toBe(0);
            await notificationsCenter?.hide();
            expect((await driver.findElements(locator.notificationsCenter.isOpened)).length).toBe(0);
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Notifications center - Silent mode", async () => {

        try {
            await driver.findElement(locator.settingsPage.icon).click();
            let notificationsCenter = await new E2ENotificationsCenter().open();
            await notificationsCenter?.toggleSilentMode();
            expect(await new E2EStatusBar().isOnSilentMode()).toBe(true);
            await notificationsCenter?.hide();
            await driver.wait(async () => {
                await driver.findElement(locator.settingsPage.icon).click();

                return (await driver.findElements(locator.settingsPage.settingsList.invisibleCharacters)).length > 0;
            }, constants.wait5seconds, "Settings page was not opened");
            const infoNotificationTrigger = driver.wait(until
                .elementLocated(locator.settingsPage.settingsList.wordWrapColumn.up),
                constants.wait5seconds, "Word wrap column up button wat not found");
            await infoNotificationTrigger.click();

            try {
                await new E2EToastNotification().create(undefined, constants.wait3seconds);
                throw new Error("A notification should not have been triggered");
            } catch (e) {
                expect((e as Error).stack).toContain("Could not find any notification");
            }

            notificationsCenter = await new E2ENotificationsCenter().open();
            let notifications = await notificationsCenter!.getNotifications();
            expect(notifications.length).toBe(1);
            expect(notifications[0].type).toBe("info");
            expect(notifications[0].message).toBe("Profile updated successfully.");
            await notificationsCenter?.clearNotifications();
            await notificationsCenter?.hide();

            await driver.executeScript("arguments[0].click()", await driver.findElement(locator.sqlEditorPage.icon));
            await driver.executeScript("arguments[0].click();",
                await DatabaseConnectionOverview.getConnection(localConn.caption!));
            await PasswordDialog.cancel();

            const notification = await new E2EToastNotification().create();
            expect(notification.type).toBe("error");
            expect(notification.message).toContain("Cancelled");
            notificationsCenter = await new E2ENotificationsCenter().open();
            notifications = await notificationsCenter!.getNotifications();
            expect(((notifications).length)).toBe(1);
            expect(notifications[0].type).toBe("error");
            expect(notifications[0].message).toContain("Cancelled");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
