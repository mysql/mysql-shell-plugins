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

import { ServiceLanguage } from "../parser-common";

import { CharsetSymbol, SystemVariableSymbol, SystemFunctionSymbol, DBSymbolTable } from "../DBSymbolTable";
import { LanguageWorkerPool } from "../worker/LanguageWorkerPool";
import { mysqlInfo } from "../../app-logic/RdbmsInfo";
import { DBDataType, IDictionary, ParameterFormatType } from "../../app-logic/Types";
import { convertCamelToTitleCase } from "../../utilities/string-helpers";
import { RdbmsLanguageService } from "../worker/RdbmsLanguageService";

// The MySQL specialization of the RDBMS language service class.
export class MySQLLanguageService extends RdbmsLanguageService {

    public static globalSymbols = new DBSymbolTable("global", {});

    public constructor(pool: LanguageWorkerPool) {
        super(ServiceLanguage.MySQL, pool, MySQLLanguageService.globalSymbols);
    }

    public static init(): void {
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
            for (const [key, value] of Object.entries(rdbmsInfo.characterSets)) {
                MySQLLanguageService.globalSymbols.addNewSymbolOfType(CharsetSymbol, undefined, key);

                mysqlInfo.characterSets.set(key.toLowerCase(), {
                    collations: value.collations,
                    description: value.description,
                    defaultCollation: value.defaultCollation,
                });
            }

            for (const [key, value] of Object.entries(rdbmsInfo.dataTypes)) {
                const actualValue = value as IDictionary;
                mysqlInfo.dataTypes.set(key.toLowerCase(), {
                    type: DBDataType[convertCamelToTitleCase(key)],

                    characterMaximumLength: actualValue.characterMaximumLength as number,
                    characterOctetLength: actualValue.characterOctetLength as number,
                    dateTimePrecision: actualValue.dateTimePrecision as number,
                    flags: actualValue.flags as string[],
                    numericPrecision: actualValue.numericPrecision as number,
                    numericPrecisionRadix: actualValue.numericPrecisionRadix as number,
                    numericScale: actualValue.numericScale as number,
                    needsQuotes: actualValue.needsQuotes as boolean,
                    parameterFormatType:
                        ParameterFormatType[actualValue.parameterFormatType as keyof typeof ParameterFormatType],
                    synonyms: actualValue.synonyms as string[],
                });
            }
        });
    }
}

MySQLLanguageService.init();
