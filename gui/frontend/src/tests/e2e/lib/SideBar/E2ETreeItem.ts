/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import { Condition, until, WebElement, error } from "selenium-webdriver";
import * as constants from "../constants.js";
import * as locator from "../locators.js";
import { driver } from "../driver.js";

/**
 * This class represents the tree item within the tree
 */
export class E2ETreeItem extends WebElement {

    /** The item caption */
    public caption: string | undefined;

    /** The item sub caption */
    public subCaption: string | undefined;

    /** The item tree level */
    public level: number | undefined;

    public constructor(root: WebElement) {
        super(driver, root.getId());
    }

    /**
     * Verifies if the tree element exists
     * @returns A promise resolving with true if the element exists, false otherwise
     */
    public exists = async (): Promise<boolean> => {
        try {
            await this.getAttribute("innerHTML");

            return true;
        } catch (e) {
            if (e instanceof error.StaleElementReferenceError) {
                return false;
            } else {
                throw e;
            }
        }
    };

    /**
     * Sets the tree item level
     */
    public setLevel = async (): Promise<void> => {
        const level = (await this.getAttribute("class")).match(/tabulator-tree-level-(\d+)/)![1];
        this.level = parseInt(level, 10);
    };

    /**
     * Gets the tree item caption
     * @returns The tree item caption
     */
    public getCaption = async (): Promise<string> => {
        const dbItem = await this.findElements(locator.section.tree.element.dbTreeEntry);
        const genericItem = await this.findElements(locator.section.tree.element.label);

        if (dbItem.length > 0) {
            return (await dbItem[0].findElement(locator.section.tree.element.mainCaption)).getText();
        } else if (genericItem.length > 0) {
            return genericItem[0].getText();
        } else {
            throw new Error(`Could not find any items on the tree (setting caption)`);
        }
    };

    /**
     * Sets the tree item caption
     */
    public setCaption = async (): Promise<void> => {
        this.caption = await this.getCaption();
    };

    /**
     * Sets the tree item sub caption
     */
    public setSubCaption = async (): Promise<void> => {
        const dbItem = await this.findElements(locator.section.tree.element.dbTreeEntry);

        if (dbItem.length > 0) {
            this.subCaption = await (await dbItem[0].findElement(locator.section.tree.element.subCaption)).getText();
        } else {
            throw new Error(`Could not find any items on the tree (setting sub caption)`);
        }
    };

    /**
     * Verifies if a DBSystem is stopped
     * @returns A promise resolving with true if the DB System is stopped, false otherwise
     */
    public hasRedMark = async (): Promise<boolean> => {
        const itemIcon = await this.findElement(locator.section.tree.element.icon.exists);
        const itemStyle = await itemIcon.getCssValue("mask-image");

        return itemStyle.includes("statusDotMask");
    };

    /**
     * Gets an action button from a tree element
     * @param actionButton The action button d
     * @returns A promise resolving with the button
     */
    public getActionButton = async (actionButton: string): Promise<WebElement | undefined> => {
        let treeItemActionButton: WebElement | undefined;

        await driver.actions().move({ origin: this }).perform();

        if (actionButton === constants.openNewConnectionUsingNotebook) {
            treeItemActionButton = await this
                .findElement(locator.section.tree.element.actions.openNewConnectionUsingNotebook);
        } else if (actionButton === constants.refreshConnection) {
            treeItemActionButton = await this
                .findElement(locator.section.tree.element.actions.refreshConnection);
        } else if (actionButton === constants.newMySQLScript) {
            treeItemActionButton = await this
                .findElement(locator.section.tree.element.actions.newMySQLScript);
        } else if (actionButton === constants.loadSQLScriptFromDisk) {
            treeItemActionButton = await this
                .findElement(locator.section.tree.element.actions.loadSQLScriptFromDisk);
        } else if (actionButton === constants.closeEditor) {
            treeItemActionButton = await this
                .findElement(locator.section.tree.element.actions.closeEditor);
        }
        else {
            throw new Error(`Unknown action button ${actionButton}`);
        }

        await driver.wait(until.elementIsVisible(treeItemActionButton), constants.wait3seconds,
            `${actionButton} action button was not visible`);

        return treeItemActionButton;
    };

    /**
     * Verifies if the tree item is marked as default
     * @returns A promise resolving to true when the item is marked as default
     */
    public isDefault = async (): Promise<boolean> => {
        const el = await this.findElement(locator.section.tree.element.icon.exists);
        const backImage = await el.getCssValue("mask-image");

        return backImage.match(/(Current|Default)/) !== null;
    };

    /**
     * Verifies if the tree item is marked as default
     * @returns A condition resolving to true when the item is marked as default
     */
    public untilIsDefault = (): Condition<boolean> => {
        return new Condition(`for ${this.caption} to be DEFAULT`, async () => {
            return this.isDefault();
        });
    };

}
