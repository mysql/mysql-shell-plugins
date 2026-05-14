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

import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectionTags, connectionTagsChangedKey } from "../../../../modules/db-editor/ConnectionTags.js";
import { Settings } from "../../../../supplement/Settings/Settings.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { webSession } from "../../../../supplement/WebSession.js";

describe("ConnectionTags", (): void => {
    const resetConnectionTags = (): void => {
        Reflect.set(ConnectionTags, "loaded", false);
        Reflect.set(ConnectionTags, "definitions", {});
        Reflect.set(ConnectionTags, "pendingStore", Promise.resolve());
    };

    afterEach(() => {
        resetConnectionTags();
        vi.restoreAllMocks();
    });

    it("loads tag definitions from the connection registry", async () => {
        const tags = { DEV: "#c2410c" };
        const listConnectionTagsSpy = vi.spyOn(ShellInterface.dbConnections, "listConnectionTags")
            .mockResolvedValue(tags);

        const result = await ConnectionTags.load();

        expect(result).toEqual(tags);
        expect(listConnectionTagsSpy).toHaveBeenCalledWith(webSession.currentProfileId);
    });

    it("migrates legacy profile settings into the connection registry", async () => {
        const legacyTags = { DEV: "#c2410c" };
        vi.spyOn(ShellInterface.dbConnections, "listConnectionTags").mockResolvedValue({});
        const updateConnectionTagsSpy = vi.spyOn(ShellInterface.dbConnections, "updateConnectionTags")
            .mockResolvedValue();
        vi.spyOn(Settings, "get").mockImplementation((key: string, defaultValue?: unknown) => {
            return key === connectionTagsChangedKey ? legacyTags : defaultValue;
        });
        vi.spyOn(Settings, "set");
        vi.spyOn(Settings, "saveSettings").mockImplementation(() => { /** No-op. */ });

        const result = await ConnectionTags.load();

        expect(result).toEqual(legacyTags);
        expect(updateConnectionTagsSpy).toHaveBeenCalledWith(webSession.currentProfileId, legacyTags);
    });

    it("stores tag definitions in the connection registry", async () => {
        const tags = { DEV: "#c2410c" };
        const updateConnectionTagsSpy = vi.spyOn(ShellInterface.dbConnections, "updateConnectionTags")
            .mockResolvedValue();

        await ConnectionTags.set(tags);

        expect(updateConnectionTagsSpy).toHaveBeenCalledWith(webSession.currentProfileId, tags);
    });

    it("updates the cached definitions from a settings event", () => {
        ConnectionTags.updateCache({ OLD: "#c2410c" });
        ConnectionTags.updateCache({ DEV: " #c2410c ", " ": "#1d4ed8", QA: 42 });

        expect(ConnectionTags.getCached()).toEqual({ DEV: "#c2410c" });
    });
});
