/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import commitIcon from "../../assets/images/toolbar/toolbar-commit.svg";
import gridIcon from "../../assets/images/toolbar/toolbar-grid.svg";
import maximizeIcon from "../../assets/images/toolbar/toolbar-maximize.svg";
import menuIcon from "../../assets/images/toolbar/toolbar-menu.svg";
import normalizeIcon from "../../assets/images/toolbar/toolbar-normalize.svg";
import nextPageIcon from "../../assets/images/toolbar/toolbar-page_next.svg";
import previousPageIcon from "../../assets/images/toolbar/toolbar-page_previous.svg";
import rollbackIcon from "../../assets/images/toolbar/toolbar-rollback.svg";

import editIcon from "../../assets/images/toolbar/toolbar-edit.svg";
import previewIcon from "../../assets/images/toolbar/toolbar-preview.svg";

import { ComponentChild, createRef } from "preact";

import { DialogHost } from "../../app-logic/DialogHost.js";
import {
    DialogResponseClosure, DialogType, IColumnInfo, IStatusInfo, MessageType, defaultValues, type ISqlUpdateResult,
} from "../../app-logic/general-types.js";
import { IResultSet, IResultSetRows, IResultSets } from "../../script-execution/index.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import { IScriptRequest } from "../../supplement/index.js";
import { uuid } from "../../utilities/helpers.js";
import { formatWithNumber } from "../../utilities/string-helpers.js";
import { Button } from "../ui/Button/Button.js";
import {
    ComponentBase, ComponentPlacement, IComponentProperties, IComponentState,
} from "../ui/Component/ComponentBase.js";
import { Container, Orientation } from "../ui/Container/Container.js";
import { Divider } from "../ui/Divider/Divider.js";
import { Dropdown } from "../ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../ui/Dropdown/DropdownItem.js";
import { Icon } from "../ui/Icon/Icon.js";
import { Label } from "../ui/Label/Label.js";
import { Menu } from "../ui/Menu/Menu.js";
import { IMenuItemProperties, MenuItem } from "../ui/Menu/MenuItem.js";
import { SQLPreview } from "../ui/SQLPreview/SQLPreview.js";
import { ITabviewPage, TabPosition, Tabview } from "../ui/Tabview/Tabview.js";
import { Toolbar } from "../ui/Toolbar/Toolbar.js";
import { ActionOutput } from "./ActionOutput.js";
import { QueryBuilder } from "./QueryBuilder.js";
import { ResultStatus } from "./ResultStatus.js";
import { IResultCellChange, ResultRowChanges, ResultView } from "./ResultView.js";

/** All the current changes for a result set. */
interface IEditingInfo {
    /** Text that can be shown when asking the user for confirmation of commit or rollback of this set of changes. */
    description: string;

    statusInfo: IStatusInfo;

    /** The result set being edited. */
    resultSet: IResultSet;

    /** A record for each row that has changes. */
    rowChanges: ResultRowChanges;

    /** If true, show the SQL preview instead of the result grid. */
    previewActive: boolean;

    /**
     * Set when the last commit action resulted in an error.
     * Only one index is set in this (sparse) array, which is the index of the statement that caused the error.
     */
    errors?: string[];

    /** Set when the user navigates from the preview pane back to the grid by clicking a change line. */
    selectedRowIndex?: number;
}

interface IResultTabViewProperties extends IComponentProperties {
    /** One set per tab page. */
    resultSets: IResultSets;

    /** The ID of the executing context for this result view. */
    contextId: string;

    /** Which of the result sets is currently selected? */
    currentSet?: number;

    /** Where to show the toggle state button. */
    showMaximizeButton: "never" | "tab" | "statusBar";

    /** When to hide the tab area? */
    hideTabs: "never" | "single" | "always";

    /** When set to true show only the selected result set. */
    showMaximized?: boolean;

    onResultPageChange?: (resultId: string, currentPage: number, sql: string) => void;
    onToggleResultPaneViewState?: () => void;
    onSelectTab?: (index: number) => void;

    /**
     * Called when changed result set data must be written to the application store and sent to the server.
     * @returns An error message or the number of affected rows if the update was successful.
     */
    onCommitChanges?: (resultSet: IResultSet, updateSql: string[]) => Promise<ISqlUpdateResult>;

    /** Called when the user wants to rollback all changes. */
    onRollbackChanges?: (resultSet: IResultSet) => void;

    onRemoveResult?: (resultId: string) => void;
}

interface IResultTabViewState extends IComponentState {
    /** Set to true when a result set was selected by the user. */
    manualTab: boolean;

    currentResultSet?: IResultSet;
}

/** Holds a collection of result views and other output in a tabbed interface. */
export class ResultTabView extends ComponentBase<IResultTabViewProperties, IResultTabViewState> {

