/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 */

import { describe, expect, it } from "vitest";

import {
    filterMebActivityItems,
    formatMebBinlogPosition,
    mebRestoreActivityDetails,
} from "../../../../modules/db-editor/EnterpriseBackupActivity.js";
import type { IMebActivityItem } from "../../../../supplement/ShellInterface/ShellInterfaceMeb.js";

const activity = (profile: string, profileId: string, isBackup: boolean): IMebActivityItem => {
    return {
        time: "2026-06-28 12:00",
        title: profile,
        detail: "Completed",
        tone: "ok",
        activityId: null,
        size: null,
        profile,
        profileId,
        status: "Completed OK",
        backupType: isBackup ? "Full Backup" : "Verify",
        isBackup,
    };
};

describe("EnterpriseBackup activity filters", () => {
    it("combines backups-only and selected-profile filters", () => {
        const items = [
            activity("Nightly", "profile-1", true),
            activity("Nightly", "profile-1", false),
            activity("Nightly", "profile-2", true),
        ];

        expect(filterMebActivityItems(items, true, true, "profile-1"))
            .toEqual([items[0]]);
        expect(filterMebActivityItems(items, false, true, "profile-1"))
            .toEqual([items[0], items[1]]);
    });

    it("maps the selected backup to restore confirmation details", () => {
        const selected = activity("Nightly", "profile-1", true);
        selected.activityId = "activity:v1:logs/nightly-full.log";

        expect(mebRestoreActivityDetails([selected], selected.activityId)).toEqual({
            profile: "Nightly",
            backupType: "Full Backup",
            timestamp: "2026-06-28 12:00",
        });
    });

    it("formats restore binary log coordinates", () => {
        expect(formatMebBinlogPosition("binlog.000042", "98765")).toBe("binlog.000042:98765");
        expect(formatMebBinlogPosition(undefined, "98765")).toBe("--");
        expect(formatMebBinlogPosition("binlog.000042", undefined)).toBe("--");
    });
});
