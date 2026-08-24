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

import { fireEvent, render } from "@testing-library/preact";
import { createRef } from "preact";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "../../../../components/ui/Dialog/Dialog.js";
import { nextRunLoop } from "../../test-helpers.js";

describe("Dialog component tests", (): void => {
    it("allows programmatic closure while disabled", async () => {
        const ref = createRef<Dialog>();
        const onClose = vi.fn();
        const view = render(<Dialog ref={ref} caption="Configuration" disabled onClose={onClose} />);
        ref.current?.open();
        await nextRunLoop();

        ref.current?.close(false);
        await nextRunLoop();

        expect(onClose).toHaveBeenCalledWith(false, expect.anything());
        expect(document.querySelector("#closeButton")).toBeNull();

        view.unmount();
    });

    it("cannot be dismissed while disabled", async () => {
        const ref = createRef<Dialog>();
        const onClose = vi.fn();
        const view = render(<Dialog ref={ref} caption="Configuration" disabled onClose={onClose} />);
        ref.current?.open();
        await nextRunLoop();

        fireEvent.keyDown(document.body, { key: "Escape" });
        expect(onClose).not.toHaveBeenCalled();

        const closeButton = document.querySelector<HTMLDivElement>("#closeButton");
        expect(closeButton?.classList.contains("disabled")).toBe(true);
        fireEvent.click(closeButton!);
        expect(onClose).not.toHaveBeenCalled();

        view.rerender(<Dialog ref={ref} caption="Configuration" disabled={false} onClose={onClose} />);
        await nextRunLoop();
        fireEvent.keyDown(document.body, { key: "Escape" });
        expect(onClose).toHaveBeenCalledWith(true, expect.anything());

        view.unmount();
    });

    it("preserves disabled Escape preference after becoming enabled", async () => {
        const ref = createRef<Dialog>();
        const onClose = vi.fn();
        const view = render(<Dialog ref={ref} caption="Configuration" disabled onClose={onClose} />);
        ref.current?.open({ closeOnEscape: false });
        await nextRunLoop();

        view.rerender(<Dialog ref={ref} caption="Configuration" disabled={false} onClose={onClose} />);
        await nextRunLoop();
        fireEvent.keyDown(document.body, { key: "Escape" });

        expect(onClose).not.toHaveBeenCalled();
        expect(document.querySelector("#closeButton")).not.toBeNull();

        ref.current?.close(false);
        view.unmount();
    });
});
