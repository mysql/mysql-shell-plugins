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

import { join, basename } from "path";
import * as fs from "fs/promises";
import { until } from "selenium-webdriver";
import { Misc } from "../lib/misc.js";
import { E2ENotebook } from "../lib/E2ENotebook.js";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection.js";
import { Os } from "../lib/os.js";
import { DialogHelper } from "../lib/Dialogs/DialogHelper.js";
import * as constants from "../lib/constants.js";
import * as interfaces from "../lib/interfaces.js";
import * as locator from "../lib/locators.js";
import { driver, loadDriver } from "../lib/driver.js";
import { E2ESettings } from "../lib/E2ESettings.js";
import { E2ETextEditor } from "../lib/E2ETextEditor.js";
import { E2ECodeEditorWidget } from "../lib/E2ECodeEditorWidget.js";
import { E2ETabContainer } from "../lib/E2ETabContainer.js";
import { TestQueue } from "../lib/TestQueue.js";
import { E2ECommandResultGrid } from "../lib/CommandResults/E2ECommandResultGrid.js";
import { E2ECommandResultData } from "../lib/CommandResults/E2ECommandResultData.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));
const testView = `test_view`;
const testEvent = "test_event";
const testProcedure = "test_procedure";
const testFunction = "test_function";
let testFailed = false;
let ociConfig: interfaces.IOciProfileConfig | undefined;
let ociTree: string[];
let e2eProfile: string | undefined;
const ociTreeSection = new E2EAccordionSection(constants.ociTreeSection);
const tabContainer = new E2ETabContainer();

const globalConn: interfaces.IDBConnection = {
    dbType: "MySQL",
    caption: `CLIPBOARD`,
    description: "Local connection",
    basic: {
        hostname: "localhost",
        username: String(process.env.DBUSERNAME1),
        port: parseInt(process.env.MYSQL_PORT!, 10),
        schema: "sakila",
        password: String(process.env.DBUSERNAME1PWD),
    },
};

const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);

