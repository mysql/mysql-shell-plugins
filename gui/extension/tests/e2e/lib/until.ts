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
    ActivityBar,
    logging,
    WebElement,
    Locator,
    Workbench as extWorkbench,
    NotificationType,
    error,
    ModalDialog,
} from "vscode-extension-tester";
import { join } from "path";
import fs from "fs/promises";
import * as constants from "./constants";
import { Misc, driver } from "./misc";
import { Notebook } from "./webviews/notebook";
import * as locator from "./locators";
import * as interfaces from "./interfaces";
import { DatabaseConnection } from "./webviews/dbConnection";
import { Section } from "./treeViews/section";
import { Tree } from "./treeViews/tree";
import { Os } from "./os";
import { Workbench } from "./workbench";
export let credentialHelperOk = true;

export const sectionIsNotLoading = (section: string): Condition<boolean> => {
    return new Condition(`for ${section} to NOT be loading`, async () => {
        const sec = await Section.getSection(section);
        const loading = await sec.findElements(locator.section.loadingBar);
        const activityBar = new ActivityBar();
        const icon = await activityBar.getViewControl(constants.extensionName);
        const progressBadge = await icon.findElements(locator.shellForVscode.loadingIcon);

        return (loading.length === 0) && (progressBadge.length === 0);
    });
};

export const modalDialogIsOpened = (): Condition<boolean> => {
    return new Condition(`for vscode dialog to be opened`, async () => {
        try {
            const dialog = new ModalDialog();

            return (await dialog.getMessage()).length > 0;
        } catch (e) {
            if (!(e instanceof error.NoSuchElementError) &&
                !(e instanceof error.StaleElementReferenceError) &&
                !(e instanceof error.ElementNotInteractableError)
            ) {
                throw e;
            }
        }
    });
};

export const tabIsOpened = (tabName: string): Condition<boolean> => {
    return new Condition(`for ${tabName} to be opened`, async () => {
        return (await Workbench.getOpenEditorTitles()).includes(tabName);
    });
};

export const isFELoaded = (): Condition<boolean> => {
    return new Condition("for Frontend to be loaded", async () => {
        return (await driver.findElements(locator.notebook.toolbar.editorSelector.exists)).length > 0;
    });
};

const dbConnectionIsSuccessful = (): Condition<boolean> => {
    return new Condition("for DB Connection is successful", async () => {
        const editorSelectorExists = (await driver.findElements(locator.notebook.toolbar.editorSelector.exists))
            .length > 0;
        const existsNotebook = (await driver.findElements(locator.notebook.exists)).length > 0;

        return editorSelectorExists || existsNotebook;
    });
};

export const webViewIsReady = (iframe: WebElement): Condition<boolean> => {
    return new Condition("for web view to be ready", async () => {
        return (await iframe.getAttribute("class")).includes("webview ready");
    });
};

const shellSessionIsSuccessful = (): Condition<boolean> => {
    return new Condition("for DB Connection is successful", async () => {
        return (await driver.findElements(locator.shellSession.exists)).length > 0;
    });
};

export const dbConnectionIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
    return new Condition(`for DB connection ${connection.caption} to be opened`, async () => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const existsPasswordDialog = (await driver.findElements(locator.passwordDialog.exists)).length > 0;
        if (existsPasswordDialog) {
            await DatabaseConnection.setCredentials(connection);
            await driver.wait(dbConnectionIsSuccessful(), constants.wait15seconds);
        }
        const existsNotebook = (await driver.findElements(locator.notebook.exists)).length > 0;
        const existsGenericDialog = (await driver.findElements(locator.genericDialog.exists)).length > 0;

        return existsNotebook || existsGenericDialog;
    });
};

