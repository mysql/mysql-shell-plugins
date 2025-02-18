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

import "./SettingsEditor.css";

import { ComponentChild, createRef, render } from "preact";
import { CellComponent, ColumnDefinition, RowComponent } from "tabulator-tables";

import type { IDictionary } from "../../app-logic/general-types.js";
import { Assets } from "../../supplement/Assets.js";
import { settingCategories, type ISettingCategory } from "../../supplement/Settings/SettingsRegistry.js";
import { AboutBox } from "../ui/AboutBox/AboutBox.js";
import { CheckState, Checkbox, type ICheckboxProperties } from "../ui/Checkbox/Checkbox.js";
import {
    ComponentBase, SelectionType, type IComponentProperties, type IComponentState,
} from "../ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../ui/Container/Container.js";
import { Label } from "../ui/Label/Label.js";
import { Search, type ISearchProperties, type ISearchValues } from "../ui/Search/Search.js";
import { Tabview, type ITabviewPage } from "../ui/Tabview/Tabview.js";
import { TreeGrid, type ITreeGridOptions } from "../ui/TreeGrid/TreeGrid.js";
import { SettingsEditorList } from "./SettingsEditorList.js";

interface ISettingsEditorProperties extends IComponentProperties {
    page: string;
}

interface ISettingsEditorState extends IComponentState {
    selectedTab: string;

    settingsTree: ISettingCategory[];
    filteredTree: ISettingCategory[];
    selectedTreeEntry: number;

    searchValues: ISearchValues;
    foundEntries: number;
    showAdvancedSettings: boolean;
}

// A dialog to edit user and application settings.
export class SettingsEditor extends ComponentBase<ISettingsEditorProperties, ISettingsEditorState> {

    private treeRef = createRef<TreeGrid>();
    private valueListRef = createRef<SettingsEditorList>();

    private scrolling = false;
    private filterTimer: ReturnType<typeof setTimeout> | null = null;

    public constructor(props: ISettingsEditorProperties) {
        super(props);

        const settingsTree = settingCategories.children!;
        const [, filteredTree] = this.filterSettingsTree(settingsTree, false);

        this.state = {
            selectedTab: props.page,
            settingsTree,
            filteredTree,
            selectedTreeEntry: 1,
            searchValues: {
                value: "",
            },
            foundEntries: -1,
            showAdvancedSettings: false,
        };
    }

    public override componentWillUnmount(): void {
        if (this.filterTimer) {
            clearTimeout(this.filterTimer);
        }
    }

    public override componentDidUpdate(prevProps: ISettingsEditorProperties): void {
        const { page } = this.props;

        if (prevProps.page !== page) {
            this.setState({ selectedTab: page });
        }
    }

    public render(): ComponentChild {
        const { selectedTab } = this.state;

        const className = this.getEffectiveClassNames(["settingsEditor"]);

        const pages: ITabviewPage[] = [{
            icon: Assets.misc.settingsIcon,
            caption: "Settings",
            id: "settings",
            content: this.renderSettings(),
        },
        {
            icon: Assets.misc.settingsIcon,
            caption: "About",
            id: "about",
            content: <AboutBox />,
        }];

        return (
            <Tabview
                className={className}
                pages={pages}
                selectedId={selectedTab}
                onSelectTab={this.handleSelectTab}
                stretchTabs={false}
            />
        );

    }

    private renderSettings = (): ComponentChild => {
        const { selectedTreeEntry, searchValues, filteredTree, foundEntries, showAdvancedSettings } = this.state;

        const settingsTreeColumns: ColumnDefinition[] = [{
            title: "",
            field: "title",
            resizable: false,
            formatter: this.formatSettingsTreeCell,
        }];

        const settingsTreeOptions: ITreeGridOptions = {
            showHeader: false,
            selectionType: SelectionType.Single,
            treeColumn: "title",

            // Show the tree fully expanded, if a filter is active.
            expandedLevels: foundEntries > -1 ? [true, true] : undefined,
        };

        return (
            <Container
                orientation={Orientation.TopDown}
                id="settingsHost"
            >
                <Container
                    id="optionsHost"
                    orientation={Orientation.LeftToRight}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Search
                        autoFocus
                        placeholder="Search settings"
                        result={foundEntries > -1 ? `${foundEntries} Settings Found` : undefined}
                        buttons={{
                            matchChase: true,
                            clearAll: true,
                        }}
                        values={searchValues}
                        onChange={this.handleSearchChange}
                    />
                    <Checkbox
                        id="advancedSettings"
                        caption="Show Advanced Settings"
                        checkState={showAdvancedSettings ? CheckState.Checked : CheckState.Unchecked}
                        onChange={this.handleAdvanceSettingsChange}
                    />
                </Container>
                <Container
                    orientation={Orientation.LeftToRight}
                    id="settingsTreeHost"
                >
                    <TreeGrid
                        id="settingsTree"
                        ref={this.treeRef}
                        columns={settingsTreeColumns}
                        tableData={filteredTree}
                        selectedRows={[selectedTreeEntry]}
                        options={settingsTreeOptions}
                        tabIndex={0}
                        onRowSelected={this.handleSettingTreeRowSelected}
                    />
                    <SettingsEditorList
                        id="settingsValueList"
                        ref={this.valueListRef}
                        settingsTree={filteredTree}
                        onListScroll={this.handleValueListScroll}
                    />
                </Container>
            </Container>
        );
    };

