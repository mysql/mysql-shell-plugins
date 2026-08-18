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

import { render, screen } from "@testing-library/preact";
import { h, type ComponentChild } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import MigrationSubApp, {
    getMigrationSetupStatusMessage,
    getSourceSelectionCommitErrorAction,
    getSourceSelectionCommitErrorDialogContent,
    parseOciSignInInfo
} from "../../../../app-logic/MigrationSubApp/MigrationSubApp.js";
import {
    CheckStatus,
    type IProjectData,
    type IWorkStatusInfo,
    type IMigrationChecksData,
    MessageLevel,
    SubStepId,
    WorkStatus,
} from "../../../../communication/ProtocolMigration.js";
import { requisitions } from "../../../../supplement/Requisitions.js";

interface IMigrationSubAppUnderTest {
    migration: { workStart: () => Promise<IWorkStatusInfo>; };
    migrationStarted: boolean;
    commitRest: () => Promise<void>;
    fetchWorkStatus: () => Promise<IWorkStatusInfo>;
    monitorWorkProgress: () => Promise<void>;
    startMigration: () => Promise<void>;
    updateWorkStatus: (tiles: unknown[], workStatus: IWorkStatusInfo) => Promise<void>;
}

const project: IProjectData = {
    id: "project-1",
    name: "Migration test",
    path: "/tmp/migration-test",
    source: "mysql://root@localhost:3306",
    modifyTime: "2026-08-06T00:00:00Z",
    dataMigrationDidFinish: false,
};

const workStatus = (status: WorkStatus): IWorkStatusInfo => {
    return { status, stages: [], summary: {} } as IWorkStatusInfo;
};

const asUnderTest = (migrationSubApp: MigrationSubApp): IMigrationSubAppUnderTest => {
    return migrationSubApp as unknown as IMigrationSubAppUnderTest;
};

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe("MigrationSubApp status helpers", () => {
    it("extracts OCI sign-in progress messages from JSON data", () => {
        const signInInfo = parseOciSignInInfo(JSON.stringify({
            message: "Open the OCI sign-in page.",
            info: {
                url: "https://example.com/sign-in",
            },
        }));

        expect(signInInfo.message).toBe("Open the OCI sign-in page.");
        expect(signInInfo.info?.url).toBe("https://example.com/sign-in");
    });

    it("keeps OCI sign-in progress readable when data is not JSON", () => {
        const signInInfo = parseOciSignInInfo("Authentication completed successfully.");

        expect(signInInfo.message).toBe("Authentication completed successfully.");
    });

    it("uses the parsed OCI sign-in message for the footer status", () => {
        const signInInfo = parseOciSignInInfo(JSON.stringify({
            message: "Waiting for OCI authentication...",
        }));

        expect(getMigrationSetupStatusMessage({
            ociLoginInProgress: true,
            ociSignInStatusMessage: signInInfo.message,
        })).toBe("Waiting for OCI authentication...");
    });

    it("keeps OCI sign-in status through the whole sign-in operation", () => {
        expect(getMigrationSetupStatusMessage({
            ociLoginInProgress: true,
            ociSignInStatusMessage: "Loading OCI profile...",
        })).toBe("Loading OCI profile...");
    });

    it("appends the new OCI API key hint to later spinner status messages in the same session", () => {
        const hint = "This may take longer than usual because the new OCI API keys need time to propagate.";

        expect(getMigrationSetupStatusMessage({
            isFetchingVcns: true,
            ociNewApiKeyUploadedThisSession: true,
        })).toBe(`Loading virtual cloud networks... ${hint}`);

        expect(getMigrationSetupStatusMessage({
            backendRequestInProgress: true,
            backendRequestStatusMessage: "Refreshing migration plan...",
            ociNewApiKeyUploadedThisSession: true,
        })).toBe(`Refreshing migration plan... ${hint}`);
    });

    it("uses backend request status messages while the backend spinner is active", () => {
        expect(getMigrationSetupStatusMessage({
            backendRequestInProgress: true,
            backendRequestStatusMessage: "Refreshing migration plan...",
        })).toBe("Refreshing migration plan...");
    });

    it("uses target selection loading messages while target spinners are active", () => {
        expect(getMigrationSetupStatusMessage({
            isFetchingShapes: true,
        })).toBe("Loading available shapes...");
    });

    it("uses a loading message while OCI compartments are being fetched", () => {
        expect(getMigrationSetupStatusMessage({
            isFetchingCompartments: true,
        })).toBe("Loading OCI compartments...");
    });
});

