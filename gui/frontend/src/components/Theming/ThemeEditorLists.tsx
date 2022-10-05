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

import colorDescriptions from "./assets/color-descriptions.json";
import noPreviewIcon from "../../assets/images/no-preview.svg";

import React from "react";
import { render } from "preact";

import Color from "color";
import { CellComponent, ColumnDefinition } from "tabulator-tables";
import _ from "lodash";

import {
    Component, Tabview, TabPosition, ITabviewPage, Container, Orientation, Icon,
    Label, IComponentProperties, ColorField, IColorFieldProperties, IComponentState, TreeGrid,
    SelectionType, ITreeGridOptions,
} from "../ui";
import { ITokenEntry, themeManager } from "./ThemeManager";
import { TokenEditor } from "./TokenEditor";
import { ScopeSelector } from "./ScopeSelector";
import { IDictionary } from "../../app-logic/Types";

const noPreviewText = "No preview is available for this color. It's not used in this application.";

interface IDescriptionEntry {
    id: string;
    description: string;
    preview: boolean;
    variable: string;
    color: string;
    children?: IDescriptionEntry[];
}

export interface IThemeEditorListsProperties extends IComponentProperties {
    showUnusedColors: boolean;
    onThemeChange: () => void;
}

interface IThemeEditorListsState extends IComponentState {
    selectedPage: string;
}

export class ThemeEditorLists extends Component<IThemeEditorListsProperties, IThemeEditorListsState> {
    // Scopes defined here https://macromates.com/manual/en/language_grammars#naming-conventions
    public static readonly defaultScopes = [
        "comment",
        "comment.line",
        "comment.line.double-slash",
        "comment.line.double-dash",
        "comment.line.number-sign",
        "comment.line.percentage",
        "comment.block",
        "comment.block.documentation",
        "constant",
        "constant.numeric",
        "constant.character",
        "constant.character.escape",
        "constant.language",
        "constant.other",
        "entity",
        "entity.name",
        "entity.name.function",
        "entity.name.type",
        "entity.name.tag",
        "entity.name.section",
        "entity.other",
        "entity.other.inherited-class",
        "entity.other.attribute-name",
        "invalid",
        "invalid.illegal",
        "invalid.deprecated",
        "keyword",
        "keyword.control",
        "keyword.operator",
        "keyword.other",
        "markup",
        "markup.underline",
        "markup.underline.link",
        "markup.bold",
        "markup.heading",
        "markup.italic",
        "markup.list",
        "markup.list.numbered",
        "markup.list.unnumbered",
        "markup.quote",
        "markup.raw",
        "markup.other",
        "meta",
        "storage",
        "storage.type",
        "storage.modifier",
        "string",
        "string.quoted",
        "string.quoted.single",
        "string.quoted.double",
        "string.quoted.triple",
        "string.quoted.other",
        "string.unquoted",
        "string.interpolated",
        "string.regexp",
        "string.other",
        "support",
        "support.function",
        "support.class",
        "support.type",
        "support.constant",
        "support.variable",
        "support.other",
        "variable",
        "variable.parameter",
        "variable.language",
        "variable.other",
    ];

    private expandedRowKeys: string[] = [];

    private scopeSelectorRef = React.createRef<ScopeSelector>();

    private themeNode: CSSStyleDeclaration;

    private unfilteredColors: IDescriptionEntry[];
    private filteredColors: IDescriptionEntry[];
    private tokens: ITokenEntry[];

    public constructor(props: IThemeEditorListsProperties) {
        super(props);

        this.themeNode = themeManager.themeStyleNode;
        this.state = {
            selectedPage: "uiColors",
        };
    }

    /**
     * Renders the UI Colors tab page.
     *
     * @returns A new tab page.
     */
    private get renderUiColorsPage(): ITabviewPage {
        const { showUnusedColors } = this.props;

        const colorTreeColumns: ColumnDefinition[] = [{
            title: "",
            field: "description",
            width: 300,
            resizable: true,
            formatter: this.colorTreeCellFormatter,
        },
        {
            title: "",
            field: "color",
            width: 40,
            resizable: false,
            hozAlign: "center",
            formatter: this.colorTreeCellFormatter,
        },
        {
            title: "",
            field: "preview",
            width: 32,
            resizable: false,
            hozAlign: "center",
            formatter: this.colorTreeCellFormatter,
        }];

        const colorTreeOptions: ITreeGridOptions = {
            treeColumn: "description",
            selectionType: SelectionType.Single,
            showHeader: false,
            layout: "fitColumns",
        };

        return {
            id: "uiColors",
            caption: "UI Colors",
            content: <TreeGrid
                options={colorTreeOptions}
                columns={colorTreeColumns}
                tableData={showUnusedColors ? this.unfilteredColors : this.filteredColors}
            />,
        };
    }

    private get renderSyntaxColorsPage(): ITabviewPage {
        const tokenData = this.tokens.map((value: ITokenEntry, index: number) => {
            return { index, value };
        });

        const tokenListColumns: ColumnDefinition[] = [{
            title: "",
            field: "index",
            formatter: this.tokenListCellFormatter,
        }];

        const tokenListOptions: ITreeGridOptions = {
            selectionType: SelectionType.None,
            showHeader: false,
            layout: "fitColumns",
        };

        return {
            id: "syntaxColors",
            caption: "Syntax Colors",
            content:
                <>
                    <ScopeSelector
                        ref={this.scopeSelectorRef}
                        defaultScopes={ThemeEditorLists.defaultScopes}
                        customScopes={this.collectCustomScopes()}
                    />
                    <Container orientation={Orientation.TopDown}>
                        <TreeGrid
                            options={tokenListOptions}
                            columns={tokenListColumns}
                            tableData={tokenData}
                        />
                    </Container>
                </>,
        };
    }

