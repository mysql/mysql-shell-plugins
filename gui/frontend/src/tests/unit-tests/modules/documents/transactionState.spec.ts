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

import { describe, expect, it } from "vitest";

import { QueryType } from "../../../../parsing/parser-common.js";
import { getNextTransactionOpenState } from "../../../../modules/db-editor/transactionState.js";

describe("transaction state helpers", () => {
    it("keeps explicit transactions visible while autocommit is enabled", () => {
        expect(getNextTransactionOpenState(false, true, {
            queryType: QueryType.StartTransaction,
        })).toBe(true);
        expect(getNextTransactionOpenState(false, true, {
            queryType: QueryType.BeginWork,
        })).toBe(true);
    });

    it("clears the active transaction when autocommit is turned on", () => {
        expect(getNextTransactionOpenState(true, true, {
            queryType: QueryType.SetAutoCommit,
        })).toBe(false);
        expect(getNextTransactionOpenState(true, false, {
            queryType: QueryType.SetAutoCommit,
        })).toBe(true);
    });

    it("closes the active transaction on commit and rollback", () => {
        expect(getNextTransactionOpenState(true, true, {
            queryType: QueryType.Commit,
        })).toBe(false);
        expect(getNextTransactionOpenState(true, true, {
            queryType: QueryType.RollbackWork,
        })).toBe(false);
    });
});
