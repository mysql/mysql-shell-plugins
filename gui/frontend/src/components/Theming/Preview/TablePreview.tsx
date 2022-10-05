/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import employees from "./assets/employees.json";

import React from "react";
import { ColumnDefinition } from "tabulator-tables";

import { Component, SelectionType } from "../../ui";
import { ITreeGridOptions, TreeGrid } from "../../ui/TreeGrid/TreeGrid";

interface ITablePreviewState {
    data: unknown[];
    columnNames: string[];
}

// A gallery component showing tables/trees.
export class TablePreview extends Component<{}, ITablePreviewState> {

    private ref = React.createRef<TreeGrid>();

    public constructor(props: {}) {
        super(props);

        this.state = {
            data: employees,
            columnNames: Object.keys(employees[0]).filter((value: string) => {
                return (value === "children") ? undefined : value;
            }),
        };
    }

    public componentDidMount(): void {
        void this.ref.current?.table.then((table) => {
            const rows = table?.getRows();
            if (rows && rows.length > 0) {
                rows[0].treeExpand();
            }
            table?.selectRow([1, 12]);
        });
    }

    public render(): React.ReactNode {
        const { data, columnNames } = this.state;

        // Get the column names from the first record.
        const columns = columnNames.map((title: string, index: number) => {
            return {
                title,
                field: title,
                headerSort: index > 0,
                editor: title === "role" ? true : (title === "reports" ? "number" : false),
            } as ColumnDefinition;
        });

        const options: ITreeGridOptions = {
            treeColumn: "name",
            childKey: "children",
            layout: "fitColumns",
            //headerHeight: 40,
            //rowHeight: 35,
            verticalGridLines: true,
            horizontalGridLines: true,
            alternatingRowBackgrounds: false,
            selectionType: SelectionType.Multi,
        };

        return (
            <TreeGrid
                ref={this.ref}
                height={300}
                columns={columns}
                tableData={data}
                options={options}
            />
        );
    }

}
