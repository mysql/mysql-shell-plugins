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

import { Locator, expect } from "@playwright/test";
import { page } from "./Misc.js";
import * as locator from "./locators.js";
import * as types from "./types.js";
import * as interfaces from "./interfaces.js";
import * as constants from "./constants.js";
import { Misc } from "./Misc.js";

export class MigrationPlan {

    public selectTile = async (): Promise<void> => {
        await Misc.selectTile(constants.migrationPlan);
    };

    public getSteps = async (): Promise<interfaces.IStep[]> => {
        const sectionsLocator = await page.locator(locator.steps.section.root).all();

        const steps: interfaces.IStep[] = [];
        for (const section of sectionsLocator) {
            const icon = await section.locator(locator.steps.section.toggle).getAttribute("class");

            steps.push({
                caption: await section.locator(locator.steps.section.caption).textContent(),
                isExpanded: icon!.includes("right") ? false : true,
            });
        }

        return steps;
    };

    public waitUntilStepIs = async (step: interfaces.IStep, timeout: number): Promise<void> => {
        await expect.poll(async () => {
            const planSteps = await this.getSteps();
            const targetSelection = planSteps.find((item: interfaces.IStep) => {
                return item.caption === step.caption;
            });

            return targetSelection!.isExpanded === step.isExpanded;
        }, { timeout, message: `Step ${JSON.stringify(step)} was not found` }).toBe(true);
    };

    // Target Selection

    public getOciConfigProfile = async (): Promise<string | null> => {
        return page.locator(locator.steps.targetSelection.ociProfile.box).textContent();
    };

    public setOciConfigProfile = async (value: string): Promise<void> => {
        if (await this.getOciConfigProfile() !== value) {
            const box = page.locator(locator.steps.targetSelection.ociProfile.box);
            await box.click();
            const selectList = page.locator(locator.steps.targetSelection.ociProfile.selectList.exists);
            await selectList.locator(locator.steps.targetSelection.ociProfile.selectList
                .getItem(value)).click();
            await Misc.waitForLoadingIcon();
        }
    };

    public getOciCompartment = async (): Promise<string | null> => {
        return page.locator(locator.steps.targetSelection.ociCompartment.box).textContent();
    };

    public setOciCompartment = async (value: string): Promise<void> => {
        await Misc.waitForLoadingIcon();
        if (await this.getOciCompartment() !== value) {
            await expect.poll(async () => {
                const box = page.locator(locator.steps.targetSelection.ociCompartment.box);
                await box.click();
                const selectList = page.locator(locator.steps.targetSelection.ociCompartment
                    .selectList.exists);

                const options = selectList.locator(locator.steps.targetSelection
                    .ociCompartment.selectList.item);

                for (const option of await options.all()) {
                    if ((await option.textContent()) === value) {

                        await option.click();
                        await Misc.waitForLoadingIcon();

                        return (await this.getOciCompartment()) === value;
                    }
                }

                throw new Error(`Could not find option '${value}'`);
            }, { timeout: constants.wait1second * 20, message: `OCI Compartment should be ${value}` }).toBe(true);
        }
    };

    public getOciNetwork = async (): Promise<string | null> => {
        return page.locator(locator.steps.targetSelection.ociNetwork.box).textContent();
    };

    public setOciNetwork = async (value: string): Promise<void> => {
        if (await this.getOciNetwork() !== value) {
            const box = page.locator(locator.steps.targetSelection.ociNetwork.box);
            await box.click();
            const selectList = page.locator(locator.steps.targetSelection.ociNetwork.selectList.exists);
            await selectList.locator(locator.steps.targetSelection.ociNetwork.selectList
                .getItem(value)).click();
        }
    };

    public getNetworkCompartment = async (): Promise<string | null> => {
        return page.locator(locator.steps.targetSelection.networkCompartment.box).textContent();
    };

    public setNetworkCompartment = async (value: string): Promise<void> => {
        if (await this.getNetworkCompartment() !== value) {
            const box = page.locator(locator.steps.targetSelection.networkCompartment.box);
            await box.click();
            const selectList = page.locator(locator.steps.targetSelection.networkCompartment
                .selectList.exists);

            const options = await selectList.locator(locator.steps.targetSelection
                .networkCompartment.selectList.item).all();

            for (const option of options) {
                if ((await option.textContent()) === value) {
                    await option.click();
                    await Misc.waitForLoadingIcon();

                    return;
                }
            }
        }
    };

