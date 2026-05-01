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

const createFileViewerHost = ({
    BrowserWindow,
    fs,
    path,
    shell,
    nativeTheme,
    appendDesktopLog,
    ensureDirectory,
    fileViewerEntryUrl,
    fileViewerPreloadPath,
    installNavigationGuards,
    isTrustedFileViewerUrl,
    setTimeoutFn = setTimeout,
}) => {
    const defaultMaximumReadBytes = 1024 * 1024;
    const hardMaximumReadBytes = 20 * 1024 * 1024;
    const fileViewerPathByWebContents = new WeakMap();
    const fileViewerWindowByPath = new Map();

    const prepareFileForViewing = (filePath) => {
        ensureDirectory(path.dirname(filePath));
        fs.writeFileSync(filePath, "", { flag: "a" });
    };

    const getFileViewerPath = (event) => {
        const senderUrl = event.senderFrame?.url ?? event.sender.getURL();
        if (!isTrustedFileViewerUrl(senderUrl)) {
            appendDesktopLog(`blocked file viewer IPC from non-viewer URL ${senderUrl}`);

            return undefined;
        }

        const filePath = fileViewerPathByWebContents.get(event.sender);
        if (!filePath) {
            appendDesktopLog("blocked file viewer IPC from unknown sender");
        }

        return filePath;
    };

    const openFileViewerWindow = (filePath) => {
        const existingWindow = fileViewerWindowByPath.get(filePath);
        if (existingWindow && !existingWindow.isDestroyed()) {
            existingWindow.show();
            existingWindow.focus();
            return;
        }

        try {
            prepareFileForViewing(filePath);
        } catch (error) {
            appendDesktopLog(`failed to prepare file for viewing ${filePath}: ${error.stack ?? error.message}`);

            return;
        }

        const viewerWindow = new BrowserWindow({
            width: 900,
            height: 650,
            minWidth: 520,
            minHeight: 320,
            title: path.basename(filePath),
            backgroundColor: nativeTheme.shouldUseDarkColors ? "#1e1e1e" : "#ffffff",
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                preload: fileViewerPreloadPath,
                sandbox: true,
            },
        });

        fileViewerPathByWebContents.set(viewerWindow.webContents, filePath);
        fileViewerWindowByPath.set(filePath, viewerWindow);
        installNavigationGuards(viewerWindow.webContents);

        let closeInProgress = false;
        viewerWindow.on("close", (event) => {
            if (closeInProgress) {
                return;
            }

            closeInProgress = true;
            event.preventDefault();
            viewerWindow.hide();
            fileViewerPathByWebContents.delete(viewerWindow.webContents);
            void viewerWindow.webContents.executeJavaScript("document.activeElement?.blur();", true)
                .catch((error) => {
                    appendDesktopLog(`file viewer blur before close failed: ${error.stack ?? error.message}`);
                })
                .finally(() => {
                    setTimeoutFn(() => {
                        if (!viewerWindow.isDestroyed()) {
                            viewerWindow.destroy();
                        }
                    }, 0);
                });
        });

        viewerWindow.on("closed", () => {
            fileViewerWindowByPath.delete(filePath);
        });

        void viewerWindow.loadURL(fileViewerEntryUrl);
    };

    const normalizeReadRequest = (request, fileSize) => {
        const requestedMaximum = Number(request?.maxBytes);
        const maxBytes = Number.isFinite(requestedMaximum) && requestedMaximum > 0
            ? Math.min(Math.floor(requestedMaximum), hardMaximumReadBytes)
            : defaultMaximumReadBytes;

        const readMode = request?.readMode === "range" ? "range" : "tail";
        const requestedOffset = Number(request?.offset);
        let offset;

        if (readMode === "range") {
            offset = Number.isFinite(requestedOffset) && requestedOffset >= 0
                ? Math.min(Math.floor(requestedOffset), fileSize)
                : 0;
        } else {
            offset = Number.isFinite(requestedOffset) && requestedOffset >= 0
                ? Math.floor(requestedOffset)
                : Math.max(0, fileSize - maxBytes);

            if (offset > fileSize || fileSize - offset > maxBytes) {
                offset = Math.max(0, fileSize - maxBytes);
            }
        }

        return {
            length: Math.max(0, Math.min(maxBytes, fileSize - offset)),
            offset,
        };
    };

    const readFileRange = async (filePath, offset, length) => {
        if (length === 0) {
            return "";
        }

        const fileHandle = await fs.promises.open(filePath, "r");
        try {
            const buffer = Buffer.alloc(length);
            const { bytesRead } = await fileHandle.read(buffer, 0, length, offset);

            return buffer.subarray(0, bytesRead).toString("utf8");
        } finally {
            await fileHandle.close();
        }
    };

    const read = async (event, request) => {
        const filePath = getFileViewerPath(event);
        if (!filePath) {
            return { error: "Unable to read file." };
        }

        try {
            prepareFileForViewing(filePath);
            const stats = await fs.promises.stat(filePath);
            const { offset, length } = normalizeReadRequest(request, stats.size);
            const content = await readFileRange(filePath, offset, length);

            return {
                content,
                fileName: path.basename(filePath),
                filePath,
                offset,
                size: stats.size,
                truncated: offset > 0,
            };
        } catch (error) {
            appendDesktopLog(`file viewer read failed path=${filePath} error=${error.stack ?? error.message}`);

            return { error: error.message };
        }
    };

    const browse = async (event) => {
        const filePath = getFileViewerPath(event);
        if (!filePath) {
            return false;
        }

        try {
            prepareFileForViewing(filePath);
            shell.showItemInFolder(filePath);

            return true;
        } catch (error) {
            appendDesktopLog(`file viewer browse failed path=${filePath} error=${error.stack ?? error.message}`);

            return false;
        }
    };

    return {
        browse,
        getFileViewerPath,
        openFileViewerWindow,
        prepareFileForViewing,
        read,
    };
};

module.exports = {
    createFileViewerHost,
};
