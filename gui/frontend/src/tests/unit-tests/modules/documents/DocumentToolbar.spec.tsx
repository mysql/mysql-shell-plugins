/*
 * Copyright (c) 2022, 2026, Oracle and/or its affiliates.
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

import { act, render } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentToolbar } from "../../../../modules/db-editor/DocumentToolbar.js";
import { LoadingState } from "../../../../script-execution/index.js";
import { requisitions } from "../../../../supplement/Requisitions.js";

describe("DocumentToolbar tests", (): void => {
    afterEach(() => {
        Reflect.deleteProperty(window, "electronHost");
    });

    it("Test DocumentToolbar instantiation", () => {
        const { container, unmount } = render(
            <DocumentToolbar
                language={"ts"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Test DocumentToolbar instantiation (HeatWave)", () => {
        const { container, unmount } = render(
            <DocumentToolbar
                language={"js"}
                activeDocument={"document1"}
                heatWaveEnabled={true}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Test DocumentToolbar instantiation language=msg", () => {
        const { container, unmount } = render(
            <DocumentToolbar
                language={"msg"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Test DocumentToolbar requisitions editorCaretMoved", async () => {
        const { unmount } = render(
            <DocumentToolbar
                language={"msg"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await requisitions.execute("editorCaretMoved", {
            lineNumber: 1,
            column: 1,
        });

        // TODO: Check if the change is handled correctly.

        unmount();
    });

    it("Test DocumentToolbar requisitions editorContextStateChanged", async () => {
        const { unmount } = render(
            <DocumentToolbar
                language={"msg"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await requisitions.execute("editorContextStateChanged", "123");

        // TODO: Check if the change is handled correctly.

        unmount();
    });

    it("notifies the desktop host when a non-current context in the active editor changes state", async () => {
        const currentContext = {
            id: "current-context",
            loadingState: LoadingState.Idle,
            isSQLLike: true,
            language: "sql",
        };
        const backgroundContext = {
            id: "background-context",
            loadingState: LoadingState.Loading,
            isSQLLike: true,
            language: "sql",
        };
        const onDesktopRunStateChanged = vi.fn();

        const { unmount } = render(
            <DocumentToolbar
                language={"msg"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[{
                    document: { id: "document1" },
                    currentVersion: 0,
                    state: {
                        model: {
                            executionContexts: {
                                cursorPosition: { lineNumber: 1, column: 1 },
                                contextFromPosition: () => {
                                    return currentContext;
                                },
                                contextWithId: (id: string) => {
                                    if (id === currentContext.id) {
                                        return currentContext;
                                    }

                                    if (id === backgroundContext.id) {
                                        return backgroundContext;
                                    }

                                    return undefined;
                                },
                            },
                        },
                    },
                }] as never}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
                onDesktopRunStateChanged={onDesktopRunStateChanged}
            />,
        );

        await act(async () => {
            await Promise.resolve();
        });
        onDesktopRunStateChanged.mockClear();

        const result = await requisitions.execute("editorContextStateChanged", backgroundContext.id);

        expect(result).toBe(true);
        expect(onDesktopRunStateChanged).toHaveBeenCalledTimes(1);

        unmount();
    });

    it("Test DocumentToolbar requisitions editorToggleStopExecutionOnError", async () => {
        const { unmount } = render(
            <DocumentToolbar
                language={"msg"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await requisitions.execute("editorToggleStopExecutionOnError", true);

        // TODO: Check if the change is handled correctly.

        unmount();
    });

    it("Test DocumentToolbar requisitions settingsChanged", async () => {
        const { unmount } = render(
            <DocumentToolbar
                language={"msg"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await requisitions.execute("settingsChanged", undefined);

        // TODO: Check if the change is handled correctly.

        unmount();
    });

    it("hides find and editor view toggle buttons when hosted by Electron", () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: () => {
                    return undefined;
                },
            },
        });

        const { container, unmount } = render(
            <DocumentToolbar
                language={"sql"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        expect(container.querySelector("[data-tooltip='Find']")).toBeNull();
        expect(container.querySelector("[data-tooltip='Show hidden characters']")).toBeNull();
        expect(container.querySelector("[data-tooltip='Soft wrap lines']")).toBeNull();
        expect(container.querySelector("[data-tooltip='Execute full script']")).toBeNull();
        expect(container.querySelector("[data-tooltip='Execute the statement at the caret position']")).toBeNull();
        expect(container.querySelector("[data-tooltip='Stop execution of the current statement/script']")).toBeNull();

        unmount();
    });

    it("renders execute actions in the right-aligned toolbar section", () => {
        const { container, unmount } = render(
            <DocumentToolbar
                language={"sql"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const toolbar = container.querySelector("#documentToolbar");
        expect(toolbar).not.toBeNull();

        const toolbarChildren = Array.from(toolbar!.children);
        const expanderIndex = toolbarChildren.findIndex((child) => {
            return child.classList.contains("expander");
        });
        const executeIndex = toolbarChildren.findIndex((child) => {
            return child instanceof HTMLElement && child.dataset.tooltip === "Execute full script";
        });
        const findIndex = toolbarChildren.findIndex((child) => {
            return child instanceof HTMLElement && child.dataset.tooltip === "Find";
        });

        expect(expanderIndex).toBeGreaterThan(-1);
        expect(findIndex).toBeGreaterThan(-1);
        expect(executeIndex).toBeGreaterThan(-1);
        expect(findIndex).toBeLessThan(expanderIndex);
        expect(executeIndex).toBeGreaterThan(expanderIndex);

        unmount();
    });

    it("does not render transaction toolbar buttons", () => {
        const { container, unmount } = render(
            <DocumentToolbar
                language={"sql"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        expect(container.querySelector("[data-tooltip='Commit DB changes']")).toBeNull();
        expect(container.querySelector("[data-tooltip='Rollback DB changes']")).toBeNull();
        expect(container.querySelector("[data-tooltip='Auto commit DB changes']")).toBeNull();

        unmount();
    });

    it("does not render the stop-on-error toolbar button", () => {
        const { container, unmount } = render(
            <DocumentToolbar
                language={"sql"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        expect(container.querySelector(
            "[data-tooltip='Stop execution of the current statement/script in case of errors']",
        )).toBeNull();

        unmount();
    });
});