    public getVirtualCloudNetwork = async (): Promise<string | null> => {
        return page.locator(locator.steps.targetSelection.vcn.box).textContent();
    };

    public setVirtualCloudNetwork = async (value: string): Promise<void> => {
        const box = page.locator(locator.steps.targetSelection.vcn.box);
        await box.click();
        const selectList = page.locator(locator.steps.targetSelection.vcn.selectList.exists);

        const options = await selectList.locator(locator.steps.targetSelection
            .vcn.selectList.item).all();

        for (const option of options) {
            if ((await option.textContent()) === value) {
                await option.click();
                await Misc.waitForLoadingIcon();

                return;
            }
        }
    };

    public getPrivateSubnet = async (): Promise<string | null> => {
        return page.locator(locator.steps.targetSelection.privateSubnet.box).textContent();
    };

    public setPrivateSubnet = async (value: string): Promise<void> => {
        const box = page.locator(locator.steps.targetSelection.privateSubnet.box);
        await box.click();
        const selectList = page.locator(locator.steps.targetSelection.privateSubnet.selectList.exists);

        const options = await selectList.locator(locator.steps.targetSelection
            .privateSubnet.selectList.item).all();

        for (const option of options) {
            if ((await option.textContent()) === value) {
                await option.click();

                return;
            }
        }
    };

    public getPublicSubnet = async (): Promise<string | null> => {
        return page.locator(locator.steps.targetSelection.publicSubnet.box).textContent();
    };

    public setPublicSubnet = async (value: string): Promise<void> => {
        const box = page.locator(locator.steps.targetSelection.publicSubnet.box);
        await box.click();
        const selectList = page.locator(locator.steps.targetSelection.publicSubnet.selectList.exists);

        const options = await selectList.locator(locator.steps.targetSelection
            .publicSubnet.selectList.item).all();

        for (const option of options) {
            if ((await option.textContent()) === value) {
                await option.click();

                return;
            }
        }
    };

    public getConfigTemplate = async (): Promise<string | null> => {
        return page.locator(locator.steps.targetSelection.configTemplate.box).textContent();
    };

    public setConfigTemplate = async (value: string): Promise<void> => {
        const box = page.locator(locator.steps.targetSelection.configTemplate.box);
        await box.click();
        const selectList = page.locator(locator.steps.targetSelection.configTemplate.selectList.exists);

        const options = await selectList.locator(locator.steps.targetSelection
            .configTemplate.selectList.item).all();

        for (const option of options) {
            if ((await option.textContent()) === value) {
                await option.click();

                return;
            }
        }
    };

    public setDiskSize = async (value: string): Promise<void> => {
        await page.locator(locator.steps.targetSelection.diskSize).fill(value);
    };

    public getSetupType = async (): Promise<string | null> => {
        return page.locator(locator.steps.targetSelection.setupType.box).textContent();
    };

    public setSetupType = async (value: string): Promise<void> => {
        const box = page.locator(locator.steps.targetSelection.setupType.box);
        await box.click();
        const selectList = page.locator(locator.steps.targetSelection.setupType.selectList.exists);

        const options = await selectList.locator(locator.steps.targetSelection
            .setupType.selectList.item).all();

        for (const option of options) {
            if ((await option.textContent()) === value) {
                await option.click();

                return;
            }
        }
    };

    public getHeatWaveShape = async (): Promise<string | null> => {
        return page.locator(locator.steps.targetSelection.heatWaveShape.box).textContent();
    };

    public setHeatWaveShape = async (value: string): Promise<void> => {
        const box = page.locator(locator.steps.targetSelection.heatWaveShape.box);
        await box.click();
        const selectList = page.locator(locator.steps.targetSelection.heatWaveShape.selectList.exists);
        await selectList.locator(locator.steps.targetSelection.heatWaveShape.selectList
            .getItem(value)).click();
    };

    public setHeatWaveNodes = async (value: string): Promise<void> => {
        await page.locator(locator.steps.targetSelection.heatWaveNodes).fill(value);
    };

    public setDisplayName = async (value: string): Promise<void> => {
        await page.locator(locator.steps.targetSelection.displayName).fill(value);
    };

