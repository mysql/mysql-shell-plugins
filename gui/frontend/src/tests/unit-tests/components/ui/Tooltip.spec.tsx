/*
 * Copyright (c) 2024, 2026, Oracle and/or its affiliates.
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

import { fireEvent, render, waitFor } from "@testing-library/preact";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { cwd } from "node:process";
import { describe, expect, it, vi } from "vitest";

import { Label } from "../../../../components/ui/Label/Label.js";
import { popupOpenedEvent } from "../../../../components/ui/Popup/Popup.js";
import { TooltipProvider } from "../../../../components/ui/Tooltip/Tooltip.js";
import * as helpers from "../../../../components/ui/html-helpers.js";
import { KeyboardKeys } from "../../../../utilities/helpers.js";
import { loremIpsum, nextProcessTick, sendKeyPress } from "../../test-helpers.js";

const readFrontendSourceFile = (path: string): string => {
    let directory = cwd();

    for (let i = 0; i < 8; i++) {
        const candidate = join(directory, path);
        if (existsSync(candidate)) {
            return readFileSync(candidate, "utf-8");
        }

        directory = dirname(directory);
    }

    throw new Error(`Unable to find ${path}`);
};

describe("Tooltip component tests", (): void => {
    const delay = 200;
    const queryTooltipElement = () => {
        return document.querySelector(".msg.tooltip");
    };

    it("preserves whitespace in normal tooltips", () => {
        const tooltipCss = readFrontendSourceFile("src/components/ui/Tooltip/Tooltip.css");
        const rule = /\.msg\.tooltip:not\(\.expand\)\s*{(?<body>[^}]*)}/s.exec(tooltipCss)?.groups?.body;

        expect(rule).toContain("white-space: pre-wrap;");

        const boundsRule = /\.msg\.tooltip\s*{(?<body>[^}]*)}/s.exec(tooltipCss)?.groups?.body;
        expect(boundsRule).toContain("max-width: min(800px, 100vw);");
        expect(boundsRule).toContain("max-height: min(500px, 100vh);");
    });

    it("clamps normal tooltips to the viewport", async () => {
        const clampToDocument = vi.spyOn(helpers, "clampToDocument").mockReturnValue([10, 20]);
        const { unmount, queryByText } = render(
            <div>
                <Label data-tooltip="tooltip">hover me</Label>
                <TooltipProvider showDelay={0} />
            </div>,
        );

        try {
            fireEvent.mouseOver(queryByText("hover me") as Element);

            await waitFor(() => {
                const tooltip = queryTooltipElement() as HTMLElement;
                expect(tooltip).toBeDefined();
                expect(tooltip.style.transform).toBe("translate(10px, 20px)");
            });

            expect(clampToDocument).toHaveBeenCalledWith(
                expect.objectContaining({ width: 0, height: 0 }),
                0,
                0,
            );
        } finally {
            clampToDocument.mockRestore();
            unmount();
        }
    });

    it("clamps tooltip coordinates independently of the monitor origin", () => {
        const innerWidth = vi.spyOn(window, "innerWidth", "get").mockReturnValue(1920);
        const innerHeight = vi.spyOn(window, "innerHeight", "get").mockReturnValue(1080);
        const screenX = vi.spyOn(window, "screenX", "get").mockReturnValue(1920);
        const availableWidth = vi.spyOn(window.screen, "availWidth", "get").mockReturnValue(1920);
        const availableHeight = vi.spyOn(window.screen, "availHeight", "get").mockReturnValue(1080);

        try {
            expect(helpers.clampToDocument(new DOMRect(1800, 100, 200, 100), 0, 0)).toEqual([1720, 100]);
        } finally {
            innerWidth.mockRestore();
            innerHeight.mockRestore();
            screenX.mockRestore();
            availableWidth.mockRestore();
            availableHeight.mockRestore();
        }
    });

    it("Tooltip from data attribute", async () => {
        const text = "hover me";
        const tooltip = "tooltip";

        const { unmount, queryByText } = render(
            <div>
                <div id="other" />
                <Label data-tooltip={tooltip}>
                    {text}
                </Label>
                <TooltipProvider showDelay={delay} />
            </div>,
        );

        // Tooltip should not be visible initially
        expect(queryTooltipElement()).toBeNull();
        expect(queryByText(tooltip)).toBeNull();

        // Getting target element for the tooltip
        const element = queryByText(text);
        expect(element).not.toBe(null);

        // Hovering target element
        fireEvent.mouseOver(element as Element);

        // Wait for ${delay} and then check if the tooltip appears
        await waitFor(() => {
            expect(queryByText(tooltip)).toBeDefined();
            expect(queryTooltipElement()).toBeDefined();

            // Basically the same as mouse leave from target
            fireEvent.mouseOver(document.getElementById("other") as Element);

            // Now it has to disappear
            expect(queryByText(tooltip)).toBeNull();
            expect(queryTooltipElement()).toBeNull();

        }, { timeout: delay });

        unmount();
    });

    it("Tooltip from JSON", async () => {
        const json = { key: "value" };
        const tooltip = "tooltip";
        const testId = "expandable";

        const component = (
            <div>
                <div id="other" />
                <div
                    data-tooltip={tooltip}
                    data-tooltip-lang="json"
                    data-testid={testId}
                >
                    {json}
                </div>
                <TooltipProvider showDelay={delay} />
            </div>
        );

        const { unmount, queryByText, getByTestId } = render(component);

        expect(queryTooltipElement()).toBeNull();
        expect(queryByText(tooltip)).toBeNull();

        const element = getByTestId(testId);
        expect(element).not.toBe(null);

        fireEvent.mouseOver(element as Element);

        await waitFor(() => {
            expect(queryByText(tooltip)).toBeDefined();
            expect(queryTooltipElement()).toBeDefined();

            fireEvent.mouseOver(document.getElementById("other") as Element);

            expect(queryByText(tooltip)).toBeNull();
            expect(queryTooltipElement()).toBeNull();

        }, { timeout: delay });

        unmount();
    });

    it("Tooltip disappears on escape", async () => {
        const text = "hover me";
        const tooltip = "tooltip";

        const component = (
            <div>
                <Label data-tooltip={tooltip}>
                    {text}
                </Label>
                <TooltipProvider showDelay={delay} />
            </div>
        );

        const { unmount, queryByText } = render(component);

        expect(queryTooltipElement()).toBeNull();
        expect(queryByText(tooltip)).toBeNull();

        const element = queryByText(text);
        expect(element).not.toBe(null);

        fireEvent.mouseOver(element as Element);

        await waitFor(async () => {

            expect(queryByText(tooltip)).toBeDefined();
            expect(queryTooltipElement()).toBeDefined();

            sendKeyPress(KeyboardKeys.Escape);
            await nextProcessTick();

            expect(queryByText(tooltip)).toBeNull();
            expect(queryTooltipElement()).toBeNull();

        }, { timeout: delay });

        unmount();
    });

    it("Tooltip disappears when a popup opens", async () => {
        const text = "hover me";
        const tooltip = "tooltip";

        const { unmount, queryByText } = render(
            <div>
                <Label data-tooltip={tooltip}>{text}</Label>
                <TooltipProvider showDelay={delay} />
            </div>,
        );

        const element = queryByText(text);
        expect(element).not.toBe(null);
        fireEvent.mouseOver(element as Element);

        await waitFor(() => {
            expect(queryByText(tooltip)).toBeDefined();
        }, { timeout: delay });

        document.dispatchEvent(new Event(popupOpenedEvent));

        expect(queryByText(tooltip)).toBeNull();
        expect(queryTooltipElement()).toBeNull();

        unmount();
    });

    it("Tooltip from (expanded) target text", async () => {
        vi.spyOn(helpers, "isElementClipped").mockImplementation(
            () => {
                return true;
            },
        );

        const text = loremIpsum;
        const testId = "expandable";

        const { unmount, getByTestId } = render(
            <div>
                <div id="other" />
                <div
                    data-tooltip="expand"
                    data-testid={testId}
                >
                    {text}
                </div>
                <TooltipProvider maxLength={16} showDelay={delay} />
            </div>,
        );

        expect(queryTooltipElement()).toBeNull();

        const element = getByTestId(testId);
        expect(element).not.toBe(null);

        fireEvent.mouseOver(element);

        await waitFor(() => {
            expect(queryTooltipElement()).toBeDefined();

            fireEvent.mouseOver(document.getElementById("other") as Element);

            expect(queryTooltipElement()).toBeNull();

        }, { timeout: delay });

        unmount();
    });
});
