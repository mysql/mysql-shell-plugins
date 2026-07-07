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

import { describe, expect, it } from "vitest";

import type {
    IMebBackupContentRow, IMebBackupProfileInfo, IMebProfileSchedule,
} from "../../../../communication/ProtocolGui.js";
import {
    draftToProfileConfiguration,
    filterMebContentRows,
    legacyPartialBackupConversionMessage,
    profileSchedulesChanged,
    profileToDraft,
    type IMebProfileDraft,
    type IMebProfileSaveContext,
    type IMebScheduleDraft,
} from "../../../../modules/db-editor/EnterpriseBackupProfileMapping.js";

const schedule = (overrides: Partial<IMebProfileSchedule> = {}): IMebProfileSchedule => {
    return {
        enabled: true,
        interval: 3,
        frequency: 2,
        monthDays: [14],
        weekDays: [true, false, true, false, true, false, false],
        hour: 5,
        minute: 45,
        ...overrides,
    };
};

const scheduleDraft = (overrides: Partial<IMebScheduleDraft> = {}): IMebScheduleDraft => {
    return {
        enabled: true,
        interval: "3",
        frequency: "2",
        monthDays: [14],
        weekDays: [true, false, true, false, true, false, false],
        hour: "5",
        minute: "45",
        ...overrides,
    };
};

const profile = (overrides: Partial<IMebBackupProfileInfo> = {}): IMebBackupProfileInfo => {
    return {
        uuid: "profile-id",
        label: "Nightly Profile",
        type: "Partial Data",
        destination: "/backups/mysql/nightly",
        latest: "2026-06-12 19:00",
        nextFull: "Weekly",
        nextIncremental: "Hourly",
        status: "Configured",
        command: "/usr/bin/mysqlbackup",
        user: "mysqlbackup@localhost",
        configPath: "/backups/mysql/nightly.cnf",
        applyLog: true,
        comments: "Profile comments",
        compress: true,
        compressLevel: "7",
        compressMethod: "zlib",
        storageType: "local",
        cloudService: "openstack",
        cloudObject: "ignored-object",
        cloudParUrl: "https://objectstorage.example/par",
        cloudHost: "storage.example.com",
        cloudBucket: "bucket-a",
        cloudObjectKey: "ignored-key",
        cloudAccessKeyId: "access-key-id",
        cloudAwsRegion: "us-west-2",
        cloudContainer: "container-a",
        cloudUserId: "cloud-user",
        cloudTempAuthUrl: "https://auth.example.com/temp",
        cloudBasicAuthUrl: "https://auth.example.com/basic",
        cloudIdentityUrl: "https://identity.example.com",
        cloudTenant: "tenant-a",
        cloudRegion: "region-a",
        cloudChunkedTransfer: true,
        cloudChunkSize: "128M",
        cloudProxy: "http://proxy.example.com",
        cloudCaInfo: "/etc/ssl/certs/ca.pem",
        cloudCaPath: "/etc/ssl/certs",
        cloudBufferSize: "16M",
        cloudTrace: true,
        excludeTables: "^tmp\\.",
        fullSchedule: schedule(),
        includeTables: "^sales\\.",
        incrementalBase: "history:last_full_backup",
        incrementalWithRedoLogOnly: true,
        incSchedule: schedule({
            interval: 2,
            frequency: 0,
            monthDays: [1],
            weekDays: [false, false, false, false, false, false, false],
            hour: 0,
            minute: 15,
        }),
        partial: true,
        skipUnusedPages: true,
        usingTts: "2",
        datadir: "/var/lib/mysql",
        mysqlBasedir: "/usr",
        mysqlVersion: "9.6.0",
        ...overrides,
    };
};

const draft = (overrides: Partial<IMebProfileDraft> = {}): IMebProfileDraft => {
    return {
        ...profileToDraft("edit", profile({
            comments: null,
            destination: "/backups/mysql/edited",
            excludeTables: null,
            includeTables: null,
            label: "Edited Profile",
            partial: false,
            storageType: "local",
        })),
        ...overrides,
    };
};

