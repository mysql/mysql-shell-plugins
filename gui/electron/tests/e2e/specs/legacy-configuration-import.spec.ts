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

import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { TestInfo } from "@playwright/test";
import type { ElectronApplication } from "playwright";

import {
    closeElectronApp,
    createLegacyConfigurationImportTestSources,
    launchElectronApp,
    test,
    expect,
} from "../fixtures/electron.js";
import { ElectronWorkbench } from "../helpers/ElectronWorkbench.js";

interface ILaunchedWorkbench {
    app: ElectronApplication;
    workbench: ElectronWorkbench;
}

const launchWorkbench = async (
    testInfo: TestInfo,
    userDataDir?: string,
): Promise<ILaunchedWorkbench> => {
    const app = await launchElectronApp(testInfo, {}, userDataDir);
    const page = await app.firstWindow({ timeout: 60000 });

    return {
        app,
        workbench: new ElectronWorkbench(app, page),
    };
};

const expectPathExists = async (path: string): Promise<void> => {
    await expect(access(path)).resolves.toBeUndefined();
};

const expectPathMissing = async (path: string): Promise<void> => {
    await expect(access(path)).rejects.toThrow();
};

const manifestPath = (testInfo: TestInfo, userDataDir?: string): string => {
    return join(
        userDataDir ?? testInfo.outputPath("electron-user-data"),
        "mysqlsh",
        "plugin_data",
        "gui_plugin",
        "legacy_configuration_import.json",
    );
};

