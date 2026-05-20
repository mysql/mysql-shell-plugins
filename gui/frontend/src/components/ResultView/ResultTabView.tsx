/*
 * Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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

import { ComponentChild, createRef, VNode } from "preact";

import { DialogHost } from "../../app-logic/DialogHost.js";
import {
    defaultValues, DialogResponseClosure, DialogType, IColumnInfo, IStatusInfo, MessageType, type ISqlUpdateResult,
} from "../../app-logic/general-types.js";
import { defaultVisualExplainOptions } from "../../script-execution/index.js";
import type {
    IImageResultData, IResultSet, IResultSetRows, IResultSets, IVisualExplainOptions, VisualExplainLayout,
} from "../../script-execution/index.js";
import { Assets } from "../../supplement/Assets.js";
import { hasElectronHostBridge } from "../../supplement/ElectronDesktop.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { saveBlobAsFile } from "../../utilities/helpers.js";
import { formatWithNumber } from "../../utilities/string-helpers.js";
import { Button } from "../ui/Button/Button.js";
import { Codicon } from "../ui/Codicon.js";
import {
    ComponentBase, ComponentPlacement, IComponentProperties, IComponentState,
} from "../ui/Component/ComponentBase.js";
import { Container, Orientation } from "../ui/Container/Container.js";
import { Divider } from "../ui/Divider/Divider.js";
import { Icon } from "../ui/Icon/Icon.js";
import { Label } from "../ui/Label/Label.js";
import { Menu } from "../ui/Menu/Menu.js";
import { IMenuItemProperties, MenuItem } from "../ui/Menu/MenuItem.js";
import { SQLPreview } from "../ui/SQLPreview/SQLPreview.js";
import { ITabPosition, ITabviewPage, TabPosition, Tabview } from "../ui/Tabview/Tabview.js";
import { Toolbar } from "../ui/Toolbar/Toolbar.js";
import { ActionOutput } from "./ActionOutput.js";
import { ImageResultView } from "./ImageResultView.js";
import { QueryBuilder } from "./QueryBuilder.js";
import { defaultCellValue } from "./ResultCellValue.js";
import { IStatusTextPosition, ResultStatus } from "./ResultStatus.js";
import { IResultCellChange, ResultRowChanges, ResultView } from "./ResultView.js";

const defaultImageZoom = 1;
const minImageZoom = 0.25;
const maxImageZoom = 4;
const imageZoomStep = 0.25;

type VisualExplainDetailsLevel = "minimal" | "medium" | "full";
type VisualExplainLayoutMode = VisualExplainLayout;

/** All the current changes for a result set. */
interface IEditingInfo {
    /** Text that can be shown when asking the user for confirmation of commit or discard of this set of changes. */
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

export interface IResultTabViewLayout extends ITabPosition, IStatusTextPosition {
    toolbarLocation?: "top" | "bottom";
}

export interface IResultTabViewToggleOptions {
    /** Where to show the toggle state button. */
    showMaximizeButton: "never" | "tab" | "statusBar";

    /** When set to true show only the selected result set. */
    showMaximized?: boolean;

    handleResultToggle(currentResultSet?: IResultSet): void;
}

interface IResultTabViewProperties extends IComponentProperties {
    /** One set per tab page. */
    resultSets: IResultSets;

    /** The ID of the executing context for this result view. */
    contextId: string;

    /** Which of the result sets is currently selected? */
    currentSet?: number;

    /** When to hide the tab area? */
    hideTabs: "never" | "single" | "always";

    upperCaseKeywords: boolean;

    toggleOptions?: IResultTabViewToggleOptions,

    layoutOptions?: IResultTabViewLayout,
    connectionToggle?: VNode,

    onResultPageChange?: (resultId: string, currentPage: number, sql: string, currentSet?: number) => void;
    onSelectTab?: (index: number) => void;

    /**
     * Called when changed result set data must be written to the application store and sent to the server.
     *
     * @returns An error message or the number of affected rows if the update was successful.
     */
    onCommitChanges?: (resultSet: IResultSet, updateSql: string[]) => Promise<ISqlUpdateResult>;

    updateRowsForResultId?: (resultSet: IResultSet) => Promise<void>;

    /** Called when the user wants to discard all changes. */
    onRollbackChanges?: (resultSet: IResultSet) => void;

    onRemoveResult?: (resultId: string) => void;

    onImageResultOptionsChange?: (resultSet: IResultSet, options: IVisualExplainOptions) => Promise<void>;
}

interface IResultTabViewState extends IComponentState {
    currentResultSet?: IResultSet;
    connectionToggle?: VNode,
}

/** Holds a collection of result views and other output in a tabbed interface. */
export class ResultTabView extends ComponentBase<IResultTabViewProperties, IResultTabViewState> {
    public static override defaultProps: Partial<IResultTabViewProperties> = {
        upperCaseKeywords: true,
    };

    private actionMenuRef = createRef<Menu>();

    // React refs to the used ResultView instances, keyed by the result ID for the result set.
    private viewRefs = new Map<string, preact.RefObject<ResultView>>();

    // Keeps the top row index for each result set, keyed by the result ID.
    private topRowIndexes = new Map<string, number>();

    private get mergedLayoutOptions(): IResultTabViewLayout {
        const { toolbarLocation, tabPosition, statusTextPosition } = this.props.layoutOptions ?? {};

        return {
            toolbarLocation: toolbarLocation ?? "bottom",
            tabPosition: tabPosition ?? TabPosition.Top,
            statusTextPosition: statusTextPosition ?? "left",
        };
    }

