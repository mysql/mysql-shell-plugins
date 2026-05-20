/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import { describe, expect, it, vi } from "vitest";

import { SqlQueryExecutor } from "../../../../modules/db-editor/SqlQueryExecutor.js";
import type { SQLExecutionContext } from "../../../../script-execution/SQLExecutionContext.js";
import type { IExecutionResult, IResponseDataOptions } from "../../../../script-execution/index.js";
import type { IColumnDetails } from "../../../../supplement/RequisitionTypes.js";

interface IResultTimer {
    results: Array<[IExecutionResult, IResponseDataOptions]>;
}

// @ts-expect-error, we need access to private members here.
class TestSqlQueryExecutor extends SqlQueryExecutor {
    public declare resultTimers: Map<string, IResultTimer>;
}

describe("SqlQueryExecutor tests", (): void => {
    it("runs explicit SQL source text as a single statement", async () => {
        const executor = new SqlQueryExecutor(undefined, { backend: {} } as never);
        const getExecutableStatements = vi.fn();
        const getStatementAtPosition = vi.fn();
        const context = {
            clearResult: vi.fn().mockResolvedValue(undefined),
            getExecutableStatements,
            getStatementAtPosition,
        } as unknown as SQLExecutionContext;
        const executeQuery = vi.spyOn(executor, "executeQuery").mockResolvedValue();

        await executor.runSQLCode(context, {
            asText: true,
            explain: true,
            sourceText: "  select 2;  ",
        }, 100, true, false, "tab-1");

        expect(executeQuery).toHaveBeenCalledWith(context, 0, 0, 100, {
            asText: true,
            explain: true,
            sourceText: "  select 2;  ",
        }, "select 2;", undefined, "tab-1");
        expect(getExecutableStatements).not.toHaveBeenCalled();
        expect(getStatementAtPosition).not.toHaveBeenCalled();
    });

    it("delivers queued timed results and cleans up the timer", async () => {
        const executor = new TestSqlQueryExecutor();
        const addResultData = vi.fn().mockResolvedValue(undefined);
        const context = {
            addResultData,
        } as unknown as SQLExecutionContext;

        const firstResult: IExecutionResult = {
            type: "text",
            text: [],
        };
        const secondResult: IExecutionResult = {
            type: "about",
            info: "done",
        };
        const options: IResponseDataOptions = {
            resultId: "result-1",
        };

        vi.useRealTimers();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2100-10-12T09:09:09Z"));
        try {
            void executor.addTimedResult(context, firstResult, options);
            void executor.addTimedResult(context, secondResult, options);

            expect(executor.resultTimers.size).toBe(1);

            await vi.advanceTimersByTimeAsync(20);
            expect(addResultData).toHaveBeenNthCalledWith(1, firstResult, options, { showIndexes: true });

            await vi.advanceTimersByTimeAsync(20);
            expect(addResultData).toHaveBeenNthCalledWith(2, secondResult, options, { showIndexes: true });

            await vi.advanceTimersByTimeAsync(20);
            expect(executor.resultTimers.size).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it("matches result columns to table columns case-insensitively", async () => {
        const sqlUpdateColumnInfo = vi.fn<(details: IColumnDetails) => void>();
        const backend = {
            getTableObjectNames: vi.fn().mockResolvedValue(["id"]),
            getTableObject: vi.fn().mockResolvedValue({
                isPk: 1,
                default: undefined,
                notNull: 1,
                autoIncrement: 0,
            }),
        };
        const executor = new SqlQueryExecutor(sqlUpdateColumnInfo, { backend } as never);

        await executor.updateColumnDetails("result-id", "`sakila`.`film`", ["ID"]);

        expect(backend.getTableObject).toHaveBeenCalledWith("sakila", "film", "Column", "id");
        expect(sqlUpdateColumnInfo).toHaveBeenCalledWith({
            resultId: "result-id",
            columns: [{
                inPK: true,
                default: undefined,
                nullable: false,
                autoIncrement: false,
            }],
        });
    });
});
