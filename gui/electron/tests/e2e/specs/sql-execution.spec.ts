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

import type { Page, TestInfo } from "@playwright/test";
import type { ElectronApplication } from "playwright";

import { closeElectronApp, launchElectronApp, test, expect } from "../fixtures/electron.js";
import { ElectronWorkbench } from "../helpers/ElectronWorkbench.js";
import { localMySQLConnection, quoteIdentifier, uniqueSchemaName } from "../helpers/testConfig.js";

const untitledSqlScriptTab = /^Untitled(?:-\d+)?\.sql$/;
const untitledNotebookTab = /^Untitled(?:-\d+)?\.mysql-notebook$/;

const openSqlScript = async (workbench: ElectronWorkbench, caption: string) => {
    const connection = localMySQLConnection(caption);
    await workbench.createMySQLConnection(connection);
    await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);

    return connection;
};

const openNotebook = async (page: Page, workbench: ElectronWorkbench, caption: string) => {
    const connection = localMySQLConnection(caption);
    await workbench.createMySQLConnection(connection);
    await page.locator("#tilesHost .connectionTile", { hasText: connection.caption })
        .locator("#tileNewNotebookAction")
        .click({ force: true });
    await workbench.expectTabAfterPassword(untitledNotebookTab, connection.password);

    return connection;
};

const resizeWorkbenchContent = async (electronApp: ElectronApplication): Promise<void> => {
    await electronApp.evaluate(({ BrowserWindow }) => {
        const browserWindow = BrowserWindow.getAllWindows()[0];
        browserWindow.setContentSize(920, 680);
    });
};

const createScratchSchemaSql = (schema: string): string[] => {
    return [
        `DROP SCHEMA IF EXISTS ${schema};`,
        `CREATE SCHEMA ${schema};`,
        `USE ${schema};`,
    ];
};

const expectVisualExplainImageResult = async (page: Page, caption?: string,
    expectBottomToolbarVisible = false): Promise<void> => {
    if (caption !== undefined) {
        await expect(page.locator(".resultTabview")).toContainText(caption, { timeout: 30000 });
    }

    await expect(page.locator(".resultTabview .imageResultViewSvg svg#mysqlVisualExplain"))
        .toBeVisible({ timeout: 30000 });

    if (!expectBottomToolbarVisible) {
        return;
    }

    await expect.poll(async () => {
        return page.evaluate(() => {
            const last = <T extends Element>(selector: string, root: ParentNode = document): T | undefined => {
                return [...root.querySelectorAll<T>(selector)].at(-1);
            };
            const host = last<HTMLElement>(".resultHost");
            const status = host ? last<HTMLElement>(".resultStatus", host) : undefined;
            const toolbar = host ? last<HTMLElement>(".resultStatus .toolbar", host) : undefined;
            if (!host || !status || !toolbar) {
                return "missing visual explain status bar";
            }

            const statusRect = status.getBoundingClientRect();
            const toolbarRect = toolbar.getBoundingClientRect();
            const failures: string[] = [];
            const tolerance = 1;

            if (toolbarRect.bottom > statusRect.bottom + tolerance) {
                failures.push("toolbar bottom exceeds status bar");
            }
            if (statusRect.bottom > window.innerHeight + tolerance) {
                failures.push("status bar exceeds viewport");
            }

            let ancestor = status.parentElement;
            while (ancestor) {
                const style = getComputedStyle(ancestor);
                const clipsOverflow = [style.overflowX, style.overflowY].some((overflow) => {
                    return overflow !== "visible";
                });
                if (clipsOverflow) {
                    const ancestorRect = ancestor.getBoundingClientRect();
                    if (statusRect.bottom > ancestorRect.bottom + tolerance) {
                        failures.push(`status bar clipped by ${ancestor.id || ancestor.className || ancestor.tagName}`);
                    }
                }
                if (ancestor === document.body) {
                    break;
                }
                ancestor = ancestor.parentElement;
            }

            return failures.join("; ");
        });
    }, { timeout: 30000 }).toBe("");
};

const visualExplainSvg = (page: Page) => {
    return page.locator(".resultTabview .imageResultViewSvg svg#mysqlVisualExplain").last();
};

const expectVisualExplainSvg = async (page: Page): Promise<void> => {
    const svg = visualExplainSvg(page);

    await expect(svg).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => {
        return svg.evaluate((element) => {
            return {
                height: element.getAttribute("height"),
                hasContent: element.querySelectorAll("path, rect, line, polygon, text").length > 0,
                width: element.getAttribute("width"),
            };
        });
    }, { timeout: 30000 }).toEqual({
        height: expect.any(String),
        hasContent: true,
        width: expect.any(String),
    });
};

const expectVisualExplainButtonSelected = async (page: Page, buttonId: string): Promise<void> => {
    await expect(page.locator(`#${buttonId}`)).toHaveAttribute("aria-checked", "true", { timeout: 30000 });
};

