/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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
import { createRef } from "preact";
import { describe, expect, it } from "vitest";

import { SetDataAction, TreeGrid } from "../../../../components/ui/TreeGrid/TreeGrid.js";
import { nextRunLoop } from "../../test-helpers.js";

describe("TreeGrid tests", (): void => {

    it("Test TreeGrid instantiation", async () => {
        const { unmount: unmount1 } = render(
            <TreeGrid
                columns={[]}
                tableData={[]}
            />,
        );

        // Unmount it asap to test if the wait timer in the component is properly cancelled.
        unmount1();

        const gridRef = createRef<TreeGrid>();
        const { unmount: unmount2 } = render(
            <TreeGrid
                ref={gridRef}
                columns={[]}
                tableData={[]}
            />,
        );

        await nextRunLoop();
        expect(gridRef.current).toBeDefined();

        // Wait for the underlying table to be created.
        const table = await gridRef.current!.table;
        expect(table).toBeDefined();

        expect(gridRef.current!.updateLockCount).toBe(0);
        expect(await gridRef.current!.table).toBe(table);
        expect(gridRef.current!.getSelectedRows().length).toBe(0);

        unmount2();
    });

    it("TreeGrid snapshot", async () => {
        const gridRef = createRef<TreeGrid>();
        const { container, unmount } = render(
            <TreeGrid
                ref={gridRef}
                columns={[
                    { title: "col1", field: "field1" },
                    { title: "col2", field: "field2" },
                ]}
                tableData={[]}
                selectedRows={["a"]}
                onVerticalScroll={() => { /**/ }}
            />,
        );

        await nextRunLoop();
        expect(gridRef.current).toBeDefined();

        await gridRef.current!.table;

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("TreeGrid updates", async () => {
        const gridRef = createRef<TreeGrid>();
        const { unmount, rerender } = render(
            < TreeGrid
                ref={gridRef}
            />,
        );

        // Change the properties before the table is ready.
        render(
            < TreeGrid
                ref={gridRef}
                height={"100%"}
            />,
        );

        await nextRunLoop();
        expect(gridRef.current).toBeDefined();

        expect(gridRef.current!.getSelectedRows().length).toBe(0);
        gridRef.current!.beginUpdate();

        expect(gridRef.current!.updateLockCount).toBe(1);
        gridRef.current!.endUpdate();

        await gridRef.current!.table;

        rerender(
            < TreeGrid />,
        );

        rerender(
            < TreeGrid
                ref={gridRef}
                columns={[{ title: "col1" }]}
                tableData={[{ id: "1", col1: "a", col2: "2" }]}
                selectedRows={["1"]}
            />,
        );

        await nextRunLoop();
        expect(gridRef.current).toBeDefined();

        await gridRef.current!.setColumns([]);
        await gridRef.current!.setData([{ id: "1", col1: "b" }], SetDataAction.Add);
        await gridRef.current!.setData([{ id: "1", col1: "c" }], SetDataAction.Replace);
        await gridRef.current!.setData([{ id: "1", col1: "d" }], SetDataAction.Update);
        await gridRef.current!.setData([], SetDataAction.Set);

        expect(gridRef.current!.getSelectedRows().length).toBe(1);

        gridRef.current!.beginUpdate();
        gridRef.current!.beginUpdate();
        gridRef.current!.beginUpdate();

        expect(gridRef.current!.updateLockCount).toBe(3);
        gridRef.current!.endUpdate();
        expect(gridRef.current!.updateLockCount).toBe(2);
        gridRef.current!.endUpdate();
        gridRef.current!.endUpdate();
        gridRef.current!.endUpdate();
        gridRef.current!.endUpdate();
        gridRef.current!.endUpdate();
        gridRef.current!.endUpdate();
        gridRef.current!.endUpdate();
        expect(gridRef.current!.updateLockCount).toBe(0);

        unmount();
    });

});
