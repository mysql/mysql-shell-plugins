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

import { spawnSync } from "node:child_process";

import { test, expect } from "../fixtures/electron.js";
import { localMySQLConnection, mysqlshUserConfigHome } from "../helpers/testConfig.js";

const untitledSqlScriptTab = /^Untitled(?:-\d+)?\.sql$/;

const sqlString = (value: string): string => {
    return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
};

const openConnectionCount = (connection: ReturnType<typeof localMySQLConnection>): number => {
    const sql = `SELECT COUNT(*) FROM performance_schema.threads `
        + `WHERE PROCESSLIST_USER = '${sqlString(connection.user)}' `
        + `AND PROCESSLIST_ID IS NOT NULL `
        + `AND PROCESSLIST_ID <> CONNECTION_ID()`;
    const response = spawnSync(process.env.ELECTRON_E2E_MYSQLSH ?? process.env.MYSQLSH ?? "mysqlsh", [
        "--disable-builtin-plugins",
        "--sql",
        "--result-format=tabbed",
        "--host", connection.host,
        "--port", connection.port,
        "--user", connection.user,
        `--password=${connection.password}`,
        "-e", sql,
    ], {
        encoding: "utf8",
        env: {
            ...process.env,
            MYSQLSH_USER_CONFIG_HOME: mysqlshUserConfigHome(),
        },
    });

    if (response.status !== 0) {
        throw new Error(response.stderr || response.stdout || String(response.error));
    }

    const match = response.stdout.match(/(?:^|\n)(\d+)\s*$/);
    if (!match) {
        throw new Error(`Could not parse open connection count from mysqlsh output: ${response.stdout}`);
    }

    return Number(match[1]);
};

test.describe("Desktop command integration", () => {
    test("keeps the native command state synchronized with the active workspace", async ({ page, workbench }) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Commands");
        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);

        await workbench.waitForMenuItem(["File", "Save As..."], { enabled: true });
        await workbench.waitForMenuItem(["View", "Developer", "Toggle Communication Debugger"], { enabled: true });

        await workbench.clickMenu(["View", "Developer", "Toggle Communication Debugger"]);
        await expect(page.locator("#communicationDebuggerWorkspacePage")).toBeVisible({ timeout: 15000 });
        await expect(page.locator("#communicationDebuggerSidebarHost")).toBeVisible();

        await workbench.clickMenu(["View", "Developer", "Toggle Communication Debugger"]);
        await expect(page.locator("#communicationDebuggerWorkspacePage")).toHaveCount(0);
    });

    test("toggles the desktop sidebar with the native View command", async ({ page, workbench }) => {
        await workbench.waitForShell();

        const sidebar = page.locator("#desktopSidebarPane");
        await expect(sidebar).toBeVisible();

        await workbench.clickMenu(["View", "Toggle Sidebar"]);
        await expect(sidebar).toBeHidden({ timeout: 15000 });

        await workbench.clickMenu(["View", "Toggle Sidebar"]);
        await expect(sidebar).toBeVisible({ timeout: 15000 });
    });

    test("opens redesigned administration pages from the native Database menu", async ({ page, workbench }) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Admin Pages");
        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);

        await workbench.clickMenu(["Database", "Server Status"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#serverStatusOverview"), "Server Status");
        await expect(page.locator("#serverStatusOverview")).toContainText("Server Status");

        await workbench.clickMenu(["Database", "Client Connections"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#connectionList"), "Client Connections");
        await expect(page.locator("#connectionList")).toBeVisible();
    });

    test("reuses the administration server connection", async ({ page, workbench }) => {
        await workbench.waitForShell();

        const connection = {
            ...localMySQLConnection("E2E Electron Admin Connection Reuse"),
            user: "dbuser3",
            password: "dummy",
        };
        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        await workbench.waitForSchemasTreeReady();

        let initialConnectionCount = 0;
        await expect.poll(() => {
            initialConnectionCount = openConnectionCount(connection);

            return initialConnectionCount;
        }, { timeout: 15000 }).toBe(2);

        await workbench.clickMenu(["Database", "Server Status"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#serverStatusOverview"), "Server Status");

        await workbench.clickMenu(["Database", "Client Connections"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#connectionList"), "Client Connections");

        await workbench.clickMenu(["Database", "Server Status"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#serverStatusOverview"), "Server Status");

        await expect.poll(() => {
            return openConnectionCount(connection);
        }, { timeout: 15000 }).toBe(initialConnectionCount + 1);
    });
});
