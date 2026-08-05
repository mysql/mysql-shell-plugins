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
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import type { Page } from "@playwright/test";
import type { ElectronApplication } from "playwright";

import { test, expect } from "../fixtures/electron.js";
import type { ElectronWorkbench, ITestConnection } from "../helpers/ElectronWorkbench.js";
import {
    databaseMigration,
    databaseMigrationSubSteps,
    dataSynchronization,
    dataSynchronizationSubSteps,
    finalize,
    finalizeSubSteps,
    MigrationAssistant,
    MigrationButton,
    migrationPlanSubSteps,
    MigrationMockStatus,
    provisioning,
    provisioningSubSteps,
    objectSelection,
    schemaCompatibilityChecks,
    setMigrationMockStatus,
    StepStatus,
    targetSelection,
    TileStepStatus,
    tiles,
} from "../helpers/MigrationAssistant.js";
import { localMySQLConnection, mysqlServerVersion } from "../helpers/testConfig.js";

const migrationElectronLaunchEnvironment = (
    overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> => {
    return {
        MYSQLSH_GUI_ENABLE_PLUGIN_MOCKS: "1",
        MIGRATION_TEST_OCI_MYSQL_VERSIONS:
            process.env.MIGRATION_TEST_OCI_MYSQL_VERSIONS ?? mysqlServerVersion(),
        ...overrides,
    };
};

const openMigrationAssistant = async (
    electronApp: ElectronApplication,
    page: Page,
    workbench: ElectronWorkbench,
    connection: ITestConnection,
) => {
    const migrationWindowPromise = electronApp.waitForEvent("window");
    await workbench.connectionTile(connection.caption).locator("#tileMigrationAssistantAction").click({
        force: true,
    });
    await expect(page.locator(".passwordDialog").first()).toBeVisible({ timeout: 15000 });
    expect(await workbench.submitPasswordIfRequested(connection.password)).toBe(true);

    const startupErrorPromise = page.locator(".notificationCenter .toast.error").first().innerText({
        timeout: 30000,
    }).then((message) => {
        throw new Error(`Migration Assistant did not open: ${message.trim()}`);
    });
    const migrationPage = await Promise.race([migrationWindowPromise, startupErrorPromise]);

    await expect(migrationPage.locator(".migration-sub-app")).toBeVisible({ timeout: 60000 });
    const sourceInfo = migrationPage.locator(".source-info");
    await expect(sourceInfo).toContainText(connection.caption, { timeout: 60000 });
    await expect(sourceInfo).toContainText(`localhost:${connection.port}`, { timeout: 60000 });
    await expect(migrationPage.locator(".passwordDialog.visible")).toHaveCount(0);

    return migrationPage;
};

const rootConnection = (caption: string): ITestConnection => {
    const localConnection = localMySQLConnection(caption);
    const rootPassword = process.env.DB_ROOT_PASSWORD ?? "";

    return {
        ...localConnection,
        user: "root",
        password: rootPassword === "-" ? "" : rootPassword,
    };
};

const openMigrationAssistantForTest = async (
    electronApp: ElectronApplication,
    page: Page,
    workbench: ElectronWorkbench,
    caption: string,
): Promise<Page> => {
    const connection = rootConnection(caption);
    await workbench.createMySQLConnection(connection);

    return openMigrationAssistant(electronApp, page, workbench, connection);
};

const assertSourceInfo = async (migrationAssistant: MigrationAssistant, caption: string): Promise<void> => {
    const sourceInfo = await migrationAssistant.getSourceInfo();
    expect(sourceInfo.connectionName).toBe(caption);
    expect(sourceInfo.server).toMatch(/mysql/u);
    expect(sourceInfo.uri).toMatch(/localhost:(\d+)/u);
    expect(sourceInfo.replicationInfo).toBe("Replication Possible (gtid_mode=ON)");
    expect(String(sourceInfo.schemas)).toMatch(/(\d+)/u);
    expect(sourceInfo.size).toMatch(/(\d+).(\d+)(\d+) MB/u);
};

const assertMigrationStartBlocked = async (page: Page): Promise<void> => {
    await expect(page.locator(".passwordDialog.visible")).toHaveCount(0);
    await expect(page.locator(".notificationCenter")).toContainText(/Migration Assistant is already open|migration is currently running/u);
};

const waitForMigrationPlanTileStepsPassed = async (
    migrationAssistant: MigrationAssistant,
): Promise<void> => {
    await expect.poll(async () => {
        const actualTiles = await migrationAssistant.getTiles();
        const migrationPlanTile = actualTiles.find((tile) => {
            return tile.name === "Migration Plan";
        });

        if (!migrationPlanTile) {
            return ["Migration Plan tile is missing"];
        }

        return migrationPlanTile.subSteps.filter((step) => {
            return step.status !== TileStepStatus.Passed;
        }).map((step) => {
            return `${step.name}: ${step.status}`;
        });
    }, {
        timeout: 30000,
        message: "Migration Plan tile steps should be passed",
    }).toEqual([]);
};

const fillMigrationPlan = async (migrationAssistant: MigrationAssistant): Promise<boolean> => {
    await migrationAssistant.dismissNotifications();
    if (!await migrationAssistant.fillUseExistingTargetSelectionAndAdvance()) {
        return false;
    }
    await migrationAssistant.setMigrationTypeIfVisible();
    await migrationAssistant.setNetworkConnectivityIfVisible();
    await migrationAssistant.next();
    await migrationAssistant.waitUntilStepIs({ caption: objectSelection, isExpanded: true }, 90000);
    await migrationAssistant.fillObjectSelectionDefaultsIfVisible();
    await migrationAssistant.next();
    await migrationAssistant.waitUntilStepIs({ caption: schemaCompatibilityChecks, isExpanded: true }, 90000);
    await migrationAssistant.waitForCompatibilityChecksDoneWithIssues();

    const issues = await migrationAssistant.getCompatibilityIssues();
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
        expect(["error", "info"]).toContain(issue.type);
        expect(issue.name).toMatch(/^(?!\s*$).+/u);
        expect(issue.details.description).toMatch(/^(?!\s*$).+/u);
        expect(issue.details.defaultResolution).toMatch(/^(?!\s*$).+/u);
    }

    await migrationAssistant.changeCompatibilityIssueResolution("Table Missing Primary Key or Equivalent",
        "EXCLUDE_OBJECT");
    await migrationAssistant.next();
    await migrationAssistant.waitForMigrationPlanReady();
    expect(await migrationAssistant.migrationPlanIsReady()).toBe(true);
    expect(await migrationAssistant.existsExplanationMigrationPlan()).toBe(true);
    expect(await migrationAssistant.isButtonEnabled(MigrationButton.Next)).toBe(false);
    expect(await migrationAssistant.isButtonEnabled(MigrationButton.StartMigration)).toBe(true);

    return true;
};

