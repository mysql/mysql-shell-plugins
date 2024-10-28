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

import "./Menu.css";

import { cloneElement, ComponentChild, createRef } from "preact";

import type { Command } from "../../../data-models/data-model-types.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";
import { collectVNodes } from "../../../utilities/preact-helpers.js";
import { ComponentBase, ComponentPlacement, IComponentState } from "../Component/ComponentBase.js";
import { Orientation } from "../Container/Container.js";
import { IPopupProperties, Popup } from "../Popup/Popup.js";
import { IPortalOptions } from "../Portal/Portal.js";
import { IMenuItemProperties, MenuItem } from "./MenuItem.js";

export interface IMenuProperties extends IPopupProperties {
    /** Not used in the menu itself, but as the menu item title in a menu bar. */
    caption?: string;

    /** Not used in the menu itself, but as the menu item icon in a menu bar. */
    icon?: string;

    /** Vertical for normal menus, horizontal for menubars. */
    orientation?: Orientation;

    /** Allows the owner of the menu to dynamically determine if a menu item is enabled or not. */
    isItemDisabled?: (props: IMenuItemProperties, payload: unknown) => boolean;

    /**
     * Allows the owner of the menu to dynamically create a command for a menu item.
     * The command also determines the title of the menu item.
     *
     * @returns The new command for the menu item or undefined if the command of the item should be used.
     */
    customCommand?: (props: IMenuItemProperties, payload: unknown) => Command | undefined;

    /** Called for all menu item clicks (even for nested items). Return true to close this menu afterwards. */
    onItemClick?: (props: IMenuItemProperties, altActive: boolean, payload: unknown) => boolean;

    /** Called if the user decided to go back to the previous menu (if there's one). */
    onMenuBack?: () => void;
}

interface IMenuState extends IComponentState {
    /** The index of the item that is currently marked active. */
    activeItemIndex: number;

    /** Data set by owner of the menu for item invocations. */
    payload: unknown;

    open: boolean;
}

export class Menu extends ComponentBase<IMenuProperties, IMenuState> {

    public static override defaultProps = {
        placement: ComponentPlacement.RightTop,
        orientation: Orientation.TopDown,
    };

    // Keeps a list of open (sub) menus to help scheduling events for them.
    private static menuStack: Menu[] = [];

    private itemRefs: Array<React.RefObject<MenuItem>> = [];
    private popupRef = createRef<Popup>();

    public constructor(props: IMenuProperties) {
        super(props);

        this.state = {
            activeItemIndex: -1,
            payload: undefined,
            open: false,
        };

        this.addHandledProperties("caption", "children", "icon", "onMenuBack");
        this.connectEvents("onKeyDown");
    }

    public static initialize(): void {
        document.body.addEventListener("click", Menu.handleDocumentClick);
        document.body.addEventListener("mousedown", Menu.handleMouseDown);
        document.body.addEventListener("keydown", Menu.handleDocumentKeyDown);
        document.body.addEventListener("keyup", Menu.handleDocumentKeyUp);
    }

    private static handleDocumentKeyDown = (e: KeyboardEvent): void => {
        if (Menu.menuStack.length > 0) {
            switch (e.key) {
                case KeyboardKeys.Tab: {
                    Menu.menuStack[0].close();
                    break;
                }

                case KeyboardKeys.Alt: {
                    Menu.menuStack[0].itemRefs.forEach((ref): void => {
                        ref.current?.setState({ altActive: true });
                    });

                    break;
                }

                default: {
                    const menu = Menu.menuStack[Menu.menuStack.length - 1];
                    menu.handleMenuKeyDown(e);
                    break;
                }
            }
        }
    };

    private static handleDocumentKeyUp = (e: KeyboardEvent): void => {
        if (Menu.menuStack.length > 0) {
            switch (e.key) {
                case KeyboardKeys.Alt: {
                    Menu.menuStack[0].itemRefs.forEach((ref): void => {
                        ref.current?.setState({ altActive: false });
                    });

                    break;
                }

                default:
            }
        }
    };

    private static handleDocumentClick = (e: MouseEvent): void => {
        if (Menu.menuStack.length > 0) {
            const preventClose = e.composedPath().some((target: EventTarget): boolean => {
                const element = target as HTMLElement;
                const isMenu = element.classList?.contains("menu");
                const isMenuItem = element.classList?.contains("menuItem");
                const isSubmenu = element.classList?.contains("submenu");
                const isStatusbarItem = element.classList?.contains("statusbarItem");

                return isMenu || isMenuItem || isSubmenu || isStatusbarItem;
            });

            if (!preventClose) {
                setTimeout((): void => {
                    Menu.menuStack[0].close();
                }, 0);
            }
        }
    };

    private static handleMouseDown = (e: MouseEvent): void => {
        if (Menu.menuStack.length > 0) {
            const preventClose = e.composedPath().some((target: EventTarget): boolean => {
                const element = target as HTMLElement;
                const isMenu = element.classList?.contains("menu");
                const isMenuItem = element.classList?.contains("menuItem");
                const isSubmenu = element.classList?.contains("submenu");

                return isMenu || isMenuItem || isSubmenu;
            });

            if (!preventClose) {
                setTimeout((): void => {
                    Menu.menuStack[0].close();
                }, 0);
            }
        }
    };

