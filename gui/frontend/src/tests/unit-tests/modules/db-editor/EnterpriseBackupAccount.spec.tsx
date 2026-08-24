/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import type { ComponentChild } from "preact";
import { useState } from "preact/hooks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ui } from "../../../../app-logic/UILayer.js";
import {
    EnterpriseBackupAccount,
    type IEnterpriseBackupAccountProps,
} from "../../../../modules/db-editor/EnterpriseBackupAccount.js";
import type {
    MebOperation,
    MebOperationRunner,
} from "../../../../modules/db-editor/EnterpriseBackupOperation.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import type { IMebMysqlBackupUserValidation } from
    "../../../../supplement/ShellInterface/ShellInterfaceMeb.js";
import { deferred, nextRunLoop } from "../../test-helpers.js";

const validAccount: IMebMysqlBackupUserValidation = {
    exists: true,
    host: "localhost",
    loginFile: "/backups/.mylogin.cnf",
    loginPath: "mysql_workbench_meb_test",
    missingGrants: [],
    passwordStatus: { message: "Password stored.", tone: "ok" },
    passwordStored: true,
    status: { message: "Backup account is ready.", tone: "ok" },
    valid: true,
};

const missingAccount: IMebMysqlBackupUserValidation = {
    exists: false,
    host: "localhost",
    loginFile: null,
    loginPath: null,
    missingGrants: [],
    passwordStatus: { message: "Password not stored.", tone: "warn" },
    passwordStored: false,
    status: { message: "Backup account does not exist.", tone: "warn" },
    valid: false,
};

const accountWithoutPassword: IMebMysqlBackupUserValidation = {
    exists: true,
    host: "localhost",
    loginFile: null,
    loginPath: null,
    missingGrants: [],
    passwordStatus: { message: "Password not set.", tone: "warn" },
    passwordStored: false,
    status: { message: "Store the backup account password.", tone: "warn" },
    valid: false,
};

const accountWithoutGrants: IMebMysqlBackupUserValidation = {
    exists: true,
    host: "localhost",
    loginFile: "/backups/.mylogin.cnf",
    loginPath: "mysql_workbench_meb_test",
    missingGrants: ["BACKUP_ADMIN"],
    passwordStatus: { message: "Password stored.", tone: "ok" },
    passwordStored: true,
    status: { message: "Backup account grants are incomplete.", tone: "warn" },
    valid: false,
};

const genericInvalidAccount: IMebMysqlBackupUserValidation = {
    exists: true,
    host: "localhost",
    loginFile: "/backups/.mylogin.cnf",
    loginPath: "mysql_workbench_meb_test",
    missingGrants: [],
    passwordStatus: { message: "Password stored.", tone: "ok" },
    passwordStored: true,
    status: { message: "Backup account validation failed.", tone: "warn" },
    valid: false,
};

const runOperationImplementation = <T,>(
    _operation: MebOperation,
    callback: () => Promise<T>,
): Promise<T> => {
    return callback();
};

const createRunOperation = (): MebOperationRunner => {
    const runOperation = vi.fn(runOperationImplementation);

    return runOperation as unknown as MebOperationRunner;
};

const defaultAccountProps = (): IEnterpriseBackupAccountProps => {
    return {
        active: true,
        backupHomePath: "/backups",
        disabled: false,
        moduleSessionId: "session-1",
        runOperation: createRunOperation(),
        username: "mysqlbackup@localhost",
        onStateChange: vi.fn(),
        onUsernameChange: vi.fn(),
    };
};

const AccountHarness = (props: Partial<IEnterpriseBackupAccountProps> = {}): ComponentChild => {
    const [username, setUsername] = useState(props.username ?? "mysqlbackup@localhost");

    return <EnterpriseBackupAccount
        {...defaultAccountProps()}
        {...props}
        username={username}
        onUsernameChange={setUsername}
    />;
};

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

beforeEach(() => {
    vi.spyOn(ui, "showInformationMessage").mockResolvedValue(undefined);
});

