/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
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
    Condition,
    ActivityBar,
    By,
    EditorView,
    BottomBarPanel,
    logging,
} from "vscode-extension-tester";
import * as constants from "./constants";
import { Misc, driver } from "./misc";

export let credentialHelperOk = true;

export const isNotLoading = (section: string): Condition<boolean> => {
    return new Condition("Is not loading", async () => {
        const sec = await Misc.getSection(section);
        const loading = await sec.findElements(By.css(".monaco-progress-container.active"));
        const activityBar = new ActivityBar();
        const icon = await activityBar.getViewControl(constants.extensionName);
        const progressBadge = await icon.findElements(By.css(".progress-badge"));

        return (loading.length === 0) && (progressBadge.length === 0);
    });
};

export const tabIsOpened = (tabName: string): Condition<boolean> => {
    return new Condition("Is not loading", async () => {
        return (await new EditorView().getOpenEditorTitles()).includes(tabName);
    });
};

export const isFELoaded = (): Condition<boolean> => {
    return new Condition("Frontend is loaded", async () => {
        return (await driver.findElements(By.id("-1"))).length > 0;
    });
};

export const extensionIsReady = (): Condition<boolean> => {
    return new Condition("Extension was not ready", async () => {
        let tryNumber = 1;
        const feLoadTries = 3;
        let feWasLoaded = false;

        const loadTry = async (): Promise<void> => {
            console.log("<<<<Try to load FE>>>>>");
            await driver.wait(tabIsOpened("Welcome"), constants.explicitWait * 2, "Welcome tab was not opened");
            const activityBare = new ActivityBar();
            await (await activityBare.getViewControl(constants.extensionName))?.openView();
            await driver.wait(tabIsOpened(constants.dbDefaultEditor), constants.explicitWait * 6,
                `${constants.dbDefaultEditor} tab was not opened`);
            await Misc.switchToFrame();
            await driver.wait(isFELoaded(), constants.explicitWait * 3);
            console.log("<<<<FE was loaded successfully>>>>>");
        };

        while (tryNumber <= feLoadTries) {
            try {
                await loadTry();
                feWasLoaded = true;
                break;
            } catch (e) {
                tryNumber++;
                await Misc.switchBackToTopFrame();
                await Misc.reloadVSCode();
            }
        }

        if (feWasLoaded === false) {
            console.log("<<<<MYSQLSH Logs>>>>");
            await Misc.writeMySQLshLogs();
            const bottomBar = new BottomBarPanel();
            await bottomBar.maximize();
            const output = await (await bottomBar.openOutputView()).getText();
            console.log("<<<<OUTPUT Tab Logs>>>>");
            console.log(output);
            const logs = driver.manage().logs();
            console.log("<<<<<DEV TOOLS Console log>>>>");
            console.log(await logs.get(logging.Type.BROWSER));
            throw new Error(`Extension was not loaded successfully after ${feLoadTries} tries.)}`);
        }

        credentialHelperOk = await Misc.findOnMySQLShLog(/Failed to initialize the default helper/);
        credentialHelperOk = !credentialHelperOk;
        await Misc.dismissNotifications();
        await Misc.switchBackToTopFrame();

        return true;
    });
};

