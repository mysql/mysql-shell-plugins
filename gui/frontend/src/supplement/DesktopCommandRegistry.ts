/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import type { IEmbeddedMessage } from "../communication/index.js";
import { hasElectronHostBridge } from "./ElectronDesktop.js";

export type DesktopCommandId =
    "app.about" |
    "app.preferences" |
    "app.resetRememberedUiState" |
    "desktop.newScriptTab" |
    "desktop.newNotebookTab" |
    "dev.toggleDebugger" |
    "edit.previousCommand" |
    "edit.nextCommand" |
    "edit.reformat" |
    "file.open" |
    "file.save" |
    "file.saveAs" |
    "file.closeDocument" |
    "file.close" |
    "run.execute" |
    "run.executeCurrent" |
    "run.executeAsText" |
    "run.explain" |
    "run.explainAnalyze" |
    "run.visualExplain" |
    "run.visualExplainAnalyze" |
    "run.stop" |
    "run.stopOnError" |
    "run.autoCommit" |
    "database.admin.serverStatus" |
    "database.admin.clientConnections" |
    "database.admin.userAccounts" |
    "database.admin.performanceDashboard" |
    "database.admin.enterpriseBackup" |
    "database.admin.lakehouseNavigator" |
    "database.mrs.configure" |
    "database.mrs.browseDocs" |
    "view.find" |
    "view.toggleSidebar" |
    "view.showConnectionInfo" |
    "view.schemas.showSystemSchemas" |
    "view.showHiddenCharacters" |
    "view.softWrap";

export interface IDesktopCommandDescriptor {
    id: DesktopCommandId;
    label: string;
    enabled: boolean;
    checked?: boolean;
    accelerator?: string;
}

export interface IDesktopCommandProvider {
    getCommands: () => IDesktopCommandDescriptor[];
    execute: (id: DesktopCommandId) => Promise<boolean>;
}

class DesktopCommandRegistry {
    private providers = new Set<IDesktopCommandProvider>();

    public registerProvider(provider: IDesktopCommandProvider): void {
        this.providers.add(provider);
        this.notifyHostStateChanged();
    }

    public unregisterProvider(provider: IDesktopCommandProvider): void {
        this.providers.delete(provider);
        this.notifyHostStateChanged();
    }

    public getState(): IDesktopCommandDescriptor[] {
        const commands = new Map<DesktopCommandId, IDesktopCommandDescriptor>();

        this.providers.forEach((provider) => {
            provider.getCommands().forEach((command) => {
                commands.set(command.id, command);
            });
        });

        return Array.from(commands.values());
    }

    public async execute(id: DesktopCommandId): Promise<boolean> {
        for (const provider of this.providers) {
            if (await provider.execute(id)) {
                this.notifyHostStateChanged();

                return true;
            }
        }

        this.notifyHostStateChanged();

        return false;
    }

    public notifyHostStateChanged(): void {
        if (!hasElectronHostBridge()) {
            return;
        }

        const message: IEmbeddedMessage = {
            source: "app",
            command: "desktopCommandStateChanged",
            data: {
                commands: this.getState(),
            },
        };

        window.electronHost!.postMessage(message);
    }
}

export const desktopCommandRegistry = new DesktopCommandRegistry();
