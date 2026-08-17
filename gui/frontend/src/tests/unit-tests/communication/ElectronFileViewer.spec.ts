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

import { createRequire } from "node:module";
import * as nodePath from "node:path";

import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createFileViewerHost } = require("../../../../../electron/src/file-viewer-host.cjs") as {
    createFileViewerHost: (dependencies: Record<string, unknown>) => IFileViewerHost;
};

interface IFileViewerHost {
    browse: (event: IFileViewerEvent) => Promise<boolean>;
    openFileViewerWindow: (filePath: string) => void;
    read: (event: IFileViewerEvent, request?: IFileViewerReadRequest) => Promise<IFileViewerReadResult>;
}

interface IFileViewerReadRequest {
    maxBytes?: number;
    offset?: number;
    readMode?: "range" | "tail";
}

interface IFileViewerReadResult {
    content?: string;
    error?: string;
    fileName?: string;
    filePath?: string;
    offset?: number;
    size?: number;
    truncated?: boolean;
}

interface IFileViewerEvent {
    sender: IFakeWebContents;
    senderFrame?: {
        url?: string;
    };
}

interface IFakeWebContents {
    executeJavaScript: ReturnType<typeof vi.fn>;
    getURL: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    setWindowOpenHandler: ReturnType<typeof vi.fn>;
}

interface IFakeWindow {
    destroy: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    hide: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
    loadURL: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    options: Record<string, unknown>;
    setMenu: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    webContents: IFakeWebContents;
}

interface IFakeFileHandle {
    close: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
}

const trustedFileViewerUrl = "app://renderer/index.html?view=fileViewer";
const fileViewerEntryUrl = trustedFileViewerUrl;
const fileViewerPreloadPath = "/app/file-viewer-preload.cjs";

const createFakeWebContents = (url = trustedFileViewerUrl): IFakeWebContents => {
    return {
        executeJavaScript: vi.fn().mockResolvedValue(undefined),
        getURL: vi.fn().mockReturnValue(url),
        on: vi.fn(),
        setWindowOpenHandler: vi.fn(),
    };
};

const createFakeWindow = (options: Record<string, unknown>): IFakeWindow => {
    const handlers = new Map<string, (event?: { preventDefault?: () => void }) => void>();
    let destroyed = false;
    const fakeWindow: IFakeWindow = {
        destroy: vi.fn(() => {
            destroyed = true;
            handlers.get("closed")?.();
        }),
        focus: vi.fn(),
        hide: vi.fn(),
        isDestroyed: vi.fn(() => {
            return destroyed;
        }),
        loadURL: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        options,
        setMenu: vi.fn(),
        show: vi.fn(),
        webContents: createFakeWebContents(),
    };
    fakeWindow.on = vi.fn((eventName: string, handler: (event?: { preventDefault?: () => void }) => void) => {
        handlers.set(eventName, handler);

        return fakeWindow;
    });

    return fakeWindow;
};

