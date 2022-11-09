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

import { requisitions } from "../../../frontend/src/supplement/Requisitions";

import { ShellModuleId } from "../../../frontend/src/modules/ModuleInfo";

import { IShellSessionDetails } from "../../../frontend/src/supplement/ShellInterface";
import { WebviewProvider } from "./WebviewProvider";

export class ShellConsoleViewProvider extends WebviewProvider {

    private openSessions: IShellSessionDetails[] = [];

    public constructor(
        url: URL,
        onDispose: (view: WebviewProvider) => void) {
        super(url, onDispose);
    }

    /**
     * Shows the given module page.
     *
     * @param caption A caption for the webview tab in which the page is hosted.
     * @param page The page to show.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public show(caption: string, page: string): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: ShellModuleId },
            { requestType: "showPage", parameter: { module: ShellModuleId, page } },
        ], caption, "newShellConsole");
    }

    /**
     * Opens a page for a session with the given session id.
     *
     * @param caption A caption for the webview tab in which the page is hosted.
     * @param session The session to open.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public openSession(caption: string, session: IShellSessionDetails): Promise<boolean> {
        const command = session.sessionId === -1 ? "newSession" : "openSession";

        return this.runCommand("job", [
            { requestType: "showModule", parameter: ShellModuleId },
            { requestType: command, parameter: session },
        ], caption, "newShellConsole");
    }

    /**
     * Closes the session with the given id.
     *
     * @param caption A caption for the webview tab in which the page is hosted.
     * @param session The session to remove.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public removeSession(caption: string, session: IShellSessionDetails): Promise<boolean> {
        return this.runCommand("removeSession", session, caption, "newShellConsole");
    }

    protected requisitionsCreated(): void {
        super.requisitionsCreated();

        if (this.requisitions) {
            this.requisitions.register("sessionAdded", this.sessionAdded);
            this.requisitions.register("sessionRemoved", this.sessionRemoved);
        }
    }

    protected sessionAdded = (session: IShellSessionDetails): Promise<boolean> => {
        this.openSessions.push(session);

        return requisitions.execute("refreshSessions", this.openSessions);
    };

    protected sessionRemoved = (session: IShellSessionDetails): Promise<boolean> => {
        const index = this.openSessions.findIndex((candidate) => {
            return candidate.sessionId === session.sessionId;
        });

        if (index > -1) {
            this.openSessions.splice(index, 1);
        }

        return requisitions.execute("refreshSessions", this.openSessions);
    };

    protected handleDispose(): void {
        super.handleDispose();

        this.openSessions = [];
        void requisitions.execute("refreshSessions", []);
    }
}
