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

import React from "react";

import {
    Component, IComponentProperties, Label, Container, Icon, Menu, ComponentPlacement, Orientation,
    Divider,
} from "..";
import { Codicon } from "../Codicon";

export interface IMenuItemProperties extends IComponentProperties {
    caption?: string;
    icon?: string | Codicon;
    active?: boolean;
    subMenuPlacement?: ComponentPlacement;
    subMenuShowOnClick?: boolean;          // If true show the submenu only on item click, otherwise on mouse enter.

    innerRef?: React.RefObject<HTMLElement>;

    onSubMenuClose?: (props: IMenuItemProperties) => void;
    onSubMenuOpen?: (props: IMenuItemProperties) => void;
}

export class MenuItem extends Component<IMenuItemProperties> {

    public static defaultProps = {
        subMenuPlacement: ComponentPlacement.RightTop,
    };

    private menuRef = React.createRef<Menu>();
    private itemRef: React.RefObject<HTMLElement>;

    public constructor(props: IMenuItemProperties) {
        super(props);

        this.itemRef = props.innerRef ?? React.createRef<HTMLElement>();

        this.addHandledProperties("caption", "icon", "active", "subMenuPlacement", "onSubMenuClose",
            "onSubMenuOpen", "subMenuShowOnClick", "innerRef", "title");
    }

    public render(): React.ReactNode {
        const { children, id, caption, icon, disabled, active, subMenuPlacement, title } = this.mergedProps;

        const isSeparator = caption === "-";
        const isDisabled = (disabled instanceof Function) ? disabled(this.mergedProps) : disabled;
        const className = this.getEffectiveClassNames([
            "menuItem",
            this.classFromProperty(isDisabled || isSeparator, "disabled"),
            this.classFromProperty(active, "active"),
        ]);

        const isSubMenu = React.Children.count(children) > 0;
        let content;
        if (!isSeparator) {
            content = <Container
                innerRef={this.itemRef}
                id={id}
                className={isSubMenu ? className + " submenu" : className}
                orientation={Orientation.LeftToRight}

                onMouseEnter={this.handleItemMouseEnter}
                onMouseLeave={this.handleItemMouseLeave}
                onClick={this.handleItemClick}
                title={title}
            >
                {icon && <Icon src={icon} />}
                <Label>{caption}</Label>
            </Container>;
        } else {
            content = <Divider id={id} className={className + " separator"} />;
        }

        if (isSubMenu) {
            // Wrap the menu item into a menu definition to constitute a submenu.
            content =
                <>
                    {content}
                    <Menu
                        id={`${id ?? ""}Submenu`}
                        ref={this.menuRef}
                        onItemClick={this.handleSubmenuItemClick}
                        onMenuBack={this.handleMenuBack}
                        onClose={this.handleSubMenuClose}
                        onOpen={this.handleSubMenuOpen}

                        // Popup properties:
                        placement={subMenuPlacement}

                        {...this.unhandledProperties}
                    >
                        {children}
                    </Menu>
                </>;
        }

        return (
            content
        );
    }

    public openSubMenu = (activateFirstEntry: boolean): void => {
        if (this.itemRef.current) {
            this.menuRef.current?.open(this.itemRef.current.getBoundingClientRect(), activateFirstEntry);
        }
    };

    /**
     * Called by the parent menu on enter of a different menu item with a submenu. Causes this item to close
     * its submenu, if there's any.
     */
    public closeSubMenu = (): void => {
        this.menuRef.current?.close();
    };

    public click = (e: React.SyntheticEvent): void => {
        this.handleItemClick(e);
    };

    private handleSubMenuClose = (): void => {
        const { onSubMenuClose } = this.mergedProps;
        onSubMenuClose?.(this.mergedProps);
    };

    private handleSubMenuOpen = (): void => {
        const { onSubMenuOpen } = this.mergedProps;
        onSubMenuOpen?.(this.mergedProps);
    };

    private handleItemMouseEnter = (e: React.MouseEvent): void => {
        const { subMenuShowOnClick, disabled, onMouseEnter } = this.mergedProps;

        const element = e.currentTarget as HTMLElement;
        element.classList.add("active");

        // If this item has a submenu then open it.
        if (!disabled && !subMenuShowOnClick) {
            this.menuRef.current?.open(element.getBoundingClientRect(), false);
        }

        onMouseEnter?.(e, this.mergedProps);
    };

    private handleItemMouseLeave = (e: React.MouseEvent): void => {
        const { onMouseLeave } = this.mergedProps;

        const element = e.currentTarget as HTMLElement;
        element.classList.remove("active");

        onMouseLeave?.(e, this.mergedProps);
    };

    private handleItemClick = (e: React.SyntheticEvent): void => {
        const { subMenuShowOnClick, onClick } = this.mergedProps;

        e.stopPropagation();
        if (subMenuShowOnClick && e) {
            this.menuRef.current?.open(e.currentTarget.getBoundingClientRect(), false);
        }

        onClick?.(e, this.mergedProps);
    };

    private handleSubmenuItemClick = (e: React.MouseEvent, props: IMenuItemProperties): boolean => {
        const { onClick } = this.mergedProps;
        onClick?.(e, props);

        return true;
    };

    private handleMenuBack = (): void => {
        this.closeSubMenu();
    };
}
