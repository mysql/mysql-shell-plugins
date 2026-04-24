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
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { fireEvent, render } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";

import { Codicon } from "../../../../components/ui/Codicon.js";
import { Icon } from "../../../../components/ui/Icon/Icon.js";
import { Label } from "../../../../components/ui/Label/Label.js";
import { Menu } from "../../../../components/ui/Menu/Menu.js";
import { MenuItem } from "../../../../components/ui/Menu/MenuItem.js";
import { SplitButton } from "../../../../components/ui/SplitButton/SplitButton.js";
import { Toolbar } from "../../../../components/ui/Toolbar/Toolbar.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import { KeyboardKeys } from "../../../../utilities/helpers.js";
import { nextRunLoop } from "../../test-helpers.js";

const createMenu = (onItemClick = vi.fn()) => {
    return (
        <Menu id="splitButtonMenu" onItemClick={onItemClick}>
            <MenuItem id="firstAction" command={{ title: "First Action", command: "firstAction" }} />
            <MenuItem id="secondAction" command={{ title: "Second Action", command: "secondAction" }} />
        </Menu>
    );
};

describe("SplitButton component tests", (): void => {
    it("Test SplitButton output (Snapshot)", () => {
        const { container, unmount } = render(
            <div>
                <SplitButton
                    id="splitButton1"
                    menu={createMenu()}
                    title="Run query"
                >
                    <Icon src={Codicon.Play} />
                    <Label caption="Run Query" />
                </SplitButton>
                <SplitButton
                    id="splitButton2"
                    caption="Disabled"
                    disabled
                    menu={createMenu()}
                />
                <Toolbar id="toolbar">
                    <SplitButton
                        id="splitButton3"
                        caption="Toolbar Action"
                        menu={createMenu()}
                    />
                </Toolbar>
            </div>,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("calls the primary click handler", () => {
        const onClick = vi.fn();
        const { container, unmount } = render(
            <SplitButton menu={createMenu()} onClick={onClick}>
                <Icon src={Codicon.Play} />
                <Label caption="Run Query" />
            </SplitButton>,
        );

        const primary = container.querySelector(".splitButtonPrimary") as HTMLElement;
        fireEvent.click(primary);

        expect(onClick).toHaveBeenCalledTimes(1);

        unmount();
    });

    it("dispatches requestType instead of onClick", () => {
        const requestHandler = vi.fn(() => {
            return Promise.resolve(true);
        });
        const onClick = vi.fn();
        requisitions.register("editorCommit", requestHandler);

        const { container, unmount } = render(
            <SplitButton menu={createMenu()} onClick={onClick} requestType="editorCommit" caption="Commit" />,
        );

        const primary = container.querySelector(".splitButtonPrimary") as HTMLElement;
        fireEvent.click(primary);

        expect(requestHandler).toHaveBeenCalledTimes(1);
        expect(onClick).not.toHaveBeenCalled();

        requisitions.unregister("editorCommit");
        unmount();
    });

    it("opens the menu from the trigger and forwards menu item clicks", async () => {
        const onItemClick = vi.fn();
        const { container, unmount } = render(
            <SplitButton menu={createMenu(onItemClick)} caption="Run Query" />,
        );

        const trigger = container.querySelector(".splitButtonTrigger") as HTMLElement;
        fireEvent.click(trigger);
        await nextRunLoop();

        const portal = document.getElementsByClassName("portal")[0] as HTMLElement;
        expect(portal).toBeDefined();

        const firstItem = portal.getElementsByClassName("menuItem")[0] as HTMLElement;
        fireEvent.click(firstItem);

        expect(onItemClick).toHaveBeenCalledTimes(1);

        unmount();
    });

    it("anchors DOM fallback menus to the full split button", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
                showNativeMenu: vi.fn().mockResolvedValue(undefined),
                closeNativeMenu: vi.fn().mockResolvedValue(undefined),
                setNativeMenuHandler: vi.fn(),
            },
        });

        const onItemClick = vi.fn();
        const { container, unmount } = render(
            <SplitButton
                menu={<Menu useNativeMenu={false} onItemClick={onItemClick}><MenuItem command={{ title: "First", command: "first" }} /></Menu>}
                caption="Run Query"
            />,
        );

        const splitButton = container.querySelector(".splitButton") as HTMLElement;
        vi.spyOn(splitButton, "getBoundingClientRect").mockReturnValue({
            x: 100,
            y: 20,
            width: 80,
            height: 24,
            left: 100,
            top: 20,
            right: 180,
            bottom: 44,
            toJSON: () => "",
        } as DOMRect);

        const trigger = container.querySelector(".splitButtonTrigger") as HTMLElement;
        fireEvent.click(trigger);
        await nextRunLoop();

        expect(document.getElementsByClassName("portal")).toHaveLength(1);

        unmount();
    });

    it("supports keyboard activation for the primary action and trigger menu", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: undefined,
        });

        const onClick = vi.fn();
        const { container, unmount } = render(
            <SplitButton menu={createMenu()} onClick={onClick} caption="Run Query" />,
        );

        const primary = container.querySelector(".splitButtonPrimary") as HTMLElement;
        fireEvent.keyDown(primary, { key: KeyboardKeys.Enter });
        fireEvent.keyDown(primary, { key: KeyboardKeys.Space });

        expect(onClick).toHaveBeenCalledTimes(2);

        const trigger = container.querySelector(".splitButtonTrigger") as HTMLElement;
        fireEvent.keyDown(trigger, { key: KeyboardKeys.ArrowDown });
        await nextRunLoop();

        expect(document.getElementsByClassName("portal")).toHaveLength(1);

        unmount();
    });

    it("blocks both primary and menu activation when disabled", async () => {
        const onClick = vi.fn();
        const onItemClick = vi.fn();
        const { container, unmount } = render(
            <SplitButton
                menu={createMenu(onItemClick)}
                onClick={onClick}
                caption="Run Query"
                disabled
            />,
        );

        const primary = container.querySelector(".splitButtonPrimary") as HTMLElement;
        const trigger = container.querySelector(".splitButtonTrigger") as HTMLElement;

        fireEvent.click(primary);
        fireEvent.keyDown(primary, { key: KeyboardKeys.Enter });
        fireEvent.click(trigger);
        fireEvent.keyDown(trigger, { key: KeyboardKeys.ArrowDown });
        await nextRunLoop();

        expect(onClick).not.toHaveBeenCalled();
        expect(onItemClick).not.toHaveBeenCalled();
        expect(document.getElementsByClassName("portal")).toHaveLength(0);

        unmount();
    });
});