describe("MigrationSubApp migration lifecycle", () => {
    it.each([
        WorkStatus.FINISHED,
        WorkStatus.ERROR,
        WorkStatus.ABORTED,
    ])("releases the desktop close guard when work status is %s", async (status) => {
        const migrationSubApp = new MigrationSubApp({});
        const migrationSubAppUnderTest = asUnderTest(migrationSubApp);
        const executeRemote = vi.spyOn(requisitions, "executeRemote");

        migrationSubAppUnderTest.migrationStarted = true;
        vi.spyOn(migrationSubAppUnderTest, "fetchWorkStatus").mockResolvedValue(workStatus(status));
        vi.spyOn(migrationSubAppUnderTest, "updateWorkStatus").mockResolvedValue();

        await migrationSubAppUnderTest.monitorWorkProgress();

        expect(migrationSubApp.state.migrationInProgress).toBe(false);
        expect(executeRemote).toHaveBeenCalledTimes(1);
        expect(executeRemote).toHaveBeenCalledWith("migrationStopped", undefined);
    });

    it("releases the close guard at ready while continuing to monitor replication", async () => {
        vi.useFakeTimers();

        const migrationSubApp = new MigrationSubApp({});
        const migrationSubAppUnderTest = asUnderTest(migrationSubApp);
        const executeRemote = vi.spyOn(requisitions, "executeRemote");
        const fetchWorkStatus = vi.spyOn(migrationSubAppUnderTest, "fetchWorkStatus")
            .mockResolvedValueOnce(workStatus(WorkStatus.READY))
            .mockResolvedValueOnce(workStatus(WorkStatus.FINISHED));

        migrationSubAppUnderTest.migrationStarted = true;
        vi.spyOn(migrationSubAppUnderTest, "updateWorkStatus").mockResolvedValue();

        const monitor = migrationSubAppUnderTest.monitorWorkProgress();
        await vi.advanceTimersByTimeAsync(0);

        expect(fetchWorkStatus).toHaveBeenCalledTimes(1);
        expect(executeRemote).toHaveBeenCalledWith("migrationStopped", undefined);

        await vi.advanceTimersByTimeAsync(2000);
        await monitor;

        expect(fetchWorkStatus).toHaveBeenCalledTimes(2);
        expect(executeRemote).toHaveBeenCalledTimes(1);
        expect(migrationSubApp.state.migrationInProgress).toBe(false);
    });

    it("continues monitoring while work is in progress", async () => {
        vi.useFakeTimers();

        const migrationSubApp = new MigrationSubApp({});
        const migrationSubAppUnderTest = asUnderTest(migrationSubApp);
        const executeRemote = vi.spyOn(requisitions, "executeRemote");
        const fetchWorkStatus = vi.spyOn(migrationSubAppUnderTest, "fetchWorkStatus")
            .mockResolvedValueOnce(workStatus(WorkStatus.IN_PROGRESS))
            .mockResolvedValueOnce(workStatus(WorkStatus.FINISHED));

        migrationSubAppUnderTest.migrationStarted = true;
        vi.spyOn(migrationSubAppUnderTest, "updateWorkStatus").mockResolvedValue();

        const monitor = migrationSubAppUnderTest.monitorWorkProgress();
        await vi.advanceTimersByTimeAsync(0);

        expect(fetchWorkStatus).toHaveBeenCalledTimes(1);
        expect(executeRemote).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(2000);
        await monitor;

        expect(executeRemote).toHaveBeenCalledWith("migrationStopped", undefined);
    });

    it("releases the desktop close guard when progress monitoring fails", async () => {
        const migrationSubApp = new MigrationSubApp({});
        const migrationSubAppUnderTest = asUnderTest(migrationSubApp);
        const executeRemote = vi.spyOn(requisitions, "executeRemote");
        vi.spyOn(console, "error").mockImplementation(() => {
            return undefined;
        });

        migrationSubAppUnderTest.migrationStarted = true;
        vi.spyOn(migrationSubAppUnderTest, "fetchWorkStatus").mockRejectedValue(new Error("unavailable"));

        await migrationSubAppUnderTest.monitorWorkProgress();

        expect(migrationSubApp.state.migrationInProgress).toBe(false);
        expect(executeRemote).toHaveBeenCalledWith("migrationStopped", undefined);
    });

    it("releases the desktop close guard when starting work fails", async () => {
        const migrationSubApp = new MigrationSubApp({});
        const migrationSubAppUnderTest = asUnderTest(migrationSubApp);
        const executeRemote = vi.spyOn(requisitions, "executeRemote");
        vi.spyOn(console, "error").mockImplementation(() => {
            return undefined;
        });

        migrationSubApp.state = { ...migrationSubApp.state, project };
        vi.spyOn(migrationSubAppUnderTest, "fetchWorkStatus").mockResolvedValue(workStatus(WorkStatus.NOT_STARTED));
        vi.spyOn(migrationSubAppUnderTest, "commitRest").mockResolvedValue();
        vi.spyOn(migrationSubAppUnderTest.migration, "workStart").mockRejectedValue(new Error("start failed"));

        await migrationSubAppUnderTest.startMigration();

        expect(executeRemote).toHaveBeenNthCalledWith(1, "migrationStarted", project);
        expect(executeRemote).toHaveBeenNthCalledWith(2, "migrationStopped", undefined);
    });
});