    /** The number of updated rows during the last commit action. */
    private affectedRows = new Map<string, number>();

    /** All value changes per result set. */
    private editingInfo = new Map<string, IEditingInfo>();

    public constructor(props: IResultTabViewProperties) {
        super(props);

        this.state = {
            currentResultSet: props.resultSets.sets.length > 0 ? props.resultSets.sets[0] : undefined,
            connectionToggle: props.connectionToggle,
        };

        this.addHandledProperties("resultSets", "contextId", "currentSet",
            "upperCaseKeywords", "toggleOptions", "layoutOptions", "connectionToggle",
            "hideTabs", "onResultPageChange", "onSelectTab", "onImageResultOptionsChange");
    }

    public static override getDerivedStateFromProps(newProps: IResultTabViewProperties,
        oldState: IResultTabViewState): Partial<IResultTabViewState> {

        const { currentSet, resultSets } = newProps;
        const { currentResultSet } = oldState;

        if (resultSets.sets.length === 0 || currentSet === undefined) {
            return {
                currentResultSet: undefined,
            };
        }

        // Convert the tab index into a value used to select a specific tab.
        const newCurrentResultSet = (currentSet - 1) < resultSets.sets.length
            ? resultSets.sets[currentSet - 1]
            : resultSets.sets[resultSets.sets.length - 1];

        if (newCurrentResultSet === currentResultSet) {
            // Keep what was selected before, if it still exists.
            return {};
        }

        return {
            currentResultSet: newCurrentResultSet,
        };
    }

