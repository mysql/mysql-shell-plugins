/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

// This file contains an IndexedDB based application database for local data in a session.

import { DBSchema, deleteDB, IDBPDatabase, openDB } from "idb";

import { requisitions } from "../supplement/Requisitions";
import { uuid } from "../utilities/helpers";
import { IColumnInfo, IDictionary, IExecutionInfo } from "./Types";

export enum StoreType {
    Unused = "unused",
    DbEditor = "dbModuleResultData",
    Shell = "shellModuleResultData"
}

export interface IDbModuleResultData {
    // There's an auto incremented field (id) to make entries unique.

    /** The tab id is used to quickly remove all associated entries when a tab is closed. */
    tabId: string;
    resultId: string;
    columns?: IColumnInfo[];
    rows: IDictionary[];
    executionInfo?: IExecutionInfo;
    totalRowCount?: number;

    // Paging support.
    currentPage: number;
    hasMoreRows: boolean;

    /** An optional value to map a result set to the query that produced it. */
    index?: number;

    /** SQL text exists only for the start response. */
    sql?: string;
}

interface IShellModuleResultData {
    // There's an auto incremented field (id) to make entries unique.

    /** The tab id is used to quickly remove all associated entries when a tab is closed. */
    tabId: string;
    resultId: string;
    columns?: IColumnInfo[];
    rows: unknown[];
    executionInfo?: IExecutionInfo;

    /** An optional value to map a result set to the query that produced it. */
    index: number;
}

/** Application object store schema. Each module uses an own store. */
interface IAppStoreSchema extends DBSchema {
    unused: { // Not really used. Only here to allow "unused" as store name in cases, where we don't need a store.
        value: {
            resultId: string;
        };
        key: string;
        indexes: { resultIndex: string; tabIndex: string; };
    };

    dbModuleResultData: {
        value: IDbModuleResultData;
        key: string;
        indexes: { resultIndex: string; tabIndex: string; };
    };

    shellModuleResultData: {
        value: IShellModuleResultData;
        key: string;
        indexes: { resultIndex: string; tabIndex: string; };
    };
}

type IAppIndexedDB = IDBPDatabase<IAppStoreSchema>;

export class ApplicationDB {

    public static loaded: Promise<void>;

    // Public to allow tests to change the hard coded value.
    public static dbVersion = 1;

    private static appDB: IAppIndexedDB;
    private static dbName = "msg:" + uuid();

    public static get db(): IAppIndexedDB {
        return ApplicationDB.appDB;
    }

    /* istanbul ignore next */
    private constructor() { /* */ }

    public static async cleanUp(): Promise<void> {
        await ApplicationDB.loaded;

        ApplicationDB.appDB.close();
        void deleteDB(ApplicationDB.dbName);
    }

    /**
     * Removes data stored in store, for the given tab id.
     *
     * @param store The store that must be updated.
     * @param tabId The id of the tab for which to remove all data.
     * @returns A promise which resolves when the task is done.
     */
    public static async removeDataByTabId(store: StoreType, tabId: string): Promise<void> {
        await ApplicationDB.loaded;

        const transaction = ApplicationDB.appDB.transaction(store, "readwrite");
        const tabIndex = transaction.store.index("tabIndex");
        let cursor = await tabIndex.openCursor(IDBKeyRange.only(tabId));
        while (cursor) {
            await cursor.delete();
            cursor = await cursor.continue();
        }
    }

    /**
     * Removes data stored in store, for the given list of request ids.
     *
     * @param store The store that must be updated.
     * @param resultIds The list of ids for which to remove all data.
     * @returns A promise which resolves when the task is done.
     */
    public static async removeDataByResultIds(store: StoreType, resultIds: string[]): Promise<void> {
        await ApplicationDB.loaded;

        if (resultIds.length > 0) {
            const transaction = ApplicationDB.appDB.transaction(store, "readwrite");
            for (const id of resultIds) {
                if (id) {
                    const tabIndex = transaction.store.index("resultIndex");
                    let cursor = await tabIndex.openCursor(IDBKeyRange.only(id));
                    while (cursor) {
                        await cursor.delete();
                        cursor = await cursor.continue();
                    }
                }
            }
        }
    }

    public static async initialize(clear = true): Promise<void> {
        return new Promise((resolve, reject) => {
            openDB<IAppStoreSchema>(ApplicationDB.dbName, ApplicationDB.dbVersion, {
                upgrade: (db) => {
                    // Never called when the DB version did not change.
                    if (db.objectStoreNames.contains(StoreType.DbEditor)) {
                        db.deleteObjectStore(StoreType.DbEditor);
                    }

                    if (db.objectStoreNames.contains(StoreType.Shell)) {
                        db.deleteObjectStore(StoreType.Shell);
                    }

                    const dbEditorStore = db.createObjectStore(StoreType.DbEditor, { autoIncrement: true });
                    dbEditorStore.createIndex("resultIndex", "resultId", { unique: false });
                    dbEditorStore.createIndex("tabIndex", "tabId", { unique: false });

                    const shellDataStore = db.createObjectStore(StoreType.Shell, { autoIncrement: true });
                    shellDataStore.createIndex("resultIndex", "resultId", { unique: false });
                    shellDataStore.createIndex("tabIndex", "tabId", { unique: false });
                },
            }).then((db) => {
                ApplicationDB.appDB = db;
                if (clear) {
                    Promise.all([
                        db.clear(StoreType.DbEditor),
                        db.clear(StoreType.Shell),
                    ]).then(() => {
                        resolve();
                    }).catch(/* istanbul ignore next */(reason) => {
                        reject(reason);
                    });
                } else {
                    resolve();
                }
            }).catch(/* istanbul ignore next */(reason) => {
                void requisitions.execute("showError", ["IndexedDB Error", String(reason)]);
                reject(reason);
            });
        });
    }
}

ApplicationDB.loaded = ApplicationDB.initialize();
