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

import { Event, EventEmitter, TreeDataProvider, TreeItem, window } from "vscode";

import {
    IEditorCloseChangeData, IEditorOpenChangeData, IRequestListEntry, IRequestTypeMap, IWebviewProvider, requisitions,
} from "../../../../frontend/src/supplement/Requisitions.js";

import { DBType, IConnectionDetails } from "../../../../frontend/src/supplement/ShellInterface/index.js";
import { ShellInterfaceSqlEditor } from "../../../../frontend/src/supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { webSession } from "../../../../frontend/src/supplement/WebSession.js";

import { ISqliteConnectionOptions } from "../../../../frontend/src/communication/Sqlite.js";
import { SchemaGroupTreeItem } from "./SchemaGroupTreeItem.js";
import { SchemaItemGroupType } from "./SchemaIndex.js";
import { SchemaMySQLTreeItem } from "./SchemaMySQLTreeItem.js";

import { IDictionary } from "../../../../frontend/src/app-logic/Types.js";
import { ShellInterface } from "../../../../frontend/src/supplement/ShellInterface/ShellInterface.js";
import { uuid } from "../../../../frontend/src/utilities/helpers.js";
import { compareVersionStrings } from "../../../../frontend/src/utilities/string-helpers.js";
import { showStatusText } from "../../extension.js";
import { showMessageWithTimeout } from "../../utilities.js";
import { openSqlEditorConnection } from "../../utilitiesShellGui.js";
import { AdminSectionTreeItem } from "./AdminSectionTreeItem.js";
import { AdminTreeItem } from "./AdminTreeItem.js";
import { ConnectionMySQLTreeItem } from "./ConnectionMySQLTreeItem.js";
import { ConnectionSqliteTreeItem } from "./ConnectionSqliteTreeItem.js";
import {
    ConnectionsTreeDataModelEntry, ICdmConnectionEntry, ICdmRestAuthAppEntry, ICdmRestContentSetEntry,
    ICdmRestRootEntry, ICdmRestRouterEntry, ICdmRestSchemaEntry, ICdmRestServiceEntry,
    ICdmSchemaEntry, ICdmSchemaGroupEntry, ICdmTableGroupEntry,
} from "./ConnectionsTreeDataModel.js";
import { MrsAuthAppTreeItem } from "./MrsAuthAppTreeItem.js";
import { MrsContentFileTreeItem } from "./MrsContentFileTreeItem.js";
import { MrsContentSetTreeItem } from "./MrsContentSetTreeItem.js";
import { MrsDbObjectTreeItem } from "./MrsDbObjectTreeItem.js";
import { MrsRouterTreeItem } from "./MrsRouterTreeItem.js";
import { MrsSchemaTreeItem } from "./MrsSchemaTreeItem.js";
import { MrsServiceTreeItem } from "./MrsServiceTreeItem.js";
import { MrsTreeItem } from "./MrsTreeItem.js";
import { MrsUserTreeItem } from "./MrsUserTreeItem.js";
import { SchemaEventTreeItem } from "./SchemaEventTreeItem.js";
import { SchemaRoutineMySQLTreeItem } from "./SchemaRoutineMySQLTreeItem.js";
import { SchemaRoutineTreeItem } from "./SchemaRoutineTreeItem.js";
import { SchemaSqliteTreeItem } from "./SchemaSqliteTreeItem.js";
import { SchemaTableColumnTreeItem } from "./SchemaTableColumnTreeItem.js";
import { SchemaTableForeignKeyTreeItem } from "./SchemaTableForeignKeyTreeItem.js";
import { TableGroupTreeItem } from "./SchemaTableGroupTreeItem.js";
import { SchemaTableIndexTreeItem } from "./SchemaTableIndexTreeItem.js";
import { SchemaTableMySQLTreeItem } from "./SchemaTableMySQLTreeItem.js";
import { SchemaTableSqliteTreeItem } from "./SchemaTableSqliteTreeItem.js";
import { SchemaTableTriggerTreeItem } from "./SchemaTableTriggerTreeItem.js";
import { SchemaViewMySQLTreeItem } from "./SchemaViewMySQLTreeItem.js";
import { SchemaViewSqliteTreeItem } from "./SchemaViewSqliteTreeItem.js";
import { DBConnectionViewProvider } from "../../WebviewProviders/DBConnectionViewProvider.js";
import { MrsDbObjectType } from "../../../../frontend/src/modules/mrs/types.js";
import { MrsRouterServiceTreeItem } from "./MrsRouterServiceTreeItem.js";

/** A class to provide the entire tree structure for DB editor connections and the DB objects from them. */
export class ConnectionsTreeDataProvider implements TreeDataProvider<ConnectionsTreeDataModelEntry> {
    // A running number to identify uniquely every connection entry.
    private static nextId = 1;

    public connections: ICdmConnectionEntry[] = [];

    // List to keep track of visible MrsTreeItems
    private expandedMrsTreeItems = new Set<ICdmRestRootEntry>();

    private changeEvent = new EventEmitter<ConnectionsTreeDataModelEntry | undefined>();
    private refreshMrsRoutersTimer: ReturnType<typeof setTimeout> | null = null;
    private requiredRouterVersion?: string;

    // When set a timer will be started to remove all current schemas from the tree.
    private clearCurrentSchemas = false;

    // Make sure the same error is not displayed again and again
    #errorAlreadyDisplayed = false;

