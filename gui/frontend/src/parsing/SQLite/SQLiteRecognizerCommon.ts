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
 * documentation. The authors of SQLite hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

/* eslint-disable no-underscore-dangle */

import { CommonTokenStream, Token } from "antlr4ng";

import { QueryType, Scanner } from "../parser-common";
import { SQLiteLexer } from "./generated/SQLiteLexer";

const keywordsMap = new Map<SQLiteVersion, Set<string>>();
const reservedKeywordsMap = new Map<SQLiteVersion, Set<string>>();

export enum SQLiteVersion {
    Unknown = "Unknown",
    Standard = "Standard",
}

/**
 * Determines if a given string represents a reserved keyword.
 *
 * @param identifier The string to check.
 * @param version The SQLite version for which to check.
 *
 * @returns A flag which indicates if the identifier is a reserved SQLite keyword.
 */
export const isReservedKeyword = (identifier: string, version: SQLiteVersion): boolean => {
    const reserved = reservedKeywordsMap.get(version);

    return reserved?.has(identifier) ?? false;
};

/**
 * Determines if a given string represents a keyword.
 *
 * @param identifier The string to check.
 * @param version The SQLite version for which to check.
 *
 * @returns A flag which indicates if the identifier is a SQLite keyword.
 */
export const isKeyword = (identifier: string, version: SQLiteVersion): boolean => {
    const map = keywordsMap.get(version);

    return map?.has(identifier) ?? false;
};

/**
 * Determines the type of SQL the given SQL is, with the minimum necessary effort.
 *
 * @param tokenStream A stream to read tokens from.
 *
 * @returns The determined query type.
 */
export const determineQueryType = (tokenStream: CommonTokenStream): QueryType => {
    const scanner = new Scanner(tokenStream);

    if (!scanner.next() || scanner.is(Token.EOF)) {
        return QueryType.Unknown;
    }

    // Statements with a preceding WITH clause will not be correctly identified, because skipping a WITH clause,
    // which can contain multiple full SELECT statements) requires full parsing and is thus out of scope here.
    switch (scanner.tokenType) {
        case SQLiteLexer.ALTER_: {
            if (!scanner.next() || scanner.tokenType === Token.EOF) {
                return QueryType.Ambiguous;
            }

            switch (scanner.tokenType as number) {
                case SQLiteLexer.DATABASE_: {
                    return QueryType.AlterDatabase;
                }

                case SQLiteLexer.TABLE_: {
                    return QueryType.AlterTable;
                }

                case SQLiteLexer.VIEW_: {
                    return QueryType.AlterView;
                }

                default: {
                    return QueryType.Unknown;
                }
            }
        }

        case SQLiteLexer.ANALYZE_: {
            return QueryType.AnalyzeTable;
        }

        case SQLiteLexer.ATTACH_: {
            return QueryType.Attach;
        }

        case SQLiteLexer.BEGIN_: { // Begin directly at the start of the query must be a transaction start.
            return QueryType.BeginWork;
        }

        case SQLiteLexer.COMMIT_: {
            return QueryType.Commit;
        }

        case SQLiteLexer.CREATE_: {
            if (!scanner.next() || scanner.tokenType === Token.EOF) {
                return QueryType.Ambiguous;
            }

            if (scanner.is(SQLiteLexer.TEMP_) || scanner.is(SQLiteLexer.TEMP_)) {
                scanner.next();
            }

            switch (scanner.tokenType as number) {
                case SQLiteLexer.TABLE_: {
                    return QueryType.CreateTable;
                }

                case SQLiteLexer.VIRTUAL_: {
                    return QueryType.CreateVirtualTable;
                }

                case SQLiteLexer.INDEX_:
                case SQLiteLexer.UNIQUE_: {
                    return QueryType.CreateIndex;
                }

                case SQLiteLexer.TRIGGER_: {
                    return QueryType.CreateTrigger;
                }

                case SQLiteLexer.VIEW_: {
                    return QueryType.CreateView;
                }

                default: {
                    return QueryType.Unknown;
                }
            }
        }

        case SQLiteLexer.DELETE_: {
            // Will not be identified when preceded by a WITH clause.
            return QueryType.Delete;
        }

        case SQLiteLexer.DETACH_: {
            return QueryType.Detach;
        }

        case SQLiteLexer.DROP_: {
            if (!scanner.next() || scanner.tokenType === Token.EOF) {
                return QueryType.Ambiguous;
            }

            switch (scanner.tokenType as number) {
                case SQLiteLexer.INDEX_: {
                    return QueryType.DropIndex;
                }
                case SQLiteLexer.TABLE_: {
                    return QueryType.DropTable;
                }
                case SQLiteLexer.TRIGGER_: {
                    return QueryType.DropTrigger;
                }
                case SQLiteLexer.VIEW_: {
                    return QueryType.DropView;
                }

                default: {
                    return QueryType.Unknown;
                }
            }
        }

        case SQLiteLexer.INSERT_: {
            // Will not be identified when preceded by a WITH clause.
            return QueryType.Insert;
        }

        case SQLiteLexer.PRAGMA_: {
            return QueryType.Pragma;
        }

        case SQLiteLexer.REINDEX_: {
            return QueryType.ReIndex;
        }

        case SQLiteLexer.RELEASE_: {
            return QueryType.ReleaseSavePoint;
        }

        case SQLiteLexer.REPLACE_: {
            return QueryType.Replace;
        }

        case SQLiteLexer.ROLLBACK_: {
            // We assume a transaction statement here unless we exactly know it's about a savepoint.
            if (!scanner.next() || scanner.tokenType === Token.EOF) {
                return QueryType.RollbackWork;
            }

            if (scanner.is(SQLiteLexer.TRANSACTION_)) {
                if (!scanner.next() || scanner.tokenType === Token.EOF) {
                    return QueryType.RollbackWork;
                }
            }

            if (scanner.is(SQLiteLexer.TO_)) {
                return QueryType.RollbackSavePoint;
            }

            return QueryType.RollbackWork;
        }

        case SQLiteLexer.SAVEPOINT_: {
            return QueryType.SavePoint;
        }

        case SQLiteLexer.SELECT_: {
            // Will not be identified when preceded by a WITH clause.
            return QueryType.Select;
        }


        case SQLiteLexer.UPDATE_: {
            // Will not be identified when preceded by a WITH clause.
            return QueryType.Update;
        }

        case SQLiteLexer.VACUUM_: {
            return QueryType.Vacuum;
        }

        default: {
            return QueryType.Unknown;
        }
    }
};

void import("./data/keywords.json").then((keywords) => {
    Object.entries(keywords.default).forEach(([versionKey, value]) => {
        const currentVersion = SQLiteVersion[versionKey as keyof typeof SQLiteVersion];
        const set = new Set<string>();
        const set2 = new Set<string>();

        value.forEach((entry) => {
            if (entry.word.length > 0) {
                set.add(entry.word);
                if (entry.reserved) {
                    set2.add(entry.word);
                }
            }
        });

        keywordsMap.set(currentVersion, set);
        reservedKeywordsMap.set(currentVersion, set2);
    });
});
