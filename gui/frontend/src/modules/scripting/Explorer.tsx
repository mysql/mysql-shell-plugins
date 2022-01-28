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

import tableIcon from "../../assets/images/table.svg";
import schemaIcon from "../../assets/images/database.svg";
import columnIcon from "../../assets/images/column.svg";

import defaultIcon from "../../assets/images/file-icons/default.svg";
import iniIcon from "../../assets/images/file-icons/ini.svg";
import javascriptIcon from "../../assets/images/file-icons/javascript.svg";
import jsonIcon from "../../assets/images/file-icons/json.svg";
import markdownIcon from "../../assets/images/file-icons/markdown.svg";
import mysqlIcon from "../../assets/images/file-icons/mysql.svg";
import sqliteIcon from "../../assets/images/file-icons/sqlite.svg";
import pythonIcon from "../../assets/images/file-icons/python.svg";
import shellIcon from "../../assets/images/file-icons/shell.svg";
import typescriptIcon from "../../assets/images/file-icons/typescript.svg";
import xmlIcon from "../../assets/images/file-icons/xml.svg";

import React from "react";
import { render } from "preact";

import keyboardKey from "keyboard-key";
import { isNil } from "lodash";

import {
    Accordion, Component, IComponentProperties, Label, Icon, IComponentState, Input, SelectionType,
    IAccordionProperties, Menu, ComponentPlacement, IMenuItemProperties, MenuItem, TreeGrid, ITreeGridOptions, Image,
    Tabulator,
} from "../../components/ui";
import { EntityType, IDBEditorScriptState, IEntityBase, IModuleDataEntry, ISchemaTreeEntry, SchemaTreeType } from ".";
import { Codicon } from "../../components/ui/Codicon";
import { IOpenEditorState } from "./DBEditorTab";
import { ICommErrorEvent, ICommMetaDataEvent, ICommSimpleResultEvent } from "../../communication";
import { EventType } from "../../supplement/Dispatch";
import { DBType, ShellInterfaceSqlEditor } from "../../supplement/ShellInterface";
import { requisitions } from "../../supplement/Requisitions";
import { EditorLanguage } from "../../supplement";

export const documentTypeToIcon: Map<EditorLanguage, string> = new Map([
    ["ini", iniIcon],
    ["javascript", javascriptIcon],
    ["json", jsonIcon],
    ["markdown", markdownIcon],
    ["mysql", mysqlIcon],
    ["sql", sqliteIcon],
    ["python", pythonIcon],
    ["msg", shellIcon],
    ["typescript", typescriptIcon],
    ["xml", xmlIcon],
]);

export interface IExplorerSectionState {
    expanded?: boolean;
    size?: number;
}

export interface IExplorerProperties extends IComponentProperties {
    // The schema tree as loaded so far.
    schemaTree: ISchemaTreeEntry[];
    editors: IOpenEditorState[];
    scripts: IModuleDataEntry[];
    selectedEntry: string;
    markedSchema: string;
    backend: ShellInterfaceSqlEditor;

    dbType: DBType;

    // The state of each accordion item.
    state?: Map<string, IExplorerSectionState>;

    onSelectItem?: (id: string) => void;
    onCloseItem?: (id: string) => void;
    onAddItem?: () => string | undefined;
    onChangeItem?: (id: string, newCaption: string) => void;
    onAddScript?: (language: EditorLanguage) => void;
    onAddFolder?: (parent: number) => void;

    onSaveSchemaTree?: (id: string, schemaTree: ISchemaTreeEntry[]) => void;
    onSaveExplorerState?: (id: string, state: Map<string, IExplorerSectionState>) => void;

    onContextMenuItemClick?: (id: string, itemId: string, params: unknown) => void;
}

interface IExplorerState extends IComponentState {
    schemaList?: ISchemaTreeEntry[];

    editing?: string;     // If editing an editor's caption is active then this field holds its id.
    tempCaption?: string; // Keeps the new caption of an editor while it is being edited.
}

export class Explorer extends Component<IExplorerProperties, IExplorerState> {

    private tableRef = React.createRef<TreeGrid>();
    private schemaContextMenuRef = React.createRef<Menu>();
    private tableContextMenuRef = React.createRef<Menu>();
    private columnContextMenuRef = React.createRef<Menu>();
    private viewContextMenuRef = React.createRef<Menu>();
    private triggerContextMenuRef = React.createRef<Menu>();
    private indexContextMenuRef = React.createRef<Menu>();
    private fkContextMenuRef = React.createRef<Menu>();
    private eventContextMenuRef = React.createRef<Menu>();
    private routineContextMenuRef = React.createRef<Menu>();

    private folderContextMenuRef = React.createRef<Menu>();
    private scriptContextMenuRef = React.createRef<Menu>();

    public constructor(props: IExplorerProperties) {
        super(props);

        this.state = {
        };

        this.addHandledProperties("schemaTree", "editors", "scripts", "selectedEntry", "markedSchema", "backend",
            "onSelectItem", "dbType", "onDoubleClickItem", "onCloseItem", "onAddItem", "onChangeItem", "onAddScript",
            "onSaveSchemaTree", "onSaveExplorerState", "onContextMenuItemClick");
    }

