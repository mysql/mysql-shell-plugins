/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ui } from "../../../../app-logic/UILayer.js";
import { appParameters } from "../../../../supplement/AppParameters.js";
import {
    EnterpriseBackupConfiguration,
    type IEnterpriseBackupConfigurationProps,
} from "../../../../modules/db-editor/EnterpriseBackupConfiguration.js";
import type { ICdmConnectionEntry } from "../../../../data-models/ConnectionDataModel.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import type {
    IMebBackupHomeValidation,
    IMebMysqlBackupUserValidation,
    IMebPrerequisitesValidation,
    IMebSetupState,
} from "../../../../supplement/ShellInterface/ShellInterfaceMeb.js";
import { deferred, nextRunLoop } from "../../test-helpers.js";

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

const configuredSetupState = {
    ...setupState,
    configured: true,
    needsSetup: false,
    message: "MEB support is configured.",
} as IMebSetupState;

const validLocalAccess = {
    currentOsUser: "workbench",
    datadir: "/var/lib/mysql",
    datadirGroup: "mysql",
    datadirOwner: "mysql",
    datadirStatus: { message: "Data directory access is valid.", tone: "ok" },
    mysqlbackupStatus: { message: "mysqlbackup found", tone: "ok" },
    userStatus: { message: "Current user access is valid.", tone: "ok" },
    valid: true,
} as IMebPrerequisitesValidation;

const invalidLocalAccess = {
    ...validLocalAccess,
    userStatus: { message: "Current user cannot read the data directory.", tone: "warn" },
    valid: false,
} as IMebPrerequisitesValidation;

const validBackupHome = {
    accessStatus: { message: "Access valid", tone: "ok" },
    backupHomePath: "/backups",
    exists: true,
    ownershipStatus: { message: "Ownership valid", tone: "ok" },
    permissionsStatus: { message: "Permissions valid", tone: "ok" },
    reuseStatus: { message: "Instance valid", tone: "ok" },
    status: { message: "Backup home valid", tone: "ok" },
    valid: true,
} as IMebBackupHomeValidation;

const invalidBackupHome = {
    ...validBackupHome,
    status: { message: "Backup home validation failed", tone: "warn" },
    valid: false,
} as IMebBackupHomeValidation;

const validBackupAccount = {
    exists: true,
    host: "localhost",
    loginFile: "/backups/.mylogin.cnf",
    loginPath: "mysql_workbench_meb_test",
    missingGrants: [],
    passwordStatus: { message: "Password stored", tone: "ok" },
    passwordStored: true,
    status: { message: "Backup user valid", tone: "ok" },
    valid: true,
} as IMebMysqlBackupUserValidation;

const missingBackupAccount = {
    ...validBackupAccount,
    exists: false,
    loginFile: null,
    loginPath: null,
    passwordStatus: { message: "Password not stored", tone: "warn" },
    passwordStored: false,
    status: { message: "Backup user missing", tone: "warn" },
    valid: false,
} as IMebMysqlBackupUserValidation;

const wizardButton = (name: "Back" | "Cancel" | "Finish" | "Next"): HTMLElement => {
    return screen.getByRole("button", { name });
};

const expectWizardButtonDisabled = (name: "Back" | "Cancel" | "Finish" | "Next",
    disabled: boolean): void => {
    expect(wizardButton(name).classList.contains("disabled")).toBe(disabled);
};

const dialogButton = (name: "Apply" | "Applying" | "Cancel"): HTMLElement => {
    return screen.getByRole("button", { name });
};

const expectDialogButtonDisabled = (name: "Apply" | "Applying" | "Cancel", disabled: boolean): void => {
    expect(dialogButton(name).classList.contains("disabled")).toBe(disabled);
};

const selectDialogBackupHome = async (path: string): Promise<void> => {
    await act(async () => {
        await requisitions.execute("selectFile", {
            resourceId: "enterpriseBackupHome",
            file: [{ path, content: new ArrayBuffer(0) }],
        });
    });
};

const advanceToBackupHome = async (): Promise<void> => {
    fireEvent.click(wizardButton("Next"));
    await screen.findByText("Read Access to MySQL Data Directory");
    await waitFor(() => {
        expectWizardButtonDisabled("Next", false);
    });

    fireEvent.click(wizardButton("Next"));
    await screen.findByText("Backup Home Directory");
};

const advanceToBackupAccount = async (): Promise<void> => {
    await advanceToBackupHome();
    await waitFor(() => {
        expectWizardButtonDisabled("Next", false);
    });

    fireEvent.click(wizardButton("Next"));
    await screen.findByRole("heading", { name: "MySQL User for Backups" });
};

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
    appParameters.embedded = false;
});

