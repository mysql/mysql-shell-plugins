/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import { mount } from "enzyme";

import { DBDataType, IColumnInfo, MessageType } from "../../../../../app-logic/general-types.js";
import { ResultView } from "../../../../../components/ResultView/ResultView.js";
import { Menu } from "../../../../../components/ui/Menu/Menu.js";
import { TreeGrid } from "../../../../../components/ui/TreeGrid/TreeGrid.js";
import { requisitions } from "../../../../../supplement/Requisitions.js";
import { nextProcessTick } from "../../../test-helpers.js";
import { CellComponentMock } from "../../../__mocks__/CellComponentMock.js";

describe("Result View Tests", (): void => {

    it("Standard Rendering", () => {
        const component = mount<ResultView>(
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

        expect(component).toMatchSnapshot();

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

        expect(component).toMatchSnapshot();

        component.setProps({
            resultSet: {
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

        const component = mount<ResultView>(
            <ResultView
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

        expect(component).toMatchSnapshot();

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

        const wrapper = mount<ResultView>(
            <ResultView
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
            />,
        );

        const contextMenus = wrapper.find<Menu>(Menu);
        expect(contextMenus).toBeDefined();

        const grid = wrapper.find<TreeGrid>(TreeGrid);
        expect(grid).toBeDefined();
        const table = await grid.instance().table;
        expect(table).toBeDefined();
        table?.selectRow(["43"]); // Select second row.

        // We can show the cell context menu only by explicitly calling its open method, because we have no real cell
        // to trigger a context menu event on. That is possible only when Tabulator actually renders its content
        // (which doesn't happen because of the zero sized host).
        const rect = wrapper.getDOMNode().getBoundingClientRect();

        // Find the cell context menu and open it.
        let menu!: ReturnType<typeof wrapper.find<Menu>>;
        contextMenus.forEach((contextMenu) => {
            const menuProps = contextMenu.props();
            if (menuProps.id === "cellContextMenu") {
                menu = contextMenu;
            }
        });

        const cell = new CellComponentMock();
        wrapper.instance().setFakeCell(cell);
        menu.instance().open(rect, false);
        await nextProcessTick();

        // Check the enabled state of each menu entry.
        const portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        const elements = document.getElementsByClassName("menuItem");
        expect(elements).toHaveLength(17);

        const clipboardSpy = jest.spyOn(requisitions, "writeToClipboard")
            .mockImplementation((_text: string) => {
                // no-op
            });

        try {
            // @ts-ignore, finding the menu items via enzyme does not work, so we have to do it manually.
            const menuItems = menu.instance().itemRefs.map((item) => { return item.current; });
            expect(menuItems.length).toEqual(13); // There are four separator items without a ref.

            for (const item of menuItems) {
                expect(item).toBeDefined();

                // Set the fake cell again on each round, as it is reset when the action handler is called.
                wrapper.instance().setFakeCell(cell);

                // @ts-ignore, itemRef is private
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

                            wrapper.instance().setFakeCell(cell);
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

                            wrapper.instance().setFakeCell(cell);
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
            menu.instance().close();
            throw e;
        }

        clipboardSpy.mockRestore();

        wrapper.unmount();

    });
});
