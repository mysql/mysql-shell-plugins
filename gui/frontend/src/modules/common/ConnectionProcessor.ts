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

import { ui } from "../../app-logic/UILayer.js";
import type {
    ConnectionDataModel,
    ICdmConnectionEntry,
} from "../../data-models/ConnectionDataModel.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import { webSession } from "../../supplement/WebSession.js";
import { convertErrorToString } from "../../utilities/helpers.js";

/**
 * A class to handle adding new connections to the connection data model.
 * This class provides methods to import MySQL Workbench connections from an XML string
 * and to handle the addition of new connections to the data model.
 */
export class ConnectionProcessor {
    /**
     * Parses the given XML string and extracts MySQL Workbench connection details.
     * The XML string is expected to be in the format exported by MySQL Workbench.
     * The extracted connection details are then converted into the format used by the
     * connection data model and added to it.
     *
     * @param xmlString The XML string containing MySQL Workbench connection details.
     * @param dataModel The connection data model to which the extracted connections will be added.
     *
     * @returns A promise that resolves when the connections have been imported.
     */
    public static importMySQLWorkbenchConnections = async (xmlString: string,
        dataModel: ConnectionDataModel): Promise<void> => {
        try {
            const report = await ShellInterface.dbConnections.importWorkbenchConnections(
                webSession.currentProfileId,
                xmlString,
            );
            await dataModel.reloadConnections();
            void ui.showInformationMessage(
                `Imported ${report.imported}, merged ${report.merged}, and skipped `
                + `${report.skipped} MySQL Workbench connections.`,
                {},
            );
        } catch (e: unknown) {
            const message = convertErrorToString(e);
            void ui.showErrorMessage(`Could not parse XML file: ${message}`, {});
        }
    };

    /**
     * Takes a connection entry and adds it to the backend and the given data model.
     * If the connection already exists, an error is shown.
     *
     * @param entry The connection entry to add.
     * @param dataModel The connection data model to add the entry to.
     */
    public static async addConnection(entry: ICdmConnectionEntry, dataModel: ConnectionDataModel): Promise<void> {
        const group = await dataModel.groupFromPath(entry.details.folderPath);

        try {
            const connectionDetails = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
                entry.details, group.folderPath.id);
            entry.details.id = connectionDetails[0];
            await dataModel.addConnectionEntry(entry);

            requisitions.executeRemote("connectionAdded", entry.details);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void requisitions.execute("showError", "Cannot add DB connection: " + message);
        }
    }

}
