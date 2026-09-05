/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ui } from "../../../../app-logic/UILayer.js";
import { EnterpriseBackupRestoreDialog } from
    "../../../../modules/db-editor/EnterpriseBackupRestoreDialog.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import type { IMebStatus } from "../../../../supplement/ShellInterface/ShellInterfaceMeb.js";

const backupContent = {
    activityId: "backup-1",
    applyLogDone: true,
    backupHome: "/backups",
    backupLabel: "2026-07-20_12-00-00",
    backupScope: "Full",
    binlogFile: "binlog.000001",
    binlogPosition: "123",
    endTime: null,
    fileGroups: [],
    gtidExecuted: "uuid:1-10",
    hasInstanceData: true,
    mysqlVersion: "8.4.0",
    restoreChain: [],
    rows: [],
    startTime: null,
    warnings: [],
};

const renderDialog = (onBusyChange = vi.fn(), onStatusChange = vi.fn()) => {
    return render(<EnterpriseBackupRestoreDialog
        activityId="backup-1"
        backupHomePath="/backups"
        datadir="/var/lib/mysql"
        disabled={false}
        moduleSessionId="session-1"
        restoreDetails={{
            backupType: "Full",
            profile: "Nightly",
            timestamp: "2026-07-20 12:00:00",
        }}
        onBusyChange={onBusyChange}
        onClose={vi.fn()}
        onStatusChange={onStatusChange}
    />);
};

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("EnterpriseBackupRestoreDialog", () => {
    it("loads and displays restore metadata", async () => {
        const readBackupContent = vi.spyOn(ShellInterface.meb, "readBackupContent").mockResolvedValue(backupContent);

        renderDialog();

        expect(await screen.findByText("uuid:1-10")).toBeTruthy();
        expect(screen.getByText("binlog.000001:123")).toBeTruthy();
        expect(screen.getByText("/var/lib/mysql")).toBeTruthy();
        expect(readBackupContent).toHaveBeenCalledWith("session-1", "/backups", "backup-1");
    });

    it("reports a successful restore and stops polling", async () => {
        const status = {} as IMebStatus;
        const onBusyChange = vi.fn();
        const onStatusChange = vi.fn();
        vi.spyOn(ShellInterface.meb, "readBackupContent").mockResolvedValue(backupContent);
        vi.spyOn(ShellInterface.meb, "getRestoreProgress").mockResolvedValue({
            operationId: "restore-1",
            output: "Restoring",
            state: "running",
        });
        vi.spyOn(ShellInterface.meb, "restoreBackup").mockResolvedValue({
            aborted: false,
            message: "Done",
            output: "Done",
            status,
            succeeded: true,
        });
        vi.spyOn(ui, "showInformationMessage").mockResolvedValue(undefined);

        renderDialog(onBusyChange, onStatusChange);
        fireEvent.click(await screen.findByText("Restore"));

        await waitFor(() => {
            expect(onStatusChange).toHaveBeenCalledWith(status);
            expect(onBusyChange).toHaveBeenLastCalledWith(false);
        });
    });

    it("stops restore polling when unmounted", async () => {
        let finishRestore: (() => void) | undefined;
        let pollTimer: (() => void) | undefined;
        vi.spyOn(globalThis, "setInterval").mockImplementation((handler) => {
            pollTimer = handler as () => void;

            return 1;
        });
        vi.spyOn(ShellInterface.meb, "readBackupContent").mockResolvedValue(backupContent);
        const getRestoreProgress = vi.spyOn(ShellInterface.meb, "getRestoreProgress").mockResolvedValue({
            operationId: "restore-1",
            output: "",
            state: "running",
        });
        vi.spyOn(ShellInterface.meb, "restoreBackup").mockImplementation(async () => {
            await new Promise<void>((resolve) => {
                finishRestore = resolve;
            });

            return { aborted: false, message: "Done", output: "", status: {} as IMebStatus, succeeded: true };
        });

        const view = renderDialog();
        await act(async () => {
            await Promise.resolve();
        });
        fireEvent.click(screen.getByText("Restore"));
        await act(async () => {
            await Promise.resolve();
        });
        const callsBeforeUnmount = getRestoreProgress.mock.calls.length;

        await act(async () => {
            view.unmount();
            pollTimer?.();
            await Promise.resolve();
        });

        expect(getRestoreProgress).toHaveBeenCalledTimes(callsBeforeUnmount);
        finishRestore?.();
    });
});