    public render(): ComponentChild {
        const { resultSets, contextId, hideTabs, toggleOptions } = this.props;
        const { toolbarLocation, tabPosition, statusTextPosition } = this.mergedLayoutOptions;
        const { showMaximized } = toggleOptions ?? {};
        const { currentResultSet, connectionToggle } = this.state;

        const className = this.getEffectiveClassNames(["resultHost"]);

        this.viewRefs.clear();

        const pages: ITabviewPage[] = [];

        if (resultSets.output && resultSets.output.length > 0) {
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

        const currentEditingInfo = this.editingInfo.get(currentResultSet?.resultId ?? "");
        const editModeActive = currentEditingInfo !== undefined;

        const updatable = currentResultSet?.updatable ?? false;

        resultSets.sets.forEach((resultSet: IResultSet, index) => {
            const editingInfo = this.editingInfo.get(resultSet.resultId);
            const editModeActive = editingInfo !== undefined;

            const ref = createRef<ResultView>();
            this.viewRefs.set(resultSet.resultId, ref);

            let topRowIndex = this.topRowIndexes.get(resultSet.resultId);
            const selectedRowIndex = editingInfo?.selectedRowIndex;
            if (selectedRowIndex !== undefined) {
                topRowIndex = selectedRowIndex;
            }

            if (!showMaximized || resultSet === currentResultSet) {
                let caption = resultSet.caption;
                if (!caption) {
                    if (resultSet.index !== undefined) {
                        caption = `Result #${resultSet.index + 1}`;
                    } else {
                        caption = `Result #${index + 1}`;
                    }

                    if (resultSet.subIndex !== undefined) {
                        caption += `.${resultSet.subIndex + 1}`;
                    }
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
                } else if (resultSet.viewType === "image") {
                    content = (
                        <ImageResultView resultSet={resultSet} zoom={resultSet.image?.zoom} />
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
                    content,
                    canClose: true,
                });
            }
        });

        // Show editing information if we have it, otherwise use the execution info.
        let statusInfo = currentEditingInfo?.statusInfo;
        if (!statusInfo) {
            if (currentResultSet && this.affectedRows.has(currentResultSet.resultId)) {
                const affectedRows = this.affectedRows.get(currentResultSet.resultId)!;
                const rowText = formatWithNumber("row", affectedRows);
                statusInfo = {
                    text: `${rowText} updated`,
                };
            } else if (currentResultSet?.data.executionInfo) {
                statusInfo = currentResultSet.data.executionInfo;
            }
        }

        const currentPage = currentResultSet?.data.currentPage ?? 0;
        const hasMorePages = currentResultSet?.data.hasMoreRows ?? false;

        const gotError = statusInfo && statusInfo.type === MessageType.Error;
        const gotResponse = statusInfo && statusInfo.type === MessageType.Response;
        const imageResultActive = currentResultSet?.viewType === "image";
        const imageResultToolbar = imageResultActive && currentResultSet
            ? this.renderImageResultToolbar(currentResultSet)
            : undefined;

        const editButtonTooltip = updatable ? (editModeActive ? "Editing" : "Start Editing") : "Data not editable";
        const previewActive = currentEditingInfo?.previewActive === true;

        const resultStatus = statusInfo && (
            <ResultStatus statusInfo={statusInfo} statusTextPosition={statusTextPosition}>
                {
                    !gotError && !gotResponse && (imageResultToolbar ?? <Toolbar dropShadow={false} >
                        {connectionToggle ?? null}
                        <Label className="autoHide">View:</Label>
                        <Container
                            className="viewSelector segmentedButton"
                            orientation={Orientation.LeftToRight}
                            fixedScrollbars={false}
                            role="radiogroup"
                            aria-label="View"
                        >
                            <Button
                                id="viewGridButton"
                                className={!previewActive ? "selected" : undefined}
                                imageOnly={true}
                                isDefault={!previewActive}
                                focusOnClick={true}
                                role="radio"
                                aria-label="Data Grid"
                                aria-checked={!previewActive}
                                tabIndex={!previewActive ? 0 : -1}
                                data-tooltip="Data Grid"
                                onClick={this.handleViewSelectorClick}
                                onKeyDown={this.handleViewSelectorKeyDown}
                            >
                                <Icon src={Assets.toolbar.gridIcon} data-tooltip="inherit" />
                            </Button>
                            <Button
                                id="viewPreviewButton"
                                className={previewActive ? "selected" : undefined}
                                imageOnly={true}
                                isDefault={previewActive}
                                focusOnClick={true}
                                role="radio"
                                aria-label="Preview Changes as SQL"
                                aria-checked={previewActive}
                                tabIndex={previewActive ? 0 : -1}
                                disabled={!currentEditingInfo}
                                aria-disabled={!currentEditingInfo}
                                data-tooltip="Preview Changes as SQL"
                                onClick={this.handleViewSelectorClick}
                                onKeyDown={this.handleViewSelectorKeyDown}
                            >
                                <Icon src={Assets.toolbar.sqlPreviewInactiveIcon} data-tooltip="inherit" />
                            </Button>
                        </Container>
                        <Divider vertical={true} />
                        <Label className="autoHide">Pages:</Label>
                        <Button
                            id="previousPageButton"
                            imageOnly={true}
                            disabled={currentPage === 0}
                            data-tooltip="Previous Page"
                            onClick={this.previousPage}
                        >
                            <Icon src={Assets.toolbar.pagePreviousIcon} data-tooltip="inherit" />
                        </Button>
                        <Button
                            id="nextPageButton"
                            imageOnly={true}
                            disabled={!hasMorePages}
                            data-tooltip="Next Page"
                            onClick={this.nextPage}
                        >
                            <Icon src={Assets.toolbar.pageNextIcon} data-tooltip="inherit" />
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
                            <Icon src={Assets.toolbar.editIcon2} data-tooltip="inherit" />
                        </Button>
                        <Button
                            id="applyButton"
                            imageOnly={true}
                            disabled={!currentEditingInfo}
                            data-tooltip="Apply Changes"
                            onClick={() => {
                                void this.commitChanges();
                            }}
                        >
                            <Icon src={Assets.toolbar.commitIcon} data-tooltip="inherit" />
                        </Button>
                        <Button
                            id="rollbackButton"
                            imageOnly={true}
                            disabled={!currentEditingInfo}
                            data-tooltip="Discard Changes"
                            onClick={this.discardCurrentChanges}
                        >
                            <Icon src={Assets.toolbar.rollbackIcon} data-tooltip="inherit" />
                        </Button>
                        <Button
                            id="refreshButton"
                            imageOnly={true}
                            disabled={!!currentEditingInfo}
                            data-tooltip="Refresh"
                            onClick={this.refresh}
                        >
                            <Icon src={Assets.toolbar.refreshIcon2} data-tooltip="inherit" />
                        </Button>
                        <Divider id="editSeparator" vertical={true} />
                        <Button
                            id="showActionMenu"
                            imageOnly={true}
                            data-tooltip="Show Action Menu"
                            onClick={this.showActionMenu}
                        >
                            <Icon src={Codicon.Ellipsis} data-tooltip="inherit" />
                        </Button>
                    </Toolbar>)}
            </ResultStatus>
        );

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
            >
                {toolbarLocation === "top" && resultStatus}
                <Tabview
                    className="resultTabview"
                    stretchTabs={false}
                    hideSingleTab={hideTabs === "single"}
                    showTabs={hideTabs !== "always"}
                    selectedId={currentResultSet?.resultId ?? "output"}
                    tabPosition={tabPosition}
                    pages={pages}
                    canReorderTabs={true}

                    onSelectTab={this.handleTabSelection}
                    closeTabs={this.closeTabs}
                    canCloseTab={this.canClose}
                />
                {toolbarLocation === "bottom" && resultStatus}

                <Menu
                    id="actionMenu"
                    ref={this.actionMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleActionMenuItemClick}
                >
                    {this.renderActionMenuItems()}
                </Menu>

            </Container >
        );
    }

