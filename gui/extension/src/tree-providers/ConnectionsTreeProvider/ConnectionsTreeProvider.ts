/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import { Event, EventEmitter, TreeDataProvider, TreeItem, commands, env, window, workspace } from "vscode";

import type {
    IDocumentCloseData, IDocumentOpenData, IRequestListEntry, IRequestTypeMap, IWebviewProvider,
} from "../../../../frontend/src/supplement/RequisitionTypes.js";
import { requisitions } from "../../../../frontend/src/supplement/Requisitions.js";

import {
    CdmEntityType, ConnectionDataModelEntry, ICdmRestRootEntry, ICdmSchemaEntry, cdmDbEntityTypes,
    type ConnectionDataModel, type ICdmConnectionEntry,
} from "../../../../frontend/src/data-models/ConnectionDataModel.js";

import type { IDialogRequest } from "../../../../frontend/src/app-logic/general-types.js";
import { ShellPromptResponseType, type IPromptReplyBackend } from "../../../../frontend/src/communication/Protocol.js";
import {
    systemSchemas, type AdminPageType, type ISubscriberActionType,
} from "../../../../frontend/src/data-models/data-model-types.js";
import { DBType, IConnectionDetails } from "../../../../frontend/src/supplement/ShellInterface/index.js";
import { convertErrorToString } from "../../../../frontend/src/utilities/helpers.js";
import { DBConnectionViewProvider } from "../../WebviewProviders/DBConnectionViewProvider.js";
import { showModalDialog } from "../../utilities.js";
import { AdminSectionTreeItem } from "./AdminSectionTreeItem.js";
import { AdminTreeItem } from "./AdminTreeItem.js";
import { ConnectionMySQLTreeItem } from "./ConnectionMySQLTreeItem.js";
import { ConnectionSqliteTreeItem } from "./ConnectionSqliteTreeItem.js";
import { MrsAuthAppTreeItem } from "./MrsAuthAppTreeItem.js";
import { MrsContentFileTreeItem } from "./MrsContentFileTreeItem.js";
import { MrsContentSetTreeItem } from "./MrsContentSetTreeItem.js";
import { MrsDbObjectTreeItem } from "./MrsDbObjectTreeItem.js";
import { MrsRouterServiceTreeItem } from "./MrsRouterServiceTreeItem.js";
import { MrsRouterTreeItem } from "./MrsRouterTreeItem.js";
import { MrsSchemaTreeItem } from "./MrsSchemaTreeItem.js";
import { MrsServiceTreeItem } from "./MrsServiceTreeItem.js";
import { MrsTreeItem } from "./MrsTreeItem.js";
import { MrsUserTreeItem } from "./MrsUserTreeItem.js";
import { SchemaEventTreeItem } from "./SchemaEventTreeItem.js";
import { SchemaGroupTreeItem } from "./SchemaGroupTreeItem.js";
import { SchemaMySQLTreeItem } from "./SchemaMySQLTreeItem.js";
import { SchemaRoutineMySQLTreeItem } from "./SchemaRoutineMySQLTreeItem.js";
import { SchemaRoutineTreeItem } from "./SchemaRoutineTreeItem.js";
import { SchemaSqliteTreeItem } from "./SchemaSqliteTreeItem.js";
import { SchemaTableColumnTreeItem } from "./SchemaTableColumnTreeItem.js";
import { SchemaTableForeignKeyTreeItem } from "./SchemaTableForeignKeyTreeItem.js";
import { SchemaTableGroupTreeItem } from "./SchemaTableGroupTreeItem.js";
import { SchemaTableIndexTreeItem } from "./SchemaTableIndexTreeItem.js";
import { SchemaTableMySQLTreeItem } from "./SchemaTableMySQLTreeItem.js";
import { SchemaTableSqliteTreeItem } from "./SchemaTableSqliteTreeItem.js";
import { SchemaTableTriggerTreeItem } from "./SchemaTableTriggerTreeItem.js";
import { SchemaViewMySQLTreeItem } from "./SchemaViewMySQLTreeItem.js";
import { SchemaViewSqliteTreeItem } from "./SchemaViewSqliteTreeItem.js";

