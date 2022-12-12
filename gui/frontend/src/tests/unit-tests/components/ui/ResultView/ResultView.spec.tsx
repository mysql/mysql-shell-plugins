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
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "123",
                    columns: [],
                    data: {
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
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "123",
                    columns: [],
                    data: {
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
                type: "resultSet",
                sql: "select 1",
                resultId: "123",
                columns: [],
                data: {
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
                title: "col1",
                field: "0",
                dataType: { type: DBDataType.Bigint },
            },
        ];

        const columns1: IColumnInfo[] = [
            {
                title: "col1",
                field: "0",
                dataType: { type: DBDataType.Bigint },
            },
            {
                title: "col2",
                field: "1",
                dataType: { type: DBDataType.Unknown },
            },
            {
                title: "col3",
                field: "2",
                dataType: { type: DBDataType.TinyInt },
            },
            {
                title: "col4",
                field: "3",
                dataType: { type: DBDataType.SmallInt },
            },
            {
                title: "col5",
                field: "4",
                dataType: { type: DBDataType.MediumInt },
            },
            {
                title: "col6",
                field: "5",
                dataType: { type: DBDataType.Int },
            },
            {
                title: "col7",
                field: "6",
                dataType: { type: DBDataType.Bigint },
            },
            {
                title: "col8",
                field: "7",
                dataType: { type: DBDataType.UInteger },
            },
            {
                title: "col9",
                field: "8",
                dataType: { type: DBDataType.Float },
            },
            {
                title: "col10",
                field: "9",
                dataType: { type: DBDataType.Real },
            },
            {
                title: "col11",
                field: "10",
                dataType: { type: DBDataType.Double },
            },
            {
                title: "col12",
                field: "11",
                dataType: { type: DBDataType.Decimal },
            },
            {
                title: "col13",
                field: "12",
                dataType: { type: DBDataType.Binary },
            },
            {
                title: "col14",
                field: "13",
                dataType: { type: DBDataType.Varbinary },
            },
            {
                title: "col15",
                field: "14",
                dataType: { type: DBDataType.Char },
            },
            {
                title: "col16",
                field: "15",
                dataType: { type: DBDataType.Nchar },
            },
            {
                title: "col17",
                field: "16",
                dataType: { type: DBDataType.Varchar },
            },
            {
                title: "col18",
                field: "17",
                dataType: { type: DBDataType.Nvarchar },
            },
            {
                title: "col19",
                field: "18",
                dataType: { type: DBDataType.String },
            },
            {
                title: "col20",
                field: "19",
                dataType: { type: DBDataType.TinyText },
            },
            {
                title: "col21",
                field: "20",
                dataType: { type: DBDataType.Text },
            },
            {
                title: "col22",
                field: "21",
                dataType: { type: DBDataType.MediumText },
            },
            {
                title: "col23",
                field: "22",
                dataType: { type: DBDataType.LongText },
            },
            {
                title: "col24",
                field: "23",
                dataType: { type: DBDataType.TinyBlob },
            },
            {
                title: "col25",
                field: "24",
                dataType: { type: DBDataType.Blob },
            },
            {
                title: "col26",
                field: "25",
                dataType: { type: DBDataType.MediumBlob },
            },
            {
                title: "col27",
                field: "26",
                dataType: { type: DBDataType.LongBlob },
            },
            {
                title: "col28",
                field: "27",
                dataType: { type: DBDataType.DateTime },
            },
            {
                title: "col29",
                field: "28",
                dataType: { type: DBDataType.DateTime_f },
            },
            {
                title: "col30",
                field: "29",
                dataType: { type: DBDataType.Date },
            },
            {
                title: "col31",
                field: "30",
                dataType: { type: DBDataType.Time },
            },
            {
                title: "col32",
                field: "31",
                dataType: { type: DBDataType.Time_f },
            },
            {
                title: "col33",
                field: "32",
                dataType: { type: DBDataType.Year },
            },
            {
                title: "col34",
                field: "33",
                dataType: { type: DBDataType.Timestamp },
            },
            {
                title: "col35",
                field: "34",
                dataType: { type: DBDataType.Timestamp_f },
            },
            {
                title: "col36",
                field: "35",
                dataType: { type: DBDataType.Geometry },
            },
            {
                title: "col37",
                field: "36",
                dataType: { type: DBDataType.Point },
            },
            {
                title: "col38",
                field: "37",
                dataType: { type: DBDataType.LineString },
            },
            {
                title: "col39",
                field: "38",
                dataType: { type: DBDataType.Polygon },
            },
            {
                title: "col40",
                field: "39",
                dataType: { type: DBDataType.GeometryCollection },
            },
            {
                title: "col41",
                field: "40",
                dataType: { type: DBDataType.MultiPoint },
            },
            {
                title: "col42",
                field: "41",
                dataType: { type: DBDataType.MultiLineString },
            },
            {
                title: "col43",
                field: "42",
                dataType: { type: DBDataType.MultiPolygon },
            },
            {
                title: "col44",
                field: "43",
                dataType: { type: DBDataType.Numeric },
            },
            {
                title: "col45",
                field: "44",
                dataType: { type: DBDataType.Json },
            },
            {
                title: "col46",
                field: "45",
                dataType: { type: DBDataType.Bit },
            },
            {
                title: "col47",
                field: "46",
                dataType: { type: DBDataType.Boolean },
            },
            {
                title: "col48",
                field: "47",
                dataType: { type: DBDataType.Enum },
            },
            {
                title: "col49",
                field: "48",
                dataType: { type: DBDataType.Set },
            },
        ];

        const component = mount<ResultView>(
            <ResultView
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "123",
                    columns: columns1,
                    data: {
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
        const column = table!.getColumn("0");
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
                title: "col1",
                field: "0",
                dataType: { type: DBDataType.Bigint },
            },
            {
                title: "col2",
                field: "1",
                dataType: { type: DBDataType.String },
            },
        ];

        const rows = [
            { 0: "42", 1: "abc" },
            { 0: "43", 1: "def" },
            { 0: "44", 1: "ghi" },
        ];

        const component = mount<ResultView>(
            <ResultView
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "123",
                    columns,
                    data: {
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

                            expect(clipboardSpy).toHaveBeenLastCalledWith("42, 'abc'\n43, 'def'\n44, 'ghi'\n");

                            break;
                        }

                        case "copyRowMenuItem2": {
                            expect(item.classList.contains("disabled")).toBeFalsy();
                            item.click();

                            expect(clipboardSpy)
                                .toHaveBeenLastCalledWith("# col1, col2\n42, 'abc'\n43, 'def'\n44, 'ghi'\n");

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
                                .toHaveBeenLastCalledWith("# col1\tcol2\n42\t'abc'\n43\t'def'\n44\t'ghi'\n");

                            break;
                        }

                        case "copyRowMenuItem6": {
                            expect(item.classList.contains("disabled")).toBeFalsy();
                            item.click();

                            expect(clipboardSpy).toHaveBeenLastCalledWith("42\t'abc'\n43\t'def'\n44\t'ghi'\n");

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
