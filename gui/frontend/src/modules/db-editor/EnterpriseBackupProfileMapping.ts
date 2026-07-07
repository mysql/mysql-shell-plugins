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

import type {
    IMebBackupContentRow, IMebBackupProfileInfo, IMebBackupProfile, IMebProfileSchedule,
} from "../../supplement/ShellInterface/ShellInterfaceMeb.js";

export type MebStorageType = "local";
export type MebCloudService = "OCI" | "openstack" | "s3" | "GCP";
export type MebCloudTextField = "cloudParUrl" | "cloudHost" | "cloudBucket" | "cloudAccessKeyId"
    | "cloudSecretAccessKey" | "cloudAwsRegion" | "cloudAccessKey" | "cloudSecretKey" | "cloudContainer"
    | "cloudUserId" | "cloudPassword" | "cloudTempAuthUrl" | "cloudBasicAuthUrl" | "cloudIdentityUrl"
    | "cloudTenant" | "cloudRegion" | "cloudChunkSize" | "cloudProxy" | "cloudCaInfo" | "cloudCaPath"
    | "cloudBufferSize";

export interface IMebScheduleDraft {
    enabled: boolean;
    interval: string;
    frequency: string;
    monthDays: number[];
    weekDays: boolean[];
    hour: string;
    minute: string;
}

export interface IMebProfileDraft {
    applyLog: boolean;
    comments: string;
    compress: boolean;
    compressLevel: string;
    compressMethod: string;
    storageType: MebStorageType;
    cloudService: MebCloudService;
    cloudParUrl: string;
    cloudHost: string;
    cloudBucket: string;
    cloudAccessKeyId: string;
    cloudSecretAccessKey: string;
    cloudAwsRegion: string;
    cloudAccessKey: string;
    cloudSecretKey: string;
    cloudContainer: string;
    cloudUserId: string;
    cloudPassword: string;
    cloudTempAuthUrl: string;
    cloudBasicAuthUrl: string;
    cloudIdentityUrl: string;
    cloudTenant: string;
    cloudRegion: string;
    cloudChunkedTransfer: boolean;
    cloudChunkSize: string;
    cloudProxy: string;
    cloudCaInfo: string;
    cloudCaPath: string;
    cloudBufferSize: string;
    cloudTrace: boolean;
    label: string;
    destination: string;
    excludeTables: string;
    fullSchedule: IMebScheduleDraft;
    includeTables: string;
    incrementalWithRedoLogOnly: boolean;
    incSchedule: IMebScheduleDraft;
    incrementalBase: "history:last_backup" | "history:last_full_backup";
    partialMode: "full" | "filters";
    skipUnusedPages: boolean;
    usingTts: IMebBackupProfileInfo["usingTts"];
    configPath?: string;
}

export interface IMebProfileSaveContext {
    backupHomePath: string;
    backupUser: string;
    datadir: string | null;
    mysqlBasedir: string | null;
}

export const cloudTemporaryStoragePath = "temp";

const systemSchemas = new Set(["INFORMATION_SCHEMA", "MYSQL", "PERFORMANCE_SCHEMA", "SYS"]);

export const filterMebContentRows = (rows: IMebBackupContentRow[]): IMebBackupContentRow[] => {
    return rows.filter((row) => {
        return !systemSchemas.has(row.schema.toUpperCase());
    });
};

const pathUsesWindowsSeparators = (path: string): boolean => {
    return path.includes("\\") || /^[A-Za-z]:/.test(path);
};

const pathSeparatorForPath = (path: string): string => {
    return pathUsesWindowsSeparators(path) ? "\\" : "/";
};

const trimPathEnd = (path: string): string => {
    return path.replace(/[\\/]+$/, "");
};

const pathEquals = (left: string, right: string): boolean => {
    return pathUsesWindowsSeparators(left) || pathUsesWindowsSeparators(right)
        ? left.toLowerCase() === right.toLowerCase()
        : left === right;
};

export const backupStorageRelativePath = (backupHomePath: string, destination: string): string => {
    const backupHome = trimPathEnd(backupHomePath.trim());
    const storagePath = destination.trim();
    if (!backupHome || !storagePath) {
        return storagePath;
    }

    if (pathEquals(backupHome, trimPathEnd(storagePath))) {
        return "";
    }

    const separator = pathSeparatorForPath(backupHome);
    const backupHomePrefix = `${backupHome}${separator}`;
    if (pathEquals(storagePath.slice(0, backupHomePrefix.length), backupHomePrefix)) {
        return storagePath.slice(backupHomePrefix.length);
    }

    return storagePath;
};

