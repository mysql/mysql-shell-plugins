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
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import type { IDictionary } from "../../app-logic/general-types.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import { webSession } from "../../supplement/WebSession.js";

export const connectionTagsChangedKey = "dbEditor.connectionBadges";

export class ConnectionTags {
    private static loaded = false;
    private static definitions: Record<string, string> = {};
    private static pendingStore: Promise<void> = Promise.resolve();

    public static async load(): Promise<Record<string, string>> {
        if (this.loaded) {
            return this.definitions;
        }

        this.definitions = this.sanitize(
            await ShellInterface.dbConnections.listConnectionTags(webSession.currentProfileId),
        );

        if (Object.keys(this.definitions).length === 0) {
            this.definitions = this.sanitize(Settings.get<IDictionary>(connectionTagsChangedKey, {}));
            if (Object.keys(this.definitions).length > 0) {
                await this.storeDefinitions();
            }
        }

        this.loaded = true;

        return this.definitions;
    }

    public static getCached(): Record<string, string> {
        if (!this.loaded) {
            this.definitions = this.sanitize(Settings.get<IDictionary>(connectionTagsChangedKey, {}));
        }

        return this.definitions;
    }

    public static updateCache(definitions: unknown): void {
        this.definitions = this.sanitize(definitions);
        this.loaded = true;
    }

    public static async set(definitions: IDictionary): Promise<void> {
        this.updateCache(definitions);

        await this.storeDefinitions();

        void requisitions.execute("settingsChanged", { key: connectionTagsChangedKey, value: this.definitions });
        void requisitions.executeRemote("settingsChanged", { key: connectionTagsChangedKey, value: this.definitions });
    }

    public static foreground(color: string): string {
        const neonColors = [
            "#ff2d55", "#ff9f0a", "#ffd60a", "#32d74b",
            "#c7c7c7", "#0a84ff", "#bf5af2", "#ff4fd8",
        ];

        return neonColors.includes(color.toLocaleLowerCase()) ? "#303030" : "#ffffff";
    }

    private static sanitize(definitions: unknown): Record<string, string> {
        if (!definitions || typeof definitions !== "object" || Array.isArray(definitions)) {
            return {};
        }

        return Object.fromEntries(Object.entries(definitions)
            .filter(([text, color]) => {
                return text.trim().length > 0 && typeof color === "string" && color.trim().length > 0;
            })
            .map(([text, color]) => {
                return [text.trim(), (color as string).trim()];
            }));
    }

    private static clearLegacySettings(): void {
        if (Object.keys(Settings.get<IDictionary>(connectionTagsChangedKey, {})).length > 0) {
            Settings.set(connectionTagsChangedKey, {});
            Settings.saveSettings(true);
        }
    }

    private static async storeDefinitions(): Promise<void> {
        const definitions = { ...this.definitions };
        const store = this.pendingStore.catch(() => {
            // Keep later saves flowing even if an earlier backend request failed.
        }).then(async () => {
            await ShellInterface.dbConnections.updateConnectionTags(webSession.currentProfileId, definitions);
            this.clearLegacySettings();
        });

        this.pendingStore = store;

        await store;
    }
}
