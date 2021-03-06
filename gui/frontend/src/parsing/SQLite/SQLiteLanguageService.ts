/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { ServiceLanguage } from "../parser-common";

import { CharsetSymbol, DBSymbolTable, SystemFunctionSymbol } from "../DBSymbolTable";
import { RdbmsLanguageService } from "../worker/RdbmsLanguageService";
import { LanguageWorkerPool } from "../worker/LanguageWorkerPool";
import { sqliteInfo } from "../../app-logic/RdbmsInfo";
import { DBDataType, ParameterFormatType } from "../../app-logic/Types";
import { convertCamelToTitleCase } from "../../utilities/helpers";

// The SQLite specialization of the RDBMS worker class.
export class SQLiteLanguageService extends RdbmsLanguageService {

    public static globalSymbols = new DBSymbolTable("global", {});

    public constructor(pool: LanguageWorkerPool) {
        super(ServiceLanguage.Sqlite, pool, SQLiteLanguageService.globalSymbols);
    }

    public static init(): void {
        void import("./data/builtin-functions.json").then((systemFunctions) => {
            Object.keys(systemFunctions.default).forEach((name: string) => {
                SQLiteLanguageService.globalSymbols
                    .addNewSymbolOfType(SystemFunctionSymbol, undefined, name, systemFunctions[name]);
            });
        });

        void import("./data/rdbms-info.json").then((rdbmsInfo) => {
            Object.keys(rdbmsInfo.characterSets).forEach((set: string) => {
                SQLiteLanguageService.globalSymbols.addNewSymbolOfType(CharsetSymbol, undefined, set);

                const value = rdbmsInfo.characterSets[set];
                sqliteInfo.characterSets.set(set.toLowerCase(), {
                    collations: value.collations,
                    description: value.description,
                    defaultCollation: value.defaultCollation,
                });
            });

            Object.keys(rdbmsInfo.dataTypes).forEach((type: string) => {
                const value = rdbmsInfo.dataTypes[type];
                sqliteInfo.dataTypes.set(type.toLowerCase(), {
                    type: DBDataType[convertCamelToTitleCase(type)],

                    characterMaximumLength: value.characterMaximumLength,
                    characterOctetLength: value.characterOctetLength,
                    dateTimePrecision: value.dateTimePrecision,
                    flags: value.flags,
                    numericPrecision: value.numericPrecision,
                    numericPrecisionRadix: value.numericPrecisionRadix,
                    numericScale: value.numericScale,
                    needsQuotes: value.needsQuotes,
                    parameterFormatType:
                        ParameterFormatType[value.parameterFormatType as keyof typeof ParameterFormatType],
                    synonyms: value.synonyms,
                });
            });
        });
    }
}

SQLiteLanguageService.init();
