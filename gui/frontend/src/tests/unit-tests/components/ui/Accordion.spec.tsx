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

import { render } from "@testing-library/preact";
import { act } from "preact/test-utils";
import { describe, expect, it, vi } from "vitest";

import { Accordion } from "../../../../components/ui/Accordion/Accordion.js";
import { Codicon } from "../../../../components/ui/Codicon.js";
import { Assets } from "../../../../supplement/Assets.js";

const icon = Assets.documents.overviewPageIcon as string;

describe("Accordion component tests", (): void => {

    it("Test Accordion callbacks", async () => {
        const onSectionExpand = vi.fn();
        const onSectionAction = vi.fn();

        const { container, unmount } = render(
            <Accordion
                id="sidebar1"
                style={{
                    borderWidth: "1px",
                    borderStyle: "solid",
                }}
                caption="SIDEBAR TITLE"
                footer={"Lorem ipsum dolor sit amen, consenter"}
                singleExpand={true}
                onSectionExpand={onSectionExpand}
                onSectionAction={onSectionAction}

                sections={[
                    {
                        caption: "FIRST SECTION",
                        id: "first",
                        expanded: false,
                        content: [
                            <Accordion.Item id="item1" key="item1" caption="Item 1" />,
                            <Accordion.Item id="item2" key="item2" caption="Item 2" />,
                            <Accordion.Item id="item3" key="item3" caption="Item 3" />,
                        ],
                    },
                    {
                        caption: "SECOND SECTION",
                        actions: [
                            {
                                icon: Codicon.NewFile,
                                command: {
                                    title: "Add New Console",
                                    command: "addConsole",
                                    tooltip: "Add new console",
                                },
                            },
                        ],
                        id: "second",
                        content: [
                            <Accordion.Item
                                id="item5"
                                key="item5"
                                caption="Item 5"
                                picture={icon}
                            />,
                            <Accordion.Item
                                id="item6"
                                key="item6"
                                caption="Item 6"
                                picture={icon}
                            />,
                            <Accordion.Item
                                id="item7"
                                key="item7"
                                caption="Item 7"
                                picture={icon}
                            />,
                        ],
                    },
                    {
                        caption: "THIRD SECTION",
                        id: "third",
                        content: [
                            <Accordion.Item id="item9" key="item9" caption="Item 9" />,
                            <Accordion.Item id="item10" key="item10" caption="Item 10" />,
                            <Accordion.Item id="item11" key="item11" caption="Item 11" />,
                        ],
                    },
                ]}
            />,
        );

        const section1 = container.querySelector("#first") as HTMLElement;
        expect(section1).toBeDefined();

        const section2 = container.querySelector("#second") as HTMLElement;
        expect(section2).toBeDefined();

        const section3 = container.querySelector("#third");
        expect(section3).toBeDefined();

        expect(onSectionExpand).not.toHaveBeenCalled();

        await act(() => {
            const title = section1.getElementsByClassName("title")[0] as HTMLElement;
            title.click();
        });
        expect(onSectionExpand).toHaveBeenCalled();

        expect(onSectionAction).not.toHaveBeenCalled();
        const addConsoleButton = container.querySelector<HTMLButtonElement>("#addConsole");
        expect(addConsoleButton).toBeDefined();

        await act(() => {
            addConsoleButton?.click();
        });
        expect(onSectionAction).toHaveBeenCalled();

        unmount();
    });

    it("Test accordion output (Snapshot)", () => {
        const { container, unmount } = render(
            <Accordion
                id="sidebar1"
                style={{
                    borderWidth: "1px",
                    borderStyle: "solid",
                }}
                caption="SIDEBAR TITLE"
                footer={"Lorem ipsum dolor sit amen, consenter"}
                singleExpand={true}

                sections={[
                    {
                        caption: "FIRST SECTION",
                        id: "first",
                        expanded: false,
                        content: [
                            <Accordion.Item id="item1" key="item1" caption="Item 1" />,
                            <Accordion.Item id="item2" key="item2" caption="Item 2" />,
                            <Accordion.Item id="item3" key="item3" caption="Item 3" />,
                        ],
                    },
                    {
                        caption: "SECOND SECTION",
                        id: "second",
                        content: [
                            <Accordion.Item
                                id="item5"
                                key="item5"
                                caption="Item 5"
                                picture={icon}
                            />,
                            <Accordion.Item
                                id="item6"
                                key="item6"
                                caption="Item 6"
                                picture={icon}
                            />,
                            <Accordion.Item
                                id="item7"
                                key="item7"
                                caption="Item 7" picture={icon}
                            />,
                        ],
                    },
                    {
                        caption: "THIRD SECTION",
                        id: "third",
                        content: [
                            <Accordion.Item id="item9" key="item9" caption="Item 9" />,
                            <Accordion.Item id="item10" key="item10" caption="Item 10" />,
                            <Accordion.Item id="item11" key="item11" caption="Item 11" />,
                        ],
                    },
                ]}
            />,
        );
        expect(container).toMatchSnapshot();

        unmount();
    });
});
