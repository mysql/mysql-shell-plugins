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

import { Breadcrumb } from "../../../../components/ui/Breadcrumb/Breadcrumb.js";
import { Button } from "../../../../components/ui/Button/Button.js";
import { Label } from "../../../../components/ui/Label/Label.js";

describe("Breadcrumb render testing", (): void => {

    it("Test Breadcrumb onSelect callback", async () => {
        const onSelect = vi.fn();
        const { container, unmount } = render(
            <Breadcrumb
                id="breadcrumb1"
                path={[
                    { id: "root", caption: "Root" },
                    { id: "folder", caption: "Folder" },
                    { id: "subfolder", caption: "Subfolder", selected: true },
                ]}
                className="dropShadow"
                showPicker={true}
                onSelect={onSelect}
            />,
        );

        const buttons = container.querySelectorAll<HTMLButtonElement>(".button");
        expect(buttons).toHaveLength(4);

        await act(() => {
            buttons[0].click();
        });
        expect(onSelect).toHaveBeenCalled();

        unmount();
    });

    it("Test Breadcrumb (Snapshot) 1", () => {
        const { container, unmount } = render(
            <Breadcrumb
                id="breadcrumb1"
                path={[
                    { id: "root", caption: "Root" },
                    { id: "folder", caption: "Folder" },
                    { id: "subfolder", caption: "Subfolder", selected: true },
                ]}
                className="dropShadow"
            />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Test Breadcrumb (Snapshot) 2", () => {
        const { container, unmount } = render(
            <Breadcrumb
                id="breadcrumb2"
                path={[
                    { id: "root", caption: "Root" },
                    { id: "folder", caption: "Folder" },
                    { id: "subfolder", caption: "Subfolder", selected: true },
                    { id: "subfolder2", caption: "Subfolder 2" },
                ]}
                separator="☞"
            />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Test Breadcrumb (Snapshot) 3", () => {
        const { container, unmount } = render(
            <Breadcrumb id="breadcrumb3">
                <Button style={{ backgroundColor: "white", color: "white" }}>
                    <span style={{ color: "#00758f" }}>My</span>
                    <span style={{ color: "#f29111" }}>SQL</span>
                </Button>
                <Button style={{ backgroundColor: "#505050" }}>
                    <Label>localhost:3307</Label>
                </Button>
                <Button
                    caption="mysql"
                    style={{ backgroundColor: "gray" }}
                ></Button>
                <Button
                    caption="SQL"
                    style={{ backgroundColor: "darkorange", color: "white" }}
                ></Button>
            </Breadcrumb>,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

});
