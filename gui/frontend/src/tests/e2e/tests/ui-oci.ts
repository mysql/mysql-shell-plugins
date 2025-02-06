/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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
import { E2ETabContainer } from "../lib/E2ETabContainer.js";
import { E2EToastNotification } from "../lib/E2EToastNotification.js";
import { E2ESettings } from "../lib/E2ESettings.js";
import { E2ECommandResultData } from "../lib/CommandResults/E2ECommandResultData.js";
import { E2ETreeItem } from "../lib/SideBar/E2ETreeItem.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));
let testFailed = false;
let ociConfig: interfaces.IOciProfileConfig | undefined;
let ociTree: string[];
let e2eProfile: string | undefined;
let treeE2eProfile: E2ETreeItem | undefined;
const ociTreeSection = new E2EAccordionSection(constants.ociTreeSection);
const tabContainer = new E2ETabContainer();

describe("OCI", () => {

    beforeAll(async () => {
        await loadDriver(true);
        await driver.get(url);
        const configs = await Misc.mapOciConfig();
        ociConfig = configs.find((item: interfaces.IOciProfileConfig) => {
            return item.name = "E2ETESTS";
        })!;

        e2eProfile = `${ociConfig.name} (${ociConfig.region})`;
        ociTree = [e2eProfile, "/ (Root Compartment)", "QA", "MySQLShellTesting"];

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
            await driver.wait(ociTreeSection.untilTreeItemExists(ociTree[0]), constants.wait5seconds);
            await Misc.dismissNotifications(true);
            treeE2eProfile = await ociTreeSection.getTreeItem(ociTree[0]);
            await treeE2eProfile.openContextMenuAndSelect(constants.setAsNewDefaultConfigProfile);
            await driver.wait(treeE2eProfile.untilIsDefault(), constants.wait5seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Set as Current Compartment", async () => {
        try {
            await ociTreeSection.expandTree(ociTree);
            await Misc.dismissNotifications(true);
            const treeCompartment = await ociTreeSection.getTreeItem(ociTree[2]);
            await treeCompartment.openContextMenuAndSelect(constants.setAsCurrentCompartment);

            const notification = (await new E2EToastNotification().create())!;
            expect(notification.message)
                // eslint-disable-next-line max-len
                .toBe(`${String(ociTree[2]).replaceAll("/", "")} in ${ociConfig?.name} is now the current compartment.`);
            await notification.close();

            await driver.wait(treeCompartment.untilIsDefault(), constants.wait3seconds);

            const slicedOciTree = ociTree;
            slicedOciTree.splice(0, 2);
            await ociTreeSection.expandTree(slicedOciTree);
            await Misc.dismissNotifications(true);

            const shellConsole = new E2EShellConsole();
            await shellConsole.openNewShellConsole();
            await driver.wait(shellConsole.untilIsOpened(undefined), constants.wait5seconds * 3,
                "Shell Console was not loaded");
            const result = await shellConsole.codeEditor
                .execute("mds.get.currentCompartmentId()") as E2ECommandResultData;
            expect(result.text).toContain("ocid1");
        } catch (e) {
            await Misc.storeScreenShot();
            throw e;
        }
    });

    it("Set as Current Bastion", async () => {
        try {
            await ociTreeSection.expandTree(ociTree);
            await Misc.dismissNotifications(true);
            const treeCompartment = await ociTreeSection.getTreeItem(ociTree[ociTree.length - 1]);
            await driver.wait(treeCompartment.untilHasChildren(), constants.wait20seconds);

            const bastion = await ociTreeSection.getOciItemByType(constants.bastionType);
            const expected1 = `Setting current bastion to ${bastion} ...`;
            const expected2 = `Current bastion set to ${bastion}.`;

            const treeBastion = await ociTreeSection.getTreeItem(bastion);

            await driver.wait(async () => {
                await treeBastion.openContextMenuAndSelect(constants.setAsCurrentBastion);
                const notifications = await Misc.getToastNotifications(true);
                for (const notification of notifications) {
                    if (notification?.message !== expected1 && notification?.message !== expected2) {
                        throw new Error(`Notification message should be '${expected1}' or '${expected2}'`);
                    } else {
                        return true;
                    }
                }
            }, constants.wait10seconds, `Could not find any notification`);

            await driver.wait(treeBastion.untilIsDefault(),
                constants.wait10seconds, "Bastion is not the default item");
        } catch (e) {
            await Misc.storeScreenShot();
            throw e;
        }
    });

});

