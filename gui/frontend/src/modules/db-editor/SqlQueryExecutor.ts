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

import { clearIntervalAsync, setIntervalAsync, SetIntervalAsyncTimer } from "set-interval-async";
import { ApplicationDB, StoreType } from "../../app-logic/ApplicationDB.js";
import { DBDataType, IColumnInfo, ISqlUpdateResult, IStatusInfo, MessageType } from "../../app-logic/general-types.js";
import { ResponseError } from "../../communication/ResponseError.js";
import { IScriptExecutionOptions } from "../../components/ui/CodeEditor/index.js";
import { ICdmConnectionEntry } from "../../data-models/ConnectionDataModel.js";
import { QueryType, type IStatement } from "../../parsing/parser-common.js";
import { IExecutionResult, IResponseDataOptions, ITextResultEntry } from "../../script-execution/index.js";
import { ScriptingLanguageServices } from "../../script-execution/ScriptingLanguageServices.js";
import { SQLExecutionContext } from "../../script-execution/SQLExecutionContext.js";
import {
    convertRows, generateColumnInfo, getColumnsMetadataForEmptyResultSet,
    parseSchemaTable,
} from "../../supplement/index.js";
import type { IColumnDetails } from "../../supplement/RequisitionTypes.js";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { uuid } from "../../utilities/helpers.js";
import { formatBase64ToHex, formatTime, formatWithNumber } from "../../utilities/string-helpers.js";
import { IQueryExecutionOptions } from "./ConnectionTab.js";

const errorRexExp = new RegExp(`(You have an error in your SQL syntax; check the manual that corresponds to your ` +
    `MySQL server version for the right syntax to use near '(.*)' at line )(\\d+)`);
const leadingLineBreaksRegExp = new RegExp(`^\\s*\\n+`);

interface IResultTimer {
    timer: SetIntervalAsyncTimer<unknown[]>;
    results: Array<[IExecutionResult, IResponseDataOptions]>;
}

interface IRunSqlCodeResult {
    statementCount: number;
    errorCount: number;
    startTime: number;
    jsStartLine: number;
    errorMessage: string;
    errorStatementStr: string;
    errorStatementIndex: number;
    jsCreateStatementStr: string;
}

export const sendSqlUpdatesFromModel = async (afterCommit: (() => void) | undefined, backend: ShellInterfaceSqlEditor,
    updates: string[]): Promise<ISqlUpdateResult> => {

    let lastIndex = 0;
    let rowCount = 0;
    try {
        await backend.startTransaction();
        for (; lastIndex < updates.length; ++lastIndex) {
            const update = updates[lastIndex];
            const result = await backend.execute(update);
            rowCount += result?.rowsAffected ?? 0;
        }
        await backend.commitTransaction();

        afterCommit?.();

        return { affectedRows: rowCount, errors: [] };
    } catch (reason) {
        await backend.rollbackTransaction();
        if (reason instanceof Error) {
            const errors: string[] = [];
            errors[lastIndex] = reason.message; // Set the error for the query that was last executed.

            return { affectedRows: rowCount, errors };
        }

        throw reason;
    }
};

export class SqlQueryExecutor {
    // Timers to serialize asynchronously incoming results.
    private resultTimers = new Map<string, IResultTimer>();

    #connection?: ICdmConnectionEntry;

    public constructor(public sqlUpdateColumnInfo?: (details: IColumnDetails) => void,
        connection?: ICdmConnectionEntry) {
        this.#connection = connection;
    }

    private static isJavascriptCreateStmt(statement: string): boolean {
        return statement.includes("CREATE")
            && statement.includes("LANGUAGE JAVASCRIPT") && statement.includes("$");
    }

    public handleDependentTasks?(options: IQueryExecutionOptions): void;

    public set connection(value: ICdmConnectionEntry | undefined) {
        this.#connection = value;
    }

