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

import "./Tooltip.css";

import React from "react";
import keyboardKey from "keyboard-key";

import { Component, IComponentState, IComponentProperties, Container } from "..";
import { createPortal } from "preact/compat";
import { computeContentPosition } from "../Tools/HTMLHelpers";
import { ComponentPlacement } from "../Component/Component";
import { IDictionary } from "../../../app-logic/Types";

export interface ITooltipProviderProperties extends IComponentProperties {
    showDelay?: number; // In milliseconds.
}

interface ITooltipProviderState extends IComponentState {
    target?: HTMLElement;
    mouse: DOMPoint;
    tooltip?: string;
}

// A component to render a tooltip on other components with a "data-tooltip" attribute.
export class TooltipProvider extends Component<ITooltipProviderProperties, ITooltipProviderState> {

    public static defaultProps = {
        showDelay: 200,
    };

    private tooltipTimer: ReturnType<typeof setTimeout>;
    private innerRef = React.createRef<HTMLElement>();

    public constructor(props: ITooltipProviderProperties) {
        super(props);

        this.state = {
            mouse: new DOMPoint(),
        };
        this.addHandledProperties("showDelay", "style");
    }

    public componentDidMount(): void {
        document.body.addEventListener("mouseover", this.elementMouseOver, false); // Mouse enter doesn't work here.
        document.body.addEventListener("keyup", this.handleDocumentKeyUp);
    }

    public componentWillUnmount(): void {
        clearTimeout(this.tooltipTimer);
        clearTimeout(this.tooltipTimer);

        document.body.removeEventListener("keyup", this.handleDocumentKeyUp);
        document.body.removeEventListener("mouseover", this.elementMouseOver);
    }

    public componentDidUpdate(): void {
        const { tooltip, target, mouse } = this.state;

        if (this.innerRef.current && target) {
            let x = 0;
            let y = 0;
            if (tooltip === "expand") {
                // A tooltip that shows shortened text in full.
                const bounds = target.getBoundingClientRect();
                x = bounds.left - 7;
                y = bounds.top - 4;
            } else {
                // A normal tooltip with fixed text given in the HTML element.
                const { left, top } = computeContentPosition(ComponentPlacement.BottomLeft, this.innerRef.current,
                    new DOMRect(mouse.x, mouse.y, 1, 1), 0, true);

                x = left + 16;
                y = top + 16;
            }

            this.innerRef.current.style.transform = `translate(${x}px, ${y}px)`;
        }
    }

    public render(): React.ReactNode {
        const { style } = this.mergedProps;
        const { target, tooltip } = this.state;

        if (!target) {
            return null;
        }

        let content = tooltip;
        const composedStyle: IDictionary = { ...style };

        if (tooltip === "expand") {
            const bounds = target.getBoundingClientRect();
            if (target.scrollWidth <= Math.ceil(bounds.width) &&
                target.scrollHeight <= Math.ceil(bounds.height)) {
                return null;
            }

            content = target.innerHTML;
            const computedStyle = window.getComputedStyle(target);
            composedStyle.font = computedStyle.font;
            composedStyle.fontSize = computedStyle.fontSize;
            composedStyle.fontWeight = computedStyle.fontWeight;
            composedStyle.lineHeight = computedStyle.lineHeight;
        }

        const className = this.getEffectiveClassNames([
            "tooltip",
            this.classFromProperty(tooltip === "expand", "expand"),
        ]);

        const portal = createPortal(
            <Container
                className={className}
                style={composedStyle}
                innerRef={this.innerRef}
                {...this.unhandledProperties}
            >
                {content}
            </Container>,
            document.body,
        ) as React.ReactNode;

        return (
            portal
        );
    }

    private elementMouseOver = (e: MouseEvent): void => {
        clearTimeout(this.tooltipTimer);

        let target = e.target as HTMLElement;
        if (target.classList && target.classList.contains("tooltip")) {
            return;
        }

        // See if there's tooltip text in the target or if it inherits one from a parent.
        let tooltip: string | undefined;
        for (const element of e.composedPath()) {
            target = element as HTMLElement;
            const data = target.getAttribute("data-tooltip");
            if (!data) {
                break;
            } else if (data !== "inherit") {
                tooltip = data;
                break;
            }
        }

        if (tooltip) {
            const { showDelay } = this.mergedProps;

            this.tooltipTimer = setTimeout((): void => {
                this.setState({ target, tooltip, mouse: new DOMPoint(e.clientX, e.clientY) });
            }, showDelay);
        } else {
            this.setState({ target: undefined });
        }
    };

    private handleDocumentKeyUp = (e: KeyboardEvent): void => {
        if (this.state.target && keyboardKey.getCode(e) === keyboardKey.Escape) {
            this.setState({ target: undefined });
        }
    };

}
