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
 * separately licensed software that they have either included with
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

import "@testing-library/jest-dom";
import { mount } from "enzyme";

import { fireEvent } from "@testing-library/preact";
import {
    NotificationCenter, NotificationType,
} from "../../../../components/ui/NotificationCenter/NotificationCenter.js";

describe("NotificationCenter component tests", () => {
    it("Standard rendering (snapshot)", () => {
        const notificationCenter = mount<NotificationCenter>(
            <NotificationCenter />,
        );
        expect(notificationCenter).toMatchSnapshot();

        notificationCenter.unmount();
    });

    it("Information messages", async () => {
        const notificationCenter = mount<NotificationCenter>(
            <NotificationCenter />,
        );

        const slices = notificationCenter.find(".toast");
        expect(slices).toHaveLength(0);

        const promise1 = notificationCenter.instance().showNotification({
            text: "Information message",
            type: NotificationType.Information,
            timeout: 2000,
        });

        // Can only test with history on here, because the main list animates toasts in and out and waits for the
        // animation to finish.
        notificationCenter.instance().toggleHistory();
        notificationCenter.update();
        let toasts = notificationCenter.find(".toast").hostNodes();
        expect(toasts).toHaveLength(1);

        toasts = notificationCenter.find(".info").hostNodes();
        expect(toasts).toHaveLength(1);

        const promise2 = notificationCenter.instance().showNotification({
            text: "Choice",
            type: NotificationType.Information,
            items: ["Yes", "No"],
        });

        notificationCenter.update();

        // There are two toasts (one in the main list and one in the history).
        const buttons = notificationCenter.find(".itemButton").hostNodes();
        expect(buttons).toHaveLength(2);
        expect(buttons.at(0).text()).toEqual("Yes");
        expect(buttons.at(1).text()).toEqual("No");

        setTimeout(() => {
            const buttons = notificationCenter.find(".itemButton");
            expect(buttons).toHaveLength(4);
            const yes = buttons.at(0);
            expect(yes.text()).toEqual("Yes");
            const element = yes.getDOMNode();
            fireEvent.click(element);
        }, 250);

        const result = await Promise.all([promise1, promise2]);
        expect(result[0]).toBeUndefined();
        expect(result[1]).toEqual("Yes");
        notificationCenter.update();

        toasts = notificationCenter.find(".toast").hostNodes();
        expect(toasts).toHaveLength(0);

        notificationCenter.unmount();
    });

    it("Clear history", async () => {
        const notificationCenter = mount<NotificationCenter>(
            <NotificationCenter />,
        );

        const slices = notificationCenter.find(".toast");
        expect(slices).toHaveLength(0);

        const promise1 = notificationCenter.instance().showNotification({
            text: "Error message",
            type: NotificationType.Error,
            timeout: 2000,
        });

        // Can only test with history on here, because the main list animates toasts in and out and waits for the
        // animation to finish.
        notificationCenter.instance().toggleHistory();
        notificationCenter.update();
        let toasts = notificationCenter.find(".toast").hostNodes();
        expect(toasts).toHaveLength(1);

        toasts = notificationCenter.find(".error").hostNodes();
        expect(toasts).toHaveLength(1);

        const promise2 = notificationCenter.instance().showNotification({
            text: "Warning message",
            type: NotificationType.Warning,
        });

        notificationCenter.update();

        toasts = notificationCenter.find(".warning").hostNodes();
        expect(toasts).toHaveLength(1);

        // There are two toasts (one in the main list and one in the history).
        const buttons = notificationCenter.find(".itemButton").hostNodes();
        expect(buttons).toHaveLength(0);

        setTimeout(() => {
            const buttons = notificationCenter.find(".itemButton");
            expect(buttons).toHaveLength(0);
            fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
            notificationCenter.update();

            expect(notificationCenter.state().showHistory).toBe(false);

            // Fire escape again. This should close the waring toast.
            fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
            notificationCenter.update();

            // And again for the error toast.
            fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
            notificationCenter.update();

            // The toasts are still on screen, as they expect to be removed by the animation.
            // We have to simulate the end of the animation here.
            toasts = notificationCenter.find(".toast").hostNodes();
            expect(toasts).toHaveLength(2);
            toasts.forEach((toast) => {
                const event = new Event("transitionend", {
                    bubbles: true,
                    cancelable: false,
                });

                toast.getDOMNode().dispatchEvent(event);
            });

            // At this point the toasts should be removed, but they are still in the history.
            // Do the final step to remove the toasts from the history, by clearing it,
            // which in turn will resolve the promises the code below is waiting for.
            notificationCenter.instance().clearHistory();
            notificationCenter.update();
        }, 250);

        const result = await Promise.all([promise1, promise2]);
        expect(result[0]).toBeUndefined();
        expect(result[1]).toBeUndefined();

        toasts = notificationCenter.find(".toast").hostNodes();
        expect(toasts).toHaveLength(0);

        notificationCenter.unmount();
    });
});
