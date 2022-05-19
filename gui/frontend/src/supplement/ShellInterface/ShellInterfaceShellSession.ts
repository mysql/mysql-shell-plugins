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

import { EventType, ListenerEntry } from "../Dispatch";
import {
    ProtocolGui, currentConnection, ICommErrorEvent, ICommStartSessionEvent, ShellPromptResponseType,
    IPromptReplyBackend,
} from "../../communication";
import { webSession } from "../WebSession";
import { IShellInterface } from ".";
import { ShellInterfaceMds } from "./ShellInterfaceMds";

export class ShellInterfaceShellSession implements IShellInterface, IPromptReplyBackend {

    public readonly id = "shellSession";

    public mds: ShellInterfaceMds = new ShellInterfaceMds();

    private moduleSessionLookupId = "";

    /**
     * Creates a new instance of the shell interface.
     *
     * @param sessionId If given this specifies an existing shell session, so we don't get a startShellSession
     *                  call later.
     */
    public constructor(sessionId?: string) {
        if (sessionId) {
            this.moduleSessionLookupId = this.id + ".temporary";
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
     *
     * @returns A listener for the response.
     */
    public startShellSession(id: string, dbConnectionId?: number): ListenerEntry {
        this.moduleSessionLookupId = this.id + "." + id;

        if (this.hasSession) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestShellStartSession(dbConnectionId);
        const listener = currentConnection.sendRequest(request, { messageClass: "startShellModuleSession" });

        listener.then((event: ICommStartSessionEvent) => {
            if (event.data && event.eventType === EventType.DataResponse && event.data.moduleSessionId) {
                webSession.setModuleSessionId(this.moduleSessionLookupId, event.data.moduleSessionId);
            }
        }).catch(() => {
            // Ignore errors here. They must be handled by the caller of this method.
        });

        return listener;
    }

    /**
     * Closes the current session.
     *
     * @returns A listener for the response.
     */
    public closeShellSession(): ListenerEntry {
        const sessionId = this.moduleSessionId;
        if (sessionId) {
            const request = ProtocolGui.getRequestShellCloseSession(sessionId);
            const listener = currentConnection.sendRequest(request, { messageClass: "closeModuleSession" });

            listener.then(() => {
                webSession.setModuleSessionId(this.moduleSessionLookupId);
            }).catch((event: ICommErrorEvent) => {
                throw new Error(event.message);
            });

            return listener;
        }

        return ListenerEntry.resolve();
    }

    /**
     * Sends the shell command to the backend for execution.
     *
     * @param command The shell command to execute.
     *
     * @returns A listener for the response.
     */
    public execute(command: string): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestShellExecute(command, id);

        return currentConnection.sendRequest(request, { messageClass: "execute" });
    }

    /**
     * Sends a reply from the user back to the backend (e.g. passwords, choices etc.).
     *
     * @param requestId The same request ID that was used to request input from the user.
     * @param type Indicates if the user accepted the request or cancelled it.
     * @param reply The reply from the user.
     *
     * @returns A listener for the response.
     */
    public sendReply(requestId: string, type: ShellPromptResponseType, reply: string): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestPromptReply(requestId, type, reply, id);

        return currentConnection.sendRequest(request, { messageClass: "sendReply" });
    }

    /**
     * Retrieves possible completion items for the given position in the text.
     *
     * @param text The editor content.
     * @param offset The offset within that content.
     *
     * @returns A listener for the response.
     */
    public getCompletionItems(text: string, offset: number): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestShellComplete(text, offset, id);

        return currentConnection.sendRequest(request, { messageClass: "getCompletionItems" });
    }

    private get moduleSessionId(): string | undefined {
        return webSession.moduleSessionId(this.moduleSessionLookupId);
    }
}
