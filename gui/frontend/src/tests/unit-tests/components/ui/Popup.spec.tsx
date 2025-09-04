/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import { render } from "@testing-library/preact";
import { createRef } from "preact";
import { describe, expect, it, vi } from "vitest";

import { Popup } from "../../../../components/ui/Popup/Popup.js";
import { nextRunLoop } from "../../test-helpers.js";

describe("Popup component tests", (): void => {
    it("Test Popup callbacks", async () => {
        const onClose = vi.fn();
        const onOpen = vi.fn();

        const popupRef = createRef<Popup>();
        const { unmount } = render(
            <Popup
                showArrow={false}
                pinned={false}
                onClose={onClose}
                onOpen={onOpen}
                ref={popupRef}
            >
                Test content
            </Popup>,
        );

        await nextRunLoop();
        expect(popupRef.current).toBeDefined();

        popupRef.current!.open(new DOMRect(0, 0, 100, 100), { backgroundOpacity: 0 });

        // The open and close calls call their associated callbacks asynchronously (in multiple steps), so we have
        // delay the spy check a bit.
        await nextRunLoop();

        expect(onOpen).toHaveBeenCalled();

        popupRef.current?.close(false);
        expect(onClose).toHaveBeenCalled();

        unmount();
    });

    it("Test Popup output (Snapshot)", () => {
        const { container, unmount } = render(
            <Popup
                showArrow={false}
                pinned={false}
                onClose={vi.fn()}
                onOpen={vi.fn()}
            >
                Test content
            </Popup>,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });
});
