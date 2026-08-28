/*
 * Copyright (c) 2021, 2026, Oracle and/or its affiliates.
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

import { act, render, waitFor } from "@testing-library/preact";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRef, type RefObject } from "preact";
import type { CellComponent, EmptyCallback, ValueBooleanCallback, ValueVoidCallback } from "tabulator-tables";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DBDataType, IColumnInfo, MessageType } from "../../../../../app-logic/general-types.js";
import {
    ResultView, getWideColumns, hasTallCellContent, updateWideColumnsCache,
} from "../../../../../components/ResultView/ResultView.js";
import { defaultCellValue } from "../../../../../components/ResultView/ResultCellValue.js";
import type { TreeGrid } from "../../../../../components/ui/TreeGrid/TreeGrid.js";
import { Assets } from "../../../../../supplement/Assets.js";
import { requisitions } from "../../../../../supplement/Requisitions.js";
import { KeyboardKeys } from "../../../../../utilities/helpers.js";
import { CellComponentMock } from "../../../__mocks__/CellComponentMock.js";
import { ColumnComponentMock } from "../../../__mocks__/ColumnComponentMock.js";
import { RowComponentMock } from "../../../__mocks__/RowComponentMock.js";
import { createResultSet, nextProcessTick, nextRunLoop } from "../../../test-helpers.js";
import type { Menu } from "../../../../../components/ui/Menu/Menu.js";

const createColumn = (title: string, field: string, inPK = false): IColumnInfo => {
    return {
        title,
        field,
        dataType: { type: DBDataType.Varchar },
        inPK,
        autoIncrement: false,
        nullable: false,
    };
};

const readFrontendSourceFile = (path: string): string => {
    let directory = process.cwd();

    for (let i = 0; i < 8; i++) {
        const candidate = join(directory, path);

        if (existsSync(candidate)) {
            return readFileSync(candidate, "utf-8");
        }

        directory = dirname(directory);
    }

    throw new Error(`Unable to find ${path}`);
};

const readCssRule = (css: string, selector: string): string => {
    const escapedSelector = selector.replaceAll(".", "\\.").replaceAll("#", "\\#");
    const match = new RegExp(`${escapedSelector}\\s*{(?<rule>[^}]*)}`, "s").exec(css);

    return match?.groups?.rule ?? "";
};

// @ts-expect-error, we are extending a class for testing purposes.
class TestResultView extends ResultView {
    declare public cellContextMenuRef: RefObject<Menu>;
    declare public gridRef: RefObject<TreeGrid>;
}

interface IResultViewInternals {
    formatCell: (cell: CellComponent, unquoted?: boolean) => string;
    handleCellContext: (event: Event, cell: CellComponent) => void;
    handleCellClick: (event: Event, cell: CellComponent) => void;
    handleCellMenuItemDisabled: (props: { command: { command: string; title: string; }; }) => boolean;
    handleKeyDown: (event: KeyboardEvent) => void;
    handleBlurEvent: (
        cell: CellComponent,
        success: ValueBooleanCallback,
        cancel: ValueVoidCallback,
        event: FocusEvent,
    ) => void;
    cellEditing: (cell: CellComponent) => void;
    cellEditCancelled: () => void;
    cancelCellEditor: (cancel: ValueVoidCallback) => void;
    cancelCellEditingForDiscard: () => void;
    finishCellEditingForCommit: () => Promise<void>;
    editingCell?: CellComponent;
    generateColumnDefinitions: (columns: IColumnInfo[], editable: boolean) => Array<{ editable?: () => boolean; }>;
    handleConfirm: (cell: CellComponent) => void;
    numberFormatter: (
        cell: CellComponent,
        formatterParams: { info: IColumnInfo; },
        onRendered: EmptyCallback,
    ) => string | HTMLElement;
}

const assignColumn = (cell: CellComponentMock, info: IColumnInfo): void => {
    cell.getColumn = () => {
        const column = new ColumnComponentMock();
        column.fieldType = info.field;
        column.getField = () => {
            return info.field;
        };
        column.getDefinition = () => {
            return {
                title: info.title,
                field: info.field,
                formatterParams: (): { info: IColumnInfo; } => {
                    return { info };
                },
            };
        };

        return column;
    };
};

const assignColumnWithoutFormatterParams = (cell: CellComponentMock, info: IColumnInfo): void => {
    cell.getColumn = () => {
        const column = new ColumnComponentMock();
        column.fieldType = info.field;
        column.getField = () => {
            return info.field;
        };
        column.getDefinition = () => {
            return {
                title: info.title,
                field: info.field,
            };
        };

        return column;
    };
};

describe("Result View Tests", (): void => {
    afterEach(() => {
        Reflect.deleteProperty(window, "electronHost");
    });

    it("uses 12px as the default result grid font size", () => {
        const resultViewCss = readFrontendSourceFile("src/components/ResultView/ResultView.css");
        const tabulatorRule = readCssRule(resultViewCss, ".msg.resultHost .resultView .tabulator");

        expect(tabulatorRule).toContain("font-size: 12px;");
    });

    it("uses the standard UI font for result grids", () => {
        const resultViewCss = readFrontendSourceFile("src/components/ResultView/ResultView.css");
        const resultHostRule = readCssRule(resultViewCss, ".msg.resultHost");

        expect(resultHostRule).toContain("font-family: var(--msg-standard-font-family);");
        expect(resultHostRule).not.toContain("var(--msg-monospace-font-family)");
    });

    it("Standard Rendering", () => {
        const { container, unmount } = render(
            <ResultView
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "123",
                    columns: [],
                    updatable: false,
                    fullTableName: "test",
                    data: {
                        rows: [],
                        currentPage: 0,
                    },
                }}
                editModeActive={false}
                editable={false}
            />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Bug #39941571 renders flat result values for column names containing dots", async () => {
        const field = "@@session.autocommit";
        const resultSet = createResultSet("123", [{ id: 1, [field]: 1 }], [createColumn(field, field)]);
        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={resultSet}
                editModeActive={false}
                editable={false}
            />,
        );

        await waitFor(() => {
            expect(viewRef.current?.gridRef.current?.getRows()).toHaveLength(1);
        });
        const row = viewRef.current!.gridRef.current!.getRows()[0];

        expect(row.getCell(field).getValue()).toBe(1);

        unmount();
    });

    it("reloads rows after status-only updates when not editing", async () => {
        const resultSet = createResultSet("123", [{ id: 1 }]);
        const viewRef = createRef<ResultView>();
        const { rerender, unmount } = render(
            <ResultView
                ref={viewRef}
                resultSet={resultSet}
                editModeActive={false}
                editable={false}
            />,
        );

        await nextRunLoop();

        const addDataSpy = vi.spyOn(viewRef.current!, "addData");
        resultSet.data.executionInfo = {
            type: MessageType.Response,
            text: "OK",
        };

        rerender(
            <ResultView
                ref={viewRef}
                resultSet={{ ...resultSet }}
                editModeActive={false}
                editable={false}
            />,
        );
        await nextRunLoop();

        expect(addDataSpy).toHaveBeenCalledWith(resultSet.data, true);

        addDataSpy.mockRestore();
        unmount();
    });

    it("uses basic vertical rendering for result sets with tall cell content", async () => {
        const viewRef = createRef<ResultView>();
        const resultSet = createResultSet("123", [{
            id: 1,
            explain: Object.fromEntries(Array.from({ length: 24 }, (_value, index) => {
                return [`line_${index}`, true];
            })),
        }]);

        const { unmount } = render(
            <ResultView
                ref={viewRef}
                resultSet={resultSet}
                editModeActive={false}
                editable={false}
            />,
        );

        await nextRunLoop();

        expect(hasTallCellContent(resultSet)).toBe(true);
        expect((viewRef.current as unknown as {
            gridRef: { current?: { props: { options: { renderVertical?: string; }; }; }; };
        }).gridRef.current?.props.options.renderVertical).toBe("basic");

        unmount();
    });

    it("Render with Error/Response", () => {
        const { container, unmount } = render(
            <ResultView
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "123",
                    columns: [],
                    updatable: false,
                    fullTableName: "test",
                    data: {
                        rows: [],
                        currentPage: 0,
                        executionInfo: {
                            type: MessageType.Error,
                            text: "Error",
                        },
                    },
                }}
                editModeActive={false}
                editable={false}
            />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Render with Columns", async () => {
        const columns2: IColumnInfo[] = [
            {
                title: "col1",
                field: "0",
                dataType: { type: DBDataType.Bigint },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
        ];

        const columns1: IColumnInfo[] = [
            {
                title: "col1",
                field: "0",
                dataType: { type: DBDataType.Bigint },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col2",
                field: "1",
                dataType: { type: DBDataType.Unknown },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col3",
                field: "2",
                dataType: { type: DBDataType.TinyInt },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col4",
                field: "3",
                dataType: { type: DBDataType.SmallInt },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col5",
                field: "4",
                dataType: { type: DBDataType.MediumInt },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col6",
                field: "5",
                dataType: { type: DBDataType.Int },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col7",
                field: "6",
                dataType: { type: DBDataType.Bigint },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col8",
                field: "7",
                dataType: { type: DBDataType.UInteger },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col9",
                field: "8",
                dataType: { type: DBDataType.Float },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col10",
                field: "9",
                dataType: { type: DBDataType.Real },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col11",
                field: "10",
                dataType: { type: DBDataType.Double },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col12",
                field: "11",
                dataType: { type: DBDataType.Decimal },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col13",
                field: "12",
                dataType: { type: DBDataType.Binary },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col14",
                field: "13",
                dataType: { type: DBDataType.Varbinary },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col15",
                field: "14",
                dataType: { type: DBDataType.Char },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col16",
                field: "15",
                dataType: { type: DBDataType.Nchar },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col17",
                field: "16",
                dataType: { type: DBDataType.Varchar },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col18",
                field: "17",
                dataType: { type: DBDataType.Nvarchar },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col19",
                field: "18",
                dataType: { type: DBDataType.String },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col20",
                field: "19",
                dataType: { type: DBDataType.TinyText },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col21",
                field: "20",
                dataType: { type: DBDataType.Text },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col22",
                field: "21",
                dataType: { type: DBDataType.MediumText },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col23",
                field: "22",
                dataType: { type: DBDataType.LongText },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col24",
                field: "23",
                dataType: { type: DBDataType.TinyBlob },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col25",
                field: "24",
                dataType: { type: DBDataType.Blob },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col26",
                field: "25",
                dataType: { type: DBDataType.MediumBlob },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col27",
                field: "26",
                dataType: { type: DBDataType.LongBlob },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col28",
                field: "27",
                dataType: { type: DBDataType.DateTime },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col29",
                field: "28",
                dataType: { type: DBDataType.Date },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col30",
                field: "29",
                dataType: { type: DBDataType.Time },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col31",
                field: "30",
                dataType: { type: DBDataType.Year },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col32",
                field: "31",
                dataType: { type: DBDataType.Timestamp },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col33",
                field: "32",
                dataType: { type: DBDataType.Geometry },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col34",
                field: "33",
                dataType: { type: DBDataType.Point },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col35",
                field: "34",
                dataType: { type: DBDataType.LineString },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col36",
                field: "35",
                dataType: { type: DBDataType.Polygon },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col37",
                field: "36",
                dataType: { type: DBDataType.GeometryCollection },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col38",
                field: "37",
                dataType: { type: DBDataType.MultiPoint },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col39",
                field: "38",
                dataType: { type: DBDataType.MultiLineString },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col40",
                field: "39",
                dataType: { type: DBDataType.MultiPolygon },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col41",
                field: "40",
                dataType: { type: DBDataType.Numeric },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col42",
                field: "41",
                dataType: { type: DBDataType.Json },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col43",
                field: "42",
                dataType: { type: DBDataType.Bit },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col44",
                field: "43",
                dataType: { type: DBDataType.Boolean },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col45",
                field: "44",
                dataType: { type: DBDataType.Enum },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col46",
                field: "45",
                dataType: { type: DBDataType.Set },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
        ];

        const viewRef = createRef<ResultView>();
        const { container, unmount } = render(
            <ResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "123",
                    columns: columns1,
                    updatable: false,
                    fullTableName: "test",
                    data: {
                        rows: [],
                        currentPage: 0,
                        executionInfo: {
                            type: MessageType.Info,
                            text: "Endless Possibilities",
                        },
                    },
                }}
                editModeActive={false}
                editable={false}
            />,
        );

        await nextRunLoop();
        expect(viewRef.current).toBeDefined();

        expect(container).toMatchSnapshot();

        // Updating columns does not change the columns property of the component.
        // Instead these changes are directly sent to the underlying grid.
        await viewRef.current!.updateColumns(columns2);

        const grid = container.getElementsByClassName("treeGrid");
        expect(grid).toBeDefined();

        unmount();
    });

    it("renders untouched new-row defaults as DEFAULT icons", () => {
        const columns: IColumnInfo[] = [{
            title: "id",
            field: "id",
            dataType: { type: DBDataType.Bigint },
            inPK: true,
            nullable: false,
            autoIncrement: true,
        }];
        const cell = new CellComponentMock();
        cell.fieldType = "id";
        cell.value = 0;
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 1;
        };

        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "default-cell",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ id: 0 }],
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
                rowChanges={[{
                    changes: [{ field: "id", value: defaultCellValue }],
                    deleted: false,
                    added: true,
                    pkValues: [],
                }]}
            />,
        );

        const internals = viewRef.current! as unknown as IResultViewInternals;
        const formatted = internals.numberFormatter(cell, { info: columns[0] }, vi.fn());

        expect(formatted).toBeInstanceOf(HTMLElement);
        expect((formatted as HTMLElement).querySelector(".icon")?.getAttribute("style"))
            .toContain(Assets.data.defaultValueIcon);
        expect(internals.formatCell(cell)).toBe("DEFAULT");

        unmount();
    });

    it("renders edited new-row default cells as their edited value", () => {
        const columns: IColumnInfo[] = [{
            title: "id",
            field: "id",
            dataType: { type: DBDataType.Bigint },
            inPK: true,
            nullable: false,
            autoIncrement: true,
        }];
        const cell = new CellComponentMock();
        cell.fieldType = "id";
        cell.value = 7;
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 1;
        };

        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "edited-default-cell",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ id: 7 }],
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
                rowChanges={[{
                    changes: [{ field: "id", value: defaultCellValue }, { field: "id", value: 7 }],
                    deleted: false,
                    added: true,
                    pkValues: [],
                }]}
            />,
        );

        const internals = viewRef.current! as unknown as IResultViewInternals;

        expect(internals.numberFormatter(cell, { info: columns[0] }, vi.fn())).toBe("7");
        expect(internals.formatCell(cell)).toBe("7");

        unmount();
    });

    it("removes stale changed cell styling after row changes are discarded", () => {
        const columns: IColumnInfo[] = [{
            title: "id",
            field: "id",
            dataType: { type: DBDataType.Bigint },
            inPK: true,
            nullable: false,
            autoIncrement: false,
        }];
        const cell = new CellComponentMock();
        const cellElement = document.createElement("div");
        cellElement.classList.add("changed");
        cell.getElement = vi.fn(() => {
            return cellElement;
        });
        cell.fieldType = "id";
        cell.value = 7;
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 1;
        };

        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "discard-styling",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ id: 7 }],
                        currentPage: 0,
                    },
                }}
                editModeActive={false}
                editable={true}
            />,
        );

        const internals = viewRef.current! as unknown as IResultViewInternals;

        expect(internals.numberFormatter(cell, { info: columns[0] }, vi.fn())).toBe("7");
        expect(cellElement.classList.contains("changed")).toBe(false);

        unmount();
    });

    it("ignores changed cell styling when tabulator has released the cell element", () => {
        const columns: IColumnInfo[] = [{
            title: "id",
            field: "id",
            dataType: { type: DBDataType.Bigint },
            inPK: true,
            nullable: false,
            autoIncrement: false,
        }];
        const cell = new CellComponentMock();
        cell.getElement = vi.fn(() => {
            return {} as HTMLElement;
        });
        cell.fieldType = "id";
        cell.value = 7;
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 1;
        };

        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "released-cell-element",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ id: 7 }],
                        currentPage: 0,
                    },
                }}
                editModeActive={false}
                editable={true}
            />,
        );

        const internals = viewRef.current! as unknown as IResultViewInternals;

        expect(() => {
            internals.numberFormatter(cell, { info: columns[0] }, vi.fn());
        }).not.toThrow();

        unmount();
    });

    it("records blur edits over default-marked new-row cells", () => {
        const columns: IColumnInfo[] = [createColumn("name", "name")];
        const cell = new CellComponentMock();
        cell.fieldType = "name";
        cell.value = "";
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 1;
        };

        const onFieldEdited = vi.fn().mockResolvedValue(undefined);
        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "blur-default-cell",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ name: "" }],
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
                rowChanges={[{
                    changes: [{ field: "name", value: defaultCellValue }],
                    deleted: false,
                    added: true,
                    pkValues: [],
                }]}
                onFieldEdited={onFieldEdited}
            />,
        );

        const input = document.createElement("input");
        input.value = "custom";
        const success = vi.fn((value: unknown) => {
            expect(onFieldEdited).toHaveBeenCalledWith(0, "name", "custom", "");
            cell.value = value;
        });
        const cancel = vi.fn();

        const internals = viewRef.current! as unknown as IResultViewInternals;
        internals.handleBlurEvent(cell, success, cancel, { target: input } as unknown as FocusEvent);

        expect(success).toHaveBeenCalledWith("custom");
        expect(cancel).not.toHaveBeenCalled();
        expect(onFieldEdited).toHaveBeenCalledWith(0, "name", "custom", "");

        unmount();
    });

    it("saves explicitly entered default-marked date cells on blur", () => {
        const columns: IColumnInfo[] = [{
            title: "created",
            field: "created",
            dataType: { type: DBDataType.DateTime },
            inPK: false,
            nullable: false,
            autoIncrement: false,
        }];
        const cell = new CellComponentMock();
        cell.fieldType = "created";
        cell.value = new Date("2026-04-28T12:00:00");
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 1;
        };

        const onFieldEdited = vi.fn().mockResolvedValue(undefined);
        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "blur-default-date-cell",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ created: cell.value }],
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
                rowChanges={[{
                    changes: [{ field: "created", value: defaultCellValue }],
                    deleted: false,
                    added: true,
                    pkValues: [],
                }]}
                onFieldEdited={onFieldEdited}
            />,
        );

        const input = document.createElement("input");
        input.value = "2026-04-28T12:00";
        const success = vi.fn((value: unknown) => {
            expect(onFieldEdited).toHaveBeenCalledWith(0, "created", "2026-04-28 12:00", cell.value);
            cell.value = value;
        });
        const cancel = vi.fn();

        const internals = viewRef.current! as unknown as IResultViewInternals;
        internals.handleBlurEvent(cell, success, cancel, { target: input } as unknown as FocusEvent);

        expect(success).toHaveBeenCalledWith("2026-04-28 12:00");
        expect(cancel).not.toHaveBeenCalled();
        expect(onFieldEdited).toHaveBeenCalledWith(0, "created", "2026-04-28 12:00",
            new Date("2026-04-28T12:00:00"));

        unmount();
    });

    it("keeps unchanged date/time cells untouched when the editor uses a T separator", () => {
        const columns: IColumnInfo[] = [{
            title: "created",
            field: "created",
            dataType: { type: DBDataType.DateTime },
            inPK: false,
            nullable: false,
            autoIncrement: false,
        }];
        const cell = new CellComponentMock();
        cell.fieldType = "created";
        cell.value = "2006-02-15 04:34:33";
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 8;
        };

        const onFieldEdited = vi.fn().mockResolvedValue(undefined);
        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "blur-normalized-date-cell",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ created: cell.value }],
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
                onFieldEdited={onFieldEdited}
            />,
        );

        const input = document.createElement("input");
        input.value = "2006-02-15T04:34:33";
        const success = vi.fn();
        const cancel = vi.fn();

        const internals = viewRef.current! as unknown as IResultViewInternals;
        internals.handleBlurEvent(cell, success, cancel, { target: input } as unknown as FocusEvent);

        expect(success).not.toHaveBeenCalled();
        expect(cancel).toHaveBeenCalledWith(undefined);
        expect(onFieldEdited).not.toHaveBeenCalled();

        unmount();
    });

    it("preserves T separators for date/time edits when the original value uses T", () => {
        const columns: IColumnInfo[] = [{
            title: "created",
            field: "created",
            dataType: { type: DBDataType.DateTime },
            inPK: false,
            nullable: false,
            autoIncrement: false,
        }];
        const cell = new CellComponentMock();
        cell.fieldType = "created";
        cell.value = "2006-02-15T04:34:33";
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 8;
        };

        const onFieldEdited = vi.fn().mockResolvedValue(undefined);
        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "blur-preserve-date-t",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ created: cell.value }],
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
                onFieldEdited={onFieldEdited}
            />,
        );

        const input = document.createElement("input");
        input.value = "2006-02-15T05:34:33";
        const success = vi.fn((value: unknown) => {
            cell.value = value;
        });
        const cancel = vi.fn();

        const internals = viewRef.current! as unknown as IResultViewInternals;
        internals.handleBlurEvent(cell, success, cancel, { target: input } as unknown as FocusEvent);

        expect(success).toHaveBeenCalledWith("2006-02-15T05:34:33");
        expect(cancel).not.toHaveBeenCalled();
        expect(onFieldEdited).toHaveBeenCalledWith(7, "created", "2006-02-15T05:34:33",
            "2006-02-15T04:34:33");

        unmount();
    });

    it("keeps default-marked date cells untouched when blur leaves the editor empty", () => {
        const columns: IColumnInfo[] = [{
            title: "created",
            field: "created",
            dataType: { type: DBDataType.DateTime },
            inPK: false,
            nullable: false,
            autoIncrement: false,
        }];
        const cell = new CellComponentMock();
        cell.fieldType = "created";
        cell.value = new Date("2026-04-28T12:00:00");
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 1;
        };

        const onFieldEdited = vi.fn().mockResolvedValue(undefined);
        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "blur-empty-default-date-cell",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ created: cell.value }],
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
                rowChanges={[{
                    changes: [{ field: "created", value: defaultCellValue }],
                    deleted: false,
                    added: true,
                    pkValues: [],
                }]}
                onFieldEdited={onFieldEdited}
            />,
        );

        const input = document.createElement("input");
        input.value = "";
        const success = vi.fn();
        const cancel = vi.fn();

        const internals = viewRef.current! as unknown as IResultViewInternals;
        internals.handleBlurEvent(cell, success, cancel, { target: input } as unknown as FocusEvent);

        expect(success).not.toHaveBeenCalled();
        expect(cancel).toHaveBeenCalledWith(undefined);
        expect(onFieldEdited).not.toHaveBeenCalled();

        unmount();
    });

    it("does not save a blurred value after discard cancels the active editor", () => {
        const columns: IColumnInfo[] = [createColumn("name", "name")];
        const cell = new CellComponentMock();
        cell.fieldType = "name";
        cell.value = "old";
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 1;
        };

        const onFieldEdited = vi.fn().mockResolvedValue(undefined);
        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "discard-active-editor",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ name: "old" }],
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
                onFieldEdited={onFieldEdited}
            />,
        );

        const input = document.createElement("input");
        input.value = "new";
        const success = vi.fn();
        const cancel = vi.fn();

        const internals = viewRef.current! as unknown as IResultViewInternals;
        internals.cellEditing(cell);
        internals.cancelCellEditingForDiscard();
        internals.handleBlurEvent(cell, success, cancel, { target: input } as unknown as FocusEvent);

        expect(cell.cancelEdit).toHaveBeenCalledOnce();
        expect(success).not.toHaveBeenCalled();
        expect(cancel).toHaveBeenCalledWith(undefined);
        expect(onFieldEdited).not.toHaveBeenCalled();

        unmount();
    });

    it("does not save a blurred value after a normal editor cancel", () => {
        const columns: IColumnInfo[] = [createColumn("name", "name")];
        const cell = new CellComponentMock();
        cell.fieldType = "name";
        cell.value = "old";
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 1;
        };

        const onFieldEdited = vi.fn().mockResolvedValue(undefined);
        const onFieldEditCancel = vi.fn();
        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "cancel-active-editor",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ name: "old" }],
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
                onFieldEdited={onFieldEdited}
                onFieldEditCancel={onFieldEditCancel}
            />,
        );

        const input = document.createElement("input");
        input.value = "new";
        const success = vi.fn();
        const cancel = vi.fn();

        const internals = viewRef.current! as unknown as IResultViewInternals;
        internals.cellEditing(cell);
        internals.cancelCellEditor(cancel);
        internals.cellEditCancelled();
        internals.handleBlurEvent(cell, success, cancel, { target: input } as unknown as FocusEvent);

        expect(success).not.toHaveBeenCalled();
        expect(cancel).toHaveBeenCalledWith(undefined);
        expect(onFieldEdited).not.toHaveBeenCalled();
        expect(onFieldEditCancel).toHaveBeenCalledWith(0, "name", undefined, false);

        unmount();
    });

    it("ignores a missing replacement cell after finishing an edit", async () => {
        const columns: IColumnInfo[] = [createColumn("name", "name")];
        const cell = new CellComponentMock();
        cell.fieldType = "name";
        cell.value = "old";
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 1;
        };

        const replacementRow = new RowComponentMock();
        replacementRow.getCell = vi.fn(() => {
            return false;
        });

        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "missing-replacement-cell",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ name: "old" }],
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
                onFieldEdited={vi.fn().mockResolvedValue(undefined)}
            />,
        );

        const input = document.createElement("input");
        input.value = "new";
        const success = vi.fn();
        const cancel = vi.fn();
        const internals = viewRef.current! as unknown as IResultViewInternals;
        (viewRef.current as unknown as {
            gridRef: { current: { getRows: () => RowComponentMock[]; setData: () => Promise<void>; }; };
        })
            .gridRef.current = {
                getRows: () => {
                    return [replacementRow];
                },
                setData: vi.fn().mockResolvedValue(undefined),
            };

        internals.cellEditing(cell);
        internals.handleBlurEvent(cell, success, cancel, { target: input } as unknown as FocusEvent);
        await new Promise((resolve) => {
            setTimeout(resolve, 150);
        });

        expect(replacementRow.getCell).toHaveBeenCalledWith("name");

        unmount();
    });

    it("clears editing state when an unchanged editor value is confirmed", () => {
        const columns: IColumnInfo[] = [createColumn("name", "name")];
        const cell = new CellComponentMock();
        cell.fieldType = "name";
        cell.value = "old";
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 1;
        };

        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "confirm-unchanged-editor",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ name: "old" }],
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
            />,
        );

        const internals = viewRef.current! as unknown as IResultViewInternals;
        internals.cellEditing(cell);
        const [definition] = internals.generateColumnDefinitions(columns, true);
        expect(definition.editable?.()).toBe(false);

        internals.handleConfirm(cell);

        expect(internals.editingCell).toBeUndefined();
        expect(definition.editable?.()).toBe(true);

        unmount();
    });

    it("edits the selected cell when toolbar edit starts editing", () => {
        const columns: IColumnInfo[] = [createColumn("name", "name")];
        const cell = new CellComponentMock();
        assignColumn(cell, columns[0]);

        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "edit-selected-cell",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ name: "old" }],
                        currentPage: 0,
                    },
                }}
                editModeActive={false}
                editable={true}
            />,
        );

        viewRef.current!.setFakeCell(cell);
        viewRef.current!.editSelectedOrFirstCell();

        expect(cell.edit).toHaveBeenCalledOnce();

        unmount();
    });

    it("ignores stale manual focus when tabulator has released the selected cell element", () => {
        const columns: IColumnInfo[] = [createColumn("name", "name")];
        const staleCell = new CellComponentMock();
        staleCell.getElement = vi.fn(() => {
            return {} as HTMLElement;
        });

        const nextCell = new CellComponentMock();
        const nextCellElement = document.createElement("div");
        nextCell.getElement = vi.fn(() => {
            return nextCellElement;
        });
        assignColumn(nextCell, columns[0]);

        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "released-manual-focus-element",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ name: "old" }],
                        currentPage: 0,
                    },
                }}
                editModeActive={false}
                editable={true}
            />,
        );

        viewRef.current!.setFakeCell(staleCell);
        const internals = viewRef.current! as unknown as IResultViewInternals;

        expect(() => {
            internals.handleCellClick(new MouseEvent("click"), nextCell);
        }).not.toThrow();
        expect(nextCellElement.classList.contains("manualFocus")).toBe(true);

        unmount();
    });

    it("moves the selected cell with keyboard navigation", () => {
        const columns: IColumnInfo[] = [createColumn("id", "id"), createColumn("name", "name")];
        const cells = [new CellComponentMock(), new CellComponentMock(), new CellComponentMock(),
            new CellComponentMock()];
        const elements = cells.map(() => {
            const element = document.createElement("div");
            element.tabIndex = -1;

            return element;
        });

        cells.forEach((cell, index) => {
            cell.getElement = vi.fn(() => {
                return elements[index];
            });
            assignColumn(cell, columns[index % 2]);
        });

        const firstRow = cells[0].row;
        const secondRow = cells[2].row;
        cells[1].row = firstRow;
        cells[3].row = secondRow;
        firstRow.getCells = vi.fn(() => {
            return [cells[0], cells[1]];
        });
        secondRow.getCells = vi.fn(() => {
            return [cells[2], cells[3]];
        });
        firstRow.nextRow = secondRow;

        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "keyboard-cell-navigation",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ id: 1, name: "one" }, { id: 2, name: "two" }],
                        currentPage: 0,
                    },
                }}
                editModeActive={false}
                editable={true}
            />,
        );

        const internals = viewRef.current! as unknown as IResultViewInternals;
        internals.handleCellClick(new MouseEvent("click"), cells[0]);

        expect(elements[0].classList.contains("manualFocus")).toBe(true);

        internals.handleKeyDown(new KeyboardEvent("keydown", { key: KeyboardKeys.ArrowRight }));

        expect(elements[0].classList.contains("manualFocus")).toBe(false);
        expect(elements[1].classList.contains("manualFocus")).toBe(true);

        internals.handleKeyDown(new KeyboardEvent("keydown", { key: KeyboardKeys.ArrowDown }));

        expect(elements[1].classList.contains("manualFocus")).toBe(false);
        expect(elements[3].classList.contains("manualFocus")).toBe(true);

        internals.handleKeyDown(new KeyboardEvent("keydown", { key: KeyboardKeys.Tab }));

        expect(elements[3].classList.contains("manualFocus")).toBe(true);

        internals.handleKeyDown(new KeyboardEvent("keydown", { key: KeyboardKeys.Tab, shiftKey: true }));

        expect(elements[3].classList.contains("manualFocus")).toBe(false);
        expect(elements[2].classList.contains("manualFocus")).toBe(true);

        unmount();
    });

    it("finishes a focused editor before commit continues", async () => {
        const columns: IColumnInfo[] = [createColumn("name", "name")];
        const cell = new CellComponentMock();
        const cellElement = document.createElement("div");
        const input = document.createElement("input");
        cellElement.appendChild(input);
        document.body.appendChild(cellElement);
        cell.getElement = vi.fn(() => {
            return cellElement;
        });
        cell.fieldType = "name";
        cell.value = "old";
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 1;
        };

        let resolveEdit: (() => void) | undefined;
        const editPromise = new Promise<void>((resolve) => {
            resolveEdit = resolve;
        });
        const onFieldEdited = vi.fn(() => {
            return editPromise;
        });
        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "apply-active-editor",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ name: "old" }],
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
                onFieldEdited={onFieldEdited}
            />,
        );

        const success = vi.fn((value: unknown) => {
            cell.value = value;
        });
        const cancel = vi.fn();
        const internals = viewRef.current! as unknown as IResultViewInternals;
        input.addEventListener("blur", (event) => {
            internals.handleBlurEvent(cell, success, cancel, event);
        });
        input.value = "new";
        input.focus();

        internals.cellEditing(cell);
        let finishReturned = false;
        const finishPromise = internals.finishCellEditingForCommit().then(() => {
            finishReturned = true;
        });
        await nextRunLoop();

        expect(success).toHaveBeenCalledWith("new");
        expect(cancel).not.toHaveBeenCalled();
        expect(onFieldEdited).toHaveBeenCalledWith(0, "name", "new", "old");
        expect(finishReturned).toBe(false);

        expect(resolveEdit).toBeDefined();
        resolveEdit!();
        await finishPromise;
        expect(finishReturned).toBe(true);

        cellElement.remove();
        unmount();
    });

    it("enables setting nullable cells to null when formatter metadata is missing", () => {
        const columns: IColumnInfo[] = [{
            ...createColumn("nullableColumn", "nullableColumn"),
            nullable: true,
        }];
        const cell = new CellComponentMock();
        assignColumnWithoutFormatterParams(cell, columns[0]);

        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "nullable-context-menu",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ nullableColumn: "Animal" }],
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
            />,
        );

        viewRef.current!.setFakeCell(cell);
        const internals = viewRef.current! as unknown as IResultViewInternals;

        expect(internals.handleCellMenuItemDisabled({
            command: { title: "Set Field to Null", command: "setNullMenuItem" },
        })).toBe(false);

        unmount();
    });

    it("disables null and default actions for deleted rows", () => {
        const columns: IColumnInfo[] = [{
            ...createColumn("nullableColumn", "nullableColumn"),
            nullable: true,
        }];
        const cell = new CellComponentMock();
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 1;
        };

        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "deleted-context-menu",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ nullableColumn: "Animal" }],
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
                rowChanges={[{
                    changes: [],
                    deleted: true,
                    added: false,
                    pkValues: [1],
                }]}
            />,
        );

        viewRef.current!.setFakeCell(cell);
        const internals = viewRef.current! as unknown as IResultViewInternals;

        expect(internals.handleCellMenuItemDisabled({
            command: { title: "Set Field to Null", command: "setNullMenuItem" },
        })).toBe(true);
        expect(internals.handleCellMenuItemDisabled({
            command: { title: "Set Field to Default", command: "setDefaultMenuItem" },
        })).toBe(true);

        unmount();
    });

    it("clears the context menu focus when the menu closes", async () => {
        const columns: IColumnInfo[] = [createColumn("name", "name")];
        const cell = new CellComponentMock();
        const cellElement = document.createElement("div");
        cell.getElement = vi.fn(() => {
            return cellElement;
        });
        assignColumn(cell, columns[0]);
        cell.row.getPosition = () => {
            return 1;
        };

        const viewRef = createRef<TestResultView>();
        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "context-menu-focus",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows: [{ name: "Animal" }],
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
            />,
        );

        const internals = viewRef.current! as unknown as IResultViewInternals;
        await act(() => {
            internals.handleCellContext(new MouseEvent("contextmenu", { clientX: 5, clientY: 10 }), cell);
        });

        expect(cellElement.classList.contains("manualFocus")).toBe(true);

        const nextCell = new CellComponentMock();
        const nextCellElement = document.createElement("div");
        nextCell.getElement = vi.fn(() => {
            return nextCellElement;
        });
        assignColumn(nextCell, columns[0]);
        nextCell.row.getPosition = () => {
            return 1;
        };

        await act(() => {
            internals.handleCellContext(new MouseEvent("contextmenu", { clientX: 7, clientY: 12 }), nextCell);
        });

        expect(cellElement.classList.contains("manualFocus")).toBe(false);
        expect(nextCellElement.classList.contains("manualFocus")).toBe(true);

        await act(() => {
            viewRef.current!.cellContextMenuRef.current!.close();
        });

        expect(nextCellElement.classList.contains("manualFocus")).toBe(false);

        unmount();
    });

    it("Context Menu", async () => {
        const columns: IColumnInfo[] = [
            {
                title: "col1",
                field: "id",
                dataType: { type: DBDataType.Bigint },
                inPK: true,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col2",
                field: "1",
                dataType: { type: DBDataType.String },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
        ];

        const rows = [
            { id: "42", 1: "abc" },
            { id: "43", 1: "def" },
            { id: "44", 1: "ghi" },
        ];

        const viewRef = createRef<TestResultView>();
        const onFieldEdited = vi.fn().mockResolvedValue(undefined);
        const { container, unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "123",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows,
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
                onFieldEdited={onFieldEdited}
            />,
        );

        const grid = container.getElementsByClassName("treeGrid");
        expect(grid).toHaveLength(1);

        // We can show the cell context menu only by explicitly calling its open method, because we have no real cell
        // to trigger a context menu event on. That is possible only when Tabulator actually renders its content
        // (which doesn't happen because of the zero sized host).
        const rect = container.getBoundingClientRect();

        // Find the cell context menu and open it.
        const menu = viewRef.current!.cellContextMenuRef.current;
        expect(menu).toBeDefined();

        const cell = new CellComponentMock();
        assignColumn(cell, columns[1]);
        cell.row.getPosition = () => {
            return 1;
        };
        await act(() => {
            viewRef.current!.setFakeCell(cell);
            menu!.open(rect, false);
        });

        // Check the enabled state of each menu entry.
        const portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        const elements = document.getElementsByClassName("menuItem");
        expect(elements).toHaveLength(18);

        const clipboardSpy = vi.spyOn(requisitions, "writeToClipboard").mockImplementation(() => { /**/ });

        try {
            // @ts-expect-error, itemRef is private
            const menuItems = menu!.itemRefs.map((item) => {
                return item.current;
            });
            expect(menuItems.length).toEqual(14); // There are four separator items without a ref.

            for (const item of menuItems) {
                expect(item).toBeDefined();

                // Set the fake cell again on each round, as it is reset when the action handler is called.
                viewRef.current!.setFakeCell(cell);

                // @ts-expect-error, itemRef is private
                const element = item!.itemRef.current!;

                const command = item?.props.command.command;
                switch (command) {
                    case "openValueMenuItem": {
                        expect(element.classList.contains("disabled")).toBe(true);
                        element.click();

                        // TODO: test handling, once implemented.

                        break;
                    }

                    case "setNullMenuItem": {
                        expect(element.classList.contains("disabled")).toBe(true);

                        expect(cell.getValue()).toBe("Animal");
                        element.click();
                        expect(cell.getValue()).toBe("Animal"); // Can't be changed. It's disabled.

                        // Restore value.
                        cell.setValue("Animal");

                        break;
                    }

                    case "setDefaultMenuItem": {
                        expect(element.classList.contains("disabled")).toBe(false);

                        element.click();
                        await nextRunLoop();
                        expect(onFieldEdited).toHaveBeenLastCalledWith(0, "1", defaultCellValue, "Animal");

                        break;
                    }

                    case "saveToFileMenuItem": {
                        expect(element.classList.contains("disabled")).toBe(true);
                        element.click();

                        // TODO: test handling, once implemented.

                        break;
                    }

                    case "loadFromFileMenuItem": {
                        expect(element.classList.contains("disabled")).toBe(true);
                        element.click();

                        // TODO: test handling, once implemented.

                        break;
                    }

                    case "copyRowSubmenu": {
                        expect(element.classList.contains("submenu")).toBe(true);
                        item?.openSubMenu(false);

                        await nextProcessTick();

                        const portals = document.getElementsByClassName("portal");
                        expect(portals).toHaveLength(2);

                        const subItems = portals.item(1)?.getElementsByClassName("menuItem");
                        expect(subItems).not.toBeNull();
                        for (let i = 0; i < subItems!.length; ++i) {
                            const subItem = subItems!.item(i) as HTMLButtonElement;
                            expect(subItem).not.toBeNull();

                            viewRef.current!.setFakeCell(cell);
                            switch (subItem.id) {
                                case "copyRowMenuItem1": {
                                    subItem.click();
                                    expect(clipboardSpy).toHaveBeenLastCalledWith("43, 'def'\n");

                                    break;
                                }

                                case "copyRowMenuItem2": {
                                    subItem.click();
                                    expect(clipboardSpy).toHaveBeenLastCalledWith(
                                        "# col1, col2\n43, 'def'\n");

                                    break;
                                }

                                case "copyRowMenuItem3": {
                                    subItem.click();
                                    expect(clipboardSpy).toHaveBeenLastCalledWith(
                                        "43, def\n");

                                    break;
                                }

                                case "copyRowMenuItem4": {
                                    subItem.click();
                                    expect(clipboardSpy).toHaveBeenLastCalledWith(
                                        "# col1, col2\n43, def\n");

                                    break;
                                }

                                case "copyRowMenuItem5": {
                                    subItem.click();
                                    expect(clipboardSpy).toHaveBeenLastCalledWith(
                                        "# col1\tcol2\n43\t'def'\n");

                                    break;
                                }

                                case "copyRowMenuItem6": {
                                    subItem.click();
                                    expect(clipboardSpy).toHaveBeenLastCalledWith(
                                        "43\t'def'\n");

                                    break;
                                }

                                default:
                            }
                        }

                        item?.closeSubMenu();

                        break;
                    }

                    case "copyRowsSubmenu": {
                        expect(element.classList.contains("submenu")).toBe(true);
                        item?.openSubMenu(false);

                        await nextProcessTick();

                        const portals = document.getElementsByClassName("portal");
                        expect(portals).toHaveLength(2);

                        const subItems = portals.item(1)?.getElementsByClassName("menuItem");
                        expect(subItems).not.toBeNull();
                        for (let i = 0; i < subItems!.length; ++i) {
                            const subItem = subItems!.item(i) as HTMLButtonElement;
                            expect(subItem).not.toBeNull();

                            viewRef.current!.setFakeCell(cell);
                            switch (subItem.id) {
                                case "copyRowsMenuItem1": {
                                    expect(subItem.classList.contains("disabled")).toBe(false);
                                    subItem.click();
                                    expect(clipboardSpy).toHaveBeenCalledTimes(7);

                                    break;
                                }

                                case "copyRowsMenuItem2": {
                                    expect(subItem.classList.contains("disabled")).toBe(false);
                                    subItem.click();
                                    expect(clipboardSpy).toHaveBeenCalledTimes(8);

                                    break;
                                }

                                case "copyRowsMenuItem3": {
                                    expect(subItem.classList.contains("disabled")).toBe(false);
                                    subItem.click();
                                    expect(clipboardSpy).toHaveBeenCalledTimes(9);

                                    break;
                                }

                                case "copyRowsMenuItem4": {
                                    expect(subItem.classList.contains("disabled")).toBe(false);
                                    subItem.click();
                                    expect(clipboardSpy).toHaveBeenCalledTimes(10);

                                    break;
                                }

                                case "copyRowsMenuItem5": {
                                    expect(subItem.classList.contains("disabled")).toBe(false);
                                    subItem.click();
                                    expect(clipboardSpy).toHaveBeenCalledTimes(11);

                                    break;
                                }

                                case "copyRowsMenuItem6": {
                                    expect(subItem.classList.contains("disabled")).toBe(false);
                                    subItem.click();
                                    expect(clipboardSpy).toHaveBeenCalledTimes(12);

                                    break;
                                }

                                case "copyRowsMenuItem7": {
                                    expect(subItem.classList.contains("disabled")).toBe(false);
                                    subItem.click();
                                    expect(clipboardSpy).toHaveBeenCalledTimes(13);

                                    break;
                                }

                                case "copyRowsMenuItem8": {
                                    expect(subItem.classList.contains("disabled")).toBe(false);
                                    subItem.click();
                                    expect(clipboardSpy).toHaveBeenCalledTimes(14);

                                    break;
                                }

                                default: {
                                    expect(subItem.classList.contains("divider")).toBe(true);
                                }
                            }
                        }

                        item?.closeSubMenu();

                        break;
                    }

                    case "copyFieldMenuItem": {
                        expect(element.classList.contains("disabled")).toBe(false);
                        element.click();

                        expect(clipboardSpy).toHaveBeenLastCalledWith("'Animal'");

                        break;
                    }

                    case "copyFieldUnquotedMenuItem": {
                        expect(element.classList.contains("disabled")).toBe(false);
                        element.click();

                        expect(clipboardSpy).toHaveBeenLastCalledWith("Animal");

                        break;
                    }

                    case "pasteRowMenuItem": {
                        expect(element.classList.contains("disabled")).toBe(true);
                        element.click();

                        // TODO: test handling, once implemented.

                        break;
                    }

                    case "deleteRowMenuItem": {
                        expect(element.classList.contains("disabled")).toBe(false);

                        // TODO: test handling, once implemented.

                        break;
                    }

                    case "capitalizeMenuItem": { // Means: title case.
                        expect(element.classList.contains("disabled")).toBe(false);

                        cell.setValue("animalsOrHumans");
                        element.click();
                        expect(cell.getValue()).toBe("AnimalsOrHumans");

                        break;
                    }

                    case "lowerCaseMenuItem": {
                        expect(element.classList.contains("disabled")).toBe(false);

                        cell.setValue("AnimAL");
                        element.click();
                        expect(cell.getValue()).toBe("animal");

                        break;
                    }

                    case "upperCaseMenuItem": {
                        expect(element.classList.contains("disabled")).toBe(false);

                        cell.setValue("animal");
                        element.click();
                        expect(cell.getValue()).toBe("ANIMAL");

                        break;
                    }

                    case "editValueMenuItem": {
                        break;
                    }

                    default: {
                        // Sub menu or divider.
                        if (element.id === "") {
                            expect(element.classList.contains("divider")).toBe(true);
                        } else {
                            expect(item?.props.command.title.startsWith("Copy ")).toBe(true);
                        }
                    }
                }
            }
        } catch (e) {
            // Close the menu first before handling the error or we get an error when the portal
            // is closed implicitly, when no document is available anymore.
            menu!.close();
            throw e;
        }

        clipboardSpy.mockRestore();

        unmount();

    });

    it("uses the native Electron bridge for the result cell context menu", async () => {
        const columns = [createColumn("name", "0")];
        const rows = [{ 0: "Animal" }];
        const viewRef = createRef<TestResultView>();
        const showNativeMenu = vi.fn().mockResolvedValue(undefined);
        let nativeMenuHandler: ((event: { type: "select"; requestId: string; itemId: string; }) => void) | undefined;

        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
                showNativeMenu,
                closeNativeMenu: vi.fn().mockResolvedValue(undefined),
                setNativeMenuHandler: (handler: typeof nativeMenuHandler) => {
                    nativeMenuHandler = handler;
                },
            },
        });

        const { unmount } = render(
            <TestResultView
                ref={viewRef}
                resultSet={{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "native-menu-result",
                    columns,
                    updatable: true,
                    fullTableName: "test",
                    data: {
                        rows,
                        currentPage: 0,
                    },
                }}
                editModeActive={true}
                editable={true}
            />,
        );

        const clipboardSpy = vi.spyOn(requisitions, "writeToClipboard").mockImplementation(() => { /**/ });
        const menu = viewRef.current!.cellContextMenuRef.current;
        const cell = new CellComponentMock();

        viewRef.current!.setFakeCell(cell);
        menu!.open(new DOMRect(5, 10, 2, 2), false);
        await nextRunLoop();

        expect(showNativeMenu).toHaveBeenCalledTimes(1);
        const request = showNativeMenu.mock.calls[0][0] as {
            id: string;
            x?: number;
            y?: number;
            items: Array<{
                id: string;
                label?: string;
                enabled?: boolean;
                submenu?: Array<{ id: string; label?: string; }>;
            }>;
        };
        expect(request.x).toBeUndefined();
        expect(request.y).toBeUndefined();

        expect(request.items).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: "Open Value in Editor", enabled: false }),
            expect.objectContaining({
                label: "Copy Single Row",
                submenu: expect.arrayContaining([
                    expect.objectContaining({ label: "Copy Row" }),
                ]),
            }),
            expect.objectContaining({ label: "Copy Field", enabled: true }),
        ]));

        const copyField = request.items.find((item) => {
            return item.label === "Copy Field";
        });
        expect(copyField).toBeTruthy();

        nativeMenuHandler?.({
            type: "select",
            requestId: request.id,
            itemId: copyField!.id,
        });
        await nextRunLoop();

        expect(clipboardSpy).toHaveBeenCalledWith("'Animal'");

        clipboardSpy.mockRestore();
        unmount();
    });
});

