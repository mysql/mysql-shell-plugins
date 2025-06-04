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

import { ApplicationDB, StoreType } from "../app-logic/ApplicationDB.js";
import { ISqlUpdateResult } from "../app-logic/general-types.js";
import { IResultSet } from "./index.js";

export interface IResultSetUpdater {
    /**
     * A function to send a notification if the current result is being replaced by nothing.
     * Useful for higher level consumers to update their storage (e.g. cached results).
     * Note: this is not used when disposing of the presentation (where we want to keep the data for later restore).
     */
    onRemoveResult: (resultIds: string[]) => Promise<void>;

    onCommitChanges: (resultSet: IResultSet, updateSql: string[]) => Promise<ISqlUpdateResult>;
    updateRowsForResultId: (resultSet: IResultSet) => Promise<void>;
    onRollbackChanges: (resultSet: IResultSet) => Promise<void>;
}

export class ResultSetUpdater implements IResultSetUpdater {
    public constructor(private store: StoreType, private runUpdates?: (sql: string[]) => Promise<ISqlUpdateResult>) {
    }

    public onRemoveResult = (resultIds: string[]): Promise<void> => {
        return ApplicationDB.removeDataByResultIds(this.store, resultIds);
    };

    public updateRowsForResultId = async (resultSet: IResultSet): Promise<void> => {
        await ApplicationDB.updateRowsForResultId(StoreType.Document, resultSet.resultId, resultSet.data.rows);
    };

    public onCommitChanges = async (resultSet: IResultSet, updateSql: string[]): Promise<ISqlUpdateResult> => {
        const result = await this.runUpdates?.(updateSql) ?? { affectedRows: 0, errors: [] };
        if (typeof result.affectedRows === "number") {
            await this.updateRowsForResultId(resultSet);
        }

        return result;
    };

    public onRollbackChanges = async (resultSet: IResultSet): Promise<void> => {
        const rows = await ApplicationDB.getRowsForResultId(StoreType.Document, resultSet.resultId);
        resultSet.data.rows = rows;
    };
}
