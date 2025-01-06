/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import "./Tabview.css";

import { ComponentChild, createRef } from "preact";

import { Codicon } from "../Codicon.js";
import { convertPropValue } from "../../../utilities/string-helpers.js";
import { IComponentProperties, ComponentBase, ComponentPlacement,
    IComponentState } from "../Component/ComponentBase.js";
import { Orientation, Container } from "../Container/Container.js";
import { Button, IButtonProperties } from "../Button/Button.js";
import { Icon } from "../Icon/Icon.js";
import { Label } from "../Label/Label.js";
import { Menu } from "../Menu/Menu.js";
import { IMenuItemProperties, MenuItem } from "../Menu/MenuItem.js";

export enum TabPosition {
    Top = "top",
    Right = "right",
    Bottom = "bottom",
    Left = "left",
}

export enum CloseMenuItem {
    CloseTab = "closeTab",
    CloseOthers = "closeOthers",
    CloseRight = "closeRight",
    CloseAll = "closeAll",
}

/** The description for a tab page. */
export interface ITabviewPage {
    id: string;

    /** An image shown as the first entry on a tab, if assigned. */
    icon?: string | Codicon;

    /** A tab's title. */
    caption: string;

    /** Tooltip for the tab. */
    tooltip?: string;

    /** Additional content that should be added on the right side of a tab. */
    auxiliary?: ComponentChild;

    /** The content to show in the tabview body, when this tab is active. */
    content: ComponentChild;

    canClose?: boolean;
}

interface ITabviewProperties extends IComponentProperties {
    innerRef?: preact.RefObject<HTMLElement>;

    /** The positions of the tabs around the content pane. */
    tabPosition?: TabPosition;

    /** The tab page to make active initially. */
    selectedId?: string;

    /** Make all tabs equal size and fill the entire tabview size. */
    stretchTabs?: boolean;

    /** When true and there's only a single (or no) tab then the tab area is not shown. */
    hideSingleTab?: boolean;

    /** Set to false to disable tabs entirely. */
    showTabs?: boolean;

    // If set to 0 or undefined no border effect will be visible on an item, except for the selection marker.
    tabBorderWidth?: number;

    /** If set to 0 or undefined no separator line is shown between content and tabs. */
    contentSeparatorWidth?: number;

    /** If set to true then tabs can be re-ordered via drag and drop. */
    canReorderTabs?: boolean;

    /** The pages to show. */
    pages: ITabviewPage[];

    /** Additional content that should be added on the right side of a tab area. */
    auxillary?: ComponentChild;

    /** Triggered when the user selects a tab, even if it is the tab, which is already active. */
    onSelectTab?: (id: string) => void;

    /** Triggered when the user drags a tab item to a new position. */
    onMoveTab?: (id: string, fromIndex: number, toIndex: number) => void;

    closeTabs?: (ids: string[]) => Promise<unknown>;
    canCloseTab?: (id: string) => Promise<boolean>;
}

interface IState extends IComponentState {
    closeTabDisabled: boolean;
    closeOthersDisabled: boolean;
    closeRightDisabled: boolean;
    closeAllDisabled: boolean;
}

/**
 * A tabview is a collection of containers of which only one is rendered at a given time.
 * Which one is determined by the `active` property.
 * Usually a tabview is combined with a tab bar, to select an active tab.
 */
export class Tabview extends ComponentBase<ITabviewProperties, IState> {

    public static override defaultProps = {
        tabPosition: TabPosition.Top,
        stretchTabs: true,
        hideSingleTab: false,
        showTabs: true,
    };

    private contentRef = createRef<HTMLDivElement>();
    private sliderRef = createRef<HTMLDivElement>();
    private tabAreaRef = createRef<HTMLDivElement>();

    private trackingSliderMove = false;
    private lastSliderPosition = 0;

    private resizeObserver?: ResizeObserver;

    private tabMenuRef = createRef<Menu>();

    public constructor(props: ITabviewProperties) {
        super(props);

        this.addHandledProperties("tabPosition", "selectedId", "stretchTabs", "hideSingleTab", "showTabs", "pages",
            "onSelectTab", "tabBorderWidth", "style", "canReorderTabs", "contentSeparatorWidth", "onMoveTab");

        // istanbul ignore next
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(this.handleResize);
        }

        if (props.canReorderTabs) {
            this.connectDragEvents();
        }

