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

import { WebElement, until, Condition } from "vscode-extension-tester";
import { driver, Misc } from "../../Misc";
import * as locator from "../../locators";
import * as interfaces from "../../interfaces";
import * as constants from "../../constants";

export class HeatWaveProfileEditor {

    /**
     * Verifies if the HeatWave Profile Editor is opened
     * @returns A promise resolving to true if the HeatWave Profile Editor is opened, false otherwise
     */
    public isOpened = async (): Promise<boolean> => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();

        return (await driver.findElements(locator.notebook.codeEditor.editor.result.chatOptions.panel)).length > 0;
    };

    /**
     * Verifies if the HeatWave Profile Editor is opened
     * @returns A condition resolving to true if the tab is selected, false otherwise
     */
    public untilIsOpened = (): Condition<boolean> => {
        return new Condition(`for HeatWave Profile Editor to be opened`, async () => {
            return this.isOpened();
        });
    };

    /**
     * Gets the history rows
     * @returns A promise resolving with the history rows
     */
    public getHistory = async (): Promise<interfaces.IHeatWaveProfileHistory[]> => {
        const historyLocator = locator.notebook.codeEditor.editor.result.chatOptions.history;
        const historyRows = await driver.findElements(historyLocator.row);

        return Promise.all(
            historyRows.map(async (row: WebElement) => {
                return {
                    userMessage: await (await row.findElement(historyLocator.cell.userMessage)).getText(),
                    chatBotOptions: await (await row.findElement(historyLocator.cell.chatBotMessage)).getText(),
                };
            }));
    };

    /**
     * Gets the database tables
     * @returns A promise resolving with the database tables
     */
    public getDatabaseTables = async (): Promise<string[]> => {
        const dbTables = await driver.findElements(locator.notebook.codeEditor.editor.result.chatOptions.databaseTable);

        return Promise.all(
            dbTables.map(async (item: WebElement) => {
                return item.getText();
            }));
    };

    /**
     * Gets the matched documents
     * @returns A promise resolving with the database tables
     */
    public getMatchedDocuments = async (): Promise<interfaces.IHeatWaveProfileMatchedDocument[]> => {
        const matchedDocumentsLocator = locator.notebook.codeEditor.editor.result.chatOptions.matchedDocuments;
        const matchedDocumentsRows = await driver.findElements(matchedDocumentsLocator.row);

        return Promise.all(
            matchedDocumentsRows.map(async (row: WebElement) => {
                return {
                    title: await (await row.findElement(matchedDocumentsLocator.cell.title)).getText(),
                    segment: await (await row.findElement(matchedDocumentsLocator.cell.segment)).getText(),
                };
            }));
    };

    /**
     * Selects a model
     * @param model The model
     * @returns A promise resolving when the model is selected
     */
    public selectModel = async (model: string): Promise<void> => {
        const modelLocator = locator.notebook.codeEditor.editor.result.chatOptions.model;
        await driver.findElement(modelLocator.selectList).click();
        await driver.wait(until.elementLocated(modelLocator.list), constants.wait5seconds,
            "The model list was not displayed");

        switch (model) {

            case constants.modelCohere: {
                await driver.findElement(modelLocator.item.cohere).click();
                break;
            }

            case constants.modelCohereLight: {
                await driver.findElement(modelLocator.item.cohereLight).click();
                break;
            }

            case constants.modelLlama2: {
                await driver.findElement(modelLocator.item.llama2).click();
                break;
            }

            case constants.modelMistral: {
                await driver.findElement(modelLocator.item.mistral).click();
                break;
            }

            default: {
                throw new Error(`Unknown model ${model}`);
            }
        }
    };

    /**
     * Gets the temp
     * @returns A promise resolving with the temp
     */
    public getTemp = async (): Promise<string> => {
        return (await driver
            .findElement(locator.notebook.codeEditor.editor.result.chatOptions.temp))
            .getText();
    };

    /**
     * Clicks the Run Again button
     * @returns A promise resolving when the button is clicked
     */
    public runAgain = async (): Promise<void> => {
        await driver.findElement(locator.notebook.codeEditor.editor.result.chatOptions.runAgain).click();
    };

    /**
     * Clicks the Start New Chat button
     * @returns A promise resolving when the button is clicked
     */
    public startNewChat = async (): Promise<void> => {
        await driver.findElement(locator.notebook.codeEditor.editor.result.chatOptions.startNewChat).click();
    };

}
