/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import { webSession } from "../WebSession.js";
import { Settings } from "../Settings/Settings.js";
import { MessageScheduler, DataCallback } from "../../communication/MessageScheduler.js";
import { IPromptReplyBackend, ShellPromptResponseType, Protocol } from "../../communication/Protocol.js";
import {
    ShellAPIGui, IOpenConnectionData, IDbEditorResultSetData, IShellPasswordFeedbackRequest, IStatusData,
    ISqlEditorHistoryEntry,
} from "../../communication/ProtocolGui.js";
import { ShellInterfaceDb } from "./ShellInterfaceDb.js";
import { ShellInterfaceMhs } from "./ShellInterfaceMhs.js";
import { ShellInterfaceMrs } from "./ShellInterfaceMrs.js";

export class ShellInterfaceSqlEditor extends ShellInterfaceDb implements IPromptReplyBackend {

    public mhs: ShellInterfaceMhs = new ShellInterfaceMhs();
    public mrs: ShellInterfaceMrs = new ShellInterfaceMrs();

    /**
     * @returns a flag which indicates if a session was opened already.
     */
    public get hasSession(): boolean {
        return this.moduleSessionId !== undefined;
    }

    /**
     * Begins a new session for a specific SQL editor. This overrides the underlying DB session handling.
     *
     * @param id A value identifying the SQL editor.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public override async startSession(id: string): Promise<void> {
        this.moduleSessionLookupId = `sqlEditor.${id}`;
        this.mrs.moduleSessionLookupId = this.moduleSessionLookupId;

        if (!this.hasSession) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorStartSession,
                parameters: { args: {} },
            });

            if (response.result?.moduleSessionId) {
                webSession.setModuleSessionId(this.moduleSessionLookupId, response.result.moduleSessionId);
            }
        }
    }

    /**
     * Closes this editor session and all open connections.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public override async closeSession(): Promise<void> {
        const moduleSessionId = this.moduleSessionId;
        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorCloseSession,
                parameters: { args: { moduleSessionId } },
            });
            webSession.setModuleSessionId(this.moduleSessionLookupId);
        }
    }

    /**
     * Returns information of how the modules should be displayed in the gui.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public async getGuiModuleDisplayInfo(): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiSqlEditorGetGuiModuleDisplayInfo,
            parameters: { args: {} },
        });
    }

    /**
     * Returns true as this extension object holds the backend implementation of a gui module.
     *
     * @returns A promise resolving to a flag indicating the outcome of the request.
     */
    public async isGuiModuleBackend(): Promise<boolean> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiSqlEditorIsGuiModuleBackend,
            parameters: { args: {} },
        });

        return response.result;
    }

    /**
     * Opens the database connection.
     *
     * @param dbConnectionId The id of the db connection.
     * @param requestId The ID to use for the request sent to the backend.
     * @param callback The callback for intermediate results. If not specified, then response errors will throw
     *                 an exception.
     *
     * @returns A promise resolving an empty result if a callback was given (in which case the results are passed to
     *          the callback)
     */
    public async openConnection(dbConnectionId: number, requestId?: string,
        callback?: DataCallback<ShellAPIGui.GuiSqlEditorOpenConnection>):
        Promise<IOpenConnectionData | IShellPasswordFeedbackRequest | IStatusData | undefined> {
        const moduleSessionId = this.moduleSessionId;
        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestId,
                requestType: ShellAPIGui.GuiSqlEditorOpenConnection,
                parameters: { args: { moduleSessionId, dbConnectionId } },
                onData: callback,
            });

            return response.result;
        }

        return undefined;
    }

    /**
     * Executes the given SQL.
     *
     * @param sql The sql command to execute.
     * @param params Parameters for the query, if it contains placeholders.
     * @param requestId The ID to use for the request sent to the backend.
     * @param callback The callback for intermediate results.
     *
     * @returns A promise resolving to a list of records or undefined if no session is open.
     */
    public async execute(sql: string, params?: string[], requestId?: string,
        callback?: DataCallback<ShellAPIGui.GuiSqlEditorExecute>,
    ): Promise<IDbEditorResultSetData | undefined> {
        const moduleSessionId = this.moduleSessionId;
        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorExecute,
                requestId,
                parameters: {
                    args: {
                        moduleSessionId,
                        sql,
                        params: params !== undefined && params.length > 0 ? params : undefined,
                        options: { rowPacketSize: Settings.get("sql.rowPacketSize", 1000) },
                    },
                },
                caseConversionIgnores: ["rows"],
                onData: callback,
            });

            const result: IDbEditorResultSetData = {};

            response.forEach((entry) => {
                if (entry.result.executionTime) {
                    result.executionTime = entry.result.executionTime;
                }

                if (entry.result.rows) {
                    if (!result.rows) {
                        result.rows = [];
                    }
                    result.rows.push(...entry.result.rows);
                }

                if (entry.result.columns) {
                    if (!result.columns) {
                        result.columns = [];
                    }
                    result.columns.push(...entry.result.columns);
                }

                if (entry.result.totalRowCount) {
                    result.totalRowCount = entry.result.totalRowCount;
                }

                if (entry.result.rowsAffected) {
                    result.rowsAffected = entry.result.rowsAffected;
                }
            });

            return result;
        }
    }

    /**
     * Starts a transaction on the database connection.
     */
    public async startTransaction(): Promise<void> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorStartTransaction,
                parameters: { args: { moduleSessionId } },
            });
        }
    }

    /**
     * Commits a transaction on the database connection.
     */
    public async commitTransaction(): Promise<void> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorCommitTransaction,
                parameters: { args: { moduleSessionId } },
            });
        }
    }

    /**
     * Commits a transaction on the database connection.
     */
    public async rollbackTransaction(): Promise<void> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorRollbackTransaction,
                parameters: { args: { moduleSessionId } },
            });
        }
    }

    /**
     * Reconnects the database connection.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public async reconnect(): Promise<void> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorReconnect,
                parameters: { args: { moduleSessionId } },
            });
        }
    }

    /**
     * Stops the currently running query (if there's any).
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public async killQuery(): Promise<void> {
        const moduleSessionId = this.moduleSessionId;
        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorKillQuery,
                parameters: { args: { moduleSessionId } },
            });
        }
    }

    /**
     * Sets the auto commit mode for the current connection.
     * Note: this mode can implicitly be changed by executing certain SQL code (begin, set autocommit, rollback, etc.).
     *
     * @param state A flag indicating if the mode should be enabled or disabled.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public async setAutoCommit(state: boolean): Promise<void> {
        const moduleSessionId = this.moduleSessionId;
        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorSetAutoCommit,
                parameters: { args: { moduleSessionId, state } },
            });
        }
    }

    /**
     * Returns the current auto commit mode, if supported.
     *
     * @returns A promise resolve to the current auto commit state or undefined if no session is open.
     */
    public async getAutoCommit(): Promise<boolean | undefined> {
        const moduleSessionId = this.moduleSessionId;
        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorGetAutoCommit,
                parameters: { args: { moduleSessionId } },
            });

            return response.result;
        }
    }

    /**
     * Returns the current default schema, if supported.
     *
     * @returns A promise resolve to the current schema or undefined if no session is open.
     */
    public async getCurrentSchema(): Promise<string | undefined> {
        const moduleSessionId = this.moduleSessionId;
        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorGetCurrentSchema,
                parameters: { args: { moduleSessionId } },
            });

            return response.result;
        }
    }

    /**
     * Sets the current default schema, if supported.
     *
     * @param schemaName The schema to set as the default.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public async setCurrentSchema(schemaName: string): Promise<void> {
        const moduleSessionId = this.moduleSessionId;
        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorSetCurrentSchema,
                parameters: { args: { moduleSessionId, schemaName } },
            });
        }
    }

    /**
     * Sends a reply from the user back to the backend (e.g. passwords, choices etc.).
     *
     * @param requestId The same request ID that was used to request input from the user.
     * @param type Indicates if the user accepted the request or cancelled it.
     * @param reply The reply from the user.
     * @param moduleSessionId Use this to override the module session ID.
     *
     * @returns  A promise which resolves when the operation was concluded.
     */
    public async sendReply(requestId: string, type: ShellPromptResponseType, reply: string,
        moduleSessionId?: string): Promise<void> {
        moduleSessionId = moduleSessionId ?? this.moduleSessionId;
        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: Protocol.PromptReply,
                parameters: { moduleSessionId, requestId, type, reply },
            }, false);
        }
    }

    public async addExecutionHistoryEntry(connectionId: number, code: string, languageId: string,
        profileId?: number): Promise<number> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiSqlEditorAddExecutionHistoryEntry,
            parameters: {
                args: {
                    connectionId,
                    code,
                    languageId,
                    profileId,
                },
            },
        });

        return response.result;
    }

    public async getExecutionHistoryEntry(connectionId: number, index: number,
        profileId?: number): Promise<ISqlEditorHistoryEntry> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiSqlEditorGetExecutionHistoryEntry,
            parameters: {
                args: {
                    connectionId,
                    index,
                    profileId,
                },
            },
        });

        return response.result;
    }

    public async getExecutionHistoryEntries(connectionId: number, truncateCodeLength?: number, languageId?: string,
        profileId?: number): Promise<ISqlEditorHistoryEntry[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiSqlEditorGetExecutionHistoryEntries,
            parameters: {
                args: {
                    connectionId,
                    languageId,
                    truncateCodeLength: truncateCodeLength ?? -1,
                    profileId,
                },
            },
        });

        return response.result;
    }

    public async removeExecutionHistoryEntry(connectionId: number, index: number,
        profileId?: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiSqlEditorRemoveExecutionHistoryEntry,
            parameters: {
                args: {
                    connectionId,
                    index,
                    profileId,
                },
            },
        });
    }
}