    /**
     * Called for SQL code from a code editor. All result sets start at 0 offset in this scenario.
     *
     * @param context The context with the code to execute.
     * @param options Content and details for script execution.
     * @param pageSize The size of a page.
     * @param stopOnErrors Whether to stop execution when an error occurs.
     * @param mleEnabled Whether Multilingual Engine is enabled.
     * @param tabId An optional tab identifier for the execution.
     * @returns IRunSqlCodeResult promise (or undefined).
     */
    public runSQLCode = async (context: SQLExecutionContext, options: IScriptExecutionOptions,
        pageSize: number, stopOnErrors: boolean, mleEnabled: boolean,
        tabId?: string): Promise<IRunSqlCodeResult | undefined> => {
        const connection = this.#connection;

        if (!connection?.backend) {
            return undefined;
        }

        await context.clearResult();
        if (mleEnabled && options.is3rdLanguage) {
            // Reset MLE console log
            const param = context.dbVersion >= 90300 ? "'output'" : "";
            void await connection.backend.execute(`SELECT mle_session_reset(${param})`);
        }

        let statementCount = 0;
        let errorCount = 0;
        const startTime = Date.now();
        let jsStartLine = 0;
        let errorMessage: string = "";
        let errorStatementIndex: number = -1;
        let jsCreateStatementStr: string = "";
        let errorStatementStr: string = "";

        if (options.source) {
            const sql = (await context.getStatementAtPosition(options.source))?.text;

            await this.executeQuery(context, 0, 0, pageSize, options, sql ?? "", undefined, tabId);
        } else {
            const statements = await context.getExecutableStatements();

            // Count all statements that actually hold SQL to execute (ignoring statements only containing whitespace)
            const nonEmptyStatements = statements.filter((statement) => {
                return statement.text.trim() !== "";
            });
            statementCount = nonEmptyStatements.length;

            while (true) {
                // Allow toggling the stop-on-error during execution.
                const statement = statements.shift();
                if (!statement) {
                    break;
                }

                if (SqlQueryExecutor.isJavascriptCreateStmt(statement.text)) {
                    jsCreateStatementStr = statement.text;
                }

                try {
                    await this.executeQuery(context, statement.index, 0, pageSize,
                        options, statement.text, undefined, tabId);
                } catch (e) {
                    errorStatementStr = statement.text;
                    errorCount += 1;
                    if (mleEnabled) {
                        const lines = context.model?.getLinesContent();
                        if (lines) {
                            for (const line of lines) {
                                ++jsStartLine;
                                // Find the line with the first occurrence of $...$
                                if (line.match("\\$(.*?)\\$")) {
                                    break;
                                }
                            }
                        }
                        if (e instanceof Error) {
                            // If this error comes from Javascript, extract only the part after JavaScript>
                            const startIndex = e.message.indexOf("JavaScript>");
                            errorMessage = startIndex ? e.message.substring(startIndex) : e.message;
                            errorStatementIndex = statement.index;
                        }
                    }
                    if (stopOnErrors) {
                        break;
                    } // Else ignore the error and continue.
                }
            }
        }


        return {
            statementCount, errorCount, startTime, jsStartLine,
            errorMessage, errorStatementStr, errorStatementIndex, jsCreateStatementStr,
        };
    };

