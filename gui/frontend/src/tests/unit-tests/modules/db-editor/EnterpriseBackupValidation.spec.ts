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

import {
    validateMebProfileRequiredFields,
    validateMebProfileSaveOptions,
    validateMebTableFilters,
} from "../../../../modules/db-editor/EnterpriseBackupValidation.js";
import type { IMebProfileDraft } from "../../../../modules/db-editor/EnterpriseBackupProfileMapping.js";

const draft = (values: Partial<IMebProfileDraft> = {}): IMebProfileDraft => {
    return {
        storageType: "local",
        destination: "/backup-home/full",
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
        fullSchedule: {
            enabled: false,
            interval: "1",
            frequency: "1",
            monthDays: [1],
            weekDays: [false, false, false, false, false, false, false],
            hour: "0",
            minute: "0",
        },
        incSchedule: {
            enabled: false,
            interval: "1",
            frequency: "1",
            monthDays: [1],
            weekDays: [false, false, false, false, false, false, false],
            hour: "0",
            minute: "0",
        },
        ...values,
    } as IMebProfileDraft;
};

describe("EnterpriseBackupValidation tests", (): void => {

    it("requires a table expression for filter-mode partial backups", () => {
        expect(validateMebTableFilters("full", "", "")).toBeNull();
        expect(validateMebTableFilters("filters", "", ""))
            .toBe("Enter an include or exclude expression for the partial backup.");
        expect(validateMebTableFilters("filters", "  ", "\t"))
            .toBe("Enter an include or exclude expression for the partial backup.");
        expect(validateMebTableFilters("filters", "", "^archive\\.")).toBeNull();
        expect(validateMebTableFilters("filters", "^sales\\.\\d+$", "^(?=tmp\\.)")).toBeNull();
    });

    it("reports the missing save field instead of a combined profile/destination error", () => {
        expect(validateMebProfileRequiredFields("New Backup Profile", ""))
            .toEqual("Enter a backup storage directory.");
        expect(validateMebProfileRequiredFields("", "/backups/mysql/full"))
            .toEqual("Enter a profile name.");
        expect(validateMebProfileRequiredFields("New Backup Profile", "/backups/mysql/full"))
            .toBeNull();
    });

    it("rejects local storage paths outside the backup home", () => {
        expect(validateMebProfileSaveOptions("/backup-home", draft({
            destination: "/backup-home/full",
        }))).toBeNull();
        expect(validateMebProfileSaveOptions("/backup-home", draft({
            destination: "/backup-home",
        }))).toEqual({
            message: "Enter a backup storage directory.",
            tab: "storage",
        });
        expect(validateMebProfileSaveOptions("/backup-home", draft({
            destination: "/backup-home/../outside",
        }))).toEqual({
            message: "Backup storage directory must be inside the backup home.",
            tab: "storage",
        });
    });

    it("rejects invalid enabled schedule values", () => {
        expect(validateMebProfileSaveOptions("/backup-home", draft({
            fullSchedule: {
                enabled: true,
                interval: "1",
                frequency: "1",
                monthDays: [1],
                weekDays: [false, false, false, false, false, false, false],
                hour: "25",
                minute: "0",
            },
        }))).toEqual({
            message: "Full backup schedule hour must be between 0 and 23.",
            tab: "schedule",
        });
        expect(validateMebProfileSaveOptions("/backup-home", draft({
            incSchedule: {
                enabled: true,
                interval: "1",
                frequency: "2",
                monthDays: [1],
                weekDays: [false, false, false, false, false, false, false],
                hour: "2",
                minute: "0",
            },
        }))).toEqual({
            message: "Weekly incremental backup schedule has no days selected.",
            tab: "schedule",
        });
    });

    it("accepts multiple monthly days at one time", () => {
        expect(validateMebProfileSaveOptions("/backup-home", draft({
            fullSchedule: {
                enabled: true,
                interval: "1",
                frequency: "3",
                monthDays: [1, 15, 30],
                weekDays: [false, false, false, false, false, false, false],
                hour: "2",
                minute: "30",
            },
        }))).toBeNull();
    });

    it("enforces the interval limit for each schedule frequency", () => {
        expect(validateMebProfileSaveOptions("/backup-home", draft({
            fullSchedule: {
                enabled: true,
                interval: "2",
                frequency: "2",
                monthDays: [1],
                weekDays: [false, true, false, false, false, false, false],
                hour: "2",
                minute: "30",
            },
        }))).toEqual({
            message: "Full backup schedule interval must be between 1 and 1.",
            tab: "schedule",
        });

        expect(validateMebProfileSaveOptions("/backup-home", draft({
            fullSchedule: {
                enabled: true,
                interval: "24",
                frequency: "0",
                monthDays: [1],
                weekDays: [false, false, false, false, false, false, false],
                hour: "0",
                minute: "30",
            },
        }))).toEqual({
            message: "Full backup schedule interval must be between 1 and 23.",
            tab: "schedule",
        });
    });

    it("requires a monthly schedule to select a day", () => {
        expect(validateMebProfileSaveOptions("/backup-home", draft({
            fullSchedule: {
                enabled: true,
                interval: "1",
                frequency: "3",
                monthDays: [],
                weekDays: [false, false, false, false, false, false, false],
                hour: "2",
                minute: "30",
            },
        }))).toEqual({
            message: "Full backup schedule days of month must contain one or more unique days between 1 and 31.",
            tab: "schedule",
        });
    });

    it("requires monthly selections to be valid days of the month", () => {
        expect(validateMebProfileSaveOptions("/backup-home", draft({
            fullSchedule: {
                enabled: true,
                interval: "1",
                frequency: "3",
                monthDays: [32],
                weekDays: [false, false, false, false, false, false, false],
                hour: "2",
                minute: "30",
            },
        }))).toEqual({
            message: "Full backup schedule days of month must contain one or more unique days between 1 and 31.",
            tab: "schedule",
        });
    });

});
