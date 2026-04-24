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

import { cleanup, fireEvent, render, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComponentPlacement } from "../../../../components/ui/Component/ComponentBase.js";
import { Menu } from "../../../../components/ui/Menu/Menu.js";
import { MenuBar } from "../../../../components/ui/Menu/MenuBar.js";
import { MenuItem } from "../../../../components/ui/Menu/MenuItem.js";
import { Assets } from "../../../../supplement/Assets.js";
import { nextRunLoop } from "../../test-helpers.js";
import { createRef } from "preact";

describe("Menu component tests", (): void => {
    afterEach(() => {
        cleanup();
        Reflect.deleteProperty(window, "electronHost");
        vi.restoreAllMocks();
        (Menu as unknown as { menuStack: Menu[] }).menuStack.length = 0;
        const menuStatics = Menu as unknown as {
            nativeMenuRegistrations: Map<string, unknown>;
            nativeMenuHandlerRegistered: boolean;
            nativeMenuSequence: number;
        };
        menuStatics.nativeMenuRegistrations.clear();
        menuStatics.nativeMenuHandlerRegistered = false;
        menuStatics.nativeMenuSequence = 0;
    });

    it("Test Menu output (snapshot)", () => {
        const { container, unmount } = render(
            <Menu
                id="tileActionMenu"
                placement={ComponentPlacement.BottomLeft}
                onItemClick={vi.fn()}
            >
                <MenuItem command={{ title: "Heading", command: "item1" }} disabled />
                <MenuItem command={{ title: "Cut", command: "item2" }} />
                <MenuItem command={{ title: "Copy", command: "item3" }} />
                <MenuItem command={{ title: "Sub Menu 0", command: "" }}>
                    <MenuItem id="item5" icon={Assets.misc.cloneIcon} command={{ title: "Item 1", command: "" }} />
                    <MenuItem id="item6" icon={Assets.misc.cloneIcon} command={{ title: "Item 2", command: "" }} />
                    <MenuItem id="item7" icon={Assets.misc.cloneIcon} command={{ title: "Item 3", command: "" }} />
                    <MenuItem id="item8" icon={Assets.misc.cloneIcon} command={{ title: "Item 4", command: "" }} />
                </MenuItem>
                <MenuItem command={{ title: "-", command: "" }} disabled />
                <MenuItem id="item11" command={{ title: "Delete", command: "" }} icon={Assets.misc.cloneIcon} />
                <MenuItem command={{ title: "-", command: "" }} disabled />
                <MenuItem id="item13" icon={Assets.misc.cloneIcon} command={{ title: "Sub Menu 1", command: "" }} >
                    <MenuItem id="item20" command={{ title: "Item 1", command: "" }} />
                    <MenuItem id="item21" command={{ title: "Item 2", command: "" }} />
                    <MenuItem id="item22" command={{ title: "Item 3", command: "" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem id="item30" command={{ title: "Item 4", command: "" }} />
                    <MenuItem id="item31" icon={Assets.misc.cloneIcon} command={{ title: "Sub Menu 2", command: "" }} >
                        <MenuItem id="item40" command={{ title: "Item 1", command: "" }} />
                        <MenuItem id="item41" command={{ title: "Item 2", command: "" }} />
                        <MenuItem id="item42" command={{ title: "Item 3", command: "" }} />
                        <MenuItem command={{ title: "-", command: "" }} disabled />
                        <MenuItem id="item44" command={{ title: "Item 4", command: "" }} />
                        <MenuItem id="item45"
                            icon={Assets.misc.cloneIcon}
                            command={{ title: "Sub Menu 2", command: "" }}
                        >
                            <MenuItem id="item50" command={{ title: "Item 1", command: "" }} />
                            <MenuItem id="item51" command={{ title: "Item 2", command: "" }} />
                            <MenuItem id="item52" command={{ title: "Item 3", command: "" }} />
                            <MenuItem command={{ title: "-", command: "" }} disabled />
                            <MenuItem id="item54" command={{ title: "Item 4", command: "" }} />
                            <MenuItem
                                id="item55"
                                icon={Assets.misc.cloneIcon}
                                command={{ title: "Sub Menu 2", command: "" }}
                            >
                                <MenuItem id="item60" command={{ title: "Item 1", command: "" }} />
                                <MenuItem id="item61" command={{ title: "Item 2", command: "" }} />
                                <MenuItem id="item62" command={{ title: "Item 3", command: "" }} />
                                <MenuItem command={{ title: "-", command: "" }} disabled />
                                <MenuItem id="item64" command={{ title: "Item 4", command: "" }} />
                                <MenuItem
                                    id="item65"
                                    icon={Assets.misc.cloneIcon}
                                    command={{ title: "Sub Menu 2", command: "" }}
                                >
                                    <MenuItem id="item70" command={{ title: "Item 1", command: "" }} />
                                    <MenuItem id="item71" command={{ title: "Item 2", command: "" }} />
                                    <MenuItem id="item72" command={{ title: "Item 3", command: "" }} />
                                    <MenuItem command={{ title: "-", command: "" }} disabled />
                                    <MenuItem id="item74" command={{ title: "Item 4", command: "" }} />
                                    <MenuItem
                                        id="item75"
                                        icon={Assets.misc.cloneIcon}
                                        command={{ title: "Sub Menu 2", command: "" }}
                                    >
                                        <MenuItem id="item80" command={{ title: "Item 1", command: "" }} />
                                        <MenuItem id="item81" command={{ title: "Item 2", command: "" }} />
                                        <MenuItem id="item82" command={{ title: "Item 3", command: "" }} />
                                        <MenuItem command={{ title: "-", command: "" }} disabled />
                                        <MenuItem id="item84" command={{ title: "Item 4", command: "" }} />
                                        <MenuItem id="item85"
                                            icon={Assets.misc.cloneIcon}
                                            command={{ title: "Item 5", command: "" }}
                                        />
                                    </MenuItem>
                                </MenuItem >
                            </MenuItem >
                        </MenuItem >
                    </MenuItem >
                </MenuItem >
            </Menu >,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Test MenuBar output (snapshot)", () => {
        const { container, unmount } = render(
            <MenuBar>
                <MenuItem id="fileMenu" command={{ title: "File", command: "" }} >
                    <MenuItem id="item80" command={{ title: "Item 1", command: "" }} />
                    <MenuItem id="item81" command={{ title: "Item 2", command: "" }} />
                    <MenuItem id="item82" command={{ title: "Item 3", command: "" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem id="item84" command={{ title: "Item 4", command: "" }} />
                    <MenuItem id="item65" icon={Assets.misc.cloneIcon} command={{ title: "Sub Menu 2", command: "" }}>
                        <MenuItem id="item70" command={{ title: "Item 1", command: "" }} />
                        <MenuItem id="item71" command={{ title: "Item 2", command: "" }} />
                        <MenuItem id="item72" command={{ title: "Item 3", command: "" }} />
                        <MenuItem command={{ title: "-", command: "" }} disabled />
                        <MenuItem id="item74" command={{ title: "Item 4", command: "" }} />
                        <MenuItem
                            id="item75"
                            icon={Assets.misc.cloneIcon}
                            command={{ title: "Sub Menu 2", command: "" }}
                        >
                            <MenuItem id="item80" command={{ title: "Item 1", command: "" }} />
                            <MenuItem id="item81" command={{ title: "Item 2", command: "" }} />
                            <MenuItem id="item82" command={{ title: "Item 3", command: "" }} />
                            <MenuItem command={{ title: "-", command: "" }} disabled />
                            <MenuItem id="item84" command={{ title: "Item 4", command: "" }} />
                            <MenuItem
                                id="item85"
                                icon={Assets.misc.cloneIcon}
                                command={{ title: "Item 5", command: "" }}
                            />
                        </MenuItem>
                    </MenuItem >
                </MenuItem >
                <MenuItem id="editMenu" command={{ title: "Edit", command: "" }} >
                    <MenuItem id="item80" command={{ title: "Item 1", command: "" }} />
                    <MenuItem id="item81" command={{ title: "Item 2", command: "" }} />
                    <MenuItem id="item82" command={{ title: "Item 3", command: "" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem id="item84" command={{ title: "Item 4", command: "" }} />
                </MenuItem>
                <MenuItem id="selectionMenu" command={{ title: "Selection", command: "" }}>
                    <MenuItem id="item80" command={{ title: "Item 1", command: "" }} />
                    <MenuItem id="item81" command={{ title: "Item 2", command: "" }} />
                    <MenuItem id="item82" command={{ title: "Item 3", command: "" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem id="item84" command={{ title: "Item 4", command: "" }} />
                </MenuItem >
                <MenuItem id="viewMenu" command={{ title: "View", command: "" }} >
                    <MenuItem id="item80" command={{ title: "Item 1", command: "" }} />
                    <MenuItem id="item81" command={{ title: "Item 2", command: "" }} />
                    <MenuItem id="item82" command={{ title: "Item 3", command: "" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem id="item84" command={{ title: "Item 4", command: "" }} />
                </MenuItem>
                <MenuItem id="goMenu" command={{ title: "Go", command: "" }}>
                    <MenuItem id="item80" command={{ title: "Item 1", command: "" }} />
                    <MenuItem id="item81" command={{ title: "Item 2", command: "" }} />
                    <MenuItem id="item82" command={{ title: "Item 3", command: "" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem id="item84" command={{ title: "Item 4", command: "" }} />
                </MenuItem >
            </MenuBar >,
        );
        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Test menu callbacks", async () => {
        const onItemClick = vi.fn();
        const menuRef = createRef<Menu>();

        const { container, unmount } = render(
            <Menu
                ref={menuRef}
                id="tileActionMenu"
                placement={ComponentPlacement.BottomLeft}
                onItemClick={onItemClick}
            >
                <MenuItem
                    id="edit"
                    command={{ title: "Edit Connection…", command: "edit" }}
                    icon={Assets.misc.cloneIcon}
                />
                <MenuItem
                    command={{ title: "Duplicate Connection…", command: "duplicate" }}
                    icon={Assets.misc.cloneIcon} />
                <MenuItem command={{ title: "-", command: "" }} disabled />
                <MenuItem
                    command={{ title: "Share Connection", command: "shareConnection" }}
                    icon={Assets.misc.cloneIcon}
                >
                    <MenuItem
                        command={{ title: "With User...", command: "shareWithUser" }}
                        icon={Assets.misc.cloneIcon}
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Profile 1", command: "profile1" }} icon={Assets.misc.cloneIcon} />
                    <MenuItem command={{ title: "Profile 2", command: "profile2" }} icon={Assets.misc.cloneIcon} />
                    <MenuItem command={{ title: "Profile 3", command: "profile3" }} icon={Assets.misc.cloneIcon} />
                </MenuItem>
                <MenuItem
                    command={{ title: "Copy Connection to Profile", command: "copyConnection" }}
                    icon={Assets.misc.cloneIcon}
                >
                    <MenuItem command={{ title: "Profile 1", command: "profile1" }} icon={Assets.misc.cloneIcon} />
                </MenuItem>
                <MenuItem command={{ title: "-", command: "" }} disabled />
                <MenuItem command={{ title: "Remove Connection…", command: "remove" }} />
            </Menu >,
        );

        await nextRunLoop();
        expect(menuRef.current).toBeDefined();
        expect(container).toMatchSnapshot();

        // Keep in mind here that menu (popup, portal) content is not rendered in the same DOM tree as the menu itself!

        const targetRect = new DOMRect(0, 0, 2, 2);
        menuRef.current!.open(targetRect, false);
        await nextRunLoop();

        const portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        const items = portals[0].getElementsByClassName("menuItem");
        expect(items).toHaveLength(7);

        fireEvent.click(items[0]);
        expect(onItemClick).toHaveBeenCalled();

        unmount;
    });

    it("keeps the menu open when a click handler returns false", async () => {
        const menuRef = createRef<Menu>();

        render(
            <Menu
                ref={menuRef}
                id="tileActionMenu"
                placement={ComponentPlacement.BottomLeft}
                onItemClick={(props) => {
                    return !props.children;
                }}
            >
                <MenuItem command={{ title: "Move to Folder", command: "" }}>
                    <MenuItem command={{ title: "Archive", command: "archive" }} />
                </MenuItem>
            </Menu>,
        );

        await nextRunLoop();
        menuRef.current!.open(new DOMRect(0, 0, 2, 2), false);
        await nextRunLoop();

        const portal = document.getElementsByClassName("portal")[0]!;
        fireEvent.click(portal.getElementsByClassName("menuItem")[0]);
        await nextRunLoop();

        expect(document.getElementsByClassName("portal")).toHaveLength(1);
    });

    it("closes the menu when clicking outside it", async () => {
        const menuRef = createRef<Menu>();
        const { getByTestId } = render(
            <>
                <div
                    data-testid="outside"
                    onClick={() => {
                        return;
                    }}
                >
                    Outside
                </div>
                <Menu
                    ref={menuRef}
                    id="tileActionMenu"
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={vi.fn()}
                >
                    <MenuItem command={{ title: "Edit Connection…", command: "edit" }} />
                </Menu>
            </>,
        );

        await nextRunLoop();

        menuRef.current!.open(new DOMRect(0, 0, 2, 2), false);
        await nextRunLoop();

        expect(document.getElementsByClassName("portal")).toHaveLength(1);

        fireEvent.click(getByTestId("outside"));
        await waitFor(() => {
            expect(document.getElementsByClassName("portal")).toHaveLength(0);
        });
    });

    it("closes the menu when outside mousedown stops bubbling", async () => {
        const menuRef = createRef<Menu>();
        const { getByTestId } = render(
            <>
                <div
                    data-testid="outside"
                    onMouseDown={(e) => {
                        e.stopPropagation();
                    }}
                >
                    Outside
                </div>
                <Menu
                    ref={menuRef}
                    id="tileActionMenu"
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={vi.fn()}
                >
                    <MenuItem command={{ title: "Edit Connection…", command: "edit" }} />
                </Menu>
            </>,
        );

        await nextRunLoop();

        menuRef.current!.open(new DOMRect(0, 0, 2, 2), false);
        await nextRunLoop();

        expect(document.getElementsByClassName("portal")).toHaveLength(1);

        fireEvent.mouseDown(getByTestId("outside"));
        await waitFor(() => {
            expect(document.getElementsByClassName("portal")).toHaveLength(0);
        });
    });

    it("keeps the parent menu closable after a submenu is closed from the parent menu", async () => {
        const menuRef = createRef<Menu>();
        const { getByTestId } = render(
            <>
                <div data-testid="outside">Outside</div>
                <Menu
                    ref={menuRef}
                    id="tileActionMenu"
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={vi.fn()}
                >
                    <MenuItem command={{ title: "Move to Folder", command: "" }}>
                        <MenuItem command={{ title: "Archive", command: "archive" }} />
                    </MenuItem>
                    <MenuItem command={{ title: "Rename", command: "rename" }} />
                </Menu>
            </>,
        );

        await nextRunLoop();

        menuRef.current!.open(new DOMRect(0, 0, 2, 2), false);
        await nextRunLoop();

        const menu = menuRef.current as unknown as {
            itemRefs: Array<{ current?: { openSubMenu: (activateFirstEntry: boolean) => void } }>;
        };
        menu.itemRefs[0].current?.openSubMenu(false);
        await nextRunLoop();

        expect(document.getElementsByClassName("portal")).toHaveLength(2);

        const rootPortal = document.getElementsByClassName("portal")[0]!;
        const rootItems = rootPortal.getElementsByClassName("menuItem");
        fireEvent.mouseEnter(rootItems[1]);
        await nextRunLoop();

        expect(document.getElementsByClassName("portal")).toHaveLength(1);
        expect((Menu as unknown as { menuStack: Menu[] }).menuStack).toEqual([menuRef.current]);

        fireEvent.mouseDown(getByTestId("outside"));
        await waitFor(() => {
            expect(document.getElementsByClassName("portal")).toHaveLength(0);
        });
    });

    it("serializes native Electron menus with resolved commands and checked state", async () => {
        const menuRef = createRef<Menu>();
        const onItemClick = vi.fn();
        const onClose = vi.fn();
        const showNativeMenu = vi.fn().mockResolvedValue(undefined);
        const closeNativeMenu = vi.fn().mockResolvedValue(undefined);
        let nativeMenuHandler: ((event: { type: "select" | "close"; requestId: string; itemId?: string;
            cancelled?: boolean; }) => void) | undefined;
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
                showNativeMenu,
                closeNativeMenu,
                setNativeMenuHandler: (handler: typeof nativeMenuHandler) => {
                    nativeMenuHandler = handler;
                },
            },
        });

        render(
            <Menu
                ref={menuRef}
                id="nativeMenu"
                placement={ComponentPlacement.BottomLeft}
                onItemClick={onItemClick}
                onClose={onClose}
                customCommand={(props, payload) => {
                    const typedPayload = payload as { hide: boolean; } | undefined;
                    if (props.command.command === "toggle") {
                        return {
                            title: typedPayload?.hide ? "Hide Private Items" : "Show Private Items",
                            command: typedPayload?.hide ? "hide" : "show",
                        };
                    }

                    return undefined;
                }}
                isItemDisabled={(props, payload) => {
                    const typedPayload = payload as { disableLeaf: boolean; } | undefined;

                    return props.command.command === "leaf" && Boolean(typedPayload?.disableLeaf);
                }}
            >
                <MenuItem command={{ title: "More", command: "" }}>
                    <MenuItem checked={true} command={{ title: "Stop on Error", command: "checked" }} />
                    <MenuItem command={{ title: "Show Private Items", command: "toggle" }} />
                </MenuItem>
                <MenuItem command={{ title: "Leaf Item", command: "leaf" }} />
            </Menu>,
        );

        menuRef.current!.open(new DOMRect(10, 20, 30, 40), true, undefined, { hide: true, disableLeaf: true });
        await nextRunLoop();

        expect(showNativeMenu).toHaveBeenCalledTimes(1);
        const request = showNativeMenu.mock.calls[0][0] as {
            id: string;
            positioningItem?: number;
            items: Array<{
                id: string;
                label?: string;
                enabled?: boolean;
                checked?: boolean;
                submenu?: Array<{ id: string; label?: string; checked?: boolean; }>;
            }>;
        };

        expect(request).toMatchObject({
            positioningItem: 0,
            items: [
                {
                    label: "More",
                    enabled: true,
                    submenu: [
                        { label: "Stop on Error", checked: true },
                        { label: "Hide Private Items", checked: undefined },
                    ],
                },
                {
                    label: "Leaf Item",
                    enabled: false,
                },
            ],
        });

        const toggleItem = request.items[0].submenu?.find((item) => {
            return item.label === "Hide Private Items";
        });
        expect(toggleItem).toBeTruthy();

        nativeMenuHandler?.({
            type: "select",
            requestId: request.id,
            itemId: toggleItem!.id,
        });
        await nextRunLoop();

        expect(onItemClick).toHaveBeenCalledWith(expect.objectContaining({
            command: expect.objectContaining({
                title: "Hide Private Items",
                command: "hide",
            }),
        }), false, { hide: true, disableLeaf: true });

        menuRef.current!.close();
        expect(closeNativeMenu).toHaveBeenCalledWith(request.id);

        nativeMenuHandler?.({
            type: "close",
            requestId: request.id,
            cancelled: false,
        });
        await nextRunLoop();

        expect(onClose).toHaveBeenCalledWith(false, expect.objectContaining({ id: "nativeMenu" }));
    });

    it("omits popup coordinates for point-target native menus", async () => {
        const menuRef = createRef<Menu>();
        const showNativeMenu = vi.fn().mockResolvedValue(undefined);
        const targetRect = {
            x: 10,
            y: 20,
            width: 2,
            height: 2,
            left: 10,
            top: 20,
            right: 12,
            bottom: 22,
            toJSON: () => "",
        } as unknown as DOMRect;

        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
                showNativeMenu,
                closeNativeMenu: vi.fn().mockResolvedValue(undefined),
                setNativeMenuHandler: vi.fn(),
            },
        });

        render(
            <Menu
                ref={menuRef}
                id="mouseNativeMenu"
                placement={ComponentPlacement.BottomLeft}
                onItemClick={vi.fn()}
            >
                <MenuItem command={{ title: "First", command: "first" }} />
            </Menu>,
        );

        menuRef.current!.open(targetRect, false);
        await nextRunLoop();

        expect(showNativeMenu).toHaveBeenCalledTimes(1);
        const request = showNativeMenu.mock.calls[0][0] as {
            x?: number;
            y?: number;
            positioningItem?: number;
        };
        expect(request.x).toBeUndefined();
        expect(request.y).toBeUndefined();
        expect(request.positioningItem).toBeUndefined();
    });

    it("anchors non-point native menus to the supplied target rect", async () => {
        const menuRef = createRef<Menu>();
        const showNativeMenu = vi.fn().mockResolvedValue(undefined);
        const targetRect = {
            x: 10,
            y: 20,
            width: 30,
            height: 40,
            left: 10,
            top: 20,
            right: 40,
            bottom: 60,
            toJSON: () => "",
        } as unknown as DOMRect;

        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
                showNativeMenu,
                closeNativeMenu: vi.fn().mockResolvedValue(undefined),
                setNativeMenuHandler: vi.fn(),
            },
        });

        render(
            <Menu
                ref={menuRef}
                id="anchoredNativeMenu"
                placement={ComponentPlacement.BottomRight}
                onItemClick={vi.fn()}
            >
                <MenuItem command={{ title: "First", command: "first" }} />
            </Menu>,
        );

        menuRef.current!.open(targetRect, false);
        await nextRunLoop();

        expect(showNativeMenu).toHaveBeenCalledTimes(1);
        const request = showNativeMenu.mock.calls[0][0] as {
            x?: number;
            y?: number;
            positioningItem?: number;
        };
        expect(request.x).toBe(40);
        expect(request.y).toBe(60);
        expect(request.positioningItem).toBeUndefined();
    });

});
