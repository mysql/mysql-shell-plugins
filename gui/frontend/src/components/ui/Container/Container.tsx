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

import "./Container.css";

import { cloneElement, ComponentChild, VNode } from "preact";

import { ComponentBase, IComponentProperties } from "../Component/ComponentBase";
import { collectVNodes } from "../../../utilities/ts-helpers";

/** Content alignment on both the main axis and the cross axis. */
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

/**
 * The orientation determines the order and direction of child elements.
 * Not to be confused with e.g. the left-to-right writing system.
 */
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

    /** Set to false if you don't want the always visible scrollbars (default: true). */
    fixedScrollbars?: boolean;

    innerRef?: preact.RefObject<HTMLDivElement>;
}

/** A grouping element with flex layout. */
export class Container extends ComponentBase<IContainerProperties> {

    public static defaultProps = {
        orientation: Orientation.LeftToRight,
    };

    public constructor(props: IContainerProperties) {
        super(props);

        this.addHandledProperties("style", "orientation", "mainAlignment", "crossAlignment", "wrap", "scrollPosition",
            "fixedScrollbars", "innerRef");
    }

    public componentDidUpdate(): void {
        const { innerRef, scrollPosition } = this.mergedProps;

        if (scrollPosition !== undefined) {
            innerRef?.current?.scrollTo({ left: 0, top: scrollPosition });
        }
    }

    public render(): ComponentChild {
        const {
            children, style, orientation, mainAlignment, crossAlignment, data, wrap, fixedScrollbars = true, innerRef,
        } = this.mergedProps;
        const className = this.getEffectiveClassNames([
            "container",
            this.classFromProperty(fixedScrollbars, "fixedScrollbar"),
        ]);

        const newStyle = {
            flexDirection: orientation,
            justifyContent: mainAlignment,
            alignItems: crossAlignment,
            flexWrap: wrap,
            ...style,
        };

        let content = children;
        if (data && children) {
            // Template data exists. Duplicate all children and forward that data.
            // This way all children share the same data and pick their actual values using their data ID.
            const nodes = collectVNodes(children);
            content = nodes.map((child: VNode): ComponentChild => {
                return cloneElement(child, { data } as IContainerProperties);
            });
        }

        return (
            <div
                ref={innerRef}
                style={newStyle}
                className={className}

                {...this.unhandledProperties}
            >
                {content}
            </div>
        );
    }

}
