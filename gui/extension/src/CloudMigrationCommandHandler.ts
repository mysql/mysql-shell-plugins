/*
 * Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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

import { ShellInterfaceMigration } from "../../frontend/src/supplement/ShellInterface/ShellInterfaceMigration.js";
import { ExtensionHost } from "./ExtensionHost.js";
import { MigrationAssistantProvider } from "./WebviewProviders/MigrationAssistantProvider.js";
import { WebviewProvider } from "./WebviewProviders/WebviewProvider.js";

import { commands } from "vscode";
import { ui } from "../../frontend/src/app-logic/UILayer.js";
import { IProjectData } from "../../frontend/src/communication/ProtocolMigration.js";
import { ICdmConnectionEntry } from "../../frontend/src/data-models/ConnectionDataModel.js";
import {
    IOdmCloudMigrationEntry, OpenDocumentDataModel,
    OpenDocumentDataModelEntry
} from "../../frontend/src/data-models/OpenDocumentDataModel.js";
import { requisitions } from "../../frontend/src/supplement/Requisitions.js";
import { DBType, IConnectionDetails } from "../../frontend/src/supplement/ShellInterface/index.js";
import { CloudMigrationTreeItem } from "./tree-providers/OpenEditorsTreeProvider/CloudMigrationTreeItem.js";

export interface OpenEditorsTreeController {
    openDocumentsModel: OpenDocumentDataModel,
    refreshTree: (document?: OpenDocumentDataModelEntry) => void;
    revealEntry?: (element: OpenDocumentDataModelEntry,
        options?: { select?: boolean; focus?: boolean; expand?: boolean | number }) => Thenable<void>;
}

export class CloudMigrationCommandHandler {
    private migrationController?: ShellInterfaceMigration;
    private url?: URL;
    private migrations = new Map<number, MigrationAssistantProvider>();
    private ongoingMigrationsConnectionNames = new Set<string>();

    public constructor(
        private openDocumentsModel: OpenDocumentDataModel,
        private refreshTree: OpenEditorsTreeController["refreshTree"],
        private revealEntry: OpenEditorsTreeController["revealEntry"],
    ) { }

    public get providers(): readonly MigrationAssistantProvider[] {
        return Array.from(this.migrations.values());
    }

    public setup(host: ExtensionHost) {
        requisitions.register("connectedToUrl", this.connectedToUrl);
        requisitions.register("startMigrationAssistant", this.startMigrationAssistant);
        requisitions.register("migrationStarted", this.migrationStarted);
        requisitions.register("migrationStopped", this.migrationStopped);

        host.context.subscriptions.push(commands.registerCommand("msg.startMySQLCloudMigrationAssistant",
            (entry?: ICdmConnectionEntry) => {
                if (entry?.details) {
                    void this.startMigrationAssistant(entry.details);
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.selectCloudMigration",
            (entry?: CloudMigrationTreeItem<IOdmCloudMigrationEntry>) => {
                entry?.dataModelEntry.provider.reveal();
            }));
    }

    public clear(): void {

        this.migrations.forEach((provider) => {
            this.openDocumentsModel.removeAddedRoot(provider.rootEntry);
            provider.close();
        });

        const hasOngoingMigrations = this.ongoingMigrationsConnectionNames.size > 0;
        if (hasOngoingMigrations) {
            this.abortMigration();
        }

        this.migrations.clear();
        this.ongoingMigrationsConnectionNames.clear();
        this.refreshTree();
    }

    public getMigrationAssistantProvider(details: IConnectionDetails): MigrationAssistantProvider | undefined {
        if (this.migrations.has(details.id)) {
            return this.migrations.get(details.id);
        }

        if (this.url) {
            const provider = new MigrationAssistantProvider(
                MigrationAssistantProvider.generateUrl(this.url, details),
                this.onMigrationAssistantDispose,
                this.onMigrationAssistantStateChange,
            );

            const rootEntry = provider.initialize(details);

            this.openDocumentsModel.addRoot(rootEntry);

            this.migrations.set(details.id, provider);
            this.refreshTree();

            return provider;
        }

        return undefined;
    }

    private removeMigration(disposed: MigrationAssistantProvider, connectionId: number): void {
        if (disposed.connectionDetails !== undefined
            && this.ongoingMigrationsConnectionNames.delete(disposed.connectionDetails.caption)) {
            this.abortMigration();
        }

        this.migrations.delete(connectionId);
        this.openDocumentsModel.removeAddedRoot(disposed.rootEntry);
        this.refreshTree();
    }

    private onMigrationAssistantDispose = (disposed: WebviewProvider): void => {
        this.migrations.forEach((provider, connectionId) => {
            if (disposed === provider) {
                this.removeMigration(provider, connectionId);
            }
        });
    };

    private onMigrationAssistantStateChange = (provider: WebviewProvider, active: boolean): void => {
        if (active && provider instanceof MigrationAssistantProvider && provider.rootEntry) {
            this.revealEntry?.(provider.rootEntry, { select: true, focus: false });
        }
    };

    private connectedToUrl = (url?: URL): Promise<boolean> => {
        this.url = url;
        this.migrationController = new ShellInterfaceMigration();

        return Promise.resolve(true);
    };

    private startMigrationAssistant = (details: IConnectionDetails): Promise<boolean> => {
        if (details.dbType !== DBType.MySQL) {
            return Promise.resolve(false);
        }

        if ("mysql-db-system-id" in details.options
            && !!details.options["mysql-db-system-id"]) {
            ui.showInformationMessage(
                `${details.caption} is already identified as a HeatWave DB System.`, {},
            );

            return Promise.resolve(false);
        }

        const provider = this.getMigrationAssistantProvider(details);
        if (provider) {
            void provider.show(details);
        }

        return Promise.resolve(true);
    };

    private migrationStarted = (currentProject: IProjectData): Promise<boolean> => {
        if (!this.migrationController) {
            return Promise.resolve(false);
        }

        void this.migrationController.openProject(currentProject.id);

        const details = this.resolveConnectionDetails(currentProject);
        if (details) {
            this.ongoingMigrationsConnectionNames.add(details.caption);
        }

        return Promise.resolve(true);
    };

    private migrationStopped = (currentProject: IProjectData): Promise<boolean> => {
        const details = this.resolveConnectionDetails(currentProject);

        if (details) {
            this.ongoingMigrationsConnectionNames.delete(details.caption);
        }

        return Promise.resolve(true);
    };

    private abortMigration() {
        if (!this.migrationController) {
            return;
        }

        void this.migrationController.workAbort();

        ui.showWarningMessage("Ongoing migration was aborted. OCI resources created so far " +
            "may have to be manually deleted.", {});
    }

    private resolveConnectionDetails(currentProject: IProjectData) {
        let details: IConnectionDetails | undefined;

        this.migrations.forEach((provider) => {
            if (provider.connectionDetails?.caption === currentProject.name) {
                details = provider.connectionDetails;
            }
        });

        return details;
    }
}
