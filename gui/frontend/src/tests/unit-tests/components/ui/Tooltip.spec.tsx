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
import { fireEvent, render, waitFor } from "@testing-library/preact";
import { Label } from "../../../../components/ui/Label/Label.js";
import { TooltipProvider } from "../../../../components/ui/Tooltip/Tooltip.js";
import { KeyboardKeys } from "../../../../utilities/helpers.js";
import { loremIpsum, nextProcessTick, sendKeyPress } from "../../test-helpers.js";
import * as helpers from "../../../../components/ui/html-helpers.js";

// We have to do this here instead of within the test itself
// because all named imports are already resolved and spy won't function correctly otherwise
jest.mock("../../../../components/ui/html-helpers.js", (): unknown => {
    return {
      __esModule: true, // this is important
      ...jest.requireActual("../../../../components/ui/html-helpers.js"),
    };
  });

describe("Tooltip component tests", (): void => {
    const delay = 200;
    const queryTooltipElement = () => {
        return document.querySelector(".msg.tooltip");
    };

    it("Tooltip from data attribute", async () => {
        const text = "hover me";
        const tooltip = "tooltip";

        const rendered = render(
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
        expect(rendered.queryByText(tooltip)).toBeNull();

        // Getting target element for the tooltip
        const element = rendered.queryByText(text);
        expect(element).not.toBe(null);

        // Hovering target element
        fireEvent.mouseOver(element as Element);

        // Wait for ${delay} and then check if the tooltip appears
        await waitFor(() => {

            expect(rendered.queryByText(tooltip)).toBeInTheDocument();
            expect(queryTooltipElement()).toBeInTheDocument();

            // Basically the same as mouse leave from target
            fireEvent.mouseOver(document.getElementById("other") as Element);

            // Now it has to disappear
            expect(rendered.queryByText(tooltip)).toBeNull();
            expect(queryTooltipElement()).toBeNull();

        }, { timeout: delay });

        rendered.unmount();
    });

    it("Tooltip from JSON", async () => {
        const json = {key: "value"};
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

        const rendered = render(component);

        expect(queryTooltipElement()).toBeNull();
        expect(rendered.queryByText(tooltip)).toBeNull();

        const element = rendered.getByTestId(testId);
        expect(element).not.toBe(null);

        fireEvent.mouseOver(element as Element);

        await waitFor(() => {

            expect(rendered.queryByText(tooltip)).toBeInTheDocument();
            expect(queryTooltipElement()).toBeInTheDocument();

            fireEvent.mouseOver(document.getElementById("other") as Element);

            expect(rendered.queryByText(tooltip)).toBeNull();
            expect(queryTooltipElement()).toBeNull();

        }, { timeout: delay });

        rendered.unmount();
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

        const rendered = render(component);

        expect(queryTooltipElement()).toBeNull();
        expect(rendered.queryByText(tooltip)).toBeNull();

        const element = rendered.queryByText(text);
        expect(element).not.toBe(null);

        fireEvent.mouseOver(element as Element);

        await waitFor(async () => {

            expect(rendered.queryByText(tooltip)).toBeInTheDocument();
            expect(queryTooltipElement()).toBeInTheDocument();

            sendKeyPress(KeyboardKeys.Escape);
            await nextProcessTick();

            expect(rendered.queryByText(tooltip)).toBeNull();
            expect(queryTooltipElement()).toBeNull();

        }, { timeout: delay });

        rendered.unmount();
    });

    it("Tooltip from (expanded) target text", async () => {
        jest.spyOn(helpers, "isElementClipped").mockImplementation(
            () => {
                return true;
            },
        );

        const text = loremIpsum;
        const testId = "expandable";

        const rendered = render(
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

        const element = rendered.getByTestId(testId);
        expect(element).not.toBe(null);

        fireEvent.mouseOver(element as Element);

        await waitFor(() => {
            expect(queryTooltipElement()).toBeInTheDocument();

            fireEvent.mouseOver(document.getElementById("other") as Element);

            expect(queryTooltipElement()).toBeNull();

        }, { timeout: delay });

        rendered.unmount();
    });
});
