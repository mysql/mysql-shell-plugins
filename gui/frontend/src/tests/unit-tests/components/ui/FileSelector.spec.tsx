/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { FileSelector } from "../../../../components/ui/FileSelector/FileSelector.js";

describe("FileSelector", (): void => {
    afterEach(cleanup);

    it("keeps the picker active while manual entry is read-only", () => {
        render(<FileSelector id="backupHome" path="/backups" readOnly />);

        expect(screen.getByRole("textbox")).toHaveProperty("readOnly", true);
        expect(screen.getByRole("button").classList.contains("disabled")).toBe(false);
    });

    it("disables both the input and picker", () => {
        render(<FileSelector id="backupHome" path="/backups" disabled />);

        expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
        expect(screen.getByRole("button").classList.contains("disabled")).toBe(true);
    });
});
