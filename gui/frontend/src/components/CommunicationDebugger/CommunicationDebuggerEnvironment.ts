/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { IGenericResponse, IShellRequest, Protocol, ICommStartSessionEvent } from "../../communication";
import { IDictionary } from "../../app-logic/Types";
import { dispatcher, DispatchEvents, EventType } from "../../supplement/Dispatch";
import { convertCamelToSnakeCase, deepEqual, sleep, strictEval, uuid } from "../../utilities/helpers";
import { MessageScheduler } from "../../communication/MessageScheduler";

/** The environment injected as global in the debugger scripts. */
export class CommunicationDebuggerEnvironment {

    public tokens = {};

    private lastGeneratedId: string;
    private lastReceivedModuleSessionId: string;
    private lastReceivedResponse: IGenericResponse | undefined;

    public constructor(private loadedScripts: Map<string, string>) {
    }

    public get lastGeneratedRequestId(): string {
        return this.lastGeneratedId;
    }

    public get lastModuleSessionId(): string {
        return this.lastReceivedModuleSessionId;
    }

    public get lastResponse(): IGenericResponse | undefined {
        return this.lastReceivedResponse;
    }

    public clearState(): void {
        this.tokens = {};
        this.lastGeneratedId = "";
        this.lastReceivedModuleSessionId = "";
        this.lastReceivedResponse = undefined;
    }

