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

import { ComponentChild, createRef } from "preact";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CellComponent, ColumnDefinition, RowComponent } from "tabulator-tables";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, waitFor } from "@testing-library/preact";
import { DialogHost } from "../../../../app-logic/DialogHost.js";
import { DBDataType, DialogResponseClosure, DialogType, IColumnInfo } from "../../../../app-logic/general-types.js";
import { IDbEditorResultSetData } from "../../../../communication/ProtocolGui.js";
import { ClientConnections } from "../../../../modules/db-editor/ClientConnections.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { CellComponentMock } from "../../__mocks__/CellComponentMock.js";
import { RowComponentMock } from "../../__mocks__/RowComponentMock.js";
import { nextRunLoop } from "../../test-helpers.js";

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

const clientConnectionsGlobalStatusQuery = expect.stringMatching(
    /^show global status where VARIABLE_NAME in \('Aborted_clients', 'Aborted_connects', /,
);

class TestClientConnections extends ClientConnections {
    public testUpdateValues = async (): Promise<void> => {
        // @ts-expect-error, because we are accessing a private method.
        await this.updateValues();
    };

    public testGetClientConnectionDetails = (): ComponentChild => {
        // @ts-expect-error, because we are accessing a protected method.
        return this.getClientConnectionDetails();
    };

    public testGetClientConnectionListDetails = (): ComponentChild => {
        // @ts-expect-error, because we are accessing a protected method.
        return this.getClientConnectionListDetails();
    };

    public testGetClientConnectionHeading = (): ComponentChild => {
        // @ts-expect-error, because we are accessing a protected method.
        return this.getClientConnectionHeading();
    };

    public testHandleClientConnectionTreeRowSelected = (row: RowComponent): void => {
        // @ts-expect-error, because we are accessing a protected method.
        this.handleClientConnectionTreeRowSelected(row);
    };

    public testGetSelectedRowValue = (key: string): string => {
        // @ts-expect-error, because we are accessing a private method.
        return this.getSelectedRowValue(key);
    };

    public testGetSelectedRowRawValue = (key: string): unknown => {
        // @ts-expect-error, because we are accessing a private method.
        return this.getSelectedRowRawValue(key);
    };

    public testNavigateConnectionHistory = (direction: -1 | 1): void => {
        // @ts-expect-error, because we are accessing a private method.
        this.navigateConnectionHistory(direction);
    };

    public testCanNavigateConnectionHistory = (direction: -1 | 1): boolean => {
        // @ts-expect-error, because we are accessing a private method.
        return this.canNavigateConnectionHistory(direction);
    };

    public testConnectionJumpHistory = (): { history: string[]; index: number } => {
        // @ts-expect-error, because we are accessing a private field.
        return { history: this.connectionJumpHistory, index: this.connectionJumpHistoryIndex };
    };

    public testHasConnectionRow = (connectionId: string): boolean => {
        // @ts-expect-error, because we are accessing a private method.
        return this.findConnectionRow("PROCESSLIST_ID", connectionId) !== undefined;
    };

    public testConnectionRowIds = (): string[] => {
        return this.state.resultSet.data.rows.map((row) => {
            // @ts-expect-error, because we are accessing a private method.
            return this.getConnectionRowValue(row, "PROCESSLIST_ID");
        });
    };

    public testCanKillSelectedConnection = (): boolean => {
        // @ts-expect-error, because we are accessing a private method.
        return this.canKillSelectedConnection();
    };

    public testGetClientConnectionLocks = (): ComponentChild => {
        // @ts-expect-error, because we are accessing a protected method.
        return this.getClientConnectionLocks();
    };

    public testGetClientConnectionAttributes = (): ComponentChild => {
        // @ts-expect-error, because we are accessing a protected method.
        return this.getClientConnectionAttributes();
    };

    public testGetClientConnectionCurrentStatement = (): ComponentChild => {
        // @ts-expect-error, because we are accessing a protected method.
        return this.getClientConnectionCurrentStatement();
    };

    public testKillToolbarContent = (): ComponentChild[] => {
        // @ts-expect-error, because we are accessing a protected method.
        return this.killToolbarContent();
    };

    public testGenerateColumnDefinitions = (columns: IColumnInfo[]): ColumnDefinition[] => {
        // @ts-expect-error, because we are accessing a protected method.
        return this.generateColumnDefinitions(columns);
    };

    public testGenerateConnectionListColumnDefinitions = (columns: IColumnInfo[]): ColumnDefinition[] => {
        // @ts-expect-error, because we are accessing a private method.
        return this.generateConnectionListColumnDefinitions(columns);
    };

    public testStringFormatter = (cell: CellComponent): string | HTMLElement => {
        // @ts-expect-error, because we are accessing a protected method.
        return this.stringFormatter(cell);
    };

    public testConnectionTypeFormatter = (cell: CellComponent): string => {
        // @ts-expect-error, because we are accessing a protected method.
        return this.connectionTypeFormatter(cell);
    };

    public testHandleDisplayOptionsMenuItemClick = (command: string): boolean => {
        // @ts-expect-error, because we are accessing a protected method.
        return this.handleDisplayOptionsMenuItemClick({ command: { command, title: command } });
    };

    public testEscapeSqlString = (value: string): string => {
        // @ts-expect-error, because we are accessing a protected method.
        return this.escapeSqlString(value);
    };
}

describe("Client connections module tests", (): void => {
    afterEach(() => {
        Reflect.deleteProperty(window, "electronHost");
        vi.restoreAllMocks();
    });

    it("Test ClientConnections instantiation", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const { container, rerender, unmount } = render(
            <ClientConnections
                backend={backend}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        // Component updates.
        rerender(
            <ClientConnections
                backend={backend}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextRunLoop();

        expect(container).toMatchSnapshot("ClientConnections1");

        backend.closeSession().catch(() => {
            throw new Error("Close session failed");
        });

        await nextRunLoop();
        expect(container).toMatchSnapshot("ClientConnections2");

        unmount();
    });

    it("Test ClientConnections getClientConnectionDetails function", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();

        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const { unmount } = render(<ClientConnections {...props} />);

        const instance = new TestClientConnections(props);
        let result = instance.testGetClientConnectionDetails();
        expect(result).toMatchSnapshot("ClientConnectionsNoSelection");

        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock());
        result = instance.testGetClientConnectionDetails();
        expect(result).toMatchSnapshot("ClientConnections3");

        unmount();
    });

    it("retries performance schema detection when refreshing after the first probe returns no result", async () => {
        const backend = {
            isPerformanceSchemaAvailable: vi.fn()
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true),
            executeService: vi.fn()
                .mockResolvedValueOnce({
                    rows: [
                        ["version_comment", "MySQL Enterprise Server - Commercial"],
                        ["max_connections", "151"],
                    ],
                })
                .mockResolvedValueOnce({
                    columns: [
                        { title: "PROCESSLIST_ID", type: "int" },
                        { title: "THREAD_ID", type: "int" },
                    ],
                    rows: [["7", "42"]],
                })
                .mockResolvedValueOnce({ rows: [] }),
        } as unknown as ShellInterfaceSqlEditor;

        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const instance = new TestClientConnections(props);

        await nextRunLoop();
        await instance.testUpdateValues();

        const isPerformanceSchemaAvailable =
            backend.isPerformanceSchemaAvailable as unknown as ReturnType<typeof vi.fn>;
        const executeService = backend.executeService as unknown as ReturnType<typeof vi.fn>;
        expect(isPerformanceSchemaAvailable).toHaveBeenCalledTimes(2);
        expect(executeService).toHaveBeenCalledWith("show variables where VARIABLE_NAME in ('version_comment', 'max_connections')");
        expect(executeService).toHaveBeenCalledWith(clientConnectionsGlobalStatusQuery);
        expect(executeService).not.toHaveBeenCalledWith("show global status");
    });

    it("does not start overlapping refreshes while a refresh is still pending", async () => {
        let resolveProbe: (value: boolean) => void = () => undefined;
        const pendingProbe = new Promise<boolean>((resolve) => {
            resolveProbe = resolve;
        });
        const backend = {
            isPerformanceSchemaAvailable: vi.fn()
                .mockReturnValueOnce(pendingProbe),
            executeService: vi.fn()
                .mockResolvedValueOnce({
                    rows: [
                        ["version_comment", "MySQL Enterprise Server - Commercial"],
                        ["max_connections", "151"],
                    ],
                })
                .mockResolvedValueOnce({
                    columns: [
                        { title: "PROCESSLIST_ID", type: "int" },
                        { title: "THREAD_ID", type: "int" },
                    ],
                    rows: [["7", "42"]],
                })
                .mockResolvedValueOnce({ rows: [] }),
        } as unknown as ShellInterfaceSqlEditor;

        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const instance = new TestClientConnections(props);

        await nextRunLoop();
        await instance.testUpdateValues();

        const isPerformanceSchemaAvailable =
            backend.isPerformanceSchemaAvailable as unknown as ReturnType<typeof vi.fn>;
        const executeService = backend.executeService as unknown as ReturnType<typeof vi.fn>;
        expect(isPerformanceSchemaAvailable).toHaveBeenCalledTimes(1);
        expect(executeService).not.toHaveBeenCalled();

        resolveProbe(true);
        await waitFor(() => {
            expect(executeService).toHaveBeenCalledWith(clientConnectionsGlobalStatusQuery);
        });

        expect(executeService).toHaveBeenCalledWith("show variables where VARIABLE_NAME in ('version_comment', 'max_connections')");
    });

    it("keeps numeric connection selection after refresh", async ({ expect }) => {
        const executeService = vi.fn(async (query: string): Promise<IDbEditorResultSetData> => {
            if (query.startsWith("show variables")) {
                return {
                    rows: [
                        ["version_comment", "MySQL Enterprise Server - Commercial"],
                        ["max_connections", "151"],
                    ],
                };
            }

            if (query.startsWith("show global status")) {
                return { rows: [] };
            }

            return {
                columns: [
                    { name: "PROCESSLIST_ID", type: "int", length: 8 },
                    { name: "THREAD_ID", type: "int", length: 8 },
                ],
                rows: [[17, 42]],
            };
        });
        const backend = {
            executeService,
            isPerformanceSchemaAvailable: vi.fn().mockResolvedValue(true),
        } as unknown as ShellInterfaceSqlEditor;
        const instance = new TestClientConnections({
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        });

        await waitFor(() => {
            expect(executeService).toHaveBeenCalledWith(clientConnectionsGlobalStatusQuery);
        });

        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock({ 0: 17, 1: 42 } as never));
        expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("17");

        await instance.testUpdateValues();

        expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("17");
        expect(instance.testGetSelectedRowRawValue("PROCESSLIST_ID")).toBe(17);
    });

    it("restores selected row by thread id and navigation history from saved state", async ({ expect }) => {
        const executeService = vi.fn(async (query: string): Promise<IDbEditorResultSetData> => {
            if (query.startsWith("show variables")) {
                return {
                    rows: [
                        ["version_comment", "MySQL Enterprise Server - Commercial"],
                        ["max_connections", "151"],
                    ],
                };
            }

            if (query.startsWith("show global status")) {
                return { rows: [] };
            }

            return {
                columns: [
                    { name: "PROCESSLIST_ID", type: "int", length: 8 },
                    { name: "THREAD_ID", type: "int", length: 8 },
                ],
                rows: [[12, 24], [17, 42]],
            };
        });
        const backend = {
            executeService,
            isPerformanceSchemaAvailable: vi.fn().mockResolvedValue(true),
        } as unknown as ShellInterfaceSqlEditor;
        const ref = createRef<TestClientConnections>();
        const { unmount } = render(<TestClientConnections
            backend={backend}
            toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            savedState={{
                selectedConnectionId: "999",
                selectedThreadId: "42",
                connectionJumpHistory: ["12", "17"],
                connectionJumpHistoryIndex: 1,
            }}
            ref={ref}
        />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(executeService).toHaveBeenCalledWith(clientConnectionsGlobalStatusQuery);
        });

        await waitFor(() => {
            expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("17");
            expect(instance.testGetSelectedRowValue("THREAD_ID")).toBe("42");
            expect(instance.testConnectionRowIds()).toContain("12");
        });
        expect(instance.testConnectionJumpHistory()).toEqual({ history: ["12", "17"], index: 1 });
        expect(instance.testCanNavigateConnectionHistory(-1)).toBe(true);

        instance.testNavigateConnectionHistory(-1);

        expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("12");
        unmount();
    });

    it("keeps connection heading outside of the details tab content", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();

        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const { unmount } = render(<ClientConnections {...props} />);

        const instance = new TestClientConnections(props);
        (instance as unknown as { columns: IColumnInfo[] }).columns = [
            { title: "PROCESSLIST_ID", field: "processlistId" },
            { title: "PROCESSLIST_USER", field: "processlistUser" },
            { title: "PROCESSLIST_HOST", field: "processlistHost" },
            { title: "THREAD_ID", field: "threadId" },
        ] as IColumnInfo[];
        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock({
            processlistId: "17",
            processlistUser: "root",
            processlistHost: "localhost",
            threadId: "42",
        } as never));

        const { container: headingContainer, unmount: unmountHeading } = render(
            <div>{instance.testGetClientConnectionHeading()}</div>,
        );
        const { container: detailsContainer, unmount: unmountDetails } = render(
            <div>{instance.testGetClientConnectionDetails()}</div>,
        );

        expect(headingContainer.querySelector(".connectionDetailsSummary")).not.toBeNull();
        expect(headingContainer.querySelector(".connectionDetailsActions")).not.toBeNull();
        expect(headingContainer.querySelector('[data-tooltip="Show Details"]')).not.toBeNull();
        const connectionIdInput = headingContainer.querySelector<HTMLInputElement>(".connectionDetailsProcessIdInput");
        expect(connectionIdInput?.value).toBe("17");
        expect(connectionIdInput?.disabled).toBe(false);
        expect(connectionIdInput?.readOnly).toBe(false);
        expect(detailsContainer.querySelector(".connectionDetailsSummary")).toBeNull();

        unmountDetails();
        unmountHeading();
        unmount();
    });

    it("renders the connection heading and compact details without a selection", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const instance = new TestClientConnections(props);

        const { container: headingContainer, unmount: unmountHeading } = render(
            <div>{instance.testGetClientConnectionHeading()}</div>,
        );
        const { container: detailsContainer, unmount: unmountDetails } = render(
            <div>{instance.testGetClientConnectionListDetails()}</div>,
        );

        expect(headingContainer.querySelector(".connectionDetailsSummary")).not.toBeNull();
        expect(headingContainer.textContent).toContain("No connection selected");
        expect(headingContainer.querySelector('[data-tooltip="Kill Query"]')!.classList.contains("disabled"))
            .toBe(true);
        expect(headingContainer.querySelector('[data-tooltip="Show Details"]')!.classList.contains("active"))
            .toBe(false);
        expect(detailsContainer.textContent).toContain("Select a connection to show details.");

        unmountDetails();
        unmountHeading();
    });

    it("does not double pad the top of the details tab content", ({ expect }) => {
        const clientConnectionsCss = readFrontendSourceFile("src/modules/db-editor/assets/document.css");

        expect(clientConnectionsCss).toMatch(
            /#clientConnectionDetails \.grid>\.detailSection:first-child\s*{\s*padding-top: 0;/s,
        );
    });

    it("renders the moved details heading without an internal frame", ({ expect }) => {
        const clientConnectionsCss = readFrontendSourceFile("src/modules/db-editor/assets/document.css");
        const detailsRule = readCssRule(clientConnectionsCss, ".msg.clientConnections #connectionDetails");
        const headingRule = readCssRule(clientConnectionsCss, ".msg.clientConnections .connectionDetailsSummary");

        expect(detailsRule).toContain("gap: 8px;");
        expect(headingRule).toContain("padding: 0;");
        expect(headingRule).not.toMatch(/\bborder(?:-radius)?:/);
        expect(headingRule).not.toMatch(/\bbackground(?:-color)?:/);
    });

    it("lays out details heading with embedded actions", ({ expect }) => {
        const clientConnectionsCss = readFrontendSourceFile("src/modules/db-editor/assets/document.css");
        const headingRule = readCssRule(clientConnectionsCss, ".msg.clientConnections .connectionDetailsSummary");
        const captionRule = readCssRule(clientConnectionsCss, ".msg.clientConnections .connectionDetailsCaption");
        const identityRule = readCssRule(clientConnectionsCss, ".msg.clientConnections .connectionDetailsIdentity");
        const processIdRule = readCssRule(clientConnectionsCss,
            ".msg.clientConnections .connectionDetailsIdentity>.connectionDetailsProcessId");
        const processIdInputRule = readCssRule(clientConnectionsCss,
            ".msg.clientConnections .connectionDetailsProcessIdInput");
        const accountRule = readCssRule(clientConnectionsCss,
            ".msg.clientConnections .connectionDetailsSummary>span:last-child");
        const navigationRule = readCssRule(clientConnectionsCss, ".msg.clientConnections .connectionDetailsNavigation");
        const actionsRule = readCssRule(clientConnectionsCss, ".msg.clientConnections .connectionDetailsActions");

        expect(headingRule).toContain("display: grid;");
        expect(headingRule).toContain("grid-template-columns: auto minmax(0, 1fr) auto;");
        expect(captionRule).toContain("font-size: 0.68rem;");
        expect(identityRule).toContain("display: contents;");
        expect(processIdRule).toContain("font-size: 1.2rem;");
        expect(processIdInputRule).toContain("font: inherit;");
        expect(processIdInputRule).toContain("padding: 0 4px 0 8px;");
        expect(processIdInputRule).toContain("border-radius: 999px;");
        expect(accountRule).toContain("font-size: 0.76rem;");
        expect(navigationRule).toContain("grid-column: 1;");
        expect(navigationRule).toContain("grid-row: 2;");
        expect(navigationRule).toContain("align-self: center;");
        expect(actionsRule).toContain("grid-row: 2;");
        expect(actionsRule).toContain("align-self: center;");
    });

    it("sizes masked SVG icons in connection detail actions", ({ expect }) => {
        const clientConnectionsCss = readFrontendSourceFile("src/modules/db-editor/assets/document.css");
        const maskedIconRule = /\.msg\.clientConnections \.connectionDetailsActions \.button>\.icon:not\(\.codicon\)\s*{(?<rule>[^}]*)}/s
            .exec(clientConnectionsCss)?.groups?.rule ?? "";

        expect(maskedIconRule).toContain("width: 16px;");
        expect(maskedIconRule).toContain("height: 16px;");
        expect(maskedIconRule).toContain("background-color: var(--secondaryButton-foreground);");
    });

    it("renders compact side details with thread id first, info last, and raw type", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const instance = new TestClientConnections(props);
        (instance as unknown as { columns: IColumnInfo[] }).columns = [
            { title: "PROCESSLIST_ID", field: "processlistId" },
            { title: "TYPE", field: "type" },
            { title: "THREAD_ID", field: "threadId" },
            { title: "PROCESSLIST_TIME", field: "processlistTime" },
            { title: "PROCESSLIST_TIME_FORMATTED", field: "processlistTimeFormatted" },
            { title: "PROCESSLIST_INFO", field: "processlistInfo" },
        ] as IColumnInfo[];
        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock({
            processlistId: "17",
            type: "FOREGROUND",
            threadId: "42",
            processlistTime: "3600",
            processlistTimeFormatted: "1.00 h",
            processlistInfo: "select 1",
        } as never));

        const { container, unmount } = render(
            <div>{instance.testGetClientConnectionListDetails()}</div>,
        );

        expect(container.textContent).toMatch(
            /Thread ID\s*T\s*42\s*Id\s*17\s*Type\s*FOREGROUND\s*Time\s*1.00 h \(3600s\)\s*Info/s,
        );
        expect(container.querySelector<HTMLTextAreaElement>(".connectionInfoText")?.value).toBe("select 1");

        const infoLabel = Array.from(container.querySelectorAll<HTMLElement>(".detailLabel")).find((label) => {
            return label.textContent === "Info";
        });
        const infoValue = infoLabel?.nextElementSibling as HTMLElement | undefined;
        const clientConnectionsCss = readFrontendSourceFile("src/modules/db-editor/assets/document.css");
        const stackedLabelRule = readCssRule(clientConnectionsCss,
            ".msg.clientConnections #clientConnectionDetails .detailLabel.stacked");
        const sqlLabelRule = readCssRule(clientConnectionsCss,
            ".msg.clientConnections #clientConnectionDetails .connectionSqlLabel");
        const sqlValueRule = readCssRule(clientConnectionsCss,
            ".msg.clientConnections #clientConnectionDetails .connectionSqlValue");

        expect(infoLabel?.style.gridColumn).toBe("span 2");
        expect(infoLabel?.classList.contains("stacked")).toBe(true);
        expect(infoValue?.style.gridColumn).toBe("span 2");
        expect(infoValue?.classList.contains("connectionSqlValue")).toBe(true);
        expect(stackedLabelRule).toContain("border-bottom: none;");
        expect(sqlLabelRule).toContain("padding-bottom: 0;");
        expect(sqlValueRule).toContain("padding-top: 0;");

        unmount();
    });

    it("keeps the info open button visible but disabled when info is empty", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const instance = new TestClientConnections(props);
        (instance as unknown as { columns: IColumnInfo[] }).columns = [
            { title: "PROCESSLIST_ID", field: "processlistId" },
            { title: "THREAD_ID", field: "threadId" },
            { title: "PROCESSLIST_INFO", field: "processlistInfo" },
        ] as IColumnInfo[];
        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock({
            processlistId: "17",
            threadId: "42",
            processlistInfo: "",
        } as never));

        const { container, unmount } = render(
            <div>{instance.testGetClientConnectionListDetails()}</div>,
        );
        const infoLabel = Array.from(container.querySelectorAll<HTMLElement>(".detailLabel")).find((label) => {
            return label.textContent === "Info";
        });
        const openButton = infoLabel?.querySelector<HTMLElement>(".connectionSqlOpenButton");

        expect(openButton).not.toBeNull();
        expect(openButton?.classList.contains("disabled")).toBe(true);
        expect(openButton?.querySelector(".codicon-new-file")).not.toBeNull();

        unmount();
    });

    it("renders transaction details last", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const instance = new TestClientConnections(props);
        (instance as unknown as { columns: IColumnInfo[] }).columns = [
            { title: "PROCESSLIST_ID", field: "processlistId" },
            { title: "THREAD_ID", field: "threadId" },
            { title: "PROCESSLIST_USER", field: "processlistUser" },
            { title: "PROCESSLIST_HOST", field: "processlistHost" },
        ] as IColumnInfo[];
        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock({
            processlistId: "17",
            threadId: "42",
            processlistUser: "root",
            processlistHost: "localhost",
        } as never));

        const { container, unmount } = render(
            <div>{instance.testGetClientConnectionDetails()}</div>,
        );

        const sections = Array.from(container.querySelectorAll(".detailSection")).map((section) => {
            return section.textContent;
        });

        expect(sections).toEqual(["Identity", "Session", "Thread", "Info", "Transaction"]);

        unmount();
    });

    it("does not show a separator between statement SQL Text label and value", ({ expect }) => {
        const execute = vi.spyOn(requisitions, "execute").mockResolvedValue(undefined);
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const instance = new TestClientConnections(props);
        (instance as unknown as { columns: IColumnInfo[] }).columns = [
            { title: "PROCESSLIST_ID", field: "processlistId" },
        ] as IColumnInfo[];
        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock({
            processlistId: "17",
        } as never));
        (instance as unknown as { state: { currentStatement: unknown } }).state.currentStatement = {
            type: "resultSet",
            resultId: "currentStatement",
            sql: "",
            columns: [
                { title: "isActive", field: "isActive" },
                { title: "sqlText", field: "sqlText" },
            ],
            data: {
                currentPage: 1,
                rows: [{ isActive: "1", sqlText: "select sleep(10)" }],
            },
            updatable: false,
            fullTableName: "",
        };

        const { container, unmount } = render(
            <div>{instance.testGetClientConnectionCurrentStatement()}</div>,
        );
        const sqlTextLabel = Array.from(container.querySelectorAll<HTMLElement>(".detailLabel")).find((label) => {
            return label.textContent === "SQL Text";
        });
        const clientConnectionsCss = readFrontendSourceFile("src/modules/db-editor/assets/document.css");
        const stackedLabelRule = readCssRule(clientConnectionsCss,
            ".msg.clientConnections .lockDetailGrid .detailLabel.stacked");

        expect(sqlTextLabel?.classList.contains("stacked")).toBe(true);
        expect(stackedLabelRule).toContain("border-bottom: none;");

        const openButton = container.querySelector<HTMLElement>(".connectionSqlOpenButton");
        expect(openButton).not.toBeNull();
        expect(sqlTextLabel?.contains(openButton)).toBe(true);
        expect(openButton?.querySelector(".codicon-new-file")).not.toBeNull();

        fireEvent.click(openButton!);

        expect(execute).toHaveBeenCalledWith("editorEditScript", expect.objectContaining({
            caption: "Current Statement",
            content: "select sleep(10)",
            language: "mysql",
        }));

        unmount();
    });

    it("renders id pills and jumps to another connection from thread ids", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const instance = new TestClientConnections(props);
        const columns = [
            { title: "PROCESSLIST_ID", field: "processlistId" },
            { title: "PROCESSLIST_USER", field: "processlistUser" },
            { title: "PROCESSLIST_HOST", field: "processlistHost" },
            { title: "THREAD_ID", field: "threadId" },
            { title: "PARENT_THREAD_ID", field: "parentThreadId" },
            { title: "TYPE", field: "type" },
        ] as IColumnInfo[];
        const rows = [
            {
                processlistId: "17",
                processlistUser: "root",
                processlistHost: "localhost",
                threadId: "42",
                parentThreadId: "99",
                type: "FOREGROUND",
            },
            {
                processlistId: "18",
                processlistUser: "app",
                processlistHost: "localhost",
                threadId: "99",
                parentThreadId: "",
                type: "FOREGROUND",
            },
        ];

        (instance as unknown as { columns: IColumnInfo[] }).columns = columns;
        (instance as unknown as { state: { resultSet: unknown } }).state.resultSet = {
            type: "resultSet",
            resultId: "connections",
            sql: "",
            columns,
            data: { currentPage: 1, rows },
            updatable: false,
            fullTableName: "",
        };
        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock(rows[0] as never));

        const { container, unmount } = render(
            <div>{instance.testGetClientConnectionDetails()}</div>,
        );

        expect(container.querySelector(".connectionIdPill.thread")).not.toBeNull();
        const jumpButton = container.querySelector(".connectionIdJumpButton")!;
        expect(jumpButton.querySelector(".codicon-arrow-circle-right")).not.toBeNull();

        fireEvent.click(jumpButton);
        expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("18");

        instance.testNavigateConnectionHistory(-1);
        expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("17");

        instance.testNavigateConnectionHistory(1);
        expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("18");

        unmount();
    });

    it("keeps connection history when selecting a table row and drops forward entries", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const instance = new TestClientConnections(props);
        const columns = [
            { title: "PROCESSLIST_ID", field: "processlistId" },
            { title: "PROCESSLIST_USER", field: "processlistUser" },
            { title: "PROCESSLIST_HOST", field: "processlistHost" },
            { title: "THREAD_ID", field: "threadId" },
            { title: "PARENT_THREAD_ID", field: "parentThreadId" },
            { title: "TYPE", field: "type" },
        ] as IColumnInfo[];
        const rows = [
            {
                processlistId: "17",
                processlistUser: "root",
                processlistHost: "localhost",
                threadId: "42",
                parentThreadId: "99",
                type: "FOREGROUND",
            },
            {
                processlistId: "18",
                processlistUser: "app",
                processlistHost: "localhost",
                threadId: "99",
                parentThreadId: "",
                type: "FOREGROUND",
            },
            {
                processlistId: "19",
                processlistUser: "report",
                processlistHost: "localhost",
                threadId: "100",
                parentThreadId: "",
                type: "FOREGROUND",
            },
        ];

        (instance as unknown as { columns: IColumnInfo[] }).columns = columns;
        (instance as unknown as { state: { resultSet: unknown } }).state.resultSet = {
            type: "resultSet",
            resultId: "connections",
            sql: "",
            columns,
            data: { currentPage: 1, rows },
            updatable: false,
            fullTableName: "",
        };
        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock(rows[0] as never));

        const { container, unmount } = render(
            <div>{instance.testGetClientConnectionDetails()}</div>,
        );

        fireEvent.click(container.querySelector(".connectionIdJumpButton")!);
        expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("18");

        instance.testNavigateConnectionHistory(-1);
        expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("17");

        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock(rows[2] as never));
        expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("19");

        instance.testNavigateConnectionHistory(-1);
        expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("17");

        instance.testNavigateConnectionHistory(1);
        expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("19");

        instance.testNavigateConnectionHistory(1);
        expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("19");

        unmount();
    });

    it("selects the entered connection id and disables kill while edited", async ({ expect }) => {
        const backend = {
            isPerformanceSchemaAvailable: vi.fn().mockResolvedValue(false),
            closeSession: vi.fn().mockResolvedValue(undefined),
        } as unknown as ShellInterfaceSqlEditor;
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const ref = createRef<TestClientConnections>();
        const { container, unmount } = render(<TestClientConnections {...props} ref={ref} />);
        const instance = ref.current!;
        const columns = [
            { title: "PROCESSLIST_ID", field: "processlistId" },
            { title: "THREAD_ID", field: "threadId" },
            { title: "TYPE", field: "type" },
        ] as IColumnInfo[];
        const rows = [
            { processlistId: "17", threadId: "42", type: "FOREGROUND" },
            { processlistId: "18", threadId: "99", type: "FOREGROUND" },
        ];

        (instance as unknown as { columns: IColumnInfo[] }).columns = columns;
        (instance as unknown as { state: { resultSet: unknown } }).state.resultSet = {
            type: "resultSet",
            resultId: "connections",
            sql: "",
            columns,
            data: { currentPage: 1, rows },
            updatable: false,
            fullTableName: "",
        };
        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock(rows[0] as never));
        await nextRunLoop();

        let connectionIdInput = container.querySelector<HTMLInputElement>(".connectionDetailsProcessIdInput")!;
        expect(connectionIdInput.value).toBe("17");
        expect(instance.testCanKillSelectedConnection()).toBe(true);

        fireEvent.input(connectionIdInput, { target: { value: "" } });
        await nextRunLoop();
        connectionIdInput = container.querySelector<HTMLInputElement>(".connectionDetailsProcessIdInput")!;
        expect(connectionIdInput.value).toBe("");
        expect(instance.testCanKillSelectedConnection()).toBe(false);

        fireEvent.input(connectionIdInput, { target: { value: "18" } });
        await nextRunLoop();
        expect(instance.testCanKillSelectedConnection()).toBe(false);

        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock(rows[0] as never));
        await nextRunLoop();
        connectionIdInput = container.querySelector<HTMLInputElement>(".connectionDetailsProcessIdInput")!;
        expect(connectionIdInput.value).toBe("18");
        expect(instance.testCanKillSelectedConnection()).toBe(false);

        fireEvent.keyDown(connectionIdInput, { key: "Enter" });
        await nextRunLoop();
        connectionIdInput = container.querySelector<HTMLInputElement>(".connectionDetailsProcessIdInput")!;

        expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("18");
        expect(connectionIdInput.value).toBe("18");
        expect(instance.testCanKillSelectedConnection()).toBe(true);

        unmount();
    });

    it("uses one jump button for composite connection and thread ids", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const instance = new TestClientConnections(props);
        const columns = [
            { title: "PROCESSLIST_ID", field: "processlistId" },
            { title: "THREAD_ID", field: "threadId" },
            { title: "TYPE", field: "type" },
        ] as IColumnInfo[];
        const rows = [
            { processlistId: 17, threadId: 42, type: "FOREGROUND" },
            { processlistId: 18, threadId: 99, type: "FOREGROUND" },
        ];

        (instance as unknown as { columns: IColumnInfo[] }).columns = columns;
        (instance as unknown as { state: { resultSet: unknown; metadataLocksWaiting: unknown } }).state.resultSet = {
            type: "resultSet",
            resultId: "connections",
            sql: "",
            columns,
            data: { currentPage: 1, rows },
            updatable: false,
            fullTableName: "",
        };
        (instance as unknown as { state: { metadataLocksWaiting: unknown } }).state.metadataLocksWaiting = {
            type: "resultSet",
            resultId: "metadataLocksWaiting",
            sql: "",
            columns: [
                { title: "objectName", field: "objectName" },
                { title: "duration", field: "duration" },
                { title: "holderDisplay", field: "holderDisplay" },
                { title: "holderConnectionId", field: "holderConnectionId" },
                { title: "holderThreadId", field: "holderThreadId" },
            ],
            data: {
                currentPage: 1,
                rows: [{
                    objectName: "sakila.city",
                    duration: "TRANSACTION",
                    holderDisplay: "18 (tid: 99)",
                    holderConnectionId: 18,
                    holderThreadId: 99,
                }],
            },
            updatable: false,
            fullTableName: "",
        };
        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock(rows[0] as never));

        const { container, unmount } = render(
            <div>{instance.testGetClientConnectionLocks()}</div>,
        );
        const composite = container.querySelector(".connectionIdComposite")!;

        expect(composite.querySelectorAll(".connectionIdPill")).toHaveLength(2);
        const jumpButton = composite.querySelector(".connectionIdJumpButton")!;
        expect(composite.querySelectorAll(".connectionIdJumpButton")).toHaveLength(1);

        fireEvent.click(jumpButton);
        expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("18");

        unmount();
    });

    it("renders kill controls as icon buttons", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const instance = new TestClientConnections(props);

        const { container: emptyToolbar, unmount: unmountEmptyToolbar } = render(
            <div>{instance.testKillToolbarContent()}</div>,
        );
        const disabledKillQueryButton = emptyToolbar.querySelector('[data-tooltip="Kill Query"]')!;
        const disabledKillConnectionButton = emptyToolbar.querySelector('[data-tooltip="Kill Connection"]')!;

        expect(disabledKillQueryButton.classList.contains("imageOnly")).toBe(true);
        expect(disabledKillQueryButton.classList.contains("disabled")).toBe(true);
        expect(disabledKillQueryButton.querySelector(".codicon-debug-stop")).not.toBeNull();
        expect(disabledKillConnectionButton.classList.contains("imageOnly")).toBe(true);
        expect(disabledKillConnectionButton.classList.contains("disabled")).toBe(true);
        expect(disabledKillConnectionButton.querySelector(".codicon-debug-disconnect")).not.toBeNull();
        unmountEmptyToolbar();

        (instance as unknown as { columns: IColumnInfo[] }).columns = [
            { title: "PROCESSLIST_ID", field: "processlistId" },
            { title: "PROCESSLIST_USER", field: "processlistUser" },
            { title: "PROCESSLIST_HOST", field: "processlistHost" },
            { title: "THREAD_ID", field: "threadId" },
            { title: "TYPE", field: "type" },
        ] as IColumnInfo[];
        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock({
            processlistId: "17",
            processlistUser: "root",
            processlistHost: "localhost",
            threadId: "42",
            type: "FOREGROUND",
        } as never));

        const { container: selectedToolbar, unmount: unmountSelectedToolbar } = render(
            <div>{instance.testKillToolbarContent()}</div>,
        );

        expect(selectedToolbar.querySelector('[data-tooltip="Kill Query"]')!.classList.contains("disabled"))
            .toBe(false);
        expect(selectedToolbar.querySelector('[data-tooltip="Kill Connection"]')!.classList.contains("disabled"))
            .toBe(false);

        unmountSelectedToolbar();
    });

    it("confirms kill actions before executing them", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const executeServiceSpy = vi.spyOn(backend, "executeService").mockResolvedValue(undefined);
        const showDialogSpy = vi.spyOn(DialogHost, "showDialog").mockResolvedValue({
            id: "clientConnectionsConfirmDialog",
            type: DialogType.Confirm,
            closure: DialogResponseClosure.Accept,
        });
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const instance = new TestClientConnections(props);
        vi.spyOn(instance as unknown as { updateValues: () => Promise<void>; }, "updateValues").mockResolvedValue();
        (instance as unknown as { columns: IColumnInfo[] }).columns = [
            { title: "PROCESSLIST_ID", field: "processlistId" },
            { title: "PROCESSLIST_USER", field: "processlistUser" },
            { title: "PROCESSLIST_HOST", field: "processlistHost" },
            { title: "THREAD_ID", field: "threadId" },
            { title: "TYPE", field: "type" },
        ] as IColumnInfo[];
        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock({
            processlistId: "17",
            processlistUser: "root",
            processlistHost: "localhost",
            threadId: "42",
            type: "FOREGROUND",
        } as never));

        const { container, unmount } = render(<div>{instance.testKillToolbarContent()}</div>);
        executeServiceSpy.mockClear();

        fireEvent.click(container.querySelector('[data-tooltip="Kill Query"]')!);
        await waitFor(() => {
            expect(showDialogSpy).toHaveBeenCalledWith({
                id: "clientConnectionsConfirmDialog",
                type: DialogType.Confirm,
                parameters: {
                    title: "MySQL Client Connections",
                    prompt: "Do you want to kill selected query?",
                    accept: "Kill",
                    refuse: "Cancel",
                    default: "Cancel",
                },
            });
        });
        expect(executeServiceSpy).toHaveBeenCalledWith("KILL QUERY 17");

        showDialogSpy.mockResolvedValue({
            id: "clientConnectionsConfirmDialog",
            type: DialogType.Confirm,
            closure: DialogResponseClosure.Decline,
        });
        executeServiceSpy.mockClear();

        fireEvent.click(container.querySelector('[data-tooltip="Kill Connection"]')!);
        await waitFor(() => {
            expect(showDialogSpy).toHaveBeenLastCalledWith({
                id: "clientConnectionsConfirmDialog",
                type: DialogType.Confirm,
                parameters: {
                    title: "MySQL Client Connections",
                    prompt: "Do you want to kill selected connection?",
                    accept: "Kill",
                    refuse: "Cancel",
                    default: "Cancel",
                },
            });
        });
        expect(executeServiceSpy).not.toHaveBeenCalled();

        unmount();
    });

    it("keeps the raw selected thread id for grid selection", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const instance = new TestClientConnections(props);
        (instance as unknown as { columns: IColumnInfo[] }).columns = [
            { title: "PROCESSLIST_ID", field: "processlistId" },
            { title: "THREAD_ID", field: "threadId" },
        ] as IColumnInfo[];

        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock({
            processlistId: 17,
            threadId: 42,
        } as never));

        expect(instance.testGetSelectedRowValue("PROCESSLIST_ID")).toBe("17");
        expect(instance.testGetSelectedRowValue("THREAD_ID")).toBe("42");
        expect(instance.testGetSelectedRowRawValue("THREAD_ID")).toBe(42);
    });

    it("uses secondary button styling for toolbar and side action buttons", ({ expect }) => {
        const clientConnectionsCss = readFrontendSourceFile("src/modules/db-editor/assets/document.css");

        expect(clientConnectionsCss).toContain(
            "--secondaryButton-hoverBackground: var(--button-secondaryHoverBackground);",
        );
        expect(clientConnectionsCss).not.toContain("clientConnectionActionHoverBackground");
        expect(clientConnectionsCss).toContain(
            ".msg.clientConnections #clientConnectionToolbar .button:not(.disabled):hover",
        );
        expect(clientConnectionsCss).toContain(
            ".msg.clientConnections .connectionDetailsActions " +
            ".button:not(.disabled):not(.active):hover",
        );
        expect(clientConnectionsCss).toContain("background-color: var(--secondaryButton-hoverBackground);");
    });

    it("Test ClientConnections getClientConnectionLocks function", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();

        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const { unmount } = render(<ClientConnections {...props} />);

        const instance = new TestClientConnections(props);
        expect(instance.testGetClientConnectionLocks()).toMatchSnapshot("ClientConnectionsLocksNoSelection");

        unmount();
    });

    it("Test ClientConnections getClientConnectionAttributes function", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();

        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const { unmount } = render(<ClientConnections {...props} />);

        const instance = new TestClientConnections(props);
        const result = instance.testGetClientConnectionAttributes();
        expect(result).toMatchSnapshot("ClientConnectionsAttributesNoSelection");

        unmount();
    });

    it("renders connection attributes as label value pairs", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();

        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const { unmount } = render(<ClientConnections {...props} />);

        const instance = new TestClientConnections(props);
        (instance as unknown as { columns: IColumnInfo[] }).columns = [
            { title: "PROCESSLIST_ID", field: "processlistId" },
        ] as IColumnInfo[];
        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock({
            processlistId: "17",
        } as never));
        (instance as unknown as { state: { attributes: unknown } }).state.attributes = {
            type: "resultSet",
            resultId: "attributes",
            sql: "",
            columns: [
                { title: "PROCESSLIST_ID", field: "0" },
                { title: "ATTR_NAME", field: "1" },
                { title: "ATTR_VALUE", field: "2" },
            ],
            data: {
                currentPage: 1,
                rows: [
                    { 0: "17", 1: "_client_name", 2: "libmysql" },
                    { 0: "17", 1: "program_name", 2: "mysqlsh" },
                ],
            },
            updatable: false,
            fullTableName: "",
        };

        const { container, unmount: unmountAttributes } = render(
            <div>{instance.testGetClientConnectionAttributes()}</div>,
        );

        expect(container.querySelector("#clientConnectionAttributes")).toBeNull();
        expect(container.textContent).toMatch(/Connection Attributes\s*_client_name\s*libmysql\s*program_name\s*mysqlsh/s);

        unmountAttributes();
        unmount();
    });

    it("Test ClientConnections generateColumnDefinitions function", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const { unmount } = render(<ClientConnections {...props} />);
        const instance = new TestClientConnections(props);

        const columns = [
            {
                title: "Name",
                field: "name",
                dataType: { type: DBDataType.String },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
            {
                title: "Age",
                field: "age",
                dataType: { type: DBDataType.Decimal },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
            {
                title: "Date",
                field: "date",
                dataType: { type: DBDataType.Date },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
            {
                title: "Time",
                field: "time",
                dataType: { type: DBDataType.Time },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
            {
                title: "Year",
                field: "year",
                dataType: { type: DBDataType.Year },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
        ];

        const expectedDefinitions = [
            {
                title: "Name",
                field: "name",
                // @ts-expect-error, because we are accessing a protected method.
                formatter: instance.stringFormatter,
                formatterParams: {},
                minWidth: 32,
                resizable: true,
            },
            {
                title: "Age",
                field: "age",
                formatter: "plaintext",
                formatterParams: {},
                minWidth: 32,
                resizable: true,
            },
            {
                title: "Date",
                field: "date",
                formatter: "datetime",
                formatterParams: {},
                minWidth: 32,
                resizable: true,
            },
            {
                field: "time",
                formatter: "datetime",
                formatterParams: {
                    outputFormat: "HH:mm:ss",
                },
                minWidth: 32,
                resizable: true,
                title: "Time",
            },
            {
                field: "year",
                formatter: "datetime",
                formatterParams: {
                    outputFormat: "YYYY",
                },
                minWidth: 32,
                resizable: true,
                title: "Year",
            },
        ];

        const definitions = instance.testGenerateColumnDefinitions(columns);
        expect(definitions).toEqual(expectedDefinitions);

        unmount();
    });

    it("keeps a low resize floor without forcing column widths", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const { unmount } = render(<ClientConnections {...props} />);
        const instance = new TestClientConnections(props);

        const definitions = instance.testGenerateColumnDefinitions([
            {
                title: "Name",
                field: "name",
                dataType: { type: DBDataType.String },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
            {
                title: "PARENT_THREAD_ID",
                field: "parentThreadId",
                dataType: { type: DBDataType.Int },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
        ]);

        expect(definitions[0].minWidth).toBe(32);
        expect(definitions[1].minWidth).toBe(32);
        expect(definitions[0].width).toBeUndefined();
        expect(definitions[1].width).toBeUndefined();
        expect(definitions[0].widthShrink).toBeUndefined();
        expect(definitions[1].widthShrink).toBeUndefined();
        expect(definitions[0].widthGrow).toBeUndefined();
        expect(definitions[1].widthGrow).toBeUndefined();

        unmount();
    });

    it("does not reserve sorter padding in connection-list headers", ({ expect }) => {
        const clientConnectionsCss = readFrontendSourceFile("src/modules/db-editor/assets/document.css");
        const sortableTitleRule = readCssRule(
            clientConnectionsCss,
            ".msg.clientConnections #clientConnectionsGrid .tabulator-header " +
            ".tabulator-col.tabulator-sortable .tabulator-col-title",
        );

        expect(sortableTitleRule).toContain("padding-right: 0;");
    });

    it("renders connection list id columns as pills without jump buttons", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const { unmount } = render(<ClientConnections {...props} />);
        const instance = new TestClientConnections(props);
        const columns = [
            {
                title: "PROCESSLIST_ID",
                field: "processlistId",
                dataType: { type: DBDataType.Int },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
            {
                title: "THREAD_ID",
                field: "threadId",
                dataType: { type: DBDataType.Int },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
        ];

        const [connectionDefinition, threadDefinition] = instance.testGenerateColumnDefinitions(columns);
        const connectionCell = new CellComponentMock();
        const threadCell = new CellComponentMock();

        connectionCell.setValue("17");
        threadCell.setValue("42");

        const connectionElement = (connectionDefinition.formatter as (cell: CellComponent) => HTMLElement)(
            connectionCell,
        );
        const threadElement = (threadDefinition.formatter as (cell: CellComponent) => HTMLElement)(threadCell);

        expect(connectionElement.querySelector(".connectionIdPill.connection")?.textContent).toBe("17");
        expect(threadElement.querySelector(".connectionIdPill.thread")?.textContent).toBe("T42");
        expect(connectionElement.querySelector(".connectionIdJumpButton")).toBeNull();
        expect(threadElement.querySelector(".connectionIdJumpButton")).toBeNull();

        unmount();
    });

    it("hides type from the connection list and marks background threads in the id", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const { unmount } = render(<ClientConnections {...props} />);
        const instance = new TestClientConnections(props);
        const columns = [
            {
                title: "PROCESSLIST_ID",
                field: "processlistId",
                dataType: { type: DBDataType.Int },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
            {
                title: "TYPE",
                field: "type",
                dataType: { type: DBDataType.String },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
        ];

        // @ts-expect-error, because we are setting private column metadata for the formatter.
        instance.columns = columns;
        const [connectionDefinition] = instance.testGenerateConnectionListColumnDefinitions(columns);
        const connectionCell = new CellComponentMock();
        connectionCell.setValue("17");
        connectionCell.row = new RowComponentMock({ processlistId: "17", type: "BACKGROUND" } as never);

        const connectionElement = (connectionDefinition.formatter as (cell: CellComponent) => HTMLElement)(
            connectionCell,
        );

        expect(instance.testGenerateConnectionListColumnDefinitions(columns).map((column) => {
            return column.field;
        })).toEqual(["processlistId"]);
        expect(connectionElement.querySelector(".connectionIdPill.backgroundThread")?.textContent).toBe(
            "17background",
        );

        unmount();
    });

    it("Test ClientConnections stringFormatter function", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const { unmount } = render(<ClientConnections {...props} />);
        const instance = new TestClientConnections(props);

        const result = instance.testStringFormatter(new CellComponentMock());
        expect(result).toEqual("Animal");

        unmount();
    });

    it("shortens foreground/background connection types", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const { unmount } = render(<ClientConnections {...props} />);
        const instance = new TestClientConnections(props);
        const cell = new CellComponentMock();

        cell.setValue("FOREGROUND");
        expect(instance.testConnectionTypeFormatter(cell)).toBe("FG");

        cell.setValue("BACKGROUND");
        expect(instance.testConnectionTypeFormatter(cell)).toBe("BG");

        cell.setValue("UNKNOWN");
        expect(instance.testConnectionTypeFormatter(cell)).toBe("UNKNOWN");

        unmount();
    });

    it("toggles full info text for the connection list query", async ({ expect }) => {
        const executeService = vi.fn(async (query: string) => {
            if (query.startsWith("show variables")) {
                return {
                    rows: [
                        ["version_comment", "MySQL Enterprise Server"],
                        ["max_connections", "151"],
                    ],
                };
            }

            if (query.startsWith("show global status")) {
                return { rows: [] };
            }

            return {
                columns: [
                    { name: "PROCESSLIST_ID", type: "int" },
                    { name: "PROCESSLIST_INFO", type: "str" },
                ],
                rows: [],
            };
        });
        const backend = {
            executeService,
            isPerformanceSchemaAvailable: vi.fn().mockResolvedValue(true),
        } as unknown as ShellInterfaceSqlEditor;
        const instance = new TestClientConnections({
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        });

        await waitFor(() => {
            expect(executeService).toHaveBeenCalledWith(expect.stringContaining(
                "LEFT(t.PROCESSLIST_INFO, 255) PROCESSLIST_INFO",
            ), undefined, expect.any(String));
        });

        executeService.mockClear();
        instance.testHandleDisplayOptionsMenuItemClick("showFullInfoColumn");

        await waitFor(() => {
            expect(executeService).toHaveBeenCalledWith(expect.stringContaining("t.PROCESSLIST_INFO"),
                undefined, expect.any(String));
        });
        expect(executeService).not.toHaveBeenCalledWith(expect.stringContaining("LEFT(t.PROCESSLIST_INFO, 255)"),
            undefined, expect.any(String));
    });

    it("uses Show Background Threads to include background rows", async ({ expect }) => {
        const executeService = vi.fn(async (query: string) => {
            if (query.startsWith("show variables")) {
                return {
                    rows: [
                        ["version_comment", "MySQL Enterprise Server"],
                        ["max_connections", "151"],
                    ],
                };
            }

            if (query.startsWith("show global status")) {
                return { rows: [] };
            }

            return {
                columns: [
                    { name: "PROCESSLIST_ID", type: "int" },
                    { name: "TYPE", type: "str" },
                ],
                rows: [],
            };
        });
        const backend = {
            executeService,
            isPerformanceSchemaAvailable: vi.fn().mockResolvedValue(true),
        } as unknown as ShellInterfaceSqlEditor;
        const instance = new TestClientConnections({
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        });

        await waitFor(() => {
            expect(executeService).toHaveBeenCalledWith(expect.stringContaining("AND t.TYPE <> 'BACKGROUND'"),
                undefined, expect.any(String));
        });

        executeService.mockClear();
        instance.testHandleDisplayOptionsMenuItemClick("showBackgroundThreads");

        await waitFor(() => {
            expect(executeService).toHaveBeenCalledWith(expect.not.stringContaining("AND t.TYPE <> 'BACKGROUND'"),
                undefined, expect.any(String));
        });
    });

    it("Test ClientConnections testEscapeSqlString function", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const props = {
            backend,
            toolbarItems: { navigation: [], execution: [], editor: [], auxiliary: [] },
        };
        const { unmount } = render(<ClientConnections {...props} />);
        const instance = new TestClientConnections(props);

        let result = instance.testEscapeSqlString("test");
        expect(result).toEqual("test");

        result = instance.testEscapeSqlString("\x08");
        expect(result).toEqual("\\b");

        result = instance.testEscapeSqlString("prefix \0 suffix");
        expect(result).toEqual("prefix \\0 suffix");

        result = instance.testEscapeSqlString("\x09 test1 \x1a test2 \n");
        expect(result).toEqual("\\t test1 \\z test2 \\n");

        result = instance.testEscapeSqlString("\r test %s");
        expect(result).toEqual("\\r test \\%s");

        unmount();
    });

    it("opens display options through the native menu bridge", async () => {
        const showNativeMenu = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
                showNativeMenu,
                closeNativeMenu: vi.fn().mockResolvedValue(undefined),
                setNativeMenuHandler: vi.fn(),
            },
        });

        const backend = new ShellInterfaceSqlEditor();
        const { container, unmount } = render(
            <ClientConnections
                backend={backend}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextRunLoop();

        fireEvent.click(container.querySelector('[data-tooltip="Display Options"]')!, {
            clientX: 640,
            clientY: 120,
        });

        await waitFor(() => {
            expect(showNativeMenu).toHaveBeenCalledTimes(1);
        });
        expect(showNativeMenu).toHaveBeenCalledWith(expect.objectContaining({
            x: undefined,
            y: undefined,
            items: expect.arrayContaining([
                expect.objectContaining({ label: "Hide Sleeping Connections" }),
                expect.objectContaining({ label: "Show Background Threads" }),
                expect.objectContaining({ label: "Show Full Info Column" }),
            ]),
        }));
        const items = showNativeMenu.mock.calls[0][0].items as Array<{ label: string; }>;
        expect(items).not.toContainEqual(expect.objectContaining({ label: "Show Details" }));

        backend.closeSession().catch(() => {
            throw new Error("Close session failed");
        });
        unmount();
    });

});