describe("EnterpriseBackupConfiguration", () => {
    it("owns wizard cancellation", () => {
        const props = defaultProps();
        render(<EnterpriseBackupConfiguration {...props} />);

        fireEvent.click(screen.getByText("Cancel"));

        expect(props.onCancel).toHaveBeenCalledOnce();
    });

    it("automatically validates each wizard page without repeating checks on Next or Finish", async () => {
        const props = defaultProps();
        const validateLocalBackupAccess = vi.spyOn(ShellInterface.meb, "validateLocalBackupAccess")
            .mockResolvedValue(validLocalAccess);
        const validateBackupHome = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockResolvedValue(validBackupHome);
        const validateBackupMysqlUser = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validBackupAccount);
        vi.spyOn(ShellInterface.meb, "applySetup").mockResolvedValue(configuredSetupState);

        render(<EnterpriseBackupConfiguration {...props} />);
        fireEvent.click(wizardButton("Next"));
        await screen.findByText("Read Access to MySQL Data Directory");
        await waitFor(() => {
            expect(validateLocalBackupAccess).toHaveBeenCalledOnce();
            expectWizardButtonDisabled("Next", false);
        });

        fireEvent.click(wizardButton("Next"));
        expect(validateLocalBackupAccess).toHaveBeenCalledOnce();
        await screen.findByText("Backup Home Directory");
        await waitFor(() => {
            expect(validateBackupHome).toHaveBeenCalledOnce();
            expectWizardButtonDisabled("Next", false);
        });

        fireEvent.click(wizardButton("Next"));
        expect(validateBackupHome).toHaveBeenCalledOnce();
        await screen.findByRole("heading", { name: "MySQL User for Backups" });
        await waitFor(() => {
            expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
            expectWizardButtonDisabled("Finish", false);
        });

        fireEvent.click(wizardButton("Finish"));
        expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
        await waitFor(() => {
            expect(props.onApplied).toHaveBeenCalledWith(props.configuration, configuredSetupState);
        });
    });

    it("keeps Next disabled for invalid local access and enables it after Check Again succeeds", async () => {
        const validateLocalBackupAccess = vi.spyOn(ShellInterface.meb, "validateLocalBackupAccess")
            .mockResolvedValueOnce(invalidLocalAccess)
            .mockResolvedValueOnce(validLocalAccess);

        render(<EnterpriseBackupConfiguration {...defaultProps()} />);
        fireEvent.click(wizardButton("Next"));
        await screen.findByText("Current user cannot read the data directory.");

        expectWizardButtonDisabled("Next", true);
        fireEvent.click(screen.getByRole("button", { name: "Check Again" }));
        await waitFor(() => {
            expect(validateLocalBackupAccess).toHaveBeenCalledTimes(2);
            expectWizardButtonDisabled("Next", false);
        });
    });

    it("keeps Next disabled until a Back re-entry local-access check completes", async () => {
        const reentryResult = deferred<IMebPrerequisitesValidation>();
        const validateLocalBackupAccess = vi.spyOn(ShellInterface.meb, "validateLocalBackupAccess")
            .mockResolvedValueOnce(validLocalAccess)
            .mockReturnValueOnce(reentryResult.promise);
        vi.spyOn(ShellInterface.meb, "validateBackupHome").mockResolvedValue(validBackupHome);

        render(<EnterpriseBackupConfiguration {...defaultProps()} />);
        await advanceToBackupHome();
        fireEvent.click(wizardButton("Back"));
        await screen.findByText("Read Access to MySQL Data Directory");
        await waitFor(() => {
            expect(validateLocalBackupAccess).toHaveBeenCalledTimes(2);
        });

        expectWizardButtonDisabled("Next", true);
        await act(async () => {
            reentryResult.resolve(validLocalAccess);
            await Promise.resolve();
        });
        await waitFor(() => {
            expectWizardButtonDisabled("Next", false);
        });
    });

    it("keeps Next disabled for an invalid backup home and retries it through Check Again", async () => {
        vi.spyOn(ShellInterface.meb, "validateLocalBackupAccess").mockResolvedValue(validLocalAccess);
        const validateBackupHome = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockResolvedValueOnce(invalidBackupHome)
            .mockResolvedValueOnce(validBackupHome);

        render(<EnterpriseBackupConfiguration {...defaultProps()} />);
        await advanceToBackupHome();
        await screen.findByText("Backup home validation failed");

        expectWizardButtonDisabled("Next", true);
        fireEvent.click(screen.getByRole("button", { name: "Check Again" }));
        await waitFor(() => {
            expect(validateBackupHome).toHaveBeenCalledTimes(2);
            expectWizardButtonDisabled("Next", false);
        });
    });

    it("keeps Finish disabled until account remediation returns a valid result", async () => {
        vi.spyOn(ShellInterface.meb, "validateLocalBackupAccess").mockResolvedValue(validLocalAccess);
        vi.spyOn(ShellInterface.meb, "validateBackupHome").mockResolvedValue(validBackupHome);
        const validateBackupMysqlUser = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(missingBackupAccount);
        const createBackupMysqlUser = vi.spyOn(ShellInterface.meb, "createBackupMysqlUser")
            .mockResolvedValue(validBackupAccount);
        vi.spyOn(ui, "showInformationMessage").mockResolvedValue(undefined);

        render(<EnterpriseBackupConfiguration {...defaultProps()} />);
        await advanceToBackupAccount();
        const createUser = await screen.findByRole("button", { name: "Create User" });

        expectWizardButtonDisabled("Finish", true);
        fireEvent.click(createUser);
        await waitFor(() => {
            expect(createBackupMysqlUser).toHaveBeenCalledOnce();
            expectWizardButtonDisabled("Finish", false);
        });
        expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
    });

    it("invalidates home and account results when the wizard session changes", async () => {
        vi.spyOn(ShellInterface.meb, "validateLocalBackupAccess").mockResolvedValue(validLocalAccess);
        vi.spyOn(ShellInterface.meb, "validateBackupHome").mockResolvedValue(validBackupHome);
        const validateBackupMysqlUser = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validBackupAccount);
        const applySetup = vi.spyOn(ShellInterface.meb, "applySetup").mockResolvedValue(configuredSetupState);
        const props = defaultProps();
        const view = render(<EnterpriseBackupConfiguration {...props} />);

        await advanceToBackupAccount();
        await waitFor(() => {
            expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
            expectWizardButtonDisabled("Finish", false);
        });

        view.rerender(<EnterpriseBackupConfiguration {...props} moduleSessionId="session-2" />);
        await act(async () => {
            await Promise.resolve();
        });

        expectWizardButtonDisabled("Finish", true);
        expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
        fireEvent.click(wizardButton("Finish"));
        expect(applySetup).not.toHaveBeenCalled();
    });

    it("disables the whole wizard while an account operation is pending", async () => {
        const createResult = deferred<IMebMysqlBackupUserValidation>();
        vi.spyOn(ShellInterface.meb, "validateLocalBackupAccess").mockResolvedValue(validLocalAccess);
        vi.spyOn(ShellInterface.meb, "validateBackupHome").mockResolvedValue(validBackupHome);
        vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser").mockResolvedValue(missingBackupAccount);
        vi.spyOn(ShellInterface.meb, "createBackupMysqlUser").mockReturnValue(createResult.promise);
        vi.spyOn(ui, "showInformationMessage").mockResolvedValue(undefined);

        render(<EnterpriseBackupConfiguration {...defaultProps()} />);
        await advanceToBackupAccount();
        fireEvent.click(await screen.findByRole("button", { name: "Create User" }));

        const creating = await screen.findByRole("button", { name: "Creating" });
        expectWizardButtonDisabled("Cancel", true);
        expectWizardButtonDisabled("Back", true);
        expectWizardButtonDisabled("Finish", true);
        expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
        expect(creating.classList.contains("disabled")).toBe(true);

        await act(async () => {
            createResult.resolve(validBackupAccount);
            await Promise.resolve();
        });
        await waitFor(() => {
            expectWizardButtonDisabled("Cancel", false);
            expectWizardButtonDisabled("Back", false);
            expectWizardButtonDisabled("Finish", false);
            expect(screen.getByRole("textbox")).toHaveProperty("disabled", false);
        });
    });

    it("ignores a local-access result from a closed wizard lifecycle", async () => {
        const staleResult = deferred<IMebPrerequisitesValidation>();
        const validateLocalBackupAccess = vi.spyOn(ShellInterface.meb, "validateLocalBackupAccess")
            .mockReturnValueOnce(staleResult.promise)
            .mockResolvedValueOnce(validLocalAccess);
        const props = defaultProps();
        const view = render(<EnterpriseBackupConfiguration {...props} />);

        fireEvent.click(wizardButton("Next"));
        await waitFor(() => {
            expect(validateLocalBackupAccess).toHaveBeenCalledOnce();
        });
        view.rerender(<EnterpriseBackupConfiguration {...props} active={false} />);
        await act(async () => {
            staleResult.resolve(invalidLocalAccess);
            await Promise.resolve();
        });

        view.rerender(<EnterpriseBackupConfiguration {...props} />);
        fireEvent.click(wizardButton("Next"));
        await waitFor(() => {
            expect(validateLocalBackupAccess).toHaveBeenCalledTimes(2);
            expectWizardButtonDisabled("Next", false);
        });
        expect(screen.queryByText("Current user cannot read the data directory.")).toBeNull();
    });

    it("resets a reopened wizard without starting closed-dialog account work", async () => {
        const validateLocalBackupAccess = vi.spyOn(ShellInterface.meb, "validateLocalBackupAccess")
            .mockResolvedValue(validLocalAccess);
        vi.spyOn(ShellInterface.meb, "validateBackupHome").mockResolvedValue(validBackupHome);
        const validateBackupMysqlUser = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validBackupAccount);
        const props = defaultProps();
        const view = render(<EnterpriseBackupConfiguration {...props} />);

        await advanceToBackupHome();
        await waitFor(() => {
            expectWizardButtonDisabled("Next", false);
        });
        view.rerender(<EnterpriseBackupConfiguration {...props} active={false} />);
        await new Promise((resolve) => {
            setTimeout(resolve, 250);
        });
        expect(validateBackupMysqlUser).not.toHaveBeenCalled();

        view.rerender(<EnterpriseBackupConfiguration {...props} />);
        expect(screen.getByRole("heading", { name: "MySQL Enterprise Backup" })).toBeTruthy();
        fireEvent.click(wizardButton("Next"));
        await waitFor(() => {
            expect(validateLocalBackupAccess).toHaveBeenCalledTimes(2);
        });
    });

    it("reports an unconfigured setup result without closing the wizard", async () => {
        const props = defaultProps();
        const failedSetupState = {
            ...setupState,
            configured: false,
            message: "The MEB task helper could not load backups.cnf.",
        } as IMebSetupState;
        vi.spyOn(ShellInterface.meb, "validateLocalBackupAccess").mockResolvedValue(validLocalAccess);
        vi.spyOn(ShellInterface.meb, "validateBackupHome").mockResolvedValue(validBackupHome);
        vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser").mockResolvedValue(validBackupAccount);
        vi.spyOn(ShellInterface.meb, "applySetup").mockResolvedValue(failedSetupState);
        const showErrorMessage = vi.spyOn(ui, "showErrorMessage").mockResolvedValue(undefined);

        render(<EnterpriseBackupConfiguration {...props} />);
        await advanceToBackupAccount();
        await waitFor(() => {
            expectWizardButtonDisabled("Finish", false);
        });
        fireEvent.click(wizardButton("Finish"));

        await waitFor(() => {
            expect(showErrorMessage).toHaveBeenCalledWith(
                "Cannot save MySQL Enterprise Backup configuration: The MEB task helper could not load backups.cnf.",
                {},
            );
        });
        expect(props.onApplied).not.toHaveBeenCalled();
        expect(wizardButton("Finish")).toBeTruthy();
    });

    it("starts no closed-dialog checks and validates home before account on open", async () => {
        appParameters.embedded = true;
        const homeResult = deferred<IMebBackupHomeValidation>();
        const validateLocalBackupAccess = vi.spyOn(ShellInterface.meb, "validateLocalBackupAccess")
            .mockResolvedValue(validLocalAccess);
        const validateBackupHome = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockReturnValue(homeResult.promise);
        const validateBackupMysqlUser = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validBackupAccount);
        const props = { ...defaultProps(), active: false };
        const view = render(<EnterpriseBackupConfiguration {...props} dialogOpen={false} />);

        await nextRunLoop();
        expect(validateBackupHome).not.toHaveBeenCalled();
        expect(validateBackupMysqlUser).not.toHaveBeenCalled();

        view.rerender(<EnterpriseBackupConfiguration {...props} dialogOpen />);
        await waitFor(() => {
            expect(validateBackupHome).toHaveBeenCalledWith("session-1", "/backups");
        });
        expect(validateLocalBackupAccess).not.toHaveBeenCalled();
        expect(validateBackupMysqlUser).not.toHaveBeenCalled();
        expectDialogButtonDisabled("Apply", true);
        expectDialogButtonDisabled("Cancel", true);
        expect(document.querySelector("#closeButton")?.classList.contains("disabled")).toBe(true);
        expect(screen.getByDisplayValue("/backups")).toHaveProperty("disabled", true);
        expect(document.querySelector("#enterpriseBackupHomeBtn")?.classList.contains("disabled")).toBe(true);

        fireEvent.keyDown(document.body, { key: "Escape" });
        fireEvent.click(document.querySelector("#closeButton")!);
        expect(props.onDialogOpenChange).not.toHaveBeenCalled();

        await act(async () => {
            homeResult.resolve(validBackupHome);
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(validateBackupMysqlUser).toHaveBeenCalledWith(
                "session-1",
                "/backups",
                "mysqlbackup@localhost",
                undefined,
            );
            expectDialogButtonDisabled("Cancel", false);
        });
        expectDialogButtonDisabled("Apply", true);

        fireEvent.click(dialogButton("Cancel"));
        await waitFor(() => {
            expect(props.onDialogOpenChange).toHaveBeenCalledWith(false);
        });
    });

    it("normalizes the opening draft and keeps Apply disabled for unchanged or whitespace-only values", async () => {
        const validateBackupHome = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockResolvedValue(validBackupHome);
        const validateBackupMysqlUser = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validBackupAccount);
        const props = {
            ...defaultProps(),
            active: false,
            dialogOpen: true,
            configuration: {
                backupHomePath: "  /backups  ",
                backupUser: "  mysqlbackup@localhost  ",
                mysqlbackupPath: "  /opt/mysql/bin/mysqlbackup  ",
            },
        };

        render(<EnterpriseBackupConfiguration {...props} />);

        await waitFor(() => {
            expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
        });
        expect(validateBackupHome).toHaveBeenCalledWith("session-1", "/backups");
        expect(validateBackupMysqlUser).toHaveBeenCalledWith(
            "session-1",
            "/backups",
            "mysqlbackup@localhost",
            undefined,
        );
        expect(screen.getByDisplayValue("/backups")).toBeTruthy();
        expect(screen.getByDisplayValue("mysqlbackup@localhost")).toBeTruthy();
        expectDialogButtonDisabled("Apply", true);

        fireEvent.input(screen.getByDisplayValue("mysqlbackup@localhost"), {
            target: { value: "  mysqlbackup@localhost  " },
        });
        expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
        expectDialogButtonDisabled("Apply", true);
    });

    it("validates a selected home before rechecking the displayed account", async () => {
        const selectedHomeResult = deferred<IMebBackupHomeValidation>();
        const validateBackupHome = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockResolvedValueOnce(validBackupHome)
            .mockReturnValueOnce(selectedHomeResult.promise);
        const validateBackupMysqlUser = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validBackupAccount);
        const props = { ...defaultProps(), active: false, dialogOpen: true };

        render(<EnterpriseBackupConfiguration {...props} />);
        await waitFor(() => {
            expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
            expectDialogButtonDisabled("Cancel", false);
        });

        await selectDialogBackupHome("/selected");
        await waitFor(() => {
            expect(validateBackupHome).toHaveBeenCalledWith("session-1", "/selected");
        });
        expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
        expectDialogButtonDisabled("Apply", true);

        await act(async () => {
            selectedHomeResult.resolve({ ...validBackupHome, backupHomePath: "/selected" });
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(validateBackupMysqlUser).toHaveBeenCalledWith(
                "session-1",
                "/selected",
                "mysqlbackup@localhost",
                undefined,
            );
            expectDialogButtonDisabled("Apply", false);
        });
        expect(validateBackupMysqlUser).toHaveBeenCalledTimes(2);
    });

    it("requires Use Account for typed usernames and restores an exact trimmed cached result", async () => {
        vi.spyOn(ShellInterface.meb, "validateBackupHome").mockResolvedValue(validBackupHome);
        const validateBackupMysqlUser = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validBackupAccount);

        render(<EnterpriseBackupConfiguration {...defaultProps()} active={false} dialogOpen />);
        const username = await screen.findByDisplayValue("mysqlbackup@localhost");
        await waitFor(() => {
            expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
            expectDialogButtonDisabled("Cancel", false);
        });

        fireEvent.input(username, { target: { value: "other@localhost" } });
        expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
        expect(screen.getByRole("button", { name: "Use Account" })).toBeTruthy();
        expectDialogButtonDisabled("Apply", true);

        fireEvent.input(username, { target: { value: "  mysqlbackup@localhost  " } });
        expect(screen.queryByRole("button", { name: "Use Account" })).toBeNull();
        expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
        expectDialogButtonDisabled("Apply", true);

        fireEvent.input(username, { target: { value: "other@localhost" } });
        fireEvent.click(screen.getByRole("button", { name: "Use Account" }));
        await waitFor(() => {
            expect(validateBackupMysqlUser).toHaveBeenCalledWith(
                "session-1",
                "/backups",
                "other@localhost",
                undefined,
            );
            expectDialogButtonDisabled("Apply", false);
        });
        expect(validateBackupMysqlUser).toHaveBeenCalledTimes(2);
    });

    it("invalidates dialog results when the module session changes", async () => {
        const nextHomeResult = deferred<IMebBackupHomeValidation>();
        const nextAccountResult = deferred<IMebMysqlBackupUserValidation>();
        const validateBackupHome = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockResolvedValueOnce(validBackupHome)
            .mockReturnValueOnce(nextHomeResult.promise);
        const validateBackupMysqlUser = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValueOnce(validBackupAccount)
            .mockReturnValueOnce(validBackupAccount)
            .mockReturnValueOnce(nextAccountResult.promise);
        const applySetup = vi.spyOn(ShellInterface.meb, "applySetup").mockResolvedValue(configuredSetupState);
        const props = { ...defaultProps(), active: false, dialogOpen: true };
        const view = render(<EnterpriseBackupConfiguration {...props} />);

        const username = await screen.findByDisplayValue("mysqlbackup@localhost");
        await waitFor(() => {
            expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
            expectDialogButtonDisabled("Cancel", false);
        });
        fireEvent.input(username, { target: { value: "other@localhost" } });
        fireEvent.click(screen.getByRole("button", { name: "Use Account" }));
        await waitFor(() => {
            expectDialogButtonDisabled("Apply", false);
        });

        view.rerender(<EnterpriseBackupConfiguration {...props} moduleSessionId="session-2" />);
        await waitFor(() => {
            expect(validateBackupHome).toHaveBeenCalledWith("session-2", "/backups");
        });
        expectDialogButtonDisabled("Apply", true);
        fireEvent.click(dialogButton("Apply"));
        expect(applySetup).not.toHaveBeenCalled();
        expect(validateBackupMysqlUser).toHaveBeenCalledTimes(2);

        await act(async () => {
            nextHomeResult.resolve(validBackupHome);
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(validateBackupMysqlUser).toHaveBeenCalledWith(
                "session-2",
                "/backups",
                "other@localhost",
                undefined,
            );
        });
        expectDialogButtonDisabled("Apply", true);

        await act(async () => {
            nextAccountResult.resolve(validBackupAccount);
            await Promise.resolve();
        });
        await waitFor(() => {
            expectDialogButtonDisabled("Apply", false);
        });
    });

    it("locks every dialog control during an account mutation", async () => {
        appParameters.embedded = true;
        const createResult = deferred<IMebMysqlBackupUserValidation>();
        vi.spyOn(ShellInterface.meb, "validateBackupHome").mockResolvedValue(validBackupHome);
        vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser").mockResolvedValue(missingBackupAccount);
        const createBackupMysqlUser = vi.spyOn(ShellInterface.meb, "createBackupMysqlUser")
            .mockReturnValue(createResult.promise);
        vi.spyOn(ui, "showInformationMessage").mockResolvedValue(undefined);
        const props = { ...defaultProps(), active: false, dialogOpen: true };

        render(<EnterpriseBackupConfiguration {...props} />);
        fireEvent.click(await screen.findByRole("button", { name: "Create User" }));

        const creating = await screen.findByRole("button", { name: "Creating" });
        expect(createBackupMysqlUser).toHaveBeenCalledOnce();
        expectDialogButtonDisabled("Apply", true);
        expectDialogButtonDisabled("Cancel", true);
        expect(document.querySelector("#closeButton")?.classList.contains("disabled")).toBe(true);
        expect(screen.getByDisplayValue("/backups")).toHaveProperty("disabled", true);
        expect(screen.getByDisplayValue("mysqlbackup@localhost")).toHaveProperty("disabled", true);
        expect(document.querySelector("#enterpriseBackupHomeBtn")?.classList.contains("disabled")).toBe(true);
        expect(creating.classList.contains("disabled")).toBe(true);

        fireEvent.keyDown(document.body, { key: "Escape" });
        fireEvent.click(document.querySelector("#closeButton")!);
        fireEvent.click(creating);
        expect(props.onDialogOpenChange).not.toHaveBeenCalled();
        expect(createBackupMysqlUser).toHaveBeenCalledOnce();

        await act(async () => {
            createResult.resolve(validBackupAccount);
            await Promise.resolve();
        });
        await waitFor(() => {
            expectDialogButtonDisabled("Cancel", false);
            expect(screen.getByDisplayValue("/backups")).toHaveProperty("disabled", false);
            expect(screen.getByDisplayValue("mysqlbackup@localhost")).toHaveProperty("disabled", false);
        });
    });

    it("applies one dirty exact selection, persists it, and performs no duplicate validation", async () => {
        vi.spyOn(ShellInterface.meb, "validateBackupHome").mockResolvedValue(validBackupHome);
        const validateBackupMysqlUser = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validBackupAccount);
        const appliedSetupState = {
            ...configuredSetupState,
            backupHomePath: "/backups",
            mysqlBackupUser: "other@localhost",
        } as IMebSetupState;
        const applySetup = vi.spyOn(ShellInterface.meb, "applySetup").mockResolvedValue(appliedSetupState);
        const updateDbConnection = vi.spyOn(ShellInterface.dbConnections, "updateDbConnection")
            .mockResolvedValue(undefined);
        const connection = {
            details: {
                settings: { existingSetting: true },
            },
        } as unknown as ICdmConnectionEntry;
        const props = { ...defaultProps(), active: false, dialogOpen: true, connection };

        render(<EnterpriseBackupConfiguration {...props} />);
        const username = await screen.findByDisplayValue("mysqlbackup@localhost");
        await waitFor(() => {
            expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
            expectDialogButtonDisabled("Cancel", false);
        });
        fireEvent.input(username, { target: { value: "other@localhost" } });
        fireEvent.click(screen.getByRole("button", { name: "Use Account" }));
        await waitFor(() => {
            expectDialogButtonDisabled("Apply", false);
        });

        fireEvent.click(dialogButton("Apply"));
        await waitFor(() => {
            expect(props.onApplied).toHaveBeenCalledWith({
                backupHomePath: "/backups",
                backupUser: "other@localhost",
                mysqlbackupPath: "/opt/mysql/bin/mysqlbackup",
            }, appliedSetupState);
            expect(props.onDialogOpenChange).toHaveBeenCalledWith(false);
        });
        expect(applySetup).toHaveBeenCalledWith("session-1", "/backups", "other@localhost");
        expect(updateDbConnection).toHaveBeenCalledWith(expect.any(Number), expect.objectContaining({
            settings: {
                existingSetting: true,
                enterpriseBackup: {
                    backupHomePath: "/backups",
                    backupUser: "other@localhost",
                    mysqlbackupPath: "/opt/mysql/bin/mysqlbackup",
                },
            },
        }));
        expect(connection.details.settings.enterpriseBackup).toEqual({
            backupHomePath: "/backups",
            backupUser: "other@localhost",
            mysqlbackupPath: "/opt/mysql/bin/mysqlbackup",
        });
        expect(validateBackupMysqlUser).toHaveBeenCalledTimes(2);
        expect(document.querySelector("#closeButton")).toBeNull();
    });

    it("keeps a failed Apply open and unlocks the dialog", async () => {
        appParameters.embedded = true;
        const applyResult = deferred<IMebSetupState>();
        vi.spyOn(ShellInterface.meb, "validateBackupHome").mockResolvedValue(validBackupHome);
        const validateBackupMysqlUser = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validBackupAccount);
        vi.spyOn(ShellInterface.meb, "applySetup").mockReturnValue(applyResult.promise);
        const showErrorMessage = vi.spyOn(ui, "showErrorMessage").mockResolvedValue(undefined);
        const props = { ...defaultProps(), active: false, dialogOpen: true };

        render(<EnterpriseBackupConfiguration {...props} />);
        const username = await screen.findByDisplayValue("mysqlbackup@localhost");
        await waitFor(() => {
            expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
            expectDialogButtonDisabled("Cancel", false);
        });
        fireEvent.input(username, { target: { value: "other@localhost" } });
        fireEvent.click(await screen.findByRole("button", { name: "Use Account" }));
        await waitFor(() => {
            expectDialogButtonDisabled("Apply", false);
        });
        fireEvent.click(dialogButton("Apply"));

        await waitFor(() => {
            expectDialogButtonDisabled("Applying", true);
            expectDialogButtonDisabled("Cancel", true);
        });
        expect(document.querySelector("#closeButton")?.classList.contains("disabled")).toBe(true);
        expect(screen.getByDisplayValue("/backups")).toHaveProperty("disabled", true);
        expect(screen.getByDisplayValue("other@localhost")).toHaveProperty("disabled", true);
        fireEvent.keyDown(document.body, { key: "Escape" });
        expect(props.onDialogOpenChange).not.toHaveBeenCalled();

        await act(async () => {
            applyResult.resolve({
                ...configuredSetupState,
                configured: false,
                message: "Configuration rejected.",
            });
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(showErrorMessage).toHaveBeenCalledWith(
                "Cannot save MySQL Enterprise Backup configuration: Configuration rejected.",
                {},
            );
            expectDialogButtonDisabled("Apply", false);
            expectDialogButtonDisabled("Cancel", false);
        });
        expect(document.querySelector("#closeButton")?.classList.contains("disabled")).toBe(false);
        expect(screen.getByDisplayValue("/backups")).toHaveProperty("disabled", false);
        expect(screen.getByDisplayValue("other@localhost")).toHaveProperty("disabled", false);
        expect(props.onApplied).not.toHaveBeenCalled();
        expect(props.onDialogOpenChange).not.toHaveBeenCalled();
    });

    it("preserves a pending Apply barrier across close and reopen until success reconciles", async () => {
        const applyResult = deferred<IMebSetupState>();
        const validateBackupHome = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockResolvedValue(validBackupHome);
        const validateBackupMysqlUser = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validBackupAccount);
        const applySetup = vi.spyOn(ShellInterface.meb, "applySetup").mockReturnValue(applyResult.promise);
        const updateDbConnection = vi.spyOn(ShellInterface.dbConnections, "updateDbConnection")
            .mockResolvedValue(undefined);
        const connection = {
            details: {
                settings: { existingSetting: true },
            },
        } as unknown as ICdmConnectionEntry;
        const props = { ...defaultProps(), active: false, connection, dialogOpen: true };
        const view = render(<EnterpriseBackupConfiguration {...props} />);

        const username = await screen.findByDisplayValue("mysqlbackup@localhost");
        await waitFor(() => {
            expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
            expectDialogButtonDisabled("Cancel", false);
        });
        fireEvent.input(username, { target: { value: "other@localhost" } });
        fireEvent.click(screen.getByRole("button", { name: "Use Account" }));
        await waitFor(() => {
            expectDialogButtonDisabled("Apply", false);
        });
        fireEvent.click(dialogButton("Apply"));
        await screen.findByRole("button", { name: "Applying" });

        view.rerender(<EnterpriseBackupConfiguration {...props} dialogOpen={false} />);
        await waitFor(() => {
            expect(document.querySelector("#closeButton")).toBeNull();
        });

        const reopenedProps = {
            ...props,
            configuration: {
                ...props.configuration,
                backupHomePath: "/stored-two",
                backupUser: "stored-two@localhost",
            },
        };
        view.rerender(<EnterpriseBackupConfiguration {...reopenedProps} dialogOpen />);
        await waitFor(() => {
            expectDialogButtonDisabled("Applying", true);
            expectDialogButtonDisabled("Cancel", true);
        });
        vi.mocked(props.onDialogOpenChange).mockClear();
        expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
        expect(validateBackupHome).toHaveBeenCalledOnce();
        expect(validateBackupMysqlUser).toHaveBeenCalledTimes(2);
        expect(screen.getByDisplayValue("/stored-two")).toHaveProperty("disabled", true);
        expect(screen.getByDisplayValue("stored-two@localhost")).toHaveProperty("disabled", true);
        fireEvent.click(dialogButton("Applying"));
        fireEvent.click(document.querySelector("#closeButton")!);
        fireEvent.keyDown(document.body, { key: "Escape" });
        expect(applySetup).toHaveBeenCalledOnce();
        expect(props.onDialogOpenChange).not.toHaveBeenCalled();

        await act(async () => {
            const appliedSetupState = {
                ...configuredSetupState,
                backupHomePath: "/backups",
                mysqlBackupUser: "other@localhost",
            } as IMebSetupState;
            applyResult.resolve(appliedSetupState);
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(updateDbConnection).toHaveBeenCalledOnce();
            expect(props.onApplied).toHaveBeenCalledWith({
                backupHomePath: "/backups",
                backupUser: "other@localhost",
                mysqlbackupPath: "/opt/mysql/bin/mysqlbackup",
            }, expect.objectContaining({
                configured: true,
                mysqlBackupUser: "other@localhost",
            }));
            expect(props.onDialogOpenChange).toHaveBeenCalledWith(false);
        });
        expect(connection.details.settings.enterpriseBackup).toEqual({
            backupHomePath: "/backups",
            backupUser: "other@localhost",
            mysqlbackupPath: "/opt/mysql/bin/mysqlbackup",
        });
        expect(applySetup).toHaveBeenCalledOnce();
        expect(validateBackupHome).toHaveBeenCalledOnce();
        expect(document.querySelector("#closeButton")).toBeNull();
    });

    it("reports a pending Apply failure after reopen and then validates the reopened draft", async () => {
        const applyResult = deferred<IMebSetupState>();
        const validateBackupHome = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockResolvedValue(validBackupHome);
        const validateBackupMysqlUser = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validBackupAccount);
        const applySetup = vi.spyOn(ShellInterface.meb, "applySetup").mockReturnValue(applyResult.promise);
        const showErrorMessage = vi.spyOn(ui, "showErrorMessage").mockResolvedValue(undefined);
        const props = { ...defaultProps(), active: false, dialogOpen: true };
        const view = render(<EnterpriseBackupConfiguration {...props} />);

        const username = await screen.findByDisplayValue("mysqlbackup@localhost");
        await waitFor(() => {
            expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
            expectDialogButtonDisabled("Cancel", false);
        });
        fireEvent.input(username, { target: { value: "other@localhost" } });
        fireEvent.click(screen.getByRole("button", { name: "Use Account" }));
        await waitFor(() => {
            expectDialogButtonDisabled("Apply", false);
        });
        fireEvent.click(dialogButton("Apply"));
        await screen.findByRole("button", { name: "Applying" });

        view.rerender(<EnterpriseBackupConfiguration {...props} dialogOpen={false} />);
        await waitFor(() => {
            expect(document.querySelector("#closeButton")).toBeNull();
        });
        const reopenedProps = {
            ...props,
            configuration: {
                ...props.configuration,
                backupHomePath: "/stored-two",
                backupUser: "stored-two@localhost",
            },
        };
        view.rerender(<EnterpriseBackupConfiguration {...reopenedProps} dialogOpen />);
        await waitFor(() => {
            expectDialogButtonDisabled("Applying", true);
            expectDialogButtonDisabled("Cancel", true);
        });
        expect(validateBackupHome).toHaveBeenCalledOnce();

        await act(async () => {
            applyResult.resolve({
                ...configuredSetupState,
                configured: false,
                message: "Reopened Apply failed.",
            });
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(showErrorMessage).toHaveBeenCalledWith(
                "Cannot save MySQL Enterprise Backup configuration: Reopened Apply failed.",
                {},
            );
            expect(validateBackupHome).toHaveBeenCalledWith("session-1", "/stored-two");
            expect(validateBackupMysqlUser).toHaveBeenCalledWith(
                "session-1",
                "/stored-two",
                "stored-two@localhost",
                undefined,
            );
            expectDialogButtonDisabled("Cancel", false);
        });
        expect(applySetup).toHaveBeenCalledOnce();
        expect(props.onApplied).not.toHaveBeenCalled();
        expect(document.querySelector("#closeButton")).toBeTruthy();
    });

    it("ignores pending results after close and revalidates stored values on reopen", async () => {
        const staleHomeResult = deferred<IMebBackupHomeValidation>();
        const freshHomeResult = deferred<IMebBackupHomeValidation>();
        const freshAccountResult = deferred<IMebMysqlBackupUserValidation>();
        const validateBackupHome = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockReturnValueOnce(staleHomeResult.promise)
            .mockResolvedValueOnce({ ...validBackupHome, backupHomePath: "/stored-two" })
            .mockReturnValueOnce(freshHomeResult.promise);
        const validateBackupMysqlUser = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValueOnce(validBackupAccount)
            .mockReturnValueOnce(freshAccountResult.promise);
        const props = { ...defaultProps(), active: false, dialogOpen: true };
        const view = render(<EnterpriseBackupConfiguration {...props} />);

        await waitFor(() => {
            expect(validateBackupHome).toHaveBeenCalledOnce();
        });
        view.rerender(<EnterpriseBackupConfiguration {...props} dialogOpen={false} />);
        await waitFor(() => {
            expect(document.querySelector("#closeButton")).toBeNull();
        });

        const nextProps = {
            ...props,
            configuration: {
                ...props.configuration,
                backupHomePath: "/stored-two",
                backupUser: "stored-two@localhost",
            },
        };
        view.rerender(<EnterpriseBackupConfiguration {...nextProps} dialogOpen={false} />);
        await nextRunLoop();
        expect(validateBackupHome).toHaveBeenCalledOnce();
        expect(validateBackupMysqlUser).not.toHaveBeenCalled();

        view.rerender(<EnterpriseBackupConfiguration {...nextProps} dialogOpen />);
        await waitFor(() => {
            expect(validateBackupHome).toHaveBeenCalledWith("session-1", "/stored-two");
            expect(validateBackupMysqlUser).toHaveBeenCalledWith(
                "session-1",
                "/stored-two",
                "stored-two@localhost",
                undefined,
            );
        });
        expect(validateBackupHome).toHaveBeenCalledTimes(2);
        expect(validateBackupMysqlUser).toHaveBeenCalledOnce();
        expectDialogButtonDisabled("Apply", true);
        await waitFor(() => {
            expectDialogButtonDisabled("Cancel", false);
        });

        await selectDialogBackupHome("/new-draft");
        await waitFor(() => {
            expect(validateBackupHome).toHaveBeenCalledWith("session-1", "/new-draft");
            expectDialogButtonDisabled("Apply", true);
        });

        await act(async () => {
            freshHomeResult.resolve({ ...validBackupHome, backupHomePath: "/new-draft" });
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(validateBackupMysqlUser).toHaveBeenCalledWith(
                "session-1",
                "/new-draft",
                "stored-two@localhost",
                undefined,
            );
            expectDialogButtonDisabled("Apply", true);
        });

        await act(async () => {
            freshAccountResult.resolve(validBackupAccount);
            await Promise.resolve();
        });
        await waitFor(() => {
            expectDialogButtonDisabled("Apply", false);
        });

        await act(async () => {
            staleHomeResult.resolve(validBackupHome);
            await Promise.resolve();
        });
        await nextRunLoop();
        expect(validateBackupHome).toHaveBeenCalledTimes(3);
        expect(validateBackupMysqlUser).toHaveBeenCalledTimes(2);
        expect(screen.getByDisplayValue("/new-draft")).toBeTruthy();
        expectDialogButtonDisabled("Apply", false);
    });
});
