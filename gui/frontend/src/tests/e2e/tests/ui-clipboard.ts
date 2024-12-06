/*
 * Copyright (c) 2024 Oracle and/or its affiliates.
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
import { E2EToastNotification } from "../lib/E2EToastNotification.js";
import { E2ESettings } from "../lib/E2ESettings.js";
import { E2ETextEditor } from "../lib/E2ETextEditor.js";
import { E2ECodeEditorWidget } from "../lib/E2ECodeEditorWidget.js";
import { E2ETabContainer } from "../lib/E2ETabContainer.js";
import { TestQueue } from "../lib/TestQueue.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));
const testView = `test_view`;
const testEvent = "test_event";
const testProcedure = "test_procedure";
const testFunction = "test_function";
let testFailed = false;
let ociConfig: interfaces.IOciProfileConfig | undefined;
let ociTree: RegExp[];
let treeE2eProfile: string | undefined;
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
        await driver.wait(dbTreeSection.tree.untilExists(globalConn.caption!), constants.wait3seconds);
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
            treeE2eProfile = `${ociConfig.name} (${ociConfig.region})`;

            ociTree = [new RegExp(`E2ETESTS \\(${ociConfig.region}\\)`),
            new RegExp("\\(Root Compartment\\)"), /QA/, /MySQLShellTesting/];

            try {
                await ociTreeSection.focus();
                await ociTreeSection.tree.expandElement(ociTree, constants.wait25seconds);
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
                await ociTreeSection.tree.openContextMenuAndSelect(treeE2eProfile!,
                    constants.viewConfigProfileInformation);
                expect(await tabContainer.getTab(`${ociConfig!.name} Info.json`)).toBeDefined();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("View Compartment Information", async () => {
            try {
                const qaInfoJson = `${ociTree[2].source} Info.json`;
                await ociTreeSection.tree.openContextMenuAndSelect(ociTree[2],
                    constants.viewCompartmentInformation);
                await driver.wait(tabContainer.untilTabIsOpened(qaInfoJson), constants.wait5seconds);
                const textEditor = new E2ETextEditor();
                await driver.wait(textEditor.untilIsJson(), constants.wait5seconds);
                process.env.COMPARTMENT_ID = JSON.parse(await textEditor.getText()).id;
                await tabContainer.closeAllTabs();
            } catch (e) {
                await Misc.storeScreenShot();
                throw e;
            }
        });

        it("View DB System Information", async () => {
            try {
                const treeDbSystem = await ociTreeSection.tree.getOciElementByType(constants.dbSystemType);
                await ociTreeSection.tree.openContextMenuAndSelect(treeDbSystem, constants.viewDBSystemInformation);
                await driver.wait(tabContainer.untilTabIsOpened(`${treeDbSystem} Info.json`),
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
                const treeBastion = await ociTreeSection.tree.getOciElementByType(constants.bastionType);
                await ociTreeSection.tree.openContextMenuAndSelect(treeBastion, constants.getBastionInformation);
                await driver.wait(tabContainer.untilTabIsOpened(`${treeBastion} Info.json`), constants.wait5seconds);
                const textEditor = new E2ETextEditor();
                await driver.wait(textEditor.untilIsJson(), constants.wait5seconds);
                await tabContainer.closeTab(new RegExp(`${treeBastion} Info.json`));
            } catch (e) {
                await Misc.storeScreenShot();
                throw e;
            }
        });

        it("View Compute Instance Information", async () => {
            try {
                const treeComputeInstance = await ociTreeSection.tree.getOciElementByType(constants.ociComputeType);
                await ociTreeSection.tree.openContextMenuAndSelect(treeComputeInstance,
                    constants.viewComputeInstanceInformation);
                await driver.wait(tabContainer.untilTabIsOpened(`${treeComputeInstance} Info.json`),
                    constants.wait5seconds);
                const textEditor = new E2ETextEditor();
                await driver.wait(textEditor.untilIsJson(), constants.wait5seconds);
            } catch (e) {
                await Misc.storeScreenShot();
                throw e;
            }
        });

    });

    describe("DATABASE CONNECTIONS", () => {

        beforeAll(async () => {

            try {
                await dbTreeSection.focus();
                await dbTreeSection.tree.expandDatabaseConnection(globalConn);
                await dbTreeSection.tree.expandElement([(globalConn.basic as interfaces.IConnBasicMySQL).schema!]);
                await dbTreeSection.tree.expandElement(["Tables"]);
                await dbTreeSection.tree.expandElement(["Views"]);
                await dbTreeSection.tree.expandElement(["Functions"]);
                await dbTreeSection.tree.expandElement(["Procedures"]);
                await dbTreeSection.tree.expandElement(["Events"]);

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
                await dbTreeSection.tree
                    .openContextMenuAndSelect((globalConn.basic as interfaces.IConnBasicMySQL)
                        .schema!, [constants.copyToClipboard.exists, constants.copyToClipboard.name]);
                let notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The name was copied to the system clipboard");
                await notification!.close();
                expect(await Os.readClipboard()).toBe((globalConn.basic as interfaces.IConnBasicMySQL).schema);

                await dbTreeSection.tree
                    .openContextMenuAndSelect((globalConn.basic as interfaces.IConnBasicMySQL)
                        .schema!, [constants.copyToClipboard.exists, constants.copyToClipboard.createStatement]);
                notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The CREATE statement was copied to the system clipboard");
                await notification!.close();
                expect(await Os.readClipboard()).toContain("CREATE DATABASE");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Table - Copy to Clipboard", async () => {
            try {
                await dbTreeSection.tree.openContextMenuAndSelect("actor",
                    [constants.copyToClipboard.exists, constants.copyToClipboard.name]);
                let notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The name was copied to the system clipboard");
                await notification!.close();
                expect(await Os.readClipboard()).toBe("actor");

                await dbTreeSection.tree.openContextMenuAndSelect("actor",
                    [constants.copyToClipboard.exists, constants.copyToClipboard.createStatement]);
                notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The CREATE statement was copied to the system clipboard");
                await notification!.close();
                expect(await Os.readClipboard()).toContain("CREATE TABLE");
                await dbTreeSection.tree.collapseElement("Tables");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("View - Copy to Clipboard", async () => {
            try {
                await dbTreeSection.tree.openContextMenuAndSelect(testView,
                    [constants.copyToClipboard.exists, constants.copyToClipboard.createStatement]);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The CREATE statement was copied to the system clipboard");
                await notification!.close();
                expect(await Os.readClipboard()).toContain("AS select");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Functions - Copy to Clipboard", async () => {
            try {
                await dbTreeSection.tree.expandElement(["Functions"]);
                await dbTreeSection.tree.openContextMenuAndSelect(testFunction,
                    [constants.copyToClipboard.exists, constants.copyToClipboard.createStatement]);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The CREATE statement was copied to the system clipboard");
                await notification!.close();
                expect(await Os.readClipboard()).toMatch(/CREATE.*FUNCTION/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Events - Copy to Clipboard", async () => {
            try {
                await dbTreeSection.tree.expandElement(["Events"]);
                await dbTreeSection.tree.openContextMenuAndSelect(testEvent,
                    [constants.copyToClipboard.exists, constants.copyToClipboard.name]);

                let notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The name was copied to the system clipboard");
                await notification!.close();

                expect(await Os.readClipboard()).toBe(testEvent);
                await dbTreeSection.tree.openContextMenuAndSelect(testEvent,
                    [constants.copyToClipboard.exists, constants.copyToClipboard.createStatement]);

                notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The CREATE statement was copied to the system clipboard");
                await notification!.close();
                expect(await Os.readClipboard()).toMatch(/CREATE.*EVENT/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Procedures - Copy to Clipboard", async () => {
            try {
                await dbTreeSection.tree.expandElement(["Procedures"]);
                await dbTreeSection.tree.openContextMenuAndSelect(testProcedure,
                    [constants.copyToClipboard.exists, constants.copyToClipboard.createStatement]);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The CREATE statement was copied to the system clipboard");
                await notification!.close();
                expect(await Os.readClipboard()).toMatch(/CREATE.*PROCEDURE/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

    describe("RESULT GRIDS", () => {


        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const notebook = new E2ENotebook();

        beforeAll(async () => {
            try {
                await dbTreeSection.focus();
                await driver.wait(dbTreeSection.tree.untilExists(globalConn.caption!), constants.wait5seconds);
                await (await dbTreeSection.tree.getActionButton(globalConn.caption!,
                    constants.openNewDatabaseConnectionOnNewTab))!.click();
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
                await notebook.codeEditor.loadCommandResults();
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
                    .execute(`select * from sakila.actor limit ${maxRows};`);
                expect(result.toolbar!.status).toMatch(/OK/);
                const row = 0;
                const column = "first_name";

                // Copy all rows.
                await driver.wait(async () => {
                    const copy = await result.grid!.copyAllRows(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait3seconds, `Copy all rows failed`);

                // Copy all rows with names.
                await driver.wait(async () => {
                    const copy = await result.grid!.copyAllRowsWithNames(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait3seconds, `Copy all rows with names failed`);

                // Copy all rows unquoted.
                await driver.wait(async () => {
                    const copy = await result.grid!.copyAllRowsUnquoted(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait3seconds, `Copy all rows unquoted failed`);

                // Copy all rows with names unquoted.
                await driver.wait(async () => {
                    const copy = await result.grid!.copyAllRowsWithNamesUnquoted(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait3seconds, `Copy all rows with names unquoted failed`);

                // Copy all rows with names tab separated.
                await driver.wait(async () => {
                    const copy = await result.grid!.copyAllRowsWithNamesTabSeparated(row, column);
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
                const result = await notebook.codeEditor.execute("select * from sakila.result_sets;");
                expect(result.toolbar!.status).toMatch(/OK/);

                const row = 0;
                const allColumns = Array.from(result.grid!.columnsMap!.keys());

                for (let i = 1; i <= allColumns.length - 1; i++) {

                    await driver.wait(async () => {
                        const copy = await result.grid!.copyField(row, String(allColumns[i]));
                        const clip = await Os.readClipboard();

                        if (copy.toString().match(new RegExp(clip!.toString()))) {
                            return true;
                        } else {
                            console.log(`expected: ${copy.toString()}. Got from clipboard: ${clip!.toString()}`);
                        }
                    }, constants.wait10seconds, "Copy field failed");

                    await driver.wait(async () => {
                        const copy = await result.grid!.copyFieldUnquoted(row, String(allColumns[i]));
                        const clip = await Os.readClipboard();

                        if (copy.toString() === clip!.toString()) {
                            return true;
                        } else {
                            console.log(`expected: ${copy.toString()}. Got from clipboard: ${clip!.toString()}`);
                        }
                    }, constants.wait10seconds, "Copy field unquoted failed");

                    await result.grid!.openCellContextMenuAndSelect(row, String(allColumns[i]),
                        constants.resultGridContextMenu.setFieldToNull);
                    expect(await result.grid!.getCellValue(row, String(allColumns[i]))).toBe(constants.isNull);
                }

                await result.toolbar!.rollbackChanges();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Result grid context menu - Copy single row", async () => {
            try {
                const result = await notebook.codeEditor.execute("select * from sakila.actor limit 1;");
                expect(result.toolbar!.status).toMatch(/OK/);

                const row = 0;
                const column = "first_name";

                // Copy row.
                await driver.wait(async () => {
                    const copy = await result.grid!.copyRow(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait10seconds, `Copy row failed`);

                // Copy row with names.
                await driver.wait(async () => {
                    const copy = await result.grid!.copyRowWithNames(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait10seconds, `Copy row with names failed`);

                // Copy row unquoted.
                await driver.wait(async () => {
                    const copy = await result.grid!.copyRowUnquoted(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait10seconds, `Copy row unquoted failed`);

                // Copy row with names, unquoted.
                await driver.wait(async () => {
                    const copy = await result.grid!.copyRowWithNamesUnquoted(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait10seconds, `Copy row with names, unquoted failed`);

                // Copy row with names, tab separated.
                await driver.wait(async () => {
                    const copy = await result.grid!.copyRowWithNamesTabSeparated(row, column);
                    const clipboard = await Os.getClipboardContent();

                    if (copy.toString() === clipboard!.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard!.toString()}`);
                    }
                }, constants.wait10seconds, `Copy row with names, tab separated failed`);

                // Copy row, tab separated.
                await driver.wait(async () => {
                    const copy = await result.grid!.copyRowTabSeparated(row, column);
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
                const result = await notebook.codeEditor.execute("select * from sakila.result_sets;");
                expect(result.toolbar!.status).toMatch(/OK/);

                const row = 0;
                const allColumns = Array.from(result.grid!.columnsMap!.keys());

                for (let i = 1; i <= allColumns.length - 1; i++) {

                    await driver.wait(async () => {
                        const copy = await result.grid!.copyField(row, String(allColumns[i]));
                        const clip = await Os.readClipboard();

                        if (copy.toString().match(new RegExp(clip!.toString()))) {
                            return true;
                        } else {
                            console.log(`expected: ${copy.toString()}. Got from clipboard: ${clip!.toString()}`);
                        }
                    }, constants.wait10seconds, "Copy field failed");

                    await driver.wait(async () => {
                        const copy = await result.grid!.copyFieldUnquoted(row, String(allColumns[i]));
                        const clip = await Os.readClipboard();

                        if (copy.toString() === clip!.toString()) {
                            return true;
                        } else {
                            console.log(`expected: ${copy.toString()}. Got from clipboard: ${clip!.toString()}`);
                        }
                    }, constants.wait10seconds, "Copy field unquoted failed");

                    await result.grid!.openCellContextMenuAndSelect(row, String(allColumns[i]),
                        constants.resultGridContextMenu.setFieldToNull);
                    expect(await result.grid!.getCellValue(row, String(allColumns[i]))).toBe(constants.isNull);
                }

                await result.toolbar!.rollbackChanges();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

    describe("NOTEBOOKS", () => {

        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const notebook = new E2ENotebook();

        beforeAll(async () => {
            try {
                await (await dbTreeSection.tree.getActionButton(globalConn.caption!,
                    constants.openNewDatabaseConnectionOnNewTab))!.click();
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
                await notebook.codeEditor.loadCommandResults();
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
                await dbTreeSection.tree.openContextMenuAndSelect(globalConn.caption!, constants.loadSQLScriptFromDisk);
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
                const result = await notebook.codeEditor.execute("\\about ");
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

