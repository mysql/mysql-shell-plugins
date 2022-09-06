/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

/* spell-checker: disable */

import { languages } from "monaco-editor/esm/vs/editor/editor.api";

import { language as js } from "monaco-editor/esm/vs/basic-languages/javascript/javascript";
import { conf as tsConfig, language as ts } from "monaco-editor/esm/vs/basic-languages/typescript/typescript";
import { language as mysql } from "monaco-editor/esm/vs/basic-languages/mysql/mysql";
import { language as py } from "monaco-editor/esm/vs/basic-languages/python/python";

type IRichLanguageConfiguration = languages.LanguageConfiguration;
type ILanguage = languages.IMonarchLanguage;

export const languageConfiguration: IRichLanguageConfiguration = {
    ...tsConfig,
};

export const language: ILanguage = {
    defaultToken: "invalid",
    ignoreCase: false,

    typeKeywords: [], // We have no TS types.
    keywords: ts.keywords,

    operators: ts.operators,
    symbols: ts.symbols,
    escapes: ts.escapes,
    digits: ts.digits,
    octaldigits: ts.octaldigits,
    binarydigits: ts.binarydigits,
    hexdigits: ts.hexdigits,
    regexpctl: ts.regexpctl,
    regexpesc: ts.regexpesc,

    // Since we use also JS as sub language and we can only specify case sensitivity on a global level, we make
    // SQL case-insensitive by duplicating some symbols with lower case style.
    mysqlBrackets: mysql.brackets,
    mysqlKeywords: [
        // Will be set in the Monaco highlighter set up following the creation of this structure.
    ],
    mysqlOperators: [
        ...mysql.operators,
        ...(mysql.operators as string[]).map((operator: string) => { return operator.toLowerCase(); }),
    ],
    mysqlBuiltinFunctions: [
        ...mysql.builtinFunctions,
        ...(mysql.builtinFunctions as string[]).map((name: string) => { return name.toLowerCase(); }),
    ],

    pythonBrackets: py.brackets,
    pythonKeywords: py.keywords,

    // By default we start with SQL as initial language. Can be changed dynamically, but applies always to all
    // code editors, even if they already existed when this is changed.
    start: "sql",

    // This tokenizer combines the existing tokenizers for JS/TS, Python and MySQL into one,
    // where certain special tokens denote the range for each.
    tokenizer: {
        js: [
            [/\\(sql)/, { token: "keyword.other", switchTo: "@sql" }],
            [/\\(ts|typescript)/, { token: "keyword.other", switchTo: "@ts" }],
            [/\\(py|python)/, { token: "keyword.other", switchTo: "@py" }],
            [/\\\w+/, "markup.other"],
            ...js.tokenizer.root,
        ],

        ts: [
            [/\\(sql)/, { token: "keyword.other", switchTo: "@sql" }],
            [/\\(js|javascript)/, { token: "keyword.other", switchTo: "@js" }],
            [/\\(py|python)/, { token: "keyword.other", switchTo: "@py" }],
            [/\\\w+/, "markup.other"],
            ...ts.tokenizer.root,
        ],

        sql: [ // This part has been copied from the MySQL tokenizer, as we need to use different keys.
            [/\\(js|javascript)/, { token: "keyword.other", switchTo: "@js" }],
            [/\\(ts|typescript)/, { token: "keyword.other", switchTo: "@ts" }],
            [/\\(py|python)/, { token: "keyword.other", switchTo: "@py" }],
            [/\\[a-zA-Z0-9?]+/, "markup.other"],
            [/\(/, { token: "support.function.sql", next: "@functionSql" }],

            { include: "@sqlCore" },
        ],

        py: [
            [/\\(sql)/, { token: "keyword.other", switchTo: "@sql" }],
            [/\\(ts|typescript)/, { token: "keyword.other", switchTo: "@ts" }],
            [/\\(js|javascript)/, { token: "keyword.other", switchTo: "@js" }],
            [/\\\w+/, "markup.other"],

            { include: "@pythonCore" },
        ],

        /* eslint-disable @typescript-eslint/naming-convention */
        sqlCore: [
            { include: "@commentsSql" },
            { include: "@whitespaceSql" },
            { include: "@variablesSql" },
            { include: "@numbersSql" },
            { include: "@stringsSql" },
            { include: "@scopesSql" },
            [/[;,.]/, "delimiter"],
            [/[()]/, "@mysqlBrackets"],
            [/[\w]+/, {
                cases: {
                    "@mysqlKeywords": "keyword.sql",
                    "@mysqlOperators": "operator.sql",
                    "@mysqlBuiltinFunctions": "entity.name.function.sql",
                    "@default": "identifier.sql",
                },
            }],
            [/[<>=!%&+\-*/|~^]/, "operator.sql"],
        ],

        pythonCore: [
            { include: "@whitespacePy" },
            { include: "@numbersPy" },
            { include: "@stringsPy" },
            [/[,:;]/, "delimiter"],
            [/[{}[\]()]/, "@pythonBrackets"],
            [/@[a-zA-Z_]\w*/, "tag"],
            [
                /[a-zA-Z_]\w*/,
                {
                    cases: {
                        "@pythonKeywords": "keyword.python",
                        "@default": "identifier.python",
                    },
                },
            ],
        ],
        /* eslint-enable @typescript-eslint/naming-convention */

        // MySQL imported rules.
        whitespaceSql: mysql.tokenizer.whitespace,
        commentSql: mysql.tokenizer.comment,
        commentsSql: mysql.tokenizer.comments,
        numbersSql: mysql.tokenizer.numbers,

        stringsSql: [
            [/'/, { token: "string.quoted.single.sql", next: "@stringSingleSql" }],
            [/"/, { token: "string.quoted.double.sql", next: "@stringDoubleSql" }],
            [/`/, { token: "string.quoted.other.sql", next: "@stringBacktickSql" }],
        ],
        stringSingleSql: [
            [/[^']+/, "string.quoted.single.sql"],
            [/(''|\\')/, "string.quoted.single.sql"],
            [/'/, { token: "string.quoted.single.sql", next: "@pop" }],
        ],
        stringDoubleSql: [
            [/[^"]+/, "string.quoted.double.sql"],
            [/(''|\\")/, "string.quoted.double.sql"],
            [/"/, { token: "string.quoted.double.sql", next: "@pop" }],
        ],
        stringBacktickSql: [
            [/[^`]+/, "string.quoted.other.sql"],
            [/``/, "string.quoted.other.sql"],
            [/`/, { token: "string.quoted.other.sql", next: "@pop" }],
        ],

        scopesSql: mysql.tokenizer.scopes,

        variablesSql: [
            // A leading @ is special (matches a reference field, when used with id chars, hence the extra pars).
            [/@[\w._$]+/, "support.variable.user.sql"],
            [/@(@)[\w._$]+/, "support.variable.system.sql"],
            [/@(@)?'/, { token: "support.variable.sql", next: "@variablesSingleSql" }],
            [/@(@)?"/, { token: "support.variable.sql", next: "@variablesDoubleSql" }],
            [/@(@)?`/, { token: "support.variable.sql", next: "variablesBacktickSql" }],
        ],

        variablesSingleSql: [
            [/[^']+/, "support.variable.sql"],
            [/'/, "support.variable.sql", "@pop"],
        ],

        variablesDoubleSql: [
            [/[^"]+/, "support.variable.sql"],
            [/"/, "support.variable.sql", "@pop"],
        ],

        variablesBacktickSql: [
            [/[^`]+/, "support.variable.sql"],
            [/`/, "support.variable.sql", "@pop"],
        ],

        functionSql: [
            [/\)/, "support.function.sql", "@pop"],
            { include: "@sql" },
        ],

        // JS/TS imported rules.
        common: ts.tokenizer.common,
        whitespace: ts.tokenizer.whitespace,
        comment: ts.tokenizer.comment,
        jsdoc: ts.tokenizer.jsdoc,
        regexp: ts.tokenizer.regexp,
        regexrange: ts.tokenizer.regexrange,
        /* eslint-disable @typescript-eslint/naming-convention */ // For latest ESlint.
        string_double: ts.tokenizer.string_double,
        string_single: ts.tokenizer.string_single,
        string_backtick: ts.tokenizer.string_backtick,
        /* eslint-enable @typescript-eslint/naming-convention */
        bracketCounting: ts.tokenizer.bracketCounting,

        // Python imported rules.
        whitespacePy: [
            [/\s+/, "white"],
            [/(^#.*$)/, "comment"],
            [/'''/, "string", "@endDocString"],
            [/"""/, "string", "@endDblDocString"],
        ],
        endDocString: py.tokenizer.endDocString,
        endDblDocString: py.tokenizer.endDblDocString,
        numbersPy: py.tokenizer.numbers,
        stringsPy: py.tokenizer.strings,
        stringBody: py.tokenizer.stringBody,
        dblStringBody: py.tokenizer.dblStringBody,
    },

} as ILanguage;
