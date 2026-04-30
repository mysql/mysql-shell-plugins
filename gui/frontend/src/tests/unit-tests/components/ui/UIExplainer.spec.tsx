/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import { act, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { createRef } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UIExplainer } from "../../../../components/ui/UIExplainer/UIExplainer.js";
import { KeyboardKeys } from "../../../../utilities/helpers.js";
import { nextRunLoop } from "../../test-helpers.js";

describe("UIExplainer component tests", (): void => {
    afterEach(() => {
        document.querySelectorAll(".msg.portal").forEach((portal) => {
            portal.remove();
        });
    });

    it("does not open for an unavailable step or target", () => {
        const explainerRef = createRef<UIExplainer>();
        const missingTarget = createRef<HTMLElement>();
        const { unmount } = render(
            <UIExplainer
                ref={explainerRef}
                steps={[{
                    id: "missing",
                    target: missingTarget,
                    content: "Missing target",
                }]}
            />,
        );

        expect(explainerRef.current?.start()).toBe(false);
        expect(explainerRef.current?.start(1)).toBe(false);
        expect(explainerRef.current?.isOpen).toBe(false);

        unmount();
    });

    it("opens ordered steps and supports the navigation buttons", async () => {
        const explainerRef = createRef<UIExplainer>();
        const firstTarget = createRef<HTMLElement>();
        const secondTarget = createRef<HTMLElement>();
        const onClose = vi.fn();
        const { unmount } = render(
            <>
                <button>Launch</button>
                <div ref={firstTarget}>First target</div>
                <div ref={secondTarget}>Second target</div>
                <UIExplainer
                    ref={explainerRef}
                    steps={[{
                        id: "first",
                        target: firstTarget,
                        title: "First title",
                        content: "First explanation",
                    }, {
                        id: "second",
                        target: secondTarget,
                        title: "Second title",
                        content: "Second explanation",
                    }]}
                    onClose={onClose}
                />
            </>,
        );
        const launchButton = screen.getByRole("button", { name: "Launch" });
        const firstScrollIntoView = vi.fn();
        launchButton.focus();
        firstTarget.current!.scrollIntoView = firstScrollIntoView;
        secondTarget.current!.scrollIntoView = vi.fn();

        await act(() => {
            expect(explainerRef.current?.start()).toBe(true);
        });
        await nextRunLoop();

        expect(document.activeElement).toBe(screen.getByRole("dialog"));
        expect(screen.getByText("First explanation")).toBeDefined();
        expect(screen.getByText("1 of 2")).toBeDefined();
        expect(screen.getByRole("button", { name: "Back" }).classList.contains("disabled")).toBe(true);
        expect(firstScrollIntoView).toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        await nextRunLoop();
        expect(screen.getByText("Second explanation")).toBeDefined();
        expect(screen.getByText("2 of 2")).toBeDefined();
        expect(screen.getByRole("button", { name: "Finish" })).toBeDefined();

        fireEvent.click(screen.getByRole("button", { name: "Back" }));
        await nextRunLoop();
        expect(screen.getByText("First explanation")).toBeDefined();

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        await nextRunLoop();
        expect(onClose).toHaveBeenCalledWith(false);
        expect(document.activeElement).toBe(launchButton);

        await act(() => {
            expect(explainerRef.current?.start(1)).toBe(true);
        });
        await nextRunLoop();
        expect(screen.getByText("Second explanation")).toBeDefined();
        expect(screen.getByText("2 of 2")).toBeDefined();
        explainerRef.current?.close();

        unmount();
    });

    it("traps focus without using Tab for step navigation and reports completion", async () => {
        const explainerRef = createRef<UIExplainer>();
        const firstTarget = createRef<HTMLElement>();
        const secondTarget = createRef<HTMLElement>();
        const onClose = vi.fn();
        const { unmount } = render(
            <>
                <div ref={firstTarget}>First target</div>
                <div ref={secondTarget}>Second target</div>
                <UIExplainer
                    ref={explainerRef}
                    steps={[{
                        id: "first",
                        target: firstTarget,
                        content: "First explanation",
                    }, {
                        id: "second",
                        target: secondTarget,
                        content: "Second explanation",
                    }]}
                    onClose={onClose}
                />
            </>,
        );
        firstTarget.current!.scrollIntoView = vi.fn();
        secondTarget.current!.scrollIntoView = vi.fn();

        await act(() => {
            explainerRef.current?.start();
        });
        await nextRunLoop();

        fireEvent.keyDown(document.activeElement!, { key: KeyboardKeys.Tab });
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
        expect(screen.getByText("First explanation")).toBeDefined();

        screen.getByRole("button", { name: "Next" }).focus();
        fireEvent.keyDown(document.activeElement!, { key: KeyboardKeys.Tab });
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
        expect(screen.getByText("First explanation")).toBeDefined();

        fireEvent.keyDown(document.activeElement!, { key: KeyboardKeys.Tab, shiftKey: true });
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next" }));

        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        await nextRunLoop();
        expect(screen.getByText("Second explanation")).toBeDefined();

        fireEvent.click(screen.getByRole("button", { name: "Finish" }));
        await nextRunLoop();
        expect(explainerRef.current?.isOpen).toBe(false);
        expect(onClose).toHaveBeenCalledWith(true);

        unmount();
    });

    it("keeps the modal open on backdrop clicks and updates its spotlight", async () => {
        const explainerRef = createRef<UIExplainer>();
        const targetRef = createRef<HTMLElement>();
        const onClose = vi.fn();
        let targetRect = new DOMRect(20, 30, 100, 50);
        const { unmount } = render(
            <>
                <div ref={targetRef}>Target</div>
                <UIExplainer
                    ref={explainerRef}
                    steps={[{
                        id: "spotlight",
                        target: targetRef,
                        content: "Spotlight explanation",
                    }]}
                    onClose={onClose}
                />
            </>,
        );
        targetRef.current!.scrollIntoView = vi.fn();
        targetRef.current!.getBoundingClientRect = vi.fn(() => {
            return targetRect;
        });

        await act(() => {
            explainerRef.current?.start();
        });
        await nextRunLoop();

        const portal = document.querySelector<HTMLElement>(".msg.portal");
        expect(portal).not.toBeNull();
        expect(portal?.classList.contains("spotlight")).toBe(true);
        expect(portal?.classList.contains("ignoreMouse")).toBe(false);
        expect(portal?.style.getPropertyValue("--spotlight-left")).toBe("14px");
        expect(portal?.style.getPropertyValue("--spotlight-top")).toBe("24px");
        expect(portal?.style.getPropertyValue("--spotlight-width")).toBe("112px");
        expect(portal?.style.getPropertyValue("--spotlight-height")).toBe("62px");

        fireEvent.mouseDown(portal!);
        expect(explainerRef.current?.isOpen).toBe(true);

        targetRect = new DOMRect(40, 50, 120, 60);
        fireEvent.scroll(window);
        await waitFor(() => {
            expect(portal?.style.getPropertyValue("--spotlight-left")).toBe("34px");
            expect(portal?.style.getPropertyValue("--spotlight-top")).toBe("44px");
        });

        fireEvent.keyDown(document.body, { key: KeyboardKeys.Escape });
        await nextRunLoop();
        expect(explainerRef.current?.isOpen).toBe(false);
        expect(onClose).toHaveBeenCalledWith(false);

        unmount();
    });
});
