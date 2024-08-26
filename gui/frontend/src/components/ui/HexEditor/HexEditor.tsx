/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import "./HexEditor.css";

import { ComponentChild } from "preact";
// import { createRef } from "preact/compat";

import { ComponentBase, IComponentProperties, IComponentState } from "../Component/ComponentBase.js";
import { Container, Orientation } from "../Container/Container.js";

export enum HexValueGrouping {
    /** No grouping. Byte values are shown as continuos stream of hex letters. */
    None = "noGrouping",

    /** Byte values are shown with 2 nibbles each and a space char between each nibble pair. */
    Byte = "grouping1",

    /** Four consecutive nibbles are shown for every two bytes, separated by a space char. */
    Word = "grouping2",

    /** Same as Word, but 4 bytes (8 nibbles) are combined. */
    DoubleWord = "grouping4",

    /** Same as Word, but 8 bytes (16 nibbles) are combined. */
    QuadWord = "grouping8",
}

export interface IHexEditorProperties extends IComponentProperties {
    /** The data to edit. */
    value: ArrayBuffer;

    /** Determines the way how the individual bytes are shown. Defaults to DoubleWord. */
    grouping?: HexValueGrouping;

    /** If true a text box will be rendered beside the hex display and will show ASCII values for each byte. */
    showTextPane?: boolean;

    /**
     * The number of columns to display.
     * If the value is < 1 or not an integer, the number of columns is calculated automatically.
     */
    columns?: number;

    /**
     * The index into `value` that specifies the first value to show. Must be a multiple of the grouping size
     * and is automatically clamped to the range of `value`.
     */
    startOffset?: number;
}

interface IHexEditorState extends IComponentState {
    currentOffset: number;
    standardWidth: number;
    lineCount: number;
}

/**
 * An editor control to edit binary data. The display is organized in a grid with a variable number of columns.
 *
 */
export class HexEditor extends ComponentBase<IHexEditorProperties, IHexEditorState> {
    public constructor(props: IHexEditorProperties) {
        super(props);

        let currentOffset = props.startOffset ?? 0;
        if (isNaN(currentOffset) || currentOffset < 0) {
            currentOffset = 0;
        }

        if (currentOffset > props.value.byteLength) {
            currentOffset = props.value.byteLength;
        }

        this.state = {
            currentOffset,
            standardWidth: -1,
            lineCount: 20,
        };

    }

    public override componentDidMount(): void {
        this.setState({
            standardWidth: this.computeStandardWidth(),
        });
    }

    public render(): ComponentChild {
        const { grouping, value } = this.props;
        const { currentOffset, lineCount } = this.state;

        const spans: ComponentChild[] = [];
        const array = new DataView(value);

        let offset = currentOffset;
        for (let line = 0; line < lineCount; line++) {
            switch (grouping) {
                case HexValueGrouping.Byte: {
                    for (let i = 0; i < 16; i++) {
                        const hex = array.getUint8(offset).toString(16).toUpperCase().padStart(2, "0");
                        offset += 2;
                        spans.push(<span key={offset}>{hex}</span>);
                    }

                    break;
                }

                case HexValueGrouping.Word: {
                    for (let i = 0; i < 8; i++) {
                        const hex = array.getUint16(offset).toString(16).toUpperCase().padStart(4, "0");
                        offset += 2;
                        spans.push(<span key={offset}>{hex}</span>);
                    }

                    break;
                }

                case HexValueGrouping.DoubleWord: {
                    for (let i = 0; i < 4; i++) {
                        const hex = array.getUint32(offset).toString(16).toUpperCase().padStart(8, "0");
                        offset += 4;
                        spans.push(<span key={offset}>{hex}</span>);
                    }

                    break;
                }

                case HexValueGrouping.QuadWord: {
                    for (let i = 0; i < 2; i++) {
                        const hex = array.getBigUint64(offset).toString(16).toUpperCase().padStart(16, "0");
                        offset += 8;
                        spans.push(<span key={offset}>{hex}</span>);
                    }

                    break;
                }

                default: {
                    for (let i = 0; i < 16; i++) {
                        const hex = array.getUint8(offset++).toString(16).toUpperCase().padStart(2, "0");
                        spans.push(<span key={offset}>{hex}</span>);
                        offset += 16;
                    }
                    break;
                }
            }
        }

        const className = this.getEffectiveClassNames(["hexEditor", "lineWidth16", grouping]);

        return (
            <Container
                className={className}
                orientation={Orientation.LeftToRight}
            >
                <Container id="offsets" />
                <Container id="main">
                    {spans}
                </Container>
                <Container id="text" />
            </Container>
        );
    }

    /**
     * Computes the width of a string with all hex digits.
     *
     * @returns The computed width.
     */
    private computeStandardWidth(): number {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (context) {
            const metrics = context.measureText("0123456789ABCDEF");

            return metrics.width;
        }

        return 0;
    }
}
