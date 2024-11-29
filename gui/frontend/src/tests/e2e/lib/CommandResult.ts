/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { WebElement, until, Condition } from "selenium-webdriver";
import { driver } from "./driver.js";
import * as constants from "./constants.js";
import * as interfaces from "./interfaces.js";
import * as locator from "./locators.js";
import { CommandResultGrid } from "./CommandResultGrid.js";
import { E2ECodeEditor } from "./E2ECodeEditor.js";
import { CommandResultToolbar } from "./CommandResultToolbar.js";

const resultLocator = locator.notebook.codeEditor.editor.result;

/**
 * This class represents a command result and all its related functions
 */
export class CommandResult implements interfaces.ICommandResult {

    /** The code editor it belongs to*/
    public codeEditor: E2ECodeEditor;

    /** The command text*/
    public command: string | undefined;

    /** monaco-view-zone id number*/
    public id: string | undefined;

    /** Result text for text-only results*/
    public text: string | undefined;

    /** Result json for json-only results*/
    public json: string | undefined;

    /** Result graphs*/
    public graph: WebElement | undefined;

    /** Result grids for SELECT queries*/
    public grid: CommandResultGrid | undefined;

    /** Result grid toolbar*/
    public toolbar: CommandResultToolbar | undefined;

    /** Result sql preview*/
    public preview: interfaces.ICommandResultPreview | undefined;

    /** Result tabs*/
    public tabs: interfaces.ICommandResultTab[] | undefined;

    /** True if it's an about info for HeatWave, false otherwise*/
    public isHWAboutInfo: boolean | undefined;

    /** Chat result for HeatWave queries*/
    public chat: string | undefined;

    /** Result context*/
    public context: WebElement | undefined;

    public constructor(codeEditor: E2ECodeEditor, command?: string, id?: string) {
        this.codeEditor = codeEditor;
        this.id = id;
        this.command = command;
    }

    /**
     * Loads this object properties (a result), according to what is found on the DOM
     * @param fromScript If the result is coming from a script execution
     * @returns A promise resolving when the object is loaded
     */
    public loadResult = async (fromScript = false): Promise<void> => {
        this.context = await this.getResultContext(this.command, this.id, fromScript);
        const resultType = await this.getResultType();

        if (this.expectTabs(this.command!) === true) {
            await this.setTabs();
        }

        switch (resultType) {

            case constants.isGridText: {
                await this.setGridText();
                this.json = undefined;
                this.graph = undefined;
                this.preview = undefined;
                break;
            }

            case constants.isText: {
                await this.setText();
                this.chat = undefined;
                this.isHWAboutInfo = false;
                this.toolbar = undefined;
                this.json = undefined;
                this.graph = undefined;
                this.preview = undefined;
                this.grid = undefined;
                break;
            }

            case constants.isJson: {
                await this.setJson();
                this.chat = undefined;
                this.isHWAboutInfo = false;
                this.text = undefined;
                this.graph = undefined;
                this.preview = undefined;
                this.grid = undefined;
                break;
            }

            case constants.isGraph: {
                await this.setGraph();
                this.chat = undefined;
                this.isHWAboutInfo = false;
                this.text = undefined;
                this.toolbar = undefined;
                this.json = undefined;
                this.preview = undefined;
                this.grid = undefined;
                break;
            }

            case constants.isGrid: {
                await this.setGrid();
                await this.setToolbar();
                this.chat = undefined;
                this.isHWAboutInfo = false;
                this.json = undefined;
                this.graph = undefined;
                this.preview = undefined;
                this.text = undefined;
                break;
            }

            case constants.isSqlPreview: {
                await this.setPreview();
                this.json = undefined;
                this.graph = undefined;
                this.grid = undefined;
                this.text = undefined;
                this.chat = undefined;
                this.isHWAboutInfo = false;
                break;
            }

            case constants.isHWAboutInfo: {
                this.preview = undefined;
                this.json = undefined;
                this.graph = undefined;
                this.grid = undefined;
                this.text = undefined;
                this.isHWAboutInfo = true;
                this.chat = undefined;
                break;
            }

            case constants.isChat: {
                await this.setChat();
                this.preview = undefined;
                this.json = undefined;
                this.graph = undefined;
                this.grid = undefined;
                this.text = undefined;
                this.isHWAboutInfo = false;
                break;
            }

            default: {
                throw new Error(`Could not find the loading result type for cmd ${this.command}`);
            }
        }
    };

    /**
     * Selects a tab from the result set
     * @param name the tab name
     * @returns A promise resolving when the tab is selected
     */
    public selectTab = async (name: string): Promise<void> => {
        await this.tabs!.find((item: interfaces.ICommandResultTab) => {
            return item.name === name;
        })!.element.click();

        await this.loadResult();
    };

