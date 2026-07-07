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

import type { IMebProfileDraft, IMebScheduleDraft } from "./EnterpriseBackupProfileMapping.js";

export const validateMebProfileRequiredFields = (
    label: string | null | undefined,
    destination: string | null | undefined,
): string | null => {
    if (!label?.trim()) {
        return "Enter a profile name.";
    }

    if (!destination?.trim()) {
        return "Enter a backup storage directory.";
    }

    return null;
};

export interface IMebProfileSaveValidationError {
    message: string;
    tab: "contents" | "schedule" | "storage" | "options" | "comments";
}

const usesWindowsPathRules = (left: string, right: string): boolean => {
    return left.includes("\\") || right.includes("\\") || /^[A-Za-z]:/.test(left) || /^[A-Za-z]:/.test(right);
};

const normalizePathForContainment = (path: string, windowsPath: boolean): string => {
    let normalized = path.trim().replace(/\\/g, "/");
    const driveMatch = /^[A-Za-z]:/.exec(normalized);
    const drive = driveMatch ? driveMatch[0].toLowerCase() : "";
    if (drive) {
        normalized = normalized.slice(drive.length);
    }

    const absolute = normalized.startsWith("/");
    const segments: string[] = [];
    for (const segment of normalized.split("/")) {
        if (!segment || segment === ".") {
            continue;
        }

        if (segment === "..") {
            if (segments.length > 0 && segments[segments.length - 1] !== "..") {
                segments.pop();
            } else {
                segments.push(segment);
            }
        } else {
            segments.push(segment);
        }
    }

    const prefix = drive ? `${drive}/` : absolute ? "/" : "";
    const result = `${prefix}${segments.join("/")}`.replace(/\/+$/, "");

    return (windowsPath ? result.toLowerCase() : result) || (absolute ? "/" : ".");
};

const pathIsInsideDirectory = (directory: string, path: string): boolean => {
    if (!directory.trim() || !path.trim()) {
        return false;
    }

    const windowsPath = usesWindowsPathRules(directory, path);
    const normalizedDirectory = normalizePathForContainment(directory, windowsPath);
    const normalizedPath = normalizePathForContainment(path, windowsPath);

    return normalizedPath === normalizedDirectory || normalizedPath.startsWith(`${normalizedDirectory}/`);
};

const pathIsSameDirectory = (directory: string, path: string): boolean => {
    if (!directory.trim() || !path.trim()) {
        return false;
    }

    const windowsPath = usesWindowsPathRules(directory, path);

    return normalizePathForContainment(directory, windowsPath) === normalizePathForContainment(path, windowsPath);
};

/*
 * Cloud storage validation is hidden for now with the cloud UI.
 *
 * const cloudStorageValidationError = (profile: IMebProfileDraft): string | null => {
 *     const secretCanBePreserved = Boolean(profile.configPath);
 *     const hasSecret = (value: string): boolean => {
 *         return hasText(value) || secretCanBePreserved;
 *     };
 *
 *     switch (profile.cloudService) {
 *         case "OCI":
 *             return hasSecret(profile.cloudParUrl) ? null : "OCI cloud storage requires a PAR URL.";
 *
 *         case "s3":
 *             if (!hasText(profile.cloudBucket)) {
 *                 return "S3 cloud storage requires a bucket.";
 *             }
 *             if (!hasText(profile.cloudAccessKeyId)) {
 *                 return "S3 cloud storage requires an access key ID.";
 *             }
 *             if (!hasSecret(profile.cloudSecretAccessKey)) {
 *                 return "S3 cloud storage requires a secret access key.";
 *             }
 *
 *             return null;
 *
 *         case "GCP":
 *             if (!hasText(profile.cloudBucket)) {
 *                 return "Google Cloud Storage requires a bucket.";
 *             }
 *             if (!hasSecret(profile.cloudAccessKey)) {
 *                 return "Google Cloud Storage requires an access key.";
 *             }
 *             if (!hasSecret(profile.cloudSecretKey)) {
 *                 return "Google Cloud Storage requires a secret key.";
 *             }
 *
 *             return null;
 *
 *         case "openstack":
 *             if (!hasText(profile.cloudContainer)) {
 *                 return "OpenStack cloud storage requires a container.";
 *             }
 *             if (!hasText(profile.cloudUserId)) {
 *                 return "OpenStack cloud storage requires a user ID.";
 *             }
 *             if (!hasSecret(profile.cloudPassword)) {
 *                 return "OpenStack cloud storage requires a password.";
 *             }
 *             if (!hasText(profile.cloudTempAuthUrl)
 *                 && !hasText(profile.cloudBasicAuthUrl)
 *                 && !hasText(profile.cloudIdentityUrl)) {
 *                 return "OpenStack cloud storage requires TempAuth, BasicAuth, or Identity URL.";
 *             }
 *
 *             return null;
 *
 *         default:
 *             return "Select a supported cloud storage service.";
 *     }
 * };
 */

