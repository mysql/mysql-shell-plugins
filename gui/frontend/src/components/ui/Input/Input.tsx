/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import "./Input.css";

import React from "react";

import { Component, IComponentProperties, TextAlignment } from "..";
import keyboardKey from "keyboard-key";

export interface IInputTextRange {
    start: number; // Zero-based character index.
    end: number;   // ditto
}

export interface IInputProperties extends IComponentProperties {
    placeholder?: string;
    style?: React.CSSProperties;
    password?: boolean;

    // When auto focus is set then all content is selected as well.
    autoFocus?: boolean;

    value?: string;
    textAlignment?: TextAlignment;
    multiLine?: boolean;
    autoComplete?: boolean;
    spellCheck?: boolean;

    innerRef?: React.RefObject<HTMLElement>;

    onChange?: (e: React.ChangeEvent, props: IInputChangeProperties) => void;
    onConfirm?: (e: React.KeyboardEvent, props: IInputChangeProperties) => void;
    onCancel?: (e: React.KeyboardEvent, props: IInputProperties) => void;
}

export interface IInputChangeProperties extends IInputProperties {
    value: string;
}

export class Input extends Component<IInputProperties> {

    public static defaultProps = {
        spellCheck: true,
    };

    private inputRef: React.RefObject<HTMLElement>;

    public constructor(props: IInputProperties) {
        super(props);

        this.inputRef = props.innerRef ?? React.createRef<HTMLElement>();

        this.addHandledProperties("password", "value", "textAlignment", "multiLine", "initialSelection", "spellCheck",
            "innerRef");
    }

    public componentDidMount(): void {
        const { autoFocus } = this.mergedProps;
        if (this.inputRef.current && autoFocus) {
            const element = this.inputRef.current;
            element.focus();
            if (element instanceof HTMLInputElement) {
                element.setSelectionRange(0, element.value.length);
            }
        }
    }

    public render(): React.ReactNode {
        const { password, textAlignment, value, multiLine, spellCheck } = this.mergedProps;

        const className = this.getEffectiveClassNames(["input"]);

        // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any
        const ElementType: any = multiLine ? "textarea" : "input";

        return (
            <ElementType
                ref={this.inputRef}
                onChange={this.handleChange}
                onKeyPress={this.handleKeypress}
                onKeyDown={this.handleKeyDown}
                className={className}
                type={password ? "password" : "text"}
                value={value}
                spellCheck={spellCheck}
                style={{ textAlign: textAlignment }}
                {...this.unhandledProperties}
            />
        );
    }

    private handleChange = (e: React.ChangeEvent): void => {
        const { onChange } = this.mergedProps;

        const element = e.target as HTMLInputElement;
        onChange?.(e, { ...this.mergedProps, value: element.value });
    };

    private handleKeypress = (e: React.KeyboardEvent): void => {
        const { multiLine, onConfirm } = this.mergedProps;

        if (!multiLine && keyboardKey.getCode(e) === keyboardKey.Enter) {
            const element = e.target as HTMLInputElement;
            onConfirm?.(e, { ...this.mergedProps, value: element.value });
        }
    };

    private handleKeyDown = (e: React.KeyboardEvent): void => {
        const { multiLine, onCancel } = this.mergedProps;

        // Special keys are only sent to key down, not key press.
        switch (keyboardKey.getCode(e)) {
            case keyboardKey.A: {
                if (e.metaKey && this.inputRef.current instanceof HTMLInputElement) {
                    this.inputRef.current.select();
                }
                break;
            }

            case keyboardKey.Escape: {
                onCancel?.(e, this.mergedProps);
                break;
            }

            case keyboardKey.ArrowLeft:
            case keyboardKey.ArrowRight:
            case keyboardKey.ArrowUp:
            case keyboardKey.ArrowDown: {
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
