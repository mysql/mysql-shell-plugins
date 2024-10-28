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

import "./Tooltip.css";

import { ComponentChild, createRef } from "preact";
import { CSSProperties, createPortal } from "preact/compat";

import { JsonParser } from "../../../communication/JsonParser.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";
import {
    ComponentBase, ComponentPlacement, IComponentProperties, IComponentState,
} from "../Component/ComponentBase.js";
import { Container } from "../Container/Container.js";
import { Label } from "../Label/Label.js";
import {
    clampToDocument, computeContentPosition, isElementClipped, computeBounds,
} from "../html-helpers.js";

interface ITooltipProviderProperties extends IComponentProperties {
    /** Time to wait until the tooltip is shown, in milliseconds. Default is 300ms. */
    showDelay?: number;

    /** The maximum character count to show in the tooltip. Default is 500. */
    maxLength?: number;

    /** You can specify the width and height of the system cursor, if you know it. Default is 16. */
    cursorWidth?: number;
    cursorHeight?: number;
}

interface ITooltipProviderState extends IComponentState {
    target?: HTMLElement;
    mouse: DOMPoint;
    tooltip: string;

    /**
     * If set to "expand", the tooltip will show the full text of the target element (up to `maxLength` characters
     * as an overlay above the target. Otherwise the tooltip is shown as a normal tooltip, with a small offset.
     */
    expand: boolean;
}

/** A component to render a tooltip on other components with a "data-tooltip" attribute. */
export class TooltipProvider extends ComponentBase<ITooltipProviderProperties, ITooltipProviderState> {

    private tooltipTimer: ReturnType<typeof setTimeout> | null = null;
    private innerRef = createRef<HTMLDivElement>();

    public constructor(props: ITooltipProviderProperties) {
        super(props);

        this.state = {
            mouse: new DOMPoint(),
            tooltip: "",
            expand: false,
        };
        this.addHandledProperties("showDelay", "style", "maxLength", "cursorWidth", "cursorHeight");
    }

    public override componentDidMount(): void {
        document.body.addEventListener("mouseover", this.elementMouseOver, false); // Mouse enter doesn't work here.
        document.body.addEventListener("keyup", this.handleDocumentKeyUp);
    }

    public override componentWillUnmount(): void {
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }

        document.body.removeEventListener("keyup", this.handleDocumentKeyUp);
        document.body.removeEventListener("mouseover", this.elementMouseOver);
    }

    public override componentDidUpdate(): void {
        const { cursorWidth = 16, cursorHeight = 16 } = this.props;
        const { tooltip, target, expand, mouse } = this.state;

        if (this.innerRef.current && target) {
            let x = 0;
            let y = 0;
            let width: number | undefined;
            if (expand) {
                // A tooltip that shows shortened text in full.
                const bounds = target.getBoundingClientRect();

                // The padding of the text has to be taken into account for positioning the tooltip.
                const targetStyle = window.getComputedStyle(target);
                const paddingLeft = parseInt(targetStyle.paddingLeft, 10);
                const paddingTop = parseInt(targetStyle.paddingTop, 10);

                // Also apply the relevant tooltip style values to the computed style.
                const ref = this.innerRef.current;
                const refStyle = window.getComputedStyle(ref); // Includes styles from the props.

                const combinedStyle: Partial<CSSStyleDeclaration> = { ...targetStyle };
                combinedStyle.width = refStyle.width;
                combinedStyle.maxWidth = refStyle.maxWidth;
                combinedStyle.height = refStyle.height;
                combinedStyle.maxHeight = refStyle.maxHeight;
                combinedStyle.padding = refStyle.padding;
                combinedStyle.border = refStyle.border;

                const [width, height] = computeBounds(tooltip, combinedStyle);
                bounds.width = width;
                bounds.height = height;

                // Ensure the tooltip's bounds stay within the document.
                // magic numbers: padding in CSS + 1 pixel for the border.
                [x, y] = clampToDocument(bounds, -5 + paddingLeft, -2 + paddingTop);
            } else {
                // A normal tooltip with fixed text given in the HTML element.
                const { left, top } = computeContentPosition(ComponentPlacement.BottomLeft, this.innerRef.current,
                    new DOMRect(mouse.x, mouse.y, 1, 1), 0, true);

                x = left + cursorWidth;
                y = top + cursorHeight;
            }

            this.innerRef.current.style.transform = `translate(${x}px, ${y}px)`;
            if (width) {
                this.innerRef.current.style.width = `${width}px`;
            }
        }
    }

    public render(): ComponentChild {
        const { style } = this.props;
        const { target, tooltip, expand } = this.state;

        if (!target) {
            return null;
        }

        let content: string | preact.VNode | undefined = tooltip;
        const composedStyle: CSSProperties = { ...style };

        if (expand) {
            const isClipped = isElementClipped(target, false, true);
            if (!isClipped) {
                const bounds = target.getBoundingClientRect();
                if (target.scrollWidth <= Math.ceil(bounds.width) &&
                    target.scrollHeight <= Math.ceil(bounds.height)) {
                    return null;
                }
            }

            const computedStyle = window.getComputedStyle(target);
            composedStyle.font = computedStyle.font;
            composedStyle.fontSize = computedStyle.fontSize;
            composedStyle.fontWeight = computedStyle.fontWeight;
            composedStyle.lineHeight = computedStyle.lineHeight;
        }

        const language = target.getAttribute("data-tooltip-lang");
        if (language === "json") {
            content = <Label language="json" code>{tooltip}</Label>;
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
                fixedScrollbars={false}
                {...this.unhandledProperties}
            >
                {content}
            </Container>,
            document.body,
        ) as ComponentChild;

        return (
            portal
        );
    }

    private elementMouseOver = (e: MouseEvent): void => {
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }

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
            const { showDelay = 300, maxLength = 500 } = this.props;

            let expand = false;
            if (tooltip === "expand") { // Expand means: use the text of the target element.
                expand = true;
                const language = target.getAttribute("data-tooltip-lang");
                const innerText = target.innerText !== undefined
                    ? target.innerText
                    : (target.textContent ?? "");
                switch (language) {
                    case "json": {
                        // For JSON content, parse it and format it nicely.
                        try {
                            const json = JsonParser.parseJson(target.innerText.replaceAll("\n", ""));
                            tooltip = JSON.stringify(json, null, 4).substring(0, maxLength);
                        } catch (e) {
                            tooltip = innerText.substring(0, maxLength);
                        }

                        break;
                    }

                    default: {
                        tooltip = innerText.substring(0, maxLength);
                    }
                }
            }

            if (tooltip.length > 0) {
                this.tooltipTimer = setTimeout((): void => {
                    this.setState({ target, tooltip, expand, mouse: new DOMPoint(e.clientX, e.clientY) });
                }, showDelay);
            }
        } else {
            this.setState({ target: undefined });
        }
    };

    private handleDocumentKeyUp = (e: KeyboardEvent): void => {
        if (this.state.target && e.key === KeyboardKeys.Escape) {
            this.setState({ target: undefined });
        }
    };

}
