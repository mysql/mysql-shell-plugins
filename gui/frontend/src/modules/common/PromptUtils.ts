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

import { IServicePasswordRequest } from "../../app-logic/Types";
import {
    IOpenConnectionData, IOpenMdsConnectionData, IShellFeedbackRequest, IShellResultType, ShellPromptResponseType,
} from "../../communication";
import { IDialogSection, IDialogValues, ValueEditDialog } from "../../components/Dialogs";
import { requisitions } from "../../supplement/Requisitions";
import { ShellInterfaceShellSession, ShellInterfaceSqlEditor } from "../../supplement/ShellInterface";
import { stripAnsiCode } from "../../utilities/helpers";

export interface IPromptData {
    requestId: string;
    backend: ShellInterfaceSqlEditor;
}

export class PromptUtils {

    public static isShellMdsPromptResult(response?: IOpenConnectionData): response is IOpenMdsConnectionData {
        const candidate = response as IOpenMdsConnectionData;

        return candidate?.result?.prompt !== undefined;
    }

    public static isShellPromptResult(response?: IShellResultType): response is IShellFeedbackRequest {
        const candidate = response as IShellFeedbackRequest;

        return candidate?.prompt !== undefined;
    }

    public static isShellPasswordResult(response?: IShellResultType): response is IShellFeedbackRequest {
        const candidate = response as IShellFeedbackRequest;

        return candidate?.password !== undefined;
    }

    public static splitAndBuildPasswdRequest = (result: IShellResultType, requestId: string,
        payload: ShellInterfaceSqlEditor | ShellInterfaceShellSession): IServicePasswordRequest => {
        const feedbackRequest = result as IShellFeedbackRequest;
        let passwordRequest: IServicePasswordRequest = { requestId, caption: "" };
        if (feedbackRequest !== undefined && feedbackRequest.password !== undefined) {
            passwordRequest = {
                requestId,
                caption: "Open MySQL Connection in Shell Session",
                payload,
                service: "",
                user: "",
            };
            let parts = feedbackRequest.password.split("'");
            if (parts.length >= 3) {
                const parts2 = parts[1].split("@");
                passwordRequest.service = parts[1];
                passwordRequest.user = parts2[0];
            } else {
                parts = feedbackRequest.password.split("ssh://");
                if (parts.length >= 2) {
                    passwordRequest.caption = "Open SSH tunnel in Shell Session";
                    const parts2 = parts[1].split("@");
                    passwordRequest.service = `ssh://${parts[1]}`.trim();
                    if (passwordRequest.service.endsWith(":")) {
                        passwordRequest.service = passwordRequest.service.slice(0, -1);
                    }
                    passwordRequest.user = parts2[0];
                } else {
                    passwordRequest.caption = feedbackRequest.password;
                }
            }
        }

        return passwordRequest;
    };

    public static showBackendPromptDialog = (promptDialogRef: React.RefObject<ValueEditDialog>, text: string,
        requestId: string, backend: ShellInterfaceSqlEditor | ShellInterfaceShellSession): void => {
        if (promptDialogRef.current) {
            const prompt = stripAnsiCode(text);
            const promptSection: IDialogSection = {
                values: {
                    input: {
                        caption: prompt,
                        value: "",
                        span: 8,
                    },
                },
            };
            promptDialogRef.current.show(
                {
                    id: "shellPrompt",
                    sections: new Map<string, IDialogSection>([
                        ["prompt", promptSection],
                    ]),
                },
                [],
                { backgroundOpacity: 0.1 },
                "",
                prompt,
                { backend, requestId },
            );
        }
    };

    public static handleClosePromptDialog = (accepted: boolean, values: IDialogValues, payload?: unknown): void => {
        const data = payload as IPromptData;
        if (accepted) {
            const promptSection = values.sections.get("prompt");
            if (promptSection) {
                const entry = promptSection.values.input;
                data.backend.sendReply(data.requestId, ShellPromptResponseType.Ok, entry.value as string);
            }
        } else {
            data.backend.sendReply(data.requestId, ShellPromptResponseType.Cancel, "");
        }
    };

    public static acceptPassword = (data: { request: IServicePasswordRequest; password: string }): Promise<boolean> => {
        return new Promise((resolve) => {
            const backend = data.request.payload as ShellInterfaceSqlEditor;
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
            const backend = request.payload as ShellInterfaceSqlEditor;
            if (backend) {
                backend.sendReply(request.requestId, ShellPromptResponseType.Cancel, "")
                    .then(() => { resolve(true); })
                    .catch(() => { resolve(false); });
            } else {
                resolve(false);
            }
        });
    };
}

requisitions.register("acceptPassword", PromptUtils.acceptPassword);
requisitions.register("cancelPassword", PromptUtils.cancelPassword);

