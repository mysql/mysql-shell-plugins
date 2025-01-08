/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import "./DBEditorSideBar.css";

import { ComponentChild, createRef, render, type RefObject } from "preact";
import { CellComponent, ColumnDefinition, RowComponent } from "tabulator-tables";

import { ui } from "../../../app-logic/UILayer.js";
import { DbSystem, LoadBalancer } from "../../../communication/Oci.js";
import { Accordion, IAccordionProperties } from "../../../components/ui/Accordion/Accordion.js";
import type { AccordionSection } from "../../../components/ui/Accordion/AccordionSection.js";
import { Button } from "../../../components/ui/Button/Button.js";
import { Codicon } from "../../../components/ui/Codicon.js";
import {
    ComponentBase, ComponentPlacement, IComponentProperties, IComponentState, SelectionType,
} from "../../../components/ui/Component/ComponentBase.js";
import { Container, Orientation } from "../../../components/ui/Container/Container.js";
import { Icon } from "../../../components/ui/Icon/Icon.js";
import { Label } from "../../../components/ui/Label/Label.js";
import { Menu } from "../../../components/ui/Menu/Menu.js";
import { IMenuItemProperties, MenuItem } from "../../../components/ui/Menu/MenuItem.js";
import { ISplitterPaneSizeInfo } from "../../../components/ui/SplitContainer/SplitContainer.js";
import { ITreeGridOptions, SetDataAction, TreeGrid } from "../../../components/ui/TreeGrid/TreeGrid.js";
import {
    CdmEntityType, type ConnectionDataModelEntry, type ICdmConnectionEntry, type ICdmRestSchemaEntry,
} from "../../../data-models/ConnectionDataModel.js";
import {
    OciDmEntityType, type IOciDmCompartment, type IOciDmProfile, type OciDataModelEntry,
} from "../../../data-models/OciDataModel.js";
import { OdmEntityType, type OpenDocumentDataModelEntry } from "../../../data-models/OpenDocumentDataModel.js";
import {
    systemSchemas,
    type AdminPageType, type Command, type IDataModelEntryState, type ISubscriberActionType,
} from "../../../data-models/data-model-types.js";
import { BastionLifecycleState } from "../../../oci-typings/oci-bastion/lib/model/bastion-lifecycle-state.js";
import { Assets } from "../../../supplement/Assets.js";
import { appParameters, requisitions } from "../../../supplement/Requisitions.js";
import { DBType } from "../../../supplement/ShellInterface/index.js";
import { EditorLanguage } from "../../../supplement/index.js";
import { convertErrorToString } from "../../../utilities/helpers.js";
import { DBEditorModuleId } from "../../ModuleInfo.js";
import { MrsDbObjectType } from "../../mrs/types.js";
import {
    DBEditorContext, type DBEditorContextType, type IBaseTreeItem, type IConnectionTreeItem,
    type IDocumentTreeItem, type IOciTreeItem, type ISideBarCommandResult,
    type QualifiedName,
} from "../index.js";

/** Lookup for icons for a specific document type. */
export const documentTypeToFileIcon = new Map<EditorLanguage, string | Codicon>([
    ["javascript", Assets.file.javascriptIcon],
    ["mysql", Assets.file.mysqlIcon],
    ["sql", Assets.file.sqliteIcon],
    ["python", Assets.file.pythonIcon],
    ["msg", Assets.documents.notebookIcon],
    ["typescript", Assets.file.typescriptIcon],
    ["json", Codicon.Json],
]);

/** Mapping of connection data model types to icons (main types). */
const cdmTypeToEntryIcon: Map<CdmEntityType, string> = new Map([
    [CdmEntityType.Schema, Assets.db.schemaIcon],
    [CdmEntityType.Table, Assets.db.tableIcon],
    [CdmEntityType.View, Assets.db.viewIcon],
    [CdmEntityType.View, Assets.db.viewIcon],
    [CdmEntityType.StoredFunction, Assets.db.functionIcon],
    [CdmEntityType.StoredProcedure, Assets.db.procedureIcon],
    [CdmEntityType.Event, Assets.db.eventIcon],
    [CdmEntityType.Trigger, Assets.db.triggerIcon],
    [CdmEntityType.Column, Assets.db.columnIconNullable],
    [CdmEntityType.Index, Assets.db.indexIcon],
    [CdmEntityType.ForeignKey, Assets.db.foreignKeyIcon],
    [CdmEntityType.TableGroup, Assets.db.tablesIcon],
    [CdmEntityType.SchemaGroup, Assets.db.schemaIcon],
    [CdmEntityType.Admin, Assets.documents.adminDashboardIcon],
    [CdmEntityType.MrsRoot, Assets.mrs.mainIcon],
    [CdmEntityType.MrsService, Assets.mrs.serviceIcon],
    [CdmEntityType.MrsSchema, Assets.mrs.schemaIcon],
    [CdmEntityType.MrsContentSet, Assets.mrs.contentSetIcon],
    [CdmEntityType.MrsUser, Assets.oci.profileIcon],
    [CdmEntityType.MrsAuthApp, Assets.misc.shieldIcon],
    [CdmEntityType.MrsContentFile, Assets.mrs.contentFileIcon],
    [CdmEntityType.MrsDbObject, Assets.mrs.dbObjectIcon],
    [CdmEntityType.MrsRouter, Assets.router.routerIcon],
    [CdmEntityType.MrsRouterService, Assets.mrs.serviceIcon],
]);

/** Mapping of connection data model types to icons (sub types). */
const cdmSubTypeToDbObjectIcon: Map<CdmEntityType, string> = new Map([
    [CdmEntityType.Table, Assets.db.tablesIcon],
    [CdmEntityType.View, Assets.db.viewsIcon],
    [CdmEntityType.StoredFunction, Assets.db.functionsIcon],
    [CdmEntityType.StoredProcedure, Assets.db.proceduresIcon],
    [CdmEntityType.Event, Assets.db.eventsIcon],
    [CdmEntityType.Trigger, Assets.db.triggersIcon],
    [CdmEntityType.Column, Assets.db.columnsIcon],
    [CdmEntityType.Index, Assets.db.indexesIcon],
    [CdmEntityType.ForeignKey, Assets.db.foreignKeysIcon],
]);

/** Standard mapping from document types to their icons. */
const odmTypeToDocumentIcon = new Map<OdmEntityType, string>([
    [OdmEntityType.ConnectionPage, Assets.db.mysqlConnectionIcon],
    [OdmEntityType.Overview, Assets.documents.overviewPageIcon],
    [OdmEntityType.Notebook, Assets.documents.notebookIcon],
    [OdmEntityType.Script, Assets.file.javascriptIcon],
    [OdmEntityType.AdminPage, Assets.documents.adminDashboardIcon],
    [OdmEntityType.ShellSessionRoot, Assets.documents.sessionIcon],
    [OdmEntityType.ShellSession, Assets.documents.sessionIcon],
]);

/** Lookup for icons for special pages. */
export const pageTypeToDocumentIcon: Map<AdminPageType, string> = new Map([
    ["serverStatus", Assets.documents.adminServerStatusIcon],
    ["clientConnections", Assets.documents.clientConnectionsIcon],
    ["performanceDashboard", Assets.documents.adminPerformanceDashboardIcon],
    ["lakehouseNavigator", Assets.documents.lakehouseNavigatorIcon],
]);

/** Standard mapping from OCI types to their icons. */
const ociTypeToEntryIcon: Map<OciDmEntityType, string> = new Map([
    [OciDmEntityType.ConfigurationProfile, Assets.oci.profileIcon],
    [OciDmEntityType.Compartment, Assets.file.folderIcon],
    [OciDmEntityType.Bastion, Assets.oci.bastionIcon],
    [OciDmEntityType.ComputeInstance, Assets.oci.computeIcon],
    [OciDmEntityType.DbSystem, Assets.oci.dbSystemIcon],
    [OciDmEntityType.HeatWaveCluster, Assets.oci.dbSystemHWIcon],
    [OciDmEntityType.LoadBalancer, Assets.oci.loadBalancerIcon],
]);

/** Mapping MRS DB object sub types to their icons. */
const mrsDbObjectTypeToIcon: Map<MrsDbObjectType, string> = new Map([
    [MrsDbObjectType.Table, Assets.mrs.dbObjectTableIcon],
    [MrsDbObjectType.View, Assets.mrs.dbObjectViewIcon],
    [MrsDbObjectType.Procedure, Assets.mrs.dbObjectProcedureIcon],
    [MrsDbObjectType.Function, Assets.mrs.dbObjectFunctionIcon],
    //[MrsDbObjectType.Event, Assets.mrs.dbObjectEventIcon],
]);

export interface IDBEditorSideBarSectionState {
    expanded?: boolean;
    size?: number;
}

interface IDBEditorSideBarProperties extends IComponentProperties {
    /** Which document item is currently selected. */
    selectedOpenDocument: string;

    /** Which schema in the connection tree should be marked as being the current schema? */
    markedSchema: string;

    /** The state of each accordion section. */
    savedSectionState?: Map<string, IDBEditorSideBarSectionState>;

    onSelectConnectionItem?: (entry: ConnectionDataModelEntry) => Promise<void>;
    onSelectDocumentItem?: (entry: OpenDocumentDataModelEntry) => Promise<void>;
    onChangeItem?: (id: string, newCaption: string) => void;
    onSaveState?: (state: Map<string, IDBEditorSideBarSectionState>) => void;
    onConnectionTreeCommand: (command: Command, entry?: ConnectionDataModelEntry,
        qualifiedName?: QualifiedName) => Promise<ISideBarCommandResult>;
    onDocumentTreeCommand: (command: Command, entry: OpenDocumentDataModelEntry) => Promise<ISideBarCommandResult>;
    onOciTreeCommand: (command: Command, entry: OciDataModelEntry) => Promise<ISideBarCommandResult>;
}

/**
 * Properties that are available in all data model entries. Used only for refresh methods that work for all
 * data trees the same way.
 */
interface IDataModelBaseEntry {
    id: string;
    caption: string,
    state: IDataModelEntryState;

    refresh?: () => Promise<unknown>;
    getChildren?(): IDataModelBaseEntry[];
}

/** The type of the function that generates new tree items. */
type TreeItemGenerator<T extends IDataModelBaseEntry> = (entry: T) => IBaseTreeItem<T>;

interface ISideBarTreeItems {
    openDocumentTreeItems: IDocumentTreeItem[];
    connectionTreeItems: IConnectionTreeItem[];
    ociTreeItems: IOciTreeItem[];
}

interface IDBEditorSideBarState extends IComponentState {
    treeItems: ISideBarTreeItems;

    editing?: string;     // If editing an editor's caption is active then this field holds its id.
    tempCaption?: string; // Keeps the new caption of an editor while it is being edited.

    showSystemSchemas: boolean;
}

export class DBEditorSideBar extends ComponentBase<IDBEditorSideBarProperties, IDBEditorSideBarState> {
    public static override contextType = DBEditorContext;

