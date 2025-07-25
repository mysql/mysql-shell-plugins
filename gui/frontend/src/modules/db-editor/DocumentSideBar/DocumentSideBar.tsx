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

import "./DocumentSideBar.css";

import { ComponentChild, createRef, render, type RefObject } from "preact";
import { CellComponent, ColumnDefinition, RowComponent } from "tabulator-tables";

import { ui } from "../../../app-logic/UILayer.js";
import { DbSystem, LoadBalancer } from "../../../communication/Oci.js";
import { Accordion, IAccordionProperties, type IAccordionSection } from "../../../components/ui/Accordion/Accordion.js";
import type { AccordionSection } from "../../../components/ui/Accordion/AccordionSection.js";
import { Button } from "../../../components/ui/Button/Button.js";
import { Codicon } from "../../../components/ui/Codicon.js";
import {
    ComponentBase, ComponentPlacement, IComponentProperties, IComponentState, SelectionType,
} from "../../../components/ui/Component/ComponentBase.js";
import { Container, Orientation } from "../../../components/ui/Container/Container.js";
import { Icon, type IIconOverlay } from "../../../components/ui/Icon/Icon.js";
import { Label } from "../../../components/ui/Label/Label.js";
import { Menu } from "../../../components/ui/Menu/Menu.js";
import { IMenuItemProperties, MenuItem } from "../../../components/ui/Menu/MenuItem.js";
import { ISplitterPaneSizeInfo } from "../../../components/ui/SplitContainer/SplitContainer.js";
import { ITreeGridOptions, SetDataAction, TreeGrid } from "../../../components/ui/TreeGrid/TreeGrid.js";
import {
    CdmEntityType, type ConnectionDMActionList, type ConnectionDataModelEntry, type ConnectionDataModelNoGroupEntry,
    type ICdmConnectionEntry, type ICdmConnectionGroupEntry, type ICdmRestAuthAppEntry, type ICdmRestRootEntry,
    type ICdmRestSchemaEntry, type ICdmRestServiceEntry,
} from "../../../data-models/ConnectionDataModel.js";
import {
    OciDmEntityType, type IOciDmCompartment, type IOciDmProfile, type OciDataModelEntry,
} from "../../../data-models/OciDataModel.js";
import { OdmEntityType, type OpenDocumentDataModelEntry } from "../../../data-models/OpenDocumentDataModel.js";
import {
    systemSchemas, type AdminPageType, type Command, type IDataModelEntryState, type ISubscriberActionType,
} from "../../../data-models/data-model-types.js";
import { BastionLifecycleState } from "../../../oci-typings/oci-bastion/lib/model/bastion-lifecycle-state.js";
import { Assets } from "../../../supplement/Assets.js";
import { requisitions } from "../../../supplement/Requisitions.js";
import { appParameters } from "../../../supplement/AppParameters.js";
import { DBType, IFolderPath } from "../../../supplement/ShellInterface/index.js";
import { RunMode, webSession } from "../../../supplement/WebSession.js";
import { EditorLanguage } from "../../../supplement/index.js";
import { convertErrorToString, uuid } from "../../../utilities/helpers.js";
import { EnabledState } from "../../mrs/mrs-helpers.js";
import { MrsDbObjectType } from "../../mrs/types.js";
import {
    DocumentContext, type DocumentContextType, type IBaseTreeItem, type IConnectionTreeItem,
    type IDocumentTreeItem, type IOciTreeItem, type ISideBarCommandResult, type QualifiedName,
} from "../index.js";
import { Settings } from "../../../supplement/Settings/Settings.js";

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
const cdmTypeToEntryIcon = new Map<CdmEntityType, string | Codicon>([
    [CdmEntityType.Schema, Assets.db.schemaIcon],
    [CdmEntityType.Table, Assets.db.tableIcon],
    [CdmEntityType.View, Assets.db.viewIcon],
    [CdmEntityType.View, Assets.db.viewIcon],
    [CdmEntityType.StoredFunction, Assets.db.functionIcon],
    [CdmEntityType.StoredProcedure, Assets.db.procedureIcon],
    [CdmEntityType.Library, Assets.db.libraryIcon],
    [CdmEntityType.Event, Assets.db.eventIcon],
    [CdmEntityType.Trigger, Assets.db.triggerIcon],
    [CdmEntityType.Column, Assets.db.columnNullableIcon],
    [CdmEntityType.Index, Assets.db.indexIcon],
    [CdmEntityType.ForeignKey, Assets.db.foreignKeyIcon],
    [CdmEntityType.TableGroup, Assets.db.tablesIcon],
    [CdmEntityType.SchemaGroup, Assets.db.schemaIcon],
    [CdmEntityType.ConnectionGroup, Assets.file.folderIcon],
    [CdmEntityType.Admin, Assets.documents.adminDashboardIcon],
    [CdmEntityType.MrsRoot, Assets.mrs.mainIcon],
    [CdmEntityType.MrsService, Assets.mrs.serviceIcon],
    [CdmEntityType.MrsSchema, Assets.mrs.schemaIcon],
    [CdmEntityType.MrsContentSet, Assets.mrs.contentSetIcon],
    [CdmEntityType.MrsUser, Assets.oci.profileIcon],
    [CdmEntityType.MrsAuthApp, Assets.mrs.authAppIcon],
    [CdmEntityType.MrsServiceAuthApp, Assets.mrs.authAppIcon],
    [CdmEntityType.MrsAuthAppGroup, Assets.mrs.authAppsIcon],
    [CdmEntityType.MrsContentFile, Assets.mrs.contentFileIcon],
    [CdmEntityType.MrsDbObject, Assets.mrs.dbObjectIcon],
    [CdmEntityType.MrsRouter, Assets.router.routerIcon],
    [CdmEntityType.MrsRouterGroup, Assets.router.routersIcon],
    [CdmEntityType.MrsRouterService, Assets.mrs.serviceIcon],
]);

