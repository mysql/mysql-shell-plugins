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
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    EnterpriseBackupHome,
    type IEnterpriseBackupHomeProps,
} from "../../../../modules/db-editor/EnterpriseBackupHome.js";
import type {
    MebOperation,
    MebOperationRunner,
} from "../../../../modules/db-editor/EnterpriseBackupOperation.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import type { IMebBackupHomeValidation } from "../../../../supplement/ShellInterface/ShellInterfaceMeb.js";
import { deferred } from "../../test-helpers.js";

const validBackupHome = {
    backupHomePath: "/backups",
    exists: true,
    status: { message: "Backup home is ready.", tone: "ok" },
    valid: true,
} as IMebBackupHomeValidation;

const missingBackupHome = {
    backupHomePath: "/backups",
    exists: false,
    status: { message: "Backup home does not exist.", tone: "warn" },
    valid: false,
} as IMebBackupHomeValidation;

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

const defaultHomeProps = (): IEnterpriseBackupHomeProps => {
    return {
        active: true,
        disabled: false,
        moduleSessionId: "session-1",
        path: "/backups",
        runOperation: createRunOperation(),
        onPathChange: vi.fn(),
        onStateChange: vi.fn(),
    };
};

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("EnterpriseBackupHome", () => {
    it("validates its initial path and reports the validated path", async () => {
        const validationResult = deferred<IMebBackupHomeValidation>();
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockReturnValue(validationResult.promise);
        const onStateChange = vi.fn();
        const runOperation = createRunOperation();

        render(<EnterpriseBackupHome
            {...defaultHomeProps()}
            onStateChange={onStateChange}
            runOperation={runOperation}
        />);

        await waitFor(() => {
            expect(validate).toHaveBeenCalledOnce();
            expect(runOperation).toHaveBeenCalledWith("validateBackupHome", expect.any(Function));
            expect(onStateChange).toHaveBeenLastCalledWith({
                moduleSessionId: "session-1",
                path: "/backups",
                valid: false,
            });
        });

        await act(async () => {
            validationResult.resolve(validBackupHome);
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(onStateChange).toHaveBeenLastCalledWith({
                moduleSessionId: "session-1",
                path: "/backups",
                valid: true,
                validatedPath: "/backups",
            });
        });
    });

    it("waits until activation and fully disables the picker", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockResolvedValue(validBackupHome);
        const onPathChange = vi.fn();
        const props = { ...defaultHomeProps(), active: false, disabled: true, onPathChange };
        const { rerender } = render(<EnterpriseBackupHome {...props} />);

        expect(screen.getByRole("textbox")).toHaveProperty("readOnly", true);
        expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
        expect(validate).not.toHaveBeenCalled();

        await act(async () => {
            await requisitions.execute("selectFile", {
                resourceId: "enterpriseBackupHome",
                file: [{ path: "/ignored", content: new ArrayBuffer(0) }],
            });
        });
        expect(onPathChange).not.toHaveBeenCalled();

        rerender(<EnterpriseBackupHome {...props} active disabled={false} />);
        await waitFor(() => {
            expect(validate).toHaveBeenCalledOnce();
        });
    });

    it("checks each path selected with the picker exactly once", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockImplementation((_moduleSessionId, path) => {
                return Promise.resolve({ ...validBackupHome, backupHomePath: path });
            });
        const onPathChange = vi.fn();

        const HomeHarness = (): ComponentChild => {
            const [path, setPath] = useState("/backups");

            return <EnterpriseBackupHome
                {...defaultHomeProps()}
                path={path}
                onPathChange={(nextPath) => {
                    onPathChange(nextPath);
                    setPath(nextPath);
                }}
            />;
        };

        render(<HomeHarness />);
        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith("session-1", "/backups");
        });

        await act(async () => {
            await requisitions.execute("selectFile", {
                resourceId: "enterpriseBackupHome",
                file: [{ path: "/selected", content: new ArrayBuffer(0) }],
            });
        });

        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith("session-1", "/selected");
        });
        expect(onPathChange).toHaveBeenCalledWith("/selected");
        expect(validate).toHaveBeenCalledTimes(2);
    });

    it("offers Check Again after a generic failure and retries the check", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockRejectedValue(new Error("Validation service unavailable."));

        render(<EnterpriseBackupHome {...defaultHomeProps()} />);

        expect(await screen.findByText("Validation service unavailable.")).toBeTruthy();
        fireEvent.click(screen.getByText("Check Again"));

        await waitFor(() => {
            expect(validate).toHaveBeenCalledTimes(2);
        });
    });

    it("creates a missing home without validating its canonical path twice", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockResolvedValue({ ...missingBackupHome, backupHomePath: "/requested" });
        const canonicalHome = {
            ...validBackupHome,
            backupHomePath: "/canonical/backups",
        };
        const create = vi.spyOn(ShellInterface.meb, "createBackupHome").mockResolvedValue(canonicalHome);
        const onPathChange = vi.fn();
        const onStateChange = vi.fn();
        const runOperation = createRunOperation();

        const HomeHarness = (): ComponentChild => {
            const [path, setPath] = useState("/requested");

            return <EnterpriseBackupHome
                {...defaultHomeProps()}
                path={path}
                onPathChange={(nextPath) => {
                    onPathChange(nextPath);
                    setPath(nextPath);
                }}
                onStateChange={onStateChange}
                runOperation={runOperation}
            />;
        };

        render(<HomeHarness />);
        fireEvent.click(await screen.findByText("Create"));

        await waitFor(() => {
            expect(create).toHaveBeenCalledWith("session-1", "/requested");
            expect(runOperation).toHaveBeenCalledWith("createBackupHome", expect.any(Function));
            expect(onPathChange).toHaveBeenCalledWith("/canonical/backups");
            expect(onStateChange).toHaveBeenLastCalledWith({
                moduleSessionId: "session-1",
                path: "/canonical/backups",
                valid: true,
                validatedPath: "/canonical/backups",
            });
        });
        expect(validate).toHaveBeenCalledOnce();
    });

    it("disables a missing-home action with the rest of the surface", async () => {
        vi.spyOn(ShellInterface.meb, "validateBackupHome").mockResolvedValue(missingBackupHome);
        const create = vi.spyOn(ShellInterface.meb, "createBackupHome").mockResolvedValue(validBackupHome);
        const props = defaultHomeProps();
        const { rerender } = render(<EnterpriseBackupHome {...props} />);

        const createButton = await screen.findByText("Create");
        rerender(<EnterpriseBackupHome {...props} disabled />);

        expect(createButton.classList.contains("disabled")).toBe(true);
        fireEvent.click(createButton);
        expect(create).not.toHaveBeenCalled();
    });

    it("ignores a late validation result for an old path", async () => {
        const oldResult = deferred<IMebBackupHomeValidation>();
        const selectedResult = deferred<IMebBackupHomeValidation>();
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockImplementation((_moduleSessionId, path) => {
                return path === "/backups" ? oldResult.promise : selectedResult.promise;
            });
        const onStateChange = vi.fn();
        const props = { ...defaultHomeProps(), onStateChange };
        const { rerender } = render(<EnterpriseBackupHome {...props} />);

        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith("session-1", "/backups");
        });
        rerender(<EnterpriseBackupHome {...props} path="/selected" />);
        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith("session-1", "/selected");
        });

        await act(async () => {
            selectedResult.resolve({
                ...missingBackupHome,
                backupHomePath: "/selected",
                status: { message: "Selected home does not exist.", tone: "warn" },
            });
            await Promise.resolve();
        });
        expect(await screen.findByText("Selected home does not exist.")).toBeTruthy();

        await act(async () => {
            oldResult.resolve(validBackupHome);
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(screen.queryByText("Backup home is ready.")).toBeNull();
            expect(onStateChange).toHaveBeenLastCalledWith({
                moduleSessionId: "session-1",
                path: "/selected",
                valid: false,
            });
        });
    });

    it("retries a declined validation after the owning operation releases the surface", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockResolvedValue(validBackupHome);
        let operationAttempts = 0;
        const decliningRunOperation: MebOperationRunner = async (_operation, callback) => {
            ++operationAttempts;
            if (operationAttempts === 1) {
                return undefined;
            }

            return callback();
        };
        const props = { ...defaultHomeProps(), runOperation: decliningRunOperation };
        const { rerender } = render(<EnterpriseBackupHome {...props} />);

        await waitFor(() => {
            expect(operationAttempts).toBe(1);
        });
        expect(validate).not.toHaveBeenCalled();

        rerender(<EnterpriseBackupHome {...props} disabled />);
        rerender(<EnterpriseBackupHome {...props} />);

        await waitFor(() => {
            expect(operationAttempts).toBe(2);
            expect(validate).toHaveBeenCalledOnce();
        });
    });

    it("keeps a missing-home result when creation is declined", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockResolvedValue(missingBackupHome);
        const create = vi.spyOn(ShellInterface.meb, "createBackupHome")
            .mockResolvedValue(validBackupHome);
        let declineCreation = true;
        const decliningRunOperation: MebOperationRunner = async (operation, callback) => {
            if (operation === "createBackupHome" && declineCreation) {
                declineCreation = false;

                return undefined;
            }

            return callback();
        };

        render(<EnterpriseBackupHome {...defaultHomeProps()} runOperation={decliningRunOperation} />);
        fireEvent.click(await screen.findByText("Create"));

        await waitFor(() => {
            expect(screen.getByText("Create")).toBeTruthy();
            expect(screen.getByText("Backup home does not exist.")).toBeTruthy();
        });
        expect(create).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText("Create"));
        await waitFor(() => {
            expect(create).toHaveBeenCalledOnce();
        });
        expect(validate).toHaveBeenCalledOnce();
    });

    it("validates an unchanged path when a module session becomes available", async () => {
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockResolvedValue(validBackupHome);
        const props = { ...defaultHomeProps(), moduleSessionId: undefined };
        const { rerender } = render(<EnterpriseBackupHome {...props} />);

        expect(await screen.findByText("Open a MySQL connection before checking the backup home.")).toBeTruthy();
        expect(validate).not.toHaveBeenCalled();

        rerender(<EnterpriseBackupHome {...props} moduleSessionId="session-1" />);
        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith("session-1", "/backups");
        });
    });

    it("rejects a late result from an old module session at the same path", async () => {
        const firstSessionResult = deferred<IMebBackupHomeValidation>();
        const secondSessionResult = deferred<IMebBackupHomeValidation>();
        const validate = vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockImplementation((moduleSessionId) => {
                return moduleSessionId === "session-1" ? firstSessionResult.promise : secondSessionResult.promise;
            });
        const onStateChange = vi.fn();
        const props = { ...defaultHomeProps(), onStateChange };
        const { rerender } = render(<EnterpriseBackupHome {...props} />);

        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith("session-1", "/backups");
        });
        rerender(<EnterpriseBackupHome {...props} moduleSessionId="session-2" />);
        await waitFor(() => {
            expect(validate).toHaveBeenCalledWith("session-2", "/backups");
        });

        await act(async () => {
            secondSessionResult.resolve({
                ...missingBackupHome,
                status: { message: "Session 2 home is missing.", tone: "warn" },
            });
            await Promise.resolve();
        });
        expect(await screen.findByText("Session 2 home is missing.")).toBeTruthy();

        await act(async () => {
            firstSessionResult.resolve(validBackupHome);
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(screen.queryByText("Backup home is ready.")).toBeNull();
            expect(onStateChange).toHaveBeenLastCalledWith({
                moduleSessionId: "session-2",
                path: "/backups",
                valid: false,
            });
        });
    });

    it("does not re-emit unchanged state when the callback identity changes", async () => {
        const nextPathResult = deferred<IMebBackupHomeValidation>();
        vi.spyOn(ShellInterface.meb, "validateBackupHome")
            .mockImplementation((_moduleSessionId, path) => {
                return path === "/backups" ? Promise.resolve(validBackupHome) : nextPathResult.promise;
            });
        const firstStateChange = vi.fn();
        const secondStateChange = vi.fn();
        const props = { ...defaultHomeProps(), onStateChange: firstStateChange };
        const { rerender } = render(<EnterpriseBackupHome {...props} />);

        await waitFor(() => {
            expect(firstStateChange).toHaveBeenLastCalledWith({
                moduleSessionId: "session-1",
                path: "/backups",
                valid: true,
                validatedPath: "/backups",
            });
        });

        rerender(<EnterpriseBackupHome {...props} onStateChange={secondStateChange} />);
        await act(async () => {
            await Promise.resolve();
        });
        expect(secondStateChange).not.toHaveBeenCalled();

        rerender(<EnterpriseBackupHome {...props} path="/next" onStateChange={secondStateChange} />);
        await waitFor(() => {
            expect(secondStateChange).toHaveBeenCalledWith({
                moduleSessionId: "session-1",
                path: "/next",
                valid: false,
            });
        });
    });
});
