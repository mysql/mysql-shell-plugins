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

import { Buffer } from "buffer";
import { deepMapKeys } from "./helpers";

// A web worker friendly module for specific string handling.

const quotePairs = new Map([
    ["(", ")"],
    ["{", "}"],
    ["[", "]"],
    ["\"", "\""],
    ["'", "'"],
    ["`", "`"],
]);

/**
 * Wraps the given text with quotes derived from the given quote char, if it isn't already quoted with that char.
 *
 * @param text The text to wrap.
 * @param quoteChar The left hand quote char. For mirrored quotes the closing quote char is automatically selected.
 *
 * @returns The quoted string.
 */
export const quote = (text: string, quoteChar = "`"): string => {
    const second = quotePairs.get(quoteChar) ?? quoteChar;

    if (text.length > 2) {
        const first = text[0];
        const last = text[text.length - 1];
        if (quoteChar === first && second === last) {
            return text;
        }
    }

    return `${quoteChar}${text}${second}`;
};

/**
 * Removes single quote characters from the given text.
 *
 * @param text The input to clean up.
 * @param quotes Possible quote chars to consider. For mirrored delimiters use the opening one (e.g. "(").
 *               By default single, double or backtick quotes are removed.
 *
 * @returns The input without outer whitespaces and quotes.
 */
export const unquote = (text: string, quotes = "\"'`"): string => {
    let result = text.trim();
    if (result.length > 1) {
        const first = result[0];
        const last = result[result.length - 1];

        if (quotes.includes(first)) {
            const second = quotePairs.get(first);
            if (second === last) {
                result = result.substring(1, result.length - 1);
            }
        }
    }

    return result;
};

/**
 * Converts an optional value to a string expression for use in CSS.
 *
 * @param value The value to convert. If it is a string, it's taken over as is.
 * @param numericUnit Only used for numeric values, with which it is combined to form a simple value,
 *                    for example "10px" or "1em".
 *
 * @returns A CSS value.
 */
export const convertPropValue = (value?: number | string | undefined, numericUnit = "px"): string | undefined => {
    if (value == null) {
        return undefined;
    }

    if (typeof value === "number") {
        return `${value}${numericUnit}`;
    }

    return value;
};

/**
 * Checks if a given string consists only of whitespace characters (space, tab, line breaks).
 *
 * @param str The string to check.
 *
 * @returns True if the string only contains whitespaces, otherwise false.
 */
export const isWhitespaceOnly = (str: string): boolean => {
    return /^\s+$/.test(str);
};

/**
 * Converts the given time to a string expression, in the most compact and readable format.
 *
 * @param time The time in seconds to format.
 *
 * @returns The formatted time.
 */
export const formatTime = (time?: number): string => {
    if (time === undefined || time === null || isNaN(time) || !isFinite(time) || time < 0) {
        return "invalid time";
    }

    if (time < 10) {
        if (time < 1) {
            if (time === 0) {
                return "0s";
            }

            return `${Math.floor(time * 1e6) / 1000}ms`;
        }

        const seconds = Math.floor(time);
        if (time - seconds > 0) {
            return `${time}s`;
        }

        return `${seconds}s`;
    } else {
        // More than 10 secs: format as "d HH:MM:SS".
        time = Math.round(time);

        // TODO: consider locales.
        const days = Math.floor(time / 86400);
        const hours = Math.floor(time / 3600) % 24;
        const minutes = Math.floor(time / 60) % 60;
        const seconds = time % 60;

        return (days > 0 ? (`0${days}`).slice(-2) + "d " : "") +
            (hours > 0 ? (`0${hours}`).slice(-2) + ":" : "") +
            (minutes > 0 ? (`0${minutes}`).slice(-2) + ":" : "") +
            (time > 60 ? (`0${seconds}`).slice(-2) : `${seconds}s`);
    }
};

/**
 * Converts the given number of bytes to a string expression, in the most compact and readable format.
 *
 * @param value The value in bytes
 *
 * @returns The formatted bytes.
 */
export const formatBytes = (value: number): string => {
    if (value < 1024) {
        return `${value.toFixed(2)} B`;
    }

    value /= 1024;
    if (value < 1014) {
        return `${value.toFixed(2)} KB`;
    }

    value /= 1024;
    if (value < 1024) {
        return `${value.toFixed(2)} MB`;
    }

    value /= 1024;

    return `${value.toFixed(2)} GB`;
};

/**
 * Formats a string with the correct singular/plural form.
 *
 * @param text The singular form of the text.
 * @param value The value to combine with the text.
 *
 * @returns The formatted string.
 */
export const formatWithNumber = (text: string, value: number): string => {
    return `${value} ${text}${(value === 1 || value === -1) ? "" : "s"}`;
};

/**
 * Converts the given input data (which is assumed to be a base64 encoded string) to a hex string.
 *
 * @param input The string to convert.
 * @param limit The maximum number of characters to show.
 *
 * @returns The hex string.
 */
export const formatBase64ToHex = (input: unknown, limit?: number): string => {
    if (typeof input !== "string") {
        return "<invalid>";
    }

    const buffer = Buffer.from(input, "base64");
    const bufString = buffer.toString("hex");

    if (limit && bufString.length > limit) {
        return "0x" + bufString.substring(0, limit) + "…";
    }

    return "0x" + bufString;
};

/**
 * Converts the given HEX string to a base64 encoded string.
 *
 * @param hex The hex string to convert.
 *
 * @returns The base64 encoded string.
 */
