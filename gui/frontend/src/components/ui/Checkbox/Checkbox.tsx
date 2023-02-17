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

import "./Checkbox.css";

import { ComponentChild } from "preact";
import keyboardKey from "keyboard-key";

import { IComponentProperties, ComponentBase, MouseEventType } from "../Component/ComponentBase";

export enum CheckState {
    Unchecked,
    Checked,
    Indeterminate,
}

export interface ICheckboxProperties extends IComponentProperties {
    checkState?: CheckState;
    disabled?: boolean;
    caption?: string;

    onChange?: (checkState: CheckState, props: ICheckboxProperties) => void;
}

export class Checkbox extends ComponentBase<ICheckboxProperties> {

    public static defaultProps = {
        checkState: CheckState?.Unchecked,
        disabled: false,
    };

    public constructor(props: ICheckboxProperties) {
        super(props);

        this.addHandledProperties("checkState", "caption", "disabled", "onChange", "dataId");
        this.connectEvents("onClick");
    }

    public render(): ComponentChild {
        const { children, caption, disabled, checkState } = this.mergedProps;

        const className = this.getEffectiveClassNames([
            "checkbox",
            this.classFromProperty(checkState, ["unchecked", "checked", "indeterminate"]),
            this.classFromProperty(disabled, "disabled"),
        ]);
        const content = caption || children;

        return (
            <label
                className={className}
                tabIndex={0}
                onKeyPress={this.handleKeyPress}
                {...this.unhandledProperties}
            >
                <span className="checkMark" />
                {content}
            </label>
        );
    }

    protected handleMouseEvent(type: MouseEventType, e: MouseEvent): boolean {
        const { disabled } = this.mergedProps;
        if (disabled) {
            e.preventDefault();

            return false;
        }

        if (type === MouseEventType.Click) {
            this.toggleCheckState();
        }

        return true;
    }

    private handleKeyPress = (e: KeyboardEvent): void => {
        const { disabled } = this.mergedProps;
        if (disabled) {
            e.preventDefault();

            return;
        }

        if (keyboardKey.getCode(e) === keyboardKey.Spacebar || keyboardKey.getCode(e) === keyboardKey.Enter) {
            this.toggleCheckState();
            e.preventDefault();
        }
    };

    private toggleCheckState(): void {
        const { onChange, checkState } = this.mergedProps;

        let newState;
        switch (checkState) {
            case CheckState.Unchecked: {
                newState = CheckState.Checked;
                break;
            }

            case CheckState.Indeterminate: {
                newState = CheckState.Checked;
                break;
            }

            default: { // Checked.
                newState = CheckState.Unchecked;
                break;
            }
        }

        onChange?.(newState, this.mergedProps);
    }

}
