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

import { fireEvent, render } from "@testing-library/preact";
import { createRef } from "preact";
import { describe, expect, it, vi } from "vitest";

import { DialogHost } from "../../../../../app-logic/DialogHost.js";
import { DBDataType, MessageType } from "../../../../../app-logic/general-types.js";
import { IResultTabViewToggleOptions, ResultTabView } from "../../../../../components/ResultView/ResultTabView.js";
import { defaultCellValue, isDefaultCellValue } from "../../../../../components/ResultView/ResultCellValue.js";
import { IResultSet, IResultSets } from "../../../../../script-execution/index.js";
import * as helpers from "../../../../../utilities/helpers.js";
import { createResultSet, nextProcessTick, nextRunLoop } from "../../../test-helpers.js";

const handleResultToggle = (_?: IResultSet) => { /**/ };
const toggleOptions: IResultTabViewToggleOptions = {
    showMaximizeButton: "never",
    handleResultToggle,
};

interface IResultTabViewInternals {
    editingInfo: Map<string, {
        rowChanges: Array<{
            changes: Array<{ field: string; value: unknown; }>;
            deleted: boolean;
            added: boolean;
            pkValues: unknown[];
        }>;
    }>;
    viewRefs: Map<string, {
        current?: {
            cancelCellEditingForDiscard?: () => void;
            editSelectedOrFirstCell?: () => void;
            finishCellEditingForCommit?: () => Promise<void>;
        } | null;
    }>;
    generateStatements: (info: {
        rowChanges: Array<{
            changes: Array<{ field: string; value: unknown; }>;
            deleted: boolean;
            added: boolean;
            pkValues: unknown[];
        }>;
        resultSet: IResultSet;
    }) => Array<[number, string]>;
    onAction: (action: string) => Promise<void>;
    onFieldEditStart: () => void;
    onFieldEditCancel: (row: number, field: string, restoredValue: unknown, restoreChange: boolean) => void;
    onFieldEdited: (row: number, field: string, newValue: unknown, previousValue: unknown) => Promise<void>;
    onToggleRowDeletionMarks: (rows: number[]) => void;
}

