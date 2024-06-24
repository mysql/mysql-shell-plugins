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

import { WebElement, until, Condition } from "selenium-webdriver";
import { driver } from "./driver.js";
import * as locator from "./locators.js";
import * as constants from "./constants.js";
import * as interfaces from "./interfaces.js";
import { E2EStatusBar } from "./E2EStatusBar.js";

/** This class represents the Notification center and all its related functions */
export class E2ENotificationsCenter {

    /** The Notifications Center*/
    public self: WebElement | undefined;

    /**
     * Opens the Notification Center
     * @returns A promise resolving with the notifications center
     */
    public open = async (): Promise<E2ENotificationsCenter | undefined> => {
        await (await new E2EStatusBar().getNotificationsHistory()).click();
        this.self = await driver.wait(until.elementLocated(locator.notificationsCenter.exists),
            constants.wait5seconds, "Notifications center was not opened");

        return this;
    };

    /**
     * Gets the Notification center title
     * @returns A promise resolving with the Notification center title
     */
    public getTitle = async (): Promise<string> => {
        const title = await this.self!.findElement(locator.notificationsCenter.title);

        return title.getText();
    };

    /**
     * Gets the Notifications center notifications
     * @returns A promise resolving with the notifications center's notifications
     */
    public getNotifications = async (): Promise<interfaces.INotification[]> => {
        const notifications = await this.self?.findElements(locator.notificationsCenter.notificationsList.item.exists);
        const iNotifications: interfaces.INotification[] = [];

        for (const notification of notifications!) {
            const type = await notification.findElement(locator.notificationsCenter.notificationsList.item.type);
            iNotifications.push({
                id: await notification.getAttribute("id"),
                type: (await type.getAttribute("class")).match(/codicon-(.*)/)![1],
                message: await (await notification
                    .findElement(locator.notificationsCenter.notificationsList.item.message)).getText(),
                webElement: notification,
            });
        }

        return iNotifications;
    };

    /**
     * Closes a notification by clicking on the "X" button of a notification
     * @param itemNumber The number of the notification
     * @returns A promise resolving when the "Close" button is clicked
     */
    public closeNotification = async (itemNumber: number): Promise<void> => {
        const notifications = await this.getNotifications();
        await notifications[itemNumber].webElement!
            .findElement(locator.notificationsCenter.notificationsList.item.close).click();
    };

    /**
     * Clears the Notifications center notifications
     * @returns A promise resolving when the "Clear All Notifications" button is clicked
     */
    public clearNotifications = async (): Promise<void> => {
        await this.self?.findElement(locator.notificationsCenter.clear).click();
    };

    /**
     * Clicks on the "Switch to Do Not Disturb Mode" button
     * @returns A promise resolving when the "Clear All Notifications" button is clicked
     */
    public toggleSilentMode = async (): Promise<void> => {
        await this.self?.findElement(locator.notificationsCenter.silentMode).click();
    };

    /**
     * Clicks on the "Hide Notifications" button
     * @returns A promise resolving when the "ide Notifications" button is clicked
     */
    public hide = async (): Promise<void> => {
        await this.self?.findElement(locator.notificationsCenter.close).click();
    };

    /**
     * Verifies if there are any notifications in the Notifications Center
     * @returns A condition resolving to true if there is at least one notification
     */
    public untilNotificationsExists = (): Condition<boolean> => {
        return new Condition("for notifications to exist", async () => {
            return (await this.getNotifications()).length > 0;
        });
    };

}
