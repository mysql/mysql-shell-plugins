/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import clipboard from "clipboardy";
import {
    EditorView, error, InputBox, Key, until, NotificationType, OutputView, WebElement,
    Workbench as extWorkbench, Notification, TerminalView, EditorTab, ActivityBar,
} from "vscode-extension-tester";
import * as constants from "./constants";
import { keyboard, Key as nutKey } from "@nut-tree/nut-js";
import * as waitUntil from "./until";
import * as locator from "./locators";
import * as interfaces from "./interfaces";
import { Tree } from "./treeViews/tree";
import { Os } from "./os";
import { Misc, driver } from "./misc";
import * as errors from "../lib/errors";

/**
 * This class aggregates the functions that perform vscode workbench operations
 */
export class Workbench {

    /**
     * Expands or collapses the bottom bar
     * @param expand True to expand, false to collapse
     * @returns A promise resolving when the bottom bar is expanded/collapsed
     */
    public static toggleBottomBar = async (expand: boolean): Promise<void> => {

        const bottomBar = await driver.findElement(locator.bottomBarPanel.exists);
        const parent: WebElement = await driver.executeScript("return arguments[0].parentNode", bottomBar);
        const parentClasses = (await parent.getAttribute("class")).split(" ");
        const isVisible = parentClasses.includes("visible");
        const closeBtn = await bottomBar.findElement(locator.bottomBarPanel.close);

        if (isVisible) {
            if (expand === false) {
                await closeBtn.click();
            }
        } else {
            if (expand === true) {
                let output: WebElement;
                await driver.wait(async () => {
                    await driver.actions().sendKeys(Key.chord(Key.CONTROL, "j")).perform();
                    output = await bottomBar.findElement(locator.bottomBarPanel.output);

                    return output.isDisplayed();
                }, constants.wait5seconds, "");
                await output.click();
            }
        }

    };

    /**
     * Clicks on a dialog button
     * @param buttonName The button name
     * @returns A promise resolving when the button is clicked
     */
    public static pushDialogButton = async (buttonName: string): Promise<void> => {
        const dialogBox = await driver.wait(until.elementLocated(locator.dialogBox.exists),
            constants.wait2seconds, `Could not find dialog box`);
        const dialogButtons = await dialogBox.findElements(locator.dialogBox.buttons);
        for (const button of dialogButtons) {
            if (await button.getAttribute("title") === buttonName) {
                await button.click();

                return;
            }
        }
        throw new Error(`Could not find button ${buttonName}`);
    };