        this.state = {
            closeTabDisabled: false,
            closeOthersDisabled: false,
            closeRightDisabled: false,
            closeAllDisabled: false,
        };
    }

    public static getSelectedPageId(remainingPageIds: string[], previouslySelected: string | undefined,
        closingIds: string[], defaultSelection: string): string {

        if (!remainingPageIds.length && defaultSelection) {
            return defaultSelection;
        }

        if (previouslySelected && !closingIds.includes(previouslySelected)) {
            return previouslySelected;
        }

        return remainingPageIds[remainingPageIds.length - 1];
    }

    public override componentDidMount(): void {
        this.resizeObserver?.observe(this.contentRef.current as Element);
    }

    public override componentDidUpdate(): void {
        this.scrollActiveItemIntoView();
        this.handleResize();
    }

    public render(): ComponentChild {
        const {
            tabPosition, stretchTabs, hideSingleTab, pages, tabBorderWidth, style, contentSeparatorWidth, selectedId,
            showTabs, canReorderTabs, auxillary,
        } = this.props;

        const className = this.getEffectiveClassNames([
            "tabview",
            tabPosition,
        ]);

        const tabs = pages.map((page: ITabviewPage) => {
            let buttonClassName = "tabItem" + (page.auxiliary ? " hasAuxillary" : "");
            if (page.id === selectedId) {
                buttonClassName += " selected";
            }

            return (
                <Button
                    data-tooltip={page.tooltip}
                    id={page.id}
                    key={page.id}
                    tabIndex={-1}
                    className={buttonClassName}
                    focusOnClick={false}
                    draggable={canReorderTabs}
                    onClick={this.selectTab}
                    onContextMenu={this.showTabMenu}
                    onDragEnter={this.handleTabItemDragEnter}
                    onDrop={this.handleTabItemDrop}
                >
                    {page.icon && <Icon src={page.icon} data-tooltip="inherit" />}
                    {page.caption && <Label data-tooltip="inherit">{page.caption}</Label>}
                    {page.auxiliary && <span id="auxillary">{page.auxiliary}</span>}
                </Button>
            );
        });

        let content;
        const index = pages.findIndex((page: ITabviewPage) => {
            return page.id === selectedId;
        });

        if (index > -1) {
            content = pages[index].content;
        }

        let orientation: Orientation;
        let tabOrientation: Orientation;
        switch (tabPosition) {
            case TabPosition.Top: {
                orientation = Orientation.TopDown;
                tabOrientation = Orientation.LeftToRight;
                break;
            }

            case TabPosition.Right: {
                orientation = Orientation.RightToLeft;
                tabOrientation = Orientation.TopDown;
                break;
            }

            case TabPosition.Bottom: {
                orientation = Orientation.BottomUp;
                tabOrientation = Orientation.LeftToRight;
                break;
            }

            default: {
                orientation = Orientation.LeftToRight;
                tabOrientation = Orientation.TopDown;
                break;
            }
        }

        const newStyle = {
            ...style, ...{
                // eslint-disable-next-line @typescript-eslint/naming-convention
                "--tabItem-border-width": convertPropValue(tabBorderWidth ?? 0),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                "--content-separator-width": convertPropValue(contentSeparatorWidth ?? 0),
            },
        };

        const tabAreaClassName = "tabArea" + (stretchTabs ? " stretched" : "");

        return (
            <Container
                orientation={orientation}
                className={className}
                style={newStyle}
                {...this.unhandledProperties}
            >
                {
                    (showTabs && (!hideSingleTab || tabs.length > 1)) && (
                        <Container
                            orientation={tabOrientation}
                            className="tabAreaContainer"
                            fixedScrollbars={false}
                        >
                            <div className="scrollable"
                                onWheel={this.handleWheel}
                            >
                                <Container
                                    innerRef={this.tabAreaRef}
                                    className={tabAreaClassName}
                                    orientation={tabOrientation}
                                    fixedScrollbars={false}
                                    onDragOver={this.handleTabviewDragOver}
                                    onDrop={this.handleTabItemDrop}
                                >
                                    {tabs}
                                </Container>
                                <div className="scrollbar">
                                    <div
                                        className="slider"
                                        ref={this.sliderRef}
                                        onPointerDown={this.handleSliderDown}
                                        onPointerMove={this.handleSliderMove}
                                        onPointerUp={this.handleSliderUp}
                                    />
                                </div>
                            </div>
                            {auxillary && <span className="auxillary">{auxillary}</span>}
                            {this.props.closeTabs && (
                                <Menu
                                    id="tabMenu"
                                    ref={this.tabMenuRef}
                                    placement={ComponentPlacement.BottomLeft}
                                    onItemClick={this.handleContextMenuClick}
                                >
                                    <MenuItem
                                        id={CloseMenuItem.CloseTab}
                                        command={{ title: "Close", command: CloseMenuItem.CloseTab }}
                                        disabled={this.state.closeTabDisabled}
                                    />
                                    <MenuItem
                                        id={CloseMenuItem.CloseOthers}
                                        command={{ title: "Close Others", command: CloseMenuItem.CloseOthers }}
                                        disabled={this.state.closeOthersDisabled}
                                    />
                                    <MenuItem
                                        id={CloseMenuItem.CloseRight}
                                        command={{ title: "Close to the Right", command: CloseMenuItem.CloseRight }}
                                        disabled={this.state.closeRightDisabled}
                                    />
                                    <MenuItem
                                        id={CloseMenuItem.CloseAll}
                                        command={{ title: "Close All", command: CloseMenuItem.CloseAll }}
                                        disabled={this.state.closeAllDisabled}
                                    />
                                </Menu>
                            )}
                        </Container>
                    )
                }
                <Container
                    innerRef={this.contentRef}
                    orientation={Orientation.TopDown}
                    className="tabContent"

                    onDrop={this.handleTabviewDrop}
                    onDragEnter={this.handleTabviewDragEnter}
                    onDragLeave={this.handleTabviewDragLeave}
                    onDragOver={this.handleTabviewDragOver}
                >
                    {content}
                </Container>
            </Container>
        );
    }

    private handleTabviewDragEnter = (e: DragEvent): void => {
        e.stopPropagation();
        e.preventDefault();

        (e.currentTarget as HTMLElement).classList.add("dropTarget");
    };

    private handleTabviewDragLeave = (e: DragEvent): void => {
        e.stopPropagation();
        e.preventDefault();

        (e.currentTarget as HTMLElement).classList.remove("dropTarget");
    };

    private handleTabviewDragOver = (e: DragEvent): void => {
        e.preventDefault();
        e.stopPropagation();
    };

    private handleTabviewDrop = (e: DragEvent, props: IComponentProperties): void => {
        e.stopPropagation();
        e.preventDefault();

        (e.currentTarget as HTMLElement).classList.remove("dropTarget");

        const { onDrop } = this.props;

        onDrop?.(e, props);
    };

    private selectTab = (event: MouseEvent | KeyboardEvent, props: IButtonProperties): void => {
        const { onSelectTab } = this.props;

        onSelectTab?.(props.id!);
    };

    private handleTabItemDragEnter = (e: DragEvent, props: IButtonProperties): void => {
        // Determine the drag effect for that button.
        if (e.dataTransfer) {
            const sourceId = this.getDragSourceId(e);
            if (sourceId && sourceId !== props.id) {
                e.dataTransfer.dropEffect = "move";
                e.preventDefault();
                e.stopPropagation();
            } else {
                e.dataTransfer.dropEffect = "none";
            }
        }
    };

    /**
     * Triggered by a mouse drop operation on either the selector or one of its items.
     *
     * @param e The drop event, which also contains the data for the drop operation.
     *
     * @param props The properties of the receiver of the drop operation.
     */
    private handleTabItemDrop = (e: DragEvent, props: IComponentProperties): void => {
        // See if that is a request to change the order of the tabs.
        // Note: the dropEffect field is not set by the browser.
        if (!e.dataTransfer) {
            return;
        }

        const items = e.dataTransfer?.items;

        if (items) {
            const sourceId = this.getDragSourceId(e);
            if (sourceId) {
                const { pages, onMoveTab } = this.props;
                const sourceIndex = pages.findIndex((page: ITabviewPage) => { return page.id === sourceId; });
                if (sourceIndex > -1) {
                    let targetIndex = pages.length - 1;
                    if (props.id && props.id?.length > 0) {
                        // Move the item to the position of the target item.
                        targetIndex = pages.findIndex((page: ITabviewPage) => { return page.id === props.id; });
                    }

                    if (targetIndex > -1 && sourceIndex !== targetIndex) {
                        const page = pages[sourceIndex];
                        pages.splice(sourceIndex, 1);
                        pages.splice(targetIndex, 0, page);

                        onMoveTab?.(sourceId, sourceIndex, targetIndex);
                    }
                }
            }
        }
    };

    /**
     * Checks the drag event for a source id, which denotes one of the tab buttons.
     *
     * @param e The drag event with the drag data to check.
     *
     * @returns The source id, if the data at least one entry which is a source id.
     */
    private getDragSourceId = (e: DragEvent): string | undefined => {
        if (!e.dataTransfer) {
            return undefined;
        }

        const items = e.dataTransfer?.items;

        if (items && items.length > 0) {
            const item = items[0];
            if (item.kind === "string" && item.type.startsWith("sourceid:")) {
                return item.type.substring("sourceid:".length);
            }
        }

        return undefined;
    };

    /**
     * Update the slider position when when the tab width changes.
     */
    private handleResize = (): void => {
        if (this.sliderRef.current && this.tabAreaRef.current) {
            const scrollWidth = this.tabAreaRef.current.scrollWidth;
            const clientWidth = this.tabAreaRef.current.clientWidth;

            if (scrollWidth > clientWidth) {
                const sliderWidth = clientWidth * clientWidth / scrollWidth;
                this.sliderRef.current.style.width = `${sliderWidth}px`;
                this.sliderRef.current.style.display = "block";
            } else {
                this.sliderRef.current.style.display = "none";
            }
        }
    };

    /**
     * Start tracking the slider movement on left mouse down and capture the mouse pointer.
     *
     * @param e The mouse event.
     */
    private handleSliderDown = (e: PointerEvent): void => {
        if (e.buttons === 1) {
            this.trackingSliderMove = true;
            this.lastSliderPosition = e.clientX;
            this.sliderRef.current?.setPointerCapture(e.pointerId);
        }
    };

    /**
     * In slider tracking mode update both the slider position and the tab are scroll position on pointer move.
     *
     * @param e The pointer event.
     */
    private handleSliderMove = (e: PointerEvent): void => {
        if (this.trackingSliderMove && this.sliderRef.current && this.tabAreaRef.current) {
            const clientWidth = this.tabAreaRef.current.clientWidth;
            const sliderWidth = this.sliderRef.current?.clientWidth ?? 0;
            const sliderLeftMax = clientWidth - sliderWidth;
            const delta = e.clientX - this.lastSliderPosition;
            let sliderLeft = this.sliderRef.current.offsetLeft + delta;
            if (sliderLeft < 0) {
                sliderLeft = 0;
            }
            if (sliderLeft > sliderLeftMax) {
                sliderLeft = sliderLeftMax;
            }

            this.sliderRef.current.style.left = `${sliderLeft}px`;
            this.lastSliderPosition = e.clientX;

            const scrollLeftMax = this.tabAreaRef.current.scrollWidth - clientWidth;
            const newScrollLeft = scrollLeftMax * sliderLeft / sliderLeftMax;
            this.tabAreaRef.current.scrollLeft = newScrollLeft;
        }
    };

    /**
     * Stops slider tracking mode and releases the pointer capture.
     *
     * @param e The pointer event.
     */
    private handleSliderUp = (e: PointerEvent): void => {
        this.trackingSliderMove = false;
        this.sliderRef.current?.releasePointerCapture(e.pointerId);
    };

    /**
     * Auto scrolls the active tab item into view. Updates both the tab area and the slider position.
     */
    private scrollActiveItemIntoView = (): void => {
        const { selectedId } = this.props;

        if (this.tabAreaRef.current && selectedId) {
            const tabArea = this.tabAreaRef.current;
            const activeTab = document.getElementById(`${selectedId}`);
            if (activeTab) {
                const tabAreaRect = tabArea.getBoundingClientRect();
                const activeTabRect = activeTab.getBoundingClientRect();

                if (activeTabRect.left < tabAreaRect.left) {
                    tabArea.scrollLeft -= tabAreaRect.left - activeTabRect.left;
                } else if (activeTabRect.right > tabAreaRect.right) {
                    tabArea.scrollLeft += activeTabRect.right - tabAreaRect.right;
                }

                const sliderLeft = tabArea.scrollLeft * tabArea.clientWidth / tabArea.scrollWidth;
                this.sliderRef.current!.style.left = `${sliderLeft}px`;
            }
        }
    };

    private handleWheel = (e: WheelEvent): void => {
        if (this.tabAreaRef.current) {
            const tabArea = this.tabAreaRef.current;
            tabArea.scrollLeft += e.deltaX;

            const sliderLeft = tabArea.scrollLeft * tabArea.clientWidth / tabArea.scrollWidth;
            this.sliderRef.current!.style.left = `${sliderLeft}px`;
        }
    };

    private getTabById(id: string): ITabviewPage | undefined {
        return this.props.pages.find((p) => {
            return p.id === id;
        });
    }

    private showTabMenu = (event: MouseEvent): void => {
        event.preventDefault();
        event.stopPropagation();

        this.tabMenuRef.current?.close();

        if (!this.props.closeTabs) {
            return;
        }

        const currentTabId = (event.currentTarget as HTMLElement).id;
        if (!currentTabId) {
            return;
        }

        // Hide menu completely if there are no tabs to close.
        if (!this.getTabById(currentTabId) || !this.getClosingAllTabIds().length) {
            return;
        }

        const targetRect = new DOMRect(event.clientX, event.clientY, 2, 2);

        const newState: IState = {
            closeTabDisabled: this.isMenuItemDisabled(CloseMenuItem.CloseTab, currentTabId),
            closeOthersDisabled: this.isMenuItemDisabled(CloseMenuItem.CloseOthers, currentTabId),
            closeRightDisabled: this.isMenuItemDisabled(CloseMenuItem.CloseRight, currentTabId),
            closeAllDisabled: this.isMenuItemDisabled(CloseMenuItem.CloseAll, currentTabId),
        };

        this.setState(newState, () => {
            this.tabMenuRef.current?.open(targetRect, false, {}, currentTabId);
        });
    };

    private async closeIfAllowed(ids: string[]): Promise<void> {
        if (!this.props.closeTabs) {
            return;
        }

        const closingIds = ids;
        for (const [index, id] of ids.entries()) {
            let canClose = true;
            if (this.props.canCloseTab) {
                canClose = await this.props.canCloseTab(id);
            }
            if (!canClose) {
                closingIds.splice(index, 1);
            }
        }

        void this.props.closeTabs?.(closingIds);
    }

    private getClosingOtherTabIds(ownId: string): string[] {
        return this.props.pages.filter((page) => {
            return page.id !== ownId && page.canClose;
        }).map((page) => {
            return page.id;
        });
    }

    private closeOthers(currentTabId: string): void {
        const closingIds = this.getClosingOtherTabIds(currentTabId);

        void this.closeIfAllowed(closingIds);
    }

    private getClosingToTheRightTabIds(ownId: string): string[] {
        const closingIds: string[] = [];

        let closeAfterIndex = Infinity;
        this.props.pages.forEach((page, index) => {
            if (!page.canClose) {
                return;
            }
            const isOwn = page.id === ownId;
            if (isOwn) {
                closeAfterIndex = index;
            }

            if (index > closeAfterIndex) {
                closingIds.push(page.id);
            }
        });

        return closingIds;
    }

    private closeRight(currentTabId: string): void {
        const closingIds = this.getClosingToTheRightTabIds(currentTabId);

        void this.closeIfAllowed(closingIds);
    }

    private getClosingAllTabIds(): string[] {
        return this.props.pages.filter((page) => {
            return page.canClose;
        }).map((page) => {
            return page.id;
        });
    }

    private closeAll(): void {
        const closingIds = this.getClosingAllTabIds();

        void this.closeIfAllowed(closingIds);
    }

    private closeTab(id: string): void {
        void this.closeIfAllowed([id]);
    }

    private handleContextMenuClick = (props: IMenuItemProperties, altActive: boolean,
        currentTabId: unknown): boolean => {
        this.tabMenuRef.current?.close();

        switch (props.id! as CloseMenuItem) {
            case CloseMenuItem.CloseTab: {
                this.closeTab(currentTabId as string);

                break;
            }
            case CloseMenuItem.CloseAll: {
                this.closeAll();

                break;
            }
            case CloseMenuItem.CloseOthers: {
                this.closeOthers(currentTabId as string);

                break;
            }
            case CloseMenuItem.CloseRight: {
                this.closeRight(currentTabId as string);

                break;
            }

            default:
                break;
        }

        return true;
    };

    private isMenuItemDisabled = (menuItemId: CloseMenuItem, currentTabId: string): boolean => {
        const currentTab = this.getTabById(currentTabId);
        const canClose = !!currentTab?.canClose;

        switch (menuItemId) {
            case CloseMenuItem.CloseTab: {
                return !canClose; // Disable when menu is under non-closable tab.
            }
            case CloseMenuItem.CloseOthers: {
                return !canClose
                    || !this.getClosingOtherTabIds(currentTab.id).length;
            }
            case CloseMenuItem.CloseRight: {
                return !canClose
                    || !this.getClosingToTheRightTabIds(currentTab.id).length;
            }
            case CloseMenuItem.CloseAll: {
                return !this.getClosingAllTabIds().length;
            }
            default: {
                return false;
            }
        }
    };
}
