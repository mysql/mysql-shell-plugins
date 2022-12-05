/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { TreeDataProvider, TreeItem, EventEmitter, ProviderResult, Event, window } from "vscode";

import { requisitions } from "../../../../frontend/src/supplement/Requisitions";

import {
    DBType, IConnectionDetails, ShellInterface, ShellInterfaceSqlEditor,
} from "../../../../frontend/src/supplement/ShellInterface";
import { webSession } from "../../../../frontend/src/supplement/WebSession";

import { ConnectionTreeItem } from "./ConnectionTreeItem";
import { SchemaTreeItem } from "./SchemaTreeItem";
import { SchemaMySQLTreeItem } from "./SchemaMySQLTreeItem";
import { ISqliteConnectionOptions } from "../../../../frontend/src/communication/Sqlite";
import { SchemaGroupTreeItem } from "./SchemaGroupTreeItem";
import { SchemaItemGroupType } from "./SchemaIndex";

import { showStatusText } from "../../extension";
import { IDictionary } from "../../../../frontend/src/app-logic/Types";
import {
    AdminSectionTreeItem, AdminTreeItem, ConnectionMySQLTreeItem, ConnectionSqliteTreeItem, MrsDbObjectTreeItem,
    MrsSchemaTreeItem, MrsServiceTreeItem, MrsTreeItem, SchemaEventTreeItem, SchemaRoutineTreeItem,
    SchemaTableColumnTreeItem, SchemaTableForeignKeyTreeItem, SchemaTableIndexTreeItem, SchemaTableMySQLTreeItem,
    SchemaTableTreeItem, SchemaTableTriggerTreeItem, SchemaViewTreeItem, TableGroupTreeItem,
} from ".";
import { SchemaListTreeItem } from "./SchemaListTreeItem";
import { SchemaViewMySQLTreeItem } from "./SchemaViewMySQLTreeItem";
import { SchemaRoutineMySQLTreeItem } from "./SchemaRoutineMySQLTreeItem";
import { MrsContentSetTreeItem } from "./MrsContentSetTreeItem";
import { openSqlEditorConnection } from "../../utilitiesShellGui";
import { MrsContentFileTreeItem } from "./MrsContentFileTreeItem";
import { formatBytes } from "../../../../frontend/src/utilities/string-helpers";

export interface IConnectionEntry {
    id: string;
    details: IConnectionDetails;
    backend?: ShellInterfaceSqlEditor;
    schemas?: string[];
}

// A class to provide the entire tree structure for DB editor connections and the DB objects from them.
export class ConnectionsTreeDataProvider implements TreeDataProvider<TreeItem> {
    // A running number to identify uniquely every connection entry.
    private static nextId = 1;

    public connections: IConnectionEntry[] = [];

    private changeEvent = new EventEmitter<TreeItem | undefined>();

    private useDedicatedSchemaSubtree: boolean;

    public get onDidChangeTreeData(): Event<TreeItem | undefined> {
        return this.changeEvent.event;
    }

    public constructor() {
        // TODO: make this configurable.
        this.useDedicatedSchemaSubtree = false;
        requisitions.register("refreshConnections", this.refreshConnections);
    }

    public dispose(): void {
        requisitions.unregister("refreshConnections", this.refreshConnections);

        this.closeAllConnections();
    }

    public refresh(item?: TreeItem): void {
        if (!item) {
            void this.updateConnections().then(() => {
                this.changeEvent.fire(item);
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
                arguments: ["Server Status", element.entry.details.id],
            };

            const clientConnectionsCommand = {
                title: "Show Client Connections",
                command: "msg.showClientConnections",
                arguments: ["Client Connections", element.entry.details.id],
            };

            const performanceDashboardCommand = {
                title: "Show Performance Dashboard",
                command: "msg.showPerformanceDashboard",
                arguments: ["Performance Dashboard", element.entry.details.id],
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
            return this.listMrsServices(element);
        }

        if (element instanceof MrsServiceTreeItem) {
            return this.getMrsServiceChildren(element);
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
                    void entry.backend?.closeSession();
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
                                const status = await backend.mrs.status();

                                schemaList.unshift(
                                    new MrsTreeItem("MySQL REST Service", schema, entry, true, status.serviceEnabled));
                            } catch (reason) {
                                void window.showErrorMessage(
                                    `MySQL REST Service: ${reason instanceof Error ? reason.message : String(reason)}`);
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
    private async listMrsServices(element: MrsTreeItem): Promise<TreeItem[]> {
        if (element.entry.backend) {
            const services = await element.entry.backend.mrs.listServices();

            return services.map((value) => {
                return new MrsServiceTreeItem(`${value.urlContextRoot}`, value, element.entry);
            });
        }

        return [];
    }

    /**
     * Loads the list of MRS schemas.
     *
     * @param element The MRS service element.
     *
     * @returns A promise that resolves to a list of tree items for the UI.
     */
    private async listMrsSchemas(element: MrsServiceTreeItem): Promise<TreeItem[]> {
        if (element.entry.backend) {
            const schemas = await element.entry.backend.mrs.listSchemas(element.value.id);

            return schemas.map((value) => {
                return new MrsSchemaTreeItem(`${value.name} (${value.requestPath})`, value, element.entry);
            });
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
                // Get all MRS Schemas
                const schemas = await element.entry.backend.mrs.listSchemas(element.value.id);
                const treeItemList: TreeItem[] = schemas.map((value) => {
                    return new MrsSchemaTreeItem(`${value.name} (${value.requestPath})`, value, element.entry);
                });

                // Get all MRS ContentSets
                const contentSets = await element.entry.backend.mrs.listContentSets(element.value.id);
                const contentSetsTreeItemList = contentSets.map((value) => {
                    return new MrsContentSetTreeItem(`${value.requestPath}`, value, element.entry);
                });

                return treeItemList.concat(contentSetsTreeItemList);
            } catch (error) {
                throw new Error("Error during retrieving MRS content sets. " +
                    `Error: ${error instanceof Error ? error.message : String(error) ?? "<unknown>"}`);
            }
        }

        return [];
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
                return new MrsDbObjectTreeItem(`${value.name} (${value.requestPath})`, value, element.entry);
            });
        }

        return [];
    }

    private refreshConnections = (data?: IDictionary): Promise<boolean> => {
        this.refresh(data?.item as TreeItem);

        return Promise.resolve(true);
    };

}