const assertMigrationPlanStepsPassed = async (migrationAssistant: MigrationAssistant): Promise<void> => {
    await migrationAssistant.selectTile("Migration Plan");
    const steps = await migrationAssistant.getPlanSteps();
    expect(steps.length).toBeGreaterThan(0);

    for (const step of steps) {
        expect(migrationPlanSubSteps).toContain(step.caption);
        expect(step.isExpanded).toBe(false);
    }
};

const assertTilesForActiveMigration = async (migrationAssistant: MigrationAssistant, status: TileStepStatus): Promise<void> => {
    await waitForMigrationPlanTileStepsPassed(migrationAssistant);

    const actualTiles = await migrationAssistant.getTiles();
    expect(actualTiles.length).toBe(5);

    for (const tile of actualTiles) {
        expect(tiles.has(tile.name!)).toBe(true);
        expect(tile.subSteps.length).toBeGreaterThan(0);

        for (const step of tile.subSteps) {
            if (migrationPlanSubSteps.includes(step.name!)) {
                expect(step.status, `Expected ${step.name}`).toBe(TileStepStatus.Passed);
            } else if (provisioningSubSteps.includes(step.name!)) {
                expect(step.status, `Expected ${step.name}`).toBe(status);
            } else if (databaseMigrationSubSteps.includes(step.name!)) {
                expect(step.status, `Expected ${step.name}`).toBe(step.name === "Enable High Availability"
                    ? TileStepStatus.NotStarted
                    : status);
            } else if (dataSynchronizationSubSteps.includes(step.name!)) {
                expect(step.status, `Expected ${step.name}`).toBe(step.name === "Check Connectivity"
                    ? TileStepStatus.NotStarted
                    : status);
            } else if (finalizeSubSteps.includes(step.name!)) {
                expect(step.status, `Expected ${step.name}`).toBe(step.name === "Monitor Replication Progress"
                    && status === TileStepStatus.Failed
                    ? TileStepStatus.Failed
                    : TileStepStatus.NotStarted);
            } else {
                throw new Error(`Unknown step '${step.name}'`);
            }
        }
    }
};