const createHost = (contentByPath = new Map<string, string>()) => {
    const windows: IFakeWindow[] = [];
    const fileHandles: IFakeFileHandle[] = [];
    const BrowserWindow = vi.fn().mockImplementation((options: Record<string, unknown>) => {
        const fakeWindow = createFakeWindow(options);
        windows.push(fakeWindow);

        return fakeWindow;
    });
    const createFileHandle = (filePath: string): IFakeFileHandle => {
        return {
            close: vi.fn().mockResolvedValue(undefined),
            read: vi.fn((buffer: Buffer, offset: number, length: number, position: number) => {
                const source = Buffer.from(contentByPath.get(filePath) ?? "", "utf8");
                const bytesRead = source.copy(buffer, offset, position, Math.min(position + length, source.length));

                return Promise.resolve({
                    buffer,
                    bytesRead,
                });
            }),
        };
    };
    const fsModule = {
        chmodSync: vi.fn(),
        promises: {
            open: vi.fn((filePath: string) => {
                const fileHandle = createFileHandle(filePath);
                fileHandles.push(fileHandle);

                return Promise.resolve(fileHandle);
            }),
            stat: vi.fn((filePath: string) => {
                return Promise.resolve({ size: Buffer.byteLength(contentByPath.get(filePath) ?? "") });
            }),
        },
        writeFileSync: vi.fn((filePath: string, content: string, options?: { flag?: string }) => {
            if (options?.flag === "a") {
                contentByPath.set(filePath, `${contentByPath.get(filePath) ?? ""}${content}`);

                return;
            }

            contentByPath.set(filePath, content);
        }),
    };
    const shell = {
        showItemInFolder: vi.fn(),
    };
    const appendDesktopLog = vi.fn();
    const installNavigationGuards = vi.fn();
    const ensurePrivateFile = (filePath: string) => {
        fsModule.chmodSync(filePath, 0o600);
    };
    const host = createFileViewerHost({
        BrowserWindow,
        appendDesktopLog,
        fileViewerEntryUrl,
        fileViewerPreloadPath,
        fs: fsModule,
        ensurePrivateFile,
        installNavigationGuards,
        isTrustedFileViewerUrl: (url: string) => {
            return url === trustedFileViewerUrl;
        },
        nativeTheme: {
            shouldUseDarkColors: false,
        },
        path: nodePath,
        privateFileMode: 0o600,
        setTimeoutFn: (callback: () => void) => {
            callback();
        },
        shell,
    });

    return {
        BrowserWindow,
        appendDesktopLog,
        fileHandles,
        fsModule,
        host,
        installNavigationGuards,
        shell,
        windows,
    };
};

