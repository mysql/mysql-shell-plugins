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
import { localMySQLConnection } from "../helpers/testConfig.js";

test.describe("Database connection overview", () => {
    test("validates required MySQL connection fields", async ({ workbench }) => {
        await workbench.waitForShell();

        const dialog = await workbench.openConnectionDialog();
        await dialog.locator("#userName input, input#userName").fill("");
        await dialog.locator("#ok").click();

        await expect(dialog.locator(".message.error")).toContainText("The user name must not be empty");
        await expect(dialog.locator("#caption input, input#caption")).toHaveValue(/New Connection/);
        await expect(dialog.locator("#hostName input, input#hostName")).toHaveValue("localhost");

        await dialog.locator("#cancel").click();
        await expect(dialog).toBeHidden();
    });

    test("creates a local MySQL connection tile from the desktop host", async ({ page, workbench }) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Connection");
        await workbench.createMySQLConnection(connection);

        await expect(page.locator("#tilesHost .connectionTile", {
            hasText: connection.caption,
        })).toBeVisible();
    });

    test("tests a password authentication factor through the backend prompt", async ({ page, workbench }) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E backend password prompt");
        await workbench.createMySQLConnection(connection);
        await workbench.selectConnectionTileAction(connection.caption, ["Edit Connection…"]);

        const dialog = page.locator(".visible.valueEditDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await dialog.locator("#advanced-btn").click();

        const visiblePasswordDialogs = page.locator(".passwordDialog:visible");
        await expect(visiblePasswordDialogs).toHaveCount(1, { timeout: 15000 });
        expect(await workbench.submitPasswordIfRequested(connection.password)).toBe(true);
        await expect(page.locator(".notificationCenter .toast.info")).toContainText(
            "Connection test succeeded.",
            { timeout: 15000 },
        );
        await workbench.settlePasswordPrompts(connection.password);
        await expect(visiblePasswordDialogs).toHaveCount(0);

        await dialog.locator("#cancel").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });
    });

    test("round-trips an ordered MFA connection profile through storage", async ({ page, workbench }) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E MFA connection persistence");
        const pluginDirectory = "/tmp/e2e-mfa-client-plugins";
        await workbench.createMySQLConnection(connection);
        await workbench.selectConnectionTileAction(connection.caption, ["Edit Connection…"]);

        let dialog = page.locator(".visible.valueEditDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await dialog.locator(".tabItem", { hasText: "Authentication" }).click();

        const selectFactor = async (factor: string, plugin: string): Promise<void> => {
            await dialog.locator(`#${factor}`).click();
            const popup = page.locator(`#${factor}Popup`);
            await expect(popup).toBeVisible();
            await popup.locator(".dropdownItem", { hasText: plugin }).click();
            await expect(dialog.locator(`#${factor}`)).toContainText(plugin);
        };

        await selectFactor("factor2", "authentication_webauthn");
        await selectFactor("factor3", "authentication_ldap_simple");
        await dialog.locator("#webauthnDevice input, input#webauthnDevice").fill("2");
        await dialog.locator("#webauthnPreservePrivacy").click();
        await dialog.locator("#pluginDir input, input#pluginDir").fill(pluginDirectory);
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });

        await workbench.selectConnectionTileAction(connection.caption, ["Edit Connection…"]);
        dialog = page.locator(".visible.valueEditDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await dialog.locator(".tabItem", { hasText: "Authentication" }).click();

        await expect(dialog.locator("#factor1")).toContainText("password");
        await expect(dialog.locator("#factor2")).toContainText("authentication_webauthn");
        await expect(dialog.locator("#factor3")).toContainText("authentication_ldap_simple");
        await expect(dialog.locator("#webauthnDevice input, input#webauthnDevice")).toHaveValue("2");
        await expect(dialog.locator("#webauthnPreservePrivacy")).toHaveClass(/checked/);
        await expect(dialog.locator("#pluginDir input, input#pluginDir")).toHaveValue(pluginDirectory);

        await dialog.locator("#cancel").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });
    });

    test("edits, duplicates, and deletes MySQL connections from tile actions", async ({ page, workbench }) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron CRUD");
        const duplicateCaption = "E2E Electron CRUD Copy";
        const editedCaption = "E2E Electron CRUD Edited";
        await workbench.createMySQLConnection(connection);

        await workbench.selectConnectionTileAction(connection.caption, ["Duplicate Connection…"]);
        let dialog = page.locator(".visible.valueEditDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await dialog.locator("#caption input, input#caption").fill(duplicateCaption);
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });
        await workbench.expectConnectionTile(duplicateCaption);

        await workbench.selectConnectionTileAction(duplicateCaption, ["Edit Connection…"]);
        dialog = page.locator(".visible.valueEditDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await expect(dialog.locator("#caption input, input#caption")).toHaveValue(duplicateCaption);
        await dialog.locator("#caption input, input#caption").fill(editedCaption);
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });
        await workbench.expectNoConnectionTile(duplicateCaption);
        await workbench.expectConnectionTile(editedCaption);

        await workbench.selectConnectionTileAction(editedCaption, ["Delete Connection…"]);
        await workbench.acceptConfirmDialog();
        await workbench.expectNoConnectionTile(editedCaption);
        await workbench.expectConnectionTile(connection.caption);
    });

    test("moves connections between overview folders", async ({ workbench }) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Foldered Connection");
        const folderName = "E2E Electron Folder";
        await workbench.createMySQLConnection(connection);
        await workbench.createConnectionFolder(folderName);

        await workbench.selectConnectionTileAction(connection.caption, ["Move to Folder", `/${folderName}`]);
        await workbench.expectNoConnectionTile(connection.caption);
        await workbench.openConnectionFolder(folderName);
        await workbench.expectConnectionTile(connection.caption);

        await workbench.selectConnectionTileAction(connection.caption, ["Move to Folder", "/"]);
        await workbench.expectNoConnectionTile(connection.caption);
        await workbench.goToRootConnectionFolder();
        await workbench.expectConnectionTile(connection.caption);

        await workbench.selectGroupTileAction(folderName, ["Delete Folder…"]);
        await workbench.expectNoConnectionTile(folderName);
    });

    test("creates folders while moving a connection from the tile menu", async ({ workbench }) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Move New Folder");
        const folderName = "E2E Electron Move Target";
        await workbench.createMySQLConnection(connection);

        await workbench.selectConnectionTileAction(connection.caption, ["Move to Folder", "New Folder…"]);
        await workbench.submitPrompt(folderName);

        await workbench.expectNoConnectionTile(connection.caption);
        await workbench.openConnectionFolder(folderName);
        await workbench.expectConnectionTile(connection.caption);
    });
});
