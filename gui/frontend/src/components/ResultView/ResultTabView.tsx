/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import gridIcon from "../../assets/images/toolbar/toolbar-grid.svg";
import commitIcon from "../../assets/images/toolbar/toolbar-commit.svg";
import rollbackIcon from "../../assets/images/toolbar/toolbar-rollback.svg";
import expandIcon from "../../assets/images/toolbar/toolbar-expand.svg";
import menuIcon from "../../assets/images/toolbar/toolbar-menu.svg";
import previousPageIcon from "../../assets/images/toolbar/toolbar-page_previous.svg";
import nextPageIcon from "../../assets/images/toolbar/toolbar-page_next.svg";

import React from "react";

import {
    Button, Component, ComponentPlacement, Container, Divider, Dropdown, IComponentProperties, IComponentState, Icon,
    IMenuItemProperties, ITabviewPage, Menu, MenuItem, Orientation, TabPosition, Tabview, Toolbar,
} from "../ui";
import { IResultSet, IResultSetRows, IResultSets } from "../../script-execution";
import { IColumnInfo, MessageType } from "../../app-logic/Types";
import { ResultView } from "./ResultView";
import { ResultStatus } from ".";
import { ActionOutput } from "./ActionOutput";

export interface IResultTabViewProperties extends IComponentProperties {
    /** One set per tab page. */
    resultSets: IResultSets;

    /** The ID of the executing context for this result view. */
    contextId: string;

    currentSet?: number;
    resultPaneMaximized?: boolean;

    onResultPageChange?: (resultId: string, currentPage: number, sql: string) => void;
    onSetResultPaneViewState?: (maximized: boolean) => void;
    onSelectTab?: (index: number) => void;
}

interface IResultTabViewState extends IComponentState {
    /** Set to true when a result set was selected by the user. */
    manualTab: boolean;

    currentResultSet?: IResultSet;

    /** Have to keep track locally as the presentation interface cannot re-render this component on toggle. */
    resultPaneMaximized: boolean;
}

/** Holds a collection of result views and other output in a tabbed interface. */
export class ResultTabView extends Component<IResultTabViewProperties, IResultTabViewState> {

    private actionMenuRef = React.createRef<Menu>();

    // A set of result IDs for tabs with edited data.
    private edited = new Set<string>();

    // React refs to the used ResultView instances, keyed by the result ID for the result set.
    private viewRefs = new Map<string, React.RefObject<ResultView>>();

    public constructor(props: IResultTabViewProperties) {
        super(props);

        this.state = {
            manualTab: false,
            currentResultSet: props.resultSets.sets.length > 0 ? props.resultSets.sets[0] : undefined,
            resultPaneMaximized: props.resultPaneMaximized ?? false,
        };

        this.addHandledProperties("resultSets", "contextId", "currentSet", "resultPaneMaximized",
            "onResultPageChange", "onSetResultPaneViewState", "onSelectTab");
    }

    public static getDerivedStateFromProps(newProps: IResultTabViewProperties,
        oldState: IResultTabViewState): Partial<IResultTabViewState> {

        const { currentSet, resultSets } = newProps;
        const { manualTab, currentResultSet } = oldState;

        if (manualTab) {
            return {
                manualTab: false,
            };

        }
        const resultPaneMaximized = newProps.resultPaneMaximized;

        if (resultSets.sets.length === 0) {
            return {
                currentResultSet: undefined,
                resultPaneMaximized,
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
                resultPaneMaximized,
            };
        }

        const found = resultSets.sets.find((candidate) => {
            return candidate === currentResultSet;
        });

        if (found) {
            return {
                resultPaneMaximized,
            };
        }

        return {
            currentResultSet: resultSets.sets.length > 0 ? newProps.resultSets.sets[0] : undefined,
            resultPaneMaximized,
        };
    }

