/*
 * Copyright (c) 2022, 2023 Oracle and/or its affiliates.
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
import {
    By,
    EditorView,
    Workbench,
    until,
    TreeItem,
    CustomTreeSection,
    BottomBarPanel,
    error,
} from "vscode-extension-tester";

import { before, afterEach } from "mocha";
import { expect } from "chai";
import { driver, Misc } from "../lib/misc";
import { hostname } from "os";
import { IDBConnection, Database, IConnBasicMySQL } from "../lib/db";
import * as constants from "../lib/constants";

describe("MySQL REST Service", () => {

    if (!process.env.DBHOSTNAME) {
        throw new Error("Please define the environment variable DBHOSTNAME");
    }
    if (!process.env.DBUSERNAME) {
        throw new Error("Please define the environment variable DBUSERNAME");
    }
    if (!process.env.DBPASSWORD) {
        throw new Error("Please define the environment variable DBPASSWORD");
    }
    if (!process.env.DBPORT) {
        throw new Error("Please define the environment variable DBPORT");
    }
    if (!process.env.DBPORTX) {
        throw new Error("Please define the environment variable DBPORTX");
    }

    const globalBasicInfo: IConnBasicMySQL = {
        hostname: String(process.env.DBHOSTNAME),
        username: String(process.env.DBUSERNAME),
        port: Number(process.env.DBPORT),
        portX: Number(process.env.DBPORTX),
        schema: "sakila",
        password: String(process.env.DBPASSWORD),
    };

    const globalConn: IDBConnection = {
        dbType: "MySQL",
        caption: "conn",
        description: "Local connection",
        basic: globalBasicInfo,
    };

    let treeDBSection: CustomTreeSection;
    let treeGlobalConn: TreeItem | undefined;
    let treeRandomService: TreeItem;
    let treeMySQLRESTService: TreeItem;

    before(async function () {

        await Misc.loadDriver();

        try {
            await Misc.cleanCredentials();
            await driver.wait(Misc.extensionIsReady(), constants.explicitWait * 4, "Extension was not ready");
            await Misc.toggleBottomBar(false);
            await Misc.sectionFocus(constants.dbTreeSection);
            const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            globalConn.caption += randomCaption;
            treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await Database.createConnection(globalConn);
            expect(await Database.getWebViewConnection(globalConn.caption)).to.exist;
            const edView = new EditorView();
            await edView.closeAllEditors();

            treeGlobalConn = await Misc.getTreeElement(treeDBSection, globalConn.caption, true);
            await (await Misc.getActionButton(treeGlobalConn, "Connect to Database")).click();
            await Misc.switchToWebView();
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }

            const result = await Misc.execCmd("DROP SCHEMA IF EXISTS `mysql_rest_service_metadata`;",
                undefined, constants.explicitWait * 2);
            expect(result[0]).to.match(/OK/);
            await driver.switchTo().defaultContent();
            await new EditorView().closeAllEditors();

            await treeGlobalConn.expand();
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as IConnBasicMySQL).password);
            await Misc.openContexMenuItem(treeGlobalConn, "Configure Instance for MySQL REST Service Support");

            await Misc.verifyNotification(
                `Do you want to configure this instance for MySQL REST Service Support?`);
            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();
            await ntfs[ntfs.length - 1].takeAction("Yes");

            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as IConnBasicMySQL).password);
            await Misc.verifyNotification("MySQL REST Service configured successfully.", true);

            treeMySQLRESTService = await Misc.getTreeElement(treeDBSection, "MySQL REST Service");

            await Misc.openContexMenuItem(treeGlobalConn, "Show MySQL System Schemas");
            await Misc.getTreeElement(treeDBSection, "mysql_rest_service_metadata");

        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });


    describe("Main Context Menus", () => {

        let treeRouter: TreeItem;

        before(async function () {
            try {
                await Misc.cleanCredentials();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            await driver.switchTo().defaultContent();
            if (this.currentTest.state === "failed") {
                const notifications = await new Workbench().getNotifications();
                if (notifications.length > 0) {
                    await notifications[notifications.length - 1].expand();
                }

                await Misc.processFailure(this);

                if (notifications.length > 0) {
                    await notifications[notifications.length - 1].dismiss();
                }

            }

            await new EditorView().closeAllEditors();

        });

        after(async function () {
            try {
                await new BottomBarPanel().toggle(false);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Disable MySQL REST Service", async () => {

            await Misc.openContexMenuItem(treeMySQLRESTService, "Disable MySQL REST Service");
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as IConnBasicMySQL).password);
            await Misc.verifyNotification("MySQL REST Service configured successfully.", true);
            expect(await Misc.isMRSDisabled(treeMySQLRESTService)).to.equals(true);
        });

        it("Enable MySQL REST Service", async () => {

            await Misc.openContexMenuItem(treeMySQLRESTService, "Enable MySQL REST Service");
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as IConnBasicMySQL).password);
            await Misc.verifyNotification("MySQL REST Service configured successfully.", true);
            expect(await Misc.isMRSDisabled(treeMySQLRESTService)).to.equals(false);

        });

        it("Bootstrap Local MySQL Router Instance", async () => {

            expect(await Misc.isRouterInstalled(), "Please install MySQL Router manually").to.be.true;
            await Misc.openContexMenuItem(treeMySQLRESTService, "Bootstrap Local MySQL Router Instance");
            await Misc.waitForTerminalText("Please enter MySQL password for root:", constants.explicitWait * 2);
            await Misc.execOnTerminal((globalConn.basic as IConnBasicMySQL).password, constants.explicitWait * 2);
            await Misc.waitForTerminalText("JWT secret:", constants.explicitWait * 2);
            await Misc.execOnTerminal("1234", constants.explicitWait * 2);
            await Misc.waitForTerminalText("Once the MySQL Router is started", constants.explicitWait * 2);
            expect(await Misc.terminalHasErrors()).to.be.false;
            treeDBSection = await Misc.getSection(constants.dbTreeSection);
            treeRouter = await driver.wait(async () => {
                await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
                const children = await treeMySQLRESTService.getChildren();
                for (const child of children) {
                    if (((await child.getLabel()).includes(hostname()))) {
                        return child;
                    }
                }
            }, constants.explicitWait, `${hostname()} tree item was not found`);

        });

        it("Bootstrap a running Local MySQL Router Instance", async () => {

            expect(await Misc.isRouterInstalled(), "Please install MySQL Router manually").to.be.true;
            await Misc.openContexMenuItem(treeMySQLRESTService, "Bootstrap Local MySQL Router Instance");
            await Misc.verifyNotification("Do you want to rename the existing directory and proceed");
            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();
            await ntfs[ntfs.length - 1].takeAction("Yes");
            await Misc.waitForTerminalText("Please enter MySQL password for root:", constants.explicitWait * 2);
            await Misc.execOnTerminal((globalConn.basic as IConnBasicMySQL).password, constants.explicitWait * 2);
            await Misc.waitForTerminalText("JWT secret:", constants.explicitWait * 2);
            await Misc.execOnTerminal("1234", constants.explicitWait * 2);
            await Misc.waitForTerminalText("Once the MySQL Router is started", constants.explicitWait * 2);
            expect(await Misc.terminalHasErrors()).to.be.false;
            treeRouter = await driver.wait(async () => {
                await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
                const children = await treeMySQLRESTService.getChildren();
                for (const child of children) {
                    if (((await child.getLabel()).includes(hostname()))) {
                        return child;
                    }
                }
            }, constants.explicitWait, `${hostname()} tree item was not found`);

        });

        it("Start Local MySQL Router Instance", async () => {

            await Misc.openContexMenuItem(treeMySQLRESTService, "Start Local MySQL Router Instance");
            await Misc.waitForTerminalText(
                "Start accepting connections for routing routing:bootstrap_x_rw listening on",
                constants.explicitWait * 2);

            expect(await Misc.terminalHasErrors()).to.be.false;
            await driver.wait(async () => {
                treeRouter = await driver.wait(async () => {
                    await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
                    const children = await treeMySQLRESTService.getChildren();
                    for (const child of children) {
                        if (((await child.getLabel()).includes(hostname()))) {
                            return child;
                        }
                    }
                }, constants.explicitWait, `${hostname()} tree item was not found`);

                return (await Misc.isRouterActive(treeRouter)) === true;
            }, constants.explicitWait * 2, `${await treeRouter.getLabel()} did not became active`);

        });

        it("Stop Local MySQL Router Instance", async () => {

            await Misc.openContexMenuItem(treeMySQLRESTService, "Stop Local MySQL Router Instance");
            await Misc.waitForTerminalText(["mysqlrouter\\stop", "Unloading all plugins"], constants.explicitWait * 2);
            expect(await Misc.terminalHasErrors()).to.be.false;
            await driver.wait(async () => {
                treeRouter = await driver.wait(async () => {
                    await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
                    const children = await treeMySQLRESTService.getChildren();
                    for (const child of children) {
                        if (((await child.getLabel()).includes(hostname()))) {
                            return child;
                        }
                    }
                }, constants.explicitWait, `${hostname()} tree item was not found`);

                return (await Misc.isRouterActive(treeRouter)) === false;
            }, constants.explicitWait * 3, `${await treeRouter.getLabel()} did not became inactive`);

        });

        it("Browse the MySQL REST Service Documentation", async () => {

            await Misc.openContexMenuItem(treeMySQLRESTService, "Browse the MySQL REST Service Documentation", true);
            await driver.wait(async () => {
                const titles = await driver.findElements(By.css("h1"));
                for (const title of titles) {
                    if (await title.getText() === "MRS Developer's Guide") {
                        return true;
                    }
                }
            }, constants.explicitWait, "Could not find the title 'MRS Developer's Guide'");
        });

    });

    describe("Service Context Menus", () => {

        let treeAuthApp: TreeItem;
        let treeUser: TreeItem;
        let treeMySQLRESTSchema: TreeItem;
        const service = "Service2";

        before(async function () {
            try {
                await treeMySQLRESTService.expand();
                await Misc.openContexMenuItem(treeMySQLRESTService, "Add REST Service...", true);
                await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                    "DB Connection was not loaded");
                if (await Database.requiresCredentials()) {
                    await Database.setDBConnectionCredentials(globalConn);
                }
                await Database.setRestService(`/${service}`, "", "localhost", ["HTTP"], true, true);
                await driver.switchTo().defaultContent();
                await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
                treeRandomService = await Misc
                    .getTreeElement(treeDBSection, `/${service} (localhost)`, true);
                await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                    `${await treeDBSection.getTitle()} is still loading`);
                await driver.switchTo().defaultContent();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            await driver.switchTo().defaultContent();
            if (this.currentTest.state === "failed") {
                const notifications = await new Workbench().getNotifications();
                if (notifications.length > 0) {
                    await notifications[notifications.length - 1].expand();
                }

                await Misc.processFailure(this);

                if (notifications.length > 0) {
                    try {
                        await notifications[notifications.length - 1].dismiss();
                    } catch (e) {
                        //continue
                    }
                }
            }
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            await new EditorView().closeAllEditors();
        });

        it("Set as Current REST Service", async () => {

            await Misc.openContexMenuItem(treeRandomService, "Set as Current REST Service");
            await Misc.verifyNotification("The MRS service has been set as the new default service.", true);
            expect(await Misc.isDefaultItem(treeRandomService, "rest")).to.be.true;
        });

        it("Edit REST Service", async () => {

            await Misc.openContexMenuItem(treeRandomService, "Edit REST Service...", true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            await Database.setRestService(`/edited${service}`, "edited",
                "localhost", [], false, false);

            await driver.switchTo().defaultContent();
            await new EditorView().closeAllEditors();
            //await Misc.verifyNotification("The MRS service has been successfully updated.", true);
            treeRandomService = await Misc
                .getTreeElement(treeDBSection, `/edited${service} (localhost)`, true);

            await Misc.openContexMenuItem(treeRandomService, "Edit REST Service...", true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            const dialog = await driver.wait(until.elementLocated(By.id("mrsServiceDialog")),
                constants.explicitWait, "MRS Service dialog was not displayed");
            const inputServPath = await dialog.findElement(By.id("servicePath"));
            const inputComments = await dialog.findElement(By.id("comments"));
            const inputHost = await dialog.findElement(By.id("hostName"));
            const protocols = await dialog.findElements(By.css("#protocols label.tag"));
            const inputMrsEnabled = await dialog.findElement(By.id("enabled"));
            const mrsEnabledClasses = (await inputMrsEnabled.getAttribute("class")).split(" ");
            expect(protocols.length).to.equals(0);
            expect(await inputServPath.getAttribute("value")).equals(`/edited${service}`);
            expect(await inputComments.getAttribute("value")).equals("edited");
            expect(await inputHost.getAttribute("value")).equals("localhost");
            expect(mrsEnabledClasses).to.include("unchecked");

        });

        it("Add a REST Service Schema", async () => {

            const randomServiceLabel = await treeRandomService.getLabel();
            const treeSakila = await Misc.getTreeElement(treeDBSection, "sakila");
            await Misc.openContexMenuItem(treeSakila, "Add Schema to REST Service", true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            await Database.setRestSchema(`localhost/edited${service}|localhost/${service}`,
                "sakila", "/sakila", 1, true, true, "sakila");
            await driver.switchTo().defaultContent();
            //await Misc.verifyNotification("The MRS schema has been added successfully.", true);
            const treeService = await Misc.getTreeElement(treeDBSection, String(randomServiceLabel), true);
            await treeService.expand();
            await Misc.getTreeElement(treeDBSection, "/sakila (sakila)");

        });

        it("Edit REST Schema", async () => {

            const randomServiceLabel = await treeRandomService.getLabel();
            const treeService = await Misc.getTreeElement(treeDBSection, String(randomServiceLabel));
            await treeService.expand();
            treeMySQLRESTSchema = await Misc.getTreeElement(treeDBSection, "/sakila (sakila)");
            await Misc.openContexMenuItem(treeMySQLRESTSchema, "Edit REST Schema...", true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            await Database.setRestSchema(`localhost/edited${service}|localhost/${service}`,
                "sakila", "/edited", 5, false, false, "edited");
            await driver.switchTo().defaultContent();
            await new EditorView().closeAllEditors();
            //await Misc.verifyNotification("The MRS schema has been updated successfully.", true);
            const treeSakilaEdited = await Misc.getTreeElement(treeDBSection, "/edited (sakila)", true);
            await Misc.openContexMenuItem(treeSakilaEdited, "Edit REST Schema...", true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            const dialog = await driver.wait(until.elementLocated(By.id("mrsSchemaDialog")),
                constants.explicitWait, "MRS Schema dialog was not displayed");
            const inputSchemaName = await dialog.findElement(By.id("name"));
            const inputRequestPath = await dialog.findElement(By.id("requestPath"));
            const inputRequiresAuth = await dialog.findElement(By.id("requiresAuth"));
            const inputEnabled = await dialog.findElement(By.id("enabled"));
            const inputItemsPerPage = await dialog.findElement(By.css("#itemsPerPage"));
            const inputComments = await dialog.findElement(By.id("comments"));
            const inputRequiresAuthClasses = (await inputRequiresAuth.getAttribute("class")).split(" ");
            const inputEnabledClasses = (await inputEnabled.getAttribute("class")).split(" ");
            expect(await inputSchemaName.getAttribute("value")).equals("sakila");
            expect(await inputRequestPath.getAttribute("value")).equals("/edited");
            expect(inputRequiresAuthClasses).to.include("unchecked");
            expect(inputEnabledClasses).to.include("unchecked");
            expect(await inputItemsPerPage.getAttribute("value")).equals("5");
            expect(await inputComments.getAttribute("value")).equals("edited");

        });

        it.skip("Add Table to REST Service", async () => {

            const treeSakilaEdited = await Misc.getTreeElement(treeDBSection, "/edited (sakila)");
            await treeSakilaEdited.collapse();
            const treeSakila = await Misc.getTreeElement(treeDBSection, "sakila");
            await treeSakila.expand();
            const treeTables = await Misc.getTreeElement(treeDBSection, "Tables");
            await treeTables.expand();
            const treeActor = await Misc.getTreeElement(treeDBSection, "actor");
            await Misc.openContexMenuItem(treeActor, "Add Database Object to REST Service", true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            await Database.setRestObject(`localhost/edited${service}`);
            await driver.switchTo().defaultContent();
            await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
            await new EditorView().closeAllEditors();
            await treeSakilaEdited.expand();
            await Misc.getTreeElement(treeDBSection, "/actor (actor)");

        });

        it("Add New Authentication App", async () => {

            await Misc.openContexMenuItem(treeRandomService, "Add New Authentication App", true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            await Database.setAuthenticationApp(
                "MRS",
                undefined,
                "new app",
                "1234",
                "123",
                "testing",
                "guiTesting123",
                "empty",
                false,
                false);

            await driver.switchTo().defaultContent();
            //await Misc.verifyNotification("The MRS Authentication App has been added", true);
            await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
            await treeRandomService.expand();
            treeAuthApp = await Misc.getTreeElement(treeDBSection, "MRS (MRS)");

        });

        it("Add User", async () => {

            await Misc.openContexMenuItem(treeAuthApp, "Add User", true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            await Database.setUser(
                "gui",
                "testing",
                undefined,
                "as@as.com",
                undefined,
                false,
                "{\"user\": \"test\"}",
                "123",
                "guiMapped");


            await driver.switchTo().defaultContent();
            //await Misc.verifyNotification("The MRS User has been added", true);
            treeAuthApp = await Misc.getTreeElement(treeDBSection, "MRS (MRS)");
            await treeAuthApp.expand();
            treeDBSection = await Misc.getSection(constants.dbTreeSection);
            treeUser = await Misc.getTreeElement(treeDBSection, "gui", true);

        });

        it("Edit Authentication App", async () => {

            await Misc.openContexMenuItem(treeAuthApp, "Edit Authentication App", true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            await Database.setAuthenticationApp(
                undefined,
                "MRSedited",
                "edited app",
                "4321",
                "321",
                "editedTesting",
                "guiEdited123",
                "Full Access",
                true,
                true);

            await driver.switchTo().defaultContent();
            await new EditorView().closeAllEditors();
            //await Misc.verifyNotification("The MRS Authentication App has been updated", true);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            treeAuthApp = await Misc.getTreeElement(treeDBSection, "MRSedited (MRS)", true);
            await Misc.openContexMenuItem(treeAuthApp, "Edit Authentication App", true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            const dialog = await driver.wait(until.elementLocated(By.id("mrsAuthenticationAppDialog")),
                constants.explicitWait, "Authentication App dialog was not displayed");
            expect(await dialog.findElement(By.css("#authVendorName label")).getText()).to.equals("MRS");
            expect(await dialog.findElement(By.id("name")).getAttribute("value")).to.equals("MRSedited");
            expect(await dialog.findElement(By.id("description"))
                .getAttribute("value")).to.equals("edited app");
            expect(await dialog.findElement(By.id("accessToken")).getAttribute("value")).to.equals("4321");
            expect(await dialog.findElement(By.id("appId")).getAttribute("value")).to.equals("321");
            expect(await dialog.findElement(By.id("url")).getAttribute("value")).to.equals("editedTesting");
            expect(await dialog.findElement(By.id("urlDirectAuth"))
                .getAttribute("value")).to.equals("guiEdited123");
            expect(await dialog.findElement(By.css("#defaultRoleName label")).getText())
                .to.equals("Full Access");
            expect(await dialog.findElement(By.id("enabled"))
                .getAttribute("class")).to.include("checked valueEditor");
            expect(await dialog.findElement(By.id("limitToRegisteredUsers"))
                .getAttribute("class")).to.include("checked valueEditor");

        });

        it("Edit User", async () => {

            treeAuthApp = await Misc.getTreeElement(treeDBSection, "MRSedited (MRS)");
            await treeAuthApp.expand();
            treeUser = await Misc.getTreeElement(treeDBSection, "gui");
            await Misc.openContexMenuItem(treeUser, "Edit User", true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            await Database.setUser(
                "test",
                "editPass",
                undefined,
                "as1@as1.com",
                undefined,
                true,
                "{\"user\": \"edited\"}",
                "321",
                "editedMapped");
            await driver.switchTo().defaultContent();
            await new EditorView().closeAllEditors();
            treeGlobalConn = await Misc.getTreeElement(treeDBSection, globalConn.caption, true);
            //await Misc.verifyNotification(`The MRS User has been updated`, true);
            await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
            treeDBSection = await Misc.getSection(constants.dbTreeSection);
            treeUser = await Misc.getTreeElement(treeDBSection, "test");
            await Misc.openContexMenuItem(treeUser, "Edit User", true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            const dialog = await driver.wait(until.elementLocated(By.id("mrsUserDialog")),
                constants.explicitWait, "User dialog was not displayed");
            expect(await dialog.findElement(By.id("name")).getAttribute("value")).to.equals("test");
            expect(await dialog.findElement(By.css("#authApp label")).getText()).to.equals("MRSedited");
            expect(await dialog.findElement(By.id("email")).getAttribute("value")).to.equals("as1@as1.com");
            expect(await dialog.findElement(By.id("email")).getAttribute("value")).to.equals("as1@as1.com");
            expect(await dialog.findElement(By.css("#roles label")).getText()).to.equals("Full Access");
            expect(await dialog.findElement(By.id("loginPermitted"))
                .getAttribute("class")).to.include("checked valueEditor");
            expect(await dialog.findElement(By.id("appOptions")).getAttribute("value"))
                .to.equals("{\"user\":\"edited\"}");
            expect(await dialog.findElement(By.id("vendorUserId")).getAttribute("value")).to.equals("321");
            expect(await dialog.findElement(By.id("mappedUserId")).getAttribute("value")).to.equals("editedMapped");

        });

        it("MRS Service Documentation", async () => {

            await Misc.openContexMenuItem(treeRandomService, "MRS Service Documentation", true);
            await driver.findElement(By.id("rest-service-properties"));

        });

        it("Delete User", async () => {

            const userLabel = await treeUser.getLabel();
            treeUser = await Misc.getTreeElement(treeDBSection, userLabel);
            await Misc.openContexMenuItem(treeUser, "Delete User");
            await Misc.verifyNotification(
                `Are you sure the MRS user ${userLabel} should be deleted`);
            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();
            await ntfs[ntfs.length - 1].takeAction("Yes");
            //await Misc
            //    .verifyNotification(`The MRS User ${await treeUser.getLabel()} has been deleted`, true);

            await driver.wait(async () => {
                try {
                    await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
                    treeDBSection = await Misc.getSection(constants.dbTreeSection);

                    return (await treeDBSection.findItem(userLabel)) === undefined;
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, `user '${userLabel}' was not deleted`);
        });

        it("Delete Authentication App", async () => {

            const authAppLabel = await treeAuthApp.getLabel();
            treeAuthApp = await Misc.getTreeElement(treeDBSection, authAppLabel);
            await Misc.openContexMenuItem(treeAuthApp, "Delete Authentication App");
            await Misc.verifyNotification(
                `Are you sure the MRS authentication app ${authAppLabel.replace(" (MRS)", "")} should be deleted`);

            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();
            await ntfs[ntfs.length - 1].takeAction("Yes");
            await Misc.verifyNotification(`The MRS Authentication App MRSedited has been deleted`, true);

            await driver.wait(async () => {
                await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
                treeDBSection = await Misc.getSection(constants.dbTreeSection);

                return (await treeDBSection.findItem(authAppLabel)) === undefined;
            }, constants.explicitWait, `MRSedited (MRS) Authorization App was not deleted`);

        });

        it("Delete REST Schema", async () => {

            await treeRandomService.expand();
            const label = await treeMySQLRESTSchema.getLabel();
            await Misc.openContexMenuItem(treeMySQLRESTSchema, "Delete REST Schema...");
            await Misc.verifyNotification("Are you sure the MRS schema sakila should be deleted", false);
            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();
            await ntfs[ntfs.length - 1].takeAction("Yes");
            await Misc.verifyNotification("The MRS schema has been deleted successfully", true);

            await driver.wait(async () => {
                await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
                treeDBSection = await Misc.getSection(constants.dbTreeSection);

                return (await treeDBSection.findItem(label)) === undefined;
            }, constants.explicitWait, `${label} schema was not deleted`);

        });

        it("Delete REST Service", async () => {

            await Misc.openContexMenuItem(treeRandomService, "Delete REST Service...");
            const label = await treeRandomService.getLabel();
            const service = label.replace(" (localhost)", "");
            await Misc.verifyNotification(`Are you sure the MRS service ${String(service)} should be deleted`);
            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();
            await ntfs[ntfs.length - 1].takeAction("Yes");
            await Misc.verifyNotification("The MRS service has been deleted successfully", true);

            await driver.wait(async () => {
                await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
                treeDBSection = await Misc.getSection(constants.dbTreeSection);

                return (await treeDBSection.findItem(label)) === undefined;
            }, constants.explicitWait, `${label} Service was not deleted`);

        });

    });

    describe.skip("CRUD Operations", () => {

        let actorId: string;
        let treeRouter: TreeItem;
        const service = "Service2";
        const protocol = "https";
        let hostName = "localhost:8443";
        const schema = "sakila";
        const table = "actor";
        let response: Response;

        before(async function () {
            try {
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
                await Misc.cleanCredentials();
                treeDBSection = await Misc.getSection(constants.dbTreeSection);
                await treeMySQLRESTService.expand();
                await Misc.openContexMenuItem(treeMySQLRESTService, "Add REST Service...", true);
                await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                    "DB Connection was not loaded");
                if (await Database.requiresCredentials()) {
                    await Database.setDBConnectionCredentials(globalConn);
                }
                await Database.setRestService(`/${service}`, "", "localhost:8443", ["HTTP", "HTTPS"], true, true);
                await driver.switchTo().defaultContent();
                //await Misc.verifyNotification("The MRS service has been created.", true);
                treeRandomService = await Misc
                    .getTreeElement(treeDBSection, `/${service} (localhost:8443)`, true);

                await driver.wait(async () => {
                    const sakila = await Misc.getTreeElement(treeDBSection, "sakila");
                    await sakila.expand();

                    return (await sakila.isExpanded()) && (sakila.hasChildren());
                }, constants.explicitWait, "sakila tree item was not expanded");
                await (await Misc.getTreeElement(treeDBSection, "Tables")).expand();
                const treeActor = await Misc.getTreeElement(treeDBSection, "actor");
                await Misc.openContexMenuItem(treeActor, "Add Database Object to REST Service");
                let notification = "The database schema sakila has not been added to the REST Service.";
                notification += " Do you want to add the schema now?";
                await Misc.verifyNotification(notification);
                const workbench = new Workbench();
                const ntfs = await workbench.getNotifications();
                await ntfs[ntfs.length - 1].takeAction("Yes");
                await Misc.switchToWebView();
                await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                    "DB Connection was not loaded");
                if (await Database.requiresCredentials()) {
                    await Database.setDBConnectionCredentials(globalConn);
                }
                await Database.setRestObject(`${hostName}/${service}`, undefined, undefined,
                    ["CREATE", "READ", "UPDATE", "DELETE"], undefined, false);
                await driver.switchTo().defaultContent();
                await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
                await new EditorView().closeAllEditors();
                treeRouter = await driver.wait(async () => {
                    await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
                    const children = await treeMySQLRESTService.getChildren();
                    for (const child of children) {
                        if (((await child.getLabel()).includes(hostname()))) {
                            return child;
                        }
                    }
                }, constants.explicitWait, `${hostname()} tree item was not found`);
                if (!await Misc.isRouterActive(treeRouter)) {
                    await Misc.openContexMenuItem(treeMySQLRESTService, "Start Local MySQL Router Instance");
                    await Misc.waitForTerminalText(
                        "Start accepting connections for routing routing:bootstrap_x_rw listening on",
                        constants.explicitWait * 2);

                    await driver.wait(async () => {
                        await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();

                        return (await Misc.isRouterActive(treeRouter)) === true;
                    }, constants.explicitWait * 2, `Router did not became active`);
                }
                hostName = "127.0.0.1:8443";
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(function () {
            if (this.currentTest.state === "failed") {
                if (response) {
                    console.log("---CURL RESULT---");
                    console.log(response.status);
                    console.log(response.json());
                }
            }
            response = undefined;
        });

        after(async () => {
            await Misc.openContexMenuItem(treeMySQLRESTService, "Kill Local MySQL Router Instances");
        });

        it("Get schema metadata", async () => {
            response = await fetch(`${protocol}://${hostName}/${service}/${schema}/metadata-catalog`);
            const data = await response.json();
            expect(response.ok).to.be.true;
            expect(data.items).to.exist;
        });

        it("Get object metadata", async () => {
            response = await fetch(`${protocol}://${hostName}/${service}/${schema}/metadata-catalog/${table}`);
            const data = await response.json();
            expect(response.ok).to.be.true;
            expect(data.name).equals(`/${table}`);
            expect(data.primaryKey[0]).to.equals("actor_id");
        });

        it("Get object data", async () => {
            response = await fetch(`${protocol}://${hostName}/${service}/${schema}/${table}`);
            const data = await response.json();
            expect(response.ok).to.be.true;
            expect(data.items[0].first_name).to.equals("PENELOPE");
        });

        it("Insert table row", async () => {
            response = await fetch(`${protocol}://${hostName}/${service}/${schema}/${table}`, {
                method: "post",
                // eslint-disable-next-line @typescript-eslint/naming-convention
                body: JSON.stringify({ first_name: "Doctor", last_name: "Testing" }),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                headers: { "Content-Type": "application/json" },
            });
            const data = await response.json();
            expect(response.ok).to.be.true;
            actorId = data.actor_id;
            expect(data.actor_id).to.exist;
            expect(data.first_name).to.equals("Doctor");
            expect(data.last_name).to.equals("Testing");
            expect(data.last_update).to.exist;
        });

        it("Update table row", async () => {
            response = await fetch(`${protocol}://${hostName}/${service}/${schema}/${table}/${actorId}`, {
                method: "put",
                // eslint-disable-next-line @typescript-eslint/naming-convention
                body: JSON.stringify({ first_name: "Mister" }),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                headers: { "Content-Type": "application/json" },
            });
            const data = await response.json();
            expect(actorId).to.exist;
            expect(data.first_name).to.equals("Mister");
            expect(data.last_name).to.equals("Testing");
            expect(data.last_update).to.exist;
        });

        it("Delete table row", async () => {
            const query = `"actor_id":${actorId}`;
            response = await fetch(`${protocol}://${hostName}/${service}/${schema}/${table}?q={${query}}`,
                { method: "delete" });

            const data = await response.json();
            expect(response.ok).to.be.true;
            expect(data.itemsDeleted).to.equals(1);
        });

        it("Filter object data", async () => {
            const query = `"first_name":"PENELOPE"`;
            response = await fetch(`${protocol}://${hostName}/${service}/${schema}/${table}?q={${query}}`);
            const data = await response.json();
            expect(response.ok).to.be.true;
            expect(data.items).to.exist;
        });

    });

});
