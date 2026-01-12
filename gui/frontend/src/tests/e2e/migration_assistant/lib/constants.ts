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
 * separately licensed software that they have included with
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

export const targetSelection = "Target Selection";
export const wait1second = 1000;
export enum MigrationTypeEnum {
    ColdMigration = "Cold Migration",
    HotMigration = "Hot Migration"
}

export enum NetworkConnectivityEnum {
    SiteToSite = "site-to-site",
    SshTunnel = "ssh-tunnel",
    LocalSshTunnel = "local-ssh-tunnel"
}

export enum CompatibilityIssueEnum {
    Info = "info",
    Error = "error"
}

export enum MigrationButtonEnum {
    Back = "Back",
    Next = "Next",
    StartMigration = "Start Migration Process"
}

export enum StepStatusEnum {
    Passed = "Passed",
    Failed = "Failed",
    Running = "Running",
    NotStarted = "Not Started",
    Aborted = "Aborted"
}

export enum TileStepStatusEnum {
    NotStarted = " – ",
    ToStart = " ‧ ",
    Passed = " ✓ ",
    Failed = " ❗ ",
    Current = " ▸ ",
    Running = "loading",
}

export enum MockMigrationStatusEnum {
    Success = "Success",
    Running = "Running",
    Failed = "Failed",
    NotStarted = "Not Started",
    Aborted = "Aborted"
}

export const migrationPlan = "Migration Plan";
export const migrationPlanSubSteps = [
    "Target Selection",
    "Migration Type",
    "Schema Compatibility Checks",
    "Preview Migration Plan"
];

export const provisioning = "Provisioning";
export const provisioningSubSteps = [
    "Compartment",
    "Object Storage",
    "Virtual Cloud Network",
    "Compute",
    "Prepare Jump Host",
    "MySQL DB System",
    "HeatWave Cluster"
];

export const databaseMigration = "Database Migration";
export const databaseMigrationSubSteps = [
    "Export",
    "Connect to DB System",
    "Import",
    "Enable Crash Recovery",
    "Enable High Availability",
];

export const dataSynchronization = "Data Synchronization";
export const dataSynchronizationSubSteps = [
    "Setup SSH Tunnel",
    "Check Connectivity",
    "Start Replication",
];

export const finalize = "Finalize";
export const finalizeSubSteps = [
    "Monitor Replication Progress",
    "Database Ready"
];

export const tiles = new Map([
    [migrationPlan, migrationPlanSubSteps],
    [provisioning, provisioningSubSteps],
    [databaseMigration, databaseMigrationSubSteps],
    [dataSynchronization, dataSynchronizationSubSteps],
    [finalize, finalizeSubSteps]
]);