    public setContactEmails = async (value: string): Promise<void> => {
        await page.locator(locator.steps.targetSelection.contactEmails).fill(value);
    };

    public setAdminUsername = async (value: string): Promise<void> => {
        await page.locator(locator.steps.targetSelection.adminUsername).fill(value);
    };

    public setPassword = async (value: string): Promise<void> => {
        const password = page.locator(locator.steps.targetSelection.password);
        await password.fill(value);
    };

    public setConfirmPassword = async (value: string): Promise<void> => {
        await page.locator(locator.steps.targetSelection.confirmPassword).fill(value);
    };

    // Migration Type

    public setMigrationType = async (migrationType: types.MigrationType): Promise<void> => {
        const types = await page.locator(locator.steps.migrationType.type).all();

        for (const type of types) {
            if ((await type.textContent()) === migrationType) {
                await type.click();

                return;
            }
        }
    };

    public setNetworkConnectivity = async (value: types.NetworkConnectivity): Promise<void> => {
        const box = page.locator(locator.steps.migrationType.networkConnectivity.box);
        await box.click();
        const selectList = page.locator(locator.steps.migrationType.networkConnectivity.selectList.exists);
        await selectList.locator(locator.steps.migrationType.networkConnectivity.selectList
            .getItem(value)).click();
        await Misc.waitForLoadingIcon();
    };

    // Schema Compatibility Checks

    public getCompatibilityIssues = async (): Promise<interfaces.ICompatibilityIssue[]> => {
        const issuesLocator = await page.locator(locator.steps.schemaCompatibilityChecks.issue.exists)
            .all();

        const issues: interfaces.ICompatibilityIssue[] = [];

        for (const issue of issuesLocator) {
            const title = issue.locator(locator.steps.schemaCompatibilityChecks.issue.title);
            const type = title.locator(locator.steps.schemaCompatibilityChecks.issue.icon);

            const showDetails = issue.locator(locator.steps.schemaCompatibilityChecks.issue.showDetails);
            await showDetails.click();

            const changeResolution = issue.locator(locator.steps.schemaCompatibilityChecks
                .issue.resolution.box);
            let resolutionLocator: Locator;

            if (await changeResolution.count() > 0) {
                resolutionLocator = issue.locator(locator.steps.schemaCompatibilityChecks
                    .issue.resolution.boxValue);
            } else {
                resolutionLocator = issue.locator(locator.steps.schemaCompatibilityChecks
                    .issue.resolution.issueResolution);
            }

            issues.push({
                name: await title.textContent(),
                type: (await type.getAttribute("class"))?.includes("info") ? constants.CompatibilityIssueEnum.Info
                    : constants.CompatibilityIssueEnum.Error,
                details: {
                    description: await issue.locator(locator.steps.schemaCompatibilityChecks
                        .issue.description).textContent(),
                    defaultResolution: await resolutionLocator.textContent(),
                }
            });
        }

        return issues;
    };

    public changeCompatibilityIssueResolution = async (issueName: string, resolution: string): Promise<void> => {
        const issuesLocator = await page.locator(locator.steps.schemaCompatibilityChecks.issue.exists)
            .all();

        for (const issue of issuesLocator) {
            const title = issue.locator(locator.steps.schemaCompatibilityChecks.issue.title);

            if ((await title.textContent())!.includes(issueName)) {
                const box = issue.locator(locator.steps.schemaCompatibilityChecks.issue.resolution.box);
                await box.click();

                const selectList = page.locator(locator.steps.schemaCompatibilityChecks.issue.resolution
                    .selectList.exists);
                await selectList.locator(locator.steps.schemaCompatibilityChecks.issue.resolution.selectList
                    .getItem(resolution)).click();

                return;
            }
        }

        throw new Error(`Could not find Compatibility Issue '${issueName}'`);
    };

    // Preview Migration Plan

    public isReady = async (): Promise<boolean> => {
        const isReadyLocator = page.locator(locator.steps.previewMigrationPlan.readyNotice);

        return (await isReadyLocator.count()) > 0;
    };

    public existsExplanationMigrationPlan = async (): Promise<boolean> => {
        const explanationLocator = page.locator(locator.steps.previewMigrationPlan.explanation);

        return (await explanationLocator.count()) > 0;
    };

}