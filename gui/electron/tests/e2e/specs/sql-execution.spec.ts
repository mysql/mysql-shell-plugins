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

import { test, expect } from "../fixtures/electron.js";
import type { ElectronWorkbench } from "../helpers/ElectronWorkbench.js";
import { localMySQLConnection, quoteIdentifier, uniqueSchemaName } from "../helpers/testConfig.js";

const untitledSqlScriptTab = /^Untitled(?:-\d+)?\.sql$/;
const untitledNotebookTab = /^Untitled(?:-\d+)?\.mysql-notebook$/;

const openSqlScript = async (workbench: ElectronWorkbench, caption: string) => {
    const connection = localMySQLConnection(caption);
    await workbench.createMySQLConnection(connection);
    await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);

    return connection;
};

const createScratchSchemaSql = (schema: string): string[] => {
    return [
        `DROP SCHEMA IF EXISTS ${schema};`,
        `CREATE SCHEMA ${schema};`,
        `USE ${schema};`,
    ];
};

test.describe("SQL execution", () => {
    test("executes a SQL script through the native Run command", async ({ page, workbench }) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron SQL Execution");
        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        await workbench.insertInActiveEditor("SELECT 'electron-run-menu' AS message;");

        await workbench.clickMenu(["Run", "Execute"]);

        await workbench.expectResultGridText("electron-run-menu");
    });

    test("renders SQL script result sets in the result grid", async ({ page, workbench }) => {
        await workbench.waitForShell();

        await openSqlScript(workbench, "E2E Electron Result Grid");
        await workbench.insertInActiveEditor("SELECT 42 AS e2e_number, 'electron-grid' AS e2e_label;");

        await workbench.clickMenu(["Run", "Execute"]);

        await workbench.expectResultGridText("electron-grid");
        await expect(page.locator(".resultTabview .tabulator-col-title", { hasText: "e2e_number" }))
            .toBeVisible({ timeout: 30000 });
        await expect(page.locator(".resultTabview .tabulator-col-title", { hasText: "e2e_label" }))
            .toBeVisible({ timeout: 30000 });
    });

    test("renders representative result-grid column types", async ({ page, workbench }) => {
        await workbench.waitForShell();

        await openSqlScript(workbench, "E2E Electron Result Grid Types");
        await workbench.insertInActiveEditor([
            "SELECT",
            "  42 AS int_value,",
            "  'electron-grid-text' AS text_value,",
            "  CAST('2024-01-02 03:04:05' AS DATETIME) AS datetime_value,",
            "  CAST(X'4142' AS BINARY(2)) AS binary_value,",
            "  CAST(NULL AS CHAR) AS nullable_value;",
        ].join("\n"));

        await workbench.clickMenu(["Run", "Execute"]);

        await workbench.expectResultGridCellText(0, "int_value", "42");
        await workbench.expectResultGridCellText(0, "text_value", "electron-grid-text");
        await workbench.expectResultGridCellText(0, "datetime_value", /2024-01-02|0?1\/0?2\/2024/);
        await workbench.expectResultGridCellText(0, "binary_value", /4142|AB|QUI=/);
        await expect(await workbench.resultGridCell(0, "nullable_value")).toHaveText("");
    });

    test("edits and commits a result-grid cell", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const schema = quoteIdentifier(uniqueSchemaName(testInfo));
        await openSqlScript(workbench, "E2E Electron Result Grid Commit");
        await workbench.insertInActiveEditor([
            ...createScratchSchemaSql(schema),
            "DROP TABLE IF EXISTS electron_grid_commit_e2e;",
            "CREATE TABLE electron_grid_commit_e2e (id INT PRIMARY KEY, label VARCHAR(64));",
            "INSERT INTO electron_grid_commit_e2e VALUES (1, 'original-label');",
            "SELECT * FROM electron_grid_commit_e2e;",
        ].join("\n"));
        await workbench.clickMenu(["Run", "Execute"]);
        await workbench.expectResultGridCellText(0, "label", "original-label");

        await workbench.editResultGridCell(0, "label", "committed-label");
        await workbench.applyResultGridChanges();

        await workbench.writeInActiveEditor("SELECT * FROM electron_grid_commit_e2e;");
        await workbench.clickMenu(["Run", "Execute"]);
        await workbench.expectResultGridCellText(0, "label", "committed-label");

        await workbench.writeInActiveEditor(`DROP SCHEMA IF EXISTS ${schema};`);
        await workbench.clickMenu(["Run", "Execute"]);
    });

    test("discards a result-grid edit", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const schema = quoteIdentifier(uniqueSchemaName(testInfo));
        await openSqlScript(workbench, "E2E Electron Result Grid Discard");
        await workbench.insertInActiveEditor([
            ...createScratchSchemaSql(schema),
            "DROP TABLE IF EXISTS electron_grid_discard_e2e;",
            "CREATE TABLE electron_grid_discard_e2e (id INT PRIMARY KEY, label VARCHAR(64));",
            "INSERT INTO electron_grid_discard_e2e VALUES (1, 'discard-original');",
            "SELECT * FROM electron_grid_discard_e2e;",
        ].join("\n"));
        await workbench.clickMenu(["Run", "Execute"]);
        await workbench.expectResultGridCellText(0, "label", "discard-original");

        await workbench.editResultGridCell(0, "label", "discarded-change");
        await workbench.rollbackResultGridChanges();

        await workbench.expectResultGridCellText(0, "label", "discard-original");

        await workbench.writeInActiveEditor(`DROP SCHEMA IF EXISTS ${schema};`);
        await workbench.clickMenu(["Run", "Execute"]);
    });

    test("adds and deletes a result-grid row", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const schema = quoteIdentifier(uniqueSchemaName(testInfo));
        await openSqlScript(workbench, "E2E Electron Result Grid Rows");
        await workbench.insertInActiveEditor([
            ...createScratchSchemaSql(schema),
            "DROP TABLE IF EXISTS electron_grid_rows_e2e;",
            "CREATE TABLE electron_grid_rows_e2e (id INT PRIMARY KEY, label VARCHAR(64));",
            "INSERT INTO electron_grid_rows_e2e VALUES (1, 'base-row');",
            "SELECT * FROM electron_grid_rows_e2e;",
        ].join("\n"));
        await workbench.clickMenu(["Run", "Execute"]);
        await workbench.expectResultGridCellText(0, "label", "base-row");

        await workbench.addResultGridRow({ id: "2", label: "added-row" });
        await workbench.applyResultGridChanges();

        await workbench.writeInActiveEditor("SELECT * FROM electron_grid_rows_e2e;");
        await workbench.clickMenu(["Run", "Execute"]);
        await workbench.expectResultGridCellText(1, "label", "added-row");

        await workbench.markResultGridRowDeleted(1, "label");
        await workbench.applyResultGridChanges();

        await workbench.writeInActiveEditor([
            "SELECT id, label, 'after-delete' AS verification",
            "FROM electron_grid_rows_e2e;",
        ].join("\n"));
        await workbench.clickMenu(["Run", "Execute"]);
        await workbench.expectResultGridCellText(0, "verification", "after-delete");
        await expect(page.locator(".resultTabview")).not.toContainText("added-row");

        await workbench.writeInActiveEditor(`DROP SCHEMA IF EXISTS ${schema};`);
        await workbench.clickMenu(["Run", "Execute"]);
    });

    test("copies result-grid cell, row, and all rows", async ({ page, workbench }) => {
        await workbench.waitForShell();
        await workbench.installClipboardMock();

        await openSqlScript(workbench, "E2E Electron Result Grid Clipboard");
        await workbench.insertInActiveEditor([
            "SELECT 1 AS id, 'copy-one' AS label",
            "UNION ALL",
            "SELECT 2 AS id, 'copy-two' AS label",
            "ORDER BY id;",
        ].join("\n"));
        await workbench.clickMenu(["Run", "Execute"]);
        await workbench.expectResultGridCellText(0, "label", "copy-one");

        expect(await workbench.copyResultGridCell(0, "label")).toContain("copy-one");

        const rowText = await workbench.copyResultGridRowWithNames(0, "label");
        expect(rowText).toContain("id");
        expect(rowText).toContain("label");
        expect(rowText).toContain("copy-one");

        const allRowsText = await workbench.copyAllResultGridRowsWithNames(0, "label");
        expect(allRowsText).toContain("copy-one");
        expect(allRowsText).toContain("copy-two");
    });

    test("executes the SQL statement at the caret from the native Run menu", async ({ page, workbench }) => {
        await workbench.waitForShell();

        await openSqlScript(workbench, "E2E Electron Current Statement");
        await workbench.insertInActiveEditor([
            "SELECT 'electron-current-first' AS current_value;",
            "SELECT 'electron-current-second' AS current_value;",
        ].join("\n"));

        await workbench.clickMenu(["Run", "Execute One"]);

        await workbench.expectResultGridText("electron-current-second");
        await expect(page.locator(".resultTabview")).not.toContainText("electron-current-first");
    });

    test("renders SQL script results as text from the native Run menu", async ({ page, workbench }) => {
        await workbench.waitForShell();

        await openSqlScript(workbench, "E2E Electron Text Results");
        await workbench.insertInActiveEditor("SELECT 'electron-text-result' AS text_value;");

        await workbench.clickMenu(["Run", "Execute with Results as Text"]);

        await expect(page.locator(".resultTabview")).toContainText("electron-text-result", { timeout: 30000 });
    });

    test("executes a DB Notebook through the native Run command", async ({ page, workbench }) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Notebook Execution");
        await workbench.createMySQLConnection(connection);
        await page.locator("#tilesHost .connectionTile", { hasText: connection.caption })
            .locator("#tileNewNotebookAction")
            .click({ force: true });
        await workbench.expectTabAfterPassword(untitledNotebookTab, connection.password);
        await workbench.insertInActiveEditor("SELECT 'electron-notebook-run' AS notebook_value;");

        await workbench.clickMenu(["Run", "Execute"]);

        await workbench.expectResultGridText("electron-notebook-run");
    });
});
