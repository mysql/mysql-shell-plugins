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

import "./Container.css";

import React from "react";

import { Component, IComponentProperties, IComponentState } from "../Component/Component";

// Content alignment on the main axis and the cross axis.
export enum ContentAlignment {
    Start = "flex-start",
    Center = "center",
    End = "flex-end",
    Stretch = "stretch",
    SpaceBetween = "space-between",
    SpaceEvenly = "space-evenly",
}

export enum ContentWrap {
    NoWrap = "nowrap",
    Wrap = "wrap",
    WrapReverse = "wrap-reverse",
}

// The orientation determines the order and direction of child elements.
// Not to be confused with e.g. the left-to-right writing system.
export enum Orientation {
    TopDown = "column",
    BottomUp = "column-reverse",
    LeftToRight = "row",
    RightToLeft = "row-reverse",
}

export interface IContainerProperties extends IComponentProperties {
    orientation?: Orientation;
    mainAlignment?: ContentAlignment;
    crossAlignment?: ContentAlignment;
    wrap?: ContentWrap;
    scrollPosition?: number;

    innerRef?: React.RefObject<HTMLElement>;
}

// A grouping element with flex layout.
export class Container<
    P extends IContainerProperties = {},
    S extends IComponentState = {},
    SS = unknown> extends Component<P, S, SS> {

    public static defaultProps = {
        orientation: Orientation.LeftToRight,
    };

    public constructor(props: P) {
        super(props);

        this.addHandledProperties("style", "orientation", "mainAlignment", "crossAlignment", "wrap", "innerRef",
            "scrollPosition");
    }

    public componentDidUpdate(): void {
        const { innerRef, scrollPosition } = this.mergedProps;

        if (scrollPosition !== undefined) {
            innerRef?.current?.scrollTo({ left: 0, top: scrollPosition });
        }
    }

    public render(): React.ReactNode {
        const { children, style, orientation, mainAlignment, crossAlignment, data, wrap, innerRef } = this.mergedProps;
        const className = this.getEffectiveClassNames(["container fixedScrollbar"]);

        // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any
        const ElementType: any = this.renderAs();

        const newStyle = {
            flexDirection: orientation,
            justifyContent: mainAlignment,
            alignItems: crossAlignment,
            flexWrap: wrap,
            ...style,
        };

        let content = children;
        if (data) {
            // Template data exists. Duplicate all children and forward that data.
            // This way all children share the same data and pick their actual values using their data ID.
            content = React.Children.map(children, (child: React.ReactNode): React.ReactNode => {
                if (React.isValidElement(child)) {
                    return React.cloneElement(child, { data });
                } else {
                    return undefined;
                }
            });
        }

        return (
            <ElementType
                ref={innerRef}
                style={newStyle}
                className={className}

                {...this.unhandledProperties}
            >
                {content}
            </ElementType>
        );
    }

}