    public async doSend(data: IShellRequest): Promise<IGenericResponse> {
        return new Promise((resolve) => {
            const request = Protocol.getStandardRequest(data.request, data);

            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;

                resolve({
                    requestId: data.request_id,
                    requestState: { type: "error", msg: "No response from backend in 3 seconds" },
                });
            }, 3000);

            const setLastResponse = (event: IDictionary): void => {
                clearTimeout(timer);
                if (!timedOut) { // Ignore results from timed-out responses.
                    this.lastReceivedResponse = convertCamelToSnakeCase(event.data as object) as IGenericResponse;
                    if ((event.data as IDictionary).moduleSessionId) {
                        this.lastReceivedModuleSessionId = (event.data as IDictionary).moduleSessionId as string;
                    }
                    resolve(this.lastReceivedResponse);
                }

            };

            MessageScheduler.get.sendRequest(request, { messageClass: "debugger" }).then((event) => {
                setLastResponse(event as IDictionary);
            }).catch((event) => {
                setLastResponse(event as IDictionary);
            });
        });
    }

    /**
     * Awaitable method to send a request to the backend.
     * Note: the returned promise can only be used to wait for the first response. If there are more you have to use
     *       `getNextSequentialResponse` until it returns no value anymore.
     *
     * @param data The request details.
     * @returns A promise to handle the response of the server.
     */
    public async send(data: IShellRequest): Promise<IGenericResponse> {
        let result;
        try {
            MessageScheduler.get.inDebugCall = true;

            result = await this.doSend(data);
        } finally {
            MessageScheduler.get.inDebugCall = false;
        }

        return result;
    }

    /**
     * Generates a new uuid that can be used in communication requests.
     *
     * @returns The new request ID.
     */
    public generateRequestId(): string {
        this.lastGeneratedId = uuid();

        return this.lastGeneratedId;
    }

    public log(output: string): void {
        const event = DispatchEvents.baseEvent(EventType.Notification, { output }, undefined, "debugger");
        dispatcher.triggerEvent(event);
    }

    /**
     * Validation (test) function to determine if two responses are equal. The comparison is recursively done on a
     * field-by-field basis, so that the order of the fields doesn't matter. Additionally, special values are supported
     * to guide and enhance the comparison process. See the fields/functions: `ignore` and `matchRegexp`.
     *
     * The function will send the comparison result to the log as comments.
     *
     * @param actual A single response received from the backend.
     * @param expected A structure describing the expected values in the actual response.
     * @param responseIndex An optional index which, when given, adds the number to the output.
     * @returns True if both values are semantically equal, otherwise false.
     */
    public validateResponse(actual?: IGenericResponse, expected?: IGenericResponse, responseIndex?: number): boolean {
        const result = deepEqual(expected, actual);
        const indexText = responseIndex !== undefined ? ` (response ${responseIndex})` : "";
        if (result) {
            this.log(`/* Validation successful${indexText}. */`);

            return true;
        } else {
            this.log(`/* WARNING: values differ${indexText}.\nActual:
${JSON.stringify(actual, undefined, 4)}
Expected:\n${JSON.stringify(expected, undefined, 4)}\n*/`);

            return false;
        }
    }

    /**
     * Convenience function to validate the last received response. It uses `validateResponse` to do the actual work.
     *
     * @param expected A structure describing the expected values in the actual response.
     * @param responseIndex An optional index which, when given, adds the number to the output.
     * @returns True if both values are semantically equal, otherwise false.
     */
    public validateLastResponse(expected: IGenericResponse, responseIndex?: number): boolean {
        return this.validateResponse(this.lastReceivedResponse, expected, responseIndex);
    }

    /**
     * Sends the specified request to the backend and waits for the responses. Fulfills the returned promise when all
     * responses arrived or a timeout of 3 seconds happened, whatever comes first.
     *
     * @param data The request to send.
     * @param expected A list of responses to compare to. The function will not fulfill the promise until the same
     *                 number of responses have been received, as there are items in this list. If not enough responses
     *                 came in during a specific time frame (3 secs currently) the validation will fail.
     *                 Any extraneous response is ignored, once all items in the expected list have been processed.
     */
    public async sendAndValidate(data: IShellRequest, expected: IGenericResponse[]): Promise<void> {
        if (expected.length === 0) {
            this.log("/* WARNING: No expectations found. */");
        }

        MessageScheduler.get.inDebugCall = true;
        try {
            const request = Protocol.getStandardRequest(data.request, data);

            let currentIndex = 0;
            this.lastReceivedResponse = undefined;
            let failed = false;

            MessageScheduler.get.sendRequest(request, { messageClass: "debuggerValidate" })
                .then((event: ICommStartSessionEvent) => {
                    // Ignore any extraneous responses.
                    if (currentIndex < expected.length) {
                        this.lastReceivedResponse = convertCamelToSnakeCase(event.data as object) as IGenericResponse;
                        failed = failed ||
                            !this.validateResponse(this.lastReceivedResponse, expected[currentIndex], currentIndex++);

                        if (event.data.result.moduleSessionId) {
                            this.lastReceivedModuleSessionId = event.data.result.moduleSessionId;
                        }
                    }
                }).catch((event) => {
                    this.lastReceivedResponse = convertCamelToSnakeCase(event.data as object) as IGenericResponse;
                    failed = true;

                    // No error printout here. The debugger has a global event listener doing that.
                });

            let attempt = 0;
            while (attempt++ < 10 && !failed && currentIndex < expected.length) {
                await sleep(300);
            }

            if (failed) {
                this.log("/* WARNING: At least one validation failed. */");
            } else if (currentIndex < expected.length) {
                this.log("/* WARNING: Validation incomplete. Not enough responses came in during the timeout of 3 " +
                    "seconds. */");
            } else {
                this.log("/* All validations succeeded. */");
            }
        } finally {
            MessageScheduler.get.inDebugCall = false;
        }
    }

    /**
     * Loads the script at the given path and executes it.
     *
     * @param path The path to the script to execute.
     */
    public async execute(path: string): Promise<void> {
        const code = this.loadedScripts.get(path);
        if (!code) {
            this.log("/* ERROR: Code of " + path + " not found. */");

            return;
        }

        try {
            await strictEval(`(async () => {${code}})()`);
        } catch (e) {
            throw new Error(String(e) + " (" + path + ")");
        }
    }

    /**
     * Returns a marker value which indicates that the member in an object or array should be ignored
     * when comparing the owning object/array to another object/array.
     *
     * @returns A special symbol.
     */
    public get ignore(): object {
        return {
            symbol: Symbol("ignore"),
        };
    }

    /**
     * Returns a marker value which indicates that the member in an object or array should be matched against
     * the given pattern, when comparing the owning object/array to another object/array.
     *
     * @param pattern The pattern to match.
     * @returns A special symbol.
     */
    public matchRegexp(pattern: string): object {
        return {
            symbol: Symbol("regex"),
            parameters: pattern,
        };
    }

    /**
     * Returns a marker value which indicates that the member in an object or array should be matched against
     * the given list, when comparing the owning object/array to another object/array.
     *
     * @param list The list to match.
     * @param full A flag stating if
     * @returns A special symbol.
     */
    public matchList(list: unknown[], full = true): object {
        return {
            symbol: Symbol("list"),
            parameters: { list, full },
        };
    }

}
