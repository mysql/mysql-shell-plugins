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

import "./UpDown.css";

import { ComponentChild, createRef } from "preact";

import { convertPropValue } from "../../../utilities/string-helpers";
import { Container, ContentAlignment, Orientation } from "../Container/Container";
import { IInputChangeProperties, Input } from "../Input/Input";
import { clampValue } from "../../../utilities/helpers";
import { IComponentProperties, IComponentState, ComponentBase } from "../Component/ComponentBase";
import { Grid } from "../Grid/Grid";
import { GridCell } from "../Grid/GridCell";
import { TextAlignment } from "../Label/Label";
import { Button } from "../Button/Button";

export interface IUpDownProperties extends IComponentProperties {
    items?: string[];    // For any type of values, but limited to only those given here.

    min?: number;        // For numeric values only. The items property is ignored then.
    max?: number;        // Ditto.
    step?: number;       // Ditto.

    value?: string | number;
    textAlignment?: TextAlignment;

    innerRef?: preact.RefObject<HTMLDivElement>;

    // The value is either the numeric directly or the index into `items`, if that was given.
    onChange?: (value: number, props: IUpDownProperties) => void;
    onConfirm?: (value: number, props: IUpDownProperties) => void;
    onCancel?: (props: IUpDownProperties) => void;
}

export interface IUpDownState extends IComponentState {
    currentValue: number; // For non-numeric input this is the index into props.items.
    useNumeric: boolean;
    min?: number;
    max?: number;
    step: number;
}

export class UpDown extends ComponentBase<IUpDownProperties, IUpDownState> {

    public static defaultProps = {
        textAlignment: TextAlignment.End,
    };

    private innerListRef = createRef<HTMLDivElement>();
    private containerRef: preact.RefObject<HTMLDivElement>;

    public constructor(props: IUpDownProperties) {
        super(props);

        this.containerRef = props.innerRef ?? createRef<HTMLDivElement>();

        const useNumeric = props.min != null || props.max != null || props.step != null;
        let min = props.min;
        if (min != null && props.max != null) {
            min = Math.min(min, props.max);
        }

        if (useNumeric || !props.items) {
            const value = (typeof (props.value) === "string")
                ? parseInt(props.value, 10)
                : props.value || 0;

            this.state = {
                currentValue: clampValue(value, props.min, props.max),
                useNumeric: true,
                min,
                max: props.max,
                step: props.step || 1,
            };
        } else {
            const value = props.value || props.items[0];
            const index = props.items.findIndex((entry: string) => {
                return entry === value;
            });

            this.state = {
                currentValue: index,
                useNumeric: false,
                min: 0,
                max: props.items.length - 1,
                step: 1,
            };
        }

        this.addHandledProperties("items", "min", "max", "onChange", "initialValue", "textAlignment", "innerRef");
    }

    public componentDidMount(): void {
        // Now that we know the control's height we can update the height of the items.
        if (this.containerRef.current) {
            this.containerRef.current.style.setProperty("--item-height",
                convertPropValue(this.containerRef.current.clientHeight)!);
        }
    }

    public render(): ComponentChild {
        const { items = [], textAlignment } = this.mergedProps;
        const { currentValue, useNumeric } = this.state;

        const className = this.getEffectiveClassNames(["upDown"]);

        let content;
        if (useNumeric) {
            content = <Input
                key="upDownInput"
                value={currentValue.toString()}
                onChange={this.handleInputChange}
                onConfirm={this.handleInputConfirm}
                onCancel={this.handleInputCancel}
                textAlignment={textAlignment}
            />;
        } else {
            const entries = items.map((item: string): ComponentChild => {
                return <Container
                    key={item}
                    mainAlignment={ContentAlignment.Center}
                    crossAlignment={ContentAlignment.Center}
                >
                    {item}
                </Container>;
            },
            );

            content = <Container
                id="outerList"
                key="outerList"
                tabIndex={0}
            >
                <Container
                    innerRef={this.innerListRef}
                    id="innerList"
                    key="innerList"
                    orientation={Orientation.TopDown}>
                    {entries}
                </Container>
            </Container>;
        }

        return (
            <Grid
                key="upDownMain"
                innerRef={this.containerRef}
                className={className}
                columns={["auto", 16]}
                {...this.unhandledProperties}
            >
                <GridCell
                    id="content"
                    key="upDownContent"
                    rowSpan={2}
                >
                    {content}
                </GridCell>
                <GridCell>
                    <Button
                        id="up"
                        key="upButton"
                        onClick={this.handleButtonClick}
                        tabIndex={-1}
                    />
                </GridCell>
                <GridCell>
                    <Button
                        id="down"
                        key="downButton"
                        onClick={this.handleButtonClick}
                        tabIndex={-1}
                    />
                </GridCell>
            </Grid>
        );
    }

    private handleButtonClick = (e: MouseEvent | KeyboardEvent, props: IComponentProperties): void => {
        const { step } = this.state;
        this.stepValue(props.id === "up" ? step : -step);
    };

    private stepValue = (amount: number): void => {
        const { onChange } = this.mergedProps;
        const { currentValue, min, max, useNumeric } = this.state;

        const newValue = clampValue(currentValue + amount, min, max);
        onChange?.(newValue, this.props);
        this.setState({ currentValue: newValue });

        if (!useNumeric && this.innerListRef.current) {
            const itemHeight = this.containerRef.current?.clientHeight || 0;

            // Subtract one for the top border.
            this.innerListRef.current.style.top = convertPropValue(-newValue * itemHeight - 1)!;
        }
    };

    private handleInputChange = (e: InputEvent, props: IInputChangeProperties): void => {
        const { onChange } = this.mergedProps;
        const { min, max } = this.state;

        // This handler is only called for numeric up/down controls.
        let newValue = parseInt(props.value, 10);
        if (isNaN(newValue)) {
            newValue = 0;
        }

        onChange?.(newValue, this.props);
        this.setState({ currentValue: clampValue(newValue, min, max) });
    };

    private handleInputConfirm = (): void => {
        const { onConfirm } = this.mergedProps;
        const { currentValue } = this.state;

        onConfirm?.(currentValue, this.props);
    };

    private handleInputCancel = (): void => {
        const { onCancel } = this.mergedProps;

        onCancel?.(this.props);
    };
}
