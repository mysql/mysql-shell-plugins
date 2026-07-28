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

import { expect, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export enum MigrationMockStatus {
    Aborted = "aborted",
    Failed = "failed",
    Running = "running",
    Success = "success",
}

export enum MigrationButton {
    Next = "Next",
    StartMigration = "Start Migration Process",
}

export enum StepStatus {
    Aborted = "Aborted",
    Failed = "Failed",
    NotStarted = "Not Started",
    Passed = "Passed",
    Running = "Running",
}

export enum TileStepStatus {
    Current = " ▸ ",
    Failed = " ❗ ",
    NotStarted = " – ",
    Passed = " ✓ ",
    Running = "loading",
}

export const targetSelection = "Target Selection";
export const migrationType = "Migration Type";
export const objectSelection = "Object Selection";
export const schemaCompatibilityChecks = "Schema Compatibility Checks";
export const previewMigrationPlan = "Preview Migration Plan";
export const provisioning = "Provisioning";
export const databaseMigration = "Database Migration";
export const dataSynchronization = "Data Synchronization";
export const finalize = "Finalize";

export const migrationPlanSubSteps = [
    targetSelection,
    migrationType,
    objectSelection,
    schemaCompatibilityChecks,
    previewMigrationPlan,
];
export const provisioningSubSteps = [
    "Compartment",
    "Object Storage",
    "Virtual Cloud Network",
    "Compute",
    "Prepare Jump Host",
    "MySQL DB System",
    "HeatWave Cluster",
];
export const databaseMigrationSubSteps = [
    "Export",
    "Connect to DB System",
    "Import",
    "Enable Crash Recovery",
    "Enable High Availability",
];
export const dataSynchronizationSubSteps = [
    "Setup SSH Tunnel",
    "Check Connectivity",
    "Start Replication",
];
export const finalizeSubSteps = [
    "Monitor Replication Progress",
    "Database Ready",
];
export const tiles = new Map([
    ["Migration Plan", migrationPlanSubSteps],
    [provisioning, provisioningSubSteps],
    [databaseMigration, databaseMigrationSubSteps],
    [dataSynchronization, dataSynchronizationSubSteps],
    [finalize, finalizeSubSteps],
]);

export interface ISourceInfo {
    connectionName: string;
    replicationInfo: string;
    schemas: number;
    server: string;
    size: string;
    uri: string;
}

export interface IStep {
    caption: string | null;
    description?: string;
    isExpanded: boolean;
    status?: StepStatus;
    toggle?: Locator;
}

export interface ITile {
    name: string | null;
    subSteps: Array<{
        name: string | null;
        status: TileStepStatus;
    }>;
}

export interface ICompatibilityIssue {
    details: {
        defaultResolution: string | null;
        description: string | null;
    };
    name: string | null;
    type: "error" | "info";
}

const wait1second = 1000;
const waitForResourceOptionsTimeout = wait1second * 60;
const mocksPath = resolve(__dirname, "../../../../frontend/src/tests/e2e/migration_assistant/mocks");

type BackendMockResponse = Record<string, unknown>;

interface IPluginCommandMockEntry {
    result?: unknown;
    responses?: BackendMockResponse[];
    done?: boolean;
}

type PluginCommandMockRule = IPluginCommandMockEntry | {
    sequence: IPluginCommandMockEntry[];
    repeatLast?: boolean;
};

type PluginCommandMockRules = Record<string, PluginCommandMockRule>;

const locator = {
    notification: {
        exists: ".notificationCenter [id*='toast-']",
        close: ".closeButton",
    },
    mainPage: {
        sourceInfoItem: ".source-info > div",
        next: `div[caption="Next"]`,
        startMigration: `div[caption="Start Migration Process"]`,
        abortMigration: `div[caption="Abort"]`,
        loadingIcon: "#backend-request-overlay .progressIndicatorHost, .target-selection .progressIndicatorHost",
        currentHeader: "#steps .header",
        tile: {
            root: ".tile",
            name: "h4",
            subStepName: ".sub-steps .sub-step",
            subStepStatus: "span, svg",
        },
    },
    steps: {
        root: "#steps .section",
        toggle: ".sub-header > .icon",
        caption: ".caption",
        status: ".caption .icon",
        description: ".content p",
        targetSelection: {
            signUp: `[caption="Sign Up to OCI"]`,
            signIn: `[caption="OCI Sign In"]`,
            copySignInLink: ".oci-sign-in span",
            ociProfile: {
                box: "#profile",
                popup: "#profilePopup",
            },
            ociCompartment: {
                box: ".hosting\\.compartmentId [role='combobox']",
                popup: ".tds-list[role='listbox']",
            },
            ociNetwork: {
                box: "#oci-networking",
                popup: "#oci-networkingPopup",
            },
            networkCompartment: {
                box: ".hosting\\.networkCompartmentId [role='combobox']",
                popup: ".tds-list[role='listbox']",
            },
            vcn: {
                box: "#hosting\\.vcnId",
                popup: "#hosting\\.vcnIdPopup",
            },
            privateSubnet: {
                box: "#hosting\\.privateSubnet\\.id",
                popup: "#hosting\\.privateSubnet\\.idPopup",
            },
            publicSubnet: {
                box: "#hosting\\.publicSubnet\\.id",
                popup: "#hosting\\.publicSubnet\\.idPopup",
            },
            configTemplate: {
                box: "#hosting\\.configTemplate",
                popup: "#hosting\\.configTemplatePopup",
            },
            displayName: "#database\\.name",
            adminUsername: "#database\\.adminUsername",
            password: "#database\\.adminPassword",
            confirmPassword: "#database\\.adminPasswordConfirm",
            onPremisePublicCidrBlock: "#hosting\\.onPremisePublicCidrBlock",
            onPremisePublicCidrBlockErrors: ".ssh-ingress-source .input-errors",
        },
        migrationType: {
            type: ".migration-type-radios .radioButton",
            connectivity: "#connectivity",
            connectivityPopup: "#connectivityPopup",
        },
        schemaCompatibilityChecks: {
            doneWithIssues: "[data-testid='migration-checks-done-with-issues']",
            issue: "[data-testid='migration-compatibility-issue']",
            state: ".migration-checks-state",
            title: ".title",
            icon: ".icon",
            showDetails: `[data-tooltip="Show details"]`,
            description: ".description",
            resolutionBox: ".choice",
            resolutionBoxValue: ".choice > label",
            issueResolution: ".issue-resolution",
            resolutionPopup: ".popupPortal",
        },
        previewMigrationPlan: {
            readyNotice: ".ready-notice",
            explanation: ".explanation",
        },
        databaseReady: {
            explanationTitle: ".explanation > h3",
            code: ".finalize-info > code",
            copyButton: ".finalize-info .button",
        },
    },
};

const readMigrationMockResponse = (fileName: string): BackendMockResponse => {
    return JSON.parse(readFileSync(resolve(mocksPath, fileName), "utf8")) as BackendMockResponse;
};

const mockResponse = (fileName: string): IPluginCommandMockEntry => {
    return {
        responses: [readMigrationMockResponse(fileName)],
    };
};

const sendPluginCommandMocks = async (page: Page, rules: PluginCommandMockRules): Promise<void> => {
    await page.evaluate((mockRules) => {
        return new Promise<void>((resolvePromise, rejectPromise) => {
            const backend = window.electronDesktopBackend;
            if (!backend) {
                rejectPromise(new Error("Electron desktop backend is not available."));

                return;
            }

            const requestId = crypto.randomUUID();
            let unsubscribe = (): void => {};
            const timeout = window.setTimeout(() => {
                unsubscribe();
                rejectPromise(new Error("Timed out setting plugin command mocks."));
            }, 15000);

            unsubscribe = backend.onMessage((payload) => {
                let response: {
                    request_id?: string;
                    request_state?: {
                        type?: string;
                        msg?: string;
                    };
                };

                try {
                    response = JSON.parse(payload) as {
                        request_id?: string;
                        request_state?: {
                            type?: string;
                            msg?: string;
                        };
                    };
                } catch {
                    return;
                }

                if (response.request_id !== requestId) {
                    return;
                }

                if (response.request_state?.type === "ERROR") {
                    window.clearTimeout(timeout);
                    unsubscribe();
                    rejectPromise(new Error(response.request_state.msg ?? "Plugin command mock setup failed."));

                    return;
                }

                if (response.request_state?.type === "OK") {
                    window.clearTimeout(timeout);
                    unsubscribe();
                    resolvePromise();
                }
            });

            backend.send(JSON.stringify({
                request: "execute",
                command: "gui.core.set_plugin_command_mocks",
                request_id: requestId,
                args: {
                    rules: mockRules,
                },
            }));
        });
    }, rules);
};

export const setMigrationMockStatus = async (page: Page, status: MigrationMockStatus): Promise<void> => {
    const statusResponses = {
        [MigrationMockStatus.Aborted]: mockResponse("response_work_status_abort.json"),
        [MigrationMockStatus.Failed]: mockResponse("response_work_status_error.json"),
        [MigrationMockStatus.Running]: mockResponse("response_work_status_in_progress.json"),
        [MigrationMockStatus.Success]: mockResponse("response_work_status_ok.json"),
    };
    const inProgressResponse = mockResponse("response_work_status_in_progress.json");
    const rules: PluginCommandMockRules = {
        "gui.migration.work_start": status === MigrationMockStatus.Aborted
            ? inProgressResponse
            : statusResponses[status],
        "gui.migration.work_status": statusResponses[status],
    };

    if (status === MigrationMockStatus.Aborted) {
        rules["gui.migration.work_abort"] = statusResponses[MigrationMockStatus.Aborted];
    }

    await sendPluginCommandMocks(page, rules);
};

export class MigrationAssistant {
    public constructor(private readonly page: Page) {
    }

    public async dismissNotifications(): Promise<void> {
        const notifications = await this.page.locator(locator.notification.exists).all();
        for (const notification of notifications) {
            await notification.locator(locator.notification.close).click().catch(() => {
                // Notification may already have disappeared.
            });
        }
    }

    public async waitForLoadingIcon(timeout = wait1second * 60): Promise<void> {
        const loadingIcons = this.page.locator(locator.mainPage.loadingIcon);
        await loadingIcons.first().waitFor({ state: "visible", timeout: wait1second }).catch(() => {
            // The request may complete before the loading overlay becomes visible.
        });

        for (const loadingIcon of await loadingIcons.all()) {
            await loadingIcon.waitFor({ state: "detached", timeout });
        }
    }

    public async next(): Promise<void> {
        await this.page.locator(locator.mainPage.next).click();
    }

    public async fillUseExistingTargetSelectionAndAdvance(): Promise<boolean> {
        if (!await this.fillCommonTargetOptions()) {
            return false;
        }

        await this.closeOpenPopup();
        await this.waitForLoadingIcon();
        await this.fillUseExistingTargetDatabaseFields();
        await this.expectTargetDatabaseFields();
        await this.advanceFromTargetSelectionToMigrationType();

        return true;
    }

    public async startMigration(): Promise<void> {
        await this.page.locator(locator.mainPage.startMigration).click();
        await this.waitForLoadingIcon();
    }

    public async abortMigration(): Promise<void> {
        await this.page.locator(locator.mainPage.abortMigration).click();
        await this.waitForLoadingIcon();
    }

    public async getSourceInfo(): Promise<ISourceInfo> {
        const items = await this.page.locator(locator.mainPage.sourceInfoItem).allTextContents();

        return {
            connectionName: items[0],
            server: items[1],
            schemas: parseInt(items[2].match(/Schemas: (\d+)/)?.[1] ?? "0", 10),
            uri: items[3],
            replicationInfo: items[4],
            size: items[5],
        };
    }

    public async waitUntilStepIs(step: { caption: string; isExpanded: boolean; }, timeout: number): Promise<void> {
        await expect.poll(async () => {
            const steps = await this.getPlanSteps();
            const target = steps.find((item) => {
                return this.captionMatches(item.caption, step.caption);
            });
            if (!target) {
                const header = await this.getCurrentHeaderStep();
                if (this.captionMatches(header, step.caption)) {
                    return step.isExpanded;
                }

                if (!step.isExpanded) {
                    return false;
                }
            }

            return target?.isExpanded;
        }, { timeout, message: `Step ${JSON.stringify(step)} was not found` }).toBe(step.isExpanded);
    }

    public async getPlanSteps(): Promise<IStep[]> {
        const sections = await this.page.locator(locator.steps.root).all();
        const steps: IStep[] = [];

        for (const section of sections) {
            const icon = await section.locator(locator.steps.toggle).getAttribute("class");
            steps.push({
                caption: await section.locator(locator.steps.caption).textContent(),
                isExpanded: icon?.includes("right") ? false : true,
            });
        }

        return steps;
    }

    public async getCurrentHeaderStep(): Promise<string | null> {
        return this.page.locator(locator.mainPage.currentHeader).textContent();
    }

    public async isButtonEnabled(button: MigrationButton): Promise<boolean> {
        const buttonLocator = this.page.locator(button === MigrationButton.Next
            ? locator.mainPage.next
            : locator.mainPage.startMigration);

        return !(await buttonLocator.getAttribute("class"))?.includes("disabled");
    }

    public async fillCommonTargetOptions(): Promise<boolean> {
        await this.dismissNotifications();
        if (!await this.waitForOptionalVisible(this.page.locator(locator.steps.targetSelection.ociProfile.box),
            wait1second * 30)) {
            return false;
        }
        await this.setOciConfigProfile(process.env.MYSQLSH_OCI_CONFIG_PROFILE ?? "DEFAULT");
        if (!await this.trySetTreeDropdown(locator.steps.targetSelection.ociCompartment.box,
            locator.steps.targetSelection.ociCompartment.popup, "——MySQLShellTesting")) {
            return false;
        }
        await this.setDropdown(locator.steps.targetSelection.ociNetwork.box,
            locator.steps.targetSelection.ociNetwork.popup, "use_existing");
        if (!await this.trySetTreeDropdown(locator.steps.targetSelection.networkCompartment.box,
            locator.steps.targetSelection.networkCompartment.popup, "——Networks")) {
            return false;
        }
        await this.setLabelDropdown(locator.steps.targetSelection.vcn.box,
            locator.steps.targetSelection.vcn.popup, "MySQLVCN");
        await this.setLabelDropdown(locator.steps.targetSelection.privateSubnet.box,
            locator.steps.targetSelection.privateSubnet.popup, "MySQLSubnet");
        await this.setAnyLabelDropdown(locator.steps.targetSelection.publicSubnet.box,
            locator.steps.targetSelection.publicSubnet.popup, ["MySQLPublicSubnet", "MySQLSubnet"]);
        await this.setLabelDropdown(locator.steps.targetSelection.configTemplate.box,
            locator.steps.targetSelection.configTemplate.popup, "Small Development Setup - 2 ECPU, 16GB RAM, 1Gbps NET");

        return true;
    }

    private async fillUseExistingTargetDatabaseFields(): Promise<void> {
        await this.page.locator(locator.steps.targetSelection.displayName).fill("E2E connection test");
        await this.page.locator(locator.steps.targetSelection.adminUsername).fill("root");
        await this.page.locator(locator.steps.targetSelection.password).fill(process.env.DB_ROOT_PASSWORD ?? "");
        await this.page.locator(locator.steps.targetSelection.confirmPassword).fill(process.env.DB_ROOT_PASSWORD ?? "");
    }

    private async advanceFromTargetSelectionToMigrationType(): Promise<void> {
        const next = this.page.locator(locator.mainPage.next);
        await expect(next).toBeVisible({ timeout: wait1second * 15 });
        await expect.poll(async () => {
            return await this.isButtonEnabled(MigrationButton.Next);
        }, { timeout: wait1second * 15, message: "Next button should be enabled on Target Selection" }).toBe(true);

        await next.click({ force: true });
        const firstClickResult = await this.waitForTargetSelectionAdvanceActivity(wait1second * 3);
        if (firstClickResult === "none") {
            await next.click({ force: true });
        }

        try {
            await this.waitUntilStepIs({ caption: migrationType, isExpanded: true }, wait1second * 90);
        } catch (error) {
            throw new Error(`Target Selection did not advance to Migration Type. ` +
                `State: ${JSON.stringify(await this.getTargetSelectionDebugState())}`, { cause: error });
        }

        await this.waitForLoadingIcon();
    }

    public async setCreateNewNetworkTargetOptions(): Promise<boolean> {
        await this.dismissNotifications();
        if (!await this.waitForOptionalVisible(this.page.locator(locator.steps.targetSelection.ociProfile.box),
            wait1second * 30)) {
            return false;
        }
        await this.setOciConfigProfile(process.env.MYSQLSH_OCI_CONFIG_PROFILE ?? "DEFAULT");
        if (!await this.trySetTreeDropdown(locator.steps.targetSelection.ociCompartment.box,
            locator.steps.targetSelection.ociCompartment.popup, "——MySQLShellTesting")) {
            return false;
        }
        if (!await this.setDropdown(locator.steps.targetSelection.ociNetwork.box,
            locator.steps.targetSelection.ociNetwork.popup, "create_new", false)) {
            return false;
        }
        await this.setLabelDropdown(locator.steps.targetSelection.configTemplate.box,
            locator.steps.targetSelection.configTemplate.popup, "Small Development Setup - 2 ECPU, 16GB RAM, 1Gbps NET");
        await this.page.locator(locator.steps.targetSelection.displayName).fill("E2E CIDR validation test");
        await this.page.locator(locator.steps.targetSelection.adminUsername).fill("root");
        await this.page.locator(locator.steps.targetSelection.password).fill(process.env.DB_ROOT_PASSWORD ?? "");
        await this.page.locator(locator.steps.targetSelection.confirmPassword).fill(process.env.DB_ROOT_PASSWORD ?? "");

        return true;
    }

    private async expectTargetDatabaseFields(): Promise<void> {
        await expect(this.page.locator(locator.steps.targetSelection.displayName)).toHaveValue("E2E connection test");
        await expect(this.page.locator(locator.steps.targetSelection.adminUsername)).toHaveValue("root");
        await expect(this.page.locator(locator.steps.targetSelection.password))
            .toHaveValue(process.env.DB_ROOT_PASSWORD ?? "");
        await expect(this.page.locator(locator.steps.targetSelection.confirmPassword))
            .toHaveValue(process.env.DB_ROOT_PASSWORD ?? "");
    }

    private async waitForTargetSelectionAdvanceActivity(timeout: number): Promise<"activity" | "advanced" | "none"> {
        const result = await Promise.race([
            this.waitUntilStepIs({ caption: migrationType, isExpanded: true }, timeout).then(() => {
                return "advanced" as const;
            }).catch(() => {
                return "none" as const;
            }),
            this.page.locator(locator.mainPage.loadingIcon).first().waitFor({
                state: "visible",
                timeout,
            }).then(() => {
                return "activity" as const;
            }).catch(() => {
                return "none" as const;
            }),
        ]);

        if (result === "activity") {
            await this.waitForLoadingIcon();
        }

        return result;
    }

    private async closeOpenPopup(): Promise<void> {
        await this.page.keyboard.press("Escape");
        await this.page.locator(".migration-sub-app").click({ position: { x: 5, y: 5 }, force: true });
    }

    private async getTargetSelectionDebugState(): Promise<Record<string, unknown>> {
        return {
            currentHeader: await this.getCurrentHeaderStep(),
            nextButtonClass: await this.page.locator(locator.mainPage.next).getAttribute("class"),
            profile: await this.page.locator(locator.steps.targetSelection.ociProfile.box).textContent().catch(() => null),
            ociCompartment: await this.page.locator(locator.steps.targetSelection.ociCompartment.box)
                .textContent().catch(() => null),
            networkMode: await this.page.locator(locator.steps.targetSelection.ociNetwork.box).textContent()
                .catch(() => null),
            networkCompartment: await this.page.locator(locator.steps.targetSelection.networkCompartment.box)
                .textContent().catch(() => null),
            vcn: await this.page.locator(locator.steps.targetSelection.vcn.box).textContent().catch(() => null),
            privateSubnet: await this.page.locator(locator.steps.targetSelection.privateSubnet.box)
                .textContent().catch(() => null),
            publicSubnet: await this.page.locator(locator.steps.targetSelection.publicSubnet.box)
                .textContent().catch(() => null),
            configTemplate: await this.page.locator(locator.steps.targetSelection.configTemplate.box)
                .textContent().catch(() => null),
            errors: await this.page.locator(".input-error, .input-errors, .errors .error").allTextContents(),
            notifications: await this.page.locator(locator.notification.exists).allTextContents(),
        };
    }

    public async setOnPremisePublicCidrBlock(value: string): Promise<void> {
        await this.page.locator(locator.steps.targetSelection.onPremisePublicCidrBlock).fill(value);
    }

    public onPremisePublicCidrBlockErrors(): Locator {
        return this.page.locator(locator.steps.targetSelection.onPremisePublicCidrBlockErrors);
    }

    public async setMigrationType(): Promise<void> {
        const radios = await this.page.locator(locator.steps.migrationType.type).all();
        for (const radio of radios) {
            if ((await radio.textContent()) === "Hot Migration") {
                await radio.click();

                return;
            }
        }
    }

    public async setMigrationTypeIfVisible(): Promise<void> {
        if (await this.page.locator(locator.steps.migrationType.type).first().count() === 0) {
            return;
        }

        await this.setMigrationType();
    }

    public async setNetworkConnectivity(): Promise<void> {
        await this.page.locator(locator.steps.migrationType.connectivity).click();
        await this.page.locator(locator.steps.migrationType.connectivityPopup).locator("#ssh-tunnel").click();
        await this.waitForLoadingIcon();
    }

    public async setNetworkConnectivityIfVisible(): Promise<void> {
        if (await this.page.locator(locator.steps.migrationType.connectivity).count() === 0) {
            return;
        }

        await this.setNetworkConnectivity();
    }

    public async advanceToCompatibilityChecks(): Promise<void> {
        await this.next();
        await this.waitUntilStepIs({ caption: objectSelection, isExpanded: true }, wait1second * 90);
        await this.fillObjectSelectionDefaults();
    }

    public async fillObjectSelectionDefaults(): Promise<void> {
        await this.waitUntilStepIs({ caption: objectSelection, isExpanded: true }, wait1second * 90);
        await this.next();
        await this.waitUntilStepIs({ caption: objectSelection, isExpanded: false }, wait1second * 90);
        await this.waitUntilStepIs({ caption: schemaCompatibilityChecks, isExpanded: true }, wait1second * 90);
    }

    public async fillObjectSelectionDefaultsIfVisible(): Promise<void> {
        const steps = await this.getPlanSteps();
        const objectSelectionStep = steps.find((step) => {
            return step.caption === objectSelection;
        });

        if (!objectSelectionStep?.isExpanded) {
            return;
        }

        await this.fillObjectSelectionDefaults();
    }

    public async getCompatibilityIssues(): Promise<ICompatibilityIssue[]> {
        await this.waitForCompatibilityChecksDoneWithIssues();
        const issueList = this.page.locator(locator.steps.schemaCompatibilityChecks.issue);
        await expect(issueList.first()).toBeAttached({ timeout: wait1second * 30 });
        const issueLocators = await issueList.all();
        const issues: ICompatibilityIssue[] = [];

        for (const issue of issueLocators) {
            const title = issue.locator(locator.steps.schemaCompatibilityChecks.title);
            const type = title.locator(locator.steps.schemaCompatibilityChecks.icon);
            const showDetails = issue.locator(locator.steps.schemaCompatibilityChecks.showDetails);
            await showDetails.click();

            const changeResolution = issue.locator(locator.steps.schemaCompatibilityChecks.resolutionBox);
            const resolutionLocator = await changeResolution.count() > 0
                ? issue.locator(locator.steps.schemaCompatibilityChecks.resolutionBoxValue)
                : issue.locator(locator.steps.schemaCompatibilityChecks.issueResolution);

            issues.push({
                name: await title.textContent(),
                type: (await type.getAttribute("class"))?.includes("info") ? "info" : "error",
                details: {
                    description: await issue.locator(locator.steps.schemaCompatibilityChecks.description).textContent(),
                    defaultResolution: await resolutionLocator.textContent(),
                },
            });
        }

        return issues;
    }

    public async changeCompatibilityIssueResolution(issueName: string, resolution: string): Promise<void> {
        await this.waitForCompatibilityChecksDoneWithIssues();
        const issueList = this.page.locator(locator.steps.schemaCompatibilityChecks.issue);
        const issue = issueList.filter({
            has: this.page.locator(locator.steps.schemaCompatibilityChecks.title, { hasText: issueName }),
        }).first();

        try {
            await expect(issue).toBeVisible({ timeout: wait1second * 30 });
        } catch (error) {
            const titles = await issueList.locator(locator.steps.schemaCompatibilityChecks.title).allTextContents();

            throw new Error(`Could not find compatibility issue '${issueName}'. ` +
                `Rendered issues: ${titles.join(", ")}`, { cause: error });
        }

        const showDetails = issue.locator(locator.steps.schemaCompatibilityChecks.showDetails);
        if (await showDetails.count() > 0) {
            await showDetails.click();
        }

        await issue.locator(locator.steps.schemaCompatibilityChecks.resolutionBox).click();
        await this.page.locator(locator.steps.schemaCompatibilityChecks.resolutionPopup).locator(`#${resolution}`).click();
    }

    public async migrationPlanIsReady(): Promise<boolean> {
        return await this.page.locator(locator.steps.previewMigrationPlan.readyNotice).count() > 0;
    }

    public async existsExplanationMigrationPlan(): Promise<boolean> {
        return await this.page.locator(locator.steps.previewMigrationPlan.explanation).count() > 0;
    }

    public async waitForMigrationPlanReady(): Promise<void> {
        await expect(this.page.locator(locator.steps.previewMigrationPlan.readyNotice)).toBeVisible({
            timeout: wait1second * 30,
        });
        await expect(this.page.locator(locator.steps.previewMigrationPlan.explanation)).toBeVisible({
            timeout: wait1second * 30,
        });
    }

    public async getTiles(): Promise<ITile[]> {
        const tileLocators = await this.page.locator(locator.mainPage.tile.root).all();
        const result: ITile[] = [];

        for (const tile of tileLocators) {
            const subStepLocators = await tile.locator(locator.mainPage.tile.subStepName).all();
            const subSteps = [];

            for (const subStep of subStepLocators) {
                const statusLocator = subStep.locator(locator.mainPage.tile.subStepStatus);
                const statusText = await statusLocator.textContent();
                let status: TileStepStatus;
                if (statusText === TileStepStatus.Passed) {
                    status = TileStepStatus.Passed;
                } else if (statusText === TileStepStatus.NotStarted || statusText === " ‧ ") {
                    status = TileStepStatus.NotStarted;
                } else if (statusText === TileStepStatus.Failed) {
                    status = TileStepStatus.Failed;
                } else if (statusText === TileStepStatus.Current) {
                    status = TileStepStatus.Current;
                } else {
                    status = TileStepStatus.Running;
                }

                const name = await subStep.textContent();
                subSteps.push({
                    name: name?.startsWith(" ") ? name.substring(3) : name,
                    status,
                });
            }

            result.push({
                name: await tile.locator(locator.mainPage.tile.name).textContent(),
                subSteps,
            });
        }

        return result;
    }

    public async selectTile(tileName: string): Promise<void> {
        const tileLocators = await this.page.locator(locator.mainPage.tile.root).all();
        for (const tile of tileLocators) {
            if (await tile.locator(locator.mainPage.tile.name).textContent() === tileName) {
                await expect.poll(async () => {
                    await tile.click();

                    return (await this.getCurrentHeaderStep())?.includes(tileName) ?? false;
                }, { timeout: wait1second * 5, message: `Tile ${tileName} was not selected` }).toBe(true);

                return;
            }
        }

        throw new Error(`Tile ${tileName} was not found`);
    }

    public async getSteps(): Promise<IStep[]> {
        await this.page.locator(locator.steps.root).first().waitFor({ state: "attached" });
        const sections = await this.page.locator(locator.steps.root).all();
        const steps: IStep[] = [];

        for (const section of sections) {
            const statusLocator = section.locator(locator.steps.status);
            if (await statusLocator.count() === 0) {
                continue;
            }

            const toggleIcon = section.locator(locator.steps.toggle);
            const statusClass = await statusLocator.getAttribute("class") ?? "";
            const comments = await section.locator(locator.steps.description).allTextContents();
            steps.push({
                toggle: section.locator(locator.steps.toggle),
                isExpanded: (await toggleIcon.getAttribute("class"))?.includes("codicon-chevron-down") ?? false,
                caption: await section.locator(locator.steps.caption).textContent(),
                status: this.parseStepStatus(statusClass),
                description: comments.join(". "),
            });
        }

        return steps;
    }

    public async getFinalizeSteps(): Promise<IStep[]> {
        return this.getSteps();
    }

    public async databaseReadyTitle(): Promise<string | null> {
        return this.page.locator(locator.steps.databaseReady.explanationTitle).textContent();
    }

    public async databaseReadyCodeBlocks(): Promise<string[]> {
        return this.page.locator(locator.steps.databaseReady.code).allTextContents();
    }

    public async copyDatabaseReadyCode(index: number): Promise<void> {
        const buttons = await this.page.locator(locator.steps.databaseReady.copyButton).all();
        await buttons[index].click();
    }

    public async clipboardMatches(pattern: RegExp): Promise<boolean> {
        const clipboardContent = await this.page.evaluate(async () => {
            return navigator.clipboard.readText();
        });

        return pattern.test(clipboardContent);
    }

    private async setOciConfigProfile(value: string): Promise<void> {
        const box = this.page.locator(locator.steps.targetSelection.ociProfile.box);
        if (await box.textContent() === value) {
            return;
        }

        await box.click();
        await this.page.locator(locator.steps.targetSelection.ociProfile.popup).locator(`#${value}`)
            .click({ timeout: waitForResourceOptionsTimeout });
        await this.waitForLoadingIcon();
    }

    private async setDropdown(
        boxSelector: string,
        popupSelector: string,
        value: string,
        throwIfMissing = true,
    ): Promise<boolean> {
        const box = this.page.locator(boxSelector);
        if (await box.textContent() === value) {
            return true;
        }

        await box.click();
        const popup = this.page.locator(popupSelector);
        const idOption = popup.locator(`#${value}, #${value.replace(/_/gu, "-")}`);
        await this.waitForOptionalVisible(popup, waitForResourceOptionsTimeout);
        if (await this.waitForOptionalVisible(idOption.first(), wait1second * 2)) {
            await idOption.click();

            return true;
        }

        const expectedText = value.replace(/[_-]+/gu, " ").trim().toLowerCase();
        const option = popup.locator("label, [role='option']").filter({
            hasText: new RegExp(`^\\s*${this.escapeRegExp(value.replace(/[_-]+/gu, " "))}\\s*$`, "iu"),
        }).first();

        if (await this.waitForOptionalVisible(option, waitForResourceOptionsTimeout)) {
            await option.click();

            return true;
        }

        const actualTexts = await popup.locator("label, [role='option']").allTextContents();

        if (throwIfMissing) {
            throw new Error(`Could not find option ${value}. Available options: ${actualTexts.map((text) => {
                return text.replace(/\s+/gu, " ").trim();
            }).join(", ")}`);
        }

        return false;
    }

    private async setLabelDropdown(boxSelector: string, popupSelector: string, value: string): Promise<void> {
        if (await this.trySetLabelDropdown(boxSelector, popupSelector, value)) {
            return;
        }

        throw new Error(`Option ${value} was not found in ${popupSelector}`);
    }

    private async setAnyLabelDropdown(boxSelector: string, popupSelector: string, values: string[]): Promise<void> {
        for (const value of values) {
            if (await this.trySetLabelDropdown(boxSelector, popupSelector, value, wait1second * 5)) {
                return;
            }
        }

        throw new Error(`None of the options ${values.join(", ")} were found in ${popupSelector}`);
    }

    private async trySetLabelDropdown(
        boxSelector: string,
        popupSelector: string,
        value: string,
        timeout = waitForResourceOptionsTimeout,
    ): Promise<boolean> {
        const box = this.page.locator(boxSelector);
        if ((await box.textContent())?.trim() === value) {
            return true;
        }

        const popup = this.page.locator(popupSelector);
        const option = popup.locator(".dropdownItem, label, [role='option']").filter({
            hasText: new RegExp(`^\\s*${this.escapeRegExp(value)}\\s*$`, "u"),
        }).first();

        await expect.poll(async () => {
            await box.click();
            if (!await this.waitForOptionalVisible(popup, wait1second * 2)) {
                return false;
            }

            return await option.count() > 0;
        }, {
            timeout,
            message: `Option ${value} was not found in ${popupSelector}`,
        }).toBe(true).catch(() => {
            return false;
        });

        if (await option.count() === 0) {
            return false;
        }

        await option.click();
        await this.waitForLoadingIcon();

        return true;
    }

    private async setTreeDropdown(boxSelector: string, popupSelector: string, value: string): Promise<void> {
        if (await this.trySetTreeDropdown(boxSelector, popupSelector, value)) {
            return;
        }

        throw new Error(`Could not find option ${value}`);
    }

    private async trySetTreeDropdown(boxSelector: string, popupSelector: string, value: string): Promise<boolean> {
        const box = this.page.locator(boxSelector);
        if (this.treeDropdownValueMatches(await box.textContent(), value)) {
            return true;
        }

        const popup = this.page.locator(popupSelector);
        let sawMatchingOption = false;
        const selected = await expect.poll(async () => {
            if (this.treeDropdownValueMatches(await box.textContent(), value)) {
                return true;
            }

            if (!await popup.isVisible().catch(() => {
                return false;
            })) {
                await box.click();
                if (!await this.waitForOptionalVisible(popup, wait1second * 2)) {
                    return false;
                }
            }

            const options = await popup.locator("[role='option']").all();
            for (const option of options) {
                if (!this.treeDropdownValueMatches(await option.textContent(), value)) {
                    continue;
                }

                sawMatchingOption = true;
                await option.click();
                await this.waitForLoadingIcon();

                return this.treeDropdownValueMatches(await box.textContent(), value);
            }

            return false;
        }, {
            timeout: waitForResourceOptionsTimeout,
            message: `Tree dropdown ${boxSelector} should select ${value}`,
        }).toBe(true).then(() => {
            return true;
        }).catch(() => {
            return false;
        });

        if (selected) {
            return true;
        }

        if (!sawMatchingOption) {
            return false;
        }

        const actualValue = await box.textContent();
        throw new Error(`Tree dropdown ${boxSelector} option ${value} was clicked, ` +
            `but selected value did not become ${value}; actual selected value is ${actualValue ?? "<empty>"}`);
    }

    public async waitForCompatibilityChecksDoneWithIssues(): Promise<void> {
        const state = this.page.locator(locator.steps.schemaCompatibilityChecks.state);
        const doneWithIssues = this.page.getByText("Compatibility issues were detected in the source database.", {
            exact: true,
        });

        try {
            await expect(doneWithIssues).toBeVisible({ timeout: wait1second * 90 });
        } catch (error) {
            const stateText = (await state.allTextContents().catch(() => [])).join(" ");

            throw new Error(`Compatibility checks did not finish with issues. ` +
                `Current state: ${stateText}`, { cause: error });
        }

        await this.waitForLoadingIcon();
    }

    private parseStepStatus(statusClass: string): StepStatus {
        if (statusClass.includes("codicon-check")) {
            return StepStatus.Passed;
        } else if (statusClass.includes("codicon-gear")) {
            return StepStatus.Running;
        } else if (statusClass.includes("codicon-dash")) {
            return StepStatus.NotStarted;
        } else if (statusClass.includes("codicon-error")) {
            return StepStatus.Failed;
        } else if (statusClass.includes("icon-aborted")) {
            return StepStatus.Aborted;
        }

        throw new Error(`Unknown step status ${statusClass}`);
    }

    private normalizeTreeDropdownValue(value: string | null): string {
        const leafValue = value?.split(/\s*\/\s*/u).at(-1) ?? "";

        return leafValue.replace(/^[\s\-–—―]+/u, "").trim();
    }

    private treeDropdownValueMatches(actual: string | null, expected: string): boolean {
        return this.normalizeTreeDropdownValue(actual) === this.normalizeTreeDropdownValue(expected);
    }

    private escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    }

    private async waitForOptionalVisible(target: Locator, timeout: number): Promise<boolean> {
        try {
            await expect(target).toBeVisible({ timeout });

            return true;
        } catch {
            return false;
        }
    }

    private captionMatches(actual: string | null, expected: string): boolean {
        const normalizedActual = actual?.replace(/\s+/gu, " ").trim() ?? "";
        const expectedAliases = expected === targetSelection
            ? [targetSelection, "Target Database"]
            : [expected];

        return expectedAliases.some((alias) => {
            return normalizedActual.includes(alias);
        });
    }
}