    public componentDidMount(): void {
        this.updateSchemaList();
    }

    public componentWillUnmount(): void {
        const { id, onSaveSchemaTree } = this.props;
        const { schemaList } = this.state;

        onSaveSchemaTree?.(id!, schemaList || []);
    }

    public componentDidUpdate(prevProps: IExplorerProperties, prevState: IExplorerState): void {
        const { id, onSaveSchemaTree } = this.props;
        if (id !== prevProps.id) {
            const { schemaList } = prevState;

            onSaveSchemaTree?.(prevProps.id!, schemaList || []);

            this.updateSchemaList();
        }
    }

    public render(): React.ReactNode {
        const { state, dbType } = this.props;
        const { editing, schemaList } = this.state;

        const className = this.getEffectiveClassNames(["scriptingExplorer"]);

        const schemaTreeColumns: Tabulator.ColumnDefinition[] = [{
            title: "",
            field: "caption",
            resizable: false,
            hozAlign: "left",
            formatter: this.schemaTreeCellFormatter,
            cellDblClick: this.handleSchemaTreeDoubleClick,
        }];

        const schemaTreeOptions: ITreeGridOptions = {
            treeColumn: "caption",
            selectionType: SelectionType.Single,
            showHeader: false,
            layout: "fitColumns",
        };

        const haveSchemaData = schemaList && schemaList.length > 0;
        const schemaSectionContent = !haveSchemaData
            ? <Accordion.Item caption="<no schemas>" />
            : <TreeGrid
                ref={this.tableRef}
                options={schemaTreeOptions}
                columns={schemaTreeColumns}
                tableData={schemaList!}

                onRowExpanded={this.handleRowExpanded}
                onRowCollapsed={this.handleRowCollapsed}
                isRowExpanded={this.isRowExpanded}
                onFormatRow={this.handleFormatSchemaRow}
                onRowContext={this.handleSchemaTreeRowContext}
            />;

        const editorSectionState = state?.get("editorSection") ?? {};
        const schemaSectionState = state?.get("schemaSection") ?? {};
        const scriptSectionState = state?.get("scriptSection") ?? {};

        const sqlMenuIcon = dbType === DBType.MySQL ? mysqlIcon : sqliteIcon;

        return (
            <>
                <Accordion
                    className={className}
                    caption="Explorer"
                    sections={[
                        {
                            id: "editorSection",
                            caption: "OPEN EDITORS",
                            stretch: false,
                            minSize: 56,
                            maxSize: 150,
                            expanded: editorSectionState.expanded,
                            initialSize: editorSectionState.size,
                            dimmed: !isNil(editing),
                            actions: [
                                {
                                    id: "addConsole",
                                    icon: Codicon.NewFile,
                                    tooltip: "Add new console",
                                },
                            ],
                            content: this.renderEditorEntries(),
                        },
                        {
                            id: "schemaSection",
                            caption: "SCHEMAS",
                            stretch: true,
                            expanded: schemaSectionState.expanded,
                            initialSize: schemaSectionState.size,
                            resizable: true,
                            minSize: 100,
                            content: schemaSectionContent,
                        },
                        {
                            id: "scriptSection",
                            caption: "SCRIPTS",
                            dimmed: !isNil(editing),
                            expanded: scriptSectionState.expanded,
                            initialSize: scriptSectionState.size,
                            stretch: true,
                            minSize: 100,
                            actions: [
                                {
                                    id: "addFolder",
                                    icon: Codicon.FileDirectoryCreate,
                                },
                                {
                                    id: "addScript",
                                    icon: Codicon.KebabVertical,
                                    tooltip: "Add new Script",
                                    choices: [
                                        { id: "addTSScript", icon: typescriptIcon, caption: "Add TS Script" },
                                        { id: "addJSScript", icon: javascriptIcon, caption: "Add JS Script" },
                                        { id: "addSQLScript", icon: sqlMenuIcon, caption: "Add SQL Script" },
                                    ],
                                },
                            ],
                            content: this.renderScriptEntries(),
                        },
                    ]}

                    onSectionAction={this.handleSectionAction}
                    onSectionExpand={this.handleSectionExpand}
                    onSectionResize={this.handleSectionResize}

                    {...this.unhandledProperties}
                />
                <Menu
                    id="schemaContextMenu"
                    ref={this.schemaContextMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleSchemaTreeContextMenuItemClick}
                >
                    <MenuItem id="setDefaultMenuItem" caption="Set as Default Schema" />
                    <MenuItem id="filterMenuItem" caption="Filter to this Schema" disabled />
                    <MenuItem id="inspectorMenuItem" caption="Show Schema Inspector" disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="clipboardMenu" caption="Copy to Clipboard">
                        <MenuItem id="clipboardNameMenuItem" caption="Name" disabled />
                        <MenuItem id="clipboardCreateStatementMenuItem" caption="Create Statement" disabled />
                    </MenuItem>
                    <MenuItem id="sendToEditorMenu" caption="Send to SQL Editor">
                        <MenuItem id="editorNameMenuItem" caption="Name" disabled />
                        <MenuItem id="editorCreateStatementMenuItem" caption="Create Statement" disabled />
                    </MenuItem>
                    <MenuItem caption="-" disabled />
                    <MenuItem id="createSchemaMenuItem" caption="Create Schema..." disabled />
                    <MenuItem id="alterSchemaMenuItem" caption="Alter Schema..." disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="dropSchemaMenuItem" caption="Drop Schema..." disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="refreshMenuItem" caption="Refresh All" disabled />
                </Menu>

                <Menu
                    id="tableContextMenu"
                    ref={this.tableContextMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleSchemaTreeContextMenuItemClick}
                >
                    <MenuItem id="selectRowsMenuItem" caption="Select Rows" />
                    <MenuItem id="tableInspectorMenuItem" caption="Table Inspector" disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="clipboardMenu" caption="Copy to Clipboard">
                        <MenuItem id="clipboardNameMenuItem" caption="Name" disabled />
                        <MenuItem id="clipboardCreateStatementMenuItem" caption="Create Statement" disabled />
                    </MenuItem>
                    <MenuItem id="tableDataExportMenuItem" caption="Table Data Export Wizard" disabled />
                    <MenuItem id="tableDataImportMenuItem" caption="Table Data Import Wizard" disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="sendToEditorMenu" caption="Send to SQL Editor">
                        <MenuItem id="editorNameMenuItem" caption="Name" disabled />
                        <MenuItem id="editorCreateStatementMenuItem" caption="Create Statement" disabled />
                    </MenuItem>
                    <MenuItem caption="-" disabled />
                    <MenuItem id="createTableMenuItem" caption="Create Table..." disabled />
                    <MenuItem id="createTableLikeMenu" caption="Create Table Like">
                        <MenuItem id="template1" caption="Template 1" disabled />
                        <MenuItem id="template2" caption="Template 2" disabled />
                    </MenuItem>
                    <MenuItem id="alterTableMenuItem" caption="Alter Table..." disabled />
                    <MenuItem id="tableMaintenanceMenuItem" caption="Table Maintenance..." disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="dropTableMenuItem" caption="Drop Table..." disabled />
                    <MenuItem id="dropTableMenuItem" caption="Truncate Table..." disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="searchMenuItem" caption="Search Table Data..." disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="refreshMenuItem" caption="Refresh All" disabled />
                </Menu>

                <Menu
                    id="columnContextMenu"
                    ref={this.columnContextMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleSchemaTreeContextMenuItemClick}
                >
                    <MenuItem id="selectRowsMenuItem" caption="Select Rows" />
                    <MenuItem id="clipboardMenu" caption="Copy to Clipboard">
                        <MenuItem id="clipboardNameMenuItem" caption="Name" disabled />
                        <MenuItem id="clipboardCreateStatementMenuItem" caption="Select Columns Statement" disabled />
                        <MenuItem id="clipboardInsertStatementMenuItem" caption="Insert Statement" disabled />
                        <MenuItem id="clipboardUpdateStatementMenuItem" caption="Update Statement" disabled />
                    </MenuItem>
                    <MenuItem id="sendToEditorMenu" caption="Send to SQL Editor">
                        <MenuItem id="editorNameMenuItem" caption="Name" disabled />
                        <MenuItem id="editorCreateStatementMenuItem" caption="Select Columns Statement" disabled />
                        <MenuItem id="editorInsertStatementMenuItem" caption="Insert Statement" disabled />
                        <MenuItem id="editorUpdateStatementMenuItem" caption="Update Statement" disabled />
                    </MenuItem>
                    <MenuItem id="createIndex" caption="Create index" disabled />
                    <MenuItem id="refreshMenuItem" caption="Refresh All" disabled />
                </Menu>

                <Menu
                    id="viewContextMenu"
                    ref={this.viewContextMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleSchemaTreeContextMenuItemClick}
                >
                    <MenuItem id="selectRowsMenuItem" caption="Select Rows" />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="clipboardMenu" caption="Copy to Clipboard">
                        <MenuItem id="clipboardNameMenuItem" caption="Name" disabled />
                        <MenuItem id="clipboardCreateStatementMenuItem" caption="Create Statement" disabled />
                    </MenuItem>
                    <MenuItem id="sendToEditorMenu" caption="Send to SQL Editor">
                        <MenuItem id="editorNameMenuItem" caption="Name" disabled />
                        <MenuItem id="editorCreateStatementMenuItem" caption="Create Statement" disabled />
                    </MenuItem>
                    <MenuItem caption="-" disabled />
                    <MenuItem id="createViewMenuItem" caption="Create View ..." disabled />
                    <MenuItem id="alterViewMenuItem" caption="Alter View ..." disabled />
                    <MenuItem id="dropViewMenuItem" caption="Drop View ..." disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="refreshMenuItem" caption="Refresh All" disabled />
                </Menu>

                <Menu
                    id="eventContextMenu"
                    ref={this.eventContextMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleSchemaTreeContextMenuItemClick}
                >
                    <MenuItem id="selectRowsMenuItem" caption="Select Rows" />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="clipboardMenu" caption="Copy to Clipboard">
                        <MenuItem id="clipboardNameMenuItem" caption="Name" disabled />
                        <MenuItem id="clipboardCreateStatementMenuItem" caption="Create Statement" disabled />
                    </MenuItem>
                    <MenuItem id="sendToEditorMenu" caption="Send to SQL Editor">
                        <MenuItem id="editorNameMenuItem" caption="Name" disabled />
                        <MenuItem id="editorCreateStatementMenuItem" caption="Create Statement" disabled />
                    </MenuItem>
                    <MenuItem caption="-" disabled />
                    <MenuItem id="createViewMenuItem" caption="Create Event ..." disabled />
                    <MenuItem id="alterViewMenuItem" caption="Alter Event ..." disabled />
                    <MenuItem id="dropViewMenuItem" caption="Drop Event ..." disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="refreshMenuItem" caption="Refresh All" disabled />
                </Menu>

                <Menu
                    id="routineContextMenu"
                    ref={this.routineContextMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleSchemaTreeContextMenuItemClick}
                >
                    <MenuItem id="selectRowsMenuItem" caption="Select Rows" />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="clipboardMenu" caption="Copy to Clipboard">
                        <MenuItem id="clipboardNameMenuItem" caption="Name" disabled />
                        <MenuItem id="clipboardCreateStatementMenuItem" caption="Create Statement" disabled />
                    </MenuItem>
                    <MenuItem id="sendToEditorMenu" caption="Send to SQL Editor">
                        <MenuItem id="editorNameMenuItem" caption="Name" disabled />
                        <MenuItem id="editorCreateStatementMenuItem" caption="Create Statement" disabled />
                    </MenuItem>
                    <MenuItem caption="-" disabled />
                    <MenuItem id="createViewMenuItem" caption="Create Routine ..." disabled />
                    <MenuItem id="alterViewMenuItem" caption="Alter Routine ..." disabled />
                    <MenuItem id="dropViewMenuItem" caption="Drop Routine ..." disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="refreshMenuItem" caption="Refresh All" disabled />
                </Menu>

                <Menu
                    id="indexContextMenu"
                    ref={this.indexContextMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleSchemaTreeContextMenuItemClick}
                >
                    <MenuItem id="selectRowsMenuItem" caption="Select Rows" />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="clipboardMenu" caption="Copy to Clipboard">
                        <MenuItem id="clipboardNameMenuItem" caption="Name" disabled />
                        <MenuItem id="clipboardCreateStatementMenuItem" caption="Create Statement" disabled />
                    </MenuItem>
                    <MenuItem id="sendToEditorMenu" caption="Send to SQL Editor">
                        <MenuItem id="editorNameMenuItem" caption="Name" disabled />
                        <MenuItem id="editorCreateStatementMenuItem" caption="Create Statement" disabled />
                    </MenuItem>
                    <MenuItem caption="-" disabled />
                    <MenuItem id="refreshMenuItem" caption="Refresh All" disabled />
                </Menu>

                <Menu
                    id="triggerContextMenu"
                    ref={this.triggerContextMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleSchemaTreeContextMenuItemClick}
                >
                    <MenuItem id="createSchemaMenuItem" caption="Create Schema" disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="refreshMenuItem" caption="Refresh All" disabled />
                </Menu>

                <Menu
                    id="fkContextMenu"
                    ref={this.fkContextMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleSchemaTreeContextMenuItemClick}
                >
                    <MenuItem id="createSchemaMenuItem" caption="Create Schema" disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="refreshMenuItem" caption="Refresh All" disabled />
                </Menu>

                <Menu
                    id="folderContextMenu"
                    ref={this.folderContextMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleScriptTreeContextMenuItemClick}
                >
                    <MenuItem id="removeFolder" caption="Remove Folder" disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="refreshMenuItem" caption="Refresh All" disabled />
                </Menu>

                <Menu
                    id="scriptContextMenu"
                    ref={this.scriptContextMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleScriptTreeContextMenuItemClick}
                >
                    <MenuItem id="openScriptItem" caption="Open Script in Editor" disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="cutScriptMenuItem" caption="Cut" disabled />
                    <MenuItem id="copyScriptMenuItem" caption="Copy" disabled />
                    <MenuItem id="copyScriptPathMenuItem" caption="Copy Path" disabled />
                    <MenuItem id="pasteScriptMenuItem" caption="Paste" disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="renameScriptMenuItem" caption="Rename Script" disabled />
                    <MenuItem id="deleteScriptMenuItem" caption="Delete Script" />
                </Menu>

            </>
        );
    }

