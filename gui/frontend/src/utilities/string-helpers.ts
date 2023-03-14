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

import { isNil } from "lodash";
import { Buffer } from "buffer";

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
    if (isNil(value)) {
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
 * Converts the given string data (which is assumed to be base64 encoded) to a hex string.
 *
 * @param text The string to convert.
 * @param limit The maximum number of characters to show.
 *
 * @returns The hex string.
 */
export const formatBase64ToHex = (text: string, limit?: number): string => {
    const buffer = Buffer.from(text, "base64");
    const bufString = buffer.toString("hex");

    if (limit && bufString.length > limit) {
        return "0x" + bufString.substring(0, limit) + "…";
    }

    return "0x" + bufString;
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
