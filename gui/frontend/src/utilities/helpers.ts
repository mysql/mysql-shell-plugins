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

import { IDictionary } from "../app-logic/general-types.js";
import { convertHexToBase64 } from "./string-helpers.js";

/**
 * Checks if the given version is at least the expected version.
 *
 * @param version The version to check.
 * @param expected The expected version.
 *
 * @returns True if the version is at least the minimum version, otherwise false.
 */
export const versionMatchesExpected = (version: string | number[], expected: number[]): boolean => {
    if (typeof version === "string") {
        const parts = version.split(".");
        version = parts.map((v) => { return parseInt(v, 10); });
    }

    if (version.length < expected.length) {
        return false;
    }

    for (let i = 0; i < Math.min(expected.length, version.length); ++i) {
        if (version[i] < expected[i]) {
            return false;
        } else if (version[i] > expected[i]) {
            // Comparison only continues if current token is equal in both cases
            return true;
        }
    }

    return true;
};

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
 * Stores the given blob in a local file.
 * Usually the web browser determines where the file is stored (download folder).
 *
 * @param blob The content of the file.
 * @param fileName The name of the target file (should not contain a path).
 */
// Testing note: this method relies on behavior which requires a real browser, so we cannot test this in a fake DOM.
// istanbul ignore next
export const saveBlobAsFile = (blob: Blob, fileName: string): void => {
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
 * Stores the text in a local file.
 * Usually the web browser determines where the file is stored (download folder).
 *
 * @param text The content of the file.
 * @param fileName The name of the target file (should not contain a path).
 */
// istanbul ignore next
export const saveTextAsFile = (text: string, fileName: string): void => {
    const blob = new Blob([text], { type: "text/plain" }); // Will use UTF-8 encoding.
    saveBlobAsFile(blob, fileName);
};

/**
 * Stores the array content in a local file.
 * Usually the web browser determines where the file is stored (download folder).
 *
 * @param content The content of the file.
 * @param fileName The name of the target file (should not contain a path).
 */
// istanbul ignore next
export const saveArrayAsFile = (content: ArrayBuffer, fileName: string): void => {
    const blob = new Blob([content], { type: "application/octet-stream" });
    saveBlobAsFile(blob, fileName);
};

/**
 * Loads the content of the given file as text.
 *
 * @param file The file to load.
 *
 * @returns A promise that resolves to the content of the file.
 */
export const loadFileAsText = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
            resolve(reader.result as string);
        };
        reader.readAsText(file);
    });
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
export const clampValue = <T extends number | bigint>(value: T, min?: T, max?: T): T => {
    if (min != null && value < min) {
        return min;
    }

    if (max != null && value > max) {
        return max;
    }

    return value;
};

/**
 * Same as Math.min, but supports bigint too.
 * @param a The first value.
 * @param b The second value.
 *
 * @returns The smaller of the two values.
 */
export const minValue = <T extends number | bigint>(a: T, b: T): T => {
    return a < b ? a : b;
};

/**
 * Same as Math.max, but supports bigint too.
 * @param a The first value.
 * @param b The second value.
 *
 * @returns The bigger of the two values.
 */
