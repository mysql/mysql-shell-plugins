/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import schemaIcon from "../../assets/images/schema.svg";

import tableIcon from "../../assets/images/schemaTable.svg";
import tablesIcon from "../../assets/images/schemaTables.svg";

import columnIcon from "../../assets/images/schemaTableColumn.svg";
import columnsIcon from "../../assets/images/schemaTableColumns.svg";

import routineIcon from "../../assets/images/schemaRoutine.svg";
import routinesIcon from "../../assets/images/schemaRoutines.svg";

import eventIcon from "../../assets/images/schemaEvent.svg";
import eventsIcon from "../../assets/images/schemaEvents.svg";

import triggerIcon from "../../assets/images/schemaTableTrigger.svg";
import triggersIcon from "../../assets/images/schemaTableTriggers.svg";

import viewIcon from "../../assets/images/schemaView.svg";
import viewsIcon from "../../assets/images/schemaViews.svg";

import indexIcon from "../../assets/images/schemaTableIndex.svg";
import indexesIcon from "../../assets/images/schemaTableIndexes.svg";

import foreignKeyIcon from "../../assets/images/schemaTableForeignKey.svg";
//import foreignKeysIcon from "../../assets/images/schemaTableForeignKeys.svg";

import adminPerformanceDashboardIcon from "../../assets/images/adminPerformanceDashboard.svg";
import adminServerStatusIcon from "../../assets/images/adminServerStatus.svg";
import clientConnectionsIcon from "../../assets/images/clientConnections.svg";

import defaultIcon from "../../assets/images/file-icons/default.svg";
import javascriptIcon from "../../assets/images/file-icons/scriptJs.svg";
import mysqlIcon from "../../assets/images/file-icons/scriptMysql.svg";
import sqliteIcon from "../../assets/images/file-icons/scriptSqlite.svg";
import pythonIcon from "../../assets/images/file-icons/scriptPy.svg";
import notebookIcon from "../../assets/images/notebook.svg";
import typescriptIcon from "../../assets/images/file-icons/scriptTs.svg";

import { ComponentChild, createRef, render } from "preact";
import { CellComponent, ColumnDefinition, RowComponent } from "tabulator-tables";

import {
    EntityType, IDBDataEntry, IDBEditorScriptState, IEntityBase, ISchemaTreeEntry, SchemaTreeType,
} from "./index.js";
import { Codicon } from "../../components/ui/Codicon.js";
import { IOpenEditorState } from "./DBConnectionTab.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { EditorLanguage } from "../../supplement/index.js";
import { Accordion, IAccordionProperties } from "../../components/ui/Accordion/Accordion.js";
import { IAccordionItemProperties } from "../../components/ui/Accordion/AccordionItem.js";
import {
    IComponentProperties, IComponentState, ComponentBase, SelectionType, ComponentPlacement,
} from "../../components/ui/Component/ComponentBase.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Input } from "../../components/ui/Input/Input.js";
import { Label } from "../../components/ui/Label/Label.js";
import { Menu } from "../../components/ui/Menu/Menu.js";
import { Image } from "../../components/ui/Image/Image.js";
import { MenuItem, IMenuItemProperties } from "../../components/ui/Menu/MenuItem.js";
import { TreeGrid, ITreeGridOptions, TabulatorProxy } from "../../components/ui/TreeGrid/TreeGrid.js";
import { DBType } from "../../supplement/ShellInterface/index.js";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { ISplitterPaneSizeInfo } from "../../components/ui/SplitContainer/SplitContainer.js";
import { KeyboardKeys, uuid } from "../../utilities/helpers.js";
import { quote } from "../../utilities/string-helpers.js";
import { Settings } from "../../supplement/Settings/Settings.js";

/** Lookup for icons for a specific document type. */
export const documentTypeToIcon: Map<EditorLanguage, string> = new Map([
    ["javascript", javascriptIcon],
    ["mysql", mysqlIcon],
    ["sql", sqliteIcon],
    ["python", pythonIcon],
    ["msg", notebookIcon],
    ["typescript", typescriptIcon],
]);

/** Lookup for icons for special pages. */
export const pageTypeToIcon: Map<EntityType, string> = new Map([
    [EntityType.Status, adminServerStatusIcon],
    [EntityType.Connections, clientConnectionsIcon],
    [EntityType.Dashboard, adminPerformanceDashboardIcon],
]);