    private showSchemaTreeContextMenu = (rowData: ISchemaTreeEntry, e: MouseEvent): boolean => {
        const targetRect = new DOMRect(e.clientX, e.clientY, 2, 2);

        switch (rowData.type) {
            case SchemaTreeType.Schema: {
                this.schemaContextMenuRef.current?.open(targetRect, false, {}, rowData);

                break;
            }

            case SchemaTreeType.Table: {
                this.tableContextMenuRef.current?.open(targetRect, false, {}, rowData);

                break;
            }

            case SchemaTreeType.Indexes: {
                this.indexContextMenuRef.current?.open(targetRect, false, {}, rowData);

                break;
            }

            case SchemaTreeType.Routine: {
                this.routineContextMenuRef.current?.open(targetRect, false, {}, rowData);

                break;
            }

            case SchemaTreeType.Event: {
                this.eventContextMenuRef.current?.open(targetRect, false, {}, rowData);

                break;
            }

            case SchemaTreeType.ForeignKeys: {
                this.fkContextMenuRef.current?.open(targetRect, false, {}, rowData);

                break;
            }

            case SchemaTreeType.Views: {
                this.viewContextMenuRef.current?.open(targetRect, false, {}, rowData);

                break;
            }

            case SchemaTreeType.Trigger: {
                this.triggerContextMenuRef.current?.open(targetRect, false, {}, rowData);

                break;
            }

            default: {
                break;
            }
        }

        return true;
    };

