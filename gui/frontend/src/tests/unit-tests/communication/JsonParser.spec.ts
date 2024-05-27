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

import { readFileSync, readdirSync } from "fs";

import { JsonParser } from "../../../communication/JsonParser.js";

describe("JsonParser", () => {
    it("Bigint Support", () => {
        const json = readFileSync("./data/json/LakehouseStatus.json", { encoding: "utf-8" });

        const status = JsonParser.parseJson(json) as IDictionary;
        const result = status.result as IDictionary;
        const tableStatus = result.table_status as IDictionary;
        expect(tableStatus.hash).toBe(4764664537187834027n);
    });

    it("Valid JSON", () => {
        const fileList = readdirSync("./data/json/accept/");
        fileList.forEach((file) => {
            const json = readFileSync(`./data/json/accept/${file}`, { encoding: "utf-8" });

            expect(() => { JsonParser.parseJson(json); }).not.toThrow();
        });
    });

    xit("Invalid JSON", () => { // Not all invalid cases are covered. Need to investigate further.
        const fileList = readdirSync("./data/json/reject/");
        fileList.forEach((file) => {
            const json = readFileSync(`./data/json/reject/${file}`, { encoding: "utf-8" });

            expect(() => { JsonParser.parseJson(json); }).toThrow();
        });
    });
});
