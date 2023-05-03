/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import {
    TreeDataProvider, TreeItem, EventEmitter, ProviderResult, Event, window,
} from "vscode";

import {
    IRequestListEntry, IRequestTypeMap, IWebviewProvider, requisitions,
} from "../../../../frontend/src/supplement/Requisitions";

import { DBType, IConnectionDetails } from "../../../../frontend/src/supplement/ShellInterface";
import { ShellInterfaceSqlEditor } from "../../../../frontend/src/supplement/ShellInterface/ShellInterfaceSqlEditor";
import { webSession } from "../../../../frontend/src/supplement/WebSession";

import { ConnectionTreeItem } from "./ConnectionTreeItem";
import { SchemaTreeItem } from "./SchemaTreeItem";
import { SchemaMySQLTreeItem } from "./SchemaMySQLTreeItem";
import { ISqliteConnectionOptions } from "../../../../frontend/src/communication/Sqlite";
import { SchemaGroupTreeItem } from "./SchemaGroupTreeItem";
import { SchemaItemGroupType } from "./SchemaIndex";

import { showStatusText } from "../../extension";
import { IDictionary } from "../../../../frontend/src/app-logic/Types";
import { SchemaListTreeItem } from "./SchemaListTreeItem";
import { SchemaViewMySQLTreeItem } from "./SchemaViewMySQLTreeItem";
import { SchemaRoutineMySQLTreeItem } from "./SchemaRoutineMySQLTreeItem";
import { MrsContentSetTreeItem } from "./MrsContentSetTreeItem";
import { openSqlEditorConnection } from "../../utilitiesShellGui";
import { MrsContentFileTreeItem } from "./MrsContentFileTreeItem";
import { compareVersionStrings, formatBytes } from "../../../../frontend/src/utilities/string-helpers";
import { ShellInterface } from "../../../../frontend/src/supplement/ShellInterface/ShellInterface";
import { AdminSectionTreeItem } from "./AdminSectionTreeItem";
import { AdminTreeItem } from "./AdminTreeItem";
import { ConnectionMySQLTreeItem } from "./ConnectionMySQLTreeItem";
import { ConnectionSqliteTreeItem } from "./ConnectionSqliteTreeItem";
import { MrsDbObjectTreeItem } from "./MrsDbObjectTreeItem";
import { MrsSchemaTreeItem } from "./MrsSchemaTreeItem";
import { MrsServiceTreeItem } from "./MrsServiceTreeItem";
import { MrsTreeItem } from "./MrsTreeItem";
import { SchemaEventTreeItem } from "./SchemaEventTreeItem";
import { SchemaRoutineTreeItem } from "./SchemaRoutineTreeItem";
import { SchemaTableColumnTreeItem } from "./SchemaTableColumnTreeItem";
import { SchemaTableForeignKeyTreeItem } from "./SchemaTableForeignKeyTreeItem";
import { TableGroupTreeItem } from "./SchemaTableGroupTreeItem";
import { SchemaTableIndexTreeItem } from "./SchemaTableIndexTreeItem";
import { SchemaTableMySQLTreeItem } from "./SchemaTableMySQLTreeItem";
import { SchemaTableTreeItem } from "./SchemaTableTreeItem";
import { SchemaTableTriggerTreeItem } from "./SchemaTableTriggerTreeItem";
import { SchemaViewTreeItem } from "./SchemaViewTreeItem";
import { MrsAuthAppTreeItem } from "./MrsAuthAppTreeItem";
import { MrsUserTreeItem } from "./MrsUserTreeItem";
import { MrsRouterTreeItem } from "./MrsRouterTreeItem";
import { uuid } from "../../../../frontend/src/utilities/helpers";
import { showMessageWithTimeout } from "../../utilities";

export interface IConnectionEntry {
    id: string;
    details: IConnectionDetails;
    backend?: ShellInterfaceSqlEditor;
    schemas?: string[];
    mrsTreeItem?: MrsTreeItem;
}

// A class to provide the entire tree structure for DB editor connections and the DB objects from them.
export class ConnectionsTreeDataProvider implements TreeDataProvider<TreeItem> {
    // A running number to identify uniquely every connection entry.
    private static nextId = 1;

    public connections: IConnectionEntry[] = [];

