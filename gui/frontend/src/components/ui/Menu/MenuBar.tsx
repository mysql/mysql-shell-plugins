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

import "./Menu.css";

import React from "react";

import {
    IPopupProperties, IMenuItemProperties, Orientation, Container, MenuItem, IComponentState,
    ComponentPlacement, Component, MouseEventType, ContentAlignment,
} from "..";

interface IMenuBarProperties extends IPopupProperties {
    // Called for all menu item clicks (even for nested items).
    onItemClick?: (e: MouseEvent, props: IMenuItemProperties) => void;
}

interface IMenuBarState extends IComponentState {
    activeMenuId: string | number;
    trackItems: boolean;
}

export class MenuBar extends Component<IMenuBarProperties, IMenuBarState> {

    public static defaultProps = {
        orientation: Orientation.LeftToRight,
    };

    private itemRefs: Array<React.RefObject<MenuItem>> = [];

    public constructor(props: IMenuBarProperties) {
        super(props);

        this.state = {
            activeMenuId: "",
            trackItems: false,
        };

        this.connectEvents("onMouseEnter", "onMouseLeave");
    }

    public render(): React.ReactNode {
        const { children } = this.mergedProps;
        const { activeMenuId, trackItems } = this.state;

        const className = this.getEffectiveClassNames(["menubar"]);

        const items = React.Children.map(children, (child: React.ReactNode): React.ReactNode => {
            if (React.isValidElement(child)) {
                const itemRef = React.createRef<MenuItem>();
                if (child.type === MenuItem) {
                    // Only keep references for menu items. All other components must be handled by the owner.
                    this.itemRefs.push(itemRef);
                }

                const { id: childId } = child.props;

                let itemClassName = "";
                if (activeMenuId === "") {
                    itemClassName = "nohover";
                } else if (activeMenuId === childId) {
                    itemClassName = "active";
                }

                return React.cloneElement(child, {
                    ref: itemRef,
                    subMenuPlacement: ComponentPlacement.BottomLeft,
                    subMenuShowOnClick: !trackItems,
                    className: itemClassName,
                    onMouseEnter: this.handleItemMouseEnter,
                    onSubMenuClose: this.handleSubMenuClose,
                    onSubMenuOpen: this.handleSubMenuOpen,
                    onClick: this.handleItemClick,
                } as never); // Cast to never to allow assigning the itemRef.
            }

            return undefined;
        });

        return (
            <Container
                className={className}
                crossAlignment={ContentAlignment.Center}
                {...this.unhandledProperties}
            >
                {items}
            </Container>
        );
    }

    protected handleMouseEvent(type: MouseEventType): boolean {
        switch (type) {
            case MouseEventType.Leave: {
                if (this.state.activeMenuId === "") {
                    this.setState({ trackItems: false });
                }

                break;
            }

            default:
                break;
        }

        return true;
    }

    private handleSubMenuClose = (): void => {
        this.setState({ activeMenuId: "" });
    };

    private handleSubMenuOpen = (props: IMenuItemProperties): void => {
        this.setState({ activeMenuId: props.id || "", trackItems: true });
    };

    private handleItemMouseEnter = (e: MouseEvent, props: IMenuItemProperties): void => {
        this.itemRefs.forEach((ref): void => {
            if (ref.current?.props !== props) {
                ref.current?.closeSubMenu();
            }
        });
    };

    private handleItemClick = (e: MouseEvent, props: IMenuItemProperties): void => {
        const { onItemClick } = this.mergedProps;

        onItemClick?.(e, props);
    };

}
