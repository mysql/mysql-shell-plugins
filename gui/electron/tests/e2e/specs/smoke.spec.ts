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

import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { createElectronLaunchOptions, test, expect } from "../fixtures/electron.js";

const waitForProcessExit = async (childProcess: ChildProcess, timeout = 5000): Promise<void> => {
    const retryInterval = 50;
    const attempts = Math.ceil(timeout / retryInterval);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
            return;
        }

        await delay(retryInterval);
    }

    throw new Error(`Process ${childProcess.pid ?? "unknown"} did not exit within ${timeout}ms.`);
};

const stopProcess = async (childProcess: ChildProcess): Promise<void> => {
    if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
        return;
    }

    childProcess.kill();
    try {
        await waitForProcessExit(childProcess);
    } catch {
        childProcess.kill("SIGKILL");
        await waitForProcessExit(childProcess);
    }
};

test.describe("Electron desktop shell", () => {
    test("launches the desktop host and exposes the native bridges", async ({ page, workbench }) => {
        await workbench.waitForShell();

        await expect(page.locator("#root")).toHaveClass(/electronDesktopHost/);
        await expect(page.locator("#desktopSidebarPane")).toBeVisible();
        await expect(page.locator(".connectionBrowser")).toContainText("Welcome to MySQL Workbench");
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

        const menuSnapshot = await workbench.menuSnapshot();
        expect(menuSnapshot.map((item) => {
            return item.label;
        })).toEqual(expect.arrayContaining(["File", "Edit", "View", "Run", "Database", "Window", "Help"]));

        const databaseMenuLabels = menuSnapshot.find((item) => {
            return item.label === "Database";
        })?.submenu?.map((item) => {
            return item.label;
        });
        expect(databaseMenuLabels).not.toContain("Configure MySQL REST Service");
        expect(databaseMenuLabels).not.toContain("Browse MySQL REST Service Documentation");
    });

    test("keeps one running process per Electron user data profile",
        async ({ electronApp, electronLaunchEnvironment }, testInfo) => {
            const desktopLogPath = testInfo.outputPath("electron-user-data", "MySQL Workbench-electron.log");
            const startupMarker = "startup isBundledRuntime=";
            const startupCountBeforeSecondLaunch = (await readFile(desktopLogPath, "utf8"))
                .split(startupMarker).length - 1;

            const { focusWindowId, mainWindowId } = await electronApp.evaluate(({ BrowserWindow }) => {
                const mainWindow = BrowserWindow.getAllWindows()[0];
                const focusWindow = new BrowserWindow({ show: true });
                focusWindow.focus();

                return {
                    focusWindowId: focusWindow.id,
                    mainWindowId: mainWindow.id,
                };
            });
            await expect.poll(async () => {
                return electronApp.evaluate(({ BrowserWindow }, windowId) => {
                    return BrowserWindow.fromId(windowId)?.isFocused();
                }, mainWindowId);
            }).toBe(false);
            await electronApp.evaluate(({ BrowserWindow }, windowId) => {
                const browserWindow = BrowserWindow.fromId(windowId);

                if (!browserWindow) {
                    return;
                }

                Reflect.set(browserWindow, "e2eFocusObserved", false);
                browserWindow.once("focus", () => {
                    Reflect.set(browserWindow, "e2eFocusObserved", true);
                });
            }, mainWindowId);

            const launchOptions = await createElectronLaunchOptions(testInfo, electronLaunchEnvironment);
            const secondProcess = spawn(launchOptions.executablePath, launchOptions.args, {
                env: launchOptions.env,
                stdio: "ignore",
            });

            try {
                await expect.poll(() => {
                    return secondProcess.exitCode;
                }, { timeout: 15000 }).toBe(0);
                await expect.poll(async () => {
                    return electronApp.evaluate(({ BrowserWindow }, windowId) => {
                        const browserWindow = BrowserWindow.fromId(windowId);

                        return {
                            focusObserved: browserWindow
                                ? Reflect.get(browserWindow, "e2eFocusObserved") === true
                                : false,
                            visible: browserWindow?.isVisible(),
                        };
                    }, mainWindowId);
                }, { timeout: 15000 }).toEqual({ focusObserved: true, visible: true });

                const startupCountAfterSecondLaunch = (await readFile(desktopLogPath, "utf8"))
                    .split(startupMarker).length - 1;
                expect(startupCountAfterSecondLaunch).toBe(startupCountBeforeSecondLaunch);
            } finally {
                await stopProcess(secondProcess);
                await electronApp.evaluate(({ BrowserWindow }, windowId) => {
                    BrowserWindow.fromId(windowId)?.destroy();
                }, focusWindowId);
            }
        });

    test("allows separate Electron user data profiles to run concurrently",
        async ({ electronApp, electronLaunchEnvironment }, testInfo) => {
            const primaryUserDataPath = await electronApp.evaluate(({ app }) => {
                return app.getPath("userData");
            });
            const secondaryUserDataPath = testInfo.outputPath("secondary-electron-user-data");
            expect(secondaryUserDataPath).not.toBe(primaryUserDataPath);

            const launchOptions = await createElectronLaunchOptions(
                testInfo,
                electronLaunchEnvironment,
                secondaryUserDataPath,
            );
            const secondProcess = spawn(launchOptions.executablePath, launchOptions.args, {
                env: launchOptions.env,
                stdio: "ignore",
            });

            try {
                const desktopLogPath = join(secondaryUserDataPath, "MySQL Workbench-electron.log");
                await expect.poll(async () => {
                    return readFile(desktopLogPath, "utf8").catch(() => "");
                }, { timeout: 15000 }).toContain("app.whenReady");
                expect(secondProcess.exitCode).toBeNull();
                expect(secondProcess.signalCode).toBeNull();
            } finally {
                await stopProcess(secondProcess);
            }
        });

    test("waits for delayed renderer approval before closing", async ({ electronApp, page, workbench }, testInfo) => {
        await workbench.waitForShell();

        await page.evaluate(() => {
            const testWindow = window as typeof window & { delayedCloseRequestId?: string; };
            window.electronHost?.setMessageHandler?.((message) => {
                if (message.command === "desktopWindowCloseRequested") {
                    testWindow.delayedCloseRequestId = message.data?.requestId as string | undefined;
                }
            });
        });

        await electronApp.evaluate(({ BrowserWindow }) => {
            BrowserWindow.getAllWindows()[0]?.close();
        });
        await expect.poll(async () => {
            return page.evaluate(() => {
                return (window as typeof window & { delayedCloseRequestId?: string; }).delayedCloseRequestId;
            });
        }, { timeout: 15000 }).toMatch(/^window-close-/);

        await page.waitForTimeout(7000);

        expect(await electronApp.evaluate(({ BrowserWindow }) => {
            return BrowserWindow.getAllWindows().length;
        })).toBe(1);

        const firstRequestId = await page.evaluate(() => {
            const testWindow = window as typeof window & { delayedCloseRequestId?: string; };
            const requestId = testWindow.delayedCloseRequestId;
            testWindow.delayedCloseRequestId = undefined;

            return requestId;
        });
        if (!firstRequestId) {
            throw new Error("The first window close request id was not captured.");
        }

        await page.evaluate((requestId) => {
            window.electronHost?.postMessage({
                source: "app",
                command: "desktopWindowCloseResponse",
                data: { requestId, allow: false },
            });
        }, firstRequestId);
        const desktopLogPath = testInfo.outputPath("electron-user-data", "MySQL Workbench-electron.log");
        await expect.poll(async () => {
            return readFile(desktopLogPath, "utf8");
        }, { timeout: 15000 }).toContain("main window close canceled by renderer");
        expect(await electronApp.evaluate(({ BrowserWindow }) => {
            return BrowserWindow.getAllWindows().length;
        })).toBe(1);

        await electronApp.evaluate(({ BrowserWindow }) => {
            BrowserWindow.getAllWindows()[0]?.close();
        });
        await expect.poll(async () => {
            return page.evaluate(() => {
                return (window as typeof window & { delayedCloseRequestId?: string; }).delayedCloseRequestId;
            });
        }, { timeout: 15000 }).toMatch(/^window-close-/);

        const secondRequestId = await page.evaluate(() => {
            return (window as typeof window & { delayedCloseRequestId?: string; }).delayedCloseRequestId;
        });
        if (!secondRequestId) {
            throw new Error("The second window close request id was not captured.");
        }

        page.on("dialog", (dialog) => {
            void dialog.accept().catch(() => {
                // The close can complete before Playwright accepts the beforeunload dialog.
            });
        });
        const closePromise = electronApp.waitForEvent("close");
        await page.evaluate((requestId) => {
            window.electronHost?.postMessage({
                source: "app",
                command: "desktopWindowCloseResponse",
                data: { requestId, allow: true },
            });
        }, secondRequestId);
        await closePromise;
    });

    test("keeps the renderer viewport aligned with the native content area", async ({ electronApp, page }) => {
        expect(page.viewportSize()).toBeNull();

        // Native menu initialization can resize the content area during startup.
        await expect(async () => {
            const nativeContentSize = await electronApp.evaluate(({ BrowserWindow }) => {
                return BrowserWindow.getAllWindows()[0].getContentSize();
            });
            const rendererSize = await page.evaluate(() => {
                return {
                    width: window.innerWidth,
                    height: window.innerHeight,
                };
            });

            expect(rendererSize).toEqual({
                width: nativeContentSize[0],
                height: nativeContentSize[1],
            });
        }).toPass({ timeout: 15000 });
    });

    test("uses isolated Electron user data for desktop state", async ({ electronApp }, testInfo) => {
        const userDataPath = await electronApp.evaluate(({ app }) => {
            return app.getPath("userData");
        });

        expect(userDataPath).toBe(testInfo.outputPath("electron-user-data"));
    });

    test("uses mysqlsh below Electron user data as the MySQL Shell configuration root", async ({ workbench }, testInfo) => {
        await workbench.waitForShell();

        const userDataPath = testInfo.outputPath("electron-user-data");
        await expect(access(join(userDataPath, "plugin_data", "gui_plugin"))).rejects.toThrow();
        await expect(access(join(userDataPath, "mysqlsh", "plugin_data", "gui_plugin"))).resolves.toBeUndefined();
    });

    test("keeps Workbench runtime data user-only", async ({ electronApp }, testInfo) => {
        const userDataPath = testInfo.outputPath("electron-user-data");
        const desktopLogPath = join(userDataPath, "MySQL Workbench-electron.log");

        const modes = await Promise.all([
            userDataPath,
            desktopLogPath,
        ].map(async (filePath) => {
            return (await stat(filePath)).mode & 0o777;
        }));

        expect(modes).toEqual([0o700, 0o600]);
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
        const logContent = `${Array.from({ length: 500 }, (_value, index) => {
            return `Log line ${index}\n`;
        }).join("")}Overlong log line: ${"1234567890".repeat(100)}\nLog viewer marker: ${marker}\n`;
        const logPath = testInfo.outputPath("electron-user-data", "mysqlsh", "mysqlsh.log");
        await mkdir(dirname(logPath), { recursive: true });
        await writeFile(logPath, logContent, "utf8");

        const fileViewerPagePromise = electronApp.waitForEvent("window");
        await workbench.clickMenu(["View", "Developer", "Open mysqlsh.log File"]);
        const fileViewerPage = await fileViewerPagePromise;

        await expect(fileViewerPage.locator(".fileViewer")).toBeVisible({ timeout: 15000 });
        await expect(fileViewerPage.locator(".fileViewerContent")).toHaveValue(new RegExp(marker), {
            timeout: 15000,
        });
        await expect(fileViewerPage.locator(".fileViewerStatus")).toContainText("loaded");

        const previousClipboardText = await workbench.readSystemClipboardText();

        try {
            const contentState = await fileViewerPage.locator(".fileViewerContent")
                .evaluate((element, selectedText) => {
                    const content = element as HTMLTextAreaElement;
                    const selectionStart = content.value.indexOf(selectedText);
                    content.focus();
                    content.setSelectionRange(selectionStart, selectionStart + selectedText.length);
                    content.scrollTop = content.scrollHeight;
                    content.scrollLeft = content.scrollWidth;

                    return {
                        clientHeight: content.clientHeight,
                        clientWidth: content.clientWidth,
                        readOnly: content.readOnly,
                        scrollHeight: content.scrollHeight,
                        scrollLeft: content.scrollLeft,
                        scrollTop: content.scrollTop,
                        scrollWidth: content.scrollWidth,
                        selectedText: content.value.slice(content.selectionStart, content.selectionEnd),
                        userSelect: getComputedStyle(content).userSelect,
                    };
                }, marker);

            expect(contentState.readOnly).toBe(true);
            expect(contentState.selectedText).toBe(marker);
            expect(contentState.userSelect).toBe("text");
            expect(contentState.scrollHeight).toBeGreaterThan(contentState.clientHeight);
            expect(contentState.scrollWidth).toBeGreaterThan(contentState.clientWidth);
            expect(contentState.scrollTop).toBeGreaterThan(0);
            expect(contentState.scrollLeft).toBeGreaterThan(0);

            await fileViewerPage.keyboard.press("ControlOrMeta+C");
            await expect.poll(async () => {
                return workbench.readSystemClipboardText();
            }, { timeout: 15000 }).toBe(marker);
        } finally {
            await workbench.writeSystemClipboardText(previousClipboardText);
        }

        await expect(fileViewerPage.locator(".startupConnectionPlaceholder")).toHaveCount(0);

        const nativeWindowState = await electronApp.evaluate(({ BrowserWindow }) => {
            const fileViewerWindow = BrowserWindow.getAllWindows().find((browserWindow) => {
                return browserWindow.webContents.getURL().includes("view=fileViewer");
            });

            return fileViewerWindow
                ? {
                    menuBarVisible: fileViewerWindow.isMenuBarVisible(),
                }
                : undefined;
        });

        expect(nativeWindowState).toEqual({
            menuBarVisible: process.platform === "darwin",
        });

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
