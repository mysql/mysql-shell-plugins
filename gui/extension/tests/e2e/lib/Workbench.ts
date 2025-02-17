/*
 * Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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

import fs from "fs/promises";
import { join } from "path";
import clipboard from "clipboardy";
import {
    EditorView, error, InputBox, Key, until, NotificationType, OutputView, WebElement,
    Workbench as extWorkbench, Notification, TerminalView, EditorTab, ActivityBar, Condition,
    ModalDialog, logging, TextEditor,
} from "vscode-extension-tester";
import { keyboard, Key as nutKey } from "@nut-tree-fork/nut-js";
import * as constants from "./constants";
import * as locator from "./locators";
import { Os } from "./Os";
import { Misc, driver } from "./Misc";
import * as errors from "../lib/errors";
import { E2EToolbar } from "./WebViews/E2EToolbar";

export let credentialHelperOk = true;

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
            constants.wait5seconds, `Could not find the Modal dialog`);
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
        await Misc.switchBackToTopFrame();

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
                            if (await notification.hasProgress()) {
                                await keyboard.type(nutKey.Escape);
                            } else {
                                await notification.dismiss();
                            }
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
        await Misc.switchBackToTopFrame();
        const notifications = await new extWorkbench().getNotifications();

        for (const notification of notifications) {
            try {
                if (await notification.hasProgress()) {
                    await keyboard.type(nutKey.Escape);
                } else {
                    await driver.wait(async () => {
                        if (await notification.hasProgress()) {
                            await keyboard.type(nutKey.Escape);
                        } else {
                            await notification.dismiss();
                        }

                        return (await new extWorkbench().getNotifications()).length === 0;
                    }, constants.wait5seconds, "There are still notifications displayed");
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                } else {
                    continue;
                }
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

        if (credentialHelperOk) {
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
        await Misc.switchBackToTopFrame();
        await driver.sleep(500);
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
     * @param editorRef The editor
     * @param maybeDirty True is it's expected the editor to have changes (is dirty), false otherwise
     * @returns A promise resolving when the editor is closed
     */
    public static closeEditor = async (editorRef: RegExp, maybeDirty = false): Promise<void> => {
        await Misc.switchBackToTopFrame();
        const editors = await Workbench.getOpenEditorTitles();
        for (const editor of editors) {
            if (editor.match(new RegExp(editorRef)) !== null) {
                await new EditorView().closeEditor(editor);
                if (maybeDirty) {
                    await Workbench.pushDialogButton("Don't Save").catch(() => {
                        // continue
                    });
                }
                break;
            }
        }
    };

    /**
     * Closes all opened editors
     * @returns A promise resolving when the editors are closed
     */
    public static closeAllEditors = async (): Promise<void> => {
        await Misc.switchBackToTopFrame();
        await driver.wait(async () => {
            try {
                const editorView = new EditorView();
                const editors = await editorView.getOpenEditorTitles();

                if (editors.join(",").includes("json")) {

                    for (const editor of editors) {

                        if (editor.includes("json")) {
                            await editorView.closeEditor(editor);
                            if (await new TextEditor().isDirty()) {
                                await Workbench.pushDialogButton("Don't Save");
                            }
                        }
                    }
                } else {
                    await editorView.closeAllEditors();
                }

                return true;
            } catch (e) {
                await Workbench.pushDialogButton("Don't Save");
            }
        }, constants.wait5seconds, "Could not close all editors");
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
        const openedEditors = await new EditorView().getOpenEditorTitles();
        const theEditor = openedEditors.filter((item: string) => {
            return item.match(new RegExp(editor)) !== null;
        });
        await new EditorView().openEditor(theEditor[0]);
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
     * Verifies if notifications exist on the workbench
     * @param notificationToMatch The notification to find
     * @returns A promise resolving with true if notifications exist, false otherwise
     */
    public static existsNotification = async (notificationToMatch: RegExp): Promise<boolean> => {
        const notifications = await new extWorkbench().getNotifications();
        for (const notification of notifications) {
            if ((await notification.getMessage()).match(notificationToMatch) !== null) {
                return true;
            }
        }
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
     * Waits until the notification exists
     * @param notification The notification
     * @param dismiss True to close the notification, false otherwise
     * @param expectFailure True if it expects a notification with failure/error
     * @returns A promise resolving when the notification exists
     */
    public static untilNotificationExists = (notification: string, dismiss = true,
        expectFailure = false): Condition<boolean> => {
        return new Condition(`for notification '${notification}' to be displayed`, async () => {
            let exists = false;

            if (Misc.insideIframe) {
                await Misc.switchBackToTopFrame();
            }

            try {
                const escapedText = notification.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
                const notifications = await new extWorkbench().getNotifications();

                for (const notification of notifications) {

                    if (expectFailure === false) {
                        if (await notification.getType() === NotificationType.Error) {
                            throw new Error(`There is a notification with error: ${await notification.getMessage()}`);
                        }
                    }

                    const message = await notification.getMessage();

                    if (message !== "") {
                        if (message.match(new RegExp(escapedText)) !== null) {
                            exists = true;

                            if (dismiss) {
                                if (await notification.hasProgress()) {
                                    await keyboard.type(nutKey.Escape);
                                } else {
                                    await notification.dismiss();
                                }
                            }
                        } else {
                            console.warn(`Found notification: ${message}`);

                            if (dismiss) {
                                if (await notification.hasProgress()) {
                                    await keyboard.type(nutKey.Escape);
                                } else {
                                    await notification.dismiss();
                                }
                            }
                        }
                        break;
                    }
                }
            } catch (e) {
                if (!errors.isStaleError(e as Error)) {
                    throw e;
                }
            }

            return exists;
        });
    };

    /**
     * Waits until the tab is opened
     * @param tabName The tab name
     * @returns A promise resolving when the tab is opened
     */
    public static untilTabIsOpened = (tabName: string | RegExp): Condition<boolean> => {
        return new Condition(`for ${tabName} to be opened`, async () => {
            const editors = await Workbench.getOpenEditorTitles();

            if (tabName instanceof RegExp) {
                for (const editor of editors) {
                    if (editor.match(tabName) != null) {
                        return true;
                    }
                }
            } else {
                return (await Workbench.getOpenEditorTitles()).includes(tabName);
            }

        });
    };

    /**
     * Opens or closes the primary side bar
     * @param open True to open, false to close
     * @returns A promise resolving when the side bar is opened or closed
     */
    public static toggleSideBar = async (open: boolean): Promise<void> => {
        await Misc.switchBackToTopFrame();

        const primarySidebar = await driver.findElement(locator.togglePrimarySideBar);

        const isOpened = async (): Promise<boolean> => {
            const primarySidebar = await driver.findElement(locator.togglePrimarySideBar);

            return (await primarySidebar.getAttribute("aria-checked")).includes("true");
        };

        const untilIsOpened = (): Condition<boolean> => {
            return new Condition("for Side Bar to be opened", async () => {
                const primarySidebar = await driver.findElement(locator.togglePrimarySideBar);

                return (await primarySidebar.getAttribute("aria-checked")).includes("true");
            });
        };

        const untilIsClosed = (): Condition<boolean> => {
            return new Condition("for Side Bar to be opened", async () => {
                const primarySidebar = await driver.findElement(locator.togglePrimarySideBar);

                return !(await primarySidebar.getAttribute("aria-checked")).includes("true");
            });
        };

        await driver.wait(async () => {
            try {
                if (open === true) {
                    if (!(await isOpened())) {
                        await driver.wait(async () => {
                            await primarySidebar.click();

                            return driver.wait(untilIsOpened(), constants.wait1second)
                                .then(() => { return true; })
                                .catch(() => {
                                    // continue
                                });
                        }, constants.wait3seconds, "Could not open the side bar");
                    }
                } else {
                    if (await isOpened()) {
                        await driver.wait(async () => {
                            await primarySidebar.click();

                            return driver.wait(untilIsClosed(), constants.wait1second)
                                .then(() => { return true; })
                                .catch(() => {
                                    // continue
                                });
                        }, constants.wait3seconds, "Could not close the side bar");
                    }
                }

                return true;
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Could not toggle the side bar");
    };

    /**
     * Verifies if the Modal dialog is opened
     * @returns A condition resolving  to true when the model dialog is opened
     */
    public static untilModalDialogIsOpened = (): Condition<boolean> => {
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
     * Verifies if the editor selector exists, which means that the front end is loaded
     * @returns A condition resolving to true when the front end is loaded
     */
    public static untilFEisLoaded = (): Condition<boolean> => {
        return new Condition("for Frontend to be loaded", async () => {
            return (await driver.findElements(locator.notebook.toolbar.editorSelector.exists)).length > 0;
        });
    };

    /**
     * Verifies if the web view is ready to be used
     * @param iframe The iframe
     * @returns A condition resolving to true when the web view is ready
     */
    public static untilWebViewIsReady = (iframe: WebElement): Condition<boolean> => {
        return new Condition("for web view to be ready", async () => {
            return (await iframe.getAttribute("class")).includes("webview ready");
        });
    };

    /**
     * Verifies if the current editor is the one expected
     * @param editor The editor name
     * @returns A condition resolving to true when the editor is the one expected
     */
    public static untilCurrentEditorIs = (editor: RegExp): Condition<boolean> => {
        return new Condition(`current editor to be ${editor.toString()}`, async () => {
            await Misc.switchBackToTopFrame();
            await Misc.switchToFrame();

            return ((await new E2EToolbar().editorSelector.getCurrentEditor()).label).match(editor) !== null;
        });
    };

    /**
     * Verifies if the MySQL Shell for VS Code extension is fully loaded and ready to be tested
     * @returns A condition resolving to true when the extension is ready
     */
    public static untilExtensionIsReady = (): Condition<boolean> => {
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
                await driver.wait(this.untilFEisLoaded(), constants.wait15seconds);
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
     * Verifies if the confirmation dialog exists
     * @param context The context
     * @returns A condition resolving to true when the confirmation dialog exists
     */
    public static untilConfirmationDialogExists = (context?: string): Condition<WebElement> => {
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
     * Verifies if a tab with json content to be opened
     * @param filename The file name
     * @returns A condition resolving to true when the tab with json content is opened
     */
    public static untilJsonFileIsOpened = (filename: string): Condition<boolean> => {
        return new Condition(`${filename} to be opened`, async () => {
            const textEditor = new TextEditor();
            const json = await textEditor.getText();
            if (json.includes("{")) {
                return Misc.isJson(json);
            }
        });
    };

    /**
     * Sets the workbench color theme
     * @param theme The color theme
     */
    public static setColorTheme = async (theme: string): Promise<void> => {
        const settingsEditor = await new extWorkbench().openSettings();
        const setting = await settingsEditor.findSetting("Color Theme", "Workbench");
        await setting.setValue(theme);
        await Workbench.closeEditor(/Settings/);
    };
}