export interface IExplorerSectionState {
    expanded?: boolean;
    size?: number;
}

interface IExplorerProperties extends IComponentProperties {
    // The schema tree as loaded so far.
    schemaTree: ISchemaTreeEntry[];
    editors: IOpenEditorState[];
    scripts: IDBDataEntry[];
    selectedEntry: string;
    markedSchema: string;
    backend: ShellInterfaceSqlEditor;

    dbType: DBType;

    // The state of each accordion item.
    savedState?: Map<string, IExplorerSectionState>;

    onSelectItem?: (id: string, type: EntityType, caption: string) => void;
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

export class Explorer extends ComponentBase<IExplorerProperties, IExplorerState> {

    private tableRef = createRef<TreeGrid>();
    private schemaContextMenuRef = createRef<Menu>();
    private tableContextMenuRef = createRef<Menu>();
    private columnContextMenuRef = createRef<Menu>();
    private viewContextMenuRef = createRef<Menu>();
    private triggerContextMenuRef = createRef<Menu>();
    private indexContextMenuRef = createRef<Menu>();
    private fkContextMenuRef = createRef<Menu>();
    private eventContextMenuRef = createRef<Menu>();
    private routineContextMenuRef = createRef<Menu>();

    private folderContextMenuRef = createRef<Menu>();
    private scriptContextMenuRef = createRef<Menu>();

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

        onSaveSchemaTree?.(id ?? "", schemaList ?? []);
    }

    public componentDidUpdate(prevProps: IExplorerProperties, prevState: IExplorerState): void {
        const { id, markedSchema, onSaveSchemaTree } = this.props;
        if (id !== prevProps.id) {
            const { schemaList } = prevState;

            onSaveSchemaTree?.(prevProps.id!, schemaList || []);

            this.updateSchemaList();
        }

        if (markedSchema !== prevProps.markedSchema) {
            void this.tableRef.current?.table.then((table) => {
                if (table) {
                    let rows = table.searchRows("caption", "=", markedSchema);
                    rows.forEach((row) => {
                        row.reformat();
                    });
                    rows = table.searchRows("caption", "=", prevProps.markedSchema);
                    rows.forEach((row) => {
                        row.reformat();
                    });
                }
            });
        }
    }

