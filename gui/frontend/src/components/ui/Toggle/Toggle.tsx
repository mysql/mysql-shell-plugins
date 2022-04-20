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

import "./Toggle.css";

import React from "react";
import Color from "color";
import { isNil } from "lodash";

import { Component, IComponentProperties, CheckState, MouseEventType } from "..";
import { convertPropValue } from "../../../utilities/string-helpers";

export interface IToggleProperties extends IComponentProperties {
    checkState?: CheckState;
    disabled?: boolean;
    round?: boolean;
    caption?: string;
    value?: string | number;
    name?: string;

    borderWidth?: number;
    color?: Color;
    checkedColor?: Color;

    onChange?: (e: React.ChangeEvent<HTMLInputElement>, checkState: CheckState) => void;
}

export class Toggle extends Component<IToggleProperties> {

    public static defaultProps = {
        checkState: CheckState?.Unchecked,
        disabled: false,
        round: true,
    };

    private toggleRef = React.createRef<HTMLInputElement>();

    public constructor(props: IToggleProperties) {
        super(props);

        this.addHandledProperties("checkState", "disabled", "round", "caption", "value", "name", "size", "color",
            "checkedColor", "borderWidth");
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

    public render(): React.ReactNode {
        const { children, id, disabled, round, caption, value, name } = this.mergedProps;
        const className = this.getEffectiveClassNames([
            "toggle",
            this.classFromProperty(round, "round"),
        ]);

        let content = children;
        if (isNil(content)) {
            content = caption;
        }

        return (
            <>
                <input
                    type="checkbox"
                    ref={this.toggleRef}
                    className={className}
                    name={name}
                    value={value}
                    readOnly
                    disabled={disabled}

                    onChange={this.handleChange}

                    {...this.unhandledProperties}
                />

                <label
                    htmlFor={id as string}
                    className={className}
                >
                    {content}
                </label>
            </>
        );
    }

    protected handleMouseEvent(type: MouseEventType, e: React.MouseEvent): boolean {
        const { disabled } = this.mergedProps;

        if (disabled) {
            e.preventDefault();

            return false;
        }

        return true;
    }

    private handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const { onChange } = this.mergedProps;

        onChange?.(e,
            e.target.indeterminate
                ? CheckState.Indeterminate
                : (e.target.checked ? CheckState.Checked : CheckState.Unchecked),
        );
    };

}
