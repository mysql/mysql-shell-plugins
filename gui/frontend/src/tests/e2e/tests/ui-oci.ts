/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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
import { driver, loadDriver } from "../lib/driver.js";
import { Misc } from "../lib/misc.js";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection.js";
import { Os } from "../lib/os.js";
import * as constants from "../lib/constants.js";
import * as interfaces from "../lib/interfaces.js";
import { E2EShellConsole } from "../lib/E2EShellConsole.js";
import { E2ENotebook } from "../lib/E2ENotebook.js";
import { E2ETabContainer } from "../lib/E2ETabContainer.js";
import { E2EToastNotification } from "../lib/E2EToastNotification.js";
import { DatabaseConnectionDialog } from "../lib/Dialogs/DatabaseConnectionDialog.js";
import { E2EDatabaseConnectionOverview } from "../lib/E2EDatabaseConnectionOverview.js";
import { E2ESettings } from "../lib/E2ESettings.js";
import { ResultData } from "../lib/CommandResults/ResultData.js";
import { ResultGrid } from "../lib/CommandResults/ResultGrid.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));
let testFailed = false;
let ociConfig: interfaces.IOciProfileConfig | undefined;
let ociTree: RegExp[];
let treeE2eProfile: string | undefined;
const ociTreeSection = new E2EAccordionSection(constants.ociTreeSection);
const tabContainer = new E2ETabContainer();
let mdsEndPoint: string | undefined;
let dbSystemID: string | undefined;
let bastionID: string | undefined;
let ociFailure = false;

