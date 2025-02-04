/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import { DataCallback, MessageScheduler } from "../../communication/MessageScheduler.js";
import { IPromptReplyBackend, ShellPromptResponseType, Protocol } from "../../communication/Protocol.js";
import { ShellAPIGui, IShellResultType } from "../../communication/ProtocolGui.js";
import { webSession } from "../WebSession.js";
import { ShellInterfaceMhs } from "./ShellInterfaceMhs.js";
import { ShellInterfaceMsm } from "./ShellInterfaceMsm.js";

export class ShellInterfaceShellSession implements IPromptReplyBackend {

    public mhs: ShellInterfaceMhs = new ShellInterfaceMhs();
    public msm: ShellInterfaceMsm = new ShellInterfaceMsm();

    private moduleSessionLookupId = "";

    /**
     * Creates a new instance of the shell interface.
     *
     * @param sessionId If given this specifies an existing shell session, so we don't get a startShellSession
     *                  call later.
     */
    public constructor(sessionId?: string) {
        if (sessionId) {
            this.moduleSessionLookupId = "shellSession.temporary";
            webSession.setModuleSessionId(this.moduleSessionLookupId, sessionId);
        }
    }

    /**
     * @returns A flag indicating whether a session was already opened or not.
     */
    public get hasSession(): boolean {
        return this.moduleSessionId !== undefined;
    }

    /**
     * Starts a new shell session
     *
     * @param id The id of the shell session tab.
     * @param dbConnectionId The id of the connection the shell tab should open.
     * @param shellArgs Additional arguments for the backend.
     * @param requestId An explicit request ID (instead of using the implicitly created one), to allow the caller
     *                  to associate the execution request and the various results.
     * @param callback The callback for intermediate results.
     *
     * @returns A promise resolving to an optional set of results which might require additional handling,
     *          like a shell prompt.
     */
    public async startShellSession(id: string, dbConnectionId?: number, shellArgs?: unknown[], requestId?: string,
        callback?: DataCallback<ShellAPIGui.GuiShellStartSession>): Promise<IShellResultType | undefined> {
        this.moduleSessionLookupId = `shellSession.${id}`;

        if (this.hasSession) {
            return undefined;
        }

        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiShellStartSession,
            requestId,
            parameters: {
                args: {
                    dbConnectionId,
                    shellArgs,
                },
            },
            onData: callback,
        });

        if (response.result?.moduleSessionId) {
            webSession.setModuleSessionId(this.moduleSessionLookupId, response.result.moduleSessionId);
        }

        return response.result;
    }

    /**
     * Closes the current session.
     *
     * @returns A promise which resolves when the request is finished.
     */
    public async closeShellSession(): Promise<void> {
        const moduleSessionId = this.moduleSessionId;
        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiShellCloseSession,
                parameters: {
                    args: {
                        moduleSessionId,
                    },
                },
            });

            webSession.setModuleSessionId(this.moduleSessionLookupId);
        }
    }

    /**
     * Sends the shell command to the backend for execution.
     *
     * @param command The shell command to execute.
     * @param requestId An explicit request ID (instead of using the implicitly created one), to allow the caller
     *                  to associate the execution request and the various results.
     * @param callback The callback for intermediate results.
     *
     * @returns A listener for the response.
     */
    public async execute(command: string, requestId?: string,
        callback?: DataCallback<ShellAPIGui.GuiShellExecute>): Promise<IShellResultType | undefined> {
        const moduleSessionId = this.moduleSessionId;
        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiShellExecute,
                requestId,
                parameters: {
                    args: {
                        command,
                        moduleSessionId,
                    },
                },
                caseConversionIgnores: ["rows"],
                onData: callback,
            });

            return response.result;
        }
    }

    /**
     * Sends a reply from the user back to the backend (e.g. passwords, choices etc.).
     *
     * @param requestId The same request ID that was used to request input from the user.
     * @param type Indicates if the user accepted the request or cancelled it.
     * @param reply The reply from the user.
     * @param moduleSessionId Use this to override the module session ID.
     *
     * @returns A listener for the response.
     */
    public async sendReply(requestId: string, type: ShellPromptResponseType, reply: string,
        moduleSessionId?: string): Promise<void> {
        moduleSessionId = moduleSessionId ?? this.moduleSessionId;
        if (moduleSessionId) {
            await MessageScheduler.get.sendRequest({
                requestType: Protocol.PromptReply,
                parameters: { moduleSessionId, requestId, type, reply },
            }, false);
        }
    }

    /**
     * Retrieves possible completion items for the given position in the text.
     *
     * @param text The editor content.
     * @param offset The offset within that content.
     *
     * @returns A listener for the response.
     */
    public async getCompletionItems(text: string,
        offset: number): Promise<Array<{ offset?: number; options?: string[]; }>> {
        const moduleSessionId = this.moduleSessionId;
        if (moduleSessionId) {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiShellComplete,
                parameters: {
                    args: {
                        data: text,
                        offset,
                        moduleSessionId,
                    },
                },
            });

            const result: Array<{ offset: number; options: string[]; }> = [];
            response.forEach((list) => {
                if (list.result) {
                    result.push(list.result);
                }
            });

            return result;
        }

        return [];
    }

    private get moduleSessionId(): string | undefined {
        return webSession.moduleSessionId(this.moduleSessionLookupId);
    }
}
