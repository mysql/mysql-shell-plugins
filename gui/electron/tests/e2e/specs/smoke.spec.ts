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

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { test, expect } from "../fixtures/electron.js";

test.describe("Electron desktop shell", () => {
    test("launches the desktop host and exposes the native bridges", async ({ page, workbench }) => {
        await workbench.waitForShell();

        await expect(page.locator("#root")).toHaveClass(/electronDesktopHost/);
        await expect(page.locator("#desktopSidebarPane")).toBeVisible();
        await expect(page.locator(".frontPage")).toContainText("Welcome to MySQL Workbench");
        await expect(page.locator("#contentTitle")).toHaveText("Database Connections");
        await expect(page.locator("#newConnectionButton")).toBeVisible();
        await expect(page.locator("#tilesHost")).toBeVisible();
        await expect(page.locator("#floatingStatusDock")).toHaveCount(0);

        const bridges = await page.evaluate(() => {
            return {
                host: Boolean(window.electronHost),
                backend: Boolean(window.electronDesktopBackend),
            };
        });

        expect(bridges).toEqual({ host: true, backend: true });

        const menuLabels = await workbench.menuLabels();
        expect(menuLabels).toEqual(expect.arrayContaining(["File", "Edit", "View", "Run", "Database", "Window", "Help"]));
    });

    test("keeps the renderer viewport aligned with the native content area", async ({ electronApp, page }) => {
        const nativeContentSize = await electronApp.evaluate(({ BrowserWindow }) => {
            const browserWindow = BrowserWindow.getAllWindows()[0];

            return browserWindow.getContentSize();
        });
        const viewportSize = page.viewportSize();
        const rendererSize = await page.evaluate(() => {
            return {
                width: window.innerWidth,
                height: window.innerHeight,
            };
        });

        expect(viewportSize).toBeNull();
        expect(rendererSize).toEqual({
            width: nativeContentSize[0],
            height: nativeContentSize[1],
        });
    });

    test("uses isolated Electron user data for desktop state", async ({ electronApp }, testInfo) => {
        const userDataPath = await electronApp.evaluate(({ app }) => {
            return app.getPath("userData");
        });

        expect(userDataPath).toBe(testInfo.outputPath("electron-user-data"));
    });

    test("writes to the system clipboard from the renderer", async ({ page, workbench }) => {
        await workbench.waitForShell();

        const previousText = await workbench.readSystemClipboardText();
        const clipboardText = `electron-smoke-clipboard-${Date.now()}`;

        try {
            await page.evaluate((text) => {
                return navigator.clipboard.writeText(text);
            }, clipboardText);

            await expect.poll(async () => {
                return workbench.readSystemClipboardText();
            }, { timeout: 15000 }).toBe(clipboardText);
        } finally {
            await workbench.writeSystemClipboardText(previousText);
        }
    });

    test("opens mysqlsh.log in a sandboxed file viewer window", async ({ electronApp, workbench }, testInfo) => {
        await workbench.waitForShell();

        const marker = `electron-log-viewer-${Date.now()}`;
        const logPath = testInfo.outputPath("mysqlsh-user-config", "mysqlsh.log");
        await mkdir(dirname(logPath), { recursive: true });
        await writeFile(logPath, `Log viewer marker: ${marker}\n`, "utf8");

        const fileViewerPagePromise = electronApp.waitForEvent("window");
        await workbench.clickMenu(["View", "Developer", "Open mysqlsh.log File"]);
        const fileViewerPage = await fileViewerPagePromise;

        await expect(fileViewerPage.locator(".fileViewer")).toBeVisible({ timeout: 15000 });
        await expect(fileViewerPage.locator(".fileViewerContent")).toHaveValue(new RegExp(marker), {
            timeout: 15000,
        });
        await expect(fileViewerPage.locator(".fileViewerStatus")).toContainText("loaded");

        const bridgeState = await fileViewerPage.evaluate(() => {
            const fileViewerWindow = window as unknown as {
                electronHost?: unknown;
                fileViewer?: unknown;
                require?: unknown;
            };

            return {
                electronHost: Boolean(fileViewerWindow.electronHost),
                fileViewer: Boolean(fileViewerWindow.fileViewer),
                requireType: typeof fileViewerWindow.require,
            };
        });

        expect(bridgeState).toEqual({
            electronHost: false,
            fileViewer: true,
            requireType: "undefined",
        });
    });
});
