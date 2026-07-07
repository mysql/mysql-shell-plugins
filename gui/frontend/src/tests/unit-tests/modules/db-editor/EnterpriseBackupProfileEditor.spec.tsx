/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    EnterpriseBackupProfileEditor,
    type MebProfileDialogTab,
} from "../../../../modules/db-editor/EnterpriseBackupProfileEditor.js";
import type {
    IMebProfileDraft,
    IMebScheduleDraft,
} from "../../../../modules/db-editor/EnterpriseBackupProfileMapping.js";

const schedule = (overrides: Partial<IMebScheduleDraft> = {}): IMebScheduleDraft => {
    return {
        enabled: true,
        interval: "1",
        frequency: "1",
        monthDays: [1],
        weekDays: [false, false, false, false, false, false, false],
        hour: "2",
        minute: "30",
        ...overrides,
    };
};

const draft = (overrides: Partial<IMebProfileDraft> = {}): IMebProfileDraft => {
    return {
        applyLog: false,
        comments: "",
        compress: false,
        compressLevel: "1",
        compressMethod: "lz4",
        storageType: "local",
        cloudService: "OCI",
        cloudParUrl: "",
        cloudHost: "",
        cloudBucket: "",
        cloudAccessKeyId: "",
        cloudSecretAccessKey: "",
        cloudAwsRegion: "",
        cloudAccessKey: "",
        cloudSecretKey: "",
        cloudContainer: "",
        cloudUserId: "",
        cloudPassword: "",
        cloudTempAuthUrl: "",
        cloudBasicAuthUrl: "",
        cloudIdentityUrl: "",
        cloudTenant: "",
        cloudRegion: "",
        cloudChunkedTransfer: false,
        cloudChunkSize: "",
        cloudProxy: "",
        cloudCaInfo: "",
        cloudCaPath: "",
        cloudBufferSize: "",
        cloudTrace: false,
        label: "Nightly",
        destination: "/backups/nightly",
        excludeTables: "",
        fullSchedule: schedule(),
        includeTables: "",
        incrementalWithRedoLogOnly: false,
        incSchedule: schedule({ enabled: false }),
        incrementalBase: "history:last_backup",
        partialMode: "full",
        skipUnusedPages: false,
        usingTts: "0",
        ...overrides,
    };
};

afterEach(cleanup);

describe("EnterpriseBackupProfileEditor", () => {
    const renderEditor = (activeTab: MebProfileDialogTab, overrides: Partial<IMebProfileDraft> = {},
        tableFilterError?: string) => {
        const onChange = vi.fn();
        const onTabChange = vi.fn();
        const result = render(<EnterpriseBackupProfileEditor
            activeTab={activeTab}
            backupHomePath="/backups"
            draft={draft(overrides)}
            tableFilterError={tableFilterError}
            onChange={onChange}
            onTabChange={onTabChange}
        />);

        return { ...result, onChange, onTabChange };
    };

    it("reports profile name edits", () => {
        const { container, onChange } = renderEditor("contents");
        const input = container.querySelector(".enterpriseBackupProfileHeaderFields input")!;

        fireEvent.input(input, { target: { value: "Weekly" } });

        expect(onChange).toHaveBeenCalledWith({ label: "Weekly" });
    });

    it("reports schedule edits as a complete nested schedule", () => {
        const { container, onChange } = renderEditor("schedule");
        const interval = container.querySelector('input[aria-label="Interval"]')!;

        fireEvent.input(interval, { target: { value: "4" } });

        expect(onChange).toHaveBeenCalledOnce();
        const patch = onChange.mock.calls[0][0] as Partial<IMebProfileDraft>;
        expect(patch.fullSchedule).toMatchObject({ interval: "4", hour: "2", minute: "30" });
    });

    it("uses the month-day picker for monthly schedules", () => {
        const { container, onChange } = renderEditor("schedule", {
            fullSchedule: schedule({ frequency: "3", monthDays: [2, 16] }),
        });

        expect(container.querySelector('[role="group"][aria-label="Days of month"]')).toBeTruthy();
        expect(screen.getByRole("button", { name: "Day 2" }).getAttribute("aria-pressed")).toBe("true");

        fireEvent.click(screen.getByRole("button", { name: "Day 9" }));

        const patch = onChange.mock.calls[0][0] as Partial<IMebProfileDraft>;
        expect(patch.fullSchedule?.monthDays).toEqual([2, 9, 16]);
    });

    it("reports tab selection", () => {
        const { onTabChange } = renderEditor("contents");

        fireEvent.click(screen.getByText("Comments"));

        expect(onTabChange).toHaveBeenCalledWith("comments");
    });

    it("displays the supplied table filter error", () => {
        renderEditor("contents", { partialMode: "filters" }, "Enter an include or exclude filter.");

        expect(screen.getByText("Enter an include or exclude filter.")).toBeTruthy();
    });
});
