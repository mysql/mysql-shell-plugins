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
} from "vscode-extension-tester";
import * as constants from "./constants";
import { Misc, driver } from "./misc";

export let credentialHelperOk = true;
export class Until {

    public static extensionIsReady = (): Condition<boolean> => {
        return new Condition("Extension was not ready", async () => {

            await driver.wait(Until.tabIsOpened("Welcome"), constants.explicitWait * 2, "Welcome tab was not opened");
            const activityBare = new ActivityBar();
            await (await activityBare.getViewControl(constants.extensionName))?.openView();
            try {
                await driver.wait(Until.tabIsOpened(constants.dbDefaultEditor), constants.explicitWait * 6,
                    `${constants.dbDefaultEditor} tab was not opened`);
            } finally {
                console.log("<<<<<<MysqlSh Logs>>>>>>>");
                console.log(await Misc.writeMySQLshLogs());
            }

            credentialHelperOk = await Misc.findOnMySQLShLog(/Failed to initialize the default helper/);
            credentialHelperOk = !credentialHelperOk;
            await Misc.dismissNotifications();

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
