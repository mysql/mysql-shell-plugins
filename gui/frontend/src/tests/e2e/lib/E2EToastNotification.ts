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

import { WebElement, until, Condition, error } from "selenium-webdriver";
import { driver } from "./driver.js";
import * as locator from "./locators.js";
import * as constants from "./constants.js";
import * as interfaces from "./interfaces.js";

/** This class represents a Toast Notification and all its related functions */
export class E2EToastNotification implements interfaces.INotification {

    /** The notification id*/
    public id = "";

    /** The notification type*/
    public type = "";

    /** The notification message*/
    public message = "";

    /** The notification*/
    public webElement: WebElement | undefined;

    /**
     * Creates a notification after finding it on the page
     * @param id The notification id
     * @param timeout The time to wait for a notification to be displayed, default is 5 seconds
     * @returns The notification
     */
    public create = async (id?: string, timeout = constants.wait3seconds):
        Promise<E2EToastNotification | undefined> => {

        let notification: WebElement | undefined;

        await driver.wait(async () => {
            try {
                if (id) {
                    notification = await driver.findElement(locator.toastNotification.existsById(id));
                } else {
                    notification = await driver.wait(until.elementLocated(locator.toastNotification.exists), timeout,
                        "Could not find any notification");
                }

                this.id = await notification.getAttribute("id");
                this.webElement = notification;

                if ((await this.webElement.findElements(locator.toastNotification.error)).length > 0) {
                    this.type = "error";
                } else if ((await this.webElement.findElements(locator.toastNotification.info)).length > 0) {
                    this.type = "info";
                } else {
                    throw new Error("Could not find the notification type");
                }

                await driver.wait(async () => {
                    const msg = await (await notification!.findElement(locator.toastNotification.message)).getText();

                    if (msg !== "") {
                        this.message = msg;

                        return true;
                    }
                }, constants.wait2seconds, "The notification message is empty");

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Could not create the notification");

        return this;
    };

    /**
     * Closes the notification
     * @returns The notification message as string
     */
    public close = async (): Promise<void> => {
        const notificationMessage = this.message;
        await driver.wait(async () => {
            try {
                const closeButton = await this.webElement!.findElement(locator.toastNotification.close);
                await closeButton.click();

                return (await driver.findElements(locator.toastNotification.existsById(this.id))).length === 0;
            } catch (e) {
                if (e instanceof error.StaleElementReferenceError || e instanceof error.ElementNotInteractableError) {
                    return true;
                } else {
                    throw e;
                }
            }
        }, constants.wait2seconds, `Could not close notification '${notificationMessage}'`);
    };

    /**
     * Verifies if the notification was closed/does not exist
     * @param timeout The time to wait for a notification to be closed, default is 5 seconds
     * @returns A condition resolving to true when the notification is closed
     */
    public untilIsClosed = (timeout = constants.wait5seconds): Condition<boolean> => {
        return new Condition("for notification to be closed", async () => {
            return driver.wait(until.stalenessOf(this.webElement!), timeout, "Notification was not closed")
                .then(() => {
                    return true;
                }).catch(() => {
                    return false;
                });
        });
    };

}
