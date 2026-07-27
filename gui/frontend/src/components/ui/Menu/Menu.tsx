/*
 * Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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
import {
    hasElectronNativeMenuBridge,
    type IElectronNativeMenuEvent,
    type IElectronNativeMenuItem,
} from "../../../supplement/ElectronDesktop.js";
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
    onItemClick?: (props: IMenuItemProperties, altActive: boolean, payload: unknown) => boolean | Promise<boolean>;

    /** Called if the user decided to go back to the previous menu (if there's one). */
    onMenuBack?: () => void;

    /** Forces the renderer popup implementation even when the Electron native bridge is available. */
    useNativeMenu?: boolean;
}

interface IMenuState extends IComponentState {
    /** The index of the item that is currently marked active. */
    activeItemIndex: number;

    /** Data set by owner of the menu for item invocations. */
    payload: unknown;

    open: boolean;
}

interface INativeMenuRegistration {
    menu: Menu;
    payload: unknown;
    itemPropsById: Map<string, IMenuItemProperties>;
}

export class Menu extends ComponentBase<IMenuProperties, IMenuState> {

    public static override defaultProps = {
        placement: ComponentPlacement.RightTop,
        orientation: Orientation.TopDown,
    };

    // Keeps a list of open (sub) menus to help scheduling events for them.
    private static menuStack: Menu[] = [];
    private static nativeMenuSequence = 0;
    private static nativeMenuRegistrations = new Map<string, INativeMenuRegistration>();
    private static nativeMenuHandlerRegistered = false;

    private static findRootOpenMenu = (): Menu | undefined => {
        return Menu.menuStack.find((menu) => {
            return menu.state.open;
        });
    };

    private static findLeafOpenMenu = (): Menu | undefined => {
        for (let i = Menu.menuStack.length - 1; i >= 0; --i) {
            if (Menu.menuStack[i].state.open) {
                return Menu.menuStack[i];
            }
        }

        return undefined;
    };

    private static removeFromMenuStack = (menu: Menu): void => {
        const index = Menu.menuStack.findIndex((entry) => {
            return entry === menu;
        });

        if (index > -1) {
            Menu.menuStack.splice(index, 1);
        }
    };

    private static ensureNativeMenuHandlerRegistered = (): void => {
        if (Menu.nativeMenuHandlerRegistered || !hasElectronNativeMenuBridge()) {
            return;
        }

        window.electronHost?.setNativeMenuHandler?.(Menu.handleNativeMenuEvent);
        Menu.nativeMenuHandlerRegistered = true;
    };

    private static handleNativeMenuEvent = (event: IElectronNativeMenuEvent): void => {
        const registration = Menu.nativeMenuRegistrations.get(event.requestId);
        if (!registration) {
            return;
        }

        switch (event.type) {
            case "select": {
                const props = registration.itemPropsById.get(event.itemId);
                if (props) {
                    registration.menu.handleNativeMenuSelection(props, registration.payload);
                }

                break;
            }

            case "close": {
                Menu.nativeMenuRegistrations.delete(event.requestId);
                registration.menu.handleNativeMenuClose(event.requestId, event.cancelled);
                break;
            }

            default:
        }
    };

    private itemRefs: Array<React.RefObject<MenuItem>> = [];
    private popupRef = createRef<Popup>();
    private nativeMenuRequestId?: string;

    public constructor(props: IMenuProperties) {
        super(props);

        this.state = {
            activeItemIndex: -1,
            payload: undefined,
            open: false,
        };

        this.addHandledProperties("caption", "children", "icon", "onMenuBack", "useNativeMenu");
        this.connectEvents("onKeyDown");
    }

    public static initialize(): void {
        document.body.addEventListener("click", Menu.handleDocumentClick);
        document.addEventListener("mousedown", Menu.handleMouseDown, true);
        document.body.addEventListener("keydown", Menu.handleDocumentKeyDown);
        document.body.addEventListener("keyup", Menu.handleDocumentKeyUp);
    }

    private static handleDocumentKeyDown = (e: KeyboardEvent): void => {
        const rootMenu = Menu.findRootOpenMenu();
        const leafMenu = Menu.findLeafOpenMenu();
        if (rootMenu && leafMenu) {
            switch (e.key) {
                case KeyboardKeys.Tab: {
                    rootMenu.close();
                    break;
                }

                case KeyboardKeys.Alt: {
                    rootMenu.itemRefs.forEach((ref): void => {
                        ref.current?.setState({ altActive: true });
                    });

                    break;
                }

                default: {
                    leafMenu.handleMenuKeyDown(e);
                    break;
                }
            }
        }
    };

    private static handleDocumentKeyUp = (e: KeyboardEvent): void => {
        const rootMenu = Menu.findRootOpenMenu();
        if (rootMenu) {
            switch (e.key) {
                case KeyboardKeys.Alt: {
                    rootMenu.itemRefs.forEach((ref): void => {
                        ref.current?.setState({ altActive: false });
                    });

                    break;
                }

                default:
            }
        }
    };

