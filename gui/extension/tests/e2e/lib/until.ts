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
    EditorView,
    BottomBarPanel,
    logging,
} from "vscode-extension-tester";
import { execSync } from "child_process";
import fs from "fs/promises";
import * as constants from "./constants";
import { Misc, driver } from "./misc";
import * as locator from "./locators";
import * as interfaces from "./interfaces";
import { Database } from "./db";
export let credentialHelperOk = true;

export const isNotLoading = (section: string): Condition<boolean> => {
    return new Condition("Is not loading", async () => {
        const sec = await Misc.getSection(section);
        const loading = await sec.findElements(locator.section.loadingBar);
        const activityBar = new ActivityBar();
        const icon = await activityBar.getViewControl(constants.extensionName);
        const progressBadge = await icon.findElements(locator.shellForVscode.loadingIcon);

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
        return (await driver.findElements(locator.dbConnectionOverview.newDBConnection)).length > 0;
    });
};

const dbConnectionIsSuccessful = (): Condition<boolean> => {
    return new Condition("DB Connection is successful", async () => {
        return (await driver.findElements(locator.notebook.codeEditor.textArea)).length > 0;
    });
};

export const dbConnectionIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
    return new Condition("DB loaded", async () => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }
        const existsPasswordDialog = (await driver.findElements(locator.passwordDialog.exists)).length > 0;
        const existsNotebook = (await driver.findElements(locator.notebook.exists)).length > 0;
        const existsGenericDialog = (await driver.findElements(locator.genericDialog.exists)).length > 0;
        if (existsPasswordDialog) {
            await Database.setDBConnectionCredentials(connection);
            await driver.wait(dbConnectionIsSuccessful(),
                constants.wait15seconds, "DB connection was not successful");
        }

        return existsNotebook || existsGenericDialog;
    });
};

export const mdsConnectionIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
    return new Condition("DB loaded", async () => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }
        const existsPasswordDialog = (await driver.findElements(locator.passwordDialog.exists)).length > 0;
        const existsFingerPrintDialog = (await driver.findElements(locator.confirmDialog.exists)).length > 0;
        const existsEditor = (await driver.findElements(locator.notebook.codeEditor.textArea)).length > 0;
        const existsErrorDialog = (await driver.findElements(locator.errorDialog.exists)).length > 0;
        if (existsFingerPrintDialog) {
            await driver.findElement(locator.confirmDialog.accept).click();
        }
        if (existsPasswordDialog) {
            await Database.setDBConnectionCredentials(connection);
        }
        if (existsErrorDialog) {
            const errorDialog = await driver.findElement(locator.errorDialog.exists);
            const errorMsg = await errorDialog.findElement(locator.errorDialog.message);
            throw new Error(await errorMsg.getText());
        }

        return existsEditor;
    });
};

export const shellSessionIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
    return new Condition("DB loaded", async () => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }

        const existsPasswordDialog = (await driver.findElements(locator.passwordDialog.exists)).length > 0;

        if (existsPasswordDialog) {
            await Database.setDBConnectionCredentials(connection);
            await driver.wait(dbConnectionIsSuccessful(),
                constants.wait15seconds, "DB connection was not successful");
        }

        return (await driver.findElements(locator.shellConsole.editor)).length > 0;
    });
};

export const dbSectionHasConnections = (): Condition<boolean> => {
    return new Condition("DB Connections exists", async () => {
        return (await Misc.getDBConnections()).length > 0;
    });
};

export const existsOnRouterLog = (text: string | RegExp): Condition<boolean> => {
    return new Condition("Exists on Router log", async () => {
        const routerLogFile = await Misc.getRouterLogFile();
        await driver.wait(async () => {
            try {
                await fs.access(routerLogFile);

                return true;
            } catch (e) {
                // continue
            }
        }, constants.wait10seconds, `Could not find '${routerLogFile}'`);
        const logFileContent = (await fs.readFile(routerLogFile)).toString();
        if (text instanceof RegExp) {
            return logFileContent.match(text) !== null;
        } else {
            return logFileContent.match(new RegExp(text)) !== null;
        }
    });
};

export const isDefaultItem = (section: string, treeItemName: string, itemType: string): Condition<boolean> => {
    return new Condition("The tree item is marked as default", async () => {
        return Misc.isDefaultItem(section, treeItemName, itemType);
    });
};

export const routerIsRunning = (): Condition<boolean> => {
    return new Condition("Exists on Router log", () => {
        if (Misc.isWindows()) {
            const cmdResult = execSync(`tasklist /fi "IMAGENAME eq mysqlrouter.exe"`);
            const resultLines = cmdResult.toString().split("\n");
            for (const line of resultLines) {
                if (line.match(/mysqlrouter.exe/) !== null) {
                    return true;
                }
            }
        } else {
            const cmdResult = execSync("ps aux | grep mysqlrouter");
            const resultLines = cmdResult.toString().split("\n");
            for (const line of resultLines) {
                if (line.match(/\/usr\/.*\/.*router/) !== null) {
                    return true;
                }
            }
        }
    });
};

export const extensionIsReady = (): Condition<boolean> => {
    return new Condition("Extension was not ready", async () => {
        let tryNumber = 1;
        const feLoadTries = 3;
        let feWasLoaded = false;

        const loadTry = async (): Promise<void> => {
            console.log("<<<<Try to load FE>>>>>");
            await driver.wait(tabIsOpened("Welcome"), constants.wait10seconds, "Welcome tab was not opened");
            const activityBare = new ActivityBar();
            await (await activityBare.getViewControl(constants.extensionName))?.openView();
            await driver.wait(tabIsOpened(constants.dbDefaultEditor), constants.wait25seconds,
                `${constants.dbDefaultEditor} tab was not opened`);
            await Misc.switchToFrame();
            await driver.wait(isFELoaded(), constants.wait15seconds);
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

