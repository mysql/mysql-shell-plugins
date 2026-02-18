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

import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TreeDropdownSelector } from "../../../components/ui/TreeDropdownSelector/TreeDropdownSelector.js";

/** Flush `setTimeout(..., 0)` used internally by the component for post-open behavior. */
const flushTimers = async () => {
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
};

/**
 * Locate a `.tds-item` span by its full text content (handles highlighted fragments).
 *
 * @param label - The text content to search for
 * @returns The matching HTMLElement, or undefined if no match is found
 */
const findItemSpan = (label: string): HTMLElement | undefined => {
    return Array.from(document.querySelectorAll("span.tds-item")).find((span) => {
        return span.textContent?.replace(/\s+/g, "") === label.replace(/\s+/g, "");
    }) as HTMLElement | undefined;
};

/** Click the collapsed view to open the dropdown. */
const openDropdown = () => {
    const collapsedView = document.querySelector(".tds-collapsed");
    if (collapsedView) {
        fireEvent.click(collapsedView);
    }
};

/**
 * Type into the filter input.
 *
 * @param value - The text to type into the filter input
 */
const typeFilter = (value: string) => {
    fireEvent.input(screen.getByPlaceholderText(/Filter/i), { target: { value } });
};

/** Standard hierarchical test data. */
const items = [
    { id: "1", label: "Root" },
    { id: "2", label: "Child A", parent: "1" },
    { id: "3", label: "Child B", parent: "1" },
    { id: "4", label: "Grandchild", parent: "2" },
];