    private static handleDocumentClick = (e: MouseEvent): void => {
        const rootMenu = Menu.findRootOpenMenu();
        if (rootMenu) {
            const preventClose = e.composedPath().some((target: EventTarget): boolean => {
                if (!(target instanceof Element)) {
                    return false;
                }

                const isMenu = target.classList.contains("menu");
                const isMenuItem = target.classList.contains("menuItem");
                const isSubmenu = target.classList.contains("submenu");
                const isStatusbarItem = target.classList.contains("statusbarItem");

                return isMenu || isMenuItem || isSubmenu || isStatusbarItem;
            });

            if (!preventClose) {
                setTimeout((): void => {
                    const activeRootMenu = Menu.findRootOpenMenu();
                    if (activeRootMenu) {
                        activeRootMenu.close();
                    }
                }, 0);
            }
        }
    };

    private static handleMouseDown = (e: MouseEvent): void => {
        const rootMenu = Menu.findRootOpenMenu();
        if (rootMenu) {
            const preventClose = e.composedPath().some((target: EventTarget): boolean => {
                if (!(target instanceof Element)) {
                    return false;
                }

                const isMenu = target.classList.contains("menu");
                const isMenuItem = target.classList.contains("menuItem");
                const isSubmenu = target.classList.contains("submenu");

                return isMenu || isMenuItem || isSubmenu;
            });

            if (!preventClose) {
                rootMenu.close();
            }
        }
    };