export const backupStorageDestinationPath = (backupHomePath: string, storagePath: string): string => {
    const backupHome = trimPathEnd(backupHomePath.trim());
    const storage = storagePath.trim();
    if (!backupHome || !storage) {
        return storage;
    }

    const relativeStorage = backupStorageRelativePath(backupHome, storage)
        .replace(/^[A-Za-z]:[\\/]+/, "")
        .replace(/^[\\/]+/, "");
    if (!relativeStorage) {
        return backupHome;
    }

    return `${backupHome}${pathSeparatorForPath(backupHome)}${relativeStorage}`;
};

export const defaultBackupStoragePath = "data";

const parseBool = (value: unknown): boolean => {
    return value === true || String(value).toLowerCase() === "true" || String(value) === "1";
};

const missingProfileDefaultsMessage = "Backup profile defaults must be supplied by the profile.";

export const legacyPartialBackupConversionMessage = (
    profile: Pick<IMebBackupProfileInfo, "legacyPartialBackupConverted" | "legacyPartialBackupConversionMessage">,
): string | null => {
    return profile.legacyPartialBackupConverted
        ? profile.legacyPartialBackupConversionMessage ?? null
        : null;
};

const effectiveScheduleChanged = (
    previous: IMebProfileSchedule | undefined,
    next: IMebProfileSchedule,
): boolean => {
    if (!previous) {
        return next.enabled;
    }

    if (previous.enabled !== next.enabled) {
        return true;
    }

    if (!next.enabled) {
        return false;
    }

    return previous.interval !== next.interval
        || previous.frequency !== next.frequency
        || previous.hour !== next.hour
        || previous.minute !== next.minute
        || previous.monthDays.length !== next.monthDays.length
        || previous.monthDays.some((value, index) => {
            return value !== next.monthDays[index];
        })
        || previous.weekDays.length !== next.weekDays.length
        || previous.weekDays.some((value, index) => {
            return value !== next.weekDays[index];
        });
};

export const profileSchedulesChanged = (
    previous: Pick<IMebBackupProfileInfo, "fullSchedule" | "incSchedule"> | undefined,
    next: Pick<IMebBackupProfile, "fullSchedule" | "incSchedule">,
): boolean => {
    return effectiveScheduleChanged(previous?.fullSchedule, next.fullSchedule)
        || effectiveScheduleChanged(previous?.incSchedule, next.incSchedule);
};

const toScheduleDraft = (profile: IMebBackupProfileInfo, prefix: "full" | "inc"): IMebScheduleDraft => {
    const source = prefix === "full" ? profile.fullSchedule : profile.incSchedule;

    return {
        enabled: parseBool(source.enabled),
        interval: String(source.interval),
        frequency: String(source.frequency),
        monthDays: [...source.monthDays],
        weekDays: [...source.weekDays],
        hour: String(source.hour),
        minute: String(source.minute),
    };
};

const draftToProfileSchedule = (schedule: IMebScheduleDraft): IMebProfileSchedule => {
    return {
        enabled: schedule.enabled,
        interval: Number.parseInt(schedule.interval, 10),
        frequency: Number.parseInt(schedule.frequency, 10),
        monthDays: [...schedule.monthDays],
        weekDays: [...schedule.weekDays],
        hour: Number.parseInt(schedule.hour, 10),
        minute: Number.parseInt(schedule.minute, 10),
    };
};

const toCloudService = (value: string | null | undefined): MebCloudService => {
    if (value === "openstack" || value === "s3" || value === "GCP" || value === "OCI") {
        return value;
    }

    throw new Error(missingProfileDefaultsMessage);
};

const toIncrementalBase = (value: string): IMebProfileDraft["incrementalBase"] => {
    if (value === "history:last_backup" || value === "history:last_full_backup") {
        return value;
    }

    throw new Error(missingProfileDefaultsMessage);
};

