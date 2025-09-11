/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation. The authors of MySQL hereby grant you an additional
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

export enum MySQLVersion {
    Unknown = "Unknown",
    MySQL80 = "MySQL80",
    MySQL84 = "MySQL84",
    MySQL93 = "MySQL93",
    MySQL94 = "MySQL94",
    MySQL95 = "MySQL95",
}

// Keywords added from the MRS lexer implementation. They are not official MySQL keywords.
const mrsKeywords = [
    "CONFIGURE",
    "REST",
    "METADATA",
    "SERVICES",
    "SERVICE",
    "VIEWS",
    "PROCEDURES",
    "FUNCTIONS",
    "RESULT",
    "ENABLED",
    "PUBLISHED",
    "DISABLED",
    "PRIVATE",
    "UNPUBLISHED",
    "PROTOCOL",
    "HTTP",
    "HTTPS",
    "REQUEST",
    "REDIRECTION",
    "MANAGEMENT",
    "AVAILABLE",
    "REQUIRED",
    "ITEMS",
    "PER",
    "CONTENT",
    "MEDIA",
    "AUTODETECT",
    "FEED",
    "ITEM",
    "SETS",
    "AUTH",
    "APPS",
    "APP",
    "ID",
    "SECRET",
    "VENDOR",
    "MRS",
    "MYSQL",
    "USERS",
    "ALLOW",
    "REGISTER",
    "CLASS",
    "DEVELOPMENT",
    "SCRIPTS",
    "MAPPING",
    "TYPESCRIPT",
    "ROLES",
    "EXTENDS",
    "OBJECT",
    "HIERARCHY",
    "INCLUDE",
    "INCLUDING",
    "ENDPOINTS",
    "OBJECTS",
    "DUMP_SYMBOL",
    "ZIP_SYMBOL",
    "SCRIPT_SYMBOL",
    "STATIC",
    "PROJECT_SYMBOL",
    "VERSION_SYMBOL",
    "ICON",
    "PUBLISHER_SYMBOL",
    "@INOUT",
    "@IN",
    "@OUT",
    "@CHECK",
    "@NOCHECK",
    "@NOUPDATE",
    "@SORTABLE",
    "@NOFILTERING",
    "@ROWOWNERSHIP",
    "@UNNEST",
    "@DATATYPE",
    "@SELECT",
    "@NOSELECT",
    "@INSERT",
    "@NOINSERT",
    "@UPDATE",
    "@DELETE",
    "@NODELETE",
    "@KEY",
    "REST_REQUEST_PATH",
];
export const mysqlKeywords = new Map<MySQLVersion, Set<string>>();
export const reservedMySQLKeywords = new Map<MySQLVersion, Set<string>>();

// The keywords.json file has been generated from the official
// MySQL documentation at https://dev.mysql.com/doc/mysqld-version-reference/en/keywords.html).

interface IKeywordInfo {
    "Name": string,       // The keyword itself.
    "Introduced": string, // Only set if the keyword was introduced in a specific version.
    "Removed": string,    // Only set if the keyword was removed in a specific version.
    "5.7": string,        // Contains "Yes" if the keyword is present in this version. Empty otherwise.
    "8.0": string,        // ditto
    "8.4": string,        // ditto
    "9.3": string,        // ditto
    "9.4": string,        // ditto
    "9.5": string,        // ditto
    "FIELD10": string;    // Marks all keywords that are in currently in use.
}

type ValidVersions = "5.7" | "8.0" | "8.4" | "9.3" | "9.4" | "9.5";

/**
 * Extracts the keywords for the given version from the provided info array and adds them to the
 * mysqlKeywords and reservedMySQLKeywords maps.
 *
 * @param version The version key for the maps.
 * @param versionString The version string in the JSON data.
 * @param info The full array of keyword info objects.
 */
const addKeywordsForVersion = (version: MySQLVersion, versionString: ValidVersions, info: IKeywordInfo[]): void => {
    const keywords = info.filter((entry) => {
        return entry[versionString].length > 0;
    }).map((entry) => {
        return entry.Name;
    });
    mysqlKeywords.set(version, new Set<string>(keywords));

    const reservedKeywords = info.filter((entry) => {
        return entry[versionString].endsWith("(R)");
    }).map((entry) => {
        return entry.Name;
    });
    reservedMySQLKeywords.set(version, new Set<string>(reservedKeywords));
};

console.log("Loading MySQL keywords...");
void import("./data/keywords.json").then((keywords) => {
    const content: IKeywordInfo[] = keywords.default;

    addKeywordsForVersion(MySQLVersion.MySQL80, "8.0", content);
    addKeywordsForVersion(MySQLVersion.MySQL84, "8.4", content);
    addKeywordsForVersion(MySQLVersion.MySQL93, "9.3", content);
    addKeywordsForVersion(MySQLVersion.MySQL94, "9.4", content);
    addKeywordsForVersion(MySQLVersion.MySQL95, "9.5", content);

    // Add MRS keywords to all versions starting with 9.3. They are not reserved keywords.
    let set = mysqlKeywords.get(MySQLVersion.MySQL93)!;
    for (const keyword of mrsKeywords) {
        set.add(keyword);
    }

    set = mysqlKeywords.get(MySQLVersion.MySQL94)!;
    for (const keyword of mrsKeywords) {
        set.add(keyword);
    }

    set = mysqlKeywords.get(MySQLVersion.MySQL95)!;
    for (const keyword of mrsKeywords) {
        set.add(keyword);
    }
});
