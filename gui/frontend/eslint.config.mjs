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

import eslint from "@eslint/js";
import tslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import jsdoc from "eslint-plugin-jsdoc";
import preferArrow from "eslint-plugin-prefer-arrow";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default tslint.config(
    eslint.configs.recommended,
    ...tslint.configs.strictTypeChecked,
    ...tslint.configs.stylisticTypeChecked,
    jsdoc.configs["flat/recommended"],
    {
        ignores: ["**/generated/*", "src/oci-typings", "**/.antlr", "src/modules/mrs/sdk"],
    },
    {
        plugins: {
            "@stylistic": stylistic,
            jsdoc,
            "prefer-arrow": preferArrow,
            "import": importPlugin,
        },
        languageOptions: {
            ecmaVersion: "latest",
            parser: tslint.parser,
            parserOptions: {
                projectService: {
                    allowDefaultProject: [
                        "eslint.config.mjs",
                        "vite.config.ts",
                        "vitest.config.ts",
                        "unit-tests.jest.config.ts",
                        "src/tests/globalSetup.ts",
                        "src/tests/globalTearDown.ts",
                    ],
                    defaultProject: "tsconfig.eslint.json",
                },
                tsconfigRootDir: import.meta.dirname,
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.node,
            },
        },
        rules: {
            // Some base rules must be disabled as they return wrong results.
            // There are specialized rules instead in the typescript eslint rule section.
            "no-explicit-any": "off",
            "no-use-before-define": "off",
            "no-shadow": "off",
            "lines-between-class-members": "off",
            "camelcase": "off",
            "no-fallthrough": [
                "warn",
                {
                    commentPattern: "\\[falls?-through\\]",
                    allowEmptyCase: true,
                },
            ],
            "no-func-assign": [
                "warn",
            ],
            "no-implied-eval": [
                "warn",
            ],
            "no-invalid-regexp": [
                "warn",
            ],
            "no-iterator": [
                "warn",
            ],
            "no-label-var": [
                "warn",
            ],
            "no-labels": [
                "warn",
                {
                    allowLoop: true,
                    allowSwitch: false,
                },
            ],
            "no-lone-blocks": [
                "warn",
            ],
            "no-loop-func": [
                "warn",
            ],
            "no-multi-str": [
                "warn",
            ],
            "no-global-assign": [
                "warn",
            ],
            "no-unsafe-negation": [
                "warn",
            ],
            "no-new-func": [
                "warn",
            ],
            "no-new-object": [
                "warn",
            ],
            "no-new-symbol": [
                "warn",
            ],
            "no-new-wrappers": "error",
            "no-obj-calls": [
                "warn",
            ],
            "no-octal": [
                "warn",
            ],
            "no-octal-escape": [
                "warn",
            ],
            "no-redeclare": [
                "warn",
                {
                    builtinGlobals: false,
                },
            ],
            "no-regex-spaces": [
                "warn",
            ],
            "no-useless-computed-key": [
                "warn",
            ],
            "no-useless-concat": [
                "warn",
            ],
            "no-useless-constructor": [
                "off",
            ],
            "no-useless-escape": [
                "warn",
            ],
            "no-useless-rename": [
                "warn",
                {
                    ignoreDestructuring: false,
                    ignoreImport: false,
                    ignoreExport: false,
                },
            ],
            "no-constant-condition": "off",
            "max-len": [
                "error",
                {
                    ignoreRegExpLiterals: false,
                    ignoreStrings: false,
                    code: 120,
                },
            ],
            "brace-style": ["error", "1tbs", { allowSingleLine: false }],
            "curly": ["error", "all"],
            "arrow-body-style": ["error", "always"],
            "prefer-arrow/prefer-arrow-functions": [
                "warn",
                {
                    disallowPrototype: true,
                    singleReturnOnly: false,
                    classPropertiesAllowed: false,
                },
            ],
            "keyword-spacing": ["error", { after: true }],
            "no-restricted-syntax": [
                "error",
                {
                    selector: "Identifier[name='process']",
                    message: "Use of 'process' is forbidden."
                }
            ],
            "@stylistic/no-mixed-operators": [
                "warn",
                {
                    groups: [
                        ["+", "-", "*", "/", "%", "**"],
                        ["&", "|", "^", "~", "<<", ">>", ">>>"],
                        ["==", "!=", "===", "!==", ">", ">=", "<", "<="],
                        ["&&", "||"],
                        ["in", "instanceof"],
                    ],
                    allowSamePrecedence: true,
                },
            ],
            "@stylistic/padding-line-between-statements": [
                "error",
                {
                    blankLine: "always",
                    prev: "*",
                    next: "return",
                },
            ],
            "@stylistic/quotes": [
                "error",
                "double",
                {
                    avoidEscape: true,
                    allowTemplateLiterals: "always",
                },
            ],
            "@stylistic/indent": [
                "error",
                4,
                {
                    ignoreComments: true,
                    SwitchCase: 1,
                    MemberExpression: 1,
                    CallExpression: { arguments: 1 },
                },
            ],
            "@stylistic/semi": [
                "error",
                "always",
            ],
            "@stylistic/no-multiple-empty-lines": ["error", { max: 1 }],
            "@stylistic/no-multi-spaces": [
                "error",
                {
                    ignoreEOLComments: true,
                },
            ],
            "@stylistic/lines-around-comment": [
                "error",
                {
                    afterBlockComment: false,
                    afterLineComment: false,
                    beforeBlockComment: false,
                },
            ],
            "@stylistic/prefer-regexp-exec": "off",
            "@stylistic/lines-between-class-members": [
                "error",
                {
                    enforce: [
                        { blankLine: "always", prev: "method", next: "method" },
                    ],
                },
            ],

            "@typescript-eslint/naming-convention": [
                "error",
                {
                    selector: "default",
                    format: [
                        "camelCase",
                    ],
                    filter: {
                        regex: "^_",
                        match: false,
                    },
                },
                {
                    selector: "class",
                    format: [
                        "PascalCase",
                    ],
                },
                {
                    selector: "typeParameter",
                    format: [
                        "PascalCase",
                    ],
                },
                {
                    selector: "enum",
                    format: [
                        "PascalCase",
                    ],
                },
                {
                    selector: "enumMember",
                    format: [
                        "PascalCase",
                    ],
                },
                {
                    selector: "typeAlias",
                    format: [
                        "PascalCase",
                    ],
                },
                {
                    selector: "interface",
                    format: [
                        "PascalCase",
                    ],
                },
                {
                    selector: "import",
                    format: [
                        "PascalCase",
                        "camelCase",
                    ],
                },
                {
                    selector: "property",
                    format: [
                        "camelCase",
                        "UPPER_CASE",
                    ],
                },
                {
                    selector: "property",
                    format: null,
                    filter: {
                        regex: "^['\"].*['\"]$",
                        match: false,
                    },
                },
            ],
            "@typescript-eslint/adjacent-overload-signatures": "error",
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-namespace": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-unnecessary-type-parameters": "off",
            "@typescript-eslint/interface-name-prefix": "off",
            "@typescript-eslint/member-delimiter-style": "off",
            "@typescript-eslint/member-ordering": [
                "error",
                {
                    // No ordering for getters and setters here, as that conflicts currently with the rule
                    // adjacent-overload-signatures.

                    default: [
                        // Index signature

                        "signature",
                        // Fields

                        "public-static-field",
                        "protected-static-field",
                        "private-static-field",
                        "public-instance-field",
                        "protected-instance-field",
                        "private-instance-field",
                        "public-abstract-field",
                        "protected-abstract-field",
                        "public-field",
                        "protected-field",
                        "private-field",
                        "static-field",
                        "instance-field",
                        "abstract-field",
                        "decorated-field",
                        "field",
                        // Constructors

                        "public-constructor",
                        "protected-constructor",
                        "private-constructor",
                        "constructor",
                        // Methods

                        "public-static-method",
                        "protected-static-method",
                        "private-static-method",
                        "public-method",
                        "protected-method",
                        "private-method",
                        "public-abstract-method",
                        "protected-abstract-method",
                    ],
                },
            ],
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    args: "none",
                    ignoreRestSiblings: true,
                    varsIgnorePattern: "^_",
                    argsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/restrict-plus-operands": "error",
            "@typescript-eslint/no-unnecessary-condition": ["error", { allowConstantLoopConditions: true }],
            "@typescript-eslint/no-extraneous-class": "off",
            "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
            "@typescript-eslint/prefer-return-this-type": "off",
            "@typescript-eslint/no-invalid-void-type": "off",
            "@typescript-eslint/unified-signatures": "off",
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/explicit-member-accessibility": "error",
            "@typescript-eslint/prefer-for-of": "error",
            "@typescript-eslint/prefer-function-type": "error",
            "@typescript-eslint/no-deprecated": "off",
            "@typescript-eslint/no-base-to-string": "off",
            "@typescript-eslint/prefer-regexp-exec": "off",
            "@typescript-eslint/class-literal-property-style": "off",
            "@typescript-eslint/no-misused-spread": "off",
            "@typescript-eslint/no-dynamic-delete": "off",

            "jsdoc/check-alignment": "error",
            "jsdoc/check-indentation": "off",
            "jsdoc/require-param-type": "off",
            "jsdoc/require-returns-type": "off",
            "jsdoc/no-undefined-types": [
                "off", // Requires a comment syntax incompatible with VS Code.
                {
                    markVariablesAsUsed: false,
                },
            ],
            "jsdoc/tag-lines": [
                "error",
                "any",
                {
                    startLines: 1,
                },
            ],
        },
    },
);
