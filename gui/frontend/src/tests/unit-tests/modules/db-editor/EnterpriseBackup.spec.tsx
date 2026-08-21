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

import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ICdmConnectionEntry } from "../../../../data-models/ConnectionDataModel.js";
import {
    EnterpriseBackup,
    type IEnterpriseBackupSavedState,
} from "../../../../modules/db-editor/EnterpriseBackup.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import type {
    IMebBackupProfileInfo,
    IMebSetupState,
    IMebStatus,
} from "../../../../supplement/ShellInterface/ShellInterfaceMeb.js";

const status = {
    configured: true,
    profiles: [],
    recentActivity: [],
} as IMebStatus;

const setupState = {
    backupHomePath: "/actual/backups",
    configured: true,
    mysqlBackupUser: "mysqlbackup@localhost",
    mysqlbackupPath: "/opt/mysql/bin/mysqlbackup",
    status,
} as IMebSetupState;

const connection = {
    backend: { moduleSessionId: "session-1" },
    details: {
        options: { host: "localhost" },
        settings: {
            enterpriseBackup: {
                backupHomePath: "-",
                backupUser: "mysqlbackup@localhost",
                mysqlbackupPath: "/opt/mysql/bin/mysqlbackup",
            },
        },
    },
    isOffline: false,
} as ICdmConnectionEntry;

const statusWithLoginRequirement = (
    schedulerLoginRequirement: IMebBackupProfileInfo["schedulerLoginRequirement"],
): IMebStatus => {
    return {
        ...status,
        profiles: [{
            uuid: "profile-1",
            label: "Nightly Backup",
            type: "Full Data",
            destination: "/actual/backups/nightly",
            latest: "No backups",
            nextFull: "Daily at 02:00",
            nextIncremental: "Manual",
            status: "Configured",
            partial: false,
            schedulerLoginRequirement,
        } as unknown as IMebBackupProfileInfo],
    };
};

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("EnterpriseBackup", () => {
    it("shows the preview notice on the configured MEB page", async () => {
        vi.spyOn(ShellInterface.meb, "getSetupState").mockResolvedValue(setupState);
        vi.spyOn(ShellInterface.meb, "getStatus").mockResolvedValue(status);

        render(<EnterpriseBackup connection={connection} />);

        expect(await screen.findByText("Note: MEB support is currently a preview feature.")).toBeTruthy();
    });

    it("shows the preview notice on the not-configured MEB page", async () => {
        const notConfiguredSetupState = {
            ...setupState,
            configured: false,
            needsSetup: false,
            status: null,
        };
        vi.spyOn(ShellInterface.meb, "getSetupState").mockResolvedValue(notConfiguredSetupState);

        render(<EnterpriseBackup connection={connection} />);

        expect(await screen.findByText("MEB support not configured")).toBeTruthy();
        expect(screen.getByText("Note: MEB support is currently a preview feature.")).toBeTruthy();
    });

    it("restores the resolved configuration when the page is remounted", async () => {
        const savedState: IEnterpriseBackupSavedState = {};
        const onStateChange = vi.fn((data: Partial<IEnterpriseBackupSavedState>) => {
            Object.assign(savedState, data);
        });
        vi.spyOn(ShellInterface.meb, "getSetupState").mockResolvedValue(setupState);
        vi.spyOn(ShellInterface.meb, "getStatus").mockResolvedValue(status);

        const firstRender = render(<EnterpriseBackup connection={connection} onStateChange={onStateChange} />);
        await screen.findByText("/actual/backups");
        firstRender.unmount();

        render(<EnterpriseBackup connection={connection} savedState={savedState} onStateChange={onStateChange} />);

        expect(screen.getByText("/actual/backups")).toBeTruthy();
        await waitFor(() => {
            expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({
                configuration: {
                    backupHomePath: "/actual/backups",
                    backupUser: "mysqlbackup@localhost",
                    mysqlbackupPath: "/opt/mysql/bin/mysqlbackup",
                },
            }));
        });
    });

    it("notes when a scheduled backup requires the user to be logged in", async () => {
        const profileStatus = statusWithLoginRequirement("required");
        const profileSetupState = { ...setupState, status: profileStatus };
        vi.spyOn(ShellInterface.meb, "getSetupState").mockResolvedValue(profileSetupState);
        vi.spyOn(ShellInterface.meb, "getStatus").mockResolvedValue(profileStatus);

        render(<EnterpriseBackup connection={connection} />);

        expect(await screen.findByText("Note: Scheduled backup requires the user to be logged in.")).toBeTruthy();
        expect(screen.queryByText("Operating-system login")).toBeNull();
    });

    it.each(["notRequired", null] as const)("omits the login note when the requirement is %s", async (requirement) => {
        const profileStatus = statusWithLoginRequirement(requirement);
        const profileSetupState = { ...setupState, status: profileStatus };
        vi.spyOn(ShellInterface.meb, "getSetupState").mockResolvedValue(profileSetupState);
        vi.spyOn(ShellInterface.meb, "getStatus").mockResolvedValue(profileStatus);

        render(<EnterpriseBackup connection={connection} />);

        await screen.findAllByText("Nightly Backup");
        expect(screen.queryByText("Note: Scheduled backup requires the user to be logged in.")).toBeNull();
        expect(screen.queryByText("Operating-system login")).toBeNull();
    });
});