describe("Test getWideColumns", (): void => {
    const shortValue = "short";
    const longValue = "long".repeat(100);

    it("Test all short values", () => {
        const rows = [
            { 0: "42", 1: shortValue },
            { 0: "43", 1: shortValue },
        ];
        const columns = [createColumn("id", "0"), createColumn("value", "1")];
        const resultSet = createResultSet("abc", rows, columns);

        const wideColumns = getWideColumns(resultSet);

        expect(wideColumns.size).toBe(0);
    });

    it("Test with long value in the end of the set", () => {
        const rows = [
            { 0: "42", 1: shortValue },
            { 0: "43", 1: longValue },
        ];
        const columns = [createColumn("id", "0"), createColumn("value", "1")];
        const resultSet = createResultSet("abc", rows, columns);

        const wideColumns = getWideColumns(resultSet);

        expect(wideColumns.has("id")).toBeFalsy();
        expect(wideColumns.has("value")).toBeTruthy();
    });

    it("Test with long value in the beginning of the set", () => {
        const rows = [
            { 0: "43", 1: longValue },
            { 0: "42", 1: shortValue },
        ];
        const columns = [createColumn("id", "0"), createColumn("value", "1")];
        const resultSet = createResultSet("abc", rows, columns);

        const wideColumns = getWideColumns(resultSet);

        expect(wideColumns.has("id")).toBeFalsy();
        expect(wideColumns.has("value")).toBeTruthy();
    });
});

