/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import { render, screen } from "@testing-library/preact";
import { act } from "preact/test-utils";
import { describe, expect, it, vi } from "vitest";

import { Orientation } from "../../../../components/ui/Container/Container.js";
import { Label } from "../../../../components/ui/Label/Label.js";
import { Selector } from "../../../../components/ui/Selector/Selector.js";
import { Assets } from "../../../../supplement/Assets.js";

const icon = Assets.documents.overviewPageIcon as string;

describe("Selector component tests", (): void => {

    const itemArray = [
        { caption: "1", icon },
        { caption: "2", icon },
        { caption: "3", icon },
        { caption: "4", icon },
        { caption: "5", icon },
        { caption: "6", icon },
        { caption: "7", icon },
        { caption: "8", icon },
        { caption: "9", icon },
        { caption: "10", icon },
    ];

    it("Test Selector onSelect callback", async () => {
        const onSelect = vi.fn();
        const { container, unmount } = render(
            <Selector
                id="selector1"
                orientation={Orientation.TopDown}
                smoothScroll={true}
                onSelect={onSelect}
                items={[
                    { id: "id1", caption: "1", icon: Assets.documents.overviewPageIcon },
                    { id: "id2", caption: "2", icon: Assets.documents.overviewPageIcon },
                    { id: "id3", caption: "3", icon: Assets.documents.overviewPageIcon },
                    { id: "id4", caption: "4", icon: Assets.documents.overviewPageIcon },
                    { id: "id5", caption: "5", icon: Assets.documents.overviewPageIcon },
                    { id: "id6", caption: "6", icon: Assets.documents.overviewPageIcon },
                    { id: "id7", caption: "7", icon: Assets.documents.overviewPageIcon },
                    { id: "id8", caption: "8", icon: Assets.documents.overviewPageIcon },
                    { id: "id9", caption: "9", icon: Assets.documents.overviewPageIcon },
                    { id: "id10", caption: "10", icon: Assets.documents.overviewPageIcon },
                ]}
            />,
        );

        await act(() => {
            const item = container.querySelector("#id5") as HTMLElement;
            item.click();
        });

        expect(onSelect).toHaveBeenCalled();

        unmount();
    });

    it("Test Selector with children", () => {
        const { container, unmount } = render(
            <Selector
                id="selector1"
                orientation={Orientation.TopDown}
                smoothScroll={true}
            >
                <Label>Lorem Ipsum</Label>
                123
            </Selector>,
        );

        // The text "123" is not rendered as a child of the selector, because only preact elements
        // are rendered as children.
        expect(container.childNodes).toHaveLength(1);

        const t = screen.getByText("Lorem Ipsum");
        expect(t).toBeTruthy();
        expect(t.textContent).toEqual("Lorem Ipsum");

        unmount();
    });

    it("Test Selector output (snapshot)", () => {
        const { container, unmount } = render(
            <Selector
                id="selector1"
                orientation={Orientation.TopDown}
                smoothScroll={true}
                items={itemArray}
            />,
        );
        expect(container).toMatchSnapshot();

        unmount();
    });

});