    public render(): ComponentChild {
        const { savedState, dbType } = this.props;
        const { editing, schemaList } = this.state;

        const className = this.getEffectiveClassNames(["scriptingExplorer"]);

        const schemaTreeColumns: ColumnDefinition[] = [{
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
                tableData={schemaList}

                onRowExpanded={this.handleRowExpanded}
                onRowCollapsed={this.handleRowCollapsed}
                isRowExpanded={this.isRowExpanded}
                onFormatRow={this.handleFormatSchemaRow}
                onRowContext={this.handleSchemaTreeRowContext}
            />;

        const editorSectionState = savedState?.get("editorSection") ?? {};
        const schemaSectionState = savedState?.get("schemaSection") ?? {};
        const adminSectionState = savedState?.get("adminSection") ?? {};
        const scriptSectionState = savedState?.get("scriptSection") ?? {};

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
                            dimmed: editing != null,
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
                            id: "adminSection",
                            caption: "ADMINISTRATION",
                            stretch: true,
                            expanded: adminSectionState.expanded,
                            initialSize: adminSectionState.size,
                            resizable: true,
                            minSize: 100,
                            content: [
                                <Accordion.Item
                                    key="serverStatus"
                                    id={uuid()}
                                    caption="Server Status"
                                    picture={<Icon src={adminServerStatusIcon} width="20px" height="20px" />}
                                    payload={{ type: EntityType.Status }}
                                    onClick={this.handleAccordionItemClick}
                                />,
                                <Accordion.Item
                                    key="clientConnections"
                                    id={uuid()}
                                    caption="Client Connections"
                                    picture={<Icon src={clientConnectionsIcon} width="20px" height="20px" />}
                                    payload={{ type: EntityType.Connections }}
                                    onClick={this.handleAccordionItemClick}
                                />,
                                <Accordion.Item
                                    key="performanceDashboard"
                                    id={uuid()}
                                    caption="Performance Dashboard"
                                    picture={<Icon
                                        src={adminPerformanceDashboardIcon}
                                        width="20px"
                                        height="20px"
                                    />}
                                    payload={{ type: EntityType.Dashboard }}
                                    onClick={this.handleAccordionItemClick}
                                />,
                            ],
                        },
                        {
                            id: "scriptSection",
                            caption: "SCRIPTS",
                            dimmed: editing != null,
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
                    <MenuItem id="setCurrentSchemaMenuItem" caption="Set as Current Schema" />
                    <MenuItem id="filterMenuItem" caption="Filter to this Schema" disabled />
                    <MenuItem id="inspectorMenuItem" caption="Show Schema Inspector" disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="clipboardMenu" caption="Copy to Clipboard">
                        <MenuItem id="clipboardNameMenuItem" caption="Name" />
                        <MenuItem id="clipboardCreateStatementMenuItem" caption="Create Statement" />
                    </MenuItem>
                    <MenuItem id="sendToEditorMenu" caption="Send to SQL Editor">
                        <MenuItem id="editorNameMenuItem" caption="Name" />
                        <MenuItem id="editorCreateStatementMenuItem" caption="Create Statement" />
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
                    <MenuItem id="tableDataExportMenuItem" caption="Table Data Export Wizard" disabled />
                    <MenuItem id="tableDataImportMenuItem" caption="Table Data Import Wizard" disabled />
                    <MenuItem caption="-" disabled />
                    <MenuItem id="clipboardMenu" caption="Copy to Clipboard">
                        <MenuItem id="clipboardNameMenuItem" caption="Name" />
                        <MenuItem id="clipboardCreateStatementMenuItem" caption="Create Statement" />
                    </MenuItem>
                    <MenuItem id="sendToEditorMenu" caption="Send to SQL Editor">
                        <MenuItem id="editorNameMenuItem" caption="Name" />
                        <MenuItem id="editorCreateStatementMenuItem" caption="Create Statement" />
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
                        <MenuItem id="clipboardNameMenuItem" caption="Name" />
                        <MenuItem id="clipboardInsertStatementMenuItem" caption="Insert Statement" disabled />
                        <MenuItem id="clipboardUpdateStatementMenuItem" caption="Update Statement" disabled />
                    </MenuItem>
                    <MenuItem id="sendToEditorMenu" caption="Send to SQL Editor">
                        <MenuItem id="editorNameMenuItem" caption="Name" disabled />
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
                        <MenuItem id="clipboardNameMenuItem" caption="Name" />
                        <MenuItem id="clipboardCreateStatementMenuItem" caption="Create Statement" />
                    </MenuItem>
                    <MenuItem id="sendToEditorMenu" caption="Send to SQL Editor">
                        <MenuItem id="editorNameMenuItem" caption="Name" />
                        <MenuItem id="editorCreateStatementMenuItem" caption="Create Statement" />
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
                    <MenuItem caption="-" disabled />
                    <MenuItem id="clipboardMenu" caption="Copy to Clipboard">
                        <MenuItem id="clipboardNameMenuItem" caption="Name" />
                        <MenuItem id="clipboardCreateStatementMenuItem" caption="Create Statement" />
                    </MenuItem>
                    <MenuItem id="sendToEditorMenu" caption="Send to SQL Editor">
                        <MenuItem id="editorNameMenuItem" caption="Name" />
                        <MenuItem id="editorCreateStatementMenuItem" caption="Create Statement" />
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
                    <MenuItem id="clipboardMenu" caption="Copy to Clipboard">
                        <MenuItem id="clipboardNameMenuItem" caption="Name" disabled />
                        <MenuItem id="clipboardCreateStatementMenuItem" caption="Create Statement" />
                    </MenuItem>
                    <MenuItem id="sendToEditorMenu" caption="Send to SQL Editor">
                        <MenuItem id="editorNameMenuItem" caption="Name" />
                        <MenuItem id="editorCreateStatementMenuItem" caption="Create Statement" />
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
                    <MenuItem caption="-" disabled />
                    <MenuItem id="clipboardMenu" caption="Copy to Clipboard">
                        <MenuItem id="clipboardNameMenuItem" caption="Name" />
                        <MenuItem id="clipboardCreateStatementMenuItem" caption="Create Statement" />
                    </MenuItem>
                    <MenuItem id="sendToEditorMenu" caption="Send to SQL Editor">
                        <MenuItem id="editorNameMenuItem" caption="Name" />
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

            case SchemaTreeType.Index: {
                this.indexContextMenuRef.current?.open(targetRect, false, {}, rowData);

                break;
            }

            case SchemaTreeType.Column: {
                this.columnContextMenuRef.current?.open(targetRect, false, {}, rowData);

                break;
            }

            case SchemaTreeType.StoredProcedure:
            case SchemaTreeType.StoredFunction: {
                this.routineContextMenuRef.current?.open(targetRect, false, {}, rowData);

                break;
            }

            case SchemaTreeType.Event: {
                this.eventContextMenuRef.current?.open(targetRect, false, {}, rowData);

                break;
            }

            case SchemaTreeType.ForeignKey: {
                this.fkContextMenuRef.current?.open(targetRect, false, {}, rowData);

                break;
            }

            case SchemaTreeType.View: {
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

    private handleSchemaTreeContextMenuItemClick = (e: MouseEvent, props: IMenuItemProperties,
        payload: unknown): boolean => {
        const { id, onContextMenuItemClick } = this.props;

        const data = payload as ISchemaTreeEntry;
        switch (props.id!) {
            case "selectRowsMenuItem": {
                const schema = data.qualifiedName.schema;
                const table = data.qualifiedName.table;

                let query;

                const tableName = `${quote(schema)}.${quote(table ?? "")}`;
                const uppercaseKeywords = Settings.get("dbEditor.upperCaseKeywords", true);
                const select = uppercaseKeywords ? "SELECT" : "select";
                const from = uppercaseKeywords ? "FROM" : "from";
                if (data.type === SchemaTreeType.Column) {
                    query = `${select} ${tableName}.${quote(data.qualifiedName.name ?? "")} ${from} ${tableName}`;
                } else {
                    query = `${select} * ${from} ${tableName}`;
                }

                void requisitions.execute("job", [{
                    requestType: "editorRunQuery", parameter: { query, data: {} },
                }]);

                break;
            }

            default: {
                onContextMenuItemClick?.(id ?? "", props.id!, data);

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

        backend.getCatalogObjects("Schema").then((names) => {
            names.forEach((schema) => {
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
                    ],
                };
                schemaList.push(schemaEntry);

            });

            this.setState({ schemaList });
        }).catch((reason): void => {
            void requisitions.execute("showError", ["Backend Error", String(reason)]);
        });
    };

    private schemaTreeCellFormatter = (cell: CellComponent): string | HTMLElement => {
        const data = cell.getData() as ISchemaTreeEntry;

        let iconName = "";
        switch (data.type) {
            case SchemaTreeType.Schema: {
                iconName = schemaIcon;
                break;
            }

            case SchemaTreeType.Table: {
                iconName = tableIcon;
                break;
            }

            case SchemaTreeType.Column: {
                iconName = columnIcon;
                break;
            }

            case SchemaTreeType.StoredFunction:
            case SchemaTreeType.StoredProcedure: {
                iconName = routineIcon;
                break;
            }

            case SchemaTreeType.Event: {
                iconName = eventIcon;
                break;
            }

            case SchemaTreeType.Trigger: {
                iconName = triggerIcon;
                break;
            }

            case SchemaTreeType.View: {
                iconName = viewIcon;
                break;
            }

            case SchemaTreeType.Index: {
                iconName = indexIcon;
                break;
            }

            case SchemaTreeType.ForeignKey: {
                iconName = foreignKeyIcon;
                break;
            }

            case SchemaTreeType.GroupNode: {
                switch (data.caption) {
                    case "Tables": {
                        iconName = tablesIcon;
                        break;
                    }

                    case "Columns": {
                        iconName = columnsIcon;
                        break;
                    }

                    case "Events": {
                        iconName = eventsIcon;
                        break;
                    }

                    case "Triggers": {
                        iconName = triggersIcon;
                        break;
                    }

                    case "Foreign Keys": {
                        iconName = foreignKeyIcon;
                        break;
                    }

                    case "Indexes": {
                        iconName = indexesIcon;
                        break;
                    }

                    case "Views": {
                        iconName = viewsIcon;
                        break;
                    }

                    case "Routines": {
                        iconName = routinesIcon;
                        break;
                    }

                    default:
                }

                break;
            }

            default:
        }

        const host = document.createElement("div");
        host.className = "schemaTreeEntry";
        const content = <>
            {iconName && <Icon src={iconName} width={16} height={16} />}
            <Label caption={data.caption} />
        </>;

        render(content, host);

        return host;
    };

    private scriptTreeCellFormatter = (cell: CellComponent): string | HTMLElement => {
        const data = cell.getData() as IDBDataEntry;

        let image;
        switch (data.type) {
            case EntityType.Script: {
                const language = (data as IDBEditorScriptState).language;
                const icons = documentTypeToIcon.get(language);
                const actualIcon = icons;

                if (actualIcon) {
                    image = <Image src={actualIcon} width={16} height={16} />;
                }

                break;
            }

            case EntityType.Folder: {
                const row = cell.getRow();
                image = <Icon
                    src={row.isTreeExpanded() ? Codicon.FolderOpened : Codicon.Folder}
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

    private removeDummyNode = (row: RowComponent): void => {
        const children = row.getTreeChildren();
        if (children.length > 0) {
            const firstEntry = children[0].getData() as ISchemaTreeEntry;
            if (firstEntry.caption === "loading...") {
                void children[0].delete();
            }
        }
    };

    private handleRowExpanded = (row: RowComponent): void => {
        const entry = row.getData() as ISchemaTreeEntry;
        entry.expanded = true;
        if (entry.expanded && !entry.expandedOnce) {
            entry.expandedOnce = true;

            const schema = entry.qualifiedName.schema;
            const table = entry.qualifiedName.table ?? "";
            void this.tableRef.current?.table.then((tree) => {
                switch (entry.type) {
                    case SchemaTreeType.GroupNode: {
                        switch (entry.id) {
                            case "groupNode.Tables": {
                                void this.renderTablesOrViews(schema, true, row, tree);
                                break;
                            }

                            case "groupNode.Views": {
                                void this.renderTablesOrViews(schema, false, row, tree);
                                break;
                            }

                            case "groupNode.Routines":
                            case "groupNode.Events": {
                                void this.renderSchemaObjects(schema, entry.qualifiedName.name ?? "", row, tree);
                                break;
                            }

                            case "groupNode.Triggers":
                            case "groupNode.Foreign Keys":
                            case "groupNode.Indexes":
                            case "groupNode.Columns": {
                                void this.renderTableObjects(schema, table, entry.qualifiedName.name ?? "", row, tree);
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
            });

        }
    };

    private groupNodeToSchemaTreeTypeName = (value: string): SchemaTreeType => {
        let ret = SchemaTreeType.GroupNode;
        switch (value) {
            case "groupNode.Tables":
                ret = SchemaTreeType.Table;
                break;
            case "groupNode.Views":
                ret = SchemaTreeType.View;
                break;
            case "groupNode.Routines":
                ret = SchemaTreeType.StoredProcedure;
                break;
            case "groupNode.Events":
                ret = SchemaTreeType.Event;
                break;
            case "groupNode.Triggers":
                ret = SchemaTreeType.Trigger;
                break;
            case "groupNode.Foreign Keys":
                ret = SchemaTreeType.ForeignKey;
                break;
            case "groupNode.Indexes":
                ret = SchemaTreeType.Index;
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

    private handleRowCollapsed = (row: RowComponent): void => {
        const entry = row.getData() as ISchemaTreeEntry;
        entry.expanded = false;
    };

    private isRowExpanded = (row: RowComponent): boolean => {
        const { markedSchema } = this.props;

        const entry = row.getData() as ISchemaTreeEntry;
        if (entry.id === markedSchema && !entry.expandedOnce) {
            return true;
        }

        return entry.expanded;
    };

    private handleFormatSchemaRow = (row: RowComponent): void => {
        const { markedSchema } = this.props;

        const entry = row.getData() as ISchemaTreeEntry;

        if (entry.caption === markedSchema) {
            row.getElement().classList.add("marked");
        } else {
            row.getElement().classList.remove("marked");
        }
    };

    private handleSchemaTreeRowContext = (event: Event, row: RowComponent): void => {
        const entry = row.getData() as ISchemaTreeEntry;
        this.showSchemaTreeContextMenu(entry, event as MouseEvent);
    };

    private handleSchemaTreeDoubleClick = (e: Event, cell: CellComponent): void => {
        void requisitions.execute("explorerDoubleClick", cell.getData() as ISchemaTreeEntry);
    };

    private handleAccordionItemClick = (e: MouseEvent | KeyboardEvent, props: IComponentProperties): void => {
        const { onSelectItem } = this.props;

        if (props.id) {
            const itemProps = props as IAccordionItemProperties;
            onSelectItem?.(props.id, itemProps.payload?.type as EntityType, itemProps.caption);
        }
    };

    private handleScriptItemClick = (e: UIEvent, cell: CellComponent): void => {
        const { onSelectItem } = this.props;

        const data = cell.getData() as IDBDataEntry;
        if (data.type === EntityType.Script && data.id) {
            onSelectItem?.(data.id, EntityType.Script, data.caption);
        }
    };

    private handleKeyPress = (e: KeyboardEvent, props: IComponentProperties): void => {
        if (e.key === KeyboardKeys.Enter) {
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

    private handleEditorClose = (e: MouseEvent | KeyboardEvent, itemId?: string): void => {
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
                        // Start editing after a moment, to avoid auto focus stopping an ongoing edit.
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
                //const { onAddFolder } = this.props;

                break;
            }

            default: {
                break;
            }
        }
    };

    private handleSectionExpand = (props: IAccordionProperties, sectionId: string, expanded: boolean): void => {
        const { id, onSaveExplorerState, savedState } = this.props;

        const newMap = savedState ? new Map(savedState) : new Map<string, IExplorerSectionState>();
        const sectionState = newMap.get(sectionId) ?? {};
        sectionState.expanded = expanded;

        newMap.set(sectionId, sectionState);

        onSaveExplorerState?.(id ?? "", newMap);
    };

    private handleSectionResize = (_props: IAccordionProperties, info: ISplitterPaneSizeInfo[]): void => {
        const { id, onSaveExplorerState, savedState } = this.props;

        const newMap = savedState ? new Map(savedState) : new Map<string, IExplorerSectionState>();
        info.forEach((value) => {
            const sectionState = newMap.get(value.id) ?? {};
            sectionState.size = value.currentSize;

            newMap.set(value.id, sectionState);
        });

        onSaveExplorerState?.(id ?? "", newMap);
    };

    private handleEditingDone = (): void => {
        const { onChangeItem } = this.props;
        const { editing, tempCaption } = this.state;

        if (editing && tempCaption && onChangeItem) {
            onChangeItem?.(editing, tempCaption);
        }
        this.setState({ editing: undefined, tempCaption: undefined });
    };

    private renderEditorEntries = (): ComponentChild => {
        const { editors, selectedEntry } = this.props;
        const { editing, tempCaption } = this.state;

        return editors.map((entry: IOpenEditorState) => {
            if (entry.id === editing) {
                return (
                    <Input
                        key={entry.id}
                        value={tempCaption}
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
                let icon;
                if (entry.state) {
                    const language = entry.state.model.getLanguageId() as EditorLanguage;
                    icon = documentTypeToIcon.get(language) ?? defaultIcon;
                    if (language === "msg") {
                        // The notebook icon has no color, so we have to use an icon instead of an image.
                        icon = <Icon src={icon} width="20px" height="20px" />;
                    }
                } else {
                    const name = pageTypeToIcon.get(entry.type) || defaultIcon;
                    icon = <Icon src={name} width="20px" height="20px" />;
                }

                return (
                    <Accordion.Item
                        id={entry.id}
                        key={entry.id}
                        caption={entry.caption}
                        active={entry.id === selectedEntry}
                        picture={icon}
                        closable={true}
                        payload={{ type: entry.type }}
                        onClose={this.handleEditorClose}
                        onClick={this.handleAccordionItemClick}
                        onKeyPress={this.handleKeyPress}
                    />
                );
            }
        });
    };

    private renderScriptEntries = (): ComponentChild => {
        const { scripts, selectedEntry } = this.props;

        if (scripts.length === 0) {
            return <Accordion.Item caption="<no scripts>" />;
        }

        const scriptTreeColumns: ColumnDefinition[] = [{
            title: "",
            field: "caption",
            resizable: false,
            editable: (cell: CellComponent): boolean => {
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
            treeColumn: "caption",
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

    private handleCellEdited = (cell: CellComponent): void => {
        const { onChangeItem } = this.props;
        const data = cell.getData() as IDBDataEntry;

        onChangeItem?.(data.id, cell.getValue() as string);
    };

    private handleScriptTreeRowContext = (event: Event, row: RowComponent): void => {
        const entry = row.getData() as IDBDataEntry;
        this.showScriptTreeContextMenu(entry, event as MouseEvent);
    };

    private showScriptTreeContextMenu = (rowData: IDBDataEntry, e: MouseEvent): boolean => {
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

    private handleScriptTreeContextMenuItemClick = (e: MouseEvent, props: IMenuItemProperties,
        payload: unknown): boolean => {
        const { id, onContextMenuItemClick } = this.props;

        const data = payload as IDBDataEntry;
        switch (props.id!) {
            default: {
                onContextMenuItemClick?.(id ?? "", props.id!, data);

                break;
            }
        }

        return true;
    };

    private async renderTablesOrViews(schema: string, tables: boolean, row: RowComponent,
        tree?: TabulatorProxy): Promise<void> {
        const { backend } = this.props;

        tree?.blockRedraw();
        this.removeDummyNode(row);

        try {
            const names = await backend.getSchemaObjects(schema, tables ? "Table" : "View");

            for (const table of names) {
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

                if (table) {
                    newChild.children.push(
                        this.generateGroupNode("Triggers", "Trigger", schema, table),
                        this.generateGroupNode("Foreign Keys", "Foreign Key", schema, table),
                        this.generateGroupNode("Indexes", "Index", schema, table),
                    );
                }

                row.addTreeChild(newChild);
            }
        } catch (error) {
            void requisitions.execute("showError", ["Backend Error", "Could not get column information.",
                error as string]);
        }

        row.treeExpand();
        tree?.restoreRedraw();
    }

    private renderTableObjects = async (schema: string, table: string, type: string, row: RowComponent,
        tree?: TabulatorProxy, filter?: string): Promise<void> => {
        const { backend } = this.props;

        tree?.blockRedraw();
        this.removeDummyNode(row);

        const entry = row.getData() as ISchemaTreeEntry;
        try {
            const names = await backend.getTableObjects(schema, table, type, filter);
            names.forEach((item) => {
                const newChild = {
                    type: this.groupNodeToSchemaTreeTypeName(entry.id),
                    expanded: false,
                    expandedOnce: false,
                    qualifiedName: {
                        schema,
                        table,
                        name: item,
                    },
                    id: `${schema}.${table}.${item}`,
                    caption: item,
                    details: null,
                };

                row.addTreeChild(newChild);
            });
        } catch (error) {
            void requisitions.execute("showError",
                ["Backend Error", "Could not get column information.", error as string]);
        }

        row.treeExpand();
        tree?.restoreRedraw();
    };

    private renderSchemaObjects = async (schema: string, type: string,
        row: RowComponent, tree?: TabulatorProxy, filter?: string): Promise<void> => {

        const { backend } = this.props;

        tree?.blockRedraw();
        try {
            if (type === "Routine") {
                let names = await backend.getSchemaObjects(schema, type, "function", filter);
                this.addTreeChildren(row, names, schema, SchemaTreeType.StoredFunction);
                names = await backend.getSchemaObjects(schema, type, "procedure", filter);
                this.addTreeChildren(row, names, schema, SchemaTreeType.StoredProcedure);
            } else {
                const entry = row.getData() as ISchemaTreeEntry;
                const names = await backend.getSchemaObjects(schema, type, undefined, filter);
                this.addTreeChildren(row, names, schema, this.groupNodeToSchemaTreeTypeName(entry.id));
            }
        } catch (error) {
            void requisitions.execute("showError",
                ["Backend Error", "Retrieving schema objects failed:", error as string]);
        }

        tree?.restoreRedraw();
    };

    private addTreeChildren(row: RowComponent, list: string[], schema: string, type: SchemaTreeType): void {
        this.removeDummyNode(row);
        for (const item of list) {
            const newChild = {
                type,
                expanded: false,
                expandedOnce: false,
                qualifiedName: { schema, name: item },
                id: `${schema}..${item}`,
                caption: item,
                details: null,
            };
            row.addTreeChild(newChild);
        }
        row.treeExpand();
    }

    private generateGroupNode(label: string, name: string, schema: string, table?: string): ISchemaTreeEntry {
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
                qualifiedName: { schema, table },
                id: label + "<loading>",
                caption: "loading...",
                details: null,
            }],
        };
    }

}
