/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import { ISelectOption } from "../../../../app-logic/MigrationSubApp/FormGroup.js";
import { Compartment, convertCompartments } from "../../../../app-logic/MigrationSubApp/helpers.js";

describe("Migration Assistant Helpers Tests", (): void => {
    const compartments: Compartment[] = [
        { id: "1", name: "Parent 1", compartmentId: "" },
        { id: "11", name: "Child 1 under Parent 1", compartmentId: "1" },
        { id: "111", name: "SubChild 1 under Child 1", compartmentId: "11" },

        { id: "12", name: "Child 2 under Parent 1", compartmentId: "1" },
        { id: "121", name: "SubChild 1 under Child 2", compartmentId: "12" },
    ];

    describe("convertCompartments", () => {
        it("test tree", (): void => {
            const expected: ISelectOption[] = [
                { id: "1", label: "Parent 1" },
                { id: "11", label: "—Child 1 under Parent 1" },
                { id: "111", label: "——SubChild 1 under Child 1" },

                { id: "12", label: "—Child 2 under Parent 1" },
                { id: "121", label: "——SubChild 1 under Child 2" },
            ];

            const result = convertCompartments(compartments);
            expect(result).toEqual(expected);
        });

        describe("With child", () => {
            it("test under root", (): void => {
                const expected: ISelectOption[] = [
                    { id: "1", label: "Parent 1" },
                    { id: "", label: "—MySQL (create new)" },
                    { id: "11", label: "—Child 1 under Parent 1" },
                    { id: "111", label: "——SubChild 1 under Child 1" },

                    { id: "12", label: "—Child 2 under Parent 1" },
                    { id: "121", label: "——SubChild 1 under Child 2" },
                ];

                const child: Compartment = { id: "", name: "MySQL (create new)", compartmentId: "1" };
                const allCompartments = [child, ...compartments];
                const result = convertCompartments(allCompartments);
                expect(result).toEqual(expected);
            });

            it("test with id and under sub child", (): void => {
                const expected: ISelectOption[] = [
                    { id: "1", label: "Parent 1" },
                    { id: "11", label: "—Child 1 under Parent 1" },
                    { id: "111", label: "——SubChild 1 under Child 1" },
                    { id: "1111", label: "———MySQL (create new)" },

                    { id: "12", label: "—Child 2 under Parent 1" },
                    { id: "121", label: "——SubChild 1 under Child 2" },
                ];

                const child: Compartment = { id: "1111", name: "MySQL (create new)", compartmentId: "111" };
                const allCompartments = [child, ...compartments];
                const result = convertCompartments(allCompartments);
                expect(result).toEqual(expected);
            });
        });
    });
});
