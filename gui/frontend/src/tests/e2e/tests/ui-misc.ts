/*
 * Copyright (c) 2024, 2025 Oracle and/or its affiliates.
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

import { basename } from "path";
import { Misc } from "../lib/misc.js";
import { driver, loadDriver } from "../lib/driver.js";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection.js";
import { Os } from "../lib/os.js";
import * as constants from "../lib/constants.js";
import * as interfaces from "../lib/interfaces.js";
import { E2EDatabaseConnectionOverview } from "../lib/E2EDatabaseConnectionOverview.js";
import { until } from "selenium-webdriver";
import * as locator from "../lib/locators.js";
import { E2EToastNotification } from "../lib/E2EToastNotification.js";
import { E2ELogin } from "../lib/E2ELogin.js";
import { E2EStatusBar } from "../lib/E2EStatusBar.js";
import { DatabaseConnectionDialog } from "../lib/Dialogs/DatabaseConnectionDialog.js";
import { E2ENotificationsCenter } from "../lib/E2ENotificationsCenter.js";
import { E2EDebugger } from "../lib/E2EDebugger.js";
import { E2ETabContainer } from "../lib/E2ETabContainer.js";
import { E2ESettings } from "../lib/E2ESettings.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("Token Verification", () => {

    let testFailed = false;

    beforeEach(async () => {

        await loadDriver(true);
        await driver.get(url);

        try {
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
            const settings = new E2ESettings();
            await settings.open();
            await settings.confirmationOnClose(false);
            await settings.close();
        } catch (e) {
            await Misc.storeScreenShot("beforeEach_TOKEN_VERIFICATION");
            throw e;
        }
    });

    afterAll(async () => {
        await driver.quit();
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }

        await driver.close();
    });

    it("No token", async () => {
        try {
            const noToken = String(url).replace(String(process.env.TOKEN), "");
            await driver.get(noToken);

            expect(driver.wait(until.elementsLocated(locator.adminPage.headingText), constants.wait5seconds,
                "Login page was not displayed")).toBeDefined();
            const notification = (await new E2EToastNotification().create())!;
            expect(notification.type).toBe("error");

            let regex = "Could not establish a connection to the backend.";
            regex += " Make sure you use valid user credentials and the MySQL Shell is running.";
            regex += " Trying to reconnect in (\\d+) seconds.";

            expect(notification.message).toMatch(new RegExp(regex));
            await notification.close();
            await driver.wait(notification.untilIsClosed(), constants.wait5seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Invalid token", async () => {
        try {
            const invalidToken = `${String(url)}xpto`;
            await driver.get(invalidToken);

            expect(driver.wait(until.elementsLocated(locator.pageIsLoading), constants.wait5seconds,
                "Blank page was not displayed")).toBeDefined();

            const notification = (await new E2EToastNotification().create())!;
            expect(notification.type).toBe("error");

            let regex = "Could not establish a connection to the backend.";
            regex += " Make sure you use valid user credentials and the MySQL Shell is running.";
            regex += " Trying to reconnect in (\\d+) seconds.";

            expect(notification.message).toMatch(new RegExp(regex));
            await notification.close();
            await driver.wait(notification.untilIsClosed(), constants.wait5seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});

describe("Login", () => {

    let testFailed = false;
    const login = new E2ELogin();

    beforeAll(async () => {
        await loadDriver(true);
        await driver.get(String(process.env.SHELL_UI_MU_HOSTNAME));

        await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
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

    it("Invalid login", async () => {
        try {
            await login.setPassword("client");
            await login.setPassword("root");
            await login.login();
            expect(await login.getError()).toBe("User could not be authenticated. Incorrect username or password.");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Successful login", async () => {
        try {
            await login.setUsername("client");
            await login.setPassword("client");
            await login.login();

            const connectionOverview = new E2EDatabaseConnectionOverview();
            await driver.wait(connectionOverview.untilExists(), constants.wait5seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});

describe("Notifications", () => {

    const localConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `E2E - NOTIFICATIONS`,
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_PORT!, 10),
            schema: "sakila",
            password: String(process.env.DBUSERNAME1PWD),
        },
    };

    let testFailed = false;
    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);

    beforeAll(async () => {
        await loadDriver(true);
        await driver.get(url);

        try {
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
            const settings = new E2ESettings();
            await settings.open();
            await settings.confirmationOnClose(false);
            await settings.close();
            await dbTreeSection.focus();
            await dbTreeSection.createDatabaseConnection(localConn);
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
            await driver.wait(dbTreeSection.untilTreeItemExists(localConn.caption!), constants.wait5seconds);
            await dbTreeSection.expandTreeItem(localConn);
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_NOTEBOOKS");
            throw e;
        }
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
            await dbTreeSection
                .openContextMenuAndSelect((localConn.basic as interfaces.IConnBasicMySQL)
                    .schema!, [constants.copyToClipboard.exists, constants.copyToClipboard.name]);
            const notification = (await new E2EToastNotification().create())!;
            expect(notification.message).toBe("The name was copied to the system clipboard");
            expect(notification.type).toBe("info");
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
            const connectionOverview = new E2EDatabaseConnectionOverview();
            await driver.wait(async () => {
                await connectionOverview.moreActions(localConn.caption!, constants.editConnection);
                await DatabaseConnectionDialog.clearPassword();

                return (await Misc.getToastNotifications()).length > 0;
            }, constants.wait10seconds, "Could not trigger an error notification");

            const notification = (await new E2EToastNotification().create())!;
            expect(notification.type).toBe("error");
            expect(notification.message).toContain("Clear Password Error");
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

        try {
            await Misc.dismissNotifications();
            await dbTreeSection.expandTreeItem(localConn);
            const clicks = 5;

            for (let i = 1; i <= clicks; i++) {
                const prevNotifications = await Misc.getToastNotifications();
                await dbTreeSection
                    .openContextMenuAndSelect((localConn.basic as interfaces.IConnBasicMySQL)
                        .schema!, [constants.copyToClipboard.exists, constants.copyToClipboard.name]);

                await driver.wait(async () => {
                    const notifications = await Misc.getToastNotifications();
                    if (notifications.length > prevNotifications.length) {
                        return true;
                    } else if (notifications.length === prevNotifications.length) {
                        if (notifications.length > 0) {
                            return (notifications[0]!.id !== prevNotifications[0]!.id);
                        }
                    }
                }, constants.wait10seconds, `Number of notifications did not changed`);
            }

            await driver.wait(async () => {
                return (await Misc.getToastNotifications()).length === 3;
            }, constants.wait5seconds, "Number of notifications should be 3");

            await Misc.dismissNotifications();
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Notifications center - Clear notifications", async () => {
        try {
            const notificationsCenter = await new E2ENotificationsCenter().open();

            await dbTreeSection.openContextMenuAndSelect((localConn.basic as interfaces.IConnBasicMySQL)
                .schema!, [constants.copyToClipboard.exists, constants.copyToClipboard.name]);

            await driver.wait(notificationsCenter!.untilNotificationsExists(), constants.wait5seconds);
            await notificationsCenter?.clearNotifications();
            expect(((await notificationsCenter!.getNotifications()).length)).toBe(0);
            await notificationsCenter?.hide();
            expect((await driver.findElements(locator.notificationsCenter.isOpened)).length).toBe(0);
            await Misc.dismissNotifications();
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Verify Notifications center - Title and items", async () => {
        try {
            await Misc.dismissNotifications();
            const notificationsCenter = await new E2ENotificationsCenter().open();
            expect(await notificationsCenter?.getTitle()).toMatch(/NO.*NOTIFICATIONS/);

            await dbTreeSection.openContextMenuAndSelect((localConn.basic as interfaces.IConnBasicMySQL)
                .schema!, [constants.copyToClipboard.exists, constants.copyToClipboard.name]);

            await driver.wait(notificationsCenter!.untilNotificationsExists(), constants.wait5seconds);
            const notifications = await notificationsCenter!.getNotifications();
            expect(notifications.length).toBe(1);
            expect(notifications[0].type).toBe("info");
            expect(notifications[0].message).toBe("The name was copied to the system clipboard");
            expect(await notificationsCenter?.getTitle()).toBe("1 NEW NOTIFICATION");
            await notificationsCenter!.closeNotification(0);
            expect(((await notificationsCenter!.getNotifications()).length)).toBe(0);
            await notificationsCenter!.hide();
            expect((await driver.findElements(locator.notificationsCenter.isOpened)).length).toBe(0);
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Notifications center - Silent mode", async () => {
        try {
            let notificationsCenter = await new E2ENotificationsCenter().open();
            await notificationsCenter?.toggleSilentMode();
            expect(await new E2EStatusBar().isOnSilentMode()).toBe(true);
            await notificationsCenter?.hide();
            await dbTreeSection.openContextMenuAndSelect((localConn.basic as interfaces.IConnBasicMySQL)
                .schema!, [constants.copyToClipboard.exists, constants.copyToClipboard.name]);

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
            expect(notifications[0].message).toBe("The name was copied to the system clipboard");
            await notificationsCenter?.clearNotifications();
            await notificationsCenter?.hide();

            const connectionOverview = new E2EDatabaseConnectionOverview();
            await connectionOverview.moreActions(localConn.caption!, constants.editConnection);
            await DatabaseConnectionDialog.clearPassword();
            await connectionOverview.moreActions(localConn.caption!, constants.editConnection);
            await DatabaseConnectionDialog.clearPassword(); // it will trigger an error notification
            const notification = (await new E2EToastNotification().create())!;
            expect(notification.type).toBe("error");
            expect(notification.message).toContain("Error");
            notificationsCenter = await new E2ENotificationsCenter().open();
            notifications = await notificationsCenter!.getNotifications();
            expect(notifications[0].type).toBe("error");
            expect(notifications[0].message).toContain("Error");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});

describe("Communication Debugger", () => {

    let testFailed = false;

    beforeAll(async () => {
        await loadDriver(true);
        await driver.get(url);

        try {
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
            await driver.findElement(locator.e2eDebugger.toggle).click();
            await driver.wait(E2EDebugger.untilIsOpened(), constants.wait3seconds, "The Debugger page was not opened");
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_DEBUGGER");
            throw e;
        }
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

    it("Close tabs using tab context menu", async () => {
        try {
            const item1 = "_init_sqlite.js";
            const item2 = "_noop.js";
            const item3 = "_init_lib_item.js";

            const treeItem1 = await E2EDebugger.getTreeItem(item1);
            const treeItem2 = await E2EDebugger.getTreeItem(item2);
            const treeItem3 = await E2EDebugger.getTreeItem(item3);

            await driver.actions().doubleClick(treeItem1).perform();
            await driver.actions().doubleClick(treeItem2).perform();
            await driver.actions().doubleClick(treeItem3).perform();

            // Close
            const tabContainer = new E2ETabContainer();
            await tabContainer.selectTabContextMenu(item1, constants.close);
            expect(await tabContainer.tabExists(item1)).toBe(false);
            expect(await tabContainer.tabExists(item2)).toBe(true);
            expect(await tabContainer.tabExists(item3)).toBe(true);
            await driver.actions().doubleClick(treeItem1).perform();

            // Close others
            await tabContainer.selectTabContextMenu(item1, constants.closeOthers);
            expect(await tabContainer.tabExists(item1)).toBe(true);
            expect(await tabContainer.tabExists(item2)).toBe(false);
            expect(await tabContainer.tabExists(item3)).toBe(false);
            await driver.actions().doubleClick(treeItem2).perform();
            await driver.actions().doubleClick(treeItem3).perform();

            // Close to the right
            await tabContainer.selectTabContextMenu(item2, constants.closeToTheRight);
            expect(await tabContainer.tabExists(item1)).toBe(true);
            expect(await tabContainer.tabExists(item2)).toBe(true);
            expect(await tabContainer.tabExists(item3)).toBe(false);
            await driver.actions().doubleClick(treeItem3).perform();

            // Close all
            await tabContainer.selectTabContextMenu(item3, constants.closeAll);
            expect(await tabContainer.tabExists(item1)).toBe(false);
            expect(await tabContainer.tabExists(item2)).toBe(false);
            expect(await tabContainer.tabExists(item3)).toBe(false);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});