describe("Test updateWideColumnsCache", (): void => {
    const shortValue = "short";
    const longValue = "long".repeat(100);

    it("Test short values", () => {
        const columnsCache = new Map<string, number>();

        const rows = [
            { 0: "42", 1: shortValue },
            { 0: "43", 1: shortValue },
        ];
        const columns = [createColumn("id", "0"), createColumn("value", "1")];
        const resultSet = createResultSet("abc", rows, columns);

        updateWideColumnsCache(columnsCache, resultSet);

        expect(columnsCache.size).toBe(0);
    });

    it("Test previous long values deleted", () => {
        const columnsCache = new Map<string, number>();
        columnsCache.set("id", 400);
        columnsCache.set("value", 400);

        const rows = [
            { 0: "42", 1: shortValue },
            { 0: "43", 1: shortValue },
        ];
        const columns = [createColumn("id", "0"), createColumn("value", "1")];
        const resultSet = createResultSet("abc", rows, columns);

        updateWideColumnsCache(columnsCache, resultSet);

        expect(columnsCache.has("id")).toBeFalsy();
        expect(columnsCache.has("value")).toBeFalsy();
    });

    it("Test with long value", () => {
        const columnsCache = new Map<string, number>();

        const rows = [
            { 0: "42", 1: longValue, 2: shortValue },
            { 0: "43", 1: shortValue, 2: shortValue },
        ];
        const columns = [
            createColumn("id", "0"),
            createColumn("long_value", "1"),
            createColumn("short_value", "2"),
        ];
        const resultSet = createResultSet("abc", rows, columns);

        updateWideColumnsCache(columnsCache, resultSet);

        expect(columnsCache.has("id")).toBeFalsy();
        expect(columnsCache.has("long_value")).toBeTruthy();
        expect(columnsCache.has("short_value")).toBeFalsy();
    });
});
