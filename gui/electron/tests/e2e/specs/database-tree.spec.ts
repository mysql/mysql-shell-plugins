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

import { test, expect } from "../fixtures/electron.js";
import type { ElectronWorkbench } from "../helpers/ElectronWorkbench.js";
import { localMySQLConnection } from "../helpers/testConfig.js";

const untitledSqlScriptTab = /^Untitled(?:-\d+)?\.sql$/;

const openSqlScript = async (page: Page, workbench: ElectronWorkbench, caption: string) => {
    const connection = localMySQLConnection(caption);
    await workbench.createMySQLConnection(connection);
    await page.locator("#tilesHost .connectionTile", { hasText: connection.caption })
        .locator("#tileNewScriptAction")
        .click({ force: true });
    await workbench.expectTabAfterPassword(untitledSqlScriptTab, connection.password);
    await workbench.settlePasswordPrompts(connection.password, 10000);
    await workbench.waitForSchemasTreeReady();

    return connection;
};

const expandSakilaTables = async (workbench: ElectronWorkbench): Promise<void> => {
    await workbench.expandSchemaTreeEntry("sakila", "Tables");
    await workbench.expandSchemaTreeEntry("Tables", "actor");
};

test.describe("Database sidebar tree", () => {
    test("expands connection schemas and tables", async ({ page, workbench }) => {
        await workbench.waitForShell();

        await openSqlScript(page, workbench, "E2E Electron DB Tree Expand");

        await expect(workbench.schemaTreeEntry("sakila")).toBeVisible({ timeout: 30000 });
        await expandSakilaTables(workbench);
    });

    test("toggles system schema visibility from the native View menu", async ({ page, workbench }) => {
        await workbench.waitForShell();

        await openSqlScript(page, workbench, "E2E Electron DB Tree System Schemas");

        await expect(workbench.schemaTreeEntry("mysql")).toHaveCount(0);

        await workbench.clickMenu(["View", "Schemas", "Show System Schemas"]);

        await expect(workbench.schemaTreeEntry("mysql")).toBeVisible({ timeout: 30000 });

        await workbench.clickMenu(["View", "Schemas", "Show System Schemas"]);

        await expect(page.locator("#schemasSection label#mainCaption", { hasText: /^mysql$/ }))
            .toHaveCount(0, { timeout: 30000 });
    });

    test("copies schema and table names from tree context menus", async ({ page, workbench }) => {
        await workbench.waitForShell();
        await workbench.installClipboardMock();

        await openSqlScript(page, workbench, "E2E Electron DB Tree Copy");
        await expandSakilaTables(workbench);

        await workbench.clearClipboard();
        await workbench.selectSchemaTreeAction("sakila", ["Copy to Clipboard", "Name"]);
        await expect.poll(async () => {
            return workbench.readClipboardText();
        }, { timeout: 15000 }).toBe("sakila");

        await workbench.clearClipboard();
        await workbench.selectSchemaTreeAction("actor", ["Copy to Clipboard", "Name"]);
        await expect.poll(async () => {
            return workbench.readClipboardText();
        }, { timeout: 15000 }).toBe("actor");
    });

    test("creates a table SELECT from the tree context menu", async ({ page, workbench }) => {
        await workbench.waitForShell();

        await openSqlScript(page, workbench, "E2E Electron DB Tree Select Rows");
        await expandSakilaTables(workbench);

        await workbench.selectSchemaTreeAction("actor", ["Select Rows"]);

        await expect(page.locator(".resultTabview")).toContainText("actor_id", { timeout: 30000 });
        await expect(page.locator(".resultTabview")).toContainText(/PENELOPE|NICK|ED/, { timeout: 30000 });
    });
});
