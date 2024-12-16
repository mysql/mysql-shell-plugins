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

import { WebElement, Condition } from "selenium-webdriver";
import { driver } from "../driver.js";
import * as constants from "../constants.js";
import * as locator from "../locators.js";

const resultLocator = locator.notebook.codeEditor.editor.result;

/**
 * This class represents a command result and all its related functions
 */
export abstract class Result {

    /** The command text*/
    public command: string;

    /** monaco-view-zone id number*/
    public id: number;

    /** Result context*/
    public resultContext: WebElement | undefined;

    public constructor(command: string, id: number) {
        this.id = id;
        this.command = command;
    }

    /**
     * Sets the result context
     * @param context The result context
     */
    public setResultContext = (context: WebElement): void => {
        this.resultContext = context;
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
    public untilIsNormalized = (): Condition<boolean> => {
        return new Condition(`for result to be normalized`, async () => {
            return (await driver.findElements(resultLocator.toolbar.maximize)).length > 0;
        });
    };

}
