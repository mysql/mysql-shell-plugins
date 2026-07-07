/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ui } from "../../../../app-logic/UILayer.js";
import {
    EnterpriseBackupConfiguration,
    type IEnterpriseBackupConfigurationProps,
} from "../../../../modules/db-editor/EnterpriseBackupConfiguration.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import type {
    IMebBackupHomeValidation,
    IMebMysqlBackupUserValidation,
    IMebPrerequisitesValidation,
    IMebSetupState,
} from "../../../../supplement/ShellInterface/ShellInterfaceMeb.js";

const setupState = {
    currentOsUser: "workbench",
    datadir: "/var/lib/mysql",
    mysqlbackupExists: true,
    mysqlbackupPath: "/opt/mysql/bin/mysqlbackup",
    mysqlBackupUser: "mysqlbackup@localhost",
    mysqlEdition: "Enterprise",
    mysqlVersion: "8.4.0",
    needsSetup: true,
    status: null,
} as IMebSetupState;

const defaultProps = (): IEnterpriseBackupConfigurationProps => {
    return {
        active: true,
        backupCommandsDisabled: false,
        configuration: {
            backupHomePath: "/backups",
            backupUser: "mysqlbackup@localhost",
            mysqlbackupPath: "/opt/mysql/bin/mysqlbackup",
        },
        dialogOpen: false,
        expectedMysqlbackupPath: "/opt/mysql/bin/mysqlbackup",
        moduleSessionId: "session-1",
        serverInfo: {
            datadir: "/var/lib/mysql",
            mysqlBasedir: "/opt/mysql",
            mysqlEdition: "Enterprise",
            mysqlVersion: "8.4.0",
        },
        setupState,
        onApplied: vi.fn(),
        onCancel: vi.fn(),
        onDialogOpenChange: vi.fn(),
    };
};

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("EnterpriseBackupConfiguration", () => {
    it("owns wizard cancellation", () => {
        const props = defaultProps();
        render(<EnterpriseBackupConfiguration {...props} />);

        fireEvent.click(screen.getByText("Cancel"));

        expect(props.onCancel).toHaveBeenCalledOnce();
    });

    it("validates each wizard step and applies the configuration", async () => {
        const props = defaultProps();
        const validateLocalBackupAccess = vi.spyOn(ShellInterface.meb, "validateLocalBackupAccess").mockResolvedValue({
            mysqlbackupStatus: { message: "mysqlbackup found", tone: "ok" },
            valid: true,
        } as IMebPrerequisitesValidation);
        const validateBackupHome = vi.spyOn(ShellInterface.meb, "validateBackupHome").mockResolvedValue({
            accessStatus: { message: "Access valid", tone: "ok" },
            ownershipStatus: { message: "Ownership valid", tone: "ok" },
            permissionsStatus: { message: "Permissions valid", tone: "ok" },
            reuseStatus: { message: "Instance valid", tone: "ok" },
            status: { message: "Backup home valid", tone: "ok" },
            valid: true,
        } as IMebBackupHomeValidation);
        vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser").mockResolvedValue({
            exists: true,
            missingGrants: [],
            passwordStatus: { message: "Password stored", tone: "ok" },
            passwordStored: true,
            status: { message: "Backup user valid", tone: "ok" },
            valid: true,
        } as IMebMysqlBackupUserValidation);
        vi.spyOn(ShellInterface.meb, "applySetup").mockResolvedValue(setupState);

        render(<EnterpriseBackupConfiguration {...props} />);
        fireEvent.click(screen.getByText("Next"));
        await screen.findByText("Read Access to MySQL Data Directory");

        await waitFor(() => {
            expect(validateLocalBackupAccess).toHaveBeenCalled();
        });
        fireEvent.click(screen.getByText("Next"));
        await screen.findByText("Backup Home Directory");

        fireEvent.click(screen.getByText("Next"));
        await waitFor(() => {
            expect(validateBackupHome).toHaveBeenCalled();
        });
        await screen.findByRole("heading", { name: "MySQL User for Backups" });

        fireEvent.click(screen.getByText("Finish"));
        await waitFor(() => {
            expect(props.onApplied).toHaveBeenCalledWith(props.configuration, setupState);
        });
    });

    it("opens the configuration dialog with the applied values", async () => {
        const props = { ...defaultProps(), active: false, dialogOpen: true };
        vi.spyOn(ShellInterface.meb, "validateLocalBackupAccess").mockResolvedValue({
            mysqlbackupStatus: { message: "mysqlbackup found", tone: "ok" },
            valid: true,
        } as IMebPrerequisitesValidation);
        vi.spyOn(ShellInterface.meb, "validateBackupHome").mockResolvedValue({
            status: { message: "Backup home valid", tone: "ok" },
            valid: true,
        } as IMebBackupHomeValidation);

        render(<EnterpriseBackupConfiguration {...props} />);

        expect(await screen.findByDisplayValue("mysqlbackup@localhost")).toBeTruthy();
        expect(screen.getByDisplayValue("/backups")).toBeTruthy();
        fireEvent.click(screen.getByText("Cancel"));
        await waitFor(() => {
            expect(props.onDialogOpenChange).toHaveBeenCalledWith(false);
        });
    });

    it("creates a missing backup account after checking it", async () => {
        const props = { ...defaultProps(), active: false, dialogOpen: true };
        const missingAccount = {
            exists: false,
            missingGrants: [],
            passwordStatus: { message: "Password not stored", tone: "warn" },
            passwordStored: false,
            status: { message: "Backup user missing", tone: "warn" },
            valid: false,
        } as IMebMysqlBackupUserValidation;
        vi.spyOn(ShellInterface.meb, "validateLocalBackupAccess").mockResolvedValue({
            mysqlbackupStatus: { message: "mysqlbackup found", tone: "ok" },
            valid: true,
        } as IMebPrerequisitesValidation);
        vi.spyOn(ShellInterface.meb, "validateBackupHome").mockResolvedValue({
            status: { message: "Backup home valid", tone: "ok" },
            valid: true,
        } as IMebBackupHomeValidation);
        vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser").mockResolvedValue(missingAccount);
        const createBackupMysqlUser = vi.spyOn(ShellInterface.meb, "createBackupMysqlUser").mockResolvedValue({
            ...missingAccount,
            exists: true,
            passwordStatus: { message: "Password stored", tone: "ok" },
            passwordStored: true,
            status: { message: "Backup user valid", tone: "ok" },
            valid: true,
        });
        vi.spyOn(ui, "showInformationMessage").mockResolvedValue(undefined);

        render(<EnterpriseBackupConfiguration {...props} />);
        fireEvent.click(await screen.findByText("Check Account"));
        fireEvent.click(await screen.findByText("Create User"));

        await waitFor(() => {
            expect(createBackupMysqlUser).toHaveBeenCalledWith(
                "session-1",
                "/backups",
                "mysqlbackup@localhost",
            );
        });
    });
});