    private renderImageResultToolbar(resultSet: IResultSet): ComponentChild {
        const { connectionToggle } = this.state;
        const { onImageResultOptionsChange } = this.props;
        const options = this.getVisualExplainOptions(resultSet);
        const layoutMode = this.getVisualExplainLayoutMode(options);
        const detailsLevel = this.getVisualExplainDetailsLevel(options);
        const imageZoom = this.getImageZoom(resultSet.image);

        return (
            <Toolbar dropShadow={false} >
                {connectionToggle ?? null}
                <Label className="autoHide">Layout:</Label>
                <Container
                    className="visualExplainLayoutSelector visualExplainSegmentedSelector"
                    orientation={Orientation.LeftToRight}
                    role="radiogroup"
                    data-tooltip="Visual Explain Layout"
                >
                    <Button
                        id="visualExplainLayoutTopDownButton"
                        className={this.getVisualExplainLayoutButtonClassName(layoutMode, "topDown")}
                        imageOnly={true}
                        disabled={!onImageResultOptionsChange}
                        data-tooltip="Top-Down Layout"
                        role="radio"
                        aria-checked={layoutMode === "topDown"}
                        onClick={this.setVisualExplainLayoutMode}
                    >
                        <Icon src={Codicon.TypeHierarchySuper} data-tooltip="inherit" />
                    </Button>
                    <Button
                        id="visualExplainLayoutBottomUpButton"
                        className={this.getVisualExplainLayoutButtonClassName(layoutMode, "bottomUp")}
                        imageOnly={true}
                        disabled={!onImageResultOptionsChange}
                        data-tooltip="Bottom-Up Layout"
                        role="radio"
                        aria-checked={layoutMode === "bottomUp"}
                        onClick={this.setVisualExplainLayoutMode}
                    >
                        <Icon src={Codicon.TypeHierarchySub} data-tooltip="inherit" />
                    </Button>
                </Container>
                <Label className="visualExplainDetailsLabel">Details:</Label>
                <Container
                    className="visualExplainDetailsSelector visualExplainSegmentedSelector"
                    orientation={Orientation.LeftToRight}
                    role="radiogroup"
                    data-tooltip="Visual Explain Details"
                >
                    <Button
                        id="visualExplainDetailsMinimalButton"
                        className={this.getVisualExplainDetailsButtonClassName(detailsLevel, "minimal")}
                        disabled={!onImageResultOptionsChange}
                        data-tooltip="Minimal Details"
                        role="radio"
                        aria-checked={detailsLevel === "minimal"}
                        onClick={this.setVisualExplainDetailsLevel}
                    >
                        Minimal
                    </Button>
                    <Button
                        id="visualExplainDetailsMediumButton"
                        className={this.getVisualExplainDetailsButtonClassName(detailsLevel, "medium")}
                        disabled={!onImageResultOptionsChange}
                        data-tooltip="Medium Details"
                        role="radio"
                        aria-checked={detailsLevel === "medium"}
                        onClick={this.setVisualExplainDetailsLevel}
                    >
                        Medium
                    </Button>
                    <Button
                        id="visualExplainDetailsFullButton"
                        className={this.getVisualExplainDetailsButtonClassName(detailsLevel, "full")}
                        disabled={!onImageResultOptionsChange}
                        data-tooltip="Full Details"
                        role="radio"
                        aria-checked={detailsLevel === "full"}
                        onClick={this.setVisualExplainDetailsLevel}
                    >
                        Full
                    </Button>
                </Container>
                <Divider vertical={true} />
                <Button
                    id="visualExplainZoomOutButton"
                    imageOnly={true}
                    disabled={imageZoom <= minImageZoom}
                    data-tooltip="Zoom Out"
                    onClick={this.zoomImageResultOut}
                >
                    <Icon src={Codicon.ZoomOut} data-tooltip="inherit" />
                </Button>
                <Button
                    id="visualExplainResetZoomButton"
                    imageOnly={true}
                    disabled={imageZoom === defaultImageZoom}
                    data-tooltip="Reset Zoom"
                    onClick={this.resetImageResultZoom}
                >
                    <Icon src={Codicon.ScreenNormal} data-tooltip="inherit" />
                </Button>
                <Button
                    id="visualExplainZoomInButton"
                    imageOnly={true}
                    disabled={imageZoom >= maxImageZoom}
                    data-tooltip="Zoom In"
                    onClick={this.zoomImageResultIn}
                >
                    <Icon src={Codicon.ZoomIn} data-tooltip="inherit" />
                </Button>
                <Divider vertical={true} />
                <Button
                    id="showActionMenu"
                    imageOnly={true}
                    data-tooltip="Show Action Menu"
                    onClick={this.showActionMenu}
                >
                    <Icon src={Codicon.Ellipsis} data-tooltip="inherit" />
                </Button>
            </Toolbar>
        );
    }

    private renderActionMenuItems(): ComponentChild[] {
        if (this.state.currentResultSet?.viewType === "image") {
            const showMinimap = this.state.currentResultSet.image?.showMinimap !== false;

            return [
                <MenuItem
                    id="closeMenuItem"
                    command={{ title: "Close Result Set", command: "closeMenuItem" }}
                />,
                <MenuItem
                    id="separator1"
                    command={{ title: "-", command: "" }}
                    disabled
                />,
                <MenuItem
                    id="toggleMinimapMenuItem"
                    command={{ title: "Show Minimap", command: "toggleMinimapMenuItem" }}
                    checked={showMinimap}
                />,
                <MenuItem
                    id="separator2"
                    command={{ title: "-", command: "" }}
                    disabled
                />,
                <MenuItem
                    id="saveImageMenuItem"
                    command={{ title: "Save Image...", command: "saveImageMenuItem" }}
                    disabled={!this.state.currentResultSet.image?.data}
                />,
            ];
        }

        return [
            <MenuItem
                id="closeMenuItem"
                command={{ title: "Close Result Set", command: "closeMenuItem" }}
            />,
            <MenuItem
                id="separator1"
                command={{ title: "-", command: "" }}
                disabled
            />,
            <MenuItem
                id="exportMenuItem"
                command={{ title: "Export Result Set", command: "exportMenuItem" }}
                disabled
            />,
            <MenuItem
                id="importMenuItem"
                command={{ title: "Import Result Set", command: "importMenuItem" }}
                disabled
            />,
        ];
    }

    private getVisualExplainOptions(resultSet: IResultSet): IVisualExplainOptions {
        const options = {
            ...defaultVisualExplainOptions,
            ...resultSet.image?.visualExplainOptions,
        };
        options.layout ??= options.topDown ? "topDown" : "bottomUp";

        return options;
    }

    private getVisualExplainLayoutMode(options: IVisualExplainOptions): VisualExplainLayoutMode {
        return options.layout ?? (options.topDown ? "topDown" : "bottomUp");
    }

