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
    Condition, EditorView, error,
    ActivityBar,
    By,
} from "vscode-extension-tester";
import * as constants from "../lib/constants";
import { Misc, driver } from "../lib/misc";

export let credentialHelperOk = true;
export class Conditions {

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

            await driver.wait(async () => {
                if ((await new EditorView().getOpenEditorTitles()).length > 0) {
                    await new EditorView().closeAllEditors();

                    return true;
                }
            }, constants.explicitWait * 2, "Welcome tab was not displayed");

            const activityBare = new ActivityBar();
            await (await activityBare.getViewControl(constants.extensionName))?.openView();

            // restart internal shell process
            await Misc.restartShell();

            await driver.wait(async () => {
                console.log("start>>>>>>>");
                let isOciLoaded = false;
                try {
                    const ociSection = await Misc.getSection(constants.ociTreeSection);
                    isOciLoaded = (await ociSection.findItem("E2ETESTS (us-ashburn-1)")) !== undefined;
                } catch (e) {
                    if (!(e instanceof error.ElementNotInteractableError)) {
                        throw e;
                    }
                }
                if (isOciLoaded) {
                    return true;
                } else if (await Misc.findOnMySQLShLog("Certificate is installed")) {
                    console.log("certificate is installed");
                    if (await Misc.findOnMySQLShLog("Mode: Single user")) {
                        console.log("found single user");
                        if (await Misc.findOnMySQLShLog("Error: [MSG]")) {
                            console.log("error found, restarting...");

                            return fs.truncate(Misc.getMysqlshLog())
                                .then(async () => {
                                    await reloadExt(platform()).then(() => {
                                        return false;
                                    }).catch((e) => {
                                        throw e;
                                    });
                                });
                        } else if (await Misc.findOutputText("Could not establish websocket connection")) {
                            console.log("websocket error");

                            return fs.truncate(Misc.getMysqlshLog())
                                .then(async () => {
                                    await reloadExt(platform()).then(() => {
                                        return false;
                                    }).catch((e) => {
                                        throw e;
                                    });
                                });
                        } else if (await Misc.findOnMySQLShLog("Registering session...")) {
                            console.log("ALL GOOD !");

                            return true;
                        }
                    }
                }
            }, constants.explicitWait * 12, "Could not verify if extension was ready");

            credentialHelperOk = !(await Misc
                .findOnMySQLShLog(`Failed to initialize the default helper "windows-credential"`));
            await new EditorView().closeAllEditors();

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

}
