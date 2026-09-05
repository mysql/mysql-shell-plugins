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

import { describe, expect, it, vi } from "vitest";

import { MessageScheduler } from "../../../../communication/MessageScheduler.js";
import { ShellAPIGui } from "../../../../communication/ProtocolGui.js";
import { ShellInterfaceMeb } from "../../../../supplement/ShellInterface/ShellInterfaceMeb.js";

describe("ShellInterfaceMeb", () => {
    it("sends fix-account requests with the MySQL session", async () => {
        const sendRequest = vi.spyOn(MessageScheduler.get, "sendRequest").mockResolvedValue({ result: {} });
        const meb = new ShellInterfaceMeb();

        await meb.fixBackupMysqlUser("session-1", "/backups", "mysqlbackup@localhost");

        expect(sendRequest).toHaveBeenCalledWith({
            requestType: ShellAPIGui.GuiMebFixBackupMysqlUser,
            parameters: {
                args: {
                    moduleSessionId: "session-1",
                    backupHomePath: "/backups",
                    mysqlUser: "mysqlbackup@localhost",
                },
            },
        });
    });

    it("sends delete backup requests with the profile-bound module session", async () => {
        const sendRequest = vi.spyOn(MessageScheduler.get, "sendRequest").mockResolvedValue({ result: {} });
        const meb = new ShellInterfaceMeb();

        await meb.deleteBackup("session-1", "/backups", "activity:v1:logs/backup.log");

        expect(sendRequest).toHaveBeenCalledWith({
            requestType: ShellAPIGui.GuiMebDeleteBackup,
            parameters: {
                args: {
                    moduleSessionId: "session-1",
                    backupHomePath: "/backups",
                    activityId: "activity:v1:logs/backup.log",
                },
            },
        });
    });

    it("sends restore requests with the profile-bound module session", async () => {
        const sendRequest = vi.spyOn(MessageScheduler.get, "sendRequest").mockResolvedValue({ result: {} });
        const meb = new ShellInterfaceMeb();

        await meb.restoreBackup("session-1", "/backups", "activity:v1:logs/backup.log", "restore-1", false);

        expect(sendRequest).toHaveBeenCalledWith({
            requestType: ShellAPIGui.GuiMebRestoreBackup,
            parameters: {
                args: {
                    moduleSessionId: "session-1",
                    backupHomePath: "/backups",
                    activityId: "activity:v1:logs/backup.log",
                    operationId: "restore-1",
                    force: false,
                },
            },
        });
    });

    it("sends backup-content requests with the profile-bound module session", async () => {
        const sendRequest = vi.spyOn(MessageScheduler.get, "sendRequest").mockResolvedValue({ result: {} });
        const meb = new ShellInterfaceMeb();

        await meb.readBackupContent("session-1", "/backups", "activity:v1:logs/backup.log");

        expect(sendRequest).toHaveBeenCalledWith({
            requestType: ShellAPIGui.GuiMebReadBackupContent,
            parameters: {
                args: {
                    moduleSessionId: "session-1",
                    backupHomePath: "/backups",
                    activityId: "activity:v1:logs/backup.log",
                },
            },
        });
    });
});
