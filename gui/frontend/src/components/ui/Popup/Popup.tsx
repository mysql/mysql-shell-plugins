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

import "./Popup.css";

import { ComponentChild, createRef } from "preact";

import { computeContentPosition } from "../html-helpers.js";
import { ComponentPlacement, IComponentState, ComponentBase } from "../Component/ComponentBase.js";
import { Orientation, Container } from "../Container/Container.js";
import { IPortalProperties, Portal, IPortalOptions } from "../Portal/Portal.js";

export interface IPopupProperties extends IPortalProperties {
    header?: ComponentChild;

    placement?: ComponentPlacement;

    /** If set no automatic repositioning takes place. */
    pinned?: boolean;

    showArrow?: boolean;
    orientation?: Orientation;

    innerRef?: preact.RefObject<HTMLDivElement>;
}

interface IPopupStates extends IComponentState {
    hidden: boolean;         // Used to temporarily hide the popup on scroll.
    currentTarget?: DOMRect; // The area for placement computation.
}

export class Popup extends ComponentBase<IPopupProperties, IPopupStates> {

    public static override defaultProps = {
        placement: ComponentPlacement.TopLeft,
        pinned: false,
        showArrow: true,
        orientation: Orientation.TopDown,
    };

    private portalRef = createRef<Portal>();
    private containerRef: preact.RefObject<HTMLDivElement>;

    public constructor(props: IPopupProperties) {
        super(props);

        this.state = {
            hidden: false,
        };

        this.containerRef = props.innerRef ?? createRef<HTMLDivElement>();

        this.addHandledProperties("header", "placement", "show", "pinned", "showArrow", "orientation", "innerRef");
    }

    public render(): ComponentChild {
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
                className="popupPortal"
                onClose={this.handleClose}
                onOpen={this.handleOpen}
                {...this.unhandledProperties}
            >
                <Container
                    className={className}
                    innerRef={this.containerRef}
                    orientation={orientation}
                    fixedScrollbars={false}
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

    public close(cancelled: boolean): void {
        this.portalRef.current?.close(cancelled);
    }

    public get clientRect(): DOMRect | undefined {
        if (this.containerRef.current) {
            return this.containerRef.current.getBoundingClientRect();
        }

        return undefined;
    }

    public updatePosition(newTarget: DOMRect): void {
        this.setState({ currentTarget: newTarget }, this.handleOpen);
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