const saveContext: IMebProfileSaveContext = {
    backupHomePath: "/backups/mysql",
    backupUser: "mysqlbackup@localhost",
    datadir: "/var/lib/mysql",
    mysqlBasedir: "/usr",
};

describe("EnterpriseBackupProfileMapping tests", (): void => {
    it("filters system schemas from backup content rows", () => {
        const rows: IMebBackupContentRow[] = [{
            schema: "app",
            table: "orders",
            engine: "InnoDB",
            scope: "User",
            coverage: "Full",
            inBackup: true,
            inInstance: true,
            action: "Table will be updated",
        }, {
            schema: "mysql",
            table: "user",
            engine: "InnoDB",
            scope: "System",
            coverage: "Full",
            inBackup: true,
            inInstance: true,
            action: "Table will be updated",
        }];

        expect(filterMebContentRows(rows)).toEqual([rows[0]]);
    });
    it("requires the profile object to supply editor defaults", () => {
        expect(() => {
            profileToDraft("new");
        }).toThrow("Backup profile defaults must be supplied by the profile.");
    });

    it.each([
        ["profile name", {}, { label: "Nightly Profile" }],
        ["local storage type", { storageType: "local" }, { storageType: "local" }],
        ["backup storage directory", {}, { destination: "/backups/mysql/nightly" }],
        ["comments", {}, { comments: "Profile comments" }],
        ["partial backup mode", { partial: true }, { partialMode: "filters" }],
        ["full backup mode", { partial: false }, { partialMode: "full" }],
        ["include table filter", {}, { includeTables: "^sales\\." }],
        ["exclude table filter", {}, { excludeTables: "^tmp\\." }],
        ["transportable tablespaces mode", {}, { usingTts: "2" }],
        ["full schedule enabled checkbox", {}, { fullSchedule: { enabled: true } }],
        ["full schedule interval field", {}, { fullSchedule: { interval: "3" } }],
        ["full schedule frequency selector", {}, { fullSchedule: { frequency: "2" } }],
        ["full schedule month day selector", {}, { fullSchedule: { monthDays: [14] } }],
        ["full schedule week day selectors", {}, {
            fullSchedule: { weekDays: [true, false, true, false, true, false, false] },
        }],
        ["full schedule hour selector", {}, { fullSchedule: { hour: "5" } }],
        ["full schedule minute selector", {}, { fullSchedule: { minute: "45" } }],
        ["incremental schedule enabled checkbox", {}, { incSchedule: { enabled: true } }],
        ["incremental schedule interval field", {}, { incSchedule: { interval: "2" } }],
        ["incremental schedule frequency selector", {}, { incSchedule: { frequency: "0" } }],
        ["incremental schedule month day selector", {}, { incSchedule: { monthDays: [1] } }],
        ["incremental schedule week day selectors", {}, {
            incSchedule: { weekDays: [false, false, false, false, false, false, false] },
        }],
        ["incremental schedule hour selector", {}, { incSchedule: { hour: "0" } }],
        ["incremental schedule minute selector", {}, { incSchedule: { minute: "15" } }],
        ["compression enabled", {}, { compress: true }],
        ["compression method", {}, { compressMethod: "zlib" }],
        ["compression level", {}, { compressLevel: "7" }],
        ["apply log after backup", {}, { applyLog: true }],
        ["skip unused pages", {}, { skipUnusedPages: true }],
        ["incremental backup base", {}, { incrementalBase: "history:last_full_backup" }],
        ["incremental redo-log-only mode", {}, { incrementalWithRedoLogOnly: true }],
        ["cloud service", {}, { cloudService: "openstack" }],
        ["cloud host", {}, { cloudHost: "storage.example.com" }],
        ["cloud bucket", {}, { cloudBucket: "bucket-a" }],
        ["cloud access key id", {}, { cloudAccessKeyId: "access-key-id" }],
        ["cloud AWS region", {}, { cloudAwsRegion: "us-west-2" }],
        ["cloud container", {}, { cloudContainer: "container-a" }],
        ["cloud user id", {}, { cloudUserId: "cloud-user" }],
        ["cloud TempAuth URL", {}, { cloudTempAuthUrl: "https://auth.example.com/temp" }],
        ["cloud BasicAuth URL", {}, { cloudBasicAuthUrl: "https://auth.example.com/basic" }],
        ["cloud identity URL", {}, { cloudIdentityUrl: "https://identity.example.com" }],
        ["cloud tenant", {}, { cloudTenant: "tenant-a" }],
        ["cloud region", {}, { cloudRegion: "region-a" }],
        ["cloud chunked transfer", {}, { cloudChunkedTransfer: true }],
        ["cloud chunk size", {}, { cloudChunkSize: "128M" }],
        ["cloud proxy", {}, { cloudProxy: "http://proxy.example.com" }],
        ["cloud CA info file", {}, { cloudCaInfo: "/etc/ssl/certs/ca.pem" }],
        ["cloud CA path", {}, { cloudCaPath: "/etc/ssl/certs" }],
        ["cloud buffer size", {}, { cloudBufferSize: "16M" }],
        ["cloud trace", {}, { cloudTrace: true }],
        ["profile config path", {}, { configPath: "/backups/mysql/nightly.cnf" }],
    ])("loads %s from profile into the editor draft", (_label, profileValues, expected) => {
        expect(profileToDraft("edit", profile(profileValues))).toMatchObject(expected);
    });

    it("defaults new profile storage to the data directory", () => {
        expect(profileToDraft("new", profile({
            label: "Nightly",
            destination: "/backups/mysql",
        }))).toMatchObject({
            label: "Nightly",
            destination: "/backups/mysql/data",
        });
    });

    it("does not load secret cloud values into password-like controls", () => {
        expect(profileToDraft("edit", profile())).toMatchObject({
            cloudParUrl: "",
            cloudSecretAccessKey: "",
            cloudAccessKey: "",
            cloudSecretKey: "",
            cloudPassword: "",
        });
    });

    it("returns the legacy partial backup conversion message for converted profiles", () => {
        expect(legacyPartialBackupConversionMessage(profile({
            legacyPartialBackupConverted: true,
            legacyPartialBackupConversionMessage: "Review converted filters.",
        }))).toBe("Review converted filters.");
    });

    it("does not return a legacy partial backup conversion message for modern profiles", () => {
        expect(legacyPartialBackupConversionMessage(profile({
            legacyPartialBackupConverted: false,
            legacyPartialBackupConversionMessage: "Review converted filters.",
        }))).toBeNull();
    });

    it("copies schedule weekday arrays when loading profile values", () => {
        const source = profile();
        const result = profileToDraft("edit", source);

        expect(result.fullSchedule.weekDays).toEqual(source.fullSchedule.weekDays);
        expect(result.incSchedule.weekDays).toEqual(source.incSchedule.weekDays);
        expect(result.fullSchedule.weekDays).not.toBe(source.fullSchedule.weekDays);
        expect(result.incSchedule.weekDays).not.toBe(source.incSchedule.weekDays);
    });

    it("round-trips selected monthly days between profile and draft", () => {
        const monthDays = [1, 15, 31];
        const source = profile({
            fullSchedule: schedule({ frequency: 3, monthDays }),
        });

        const result = draftToProfileConfiguration(profileToDraft("edit", source), saveContext);

        expect(result.fullSchedule.monthDays).toEqual(monthDays);
    });

    it("reports an enabled schedule on a new profile as changed", () => {
        const nextProfile = draftToProfileConfiguration(draft({
            fullSchedule: scheduleDraft({ enabled: true }),
            incSchedule: scheduleDraft({ enabled: false }),
        }), saveContext);

        expect(profileSchedulesChanged(undefined, nextProfile)).toBe(true);
    });

    it("reports effective edits to an existing schedule", () => {
        const currentProfile = profile();
        const nextProfile = draftToProfileConfiguration(profileToDraft("edit", currentProfile), saveContext);
        nextProfile.fullSchedule.minute = 30;

        expect(profileSchedulesChanged(currentProfile, nextProfile)).toBe(true);
    });

    it("keeps an unchanged effective schedule unchanged", () => {
        const currentProfile = profile();
        const nextProfile = draftToProfileConfiguration(profileToDraft("edit", currentProfile), saveContext);

        expect(profileSchedulesChanged(currentProfile, nextProfile)).toBe(false);
    });

    it("reports schedule enablement changes", () => {
        const currentProfile = profile({
            fullSchedule: schedule({ enabled: false }),
        });
        const nextProfile = draftToProfileConfiguration(profileToDraft("edit", currentProfile), saveContext);
        nextProfile.fullSchedule.enabled = true;

        expect(profileSchedulesChanged(currentProfile, nextProfile)).toBe(true);
    });

    it("ignores field edits while a schedule remains disabled", () => {
        const currentProfile = profile({
            fullSchedule: schedule({ enabled: false, minute: 15 }),
            incSchedule: schedule({ enabled: false }),
        });
        const nextProfile = draftToProfileConfiguration(profileToDraft("edit", currentProfile), saveContext);
        nextProfile.fullSchedule.minute = 30;

        expect(profileSchedulesChanged(currentProfile, nextProfile)).toBe(false);
    });

    it.each([
        ["profile name", { label: "  Edited Profile  " }, { label: "Edited Profile" }],
        ["local backup storage directory", {
            storageType: "local",
            destination: "  /backups/mysql/full  ",
        }, {
            storageType: "local",
            cloudService: null,
            destination: "/backups/mysql/full",
        }],
        ["comments", { comments: "Comment text" }, { comments: "Comment text" }],
        ["empty comments", { comments: "" }, { comments: null }],
        ["partial backup mode", { partialMode: "filters" }, { partial: true }],
        ["full backup mode", { partialMode: "full" }, { partial: false }],
        ["include table filter", { includeTables: "  ^sales\\.  " }, { includeTables: "^sales\\." }],
        ["empty include table filter", { includeTables: "  " }, { includeTables: null }],
        ["exclude table filter", { excludeTables: "  ^tmp\\.  " }, { excludeTables: "^tmp\\." }],
        ["empty exclude table filter", { excludeTables: "  " }, { excludeTables: null }],
        ["transportable tablespaces mode", { usingTts: "1" }, {
            usingTts: "1",
        }],
        ["full schedule enabled checkbox", { fullSchedule: scheduleDraft({ enabled: false }) }, {
            fullSchedule: { enabled: false },
        }],
        ["full schedule interval field", { fullSchedule: scheduleDraft({ interval: "4" }) }, {
            fullSchedule: { interval: 4 },
        }],
        ["full schedule frequency selector", { fullSchedule: scheduleDraft({ frequency: "3" }) }, {
            fullSchedule: { frequency: 3 },
        }],
        ["full schedule month day selector", { fullSchedule: scheduleDraft({ monthDays: [21] }) }, {
            fullSchedule: { monthDays: [21] },
        }],
        ["full schedule week day selectors", {
            fullSchedule: scheduleDraft({ weekDays: [false, true, false, true, false, true, false] }),
        }, {
            fullSchedule: { weekDays: [false, true, false, true, false, true, false] },
        }],
        ["full schedule hour selector", { fullSchedule: scheduleDraft({ hour: "18" }) }, {
            fullSchedule: { hour: 18 },
        }],
        ["full schedule minute selector", { fullSchedule: scheduleDraft({ minute: "30" }) }, {
            fullSchedule: { minute: 30 },
        }],
        ["incremental schedule enabled checkbox", { incSchedule: scheduleDraft({ enabled: false }) }, {
            incSchedule: { enabled: false },
        }],
        ["incremental schedule interval field", { incSchedule: scheduleDraft({ interval: "6" }) }, {
            incSchedule: { interval: 6 },
        }],
        ["incremental schedule frequency selector", { incSchedule: scheduleDraft({ frequency: "1" }) }, {
            incSchedule: { frequency: 1 },
        }],
        ["incremental schedule month day selector", { incSchedule: scheduleDraft({ monthDays: [8] }) }, {
            incSchedule: { monthDays: [8] },
        }],
        ["incremental schedule week day selectors", {
            incSchedule: scheduleDraft({ weekDays: [true, true, false, false, false, false, true] }),
        }, {
            incSchedule: { weekDays: [true, true, false, false, false, false, true] },
        }],
        ["incremental schedule hour selector", { incSchedule: scheduleDraft({ hour: "22" }) }, {
            incSchedule: { hour: 22 },
        }],
        ["incremental schedule minute selector", { incSchedule: scheduleDraft({ minute: "10" }) }, {
            incSchedule: { minute: 10 },
        }],
        ["compression enabled", { compress: true }, { compress: true }],
        ["compression method", { compressMethod: "lzma" }, { compressMethod: "lzma" }],
        ["compression level", { compressLevel: "9" }, { compressLevel: "9" }],
        ["apply log after backup", { applyLog: true }, { applyLog: true }],
        ["skip unused pages", { skipUnusedPages: true }, { skipUnusedPages: true }],
        ["incremental backup base", { incrementalBase: "history:last_full_backup" }, {
            incrementalBase: "history:last_full_backup",
        }],
        ["incremental redo-log-only mode", { incrementalWithRedoLogOnly: true }, {
            incrementalWithRedoLogOnly: true,
        }],
        ["profile config path", { configPath: "/backups/mysql/edited.cnf" }, {
            configPath: "/backups/mysql/edited.cnf",
        }],
        ["backup MySQL user", {}, { user: "mysqlbackup@localhost" }],
        ["server datadir", {}, { datadir: "/var/lib/mysql" }],
        ["server basedir", {}, { mysqlBasedir: "/usr" }],
    ])("saves %s from the editor draft into the profile payload", (_label, draftValues, expected) => {
        expect(draftToProfileConfiguration(draft(draftValues), saveContext)).toMatchObject(expected);
    });

    it("clears cloud fields when saving a local path profile", () => {
        expect(draftToProfileConfiguration(draft({
            storageType: "local",
            cloudService: "s3",
            cloudParUrl: "https://objectstorage.example/par",
            cloudHost: "storage.example.com",
            cloudBucket: "bucket-a",
            cloudAccessKeyId: "access-id",
            cloudSecretAccessKey: "secret-access",
            cloudAwsRegion: "us-west-2",
            cloudAccessKey: "gcp-access",
            cloudSecretKey: "gcp-secret",
            cloudContainer: "container-a",
            cloudUserId: "cloud-user",
            cloudPassword: "cloud-password",
            cloudTempAuthUrl: "https://auth.example.com/temp",
            cloudBasicAuthUrl: "https://auth.example.com/basic",
            cloudIdentityUrl: "https://identity.example.com",
            cloudTenant: "tenant-a",
            cloudRegion: "region-a",
            cloudChunkedTransfer: true,
            cloudChunkSize: "128M",
            cloudProxy: "http://proxy.example.com",
            cloudCaInfo: "/etc/ssl/certs/ca.pem",
            cloudCaPath: "/etc/ssl/certs",
            cloudBufferSize: "16M",
            cloudTrace: true,
        }), saveContext)).toMatchObject({
            storageType: "local",
            cloudService: null,
            cloudParUrl: null,
            cloudHost: null,
            cloudBucket: null,
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
        });
    });

});
