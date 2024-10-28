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

import { requisitions } from "../../../frontend/src/supplement/Requisitions.js";
import { DBEditorModuleId } from "../../../frontend/src/modules/ModuleInfo.js";
import { IShellSessionDetails } from "../../../frontend/src/supplement/ShellInterface/index.js";
import { WebviewProvider } from "./WebviewProvider.js";

export class ShellConsoleViewProvider extends WebviewProvider {

    private openSessions: IShellSessionDetails[] = [];

    public constructor(url: URL, onDispose: (view: WebviewProvider) => void) {
        super(url, onDispose);
    }

    /**
     * Shows the given module page.
     *
     * @param page The page to show.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public show(page: string): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page } },
        ], "newShellConsole");
    }

    protected override requisitionsCreated(): void {
        super.requisitionsCreated();

        if (this.requisitions) {
            this.requisitions.register("sessionAdded", this.sessionAdded);
            this.requisitions.register("sessionRemoved", this.sessionRemoved);
        }
    }

    protected sessionAdded = (session: IShellSessionDetails): Promise<boolean> => {
        this.openSessions.push(session);

        return requisitions.execute("proxyRequest", {
            provider: this,
            original: {
                requestType: "refreshSessions",
                parameter: this.openSessions,
            },
        });
    };

    protected sessionRemoved = (session: IShellSessionDetails): Promise<boolean> => {
        const index = this.openSessions.findIndex((candidate) => {
            return candidate.sessionId === session.sessionId;
        });

        if (index > -1) {
            this.openSessions.splice(index, 1);
        }

        return requisitions.execute("proxyRequest", {
            provider: this,
            original: {
                requestType: "refreshSessions",
                parameter: this.openSessions,
            },
        });
    };

    protected override handleDispose(): void {
        super.handleDispose();

        this.openSessions = [];

        void requisitions.execute("proxyRequest", {
            provider: this,
            original: {
                requestType: "refreshSessions",
                parameter: [],
            },
        });
    }
}