    /**
     * Clicks on the SQL preview content
     * @returns A promise resolving when the sql preview is clicked
     */
    public clickSqlPreviewContent = async (): Promise<void> => {
        await driver.actions().move({ origin: this.preview!.link })
            .doubleClick(this.preview!.link).perform();
        await this.loadResult();
    };

    /**
     * Clicks the Copy result to clipboard button, on text result sets
     * @returns A promise resolving when the button is clicked
     */
    public copyToClipboard = async (): Promise<void> => {
        const context = await this.getResultContext(this.command, this.id);
        const output = await context.findElement(locator.notebook.codeEditor.editor.result.singleOutput.exists);
        await driver.actions().move({ origin: output }).perform();
        await context.findElement(locator.notebook.codeEditor.editor.result.singleOutput.copy).click();
    };

    /**
     * Gets the result block for an expected result id
     * When the nextId is undefined, the method will return the last existing command result on the editor
     * @param cmd The command
     * @param searchOnExistingId The next expected result id
     * @param fromScript If the result is coming from a script execution
     * @returns A promise resolving when the mouse cursor is placed at the desired spot
     */
    public getResultContext = async (cmd?: string, searchOnExistingId?: string,
        fromScript = false): Promise<WebElement> => {
        let result: WebElement;
        if (!fromScript) {
            cmd = cmd ?? "last result";
            try {
                if (searchOnExistingId) {
                    result = await driver.wait(until
                        .elementLocated(locator.notebook.codeEditor.editor.result
                            .existsById(String(searchOnExistingId))),
                        constants.wait3seconds, `Could not find result id ${String(searchOnExistingId)} for ${cmd}`);
                    this.id = searchOnExistingId;
                } else {
                    const results = await driver.wait(until
                        .elementsLocated(locator.notebook.codeEditor.editor.result.exists),
                        constants.wait3seconds, `Could not find results for ${cmd}`);
                    const id = (await results[results.length - 1].getAttribute("monaco-view-zone")).match(/(\d+)/)![1];
                    this.id = id;
                    result = results[results.length - 1];
                }
            } catch (e) {
                const results = await driver.findElements(locator.notebook.codeEditor.editor.result.exists);
                if (results.length > 0) {
                    const id = await results[results.length - 1].getAttribute("monaco-view-zone");
                    this.id = id.match(/\d+/)![0];

                    return results[results.length - 1];
                } else {
                    console.error("[DEBUG] No results at all were found on the notebook");
                    throw e;
                }
            }
        } else {
            return driver.wait(until.elementLocated(locator.notebook.codeEditor.editor.result.script),
                constants.wait5seconds, `Could not find any script result, for cmd ${cmd}`);
        }

        await this.codeEditor.scrollDown();

        return result;
    };

    /**
     * Returns the result block from a script execution
     * @returns A promise resolving with the result block
     */
    public getResultScript = async (): Promise<WebElement> => {
        return driver.wait(until.elementLocated(locator.notebook.codeEditor.editor.result.script));
    };

    /**
     * Normalize the result grid
     * @returns A promise resolving when the result is normalized
     */
    public normalize = async (): Promise<void> => {
        await driver.findElement(resultLocator.toolbar.normalize).click();
        await driver.wait(this.untilIsNormalized(), constants.wait5seconds);
    };

    /**
     * Verifies if the result is maximized
     * @returns A condition resolving to true if the result is maximized, false otherwise
     */
    public untilIsMaximized = (): Condition<boolean> => {
        return new Condition(`for result to be maximized`, async () => {
            const editor = await driver.findElements(locator.notebook.codeEditor.editor.host);

            return (await driver.findElements(resultLocator.toolbar.normalize)).length > 0 && editor.length > 0;
        });
    };

    /**
     * Verifies if the result is maximized
     * @returns A condition resolving to true if the result is maximized, false otherwise
     */
    public untilIsNormalized = (): Condition<boolean> => {
        return new Condition(`for result to be normalized`, async () => {
            return (await driver.findElements(resultLocator.toolbar.maximize)).length > 0;
        });
    };

    /**
     * Verifies if the grid is editable
     * @returns A condition resolving to true if the grid is editable
     */
    public untilIsEditable = (): Condition<boolean> => {
        return new Condition(`for result grid to be editable`, async () => {
            const editButton = await this.context!.findElement(resultLocator.toolbar.editButton);

            return (await editButton.getAttribute("class")).includes("disabled") === false;
        });
    };

