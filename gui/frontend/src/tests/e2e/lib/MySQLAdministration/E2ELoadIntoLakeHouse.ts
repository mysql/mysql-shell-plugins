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

import { Condition, until } from "selenium-webdriver";
import { driver } from "../../lib/driver.js";
import * as constants from "../constants.js";
import * as locator from "../locators.js";
import * as interfaces from "../interfaces.js";
import { E2EObjectStorageBrowser } from "./E2EObjectStorageBrowser.js";

export class E2ELoadIntoLakehouse {

    public objectStorageBrowser = new E2EObjectStorageBrowser();

    /**
     * Verifies if the Overview tab is selected
     * @returns A promise resolving to true if the tab is selected, false otherwise
     */
    public isOpened = async (): Promise<boolean> => {
        const tab = await driver.findElement(locator.lakeHouseNavigator.overview.tab);

        return (await tab.getAttribute("class")).includes("selected");
    };

    /**
     * Waits until a loading task exists
     * @param caption The task caption
     * @returns A promise resolving when the task exists
     */
    public untilExistsLoadingTask = (caption: string): Condition<boolean | undefined> => {
        return new Condition(` for loading task '${caption}' to exist`, async () => {
            const loadingTasks = await driver
                .findElements(locator.lakeHouseNavigator.loadIntoLakeHouse.newLoadingTask.loadingTaskItem.caption);

            for (const task of loadingTasks) {

                if (await task.getText() === caption) {
                    return true;
                }
            }
        });
    };

    /**
     * Sets the values for a new loading task
     * @param task The task
     * @returns A promise resolving when the task is submitted to be loaded
     */
    public setNewLoadingTask = async (task: interfaces.INewLoadingTask): Promise<void> => {
        const refLocator = locator.lakeHouseNavigator.loadIntoLakeHouse.newLoadingTask;

        if (task.name) {
            const taskName = await driver.findElement(refLocator.name);
            await taskName.clear();
            await taskName.sendKeys(task.name);
        }

        if (task.description) {
            const taskDescription = driver.findElement(refLocator.description);
            await taskDescription.clear();
            await driver.findElement(refLocator.description).sendKeys(task.description);
        }

        if (task.targetDatabaseSchema) {
            await driver.findElement(refLocator.targetSchema.exists).click();
            await driver.wait(until.elementLocated(refLocator.targetSchema.list),
                constants.wait3seconds, "Target schema list was not displayed");
            await (await driver.findElement(refLocator.targetSchema.item(task.targetDatabaseSchema)))
                .click();
        }

        if (task.formats) {
            await driver.findElement(refLocator.formats.exists).click();
            await driver.wait(until.elementLocated(refLocator.formats.list),
                constants.wait3seconds, "Formats list was not displayed");
            if (task.formats.includes("All")) {
                await (await driver.findElement(refLocator.formats.item.all)).click();
            } else if (task.formats.includes("PDF")) {
                await (await driver.findElement(refLocator.formats.item.pdf)).click();
            } else if (task.formats.includes("TXT")) {
                await (await driver.findElement(refLocator.formats.item.txt)).click();
            } else if (task.formats.includes("HTML")) {
                await (await driver.findElement(refLocator.formats.item.html)).click();
            } else if (task.formats.includes("DOC")) {
                await (await driver.findElement(refLocator.formats.item.doc)).click();
            } else if (task.formats.includes("PPT")) {
                await (await driver.findElement(refLocator.formats.item.ppt)).click();
            } else {
                throw new Error(`Unknown format '${task.formats}'`);
            }
        }
    };

    /**
     * Clicks on the Start Loading Task button
     * @returns A promise resolving when the button is clicked
     */
    public startLoadingTask = async (): Promise<void> => {
        await driver.findElement(locator.lakeHouseNavigator.loadIntoLakeHouse.newLoadingTask.startLoadingTask).click();
    };
}