    private handleSchemaTreeContextMenuItemClick = (e: React.MouseEvent, props: IMenuItemProperties,
        payload: unknown): boolean => {
        const { id, onContextMenuItemClick } = this.props;

        const data = payload as ISchemaTreeEntry;
        switch (props.id!) {
            case "selectRowsMenuItem": {
                void requisitions.execute("explorerShowRows", data);

                break;
            }

            default: {
                onContextMenuItemClick?.(id!, props.id!, data);

                break;
            }
        }

        return true;
    };

    private updateSchemaList(): void {
        const { schemaTree } = this.props;
        if (schemaTree.length === 0) {
            this.loadSchemaList();
        } else {
            // Derive initial expand state from the saved schema tree.
            const collectFromArray = (list: ISchemaTreeEntry[]): void => {
                list.forEach((entry: ISchemaTreeEntry) => {
                    collectFromArray(entry.children ?? []);
                });
            };

            collectFromArray(schemaTree);
            this.setState({ schemaList: schemaTree });
        }
    }

    private loadSchemaList = (): void => {
        const { backend } = this.props;
        const schemaList: ISchemaTreeEntry[] = [];

        backend.getCatalogObjects("Schema", "").then((schemaEvent: ICommSimpleResultEvent) => {
            switch (schemaEvent.eventType) {
                case EventType.DataResponse:
                case EventType.FinalResponse: {
                    for (const schema of (schemaEvent.data?.result as string[])) {
                        const schemaEntry: ISchemaTreeEntry = {
                            type: SchemaTreeType.Schema,
                            expanded: false,
                            expandedOnce: false,
                            qualifiedName: { schema },
                            id: schema,
                            caption: schema,
                            details: null,
                            children: [
                                this.generateGroupNode("Tables", "Table", schema),
                                this.generateGroupNode("Views", "View", schema),
                                this.generateGroupNode("Routines", "Routine", schema),
                                this.generateGroupNode("Events", "Event", schema),
                                this.generateGroupNode("Triggers", "Trigger", schema),
                                this.generateGroupNode("Foreign Keys", "Foreign Key", schema),
                                this.generateGroupNode("Indexes", "Index", schema),
                            ],
                        };
                        schemaList.push(schemaEntry);

                    }
                    this.setState({ schemaList });
                    break;
                }

                default: {
                    break;
                }
            }
        }).catch((errorEvent: ICommErrorEvent): void => {
            void requisitions.execute("showError", ["Backend Error", String(errorEvent.message)]);
        });
    };

