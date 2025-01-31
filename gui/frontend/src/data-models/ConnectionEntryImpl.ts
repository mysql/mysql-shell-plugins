/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General License: , version .=> 0,
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
 * the GNU General License: , version 2.0, for mor => details.
 *
 * You should have received a copy of the GNU Genera => License:
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { ui } from "../app-logic/UILayer.js";
import type { Mutable } from "../app-logic/general-types.js";
import type { IMySQLConnectionOptions } from "../communication/MySQL.js";
import type { IOpenConnectionData, IShellPasswordFeedbackRequest } from "../communication/ProtocolGui.js";
import type { ISqliteConnectionOptions } from "../communication/Sqlite.js";
import { ShellPromptHandler } from "../modules/common/ShellPromptHandler.js";
import { ShellInterface } from "../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceSqlEditor } from "../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { DBType, type IConnectionDetails } from "../supplement/ShellInterface/index.js";
import { convertErrorToString, uuid } from "../utilities/helpers.js";
import {
    CdmEntityType, ICdmAdminEntry, ICdmConnectionEntry, ICdmRestRootEntry, ICdmSchemaEntry,
    type ConnectionDataModelEntry, type ICdmAdminPageEntry,
    type ICdmRestAuthAppGroupEntry,
    type ICdmRestRouterGroupEntry,
} from "./ConnectionDataModel.js";
import { createDataModelEntryState } from "./data-model-helpers.js";
import type { ICdmUpdater, IDataModelEntryState, ProgressCallback } from "./data-model-types.js";

export type ConnectionReadyCallback = (entry: ICdmConnectionEntry, progress?: ProgressCallback) => void;

/** An implementation of the ICdmConnectionEntry. This interface has more tasks than just holding data. */
export class ConnectionEntryImpl implements ICdmConnectionEntry {
    public readonly id = uuid();
    public readonly type = CdmEntityType.Connection;
    public readonly details: IConnectionDetails;
    public readonly backend = new ShellInterfaceSqlEditor();
    public readonly schemaEntries: ICdmSchemaEntry[] = [];
    public readonly caption: string;
    public readonly state = createDataModelEntryState();

    public schemaNames: string[] = [];

    public mrsEntry?: ICdmRestRootEntry;
    public adminEntry?: ICdmAdminEntry;

    private open: boolean = false;
    private updater: ICdmUpdater;

    private ignoreMrsUpgrade: boolean = false;

    #currentSchema: string = "";

    public constructor(name: string, details: IConnectionDetails, initializer: ICdmUpdater) {
        this.caption = name;
        this.details = details;
        this.updater = initializer;
    }

    public get connection(): ICdmConnectionEntry {
        return this;
    }

    public get isOpen(): boolean {
        return this.open;
    }

    public async close(): Promise<void> {
        await this.closeConnection();
    }

    public get currentSchema(): string {
        return this.#currentSchema;
    }

    public set currentSchema(value: string) {
        if (this.#currentSchema !== value) {
            this.#currentSchema = value;
            void this.backend.setCurrentSchema(value);
        }
    }

    public async initialize(callback?: ProgressCallback): Promise<boolean> {
        callback?.("Starting editor session...");
        await this.backend.startSession(String(this.details.id) + "ConnectionDataModel");
        callback?.("Session created, opening new connection...");

        try {
            if (this.details.dbType === DBType.Sqlite) {
                const options = this.details.options as ISqliteConnectionOptions;

                // Before opening the connection check the DB file, if this is an sqlite connection.
                if (await ShellInterface.core.validatePath(options.dbFile)) {
                    this.open = await this.openConnection(callback);
                    if (this.open) {
                        await this.updateChildren(callback);
                        await this.updater.updateEntry(this, callback);
                    }
                } else {
                    // If the path is not ok then we might have to create the DB file first.
                    try {
                        await ShellInterface.core.createDatabaseFile(options.dbFile);
                        await this.updateChildren(callback);
                        await this.updater.updateEntry(this, callback);
                    } catch (reason) {
                        const error = new Error("DB Creation Error", { cause: reason });
                        if (callback) {
                            callback(error);

                            return false;
                        } else {
                            throw error;
                        }
                    }
                }
            } else {
                this.open = await this.openConnection(callback);
                if (this.open) {
                    await this.updateChildren(callback);
                    await this.updater.updateEntry(this, callback);
                }
            }

            callback?.();

            (this.state as Mutable<IDataModelEntryState>).initialized = true;

            return this.open;
        } catch (reason) {
            // Something went wrong. Close the session but keep the connection initialized.
            await this.backend.closeSession();

            const message = convertErrorToString(reason);
            const error = new Error(`The connection could not be opened: ${message}`);

            throw error;
        }
    }