    /**
     * Waits until the HeatWave heading is displayed on the notebook
     * @returns A promise resolving when the HeatWave heading is displayed
     */
    public heatWaveChatIsDisplayed = (): Condition<boolean> => {
        return new Condition(` for the HeatWave connection to be loaded`, async () => {
            await this.loadResult();

            return this.isHWAboutInfo === true;
        });
    };

    /**
     * Sets the result grid text, from command "Execute and print result as text"
     * @returns A promise resolving with the result grid text
     */
    private setGridText = async (): Promise<void> => {
        await this.setText();
        await this.setToolbar();
    };

    /**
     * Sets the result text
     * @returns A promise resolving with the result text
     */
    private setText = async (): Promise<void> => {
        const resultLocator = locator.notebook.codeEditor.editor.result;
        const text = async (): Promise<string> => {
            const words = await this.context!.findElements(resultLocator.singleOutput.text.words);

            if (words.length > 1) {
                let sentence = "";
                for (const word of words) {
                    const hasChildren = (await word.findElements(resultLocator.singleOutput.text.children)).length > 0;

                    if (!hasChildren) {
                        sentence += await word.getAttribute("innerHTML");
                    }
                }

                return sentence;
            } else {
                return words[0].getAttribute("innerHTML");
            }
        };

        if (this.command) {
            if (this.command.match(/export/) !== null) {
                await driver.wait(async () => {
                    return (await text()).match(/The dump can be loaded using/) !== null;
                }, constants.wait5seconds, "Could not find on result 'The dump can be loaded using'");
            } else if (this.command.match(/(\\c|connect).*@.*/) !== null) {
                await driver.wait(async () => {
                    return (await text()).match(/schema/) !== null;
                }, constants.wait5seconds, "Could not find 'schema' on result");
            }
        }

        this.text = await text();
    };

    /**
     * Sets the result chat text
     * @returns A promise resolving with the result text
     */
    private setChat = async (): Promise<void> => {
        const resultLocator = locator.notebook.codeEditor.editor.result;
        const chatResultIsProcessed = (): Condition<boolean> => {
            return new Condition(` for the chat result to be processed for cmd ${this.command}`, async () => {
                return (await this.context!.findElements(resultLocator.chat.isProcessingResult)).length === 0;
            });
        };

        await driver.wait(chatResultIsProcessed(), constants.wait1minute);
        const text = await this.context!.findElement(resultLocator.chat.resultText);
        this.chat = await text.getText();
    };

    /**
     * Sets the result text
     * @returns A promise resolving with the result json
     */
    private setJson = async (): Promise<void> => {
        const resultLocator = locator.notebook.codeEditor.editor.result;

        const rawJson = await this.context!.findElements(resultLocator.json.raw);
        const prettyJson = await this.context!.findElements(resultLocator.json.pretty);

        if (rawJson.length > 0) {
            this.toolbar = undefined;
            this.json = await rawJson[0].getAttribute("innerHTML");
        }

        if (prettyJson.length > 0) {
            await this.setToolbar();
            this.json = await prettyJson[0].getAttribute("innerHTML");
        }
    };

    /**
     * Sets the result toolbar
     * @returns A promise resolving when toolbar content is set
     */
    private setToolbar = async (): Promise<void> => {
        this.toolbar = new CommandResultToolbar(this);
        await this.toolbar.setStatus();
    };

    /**
     * Sets the result graph
     * @returns A promise resolving with the graph
     */
    private setGraph = async (): Promise<void> => {
        const resultLocator = locator.notebook.codeEditor.editor.result;

        this.graph = await this.context!.findElement(resultLocator.graphHost.column);
    };

