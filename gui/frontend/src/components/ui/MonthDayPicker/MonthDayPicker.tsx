/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0.
 */

import "./MonthDayPicker.css";

import type { ComponentChild } from "preact";

export interface IMonthDayPickerProperties {
    selectedDays: number[];
    disabled?: boolean;
    "aria-label"?: string;
    onChange: (days: number[]) => void;
}

const canonicalDays = (days: number[]): number[] => {
    return [...new Set(days.filter((day) => {
        return Number.isInteger(day) && day >= 1 && day <= 31;
    }))].sort((left, right) => {
        return left - right;
    });
};

/**
 * A month-agnostic selector for days 1 through 31.
 *
 * @param props The picker state and change handler.
 *
 * @returns The picker control.
 */
export const MonthDayPicker = (props: IMonthDayPickerProperties): ComponentChild => {
    const { selectedDays, disabled = false, onChange } = props;
    const selected = new Set(selectedDays);

    const toggleDay = (day: number): void => {
        if (disabled) {
            return;
        }

        const nextDays = selected.has(day)
            ? selectedDays.filter((selectedDay) => {
                return selectedDay !== day;
            })
            : [...selectedDays, day];
        onChange(canonicalDays(nextDays));
    };

    return <div className="monthDayPicker" role="group" aria-label={props["aria-label"] ?? "Days of month"}>
        {Array.from({ length: 31 }, (_value, index) => {
            const day = index + 1;

            return <button
                key={day}
                type="button"
                className="monthDayPickerDay"
                aria-label={`Day ${day}`}
                aria-pressed={selected.has(day)}
                disabled={disabled}
                onClick={() => {
                    toggleDay(day);
                }}
            >{day}</button>;
        })}
    </div>;
};