    public render(): React.ReactNode {
        const { selectedPage } = this.state;
        this.readData();

        return (
            <Tabview
                id="themeTabview"
                tabPosition={TabPosition.Top}
                selectedId={selectedPage}
                pages={[
                    this.renderUiColorsPage,
                    this.renderSyntaxColorsPage,
                ]}
                onSelectTab={(id: string): void => { this.setState({ selectedPage: id }); }}
            />
        );
    }

    private readData(): void {
        this.themeNode = themeManager.themeStyleNode;

        const values = themeManager.activeThemeValues;
        if (values && values.tokenColors && values.tokenColors.length > 0) {
            this.tokens = values.tokenColors;
        } else {
            // If no tokens are defined yet then create a list from the default scopes.
            this.tokens = [];
            ThemeEditorLists.defaultScopes.forEach((scope: string) => {
                this.tokens.push({
                    name: scope,
                    scope: [scope],
                    settings: {
                    },
                });
            });
            if (values) {
                values.tokenColors = this.tokens;
            }
        }

        this.unfilteredColors = this.collectColors(colorDescriptions, true) ?? [];
        this.filteredColors = this.collectColors(colorDescriptions, false) ?? [];
    }

    private tokenListCellFormatter = (cell: CellComponent): string | HTMLElement => {
        const data = cell.getData() as { index: number; value: ITokenEntry };

        const editor = <TokenEditor
            token={data.value}
            id={data.index.toString()}
            onScopeListClick={this.openScopeSelector}
            onChange={this.tokenChanged}
            onRemove={this.removeToken}
            onDuplicate={this.duplicateToken}
        />;

        const host = document.createElement("div");
        host.className = "syntaxEntryHost";

        render(editor, host);

        return host;
    };

    private colorTreeCellFormatter = (cell: CellComponent): string | HTMLElement => {
        const data = cell.getData() as IDescriptionEntry;
        const column = cell.getColumn();

        let content;
        switch (column.getField()) {
            case "description": {
                if (!data.id.startsWith("#")) {
                    const id: string = data.id;

                    content = (
                        <div className="colorEntry">
                            <Label className="description">{data.description}</Label>
                            <Label className="colorIdLabel">{`➠ ${id}`}</Label>
                        </div>
                    );
                } else {
                    content = <Label>{data.description}</Label>;
                }

                break;
            }

            case "color": {
                if (!data.id.startsWith("#")) {
                    let color;
                    try {
                        color = new Color((cell.getValue() as string).trim());
                    } catch (e) {
                        color = undefined;
                    }

                    content = (
                        <ColorField
                            id={data.variable}
                            initialColor={color}
                            onChange={this.colorChanged}
                        />
                    );
                }

                break;
            }

            default: { // preview
                if (!data.preview) {
                    content = <Icon src={noPreviewIcon} id="previewIcon" data-tooltip={noPreviewText} />;
                }
                break;
            }
        }

        const host = document.createElement("div");
        host.className = "colorTreeEntryHost";

        if (content) {
            render(content, host);
        }

        return host;
    };

    private colorChanged = (color: Color | undefined, props: IColorFieldProperties): void => {
        this.themeNode?.setProperty(props.id as string, color ? color.hsl().toString() : null);
        this.props.onThemeChange();
    };

    /**
     * @returns A list of all syntax scopes found in the current theme.
     */
    private collectCustomScopes(): string[] {
        const scopeSet = new Set<string>();
        const values = themeManager.activeThemeValues;
        if (values?.tokenColors) {
            values.tokenColors.forEach((entry: ITokenEntry) => {
                const scopeValue = entry.scope || [];
                const scopes = Array.isArray(scopeValue) ? scopeValue : scopeValue.split(",");
                scopes.forEach((scope: string) => {
                    scopeSet.add(scope);
                });
            });
        }

        return [...scopeSet].sort();
    }

    /**
     * Recursively collects theme color details.
     *
     * @param entries A list of objects each describing a color.
     * @param includeUnused A flag specifying whether to include colors that are not used here.
     *
     * @returns A list of color descriptions for the UI.
     */
    private collectColors(entries: IDictionary[], includeUnused: boolean): IDescriptionEntry[] | undefined {
        let result: IDescriptionEntry[] | undefined;
        const themeNode = this.themeNode;
        if (entries && themeNode) {
            result = [];
            entries.forEach((entry) => {
                if (entry.preview || includeUnused) {
                    const variable = themeManager.themeValueNameToCssVariable(entry.name as string);
                    const color = themeNode.getPropertyValue(variable);

                    result!.push({
                        id: entry.name as string,
                        description: entry.description as string,
                        preview: entry.preview as boolean,
                        color,
                        variable,
                        children: this.collectColors(entry.children as IDictionary[], includeUnused),
                    });
                }
            });
        }

        return result;
    }

    /**
     * Called when the user clicks on a tag input to show the tag editor.
     *
     * @param e The mouse event which caused this call originally.
     */
    private openScopeSelector = (e: React.SyntheticEvent): void => {
        if (this.scopeSelectorRef.current) {
            this.scopeSelectorRef.current.open(e.currentTarget as HTMLElement);
        }
    };

    private tokenChanged = (): void => {
        this.props.onThemeChange();
    };

    private removeToken = (id: string): void => {
        const index = parseInt(id, 10);
        this.tokens.splice(index, 1);
        this.forceUpdate();
        this.props.onThemeChange();
    };

    private duplicateToken = (id: string, token: ITokenEntry): void => {
        const index = parseInt(id, 10);
        this.tokens.splice(index + 1, 0, _.cloneDeep(token));
        this.forceUpdate();
        this.props.onThemeChange();
    };

}
