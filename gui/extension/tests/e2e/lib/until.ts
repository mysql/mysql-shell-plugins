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
import fs from "fs/promises";
import { platform } from "os";
import {
    Condition,
    ActivityBar,
    By,
    EditorView,
    BottomBarPanel,
} from "vscode-extension-tester";
import * as constants from "./constants";
import { Misc, driver } from "./misc";

export let credentialHelperOk = true;
export class Until {

    public static extensionIsReady = (): Condition<boolean> => {
        return new Condition("Extension was not ready", async () => {

            const reloadExt = async (platform: string): Promise<void> => {
                console.log("reloading");
                if (platform === "darwin") {
                    await Misc.restartShell();
                } else {
                    await Misc.reloadVSCode();
                }
            };

            await driver.wait(Until.tabIsOpened("Welcome"), constants.explicitWait * 2, "Welcome tab was not opened");
            await driver.wait(Until.tabIsOpened("Welcome to MySQL Shell"), constants.explicitWait * 2,
                "Welcome to MySQL Shell tab was not opened");
            await new EditorView().closeEditor("Welcome");
            await new EditorView().closeEditor("Welcome to MySQL Shell");
            const bottomBar = new BottomBarPanel();
            const output = await bottomBar.openOutputView();
            await bottomBar.maximize();
            await (output).selectChannel(constants.vscodeChannel);

            const activityBare = new ActivityBar();
            await (await activityBare.getViewControl(constants.extensionName))?.openView();

            await Misc.restartShell();

            const successStartupWords: RegExp[] = [
                /Certificate is installed/,
                /Mode: Single user/,
                /Registering session/,
            ];

            await driver.wait(async () => {
                if (await Misc.findOnMySQLShLog(successStartupWords) &&
                    !(await Misc.findOnMySQLShLog(/.*Error:.*\[MSG\].*/))) {

                    console.log("<<<<<<Server seems OK>>>>>>>");
                    console.log(await Misc.writeMySQLshLogs());
                    try {
                        await driver.wait(Until.tabIsOpened(constants.dbDefaultEditor),
                            constants.explicitWait, `${constants.dbDefaultEditor} tab was not opened`);
                        await driver.wait(async () => {
                            return (await Misc.findOutputText(/application did start/)) === true;
                        }, constants.explicitWait * 2, "Front end was not fully loaded");
                        console.log("<<<<<<Extension is Ready>>>>>>>");

                        return true;
                    } catch (e) {
                        console.log(e.message);
                        console.log("<<<<Reloading Shell - FE not loaded>>>>");
                        await new EditorView().closeAllEditors();
                        await fs.truncate(Misc.getMysqlshLog());
                        await reloadExt(platform());
                    }
                } else {
                    if (await Misc.findOutputText(/Could not establish websocket connection/)) {
                        console.log("<<<<Reloading Shell>>>>");
                        console.log(await Misc.writeMySQLshLogs());
                        await fs.truncate(Misc.getMysqlshLog());
                        await reloadExt(platform());
                    } else {
                        console.log("<<<<<<Not Yet Ready>>>>>>>");
                        console.log(await Misc.writeMySQLshLogs());
                    }
                }
            }, constants.explicitWait * 12, "Extension was NOT ready. Please check the logs");

            credentialHelperOk = !(await Misc
                .findOnMySQLShLog(/Failed to initialize the default helper "windows-credential"/));
            await Misc.dismissNotifications();

            await new BottomBarPanel().closePanel();

            return true;
        });
    };

    public static isNotLoading = (section: string): Condition<boolean> => {
        return new Condition("Is not loading", async () => {
            const sec = await Misc.getSection(section);
            const loading = await sec.findElements(By.css(".monaco-progress-container.active"));
            const activityBar = new ActivityBar();
            const icon = await activityBar.getViewControl(constants.extensionName);
            const progressBadge = await icon.findElements(By.css(".progress-badge"));

            return (loading.length === 0) && (progressBadge.length === 0);
        });
    };

    public static tabIsOpened = (tabName: string): Condition<boolean> => {
        return new Condition("Is not loading", async () => {
            return (await new EditorView().getOpenEditorTitles()).includes(tabName);
        });
    };

}