    private handleSelectTab = (id: string): void => {
        this.setState({ selectedTab: id });
    };

    private formatSettingsTreeCell = (cell: CellComponent): string | HTMLElement => {
        const data = cell.getData() as ISettingCategory;
        const content = <Label caption={data.title} />;

        const host = document.createElement("span");
        host.classList.add("settingsTreeCell");
        render(content, host);

        return host;
    };

    private handleAdvanceSettingsChange = (checkState: CheckState, props: ICheckboxProperties): void => {
        if (props.id === "advancedSettings") {
            if (this.filterTimer) {
                clearTimeout(this.filterTimer);
                this.filterTimer = null;
            }

            // Update happens in two steps.
            // 1. Update the UI with the new checkbox state.
            this.setState({ showAdvancedSettings: checkState === CheckState.Checked }, () => {
                // 2. Compute the new settings tree and show that.
                this.runFilterTimer();
            });
        }
    };

    private handleSettingTreeRowSelected = (row: RowComponent): void => {
        if (!this.scrolling && this.valueListRef.current) {
            this.scrolling = true;
            try {
                const data = row.getData() as IDictionary;
                this.valueListRef.current.scrollToId(data.id as string);
            } finally {
                setTimeout(() => {
                    this.scrolling = false;
                }, 0);
            }
        }
    };

    private handleValueListScroll = (top: string, direction: "up" | "down"): void => {
        if (!this.scrolling && this.treeRef.current) {
            this.scrolling = true;
            const parts = top.split(".");
            if (parts.length > 1) {
                // Remove the last part of the id, which is a specific setting. We need the category however.
                parts.pop();
                top = parts.join(".");
            }

            // Collapse and deselect the currently active node.
            void this.treeRef.current?.table.then((table) => {
                this.treeRef.current?.getSelectedRows().forEach((row) => {
                    if (!top.startsWith((row.getData() as IDictionary).id as string)) {
                        let current: RowComponent | false = row;
                        while (current) {
                            current.treeCollapse();
                            current = current.getTreeParent();
                        }
                    }
                    row.deselect();

                    // If we are scrolling down, expand the previous row to make its children available
                    // for search + selection.
                    if (direction === "down") {
                        const prevRow = row.getPrevRow();
                        if (prevRow) {
                            prevRow.treeExpand();
                        }
                    }
                });

                const rows = table?.getRows("visible") ?? [];
                const row = rows.find((row) => {
                    return (row.getData() as IDictionary).id === top;
                });

                if (row) {
                    if (direction === "up") {
                        row.treeExpand();
                    }
                    void row.scrollTo();
                    row.select();
                }

                this.scrolling = false;
            });
        }
    };

    private handleSearchChange = (e: UIEvent, props: ISearchProperties, values: ISearchValues): void => {
        if (this.filterTimer) {
            clearTimeout(this.filterTimer);
            this.filterTimer = null;
        }

        this.setState({ searchValues: values }, () => { this.runFilterTimer(); });

    };

    private generateSearchFilter = (values: ISearchValues): RegExp | undefined => {
        let filter: RegExp | undefined;
        if ((values.value ?? "").length > 0) {
            if (values.useRegExp) {
                filter = new RegExp(values.value ?? "", values.matchCase ? undefined : "i");
            } else {
                let pattern = `${values.value ?? ""}`;
                if (values.matchWholeWord) {
                    pattern = `\\b${pattern}\\b`;
                }
                filter = new RegExp(pattern, values.matchCase ? undefined : "i");
            }
        }

        return filter;
    };

    private filterSettingsTree(settingsTree: ISettingCategory[], showAdvanced: boolean,
        filter?: RegExp): [number, ISettingCategory[]] {
        let foundEntries = -1;
        const filteredTree: ISettingCategory[] = [];

        foundEntries = 0;

        /**
         * Recursively called function to check if a category contains a value whose title or description
         * matches the filter.
         *
         * @param category The category to check.
         *
         * @returns A copy of the category with only the matching child categories and values.
         */
        const tryMatch = (category: ISettingCategory): ISettingCategory | undefined => {
            // Create a copy of the category, but with empty child + value lists.
            const result: ISettingCategory = { ...category, values: [], children: [] };
            category.children?.forEach((child) => {
                const category = tryMatch(child);
                if (category) {
                    result.children?.push(category);
                }
            });

            if (result.children?.length === 0) {
                result.children = undefined;
            }

            category.values.forEach((child) => {
                if (!child.advanced || showAdvanced) {
                    if (!filter || child.title.match(filter) || child.description.match(filter)) {
                        ++foundEntries;
                        result.values.push(child);
                    }
                }
            });

            if (result.values.length > 0 || result.children) {
                return result;
            }

            return undefined;
        };

        settingsTree.forEach((child) => {
            const category = tryMatch(child);
            if (category) {
                filteredTree.push(category);
            }
        });

        return [foundEntries, filteredTree];
    }

    /**
     * Triggers a delayed update of the settings tree.
     */
    private runFilterTimer(): void {
        // The timer must have been stopped already, if it was running.
        this.filterTimer = setTimeout(() => {
            const { settingsTree, searchValues, showAdvancedSettings } = this.state;
            const filter = this.generateSearchFilter(searchValues);
            const [foundEntries, filteredTree] =
                this.filterSettingsTree(settingsTree, showAdvancedSettings, filter);
            this.setState({
                foundEntries: filter ? foundEntries : -1,
                filteredTree,
            });
        }, 200);
    }
}