    // List to keep track of visible MrsTreeItems
    private expandedMrsTreeItems: MrsTreeItem[] = [];

    private changeEvent = new EventEmitter<TreeItem | undefined>();

    private useDedicatedSchemaSubtree: boolean;

    private refreshMrsRoutersTimer: ReturnType<typeof setTimeout> | null;

    private requiredRouterVersion?: string;

    public get onDidChangeTreeData(): Event<TreeItem | undefined> {
        return this.changeEvent.event;
    }

    public constructor() {
        // TODO: make this configurable.
        this.useDedicatedSchemaSubtree = false;

        // A connection refresh request can be scheduled from the frontend or within the extension.
        requisitions.register("refreshConnections", this.refreshConnections);
        requisitions.register("proxyRequest", this.proxyRequest);

        this.refreshMrsRoutersTimer = null;
    }

    public dispose(): void {
        if (this.refreshMrsRoutersTimer !== null) {
            clearTimeout(this.refreshMrsRoutersTimer);
            this.refreshMrsRoutersTimer = null;
        }
        requisitions.unregister("refreshConnections", this.refreshConnections);
        requisitions.unregister("proxyRequest", this.proxyRequest);

        this.closeAllConnections();
    }

    public refresh(item?: TreeItem): void {
        if (!item) {
            void this.updateConnections().then(() => {
                this.changeEvent.fire(item);

                // Start the Router refresh timer
                if (this.refreshMrsRoutersTimer === null) {
                    this.refreshMrsRouters();
                }

                void requisitions.execute("connectionsUpdated", undefined);
            });
        } else {
            this.changeEvent.fire(item);
        }
    }

    public getTreeItem(element: TreeItem): TreeItem {
        return element;
    }

    public getChildren(element?: TreeItem): ProviderResult<TreeItem[]> {
        if (!element) {
            return this.connections.map((connection) => {
                switch (connection.details.dbType) {
                    case DBType.MySQL: {
                        return new ConnectionMySQLTreeItem(connection);
                    }

                    case DBType.Sqlite: {
                        return new ConnectionSqliteTreeItem(connection);
                    }

                    default: {
                        throw new Error("Unsupported DB type: " + String(connection.details.dbType));
                    }
                }
            });
        }

        if (element instanceof ConnectionTreeItem) {
            if (this.useDedicatedSchemaSubtree) {
                const items = [];
                if (element.entry.details.dbType === DBType.MySQL) {
                    items.push(new AdminTreeItem("MySQL Administration", "", element.entry, true));
                }

                items.push(new SchemaListTreeItem("Schemas", "", element.entry, true));

                return items;
            }

            return this.updateSchemaList(element.entry);
        }

        if (element instanceof AdminTreeItem) {
            const serverStatusCommand = {
                title: "Show Server Status",
                command: "msg.showServerStatus",
                // The first argument is undefined to show the page on the currently selected connection.
                arguments: [undefined, "Server Status", element.entry.details.id, uuid()],
            };

            const clientConnectionsCommand = {
                title: "Show Client Connections",
                command: "msg.showClientConnections",
                arguments: [undefined, "Client Connections", element.entry.details.id, uuid()],
            };

            const performanceDashboardCommand = {
                title: "Show Performance Dashboard",
                command: "msg.showPerformanceDashboard",
                arguments: [undefined, "Performance Dashboard", element.entry.details.id, uuid()],
            };

            return [
                new AdminSectionTreeItem("Server Status", "", element.entry, false, "adminServerStatus.svg",
                    serverStatusCommand),
                new AdminSectionTreeItem("Client Connections", "", element.entry, false, "clientConnections.svg",
                    clientConnectionsCommand),
                new AdminSectionTreeItem("Performance Dashboard", "", element.entry, false,
                    "adminPerformanceDashboard.svg", performanceDashboardCommand),
            ];
        }

        if (this.useDedicatedSchemaSubtree) {
            if (element instanceof SchemaListTreeItem) {
                return this.updateSchemaList(element.entry);
            }
        }

        if (element instanceof SchemaTreeItem) {
            const result: SchemaGroupTreeItem[] = [
                new SchemaGroupTreeItem(element.schema, element.entry, SchemaItemGroupType.Tables),
                new SchemaGroupTreeItem(element.schema, element.entry, SchemaItemGroupType.Views),
            ];

            if (element.entry.details.dbType === DBType.MySQL) {
                result.push(new SchemaGroupTreeItem(element.schema, element.entry, SchemaItemGroupType.Routines));
                result.push(new SchemaGroupTreeItem(element.schema, element.entry, SchemaItemGroupType.Events));
            }

            return result;
        }

        if (element instanceof SchemaGroupTreeItem) {
            return this.loadSchemaMembers(element);
        }

        if (element instanceof SchemaTableTreeItem) {
            return [
                new TableGroupTreeItem(element.schema, element.name, element.entry, SchemaItemGroupType.Columns),
                new TableGroupTreeItem(element.schema, element.name, element.entry, SchemaItemGroupType.Indexes),
                new TableGroupTreeItem(element.schema, element.name, element.entry, SchemaItemGroupType.ForeignKeys),
                new TableGroupTreeItem(element.schema, element.name, element.entry, SchemaItemGroupType.Triggers),
            ];
        }

        if (element instanceof TableGroupTreeItem) {
            return this.loadTableMembers(element);
        }

        if (element instanceof MrsTreeItem) {
            return this.getMrsChildren(element);
        }

        if (element instanceof MrsServiceTreeItem) {
            return this.getMrsServiceChildren(element);
        }

        if (element instanceof MrsAuthAppTreeItem) {
            return this.getMrsAuthAppChildren(element);
        }

        if (element instanceof MrsContentSetTreeItem) {
            return this.getMrsContentSetChildren(element);
        }

        if (element instanceof MrsSchemaTreeItem) {
            return this.listMrsDbObjects(element);
        }

        return Promise.resolve([]);
    }

