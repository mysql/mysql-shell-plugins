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

import { MessageScheduler } from "../../../../communication/MessageScheduler.js";
import { ShellAPIGui } from "../../../../communication/ProtocolGui.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceLegacy } from "../../../../supplement/ShellInterface/ShellInterfaceLegacy.js";

describe("ShellInterfaceLegacy", (): void => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("sends the generated discovery request and returns its result", async () => {
        const result = {
            vscode: {
                connectionCount: 2,
                profileCount: 1,
                logFileCount: 3,
                connectionsPending: true,
                issues: [{ item: "log", message: "Unreadable" }],
            },
        };
        const sendRequest = vi.spyOn(MessageScheduler.get, "sendRequest").mockResolvedValue({
            requestState: { type: "OK", msg: "" },
            result,
        });

        await expect(new ShellInterfaceLegacy().discover()).resolves.toEqual(result);
        expect(sendRequest).toHaveBeenCalledWith({
            requestType: ShellAPIGui.GuiLegacyDiscover,
            parameters: {},
        });
    });

    it("sends the generated Workbench import request", async () => {
        const result = {
            phase: "workbenchConnections",
            imported: 1,
            merged: 2,
            skipped: 0,
            warnings: [],
            failed: [],
        };
        const sendRequest = vi.spyOn(MessageScheduler.get, "sendRequest").mockResolvedValue({
            requestState: { type: "OK", msg: "" },
            result,
        });

        await expect(
            new ShellInterfaceLegacy().importDiscoveredWorkbenchConnections(17),
        ).resolves.toEqual(result);
        expect(sendRequest).toHaveBeenCalledWith({
            requestType: ShellAPIGui.GuiLegacyImportDiscoveredWorkbenchConnections,
            parameters: {
                args: {
                    profileId: 17,
                },
            },
        });
    });

    it("sends the VS Code import request", async () => {
        const result = [{
            phase: "vscodeConnections",
            imported: 1,
            merged: 0,
            skipped: 0,
            warnings: [],
            failed: [],
        }];
        const sendRequest = vi.spyOn(MessageScheduler.get, "sendRequest").mockResolvedValue({
            requestState: { type: "OK", msg: "" },
            result,
        });

        await expect(
            new ShellInterfaceLegacy().importVsCode(17),
        ).resolves.toEqual(result);
        expect(sendRequest).toHaveBeenCalledWith({
            requestType: ShellAPIGui.GuiLegacyImportVsCode,
            parameters: {
                args: {
                    profileId: 17,
                },
            },
        });
    });

    it("preserves project source and cleanup option casing", async () => {
        const result = [{
            phase: "migrationAssistantProjects",
            sourceId: "vscode-extension",
            imported: 1,
            merged: 0,
            skipped: 0,
            warnings: [],
            failed: [],
        }];
        const sendRequest = vi.spyOn(MessageScheduler.get, "sendRequest").mockResolvedValue({
            requestState: { type: "OK", msg: "" },
            result,
        });

        await expect(
            new ShellInterfaceLegacy().importMigrationAssistantProjects({
                sourceIds: ["vscode-extension"],
                deleteSources: true,
                copySshKeys: true,
                deleteSshKeys: true,
            }),
        ).resolves.toEqual(result);
        expect(sendRequest).toHaveBeenCalledWith({
            requestType: ShellAPIGui.GuiLegacyImportMigrationAssistantProjects,
            parameters: {
                args: {
                    options: {
                        sourceIds: ["vscode-extension"],
                        deleteSources: true,
                        copySshKeys: true,
                        deleteSshKeys: true,
                    },
                },
            },
            caseConversionIgnores: ["options"],
        });
    });

    it("is exposed as a singleton", () => {
        expect(ShellInterface.legacy).toBe(ShellInterface.legacy);
        expect(ShellInterface.legacy).toBeInstanceOf(ShellInterfaceLegacy);
    });
});
