/*
 * Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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

import {
    IMigrationChecksOptions,
    IMigrationChecksData,
    SubStepId,
    CompatibilityFlags
} from "../../communication/ProtocolMigration.js";
import { IMigrationAppState } from "./MigrationSubApp.js";

type PostProcessValues = typeof postProcessValues;

export const toNumber = (value?: string): number => {
    if (!value) {
        return 0;
    }

    return parseInt(value, 10);
};

export const toFloat = (value?: string): number => {
    if (!value) {
        return 0;
    }

    const num = parseFloat(value);

    return isNaN(num) ? 0 : num;
};

export const toBoolean = (value?: string | number | boolean) => {
    switch (typeof value) {
        case "string":
            return value !== "0" && value !== "" && value !== "false";
        case "number":
            return !!value;
        case "boolean":
            return value;
        default:
            return !!value;
    }
};

const toHeatWaveShape = (value?: string | number | boolean) => {
    return value !== "0" ? value : "";
};

const postProcessValues = {
    "database.storageSizeGB": toNumber,
    "database.heatWaveClusterSize": toNumber,
    "hosting.createVcn": toBoolean,
    "hosting.cpuCount": toFloat,
    "hosting.memorySizeGB": toNumber,
    "database.heatWaveShapeName": toHeatWaveShape,
    "database.enableHA": toBoolean,
    "database.enableHeatWave": toBoolean,
    "database.enableRestService": toBoolean,
    "database.enableBackup": toBoolean,
    "database.autoExpandStorage": toBoolean,
    // "database.isProduction": toBoolean,
} as const;

type PostProcessValuesKeys = keyof PostProcessValues;

/**
 * Processes a value based on the provided key using the postProcessValues map.
 *
 * @param key - The key to determine the processing function.
 * @param value - The optional value to process.
 * @returns The processed value.
 */
const postProcess = <K extends keyof PostProcessValues>(
    key: K,
    value?: string
) => {
    return postProcessValues[key](value) as ReturnType<PostProcessValues[K]>;
};

export class BackendRequestHelper {

    public generateBackendRequest(subStepId: SubStepId, state: Partial<IMigrationAppState>) {
        const { formGroupValues: formGroupValuesOriginal } = state;
        const formGroupValues: Record<string, string | boolean | number | string[] | undefined> = {
            ...formGroupValuesOriginal,
        };

        for (const key in postProcessValues) {
            const typedKey = key as PostProcessValuesKeys;
            const currentValue = formGroupValuesOriginal?.[typedKey];
            const newValue = postProcess(typedKey, currentValue);

            formGroupValues[typedKey] = newValue;
        }

        let request;
        switch (subStepId) {

            case SubStepId.MIGRATION_TYPE: {
                const { type, connectivity } = formGroupValues;

                request = {
                    type,
                    connectivity,
                };

                break;
            }

            case SubStepId.MIGRATION_CHECKS: {
                request = this.generateMigrationChecksRequest(state);

                break;
            }

            case SubStepId.SCHEMA_SELECTION: {
                const { filterInfo } = state;

                request = filterInfo?.getOptions();
                break;
            }

            default: {
                request = this.generate(subStepId, formGroupValues);
                break;
            }
        }

        return JSON.stringify(request);
    }

    private generate(subStepId: SubStepId,
        formGroupValues: Record<string, string | boolean | number | string[] | undefined>,
        skipUndefined?: boolean): Record<string, unknown> {

        const keys = this.getInputNames(subStepId);

        const result: Record<string, unknown> = {};

        for (const keyPath of keys) {
            const parts = keyPath.split(".");
            let current: Record<string, unknown> = result;

            for (let i = 0; i < parts.length; i++) {
                const k = parts[i];
                if (i === parts.length - 1) {
                    let value = formGroupValues[keyPath];

                    if (value === undefined && skipUndefined) {
                        continue;
                    }
                    if (value === "create_new") {
                        value = "";
                    }
                    current[k] = value ?? "";
                } else {
                    if (typeof current[k] !== "object" || current[k] === null) {
                        current[k] = {};
                    }
                    // Type assertion is safe: all non-leaf keys are always objects
                    current = current[k] as Record<string, unknown>;
                }
            }
        }

        return result;
    }

    private generateMigrationChecksRequest(state: Partial<IMigrationAppState>): IMigrationChecksOptions {
        const { issueResolution, backendState } = state;
        const compatibilityChecks = this.getDefaultCompatibilityChecks();

        if (!backendState?.[SubStepId.MIGRATION_CHECKS]?.data || !issueResolution) {
            return compatibilityChecks;
        }

        const data: IMigrationChecksData = backendState[SubStepId.MIGRATION_CHECKS].data as IMigrationChecksData;

        const issues = data.issues;
        if (!issues.length) {
            return compatibilityChecks;
        }

        issues.forEach((i) => {
            if (i.checkId) {
                compatibilityChecks.issueResolution[i.checkId] = issueResolution[i.checkId] as CompatibilityFlags;
            }
        });

        return compatibilityChecks;
    }

    private getDefaultCompatibilityChecks(): IMigrationChecksOptions {
        return {
            issueResolution: {},
        };
    }

    private getInputNames(subStepId: SubStepId) {
        switch (subStepId) {
            case SubStepId.OCI_PROFILE: {
                return [
                    "profile",
                    "configFile"
                ];
            }

            case SubStepId.SOURCE_SELECTION: {
                return [
                    "sourceUri",
                    "password",
                ];
            }

            case SubStepId.TARGET_OPTIONS: {
                return [
                    "hosting.compartmentId",
                    "hosting.networkCompartmentId",
                    "hosting.createVcn",
                    "hosting.vcnId",
                    "hosting.privateSubnet.id",
                    "hosting.publicSubnet.id",

                    "database.shapeName",
                    "database.storageSizeGB",
                    "database.enableHeatWave",
                    "database.heatWaveShapeName",
                    "database.heatWaveClusterSize",

                    "database.enableHA",
                    "hosting.shapeName",
                    "hosting.cpuCount",
                    "hosting.memorySizeGB",
                    "hosting.onPremisePublicCidrBlock",

                    // "hosting.computeName",
                    // "hosting.bucketName",

                    "database.name",
                    "database.contactEmails",
                    "database.adminUsername",
                    "database.adminPassword",
                    "database.adminPasswordConfirm",

                    "database.enableRestService",

                    // "database.isProduction",
                    "database.enableBackup",
                    "database.autoExpandStorage",
                ];
            }

            default:
                return [];
        }
    }
}
