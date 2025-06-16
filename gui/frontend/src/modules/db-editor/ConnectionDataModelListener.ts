/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import { ConnectionDataModel } from "../../data-models/ConnectionDataModel.js";
import { IConnectionDetails } from "../../supplement/ShellInterface/index.js";

export class ConnectionDataModelListener {
    public constructor(private connectionsDataModel: ConnectionDataModel) {
    }

    /**
     * Called when a new connection was added from outside (usually the application host like the VS Code extension).
     *
     * @param details The connection details.
     *
     * @returns A promise always fulfilled to true.
     */
    public handleConnectionAdded = async (details: IConnectionDetails): Promise<boolean> => {
        const entry = this.connectionsDataModel.createConnectionEntry(details);
        await this.connectionsDataModel.addConnectionEntry(entry);

        return Promise.resolve(true);
    };

    /**
     * Called when a connection was changed from outside (usually the application host like the VS Code extension).
     *
     * @param details The connection details.
     *
     * @returns A promise always fulfilled to true.
     */
    public handleConnectionUpdated = async (details: IConnectionDetails): Promise<boolean> => {
        await this.connectionsDataModel.updateConnectionDetails(details);

        return Promise.resolve(true);
    };

    /**
     * Called when a new connection was removed from outside (usually the application host like the VS Code extension).
     *
     * @param details The connection details.
     *
     * @returns A promise always fulfilled to true.
     */
    public handleConnectionRemoved = async (details: IConnectionDetails): Promise<boolean> => {
        const connection = await this.connectionsDataModel.findConnectionEntryById(details.id, details.folderPath);
        if (connection) {
            await this.connectionsDataModel.removeEntry(connection);
        }

        return true;
    };

    public handleRefreshConnection = async (): Promise<boolean> => {
        await this.connectionsDataModel.reloadConnections();

        return true;
    };
}
