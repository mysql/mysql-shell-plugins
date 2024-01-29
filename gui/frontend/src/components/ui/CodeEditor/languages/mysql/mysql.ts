/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

/* eslint-disable @typescript-eslint/naming-convention */

import { type languages } from "monaco-editor/esm/vs/editor/editor.api.js";
import {
    conf as baseMysqlConfig, language as baseMySQLLanguage,
} from "monaco-editor/esm/vs/basic-languages/mysql/mysql";

export const languageConfiguration: languages.LanguageConfiguration = {
    ...baseMysqlConfig,
};

/**
 * Defines the Monarch tokenizer, which is used until the semantic highlighter kicks in.
 * This is a copy of the Monaco Editor MySQL tokenizer, with a change: brackets/braces are treated as strings.
 * Otherwise they appear colorized on top of the semantic highlighter.
 */
export const language: languages.IMonarchLanguage = {
    ...baseMySQLLanguage,
    defaultToken: "operator",
    tokenPostfix: ".sql",
    ignoreCase: true,
    brackets: [
        { open: "[", close: "]", token: "string" },
        { open: "(", close: ")", token: "string" },
        { open: "{", close: "}", token: "string" },
    ],
    tokenizer: {
        root: [
            { include: "@comments" },
            { include: "@whitespace" },
            { include: "@numbers" },
            { include: "@strings" },
            { include: "@complexIdentifiers" },
            { include: "@scopes" },
            [/[;,.]/, "delimiter"],
            [/[[\](){}]/, "@brackets"],
            [
                /[\w@]+/,
                {
                    cases: {
                        "@operators": "operator",
                        "@builtinVariables": "predefined",
                        "@builtinFunctions": "predefined",
                        "@keywords": "keyword",
                        "@default": "identifier",
                    },
                },
            ],
            [/[<>=!%&+\-*/|~^]/, "operator"],
        ],
        whitespace: [[/\s+/, "white"]],
        comments: [
            [/--+.*/, "comment"],
            [/#+.*/, "comment"],
            [/\/\*/, { token: "comment.quote", next: "@comment" }],
        ],
        comment: [
            [/[^*/]+/, "comment"],
            [/\*\//, { token: "comment.quote", next: "@pop" }],
            [/./, "comment"],
        ],
        numbers: [
            [/0[xX][0-9a-fA-F]*/, "number"],
            [/[$][+-]*\d*(\.\d*)?/, "number"],
            [/((\d+(\.\d*)?)|(\.\d+))([eE][-+]?\d+)?/, "number"],
        ],
        strings: [
            [/'/, { token: "string", next: "@string" }],
            [/"/, { token: "string.double", next: "@stringDouble" }],
        ],
        string: [
            [/\\'/, "string"],
            [/[^']+/, "string"],
            [/''/, "string"],
            [/'/, { token: "string", next: "@pop" }],
        ],
        stringDouble: [
            [/[^"]+/, "string.double"],
            [/""/, "string.double"],
            [/"/, { token: "string.double", next: "@pop" }],
        ],
        complexIdentifiers: [[/`/, { token: "identifier.quote", next: "@quotedIdentifier" }]],
        quotedIdentifier: [
            [/[^`]+/, "identifier"],
            [/``/, "identifier"],
            [/`/, { token: "identifier.quote", next: "@pop" }],
        ],
        scopes: [],
    },
};
