/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import { fireEvent, render, waitFor } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";

import { CloseMenuItem, ITabviewPage, Tabview } from "../../../../components/ui/Tabview/Tabview.js";
import { nextProcessTick } from "../../test-helpers.js";

const examplePages: ITabviewPage[] = [
    {
        id: "1",
        caption: "One",
        content: <h1 data-testid="content-1">Content 1</h1>,
        canClose: true,
    },
    {
        id: "2",
        caption: "Two",
        content: <h1 data-testid="content-2">Content 2</h1>,
    },
    {
        id: "3",
        caption: "Three",
        content: <h1 data-testid="content-3">Content 3</h1>,
        canClose: true,
    },
];

describe("Tabview component tests", (): void => {
    const queryMenu = () => {
        return document.querySelector(".popup.menu.visible");
    };

    it("Test only captions are visible", () => {
        const { unmount, queryByText } = render(
            <Tabview
                pages={examplePages}
            />,
        );

        expect(queryByText("One")).toBeDefined();
        expect(queryByText("Two")).toBeDefined();
        expect(queryByText("Three")).toBeDefined();

        expect(queryByText("Content")).toBeNull();

        unmount();
    });

    it("Test selected tab contents is present", () => {
        const { unmount, queryByTestId } = render(
            <Tabview
                pages={examplePages}
                selectedId="2"
            />,
        );

        expect(queryByTestId("content-1")).toBeNull();
        expect(queryByTestId("content-2")).toBeDefined();
        expect(queryByTestId("content-3")).toBeNull();

        unmount();
    });

    it("Test select other tab", () => {
        const onSelectTab = vi.fn();

        const { unmount, getByText } = render(
            <Tabview
                pages={examplePages}
                selectedId="2"
                onSelectTab={onSelectTab}
            />,
        );

        fireEvent.click(getByText("One") as Element);

        expect(onSelectTab).toHaveBeenCalledWith("1");

        unmount();
    });

    it("Test context menu", () => {
        const { unmount, getByText } = render(
            <Tabview
                pages={examplePages}
                selectedId="1"
                closeTabs={vi.fn()}
            />,
        );

        expect(queryMenu()).toBeNull();
        fireEvent.contextMenu(getByText("One"));

        expect(queryMenu()).toBeTruthy();

        expect(getByText("Close")).toBeTruthy();
        expect(getByText("Close Others")).toBeTruthy();
        expect(getByText("Close to the Right")).toBeTruthy();
        expect(getByText("Close All")).toBeTruthy();

        unmount();
    });

    it("Test close current tab", async () => {
        const closeTabs = vi.fn();

        const { unmount, getByText, queryByText } = render(
            <Tabview
                pages={examplePages}
                selectedId="3"
                closeTabs={closeTabs}
            />,
        );

        fireEvent.contextMenu(getByText("Three") as Element);
        fireEvent.click(getByText("Close") as Element);

        expect(closeTabs).toHaveBeenCalledWith(["3"]);

        await waitFor(() => {
            expect(queryByText("Close")).toBeNull();
        }, { timeout: 100 });

        unmount();
    });

    it("Test close other tabs", () => {
        const closeTabs = vi.fn();

        const { unmount, getByText } = render(
            <Tabview
                pages={examplePages}
                selectedId="3"
                closeTabs={closeTabs}
            />,
        );

        fireEvent.contextMenu(getByText("One") as Element);
        fireEvent.click(getByText("Close Others") as Element);

        expect(closeTabs).toHaveBeenCalledWith(["3"]);

        unmount();
    });

    it("Test close all tabs", () => {
        const closeTabs = vi.fn();

        const { unmount, getByText } = render(
            <Tabview
                pages={examplePages}
                selectedId="3"
                closeTabs={closeTabs}
            />,
        );

        fireEvent.contextMenu(getByText("Three") as Element);
        fireEvent.click(getByText("Close All") as Element);

        expect(closeTabs).toHaveBeenCalledWith(["1", "3"]);

        unmount();
    });

    it("Test close tabs to the right", () => {
        const closeTabs = vi.fn();

        const initialPages = [
            ...examplePages,
            {
                id: "4",
                caption: "Four",
                content: <h1 data-testid="content-4">Content 4</h1>,
                canClose: true,
            },
        ];
        const { unmount, getByText, getByTestId } = render(
            <Tabview
                pages={initialPages}
                selectedId="4"
                closeTabs={closeTabs}
            />,
        );

        expect(getByText("Four")).toBeDefined();
        expect(getByTestId("content-4")).toBeDefined();

        fireEvent.contextMenu(getByText("One") as Element);
        fireEvent.click(getByText("Close to the Right") as Element);

        expect(closeTabs).toHaveBeenCalledWith(["3", "4"]);

        unmount();
    });

    it("Test close right is disabled for the rightmost", () => {
        const { unmount, getByText } = render(
            <Tabview
                pages={examplePages}
                selectedId="2"
                closeTabs={vi.fn()}
            />,
        );

        fireEvent.contextMenu(getByText("Three") as Element);

        expect(document.getElementById(CloseMenuItem.CloseTab)!.classList.contains("disabled")).toBeFalsy();
        expect(document.getElementById(CloseMenuItem.CloseOthers)!.classList.contains("disabled")).toBeFalsy();
        expect(document.getElementById(CloseMenuItem.CloseRight)!.classList.contains("disabled")).toBeTruthy();
        expect(document.getElementById(CloseMenuItem.CloseAll)!.classList.contains("disabled")).toBeFalsy();

        unmount();
    });

    it("Test close others is disabled for the only one closable", () => {
        const { unmount, getByText } = render(
            <Tabview
                pages={[{
                    id: "1",
                    caption: "One",
                    content: <h1 data-testid="content-1">Content 1</h1>,
                    canClose: true,
                }]}
                selectedId="1"
                closeTabs={vi.fn()}
            />,
        );

        fireEvent.contextMenu(getByText("One") as Element);

        expect(document.getElementById(CloseMenuItem.CloseTab)!.classList.contains("disabled")).toBeFalsy();
        expect(document.getElementById(CloseMenuItem.CloseOthers)!.classList.contains("disabled")).toBeTruthy();
        expect(document.getElementById(CloseMenuItem.CloseRight)!.classList.contains("disabled")).toBeTruthy();
        expect(document.getElementById(CloseMenuItem.CloseAll)!.classList.contains("disabled")).toBeFalsy();

        unmount();
    });

    it("Test no context menu without closable tabs", () => {
        const { unmount, queryByText } = render(
            <Tabview
                pages={[{
                    id: "2",
                    caption: "Two",
                    content: <h1 data-testid="content-2">Content 2</h1>,
                }]}
                selectedId="2"
                closeTabs={vi.fn()}
            />,
        );

        fireEvent.contextMenu(queryByText("Two") as Element);

        expect(queryMenu()).toBeNull();
        expect(queryByText("Close")).toBeNull();
        expect(queryByText("Close Others")).toBeNull();
        expect(queryByText("Close to the Right")).toBeNull();
        expect(queryByText("Close All")).toBeNull();

        unmount();
    });

    it("Test only close all is enabled for non-closable tab", () => {
        const { unmount, getByText } = render(
            <Tabview
                pages={examplePages}
                selectedId="2"
                closeTabs={vi.fn()}
            />,
        );

        fireEvent.contextMenu(getByText("Two"));

        expect(queryMenu()).toBeDefined();

        expect(document.getElementById(CloseMenuItem.CloseTab)!.classList.contains("disabled")).toBeTruthy();
        expect(document.getElementById(CloseMenuItem.CloseOthers)!.classList.contains("disabled")).toBeTruthy();
        expect(document.getElementById(CloseMenuItem.CloseRight)!.classList.contains("disabled")).toBeTruthy();
        expect(document.getElementById(CloseMenuItem.CloseAll)!.classList.contains("disabled")).toBeFalsy();

        unmount();
    });

    it("Test no context menu without closeTab prop", () => {
        const { unmount, queryByText } = render(
            <Tabview
                pages={examplePages}
                selectedId="1"
            />,
        );

        expect(queryMenu()).toBeNull();
        expect(queryByText("Close")).toBeNull();
        expect(queryByText("Close Others")).toBeNull();
        expect(queryByText("Close to the Right")).toBeNull();
        expect(queryByText("Close All")).toBeNull();

        unmount();
    });

    it("Test cannot close", async () => {
        const cannotCloseId = "4";
        const closeTabs = vi.fn();
        const canCloseTab = vi.fn().mockImplementation((arg: string) => {
            return arg !== cannotCloseId;
        });

        const initialPages = [
            ...examplePages,
            {
                id: cannotCloseId,
                caption: "Four",
                content: <h1 data-testid="content-4">Content 4</h1>,
                canClose: true,
            },
        ];
        const { unmount, getByText } = render(
            <Tabview
                pages={initialPages}
                selectedId={"1"}
                closeTabs={closeTabs}
                canCloseTab={canCloseTab}
            />,
        );

        fireEvent.contextMenu(getByText("One") as Element);
        fireEvent.click(getByText("Close All") as Element);

        await nextProcessTick();
        expect(canCloseTab).toHaveBeenCalledTimes(3);
        expect(closeTabs).toHaveBeenCalledTimes(1);
        expect(closeTabs).toHaveBeenCalledWith(["1", "3"]);

        unmount();
    });

    describe("Tabview::getSelectedPageId tests", (): void => {
        it("Returns default selection when there are no pages", () => {
            const result = Tabview.getSelectedPageId([], undefined, [], "default");

            expect(result).toEqual("default");
        });

        it("Returns previously selected if it's not closing", () => {
            const result = Tabview.getSelectedPageId(["prev", "other"], "prev", ["closed"], "default");

            expect(result).toEqual("prev");
        });

        it("Returns the rightmost page if current is closing", () => {
            const result = Tabview.getSelectedPageId(["one", "two"], "three", ["three"], "default");

            expect(result).toEqual("two");
        });
    });
});
