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

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { test, expect } from "../fixtures/electron.js";
import { localMySQLConnection } from "../helpers/testConfig.js";

const untitledSqlScriptTab = /^Untitled(?:-\d+)?\.sql$/;
const untitledNotebookTab = /^Untitled(?:-\d+)?\.mysql-notebook$/;

test.describe("Open editors", () => {
    test("opens SQL scripts and notebooks through desktop commands", async ({ page, workbench }) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Editors");
        await workbench.createMySQLConnection(connection);
        const tile = page.locator("#tilesHost .connectionTile", { hasText: connection.caption });
        await tile.locator("#tileNewScriptAction").click({ force: true });
        await workbench.expectTabAfterPassword(/^Untitled\.sql$/, connection.password);
        await expect(page.locator(".monaco-editor")).toBeVisible();

        await workbench.clickMenu(["File", "New SQL Script"]);
        await workbench.expectTabWithoutPassword(/^Untitled-1\.sql$/);

        await workbench.clickMenu(["File", "New Notebook"]);
        await workbench.expectTabWithoutPassword(untitledNotebookTab);
    });

    test("loads a supported script through the native Open command", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Open Script");
        const scriptPath = join(testInfo.outputDir, "opened-script.sql");
        await writeFile(scriptPath, "SELECT 'electron-open';\n", "utf8");

        await workbench.createMySQLConnection(connection);
        await page.locator("#tilesHost .connectionTile", { hasText: connection.caption })
            .locator("#tileNewScriptAction")
            .click({ force: true });
        await workbench.expectTabAfterPassword(untitledSqlScriptTab, connection.password);
        await workbench.stubOpenDialog([scriptPath]);

        await workbench.clickMenu(["File", "Open..."]);
        await workbench.expectTab("opened-script.sql");
        await workbench.expectEditorText("electron-open");
    });

    test("opens editor find from the native Edit menu", async ({ page, workbench }) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Find Script");
        await workbench.createMySQLConnection(connection);
        await page.locator("#tilesHost .connectionTile", { hasText: connection.caption })
            .locator("#tileNewScriptAction")
            .click({ force: true });
        await workbench.expectTabAfterPassword(/^Untitled\.sql$/, connection.password);

        await workbench.clickMenu(["Edit", "Find"]);

        await expect(page.locator(".find-widget")).toBeVisible({ timeout: 15000 });
    });

    test("closes the active script from the native File menu", async ({ page, workbench }) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Close Script");
        await workbench.createMySQLConnection(connection);
        await page.locator("#tilesHost .connectionTile", { hasText: connection.caption })
            .locator("#tileNewScriptAction")
            .click({ force: true });
        await workbench.expectTabAfterPassword(/^Untitled\.sql$/, connection.password);

        await workbench.clickMenu(["File", "Close Tab"]);

        await workbench.expectNoTab(/^Untitled\.sql$/);
    });

    test("saves and reopens a SQL script through native desktop file commands", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Save Script");
        const scriptPath = join(testInfo.outputDir, "saved-script.sql");
        await workbench.createMySQLConnection(connection);
        await page.locator("#tilesHost .connectionTile", { hasText: connection.caption })
            .locator("#tileNewScriptAction")
            .click({ force: true });
        await workbench.expectTabAfterPassword(untitledSqlScriptTab, connection.password);
        await workbench.writeInActiveEditor("SELECT 'electron-save-as' AS saved_value;\n");
        await workbench.expectEditorText("electron-save-as");
        await workbench.stubSaveDialog(scriptPath);

        await workbench.clickMenu(["File", "Save As..."]);

        await workbench.expectTab("saved-script.sql");
        await expect.poll(async () => {
            try {
                return await readFile(scriptPath, "utf8");
            } catch {
                return "";
            }
        }, { timeout: 15000 }).toContain("electron-save-as");

        await expect.poll(async () => {
            const fileMenu = (await workbench.menuSnapshot()).find((item) => {
                return item.label === "File";
            });
            const recentMenu = fileMenu?.submenu?.find((item) => {
                return item.label === "Open Recent";
            });

            return recentMenu?.submenu?.some((item) => {
                return item.label === scriptPath;
            }) ?? false;
        }, { timeout: 15000 }).toBe(true);

        await workbench.clickMenu(["File", "New SQL Script"]);
        await workbench.expectTabWithoutPassword(/^Untitled-1\.sql$/);
        await workbench.selectTab("saved-script.sql");
        await workbench.clickMenu(["File", "Close Tab"]);
        await workbench.expectNoTab("saved-script.sql");

        await workbench.clickMenu(["File", "Open Recent", scriptPath]);
        await workbench.expectTab("saved-script.sql");
        await workbench.expectEditorText("electron-save-as");
    });
});