const assertStepGroup = async (
    migrationAssistant: MigrationAssistant,
    tileName: string,
    expectedCaptions: string[],
    expectedStatus: StepStatus,
    expectedDescription?: string,
): Promise<void> => {
    await migrationAssistant.selectTile(tileName);
    await expect.poll(async () => {
        const steps = await migrationAssistant.getSteps();

        return steps.length > 0 && steps.every((step) => {
            return expectedCaptions.includes(step.caption!) && step.status === expectedStatus;
        });
    }, { timeout: 30000, message: `Expected ${tileName} steps to be ${expectedStatus}` }).toBe(true);

    const steps = await migrationAssistant.getSteps();
    expect(steps.length).toBeGreaterThan(0);

    for (const step of steps) {
        if (!step.isExpanded) {
            await step.toggle!.click();
        }

        expect(expectedCaptions).toContain(step.caption);
        expect(step.status).toBe(expectedStatus);
        if (expectedDescription) {
            expect(step.description).toContain(expectedDescription);
        }
    }
};

test.describe("Migration Assistant", () => {
    test.use({
        electronLaunchEnvironment: migrationElectronLaunchEnvironment(),
    });

    test("opens from an Electron desktop connection tile", async ({ electronApp, page, workbench }) => {
        await workbench.waitForShell();

        const localConnection = localMySQLConnection("local connection");
        const rootPassword = process.env.DB_ROOT_PASSWORD ?? "";
        const connection = {
            ...localConnection,
            user: "root",
            password: rootPassword === "-" ? "" : rootPassword,
        };
        await workbench.createMySQLConnection(connection);

        await openMigrationAssistant(electronApp, page, workbench, connection);
    });

    test("reopens after the Migration Assistant window is closed", async ({ electronApp, page, workbench }) => {
        await workbench.waitForShell();

        const localConnection = localMySQLConnection("local connection reopen");
        const rootPassword = process.env.DB_ROOT_PASSWORD ?? "";
        const connection = {
            ...localConnection,
            user: "root",
            password: rootPassword === "-" ? "" : rootPassword,
        };
        await workbench.createMySQLConnection(connection);

        const firstMigrationPage = await openMigrationAssistant(electronApp, page, workbench, connection);
        firstMigrationPage.on("dialog", (dialog) => {
            void dialog.accept().catch(() => {
                // The close can complete before Playwright accepts the beforeunload dialog.
            });
        });
        const closePromise = firstMigrationPage.waitForEvent("close");
        const closed = await firstMigrationPage.evaluate(() => {
            window.close();

            return true;
        });
        expect(closed).toBe(true);
        await closePromise;

        await openMigrationAssistant(electronApp, page, workbench, connection);
    });

    test("keeps the open migration assistant when another connection asks to start", async ({
        electronApp, page, workbench,
    }) => {
        await workbench.waitForShell();

        const firstConnection = rootConnection("local connection open migration");
        await workbench.createMySQLConnection(firstConnection);
        const migrationPage = await openMigrationAssistant(electronApp, page, workbench, firstConnection);
        const migrationAssistant = new MigrationAssistant(migrationPage);
        await assertSourceInfo(migrationAssistant, firstConnection.caption);

        const blockedConnection = rootConnection("local connection blocked open migration");
        await workbench.createMySQLConnection(blockedConnection);
        await workbench.connectionTile(blockedConnection.caption).locator("#tileMigrationAssistantAction").click({
            force: true,
        });
        await assertMigrationStartBlocked(page);
        await migrationPage.waitForTimeout(2000);

        await assertSourceInfo(migrationAssistant, firstConnection.caption);
    });

    test.describe("with create-new VCN available", () => {
        test.use({
            electronLaunchEnvironment: migrationElectronLaunchEnvironment({
                MIGRATION_TEST_DEFAULT_VCN_NAME: "ElectronMigrationAssistantCIDRTestNoDefaultVcn",
            }),
        });

        test("validates target option CIDR input", async ({ electronApp, page, workbench }) => {
            await workbench.waitForShell();

            const migrationPage = await openMigrationAssistantForTest(electronApp, page, workbench,
                "local connection target validation");
            const migrationAssistant = new MigrationAssistant(migrationPage);
            test.skip(!await migrationAssistant.setCreateNewNetworkTargetOptions(),
                "Create New networking is not available for this OCI profile.");

            await migrationAssistant.setOnPremisePublicCidrBlock("");
            await migrationAssistant.next();
            await migrationAssistant.waitForLoadingIcon();
            await migrationAssistant.waitUntilStepIs({ caption: targetSelection, isExpanded: true }, 5000);
            await expect(migrationAssistant.onPremisePublicCidrBlockErrors()).toContainText("Required value missing");

            await migrationAssistant.setOnPremisePublicCidrBlock("2001:db8::1/128");
            await migrationAssistant.next();
            await migrationAssistant.waitForLoadingIcon();
            await migrationAssistant.waitUntilStepIs({ caption: targetSelection, isExpanded: true }, 5000);
            await expect(migrationAssistant.onPremisePublicCidrBlockErrors()).toContainText("Invalid IPv4 CIDR block");

            await migrationAssistant.setOnPremisePublicCidrBlock("0.0.0.0/0");
            await migrationAssistant.next();
            await migrationAssistant.waitForLoadingIcon();
            await migrationAssistant.waitUntilStepIs({ caption: targetSelection, isExpanded: false }, 90000);
            await migrationAssistant.waitUntilStepIs({ caption: "Migration Type", isExpanded: true }, 90000);
        });
    });

    test("shows migration in progress status", async ({ electronApp, page, workbench }) => {
        await workbench.waitForShell();

        const migrationPage = await openMigrationAssistantForTest(electronApp, page, workbench,
            "local connection running migration");
        const migrationAssistant = new MigrationAssistant(migrationPage);
        await assertSourceInfo(migrationAssistant, "local connection running migration");
        test.skip(!await fillMigrationPlan(migrationAssistant), "Required OCI target options are not available.");
        await setMigrationMockStatus(page, MigrationMockStatus.Running);
        await migrationAssistant.startMigration();
        await expect.poll(async () => {
            return (await migrationAssistant.getCurrentHeaderStep())?.includes(provisioning) ?? false;
        }, { timeout: 30000, message: "'Provisioning' should be the current header" }).toBe(true);

        await assertTilesForActiveMigration(migrationAssistant, TileStepStatus.Running);
        await assertMigrationPlanStepsPassed(migrationAssistant);
        await assertStepGroup(migrationAssistant, provisioning, provisioningSubSteps, StepStatus.Running);
        await assertStepGroup(migrationAssistant, databaseMigration, databaseMigrationSubSteps, StepStatus.Running);
        await assertStepGroup(migrationAssistant, dataSynchronization, dataSynchronizationSubSteps, StepStatus.Running);
        await assertStepGroup(migrationAssistant, finalize, finalizeSubSteps, StepStatus.NotStarted);
    });

    test("keeps the running migration when another connection asks to start", async ({ electronApp, page, workbench }) => {
        await workbench.waitForShell();

        const firstCaption = "local connection active migration";
        const migrationPage = await openMigrationAssistantForTest(electronApp, page, workbench, firstCaption);
        const migrationAssistant = new MigrationAssistant(migrationPage);
        await assertSourceInfo(migrationAssistant, firstCaption);
        test.skip(!await fillMigrationPlan(migrationAssistant), "Required OCI target options are not available.");
        await setMigrationMockStatus(page, MigrationMockStatus.Running);
        await migrationAssistant.startMigration();
        await expect.poll(async () => {
            return (await migrationAssistant.getCurrentHeaderStep())?.includes(provisioning) ?? false;
        }, { timeout: 30000, message: "'Provisioning' should be the current header" }).toBe(true);

        const blockedConnection = rootConnection("local connection blocked migration");
        await workbench.createMySQLConnection(blockedConnection);
        await workbench.connectionTile(blockedConnection.caption).locator("#tileMigrationAssistantAction").click({
            force: true,
        });
        await assertMigrationStartBlocked(page);
        await migrationPage.waitForTimeout(2000);

        await assertSourceInfo(migrationAssistant, firstCaption);
    });

    test("shows failed migration status", async ({ electronApp, page, workbench }) => {
        await workbench.waitForShell();

        const migrationPage = await openMigrationAssistantForTest(electronApp, page, workbench,
            "local connection failed migration");
        const migrationAssistant = new MigrationAssistant(migrationPage);
        await assertSourceInfo(migrationAssistant, "local connection failed migration");
        test.skip(!await fillMigrationPlan(migrationAssistant), "Required OCI target options are not available.");
        await setMigrationMockStatus(page, MigrationMockStatus.Failed);
        await migrationAssistant.startMigration();
        await expect.poll(async () => {
            return (await migrationAssistant.getCurrentHeaderStep())?.includes(provisioning) ?? false;
        }, { timeout: 30000, message: "'Provisioning' should be the current header" }).toBe(true);

        await migrationAssistant.dismissNotifications();
        await assertTilesForActiveMigration(migrationAssistant, TileStepStatus.Failed);
        await assertMigrationPlanStepsPassed(migrationAssistant);
        await assertStepGroup(migrationAssistant, provisioning, provisioningSubSteps, StepStatus.Failed,
            "An error has occurred");
        await assertStepGroup(migrationAssistant, databaseMigration, databaseMigrationSubSteps, StepStatus.Failed,
            "An error has occurred");
        await assertStepGroup(migrationAssistant, dataSynchronization, dataSynchronizationSubSteps, StepStatus.Failed,
            "An error has occurred");
        await migrationAssistant.selectTile(finalize);
        const finalizeSteps = await migrationAssistant.getSteps();
        expect(finalizeSteps.length).toBeGreaterThan(0);
        expect(finalizeSteps[0].status).toBe(StepStatus.Failed);
        expect(finalizeSteps[0].description).toContain("An error has occurred");
        expect(finalizeSteps[1].status).toBe(StepStatus.NotStarted);
    });

    test("shows aborted migration status", async ({ electronApp, page, workbench }) => {
        await workbench.waitForShell();

        const migrationPage = await openMigrationAssistantForTest(electronApp, page, workbench,
            "local connection aborted migration");
        const migrationAssistant = new MigrationAssistant(migrationPage);
        await assertSourceInfo(migrationAssistant, "local connection aborted migration");
        test.skip(!await fillMigrationPlan(migrationAssistant), "Required OCI target options are not available.");
        await setMigrationMockStatus(page, MigrationMockStatus.Running);
        await migrationAssistant.startMigration();
        await expect.poll(async () => {
            return (await migrationAssistant.getCurrentHeaderStep())?.includes(provisioning) ?? false;
        }, { timeout: 30000, message: "'Provisioning' should be the current header" }).toBe(true);

        await setMigrationMockStatus(page, MigrationMockStatus.Aborted);
        await migrationAssistant.abortMigration();
        await migrationAssistant.dismissNotifications();
        await assertTilesForActiveMigration(migrationAssistant, TileStepStatus.Running);
        await assertMigrationPlanStepsPassed(migrationAssistant);
        await assertStepGroup(migrationAssistant, provisioning, provisioningSubSteps, StepStatus.Aborted,
            "Operation aborted");
        await assertStepGroup(migrationAssistant, databaseMigration, databaseMigrationSubSteps, StepStatus.Aborted,
            "Operation aborted");
        await assertStepGroup(migrationAssistant, dataSynchronization, dataSynchronizationSubSteps, StepStatus.Aborted,
            "Operation aborted");
        await migrationAssistant.selectTile(finalize);
        const finalizeSteps = await migrationAssistant.getSteps();
        expect(finalizeSteps.length).toBeGreaterThan(1);
        const abortedFinalizeStep = finalizeSteps.find((step) => {
            return step.status === StepStatus.Aborted;
        });
        const notStartedFinalizeStep = finalizeSteps.find((step) => {
            return step.status === StepStatus.NotStarted;
        });
        expect(abortedFinalizeStep?.description).toContain("Operation aborted");
        expect(notStartedFinalizeStep).toBeDefined();
    });

    test("shows successful migration status", async ({ electronApp, page, workbench }) => {
        await workbench.waitForShell();

        const migrationPage = await openMigrationAssistantForTest(electronApp, page, workbench,
            "local connection successful migration");
        const migrationAssistant = new MigrationAssistant(migrationPage);
        await assertSourceInfo(migrationAssistant, "local connection successful migration");
        test.skip(!await fillMigrationPlan(migrationAssistant), "Required OCI target options are not available.");
        await setMigrationMockStatus(page, MigrationMockStatus.Success);
        await migrationAssistant.startMigration();
        await expect.poll(async () => {
            return (await migrationAssistant.getCurrentHeaderStep())?.includes(finalize) ?? false;
        }, { timeout: 30000, message: "'Finalize' should be the current header" }).toBe(true);

        await migrationAssistant.dismissNotifications();
        await waitForMigrationPlanTileStepsPassed(migrationAssistant);

        const actualTiles = await migrationAssistant.getTiles();
        expect(actualTiles.length).toBe(5);
        for (const tile of actualTiles) {
            expect(tiles.has(tile.name!)).toBe(true);
            for (const step of tile.subSteps) {
                expect(tiles.get(tile.name!)).toContain(step.name);
                if (step.name === "Database Ready") {
                    expect(step.status, `Expected ${step.name}`).toBe(TileStepStatus.Current);
                } else if (step.name === "Enable High Availability" || step.name === "Check Connectivity") {
                    expect(step.status, `Expected ${step.name}`).toBe(TileStepStatus.NotStarted);
                } else {
                    expect(step.status, `Expected ${step.name}`).toBe(TileStepStatus.Passed);
                }
            }
        }

        await assertMigrationPlanStepsPassed(migrationAssistant);
        await assertStepGroup(migrationAssistant, provisioning, provisioningSubSteps, StepStatus.Passed,
            "Step was successful");
        await assertStepGroup(migrationAssistant, databaseMigration, databaseMigrationSubSteps, StepStatus.Passed);
        await assertStepGroup(migrationAssistant, dataSynchronization, dataSynchronizationSubSteps, StepStatus.Passed,
            "Step was successful");
        await migrationAssistant.selectTile(finalize);
        const finalizeSteps = await migrationAssistant.getFinalizeSteps();
        expect(finalizeSteps.length).toBeGreaterThan(0);
        expect(finalizeSteps[0].status).toBe(StepStatus.Passed);
        expect(finalizeSteps[0].description).toContain("Step was successful");
        expect(finalizeSteps[1].status).toBe(StepStatus.Running);
        expect(await migrationAssistant.databaseReadyTitle()).toMatch(/Congratulations/u);

        const codeBlocks = await migrationAssistant.databaseReadyCodeBlocks();
        expect(codeBlocks[1]).toContain("ssh");
        expect(codeBlocks[2]).toMatch(/mysqlsh.*root@(\d+).(\d+).(\d+).(\d+)/u);
        await migrationAssistant.copyDatabaseReadyCode(0);
        expect(await migrationAssistant.clipboardMatches(/(\d+).(\d+).(\d+).(\d+)/u)).toBe(true);
    });

    test.describe("with invalid OCI config", () => {
        test.use({
            electronLaunchEnvironment: migrationElectronLaunchEnvironment({
                MYSQLSH_OCI_CONFIG_FILE: "dummy",
            }),
        });

        test("shows OCI sign-in controls when config is invalid", async ({ electronApp, page, workbench }) => {
            await workbench.waitForShell();

            const migrationPage = await openMigrationAssistantForTest(electronApp, page, workbench,
                "local connection invalid config");
            const migrationAssistant = new MigrationAssistant(migrationPage);
            await migrationAssistant.waitUntilStepIs({ caption: targetSelection, isExpanded: true }, 5000);
            await expect(migrationPage.locator(`[caption="OCI Sign In"]`)).toBeVisible();
            await expect(migrationPage.locator(`[caption="Sign Up to OCI"]`)).toBeVisible();
            await migrationPage.locator(`[caption="OCI Sign In"]`).click();
            await migrationPage.locator(".oci-sign-in span").click({ timeout: 10000 });
            expect(await migrationAssistant.clipboardMatches(/https:\/\/login.oci.oraclecloud.com/u)).toBe(true);
        });
    });
});
