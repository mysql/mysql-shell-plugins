/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import { act, fireEvent, render, waitFor } from "@testing-library/preact";
import { describe, expect, it } from "vitest";

import {
    NotificationCenter, NotificationType,
} from "../../../../components/ui/NotificationCenter/NotificationCenter.js";
import { createRef } from "preact";
import { nextRunLoop } from "../../test-helpers.js";

describe("NotificationCenter component tests", () => {
    it("Standard rendering (snapshot)", () => {
        const { container, unmount } = render(
            <NotificationCenter />,
        );
        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Information messages", async () => {
        const centerRef = createRef<NotificationCenter>();
        const { container, unmount } = render(
            <NotificationCenter ref={centerRef} />,
        );

        await nextRunLoop();
        expect(centerRef.current).toBeDefined();

        const slices = container.querySelectorAll(".toast");
        expect(slices).toHaveLength(0);

        const promise1 = centerRef.current!.showNotification({
            text: "Information message",
            type: NotificationType.Information,
            timeout: 2000,
        });

        // Can only test with history on here, because the main list animates toasts in and out and waits for the
        // animation to finish.
        centerRef.current!.toggleHistory();

        await nextRunLoop();

        let toasts = container.querySelectorAll(".toast");
        expect(toasts).toHaveLength(1);

        toasts = container.querySelectorAll(".info");
        expect(toasts).toHaveLength(1);

        const promise2 = centerRef.current!.showNotification({
            text: "Choice",
            type: NotificationType.Information,
            items: ["Yes", "No"],
        });

        await nextRunLoop();

        // There are two toasts (one in the main list and one in the history).
        const buttons = container.querySelectorAll(".itemButton");
        expect(buttons).toHaveLength(2);
        expect(buttons[0].innerHTML).toEqual("Yes");
        expect(buttons[1].innerHTML).toEqual("No");

        await act(() => {
            const buttons = container.querySelectorAll(".itemButton");
            expect(buttons).toHaveLength(2);
            const yes = buttons[0];
            expect(yes.innerHTML).toEqual("Yes");
            fireEvent.click(yes);
        });

        const result = await Promise.all([promise1, promise2]);
        expect(result[0]).toBeUndefined();
        expect(result[1]).toEqual("Yes");

        toasts = container.querySelectorAll(".toast");
        expect(toasts).toHaveLength(0);

        unmount();
    });

    it("Clear history", async () => {
        const centerRef = createRef<NotificationCenter>();
        const { container, unmount } = render(
            <NotificationCenter ref={centerRef} />,
        );

        await nextRunLoop();
        expect(centerRef.current).toBeDefined();

        const slices = container.querySelectorAll(".toast");
        expect(slices).toHaveLength(0);

        const promise1 = centerRef.current!.showNotification({
            text: "Error message",
            type: NotificationType.Error,
            timeout: 2000,
        });

        // Can only test with history on here, because the main list animates toasts in and out and waits for the
        // animation to finish.
        centerRef.current!.toggleHistory();

        await nextRunLoop();

        let toasts = container.querySelectorAll(".toast");
        expect(toasts).toHaveLength(1);

        toasts = container.querySelectorAll(".error");
        expect(toasts).toHaveLength(1);

        const promise2 = centerRef.current!.showNotification({
            text: "Warning message",
            type: NotificationType.Warning,
        });

        await nextRunLoop();

        toasts = container.querySelectorAll(".warning");
        expect(toasts).toHaveLength(1);

        // There are two toasts (one in the main list and one in the history).
        const buttons = container.querySelectorAll(".itemButton");
        expect(buttons).toHaveLength(0);

        await act(() => {
            fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
        });

        await waitFor(() => {
            expect(centerRef.current!.state.showHistory).toBe(false);
        });

        await act(async () => {
            // Fire escape again. This should close the waring toast.
            fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
            await nextRunLoop();

            // And again for the error toast.
            fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
            await nextRunLoop();
        });

        // The toasts are still on screen, as they expect to be removed by the animation.
        // We have to simulate the end of the animation here.
        toasts = container.querySelectorAll(".toast");
        expect(toasts).toHaveLength(2);

        toasts.forEach((toast) => {
            const event = new Event("transitionend", {
                bubbles: true,
                cancelable: false,
            });

            toast.dispatchEvent(event);
        });

        // At this point the toasts should be removed, but they are still in the history.
        // Do the final step to remove the toasts from the history, by clearing it,
        // which in turn will resolve the promises the code below is waiting for.
        centerRef.current!.clearHistory();
        await nextRunLoop();

        const result = await Promise.all([promise1, promise2]);
        expect(result[0]).toBeUndefined();
        expect(result[1]).toBeUndefined();

        toasts = container.querySelectorAll(".toast");
        expect(toasts).toHaveLength(0);

        unmount();
    });
});
