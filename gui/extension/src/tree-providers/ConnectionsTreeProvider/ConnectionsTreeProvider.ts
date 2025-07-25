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
    IConnectionInfo,
    IDocumentCloseData, IDocumentOpenData, IRequestListEntry, IRequestTypeMap,
    IWebviewProvider,
} from "../../../../frontend/src/supplement/RequisitionTypes.js";
import { requisitions } from "../../../../frontend/src/supplement/Requisitions.js";

import {
    CdmEntityType, ConnectionDataModelEntry, ICdmRestRootEntry, ICdmSchemaEntry, cdbDbEntityTypeName, cdmDbEntityTypes,
    type ConnectionDataModel, type ConnectionDataModelNoGroupEntry, type ICdmConnectionEntry,
} from "../../../../frontend/src/data-models/ConnectionDataModel.js";

import { ui } from "../../../../frontend/src/app-logic/UILayer.js";
import type { IDialogRequest } from "../../../../frontend/src/app-logic/general-types.js";
import { ShellPromptResponseType, type IPromptReplyBackend } from "../../../../frontend/src/communication/Protocol.js";
import {
    systemSchemas, type AdminPageType, type ISubscriberActionType,
} from "../../../../frontend/src/data-models/data-model-types.js";
import { DBType, IConnectionDetails, IFolderPath } from "../../../../frontend/src/supplement/ShellInterface/index.js";
import { convertErrorToString } from "../../../../frontend/src/utilities/helpers.js";
import { DBConnectionViewProvider } from "../../WebviewProviders/DBConnectionViewProvider.js";
import { AdminSectionTreeItem } from "./AdminSectionTreeItem.js";
import { AdminTreeItem } from "./AdminTreeItem.js";
import { ConnectionGroupTreeItem } from "./ConnectionGroupTreeItem.js";
import { ConnectionMySQLTreeItem } from "./ConnectionMySQLTreeItem.js";
import { ConnectionSqliteTreeItem } from "./ConnectionSqliteTreeItem.js";
import { MrsAuthAppGroupTreeItem } from "./MrsAuthAppGroupTreeItem.js";
import { MrsAuthAppTreeItem } from "./MrsAuthAppTreeItem.js";
import { MrsContentFileTreeItem } from "./MrsContentFileTreeItem.js";
import { MrsContentSetTreeItem } from "./MrsContentSetTreeItem.js";
import { MrsDbObjectTreeItem } from "./MrsDbObjectTreeItem.js";
import { MrsRouterGroupTreeItem } from "./MrsRouterGroupTreeItem.js";
import { MrsRouterServiceTreeItem } from "./MrsRouterServiceTreeItem.js";
import { MrsRouterTreeItem } from "./MrsRouterTreeItem.js";
import { MrsSchemaTreeItem } from "./MrsSchemaTreeItem.js";
import { MrsServiceAuthAppTreeItem } from "./MrsServiceAuthAppTreeItem.js";
import { MrsServiceTreeItem } from "./MrsServiceTreeItem.js";
import { MrsTreeItem } from "./MrsTreeItem.js";
import { MrsUserTreeItem } from "./MrsUserTreeItem.js";
import { SchemaEventTreeItem } from "./SchemaEventTreeItem.js";
import { SchemaGroupTreeItem } from "./SchemaGroupTreeItem.js";
import { SchemaMySQLTreeItem } from "./SchemaMySQLTreeItem.js";
import { SchemaRoutineMySQLTreeItem } from "./SchemaRoutineMySQLTreeItem.js";
import { SchemaLibraryMySQLTreeItem } from "./SchemaLibraryMySQLTreeItem.js";
import { SchemaRoutineTreeItem } from "./SchemaRoutineTreeItem.js";
import { SchemaLibraryTreeItem } from "./SchemaLibraryTreeItem.js";
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
    private static adminPageTypeToIcon = new Map<AdminPageType, string>([
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

    // When set the data model is being updated and no refresh should be triggered.
    private updating = false;

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
        requisitions.unregister("proxyRequest", this.proxyRequest);
        requisitions.unregister("refreshConnection", this.refreshConnection);

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
                void this.dataModel.findConnectionEntryById(id).then((connection) => {
                    if (connection) {
                        connection.currentSchema = schema;
                    }
                });
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
        this.refresh(entry.parent);
    }

    public resetCurrentSchemas(): void {
        this.dataModel.roots.forEach((connection) => {
            if (connection.type === CdmEntityType.Connection) {
                connection.currentSchema = "";
            }
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
            case CdmEntityType.ConnectionGroup: {
                return new ConnectionGroupTreeItem(entry);
            }

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
                const icon = ConnectionsTreeDataProvider.adminPageTypeToIcon.get(entry.pageType) ?? "";

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

            case CdmEntityType.Library: {
                const details = entry.connection.details;
                if (details.dbType === DBType.MySQL) {
                    return new SchemaLibraryMySQLTreeItem(entry);
                }

                return new SchemaLibraryTreeItem(entry);
            }

            case CdmEntityType.Event: {
                return new SchemaEventTreeItem(entry);
            }

            case CdmEntityType.MrsService: {
                return new MrsServiceTreeItem(entry);
            }

            case CdmEntityType.MrsRouterGroup: {
                return new MrsRouterGroupTreeItem(entry);
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

            case CdmEntityType.MrsAuthAppGroup: {
                return new MrsAuthAppGroupTreeItem(entry);
            }

            case CdmEntityType.MrsAuthApp: {
                return new MrsAuthAppTreeItem(entry);
            }

            case CdmEntityType.MrsServiceAuthApp: {
                return new MrsServiceAuthAppTreeItem(entry);
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
        if (entry.type !== CdmEntityType.ConnectionGroup) {
            return entry.parent;
        }

        return undefined;
    }

    public async getChildren(entry?: ConnectionDataModelEntry): Promise<ConnectionDataModelEntry[]> {
        if (!entry) {
            await this.dataModel.initialize();

            return this.sortGroupMembers(this.dataModel.roots);
        }

        try {
            this.updating = true;

            // Initialize the entry if it hasn't been done yet.
            await entry.refresh?.((result?: string | Error): void => {
                if (result instanceof Error) {
                    void ui.showErrorMessage(result.message, {});
                } else if (result) {
                    void window.setStatusBarMessage(result, 2000);
                }
            });
        } catch (error) {
            void ui.showErrorMessage(convertErrorToString(error), {});

            return [];
        } finally {
            this.updating = false;
        }

        let children = entry.getChildren?.() ?? [];

        if (entry.type === CdmEntityType.Connection) {
            if (!entry.state.payload?.showSystemSchemas) {
                // Remove all system schemas from the child list.
                children = children.filter((schema) => {
                    return !systemSchemas.has(schema.caption);
                });
            }
        } else if (entry.type === CdmEntityType.ConnectionGroup) {
            children = this.sortGroupMembers(children);
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
            void ui.showInformationMessage("The name was copied to the system clipboard", {});
        });
    }

    /**
     * Gets the CREATE statement for the given database object.
     *
     * @param entry The database object to get the CREATE statement for.
     * @param entryType The database type name of the database object (e.g. "table", "view" etc.).
     * @param withDelimiter If true, the statement will be wrapped in a delimiter block.
     * @param withDrop If true, the statement will be preceded by a DROP statement.
     * @param editRoutine If true, the script is created for modifying a routine
     * @returns The CREATE statement for the given database object.
     */
    public async getCreateSqlScript(entry: ConnectionDataModelNoGroupEntry, entryType: string, withDelimiter = false,
        withDrop = false, editRoutine = false): Promise<string> {
        let sql = "";

        const configuration = workspace.getConfiguration(`msg.dbEditor`);
        const uppercaseKeywords = configuration.get("upperCaseKeywords", true);
        const procedureKeyword = uppercaseKeywords ? "PROCEDURE" : "procedure";
        const functionKeyword = uppercaseKeywords ? "FUNCTION" : "function";
        const libraryKeyword = uppercaseKeywords ? "LIBRARY" : "library";
        const dropKeyword = uppercaseKeywords ? "DROP" : "drop";
        const delimiterKeyword = uppercaseKeywords ? "DELIMITER" : "delimiter";
        entryType = uppercaseKeywords ? entryType.toUpperCase() : entryType.toLowerCase();

        const qualifiedName = this.dataModel.getQualifiedName(entry);
        const data = await entry.connection.backend.execute(`show create ${entryType} ${qualifiedName}`);

        // Same logic applies for libraries as for the routines.
        const isRoutine = entry.type === CdmEntityType.StoredProcedure
            || entry.type === CdmEntityType.StoredFunction
            || entry.type === CdmEntityType.Library;
        if (data) {
            if (data.rows && data.rows.length > 0) {
                const firstRow = data.rows[0] as string[];
                const index = isRoutine ? 2 : 1;
                if (firstRow.length > index) {
                    sql = firstRow[index];

                    if (isRoutine) {
                        // The SHOW CREATE PROCEDURE / FUNCTION / LIBRARY statements do not return the fully qualified
                        // name including the schema, just the name of the procedure / functions with backticks
                        sql = sql.replaceAll(/PROCEDURE `(.*?)`/gm, `${procedureKeyword} ${qualifiedName}`);
                        sql = sql.replaceAll(/FUNCTION `(.*?)`/gm, `${functionKeyword} ${qualifiedName}`);
                        sql = sql.replaceAll(/LIBRARY `(.*?)`/gm, `${libraryKeyword} ${qualifiedName}`);

                        if (withDelimiter) {
                            const isExternalLangRoutine = (entry).language === "JAVASCRIPT"
                                || (entry).language === "WASM";
                            if (withDrop) {
                                if ((entry).type === CdmEntityType.StoredProcedure) {
                                    sql = `${dropKeyword} ${procedureKeyword} ${qualifiedName}`
                                        + `${isExternalLangRoutine ? ";" : "%%"}\n${sql}`;
                                } else if ((entry).type === CdmEntityType.StoredFunction) {
                                    sql = `${dropKeyword} ${functionKeyword} ${qualifiedName}`
                                        + `${isExternalLangRoutine ? ";" : "%%"}\n${sql}`;
                                } else {
                                    sql = `${dropKeyword} ${libraryKeyword} ${qualifiedName}`
                                        + `${isExternalLangRoutine ? ";" : "%%"}\n${sql}`;
                                }
                            }
                            sql = !isExternalLangRoutine
                                ? `${delimiterKeyword} %%\n${sql}%%\n${delimiterKeyword} ;`
                                : editRoutine ? `${sql};` : `${delimiterKeyword} ;\n${sql};\n${delimiterKeyword} ;`;
                        }
                    }
                }
            }
        }

        if (sql === "") {
            throw new Error("Failed to get CREATE statement.");
        }

        return sql;
    }

    public async copyCreateScriptToClipboard(entry: ConnectionDataModelNoGroupEntry, dbType: string,
        withDelimiter = false, withDrop = false): Promise<void> {
        try {
            const sql = await this.getCreateSqlScript(entry, dbType, withDelimiter, withDrop);

            await env.clipboard.writeText(sql);
            void ui.showInformationMessage("The create script was copied to the system clipboard", {});
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Error while getting create script: ${message}`, {});
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

        const typeName = cdbDbEntityTypeName.get(entry.type)!;
        const message = `Do you want to drop the ${typeName} ${entry.caption}?`;
        const okText = `Drop ${entry.caption}`;
        void ui.showInformationMessage(message, { modal: true, detail: "This operation cannot be reverted!" },
            okText).then(async (answer) => {
                if (answer === okText) {
                    try {
                        await this.dataModel.removeEntry(entry);
                        await this.dataModel.dropItem(entry);

                        // TODO: refresh only the affected connection.
                        void commands.executeCommand("msg.refreshConnections");
                        void ui.showInformationMessage(`The object ${entry.caption} has been dropped successfully.`,
                            {});
                    } catch (error) {
                        const message = convertErrorToString(error);
                        void ui.showErrorMessage(`Error dropping the object: ${message}`, {});
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
                    editorId: string, connectionInfo: IConnectionInfo, schema: string;
                };

                const connection = await this.dataModel.findConnectionEntryById(response.connectionInfo.connectionId,
                    response.connectionInfo.folderPath);
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

            case "refreshConnectionGroup": {
                const data = request.original.parameter as IFolderPath | undefined;
                if (data?.id === undefined || data.id < 0) {
                    this.refresh();
                } else {
                    const group = await this.dataModel.findConnectionGroupEntryById(data.id, data.caption);
                    this.refresh(group);
                }
                break;
            }

            case "connectionAdded": {
                await this.dataModel.reloadConnections();
                this.refresh();

                break;
            }

            case "connectionUpdated": {
                const response = request.original.parameter as IConnectionDetails;
                const connection = await this.dataModel.updateConnectionDetails(response);
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

                const connection = await this.dataModel.findConnectionEntryById(response.connection?.id ?? -1,
                    response.connection?.folderPath);
                if (connection) {
                    const count = this.openEditorCounts.get(connection) ?? 0;
                    this.openEditorCounts.set(connection, count + 1);
                }

                return Promise.resolve(true);
            }

            case "documentClosed": {
                const response = request.original.parameter as IDocumentCloseData;

                const { connectionId, folderPath } = response.connectionInfo ?? {};
                if (connectionId) {
                    const connection = await this.dataModel.findConnectionEntryById(connectionId, folderPath);
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
                const response = request.original.parameter as IConnectionInfo;
                const entry = await this.dataModel.findConnectionEntryById(response.connectionId, response.folderPath);

                if (entry) {
                    void entry.mrsEntry?.refresh?.(); // Tree item refresh happens in the data model change handler.

                    return Promise.resolve(true);
                }

                break;
            }

            default:
        }

        return Promise.resolve(false);
    };

    private dataModelChanged = (list: Readonly<Array<ISubscriberActionType<ConnectionDataModelEntry>>>): void => {
        if (this.updating) {
            return;
        }

        list.forEach((action) => {
            switch (action.action) {
                case "add": {
                    this.changeEvent.fire(action.entry?.parent);
                    break;
                }

                case "remove": {
                    const parent = action.entry?.parent;
                    if (parent?.type === CdmEntityType.ConnectionGroup && parent?.folderPath.id === 1) {
                        // A top level entry was removed, so refresh the entire tree.
                        this.changeEvent.fire(undefined);
                    } else {
                        this.changeEvent.fire(action.entry?.parent);
                    }
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

    /**
     * If enabled in the settings, sorts the group members by their type (group first, then the rest).
     *
     * @param children The children to sort.
     *
     * @returns The sorted children or the original children if sorting is disabled.
     */
    private sortGroupMembers(children: ConnectionDataModelEntry[]) {
        const configuration = workspace.getConfiguration("msg.dbEditor");
        const foldersFirst = configuration.get("connectionBrowser.sortFoldersFirst", false);
        if (foldersFirst) {
            children = children.sort((a, b) => {
                const aIsGroup = a.type === CdmEntityType.ConnectionGroup;
                const bIsGroup = b.type === CdmEntityType.ConnectionGroup;

                if (aIsGroup && !bIsGroup) {
                    return -1;
                } else if (!aIsGroup && bIsGroup) {
                    return 1;
                }

                return 0;
            });
        }

        return children;
    }

}
