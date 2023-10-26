/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { Cookies } from "../../../../supplement/Storage/Cookies.js";

describe("Cookies Tests", () => {
    const cookies = new Cookies();
    it("Manipulations", () => {
        cookies.clear();

        cookies.set("abc");
        expect(cookies.get("abc")).toBe("");

        cookies.set("abc=def");
        expect(cookies.get("abc")).toBe("def");

        cookies.set("Lorem", "Ipsum");
        expect(cookies.get("Lorem")).toBe("Ipsum");

        expect(cookies.get("xyz")).toBeNull();

        cookies.remove("Lorem");
        expect(cookies.get("Lorem")).toBeNull();

        cookies.set("xyz", "123");
        expect(cookies.get("xyz")).toBe("123");

        cookies.clear();
        expect(cookies.get("abc")).toBeNull();
        expect(cookies.get("xyz")).toBeNull();

        document.cookie = "mike";
        expect(cookies.get("mike")).toBe("mike");
    });
});
