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

import _ from "lodash";

import { IDictionary } from "../app-logic/Types";
import { convertHexToBase64 } from "./string-helpers";

/**
 * Allows the user to select a local file.
 *
 * @param acceptedExtensions A list of file extensions (including the dot) that are allowed to be selected.
 * @param multiple If true, allows to select more than a single file.
 *
 * @returns A promise that resolves to a single file or a list of files.
 */
export const selectFile = (acceptedExtensions: string[], multiple: boolean): Promise<File[] | null> => {
    return new Promise((resolve): void => {
        const input = document.createElement("input");
        input.type = "file";
        input.id = "fileSelect";
        input.multiple = multiple;
        input.accept = acceptedExtensions.join(",");
        document.body.appendChild(input);

        input.onchange = (): void => {
            const files = input.files ? Array.from(input.files) : null;
            resolve(files);

            document.body.removeChild(input);
        };

        input.click();

    });
};

/**
 * Stores the the text in a local file. Usually the web browser determines where the file is stored (download folder).
 *
 * @param text The content of the file.
 * @param fileName The name of the target file (should not contain a path).
 */
// Testing note: this method relies on behavior which requires a real browser, so we cannot test this in a fake DOM.
// istanbul ignore next
export const saveTextAsFile = (text: string, fileName: string): void => {
    const blob = new Blob([text], { type: "text/plain" }); // Will use UTF-8 encoding.
    const downloadLink = document.createElement("a");
    downloadLink.download = fileName;
    downloadLink.innerHTML = "Download File";
    if (window.webkitURL) {
        // No need to add the download element to the DOM in Webkit.
        downloadLink.href = window.webkitURL.createObjectURL(blob);
    } else {
        downloadLink.href = window.URL.createObjectURL(blob);
        downloadLink.onclick = (event: MouseEvent): void => {
            if (event.target) {
                document.body.removeChild(event.target as Node);
            }
        };
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);
    }

    downloadLink.click();

    if (window.webkitURL) {
        window.webkitURL.revokeObjectURL(downloadLink.href);
    } else {
        window.URL.revokeObjectURL(downloadLink.href);
    }
};

/**
 * Ensures a value is within a given range.
 *
 * @param value The value to check.
 * @param min The smallest value that is possible.
 * @param max The largest value that is possible.
 *
 * @returns The given value, trimmed to the min and max bounds.
 */
export const clampValue = (value: number, min?: number | undefined, max?: number | undefined): number => {
    if (!_.isNil(min) && value < min) {
        return min;
    }

    if (!_.isNil(max) && value > max) {
        return max;
    }

    return value;
};

/**
 * Generates a random UUID using Math.random.
 * We don't need cryptographic quality here, so this approach is fine, especially in a mixed Node/browser environment.
 *
 * @returns The generated UUID.
 */
export const uuid = (): string => {
    let d = new Date().getTime();
    let d2 = (performance && performance.now && (performance.now() * 1000)) || 0;

    // cspell: ignore yxxx
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        let r = Math.random() * 16;
        if (d > 0) {
            r = (d + r) % 16 | 0;
            d = Math.floor(d / 16);
        } else {
            r = (d2 + r) % 16 | 0;
            d2 = Math.floor(d2 / 16);
        }

        return (c === "x" ? r : ((r & 0x7) | 0x8)).toString(16);
    });
};

/**
 * Generates a random UUID that fits into a BINARY(16) column
 * Uses uuid() so the same limitations apply.
 *
 * @returns The generated UUID, Base64 encoded.
 */
export const uuidBinary16Base64 = (): string => {
    const id = uuid().replaceAll("-", "");

    return convertHexToBase64(id);
};

/**
 * A pretty straight forward binary search implementation with a predicate function.
 * It doesn't take an element to search for, but instead calls the predicate for each iteration step providing
 * a value the caller can compare to whatever it needs to, returning < 0 if the search element comes before the passed
 * in one, 0 if they are at the same position and > 0 if the search element is beyond the given element.
 *
 * @param list The list to search.
 * @param predicate The predicate function to determine the position of the current element.
 *
 * @returns If the element was found its index is returned. Otherwise a negative number is returned to indicate
 *          where the element would have to be inserted.
 */
export const binarySearch = <T>(list: T[], predicate: (current: T) => number): number => {
    let m = 0;
    let n = list.length - 1;
    while (m <= n) {
        const k = (n + m) >> 1;
        const comparison = predicate(list[k]);
        if (comparison > 0) {
            m = k + 1;
        } else if (comparison < 0) {
            n = k - 1;
        } else {
            return k;
        }
    }

    return -m - 1;
};

/**
 * A helper function to asynchronously wait for a specific time. The call allows to run other JS code
 * while waiting for the timeout.
 *
 * @param ms The duration in milliseconds to wait.
 *
 * @returns A promise to wait for.
 */
export const sleep = (ms: number): Promise<unknown> => {
    return new Promise((resolve) => {
        return setTimeout(resolve, ms);
    });
};

/**
 * Waits for a condition to become true.
 *
 * @param timeout The number of milliseconds to wait for the condition.
 * @param condition A function that checks if a condition has become true.
 *
 * @returns A promise that resolves to true, if the condition became true within the timeout range, otherwise false.
 */
export const waitFor = async (timeout: number, condition: () => boolean): Promise<boolean> => {
    while (!condition() && timeout > 0) {
        timeout -= 100;
        await sleep(100);
    }

    return timeout > 0 ? true : false;
};

/**
 * Flattens an object by converting all members that are itself objects (array, object) to strings.
 *
 * @param o The object to flatten.
 *
 * @returns The same object with converted members.
 */
