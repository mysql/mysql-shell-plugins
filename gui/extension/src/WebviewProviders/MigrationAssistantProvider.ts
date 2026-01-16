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

import { WebviewProvider } from "./WebviewProvider.js";

import { IDatabaseSource, generateWbCmdLineArgs } from "../../../frontend/src/app-logic/MigrationSubApp/helpers.js";
import { IMySQLConnectionOptions } from "../../../frontend/src/communication/MySQL.js";
import { createDataModelEntryState } from "../../../frontend/src/data-models/data-model-helpers.js";
import { IOdmCloudMigrationEntry, OdmEntityType } from "../../../frontend/src/data-models/OpenDocumentDataModel.js";
import { Semaphore } from "../../../frontend/src/supplement/Semaphore.js";
import type {
    IConnectionDetails,
} from "../../../frontend/src/supplement/ShellInterface/index.js";
import { uuid } from "../../../frontend/src/utilities/helpers.js";

export class MigrationAssistantProvider extends WebviewProvider {
    public rootEntry?: IOdmCloudMigrationEntry;

    private initialized?: boolean;
    private signal?: Semaphore;
    private details?: IConnectionDetails;

    public get connectionDetails() {
        return this.details;
    }

    public static generateUrl(webviewUrl: URL, _details: IConnectionDetails): URL {
        const url = new URL(webviewUrl.toString());
        url.searchParams.set("subApp", "migration");
        url.searchParams.set("forceNewProject", "1");

        return url;
    }

    /**
     * Shows the given module page.
     *
     * @param details The connection details.
     * @param editor The initial editor to show.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public async show(details: IConnectionDetails): Promise<boolean> {
        if (this.initialized) {
            this.reveal();

            return true;
        }

        this.details = details;

        const options = details.options as IMySQLConnectionOptions;
        const databaseSource: IDatabaseSource = {
            name: details.caption,
            user: options.user!,
            host: options.host,
            port: `${options.port ?? 3306}`,
            id: uuid(),
        };

        this.signal = new Semaphore();
        void this.createPanel();

        await this.signal.wait();
        this.initialized = true;
        this.signal = undefined;

        return this.runCommand("job", [{
            requestType: "setCommandLineArguments",
            parameter: generateWbCmdLineArgs(JSON.stringify(databaseSource)),
        }]);
    }

    public initialize(details: IConnectionDetails): IOdmCloudMigrationEntry {
        const state = createDataModelEntryState();
        this.caption = this.generateCaption(details);

        this.rootEntry = {
            id: `cloud-migration-${details.id}`,
            type: OdmEntityType.CloudMigration,
            caption: this.generateCaption(details),
            state,
            provider: this,
        };

        return this.rootEntry;
    }

    protected override requisitionsCreated(): void {
        super.requisitionsCreated();

        if (this.requisitions) {
            this.requisitions.register("closeInstance", this.closeInstance);
            this.requisitions.register("applicationWillFinish", this.closeInstance);
            this.requisitions.register("migrationAssistantMounted", this.migrationAssistantMounted);
        }
    }

    private generateCaption(details: IConnectionDetails) {
        return `Cloud Migration (${details.caption})`;
    }

    private migrationAssistantMounted = (): Promise<boolean> => {
        this.signal?.notify();

        return Promise.resolve(true);
    };

    private closeInstance = (): Promise<boolean> => {
        this.onDispose(this);

        if (this.requisitions) {
            this.requisitions.unregister("applicationWillFinish", this.closeInstance);
            this.requisitions.unregister("closeInstance", this.closeInstance);
            this.requisitions.unregister("migrationAssistantMounted", this.migrationAssistantMounted);
        }

        return Promise.resolve(true);
    };
}
