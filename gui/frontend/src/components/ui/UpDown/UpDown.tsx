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

import "./UpDown.css";

import { ComponentChild, createRef } from "preact";

import { convertPropValue } from "../../../utilities/string-helpers.js";
import { Container, ContentAlignment, Orientation } from "../Container/Container.js";
import { IInputChangeProperties, Input } from "../Input/Input.js";
import { clampValue, minValue } from "../../../utilities/helpers.js";
import { IComponentProperties, IComponentState, ComponentBase } from "../Component/ComponentBase.js";
import { Grid } from "../Grid/Grid.js";
import { GridCell } from "../Grid/GridCell.js";
import { TextAlignment } from "../Label/Label.js";
import { Button } from "../Button/Button.js";

export interface IUpDownProperties<ValueType extends string | number | bigint> extends IComponentProperties {
    /** For any type of values, but limited to only those given here. */
    items?: string[];

    /** The minimal value that can be entered. For numeric values only. The items property is ignored then. */
    min?: Exclude<ValueType, string> | number;

    /** The maximal value that can be entered. For numeric values only. The items property is ignored then. */
    max?: Exclude<ValueType, string> | number;

    /**
     * The value for one step when using the arrow buttons.
     * For numeric values only. The items property is ignored then.
     */
    step?: Exclude<ValueType, string> | number;

    value?: ValueType;
    textAlignment?: TextAlignment;

    innerRef?: preact.RefObject<HTMLDivElement>;

    onChange?: (value: ValueType, props: IUpDownProperties<ValueType>) => void;

    onConfirm?: (value: ValueType, props: IUpDownProperties<ValueType>) => void;

    onCancel?: (props: IUpDownProperties<ValueType>) => void;
}

export interface IUpDownState extends IComponentState {
    currentValue: number | bigint; // For non-numeric input this is the index into props.items.
    useNumeric: boolean;

}

export class UpDown<ValueType extends string | number | bigint>
    extends ComponentBase<IUpDownProperties<ValueType>, IUpDownState> {

    public static defaultProps = {
        textAlignment: TextAlignment.End,
    };

    private innerListRef = createRef<HTMLDivElement>();
    private containerRef: preact.RefObject<HTMLDivElement>;

    public constructor(props: IUpDownProperties<ValueType>) {
        super(props);

        this.containerRef = props.innerRef ?? createRef<HTMLDivElement>();

        const useNumeric = typeof props.value === "number" || typeof props.value === "bigint";
        let min = props.min;
        if (min != null && props.max != null && typeof min !== "string") {
            min = minValue(min, props.max);
        }

        if (useNumeric || !props.items) {
            const value: number | bigint = (typeof props.value === "string")
                ? parseInt(props.value, 10)
                : props.value ?? 0;

            this.state = {
                currentValue: clampValue(value, props.min, props.max),
                useNumeric: true,
            };
        } else {
            const value = props.value || props.items[0];
            const index = props.items.findIndex((entry: string) => {
                return entry === value;
            });

            this.state = {
                currentValue: index,
                useNumeric: false,
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
                id="upDownInput"
                autoFocus={true}
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
        const { step = 1 } = this.mergedProps;
        this.stepValue(props.id === "up" ? step : -step);
        e.preventDefault();
    };

    private stepValue = (amount: number | bigint): void => {
        const { onChange, min, max } = this.mergedProps;
        const { currentValue, useNumeric } = this.state;

        let newValue;
        if (typeof currentValue === "bigint") {
            newValue = clampValue(currentValue + BigInt(amount), min as bigint, max as bigint);
            onChange?.(newValue as ValueType, this.props);
            this.setState({ currentValue: newValue });
        } else {
            newValue = clampValue(currentValue + Number(amount), min as number, max as number);
            onChange?.(newValue as ValueType, this.props);
            this.setState({ currentValue: newValue });
        }

        if (!useNumeric && this.innerListRef.current) {
            const itemHeight = this.containerRef.current?.clientHeight ?? 0;

            // Subtract one for the top border.
            this.innerListRef.current.style.top = convertPropValue(-Number(newValue) * itemHeight - 1)!;
        }
    };

    private handleInputChange = (e: InputEvent, props: IInputChangeProperties): void => {
        const { onChange, value, min, max } = this.mergedProps;

        // This handler is only called for numeric up/down controls.
        let newValue;
        let minValue;
        let maxValue;
        if (typeof value === "bigint") {
            newValue = BigInt(props.value);
            minValue = min != null ? BigInt(min) : undefined;
            maxValue = max != null ? BigInt(max) : undefined;
            onChange?.(newValue as ValueType, this.props);
            this.setState({ currentValue: clampValue(newValue, minValue, maxValue) });
        } else {
            newValue = parseInt(props.value, 10);
            if (isNaN(newValue)) {
                newValue = 0;
            }
            minValue = min != null ? Number(min) : undefined;
            maxValue = max != null ? Number(max) : undefined;
        }

        onChange?.(newValue as ValueType, this.props);
        this.setState({ currentValue: clampValue(newValue, minValue, maxValue) });
    };

    private handleInputConfirm = (): void => {
        const { onConfirm } = this.mergedProps;
        const { currentValue } = this.state;

        onConfirm?.(currentValue as ValueType, this.props);
    };

    private handleInputCancel = (): void => {
        const { onCancel } = this.mergedProps;

        onCancel?.(this.props);
    };
}