/** A class to provide the entire tree structure for DB editor connections and the DB objects from them. */
export class ConnectionsTreeDataProvider implements TreeDataProvider<ConnectionDataModelEntry> {
    static #adminPageTypeToIcon = new Map<AdminPageType, string>([
        ["serverStatus", "adminServerStatus.svg"],
        ["clientConnections", "clientConnections.svg"],
        ["performanceDashboard", "adminPerformanceDashboard.svg"],
        ["lakehouseNavigator", "adminLakehouseNavigator.svg"],
    ]);

    /** The data model that provides the data for the tree. */
    public readonly dataModel: ConnectionDataModel;

    // List to keep track of visible MrsTreeItems
    private expandedMrsTreeItems = new Set<ICdmRestRootEntry>();

    private changeEvent = new EventEmitter<ConnectionDataModelEntry | undefined>();

    // When set a timer will be started to remove all current schemas from the tree.
    private clearCurrentSchemas = false;

    private openEditorCounts = new Map<ICdmConnectionEntry, number>();

    public get onDidChangeTreeData(): Event<ConnectionDataModelEntry | undefined> {
        return this.changeEvent.event;
    }

    public constructor(dataModel: ConnectionDataModel) {
        this.dataModel = dataModel;
        dataModel.autoRouterRefresh = false;
        dataModel.subscribe(this.dataModelChanged);

        // A connection refresh request can be scheduled from the frontend or within the extension.
        requisitions.register("refreshConnection", this.refreshConnection);
        requisitions.register("proxyRequest", this.proxyRequest);

        requisitions.register("showDialog", this.handleShowDialog);
    }

    public dispose(): void {
        requisitions.unregister("refreshConnection", this.refreshConnection);
        requisitions.unregister("proxyRequest", this.proxyRequest);

        void this.closeAllConnections();
    }

    public refresh(entry?: ConnectionDataModelEntry): void {
        if (!entry) {
            void this.dataModel.reloadConnections().then(() => {
                this.changeEvent.fire(entry);

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
            provider.currentSchemas.forEach((schema, id) => {
                const connection = this.dataModel.findConnectionEntryById(id);
                if (connection) {
                    connection.currentSchema = schema;
                }
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
        entry.parent.currentSchema = entry.caption;
        this.changeEvent.fire(entry.parent);
    }

    public resetCurrentSchemas(): void {
        this.dataModel.connections.forEach((connection) => {
            connection.currentSchema = "";
        });
        this.changeEvent.fire(undefined);
    }

    /**
     * This is the factory method for tree items that wrap a single data model entry.
     * @param entry The data model entry to create a tree item for.
     *
     * @returns The tree item that wraps the data model entry.
     */
    public getTreeItem(entry: ConnectionDataModelEntry): TreeItem {
        switch (entry.type) {
            case CdmEntityType.Connection: {
                if (entry.details.dbType === DBType.MySQL) {
                    return new ConnectionMySQLTreeItem(entry);
                }

                return new ConnectionSqliteTreeItem(entry);
            }

            case CdmEntityType.Admin: {
                return new AdminTreeItem(entry);
            }

            case CdmEntityType.AdminPage: {
                const icon = ConnectionsTreeDataProvider.#adminPageTypeToIcon.get(entry.pageType) ?? "";

                return new AdminSectionTreeItem(entry, icon, false, entry.command);
            }

            case CdmEntityType.MrsRoot: {
                return new MrsTreeItem(entry, true, entry.serviceEnabled);
            }

            case CdmEntityType.Schema: {
                const details = entry.connection.details;
                const isCurrent = entry.caption === entry.parent.currentSchema;
                if (details.dbType === DBType.MySQL) {
                    return new SchemaMySQLTreeItem(entry, isCurrent);
                }

                return new SchemaSqliteTreeItem(entry, isCurrent);
            }

            case CdmEntityType.SchemaGroup: {
                return new SchemaGroupTreeItem(entry);
            }

            case CdmEntityType.Table: {
                const details = entry.connection.details;
                if (details.dbType === DBType.MySQL) {
                    return new SchemaTableMySQLTreeItem(entry);
                }

                return new SchemaTableSqliteTreeItem(entry);
            }

            case CdmEntityType.TableGroup: {
                return new SchemaTableGroupTreeItem(entry);
            }

            case CdmEntityType.Column: {
                return new SchemaTableColumnTreeItem(entry);
            }

            case CdmEntityType.Index: {
                return new SchemaTableIndexTreeItem(entry);
            }

            case CdmEntityType.ForeignKey: {
                return new SchemaTableForeignKeyTreeItem(entry);
            }

            case CdmEntityType.Trigger: {
                return new SchemaTableTriggerTreeItem(entry);
            }

            case CdmEntityType.View: {
                const details = entry.connection.details;
                if (details.dbType === DBType.MySQL) {
                    return new SchemaViewMySQLTreeItem(entry);
                }

                return new SchemaViewSqliteTreeItem(entry);
            }

            case CdmEntityType.StoredProcedure: {
                const details = entry.connection.details;
                if (details.dbType === DBType.MySQL) {
                    return new SchemaRoutineMySQLTreeItem(entry);
                }

                return new SchemaRoutineTreeItem(entry);
            }

            case CdmEntityType.StoredFunction: {
                const details = entry.connection.details;
                if (details.dbType === DBType.MySQL) {
                    return new SchemaRoutineMySQLTreeItem(entry);
                }

                return new SchemaRoutineTreeItem(entry);
            }

            case CdmEntityType.Event: {
                return new SchemaEventTreeItem(entry);
            }

            case CdmEntityType.MrsService: {
                return new MrsServiceTreeItem(entry);
            }

            case CdmEntityType.MrsRouter: {
                return new MrsRouterTreeItem(entry);
            }

            case CdmEntityType.MrsSchema: {
                return new MrsSchemaTreeItem(entry);
            }

            case CdmEntityType.MrsContentSet: {
                return new MrsContentSetTreeItem(entry);
            }

            case CdmEntityType.MrsUser: {
                return new MrsUserTreeItem(entry);
            }

            case CdmEntityType.MrsAuthApp: {
                return new MrsAuthAppTreeItem(entry);
            }

            case CdmEntityType.MrsContentFile: {
                return new MrsContentFileTreeItem(entry);
            }

            case CdmEntityType.MrsDbObject: {
                return new MrsDbObjectTreeItem(entry);
            }

            case CdmEntityType.MrsRouterService: {
                return new MrsRouterServiceTreeItem(entry);
            }

            default: {
                return new TreeItem("Invalid entry type");
            }
        }
    }

    public getParent(entry: ConnectionDataModelEntry): ConnectionDataModelEntry | undefined {
        if (entry.type !== CdmEntityType.Connection) {
            return entry.parent;
        }

        return undefined;
    }

    public async getChildren(entry?: ConnectionDataModelEntry): Promise<ConnectionDataModelEntry[]> {
        if (!entry) {
            await this.dataModel.initialize();

            return this.dataModel.connections;
        }

        try {
            // Initialize the entry if it hasn't been done yet.
            await entry.refresh?.((result?: string | Error): void => {
                if (result instanceof Error) {
                    void window.showErrorMessage(result.message);
                } else if (result) {
                    void window.setStatusBarMessage(result, 15000);
                }
            });
        } catch (error) {
            void window.showErrorMessage(convertErrorToString(error));

            return [];
        }

        let children = entry.getChildren?.() ?? [];

        if (entry.type === CdmEntityType.Connection) {
            if (!entry.state.payload?.showSystemSchemas) {
                // Remove all system schemas from the child list.
                children = children.filter((schema) => {
                    return !systemSchemas.has(schema.caption);
                });
            }
        }

        return children;
    }

    public async closeAllConnections(): Promise<void> {
        return this.dataModel.closeAllConnections();
    }

    /**
     * When assigned to the TreeView.onDidExpandElement it updates the list of expanded MrsTreeView nodes.
     *
     * @param entry The tree entry that got expanded.
     */
    public didExpandElement(entry: ConnectionDataModelEntry): void {
        entry.state.expanded = true;
        entry.state.expandedOnce = true;
        if (entry.type === CdmEntityType.MrsRoot) {
            this.expandedMrsTreeItems.add(entry);
        }
    }

    /**
     * When assigned to the TreeView.onDidCollapseElement it updates the list of expanded MrsTreeView nodes.
     *
     * @param entry The tree entry that got collapsed.
     */
    public didCollapseElement(entry: ConnectionDataModelEntry): void {
        entry.state.expanded = false;
        if (entry.type === CdmEntityType.MrsRoot) {
            this.expandedMrsTreeItems.delete(entry);
        }
    }

    public copyNameToClipboard(entry: ConnectionDataModelEntry): void {
        void env.clipboard.writeText(entry.caption).then(() => {
            void window.showInformationMessage("The name was copied to the system clipboard");
        });
    }

    /**
     * Gets the CREATE statement for the given database object.
     *
     * @param entry The database object to get the CREATE statement for.
     * @param entryType The database type name of the database object (e.g. "table", "view" etc.).
     * @param withDelimiter If true, the statement will be wrapped in a delimiter block.
     * @param withDrop If true, the statement will be preceded by a DROP statement.
     *
     * @returns The CREATE statement for the given database object.
     */
    public async getCreateSqlScript(entry: ConnectionDataModelEntry, entryType: string, withDelimiter = false,
        withDrop = false): Promise<string> {
        let sql = "";

        const configuration = workspace.getConfiguration(`msg.dbEditor`);
        const uppercaseKeywords = configuration.get("upperCaseKeywords", true);
        const procedureKeyword = uppercaseKeywords ? "PROCEDURE" : "procedure";
        const functionKeyword = uppercaseKeywords ? "FUNCTION" : "function";
        const dropKeyword = uppercaseKeywords ? "DROP" : "drop";
        const delimiterKeyword = uppercaseKeywords ? "DELIMITER" : "delimiter";
        entryType = uppercaseKeywords ? entryType.toUpperCase() : entryType.toLowerCase();

        const qualifiedName = this.dataModel.getQualifiedName(entry);
        const data = await entry.connection.backend.execute(`show create ${entryType} ${qualifiedName}`);
        const isRoutine = entry.type === CdmEntityType.StoredProcedure || entry.type === CdmEntityType.StoredFunction;
        if (data) {
            if (data.rows && data.rows.length > 0) {
                const firstRow = data.rows[0] as string[];
                const index = isRoutine ? 2 : 1;
                if (firstRow.length > index) {
                    sql = firstRow[index];

                    if (isRoutine) {
                        // The SHOW CREATE PROCEDURE / FUNCTION statements do not return the fully qualified
                        // name including the schema, just the name of the procedure / functions with backticks
                        sql = sql.replaceAll(/PROCEDURE `(.*?)`/gm, `${procedureKeyword} ${qualifiedName}`);
                        sql = sql.replaceAll(/FUNCTION `(.*?)`/gm, `${functionKeyword} ${qualifiedName}`);
                    }

                    if (withDelimiter) {
                        if (withDrop) {
                            const name = Array.from(sql.matchAll(/PROCEDURE `(.*?)`/gm), (m) => { return m[1]; });
                            if (name.length > 0) {
                                sql = `${dropKeyword} ${procedureKeyword} ${qualifiedName}%%\n${sql}`;
                            } else {
                                sql = `${dropKeyword} ${functionKeyword} ${qualifiedName}%%\n${sql}`;
                            }
                        }
                        sql = `${delimiterKeyword} %%\n${sql}%%\n${delimiterKeyword} ;`;
                    }
                }
            }
        }

        if (sql === "") {
            throw new Error("Failed to get CREATE statement.");
        }

        return sql;
    }

    public async copyCreateScriptToClipboard(entry: ConnectionDataModelEntry, dbType: string, withDelimiter = false,
        withDrop = false): Promise<void> {
        try {
            const sql = await this.getCreateSqlScript(entry, dbType, withDelimiter, withDrop);

            await env.clipboard.writeText(sql);
            void window.showInformationMessage("The create script was copied to the system clipboard");
        } catch (error) {
            void window.showErrorMessage("Error while getting create script: " + String(error));
        }
    }

    /**
     * If the given item is one of the database objects, it will be dropped (after confirmation by the user).
     *
     * @param entry The item to drop. Only has an effect if it is a database object.
     */
    public dropItem(entry: ConnectionDataModelEntry): void {
        if (!cdmDbEntityTypes.has(entry.type)) {
            return;
        }

        const message = `Do you want to drop the ${entry.type} ${entry.caption}?`;
        const okText = `Drop ${entry.caption}`;
        void showModalDialog(message, okText, "This operation cannot be reverted!").then(async (accepted) => {
            if (accepted) {
                try {
                    await this.dataModel.removeEntry(entry);
                    await this.dataModel.dropItem(entry);

                    // TODO: refresh only the affected connection.
                    void commands.executeCommand("msg.refreshConnections");
                    void window.showInformationMessage(`The object ${entry.caption} has been dropped successfully.`);
                } catch (error) {
                    const message = convertErrorToString(error);
                    void window.showErrorMessage(`Error dropping the object: ${message}`);
                }
            }
        });
    }

    private refreshConnection = (data?: ICdmConnectionEntry): Promise<boolean> => {
        this.refresh(data);

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

                const connection = this.dataModel.findConnectionEntryById(response.connectionId);
                if (connection) {
                    connection.currentSchema = response.schema;

                    return this.refreshConnection(connection);
                }

                break;
            }

            case "refreshConnection": {
                const data = request.original.parameter as ICdmConnectionEntry;

                return this.refreshConnection(data);
            }

            case "connectionAdded": {
                await this.dataModel.reloadConnections();
                this.refresh();

                break;
            }

            case "connectionUpdated": {
                const response = request.original.parameter as IConnectionDetails;
                const connection = this.dataModel.updateConnectionDetails(response);
                this.refresh(connection);

                break;
            }

            case "connectionRemoved": {
                await this.dataModel.reloadConnections();

                this.refresh();

                break;
            }

            case "documentOpened": {
                const response = request.original.parameter as IDocumentOpenData;

                const connection = this.dataModel.findConnectionEntryById(response.connection?.id ?? -1);
                if (connection) {
                    const count = this.openEditorCounts.get(connection) ?? 0;
                    this.openEditorCounts.set(connection, count + 1);
                }

                return Promise.resolve(true);
            }

            case "documentClosed": {
                const response = request.original.parameter as IDocumentCloseData;

                if (response.connectionId) {
                    const connection = this.dataModel.findConnectionEntryById(response.connectionId);
                    if (connection) {
                        let count = this.openEditorCounts.get(connection);
                        if (count !== undefined) {
                            --count;
                            this.openEditorCounts.set(connection, count);
                            if (count === 0) {
                                connection.currentSchema = "";

                                return this.refreshConnection(connection);
                            }
                        }
                    }
                }

                return Promise.resolve(true);
            }

            case "updateMrsRoot": {
                const response = request.original.parameter as string;
                const entry = this.dataModel.findConnectionEntryById(parseInt(response, 10));

                if (entry) {
                    void entry.mrsEntry?.refresh?.().then(() => {
                        this.changeEvent.fire(entry);
                    });
                }

                return Promise.resolve(true);
            }

            default:
        }

        return Promise.resolve(false);
    };

    private dataModelChanged = (list: Readonly<Array<ISubscriberActionType<ConnectionDataModelEntry>>>): void => {
        list.forEach((action) => {
            switch (action.action) {
                case "add": {
                    this.changeEvent.fire(action.entry);
                    break;
                }

                case "remove": {
                    this.changeEvent.fire(action.entry);
                    break;
                }

                case "update": {
                    this.changeEvent.fire(action.entry);
                    break;
                }

                default:
            }
        });
    };

    private handleShowDialog = async (request: IDialogRequest): Promise<boolean> => {
        if (request.id !== "shellConfirm" || !request.parameters) {
            return false;
        }

        const message = request.parameters.prompt as string;
        let accept = request.parameters.accept as string;
        if (accept.startsWith("&")) {
            accept = accept.substring(1);
        }

        const value = await window.showInputBox({ title: message, password: false, value: "N" });
        const backend = request.data!.backend as IPromptReplyBackend;
        const requestId = request.data!.requestId as string;
        if (value) {
            void backend.sendReply(requestId, ShellPromptResponseType.Ok, value);
        } else {
            void backend.sendReply(requestId, ShellPromptResponseType.Cancel, "");
        }


        return true;
    };
}
