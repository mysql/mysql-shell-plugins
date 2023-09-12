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

import "./assets/ColorPicker.css";
import resetIcon from "./assets/reset.svg";

import { ComponentChild, createRef } from "preact";
import { CSSProperties } from "preact/compat";
import Color from "color";

import { Grid } from "../Grid/Grid";
import { GridCell } from "../Grid/GridCell";
import { IComponentState, ComponentBase, ComponentPlacement } from "../Component/ComponentBase";
import { Container, Orientation, ContentAlignment } from "../Container/Container";
import { Icon } from "../Icon/Icon";
import { Input, IInputChangeProperties, IInputProperties } from "../Input/Input";
import { Label } from "../Label/Label";
import { Popup } from "../Popup/Popup";
import { Slider } from "../Slider/Slider";

/** The color callback passes a color to a listener, which can return an adjusted value to be set in the popup. */
type ColorChangeCallback = (color: Color | undefined) => Color | undefined;

interface IColorPopupState extends IComponentState {
    currentColor: Color;
    isValid: boolean;
    callback?: ColorChangeCallback; // To report color changes.

    cssColorString?: string; // A temporary copy of the CSS input string.
}

export class ColorPopup extends ComponentBase<{}, IColorPopupState> {

    private static singleton: ColorPopup;

    private popupRef = createRef<Popup>();
    private handleRef = createRef<HTMLDivElement>();
    private hueRingRef = createRef<HTMLDivElement>();

    private saturationSliderRef = createRef<Slider>();
    private luminanceSliderRef = createRef<Slider>();
    private alphaSliderRef = createRef<Slider>();

    private updating = false;

    public constructor(props: {}) {
        super(props);

        this.state = {
            currentColor: new Color(),
            isValid: false,
        };

        this.addHandledProperties("initialColor");
        ColorPopup.singleton = this;
    }

    public static get instance(): ColorPopup {
        return ColorPopup.singleton;
    }

    public render(): ComponentChild {
        const { currentColor, cssColorString } = this.state;
        const className = this.getEffectiveClassNames(["colorPopup"]);

        const haveUserValue = cssColorString != null;

        const components = currentColor.hsl().array();
        if (components.length < 4) {
            components.push(1); // Make sure we have an alpha value.
        }

        /* eslint-disable @typescript-eslint/naming-convention */

        // All color settings are done using CSS variables.
        const saturationStyle: CSSProperties = {
            "--start-color": Color.hsl([components[0], 0, components[2]]).hsl().toString(),
            "--end-color": Color.hsl([components[0], 100, components[2]]).hsl().toString(),
        };

        const luminanceStyle: CSSProperties = {
            "--mid-color": Color.hsl([components[0], components[1], 50]).hsl().toString(),
        };

        const alphaStyle: CSSProperties = {
            "--start-color": Color.hsl([components[0], components[1], components[2], 0]).hsl().toString(),
            "--end-color": Color.hsl([components[0], components[1], components[2], 1]).hsl().toString(),
        };

        /* eslint-enable @typescript-eslint/naming-convention */

        return (
            <Popup
                ref={this.popupRef}
                className={className}
                placement={ComponentPlacement.BottomCenter}
                onOpen={this.handlePopupOpen}
            >
                <Container
                    className="actions"
                    orientation={Orientation.TopDown}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Icon
                        src={resetIcon}
                        onClick={(): void => { return this.color = undefined; }}
                    />
                </Container>
                <Container id="hue" orientation={Orientation.LeftToRight}>
                    <Label id="hueLabel" data-tooltip="">Hue</Label>
                    <Container
                        className="hueSlider"
                        innerRef={this.hueRingRef}
                        onPointerDown={this.handleHuePointerDown}
                        onPointerUp={this.handleHuePointerUp}
                    >
                        <div
                            ref={this.handleRef}
                            className="handle"
                        />
                    </Container>
                    <Label id="hueDataLabel">{components[0].toFixed() + "°"}</Label>
                </Container>

                <Container id="saturation" orientation={Orientation.TopDown}>
                    <Grid columns={["auto", "40px"]}>
                        <GridCell columnSpan={2}>
                            <Label caption="Saturation" />
                        </GridCell>
                        <GridCell>
                            <Slider
                                ref={this.saturationSliderRef}
                                handleSize={14}
                                value={components[1] / 100}
                                style={saturationStyle}
                                onChange={this.handleSaturationChange}
                            />
                        </GridCell>
                        <GridCell className="verticalCenterContent">
                            <Input
                                id="saturationInput"
                                value={components[1].toFixed(0)}
                                onChange={this.handleInputChange}
                            />
                            <Label caption="%" />
                        </GridCell>
                    </Grid>
                </Container>
                <Container id="luminance" orientation={Orientation.TopDown}>
                    <Grid columns={["auto", "40px"]}>
                        <GridCell columnSpan={2}>
                            <Label caption="Luminance" />
                        </GridCell>
                        <GridCell>
                            <Slider
                                ref={this.luminanceSliderRef}
                                handleSize={14}
                                value={components[2] / 100}
                                style={luminanceStyle}
                                onChange={this.handleLuminanceChange}
                            />
                        </GridCell>
                        <GridCell className="verticalCenterContent">
                            <Input
                                id="luminanceInput"
                                value={components[2].toFixed(0)}
                                onChange={this.handleInputChange}
                            />
                            <Label caption="%" />
                        </GridCell>
                    </Grid>
                </Container>

                <Container id="alpha" orientation={Orientation.TopDown}>
                    <Grid columns={["auto", "40px"]}>
                        <GridCell columnSpan={2}>
                            <Label caption="Alpha" />
                        </GridCell>
                        <GridCell>
                            <Slider
                                ref={this.alphaSliderRef}
                                handleSize={14}
                                value={components[3]}
                                style={alphaStyle}
                                onChange={this.handleAlphaChange}
                            />
                        </GridCell>
                        <GridCell orientation={Orientation.LeftToRight} className="verticalCenterContent">
                            <Input
                                id="alphaInput"
                                value={(100 * components[3]).toFixed(0)}
                                onChange={this.handleInputChange}
                            />
                            <Label caption="%" />
                        </GridCell>
                    </Grid>
                </Container>

                <Container
                    id="hexValueHost"
                    orientation={Orientation.LeftToRight}
                >
                    <Label id="hexTitle" caption="CSS Color:" />
                    <Input
                        id="hexValueInput"
                        value={haveUserValue ? cssColorString : currentColor.hexa()}
                        data-tooltip={"You can enter CSS color strings here in any valid format " +
                            "(names, RGB, HSL etc.)."}
                        onChange={this.handleCSSColorInput}
                        onBlur={this.onConfirmCSSColorInput}
                        onConfirm={this.onConfirmCSSColorInput}
                    />
                </Container>
            </Popup>
        );
    }