const visualExplainAnalyzeConfirmDialog = (page: Page) => {
    return page.locator(".confirmDialog", {
        has: page.locator("#dialogMessage", {
            hasText: "Explain Analyze will actually execute the selected statement",
        }),
    });
};

const acceptVisualExplainAnalyzeConfirm = async (page: Page, doNotAskAgain = false): Promise<void> => {
    const dialog = visualExplainAnalyzeConfirmDialog(page);
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(dialog.locator(".title label")).toHaveText("Execute Statement");
    if (doNotAskAgain) {
        await dialog.locator("#doNotAskAgain").click();
    }
    await dialog.locator("#accept").click();
    await expect(dialog).toBeHidden({ timeout: 15000 });
};

const expectNoVisualExplainAnalyzeConfirm = async (page: Page): Promise<void> => {
    await expect(visualExplainAnalyzeConfirmDialog(page)).toHaveCount(0, { timeout: 1000 });
};

const restartElectronApp = async (
    electronApp: ElectronApplication,
    testInfo: TestInfo,
): Promise<{ electronApp: ElectronApplication; page: Page; workbench: ElectronWorkbench; }> => {
    await closeElectronApp(electronApp);

    const restartedApp = await launchElectronApp(testInfo);
    const restartedPage = await restartedApp.firstWindow({ timeout: 60000 });
    const restartedWorkbench = new ElectronWorkbench(restartedApp, restartedPage);
    await restartedWorkbench.waitForShell();

    return {
        electronApp: restartedApp,
        page: restartedPage,
        workbench: restartedWorkbench,
    };
};

const visualExplainImageBox = async (page: Page): Promise<{ height: number; width: number; }> => {
    return page.locator(".resultTabview .imageResultViewSvg").last().boundingBox()
        .then((box) => {
            expect(box).not.toBeNull();

            return {
                height: Math.round(box?.height ?? 0),
                width: Math.round(box?.width ?? 0),
            };
        });
};

