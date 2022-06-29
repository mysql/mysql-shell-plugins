/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

/* eslint-disable no-restricted-globals */

import { IDictionary } from "../../../app-logic/Types";
import {
    PrivateWorker, ScriptingApi, IConsoleWorkerResultData, IConsoleWorkerTaskData,
} from "../console.worker-types";

import { execute } from "../runtime/execute";

const sourceMapSignature = "//# sourceMappingURL=data:application/json;base64";

const worker = self as unknown as PrivateWorker;

worker.pendingRequests = new Map();
worker.postContextMessage = (taskId: number, data: IConsoleWorkerResultData): void => {
    worker.postMessage({
        taskId,
        data,
    });
};

worker.addEventListener("message", (event: MessageEvent) => {
    const { taskId, data }: { taskId: number; data: IConsoleWorkerTaskData } = event.data;

    worker.currentContext = data.contextId;
    worker.currentTaskId = taskId;

    if (data.code) {
        let sourceMap = "";
        let code = data.code;
        const index = code.indexOf(sourceMapSignature);
        if (index >= 0) {
            sourceMap = code.substring(index + sourceMapSignature.length);
            code = code.substring(0, index);
        }

        worker.sourceMap = sourceMap;

        execute({ worker, taskId, contextId: data.contextId ?? "" }, code).then((result) => {
            //let result: unknown;
            let isError = false;
            try {
                //result = execute({ worker, taskId, contextId: data.contextId ?? "" }, code);
                if (typeof result === "object" || typeof result === "function" || Array.isArray(result)) {
                    result = String(result);
                }
            } catch (error) {
                result = String(error);
                isError = true;
            }

            worker.postContextMessage(taskId, {
                api: ScriptingApi.Result,
                contextId: data.contextId!,
                result,
                isError,
                final: true,
            });
        }).catch((reason) => {
            console.log(reason);
        });
    } else if (data.result) {
        // Query data sent back from the application.
        const callback = worker.pendingRequests.get(data.contextId!);
        if (callback) {
            callback(data.result);
            if (data.final) {
                worker.pendingRequests.delete(data.contextId!);

                worker.postContextMessage(taskId, {
                    api: ScriptingApi.Done,
                    contextId: data.contextId!,
                    final: true,
                });
            }
        } else {
            let value = data.result;
            if (typeof value !== "string") {
                value = JSON.stringify(value, null, "\t");
            }

            worker.postContextMessage(taskId, {
                api: ScriptingApi.Print,
                contextId: data.contextId ?? "",
                value,
            });
        }
    }
});

// Handling for source maps.

export type SourceMappingPosition = number[];
export type SourceMappingLine = SourceMappingPosition[];
export type SourceMappings = SourceMappingLine[];

const codePointMap = new Map<number, number>();

"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".split("")
    .forEach((char, i) => {
        codePointMap.set(char.codePointAt(0) ?? 0, i);
    });

/**
 * Decodes a variable-length-quantity string into an array of numbers.
 *
 * @param input The string to decode.
 *
 * @returns An array of numbers.
 */
const decodeVLQ = (input: string) => {
    const result = [];

    let shift = 0;
    let value = 0;

    for (const c of input) {
        let codePoint = codePointMap.get(c.codePointAt(0) ?? 0);

        if (codePoint === undefined) {
            throw new Error("Invalid character (" + c + ")");
        }

        const hasContinuationBit = codePoint & 32;

        codePoint &= 31;
        value += codePoint << shift;

        if (hasContinuationBit) {
            shift += 5;
        } else {
            const negate = value & 1;
            value >>>= 1;

            if (negate) {
                result.push(value === 0 ? -0x80000000 : -value);
            } else {
                result.push(value);
            }

            value = 0;
            shift = 0;
        }
    }

    return result;
};

/**
 * Extracts detailed source mappings from the given source mapping string.
 *
 * @param sourceMap The code to examine.
 *
 * @returns The extracted source mappings.
 */
const extractSourceMappings = (sourceMap: string): SourceMappings => {
    try {
        const buffer = Buffer.from(sourceMap, "base64");

        const mapContent = JSON.parse(buffer.toString()) as IDictionary;
        const list = (mapContent.mappings as string).split(";");

        let decoded = list.map((line) => {
            return line.split(",");
        }).map((line) => {
            return line.map(decodeVLQ);
        });

        // Convert the relative position values to absolute ones.
        let sourceFileIndex = 0;   // second field
        let sourceCodeLine = 0;    // third field
        let sourceCodeColumn = 0;  // fourth field
        let nameIndex = 0;         // fifth field
        decoded = decoded.map((line) => {
            let generatedCodeColumn = 0; // first field - reset each time

            return line.map((segment) => {
                if (segment.length === 0) {
                    return [];
                }

                generatedCodeColumn += segment[0];

                const result = [generatedCodeColumn];

                if (segment.length === 1) {
                    // only one field!
                    return result;
                }

                sourceFileIndex += segment[1];
                sourceCodeLine += segment[2];
                sourceCodeColumn += segment[3];

                result.push(sourceFileIndex, sourceCodeLine, sourceCodeColumn);

                if (segment.length === 5) {
                    nameIndex += segment[4];
                    result.push(nameIndex);
                }

                return result;
            });
        });

        return decoded;
    } catch (e) {
        // Ignore errors here. This case should never happen, as the map is created by Typescript.
        return [];
    }
};

worker.addEventListener("error", (event: ErrorEvent) => {
    let lineInfo = "";
    if (event.filename.length === 0) {
        // Construct line info only for the passed-in code.
        const line = event.lineno - 1;

        const mappings = extractSourceMappings(worker.sourceMap);
        if (mappings.length >= line) {
            const lineMapping = mappings[line];
            const column = event.colno - 1;
            const position = lineMapping.find((candidate) => {
                return (candidate[0] === column);
            });

            if (position && position.length > 3) {
                lineInfo = ` (${position[2] + 1}:${position[3] + 1})`;
            }
        }
    }

    worker.postContextMessage(worker.currentTaskId!, {
        api: ScriptingApi.Result,
        contextId: worker.currentContext!,
        result: `${event.message}${lineInfo}`,
        isError: true,
        final: true,
    });

    event.preventDefault();
});