    /**
     * Executes a single query. The query is amended with a LIMIT clause, if the given count is > 0 (the page size)
     * and no other top level LIMIT clause already exists.
     *
     * @param context The context to send results to.
     * @param index The index of the query being executed.
     * @param page The page number for the LIMIT clause.
     * @param pageSize The size of a page.
     * @param options Content and details for script execution.
     * @param sql The query to execute.
     * @param oldResultId An optional ID which points to an existing result set. If given, this ID is used,
     *                    to replace that old result set with the new data. Otherwise a new result set is generated.
     * @param tabId An optional tab identifier for the execution.
     *
     * @returns A promise which resolves when the query execution is finished.
     */
    public executeQuery = async (context: SQLExecutionContext, index: number, page: number, pageSize: number,
        options: IScriptExecutionOptions, sql: string, oldResultId?: string, tabId = ""): Promise<void> => {

        if (sql.trim().length === 0) {
            return;
        }

        const connection = this.#connection;

        if (connection) {
            // Extract embedded parameters.
            const services = ScriptingLanguageServices.instance;
            const queryType = await services.determineQueryType(context, sql);

            const actualParams: string[] = [];

            if (queryType === QueryType.Select && options.params) {
                const embeddedParams = await services.extractQueryParameters(sql, context.dbVersion, context.sqlMode);

                // Create a list of parameter values (order is important) out from embedded parameters.
                // Passed-in parameters can override embedded ones.
                embeddedParams.forEach((param) => {
                    const externalParam = options.params!.find((candidate) => {
                        return candidate[0] === param[0];
                    });

                    if (externalParam) {
                        actualParams.push(externalParam[1]);
                    } else {
                        actualParams.push(param[1]);
                    }
                });
            }

            if (queryType === QueryType.Select && (pageSize > 0 || options.forceSecondaryEngine)) {
                // Add a top-level LIMIT clause if paging is enabled and no such LIMIT clause
                // exists already...
                // plus one row - this way we can determine if another page exists after this one.
                const offset = page * pageSize;
                const result = await services.preprocessStatement(context, sql, offset, pageSize + 1,
                    options.forceSecondaryEngine);

                let pkColumns: string[] | undefined;
                if (result.updatable && result.fullTableName) {
                    pkColumns = await this.getPrimaryKeyColumns(result.fullTableName);
                }

                await this.doExecution({
                    query: result.query,
                    original: sql,
                    queryType,
                    params: actualParams,
                    context,
                    index,
                    explicitPaging: result.changed,
                    currentPage: page,
                    oldResultId,
                    showAsText: options.asText ?? false,
                    updatable: result.updatable,
                    fullTableName: result.fullTableName,
                    pkColumns,
                    errorCallback: options.errorCallback,
                }, pageSize, tabId);
            } else {
                await this.doExecution({
                    query: sql,
                    original: sql,
                    queryType,
                    params: actualParams,
                    context,
                    index,
                    explicitPaging: false,
                    currentPage: page,
                    oldResultId,
                    showAsText: options.asText ?? false,
                    updatable: false,
                    errorCallback: options.errorCallback,
                }, pageSize, tabId);
            }
        }
    };

    /**
     * Adds the given data to the result timer for the specified request ID. If no timer exists yet, one is created.
     * The timer, whenever it triggers, sends the next result to the target context.
     *
     * @param context The context to send the result data to.
     * @param data The data to send.
     * @param options Additional details for the execution.
     */
    public addTimedResult(context: SQLExecutionContext, data: IExecutionResult,
        options: IResponseDataOptions): void {
        const resultTimer = this.resultTimers.get(options.resultId);
        if (!resultTimer) {
            // Create the timer, if it doesn't exist.
            const newTimer: IResultTimer = {
                timer: setIntervalAsync(async (id: string) => {
                    const resultTimer = this.resultTimers.get(id);
                    if (resultTimer) {
                        const pendingResult = resultTimer.results.shift();
                        if (pendingResult) {
                            await context.addResultData(pendingResult[0], pendingResult[1], { showIndexes: true });
                        } else {
                            // No results left. Stop the timer.
                            void clearIntervalAsync(resultTimer.timer).then(() => {
                                this.resultTimers.delete(id);
                            });
                        }
                    }
                }, 20, options.resultId),

                results: [[data, options]],
            };

            this.resultTimers.set(options.resultId, newTimer);
        } else {
            resultTimer.results.push([data, options]);
        }
    }

    /**
     * Helper to asynchronously update the column details for the given table.
     *
     * @param requestId The ID of the request that got results and needs the column info update.
     * @param fullTableName The full name of the table to update the column details for.
     * @param columnNames The names of all columns in the result set.
     */
    public async updateColumnDetails(requestId: string, fullTableName: string,
        columnNames: string[]): Promise<void> {
        const connection = this.#connection;

        const { schema, table } = await parseSchemaTable(fullTableName, connection?.backend);

        // Get all column names.
        const tableColumns = await connection?.backend.getTableObjectNames(schema, table, "Column");

        // Retrieve the column details for each column in the result set.
        const details: IColumnDetails = {
            resultId: requestId,
            columns: [],
        };

        for (const tableColumn of tableColumns ?? []) {
            if (columnNames.includes(tableColumn)) {
                const info = await connection?.backend.getTableObject(schema, table, "Column", tableColumn);
                if (info) {
                    details.columns.push({
                        inPK: info.isPk === 1,
                        default: info.default,
                        nullable: info.notNull === 0,
                        autoIncrement: info.autoIncrement === 1,
                    });
                }
            }
        }

        if (this.sqlUpdateColumnInfo) {
            this.sqlUpdateColumnInfo(details);
        }
    }