describe("CLIPBOARD", () => {

    beforeAll(async () => {
        await loadDriver(false);
        await driver.get(url);
        await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
        const settings = new E2ESettings();
        await settings.open();
        await settings.selectCurrentTheme(constants.darkModern);
        await settings.close();
        await dbTreeSection.createDatabaseConnection(globalConn);
        await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption!), constants.wait3seconds);
    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    describe("OCI", () => {

        beforeAll(async () => {
            const configs = await Misc.mapOciConfig();
            ociConfig = configs.find((item: interfaces.IOciProfileConfig) => {
                return item.name = "E2ETESTS";
            })!;

            e2eProfile = `${ociConfig.name} (${ociConfig.region})`;
            ociTree = [e2eProfile, "/ (Root Compartment)", "QA", "MySQLShellTesting"];

            try {
                await ociTreeSection.focus();
                await ociTreeSection.expandTree(ociTree);
            } catch (e) {
                await Misc.storeScreenShot("beforeAll_OCI_CLIPBOARD");
                throw e;
            }

        });

        beforeEach(async () => {
            await TestQueue.push(expect.getState().currentTestName!);
            await driver.wait(TestQueue.poll(expect.getState().currentTestName!), constants.queuePollTimeout);
        });


        afterAll(async () => {
            await Misc.dismissNotifications(true);
        });

        afterEach(async () => {
            await TestQueue.pop(expect.getState().currentTestName!);

            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot();
            }

            await tabContainer.closeAllTabs();
        });

        it("View Config Profile Information", async () => {
            try {
                const treeE2eProfile = await ociTreeSection.getTreeItem(e2eProfile!);
                await treeE2eProfile.openContextMenuAndSelect(constants.viewConfigProfileInformation);
                expect(await tabContainer.getTab(`${ociConfig!.name} Info.json`)).toBeDefined();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("View Compartment Information", async () => {
            try {
                const qaInfoJson = `${ociTree[2]} Info.json`;
                const treeMySQLShellTesting = await ociTreeSection.getTreeItem(ociTree[2]);
                await treeMySQLShellTesting.openContextMenuAndSelect(constants.viewCompartmentInformation);
                await driver.wait(tabContainer.untilTabIsOpened(qaInfoJson), constants.wait5seconds);
                const textEditor = new E2ETextEditor();
                await driver.wait(textEditor.untilIsJson(), constants.wait5seconds);
                process.env.COMPARTMENT_ID = JSON.parse(String(await textEditor.getText())).id;
                await tabContainer.closeAllTabs();
            } catch (e) {
                await Misc.storeScreenShot();
                throw e;
            }
        });

        it("View DB System Information", async () => {
            try {
                const dbSystem = await ociTreeSection.getOciItemByType(constants.dbSystemType);
                const treeDBSystem = await ociTreeSection.getTreeItem(dbSystem);
                await treeDBSystem.openContextMenuAndSelect(constants.viewDBSystemInformation);
                await driver.wait(tabContainer.untilTabIsOpened(`${dbSystem} Info.json`),
                    constants.wait5seconds);
                const textEditor = new E2ETextEditor();
                await driver.wait(textEditor.untilIsJson(), constants.wait5seconds);
            } catch (e) {
                await Misc.storeScreenShot();
                throw e;
            }
        });

        it("Get Bastion Information", async () => {
            try {
                const bastion = await ociTreeSection.getOciItemByType(constants.bastionType);
                const treeBastion = await ociTreeSection.getTreeItem(bastion);
                await treeBastion.openContextMenuAndSelect(constants.getBastionInformation);
                await driver.wait(tabContainer.untilTabIsOpened(`${bastion} Info.json`), constants.wait5seconds);
                const textEditor = new E2ETextEditor();
                await driver.wait(textEditor.untilIsJson(), constants.wait5seconds);
                await tabContainer.closeTab(new RegExp(`${bastion} Info.json`));
            } catch (e) {
                await Misc.storeScreenShot();
                throw e;
            }
        });

        it("View Compute Instance Information", async () => {
            try {
                const computeInstance = await ociTreeSection.getOciItemByType(constants.ociComputeType);
                const treeComputeInstance = await ociTreeSection.getTreeItem(computeInstance);
                await treeComputeInstance.openContextMenuAndSelect(constants.viewComputeInstanceInformation);
                await driver.wait(tabContainer.untilTabIsOpened(`${computeInstance} Info.json`),
                    constants.wait5seconds);
                const textEditor = new E2ETextEditor();
                await driver.wait(textEditor.untilIsJson(), constants.wait5seconds);
            } catch (e) {
                await Misc.storeScreenShot();
                throw e;
            }
        });

        it("Close tabs using tab context menu", async () => {
            const tabContainer = new E2ETabContainer();
            let treeE2eProfile = await ociTreeSection.getTreeItem(e2eProfile!);
            await treeE2eProfile.openContextMenuAndSelect(constants.viewConfigProfileInformation);
            await driver.wait(tabContainer.untilTabIsOpened(`${ociConfig!.name} Info.json`), constants.wait3seconds);
            const qaInfoJson = `${ociTree[2]} Info.json`;
            let treeCompartment = await ociTreeSection.getTreeItem(ociTree[2]);
            await treeCompartment.openContextMenuAndSelect(constants.viewCompartmentInformation);
            await driver.wait(tabContainer.untilTabIsOpened(qaInfoJson), constants.wait5seconds);
            const dbSystem = await ociTreeSection.getOciItemByType(constants.dbSystemType);
            let treeDbSystem = await ociTreeSection.getTreeItem(dbSystem);
            await treeDbSystem.openContextMenuAndSelect(constants.viewDBSystemInformation);
            await driver.wait(tabContainer.untilTabIsOpened(`${dbSystem} Info.json`),
                constants.wait5seconds);

            // Close
            await tabContainer.selectTabContextMenu(`${ociConfig!.name} Info.json`, constants.close);
            expect(await tabContainer.tabExists(`${ociConfig!.name} Info.json`)).toBe(false);

            treeE2eProfile = await ociTreeSection.getTreeItem(e2eProfile!);
            await treeE2eProfile.openContextMenuAndSelect(constants.viewConfigProfileInformation);
            await driver.wait(tabContainer.untilTabIsOpened(`${ociConfig!.name} Info.json`), constants.wait3seconds);

            // Close Others
            await tabContainer.selectTabContextMenu(`${ociConfig!.name} Info.json`, constants.closeOthers);
            expect(await tabContainer.tabExists(`${ociConfig!.name} Info.json`)).toBe(true);
            expect(await tabContainer.tabExists(qaInfoJson)).toBe(false);
            expect(await tabContainer.tabExists(`${dbSystem} Info.json`)).toBe(false);

            treeCompartment = await ociTreeSection.getTreeItem(ociTree[2]);
            await treeCompartment.openContextMenuAndSelect(constants.viewCompartmentInformation);
            await driver.wait(tabContainer.untilTabIsOpened(qaInfoJson), constants.wait5seconds);
            treeDbSystem = await ociTreeSection.getTreeItem(dbSystem);
            await treeDbSystem.openContextMenuAndSelect(constants.viewDBSystemInformation);
            await driver.wait(tabContainer.untilTabIsOpened(`${dbSystem} Info.json`), constants.wait5seconds);


            // Close to the right
            await tabContainer.selectTabContextMenu(qaInfoJson, constants.closeToTheRight);
            expect(await tabContainer.tabExists(`${ociConfig!.name} Info.json`)).toBe(true);
            expect(await tabContainer.tabExists(qaInfoJson)).toBe(true);
            expect(await tabContainer.tabExists(`${dbSystem} Info.json`)).toBe(false);
            treeDbSystem = await ociTreeSection.getTreeItem(dbSystem);
            await treeDbSystem.openContextMenuAndSelect(constants.viewDBSystemInformation);
            await driver.wait(tabContainer.untilTabIsOpened(`${dbSystem} Info.json`), constants.wait5seconds);


            // Close all
            await tabContainer.selectTabContextMenu(qaInfoJson, constants.closeAll);
            expect(await tabContainer.tabExists(`${ociConfig!.name} Info.json`)).toBe(false);
            expect(await tabContainer.tabExists(qaInfoJson)).toBe(false);
            expect(await tabContainer.tabExists(`${dbSystem} Info.json`)).toBe(false);
        });

    });

    describe("DATABASE CONNECTIONS", () => {

        beforeAll(async () => {

            try {
                await dbTreeSection.focus();
                const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await treeGlobalConn.expand(globalConn);
                await (await dbTreeSection
                    .getTreeItem((globalConn.basic as interfaces.IConnBasicMySQL).schema!)).expand();
                const treeTables = await dbTreeSection.getTreeItem("Tables");
                await treeTables.expand();
                await (await dbTreeSection.getTreeItem("Views")).expand();
                const treeFunctions = await dbTreeSection.getTreeItem("Functions");
                await treeFunctions.expand();
                const treeProcedures = await dbTreeSection.getTreeItem("Procedures");
                await treeProcedures.expand();
                const treeEvents = await dbTreeSection.getTreeItem("Events");
                await treeEvents.expand();
            } catch (e) {
                await Misc.storeScreenShot("beforeAll_DB_CLIPBOARD");
                throw e;
            }

        });

        beforeEach(async () => {
            await TestQueue.push(expect.getState().currentTestName!);
            await driver.wait(TestQueue.poll(expect.getState().currentTestName!), constants.queuePollTimeout);
        });

        afterEach(async () => {
            await TestQueue.pop(expect.getState().currentTestName!);

            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot();
            }
        });

        it("Copy paste and cut paste into the DB Connection dialog", async () => {
            try {
                await new E2ETabContainer().closeAllTabs();
                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
                const conDialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
                    constants.wait5seconds, "Connection dialog was not displayed");
                const hostNameInput = await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.hostname);
                const valueToCopy = await hostNameInput.getAttribute("value");
                await driver.wait(async () => {
                    await Os.keyboardSelectAll(hostNameInput);
                    await Os.keyboardCopy(hostNameInput);
                    const usernameInput = await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.username);
                    await Os.keyboardPaste(usernameInput);

                    return (await usernameInput.getAttribute("value")).includes(valueToCopy);
                }, constants.wait15seconds, `Could not copy paste ${valueToCopy} to user name field`);

                expect(await hostNameInput.getAttribute("value")).toBe(valueToCopy);
                const descriptionInput = await conDialog.findElement(locator.dbConnectionDialog.description);
                await DialogHelper.clearInputField(descriptionInput);
                await descriptionInput.sendKeys("testing");
                const valueToCut = await descriptionInput.getAttribute("value");
                await Os.keyboardSelectAll(descriptionInput);
                await Os.keyboardCut(descriptionInput);
                expect(await descriptionInput.getAttribute("value")).toBe("");
                const schemaInput = await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.defaultSchema);
                await Os.keyboardPaste(schemaInput);
                expect(await schemaInput.getAttribute("value")).toContain(valueToCut);
                await conDialog.findElement(locator.dbConnectionDialog.cancel).click();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Schema - Copy to Clipboard", async () => {
            try {
                const treeSchema = await dbTreeSection
                    .getTreeItem((globalConn.basic as interfaces.IConnBasicMySQL).schema!);

                await treeSchema.openContextMenuAndSelect([constants.copyToClipboard.exists,
                constants.copyToClipboard.name]);

                await driver.wait(Misc.untilNotificationExists(/The name was copied to the system clipboard/),
                    constants.wait3seconds);
                expect(await Os.readClipboard()).toBe((globalConn.basic as interfaces.IConnBasicMySQL).schema);
                await Misc.dismissNotifications();

                await treeSchema
                    .openContextMenuAndSelect([constants.copyToClipboard.exists,
                    constants.copyToClipboard.createStatement]);
                await driver.wait(Misc
                    .untilNotificationExists(/The CREATE statement was copied to the system clipboard/),
                    constants.wait3seconds);
                expect(await Os.readClipboard()).toContain("CREATE DATABASE");
                await Misc.dismissNotifications();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Table - Copy to Clipboard", async () => {
            try {
                const treeActor = await dbTreeSection.getTreeItem("actor");
                await treeActor.openContextMenuAndSelect([constants.copyToClipboard.exists,
                constants.copyToClipboard.name]);
                await driver.wait(Misc.untilNotificationExists(/The name was copied to the system clipboard/),
                    constants.wait3seconds);
                expect(await Os.readClipboard()).toBe("actor");
                await Misc.dismissNotifications();

                await treeActor.openContextMenuAndSelect([constants.copyToClipboard.exists,
                constants.copyToClipboard.createStatement]);

                await driver.wait(Misc
                    .untilNotificationExists(/The CREATE statement was copied to the system clipboard/),
                    constants.wait3seconds);
                expect(await Os.readClipboard()).toContain("CREATE TABLE");
                await Misc.dismissNotifications();
                const treeTables = await dbTreeSection.getTreeItem("Tables");
                await treeTables.collapse();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("View - Copy to Clipboard", async () => {
            try {
                const treeTestView = await dbTreeSection.getTreeItem(testView);
                await treeTestView.openContextMenuAndSelect([constants.copyToClipboard.exists,
                constants.copyToClipboard.createStatement]);

                await driver.wait(Misc
                    .untilNotificationExists(/The CREATE statement was copied to the system clipboard/),
                    constants.wait3seconds);
                expect(await Os.readClipboard()).toContain("AS select");
                await Misc.dismissNotifications();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Functions - Copy to Clipboard", async () => {
            try {
                const treeFunctions = await dbTreeSection.getTreeItem("Functions");
                await treeFunctions.expand();
                const treeFunction = await dbTreeSection.getTreeItem(testFunction);
                await treeFunction.openContextMenuAndSelect([constants.copyToClipboard.exists,
                constants.copyToClipboard.createStatement]);

                await driver.wait(Misc
                    .untilNotificationExists(/The CREATE statement was copied to the system clipboard/),
                    constants.wait3seconds);
                expect(await Os.readClipboard()).toMatch(/CREATE.*FUNCTION/);
                await Misc.dismissNotifications();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Events - Copy to Clipboard", async () => {
            try {
                const treeEvents = await dbTreeSection.getTreeItem("Events");
                await treeEvents.expand();
                const treeEvent = await dbTreeSection.getTreeItem(testEvent);
                await treeEvent.openContextMenuAndSelect([constants.copyToClipboard.exists,
                constants.copyToClipboard.name]);

                await driver.wait(Misc
                    .untilNotificationExists(/The name was copied to the system clipboard/),
                    constants.wait3seconds);
                await Misc.dismissNotifications();

                expect(await Os.readClipboard()).toBe(testEvent);
                await treeEvent.openContextMenuAndSelect([constants.copyToClipboard.exists,
                constants.copyToClipboard.createStatement]);

                await driver.wait(Misc
                    .untilNotificationExists(/The CREATE statement was copied to the system clipboard/),
                    constants.wait3seconds);
                expect(await Os.readClipboard()).toMatch(/CREATE.*EVENT/);
                await Misc.dismissNotifications();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Procedures - Copy to Clipboard", async () => {
            try {
                const treeProcedures = await dbTreeSection.getTreeItem("Procedures");
                await treeProcedures.expand();
                const treeProcedure = await dbTreeSection.getTreeItem(testProcedure);
                await treeProcedure.openContextMenuAndSelect([constants.copyToClipboard.exists,
                constants.copyToClipboard.createStatement]);

                await driver.wait(Misc
                    .untilNotificationExists(/The CREATE statement was copied to the system clipboard/),
                    constants.wait3seconds);
                expect(await Os.readClipboard()).toMatch(/CREATE.*PROCEDURE/);
                await Misc.dismissNotifications();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

    describe("RESULT GRIDS", () => {


        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        let notebook: E2ENotebook;

        beforeAll(async () => {
            try {
                await dbTreeSection.focus();
                await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption!), constants.wait5seconds);
                const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await (await treeGlobalConn.getActionButton(constants.openNewDatabaseConnectionOnNewTab))!.click();
                notebook = await new E2ENotebook().untilIsOpened(globalConn);
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
            } catch (e) {
                await Misc.storeScreenShot("beforeAll_RESULT_GRIDS_CLIPBOARD");
                throw e;
            }

        });

        beforeEach(async () => {
            await TestQueue.push(expect.getState().currentTestName!);
            await driver.wait(TestQueue.poll(expect.getState().currentTestName!), constants.queuePollTimeout);
        });

        afterEach(async () => {
            await TestQueue.pop(expect.getState().currentTestName!);

            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot();
            }
        });

        it("Result grid context menu - Copy multiple rows", async () => {
            try {
                const maxRows = 2;
                const result = await notebook.codeEditor
                    .execute(`select * from sakila.actor limit ${maxRows};`) as E2ECommandResultGrid;
                expect(result.status).toMatch(/OK/);
                const row = 0;
                const column = "first_name";

                // Copy all rows.
                await driver.wait(async () => {
                    const copy = await result.copyAllRows(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait3seconds, `Copy all rows failed`);

                // Copy all rows with names.
                await driver.wait(async () => {
                    const copy = await result.copyAllRowsWithNames(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait3seconds, `Copy all rows with names failed`);

                // Copy all rows unquoted.
                await driver.wait(async () => {
                    const copy = await result.copyAllRowsUnquoted(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait3seconds, `Copy all rows unquoted failed`);

                // Copy all rows with names unquoted.
                await driver.wait(async () => {
                    const copy = await result.copyAllRowsWithNamesUnquoted(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait3seconds, `Copy all rows with names unquoted failed`);

                // Copy all rows with names tab separated.
                await driver.wait(async () => {
                    const copy = await result.copyAllRowsWithNamesTabSeparated(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait3seconds, `Copy all rows with names tab separated failed`);

            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Result grid context menu - Copy field, copy field unquoted, set field to null", async () => {
            try {
                const result = await notebook.codeEditor
                    .execute("select * from sakila.result_sets;") as E2ECommandResultGrid;
                expect(result.status).toMatch(/OK/);

                const row = 0;
                const allColumns = Array.from(result.columnsMap!.keys());

                for (let i = 1; i <= allColumns.length - 1; i++) {

                    await driver.wait(async () => {
                        const copy = await result.copyField(row, String(allColumns[i]));
                        const clip = await Os.readClipboard();

                        if (copy.toString().match(new RegExp(clip!.toString()))) {
                            return true;
                        } else {
                            console.log(`expected: ${copy.toString()}. Got from clipboard: ${clip!.toString()}`);
                        }
                    }, constants.wait10seconds, "Copy field failed");

                    await driver.wait(async () => {
                        const copy = await result.copyFieldUnquoted(row, String(allColumns[i]));
                        const clip = await Os.readClipboard();

                        if (copy.toString() === clip!.toString()) {
                            return true;
                        } else {
                            console.log(`expected: ${copy.toString()}. Got from clipboard: ${clip!.toString()}`);
                        }
                    }, constants.wait10seconds, "Copy field unquoted failed");

                    await result.openCellContextMenuAndSelect(row, String(allColumns[i]),
                        constants.resultGridContextMenu.setFieldToNull);
                    expect(await result.getCellValue(row, String(allColumns[i]))).toContain(constants.isNull);
                }

                await result.rollbackChanges();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Result grid context menu - Copy single row", async () => {
            try {
                const result = await notebook.codeEditor
                    .execute("select * from sakila.actor limit 1;") as E2ECommandResultGrid;
                expect(result.status).toMatch(/OK/);

                const row = 0;
                const column = "first_name";

                // Copy row.
                await driver.wait(async () => {
                    const copy = await result.copyRow(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait10seconds, `Copy row failed`);

                // Copy row with names.
                await driver.wait(async () => {
                    const copy = await result.copyRowWithNames(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait10seconds, `Copy row with names failed`);

                // Copy row unquoted.
                await driver.wait(async () => {
                    const copy = await result.copyRowUnquoted(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait10seconds, `Copy row unquoted failed`);

                // Copy row with names, unquoted.
                await driver.wait(async () => {
                    const copy = await result.copyRowWithNamesUnquoted(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait10seconds, `Copy row with names, unquoted failed`);

                // Copy row with names, tab separated.
                await driver.wait(async () => {
                    const copy = await result.copyRowWithNamesTabSeparated(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait10seconds, `Copy row with names, tab separated failed`);

                // Copy row, tab separated.
                await driver.wait(async () => {
                    const copy = await result.copyRowTabSeparated(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait10seconds, `Copy row, tab separated failed`);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Result grid context menu - Copy field, copy field unquoted, set field to null", async () => {
            try {
                const result = await notebook.codeEditor
                    .execute("select * from sakila.result_sets;") as E2ECommandResultGrid;
                expect(result.status).toMatch(/OK/);

                const row = 0;
                const allColumns = Array.from(result.columnsMap!.keys());

                for (let i = 1; i <= allColumns.length - 1; i++) {

                    await driver.wait(async () => {
                        const copy = await result.copyField(row, String(allColumns[i]));
                        const clip = await Os.readClipboard();

                        if (copy.toString().match(new RegExp(clip!.toString()))) {
                            return true;
                        } else {
                            console.log(`expected: ${copy.toString()}. Got from clipboard: ${clip!.toString()}`);
                        }
                    }, constants.wait10seconds, "Copy field failed");

                    await driver.wait(async () => {
                        const copy = await result.copyFieldUnquoted(row, String(allColumns[i]));
                        const clip = await Os.readClipboard();

                        if (copy.toString() === clip!.toString()) {
                            return true;
                        } else {
                            console.log(`expected: ${copy.toString()}. Got from clipboard: ${clip!.toString()}`);
                        }
                    }, constants.wait10seconds, "Copy field unquoted failed");

                    await result.openCellContextMenuAndSelect(row, String(allColumns[i]),
                        constants.resultGridContextMenu.setFieldToNull);
                    expect(await result.getCellValue(row, String(allColumns[i]))).toContain(constants.isNull);
                }

                await result.rollbackChanges();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

    describe("NOTEBOOKS", () => {

        let notebook: E2ENotebook;

        beforeAll(async () => {
            try {
                const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await (await treeGlobalConn.getActionButton(constants.openNewDatabaseConnectionOnNewTab))!.click();
                notebook = await new E2ENotebook().untilIsOpened(globalConn);
            } catch (e) {
                await Misc.storeScreenShot("beforeAll_NOTEBOOKS_clipboard");
                throw e;
            }

        });

        beforeEach(async () => {
            await TestQueue.push(expect.getState().currentTestName!);
            await driver.wait(TestQueue.poll(expect.getState().currentTestName!), constants.queuePollTimeout);
        });

        afterEach(async () => {
            await TestQueue.pop(expect.getState().currentTestName!);

            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot();
            }
        });

        it("Copy paste into notebook", async () => {
            try {
                await notebook.codeEditor.clean();
                const filename = "users.sql";
                const destFile = join(process.cwd(), "src", "tests", "e2e", "sql", filename);
                const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await treeGlobalConn.openContextMenuAndSelect(constants.loadSQLScriptFromDisk);
                await Misc.uploadFile(destFile);
                await driver.wait(async () => {
                    return ((await notebook.toolbar.editorSelector.getCurrentEditor()).label) === filename;
                }, constants.wait5seconds, `Current editor is not ${filename}`);

                let textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
                await Os.keyboardSelectAll(textArea);
                await Os.keyboardCopy(textArea);
                await (await new E2ETabContainer().getTab(globalConn.caption!))?.click();

                textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
                await driver.executeScript("arguments[0].click()", textArea);
                await Os.keyboardPaste(textArea);

                const sakilaFile = await fs.readFile(join(process.cwd(), "src", "tests", "e2e", "sql", filename));
                const fileLines = sakilaFile.toString().split("\n");
                const widget = await new E2ECodeEditorWidget(notebook).open();

                try {
                    for (const line of fileLines) {
                        if (line.trim() !== "") {
                            await widget.setTextToFind(line.substring(0, 150).replace(/`|;/gm, ""));
                            await driver.wait(widget.untilMatchesCount(/1 of (\d+)/), constants.wait2seconds);
                        }
                    }
                } finally {
                    await widget.close();
                    await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.dbNotebook));
                }
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Cut paste into notebook", async () => {
            try {
                const sentence1 = "select * from sakila.actor";
                const sentence2 = "select * from sakila.address";
                await notebook.codeEditor.clean();
                await notebook.codeEditor.write(sentence1);
                await notebook.codeEditor.setNewLine();
                await notebook.codeEditor.write(sentence2);
                const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
                await Os.keyboardSelectAll(textArea);
                await Os.keyboardCut(textArea);
                expect(await notebook.exists(sentence1)).toBe(false);
                expect(await notebook.exists(sentence2)).toBe(false);
                await Os.keyboardPaste(textArea);
                expect(await notebook.exists(sentence1)).toBe(true);
                expect(await notebook.exists(sentence2)).toBe(true);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Copy to clipboard button", async () => {
            try {
                await notebook.codeEditor.clean();
                const result = await notebook.codeEditor.execute("\\about ") as E2ECommandResultData;
                await driver.wait(async () => {
                    await result.copyToClipboard();

                    return (await Os.readClipboard())!.includes("Welcome");
                }, constants.wait3seconds, `'Welcome keyword' was not found on the clipboard`);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

});

