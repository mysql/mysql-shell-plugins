/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/preact";

import { MessageType } from "../../../../../app-logic/general-types.js";
import { ActionOutput } from "../../../../../components/ResultView/ActionOutput.js";
import { nextRunLoop } from "../../../test-helpers.js";

describe("Action Output Tests", (): void => {
    it("Standard Rendering", () => {
        const { container, unmount } = render(
            <ActionOutput
                output={[]}
                showIndexes={false}
                contextId="ec123"
            />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Action Full Rendering", async () => {
        const { container, unmount, rerender } = render(
            <ActionOutput
                id="actionOutput1"
                output={
                    [{
                        type: MessageType.Error,
                        content: "Lorem ipsum dolor sit amet",
                    }]
                }
                contextId="ec123"
                showIndexes={true}
            />,
        );

        expect(container).toMatchSnapshot();

        rerender(
            <ActionOutput
                id="actionOutput1"
                output={
                    [{
                        type: MessageType.Response,
                        content: "A simple response",
                    }]
                }
                contextId="ec123"
                showIndexes={true}
            />,
        );

        await nextRunLoop();

        const output = container.getElementsByClassName("msg");
        expect(output).toHaveLength(4);
        expect(output).toMatchSnapshot();

        unmount();
    });

});
