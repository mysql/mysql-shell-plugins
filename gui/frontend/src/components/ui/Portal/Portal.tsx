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

import "./Portal.css";

import React, { createRef, ComponentState } from "react";
import { createPortal } from "preact/compat";

import { Component, IComponentProperties } from "../Component/Component";
import keyboardKey from "keyboard-key";
import { IDictionary } from "../../../app-logic/Types";
import { Stack } from "../../../supplement";

// The list of currently open portals. Auto close handling applies only to the TOS.
const portalStack = new Stack<Portal>();

// Options that can change on every show action.
export interface IPortalOptions {
    backgroundOpacity?: number;   // A value to determine translucency of the background element (0..1, default: 0.5);

    closeOnEscape?: boolean;      // If true close portal on pressing the escape key (default: true).
    closeOnPortalClick?: boolean; // If true close portal on clicking the portal beside the target (default: true).
}

export interface IPortalProperties extends IComponentProperties {
    // The element which hosts the portal and determines the background size of the portal
    // background (document.body by default).
    container?: HTMLElement;

    onOpen?: (props: IPortalProperties) => void;
    onClose?: (cancelled: boolean, props: IPortalProperties) => void;
}

interface IPortalState extends ComponentState {
    open: boolean;

    options: IPortalOptions;
}

// A portal in React is a component that is rendered in an arbitrary parent DOM node, allowing so to render it
// on top of other nodes (for modal dialogs, tooltips etc.) that could possibly clip it. Event handling, however, stays
// the same as if the component was rendered locally.
export class Portal extends Component<IPortalProperties, IPortalState> {

    private backgroundRef = createRef<HTMLDivElement>();

    public constructor(props: IPortalProperties) {
        super(props);

        this.state = {
            open: false,
            options: {},
        };

        this.addHandledProperties("container");
    }

    public render(): React.ReactNode {
        const { children, container = document.body } = this.mergedProps;
        const { open, options } = this.state;

        const className = this.getEffectiveClassNames([
            "portal",
            //this.classFromProperty(!options?.lockFocus, "ignoreMouse"),
        ]);

        const style: IDictionary = {
            /* eslint-disable @typescript-eslint/naming-convention */
            "--background-opacity": options.backgroundOpacity,
            /* eslint-enable @typescript-eslint/naming-convention */
        };

        return (
            open && createPortal(
                // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                <div
                    ref={this.backgroundRef}
                    className={className}
                    style={style}
                    onMouseDown={this.handlePortalMouseDown}
                    {...this.unhandledProperties}
                >

                    {children}
                </div>, container,
            ) as React.ReactNode
        );
    }

    public get isOpen(): boolean {
        return this.state.open;
    }

    public open = (options?: IPortalOptions): void => {
        const { open } = this.state;
        if (!open) {
            const activeOptions: IPortalOptions = {
                closeOnEscape: true,
                closeOnPortalClick: false,
                ...options,
            };

            this.setState({ open: true, options: activeOptions }, (): void => {
                portalStack.push(this);

                const { onOpen } = this.mergedProps;
                onOpen?.(this.mergedProps);
            });
        }
    };

    public close = (cancelled: boolean): void => {
        const { open } = this.state;

        if (open) {
            // First notify descendants so they can act properly *before* this portal is closed
            // (think of sub menus).
            const { onClose } = this.mergedProps;
            onClose?.(cancelled, this.mergedProps);

            this.setState({ open: false, options: {} }, () => {
                portalStack.pop();
            });
        }
    };

    /**
     * FocusOn handler when the focus lock is active.
     *
     * @param event The mouse event generated for the click.
     */
    private handlePortalMouseDown = (event: React.MouseEvent): void => {
        const { open, options } = this.state;

        if (open && options.closeOnPortalClick && event.target === this.backgroundRef.current) {
            this.close(true);
        }
    };

}

// Add a single keydown handler for all portals.
document.body.addEventListener("keydown", (e: KeyboardEvent): void => {
    if (portalStack.length > 0 && keyboardKey.getCode(e) === keyboardKey.Escape) {
        const portal = portalStack.top;
        if (portal) {
            const { options } = portal.state;
            if (options.closeOnEscape) {
                e.stopImmediatePropagation();
                e.stopPropagation();
                portal.close(true);
            }
        }
    }
});