    private actionMenuRef = createRef<Menu>();

    // React refs to the used ResultView instances, keyed by the result ID for the result set.
    private viewRefs = new Map<string, preact.RefObject<ResultView>>();

    // Keeps the top row index for each result set, keyed by the result ID.
    private topRowIndexes = new Map<string, number>();

    /** The number of updated rows during the last commit action. */
    #affectedRows: Map<string, number> = new Map();

    /** All value changes per result set. */
    #editingInfo: Map<string, IEditingInfo> = new Map();

    public constructor(props: IResultTabViewProperties) {
        super(props);

        this.state = {
            manualTab: false,
            currentResultSet: props.resultSets.sets.length > 0 ? props.resultSets.sets[0] : undefined,
        };

        this.addHandledProperties("resultSets", "contextId", "currentSet", "showMaximizeButton", "hideTabs",
            "showMaximized",
            "onResultPageChange", "onToggleResultPaneViewState", "onSelectTab");
    }

    public static override getDerivedStateFromProps(newProps: IResultTabViewProperties,
        oldState: IResultTabViewState): Partial<IResultTabViewState> {

        const { currentSet, resultSets } = newProps;
        const { manualTab, currentResultSet } = oldState;

        if (manualTab) {
            return {
                manualTab: false,
            };
        }

        if (resultSets.sets.length === 0) {
            return {
                currentResultSet: undefined,
            };
        }

        // If a current set is specified, select that. Otherwise keep what was selected before, if it still exists.
        if (currentSet !== undefined) {
            // Convert the tab index into a value used to select a specific tab.
            let currentResultSet;
            if (currentSet > 0) { // Index 0 is the output page.
                currentResultSet = (currentSet - 1) < resultSets.sets.length
                    ? resultSets.sets[currentSet - 1]
                    : resultSets.sets[resultSets.sets.length - 1];
            }

            return {
                currentResultSet,
            };
        }

        const found = resultSets.sets.find((candidate) => {
            return candidate === currentResultSet;
        });

        if (found) {
            return {
            };
        }

        return {
            currentResultSet: resultSets.sets.length > 0 ? newProps.resultSets.sets[0] : undefined,
        };
    }

