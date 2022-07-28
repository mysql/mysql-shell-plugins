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

import "./Popup.css";

import React from "react";

import {
    Component, IComponentState, Portal, IPortalProperties, Container, Orientation, ComponentPlacement, IPortalOptions,
} from "..";
import { computeContentPosition } from "../Tools/HTMLHelpers";

export interface IPopupProperties extends IPortalProperties {
    header?: React.ReactNode;

    placement?: ComponentPlacement;
    pinned?: boolean;        // If set no automatic repositioning takes place.
    showArrow?: boolean;
    orientation?: Orientation;

    innerRef?: React.RefObject<HTMLElement>;
}

interface IPopupStates extends IComponentState {
    hidden: boolean;         // Used to temporarily hide the popup on scroll.
    currentTarget?: DOMRect; // The area for placement computation.
}

export class Popup extends Component<IPopupProperties, IPopupStates> {

    public static defaultProps = {
        placement: ComponentPlacement.TopLeft,
        pinned: false,
        showArrow: true,
        orientation: Orientation.TopDown,
    };

    private portalRef = React.createRef<Portal>();
    private containerRef: React.RefObject<HTMLElement>;

    public constructor(props: IPopupProperties) {
        super(props);

        this.state = {
            hidden: false,
        };

        this.containerRef = props.innerRef ?? React.createRef<HTMLElement>();

        this.addHandledProperties("header", "placement", "show", "pinned", "showArrow", "orientation", "innerRef");
    }

    public render(): React.ReactNode {
        const { children, header, placement, showArrow, orientation } = this.mergedProps;
        const className = this.getEffectiveClassNames([
            "popup",
            "visible",
            placement,
            this.classFromProperty(!showArrow, "noArrow"),
        ]);

        return (
            <Portal
                ref={this.portalRef}
                onClose={this.handleClose}
                onOpen={this.handleOpen}
                {...this.unhandledProperties}
            >
                <Container
                    className={className}
                    innerRef={this.containerRef}
                    orientation={orientation}
                >
                    {header}
                    {children}
                </Container>
            </Portal>
        );
    }

    public get isOpen(): boolean {
        return this.portalRef.current?.isOpen || false;
    }

    public open(currentTarget: DOMRect, options?: IPortalOptions): void {
        this.setState({ currentTarget }, () => {
            this.portalRef.current?.open({
                closeOnEscape: true,
                closeOnPortalClick: true,
                backgroundOpacity: 0,
                ...options,
            });
        });
    }

    public close(): void {
        this.portalRef.current?.close(true);
    }

    public get clientRect(): DOMRect | undefined {
        if (this.containerRef.current) {
            return this.containerRef.current.getBoundingClientRect();
        }

        return undefined;
    }

    private handleClose = (cancelled: boolean): void => {
        const { onClose } = this.mergedProps;

        onClose?.(cancelled, this.mergedProps);
    };

    private handleOpen = (): void => {
        const { placement, pinned, showArrow, onOpen } = this.mergedProps;
        const { currentTarget } = this.state;

        if (currentTarget) {
            onOpen?.(this.mergedProps);

            if (this.containerRef.current && placement) {
                const { left, top } = computeContentPosition(placement, this.containerRef.current, currentTarget,
                    showArrow ? 10 : 0, !pinned);
                this.containerRef.current.style.left = `${left}px`;
                this.containerRef.current.style.top = `${top}px`;
            }
        }
    };
}
