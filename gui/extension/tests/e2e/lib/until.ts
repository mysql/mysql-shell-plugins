/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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
    logging,
    WebElement,
    error,
    ModalDialog,
    TextEditor,
} from "vscode-extension-tester";
import { join } from "path";
import fs from "fs/promises";
import * as constants from "./constants";
import { Misc, driver } from "./Misc";
import * as locator from "./locators";
import { Os } from "./Os";
import { Workbench } from "./Workbench";
import * as errors from "../lib/errors";
import { Toolbar } from "./WebViews/Toolbar";

export let credentialHelperOk = true;

/**
 * Waits until the Modal dialog is opened
 * @returns A promise resolving when the model dialog is opened
 */
export const modalDialogIsOpened = (): Condition<boolean> => {
    return new Condition(`for vscode dialog to be opened`, async () => {
        try {
            const dialog = new ModalDialog();

            return (await dialog.getMessage()).length > 0;
        } catch (e) {
            if (!(e instanceof error.NoSuchElementError) &&
                !(errors.isStaleError(e as Error)) &&
                !(e instanceof error.ElementNotInteractableError)
            ) {
                throw e;
            }
        }
    });
};

/**
 * Waits until the editor selector exists, which means that the front end is loaded
 * @returns A promise resolving when the front end is loaded
 */
export const isFELoaded = (): Condition<boolean> => {
    return new Condition("for Frontend to be loaded", async () => {
        return (await driver.findElements(locator.notebook.toolbar.editorSelector.exists)).length > 0;
    });
};

/**
 * Waits until the web view is ready to be used
 * @param iframe The iframe
 * @returns A promise resolving when the web view is ready
 */
export const webViewIsReady = (iframe: WebElement): Condition<boolean> => {
    return new Condition("for web view to be ready", async () => {
        return (await iframe.getAttribute("class")).includes("webview ready");
    });
};

/**
 * Waits until the current editor is the one expected
 * @param editor The editor name
 * @returns A promise resolving when the editor is the one expected
 */
export const currentEditorIs = (editor: RegExp): Condition<boolean> => {
    return new Condition(`current editor to be ${editor.toString()}`, async () => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();

        return ((await new Toolbar().getCurrentEditor()).label).match(editor) !== null;
    });
};

/**
 * Waits until the MySQL Shell for VS Code extension is fully loaded and ready to be tested
 * @returns A promise resolving when the extension is ready
 */
export const extensionIsReady = (): Condition<boolean> => {
    return new Condition("for the Extension to be ready", async () => {
        let tryNumber = 1;
        const feLoadTries = 3;
        let feWasLoaded = false;

        const loadTry = async (): Promise<void> => {
            console.log("<<<<Try to load FE>>>>>");
            await driver.wait(Workbench.untilTabIsOpened("Welcome"), constants.wait10seconds,
                "Welcome tab was not opened");
            await Workbench.openMySQLShellForVSCode();
            await driver.wait(Workbench.untilTabIsOpened(constants.dbDefaultEditor), constants.wait25seconds,
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
                await Workbench.reloadVSCode();
            }
        }

        if (feWasLoaded === false) {
            console.log("<<<<MYSQLSH Logs>>>>");
            await Os.writeMySQLshLogs();
            const logs = driver.manage().logs();
            console.log("<<<<<DEV TOOLS Console log>>>>");
            console.log(await logs.get(logging.Type.BROWSER));

            const text = `Extension was not loaded successfully after ${feLoadTries} tries. Check the logs.`;
            // one last try to recover
            const path = join(await Os.getExtensionOutputLogsFolder(), constants.feLogFile);
            const output = (await fs.readFile(path)).toString();
            console.log("-----OUTPUT LOGS------");
            console.log(output);
            throw new Error(text);
        }

        credentialHelperOk = await Os.findOnMySQLShLog(/Failed to initialize the default helper/);
        credentialHelperOk = !credentialHelperOk;
        await Workbench.dismissNotifications();
        await Misc.switchBackToTopFrame();

        return true;
    });

};

/**
 * Waits until the confirmation dialog exists
 * @param context The context
 * @returns A promise resolving when the confirmation dialog exists
 */
export const confirmationDialogExists = (context?: string): Condition<WebElement> => {
    let msg = "for confirmation dialog to be displayed";
    if (context) {
        msg += ` ${context}`;
    }

    return new Condition(msg, async () => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();

        const confirmDialog = await driver.findElements(locator.confirmDialog.exists);
        if (confirmDialog) {
            return confirmDialog[0];
        }
    });
};

/**
 * Waits until a tab with json content to be opened
 * @param filename The file name
 * @returns A promise resolving when the tab with json content is opened
 */
export const jsonFileIsOpened = (filename: string): Condition<boolean> => {
    return new Condition(`${filename} to be opened`, async () => {
        const textEditor = new TextEditor();
        const json = await textEditor.getText();
        if (json.includes("{")) {
            return Misc.isJson(json);
        }
    });
};

