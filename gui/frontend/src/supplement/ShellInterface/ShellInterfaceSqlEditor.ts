/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import { ListenerEntry } from "../Dispatch";
import {
    ProtocolGui, currentConnection, ICommErrorEvent, ICommStartSessionEvent, ShellAPIGui, ShellPromptResponseType,
} from "../../communication";
import { webSession } from "../WebSession";
import { settings } from "../Settings/Settings";
import { IShellInterface } from ".";
import { ShellInterfaceMds } from "./ShellInterfaceMds";
import { ShellInterfaceMrs } from "./ShellInterfaceMrs";

export class ShellInterfaceSqlEditor implements IShellInterface {

    public mds: ShellInterfaceMds = new ShellInterfaceMds();
    public mrs: ShellInterfaceMrs = new ShellInterfaceMrs();

    private moduleSessionLookupId = "";

    public constructor(public moduleName: string) {
    }

    /**
     * @returns a flag which indicates if a session was opened already.
     */
    public get hasSession(): boolean {
        return this.moduleSessionId !== undefined;
    }

    /**
     * Begins a new session for a specific SQL editor.
     *
     * @param connectionId A value identifying the SQL editor.
     *
     * @returns A listener for the response.
     */
    public startSqlEditorSession(connectionId: string): ListenerEntry {
        this.moduleSessionLookupId = this.moduleName + "." + connectionId;
        this.mrs.moduleSessionLookupId = this.moduleSessionLookupId;

        if (this.hasSession) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestSqleditorStartSession();
        const listener = currentConnection.sendRequest(request, { messageClass: "startModuleSession" });

        listener.then((event: ICommStartSessionEvent): unknown => {
            if (!event.data) {
                return;
            }

            webSession.setModuleSessionId(this.moduleSessionLookupId, event.data.moduleSessionId);
        }).catch((event: ICommErrorEvent): unknown => {
            throw new Error(event.message);
        });

        return listener;
    }

    /**
     * Closes this editor session and all open connections.
     *
     * @returns A listener for the response.
     */
    public closeSqlEditorSession(): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestSqleditorCloseSession(id);
        const listener = currentConnection.sendRequest(request, { messageClass: "closeModuleSession" });

        listener.then(() => {
            webSession.removeDataForModule(this.moduleSessionLookupId, id);
        }).catch((event: ICommErrorEvent) => {
            throw new Error(event.message);
        });

