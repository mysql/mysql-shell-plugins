/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import { ComponentChild, createRef, render } from "preact";
import { CellComponent, ColumnDefinition, RowComponent } from "tabulator-tables";

import { IDictionary } from "../../app-logic/general-types.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import { ISettingCategory, ISettingValue } from "../../supplement/Settings/SettingsRegistry.js";
import { ThemeManager } from "../Theming/ThemeManager.js";
import { Button } from "../ui/Button/Button.js";
import { CheckState, Checkbox, ICheckboxProperties } from "../ui/Checkbox/Checkbox.js";
import { ComponentBase, IComponentProperties, IComponentState, SelectionType } from "../ui/Component/ComponentBase.js";
import { Dropdown } from "../ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../ui/Dropdown/DropdownItem.js";
import { IInputChangeProperties, Input } from "../ui/Input/Input.js";
import { Label } from "../ui/Label/Label.js";
import { ITreeGridOptions, TreeGrid } from "../ui/TreeGrid/TreeGrid.js";
import { IUpDownProperties, UpDown } from "../ui/UpDown/UpDown.js";

interface ISettingsEditorListProperties extends IComponentProperties {
    settingsTree: ISettingCategory[];

    // Triggered on vertical scrolling on the list. Passes in the id of the row currently at the top.
    onListScroll: (top: string, direction: "up" | "down") => void;
}

interface ISettingsEditorListState extends IComponentState {
    // The settings list is a combination of all category headings and all setting values.
    settingsList: Array<ISettingCategory | ISettingValue>;
    selectedId: string;
}

// A dialog to edit user and application settings.
export class SettingsEditorList extends ComponentBase<ISettingsEditorListProperties, ISettingsEditorListState> {

    private gridRef = createRef<TreeGrid>();
    private lastScrollPos = 0;

    // Independent of the automatic saving in the settings class, we keep an own timer here.
    // The interval for auto save can be very large or auto save is even disabled.
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    public constructor(props: ISettingsEditorListProperties) {
        super(props);

        this.state = {
            selectedId: "",
            settingsList: this.collectSettingsValues(),
        };
    }

    public override componentDidMount(): void {
        requisitions.register("settingsChanged", this.handleSettingsChanged);
    }

    public override componentWillUnmount(): void {
        requisitions.unregister("settingsChanged", this.handleSettingsChanged);
    }

    public override componentDidUpdate(prevProps: ISettingsEditorListProperties): void {
        const scrollTree = (): void => {
            void this.gridRef.current?.table.then((table) => {
                const { selectedId } = this.state;

                if (selectedId.length > 0) {
                    const row = table?.getRow(selectedId);
                    if (row) {
                        void row.scrollTo();
                        row.select();
                    }
                }
            });
        };

        const { settingsTree } = this.props;
        if (prevProps.settingsTree !== settingsTree) {
            this.setState({ selectedId: "", settingsList: this.collectSettingsValues() }, () => { scrollTree(); });
        } else {
            setTimeout(() => { scrollTree(); }, 0);
        }
    }

    public render(): ComponentChild {
        const { settingsList } = this.state;

        const settingsListColumns: ColumnDefinition[] = [{
            title: "",
            field: "title",
            resizable: false,
            variableHeight: true,
            formatter: this.formatSettingsListCell,
        }];

        const settingsListOptions: ITreeGridOptions = {
            showHeader: false,
            selectionType: SelectionType.Single,
            layout: "fitColumns",
        };

        return (
            <TreeGrid
                id="settingsValueList"
                ref={this.gridRef}
                columns={settingsListColumns}
                tableData={settingsList}
                options={settingsListOptions}
                onVerticalScroll={this.handleVerticalScrolling}
            />
        );
    }

    public scrollToId(id: string): void {
        void this.gridRef.current?.table.then((table) => {
            void table?.scrollToRow(id, "top");
        });
    }

    private collectSettingsValues(): Array<ISettingCategory | ISettingValue> {
        const { settingsTree } = this.props;

        const result: Array<ISettingCategory | ISettingValue> = [];

        const doCollectValues = (entries: ISettingCategory[]): void => {
            entries.forEach((entry) => {
                result.push(entry);
                entry.values.forEach((value) => {
                    if (value.description !== "") {
                        result.push(value);
                    }
                });

                if (entry.children) {
                    doCollectValues(entry.children);
                }
            });
        };

        doCollectValues(settingsTree);

        return result;
    }

    private handleSettingsChanged = (): Promise<boolean> => {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        this.saveTimer = setTimeout(() => { Settings.saveSettings(); }, 1000);

        const selectedRows = this.gridRef.current?.getSelectedRows() ?? [];
        if (selectedRows.length > 0) {
            // Update the row to show the changed data. There can only be one row selected.
            const row = selectedRows[0];
            row.reformat();

            // And there's always a single cell. Refocus the field editor.
            const cell = row.getCells()[0];
            const cellElement = cell.getElement();

            let elements = cellElement.getElementsByClassName("settingValue");
            if (elements.length > 0) {
                let edit = elements[0] as HTMLElement;
                if (edit.classList.contains("upDown")) {
                    elements = edit.getElementsByClassName("input");
                    edit = elements[0] as HTMLElement;
                }
                edit.focus();
            }
        }

        return Promise.resolve(true);
    };

