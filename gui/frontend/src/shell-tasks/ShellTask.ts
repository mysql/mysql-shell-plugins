/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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
import { IDictionary } from "../app-logic/Types";
import {
    ICommShellEvent, ICommStartSessionEvent, IShellFeedbackRequest, IShellResultType, MessageScheduler, ProtocolGui,
    ShellPromptResponseType,
} from "../communication";
import { EventType } from "../supplement/Dispatch";
import { ShellInterfaceShellSession } from "../supplement/ShellInterface";

export type ShellTaskStatusType = "pending" | "running" | "done" | "error";

export type PromptCallback = (text: string, isPassword: boolean) => Promise<string | undefined>;
export type StatusCallback = (status: ShellTaskStatusType) => void;
export type MessageCallback = (message: string) => void;

export class ShellTask {

    private shellSession: ShellInterfaceShellSession;
    private currentStatus: ShellTaskStatusType;
    private statusCallback?: StatusCallback;
    private shellResult: unknown;

    public constructor(
        public readonly caption: string,
        private promptCallback: PromptCallback,
        private messageCallback: MessageCallback) {
        this.currentStatus = "pending";
    }

    public get status(): ShellTaskStatusType {
        return this.currentStatus;
    }

    public static getCurrentTimeStamp(): string {
        return new Date().toISOString().replace("T", " ").slice(0, -1);
    }

    public setStatusCallback(callback: StatusCallback): void {
        this.statusCallback = callback;
    }

    public runTask(shellArgs: string[], dbConnectionId?: number): Promise<unknown> {
        return new Promise((resolve) => {
            this.setStatus("running");

            this.sendMessage(`[${ShellTask.getCurrentTimeStamp()}] [INFO] Starting Task: ${this.caption}\n\n`);

            const request = ProtocolGui.getRequestShellStartSession(dbConnectionId, shellArgs);

            MessageScheduler.get.sendRequest(request, { messageClass: "executeShellCommand" })
                .then((event: ICommStartSessionEvent | ICommShellEvent) => {
                    if (!event.data) {
                        return;
                    }

                    const requestId = event.data.requestId!;
                    const result = event.data.result as IDictionary | undefined;
                    if (result?.info) {
                        this.sendMessage(result.info as string);
                    } else if (result?.status) {
                        this.sendMessage(result.status as string);
                    } else if (result && Object.keys(result).length !== 0
                        && !(this.isShellPromptResult(event.data.result as IShellResultType))
                        && event.eventType === EventType.DataResponse) {
                        this.shellResult = result;
                    }

                    if (result?.moduleSessionId) {
                        this.shellSession = new ShellInterfaceShellSession(result.moduleSessionId as string);
                    } else if (result) {
                        if (this.isShellPromptResult(result as IShellResultType)) {
                            void this.promptCallback(result.prompt as string, !isNil(result.password)).then((value) => {
                                if (this.shellSession) {
                                    if (!isNil(value)) {
                                        this.shellSession.sendReply(requestId, ShellPromptResponseType.Ok, value);
                                    } else {
                                        this.shellSession.sendReply(requestId, ShellPromptResponseType.Cancel, "");
                                    }
                                }
                            });
                        }
                    }

                    if (event.eventType === EventType.FinalResponse) {
                        this.setStatus("done");
                        this.sendMessage(`\n[${ShellTask.getCurrentTimeStamp()}] [INFO] ` +
                            `Task '${this.caption}' completed successfully.\n\n`);
                        resolve(this.shellResult);
                    } else if (event.eventType === EventType.ErrorResponse) {
                        this.currentStatus = "error";
                        this.sendMessage(`[${ShellTask.getCurrentTimeStamp()}] [ERROR]:` +
                            `${event.data.result as string}\n\n`);
                        resolve(undefined);
                    }
                }).catch((event) => {
                    this.currentStatus = "error";
                    this.sendMessage(`[${ShellTask.getCurrentTimeStamp()}] [ERROR]:` +
                        `${event.message as string} (${event.data.result?.exitStatus as number})\n\n`);
                    resolve(undefined);
                });
        });
    }

    private setStatus(status: ShellTaskStatusType): void {
        this.currentStatus = status;
        this.statusCallback?.(status);
    }

    private sendMessage(message: string): void {
        this.messageCallback(message);
    }

    private isShellPromptResult(response: IShellResultType): response is IShellFeedbackRequest {
        const candidate = response as IShellFeedbackRequest;

        return candidate.prompt !== undefined;
    }

}