    public render(): ComponentChild {
        const { children, isItemDisabled, customCommand } = this.props;
        const { activeItemIndex, payload, open } = this.state;

        if (open) {
            const className = this.getEffectiveClassNames(["menu"]);

            this.itemRefs = [];
            let itemIndex = 0;
            const elements = collectVNodes<IMenuItemProperties>(children);
            const content = elements.map((child): ComponentChild => {
                let { command } = child.props;

                const itemRef = createRef<MenuItem>();
                let active = false;
                let disabled = false;

                command = customCommand?.(child.props, payload) ?? command;
                if (child.type === MenuItem && command.title !== "-") {
                    // Only keep references for non-separator menu items.
                    // All other components must be handled by the owner.
                    this.itemRefs.push(itemRef);
                    active = itemIndex++ === activeItemIndex;
                    if (isItemDisabled) {
                        disabled = isItemDisabled(child.props, payload);
                    } else {
                        disabled = child.props.disabled ?? false;
                    }
                }

                return cloneElement(child, {
                    ref: itemRef,
                    onItemMouseEnter: this.handleItemMouseEnter,
                    onItemClick: this.handleItemClick,
                    active,
                    disabled,
                    command,
                });
            });

            return (
                <Popup
                    ref={this.popupRef}
                    className={className}
                    showArrow={false}
                    pinned={false}
                    onClose={this.handleClose}
                    onOpen={this.handleOpen}
                    {...this.unhandledProperties}
                >
                    {content}
                </Popup>
            );
        } else {
            return null;
        }
    }

    public open(currentTarget: DOMRect, activateFirstEntry: boolean, options?: IPortalOptions,
        payload?: unknown): void {
        if (options) {
            options.blockMouseEvents = false;
        } else {
            options = { blockMouseEvents: false };
        }

        const activeItemIndex = activateFirstEntry && this.itemRefs.length > 0 ? 0 : -1;
        this.setState({ activeItemIndex, payload, open: true }, () => {
            this.popupRef?.current?.open(currentTarget, options);
        });
    }

    public close(): void {
        this.popupRef?.current?.close(false);
        this.setState({ activeItemIndex: -1, open: false });
    }

    public get clientRect(): DOMRect | undefined {
        return this.popupRef.current?.clientRect;
    }

    protected handleMenuKeyDown(e: KeyboardEvent): void {
        if (this.itemRefs.length > 0) {
            const { activeItemIndex } = this.state;

            switch (e.key) {
                case KeyboardKeys.ArrowDown: {
                    let newIndex = activeItemIndex + 1;
                    if (newIndex === this.itemRefs.length) {
                        newIndex = 0;
                    }
                    this.setState({ activeItemIndex: newIndex });

                    e.stopPropagation();
                    e.preventDefault();

                    break;
                }

                case KeyboardKeys.ArrowUp: {
                    let newIndex = activeItemIndex - 1;
                    if (newIndex < 0) {
                        newIndex = this.itemRefs.length - 1;
                    }
                    this.setState({ activeItemIndex: newIndex });

                    e.stopPropagation();
                    e.preventDefault();

                    break;
                }

                case KeyboardKeys.ArrowLeft: {
                    const { onMenuBack } = this.props;
                    onMenuBack?.();

                    e.stopPropagation();
                    e.preventDefault();

                    break;
                }

                case KeyboardKeys.ArrowRight: {
                    if (activeItemIndex === -1) {
                        this.setState({ activeItemIndex: 0 });
                    } else {
                        this.itemRefs[activeItemIndex].current?.openSubMenu(true);
                    }

                    e.stopPropagation();
                    e.preventDefault();

                    break;
                }

                case KeyboardKeys.Space:
                case KeyboardKeys.Enter: {
                    if (activeItemIndex > -1) {
                        this.itemRefs[activeItemIndex].current?.click(e);
                    }

                    break;
                }

                default: {
                    break;
                }
            }
        }
    }

    private handleItemMouseEnter = (e: MouseEvent, props: IMenuItemProperties): void => {
        // Usually sub menus are closed when the user moves the mouse to another item.
        // However, the user can also move the mouse to an open submenu and from there out to the container, then
        // back to an item in the main menu. That would not trigger the auto close (which happens on mouse leave).
        // Thus we have to handle this specific case here.
        this.itemRefs.forEach((ref, index): void => {
            if (ref.current?.props === props) {
                this.setState({ activeItemIndex: index });
            } else {
                ref.current?.closeSubMenu();
            }
        });
    };

    private handleItemClick = (props: IMenuItemProperties, altActive: boolean): void => {
        const { onItemClick } = this.props;
        const { payload } = this.state;

        // Propagate the click up the parent chain.
        if (onItemClick?.(props, altActive, payload)) {
            setTimeout(() => { this.close(); }, 0);
        }
    };

    private handleOpen = (): void => {
        const { onOpen } = this.props;

        Menu.menuStack.push(this);
        onOpen?.(this.props);
    };

    private handleClose = (cancelled: boolean, props: IPopupProperties): void => {
        const { onClose } = this.props;

        this.itemRefs.forEach((ref): void => {
            if (ref.current?.props !== props) {
                ref.current?.closeSubMenu();
            }
        });

        Menu.menuStack.pop();
        onClose?.(true, this.props);
    };

}

Menu.initialize();