    /**
     * Starts a trace sequence to get details about a HeatWave error.
     * The result of that trace will be added to the given context.
     *
     * @param context The context to add the additional info.
     * @param sql The query which caused the trouble.
     * @param resultId The id of the associated result.
     */
    public async getHeatWaveTrace(context: SQLExecutionContext, sql: string, resultId: string): Promise<void> {
        const connection = this.#connection;

        if (!connection) {
            return;
        }

        const services = ScriptingLanguageServices.instance;
        const type = await services.determineQueryType(context, sql);
        if (type !== QueryType.ExplainStatement) {
            // If the statement is not an explain statement then make it one.
            // That avoids any large data retrieval for this trace.
            sql = "explain " + sql;
        }

        // Store the current values for the optimizer trace and enable it (if it wasn't yet).
        // Setting the offset every time is essential to trigger a reset which is required for correct results.
        try {
            await connection.backend.execute("SET @old_optimizer_trace = @@optimizer_trace, " +
                "@old_optimizer_trace_offset = @@optimizer_trace_offset, @@optimizer_trace = \"enabled=on\", " +
                "@@optimizer_trace_offset = -2;");

            // Run the query on the primary engine.
            await connection.backend.execute(sql);

            // Now we can read the optimizer trace to get the details.
            const result = await connection.backend.execute("SELECT QUERY, TRACE->'$**.Rapid_Offload_Fails', " +
                "TRACE->'$**.secondary_engine_not_used' FROM INFORMATION_SCHEMA.OPTIMIZER_TRACE;");

            // Restore the previous trace status.
            await connection.backend.execute("SET @@optimizer_trace = @old_optimizer_trace, " +
                "@@optimizer_trace_offset = @old_optimizer_trace_offset;", [], resultId);

            if (result) {
                const rows = result.rows as string[][] | undefined;
                if (rows && rows.length > 0 && rows[0].length > 1) {
                    const info = (rows[0][1] ?? rows[0][2]);

                    // Remove outer braces and split into the two values.
                    const values = info.substring(2, info.length - 2).split(":");
                    if (values.length > 1) {
                        // Remove the quotes and add this text to the error info
                        // of the given context.
                        const text = values[1].trim();
                        const info: ITextResultEntry = {
                            content: "Optimizer Trace: " + text.substring(1, text.length - 1),
                            type: MessageType.Warning,
                            language: "ansi",
                        };

                        await context.addResultData({
                            type: "text",
                            text: [info],
                        }, { resultId: "" });
                    }
                }
            }
        } catch (error) {
            const info: ITextResultEntry = {
                content: "Error while getting optimizer trace:\n" + String(error),
                type: MessageType.Error,
                language: "ansi",
            };

            await context.addResultData({
                type: "text",
                text: [info],
            }, { resultId: "" });

        }
    }