    public render(): React.ReactNode {
        const { resultSets, contextId } = this.props;
        const { currentResultSet, resultPaneMaximized } = this.state;

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

        resultSets.sets.forEach((resultSet: IResultSet, index) => {
            const ref = React.createRef<ResultView>();
            this.viewRefs.set(resultSet.resultId, ref);

            pages.push({
                id: resultSet.resultId,
                caption: `Result #${(resultSet.index ?? index) + 1}`,
                content: (
                    <ResultView
                        ref={ref}
                        resultSet={resultSet}
                        onEdit={this.handleEdit}
                    />
                ),
            });
        });


        let executionInfo;
        let currentPage = 0;
        let hasMorePages = false;
        let dirty = false;
        if (currentResultSet) {
            executionInfo = currentResultSet.data.executionInfo;
            currentPage = currentResultSet.data.currentPage;
            hasMorePages = currentResultSet.data.hasMoreRows ?? false;
            dirty = this.edited.has(currentResultSet.resultId);
        }

        const gotError = executionInfo && executionInfo.type === MessageType.Error;
        const gotResponse = executionInfo && executionInfo.type === MessageType.Response;

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
            >
                <Tabview
                    className="resultTabview"
                    stretchTabs={false}
                    hideSingleTab={true}
                    selectedId={currentResultSet?.resultId ?? "output"}
                    tabPosition={TabPosition.Top}
                    pages={pages}

                    onSelectTab={this.handleTabSelection}
                />
                {
                    executionInfo && <ResultStatus executionInfo={executionInfo}>
                        {
                            !gotError && !gotResponse && <Toolbar
                                dropShadow={false}
                            >
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
                                <Button
                                    id="applyButton"
                                    imageOnly={true}
                                    disabled={!dirty}
                                    data-tooltip="Apply Changes"
                                >
                                    <Icon src={commitIcon} data-tooltip="inherit" />
                                </Button>
                                <Button
                                    id="revertButton"
                                    imageOnly={true}
                                    disabled={!dirty}
                                    data-tooltip="Revert Changes"
                                >
                                    <Icon src={rollbackIcon} data-tooltip="inherit" />
                                </Button>
                                <Divider id="editSeparator" vertical={true} />
                                <Button
                                    id="maximizeResultSetButton"
                                    imageOnly={true}
                                    data-tooltip={resultPaneMaximized
                                        ? "Normalize Result Set View"
                                        : "Maximize Result Set View"
                                    }
                                    onClick={this.handleResultToggle}
                                >
                                    <Icon src={expandIcon} data-tooltip="inherit" />
                                </Button>
                                <Divider vertical={true} />
                                <Dropdown
                                    id="viewStyleDropDown"
                                    selection="grid"
                                    data-tooltip="Select a View Section for the Result Set"
                                >
                                    <Dropdown.Item
                                        id="grid"
                                        picture={<Icon src={gridIcon} data-tooltip="inherit" />}
                                    />
                                </Dropdown>
                                <Divider vertical={true} />
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
                        id="exportMenuItem"
                        caption="Export Result Set"
                        disabled
                    />
                    <MenuItem
                        id="importMenuItem"
                        caption="Import Result Set"
                        disabled
                    />
                </Menu>

            </Container>
        );
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

    private showActionMenu = (e: React.SyntheticEvent): void => {
        e.stopPropagation();

        const event = e.nativeEvent as MouseEvent;
        const targetRect = new DOMRect(event.clientX, event.clientY, 2, 2);

        this.actionMenuRef.current?.close();
        this.actionMenuRef.current?.open(targetRect, false);
    };

    private handleActionMenuItemClick = (e: React.MouseEvent, props: IMenuItemProperties): boolean => {
        switch (props.id ?? "") {
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

        // Testing note: currentResultSet is always set when we come here (otherwise the toolbar isn't rendered).
        if (currentResultSet) {
            if (currentResultSet.data.currentPage > 0) {
                const { onResultPageChange } = this.props;

                --currentResultSet.data.currentPage;
                onResultPageChange?.(currentResultSet.resultId, currentResultSet.data.currentPage,
                    currentResultSet.sql);
            }
        }
    };

    private nextPage = (): void => {
        const { currentResultSet } = this.state;

        // Testing note: currentResultSet is always set when we come here (otherwise the toolbar isn't rendered).
        if (currentResultSet) {
            if (currentResultSet.data.hasMoreRows) {
                const { onResultPageChange } = this.props;

                ++currentResultSet.data.currentPage;
                onResultPageChange?.(currentResultSet.resultId, currentResultSet.data.currentPage,
                    currentResultSet.sql);
            }
        }
    };

    private handleResultToggle = (): void => {
        const { onSetResultPaneViewState } = this.props;
        const { resultPaneMaximized } = this.state;

        this.setState({ resultPaneMaximized: !resultPaneMaximized }, () => {
            onSetResultPaneViewState?.(!resultPaneMaximized);
        });
    };

    // Editing is not supported yet, so we cannot test it.
    // TODO: enable coverage collection here, once editing is available.
    /* istanbul ignore next  */
    private handleEdit = (resultSet: IResultSet): void => {
        this.edited.add(resultSet.resultId);
    };
}