    public closeAllConnections(): void {
        this.connections.forEach((entry) => {
            if (entry.backend) {
                entry.backend.closeSession().catch(() => { /**/ });
            }
        });

        this.connections = [];
    }

    /**
     * When assigned to the TreeView.onDidExpandElement it updates the list of expanded MrsTreeView nodes
     *
     * @param i The tree item that got expanded
     */
    public readonly didExpandElement = (i: TreeItem): void => {
        if (i instanceof ConnectionMySQLTreeItem && i.entry.mrsTreeItem !== undefined) {
            i = i.entry.mrsTreeItem;
        }

        if (i instanceof MrsTreeItem && this.expandedMrsTreeItems.indexOf(i) === -1) {
            this.expandedMrsTreeItems.push(i);
        }
    };

    /**
     * When assigned to the TreeView.onDidCollapseElement it updates the list of expanded MrsTreeView nodes
     *
     * @param i The tree item that got expanded
     */
    public readonly didCollapseElement = (i: TreeItem): void => {
        if (i instanceof ConnectionMySQLTreeItem && i.entry.mrsTreeItem !== undefined) {
            i = i.entry.mrsTreeItem;
        }

        if (i instanceof MrsTreeItem) {
            const index = this.expandedMrsTreeItems.indexOf(i);
            if (index > -1) {
                this.expandedMrsTreeItems.splice(index, 1);
            }
        }
    };

    /**
     * Refreshes all visible MrsTreeItems every 10 seconds to visualize MySQL Routers getting inactive
     */
    public readonly refreshMrsRouters = (): void => {
        if (this.refreshMrsRoutersTimer !== null) {
            clearTimeout(this.refreshMrsRoutersTimer);
        }

        for (const item of this.expandedMrsTreeItems) {
            this.refresh(item);
        }

        // Start a 10s timer to check if new invitations have been created
        this.refreshMrsRoutersTimer = setTimeout(() => {
            this.refreshMrsRouters();
        }, 10000);
    };

