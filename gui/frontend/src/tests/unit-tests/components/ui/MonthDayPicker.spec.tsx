/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MonthDayPicker } from "../../../../components/ui/MonthDayPicker/MonthDayPicker.js";

afterEach(cleanup);

describe("MonthDayPicker", () => {
    it("renders all month days and marks selected days", () => {
        render(<MonthDayPicker selectedDays={[2, 31]} onChange={vi.fn()} />);

        expect(screen.getAllByRole("button")).toHaveLength(31);
        expect(screen.getByRole("button", { name: "Day 2" }).getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByRole("button", { name: "Day 3" }).getAttribute("aria-pressed")).toBe("false");
    });

    it("returns selected days in canonical order", () => {
        const onChange = vi.fn();
        render(<MonthDayPicker selectedDays={[31, 3, 3]} onChange={onChange} />);

        fireEvent.click(screen.getByRole("button", { name: "Day 1" }));

        expect(onChange).toHaveBeenCalledWith([1, 3, 31]);
    });

    it("removes a selected day", () => {
        const onChange = vi.fn();
        render(<MonthDayPicker selectedDays={[3, 5]} onChange={onChange} />);

        fireEvent.click(screen.getByRole("button", { name: "Day 5" }));

        expect(onChange).toHaveBeenCalledWith([3]);
    });

    it("does not change selection while disabled", () => {
        const onChange = vi.fn();
        render(<MonthDayPicker selectedDays={[5]} disabled onChange={onChange} />);

        fireEvent.click(screen.getByRole("button", { name: "Day 5" }));

        expect(onChange).not.toHaveBeenCalled();
    });
});
