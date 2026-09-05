/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms,
 * as designated in a particular file or component or in included license
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

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { isAbsolute, resolve } from "node:path";

import type { Page, TestInfo } from "@playwright/test";

import { closeElectronApp, launchElectronApp, test, expect } from "../fixtures/electron.js";
import { ElectronWorkbench } from "../helpers/ElectronWorkbench.js";
import {
    localMySQLConnection, mysqlshUserConfigHome,
} from "../helpers/testConfig.js";

const errorLogPageSize = 1000;
const untitledSqlScriptTab = /^Untitled(?:-\d+)?\.sql$/;
const sandboxRootPassword = process.env.ELECTRON_E2E_DB_ROOT_PASSWORD ?? "Sakila1!";
const sandboxMySQLDPath = process.env.ELECTRON_E2E_MYSQLD_PATH ?? process.env.MYSQLD_PATH;

type ErrorLogFixture = {
    path: string;
    originalContent: string;
    firstMarker: string;
    nextMarker: string;
    finalMarker: string;
    filterSubsystem: string;
    filterMessage: string;
};

const mysqlshPath = (): string => {
    return process.env.ELECTRON_E2E_MYSQLSH ?? process.env.MYSQLSH ?? "mysqlsh";
};

const runMysqlsh = (args: string[]): string => {
    const result = spawnSync(mysqlshPath(), ["--disable-builtin-plugins", ...args], {
        encoding: "utf8",
        env: {
            ...process.env,
            MYSQLSH_USER_CONFIG_HOME: mysqlshUserConfigHome(),
        },
    });
    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || String(result.error));
    }

    return result.stdout;
};

const mysqlshConnectionArguments = (connection: ReturnType<typeof localMySQLConnection>): string[] => {
    return [
        "--host", connection.host,
        "--port", connection.port,
        "--user", connection.user,
        `--password=${connection.password}`,
    ];
};

const resolveErrorLogPath = (connection: ReturnType<typeof localMySQLConnection>): string => {
    const output = runMysqlsh([
        "--py",
        "--quiet-start=2",
        ...mysqlshConnectionArguments(connection),
        "-e",
        "row = session.run_sql('SELECT @@global.log_error, @@global.datadir').fetch_one(); "
        + "print(row[0]); print(row[1])",
    ]);
    const values = output.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).slice(-2);
    if (values.length !== 2 || !values[0] || !values[1]) {
        throw new Error(`Could not determine the sandbox error log path: ${output}`);
    }

    return isAbsolute(values[0]) ? resolve(values[0]) : resolve(values[1], values[0]);
};

type Sandbox = {
    port: string;
    directory: string;
};

const deploySandbox = async (testInfo: TestInfo): Promise<Sandbox> => {
    const port = String(Number(localMySQLConnection("sandbox").port) + 100 + testInfo.workerIndex);
    const directory = testInfo.outputPath("offline-sandbox");
    await mkdir(directory, { recursive: true });
    const args = [
        "--", "dba", "deploy-sandbox-instance", port,
        `--password=${sandboxRootPassword}`,
        `--sandbox-dir=${directory}`,
    ];
    if (sandboxMySQLDPath) {
        args.push(`--mysqld-path=${sandboxMySQLDPath}`);
    }
    runMysqlsh(args);

    return { port, directory };
};

const stopSandbox = (sandbox: Sandbox): void => {
    runMysqlsh([
        "--", "dba", "stop-sandbox-instance", sandbox.port,
        `--password=${sandboxRootPassword}`,
        `--sandbox-dir=${sandbox.directory}`,
    ]);
};

const deleteSandbox = (sandbox: Sandbox, running: boolean): void => {
    if (running) {
        runMysqlsh([
            "--", "dba", "kill-sandbox-instance", sandbox.port,
            `--sandbox-dir=${sandbox.directory}`,
        ]);
    }
    runMysqlsh([
        "--", "dba", "delete-sandbox-instance", sandbox.port,
        `--sandbox-dir=${sandbox.directory}`,
    ]);
};

