/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import { MessageScheduler } from "../communication/MessageScheduler.js";
import { ShellPromptResponseType } from "../communication/Protocol.js";
import {
    IShellResultType, ShellAPIGui, IShellFeedbackRequest, IShellSimpleResult,
} from "../communication/ProtocolGui.js";
import { ShellInterfaceShellSession } from "../supplement/ShellInterface/ShellInterfaceShellSession.js";
import { uuid } from "../utilities/helpers.js";

export type ShellTaskStatusType = "pending" | "running" | "done" | "error";

type PromptCallback = (text: string, isPassword: boolean) => Promise<string | undefined>;
export type StatusCallback = (status: ShellTaskStatusType) => void;
type MessageCallback = (message: string) => void;

export class ShellTask {

    private currentStatus: ShellTaskStatusType;
    private statusCallback?: StatusCallback;
    private currentProgress?: number;

    public constructor(
        public readonly caption: string,
        private promptCallback: PromptCallback,
        private messageCallback: MessageCallback) {
        this.currentStatus = "pending";
    }

    public get status(): ShellTaskStatusType {
        return this.currentStatus;
    }

    public get percentageDone(): number | undefined {
        return this.currentProgress;
    }

    public static getCurrentTimeStamp(): string {
        return new Date().toISOString().replace("T", " ").slice(0, -1);
    }

    public setStatusCallback(callback: StatusCallback): void {
        this.statusCallback = callback;
    }

    public async runTask(shellArgs: string[], dbConnectionId?: number, responses?: string[]): Promise<void> {
        this.setStatus("running");
        this.sendMessage(`[${ShellTask.getCurrentTimeStamp()}] [INFO] Starting Task: ${this.caption}\n\n`);

        const requestId = uuid();
        let shellSession: ShellInterfaceShellSession | undefined;
        let responseIndex = 0;

        const handleData = (data: IShellResultType & { moduleSessionId?: string; }, final: boolean) => {
            if (data.moduleSessionId) {
                shellSession = new ShellInterfaceShellSession(data.moduleSessionId);
            }

            if (this.isShellFeedbackRequest(data) && shellSession) {
                if (responses && responseIndex < responses.length) {
                    // If a list of responses were given, return them
                    void shellSession.sendReply(requestId, ShellPromptResponseType.Ok, responses[responseIndex++]);
                } else {
                    // Pass the input request to the user
                    void this.promptCallback(data.prompt, data.type === "password").then((value) => {
                        if (shellSession) {
                            if (value) {
                                void shellSession.sendReply(requestId, ShellPromptResponseType.Ok, value);
                            } else {
                                void shellSession.sendReply(requestId, ShellPromptResponseType.Cancel, "");
                            }
                        }
                    });
                }
            } else if (this.isShellSimpleResult(data)) {
                // Extract the "{percentage}% completed" to indicate the progress
                if (data.info && this.statusCallback !== undefined) {
                    const group = Array.from(data.info.matchAll(/(\d+)%\scompleted/gm), (m) => { return m[1]; });
                    if (group.length > 0) {
                        const percentage = parseInt(group[0], 10);
                        if (!isNaN(percentage) && this.currentProgress !== percentage) {
                            this.currentProgress = percentage;
                            this.statusCallback(this.currentStatus);
                        }
                    }
                }
                this.sendMessage(data.info ?? data.status);
            }

            if (final) {
                this.setStatus("done");
                this.sendMessage(`\n[${ShellTask.getCurrentTimeStamp()}] [INFO] ` +
                    `Task '${this.caption}' completed successfully.\n\n`);

                if (shellSession) {
                    void shellSession.closeShellSession();
                }
            }
        };

        try {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiShellStartSession,
                requestId,
                parameters: {
                    args: {
                        dbConnectionId,
                        shellArgs,
                    },
                },
                onData: (data) => {
                    if (data.result) {
                        handleData(data.result, false);
                    }
                },
            });

            if (response.result) {
                handleData(response.result, true);
            }
        } catch (reason) {
            this.currentStatus = "error";
            this.sendMessage(`[${ShellTask.getCurrentTimeStamp()}] [ERROR]: ${String(reason)}\n\n`);

            if (shellSession) {
                void shellSession.closeShellSession();
            }
        }
    }

    private setStatus(status: ShellTaskStatusType): void {
        this.currentStatus = status;
        this.statusCallback?.(status);
    }

    private sendMessage(message?: string): void {
        if (message) {
            this.messageCallback(message);
        }
    }

    private isShellFeedbackRequest(response: IShellResultType): response is IShellFeedbackRequest {
        return (response as IShellFeedbackRequest).type !== undefined;
    }

    private isShellSimpleResult(response: IShellResultType): response is IShellSimpleResult {
        const candidate = response as IShellSimpleResult;

        return candidate.info !== undefined || candidate.error !== undefined || candidate.note !== undefined ||
            candidate.promptDescriptor !== undefined || candidate.status !== undefined
            || candidate.warning !== undefined;
    }

}
