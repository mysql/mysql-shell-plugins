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

import { IPortalOptions } from "../Portal/Portal.js";
import { collectVNodes } from "../../../utilities/preact-helpers.js";
import { IComponentState, ComponentBase, ComponentPlacement } from "../Component/ComponentBase.js";
import { Orientation } from "../Container/Container.js";
import { IPopupProperties, Popup } from "../Popup/Popup.js";
import { IMenuItemProperties, MenuItem } from "./MenuItem.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";

export interface IMenuProperties extends IPopupProperties {
    /** Not used in the menu itself, but as the menu item title in a menu bar. */
    title?: string;

    /** Not used in the menu itself, but as the menu item icon in a menu bar. */
    icon?: string;

    /** Vertical for normal menus, horizontal for menubars. */
    orientation?: Orientation;

    /** Called for all menu item clicks (even for nested items). Return true to close this menu afterwards. */
    onItemClick?: (e: MouseEvent, props: IMenuItemProperties, payload: unknown) => boolean;

    /** Called if the user decided to go back to the previous menu (if there's one). */
    onMenuBack?: () => void;
}

interface IMenuState extends IComponentState {
    activeItemIndex: number; // The index of the item that is currently marked active.
    payload: unknown;        // Data set by owner of the menu for item invocations.
}

export class Menu extends ComponentBase<IMenuProperties, IMenuState> {

    public static defaultProps = {
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
        };

        this.addHandledProperties("title", "icon", "onMenuBack");
        this.connectEvents("onKeyDown");
    }

    public static initialize(): void {
        document.body.addEventListener("click", Menu.handleDocumentClick);
        document.body.addEventListener("mousedown", Menu.handleMouseDown);
        document.body.addEventListener("keydown", Menu.handleDocumentKeyDown);
    }

    private static handleDocumentKeyDown = (e: KeyboardEvent): void => {
        if (Menu.menuStack.length > 0) {
            switch (e.key) {
                case KeyboardKeys.Tab: {
                    Menu.menuStack[0].close();
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
        const { children } = this.mergedProps;
        const { activeItemIndex } = this.state;

        const className = this.getEffectiveClassNames(["menu"]);

        this.itemRefs = [];
        let itemIndex = 0;
        const elements = collectVNodes<IMenuItemProperties>(children);
        const content = elements.map((child): ComponentChild => {
            const { title: childTitle, onClick: childOnClick } = child.props;

            const itemRef = createRef<MenuItem>();
            let active = false;
            if (child.type === MenuItem && childTitle !== "-") {
                // Only keep references for non-separator menu items.
                // All other components must be handled by the owner.
                this.itemRefs.push(itemRef);
                active = itemIndex++ === activeItemIndex;
            }

            return cloneElement(child, {
                ref: itemRef,
                onMouseEnter: this.handleItemMouseEnter,
                onClick: (e: MouseEvent, props: IMenuItemProperties): void => {
                    childOnClick?.(e, props);
                    this.handleItemClick(e, props);
                },
                active,
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
    }

    public open(currentTarget: DOMRect, activateFirstEntry: boolean, options?: IPortalOptions,
        payload?: unknown): void {
        if (options) {
            options.blockMouseEvents = false;
        } else {
            options = { blockMouseEvents: false };
        }
        this.popupRef?.current?.open(currentTarget, options);

        if (activateFirstEntry && this.itemRefs.length > 0) {
            this.setState({ activeItemIndex: 0, payload });
        } else {
            this.setState({ activeItemIndex: -1, payload });

        }
    }

    public close(): void {
        this.popupRef?.current?.close(false);
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
                    const { onMenuBack } = this.mergedProps;
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

    private handleItemClick = (e: MouseEvent, props: IMenuItemProperties): void => {
        const { onItemClick } = this.mergedProps;
        const { payload } = this.state;

        // Propagate the click up the parent chain.
        if (onItemClick?.(e, props, payload)) {
            setTimeout(() => { this.close(); }, 0);
        }
    };

    private handleOpen = (): void => {
        const { onOpen } = this.mergedProps;

        Menu.menuStack.push(this);
        onOpen?.(this.mergedProps);
    };

    private handleClose = (cancelled: boolean, props: IPopupProperties): void => {
        const { onClose } = this.mergedProps;

        this.itemRefs.forEach((ref): void => {
            if (ref.current?.props !== props) {
                ref.current?.closeSubMenu();
            }
        });

        Menu.menuStack.pop();
        onClose?.(true, this.mergedProps);
    };

}

Menu.initialize();
