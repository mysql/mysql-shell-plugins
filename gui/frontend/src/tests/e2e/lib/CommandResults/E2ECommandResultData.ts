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

import { WebElement, Condition, until } from "selenium-webdriver";
import { driver } from "../driver.js";
import * as constants from "../constants.js";
import * as locator from "../locators.js";
import { E2ECommandResult } from "./E2ECommandResult.js";
import * as interfaces from "../interfaces.js";

const resultLocator = locator.notebook.codeEditor.editor.result;

/**
 * This class represents a command result and all its related functions
 */
export class E2ECommandResultData extends E2ECommandResult {

    /** The text result*/
    #text: string | undefined;

    /** The result if the result is a text grid or a pretty json*/
    #status: string | undefined;

    /** The json result*/
    #json: string | undefined;

    /** Result graphs*/
    #graph: WebElement | undefined;

    /** Result sql preview*/
    #preview: interfaces.ICommandResultPreview | undefined;

    /** True if it's an about info for HeatWave, false otherwise*/
    #isHWAboutInfo: boolean | undefined;

    /** Chat result for HeatWave queries*/
    #chat: string | undefined;

    /**
     * Gets the text
     * @returns The text
     */
    public get text(): string | undefined {
        return this.#text;
    }

    /**
     * Gets the status
     * @returns The status
     */
    public get status(): string | undefined {
        return this.#status;
    }

    /**
     * Gets the json
     * @returns The json
     */
    public get json(): string | undefined {
        return this.#json;
    }

    /**
     * Gets the graph
     * @returns The graph
     */
    public get graph(): WebElement | undefined {
        return this.#graph;
    }

    /**
     * Gets the preview
     * @returns The preview
     */
    public get preview(): interfaces.ICommandResultPreview | undefined {
        return this.#preview;
    }

    /**
     * Gets the isHWAboutInfo
     * @returns The isHWAboutInfo
     */
    public get isHWAboutInfo(): boolean | undefined {
        return this.#isHWAboutInfo;
    }

    /**
     * Gets the chat
     * @returns The chat
     */
    public get chat(): string | undefined {
        return this.#chat;
    }

    /**
     * Sets the isHWAboutInfo
     */
    public set isHWAboutInfo(value: boolean) {
        this.#isHWAboutInfo = value;
    }

    /**
     * Sets the result text
     * @returns A promise resolving with the result text
     */
    public setText = async (): Promise<void> => {
        const resultLocator = locator.notebook.codeEditor.editor.result;
        const text = async (): Promise<string> => {
            const words = await this.resultContext!.findElements(resultLocator.singleOutput.text.words);

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

        this.#text = await text();
    };

    /**
     * Sets the toolbar status message
     * @returns A promise resolving when the toolbar status message is set
     */
    public setStatus = async (): Promise<void> => {
        let status: WebElement | undefined;
        const toolbarLocator = locator.notebook.codeEditor.editor.result.toolbar;

        await driver.wait(async () => {
            status = await this.resultContext!.findElement(toolbarLocator.status.text);

            return (await status.getAttribute("innerHTML")) !== "";
        }, constants.wait5seconds, `The status is empty for cmd ${this.command}`);

        this.#status = await status!.getAttribute("innerHTML");
    };

    /**
     * Sets the result text
     * @returns A promise resolving with the result json
     */
    public setJson = async (): Promise<void> => {
        const resultLocator = locator.notebook.codeEditor.editor.result;
        const rawJson = await this.resultContext!.findElements(resultLocator.json.raw);
        const prettyJson = await this.resultContext!.findElements(resultLocator.json.pretty);

        if (prettyJson.length > 0) {
            await this.setStatus();
            this.#json = await prettyJson[0].getAttribute("innerHTML");
        } else if (rawJson.length > 0) {
            this.#json = await rawJson[0].getAttribute("innerHTML");
        } else {
            throw new Error(`Could not find any json on result`);
        }
    };

    /**
     * Sets the result graph
     * @returns A promise resolving with the graph
     */
    public setGraph = async (): Promise<void> => {
        const resultLocator = locator.notebook.codeEditor.editor.result;

        this.#graph = await this.resultContext!.findElement(resultLocator.graphHost.column);
    };

    /**
     * Sets the result sql preview
     * @returns A promise resolving when the sql preview is set
     */
    public setPreview = async (): Promise<void> => {
        const previewLink = await this.resultContext!.findElement(resultLocator.previewChanges.link);
        const words = await this.resultContext!.findElements(resultLocator.previewChanges.words);
        let previewText = "";
        for (const word of words) {
            previewText += (await word.getAttribute("innerHTML")).replace("&nbsp;", " ");
        }

        this.#preview = {
            text: previewText,
            link: previewLink,
        };

        await this.setStatus();
    };



    /**
     * Sets the result chat text
     * @returns A promise resolving with the result text
     */
    public setChat = async (): Promise<void> => {
        const resultLocator = locator.notebook.codeEditor.editor.result;
        const chatResultIsProcessed = (): Condition<boolean> => {
            return new Condition(` for the chat result to be processed for cmd ${this.command}`, async () => {
                return (await this.resultContext!.findElements(resultLocator.chat.isProcessingResult)).length === 0;
            });
        };

        await driver.wait(chatResultIsProcessed(), constants.wait1minute);
        const text = await this.resultContext!.findElement(resultLocator.chat.resultText);
        this.#chat = await text.getText();
    };

    /**
     * Clicks the Copy result to clipboard button, on text result sets
     * @returns A promise resolving when the button is clicked
     */
    public copyToClipboard = async (): Promise<void> => {
        const output = await this.resultContext!
            .findElement(locator.notebook.codeEditor.editor.result.singleOutput.exists);
        await driver.actions().move({ origin: output }).perform();
        await this.resultContext!.findElement(locator.notebook.codeEditor.editor.result.singleOutput.copy).click();
    };

    /**
     * Returns the result block from a script execution
     * @returns A promise resolving with the result block
     */
    public getResultScript = async (): Promise<WebElement> => {
        return driver.wait(until.elementLocated(locator.notebook.codeEditor.editor.result.script));
    };

    /**
     * Waits until the HeatWave heading is displayed on the notebook
     * @returns A promise resolving when the HeatWave heading is displayed
     */
    public heatWaveChatIsDisplayed = (): Condition<boolean> => {
        return new Condition(` for the HeatWave connection to be loaded`, () => {
            return this.isHWAboutInfo === true;
        });
    };

    /**
     * Clicks on the SQL preview content
     * @returns A promise resolving when the sql preview is clicked
     */
    public clickSqlPreviewContent = async (): Promise<void> => {
        await driver.actions().move({ origin: this.preview!.link })
            .doubleClick(this.preview!.link).perform();
    };

}
