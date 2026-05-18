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

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Page } from "@playwright/test";

import { test, expect } from "../fixtures/electron.js";
import type { ElectronWorkbench } from "../helpers/ElectronWorkbench.js";
import { localMySQLConnection, quoteIdentifier, uniqueSchemaName } from "../helpers/testConfig.js";

const untitledNotebookTab = /^Untitled(?:-\d+)?\.mysql-notebook$/;

const openNotebook = async (page: Page, workbench: ElectronWorkbench, caption: string) => {
    const connection = localMySQLConnection(caption);
    await workbench.createMySQLConnection(connection);
    await page.locator("#tilesHost .connectionTile", { hasText: connection.caption })
        .locator("#tileNewNotebookAction")
        .click({ force: true });
    await workbench.expectTabAfterPassword(untitledNotebookTab, connection.password);

    return connection;
};

test.describe("DB notebooks", () => {
    test("saves and reopens a notebook through native file commands", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        await openNotebook(page, workbench, "E2E Electron Save Notebook");
        const notebookPath = join(testInfo.outputDir, "saved-notebook.mysql-notebook");
        await workbench.writeInActiveEditor("SELECT 'electron-notebook-save' AS saved_value;\n");
        await workbench.stubSaveDialog(notebookPath);

        await workbench.clickMenu(["File", "Save As..."]);

        await workbench.expectTab("saved-notebook.mysql-notebook");
        await expect.poll(async () => {
            try {
                return await readFile(notebookPath, "utf8");
            } catch {
                return "";
            }
        }, { timeout: 15000 }).toContain("electron-notebook-save");

        await workbench.clickMenu(["File", "New Notebook"]);
        await workbench.expectTabWithoutPassword(/^Untitled-1\.mysql-notebook$/);
        await workbench.selectTab("saved-notebook.mysql-notebook");
        await workbench.clickMenu(["File", "Close Tab"]);
        await workbench.expectNoTab("saved-notebook.mysql-notebook");

        await workbench.clickMenu(["File", "Open Recent", notebookPath]);
        await workbench.expectTab("saved-notebook.mysql-notebook");
        await workbench.expectEditorText("electron-notebook-save");
    });

    test("executes the current notebook statement from the native Run menu", async ({ page, workbench }) => {
        await workbench.waitForShell();

        await openNotebook(page, workbench, "E2E Electron Notebook Current");
        await workbench.insertInActiveEditor([
            "SELECT 'notebook-current-first' AS notebook_value;",
            "SELECT 'notebook-current-second' AS notebook_value;",
        ].join("\n"));

        await workbench.clickMenu(["Run", "Execute One"]);

        await workbench.expectResultGridText("notebook-current-second");
        await expect(page.locator(".resultTabview")).not.toContainText("notebook-current-first");
    });

    test("executes a notebook block and advances to a new block", async ({ page, workbench }) => {
        await workbench.waitForShell();

        await openNotebook(page, workbench, "E2E Electron Notebook Advance");
        await workbench.insertInActiveEditor("SELECT 'notebook-advance-first' AS notebook_value;");

        await page.keyboard.press("ControlOrMeta+Enter");

        await workbench.expectResultGridText("notebook-advance-first");
        await workbench.insertInActiveEditor("SELECT 'notebook-advance-second' AS notebook_value;");
        await page.keyboard.press("ControlOrMeta+Enter");

        await workbench.expectResultGridText("notebook-advance-second");
        await workbench.expectEditorText("notebook-advance-first");
        await workbench.expectEditorText("notebook-advance-second");
    });

    test("executes delimiter-based notebook SQL", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const schema = quoteIdentifier(uniqueSchemaName(testInfo));
        await openNotebook(page, workbench, "E2E Electron Notebook Delimiter");
        await workbench.insertInActiveEditor([
            `DROP SCHEMA IF EXISTS ${schema};`,
            `CREATE SCHEMA ${schema};`,
            `USE ${schema};`,
            "DROP PROCEDURE IF EXISTS electron_notebook_proc;",
            "DELIMITER $$",
            "CREATE PROCEDURE electron_notebook_proc()",
            "BEGIN",
            "    SELECT 'notebook-delimiter-ok' AS delimiter_value;",
            "END$$",
            "DELIMITER ;",
            "CALL electron_notebook_proc();",
        ].join("\n"));

        await workbench.clickMenu(["Run", "Execute"]);

        await workbench.expectResultGridText("notebook-delimiter-ok");

        await workbench.writeInActiveEditor(`DROP SCHEMA IF EXISTS ${schema};`);
        await workbench.clickMenu(["Run", "Execute"]);
    });

    test("uses notebook result tab controls", async ({ page, workbench }) => {
        await workbench.waitForShell();

        await openNotebook(page, workbench, "E2E Electron Notebook Results");
        await workbench.insertInActiveEditor([
            "SELECT 'notebook-result-one' AS notebook_value;",
            "SELECT 'notebook-result-two' AS notebook_value;",
        ].join("\n"));

        await workbench.clickMenu(["Run", "Execute"]);

        await expect(page.locator(".resultTabview .tabItem")).toHaveCount(2, { timeout: 30000 });
        await page.locator(".resultTabview .tabItem", { hasText: "Result #2" }).evaluate((item: HTMLElement) => {
            item.click();
        });
        await workbench.expectResultGridText("notebook-result-two");

        const toggleStateButton = page.locator(".resultTabview #toggleStateButton");
        if (await toggleStateButton.count() > 0) {
            await toggleStateButton.evaluate((button: HTMLElement) => {
                button.click();
            });
            await workbench.expectResultGridText("notebook-result-two");
            await toggleStateButton.evaluate((button: HTMLElement) => {
                button.click();
            });
        }

        await expect(page.locator(".resultTabview .tabItem.selected")).toContainText("Result #2");
    });

    test("finds and replaces notebook editor text", async ({ page, workbench }) => {
        await workbench.waitForShell();

        await openNotebook(page, workbench, "E2E Electron Notebook Find Replace");
        await workbench.writeInActiveEditor("import from xpto xpto xpto");

        await workbench.clickMenu(["Edit", "Find"]);

        const findWidget = page.locator(".find-widget.visible");
        await expect(findWidget).toBeVisible({ timeout: 15000 });
        await findWidget.locator("textarea[aria-label='Find']").fill("xpto");

        const toggleReplace = findWidget.locator(".button.toggle").first();
        if (!await findWidget.locator(".button.toggle.codicon-find-expanded").isVisible()) {
            await toggleReplace.click();
        }

        const replaceInput = findWidget.locator("textarea[aria-label='Replace']");
        await replaceInput.fill("tester");
        await findWidget.locator(".replace-actions div[aria-label*='Replace (Enter)']").click();
        await workbench.expectEditorText("import from tester xpto xpto");

        await replaceInput.fill("testing");
        await findWidget.locator(".replace-actions div[aria-label*='Replace All']").click();
        await workbench.expectEditorText("import from tester testing testing");
    });
});
