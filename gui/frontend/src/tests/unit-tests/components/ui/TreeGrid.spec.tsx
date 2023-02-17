/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { mount } from "enzyme";

import { TreeGrid, SetDataAction } from "../../../../components/ui/TreeGrid/TreeGrid";

describe("TreeGrid tests", (): void => {

    it("Test TreeGrid instantiation", async () => {
        let component = mount<TreeGrid>(
            <TreeGrid
                columns={[]}
                tableData={[]}
            />,
        );

        // Unmount it asap to test if the wait timer in the component is properly cancelled.
        component.unmount();

        component = mount<TreeGrid>(
            <TreeGrid
                columns={[]}
                tableData={[]}
            />,
        );

        // Wait for the underlying table to be created.
        await component.instance().table;

        const props = component.props();
        expect(props.columns).toEqual([]);

        component.unmount();
    });

    it("TreeGrid snapshot", async () => {
        const component = mount<TreeGrid>(
            <TreeGrid
                columns={[
                    { title: "col1", field: "field1" },
                    { title: "col2", field: "field2" },
                ]}
                tableData={[]}
                selectedIds={["a"]}
                onVerticalScroll={() => { /**/ }}
            />,
        );
        await component.instance().table;

        expect(component).toMatchSnapshot();

        component.unmount();
    });

    it("TreeGrid updates", async () => {
        const component = mount<TreeGrid>(
            <TreeGrid
                onVerticalScroll={() => { /**/ }}
            />,
        );

        const grid = component.instance();

        // Change the properties before the table is ready.
        component.setProps({ height: "100%" });
        expect(grid.getSelectedRows().length).toBe(0);
        grid.beginUpdate();

        // @ts-expect-error, because we are checking an internal member here.
        expect(grid.updateCount).toBe(0);
        grid.endUpdate();

        await grid.table;

        component.setProps({});
        component.setProps({
            columns: [{ title: "col1" }],
            tableData: [{ id: "1", col1: "a", col2: "2" }],
            selectedIds: ["1"],
        });

        await grid.setColumns([]);
        await grid.setData([{ id: "1", col1: "b" }], SetDataAction.Add);
        await grid.setData([{ id: "1", col1: "c" }], SetDataAction.Replace);
        await grid.setData([{ id: "1", col1: "d" }], SetDataAction.Update);
        await grid.setData([], SetDataAction.Set);

        expect(grid.getSelectedRows().length).toBe(1);

        grid.beginUpdate();
        grid.beginUpdate();
        grid.beginUpdate();

        // @ts-expect-error, because we are checking an internal member here.
        expect(grid.updateCount).toBe(3);
        grid.endUpdate();
        // @ts-expect-error, because we are checking an internal member here.
        expect(grid.updateCount).toBe(2);
        grid.endUpdate();
        grid.endUpdate();
        grid.endUpdate();
        grid.endUpdate();
        grid.endUpdate();
        grid.endUpdate();
        grid.endUpdate();
        // @ts-expect-error, because we are checking an internal member here.
        expect(grid.updateCount).toBe(0);

        component.unmount();
    });

});
