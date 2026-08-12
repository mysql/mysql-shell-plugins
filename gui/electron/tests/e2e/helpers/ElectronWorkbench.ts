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

import { expect, type Locator, type Page } from "@playwright/test";
import type { ElectronApplication, ElementHandle } from "playwright";

export interface IMenuItemSnapshot {
    label: string;
    enabled: boolean;
    checked?: boolean;
    submenu?: IMenuItemSnapshot[];
}

export interface INativeMenuItemSnapshot {
    id: string;
    label?: string;
    enabled?: boolean;
    checked?: boolean;
    submenu?: INativeMenuItemSnapshot[];
    type?: "normal" | "separator";
}

export interface INativeMenuRequestSnapshot {
    id: string;
    items: INativeMenuItemSnapshot[];
}

export interface ITestConnection {
    caption: string;
    host: string;
    port: string;
    user: string;
    password: string;
    schema: string;
    sslMode?: string;
}

export class ElectronWorkbench {
    public constructor(
        private readonly electronApp: ElectronApplication,
        public readonly page: Page,
    ) {
    }

    public async waitForShell(): Promise<void> {
        await expect(this.page.locator("#root")).toHaveClass(/electronDesktopHost/, { timeout: 60000 });
        await this.page.waitForFunction(() => {
            const desktopWindow = window as unknown as {
                electronHost?: unknown;
                electronDesktopBackend?: unknown;
            };

            return Boolean(desktopWindow.electronHost && desktopWindow.electronDesktopBackend);
        }, undefined, { timeout: 60000 });
        await expect(this.page.locator("#desktopSidebarPane")).toBeVisible({ timeout: 60000 });
        await expect(this.page.locator(".connectionBrowser")).toContainText("Welcome to MySQL Workbench", {
            timeout: 60000,
        });
        await expect(this.page.locator("#newConnectionButton")).toBeVisible({ timeout: 60000 });
        await expect(this.page.locator("#tilesHost")).toBeVisible({ timeout: 60000 });
        await this.waitForMenuItem(["File", "Open..."], { timeout: 60000 });
    }

    public async waitForLegacyConfigurationImportWizard(): Promise<Locator> {
        const wizard = this.page.locator("#legacyConfigurationImportWizard");
        await expect(wizard).toBeVisible({ timeout: 60000 });

        return wizard;
    }

    public async openLegacyConfigurationImportWizard(): Promise<Locator> {
        await this.waitForShell();
        const openButton = this.page.locator("#openLegacyConfigurationImportWizard");
        await expect(openButton).toBeVisible({ timeout: 60000 });
        await openButton.click();

        return this.waitForLegacyConfigurationImportWizard();
    }

    public async expectLegacyConfigurationImportPage(heading: string): Promise<Locator> {
        const wizard = await this.waitForLegacyConfigurationImportWizard();
        await expect(wizard.locator(".legacyConfigurationImportPage h2")).toHaveText(heading);

        return wizard;
    }

    public async advanceLegacyConfigurationImportWizard(): Promise<void> {
        const wizard = await this.waitForLegacyConfigurationImportWizard();
        await wizard.locator("#legacyConfigurationImportNext").click();
    }

    public async startLegacyConfigurationImport(): Promise<void> {
        const wizard = await this.waitForLegacyConfigurationImportWizard();
        await wizard.locator("#legacyConfigurationImportStart").click();
    }

    public async closeLegacyConfigurationImportWizard(): Promise<void> {
        const wizard = await this.waitForLegacyConfigurationImportWizard();
        await wizard.locator("#legacyConfigurationImportClose").click();
        await expect(wizard).toBeHidden();
    }

    public async cancelLegacyConfigurationImportWizard(): Promise<void> {
        const wizard = await this.waitForLegacyConfigurationImportWizard();
        await wizard.locator("#legacyConfigurationImportCancel").click();
        await expect(wizard).toBeHidden();
    }

    public async menuLabels(): Promise<string[]> {
        return this.electronApp.evaluate(({ Menu }) => {
            return Menu.getApplicationMenu()?.items.map((item) => {
                return item.label;
            }) ?? [];
        });
    }

    public async menuSnapshot(): Promise<IMenuItemSnapshot[]> {
        return this.electronApp.evaluate(({ Menu }) => {
            const serialize = (item: Electron.MenuItem): IMenuItemSnapshot => {
                return {
                    label: item.label,
                    enabled: item.enabled,
                    checked: item.checked,
                    submenu: item.submenu?.items.map(serialize),
                };
            };

            return Menu.getApplicationMenu()?.items.map(serialize) ?? [];
        });
    }

    public async clickMenu(menuPath: string[]): Promise<void> {
        await this.waitForMenuItem(menuPath, { enabled: true });
        await this.electronApp.evaluate(({ BrowserWindow, Menu }, path) => {
            const normalizeLabel = (value: string) => {
                return value.replace(/&/g, "").replace(/\s+/g, " ").trim();
            };
            let submenu: Electron.Menu | undefined = Menu.getApplicationMenu() ?? undefined;
            let selected: Electron.MenuItem | undefined;

            for (const label of path) {
                selected = submenu?.items.find((item) => {
                    return normalizeLabel(item.label) === normalizeLabel(label);
                });
                if (!selected) {
                    throw new Error(`Could not find native menu item: ${path.join(" > ")}`);
                }

                submenu = selected.submenu ?? undefined;
            }

            if (!selected?.enabled) {
                throw new Error(`Native menu item is disabled: ${path.join(" > ")}`);
            }

            selected.click(undefined, BrowserWindow.getAllWindows()[0]);
        }, menuPath);
    }