const zoomVisualExplainUntilMinimapVisible = async (page: Page): Promise<void> => {
    const zoomInButton = page.locator("#visualExplainZoomInButton");
    const minimap = page.locator(".resultTabview .imageResultViewMinimap");
    for (let i = 0; i < 12 && !await minimap.isVisible(); ++i) {
        if (!await zoomInButton.isEnabled()) {
            break;
        }

        await zoomInButton.click();
        await page.waitForTimeout(100);
    }

    await expect(minimap).toBeVisible({ timeout: 15000 });
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
            "CREATE TABLE electron_grid_rows_e2e (id INT AUTO_INCREMENT PRIMARY KEY, label VARCHAR(64));",
            "INSERT INTO electron_grid_rows_e2e VALUES (1, 'base-row');",
            "SELECT * FROM electron_grid_rows_e2e;",
        ].join("\n"));
        await workbench.clickMenu(["Run", "Execute"]);
        await workbench.expectResultGridCellText(0, "label", "base-row");

        await workbench.addResultGridRow({ label: "added-row" });
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

    test("uses SQL script visual explain controls from the native Run menu",
        async ({ electronApp, page, workbench }, testInfo) => {
            await resizeWorkbenchContent(electronApp);
            await workbench.waitForShell();

            await openSqlScript(workbench, "E2E Electron Visual Explain");
            await workbench.insertInActiveEditor("select 1;");

            await workbench.clickMenu(["Run", "Visual Explain"]);

            await expectVisualExplainImageResult(page, "Visual Explain", true);
            await expectVisualExplainSvg(page);
            await expectVisualExplainButtonSelected(page, "visualExplainLayoutBottomUpButton");
            await expectVisualExplainButtonSelected(page, "visualExplainDetailsMediumButton");

            await page.locator("#visualExplainLayoutTopDownButton").click();
            await expectVisualExplainButtonSelected(page, "visualExplainLayoutTopDownButton");
            await expectVisualExplainSvg(page);

            await page.locator("#visualExplainLayoutBottomUpButton").click();
            await expectVisualExplainButtonSelected(page, "visualExplainLayoutBottomUpButton");
            await expectVisualExplainSvg(page);

            await page.locator("#visualExplainDetailsMinimalButton").click();
            await expectVisualExplainButtonSelected(page, "visualExplainDetailsMinimalButton");
            await expectVisualExplainSvg(page);

            await page.locator("#visualExplainDetailsFullButton").click();
            await expectVisualExplainButtonSelected(page, "visualExplainDetailsFullButton");
            await expectVisualExplainSvg(page);

            await page.locator("#visualExplainDetailsMediumButton").click();
            await expectVisualExplainButtonSelected(page, "visualExplainDetailsMediumButton");
            await expectVisualExplainSvg(page);

            const originalBox = await visualExplainImageBox(page);
            await page.locator("#visualExplainZoomInButton").click();
            await expect(page.locator("#visualExplainResetZoomButton")).toBeEnabled({ timeout: 15000 });
            await expect.poll(async () => {
                return (await visualExplainImageBox(page)).height;
            }, { timeout: 15000 }).toBeGreaterThan(originalBox.height);
            await expect.poll(async () => {
                return (await visualExplainImageBox(page)).width;
            }, { timeout: 15000 }).toBeGreaterThan(originalBox.width);

            await page.locator("#visualExplainZoomOutButton").click();
            await expect.poll(async () => {
                return visualExplainImageBox(page);
            }, { timeout: 15000 }).toEqual(originalBox);

            await page.locator("#visualExplainZoomInButton").click();
            await page.locator("#visualExplainResetZoomButton").click();
            await expect.poll(async () => {
                return visualExplainImageBox(page);
            }, { timeout: 15000 }).toEqual(originalBox);

            const minimap = page.locator(".resultTabview .imageResultViewMinimap");
            await zoomVisualExplainUntilMinimapVisible(page);
            await workbench.clickResultActionMenuItem(["Show Minimap"]);
            await expect(minimap).toBeHidden({ timeout: 15000 });
            await workbench.clickResultActionMenuItem(["Show Minimap"]);
            await expect(minimap).toBeVisible({ timeout: 15000 });

            const imagePath = join(testInfo.outputDir, "visual-explain-select-1.svg");
            await workbench.stubSaveDialog(imagePath);
            await workbench.clickResultActionMenuItem(["Save Image..."]);
            await expect.poll(async () => {
                return readFile(imagePath, "utf8").catch(() => {
                    return "";
                });
            }, { timeout: 15000 }).toContain('id="mysqlVisualExplain"');

            await workbench.clickResultActionMenuItem(["Close Result Set"]);
            await expect(visualExplainSvg(page)).toBeHidden({ timeout: 15000 });

            await workbench.clickMenu(["Run", "Visual Explain Analyze"]);
            await acceptVisualExplainAnalyzeConfirm(page);
            await expectVisualExplainImageResult(page);
            await expectVisualExplainSvg(page);
        });

    test("renders and saves notebook visual explain results from the native Run menu",
        async ({ electronApp, page, workbench }, testInfo) => {
            await resizeWorkbenchContent(electronApp);
            await workbench.waitForShell();

            const connection = await openNotebook(page, workbench, "E2E Electron Notebook Visual Explain");
            await workbench.insertInActiveEditor("select 1;");

            await workbench.clickMenu(["Run", "Visual Explain"]);
            await expectVisualExplainImageResult(page);
            await expectVisualExplainSvg(page);

            await page.keyboard.press("Enter");
            await workbench.insertInActiveEditor("select 2;");

            await workbench.clickMenu(["Run", "Visual Explain Analyze"]);
            await acceptVisualExplainAnalyzeConfirm(page, true);
            await expectVisualExplainImageResult(page);
            await expectVisualExplainSvg(page);
            await workbench.expectEditorText("select 1;");
            await workbench.expectEditorText("select 2;");

            const restarted = await restartElectronApp(electronApp, testInfo);
            try {
                await restarted.page.locator("#tilesHost .connectionTile", { hasText: connection.caption })
                    .locator("#tileNewNotebookAction")
                    .click({ force: true });
                await restarted.workbench.expectTabAfterPassword(untitledNotebookTab, connection.password);
                await restarted.workbench.insertInActiveEditor("select 2;");
                await restarted.workbench.clickMenu(["Run", "Visual Explain Analyze"]);
                await expectNoVisualExplainAnalyzeConfirm(restarted.page);
                await expectVisualExplainImageResult(restarted.page);
                await expectVisualExplainSvg(restarted.page);
                await expectNoVisualExplainAnalyzeConfirm(restarted.page);

                const imagePath = join(testInfo.outputDir, "notebook-visual-explain-select-2.svg");
                await restarted.workbench.stubSaveDialog(imagePath);
                await restarted.workbench.clickResultActionMenuItem(["Save Image..."]);
                await expect.poll(async () => {
                    return readFile(imagePath, "utf8").catch(() => {
                        return "";
                    });
                }, { timeout: 15000 }).toContain('id="mysqlVisualExplain"');
            } finally {
                await closeElectronApp(restarted.electronApp);
            }
        });

    test("executes a DB Notebook through the native Run command", async ({ page, workbench }) => {
        await workbench.waitForShell();

        await openNotebook(page, workbench, "E2E Electron Notebook Execution");
        await workbench.insertInActiveEditor("SELECT 'electron-notebook-run' AS notebook_value;");

        await workbench.clickMenu(["Run", "Execute"]);

        await workbench.expectResultGridText("electron-notebook-run");
    });
});