    private schemaTreeCellFormatter = (cell: Tabulator.CellComponent): string | HTMLElement => {
        const data = cell.getData() as ISchemaTreeEntry;

        let icon;
        switch (data.type) {
            case SchemaTreeType.Schema: {
                icon = <Icon src={schemaIcon} width={20} height={20} />;
                break;
            }

            case SchemaTreeType.Table: {
                icon = <Icon src={tableIcon} width={20} height={20} />;
                break;
            }

            case SchemaTreeType.Column: {
                icon = <Icon src={columnIcon} width={20} height={20} />;
                break;
            }

            default: {
                icon = "";
                break;
            }
        }

        const host = document.createElement("div");
        host.className = "schemaTreeEntry";
        const content = <>
            {icon}
            <Label caption={data.caption} />
        </>;

        render(content, host);

        return host;
    };

    private scriptTreeCellFormatter = (cell: Tabulator.CellComponent): string | HTMLElement => {
        const data = cell.getData() as IModuleDataEntry;

        let image;
        switch (data.type) {
            case EntityType.Script: {
                const actualIcon = documentTypeToIcon.get((data as IDBEditorScriptState).language || "text");

                if (actualIcon) {
                    image = <Image src={actualIcon} width={20} height={20} />;
                }

                break;
            }

            case EntityType.Folder: {
                // HACK: tabulator-tables provides no API to determine if a row is expanded, so we use internal
                // structures here, to get this information.
                const row = cell.getRow();

                /* eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-explicit-any */
                const treeInfo = (row as any)._row.modules.dataTree;
                image = <Icon
                    src={treeInfo.open ? Codicon.FolderOpened : Codicon.Folder}
                    width={20}
                    height={20}
                />;

                break;
            }

            default: {
                break;
            }
        }

        const host = document.createElement("div");
        host.className = "schemaTreeEntry";
        const content = <>
            {image}
            <Label caption={data.caption} />
        </>;

        render(content, host);

        return host;
    };