    /**
     * Queries the backend for a list of stored user DB connections and updates our connection entries.
     */
    private async updateConnections(): Promise<void> {
        if (webSession.currentProfileId === -1) {
            this.closeAllConnections();
        } else {
            try {
                const details = await ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId, "");

                // Close and remove all open connections that are no longer in the new list.
                // Sort in new connection entries on the way.
                let left = 0;  // The current index into the existing entries.
                let right = 0; // The current index into the new entries while looking for a match.
                while (left < this.connections.length && details.length > 0) {
                    if (this.connections[left].details.caption === details[right].caption) {
                        // Entries match.
                        if (right > 0) {
                            // We had to jump over other entries to arrive here. Add those
                            // as new entries in our current list.
                            for (let i = 0; i < right; ++i) {
                                this.connections.splice(left, 0, {
                                    id: String(ConnectionsTreeDataProvider.nextId++),
                                    details: details[i],
                                });
                            }

                            details.splice(0, right);
                            right = 0;
                        }

                        // Advance to the next entry.
                        ++left;
                        details.shift();
                    } else {
                        // Entries don't match. Check if we can find the current entry in the new
                        // list at a higher position (which would mean we have new entries before
                        // the current one).
                        while (++right < details.length) {
                            if (this.connections[left].details.caption === details[right].caption) {
                                break;
                            }
                        }

                        if (right === details.length) {
                            // Current entry no longer exists. Close the session (if one is open)
                            // and remove it from the current list.
                            const entry = this.connections.splice(left, 1)[0];
                            void entry.backend?.closeSession();

                            // Reset the right index to the top of the list and keep the current
                            // index where it is (points already to the next entry after removal).
                            right = 0;
                        }
                    }
                }

                // Take over all remaining entries from the new list.
                while (details.length > 0) {
                    ++left;

                    this.connections.push({
                        id: String(ConnectionsTreeDataProvider.nextId++),
                        details: details.shift()!,
                    });
                }

                // Remove all remaining entries we haven't touched yet.
                while (left < this.connections.length) {
                    const entry = this.connections.splice(left, 1)[0];
                    await entry.backend?.closeSession();
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
    private updateSchemaList = async (entry: IConnectionEntry): Promise<TreeItem[]> => {
        if (!entry.backend) {
            const backend = new ShellInterfaceSqlEditor();
            entry.backend = backend;

            await backend.startSession(entry.id + "ConnectionTreeProvider");

            try {
                if (entry.details.dbType === DBType.Sqlite) {
                    const options = entry.details.options as ISqliteConnectionOptions;

                    // Before opening the connection check the DB file, if this is an sqlite connection.
                    if (await ShellInterface.core.validatePath(options.dbFile)) {
                        await openSqlEditorConnection(entry.backend, entry.details.id, (message) => {
                            showStatusText(message);
                        });

                        return this.updateSchemaList(entry);
                    } else {
                        // If the path is not ok then we might have to create the DB file first.
                        try {
                            await ShellInterface.core.createDatabaseFile(options.dbFile);

                            return this.updateSchemaList(entry);
                        } catch (error) {
                            throw Error(`DB Creation Error: \n${String(error) ?? "<unknown>"}`);
                        }
                    }
                } else {
                    await openSqlEditorConnection(entry.backend, entry.details.id, (message) => {
                        showStatusText(message);
                    });

                    return this.updateSchemaList(entry);
                }

            } catch (error) {
                await entry.backend?.closeSession();

                entry.backend = undefined;

                throw new Error(`Error during module session creation: \n` +
                    `${(error instanceof Error) ? error.message : String(error)}`);
            }
        } else {
            return this.doUpdateSchemaList(entry);
        }
    };

    /**
     * Does the actual schema update work for the given session and creates schema tree items for all schema entries.
     *
     * @param entry The entry to update.
     *
     * @returns A new list of tree items for the updated schema list.
     */
    private doUpdateSchemaList = async (entry: IConnectionEntry): Promise<TreeItem[]> => {
        try {
            const backend = entry.backend;
            if (backend) {
                const schemaList: TreeItem[] = [];
                if (entry.details.dbType === DBType.MySQL) {
                    schemaList.push(new AdminTreeItem("MySQL Administration", "", entry, true));
                }

                const schemas = await backend.getCatalogObjects("Schema");
                for (const schema of schemas) {
                    if (entry.details.dbType === "MySQL") {
                        // If the schema is the MRS metadata schema, add the MRS tree item
                        if (schema === "mysql_rest_service_metadata") {
                            try {
                                let addMrsTreeItem = true;
                                const status = await backend.mrs.status();
                                this.requiredRouterVersion = status.requiredRouterVersion;

                                if (status.majorUpgradeRequired) {
                                    // If a major MRS metadata schema upgrade is required, the MRS tree item should
                                    // only be displayed if the user agrees to upgrade i.e. drop and re-create the
                                    // schema.
                                    addMrsTreeItem = false;
                                    let answer: string | undefined = await window.showInformationMessage(
                                        "This MySQL Shell version requires a new major version of the MRS metadata " +
                                        `schema, ${String(status.requiredMetadataVersion)}. The currently deployed ` +
                                        `schema version is ${String(status.currentMetadataVersion)}. You need to ` +
                                        "downgrade the MySQL Shell version or drop and recreate the MRS metadata " +
                                        "schema. Do you want to drop and recreate the MRS metadata schema? " +
                                        "WARNING: All existing MRS data will be lost."
                                        , "Yes", "No");

                                    if (answer === "Yes") {
                                        answer = await window.showInformationMessage(
                                            "Are you really sure you want to drop and recreate the MRS metadata " +
                                            "schema? WARNING: All existing MRS data will be lost."
                                            , "Drop and Recreate", "No");
                                        if (answer === "Drop and Recreate") {
                                            await backend.mrs.configure(true, true);
                                            addMrsTreeItem = true;
                                        }
                                    }
                                } else if (status.serviceUpgradeable) {
                                    const statusbarItem = window.createStatusBarItem();
                                    try {
                                        statusbarItem.text = "$(loading~spin) Updating the MySQL REST Service " +
                                            "Metadata Schema ...";
                                        statusbarItem.show();

                                        await backend.mrs.configure();

                                        showMessageWithTimeout(
                                            "The MySQL REST Service Metadata Schema has been updated.");
                                    } finally {
                                        statusbarItem.hide();
                                    }
                                }

                                if (addMrsTreeItem) {
                                    const mrsTreeItem =
                                        new MrsTreeItem("MySQL REST Service", schema, entry, true,
                                            status.serviceEnabled);
                                    schemaList.unshift(mrsTreeItem);
                                    // Store the mrsTreeItem in the IConnectionEntry so it can be accessed later on
                                    entry.mrsTreeItem = mrsTreeItem;
                                }

                            } catch (reason) {
                                void window.showErrorMessage(
                                    "Failed to check and upgrade the MySQL REST Service Schema. " +
                                    `Error: ${reason instanceof Error ? reason.message : String(reason)}`);
                            }
                        }
                        // Only show system schemas if the options is set
                        let hideSystemSchemas = true;
                        if (entry.details.hideSystemSchemas !== undefined) {
                            hideSystemSchemas = entry.details.hideSystemSchemas;
                        }

                        if ((schema !== "mysql" &&
                            schema !== "mysql_innodb_cluster_metadata" &&
                            schema !== "mysql_rest_service_metadata")
                            || !hideSystemSchemas) {
                            schemaList.push(new SchemaMySQLTreeItem(schema, schema, entry, true));
                        }
                    } else {
                        schemaList.push(new SchemaTreeItem(schema, schema, entry, true));
                    }
                }

                return schemaList;

            } else {
                throw new Error("No entry.backend assignment on tree entry.");
            }
        } catch (error) {
            throw new Error(`Error retrieving schema list: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    /**
     * Loads a list of schemas object names (tables, views etc.).
     *
     * @param element The tree item for which to load the children.
     *
     * @returns A promise that resolves to a list of tree items for the UI.
     */
    private async loadSchemaMembers(element: SchemaGroupTreeItem): Promise<TreeItem[]> {
        if (!element.entry.backend) {
            return [];
        }

        const name = element.label as string;
        const schema = element.schema;
        const entry = element.entry;

        const items: TreeItem[] = [];

        const objectType = name.slice(0, -1);
        if (objectType === "Routine") {
            const createItems = (type: "function" | "procedure", list: string[]): void => {
                for (const objectName of list) {
                    if (element.entry.details.dbType === "MySQL") {
                        items.push(new SchemaRoutineMySQLTreeItem(objectName, schema, type, entry, false));
                    } else {
                        items.push(new SchemaRoutineTreeItem(objectName, schema, type, entry, false));
                    }
                }
            };

            try {
                let names = await element.entry.backend.getSchemaObjects(element.schema, objectType, "function");
                createItems("function", names);
                names = await element.entry.backend.getSchemaObjects(element.schema, objectType, "procedure");
                createItems("procedure", names);
            } catch (error) {
                void window.showErrorMessage("Error while retrieving schema objects: " + (error as string));
            }
        } else {
            try {
                const names = await element.entry.backend.getSchemaObjects(element.schema, objectType);
                names.forEach((objectName) => {
                    switch (name) {
                        case SchemaItemGroupType.Tables: {
                            if (element.entry.details.dbType === "MySQL") {
                                items.push(new SchemaTableMySQLTreeItem(objectName, schema, entry, true));
                            } else {
                                items.push(new SchemaTableTreeItem(objectName, schema, entry, true));
                            }

                            break;
                        }

                        case SchemaItemGroupType.Views: {
                            if (element.entry.details.dbType === "MySQL") {
                                items.push(new SchemaViewMySQLTreeItem(objectName, schema, entry, true));
                            } else {
                                items.push(new SchemaViewTreeItem(objectName, schema, entry, true));
                            }

                            break;
                        }

                        case SchemaItemGroupType.Events: {
                            items.push(new SchemaEventTreeItem(objectName, schema, entry, false));

                            break;
                        }

                        default:
                    }
                });
            } catch (error) {
                void window.showErrorMessage("Error while retrieving schema objects: " + (error as string));
            }

        }

        return items;
    }

    /**
     * Loads a list of table object names (indexes, triggers etc.).
     *
     * @param element The tree item for which to load the children.
     *
     * @returns A promise that resolves to a list of tree items for the UI.
     */
    private loadTableMembers(element: TableGroupTreeItem): Promise<TreeItem[]> {
        return new Promise((resolve, reject) => {
            if (!element.entry.backend) {
                resolve([]);

                return;
            }

            const itemList: TreeItem[] = [];

            const name = element.label as string;
            const schema = element.schema;
            const table = element.table;
            const entry = element.entry;

            const type = name === "Indexes" ? "Index" : name.slice(0, -1);
            element.entry.backend.getTableObjects(element.schema, element.table, type).then((names) => {
                names.forEach((objectName) => {
                    let item: TreeItem | undefined;
                    switch (name) {
                        case SchemaItemGroupType.Columns: {
                            item = new SchemaTableColumnTreeItem(objectName, schema, table, entry);

                            break;
                        }

                        case SchemaItemGroupType.Indexes: {
                            item = new SchemaTableIndexTreeItem(objectName, schema, table, entry);

                            break;
                        }

                        case SchemaItemGroupType.ForeignKeys: {
                            item = new SchemaTableForeignKeyTreeItem(objectName, schema, table, entry);

                            break;
                        }

                        case SchemaItemGroupType.Triggers: {
                            item = new SchemaTableTriggerTreeItem(objectName, schema, table, entry);

                            break;
                        }

                        default: {
                            break;
                        }
                    }

                    if (item) {
                        itemList.push(item);
                    }
                });

                resolve(itemList);
            }).catch((reason) => {
                reject("Error while retrieving schema objects: " + String(reason));
            });
        });
    }

    /**
     * Loads the list of MRS services.
     *
     * @param element The MRS tree element
     *
     * @returns A promise that resolves to a list of tree items for the UI.
     */
    private async getMrsChildren(element: MrsTreeItem): Promise<TreeItem[]> {
        if (element.entry.backend) {
            try {
                const treeItemList: TreeItem[] = [];

                const services = await element.entry.backend.mrs.listServices();
                const serviceList: TreeItem[] = services.map((value) => {
                    let label = value.urlContextRoot;
                    if (value.urlHostName) {
                        label = label + ` (${value.urlHostName})`;
                    }

                    return new MrsServiceTreeItem(label, value, element.entry);
                });

                const routers = await element.entry.backend.mrs.listRouters(10);
                const routerList: TreeItem[] = routers.map((value) => {
                    return new MrsRouterTreeItem(value.address, value, element.entry,
                        this.requiredRouterVersion
                            ? compareVersionStrings(this.requiredRouterVersion, value.version) > 0
                            : false);
                });

                return treeItemList.concat(serviceList, routerList);
            } catch (error) {
                throw new Error("Error during retrieving MRS content. " +
                    `Error: ${error instanceof Error ? error.message : String(error) ?? "<unknown>"}`);
            }
        }

        return [];
    }

    /**
     * Loads the list of MRS content sets.
     *
     * @param element The MRS service element.
     *
     * @returns A promise that resolves to a list of tree items for the UI.
     */
    private getMrsServiceChildren = async (element: MrsServiceTreeItem): Promise<TreeItem[]> => {
        if (element.entry.backend) {
            try {
                const treeItemList: TreeItem[] = [];

                // Get all MRS Schemas
                const schemas = await element.entry.backend.mrs.listSchemas(element.value.id);
                const schemaList: TreeItem[] = schemas.map((value) => {
                    return new MrsSchemaTreeItem(`${value.requestPath} (${value.name})`, value, element.entry);
                });

                // Get all MRS ContentSets
                const contentSets = await element.entry.backend.mrs.listContentSets(element.value.id);
                const contentSetsTreeItemList = contentSets.map((value) => {
                    return new MrsContentSetTreeItem(`${value.requestPath}`, value, element.entry);
                });

                // Get all MRS auth apps
                const authApps = await element.entry.backend.mrs.getAuthApps(element.value.id);
                const authAppList: TreeItem[] = authApps.map((value) => {
                    const name = value.name ?? "unknown";
                    const vendor = value.authVendor ?? "unknown";

                    return new MrsAuthAppTreeItem(`${name} (${vendor})`, value, element.entry);
                });

                return treeItemList.concat(schemaList, contentSetsTreeItemList, authAppList);
            } catch (error) {
                throw new Error("Error during retrieving MRS service content. " +
                    `Error: ${error instanceof Error ? error.message : String(error) ?? "<unknown>"}`);
            }
        }

        return [];
    };


    /**
     * Loads the list of MRS authentication apps.
     *
     * @param element The MRS authentication app element.
     *
     * @returns A promise that resolves to a list of tree items for the UI.
     */
    private getMrsAuthAppChildren = async (element: MrsAuthAppTreeItem): Promise<TreeItem[]> => {
        if (element.entry.backend) {
            try {
                // Get all MRS content files
                const users = await element.entry.backend.mrs.listUsers(undefined, element.value.id);
                const treeItemList: TreeItem[] = users.map((value) => {
                    return new MrsUserTreeItem(value.name ?? "unknown", value, element.entry);
                });

                return treeItemList;
            } catch (error) {
                throw new Error("Error during retrieving MRS users. " +
                    `Error: ${error instanceof Error ? error.message : String(error) ?? "<unknown>"}`);
            }
        } else {
            return [];
        }
    };

    /**
     * Loads the list of MRS content sets.
     *
     * @param element The MRS service element.
     *
     * @returns A promise that resolves to a list of tree items for the UI.
     */
    private getMrsContentSetChildren = async (element: MrsContentSetTreeItem): Promise<TreeItem[]> => {
        if (element.entry.backend) {
            try {
                // Get all MRS content files
                const contentFiles = await element.entry.backend.mrs.listContentFiles(element.value.id);
                const treeItemList: TreeItem[] = contentFiles.map((value) => {
                    return new MrsContentFileTreeItem(`${value.requestPath} (${formatBytes(value.size)})`, value,
                        element.entry);
                });

                return treeItemList;
            } catch (error) {
                throw new Error("Error during retrieving MRS content files. " +
                    `Error: ${error instanceof Error ? error.message : String(error) ?? "<unknown>"}`);
            }
        } else {
            return [];
        }
    };


    /**
     * Loads the list of MRS db objects.
     *
     * @param element The MRS service element.
     *
     * @returns A promise that resolves to a list of tree items for the UI.
     */
    private async listMrsDbObjects(element: MrsSchemaTreeItem): Promise<TreeItem[]> {
        if (element.entry.backend) {
            const objects = await element.entry.backend.mrs.listDbObjects(element.value.id);

            return objects.map((value) => {
                return new MrsDbObjectTreeItem(`${value.requestPath} (${value.name})`, value, element.entry);
            });
        }

        return [];
    }

    private refreshConnections = (data?: IDictionary): Promise<boolean> => {
        this.refresh(data?.item as TreeItem);

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
    private proxyRequest = (request: {
        provider: IWebviewProvider;
        original: IRequestListEntry<keyof IRequestTypeMap>;
    }): Promise<boolean> => {
        switch (request.original.requestType) {
            case "refreshConnections": {
                return this.refreshConnections();
            }

            default:
        }

        return Promise.resolve(false);
    };

}