    public async waitForMenuItem(
        menuPath: string[],
        options: { enabled?: boolean; timeout?: number } = {},
    ): Promise<IMenuItemSnapshot> {
        const timeout = options.timeout ?? 15000;
        let menuItem: IMenuItemSnapshot | undefined;

        await expect.poll(async () => {
            menuItem = this.findMenuItem(await this.menuSnapshot(), menuPath);
            if (!menuItem) {
                return "missing";
            }

            if (options.enabled === undefined) {
                return "ready";
            }

            return menuItem.enabled === options.enabled ? "ready" : "disabled";
        }, { timeout }).toBe("ready");

        return menuItem!;
    }

    public async tabLabels(): Promise<string[]> {
        return this.page.locator(".tabArea .tabItem .tabCaption").evaluateAll((captions) => {
            return captions.map((caption) => {
                return caption.textContent?.trim() ?? "";
            }).filter((label) => {
                return label.length > 0;
            });
        });
    }

    public async expectTab(label: RegExp | string): Promise<void> {
        await expect.poll(async () => {
            return this.hasTab(label);
        }, { timeout: 15000 }).toBe(true);
    }

    public async expectNoTab(label: RegExp | string): Promise<void> {
        await expect.poll(async () => {
            return this.hasTab(label);
        }, { timeout: 15000 }).toBe(false);
    }

    public async selectTab(label: RegExp | string): Promise<void> {
        const tab = this.page.locator(".tabArea .tabItem", {
            has: this.page.locator(".tabCaption", {
                hasText: typeof label === "string" ? this.exactText(label) : label,
            }),
        }).first();
        await tab.click();
    }

    public async expectVisibleWithoutPassword(
        locator: Locator,
        description = "target element",
        timeout = 45000,
    ): Promise<void> {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            await this.failOnPasswordPrompt(`waiting for ${description}`);

            if (await this.waitForVisible(locator, 250)) {
                return;
            }

            const errorMessage = await this.visibleErrorMessage();
            if (errorMessage) {
                throw new Error(`Workbench reported an error while waiting for ${description}: ${errorMessage}`);
            }

            await this.page.waitForTimeout(250);
        }