    public async refresh(callback?: ProgressCallback): Promise<boolean> {
        if (!this.state.initialized) {
            return this.initialize(callback);
        }

        await this.updateChildren(callback);
        await this.updater.updateEntry(this, callback);

        return true;
    }

    public async duplicate(): Promise<ICdmConnectionEntry> {
        const newEntry = new ConnectionEntryImpl(this.caption, this.details, this.updater);
        await newEntry.initialize();

        return newEntry;
    }

    public getChildren(): ConnectionDataModelEntry[] {
        const children: ConnectionDataModelEntry[] = [];
        if (this.mrsEntry) {
            children.push(this.mrsEntry);
        }

        if (this.adminEntry) {
            children.push(this.adminEntry);
        }

        children.push(...this.schemaEntries);

        return children;
    }

    /**
     * Opens this connection once all verification was done. Used when opening a connection the first time.
     *
     * @param callback A callback to report progress.
     *
     * @returns A promise which fulfills once the connection is open.
     */
    private async openConnection(callback?: ProgressCallback): Promise<boolean> {
        // Generate an own request ID, as we may need that for reply requests from the backend.
        const requestId = uuid();
        let connectionData: IOpenConnectionData | undefined;
        await this.backend.openConnection(this.details.id, requestId, ((response, requestId) => {
            if (typeof response.result === "string") {
                callback?.(response.result);
            } else if (!ShellPromptHandler.handleShellPrompt(response.result as IShellPasswordFeedbackRequest,
                requestId, this.backend)) {
                connectionData = response.result as IOpenConnectionData;
            }
        }));

        if (!connectionData) {
            return false;
        }

        if (connectionData.currentSchema) {
            this.#currentSchema = connectionData.currentSchema;
        } else if (this.details.dbType === DBType.MySQL) {
            this.#currentSchema = (this.details.options as IMySQLConnectionOptions).schema ?? "";
        }

        if (connectionData.info.version) {
            const versionParts = connectionData.info.version.split(".");
            const major = parseInt(versionParts[0], 10);
            const minor = parseInt(versionParts[1], 10);
            const patch = parseInt(versionParts[2], 10);

            this.details.version = major * 10000 + minor * 100 + patch;
        }

        this.details.sqlMode = connectionData.info.sqlMode;
        this.details.edition = connectionData.info.edition;
        this.details.heatWaveAvailable = connectionData.info.heatWaveAvailable;
        this.details.mleAvailable = connectionData.info.mleAvailable;

        return true;
    }

    /**
     * Closes the connection and releases all resources.
     */
    private async closeConnection(): Promise<void> {
        await this.backend.closeSession();

        this.open = false;
        this.#currentSchema = "";
        (this.state as Mutable<IDataModelEntryState>).initialized = false;
        this.mrsEntry = undefined;
        this.adminEntry = undefined;
        this.schemaEntries.length = 0;
    }

