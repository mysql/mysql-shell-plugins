/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import "./Checkbox.css";

import { ComponentChild, createRef } from "preact";

import { IComponentProperties, ComponentBase, MouseEventType } from "../Component/ComponentBase.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";

export enum CheckState {
    Unchecked,
    Checked,
    Indeterminate,
}

export interface ICheckboxProperties extends IComponentProperties {
    checkState?: CheckState;
    disabled?: boolean;
    caption?: string;

    /** Allows the parent component to handle onClick or Space/Enter key toggling. */
    ignoreExternalEvents?: boolean;

    onChange?: (checkState: CheckState, props: ICheckboxProperties) => void;
}

export class Checkbox extends ComponentBase<ICheckboxProperties> {

    public static override readonly defaultProps = {
        checkState: CheckState.Unchecked,
        disabled: false,
    };

    #labelRef = createRef<HTMLLabelElement & { value: unknown; }>();

    public constructor(props: ICheckboxProperties) {
        super(props);

        this.addHandledProperties("checkState", "caption", "disabled", "onChange", "ignoreExternalEvents");
        if (!props.ignoreExternalEvents) {
            this.connectEvents("onClick");
        }
    }

    public override componentDidMount(): void {
        const { checkState } = this.props;
        if (this.#labelRef.current) {
            this.#labelRef.current.value = checkState;
        }
    }

    public render(): ComponentChild {
        const { children, caption, disabled, checkState, ignoreExternalEvents } = this.props;

        const className = this.getEffectiveClassNames([
            "checkbox",
            this.classFromProperty(checkState, ["unchecked", "checked", "indeterminate"]),
            this.classFromProperty(disabled, "disabled"),
        ]);
        const content = caption || children;

        return (
            <label
                ref={this.#labelRef}
                className={className}
                tabIndex={!ignoreExternalEvents ? 0 : undefined}
                onKeyPress={this.handleKeyPress}
                {...this.unhandledProperties}
            >
                <span className="checkMark" />
                {content}
            </label>
        );
    }

    protected override handleMouseEvent(type: MouseEventType, e: MouseEvent): boolean {
        const { disabled } = this.props;
        if (this.props.ignoreExternalEvents || disabled) {
            e.preventDefault();

            return false;
        }

        if (type === MouseEventType.Click || type === MouseEventType.DoubleClick) {
            e.stopImmediatePropagation();
            this.toggleCheckState();
        }

        return true;
    }

    private handleKeyPress = (e: KeyboardEvent): void => {
        const { disabled } = this.props;
        if (this.props.ignoreExternalEvents || disabled) {
            e.preventDefault();

            return;
        }

        if (e.key === KeyboardKeys.Space || e.key === KeyboardKeys.Enter) {
            this.toggleCheckState();
            e.preventDefault();
        }
    };

    private toggleCheckState(): void {
        const { onChange, checkState } = this.props;

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

        if (this.#labelRef.current) {
            this.#labelRef.current.value = newState;
        }

        onChange?.(newState, this.props);
    }

}