export const mdsConnectionIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
    return new Condition(`for MDS connection ${connection.caption} to be opened`, async () => {
        if (!(await Misc.insideIframe())) {
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
            await DatabaseConnection.setCredentials(connection);
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
    return new Condition(`for Shell session ${connection.caption} to be opened`, async () => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();
        const existsPasswordDialog = (await driver.findElements(locator.passwordDialog.exists)).length > 0;
        if (existsPasswordDialog) {
            await DatabaseConnection.setCredentials(connection);
            await driver.wait(shellSessionIsSuccessful(),
                constants.wait15seconds, "Shell session was not successful");
        }

        return (await driver.findElements(locator.shellConsole.editor)).length > 0;
    });
};

export const isDefaultItem = (section: string, treeItemName: string, itemType: string): Condition<boolean> => {
    return new Condition(`for ${treeItemName} to be marked as default on section ${section}`, async () => {
        await driver.wait(sectionIsNotLoading(section), constants.wait25seconds,
            `${section} is still loading`);

        return Tree.isElementDefault(section, treeItemName, itemType);
    });
};

export const elementLocated = (context: WebElement, locator: Locator): Condition<boolean> => {
    return new Condition(`for element ${String(locator)} to be found`, async () => {
        return (await context.findElements(locator)).length > 0;
    });
};

export const toolbarButtonIsDisabled = (button: string): Condition<boolean> => {
    return new Condition(`for button ${button} to be disabled`, async () => {
        const btn = await Notebook.getToolbarButton(button);

        return (await btn.getAttribute("class")).includes("disabled");
    });
};

export const toolbarButtonIsEnabled = (button: string): Condition<boolean> => {
    return new Condition(`for button ${button} to be enabled`, async () => {
        const btn = await Notebook.getToolbarButton(button);

        return !(await btn.getAttribute("class")).includes("disabled");
    });
};

export const resultTabIsMaximized = (): Condition<boolean> => {
    return new Condition(`for result tab to be maximezed`, async () => {
        return (await driver.findElements(locator.notebook.codeEditor.editor.result.status.normalize)).length > 0;
    });
};

export const resultTabIsNormalized = (): Condition<boolean> => {
    return new Condition(`for result tab to be maximezed`, async () => {
        return (await driver.findElements(locator.notebook.codeEditor.editor.result.status.normalize)).length === 0;
    });
};

export const editorHasNewPrompt = (): Condition<boolean> => {
    return new Condition(`for editor to have a new prompt`, async () => {
        const editorSentences = await driver.findElements(locator.notebook.codeEditor.editor.sentence);

        return (await (editorSentences[editorSentences.length - 1]).getAttribute("innerHTML"))
            .match(/<span><\/span>/) !== null;
    });
};

export const notificationExists = (notification: string, dismiss = true,
    expectFailure = false): Condition<boolean> => {
    return new Condition(`for notication '${notification}' to be displayed`, async () => {
        try {
            await Misc.switchBackToTopFrame();
            const escapedText = notification.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
            const ntfs = await new extWorkbench().getNotifications();
            for (const ntf of ntfs) {
                if (expectFailure === false) {
                    if (await ntf.getType() === NotificationType.Error) {
                        throw new Error("There is a notification with error");
                    }
                }
                if ((await ntf.getMessage()).match(new RegExp(escapedText)) !== null) {
                    if (dismiss) {
                        await Workbench.dismissNotifications();
                    }

                    return true;
                } else {
                    console.warn(`Found notification: ${await ntf.getMessage()}`);
                }
            }
        } catch (e) {
            if (!(e instanceof error.StaleElementReferenceError)) {
                throw e;
            }
        }
    });
};

export const routerIconIsActive = (): Condition<boolean> => {
    return new Condition(`for router icon to be active`, async () => {
        const dbSection = await Section.getSection(constants.dbTreeSection);
        await Section.clickToolbarButton(dbSection, constants.reloadConnections);
        await driver.wait(sectionIsNotLoading(constants.dbTreeSection), constants.wait5seconds);

        return Tree.isRouterActive();
    });
};

export const routerIconIsInactive = (): Condition<boolean> => {
    return new Condition(`for router icon to be inactive`, async () => {
        const dbSection = await Section.getSection(constants.dbTreeSection);
        await Section.clickToolbarButton(dbSection, constants.reloadConnections);
        await driver.wait(sectionIsNotLoading(constants.dbTreeSection), constants.wait5seconds);

        return !(await Tree.isRouterActive());
    });
};

export const extensionIsReady = (): Condition<boolean> => {
    return new Condition("for the Extension to be ready", async () => {
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
            const path = join(await Os.getExtentionOutputLogsFolder(), constants.feLogFile);
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

