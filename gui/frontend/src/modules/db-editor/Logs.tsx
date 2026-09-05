/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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
import { CellComponent, ColumnDefinition, RowComponent } from "tabulator-tables";

import { IErrorLogFileRow } from "../../communication/ProtocolGui.js";
import { ui } from "../../app-logic/UILayer.js";
import { Button } from "../../components/ui/Button/Button.js";
import { Codicon } from "../../components/ui/Codicon.js";
import {
    ComponentBase, ComponentPlacement, IComponentProperties, IComponentState, SelectionType,
} from "../../components/ui/Component/ComponentBase.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Menu } from "../../components/ui/Menu/Menu.js";
import { IMenuItemProperties, MenuItem } from "../../components/ui/Menu/MenuItem.js";
import { TreeGrid } from "../../components/ui/TreeGrid/TreeGrid.js";
import { Assets } from "../../supplement/Assets.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { IOpenFileDialogResult } from "../../supplement/RequisitionTypes.js";
import { IErrorLogFilters, ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { IConnectionDetails } from "../../supplement/ShellInterface/index.js";
import { convertErrorToString, uuid } from "../../utilities/helpers.js";
import {
    AdministrationPageBody, AdministrationPageFrame, AdministrationPageHeading,
} from "./AdministrationPageFrame.js";
import { isLocalOfflineConnectionCandidate } from "./OfflineAdministration.js";

const errorLogPageSize = 1000;
const errorLogTablePageSize = errorLogPageSize + 1;
const errorLogExportFileName = "error.log";
const errorLogMessagePreviewLength = 1024;
const noSupportedErrorLogSourcesMessage = "No supported error log sources are available.";

const defaultErrorLogExportFileName = (connectionDetails?: IConnectionDetails): string => {
    const options = connectionDetails?.options;
    const host = options && "host" in options ? String(options.host).trim() : "";
    const safeHost = host.replace(/^\[|\]$/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");

    return safeHost ? `${safeHost}-${errorLogExportFileName}` : errorLogExportFileName;
};

type LogSource = "table" | "file" | "unavailable" | "none";
type MultiChoiceFilter = "priority" | "errorCode" | "subsystem";

interface ILogFilterSelections {
    priority: string[];
    errorCode: string[];
    subsystem: string[];
}

interface ILogFilters {
    selections: ILogFilterSelections;
    timestamp: string;
    minTimestamp?: number;
    message: string;
}

interface ILogRow extends IErrorLogFileRow {
    timestamp?: number;
}

const defaultLogFilters = (): ILogFilters => {
    return {
        selections: {
            priority: [],
            errorCode: [],
            subsystem: [],
        },
        timestamp: "all",
        message: "",
    };
};

interface ILogsProperties extends IComponentProperties {
    backend?: ShellInterfaceSqlEditor;
    connectionDetails?: IConnectionDetails;
    offline?: boolean;
}

interface ILogsState extends IComponentState {
    loading: boolean;
    source: LogSource;
    error?: string;
    page: number;
    totalPages: number;
    hasNext: boolean;
    filtersExpanded: boolean;
    openFilterMenu?: MultiChoiceFilter;
    draftFilters: ILogFilters;
    appliedFilters: ILogFilters;
    logPath: string;
    isLogTruncated: boolean;
    errorCodeValues: string[];
    subsystemValues: string[];
    sourceRows: ILogRow[];
}

export const isLocalLogTarget = (connectionDetails?: IConnectionDetails): boolean => {
    return connectionDetails !== undefined && !connectionDetails.isCloudInstance
        && isLocalOfflineConnectionCandidate(connectionDetails);
};

export class Logs extends ComponentBase<ILogsProperties, ILogsState> {

    private actionMenuButtonRef = createRef<HTMLDivElement>();
    private actionMenuRef = createRef<Menu>();
    private logRowContextMenuRef = createRef<Menu>();
    private logTableRef = createRef<TreeGrid>();
    private exportResourceId = `logsExport.${uuid()}`;
    private pendingExportSource?: "table" | "file";
    private loadRequest = 0;
    private highlightedRowLine?: number;

    public constructor(props: ILogsProperties) {
        super(props);

        this.state = {
            loading: false,
            source: "none",
            error: undefined,
            page: 0,
            totalPages: 1,
            hasNext: false,
            filtersExpanded: false,
            openFilterMenu: undefined,
            draftFilters: defaultLogFilters(),
            appliedFilters: defaultLogFilters(),
            logPath: "",
            isLogTruncated: false,
            errorCodeValues: [],
            subsystemValues: [],
            sourceRows: [],
        };

        this.addHandledProperties("backend", "connectionDetails", "offline");
    }

    public override componentDidMount(): void {
        requisitions.register("selectFile", this.selectFile);
        void this.loadInitialPage();
    }

    public override componentWillUnmount(): void {
        requisitions.unregister("selectFile", this.selectFile);
    }

    public override componentDidUpdate(prevProps: ILogsProperties, prevState: ILogsState): void {
        const { backend, connectionDetails } = this.props;
        if (backend !== prevProps.backend || connectionDetails !== prevProps.connectionDetails) {
            void this.loadInitialPage();
        }

        if (this.state.sourceRows !== prevState.sourceRows) {
            this.logTableRef.current?.deselectRow();
        }
    }

    public render(): ComponentChild {
        const { source, loading, page, hasNext, filtersExpanded, logPath, isLogTruncated,
            sourceRows, appliedFilters } = this.state;
        const rows = this.filterRows(sourceRows, appliedFilters);
        const className = this.getEffectiveClassNames(["logs"]);
        const sourceLabel = this.sourceLabel(source, logPath);
        const lastPage = this.lastPage();
        const firstDisabled = page === 0 || loading;
        const previousDisabled = firstDisabled;
        const nextDisabled = !hasNext || loading;
        const lastDisabled = page >= lastPage || loading;

        return (
            <AdministrationPageFrame className={className}>
                <AdministrationPageHeading
                    id="logsOverview"
                    heading="Error Log"
                    icon={<Icon src={Assets.documents.adminDashboardIcon} id="logsIcon" />}
                    subtitle={sourceLabel}
                />
                <AdministrationPageBody>
                    <div id="logsToolbar">
                        <Button
                            className={`logsIconButton logsFilterButton${filtersExpanded ? " active" : ""}`}
                            imageOnly={true}
                            title="Filter"
                            onClick={this.handleFilterToggle}
                        >
                            <Icon src={Codicon.ListFilter} />
                        </Button>
                        <Button
                            className="logsIconButton logsDoubleIconButton"
                            disabled={firstDisabled}
                            imageOnly={true}
                            title="First Page"
                            onClick={firstDisabled ? undefined : this.handleFirstPage}
                        >
                            <span className="logsDoubleIcon">
                                <Icon src={Codicon.ChevronLeft} />
                                <Icon src={Codicon.ChevronLeft} />
                            </span>
                        </Button>
                        <Button
                            className="logsIconButton"
                            disabled={previousDisabled}
                            imageOnly={true}
                            title="Previous Page"
                            onClick={previousDisabled ? undefined : this.handlePreviousPage}
                        >
                            <Icon src={Codicon.ChevronLeft} />
                        </Button>
                        <Button
                            className="logsIconButton"
                            disabled={nextDisabled}
                            imageOnly={true}
                            title="Next Page"
                            onClick={nextDisabled ? undefined : this.handleNextPage}
                        >
                            <Icon src={Codicon.ChevronRight} />
                        </Button>
                        <Button
                            className="logsIconButton logsDoubleIconButton"
                            disabled={lastDisabled}
                            imageOnly={true}
                            title="Last Page"
                            onClick={lastDisabled ? undefined : this.handleLastPage}
                        >
                            <span className="logsDoubleIcon">
                                <Icon src={Codicon.ChevronRight} />
                                <Icon src={Codicon.ChevronRight} />
                            </span>
                        </Button>
                        <Button
                            className="logsIconButton"
                            imageOnly={true}
                            title="Refresh"
                            onClick={this.handleRefresh}
                        >
                            <Icon src={Codicon.Refresh} />
                        </Button>
                        <Button
                            className="logsIconButton"
                            innerRef={this.actionMenuButtonRef}
                            imageOnly={true}
                            title="Show Action Menu"
                            data-tooltip="Show Action Menu"
                            onClick={this.handleShowActionMenu}
                        >
                            <Icon src={Codicon.Ellipsis} data-tooltip="inherit" />
                        </Button>
                    </div>
                    {isLogTruncated && <div id="logsTruncationNotice">
                        Only the last 1 GiB of this error log is shown.
                    </div>}
                    {filtersExpanded && this.renderFilterEditor()}
                    {this.renderTable(rows)}
                    {this.actionMenu()}
                    {this.logRowContextMenu()}
                </AdministrationPageBody>
            </AdministrationPageFrame>
        );
    }

    private sourceLabel(source: LogSource, logPath: string): string {
        switch (source) {
            case "table":
                return "Showing logs from performance_schema.error_log";
            case "file":
                return logPath ? `Showing logs from ${logPath}` : "Showing logs from the error log file";
            case "unavailable":
                return "Error log source unavailable";
            case "none":
            default:
                return "No error log source selected";
        }
    }

    private priorityClass(priority: string): "warning" | "error" | undefined {
        switch (priority.toLowerCase()) {
            case "warning":
                return "warning";
            case "error":
                return "error";
            default:
                return undefined;
        }
    }

    private renderFilterEditor(): ComponentChild {
        const { draftFilters, errorCodeValues, subsystemValues } = this.state;

        return (
            <div id="logsFilterEditor">
                <div className="logsFilterField">
                    <span>Timestamp</span>
                    <select
                        value={draftFilters.timestamp}
                        onChange={this.handleTimestampFilterChange}
                    >
                        <option value="1h">Since 1h ago</option>
                        <option value="2h">Since 2h ago</option>
                        <option value="4h">Since 4h ago</option>
                        <option value="8h">Since 8h ago</option>
                        <option value="12h">Since 12h ago</option>
                        <option value="1d">Since 1 day</option>
                        <option value="2d">Since 2 days</option>
                        <option value="1w">Since 1 week</option>
                        <option value="1m">Since 1 month</option>
                        <option value="1y">Since 1 year</option>
                        <option value="all">All</option>
                    </select>
                </div>
                <div className="logsFilterField">
                    <span>Priority</span>
                    {this.renderCheckboxDropdown("Priority", "priority", ["Error", "Warning", "System", "Note"])}
                </div>
                <div className="logsFilterField">
                    <span>Error Code</span>
                    {this.renderCheckboxDropdown("Error Code", "errorCode", errorCodeValues)}
                </div>
                <div className="logsFilterField">
                    <span>Subsystem</span>
                    {this.renderCheckboxDropdown("Subsystem", "subsystem", subsystemValues)}
                </div>
                <div className="logsFilterField">
                    <span>Message</span>
                    <input
                        type="text"
                        value={draftFilters.message}
                        onInput={this.handleMessageFilterChange}
                    />
                </div>
                <div id="logsFilterActions">
                    <Button
                        className="logsFilterActionButton"
                        onClick={this.handleFilterReset}
                    >
                        Reset
                    </Button>
                    <Button
                        className="logsFilterActionButton primary"
                        onClick={this.handleFilterApply}
                    >
                        Apply
                    </Button>
                    <Button
                        className="logsFilterActionButton logsFilterMatchButton"
                        title="Previous Match"
                        onClick={this.handlePreviousMatch}
                    >
                        <Icon src={Codicon.ChevronUp} />
                    </Button>
                    <Button
                        className="logsFilterActionButton logsFilterMatchButton"
                        title="Next Match"
                        onClick={this.handleNextMatch}
                    >
                        <Icon src={Codicon.ChevronDown} />
                    </Button>
                </div>
            </div>
        );
    }

    private renderCheckboxDropdown(label: string, menu: MultiChoiceFilter, values: string[]): ComponentChild {
        const isOpen = this.state.openFilterMenu === menu;
        const selection = this.state.draftFilters.selections[menu];

        return (
            <div className={`logsFilterDropdown${isOpen ? " open" : ""}`}>
                <Button
                    className="logsFilterDropdownButton"
                    title={`${label} Filter`}
                    onClick={() => {
                        this.handleFilterMenuToggle(menu);
                    }}
                >
                    <span>{this.filterSelectionLabel(selection)}</span>
                    <Icon src={Codicon.ChevronDown} />
                </Button>
                {isOpen && (
                    <div className="logsFilterDropdownMenu">
                        {this.renderCheckboxGroup(menu, values, selection)}
                    </div>
                )}
            </div>
        );
    }

    private renderCheckboxGroup(menu: MultiChoiceFilter, values: string[], selection: string[]): ComponentChild {
        return (
            <div className="logsFilterChoices">
                {values.map((value) => {
                    return (
                        <label key={value} className="logsFilterChoice">
                            <input
                                checked={selection.includes(value)}
                                type="checkbox"
                                value={value}
                                onChange={(event) => {
                                    this.handleFilterSelectionChange(menu, value, event.currentTarget.checked);
                                }}
                            />
                            <span>{value}</span>
                        </label>
                    );
                })}
            </div>
        );
    }

    private filterSelectionLabel(selection: string[]): string {
        if (selection.length === 0) {
            return "All";
        }

        if (selection.length === 1) {
            return selection[0];
        }

        return `${selection.length} selected`;
    }

    private renderTable(rows: IErrorLogFileRow[]): ComponentChild {
        const { error } = this.state;

        if (error) {
            return <div id="logsEmptyState">{error}</div>;
        }

        if (rows.length === 0) {
            return <div id="logsEmptyState">No error log entries to display.</div>;
        }

        return (
            <div id="logsTableHost">
                <TreeGrid
                    id="logsTable"
                    ref={this.logTableRef}
                    height="100%"
                    options={{
                        index: "line",
                        layout: "fitDataFill",
                        selectionType: SelectionType.Multi,
                    }}
                    columns={this.logColumns()}
                    tableData={rows}
                    onFormatRow={this.formatLogRow}
                    onRowContext={this.handleLogRowContext}
                />
            </div>
        );
    }

    private logColumns = (): ColumnDefinition[] => {
        return [{
            title: "Timestamp",
            field: "logged",
            width: 210,
            formatter: this.logTimestampCellFormatter,
        }, {
            title: "Priority",
            field: "prio",
            width: 88,
            formatter: this.logCellFormatter,
        }, {
            title: "Error Code",
            field: "errorCode",
            width: 112,
            formatter: this.logCellFormatter,
        }, {
            title: "Subsystem",
            field: "subsystem",
            width: 118,
            formatter: this.logCellFormatter,
        }, {
            title: "Message",
            field: "data",
            minWidth: 220,
            widthGrow: 1,
            formatter: this.logMessageCellFormatter,
        }];
    };

    private logCellFormatter = (cell: CellComponent): HTMLElement => {
        const element = document.createElement("span");
        element.textContent = this.toDisplayString(cell.getValue());

        return element;
    };

    private logTimestampCellFormatter = (cell: CellComponent): HTMLElement => {
        const element = document.createElement("span");
        element.textContent = this.formatLogged(this.toDisplayString(cell.getValue()));

        return element;
    };

    private logMessageCellFormatter = (cell: CellComponent): HTMLElement => {
        const element = document.createElement("span");
        const message = this.toDisplayString(cell.getValue());
        element.className = "logMessage";
        element.dataset.tooltip = message;
        element.textContent = message.length > errorLogMessagePreviewLength
            ? `${message.slice(0, errorLogMessagePreviewLength)}…`
            : message;

        return element;
    };

    private formatLogRow = (row: RowComponent): void => {
        const data = row.getData() as ILogRow;
        const element = row.getElement();
        const priorityClass = this.priorityClass(data.prio);

        element.classList.toggle("priority-warning", priorityClass === "warning");
        element.classList.toggle("priority-error", priorityClass === "error");
        element.classList.toggle("highlighted", data.line === this.highlightedRowLine);
    };

    private loadInitialPage = async (): Promise<void> => {
        await this.loadPage(0, true);
    };

    private loadPage = async (page: number, useDefaultPage = false): Promise<void> => {
        const { backend, offline } = this.props;
        if (offline) {
            await this.loadFilePage(page, useDefaultPage, true);

            return;
        }

        const request = ++this.loadRequest;

        if (!backend) {
            this.highlightedRowLine = undefined;
            this.setState({
                loading: false,
                source: "none",
                error: "No backend session is available.",
                page,
                totalPages: 1,
                hasNext: false,
                logPath: "",
                isLogTruncated: false,
                errorCodeValues: [],
                subsystemValues: [],
                sourceRows: [],
            });

            return;
        }

        this.setState({ loading: true, error: undefined });

        try {
            await this.loadTablePage(page, request);
        } catch (reason) {
            if (request !== this.loadRequest) {
                return;
            }
            if (isLocalLogTarget(this.props.connectionDetails)) {
                await this.loadFilePage(page, useDefaultPage, true);
            } else {
                this.highlightedRowLine = undefined;
                this.setState({
                    loading: false,
                    source: "unavailable",
                    error: convertErrorToString(reason),
                    page,
                    totalPages: 1,
                    hasNext: false,
                    logPath: "",
                    isLogTruncated: false,
                    errorCodeValues: [],
                    subsystemValues: [],
                    sourceRows: [],
                });
            }
        }
    };

    private loadTablePage = async (page: number, request: number): Promise<void> => {
        const { backend } = this.props;
        const offset = page * errorLogPageSize;
        const filter = this.tableFilter(this.state.appliedFilters);
        const countResult = await backend?.executeService(
            `SELECT COUNT(*) FROM performance_schema.error_log${filter.where}`,
            filter.params,
        );
        const totalRows = this.resultNumber(countResult?.rows);
        const totalPages = this.totalPages(totalRows);
        const errorCodeValues = await this.loadTableDistinctValues("ERROR_CODE");
        const subsystemValues = await this.loadTableSubsystemValues();
        const lastPage = Math.max(0, totalPages - 1);
        if (page > lastPage) {
            await this.loadTablePage(lastPage, request);

            return;
        }

        const result = await backend?.executeService(
            `SELECT LOGGED, THREAD_ID, PRIO, ERROR_CODE, SUBSYSTEM, DATA, UNIX_TIMESTAMP(LOGGED) ` +
            `FROM performance_schema.error_log${filter.where} ORDER BY LOGGED DESC ` +
            `LIMIT ${errorLogTablePageSize} OFFSET ${offset}`,
            filter.params,
        );
        const sourceRows = result?.rows ?? [];
        const rows = sourceRows.slice(0, errorLogPageSize).map((row, index) => {
            const values = Array.isArray(row) ? row : [];

            return {
                line: offset + index + 1,
                logged: this.formatLogged(this.toDisplayString(values[0])),
                timestamp: Number(values[6]),
                threadId: this.toDisplayString(values[1]),
                prio: this.toDisplayString(values[2]),
                errorCode: this.toDisplayString(values[3]),
                subsystem: this.toDisplayString(values[4]),
                data: this.toDisplayString(values[5]),
            };
        });

        if (request !== this.loadRequest) {
            return;
        }
        this.highlightedRowLine = undefined;
        this.setState({
            loading: false,
            source: "table",
            error: undefined,
            page,
            totalPages,
            hasNext: page < lastPage || sourceRows.length > errorLogPageSize,
            logPath: "",
            isLogTruncated: false,
            errorCodeValues,
            subsystemValues,
            sourceRows: rows,
        });
    };

    private loadFilePage = async (page: number, useDefaultPage = false, noOtherSource = false): Promise<void> => {
        const request = ++this.loadRequest;
        const { backend, connectionDetails } = this.props;
        this.setState({ loading: true, error: undefined });
        if (!backend || !connectionDetails || !isLocalLogTarget(connectionDetails)) {
            this.highlightedRowLine = undefined;
            this.setState({
                loading: false,
                source: "unavailable",
                error: "Local file access is unavailable for this target.",
                page,
                totalPages: 1,
                hasNext: false,
                logPath: "",
                isLogTruncated: false,
                errorCodeValues: [],
                subsystemValues: [],
                sourceRows: [],
            });

            return;
        }

        try {
            const filters = this.errorLogFilters(this.state.appliedFilters);
            const result = filters
                ? await backend.readErrorLogFilePage(page, errorLogPageSize, filters)
                : await backend.readErrorLogFilePage(page, errorLogPageSize);
            if (request !== this.loadRequest) {
                return;
            }
            if (useDefaultPage && result) {
                const lastPage = Math.max(0, result.totalPages - 1);
                if (lastPage !== page) {
                    await this.loadFilePage(lastPage, false, noOtherSource);

                    return;
                }
            }

            this.highlightedRowLine = undefined;
            this.setState({
                loading: false,
                source: result || !noOtherSource ? "file" : "unavailable",
                error: result ? undefined : noOtherSource
                    ? noSupportedErrorLogSourcesMessage
                    : "Error log data is not available.",
                page,
                totalPages: result?.totalPages ?? 1,
                hasNext: result?.hasNext ?? false,
                logPath: result?.path ?? "",
                isLogTruncated: result?.isTruncated ?? false,
                errorCodeValues: result?.errorCodeValues ?? [],
                subsystemValues: result?.subsystemValues ?? [],
                sourceRows: result?.rows ?? [],
            });
        } catch (reason) {
            if (request !== this.loadRequest) {
                return;
            }
            this.highlightedRowLine = undefined;
            this.setState({
                loading: false,
                source: "unavailable",
                error: convertErrorToString(reason),
                page,
                totalPages: 1,
                hasNext: false,
                logPath: "",
                isLogTruncated: false,
                errorCodeValues: [],
                subsystemValues: [],
                sourceRows: [],
            });
        }
    };

    private loadTableSubsystemValues = async (): Promise<string[]> => {
        return this.loadTableDistinctValues("SUBSYSTEM");
    };

    private loadTableDistinctValues = async (column: "ERROR_CODE" | "SUBSYSTEM"): Promise<string[]> => {
        const { backend } = this.props;
        const result = await backend?.executeService(
            `SELECT DISTINCT ${column} FROM performance_schema.error_log `
            + `WHERE ${column} IS NOT NULL ORDER BY ${column}`,
        );

        return (result?.rows ?? []).flatMap((row) => {
            if (!Array.isArray(row)) {
                return [];
            }

            const value = this.toDisplayString(row[0]);

            return value ? [value] : [];
        });
    };

    private filterRows(rows: ILogRow[], filters: ILogFilters): ILogRow[] {
        const minTimestamp = filters.minTimestamp;
        const message = filters.message.trim().toLowerCase();

        return rows.filter((row) => {
            if (minTimestamp !== undefined) {
                const logged = row.timestamp ?? Date.parse(row.logged) / 1000;
                if (!Number.isFinite(logged) || logged < minTimestamp) {
                    return false;
                }
            }

            if (filters.selections.priority.length > 0
                && !filters.selections.priority.some((priority) => {
                    return priority.toLowerCase() === row.prio.toLowerCase();
                })) {
                return false;
            }

            if (filters.selections.errorCode.length > 0
                && !filters.selections.errorCode.includes(row.errorCode)) {
                return false;
            }

            if (filters.selections.subsystem.length > 0
                && !filters.selections.subsystem.includes(row.subsystem)) {
                return false;
            }

            return !message || row.data.toLowerCase().includes(message);
        });
    }

    private errorLogFilters(filters: ILogFilters): IErrorLogFilters | undefined {
        const result: IErrorLogFilters = {};
        const minTimestamp = filters.minTimestamp;
        if (minTimestamp !== undefined) {
            result.minTimestamp = minTimestamp;
        }
        if (filters.selections.priority.length > 0) {
            result.priorities = filters.selections.priority;
        }
        if (filters.selections.errorCode.length > 0) {
            result.errorCodes = filters.selections.errorCode;
        }
        if (filters.selections.subsystem.length > 0) {
            result.subsystems = filters.selections.subsystem;
        }

        const message = filters.message.trim();
        if (message) {
            result.message = message;
        }

        return Object.keys(result).length > 0 ? result : undefined;
    }

    private tableFilter(filters: ILogFilters): { where: string; params: unknown[] } {
        const clauses: string[] = [];
        const params: unknown[] = [];
        const values = this.errorLogFilters(filters);
        if (values?.minTimestamp !== undefined) {
            clauses.push("LOGGED >= FROM_UNIXTIME(?)");
            params.push(values.minTimestamp);
        }

        const addSelections = (column: string, selections?: string[]): void => {
            if (selections && selections.length > 0) {
                clauses.push(`${column} IN (${selections.map(() => {
                    return "?";
                }).join(", ")})`);
                params.push(...selections);
            }
        };
        addSelections("PRIO", values?.priorities);
        addSelections("ERROR_CODE", values?.errorCodes);
        addSelections("SUBSYSTEM", values?.subsystems);
        if (values?.message) {
            clauses.push("INSTR(LOWER(DATA), LOWER(?)) > 0");
            params.push(values.message);
        }

        return {
            where: clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "",
            params,
        };
    }

    private navigateMatch(direction: 1 | -1): void {
        const matches = this.filterRows(this.state.sourceRows, {
            ...this.state.draftFilters,
            minTimestamp: this.minimumTimestamp(this.state.draftFilters.timestamp),
        });
        if (matches.length === 0) {
            this.highlightedRowLine = undefined;
            this.updateHighlightedRows();

            return;
        }

        const currentIndex = matches.findIndex((row) => {
            return row.line === this.highlightedRowLine;
        });
        const nextIndex = currentIndex === -1
            ? (direction === 1 ? 0 : matches.length - 1)
            : Math.min(Math.max(currentIndex + direction, 0), matches.length - 1);
        const row = matches[nextIndex];

        this.highlightedRowLine = row.line;
        this.updateHighlightedRows(row.line);
    }

    private updateHighlightedRows = (line?: number): void => {
        // TreeGrid updates its rows asynchronously after filter controls redraw this component.
        setTimeout(() => {
            this.logTableRef.current?.getRows().forEach(this.formatLogRow);
            if (line !== undefined) {
                this.scrollHighlightedRowIntoView(line);
            }
        });
    };

    private scrollHighlightedRowIntoView(line: number): void {
        const table = this.logTableRef.current;
        const row = table?.getRow(line);

        if (table && row) {
            void table.scrollToRow(row);
        }
    }

    private minimumTimestamp(filter: string): number | undefined {
        const intervals: Partial<Record<string, number>> = {
            "1h": 60 * 60,
            "2h": 2 * 60 * 60,
            "4h": 4 * 60 * 60,
            "8h": 8 * 60 * 60,
            "12h": 12 * 60 * 60,
            "1d": 24 * 60 * 60,
            "2d": 2 * 24 * 60 * 60,
            "1w": 7 * 24 * 60 * 60,
            "1m": 30 * 24 * 60 * 60,
            "1y": 365 * 24 * 60 * 60,
        };
        const interval = intervals[filter];

        return interval === undefined ? undefined : (Date.now() / 1000) - interval;
    }

    private resultNumber(rows: unknown[] | undefined): number {
        const firstRow = rows?.[0];
        const firstValue: unknown = Array.isArray(firstRow) ? firstRow[0] : undefined;
        const value = Number(firstValue);

        return Number.isFinite(value) && value > 0 ? value : 0;
    }

    private totalPages(totalRows: number): number {
        return Math.max(1, Math.ceil(totalRows / errorLogPageSize));
    }

    private lastPage(): number {
        return Math.max(0, this.state.totalPages - 1);
    }

    private toDisplayString(value: unknown): string {
        if (value === null || value === undefined) {
            return "";
        }

        return String(value);
    }

    private formatLogged(value: string): string {
        return value.replace(/^(\d{4}-\d{2}-\d{2})T/, "$1 ");
    }

    private handleRefresh = (): void => {
        this.setState((state) => {
            return {
                appliedFilters: {
                    ...state.appliedFilters,
                    minTimestamp: this.minimumTimestamp(state.appliedFilters.timestamp),
                },
            };
        }, () => {
            if (this.state.source === "file") {
                void this.loadFilePage(0, true);

                return;
            }

            void this.loadSelectedSourcePage(this.state.page);
        });
    };

    private loadSelectedSourcePage = async (page: number): Promise<void> => {
        if (this.state.source === "file") {
            await this.loadFilePage(page);
        } else {
            await this.loadPage(page);
        }
    };

    private handleFilterToggle = (): void => {
        this.setState((state) => {
            return { filtersExpanded: !state.filtersExpanded, openFilterMenu: undefined };
        });
    };

    private handleFilterMenuToggle = (menu: MultiChoiceFilter): void => {
        this.setState((state) => {
            return { openFilterMenu: state.openFilterMenu === menu ? undefined : menu };
        });
    };

    private handleFilterSelectionChange = (menu: MultiChoiceFilter, value: string, checked: boolean): void => {
        this.setState((state) => {
            const current = state.draftFilters.selections[menu];
            const next = checked
                ? [...current, value]
                : current.filter((entry) => {
                    return entry !== value;
                });

            return {
                draftFilters: {
                    ...state.draftFilters,
                    selections: {
                        ...state.draftFilters.selections,
                        [menu]: next,
                    },
                },
            };
        });
    };

    private handleTimestampFilterChange = (event: Event): void => {
        this.setState((state) => {
            return {
                draftFilters: {
                    ...state.draftFilters,
                    timestamp: (event.currentTarget as HTMLSelectElement).value,
                },
            };
        });
    };

    private handleMessageFilterChange = (event: Event): void => {
        this.setState((state) => {
            return {
                draftFilters: {
                    ...state.draftFilters,
                    message: (event.currentTarget as HTMLInputElement).value,
                },
            };
        });
    };

    private handleFilterReset = (): void => {
        const reload = this.errorLogFilters(this.state.appliedFilters) !== undefined;
        this.highlightedRowLine = undefined;
        this.setState({
            draftFilters: defaultLogFilters(),
            appliedFilters: defaultLogFilters(),
            openFilterMenu: undefined,
        }, () => {
            if (reload) {
                void this.loadSelectedSourcePage(0);
            }
        });
    };

    private handleFilterApply = (): void => {
        this.highlightedRowLine = undefined;
        this.setState((state) => {
            return {
                // Keep the cutoff fixed for every page until Apply or Refresh.
                appliedFilters: {
                    ...state.draftFilters,
                    minTimestamp: this.minimumTimestamp(state.draftFilters.timestamp),
                },
                openFilterMenu: undefined,
            };
        }, () => {
            void this.loadSelectedSourcePage(0);
        });
    };

    private handlePreviousMatch = (): void => {
        this.navigateMatch(-1);
    };

    private handleNextMatch = (): void => {
        this.navigateMatch(1);
    };

    private handleFirstPage = (): void => {
        void this.loadSelectedSourcePage(0);
    };

    private handlePreviousPage = (): void => {
        void this.loadSelectedSourcePage(Math.max(0, this.state.page - 1));
    };

    private handleNextPage = (): void => {
        void this.loadSelectedSourcePage(this.state.page + 1);
    };

    private handleLastPage = (): void => {
        void this.loadSelectedSourcePage(this.lastPage());
    };

    private actionMenu = (): ComponentChild => {
        const { source, logPath, loading } = this.state;
        const showingFile = source === "file";
        const canReadFromLogFile = isLocalLogTarget(this.props.connectionDetails);
        const canToggleLogSource = showingFile
            ? !this.props.offline && this.props.backend !== undefined
            : canReadFromLogFile;
        const canExportLogs = !loading && (source === "table" || (source === "file" && logPath.length > 0));

        return (
            <Menu
                id="logsActionMenu"
                ref={this.actionMenuRef}
                placement={ComponentPlacement.BottomLeft}
                onItemClick={this.handleActionMenuItemClick}
            >
                <MenuItem
                    id="readFromLogFile"
                    command={{ title: showingFile ? "View Error Log Table" : "View Error Log File",
                        command: "readFromLogFile" }}
                    disabled={!canToggleLogSource}
                />
                <MenuItem
                    id="exportLogs"
                    command={{ title: "Export Logs...", command: "exportLogs" }}
                    disabled={!canExportLogs}
                />
            </Menu>
        );
    };

    private logRowContextMenu = (): ComponentChild => {
        return (
            <Menu
                id="logsRowContextMenu"
                ref={this.logRowContextMenuRef}
                onItemClick={this.handleLogRowContextMenuItemClick}
            >
                <MenuItem
                    id="copySelectedLogRows"
                    command={{ title: "Copy Selected Rows", command: "copySelectedLogRows" }}
                />
            </Menu>
        );
    };

    private handleShowActionMenu = (event: MouseEvent | KeyboardEvent): void => {
        event.stopPropagation();

        const target = this.actionMenuButtonRef.current;
        if (!target) {
            return;
        }

        const targetRect = event instanceof KeyboardEvent
            ? target.getBoundingClientRect()
            : this.menuAnchorRect(event.clientX, event.clientY);

        this.actionMenuRef.current?.close();
        this.actionMenuRef.current?.open(targetRect, event instanceof KeyboardEvent);
    };

    private menuAnchorRect = (x: number, y: number, width = 2, height = 2): DOMRect => {
        return {
            x,
            y,
            width,
            height,
            left: x,
            top: y,
            right: x + width,
            bottom: y + height,
            toJSON: () => {
                return { x, y, width, height };
            },
        } as DOMRect;
    };

    private handleActionMenuItemClick = (props: IMenuItemProperties): boolean => {
        switch (props.command.command) {
            case "readFromLogFile":
                if (this.state.source === "file") {
                    void this.loadPage(0, true);
                } else {
                    void this.loadFilePage(0, true);
                }
                break;
            case "exportLogs":
                this.openExportDialog();
                break;
            default:
        }

        return true;
    };

    private handleLogRowContext = (event: Event, row: RowComponent): void => {
        event.preventDefault();

        const table = this.logTableRef.current;
        if (!table) {
            return;
        }

        const selectedRows = table.getSelectedRows();
        if (!selectedRows.includes(row)) {
            table.deselectRow();
            row.select();
        }

        if (event instanceof MouseEvent) {
            this.logRowContextMenuRef.current?.open(this.menuAnchorRect(event.clientX, event.clientY), false);
        }
    };

    private handleLogRowContextMenuItemClick = (props: IMenuItemProperties): boolean => {
        if (props.command.command === "copySelectedLogRows") {
            const table = this.logTableRef.current;
            if (!table) {
                return true;
            }

            const selectedRows = new Set(table.getSelectedRows());
            const rows = table.getRows().filter((row) => {
                return selectedRows.has(row);
            }).map((row) => {
                return row.getData() as ILogRow;
            });
            const text = rows.map((row) => {
                return [this.formatLogged(row.logged), row.prio, row.errorCode, row.subsystem, row.data].join("\t");
            }).join("\n");
            requisitions.writeToClipboard(text);
        }

        return true;
    };

    private openExportDialog = (): void => {
        const source = this.state.source;
        if (source !== "file" && source !== "table") {
            return;
        }

        this.pendingExportSource = source;
        const opened = requisitions.executeRemote("showSaveDialog", {
            id: this.exportResourceId,
            title: "Export Error Logs",
            saveLabel: "Export",
            default: defaultErrorLogExportFileName(this.props.connectionDetails),
            filters: { "Error Log": ["log", "txt"] },
        });
        if (!opened) {
            this.pendingExportSource = undefined;
            void ui.showErrorMessage("Saving logs is unavailable in this environment.", {});
        }
    };

    private selectFile = async (fileResult: IOpenFileDialogResult): Promise<boolean> => {
        if (fileResult.resourceId !== this.exportResourceId) {
            return false;
        }

        const source = this.pendingExportSource;
        this.pendingExportSource = undefined;
        const targetPath = fileResult.file[0]?.path;
        if (!source || !targetPath) {
            return false;
        }

        try {
            if (source === "file") {
                const backend = this.props.backend;
                if (!backend) {
                    throw new Error("No backend session is available.");
                }

                await backend.exportErrorLogFile(targetPath);
            } else {
                const backend = this.props.backend;
                if (!backend) {
                    throw new Error("No backend session is available.");
                }

                await backend.exportErrorLogs(targetPath);
            }

            void ui.showInformationMessage("Logs exported successfully.", {});
        } catch (reason) {
            void ui.showErrorMessage(`Unable to export logs: ${convertErrorToString(reason)}`, {});
        }

        return true;
    };
}