    public open = (currentTarget: HTMLElement, color: Color | undefined, callback: ColorChangeCallback): void => {
        this.setState({
            currentColor: color || new Color("#00000000"),
            isValid: color != null,
            cssColorString: undefined,
            callback,
        }, () => {
            this.popupRef.current?.open(currentTarget.getBoundingClientRect(),
                { closeOnPortalClick: true });
        });
    };

    public get color(): Color | undefined {
        const { currentColor, isValid } = this.state;

        return isValid ? currentColor : undefined;
    }

    public set color(color: Color | undefined) {
        const { callback } = this.state;
        color = callback?.(color);

        const isValid = color != null;
        this.setState({ currentColor: color || new Color("#00000000"), isValid, cssColorString: undefined }, () => {
            this.updateHueRing();
        });
    }

    private handlePopupOpen = (): void => {
        this.updateControls();
    };

    private handleHuePointerDown = (e: PointerEvent): void => {
        this.handleHueChange(e);

        const target = e.currentTarget as HTMLElement;
        target.onpointermove = this.handleHuePointerMove;
        target.setPointerCapture(e.pointerId);
    };

    private handleHuePointerUp = (e: PointerEvent): void => {
        const target = e.currentTarget as HTMLElement;
        target.onpointermove = null;
        target.releasePointerCapture(e.pointerId);
    };

    private handleHuePointerMove = (e: PointerEvent): void => {
        this.handleHueChange(e);
    };

    private handleAlphaChange = (value: number): void => {
        if (this.updating || !this.hueRingRef.current) {
            return;
        }

        const components = this.state.currentColor.hsl().array();
        components[3] = value;
        const newColor = Color.hsl(components);
        this.hueRingRef.current.style.setProperty("--current-color", newColor.hsl().toString());

        const { callback } = this.state;
        const replaceColor = callback?.(newColor);

        this.setState({ currentColor: replaceColor || newColor, isValid: true, cssColorString: undefined });
    };