    public get onDidChangeTreeData(): Event<ConnectionsTreeDataModelEntry | undefined> {
        return this.changeEvent.event;
    }

    public constructor() {
        // A connection refresh request can be scheduled from the frontend or within the extension.
        requisitions.register("refreshConnections", this.refreshConnections);
        requisitions.register("proxyRequest", this.proxyRequest);
    }

    public dispose(): void {
        if (this.refreshMrsRoutersTimer !== null) {
            clearTimeout(this.refreshMrsRoutersTimer);
            this.refreshMrsRoutersTimer = null;
        }
        requisitions.unregister("refreshConnections", this.refreshConnections);
        requisitions.unregister("proxyRequest", this.proxyRequest);

        void this.closeAllConnections();
    }

    public refresh(entry?: ConnectionsTreeDataModelEntry): void {
        if (!entry) {
            void this.updateConnections().then(() => {
                this.changeEvent.fire(entry);

                // Start the Router refresh timer
                if (this.refreshMrsRoutersTimer === null) {
                    this.refreshMrsRouters();
                }

                void requisitions.execute("connectionsUpdated", undefined);
            });
        } else {
            this.changeEvent.fire(entry);
        }
    }

    /**
     * Updates the current schema when the user switches between different providers (that is, different app tabs).
     *
     * @param provider The provider that has changed its visibility state.
     * @param active Indicates whether the provider is now active or not.
     */
    public providerStateChanged(provider: DBConnectionViewProvider, active: boolean): void {
        if (active) {
            // A provider is now active, so update the current schemas for all connections.
            this.clearCurrentSchemas = false;
            const currentSchemas = provider.currentSchemas;
            this.connections.forEach((connection) => {
                connection.currentSchema = currentSchemas.get(connection.treeItem.details.id) ?? "";
            });

            this.changeEvent.fire(undefined);
        } else {
            // A provider is no longer active, so remove all current schemas from the connection tree
            // (after a short delay to allow for switching between providers).
            this.clearCurrentSchemas = true;
            setTimeout(() => {
                if (this.clearCurrentSchemas) {
                    this.clearCurrentSchemas = false;
                    this.resetCurrentSchemas();
                }
            }, 300);
        }
    }

    public makeCurrentSchema(entry: ICdmSchemaEntry): void {
        entry.parent.currentSchema = entry.treeItem.schema;
        this.changeEvent.fire(entry.parent);
    }

    public resetCurrentSchemas(): void {
        this.connections.forEach((connection) => {
            connection.currentSchema = "";
        });
        this.changeEvent.fire(undefined);
    }

    public getTreeItem(entry: ConnectionsTreeDataModelEntry): TreeItem {
        return entry.treeItem;
    }

    public getParent(entry: ConnectionsTreeDataModelEntry): ConnectionsTreeDataModelEntry | undefined {
        if ("parent" in entry) {
            return entry.parent;
        }

        return undefined;
    }