export const convertHexToBase64 = (hex: string): string => {
    // If strings starts with 0x remove that part
    if (hex.startsWith("0x")) {
        hex = hex.slice(2);
    }

    const buffer = Buffer.from(hex, "hex");
    const bufString = buffer.toString("base64");

    return bufString;
};

/**
 * A stricter check of a string, to see if it represents a number.
 * Taken from MDN.
 *
 * @param value A string to be converted to a number.
 *
 * @returns A number or NaN.
 */
export const filterInt = (value: string): number => {
    if (/^[-+]?(\d+|Infinity)$/.test(value)) {
        return Number(value);
    } else {
        return NaN;
    }
};

/**
 * Converts a given string from snake case to camel case
 *
 * @param str The string to convert.
 * @returns The converted string.
 */
export const snakeToCamelCase = (str: string): string => {
    if (str.includes("_") || str.includes("-")) {
        return str.toLowerCase().replace(/([-_][a-z])/g, (group): string => {
            return group
                .toUpperCase()
                .replace("-", "")
                .replace("_", "");
        });
    } else {
        return str;
    }
};

/**
 * Converts a given string from camel case to snake case
 *
 * @param str The string to convert.
 * @returns The converted string.
 */
export const camelToSnakeCase = (str: string): string => {
    return str.replace(
        /([a-z])([A-Z])/g, (full, match1: string, match2: string) => {
            return `${match1}_${match2.toLowerCase()}`;
        });
};

/**
 * Converts a camel case string to title case, that is the first letter in the string is converted to uppercase.
 *
 * @param s The string to convert.
 *
 * @returns The converted string.
 */
export const convertCamelToTitleCase = (s: string): string => {
    if (s.length < 1) {
        return "";
    }

    return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * This is the opposite direction of `convertCamelToTitleCase` by converting the first letter to lower case.
 *
 * @param s The string to convert.
 *
 * @returns The converted string.
 */
export const convertTitleToCamelCase = (s: string): string => {
    if (s.length < 1) {
        return "";
    }

    return s.charAt(0).toLowerCase() + s.slice(1);
};

/**
 * Converts a given string to pascal case, filtering out problematic chars
 *
 * @param str The string to convert.
 * @returns The converted string.
 */
export const convertToPascalCase = (str: string): string => {
    str = str.replace(/[^\d\w,]/g, "");
    if (str.includes("_")) {
        str = snakeToCamelCase(str);
    }

    return convertCamelToTitleCase(str);
};

/**
 * Converts a url path string to camel case, filtering out problematic chars
 *
 * @param str The string to convert.
 * @returns The converted string.
 */
export const pathToCamelCase = (str: string): string => {
    if (str.startsWith("/")) {
        str = str.slice(1);
    }
    str.replaceAll("/", "_");

    return str.replace(/([-_][a-z])/g, (group): string => {
        return group
            .toUpperCase()
            .replace("-", "")
            .replace("_", "");
    });
};

/**
 * Determines the base name (that is, the last part of the path) of a file or directory.
 *
 * @param path The path to get the base name from.
 * @param extension An optional extension to remove from the base name.
 *
 * @returns The base name of the path or an empty string if the path is empty.
 */
export const basename = (path: string, extension?: string): string => {
    const result = path.split(/[\\/]/).pop() ?? "";
    if (extension && result.endsWith(extension)) {
        return result.substring(0, result.length - extension.length);
    }

    return result;
};

interface IConversionOptions {
    ignore?: string[];
}

/**
 * Converts all object keys to snake_case, recursively.
 *
 * @param o The object to convert.
 * @param options Options to control the conversion process.
 *
 * @returns A new object with the converted keys.
 */
export const convertCamelToSnakeCase = (o: object, options?: IConversionOptions): object => {
    return deepMapKeys(o, options?.ignore ?? [], (value, key) => {
        const snakeCased = key.replace(/([a-z])([A-Z])/g, (full, match1: string, match2: string) => {
            return `${match1}_${match2.toLowerCase()}`;
        });

        return snakeCased;
    });
};

/**
 * Converts all object keys to camelCase, recursively.
 *
 * @param o The object to convert.
 * @param options Options to control the conversion process.
 *
 * @returns A new object with the converted keys.
 */
export const convertSnakeToCamelCase = (o: object, options?: IConversionOptions): object => {
    return deepMapKeys(o, options?.ignore ?? [], (value, key) => {
        return key.replace(/_([a-z0-9])/gi, (full, match: string) => {
            return match.toUpperCase();
        });
    });
};

/**
 * Compares two version strings
 *
 * @param baseVersion The base version used for compare
 * @param compareToVersion The version to compare the base version with
 * @returns -1, 0 or 1
 */
export const compareVersionStrings = (baseVersion: string, compareToVersion: string): number => {
    const v1 = baseVersion.split(".");
    const v2 = compareToVersion.split(".");
    const k = Math.min(v1.length, v2.length);
    for (let i = 0; i < k; ++i) {
        const v1Num = parseInt(v1[i], 10);
        const v2Num = parseInt(v2[i], 10);
        if (v1Num > v2Num) { return 1; }
        if (v1Num < v2Num) { return -1; }
    }

    return v1.length === v2.length ? 0 : (v1.length < v2.length ? -1 : 1);
};

/**
 * Formats a text block using a maximal line length
 *
 * @param text The text to format
 * @param maxLineLength The maximal line length
 * @returns The formatted text
 */
export const formatTextBlock = (text: string, maxLineLength: number): string => {
    return text.match(
        new RegExp(String.raw`\S(?:.{0,${maxLineLength - 2}}\S)?(?= |$)`, "g"))?.join("\n") ?? "";
};
