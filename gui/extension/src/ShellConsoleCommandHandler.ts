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

import { commands, ExtensionContext } from "vscode";

import { requisitions } from "../../frontend/src/supplement/Requisitions";
import { IShellSessionDetails } from "../../frontend/src/supplement/ShellInterface";
import { ConnectionTreeItem } from "./tree-providers/ConnectionsTreeProvider/ConnectionTreeItem";
import { ShellConsoleSessionTreeItem } from "./tree-providers/ShellTreeProvider/ShellConsoleSessionTreeItem";

import { ShellConsoleViewProvider } from "./web-views/ShellConsoleViewProvider";

export class ShellConsoleCommandHandler {
    private providers: ShellConsoleViewProvider[] = [];
    private url?: URL;

    public setup(context: ExtensionContext): void {
        requisitions.register("connectedToUrl", this.connectedToUrl);

        context.subscriptions.push(commands.registerCommand("msg.openSessionBrowser", () => {
            const provider = this.currentProvider;
            void provider?.show("MySQL Shell Consoles", "sessions");
        }));

        context.subscriptions.push(commands.registerCommand("msg.newSession", () => {
            const provider = this.currentProvider;
            void provider?.openSession("MySQL Shell Consoles", { sessionId: -1 });
        }));

        context.subscriptions.push(commands.registerCommand("msg.openSession", (details: IShellSessionDetails) => {
            const provider = this.currentProvider;
            void provider?.openSession("MySQL Shell Consoles", details);
        }));

        context.subscriptions.push(commands.registerCommand("msg.newSessionUsingConnection",
            (item: ConnectionTreeItem) => {
                const provider = this.currentProvider;
                const details: IShellSessionDetails = {
                    sessionId: -1,
                    caption: `Session to ${item.entry.details.caption}`,
                    dbConnectionId: item.entry.details.id,
                };
                void provider?.openSession("MySQL Shell Consoles", details);
            }));

        context.subscriptions.push(commands.registerCommand("msg.removeSession",
            (item: ShellConsoleSessionTreeItem) => {
                const provider = this.currentProvider;
                void provider?.removeSession("MySQL Shell Consoles", item.details);
            }));

    }

    public closeProviders(): void {
        this.providers.forEach((provider) => {
            provider.close();
        });
        this.providers = [];
    }

    private get currentProvider(): ShellConsoleViewProvider | undefined {
        if (this.providers.length > 0) {
            return this.providers[this.providers.length - 1];
        } else if (this.url) {
            const provider = new ShellConsoleViewProvider(this.url, (view) => {
                const index = this.providers.findIndex((candidate) => { return candidate === view; });
                if (index > -1) {
                    this.providers.splice(index, 1);
                }
            });

            this.providers.push(provider);

            return provider;
        }

        return undefined;
    }

    private connectedToUrl = (url?: URL): Promise<boolean> => {
        this.url = url;
        this.closeProviders();

        return Promise.resolve(true);
    };
}
