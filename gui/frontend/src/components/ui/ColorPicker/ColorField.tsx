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

import emptyHatch from "./assets/empty-hatch.svg";

import { ComponentChild } from "preact";
import { CSSProperties } from "preact/compat";
import Color from "color";

import { ColorPopup } from "./ColorPopup.js";
import { Image } from "../Image/Image.js";
import { IComponentProperties, IComponentState, ComponentBase, DragEventType } from "../Component/ComponentBase.js";
import { deepEqual } from "../../../utilities/helpers.js";

export interface IColorFieldProperties extends IComponentProperties {
    initialColor?: Color; // The color to show. If not given a hatch pattern is shown instead.

    onChange?: (color: Color | undefined, props: IColorFieldProperties) => void;
}

interface IColorFieldState extends IComponentState {
    originalColor?: Color;
    currentColor?: Color;
}

// A small area showing a single color, which can be dragged around and dropped on other color fields
// to copy their colors.
export class ColorField extends ComponentBase<IColorFieldProperties, IColorFieldState> {

    public constructor(props: IColorFieldProperties) {
        super(props);

        this.state = {};

        this.addHandledProperties("initialColor");
        this.connectDragEvents();
    }

    public static override getDerivedStateFromProps(newProps: IColorFieldProperties,
        state: IColorFieldState): IColorFieldState {
        const newColor = newProps.initialColor?.unitArray() || [];
        const oldColor = state.originalColor?.unitArray() || [];
        if (!deepEqual(newColor, oldColor)) {
            return {
                originalColor: newProps.initialColor,
                currentColor: newProps.initialColor,
            };
        }

        return {};
    }

    public render(): ComponentChild {
        const { id } = this.props;
        const { currentColor } = this.state;

        const className = this.getEffectiveClassNames([
            "colorField",
            currentColor ? "" : " invalid",
        ]);

        const style: CSSProperties = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "--current-color": currentColor?.hsl().toString(),
        };

        let content;
        if (currentColor) {
            content = <div
                className="inner"
                style={style}
            />;
        } else {
            content = <Image
                className="inner"
                src={emptyHatch}
            />;
        }

        return (
            <div
                id={id}
                role="button"
                className={className}
                tabIndex={0}
                draggable
                onKeyDown={this.handleFieldKeyDown}
                onClick={this.handleClick}
                {...this.unhandledProperties}
            >
                {content}
            </div>
        );
    }

    protected override handleDragEvent(type: DragEventType, e: DragEvent): boolean {
        const element = e.currentTarget as HTMLElement;
        switch (type) {
            case DragEventType.Start: {
                const { currentColor } = this.state;
                if (currentColor) {
                    e.dataTransfer?.setData("text", currentColor.hsl().toString());
                } else {
                    e.dataTransfer?.setData("text", "");
                }
                e.stopPropagation();
                break;
            }

            case DragEventType.Over: {
                e.stopPropagation();
                e.preventDefault();
                break;
            }

            case DragEventType.Enter: {
                element.classList.add("dropTarget");
                break;
            }

            case DragEventType.Leave: {
                element.classList.remove("dropTarget");
                break;
            }

            case DragEventType.Drop: {
                e.preventDefault();
                element.classList.remove("dropTarget");

                const value = e.dataTransfer?.getData("text");
                if (value && value.length > 0) {
                    const newColor = new Color(value);
                    this.setState({ currentColor: newColor });
                    this.props.onChange?.(newColor, this.props);
                } else {
                    this.setState({ currentColor: undefined });
                    this.props.onChange?.(undefined, this.props);
                }


                break;
            }

            default:
        }

        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private handleFieldKeyDown = (e: KeyboardEvent): void => {
        // TODO: implementation
    };

    private handleClick = (e: MouseEvent): void => {
        if (e.button === 0) {
            const { currentColor, originalColor } = this.state;
            ColorPopup.instance.open(e.currentTarget as HTMLElement, currentColor,
                (color?: Color): Color | undefined => {
                    if (!color) {
                        // An unassigned color means we have to reset it to the original color.
                        color = originalColor;
                    }

                    this.setState({ currentColor: color }, () => {
                        this.props.onChange?.(color, this.props);
                    });

                    return color;
                },
            );
        }
    };

}
