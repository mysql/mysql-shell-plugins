/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { TestInfo } from "@playwright/test";

import type { ITestConnection } from "./ElectronWorkbench.js";

const helperDir = __dirname;
const testConfigPath = resolve(helperDir, "../.env.test.json");
const testConfigTemplatePath = resolve(helperDir, "../.env.test.json.in");

const readTestConfig = (): Record<string, unknown> => {
    const configPath = existsSync(testConfigPath) ? testConfigPath : testConfigTemplatePath;
    if (!existsSync(configPath)) {
        return {};
    }

    return JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
};

const testConfig = readTestConfig();

const readConfigValue = (name: string, fallback = ""): string => {
    return process.env[`ELECTRON_E2E_${name}`]
        ?? process.env[name]
        ?? String(testConfig[name] ?? fallback);
};

export const localMySQLConnection = (caption: string): ITestConnection => {
    return {
        caption,
        host: readConfigValue("MYSQL_HOST", "localhost"),
        port: readConfigValue("MYSQL_PORT", "2208"),
        user: readConfigValue("DBUSERNAME1", "dbuser1"),
        password: readConfigValue("DBUSERNAME1PWD", "dummy"),
        schema: readConfigValue("MYSQL_SCHEMA", "sakila"),
    };
};

export const mysqlshUserConfigHome = (): string => {
    return readConfigValue("MYSQLSH_USER_CONFIG_HOME");
};

export const mysqlSandboxDir = (): string => {
    return readConfigValue("SANDBOX_DIR");
};

export const mysqlServerVersion = (): string => {
    return readConfigValue("MYSQL_VERSION");
};

const sanitizeIdentifierPart = (value: string): string => {
    return value.toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
};

const hashString = (value: string): string => {
    let hash = 0x811c9dc5;

    for (let i = 0; i < value.length; ++i) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }

    return (hash >>> 0).toString(36);
};

export const uniqueSchemaName = (testInfo: TestInfo, prefix = "electron_e2e"): string => {
    const source = `${testInfo.file}:${testInfo.title}:${testInfo.repeatEachIndex}`;
    const stem = sanitizeIdentifierPart(testInfo.title).slice(0, 32);
    const baseName = `${prefix}_${hashString(source)}_${stem}`;

    return baseName.slice(0, 64).replace(/_+$/g, "");
};

export const quoteIdentifier = (identifier: string): string => {
    return `\`${identifier.replace(/`/g, "``")}\``;
};