    private handleSaturationChange = (value: number): void => {
        if (this.updating || !this.hueRingRef.current) {
            return;
        }

        const components = this.state.currentColor.hsl().array();
        components[1] = 100 * value;
        const newColor = Color.hsl(components);
        this.hueRingRef.current.style.setProperty("--current-color", newColor.hsl().toString());

        const { callback } = this.state;
        const replaceColor = callback?.(newColor);

        this.setState({ currentColor: replaceColor || newColor, isValid: true, cssColorString: undefined });
    };

    private handleInputChange = (e: InputEvent, props: IInputChangeProperties): void => {
        let value = parseInt(props.value, 10);
        if (isNaN(value)) {
            value = 0;
        }

        switch (props.id) {
            case "hueInput": {
                //this.handleHueChange(value);
                break;
            }

            case "saturationInput": {
                this.handleSaturationChange(value / 100);
                break;
            }

            case "luminanceInput": {
                this.handleLuminanceChange(value / 100);
                break;
            }

            case "alphaInput": {
                this.handleAlphaChange(value / 100);
                break;
            }

            default: {
                break;
            }
        }
    };

    private handleLuminanceChange = (value: number): void => {
        if (this.updating || !this.hueRingRef.current) {
            return;
        }

        const components = this.state.currentColor.hsl().array();
        components[2] = 100 * value;
        const newColor = Color.hsl(components);
        this.hueRingRef.current.style.setProperty("--current-color", newColor.hsl().toString());

        const { callback } = this.state;
        const replaceColor = callback?.(newColor);

        this.setState({ currentColor: replaceColor || newColor, isValid: true, cssColorString: undefined });
    };

    private handleHueChange = (e: PointerEvent): void => {
        if (this.updating || !this.hueRingRef.current || !this.handleRef.current) {
            return;
        }

        const bounds = this.hueRingRef.current.getBoundingClientRect();
        const centerX = (bounds.left + bounds.right) / 2;
        const centerY = (bounds.top + bounds.bottom) / 2;

        const dX = e.clientX - centerX;
        const dY = centerY - e.clientY;
        const angle = Math.atan2(dY, dX);

        const x = 35 * Math.cos(angle);
        const y = -35 * Math.sin(angle);
        this.handleRef.current.style.transform = `translate(${x}px, ${y}px)`;

        const hue = angle * 360 / 2 / Math.PI;
        const components = this.state.currentColor.hsl().array();
        components[0] = hue;
        const newColor = Color.hsl(components);
        this.hueRingRef.current.style.setProperty("--current-color", newColor.hsl().toString());

        const { callback } = this.state;
        const replaceColor = callback?.(newColor);

        this.setState({ currentColor: replaceColor || newColor, isValid: true, cssColorString: undefined });
    };

    private setColorString(value: string | undefined): void {
        const colorString = value ? value.trim() : "";
        if (colorString.length === 0) {
            this.color = undefined;
        } else {
            try {
                this.color = new Color(colorString);
            } catch (e) {
                this.color = new Color("orangered");
            }
        }
    }

    private updateHueRing(): void {
        const { currentColor, isValid } = this.state;

        // istanbul ignore else
        if (this.hueRingRef.current && this.handleRef.current) {
            const components = isValid ? currentColor.hsl().array() : [0, 0, 0, 0];
            const angle = components[0] * 2 * Math.PI / 360;
            const x = 35 * Math.cos(angle);
            const y = -35 * Math.sin(angle);
            this.handleRef.current.style.transform = `translate(${x}px, ${y}px)`;
            this.hueRingRef.current.style.setProperty("--current-color", currentColor.hsl().toString());
        }
    }

    /**
     * Applies the individual color component to each of the responsible react component.
     */
    private updateControls(): void {
        this.updateHueRing();

        this.updating = true;
        const { currentColor, isValid } = this.state;

        // istanbul ignore else
        if (this.saturationSliderRef.current && this.luminanceSliderRef.current && this.alphaSliderRef.current) {
            const components = isValid ? currentColor.hsl().array() : [0, 0, 0, 0];
            this.saturationSliderRef.current.value = components[1] / 100;
            this.luminanceSliderRef.current.value = components[2] / 100;
            this.alphaSliderRef.current.value = components[3] == null ? 1 : components[3];
        }
        this.updating = false;
    }

    private handleCSSColorInput = (e: InputEvent, props: IInputChangeProperties): void => {
        this.setState({ cssColorString: props.value || "" });
    };

    private onConfirmCSSColorInput = (_e: unknown, props: IInputProperties): void => {
        this.setColorString(props.value);
    };
}