    public render(): ComponentChild {
        const { resultSets, contextId, hideTabs, showMaximizeButton, showMaximized } = this.props;
        const { currentResultSet } = this.state;

        const className = this.getEffectiveClassNames(["resultHost"]);

        this.viewRefs.clear();

        const pages: ITabviewPage[] = [];

        if (resultSets?.output && resultSets.output.length > 0) {
            pages.push({
                id: "output",
                caption: `Output`,
                content: (
                    <ActionOutput
                        output={resultSets.output}
                        contextId={contextId}
                        showIndexes={resultSets.sets.length > 0 || resultSets.output.length > 1}
                    />
                ),
            });
        }

        const toggleStateButton = <Button
            id="toggleStateButton"
            imageOnly={true}
            data-tooltip="Maximize Result Tab"
            onClick={this.handleResultToggle}
        >
            <Icon src={showMaximized ? normalizeIcon : maximizeIcon} data-tooltip="inherit" />
        </Button>;

        const currentEditingInfo = this.#editingInfo.get(currentResultSet?.resultId ?? "");
        const editModeActive = currentEditingInfo !== undefined;

        const updatable = currentResultSet?.updatable ?? false;

        resultSets.sets.forEach((resultSet: IResultSet, index) => {
            const editingInfo = this.#editingInfo.get(resultSet?.resultId ?? "");
            const editModeActive = editingInfo !== undefined;

            const ref = createRef<ResultView>();
            this.viewRefs.set(resultSet.resultId, ref);

            let topRowIndex = this.topRowIndexes.get(resultSet.resultId);
            const selectedRowIndex = editingInfo?.selectedRowIndex;
            if (selectedRowIndex !== undefined) {
                topRowIndex = selectedRowIndex;
            }

            if (!showMaximized || resultSet === currentResultSet) {
                let caption;
                if (resultSet.index !== undefined) {
                    caption = `Result #${resultSet.index + 1}`;
                } else {
                    caption = `Result #${index + 1}`;
                }

                if (resultSet.subIndex !== undefined) {
                    caption += `.${resultSet.subIndex + 1}`;
                }

                let content;
                if (resultSet === currentResultSet && editingInfo?.previewActive) {
                    content = (
                        <SQLPreview
                            statements={this.generateStatements(editingInfo)}
                            errors={editingInfo.errors}
                            onStatementClick={this.handleStatementClick}
                        />
                    );
                } else {
                    content = (
                        <ResultView
                            ref={ref}
                            topRowIndex={topRowIndex}
                            selectRow={selectedRowIndex}
                            resultSet={resultSet}
                            editable={updatable}
                            rowChanges={editingInfo?.rowChanges}
                            editModeActive={editModeActive}
                            onFieldEditStart={this.onFieldEditStart}
                            onFieldEdited={this.onFieldEdited}
                            onFieldEditCancel={this.onFieldEditCancel}
                            onToggleRowDeletionMarks={this.onToggleRowDeletionMarks}
                            onVerticalScroll={this.onVerticalScroll}
                            onAction={this.onAction}
                        />
                    );
                }


                pages.push({
                    id: resultSet.resultId,
                    caption,
                    auxiliary: showMaximizeButton === "tab" && toggleStateButton,
                    content,
                });
            }
        });

        // Show editing information if we have it, otherwise use the execution info.
        let statusInfo = currentEditingInfo?.statusInfo;
        if (!statusInfo) {
            if (currentResultSet && this.#affectedRows.has(currentResultSet.resultId)) {
                const affectedRows = this.#affectedRows.get(currentResultSet.resultId)!;
                const rowText = formatWithNumber("row", affectedRows);
                statusInfo = {
                    text: `${rowText} updated`,
                };
            } else if (currentResultSet?.data.executionInfo) {
                statusInfo = currentResultSet?.data.executionInfo;
            }
        }

        const currentPage = currentResultSet?.data.currentPage ?? 0;
        const hasMorePages = currentResultSet?.data.hasMoreRows ?? false;

        const gotError = statusInfo && statusInfo.type === MessageType.Error;
        const gotResponse = statusInfo && statusInfo.type === MessageType.Response;

        const editButtonTooltip = updatable ? (editModeActive ? "Editing" : "Start Editing") : "Data not editable";

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
            >
                <Tabview
                    className="resultTabview"
                    stretchTabs={false}
                    hideSingleTab={hideTabs === "single"}
                    showTabs={hideTabs !== "always"}
                    selectedId={currentResultSet?.resultId ?? "output"}
                    tabPosition={TabPosition.Top}
                    pages={pages}
                    canReorderTabs={true}

                    onSelectTab={this.handleTabSelection}
                />
                {
                    statusInfo && <ResultStatus statusInfo={statusInfo}>
                        {
                            !gotError && !gotResponse && <Toolbar dropShadow={false} >
                                <Label className="autoHide">View:</Label>
                                <Dropdown
                                    id="viewStyleDropDown"
                                    selection={currentEditingInfo?.previewActive ? "preview" : "grid"}
                                    iconOnly={true}
                                    data-tooltip="Select a View Section for the Result Set"
                                    onSelect={this.selectViewStyle}
                                >
                                    <DropdownItem
                                        id="grid"
                                        caption="Data Grid"
                                        picture={<Icon src={gridIcon} data-tooltip="inherit" />}
                                    />
                                    <DropdownItem
                                        id="preview"
                                        caption="Preview Changes"
                                        picture={<Icon src={previewIcon} data-tooltip="inherit" />}
                                        disabled={!currentEditingInfo}
                                    />
                                </Dropdown>
                                <Divider vertical={true} />
                                <Label className="autoHide">Pages:</Label>
                                <Button
                                    id="previousPageButton"
                                    imageOnly={true}
                                    disabled={currentPage === 0}
                                    data-tooltip="Previous Page"
                                    onClick={this.previousPage}
                                >
                                    <Icon src={previousPageIcon} data-tooltip="inherit" />
                                </Button>
                                <Button
                                    id="nextPageButton"
                                    imageOnly={true}
                                    disabled={!hasMorePages}
                                    data-tooltip="Next Page"
                                    onClick={this.nextPage}
                                >
                                    <Icon src={nextPageIcon} data-tooltip="inherit" />
                                </Button>
                                <Divider vertical={true} />
                                <Label className="autoHide">Edit:</Label>
                                <Button
                                    id="editButton"
                                    imageOnly={true}
                                    disabled={!updatable || editModeActive}
                                    data-tooltip={editButtonTooltip}
                                    onClick={this.startEditingFirstField}
                                >
                                    <Icon src={editIcon} data-tooltip="inherit" />
                                </Button>
                                <Button
                                    id="previewButton"
                                    imageOnly={true}
                                    disabled={!currentEditingInfo}
                                    data-tooltip="Preview Changes"
                                    onClick={this.previewChanges}
                                >
                                    <Icon src={previewIcon} data-tooltip="inherit" />
                                </Button>
                                <Button
                                    id="applyButton"
                                    imageOnly={true}
                                    disabled={!currentEditingInfo}
                                    data-tooltip="Apply Changes"
                                    onClick={() => { return this.commitChanges(); }}
                                >
                                    <Icon src={commitIcon} data-tooltip="inherit" />
                                </Button>
                                <Button
                                    id="rollbackButton"
                                    imageOnly={true}
                                    disabled={!currentEditingInfo}
                                    data-tooltip="Rollback Changes"
                                    onClick={this.cancelEditingAndRollbackChanges}
                                >
                                    <Icon src={rollbackIcon} data-tooltip="inherit" />
                                </Button>
                                <Divider id="editSeparator" vertical={true} />
                                {showMaximizeButton === "statusBar" && toggleStateButton}
                                {showMaximizeButton === "statusBar" && <Divider vertical={true} />}
                                <Button
                                    id="showActionMenu"
                                    imageOnly={true}
                                    data-tooltip="Show Action Menu"
                                    onClick={this.showActionMenu}
                                >
                                    <Icon src={menuIcon} data-tooltip="inherit" />
                                </Button>
                            </Toolbar>
                        }
                    </ResultStatus>
                }

                <Menu
                    id="actionMenu"
                    ref={this.actionMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleActionMenuItemClick}
                >
                    <MenuItem
                        id="closeMenuItem"
                        command={{ title: "Close Result Set", command: "closeMenuItem" }}
                    />
                    <MenuItem
                        id="separator1"
                        command={{ title: "-", command: "" }}
                        disabled
                    />
                    <MenuItem
                        id="exportMenuItem"
                        command={{ title: "Export Result Set", command: "exportMenuItem" }}
                        disabled
                    />
                    <MenuItem
                        id="importMenuItem"
                        command={{ title: "Import Result Set", command: "importMenuItem" }}
                        disabled
                    />
                </Menu>

            </Container >
        );
    }

    /**
     * Ask the user for confirmation if there are any pending changes.
     *
     * @returns true if the user can close the tab, false otherwise.
     */
    public async canClose(): Promise<boolean> {
        // Store values in a separate array before iterating over them -
        // they may be removed from #editingInfo map by the time the user confirms the operation.
        const infoValues = [...this.#editingInfo.values()];
        for (const info of infoValues) {
            const ok = await this.confirmCommitOrRollback(info);

            if (!ok) {
                return false;
            }
        }

        return true;
    }

    /**
     * Triggers a column update in the group which belongs to the given request id.
     *
     * @param resultId The actual request ID which identifies a specific result group.
     * @param columns The columns to set.
     */
    public async updateColumns(resultId: string, columns: IColumnInfo[]): Promise<void> {
        const viewRef = this.viewRefs.get(resultId);

        /* istanbul ignore next */
        if (viewRef && viewRef.current) {
            await viewRef.current.updateColumns(columns);
        }
    }

    /**
     * In order to update large result sets without re-rendering everything we use direct methods
     * to add new data.
     *
     * @param newData The data to add.
     * @param resultId The ID of the request for which the incoming data is destined to.
     * @param replace If true, the new data will actually replace the current content.
     *
     * @returns A promise the resolves when the operation is complete.
     */
    public async addData(newData: IResultSetRows, resultId: string, replace = false): Promise<void> {
        const viewRef = this.viewRefs.get(resultId);

        /* istanbul ignore next */
        if (viewRef && viewRef.current) {
            await viewRef.current.addData(newData, replace);
        }

        // The target view also updates itself when the final set comes in, but we need to update here too,
        // for the execution info display, which is managed here.
        if (newData.executionInfo) {
            this.forceUpdate();
        }
    }

    private handleTabSelection = (id: string): void => {
        let currentIndex = 0;
        if (id === "output") {
            this.setState({ currentResultSet: undefined, manualTab: true });
        } else {
            const { resultSets } = this.props;

            const currentResultSet = resultSets.sets.find((candidate, index) => {
                if (candidate.resultId === id) {
                    currentIndex = index + 1; // Account for the output page.

                    return true;
                }

                return false;
            });

            this.setState({ currentResultSet, manualTab: true });
        }

        const { onSelectTab } = this.props;

        onSelectTab?.(currentIndex);
    };

    private showActionMenu = (event: MouseEvent | KeyboardEvent): void => {
        event.stopPropagation();

        if (event instanceof MouseEvent) {
            const targetRect = new DOMRect(event.clientX, event.clientY, 2, 2);

            this.actionMenuRef.current?.close();
            this.actionMenuRef.current?.open(targetRect, false);
        }
    };

    private handleActionMenuItemClick = (props: IMenuItemProperties): boolean => {
        const command = props.command.command;
        switch (command) {
            case "closeMenuItem": {
                const { onRemoveResult } = this.props;
                const { currentResultSet } = this.state;

                const info = this.#editingInfo.get(currentResultSet?.resultId ?? "");
                if (info) {
                    void this.confirmCommitOrRollback(info).then((canClose) => {
                        if (canClose) {
                            onRemoveResult?.(currentResultSet?.resultId ?? "");
                        }
                    });
                } else {
                    onRemoveResult?.(currentResultSet?.resultId ?? "");
                }

                break;
            }

            case "exportMenuItem": {
                break;
            }

            case "importMenuItem": {
                break;
            }

            default:
        }

        return true;
    };

    private previousPage = (): void => {
        const { currentResultSet } = this.state;

        const switchPage = (): void => {
            if (currentResultSet && currentResultSet.data.currentPage > 0) {
                const { onResultPageChange } = this.props;

                --currentResultSet.data.currentPage;
                onResultPageChange?.(currentResultSet.resultId, currentResultSet.data.currentPage,
                    currentResultSet.sql);
            }
        };

        // istanbul ignore else
        if (currentResultSet) {
            const info = this.#editingInfo.get(currentResultSet.resultId ?? "");
            if (info) {
                // The user is currently editing the result set, so we need to commit or rollback the changes first.
                void this.confirmCommitOrRollback(info).then((result) => {
                    if (result) {
                        switchPage();
                    }
                });
            } else {
                switchPage();
            }
        }
    };

    private nextPage = (): void => {
        const { currentResultSet } = this.state;

        const switchPage = (): void => {
            if (currentResultSet?.data.hasMoreRows) {
                const { onResultPageChange } = this.props;

                ++currentResultSet.data.currentPage;
                onResultPageChange?.(currentResultSet.resultId, currentResultSet.data.currentPage,
                    currentResultSet.sql);
            }
        };

        // istanbul ignore else
        if (currentResultSet) {
            const info = this.#editingInfo.get(currentResultSet.resultId ?? "");
            if (info) {
                // The user is currently editing the result set, so we need to commit or rollback the changes first.
                void this.confirmCommitOrRollback(info).then((result) => {
                    if (result) {
                        switchPage();
                    }
                });
            } else {
                switchPage();
            }
        }
    };

    /**
     * Called when the user wants to navigate away from current page of the current result set.
     * This includes changing the active page, removing the result set or closing the tab.
     *
     * @param info The editing info for the result set.
     *
     * @returns true if the user can navigate away, false otherwise.
     */
    private confirmCommitOrRollback = async (info: IEditingInfo): Promise<boolean> => {
        if (info.rowChanges.length === 0) {
            return true;
        }

        // The user is currently editing the result set, so we need to commit or rollback the changes first.
        const response = await DialogHost.showDialog({
            id: "commitOrCancelChanges",
            type: DialogType.Confirm,
            parameters: {
                title: "Confirmation",
                prompt: `The result set for ${info.description} is currently being edited, do you want to commit or ` +
                    `rollback the changes before continuing?`,
                accept: "Commit",
                refuse: "Rollback",
                alternative: "Cancel",
                default: "Cancel",
            },
        });

        switch (response.closure) {
            case DialogResponseClosure.Accept: {
                this.commitChanges(info);

                return true;
            }

            case DialogResponseClosure.Decline: {
                const { onRollbackChanges } = this.props;
                const { currentResultSet } = this.state;
                if (currentResultSet) {
                    onRollbackChanges?.(currentResultSet);

                    this.#editingInfo.delete(currentResultSet.resultId);
                }

                return true;
            }

            default: {
                return false;
            }
        }
    };

    /**
     * Called when the user wants to roll back all changes.
     *
     * @returns true if the the data can be rolled back, false otherwise.
     */
    private confirmRollback = async (): Promise<boolean> => {
        const { currentResultSet } = this.state;

        if (currentResultSet) {
            const info = this.#editingInfo.get(currentResultSet.resultId ?? "");
            if (info && info.rowChanges.length > 0) {
                // The user is currently editing the result set, so we need to commit or rollback the changes first.
                const response = await DialogHost.showDialog({
                    id: "cancelChanges",
                    type: DialogType.Confirm,
                    title: "Confirmation",
                    parameters: {
                        prompt: `Do you really want to rollback all changes?`,
                        accept: "Rollback",
                        refuse: "Cancel",
                        default: "Cancel",
                    },
                });

                switch (response.closure) {
                    case DialogResponseClosure.Accept: {
                        return true;
                    }

                    default: {
                        return false;
                    }
                }
            }
        }

        return true;
    };

    /**
     * Triggered by one of the toggle view state buttons.
     * It triggers the corresponding action needed to either show the result pane maximized (if this result view
     * is in a script editor) or to create a new script and show the result pane maximized.
     */
    private handleResultToggle = (): void => {
        const { onToggleResultPaneViewState, showMaximizeButton, showMaximized } = this.props;
        const { currentResultSet } = this.state;

        // If showMaximized is not yet used it means we are in a notebook that needs to run the script
        // to show a separate script editor.
        if (showMaximizeButton === "statusBar" && showMaximized === undefined) {
            if (currentResultSet) {
                const sql = currentResultSet.sql;
                const name = `Result #${(currentResultSet.index ?? 0) + 1}`;
                if (sql) {
                    const request: IScriptRequest = {
                        id: uuid(),
                        language: "mysql",
                        caption: name,
                        content: sql,
                    };

                    // Run this as job (instead of a simple) requisition to allow it to be repeated until a script
                    // editor is ready to take the request.
                    void requisitions.execute("job", [
                        { requestType: "editorRunScript", parameter: request },
                    ]);
                }
            }
        } else {
            onToggleResultPaneViewState?.();
        }
    };

    /**
     * The user started editing a (new) field. Switch to edit mode, if not yet done.
     */
    private onFieldEditStart = (): void => {
        const { currentResultSet } = this.state;

        if (!currentResultSet) {
            return;
        }

        const info = this.#editingInfo.get(currentResultSet.resultId);
        if (!info) {
            this.startEditing();
        }
    };

    /**
     * Called when a field was edited.
     *
     * @param row The row index of the edited cell.
     * @param field The field name (which determines the column) of the edited cell.
     * @param newValue The new value of the cell.
     * @param previousValue The previous value of the cell.
     *
     * @returns A promise that resolves when the operation is complete.
     */
    private onFieldEdited = async (row: number, field: string, newValue: unknown,
        previousValue: unknown): Promise<void> => {

        return new Promise((resolve) => {
            const { currentResultSet } = this.state;

            if (!currentResultSet) {
                return;
            }

            let info = this.#editingInfo.get(currentResultSet.resultId);
            if (!info) {
                // Not yet editing, initialize the editing info.
                info = this.prepareEditingInfo(currentResultSet);

                this.#editingInfo.set(currentResultSet.resultId, info);
            }

            // Update the editing info.
            let rowChanges = info.rowChanges[row];
            if (!rowChanges) {
                // If this is the first change for a row collect the original PK values, which are needed for the
                // update statement.
                const pkColumns = currentResultSet.columns.filter((column) => {
                    return column.inPK;
                });

                // The current result set data has been updated at his point. That means if a PK column was updated
                // the new value is already in the data set. We need to use the previous value instead.
                const entry = currentResultSet.data.rows[row];
                const pkValues = pkColumns.map((column) => {
                    if (column.field === field) {
                        return previousValue;
                    }

                    return entry[column.field];
                });

                rowChanges = { changes: [], deleted: false, added: false, pkValues };
                info.rowChanges[row] = rowChanges;
            }

            rowChanges.changes.push({ field, value: newValue });

            this.updateEditingStatus(info);
            info.selectedRowIndex = undefined;
            this.forceUpdate(() => { resolve(); });
        });
    };

    /**
     * Called when the user cancels editing a field. If there are no more changes, editing is stopped.
     * Otherwise the changes are kept and editing continues.
     */
    private onFieldEditCancel = (): void => {
        const { currentResultSet } = this.state;

        if (!currentResultSet) {
            return;
        }

        const info = this.#editingInfo.get(currentResultSet.resultId);
        if (!info) {
            return;
        }

        const { rowChanges } = info;
        if (rowChanges.length === 0) {
            this.#editingInfo.delete(currentResultSet.resultId);
        }

    };

    /**
     * Called when the user toggles the deletion mark for one or more rows.
     *
     * @param rows The row indexes to toggle.
     */
    private onToggleRowDeletionMarks = (rows: number[]): void => {
        const { currentResultSet } = this.state;

        if (currentResultSet) {
            let info = this.#editingInfo.get(currentResultSet.resultId);
            if (!info) {
                // Not yet editing, initialize the editing info.
                info = {
                    description: `table ${currentResultSet.fullTableName}`,
                    statusInfo: {
                        text: "",
                    },
                    resultSet: currentResultSet,
                    rowChanges: [],
                    previewActive: false,
                };

                this.#editingInfo.set(currentResultSet.resultId, info);
            }

            // Update the editing info.
            rows.forEach((row) => {
                const rowChanges = info.rowChanges[row];
                if (rowChanges) {
                    // There's a row change, toggle the deleted state.
                    // Note: this could be a new row, in which case this row is ignored, unless the deleted state
                    // is set to false again.
                    rowChanges.deleted = !rowChanges.deleted;

                    if (!rowChanges.deleted && rowChanges.changes.length === 0) {
                        // No changes left, remove the row.
                        delete info.rowChanges[row];
                    }
                } else {
                    // No row change yet, create one and set the deletion mark.
                    const pkColumns = currentResultSet.columns.filter((column) => {
                        return column.inPK;
                    });
                    const pkValues = pkColumns.map((column) => {
                        return currentResultSet.data.rows[row][column.field];
                    });

                    info.rowChanges[row] = { changes: [], deleted: true, added: false, pkValues };
                }
            });

            this.updateEditingStatus(info);
            info.selectedRowIndex = undefined;
        }
    };

    /**
     * Called when the user started editing a field in the current result set, either implicitly or via
     * the "Start Editing" button.
     */
    private startEditing = (): void => {
        const { currentResultSet } = this.state;

        if (currentResultSet) {
            this.prepareEditingInfo(currentResultSet);
            this.forceUpdate();
        }
    };

    private startEditingFirstField = (): void => {
        const { currentResultSet } = this.state;

        this.startEditing();

        if (currentResultSet) {
            const viewRef = this.viewRefs.get(currentResultSet.resultId);
            viewRef?.current?.editFirstCell();
        }
    };

    /**
     * Called when the editing info status bar needs to be updated.
     *
     * @param info The editing info for the result set.
     */
    private updateEditingStatus(info: IEditingInfo): void {
        let fieldChanges = 0;
        let rowsDeleted = 0;
        let rowsAdded = 0;
        info.rowChanges.forEach((list) => {
            fieldChanges += list.changes.length;
            if (list.deleted) {
                ++rowsDeleted;
            }
            if (list.added) {
                ++rowsAdded;
            }
        });

        // Count set rows in the (sparse) row changes list.
        const rowCount = Object.keys(info.rowChanges).length;
        let rowText = formatWithNumber("row", rowCount);
        const fieldText = formatWithNumber("field", fieldChanges);

        info.statusInfo.text = `Editing, ${rowText} affected (${fieldText} changed`;
        if (rowsDeleted > 0) {
            rowText = formatWithNumber("row", rowsDeleted);
            info.statusInfo.text += `, ${rowText} deleted`;
        }
        if (rowsAdded > 0) {
            rowText = formatWithNumber("row", rowsAdded);
            info.statusInfo.text += `, ${rowText} added`;
        }
        info.statusInfo.text += ")";
    }

    private onVerticalScroll = (rowIndex: number): void => {
        if (this.state.currentResultSet) {
            this.topRowIndexes.set(this.state.currentResultSet.resultId, rowIndex);
        }
    };

    private onAction = async (action: string): Promise<void> => {
        const { currentResultSet } = this.state;

        return new Promise((resolve) => {
            switch (action) {
                case "addNewRow": {
                    if (currentResultSet) {
                        const info = this.prepareEditingInfo(currentResultSet);

                        // Use default values for the new row.
                        const row: IDictionary = {};
                        const changes: IResultCellChange[] = currentResultSet.columns.map((column) => {
                            let value: unknown = column.default ?? undefined;
                            if (value === "CURRENT_TIMESTAMP") {
                                value = new Date();
                            } else if (value === undefined) {
                                value = column.nullable ? null : defaultValues[column.dataType.type];
                            }
                            row[column.field] = value;

                            return { field: column.field, value };
                        });

                        // Add the row values at the end of the change list.
                        const count = currentResultSet.data.rows.length;
                        info.rowChanges[count] = {
                            changes,
                            deleted: false,
                            added: true,
                            pkValues: [],
                        };

                        // And add the new row to the result set.
                        currentResultSet.data.rows.push(row);

                        this.updateEditingStatus(info);
                        info.selectedRowIndex = undefined;
                        this.forceUpdate(() => { resolve(); });
                    }

                    break;
                }

                case "commit": {
                    this.commitChanges();

                    break;
                }

                case "rollback": {
                    this.cancelEditingAndRollbackChanges();

                    break;
                }

                default:
            }
        });
    };

    private previewChanges = (): void => {
        const { currentResultSet } = this.state;

        const info = this.#editingInfo.get(currentResultSet?.resultId ?? "");
        if (info) {
            info.previewActive = !info.previewActive;
            this.forceUpdate();
        }
    };

    private commitChanges = (info?: IEditingInfo): void => {
        const { onCommitChanges, onResultPageChange } = this.props;
        const { currentResultSet } = this.state;

        if (!info) {
            info = this.#editingInfo.get(currentResultSet?.resultId ?? "");
        }

        if (info) {
            const statements = this.generateStatements(info).map((pair) => {
                return pair[1];
            });

            void onCommitChanges?.(info.resultSet, statements).then((result) => {
                this.#affectedRows.set(info.resultSet.resultId, result.affectedRows);

                if (result.errors.length > 0) {
                    // We got an error (can only be one as execution is stopped on the first error).
                    // Do not end editing, but show the error in the SQL preview pane.
                    info.errors = result.errors;
                    info.previewActive = true;
                } else {
                    this.#editingInfo.delete(info.resultSet.resultId);

                    // Use the page switch callback to refresh the result set.
                    onResultPageChange?.(info.resultSet.resultId, info.resultSet.data.currentPage,
                        info.resultSet.sql);

                }
            });
        }
    };

    private cancelEditingAndRollbackChanges = (): void => {
        const { onRollbackChanges } = this.props;
        const { currentResultSet } = this.state;

        if (currentResultSet) {
            void this.confirmRollback().then((result) => {
                if (result) {
                    onRollbackChanges?.(currentResultSet);

                    this.#editingInfo.delete(currentResultSet.resultId);
                }
            });
        }
    };

    /**
     * @param info The editing info for the result set.
     *
     * @returns A statement for each row change (insert, update, delete).
     */
    private generateStatements = (info: IEditingInfo): Array<[number, string]> => {
        const { rowChanges, resultSet } = info;

        const uppercaseKeywords = Settings.get("dbEditor.upperCaseKeywords", true);
        const builder = new QueryBuilder(resultSet.fullTableName, resultSet.columns, uppercaseKeywords);

        const statements: Array<[number, string]> = [];
        rowChanges.forEach((rowChange, index) => {
            const { changes } = rowChange;

            if (rowChange.deleted) {
                // The row is marked for deletion. All other changes are ignored.
                if (!rowChange.added) { // A new row was deleted again, so don't commit it.
                    statements.push([index, builder.generateDeleteStatement(rowChange.pkValues)]);
                }
            } else if (rowChange.added) { // A new row.
                if (changes.length >= resultSet.columns.length) {
                    // Coalesce the changes into a single set of values.
                    // The first n changes (where n is the number of columns) are default values to start with.
                    const values: unknown[] = [];

                    for (let i = 0; i < resultSet.columns.length; ++i) {
                        values.push(changes[i].value);
                    }

                    // Now update each value that was changed. Start with the n-th change.
                    for (let i = resultSet.columns.length; i < changes.length; ++i) {
                        const change = changes[i];
                        const columnIndex = resultSet.columns.findIndex((candidate) => {
                            return candidate.field === change.field;
                        });

                        if (columnIndex > -1) {
                            values[columnIndex] = change.value;
                        }
                    }

                    statements.push([index, builder.generateInsertStatement(values)]);
                }
            } else if (changes.length > 0) { // An existing row got new values.
                // Coalesce the changes into a single set of values, into the same order as the columns.
                let newValues: unknown[] = [];
                let changedColumns: string[] = resultSet.columns.map((column) => {
                    return column.title;
                });

                changes.forEach((change) => {
                    const columnIndex = resultSet.columns.findIndex((candidate) => {
                        return candidate.field === change.field;
                    });

                    if (columnIndex > -1) {
                        newValues[columnIndex] = change.value;
                    }
                });

                // Remove all columns, which have no changes.
                changedColumns = changedColumns.filter((column, index) => {
                    return newValues[index] !== undefined;
                });

                // And remove all new values, which have no changes.
                newValues = newValues.filter((value) => {
                    return value !== undefined;
                });

                // At this point both the changed columns list and the new values list should have the same length.
                statements.push(
                    [index, builder.generateUpdateStatement(rowChange.pkValues, changedColumns, newValues)]);
            }
        });

        return statements;
    };

    private selectViewStyle = (accept: boolean, selection: Set<string>): void => {
        const { currentResultSet } = this.state;

        if (!currentResultSet) {
            return;
        }

        const info = this.#editingInfo.get(currentResultSet.resultId);
        if (!info) {
            return;
        }

        info.previewActive = selection.has("preview");
        this.forceUpdate();
    };

    private prepareEditingInfo = (resultSet: IResultSet): IEditingInfo => {
        let info = this.#editingInfo.get(resultSet.resultId);
        if (!info) {
            this.#affectedRows.delete(resultSet.resultId);
            info = {
                description: `table ${resultSet.fullTableName}`,
                statusInfo: {
                    text: "",
                },
                resultSet,
                rowChanges: [],
                previewActive: false,
            };

            this.#editingInfo.set(resultSet.resultId, info);
        }

        this.updateEditingStatus(info);

        return info;
    };

    /**
     * Called when the user clicks on a statement in the SQL preview pane.
     * It will switch the preview pane off and show the result set again, selecting the statement at the given index.
     *
     * @param index The index of the statement that was clicked.
     */
    private handleStatementClick = (index: number): void => {
        const { currentResultSet } = this.state;

        if (currentResultSet) {
            const info = this.#editingInfo.get(currentResultSet.resultId);
            if (info) {
                info.previewActive = false;
                info.selectedRowIndex = index;
                this.forceUpdate();
            }
        }
    };
}
