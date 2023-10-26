/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import { ComponentChild } from "preact";

import { Button } from "../Button/Button.js";
import { IComponentProperties, ComponentBase } from "../Component/ComponentBase.js";
import { ContentAlignment } from "../Container/Container.js";
import { Grid } from "../Grid/Grid.js";
import { GridCell } from "../Grid/GridCell.js";
import { Label } from "../Label/Label.js";

interface ICalendarViewProperties extends IComponentProperties {
    date: Date;

    onSelect?: (date: Date, props: ICalendarViewProperties) => void;
    onChangeMonth?: (inc: boolean) => void;
}

export class CalendarView extends ComponentBase<ICalendarViewProperties> {

    private dayNames: string[] = [];

    public constructor(props: ICalendarViewProperties) {
        super(props);

        // Initialize localized day names here. We need a concrete date for that.
        for (let day = 19; day < 26; ++day) {
            const date = new Date(2020, 3, day);
            this.dayNames.push(date.toLocaleString("default", { weekday: "short" }));
        }
    }

    public render(): ComponentChild {
        const { date } = this.mergedProps;
        const className = this.getEffectiveClassNames(["calendarView"]);

        // View caption (the current month + year).
        const month = date.toLocaleString("default", { month: "long" });
        const monthYear = `${month} ${date.getFullYear()}`;

        // Weekdays.
        const dayNames = [];
        let name = "";
        for (let i = 1; i < 7; ++i) { // Monday through Saturday.
            name = this.dayNames[i];
            dayNames.push(
                <GridCell
                    key={name}
                    className="header"
                >
                    {name}
                </GridCell>,
            );
        }

        name = this.dayNames[0]; // Sunday.
        dayNames.push(
            <GridCell
                key={name}
                className="header"
            >
                {name}
            </GridCell>,
        );

        // Day numbers.
        // First figure out the weekday this month starts with and the number of days in this month.
        const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 0);
        const lastOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const startDay = firstOfMonth.getDay();
        const dayCount = lastOfMonth.getDate();

        // Add empty cells for days that do not belong to this month.
        const days = [];
        for (let i = 0; i < startDay; ++i) {
            days.push(<GridCell key={`preDay${i}`} />);
        }

        // Add the actual day numbers.
        for (let i = 1; i <= dayCount; ++i) {
            days.push(
                <GridCell key={`day${i}`}>
                    <Button
                        caption={i.toString()}
                        onClick={this.handleDayClick}
                    />
                </GridCell>,
            );
        }

        // To ensure we always have 6 grid rows add more empty cells.
        while (days.length < 36) {
            days.push(<GridCell key={`preDay${days.length}`} />);
        }

        return (
            <Grid
                className={className}
                columns={7}
            >
                <GridCell
                    className="header"
                >
                    <Button
                        id="prevMonthButton"
                        onClick={this.handleMonthSwitch}
                    />
                </GridCell>
                <GridCell
                    columnSpan={5}
                    crossAlignment={ContentAlignment.Center}
                    className="header"
                >
                    <Label id="title" caption={monthYear} />
                </GridCell>
                <GridCell
                    className="header"
                >
                    <Button
                        id="nextMonthButton"
                        onClick={this.handleMonthSwitch}
                    />
                </GridCell>
                {dayNames}
                {days}
            </Grid>
        );
    }

    private handleMonthSwitch = (e: MouseEvent | KeyboardEvent, props: IComponentProperties): void => {
        const { onChangeMonth } = this.mergedProps;
        onChangeMonth?.(props.id === "nextMonthButton");
    };

    private handleDayClick = (e: MouseEvent | KeyboardEvent): void => {
        const day = parseInt((e.target as HTMLElement).innerText, 10);
        const { date, onSelect } = this.mergedProps;
        onSelect?.(new Date(date.getFullYear(), date.getMonth(), day), this.mergedProps);
    };

}