/** Mapping of connection data model types to icons (sub types). */
const cdmSubTypeToDbObjectIcon: Map<CdmEntityType, string> = new Map([
    [CdmEntityType.Table, Assets.db.tablesIcon],
    [CdmEntityType.View, Assets.db.viewsIcon],
    [CdmEntityType.StoredFunction, Assets.db.functionsIcon],
    [CdmEntityType.StoredProcedure, Assets.db.proceduresIcon],
    [CdmEntityType.Library, Assets.db.librariesIcon],
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
    ["lakehouseNavigator", Assets.lakehouse.navigatorIcon],
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

export interface IDocumentSideBarSectionState {
    expanded?: boolean;
    size?: number;
}

interface IDocumentSideBarProperties extends IComponentProperties {
    /** Which document item is currently selected. */
    selectedOpenDocument: string;

    /** Which schema in the connection tree should be marked as being the current schema? */
    markedSchema: string;

    /** The state of each accordion section. */
    savedSectionState?: Map<string, IDocumentSideBarSectionState>;

    overviewId: string;

    onSelectConnectionItem?: (entry: ConnectionDataModelEntry) => Promise<void>;
    onSelectDocumentItem?: (entry: OpenDocumentDataModelEntry) => Promise<void>;
    onChangeItem?: (id: string, newCaption: string) => void;
    onSaveState?: (state: Map<string, IDocumentSideBarSectionState>) => void;
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
    type: CdmEntityType | OdmEntityType | OciDmEntityType;
    parent?: IDataModelBaseEntry;

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

interface IDocumentSideBarState extends IComponentState {
    treeItems: ISideBarTreeItems;

    /** If editing an editor's caption is active then this field holds its id. */
    editing?: string;

    /** Keeps the new caption of an editor while it is being edited. */
    tempCaption?: string;

    /** Set when the default connection is being opened (in single server mode). */
    defaultOpening: boolean;
}

export class DocumentSideBar extends ComponentBase<IDocumentSideBarProperties, IDocumentSideBarState> {
    public static override contextType = DocumentContext;

    private cdmTypeToMenuRefMap = new Map<CdmEntityType, RefObject<Menu>>([
        [CdmEntityType.ConnectionGroup, createRef<Menu>()],
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
        [CdmEntityType.Library, createRef<Menu>()],
        [CdmEntityType.MrsRoot, createRef<Menu>()],
        [CdmEntityType.MrsService, createRef<Menu>()],
        [CdmEntityType.MrsSchema, createRef<Menu>()],
        [CdmEntityType.MrsAuthAppGroup, createRef<Menu>()],
        [CdmEntityType.MrsAuthApp, createRef<Menu>()],
        [CdmEntityType.MrsServiceAuthApp, createRef<Menu>()],
        [CdmEntityType.MrsRouterGroup, createRef<Menu>()],
        [CdmEntityType.MrsRouter, createRef<Menu>()],
        [CdmEntityType.MrsUser, createRef<Menu>()],
        [CdmEntityType.MrsDbObject, createRef<Menu>()],
    ]);

    private odmTypeToMenuRefMap = new Map<OdmEntityType, RefObject<Menu>>([
        [OdmEntityType.ConnectionPage, createRef<Menu>()],
        [OdmEntityType.Overview, createRef<Menu>()],
        [OdmEntityType.Notebook, createRef<Menu>()],
        [OdmEntityType.Script, createRef<Menu>()],
        [OdmEntityType.AdminPage, createRef<Menu>()],
        [OdmEntityType.ShellSession, createRef<Menu>()],
    ]);

    private ociTypeToMenuRefMap = new Map<OciDmEntityType, RefObject<Menu>>([
        [OciDmEntityType.ConfigurationProfile, createRef<Menu>()],
        [OciDmEntityType.Compartment, createRef<Menu>()],
        [OciDmEntityType.Bastion, createRef<Menu>()],
        [OciDmEntityType.ComputeInstance, createRef<Menu>()],
        [OciDmEntityType.DbSystem, createRef<Menu>()],
        [OciDmEntityType.HeatWaveCluster, createRef<Menu>()],
        [OciDmEntityType.LoadBalancer, createRef<Menu>()],
    ]);

    private documentTableRef = createRef<TreeGrid>();
    private connectionTableRef = createRef<TreeGrid>();
    private ociTableRef = createRef<TreeGrid>();

    private connectionSectionRef = createRef<AccordionSection>();
    private ociSectionRef = createRef<AccordionSection>();

    // > 0 if a data model refresh is running. In this case ignore all incoming data model changes
    // (we are the source of them in this case).
    private refreshRunning = 0;

    public constructor(props: IDocumentSideBarProperties) {
        super(props);

        this.state = {
            treeItems: {
                openDocumentTreeItems: [],
                connectionTreeItems: [],
                ociTreeItems: [],
            },
            defaultOpening: false,
        };

        this.addHandledProperties("selectedOpenDocument", "markedSchema", "savedSectionState", "overviewId",
            "onSelectConnectionItem", "onSelectDocumentItem", "onChangeItem", "onSaveState",
            "onConnectionTreeCommand", "onDocumentTreeCommand", "onOciTreeCommand",
        );
    }

    public override componentDidMount(): void {
        requisitions.register("refreshConnection", this.refreshConnection);
        requisitions.register("refreshConnectionGroup", this.refreshConnectionGroup);
        requisitions.register("settingsChanged", this.handleSettingsChanged);

        // Create the initial tree items.
        const context = this.context as DocumentContextType;
        if (context) {
            context.connectionsDataModel.subscribe(this.connectionDataModelChanged);
            context.documentDataModel.subscribe(this.documentDataModelChanged);

            this.updateTreesFromContext();
        }
    }

    public override componentWillUnmount(): void {
        const context = this.context as DocumentContextType;
        if (context) {
            context.connectionsDataModel.unsubscribe(this.connectionDataModelChanged);
            context.documentDataModel.unsubscribe(this.documentDataModelChanged);
        }

        requisitions.unregister("refreshConnectionGroup", this.refreshConnectionGroup);
        requisitions.unregister("refreshConnection", this.refreshConnection);
        requisitions.unregister("settingsChanged", this.handleSettingsChanged);
    }

    public override componentDidUpdate(prevProps: IDocumentSideBarProperties): void {
        if (webSession.runMode === RunMode.SingleServer) {
            const { defaultOpening } = this.state;
            const context = this.context as DocumentContextType;
            if (!defaultOpening && context) {
                this.setState({ defaultOpening: true });

                void context.connectionsDataModel.connectionList().then((connectionList) => {
                    const firstConnection = connectionList[0];
                    if (!context.documentDataModel.isOpen(firstConnection.details)) {
                        // Open the first connection and wait for it to finish that.
                        void firstConnection.refresh?.().then(() => {
                            setTimeout(() => {
                                const row = this.connectionTableRef.current?.getRows()[0];
                                if (row) {
                                    row.treeExpand();
                                }
                            }, 500);

                            this.openNewNotebook(firstConnection);
                        });

                        // Do not update the trees yet. Instead wait for the new notebook to be opened.
                        return;
                    }
                });
            }
        }

        const { markedSchema, selectedOpenDocument } = this.props;

        // Check for data model changes and update our trees.
        this.updateTreesFromContext();

        if (this.connectionTableRef.current) {
            if (markedSchema !== prevProps.markedSchema) {
                let rows = this.connectionTableRef.current.searchAllRows("caption", markedSchema);
                rows.forEach((row) => {
                    row.reformat();
                });

                rows = this.connectionTableRef.current.searchAllRows("caption", prevProps.markedSchema);
                rows.forEach((row) => {
                    row.reformat();
                });
            }
        }

        if (prevProps.selectedOpenDocument !== selectedOpenDocument) {
            const { treeItems } = this.state;

            this.documentTableRef.current?.deselectRow();
            if (selectedOpenDocument && selectedOpenDocument !== this.props.overviewId) {
                const rows = this.documentTableRef.current?.searchAllRows("id", selectedOpenDocument);
                rows?.forEach((row) => {
                    row.select();
                });
            } else if (treeItems.openDocumentTreeItems.length > 0) {
                // No selection or the overview was given, so select the overview (if visible at all).
                const item = treeItems.openDocumentTreeItems[0];
                const rows = this.documentTableRef.current?.searchAllRows("id", item.id);
                rows?.forEach((row) => {
                    row.select();
                });
            }
        }
    }

    public render(): ComponentChild {
        const { savedSectionState } = this.props;
        const { editing } = this.state;

        const context = this.context as DocumentContextType;
        if (!context) {
            return null;
        }

        const documentSectionState = savedSectionState?.get("documentSection") ?? {};
        const connectionSectionState = savedSectionState?.get("connectionSection") ?? {};
        const ociSectionState = savedSectionState?.get("ociSection") ?? {};

        const title = appParameters.embedded ? "MYSQL SHELL GUI" : "MYSQL SHELL WORKBENCH";

        const accordionSections: IAccordionSection[] = [{
            id: "documentSection",
            caption: "OPEN EDITORS",
            stretch: false,
            minSize: 70,
            maxSize: 400,
            resizable: true,
            expanded: documentSectionState.expanded,
            initialSize: documentSectionState.size,
            dimmed: editing != null,
            actions: [],
            content: this.renderDocumentsTree(context.documentDataModel.roots),
        }];

        if (webSession.runMode !== RunMode.SingleServer) {
            accordionSections[0].actions!.push({
                icon: Codicon.NewFile,
                command: {
                    command: "addConsole",
                    tooltip: "Add new console",
                    title: "Add new console",
                },
            });
        }

        const connectionSection: IAccordionSection = {
            ref: this.connectionSectionRef,
            id: "connectionSection",
            caption: "DATABASE CONNECTIONS",
            stretch: true,
            expanded: connectionSectionState.expanded,
            initialSize: connectionSectionState.size ?? 500,
            resizable: true,
            minSize: 100,
            actions: [],
            content: this.renderConnectionsTree(context.connectionsDataModel.roots),
        };

        accordionSections.push(connectionSection);

        if (webSession.runMode === RunMode.SingleServer) {
            connectionSection.actions!.push({
                icon: Codicon.CollapseAll,
                command: {
                    command: "msg.collapseAll",
                    tooltip: "Collapse Connection Node",
                    title: "Collapse Connection Node",
                },
            });
        } else {
            connectionSection.actions!.push({
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
            });
        }

        if (webSession.runMode !== RunMode.SingleServer) {
            accordionSections.push({
                ref: this.ociSectionRef,
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
            });
        }

        return (
            <>
                <Accordion
                    id="documentSideBar"
                    caption={title}
                    actions={[{
                        icon: Codicon.KebabHorizontal,
                        tooltip: "More Actions",
                        choices: [{
                            icon: Assets.toolbar.importIcon,
                            command: {
                                command: "msg.importWorkbenchConnections",
                                title: "Import MySQL Workbench Connections",
                            },
                        }, {
                            icon: Codicon.Account,
                            command: {
                                command: "msg.logOut",
                                title: "Log Out",
                            },
                        },
                        {
                            icon: Codicon.Bug,
                            command: {
                                command: "msg.fileBugReport",
                                title: "File Bug Report",
                            },
                        }],
                    }]}
                    sections={accordionSections}

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
        const optionalMenuItems: ComponentChild[] = [];
        if (webSession.runMode !== RunMode.SingleServer) {
            optionalMenuItems.push(
                <MenuItem command={{ title: "Edit DB Connection", command: "msg.editConnection" }} />,
                <MenuItem command={{ title: "Duplicate this DB Connection", command: "msg.duplicateConnection" }} />,
                <MenuItem command={{ title: "Delete DB Connection...", command: "msg.removeConnection" }} />,
                <MenuItem command={{ title: "-", command: "" }} disabled />,
                <MenuItem
                    id="showSystemSchemas"
                    command={{
                        title: "Show MySQL System Schemas", command: "msg.showSystemSchemasOnConnection",
                    }}
                    altCommand={{
                        title: "Hide MySQL System Schemas", command: "msg.hideSystemSchemasOnConnection",
                    }}
                />,
                <MenuItem command={{ title: "-", command: "" }} disabled />,
                <MenuItem command={{ title: "Load SQL Script from Disk...", command: "msg.loadScriptFromDisk" }} />,
                <MenuItem command={{ title: "Load Dump from Disk...", command: "msg.loadDumpFromDisk" }} disabled />,
                <MenuItem command={{ title: "-", command: "" }} disabled />,
                <MenuItem
                    command={{
                        title: "Open New MySQL Shell Console for this Connection",
                        command: "msg.newSessionUsingConnection",
                    }} />,
                <MenuItem command={{ title: "-", command: "" }} disabled />,
            );
        }

        return (
            <>
                <Menu
                    id="connectionGroupContextMenu"
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.ConnectionGroup)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleConnectionTreeContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Add Subfolder", command: "msg.addSubFolder" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Edit Folder", command: "msg.editFolder" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Remove Folder", command: "msg.removeFolder" }} />
                </Menu>

                <Menu
                    id="connectionContextMenu"
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.Connection)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleConnectionTreeContextMenuItemClick}
                    isItemDisabled={this.isConnectionMenuItemDisabled}
                >
                    <MenuItem command={{ title: "Open New Database Connection", command: "msg.openConnection" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    {optionalMenuItems}
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
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.Schema)}
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
                    <MenuItem command={{ title: "Create Library From...", command: "msg.createLibraryFrom" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Create Schema...", command: "msg.createSchema" }} disabled />
                    <MenuItem command={{ title: "Alter Schema...", command: "msg.alterSchema" }} disabled />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Drop Schema...", command: "msg.dropSchema" }} disabled />
                </Menu >

                <Menu
                    id="tableContextMenu"
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.Table)}
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
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.Column)}
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
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.View)}
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
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.Event)}
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
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.StoredProcedure)}
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
                    <MenuItem command={{ title: "Drop Procedure ...", command: "msg.dropRoutine" }} disabled />
                </Menu >

                <Menu
                    id="functionContextMenu"
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.StoredFunction)}
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
                    <MenuItem command={{ title: "Drop Function ...", command: "msg.dropRoutine" }} disabled />
                </Menu >

                <Menu
                    id="libraryContextMenu"
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.Library)}
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
                    <MenuItem command={{ title: "Create Library ...", command: "msg.createLibraryJs" }} disabled />
                    <MenuItem command={{ title: "Alter Library ...", command: "msg.alterLibrary" }} disabled />
                    <MenuItem command={{ title: "Drop Library ...", command: "msg.dropLibrary" }} disabled />
                </Menu >

                <Menu
                    id="indexContextMenu"
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.Index)}
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
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.Trigger)}
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
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.ForeignKey)}
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
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.MrsRoot)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem
                        command={{
                            title: "Configure MySQL REST Service",
                            command: "msg.mrs.configureMySQLRestService",
                        }}
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
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
                        command={{ title: "Show Private Items", command: "msg.mrs.showPrivateItems" }}
                        altCommand={{ title: "Hide Private Items", command: "msg.mrs.hidePrivateItems" }}
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
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.MrsService)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Edit REST Service...", command: "msg.mrs.editService" }} />
                    <MenuItem
                        command={{ title: "Set as Current REST Service", command: "msg.mrs.setCurrentService" }}
                    />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Load from Disk", command: "" }} >
                        <MenuItem
                            command={{
                                title: "REST Schema From JSON File...",
                                command: "msg.mrs.loadSchemaFromJSONFile",
                            }}
                            disabled
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "Dump to Disk", command: "" }}>
                        <MenuItem
                            command={{ title: "REST Client SDK Files...", command: "msg.mrs.exportServiceSdk" }}
                            disabled
                        />
                        <MenuItem command={{ title: "-", command: "" }} disabled />
                    </MenuItem>
                    <MenuItem command={{ title: "Copy to Clipboard", command: "" }}>
                        <MenuItem
                            command={{
                                title: "Copy CREATE REST SERVICE Statement",
                                command: "msg.mrs.copyCreateServiceSql",
                            }}
                        />
                        <MenuItem
                            command={{
                                title: "Copy CREATE REST SERVICE Statement Including Database Objects",
                                command: "msg.mrs.copyCreateServiceSqlIncludeDatabaseEndpoints",
                            }}
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{
                        title: "Add and Link REST Authentication App...",
                        command: "msg.mrs.addAuthApp",
                    }} />
                    <MenuItem command={{ title: "Link REST Authentication App...", command: "msg.mrs.linkAuthApp" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Delete REST Service...", command: "msg.mrs.deleteService" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "MRS Service Documentation", command: "msg.mrs.docs.service" }} />
                </Menu>

                <Menu
                    id="mrsRouterMenu"
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.MrsRouter)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Delete Router...", command: "msg.mrs.deleteRouter" }} />
                </Menu>

                <Menu
                    id="mrsSchemaMenu"
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.MrsSchema)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Edit REST Schema...", command: "msg.mrs.editSchema" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Load from Disk", command: "" }} >
                        <MenuItem
                            command={{
                                title: "REST Object From JSON File...",
                                command: "msg.mrs.loadObjectFromJSONFile",
                            }}
                            disabled
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "Dump to Disk", command: "" }}>
                        <MenuItem
                            command={{
                                title: "Dump REST Schema To JSON File...",
                                command: "msg.mrs.dumpSchemaToJSONFile",
                            }}
                            disabled
                        />
                        <MenuItem command={{ title: "-", command: "" }} disabled />
                        <MenuItem
                            command={{
                                title: "Dump CREATE REST SCHEMA Statement...",
                                command: "msg.mrs.dumpCreateSchemaSql",
                            }}
                            disabled
                        />
                        <MenuItem
                            command={{
                                title: "Dump CREATE REST SCHEMA Statement Including Database Objects...",
                                command: "msg.mrs.dumpCreateSchemaSqlIncludeDatabaseEndpoints",
                            }}
                            disabled
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "Copy to Clipboard", command: "" }}>
                        <MenuItem
                            command={{
                                title: "Copy CREATE REST SCHEMA Statement",
                                command: "msg.mrs.copyCreateSchemaSql",
                            }}
                        />
                        <MenuItem
                            command={{
                                title: "Copy CREATE REST SCHEMA Statement Including Database Objects",
                                command: "msg.mrs.copyCreateSchemaSqlIncludeDatabaseEndpoints",
                            }}
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Delete REST Schema...", command: "msg.mrs.deleteSchema" }} />
                </Menu>

                <Menu
                    id="mrsAuthAppGroupMenu"
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.MrsAuthAppGroup)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Add New Authentication App", command: "msg.mrs.addAuthApp" }} />
                </Menu>

                <Menu
                    id="mrsAuthAppMenu"
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.MrsAuthApp)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Edit REST Authentication App...", command: "msg.mrs.editAuthApp" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{
                        title: "Link REST Authentication App to REST Service...",
                        command: "msg.mrs.linkToService",
                    }} />
                    <MenuItem command={{ title: "Add REST User...", command: "msg.mrs.addUser" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{
                        title: "Delete REST Authentication App...",
                        command: "msg.mrs.deleteAuthApp",
                    }} />
                </Menu>

                <Menu
                    id="mrsServiceAuthAppMenu"
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.MrsServiceAuthApp)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem command={{
                        title: "Unlink REST Authentication App...",
                        command: "msg.mrs.unlinkAuthApp",
                    }} />
                </Menu>

                <Menu
                    id="mrsUserMenu"
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.MrsUser)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Edit User...", command: "msg.mrs.editUser" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Delete User...", command: "msg.mrs.deleteUser" }} />
                </Menu>

                <Menu
                    id="mrsDbObjectMenu"
                    ref={this.cdmTypeToMenuRefMap.get(CdmEntityType.MrsDbObject)}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMrsContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Edit REST Object...", command: "msg.mrs.editDbObject" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem
                        command={{
                            title: "Open REST Object Request Path in Web Browser",
                            command: "msg.mrs.openDbObjectRequestPath",
                        }}
                    />
                    <MenuItem command={{ title: "Dump to Disk", command: "" }}>
                        <MenuItem
                            command={{
                                title: "Export REST Object To JSON File...",
                                command: "msg.mrs.dumpObjectToJSONFile",
                            }}
                            disabled
                        />
                        <MenuItem command={{ title: "-", command: "" }} disabled />
                        <MenuItem
                            command={{
                                title: "Export CREATE REST OBJECT Statement...",
                                command: "msg.mrs.exportCreateDbObjectSql",
                            }}
                            disabled
                        />
                    </MenuItem>
                    <MenuItem command={{ title: "Copy to Clipboard", command: "" }}>
                        <MenuItem
                            command={{
                                title: "Copy REST Object Request Path",
                                command: "msg.mrs.copyDbObjectRequestPath",
                            }}
                        />
                        <MenuItem command={{ title: "-", command: "" }} disabled />
                        <MenuItem
                            command={{
                                title: "Copy CREATE REST Object Statement",
                                command: "msg.mrs.copyCreateDbObjectSql",
                            }}
                        />
                    </MenuItem>
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
                    ref={this.odmTypeToMenuRefMap.get(OdmEntityType.ConnectionPage)}
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
                    ref={this.ociTypeToMenuRefMap.get(OciDmEntityType.ConfigurationProfile)}
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
                    ref={this.ociTypeToMenuRefMap.get(OciDmEntityType.Compartment)}
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
                    ref={this.ociTypeToMenuRefMap.get(OciDmEntityType.DbSystem)}
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
                    ref={this.ociTypeToMenuRefMap.get(OciDmEntityType.ComputeInstance)}
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
                    ref={this.ociTypeToMenuRefMap.get(OciDmEntityType.HeatWaveCluster)}
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
                    ref={this.ociTypeToMenuRefMap.get(OciDmEntityType.Bastion)}
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

        this.cdmTypeToMenuRefMap.get(rowData.dataModelEntry.type)?.current?.open(targetRect, false, {}, rowData);

        return true;
    };

    private showOpenDocumentTreeContextMenu = (rowData: IDocumentTreeItem, e: MouseEvent): boolean => {
        const targetRect = new DOMRect(e.clientX, e.clientY, 2, 2);

        this.odmTypeToMenuRefMap.get(rowData.dataModelEntry.type)?.current?.open(targetRect, false, {}, rowData);

        return true;
    };

    private showOciTreeContextMenu = (rowData: IOciTreeItem, e: MouseEvent): boolean => {
        const targetRect = new DOMRect(e.clientX, e.clientY, 2, 2);

        this.ociTypeToMenuRefMap.get(rowData.dataModelEntry.type)?.current?.open(targetRect, false, {}, rowData);

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
            if (entry.dataModelEntry.type !== CdmEntityType.ConnectionGroup) {
                return entry.dataModelEntry.connection.details.dbType !== DBType.MySQL;
            }
        }

        return item.disabled ?? false;
    };

    private connectionTreeCellFormatter = (cell: CellComponent): string | HTMLElement => {
        const data = cell.getData() as IConnectionTreeItem;

        let iconName = cdmTypeToEntryIcon.get(data.dataModelEntry.type) ?? Assets.file.defaultIcon;

        const overlays: IIconOverlay[] = [];
        let dimEntry = false;

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
                    iconName = Assets.db.columnPkIcon;
                } else if (data.dataModelEntry.nullable) {
                    iconName = Assets.db.columnNullableIcon;
                } else {
                    iconName = Assets.db.columnNotNullIcon;
                }
                break;
            }

            case CdmEntityType.AdminPage: {
                iconName = pageTypeToDocumentIcon.get(data.dataModelEntry.pageType) ?? Assets.file.defaultIcon;

                break;
            }

            case CdmEntityType.MrsRoot: {
                if (!data.dataModelEntry.serviceEnabled) {
                    overlays.push({ icon: Assets.overlay.statusDotRed, mask: Assets.overlay.statusDotMask });
                } else if (data.dataModelEntry.showUpdateAvailable) {
                    overlays.push({ icon: Assets.overlay.updateAvailable, mask: Assets.overlay.updateAvailableMask });
                }

                break;
            }

            case CdmEntityType.MrsDbObject: {
                const type = data.dataModelEntry.details.objectType;
                iconName = mrsDbObjectTypeToIcon.get(type) ?? Assets.file.defaultIcon;
                if (data.dataModelEntry.details.enabled === 0) {
                    overlays.push({ icon: Assets.overlay.statusDotRed, mask: Assets.overlay.statusDotMask });
                } else if (data.dataModelEntry.details.enabled === EnabledState.PrivateOnly) {
                    dimEntry = true;
                    overlays.push({ icon: Assets.overlay.private, mask: Assets.overlay.statusDotMask });
                } else if (data.dataModelEntry.details.requiresAuth === 1) {
                    overlays.push({ icon: Assets.overlay.lock, mask: Assets.overlay.lockMask });
                }

                break;
            }

            case CdmEntityType.MrsSchema:
            case CdmEntityType.MrsContentFile:
            case CdmEntityType.MrsContentSet: {
                if (data.dataModelEntry.details.requiresAuth) {
                    overlays.push({ icon: Assets.overlay.lock, mask: Assets.overlay.lockMask });
                } else if (data.dataModelEntry.details.enabled === EnabledState.PrivateOnly) {
                    overlays.push({ icon: Assets.overlay.private, mask: Assets.overlay.statusDotMask });
                } else if (data.dataModelEntry.details.enabled === EnabledState.Disabled) {
                    overlays.push({ icon: Assets.overlay.statusDotRed, mask: Assets.overlay.statusDotMask });
                }

                if (data.dataModelEntry.details.enabled === EnabledState.PrivateOnly) {
                    // Need a separate check for private items, as we have to show them dimmed regardless
                    // of the overlay they use.
                    dimEntry = true;
                }

                break;
            }

            case CdmEntityType.MrsService: {
                iconName = data.dataModelEntry.details.isCurrent
                    ? Assets.mrs.serviceDefaultIcon
                    : Assets.mrs.serviceIcon;

                if (!data.dataModelEntry.details.enabled) {
                    overlays.push({ icon: Assets.overlay.disabled, mask: Assets.overlay.disabledMask });
                } else if (data.dataModelEntry.details.inDevelopment) {
                    overlays.push({ icon: Assets.overlay.inDevelopment, mask: Assets.overlay.inDevelopmentMask });
                } else if (data.dataModelEntry.details.published) {
                    overlays.push({ icon: Assets.overlay.live, mask: Assets.overlay.liveMask });
                }

                break;
            }

            case CdmEntityType.MrsAuthApp: {
                if (!data.dataModelEntry.details.enabled) {
                    overlays.push({ icon: Assets.overlay.statusDotRed, mask: Assets.overlay.statusDotMask });
                }

                break;
            }

            case CdmEntityType.MrsServiceAuthApp: {
                overlays.push({ icon: Assets.overlay.link, mask: Assets.overlay.linkMask });
                if (!data.dataModelEntry.details.enabled) {
                    overlays.push({ icon: Assets.overlay.statusDotRed, mask: Assets.overlay.statusDotMask });
                }

                break;
            }

            case CdmEntityType.MrsRouter: {
                if (data.dataModelEntry.requiresUpgrade) {
                    overlays.push({ icon: Assets.overlay.statusDotRed, mask: Assets.overlay.statusDotMask });
                } else if (!data.dataModelEntry.details.active) {
                    overlays.push({ icon: Assets.overlay.statusDotOrange, mask: Assets.overlay.statusDotMask });
                }

                break;
            }

            case CdmEntityType.MrsRouterService:
            case CdmEntityType.MrsAuthAppService: {
                overlays.push({ icon: Assets.overlay.link, mask: Assets.overlay.linkMask });

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

            case CdmEntityType.Library: {
                // TODO: change icon from standard to the particular language.
                break;
            }

            default:
        }

        const host = document.createElement("div");
        host.className = "connectionTreeEntry sidebarTreeEntry";

        let actionBox;

        let subCaption;
        if (data.dataModelEntry.description) {
            subCaption = <Label id="subCaption" caption={data.dataModelEntry.description} />;
        }

        switch (data.dataModelEntry.type) {
            case CdmEntityType.Connection: {
                const connection = data.dataModelEntry;
                const runNotebookButton = <Button
                    className="actionButton"
                    data-tooltip="Open New Connection using Notebook"
                    imageOnly
                    onClick={() => {
                        const { onConnectionTreeCommand } = this.props;
                        void onConnectionTreeCommand({
                            title: "Open New Connection using Notebook",
                            command: "msg.openConnection",
                            arguments: ["notebook"],
                        }, connection);
                    }}
                >
                    <Icon src={Assets.db.runNotebookIcon} data-tooltip="inherit" />
                </Button>;

                const runScriptButton = <Button
                    className="actionButton"
                    data-tooltip="Open New Connection using SQL Script"
                    imageOnly
                    onClick={() => {
                        const { onConnectionTreeCommand } = this.props;
                        void onConnectionTreeCommand({
                            title: "Open New Connection using Notebook",
                            command: "msg.openConnection",
                            arguments: ["script"],
                        }, connection);
                    }}
                >
                    <Icon src={Assets.db.runScriptIcon} data-tooltip="inherit" />
                </Button>;

                const refreshButton = <Button
                    className="actionButton"
                    data-tooltip="Refresh Connection"
                    imageOnly
                    onClick={() => {
                        void this.refreshConnectionTreeEntryChildren(data.dataModelEntry, true, true);
                    }}
                >
                    <Icon src={Codicon.Refresh} data-tooltip="inherit" />
                </Button>;

                actionBox = <Container className="actionBox" orientation={Orientation.LeftToRight}>
                    {runNotebookButton}
                    {runScriptButton}
                    {refreshButton}
                </Container>;

                break;
            }

            case CdmEntityType.MrsService: {
                const { onConnectionTreeCommand } = this.props;

                const docButton = <Button
                    className="actionButton"
                    data-tooltip="MRS Service Documentation"
                    imageOnly
                    onClick={() => {
                        void onConnectionTreeCommand({ title: "", command: "msg.mrs.docs.service" },
                            data.dataModelEntry as ICdmRestServiceEntry);
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

        const dimClass = dimEntry ? "dim" : "";
        const content = <>
            <Icon
                src={iconName}
                overlays={overlays}
                className={dimClass}
            />
            <Label id="mainCaption" caption={data.caption} />
            {subCaption}
            {actionBox}
        </>;

        render(content, host);

        return host;
    };

    private openNewNotebook(entry: ConnectionDataModelNoGroupEntry): void {
        const connection = entry.connection;
        void requisitions.execute("openDocument", {
            connection: connection.details,
            documentDetails: {
                id: uuid(),
                type: OdmEntityType.Notebook,
                caption: connection.caption,
                language: "msg",
            },
        });
    }

    private openNewScript(entry: ConnectionDataModelNoGroupEntry): void {
        const connection = entry.connection;
        void requisitions.execute("openDocument", {
            connection: connection.details,
            documentDetails: {
                id: uuid(),
                type: OdmEntityType.Script,
                caption: "SQL Script",
                language: connection.details.dbType === DBType.MySQL ? "mysql" : "sql",
            },
        });
    }

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
                            {
                                connectionId: pageEntry.parent!.details.id, documentId: data.dataModelEntry.id,
                                pageId: pageEntry.id,
                            });
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
                            void requisitions.execute("closeDocument", {
                                connectionId: pageEntry.parent.details.id,
                                documentId: data.dataModelEntry.id,
                                pageId: pageEntry.parent.id,
                            });
                        } else {
                            void requisitions.execute("closeDocument", {
                                documentId: data.dataModelEntry.id,
                                pageId: pageEntry.parent?.id,
                            });
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
                this.ociSectionRef.current!.showProgress = true;
            }, 200);

            row.getTable().blockRedraw();

            ociEntry.dataModelEntry.refresh?.().then(() => {
                clearTimeout(timer);
                this.ociSectionRef.current!.showProgress = false;

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
                this.ociSectionRef.current!.showProgress = false;

                const message = convertErrorToString(error);
                void ui.showErrorMessage(message, {});

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

        const overlays: IIconOverlay[] = [];

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
                    overlays.push({ icon: Assets.overlay.statusDotOrange, mask: Assets.overlay.statusDotMask });
                }

                break;
            }

            case OciDmEntityType.DbSystem: {
                const details = data.dataModelEntry.details;

                let overlayImage: string | undefined = Assets.overlay.statusDotOrange; // Assume it's not active.
                const overlayImageMask = Assets.overlay.statusDotMask;

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

                if (overlayImage) {
                    overlays.push({ icon: overlayImage, mask: overlayImageMask });
                }

                break;
            }

            case OciDmEntityType.HeatWaveCluster: { // Sub item of a cluster DB system node.
                const details = data.dataModelEntry.parent.details;
                image = Assets.oci.computeIcon;
                let overlayImage: string | undefined = Assets.overlay.statusDotOrange; // Assume it's not active.
                const overlayImageMask = Assets.overlay.statusDotMask;

                if (details.heatWaveCluster) {
                    // Side note: there's no enum defined for the HW cluster lifecycle state.
                    if (details.heatWaveCluster.lifecycleState === "ACTIVE") {
                        overlayImage = undefined;
                    } else if (details.heatWaveCluster.lifecycleState === "INACTIVE" ||
                        details.heatWaveCluster.lifecycleState === "FAILED") {
                        overlayImage = Assets.overlay.statusDotRed;
                    }
                }

                if (overlayImage) {
                    overlays.push({ icon: overlayImage, mask: overlayImageMask });
                }

                break;
            }

            case OciDmEntityType.LoadBalancer: {
                image = Assets.oci.loadBalancerIcon;
                const details = data.dataModelEntry.details;

                if (details.lifecycleState !== LoadBalancer.LifecycleState.Active) {
                    overlays.push({ icon: Assets.overlay.statusDotOrange, mask: Assets.overlay.statusDotMask });
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
                overlays={overlays}
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
                void ui.showWarningMessage("Not implemented yet.", {});
                break;
            }

            case "msg.mds.refreshOciProfiles": {
                const context = this.context as DocumentContextType;
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
        const { onSaveState, savedSectionState = new Map<string, IDocumentSideBarSectionState>() } = this.props;

        const sectionState = savedSectionState?.get(sectionId) ?? {};
        sectionState.expanded = expanded;

        savedSectionState.set(sectionId, sectionState);

        onSaveState?.(savedSectionState);
    };

    private handleSectionResize = (_props: IAccordionProperties, info: ISplitterPaneSizeInfo[]): void => {
        const { onSaveState, savedSectionState } = this.props;

        const newMap = savedSectionState ? new Map(savedSectionState) : new Map<string, IDocumentSideBarSectionState>();
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

        if (data.dataModelEntry.type === CdmEntityType.ConnectionGroup) {
            switch (command.command) {
                case "msg.addSubFolder": {
                    void onConnectionTreeCommand?.(command, data.dataModelEntry).then(() => {
                        void this.refreshConnectionTreeEntryChildren(data.dataModelEntry, true);
                    });

                    break;
                }

                case "msg.editFolder": {
                    void onConnectionTreeCommand?.(command, data.dataModelEntry).then(() => {
                        void this.refreshConnectionParentEntry(data, true);
                    });

                    break;
                }

                case "msg.removeFolder": {
                    void onConnectionTreeCommand?.(command, data.dataModelEntry).then(() => {
                        void this.refreshConnectionParentEntry(data, true);
                    });

                    break;
                }

                default:
            }
        } else {
            switch (command.command) {
                case "msg.mrs.configureMySQLRestService": {
                    void onConnectionTreeCommand?.(command, data.dataModelEntry).then(() => {
                        void this.refreshConnectionTreeEntryChildren(data.dataModelEntry, true);
                    });

                    break;
                }

                case "msg.hideSystemSchemasOnConnection":
                case "msg.showSystemSchemasOnConnection": {
                    const connection = data.dataModelEntry as ICdmConnectionEntry;
                    connection.state.payload ??= {};
                    connection.state.payload.showSystemSchemas =
                        (command.command === "msg.showSystemSchemasOnConnection");
                    void this.refreshConnectionTreeEntryChildren(data.dataModelEntry, true);

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
                            const mrsRoot = (data.dataModelEntry as ConnectionDataModelNoGroupEntry)
                                .connection.mrsEntry;
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
                            const mrsRoot = (data.dataModelEntry as ConnectionDataModelNoGroupEntry)
                                .connection.mrsEntry;
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


                case "msg.createLibraryFrom": {
                    void onConnectionTreeCommand?.(command, data.dataModelEntry).then((result) => {
                        if (result.success) {
                            void this.refreshConnectionTreeEntryChildren(data.dataModelEntry, true, true);
                        }
                    });

                    break;
                }

                default: {
                    void onConnectionTreeCommand?.(command, data.dataModelEntry, data.qualifiedName);
                }
            }
        }

        return true;
    };

    private handleMrsContextMenuItemClick = async (props: IMenuItemProperties, altActive: boolean,
        payload: unknown): Promise<boolean> => {

        const { onConnectionTreeCommand } = this.props;

        const entry = payload as IConnectionTreeItem;
        const command = altActive && props.altCommand ? props.altCommand : props.command;

        const tree = this.connectionTableRef.current;
        const dataModelEntry = entry.dataModelEntry as ConnectionDataModelNoGroupEntry;

        try {
            switch (command.command) {
                case "msg.mrs.configureMySQLRestService": {
                    void onConnectionTreeCommand?.(command, entry.dataModelEntry).then(() => {
                        void this.refreshConnectionTreeEntryChildren(entry.dataModelEntry, true);
                    });
                    break;
                }

                case "msg.mrs.addAuthApp":
                case "msg.mrs.linkAuthApp": {
                    void onConnectionTreeCommand(command, dataModelEntry).then((done) => {
                        if (done) {
                            void this.refreshConnectionTreeEntryChildren(dataModelEntry, true).then(() => {
                                if (command.command === "msg.mrs.addAuthApp"
                                    && dataModelEntry.type === CdmEntityType.MrsService) {
                                    // If the command was sent from a service, refresh also the list of auth apps.
                                    void this.refreshConnectionTreeEntryChildren(
                                        dataModelEntry.parent.authAppGroup, true);
                                }
                            });
                        }
                    });

                    break;
                }

                case "msg.mrs.addService": {
                    void onConnectionTreeCommand(command, dataModelEntry).then((done) => {
                        if (done) {
                            const mrsRoot = dataModelEntry as ICdmRestRootEntry;
                            void this.refreshConnectionTreeEntryChildren(mrsRoot, true).then(() => {
                                void this.refreshConnectionTreeEntryChildren(mrsRoot.routerGroup, true, true);
                            });
                        }
                    });

                    break;
                }

                case "msg.mrs.enableMySQLRestService":
                case "msg.mrs.disableMySQLRestService": {
                    void onConnectionTreeCommand(command, dataModelEntry).then((done) => {
                        if (done) {
                            void this.refreshTreeEntry(tree, dataModelEntry, true);
                        }

                        // There's no need to update the routers group, as they only contain published services
                        // which don't show the enabled state.
                    });

                    break;
                }

                case "msg.mrs.showPrivateItems":
                case "msg.mrs.hidePrivateItems": {
                    const mrsRoot = dataModelEntry as ICdmRestRootEntry;
                    mrsRoot.showPrivateItems = command.command === "msg.mrs.showPrivateItems";
                    void this.refreshConnectionTreeEntryChildren(dataModelEntry, false, true);

                    break;
                }

                case "msg.mrs.editService": {
                    const done = await onConnectionTreeCommand(command, dataModelEntry);
                    if (done) {
                        // Update the entire services list, as we can have a changed default state.
                        const mrsService = entry.dataModelEntry as ICdmRestServiceEntry;
                        await this.refreshTreeEntry(tree, mrsService, true);
                        await this.refreshConnectionTreeEntryChildren(mrsService.parent, true);

                        // Then update also the router nodes, as we may have changed the
                        // publication state of a service.
                        const routers = mrsService.parent.routerGroup.routers;
                        routers.forEach((router) => {
                            void this.refreshConnectionTreeEntryChildren(router, true);
                        });

                        // And the service entry itself needs an update.
                        await this.refreshConnectionTreeEntryChildren(mrsService, false);
                    }

                    break;
                }

                case "msg.mrs.deleteService": {
                    void onConnectionTreeCommand(command, dataModelEntry).then((done) => {
                        if (done) {
                            const service = dataModelEntry as ICdmRestServiceEntry;
                            void this.refreshConnectionTreeEntryChildren(service.parent, true).then(() => {
                                void this.refreshConnectionTreeEntryChildren(service.parent.routerGroup, true, true);
                            });
                        }
                    });
                    break;
                }

                case "msg.mrs.setCurrentService":
                case "msg.mrs.deleteSchema":
                case "msg.mrs.deleteDbObject":
                case "msg.mrs.editDbObject":
                case "msg.mrs.deleteUser": {
                    void onConnectionTreeCommand(command, dataModelEntry).then((done) => {
                        if (done) {
                            void this.refreshConnectionParentEntry(entry, true);
                        }
                    });

                    break;
                }

                case "msg.mrs.editSchema": {
                    const mrsSchema = dataModelEntry as ICdmRestSchemaEntry;
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
                                void this.refreshTreeEntry(tree, dataModelEntry, true);
                            }
                        }
                    });

                    break;
                }

                case "msg.mrs.editAuthApp": {
                    void onConnectionTreeCommand(command, dataModelEntry).then((done) => {
                        if (done) {
                            void this.refreshTreeEntry(tree, dataModelEntry, true);

                            // Also refresh all MRS services, as the app may have been linked to a service.
                            const authApp = dataModelEntry as ICdmRestAuthAppEntry;
                            void this.refreshConnectionTreeEntryChildren(authApp.parent.parent, true,
                                true);
                        }
                    });

                    break;
                }

                case "msg.mrs.editUser": {
                    void onConnectionTreeCommand(command, dataModelEntry).then((done) => {
                        if (done) {
                            void this.refreshTreeEntry(tree, dataModelEntry, true);
                        }
                    });

                    break;
                }

                case "msg.mrs.deleteAuthApp": {
                    void onConnectionTreeCommand(command, dataModelEntry).then((done) => {
                        if (done) {
                            void this.refreshConnectionParentEntry(entry, true).then(() => {
                                const authApp = dataModelEntry as ICdmRestAuthAppEntry;
                                void this.refreshConnectionTreeEntryChildren(authApp.parent.parent, true, true);
                            });
                        }
                    });

                    break;
                }

                case "msg.mrs.unlinkAuthApp": {
                    void onConnectionTreeCommand(command, dataModelEntry).then((done) => {
                        if (done) {
                            void this.refreshConnectionParentEntry(entry, true);
                        }
                    });

                    break;
                }

                case "msg.mrs.addUser": {
                    void onConnectionTreeCommand(command, dataModelEntry).then((done) => {
                        if (done) {
                            void this.refreshConnectionTreeEntryChildren(entry.dataModelEntry, true);
                        }
                    });

                    break;
                }

                case "msg.mrs.linkToService": {
                    void onConnectionTreeCommand(command, dataModelEntry).then((done) => {
                        if (done) {
                            // Linking to a service means to refresh the service children. At this point we don't
                            // know the service the app was linked to, so refresh all MRS services.
                            const authApp = dataModelEntry as ICdmRestAuthAppEntry;
                            authApp.parent.parent.services.forEach((service) => {
                                void this.refreshConnectionTreeEntryChildren(service, true);
                            });
                        }
                    });

                    break;
                }

                default: {
                    void onConnectionTreeCommand(command, dataModelEntry);
                }
            }
        } catch (error) {
            const message = convertErrorToString(error);
            void ui.showErrorMessage(`Error while running command: ${command.command}. ${message}`, {});
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
                            const context = this.context as DocumentContextType;
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
            void ui.showErrorMessage(`Error while running command: ${command.command}. ${message}`, {});
        }

        return true;
    };

    /**
     * Triggered when one specific or all top level connections need to be refreshed.
     * Refreshing the top level connections also means to refresh all top level groups.
     *
     * @param connection The connection to refresh. If not provided, the top level connections are refreshed.
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
     * Triggered when one specific or all top level groups need to be refreshed.
     * Refreshing the top level groups also means to refresh all top level connections.
     *
     * @param data Details of the connection group to refresh.
     *
     * @returns A promise that resolves to `true`.
     */
    private refreshConnectionGroup = async (data?: IFolderPath): Promise<boolean> => {
        if (data?.id !== undefined && data.id >= 0) {
            const context = this.context as DocumentContextType;
            if (context) {
                const group = await context.connectionsDataModel.findConnectionGroupEntryById(data.id, data.caption);
                if (group) {
                    await this.refreshConnectionTreeEntryChildren(group, true);
                }
            }
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
    private renderConnectionsTree(connections: Array<ICdmConnectionEntry | ICdmConnectionGroupEntry>): ComponentChild {
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
                ref={this.connectionTableRef}
                options={connectionTreeOptions}
                columns={connectionTreeColumns}

                onRowSelected={this.handleConnectionTreeRowSelected}
                onRowExpanded={this.handleConnectionTreeRowExpanded}
                onRowCollapsed={this.handleConnectionTreeRowCollapsed}
                isRowExpanded={this.isConnectionTreeRowExpanded}
                onRowContext={this.handleConnectionTreeRowContext} />;

        return connectionSectionContent;
    }

    private connectionDataModelChanged = (list: Readonly<ConnectionDMActionList>): void => {

        if (this.refreshRunning) {
            return;
        }

        const tree = this.connectionTableRef.current;
        list.forEach((action) => {
            switch (action.action) {
                case "add": {
                    if (action.entry?.parent) {
                        void this.refreshConnectionTreeEntryChildren(action.entry.parent, false);
                    }

                    break;
                }

                case "remove": {
                    if (action.entry?.type === CdmEntityType.Connection) {
                        requisitions.executeRemote("connectionRemoved", action.entry.details);
                    }

                    if (action.entry?.parent) {
                        void this.refreshConnectionTreeEntryChildren(action.entry.parent, false);
                    }

                    break;
                }

                case "update": {
                    if (action.entry) {
                        switch (action.entry.type) {
                            case CdmEntityType.Connection: {
                                void this.refreshTreeEntry(tree, action.entry, false);
                                void this.refreshConnectionTreeEntryChildren(action.entry, false);

                                break;
                            }

                            case CdmEntityType.ConnectionGroup: {
                                void this.refreshExpandedConnectionGroupTreeEntries(action.entry);

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
                ref={this.documentTableRef}
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
            ref={this.ociTableRef}
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
        const context = this.context as DocumentContextType;
        if (!context) {
            return;
        }

        const [treeItems, changed] = this.updateRootTreeItems(context);

        if (changed) {
            void this.updateConnectionTreeItems();

            if (this.documentTableRef.current) {
                void this.documentTableRef.current.setData(treeItems.openDocumentTreeItems, SetDataAction.Replace);
            }

            if (this.ociTableRef.current) {
                void this.ociTableRef.current.setData(treeItems.ociTreeItems, SetDataAction.Replace);
            }

            this.setState({ treeItems });
        }
    }

    private updateRootTreeItems(context: DocumentContextType): [ISideBarTreeItems, boolean] {
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
        context.connectionsDataModel.roots.forEach((connection, index) => {
            if (index >= connectionTreeItems.length || connectionTreeItems[index].dataModelEntry !== connection) {
                changed = true;
                connectionTreeItems[index] = {
                    id: connection.id,
                    dataModelEntry: connection,
                    caption: connection.caption,
                    qualifiedName: {},
                    children: [],
                };
            } else {
                if (connectionTreeItems[index].caption !== connection.caption) {
                    changed = true;
                    connectionTreeItems[index].caption = connection.caption;
                }
            }
        });

        if (connectionTreeItems.length > context.connectionsDataModel.roots.length) {
            changed = true;
            connectionTreeItems.splice(context.connectionsDataModel.roots.length);
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
            // If the parent is the invisible root entry, we need to refresh the entire tree.
            const parent = item.dataModelEntry.parent;
            if (parent && ("folderPath" in parent) && parent.folderPath?.id === 1) {
                await parent.refresh?.(); // Will trigger componentDidUpdate to refresh the root nodes.
            } else if (parent) {
                await this.refreshConnectionTreeEntryChildren(parent, needRefresh);
            }
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
            try {
                ++this.refreshRunning;
                await entry.refresh?.();
            } finally {
                --this.refreshRunning;
            }
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
     * @param recursive Whether to update the children recursively.
     */
    private async refreshConnectionTreeEntryChildren(entry: ConnectionDataModelEntry,
        needRefresh: boolean, recursive: boolean = false): Promise<void> {

        const table = this.connectionTableRef.current;
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
            this.connectionSectionRef.current!.showProgress = true;
        }, 200);

        if (needRefresh) {
            try {
                ++this.refreshRunning;
                await entry.refresh?.((result?: string | Error) => {
                    if (result instanceof Error) {
                        void ui.showErrorMessage(convertErrorToString(result), {});
                    } else if (typeof result === "string") {
                        void ui.setStatusBarMessage(result, 15000);
                    }
                });

                clearTimeout(timer);
                this.connectionSectionRef.current!.showProgress = false;
            } catch (error) {
                clearTimeout(timer);
                this.connectionSectionRef.current!.showProgress = false;
                void ui.showErrorMessage(convertErrorToString(error), {});

                return;
            } finally {
                --this.refreshRunning;
            }
        }

        let children = entry.getChildren?.();

        try {
            table.beginUpdate();
            let generator = this.generateConnectionTreeChild.bind(this, schemaName, tableName);

            switch (entry.type) {
                case CdmEntityType.ConnectionGroup: {
                    if (data.dataModelEntry.state.expandedOnce) {
                        const foldersFirst = Settings.get("dbEditor.connectionBrowser.sortFoldersFirst", true);
                        if (foldersFirst) {
                            const sorted = Array.from(children ?? []);
                            this.sortConnectionGroupItems(sorted);
                            await this.diffTreeEntries(row, generator, recursive, sorted);
                        } else {
                            await this.diffTreeEntries(row, generator, recursive, children);
                        }
                    }

                    break;
                }

                case CdmEntityType.Connection: {
                    if (data.dataModelEntry.state.expandedOnce) {
                        if (children && !data.dataModelEntry.state.payload?.showSystemSchemas) {
                            // Remove all system schemas from the child list.
                            children = children.filter((schema) => {
                                return !systemSchemas.has(schema.caption);
                            });
                        }

                        await this.diffTreeEntries(row, generator, recursive, children);
                    }

                    break;
                }

                case CdmEntityType.Schema:
                case CdmEntityType.SchemaGroup: {
                    await this.diffTreeEntries(row, generator, recursive, children);

                    break;
                }

                case CdmEntityType.TableGroup:
                case CdmEntityType.Table: {

                    await this.diffTreeEntries(row, generator, recursive, children);

                    break;
                }

                case CdmEntityType.MrsSchema: {
                    generator = this.generateConnectionTreeChild.bind(this, entry.caption, undefined);
                    await this.diffTreeEntries(row, generator, recursive, children);

                    break;
                }

                default: {
                    await this.diffTreeEntries(row, generator, recursive, children);
                }
            }

            if (recursive && children) {
                for (const child of children) {
                    await this.refreshConnectionTreeEntryChildren(child, true, child.state.expandedOnce);
                }
            }
        } finally {
            table.endUpdate();

            clearTimeout(timer);
            this.connectionSectionRef.current!.showProgress = false;
        }
    }

    /**
     * Updates all child tree items of type connection group recursively, starting with the given entry.
     *
     * @param entry The item to update.
     */
    private async refreshExpandedConnectionGroupTreeEntries(entry: ConnectionDataModelEntry): Promise<void> {
        if (!entry.state.expandedOnce) {
            return;
        }

        const table = this.connectionTableRef.current;
        const rows = table?.searchAllRows("id", entry.id);
        if (!table || !rows || rows?.length === 0) {
            return;
        }

        const row = rows[0];

        // If initializing takes longer that the timer runs, show a progress indicator.
        const timer = setTimeout(() => {
            this.connectionSectionRef.current!.showProgress = true;
        }, 200);

        try {
            ++this.refreshRunning;
            await entry.refresh?.((result?: string | Error) => {
                if (result instanceof Error) {
                    void ui.showErrorMessage(convertErrorToString(result), {});
                } else if (typeof result === "string") {
                    void ui.setStatusBarMessage(result, 15000);
                }
            });

            clearTimeout(timer);
            this.connectionSectionRef.current!.showProgress = false;
        } catch (error) {
            clearTimeout(timer);
            this.connectionSectionRef.current!.showProgress = false;
            void ui.showErrorMessage(convertErrorToString(error), {});

            return;
        } finally {
            --this.refreshRunning;
        }

        const children = entry.getChildren?.();

        try {
            table.beginUpdate();
            const generator = this.generateConnectionTreeChild.bind(this, undefined, undefined);
            await this.diffTreeEntries(row, generator, true, children);

            if (children) {
                for (const child of children) {
                    if (child.type === CdmEntityType.ConnectionGroup) {
                        await this.refreshExpandedConnectionGroupTreeEntries(child);
                    }
                }
            }
        } finally {
            table.endUpdate();

            clearTimeout(timer);
            this.connectionSectionRef.current!.showProgress = false;
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

        const table = this.documentTableRef.current;
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
                    await this.diffTreeEntries(row, this.generateTreeItem, false, entry.getChildren?.());

                    break;
                }

                default:
            }
        } catch (error) {
            const message = convertErrorToString(error);
            void ui.showErrorMessage(`Failed to refresh tree entries: ${message}`, {});
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

        const table = this.ociTableRef.current;
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
                    await this.diffTreeEntries(row, generator, false, entry.getChildren?.());

                    break;
                }

                case OciDmEntityType.Bastion: {
                    await this.diffTreeEntries(row, generator, false, entry.getChildren?.());

                    break;
                }

                default:
            }
        } catch (error) {
            const message = convertErrorToString(error);
            void ui.showErrorMessage(`Failed to refresh tree entries: ${message}`, {});
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
     * @param recursive Whether to update the children recursively.
     * @param entries The entries to compare.
     */
    private async diffTreeEntries<T extends IDataModelBaseEntry>(row: RowComponent,
        generator: TreeItemGenerator<T>, recursive: boolean, entries?: T[]): Promise<void> {

        const data = row.getData() as IBaseTreeItem<T>;
        if (!entries) {
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

        // Removing all child entries will remove the "children" property from the tree item, making it so
        // a leaf node, which is wrong.
        if (existingTreeItems.length === 0 && !data.dataModelEntry.state.isLeaf) {
            data.children = [];
            await row.update(data);
        }

        const newList: T[] = [];

        for (const entry of entries) {
            // Check if the data model entry already exists in the list of tree items.
            const item = existingTreeItems.find((child) => {
                const data = child.getData() as IBaseTreeItem<T>;

                return data.dataModelEntry === entry;
            });

            if (item) {
                const data = item.getData() as IBaseTreeItem<T>;
                data.caption = entry.caption;
                newList.push(data.dataModelEntry);

                // Diff children if the entry was expanded once.
                if (data.dataModelEntry.state.expandedOnce && recursive) {
                    await this.diffTreeEntries(item, generator, true, entry.getChildren?.() as T[]);
                }
            } else {
                newList.push(entry);
            }
        }

        // Replace the list of tree items with the new one.
        for (const entry of existingTreeItems.reverse()) {
            await entry.delete();
        }

        for (const entry of newList) {
            const child = generator(entry);
            row.addTreeChild(child);
        }

        // Re-expand the parent row if it was expanded before.
        if (data.dataModelEntry.state.expanded) {
            row.treeExpand();
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
        const table = this.connectionTableRef.current;
        if (!table) {
            return;
        }

        const rows = table.getRows();
        rows.forEach((row) => {
            row.treeCollapse();
        });
    }

    private sortConnectionTreeItems(items: IConnectionTreeItem[]): void {
        items.sort((a, b) => {
            const leftItem = a.dataModelEntry;
            const rightItem = b.dataModelEntry;
            if (leftItem.type === CdmEntityType.ConnectionGroup
                && rightItem.type !== CdmEntityType.ConnectionGroup) {
                return -1;
            }

            if (leftItem.type !== CdmEntityType.ConnectionGroup
                && rightItem.type === CdmEntityType.ConnectionGroup) {
                return 1;
            }

            return 0;
        });
    }

    private sortConnectionGroupItems(items: ConnectionDataModelEntry[]): void {
        items.sort((a, b) => {
            return (b.type === CdmEntityType.ConnectionGroup ? 1 : 0) -
                (a.type === CdmEntityType.ConnectionGroup ? 1 : 0);
        });
    }

    /**
     * Updates the connection tree items in the connection table (sorted or not).
     */
    private async updateConnectionTreeItems(): Promise<void> {
        const { treeItems } = this.state;

        if (this.connectionTableRef.current) {
            const foldersFirst = Settings.get("dbEditor.connectionBrowser.sortFoldersFirst", true);
            if (foldersFirst) {
                const sortedItems = Array.from(treeItems.connectionTreeItems);
                this.sortConnectionTreeItems(sortedItems);
                await this.connectionTableRef.current.setData(sortedItems, SetDataAction.Replace);
            } else {
                await this.connectionTableRef.current.setData(treeItems.connectionTreeItems, SetDataAction.Replace);
            }
        }
    }

    private handleSettingsChanged = (entry?: { key: string; value: unknown; }): Promise<boolean> => {
        if (entry?.key === "dbEditor.connectionBrowser.sortFoldersFirst") {
            void this.updateConnectionTreeItems();

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

}
