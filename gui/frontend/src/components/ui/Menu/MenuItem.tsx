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
import {
    IComponentProperties, ComponentPlacement, ComponentBase, type IComponentState,
} from "../Component/ComponentBase.js";
import { Container, Orientation } from "../Container/Container.js";
import { Divider } from "../Divider/Divider.js";
import { Icon } from "../Icon/Icon.js";
import { Label } from "../Label/Label.js";
import { Menu } from "./Menu.js";
import type { Command } from "../../../data-models/data-model-types.js";

export interface IMenuItemProperties extends Omit<IComponentProperties, "onClick" | "onMouseEnter" | "onMouseLeave"> {
    /** Comprises the main title and action id (plus optional parameters) for the menu item. */
    command: Command;

    /** An alternative command, used when the user presses the alt key while clicking the menu item. */
    altCommand?: Command;

    icon?: string | Codicon;
    active?: boolean;
    subMenuPlacement?: ComponentPlacement;

    /** If true show the submenu only on item click, otherwise on mouse enter. */
    subMenuShowOnClick?: boolean;

    innerRef?: preact.RefObject<HTMLDivElement>;

    onSubMenuClose?: (props: Readonly<IMenuItemProperties>) => void;
    onSubMenuOpen?: (props: Readonly<IMenuItemProperties>) => void;

    /** Replaces the standard onClick event. It's called when the user selects this item (using mouse or keyboard). */
    onItemClick?: (props: Readonly<IMenuItemProperties>, altActive: boolean) => void;

    onItemMouseEnter?: (e: MouseEvent, props: Readonly<IMenuItemProperties>) => void;
    onItemMouseLeave?: (e: MouseEvent, props: Readonly<IMenuItemProperties>) => void;
}

interface IMenuItemState extends IComponentState {
    altActive: boolean;
}

export class MenuItem extends ComponentBase<IMenuItemProperties, IMenuItemState> {

    public static override defaultProps = {
        subMenuPlacement: ComponentPlacement.RightTop,
    };

    private menuRef = createRef<Menu>();
    private itemRef: preact.RefObject<HTMLDivElement>;

    public constructor(props: IMenuItemProperties) {
        super(props);

        this.state = {
            altActive: false,
        };

        this.itemRef = props.innerRef ?? createRef<HTMLDivElement>();

        this.addHandledProperties("caption", "icon", "active", "subMenuPlacement", "onSubMenuClose",
            "onSubMenuOpen", "subMenuShowOnClick", "innerRef", "title");
    }

    public render(): ComponentChild {
        const { children, id, command, altCommand, icon, disabled, active, subMenuPlacement, title } = this.props;
        const { altActive } = this.state;

        const isSeparator = command.title === "-";
        const actualCaption = (altActive && altCommand) ? altCommand.title : command.title;
        const className = this.getEffectiveClassNames([
            "menuItem",
            this.classFromProperty(disabled || isSeparator, "disabled"),
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
                fixedScrollbars={false}

                onMouseEnter={this.handleItemMouseEnter}
                onMouseLeave={this.handleItemMouseLeave}
                onClick={this.handleItemClick}
                title={title}
            >
                {icon && <Icon src={icon} />}
                <Label>{actualCaption}</Label>
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
        const { subMenuShowOnClick, disabled, onItemMouseEnter } = this.props;

        const element = e.currentTarget as HTMLElement;
        element.classList.add("active");

        // If this item has a submenu then open it.
        if (!disabled && !subMenuShowOnClick) {
            this.menuRef.current?.open(element.getBoundingClientRect(), false);
        }

        onItemMouseEnter?.(e, this.props);
    };

    private handleItemMouseLeave = (e: MouseEvent): void => {
        const { onItemMouseLeave } = this.props;

        const element = e.currentTarget as HTMLElement;
        element.classList.remove("active");

        onItemMouseLeave?.(e, this.props);
    };

    private handleItemClick = (e: MouseEvent | KeyboardEvent): void => {
        const { subMenuShowOnClick, disabled, onItemClick } = this.props;
        const { altActive } = this.state;

        if (disabled) {
            return;
        }

        const element = e.currentTarget as HTMLElement;
        e.stopPropagation();
        if (subMenuShowOnClick && e) {
            this.menuRef.current?.open(element.getBoundingClientRect(), false);
        }

        onItemClick?.(this.props, altActive);
    };

    private handleSubmenuItemClick = (props: IMenuItemProperties, altActive: boolean): boolean => {
        const { disabled, onItemClick } = this.props;

        if (disabled) {
            return false;
        }

        onItemClick?.(props, altActive);

        return true;
    };

    private handleMenuBack = (): void => {
        this.closeSubMenu();
    };
}