    private getVisualExplainDetailsLevel(options: IVisualExplainOptions): VisualExplainDetailsLevel {
        if (options.compact) {
            return "minimal";
        }

        return options.showDescription ? "full" : "medium";
    }

    private getVisualExplainDetailsButtonClassName(
        currentLevel: VisualExplainDetailsLevel,
        buttonLevel: VisualExplainDetailsLevel,
    ): string {
        return currentLevel === buttonLevel ? "visualExplainDetailsButton active" : "visualExplainDetailsButton";
    }

    private getVisualExplainLayoutButtonClassName(
        currentMode: VisualExplainLayoutMode,
        buttonMode: VisualExplainLayoutMode,
    ): string {
        return currentMode === buttonMode ? "visualExplainLayoutButton active" : "visualExplainLayoutButton";
    }

    private setVisualExplainLayoutMode = (
        _e: MouseEvent | KeyboardEvent,
        props: Readonly<IComponentProperties>,
    ): void => {
        const { currentResultSet } = this.state;

        if (!currentResultSet) {
            return;
        }

        const options = this.getVisualExplainOptions(currentResultSet);
        let layout: VisualExplainLayoutMode = "bottomUp";
        switch (props.id) {
            case "visualExplainLayoutTopDownButton": {
                layout = "topDown";
                break;
            }

            default:
        }

        this.updateVisualExplainOptions({
            ...options,
            layout,
            topDown: layout === "topDown",
        });
    };

    private setVisualExplainDetailsLevel = (
        _e: MouseEvent | KeyboardEvent,
        props: Readonly<IComponentProperties>,
    ): void => {
        const { currentResultSet } = this.state;

        if (!currentResultSet) {
            return;
        }

        const options = this.getVisualExplainOptions(currentResultSet);
        let compact = false;
        let showDescription = true;

        switch (props.id) {
            case "visualExplainDetailsMinimalButton": {
                compact = true;
                showDescription = false;
                break;
            }

            case "visualExplainDetailsMediumButton": {
                showDescription = false;
                break;
            }

            case "visualExplainDetailsFullButton": {
                break;
            }

            default: {
                return;
            }
        }

        this.updateVisualExplainOptions({
            ...options,
            compact,
            showDescription,
        });
    };

    private toggleImageMinimap = (): void => {
        const { currentResultSet } = this.state;

        if (!currentResultSet?.image) {
            return;
        }

        currentResultSet.image.showMinimap = currentResultSet.image.showMinimap === false;
        this.setState({ currentResultSet });
    };

    private zoomImageResultOut = (): void => {
        this.changeImageResultZoom(-imageZoomStep);
    };

    private zoomImageResultIn = (): void => {
        this.changeImageResultZoom(imageZoomStep);
    };

    private resetImageResultZoom = (): void => {
        const { currentResultSet } = this.state;

        if (!currentResultSet?.image) {
            return;
        }

        currentResultSet.image.zoom = defaultImageZoom;
        this.setState({ currentResultSet });
    };

    private changeImageResultZoom = (delta: number): void => {
        const { currentResultSet } = this.state;

        if (!currentResultSet?.image) {
            return;
        }

        currentResultSet.image.zoom = this.clampImageZoom(this.getImageZoom(currentResultSet.image) + delta);
        this.setState({ currentResultSet });
    };

    private getImageZoom = (image?: IImageResultData): number => {
        return this.clampImageZoom(image?.zoom ?? defaultImageZoom);
    };

    private clampImageZoom = (zoom: number): number => {
        return Math.min(maxImageZoom, Math.max(minImageZoom, zoom));
    };

    private saveImageResult = (): void => {
        const { currentResultSet } = this.state;

        if (!currentResultSet?.image?.data) {
            return;
        }

        const image = currentResultSet.image;
        const saveData = this.getImageSaveData(image);
        const fileName = this.getImageFileName(currentResultSet);

        if (hasElectronHostBridge()) {
            requisitions.executeRemote("saveFile", {
                title: "Save Rendered Image",
                saveLabel: "Save",
                default: fileName,
                filters: this.getImageFileFilters(image.mimeType),
                content: saveData.content,
                encoding: saveData.encoding,
            });

            return;
        }

        saveBlobAsFile(new Blob([saveData.blobContent], { type: saveData.mimeType }), fileName);
    };

    private getImageSaveData(image: IImageResultData): {
        blobContent: BlobPart;
        content: string;
        encoding: "utf8" | "base64";
        mimeType: string;
    } {
        const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(image.data);

        if (!match) {
            return {
                blobContent: image.data,
                content: image.data,
                encoding: "utf8",
                mimeType: image.mimeType,
            };
        }

        const mimeType = match[1] || image.mimeType;
        const payload = match[3];
        if (match[2]) {
            const binary = atob(payload);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; ++i) {
                bytes[i] = binary.charCodeAt(i);
            }

            return {
                blobContent: bytes,
                content: payload,
                encoding: "base64",
                mimeType,
            };
        }

        const content = decodeURIComponent(payload);

        return {
            blobContent: content,
            content,
            encoding: "utf8",
            mimeType,
        };
    }

    private getImageFileName(resultSet: IResultSet): string {
        const image = resultSet.image;
        const caption = image?.caption ?? resultSet.caption ?? "visual-explain";
        const baseName = caption.trim().toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "visual-explain";

        return `${baseName}.${this.getImageFileExtension(image?.mimeType)}`;
    }

    private getImageFileExtension(mimeType?: string): string {
        switch (mimeType?.split(";")[0].toLowerCase()) {
            case "image/svg+xml":
                return "svg";
            case "image/png":
                return "png";
            case "image/jpeg":
                return "jpg";
            case "image/gif":
                return "gif";
            case "image/webp":
                return "webp";
            default:
                return "img";
        }
    }