const decodeDataUriPayload = (source: string): string => {
    return decodeURIComponent(source.slice(source.indexOf(",") + 1));
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

    it("adds new rows with default markers", async () => {
        const resultSet: IResultSet = {
            type: "resultSet",
            sql: "select * from test",
            resultId: "defaults",
            columns: [{
                title: "id",
                field: "id",
                dataType: { type: DBDataType.Bigint },
                inPK: true,
                nullable: false,
                autoIncrement: true,
            }, {
                title: "name",
                field: "name",
                dataType: { type: DBDataType.Varchar },
                inPK: false,
                nullable: false,
                autoIncrement: false,
                default: "abc",
            }, {
                title: "note",
                field: "note",
                dataType: { type: DBDataType.Text, needsQuotes: true },
                inPK: false,
                nullable: true,
                autoIncrement: false,
            }],
            updatable: true,
            fullTableName: "test",
            data: {
                rows: [],
                currentPage: 0,
            },
        };

        const viewRef = createRef<ResultTabView>();
        const { unmount } = render(
            <ResultTabView
                ref={viewRef}
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [resultSet],
                }}
                contextId="ec123"
                hideTabs="single"
                toggleOptions={toggleOptions}
            />,
        );

        await nextRunLoop();
        const internals = viewRef.current! as unknown as IResultTabViewInternals;
        await internals.onAction("addNewRow");

        expect(resultSet.data.rows).toEqual([{ id: 0, name: "abc", note: null }]);

        const info = internals.editingInfo.get("defaults");
        expect(info).toBeDefined();
        expect(info!.rowChanges[0].changes).toHaveLength(3);
        expect(info!.rowChanges[0].changes.every((change) => {
            return isDefaultCellValue(change.value);
        })).toBe(true);
        expect(internals.generateStatements({ ...info!, resultSet })).toEqual([
            [0, "INSERT INTO test (id, name, note) VALUES (DEFAULT, DEFAULT, DEFAULT)"],
        ]);

        await internals.onFieldEdited(0, "name", "changed", "abc");
        await internals.onFieldEdited(0, "name", "changed", "abc");
        expect(info!.rowChanges[0].changes).toHaveLength(3);
        expect(info!.rowChanges[0].changes.find((change) => {
            return change.field === "name";
        })?.value).toBe("changed");
        expect(internals.generateStatements({ ...info!, resultSet })).toEqual([
            [0, "INSERT INTO test (id, name, note) VALUES (DEFAULT, 'changed', DEFAULT)"],
        ]);

        internals.onFieldEditCancel(0, "name", defaultCellValue, true);
        expect(info!.rowChanges[0].changes).toHaveLength(3);
        expect(info!.rowChanges[0].changes.find((change) => {
            return change.field === "name";
        })?.value).toBe(defaultCellValue);
        expect(internals.generateStatements({ ...info!, resultSet })).toEqual([
            [0, "INSERT INTO test (id, name, note) VALUES (DEFAULT, DEFAULT, DEFAULT)"],
        ]);

        unmount();
    });

    it("does not track an accepted unchanged date/time cell edit", async () => {
        const value = "2026-04-28T12:00";
        const resultSet: IResultSet = {
            type: "resultSet",
            sql: "select * from test",
            resultId: "datetime-noop",
            columns: [{
                title: "id",
                field: "id",
                dataType: { type: DBDataType.Bigint },
                inPK: true,
                nullable: false,
                autoIncrement: false,
            }, {
                title: "created",
                field: "created",
                dataType: { type: DBDataType.DateTime },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            }],
            updatable: true,
            fullTableName: "test",
            data: {
                rows: [{ id: 1, created: value }],
                currentPage: 0,
            },
        };

        const viewRef = createRef<ResultTabView>();
        const { unmount } = render(
            <ResultTabView
                ref={viewRef}
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [resultSet],
                }}
                contextId="ec123"
                hideTabs="single"
                toggleOptions={toggleOptions}
            />,
        );

        const internals = viewRef.current! as unknown as IResultTabViewInternals;
        internals.onFieldEditStart();
        expect(internals.editingInfo.has("datetime-noop")).toBe(true);

        await internals.onFieldEdited(0, "created", value, value);

        expect(internals.editingInfo.has("datetime-noop")).toBe(false);

        unmount();
    });

    it("keeps an existing date/time change when accepting its edited value unchanged", async () => {
        const originalValue = "2026-04-28T12:00";
        const editedValue = "2026-04-28T13:00";
        const resultSet: IResultSet = {
            type: "resultSet",
            sql: "select * from test",
            resultId: "datetime-existing-noop",
            columns: [{
                title: "id",
                field: "id",
                dataType: { type: DBDataType.Bigint },
                inPK: true,
                nullable: false,
                autoIncrement: false,
            }, {
                title: "created",
                field: "created",
                dataType: { type: DBDataType.DateTime },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            }],
            updatable: true,
            fullTableName: "test",
            data: {
                rows: [{ id: 1, created: originalValue }],
                currentPage: 0,
            },
        };

        const viewRef = createRef<ResultTabView>();
        const { unmount } = render(
            <ResultTabView
                ref={viewRef}
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [resultSet],
                }}
                contextId="ec123"
                hideTabs="single"
                toggleOptions={toggleOptions}
            />,
        );

        const internals = viewRef.current! as unknown as IResultTabViewInternals;
        await internals.onFieldEdited(0, "created", editedValue, originalValue);
        await internals.onFieldEdited(0, "created", editedValue, editedValue);

        const info = internals.editingInfo.get("datetime-existing-noop");
        expect(info).toBeDefined();
        expect(info!.rowChanges[0].changes).toEqual([{ field: "created", value: editedValue }]);

        unmount();
    });

    it("removes a canceled existing-row cell change from the preview", async () => {
        const resultSet: IResultSet = {
            type: "resultSet",
            sql: "select * from test",
            resultId: "cancel-existing",
            columns: [{
                title: "id",
                field: "id",
                dataType: { type: DBDataType.Bigint },
                inPK: true,
                nullable: false,
                autoIncrement: false,
            }, {
                title: "name",
                field: "name",
                dataType: { type: DBDataType.Varchar },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            }],
            updatable: true,
            fullTableName: "test",
            data: {
                rows: [{ id: 1, name: "old" }],
                currentPage: 0,
            },
        };

        const viewRef = createRef<ResultTabView>();
        const { unmount } = render(
            <ResultTabView
                ref={viewRef}
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [resultSet],
                }}
                contextId="ec123"
                hideTabs="single"
                toggleOptions={toggleOptions}
            />,
        );

        const internals = viewRef.current! as unknown as IResultTabViewInternals;
        await internals.onFieldEdited(0, "name", "changed", "old");
        const info = internals.editingInfo.get("cancel-existing");

        expect(info).toBeDefined();
        expect(internals.generateStatements({ ...info!, resultSet })).toEqual([
            [0, "UPDATE test SET name = 'changed' WHERE id = 1"],
        ]);

        internals.onFieldEditCancel(0, "name", undefined, false);

        expect(internals.editingInfo.has("cancel-existing")).toBe(false);

        unmount();
    });

    it("discards directly from the toolbar without confirmation", async () => {
        const resultSet: IResultSet = {
            type: "resultSet",
            sql: "select * from test",
            resultId: "discard-direct",
            columns: [{
                title: "id",
                field: "id",
                dataType: { type: DBDataType.Bigint },
                inPK: true,
                nullable: false,
                autoIncrement: false,
            }],
            updatable: true,
            fullTableName: "test",
            data: {
                rows: [],
                currentPage: 0,
                executionInfo: {
                    text: "All fine",
                },
            },
        };

        const calls: string[] = [];
        const onRollbackChanges = vi.fn(() => {
            calls.push("discard");
        });
        const showDialog = vi.spyOn(DialogHost, "showDialog");
        const viewRef = createRef<ResultTabView>();
        const { container, unmount } = render(
            <ResultTabView
                ref={viewRef}
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [resultSet],
                }}
                contextId="ec123"
                hideTabs="single"
                toggleOptions={toggleOptions}
                onRollbackChanges={onRollbackChanges}
            />,
        );

        const internals = viewRef.current! as unknown as IResultTabViewInternals;
        await internals.onAction("addNewRow");
        const cancelCellEditingForDiscard = vi.fn(() => {
            calls.push("cancel");
        });
        internals.viewRefs.set("discard-direct", {
            current: { cancelCellEditingForDiscard },
        });

        const button = container.querySelector("#rollbackButton")!;
        expect(button.classList.contains("disabled")).toBe(false);

        button.click();
        await nextRunLoop();

        expect(showDialog).not.toHaveBeenCalled();
        expect(cancelCellEditingForDiscard).toHaveBeenCalledOnce();
        expect(onRollbackChanges).toHaveBeenCalledWith(resultSet);
        expect(calls).toEqual(["cancel", "discard"]);
        expect(internals.editingInfo.has("discard-direct")).toBe(false);

        showDialog.mockRestore();
        unmount();
    });

    it("finishes the active editor before applying changes", async () => {
        const resultSet: IResultSet = {
            type: "resultSet",
            sql: "select * from test",
            resultId: "apply-active-editor",
            columns: [{
                title: "id",
                field: "id",
                dataType: { type: DBDataType.Bigint },
                inPK: true,
                nullable: false,
                autoIncrement: false,
            }],
            updatable: true,
            fullTableName: "test",
            data: {
                rows: [],
                currentPage: 0,
                executionInfo: {
                    text: "All fine",
                },
            },
        };

        const calls: string[] = [];
        let commitResolve: (() => void) | undefined;
        const commitPromise = new Promise<void>((resolve) => {
            commitResolve = resolve;
        });
        const onCommitChanges = vi.fn(async (_resultSet: IResultSet, _updateSql: string[]) => {
            calls.push("commit");
            commitResolve?.();

            return { affectedRows: 1, errors: [] };
        });
        const viewRef = createRef<ResultTabView>();
        const { container, unmount } = render(
            <ResultTabView
                ref={viewRef}
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [resultSet],
                }}
                contextId="ec123"
                hideTabs="single"
                toggleOptions={toggleOptions}
                onCommitChanges={onCommitChanges}
            />,
        );

        const internals = viewRef.current! as unknown as IResultTabViewInternals;
        await internals.onAction("addNewRow");
        const finishCellEditingForCommit = vi.fn(async () => {
            calls.push("finish");
            await internals.onFieldEdited(0, "id", 9, undefined);
        });
        internals.viewRefs.set("apply-active-editor", {
            current: { finishCellEditingForCommit },
        });

        const button = container.querySelector("#applyButton")!;
        expect(button.classList.contains("disabled")).toBe(false);

        button.click();
        await commitPromise;

        expect(finishCellEditingForCommit).toHaveBeenCalledOnce();
        expect(onCommitChanges).toHaveBeenCalledWith(resultSet, [
            "INSERT INTO test (id) VALUES (9)",
        ]);
        expect(calls).toEqual(["finish", "commit"]);

        unmount();
    });

    it("starts editing from toolbar keyboard activation", async () => {
        const resultSet: IResultSet = {
            type: "resultSet",
            sql: "select * from test",
            resultId: "keyboard-edit",
            columns: [{
                title: "id",
                field: "id",
                dataType: { type: DBDataType.Bigint },
                inPK: true,
                nullable: false,
                autoIncrement: false,
            }],
            updatable: true,
            fullTableName: "test",
            data: {
                rows: [{ id: 1 }],
                currentPage: 0,
                executionInfo: {
                    text: "All fine",
                },
            },
        };

        const viewRef = createRef<ResultTabView>();
        const { container, unmount } = render(
            <ResultTabView
                ref={viewRef}
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [resultSet],
                }}
                contextId="ec123"
                hideTabs="single"
                toggleOptions={toggleOptions}
            />,
        );

        const editSelectedOrFirstCell = vi.fn();
        const internals = viewRef.current! as unknown as IResultTabViewInternals;
        internals.viewRefs.set("keyboard-edit", {
            current: { editSelectedOrFirstCell },
        });

        const button = container.querySelector("#editButton")!;
        button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        await nextRunLoop();

        expect(editSelectedOrFirstCell).toHaveBeenCalledOnce();
        expect(internals.editingInfo.has("keyboard-edit")).toBe(true);

        unmount();
    });

    it("renders image result sets without grid controls", () => {
        const { container, unmount } = render(
            <ResultTabView
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [{
                        type: "resultSet",
                        sql: "select 1",
                        resultId: "image-result",
                        columns: [],
                        updatable: false,
                        fullTableName: "",
                        viewType: "image",
                        image: {
                            mimeType: "image/svg+xml",
                            data: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\" />",
                            caption: "Visual Explain",
                        },
                        caption: "Visual Explain",
                        data: {
                            rows: [],
                            currentPage: 0,
                            hasMoreRows: false,
                            executionInfo: {
                                text: "OK, visual explain generated",
                            },
                        },
                    }],
                }}
                contextId="ec123"
                hideTabs="never"
                toggleOptions={toggleOptions}
            />,
        );

        expect(container.querySelector(".imageResultViewImage")).toBeTruthy();
        expect(container.querySelector("#viewStyleDropDown")).toBeFalsy();
        expect(container.textContent).toContain("Visual Explain");

        unmount();
    });

    it("scrolls image result sets to the right when requested", () => {
        const { container, unmount } = render(
            <ResultTabView
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [{
                        type: "resultSet",
                        sql: "select 1",
                        resultId: "image-result",
                        columns: [],
                        updatable: false,
                        fullTableName: "",
                        viewType: "image",
                        image: {
                            mimeType: "image/svg+xml",
                            data: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"10\" />",
                            caption: "Visual Explain",
                            scrollToRight: true,
                        },
                        caption: "Visual Explain",
                        data: {
                            rows: [],
                            currentPage: 0,
                            hasMoreRows: false,
                        },
                    }],
                }}
                contextId="ec123"
                hideTabs="never"
                toggleOptions={toggleOptions}
            />,
        );

        const imageResultView = container.querySelector(".imageResultView") as HTMLDivElement;
        Object.defineProperty(imageResultView, "scrollWidth", { configurable: true, value: 1000 });
        Object.defineProperty(imageResultView, "clientWidth", { configurable: true, value: 250 });

        fireEvent.load(container.querySelector(".imageResultViewImage")!);

        expect(imageResultView.scrollLeft).toBe(750);

        unmount();
    });

    it("shows the image minimap when the rendered image fits in the display area", async () => {
        const { container, unmount } = render(
            <ResultTabView
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [{
                        type: "resultSet",
                        sql: "select 1",
                        resultId: "image-result",
                        columns: [],
                        updatable: false,
                        fullTableName: "",
                        viewType: "image",
                        image: {
                            mimeType: "image/svg+xml",
                            data: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"320\" height=\"240\" />",
                            caption: "Visual Explain",
                        },
                        caption: "Visual Explain",
                        data: {
                            rows: [],
                            currentPage: 0,
                            hasMoreRows: false,
                        },
                    }],
                }}
                contextId="ec123"
                hideTabs="never"
                toggleOptions={toggleOptions}
            />,
        );

        const imageResultView = container.querySelector(".imageResultView") as HTMLDivElement;
        const image = container.querySelector(".imageResultViewImage") as HTMLImageElement;
        Object.defineProperty(imageResultView, "scrollWidth", { configurable: true, value: 500 });
        Object.defineProperty(imageResultView, "scrollHeight", { configurable: true, value: 300 });
        Object.defineProperty(imageResultView, "clientWidth", { configurable: true, value: 500 });
        Object.defineProperty(imageResultView, "clientHeight", { configurable: true, value: 300 });
        Object.defineProperty(image, "naturalWidth", { configurable: true, value: 320 });
        Object.defineProperty(image, "naturalHeight", { configurable: true, value: 240 });

        fireEvent.load(image);
        await nextRunLoop();

        const minimap = container.querySelector(".imageResultViewMinimap") as HTMLDivElement;
        const viewport = container.querySelector(".imageResultViewMinimapViewport") as HTMLDivElement;
        expect(minimap).toBeTruthy();
        expect(viewport.style.width).toBe(minimap.style.width);
        expect(viewport.style.height).toBe(minimap.style.height);

        unmount();
    });

    it("keeps the minimap on the left with the viewport at the right when image results scroll right", async () => {
        const { container, unmount } = render(
            <ResultTabView
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [{
                        type: "resultSet",
                        sql: "select 1",
                        resultId: "image-result",
                        columns: [],
                        updatable: false,
                        fullTableName: "",
                        viewType: "image",
                        image: {
                            mimeType: "image/svg+xml",
                            data: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"400\" />",
                            caption: "Visual Explain",
                            scrollToRight: true,
                        },
                        caption: "Visual Explain",
                        data: {
                            rows: [],
                            currentPage: 0,
                            hasMoreRows: false,
                        },
                    }],
                }}
                contextId="ec123"
                hideTabs="never"
                toggleOptions={toggleOptions}
            />,
        );

        const imageResultView = container.querySelector(".imageResultView") as HTMLDivElement;
        const image = container.querySelector(".imageResultViewImage") as HTMLImageElement;
        Object.defineProperty(imageResultView, "scrollWidth", { configurable: true, value: 1000 });
        Object.defineProperty(imageResultView, "scrollHeight", { configurable: true, value: 400 });
        Object.defineProperty(imageResultView, "clientWidth", { configurable: true, value: 250 });
        Object.defineProperty(imageResultView, "clientHeight", { configurable: true, value: 200 });
        Object.defineProperty(image, "naturalWidth", { configurable: true, value: 1000 });
        Object.defineProperty(image, "naturalHeight", { configurable: true, value: 400 });

        fireEvent.load(image);
        await nextRunLoop();

        const minimap = container.querySelector(".imageResultViewMinimap") as HTMLDivElement;
        const viewport = container.querySelector(".imageResultViewMinimapViewport") as HTMLDivElement;
        expect(imageResultView.scrollLeft).toBe(750);
        expect(minimap.style.left).toBe("762px");
        expect(Number.parseFloat(minimap.style.left) - imageResultView.scrollLeft).toBe(12);
        expect(viewport.style.left).toBe("165px");

        unmount();
    });

    it("uses the image minimap to select the visible viewport", async () => {
        const { container, unmount } = render(
            <ResultTabView
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [{
                        type: "resultSet",
                        sql: "select 1",
                        resultId: "image-result",
                        columns: [],
                        updatable: false,
                        fullTableName: "",
                        viewType: "image",
                        image: {
                            mimeType: "image/svg+xml",
                            data: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"400\" />",
                            caption: "Visual Explain",
                        },
                        caption: "Visual Explain",
                        data: {
                            rows: [],
                            currentPage: 0,
                            hasMoreRows: false,
                        },
                    }],
                }}
                contextId="ec123"
                hideTabs="never"
                toggleOptions={toggleOptions}
            />,
        );

        const imageResultView = container.querySelector(".imageResultView") as HTMLDivElement;
        const image = container.querySelector(".imageResultViewImage") as HTMLImageElement;
        Object.defineProperty(imageResultView, "scrollWidth", { configurable: true, value: 1000 });
        Object.defineProperty(imageResultView, "scrollHeight", { configurable: true, value: 400 });
        Object.defineProperty(imageResultView, "clientWidth", { configurable: true, value: 250 });
        Object.defineProperty(imageResultView, "clientHeight", { configurable: true, value: 200 });
        Object.defineProperty(image, "naturalWidth", { configurable: true, value: 1000 });
        Object.defineProperty(image, "naturalHeight", { configurable: true, value: 400 });

        fireEvent.load(image);
        await nextRunLoop();

        const minimap = container.querySelector(".imageResultViewMinimap") as HTMLDivElement;
        expect(minimap).toBeTruthy();
        Object.defineProperty(minimap, "getBoundingClientRect", {
            configurable: true,
            value: () => {
                return {
                    left: 0,
                    top: 0,
                    right: 220,
                    bottom: 88,
                    width: 220,
                    height: 88,
                    x: 0,
                    y: 0,
                    toJSON: () => { /**/ },
                };
            },
        });

        fireEvent.mouseDown(minimap, { clientX: 110, clientY: 44 });
        fireEvent.mouseUp(document, { clientX: 110, clientY: 44 });

        expect(imageResultView.scrollLeft).toBe(375);
        expect(imageResultView.scrollTop).toBe(100);

        unmount();
    });

    it("colors the visual explain minimap by estimated cost", async () => {
        const { container, unmount } = render(
            <ResultTabView
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [{
                        type: "resultSet",
                        sql: "select 1",
                        resultId: "image-result",
                        columns: [],
                        updatable: false,
                        fullTableName: "",
                        viewType: "image",
                        image: {
                            mimeType: "image/svg+xml",
                            data: `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="400">
                                <g data-estimated_total_cost="0.25"><rect class="box_body" width="100" height="50" /></g>
                                <g data-estimated_total_cost="100" data-operation="Index lookup on actor using idx_actor_last_name" data-table_name="sakila.actor" data-index_name="idx_actor_last_name" data-access_type="index">
                                    <rect class="box_body" width="100" height="50" />
                                </g>
                            </svg>`,
                            caption: "Visual Explain",
                        },
                        caption: "Visual Explain",
                        data: {
                            rows: [],
                            currentPage: 0,
                            hasMoreRows: false,
                        },
                    }],
                }}
                contextId="ec123"
                hideTabs="never"
                toggleOptions={toggleOptions}
            />,
        );

        const imageResultView = container.querySelector(".imageResultView") as HTMLDivElement;
        const image = container.querySelector(".imageResultViewImage") as HTMLImageElement;
        Object.defineProperty(imageResultView, "scrollWidth", { configurable: true, value: 1000 });
        Object.defineProperty(imageResultView, "scrollHeight", { configurable: true, value: 400 });
        Object.defineProperty(imageResultView, "clientWidth", { configurable: true, value: 250 });
        Object.defineProperty(imageResultView, "clientHeight", { configurable: true, value: 200 });
        Object.defineProperty(image, "naturalWidth", { configurable: true, value: 1000 });
        Object.defineProperty(image, "naturalHeight", { configurable: true, value: 400 });

        fireEvent.load(image);
        await nextRunLoop();

        const minimapImage = container.querySelector(".imageResultViewMinimapImage") as HTMLImageElement;
        const minimapSvg = decodeDataUriPayload(minimapImage.getAttribute("src")!);
        expect(minimapSvg).toContain("data-estimated_total_cost=\"0.25\"");
        expect(minimapSvg).toContain("data-estimated_total_cost=\"100\"");
        expect(minimapSvg).toContain("fill=\"#2dc937\"");
        expect(minimapSvg).toContain("fill=\"#641220\"");
        expect(minimapSvg).not.toContain("fill=\"#f0f0f0\"");
        expect(minimapSvg).not.toContain("<title>");
        expect(minimapSvg).not.toContain("data-color_for_cost");
        const gradient = container.querySelector(".imageResultViewMinimapHeatmapGradient") as HTMLDivElement;
        expect(gradient).toBeTruthy();
        expect(gradient.style.background).toContain("#2dc937");
        expect(gradient.style.background).toContain("#641220");
        const annotatedNode = container.querySelector(
            ".imageResultViewSvg [data-estimated_total_cost=\"100\"]",
        ) as SVGGElement;
        expect(annotatedNode.getAttribute("data-tooltip")).toBe(
            "Index lookup on actor using idx_actor_last_name\n\n"
            + "Estimated Total Cost: 100\nAccess Type: index\nTable Name: sakila.actor\nIndex Name: idx_actor_last_name",
        );
        expect(annotatedNode.querySelector("rect")?.getAttribute("data-tooltip")).toBe("inherit");
        const legend = container.querySelector(".imageResultViewMinimapHeatmapLegend") as HTMLDivElement;
        expect(legend.firstElementChild?.classList.contains("imageResultViewMinimapHeatmapCaption")).toBe(true);
        expect(legend.firstElementChild?.textContent).toBe("Total est. cost");
        const labels = container.querySelector(".imageResultViewMinimapHeatmapLabels") as HTMLDivElement;
        expect(labels.textContent).toBe("0100");

        unmount();
    });

    it("drags the image minimap inside the image result view", async () => {
        const { container, unmount } = render(
            <ResultTabView
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [{
                        type: "resultSet",
                        sql: "select 1",
                        resultId: "image-result",
                        columns: [],
                        updatable: false,
                        fullTableName: "",
                        viewType: "image",
                        image: {
                            mimeType: "image/svg+xml",
                            data: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"400\" />",
                            caption: "Visual Explain",
                        },
                        caption: "Visual Explain",
                        data: {
                            rows: [],
                            currentPage: 0,
                            hasMoreRows: false,
                        },
                    }],
                }}
                contextId="ec123"
                hideTabs="never"
                toggleOptions={toggleOptions}
            />,
        );

        const imageResultView = container.querySelector(".imageResultView") as HTMLDivElement;
        const image = container.querySelector(".imageResultViewImage") as HTMLImageElement;
        Object.defineProperty(imageResultView, "scrollWidth", { configurable: true, value: 1000 });
        Object.defineProperty(imageResultView, "scrollHeight", { configurable: true, value: 400 });
        Object.defineProperty(imageResultView, "clientWidth", { configurable: true, value: 500 });
        Object.defineProperty(imageResultView, "clientHeight", { configurable: true, value: 300 });
        Object.defineProperty(image, "naturalWidth", { configurable: true, value: 1000 });
        Object.defineProperty(image, "naturalHeight", { configurable: true, value: 400 });

        fireEvent.load(image);
        await nextRunLoop();

        const minimap = container.querySelector(".imageResultViewMinimap") as HTMLDivElement;
        expect(minimap.style.left).toBe("12px");
        expect(minimap.style.top).toBe("12px");

        fireEvent.mouseDown(minimap, { clientX: 100, clientY: 50 });
        fireEvent.mouseMove(document, { clientX: 200, clientY: 100 });
        await nextRunLoop();
        fireEvent.mouseUp(document, { clientX: 200, clientY: 100 });

        expect(minimap.style.left).toBe("112px");
        expect(minimap.style.top).toBe("62px");

        unmount();
    });

    it("pans the image result viewport by dragging the display area", async () => {
        const { container, unmount } = render(
            <ResultTabView
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [{
                        type: "resultSet",
                        sql: "select 1",
                        resultId: "image-result",
                        columns: [],
                        updatable: false,
                        fullTableName: "",
                        viewType: "image",
                        image: {
                            mimeType: "image/svg+xml",
                            data: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"400\" />",
                            caption: "Visual Explain",
                        },
                        caption: "Visual Explain",
                        data: {
                            rows: [],
                            currentPage: 0,
                            hasMoreRows: false,
                        },
                    }],
                }}
                contextId="ec123"
                hideTabs="never"
                toggleOptions={toggleOptions}
            />,
        );

        const imageResultView = container.querySelector(".imageResultView") as HTMLDivElement;
        const image = container.querySelector(".imageResultViewImage") as HTMLImageElement;
        Object.defineProperty(imageResultView, "scrollWidth", { configurable: true, value: 1000 });
        Object.defineProperty(imageResultView, "scrollHeight", { configurable: true, value: 400 });
        Object.defineProperty(imageResultView, "clientWidth", { configurable: true, value: 500 });
        Object.defineProperty(imageResultView, "clientHeight", { configurable: true, value: 200 });
        Object.defineProperty(image, "naturalWidth", { configurable: true, value: 1000 });
        Object.defineProperty(image, "naturalHeight", { configurable: true, value: 400 });

        fireEvent.load(image);
        await nextRunLoop();

        imageResultView.scrollLeft = 300;
        imageResultView.scrollTop = 80;
        fireEvent.mouseDown(imageResultView, { clientX: 100, clientY: 100 });
        fireEvent.mouseMove(document, { clientX: 40, clientY: 70 });
        await nextRunLoop();
        fireEvent.mouseUp(document, { clientX: 40, clientY: 70 });

        expect(imageResultView.scrollLeft).toBe(360);
        expect(imageResultView.scrollTop).toBe(110);

        unmount();
    });

    it("toggles the image minimap from the action menu", async () => {
        const onImageResultOptionsChange = vi.fn().mockResolvedValue(undefined);
        const resultSet: IResultSet = {
            type: "resultSet",
            sql: "select 1",
            resultId: "image-result",
            columns: [],
            updatable: false,
            fullTableName: "",
            viewType: "image",
            image: {
                mimeType: "image/svg+xml",
                data: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"400\" />",
                caption: "Visual Explain",
            },
            caption: "Visual Explain",
            data: {
                rows: [],
                currentPage: 0,
                hasMoreRows: false,
                executionInfo: {
                    text: "OK, visual explain generated",
                },
            },
        };
        const { container, unmount } = render(
            <ResultTabView
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [resultSet],
                }}
                contextId="ec123"
                hideTabs="never"
                toggleOptions={toggleOptions}
                onImageResultOptionsChange={onImageResultOptionsChange}
            />,
        );

        const imageResultView = container.querySelector(".imageResultView") as HTMLDivElement;
        const image = container.querySelector(".imageResultViewImage") as HTMLImageElement;
        Object.defineProperty(imageResultView, "scrollWidth", { configurable: true, value: 1000 });
        Object.defineProperty(imageResultView, "scrollHeight", { configurable: true, value: 400 });
        Object.defineProperty(imageResultView, "clientWidth", { configurable: true, value: 500 });
        Object.defineProperty(imageResultView, "clientHeight", { configurable: true, value: 300 });
        Object.defineProperty(image, "naturalWidth", { configurable: true, value: 1000 });
        Object.defineProperty(image, "naturalHeight", { configurable: true, value: 400 });

        fireEvent.load(image);
        await nextRunLoop();

        const toggleMinimapFromMenu = async (): Promise<void> => {
            fireEvent.click(container.querySelector("#showActionMenu")!);
            await nextProcessTick();

            const toggleMinimapMenuItem = document.getElementById("toggleMinimapMenuItem")!;
            expect(toggleMinimapMenuItem.textContent).toContain("Show Minimap");
            fireEvent.click(toggleMinimapMenuItem);
            await nextProcessTick();
            await nextRunLoop();
        };

        expect(container.querySelector(".imageResultViewMinimap")).toBeTruthy();
        expect(container.querySelector("#visualExplainMinimapButton")).toBeNull();

        await toggleMinimapFromMenu();

        expect(container.querySelector(".imageResultViewMinimap")).toBeFalsy();
        expect(resultSet.image?.showMinimap).toBe(false);
        expect(onImageResultOptionsChange).not.toHaveBeenCalled();

        await toggleMinimapFromMenu();

        expect(container.querySelector(".imageResultViewMinimap")).toBeTruthy();
        expect(resultSet.image?.showMinimap).toBe(true);
        expect(onImageResultOptionsChange).not.toHaveBeenCalled();

        unmount();
    });

    it("zooms visual explain image results from the bottom toolbar", async () => {
        const resultSet: IResultSet = {
            type: "resultSet",
            sql: "select 1",
            resultId: "image-result",
            columns: [],
            updatable: false,
            fullTableName: "",
            viewType: "image",
            image: {
                mimeType: "image/svg+xml",
                data: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"400\" />",
                caption: "Visual Explain",
            },
            caption: "Visual Explain",
            data: {
                rows: [],
                currentPage: 0,
                hasMoreRows: false,
                executionInfo: {
                    text: "OK, visual explain generated",
                },
            },
        };
        const { container, unmount } = render(
            <ResultTabView
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [resultSet],
                }}
                contextId="ec123"
                hideTabs="never"
                toggleOptions={toggleOptions}
            />,
        );

        const imageResultView = container.querySelector(".imageResultView") as HTMLDivElement;
        const image = container.querySelector(".imageResultViewImage") as HTMLImageElement;
        const zoomOutButton = container.querySelector("#visualExplainZoomOutButton") as HTMLButtonElement;
        const resetZoomButton = container.querySelector("#visualExplainResetZoomButton") as HTMLButtonElement;
        const zoomInButton = container.querySelector("#visualExplainZoomInButton") as HTMLButtonElement;
        Object.defineProperty(imageResultView, "scrollWidth", { configurable: true, value: 1000 });
        Object.defineProperty(imageResultView, "scrollHeight", { configurable: true, value: 400 });
        Object.defineProperty(imageResultView, "clientWidth", { configurable: true, value: 500 });
        Object.defineProperty(imageResultView, "clientHeight", { configurable: true, value: 300 });
        Object.defineProperty(image, "naturalWidth", { configurable: true, value: 1000 });
        Object.defineProperty(image, "naturalHeight", { configurable: true, value: 400 });

        fireEvent.load(image);
        await nextRunLoop();

        expect(zoomOutButton.getAttribute("data-tooltip")).toBe("Zoom Out");
        expect(resetZoomButton.getAttribute("data-tooltip")).toBe("Reset Zoom");
        expect(zoomInButton.getAttribute("data-tooltip")).toBe("Zoom In");
        expect(zoomOutButton.classList.contains("disabled")).toBe(false);
        expect(resetZoomButton.classList.contains("disabled")).toBe(true);
        expect(zoomInButton.classList.contains("disabled")).toBe(false);
        expect((container.querySelector(".imageResultViewMinimapViewport") as HTMLDivElement).style.width).toBe("110px");

        fireEvent.click(zoomInButton);
        await nextRunLoop();

        expect(resultSet.image?.zoom).toBe(1.25);
        expect(resetZoomButton.classList.contains("disabled")).toBe(false);
        expect((container.querySelector(".imageResultViewMinimapViewport") as HTMLDivElement).style.width).toBe("88px");

        fireEvent.click(resetZoomButton);
        await nextRunLoop();

        expect(resultSet.image?.zoom).toBe(1);
        expect(resetZoomButton.classList.contains("disabled")).toBe(true);
        expect((container.querySelector(".imageResultViewMinimapViewport") as HTMLDivElement).style.width).toBe("110px");

        resultSet.image!.zoom = 0.25;
        fireEvent.click(zoomOutButton);
        await nextRunLoop();

        expect(resultSet.image?.zoom).toBe(0.25);
        expect(zoomOutButton.classList.contains("disabled")).toBe(true);

        unmount();
    });

    it("toggles visual explain image options from the bottom toolbar", () => {
        const onImageResultOptionsChange = vi.fn().mockResolvedValue(undefined);
        const resultSet: IResultSet = {
            type: "resultSet",
            sql: "select 1",
            resultId: "image-result",
            columns: [],
            updatable: false,
            fullTableName: "",
            viewType: "image",
            image: {
                mimeType: "image/svg+xml",
                data: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\" />",
                caption: "Visual Explain",
                scrollToRight: true,
            },
            caption: "Visual Explain",
            data: {
                rows: [],
                currentPage: 0,
                hasMoreRows: false,
                executionInfo: {
                    text: "OK, visual explain generated",
                },
            },
        };

        const { container, unmount } = render(
            <ResultTabView
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [resultSet],
                }}
                contextId="ec123"
                hideTabs="never"
                toggleOptions={toggleOptions}
                onImageResultOptionsChange={onImageResultOptionsChange}
            />,
        );

        const topDownButton = container.querySelector("#visualExplainLayoutTopDownButton")!;
        const bottomUpButton = container.querySelector("#visualExplainLayoutBottomUpButton")!;
        const minimalButton = container.querySelector("#visualExplainDetailsMinimalButton")!;
        const mediumButton = container.querySelector("#visualExplainDetailsMediumButton")!;
        const fullButton = container.querySelector("#visualExplainDetailsFullButton")!;

        expect(topDownButton.classList.contains("active")).toBe(false);
        expect(bottomUpButton.classList.contains("active")).toBe(true);
        expect(topDownButton.getAttribute("aria-checked")).toBe("false");
        expect(bottomUpButton.getAttribute("aria-checked")).toBe("true");
        expect(container.querySelector("#visualExplainCompactButton")).toBeNull();
        expect(container.querySelector("#visualExplainDescriptionButton")).toBeNull();
        expect(minimalButton.classList.contains("active")).toBe(false);
        expect(mediumButton.classList.contains("active")).toBe(true);
        expect(fullButton.classList.contains("active")).toBe(false);
        expect(minimalButton.getAttribute("aria-checked")).toBe("false");
        expect(mediumButton.getAttribute("aria-checked")).toBe("true");
        expect(fullButton.getAttribute("aria-checked")).toBe("false");

        fireEvent.click(topDownButton);
        expect(onImageResultOptionsChange).toHaveBeenCalledWith(resultSet, {
            analyze: false,
            compact: false,
            darkMode: false,
            layout: "topDown",
            showQuery: false,
            showDescription: false,
            topDown: true,
        });

        fireEvent.click(bottomUpButton);
        expect(onImageResultOptionsChange).toHaveBeenCalledWith(resultSet, {
            analyze: false,
            compact: false,
            darkMode: false,
            layout: "bottomUp",
            showQuery: false,
            showDescription: false,
            topDown: false,
        });

        fireEvent.click(minimalButton);
        expect(onImageResultOptionsChange).toHaveBeenCalledWith(resultSet, {
            analyze: false,
            compact: true,
            darkMode: false,
            layout: "bottomUp",
            showQuery: false,
            showDescription: false,
            topDown: false,
        });

        fireEvent.click(mediumButton);
        expect(onImageResultOptionsChange).toHaveBeenCalledWith(resultSet, {
            analyze: false,
            compact: false,
            darkMode: false,
            layout: "bottomUp",
            showQuery: false,
            showDescription: false,
            topDown: false,
        });

        fireEvent.click(fullButton);
        expect(onImageResultOptionsChange).toHaveBeenCalledWith(resultSet, {
            analyze: false,
            compact: false,
            darkMode: false,
            layout: "bottomUp",
            showQuery: false,
            showDescription: true,
            topDown: false,
        });

        unmount();
    });

    it("toggles visual explain minimap from the action menu", async () => {
        const resultSet: IResultSet = {
            type: "resultSet",
            sql: "select 1",
            resultId: "image-result",
            columns: [],
            updatable: false,
            fullTableName: "",
            viewType: "image",
            image: {
                mimeType: "image/svg+xml",
                data: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\" />",
                caption: "Visual Explain",
                visualExplainOptions: {
                    analyze: false,
                    compact: false,
                    darkMode: false,
                    layout: "bottomUp",
                    showQuery: false,
                    showDescription: true,
                    topDown: false,
                },
            },
            caption: "Visual Explain",
            data: {
                rows: [],
                currentPage: 0,
                hasMoreRows: false,
                executionInfo: {
                    text: "OK, visual explain generated",
                },
            },
        };

        const { container, unmount } = render(
            <ResultTabView
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [resultSet],
                }}
                contextId="ec123"
                hideTabs="never"
                toggleOptions={toggleOptions}
            />,
        );

        fireEvent.click(container.querySelector("#showActionMenu")!);
        await nextProcessTick();

        const toggleMinimapMenuItem = document.getElementById("toggleMinimapMenuItem")!;
        fireEvent.click(toggleMinimapMenuItem);

        expect(resultSet.image?.showMinimap).toBe(false);

        unmount();
    });

    it("saves visual explain image from the action menu", async () => {
        const saveBlobAsFileSpy = vi.spyOn(helpers, "saveBlobAsFile").mockImplementation(() => {
            // Prevent the test from creating a browser download link.
        });
        const resultSet: IResultSet = {
            type: "resultSet",
            sql: "select 1",
            resultId: "image-result",
            columns: [],
            updatable: false,
            fullTableName: "",
            viewType: "image",
            image: {
                mimeType: "image/svg+xml",
                data: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\" />",
                caption: "Visual Explain",
            },
            caption: "Visual Explain",
            data: {
                rows: [],
                currentPage: 0,
                hasMoreRows: false,
                executionInfo: {
                    text: "OK, visual explain generated",
                },
            },
        };

        const { container, unmount } = render(
            <ResultTabView
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [resultSet],
                }}
                contextId="ec123"
                hideTabs="never"
                toggleOptions={toggleOptions}
            />,
        );

        expect(container.querySelector("#visualExplainSaveImageButton")).toBeNull();

        fireEvent.click(container.querySelector("#showActionMenu")!);
        await nextProcessTick();

        const items = document.getElementsByClassName("menuItem");
        expect(items).toHaveLength(5);
        expect(document.getElementById("toggleMinimapMenuItem")?.textContent).toContain("Show Minimap");
        expect(document.getElementById("saveImageMenuItem")?.textContent).toContain("Save Image...");
        expect(document.getElementById("saveImageMenuItem")?.classList.contains("disabled")).toBe(false);

        fireEvent.click(document.getElementById("saveImageMenuItem")!);
        await nextProcessTick();

        expect(saveBlobAsFileSpy).toHaveBeenCalledTimes(1);
        expect(saveBlobAsFileSpy.mock.calls[0][0]).toBeInstanceOf(Blob);
        expect(saveBlobAsFileSpy.mock.calls[0][0].type).toBe("image/svg+xml");
        expect(saveBlobAsFileSpy.mock.calls[0][1]).toBe("visual-explain.svg");

        saveBlobAsFileSpy.mockRestore();
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
        expect(tabs).toHaveLength(3);

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
        expect(buttons).toHaveLength(12);

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
        expect(button.getAttribute("data-tooltip")).toBe("Discard Changes");

        // Refresh.
        button = buttons.namedItem("refreshButton") as HTMLButtonElement;
        expect(button).toBeDefined();
        expect(button.classList.contains("disabled")).toBe(false);
        expect(button.getAttribute("data-tooltip")).toBe("Refresh");

        expect(buttons.namedItem("toggleStateButton")).toBeNull();

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

    it("uses radio button behavior for the view selector", async () => {
        const resultSets: IResultSets = {
            type: "resultSets",
            sets: [{
                type: "resultSet",
                sql: "select 1",
                resultId: "123",
                columns: [],
                updatable: true,
                fullTableName: "",
                data: {
                    rows: [],
                    currentPage: 0,
                    hasMoreRows: false,
                    executionInfo: {
                        text: "All fine",
                    },
                },
            }],
        };

        const { container, unmount } = render(
            <ResultTabView
                currentSet={1}
                resultSets={resultSets}
                contextId="ec123"
                hideTabs="single"
                toggleOptions={toggleOptions}
            />,
        );

        const buttons = container.getElementsByClassName("button") as HTMLCollectionOf<HTMLButtonElement>;
        const editButton = buttons.namedItem("editButton")!;
        editButton.click();
        await nextRunLoop();

        const gridButton = buttons.namedItem("viewGridButton")!;
        const previewButton = buttons.namedItem("viewPreviewButton")!;
        expect(gridButton.getAttribute("aria-checked")).toBe("true");
        expect(gridButton.classList.contains("selected")).toBe(true);
        expect(gridButton.tabIndex).toBe(0);
        expect(previewButton.getAttribute("aria-checked")).toBe("false");
        expect(previewButton.classList.contains("selected")).toBe(false);
        expect(previewButton.classList.contains("disabled")).toBe(false);
        expect(previewButton.tabIndex).toBe(-1);

        gridButton.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
        await nextRunLoop();

        expect(gridButton.getAttribute("aria-checked")).toBe("false");
        expect(gridButton.classList.contains("selected")).toBe(false);
        expect(gridButton.tabIndex).toBe(-1);
        expect(previewButton.getAttribute("aria-checked")).toBe("true");
        expect(previewButton.classList.contains("selected")).toBe(true);
        expect(previewButton.tabIndex).toBe(0);

        previewButton.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
        await nextRunLoop();

        expect(gridButton.getAttribute("aria-checked")).toBe("true");
        expect(gridButton.classList.contains("selected")).toBe(true);
        expect(gridButton.tabIndex).toBe(0);
        expect(previewButton.getAttribute("aria-checked")).toBe("false");
        expect(previewButton.classList.contains("selected")).toBe(false);
        expect(previewButton.tabIndex).toBe(-1);

        unmount();
    });

    it("updates the toolbar when deleting a row is the first edit", async () => {
        const resultSet: IResultSet = {
            type: "resultSet",
            sql: "select * from test",
            resultId: "delete-first-edit",
            columns: [{
                title: "id",
                field: "id",
                dataType: { type: DBDataType.Bigint },
                inPK: true,
                nullable: false,
                autoIncrement: false,
            }],
            updatable: true,
            fullTableName: "test",
            data: {
                rows: [{ id: 1 }],
                currentPage: 0,
                executionInfo: {
                    text: "All fine",
                },
            },
        };

        const viewRef = createRef<ResultTabView>();
        const { container, unmount } = render(
            <ResultTabView
                ref={viewRef}
                currentSet={1}
                resultSets={{
                    type: "resultSets",
                    sets: [resultSet],
                }}
                contextId="ec123"
                hideTabs="single"
                toggleOptions={toggleOptions}
            />,
        );

        const buttons = container.getElementsByClassName("button") as HTMLCollectionOf<HTMLButtonElement>;
        let applyButton = buttons.namedItem("applyButton")!;
        expect(applyButton.classList.contains("disabled")).toBe(true);

        const internals = viewRef.current! as unknown as IResultTabViewInternals;
        internals.onToggleRowDeletionMarks([0]);
        await nextRunLoop();

        applyButton = buttons.namedItem("applyButton")!;
        expect(applyButton.classList.contains("disabled")).toBe(false);

        const info = internals.editingInfo.get("delete-first-edit");
        expect(info).toBeDefined();
        expect(info!.rowChanges[0].deleted).toBe(true);

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
