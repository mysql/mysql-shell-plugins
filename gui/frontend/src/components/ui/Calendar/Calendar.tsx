/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import "./Calendar.css";

import { ComponentChild, createRef } from "preact";

import { CalendarView } from "./CalendarView.js";
import {
    IComponentProperties, IComponentState, ComponentBase, ComponentPlacement,
} from "../Component/ComponentBase.js";
import { Popup } from "../Popup/Popup.js";

interface ICalendarProperties extends IComponentProperties {
    initialDate?: Date;

    onChange?: (date: Date) => void;
}

interface ICalendarState extends IComponentState {
    currentDate: Date; // XXX: convert to controlled component.
}

export class Calendar extends ComponentBase<ICalendarProperties, ICalendarState> {

    public static defaultProps = {
        initialDate: new Date(),
    };

    private popupRef = createRef<Popup>();

    public constructor(props: ICalendarProperties) {
        super(props);

        this.state = {
            currentDate: props.initialDate!,
        };

        this.addHandledProperties("initialDate");
    }

    public render(): ComponentChild {
        const { currentDate } = this.state;
        const className = this.getEffectiveClassNames(["calendarHost"]);

        return (
            <Popup
                ref={this.popupRef}
                className={className}
                placement={ComponentPlacement.BottomCenter}
                showArrow={true}
            >
                <CalendarView
                    date={currentDate}
                    onChangeMonth={this.handleMonthChange}
                    onSelect={this.handleSelectDate}
                />
            </Popup>
        );
    }

    public open(currentTarget: HTMLElement): void {
        this.popupRef?.current?.open(currentTarget.getBoundingClientRect());
    }

    public close(): void {
        this.popupRef?.current?.close(false);
    }

    private handleMonthChange = (inc: boolean): void => {
        const { currentDate } = this.state;
        const offset = inc ? 1 : -1;
        this.setState({
            currentDate: new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, currentDate.getDate()),
        });
    };

    private handleSelectDate = (date: Date): void => {
        this.popupRef.current?.close(false);

        const { onChange } = this.mergedProps;
        onChange?.(date);
    };

}
