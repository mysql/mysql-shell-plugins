/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License,
 * version 2.0, for more details.
 */

import type { IMebActivityItem } from "../../supplement/ShellInterface/ShellInterfaceMeb.js";

export interface IMebRestoreActivityDetails {
    profile: string;
    backupType: string;
    timestamp: string;
}

export interface IMebBackupActivityCapabilities {
    canRestore: boolean;
    canApplyLogs: boolean;
}

export const mebBackupActivityCapabilities = (
    activity: IMebActivityItem,
): IMebBackupActivityCapabilities => {
    const completed = activity.isBackup && activity.status === "Completed OK";
    const isIncremental = activity.backupType === "Incremental Backup";

    return {
        canRestore: completed && (activity.applyLogDone === true
            || (isIncremental && activity.applyLogDone === false)),
        canApplyLogs: completed && !isIncremental && activity.applyLogDone === false,
    };
};

export const filterMebActivityItems = (
    items: IMebActivityItem[],
    backupsOnly: boolean,
    selectedProfileOnly: boolean,
    selectedProfileId?: string,
): IMebActivityItem[] => {
    return items.filter((activity) => {
        if (backupsOnly && !activity.isBackup) {
            return false;
        }
        if (selectedProfileOnly && activity.profileId !== selectedProfileId) {
            return false;
        }

        return true;
    });
};

export const mebRestoreActivityDetails = (
    items: IMebActivityItem[],
    activityId?: string,
): IMebRestoreActivityDetails | undefined => {
    const activity = items.find((item) => {
        return item.activityId === activityId;
    });
    if (!activity) {
        return undefined;
    }

    return {
        profile: activity.profile ?? "Unknown profile",
        backupType: activity.backupType ?? "Backup",
        timestamp: activity.time,
    };
};

export const formatMebBinlogPosition = (
    binlogFile?: string | null,
    binlogPosition?: string | null,
): string => {
    if (!binlogFile || !binlogPosition) {
        return "--";
    }

    return `${binlogFile}:${binlogPosition}`;
};
