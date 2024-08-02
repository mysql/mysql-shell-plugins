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

import "./Input.css";

import { ComponentChild, createRef } from "preact";

import { IComponentProperties, ComponentBase } from "../Component/ComponentBase.js";
import { TextAlignment } from "../Label/Label.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";

export interface IInputProperties extends IComponentProperties {
    placeholder?: string;
    password?: boolean;

    /** When auto focus is set then all content is selected as well. */
    autoFocus?: boolean;

    value?: string;
    textAlignment?: TextAlignment;
    multiLine?: boolean;
    multiLineCount?: number;
    multiLineSwitchEnterKeyBehavior?: boolean;
    autoComplete?: boolean;
    spellCheck?: boolean;
    readOnly?: boolean;

    innerRef?: preact.RefObject<HTMLElement>;

    onChange?: (e: InputEvent, props: IInputChangeProperties) => void;
    onConfirm?: (e: KeyboardEvent, props: IInputChangeProperties) => void;
    onCancel?: (e: KeyboardEvent, props: IInputProperties) => void;
    onCustomKeyDown?: (e: KeyboardEvent, props: IInputChangeProperties) => boolean;
}

export interface IInputChangeProperties extends IInputProperties {
    value: string;
}

export class Input extends ComponentBase<IInputProperties> {

    public static defaultProps = {
        spellCheck: true,
    };

    private inputRef: preact.RefObject<HTMLElement>;

    public constructor(props: IInputProperties) {
        super(props);

        this.inputRef = props.innerRef ?? createRef<HTMLElement>();

        // Note: "placeholder", "autocomplete" and "spellCheck" are directly handled in HTML. "autoFocus" is
        // intentionally written in camel case to indicate this is *not* the HTML autofocus attribute.
        this.addHandledProperties("password", "autoFocus", "value", "textAlignment", "multiLine", "multiLineCount",
            "innerRef", "readOnly");
    }

    /**
     * Selects all text in the input field.
     * Watch out, not all input types support this.
     */
    public select(): void {
        if (this.inputRef.current instanceof HTMLInputElement) {
            this.inputRef.current.select();
        }
    }

    public componentDidMount(): void {
        const { autoFocus } = this.mergedProps;
        if (this.inputRef.current && autoFocus) {
            const element = this.inputRef.current;
            element.focus();
        }
    }

    public render(): ComponentChild {
        const { password, textAlignment, value, multiLine, multiLineCount, spellCheck, readOnly } = this.mergedProps;

        const className = this.getEffectiveClassNames(["input"]);

        if (multiLine) {
            return (
                <textarea
                    ref={this.inputRef as preact.Ref<HTMLTextAreaElement>}
                    onInput={this.handleInput}
                    onKeyDown={this.handleKeyDown}
                    className={className}
                    type={password ? "password" : "text"}
                    value={value}
                    spellCheck={spellCheck}
                    rows={multiLineCount}
                    style={{ textAlign: textAlignment }}
                    readOnly={readOnly}
                    {...this.unhandledProperties}
                />
            );

        } else {
            return (
                <input
                    ref={this.inputRef as preact.Ref<HTMLInputElement>}
                    onInput={this.handleInput}
                    onKeyDown={this.handleKeyDown}
                    className={className}
                    type={password ? "password" : "text"}
                    value={value}
                    spellCheck={spellCheck}
                    style={{ textAlign: textAlignment }}
                    readOnly={readOnly}
                    {...this.unhandledProperties}
                />
            );
        }
    }

    private handleInput = (e: Event): void => {
        const { onChange } = this.mergedProps;

        const element = e.target as HTMLInputElement;
        onChange?.(e as InputEvent, { ...this.mergedProps, value: element.value });
    };

    private handleKeyDown = (e: KeyboardEvent): void => {
        const { multiLine, multiLineSwitchEnterKeyBehavior, onConfirm, onCancel, onCustomKeyDown } = this.mergedProps;

        // If there is a custom onKeyDown method defined in the properties, call it. If the function returns true
        // it will prevent the internal key handling.
        if (onCustomKeyDown) {
            const element = e.target as HTMLInputElement;
            if (onCustomKeyDown(e, { ...this.mergedProps, value: element.value })) {
                return;
            }
        }

        switch (e.key) {
            case KeyboardKeys.Enter: {
                if (!multiLine
                    || (multiLineSwitchEnterKeyBehavior && !e.shiftKey)
                    || (!multiLineSwitchEnterKeyBehavior && e.shiftKey)) {
                    const element = e.target as HTMLInputElement;
                    onConfirm?.(e, { ...this.mergedProps, value: element.value });
                }

                break;
            }

            case KeyboardKeys.A: {
                if (e.metaKey && this.inputRef.current instanceof HTMLInputElement) {
                    this.inputRef.current.select();
                }
                break;
            }

            case KeyboardKeys.Escape: {
                onCancel?.(e, this.mergedProps);
                break;
            }

            case KeyboardKeys.ArrowLeft:
            case KeyboardKeys.ArrowRight:
            case KeyboardKeys.ArrowUp:
            case KeyboardKeys.ArrowDown: {
                if (multiLine) {
                    // Make sure arrow navigation in a multi line input stays intact.
                    // Owning controls (like the TreeGrid) may otherwise do additional handling.
                    e.stopPropagation();
                }

                break;
            }

            default: {
                break;
            }
        }
    };

}
