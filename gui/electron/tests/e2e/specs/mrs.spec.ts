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

    return connection;
};

test.describe.skip("MySQL REST Service desktop smoke", () => {
    test("opens MRS configuration from the native Database menu", async ({ page, workbench }) => {
        await workbench.waitForShell();

        await openSqlScript(page, workbench, "E2E Electron MRS Configuration");
        await workbench.clickMenu(["Database", "Configure MySQL REST Service"]);

        const mrsDialog = page.locator(".valueEditDialog, .confirmDialog, .dialogHost", {
            hasText: /MySQL REST Service|MRS/i,
        }).first();
        await workbench.expectVisibleWithoutPassword(mrsDialog, "MRS configuration UI", 60000);
        await expect(mrsDialog).toContainText(/MySQL REST Service|MRS/i);
    });

    test("opens trusted MRS documentation through Electron external URL handling", async ({ workbench }) => {
        await workbench.waitForShell();
        await workbench.installExternalUrlInterceptor();

        await workbench.clickMenu(["Database", "Browse MySQL REST Service Documentation"]);

        await expect.poll(async () => {
            return workbench.externalUrls();
        }, { timeout: 15000 }).toContain("https://dev.mysql.com/doc/dev/mysql-rest-service/latest/");
    });

    test("creates and deletes MRS service, schema, and object entries", async () => {
        // Needs a dedicated, isolated MRS metadata schema fixture before it can run in the default suite.
    });

    test("exports MRS artifacts through a stubbed native save dialog", async () => {
        // Depends on the same local MRS service fixture as the CRUD smoke.
    });
});
