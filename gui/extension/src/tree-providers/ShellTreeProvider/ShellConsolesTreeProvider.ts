/*
 * Copyright (c) 2021, Oracle and/or its affiliates.
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

import { TreeDataProvider, TreeItem, EventEmitter, ProviderResult, Event } from "vscode";

import { requisitions } from "../../../../frontend/src/supplement/Requisitions";

import { IShellSessionDetails } from "../../../../frontend/src/supplement/ShellInterface";
import { ShellConsoleSessionTreeItem } from "./ShellConsoleSessionTreeItem";

// A class to provide the shell console tree structure.
export class ShellConsolesTreeDataProvider implements TreeDataProvider<TreeItem> {
    private changeEvent = new EventEmitter<void>();

    private sessions: IShellSessionDetails[] = [];

    public constructor() {
        requisitions.register("refreshSessions", this.refreshSessions);
    }

    public dispose(): void {
        requisitions.unregister("refreshSessions", this.refreshSessions);
    }

    public get onDidChangeTreeData(): Event<void> {
        return this.changeEvent.event;
    }

    public refresh(sessions: IShellSessionDetails[]): void {
        this.sessions = sessions;

        this.changeEvent.fire();
    }

    public getTreeItem(element: TreeItem): TreeItem {
        return element;
    }

    public getChildren(element?: TreeItem): ProviderResult<TreeItem[]> {
        if (!element) {
            return this.sessions.map((details) => {
                return new ShellConsoleSessionTreeItem(details, {
                    title: "Open Shell GUI Console",
                    command: "msg.openSession",
                    arguments: [details],
                });
            });
        }

        return Promise.resolve([]);
    }

    private refreshSessions = (sessions: IShellSessionDetails[]): Promise<boolean> => {
        this.refresh(sessions);

        return Promise.resolve(true);
    };
}