    public async getChildren(entry?: ConnectionsTreeDataModelEntry): Promise<ConnectionsTreeDataModelEntry[]> {
        if (!entry) {
            return this.connections;
        }

        switch (entry.type) {
            case "connection": {
                const entries: ConnectionsTreeDataModelEntry[] = [];
                await this.updateSchemaList(entry);

                if (entry.mrsEntry !== undefined) {
                    entries.push(entry.mrsEntry);
                }

                if (entry.adminEntry !== undefined) {
                    entries.push(entry.adminEntry);
                }

                entries.push(...entry.schemaEntries);

                return entries;
            }

            case "admin": {
                const serverStatusCommand = {
                    title: "Show Server Status",
                    command: "msg.showServerStatus",
                    // The first argument is undefined to show the page on the currently selected connection.
                    arguments: [undefined, "Server Status", entry.treeItem.connectionId, uuid()],
                };

                const clientConnectionsCommand = {
                    title: "Show Client Connections",
                    command: "msg.showClientConnections",
                    arguments: [undefined, "Client Connections", entry.treeItem.connectionId, uuid()],
                };

                const performanceDashboardCommand = {
                    title: "Show Performance Dashboard",
                    command: "msg.showPerformanceDashboard",
                    arguments: [undefined, "Performance Dashboard", entry.treeItem.connectionId, uuid()],
                };

                const lakehouseNavigatorCommand = {
                    title: "Show Lakehouse Navigator",
                    command: "msg.showLakehouseNavigator",
                    arguments: [undefined, "Lakehouse Navigator", entry.treeItem.connectionId, uuid()],
                };

                const item = entry.treeItem;
                entry.sections = [
                    {
                        parent: entry,
                        type: "adminSection",
                        treeItem: new AdminSectionTreeItem("Server Status", item.backend, item.connectionId,
                            "adminServerStatus.svg", false, serverStatusCommand),
                    },
                    {
                        parent: entry,
                        type: "adminSection",
                        treeItem: new AdminSectionTreeItem("Client Connections", item.backend, item.connectionId,
                            "clientConnections.svg", false, clientConnectionsCommand),
                    },
                    {
                        parent: entry,
                        type: "adminSection",
                        treeItem: new AdminSectionTreeItem("Performance Dashboard", item.backend, item.connectionId,
                            "adminPerformanceDashboard.svg", false, performanceDashboardCommand),
                    },
                    {
                        parent: entry,
                        type: "adminSection",
                        treeItem: new AdminSectionTreeItem("Lakehouse Navigator", item.backend, item.connectionId,
                            "lakehouseNavigator.svg", false, lakehouseNavigatorCommand),
                    },
                ];

                return entry.sections;
            }

            case "schema": {
                const item = entry.treeItem;
                entry.groups = [
                    {
                        parent: entry,
                        type: "schemaMemberGroup",
                        treeItem: new SchemaGroupTreeItem(item.schema, item.backend, item.connectionId,
                            SchemaItemGroupType.Tables),
                        members: [],
                    },
                    {
                        parent: entry,
                        type: "schemaMemberGroup",
                        treeItem: new SchemaGroupTreeItem(item.schema, item.backend, item.connectionId,
                            SchemaItemGroupType.Views),
                        members: [],
                    },
                ];

                if (entry.parent.treeItem.details.dbType === DBType.MySQL) {
                    entry.groups.push({
                        parent: entry,
                        type: "schemaMemberGroup",
                        treeItem: new SchemaGroupTreeItem(item.schema, item.backend, item.connectionId,
                            SchemaItemGroupType.Routines),
                        members: [],
                    },
                        {
                            parent: entry,
                            type: "schemaMemberGroup",
                            treeItem: new SchemaGroupTreeItem(item.schema, item.backend, item.connectionId,
                                SchemaItemGroupType.Events),
                            members: [],
                        });
                }

                return entry.groups;
            }

            case "schemaMemberGroup": {
                await this.loadSchemaGroupMembers(entry);

                return entry.members;
            }

            case "table": {
                const item = entry.treeItem;
                entry.groups = [];

                for (const type of [
                    SchemaItemGroupType.Columns, SchemaItemGroupType.Indexes,
                    SchemaItemGroupType.ForeignKeys, SchemaItemGroupType.Triggers,
                ]) {
                    entry.groups.push(
                        {
                            parent: entry,
                            type: "tableMemberGroup",
                            treeItem: new TableGroupTreeItem(item.schema, item.name, item.backend, item.connectionId,
                                type),
                            members: [],
                        },
                    );
                }

                return entry.groups;
            }

            case "tableMemberGroup": {
                await this.loadTableMembers(entry);

                return entry.members;
            }

            case "mrs": {
                await this.loadMrsServices(entry);

                return [...entry.services, ...entry.routers];
            }

            case "mrsService": {
                await this.loadMrsServiceEntries(entry);

                return [...entry.schemas, ...entry.contentSets, ...entry.authApps];
            }

            case "mrsAuthApp": {
                await this.loadMrsAuthAppUsers(entry);

                return entry.users;
            }

            case "mrsContentSet": {
                await this.loadMrsContentSetFiles(entry);

                return entry.files;
            }

            case "mrsSchema": {
                await this.loadMrsDbObjects(entry);

                return entry.dbObjects;
            }

            case "mrsRouter": {
                await this.loadMrsRouterServices(entry);

                return entry.services;
            }

            default: {
                return Promise.resolve([]);
            }
        }
    }

    public async closeAllConnections(): Promise<void> {
        for (const entry of this.connections) {
            await entry.treeItem.backend.closeSession().catch(() => { /**/ });
        }

        this.connections = [];
    }

    /**
     * When assigned to the TreeView.onDidExpandElement it updates the list of expanded MrsTreeView nodes.
     *
     * @param entry The tree entry that got expanded.
     */
    public readonly didExpandElement = (entry: ConnectionsTreeDataModelEntry): void => {
        if (entry.type === "mrs") {
            this.expandedMrsTreeItems.add(entry);
        }
    };

    /**
     * When assigned to the TreeView.onDidCollapseElement it updates the list of expanded MrsTreeView nodes.
     *
     * @param entry The tree entry that got collapsed.
     */
    public readonly didCollapseElement = (entry: ConnectionsTreeDataModelEntry): void => {
        if (entry.type === "mrs") {
            this.expandedMrsTreeItems.delete(entry);
        }
    };

    /**
     * Refreshes all visible MrsTreeItems every 10 seconds to visualize MySQL Routers getting inactive.
     */
    public readonly refreshMrsRouters = (): void => {
        if (this.refreshMrsRoutersTimer !== null) {
            clearTimeout(this.refreshMrsRoutersTimer);
        }

        for (const item of this.expandedMrsTreeItems) {
            this.refresh(item);
        }

        // Start the next 10s timeout. Using a timeout here instead of an interval, as the refresh might take longer
        // than 10s and we don't want to run multiple refreshes in parallel.
        this.refreshMrsRoutersTimer = setTimeout(() => {
            this.refreshMrsRouters();
        }, 10000);
    };

