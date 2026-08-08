/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { createRef } from "preact";
import { describe, expect, it, vi } from "vitest";

import { TableSizesReport } from "../../../../modules/db-editor/performance/TableSizesReport.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";

describe("Table Sizes report module tests", (): void => {

    it("renders table sizes as a treemap grouped by schema", async () => {
        const executeService = vi.fn().mockResolvedValue({
            rows: [
                ["sakila", "film", 1024, 2048, 3072, 1000, "InnoDB"],
                ["sakila", "actor", 512, 512, 1024, 200, "InnoDB"],
                ["world", "city", 4096, 0, 4096, 4000, "InnoDB"],
            ],
        });
        const backend = {
            executeService,
        } as unknown as ShellInterfaceSqlEditor;

        const { container, unmount } = render(
            <TableSizesReport
                backend={backend}
            />,
        );

        expect(await screen.findByText("world")).toBeDefined();
        expect(screen.getByText("sakila")).toBeDefined();
        expect(screen.getByText("film")).toBeDefined();
        expect(screen.getByText("actor")).toBeDefined();
        expect(screen.getByText("city")).toBeDefined();
        expect(container.querySelectorAll(".mysqlInspectorTreemapContent")).toHaveLength(1);
        expect(container.querySelectorAll(".mysqlInspectorTreemapHost")).toHaveLength(1);
        expect(container.querySelectorAll(".mysqlInspectorIndexStripe")).toHaveLength(3);
        expect(screen.getByText("Data 1.00 KB / Index 2.00 KB")).toBeDefined();
        expect(screen.queryByTestId("mysqlInspectorSelectedTable")).toBeNull();
        const sakilaNode = screen.getByTestId("mysqlInspectorSchema-sakila");
        expect(sakilaNode.querySelector(".mysqlInspectorSchemaRect")?.getAttribute("data-tooltip"))
            .toBe("sakila\nTotal: 4.00 KB\nData: 1.50 KB\nIndex: 2.50 KB\nTables: 2");
        const filmNode = screen.getByTestId("mysqlInspectorTable-sakila.film");
        const tooltip = "sakila.film\nTotal: 3.00 KB\nData: 1.00 KB\nIndex: 2.00 KB\nRows: 1000\nEngine: InnoDB";
        expect(filmNode.getAttribute("data-tooltip")).toBeNull();
        expect(filmNode.querySelector(".mysqlInspectorTableRect")?.getAttribute("data-tooltip"))
            .toBe(tooltip);
        expect(filmNode.querySelector("title")).toBeNull();
        expect(executeService).toHaveBeenCalledOnce();

        unmount();
    });

    it("drills into a schema when selected", async () => {
        const backend = {
            executeService: vi.fn().mockResolvedValue({
                rows: [
                    ["sakila", "film", 1024, 2048, 3072, 1000, "InnoDB"],
                    ["sakila", "actor", 512, 512, 1024, 200, "InnoDB"],
                    ["world", "city", 4096, 0, 4096, 4000, "InnoDB"],
                ],
            }),
        } as unknown as ShellInterfaceSqlEditor;
        const { container, unmount } = render(
            <TableSizesReport backend={backend} />,
        );

        fireEvent.click(await screen.findByTestId("mysqlInspectorSchema-sakila"));

        await waitFor(() => {
            expect(container.querySelectorAll(".mysqlInspectorTableNode")).toHaveLength(2);
        });
        expect(screen.getByTestId("mysqlInspectorSchema-sakila").classList)
            .toContain("mysqlInspectorSchemaNodeSelected");
        fireEvent.click(screen.getByText("< Back"));
        await waitFor(() => {
            expect(container.querySelectorAll(".mysqlInspectorTableNode")).toHaveLength(3);
        });

        unmount();
    });

    it("clears a selected schema that is no longer returned by refresh", async () => {
        const backend = {
            executeService: vi.fn()
                .mockResolvedValueOnce({
                    rows: [
                        ["sakila", "film", 1024, 2048, 3072, 1000, "InnoDB"],
                        ["world", "city", 4096, 0, 4096, 4000, "InnoDB"],
                    ],
                })
                .mockResolvedValueOnce({
                    rows: [
                        ["world", "city", 4096, 0, 4096, 4000, "InnoDB"],
                    ],
                }),
        } as unknown as ShellInterfaceSqlEditor;
        const reportRef = createRef<TableSizesReport>();
        const { unmount } = render(<TableSizesReport backend={backend} ref={reportRef} />);

        fireEvent.click(await screen.findByTestId("mysqlInspectorSchema-sakila"));
        await waitFor(() => {
            expect(screen.getByText("< Back")).toBeTruthy();
        });

        reportRef.current!.refresh();

        await waitFor(() => {
            expect(screen.queryByText("< Back")).toBeNull();
            expect(screen.getByTestId("mysqlInspectorSchema-world")).toBeTruthy();
        });

        unmount();
    });

    it("renders an empty state when no user tables are available", async () => {
        const backend = {
            executeService: vi.fn().mockResolvedValue({ rows: [] }),
        } as unknown as ShellInterfaceSqlEditor;

        const { unmount } = render(
            <TableSizesReport
                backend={backend}
            />,
        );

        expect(await screen.findByText("No user tables found.")).toBeDefined();

        unmount();
    });

});
