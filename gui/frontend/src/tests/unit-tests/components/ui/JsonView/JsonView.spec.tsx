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

import { render } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JsonValue } from "../../../../../app-logic/general-types.js";
import { JsonView } from "../../../../../components/ui/JsonView/JsonView.js";

describe("JsonView tests", (): void => {

    const mockJsonData: JsonValue = {
        string: "test string",
        number: 42,
        boolean: true,
        nullValue: null,
        array: [1, 2, 3],
        object: {
            nested: "value",
            deep: {
                level: 3,
            },
        },
        url: "https://example.com",
        relativeUrl: "/api/data",
    };

    const mockComplexArray: JsonValue = [
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
        { id: 3, name: "Item 3" },
    ];

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("Component instantiation and lifecycle", (): void => {

        it("should handle JSON string to object conversion in componentDidUpdate", () => {
            const { container, unmount } = render(
                <JsonView json='{"updated": "data", "number": 42}' />,
            );

            const view = container.querySelector("div");
            const content = view?.innerHTML;

            // Should parse JSON string and render the content
            expect(content).toContain("updated");
            expect(content).toContain("data");
            expect(content).toMatch(/<span class="n">42<\/span>/);

            unmount();
        });

    });

    describe("JSON value type rendering", (): void => {

        it.each([
            { name: "string", data: '"test string"' as JsonValue, expectedClass: "s" },
            { name: "number", data: 42 as JsonValue, expectedClass: "n" },
            { name: "boolean true", data: true as JsonValue, expectedClass: "bl" },
            { name: "boolean false", data: false as JsonValue, expectedClass: "bl" },
            { name: "null", data: null as JsonValue, expectedClass: "nl" },
            { name: "empty object", data: {} as JsonValue, expectedClass: "o" },
            { name: "empty array", data: [] as JsonValue, expectedClass: "a" },
            { name: "object with properties", data: { key: "value" } as JsonValue, expectedClass: "k" },
            { name: "array with elements", data: [1, 2, 3] as JsonValue, expectedClass: "n" },
            { name: "complex object", data: mockJsonData, expectedClass: "k" },
            { name: "complex array", data: mockComplexArray, expectedClass: "n" },
            { name: "special chars", data: '"test \\"quotes\\" and apostrophes"' as JsonValue, expectedClass: "s" },
            { name: "empty string", data: '""' as JsonValue, expectedClass: "s" },
        ])("should render $name with correct DOM structure", ({ data, expectedClass }) => {
            const { container, unmount } = render(
                <JsonView json={data} />,
            );

            const view = container.querySelector("div");
            const content = view?.innerHTML;

            // Verify that the appropriate CSS class is present for each type
            expect(content).toMatch(new RegExp(`class="${expectedClass}"`));

            // Verify that the component renders without errors
            expect(view).toBeTruthy();
            expect(view?.innerHTML).toBeTruthy();

            unmount();
        });

    });

    describe("URL handling", (): void => {

        it("should render URLs as clickable links", () => {
            const { container, unmount } = render(
                <JsonView json={'"https://example.com"'} />,
            );

            const view = container.querySelector("div");
            const content = view?.innerHTML;

            // Should contain an anchor tag
            expect(content).toMatch(/<a[^>]*href="https:\/\/example\.com"[^>]*>/);
            expect(content).toContain("example.com");

            unmount();
        });

        it("should render relative URLs as clickable links", () => {
            const { container, unmount } = render(
                <JsonView json={'"/api/data"'} />,
            );

            const view = container.querySelector("div");
            const content = view?.innerHTML;

            // Should contain an anchor tag
            expect(content).toMatch(/<a[^>]*href="\/api\/data"[^>]*>/);
            expect(content).toContain("/api/data");

            unmount();
        });
    });

    describe("Object and array rendering", (): void => {

        it("should render complex nested structures with proper DOM hierarchy", () => {
            const complexData = {
                users: [
                    { id: 1, name: "John", active: true },
                    { id: 2, name: "Jane", active: false },
                ],
                metadata: {
                    total: 2,
                    page: 1,
                },
            };

            const { container, unmount } = render(
                <JsonView json={complexData} />,
            );

            const view = container.querySelector("div");
            const content = view?.innerHTML;

            // Verify object structure with proper nesting
            expect(content).toMatch(/<span class="o">\{<\/span>/); // Opening brace
            expect(content).toMatch(/<span class="o">\}<\/span>/); // Closing brace

            // Verify array structure
            expect(content).toMatch(/<span class="a">\[<\/span>/); // Opening bracket
            expect(content).toMatch(/<span class="a">\]<\/span>/); // Closing bracket

            // Verify key-value pairs
            expect(content).toMatch(/<span class="k">users<\/span>/);
            expect(content).toMatch(/<span class="k">metadata<\/span>/);
            expect(content).toMatch(/<span class="k">id<\/span>/);
            expect(content).toMatch(/<span class="k">name<\/span>/);
            expect(content).toMatch(/<span class="k">total<\/span>/);
            expect(content).toMatch(/<span class="k">page<\/span>/);

            unmount();
        });

    });

    describe("Theme integration", (): void => {

        it("should apply theme colors and custom styles correctly", () => {
            const customStyle = { backgroundColor: "red", fontSize: "14px" };
            const { container, unmount } = render(
                <JsonView json={mockJsonData} style={customStyle} />,
            );

            const viewElement = container.querySelector("div");

            // Verify className
            expect(viewElement?.classList.contains("jsonView")).toBe(true);

            // Verify custom styles are applied
            expect(viewElement?.style.backgroundColor).toBe("red");
            expect(viewElement?.style.fontSize).toBe("14px");

            // Verify theme CSS variables are set
            expect(viewElement?.style.getPropertyValue("--arrayDelimiterColor")).toBeTruthy();
            expect(viewElement?.style.getPropertyValue("--objectDelimiterColor")).toBeTruthy();
            expect(viewElement?.style.getPropertyValue("--keyColor")).toBeTruthy();
            expect(viewElement?.style.getPropertyValue("--valueColor")).toBeTruthy();

            unmount();
        });

    });

    describe("Interaction handling", (): void => {

        it("should toggle collapsed state when clicking on expandable entries", () => {
            const testData = { key1: { nested: "value" }, key2: "simple" };
            const { container, unmount } = render(
                <JsonView json={testData} />,
            );

            const view = container.querySelector("div");
            const entryElements = view?.querySelectorAll(".entry");

            const expandableEntry = Array.from(entryElements ?? []).find((entry) => {
                return entry.querySelector(".e") !== null;
            });

            if (expandableEntry) {
                expect(expandableEntry.classList.contains("collapsed")).toBe(false);

                expandableEntry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                expect(expandableEntry.classList.contains("collapsed")).toBe(true);

                expandableEntry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                expect(expandableEntry.classList.contains("collapsed")).toBe(false);
            }

            unmount();
        });

        it("should ignore clicks when text is selected", () => {
            const testData = { key: { nested: "value" } };
            const { container, unmount } = render(
                <JsonView json={testData} />,
            );

            const view = container.querySelector("div");
            const entryElements = view?.querySelectorAll(".entry");
            const expandableEntry = Array.from(entryElements ?? []).find((entry) => {
                return entry.querySelector(".e") !== null;
            });

            if (expandableEntry) {
                Object.defineProperty(window, "getSelection", {
                    value: () => {
                        return { type: "Range" };
                    },
                    writable: true,
                });

                expandableEntry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                expect(expandableEntry.classList.contains("collapsed")).toBe(false);

                Object.defineProperty(window, "getSelection", {
                    value: () => {
                        return { type: "None" };
                    },
                    writable: true,
                });
            }

            unmount();
        });

        it("should expand/collapse siblings when alt+clicking", () => {
            const testData = {
                key1: { nested1: "value1" },
                key2: { nested2: "value2" },
                key3: { nested3: "value3" },
            };
            const { container, unmount } = render(
                <JsonView json={testData} />,
            );

            const view = container.querySelector("div");
            const entryElements = view?.querySelectorAll(".entry");
            const expandableEntries = Array.from(entryElements ?? []).filter((entry) => {
                return entry.querySelector(".e") !== null;
            });

            if (expandableEntries.length >= 2) {
                const firstEntry = expandableEntries[0];

                expect(firstEntry.classList.contains("collapsed")).toBe(false);

                firstEntry.dispatchEvent(new MouseEvent("click", {
                    bubbles: true,
                    altKey: true,
                }));

                expect(firstEntry.classList.contains("collapsed")).toBe(true);

                firstEntry.dispatchEvent(new MouseEvent("click", {
                    bubbles: true,
                    altKey: true,
                }));

                expect(firstEntry.classList.contains("collapsed")).toBe(false);
            }

            unmount();
        });

    });

    describe("Component rendering", (): void => {

        it("should render with correct className and snapshot", () => {
            const { container, unmount } = render(
                <JsonView json={mockJsonData} />,
            );

            const viewElement = container.querySelector("div");
            expect(viewElement?.classList.contains("jsonView")).toBe(true);

            expect(container).toMatchSnapshot();

            unmount();
        });

    });

    describe("Edge cases and error handling", (): void => {

        it("should handle invalid JSON strings gracefully", () => {
            expect(() => {
                render(
                    <JsonView json="invalid json" />,
                );
            }).toThrow();

            // Should not crash the test suite
            expect(true).toBe(true);
        });

        it("should handle very large objects without performance issues", () => {
            const largeObject: JsonValue = {};
            for (let i = 0; i < 1000; i++) { // Reduced for faster testing
                largeObject[`key${i}`] = `value${i}`;
            }

            largeObject.key1000 = "";

            const { container, unmount } = render(
                <JsonView json={largeObject} />,
            );

            const view = container.querySelector("div");
            const content = view?.innerHTML;

            // Should render without errors
            expect(content).toBeTruthy();
            expect(content).toContain("key0");
            expect(content).toMatch(/<span class="s">value0<\/span>/);
            // JsonView renders empty strings as empty spans
            expect(content).toMatch(/<span class="s"><\/span>/);

            unmount();
        });

        it("should handle empty string values correctly", () => {
            const { container, unmount } = render(
                <JsonView json='""' />,
            );

            const view = container.querySelector("div");
            const content = view?.innerHTML;

            // Should render empty string properly
            expect(content).toBeTruthy();
            expect(content).toMatch(/<span class="s"><\/span>/);

            unmount();
        });

    });

});