    private removeDummyNode = (row: Tabulator.RowComponent): void => {
        const children = row.getTreeChildren();
        if (children.length > 0) {
            const firstEntry = children[0].getData() as ISchemaTreeEntry;
            if (firstEntry.caption === "loading...") {
                void children[0].delete();
            }
        }
    };

    private handleRowExpanded = (row: Tabulator.RowComponent): void => {
        const entry = row.getData() as ISchemaTreeEntry;
        entry.expanded = true;
        if (entry.expanded && !entry.expandedOnce) {
            entry.expandedOnce = true;

            const schema = entry.qualifiedName.schema;
            const tableOrPromise = this.tableRef.current?.table;
            const tree = tableOrPromise instanceof Tabulator ? tableOrPromise : undefined;

            switch (entry.type) {
                case SchemaTreeType.GroupNode: {
                    switch (entry.id) {
                        case "groupNode.Tables": {
                            this.renderTables(schema, row, tree);
                            break;
                        }

                        case "groupNode.Views":
                        case "groupNode.Routines":
                        case "groupNode.Events":
                        case "groupNode.Triggers":
                        case "groupNode.Foreign Keys":
                        case "groupNode.Indexes": {
                            this.renderObjects(schema, entry.qualifiedName.name ?? "", "", row, tree);
                            break;
                        }

                        case "groupNode.Columns": {
                            const table = entry.qualifiedName.table ?? "<error>";
                            this.renderColumns(schema, table, row, tree);
                            break;
                        }

                        default: {
                            break;
                        }
                    }
                    break;
                }

                default: {
                    break;
                }
            }
        }
    };

    private groupNodeToSchemaTreeTypeName = (value: string): SchemaTreeType => {
        let ret = SchemaTreeType.GroupNode;
        switch (value) {
            case "groupNode.Tables":
                ret = SchemaTreeType.Table;
                break;
            case "groupNode.Views":
                ret = SchemaTreeType.Views;
                break;
            case "groupNode.Routines":
                ret = SchemaTreeType.Routine;
                break;
            case "groupNode.Events":
                ret = SchemaTreeType.Event;
                break;
            case "groupNode.Triggers":
                ret = SchemaTreeType.Trigger;
                break;
            case "groupNode.Foreign Keys":
                ret = SchemaTreeType.ForeignKeys;
                break;
            case "groupNode.Indexes":
                ret = SchemaTreeType.Indexes;
                break;
            case "groupNode.Columns":
                ret = SchemaTreeType.Column;
                break;
            default: {
                break;
            }
        }

        return ret;
    };

    private handleRowCollapsed = (row: Tabulator.RowComponent): void => {
        const entry = row.getData() as ISchemaTreeEntry;
        entry.expanded = false;
    };

    private isRowExpanded = (row: Tabulator.RowComponent): boolean => {
        const { markedSchema } = this.props;

        const entry = row.getData() as ISchemaTreeEntry;
        if (entry.id === markedSchema && !entry.expandedOnce) {
            return true;
        }

        return entry.expanded;
    };

    private handleFormatSchemaRow = (row: Tabulator.RowComponent): void => {
        const { markedSchema } = this.props;

        const entry = row.getData() as ISchemaTreeEntry;

        if (entry.caption === markedSchema) {
            row.getElement().classList.add("marked");
        } else {
            row.getElement().classList.remove("marked");
        }
    };

    private handleSchemaTreeRowContext = (event: Event, row: Tabulator.RowComponent): void => {
        const entry = row.getData() as ISchemaTreeEntry;
        this.showSchemaTreeContextMenu(entry, event as MouseEvent);
    };

    private handleSchemaTreeDoubleClick = (e: Event, cell: Tabulator.CellComponent): void => {
        void requisitions.execute("explorerDoubleClick", cell.getData() as ISchemaTreeEntry);
    };

    private handleAccordionItemClick = (e: React.SyntheticEvent, props: IComponentProperties): void => {
        const { onSelectItem } = this.props;

        if (props.id) {
            onSelectItem?.(props.id);
        }
    };

    private handleScriptItemClick = (e: UIEvent, cell: Tabulator.CellComponent): void => {
        const { onSelectItem } = this.props;

        const data = cell.getData() as IModuleDataEntry;
        if (data.type === EntityType.Script && data.id) {
            onSelectItem?.(data.id);
        }
    };

    private handleKeyPress = (e: React.KeyboardEvent, props: IComponentProperties): void => {
        if (keyboardKey.getCode(e) === keyboardKey.Enter) {
            // Starting an edit action.
            const { editors } = this.props;
            const item = editors.find((candidate: IEntityBase) => {
                return candidate.id === props.id;
            });

            if (item) {
                this.setState({ editing: props.id, tempCaption: item.caption });
            }
        }
    };

    private handleEditorClose = (e: React.SyntheticEvent, itemId?: string): void => {
        const { onCloseItem } = this.props;
        onCloseItem?.(itemId || "");
    };