export const maxValue = <T extends number | bigint>(a: T, b: T): T => {
    return a > b ? a : b;
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

/**
 * Duplicates the given object by creating a deep clone of it.
 *
 * @param o The object to clone.
 *
 * @returns The cloned object.
 */
export const deepClone = <T extends Object>(o: T): T => {
    if (typeof o !== "object") {
        return o;
    }

    const result: IDictionary = {};
    for (const [key, value] of Object.entries(o)) {
        result[key] = deepClone(value);
    }

    return result as unknown as T;
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

/**
 * Helper method to convert the keys of an object, using a mapping function. The function is called for each key
 * and the return value is used as the new key. The value is not changed.
 * If the value is an array or an object, the function is called recursively.
 *
 * @param o The object to convert.
 * @param ignoreList A list of keys that should not be converted.
 * @param fn The mapping function to use.
 *
 * @returns A new object with the converted values.
 */
export const deepMapKeys = (o: object, ignoreList: string[], fn: (value: unknown, key: string) => string): object => {
    const result: IDictionary = {};

    for (const [k, v] of Object.entries(o)) {
        let actualValue = v;
        if (!ignoreList.includes(k)) {
            if (Array.isArray(v)) {
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                actualValue = deepMapArray(v, ignoreList, fn);
            } else if (v !== null && typeof v === "object") {
                actualValue = deepMapKeys(v as object, ignoreList, fn);
            }
        }

        result[fn(v, k)] = actualValue;
    }

    return result;
};

/**
 * Helper method to recursively convert array values which are objects, by replacing their keys using a mapping
 * function.
 *
 * @param a The array to convert.
 * @param ignoreList A list of keys that should not be converted.
 * @param fn The mapping function to use.
 *
 * @returns A new array with the converted values.
 */
export const deepMapArray = (a: unknown[], ignoreList: string[],
    fn: (value: unknown, key: string) => string): unknown[] => {
    return a.map((v) => {
        if (Array.isArray(v)) {
            return deepMapArray(v as unknown[], ignoreList, fn);
        } else if (v !== null && typeof v === "object") {
            return deepMapKeys(v, ignoreList, fn);
        }

        return v;
    });
};

export const convertErrorToString = (error: unknown): string => {
    if (!(error instanceof Error)) {
        return String(error);
    }

    const e = error;
    let result = e.message;
    if (e.cause) {
        result += "\n" + convertErrorToString(e.cause);
    }

    return result;
};

/* eslint-disable @typescript-eslint/naming-convention */
/** Key names to key strings. */
export const KeyboardKeys = {
    // Modifier keys
    Alt: "Alt",
    AltGraph: "AltGraph",
    CapsLock: "CapsLock",
    Control: "Control",
    Fn: "Fn",
    FnLock: "FnLock",
    Hyper: "Hyper",
    Meta: "Meta",
    NumLock: "NumLock",
    ScrollLock: "ScrollLock",
    Shift: "Shift",
    Super: "Super",
    Symbol: "Symbol",
    SymbolLock: "SymbolLock",

    // Whitespace keys
    Enter: "Enter",
    Tab: "Tab",
    Space: " ",

    // Navigation keys
    ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
    ArrowUp: "ArrowUp",
    End: "End",
    Home: "Home",
    PageDown: "PageDown",
    PageUp: "PageUp",

    // Editing keys
    Backspace: "Backspace",
    Clear: "Clear",
    Copy: "Copy",
    CrSel: "CrSel",
    Cut: "Cut",
    Delete: "Delete",
    EraseEof: "EraseEof",
    ExSel: "ExSel",
    Insert: "Insert",
    Paste: "Paste",
    Redo: "Redo",
    Undo: "Undo",

    // UI Keys
    Accept: "Accept",
    Again: "Again",
    Attn: "Attn",
    Cancel: "Cancel",
    ContextMenu: "ContextMenu",
    Escape: "Escape",
    Execute: "Execute",
    Find: "Find",
    Finish: "Finish",
    Help: "Help",
    Pause: "Pause",
    Play: "Play",
    Props: "Props",
    Select: "Select",
    ZoomIn: "ZoomIn",
    ZoomOut: "ZoomOut",

    // Device keys
    BrightnessDown: "BrightnessDown",
    BrightnessUp: "BrightnessUp",
    Eject: "Eject",
    LogOff: "LogOff",
    Power: "Power",
    PowerOff: "PowerOff",
    PrintScreen: "PrintScreen",
    Hibernate: "Hibernate",
    Standby: "Standby",
    WakeUp: "WakeUp",

    // IME and composition keys
    AllCandidates: "AllCandidates",
    Alphanumeric: "Alphanumeric",
    CodeInput: "CodeInput",
    Compose: "Compose",
    Convert: "Convert",
    Dead: "Dead",
    FinalMode: "FinalMode",
    GroupFirst: "GroupFirst",
    GroupLast: "GroupLast",
    GroupNext: "GroupNext",
    GroupPrevious: "GroupPrevious",
    ModeChange: "ModeChange",
    NextCandidate: "NextCandidate",
    NonConvert: "NonConvert",
    PreviousCandidate: "PreviousCandidate",
    Process: "Process",
    SingleCandidate: "SingleCandidate",

    // Function keys
    F1: "F1",
    F2: "F2",
    F3: "F3",
    F4: "F4",
    F5: "F5",
    F6: "F6",
    F7: "F7",
    F8: "F8",
    F9: "F9",
    F10: "F10",
    F11: "F11",
    F12: "F12",
    F13: "F13",
    F14: "F14",
    F15: "F15",
    F16: "F16",
    F17: "F17",
    F18: "F18",
    F19: "F19",
    F20: "F20",
    Soft1: "Soft1",
    Soft2: "Soft2",
    Soft3: "Soft3",
    Soft4: "Soft4",

    // Phone keys
    AppSwitch: "AppSwitch",
    Call: "Call",
    Camera: "Camera",
    CameraFocus: "CameraFocus",
    EndCall: "EndCall",
    GoBack: "GoBack",
    GoHome: "GoHome",
    HeadsetHook: "HeadsetHook",
    LastNumberRedial: "LastNumberRedial",
    Notification: "Notification",
    MannerMode: "MannerMode",
    VoiceDial: "VoiceDial",

    // Multimedia keys
    ChannelDown: "ChannelDown",
    ChannelUp: "ChannelUp",
    MediaFastForward: "MediaFastForward",
    MediaPause: "MediaPause",
    MediaPlay: "MediaPlay",
    MediaPlayPause: "MediaPlayPause",
    MediaRecord: "MediaRecord",
    MediaRewind: "MediaRewind",
    MediaStop: "MediaStop",
    MediaTrackNext: "MediaTrackNext",
    MediaTrackPrevious: "MediaTrackPrevious",

    // Audio control keys
    AudioBalanceLeft: "AudioBalanceLeft",
    AudioBalanceRight: "AudioBalanceRight",
    AudioBassDown: "AudioBassDown",
    AudioBassBoostDown: "AudioBassBoostDown",
    AudioBassBoostToggle: "AudioBassBoostToggle",
    AudioBassBoostUp: "AudioBassBoostUp",
    AudioBassUp: "AudioBassUp",
    AudioFaderFront: "AudioFaderFront",
    AudioFaderRear: "AudioFaderRear",
    AudioSurroundModeNext: "AudioSurroundModeNext",
    AudioTrebleDown: "AudioTrebleDown",
    AudioTrebleUp: "AudioTrebleUp",
    AudioVolumeDown: "AudioVolumeDown",
    AudioVolumeMute: "AudioVolumeMute",
    AudioVolumeUp: "AudioVolumeUp",
    MicrophoneToggle: "MicrophoneToggle",
    MicrophoneVolumeDown: "MicrophoneVolumeDown",
    MicrophoneVolumeMute: "MicrophoneVolumeMute",
    MicrophoneVolumeUp: "MicrophoneVolumeUp",

    // Document keys
    Close: "Close",
    New: "New",
    Open: "Open",
    Print: "Print",
    Save: "Save",
    SpellCheck: "SpellCheck",
    MailForward: "MailForward",
    MailReply: "MailReply",
    MailSend: "MailSend",

    // Application selector keys
    LaunchCalculator: "LaunchCalculator",
    LaunchCalendar: "LaunchCalendar",
    LaunchContacts: "LaunchContacts",
    LaunchMail: "LaunchMail",
    LaunchMediaPlayer: "LaunchMediaPlayer",
    LaunchMusicPlayer: "LaunchMusicPlayer",
    LaunchMyComputer: "LaunchMyComputer",
    LaunchPhone: "LaunchPhone",
    LaunchScreenSaver: "LaunchScreenSaver",
    LaunchSpreadsheet: "LaunchSpreadsheet",
    LaunchWebBrowser: "LaunchWebBrowser",
    LaunchWebCam: "LaunchWebCam",
    LaunchWordProcessor: "LaunchWordProcessor",
    LaunchApplication1: "LaunchApplication1",
    LaunchApplication2: "LaunchApplication2",
    LaunchApplication3: "LaunchApplication3",
    LaunchApplication4: "LaunchApplication4",
    LaunchApplication5: "LaunchApplication5",
    LaunchApplication6: "LaunchApplication6",
    LaunchApplication7: "LaunchApplication7",
    LaunchApplication8: "LaunchApplication8",
    LaunchApplication9: "LaunchApplication9",
    LaunchApplication10: "LaunchApplication10",
    LaunchApplication11: "LaunchApplication11",
    LaunchApplication12: "LaunchApplication12",
    LaunchApplication13: "LaunchApplication13",
    LaunchApplication14: "LaunchApplication14",
    LaunchApplication15: "LaunchApplication15",
    LaunchApplication16: "LaunchApplication16",

    // Browser control keys
    BrowserBack: "BrowserBack",
    BrowserFavorites: "BrowserFavorites",
    BrowserForward: "BrowserForward",
    BrowserHome: "BrowserHome",
    BrowserRefresh: "BrowserRefresh",
    BrowserSearch: "BrowserSearch",
    BrowserStop: "BrowserStop",

    // Numeric keypad keys
    Decimal: "Decimal",
    Key11: "Key11",
    Key12: "Key12",
    Multiply: "Multiply",
    Add: "Add",
    Divide: "Divide",
    Subtract: "Subtract",
    Separator: "Separator",
    Zero: "0",
    One: "1",
    Two: "2",
    Three: "3",
    Four: "4",
    Five: "5",
    Six: "6",
    Seven: "7",
    Eight: "8",
    Nine: "9",

    // Standard letter keys
    A: "a",
    B: "b",
    C: "c",
    D: "d",
    E: "e",
    F: "f",
    G: "g",
    H: "h",
    I: "i",
    J: "j",
    K: "k",
    L: "l",
    M: "m",
    N: "n",
    O: "o",
    P: "p",
    Q: "q",
    R: "r",
    S: "s",
    T: "t",
    U: "u",
    V: "v",
    W: "w",
    X: "x",
    Y: "y",
    Z: "z",

    /* eslint-enable @typescript-eslint/naming-convention */
};