    /**
     * Converts the given tabular data into a text representation. The method updates the given column info with the
     * width of each column, if not yet done.
     *
     * @param rows The row data.
     * @param columns Column information.
     * @param started A flag indicating whether the column header must be rendered
     * @param finished A flag indicating whether the final line must be rendered.
     * @param status The status information.
     *
     * @returns The text representation of the given data.
     */
    public convertResultSetToText(rows: IDictionary[], columns: IColumnInfo[], started: boolean,
        finished: boolean, status: IStatusInfo): string {

        const withStatusInfo = (output: string, status: IStatusInfo) => {
            if (status.text) {
                output += `${status.text}\n`;
            }

            return output;
        };

        if (rows.length === 0 && columns.length === 0) {
            return withStatusInfo("", status);
        }

        let result = "";

        const convertLineBreaks = (value: string): string => {
            const result = value.replaceAll(/\r/g, "\\r");

            return result.replaceAll(/\n/g, "\\n");
        };

        // Compute the width of each column, based on the column name and the data, if not yet done.
        if (columns.length > 0 && columns[0].width === undefined) {
            columns.forEach((column: IColumnInfo) => {
                column.title = convertLineBreaks(column.title);
                column.width = column.title.length;
                switch (column.dataType.type) {
                    case DBDataType.TinyInt:
                    case DBDataType.SmallInt:
                    case DBDataType.MediumInt:
                    case DBDataType.Int:
                    case DBDataType.Bigint:
                    case DBDataType.UInteger:
                    case DBDataType.Float:
                    case DBDataType.Real:
                    case DBDataType.Double:
                    case DBDataType.Decimal: {
                        column.rightAlign = true;

                        break;
                    }

                    default:
                }
            });
        }

        rows.forEach((row) => {
            let value;
            columns.forEach((column) => {
                switch (column.dataType.type) {
                    // Binary data
                    case DBDataType.TinyBlob:
                    case DBDataType.Blob:
                    case DBDataType.MediumBlob:
                    case DBDataType.LongBlob:
                    case DBDataType.Binary:
                    case DBDataType.Varbinary: {
                        value = formatBase64ToHex(String(row[column.field]), 64);

                        break;
                    }

                    default: {
                        value = String(row[column.field]);

                        break;
                    }
                }

                row[column.field] = value;
                let length = value.length;

                // Check if the value has line breaks, if so, find the longest line
                if (/\r|\n/.exec(value)) {
                    let maxLength = 0;
                    const lines = value.split(/\r|\n/);
                    for (const ln of lines) {
                        if (ln.length > maxLength) {
                            maxLength = ln.length;
                        }
                    }
                    length = maxLength;
                }
                if (length > (column.width ?? 0)) {
                    column.width = length;
                }
            });
        });

        const separator = columns.reduce((previous, current) => {
            return previous + "-".repeat(current.width! + 2) + "+";
        }, "+");

        if (started) {
            // Render the column header.
            result += separator + "\n";

            const line = columns.reduce((previous, current, index) => {
                return previous + " " + current.title.padEnd(columns[index].width!) + " |";
            }, "|");
            result += line + "\n" + separator + "\n";
        }

        // Render the data.
        rows.forEach((row) => {
            const line = columns.reduce((previous, current, index) => {
                if (columns[index].rightAlign) {
                    return previous + " " + String(row[current.field]).padStart(columns[index].width!) + " |";
                }

                if (/\r|\n/.exec(String(row[current.field]))) {
                    let multiLineStr = previous;
                    let pre = "| ";
                    let post = " ";
                    columns.forEach((c, i) => {
                        if (i < index) {
                            pre += `${" ".repeat(c.width!)} | `;
                        } else if (i > index) {
                            post += `${" ".repeat(c.width!)} | `;
                        }
                    });

                    pre = pre.slice(0, -1);
                    post = post.slice(0, -1);

                    const lines = String(row[current.field]).split(/\r|\n/);
                    lines.forEach((ln, i) => {
                        if (i > 0) {
                            multiLineStr += pre;
                        }
                        multiLineStr += ` ${ln}${" ".repeat(columns[index].width! - ln.length)} |`;
                        if (i < lines.length - 1) {
                            multiLineStr += post + "\n";
                        }
                    });

                    return multiLineStr;
                }

                return previous + " " + String(row[current.field]).padEnd(columns[index].width!) + " |";
            }, "|");
            result += line + "\n";
        });

        if (finished) {
            result += separator + "\n";
        }

        return withStatusInfo(result, status);
    }

