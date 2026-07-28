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

import { ui } from "../../../../app-logic/UILayer.js";
import type { ConnectionDataModel } from "../../../../data-models/ConnectionDataModel.js";
import { ConnectionProcessor } from "../../../../modules/common/ConnectionProcessor.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { webSession } from "../../../../supplement/WebSession.js";

describe("ConnectionProcessor Workbench import", (): void => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("delegates XML once, reloads connections, and reports backend counts", async () => {
        const report = {
            phase: "workbenchConnections" as const,
            imported: 2,
            merged: 1,
            skipped: 3,
            warnings: [],
            failed: [],
        };
        const importConnections = vi.spyOn(
            ShellInterface.dbConnections,
            "importWorkbenchConnections",
        ).mockResolvedValue(report);
        const reloadConnections = vi.fn().mockResolvedValue(undefined);
        const showInformationMessage = vi.spyOn(ui, "showInformationMessage")
            .mockResolvedValue(undefined);
        vi.spyOn(webSession, "currentProfileId", "get").mockReturnValue(17);

        await ConnectionProcessor.importMySQLWorkbenchConnections(
            "<data/>",
            { reloadConnections } as unknown as ConnectionDataModel,
        );

        expect(importConnections).toHaveBeenCalledOnce();
        expect(importConnections).toHaveBeenCalledWith(17, "<data/>");
        expect(reloadConnections).toHaveBeenCalledOnce();
        expect(showInformationMessage).toHaveBeenCalledWith(
            "Imported 2, merged 1, and skipped 3 MySQL Workbench connections.",
            {},
        );
    });

    it("keeps the existing user-visible error path when backend import fails", async () => {
        vi.spyOn(
            ShellInterface.dbConnections,
            "importWorkbenchConnections",
        ).mockRejectedValue(new Error("Malformed XML"));
        const reloadConnections = vi.fn().mockResolvedValue(undefined);
        const showErrorMessage = vi.spyOn(ui, "showErrorMessage")
            .mockResolvedValue(undefined);
        vi.spyOn(webSession, "currentProfileId", "get").mockReturnValue(17);

        await ConnectionProcessor.importMySQLWorkbenchConnections(
            "<data/>",
            { reloadConnections } as unknown as ConnectionDataModel,
        );

        expect(reloadConnections).not.toHaveBeenCalled();
        expect(showErrorMessage).toHaveBeenCalledWith(
            "Could not parse XML file: Malformed XML",
            {},
        );
    });
});
