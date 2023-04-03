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

import { MessageType } from "../../../../../app-logic/Types";
import { ResultStatus } from "../../../../../components/ResultView/ResultStatus";
import { ResultTabView } from "../../../../../components/ResultView/ResultTabView";
import { Button } from "../../../../../components/ui/Button/Button";
import { IResultSets } from "../../../../../script-execution";
import { nextProcessTick, nextRunLoop } from "../../../test-helpers";

describe("Result Tabview Tests", (): void => {

    it("Standard Rendering", () => {
        const component = mount<ResultTabView>(
            <ResultTabView
                resultSets={{
                    type: "resultSets",
                    sets: [],
                }}
                contextId="ec123"
                hideTabs="single"
                showMaximizeButton="never"
            />,
        );

        expect(component).toMatchSnapshot();

        component.unmount();
    });

    it("Rendering Only Output", () => {
        const component = mount<ResultTabView>(
            <ResultTabView
                resultSets={{
                    type: "resultSets",
                    output: [
                        { type: MessageType.Error, content: "Message 1" },
                        { type: MessageType.Response, content: "Message 2" },
                    ],
                    sets: [],
                }}
                contextId="ec123"
                hideTabs="never"
                showMaximizeButton="never"
            />,
        );

        expect(component).toMatchSnapshot();

        component.unmount();
    });

    it("Tabview With Result Sets", () => {
        const component = mount<ResultTabView>(
            <ResultTabView
                resultSets={{
                    type: "resultSets",
                    sets: [{
                        type: "resultSet",
                        sql: "select 1",
                        resultId: "123",
                        columns: [],
                        data: {
                            rows: [],
                            currentPage: 0,
                            executionInfo: {
                                text: "All fine",
                                type: MessageType.Response,
                            },
                        },
                    }, {
                        type: "resultSet",
                        sql: "select 2",
                        resultId: "456",
                        columns: [],
                        data: {
                            rows: [],
                            currentPage: 10,
                        },
                    }],
                    output: [
                        {
                            type: MessageType.Info,
                            content: "Lorem ipsum dolor sit amet",
                            language: "ini",
                        },
                    ],
                }}
                contextId="ec123"
                hideTabs="single"
                showMaximizeButton="tab"
            />,
        );

        expect(component).toMatchSnapshot();

        component.unmount();
    });

    it("Update Data", async () => {
        const component = mount<ResultTabView>(
            <ResultTabView
                resultSets={{
                    type: "resultSets",
                    sets: [{
                        type: "resultSet",
                        sql: "select 1",
                        resultId: "123",
                        columns: [],
                        data: {
                            rows: [],
                            currentPage: 0,
                        },
                    }, {
                        type: "resultSet",
                        sql: "select 2",
                        resultId: "456",
                        columns: [],
                        data: {
                            rows: [],
                            currentPage: 10,
                        },
                    }],
                }}
                contextId="ec123"
                hideTabs="never"
                showMaximizeButton="statusBar"

            />,
        );

        let tabs = component.find(Button);
        expect(tabs).toHaveLength(2);

        let found = false;
        tabs.forEach((tab) => {
            if (tab.props().id === "123") {
                found = true;
                tab.getDOMNode<HTMLButtonElement>().click(); // Select the first as the current result set.
            }
        });
        expect(found).toBe(true);
        expect(component.state().currentResultSet).toBeDefined();
        expect(component.state().currentResultSet?.resultId).toBe("123");

        await component.instance().updateColumns("123", []);

        // Add data with and w/o execution info.
        await component.instance().addData({
            type: "resultSetRows",
            columns: [],
            rows: [],
            currentPage: 111,
        }, "123");

        let status = component.find(ResultStatus);
        expect(status).toHaveLength(0);

        await component.instance().addData({
            type: "resultSetRows",
            columns: [],
            rows: [],
            currentPage: 111,
            executionInfo: {
                text: "All fine",
                type: MessageType.Response,
            },
        }, "123");
        await nextProcessTick();

        // Data added via addData does not modify the original data. The owner has to take care to provide this data.
        status = component.find(ResultStatus);
        expect(status).toHaveLength(0);

        // Now update the component with data that has an executionInfo field to create a status.
        // We keep the original result set by intention, to keep it selected.
        // Also add output text to the set, while we are at it, to add an output tab to the set.
        component.setProps({
            resultSets: {
                type: "resultSets",
                output: [
                    {
                        type: MessageType.Info,
                        content: "Lorem ipsum dolor sit amet",
                        language: "ini",
                    },
                ],
                sets: [{
                    type: "resultSet",
                    sql: "select 1",
                    resultId: "123",
                    columns: [],
                    data: {
                        rows: [],
                        currentPage: 111,
                        executionInfo: {
                            text: "All fine",
                            type: MessageType.Response,
                        },
                    },
                }, {
                    type: "resultSet",
                    sql: "select 2",
                    resultId: "456",
                    columns: [],
                    data: {
                        rows: [],
                        currentPage: 10,
                    },
                }],
            },
        });

        await nextProcessTick();

        status = component.find(ResultStatus);
        expect(status).toHaveLength(1);

        // Check the output tab.
        tabs = component.find(Button);
        expect(tabs).toHaveLength(3); // Like before, but now with the output tab.

        found = false;
        tabs.forEach((tab) => {
            if (tab.props().id === "output") {
                found = true;
                tab.getDOMNode<HTMLButtonElement>().click(); // Select the first as the current result set.
            }
        });
        expect(found).toBe(true);
        expect(component.state().currentResultSet).not.toBeDefined(); // No result set is selected anymore.

        component.unmount();
    });

    it("Toolbar", async () => {
        const resultSets: IResultSets = {
            type: "resultSets",
            output: [
                {
                    type: MessageType.Info,
                    content: "Lorem ipsum dolor sit amet",
                    language: "ini",
                },
            ],
            sets: [{
                type: "resultSet",
                sql: "select 1",
                resultId: "123",
                columns: [],
                data: {
                    rows: [],
                    currentPage: 0,
                    hasMoreRows: true,
                },
            }, {
                type: "resultSet",
                sql: "select 2",
                resultId: "456",
                columns: [],
                data: {
                    rows: [],
                    currentPage: 1,
                    hasMoreRows: true,
                    executionInfo: {
                        text: "All fine",
                        // No message type by intention.
                    },
                },
            }],
        };

        const onResultPageChange = jest.fn(() => {
            // no-op
        });

        const component = mount<ResultTabView>(
            <ResultTabView
                resultSets={resultSets}
                contextId="ec123"
                hideTabs="single"
                showMaximizeButton="tab"
                onResultPageChange={onResultPageChange}
            />,
        );

        await nextProcessTick();

        // Select the second result set.
        const tabs = component.find(Button);
        expect(tabs).toHaveLength(5);

        let found = false;
        tabs.forEach((tab) => {
            if (tab.props().id === "456") {
                found = true;
                tab.getDOMNode<HTMLButtonElement>().click();
            }
        });
        expect(found).toBe(true);
        expect(component.state().currentResultSet).toBeDefined();
        await nextRunLoop();

        const toolbars = component.getDOMNode().getElementsByClassName("toolbar");
        expect(toolbars).toHaveLength(1);

        const buttons = component.getDOMNode().getElementsByClassName("button");
        expect(buttons).toHaveLength(10);

        const dividers = component.getDOMNode().getElementsByClassName("divider");
        expect(dividers).toHaveLength(3);

        // Click all buttons:

        // Previous page.
        let button = buttons.namedItem("previousPageButton") as HTMLButtonElement;
        expect(button).toBeDefined();
        expect(button.getAttribute("data-tooltip")).toBe("Previous Page");
        expect(button.classList.contains("disabled")).toBe(false);

        // Clicking this button normally loads a new set of data in a callback (while still maintaining an internal
        // page counter for visual updates).
        // We only need to update the UI here.
        button.click();
        component.instance().forceUpdate();
        await nextRunLoop();

        expect(button.classList.contains("disabled")).toBe(true);
        expect(resultSets.sets[1].data.currentPage).toBe(0);
        expect(onResultPageChange).toBeCalledTimes(1);

        // Now at the first page. Cannot go further.
        button.click();
        expect(resultSets.sets[1].data.currentPage).toBe(0);
        expect(onResultPageChange).toBeCalledTimes(1);

        // Next page.
        button = buttons.namedItem("nextPageButton") as HTMLButtonElement;
        expect(button).toBeDefined();
        expect(button.getAttribute("data-tooltip")).toBe("Next Page");
        expect(button.classList.contains("disabled")).toBe(false);
        button.click();
        button.click();
        expect(resultSets.sets[1].data.currentPage).toBe(2);

        // Apply.
        button = buttons.namedItem("applyButton") as HTMLButtonElement;
        expect(button).toBeDefined();
        expect(button.classList.contains("disabled")).toBe(true); // The button is currently disabled.
        expect(button.getAttribute("data-tooltip")).toBe("Apply Changes");

        // Revert.
        button = buttons.namedItem("revertButton") as HTMLButtonElement;
        expect(button).toBeDefined();
        expect(button.classList.contains("disabled")).toBe(true); // The button is currently disabled.
        expect(button.getAttribute("data-tooltip")).toBe("Revert Changes");

        // Maximize.
        button = buttons.namedItem("toggleStateButton") as HTMLButtonElement;
        expect(button).toBeDefined();
        expect(button.classList.contains("disabled")).toBe(false); // The button is not disabled, but does nothing yet.
        expect(button.getAttribute("data-tooltip")).toBe("Maximize Result Tab");

        // Menu.
        button = buttons.namedItem("showActionMenu") as HTMLButtonElement;
        expect(button).toBeDefined();
        expect(button.getAttribute("data-tooltip")).toBe("Show Action Menu");
        expect(button.classList.contains("disabled")).toBe(false);

        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        button.click();
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);
        expect(portals[0].id).toBe("actionMenu");

        const items = portals[0].getElementsByClassName("menuItem");
        expect(items).toHaveLength(2);

        // TODO: check for the success of the activations, once action handling is implemented.
        (items[0] as HTMLButtonElement).click();
        (items[1] as HTMLButtonElement).click();

        component.unmount();
    });
});
