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
    Condition,
} from "vscode-extension-tester";

import { before, afterEach } from "mocha";
import { expect } from "chai";
import {
    dbTreeSection,
    driver,
    explicitWait,
    Misc,
    isExtPrepared,
    dbMaxLevel,
} from "../lib/misc";

import { hostname } from "os";
import { IDBConnection, Database, IConnBasicMySQL } from "../lib/db";

import { curly, CurlyResult } from "node-libcurl";

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

        try {
            if (!isExtPrepared) {
                await Misc.prepareExtension();
            }

            await Misc.sectionFocus(dbTreeSection);
            await Misc.toggleBottomBar(false);
            const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            globalConn.caption += randomCaption;
            treeDBSection = await Misc.getSection(dbTreeSection);
            await Database.createConnection(globalConn);
            expect(await Database.getWebViewConnection(globalConn.caption)).to.exist;
            const edView = new EditorView();
            await edView.closeAllEditors();
            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            treeGlobalConn = await treeDBSection.findItem(globalConn.caption, dbMaxLevel);
            expect(treeGlobalConn).to.exist;

            await (await Misc.getActionButton(treeGlobalConn, "Connect to Database")).click();
            await Misc.switchToWebView();
            await Database.setPassword(globalConn);
            try {
                await Misc.setConfirmDialog(globalConn, "no");
            } catch (e) {
            // continue
            }

            const result = await Misc.execCmd("DROP SCHEMA IF EXISTS `mysql_rest_service_metadata`;",
                undefined, explicitWait*2);
            expect(result[0]).to.match(/OK/);
            await driver.switchTo().defaultContent();
            await new EditorView().closeAllEditors();

            await treeGlobalConn.expand();
            await Misc.setInputPassword((globalConn.basic as IConnBasicMySQL).password);
            await Misc.selectContextMenuItem(treeGlobalConn, "Configure Instance for MySQL REST Service Support");

            await Misc.verifyNotification(
                `Do you want to configure this instance for MySQL REST Service Support?`);
            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();
            await ntfs[ntfs.length - 1].takeAction("Yes");

            await Misc.setInputPassword((globalConn.basic as IConnBasicMySQL).password);
            await Misc.verifyNotification("MySQL REST Service configured successfully.", true);

            await driver.wait(async () => {
                treeMySQLRESTService = await treeDBSection.findItem("MySQL REST Service", dbMaxLevel);

                return treeMySQLRESTService;
            }, explicitWait, `MySQL REST Service is not on the tree`);

            await Misc.selectContextMenuItem(treeGlobalConn, "Show MySQL System Schemas");
            await driver.wait(treeDBSection.findItem("mysql_rest_service_metadata", dbMaxLevel),
                explicitWait, `mysql_rest_service_metadata is not on the tree`);

        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });


    describe("Main Context Menus", () => {

        let treeRouter: TreeItem;
        const service = "Service1";

        before(async function () {
            try {
                await Misc.selectContextMenuItem(treeMySQLRESTService, "Add REST Service...");
                await Misc.switchToWebView();
                await Database.setRestService(`/${service}`, "", "localhost", ["HTTP"], true, true);
                await driver.switchTo().defaultContent();
                await Misc.verifyNotification("The MRS service has been created.", true);
                await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
                await treeMySQLRESTService.expand();
                treeRandomService = await treeDBSection.findItem(`/${service}`, dbMaxLevel);
                expect(treeRandomService).to.exist;
                await driver.switchTo().defaultContent();
            } catch (e) {
                await Misc.processFailure(this);
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

            await Misc.selectContextMenuItem(treeMySQLRESTService, "Disable MySQL REST Service");

            await Misc.setInputPassword((globalConn.basic as IConnBasicMySQL).password);

            await Misc.verifyNotification("MySQL REST Service configured successfully.", true);

            expect(await Misc.isMRSDisabled(treeMySQLRESTService)).to.equals(true);
        });

        it("Enable MySQL REST Service", async () => {

            await Misc.selectContextMenuItem(treeMySQLRESTService, "Enable MySQL REST Service");

            await Misc.setInputPassword((globalConn.basic as IConnBasicMySQL).password);

            await Misc.verifyNotification("MySQL REST Service configured successfully.", true);

            expect(await Misc.isMRSDisabled(treeMySQLRESTService)).to.equals(false);

        });

        it("Bootstrap Local MySQL Router Instance", async () => {

            expect(await Misc.isRouterInstalled(), "Please install MySQL Router manually").to.be.true;

            await Misc.selectContextMenuItem(treeMySQLRESTService, "Bootstrap Local MySQL Router Instance");

            await Misc.waitForTerminalText("Please enter MySQL password for root:", explicitWait*2);

            await Misc.execOnTerminal((globalConn.basic as IConnBasicMySQL).password, explicitWait*2);

            await Misc.waitForTerminalText("JWT secret:", explicitWait*2);

            await Misc.execOnTerminal("1234", explicitWait*2);

            await Misc.waitForTerminalText("Once the MySQL Router is started", explicitWait*2);

            expect(await Misc.terminalHasErrors()).to.be.false;

            await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();

            treeDBSection = await Misc.getSection(dbTreeSection);

            treeRouter = await treeDBSection.findItem(hostname());

            expect(treeRouter).to.exist;

        });

        it("Bootstrap a running Local MySQL Router Instance", async () => {

            expect(await Misc.isRouterInstalled(), "Please install MySQL Router manually").to.be.true;

            await Misc.selectContextMenuItem(treeMySQLRESTService, "Bootstrap Local MySQL Router Instance");

            await Misc.verifyNotification("Do you want to rename the existing directory and proceed");

            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();
            await ntfs[ntfs.length - 1].takeAction("Yes");


            await Misc.waitForTerminalText("Please enter MySQL password for root:", explicitWait*2);

            await Misc.execOnTerminal((globalConn.basic as IConnBasicMySQL).password, explicitWait*2);

            await Misc.waitForTerminalText("JWT secret:", explicitWait*2);

            await Misc.execOnTerminal("1234", explicitWait*2);

            await Misc.waitForTerminalText("Once the MySQL Router is started", explicitWait*2);

            expect(await Misc.terminalHasErrors()).to.be.false;

            await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();

            treeRouter = await treeDBSection.findItem(hostname());

            expect(treeRouter).to.exist;

        });

        it("Start Local MySQL Router Instance", async () => {

            await Misc.selectContextMenuItem(treeMySQLRESTService, "Start Local MySQL Router Instance");

            await Misc.waitForTerminalText(
                "Start accepting connections for routing routing:bootstrap_x_rw listening on",
                explicitWait*2);

            expect(await Misc.terminalHasErrors()).to.be.false;

            await driver.wait(async () => {

                await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();

                return (await Misc.isRouterActive(treeRouter)) === true;

            }, explicitWait*2, `${await treeRouter.getLabel()} did not became active`);

        });

        it("Stop Local MySQL Router Instance", async () => {

            await Misc.selectContextMenuItem(treeMySQLRESTService, "Stop Local MySQL Router Instance");


            await Misc.waitForTerminalText("mysqlrouter\\stop", explicitWait*2);

            expect(await Misc.terminalHasErrors()).to.be.false;

            await driver.wait(async () => {

                await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();

                return (await Misc.isRouterActive(treeRouter)) === false;

            }, explicitWait*3, `${await treeRouter.getLabel()} did not became inactive`);

        });

        it("Browse the MySQL REST Service Documentation", async () => {

            await Misc.selectContextMenuItem(treeMySQLRESTService, "Browse the MySQL REST Service Documentation");

            await new EditorView().openEditor("MRS Docs");

            await Misc.switchToWebView();
            const titles = await driver.findElements(By.css("h1"));

            for (const title of titles) {
                if (await title.getText() === "MRS Developer's Guide") {
                    return true;
                }
            }

            throw new Error("Could not find the title 'MRS Developer's Guide'");

        });

    });

    describe("Service Context Menus", () => {

        let treeAuthApp: TreeItem;
        let treeUser: TreeItem;
        let treeMySQLRESTSchema: TreeItem;
        const service = "Service2";

        before(async function () {
            try {
                await Misc.selectContextMenuItem(treeMySQLRESTService, "Add REST Service...");
                await Misc.switchToWebView();
                await Database.setRestService(`/${service}`, "", "localhost", ["HTTP"], true, true);
                await driver.switchTo().defaultContent();
                await Misc.verifyNotification("The MRS service has been created.", true);
                await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
                await treeMySQLRESTService.expand();
                treeRandomService = await treeDBSection
                    .findItem(`/${service} (localhost)`, dbMaxLevel);

                expect(treeRandomService).to.exist;
                await driver.switchTo().defaultContent();
            } catch (e) {
                await Misc.processFailure(this);
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
            await new EditorView().closeAllEditors();
        });

        it("Set as Current REST Service", async () => {

            await Misc.selectContextMenuItem(treeRandomService, "Set as Current REST Service");

            await Misc.verifyNotification("The MRS service has been set as the new default service.", true);

            expect(await Misc.isDefaultItem(treeRandomService, "rest")).to.be.true;
        });

        it("Edit REST Service", async () => {

            await Misc.selectContextMenuItem(treeRandomService, "Edit REST Service...");

            await Misc.switchToWebView();

            await Database.setRestService(`/edited${service}`, "edited",
                "localhost", [], false, false);

            await driver.switchTo().defaultContent();

            await Misc.verifyNotification("The MRS service has been successfully updated.", true);

            await driver.wait(async () => {
                await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
                treeRandomService = await treeDBSection
                    .findItem(`/edited${service} (localhost)`);

                return treeRandomService;
            }, 3000, `/edited${service} (localhost) was not displayed on the tree`);

            await Misc.selectContextMenuItem(treeRandomService, "Edit REST Service...");

            await Misc.switchToWebView();

            const dialog = await driver.wait(until.elementLocated(By.id("mrsServiceDialog")),
                explicitWait, "MRS Service dialog was not displayed");
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

            const treeSakila = await treeDBSection.findItem("sakila");

            await Misc.selectContextMenuItem(treeSakila, "Add Schema to REST Service");

            await Misc.switchToWebView();

            await Database.setRestSchema(`localhost/edited${service}`,"sakila", "/sakila", 1, true, true, "sakila");

            await driver.switchTo().defaultContent();

            await Misc.verifyNotification("The MRS schema has been added successfully.", true);

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            const treeService = await treeDBSection.findItem(String(randomServiceLabel));

            await treeService.expand();

            await driver.wait(new Condition("", async () => {
                return (await treeDBSection.findItem("/sakila (sakila)", dbMaxLevel)) !== undefined;
            }), explicitWait, `'/sakila (sakila)' does not exist on the tree`);

        });

        it("Edit REST Schema", async () => {

            const randomServiceLabel = await treeRandomService.getLabel();

            const treeService = await treeDBSection.findItem(String(randomServiceLabel));

            await treeService.expand();

            treeMySQLRESTSchema = await treeDBSection.findItem("/sakila (sakila)", dbMaxLevel);

            await Misc.selectContextMenuItem(treeMySQLRESTSchema, "Edit REST Schema...");

            await Misc.switchToWebView();

            await Database.setRestSchema(`localhost/edited${service}`, "sakila", "/edited", 5, false, false, "edited");

            await driver.switchTo().defaultContent();

            await Misc.verifyNotification("The MRS schema has been updated successfully.", true);

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            const treeSakilaEdited = await treeDBSection.findItem("/edited (sakila)");

            await Misc.selectContextMenuItem(treeSakilaEdited, "Edit REST Schema...");

            await Misc.switchToWebView();

            const dialog = await driver.wait(until.elementLocated(By.id("mrsSchemaDialog")),
                explicitWait, "MRS Schema dialog was not displayed");

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

        it("Add Table to REST Service", async () => {

            const treeSakilaEdited = await treeDBSection.findItem("/edited (sakila)");
            await treeSakilaEdited.collapse();

            const treeSakila = await treeDBSection.findItem("sakila");
            await treeSakila.expand();

            const treeTables = await treeDBSection.findItem("Tables");
            await treeTables.expand();

            const treeActor = await treeDBSection.findItem("actor");

            await Misc.selectContextMenuItem(treeActor, "Add Database Object to REST Service");

            await Misc.switchToWebView();

            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");
            await Database.setPassword(globalConn);
            try {
                await Misc.setConfirmDialog(globalConn, "no");
            } catch (e) {
                // continue
            }

            await Database.setRestObject(`localhost/edited${service}`);

            await driver.switchTo().defaultContent();

            await new EditorView().closeAllEditors();

            await treeSakilaEdited.expand();

            expect(await treeDBSection.findItem("/actor (actor)")).to.exist;

        });

        it("Add New Authentication App", async () => {

            await Misc.selectContextMenuItem(treeRandomService, "Add New Authentication App");

            await Misc.switchToWebView();

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

            await Misc.verifyNotification("The MRS Authentication App has been added", true);

            await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();

            await treeRandomService.expand();

            treeAuthApp = await treeDBSection.findItem("MRS (MRS)");

            expect(treeAuthApp).to.exist;

        });

        it("Add User", async () => {

            await Misc.selectContextMenuItem(treeAuthApp, "Add User");

            await Misc.switchToWebView();

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

            await Misc.verifyNotification("The MRS User has been added", true);

            await (await Misc.getActionButton(treeGlobalConn ,"Reload Database Information")).click();

            await treeAuthApp.expand();

            treeDBSection = await Misc.getSection(dbTreeSection);

            treeUser = await treeDBSection.findItem("gui");

            expect(treeUser).to.exist;

        });

        it("Edit Authentication App", async () => {

            await Misc.selectContextMenuItem(treeAuthApp, "Edit Authentication App");

            await Misc.switchToWebView();

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

            await Misc.verifyNotification("The MRS Authentication App has been updated", true);

            await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();

            treeAuthApp = await treeDBSection.findItem("MRSedited (MRS)");

            expect(treeAuthApp).to.exist;

            await Misc.selectContextMenuItem(treeAuthApp, "Edit Authentication App");

            await Misc.switchToWebView();
            const dialog = await driver.wait(until.elementLocated(By.id("mrsAuthenticationAppDialog")),
                explicitWait, "Authentication App dialog was not displayed");
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

            treeAuthApp = await treeDBSection.findItem("MRSedited (MRS)");

            await treeAuthApp.expand();

            treeUser = await treeDBSection.findItem("gui");

            await Misc.selectContextMenuItem(treeUser, "Edit User");

            await Misc.switchToWebView();

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

            await Misc.verifyNotification(`The MRS User has been updated`, true);

            await (await Misc.getActionButton(treeGlobalConn ,"Reload Database Information")).click();

            treeDBSection = await Misc.getSection(dbTreeSection);

            treeUser = await treeDBSection.findItem("test");

            expect(treeUser).to.exist;

            await Misc.selectContextMenuItem(treeUser, "Edit User");

            await Misc.switchToWebView();

            const dialog = await driver.wait(until.elementLocated(By.id("mrsUserDialog")),
                explicitWait, "User dialog was not displayed");
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

            await Misc.selectContextMenuItem(treeRandomService, "MRS Service Documentation");

            await new EditorView().openEditor("MRS Docs");

            await Misc.switchToWebView();

            await driver.findElement(By.id("rest-service-properties"));

        });

        it("Delete User", async () => {

            treeUser = await treeDBSection.findItem("test");

            await Misc.selectContextMenuItem(treeUser, "Delete User");

            await Misc.verifyNotification(
                `Are you sure the MRS user ${await treeUser.getLabel()} should be deleted`);

            const workbench = new Workbench();

            const ntfs = await workbench.getNotifications();

            await ntfs[ntfs.length - 1].takeAction("Yes");

            await Misc
                .verifyNotification(`The MRS User ${await treeUser.getLabel()} has been deleted`, true);

            await (await Misc.getActionButton(treeGlobalConn ,"Reload Database Information")).click();

            treeDBSection = await Misc.getSection(dbTreeSection);

            expect(await treeDBSection.findItem("test")).to.not.exist;

        });

        it("Delete Authentication App", async () => {

            treeAuthApp = await treeDBSection.findItem("MRSedited (MRS)");

            await Misc.selectContextMenuItem(treeAuthApp, "Delete Authentication App");

            await Misc.verifyNotification(
                `Are you sure the MRS authentication app ${(await treeAuthApp.getLabel())
                    .replace(" (MRS)", "")} should be deleted`);

            const workbench = new Workbench();

            const ntfs = await workbench.getNotifications();

            await ntfs[ntfs.length - 1].takeAction("Yes");

            await Misc.verifyNotification(`The MRS Authentication App MRSedited has been deleted`, true);

            await (await Misc.getActionButton(treeGlobalConn ,"Reload Database Information")).click();

            treeDBSection = await Misc.getSection(dbTreeSection);

            expect(await treeDBSection.findItem("MRSedited (MRS)")).to.not.exist;

        });

        it("Delete REST Schema", async () => {

            await treeRandomService.expand();

            const label = await treeMySQLRESTSchema.getLabel();

            await Misc.selectContextMenuItem(treeMySQLRESTSchema, "Delete REST Schema...");

            await Misc.verifyNotification("Are you sure the MRS schema sakila should be deleted", false);

            const workbench = new Workbench();

            const ntfs = await workbench.getNotifications();

            await ntfs[ntfs.length - 1].takeAction("Yes");

            await Misc.verifyNotification("The MRS schema has been deleted successfully", true);

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            treeDBSection = await Misc.getSection(dbTreeSection);

            expect(await treeDBSection.findItem(label)).to.not.exist;

        });

        it("Delete REST Service", async () => {

            await Misc.selectContextMenuItem(treeRandomService, "Delete REST Service...");

            const label = await treeRandomService.getLabel();

            const service = label.replace(" (localhost)", "");

            await Misc.verifyNotification(`Are you sure the MRS service ${String(service)} should be deleted`);

            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();

            await ntfs[ntfs.length - 1].takeAction("Yes");

            await Misc.verifyNotification("The MRS service has been deleted successfully", true);

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            treeDBSection = await Misc.getSection(dbTreeSection);

            expect(await treeDBSection.findItem(label)).to.not.exist;

        });

    });

    describe("CRUD Operations", () => {

        let actorId: string;
        let treeRouter: TreeItem;
        const service = "Service3";
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const sslVerifier = {SSL_VERIFYPEER: 0};
        const protocol = "https";
        const hostName = "localhost:8443";
        const schema = "sakila";
        const table = "actor";
        let result: CurlyResult;

        before(async function () {
            try {
                treeDBSection = await Misc.getSection(dbTreeSection);
                await Misc.selectContextMenuItem(treeMySQLRESTService, "Add REST Service...");
                await Misc.switchToWebView();
                await Database.setRestService(`/${service}`, "", "localhost:8443", ["HTTP", "HTTPS"], true, true);
                await driver.switchTo().defaultContent();
                await Misc.verifyNotification("The MRS service has been created.", true);
                await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
                await treeMySQLRESTService.expand();
                treeRandomService = await treeDBSection
                    .findItem(`/${service} (localhost:8443)`, dbMaxLevel);
                expect(treeRandomService).to.exist;

                await (await treeDBSection.findItem("sakila")).expand();
                await (await treeDBSection.findItem("Tables")).expand();
                const treeActor = await treeDBSection.findItem("actor");
                await Misc.selectContextMenuItem(treeActor, "Add Database Object to REST Service");
                let notification = "The database schema sakila has not been added to the REST Service.";
                notification += " Do you want to add the schema now?";
                await Misc.verifyNotification(notification);
                const workbench = new Workbench();
                const ntfs = await workbench.getNotifications();
                await ntfs[ntfs.length - 1].takeAction("Yes");
                await Misc.switchToWebView();
                await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");
                await Database.setPassword(globalConn);
                    try {
                        await Misc.setConfirmDialog(globalConn, "no");
                    } catch (e) {
                        // continue
                    }
                await Database.setRestObject(`${hostName}/${service}`,undefined, undefined,
                    ["CREATE", "READ", "UPDATE", "DELETE"], undefined, false);
                await driver.switchTo().defaultContent();

                await new EditorView().closeAllEditors();

                treeRouter = await treeDBSection.findItem(hostname());
                expect(treeRouter).to.exist;
                if (!await Misc.isRouterActive(treeRouter)) {
                    await Misc.selectContextMenuItem(treeMySQLRESTService, "Start Local MySQL Router Instance");
                    await Misc.waitForTerminalText(
                        "Start accepting connections for routing routing:bootstrap_x_rw listening on",
                        explicitWait*2);

                    await driver.wait(async () => {
                        await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();

                        return (await Misc.isRouterActive(treeRouter)) === true;
                    }, explicitWait*2, `Router did not became active`);
                }
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(function () {
            if (this.currentTest.state === "failed") {
                if (result) {
                    console.log("---CURL RESULT---");
                    console.log(result.statusCode);
                    console.log(result.data);
                }
            }
            result = undefined;
        });

        after(async () => {
            await Misc.selectContextMenuItem(treeMySQLRESTService, "Kill Local MySQL Router Instances");
        });

        it("Get schema metadata", async () => {
            result = await curly.get(`${protocol}://${hostName}/${service}/${schema}/metadata-catalog`, sslVerifier);
            expect(result.statusCode).to.equals(200);
            expect(result.data.items).to.exist;
        });

        it("Get object metadata", async () => {
            const url = `${protocol}://${hostName}/${service}/${schema}/metadata-catalog/${table}`;
            result = await curly.get(url, sslVerifier);
            expect(result.statusCode).to.equals(200);
            expect(result.data.name).to.equals(`/${table}`);
            expect(result.data.primaryKey[0]).to.equals("actor_id");
        });

        it("Get object data", async () => {
            result = await curly.get(`${protocol}://${hostName}/${service}/${schema}/${table}`, sslVerifier);
            expect(result.statusCode).to.equals(200);
            expect(result.data.items[0].first_name).to.equals("PENELOPE");
        });

        it("Insert table row", async () => {
            result = await curly.post(`${protocol}://${hostName}/${service}/${schema}/${table}`, {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                postFields: JSON.stringify({ first_name: "Doctor", last_name: "Testing" }),
                httpHeader: [
                    "Content-Type: application/json",
                    "Accept: application/json",
                ],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                SSL_VERIFYPEER: 0,
            });

            expect(result.statusCode).to.equals(200);
            actorId = result.data.actor_id;
            expect(result.data.actor_id).to.exist;
            expect(result.data.first_name).to.equals("Doctor");
            expect(result.data.last_name).to.equals("Testing");
            expect(result.data.last_update).to.exist;

            result = await curly.get(result.data.links[0].href as string, sslVerifier);
            expect(result.statusCode).to.equals(200);
        });

        it("Update table row", async () => {
            result = await curly.put(`${protocol}://${hostName}/${service}/${schema}/${table}/${actorId}`, {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                postFields: JSON.stringify({first_name: "Mister"}),
                httpHeader: [
                    "Content-Type: application/json",
                    "Accept: application/json",
                ],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                SSL_VERIFYPEER: 0,
            });

            expect(result.statusCode).to.equals(200);
            expect(actorId).to.exist;
            expect(result.data.first_name).to.equals("Mister");
            expect(result.data.last_name).to.equals("Testing");
            expect(result.data.last_update).to.exist;

            result = await curly.get(result.data.links[0].href as string, sslVerifier);
            expect(result.statusCode).to.equals(200);
        });

        it("Delete table row", async () => {
            const query = `"actor_id":${actorId}`;
            result = await curly
                .delete(`${protocol}://${hostName}/${service}/${schema}/${table}?q={${query}}`, sslVerifier);

            expect(result.statusCode).to.equals(200);
            expect(result.data.itemsDeleted).to.equals(1);
        });

        it("Filter object data", async () => {
            const query = `"first_name":"PENELOPE"`;
            result = await curly
                .get(`${protocol}://${hostName}/${service}/${schema}/${table}?q={${query}}`, sslVerifier);
            expect(result.statusCode).to.equals(200);
            expect(result.data.items).to.exist;
        });

    });

});