describe("EnterpriseBackupAccount", () => {
    it("waits for activation and a validated home before checking the initial account", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validAccount);
        const onStateChange = vi.fn();
        const runOperation = createRunOperation();
        const props = {
            ...defaultAccountProps(),
            active: false,
            backupHomePath: undefined,
            onStateChange,
            runOperation,
        };
        const { rerender } = render(<EnterpriseBackupAccount {...props} />);

        expect(validate).not.toHaveBeenCalled();
        expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);

        rerender(<EnterpriseBackupAccount {...props} active />);
        expect(await screen.findByText("Waiting for a valid backup home.")).toBeTruthy();
        expect(validate).not.toHaveBeenCalled();

        rerender(<EnterpriseBackupAccount {...props} active backupHomePath="/backups" />);
        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith(
                "session-1",
                "/backups",
                "mysqlbackup@localhost",
                undefined,
            );
            expect(runOperation).toHaveBeenCalledWith("validateBackupAccount", expect.any(Function));
            expect(onStateChange).toHaveBeenLastCalledWith({
                moduleSessionId: "session-1",
                backupHomePath: "/backups",
                username: "mysqlbackup@localhost",
                valid: true,
            });
        });
    });

    it("automatically rechecks the displayed account for each home and module session", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validAccount);
        const props = defaultAccountProps();
        const { rerender } = render(<EnterpriseBackupAccount {...props} />);

        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith(
                "session-1",
                "/backups",
                "mysqlbackup@localhost",
                undefined,
            );
        });

        rerender(<EnterpriseBackupAccount {...props} backupHomePath="/other-home" />);
        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith(
                "session-1",
                "/other-home",
                "mysqlbackup@localhost",
                undefined,
            );
        });

        rerender(<EnterpriseBackupAccount
            {...props}
            backupHomePath="/other-home"
            moduleSessionId="session-2"
        />);
        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith(
                "session-2",
                "/other-home",
                "mysqlbackup@localhost",
                undefined,
            );
        });
        expect(validate).toHaveBeenCalledTimes(3);
    });

    it("waits for a module session without exposing an unusable account action", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validAccount);
        const props = { ...defaultAccountProps(), moduleSessionId: undefined };
        const { rerender } = render(<EnterpriseBackupAccount {...props} />);

        expect(await screen.findByText("Open a MySQL connection before checking the backup account.")).toBeTruthy();
        expect(screen.queryByText("Use Account")).toBeNull();
        expect(validate).not.toHaveBeenCalled();

        rerender(<EnterpriseBackupAccount {...props} moduleSessionId="session-1" />);
        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith(
                "session-1",
                "/backups",
                "mysqlbackup@localhost",
                undefined,
            );
        });
    });

    it("does not check while typing and validates changed nonempty text only through Use Account", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validAccount);
        const view = render(<AccountHarness />);
        await waitFor(() => {
            expect(validate).toHaveBeenCalledOnce();
        });
        await screen.findByText("Backup account is ready.");

        fireEvent.input(view.getByRole("textbox"), { target: { value: "other@localhost" } });
        expect(validate).toHaveBeenCalledOnce();
        expect(screen.getByText("Use Account")).toBeTruthy();
        expect(screen.getByText("Click Use Account to check this backup account.")).toBeTruthy();

        fireEvent.click(screen.getByText("Use Account"));
        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith(
                "session-1",
                "/backups",
                "other@localhost",
                undefined,
            );
        });
    });

    it("hides old remediation while editing and restores the trimmed matching result on revert", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(missingAccount);
        const view = render(<AccountHarness />);

        expect(await screen.findByText("Create User")).toBeTruthy();
        fireEvent.input(view.getByRole("textbox"), { target: { value: "other@localhost" } });
        expect(screen.queryByText("Create User")).toBeNull();
        expect(screen.getByText("Use Account")).toBeTruthy();

        fireEvent.input(view.getByRole("textbox"), { target: { value: "   " } });
        expect(screen.queryByText("Use Account")).toBeNull();
        expect(screen.getByText("Enter the backup MySQL username.")).toBeTruthy();

        fireEvent.input(view.getByRole("textbox"), { target: { value: "  mysqlbackup@localhost  " } });
        expect(screen.getByText("Create User")).toBeTruthy();
        expect(screen.queryByText("Use Account")).toBeNull();
        expect(validate).toHaveBeenCalledOnce();
    });

    it("does not show a separate password status for a nonexistent account", async () => {
        vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser").mockResolvedValue(missingAccount);

        render(<EnterpriseBackupAccount {...defaultAccountProps()} />);

        expect(await screen.findByText("Backup account does not exist.")).toBeTruthy();
        expect(screen.getByText("Create User")).toBeTruthy();
        expect(screen.queryByText("Password not set.")).toBeNull();
    });

    it("retries a declined initial check after the owning operation releases the surface", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(validAccount);
        let operationAttempts = 0;
        const decliningRunOperation: MebOperationRunner = async (_operation, callback) => {
            ++operationAttempts;
            if (operationAttempts === 1) {
                return undefined;
            }

            return callback();
        };
        const props = { ...defaultAccountProps(), runOperation: decliningRunOperation };
        const { rerender } = render(<EnterpriseBackupAccount {...props} />);

        await waitFor(() => {
            expect(operationAttempts).toBe(1);
        });
        expect(validate).not.toHaveBeenCalled();
        expect(screen.queryByText("Checking backup account.")).toBeNull();

        rerender(<EnterpriseBackupAccount {...props} disabled />);
        rerender(<EnterpriseBackupAccount {...props} />);
        await waitFor(() => {
            expect(operationAttempts).toBe(2);
            expect(validate).toHaveBeenCalledOnce();
        });
    });

    it("keeps the current remediation when its mutation is declined", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(missingAccount);
        const create = vi.spyOn(ShellInterface.meb, "createBackupMysqlUser")
            .mockResolvedValue(validAccount);
        let declineCreation = true;
        const decliningRunOperation: MebOperationRunner = async (operation, callback) => {
            if (operation === "createBackupAccount" && declineCreation) {
                declineCreation = false;

                return undefined;
            }

            return callback();
        };

        render(<EnterpriseBackupAccount {...defaultAccountProps()} runOperation={decliningRunOperation} />);
        fireEvent.click(await screen.findByText("Create User"));

        await waitFor(() => {
            expect(screen.getByText("Create User")).toBeTruthy();
            expect(screen.getByText("Backup account does not exist.")).toBeTruthy();
        });
        expect(create).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText("Create User"));
        await waitFor(() => {
            expect(create).toHaveBeenCalledOnce();
        });
        expect(validate).toHaveBeenCalledOnce();
    });

    it("ignores a late validation result for an old home and username pair", async () => {
        const oldResult = deferred<IMebMysqlBackupUserValidation>();
        const newResult = deferred<IMebMysqlBackupUserValidation>();
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockImplementation((_moduleSessionId, backupHomePath) => {
                return backupHomePath === "/backups" ? oldResult.promise : newResult.promise;
            });
        const onStateChange = vi.fn();
        const props = { ...defaultAccountProps(), onStateChange };
        const { rerender } = render(<EnterpriseBackupAccount {...props} />);

        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith(
                "session-1",
                "/backups",
                "mysqlbackup@localhost",
                undefined,
            );
        });
        rerender(<EnterpriseBackupAccount
            {...props}
            backupHomePath="/new-home"
            username="other@localhost"
        />);
        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith(
                "session-1",
                "/new-home",
                "other@localhost",
                undefined,
            );
        });

        await act(async () => {
            newResult.resolve({
                ...missingAccount,
                status: { message: "New account is missing.", tone: "warn" },
            });
            await Promise.resolve();
        });
        expect(await screen.findByText("New account is missing.")).toBeTruthy();

        await act(async () => {
            oldResult.resolve(validAccount);
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(screen.queryByText("Backup account is ready.")).toBeNull();
            expect(onStateChange).toHaveBeenLastCalledWith({
                moduleSessionId: "session-1",
                backupHomePath: "/new-home",
                username: "other@localhost",
                valid: false,
            });
        });
    });

    it("rejects a late result from an old module session at the same account selection", async () => {
        const firstSessionResult = deferred<IMebMysqlBackupUserValidation>();
        const secondSessionResult = deferred<IMebMysqlBackupUserValidation>();
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockImplementation((moduleSessionId) => {
                return moduleSessionId === "session-1"
                    ? firstSessionResult.promise
                    : secondSessionResult.promise;
            });
        const onStateChange = vi.fn();
        const props = { ...defaultAccountProps(), onStateChange };
        const { rerender } = render(<EnterpriseBackupAccount {...props} />);

        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith(
                "session-1",
                "/backups",
                "mysqlbackup@localhost",
                undefined,
            );
        });
        rerender(<EnterpriseBackupAccount {...props} moduleSessionId="session-2" />);
        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith(
                "session-2",
                "/backups",
                "mysqlbackup@localhost",
                undefined,
            );
        });

        await act(async () => {
            secondSessionResult.resolve({
                ...missingAccount,
                status: { message: "Session 2 account is missing.", tone: "warn" },
            });
            await Promise.resolve();
        });
        expect(await screen.findByText("Session 2 account is missing.")).toBeTruthy();

        await act(async () => {
            firstSessionResult.resolve(validAccount);
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(screen.queryByText("Backup account is ready.")).toBeNull();
            expect(onStateChange).toHaveBeenLastCalledWith({
                moduleSessionId: "session-2",
                backupHomePath: "/backups",
                username: "mysqlbackup@localhost",
                valid: false,
            });
        });
    });

    it("creates a missing account and uses the returned validation without checking again", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(missingAccount);
        const create = vi.spyOn(ShellInterface.meb, "createBackupMysqlUser")
            .mockResolvedValue(validAccount);
        const onStateChange = vi.fn();
        const runOperation = createRunOperation();

        render(<EnterpriseBackupAccount
            {...defaultAccountProps()}
            onStateChange={onStateChange}
            runOperation={runOperation}
        />);
        fireEvent.click(await screen.findByText("Create User"));

        await waitFor(() => {
            expect(create).toHaveBeenCalledWith(
                "session-1",
                "/backups",
                "mysqlbackup@localhost",
            );
            expect(runOperation).toHaveBeenCalledWith("createBackupAccount", expect.any(Function));
            expect(onStateChange).toHaveBeenLastCalledWith({
                moduleSessionId: "session-1",
                backupHomePath: "/backups",
                username: "mysqlbackup@localhost",
                valid: true,
            });
        });
        expect(validate).toHaveBeenCalledOnce();
    });

    it("disables the account surface and rejects duplicate clicks while a mutation is pending", async () => {
        const mutationResult = deferred<IMebMysqlBackupUserValidation>();
        vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser").mockResolvedValue(missingAccount);
        const create = vi.spyOn(ShellInterface.meb, "createBackupMysqlUser")
            .mockReturnValue(mutationResult.promise);

        render(<EnterpriseBackupAccount {...defaultAccountProps()} />);
        fireEvent.click(await screen.findByText("Create User"));

        const creatingButton = await screen.findByText("Creating");
        expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
        expect(creatingButton.classList.contains("disabled")).toBe(true);
        fireEvent.click(creatingButton);
        expect(create).toHaveBeenCalledOnce();

        await act(async () => {
            mutationResult.resolve(validAccount);
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(screen.getByRole("textbox")).toHaveProperty("disabled", false);
        });
    });

    it("stores an existing password and uses the returned validation without a passwordless recheck", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValueOnce(accountWithoutPassword)
            .mockResolvedValueOnce(validAccount);
        vi.spyOn(ui, "requestPassword").mockResolvedValue("secret");
        const runOperation = createRunOperation();

        render(<EnterpriseBackupAccount {...defaultAccountProps()} runOperation={runOperation} />);
        fireEvent.click(await screen.findByText("Input Password"));

        await waitFor(() => {
            expect(validate).toHaveBeenNthCalledWith(
                2,
                "session-1",
                "/backups",
                "mysqlbackup@localhost",
                "secret",
            );
            expect(runOperation).toHaveBeenCalledWith("storeBackupAccountPassword", expect.any(Function));
            expect(screen.queryByText("Input Password")).toBeNull();
        });
        expect(validate).toHaveBeenCalledTimes(2);
    });

    it("fixes missing grants and uses the returned validation without checking again", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(accountWithoutGrants);
        const fix = vi.spyOn(ShellInterface.meb, "fixBackupMysqlUser")
            .mockResolvedValue(validAccount);
        const runOperation = createRunOperation();

        render(<EnterpriseBackupAccount {...defaultAccountProps()} runOperation={runOperation} />);
        fireEvent.click(await screen.findByText("Fix Account"));

        await waitFor(() => {
            expect(fix).toHaveBeenCalledWith(
                "session-1",
                "/backups",
                "mysqlbackup@localhost",
            );
            expect(runOperation).toHaveBeenCalledWith("fixBackupAccount", expect.any(Function));
            expect(screen.queryByText("Fix Account")).toBeNull();
        });
        expect(validate).toHaveBeenCalledOnce();
    });

    it("resets the password entered through the password prompt without checking again", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(accountWithoutPassword);
        const reset = vi.spyOn(ShellInterface.meb, "resetBackupMysqlUserPassword")
            .mockResolvedValue(validAccount);
        vi.spyOn(ui, "requestPassword").mockResolvedValue("new-secret");
        const runOperation = createRunOperation();

        render(<EnterpriseBackupAccount {...defaultAccountProps()} runOperation={runOperation} />);
        fireEvent.click(await screen.findByText("Reset Password"));

        await waitFor(() => {
            expect(reset).toHaveBeenCalledWith(
                "session-1",
                "/backups",
                "mysqlbackup@localhost",
                "new-secret",
            );
            expect(runOperation).toHaveBeenCalledWith("resetBackupAccountPassword", expect.any(Function));
            expect(screen.queryByText("Reset Password")).toBeNull();
        });
        expect(validate).toHaveBeenCalledOnce();
    });

    it("can reset an existing account to a random password", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(accountWithoutPassword);
        const reset = vi.spyOn(ShellInterface.meb, "resetBackupMysqlUserPassword")
            .mockResolvedValue(validAccount);
        const runOperation = createRunOperation();

        render(<EnterpriseBackupAccount {...defaultAccountProps()} runOperation={runOperation} />);
        fireEvent.click(await screen.findByText("Reset to Random Password"));

        await waitFor(() => {
            expect(reset).toHaveBeenCalledWith(
                "session-1",
                "/backups",
                "mysqlbackup@localhost",
                undefined,
            );
            expect(runOperation).toHaveBeenCalledWith("resetBackupAccountPassword", expect.any(Function));
        });
        expect(validate).toHaveBeenCalledOnce();
    });

    it("ignores a late mutation result after the username is edited", async () => {
        const mutationResult = deferred<IMebMysqlBackupUserValidation>();
        vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser").mockResolvedValue(missingAccount);
        vi.spyOn(ShellInterface.meb, "createBackupMysqlUser").mockReturnValue(mutationResult.promise);
        const onStateChange = vi.fn();
        const props = { ...defaultAccountProps(), onStateChange };
        const { rerender } = render(<EnterpriseBackupAccount {...props} />);

        fireEvent.click(await screen.findByText("Create User"));
        rerender(<EnterpriseBackupAccount {...props} username="other@localhost" />);

        await act(async () => {
            mutationResult.resolve(validAccount);
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(screen.getByText("Use Account")).toBeTruthy();
            expect(screen.queryByText("Backup account is ready.")).toBeNull();
            expect(onStateChange).toHaveBeenLastCalledWith({
                moduleSessionId: "session-1",
                backupHomePath: "/backups",
                username: "other@localhost",
                valid: false,
            });
        });
    });

    it("ignores a rejected mutation after the account selection changes", async () => {
        let rejectMutation: ((reason: unknown) => void) | undefined;
        const mutation = new Promise<IMebMysqlBackupUserValidation>((_resolve, reject) => {
            rejectMutation = reject;
        });
        vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser").mockResolvedValue(missingAccount);
        vi.spyOn(ShellInterface.meb, "createBackupMysqlUser").mockReturnValue(mutation);
        const showErrorMessage = vi.spyOn(ui, "showErrorMessage").mockResolvedValue(undefined);
        const props = defaultAccountProps();
        const { rerender } = render(<EnterpriseBackupAccount {...props} />);

        fireEvent.click(await screen.findByText("Create User"));
        rerender(<EnterpriseBackupAccount {...props} username="other@localhost" />);

        await act(async () => {
            rejectMutation?.(new Error("Old account creation failed."));
            await Promise.resolve();
        });
        await nextRunLoop();
        expect(screen.getByText("Use Account")).toBeTruthy();
        expect(screen.queryByText("Old account creation failed.")).toBeNull();
        expect(showErrorMessage).not.toHaveBeenCalled();
    });

    it("offers Check Again after a generic invalid result", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValue(genericInvalidAccount);

        render(<EnterpriseBackupAccount {...defaultAccountProps()} />);
        fireEvent.click(await screen.findByText("Check Again"));

        await waitFor(() => {
            expect(validate).toHaveBeenCalledTimes(2);
        });
    });

    it("clears cached validation after a rejected Check Again request", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockResolvedValueOnce(genericInvalidAccount)
            .mockRejectedValueOnce(new Error("Validation service unavailable."));

        render(<EnterpriseBackupAccount {...defaultAccountProps()} />);

        expect(await screen.findByText("Password valid.")).toBeTruthy();
        fireEvent.click(screen.getByText("Check Again"));

        expect(await screen.findByText("Validation service unavailable.")).toBeTruthy();
        expect(screen.queryByText("Password valid.")).toBeNull();
        expect(screen.getByText("Check Again")).toBeTruthy();
        expect(validate).toHaveBeenCalledTimes(2);
    });

    it("offers Check Again after a rejected account check", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser")
            .mockRejectedValue(new Error("Validation service unavailable."));

        render(<EnterpriseBackupAccount {...defaultAccountProps()} />);

        expect(await screen.findByText("Validation service unavailable.")).toBeTruthy();
        fireEvent.click(screen.getByText("Check Again"));
        await waitFor(() => {
            expect(validate).toHaveBeenCalledTimes(2);
        });
    });

    it("disables the input and remediation actions with the inactive or disabled surface", async () => {
        vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser").mockResolvedValue(missingAccount);
        const create = vi.spyOn(ShellInterface.meb, "createBackupMysqlUser")
            .mockResolvedValue(validAccount);
        const props = defaultAccountProps();
        const { rerender } = render(<EnterpriseBackupAccount {...props} />);

        const createButton = await screen.findByText("Create User");
        rerender(<EnterpriseBackupAccount {...props} disabled />);
        expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
        expect(createButton.classList.contains("disabled")).toBe(true);
        fireEvent.click(createButton);
        expect(create).not.toHaveBeenCalled();

        rerender(<EnterpriseBackupAccount {...props} active={false} />);
        expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
        expect(screen.queryByText("Create User")).toBeNull();
    });

    it("does not re-emit unchanged state when the callback identity changes", async () => {
        vi.spyOn(ShellInterface.meb, "validateBackupMysqlUser").mockResolvedValue(validAccount);
        const firstStateChange = vi.fn();
        const secondStateChange = vi.fn();
        const props = { ...defaultAccountProps(), onStateChange: firstStateChange };
        const { rerender } = render(<EnterpriseBackupAccount {...props} />);

        await waitFor(() => {
            expect(firstStateChange).toHaveBeenLastCalledWith({
                moduleSessionId: "session-1",
                backupHomePath: "/backups",
                username: "mysqlbackup@localhost",
                valid: true,
            });
        });

        rerender(<EnterpriseBackupAccount {...props} onStateChange={secondStateChange} />);
        await act(async () => {
            await Promise.resolve();
        });
        expect(secondStateChange).not.toHaveBeenCalled();

        rerender(<EnterpriseBackupAccount
            {...props}
            username="other@localhost"
            onStateChange={secondStateChange}
        />);
        await waitFor(() => {
            expect(secondStateChange).toHaveBeenCalledWith({
                moduleSessionId: "session-1",
                backupHomePath: "/backups",
                username: "other@localhost",
                valid: false,
            });
        });
    });
});