    /**
     * Queries the backend for a list of stored user DB connections and updates our connection entries.
     */
    public async updateConnections(): Promise<void> {
        if (webSession.currentProfileId === -1) {
            await this.closeAllConnections();
        } else {
            try {
                const detailList = await ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId);

                // Close and remove all open connections that are no longer in the new list.
                // Sort in new connection entries on the way.
                let left = 0;  // The current index into the existing entries.
                let right = 0; // The current index into the new entries while looking for a match.
                while (left < this.connections.length && detailList.length > 0) {
                    if (this.connections[left].treeItem.details.caption === detailList[right].caption) {
                        // Entries match.
                        if (right > 0) {
                            // We had to jump over other entries to arrive here. Add those
                            // as new entries in our current list.
                            for (let i = 0; i < right; ++i) {
                                const details = detailList[i];
                                this.connections.splice(left, 0, {
                                    id: ConnectionsTreeDataProvider.nextId++,
                                    type: "connection",
                                    isOpen: false,
                                    openEditors: 0,
                                    currentSchema: "",
                                    treeItem: details.dbType === DBType.MySQL
                                        ? new ConnectionMySQLTreeItem(details, new ShellInterfaceSqlEditor())
                                        : new ConnectionSqliteTreeItem(details, new ShellInterfaceSqlEditor()),
                                    schemaEntries: [],
                                });
                            }

                            detailList.splice(0, right);
                            right = 0;
                        }

                        // Advance to the next entry.
                        ++left;
                        detailList.shift();
                    } else {
                        // Entries don't match. Check if we can find the current entry in the new
                        // list at a higher position (which would mean we have new entries before
                        // the current one).
                        while (++right < detailList.length) {
                            if (this.connections[left].treeItem.details.caption === detailList[right].caption) {
                                break;
                            }
                        }

                        if (right === detailList.length) {
                            // Current entry no longer exists. Close the session (if one is open)
                            // and remove it from the current list.
                            const entry = this.connections.splice(left, 1)[0];
                            void entry.treeItem.backend.closeSession();

                            // Reset the right index to the top of the list and keep the current
                            // index where it is (points already to the next entry after removal).
                            right = 0;
                        }
                    }
                }

                // Take over all remaining entries from the new list.
                while (detailList.length > 0) {
                    ++left;

                    const details = detailList.shift()!;
                    this.connections.push({
                        id: ConnectionsTreeDataProvider.nextId++,
                        type: "connection",
                        isOpen: false,
                        openEditors: 0,
                        currentSchema: "",
                        treeItem: details.dbType === DBType.MySQL
                            ? new ConnectionMySQLTreeItem(details, new ShellInterfaceSqlEditor())
                            : new ConnectionSqliteTreeItem(details, new ShellInterfaceSqlEditor()),
                        schemaEntries: [],
                    });
                }

                // Remove all remaining entries we haven't touched yet.
                while (left < this.connections.length) {
                    const entry = this.connections.splice(left, 1)[0];
                    await entry.treeItem.backend.closeSession();
                }
            } catch (reason) {
                void window.showErrorMessage(`Cannot load DB connections: ${String(reason)}`);

                throw reason;
            }
        }
    }

    /**
     * Updates the list of schemas for the given connection entry.
     * If no session exists yet it will be created and a connection will be opened.
     *
     * @param entry The entry of the connection.
     *
     * @returns A promise that resolves to a list of tree items for the UI.
     */
    private updateSchemaList = async (entry: ICdmConnectionEntry): Promise<void> => {
        if (entry.isOpen) {
            return this.doUpdateSchemaList(entry);
        }

        const item = entry.treeItem;
        await item.backend.startSession(String(entry.id) + "ConnectionTreeProvider");

        try {
            if (item.details.dbType === DBType.Sqlite) {
                const options = item.details.options as ISqliteConnectionOptions;

                // Before opening the connection check the DB file, if this is an sqlite connection.
                if (await ShellInterface.core.validatePath(options.dbFile)) {
                    await openSqlEditorConnection(item.backend, item.details.id, (message) => {
                        showStatusText(message);
                    });
                    entry.isOpen = true;

                    return this.doUpdateSchemaList(entry);
                } else {
                    // If the path is not ok then we might have to create the DB file first.
                    try {
                        await ShellInterface.core.createDatabaseFile(options.dbFile);

                        return this.doUpdateSchemaList(entry);
                    } catch (error) {
                        throw Error(`DB Creation Error: \n${String(error) ?? "<unknown>"}`);
                    }
                }
            } else {
                await openSqlEditorConnection(item.backend, item.details.id, (message) => {
                    showStatusText(message);
                });
                entry.isOpen = true;

                return this.doUpdateSchemaList(entry);
            }

        } catch (error) {
            await item.backend.closeSession();

            throw new Error(`Error during module session creation: \n` +
                `${(error instanceof Error) ? error.message : String(error)}`);
        }
    };

    /**
     * Does the actual schema update work for the given session and creates schema tree items for all schema entries.
     *
     * @param entry The entry to update.
     *
     * @returns A promise that resolves once the schema list has been updated.
     */
    private doUpdateSchemaList = async (entry: ICdmConnectionEntry): Promise<void> => {
        try {
            const item = entry.treeItem;

            entry.schemaEntries = [];
            if (item.details.dbType === DBType.MySQL) {
                entry.adminEntry = {
                    parent: entry,
                    type: "admin",
                    treeItem: new AdminTreeItem("MySQL Administration", item.backend, item.details.id, true),
                    sections: [],
                };
            }

            const schemas = await item.backend.getCatalogObjects("Schema");
            for (const schema of schemas) {
                if (item.details.dbType === DBType.MySQL) {
                    // If the schema is the MRS metadata schema, add the MRS tree item
                    if (schema === "mysql_rest_service_metadata") {
                        try {
                            let addMrsTreeItem = true;
                            const status = await item.backend.mrs.status();
                            if (status.serviceBeingUpgraded) {
                                void window.showInformationMessage(
                                    "The MySQL REST Service is currently being updated. Please refresh the list of " +
                                    "DB Connections after the update has been completed for check the error log at " +
                                    "~/.mysqlsh-gui/plugin_data/mrs_plugin/mrs_metadata_schema_update_log.txt");

                                continue;
                            }


                            this.requiredRouterVersion = status.requiredRouterVersion;

                            if (status.majorUpgradeRequired) {
                                // If a major MRS metadata schema upgrade is required, the MRS tree item should
                                // only be displayed if the user agrees to upgrade i.e. drop and re-create the
                                // schema.
                                addMrsTreeItem = false;
                                let answer: string | undefined = await window.showInformationMessage(
                                    "This MySQL Shell version requires a new major version of the MRS metadata " +
                                    "schema. The latest available version is " +
                                    `${String(status.availableMetadataVersion)}. The currently deployed ` +
                                    `schema version is ${String(status.currentMetadataVersion)}. You need to ` +
                                    "downgrade the MySQL Shell version or drop and recreate the MRS metadata " +
                                    "schema. Do you want to drop and recreate the MRS metadata schema? " +
                                    "WARNING: All existing MRS data will be lost.",
                                    "Drop and Recreate", "Disable MRS features");

                                if (answer === "Drop and Recreate") {
                                    answer = await window.showInformationMessage(
                                        "Are you really sure you want to drop and recreate the MRS metadata " +
                                        "schema? WARNING: All existing MRS data will be lost."
                                        , "Yes", "No");
                                    if (answer === "Yes") {
                                        await item.backend.mrs.configure(true, true);
                                        addMrsTreeItem = true;
                                    }
                                }
                            } else if (status.serviceUpgradeable && !status.serviceUpgradeIgnored) {
                                addMrsTreeItem = false;

                                const answer: string | undefined = await window.showInformationMessage(
                                    "A new MRS metadata schema update to version " +
                                    `${String(status.availableMetadataVersion)} is available. The currently deployed ` +
                                    `schema version is ${String(status.currentMetadataVersion)}. Do you want to ` +
                                    "update the MRS metadata schema, skip this version for now or permanently ignore " +
                                    "this version upgrade going forward?",
                                    "Upgrade", "Skip", "Permanently Ignore");
                                if (answer === "Upgrade") {
                                    addMrsTreeItem = true;
                                    const statusbarItem = window.createStatusBarItem();
                                    try {
                                        statusbarItem.text = "$(loading~spin) Updating the MySQL REST Service " +
                                            "Metadata Schema ...";
                                        statusbarItem.show();

                                        await item.backend.mrs.configure(true, false, true);

                                        showMessageWithTimeout(
                                            "The MySQL REST Service Metadata Schema has been updated.");
                                    } finally {
                                        statusbarItem.hide();
                                    }
                                } else if (answer === "Permanently Ignore") {
                                    await item.backend.mrs.ignoreVersionUpgrade();
                                }
                            }

                            if (addMrsTreeItem) {
                                entry.mrsEntry = {
                                    parent: entry,
                                    type: "mrs",
                                    treeItem: new MrsTreeItem("MySQL REST Service", schema, item.backend,
                                        item.details.id, true, status.serviceEnabled),
                                    routers: [],
                                    services: [],
                                };
                            }

                        } catch (reason) {
                            void window.showErrorMessage(
                                "Failed to check and upgrade the MySQL REST Service Schema. " +
                                `Error: ${reason instanceof Error ? reason.message : String(reason)}`);
                        }
                    }

                    // Only show system schemas if allowed.
                    const hideSystemSchemas = item.details.hideSystemSchemas ?? true;

                    if ((schema !== "mysql" &&
                        schema !== "mysql_innodb_cluster_metadata" &&
                        schema !== "mysql_rest_service_metadata")
                        || !hideSystemSchemas) {
                        entry.schemaEntries.push({
                            parent: entry,
                            type: "schema",
                            treeItem: new SchemaMySQLTreeItem(schema, schema, item.backend, item.details.id,
                                schema === entry.currentSchema, true),
                            groups: [],
                        });
                    }
                } else {
                    entry.schemaEntries.push({
                        parent: entry,
                        type: "schema",
                        treeItem: new SchemaSqliteTreeItem(schema, schema, item.backend, item.details.id,
                            schema === entry.currentSchema, true),
                        groups: [],
                    });
                }
            }
        } catch (error) {
            throw new Error(`Error retrieving schema list: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    /**
     * Loads a list of schemas object names (tables, views etc.).
     *
     * @param entry The tree item for which to load the children.
     *
     * @returns A promise that resolves once the schema groups have been loaded.
     */
    private async loadSchemaGroupMembers(entry: ICdmSchemaGroupEntry): Promise<void> {
        const item = entry.treeItem;
        const isMySQL = entry.parent.parent.treeItem.details.dbType === DBType.MySQL;

        switch (entry.treeItem.groupType) {
            case SchemaItemGroupType.Routines: {
                const createItems = (type: MrsDbObjectType, list: string[]): void => {
                    for (const objectName of list) {
                        if (isMySQL) {
                            entry.members.push({
                                parent: entry,
                                type: "routine",
                                treeItem: new SchemaRoutineMySQLTreeItem(objectName, item.schema, type, item.backend,
                                    item.connectionId, false),
                            });
                        } else {
                            entry.members.push({
                                parent: entry,
                                type: "routine",
                                treeItem: new SchemaRoutineTreeItem(objectName, item.schema, type, item.backend,
                                    item.connectionId, false),
                            });
                        }
                    }
                };

                try {
                    let names = await item.backend.getSchemaObjects(item.schema, "Routine", "function");
                    createItems(MrsDbObjectType.Function, names);
                    names = await item.backend.getSchemaObjects(item.schema, "Routine", "procedure");
                    createItems(MrsDbObjectType.Procedure, names);
                } catch (error) {
                    void window.showErrorMessage("Error while retrieving schema objects: " + String(error));
                }

                break;
            }

            default: {
                try {
                    const objectType = entry.treeItem.groupType.slice(0, -1);
                    const names = await item.backend.getSchemaObjects(item.schema, objectType);
                    names.forEach((objectName) => {
                        switch (entry.treeItem.groupType) {
                            case SchemaItemGroupType.Tables: {
                                if (isMySQL) {
                                    entry.members.push({
                                        parent: entry,
                                        type: "table",
                                        treeItem: new SchemaTableMySQLTreeItem(objectName, item.schema, item.backend,
                                            item.connectionId, true),
                                        groups: [],
                                    });
                                } else {
                                    entry.members.push({
                                        parent: entry,
                                        type: "table",
                                        treeItem: new SchemaTableSqliteTreeItem(objectName, item.schema, item.backend,
                                            item.connectionId, true),
                                        groups: [],
                                    });
                                }

                                break;
                            }

                            case SchemaItemGroupType.Views: {
                                if (isMySQL) {
                                    entry.members.push({
                                        parent: entry,
                                        type: "view",
                                        treeItem: new SchemaViewMySQLTreeItem(objectName, item.schema, item.backend,
                                            item.connectionId, true),
                                    });
                                } else {
                                    entry.members.push({
                                        parent: entry,
                                        type: "view",
                                        treeItem: new SchemaViewSqliteTreeItem(objectName, item.schema, item.backend,
                                            item.connectionId, true),
                                    });
                                }

                                break;
                            }

                            case SchemaItemGroupType.Events: {
                                entry.members.push({
                                    parent: entry,
                                    type: "event",
                                    treeItem: new SchemaEventTreeItem(objectName, item.schema, item.backend,
                                        item.connectionId, false),
                                });

                                break;
                            }

                            default:
                        }
                    });
                } catch (error) {
                    void window.showErrorMessage("Error while retrieving schema objects: " + (error as string));
                }

            }
        }
    }

    /**
     * Loads a list of table object names (indexes, triggers etc.).
     *
     * @param entry The data model node for which to load the children.
     *
     * @returns A promise that resolves once the table group members have been loaded.
     */
    private async loadTableMembers(entry: ICdmTableGroupEntry): Promise<void> {
        const item = entry.treeItem;

        switch (item.groupType) {
            case SchemaItemGroupType.Columns: {
                const names = await item.backend.getTableObjectNames(item.schema, item.table, "Column");
                names.forEach((objectName) => {
                    entry.members.push({
                        parent: entry,
                        type: "column",
                        treeItem: new SchemaTableColumnTreeItem(objectName, item.schema, item.table,
                            item.backend, item.connectionId),
                    });
                });

                break;
            }

            case SchemaItemGroupType.Indexes: {
                const names = await item.backend.getTableObjectNames(item.schema, item.table, "Index");
                names.forEach((objectName) => {
                    entry.members.push({
                        parent: entry,
                        type: "index",
                        treeItem: new SchemaTableIndexTreeItem(objectName, item.schema, item.table,
                            item.backend, item.connectionId),
                    });
                });

                break;
            }

            case SchemaItemGroupType.Triggers: {
                const names = await item.backend.getTableObjectNames(item.schema, item.table, "Trigger");
                names.forEach((objectName) => {

                    entry.members.push({
                        parent: entry,
                        type: "trigger",
                        treeItem: new SchemaTableTriggerTreeItem(objectName, item.schema, item.table,
                            item.backend, item.connectionId),
                    });
                });

                break;
            }

            case SchemaItemGroupType.ForeignKeys: {
                const names = await item.backend.getTableObjectNames(item.schema, item.table, "Foreign Key");
                names.forEach((objectName) => {
                    entry.members.push({
                        parent: entry,
                        type: "foreignKey",
                        treeItem: new SchemaTableForeignKeyTreeItem(objectName, item.schema, item.table,
                            item.backend, item.connectionId),
                    });
                });

                break;
            }

            default:
        }
    }

    /**
     * Loads the list of MRS services.
     *
     * @param entry The MRS root element.
     *
     * @returns A promise that resolves once the MRS services have been loaded.
     */
    private async loadMrsServices(entry: ICdmRestRootEntry): Promise<void> {
        try {
            const item = entry.treeItem;

            const services = await item.backend.mrs.listServices();
            entry.services = services.map((value) => {
                const developers = !value.sortedDevelopers ? "" : value.sortedDevelopers;
                const urlHostName = !value.urlHostName ? "" : value.urlHostName;

                let label = urlHostName + value.urlContextRoot;
                if (value.inDevelopment) {
                    label = label + ` [${developers}]`;
                }

                return {
                    parent: entry,
                    type: "mrsService",
                    treeItem: new MrsServiceTreeItem(label, value, item.backend, item.connectionId),
                    schemas: [],
                    contentSets: [],
                    authApps: [],
                };
            });

            const routers = await item.backend.mrs.listRouters(10);
            entry.routers = routers.map((value) => {
                let label = value.address;
                if (value.routerName) {
                    label = `${value.routerName} (${value.address})`;
                }

                return {
                    parent: entry,
                    type: "mrsRouter",
                    treeItem: new MrsRouterTreeItem(label, value, item.backend, item.connectionId,
                        this.requiredRouterVersion !== undefined
                            ? compareVersionStrings(this.requiredRouterVersion, value.version) > 0
                            : false),
                    services: [],
                };
            });

            this.#errorAlreadyDisplayed = false;
        } catch (error) {
            if (!this.#errorAlreadyDisplayed) {
                window.setStatusBarMessage("An error occurred while retrieving MRS content. " +
                    `Error: ${error instanceof Error ? error.message : String(error) ?? "<unknown>"}`, 10000);
                this.#errorAlreadyDisplayed = true;
            }

            entry.services = [];
            entry.routers = [];
        }
    }

    /**
     * Loads the list of MRS content sets.
     *
     * @param entry The MRS service element.
     *
     * @returns A promise that resolves to when the MRS service elements have been loaded.
     */
    private loadMrsServiceEntries = async (entry: ICdmRestServiceEntry): Promise<void> => {
        try {
            const item = entry.treeItem;

            // Get all MRS Schemas
            const schemas = await item.backend.mrs.listSchemas(item.value.id);
            entry.schemas = schemas.map((value) => {
                return {
                    parent: entry,
                    type: "mrsSchema",
                    treeItem: new MrsSchemaTreeItem(`${value.requestPath} (${value.name})`, value, item.backend,
                        item.connectionId),
                    dbObjects: [],
                };
            });

            // Get all MRS ContentSets
            const contentSets = await item.backend.mrs.listContentSets(item.value.id);
            entry.contentSets = contentSets.map((value) => {
                return {
                    parent: entry,
                    type: "mrsContentSet",
                    treeItem: new MrsContentSetTreeItem(`${value.requestPath}`, value, item.backend, item.connectionId),
                    files: [],
                };
            });

            // Get all MRS auth apps
            const authApps = await item.backend.mrs.getAuthApps(item.value.id);
            entry.authApps = authApps.map((value) => {
                const name = value.name ?? "unknown";
                const vendor = value.authVendor ?? "unknown";

                return {
                    parent: entry,
                    type: "mrsAuthApp",
                    treeItem: new MrsAuthAppTreeItem(`${name} (${vendor})`, value, item.backend, item.connectionId),
                    users: [],
                };
            });

            this.#errorAlreadyDisplayed = false;
        } catch (error) {
            if (!this.#errorAlreadyDisplayed) {
                window.setStatusBarMessage("An error occurred while retrieving MRS services. " +
                    `Error: ${error instanceof Error ? error.message : String(error) ?? "<unknown>"}`, 10000);
                this.#errorAlreadyDisplayed = true;
            }

            entry.schemas = [];
            entry.contentSets = [];
            entry.authApps = [];
        }
    };

    /**
     * Loads the list of MRS authentication apps.
     *
     * @param entry The MRS authentication app element.
     *
     * @returns A promise that resolves to when the MRS users have been loaded.
     */
    private loadMrsAuthAppUsers = async (entry: ICdmRestAuthAppEntry): Promise<void> => {
        try {
            const item = entry.treeItem;

            const users = await item.backend.mrs.listUsers(undefined, item.value.id);
            entry.users = users.map((value) => {
                return {
                    parent: entry,
                    type: "mrsUser",
                    treeItem: new MrsUserTreeItem(value.name ?? "unknown", value, item.backend, item.connectionId),
                };
            });

            this.#errorAlreadyDisplayed = false;
        } catch (error) {
            if (!this.#errorAlreadyDisplayed) {
                window.setStatusBarMessage("An error occurred while retrieving MRS users. " +
                    `Error: ${error instanceof Error ? error.message : String(error) ?? "<unknown>"}`, 10000);
                this.#errorAlreadyDisplayed = true;
            }

            entry.users = [];
        }
    };

    /**
     * Loads the list of MRS content sets.
     *
     * @param entry The MRS service element.
     *
     * @returns A promise that resolves to when the MRS content set files have been loaded.
     */
    private loadMrsContentSetFiles = async (entry: ICdmRestContentSetEntry): Promise<void> => {
        try {
            const item = entry.treeItem;

            const contentFiles = await item.backend.mrs.listContentFiles(item.value.id);
            entry.files = contentFiles.map((value) => {
                return {
                    parent: entry,
                    type: "mrsContentFile",
                    treeItem: new MrsContentFileTreeItem(`${value.requestPath}`, value,
                        item.backend, item.connectionId),
                };
            });

            this.#errorAlreadyDisplayed = false;
        } catch (error) {
            if (!this.#errorAlreadyDisplayed) {
                window.setStatusBarMessage("An error occurred while retrieving MRS content files. " +
                    `Error: ${error instanceof Error ? error.message : String(error) ?? "<unknown>"}`, 10000);
                this.#errorAlreadyDisplayed = true;
            }

            entry.files = [];
        }
    };


    /**
     * Loads the list of MRS db objects.
     *
     * @param entry The MRS service element.
     *
     * @returns A promise that resolves to when the MRS schema objects have been loaded.
     */
    private async loadMrsDbObjects(entry: ICdmRestSchemaEntry): Promise<void> {
        const item = entry.treeItem;

        try {
            const objects = await item.backend.mrs.listDbObjects(item.value.id);
            entry.dbObjects = objects.map((value) => {
                return {
                    parent: entry,
                    type: "mrsDbObject",
                    treeItem: new MrsDbObjectTreeItem(`${value.requestPath} (${value.name})`, value, item.backend,
                        item.connectionId),
                };
            });

            this.#errorAlreadyDisplayed = false;
        } catch (error) {
            if (!this.#errorAlreadyDisplayed) {
                window.setStatusBarMessage("An error occurred while retrieving MRS db objects. " +
                    `Error: ${error instanceof Error ? error.message : String(error) ?? "<unknown>"}`, 10000);
                this.#errorAlreadyDisplayed = true;
            }

            entry.dbObjects = [];
        }
    }

    /**
     * Loads the list of MRS router services.
     *
     * @param entry The MRS service element.
     *
     * @returns A promise that resolves to when the MRS schema objects have been loaded.
     */
    private async loadMrsRouterServices(entry: ICdmRestRouterEntry): Promise<void> {
        const item = entry.treeItem;

        try {
            const routerServices = await item.backend.mrs.getRouterServices(item.value.id);
            entry.services = routerServices.map((value) => {
                const developers = !value.sortedDevelopers ? "" : value.sortedDevelopers;
                const urlHostName = !value.serviceUrlHostName ? "" : value.serviceUrlHostName;

                let label = urlHostName + value.serviceUrlContextRoot;
                if (value.inDevelopment) {
                    label = label + ` [${developers}]`;
                }

                return {
                    parent: entry,
                    type: "mrsRouterService",
                    treeItem: new MrsRouterServiceTreeItem(label, value, item.backend,
                        item.connectionId),
                };
            });

            this.#errorAlreadyDisplayed = false;
        } catch (error) {
            if (!this.#errorAlreadyDisplayed) {
                window.setStatusBarMessage("An error occurred while retrieving MRS router services. " +
                    `Error: ${error instanceof Error ? error.message : String(error) ?? "<unknown>"}`, 10000);
                this.#errorAlreadyDisplayed = true;
            }

            entry.services = [];
        }
    }

    private refreshConnections = (data?: IDictionary): Promise<boolean> => {
        this.refresh(data?.entry as ConnectionsTreeDataModelEntry);

        return Promise.resolve(true);
    };

    /**
     * Requests sent from one of the providers.
     *
     * @param request The request to handle.
     * @param request.provider The provider that sent the request.
     * @param request.original The original request.
     *
     * @returns A promise that resolves to true if the request was handled.
     */
    private proxyRequest = async (request: {
        provider: IWebviewProvider;
        original: IRequestListEntry<keyof IRequestTypeMap>;
    }): Promise<boolean> => {
        switch (request.original.requestType) {
            case "sqlSetCurrentSchema": {
                // Find the connection for which the schema should be changed.
                const response = request.original.parameter as {
                    editorId: string, connectionId: number, schema: string;
                };
                const connection = this.connections.find((value) => {
                    return value.treeItem.details.id === response.connectionId;
                });

                if (connection && connection.currentSchema !== response.schema) {
                    connection.currentSchema = response.schema;

                    return this.refreshConnections({ entry: connection });
                }

                break;
            }

            case "refreshConnections": {
                const data = request.original.parameter as IDictionary;

                return this.refreshConnections(data);
            }

            case "connectionAdded": {
                const response = request.original.parameter as IConnectionDetails;
                let connection = this.connections.find((value) => {
                    return value.treeItem.details.id === response.id;
                });

                if (!connection) {
                    let treeItem;

                    if (response.dbType === DBType.MySQL) {
                        treeItem = new ConnectionMySQLTreeItem(response, new ShellInterfaceSqlEditor());
                    } else {
                        treeItem = new ConnectionSqliteTreeItem(response, new ShellInterfaceSqlEditor());
                    }

                    connection = {
                        id: ConnectionsTreeDataProvider.nextId++,
                        type: "connection",
                        isOpen: false,
                        openEditors: 0,
                        currentSchema: "",
                        treeItem,
                        schemaEntries: [],
                    };

                    this.connections.push(connection);
                    this.refresh(); // Refresh the parent of the new connection (which is the root).
                }

                break;
            }

            case "connectionUpdated": {
                const response = request.original.parameter as IConnectionDetails;
                const connection = this.connections.find((value) => {
                    return value.treeItem.details.id === response.id;
                });

                if (connection) {
                    let treeItem;

                    if (response.dbType === DBType.MySQL) {
                        treeItem = new ConnectionMySQLTreeItem(response, new ShellInterfaceSqlEditor());
                    } else {
                        treeItem = new ConnectionSqliteTreeItem(response, new ShellInterfaceSqlEditor());
                    }

                    // We could just take over all the values from the response, but it's easier to just
                    // replace the tree item.
                    connection.treeItem = treeItem;

                    this.refresh(connection);
                }

                break;
            }

            case "connectionRemoved": {
                const response = request.original.parameter as IConnectionDetails;
                const connection = this.connections.find((value) => {
                    return value.treeItem.details.id === response.id;
                });

                if (connection) {
                    await connection.treeItem.backend.closeSession();
                    this.connections.splice(this.connections.indexOf(connection), 1);
                }

                this.refresh();

                break;
            }

            case "editorsChanged": {
                // Handle the request after closing an editor, by updating the current schema list.
                const response = request.original.parameter as IEditorOpenChangeData | IEditorCloseChangeData;
                const connection = this.connections.find((value) => {
                    return value.treeItem.details.id === response.connectionId;
                });

                if (connection) {
                    if (response.opened) {
                        ++connection.openEditors;
                    } else {
                        --connection.openEditors;
                        if (connection.openEditors === 0) {
                            connection.currentSchema = "";

                            return this.refreshConnections({ entry: connection });
                        }
                    }
                }

                return Promise.resolve(true);
            }

            default:
        }

        return Promise.resolve(false);
    };

}
