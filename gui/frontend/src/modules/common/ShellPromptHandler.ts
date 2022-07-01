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

import {
    IServicePasswordRequest, IDialogRequest, DialogType, IDictionary, IDialogResponse, DialogResponseClosure,
} from "../../app-logic/Types";
import {
    IPromptReplyBackend, IShellFeedbackRequest, IShellPasswordFeedbackRequest, IShellResultType,
    ShellPromptResponseType,
} from "../../communication";
import { requisitions } from "../../supplement/Requisitions";

export interface IPromptData {
    requestId: string;
    backend: IPromptReplyBackend;
}

/**
 * A class to centrally deal with possible shell prompt requests. It triggers specific dialogs and sends back
 * a reply to the backend.
 */
export class ShellPromptHandler {
    /**
     * Checks the given result to see if that represents a shell prompt. If that's the case it is handled here.
     *
     * @param result The result to examine.
     * @param requestId The request ID for which this result was returned.
     * @param backend The backend to be used to send the reply to.
     * @param title Use this as the title for the dialog, if no explicit title is given.
     * @param payload Any value to be passed on to the dialog and ultimately to the receiver of the dialog result.
     *
     * @returns True, if the result is a prompt request, otherwise false (and the result is not handled).
     */
    public static handleShellPrompt(result: IShellResultType, requestId: string, backend: IPromptReplyBackend,
        title?: string, payload?: IDictionary): boolean {
        if (this.isShellPromptResult(result)) {
            switch (result.type) {
                case "password": {
                    const passwordRequest = ShellPromptHandler.splitAndBuildPasswdRequest(result,
                        requestId, { ...payload, backend }, result.title, result.description);
                    void requisitions.execute("requestPassword", passwordRequest);

                    break;
                }

                case "confirm": {
                    const accept = result.yes ?? "Yes";
                    const refuse = result.no ?? "No";
                    const alternative = result.alt;

                    // Need to pass on the possible reply values.
                    const replies = new Map<DialogResponseClosure, string>([
                        [DialogResponseClosure.Accept, accept],
                        [DialogResponseClosure.Decline, refuse],
                        [DialogResponseClosure.Alternative, alternative ?? ""],
                    ]);

                    const request: IDialogRequest = {
                        type: DialogType.Confirm,
                        title: result.title,
                        description: result.description,
                        id: "shellConfirm",
                        parameters: {
                            title: result.title,
                            prompt: result.prompt,
                            accept,
                            refuse,
                            alternative,
                            default: result.defaultValue,
                        },
                        data: { ...payload, requestId, backend, replies },
                    };
                    void requisitions.execute("showDialog", request);

                    break;
                }

                case "select": {
                    const request: IDialogRequest = {
                        type: DialogType.Select,
                        title: result.title,
                        description: result.description,
                        id: "shellSelect",
                        parameters: {
                            prompt: result.prompt,
                            default: result.defaultValue,
                            options: result.options,
                        },
                        data: { ...payload, requestId, backend },
                    };
                    void requisitions.execute("showDialog", request);

                    break;
                }

                // cspell: ignore filesave, fileopen
                case "text":
                case "directory":
                case "fileopen":
                case "filesave":
                default: {
                    const dialogRequest: IDialogRequest = {
                        type: DialogType.Prompt,
                        id: "shellText",
                        title: result.title,
                        description: result.description,
                        values: {
                            prompt: result.prompt,
                        },
                        data: { ...payload, requestId, backend },
                    };
                    void requisitions.execute("showDialog", dialogRequest);

                    break;
                }
            }

            return true;
        }

        return false;
    }

    // Must be public for the registration below. Switch to a static init block once we can use ES 2022.
    public static acceptPassword = (
        data: { request: IServicePasswordRequest; password: string }): Promise<boolean> => {
        return new Promise((resolve) => {
            const backend = data.request.payload?.backend as IPromptReplyBackend;
            if (backend) {
                backend.sendReply(data.request.requestId, ShellPromptResponseType.Ok, data.password)
                    .then(() => { resolve(true); })
                    .catch(() => { resolve(false); });
            } else {
                resolve(false);
            }
        });
    };

