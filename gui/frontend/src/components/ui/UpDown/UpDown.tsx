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

import "./UpDown.css";

import { ComponentChild, createRef } from "preact";

import { convertPropValue } from "../../../utilities/string-helpers.js";
import { Input } from "../Input/Input.js";
import { clampValue } from "../../../utilities/helpers.js";
import { IComponentProperties, IComponentState, ComponentBase } from "../Component/ComponentBase.js";
import { Grid } from "../Grid/Grid.js";
import { GridCell } from "../Grid/GridCell.js";
import { TextAlignment } from "../Label/Label.js";
import { Button } from "../Button/Button.js";

export interface IUpDownProperties<ValueType extends string | null | number | bigint | undefined>
    extends IComponentProperties {
    /** The minimal value that can be entered. For numeric values only. The items property is ignored then. */
    min?: number | bigint;

    /** The maximal value that can be entered. For numeric values only. The items property is ignored then. */
    max?: number | bigint;

    /**
     * The value for one step when using the arrow buttons.
     * For numeric values only. The items property is ignored then.
     */
    step?: number;

    value?: ValueType;
    textAlignment?: TextAlignment;
    placeholder?: ValueType

    nullable?: boolean;

    innerRef?: preact.RefObject<HTMLDivElement>;

    onChange: (value: ValueType, props: IUpDownProperties<ValueType>) => void;

    onConfirm?: (value: ValueType, props: IUpDownProperties<ValueType>) => void;

    onCancel?: (props: IUpDownProperties<ValueType>) => void;
}

export interface IUpDownState extends IComponentState {
    currentValue: string | null | number | bigint;
    missingInitialValue?: boolean;
}

const parseNumber = (value?: string | null, nullable?: boolean): number | bigint | null => {
    const defaultValue = nullable ? null : 0;
    if (value === undefined || value === null || value === "") {
        return defaultValue;
    }

    // If it's an integer and exceeds safe number range, use BigInt.
    if (/^\d+$/.test(value)) {
        const big = BigInt(value);
        if (big > BigInt(Number.MAX_SAFE_INTEGER)) {
            return big;
        }

        return Number(value);
    }

    // Try to parse as regular number (decimal or scientific notation).
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber)) {
        return asNumber;
    }

    // Could not parse.
    return defaultValue;
};

const isNumberOrBigInt = (value: unknown): value is number | bigint => {
    return typeof value === "number" || typeof value === "bigint";
};

export class UpDown<ValueType extends string | null | number | bigint>
    extends ComponentBase<IUpDownProperties<ValueType>, IUpDownState> {

    public static override defaultProps = {
        textAlignment: TextAlignment.End,
    };

    private containerRef: preact.RefObject<HTMLDivElement>;

    public constructor(props: IUpDownProperties<ValueType>) {
        super(props);

        this.containerRef = props.innerRef ?? createRef<HTMLDivElement>();

        this.addHandledProperties("items", "min", "max", "onChange", "initialValue", "textAlignment", "innerRef");
    }

    public static override getDerivedStateFromProps(props: Readonly<IUpDownProperties<string | null | number | bigint>>,
        state: Readonly<IUpDownState>): IUpDownState | null {
        const { value, min, max } = props;

        if (value === undefined && state.missingInitialValue === undefined) {
            // This occurs only during the initial render.
            return { currentValue: null, missingInitialValue: true };
        }

        const nullable = props.nullable || state.missingInitialValue === true;
        const currentValue = isNumberOrBigInt(value) ? value : parseNumber(value, nullable);
        if (currentValue === state.currentValue) {
            // No updates to the state are required.
            return null;
        }

        return {
            currentValue: currentValue === null ? null : clampValue(currentValue, min, max),
        };
    }

    public override componentDidMount(): void {
        // Now that we know the control's height we can update the height of the items.
        if (this.containerRef.current) {
            this.containerRef.current.style.setProperty("--item-height",
                convertPropValue(this.containerRef.current.clientHeight)!);
        }
    }

    public render(): ComponentChild {
        const { textAlignment, placeholder } = this.props;
        const { currentValue } = this.state;

        const className = this.getEffectiveClassNames(["upDown"]);

        const content = (
            <Input
                id="upDownInput"
                autoFocus={true}
                value={currentValue?.toString()}
                onChange={this.handleInputChange}
                onConfirm={this.handleInputConfirm}
                onCancel={this.handleInputCancel}
                textAlignment={textAlignment}
                placeholder={placeholder?.toString()}
            />
        );

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
        const { step = 1 } = this.props;
        this.stepValue(props.id === "up" ? step : -step);
        e.preventDefault();
    };

    private stepValue = (amount: number): void => {
        const { onChange } = this.props;
        const { currentValue } = this.state;

        let newValue;
        if (typeof currentValue === "bigint") {
            newValue = currentValue + BigInt(amount);
        } else if (currentValue === null || typeof currentValue === "number") {
            newValue = (currentValue ?? 0) + amount;
        }

        onChange?.(newValue as ValueType, this.props);
    };

    private handleInputChange = (e: InputEvent): void => {
        const { onChange } = this.props;
        const currentValue = (e.target as HTMLInputElement)?.value;

        onChange?.(currentValue as ValueType, this.props);
    };

    private handleInputConfirm = (): void => {
        const { onConfirm } = this.props;
        const { currentValue } = this.state;

        onConfirm?.(currentValue as ValueType, this.props);
    };

    private handleInputCancel = (): void => {
        const { onCancel } = this.props;

        onCancel?.(this.props);
    };
}
