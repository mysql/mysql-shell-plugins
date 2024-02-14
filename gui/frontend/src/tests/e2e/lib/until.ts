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

import { Condition, WebDriver, WebElement, Locator } from "selenium-webdriver";
import { DBNotebooks } from "./dbNotebooks.js";
import * as locator from "./locators.js";

export const toolbarButtonIsDisabled = (driver: WebDriver, button: string): Condition<boolean> => {
    return new Condition(`for button ${button} to be disabled`, async () => {
        const btn = await DBNotebooks.getToolbarButton(driver, button);

        return (await btn!.getAttribute("class")).includes("disabled");
    });
};

export const toolbarButtonIsEnabled = (driver: WebDriver, button: string): Condition<boolean> => {
    return new Condition(`for button ${button} to be enabled`, async () => {
        const btn = await DBNotebooks.getToolbarButton(driver, button);

        return !(await btn!.getAttribute("class")).includes("disabled");
    });
};

export const elementLocated = (context: WebElement, locator: Locator): Condition<boolean> => {
    return new Condition(`for element ${String(locator)} to be found`, async () => {
        return (await context.findElements(locator)).length > 0;
    });
};

export const editorHasNewPrompt = (driver: WebDriver): Condition<boolean> => {
    return new Condition(`for editor to have a new prompt`, async () => {
        const editorSentences = await driver.findElements(locator.notebook.codeEditor.editor.editorLine);

        return (await (editorSentences[editorSentences.length - 1]).getAttribute("innerHTML"))
            .match(/<span><\/span>/) !== null;
    });
};