const appendErrorLogFixture = async (
    connection: ReturnType<typeof localMySQLConnection>,
    name: string,
): Promise<ErrorLogFixture> => {
    const path = resolveErrorLogPath(connection);
    const existing = await readFile(path, "utf8");
    const existingLineCount = existing.length === 0 ? 0 : existing.split(/\r?\n/).length - 1;
    const prefix = `E2E_ERROR_LOG_${name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
    const firstMarker = `${prefix}_FIRST_PAGE`;
    const nextMarker = `${prefix}_NEXT_PAGE`;
    const finalMarker = `${prefix}_FINAL_PAGE`;
    const filterSubsystem = `${prefix}_FILTER_SUBSYSTEM`;
    const filterMessage = `${prefix}_FILTER_MESSAGE`;
    const fixtureLineCount = errorLogPageSize + 5;
    const firstFixtureLine = existingLineCount + 1;
    const lines = Array.from({ length: fixtureLineCount }, (_, index) => {
        const lineNumber = firstFixtureLine + index;
        const marker = lineNumber === firstFixtureLine
            ? firstMarker
            : lineNumber === firstFixtureLine + errorLogPageSize
                ? nextMarker
                : index === fixtureLineCount - 1
                    ? finalMarker
                    : lineNumber === firstFixtureLine + errorLogPageSize - 3
                        ? filterMessage
                        : "fixture";
        const subsystem = marker === filterMessage ? filterSubsystem : `${prefix}_SUBSYSTEM`;
        const priority = lineNumber % 2 === 0 ? "Warning" : "Note";
        const timestamp = `2026-09-02T${String(Math.floor(index / 3600)).padStart(2, "0")}:`
            + `${String(Math.floor(index / 60) % 60).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}.000000Z`;

        return `${timestamp} 0 [${priority}] [MY-100001] [${subsystem}] ${marker}\n`;
    });
    await appendFile(path, lines.join(""), "utf8");

    return {
        path, originalContent: existing, firstMarker, nextMarker, finalMarker, filterSubsystem,
        filterMessage
    };
};

const restoreErrorLogFixture = async (fixture: ErrorLogFixture): Promise<void> => {
    await writeFile(fixture.path, fixture.originalContent, "utf8");
};

const logRows = async (page: Page): Promise<string[][]> => {
    return page.locator("#logsTable .tabulator-row").evaluateAll((rows) => {
        return rows.map((row) => {
            return [...row.querySelectorAll(".tabulator-cell")].map((cell) => cell.textContent?.trim() ?? "");
        });
    });
};

const openErrorLog = async (
    page: Page,
    workbench: ElectronWorkbench,
): Promise<void> => {
    await workbench.clickMenu(["Database", "Error Log"]);
    await workbench.expectVisibleWithoutPassword(page.locator("#logsOverview"), "Error Log");
    await expect(page.locator("#logsTable")).toBeVisible({ timeout: 30000 });
};

const openLogsAction = async (
    page: Page,
    workbench: ElectronWorkbench,
    action: string,
): Promise<void> => {
    await workbench.selectPopupMenuAction(page.getByTitle("Show Action Menu"), [action]);
};

const exportLogs = async (
    page: Page,
    workbench: ElectronWorkbench,
    exportPath: string,
): Promise<void> => {
    await workbench.stubSaveDialog(exportPath);
    await openLogsAction(page, workbench, "Export Logs...");
    await expect.poll(async () => {
        return readFile(exportPath, "utf8").catch(() => "");
    }, { timeout: 30000 }).not.toBe("");
};

test.describe.serial("Server Error Log Viewer", () => {
    test("pfs error_log table workflow", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Error Log Online");
        await workbench.createMySQLConnection(connection);
        const fixture = await appendErrorLogFixture(connection, "online");
        try {
            await workbench.openSqlScriptFromConnectionTile(
                connection.caption, connection.password, untitledSqlScriptTab,
            );
            await openErrorLog(page, workbench);

            await expect(page.locator("#logsOverview")).toContainText("performance_schema.error_log");
            await expect(page.locator("#logsTable .tabulator-col-title")).toHaveText([
                "Timestamp", "Priority", "Error Code", "Subsystem", "Message",
            ]);
            const rows = await logRows(page);
            expect(rows.length).toBeGreaterThan(0);
            if (rows.length > 1) {
                expect(Date.parse(rows[0][0])).toBeGreaterThanOrEqual(Date.parse(rows[1][0]));
            }

            const priority = rows[0][1];
            const message = rows[0][4];
            await page.getByTitle("Filter").click();
            await page.locator(".logsFilterDropdownButton").nth(0).click();
            await page.locator(".logsFilterChoice", { hasText: priority }).locator("input").check();
            await page.locator("#logsFilterEditor input[type='text']").fill(message.slice(0, 24));
            await page.getByRole("button", { name: "Apply", exact: true }).click();
            await expect.poll(() => logRows(page)).not.toHaveLength(0);
            for (const row of await logRows(page)) {
                expect(row[1]).toBe(priority);
                expect(row[4].toLowerCase()).toContain(message.slice(0, 24).toLowerCase());
            }

            await page.getByRole("button", { name: "Reset", exact: true }).click();
            await expect.poll(() => logRows(page)).not.toHaveLength(0);
            const exportPath = testInfo.outputPath("online-error.log");
            await exportLogs(page, workbench, exportPath);
            await expect.poll(async () => {
                return readFile(exportPath, "utf8");
            }, { timeout: 30000 }).toContain(message);
        } finally {
            await restoreErrorLogFixture(fixture);
        }
    });

    test("local error.log file workflow", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Error Log File");
        await workbench.createMySQLConnection(connection);
        const fixture = await appendErrorLogFixture(connection, "file");
        try {
            await workbench.openSqlScriptFromConnectionTile(
                connection.caption, connection.password, untitledSqlScriptTab,
            );
            await openErrorLog(page, workbench);

            await openLogsAction(page, workbench, "View Error Log File");
            await expect(page.locator("#logsOverview")).toContainText(fixture.path);
            await expect(page.locator("#logsTable")).toContainText(fixture.finalMarker);

            await page.getByTitle("First Page").click();
            await expect(page.locator("#logsTable")).toContainText(fixture.firstMarker);
            await page.getByTitle("Next Page").click();
            await expect(page.locator("#logsTable")).toContainText(fixture.nextMarker);
            await page.getByTitle("Refresh").click();
            await expect(page.locator("#logsTable")).toContainText(fixture.nextMarker);

            await page.getByTitle("Filter").click();
            await page.locator(".logsFilterDropdownButton").nth(2).click();
            await page.locator(".logsFilterChoice", { hasText: fixture.filterSubsystem }).locator("input").check();
            await page.locator("#logsFilterEditor input[type='text']").fill(fixture.filterMessage);
            await page.getByRole("button", { name: "Apply", exact: true }).click();
            await expect.poll(() => logRows(page)).not.toHaveLength(0);
            for (const row of await logRows(page)) {
                expect(row[3]).toBe(fixture.filterSubsystem);
                expect(row[4]).toContain(fixture.filterMessage);
            }

            const source = await readFile(fixture.path, "utf8");
            const exportPath = testInfo.outputPath("file-error.log");
            await exportLogs(page, workbench, exportPath);
            await expect.poll(async () => {
                return readFile(exportPath, "utf8");
            }, { timeout: 30000 }).toBe(source);
        } finally {
            await restoreErrorLogFixture(fixture);
        }
    });

    test("offline error.log file workflow", async ({ electronApp, page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const sandbox = await deploySandbox(testInfo);
        const connection = {
            ...localMySQLConnection("E2E Electron Error Log Offline"),
            port: sandbox.port,
            user: "root",
            password: sandboxRootPassword,
            schema: "",
        };
        let fixture: ErrorLogFixture | undefined;
        let sandboxStopped = false;
        let offlineApp: Awaited<ReturnType<typeof launchElectronApp>> | undefined;
        try {
            await workbench.createMySQLConnection(connection);
            fixture = await appendErrorLogFixture(connection, "offline");
            await workbench.openSqlScriptFromConnectionTile(
                connection.caption, connection.password, untitledSqlScriptTab,
            );
            await openErrorLog(page, workbench);
            await closeElectronApp(electronApp);
            stopSandbox(sandbox);
            sandboxStopped = true;
            offlineApp = await launchElectronApp(testInfo);
            const offlinePage = await offlineApp.firstWindow({ timeout: 60000 });
            const offlineWorkbench = new ElectronWorkbench(offlineApp, offlinePage);
            await offlineWorkbench.waitForShell();
            await offlineWorkbench.expectConnectionTile(connection.caption);
            await offlineWorkbench.selectConnectionTileAction(connection.caption, ["Connect with New SQL Script"]);
            await offlineWorkbench.expectVisibleAfterPassword(
                offlinePage.locator("#serverStatusOverview"), connection.password, "offline Server Status",
            );
            await openErrorLog(offlinePage, offlineWorkbench);
            await expect(offlinePage.locator("#logsOverview")).toContainText(fixture.path);
            await expect(offlinePage.locator("#logsTable")).toContainText(fixture.finalMarker);

            await appendFile(fixture.path,
                `2026-09-02T23:59:59.000000Z 0 [Warning] [MY-100001] `
                + `[${fixture.filterSubsystem}] ${fixture.finalMarker}_REFRESH\n`, "utf8");
            await offlinePage.getByTitle("Refresh").click();
            await expect(offlinePage.locator("#logsTable")).toContainText(`${fixture.finalMarker}_REFRESH`);
        } finally {
            if (offlineApp) {
                await closeElectronApp(offlineApp);
            }
            if (fixture) {
                await restoreErrorLogFixture(fixture);
            }
            deleteSandbox(sandbox, !sandboxStopped);
        }
    });
});
