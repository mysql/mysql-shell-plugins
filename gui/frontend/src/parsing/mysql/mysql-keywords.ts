/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import { IDictionary } from "../../app-logic/general-types.js";

export enum MySQLVersion {
    Unknown = "Unknown",
    MySQL80 = "MySQL80",
    MySQL81 = "MySQL81",
    MySQL82 = "MySQL82",
    MySQL83 = "MySQL83",
    MySQL84 = "MySQL84",
}

export const mysqlKeywords = new Map<MySQLVersion, Set<string>>();
export const reservedMySQLKeywords = new Map<MySQLVersion, Set<string>>();

// TODO: change implementation to use keyword diffs instead of full lists.
// TODO: separate non-standard keywords (MHS, MRS, etc.) from standard keywords. They might also be version-specific.
void import("./data/keywords.json").then((keywords) => {
    const content: IDictionary = keywords.default ?? keywords;
    Object.keys(content).forEach((versionKey: string) => {
        const currentVersion = MySQLVersion[versionKey as keyof typeof MySQLVersion];
        const set = new Set<string>();
        const set2 = new Set<string>();

        const dict = content[versionKey] as Array<Array<{ word: string; reserved: boolean; }>>;
        dict.forEach((list) => {
            if (Array.isArray(list)) {
                list.forEach((value) => {
                    if (value.word.length > 0) {
                        set.add(value.word);
                        if (value.reserved) {
                            set2.add(value.word);
                        }
                    }
                });
            }
        });

        mysqlKeywords.set(currentVersion, set);
        reservedMySQLKeywords.set(currentVersion, set2);
    });
});