        throw new Error(`Timed out waiting for ${description}. Open tabs: ` +
            `${(await this.tabLabels()).join(", ") || "<none>"}`);
    }

    public async expectVisibleAfterPassword(
        locator: Locator,
        password: string,
        description = "target element",
        timeout = 45000,
    ): Promise<void> {
        const deadline = Date.now() + timeout;
        let submittedPassword = false;

        while (Date.now() < deadline) {
            if (await this.passwordPromptVisible(250)) {
                if (submittedPassword) {
                    throw new Error(`Unexpected repeated password prompt while waiting for ${description}.`);
                }

                await this.submitPasswordIfRequested(password);
                submittedPassword = true;
            }

            if (await this.waitForVisible(locator, 250)) {
                await this.settlePasswordPrompts(password);

                return;
            }

            const errorMessage = await this.visibleErrorMessage();
            if (errorMessage) {
                throw new Error(`Workbench reported an error while waiting for ${description}: ${errorMessage}`);
            }

            await this.page.waitForTimeout(250);
        }

        throw new Error(`Timed out waiting for ${description}. Open tabs: ` +
            `${(await this.tabLabels()).join(", ") || "<none>"}`);
    }

    public async expectTabAfterPassword(label: RegExp | string, password: string, timeout = 45000): Promise<void> {
        const deadline = Date.now() + timeout;
        let submittedPassword = false;

        while (Date.now() < deadline) {
            if (await this.passwordPromptVisible(250)) {
                if (submittedPassword) {
                    throw new Error(`Unexpected repeated password prompt while waiting for ` +
                        `${this.formatTabLabel(label)}.`);
                }

                await this.submitPasswordIfRequested(password);
                submittedPassword = true;
            }

            if (await this.hasTab(label)) {
                await this.settlePasswordPrompts(password);

                return;
            }

            const errorMessage = await this.visibleErrorMessage();
            if (errorMessage) {
                throw new Error(`Workbench reported an error while waiting for ${this.formatTabLabel(label)}: ` +
                    errorMessage);
            }

            await this.page.waitForTimeout(250);
        }

        throw new Error(`Timed out waiting for ${this.formatTabLabel(label)}. Open tabs: ` +
            `${(await this.tabLabels()).join(", ") || "<none>"}`);
    }

    public async expectTabWithoutPassword(label: RegExp | string, timeout = 45000): Promise<void> {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            await this.failOnPasswordPrompt(`waiting for ${this.formatTabLabel(label)}`);

            if (await this.hasTab(label)) {
                return;
            }

            const errorMessage = await this.visibleErrorMessage();
            if (errorMessage) {
                throw new Error(`Workbench reported an error while waiting for ${this.formatTabLabel(label)}: ` +
                    errorMessage);
            }

            await this.page.waitForTimeout(250);
        }

        throw new Error(`Timed out waiting for ${this.formatTabLabel(label)}. Open tabs: ` +
            `${(await this.tabLabels()).join(", ") || "<none>"}`);
    }

    public async submitPasswordIfRequested(password: string): Promise<boolean> {
        const dialog = this.page.locator(".passwordDialog").first();
        if (!await this.waitForVisible(dialog, 250)) {
            return false;
        }

        const dialogElement = await dialog.elementHandle();
        await dialog.locator("input").fill(password);
        await dialog.locator("#ok").click();
        await this.waitForDialogElementHidden(dialogElement, 15000);
        await this.refusePasswordStorageIfRequested();

        return true;
    }

    public async openConnectionDialog(): Promise<Locator> {
        await this.page.locator("#newConnectionButton").click();
        const dialog = this.page.locator(".visible.valueEditDialog");
        await expect(dialog).toBeVisible();

        return dialog;
    }

    public async createMySQLConnection(connection: ITestConnection): Promise<void> {
        const dialog = await this.openConnectionDialog();
        await this.setInput(dialog.locator("#caption input, input#caption"), connection.caption);
        await this.setInput(dialog.locator("#hostName input, input#hostName"), connection.host);
        await this.setInput(dialog.locator("#userName input, input#userName"), connection.user);
        await this.setInput(dialog.locator("#port input, input#port"), connection.port);
        await this.setInput(dialog.locator("#defaultSchema input, input#defaultSchema"), connection.schema);
        if (connection.sslMode) {
            await dialog.locator(".tabItem", { hasText: "TLS" }).click();
            await dialog.locator("#sslMode").click();
            await this.page.locator("#sslModePopup .dropdownItem", {
                hasText: this.exactText(connection.sslMode),
            }).click();
        }
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });
        await expect(this.page.locator("#tilesHost .connectionTile", {
            hasText: connection.caption,
        })).toBeVisible({ timeout: 15000 });
    }

    public connectionTile(caption: string): Locator {
        return this.page.locator("#tilesHost .connectionTile", {
            has: this.page.locator(".tileCaption", { hasText: this.exactText(caption) }),
        }).first();
    }

    public async expectConnectionTile(caption: string): Promise<void> {
        await expect(this.connectionTile(caption)).toBeVisible({ timeout: 15000 });
    }

    public async expectNoConnectionTile(caption: string): Promise<void> {
        await expect(this.page.locator("#tilesHost .connectionTile", {
            has: this.page.locator(".tileCaption", { hasText: this.exactText(caption) }),
        })).toHaveCount(0, {
            timeout: 15000,
        });
    }

    public async createConnectionFolder(folderName: string): Promise<void> {
        await this.page.locator("#newFolderButton").click();
        await this.submitPrompt(folderName);
        await this.expectConnectionTile(folderName);
    }

    public async openConnectionFolder(folderName: string): Promise<void> {
        await this.connectionTile(folderName).click();
        await expect(this.page.locator("#tilesHost .connectionTile.back")).toBeVisible({ timeout: 15000 });
    }

    public async goToRootConnectionFolder(): Promise<void> {
        const backTile = this.page.locator("#tilesHost .connectionTile.back").first();
        if (await this.waitForVisible(backTile, 500)) {
            await backTile.click();
            await expect(backTile).toHaveCount(0, { timeout: 15000 });
        }
    }

    public async selectConnectionTileAction(caption: string, menuPath: string[]): Promise<void> {
        await this.selectTileMenuAction(this.connectionTile(caption), menuPath);
    }

    public async selectPopupMenuAction(target: Locator, menuPath: string[]): Promise<void> {
        await this.installNativeMenuInterceptor();
        await this.clearNativeMenuRequest();
        await expect(target).toBeVisible({ timeout: 15000 });
        await target.click();

        await this.selectNativeMenuPath(menuPath);
    }

    public async openSqlScriptFromConnectionTile(caption: string, password: string,
        label: string | RegExp = /^Untitled(?:-\d+)?\.sql$/): Promise<void> {
        await this.selectConnectionTileAction(caption, ["Connect with New SQL Script"]);
        await this.expectTabAfterPassword(label, password);
    }

    public async selectGroupTileAction(caption: string, menuPath: string[]): Promise<void> {
        await this.selectTileMenuAction(this.connectionTile(caption), menuPath);
    }

    public async selectUserAccountRowAction(row: Locator, menuPath: string[]): Promise<void> {
        await this.installNativeMenuInterceptor();
        await this.clearNativeMenuRequest();

        await expect(row).toBeVisible({ timeout: 15000 });
        await row.hover();
        await row.locator("[data-tooltip='More Actions']").click();

        await this.selectNativeMenuPath(menuPath);
    }

    public async selectUserAccountRowContextMenuAction(row: Locator, menuPath: string[]): Promise<void> {
        await this.installNativeMenuInterceptor();
        await this.clearNativeMenuRequest();

        await expect(row).toBeVisible({ timeout: 15000 });
        const userCell = row.locator(".tabulator-cell[tabulator-field='user']");
        await expect(userCell).toBeVisible({ timeout: 15000 });
        await userCell.click({ button: "right" });

        await this.selectNativeMenuPath(menuPath);
    }

    public async acceptConfirmDialog(): Promise<void> {
        const dialog = this.page.locator(".confirmDialog").first();
        await expect(dialog).toBeVisible({ timeout: 15000 });
        const dialogElement = await dialog.elementHandle();
        await dialog.locator("#accept").evaluate((button: HTMLElement) => {
            button.click();
        });
        await this.waitForDialogElementHidden(dialogElement, 15000);
    }

    public async closeActiveTabDiscardingChanges(): Promise<void> {
        await this.clickMenu(["File", "Close Tab"]);

        const dialog = this.page.locator(".confirmDialog").first();
        if (!await this.waitForVisible(dialog, 1000)) {
            return;
        }

        const dialogText = await dialog.innerText();
        if (!/unsaved changes/i.test(dialogText)) {
            throw new Error(`Unexpected confirmation while closing a tab: ${dialogText}`);
        }

        const dialogElement = await dialog.elementHandle();
        await dialog.locator("#accept").evaluate((button: HTMLElement) => {
            button.click();
        });
        await this.waitForDialogElementHidden(dialogElement, 15000);
    }

    public async submitPrompt(value: string): Promise<void> {
        const dialog = this.page.locator(".visible.valueEditDialog").first();
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await this.setInput(dialog.locator("#input input, input#input"), value);
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });
    }

    public async stubOpenDialog(filePaths: string[]): Promise<void> {
        await this.electronApp.evaluate(({ dialog }, paths) => {
            const dialogApi = dialog as unknown as {
                showOpenDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
            };

            dialogApi.showOpenDialog = async () => {
                return { canceled: false, filePaths: paths };
            };
        }, filePaths);
    }

    public async stubSaveDialog(filePath: string): Promise<void> {
        await this.electronApp.evaluate(({ dialog }, targetPath) => {
            const dialogApi = dialog as unknown as {
                showSaveDialog: () => Promise<{ canceled: boolean; filePath: string }>;
            };

            dialogApi.showSaveDialog = async () => {
                return { canceled: false, filePath: targetPath };
            };
        }, filePath);
    }

    public async writeInActiveEditor(text: string): Promise<void> {
        const editor = this.page.locator(".monaco-editor").last();
        await expect(editor).toBeVisible({ timeout: 15000 });
        const textArea = editor.locator("textarea.inputarea").first();
        await editor.click({ position: { x: 40, y: 20 }, force: true });
        await textArea.focus();
        await this.page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
        await this.page.keyboard.press("Backspace");
        await this.page.keyboard.insertText(text);
    }

    public async insertInActiveEditor(text: string): Promise<void> {
        const editor = this.page.locator(".monaco-editor").last();
        await expect(editor).toBeVisible({ timeout: 15000 });
        const textArea = editor.locator("textarea.inputarea").first();
        await editor.click({ position: { x: 40, y: 20 }, force: true });
        await textArea.focus();
        await this.page.keyboard.insertText(text);
    }

    public async expectEditorText(text: string): Promise<void> {
        await expect(this.page.locator(".monaco-editor")).toContainText(text, { timeout: 15000 });
    }

    public async expectResultGridText(text: string | RegExp): Promise<void> {
        await expect(this.page.locator(".resultTabview .resultView")).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => {
            const tabViewsText = await this.page.locator(".resultTabview").evaluateAll((elements) => {
                return elements.map((element) => {
                    return element.textContent ?? "";
                });
            });

            return tabViewsText.some((entry) => {
                return text instanceof RegExp ? text.test(entry) : entry.includes(text);
            });
        }, { timeout: 30000 }).toBe(true);
    }

    public resultGrid(): Locator {
        return this.page.locator(".resultTabview .resultView").last();
    }

    public resultHost(): Locator {
        return this.page.locator(".resultHost").last();
    }

    public async clickResultActionMenuItem(menuPath: string[]): Promise<void> {
        await this.page.keyboard.press("Escape");
        await this.installNativeMenuInterceptor();
        await this.clearNativeMenuRequest();

        await this.page.locator(".resultHost #showActionMenu").last().click();
        await this.selectNativeMenuPath(menuPath);
    }

    public async resultGridCell(rowIndex: number, columnTitle: string): Promise<Locator> {
        const field = await this.resultGridColumnField(columnTitle);
        const row = rowIndex === -1
            ? this.resultGrid().locator(".tabulator-row.added").last()
            : this.resultGrid().locator(".tabulator-row").nth(rowIndex);

        return row.locator(`.tabulator-cell[tabulator-field="${this.cssAttributeValue(field)}"]`);
    }

    public async expectResultGridCellText(rowIndex: number, columnTitle: string,
        expected: string | RegExp): Promise<void> {
        await expect(await this.resultGridCell(rowIndex, columnTitle)).toContainText(expected, { timeout: 15000 });
    }

    public async editResultGridCell(rowIndex: number, columnTitle: string, value: string): Promise<void> {
        const cell = await this.resultGridCell(rowIndex, columnTitle);
        await expect(cell).toBeVisible({ timeout: 15000 });
        await expect.poll(async () => {
            return (await cell.getAttribute("class"))?.includes("tabulator-editable") ?? false;
        }, { timeout: 15000 }).toBe(true);

        await cell.evaluate((element: HTMLElement) => {
            element.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
        });

        const editor = cell.locator("input, textarea").first();
        if (!await this.waitForVisible(editor, 1000)) {
            await cell.click({ force: true });
            await this.page.keyboard.press("Enter");
        }
        await expect(editor).toBeVisible({ timeout: 15000 });
        await editor.fill(value);
        await this.page.keyboard.press("Enter");
        await expect(cell).toHaveClass(/changed/, { timeout: 15000 });
    }

    public async addResultGridRow(values: Record<string, string>): Promise<void> {
        await expect.poll(async () => {
            const buttonClass = await this.resultGrid().locator("#addNewRow").getAttribute("class").catch(() => {
                return "";
            });

            return buttonClass?.includes("disabled") === false;
        }, { timeout: 15000 }).toBe(true);
        await this.resultGrid().locator("#addNewRow").evaluate((button: HTMLElement) => {
            button.click();
        });
        await expect(this.resultGrid().locator(".tabulator-row.added")).toBeVisible({ timeout: 15000 });

        for (const [columnTitle, value] of Object.entries(values)) {
            const cell = await this.resultGridCell(-1, columnTitle);
            await expect(cell).toBeVisible({ timeout: 15000 });
            await expect.poll(async () => {
                return (await cell.getAttribute("class"))?.includes("tabulator-editable") ?? false;
            }, { timeout: 15000 }).toBe(true);
            await cell.evaluate((element: HTMLElement) => {
                element.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
            });
            const editor = cell.locator("input, textarea").first();
            if (!await this.waitForVisible(editor, 1000)) {
                await cell.click({ force: true });
                await this.page.keyboard.press("Enter");
            }
            await expect(editor).toBeVisible({ timeout: 15000 });
            await editor.fill(value);
            await this.page.keyboard.press("Enter");
        }
    }

    public async markResultGridRowDeleted(rowIndex: number, columnTitle: string): Promise<void> {
        await this.clickResultGridCellMenuItem(rowIndex, columnTitle, "Delete Row (Mark/Unmark)");
        await expect(this.resultGrid().locator(".tabulator-row").nth(rowIndex)).toHaveClass(/deleted/, {
            timeout: 15000,
        });
    }

    public async applyResultGridChanges(): Promise<void> {
        await this.resultHost().locator("#applyButton").evaluate((button: HTMLElement) => {
            button.click();
        });
        await expect(this.resultGrid().locator(".tabulator-row.added, .tabulator-row.deleted, .tabulator-cell.changed"))
            .toHaveCount(0, { timeout: 30000 });
    }

    public async rollbackResultGridChanges(): Promise<void> {
        await this.resultHost().locator("#rollbackButton").click({ force: true });
        await expect(this.resultGrid().locator(".tabulator-row.added, .tabulator-row.deleted, .tabulator-cell.changed"))
            .toHaveCount(0, { timeout: 15000 });
    }

    public async copyResultGridCell(rowIndex: number, columnTitle: string): Promise<string> {
        await this.clearClipboard();
        await this.clickResultGridCellMenuItem(rowIndex, columnTitle, "Copy Field");

        return this.waitForClipboardText();
    }

    public async copyResultGridRowWithNames(rowIndex: number, columnTitle: string): Promise<string> {
        await this.clearClipboard();
        await this.clickResultGridCellMenuItem(rowIndex, columnTitle, "Copy Single Row", "Copy Row With Names");

        return this.waitForClipboardText();
    }

    public async copyAllResultGridRowsWithNames(rowIndex: number, columnTitle: string): Promise<string> {
        await this.clearClipboard();
        await this.clickResultGridCellMenuItem(rowIndex, columnTitle, "Copy Multiple Rows", "Copy All Rows With Names");

        return this.waitForClipboardText();
    }

    public async installClipboardMock(): Promise<void> {
        await this.page.evaluate(() => {
            const testWindow = window as typeof window & {
                __electronE2EClipboard?: {
                    installed: boolean;
                    text: string;
                };
            };

            testWindow.__electronE2EClipboard ??= {
                installed: false,
                text: "",
            };

            if (testWindow.__electronE2EClipboard.installed) {
                return;
            }

            const readText = async (): Promise<string> => {
                return testWindow.__electronE2EClipboard?.text ?? "";
            };
            const writeText = async (text: string): Promise<void> => {
                testWindow.__electronE2EClipboard!.text = text;
            };

            Object.defineProperty(navigator, "clipboard", {
                configurable: true,
                value: {
                    readText,
                    writeText,
                },
            });
            testWindow.__electronE2EClipboard.installed = true;
        });
    }

    public async readClipboardText(): Promise<string> {
        await this.installClipboardMock();

        return this.page.evaluate(() => {
            return navigator.clipboard.readText();
        });
    }

    public async clearClipboard(): Promise<void> {
        await this.installClipboardMock();
        await this.page.evaluate(() => {
            return navigator.clipboard.writeText("");
        });
    }

    public async readSystemClipboardText(): Promise<string> {
        return this.electronApp.evaluate(({ clipboard }) => {
            return clipboard.readText();
        });
    }

    public async writeSystemClipboardText(text: string): Promise<void> {
        await this.electronApp.evaluate(({ clipboard }, clipboardText) => {
            clipboard.writeText(clipboardText);
        }, text);
    }

    public async installExternalUrlInterceptor(): Promise<void> {
        await this.electronApp.evaluate(({ shell }) => {
            const mainProcess = globalThis as typeof globalThis & {
                __electronE2E?: {
                    openedExternalUrls?: string[];
                    openExternalInstalled?: boolean;
                };
            };

            mainProcess.__electronE2E ??= {};
            mainProcess.__electronE2E.openedExternalUrls = [];

            if (mainProcess.__electronE2E.openExternalInstalled) {
                return;
            }

            mainProcess.__electronE2E.openExternalInstalled = true;
            shell.openExternal = async (url: string) => {
                mainProcess.__electronE2E!.openedExternalUrls!.push(url);
            };
        });
    }

    public async externalUrls(): Promise<string[]> {
        return this.electronApp.evaluate(() => {
            const mainProcess = globalThis as typeof globalThis & {
                __electronE2E?: { openedExternalUrls?: string[] };
            };

            return mainProcess.__electronE2E?.openedExternalUrls ?? [];
        });
    }

    public schemaTreeEntry(caption: string): Locator {
        return this.page.locator("#schemasSection .tabulator-row", {
            has: this.page.locator("label#mainCaption", { hasText: this.exactText(caption) }),
        }).first();
    }

    public async waitForSchemasTreeReady(): Promise<void> {
        const section = this.page.locator("#schemasSection");
        await expect(section).toBeVisible({ timeout: 60000 });
        await expect(section.locator(".tabulator-tableholder")).toBeVisible({ timeout: 60000 });
        await expect(section.locator(".tabulator-row").first()).toBeVisible({ timeout: 60000 });

        const progress = this.page.locator("#loadingProgressIndicator, #schemasSection .sectionProgress");
        await expect(progress).toHaveCount(0, { timeout: 60000 });
        await this.page.waitForTimeout(250);
        await expect(progress).toHaveCount(0, { timeout: 60000 });
    }

    public async expandSchemaTreeEntry(caption: string, expectedChildCaption?: string): Promise<void> {
        await this.waitForSchemasTreeReady();
        if (expectedChildCaption && await this.waitForVisible(this.schemaTreeEntry(expectedChildCaption), 500)) {
            return;
        }

        const row = this.schemaTreeEntry(caption);
        await expect(row).toBeVisible({ timeout: 30000 });
        const toggle = row.locator(".treeToggle").first();
        await expect(toggle).toBeVisible({ timeout: 30000 });
        await toggle.scrollIntoViewIfNeeded();
        await toggle.click();
        await this.waitForSchemasTreeReady();
        if (expectedChildCaption) {
            await expect(this.schemaTreeEntry(expectedChildCaption)).toBeVisible({ timeout: 30000 });
        } else {
            await expect(row.locator(".treeToggle.codicon-chevron-down")).toBeVisible({ timeout: 30000 });
        }
    }

    public async expandSchemaTreePath(captions: string[]): Promise<Locator> {
        if (captions.length === 0) {
            throw new Error("A schema tree path must contain at least one caption.");
        }

        await this.waitForSchemasTreeReady();
        for (let index = 0; index < captions.length - 1; ++index) {
            const entryPath = captions.slice(0, index + 1);
            const childPath = captions.slice(0, index + 2);
            const row = await this.waitForSchemaTreePath(entryPath);
            if (await this.schemaTreePathExists(childPath)) {
                continue;
            }

            const toggle = row.locator(".treeToggle").first();
            await expect(toggle).toBeVisible({ timeout: 30000 });
            await toggle.scrollIntoViewIfNeeded();
            if (!await toggle.evaluate((element) => element.classList.contains("codicon-chevron-down"))) {
                await toggle.click();
            }

            await this.waitForSchemasTreeReady();
            await this.waitForSchemaTreePath(childPath);
        }

        return this.waitForSchemaTreePath(captions);
    }

    public async selectSchemaTreeAction(caption: string, menuPath: string[]): Promise<void> {
        await this.page.keyboard.press("Escape");
        await this.installNativeMenuInterceptor();
        await this.clearNativeMenuRequest();

        const row = this.schemaTreeEntry(caption);
        await expect(row).toBeVisible({ timeout: 30000 });
        await row.scrollIntoViewIfNeeded();
        await row.click({ button: "right" });
        await this.selectNativeMenuPath(menuPath);
    }

    public async selectSchemaTreePathAction(captions: string[], menuPath: string[]): Promise<void> {
        await this.page.keyboard.press("Escape");
        await this.installNativeMenuInterceptor();
        await this.clearNativeMenuRequest();

        const row = await this.waitForSchemaTreePath(captions);
        await row.scrollIntoViewIfNeeded();
        await row.click({ button: "right" });
        await this.selectNativeMenuPath(menuPath);
    }

    public async selectVisibleMenuPath(menuPath: string[]): Promise<void> {
        let menu = this.page.locator(".popup.visible").last();
        await expect(menu).toBeVisible({ timeout: 15000 });

        for (const [index, label] of menuPath.entries()) {
            const item = menu.locator(".menuItem", {
                has: this.page.locator("label", { hasText: this.exactText(label) }),
            }).first();
            await expect(item).toBeVisible({ timeout: 15000 });

            if (index === menuPath.length - 1) {
                await item.click({ force: true });
            } else {
                await item.hover();
                menu = this.page.locator(".popup.visible").last();
            }
        }
    }

    private async schemaTreePathExists(captions: string[]): Promise<boolean> {
        return (await this.schemaTreePathIndex(captions)) !== -1;
    }

    private async waitForSchemaTreePath(captions: string[]): Promise<Locator> {
        await expect.poll(() => this.schemaTreePathIndex(captions), { timeout: 30000 }).not.toBe(-1);

        const index = await this.schemaTreePathIndex(captions);
        if (index === -1) {
            throw new Error(`Schema tree path not found: ${captions.join(" > ")}`);
        }

        const row = this.page.locator("#schemasSection .tabulator-row").nth(index);
        await expect(row).toBeVisible({ timeout: 30000 });

        return row;
    }

    private async schemaTreePathIndex(captions: string[]): Promise<number> {
        return this.page.locator("#schemasSection .tabulator-row").evaluateAll((rows, path) => {
            let parentIndex = -1;
            let parentLevel = -1;

            for (const caption of path) {
                const expectedLevel = parentLevel + 1;
                let index = -1;
                for (let currentIndex = parentIndex + 1; currentIndex < rows.length; ++currentIndex) {
                    const row = rows[currentIndex];
                    const levelMatch = /tabulator-tree-level-(\d+)/.exec(row.className);
                    const level = levelMatch ? Number(levelMatch[1]) : -1;
                    if (parentIndex !== -1 && level <= parentLevel) {
                        break;
                    }

                    if (level === expectedLevel
                        && row.querySelector("label#mainCaption")?.textContent?.trim() === caption) {
                        index = currentIndex;
                        parentLevel = level;

                        break;
                    }
                }

                if (index === -1) {
                    return -1;
                }

                parentIndex = index;
            }

            return parentIndex;
        }, captions);
    }

    private async selectTileMenuAction(tile: Locator, menuPath: string[]): Promise<void> {
        await this.installNativeMenuInterceptor();
        await this.clearNativeMenuRequest();

        await expect(tile).toBeVisible({ timeout: 15000 });
        await tile.hover();
        await tile.locator("#tileMoreActionsAction").click({ force: true });

        await this.selectNativeMenuPath(menuPath);
    }

    private async resultGridColumnField(columnTitle: string): Promise<string> {
        const column = this.resultGrid().locator(".tabulator-col", {
            has: this.page.locator(".tabulator-col-title", { hasText: this.exactText(columnTitle) }),
        }).first();
        await expect(column).toBeVisible({ timeout: 15000 });
        const field = await column.getAttribute("tabulator-field");
        if (!field) {
            throw new Error(`Result grid column "${columnTitle}" does not expose a tabulator field`);
        }

        return field;
    }

    private async clickResultGridCellMenuItem(rowIndex: number, columnTitle: string,
        menuItem: string, subMenuItem?: string): Promise<void> {
        await this.page.keyboard.press("Escape");
        await this.installNativeMenuInterceptor();
        await this.clearNativeMenuRequest();

        const cell = await this.resultGridCell(rowIndex, columnTitle);
        await expect(cell).toBeVisible({ timeout: 15000 });
        await cell.evaluate((element: HTMLElement) => {
            element.dispatchEvent(new MouseEvent("contextmenu", {
                bubbles: true,
                button: 2,
                buttons: 2,
                clientX: element.getBoundingClientRect().left + 4,
                clientY: element.getBoundingClientRect().top + 4,
            }));
        });

        await this.selectNativeMenuPath(subMenuItem ? [menuItem, subMenuItem] : [menuItem]);
    }

    private async waitForClipboardText(): Promise<string> {
        let text = "";
        await expect.poll(async () => {
            text = await this.readClipboardText();

            return text;
        }, { timeout: 15000 }).not.toBe("");

        return text;
    }

    private cssAttributeValue(value: string): string {
        return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    }

    private async installNativeMenuInterceptor(): Promise<void> {
        await this.electronApp.evaluate(({ BrowserWindow, ipcMain }) => {
            const mainProcess = globalThis as typeof globalThis & {
                __electronE2E?: {
                    installed?: boolean;
                    lastNativeMenuRequest?: INativeMenuRequestSnapshot;
                };
            };

            if (mainProcess.__electronE2E?.installed) {
                return;
            }

            mainProcess.__electronE2E = {
                installed: true,
            };

            ipcMain.removeHandler("electron-host-show-native-menu");
            ipcMain.handle("electron-host-show-native-menu", async (_event, request: INativeMenuRequestSnapshot) => {
                mainProcess.__electronE2E!.lastNativeMenuRequest = request;
            });

            ipcMain.removeHandler("electron-host-close-native-menu");
            ipcMain.handle("electron-host-close-native-menu", async (_event, requestId: string) => {
                const browserWindow = BrowserWindow.getAllWindows()[0];
                browserWindow.webContents.send("electron-host-native-menu-event", {
                    type: "close",
                    requestId,
                    cancelled: true,
                });
            });
        });
    }

    private async clearNativeMenuRequest(): Promise<void> {
        await this.electronApp.evaluate(() => {
            const mainProcess = globalThis as typeof globalThis & {
                __electronE2E?: { lastNativeMenuRequest?: INativeMenuRequestSnapshot };
            };

            if (mainProcess.__electronE2E) {
                mainProcess.__electronE2E.lastNativeMenuRequest = undefined;
            }
        });
    }

    private async selectNativeMenuPath(menuPath: string[]): Promise<void> {
        const request = await this.waitForNativeMenuRequest();
        const item = this.findNativeMenuItem(request.items, menuPath);
        if (!item) {
            throw new Error(`Could not find native menu item "${menuPath.join(" > ")}". Available items: ` +
                this.formatNativeMenuItems(request.items).join(", "));
        }

        await this.electronApp.evaluate(({ BrowserWindow }, { requestId, itemId }) => {
            const browserWindow = BrowserWindow.getAllWindows()[0];
            browserWindow.webContents.send("electron-host-native-menu-event", {
                type: "select",
                requestId,
                itemId,
            });
            browserWindow.webContents.send("electron-host-native-menu-event", {
                type: "close",
                requestId,
                cancelled: false,
            });
        }, { requestId: request.id, itemId: item.id });
    }

    private async waitForNativeMenuRequest(): Promise<INativeMenuRequestSnapshot> {
        let request: INativeMenuRequestSnapshot | undefined;
        await expect.poll(async () => {
            request = await this.electronApp.evaluate(() => {
                const mainProcess = globalThis as typeof globalThis & {
                    __electronE2E?: { lastNativeMenuRequest?: INativeMenuRequestSnapshot };
                };

                return mainProcess.__electronE2E?.lastNativeMenuRequest;
            });

            return request?.id ?? "";
        }, { timeout: 15000 }).not.toBe("");

        return request!;
    }

    private findNativeMenuItem(items: INativeMenuItemSnapshot[], menuPath: string[]): INativeMenuItemSnapshot | undefined {
        const normalizeLabel = (value: string) => {
            return value.replace(/&/g, "").replace(/\s+/g, " ").trim();
        };
        const [head, ...tail] = menuPath;
        const item = items.find((candidate) => {
            return candidate.type !== "separator" && normalizeLabel(candidate.label ?? "") === normalizeLabel(head);
        });

        if (!item || tail.length === 0) {
            return item;
        }

        return this.findNativeMenuItem(item.submenu ?? [], tail);
    }

    private formatNativeMenuItems(items: INativeMenuItemSnapshot[], prefix = ""): string[] {
        return items.flatMap((item) => {
            if (item.type === "separator") {
                return [];
            }

            const label = `${prefix}${item.label ?? ""}`;
            const children = item.submenu ? this.formatNativeMenuItems(item.submenu, `${label} > `) : [];

            return [label, ...children];
        });
    }

    private exactText(text: string): RegExp {
        return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
    }

    private findMenuItem(menu: IMenuItemSnapshot[], path: string[]): IMenuItemSnapshot | undefined {
        const normalizeLabel = (value: string) => {
            return value.replace(/&/g, "").replace(/\s+/g, " ").trim();
        };
        const [head, ...tail] = path;
        const item = menu.find((candidate) => {
            return normalizeLabel(candidate.label) === normalizeLabel(head);
        });

        if (!item || tail.length === 0) {
            return item;
        }

        return this.findMenuItem(item.submenu ?? [], tail);
    }

    private async hasTab(label: RegExp | string): Promise<boolean> {
        const labels = await this.tabLabels();
        if (label instanceof RegExp) {
            return labels.some((entry) => {
                return label.test(entry);
            });
        }

        return labels.includes(label);
    }

    private formatTabLabel(label: RegExp | string): string {
        return label instanceof RegExp ? `tab matching ${label}` : `tab "${label}"`;
    }

    private async visibleErrorMessage(): Promise<string | undefined> {
        const notification = this.page.locator(".notificationCenter .toast.error").first();
        if (await this.waitForVisible(notification, 100)) {
            return (await notification.innerText()).trim();
        }

        const errorPanel = this.page.locator(".visible.errorPanel").first();
        if (await this.waitForVisible(errorPanel, 100)) {
            return (await errorPanel.innerText()).trim();
        }

        return undefined;
    }

    public async settlePasswordPrompts(_password: string, timeout = this.passwordPromptSettleTimeout()): Promise<void> {
        const deadline = Date.now() + timeout;
        let quietSince = Date.now();

        while (Date.now() < deadline) {
            await this.failOnPasswordPrompt("waiting for password prompts to settle");
            const refusedStorage = await this.refusePasswordStorageIfRequested(100);

            if (refusedStorage) {
                quietSince = Date.now();
            } else if (Date.now() - quietSince >= 750) {
                return;
            }

            await this.page.waitForTimeout(100);
        }

        throw new Error("Timed out waiting for password prompts to settle.");
    }

    private async passwordPromptVisible(timeout = 250): Promise<boolean> {
        return this.waitForVisible(this.page.locator(".passwordDialog").first(), timeout);
    }

    private async failOnPasswordPrompt(context: string): Promise<void> {
        if (await this.passwordPromptVisible(50)) {
            throw new Error(`Unexpected password prompt while ${context}.`);
        }
    }

    private passwordPromptSettleTimeout(): number {
        const rawValue = process.env.ELECTRON_E2E_SLOWMO ?? process.env.ELECTRON_E2E_SLOW_MO;
        const slowMo = rawValue ? Number(rawValue) : 0;

        return Math.max(5000, 5000 + (Number.isFinite(slowMo) ? slowMo * 20 : 0));
    }

    private async refusePasswordStorageIfRequested(timeout = 1000): Promise<boolean> {
        const dialog = this.page.locator(".confirmDialog").first();
        if (!await this.waitForVisible(dialog, timeout)) {
            return false;
        }

        const dialogText = await dialog.innerText();
        if (!/save password/i.test(dialogText)) {
            return false;
        }

        const dialogElement = await dialog.elementHandle();
        const refuse = dialog.locator("#refuse");
        if (await this.waitForVisible(refuse, 250)) {
            await refuse.evaluate((button: HTMLElement) => {
                button.click();
            });
            await this.waitForDialogElementHidden(dialogElement, 15000);

            return true;
        }

        const alternative = dialog.locator("#alternative");
        if (await this.waitForVisible(alternative, 250)) {
            await alternative.evaluate((button: HTMLElement) => {
                button.click();
            });
            await this.waitForDialogElementHidden(dialogElement, 15000);

            return true;
        }

        return false;
    }

    private async waitForDialogElementHidden(element: ElementHandle<HTMLElement | SVGElement> | null,
        timeout: number): Promise<void> {
        if (!element) {
            return;
        }

        await this.page.waitForFunction((dialog: HTMLElement | SVGElement) => {
            if (!dialog.isConnected) {
                return true;
            }

            const style = window.getComputedStyle(dialog);

            return style.display === "none" || style.visibility === "hidden"
                || !dialog.classList.contains("visible");
        }, element, { timeout });
    }

    private async setInput(locator: Locator, value: string): Promise<void> {
        await expect(locator).toBeVisible({ timeout: 10000 });
        await locator.fill(value);
    }

    private async waitForVisible(locator: Locator, timeout: number): Promise<boolean> {
        try {
            await locator.waitFor({ state: "visible", timeout });
        } catch {
            return false;
        }

        return true;
    }
}
