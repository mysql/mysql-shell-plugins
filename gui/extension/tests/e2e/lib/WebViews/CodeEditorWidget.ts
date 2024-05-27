/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { until, WebElement, Condition } from "vscode-extension-tester";
import { Notebook } from "./Notebook";
import * as constants from "../constants";
import * as locator from "../locators";
import { Misc, driver } from "../Misc";

/**
 * This class represents the code editor widget
 */
export class CodeEditorWidget {

    private widget: WebElement;

    /**
     * Creates the widget web element
     * @returns A promise resolving when widget is created
     */
    public open = async (): Promise<CodeEditorWidget> => {
        const findBtn = await Notebook.getToolbarButton("Find");
        await findBtn.click();
        this.widget = await driver.wait(until.elementLocated(locator.findWidget.exists), constants.wait5seconds,
            "Could not find the widget");
        await driver.wait(until.elementIsVisible(this.widget), constants.wait3seconds, "Widget is not visible");

        return this;
    };

    /**
     * Sets the text to find
     * @param text The text
     * @returns A promise resolving when the text is set
     */
    public setTextToFind = async (text: string): Promise<void> => {
        const input = await this.widget.findElement(locator.findWidget.textAreaFind);
        await input.clear();
        await input.sendKeys(text);
    };

    /**
     * Sets the text to replace
     * @param text The text
     * @returns A promise resolving when the text is set
     */
    public setTextToReplace = async (text: string): Promise<void> => {
        const input = await this.widget.findElement(locator.findWidget.textAreaReplace);
        await input.clear();
        await input.sendKeys(text);
    };

    /**
     * Toggles the find in selection on the find widget
     * @param flag True to enable, false otherwise
     * @returns A promise resolving when button is clicked
     */
    public toggleFindInSelection = async (flag: boolean): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const actions = await this.widget.findElements(locator.findWidget.actions);
        for (const action of actions) {
            if ((await action.getAttribute("title")).includes("Find in selection")) {
                const checked = await action.getAttribute("aria-checked");
                if (checked === "true") {
                    if (!flag) {
                        await action.click();
                    }
                } else {
                    if (flag) {
                        await action.click();
                    }
                }

                return;
            }
        }
    };

    /**
     * Verifies if a text matches the matcher
     * @param matcher The matcher
     * @returns A condition resolving to true if there is a match, false otherwise
     */
    public matchesCount = (matcher: RegExp): Condition<boolean> => {
        return new Condition(`for text to match ${matcher}`, async () => {
            return (await this.widget.findElement(locator.findWidget.matchesCount).getText()).match(matcher) !== null;
        });
    };

    /**
     * Expands or collapses the find and replace on the find widget
     * @param expand True to expand, false to collapse
     * @returns A promise resolving when replacer is expanded or collapsed
     */
    public toggleFinderReplace = async (expand: boolean): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const toggleReplace = await this.widget.findElement(locator.findWidget.toggleReplace);
        const isExpanded = (await this.widget.findElements(locator.findWidget.toggleReplaceExpanded)).length > 0;
        if (expand) {
            if (!isExpanded) {
                await driver.executeScript("arguments[0].click()", toggleReplace);
            }
        } else {
            if (isExpanded) {
                await driver.executeScript("arguments[0].click()", toggleReplace);
            }
        }
    };

    /**
     * Clicks the replace button
     * @returns A promise resolving when button is clicked
     */
    public replace = async (): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const replaceActions = await this.widget.findElements(locator.findWidget.replaceActions);
        for (const action of replaceActions) {
            if ((await action.getAttribute("aria-label")).indexOf("Replace (Enter)") !== -1) {
                await action.click();

                return;
            }
        }
    };

    /**
     * Clicks the replace all button
     * @returns A promise resolving when button is clicked
     */
    public replaceAll = async (): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const replaceActions = await this.widget.findElements(locator.findWidget.replaceActions);
        for (const action of replaceActions) {
            if ((await action.getAttribute("aria-label")).indexOf("Replace All") !== -1) {
                await action.click();

                return;
            }
        }
    };

    /**
     * Closes the widget finder
     * @returns A promise resolving when finder is closed
     */
    public close = async (): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        await driver.wait(async () => {
            const findWidget = await driver.findElements(locator.findWidget.exists);
            if (findWidget.length > 0) {
                const closeButton = await findWidget[0].findElement(locator.findWidget.close);
                await driver.executeScript("arguments[0].click()", closeButton);

                return (await driver.findElements(locator.findWidget.exists)).length === 0;
            } else {
                return true;
            }
        }, constants.wait5seconds, "The finder widget was not closed");
    };

}
