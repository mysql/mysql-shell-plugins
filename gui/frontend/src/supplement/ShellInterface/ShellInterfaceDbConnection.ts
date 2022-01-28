/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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

import { ProtocolGui, currentConnection, IShellDbConnection, IShellDictionary } from "../../communication";
import { ListenerEntry } from "../Dispatch";
import { IConnectionDetails, IShellInterface } from ".";
import { convertToSnakeCase } from "../../utilities/helpers";

export class ShellInterfaceDbConnection implements IShellInterface {

    public constructor(public moduleName: string) {
    }

    /**
     * Adds a new database connection to a profile.
     *
     * @param profileId The id of the profile.
     * @param connection An object holding all data of the connection.
     * @param folderPath The folder path used for grouping and nesting connections, optional
     *
     * @returns A listener for the response.
     */
    public addDbConnection(profileId: number, connection: IConnectionDetails, folderPath: string): ListenerEntry {
        const conn: IShellDbConnection = {
            dbType: connection.dbType,
            caption: connection.caption,
            description: connection.description,
            options: convertToSnakeCase(connection.options) as IShellDictionary,
        };

        return currentConnection.sendRequest(ProtocolGui.getRequestDbconnectionsAddDbConnection(profileId,
            conn, folderPath),
        { messageClass: "addDbConnection" });
    }

    /**
     * Updates the connection data in the backend.
     *
     * @param profileId The id of the profile.
     * @param connection An object holding all data of the connection.
     *
     * @returns A listener for the response.
     */
    public updateDbConnection(profileId: number, connection: IConnectionDetails): ListenerEntry {
        const conn: IShellDbConnection = {
            dbType: connection.dbType,
            caption: connection.caption,
            description: connection.description,
            options: convertToSnakeCase(connection.options) as IShellDictionary,
        };

        return currentConnection.sendRequest(ProtocolGui.getRequestDbconnectionsUpdateDbConnection(profileId,
            connection.id, conn),
        { messageClass: "updateDbConnection" });
    }

    /**
     * Removes a database connection from a profile.
     *
     * @param profileId The id of the profile.
     * @param connectionId The connection to remove.
     *
     * @returns A listener for the response.
     */
    public removeDbConnection(profileId: number, connectionId: number): ListenerEntry {
        return currentConnection.sendRequest(ProtocolGui.getRequestDbconnectionsRemoveDbConnection(profileId,
            connectionId),
        { messageClass: "removeDbConnection" });
    }

    /**
     * Returns all database connections of a given profile and in a given folder path.
     *
     * @param profileId The id of the profile.
     * @param folderPath A specific path, if required.
     *
     * @returns A listener for the response.
     */
    public listDbConnections(profileId: number, folderPath: string): ListenerEntry {
        return currentConnection.sendRequest(ProtocolGui.getRequestDbconnectionsListDbConnections(profileId,
            folderPath),
        { messageClass: "listDbConnections" });
    }

    /**
     * Returns the db_connection for the given id.
     *
     * @param connectionId The id of the db_connection.
     *
     * @returns A listener for the response.
     */
    public getDbConnection(connectionId: number): ListenerEntry {
        return currentConnection.sendRequest(ProtocolGui.getRequestDbconnectionsGetDbConnection(connectionId),
            { messageClass: "getDbConnection" });
    }

    /**
     * Returns a list of all supported DB types.
     *
     * @returns A listener for the response.
     */
    public getDbTypes(): ListenerEntry {
        return currentConnection.sendRequest(ProtocolGui.getRequestDbconnectionsGetDbTypes(),
            { messageClass: "getDbTypes" });
    }
}