describe("TreeDropdownSelector", () => {
    afterEach(cleanup);

    // ── Rendering ────────────────────────────────────────────────────────

    describe("Rendering", () => {
        it("shows default placeholder when nothing is selected", () => {
            render(<TreeDropdownSelector items={[]} />);
            expect(screen.getByText("Not selected")).toBeTruthy();
        });

        it("shows custom placeholder when provided", () => {
            render(<TreeDropdownSelector items={items} placeholder="Choose an option" />);
            expect(screen.getByText("Choose an option")).toBeTruthy();
        });

        it("shows selection path for nested item without root prefix", () => {
            render(<TreeDropdownSelector items={items} selected="4" />);
            expect(screen.getByText("Child A / Grandchild")).toBeTruthy();
        });

        it("shows only child label when direct child of root is selected", () => {
            render(<TreeDropdownSelector items={items} selected="2" />);
            expect(screen.getByText("Child A")).toBeTruthy();
            expect(screen.queryByText(/Root/)).toBeNull();
        });

        it("shows direct label when root item is selected", () => {
            render(<TreeDropdownSelector items={items} selected="1" />);
            expect(screen.getByText("Root")).toBeTruthy();
        });

        it("falls back to placeholder for non-existent selected id", () => {
            render(<TreeDropdownSelector items={items} selected="non-existent" />);
            expect(screen.getByText("Not selected")).toBeTruthy();
        });

        it("applies custom className to root element", () => {
            render(<TreeDropdownSelector items={items} className="custom" />);
            expect(document.querySelector(".tds-root")?.className).toContain("custom");
        });

        it("shows empty message and filter input for empty items array", () => {
            render(<TreeDropdownSelector items={[]} />);
            openDropdown();
            expect(screen.getByPlaceholderText(/Filter/i)).toBeTruthy();
            expect(screen.getByText("No matching items")).toBeTruthy();
        });

        it("displays full tree when opened", () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();

            for (const item of items) {
                expect(screen.getByText(item.label)).toBeTruthy();
            }
        });
    });

    // ── Tree Building ────────────────────────────────────────────────────

    describe("Tree Building", () => {
        it("promotes items with dangling parent reference to root level", () => {
            render(<TreeDropdownSelector items={[
                { id: "a", label: "Orphan", parent: "missing" },
                { id: "b", label: "RootItem" },
            ]} />);
            openDropdown();

            expect(screen.getByText("Orphan")).toBeTruthy();
            expect(screen.getByText("RootItem")).toBeTruthy();
        });

        it.each([
            { parentValue: null, desc: "null" },
            { parentValue: undefined, desc: "undefined" },
        ])("treats $desc parent as root level", ({ parentValue }) => {
            render(<TreeDropdownSelector items={[
                { id: "a", label: "RootNode", parent: parentValue },
                { id: "b", label: "ChildNode", parent: "a" },
            ]} />);
            openDropdown();

            expect(screen.getByText("RootNode")).toBeTruthy();
            expect(screen.getByText("ChildNode")).toBeTruthy();
        });

        it("supports multiple root nodes", () => {
            render(<TreeDropdownSelector items={[
                { id: "1", label: "Root A" },
                { id: "2", label: "Root B" },
                { id: "3", label: "Child of A", parent: "1" },
            ]} />);
            openDropdown();

            expect(screen.getByText("Root A")).toBeTruthy();
            expect(screen.getByText("Root B")).toBeTruthy();
            expect(screen.getByText("Child of A")).toBeTruthy();
        });

        it("handles deeply nested tree", () => {
            const deepItems = Array.from({ length: 5 }, (_, i) => {
                return {
                    id: String(i + 1),
                    label: `Level ${i + 1}`,
                    ...(i > 0 && { parent: String(i) }),
                };
            });
            render(<TreeDropdownSelector items={deepItems} />);
            openDropdown();

            expect(screen.getByText("Level 1")).toBeTruthy();
            expect(screen.getByText("Level 5")).toBeTruthy();
        });

        it("handles special characters in labels", () => {
            render(<TreeDropdownSelector items={[
                { id: "1", label: "Root & Parent" },
                { id: "2", label: "Child <special>", parent: "1" },
                { id: "3", label: "Item \"quoted\"", parent: "1" },
            ]} />);
            openDropdown();

            expect(screen.getByText("Root & Parent")).toBeTruthy();
            expect(screen.getByText("Child <special>")).toBeTruthy();
            expect(screen.getByText("Item \"quoted\"")).toBeTruthy();
        });
    });

    // ── Filtering ────────────────────────────────────────────────────────

    describe("Filtering", () => {
        it("shows only matching nodes and their ancestors", () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();
            typeFilter("Grand");

            expect(findItemSpan("Grandchild")).toBeTruthy();
            expect(findItemSpan("Root")).toBeTruthy();
            expect(findItemSpan("Child A")).toBeTruthy();
            expect(findItemSpan("Child B")).toBeFalsy();
        });

        it("is case-insensitive", () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();
            typeFilter("CHILD");

            expect(findItemSpan("Child A")).toBeTruthy();
            expect(findItemSpan("Child B")).toBeTruthy();
        });

        it("shows empty message when nothing matches", () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();
            typeFilter("xyz123");

            expect(screen.queryByText("Root")).toBeNull();
            expect(screen.getByText("No matching items")).toBeTruthy();
        });

        it("highlights matching text with bold", () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();
            typeFilter("Grand");

            const bold = Array.from(document.querySelectorAll("b")).find(
                (el) => {
                    return el.textContent === "Grand";
                },
            );
            expect(bold).toBeTruthy();
        });

        it("expands collapsed nodes to reveal matches", () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();

            fireEvent.click(screen.getAllByLabelText(/Collapse/i)[0]);
            expect(screen.queryByText("Child A")).toBeNull();

            typeFilter("Grand");
            expect(findItemSpan("Grandchild")).toBeTruthy();
        });

        it("resets filter and expands all nodes on close/reopen", () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();
            typeFilter("Child");

            fireEvent.click(screen.getByLabelText(/Close/i));
            openDropdown();

            const filterInput = screen.getByPlaceholderText<HTMLInputElement>(/Filter/i);
            expect(filterInput.value).toBe("");
            for (const item of items) {
                expect(screen.getByText(item.label)).toBeTruthy();
            }
        });
    });

    // ── Selection ────────────────────────────────────────────────────────

    describe("Selection", () => {
        it("calls onSelect and closes dropdown on item click", () => {
            const onSelect = vi.fn();
            render(<TreeDropdownSelector items={items} onSelect={onSelect} />);
            openDropdown();

            fireEvent.click(findItemSpan("Child B")!);

            expect(onSelect).toHaveBeenCalledWith("3");
            expect(onSelect).toHaveBeenCalledTimes(1);
            expect(screen.queryByPlaceholderText(/Filter/i)).toBeNull();
        });

        it("does not update label in controlled mode", () => {
            const onSelect = vi.fn();
            render(<TreeDropdownSelector items={items} selected="2" onSelect={onSelect} />);
            expect(screen.getByText("Child A")).toBeTruthy();

            openDropdown();
            fireEvent.click(findItemSpan("Child B")!);

            // Still shows previous selection until parent updates `selected` prop.
            expect(screen.getByText("Child A")).toBeTruthy();
            expect(onSelect).toHaveBeenCalledWith("3");
        });

        it("updates label in uncontrolled mode", () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();
            fireEvent.click(findItemSpan("Child B")!);

            expect(screen.getByText("Child B")).toBeTruthy();
        });

        it("reflects controlled selection prop changes", async () => {
            const { rerender } = render(<TreeDropdownSelector items={items} selected="2" />);
            expect(screen.getByText("Child A")).toBeTruthy();

            rerender(<TreeDropdownSelector items={items} selected="3" />);
            await flushTimers();

            expect(screen.getByText("Child B")).toBeTruthy();
        });

        it("reflects controlled selection changing to null", async () => {
            const { rerender } = render(<TreeDropdownSelector items={items} selected="2" />);
            expect(screen.getByText("Child A")).toBeTruthy();

            rerender(<TreeDropdownSelector items={items} selected={null} />);
            await flushTimers();

            expect(screen.getByText("Not selected")).toBeTruthy();
        });

        it("highlights selected item with selected class", async () => {
            render(<TreeDropdownSelector items={items} selected="3" />);
            openDropdown();
            await flushTimers();

            expect(findItemSpan("Child B")?.className).toContain("tds-item-selected");
        });
    });

    // ── Expand / Collapse ────────────────────────────────────────────────

    describe("Expand/Collapse", () => {
        it("renders arrows only for nodes with children", () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();

            expect(screen.getAllByLabelText(/Expand|Collapse/i).length).toBeGreaterThanOrEqual(2);
        });

        it("expands all nodes by default", () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();

            for (const item of items) {
                expect(screen.getByText(item.label)).toBeTruthy();
            }
        });

        it("does not render arrow for single leaf item", () => {
            render(<TreeDropdownSelector items={[{ id: "only", label: "Only Item" }]} />);
            openDropdown();

            expect(screen.getByText("Only Item")).toBeTruthy();
            expect(screen.queryByLabelText(/Expand|Collapse/i)).toBeNull();
        });

        it("collapses and re-expands node via arrow click", () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();

            fireEvent.click(screen.getAllByLabelText(/Collapse/i)[0]);
            expect(screen.queryByText("Child A")).toBeNull();
            expect(screen.queryByText("Child B")).toBeNull();

            fireEvent.click(screen.getByLabelText(/Expand/i));
            expect(screen.getByText("Child A")).toBeTruthy();
            expect(screen.getByText("Child B")).toBeTruthy();
        });

        it("preserves collapsed state after items prop update", async () => {
            const { rerender } = render(<TreeDropdownSelector items={items} />);
            openDropdown();

            fireEvent.click(screen.getAllByLabelText(/Collapse/i)[0]);
            expect(screen.queryByText("Child A")).toBeNull();

            // Update items with new array reference but same data
            rerender(<TreeDropdownSelector items={items.map((i) => {
                return { ...i };
            })} />);
            await flushTimers();

            // Collapsed state should be preserved
            expect(screen.queryByText("Child A")).toBeNull();

            fireEvent.click(screen.getByLabelText(/Expand/i));
            expect(screen.getByText("Child A")).toBeTruthy();
        });

        it("expands all nodes when items arrive after initial empty render", async () => {
            const { rerender } = render(<TreeDropdownSelector items={[]} />);
            openDropdown();
            expect(screen.getByText("No matching items")).toBeTruthy();

            // Simulate async data arrival
            rerender(<TreeDropdownSelector items={items} />);
            await flushTimers();

            for (const item of items) {
                expect(screen.getByText(item.label)).toBeTruthy();
            }
            expect(screen.getAllByLabelText(/Collapse/i).length).toBeGreaterThan(0);
        });
    });

    // ── Dropdown Lifecycle ───────────────────────────────────────────────

    describe("Dropdown Lifecycle", () => {
        it("toggles open/close via click", () => {
            render(<TreeDropdownSelector items={items} />);

            expect(screen.queryByPlaceholderText(/Filter/i)).toBeNull();
            openDropdown();
            expect(screen.getByPlaceholderText(/Filter/i)).toBeTruthy();

            fireEvent.click(screen.getByLabelText(/Close/i));
            expect(screen.queryByPlaceholderText(/Filter/i)).toBeNull();
        });

        it("auto-focuses filter input on open", async () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();
            await flushTimers();

            expect(document.activeElement).toBe(screen.getByPlaceholderText(/Filter/i));
        });

        it("scrolls selected item into view on open", async () => {
            const scrollSpy = vi.fn();
            const proto = HTMLElement.prototype as unknown as { scrollIntoView?: (options?: unknown) => void };
            const original = proto.scrollIntoView;
            proto.scrollIntoView = scrollSpy;

            render(<TreeDropdownSelector items={items} selected="4" />);
            openDropdown();
            await flushTimers();

            expect(findItemSpan("Grandchild")).toBeTruthy();
            expect(scrollSpy).toHaveBeenCalledTimes(1);

            proto.scrollIntoView = original;
        });

        it("disables collapsed view pointer events while open", () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();

            expect(window.getComputedStyle(document.querySelector(".tds-collapsed")!).pointerEvents)
                .toBe("none");
        });
    });

    // ── Keyboard Interaction ─────────────────────────────────────────────

    describe("Keyboard Interaction", () => {
        it.each(["Enter", " "])("opens dropdown with '%s' key", (key) => {
            render(<TreeDropdownSelector items={items} />);
            fireEvent.keyDown(document.querySelector(".tds-collapsed")!, { key });

            expect(screen.getByPlaceholderText(/Filter/i)).toBeTruthy();
        });

        it("ignores non-activation keys on collapsed view", () => {
            render(<TreeDropdownSelector items={items} />);
            fireEvent.keyDown(document.querySelector(".tds-collapsed")!, { key: "ArrowDown" });

            expect(screen.queryByPlaceholderText(/Filter/i)).toBeNull();
        });

        it("closes dropdown with Escape from filter input", () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();
            fireEvent.keyDown(screen.getByPlaceholderText(/Filter/i), { key: "Escape" });

            expect(screen.queryByPlaceholderText(/Filter/i)).toBeNull();
        });

        it.each(["Enter", " "])("selects item with '%s' key", async (key) => {
            const onSelect = vi.fn();
            render(<TreeDropdownSelector items={items} onSelect={onSelect} />);
            openDropdown();
            await flushTimers();

            fireEvent.keyDown(findItemSpan("Child B")!, { key });
            expect(onSelect).toHaveBeenCalledWith("3");
        });

        it.each(["Enter", " "])("toggles expand/collapse with '%s' key on arrow", (key) => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();

            fireEvent.keyDown(screen.getAllByLabelText(/Collapse/i)[0], { key });
            expect(screen.queryByText("Child A")).toBeNull();
        });

        it.each(["Enter", " "])("closes dropdown with '%s' key on close button", (key) => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();

            fireEvent.keyDown(screen.getByLabelText(/Close/i), { key });
            expect(screen.queryByPlaceholderText(/Filter/i)).toBeNull();
        });
    });

    // ── Disabled State ───────────────────────────────────────────────────

    describe("Disabled State", () => {
        it("prevents opening via click and keyboard", () => {
            render(<TreeDropdownSelector items={items} disabled />);
            const collapsed = document.querySelector(".tds-collapsed")!;

            openDropdown();
            expect(screen.queryByPlaceholderText(/Filter/i)).toBeNull();

            fireEvent.keyDown(collapsed, { key: "Enter" });
            expect(screen.queryByPlaceholderText(/Filter/i)).toBeNull();
        });

        it("has correct disabled attributes", () => {
            render(<TreeDropdownSelector items={items} disabled />);
            const collapsed = document.querySelector(".tds-collapsed")!;

            expect(collapsed.className).toContain("tds-disabled");
            expect(collapsed.getAttribute("tabindex")).toBe("-1");
            expect(collapsed.getAttribute("aria-disabled")).toBe("true");
            expect(collapsed.getAttribute("aria-expanded")).toBe("false");
        });
    });

    // ── Clearable Selection ──────────────────────────────────────────────

    describe("Clearable Selection", () => {
        it("shows clear button only when clearable and has selection", () => {
            const { rerender } = render(<TreeDropdownSelector items={items} clearable />);
            expect(screen.queryByLabelText(/Clear selection/i)).toBeNull();

            rerender(<TreeDropdownSelector items={items} selected="2" />);
            expect(screen.queryByLabelText(/Clear selection/i)).toBeNull();

            rerender(<TreeDropdownSelector items={items} selected="2" clearable />);
            expect(screen.getByLabelText(/Clear selection/i)).toBeTruthy();
        });

        it("calls onSelect(null) without opening dropdown", () => {
            const onSelect = vi.fn();
            render(<TreeDropdownSelector items={items} selected="2" clearable onSelect={onSelect} />);

            fireEvent.click(screen.getByLabelText(/Clear selection/i));

            expect(onSelect).toHaveBeenCalledWith(null);
            expect(screen.queryByPlaceholderText(/Filter/i)).toBeNull();
        });

        it.each(["Enter", " "])("clears selection with '%s' key on clear button", (key) => {
            const onSelect = vi.fn();
            render(<TreeDropdownSelector items={items} selected="2" clearable onSelect={onSelect} />);

            fireEvent.keyDown(screen.getByLabelText(/Clear selection/i), { key });
            expect(onSelect).toHaveBeenCalledWith(null);
        });

        it("resets to placeholder in uncontrolled mode", () => {
            render(<TreeDropdownSelector items={items} clearable />);
            openDropdown();
            fireEvent.click(findItemSpan("Child B")!);

            fireEvent.click(screen.getByLabelText(/Clear selection/i));
            expect(screen.getByText("Not selected")).toBeTruthy();
        });
    });

    // ── ARIA Attributes ──────────────────────────────────────────────────

    describe("ARIA Attributes", () => {
        it("has combobox role with aria-expanded and aria-haspopup on collapsed view", () => {
            render(<TreeDropdownSelector items={items} />);
            const collapsed = document.querySelector(".tds-collapsed")!;

            expect(collapsed.getAttribute("role")).toBe("combobox");
            expect(collapsed.getAttribute("aria-expanded")).toBe("false");
            expect(collapsed.getAttribute("aria-haspopup")).toBe("listbox");

            openDropdown();
            expect(collapsed.getAttribute("aria-expanded")).toBe("true");
        });

        it("has listbox role on list and option role on items", () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();

            expect(document.querySelector(".tds-list")?.getAttribute("role")).toBe("listbox");
            expect(findItemSpan("Root")?.getAttribute("role")).toBe("option");
        });

        it("sets aria-selected on selected item only", async () => {
            render(<TreeDropdownSelector items={items} selected="1" />);
            openDropdown();
            await flushTimers();

            expect(findItemSpan("Root")?.getAttribute("aria-selected")).toBe("true");
            expect(findItemSpan("Child A")?.getAttribute("aria-selected")).toBe("false");
        });

        it("has aria-label on filter input and button role on arrows", () => {
            render(<TreeDropdownSelector items={items} />);
            openDropdown();

            expect(screen.getByPlaceholderText(/Filter/i).getAttribute("aria-label")).toBe("Filter items");
            expect(screen.getAllByLabelText(/Collapse/i)[0].getAttribute("role")).toBe("button");
        });
    });
});
