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

const needMasking = (key: string): boolean => {
    const lowercasedKey = key.toLowerCase();

    return lowercasedKey.includes("password")
        || lowercasedKey.includes("passphrase")
        || lowercasedKey.includes("pass_phrase");
};

/**
 * Recursively masks password fields in an object by replacing their values with '***'.
 * 
 * @param obj - The object to mask passwords in
 * @returns The object with masked password fields
 */
const maskPasswords = <T>(obj: T): T => {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj !== "object") {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map((item: unknown) => {
            return maskPasswords(item);
        }) as unknown as T;
    }

    const maskedObj = {} as T;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = (obj as Record<string, unknown>)[key];
            if (needMasking(key)) {
                (maskedObj as Record<string, unknown>)[key] = "[[redacted]]";
            } else {
                (maskedObj as Record<string, unknown>)[key] = maskPasswords(value);
            }
        }
    }

    return maskedObj;
};

const logWithPasswordMask = (...args: unknown[]): void => {
    const maskedArgs = args.map(arg => {
        return arg && typeof arg === "object" ? maskPasswords(arg) : arg;
    });

    // If the user passed a single array argument, log it as array (not expanded)
    // If they passed multiple args, log each separately
    if (maskedArgs.length === 1 && Array.isArray(maskedArgs[0])) {
        console.log(maskedArgs[0]);
    } else {
        console.log(...maskedArgs);
    }
};

export class MigrationSubAppLogger {
    public constructor(private enabled: boolean) { }

    public logWithPasswordMask(...args: unknown[]): void {
        if (this.enabled) {
            logWithPasswordMask(...args);
        }
    }
}
