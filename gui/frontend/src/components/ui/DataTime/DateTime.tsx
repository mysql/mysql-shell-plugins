/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import "./DateTime.css";

import { ComponentChild, createRef } from "preact";

import { IComponentProperties, ComponentBase } from "../Component/ComponentBase.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";

export enum IDateTimeValueType {
    Date = "date",
    Time = "time",
    DateTime = "datetime-local",
    Week = "week",
    Month = "month",
}

export interface IDateTimeProperties extends IComponentProperties {
    /** Determines the type of interface to show, and which values can be entered. */
    type: IDateTimeValueType;

    /** When auto focus is set then all content is selected as well. */
    autoFocus?: boolean;

    value?: string;

    innerRef?: preact.RefObject<HTMLElement>;

    onChange?: (e: InputEvent, props: IDateTimeChangeProperties) => void;
    onConfirm?: (e: KeyboardEvent, props: IDateTimeChangeProperties) => void;
    onCancel?: (e: KeyboardEvent, props: IDateTimeProperties) => void;
}

export interface IDateTimeChangeProperties extends IDateTimeProperties {
    value: string;
}

export class DateTime extends ComponentBase<IDateTimeProperties> {

    public static defaultProps = {
        spellCheck: true,
    };

    private dateTimeRef: preact.RefObject<HTMLElement>;

    public constructor(props: IDateTimeProperties) {
        super(props);

        this.dateTimeRef = props.innerRef ?? createRef<HTMLElement>();

        // Note: "placeholder", "autocomplete" and "spellCheck" are directly handled in HTML. "autoFocus" is
        // intentionally written in camel case to indicate this is *not* the HTML autofocus attribute.
        this.addHandledProperties("autoFocus", "value", "innerRef");
    }

    public componentDidMount(): void {
        const { autoFocus } = this.mergedProps;
        if (this.dateTimeRef.current && autoFocus) {
            const element = this.dateTimeRef.current;
            element.focus();
        }
    }

    public render(): ComponentChild {
        const { type, value } = this.mergedProps;

        const className = this.getEffectiveClassNames(["dateTime"]);

        return (
            <input
                ref={this.dateTimeRef as preact.Ref<HTMLInputElement>}
                onInput={this.handleInput}
                onKeyDown={this.handleKeyDown}
                className={className}
                type={type}
                value={value}
                {...this.unhandledProperties}
            />
        );
    }

    private handleInput = (e: Event): void => {
        const { onChange } = this.mergedProps;

        const element = e.target as HTMLInputElement;
        onChange?.(e as InputEvent, { ...this.mergedProps, value: element.value });
    };

    private handleKeyDown = (e: KeyboardEvent): void => {
        const { onConfirm, onCancel } = this.mergedProps;

        switch (e.key) {
            case KeyboardKeys.Enter: {
                const element = e.target as HTMLInputElement;
                onConfirm?.(e, { ...this.mergedProps, value: element.value });

                break;
            }

            case KeyboardKeys.Escape: {
                onCancel?.(e, this.mergedProps);
                break;
            }

            default: {
                break;
            }
        }
    };

}
