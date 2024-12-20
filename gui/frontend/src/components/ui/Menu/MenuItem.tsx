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

import { ComponentChild, createRef, toChildArray } from "preact";

import { Codicon } from "../Codicon.js";
import { IComponentProperties, ComponentPlacement, ComponentBase } from "../Component/ComponentBase.js";
import { Container, Orientation } from "../Container/Container.js";
import { Divider } from "../Divider/Divider.js";
import { Icon } from "../Icon/Icon.js";
import { Label } from "../Label/Label.js";
import { Menu } from "./Menu.js";

export interface IMenuItemProperties extends IComponentProperties {
    caption?: string;
    icon?: string | Codicon;
    active?: boolean;
    subMenuPlacement?: ComponentPlacement;
    subMenuShowOnClick?: boolean;          // If true show the submenu only on item click, otherwise on mouse enter.

    innerRef?: preact.RefObject<HTMLDivElement>;

    onSubMenuClose?: (props: IMenuItemProperties) => void;
    onSubMenuOpen?: (props: IMenuItemProperties) => void;
}

export class MenuItem extends ComponentBase<IMenuItemProperties> {

    public static override defaultProps = {
        subMenuPlacement: ComponentPlacement.RightTop,
    };

    private menuRef = createRef<Menu>();
    private itemRef: preact.RefObject<HTMLDivElement>;

    public constructor(props: IMenuItemProperties) {
        super(props);

        this.itemRef = props.innerRef ?? createRef<HTMLDivElement>();

        this.addHandledProperties("caption", "icon", "active", "subMenuPlacement", "onSubMenuClose",
            "onSubMenuOpen", "subMenuShowOnClick", "innerRef", "title");
    }

    public render(): ComponentChild {
        const { children, id, caption, icon, disabled, active, subMenuPlacement, title } = this.props;

        const isSeparator = caption === "-";
        const isDisabled = (disabled instanceof Function) ? disabled(this.props) : disabled;
        const className = this.getEffectiveClassNames([
            "menuItem",
            this.classFromProperty(isDisabled || isSeparator, "disabled"),
            this.classFromProperty(active, "active"),
        ]);

        const isSubMenu = toChildArray(children).length > 0;
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

    public click = (e: MouseEvent | KeyboardEvent): void => {
        this.handleItemClick(e);
    };

    private handleSubMenuClose = (): void => {
        const { onSubMenuClose } = this.props;
        onSubMenuClose?.(this.props);
    };

    private handleSubMenuOpen = (): void => {
        const { onSubMenuOpen } = this.props;
        onSubMenuOpen?.(this.props);
    };

    private handleItemMouseEnter = (e: MouseEvent): void => {
        const { subMenuShowOnClick, disabled, onMouseEnter } = this.props;

        const element = e.currentTarget as HTMLElement;
        element.classList.add("active");

        // If this item has a submenu then open it.
        const isDisabled = (disabled instanceof Function) ? disabled(this.props) : disabled;
        if (!isDisabled && !subMenuShowOnClick) {
            this.menuRef.current?.open(element.getBoundingClientRect(), false);
        }

        onMouseEnter?.(e, this.props);
    };

    private handleItemMouseLeave = (e: MouseEvent): void => {
        const { onMouseLeave } = this.props;

        const element = e.currentTarget as HTMLElement;
        element.classList.remove("active");

        onMouseLeave?.(e, this.props);
    };

    private handleItemClick = (e: MouseEvent | KeyboardEvent): void => {
        const { subMenuShowOnClick, onClick, disabled } = this.props;

        const isDisabled = (disabled instanceof Function) ? disabled(this.props) : disabled;
        if (isDisabled) {
            return;
        }

        const element = e.currentTarget as HTMLElement;
        e.stopPropagation();
        if (subMenuShowOnClick && e) {
            this.menuRef.current?.open(element.getBoundingClientRect(), false);
        }

        onClick?.(e, this.props);
    };

    private handleSubmenuItemClick = (e: MouseEvent, props: IMenuItemProperties): boolean => {
        const { disabled, onClick } = this.props;

        const isDisabled = (disabled instanceof Function) ? disabled(this.props) : disabled;
        if (isDisabled) {
            return false;
        }

        onClick?.(e, props);

        return true;
    };

    private handleMenuBack = (): void => {
        this.closeSubMenu();
    };
}