describe("OCI", () => {

    beforeAll(async () => {
        await loadDriver(true);
        await driver.get(url);
        const configs = await Misc.mapOciConfig();
        ociConfig = configs.find((item: interfaces.IOciProfileConfig) => {
            return item.name = "E2ETESTS";
        })!;
        treeE2eProfile = `${ociConfig.name} (${ociConfig.region})`;

        ociTree = [new RegExp(`E2ETESTS \\(${ociConfig.region}\\)`),
        new RegExp("\\(Root Compartment\\)"), /QA/, /MySQLShellTesting/];

        try {
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
            const settings = new E2ESettings();
            await settings.open();
            await settings.selectCurrentTheme(constants.darkModern);
            await settings.close();
            await ociTreeSection.focus();
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_OCI");
            throw e;
        }

    });

    beforeEach(async () => {
        try {
            await ociTreeSection.tree.expandElement(ociTree, constants.wait25seconds);
            await Misc.dismissNotifications(true);
        } catch (e) {
            await Misc.storeScreenShot("beforeEach_OCI");
            throw e;
        }
    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }

        await tabContainer.closeAllTabs();
    });

    it("Set as New Default Config Profile", async () => {
        try {
            await ociTreeSection.tree.openContextMenuAndSelect(treeE2eProfile!,
                constants.setAsNewDefaultConfigProfile);
            await driver.wait(ociTreeSection.tree.untilIsDefault(treeE2eProfile!,
                "profile"), constants.wait5seconds,
                "E2e tests is not the default item");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Set as Current Compartment", async () => {
        try {
            await Misc.dismissNotifications(true);
            await ociTreeSection.tree.openContextMenuAndSelect(ociTree[2],
                constants.setAsCurrentCompartment);
            const notification = (await new E2EToastNotification().create())!;
            expect(notification.message)
                // eslint-disable-next-line max-len
                .toBe(`${String(ociTree[2]).replaceAll("/", "")} in ${ociConfig?.name} is now the current compartment.`);
            await notification.close();

            await driver.wait(ociTreeSection.tree.untilIsDefault(ociTree[2].source, "compartment"),
                constants.wait3seconds, `${ociTree[2].source} should be marked as default on the tree`);
            const slicedOciTree = ociTree;
            slicedOciTree.splice(0, 2);
            await ociTreeSection.tree.expandElement(slicedOciTree, constants.wait5seconds * 5);
            await Misc.dismissNotifications(true);

            const shellConsole = new E2EShellConsole();
            await shellConsole.openNewShellConsole();
            await driver.wait(shellConsole.untilIsOpened(), constants.wait5seconds * 3,
                "Shell Console was not loaded");
            const result = await shellConsole.codeEditor.execute("mds.get.currentCompartmentId()") as ResultData;
            expect(result.text).toContain("ocid1");
        } catch (e) {
            await Misc.storeScreenShot();
            throw e;
        }
    });

    it("Create connection with Bastion Service", async () => {
        try {
            const treeDbSystem = await ociTreeSection.tree.getOciElementByType(constants.dbSystemType);

            if (!await ociTreeSection.tree.isDBSystemStopped(treeDbSystem)) {
                await ociTreeSection.tree.openContextMenuAndSelect(treeDbSystem,
                    constants.createConnectionWithBastionService);
                const mdsConnection = await DatabaseConnectionDialog.getConnectionDetails();
                expect(mdsConnection.caption).toBe(treeDbSystem);
                expect(mdsConnection.description)
                    .toBe("DB System used to test the MySQL Shell for VSCode Extension.");

                if (interfaces.isMySQLConnection(mdsConnection.basic)) {
                    expect(mdsConnection.basic.hostname).toMatch(/(\d+).(\d+).(\d+).(\d+)/);
                    mdsEndPoint = mdsConnection.basic.hostname;
                    mdsConnection.basic.username = process.env.OCI_BASTION_USERNAME;
                    mdsConnection.basic.password = process.env.OCI_BASTION_PASSWORD;
                    dbSystemID = mdsConnection.mds!.dbSystemOCID;
                    bastionID = mdsConnection.mds!.bastionOCID;
                    mdsConnection.advanced = undefined;
                    mdsConnection.mds = undefined;
                    mdsConnection.ssh = undefined;
                    mdsConnection.ssl = undefined;
                    mdsConnection.caption = `e2e${mdsConnection.caption}`;
                    await DatabaseConnectionDialog.setConnection(mdsConnection);
                } else {
                    throw new Error("The MDS connection should be a MySQL type");
                }

                const mds = await new E2EDatabaseConnectionOverview().getConnection(treeDbSystem);
                await mds.click();
                await driver.wait(new E2ENotebook().untilIsOpened(mdsConnection), constants.wait1minute)
                    .catch((e) => {
                        if (String(e).includes(constants.ociFailure)) {
                            ociFailure = true;
                        }
                    });

                if (ociFailure) {
                    return; // No connection to OCI, skipping test
                }
                const notebook = await new E2ENotebook().untilIsOpened(mdsConnection);
                const result = await notebook.codeEditor.execute("select version();") as ResultGrid;
                expect(result.status).toMatch(/OK/);
            } else {
                ociFailure = true;

                return;
            }
        } catch (e) {
            await Misc.storeScreenShot();
            throw e;
        }
    });

    it("Set as Current Bastion", async () => {
        try {
            const treeBastion = await ociTreeSection.tree.getOciElementByType(constants.bastionType);
            const expected1 = `Setting current bastion to ${treeBastion} ...`;
            const expected2 = `Current bastion set to ${treeBastion}.`;

            await driver.wait(async () => {
                await ociTreeSection.tree.openContextMenuAndSelect(treeBastion, constants.setAsCurrentBastion);
                const notifications = await Misc.getToastNotifications(true);
                for (const notification of notifications) {
                    if (notification?.message !== expected1 && notification?.message !== expected2) {
                        throw new Error(`Notification message should be '${expected1}' or '${expected2}'`);
                    } else {
                        return true;
                    }
                }
            }, constants.wait10seconds, `Could not find any notification`);

            await driver.wait(ociTreeSection.tree.untilIsDefault(treeBastion, "bastion"),
                constants.wait10seconds, "Bastion is not the default item");

            const shellConsole = new E2EShellConsole();
            await shellConsole.openNewShellConsole();
            await driver.wait(shellConsole.untilIsOpened(), constants.wait15seconds,
                "Shell Console was not loaded");
            const result = await shellConsole.codeEditor.execute("mds.get.currentBastionId()") as ResultData;
            expect(result.text).toBe(bastionID);
        } catch (e) {
            await Misc.storeScreenShot();
            throw e;
        }
    });

    it("Create a new MDS Connection", async () => {
        try {
            if (ociFailure) {
                return; // There was an issue connection to OCI, so we skip the test
            }

            const treeDbSystem = await ociTreeSection.tree.getOciElementByType(constants.dbSystemType);

            if (await ociTreeSection.tree.isDBSystemStopped(treeDbSystem)) {
                return; // skip the test
            }

            const localConn: interfaces.IDBConnection = {
                dbType: "MySQL",
                caption: "e2eLocalMDSConnection",
                description: "Local connection",
                basic: {
                    hostname: mdsEndPoint,
                    username: process.env.OCI_BASTION_USERNAME,
                    password: process.env.OCI_BASTION_PASSWORD,
                    port: 3306,
                    ociBastion: true,
                },
                mds: {
                    profile: "E2ETESTS",
                    sshPrivateKey: "id_rsa_mysql_shell",
                    sshPublicKey: "id_rsa_mysql_shell.pub",
                    dbSystemOCID: dbSystemID,
                    bastionOCID: bastionID,
                },
            };

            const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
            await dbTreeSection.focus();
            await dbTreeSection.createDatabaseConnection(localConn);
            await tabContainer.closeAllTabs();
            await driver.executeScript("arguments[0].click()",
                await dbTreeSection.tree.getActionButton(localConn.caption!,
                    constants.openNewDatabaseConnectionOnNewTab));

            const notebook = await new E2ENotebook().untilIsOpened(localConn, constants.wait25seconds);
            const result = await notebook.codeEditor.execute("select version();") as ResultGrid;
            expect(result.status).toMatch(/OK/);
        } catch (e) {
            await Misc.storeScreenShot();
            throw e;
        }
    });

});

