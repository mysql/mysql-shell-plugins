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

import "./Tabview.css";

import React from "react";

import { Component, IComponentProperties, Orientation, Selector, Container, ISelectorDef } from "..";
import { Codicon } from "../Codicon";
import { convertPropValue } from "../../../utilities/string-helpers";

export enum TabPosition {
    Top = "top",
    Right = "right",
    Bottom = "bottom",
    Left = "left",
}

export interface ITabviewPage {
    id: string;

    icon?: string | Codicon;
    caption: string;
    tooltip?: string;            // Tooltip for the tab.
    auxillary?: React.ReactNode;

    content: React.ReactNode;
}

export interface ITabviewProperties extends IComponentProperties {
    innerRef?: React.RefObject<HTMLElement>;

    tabPosition?: TabPosition; // The positions of the tabs around the content pane.
    selectedId?: string;       // The tab page to make active initially.
    stretchTabs?: boolean;     // Make all tabs equal size and fill the entire tabview size.
    hideSingleTab?: boolean;   // When true and there's only a single (or no) tab then the tab area is not shown.
    showTabs?: boolean;        // Set to false to disable tabs entirely.

    // If set to 0 or undefined no border effect will be visible on an item, except for the selection marker.
    tabBorderWidth?: number;
    contentSeparatorWidth?: number; // If set to 0 or undefined no separator line is shown between content and tabs.
    canReorderTabs?: boolean;

    pages: ITabviewPage[];

    onSelectTab?: (id: string) => void;
    onMoveTab?: (id: string, fromIndex: number, toIndex: number) => void;
}

// A tabview is a collection of containers of which only one is rendered at a given time.
// Which one is determined by the `active` property.
// Usually a tabview is combined with a tab bar, to select an active tab.
export class Tabview extends Component<ITabviewProperties> {

    public static defaultProps = {
        tabPosition: TabPosition.Top,
        stretchTabs: true,
        hideSingleTab: false,
        showTabs: true,
    };

    private selectorRef = React.createRef<Selector>();
    private contentRef = React.createRef<HTMLElement>();

    public constructor(props: ITabviewProperties) {
        super(props);

        this.addHandledProperties("tabPosition", "selectedId", "stretchTabs", "hideSingleTab", "showTabs", "pages",
            "onSelectTab", "tabBorderWidth", "style", "canReorderTabs", "contentSeparatorWidth", "onMoveTab");
    }

    public render(): React.ReactNode {
        const {
            tabPosition, stretchTabs, hideSingleTab, pages, tabBorderWidth, style, canReorderTabs,
            contentSeparatorWidth, selectedId, showTabs,
        } = this.mergedProps;

        const className = this.getEffectiveClassNames([
            "tabview",
            tabPosition,
        ]);

        const tabs = pages.map((page: ITabviewPage): ISelectorDef => {
            return {
                caption: page.caption,
                tooltip: page.tooltip,
                icon: page.icon,
                auxillary: page.auxillary,
                id: page.id,
                canReorder: canReorderTabs,
            };
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
                "--tabItem-border-width": convertPropValue(tabBorderWidth || 0),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                "--content-separator-width": convertPropValue(contentSeparatorWidth || 0),
            },
        };

        const selectorClassName = "tabArea" + (stretchTabs ? " stretched" : "");

        return (
            <Container
                orientation={orientation}
                className={className}
                style={newStyle}
                {...this.unhandledProperties}
            >
                {
                    (showTabs && (!hideSingleTab || tabs.length > 1)) && <Selector
                        ref={this.selectorRef}
                        className={selectorClassName}
                        items={tabs}
                        orientation={tabOrientation}
                        entryOrientation={Orientation.LeftToRight}
                        wrapNavigation={false}
                        onSelect={this.selectTab}
                        activeItemId={selectedId}
                        onDrop={this.handleSelectorDrop}
                    >
                    </Selector>
                }
                <Container
                    innerRef={this.contentRef}
                    orientation={Orientation.TopDown}
                    className="content"

                    onDrop={this.handleDrop}
                    onDragEnter={this.handleDragEnter}
                    onDragLeave={this.handleDragLeave}
                    onDragOver={this.handleDragOver}
                >
                    {content}
                </Container>
            </Container>
        );
    }

    private handleDragEnter = (e: React.DragEvent<HTMLElement>): void => {
        e.stopPropagation();
        e.preventDefault();

        //replaceClass(e.currentTarget, "", "dropTarget");
    };

    private handleDragLeave = (e: React.DragEvent<HTMLElement>): void => {
        e.stopPropagation();
        e.preventDefault();

        //replaceClass(e.currentTarget, "dropTarget");
    };

    private handleDragOver = (e: React.DragEvent<HTMLElement>): void => {
        e.preventDefault();
        e.stopPropagation();
    };

    private handleDrop = (e: React.DragEvent<HTMLElement>, props: IComponentProperties): void => {
        e.stopPropagation();
        e.preventDefault();
        //replaceClass(e.currentTarget, "dropTarget");

        const { onDrop } = this.mergedProps;

        onDrop?.(e, props);
    };

    private selectTab = (id: string): void => {
        const { onSelectTab } = this.mergedProps;

        onSelectTab?.(id);
    };

    /**
     * Triggered by a mouse drop operation on either the selector or one of its items.
     *
     * @param e The drop event, which also contains the data for the drop operation.
     *
     * @param props The properties of the receiver of the drop operation.
     */
    private handleSelectorDrop = (e: React.DragEvent<HTMLElement>, props: IComponentProperties): void => {
        // See if that is a request to change the order of the tabs.
        const items = e.dataTransfer.items;

        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < items.length; ++i) {
            const item = items[i];
            if (item.kind === "string" && item.type === "sourceid") {
                const sourceId = e.dataTransfer.getData("sourceid");

                const { pages, onMoveTab } = this.mergedProps;
                const sourceIndex = pages.findIndex((page: ITabviewPage) => { return page.id === sourceId; });
                if (sourceIndex > -1) {
                    let targetIndex = pages.length - 1;
                    if (props.id !== "header") {
                        // Move the item to the position of the target item.
                        targetIndex = pages.findIndex((page: ITabviewPage) => { return page.id === props.id; });
                    }

                    if (targetIndex > -1 && sourceIndex !== targetIndex) {
                        const page = pages[sourceIndex];
                        pages.splice(sourceIndex, 1);
                        pages.splice(targetIndex, 0, page);

                        onMoveTab?.(sourceId, sourceIndex, targetIndex);
                        this.setState({ updated: true });
                    }
                }
            }
        }
    };
}
