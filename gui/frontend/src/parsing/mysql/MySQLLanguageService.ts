/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import { IRdbmsDataTypeInfo, ServiceLanguage } from "../parser-common.js";

import { CharsetSymbol, SystemVariableSymbol, SystemFunctionSymbol, DBSymbolTable } from "../DBSymbolTable.js";
import { LanguageWorkerPool } from "../worker/LanguageWorkerPool.js";
import { mysqlInfo } from "../../app-logic/RdbmsInfo.js";
import { DBDataType, ParameterFormatType } from "../../app-logic/general-types.js";
import { convertCamelToTitleCase } from "../../utilities/string-helpers.js";
import { RdbmsLanguageService } from "../worker/RdbmsLanguageService.js";

/** The MySQL specialization of the RDBMS language service class. */
export class MySQLLanguageService extends RdbmsLanguageService {

    public static globalSymbols = new DBSymbolTable("global", {});

    public constructor(pool: LanguageWorkerPool) {
        super(ServiceLanguage.MySQL, pool, MySQLLanguageService.globalSymbols);
    }

    static {
        void import("./data/system-variables.json").then((systemVariables) => {
            for (const [key, value] of Object.entries(systemVariables.default)) {
                MySQLLanguageService.globalSymbols.addNewSymbolOfType(SystemVariableSymbol, undefined, "@@" + key,
                    value);
            }
        });

        void import("./data/system-functions.json").then((systemFunctions) => {
            for (const [key, value] of Object.entries(systemFunctions.default)) {
                MySQLLanguageService.globalSymbols.addNewSymbolOfType(SystemFunctionSymbol, undefined, key, value);
            }
        });

        void import("./data/rdbms-info.json").then((rdbmsInfo) => {
            for (const [key, value] of Object.entries(rdbmsInfo.default.characterSets)) {
                MySQLLanguageService.globalSymbols.addNewSymbolOfType(CharsetSymbol, undefined, key);

                mysqlInfo.characterSets.set(key.toLowerCase(), {
                    collations: value.collations,
                    description: value.description,
                    defaultCollation: value.defaultCollation,
                });
            }

            Object.entries(rdbmsInfo.default.dataTypes).forEach(([key, value]: [string, IRdbmsDataTypeInfo]) => {
                mysqlInfo.dataTypes.set(key.toLowerCase(), {
                    type: DBDataType[convertCamelToTitleCase(key) as keyof typeof DBDataType],

                    characterMaximumLength: value.characterMaximumLength,
                    characterOctetLength: value.characterOctetLength,
                    dateTimePrecision: value.dateTimePrecision,
                    flags: value.flags,
                    numericPrecision: value.numericPrecision,
                    numericPrecisionRadix: value.numericPrecisionRadix,
                    numericScale: value.numericScale,
                    needsQuotes: value.needsQuotes,
                    parameterFormatType: value.parameterFormatType
                        ? (ParameterFormatType as never)[value.parameterFormatType] : undefined,
                    synonyms: value.synonyms,
                });
            });
        });
    }
}
