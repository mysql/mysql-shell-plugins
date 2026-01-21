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
/* eslint-disable no-restricted-syntax */

import { test, expect } from "@playwright/test";
import { Misc, browser } from "../lib/Misc.js";
import { PasswordDialog } from "../lib/PasswordDialog.js";
import { MigrationAssistantPage } from "../lib/MigrationAssistantPage.js";
import * as constants from "../lib/constants.js";
import * as interfaces from "../lib/interfaces.js";
import { wait1second } from "e2e/lib/constants.js";

const migrationAssistant = new MigrationAssistantPage();

test.describe("Successful Migration", () => {

    // eslint-disable-next-line no-empty-pattern
    test.beforeAll(async ({ }, testInfo) => {
        await Misc.loadPage(testInfo.titlePath[1], constants.MockMigrationStatusEnum.Success);

        const passwordDialog = new PasswordDialog();
        if (await passwordDialog.exists()) {
            await passwordDialog.setCredentials(String(process.env.DBROOTPASSWORD));
        }

        await Misc.waitForLoadingIcon();
    });

    test.afterAll(async () => {
        globalThis.mockMigration = false;
        await browser.close();
    });

    test("Successful Migration", async () => {

        // Set Migration Plan
        await Misc.dismissNotifications();
        const sourceInfo = await migrationAssistant.getSourceInfo();
        expect(sourceInfo.connectionName).toBe("local connection");
        expect(sourceInfo.server).toMatch(/mysql/);
        expect(sourceInfo.uri).toMatch(/localhost:(\d+)/);
        expect(sourceInfo.replicationInfo).toBe("Replication Possible (gtid_mode=ON)");
        expect(String(sourceInfo.schemas)).toMatch(/(\d+)/);
        expect(sourceInfo.size).toMatch(/(\d+).(\d+)(\d+) MB/);

        await migrationAssistant.migrationPlan.waitUntilStepIs({
            caption: constants.targetSelection,
            isExpanded: true
        }, constants.wait1second * 5);

        await migrationAssistant.migrationPlan.setOciConfigProfile("E2ETESTS");
        await migrationAssistant.migrationPlan.setOciCompartment("——MySQLShellTesting");
        await migrationAssistant.migrationPlan.setOciNetwork("use_existing");
        await migrationAssistant.migrationPlan.setNetworkCompartment("——Networks");
        await migrationAssistant.migrationPlan.setVirtualCloudNetwork("MySQLVCN");
        await migrationAssistant.migrationPlan.setPrivateSubnet("MySQLSubnet");
        await migrationAssistant.migrationPlan.setPublicSubnet("MySQLSubnet");
        await migrationAssistant.migrationPlan
            .setConfigTemplate("Small Development Setup - 2 ECPU, 16GB RAM, 1Gbps NET");

        await migrationAssistant.migrationPlan.setDisplayName("E2E connection test");
        await migrationAssistant.migrationPlan.setAdminUsername("root");
        await migrationAssistant.migrationPlan.setPassword(process.env.DBROOTPASSWORD!);
        await migrationAssistant.migrationPlan.setConfirmPassword(process.env.DBROOTPASSWORD!);
        await migrationAssistant.next();
        await Misc.waitForLoadingIcon();

        await migrationAssistant.migrationPlan.waitUntilStepIs({
            caption: constants.targetSelection,
            isExpanded: false
        }, constants.wait1second * 15);

        await migrationAssistant.migrationPlan.waitUntilStepIs({
            caption: "Migration Type",
            isExpanded: true
        }, constants.wait1second * 15);

        await migrationAssistant.migrationPlan.setMigrationType(constants.MigrationTypeEnum.HotMigration);
        await migrationAssistant.migrationPlan.setNetworkConnectivity(constants.NetworkConnectivityEnum.SshTunnel);
        await migrationAssistant.next();

        const issues = await migrationAssistant.migrationPlan.getCompatibilityIssues();
        expect(issues.length).toBeGreaterThan(0);

        for (const issue of issues) {
            const expectedType = [constants.CompatibilityIssueEnum.Error, constants.CompatibilityIssueEnum.Info];
            const anyText = /^(?!\s*$).+/;
            expect(expectedType).toContain(issue.type);
            expect(issue.name).toMatch(anyText);
            expect(issue.details.description).toMatch(anyText);
            expect(issue.details.defaultResolution).toMatch(anyText);
        }

        await migrationAssistant.migrationPlan
            .changeCompatibilityIssueResolution("Table Missing Primary Key or Equivalent", "EXCLUDE_OBJECT");

        await migrationAssistant.next();
        expect(await migrationAssistant.migrationPlan.isReady()).toBeDefined();
        expect(await migrationAssistant.migrationPlan.existsExplanationMigrationPlan()).toBeDefined();
        expect(await migrationAssistant.isButtonEnabled(constants.MigrationButtonEnum.Next)).toBe(false);
        expect(await migrationAssistant.isButtonEnabled(constants.MigrationButtonEnum.StartMigration))
            .toBe(true);

        // Start Migration
        await migrationAssistant.startMigration();
        await expect.poll(async () => {
            return (await migrationAssistant.getCurrentHeaderStep())!.includes(constants.finalize);
        }, { timeout: wait1second * 30, message: "'Finalize' should be the current header" }).toBe(true);

        // Verify Migration Status
        await Misc.dismissNotifications();
        const tiles = await migrationAssistant.getTiles();
        expect(tiles.length).toBe(5);

        // Verify tiles
        for (const tile of tiles) {
            expect(constants.tiles.has(tile.name!)).toBe(true);
            expect(tile.subSteps!.length).toBeGreaterThan(0);

            for (const step of tile.subSteps!) {
                expect(constants.tiles.get(tile.name!)).toContain(step.name);

                if (step.name === "Database Ready") {
                    expect(step.status).toBe(constants.TileStepStatusEnum.Current);
                } else if (step.name === "Enable High Availability" || step.name === "Check Connectivity") {
                    expect(step.status, `Expected ${step.name}`).toBe(constants.TileStepStatusEnum.NotStarted);
                } else {
                    expect(step.status, `Expected ${step.name}`).toBe(constants.TileStepStatusEnum.Passed);
                }
            }
        }

        // Verify steps (Migration Plan)
        await migrationAssistant.migrationPlan.selectTile();
        const migrationSteps = await migrationAssistant.migrationPlan.getSteps();
        expect(migrationSteps.length).toBeGreaterThan(0);

        for (const step of migrationSteps) {
            expect(constants.migrationPlanSubSteps).toContain(step.caption);
            expect(step.isExpanded).toBe(false);
        }

        // Verify steps (Provisioning)
        await migrationAssistant.provisioning.selectTile();
        const provisioningSteps = await migrationAssistant.provisioning.getSteps();
        expect(provisioningSteps!.length).toBeGreaterThan(0);

        for (const step of provisioningSteps!) {
            if (!step.isExpanded) {
                await step.toggle!.click();
            }

            expect(constants.provisioningSubSteps).toContain(step.caption);
            expect(step.status).toBe(constants.StepStatusEnum.Passed);
            expect(step.description).toContain("Step was successful");
        }

        // Verify steps (Database Migration)
        await migrationAssistant.databaseMigration.selectTile();
        const databaseMigrationSteps = await migrationAssistant.databaseMigration.getSteps();
        expect(databaseMigrationSteps!.length).toBeGreaterThan(0);
        for (const step of databaseMigrationSteps!) {
            if (!step.isExpanded) {
                await step.toggle!.click();
            }
            expect(constants.databaseMigrationSubSteps).toContain(step.caption);
            expect(step.status).toBe(constants.StepStatusEnum.Passed);

            if (step.caption !== "Enable High Availability") {
                expect(step.description).toContain("Step was successful");
            }
        }

        // Verify steps (Database Synchronization)
        await Misc.dismissNotifications();
        await migrationAssistant.dataSynchronization.selectTile();
        const databaseSynchronizationSteps = await migrationAssistant.dataSynchronization.getSteps();
        expect(databaseSynchronizationSteps!.length).toBeGreaterThan(0);
        for (const step of databaseSynchronizationSteps!) {
            if (!step.isExpanded) {
                await step.toggle!.click();
            }
            expect(constants.dataSynchronizationSubSteps).toContain(step.caption);
            expect(step.status).toBe(constants.StepStatusEnum.Passed);
            expect(step.description).toContain("Step was successful");
        }

        // Verify steps (Finalize)
        await migrationAssistant.finalize.selectTile();
        const finalizeSteps = await migrationAssistant.finalize.getSteps();
        expect(finalizeSteps.length).toBeGreaterThan(0);

        for (const step of finalizeSteps) {
            if (interfaces.isIStep(step)) {
                if (!step.isExpanded) {
                    await step.toggle!.click();
                }
                expect(constants.finalizeSubSteps).toContain(step.caption);
                expect(step.status).toBe(constants.StepStatusEnum.Passed);
                expect(step.description).toContain("Step was successful");
            } else if (interfaces.isIDatabaseReady(step)) {
                expect(step.explanation.title).toMatch(/Congratulations/);
                await step.dbSystem.copyButton.click();
                expect(await Misc.existsOnClipboard(/(\d+).(\d+).(\d+).(\d+)/)).toBe(true);
                expect(step.jumpHost.command).toContain("ssh");
                await step.jumpHost.copyButton.click();
                expect(await Misc.existsOnClipboard(/ssh/)).toBe(true);
                expect(step.mysqlShell.command).toMatch(/mysqlsh.*root@(\d+).(\d+).(\d+).(\d+)/);
                await step.mysqlShell.copyButton.click();
                expect(await Misc.existsOnClipboard(/mysqlsh.*root@(\d+).(\d+).(\d+).(\d+)/)).toBe(true);
            } else {
                throw new Error("Unknown object");
            }
        }

        // Delete OCI Resources
        await migrationAssistant.finalize.toggleDeleteJumpHost(true);
        await migrationAssistant.finalize.toggleDeleteBucket(true);
        await migrationAssistant.finalize.deleteSelectedOciResources();
    });

});
