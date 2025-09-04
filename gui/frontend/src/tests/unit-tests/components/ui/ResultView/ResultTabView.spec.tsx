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
import { describe, expect, it, vi } from "vitest";

import { MessageType } from "../../../../../app-logic/general-types.js";
import { IResultTabViewToggleOptions, ResultTabView } from "../../../../../components/ResultView/ResultTabView.js";
import { IResultSet, IResultSets } from "../../../../../script-execution/index.js";
import { createResultSet, nextProcessTick, nextRunLoop } from "../../../test-helpers.js";

const handleResultToggle = (_?: IResultSet) => { /**/ };
const toggleOptions: IResultTabViewToggleOptions = {
    showMaximizeButton: "never",
    handleResultToggle,
};

describe("Result Tabview Tests", (): void => {

    it("Standard Rendering", () => {
        const { container, unmount } = render(
            <ResultTabView
                resultSets={{
                    type: "resultSets",
                    sets: [],
                }}
                contextId="ec123"
                hideTabs="single"
                toggleOptions={toggleOptions}
            />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Rendering Only Output", () => {
        const { container, unmount } = render(
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
                toggleOptions={toggleOptions}
            />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Tabview With Result Sets", () => {
        const { container, unmount } = render(
            <ResultTabView
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [{
                        type: "resultSet",
                        sql: "select 1",
                        resultId: "123",
                        columns: [],
                        updatable: false,
                        fullTableName: "",
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
                        updatable: false,
                        fullTableName: "",
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
                toggleOptions={{
                    showMaximizeButton: "tab",
                    handleResultToggle,
                }}
            />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Update Data", async () => {
        const viewRef = createRef<ResultTabView>();
        const { container, unmount, rerender } = render(
            <ResultTabView
                ref={viewRef}
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [{
                        type: "resultSet",
                        sql: "select 1",
                        resultId: "123",
                        columns: [],
                        updatable: false,
                        fullTableName: "",
                        data: {
                            rows: [],
                            currentPage: 0,
                        },
                    }, {
                        type: "resultSet",
                        sql: "select 2",
                        resultId: "456",
                        columns: [],
                        updatable: false,
                        fullTableName: "",
                        data: {
                            rows: [],
                            currentPage: 10,
                        },
                    }],
                }}
                contextId="ec123"
                hideTabs="never"
                toggleOptions={{
                    showMaximizeButton: "statusBar",
                    handleResultToggle,
                }}

            />,
        );

        await nextRunLoop();
        expect(viewRef.current).toBeDefined();

        let tabs = container.getElementsByClassName("button") as HTMLCollectionOf<HTMLButtonElement>;
        expect(tabs).toHaveLength(2);

        let found = false;
        for (const tab of tabs) {
            if (tab.id === "123") {
                found = true;
                tab.click(); // Select the first as the current result set.
            }
        }

        expect(found).toBe(true);
        expect(viewRef.current!.state.currentResultSet).toBeDefined();
        expect(viewRef.current!.state.currentResultSet?.resultId).toBe("123");

        await viewRef.current!.updateColumns("123", []);

        // Add data with and w/o execution info.
        await viewRef.current!.addData({
            type: "resultSetRows",
            columns: [],
            rows: [],
            currentPage: 111,
        }, "123");

        let status = container.getElementsByClassName("resultStatus");
        expect(status).toHaveLength(0);

        await viewRef.current!.addData({
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
        status = container.getElementsByClassName("resultStatus");
        expect(status).toHaveLength(0);

        const onSelectTab = vi.fn();

        // Now update the component with data that has an executionInfo field to create a status.
        // We keep the original result set by intention, to keep it selected.
        // Also add output text to the set, while we are at it, to add an output tab to the set.
        rerender(<ResultTabView
            ref={viewRef}
            onSelectTab={onSelectTab}
            currentSet={1}
            resultSets={{
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
                    updatable: false,
                    fullTableName: "",
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
                    updatable: false,
                    fullTableName: "",
                    data: {
                        rows: [],
                        currentPage: 10,
                    },
                }],
            }}
            contextId="ec123"
            hideTabs="never"
            toggleOptions={{
                showMaximizeButton: "statusBar",
                handleResultToggle,
            }}

        />);
        await nextProcessTick();

        status = container.getElementsByClassName("resultStatus");
        expect(status).toHaveLength(1);

        // Check the output tab.
        tabs = container.getElementsByClassName("button") as HTMLCollectionOf<HTMLButtonElement>;
        expect(tabs).toHaveLength(3); // Like before, but now with the output tab.

        found = false;
        for (const tab of tabs) {
            if (tab.id === "output") {
                found = true;
                tab.click(); // Select the first as the current result set.
            }
        }
        expect(found).toBe(true);
        expect(onSelectTab).toHaveBeenCalledWith(0);

        unmount();
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
                updatable: false,
                fullTableName: "",
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
                updatable: false,
                fullTableName: "",
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

        const viewRef = createRef<ResultTabView>();
        const onResultPageChange = vi.fn();

        const { container, unmount, rerender } = render(
            <ResultTabView
                ref={viewRef}
                currentSet={1}
                resultSets={resultSets}
                contextId="ec123"
                hideTabs="single"
                toggleOptions={{
                    showMaximizeButton: "tab",
                    handleResultToggle,
                }}
                onResultPageChange={onResultPageChange}
            />,
        );

        await nextProcessTick();
        expect(viewRef.current).toBeDefined();

        // Select the second result set.
        const tabs = container.getElementsByClassName("button") as HTMLCollectionOf<HTMLButtonElement>;
        expect(tabs).toHaveLength(5);

        let found = false;
        for (const tab of tabs) {
            if (tab.id === "456") {
                found = true;
                tab.click();
            }
        }

        rerender(
            <ResultTabView
                ref={viewRef}
                currentSet={2}
                resultSets={resultSets}
                contextId="ec123"
                hideTabs="single"
                toggleOptions={{
                    showMaximizeButton: "tab",
                    handleResultToggle,
                }}
                onResultPageChange={onResultPageChange}
            />,
        );

        expect(found).toBe(true);
        expect(viewRef.current!.state.currentResultSet).toBeDefined();
        await nextRunLoop();

        const toolbars = container.getElementsByClassName("toolbar");
        expect(toolbars).toHaveLength(1);

        const buttons = container.getElementsByClassName("button");
        expect(buttons).toHaveLength(13);

        const dividers = container.getElementsByClassName("divider");
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
        viewRef.current!.forceUpdate();
        await nextRunLoop();

        expect(button.classList.contains("disabled")).toBe(true);
        expect(resultSets.sets[1].data.currentPage).toBe(0);
        expect(onResultPageChange).toHaveBeenCalledTimes(1);

        // Now at the first page. Cannot go further.
        button.click();
        expect(resultSets.sets[1].data.currentPage).toBe(0);
        expect(onResultPageChange).toHaveBeenCalledTimes(1);

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
        button = buttons.namedItem("rollbackButton") as HTMLButtonElement;
        expect(button).toBeDefined();
        expect(button.classList.contains("disabled")).toBe(true); // The button is currently disabled.
        expect(button.getAttribute("data-tooltip")).toBe("Rollback Changes");

        // Refresh.
        button = buttons.namedItem("refreshButton") as HTMLButtonElement;
        expect(button).toBeDefined();
        expect(button.classList.contains("disabled")).toBe(false);
        expect(button.getAttribute("data-tooltip")).toBe("Refresh");

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
        expect(items).toHaveLength(4);

        // TODO: check for the success of the activations, once action handling is implemented.
        (items[2] as HTMLButtonElement).click();
        (items[3] as HTMLButtonElement).click();

        unmount();
    });

    describe("Test getDerivedStateFromProps", () => {
        it("Removes currentResultSet when sets are empty", () => {
            // const newProps: IResultTabViewProperties = {};
            // const oldState: IResultTabViewState = {};
            const newState = ResultTabView.getDerivedStateFromProps({
                contextId: "",
                upperCaseKeywords: true,
                toggleOptions,
                hideTabs: "never",
                resultSets: {
                    type: "resultSets",
                    sets: [],
                },
            }, {});

            expect(newState.currentResultSet).toBeUndefined();
        });

        it("Removes currentResultSet when currentSet is undefined", () => {
            // const newProps: IResultTabViewProperties = {};
            // const oldState: IResultTabViewState = {};
            const newState = ResultTabView.getDerivedStateFromProps({
                contextId: "",
                upperCaseKeywords: true,
                toggleOptions,
                hideTabs: "never",
                resultSets: {
                    type: "resultSets",
                    sets: [],
                },
                currentSet: undefined,
            }, {});

            expect(newState.currentResultSet).toBeUndefined();
        });

        it("Sets currentResultSet from previously undefined", () => {
            const nextResultSet = createResultSet("123");
            const newState = ResultTabView.getDerivedStateFromProps({
                contextId: "",
                upperCaseKeywords: true,
                toggleOptions,
                hideTabs: "never",
                resultSets: {
                    type: "resultSets",
                    sets: [nextResultSet],
                },
                currentSet: 1,
            }, { currentResultSet: undefined });

            expect(newState.currentResultSet).toEqual(nextResultSet);
        });

        it("Keeps currentResultSet if it has not changed", () => {
            const resultSet = createResultSet("123");
            const newState = ResultTabView.getDerivedStateFromProps({
                contextId: "",
                upperCaseKeywords: true,
                toggleOptions,
                hideTabs: "never",
                resultSets: {
                    type: "resultSets",
                    sets: [resultSet, createResultSet("234")],
                },
                currentSet: 1,
            }, { currentResultSet: resultSet });

            expect(newState).toEqual({});
        });

        it("Changes currentResultSet to the nextResultSet according to currentSet index", () => {
            const currentResultSet = createResultSet("123");
            const nextResultSet = createResultSet("234");
            const newState = ResultTabView.getDerivedStateFromProps({
                contextId: "",
                upperCaseKeywords: true,
                toggleOptions,
                hideTabs: "never",
                resultSets: {
                    type: "resultSets",
                    sets: [currentResultSet, nextResultSet],
                },
                currentSet: 2,
            }, { currentResultSet });

            expect(newState.currentResultSet).toEqual(nextResultSet);
        });

        it("Selects last currentResultSet if currentSet index is out of bounds", () => {
            const currentResultSet = createResultSet("123");
            const lastResultSet = createResultSet("234");
            const newState = ResultTabView.getDerivedStateFromProps({
                contextId: "",
                upperCaseKeywords: true,
                toggleOptions,
                hideTabs: "never",
                resultSets: {
                    type: "resultSets",
                    sets: [currentResultSet, lastResultSet],
                },
                currentSet: 99,
            }, { currentResultSet });

            expect(newState.currentResultSet).toEqual(lastResultSet);
        });
    });
});
