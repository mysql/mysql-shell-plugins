/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms,
 * as designated in a particular file or component or in included license
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

import { classNames } from "../../../utilities/css-helpers.js";

describe("CSS Helpers Tests", () => {
    it("Extracts class names from strings and numbers", () => {
        expect(classNames("msg", "section", 1)).toBe("msg section 1");
    });

    it("Ignores falsy values", () => {
        expect(classNames("content", undefined, null, false, "", 0, "dimmed")).toBe("content dimmed");
    });

    it("Extracts class names from nested arrays", () => {
        expect(classNames(["msg", ["section", undefined, ["expanded"]]])).toBe("msg section expanded");
    });

    it("Extracts enabled class names from object maps", () => {
        expect(classNames({
            active: true,
            disabled: false,
            selected: 1,
            hidden: 0,
        })).toBe("active selected");
    });

    it("Combines mixed class name values", () => {
        expect(classNames(
            "msg",
            ["section", undefined],
            {
                expanded: true,
                dimmed: false,
            },
            "large",
        )).toBe("msg section expanded large");
    });
});