    /**
     * Checks if MRS is configured for this connection and updates the MRS data model entry accordingly.
     *
     * @param callback A callback to report progress.
     *
     * @returns A promise that resolves once the work is done.
     */
    private async updateChildren(callback?: ProgressCallback): Promise<void> {
        if (this.details.dbType === DBType.MySQL && !this.adminEntry) {
            this.adminEntry = {
                parent: this,
                id: uuid(),
                type: CdmEntityType.Admin,
                state: createDataModelEntryState(false, true),
                caption: "MySQL Administration",
                connection: this,
                pages: [],
                getChildren: () => { return this.adminEntry?.pages ?? []; },
            };

            if (this.adminEntry) {
                this.addAdminSections(this.adminEntry);
            }
        }

        callback?.("Determining MRS support");
        this.schemaNames = await this.backend.getCatalogObjects("Schema");

        // If the MRS metadata schema exists, add the MRS item in the parent entry.
        if (this.details.dbType === DBType.MySQL && this.schemaNames.includes("mysql_rest_service_metadata")) {
            try {
                if (!this.mrsEntry) {
                    let addMrsItem = true;
                    const status = await this.backend.mrs.status();

                    if (status.serviceBeingUpgraded) {
                        void ui.showInformationNotification(
                            "The MySQL REST Service is currently being updated. Please refresh the list of " +
                            "DB Connections after the update has been completed for check the error log at " +
                            "~/.mysqlsh-gui/plugin_data/mrs_plugin/mrs_metadata_schema_update_log.txt");

                        return;
                    }

                    if (!this.ignoreMrsUpgrade) {
                        // Only do the upgrade check if there wasn't any before, which the user wanted to ignore.
                        if (status.majorUpgradeRequired) {
                            // If a major MRS metadata schema upgrade is required, the MRS tree item should
                            // only be displayed if the user agrees to upgrade i.e. drop and re-create the
                            // schema.
                            addMrsItem = false;
                            let answer = await ui.confirm(
                                "This MySQL Shell version requires a new major version of the MRS metadata " +
                                "schema. The latest available version is " +
                                `${String(status.availableMetadataVersion)}. The currently deployed ` +
                                `schema version is ${String(status.currentMetadataVersion)}. You need to ` +
                                "downgrade the MySQL Shell version or drop and recreate the MRS metadata " +
                                "schema. Do you want to drop and recreate the MRS metadata schema? " +
                                "WARNING: All existing MRS data will be lost.",
                                "Drop and Recreate", "Disable MRS features");

                            if (answer === "Drop and Recreate") {
                                answer = await ui.confirm(
                                    "Are you really sure you want to drop and recreate the MRS metadata " +
                                    "schema? WARNING: All existing MRS data will be lost."
                                    , "Yes", "No");

                                if (answer === "Yes") {
                                    const statusbarItem = ui.createStatusBarItem();
                                    try {
                                        statusbarItem.text = "$(loading~spin) Updating the MySQL REST " +
                                            "Service Metadata Schema ...";
                                        await this.backend.mrs.configure(true, true);

                                        void ui.showInformationNotification("The MySQL REST Service Metadata Schema " +
                                            "has been updated.");

                                        addMrsItem = true;
                                    } finally {
                                        statusbarItem.dispose();
                                    }
                                }
                            }
                        } else if (status.serviceUpgradeable && !status.serviceUpgradeIgnored) {
                            addMrsItem = false;

                            const answer = await ui.confirm(
                                "A new MRS metadata schema update to version " +
                                `${String(status.availableMetadataVersion)} is available. The currently deployed ` +
                                `schema version is ${String(status.currentMetadataVersion)}. Do you want to ` +
                                "update the MRS metadata schema, skip this version for now or permanently ignore " +
                                "this version upgrade going forward?",
                                "Upgrade", "Skip", "Permanently Ignore");
                            if (answer === "Upgrade") {
                                addMrsItem = true;
                                const statusbarItem = ui.createStatusBarItem();
                                try {
                                    statusbarItem.text = "$(loading~spin) Updating the MySQL REST Service " +
                                        "Metadata Schema ...";
                                    statusbarItem.show();

                                    await this.backend.mrs.configure(true, false, true);

                                    void ui.showInformationNotification("The MySQL REST Service Metadata Schema has " +
                                        "been updated.");
                                } finally {
                                    statusbarItem.hide();
                                }
                            } else if (answer === "Permanently Ignore") {
                                await this.backend.mrs.ignoreVersionUpgrade();
                            } else {
                                this.ignoreMrsUpgrade = true;
                            }
                        }

                        if (addMrsItem) {
                            const mrsEntry: Mutable<Partial<ICdmRestRootEntry>> = {
                                parent: this,
                                caption: "MySQL REST Service",
                                type: CdmEntityType.MrsRoot,
                                id: uuid(),
                                state: createDataModelEntryState(false, true),
                                requiredRouterVersion: status.requiredRouterVersion,
                                serviceEnabled: status.serviceEnabled,
                                services: [],
                                connection: this,
                            };

                            const routerGroup: ICdmRestRouterGroupEntry = {
                                parent: mrsEntry as ICdmRestRootEntry,
                                caption: "MySQL Routers",
                                type: CdmEntityType.MrsRouterGroup,
                                id: uuid(),
                                state: createDataModelEntryState(false, false),
                                connection: this,
                                routers: [],
                                getChildren: () => { return routerGroup.routers; },
                            };
                            mrsEntry.routerGroup = routerGroup;

                            const authAppGroup: ICdmRestAuthAppGroupEntry = {
                                parent: mrsEntry as ICdmRestRootEntry,
                                caption: "REST Authentication Apps",
                                type: CdmEntityType.MrsAuthAppGroup,
                                id: uuid(),
                                state: createDataModelEntryState(false, false),
                                connection: this,
                                authApps: [],
                                getChildren: () => { return authAppGroup.authApps; },
                            };
                            authAppGroup.refresh = (callback?: ProgressCallback) => {
                                return this.updater.updateEntry(authAppGroup, callback);
                            };

                            mrsEntry.authAppGroup = authAppGroup;

                            mrsEntry.getChildren = () => {
                                return [
                                    ...mrsEntry.services!,
                                    mrsEntry.routerGroup!,
                                    mrsEntry.authAppGroup!,
                                ];
                            };

                            mrsEntry.refresh = (callback?: ProgressCallback) => {
                                return this.updater.updateEntry(mrsEntry as ICdmRestRootEntry, callback);
                            };

                            this.mrsEntry = mrsEntry as ICdmRestRootEntry;
                        }
                    }
                }
            } catch (reason) {
                const message = convertErrorToString(reason);
                void ui.showErrorNotification(`Failed to check and upgrade the MySQL REST Service Schema. ` +
                    `Error: ${message}`);
            }
        } else {
            this.mrsEntry = undefined;
        }
    }

