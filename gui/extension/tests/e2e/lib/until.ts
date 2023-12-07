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
    logging,
    WebElement,
    Locator,
    Workbench,
    NotificationType,
    error,
} from "vscode-extension-tester";
import { join } from "path";
import fs from "fs/promises";
import * as constants from "./constants";
import { Misc, driver } from "./misc";
import { Notebook } from "./webviews/notebook";
import * as locator from "./locators";
import * as interfaces from "./interfaces";
import { Database } from "./db";
export let credentialHelperOk = true;


export const sectionIsNotLoading = (section: string): Condition<boolean> => {
    return new Condition(`for ${section} to NOT be loading`, async () => {
        const sec = await Misc.getSection(section);
        const loading = await sec.findElements(locator.section.loadingBar);
        const activityBar = new ActivityBar();
        const icon = await activityBar.getViewControl(constants.extensionName);
        const progressBadge = await icon.findElements(locator.shellForVscode.loadingIcon);

        return (loading.length === 0) && (progressBadge.length === 0);
    });
};

export const tabIsOpened = (tabName: string): Condition<boolean> => {
    return new Condition(`for ${tabName} to be opened`, async () => {
        return (await new EditorView().getOpenEditorTitles()).includes(tabName);
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

const shellSessionIsSuccessful = (): Condition<boolean> => {
    return new Condition("for DB Connection is successful", async () => {
        return (await driver.findElements(locator.shellSession.exists)).length > 0;
    });
};

export const dbConnectionIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
    return new Condition(`for DB connection ${connection.caption} to be opened`, async () => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }
        const existsPasswordDialog = (await driver.findElements(locator.passwordDialog.exists)).length > 0;
        const existsNotebook = (await driver.findElements(locator.notebook.exists)).length > 0;
        const existsGenericDialog = (await driver.findElements(locator.genericDialog.exists)).length > 0;
        if (existsPasswordDialog) {
            await Database.setDBConnectionCredentials(connection);
            await driver.wait(dbConnectionIsSuccessful(), constants.wait15seconds);
        }

        return existsNotebook || existsGenericDialog;
    });
};

export const mdsConnectionIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
    return new Condition(`for MDS connection ${connection.caption} to be opened`, async () => {
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
    return new Condition(`for Shell session ${connection.caption} to be opened`, async () => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }

        const existsPasswordDialog = (await driver.findElements(locator.passwordDialog.exists)).length > 0;

        if (existsPasswordDialog) {
            await Database.setDBConnectionCredentials(connection);
            await driver.wait(shellSessionIsSuccessful(),
                constants.wait15seconds, "Shell session was not successful");
        }

        return (await driver.findElements(locator.shellConsole.editor)).length > 0;
    });
};

export const webElementIsUpdated = (el: WebElement, lastDetailValue: string, detail: string): Condition<boolean> => {
    return new Condition(`for Web Element to be Updated from ${lastDetailValue}, on detail ${detail}`, async () => {
        return (await el.getCssValue(detail)) !== lastDetailValue;
    });
};

export const dbSectionHasConnections = (): Condition<boolean> => {
    return new Condition("for DATABASE CONNECTIONS section to have connections", async () => {
        return (await Misc.getDBConnections()).length > 0;
    });
};

export const existsOnRouterLog = (text: string | RegExp): Condition<boolean> => {
    return new Condition(`for ${String(text)} to exist on Router log`, async () => {
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
    return new Condition(`for ${treeItemName} to be marked as default`, async () => {
        return Misc.isDefaultItem(section, treeItemName, itemType);
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
            const escapedText = notification.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
            const ntfs = await new Workbench().getNotifications();
            for (const ntf of ntfs) {
                if (expectFailure === false) {
                    if (await ntf.getType() === NotificationType.Error) {
                        throw new Error("There is a notification with error");
                    }
                }
                if ((await ntf.getMessage()).match(new RegExp(escapedText)) !== null) {
                    if (dismiss) {
                        await Misc.dismissNotifications();
                    }

                    return true;
                } else {
                    console.warn(`Found notification: ${await ntf.getMessage()}`);
                }
            }
        } catch (e) {
            if (!(e instanceof error.StaleElementReferenceError)) {
                return false;
            }
        }
    });
};

export const routerProcessIsRunning = (): Condition<boolean> => {
    return new Condition("for Router to be running", () => {
        return Misc.isRouterProcessRunning();
    });
};

export const routerIconIsActive = (): Condition<boolean> => {
    return new Condition(`for router icon to be active`, async () => {
        const dbSection = await Misc.getSection(constants.dbTreeSection);
        await Misc.clickSectionToolbarButton(dbSection, constants.reloadConnections);
        await driver.wait(sectionIsNotLoading(constants.dbTreeSection), constants.wait5seconds);

        return Misc.isRouterIconActive();
    });
};

export const routerIconIsInactive = (): Condition<boolean> => {
    return new Condition(`for router icon to be inactive`, async () => {
        const dbSection = await Misc.getSection(constants.dbTreeSection);
        await Misc.clickSectionToolbarButton(dbSection, constants.reloadConnections);
        await driver.wait(sectionIsNotLoading(constants.dbTreeSection), constants.wait5seconds);

        return !(await Misc.isRouterIconActive());
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
                await Misc.reloadVSCode();
            }
        }

        if (feWasLoaded === false) {
            console.log("<<<<MYSQLSH Logs>>>>");
            await Misc.writeMySQLshLogs();
            const logs = driver.manage().logs();
            console.log("<<<<<DEV TOOLS Console log>>>>");
            console.log(await logs.get(logging.Type.BROWSER));

            const text = `Extension was not loaded successfully after ${feLoadTries} tries. Check the logs.`;
            // one last try to recover
            const path = join(await Misc.getExtentionOutputLogsFolder(), constants.feLogFile);
            const output = (await fs.readFile(path)).toString();
            console.log("-----OUTPUT LOGS------");
            console.log(output);
            throw new Error(text);
            /*if (output.match(/(ERROR|error)/) !== null) {
                console.log("An error was found on the OUTPUT tab, removing Internal DB");
                await Misc.removeInternalDB();
                text += `Internal DB was removed. Please re-run the tests`;
                await Misc.reloadVSCode();
                try {
                    await loadTry();
                } catch (e) {
                    throw new Error(text);
                }
            } else {
                throw new Error(text);
            }*/
        }

        credentialHelperOk = await Misc.findOnMySQLShLog(/Failed to initialize the default helper/);
        credentialHelperOk = !credentialHelperOk;
        await Misc.dismissNotifications();
        await Misc.switchBackToTopFrame();

        return true;
    });
};