    /**
     * Implements the actual query execution and the result handling.
     *
     * @param options Details for execution.
     * @param pageSize The size of a page.
     * @param tabId The tab identifier for the execution.
     *
     * @returns A promise that resolves when all responses have been received.
     */
    private doExecution = async (options: IQueryExecutionOptions, pageSize: number, tabId: string): Promise<void> => {
        const connection = this.#connection;

        let resultId = uuid();
        let replaceData = false;
        let subIndex: number | undefined;
        if (options.queryType === QueryType.Call) {
            subIndex = 0;
        }
        let exceptionThrown;

        try {
            // Prepare the execution (storage, UI).
            if (options.oldResultId) {
                resultId = options.oldResultId;
                replaceData = true;

                // We are going to replace result data, instead of adding a complete new set.
                // In this case remove the old data first from the storage.
                if (resultId) {
                    void ApplicationDB.removeDataByResultIds(StoreType.Document, [resultId]);
                }
            }

            // Have to keep the column definition around for all data packages, for row conversion,
            // but must store it only once (when they come in, which happens only once).
            let columns: IColumnInfo[] = [];
            let setColumns = false;

            options.context.executionStarts();
            await connection!.backend.execute(options.query, options.params, undefined, async (data) => {
                let hasMoreRows = false;
                let rowCount = 0;
                let status: IStatusInfo = { text: "" };
                let resultSummary = false;

                if (data.result.totalRowCount !== undefined) {
                    resultSummary = true;

                    rowCount = data.result.totalRowCount;

                    if (options.explicitPaging) {
                        // We added 1 to the total count for the LIMIT clause to allow determining if
                        // more pages are available. That's why we have to decrement the row count for display.
                        if (pageSize < rowCount) {
                            --rowCount;
                            data.result.rows?.pop();

                            hasMoreRows = true;
                        }
                    }

                    if (data.result.rowsAffected) {
                        status = {
                            text: `OK, ${formatWithNumber("row", data.result.rowsAffected)} affected in ` +
                                formatTime(data.result.executionTime),
                        };
                    } else {
                        status = {
                            text: `OK, ${formatWithNumber("record", rowCount)} retrieved in ` +
                                formatTime(data.result.executionTime),
                        };
                    }
                }

                if (!data.result.columns && rowCount === 0) {
                    if (options.updatable) {
                        const columnsMetadata = await getColumnsMetadataForEmptyResultSet(
                            options.fullTableName, options.queryType, connection!.details.dbType, connection!.backend,
                        );
                        if (columnsMetadata.length) {
                            data.result.columns = columnsMetadata;
                        }
                    } else if (!options.showAsText) {
                        data.result.columns = [{ name: "*", type: "", length: 0 }];
                    }
                }

                if (data.result.columns) {
                    columns = generateColumnInfo(connection!.details.dbType, data.result.columns);
                    setColumns = true;

                    // Check if all PK columns are part of the columns list.
                    if (options.updatable && options.fullTableName) {
                        if (options.pkColumns && options.pkColumns.length > 0) {
                            for (const pkColumn of options.pkColumns) {
                                const column = columns.find((c) => {
                                    return c.title === pkColumn;
                                });
                                if (!column) {
                                    options.updatable = false;
                                    break;
                                } else {
                                    column.inPK = true;
                                }
                            }
                        } else {
                            // No primary key columns found -> table is not updatable.
                            options.updatable = false;
                        }
                    }
                }
                const rows = convertRows(columns, data.result.rows);

                if (options.showAsText) {
                    let query = options.query.trim();
                    if (!query.endsWith(";")) {
                        query += ";";
                    }
                    let content = `sql> ${query}\n`;

                    content += this.convertResultSetToText(rows, columns, setColumns, resultSummary, status);

                    this.addTimedResult(options.context, {
                        type: "text",
                        executionInfo: resultSummary ? status : undefined,
                        text: [{
                            type: MessageType.Text,
                            content,
                        }],
                    }, {
                        resultId,
                        index: options.index,
                        sql: options.original,
                        replaceData,
                    });
                } else {
                    void ApplicationDB.db.add("documentResultData", {
                        tabId,
                        resultId,
                        rows,
                        columns: setColumns ? columns : undefined,
                        executionInfo: resultSummary ? status : undefined,
                        totalRowCount: resultSummary ? rowCount : undefined,
                        hasMoreRows,
                        currentPage: options.currentPage,
                        index: options.index,
                        subIndex,
                        sql: options.original,
                        updatable: options.updatable,
                        fullTableName: options.fullTableName,
                    });

                    // Add row data directly to the context. Not via a timed result, as we need to ensure
                    // proper ordering of data rendering and column info updates that follow below.
                    void options.context.addResultData({
                        type: "resultSetRows",
                        rows,
                        columns: setColumns ? columns : undefined,
                        executionInfo: resultSummary ? status : undefined,
                        totalRowCount: resultSummary ? rowCount : undefined,
                        hasMoreRows,
                        currentPage: options.currentPage,
                    }, {
                        resultId,
                        index: options.index,
                        subIndex,
                        sql: options.original,
                        replaceData,
                        updatable: options.updatable,
                        fullTableName: options.fullTableName,
                    }, undefined, options.queryType);
                }

                if (resultSummary) {
                    // Trigger column details update for this result set.
                    if (options.queryType === QueryType.Select) {
                        if (options.updatable && !options.showAsText && options.fullTableName) {
                            const columnNames = columns.map((c) => {
                                return c.title;
                            });

                            // Don't wait for the update.
                            void this.updateColumnDetails(resultId, options.fullTableName, columnNames);
                        }
                    }

                    resultId = uuid();
                    if (options.queryType === QueryType.Call) {
                        ++subIndex!;
                    }
                }

                setColumns = false;
                replaceData = false;
            });

            if (this.handleDependentTasks) {
                this.handleDependentTasks(options);
            }
        } catch (reason) {
            exceptionThrown = reason;

            const resultTimer = this.resultTimers.get(resultId);
            if (resultTimer) {
                await clearIntervalAsync(resultTimer.timer);
                this.resultTimers.delete(resultId);
            }

            let type = MessageType.Error;
            let content = "";

            let code = 0;
            if (reason instanceof ResponseError) {
                content = reason.info.requestState.msg;
                if (reason.info.requestState.code) {
                    code = reason.info.requestState.code;
                } else {
                    // No code, but we have a message. Try to find a code in the message.
                    const match = content.match(/MySQL Error \((\d+)\)/);
                    if (match) {
                        code = parseInt(match[1], 10);
                    }

                    const scriptingErrorPrefix = "ScriptingError: ClassicSession.run_sql: \n";
                    if (content.startsWith(scriptingErrorPrefix)) {
                        content = content.substring(scriptingErrorPrefix.length).trim();
                        if (content.startsWith("Exception: ")) {
                            content = `ERROR: ${content.substring(11)}`;
                        }
                    }
                }
            } else {
                content = reason as string;

            }

            // Remove function name
            content = content.replaceAll(" ClassicSession.run_sql:", "");

            switch (code) {
                case 1201: {
                    type = MessageType.Warning;
                    content = "Cancelled: query was prematurely stopped";

                    break;
                }

                case 1064: { // Syntax error with line number.
                    // Replace the line number in the error message with the one that corresponds to the offset
                    // of the current query in the executing block.
                    const match = content.match(errorRexExp);
                    if (match) {
                        // First parse the given error line (they are one-based).
                        let line = parseInt(match[3], 10);

                        // Then add the offset of the query within the block. The query index is one-based too.
                        const statements = await options.context.getExecutableStatements();
                        const statement = statements[options.index - 1] as IStatement | undefined;
                        if (statement) {
                            line += statement.line;

                            // And we also have to account for leading line breaks, as they are not counted in the
                            // query.
                            const leadingLineBreaks = statement.text.match(leadingLineBreaksRegExp);
                            if (leadingLineBreaks) {
                                line += leadingLineBreaks[0].length;
                            }
                        }

                        content = content.replace(errorRexExp, (_str, group1: string) => {
                            return `${group1}${line}`;
                        });
                    }

                    break;
                }

                default:
            }

            // If a specific error callback was given, execute that before adding the error output
            if (options.errorCallback) {
                await options.errorCallback(content);
            }

            this.addTimedResult(options.context, {
                type: "text",
                text: [{
                    type,
                    index: options.index,
                    content,
                    language: "ansi",
                }],
                executionInfo: { text: "" },
            }, {
                resultId,
                index: options.index,
                sql: options.original,
                replaceData,
            });

            switch (code) {
                case 3889: {
                    // Sent if a select query was executed on HeatWave, which contained a problem.
                    await this.getHeatWaveTrace(options.context, options.original, resultId);

                    break;
                }

                default:
            }
        }

        if (exceptionThrown !== undefined) {
            throw new Error(String(exceptionThrown));
        }
    };

    /**
     * Retrieves all columns that are part of the primary key for the given table.
     *
     * @param fullTableName The full name of the table to get the primary key columns for.
     *
     * @returns A promise that resolves to an array of column names that are part of the primary key.
     */
    private async getPrimaryKeyColumns(fullTableName: string): Promise<string[]> {
        const connection = this.#connection;

        const { schema, table } = await parseSchemaTable(fullTableName, connection?.backend);

        return connection?.backend.getTableObjectNames(schema, table, "Primary Key") ?? [];
    }
}