    /**
     * Returns true if it is expected that the given command will return a result with tabs (ex. Multiple
     * select queries)
     * @param cmd The command
     * @returns A promise resolving with true if there are tabs expected, false otherwise
     */
    private expectTabs = (cmd: string): boolean => {
        if (cmd) {
            const selectMatch = cmd.match(/(select|SELECT)/g);
            const matchSpecial = cmd.match(/(UNION|INTERSECT|EXCEPT|for update|\()/g);
            if (selectMatch && selectMatch.length > 1) { // more than 1 select
                if (matchSpecial) {
                    return false;
                } else {
                    return true;
                }

            } else {
                return false;
            }
        } else {
            return false;
        }
    };

    /**
     * Sets the result grids
     * @returns A promise resolving with the graph
     */
    private setTabs = async (): Promise<void> => {
        const tabLocator = locator.notebook.codeEditor.editor.result.tabs;

        const tabContext = await driver.wait(async () => {
            const tabs = await this.context!.findElements(tabLocator.exists);
            if (tabs.length > 0) {
                return tabs[0];
            }
        }, constants.wait5seconds, `Could not find the tabs for cmd ${this.command}`);

        const tabsToGrab: interfaces.ICommandResultTab[] = [];
        const existingTabs = await tabContext!.findElements(tabLocator.tab);
        for (const existingTab of existingTabs) {
            tabsToGrab.push({
                name: await (await existingTab.findElement(locator.htmlTag.label)).getText(),
                element: existingTab,
            });
        }

        if (tabsToGrab.length > 0) {
            this.tabs = tabsToGrab;
        } else {
            throw new Error(`The number of tabs should be at least 1, for cmd ${this.command}`);
        }
    };

    /**
     * Sets the result grid
     * @returns A promise resolving when the grid is set
     */
    private setGrid = async (): Promise<void> => {
        const gridLocator = locator.notebook.codeEditor.editor.result.grid;

        // Sometimes the grid content is not loaded. When this happens, we click on the first column title to force it
        await driver.wait(async () => {
            return (await (this.context!.findElements(gridLocator.row.cell.exists))).length > 0;
        }, constants.wait2seconds, `Table cells were not loaded for cmd ${this.command}`).catch(async () => {
            this.context = await this.getResultContext(this.command, this.id);
            const columnTitles = await this.context.findElements(gridLocator.columnTitle);
            await driver.executeScript("arguments[0].click()", columnTitles[0]);
            await driver.wait(async () => {
                return (await (this.context!.findElements(gridLocator.row.cell.exists))).length > 0;
            }, constants.wait10seconds, `Table cells were not loaded for cmd ${this.command} for the second time`);
        });

        await this.setToolbar();
        const grid = new CommandResultGrid(this);
        await grid.setContent();
        await grid.setColumnsMap();
        this.grid = grid;
    };

    /**
     * Sets the result sql preview
     * @returns A promise resolving when the sql preview is set
     */
    private setPreview = async (): Promise<void> => {
        const previewLink = await this.context!.findElement(resultLocator.previewChanges.link);
        const words = await this.context!.findElements(resultLocator.previewChanges.words);
        let previewText = "";
        for (const word of words) {
            previewText += (await word.getAttribute("innerHTML")).replace("&nbsp;", " ");
        }

        this.preview = {
            text: previewText,
            link: previewLink,
        };

        await this.setToolbar();
    };

    /**
     * Gets the result type
     * @returns A promise resolving with the result type
     */
    private getResultType = async (): Promise<string> => {
        let type = "";

        const resultLocator = locator.notebook.codeEditor.editor.result;
        await driver.wait(async () => {
            if ((await this.context!.findElements(resultLocator.singleOutput.exists)).length > 0 &&
                ((await this.context!.findElements(resultLocator.singleOutput.text.exists)).length > 0) &&
                ((await this.context!.findElements(resultLocator.grid.status)).length > 0) &&
                (await this.context!.findElements(resultLocator.json.pretty)).length === 0) {
                type = constants.isGridText;

                return true;
            }

            if ((await this.context!.findElements(resultLocator.singleOutput.exists)).length > 0 &&
                ((await this.context!.findElements(resultLocator.singleOutput.text.exists)).length > 0) &&
                (await this.context!.findElements(resultLocator.grid.status)).length === 0 &&
                (await this.context!.findElements(resultLocator.json.pretty)).length === 0) {
                type = constants.isText;

                return true;
            }

            if ((await this.context!.findElements(resultLocator.singleOutput.exists)).length > 0 &&
                (((await this.context!.findElements(resultLocator.json.pretty)).length > 0) ||
                    (await this.context!.findElements(resultLocator.json.raw)).length > 0)
            ) {
                type = constants.isJson;

                return true;
            }

            if ((await this.context!.findElements(resultLocator.graphHost.exists)).length > 0) {
                type = constants.isGraph;

                return true;
            }

            if ((await this.context!.findElements(resultLocator.grid.exists)).length > 0) {
                type = constants.isGrid;

                return true;
            }

            if ((await this.context!
                .findElements(locator.notebook.codeEditor.editor.result.previewChanges.exists)).length > 0) {
                type = constants.isSqlPreview;

                return true;
            }

            if ((await this.context!.findElements(resultLocator.chat.aboutInfo)).length > 0) {
                type = constants.isHWAboutInfo;

                return true;
            }

            if ((await this.context!.findElements(resultLocator.chat.isProcessingResult)).length > 0) {
                type = constants.isChat;

                return true;
            }
        }, constants.wait5seconds, `Could not get the result type for ${this.command}`);

        return type;
    };
}