describe("Electron file viewer host", () => {
    it("opens a sandboxed viewer window and reuses the existing window for the same file", () => {
        const logPath = "/tmp/mysqlsh.log";
        const { BrowserWindow, fsModule, host, installNavigationGuards, windows } = createHost();

        host.openFileViewerWindow(logPath);

        expect(BrowserWindow).toHaveBeenCalledOnce();
        expect(fsModule.writeFileSync).toHaveBeenCalledWith(logPath, "", { flag: "a", mode: 0o600 });
        expect(fsModule.chmodSync).toHaveBeenCalledWith(logPath, 0o600);
        expect(windows[0].options).toMatchObject({
            backgroundColor: "#ffffff",
            title: "mysqlsh.log",
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                preload: fileViewerPreloadPath,
                sandbox: true,
            },
        });
        expect(windows[0].setMenu).toHaveBeenCalledOnce();
        expect(windows[0].setMenu).toHaveBeenCalledWith(null);
        expect(installNavigationGuards).toHaveBeenCalledWith(windows[0].webContents);
        expect(windows[0].loadURL).toHaveBeenCalledWith(fileViewerEntryUrl);

        host.openFileViewerWindow(logPath);

        expect(BrowserWindow).toHaveBeenCalledOnce();
        expect(windows[0].show).toHaveBeenCalledOnce();
        expect(windows[0].focus).toHaveBeenCalledOnce();
    });

    it("reads and browses only from the mapped trusted viewer window", async () => {
        const logPath = "/tmp/mysqlsh.log";
        const contentByPath = new Map([[logPath, "first line\nsecond line\n"]]);
        const { fsModule, host, shell, windows } = createHost(contentByPath);
        host.openFileViewerWindow(logPath);

        const event = {
            sender: windows[0].webContents,
            senderFrame: { url: trustedFileViewerUrl },
        };

        await expect(host.read(event)).resolves.toEqual({
            content: "first line\nsecond line\n",
            fileName: "mysqlsh.log",
            filePath: logPath,
            offset: 0,
            size: Buffer.byteLength("first line\nsecond line\n"),
            truncated: false,
        });
        expect(fsModule.promises.open).toHaveBeenCalledWith(logPath, "r");

        await expect(host.browse(event)).resolves.toBe(true);
        expect(shell.showItemInFolder).toHaveBeenCalledWith(logPath);
    });

    it("reads only the requested tail bytes by default", async () => {
        const logPath = "/tmp/mysqlsh.log";
        const { fileHandles, host, windows } = createHost(new Map([[logPath, "0123456789"]]));
        host.openFileViewerWindow(logPath);

        await expect(host.read({
            sender: windows[0].webContents,
            senderFrame: { url: trustedFileViewerUrl },
        }, { maxBytes: 4 })).resolves.toEqual({
            content: "6789",
            fileName: "mysqlsh.log",
            filePath: logPath,
            offset: 6,
            size: 10,
            truncated: true,
        });

        expect(fileHandles[0].read).toHaveBeenCalledWith(expect.any(Buffer), 0, 4, 6);
        expect(fileHandles[0].close).toHaveBeenCalledOnce();
    });

    it("reads appended bytes from the requested offset", async () => {
        const logPath = "/tmp/mysqlsh.log";
        const previousContent = "first line\nsecond line\n";
        const { fileHandles, host, windows } = createHost(new Map([[logPath, `${previousContent}TAIL`]]));
        host.openFileViewerWindow(logPath);

        await expect(host.read({
            sender: windows[0].webContents,
            senderFrame: { url: trustedFileViewerUrl },
        }, {
            maxBytes: 1024,
            offset: Buffer.byteLength(previousContent),
        })).resolves.toEqual({
            content: "TAIL",
            fileName: "mysqlsh.log",
            filePath: logPath,
            offset: Buffer.byteLength(previousContent),
            size: Buffer.byteLength(`${previousContent}TAIL`),
            truncated: true,
        });

        expect(fileHandles[0].read).toHaveBeenCalledWith(expect.any(Buffer), 0, 4, Buffer.byteLength(previousContent));
    });

    it("caps oversized append ranges to the latest tail", async () => {
        const logPath = "/tmp/mysqlsh.log";
        const { host, windows } = createHost(new Map([[logPath, "0123456789"]]));
        host.openFileViewerWindow(logPath);

        await expect(host.read({
            sender: windows[0].webContents,
            senderFrame: { url: trustedFileViewerUrl },
        }, {
            maxBytes: 4,
            offset: 1,
        })).resolves.toMatchObject({
            content: "6789",
            offset: 6,
            size: 10,
            truncated: true,
        });
    });

    it("reads explicit ranges without falling back to the latest tail", async () => {
        const logPath = "/tmp/mysqlsh.log";
        const { fileHandles, host, windows } = createHost(new Map([[logPath, "0123456789"]]));
        host.openFileViewerWindow(logPath);

        await expect(host.read({
            sender: windows[0].webContents,
            senderFrame: { url: trustedFileViewerUrl },
        }, {
            maxBytes: 4,
            offset: 2,
            readMode: "range",
        })).resolves.toEqual({
            content: "2345",
            fileName: "mysqlsh.log",
            filePath: logPath,
            offset: 2,
            size: 10,
            truncated: true,
        });

        expect(fileHandles[0].read).toHaveBeenCalledWith(expect.any(Buffer), 0, 4, 2);
    });

    it("rejects IPC calls from untrusted URLs and unknown senders", async () => {
        const { appendDesktopLog, host, shell } = createHost();
        const unknownSender = createFakeWebContents();

        await expect(host.read({
            sender: unknownSender,
            senderFrame: { url: "app://renderer/index.html" },
        })).resolves.toEqual({ error: "Unable to read file." });
        await expect(host.browse({
            sender: unknownSender,
            senderFrame: { url: trustedFileViewerUrl },
        })).resolves.toBe(false);

        expect(shell.showItemInFolder).not.toHaveBeenCalled();
        expect(appendDesktopLog).toHaveBeenCalledWith(expect.stringContaining("non-viewer URL"));
        expect(appendDesktopLog).toHaveBeenCalledWith(expect.stringContaining("unknown sender"));
    });

    it("returns read errors without exposing the exception", async () => {
        const logPath = "/tmp/mysqlsh.log";
        const { appendDesktopLog, fsModule, host, windows } = createHost(new Map([[logPath, "content"]]));
        host.openFileViewerWindow(logPath);
        fsModule.promises.open.mockRejectedValueOnce(new Error("permission denied"));

        await expect(host.read({
            sender: windows[0].webContents,
            senderFrame: { url: trustedFileViewerUrl },
        })).resolves.toEqual({ error: "permission denied" });

        expect(appendDesktopLog).toHaveBeenCalledWith(expect.stringContaining("file viewer read failed"));
    });
});
