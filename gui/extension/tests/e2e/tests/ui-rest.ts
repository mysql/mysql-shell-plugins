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
    BottomBarPanel,
    error,
} from "vscode-extension-tester";

import { before, afterEach } from "mocha";
import { expect } from "chai";
import { driver, Misc } from "../lib/misc";
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

    before(async function () {

        await Misc.loadDriver();
        try {
            await Misc.cleanCredentials();
            await driver.wait(Misc.extensionIsReady(), constants.extensionReadyWait, "Extension was not ready");
            await Misc.toggleBottomBar(false);
            await Misc.sectionFocus(constants.dbTreeSection);
            const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            globalConn.caption += randomCaption;
            await Database.createConnection(globalConn);
            expect(await Database.getWebViewConnection(globalConn.caption)).to.exist;
            const edView = new EditorView();
            await edView.closeAllEditors();
            const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
            await (await Misc.getActionButton(treeGlobalConn, constants.openNewConnection)).click();
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
            await treeGlobalConn.expand();
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as IConnBasicMySQL).password);
            await Misc.openContexMenuItem(treeGlobalConn, constants.configureREST);
            await Misc.verifyNotification(
                `Do you want to configure this instance for MySQL REST Service Support?`);

            await driver.wait(async () => {
                try {
                    const workbench = new Workbench();
                    const ntfs = await workbench.getNotifications();
                    await ntfs[ntfs.length - 1].takeAction("Yes");

                    return true;
                } catch (e) {
                    if (!(e instanceof error.ElementNotInteractableError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, "Could not click on the Configure instance notification button");

            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as IConnBasicMySQL).password);
            await Misc.verifyNotification("MySQL REST Service configured successfully.");
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            await Misc.openContexMenuItem(treeGlobalConn, constants.showSystemSchemas);
            await Misc.getTreeElement(constants.dbTreeSection, "mysql_rest_service_metadata");

        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });


    describe("Main Context Menus", () => {

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

            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
            await Misc.openContexMenuItem(treeMySQLRESTService, constants.disableRESTService);
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as IConnBasicMySQL).password);
            await Misc.verifyNotification("MySQL REST Service configured successfully.");
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            expect(await Misc.isMRSDisabled(treeMySQLRESTService)).to.equals(true);
        });

        it("Enable MySQL REST Service", async () => {

            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
            await Misc.openContexMenuItem(treeMySQLRESTService, constants.enableRESTService);
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as IConnBasicMySQL).password);
            await Misc.verifyNotification("MySQL REST Service configured successfully.");
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            expect(await Misc.isMRSDisabled(treeMySQLRESTService)).to.equals(false);

        });

        it("Bootstrap Local MySQL Router Instance", async () => {

            expect(await Misc.isRouterInstalled(), "Please install MySQL Router manually").to.be.true;
            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            await treeMySQLRESTService.expand();
            await Misc.openContexMenuItem(treeMySQLRESTService, constants.bootstrapRouter);
            await Misc.waitForTerminalText("Please enter MySQL password for root:", constants.explicitWait * 2);
            await Misc.execOnTerminal((globalConn.basic as IConnBasicMySQL).password, constants.explicitWait * 2);
            await Misc.waitForTerminalText("JWT secret:", constants.explicitWait * 2);
            await Misc.execOnTerminal("1234", constants.explicitWait * 2);
            await Misc.waitForTerminalText("Once the MySQL Router is started", constants.explicitWait * 2);
            expect(await Misc.terminalHasErrors()).to.be.false;
            await Misc.getRouter(globalConn.caption);

        });

        it("Bootstrap a running Local MySQL Router Instance", async () => {

            expect(await Misc.isRouterInstalled(), "Please install MySQL Router manually").to.be.true;
            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            await treeMySQLRESTService.expand();
            await Misc.openContexMenuItem(treeMySQLRESTService, constants.bootstrapRouter);
            await Misc.verifyNotification("Do you want to rename the existing directory and proceed");
            await driver.wait(async () => {
                try {
                    const workbench = new Workbench();
                    const ntfs = await workbench.getNotifications();
                    await ntfs[ntfs.length - 1].takeAction("Yes");

                    return true;
                } catch (e) {
                    if (!(e instanceof error.ElementNotInteractableError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, "Could not click on notification button");

            await Misc.waitForTerminalText("Please enter MySQL password for root:", constants.explicitWait * 2);
            await Misc.execOnTerminal((globalConn.basic as IConnBasicMySQL).password, constants.explicitWait * 2);
            await Misc.waitForTerminalText("JWT secret:", constants.explicitWait * 2);
            await Misc.execOnTerminal("1234", constants.explicitWait * 2);
            await Misc.waitForTerminalText("Once the MySQL Router is started", constants.explicitWait * 2);
            expect(await Misc.terminalHasErrors()).to.be.false;
            await Misc.getRouter(globalConn.caption);

        });

        it("Start Local MySQL Router Instance", async () => {

            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            await treeMySQLRESTService.expand();
            await Misc.openContexMenuItem(treeMySQLRESTService, constants.startRouter);
            await Misc.waitForTerminalText(
                "Start accepting connections for routing routing:bootstrap_x_rw listening on",
                constants.explicitWait * 2);

            expect(await Misc.terminalHasErrors()).to.be.false;
            await driver.wait(async () => {
                const treeRouter = await Misc.getRouter(globalConn.caption);

                return (await Misc.isRouterActive(treeRouter)) === true;
            }, constants.explicitWait * 2, `Router did not became active`);

        });

        it("Stop Local MySQL Router Instance", async () => {

            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            await Misc.openContexMenuItem(treeMySQLRESTService, constants.stopRouter);
            await Misc.waitForTerminalText(["mysqlrouter\\stop", "Unloading all plugins"], constants.explicitWait * 2);
            expect(await Misc.terminalHasErrors()).to.be.false;
            await driver.wait(async () => {
                const treeRouter = await Misc.getRouter(globalConn.caption);

                return (await Misc.isRouterActive(treeRouter)) === false;

            }, constants.explicitWait * 3, `Router did not became inactive`);
        });

        it("Browse the MySQL REST Service Documentation", async () => {

            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            await Misc.openContexMenuItem(treeMySQLRESTService, constants.browseRESTDocs, true);
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

        let service = "Service2";

        before(async function () {
            try {
                const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
                await treeMySQLRESTService.expand();
                await Misc.openContexMenuItem(treeMySQLRESTService, constants.addRESTService, true);
                await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                    "DB Connection was not loaded");
                if (await Database.requiresCredentials()) {

                    await Database.setDBConnectionCredentials(globalConn);
                }
                await Database.setRestService(`/${service}`, "", "localhost", ["HTTP"], true, true);
                await driver.switchTo().defaultContent();
                await Misc.verifyNotification("The MRS service has been created", true);
                await Misc.getTreeElement(constants.dbTreeSection, `/${service} (localhost)`, true);
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
                        // continue
                    }
                }
            }

            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
        });

        it("Set as Current REST Service", async () => {

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `/${service} (localhost)`, true);
            await Misc.openContexMenuItem(treeRandomService, constants.setAsCurrentREST, undefined, true);
            await Misc.verifyNotification("The MRS service has been set as the new default service.");
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            await driver.wait(async () => {
                return Misc.isDefaultItem(treeRandomService, "rest");
            }, constants.explicitWait, "REST Service tree item did not became default");
        });

        it("Edit REST Service", async () => {

            let treeRandomService = await Misc.getTreeElement(constants.dbTreeSection, `/${service} (localhost)`, true);
            await Misc.openContexMenuItem(treeRandomService, constants.editRESTService, true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            await Database.setRestService(`/edited${service}`, "edited",
                "localhost", [], false, false);

            await driver.switchTo().defaultContent();
            await Misc.verifyNotification("The MRS service has been successfully updated.");
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);

            await new EditorView().closeAllEditors();
            treeRandomService = await Misc
                .getTreeElement(constants.dbTreeSection, `/edited${service} (localhost)`, true);

            await Misc.openContexMenuItem(treeRandomService, constants.editRESTService, true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            const dialog = await driver.wait(until.elementLocated(By.id("mrsServiceDialog")),
                constants.explicitWait, "MRS Service dialog was not displayed");
            try {
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
            } finally {
                await dialog.findElement(By.id("closeButton")).click();
            }


        });

        it("Add a REST Service Schema", async () => {

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `/edited${service} (localhost)`, true);
            const randomServiceLabel = await treeRandomService.getLabel();
            const treeSakila = await Misc.getTreeElement(constants.dbTreeSection, "sakila");
            await Misc.openContexMenuItem(treeSakila, constants.addSchemaToREST, true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            await Database.setRestSchema(`localhost/edited${service}|localhost/${service}`,
                "sakila", "/sakila", 1, true, true, "sakila");
            await driver.switchTo().defaultContent();
            await Misc.verifyNotification("The MRS schema has been added successfully.");
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            const treeService = await Misc.getTreeElement(constants.dbTreeSection, String(randomServiceLabel), true);
            await treeService.expand();
            await Misc.getTreeElement(constants.dbTreeSection, "/sakila (sakila)");

        });

        it("Edit REST Schema", async () => {

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `/edited${service} (localhost)`, true);
            const randomServiceLabel = await treeRandomService.getLabel();
            const treeService = await Misc.getTreeElement(constants.dbTreeSection, String(randomServiceLabel));
            await treeService.expand();
            const treeMySQLRESTSchema = await Misc.getTreeElement(constants.dbTreeSection, "/sakila (sakila)");
            await Misc.openContexMenuItem(treeMySQLRESTSchema, constants.editRESTSchema, true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            await Database.setRestSchema(`localhost/edited${service}|localhost/${service}`,
                "sakila", "/edited", 5, false, false, "edited");
            await driver.switchTo().defaultContent();
            await Misc.verifyNotification("The MRS schema has been updated successfully");
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);

            await new EditorView().closeAllEditors();
            const treeSakilaEdited = await Misc.getTreeElement(constants.dbTreeSection, "/edited (sakila)", true);
            await Misc.openContexMenuItem(treeSakilaEdited, constants.editRESTSchema, true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }

            const dialog = await driver.wait(until.elementLocated(By.id("mrsSchemaDialog")),
                constants.explicitWait, "MRS Schema dialog was not displayed");
            try {
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
            } finally {
                await dialog.findElement(By.id("closeButton")).click();
            }


        });

        it("Add Table to REST Service", async () => {

            const treeSakilaEdited = await Misc.getTreeElement(constants.dbTreeSection, "/edited (sakila)");
            await treeSakilaEdited.collapse();
            const treeSakila = await Misc.getTreeElement(constants.dbTreeSection, "sakila");
            await treeSakila.expand();
            const treeTables = await Misc.getTreeElement(constants.dbTreeSection, "Tables");
            await treeTables.expand();
            const treeActor = await Misc.getTreeElement(constants.dbTreeSection, "actor");
            await Misc.openContexMenuItem(treeActor, constants.addDBObjToREST, true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            await Database.setRestObject(`localhost/edited${service}`);
            await driver.switchTo().defaultContent();
            await Misc.verifyNotification("The MRS Database Object actor was updated successfully");
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
            await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
            await treeSakilaEdited.expand();
            await Misc.getTreeElement(constants.dbTreeSection, "/actor (actor)");

        });

        it("Add New Authentication App", async () => {

            let treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `/edited${service} (localhost)`, true);
            await Misc.openContexMenuItem(treeRandomService, constants.addNewAuthApp, true);
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
            await Misc.verifyNotification("The MRS Authentication App has been added");
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
            await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
            treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `/edited${service} (localhost)`, true);
            await treeRandomService.expand();
            await Misc.getTreeElement(constants.dbTreeSection, "MRS (MRS)");

        });

        it("Add User", async () => {

            let treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection, "MRS (MRS)");
            await Misc.openContexMenuItem(treeAuthApp, constants.addRESTUser, true);
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
            await Misc.verifyNotification("The MRS User has been added");
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection, "MRS (MRS)");
            await driver.wait(async () => {
                await treeAuthApp.expand();

                return (await treeAuthApp.isExpanded()) && (await treeAuthApp.getChildren()).length > 0;
            }, constants.explicitWait, "MRS (MRS) was not expanded");
            await Misc.getTreeElement(constants.dbTreeSection, "gui", true);

        });

        it("Edit Authentication App", async () => {

            let treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection, "MRS (MRS)");
            await Misc.openContexMenuItem(treeAuthApp, constants.editAuthenticationApp, true);
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
            await Misc.verifyNotification("The MRS Authentication App has been updated");
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);

            await new EditorView().closeAllEditors();
            treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection, "MRSedited (MRS)", true);
            await Misc.openContexMenuItem(treeAuthApp, constants.editAuthenticationApp, true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            const dialog = await driver.wait(until.elementLocated(By.id("mrsAuthenticationAppDialog")),
                constants.explicitWait, "Authentication App dialog was not displayed");

            try {
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

            } finally {
                await dialog.findElement(By.id("closeButton")).click();
            }

        });

        it("Edit User", async () => {

            const treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection, "MRSedited (MRS)");
            await treeAuthApp.expand();
            let treeUser = await Misc.getTreeElement(constants.dbTreeSection, "gui");
            await Misc.openContexMenuItem(treeUser, constants.editRESTUser, true);
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
            await Misc.verifyNotification(`The MRS User has been updated`);
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);

            await new EditorView().closeAllEditors();
            const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
            await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
            treeUser = await Misc.getTreeElement(constants.dbTreeSection, "test");
            await Misc.openContexMenuItem(treeUser, constants.editRESTUser, true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            const dialog = await driver.wait(until.elementLocated(By.id("mrsUserDialog")),
                constants.explicitWait, "User dialog was not displayed");
            try {
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
            } finally {
                await dialog.findElement(By.id("closeButton")).click();
            }

        });

        it("MRS Service Documentation", async () => {

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `/edited${service} (localhost)`, true);
            await Misc.openContexMenuItem(treeRandomService, constants.mrsServiceDocs, true);
            await driver.findElement(By.id("rest-service-properties"));

        });

        it("Delete User", async () => {

            const treeUser = await Misc.getTreeElement(constants.dbTreeSection, "test");
            await Misc.openContexMenuItem(treeUser, constants.deleteRESTUser);
            await Misc.verifyNotification(
                `Are you sure the MRS user test should be deleted`);
            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();
            await ntfs[ntfs.length - 1].takeAction("Yes");
            await Misc
                .verifyNotification(`The MRS User ${await treeUser.getLabel()} has been deleted`);

            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            await driver.wait(async () => {
                try {
                    let treeDBSection = await Misc.getSection(constants.dbTreeSection);
                    const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
                    await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
                    treeDBSection = await Misc.getSection(constants.dbTreeSection);

                    return (await treeDBSection.findItem("test")) === undefined;
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, `user 'test' was not deleted`);
        });

        it("Delete Authentication App", async () => {

            const treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection, "MRSedited (MRS)", true);
            const authAppLabel = await treeAuthApp.getLabel();
            await Misc.openContexMenuItem(treeAuthApp, constants.deleteAuthenticationApp, false, true);
            await Misc.verifyNotification(
                `Are you sure the MRS authentication app ${authAppLabel.replace(" (MRS)", "")} should be deleted`);
            await driver.wait(async () => {
                try {
                    const workbench = new Workbench();
                    const ntfs = await workbench.getNotifications();
                    await ntfs[ntfs.length - 1].takeAction("Yes");

                    return true;
                } catch (e) {
                    if (!(e instanceof error.ElementNotInteractableError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, "Could not click on notification button");

            await Misc.verifyNotification(`The MRS Authentication App MRSedited has been deleted`);
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            await driver.wait(async () => {
                let treeDBSection = await Misc.getSection(constants.dbTreeSection);
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
                await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
                treeDBSection = await Misc.getSection(constants.dbTreeSection);

                return (await treeDBSection.findItem(authAppLabel)) === undefined;
            }, constants.explicitWait, `MRSedited (MRS) Authorization App was not deleted`);

        });

        it("Delete REST Schema", async () => {
            let treeDBSection = await Misc.getSection(constants.dbTreeSection);

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `/edited${service} (localhost)`, true);
            await treeRandomService.expand();

            const treeMySQLRESTSchema = await Misc.getTreeElement(constants.dbTreeSection, "/edited (sakila)", true);
            const label = await treeMySQLRESTSchema.getLabel();
            const workbench = new Workbench();

            // first we click to delete the schema but we change our mind later (BUG#35377927)
            await Misc.openContexMenuItem(treeMySQLRESTSchema, constants.deleteRESTSchema, false, true);
            await Misc.verifyNotification("Are you sure the MRS schema sakila should be deleted");

            let ntfs = await workbench.getNotifications();

            await driver.wait(async () => {
                try {
                    // answering "No" should prevent the schema from being deleted
                    await ntfs[ntfs.length - 1].takeAction("No");

                    return true;
                } catch (e) {
                    if (!(e instanceof error.ElementNotInteractableError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, "Could not click on notification button");

            await driver.wait(async () => {
                try {
                    // we shouldn't have to wait for the list to reload, but we can play it safe to ensure
                    // the schema is not effectively deleted
                    await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
                    treeDBSection = await Misc.getSection(constants.dbTreeSection);
                    // the schema should still be in the tree

                    return (await treeDBSection.findItem(label)) !== undefined;
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, `${label} schema was not deleted`);

            // now we try again, but we really want to delete the schema
            await Misc.openContexMenuItem(treeMySQLRESTSchema, constants.deleteRESTSchema, false, true);
            await Misc.verifyNotification("Are you sure the MRS schema sakila should be deleted");

            ntfs = await workbench.getNotifications();

            await driver.wait(async () => {
                try {
                    // answering "Yes" should effectively delete the schema
                    await ntfs[ntfs.length - 1].takeAction("Yes");

                    return true;
                } catch (e) {
                    if (!(e instanceof error.ElementNotInteractableError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, "Could not click on notification button");
            await Misc.verifyNotification("The MRS schema has been deleted successfully");
            treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);

            await driver.wait(async () => {
                try {
                    let treeDBSection = await Misc.getSection(constants.dbTreeSection);
                    await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
                    treeDBSection = await Misc.getSection(constants.dbTreeSection);
                    // the schema should not be in the tree

                    return (await treeDBSection.findItem(label)) === undefined;
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, `${label} schema was deleted`);
        });

        it("Delete REST Service", async () => {

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `/edited${service} (localhost)`, true);
            await Misc.openContexMenuItem(treeRandomService, constants.deleteRESTService);
            const label = await treeRandomService.getLabel();
            service = label.replace(" (localhost)", "");
            await Misc.verifyNotification(`Are you sure the MRS service ${String(service)} should be deleted`);
            await driver.wait(async () => {
                try {
                    const workbench = new Workbench();
                    const ntfs = await workbench.getNotifications();
                    await ntfs[ntfs.length - 1].takeAction("Yes");

                    return true;
                } catch (e) {
                    if (!(e instanceof error.ElementNotInteractableError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, "Could not click on notification button");
            await Misc.verifyNotification("The MRS service has been deleted successfully");
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            await driver.wait(async () => {
                let treeDBSection = await Misc.getSection(constants.dbTreeSection);
                await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
                treeDBSection = await Misc.getSection(constants.dbTreeSection);

                return (await treeDBSection.findItem(label)) === undefined;
            }, constants.explicitWait, `${label} Service was not deleted`);

        });

    });

    describe("CRUD Operations", () => {

        let actorId: string;
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
                let treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
                await treeMySQLRESTService.expand();
                await Misc.openContexMenuItem(treeMySQLRESTService, constants.addRESTService, true);
                await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                    "DB Connection was not loaded");
                if (await Database.requiresCredentials()) {
                    await Database.setDBConnectionCredentials(globalConn);
                }
                await Database.setRestService(`/${service}`, "", "localhost:8443", ["HTTP", "HTTPS"], true, true);
                await driver.switchTo().defaultContent();
                await Misc.verifyNotification("The MRS service has been created.");
                const treeDBSection = await Misc.getSection(constants.dbTreeSection);
                await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                    `${await treeDBSection.getTitle()} is still loading`);

                await driver.wait(async () => {
                    const sakila = await Misc.getTreeElement(constants.dbTreeSection, "sakila");
                    await sakila.expand();

                    return (await sakila.isExpanded()) && (sakila.hasChildren());
                }, constants.explicitWait, "sakila tree item was not expanded");
                await (await Misc.getTreeElement(constants.dbTreeSection, "Tables")).expand();
                const treeActor = await Misc.getTreeElement(constants.dbTreeSection, "actor");
                await Misc.openContexMenuItem(treeActor, constants.addDBObjToREST);
                let notification = "The database schema sakila has not been added to the REST Service.";
                notification += " Do you want to add the schema now?";
                await Misc.verifyNotification(notification);
                await driver.wait(async () => {
                    try {
                        const workbench = new Workbench();
                        const ntfs = await workbench.getNotifications();
                        await ntfs[ntfs.length - 1].takeAction("Yes");

                        return true;
                    } catch (e) {
                        if (!(e instanceof error.ElementNotInteractableError)) {
                            throw e;
                        }
                    }
                }, constants.explicitWait, "Could not click on notification button");
                await driver.wait(async () => {
                    return (await new Workbench().getNotifications()).length === 0;
                }, constants.explicitWait * 2, "There are still notifications displayed");
                await Misc.switchToWebView();
                await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                    "DB Connection was not loaded");
                if (await Database.requiresCredentials()) {
                    await Database.setDBConnectionCredentials(globalConn);
                }
                await Database.setRestObject(`${hostName}/${service}`, undefined, undefined,
                    ["C", "R", "U", "D"], undefined, false);
                await driver.switchTo().defaultContent();

                await Misc.verifyNotification("The MRS schema sakila has been added", true);

                await driver.wait(Misc.isNotLoading(treeDBSection), constants.ociExplicitWait * 2,
                    `${await treeDBSection.getTitle()} is still loading`);

                // Start Router
                treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
                await Misc.openContexMenuItem(treeMySQLRESTService, constants.startRouter);
                await Misc.waitForTerminalText(
                    "Start accepting connections for routing routing:bootstrap_x_rw listening on",
                    constants.explicitWait * 2);

                await driver.wait(async () => {
                    const treeRouter = await Misc.getRouter(globalConn.caption);

                    return (await Misc.isRouterActive(treeRouter)) === true;
                }, constants.explicitWait * 2, `Router did not became active`);
                hostName = "127.0.0.1:8443";
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                if (response) {
                    console.log("---CURL RESULT---");
                    console.log(response.status);
                    console.log(response.json());
                }
                await Misc.processFailure(this);
            }
            response = undefined;
        });

        after(async () => {
            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            await Misc.openContexMenuItem(treeMySQLRESTService, constants.killRouters);
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
            expect(data.items[0].firstName).to.equals("PENELOPE");
        });

        it("Insert table row", async () => {
            response = await fetch(`${protocol}://${hostName}/${service}/${schema}/${table}`, {
                method: "post",
                // eslint-disable-next-line @typescript-eslint/naming-convention
                body: JSON.stringify({ firstName: "Doctor", lastName: "Testing" }),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                headers: { "Content-Type": "application/json" },
            });
            const data = await response.json();
            expect(response.ok).to.be.true;
            actorId = data.actorId;
            expect(data.actorId).to.exist;
            expect(data.firstName).to.equals("Doctor");
            expect(data.lastName).to.equals("Testing");
            expect(data.lastUpdate).to.exist;
        });

        it("Update table row", async () => {
            response = await fetch(`${protocol}://${hostName}/${service}/${schema}/${table}/${actorId}`, {
                method: "put",
                // eslint-disable-next-line @typescript-eslint/naming-convention
                body: JSON.stringify({ firstName: "Mister", lastName: "Test", lastUpdate: "2023-06-23 13:32:54" }),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                headers: { "Content-Type": "application/json" },
            });
            const data = await response.json();
            expect(actorId).to.exist;
            expect(data.firstName).to.equals("Mister");
            expect(data.lastName).to.equals("Test");
            expect(data.lastUpdate).to.exist;
        });

        it("Delete table row", async () => {
            const query = `"actorId":${actorId}`;
            response = await fetch(`${protocol}://${hostName}/${service}/${schema}/${table}?q={${query}}`,
                { method: "delete" });

            const data = await response.json();
            expect(response.ok).to.be.true;
            expect(data.itemsDeleted).to.equals(1);
        });

        it("Filter object data", async () => {
            const query = `"firstName":"PENELOPE"`;
            response = await fetch(`${protocol}://${hostName}/${service}/${schema}/${table}?q={${query}}`);
            const data = await response.json();
            expect(response.ok).to.be.true;
            expect(data.items).to.exist;
        });

    });

});