    private handleSectionAction = (props: IAccordionProperties, id: string, actionId: string): void => {
        switch (actionId) {
            case "addConsole": {
                const { onAddItem, editors } = this.props;
                const newId = onAddItem?.();
                if (newId) {
                    const item = editors.find((candidate: IEntityBase) => {
                        return candidate.id === newId;
                    });

                    setTimeout(() => {
                        // Start editing after a moment, to avoid autofocus stopping an ongoing edit.
                        this.setState({ editing: newId, tempCaption: item?.caption });
                    }, 200);
                }

                break;
            }

            case "addTSScript": {
                const { onAddScript } = this.props;
                onAddScript?.("typescript");

                break;
            }

            case "addJSScript": {
                const { onAddScript } = this.props;
                onAddScript?.("javascript");

                break;
            }

            case "addSQLScript": {
                const { onAddScript } = this.props;
                onAddScript?.("sql");

                break;
            }

            case "addFolder": {
                const { onAddFolder } = this.props;

                break;
            }

            default: {
                break;
            }
        }
    };

    private handleSectionExpand = (props: IAccordionProperties, sectionId: string, expanded: boolean): void => {
        const { id, onSaveExplorerState, state } = this.props;

        const newMap = state ? new Map(state) : new Map<string, IExplorerSectionState>();
        const sectionState = newMap.get(sectionId) ?? {};
        sectionState.expanded = expanded;

        newMap.set(sectionId, sectionState);

        onSaveExplorerState?.(id!, newMap);
    };

    private handleSectionResize = (props: IAccordionProperties, sectionId: string, size: number): void => {
        const { id, onSaveExplorerState, state } = this.props;

        const newMap = state ? new Map(state) : new Map<string, IExplorerSectionState>();
        const sectionState = newMap.get(sectionId) ?? {};
        sectionState.size = size;

        newMap.set(sectionId, sectionState);

        onSaveExplorerState?.(id!, newMap);
    };

    private handleEditingDone = (): void => {
        const { onChangeItem } = this.props;
        const { editing, tempCaption } = this.state;

        if (editing && tempCaption && onChangeItem) {
            onChangeItem?.(editing, tempCaption);
        }
        this.setState({ editing: undefined, tempCaption: undefined });
    };

    private renderEditorEntries = (): React.ReactNode => {
        const { editors, selectedEntry } = this.props;
        const { editing, tempCaption } = this.state;

        return editors.map((entry: IOpenEditorState) => {
            if (entry.id === editing) {
                return (
                    <Input
                        key={entry.id}
                        value={tempCaption}
                        initialSelection={{ start: 0, end: 1000 }}
                        autoFocus
                        onBlur={this.handleEditingDone}
                        onChange={(e, props): void => {
                            return this.setState({ tempCaption: props.value });
                        }}
                        onConfirm={this.handleEditingDone}
                        onCancel={(): void => {
                            return this.setState({
                                editing: undefined,
                                tempCaption: undefined,
                            });
                        }}
                    />
                );
            } else {
                const language = entry.state.model.getLanguageId() as EditorLanguage;
                const icon = documentTypeToIcon.get(language) || defaultIcon;

                return (
                    <Accordion.Item
                        id={entry.id}
                        key={entry.id}
                        caption={entry.caption}
                        active={entry.id === selectedEntry}
                        icon={icon}
                        closable={true}
                        onClose={this.handleEditorClose}
                        onClick={this.handleAccordionItemClick}
                        onKeyPress={this.handleKeyPress}
                    />
                );
            }
        });
    };

    private renderScriptEntries = (): React.ReactNode => {
        const { scripts, selectedEntry } = this.props;

        if (scripts.length === 0) {
            return <Accordion.Item caption="<no scripts>" />;
        }

        const scriptTreeColumns: Tabulator.ColumnDefinition[] = [{
            title: "",
            field: "name",
            resizable: false,
            editable: (cell: Tabulator.CellComponent): boolean => {
                // Allow editing only if the row of this cell is already selected.
                const rowElement = cell.getRow().getElement();

                return rowElement.classList.contains("tabulator-selected");
            },
            hozAlign: "left",
            formatter: this.scriptTreeCellFormatter,
            cellClick: this.handleScriptItemClick,
            editor: "input",
            cellEdited: this.handleCellEdited,
        }];

        const scriptTreeOptions: ITreeGridOptions = {
            treeColumn: "name",
            selectionType: SelectionType.Single,
            showHeader: false,
            layout: "fitColumns",
            expandedLevels: [true, false, true],
        };

        return <TreeGrid
            ref={this.tableRef}
            options={scriptTreeOptions}
            columns={scriptTreeColumns}
            tableData={scripts}
            selectedIds={[selectedEntry]}

            onRowContext={this.handleScriptTreeRowContext}
        />;
    };

    private handleCellEdited = (cell: Tabulator.CellComponent): void => {
        const { onChangeItem } = this.props;
        const data = cell.getData() as IModuleDataEntry;

        onChangeItem?.(data.id, cell.getValue() as string);
    };

    private handleScriptTreeRowContext = (event: Event, row: Tabulator.RowComponent): void => {
        const entry = row.getData() as IModuleDataEntry;
        this.showScriptTreeContextMenu(entry, event as MouseEvent);
    };