    private getImageFileFilters(mimeType?: string): Record<string, string[]> {
        const extension = this.getImageFileExtension(mimeType);

        return {
            "Image Files": [extension],
            "All Files": ["*"],
        };
    }

    private updateVisualExplainOptions(options: IVisualExplainOptions): void {
        const { currentResultSet } = this.state;

        if (currentResultSet) {
            void this.props.onImageResultOptionsChange?.(currentResultSet, options);
        }
    }

    /**
     * Ask the user for confirmation if there are any pending changes.
     *
     * @param id If only certain tab ID needs to be checked. Optional
     * @returns true if the user can close the tab, false otherwise.
     */
    public canClose = async (id?: string): Promise<boolean> => {
        // Store values in a separate array before iterating over them -
        // they may be removed from #editingInfo map by the time the user confirms the operation.
        const infoValues = [...this.editingInfo.values()].filter((info) => {
            return !id || id === info.resultSet.resultId;
        });
        for (const info of infoValues) {
            if (!(await this.confirmCommitOrRollback(info))) {
                return false;
            }
        }

        return true;
    };

    /**
     * Triggers a column update in the group which belongs to the given request id.
     *
     * @param resultId The actual request ID which identifies a specific result group.
     * @param columns The columns to set.
     */
    public async updateColumns(resultId: string, columns: IColumnInfo[]): Promise<void> {
        const viewRef = this.viewRefs.get(resultId);

        /* istanbul ignore next */
        if (viewRef?.current) {
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
        if (viewRef?.current) {
            await viewRef.current.addData(newData, replace);
        }

        // The target view also updates itself when the final set comes in, but we need to update here too,
        // for the execution info display, which is managed here.
        if (newData.executionInfo) {
            this.forceUpdate();
        }
    }

    private handleTabSelection = (id: string): void => {
        const { onSelectTab, resultSets } = this.props;

        let currentIndex = 0;
        resultSets.sets.forEach((candidate, index) => {
            if (candidate.resultId === id) {
                currentIndex = index + 1; // Account for the output page.
            }
        });

        const viewRef = this.viewRefs.get(this.state.currentResultSet?.resultId ?? "")?.current;
        viewRef?.cellEditCancelled();

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

    private closeTabs = (ids: string[]) => {
        const { onRemoveResult } = this.props;

        this.props.resultSets.sets.forEach(({ resultId }) => {
            if (ids.includes(resultId)) {
                onRemoveResult?.(resultId);
            }
        });

        return Promise.resolve(true);
    };

    private handleActionMenuItemClick = (props: IMenuItemProperties): boolean => {
        const command = props.command.command;
        switch (command) {
            case "closeMenuItem": {
                const { onRemoveResult } = this.props;
                const { currentResultSet } = this.state;

                const info = this.editingInfo.get(currentResultSet?.resultId ?? "");
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

            case "saveImageMenuItem": {
                this.saveImageResult();
                break;
            }

            case "toggleMinimapMenuItem": {
                this.toggleImageMinimap();
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
            const info = this.editingInfo.get(currentResultSet.resultId);
            if (info) {
                // The user is currently editing the result set, so we need to commit or discard the changes first.
                void this.confirmCommitOrRollback(info, true).then((result) => {
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
                const { onResultPageChange, currentSet } = this.props;

                ++currentResultSet.data.currentPage;
                onResultPageChange?.(currentResultSet.resultId, currentResultSet.data.currentPage,
                    currentResultSet.sql, currentSet);
            }
        };

        // istanbul ignore else
        if (currentResultSet) {
            const info = this.editingInfo.get(currentResultSet.resultId);
            if (info) {
                // The user is currently editing the result set, so we need to commit or discard the changes first.
                void this.confirmCommitOrRollback(info, true).then((result) => {
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
     * @param refreshResults Whether data needs to be refreshed.
     *
     * @returns true if the user can navigate away, false otherwise.
     */
    private confirmCommitOrRollback = async (info: IEditingInfo, refreshResults = false): Promise<boolean> => {
        if (info.rowChanges.length === 0) {
            return true;
        }

        // The user is currently editing the result set, so we need to commit or discard the changes first.
        const response = await DialogHost.showDialog({
            id: "commitOrCancelChanges",
            type: DialogType.Confirm,
            parameters: {
                title: "Confirmation",
                prompt: `The result set for ${info.description} is currently being edited, do you want to commit or ` +
                    `discard the changes before continuing?`,
                accept: "Commit",
                refuse: "Discard",
                alternative: "Cancel",
                default: "Cancel",
            },
        });

        switch (response.closure) {
            case DialogResponseClosure.Accept: {
                void this.commitChanges(info, refreshResults);

                return true;
            }

            case DialogResponseClosure.Decline: {
                const { resultSet } = info;
                this.discardChanges(resultSet);

                return true;
            }

            default: {
                return false;
            }
        }
    };

    /**
     * Called when the user wants to discard all changes.
     *
     * @returns true if the data can be discarded, false otherwise.
     */
    private confirmRollback = async (): Promise<boolean> => {
        const { currentResultSet } = this.state;

        if (currentResultSet) {
            const info = this.editingInfo.get(currentResultSet.resultId);
            if (info && info.rowChanges.length > 0) {
                // The user is currently editing the result set, so we need to commit or discard the changes first.
                const response = await DialogHost.showDialog({
                    id: "cancelChanges",
                    type: DialogType.Confirm,
                    title: "Confirmation",
                    parameters: {
                        prompt: `Do you really want to discard all changes?`,
                        accept: "Discard",
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
     * The user started editing a (new) field. Switch to edit mode, if not yet done.
     */
    private onFieldEditStart = (): void => {
        const { currentResultSet } = this.state;

        if (!currentResultSet) {
            return;
        }

        const info = this.editingInfo.get(currentResultSet.resultId);
        if (!info) {
            this.startEditing();
        }
    };

    private cellValuesEqual = (newValue: unknown, previousValue: unknown): boolean => {
        if (Object.is(newValue, previousValue)) {
            return true;
        }

        if (newValue == null || previousValue == null) {
            return false;
        }

        const newValueType = typeof newValue;
        const previousValueType = typeof previousValue;
        const comparablePrimitiveTypes = ["boolean", "bigint", "number", "string"];
        if (comparablePrimitiveTypes.includes(newValueType) && comparablePrimitiveTypes.includes(previousValueType)) {
            return String(newValue) === String(previousValue);
        }

        return false;
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
                resolve();

                return;
            }

            let info = this.editingInfo.get(currentResultSet.resultId);
            let rowChanges = info?.rowChanges[row];
            if (this.cellValuesEqual(newValue, previousValue)) {
                if (!info) {
                    resolve();

                    return;
                }

                if (Object.keys(info.rowChanges).length === 0) {
                    this.editingInfo.delete(currentResultSet.resultId);
                    this.forceUpdate(() => {
                        resolve();
                    });

                    return;
                }

                resolve();

                return;
            }

            if (!info) {
                // Not yet editing, initialize the editing info.
                info = this.prepareEditingInfo(currentResultSet);

                this.editingInfo.set(currentResultSet.resultId, info);
            }

            // Update the editing info.
            rowChanges = info.rowChanges[row];
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!rowChanges) { // rowChanges is a sparse array.
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

            let existingChangeIndex = -1;
            for (let i = rowChanges.changes.length - 1; i >= 0; --i) {
                if (rowChanges.changes[i].field === field) {
                    existingChangeIndex = i;
                    break;
                }
            }

            if (existingChangeIndex > -1) {
                rowChanges.changes[existingChangeIndex].value = newValue;
            } else {
                rowChanges.changes.push({ field, value: newValue });
            }

            this.updateEditingStatus(info);
            info.selectedRowIndex = undefined;
            this.forceUpdate(() => {
                resolve();
            });
        });
    };

    /**
     * Called when the user cancels editing a field. If there are no more changes, editing is stopped.
     * Otherwise the changes are kept and editing continues.
     */
    private onFieldEditCancel = (row: number, field: string, restoredValue: unknown, restoreChange: boolean): void => {
        const { currentResultSet } = this.state;

        if (!currentResultSet) {
            return;
        }

        const info = this.editingInfo.get(currentResultSet.resultId);
        if (!info) {
            return;
        }

        const { rowChanges } = info;
        const rowChange = rowChanges[row];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (rowChange) { // rowChanges is a sparse array.
            const changeIndex = rowChange.changes.findIndex((change) => {
                return change.field === field;
            });

            if (restoreChange) {
                if (changeIndex === -1) {
                    rowChange.changes.push({ field, value: restoredValue });
                } else {
                    rowChange.changes[changeIndex].value = restoredValue;
                }
            } else if (changeIndex > -1) {
                rowChange.changes.splice(changeIndex, 1);
            }

            if (!rowChange.added && !rowChange.deleted && rowChange.changes.length === 0) {
                delete rowChanges[row];
            }
        }

        if (Object.keys(rowChanges).length === 0) {
            this.editingInfo.delete(currentResultSet.resultId);
        } else {
            this.updateEditingStatus(info);
        }

        this.forceUpdate();
    };

    /**
     * Called when the user toggles the deletion mark for one or more rows.
     *
     * @param rows The row indexes to toggle.
     */
    private onToggleRowDeletionMarks = (rows: number[]): void => {
        const { currentResultSet } = this.state;

        if (currentResultSet) {
            let info: IEditingInfo;

            if (this.editingInfo.has(currentResultSet.resultId)) {
                // Already editing, just get the editing info.
                info = this.editingInfo.get(currentResultSet.resultId)!;
            } else {
                // Not yet editing, initialize the editing info.
                info = {
                    description: `table ${currentResultSet.fullTableName}`,
                    statusInfo: {
                        text: "",
                    },
                    resultSet: currentResultSet,
                    rowChanges: [],
                    previewActive: false,
                } as IEditingInfo;

                this.editingInfo.set(currentResultSet.resultId, info);
            }

            // Update the editing info.
            rows.forEach((row) => {
                const rowChanges = info.rowChanges[row];
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (rowChanges) { // rowChanges is a sparse array.
                    // There's a row change, toggle the deleted state.
                    // Note: this could be a new row, in which case this row is ignored, unless the deleted state
                    // is set to false again.
                    rowChanges.deleted = !rowChanges.deleted;

                    if (!rowChanges.deleted && rowChanges.changes.length === 0) {
                        // No changes left, remove the row.
                        // eslint-disable-next-line @typescript-eslint/no-array-delete
                        delete info.rowChanges[row]; // Need to maintain the sparse array, so `splice` is not an option.
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
            this.forceUpdate();
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
            viewRef?.current?.editSelectedOrFirstCell();
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

                            return { field: column.field, value: defaultCellValue };
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
                        this.forceUpdate(() => {
                            resolve();
                        });
                    } else {
                        resolve();
                    }

                    break;
                }

                case "commit": {
                    void this.commitChanges();
                    resolve();

                    break;
                }

                case "rollback": {
                    this.cancelEditingAndRollbackChanges();
                    resolve();

                    break;
                }

                default: {
                    resolve();
                    break;
                }
            }
        });
    };

    private commitChanges = async (info?: IEditingInfo, refreshResults = true): Promise<void> => {
        const { onCommitChanges, onResultPageChange } = this.props;
        const { currentResultSet } = this.state;

        const resultId = info?.resultSet.resultId ?? currentResultSet?.resultId;
        if (resultId) {
            await this.viewRefs.get(resultId)?.current?.finishCellEditingForCommit();
        }

        info ??= this.editingInfo.get(resultId ?? "");
        if (info) {
            const statements = this.generateStatements(info).map((pair) => {
                return pair[1];
            });

            void onCommitChanges?.(info.resultSet, statements).then((result) => {
                this.affectedRows.set(info.resultSet.resultId, result.affectedRows);

                if (result.errors.length > 0) {
                    // We got an error (can only be one as execution is stopped on the first error).
                    // Do not end editing, but show the error in the SQL preview pane.
                    info.errors = result.errors;
                    info.previewActive = true;
                    this.forceUpdate();
                } else {
                    this.editingInfo.delete(info.resultSet.resultId);

                    if (refreshResults) {
                        // Use the page switch callback to refresh the result set.
                        onResultPageChange?.(info.resultSet.resultId, info.resultSet.data.currentPage,
                            info.resultSet.sql);
                    }
                    this.forceUpdate();
                }
            });
        }
    };

    private refresh = (): void => {
        const { updateRowsForResultId, onResultPageChange } = this.props;
        const { currentResultSet } = this.state;
        if (!updateRowsForResultId || !currentResultSet) {
            return;
        }
        void updateRowsForResultId(currentResultSet).then(() => {
            onResultPageChange?.(currentResultSet.resultId, currentResultSet.data.currentPage, currentResultSet.sql);
        });
    };

    private cancelEditingAndRollbackChanges = (): void => {
        const { currentResultSet } = this.state;

        if (currentResultSet) {
            void this.confirmRollback().then((result) => {
                if (result) {
                    this.discardChanges(currentResultSet);
                }
            });
        }
    };

    private discardCurrentChanges = (): void => {
        const { currentResultSet } = this.state;

        if (currentResultSet) {
            this.discardChanges(currentResultSet);
        }
    };

    private discardChanges(resultSet: IResultSet): void {
        const { onRollbackChanges } = this.props;

        this.viewRefs.get(resultSet.resultId)?.current?.cancelCellEditingForDiscard();
        onRollbackChanges?.(resultSet);
        this.editingInfo.delete(resultSet.resultId);
        this.forceUpdate();
    }

    /**
     * @param info The editing info for the result set.
     *
     * @returns A statement for each row change (insert, update, delete).
     */
    private generateStatements = (info: IEditingInfo): Array<[number, string]> => {
        const { upperCaseKeywords } = this.props;
        const { rowChanges, resultSet } = info;

        const builder = new QueryBuilder(resultSet.fullTableName, resultSet.columns, upperCaseKeywords);

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

    private selectView = (previewActive: boolean, focusSelection = false): void => {
        const { currentResultSet } = this.state;

        if (!currentResultSet) {
            return;
        }

        const info = this.editingInfo.get(currentResultSet.resultId);
        if (!info) {
            return;
        }

        info.previewActive = previewActive;
        this.forceUpdate();

        if (focusSelection) {
            const buttonId = previewActive ? "viewPreviewButton" : "viewGridButton";
            setTimeout(() => {
                document.getElementById(buttonId)?.focus();
            }, 0);
        }
    };

    private handleViewSelectorClick = (e: MouseEvent | KeyboardEvent): void => {
        this.selectView((e.currentTarget as HTMLElement).id === "viewPreviewButton");
    };

    private handleViewSelectorKeyDown = (e: KeyboardEvent): void => {
        const { currentResultSet } = this.state;
        const info = currentResultSet ? this.editingInfo.get(currentResultSet.resultId) : undefined;
        let previewActive: boolean | undefined;

        switch (e.key) {
            case "ArrowLeft":
            case "ArrowUp": {
                previewActive = false;
                break;
            }

            case "ArrowRight":
            case "ArrowDown": {
                previewActive = true;
                break;
            }

            case " ":
            case "Spacebar":
            case "Enter": {
                previewActive = (e.currentTarget as HTMLElement).id === "viewPreviewButton";
                break;
            }

            default: {
                return;
            }
        }

        e.preventDefault();
        e.stopImmediatePropagation();

        if (previewActive && !info) {
            return;
        }

        this.selectView(previewActive, true);
    };

    private prepareEditingInfo = (resultSet: IResultSet): IEditingInfo => {
        let info = this.editingInfo.get(resultSet.resultId);
        if (!info) {
            this.affectedRows.delete(resultSet.resultId);
            info = {
                description: `table ${resultSet.fullTableName}`,
                statusInfo: {
                    text: "",
                },
                resultSet,
                rowChanges: [],
                previewActive: false,
            };

            this.editingInfo.set(resultSet.resultId, info);
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
            const info = this.editingInfo.get(currentResultSet.resultId);
            if (info) {
                info.previewActive = false;
                info.selectedRowIndex = index;
                this.forceUpdate();
            }
        }
    };
}