describe("MigrationSubApp source selection commit errors", () => {
    it("requests the password again for source authentication errors", () => {
        expect(getSourceSelectionCommitErrorAction([{
            level: MessageLevel.ERROR,
            type: "BadUserInput",
            message: "Access denied for user 'root'@'localhost'",
            title: "Please enter the password for user 'root' at the source database.",
            info: { input: "password" },
        }])).toBe("retry-password");
    });

    it("closes the assistant for source pre-check errors", () => {
        expect(getSourceSelectionCommitErrorAction([{
            level: MessageLevel.ERROR,
            type: null,
            message: "Migration from an RDS instance requires binary logging to be enabled.",
            title: "Binary logging is disabled in the RDS instance",
            info: null,
        }])).toBe("close-assistant");
    });

    it("separates the dialog prompt and description for source pre-check errors", () => {
        expect(getSourceSelectionCommitErrorDialogContent([{
            level: MessageLevel.ERROR,
            type: null,
            message: "Enable <code>log_bin</code> and restart.",
            title: "Binary logging (<code>log_bin</code>) is disabled",
            info: null,
        }])).toEqual({
            prompt: "Binary logging (log_bin) is disabled",
            description: ["Enable log_bin and restart."],
        });
    });

    it("formats simple backend HTML tags as readable dialog text", () => {
        const message = "You may:<br/><ul><li>enable <code>log_bin</code></li>" +
            "<li>restart the source</li></ul>";

        expect(getSourceSelectionCommitErrorDialogContent([{
            level: MessageLevel.ERROR,
            type: null,
            message,
            title: "Source pre-check failed",
            info: null,
        }])).toEqual({
            prompt: "Source pre-check failed",
            description: [
                "You may:",
                "- enable log_bin",
                "- restart the source",
            ],
        });
    });
});

describe("MigrationSubApp target selection errors", () => {
    it("renders target MySQL version validation errors as text", () => {
        const title = "No compatible version <img src=x alt='injected title'>";
        const message = "Available <script>alert('injected message')</script> versions";
        const migrationSubApp = new MigrationSubApp({});
        migrationSubApp.state = {
            ...migrationSubApp.state,
            hasOciConfig: true,
            formGroupValues: {
                ...migrationSubApp.state.formGroupValues,
                profile: "DEFAULT",
            },
            targetOptionErrors: [{
                level: MessageLevel.ERROR,
                title,
                message,
                option: "database.mysqlVersion",
            }],
        };
        const renderTargetSelection = (migrationSubApp as unknown as {
            renderTargetSelection: () => ComponentChild;
        }).renderTargetSelection.bind(migrationSubApp);

        const { container } = render(h("div", null, renderTargetSelection()));

        expect(container.textContent).toContain(title);
        expect(container.textContent).toContain(message);
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector("script")).toBeNull();
    });

});

describe("MigrationSubApp compatibility issues", () => {
    it("marks compatibility issue rows for E2E synchronization", () => {
        const migrationSubApp = new MigrationSubApp({});
        const renderIssues = (migrationSubApp as unknown as {
            renderIssues: (subStepId: number,
                checkDataOverride?: Pick<IMigrationChecksData, "issues">) => ComponentChild;
        }).renderIssues.bind(migrationSubApp);

        const issues = renderIssues(SubStepId.MIGRATION_CHECKS, {
            issues: [{
                checkId: "check-1",
                level: MessageLevel.ERROR,
                title: "Unsupported feature",
                result: "",
                description: "The source uses an unsupported feature.",
                objects: [],
                choices: [],
                status: CheckStatus.ACTION_REQUIRED,
            }],
        });

        render(h("div", null, issues));

        const issue = screen.getByTestId("migration-compatibility-issue");
        expect(issue.getAttribute("data-check-id")).toBe("check-1");
        expect(screen.getByText(/Unsupported feature/u)).toBeTruthy();
    });
});