    public render(): ComponentChild {
        const { children } = this.props;
        const { activeItemIndex, payload, open } = this.state;

        if (open) {
            const className = this.getEffectiveClassNames(["menu"]);

            this.itemRefs = [];
            let itemIndex = 0;
            const elements = collectVNodes<IMenuItemProperties>(children);
            const content = elements.map((child): ComponentChild => {
                const itemRef = createRef<MenuItem>();
                const { command, disabled } = this.resolveMenuItem(child.props, payload);
                let active = false;

                if (child.type === MenuItem && command.title !== "-") {
                    // Only keep references for non-separator menu items.
                    // All other components must be handled by the owner.
                    this.itemRefs.push(itemRef);
                    active = itemIndex++ === activeItemIndex;
                }

                return cloneElement(child, {
                    ref: itemRef,
                    onItemMouseEnter: this.handleItemMouseEnter,
                    onItemClick: this.handleItemClick,
                    active,
                    disabled,
                    command,
                    checked: child.props.checked,
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
        if (this.shouldUseNativeMenu()) {
            this.openNativeMenu(currentTarget, activateFirstEntry, payload);
            return;
        }

        if (options) {
            options.blockMouseEvents = false;
        } else {
            options = { blockMouseEvents: false };
        }

        const activeItemIndex = activateFirstEntry && this.itemRefs.length > 0 ? 0 : -1;
        this.setState({ activeItemIndex, payload, open: true }, () => {
            this.popupRef.current?.open(currentTarget, options);
        });
    }

    public close(): void {
        if (this.shouldUseNativeMenu()) {
            if (this.nativeMenuRequestId) {
                void window.electronHost?.closeNativeMenu?.(this.nativeMenuRequestId);
            }

            return;
        }

        this.popupRef.current?.close(false);
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
        const result = this.props.onItemClick?.(props, altActive, this.state.payload);
        if (result instanceof Promise) {
            void result.then((close): void => {
                if (close) {
                    setTimeout(() => {
                        this.close();
                    }, 0);
                }
            });
        } else if (result ?? true) {
            setTimeout(() => {
                this.close();
            }, 0);
        }
    };

    private handleOpen = (): void => {
        const { onOpen } = this.props;

        Menu.removeFromMenuStack(this);
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

        Menu.removeFromMenuStack(this);
        onClose?.(cancelled, this.props);
    };

    private shouldUseNativeMenu = (): boolean => {
        Menu.ensureNativeMenuHandlerRegistered();

        return this.props.useNativeMenu !== false && hasElectronNativeMenuBridge();
    };

    private resolveMenuItem = (props: IMenuItemProperties, payload: unknown): {
        command: Command;
        disabled: boolean;
    } => {
        const { isItemDisabled, customCommand } = this.props;

        return {
            command: customCommand?.(props, payload) ?? props.command,
            disabled: isItemDisabled ? isItemDisabled(props, payload) : props.disabled ?? false,
        };
    };

    private openNativeMenu = (currentTarget: DOMRect, activateFirstEntry: boolean, payload: unknown): void => {
        Menu.ensureNativeMenuHandlerRegistered();

        if (!hasElectronNativeMenuBridge()) {
            return;
        }

        if (this.nativeMenuRequestId) {
            void window.electronHost?.closeNativeMenu?.(this.nativeMenuRequestId);
        }

        const requestId = `native-menu-${++Menu.nativeMenuSequence}`;
        const itemPropsById = new Map<string, IMenuItemProperties>();
        const items = this.serializeNativeMenuItems(this.props.children, payload, itemPropsById);
        if (items.length === 0) {
            return;
        }

        this.nativeMenuRequestId = requestId;
        Menu.nativeMenuRegistrations.set(requestId, {
            menu: this,
            payload,
            itemPropsById,
        });

        const positioningItem = activateFirstEntry
            ? items.findIndex((item) => item.type !== "separator" && (item.enabled ?? true))
            : undefined;
        const openAtCursor = !activateFirstEntry && currentTarget.width <= 2 && currentTarget.height <= 2;
        const popupCoordinates = openAtCursor
            ? undefined
            : (() => {
                const { x: anchorX, y: anchorY } = this.getNativeMenuCoordinates(currentTarget);
                return { x: anchorX, y: anchorY };
            })();

        this.props.onOpen?.(this.props);
        const requestPromise = window.electronHost?.showNativeMenu?.({
            id: requestId,
            x: popupCoordinates?.x,
            y: popupCoordinates?.y,
            items,
            positioningItem: positioningItem !== undefined && positioningItem > -1 ? positioningItem : undefined,
        });
        void requestPromise?.catch(() => {
            Menu.nativeMenuRegistrations.delete(requestId);
            this.handleNativeMenuClose(requestId, true);
        });
    };

    private serializeNativeMenuItems = (children: ComponentChild, payload: unknown,
        itemPropsById: Map<string, IMenuItemProperties>, path = "root"): IElectronNativeMenuItem[] => {
        const elements = collectVNodes<IMenuItemProperties>(children);

        return elements.map((child, index): IElectronNativeMenuItem => {
            const { command, disabled } = this.resolveMenuItem(child.props, payload);
            const itemId = `${path}.${index}`;
            const submenu = collectVNodes<IMenuItemProperties>(child.props.children);
            const resolvedProps = {
                ...child.props,
                command,
                disabled,
            } satisfies IMenuItemProperties;

            if (command.title === "-") {
                return {
                    id: itemId,
                    type: "separator",
                };
            }

            if (submenu.length > 0) {
                return {
                    id: itemId,
                    label: command.title,
                    enabled: !disabled,
                    submenu: this.serializeNativeMenuItems(child.props.children, payload, itemPropsById, itemId),
                };
            }

            itemPropsById.set(itemId, resolvedProps);

            return {
                id: itemId,
                label: command.title,
                enabled: !disabled,
                type: "normal",
                checked: child.props.checked,
                accelerator: child.props.accelerator,
            };
        });
    };

    private getNativeMenuCoordinates = (currentTarget: DOMRect): { x: number; y: number; } => {
        switch (this.props.placement ?? ComponentPlacement.RightTop) {
            case ComponentPlacement.TopCenter:
                return { x: currentTarget.x + (currentTarget.width / 2), y: currentTarget.y };

            case ComponentPlacement.TopRight:
                return { x: currentTarget.x + currentTarget.width, y: currentTarget.y };

            case ComponentPlacement.RightTop:
                return { x: currentTarget.x + currentTarget.width, y: currentTarget.y };

            case ComponentPlacement.RightCenter:
                return {
                    x: currentTarget.x + currentTarget.width,
                    y: currentTarget.y + (currentTarget.height / 2),
                };

            case ComponentPlacement.RightBottom:
                return {
                    x: currentTarget.x + currentTarget.width,
                    y: currentTarget.y + currentTarget.height,
                };

            case ComponentPlacement.BottomCenter:
                return {
                    x: currentTarget.x + (currentTarget.width / 2),
                    y: currentTarget.y + currentTarget.height,
                };

            case ComponentPlacement.BottomRight:
                return {
                    x: currentTarget.x + currentTarget.width,
                    y: currentTarget.y + currentTarget.height,
                };

            case ComponentPlacement.LeftTop:
                return { x: currentTarget.x, y: currentTarget.y };

            case ComponentPlacement.LeftCenter:
                return {
                    x: currentTarget.x,
                    y: currentTarget.y + (currentTarget.height / 2),
                };

            case ComponentPlacement.LeftBottom:
                return {
                    x: currentTarget.x,
                    y: currentTarget.y + currentTarget.height,
                };

            case ComponentPlacement.TopLeft:
                return { x: currentTarget.x, y: currentTarget.y };

            case ComponentPlacement.BottomLeft:
            default:
                return {
                    x: currentTarget.x,
                    y: currentTarget.y + currentTarget.height,
                };
        }
    };

    private handleNativeMenuSelection = (props: IMenuItemProperties, payload: unknown): void => {
        void this.props.onItemClick?.(props, false, payload);
    };

    private handleNativeMenuClose = (requestId: string, cancelled: boolean): void => {
        if (this.nativeMenuRequestId === requestId) {
            this.nativeMenuRequestId = undefined;
        }

        this.setState({ activeItemIndex: -1, open: false });
        this.props.onClose?.(cancelled, this.props);
    };

}

Menu.initialize();
