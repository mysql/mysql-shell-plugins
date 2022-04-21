/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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
import React from "react";
import { DBDataType, IColumnInfo, MessageType } from "../../../../../app-logic/Types";

import { ResultView } from "../../../../../components/ResultView";
import { Menu, TreeGrid } from "../../../../../components/ui";
import { requisitions } from "../../../../../supplement/Requisitions";
import { nextProcessTick, snapshotFromWrapper } from "../../../test-helpers";
import { MockCellComponent } from "../../../__mocks__/MockCellComponent";

describe("Result View Tests", (): void => {

    it("Standard Rendering", () => {
        const component = mount<ResultView>(
            <ResultView
                resultSet={{
                    head: {
                        sql: "select 1",
                        requestId: "123",
                    },
                    data: {
                        requestId: "123",
                        columns: [],
                        rows: [],
                        currentPage: 0,
                    },
                }}
            />,
        );

        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.unmount();
    });

    it("Render with Error/Response", () => {
        const component = mount<ResultView>(
            <ResultView
                resultSet={{
                    head: {
                        sql: "select 1",
                        requestId: "123",
                    },
                    data: {
                        requestId: "123",
                        columns: [],
                        rows: [],
                        currentPage: 0,
                        executionInfo: {
                            type: MessageType.Error,
                            text: "Error",
                        },
                    },
                }}
            />,
        );

        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.setProps({
            resultSet: {
                head: {
                    sql: "select 1",
                    requestId: "123",
                },
                data: {
                    requestId: "123",
                    columns: [],
                    rows: [],
                    currentPage: 0,
                    executionInfo: {
                        type: MessageType.Response,
                        text: "Response",
                    },
                },
            },
        });

        component.unmount();
    });

    it("Render with Columns", async () => {
        const columns2: IColumnInfo[] = [
            {
                name: "col1",
                dataType: { type: DBDataType.Bigint },
            },
        ];

        const columns1: IColumnInfo[] = [
            {
                name: "col1",
                dataType: { type: DBDataType.Bigint },
            },
            {
                name: "col2",
                dataType: { type: DBDataType.Unknown },
            },
            {
                name: "col3",
                dataType: { type: DBDataType.TinyInt },
            },
            {
                name: "col4",
                dataType: { type: DBDataType.SmallInt },
            },
            {
                name: "col5",
                dataType: { type: DBDataType.MediumInt },
            },
            {
                name: "col6",
                dataType: { type: DBDataType.Int },
            },
            {
                name: "col7",
                dataType: { type: DBDataType.Bigint },
            },
            {
                name: "col8",
                dataType: { type: DBDataType.UInteger },
            },
            {
                name: "col9",
                dataType: { type: DBDataType.Float },
            },
            {
                name: "col10",
                dataType: { type: DBDataType.Real },
            },
            {
                name: "col11",
                dataType: { type: DBDataType.Double },
            },
            {
                name: "col12",
                dataType: { type: DBDataType.Decimal },
            },
            {
                name: "col13",
                dataType: { type: DBDataType.Binary },
            },
            {
                name: "col14",
                dataType: { type: DBDataType.Varbinary },
            },
            {
                name: "col15",
                dataType: { type: DBDataType.Char },
            },
            {
                name: "col16",
                dataType: { type: DBDataType.Nchar },
            },
            {
                name: "col17",
                dataType: { type: DBDataType.Varchar },
            },
            {
                name: "col18",
                dataType: { type: DBDataType.Nvarchar },
            },
            {
                name: "col19",
                dataType: { type: DBDataType.String },
            },
            {
                name: "col20",
                dataType: { type: DBDataType.TinyText },
            },
            {
                name: "col21",
                dataType: { type: DBDataType.Text },
            },
            {
                name: "col22",
                dataType: { type: DBDataType.MediumText },
            },
            {
                name: "col23",
                dataType: { type: DBDataType.LongText },
            },
            {
                name: "col24",
                dataType: { type: DBDataType.TinyBlob },
            },
            {
                name: "col25",
                dataType: { type: DBDataType.Blob },
            },
            {
                name: "col26",
                dataType: { type: DBDataType.MediumBlob },
            },
            {
                name: "col27",
                dataType: { type: DBDataType.LongBlob },
            },
            {
                name: "col28",
                dataType: { type: DBDataType.DateTime },
            },
            {
                name: "col29",
                dataType: { type: DBDataType.DateTime_f },
            },
            {
                name: "col30",
                dataType: { type: DBDataType.Date },
            },
            {
                name: "col31",
                dataType: { type: DBDataType.Time },
            },
            {
                name: "col32",
                dataType: { type: DBDataType.Time_f },
            },
            {
                name: "col33",
                dataType: { type: DBDataType.Year },
            },
            {
                name: "col34",
                dataType: { type: DBDataType.Timestamp },
            },
            {
                name: "col35",
                dataType: { type: DBDataType.Timestamp_f },
            },
            {
                name: "col36",
                dataType: { type: DBDataType.Geometry },
            },
            {
                name: "col37",
                dataType: { type: DBDataType.Point },
            },
            {
                name: "col38",
                dataType: { type: DBDataType.LineString },
            },
            {
                name: "col39",
                dataType: { type: DBDataType.Polygon },
            },
            {
                name: "col40",
                dataType: { type: DBDataType.GeometryCollection },
            },
            {
                name: "col41",
                dataType: { type: DBDataType.MultiPoint },
            },
            {
                name: "col42",
                dataType: { type: DBDataType.MultiLineString },
            },
            {
                name: "col43",
                dataType: { type: DBDataType.MultiPolygon },
            },
            {
                name: "col44",
                dataType: { type: DBDataType.Numeric },
            },
            {
                name: "col45",
                dataType: { type: DBDataType.Json },
            },
            {
                name: "col46",
                dataType: { type: DBDataType.Bit },
            },
            {
                name: "col47",
                dataType: { type: DBDataType.Boolean },
            },
            {
                name: "col48",
                dataType: { type: DBDataType.Enum },
            },
            {
                name: "col49",
                dataType: { type: DBDataType.Set },
            },
        ];

        const component = mount<ResultView>(
            <ResultView
                resultSet={{
                    head: {
                        sql: "select 1",
                        requestId: "123",
                    },
                    data: {
                        requestId: "123",
                        columns: columns1,
                        rows: [],
                        currentPage: 0,
                        executionInfo: {
                            type: MessageType.Info,
                            text: "Endless Possibilities",
                        },
                    },
                }}
            />,
        );

        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        // Updating columns does not change the columns property of the component.
        // Instead these changes are directly sent to the underlying grid.
        await component.instance().updateColumns(columns2);

        const grid = component.find(TreeGrid);
        expect(grid).toBeDefined();
        const table = await (grid.instance() as TreeGrid).table;
        expect(table).toBeDefined();

        // The cast to never is needed, because we are spying on a private method.
        const resizeSpy = jest.spyOn(component.instance(), "handleColumnResized" as never);
        const column = table!.getColumn("col1");
        expect(grid.props().onColumnResized).toBeDefined();
        grid.props().onColumnResized?.(column);

        // TODO: while the handleColumnResized method is indeed called, the spy is not -> investigate.
        //expect(resizeSpy).toHaveBeenCalled();

        resizeSpy.mockRestore();

        component.unmount();
    });

    it("Context Menu", async () => {
        const columns: IColumnInfo[] = [
            {
                name: "col1",
                dataType: { type: DBDataType.Bigint },
            },
            {
                name: "col2",
                dataType: { type: DBDataType.String },
            },
        ];

        const rows = [
            { col1: "42", col2: "abc" },
            { col1: "43", col2: "def" },
            { col1: "44", col2: "ghi" },
        ];

        const component = mount<ResultView>(
            <ResultView
                resultSet={{
                    head: {
                        sql: "select 1",
                        requestId: "123",
                    },
                    data: {
                        requestId: "123",
                        columns,
                        rows,
                        currentPage: 0,
                    },
                }}
            />,
        );

        const cellMenu = component.find<Menu>(Menu);
        expect(cellMenu).toBeDefined();

        const cell = new MockCellComponent();
        component.instance().setFakeCell(cell);
        const grid = component.find<TreeGrid>(TreeGrid);
        expect(grid).toBeDefined();
        const table = await grid.instance().table;
        expect(table).toBeDefined();
        table?.selectRow(); // Selects all rows.

        // We can show the cell context menu only by explicitly calling its open method, because we have no real cell
        // to trigger a context menu event on. That possible only when Tabulator actually renders its content
        // (which doesn't happen because of the zero sized host).
        const rect = component.getDOMNode().getBoundingClientRect();
        cellMenu.instance().open(rect, false);

        await nextProcessTick();

        // Check the enabled state of each menu entry.
        const portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        const items = document.getElementsByClassName("menuItem");
        expect(items).toHaveLength(21);

        const clipboardSpy = jest.spyOn(requisitions, "writeToClipboard")
            .mockImplementation((_text: string) => {
                // no-op
            });

        try {
            for (let i = 0; i < items.length; ++i) {
                const item = items.item(i) as HTMLButtonElement;
                expect(item).not.toBeNull();

                if (item) {
                    switch (item.id) {
                        case "openValueMenuItem": {
                            expect(item.classList.contains("disabled")).toBeTruthy();
                            item.click();

                            // TODO: test handling, once implemented.

                            break;
                        }

                        case "setNullMenuItem": {
                            expect(item.classList.contains("disabled")).toBeTruthy();

                            expect(cell.getValue()).toBe("Animal");
                            item.click();
                            expect(cell.getValue()).toBe(null);

                            // Restore value.
                            cell.setValue("Animal");

                            break;
                        }

                        case "saveToFileMenuItem": {
                            expect(item.classList.contains("disabled")).toBeTruthy();
                            item.click();

                            // TODO: test handling, once implemented.

                            break;
                        }

                        case "loadFromFileMenuItem": {
                            expect(item.classList.contains("disabled")).toBeTruthy();
                            item.click();

                            // TODO: test handling, once implemented.

                            break;
                        }

                        case "copyRowMenuItem1": {
                            expect(item.classList.contains("disabled")).toBeFalsy();
                            item.click();

                            expect(clipboardSpy).toHaveBeenLastCalledWith("'42', 'abc'\n'43', 'def'\n'44', 'ghi'\n");

                            break;
                        }

                        case "copyRowMenuItem2": {
                            expect(item.classList.contains("disabled")).toBeFalsy();
                            item.click();

                            expect(clipboardSpy)
                                .toHaveBeenLastCalledWith("# col1, col2\n'42', 'abc'\n'43', 'def'\n'44', 'ghi'\n");

                            break;
                        }

                        case "copyRowMenuItem3": {
                            expect(item.classList.contains("disabled")).toBeFalsy();
                            item.click();

                            expect(clipboardSpy).toHaveBeenLastCalledWith("42, abc\n43, def\n44, ghi\n");

                            break;
                        }

                        case "copyRowMenuItem4": {
                            expect(item.classList.contains("disabled")).toBeFalsy();
                            item.click();

                            expect(clipboardSpy).toHaveBeenLastCalledWith("# col1, col2\n42, abc\n43, def\n44, ghi\n");

                            break;
                        }

                        case "copyRowMenuItem5": {
                            expect(item.classList.contains("disabled")).toBeFalsy();
                            item.click();

                            expect(clipboardSpy)
                                .toHaveBeenLastCalledWith("# col1\tcol2\n'42'\t'abc'\n'43'\t'def'\n'44'\t'ghi'\n");

                            break;
                        }

                        case "copyRowMenuItem6": {
                            expect(item.classList.contains("disabled")).toBeFalsy();
                            item.click();

                            expect(clipboardSpy).toHaveBeenLastCalledWith("'42'\t'abc'\n'43'\t'def'\n'44'\t'ghi'\n");

                            break;
                        }

                        case "copyFieldMenuItem": {
                            expect(item.classList.contains("disabled")).toBeTruthy();
                            item.click();

                            expect(clipboardSpy).toHaveBeenLastCalledWith("'Animal'");

                            break;
                        }

                        case "copyFieldUnquotedMenuItem": {
                            expect(item.classList.contains("disabled")).toBeTruthy();
                            item.click();

                            expect(clipboardSpy).toHaveBeenLastCalledWith("Animal");

                            break;
                        }

                        case "pasteRowMenuItem": {
                            expect(item.classList.contains("disabled")).toBeTruthy();
                            item.click();

                            // TODO: test handling, once implemented.

                            break;
                        }

                        case "deleteRowMenuItem": {
                            expect(item.classList.contains("disabled")).toBeTruthy();

                            // TODO: test handling, once implemented.

                            break;
                        }

                        case "capitalizeMenuItem": { // Means: title case.
                            expect(item.classList.contains("disabled")).toBeTruthy();

                            cell.setValue("animalsOrHumans");
                            item.click();
                            expect(cell.getValue()).toBe("AnimalsOrHumans");

                            break;
                        }

                        case "lowerCaseMenuItem": {
                            expect(item.classList.contains("disabled")).toBeTruthy();

                            cell.setValue("AnimAL");
                            item.click();
                            expect(cell.getValue()).toBe("animal");

                            break;
                        }

                        case "upperCaseMenuItem": {
                            expect(item.classList.contains("disabled")).toBeTruthy();

                            cell.setValue("animal");
                            item.click();
                            expect(cell.getValue()).toBe("ANIMAL");

                            break;
                        }

                        default: {
                            expect(item.classList.contains("divider")).toBeTruthy();
                        }
                    }
                }
            }
        } catch (e) {
            // Close the menu first before handling the error or we get an error when the portal
            // is closed implicitly, when no document is available anymore.
            cellMenu.instance().close();
            throw e;
        }

        clipboardSpy.mockRestore();

        component.unmount();

    });
});
