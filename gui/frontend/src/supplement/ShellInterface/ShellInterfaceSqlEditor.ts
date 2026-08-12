/*
 * Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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

import { webSession, type ILoginCredentials } from "../WebSession.js";
import { ui } from "../../app-logic/UILayer.js";
import { Settings } from "../Settings/Settings.js";
import { MessageScheduler, DataCallback } from "../../communication/MessageScheduler.js";
import {
    ShellAPIGui, IOpenConnectionData, IDbEditorResultSetData, IShellPasswordFeedbackRequest, IStatusData,
    IShellDbConnection, ISqlEditorHistoryEntry, IVisualExplainData, IMySQLUserListItem,
    IMySQLUser, IMySQLGlobalPrivilegeCatalogItem, IMySQLDefaultUserOptions, IMySQLObjectPrivilegeSchemaTarget,
    IObjectPrivilegeTarget, IPasswordResetInfo, IUserInfo, IErrorLogFilePage,
} from "../../communication/ProtocolGui.js";
import { defaultVisualExplainOptions, type IVisualExplainOptions } from "../../script-execution/index.js";
import { ShellInterfaceDb } from "./ShellInterfaceDb.js";
import { ShellInterfaceMhs } from "./ShellInterfaceMhs.js";
import { ShellInterfaceMrs } from "./ShellInterfaceMrs.js";
import { promiseWithTimeout } from "../../utilities/helpers.js";
import { ShellInteractiveInterface } from "./ShellInteractiveInterface.js";

export interface IErrorLogFilters {
    minTimestamp?: number;
    priorities?: string[];
    errorCodes?: string[];
    subsystems?: string[];
    message?: string;
}

const isBackendTrue = (value: unknown): boolean => {
    if (value === true || value === 1 || value === "1") {
        return true;
    }

    return typeof value === "string" && ["ON", "TRUE", "YES"].includes(value.trim().toUpperCase());
};

interface IServerStatusCache {
    updatedAt: string;
    isLocal: boolean;
    sysvars: Array<{ name: string; value: string; }>;
}

export interface IPerformanceReportCapabilities {
    performanceSchema: boolean;
    logStatus: boolean;
    memory: boolean;
    waits: boolean;
    slowQueries: boolean;
    statementHistogram: boolean;
}

const optimisticPerformanceReportCapabilities = (): IPerformanceReportCapabilities => {
    return {
        // Metadata probing is best effort. Let the report query provide the
        // actual error when the probe itself fails.
        performanceSchema: true,
        logStatus: true,
        memory: true,
        waits: true,
        slowQueries: true,
        statementHistogram: true,
    };
};

const performanceReportCapabilitiesQuery = `
SELECT
    @@performance_schema,
    EXISTS (
        SELECT 1
          FROM information_schema.tables
         WHERE table_schema = 'performance_schema'
           AND table_name = 'log_status'
    ),
    (
        SELECT COUNT(*) = 5
          FROM information_schema.tables
         WHERE table_schema = 'sys'
           AND table_name IN (
               'memory_global_total',
               'memory_global_by_current_bytes',
               'memory_by_thread_by_current_bytes',
               'memory_by_host_by_current_bytes',
               'memory_by_user_by_current_bytes'
           )
    ),
    (
        (SELECT COUNT(*) = 4
          FROM information_schema.tables
         WHERE table_schema = 'sys'
           AND table_name IN (
               'x$wait_classes_global_by_latency',
               'x$waits_global_by_latency',
               'x$waits_by_host_by_latency',
               'x$waits_by_user_by_latency'
           ))
        AND
        (SELECT COUNT(*) = 1
           FROM information_schema.routines
          WHERE routine_schema = 'sys'
            AND routine_name = 'format_time'
            AND routine_type = 'FUNCTION')
    ),
    (
        (SELECT COUNT(*) = 3
           FROM information_schema.tables
          WHERE (table_schema = 'sys' AND table_name = 'x$statement_analysis')
             OR (table_schema = 'performance_schema' AND table_name IN (
                'events_statements_histogram_by_digest',
                'events_statements_summary_by_digest'
             )))
        AND
        (SELECT COUNT(*) = 6
           FROM information_schema.columns
          WHERE table_schema = 'performance_schema'
            AND table_name = 'events_statements_summary_by_digest'
            AND column_name IN (
                'sum_cpu_time',
                'max_controlled_memory',
                'max_total_memory',
                'quantile_95',
                'quantile_99',
                'quantile_999'
            ))
        AND
        (SELECT COUNT(*) = 2
           FROM information_schema.routines
          WHERE routine_schema = 'sys'
            AND routine_name IN ('format_time', 'format_bytes')
            AND routine_type = 'FUNCTION')
    ),
    EXISTS (
        SELECT 1
          FROM information_schema.tables
         WHERE table_schema = 'performance_schema'
           AND table_name = 'events_statements_histogram_global'
    )
`;

export class ShellInterfaceSqlEditor extends ShellInterfaceDb {

    public interactive: ShellInteractiveInterface = new ShellInteractiveInterface();
    public mhs: ShellInterfaceMhs = new ShellInterfaceMhs(this.interactive);
    public mrs: ShellInterfaceMrs = new ShellInterfaceMrs();

    private serviceOnlySession = false;
    private offlineSession = false;
    private performanceSchemaAvailable?: boolean;
    private performanceSchemaAvailabilityProbe?: Promise<boolean>;
    private performanceReportCapabilities?: IPerformanceReportCapabilities;
    private performanceReportCapabilitiesProbe?: Promise<IPerformanceReportCapabilities>;
    private partialRevokesEnabled?: boolean;
    private partialRevokesEnabledProbe?: Promise<boolean>;

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
        this.clearWorkspaceCaches();
        this.serviceOnlySession = false;
        this.offlineSession = false;
        this.moduleSessionLookupId = `sqlEditor.${id}`;
        this.mrs.moduleSessionLookupId = this.moduleSessionLookupId;

        if (!this.hasSession) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorStartSession,
                parameters: { args: {} },
            });

            if (response.result.moduleSessionId) {
                webSession.setModuleSessionId(this.moduleSessionLookupId, response.result.moduleSessionId);
            }
        }
    }

    /**
     * Starts a DB service session without opening the SQL editor user session.
     *
     * This is used by administration pages, which must keep working when the user session is busy or blocked.
     *
     * @param id The connection entry identifier used to look up the module session.
     * @param connection The saved connection identifier or details to open.
     * @param password Optional password for the service connection.
     */
    public async startServiceSession(id: string, connection: number | IShellDbConnection,
        password?: string): Promise<void> {
        this.clearWorkspaceCaches();
        this.serviceOnlySession = true;
        this.offlineSession = false;
        this.moduleSessionLookupId = `dbSession.${id}`;
        const response = await this.interactive.sendInteractiveRequest({
            requestType: ShellAPIGui.GuiDbStartSession,
            parameters: { args: { connection, password } },
        });
        webSession.setModuleSessionId(this.moduleSessionLookupId, response.result.moduleSessionId);
        this.mrs.moduleSessionLookupId = this.moduleSessionLookupId;
    }

    /**
     * Starts a profile-bound session for offline administration pages.
     *
     * @param id A value identifying the connection workspace.
     * @param connection The ID of the stored connection to bind to this session.
     *
     * @returns A promise which resolves when the session is bound.
     */
    public async startOfflineSession(id: string, connection: number): Promise<void> {
        this.clearWorkspaceCaches();
        this.serviceOnlySession = false;
        this.offlineSession = true;
        this.moduleSessionLookupId = `offlineDbSession.${id}`;
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbStartOfflineSession,
            parameters: { args: { connectionId: connection } },
        });
        webSession.setModuleSessionId(this.moduleSessionLookupId, response.result.moduleSessionId);
        this.mrs.moduleSessionLookupId = this.moduleSessionLookupId;
    }

    /**
     * Returns cached server status data for this offline administration session.
     *
     * @returns Cached data, or undefined when the session is not offline.
     */
    public async getOfflineServerStatusCache(): Promise<IServerStatusCache | undefined> {
        if (!this.moduleSessionId || !this.offlineSession) {
            return undefined;
        }

        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsGetServerStatusCache,
            parameters: { args: { moduleSessionId: this.moduleSessionId } },
        });

        return response.result === null ? undefined : response.result as unknown as IServerStatusCache;
    }

    /**
     * Reads one page from the local error log bound to this connection session.
     *
     * @param page The zero-based page number.
     * @param pageSize The maximum number of rows to return.
     * @param filters Optional filters to apply before paging.
     *
     * @returns The requested page, if the cached local log is available.
     */
    public async readErrorLogFilePage(page: number, pageSize = 100,
        filters?: IErrorLogFilters): Promise<IErrorLogFilePage | undefined> {
        if (!this.moduleSessionId) {
            throw new Error("No backend session is available.");
        }

        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMysqlReadErrorLogFilePage,
            parameters: { args: { moduleSessionId: this.moduleSessionId, page, pageSize, filters } },
            caseConversionIgnores: ["filters"],
        });

        return response.result;
    }

    /**
     * Copies the local error log bound to this connection session to a selected path.
     *
     * @param targetPath The destination path selected by the user.
     */
    public async exportErrorLogFile(targetPath: string): Promise<void> {
        if (!this.moduleSessionId) {
            throw new Error("No backend session is available.");
        }

        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMysqlExportErrorLogFile,
            parameters: { args: { moduleSessionId: this.moduleSessionId, targetPath } },
        });
    }

    /**
     * Exports all rows from the connected performance schema error log.
     *
     * @param targetPath The destination path selected by the user.
     */
    public async exportErrorLogs(targetPath: string): Promise<void> {
        if (!this.moduleSessionId) {
            throw new Error("No backend session is available.");
        }

        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMysqlExportErrorLogs,
            parameters: {
                args: {
                    moduleSessionId: this.moduleSessionId,
                    targetPath,
                },
            },
        });
    }

    /**
     * Closes this editor session and all open connections.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public override async closeSession(): Promise<void> {
        try {
            if (this.serviceOnlySession || this.offlineSession) {
                await super.closeSession();
                this.serviceOnlySession = false;
                this.offlineSession = false;

                return;
            }

            const moduleSessionId = this.moduleSessionId;
            if (moduleSessionId) {
                await promiseWithTimeout(MessageScheduler.get.sendRequest({
                    requestType: ShellAPIGui.GuiSqlEditorCloseSession,
                    parameters: { args: { moduleSessionId } },
                }), 5000);
                webSession.setModuleSessionId(this.moduleSessionLookupId);
            }
        } finally {
            this.clearWorkspaceCaches();
        }
    }

    /**
     * Returns the cached performance_schema availability for this editor workspace.
     *
     * The value is scoped to the backend instance, which is shared by pages in the same connection workspace.
     */
    public async isPerformanceSchemaAvailable(): Promise<boolean> {
        if (this.performanceSchemaAvailable !== undefined) {
            return this.performanceSchemaAvailable;
        }

        this.performanceSchemaAvailabilityProbe ??= this.executeService("select @@performance_schema")
            .then((result) => {
                if (!result) {
                    return false;
                }

                const firstRow = result.rows?.[0];
                const value = Array.isArray(firstRow) ? firstRow[0] as unknown : firstRow;
                const available = isBackendTrue(value);
                this.performanceSchemaAvailable = available;

                return available;
            })
            .finally(() => {
                this.performanceSchemaAvailabilityProbe = undefined;
            });

        return this.performanceSchemaAvailabilityProbe;
    }

    /**
     * Returns the server capabilities required by the performance reports.
     *
     * The report SQL targets MySQL 8.0.31 and newer. Metadata checks are still
     * used so missing schemas, tables, or disabled Performance Schema features
     * produce a useful report state instead of an opaque SQL error.
     */
    public async getPerformanceReportCapabilities(): Promise<IPerformanceReportCapabilities> {
        if (this.performanceReportCapabilities) {
            return this.performanceReportCapabilities;
        }

        this.performanceReportCapabilitiesProbe ??= this.executeService(performanceReportCapabilitiesQuery)
            .then((result) => {
                const values = result?.rows?.[0] as unknown[] | undefined;
                if (!values) {
                    const capabilities = optimisticPerformanceReportCapabilities();
                    this.performanceReportCapabilities = capabilities;

                    return capabilities;
                }

                const capabilities: IPerformanceReportCapabilities = {
                    performanceSchema: isBackendTrue(values[0]),
                    logStatus: isBackendTrue(values[1]),
                    memory: isBackendTrue(values[2]),
                    waits: isBackendTrue(values[3]),
                    slowQueries: isBackendTrue(values[4]),
                    statementHistogram: isBackendTrue(values[5]),
                };
                this.performanceReportCapabilities = capabilities;

                return capabilities;
            })
            .catch(() => {
                const capabilities = optimisticPerformanceReportCapabilities();
                this.performanceReportCapabilities = capabilities;

                return capabilities;
            })
            .finally(() => {
                this.performanceReportCapabilitiesProbe = undefined;
            });

        return this.performanceReportCapabilitiesProbe;
    }

    /**
     * Returns whether partial revokes are enabled on the connected MySQL server.
     *
     * @returns A promise resolving whether partial revokes are enabled.
     */
    public async isPartialRevokesEnabled(): Promise<boolean> {
        if (this.partialRevokesEnabled !== undefined) {
            return this.partialRevokesEnabled;
        }

        this.partialRevokesEnabledProbe ??= this.executeService("SELECT @@GLOBAL.partial_revokes")
            .then((result) => {
                if (!result?.rows) {
                    return false;
                }

                const enabled = result.rows[0] == 1;
                this.partialRevokesEnabled = enabled;

                return enabled;
            })
            .catch(() => {
                this.partialRevokesEnabled = false;

                return false;
            })
            .finally(() => {
                this.partialRevokesEnabledProbe = undefined;
            });

        return this.partialRevokesEnabledProbe;
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
     * @param credentials The credentials to use for the connection. If not specified, then the user will be prompted
     *                    for the credentials (unless they are cached in the backend).
     * @param callback The callback for intermediate results. If not specified, then response errors will throw
     *                 an exception.
     *
     * @returns A promise resolving an empty result if a callback was given (in which case the results are passed to
     *          the callback)
     */
    public async openConnection(dbConnectionId: number, requestId?: string, credentials?: ILoginCredentials,
        callback?: DataCallback<ShellAPIGui.GuiSqlEditorOpenConnection>):
        Promise<IOpenConnectionData | IShellPasswordFeedbackRequest | IStatusData | undefined> {
        const moduleSessionId = this.moduleSessionId;
        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestId,
                requestType: ShellAPIGui.GuiSqlEditorOpenConnection,
                parameters: { args: { moduleSessionId, dbConnectionId, password: credentials?.password } },
                onData: callback,
            });

            return response.result;
        }

        return undefined;
    }

    public async getPasswordResetInfo(user?: string, host?: string,
        passwordExpired?: boolean): Promise<IPasswordResetInfo | undefined> {
        const moduleSessionId = this.moduleSessionId;
        if (!moduleSessionId) {
            return undefined;
        }

        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMysqlGetPasswordResetInfo,
            parameters: { args: { moduleSessionId, user, host, passwordExpired } },
        });

        return response.result;
    }

    public async resetPassword(password: string, currentPassword?: string, retainCurrentPassword = false,
        passwordExpired = false, user?: string, host?: string): Promise<void> {
        if (!this.moduleSessionId) {
            throw new Error("No SQL editor session is open.");
        }
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiSqlEditorResetPassword,
            parameters: { args: {
                moduleSessionId: this.moduleSessionId, password, currentPassword, retainCurrentPassword,
                passwordExpired, user, host,
            } },
        });
    }

    public executeServiceWithActiveRoles(sql: string, params?: unknown[]):
    Promise<IDbEditorResultSetData | undefined> {
        return super.executeService(sql, params, undefined, undefined, undefined, true);
    }

    /**
     * Executes the given SQL.
     *
     * @param sql The sql command to execute.
     * @param params Parameters for the query, if it contains placeholders.
     * @param requestId The ID to use for the request sent to the backend.
     * @param callback The callback for intermediate results.
     *
     * @param featureId
     * @returns A promise resolving to a list of records or undefined if no session is open.
     */
    public async execute(sql: string, params?: string[], requestId?: string,
        callback?: DataCallback<ShellAPIGui.GuiSqlEditorExecute>, featureId?: string,
    ): Promise<IDbEditorResultSetData | undefined> {
        const moduleSessionId = this.moduleSessionId;
        if (moduleSessionId) {
            const executeOptions: { rowPacketSize: number; featureId?: string } = {
                rowPacketSize: Settings.get("sql.rowPacketSize", 1000),
                ...(featureId ? { featureId } : {}),
            };
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorExecute,
                requestId,
                parameters: {
                    args: {
                        moduleSessionId,
                        sql,
                        params: params !== undefined && params.length > 0 ? params : undefined,
                        options: executeOptions,
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
                    result.rows ??= [];
                    result.rows.push(...entry.result.rows);
                }

                if (entry.result.columns) {
                    result.columns ??= [];
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
     * Generates a visual explain SVG for the given SQL statement.
     *
     * @param sql The SQL statement to explain.
     *
     * @returns A promise resolving to the SVG payload or undefined if no session is open.
     */
    public async visualExplain(sql: string,
        options: IVisualExplainOptions = defaultVisualExplainOptions): Promise<IVisualExplainData | undefined> {
        const moduleSessionId = this.moduleSessionId;
        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorVisualExplain,
                parameters: {
                    args: {
                        moduleSessionId,
                        sql,
                        options,
                    },
                },
            });

            for (const entry of response) {
                if (entry.result.svg) {
                    return entry.result;
                }
            }
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
            await this.interactive.sendInteractiveRequest({
                requestType: ShellAPIGui.GuiSqlEditorReconnect,
                parameters: { args: { moduleSessionId } },
                onData: (response) => {
                    const message = (response as { result?: unknown; }).result;
                    const { result, attributes } = (
                        typeof message === "object" && message !== null && "attributes" in message
                            ? message
                            : response
                    ) as {
                        result?: unknown;
                        attributes?: { auth?: unknown; };
                    };
                    if (typeof result === "string" && attributes?.auth === "authentication_webauthn") {
                        void ui.showInformationMessage(result, {});

                        return Promise.resolve(true);
                    }

                    return Promise.resolve(false);
                },
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
     * Kills the current database session.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public async killSession(): Promise<void> {
        const moduleSessionId = this.moduleSessionId;
        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiSqlEditorKillSession,
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

            return isBackendTrue(response.result);
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

    /**
     * Lists MySQL users.
     *
     * @returns A promise resolving to a list of MySQL users or undefined if no session is open.
     */
    public async listMySQLUsers(): Promise<IMySQLUserListItem[] | undefined> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiMysqlListUsers,
                parameters: { args: { moduleSessionId } },
                caseConversionIgnores: [
                    "schemaPrivileges",
                    "schema_privileges",
                    "tablePrivileges",
                    "table_privileges",
                    "columnPrivileges",
                    "column_privileges",
                    "routinePrivileges",
                    "routine_privileges",
                    "partialRevokes",
                    "partial_revokes",
                ],
            });

            return response.result;
        }

        return undefined;
    }

    /**
     * Replaces the granted/default roles for a MySQL user.
     *
     * @param user The user name.
     * @param host The host for this user.
     * @param roles The full selected role set as user@host account identifiers.
     * @param defaultRoles The selected role set to activate by default.
     */
    public async setMySQLUserRoles(
        user: string, host: string, roles: string[], defaultRoles: string[] = [],
    ): Promise<void> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiMysqlSetGrantedRoles,
                parameters: { args: {
                    user,
                    host,
                    roles,
                    defaultRoles,
                    moduleSessionId
                } },
            });
        }
    }

    /**
     * Lists global privileges supported by the connected MySQL server.
     *
     * @returns A promise resolving to global privilege catalog entries or undefined if no session is open.
     */
    public async listMySQLGlobalPrivilegeCatalog(): Promise<IMySQLGlobalPrivilegeCatalogItem[] | undefined> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiMysqlListGlobalPrivilegeCatalog,
                parameters: { args: { moduleSessionId } },
            });

            return response.result;
        }

        return undefined;
    }

    /**
     * Lists schema-level privileges supported by the connected MySQL server.
     *
     * @returns A promise resolving to schema privilege catalog entries or undefined if no session is open.
     */
    public async listMySQLSchemaPrivilegeCatalog(): Promise<IMySQLGlobalPrivilegeCatalogItem[] | undefined> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiMysqlListSchemaPrivilegeCatalog,
                parameters: { args: { moduleSessionId } },
            });

            return response.result;
        }

        return undefined;
    }

    /**
     * Lists the tables and routines in a schema for object privilege assignment.
     *
     * @param schema The schema name.
     *
     * @returns A promise resolving to schema object privilege targets or undefined if no session is open.
     */
    public async listMySQLObjectPrivilegeSchemaTargets(schema: string):
    Promise<IMySQLObjectPrivilegeSchemaTarget[] | undefined> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiMysqlListObjectPrivilegeSchemaTargets,
                parameters: { args: { schema, moduleSessionId } },
            });

            return response.result;
        }

        return undefined;
    }

    /**
     * Lists authentication plugins supported by the connected MySQL server.
     *
     * @returns A promise resolving to authentication plugin names or undefined if no session is open.
     */
    public async listMySQLAuthenticationPlugins(): Promise<string[] | undefined> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiMysqlListAuthenticationPlugins,
                parameters: { args: { moduleSessionId } },
            });

            return response.result;
        }

        return undefined;
    }

    /**
     * Returns server default values used to initialize the create user dialog.
     *
     * @returns A promise resolving to create user defaults or undefined if no session is open.
     */
    public async getMySQLCreateUserDefaults(): Promise<IMySQLDefaultUserOptions | undefined> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiMysqlGetCreateUserDefaults,
                parameters: { args: { moduleSessionId } },
            });

            return response.result;
        }

        return undefined;
    }

    /**
     * Replaces the direct global privileges for a MySQL user.
     *
     * @param user The user name.
     * @param host The host for this user.
     * @param privileges The full selected direct global privilege set.
     */
    public async setMySQLUserGlobalPrivileges(user: string, host: string, privileges: string[]): Promise<void> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiMysqlSetUserGlobalPrivileges,
                parameters: { args: {
                    user,
                    host,
                    privileges,
                    moduleSessionId
                } },
            });
        }
    }

    /**
     * Replaces the direct object privileges for a MySQL user.
     *
     * @param user The user name.
     * @param host The host for this user.
     * @param target The object privilege target.
     * @param privileges The full selected direct object privilege set.
     */
    public async setMySQLUserObjectPrivileges(
        user: string, host: string, target: IObjectPrivilegeTarget, privileges: string[],
    ): Promise<void> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiMysqlSetUserObjectPrivileges,
                parameters: { args: {
                    user,
                    host,
                    target,
                    privileges,
                    moduleSessionId
                } },
            });
        }
    }

    /**
     * Get a MySQL user details.
     *
     * @param user The user name.
     * @param host The host for this user.
     * @returns A promise resolving the details of a MySQL user.
     */
    public async getMySQLUser(user: string, host: string): Promise<IMySQLUser | null> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiMysqlGetUser,
                parameters: { args: {
                    user,
                    host,
                    moduleSessionId
                } },
            });

            return response.result;
        }

        return null;
    }

    /**
     * Create a MySQL user.
     *
     * @param options All the necessary data to create a MySQL user.
     * @returns A promise resolving information about the created user.
     */
    public async createMySQLUser(options: IMySQLUser): Promise<IUserInfo | null> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiMysqlCreateUser,
                parameters: { args: {
                    options,
                    moduleSessionId
                } },
            });

            return response.result;
        }

        return null;
    }

    /**
     * Create a MySQL user.
     *
     * @param user The MySQL user.
     * @param host The host for this user.
     * @returns A promise resolving the details of a MySQL user.
     */
    public async deleteMySQLUser(user: string, host: string): Promise<void> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiMysqlDeleteUser,
                parameters: { args: {
                    user,
                    host,
                    moduleSessionId
                } },
            });
        }
    }

    /**
     * Update a MySQL user.
     *
     * @param options All the necessary data to update a MySQL user.
     * @returns A promise resolving information about the updated user.
     */
    public async updateMySQLUser(options: IMySQLUser): Promise<IUserInfo | null> {
        const moduleSessionId = this.moduleSessionId;

        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiMysqlUpdateUser,
                parameters: { args: {
                    options,
                    moduleSessionId
                } },
            });

            return response.result;
        }

        return null;
    }

    private clearWorkspaceCaches(): void {
        this.performanceSchemaAvailable = undefined;
        this.performanceSchemaAvailabilityProbe = undefined;
        this.performanceReportCapabilities = undefined;
        this.performanceReportCapabilitiesProbe = undefined;
        this.partialRevokesEnabled = undefined;
        this.partialRevokesEnabledProbe = undefined;
    }
}