        return listener;
    }

    /**
     * Returns information of how the modules should be displayed in the gui.
     *
     * @returns A listener for the response
     */
    public getGuiModuleDisplayInfo(): ListenerEntry {
        const request = ProtocolGui.getRequestSqleditorGetGuiModuleDisplayInfo();

        return currentConnection.sendRequest(request, { messageClass: "getModuleDisplayInfo" });
    }

    /**
     * Returns true as this extension object holds the backend implementation of a gui module.
     *
     * @returns A listener for the response
     */
    public isGuiModuleBackend(): ListenerEntry {
        const request = ProtocolGui.getRequestSqleditorIsGuiModuleBackend();

        return currentConnection.sendRequest(request, { messageClass: "isGuiModuleBackend" });
    }

    /**
     * Opens the database connection.
     *
     * @param dbConnectionId The id of the db connection.
     *
     * @returns A listener for the response
     */
    public openConnection(dbConnectionId: number): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestSqleditorOpenConnection(dbConnectionId, id);

        return currentConnection.sendRequest(request, { messageClass: "openConnection" });
    }

    /**
     * Executes the given SQL.
     *
     * @param sql The sql command to execute.
     * @param params The module session the function should operate on.
     *
     * @returns A listener for the response
     */
    public execute(sql: string, params?: string[]): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestSqleditorExecute(sql, id, params,
            { rowPacketSize: settings.get("sql.rowPacketSize", 1000) });

        return currentConnection.sendRequest(request, { messageClass: "execute" });
    }

    /**
     * Stops the currently running query (if there's any).
     *
     * @returns A listener for the response
     */
    public killQuery(): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestSqleditorKillQuery(id);

        return currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiSqleditorKillQuery });
    }

    /**
     * Returns the list of available catalog objects.
     *
     * @param type Which type of object to retrieve.
     * @param filter A search filter.
     *
     * @returns A listener for the response.
     */
    public getCatalogObjects(type: string, filter: string): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestDbGetCatalogObjectNames(id, type, filter);

        return currentConnection.sendRequest(request, { messageClass: "getRequestGetCatalogObjectNames" });
    }

    /**
     * Returns a list of schema objects (tables, views etc.).
     *
     * @param schema The schema for which to retrieve the objects.
     * @param type Which type of object to retrieve.
     * @param filter A search filter.
     *
     * @returns A listener for the response.
     */
    public getSchemaObjects(schema: string, type: string, filter: string): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestDbGetSchemaObjectNames(id, type, schema, filter);

        return currentConnection.sendRequest(request, { messageClass: "getRequestGetSchemaObjectNames" });
    }

    /**
     * Returns the list of columns for a specific table.
     *
     * @param schema The owning schema of the table.
     * @param table The table for which to get the columns.
     *
     * @returns A listener for the response.
     */
    public getSchemaTableColumns(schema: string, table: string): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestDbGetSchemaObject(id, "Table", schema, table);

        return currentConnection.sendRequest(request, { messageClass: "getSchemaTableColumns" });
    }

    /**
     * Sets the auto commit mode for the current connection.
     * Note: this mode can implicitly be changed by executing certain SQL code (begin, set autocommit, rollback, etc.).
     *
     * @param value A flag indicating if the mode should be enabled or disabled.
     *
     * @returns A listener for the response.
     */
    public setAutoCommit(value: boolean): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestSqleditorSetAutoCommit(id, value);

        return currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiSqleditorSetAutoCommit });
    }

    /**
     * Returns the current auto commit mode, if supported.
     *
     * @returns A listener for the response.
     */
    public getAutoCommit(): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestSqleditorGetAutoCommit(id);

        return currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiSqleditorGetAutoCommit });
    }

    /**
     * Checks if the given path is valid and points to an existing file.
     *
     * @param path The path to check.
     *
     * @returns A listener for the response.
     */
    public validatePath(path: string): ListenerEntry {
        const request = ProtocolGui.getRequestCoreValidatePath(path);

        return currentConnection.sendRequest(request, { messageClass: "validatePath" });
    }

    /**
     * Creates the database file for an sqlite3 connection. The file must not exist yet.
     *
     * @param path The path to the file to create.
     *
     * @returns A listener for the response.
     */
    public createDatabaseFile(path: string): ListenerEntry {
        const request = ProtocolGui.getRequestCoreCreateFile(path);

        return currentConnection.sendRequest(request, { messageClass: "createDbFile" });
    }

    /**
     * Returns the current default schema, if supported.
     *
     * @returns A listener for the response.
     */
    public getCurrentSchema(): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestSqleditorGetCurrentSchema(id);

        return currentConnection.sendRequest(request, { messageClass: "getCurrentSchema" });
    }

    /**
     * Sets the current default schema, if supported.
     *
     * @param schema The schema to set as the default.
     *
     * @returns A listener for the response.
     */
    public setCurrentSchema(schema: string): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestSqleditorSetCurrentSchema(id, schema);

        return currentConnection.sendRequest(request, { messageClass: "setCurrentSchema" });
    }

    /**
     * Sends a reply from the user back to the backend (e.g. passwords, choices etc.).
     *
     * @param requestId The same request ID that was used to request input from the user.
     * @param type Indicates if the user accepted the request or cancelled it.
     * @param reply The reply from the user.
     *
     * @returns A listener for the response.
     */
    public sendReply(requestId: string, type: ShellPromptResponseType, reply: string): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestPromptReply(requestId, type, reply, id);

        return currentConnection.sendRequest(request, { messageClass: "sendReply" });
    }

    private get moduleSessionId(): string | undefined {
        return webSession.moduleSessionId(this.moduleSessionLookupId);
    }
}
