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

import "@testing-library/jest-dom";
import { fireEvent, render, waitFor } from "@testing-library/preact";

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
        const rendered = render(
            <Tabview
                pages={examplePages}
            />,
        );

        expect(rendered.queryByText("One")).toBeVisible();
        expect(rendered.queryByText("Two")).toBeVisible();
        expect(rendered.queryByText("Three")).toBeVisible();

        expect(rendered.queryByText("Content")).toBeNull();
    });

    it("Test selected tab contents is present", () => {
        const rendered = render(
            <Tabview
                pages={examplePages}
                selectedId="2"
            />,
        );

        expect(rendered.queryByTestId("content-1")).toBeNull();
        expect(rendered.getByTestId("content-2")).toBeVisible();
        expect(rendered.queryByTestId("content-3")).toBeNull();
    });

    it("Test select other tab", () => {
        const onSelectTab = jest.fn();

        const rendered = render(
            <Tabview
                pages={examplePages}
                selectedId="2"
                onSelectTab={onSelectTab}
            />,
        );

        fireEvent.click(rendered.getByText("One") as Element);

        expect(onSelectTab).toHaveBeenCalledWith("1");
    });

    it("Test context menu", () => {
        const rendered = render(
            <Tabview
                pages={examplePages}
                selectedId="1"
                closeTabs={jest.fn()}
            />,
        );

        expect(queryMenu()).toBeNull();
        fireEvent.contextMenu(rendered.getByText("One") as Element);

        expect(queryMenu()).toBeVisible();

        expect(rendered.getByText("Close")).toBeVisible();
        expect(rendered.getByText("Close Others")).toBeVisible();
        expect(rendered.getByText("Close to the Right")).toBeVisible();
        expect(rendered.getByText("Close All")).toBeVisible();
    });

    it("Test close current tab", async () => {
        const closeTabs = jest.fn();

        const rendered = render(
            <Tabview
                pages={examplePages}
                selectedId="3"
                closeTabs={closeTabs}
            />,
        );

        fireEvent.contextMenu(rendered.getByText("Three") as Element);
        fireEvent.click(rendered.getByText("Close") as Element);

        expect(closeTabs).toHaveBeenCalledWith(["3"]);

        await waitFor(() => {
            expect(rendered.queryByText("Close")).not.toBeInTheDocument();
        }, { timeout: 100 });
    });

    it("Test close other tabs", () => {
        const closeTabs = jest.fn();

        const rendered = render(
            <Tabview
                pages={examplePages}
                selectedId="3"
                closeTabs={closeTabs}
            />,
        );

        fireEvent.contextMenu(rendered.getByText("One") as Element);
        fireEvent.click(rendered.getByText("Close Others") as Element);

        expect(closeTabs).toHaveBeenCalledWith(["3"]);
    });

    it("Test close all tabs", () => {
        const closeTabs = jest.fn();

        const rendered = render(
            <Tabview
                pages={examplePages}
                selectedId="3"
                closeTabs={closeTabs}
            />,
        );

        fireEvent.contextMenu(rendered.getByText("Three") as Element);
        fireEvent.click(rendered.getByText("Close All") as Element);

        expect(closeTabs).toHaveBeenCalledWith(["1", "3"]);
    });

    it("Test close tabs to the right", () => {
        const closeTabs = jest.fn();

        const initialPages = [
            ...examplePages,
            {
                id: "4",
                caption: "Four",
                content: <h1 data-testid="content-4">Content 4</h1>,
                canClose: true,
            },
        ];
        const rendered = render(
            <Tabview
                pages={initialPages}
                selectedId="4"
                closeTabs={closeTabs}
            />,
        );

        expect(rendered.getByText("Four")).toBeVisible();
        expect(rendered.getByTestId("content-4")).toBeVisible();

        fireEvent.contextMenu(rendered.getByText("One") as Element);
        fireEvent.click(rendered.getByText("Close to the Right") as Element);

        expect(closeTabs).toHaveBeenCalledWith(["3", "4"]);
    });

    it("Test close right is disabled for the rightmost", () => {
        const rendered = render(
            <Tabview
                pages={examplePages}
                selectedId="2"
                closeTabs={jest.fn()}
            />,
        );

        fireEvent.contextMenu(rendered.getByText("Three") as Element);

        expect(document.getElementById(CloseMenuItem.CloseTab)).not.toHaveClass("disabled");
        expect(document.getElementById(CloseMenuItem.CloseOthers)).not.toHaveClass("disabled");
        expect(document.getElementById(CloseMenuItem.CloseRight)).toHaveClass("disabled");
        expect(document.getElementById(CloseMenuItem.CloseAll)).not.toHaveClass("disabled");
    });

    it("Test close others is disabled for the only one closable", () => {// ???
        const rendered = render(
            <Tabview
                pages={[{
                    id: "1",
                    caption: "One",
                    content: <h1 data-testid="content-1">Content 1</h1>,
                    canClose: true,
                }]}
                selectedId="1"
                closeTabs={jest.fn()}
            />,
        );

        fireEvent.contextMenu(rendered.getByText("One") as Element);

        expect(document.getElementById(CloseMenuItem.CloseTab)).not.toHaveClass("disabled");
        expect(document.getElementById(CloseMenuItem.CloseOthers)).toHaveClass("disabled");
        expect(document.getElementById(CloseMenuItem.CloseRight)).toHaveClass("disabled");
        expect(document.getElementById(CloseMenuItem.CloseAll)).not.toHaveClass("disabled");
    });

    it("Test no context menu without closable tabs", () => {
        const rendered = render(
            <Tabview
                pages={[{
                    id: "2",
                    caption: "Two",
                    content: <h1 data-testid="content-2">Content 2</h1>,
                }]}
                selectedId="2"
                closeTabs={jest.fn()}
            />,
        );

        fireEvent.contextMenu(rendered.getByText("Two") as Element);

        expect(queryMenu()).toBeNull();
        expect(rendered.queryByText("Close")).toBeNull();
        expect(rendered.queryByText("Close Others")).toBeNull();
        expect(rendered.queryByText("Close to the Right")).toBeNull();
        expect(rendered.queryByText("Close All")).toBeNull();
    });

    it("Test only close all is enabled for non-closable tab", () => {
        const rendered = render(
            <Tabview
                pages={examplePages}
                selectedId="2"
                closeTabs={jest.fn()}
            />,
        );

        fireEvent.contextMenu(rendered.getByText("Two") as Element);

        expect(queryMenu()).toBeVisible();

        expect(document.getElementById(CloseMenuItem.CloseTab)).toHaveClass("disabled");
        expect(document.getElementById(CloseMenuItem.CloseOthers)).toHaveClass("disabled");
        expect(document.getElementById(CloseMenuItem.CloseRight)).toHaveClass("disabled");
        expect(document.getElementById(CloseMenuItem.CloseAll)).not.toHaveClass("disabled");
    });

    it("Test no context menu without closeTab prop", () => {
        const rendered = render(
            <Tabview
                pages={examplePages}
                selectedId="1"
            />,
        );

        fireEvent.contextMenu(rendered.getByText("One") as Element);

        expect(queryMenu()).toBeNull();
        expect(rendered.queryByText("Close")).toBeNull();
        expect(rendered.queryByText("Close Others")).toBeNull();
        expect(rendered.queryByText("Close to the Right")).toBeNull();
        expect(rendered.queryByText("Close All")).toBeNull();
    });

    it("Test cannot close", async () => {
        const cannotCloseId = "4";
        const closeTabs = jest.fn();
        const canCloseTab = jest.fn().mockImplementation((arg: string) => {
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
        const rendered = render(
            <Tabview
                pages={initialPages}
                selectedId={"1"}
                closeTabs={closeTabs}
                canCloseTab={canCloseTab}
            />,
        );

        fireEvent.contextMenu(rendered.getByText("One") as Element);
        fireEvent.click(rendered.getByText("Close All") as Element);

        await nextProcessTick();
        expect(canCloseTab).toHaveBeenCalledTimes(3);
        expect(closeTabs).toHaveBeenCalledTimes(1);
        expect(closeTabs).toHaveBeenCalledWith(["1", "3"]);
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