export const profileToDraft = (
    mode: "new" | "edit",
    profile?: IMebBackupProfileInfo,
): IMebProfileDraft => {
    if (!profile) {
        throw new Error(missingProfileDefaultsMessage);
    }

    return {
        applyLog: parseBool(profile.applyLog),
        comments: profile.comments ?? "",
        compress: parseBool(profile.compress),
        compressLevel: profile.compressLevel,
        compressMethod: profile.compressMethod,
        storageType: "local",
        cloudService: toCloudService(profile.cloudService),
        cloudParUrl: "",
        cloudHost: profile.cloudHost ?? "",
        cloudBucket: profile.cloudBucket ?? "",
        cloudAccessKeyId: profile.cloudAccessKeyId ?? "",
        cloudSecretAccessKey: "",
        cloudAwsRegion: profile.cloudAwsRegion ?? "",
        cloudAccessKey: "",
        cloudSecretKey: "",
        cloudContainer: profile.cloudContainer ?? "",
        cloudUserId: profile.cloudUserId ?? "",
        cloudPassword: "",
        cloudTempAuthUrl: profile.cloudTempAuthUrl ?? "",
        cloudBasicAuthUrl: profile.cloudBasicAuthUrl ?? "",
        cloudIdentityUrl: profile.cloudIdentityUrl ?? "",
        cloudTenant: profile.cloudTenant ?? "",
        cloudRegion: profile.cloudRegion ?? "",
        cloudChunkedTransfer: parseBool(profile.cloudChunkedTransfer),
        cloudChunkSize: profile.cloudChunkSize ?? "",
        cloudProxy: profile.cloudProxy ?? "",
        cloudCaInfo: profile.cloudCaInfo ?? "",
        cloudCaPath: profile.cloudCaPath ?? "",
        cloudBufferSize: profile.cloudBufferSize ?? "",
        cloudTrace: parseBool(profile.cloudTrace),
        label: profile.label,
        destination: mode === "new"
            ? backupStorageDestinationPath(profile.destination, defaultBackupStoragePath)
            : profile.destination !== "Not configured" ? profile.destination : "",
        excludeTables: profile.excludeTables ?? "",
        fullSchedule: toScheduleDraft(profile, "full"),
        includeTables: profile.includeTables ?? "",
        incrementalBase: toIncrementalBase(profile.incrementalBase),
        incrementalWithRedoLogOnly: parseBool(profile.incrementalWithRedoLogOnly),
        incSchedule: toScheduleDraft(profile, "inc"),
        partialMode: profile.partial ? "filters" : "full",
        skipUnusedPages: parseBool(profile.skipUnusedPages),
        usingTts: profile.usingTts,
        configPath: mode === "edit" ? profile.configPath ?? undefined : undefined,
    };
};

const trimmedOrNull = (value: string): string | null => {
    return value.trim() || null;
};

export const draftToProfileConfiguration = (
    draft: IMebProfileDraft,
    context: IMebProfileSaveContext,
): IMebBackupProfile => {
    /*
     * Cloud storage is hidden for now. Previous behavior:
     *
     * const isCloudStorage = draft.storageType === "cloud";
     * const profileDestination = draft.storageType === "cloud"
     *     ? backupStorageDestinationPath(context.backupHomePath, cloudTemporaryStoragePath)
     *     : draft.destination.trim();
     */
    const profileDestination = draft.destination.trim();

    return {
        applyLog: draft.applyLog,
        comments: draft.comments || null,
        compress: draft.compress,
        compressLevel: draft.compressLevel,
        compressMethod: draft.compressMethod,
        storageType: "local",
        /*
         * Cloud storage fields used to be populated from draft values when storageType was "cloud".
         * They are deliberately forced empty while the editor is local-only.
         */
        cloudService: null,
        cloudObject: null,
        cloudParUrl: null,
        cloudHost: null,
        cloudBucket: null,
        cloudObjectKey: null,
        cloudAccessKeyId: null,
        cloudSecretAccessKey: null,
        cloudAwsRegion: null,
        cloudAccessKey: null,
        cloudSecretKey: null,
        cloudContainer: null,
        cloudUserId: null,
        cloudPassword: null,
        cloudTempAuthUrl: null,
        cloudBasicAuthUrl: null,
        cloudIdentityUrl: null,
        cloudTenant: null,
        cloudRegion: null,
        cloudChunkedTransfer: false,
        cloudChunkSize: null,
        cloudProxy: null,
        cloudCaInfo: null,
        cloudCaPath: null,
        cloudBufferSize: null,
        cloudTrace: false,
        label: draft.label.trim(),
        destination: profileDestination,
        excludeTables: trimmedOrNull(draft.excludeTables),
        fullSchedule: draftToProfileSchedule(draft.fullSchedule),
        includeTables: trimmedOrNull(draft.includeTables),
        incrementalBase: draft.incrementalBase,
        incrementalWithRedoLogOnly: draft.incrementalWithRedoLogOnly,
        incSchedule: draftToProfileSchedule(draft.incSchedule),
        partial: draft.partialMode === "filters",
        skipUnusedPages: draft.skipUnusedPages,
        usingTts: draft.usingTts,
        user: context.backupUser.trim() || null,
        datadir: context.datadir,
        mysqlBasedir: context.mysqlBasedir,
        configPath: draft.configPath ?? null,
    };
};