    public static cancelPassword = (request: IServicePasswordRequest): Promise<boolean> => {
        return new Promise((resolve) => {
            const backend = request.payload?.backend as IPromptReplyBackend;
            if (backend) {
                backend.sendReply(request.requestId, ShellPromptResponseType.Cancel, "")
                    .then(() => { resolve(true); })
                    .catch(() => { resolve(false); });
            } else {
                resolve(false);
            }
        });
    };

    public static handleDialogResponse = (response: IDialogResponse): Promise<boolean> => {
        if (response.id !== "shellConfirm" && response.id !== "shellSelect" && response.id !== "shellText") {
            return Promise.resolve(false);
        }

        return new Promise((resolve) => {
            const backend = response.data?.backend as IPromptReplyBackend;
            const requestId = response.data?.requestId as string;

            const sendReply = (type: ShellPromptResponseType, reply: string) => {
                backend.sendReply(requestId, type, reply)
                    .then(() => { resolve(true); })
                    .catch(() => { resolve(false); });
            };

            if (backend && requestId) {
                switch (response.type) {
                    case DialogType.Confirm: {
                        const replies = response.data?.replies as Map<DialogResponseClosure, string>;
                        if (replies) {
                            const reply = replies.get(response.closure);
                            if (!reply) { // Corresponds to DialogResponseClosure.Decline.
                                sendReply(ShellPromptResponseType.Cancel, "");
                            } else {
                                sendReply(ShellPromptResponseType.Ok, reply);
                            }
                        }

                        break;
                    }

                    case DialogType.Select: {
                        if (response.closure === DialogResponseClosure.Decline) {
                            sendReply(ShellPromptResponseType.Cancel, "");
                        } else {
                            const value = response.values?.input as string;
                            sendReply(ShellPromptResponseType.Ok, value);
                        }
                        break;
                    }

                    case DialogType.Prompt: {
                        if (response.closure === DialogResponseClosure.Decline) {
                            sendReply(ShellPromptResponseType.Cancel, "");
                        } else {
                            const value = response.values?.input as string;
                            sendReply(ShellPromptResponseType.Ok, value);
                        }
                        break;
                    }

                    default: {
                        resolve(false);

                        break;
                    }
                }
            } else {
                resolve(false);
            }
        });
    };

    private static splitAndBuildPasswdRequest = (request: IShellPasswordFeedbackRequest, requestId: string,
        payload: IDictionary, title?: string, description?: string[]): IServicePasswordRequest => {
        const passwordRequest: IServicePasswordRequest = {
            requestId,
            caption: title ?? "Open MySQL Connection",
            description,
            payload,
            service: "",
            user: "",
        };

        let parts = request.prompt.split("'");
        if (parts.length >= 3) {
            const parts2 = parts[1].split("@");
            passwordRequest.service = parts[1];
            passwordRequest.user = parts2[0];
        } else {
            parts = request.prompt.split("ssh://");
            if (parts.length >= 2) {
                passwordRequest.caption = title ?? "Open SSH tunnel in Shell Session";
                const parts2 = parts[1].split("@");
                passwordRequest.service = `ssh://${parts[1]}`.trim();
                if (passwordRequest.service.endsWith(":")) {
                    passwordRequest.service = passwordRequest.service.slice(0, -1);
                }
                passwordRequest.user = parts2[0];
            } else {
                passwordRequest.caption = request.prompt;
            }
        }

        return passwordRequest;
    };

    private static isShellPromptResult(response?: IShellResultType): response is IShellFeedbackRequest {
        const candidate = response as IShellFeedbackRequest;

        return candidate?.prompt !== undefined;
    }
}

requisitions.register("acceptPassword", ShellPromptHandler.acceptPassword);
requisitions.register("cancelPassword", ShellPromptHandler.cancelPassword);
requisitions.register("dialogResponse", ShellPromptHandler.handleDialogResponse);