export const flattenObject = (o: IDictionary): object => {
    for (const [key, value] of Object.entries(o)) {
        if (typeof value === "object") {
            let result = JSON.stringify(value, undefined, " ");
            result = result.replace(/\n/g, " ");
            result = result.replace(/ +/g, " ");
            result = result.replace(/\[ /g, "[");
            result = result.replace(/ ]/g, "]");

            o[key] = result;
        }
    }

    return o;
};

interface IIgnoreMarker {
    type: "ignore";
}

interface IRegexMarker {
    type: "regex";
    parameters: string;
}

interface IListMarker {
    type: "list";
    parameters: { list: unknown[]; full: boolean; };
}

type IComparisonMarker = IIgnoreMarker | IRegexMarker | IListMarker;

/**
 * Helper function for `deepEqual` to get details of comparison markers.
 *
 * @param value A value to check if that's a comparison marker.
 *
 * @returns If `value` is a marker then return it's type + parameters.
 */
const extractMarker = (value: unknown): IComparisonMarker | undefined => {
    if (value && typeof value !== "object") {
        return undefined;
    }

    const v = value as IDictionary;
    if (typeof v.symbol !== "symbol") {
        return undefined;
    }

    switch (v.symbol.description) {
        case "ignore": {
            return {
                type: "ignore",
            };
        }

        case "regex": {
            return {
                type: "regex",
                parameters: v.parameters as string,
            };
        }

        case "list": {
            return {
                type: "list",
                parameters: v.parameters as { list: unknown[]; full: boolean; },
            };

        }

        default:
    }
};

/**
 * Compares two values recursively. Markers are used to control how the comparison is performed.
 * Special objects with a symbol member are used to define special handling in the comparison (see also extractMarker):
 *   - "ignore": If given, no comparison is performed and the values are considered equal.
 *   - "regex:": Specifies a regular expression to be used to match the other value. Only one of the values
 *               can use this symbol. Otherwise they are considered to be different.
 *   - "matchList": Allows to compare a value (which must be an array) against a given list of values.
 *
 * @param a The first value to compare.
 * @param b The second value to compare.
 *
 * @returns True if both values are equal, otherwise false.
 */
export const deepEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) { // Same object?
        return true;
    }

    // Cannot be both undefined at this point because of the first test.
    if (a === undefined || b === undefined) {
        return false;
    }

    const typeOfA = typeof a;
    const typeOfB = typeof b;

    // First check for markers that modify the comparison process.
    const markerA = extractMarker(a);
    const markerB = extractMarker(b);
    if (markerA || markerB) {
        if (markerA && markerB) {
            // Both are markers, which cannot work.
            return false;
        }

        const value = markerA ? b : a;
        const marker = markerA ?? markerB;
        switch (marker?.type) {
            case "ignore": {
                return true;
            }

            case "regex": {
                const pattern = new RegExp(marker.parameters);

                return typeof value === "string" && pattern.exec(value) !== null;
            }

            case "list": {
                if (!Array.isArray(value)) {
                    return false;
                }

                const list = marker.parameters.list;
                const full = marker.parameters.full;
                if (full && value.length !== list.length) {
                    return false;
                }

                for (let i = 0; i < list.length; ++i) {
                    if (!deepEqual(value[i], list[i])) {
                        return false;
                    }
                }

                return true;
            }

            // istanbul ignore next
            default: {
                // This branch can never be taken, because of our marker check above.
                return false;
            }
        }
    }

    if ((typeOfA === "object") && (typeOfB === "object")) {
        const objA = a as { [key: string]: unknown; };
        const objB = b as { [key: string]: unknown; };
        if (Object.keys(objA).length !== Object.keys(objB).length) {
            return false;
        }

        for (const key in objA) {
            if (!(key in objB) || !deepEqual(objA[key], objB[key])) {
                return false;
            }
        }

        return true;
    } else if ((typeof a == "object") || (typeof b == "object")) {
        // Only one value is an object.
        return false;
    } else {
        return Object.is(a, b);
    }
};

/**
 * A safer variant of `eval`, using a function object instead of the `eval` function.
 * Enforces strict mode and does not allow to define new objects.
 *
 * @param code The code to evaluate.
 *
 * @returns The value returned by the function tail-call.
 */
export const strictEval = (code: string): unknown => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func, @typescript-eslint/no-unsafe-return
    return Function("'use strict';return (" + code + ")")();
};

declare module "lodash" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    interface LoDashStatic {
        deepMapKeys: (o: object, ignoreList: string[], fn: (value: unknown, key: string) => unknown) => object;
        deepMapArray: (a: unknown[], ignoreList: string[], fn: (value: unknown, key: string) => unknown) => unknown[];
    }
}

// Add lodash mixins to recursively map object keys.
_.mixin({
    deepMapKeys: (o: object, ignoreList: string[], fn: (value: unknown, key: string) => string): object => {
        const result: IDictionary = {};

        _.forOwn(o, (v: unknown, k: string) => {
            if (!ignoreList.includes(k)) {
                if (_.isPlainObject(v)) {
                    v = _.deepMapKeys(v as object, ignoreList, fn);
                } else if (_.isArray(v)) {
                    v = _.deepMapArray(v, ignoreList, fn);
                }
            }
            result[fn(v, k)] = v;
        });

        return result;
    },

    deepMapArray: (a: unknown[], ignoreList: string[], fn: (value: unknown, key: string) => unknown): unknown[] => {
        return a.map((v) => {
            if (_.isPlainObject(v)) {
                return _.deepMapKeys(v as object, ignoreList, fn);
            } else if (_.isArray(v)) {
                return _.deepMapArray(v as unknown[], ignoreList, fn);
            }

            return v;
        });
    },
});