    /**
     * Gets a notification
     * @param text The notification text
     * @param dismiss True to dismiss
     * @param expectFailure True to expect a notification with a failure
     * @returns A promise resolving with the notification
     */
    public static getNotification = async (text: string, dismiss = true,
        expectFailure = false): Promise<Notification> => {

        let notification: Notification;
        const escapedText = text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

        await driver.wait(async () => {
            try {
                const ntfs = await new extWorkbench().getNotifications();
                for (const ntf of ntfs) {
                    if (expectFailure === false) {
                        if (await ntf.getType() === NotificationType.Error) {
                            throw new Error("An error has occurred");
                        }
                    }
                    if ((await ntf.getMessage()).match(new RegExp(escapedText)) !== null) {
                        notification = ntf;
                        if (dismiss) {
                            await Workbench.dismissNotifications();
                        }

                        return true;
                    }
                }
            } catch (e) {
                if (!errors.isStaleError(e as Error)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not find '${text}' notification`);

        return notification;
    };

    /**
     * Clicks on a notification button
     * @param notification The notification
     * @param button The button
     * @returns A promise resolving when the notification button is clicked
     */
    public static clickOnNotificationButton = async (notification: Notification, button: string): Promise<void> => {
        await driver.wait(async () => {
            try {
                await notification.takeAction(button);

                return (await new extWorkbench().getNotifications()).length === 0;
            } catch (e) {
                if (errors.isStaleError(e as Error)) {
                    return true;
                } else if (e instanceof error.ElementNotInteractableError) {
                    return false;
                } else {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not click on notification button '${button}'`);
    };

    /**
     * Closes all existing notifications
     * @returns A promise resolving when all notifications are closed
     */
    public static dismissNotifications = async (): Promise<void> => {
        const ntfs = await new extWorkbench().getNotifications();
        for (const ntf of ntfs) {
            if (await ntf.hasProgress()) {
                await keyboard.type(nutKey.Escape);
            } else {
                await driver.wait(async () => {
                    try {
                        await ntf.dismiss();
                    } catch (e) {
                        if (errors.isStaleError(e as Error)) {
                            return true;
                        } else {
                            if (e instanceof error.ElementNotInteractableError) {
                                return false;
                            } else {
                                throw e;
                            }
                        }
                    }

                    return (await new extWorkbench().getNotifications()).length === 0;
                }, constants.wait5seconds, "There are still notifications displayed");
            }
        }
    };

    /**
     * Executes a command on the workbench terminal
     * @param cmd The command
     * @param timeout The timeout
     * @returns A promise resolving when all notifications are closed
     */
    public static execOnTerminal = async (cmd: string, timeout: number): Promise<void> => {
        timeout = timeout ?? constants.wait5seconds;

        if (Os.isMacOs() || Os.isLinux()) {
            await keyboard.type(cmd);
            await keyboard.type(nutKey.Enter);
        } else {
            const terminal = new TerminalView();
            await terminal.executeCommand(cmd, timeout);
        }

    };

    /**
     * Waits for a text to be displayed on the workbench terminal
     * @param textToSearch The text
     * @param timeout The timeout to wait until the text is displayed
     * @returns A promise resolving when then text is found
     */
    public static waitForTerminalText = async (textToSearch: string | string[],
        timeout: number): Promise<void> => {
        await driver.wait(async () => {
            const out = await Workbench.getTerminalOutput();
            for (const item of textToSearch) {
                if (out.includes(item)) {
                    return true;
                }
            }
        }, timeout, `Could not find text '${textToSearch[0]}' on the terminal`);
    };

    /**
     * Verifies if the workbench terminal displayed an error
     * @returns A promise resolving with true if an error is found, false otherwise
     */
    public static terminalHasErrors = async (): Promise<boolean> => {
        const out = await Workbench.getTerminalOutput();

        return out.includes("ERR") || out.includes("err");
    };

    /**
     * Finds a text on the workbench output tab
     * @param textToSearch The text
     * @returns A promise resolving when then text is found
     */
    public static findOutputText = async (textToSearch: string | RegExp | RegExp[]): Promise<boolean> => {
        const output = new OutputView();

        let clipBoardText = "";
        await driver.wait(async () => {
            try {
                clipBoardText = await output.getText();

                return true;
            } catch (e) {
                if (!(String(e).includes("Command failed")) &&
                    !(errors.isStaleError(e as Error)) &&
                    !(e instanceof error.ElementNotInteractableError)
                ) {
                    throw e;
                }
            }
        }, constants.wait10seconds, "Could not get output text from clipboard");

        if (Array.isArray(textToSearch)) {
            for (const rex of textToSearch) {
                if (clipBoardText.toString().match(rex) === null) {
                    return false;
                }
            }

            return true;
        }
        if (textToSearch instanceof RegExp) {
            return (clipBoardText.match(textToSearch)) !== null;
        } else {
            return clipBoardText.includes(textToSearch);
        }
    };

    /**
     * Waits for a text on the workbench output tab to be displayed
     * @param textToSearch The text
     * @param timeout The timeout to wait until the text is displayed
     * @returns A promise resolving when then text is found
     */
    public static waitForOutputText = async (textToSearch: string | RegExp, timeout: number): Promise<void> => {
        await driver.wait(async () => {
            return Workbench.findOutputText(textToSearch);
        }, timeout, `'${textToSearch.toString()}' was not found on Output view`);
    };

    /**
     * Sets the password on the workbench input box. It also sets the "N" on the confirmation input box,
     * to never save the password
     * @param password The password
     * @returns A promise resolving when then password is set
     */
    public static setInputPassword = async (password: string): Promise<void> => {
        let inputBox: InputBox;
        await Misc.switchBackToTopFrame();
        try {
            inputBox = await InputBox.create(constants.wait1second);
        } catch (e) {
            return;
        }

        if (await inputBox.isPassword()) {
            await inputBox.setText(password);
            await inputBox.confirm();
        }

        if (waitUntil.credentialHelperOk) {
            await driver.wait(async () => {
                inputBox = await InputBox.create();
                if ((await inputBox.isPassword()) === false) {
                    await inputBox.setText("N");
                    await inputBox.confirm();

                    return true;
                }
            }, constants.wait5seconds, "Save password dialog was not displayed");
        }
    };

    /**
     * Expands all notifications
     * @returns A promise resolving when the notifications are expanded
     */
    public static expandNotifications = async (): Promise<void> => {
        const notifications = await new extWorkbench().getNotifications();
        for (const notification of notifications) {
            await notification.expand();
        }
    };

    /**
     * Sets the path on the workbench input box
     * @param path The path
     * @returns A promise resolving when then password is set
     */
    public static setInputPath = async (path: string): Promise<void> => {
        await Misc.switchBackToTopFrame();
        const input = await InputBox.create();
        await driver.wait(async () => {
            try {
                await input.clear();
                await input.setText(path);
                if ((await input.getText()) === path) {
                    await input.confirm();

                    return true;
                }
            } catch (e) {
                // continue trying
            }
        }, constants.wait10seconds, `Could not set ${path} on input box`);
    };

    /**
     * Gets the terminal output text
     * @returns A promise resolving with the terminal output
     */
    public static getTerminalOutput = async (): Promise<string> => {
        let out: string;
        await driver.wait(until.elementLocated(locator.terminal.textArea),
            constants.wait5seconds, "Terminal was not opened");
        await driver.wait(async () => {
            try {
                const workbench = new extWorkbench();
                await workbench.executeCommand("terminal select all");
                await driver.sleep(1000);
                out = clipboard.readSync();
                clipboard.writeSync("");

                return true;
            } catch (e) {
                // continue. Clipboard may be in use by other tests
            }
        }, constants.wait10seconds, "Clipboard was in use after 10 secs");

        return out;
    };

    /**
     * Reloads the VS Code window
     * @returns A promise resolving when the VS Code window is reloaded
     */
    public static reloadVSCode = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                const workbench = new extWorkbench();
                await workbench.executeCommand("workbench.action.reloadWindow");
                await driver.sleep(constants.wait2seconds);

                return true;
            } catch (e) {
                return false;
            }
        }, constants.wait5seconds * 3, "Could not reload VSCode");
    };

    /**
     * Closes an editor
     * @param editor The editor
     * @param maybeDirty True is it's expected the editor to have changes (is dirty), false otherwise
     * @returns A promise resolving when the editor is closed
     */
    public static closeEditor = async (editor: string, maybeDirty = false): Promise<void> => {
        await Misc.switchBackToTopFrame();
        await new EditorView().closeEditor(editor);
        if (maybeDirty) {
            await Workbench.pushDialogButton("Don't Save").catch(() => {
                // continue
            });
        }
    };

    /**
     * Closes all opened editors
     * @returns A promise resolving when the editors are closed
     */
    public static closeAllEditors = async (): Promise<void> => {
        await Misc.switchBackToTopFrame();
        await new EditorView().closeAllEditors();
    };

    /**
     * Gets all the opened editor titles
     * @returns A promise resolving with the editors names
     */
    public static getOpenEditorTitles = async (): Promise<string[]> => {
        await Misc.switchBackToTopFrame();

        return new EditorView().getOpenEditorTitles();
    };

    /**
     * Gets the name of the current opened tab
     * @returns A promise resolving with the name of the current opened tab
     */
    public static getActiveTab = async (): Promise<EditorTab> => {
        await Misc.switchBackToTopFrame();

        return new EditorView().getActiveTab();
    };

    /**
     * Opens/clicks on an editor
     * @param editor The editor
     * @returns A promise resolving when the editor is opened
     */
    public static openEditor = async (editor: string): Promise<void> => {
        await Misc.switchBackToTopFrame();
        await new EditorView().openEditor(editor);
    };

    /**
     * Verifies if a MRS Data upgrade is needed, by expanding a DB connection and checking if a
     * specific notification is displayed
     * @param dbConnection The db connection
     * @returns A promise resolving with true if the upgrade is needed, false otherwise
     */
    public static requiresMRSMetadataUpgrade = async (dbConnection: interfaces.IDBConnection): Promise<boolean> => {
        await Misc.switchBackToTopFrame();

        await Workbench.dismissNotifications();
        const dbTreeConnection = await Tree.getElement(constants.dbTreeSection, dbConnection.caption);
        await Os.deleteCredentials();
        await Tree.expandDatabaseConnection(dbTreeConnection,
            (dbConnection.basic as interfaces.IConnBasicMySQL).password);
        if ((await Workbench.existsNotifications(constants.wait2seconds)) === true) {
            return (await Workbench
                .getNotification("This MySQL Shell version requires a new minor version")) !== undefined;
        }
    };

    /**
     * Performs the MRS metadata upgrade by clicking Yes on the specific notification
     * @returns A promise resolving when the upgrade is done
     */
    public static upgradeMRSMetadata = async (): Promise<void> => {
        const notification = await Workbench.getNotification("This MySQL Shell version requires a new minor version");
        await Workbench.clickOnNotificationButton(notification, "Yes");
        await Workbench.getNotification("The MySQL REST Service Metadata Schema has been updated");
    };

    /**
     * Verifies if notifications exist on the workbench
     * @param timeout The timeout to wait for notifications to be displayed
     * @returns A promise resolving with true if notifications exist, false otherwise
     */
    public static existsNotifications = async (timeout = constants.wait5seconds): Promise<boolean> => {
        return driver.wait(async () => {
            return (await new extWorkbench().getNotifications()).length > 0;
        }, timeout).catch(() => {
            return false;
        });
    };

    /**
     * Opens the MySQL Shell for VSCode Extension
     * @returns A promise resolving when the extension view is opened
     */
    public static openMySQLShellForVSCode = async (): Promise<void> => {
        await Misc.switchBackToTopFrame();
        await (await new ActivityBar().getViewControl(constants.extensionName))?.openView();
    };

    /**
     * Removes all existing database connections from the DATABASE CONNECTIONS section
     * @returns A promise resolving when all connections are deleted
     */
    public static removeAllDatabaseConnections = async (): Promise<void> => {
        const dbConnections = await Tree.getDatabaseConnections();
        await Workbench.closeAllEditors();
        for (const dbConnection of dbConnections) {
            await Tree.deleteDatabaseConnection(dbConnection.name, dbConnection.isMySQL, false);
        }
    };
}
