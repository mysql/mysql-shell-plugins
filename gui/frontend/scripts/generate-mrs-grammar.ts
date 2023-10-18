#!/usr/bin/env -S ts-node --files

/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

/**
 * This script combines the standard MySQL grammar with the MRS grammar.
 */

import { readFileSync, statSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const startMarker = "/* START OF MERGE PART */";
const stopMarker = "/* END OF MERGE PART */";
const keywordInsertionMarker = "/* INSERT OTHER KEYWORDS HERE */";
const operatorInsertionMarker = "/* INSERT OTHER OPERATORS HERE */";

const scriptPath = dirname(fileURLToPath(import.meta.url));

// All paths here are relative to the project root directory (the git repository).

const sourceMySQLLexerFile = "gui/frontend/src/parsing/mysql/MySQLLexer.g4";
const sourceMySQLParserFile = "gui/frontend/src/parsing/mysql/MySQLParser.g4";

const sourceMRSLexerFile = "mrs_plugin/grammar/MRSLexer.g4";
const sourceMRSParserFile = "mrs_plugin/grammar/MRSParser.g4";

const targetLexerFile = "gui/frontend/src/parsing/mysql/MySQLMRSLexer.g4";
const targetParserFile = "gui/frontend/src/parsing/mysql/MySQLMRSParser.g4";

const root = resolve(dirname(scriptPath), "../..");

const mrsKeywords: string[] = [];

const processLexer = () => {
    let mysqlLexerContent = readFileSync(resolve(root, sourceMySQLLexerFile), "utf8");
    const mrsLexerContent = readFileSync(resolve(root, sourceMRSLexerFile), "utf8");

    // Rename lexer class references from the plain MySQL lexer to the combined lexer.
    mysqlLexerContent = mysqlLexerContent.replace(/MySQLLexer/g, "MySQLMRSLexer");

    // Remove a token, which has to be defined after the new MRS keywords in the combined lexer.
    mysqlLexerContent = mysqlLexerContent.replace("AT_TEXT_SUFFIX: '@' SIMPLE_IDENTIFIER;\n", "");

    let insertionMarkerPosition = mysqlLexerContent.indexOf(keywordInsertionMarker);

    // Extract the relevant parts from the MRS lexer.
    const start = mrsLexerContent.indexOf(startMarker);
    const stop = mrsLexerContent.indexOf(stopMarker);
    let mrsKeywordDefinitions = mrsLexerContent.substring(start + startMarker.length, stop);

    // Extract the keyword symbols from the definitions.
    const keywordSymbolPattern = /([A-Z_]+):/;
    const keywordSymbols = mrsKeywordDefinitions.match(new RegExp(keywordSymbolPattern, "g"));
    if (keywordSymbols !== null) {
        for (const keywordSymbol of keywordSymbols) {
            mrsKeywords.push(keywordSymbol.substring(0, keywordSymbol.length - 1));
        }
    }

    mrsKeywordDefinitions += "AT_TEXT_SUFFIX: '@' SIMPLE_IDENTIFIER;";

    // Insert the MRS keywords right after all other keywords.
    mysqlLexerContent = mysqlLexerContent.substring(0, insertionMarkerPosition) + mrsKeywordDefinitions +
        mysqlLexerContent.substring(insertionMarkerPosition + keywordInsertionMarker.length);

    // Remove the square brackets from the INVALID_CHAR token and define own lexer tokens for them.
    mysqlLexerContent = mysqlLexerContent.replace("| '['", "");
    mysqlLexerContent = mysqlLexerContent.replace("| ']'", "");

    // Insert new operators/symbols.
    insertionMarkerPosition = mysqlLexerContent.indexOf(operatorInsertionMarker);
    const newOperators = "OPEN_SQUARE_SYMBOL:  '[';\nCLOSE_SQUARE_SYMBOL: ']'; ";
    mysqlLexerContent = mysqlLexerContent.substring(0, insertionMarkerPosition) + newOperators +
        mysqlLexerContent.substring(insertionMarkerPosition + operatorInsertionMarker.length);

    writeFileSync(resolve(root, targetLexerFile), mysqlLexerContent, "utf8");
};

const processParser = () => {
    let mysqlParserContent = readFileSync(resolve(root, sourceMySQLParserFile), "utf8");
    const mrsParserContent = readFileSync(resolve(root, sourceMRSParserFile), "utf8");

    mysqlParserContent = mysqlParserContent.replace(/MySQLLexer/g, "MySQLMRSLexer");
    mysqlParserContent = mysqlParserContent.replace(/MySQLParser/g, "MySQLMRSParser");

    // Extract the relevant parts from the MRS parser.
    const start = mrsParserContent.indexOf(startMarker) + 1; // Skip over the ending line break.
    const stop = mrsParserContent.indexOf(stopMarker);
    const mrsRules = mrsParserContent.substring(start + startMarker.length, stop);

    // Insert new MRS keywords in the identifier rule.
    const temp = mrsKeywords.findIndex((keyword) => { return keyword === "JSON_NUMBER"; });
    if (temp > -1) {
        mrsKeywords.splice(temp, 1);
    }
    const insertionMarkerPosition = mysqlParserContent.indexOf(keywordInsertionMarker);
    const keywordsAlt = `| (\n        // MRS keywords\n        ${mrsKeywords.join("\n        | ")}\n    )`;
    mysqlParserContent = mysqlParserContent.substring(0, insertionMarkerPosition) + keywordsAlt +
        mysqlParserContent.substring(insertionMarkerPosition + keywordInsertionMarker.length);

    // Finally add a new alternative for the MRS rules after the first EOF token.
    const eofPosition = mysqlParserContent.indexOf("EOF") + 4;
    mysqlParserContent = mysqlParserContent.substring(0, eofPosition) + "    | {this.supportMrs}? mrsScript\n" +
        mysqlParserContent.substring(eofPosition);

    writeFileSync(resolve(root, targetParserFile), mysqlParserContent + "\n" + mrsRules, "utf8");
};

let generate = false;

try {
    const sourceMySQLLexerStat = statSync(resolve(root, sourceMySQLLexerFile));
    const sourceMRSLexerStat = statSync(resolve(root, sourceMRSLexerFile));
    const targetLexerStat = statSync(resolve(root, targetLexerFile));
    if (sourceMySQLLexerStat.mtimeMs > targetLexerStat.mtimeMs
        || sourceMRSLexerStat.mtimeMs > targetLexerStat.mtimeMs) {
        generate = true;
    }

    if (!generate) {
        const sourceMySQLParserStat = statSync(resolve(root, sourceMySQLParserFile));
        const sourceMRSParserStat = statSync(resolve(root, sourceMRSParserFile));
        const targetParserStat = statSync(resolve(root, targetParserFile));
        if (sourceMySQLParserStat.mtimeMs > targetParserStat.mtimeMs
            || sourceMRSParserStat.mtimeMs > targetParserStat.mtimeMs) {
            generate = true;
        }

    }
} catch (e) {
    generate = true;
}

if (generate) {
    console.log("\x1b[1m\x1b[92mMerge source files changed - merging again ...\x1b[0m");

    processLexer();
    processParser();

    console.log("\x1b[1m\x1b[92mMerge done.\x1b[0m\n");
}