    #cdmTypeToMenuRefMap = new Map<CdmEntityType, RefObject<Menu>>([
        [CdmEntityType.Connection, createRef<Menu>()],
        [CdmEntityType.Schema, createRef<Menu>()],
        [CdmEntityType.Table, createRef<Menu>()],
        [CdmEntityType.Column, createRef<Menu>()],
        [CdmEntityType.View, createRef<Menu>()],
        [CdmEntityType.Trigger, createRef<Menu>()],
        [CdmEntityType.Index, createRef<Menu>()],
        [CdmEntityType.ForeignKey, createRef<Menu>()],
        [CdmEntityType.Event, createRef<Menu>()],
        [CdmEntityType.StoredProcedure, createRef<Menu>()],
        [CdmEntityType.StoredFunction, createRef<Menu>()],
        [CdmEntityType.MrsRoot, createRef<Menu>()],
        [CdmEntityType.MrsService, createRef<Menu>()],
        [CdmEntityType.MrsSchema, createRef<Menu>()],
        [CdmEntityType.MrsAuthApp, createRef<Menu>()],
        [CdmEntityType.MrsRouter, createRef<Menu>()],
        [CdmEntityType.MrsUser, createRef<Menu>()],
        [CdmEntityType.MrsDbObject, createRef<Menu>()],
    ]);

    #odmTypeToMenuRefMap = new Map<OdmEntityType, RefObject<Menu>>([
        [OdmEntityType.ConnectionPage, createRef<Menu>()],
        [OdmEntityType.Overview, createRef<Menu>()],
        [OdmEntityType.Notebook, createRef<Menu>()],
        [OdmEntityType.Script, createRef<Menu>()],
        [OdmEntityType.AdminPage, createRef<Menu>()],
        [OdmEntityType.ShellSession, createRef<Menu>()],
    ]);

    #ociTypeToMenuRefMap = new Map<OciDmEntityType, RefObject<Menu>>([
        [OciDmEntityType.ConfigurationProfile, createRef<Menu>()],
        [OciDmEntityType.Compartment, createRef<Menu>()],
        [OciDmEntityType.Bastion, createRef<Menu>()],
        [OciDmEntityType.ComputeInstance, createRef<Menu>()],
        [OciDmEntityType.DbSystem, createRef<Menu>()],
        [OciDmEntityType.HeatWaveCluster, createRef<Menu>()],
        [OciDmEntityType.LoadBalancer, createRef<Menu>()],
    ]);

    #documentTableRef = createRef<TreeGrid>();
    #connectionTableRef = createRef<TreeGrid>();
    #ociTableRef = createRef<TreeGrid>();

    #connectionSectionRef = createRef<AccordionSection>();
    #ociSectionRef = createRef<AccordionSection>();

    public constructor(props: IDBEditorSideBarProperties) {
        super(props);

        this.state = {
            treeItems: {
                openDocumentTreeItems: [],
                connectionTreeItems: [],
                ociTreeItems: [],
            },
            showSystemSchemas: false,
        };

        this.addHandledProperties("selectedEntry", "markedSchema", "savedSectionState", "onSelectConnectionItem",
            "onSelectDocumentItem", "onSelectScriptItem", "onChangeItem", "onSaveState", "onConnectionTreeCommand",
            "onDocumentTreeCommand", "onScriptTreeCommand", "onOciTreeCommand");
    }

    public override componentDidMount(): void {
        requisitions.register("refreshConnection", this.refreshConnection);

        // Create the initial tree items.
        const context = this.context as DBEditorContextType;
        if (context) {
            context.connectionsDataModel.subscribe(this.connectionDataModelChanged);
            context.documentDataModel.subscribe(this.documentDataModelChanged);

            const [treeItems, changed] = this.updateRootTreeItems(context);
            if (changed) {
                this.setState({ treeItems });
            }
        }
    }

    public override componentWillUnmount(): void {
        const context = this.context as DBEditorContextType;
        if (context) {
            context.connectionsDataModel.unsubscribe(this.connectionDataModelChanged);
            context.documentDataModel.unsubscribe(this.documentDataModelChanged);
        }

        requisitions.unregister("refreshConnection", this.refreshConnection);
    }

    public override componentDidUpdate(prevProps: IDBEditorSideBarProperties): void {
        const { markedSchema, selectedOpenDocument } = this.props;

        // Check for data model changes and update our trees.
        this.updateTreesFromContext();

        if (this.#connectionTableRef.current) {
            if (markedSchema !== prevProps.markedSchema) {
                let rows = this.#connectionTableRef.current.searchAllRows("caption", markedSchema);
                rows.forEach((row) => {
                    row.reformat();
                });

                rows = this.#connectionTableRef.current.searchAllRows("caption", prevProps.markedSchema);
                rows.forEach((row) => {
                    row.reformat();
                });
            }
        }

        if (prevProps.selectedOpenDocument !== selectedOpenDocument) {
            const { treeItems } = this.state;

            this.#documentTableRef.current?.deselectRow();
            if (selectedOpenDocument && selectedOpenDocument !== "connections") {
                const rows = this.#documentTableRef.current?.searchAllRows("id", selectedOpenDocument);
                rows?.forEach((row) => {
                    row.select();
                });
            } else {
                // No selection or the overview was given, so select the overview.
                const item = treeItems.openDocumentTreeItems[0];
                const rows = this.#documentTableRef.current?.searchAllRows("id", item.id);
                rows?.forEach((row) => {
                    row.select();
                });
            }
        }
    }

    public render(): ComponentChild {
        const { savedSectionState } = this.props;
        const { editing } = this.state;

        const context = this.context as DBEditorContextType;
        if (!context) {
            return null;
        }

        const documentSectionState = savedSectionState?.get("documentSection") ?? {};
        const connectionSectionState = savedSectionState?.get("connectionSection") ?? {};
        const ociSectionState = savedSectionState?.get("ociSection") ?? {};
        //const shellTaskSectionState = savedSectionState?.get("shellTasksSection") ?? {};

        const title = appParameters.embedded ? "MYSQL SHELL GUI" : "MYSQL SHELL WORKBENCH";

        return (
            <>
                <Accordion
                    id="dbEditorSideBar"
                    caption={title}
                    sections={[
                        {
                            id: "documentSection",
                            caption: "OPEN EDITORS",
                            stretch: false,
                            minSize: 70,
                            maxSize: 400,
                            resizable: true,
                            expanded: documentSectionState.expanded,
                            initialSize: documentSectionState.size,
                            dimmed: editing != null,
                            actions: [
                                {
                                    icon: Codicon.NewFile,
                                    command: {
                                        command: "addConsole",
                                        tooltip: "Add new console",
                                        title: "Add new console",
                                    },
                                },
                            ],
                            content: this.renderDocumentsTree(context.documentDataModel.roots),
                        },
                        {
                            ref: this.#connectionSectionRef,
                            id: "connectionSection",
                            caption: "DATABASE CONNECTIONS",
                            stretch: true,
                            expanded: connectionSectionState.expanded,
                            initialSize: connectionSectionState.size ?? 500,
                            resizable: true,
                            minSize: 100,
                            actions: [{
                                icon: Codicon.Add,
                                command: {
                                    command: "msg.addConnection",
                                    tooltip: "Create New DB Connection",
                                    title: "Create New DB Connection",
                                },
                            }, {
                                icon: Codicon.Refresh,
                                command: {
                                    command: "msg.refreshConnections",
                                    tooltip: "Refresh the Connection List",
                                    title: "Refresh the Connection List",
                                },
                            }, {
                                icon: Codicon.CollapseAll,
                                command: {
                                    command: "msg.collapseAll",
                                    tooltip: "Collapse All",
                                    title: "Collapse All",
                                },
                            }, {
                                icon: Codicon.KebabVertical,
                                tooltip: "More Actions",
                                choices: [
                                    {
                                        icon: Codicon.Bug,
                                        command: {
                                            command: "msg.fileBugReport",
                                            title: "File Bug Report",
                                        },
                                    },
                                ],
                            }],
                            content: this.renderConnectionsTree(context.connectionsDataModel.connections),
                        },
                        {
                            ref: this.#ociSectionRef,
                            id: "ociSection",
                            caption: "ORACLE CLOUD INFRASTRUCTURE",
                            stretch: true,
                            expanded: ociSectionState.expanded,
                            initialSize: ociSectionState.size,
                            resizable: true,
                            minSize: 100,
                            content: this.renderOciTree(context.ociDataModel.profiles),
                            actions: [{
                                icon: Codicon.Gear,
                                command: {
                                    command: "msg.mds.configureOciProfiles",
                                    tooltip: "Configure the OCI Profile list",
                                    title: "Configure the OCI Profile list",
                                },
                            },
                            {
                                icon: Codicon.Refresh,
                                command: {
                                    command: "msg.mds.refreshOciProfiles",
                                    tooltip: "Reload the OCI Profile list",
                                    title: "Reload the OCI Profile list",
                                },
                            }],
                        },
                        /*{
                            id: "shellTasksSection",
                            caption: "MYSQL SHELL TASKS",
                            stretch: true,
                            expanded: shellTaskSectionState.expanded ?? false,
                            initialSize: shellTaskSectionState.size,
                            resizable: true,
                            minSize: 100,
                            content: this.renderShellTasksTree(),
                        },*/
                    ]}

                    onSectionAction={this.handleSectionAction}
                    onSectionExpand={this.handleSectionExpand}
                    onSectionResize={this.handleSectionResize}

                    {...this.unhandledProperties}
                />
                {this.renderConnectionTreeContextMenus()}
                {this.renderMrsTreeContextMenus()}
                {this.renderDocumentTreeContextMenus()}
                {this.renderOciTreeContextMenus()}
            </>
        );
    }

    private renderConnectionTreeContextMenus(): ComponentChild {
        return (
            <>
                <Menu
                    id="connectionContextMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.Connection)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleConnectionTreeContextMenuItemClick}
                    isItemDisabled={this.isConnectionMenuItemDisabled}
                >
                    <MenuItem command={{ title: "Open New Database Connection", command: "msg.openConnection" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Edit DB Connection", command: "msg.editConnection" }} />
                    <MenuItem command={{ title: "Duplicate this DB Connection", command: "msg.duplicateConnection" }} />
                    <MenuItem command={{ title: "Delete DB Connection...", command: "msg.removeConnection" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        id="showSystemSchemas"
                        command={{
                            title: "Show MySQL System Schemas", command: "msg.showSystemSchemasOnConnection",
                        }}
                        altCommand={{
                            title: "Hide MySQL System Schemas", command: "msg.hideSystemSchemasOnConnection",
                        }}
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Load SQL Script from Disk...", command: "msg.loadScriptFromDisk" }} />
                    <MenuItem command={{ title: "Load Dump from Disk...", command: "msg.loadDumpFromDisk" }} disabled />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{
                            title: "Open New MySQL Shell Console for this Connection",
                            command: "msg.newSessionUsingConnection",
                        }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Browse the MySQL REST Service Documentation", command: "msg.mrs.docs" }}
                    />
                    <MenuItem
                        command={{
                            title: "Configure Instance for MySQL REST Service Support",
                            command: "msg.mrs.configureMySQLRestService",
                        }}
                    />
                </Menu>

                <Menu
                    id="schemaContextMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.Schema)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleConnectionTreeContextMenuItemClick}
                >
                    <MenuItem
                        command={{ title: "Set As Current Database Schema", command: "setCurrentSchemaMenuItem" }}
                    />
                    <MenuItem command={{ title: "Filter to this Schema", command: "filterMenuItem" }} disabled />
                    <MenuItem command={{ title: "Show Schema Inspector", command: "inspectorMenuItem" }} disabled />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Dump Schema To Disk..", command: "msg.dumpSchemaToDisk" }} disabled />
                    <MenuItem
                        command={{
                            title: "Dump Schema to Disk for MySQL Database Service...",
                            command: "msg.dumpSchemaToDiskForMds",
                        }}
                        disabled
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Copy to Clipboard", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToClipboard" }} />
                        <MenuItem
                            command={{ title: "Create Statement", command: "msg.copyCreateStatementToClipboard" }}
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "Send to SQL Editor", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToEditor" }} />
                        <MenuItem command={{ title: "Create Statement", command: "msg.copyCreateStatementToEditor" }} />
                    </MenuItem >
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Load Data to HeatWave Cluster...", command: "msg.mds.loadToHeatWave" }}
                        disabled />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Add Schema to REST Service...", command: "msg.mrs.addSchema" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Create Schema...", command: "msg.createSchema" }} disabled />
                    <MenuItem command={{ title: "Alter Schema...", command: "msg.alterSchema" }} disabled />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Drop Schema...", command: "msg.dropSchema" }} disabled />
                </Menu >

                <Menu
                    id="tableContextMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.Table)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleConnectionTreeContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Select Rows", command: "msg.selectRows" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Copy to Clipboard", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToClipboard" }} />
                        <MenuItem
                            command={{ title: "Create Statement", command: "msg.copyCreateStatementToClipboard" }}
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "Send to SQL Editor", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToEditor" }} />
                        <MenuItem command={{ title: "Create Statement", command: "msg.copyCreateStatementToEditor" }} />
                    </MenuItem >
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Add Database Object to REST Service...", command: "msg.mrs.addDbObject" }}
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Create Table...", command: "msg.createTable" }} disabled />
                    <MenuItem command={{ title: "Alter Table...", command: "msg.alterTable" }} disabled />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Drop Table...", command: "msg.dropTable" }} disabled />
                    <MenuItem command={{ title: "Truncate Table...", command: "msg.truncateTable" }} disabled />
                </Menu >

                <Menu
                    id="columnContextMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.Column)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleConnectionTreeContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Select Rows", command: "msg.selectRows" }} />
                    <MenuItem command={{ title: "Copy to Clipboard", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToClipboard" }} />
                        <MenuItem
                            command={{ title: "Insert Statement", command: "clipboardInsertStatementMenuItem" }}
                            disabled
                        />
                        <MenuItem
                            command={{ title: "Update Statement", command: "clipboardUpdateStatementMenuItem" }}
                            disabled
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "Send to SQL Editor", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToEditor" }} disabled />
                        <MenuItem
                            command={{ title: "Insert Statement", command: "editorInsertStatementMenuItem" }}
                            disabled
                        />
                        <MenuItem
                            command={{ title: "Update Statement", command: "editorUpdateStatementMenuItem" }}
                            disabled
                        />
                    </MenuItem >
                </Menu >

                <Menu
                    id="viewContextMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.View)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleConnectionTreeContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Select Rows", command: "msg.selectRows" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Copy to Clipboard", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToClipboard" }} />
                        <MenuItem
                            command={{ title: "Create Statement", command: "msg.copyCreateStatementToClipboard" }}
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "Send to SQL Editor", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToEditor" }} />
                        <MenuItem command={{ title: "Create Statement", command: "msg.copyCreateStatementToEditor" }} />
                    </MenuItem >
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Add Database Object to REST Service...", command: "msg.mrs.addDbObject" }}
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Create View ...", command: "msg.createProcedure" }} disabled />
                    <MenuItem command={{ title: "Alter View ...", command: "alterViewMenuItem" }} disabled />
                    <MenuItem command={{ title: "Drop View ...", command: "dropViewMenuItem" }} disabled />
                </Menu >

                <Menu
                    id="eventContextMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.Event)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleConnectionTreeContextMenuItemClick}
                >
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Copy to Clipboard", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToClipboard" }} />
                        <MenuItem
                            command={{ title: "Create Statement", command: "msg.copyCreateStatementToClipboard" }}
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "Send to SQL Editor", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToEditor" }} />
                        <MenuItem command={{ title: "Create Statement", command: "msg.copyCreateStatementToEditor" }} />
                    </MenuItem >
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Create Event ...", command: "msg.createEvent" }} disabled />
                    <MenuItem command={{ title: "Alter Event ...", command: "msg.alterEvent" }} disabled />
                    <MenuItem command={{ title: "Drop Event ...", command: "msg.dropEvent" }} disabled />
                </Menu >

                <Menu
                    id="procedureContextMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.StoredProcedure)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleConnectionTreeContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Copy to Clipboard", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToClipboard" }} disabled />
                        <MenuItem
                            command={{ title: "Create Statement", command: "msg.copyCreateStatementToClipboard" }}
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "Send to SQL Editor", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToEditor" }} />
                        <MenuItem command={{ title: "Create Statement", command: "msg.copyCreateStatementToEditor" }} />
                    </MenuItem >
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Add Database Object to REST Service...", command: "msg.mrs.addDbObject" }}
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Create Procedure ...", command: "msg.createProcedure" }} disabled />
                    <MenuItem command={{ title: "Alter Procedure ...", command: "alterViewMenuItem" }} disabled />
                    <MenuItem command={{ title: "Drop Procedure ...", command: "dropViewMenuItem" }} disabled />
                </Menu >

                <Menu
                    id="functionContextMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.StoredFunction)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleConnectionTreeContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Copy to Clipboard", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToClipboard" }} disabled />
                        <MenuItem
                            command={{ title: "Create Statement", command: "msg.copyCreateStatementToClipboard" }}
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "Send to SQL Editor", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToEditor" }} />
                        <MenuItem command={{ title: "Create Statement", command: "msg.copyCreateStatementToEditor" }} />
                    </MenuItem >
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Add Database Object to REST Service...", command: "msg.mrs.addDbObject" }}
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Create Function ...", command: "msg.createFunction" }} disabled />
                    <MenuItem command={{ title: "Alter Function ...", command: "msg.alterFunction" }} disabled />
                    <MenuItem command={{ title: "Drop Function ...", command: "msg.dropFunction" }} disabled />
                </Menu >

                <Menu
                    id="indexContextMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.Index)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleConnectionTreeContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Copy to Clipboard", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToClipboard" }} />
                        <MenuItem
                            command={{ title: "Create Statement", command: "msg.copyCreateStatementToClipboard" }}
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "Send to SQL Editor", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToEditor" }} />
                        <MenuItem command={{ title: "Create Statement", command: "msg.copyCreateStatementToEditor" }} />
                    </MenuItem >
                </Menu >

                <Menu
                    id="triggerContextMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.Trigger)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleConnectionTreeContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Copy to Clipboard", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToClipboard" }} />
                        <MenuItem
                            command={{ title: "Create Statement", command: "msg.copyCreateStatementToClipboard" }}
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "Send to SQL Editor", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToEditor" }} />
                        <MenuItem command={{ title: "Create Statement", command: "msg.copyCreateStatementToEditor" }} />
                    </MenuItem >
                </Menu>

                <Menu
                    id="fkContextMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.ForeignKey)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleConnectionTreeContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Copy to Clipboard", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToClipboard" }} />
                        <MenuItem
                            command={{ title: "Create Statement", command: "msg.copyCreateStatementToClipboard" }}
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "Send to SQL Editor", command: "" }} >
                        <MenuItem command={{ title: "Name", command: "msg.copyNameToEditor" }} />
                        <MenuItem command={{ title: "Create Statement", command: "msg.copyCreateStatementToEditor" }} />
                    </MenuItem >
                </Menu>
            </>
        );
    }

    private renderMrsTreeContextMenus(): ComponentChild {
        return (
            <>
                <Menu
                    id="mrsRootContextMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.MrsRoot)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Add REST Service...", command: "msg.mrs.addService" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Enable MySQL REST Service", command: "msg.mrs.enableMySQLRestService" }}
                    />
                    <MenuItem
                        command={{ title: "Disable MySQL REST Service", command: "msg.mrs.disableMySQLRestService" }}
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{
                            title: "Bootstrap Local MySQL Router Instance", command: "msg.mrs.bootstrapLocalRouter",
                        }}
                        disabled
                    />
                    <MenuItem
                        command={{ title: "Start Local MySQL Router Instance", command: "msg.mrs.startLocalRouter" }}
                        disabled
                    />
                    <MenuItem
                        command={{ title: "Stop Local MySQL Router Instance", command: "msg.mrs.stopLocalRouter" }}
                        disabled
                    />
                    <MenuItem
                        command={{ title: "Kill Local MySQL Router Instances", command: "msg.mrs.killLocalRouters" }}
                        disabled
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Browse the MySQL REST Service Documentation", command: "msg.mrs.docs" }}
                    />
                </Menu>

                <Menu
                    id="mrsServiceMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.MrsService)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Edit REST Service...", command: "msg.mrs.editService" }} />
                    <MenuItem
                        command={{ title: "Set as Current REST Service", command: "msg.mrs.setCurrentService" }}
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{
                            title: "Load REST Schema From JSON File...",
                            command: "msg.mrs.loadSchemaFromJSONFile",
                        }}
                        disabled
                    />
                    <MenuItem
                        command={{ title: "Export REST Service SDK Files...", command: "msg.mrs.exportServiceSdk" }}
                        disabled
                    />
                    <MenuItem
                        command={{
                            title: "Export CREATE REST SERVICE Statement...",
                            command: "msg.mrs.exportCreateServiceSql",
                        }}
                        disabled
                    />
                    <MenuItem
                        command={{
                            title: "Copy CREATE REST SERVICE Statement...",
                            command: "msg.mrs.copyCreateServiceSql",
                        }}
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Add New Authentication App", command: "msg.mrs.addAuthApp" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Delete REST Service...", command: "msg.mrs.deleteService" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "MRS Service Documentation", command: "msg.mrs.docs.service" }} />
                </Menu>

                <Menu
                    id="mrsRouterMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.MrsRouter)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Delete Router...", command: "msg.mrs.deleteRouter" }} />
                </Menu>

                <Menu
                    id="mrsSchemaMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.MrsSchema)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Edit REST Schema...", command: "msg.mrs.editSchema" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Dump REST Schema To JSON File...", command: "msg.mrs.dumpSchemaToJSONFile" }}
                        disabled
                    />
                    <MenuItem
                        command={{
                            title: "Load REST Schema From JSON File...",
                            command: "msg.mrs.loadSchemaFromJSONFile",
                        }}
                        disabled
                    />
                    <MenuItem
                        command={{ title: "Dump REST Schema SQL...", command: "msg.mrs.dumpCreateSchemaSql" }}
                        disabled
                    />
                    <MenuItem
                        command={{
                            title: "Export CREATE REST SCHEMA Statement...",
                            command: "msg.mrs.exportCreateSchemaSql",
                        }}
                        disabled
                    />
                    <MenuItem
                        command={{
                            title: "Copy CREATE REST SCHEMA Statement",
                            command: "msg.mrs.copyCreateSchemaSql",
                        }}
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Delete REST Schema...", command: "msg.mrs.deleteSchema" }} />
                </Menu>

                <Menu
                    id="mrsAuthAppMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.MrsAuthApp)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Edit Auth App...", command: "msg.mrs.editAuthApp" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Add User...", command: "msg.mrs.addUser" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Delete Auth App...", command: "msg.mrs.deleteAuthApp" }} />
                </Menu>

                <Menu
                    id="mrsUserMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.MrsUser)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Edit User...", command: "msg.mrs.editUser" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Delete User...", command: "msg.mrs.deleteUser" }} />
                </Menu>

                <Menu
                    id="mrsDbObjectMenu"
                    ref={this.#cdmTypeToMenuRefMap.get(CdmEntityType.MrsDbObject)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Edit REST Object...", command: "msg.mrs.editDbObject" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{
                            title: "Copy REST Object Request Path to Clipboard",
                            command: "msg.mrs.copyDbObjectRequestPath",
                        }}
                    />
                    <MenuItem
                        command={{
                            title: "Open REST Object Request Path in Web Browser",
                            command: "msg.mrs.openDbObjectRequestPath",
                        }}
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Dump REST Object To JSON File...", command: "msg.mrs.dumpObjectToJSONFile" }}
                        disabled
                    />
                    <MenuItem
                        command={{
                            title: "Export CREATE REST OBJECT Statement...",
                            command: "msg.mrs.exportCreateDbObjectSql",
                        }}
                        disabled
                    />
                    <MenuItem
                        command={{
                            title: "Copy CREATE REST OBJECT Statement...",
                            command: "msg.mrs.copyCreateDbObjectSql",
                        }}
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Delete REST Object...", command: "msg.mrs.deleteDbObject" }} />
                </Menu>
            </>
        );
    }

    private renderDocumentTreeContextMenus(): ComponentChild {
        return (
            <>
                <Menu
                    id="pageContextMenu"
                    ref={this.#odmTypeToMenuRefMap.get(OdmEntityType.ConnectionPage)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleDocumentTreeContextMenuItemClick}
                    customCommand={this.handleDocumentTreeContextMenuCustomCommand}
                    isItemDisabled={this.isDocumentMenuItemDisabled}
                >
                    <MenuItem command={{ title: "New SQL Script", command: "msg.addScript" }} />
                    <MenuItem command={{ title: "New JavaScript Script", command: "msg.newScriptJs" }} />
                    <MenuItem command={{ title: "New TypeScript Script", command: "msg.newScriptTs" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Load SQL Script from Disk", command: "msg.loadScriptFromDisk" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{
                        title: "Open New MySQL Shell Console for this Connection",
                        command: "msg.newSessionUsingConnection",
                    }}
                    />
                </Menu >
            </>
        );
    }

    private renderOciTreeContextMenus(): ComponentChild {
        return (
            <>
                <Menu
                    id="ociProfileMenu"
                    ref={this.#ociTypeToMenuRefMap.get(OciDmEntityType.ConfigurationProfile)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleOciContextMenuItemClick}
                >
                    <MenuItem command={{
                        title: "View Config Profile Information",
                        command: "msg.mds.getProfileInfo",
                    }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{
                        title: "Set as New Default Config Profile",
                        command: "msg.mds.setDefaultProfile",
                    }} />
                </Menu>

                <Menu
                    id="ociCompartmentMenu"
                    ref={this.#ociTypeToMenuRefMap.get(OciDmEntityType.Compartment)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleOciContextMenuItemClick}
                >
                    <MenuItem command={{
                        title: "View Compartment Information",
                        command: "msg.mds.getCompartmentInfo",
                    }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{
                        title: "Set as Current Compartment",
                        command: "msg.mds.setCurrentCompartment",
                    }} />
                </Menu>

                <Menu
                    id="ociDbSystemMenu"
                    ref={this.#ociTypeToMenuRefMap.get(OciDmEntityType.DbSystem)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleOciContextMenuItemClick}
                >
                    <MenuItem command={{
                        title: "View DB System Information",
                        command: "msg.mds.getDbSystemInfo",
                    }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{
                        title: "Create Connection with Bastion Service",
                        command: "msg.mds.createConnectionViaBastionService",
                    }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Start the DB System", command: "msg.mds.startDbSystem" }}
                        disabled
                    />
                    <MenuItem
                        command={{ title: "Restart the DB System", command: "msg.mds.restartDbSystem" }}
                        disabled
                    />
                    <MenuItem
                        command={{ title: "Stop the DB System", command: "msg.mds.stopDbSystem" }}
                        disabled
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Delete the DB System", command: "msg.mds.deleteDbSystem" }}
                        disabled
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{
                            title: "Create MySQL Router Endpoint on new Compute Instance",
                            command: "msg.mds.createRouterEndpoint",
                        }}
                        disabled
                    />
                </Menu>

                <Menu
                    id="ociComputeInstanceMenu"
                    ref={this.#ociTypeToMenuRefMap.get(OciDmEntityType.ComputeInstance)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleOciContextMenuItemClick}
                >
                    <MenuItem command={{
                        title: "View Compute Instance Information",
                        command: "msg.mds.getComputeInstance",
                    }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Open SSH Bastion Session", command: "msg.mds.openBastionSshSession" }}
                        disabled
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Delete Compute Instance", command: "msg.mds.deleteComputeInstance" }}
                        disabled
                    />
                </Menu>

                <Menu
                    id="HeatWaveClusterMenu"
                    ref={this.#ociTypeToMenuRefMap.get(OciDmEntityType.HeatWaveCluster)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleOciContextMenuItemClick}
                >
                    <MenuItem
                        command={{ title: "Start the HeatWave Cluster", command: "msg.mds.startHWCluster" }}
                        disabled
                    />
                    <MenuItem
                        command={{ title: "Stop the HeatWave Cluster", command: "msg.mds.stopHWCluster" }}
                        disabled
                    />
                    <MenuItem
                        command={{ title: "Restart the HeatWave Cluster", command: "msg.mds.restartHWCluster" }}
                        disabled
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Rescale the HeatWave Cluster", command: "msg.mds.rescaleHWCluster" }}
                        disabled
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Delete the HeatWave Cluster", command: "msg.mds.deleteHWCluster" }}
                        disabled
                    />
                </Menu>

                <Menu
                    id="ociBastionMenu"
                    ref={this.#ociTypeToMenuRefMap.get(OciDmEntityType.Bastion)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleOciContextMenuItemClick}
                >
                    <MenuItem command={{
                        title: "Get Bastion Information",
                        command: "msg.mds.getBastion",
                    }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Set as Current Bastion", command: "msg.mds.setCurrentBastion" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{ title: "Delete Bastion", command: "msg.mds.deleteBastion" }}
                        disabled
                    />
                    <MenuItem
                        command={{
                            title: "Refresh When Bastion Reaches Active State",
                            command: "msg.mds.refreshOnBastionActiveState",
                        }}
                        disabled
                    />
                </Menu>
            </>
        );
    }

    private showConnectionTreeContextMenu = (rowData: IConnectionTreeItem, e: MouseEvent): boolean => {
        const targetRect = new DOMRect(e.clientX, e.clientY, 2, 2);

        this.#cdmTypeToMenuRefMap.get(rowData.dataModelEntry.type)?.current?.open(targetRect, false, {}, rowData);

        return true;
    };

    private showOpenDocumentTreeContextMenu = (rowData: IDocumentTreeItem, e: MouseEvent): boolean => {
        const targetRect = new DOMRect(e.clientX, e.clientY, 2, 2);

        this.#odmTypeToMenuRefMap.get(rowData.dataModelEntry.type)?.current?.open(targetRect, false, {}, rowData);

        return true;
    };

    private showOciTreeContextMenu = (rowData: IOciTreeItem, e: MouseEvent): boolean => {
        const targetRect = new DOMRect(e.clientX, e.clientY, 2, 2);

        this.#ociTypeToMenuRefMap.get(rowData.dataModelEntry.type)?.current?.open(targetRect, false, {}, rowData);

        return true;
    };

    /**
     * Determines if the given menu item should be disabled.
     *
     * @param item The item to check.
     * @param payload The current payload of the containing menu.
     *
     * @returns `true` if the item should be disabled, `false` otherwise.
     */
    private isConnectionMenuItemDisabled = (item: IMenuItemProperties, payload: unknown): boolean => {
        if (payload && item.id === "showSystemSchemas") {
            const entry = payload as IConnectionTreeItem;

            return entry.dataModelEntry.connection.details.dbType !== DBType.MySQL;
        }

        return item.disabled ?? false;
    };

    private connectionTreeCellFormatter = (cell: CellComponent): string | HTMLElement => {
        const data = cell.getData() as IConnectionTreeItem;

        let iconName = cdmTypeToEntryIcon.get(data.dataModelEntry.type) ?? Assets.file.defaultIcon;

        let overlayImage;
        let overlayImageMask;

        let subCaption;

        switch (data.dataModelEntry.type) {
            case CdmEntityType.Connection: {
                if (data.dataModelEntry.details.dbType === DBType.MySQL) {
                    iconName = Assets.db.mysqlConnectionIcon;
                } else if (data.dataModelEntry.details.dbType === DBType.Sqlite) {
                    iconName = Assets.db.sqliteConnectionIcon;
                }

                break;
            }

            case CdmEntityType.Schema: {
                const { markedSchema } = this.props;

                const isMysql = data.dataModelEntry.connection.details.dbType === DBType.MySQL;
                if (data.dataModelEntry.caption === markedSchema) {
                    if (isMysql) {
                        iconName = Assets.db.mysqlSchemaCurrentIcon;
                    } else {
                        iconName = Assets.db.sqliteSchemaCurrentIcon;
                    }
                } else {
                    if (isMysql) {
                        iconName = Assets.db.mysqlSchemaIcon;
                    } else {
                        iconName = Assets.db.sqliteSchemaIcon;
                    }
                }

                break;
            }

            case CdmEntityType.TableGroup:
            case CdmEntityType.SchemaGroup: {
                iconName = cdmSubTypeToDbObjectIcon.get(data.dataModelEntry.subType) ?? Assets.file.defaultIcon;

                break;
            }

            case CdmEntityType.Column: {
                if (data.dataModelEntry.inPK) {
                    iconName = Assets.db.columnIconPK;
                } else if (data.dataModelEntry.nullable) {
                    iconName = Assets.db.columnIconNullable;
                } else {
                    iconName = Assets.db.columnIconNotNull;
                }
                break;
            }

            case CdmEntityType.AdminPage: {
                iconName = pageTypeToDocumentIcon.get(data.dataModelEntry.pageType) ?? Assets.file.defaultIcon;

                break;
            }

            case CdmEntityType.MrsRoot: {
                if (!data.dataModelEntry.serviceEnabled) {
                    overlayImage = Assets.overlay.statusDotRed;
                }

                break;
            }

            case CdmEntityType.MrsDbObject: {
                const type = data.dataModelEntry.details.objectType;
                iconName = mrsDbObjectTypeToIcon.get(type) ?? Assets.file.defaultIcon;
                if (data.dataModelEntry.details.enabled === 0) {
                    overlayImage = Assets.overlay.statusDotRed;
                    overlayImageMask = Assets.overlay.statusDotMask;
                } else if (data.dataModelEntry.details.enabled === 2) {
                    overlayImage = Assets.overlay.private;
                    overlayImageMask = Assets.overlay.statusDotMask;
                } else if (data.dataModelEntry.details.requiresAuth === 1) {
                    overlayImage = Assets.overlay.lock;
                    overlayImageMask = Assets.overlay.lockMask;
                }

                break;
            }

            case CdmEntityType.MrsSchema:
            case CdmEntityType.MrsContentFile:
            case CdmEntityType.MrsContentSet: {
                if (data.dataModelEntry.details.requiresAuth) {
                    overlayImage = Assets.overlay.lock;
                    overlayImageMask = Assets.overlay.lockMask;
                } else if (!data.dataModelEntry.details.enabled) {
                    overlayImage = Assets.overlay.statusDotRed;
                    overlayImageMask = Assets.overlay.statusDotMask;
                }

                break;
            }

            case CdmEntityType.MrsService: {
                iconName = data.dataModelEntry.details.isCurrent
                    ? Assets.mrs.serviceDefaultIcon
                    : Assets.mrs.serviceIcon;

                if (!data.dataModelEntry.details.enabled) {
                    overlayImage = Assets.overlay.disabled;
                    overlayImageMask = Assets.overlay.disabledMask;
                } else if (data.dataModelEntry.details.inDevelopment) {
                    overlayImage = Assets.overlay.inDevelopment;
                    overlayImageMask = Assets.overlay.inDevelopmentMask;
                } else if (data.dataModelEntry.details.published) {
                    overlayImage = Assets.overlay.live;
                    overlayImageMask = Assets.overlay.liveMask;
                }

                break;
            }

            case CdmEntityType.MrsAuthApp: {
                if (!data.dataModelEntry.details.enabled) {
                    overlayImage = Assets.overlay.statusDotRed;
                    overlayImageMask = Assets.overlay.statusDotMask;
                }

                break;
            }

            case CdmEntityType.MrsRouter: {
                if (data.dataModelEntry.requiresUpgrade) {
                    overlayImage = Assets.overlay.statusDotRed;
                    overlayImageMask = Assets.overlay.statusDotMask;
                } else if (!data.dataModelEntry.details.active) {
                    overlayImage = Assets.overlay.statusDotOrange;
                    overlayImageMask = Assets.overlay.statusDotMask;
                }

                break;
            }

            case CdmEntityType.StoredFunction: {
                // TODO: change icon from standard to the particular language.
                break;
            }

            case CdmEntityType.StoredProcedure: {
                // TODO: change icon from standard to the particular language.
                break;
            }

            default:
        }

        const host = document.createElement("div");
        host.className = "connectionTreeEntry sidebarTreeEntry";

        let actionBox;

        switch (data.dataModelEntry.type) {
            case CdmEntityType.Connection: {
                const connection = data.dataModelEntry;
                const playButton = <Button
                    className="actionButton"
                    data-tooltip="Open New Database Connection on New Tab"
                    imageOnly
                    onClick={() => {
                        void requisitions.execute("showPage",
                            { module: DBEditorModuleId, page: String(connection.details.id) });
                    }}
                >
                    <Icon src={Codicon.Play} data-tooltip="inherit" />
                </Button>;

                const refreshButton = <Button
                    className="actionButton"
                    data-tooltip="Refresh Connection"
                    imageOnly
                    onClick={() => {
                        void this.refreshConnectionTreeEntryChildren(data.dataModelEntry, true);
                    }}
                >
                    <Icon src={Codicon.Refresh} data-tooltip="inherit" />
                </Button>;

                actionBox = <Container className="actionBox" orientation={Orientation.LeftToRight}>
                    {playButton}
                    {refreshButton}
                </Container>;

                break;
            }

            case CdmEntityType.MrsService: {
                const { onConnectionTreeCommand } = this.props;

                const value = data.dataModelEntry.details;
                const developers = value.inDevelopment?.developers?.join(",");

                let text;
                if (developers) {
                    text = `In Development [${developers}]`;
                } else {
                    text = !value.enabled ? "Disabled" : (value.published ? "Published" : "Unpublished");
                }
                subCaption = <Label id="subCaption" caption={text} />;

                const docButton = <Button
                    className="actionButton"
                    data-tooltip="MRS Service Documentation"
                    imageOnly
                    onClick={() => {
                        void onConnectionTreeCommand({ title: "", command: "msg.mrs.docs.service" },
                            data.dataModelEntry);
                    }}
                ><Icon src={Assets.misc.docsIcon} data-tooltip="inherit" /></Button>;

                actionBox = <Container className="actionBox" orientation={Orientation.LeftToRight}>
                    {docButton}
                </Container>;

                break;
            }

            case CdmEntityType.MrsRouter: {
                break;
            }

            default:
        }

        const dimClass = overlayImage === Assets.overlay.private ? "dim" : "";
        const content = <>
            <Icon
                src={iconName}
                overlay={overlayImage}
                overlayMask={overlayImageMask}
                className={dimClass}
            />
            <Label id="mainCaption" caption={data.caption} />
            {subCaption}
            {actionBox}
        </>;

        render(content, host);

        return host;
    };

    private documentTreeCellFormatter = (cell: CellComponent): string | HTMLElement => {
        const data = cell.getData() as IDocumentTreeItem;

        let actionBox;
        let iconName: string | Codicon = odmTypeToDocumentIcon.get(data.dataModelEntry.type) ?? Assets.file.defaultIcon;
        switch (data.dataModelEntry.type) {
            case OdmEntityType.ConnectionPage: {
                const page = data.dataModelEntry;
                const isMySQL = page.details.dbType === DBType.MySQL;
                if (isMySQL) {
                    iconName = Assets.db.mysqlConnectionIcon;
                } else if (page.details.dbType === DBType.Sqlite) {
                    iconName = Assets.db.sqliteConnectionIcon;
                }

                const newScriptButton = <Button
                    className="actionButton"
                    data-tooltip={isMySQL ? "New MySQL Script" : "New Sqlite Script"}
                    imageOnly
                    onClick={() => {
                        this.handleDocumentTreeContextMenuItemClick({ command: "msg.addScript", title: "" }, false,
                            data.dataModelEntry);
                    }}
                >
                    <Icon src={Assets.misc.newScriptIcon} data-tooltip="inherit" />
                </Button>;

                const loadScriptButton = <Button
                    className="actionButton"
                    data-tooltip="Load SQL Script from Disk..."
                    imageOnly
                    onClick={() => {
                        this.handleDocumentTreeContextMenuItemClick({ command: "msg.loadScriptFromDisk", title: "" },
                            false, data.dataModelEntry);
                    }}
                >
                    <Icon src={Assets.toolbar.loadScriptIcon} data-tooltip="inherit" />
                </Button>;

                actionBox = <Container className="actionBox" orientation={Orientation.LeftToRight}>
                    {newScriptButton}
                    {loadScriptButton}
                </Container>;

                break;
            }

            case OdmEntityType.AdminPage: {
                const pageEntry = data.dataModelEntry;
                iconName = pageTypeToDocumentIcon.get(pageEntry.pageType) ?? Assets.file.defaultIcon;

                const closeButton = <Button
                    className="actionButton"
                    data-tooltip="Close Document"
                    imageOnly
                    onClick={() => {
                        void requisitions.execute("closeDocument",
                            { connectionId: pageEntry.parent!.details.id, documentId: data.dataModelEntry.id });
                    }}
                >
                    <Icon src={Codicon.Close} data-tooltip="inherit" />
                </Button>;

                actionBox = <Container className="actionBox" orientation={Orientation.LeftToRight}>
                    {closeButton}
                </Container>;

                break;
            }

            case OdmEntityType.Script: {
                const pageEntry = data.dataModelEntry;
                const language = pageEntry.language;
                iconName = documentTypeToFileIcon.get(language) ?? iconName;

                break;
            }

            case OdmEntityType.Notebook: {
                break;
            }

            case OdmEntityType.StandaloneDocument: {
                const document = data.dataModelEntry;
                if (document.language) {
                    iconName = documentTypeToFileIcon.get(document.language) ?? iconName;
                } else {
                    iconName = Codicon.Json;
                }

                break;
            }

            default:
        }

        switch (data.dataModelEntry.type) {
            case OdmEntityType.Notebook:
            case OdmEntityType.Script:
            case OdmEntityType.AdminPage:
            case OdmEntityType.StandaloneDocument:
            case OdmEntityType.ShellSession: {
                const pageEntry = data.dataModelEntry;
                const closeButton = <Button
                    className="actionButton"
                    data-tooltip="Close Document"
                    imageOnly
                    onClick={() => {
                        if (pageEntry.parent && pageEntry.parent.type === OdmEntityType.ConnectionPage) {
                            void requisitions.execute("closeDocument",
                                { connectionId: pageEntry.parent.details.id, documentId: data.dataModelEntry.id });
                        } else {
                            void requisitions.execute("closeDocument", { documentId: data.dataModelEntry.id });
                        }
                    }}
                >
                    <Icon src={Codicon.Close} data-tooltip="inherit" />
                </Button>;

                actionBox = <Container className="actionBox" orientation={Orientation.LeftToRight}>
                    {closeButton}
                </Container>;

                break;
            }

            default:
        }

        const host = document.createElement("div");
        host.className = "documentTreeEntry sidebarTreeEntry";
        const content = <>
            {iconName && <Icon src={iconName} />}
            <Label caption={data.caption} />
            {actionBox}
        </>;

        render(content, host);

        return host;
    };

    private handleConnectionTreeRowSelected = (row: RowComponent): void => {
        const { onSelectConnectionItem } = this.props;

        const entry = row.getData() as IConnectionTreeItem;

        void onSelectConnectionItem?.(entry.dataModelEntry);
    };

    private handleConnectionTreeRowExpanded = (row: RowComponent): void => {
        const entry = row.getData() as IConnectionTreeItem;
        entry.dataModelEntry.state.expanded = true;
        if (!entry.dataModelEntry.state.isLeaf && !entry.dataModelEntry.state.expandedOnce) {
            entry.dataModelEntry.state.expandedOnce = true;
            void this.refreshConnectionTreeEntryChildren(entry.dataModelEntry, true);
        }
    };

    private handleConnectionTreeRowCollapsed = (row: RowComponent): void => {
        const entry = row.getData() as IConnectionTreeItem;
        entry.dataModelEntry.state.expanded = false;
    };

    private isConnectionTreeRowExpanded = (row: RowComponent): boolean => {
        const { markedSchema } = this.props;

        const entry = row.getData() as IConnectionTreeItem;
        const dataModelEntry = entry.dataModelEntry;
        if (dataModelEntry.type === CdmEntityType.Schema && entry.qualifiedName.name === markedSchema
            && !entry.dataModelEntry.state.isLeaf && !entry.dataModelEntry.state.expandedOnce) {
            setTimeout(() => {
                row.treeExpand();
            }, 100);

            return true;
        }

        return entry.dataModelEntry.state.expanded;
    };

    private handleConnectionTreeRowContext = (event: Event, row: RowComponent): void => {
        const entry = row.getData() as IConnectionTreeItem;
        this.showConnectionTreeContextMenu(entry, event as MouseEvent);
    };

    private handleConnectionTreeDoubleClick = (e: Event, cell: CellComponent): void => {
        const item = cell.getData() as IConnectionTreeItem;

        void requisitions.execute("connectionItemDefaultAction", item.dataModelEntry);
    };

    private handleDocumentTreeRowSelected = (row: RowComponent): void => {
        const { onSelectDocumentItem } = this.props;

        const entry = row.getData() as IDocumentTreeItem;

        void onSelectDocumentItem?.(entry.dataModelEntry);
    };

    private handleDocumentTreeRowExpanded = (row: RowComponent): void => {
        const documentEntry = row.getData() as IDocumentTreeItem;
        if (!documentEntry.dataModelEntry.state.isLeaf) {
            documentEntry.dataModelEntry.state.expanded = true;
            if (!documentEntry.dataModelEntry.state.expandedOnce) {
                documentEntry.dataModelEntry.state.expandedOnce = true;
                void this.refreshDocumentTreeEntryChildren(documentEntry.dataModelEntry);
            }
        }
    };

    private handleDocumentTreeRowCollapsed = (row: RowComponent): void => {
        const entry = row.getData() as IDocumentTreeItem;
        entry.dataModelEntry.state.expanded = false;
    };

    private isDocumentTreeRowExpanded = (row: RowComponent): boolean => {
        const entry = row.getData() as IDocumentTreeItem;

        // Auto expand document tree items.
        if (!entry.dataModelEntry.state.isLeaf && !entry.dataModelEntry.state.expandedOnce) {
            this.handleDocumentTreeRowExpanded(row);

            // If this row represents a connection page, select its first child (a notebook).
            if (entry.dataModelEntry.type === OdmEntityType.ConnectionPage) {
                const firstChild = row.getTreeChildren()[0];
                if (firstChild) {
                    const { onSelectDocumentItem } = this.props;

                    const childEntry = firstChild.getData() as IDocumentTreeItem;
                    void onSelectDocumentItem?.(childEntry.dataModelEntry);
                }
            }
        }

        return entry.dataModelEntry.state.expanded;
    };

    private handleDocumentTreeRowContext = (event: Event, row: RowComponent): void => {
        const entry = row.getData() as IDocumentTreeItem;
        this.showOpenDocumentTreeContextMenu(entry, event as MouseEvent);

    };

    private handleOciTreeRowExpanded = (row: RowComponent): void => {
        const ociEntry = row.getData() as IOciTreeItem;
        if (ociEntry.dataModelEntry.state.isLeaf) {
            return;
        }

        ociEntry.dataModelEntry.state.expanded = true;
        if (!ociEntry.dataModelEntry.state.expandedOnce) {
            ociEntry.dataModelEntry.state.expandedOnce = true;

            /**
             * Helper to add a list of DM entries to the given row.
             *
             * @param entries The entries to add.
             * @param hasChildren Whether the entries can have children.
             */
            const addEntries = <T extends OciDataModelEntry>(entries: T[], hasChildren: (entry: T) => boolean) => {
                const children = entries.map((entry) => {
                    const child: IOciTreeItem = {
                        id: entry.id,
                        dataModelEntry: entry,
                        caption: entry.caption,
                        children: hasChildren(entry) ? [] : undefined,
                    };

                    return child;
                });

                children.forEach((child) => {
                    row.addTreeChild(child);
                });
            };

            // If initializing takes longer that the timer runs, show a progress indicator.
            const timer = setTimeout(() => {
                this.#ociSectionRef.current!.showProgress = true;
            }, 200);

            row.getTable().blockRedraw();

            ociEntry.dataModelEntry.refresh?.().then(() => {
                clearTimeout(timer);
                this.#ociSectionRef.current!.showProgress = false;

                switch (ociEntry.dataModelEntry.type) {
                    case OciDmEntityType.ConfigurationProfile: {
                        const profile = ociEntry.dataModelEntry;
                        addEntries(profile.compartments, () => { return true; });

                        break;
                    }

                    case OciDmEntityType.Compartment: {
                        const compartment = ociEntry.dataModelEntry;
                        addEntries(compartment.compartments, () => { return true; });
                        addEntries(compartment.dbSystems, (entry) => { return entry.cluster !== undefined; });
                        addEntries(compartment.heatWaveClusters, () => { return true; });
                        addEntries(compartment.computeInstances, () => { return false; });
                        addEntries(compartment.bastions, () => { return false; });
                        addEntries(compartment.loadBalancers, () => { return false; });

                        break;
                    }

                    case OciDmEntityType.DbSystem: {
                        const dbSystem = ociEntry.dataModelEntry;
                        if (dbSystem.cluster) {
                            addEntries([dbSystem.cluster], () => { return false; });
                        }

                        break;
                    }

                    default:
                }

                // Attention: don't move these calls outside of the promise or they will kick in too early.
                row.getTable().restoreRedraw();
            }).catch((error) => {
                clearTimeout(timer);
                this.#ociSectionRef.current!.showProgress = false;

                void ui.showErrorNotification(convertErrorToString(error));

                row.getTable().restoreRedraw();
            });
        }
    };

    private handleOciTreeRowCollapsed = (row: RowComponent): void => {
        const entry = row.getData() as IOciTreeItem;
        entry.dataModelEntry.state.expanded = false;
    };

    private isOciTreeRowExpanded = (row: RowComponent): boolean => {
        const entry = row.getData() as IOciTreeItem;

        return entry.dataModelEntry.state.expanded;
    };

    private handleOciTreeRowContext = (event: Event, row: RowComponent): void => {
        const entry = row.getData() as IOciTreeItem;
        this.showOciTreeContextMenu(entry, event as MouseEvent);
    };

    private ociTreeCellFormatter = (cell: CellComponent): string | HTMLElement => {
        const data = cell.getData() as IOciTreeItem;

        let overlayImage;
        let overlayImageMask;

        let image = ociTypeToEntryIcon.get(data.dataModelEntry.type) ?? Assets.file.defaultIcon;
        switch (data.dataModelEntry.type) {
            case OciDmEntityType.ConfigurationProfile: {
                if (data.dataModelEntry.profileData.isCurrent) {
                    image = Assets.oci.profileCurrentIcon;
                } else {
                    image = Assets.oci.profileIcon;
                }

                break;
            }
            case OciDmEntityType.Compartment: {
                if (data.dataModelEntry.compartmentDetails.isCurrent) {
                    image = Assets.file.folderCurrentIcon;
                } else {
                    image = Assets.file.folderIcon;
                }

                break;
            }

            case OciDmEntityType.Bastion: {
                const summary = data.dataModelEntry.summary;
                if (summary.isCurrent) {
                    image = Assets.oci.bastionCurrentIcon;
                } else {
                    image = Assets.oci.bastionIcon;
                }

                if (summary.lifecycleState !== BastionLifecycleState.Active) {
                    overlayImage = Assets.overlay.statusDotOrange;
                    overlayImageMask = Assets.overlay.statusDotMask;
                }

                break;
            }

            case OciDmEntityType.DbSystem: {
                const details = data.dataModelEntry.details;
                overlayImage = Assets.overlay.statusDotOrange; // Assume it's not active.
                overlayImageMask = Assets.overlay.statusDotMask;

                if (data.dataModelEntry.cluster) {
                    image = Assets.oci.dbSystemHWIcon;
                    if (details.lifecycleDetails === DbSystem.LifecycleState.Active) {
                        overlayImage = undefined; // Reset overlay, we have an active node.
                    } else if (details.lifecycleState === DbSystem.LifecycleState.Inactive ||
                        details.lifecycleState === DbSystem.LifecycleState.Failed) {
                        overlayImage = Assets.overlay.statusDotRed;
                    }
                } else {
                    image = Assets.oci.dbSystemIcon;
                    if (details.lifecycleState === DbSystem.LifecycleState.Active) {
                        overlayImage = undefined;
                    } else if (details.lifecycleState === DbSystem.LifecycleState.Inactive ||
                        details.lifecycleState === DbSystem.LifecycleState.Failed) {
                        overlayImage = Assets.overlay.statusDotRed;
                    }
                }

                break;
            }

            case OciDmEntityType.HeatWaveCluster: { // Sub item of a cluster DB system node.
                const details = data.dataModelEntry.parent.details;
                image = Assets.oci.computeIcon;
                overlayImage = Assets.overlay.statusDotOrange; // Assume it's not active.
                overlayImageMask = Assets.overlay.statusDotMask;

                if (details.heatWaveCluster) {
                    // Side note: there's no enum defined for the HW cluster lifecycle state.
                    if (details.heatWaveCluster.lifecycleState === "ACTIVE") {
                        overlayImage = undefined;
                    } else if (details.heatWaveCluster.lifecycleState === "INACTIVE" ||
                        details.heatWaveCluster.lifecycleState === "FAILED") {
                        overlayImage = Assets.overlay.statusDotRed;
                    }
                }

                break;
            }

            case OciDmEntityType.LoadBalancer: {
                image = Assets.oci.loadBalancerIcon;
                const details = data.dataModelEntry.details;

                if (details.lifecycleState !== LoadBalancer.LifecycleState.Active) {
                    overlayImage = Assets.overlay.statusDotOrange;
                    overlayImageMask = Assets.overlay.statusDotMask;
                }

                break;
            }

            default: {
                break;
            }
        }

        const host = document.createElement("div");
        host.className = "ociTreeEntry sidebarTreeEntry";
        const content = <>
            <Icon
                src={image}
                overlay={overlayImage}
                overlayMask={overlayImageMask}
            />
            <Label caption={data.caption} />
        </>;

        render(content, host);

        return host;
    };

    private handleSectionAction = (command?: Command): void => {
        const { onConnectionTreeCommand } = this.props;

        switch (command?.command) {
            case "msg.refreshConnections": {
                void onConnectionTreeCommand?.(command).then((success) => {
                    if (success) {
                        this.updateTreesFromContext();
                    }
                });

                break;
            }

            case "msg.collapseAll": {
                this.collapseAllConnectionTreeTopLevelItems();

                break;
            }

            case "msg.mds.configureOciProfiles": {
                void ui.showWarningNotification("Not implemented yet.");
                break;
            }

            case "msg.mds.refreshOciProfiles": {
                const context = this.context as DBEditorContextType;
                void context.ociDataModel.updateProfiles().then(() => {
                    this.updateTreesFromContext();
                });

                break;
            }

            default: {
                if (command) {
                    void onConnectionTreeCommand?.(command);
                }
            }
        }
    };

    private handleSectionExpand = (props: IAccordionProperties, sectionId: string, expanded: boolean): void => {
        const { onSaveState, savedSectionState = new Map<string, IDBEditorSideBarSectionState>() } = this.props;

        const sectionState = savedSectionState?.get(sectionId) ?? {};
        sectionState.expanded = expanded;

        savedSectionState.set(sectionId, sectionState);

        onSaveState?.(savedSectionState);
    };

    private handleSectionResize = (_props: IAccordionProperties, info: ISplitterPaneSizeInfo[]): void => {
        const { onSaveState, savedSectionState } = this.props;

        const newMap = savedSectionState ? new Map(savedSectionState) : new Map<string, IDBEditorSideBarSectionState>();
        info.forEach((value) => {
            const sectionState = newMap.get(value.id) ?? {};
            sectionState.size = value.currentSize;

            newMap.set(value.id, sectionState);
        });

        onSaveState?.(newMap);
    };

    /**
     * Called from the context menu of the open document tree or by an action button.
     *
     * @param propsOrCommand Either the properties of the menu item that was clicked, or the command to execute.
     * @param altActive Whether the alt key was active when the menu item was clicked.
     * @param payload The tree item that was clicked or the data model entry of the document to act on.
     *
     * @returns `true` if the command was handled, `false` otherwise.
     */
    private handleDocumentTreeContextMenuItemClick = (propsOrCommand: IMenuItemProperties | Command, altActive: boolean,
        payload: unknown): boolean => {
        const { onDocumentTreeCommand } = this.props;

        let command: Command;
        let dataModelEntry: OpenDocumentDataModelEntry;
        if (propsOrCommand.title !== undefined) {
            command = propsOrCommand as Command;
            dataModelEntry = payload as OpenDocumentDataModelEntry;
        } else {
            const p = propsOrCommand as IMenuItemProperties;
            command = p.command && altActive && p.altCommand ? p.altCommand : p.command;
            const data = payload as IDocumentTreeItem;
            dataModelEntry = data.dataModelEntry;
        }

        switch (command.command) {
            case "msg.hideSystemSchemasOnConnection": {
                this.setState({ showSystemSchemas: false }, () => {
                    void this.refreshDocumentTreeEntryChildren(dataModelEntry);
                });

                break;
            }

            default: {
                void onDocumentTreeCommand(command, dataModelEntry);
            }
        }

        return true;
    };

    /**
     * Update the actual caption of certain menu items, depending on the connection type.
     *
     * @param props The properties of the menu item to customize the command for.
     * @param payload The tree item that was clicked.
     *
     * @returns The updated command, or `undefined` if the command should not be customized.
     */
    private handleDocumentTreeContextMenuCustomCommand = (props: IMenuItemProperties,
        payload: unknown): Command | undefined => {
        const data = payload as IDocumentTreeItem;

        switch (data?.dataModelEntry?.type) {
            case OdmEntityType.ConnectionPage: {
                if (props.command.command === "msg.addScript") {
                    const isMySQL = data.dataModelEntry.details.dbType === DBType.MySQL;

                    return {
                        ...props.command,
                        title: isMySQL ? "New MySQL Script" : "New Sqlite Script",
                    };
                }

                break;
            }

            default:
        }

        return undefined;
    };

    /**
     * Determines if the given menu item should be disabled.
     *
     * @param props The properties of the menu item to check.
     * @param payload The current payload of the containing menu.
     *
     * @returns `true` if the item should be disabled, `false` otherwise.
     */
    private isDocumentMenuItemDisabled = (props: IMenuItemProperties, payload: unknown): boolean => {
        if (payload) {
            if (props.command.command === "msg.newSessionUsingConnection") {
                const entry = payload as IDocumentTreeItem;
                if (entry.dataModelEntry.type === OdmEntityType.ConnectionPage) {
                    return entry.dataModelEntry.details.dbType !== DBType.MySQL;
                }
            }
        }

        return props.disabled ?? false;
    };

    private handleConnectionTreeContextMenuItemClick = (props: IMenuItemProperties, altActive: boolean,
        payload: unknown): boolean => {
        const { onConnectionTreeCommand } = this.props;

        const data = payload as IConnectionTreeItem;
        const command = altActive && props.altCommand ? props.altCommand : props.command;

        switch (command.command) {
            case "msg.mrs.configureMySQLRestService": {
                void onConnectionTreeCommand?.(command, data.dataModelEntry).then(() => {
                    void this.refreshConnectionTreeEntryChildren(data.dataModelEntry, true);
                });

                break;
            }

            case "msg.hideSystemSchemasOnConnection": {
                this.setState({ showSystemSchemas: false }, () => {
                    void this.refreshConnectionTreeEntryChildren(data.dataModelEntry, true);
                });

                break;
            }

            case "msg.showSystemSchemasOnConnection": {
                this.setState({ showSystemSchemas: true }, () => {
                    void this.refreshConnectionTreeEntryChildren(data.dataModelEntry, true);
                });

                break;
            }

            case "msg.dropSchema": {
                void onConnectionTreeCommand?.(command, data.dataModelEntry).then((result) => {
                    if (result.success) {
                        void this.refreshConnectionParentEntry(data, true);
                    }
                });

                break;
            }

            case "msg.mrs.addSchema": {
                void onConnectionTreeCommand?.(command, data.dataModelEntry).then((result) => {
                    if (result.success) {
                        // Find the MRS service entry to refresh its tree node.
                        const mrsRoot = data.dataModelEntry.connection.mrsEntry;
                        const service = mrsRoot?.services.find((s) => {
                            return s.details.id === result.mrsServiceId;
                        });

                        if (service) {
                            void this.refreshConnectionTreeEntryChildren(service, true);
                        } else if (mrsRoot) {
                            void this.refreshConnectionTreeEntryChildren(mrsRoot, true);
                        }
                    }
                });

                break;
            }

            case "msg.mrs.addDbObject": {
                void onConnectionTreeCommand?.(command, data.dataModelEntry).then((result) => {
                    if (result.success && result.mrsServiceId && result.mrsSchemaId) {
                        // Find the service and the schema in that, where the new object was added.
                        const mrsRoot = data.dataModelEntry.connection.mrsEntry;
                        const service = mrsRoot?.services.find((s) => {
                            return s.details.id === result.mrsServiceId;
                        });
                        const schema = service?.schemas.find((s) => {
                            return s.details.id === result.mrsSchemaId;
                        });

                        if (schema) {
                            void this.refreshConnectionTreeEntryChildren(schema, true);
                        } else if (mrsRoot) {
                            void this.refreshConnectionTreeEntryChildren(mrsRoot, true);
                        }
                    }
                });

                break;
            }

            default: {
                void onConnectionTreeCommand?.(command, data.dataModelEntry, data.qualifiedName);
            }
        }

        return true;
    };

    private handleMrsContextMenuItemClick = (props: IMenuItemProperties, altActive: boolean,
        payload: unknown): boolean => {

        const { onConnectionTreeCommand } = this.props;

        const entry = payload as IConnectionTreeItem;
        const command = altActive && props.altCommand ? props.altCommand : props.command;

        const tree = this.#connectionTableRef.current;

        try {
            switch (command.command) {
                case "msg.mrs.addService":
                case "msg.mrs.addAuthApp": {
                    void onConnectionTreeCommand(command, entry.dataModelEntry).then(() => {
                        void this.refreshConnectionTreeEntryChildren(entry.dataModelEntry, true);
                    });

                    break;
                }

                case "msg.mrs.enableMySQLRestService":
                case "msg.mrs.disableMySQLRestService":
                case "msg.mrs.editService": {
                    // Forward the command to the editor module, but also update the tree entry.
                    void onConnectionTreeCommand(command, entry.dataModelEntry).then((done) => {
                        if (done) {
                            void this.refreshTreeEntry(tree, entry.dataModelEntry, true);
                        }
                    });

                    break;
                }

                case "msg.mrs.setCurrentService":
                case "msg.mrs.deleteService":
                case "msg.mrs.deleteSchema":
                case "msg.mrs.deleteDbObject":
                case "msg.mrs.editDbObject":
                case "msg.mrs.deleteUser": {
                    void onConnectionTreeCommand(command, entry.dataModelEntry).then((done) => {
                        if (done) {
                            void this.refreshConnectionParentEntry(entry, true);
                        }
                    });
                    break;
                }

                case "msg.mrs.editSchema": {
                    const mrsSchema = entry.dataModelEntry as ICdmRestSchemaEntry;
                    void onConnectionTreeCommand(command, mrsSchema).then((done) => {
                        if (done) {
                            // If the schema moved from one MRS service to another,
                            // refresh the parent of the old service.
                            if (mrsSchema.details.serviceId !== mrsSchema.parent.details.id) {
                                const mrsRoot = mrsSchema.parent.parent;
                                let service = mrsRoot?.services.find((s) => {
                                    return s.details.id === mrsSchema.details.serviceId;
                                });

                                if (service) {
                                    void this.refreshConnectionTreeEntryChildren(service, true);
                                }

                                service = mrsRoot?.services.find((s) => {
                                    return s.details.id === mrsSchema.parent.details.id;
                                });

                                if (service) {
                                    void this.refreshConnectionTreeEntryChildren(service, true);
                                }
                            } else {
                                // Otherwise just update the schema entry.
                                void this.refreshTreeEntry(tree, entry.dataModelEntry, true);
                            }
                        }
                    });

                    break;
                }

                case "msg.mrs.editAuthApp":
                case "msg.mrs.editUser": {
                    void onConnectionTreeCommand(command, entry.dataModelEntry).then((done) => {
                        if (done) {
                            void this.refreshTreeEntry(tree, entry.dataModelEntry, true);
                        }
                    });

                    break;
                }

                case "msg.mrs.deleteAuthApp": {
                    void onConnectionTreeCommand(command, entry.dataModelEntry).then((done) => {
                        if (done) {
                            void this.refreshConnectionParentEntry(entry, true);
                        }
                    });

                    break;
                }

                case "msg.mrs.addUser": {
                    void onConnectionTreeCommand(command, entry.dataModelEntry).then((done) => {
                        if (done) {
                            void this.refreshConnectionTreeEntryChildren(entry.dataModelEntry, true);
                        }
                    });

                    break;
                }

                default: {
                    void onConnectionTreeCommand(command, entry.dataModelEntry);
                }
            }
        } catch (error) {
            const message = convertErrorToString(error);
            void ui.showErrorNotification(`Error while running command: ${command.command}. ${message}`);
        }

        return true;
    };

    private handleOciContextMenuItemClick = (props: IMenuItemProperties, altActive: boolean,
        payload: unknown): boolean => {

        const { onOciTreeCommand } = this.props;

        const entry = payload as IOciTreeItem;
        const command = altActive && props.altCommand ? props.altCommand : props.command;

        try {
            switch (command.command) {
                case "msg.mds.setDefaultProfile": {
                    void onOciTreeCommand(command, entry.dataModelEntry).then((done) => {
                        if (done) {
                            const context = this.context as DBEditorContextType;
                            void context.ociDataModel.updateProfiles().then(() => {
                                this.updateTreesFromContext();
                            });
                        }
                    });

                    break;
                }

                case "msg.mds.setCurrentCompartment": {
                    void onOciTreeCommand(command, entry.dataModelEntry).then((done) => {
                        if (done) {
                            // Setting a different compartment to current will affect the profile node
                            // under which the compartment is listed.
                            const compartment = entry.dataModelEntry as IOciDmCompartment;

                            // Walk up the compartment chain to find the profile node.
                            let parent = compartment.parent;
                            while (parent && parent.type !== OciDmEntityType.ConfigurationProfile) {
                                parent = parent.parent;
                            }
                            void this.refreshOciTreeEntryChildren(parent);
                        }
                    });
                    break;
                }

                case "msg.mds.setCurrentBastion": {
                    void onOciTreeCommand(command, entry.dataModelEntry).then((done) => {
                        if (done) {
                            void this.refreshOciParentEntry(entry);
                        }
                    });

                    break;
                }

                default: {
                    void onOciTreeCommand(command, entry.dataModelEntry);
                }
            }
        } catch (error) {
            const message = convertErrorToString(error);
            void ui.showErrorNotification(`Error while running command: ${command.command}. ${message}`);
        }

        return true;
    };

    /**
     * Triggered when one or all connections need to be refreshed.
     *
     * @param connection The connection to refresh. If not provided, all connections are refreshed.
     *
     * @returns A promise that resolves to `true`.
     */
    private refreshConnection = async (connection?: ICdmConnectionEntry): Promise<boolean> => {
        if (connection) {
            await this.refreshConnectionTreeEntryChildren(connection, true);
        } else {
            this.updateTreesFromContext();
        }

        return Promise.resolve(true);
    };

    /**
     * Creates a list of entries for the connection tree.
     *
     * @param connections The connections to create the entries for.
     *
     * @returns The list of entries.
     */
    private renderConnectionsTree(connections: ICdmConnectionEntry[]): ComponentChild {
        const connectionTreeColumns: ColumnDefinition[] = [{
            title: "",
            field: "caption",
            resizable: false,
            hozAlign: "left",
            formatter: this.connectionTreeCellFormatter,
            cellDblClick: this.handleConnectionTreeDoubleClick,
        }];

        const connectionTreeOptions: ITreeGridOptions = {
            treeColumn: "caption",
            selectionType: SelectionType.Single,
            showHeader: false,
            layout: "fitColumns",
        };

        const connectionSectionContent = connections.length === 0
            ? <Accordion.Item caption="<no connections>" />
            : <TreeGrid
                ref={this.#connectionTableRef}
                options={connectionTreeOptions}
                columns={connectionTreeColumns}

                onRowSelected={this.handleConnectionTreeRowSelected}
                onRowExpanded={this.handleConnectionTreeRowExpanded}
                onRowCollapsed={this.handleConnectionTreeRowCollapsed}
                isRowExpanded={this.isConnectionTreeRowExpanded}
                onRowContext={this.handleConnectionTreeRowContext} />;

        return connectionSectionContent;
    }

    private connectionDataModelChanged = (
        list: Readonly<Array<ISubscriberActionType<ConnectionDataModelEntry>>>): void => {

        const tree = this.#connectionTableRef.current;
        list.forEach((action) => {
            switch (action.action) {
                case "add": {
                    if (action.entry) {
                        void this.refreshConnectionTreeEntryChildren(action.entry, false);
                    }

                    break;
                }

                case "remove": {
                    if (action.entry?.type === CdmEntityType.Connection) {
                        const context = this.context as DBEditorContextType;
                        if (context) {
                            // Remove the connection from the backend.
                            void context.connectionsDataModel.dropItem(action.entry);
                        }

                        requisitions.executeRemote("connectionRemoved", action.entry.details);
                    }

                    // Finally, refresh our UI.
                    const entry = action.entry as ConnectionDataModelEntry;
                    if ("parent" in entry && entry.parent) {
                        void this.refreshConnectionTreeEntryChildren(entry.parent, false);
                    }

                    break;
                }

                case "update": {
                    if (action.entry) {
                        switch (action.entry.type) {
                            case CdmEntityType.Connection: {
                                void this.refreshConnectionTreeEntryChildren(action.entry, false);

                                break;
                            }

                            case CdmEntityType.MrsRoot: {
                                void this.refreshConnectionTreeEntryChildren(action.entry, false);

                                break;
                            }

                            default: {
                                void this.refreshTreeEntry(tree, action.entry, false);
                            }
                        }

                    }

                    break;
                }

                case "clear": {
                    // TODO: implement this.
                    break;
                }

                default:
            }
        });

        this.forceUpdate();
    };

    private documentDataModelChanged = (
        list: Readonly<Array<ISubscriberActionType<OpenDocumentDataModelEntry>>>): void => {

        list.forEach((action) => {
            switch (action.action) {
                case "add":
                case "remove": {
                    const entry = action.entry as OpenDocumentDataModelEntry;

                    if (entry.type === OdmEntityType.ShellSession) {
                        this.updateTreesFromContext();
                    }

                    if ("parent" in entry && entry.parent) {
                        void this.refreshDocumentTreeEntryChildren(entry.parent as OpenDocumentDataModelEntry)
                            .then((result) => {
                                if (!result) {
                                    // The tree entry could not be updated because it was not found in the tree.
                                    // Schedule another refresh.
                                    setTimeout(() => {
                                        void this.refreshDocumentTreeEntryChildren(
                                            entry.parent as OpenDocumentDataModelEntry);
                                    });
                                }
                            });
                    }

                    break;
                }

                case "update": {
                    if (action.entry) {
                        void this.refreshDocumentTreeEntryChildren(action.entry);
                    }

                    break;
                }

                case "clear": {
                    // TODO: implement this.
                    break;
                }

                default:
            }
        });
    };

    private renderDocumentsTree = (documents: OpenDocumentDataModelEntry[]): ComponentChild => {
        const { selectedOpenDocument } = this.props;

        const documentTreeColumns: ColumnDefinition[] = [{
            title: "",
            field: "caption",
            resizable: false,
            hozAlign: "left",
            formatter: this.documentTreeCellFormatter,
        }];

        const documentTreeOptions: ITreeGridOptions = {
            treeColumn: "caption",
            selectionType: SelectionType.Single,
            showHeader: false,
            layout: "fitColumns",
        };

        const documentSectionContent = documents.length === 0
            ? <Accordion.Item caption="<no documents>" />
            : <TreeGrid
                ref={this.#documentTableRef}
                options={documentTreeOptions}
                columns={documentTreeColumns}
                selectedRows={[selectedOpenDocument]}

                onRowSelected={this.handleDocumentTreeRowSelected}
                onRowExpanded={this.handleDocumentTreeRowExpanded}
                onRowCollapsed={this.handleDocumentTreeRowCollapsed}
                isRowExpanded={this.isDocumentTreeRowExpanded}
                onRowContext={this.handleDocumentTreeRowContext}
            />;

        return documentSectionContent;
    };

    /*private renderShellTasksTree = (): ComponentChild => {
        return <Accordion.Item caption="<no tasks>" />;
    };*/

    private renderOciTree = (profiles: IOciDmProfile[]): ComponentChild => {
        if (profiles.length === 0) {
            return <Accordion.Item caption="<no profiles found>" />;
        }

        const ociTreeColumns: ColumnDefinition[] = [{
            title: "",
            field: "caption",
            resizable: false,
            hozAlign: "left",
            formatter: this.ociTreeCellFormatter,
        }];

        const ociTreeOptions: ITreeGridOptions = {
            treeColumn: "caption",
            selectionType: SelectionType.Single,
            showHeader: false,
            layout: "fitColumns",
        };

        const ociSectionContent = <TreeGrid
            ref={this.#ociTableRef}
            options={ociTreeOptions}
            columns={ociTreeColumns}

            // onRowSelected={this.handleOciTreeRowSelected}
            onRowExpanded={this.handleOciTreeRowExpanded}
            onRowCollapsed={this.handleOciTreeRowCollapsed}
            isRowExpanded={this.isOciTreeRowExpanded}
            onRowContext={this.handleOciTreeRowContext}
        />;

        return ociSectionContent;
    };

    /**
     * Selectively updates root tree items based on the current data models. Items whose referenced DM entry are not
     * found in the current data model are removed and the parent element is reset to an unexpanded + uninitialized
     * state.
     */
    private updateTreesFromContext(): void {
        const context = this.context as DBEditorContextType;
        if (!context) {
            return;
        }

        const [treeItems, changed] = this.updateRootTreeItems(context);

        if (changed) {
            if (this.#connectionTableRef.current) {
                void this.#connectionTableRef.current.setData(treeItems.connectionTreeItems, SetDataAction.Replace);
            }

            if (this.#documentTableRef.current) {
                void this.#documentTableRef.current.setData(treeItems.openDocumentTreeItems, SetDataAction.Replace);
            }

            if (this.#ociTableRef.current) {
                void this.#ociTableRef.current.setData(treeItems.ociTreeItems, SetDataAction.Replace);
            }

            this.setState({ treeItems });
        }
    }

    private updateRootTreeItems(context: DBEditorContextType): [ISideBarTreeItems, boolean] {
        const { treeItems } = this.state;

        let changed = false;

        const openDocumentTreeItems = treeItems.openDocumentTreeItems;
        const documentRoots = context.documentDataModel.roots;
        documentRoots.forEach((document, index) => {
            if (index >= openDocumentTreeItems.length || openDocumentTreeItems[index].dataModelEntry !== document) {
                changed = true;
                openDocumentTreeItems[index] = this.generateTreeItem(document);
            }
        });

        // If there are any additional items in the tree, remove them.
        if (openDocumentTreeItems.length > documentRoots.length) {
            changed = true;
            openDocumentTreeItems.splice(context.documentDataModel.roots.length);
        }

        const connectionTreeItems = treeItems.connectionTreeItems;
        context.connectionsDataModel.connections.forEach((connection, index) => {
            if (index >= connectionTreeItems.length || connectionTreeItems[index].dataModelEntry !== connection) {
                changed = true;
                connectionTreeItems[index] = {
                    id: connection.id,
                    dataModelEntry: connection,
                    caption: connection.caption,
                    qualifiedName: {},
                    children: [],
                };
            }
        });

        if (connectionTreeItems.length > context.connectionsDataModel.connections.length) {
            changed = true;
            connectionTreeItems.splice(context.connectionsDataModel.connections.length);
        }

        const ociTreeItems = treeItems.ociTreeItems;
        context.ociDataModel.profiles.forEach((profile, index) => {
            if (index >= ociTreeItems.length || ociTreeItems[index].dataModelEntry !== profile) {
                changed = true;
                ociTreeItems[index] = {
                    id: profile.id,
                    dataModelEntry: profile,
                    caption: profile.caption,
                    children: [],
                };
            }
        });

        if (ociTreeItems.length > context.ociDataModel.profiles.length) {
            changed = true;
            ociTreeItems.splice(context.ociDataModel.profiles.length);
        }

        return [
            { openDocumentTreeItems, connectionTreeItems, ociTreeItems },
            changed,
        ];
    }

    /**
     * Refreshes the parent tree entry of the given item, if there's one. Not all entries have a parent entry.
     *
     * @param item The item whose parent should be refreshed.
     * @param needRefresh True if the data model entry should be refreshed before updating the tree entry.
     */
    private async refreshConnectionParentEntry(item: IConnectionTreeItem, needRefresh: boolean): Promise<void> {
        if ("parent" in item.dataModelEntry) {
            const parent = item.dataModelEntry.parent;
            await this.refreshConnectionTreeEntryChildren(parent, needRefresh);
        }
    }

    /**
     * Refreshes the parent tree entry of the given item, if there's one. Not all entries have a parent entry.
     *
     * @param item The item whose parent should be refreshed.
     */
    private async refreshOciParentEntry(item: IOciTreeItem): Promise<void> {
        if ("parent" in item.dataModelEntry) {
            const parent = item.dataModelEntry.parent;
            await this.refreshOciTreeEntryChildren(parent);
        }
    }

    /**
     * Refreshes the tree entry for the given data model entry by reloading its properties and replacing its caption
     * with the one from the given entry.
     *
     * @param table The tree table which contains the given entry.
     * @param entry The tree entry to update.
     * @param needRefresh True if the data model entry should be refreshed before updating the tree entry.
     */
    private async refreshTreeEntry(table: TreeGrid | null, entry: IDataModelBaseEntry,
        needRefresh: boolean): Promise<void> {
        const rows = table?.searchAllRows("id", entry.id);
        if (!table || !rows || rows?.length === 0) {
            return;
        }

        if (needRefresh) {
            await entry.refresh?.();
        }

        const row = rows[0];
        await row.update({ caption: entry.caption });
        row.reformat();
    }

    /**
     * Updates all child tree items of the row with the given entry in the connection tree.
     * We use the TreeGrid API to add and remove rows, which is more efficient than re-rendering the entire tree.
     * These APIs also update our stored tree structure, so we don't need to update it manually.
     *
     * @param entry The item to update.
     * @param needRefresh Whether the data model entry should be refreshed before updating the tree.
     */
    private async refreshConnectionTreeEntryChildren(entry: ConnectionDataModelEntry,
        needRefresh: boolean): Promise<void> {
        const { showSystemSchemas } = this.state;

        const table = this.#connectionTableRef.current;
        const rows = table?.searchAllRows("id", entry.id);
        if (!table || !rows || rows?.length === 0) {
            return;
        }

        const row = rows[0];
        const data = row.getData() as IConnectionTreeItem;
        const schemaName = entry.type === CdmEntityType.Schema ? data.caption : data.qualifiedName.schema;
        const tableName = entry.type === CdmEntityType.Table ? data.caption : data.qualifiedName.table;

        // If initializing takes longer that the timer runs, show a progress indicator.
        const timer = setTimeout(() => {
            this.#connectionSectionRef.current!.showProgress = true;
        }, 200);

        if (needRefresh) {
            try {
                await entry.refresh?.((result?: string | Error) => {
                    if (result instanceof Error) {
                        void ui.showErrorNotification(convertErrorToString(result));
                    } else if (typeof result === "string") {
                        void ui.setStatusBarMessage(result, 15000);
                    }
                });

                clearTimeout(timer);
                this.#connectionSectionRef.current!.showProgress = false;
            } catch (error) {
                clearTimeout(timer);
                void ui.showErrorNotification(convertErrorToString(error));

                return;
            }
        }

        let children = entry.getChildren?.();

        try {
            table.beginUpdate();
            let generator = this.generateConnectionTreeChild.bind(this, schemaName, tableName);

            switch (entry.type) {
                case CdmEntityType.Connection: {
                    if (data.dataModelEntry.state.expandedOnce) {
                        if (children && !showSystemSchemas) {
                            // Remove all system schemas from the child list.
                            children = children.filter((schema) => {
                                return !systemSchemas.has(schema.caption);
                            });
                        }

                        await this.diffTreeEntries(row, generator, children);
                    }

                    break;
                }

                case CdmEntityType.Schema:
                case CdmEntityType.SchemaGroup: {
                    await this.diffTreeEntries(row, generator, children);

                    break;
                }

                case CdmEntityType.TableGroup:
                case CdmEntityType.Table: {

                    await this.diffTreeEntries(row, generator, children);

                    break;
                }

                case CdmEntityType.MrsSchema: {
                    generator = this.generateConnectionTreeChild.bind(this, entry.caption, undefined);
                    await this.diffTreeEntries(row, generator, children);

                    break;
                }

                default: {
                    await this.diffTreeEntries(row, generator, children);
                }
            }
        } finally {
            table.endUpdate();

            clearTimeout(timer);
            this.#connectionSectionRef.current!.showProgress = false;
        }
    }

    /**
     * Updates all child tree items of the row with the given entry in the open documents tree.
     *
     * @param entry The item to update.
     *
     * @returns `true` if the tree was updated, `false` otherwise.
     */
    private async refreshDocumentTreeEntryChildren(entry: OpenDocumentDataModelEntry): Promise<boolean> {
        const { treeItems } = this.state;

        const table = this.#documentTableRef.current;
        if (!table) {
            return false;
        }

        const rowIndices = this.determineTreeRowIndex(treeItems.openDocumentTreeItems, entry, this.generateTreeItem);
        const row = table.getRowFromIndex(rowIndices);
        if (!row) {
            return false;
        }

        try {
            table.beginUpdate();

            switch (entry.type) {
                case OdmEntityType.ConnectionPage:
                case OdmEntityType.ShellSessionRoot: {
                    await this.diffTreeEntries(row, this.generateTreeItem, entry.getChildren?.());

                    break;
                }

                default:
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            void ui.showErrorNotification("Failed to refresh tree entries: " + message);
        } finally {
            table.endUpdate();
        }

        return true;
    }

    /**
     * Updates all child tree items of the row with the given entry in the open documents tree.
     *
     * @param entry The item to update.
     */
    private async refreshOciTreeEntryChildren(entry: OciDataModelEntry): Promise<void> {
        const { treeItems } = this.state;

        const table = this.#ociTableRef.current;
        if (!table) {
            return;
        }

        const rowIndices = this.determineTreeRowIndex(treeItems.ociTreeItems, entry, this.generateTreeItem);
        const row = table.getRowFromIndex(rowIndices);
        if (!row) {
            return;
        }

        try {
            const generator = this.generateTreeItem;
            table.beginUpdate();

            switch (entry.type) {
                case OciDmEntityType.ConfigurationProfile: {
                    await entry.refresh?.();
                    await this.diffTreeEntries(row, generator, entry.getChildren?.());

                    break;
                }

                case OciDmEntityType.Bastion: {
                    await this.diffTreeEntries(row, generator, entry.getChildren?.());

                    break;
                }

                default:
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            void ui.showErrorNotification("Failed to refresh tree entries: " + message);
        } finally {
            table.endUpdate();
        }
    }

    /**
     * Takes a list of data model entries and compares them to the child tree entries of the given row. If an entry is
     * not in the data model, it is removed from the tree. If no tree entry exists for a given model entry, it is added.
     *
     * @param row The row to add the children to.
     * @param generator The function to generate a tree item for a given data model entry.
     * @param entries The entries to compare.
     */
    private async diffTreeEntries<T extends IDataModelBaseEntry>(row: RowComponent,
        generator: TreeItemGenerator<T>, entries?: T[]): Promise<void> {

        if (!entries) {
            const data = row.getData() as IBaseTreeItem<T>;
            data.children = undefined;

            return;
        }

        let existingTreeItems = row.getTreeChildren();

        // Remove tree entries that are not in the data model.
        for (const child of existingTreeItems) {
            const data = child.getData() as IBaseTreeItem<T>;
            if (!entries.find((entry) => {
                return entry === data.dataModelEntry;
            })) {
                await child.delete();
            }
        }

        existingTreeItems = row.getTreeChildren();
        const newList: T[] = [];

        for (const entry of entries) {
            // Check if the data model entry already exists in the list of tree items.
            const item = existingTreeItems.find((child) => {
                const data = child.getData() as IBaseTreeItem<T>;

                return data.dataModelEntry === entry;
            });

            if (item) {
                const data = item.getData() as IBaseTreeItem<T>;
                newList.push(data.dataModelEntry);

                // Diff children if the entry was expanded once.
                if (data.dataModelEntry.state.expandedOnce) {
                    await this.diffTreeEntries(item, generator, entry.getChildren?.() as T[]);
                }
            } else {
                newList.push(entry);
            }
        }

        // Replace the list of tree items with the new one.
        for (const entry of existingTreeItems) {
            await entry.delete();
        }

        for (const entry of newList) {
            const child = generator(entry);
            row.addTreeChild(child);
        }
    }

    /**
     * A specialized version of the generic generateTreeItem method that generates a tree item for a connection data
     * model entry.
     *
     * @param schema The name of the schema the entry belongs to.
     * @param table The name of the table the entry belongs to.
     * @param entry The connection data model entry to create the tree item for.
     *
     * @returns The tree item for the given data model entry.
     */
    private generateConnectionTreeChild = <T extends IDataModelBaseEntry>(schema: string | undefined,
        table: string | undefined, entry: T): IConnectionTreeItem => {
        const item = this.generateTreeItem<IDataModelBaseEntry>(entry) as IConnectionTreeItem;
        item.qualifiedName = {
            schema,
            table,
            name: entry.caption,
        };

        return item;
    };

    /**
     * @returns the tree item for the given data model entry.
     *
     * @param entry The document entry to create the tree item for.
     */
    private generateTreeItem = <T extends IDataModelBaseEntry>(entry: T): IBaseTreeItem<T> => {
        // Check if the entry already has the internal tree item member.
        if ("$treeItem" in entry) {
            return entry.$treeItem as IBaseTreeItem<T>;
        }

        const treeItem: IBaseTreeItem<T> = {
            id: entry.id,
            dataModelEntry: entry,
            caption: entry.caption,
            children: entry.state.isLeaf ? undefined : [],
        };

        Object.defineProperty(entry, "$treeItem", {
            value: treeItem,
            enumerable: false,
            writable: false,
        });

        return treeItem;
    };

    /**
     * Determines the row position for the given entry in the given item tree. This is structured as a path
     * with indices for each level of the tree.
     *
     * @param list The list of items to search in.
     * @param entry The entry to determine the row index for.
     * @param generator The function to generate a tree item for a given data model entry.
     *
     * @returns The row index path for the entry.
     */
    private determineTreeRowIndex<T extends IDataModelBaseEntry>(list: Array<IBaseTreeItem<T>>,
        entry: T, generator: TreeItemGenerator<T>): number[] {

        let current: T | undefined = entry;
        const chain: Array<IBaseTreeItem<T>> = [];
        while (current) {
            if ("provider" in current || !("parent" in current)) {
                // Stop the loop when we reach a provider entry.
                break;
            }

            chain.unshift(generator(current));
            current = current.parent as T;
        }

        return this.treePathFromItemChain(list, chain);
    }

    /**
     * Creates a list of child indexes for the given chain of items in the given list of items.
     * The actual type of the data model entry in the tree item doesn't matter here.
     * Only references are compared.
     *
     * @param itemList The list of items to search in.
     * @param chain The chain of items to find the indexes for.
     *
     * @returns The list of indexes for the chain of items.
     */
    private treePathFromItemChain<T extends IBaseTreeItem<unknown>>(itemList: T[], chain: T[]): number[] {
        let currentChildren: Array<IBaseTreeItem<unknown>> = itemList;
        const indices: number[] = [];
        for (const item of chain) {
            const index = currentChildren.findIndex((child) => {
                return child.dataModelEntry === item.dataModelEntry;
            });

            if (index === -1) {
                break;
            }

            indices.push(index);
            currentChildren = (item.children ?? []);
        }

        return indices;
    }

    private collapseAllConnectionTreeTopLevelItems() {
        const table = this.#connectionTableRef.current;
        if (!table) {
            return;
        }

        const rows = table.getRows();
        rows.forEach((row) => {
            row.treeCollapse();
        });
    }
}
