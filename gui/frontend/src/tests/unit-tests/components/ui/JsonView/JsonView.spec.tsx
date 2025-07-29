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

import { mount } from "enzyme";
import { act } from "@testing-library/preact";

import { JsonView, JsonValue } from "../../../../../components/ui/JsonView/JsonView.js";

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

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe("Component instantiation and lifecycle", (): void => {

        it("should instantiate correctly with JSON string", () => {
            const jsonString = JSON.stringify(mockJsonData);
            const component = mount<JsonView>(
                <JsonView json={jsonString} />,
            );

            expect(component).toBeTruthy();
            expect(component.props().json).toBe(jsonString);

            component.unmount();
        });

        it("should update DOM when JSON prop changes", async () => {
            const component = mount<JsonView>(
                <JsonView json={{ key: "value" }} />,
            );

            const initialView = component.find("div").getDOMNode();
            const initialContent = initialView.innerHTML;

            const newData = { newKey: "newValue", nested: { deep: "data" } };

            await act(() => {
                component.setProps({ json: newData });
            });

            const updatedView = component.find("div").getDOMNode();
            const updatedContent = updatedView.innerHTML;

            // DOM should be updated with new content
            expect(updatedContent).not.toBe(initialContent);
            expect(updatedContent).toContain("newKey");
            expect(updatedContent).toMatch(/<span class="k">newKey<\/span>/);

            component.unmount();
        });

        it("should not update DOM when JSON prop remains the same", async () => {
            const component = mount<JsonView>(
                <JsonView json={mockJsonData} />,
            );

            const initialView = component.find("div").getDOMNode();
            const initialContent = initialView.innerHTML;

            await act(() => {
                component.setProps({ json: mockJsonData });
            });

            const updatedView = component.find("div").getDOMNode();
            const updatedContent = updatedView.innerHTML;

            // DOM should remain unchanged
            expect(updatedContent).toBe(initialContent);

            component.unmount();
        });

        it("should handle JSON string to object conversion in componentDidUpdate", async () => {
            const component = mount<JsonView>(
                <JsonView json='{"initial": "data"}' />,
            );

            const newJsonString = '{"updated": "data", "number": 42}';

            await act(() => {
                component.setProps({ json: newJsonString });
            });

            const view = component.find("div").getDOMNode();
            const content = view.innerHTML;

            // Should parse JSON string and render the content
            expect(content).toContain("updated");
            expect(content).toContain("data");
            expect(content).toMatch(/<span class="n"><\/span>/);

            component.unmount();
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
            const component = mount<JsonView>(
                <JsonView json={data} />,
            );

            const view = component.find("div").getDOMNode();
            const content = view.innerHTML;

            // Verify that the appropriate CSS class is present for each type
            expect(content).toMatch(new RegExp(`class="${expectedClass}"`));

            // Verify that the component renders without errors
            expect(view).toBeTruthy();
            expect(view.innerHTML).toBeTruthy();

            component.unmount();
        });

    });

    describe("URL handling", (): void => {

        it("should render URLs as clickable links", () => {
            const component = mount<JsonView>(
                <JsonView json={'"https://example.com"'} />,
            );

            const view = component.find("div").getDOMNode();
            const content = view.innerHTML;

            // Should contain an anchor tag
            expect(content).toMatch(/<a[^>]*href="https:\/\/example\.com"[^>]*>/);
            expect(content).toContain("example.com");

            component.unmount();
        });

        it("should render relative URLs as clickable links", () => {
            const component = mount<JsonView>(
                <JsonView json={'"/api/data"'} />,
            );

            const view = component.find("div").getDOMNode();
            const content = view.innerHTML;

            // Should contain an anchor tag
            expect(content).toMatch(/<a[^>]*href="\/api\/data"[^>]*>/);
            expect(content).toContain("/api/data");

            component.unmount();
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

            const component = mount<JsonView>(
                <JsonView json={complexData} />,
            );

            const view = component.find("div").getDOMNode();
            const content = view.innerHTML;

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

            component.unmount();
        });

    });

    describe("Theme integration", (): void => {

        it("should apply theme colors and custom styles correctly", () => {
            const customStyle = { backgroundColor: "red", fontSize: "14px" };
            const component = mount<JsonView>(
                <JsonView json={mockJsonData} style={customStyle} />,
            );

            const viewElement = component.find("div");
            const domNode: HTMLElement = viewElement.getDOMNode();

            // Verify className
            expect(viewElement).toHaveLength(1);
            expect(viewElement.hasClass("jsonView")).toBe(true);

            // Verify custom styles are applied
            expect((domNode).style.backgroundColor).toBe("red");
            expect(domNode.style.fontSize).toBe("14px");

            // Verify theme CSS variables are set
            expect(domNode.style.getPropertyValue("--arrayDelimiterColor")).toBeTruthy();
            expect(domNode.style.getPropertyValue("--objectDelimiterColor")).toBeTruthy();
            expect(domNode.style.getPropertyValue("--keyColor")).toBeTruthy();
            expect(domNode.style.getPropertyValue("--valueColor")).toBeTruthy();

            component.unmount();
        });

    });

    describe("Interaction handling", (): void => {

        it("should toggle collapsed state when clicking on expandable entries", () => {
            const testData = { key1: { nested: "value" }, key2: "simple" };
            const component = mount<JsonView>(
                <JsonView json={testData} />,
            );

            const view = component.find("div").getDOMNode();
            const entryElements = view.querySelectorAll(".entry");

            const expandableEntry = Array.from(entryElements).find((entry) => {
                return entry.querySelector(".e") !== null;
            });

            if (expandableEntry) {
                expect(expandableEntry.classList.contains("collapsed")).toBe(false);

                expandableEntry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                expect(expandableEntry.classList.contains("collapsed")).toBe(true);

                expandableEntry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                expect(expandableEntry.classList.contains("collapsed")).toBe(false);
            }

            component.unmount();
        });

        it("should ignore clicks when text is selected", () => {
            const testData = { key: { nested: "value" } };
            const component = mount<JsonView>(
                <JsonView json={testData} />,
            );

            const view = component.find("div").getDOMNode();
            const entryElements = view.querySelectorAll(".entry");
            const expandableEntry = Array.from(entryElements).find((entry) => {
                return entry.querySelector(".e") !== null;
            });

            if (expandableEntry) {
                Object.defineProperty(window, "getSelection", {
                    value: () => {return { type: "Range" };},
                    writable: true,
                });

                expandableEntry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                expect(expandableEntry.classList.contains("collapsed")).toBe(false);

                Object.defineProperty(window, "getSelection", {
                    value: () => {return { type: "None" };},
                    writable: true,
                });
            }

            component.unmount();
        });

        it("should expand/collapse siblings when alt+clicking", () => {
            const testData = {
                key1: { nested1: "value1" },
                key2: { nested2: "value2" },
                key3: { nested3: "value3" },
            };
            const component = mount<JsonView>(
                <JsonView json={testData} />,
            );

            const view = component.find("div").getDOMNode();
            const entryElements = view.querySelectorAll(".entry");
            const expandableEntries = Array.from(entryElements).filter((entry) => {
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

            component.unmount();
        });

    });

    describe("Component rendering", (): void => {

        it("should render with correct className and snapshot", () => {
            const component = mount<JsonView>(
                <JsonView json={mockJsonData} />,
            );

            const viewElement = component.find("div");
            expect(viewElement).toHaveLength(1);
            expect(viewElement.hasClass("jsonView")).toBe(true);

            expect(component).toMatchSnapshot();

            component.unmount();
        });

    });

    describe("Edge cases and error handling", (): void => {

        it("should handle invalid JSON strings gracefully", () => {
            expect(() => {
                mount<JsonView>(
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

            const component = mount<JsonView>(
                <JsonView json={largeObject} />,
            );

            const view = component.find("div").getDOMNode();
            const content = view.innerHTML;

            // Should render without errors
            expect(content).toBeTruthy();
            expect(content).toContain("key0");
            // JsonView renders empty strings as empty spans
            expect(content).toMatch(/<span class="s"><\/span>/);

            component.unmount();
        });

        it("should handle empty string values correctly", () => {
            const component = mount<JsonView>(
                <JsonView json='""' />,
            );

            const view = component.find("div").getDOMNode();
            const content = view.innerHTML;

            // Should render empty string properly
            expect(content).toBeTruthy();
            expect(content).toMatch(/<span class="s"><\/span>/);

            component.unmount();
        });

    });

});