    /**
     * Creates the static administration section entries and adds them to the parent admin entry.
     *
     * @param parent The parent admin entry.
     */
    private addAdminSections(parent: ICdmAdminEntry): void {
        const serverStatusCommand = {
            title: "Show Server Status",
            command: "msg.showServerStatus",

            // The first argument is undefined to show the page on the currently selected connection.
            arguments: [undefined, "Server Status"] as unknown[],
        };

        const serverStatusPage: ICdmAdminPageEntry = {
            parent,
            id: uuid(),
            type: CdmEntityType.AdminPage,
            state: {
                isLeaf: true,
                initialized: true,
                expanded: true,
                expandedOnce: true,
            },
            caption: "Server Status",
            pageType: "serverStatus",
            command: serverStatusCommand,
            connection: parent.parent,
        };
        serverStatusCommand.arguments.push(serverStatusPage);

        const clientConnectionsCommand = {
            title: "Show Client Connections",
            command: "msg.showClientConnections",
            arguments: [undefined, "Client Connections"] as unknown[],
        };

        const clientConnectionsPage: ICdmAdminPageEntry = {
            parent,
            id: uuid(),
            type: CdmEntityType.AdminPage,
            state: {
                isLeaf: true,
                initialized: true,
                expanded: true,
                expandedOnce: true,
            },
            caption: "Client Connections",
            pageType: "clientConnections",
            command: clientConnectionsCommand,
            connection: parent.parent,
        };
        clientConnectionsCommand.arguments.push(clientConnectionsPage);

        const performanceDashboardCommand = {
            title: "Show Performance Dashboard",
            command: "msg.showPerformanceDashboard",
            arguments: [undefined, "Performance Dashboard"] as unknown[],
        };

        const performanceDashboardPage: ICdmAdminPageEntry = {
            parent,
            id: uuid(),
            type: CdmEntityType.AdminPage,
            state: {
                isLeaf: true,
                initialized: true,
                expanded: true,
                expandedOnce: true,
            },
            caption: "Performance Dashboard",
            pageType: "performanceDashboard",
            command: performanceDashboardCommand,
            connection: parent.parent,
        };
        performanceDashboardCommand.arguments.push(performanceDashboardPage);

        const lakehouseNavigatorCommand = {
            title: "Show Lakehouse Navigator",
            command: "msg.showLakehouseNavigator",
            arguments: [undefined, "Lakehouse Navigator"] as unknown[],
        };

        const lakehouseNavigatorPage: ICdmAdminPageEntry = {
            parent,
            id: uuid(),
            type: CdmEntityType.AdminPage,
            state: {
                isLeaf: true,
                initialized: true,
                expanded: true,
                expandedOnce: true,
            },
            caption: "Lakehouse Navigator",
            pageType: "lakehouseNavigator",
            command: lakehouseNavigatorCommand,
            connection: parent.parent,
            getChildren: () => { return []; },
        };
        lakehouseNavigatorCommand.arguments.push(lakehouseNavigatorPage);

        parent.pages.push(serverStatusPage, clientConnectionsPage, performanceDashboardPage, lakehouseNavigatorPage);
    }
}