const scheduleInteger = (
    value: string,
    minimum: number,
    maximum: number,
    messagePrefix: string,
): string | null => {
    if (!/^\d+$/.test(value.trim())) {
        return `${messagePrefix} must be between ${minimum} and ${maximum}.`;
    }

    const numberValue = Number.parseInt(value, 10);

    return numberValue >= minimum && numberValue <= maximum
        ? null
        : `${messagePrefix} must be between ${minimum} and ${maximum}.`;
};

const scheduleMonthDaysError = (days: number[], description: string): string | null => {
    if (days.length === 0 || new Set(days).size !== days.length || days.some((day) => {
        return !Number.isInteger(day) || day < 1 || day > 31;
    })) {
        return `${description} must contain one or more unique days between 1 and 31.`;
    }

    return null;
};

// The scheduler uses cron-style calendar fields. Larger intervals cannot be
// represented exactly without tracking elapsed time between runs.
export const mebScheduleIntervalMaximum = (frequency: string): number => {
    return {
        "0": 23,
        "1": 31,
        "2": 1,
        "3": 12,
    }[frequency] ?? 1;
};

const scheduleValidationError = (schedule: IMebScheduleDraft, description: string): string | null => {
    if (!schedule.enabled) {
        return null;
    }

    if (!["0", "1", "2", "3"].includes(schedule.frequency)) {
        return `${description} frequency is not supported.`;
    }

    const intervalError = scheduleInteger(
        schedule.interval,
        1,
        mebScheduleIntervalMaximum(schedule.frequency),
        `${description} interval`,
    );
    if (intervalError) {
        return intervalError;
    }

    if (schedule.frequency === "3") {
        const dayError = scheduleMonthDaysError(schedule.monthDays, `${description} days of month`);
        if (dayError) {
            return dayError;
        }
    }

    if (schedule.frequency === "2" && !schedule.weekDays.some(Boolean)) {
        return `Weekly ${description.toLowerCase()} has no days selected.`;
    }

    if (schedule.frequency !== "0") {
        const hourError = scheduleInteger(schedule.hour, 0, 23, `${description} hour`);
        if (hourError) {
            return hourError;
        }
    }

    return scheduleInteger(schedule.minute, 0, 59, `${description} minute`);
};

export const validateMebProfileSaveOptions = (
    backupHomePath: string,
    profile: IMebProfileDraft,
): IMebProfileSaveValidationError | null => {
    if (pathIsSameDirectory(backupHomePath, profile.destination)) {
        return {
            message: "Enter a backup storage directory.",
            tab: "storage",
        };
    }

    if (!pathIsInsideDirectory(backupHomePath, profile.destination)) {
        return {
            message: "Backup storage directory must be inside the backup home.",
            tab: "storage",
        };
    }

    const fullScheduleError = scheduleValidationError(profile.fullSchedule, "Full backup schedule");
    if (fullScheduleError) {
        return {
            message: fullScheduleError,
            tab: "schedule",
        };
    }

    const incrementalScheduleError = scheduleValidationError(profile.incSchedule, "Incremental backup schedule");
    if (incrementalScheduleError) {
        return {
            message: incrementalScheduleError,
            tab: "schedule",
        };
    }

    return null;
};

export const validateMebTableFilters = (
    partialMode: string,
    includeTables: string | null | undefined,
    excludeTables: string | null | undefined,
): string | null => {
    if (partialMode !== "filters") {
        return null;
    }

    const includeExpression = includeTables?.trim() ?? "";
    const excludeExpression = excludeTables?.trim() ?? "";

    return includeExpression || excludeExpression
        ? null : "Enter an include or exclude expression for the partial backup.";
};
