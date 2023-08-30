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

import { join } from "path";
import * as fs from "fs/promises";
import { expect } from "chai";
import {
    By,
    Workbench,
    until,
    BottomBarPanel,
    ModalDialog,
    EditorView,
} from "vscode-extension-tester";
import { driver, Misc } from "../lib/misc";
import { IDBConnection, Database, IConnBasicMySQL } from "../lib/db";
import * as constants from "../lib/constants";


import { Conditions } from "../lib/conditions";

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
            await driver.wait(Conditions.extensionIsReady(), constants.extensionReadyWait, "Extension was not ready");
            await Misc.toggleBottomBar(false);
            await Misc.sectionFocus(constants.dbTreeSection);
            const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            globalConn.caption += randomCaption;
            await Database.createConnection(globalConn);
            const conn = await Database.getWebViewConnection(globalConn.caption, true);
            await Misc.switchToWebView();
            await driver.executeScript("arguments[0].click();", conn);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            await Database.setDBConnectionCredentials(globalConn);
            const result = await Misc.execCmd("DROP SCHEMA IF EXISTS `mysql_rest_service_metadata`;",
                undefined, constants.explicitWait * 2);
            expect(result[0]).to.match(/OK/);
            await driver.switchTo().defaultContent();
            const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
            await treeGlobalConn.expand();
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as IConnBasicMySQL).password);
            await Misc.openContextMenuItem(treeGlobalConn, constants.configureREST, constants.checkNotif);
            const ntf = await Misc.getNotification(
                `Do you want to configure this instance for MySQL REST Service Support?`, false);
            await Misc.clickOnNotificationButton(ntf, "Yes");
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as IConnBasicMySQL).password);
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            await Misc.getNotification("MySQL REST Service configured successfully.");
            await Misc.openContextMenuItem(treeGlobalConn, constants.showSystemSchemas, undefined);
            expect(await Misc.existsTreeElement(constants.dbTreeSection, "mysql_rest_service_metadata")).to.be.true;

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
            await Misc.openContextMenuItem(treeMySQLRESTService, constants.disableRESTService, constants.checkInput);
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as IConnBasicMySQL).password);
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            await Misc.getNotification("MySQL REST Service configured successfully.");
            expect(await Misc.isMRSDisabled(treeMySQLRESTService)).to.equals(true);
        });

        it("Enable MySQL REST Service", async () => {

            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
            await Misc.openContextMenuItem(treeMySQLRESTService, constants.enableRESTService, constants.checkInput);
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as IConnBasicMySQL).password);
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            await Misc.getNotification("MySQL REST Service configured successfully.");
            expect(await Misc.isMRSDisabled(treeMySQLRESTService)).to.equals(false);

        });

        it("Bootstrap Local MySQL Router Instance", async () => {

            expect(await Misc.isRouterInstalled(), "Please install MySQL Router manually").to.be.true;
            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            await treeMySQLRESTService.expand();
            await Misc.openContextMenuItem(treeMySQLRESTService, constants.bootstrapRouter, constants.checkTerminal);
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
            await Misc.openContextMenuItem(treeMySQLRESTService, constants.bootstrapRouter, constants.checkNotif);
            const ntf = await Misc.getNotification("Do you want to rename the existing directory and proceed", false);
            await Misc.clickOnNotificationButton(ntf, "Yes");
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
            await Misc.openContextMenuItem(treeMySQLRESTService, constants.startRouter, constants.checkTerminal);
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
            await Misc.openContextMenuItem(treeMySQLRESTService, constants.stopRouter, constants.checkTerminal);
            await Misc.waitForTerminalText(["mysqlrouter\\stop", "Unloading all plugins"], constants.explicitWait * 2);
            expect(await Misc.terminalHasErrors()).to.be.false;
            await driver.wait(async () => {
                const treeRouter = await Misc.getRouter(globalConn.caption);

                return (await Misc.isRouterActive(treeRouter)) === false;

            }, constants.explicitWait * 3, `Router did not became inactive`);
        });

        it("Browse the MySQL REST Service Documentation", async () => {

            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            await Misc.openContextMenuItem(treeMySQLRESTService, constants.browseRESTDocs,
                constants.checkNewTabAndWebView);
            try {
                await driver.wait(async () => {
                    const titles = await driver.findElements(By.css("h1"));
                    for (const title of titles) {
                        if (await title.getText() === "MRS Developer's Guide") {
                            return true;
                        }
                    }
                }, constants.explicitWait, "Could not find the title 'MRS Developer's Guide'");
            } finally {
                await driver.switchTo().defaultContent();
                await new EditorView().closeEditor(constants.mrsDocs);
            }
        });

    });

    describe("Service Context Menus", () => {

        let service = "restService";
        const destDumpSchema = join(process.cwd(), "world_x_cst");
        const destDumpTable = join(process.cwd(), "address");

        before(async function () {
            try {
                const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
                await treeMySQLRESTService.expand();
                await Misc.openContextMenuItem(treeMySQLRESTService, constants.addRESTService,
                    constants.checkWebViewDialog);
                await Database.setRestService(`/${service}`, "", "localhost", ["HTTP"], true, true);
                await driver.switchTo().defaultContent();
                await Misc.getNotification("The MRS service has been created");
                await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                    `${constants.dbTreeSection} is still loading`);
                expect(await Misc.existsTreeElement(constants.dbTreeSection, `/${service} (localhost)`)).to.be.true;
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            await driver.switchTo().defaultContent();
            if (this.currentTest.state === "failed") {
                await Misc.expandNotifications();
                await Misc.processFailure(this);
                await Misc.closeNotifications();
            }

            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
        });

        it("Set as Current REST Service", async () => {

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `/${service} (localhost)`, true);
            await Misc.openContextMenuItem(treeRandomService, constants.setAsCurrentREST, constants.checkNotif);
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            await Misc.getNotification("The MRS service has been set as the new default service.");
            await driver.wait(async () => {
                return Misc.isDefaultItem(treeRandomService, "rest");
            }, constants.explicitWait, "REST Service tree item did not became default");
        });

        it("Edit REST Service", async () => {

            let treeRandomService = await Misc.getTreeElement(constants.dbTreeSection, `/${service} (localhost)`, true);
            await Misc.openContextMenuItem(treeRandomService, constants.editRESTService, constants.checkWebViewDialog);
            await Database.setRestService(`/edited${service}`, "edited",
                "localhost", [], false, false);
            await driver.switchTo().defaultContent();
            await Misc.getNotification("The MRS service has been successfully updated.");
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            treeRandomService = await Misc
                .getTreeElement(constants.dbTreeSection, `/edited${service} (localhost)`, true);
            await Misc.openContextMenuItem(treeRandomService, constants.editRESTService, constants.checkWebViewDialog);
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

        it("Add REST Service Schemas", async () => {

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `/edited${service} (localhost)`, true);
            const randomServiceLabel = await treeRandomService.getLabel();
            const schemas = ["sakila", "world_x_cst"];

            for (const schema of schemas) {
                const treeSchema = await Misc.getTreeElement(constants.dbTreeSection, schema);
                await Misc.openContextMenuItem(treeSchema, constants.addSchemaToREST, constants.checkWebViewDialog);
                await Database.setRestSchema(`localhost/edited${service}|localhost/${service}`,
                    schema, `/${schema}`, 1, true, true, schema);
                await driver.switchTo().defaultContent();
                await Misc.getNotification("The MRS schema has been added successfully.");
                await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                    `${constants.dbTreeSection} is still loading`);
                const treeService = await Misc.getTreeElement(constants.dbTreeSection,
                    String(randomServiceLabel), true);
                await treeService.expand();
                expect(await Misc.existsTreeElement(constants.dbTreeSection, `/${schema} (${schema})`)).to.exist;
            }

        });

        it("Edit REST Schema", async () => {

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `/edited${service} (localhost)`, true);
            const randomServiceLabel = await treeRandomService.getLabel();
            const treeService = await Misc.getTreeElement(constants.dbTreeSection, String(randomServiceLabel));
            await treeService.expand();
            const treeMySQLRESTSchema = await Misc.getTreeElement(constants.dbTreeSection, "/sakila (sakila)");
            await Misc.openContextMenuItem(treeMySQLRESTSchema, constants.editRESTSchema, constants.checkWebViewDialog);
            await Database.setRestSchema(`localhost/edited${service}|localhost/${service}`,
                "sakila", "/edited", 5, false, false, "edited");
            await driver.switchTo().defaultContent();
            await Misc.getNotification("The MRS schema has been updated successfully");
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            const treeSakilaEdited = await Misc.getTreeElement(constants.dbTreeSection, "/edited (sakila)", true);
            await Misc.openContextMenuItem(treeSakilaEdited, constants.editRESTSchema, constants.checkWebViewDialog);
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

        it("Add Tables to REST Service", async () => {

            const treeSakilaEdited = await Misc.getTreeElement(constants.dbTreeSection, "/edited (sakila)");
            await treeSakilaEdited.collapse();
            const treeSakila = await Misc.getTreeElement(constants.dbTreeSection, "sakila");
            await treeSakila.expand();
            const treeTables = await Misc.getTreeElement(constants.dbTreeSection, "Tables");
            await treeTables.expand();

            const tables = ["actor", "address"];

            for (const table of tables) {
                const treeActor = await Misc.getTreeElement(constants.dbTreeSection, table);
                await Misc.openContextMenuItem(treeActor, constants.addDBObjToREST, constants.checkWebViewDialog);
                await Database.setRestObject(`localhost/edited${service}`);
                await driver.switchTo().defaultContent();
                await Misc.getNotification(`The MRS Database Object ${table} was updated successfully`);
                await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                    `${constants.dbTreeSection} is still loading`);
                await treeSakilaEdited.expand();
                await Misc.getTreeElement(constants.dbTreeSection, `/${table} (${table})`, true);
            }

        });

        it("Dump Rest Schema to Json file", async () => {

            const schema = "world_x_cst";
            const treeMySQLRESTSchema = await Misc.getTreeElement(constants.dbTreeSection,
                `/${schema} (${schema})`, true);

            await fs.rm(`${destDumpSchema}.mrs.json`, { recursive: true, force: true });
            await Misc.openContextMenuItem(treeMySQLRESTSchema, constants.dumpRESTSchemaToJSON, constants.checkInput);
            await Misc.setInputPath(destDumpSchema);
            await Misc.getNotification(`The REST Schema has been dumped successfully`);
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            await fs.access(`${destDumpSchema}.mrs.json`);
        });

        it("Dump REST Object to JSON file", async () => {

            const table = "address";
            const treeAddressTable = await Misc.getTreeElement(constants.dbTreeSection, `/${table} (${table})`);
            await fs.rm(`${destDumpTable}.mrs.json`, { recursive: true, force: true });
            await Misc.openContextMenuItem(treeAddressTable, constants.dumpRESTObjToJSON, constants.checkInput);
            await Misc.setInputPath(destDumpTable);
            await Misc.getNotification(`The REST Database Object has been dumped successfully`);
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            await fs.access(`${destDumpTable}.mrs.json`);

        });

        it("Delete REST Object", async () => {

            const table = "address";
            const treeAddressTable = await Misc.getTreeElement(constants.dbTreeSection, `/${table} (${table})`);
            const tableName = await treeAddressTable.getLabel();
            await Misc.openContextMenuItem(treeAddressTable, constants.deleteRESTObj, constants.checkDialog);
            const dialog = new ModalDialog();
            await dialog.pushButton(`Delete DB Object`);
            await Misc.getNotification(`The REST DB Object ${table} has been deleted`);
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            expect(await Misc.existsTreeElement(constants.dbTreeSection, tableName)).to.be.false;
        });

        it("Delete REST Schema", async () => {

            const schema = "world_x_cst";
            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `/edited${service} (localhost)`, true);
            await treeRandomService.expand();

            const treeMySQLRESTSchema = await Misc.getTreeElement(constants.dbTreeSection,
                `/${schema} (${schema})`, true);

            // first we click to delete the schema but we change our mind later (BUG#35377927)
            await Misc.openContextMenuItem(treeMySQLRESTSchema, constants.deleteRESTSchema, constants.checkNotif);
            let ntf = await Misc.getNotification("Are you sure the MRS schema world_x_cst should be deleted?", false);
            await Misc.clickOnNotificationButton(ntf, "No");
            expect(await Misc.existsTreeElement(constants.dbTreeSection, `/${schema} (${schema})`)).to.be.true;

            // now we try again, but we really want to delete the schema
            await Misc.openContextMenuItem(treeMySQLRESTSchema, constants.deleteRESTSchema, constants.checkNotif);
            ntf = await Misc.getNotification("Are you sure the MRS schema world_x_cst should be deleted?", false);
            await Misc.clickOnNotificationButton(ntf, "Yes");
            await Misc.getNotification("The MRS schema has been deleted successfully");
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            expect(await Misc.existsTreeElement(constants.dbTreeSection, `/${schema} (${schema})`)).to.be.false;
        });

        it("Load REST Schema from JSON file", async () => {

            const schema = "world_x_cst";
            const treeRandomService = await Misc
                .getTreeElement(constants.dbTreeSection, `/edited${service} (localhost)`, true);
            await Misc.openContextMenuItem(treeRandomService, constants.loadRESTSchemaFromJSON, constants.checkInput);
            await Misc.setInputPath(`${destDumpSchema}.mrs.json`);
            await Misc.getNotification("The REST Schema has been loaded successfully");
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            expect(await Misc.existsTreeElement(constants.dbTreeSection, `/${schema} (${schema})`)).to.be.true;

        });

        it("Export Rest Service SDK files", async () => {

            const treeRandomService = await Misc
                .getTreeElement(constants.dbTreeSection, `/edited${service} (localhost)`, true);
            await Misc.openContextMenuItem(treeRandomService, constants.exportRESTSDK, constants.checkInput);
            const dest = join(process.cwd(), "dump.sdk");
            await fs.rm(dest, { force: true, recursive: true });
            await Misc.setInputPath(dest);
            await Misc.getNotification("MRS Service REST Files exported successfully");
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            const files = await fs.readdir(dest);
            expect(files.length).to.be.greaterThan(0);
        });

        it("Load REST Object from JSON file", async () => {

            const schema = "sakila";
            const table = "address";
            const treeMySQLRESTSchema = await Misc.getTreeElement(constants.dbTreeSection,
                `/edited (${schema})`, true);
            await Misc.openContextMenuItem(treeMySQLRESTSchema, constants.loadRESTObjFromJSON, constants.checkInput);
            await Misc.setInputPath(`${destDumpTable}.mrs.json`);
            await Misc.getNotification("The REST Database Object has been loaded successfully");
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            expect(await Misc.existsTreeElement(constants.dbTreeSection, `/${table} (${table})`)).to.be.true;

        });

        it("Add New Authentication App", async () => {

            let treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `/edited${service} (localhost)`, true);
            await Misc.openContextMenuItem(treeRandomService, constants.addNewAuthApp, constants.checkWebViewDialog);
            await Database.setRestAuthenticationApp(
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
            await Misc.getNotification("The MRS Authentication App has been added");
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
            await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
            treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `/edited${service} (localhost)`, true);
            await treeRandomService.expand();
            expect(await Misc.existsTreeElement(constants.dbTreeSection, "MRS (MRS)")).to.be.true;

        });

        it("Add User", async () => {

            let treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection, "MRS (MRS)");
            await Misc.openContextMenuItem(treeAuthApp, constants.addRESTUser, constants.checkWebViewDialog);
            await Database.setRestUser(
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
            await Misc.getNotification("The MRS User has been added");
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection, "MRS (MRS)");
            await driver.wait(async () => {
                await treeAuthApp.expand();

                return (await treeAuthApp.isExpanded()) && (await treeAuthApp.getChildren()).length > 0;
            }, constants.explicitWait, "MRS (MRS) was not expanded");
            expect(await Misc.existsTreeElement(constants.dbTreeSection, "gui")).to.be.true;

        });

        it("Edit Authentication App", async () => {

            let treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection, "MRS (MRS)");
            await Misc.openContextMenuItem(treeAuthApp, constants.editAuthenticationApp, constants.checkWebViewDialog);
            await Database.setRestAuthenticationApp(
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
            await Misc.getNotification("The MRS Authentication App has been updated");
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection, "MRSedited (MRS)", true);
            await Misc.openContextMenuItem(treeAuthApp, constants.editAuthenticationApp, constants.checkWebViewDialog);

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
            await Misc.openContextMenuItem(treeUser, constants.editRESTUser, constants.checkWebViewDialog);
            await Database.setRestUser(
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
            await Misc.getNotification(`The MRS User has been updated`);
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
            await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
            treeUser = await Misc.getTreeElement(constants.dbTreeSection, "test");
            await Misc.openContextMenuItem(treeUser, constants.editRESTUser, constants.checkWebViewDialog);
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
            await Misc.openContextMenuItem(treeRandomService, constants.mrsServiceDocs,
                constants.checkNewTabAndWebView);
            await driver.wait(until.elementLocated(By.id("rest-service-properties")), constants.explicitWait);
            await driver.switchTo().defaultContent();
            await new EditorView().closeEditor(constants.mrsDocs);

        });

        it("Delete User", async () => {

            const treeUser = await Misc.getTreeElement(constants.dbTreeSection, "test");
            await Misc.openContextMenuItem(treeUser, constants.deleteRESTUser, constants.checkNotif);
            const ntf = await Misc.getNotification(`Are you sure the MRS user test should be deleted`, false);
            await Misc.clickOnNotificationButton(ntf, "Yes");
            await Misc.getNotification(`The MRS User test has been deleted`);
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            expect(await Misc.existsTreeElement(constants.dbTreeSection, "test")).to.be.false;
        });

        it("Delete Authentication App", async () => {

            const treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection, "MRSedited (MRS)", true);
            const authAppLabel = await treeAuthApp.getLabel();
            await Misc.openContextMenuItem(treeAuthApp, constants.deleteAuthenticationApp, constants.checkNotif);
            const ntf = await Misc.getNotification(
                `Are you sure the MRS authentication app ${authAppLabel.replace(" (MRS)", "")} should be deleted`,
                false);
            await Misc.clickOnNotificationButton(ntf, "Yes");
            await Misc.getNotification(`The MRS Authentication App MRSedited has been deleted`);
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            expect(await Misc.existsTreeElement(constants.dbTreeSection, "MRSedited (MRS)")).to.be.false;

        });

        it("Delete REST Service", async () => {

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `/edited${service} (localhost)`, true);
            await Misc.openContextMenuItem(treeRandomService, constants.deleteRESTService, constants.checkNotif);
            const label = await treeRandomService.getLabel();
            service = label.replace(" (localhost)", "");
            const ntf = await Misc.getNotification(`Are you sure the MRS service ${String(service)} should be deleted`,
                false);
            await Misc.clickOnNotificationButton(ntf, "Yes");
            await Misc.getNotification("The MRS service has been deleted successfully");
            await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            expect(await Misc.existsTreeElement(constants.dbTreeSection, `/edited${service} (localhost)`)).to.be.false;

        });

    });

    describe("CRUD Operations", () => {

        let actorId: string;
        const service = "crudService";
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
                await Misc.openContextMenuItem(treeMySQLRESTService, constants.addRESTService,
                    constants.checkNewTabAndWebView);
                await Database.setRestService(`/${service}`, "", "localhost:8443", ["HTTP", "HTTPS"], true, true);
                await driver.switchTo().defaultContent();
                await Misc.getNotification("The MRS service has been created.");
                await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                    `${constants.dbTreeSection} is still loading`);
                await driver.wait(async () => {
                    const sakila = await Misc.getTreeElement(constants.dbTreeSection, "sakila");
                    await sakila.expand();

                    return (await sakila.isExpanded()) && (sakila.hasChildren());
                }, constants.explicitWait, "sakila tree item was not expanded");
                await (await Misc.getTreeElement(constants.dbTreeSection, "Tables")).expand();
                const treeActor = await Misc.getTreeElement(constants.dbTreeSection, "actor");
                await Misc.openContextMenuItem(treeActor, constants.addDBObjToREST, constants.checkNotif);
                let notification = "The database schema sakila has not been added to the REST Service.";
                notification += " Do you want to add the schema now?";
                const ntf = await Misc.getNotification(notification, false);
                await Misc.clickOnNotificationButton(ntf, "Yes");
                await Misc.dissmissNotificationByEscape();
                await Misc.switchToWebView();
                await Database.setRestObject(`${hostName}/${service}`, undefined, undefined,
                    ["C", "R", "U", "D"], undefined, false);
                await driver.switchTo().defaultContent();
                await Misc.dissmissNotificationByEscape();
                await driver.wait(Conditions.isNotLoading(constants.dbTreeSection), constants.ociExplicitWait * 2,
                    `${constants.dbTreeSection} is still loading`);

                // Start Router
                treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
                await Misc.openContextMenuItem(treeMySQLRESTService, constants.startRouter, undefined);
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
            await Misc.openContextMenuItem(treeMySQLRESTService, constants.killRouters, undefined);
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
