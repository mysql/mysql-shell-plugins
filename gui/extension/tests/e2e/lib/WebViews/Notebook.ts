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
import { WebElement, until } from "vscode-extension-tester";
import { driver, Misc } from "../Misc";
import * as constants from "../constants";
import * as locator from "../locators";
import * as errors from "../errors";
import { CodeEditor } from "./CodeEditor";
import { EditorSelector } from "./EditorSelector";

/**
 * This class aggregates the functions that perform operations inside notebooks
 */
export class Notebook {

    public editorSelector = new EditorSelector();

    public codeEditor = new CodeEditor();

    /**
     * Verifies if a toolbar button exists
     * @param button The button
     * @returns A promise resolving with true if the button exists, false otherwise
     */
    public static existsToolbarButton = async (button: string): Promise<boolean> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const toolbar = await driver.wait(until.elementLocated(locator.notebook.toolbar.exists),
            constants.wait5seconds, "Toolbar was not found");
        const buttons = await toolbar.findElements(locator.notebook.toolbar.button.exists);
        for (const btn of buttons) {
            if ((await btn.getAttribute("data-tooltip")) === button) {
                return true;
            }
        }

        return false;
    };

    /**
     * Gets a toolbar button
     * @param button The button name
     * @returns A promise resolving with the button
     */
    public static getToolbarButton = async (button: string): Promise<WebElement | undefined> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const toolbar = await driver.wait(until.elementLocated(locator.notebook.toolbar.exists),
            constants.wait5seconds, "Toolbar was not found");
        const buttons = await toolbar.findElements(locator.notebook.toolbar.button.exists);
        for (const btn of buttons) {
            if ((await btn.getAttribute("data-tooltip")) === button) {
                return btn;
            }
        }

        throw new Error(`Could not find '${button}' button`);
    };

    /**
     * Verifies if a sql and result status exist on the notebook
     * @param sql The sql query
     * @param resultStatus The result status
     * @returns A promise resolving when the notebook is verified
     */
    public static verifyNotebook = async (sql: string, resultStatus: string): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const notebookCommands: string[] = [];
        await driver.wait(async () => {
            try {
                const commands = await driver.wait(
                    until.elementsLocated(locator.notebook.codeEditor.editor.sentence),
                    constants.wait5seconds, "No lines were found");
                for (const cmd of commands) {
                    const spans = await cmd.findElements(locator.htmlTag.span);
                    let sentence = "";
                    for (const span of spans) {
                        sentence += (await span.getText()).replace("&nbsp;", " ");
                    }
                    notebookCommands.push(sentence);
                }

                return commands.length > 0;
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "No SQL commands were found on the notebook");


        if (!notebookCommands.includes(sql)) {
            throw new Error(`Could not find the SQL statement ${sql} on the notebook`);
        }

        let foundResult = false;
        const results = await driver.findElements(locator.notebook.codeEditor.editor.result.toolbar.status.exists);
        for (const result of results) {
            const text = await result.getText();
            if (text.includes(resultStatus)) {
                foundResult = true;
                break;
            }
        }

        if (!foundResult) {
            throw new Error(`Could not find the SQL result ${resultStatus} on the notebook`);
        }

    };

    /**
     * Verifies if a word exists on the notebook
     * @param word The word
     * @returns A promise resolving with true if the word is found, false otherwise
     */
    public static existsOnNotebook = async (word: string): Promise<boolean> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const commands: string[] = [];
        const regex = Misc.transformToMatch(word);
        await driver.wait(async () => {
            try {
                const notebookCommands = await driver.wait(
                    until.elementsLocated(locator.notebook.codeEditor.editor.sentence),
                    constants.wait5seconds, "No lines were found");
                for (const cmd of notebookCommands) {
                    const spans = await cmd.findElements(locator.htmlTag.span);
                    let sentence = "";
                    for (const span of spans) {
                        sentence += (await span.getText()).replace("&nbsp;", " ");
                    }
                    commands.push(sentence);
                }

                return true;
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "No SQL commands were found on the notebook");

        return commands.toString().match(regex) !== null;
    };

    /**
     * Scrolls down the notebook
     */
    public static scrollDown = async (): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const scroll = await driver.findElements(locator.notebook.codeEditor.editor.scrollBar);
        if (scroll.length > 0) {
            await driver.executeScript("arguments[0].scrollBy(0, 1500)", scroll[0]);
        }
    };

}