    private handleVerticalScrolling = (top: number): void => {
        void this.gridRef.current?.table.then((table) => {
            const { onListScroll } = this.props;

            const rows = table?.getRows();
            let foundRow: RowComponent | undefined;
            rows?.forEach((row) => {
                if (!foundRow && row.getElement().offsetTop > top) {
                    foundRow = row;
                }
            });

            if (foundRow) {
                const direction = top > this.lastScrollPos ? "up" : "down";
                this.lastScrollPos = top;
                onListScroll((foundRow.getData() as IDictionary).id as string, direction);
            }
        });
    };

    private formatSettingsListCell = (cell: CellComponent): string | HTMLElement => {
        let content;
        let usesDefault = true;

        const data = cell.getData() as IDictionary;
        if (data.valueType) {
            const data = cell.getData() as ISettingValue;
            let value = Settings.get(data.id);
            usesDefault = (value == null) || value === data.defaultValue;
            if (usesDefault) {
                value = data.defaultValue;
            }

            let descriptionLabel;
            let editor;
            let showTitle = true;

            const descriptionRef = createRef<HTMLLabelElement>();
            switch (data.valueType) {
                case "string": {
                    descriptionLabel = <Label
                        innerRef={descriptionRef}
                        caption={data.description}
                        className="settingValueDescription"
                    />;
                    editor = <Input
                        id={data.id}
                        key={data.id}
                        value={value as string}
                        className="settingValue"
                        onChange={this.handleInputChange}
                    />;

                    break;
                }

                case "boolean": {
                    const checkState = value ? CheckState.Checked : CheckState.Unchecked;
                    editor = <Checkbox
                        id={data.id}
                        key={data.id}
                        caption={data.description}
                        checkState={checkState}
                        className="settingValue"
                        onChange={this.handleCheckboxChange}
                    />;

                    break;
                }

                case "number": {
                    let min: number | undefined;
                    let max: number | undefined;
                    if (data.parameters.range) {
                        min = data.parameters.range[0];
                        max = data.parameters.range[1];
                    }
                    descriptionLabel = <Label
                        innerRef={descriptionRef}
                        caption={data.description}
                        className="settingValueDescription"
                    />;
                    editor = <UpDown
                        id={data.id}
                        key={data.id}
                        value={value as number}
                        min={min}
                        max={max}
                        className="settingValue"
                        onChange={this.handleUpDownChange}
                    />;

                    break;
                }

                case "choice": {
                    descriptionLabel = <Label
                        innerRef={descriptionRef}
                        caption={data.description}
                        className="settingValueDescription"
                    />;

                    if (data.id.endsWith(".currentTheme")) {
                        // Special case: themes. The themes list is dynamic.
                        const themeNames = ThemeManager.get.installedThemes;
                        themeNames.unshift("Auto");
                        data.parameters.choices = themeNames.map((theme: string) => {
                            let description = "Built-in Theme";
                            if (theme === "Auto") {
                                description = "Pseudo theme to match the current system theme";
                            }

                            return [theme, theme, description];
                        });
                    }

                    if (data.parameters.choices) {
                        let hasDescriptions = false;
                        const items = data.parameters.choices.map((choice) => {
                            if (choice[1] && choice[1].length > 0) {
                                hasDescriptions = true;
                            }

                            return <DropdownItem
                                caption={choice[0]}
                                id={choice[1]}
                                key={choice[1]}
                                description={choice[2]}
                                payload={data.id}
                            />;

                        });

                        editor = <Dropdown
                            id={data.id}
                            key={data.id}
                            className="settingValue"
                            selection={value as string}
                            showDescription={hasDescriptions}
                            onSelect={this.handleDropDownChange}
                        >
                            {items}
                        </Dropdown>;
                    }

                    break;
                }

                case "action": {
                    showTitle = false;
                    usesDefault = true;
                    descriptionLabel = <Label
                        innerRef={descriptionRef}
                        caption={data.description}
                        className="settingValueDescription"
                    />;
                    editor = <Button
                        key={data.id}
                        requestType={data.parameters.action}
                        caption={data.defaultValue as string}
                        className="settingValue"
                    />;

                    break;
                }

                default: { // Other types we cannot handle here.
                    break;
                }
            }

            content = <>
                {showTitle && <Label caption={data.title} className="settingValueName" />}
                {descriptionLabel}
                {editor}
            </>;
        } else {
            // A category.
            const data = cell.getData() as ISettingCategory;
            content = <Label caption={data.title} className="settingTitle" />;
        }

        const host = document.createElement("div");
        host.classList.add("settingsListCell");
        if (!usesDefault) {
            host.classList.add("nonDefault");
            host.title = "Modified";
        }

        render(content, host);

        return host;
    };

    private handleInputChange = (e: InputEvent, props: IInputChangeProperties): void => {
        Settings.set(props.id!, props.value);
        this.setState({ settingsList: this.collectSettingsValues() });
    };

    private handleCheckboxChange = (checkState: CheckState, props: ICheckboxProperties): void => {
        Settings.set(props.id!, checkState === CheckState.Checked ? true : false);
        this.setState({ settingsList: this.collectSettingsValues() });
    };

    private handleUpDownChange = (value: number, props: IUpDownProperties<number>): void => {
        Settings.set(props.id!, value);
        this.setState({ settingsList: this.collectSettingsValues() });
    };

    private handleDropDownChange = (accept: boolean, selectedIds: Set<string>, payload: unknown): void => {
        // There's always at least one entry.
        const id = payload as string;
        Settings.set(id, [...selectedIds][0]);
        this.setState({ settingsList: this.collectSettingsValues() });
    };

}
