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

import { MockSession } from "./MockSession.js";

export class MockRow implements IMrsRow {
    #data: IDictionary

    public constructor(data: IDictionary) {
        this.#data = data;
    }

    public getField = (name: string) => {
        if (this.#data[name] !== undefined) {
            return this.#data[name];
        }
        return undefined;
    }
}

export class MockResultSet implements IMrsResultSet {
    #session: MockSession;
    #nextResult: IDictionary[] | undefined;

    public constructor(session: MockSession) {
        this.#session = session;
        this.#nextResult = this.#session.runSqlTestBuffer.shift();
    }

    public fetchOneObject = (): IDictionary | null => { return this.#nextResult?.shift() ?? null; }

    public fetchOne = (): IMrsRow | null => {
        const row = this.fetchOneObject();
        if (row !== null) {
            return new MockRow(row);
        }

        return null;
    }

    public fetchAll = (): IMrsRow[] => {
        let rows: IMrsRow[] = [];

        let row = this.fetchOne();
        while (row !== null) {
            rows.push(row);
            row = this.fetchOne();
        }

        return rows;
    }

    public nextResult = (): boolean => {
        this.#nextResult = this.#session.runSqlTestBuffer.shift();
        return this.#session.runSqlTestBuffer.length > 0;
    }
}
