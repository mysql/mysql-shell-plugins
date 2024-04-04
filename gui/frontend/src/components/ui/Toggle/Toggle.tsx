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

import "./Toggle.css";

import Color from "color";
import { ComponentChild, createRef } from "preact";

import { convertPropValue } from "../../../utilities/string-helpers.js";
import { CheckState } from "../Checkbox/Checkbox.js";
import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";

export interface IToggleProperties extends IComponentProperties {
    checkState?: CheckState;
    disabled?: boolean;
    round?: boolean;
    caption?: string;

    borderWidth?: number;
    color?: Color;
    checkedColor?: Color;

    onChange?: (e: InputEvent, checkState: CheckState) => void;
}

export class Toggle extends ComponentBase<IToggleProperties> {

    public static defaultProps = {
        checkState: CheckState?.Unchecked,
        disabled: false,
        round: true,
    };

    private toggleRef = createRef<HTMLInputElement>();

    public constructor(props: IToggleProperties) {
        super(props);

        this.addHandledProperties("checkState", "disabled", "round", "caption", "borderWidth", "color",
            "checkedColor", "onChange");
    }

    public componentDidMount(): void {
        if (this.toggleRef.current) {
            const { color, checkedColor, borderWidth, checkState } = this.mergedProps;

            if (color) {
                const hsl = color.hsl();
                (this.toggleRef.current.nextElementSibling! as HTMLElement)
                    .style.setProperty("--toggle-color", `${hsl.hue()}, ${hsl.saturationl()}%, ${hsl.lightness()}%`);
            }
            if (checkedColor) {
                const hsl = checkedColor.hsl();
                (this.toggleRef.current.nextElementSibling! as HTMLElement).style.setProperty("--toggle-checked-color",
                    `${hsl.hue()}, ${hsl.saturationl()}%, ${hsl.lightness()}%`);
            }
            if (borderWidth) {
                (this.toggleRef.current.nextElementSibling! as HTMLElement)
                    .style.setProperty("--toggle-border-width", convertPropValue(borderWidth)!);
            }

            this.toggleRef.current.checked = checkState === CheckState.Checked;
        }
    }

    public componentDidUpdate(): void {
        if (this.toggleRef.current) {
            const { checkState } = this.mergedProps;

            this.toggleRef.current.checked = checkState === CheckState.Checked;
        }
    }

    public render(): ComponentChild {
        const { children, id = "", disabled, round, caption } = this.mergedProps;
        const className = this.getEffectiveClassNames([
            "toggle",
            this.classFromProperty(round, "round"),
        ]);

        let content = children;
        if (content == null) {
            content = caption;
        }

        return (
            <>
                <input
                    type="checkbox"
                    id={id}
                    ref={this.toggleRef}
                    className={className}
                    readOnly

                    onInput={this.handleInput}

                    {...this.unhandledProperties}
                />

                <label
                    htmlFor={id}
                    className={className}
                    tabIndex={0}
                    disabled={disabled}
                    onClick={this.handleClick}
                    onKeyPress={this.handleInput}
                >
                    {content}
                </label>
            </>
        );
    }

    private handleClick = (e: MouseEvent): void => {
        const { disabled } = this.mergedProps;

        if (disabled) {
            e.preventDefault();

            return;
        }

        this.handleInput(e);
    };

    private handleInput = (e: Event): void => {
        if (e.target) {
            const { onChange } = this.mergedProps;

            e.preventDefault();
            const element = e.target as HTMLInputElement;
            onChange?.(e as InputEvent,
                element.indeterminate
                    ? CheckState.Indeterminate
                    : (element.checked ? CheckState.Checked : CheckState.Unchecked),
            );
        }
    };

}