    private showScriptTreeContextMenu = (rowData: IModuleDataEntry, e: MouseEvent): boolean => {
        const targetRect = new DOMRect(e.clientX, e.clientY, 2, 2);

        switch (rowData.type) {
            case EntityType.Folder: {
                this.folderContextMenuRef.current?.open(targetRect, false, {}, rowData);

                break;
            }

            case EntityType.Script: {
                this.scriptContextMenuRef.current?.open(targetRect, false, {}, rowData);

                break;
            }

            default: {
                break;
            }
        }

        return true;
    };

    private handleScriptTreeContextMenuItemClick = (e: React.MouseEvent, props: IMenuItemProperties,
        payload: unknown): boolean => {
        const { id, onContextMenuItemClick } = this.props;

        const data = payload as IModuleDataEntry;
        switch (props.id!) {
            case "selectRowsMenuItem": {
                void requisitions.execute("explorerShowRows", data);

                break;
            }

            default: {
                onContextMenuItemClick?.(id!, props.id!, data);

                break;
            }
        }

        return true;
    };

    private renderTables = (schema: string, row: Tabulator.RowComponent, tree?: Tabulator): void => {
        const { backend } = this.props;
        const listener = backend.getSchemaObjects(schema, "Table", "");
        listener.then((event: ICommSimpleResultEvent) => {
            switch (event.eventType) {
                case EventType.ErrorResponse: {
                    void requisitions.execute("showError", ["Table Retrieval Error", String(event.message)]);
                    break;
                }

                case EventType.DataResponse:
                case EventType.FinalResponse: {
                    tree?.blockRedraw();
                    this.removeDummyNode(row);
                    for (const table of event.data?.result as string[]) {
                        const newChild = {
                            type: SchemaTreeType.Table,
                            expanded: false,
                            expandedOnce: false,
                            qualifiedName: { schema, table },
                            id: schema + "." + table,
                            caption: table,
                            details: null,
                            children: [
                                this.generateGroupNode("Columns", "Column", schema, table),
                            ],
                        };
                        row.addTreeChild(newChild);
                    }
                    row.treeExpand();
                    tree?.restoreRedraw();

                    break;
                }

                default: {
                    break;
                }
            }
        });
    };

    private renderColumns = (schema: string, table: string, row: Tabulator.RowComponent, tree?: Tabulator): void => {
        const { backend } = this.props;
        const listener = backend.getSchemaTableColumns(schema, table);

        listener.then((event: ICommMetaDataEvent) => {
            switch (event.eventType) {
                case EventType.DataResponse:
                case EventType.FinalResponse: {
                    tree?.blockRedraw();
                    this.removeDummyNode(row);

                    const result = event.data?.result;
                    if (result && !Array.isArray(result) && result.columns) {
                        for (const column of result.columns) {
                            const newChild = {
                                type: SchemaTreeType.Column,
                                expanded: false,
                                expandedOnce: false,
                                qualifiedName: {
                                    schema,
                                    table,
                                    name: column,
                                },
                                id: `${schema}.${table}.${column}`,
                                caption: column,
                                details: null,
                            };

                            row.addTreeChild(newChild);
                        }
                    }

                    row.treeExpand();
                    tree?.restoreRedraw();

                    break;
                }

                default: {
                    // Ignore.
                    break;
                }
            }
        }).catch((event) => {
            void requisitions.execute("showError",
                ["Backend Error", "Could not get column information.", String(event.message)]);
        });
    };

    private renderObjects = (schema: string, type: string, filter: string, row: Tabulator.RowComponent,
        tree?: Tabulator): void => {

        const { backend } = this.props;
        const listener = backend.getSchemaObjects(schema, type, filter);

        listener.then((event: ICommSimpleResultEvent) => {
            switch (event.eventType) {
                case EventType.DataResponse:
                case EventType.FinalResponse: {
                    tree?.blockRedraw();
                    this.removeDummyNode(row);
                    const entry = row.getData() as ISchemaTreeEntry;
                    for (const item of event.data?.result as string[]) {
                        const newChild = {
                            type: this.groupNodeToSchemaTreeTypeName(entry.id),
                            expanded: false,
                            expandedOnce: false,
                            qualifiedName: { schema, name: item },
                            id: schema + "." + filter + "." + item,
                            caption: item,
                            details: null,
                        };
                        row.addTreeChild(newChild);
                    }
                    row.treeExpand();
                    tree?.restoreRedraw();

                    break;
                }

                default: {
                    // Ignore.
                    break;
                }
            }
        }).catch((event) => {
            void requisitions.execute("showError",
                ["Backend Error", "Retrieving schema objects failed:", String(event.message)]);
        });
    };

    private generateGroupNode(label: string, name: string, schema: string, table?: string): ISchemaTreeEntry<unknown> {
        return {
            type: SchemaTreeType.GroupNode,
            expanded: false,
            expandedOnce: false,
            qualifiedName: { schema, table, name },
            id: "groupNode." + label,
            caption: label,
            details: null,
            children: [{
                type: SchemaTreeType.GroupNode,
                expanded: false,
                expandedOnce: false,
                qualifiedName: { schema: "" },
                id: label + "<loading>",
                caption: "loading...",
                details: null,
            }],
        };
    }

}