test.describe("Legacy configuration import", () => {
    test("opens the normal application when no legacy sources exist", async ({ workbench, page }) => {
        await workbench.waitForShell();
        await expect(page.locator("#legacyConfigurationImportWizard")).toHaveCount(0);
    });

    test("keeps the Configuration Import panel dismissed after restart", async ({}, testInfo) => {
        const sources = await createLegacyConfigurationImportTestSources(testInfo, {
            vsCodeConnections: true,
        });
        let launched: ILaunchedWorkbench | undefined;

        try {
            launched = await launchWorkbench(testInfo);
            await launched.workbench.waitForShell();
            const panel = launched.workbench.page.locator(".legacyConfigurationImportPanel");
            await expect(panel).toBeVisible();
            await panel.locator("#dismissLegacyConfigurationImportPanel").click();
            await expect(panel).toBeHidden();
            await expect(launched.workbench.page.locator(".notificationCenter .toast.info")).toContainText(
                "Profile updated successfully.",
            );
            await closeElectronApp(launched.app);
            launched = undefined;

            launched = await launchWorkbench(testInfo);
            await launched.workbench.waitForShell();
            await expect(
                launched.workbench.page.locator(".legacyConfigurationImportPanel"),
            ).toHaveCount(0);
        } finally {
            if (launched) {
                await closeElectronApp(launched.app);
            }
            sources.close();
        }
    });

    test("omits absent pages and recovers from discovery errors", async ({}, testInfo) => {
        const sources = await createLegacyConfigurationImportTestSources(testInfo, {
            vsCodeConnections: true,
            vsCodeLogs: true,
        });
        let launched: ILaunchedWorkbench | undefined;

        try {
            launched = await launchWorkbench(testInfo);
            await launched.workbench.waitForShell();
            const panel = launched.workbench.page.locator(".legacyConfigurationImportPanel");
            await expect(panel.locator(".legacyConfigurationImportSummary dt")).toHaveText([
                "MySQL Shell for VS Code",
            ]);

            await launched.workbench.openLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage(
                "Import MySQL Shell for VS Code Connections",
            );
            await launched.workbench.cancelLegacyConfigurationImportWizard();
            await closeElectronApp(launched.app);
            launched = undefined;

            await mkdir(sources.failureRoot, { recursive: true });
            await writeFile(join(sources.failureRoot, "discovery"), "", "utf8");
            launched = await launchWorkbench(testInfo);
            await launched.workbench.waitForShell();
            await expect(launched.workbench.page.locator(".legacyConfigurationImportPanelError")).toContainText(
                "Could not check for data from previous applications",
                { timeout: 60000 },
            );
            await expectPathMissing(manifestPath(testInfo));
            await closeElectronApp(launched.app);
            launched = undefined;

            launched = await launchWorkbench(testInfo);
            await launched.workbench.waitForShell();
            await expect(launched.workbench.page.locator(".legacyConfigurationImportPanelError")).toBeVisible({
                timeout: 60000,
            });
            await rm(join(sources.failureRoot, "discovery"));
            await launched.workbench.page.locator("#retryLegacyConfigurationImportDiscovery").click();
            await launched.workbench.openLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage(
                "Import MySQL Shell for VS Code Connections",
            );
        } finally {
            if (launched) {
                await closeElectronApp(launched.app);
            }
            sources.close();
        }
    });

    test("imports all non-password data in order", async ({}, testInfo) => {
        const sources = await createLegacyConfigurationImportTestSources(testInfo, {
            workbenchConnections: true,
            vsCodeConnections: true,
            vsCodeLogs: true,
            workbenchProject: true,
            vsCodeProject: true,
        });
        let launched: ILaunchedWorkbench | undefined;

        try {
            launched = await launchWorkbench(testInfo);
            await launched.workbench.openLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage(
                "Import MySQL Workbench 8 Connections",
            );
            await launched.workbench.advanceLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage(
                "Import MySQL Shell for VS Code Connections",
            );
            await launched.workbench.advanceLegacyConfigurationImportWizard();
            const projects = await launched.workbench.expectLegacyConfigurationImportPage(
                "Import Migration Assistant Projects",
            );
            await expect(projects.locator("#deleteProjectSources")).toHaveClass(/checked/);
            await expect(projects.locator("#copyProjectSshKeys")).toHaveClass(/checked/);
            await expect(projects.locator("#deleteProjectSshKeys")).toHaveClass(/checked/);
            await launched.workbench.advanceLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage("Import Summary");
            await launched.workbench.startLegacyConfigurationImport();
            const results = await launched.workbench.expectLegacyConfigurationImportPage("Import results");
            await expect(results.locator(".legacyConfigurationImportReport")).toHaveCount(5);
            await launched.workbench.closeLegacyConfigurationImportWizard();
            await launched.workbench.waitForShell();
            await closeElectronApp(launched.app);
            launched = undefined;

            for (const logPath of sources.vsCodeLogs) {
                await expectPathMissing(logPath);
            }
            await expectPathMissing(sources.workbenchProject!);
            await expectPathMissing(sources.vsCodeProject!);

            const targetRoot = join(testInfo.outputPath("electron-user-data"), "mysqlsh");
            const targetProjectRoot = join(
                targetRoot,
                "plugin_data",
                "gui_plugin",
                "migration",
            );
            const workbenchData = JSON.parse(await readFile(
                join(targetProjectRoot, "workbench-project", "data.json"),
                "utf8",
            )) as Record<string, unknown>;
            expect(workbenchData.sshPrivateKeyFile).toBe(
                join(targetProjectRoot, "workbench-project", "project-key"),
            );
            expect(workbenchData.sshSharedKeyFile).toBe(
                join(targetProjectRoot, "ssh", "shared-key"),
            );
            await expectPathExists(workbenchData.sshPrivateKeyFile as string);
            await expectPathExists(workbenchData.sshSharedKeyFile as string);
            await expectPathExists(join(targetProjectRoot, "vscode-project", "nested", "state.txt"));

            const targetDatabase = new DatabaseSync(join(
                targetRoot,
                "plugin_data",
                "gui_plugin",
                "mysqlsh_gui_backend.sqlite3",
            ), { readOnly: true });
            try {
                const importedConnections = targetDatabase.prepare(`
                    SELECT dc.caption, COUNT(DISTINCT p.user_id) AS user_count
                    FROM db_connection dc
                    JOIN profile_has_db_connection phdc
                        ON phdc.db_connection_id=dc.id
                    JOIN profile p ON p.id=phdc.profile_id
                    WHERE json_extract(dc.options, '$.host')='db.example'
                      AND json_extract(dc.options, '$.user')='scott'
                    GROUP BY dc.id
                    ORDER BY dc.id
                `).all() as Array<{ caption: string; user_count: number; }>;
                expect(importedConnections).toEqual([
                    {
                        caption: "Workbench Production",
                        user_count: 1,
                    },
                    {
                        caption: "VS Code Production",
                        user_count: 1,
                    },
                ]);
                expect(targetDatabase.prepare(`
                    SELECT COUNT(*) AS count
                    FROM db_connection
                    WHERE caption='Ignored connection'
                `).get()).toEqual({ count: 0 });
            } finally {
                targetDatabase.close();
            }
        } finally {
            if (launched) {
                await closeElectronApp(launched.app);
            }
            sources.close();
        }
    });

    test("resumes after cancel and reports project copy and cleanup failures", async ({}, testInfo) => {
        const sources = await createLegacyConfigurationImportTestSources(testInfo, {
            workbenchConnections: true,
            vsCodeConnections: true,
            vsCodeLogs: true,
            workbenchProject: true,
        });
        const projectCopyFailure = join(
            sources.failureRoot,
            "project-promote-workbench-wrapper",
        );
        const projectCleanupFailure = join(
            sources.failureRoot,
            "project-delete-workbench-wrapper",
        );
        let launched: ILaunchedWorkbench | undefined;

        try {
            await mkdir(sources.failureRoot, { recursive: true });
            await writeFile(projectCopyFailure, "", "utf8");
            launched = await launchWorkbench(testInfo);
            await launched.workbench.openLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage(
                "Import MySQL Workbench 8 Connections",
            );
            await launched.workbench.advanceLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage(
                "Import MySQL Shell for VS Code Connections",
            );
            await launched.workbench.cancelLegacyConfigurationImportWizard();
            await closeElectronApp(launched.app);
            launched = undefined;

            launched = await launchWorkbench(testInfo);
            await launched.workbench.openLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage(
                "Import MySQL Workbench 8 Connections",
            );
            await launched.workbench.advanceLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage(
                "Import MySQL Shell for VS Code Connections",
            );
            await launched.workbench.advanceLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage(
                "Import Migration Assistant Projects",
            );
            await launched.workbench.advanceLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage("Import Summary");
            await launched.workbench.startLegacyConfigurationImport();
            const copyFailureResults = await launched.workbench.expectLegacyConfigurationImportPage(
                "Import results",
            );
            await expect(copyFailureResults).toContainText(
                "Injected legacy configuration import E2E failure",
            );
            await expectPathExists(sources.workbenchProject!);
            await launched.workbench.closeLegacyConfigurationImportWizard();
            await closeElectronApp(launched.app);
            launched = undefined;

            await rm(projectCopyFailure);
            await writeFile(projectCleanupFailure, "", "utf8");
            launched = await launchWorkbench(testInfo);
            await launched.workbench.openLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage(
                "Import Migration Assistant Projects",
            );
            await launched.workbench.advanceLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage("Import Summary");
            await launched.workbench.startLegacyConfigurationImport();
            const cleanupFailureResults = await launched.workbench.expectLegacyConfigurationImportPage(
                "Import results",
            );
            await expect(cleanupFailureResults).toContainText(
                "Injected legacy configuration import E2E failure",
            );
            await expectPathExists(sources.workbenchProject!);
            await launched.workbench.closeLegacyConfigurationImportWizard();
            await closeElectronApp(launched.app);
            launched = undefined;

            await rm(projectCleanupFailure);
            launched = await launchWorkbench(testInfo);
            await launched.workbench.waitForShell();
            await expect(
                launched.workbench.page.locator(".legacyConfigurationImportPanel"),
            ).toHaveCount(0);
            await expectPathExists(sources.workbenchProject!);
        } finally {
            if (launched) {
                await closeElectronApp(launched.app);
            }
            sources.close();
        }
    });

    test("retains project sources by choice and records completion", async ({}, testInfo) => {
        const sources = await createLegacyConfigurationImportTestSources(testInfo, {
            workbenchConnections: true,
            vsCodeConnections: true,
            vsCodeLogs: true,
            workbenchProject: true,
        });
        let launched: ILaunchedWorkbench | undefined;

        try {
            launched = await launchWorkbench(testInfo);
            await launched.workbench.openLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage(
                "Import MySQL Workbench 8 Connections",
            );
            await launched.workbench.advanceLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage(
                "Import MySQL Shell for VS Code Connections",
            );
            await launched.workbench.advanceLegacyConfigurationImportWizard();
            const projects = await launched.workbench.expectLegacyConfigurationImportPage(
                "Import Migration Assistant Projects",
            );
            await projects.locator("#deleteProjectSources").click();
            await expect(projects.locator("#deleteProjectSources")).toHaveClass(/unchecked/);
            await projects.locator("#deleteProjectSshKeys").click();
            await expect(projects.locator("#deleteProjectSshKeys")).toHaveClass(/unchecked/);
            await launched.workbench.advanceLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage("Import Summary");
            await launched.workbench.startLegacyConfigurationImport();
            await launched.workbench.expectLegacyConfigurationImportPage("Import results");
            await launched.workbench.closeLegacyConfigurationImportWizard();
            await launched.workbench.waitForShell();
            await closeElectronApp(launched.app);
            launched = undefined;

            for (const logPath of sources.vsCodeLogs) {
                await expectPathMissing(logPath);
            }
            await expectPathExists(sources.workbenchProject!);
            const manifest = JSON.parse(
                await readFile(manifestPath(testInfo), "utf8"),
            ) as {
                completedPhases: string[];
            };
            expect(manifest.completedPhases).toContain("vscodeConnections:v1");
            expect(manifest.completedPhases).toContain(
                "migrationAssistantProjects:workbench-wrapper:v1",
            );

            launched = await launchWorkbench(testInfo);
            await launched.workbench.waitForShell();
            await expect(launched.workbench.page.locator("#legacyConfigurationImportWizard")).toHaveCount(0);
            await closeElectronApp(launched.app);
            launched = undefined;

            const freshUserData = testInfo.outputPath("fresh-electron-user-data");
            launched = await launchWorkbench(testInfo, freshUserData);
            await launched.workbench.openLegacyConfigurationImportWizard();
            await launched.workbench.expectLegacyConfigurationImportPage(
                "Import MySQL Workbench 8 Connections",
            );
            await expectPathMissing(manifestPath(testInfo, freshUserData));
        } finally {
            if (launched) {
                await closeElectronApp(launched.app);
            }
            sources.close();
        }
    });
});
