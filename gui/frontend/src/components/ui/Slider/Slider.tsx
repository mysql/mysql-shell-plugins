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

import "./Slider.css";

import { ComponentChild, createRef } from "preact";

import { clampValue } from "../../../utilities/helpers.js";
import { IComponentProperties, ComponentBase, PointerEventType } from "../Component/ComponentBase.js";
import { Container, Orientation } from "../Container/Container.js";

interface ISliderProperties extends IComponentProperties {
    value: number;
    vertical?: boolean;
    handleSize?: number;

    onChange?: (value: number) => void;
}

export class Slider extends ComponentBase<ISliderProperties> {

    public static override defaultProps = {
        disabled: false,
        vertical: false,
        handleSize: 20,
    };

    private sliderRef = createRef<HTMLInputElement>();

    public constructor(props: ISliderProperties) {
        super(props);

        this.addHandledProperties("value", "vertical", "handleSize");

        this.connectEvents("onPointerDown", "onPointerUp");
    }

    public set value(newValue: number) {
        const { onChange } = this.mergedProps;

        newValue = clampValue(newValue, 0, 1);
        this.setState({ currentValue: newValue });

        if (this.sliderRef?.current) {
            this.sliderRef.current.style.setProperty("--current-value", `${100 * newValue}%`);
        }

        onChange?.(newValue);
    }

    public override componentDidUpdate(): void {
        const { value, handleSize } = this.mergedProps;

        if (this.sliderRef.current) {
            this.sliderRef.current.style.setProperty("--current-value", `${100 * value}%`);
            this.sliderRef.current.style.setProperty("--handle-size", `${handleSize ?? 0}px`);
        }
    }

    public render(): ComponentChild {
        const { vertical } = this.mergedProps;
        const className = this.getEffectiveClassNames([
            "slider",
            this.classFromProperty(vertical, "vertical"),
        ]);

        return (
            <div
                ref={this.sliderRef}
                className={className}
                {...this.unhandledProperties}
            >
                <Container // Slider body.
                    className="body"
                    orientation={vertical ? Orientation.TopDown : Orientation.LeftToRight}
                >
                    <div
                        className="handle"
                    />
                </Container>
            </div>
        );
    }

    protected override handlePointerEvent(type: PointerEventType, e: PointerEvent): boolean {
        switch (type) {
            case PointerEventType.Down: {
                this.handleItemPointerMove(e);

                const target = e.currentTarget as HTMLElement;
                target.onpointermove = this.handleItemPointerMove;
                target.setPointerCapture(e.pointerId);

                break;
            }

            case PointerEventType.Up: {
                const target = e.currentTarget as HTMLElement;
                target.onpointermove = null;
                target.releasePointerCapture(e.pointerId);

                break;
            }

            default: {
                break;
            }
        }

        return true;
    }

    private handleItemPointerMove = (e: PointerEvent): void => {
        if (this.sliderRef.current) {
            const { vertical, onChange } = this.mergedProps;

            const bounds = this.sliderRef.current.getBoundingClientRect();
            let value;
            if (vertical) {
                value = clampValue((e.clientY - bounds.y) / bounds.height, 0, 1);
            } else {
                value = clampValue((e.clientX - bounds.x) / bounds.width, 0, 1);
            }

            this.sliderRef.current.style.setProperty("--current-value", `${100 * value}%`);

            onChange?.(value);
        }
    };
}
