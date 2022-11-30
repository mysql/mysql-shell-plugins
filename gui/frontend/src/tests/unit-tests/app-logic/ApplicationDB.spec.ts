/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { ApplicationDB, StoreType } from "../../../app-logic/ApplicationDB";

describe("ApplicationDB tests", () => {

    beforeAll(async () => {
        await ApplicationDB.loaded;
    });

    it("Add + remove data by tab ID", async () => {
        await ApplicationDB.db.put(StoreType.DbEditor, {
            tabId: "1",
            resultId: "123",
            rows: [],
            sql: "",
            currentPage: 1,
            hasMoreRows: false,
        });

        let data = await ApplicationDB.db.getAllFromIndex(StoreType.DbEditor, "tabIndex", "1");
        expect(data.length).toBe(1);

        data = await ApplicationDB.db.getAllFromIndex(StoreType.DbEditor, "tabIndex", "2");
        expect(data.length).toBe(0);

        await ApplicationDB.removeDataByTabId(StoreType.DbEditor, "1");
        data = await ApplicationDB.db.getAllFromIndex(StoreType.DbEditor, "tabIndex", "1");
        expect(data.length).toBe(0);
        data = await ApplicationDB.db.getAllFromIndex(StoreType.DbEditor, "resultIndex", "123");
        expect(data.length).toBe(0);
    });

    it("Add + remove data by request ID", async () => {
        await ApplicationDB.loaded;

        await ApplicationDB.db.put(StoreType.DbEditor, {
            tabId: "2",
            resultId: "456",
            index: 888,
            rows: [],
            sql: "",
            currentPage: 1,
            hasMoreRows: false,
        });

        let data = await ApplicationDB.db.getAllFromIndex(StoreType.DbEditor, "resultIndex", "123");
        expect(data.length).toBe(0);
        data = await ApplicationDB.db.getAllFromIndex(StoreType.DbEditor, "resultIndex", "456");
        expect(data.length).toBe(1);
        expect(data[0].index).toBe(888);

        await ApplicationDB.removeDataByResultIds(StoreType.DbEditor, ["0", "1000"]);
        data = await ApplicationDB.db.getAllFromIndex(StoreType.DbEditor, "resultIndex", "456");
        expect(data.length).toBe(1);
        data = await ApplicationDB.db.getAllFromIndex(StoreType.DbEditor, "resultIndex", "456");
        expect(data.length).toBe(1);

        await ApplicationDB.removeDataByResultIds(StoreType.DbEditor, ["456", "1000"]);
        data = await ApplicationDB.db.getAllFromIndex(StoreType.DbEditor, "resultIndex", "456");
        expect(data.length).toBe(0);

        await ApplicationDB.removeDataByResultIds(StoreType.DbEditor, []);
        data = await ApplicationDB.db.getAllFromIndex(StoreType.DbEditor, "resultIndex", "456");
        expect(data.length).toBe(0);
    });

    it("Upgrade the DB", async () => {
        await ApplicationDB.db.put(StoreType.DbEditor, {
            tabId: "2",
            resultId: "456",
            rows: [],
            sql: "",
            currentPage: 1,
            hasMoreRows: false,
        });

        await ApplicationDB.db.put(StoreType.DbEditor, {
            tabId: "3",
            resultId: "456",
            index: 99,
            rows: [],
            sql: "",
            currentPage: 1,
            hasMoreRows: false,
        });

        // Close and reopen with the same DB version. Should keep the data.
        ApplicationDB.db.close();
        await ApplicationDB.initialize(false);

        let data = await ApplicationDB.db.getAllFromIndex(StoreType.DbEditor, "resultIndex", "456");
        expect(data.length).toBe(2);

        // Close and reopen with a new DB version. This will remove all existing data.
        ApplicationDB.db.close();
        ApplicationDB.dbVersion++;
        await ApplicationDB.initialize(false);

        data = await ApplicationDB.db.getAllFromIndex(StoreType.DbEditor, "resultIndex", "456");
        expect(data.length).toBe(0);
    });
});
