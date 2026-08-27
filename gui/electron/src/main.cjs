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

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { handleVersionCommand } = require("./version-command.cjs");

if (handleVersionCommand(process.argv, require("../package.json"))) {
    process.exit(0);
}

const {
    app,
    BrowserWindow,
    Menu,
    dialog,
    ipcMain,
    nativeTheme,
    protocol,
    screen,
    shell,
} = require("electron");
const { buildNativeMenuTemplate, resolvePositioningItem, translatePopupCoordinates } = require("./native-menu.cjs");
const { createFileViewerHost } = require("./file-viewer-host.cjs");
const { buildMysqlShellArguments, parseMysqlShellExtraArguments } = require("./mysqlsh-arguments.cjs");
const { hasCommunicationDebugger } = require("./mysqlsh-runtime.cjs");
const { createPrivateFiles } = require("./private-files.cjs");

const { ensurePrivateDirectory, ensurePrivateFile, privateFileMode } = createPrivateFiles();

const appRootDir = path.resolve(__dirname, "..");
const bundledFrontendBuildDir = path.join(appRootDir, "frontend", "build");
const bundledShellDir = path.join(appRootDir, "shell");
const bundledImagesDir = path.join(appRootDir, "images");
const isBundledRuntime = fs.existsSync(bundledFrontendBuildDir) && fs.existsSync(path.join(bundledShellDir, "bin"));
const frontendBuildDir = isBundledRuntime ? bundledFrontendBuildDir : path.resolve(__dirname, "../../frontend/build");
const preloadPath = path.resolve(__dirname, "./preload.cjs");
const fileViewerPreloadPath = path.resolve(__dirname, "./file-viewer-preload.cjs");
const adminPageDefinitionsPath = isBundledRuntime
    ? path.join(appRootDir, "frontend", "src", "data-models", "admin-pages.json")
    : path.resolve(__dirname, "../../frontend/src/data-models/admin-pages.json");
const adminPageDefinitions = require(adminPageDefinitionsPath);

const parseCommandLineArguments = (argv) => {
    const result = {};

    for (let index = 1; index < argv.length; index += 1) {
        const argument = argv[index];
        if (!argument.startsWith("--")) {
            continue;
        }

        const option = argument.slice(2);
        const equalsIndex = option.indexOf("=");
        if (equalsIndex >= 0) {
            result[option.slice(0, equalsIndex)] = option.slice(equalsIndex + 1);
            continue;
        }

        const next = argv[index + 1];
        if (next && !next.startsWith("--")) {
            result[option] = next;
            index += 1;
        } else {
            result[option] = "true";
        }
    }

    return result;
};

const commandLineArguments = parseCommandLineArguments(process.argv);
const explicitMysqlShellRuntimeDir = commandLineArguments["mysqlsh-runtime-dir"] ?? process.env.ELECTRON_MYSQLSH_RUNTIME_DIR;
const mysqlshRuntimeDir = explicitMysqlShellRuntimeDir
    ? path.resolve(explicitMysqlShellRuntimeDir)
    : (isBundledRuntime ? bundledShellDir : undefined);
const communicationDebuggerAvailable = hasCommunicationDebugger(mysqlshRuntimeDir);
const shouldUseHiddenE2EWindow = commandLineArguments["electron-e2e-background"] === "true"
    || process.env.ELECTRON_E2E_BACKGROUND === "1"
    || process.env.ELECTRON_E2E_BACKGROUND === "true";
const explicitUserDataDir = commandLineArguments["electron-user-data-dir"];
if (typeof explicitUserDataDir === "string" && explicitUserDataDir.length > 0) {
    app.setPath("userData", path.resolve(explicitUserDataDir));
}

const isPrimaryInstance = app.requestSingleInstanceLock();
if (!isPrimaryInstance) {
    app.exit(0);
}

const windowStatePath = path.join(app.getPath("userData"), "window-state.json");
const recentFilesPath = path.join(app.getPath("userData"), "recent-files.json");
const desktopLogPath = path.join(app.getPath("userData"), "MySQL Workbench-electron.log");
ensurePrivateDirectory(app.getPath("userData"));

const appendDesktopLog = (message) => {
    const line = `[${new Date().toISOString()}] ${message}\n`;

    try {
        fs.appendFileSync(desktopLogPath, line, { mode: privateFileMode });
    } catch (_error) {
        // Best-effort logging only.
    }
};

const getMacAppBundlePath = () => {
    if (process.platform !== "darwin") {
        return undefined;
    }

    const marker = `${path.sep}Contents${path.sep}MacOS${path.sep}`;
    const markerIndex = process.execPath.indexOf(marker);
    if (markerIndex <= 0) {
        return undefined;
    }

    const bundlePath = process.execPath.slice(0, markerIndex);

    return bundlePath.endsWith(".app") ? bundlePath : undefined;
};

const hasValidMacCodeSignature = (bundlePath) => {
    const result = spawnSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", bundlePath], {
        stdio: "ignore",
    });

    return result.status === 0;
};

const macAppBundlePath = getMacAppBundlePath();
const needsBundledRuntimeStartupWorkaround = isBundledRuntime
    && macAppBundlePath !== undefined
    && !hasValidMacCodeSignature(macAppBundlePath);

appendDesktopLog(
    `startup isBundledRuntime=${isBundledRuntime} mysqlshRuntimeDir=${mysqlshRuntimeDir ?? ""} ` +
    `frontendBuildDir=${frontendBuildDir}`,
);

if (needsBundledRuntimeStartupWorkaround) {
    // The bundled runtime layout is also used by locally assembled, unsigned app
    // bundles. On newer macOS builds those bundles can fail while starting
    // Chromium helper processes, especially GPU and sandboxed network helpers.
    // Keep the stricter defaults for repo-dev and valid signed packaged bundles;
    // these switches are a compatibility workaround for unsigned/invalid
    // bundled-runtime startup and should not be treated as the desired
    // production security posture.
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch("disable-gpu");
    app.commandLine.appendSwitch("disable-gpu-compositing");
    // Avoid starting Chromium's network service inside its own sandbox.
    app.commandLine.appendSwitch("disable-features", "NetworkServiceSandbox");
    // Broadly disables Chromium process sandboxing. Keep this limited to the
    // unsigned/invalid bundled-runtime workaround path and remove it once local
    // bundles do not need the helper-process workaround.
    app.commandLine.appendSwitch("no-sandbox");
    appendDesktopLog("applied bundled-runtime Chromium startup switches");
}

protocol.registerSchemesAsPrivileged([
    {
        scheme: "app",
        privileges: {
            secure: true,
            standard: true,
            supportFetchAPI: true,
            stream: true,
        },
    },
]);

const appName = "MySQL Workbench";
const migrationAssistantTitle = "MySQL Cloud Migration Assistant";
const isMac = process.platform === "darwin";
const workbenchHelpUrl = "https://dev.mysql.com/doc/mysql-shell-gui/en/";
const desktopOpenSupportedFileResourceId = "desktopOpenSupportedFile";
const supportedRecentFileExtensions = new Set([
    ".sql",
    ".mysql",
    ".js",
    ".ts",
    ".mysql-notebook",
]);
const contentTypeByExtension = new Map([
    [".css", "text/css; charset=utf-8"],
    [".gif", "image/gif"],
    [".html", "text/html; charset=utf-8"],
    [".ico", "image/x-icon"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".map", "application/json; charset=utf-8"],
    [".mjs", "text/javascript; charset=utf-8"],
    [".png", "image/png"],
    [".svg", "image/svg+xml"],
    [".ttf", "font/ttf"],
    [".txt", "text/plain; charset=utf-8"],
    [".wasm", "application/wasm"],
    [".webp", "image/webp"],
    [".woff", "font/woff"],
    [".woff2", "font/woff2"],
]);
const externalUrlProtocols = new Set(["http:", "https:", "mailto:"]);

const openExternalUrl = (url) => {
    try {
        const externalUrl = new URL(String(url));

        if (!externalUrlProtocols.has(externalUrl.protocol)) {
            appendDesktopLog(`blocked unsupported external URL protocol: ${externalUrl.protocol}`);

            return false;
        }

        void shell.openExternal(externalUrl.href).catch((error) => {
            appendDesktopLog(`openExternal failed for ${externalUrl.href}: ${error.stack ?? error.message}`);
        });

        return true;
    } catch (error) {
        appendDesktopLog(`blocked invalid external URL: ${error.stack ?? error.message}`);

        return false;
    }
};

const isTrustedRendererUrl = (url) => {
    try {
        const parsedUrl = new URL(String(url));

        if (parsedUrl.protocol === "app:" && parsedUrl.hostname === "renderer") {
            return true;
        }

        if (!isRendererDevMode) {
            return false;
        }

        return parsedUrl.origin === rendererTrustedOrigin;
    } catch (_error) {
        return false;
    }
};

const isTrustedFileViewerUrl = (url) => {
    if (!isTrustedRendererUrl(url)) {
        return false;
    }

    try {
        const parsedUrl = new URL(String(url));

        return parsedUrl.searchParams.get("view") === "fileViewer";
    } catch (_error) {
        return false;
    }
};

const blockUntrustedNavigation = (event, url, eventName) => {
    if (isTrustedRendererUrl(url)) {
        return;
    }

    event.preventDefault();
    appendDesktopLog(`blocked untrusted ${eventName} to ${url}`);
    openExternalUrl(url);
};

const navigationGuardedWebContents = new WeakSet();

const installNavigationGuards = (webContents) => {
    if (navigationGuardedWebContents.has(webContents)) {
        return;
    }

    navigationGuardedWebContents.add(webContents);

    webContents.setWindowOpenHandler(({ url }) => {
        openExternalUrl(url);

        return { action: "deny" };
    });

    webContents.on("will-navigate", (event, url) => {
        blockUntrustedNavigation(event, url, "navigation");
    });

    webContents.on("will-redirect", (event, url, _isInPlace, isMainFrame) => {
        if (isMainFrame === false) {
            return;
        }

        blockUntrustedNavigation(event, url, "redirect");
    });
};

const rendererDevUrl = process.env.ELECTRON_RENDERER_URL ?? commandLineArguments["renderer-url"];
const buildRendererUrl = (pathAndSearch = "/") => {
    return rendererDevUrl
        ? new URL(pathAndSearch, rendererDevUrl).toString()
        : `app://renderer${pathAndSearch}`;
};
const rendererEntryUrl = buildRendererUrl("/");
const fileViewerEntryUrl = buildRendererUrl("/index.html?view=fileViewer");
const migrationAssistantEntryUrl = buildRendererUrl("/index.html?subApp=migration");
const isRendererDevMode = Boolean(rendererDevUrl);
const rendererTrustedOrigin = isRendererDevMode ? new URL(rendererEntryUrl).origin : undefined;

const resolveDesktopIconPath = () => {
    const baseDirectory = isBundledRuntime ? bundledImagesDir : path.resolve(__dirname, "../images");
    const preferredExtension = process.platform === "win32" ? ".ico" : ".png";
    const preferredPath = path.join(baseDirectory, `app-icon${preferredExtension}`);

    if (fs.existsSync(preferredPath)) {
        return preferredPath;
    }

    return path.join(baseDirectory, "app-icon.png");
};

const desktopIconPath = resolveDesktopIconPath();

const defaultWindowState = {
    width: 1400,
    height: 950,
    zoomFactor: 1,
};

const isFiniteNumber = (value) => {
    return typeof value === "number" && Number.isFinite(value);
};

const readWindowState = () => {
    try {
        const content = fs.readFileSync(windowStatePath, "utf8");
        const parsed = JSON.parse(content);

        return {
            width: isFiniteNumber(parsed.width) ? parsed.width : defaultWindowState.width,
            height: isFiniteNumber(parsed.height) ? parsed.height : defaultWindowState.height,
            x: isFiniteNumber(parsed.x) ? parsed.x : undefined,
            y: isFiniteNumber(parsed.y) ? parsed.y : undefined,
            isMaximized: parsed.isMaximized === true,
            zoomFactor: clampZoomFactor(isFiniteNumber(parsed.zoomFactor) ? parsed.zoomFactor : defaultWindowState.zoomFactor),
        };
    } catch (_error) {
        return { ...defaultWindowState, isMaximized: false };
    }
};

const intersectsAnyDisplay = ({ x, y, width, height }) => {
    if (![x, y, width, height].every(isFiniteNumber)) {
        return false;
    }

    return screen.getAllDisplays().some(({ workArea }) => {
        return x < workArea.x + workArea.width
            && x + width > workArea.x
            && y < workArea.y + workArea.height
            && y + height > workArea.y;
    });
};

const writeWindowState = (windowState) => {
    try {
        fs.writeFileSync(windowStatePath, JSON.stringify(windowState, null, 2), { mode: privateFileMode });
    } catch (error) {
        appendDesktopLog(`failed to persist window state: ${error.message}`);
    }
};

const readRecentFiles = () => {
    try {
        const content = fs.readFileSync(recentFilesPath, "utf8");
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter((entry) => typeof entry === "string")
            .filter((entry) => supportedRecentFileExtensions.has(path.extname(entry).toLowerCase()))
            .slice(0, 10);
    } catch (_error) {
        return [];
    }
};

const writeRecentFiles = (recentFiles) => {
    try {
        fs.writeFileSync(recentFilesPath, JSON.stringify(recentFiles, null, 2), { mode: privateFileMode });
    } catch (error) {
        appendDesktopLog(`failed to persist recent files: ${error.message}`);
    }
};

const resolveShellUserConfigDir = () => path.join(app.getPath("userData"), "mysqlsh");

const shellUserConfigDir = resolveShellUserConfigDir();
ensurePrivateDirectory(shellUserConfigDir);

const resolveMysqlShellBinary = () => {
    if (!mysqlshRuntimeDir) {
        throw new Error("No MySQL Shell runtime configured. Set ELECTRON_MYSQLSH_RUNTIME_DIR.");
    }

    const binary = path.join(mysqlshRuntimeDir, "bin", process.platform === "win32" ? "mysqlsh.exe" : "mysqlsh");
    appendDesktopLog(`using mysqlsh runtime at ${binary}`);

    return binary;
};

const buildApplicationData = () => {
    return {
        logPath: path.join(shellUserConfigDir, "mysqlsh.log"),
        projectsPath: path.join(shellUserConfigDir, "plugin_data", "gui_plugin", "migration"),
    };
};

const fileViewerHost = createFileViewerHost({
    BrowserWindow,
    fs,
    path,
    shell,
    nativeTheme,
    appendDesktopLog,
    fileViewerEntryUrl,
    fileViewerPreloadPath,
    installNavigationGuards,
    isTrustedFileViewerUrl,
    ensurePrivateFile,
    privateFileMode,
});

const openMysqlShellLogFile = () => {
    fileViewerHost.openFileViewerWindow(buildApplicationData().logPath);
};

const toDialogFilters = (filters = {}) => {
    if (!filters || typeof filters !== "object") {
        return undefined;
    }

    return Object.entries(filters)
        .filter(([, extensions]) => Array.isArray(extensions) && extensions.length > 0)
        .map(([name, extensions]) => {
            return {
                name,
                extensions: extensions
                    .filter((entry) => typeof entry === "string" && entry.length > 0)
                    .map((entry) => entry.startsWith(".") ? entry.slice(1) : entry),
            };
        })
        .filter((entry) => entry.extensions.length > 0);
};

const toArrayBuffer = (buffer) => {
    return Uint8Array.from(buffer).buffer;
};

const recentFilesByWindow = new WeakMap();
let persistedRecentFiles = readRecentFiles();

const getRecentFiles = (browserWindow) => {
    let entries = recentFilesByWindow.get(browserWindow);
    if (!entries) {
        entries = [...persistedRecentFiles];
        recentFilesByWindow.set(browserWindow, entries);
    }

    return entries;
};

const isSupportedRecentFile = (filePath) => {
    return typeof filePath === "string" && supportedRecentFileExtensions.has(path.extname(filePath).toLowerCase());
};

const addRecentFile = (browserWindow, filePath) => {
    if (!isSupportedRecentFile(filePath)) {
        return;
    }

    const recentFiles = getRecentFiles(browserWindow);
    const normalizedPath = path.normalize(filePath);
    const existingIndex = recentFiles.indexOf(normalizedPath);
    const hadSameLeadingEntry = recentFiles[0] === normalizedPath;
    if (existingIndex > -1) {
        recentFiles.splice(existingIndex, 1);
    }

    recentFiles.unshift(normalizedPath);
    if (recentFiles.length > 10) {
        recentFiles.length = 10;
    }
    persistedRecentFiles = [...recentFiles];
    writeRecentFiles(persistedRecentFiles);

    if (!hadSameLeadingEntry) {
        rebuildApplicationMenu();
    }
};

const removeRecentFile = (browserWindow, filePath) => {
    const recentFiles = getRecentFiles(browserWindow);
    const normalizedPath = path.normalize(filePath);
    const existingIndex = recentFiles.indexOf(normalizedPath);
    if (existingIndex > -1) {
        recentFiles.splice(existingIndex, 1);
        persistedRecentFiles = [...recentFiles];
        writeRecentFiles(persistedRecentFiles);
        rebuildApplicationMenu();
    }
};

const sendSelectedFiles = (browserWindow, resourceId, files) => {
    sendHostMessage(browserWindow, "selectFile", {
        resourceId,
        file: files,
    });
};

const showOpenDialog = async (browserWindow, options, readContents = false) => {
    const filePaths = await dialog.showOpenDialog(browserWindow, {
        defaultPath: typeof options?.default === "string" && options.default.length > 0 ? options.default : undefined,
        buttonLabel: typeof options?.openLabel === "string" ? options.openLabel : undefined,
        title: typeof options?.title === "string" ? options.title : undefined,
        properties: [
            ...(options?.canSelectFiles === false ? [] : ["openFile"]),
            ...(options?.canSelectFolders ? ["openDirectory"] : []),
            ...(options?.canSelectMany ? ["multiSelections"] : []),
        ],
        filters: toDialogFilters(options?.filters),
    });

    if (filePaths.canceled || filePaths.filePaths.length === 0) {
        return;
    }

    const files = await Promise.all(filePaths.filePaths.map(async (filePath) => {
        const content = readContents ? toArrayBuffer(await fs.promises.readFile(filePath)) : new ArrayBuffer(0);

        return { path: filePath, content };
    }));

    filePaths.filePaths.forEach((filePath) => {
        addRecentFile(browserWindow, filePath);
    });

    sendSelectedFiles(browserWindow, options?.id ?? "", files);
};

const showSaveDialog = async (browserWindow, options) => {
    const result = await dialog.showSaveDialog(browserWindow, {
        defaultPath: typeof options?.default === "string" && options.default.length > 0 ? options.default : undefined,
        buttonLabel: typeof options?.saveLabel === "string" ? options.saveLabel : undefined,
        title: typeof options?.title === "string" ? options.title : undefined,
        filters: toDialogFilters(options?.filters),
    });

    if (result.canceled || !result.filePath) {
        return;
    }

    sendSelectedFiles(browserWindow, options?.id ?? "", [{
        path: result.filePath,
        content: new ArrayBuffer(0),
    }]);
};

const saveFile = async (browserWindow, payload) => {
    if (typeof payload?.content !== "string") {
        throw new Error("saveFile requires string content.");
    }

    const result = await dialog.showSaveDialog(browserWindow, {
        defaultPath: typeof payload?.default === "string" && payload.default.length > 0 ? payload.default : undefined,
        buttonLabel: typeof payload?.saveLabel === "string" ? payload.saveLabel : undefined,
        title: typeof payload?.title === "string" ? payload.title : undefined,
        filters: toDialogFilters(payload?.filters),
    });

    if (result.canceled || !result.filePath) {
        return;
    }

    await fs.promises.writeFile(
        result.filePath,
        payload.content,
        payload?.encoding === "base64" ? "base64" : "utf8",
    );
    addRecentFile(browserWindow, result.filePath);
};

const buildScriptDialogFilters = (language) => {
    switch (language) {
        case "mysql":
        case "sql":
            return [{
                name: "SQL",
                extensions: ["sql"],
            }];
        case "typescript":
            return [{
                name: "TypeScript",
                extensions: ["ts"],
            }];
        case "javascript":
            return [{
                name: "JavaScript",
                extensions: ["js"],
            }];
        default:
            return undefined;
    }
};

const scriptSaveTargetsByWindow = new WeakMap();

const getScriptSaveTargets = (browserWindow) => {
    let targets = scriptSaveTargetsByWindow.get(browserWindow);
    if (!targets) {
        targets = new Map();
        scriptSaveTargetsByWindow.set(browserWindow, targets);
    }

    return targets;
};

const saveScript = async (browserWindow, payload) => {
    if (typeof payload?.id !== "string" || payload.id.length === 0) {
        throw new Error("editorSaveScript requires a script id.");
    }

    if (typeof payload?.content !== "string") {
        throw new Error("editorSaveScript requires string content.");
    }

    const targets = getScriptSaveTargets(browserWindow);
    const rememberedPath = targets.get(payload.id);
    const existingPath = typeof payload?.fileName === "string" && payload.fileName.length > 0
        ? payload.fileName
        : rememberedPath;
    const defaultPath = existingPath
        ?? (typeof payload?.caption === "string" && payload.caption.length > 0 ? payload.caption : undefined);
    let targetPath = payload?.saveAs ? undefined : existingPath;

    if (!targetPath) {
        const result = await dialog.showSaveDialog(browserWindow, {
            title: "Save Script File",
            defaultPath,
            filters: buildScriptDialogFilters(payload?.language),
        });

        if (result.canceled || !result.filePath) {
            return;
        }

        targetPath = result.filePath;
    }

    targets.set(payload.id, targetPath);
    await fs.promises.writeFile(targetPath, payload.content, "utf8");
    addRecentFile(browserWindow, targetPath);
    sendHostMessage(browserWindow, "editorRenameScript", {
        ...payload,
        caption: path.basename(targetPath),
        fileName: targetPath,
    });
};

const saveNotebook = async (browserWindow, payload) => {
    const defaultNotebookPath = typeof payload?.fileName === "string" && payload.fileName.length > 0
        ? payload.fileName
        : typeof payload?.defaultFileName === "string" && payload.defaultFileName.length > 0
            ? payload.defaultFileName
            : "Untitled.mysql-notebook";
    let targetPath = typeof payload?.fileName === "string" && payload.fileName.length > 0
        ? payload.fileName
        : undefined;

    if (!targetPath || payload?.saveAs) {
        const result = await dialog.showSaveDialog(browserWindow, {
            title: "Save MySQL Notebook",
            defaultPath: defaultNotebookPath,
            filters: [{
                name: "MySQL Notebook",
                extensions: ["mysql-notebook"],
            }],
        });

        if (result.canceled || !result.filePath) {
            return;
        }

        targetPath = result.filePath;
    }

    if (typeof payload?.content !== "string") {
        throw new Error("editorSaveNotebook requires string content.");
    }

    await fs.promises.writeFile(targetPath, payload.content, "utf8");
    addRecentFile(browserWindow, targetPath);
    sendHostMessage(browserWindow, "editorSaveNotebook", {
        id: payload?.id,
        fileName: targetPath,
    });
};

const openRecentFile = async (browserWindow, filePath) => {
    if (!isSupportedRecentFile(filePath)) {
        return;
    }

    try {
        const normalizedPath = path.normalize(filePath);
        const content = toArrayBuffer(await fs.promises.readFile(normalizedPath));
        addRecentFile(browserWindow, normalizedPath);
        sendSelectedFiles(browserWindow, desktopOpenSupportedFileResourceId, [{
            path: normalizedPath,
            content,
        }]);
    } catch (error) {
        removeRecentFile(browserWindow, filePath);
        rebuildApplicationMenu();
        appendDesktopLog(`openRecentFile failed path=${filePath} error=${error.stack ?? error.message}`);
        void dialog.showErrorBox("Open Recent Failed", error.message);
    }
};

const buildHostThemeData = () => {
    const dark = nativeTheme.shouldUseDarkColors;
    const themeClass = dark ? "Dark Modern" : "Light Modern";
    const commonStyles = {
        "--vscode-font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        "--vscode-font-size": "13px",
        "--vscode-font-weight": "400",
        "--vscode-editor-font-family": "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
        "--vscode-editor-font-size": "13px",
    };

    const styles = dark
        ? {
            ...commonStyles,
            "--vscode-foreground": "#d4d4d4",
            "--vscode-editor-foreground": "#d4d4d4",
            "--vscode-editor-background": "#1f1f1f",
            "--vscode-sideBar-background": "#181818",
            "--vscode-panel-background": "#1f1f1f",
            "--vscode-titleBar-activeBackground": "#181818",
            "--vscode-titleBar-activeForeground": "#f4f4f4",
        }
        : {
            ...commonStyles,
            "--vscode-foreground": "#24292f",
            "--vscode-editor-foreground": "#24292f",
            "--vscode-editor-background": "#ffffff",
            "--vscode-sideBar-background": "#f6f8fa",
            "--vscode-panel-background": "#ffffff",
            "--vscode-titleBar-activeBackground": "#f6f8fa",
            "--vscode-titleBar-activeForeground": "#24292f",
        };

    return {
        css: Object.entries(styles).map(([key, value]) => {
            return `${key}: ${value}`;
        }).join("; "),
        themeClass,
        themeName: themeClass,
        themeId: dark ? "electron-dark-modern" : "electron-light-modern",
    };
};

class DesktopBackendBridge {
    constructor(mainWindow) {
        this.windows = new Set([mainWindow]);
        this.process = undefined;
        this.connectPromise = undefined;
        this.bufferedMessages = [];
        this.pendingStdout = "";
        this.latestWebSessionMessage = undefined;
        this.windowByRequestId = new Map();
        this.ready = false;
    }

    addWindow(browserWindow) {
        this.windows.add(browserWindow);
    }

    removeWindow(browserWindow) {
        this.windows.delete(browserWindow);

        for (const [requestId, requestWindow] of this.windowByRequestId) {
            if (requestWindow === browserWindow) {
                this.windowByRequestId.delete(requestId);
            }
        }
    }

    sendToWindows(channel, payload) {
        for (const browserWindow of this.windows) {
            if (!browserWindow.isDestroyed()) {
                browserWindow.webContents.send(channel, payload);
            }
        }
    }

    sendToRequestWindow(parsed, line) {
        const requestId = parsed.request_id;
        if (typeof requestId !== "string") {
            return false;
        }

        const browserWindow = this.windowByRequestId.get(requestId);
        if (!browserWindow || browserWindow.isDestroyed()) {
            this.windowByRequestId.delete(requestId);

            return false;
        }

        browserWindow.webContents.send("electron-backend-message", line);

        if (isBackendTerminalResponse(parsed)) {
            this.windowByRequestId.delete(requestId);
        }

        return true;
    }

    async connect() {
        if (this.ready && this.process && !this.process.killed) {
            return this.latestWebSessionMessage ? [this.latestWebSessionMessage] : [];
        }

        if (this.connectPromise) {
            return this.connectPromise;
        }

        this.bufferedMessages = [];
        this.pendingStdout = "";
        this.ready = false;

        const mysqlshBinary = resolveMysqlShellBinary();
        const mysqlshArguments = buildMysqlShellArguments({
            extraArguments: parseMysqlShellExtraArguments(process.env.MYSQLSH_GUI_EXTRA_ARGS),
        });
        const startupErrors = [];

        this.connectPromise = new Promise((resolve, reject) => {
            const backendProcess = spawn(mysqlshBinary, mysqlshArguments, {
                env: {
                    ...process.env,
                    LOG_LEVEL: "NONE",
                    MYSQLSH_TERM_COLOR_MODE: "nocolor",
                    MYSQLSH_USER_CONFIG_HOME: shellUserConfigDir,
                },
                stdio: ["pipe", "pipe", "pipe"],
            });

            this.process = backendProcess;

            const rejectStartup = (message) => {
                this.connectPromise = undefined;
                if (this.process === backendProcess) {
                    this.process = undefined;
                }
                reject(new Error(message));
            };

            backendProcess.on("error", (error) => {
                appendDesktopLog(`mysqlsh spawn error: ${error.message}`);
                rejectStartup(`Unable to start mysqlsh (${error.message}).`);
            });

            backendProcess.on("exit", (code, signal) => {
                const startupError = startupErrors.join("\n").trim();
                const reason = startupError
                    || `mysqlsh exited before the desktop bridge was ready (code=${code}, signal=${signal ?? "none"}).`;

                appendDesktopLog(`mysqlsh exited ready=${this.ready} code=${code} signal=${signal ?? "none"} reason=${reason}`);

                this.connectPromise = undefined;
                if (this.process === backendProcess) {
                    this.process = undefined;
                }
                this.ready = false;

                if (!backendProcess.killed) {
                    this.sendToWindows("electron-backend-close");
                }

                if (!this.bufferedMessages.length) {
                    reject(new Error(reason));
                }
            });

            backendProcess.stderr.on("data", (chunk) => {
                const message = chunk.toString().trim();
                if (!message) {
                    return;
                }

                startupErrors.push(message);
                appendDesktopLog(`mysqlsh stderr: ${message}`);
                console.error(`[mysqlsh] ${message}`);
            });

            backendProcess.stdout.on("data", (chunk) => {
                this.consumeStdout(chunk.toString(), (line) => {
                    let parsed;
                    try {
                        parsed = JSON.parse(line);
                    } catch (error) {
                        if (!this.ready) {
                            appendDesktopLog(`unexpected mysqlsh stdout before ready: ${line}`);
                            rejectStartup(`Unexpected non-JSON output from mysqlsh: ${line}`);
                        }

                        return;
                    }

                    if (parsed.event === "ready") {
                        appendDesktopLog("mysqlsh desktop bridge ready");
                        this.ready = true;
                        this.connectPromise = undefined;
                        resolve([...this.bufferedMessages]);
                        this.bufferedMessages = [];

                        return;
                    }

                    if (this.ready) {
                        if ("session_uuid" in parsed && parsed.session_uuid !== undefined) {
                            this.latestWebSessionMessage = line;
                        }

                        if (!this.sendToRequestWindow(parsed, line)) {
                            this.sendToWindows("electron-backend-message", line);
                        }
                    } else {
                        this.bufferedMessages.push(line);
                    }
                });
            });
        });

        return this.connectPromise;
    }

    async disconnect() {
        const currentProcess = this.process;
        this.connectPromise = undefined;
        this.process = undefined;
        this.ready = false;
        this.bufferedMessages = [];
        this.pendingStdout = "";
        this.latestWebSessionMessage = undefined;
        this.windowByRequestId.clear();

        if (!currentProcess || currentProcess.killed) {
            return;
        }

        currentProcess.kill();
    }

    send(payload, browserWindow) {
        if (!this.process || this.process.killed) {
            throw new Error("The mysqlsh desktop bridge is not running.");
        }

        try {
            const parsed = JSON.parse(payload);
            if (typeof parsed.request_id === "string") {
                this.windowByRequestId.set(parsed.request_id, browserWindow);
            }
        } catch (_error) {
            // Invalid payloads are still passed through so the backend can report the protocol error.
        }

        this.process.stdin.write(`${payload}\n`);
    }

    consumeStdout(chunk, onLine) {
        this.pendingStdout += chunk;

        let newlineIndex = this.pendingStdout.indexOf("\n");
        while (newlineIndex >= 0) {
            const line = this.pendingStdout.slice(0, newlineIndex).trim();
            this.pendingStdout = this.pendingStdout.slice(newlineIndex + 1);

            if (line.length > 0) {
                onLine(line);
            }

            newlineIndex = this.pendingStdout.indexOf("\n");
        }
    }
}

let mainWindow;
let backendBridge;
let migrationAssistantWindow;
const commandLineArgumentsByWebContents = new WeakMap();
const privilegedRendererWindows = new Set();
let runningMigrationWindow;
const migrationClosePromptWindows = new WeakSet();
let desktopCommandState = new Map();
let isShuttingDown = false;
let isQuitting = false;
const activeNativeMenuByWindow = new WeakMap();
const approvedWindowCloseByWindow = new WeakSet();
const windowCloseCheckByWindow = new WeakSet();
const pendingWindowCloseRequests = new Map();
let nextWindowCloseRequestId = 0;

if (isPrimaryInstance) {
    app.on("second-instance", () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            return;
        }

        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }

        if (!mainWindow.isVisible()) {
            mainWindow.show();
        }

        mainWindow.focus();
    });
}

const registerPrivilegedRendererWindow = (browserWindow) => {
    const { webContents } = browserWindow;
    privilegedRendererWindows.add(browserWindow);
    browserWindow.on("closed", () => {
        privilegedRendererWindows.delete(browserWindow);
        commandLineArgumentsByWebContents.delete(webContents);
        backendBridge?.removeWindow(browserWindow);
    });
};

const getCommandLineArgumentsForWindow = (browserWindow) => {
    return commandLineArgumentsByWebContents.get(browserWindow.webContents) ?? commandLineArguments;
};

const isBackendTerminalResponse = (message) => {
    const requestStateType = message?.request_state?.type;

    return requestStateType === "OK" || requestStateType === "ERROR" || requestStateType === "CANCELLED";
};

const getRunningMigrationWindow = () => {
    if (runningMigrationWindow?.isDestroyed()) {
        runningMigrationWindow = undefined;
    }

    return runningMigrationWindow;
};

const migrationIsRunning = () => {
    return getRunningMigrationWindow() !== undefined;
};

const getMigrationAssistantStartStatus = () => {
    if (migrationIsRunning()) {
        return {
            allowed: false,
            message: "A migration is currently running. Stop it before starting another migration.",
        };
    }

    if (migrationAssistantWindow && !migrationAssistantWindow.isDestroyed()) {
        return {
            allowed: false,
            message: "Migration Assistant is already open. Close it before starting another migration.",
        };
    }

    return { allowed: true };
};

const showMigrationRunningMessage = (browserWindow, detail) => {
    const runningWindow = getRunningMigrationWindow();
    const parentWindow = runningWindow ?? browserWindow;
    runningWindow?.show();
    runningWindow?.focus();

    if (!parentWindow || parentWindow.isDestroyed() || migrationClosePromptWindows.has(parentWindow)) {
        return;
    }

    migrationClosePromptWindows.add(parentWindow);
    void dialog.showMessageBox(parentWindow, {
        type: "warning",
        buttons: ["OK"],
        defaultId: 0,
        title: "Migration Running",
        message: "A migration is currently running.",
        detail,
    }).finally(() => {
        migrationClosePromptWindows.delete(parentWindow);
    });
};

const showMigrationAssistantAlreadyOpenMessage = (browserWindow) => {
    migrationAssistantWindow?.show();
    migrationAssistantWindow?.focus();

    const parentWindow = migrationAssistantWindow ?? browserWindow;
    if (!parentWindow || parentWindow.isDestroyed() || migrationClosePromptWindows.has(parentWindow)) {
        return;
    }

    migrationClosePromptWindows.add(parentWindow);
    void dialog.showMessageBox(parentWindow, {
        type: "warning",
        buttons: ["OK"],
        defaultId: 0,
        title: "Migration Assistant Open",
        message: "The Migration Assistant is already open.",
        detail: "Close the current Migration Assistant window before starting another migration.",
    }).finally(() => {
        migrationClosePromptWindows.delete(parentWindow);
    });
};

const finishPendingQuit = () => {
    if (!isQuitting) {
        return;
    }

    if (BrowserWindow.getAllWindows().length > 0) {
        return;
    }

    appendDesktopLog("finishing pending quit after final window close");
    app.exit(0);
};

const beginShutdown = () => {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    desktopCommandState = new Map();
    if (mainWindow && !mainWindow.isDestroyed()) {
        scriptSaveTargetsByWindow.delete(mainWindow);
    }
};

const sendHostMessage = (browserWindow, command, data) => {
    if (isShuttingDown || browserWindow.isDestroyed()) {
        return;
    }

    browserWindow.webContents.send("electron-host-message", {
        source: "host",
        command,
        data,
    });
};

const clearPendingWindowCloseRequests = (browserWindow, allow = true) => {
    for (const [requestId, pending] of pendingWindowCloseRequests.entries()) {
        if (pending.browserWindow !== browserWindow) {
            continue;
        }

        pendingWindowCloseRequests.delete(requestId);
        pending.resolve(allow);
    }

    approvedWindowCloseByWindow.delete(browserWindow);
    windowCloseCheckByWindow.delete(browserWindow);
};

const requestWindowCloseApproval = (browserWindow) => {
    if (browserWindow.isDestroyed() || browserWindow.webContents.isDestroyed()) {
        return Promise.resolve(true);
    }

    const requestId = `window-close-${++nextWindowCloseRequestId}`;

    return new Promise((resolve) => {
        pendingWindowCloseRequests.set(requestId, {
            browserWindow,
            resolve,
        });

        sendHostMessage(browserWindow, "desktopWindowCloseRequested", { requestId });
    });
};

const resolveWindowCloseApproval = (browserWindow, data) => {
    const requestId = data?.requestId;
    if (typeof requestId !== "string" || requestId.length === 0) {
        return false;
    }

    const pending = pendingWindowCloseRequests.get(requestId);
    if (!pending || pending.browserWindow !== browserWindow) {
        return false;
    }

    pendingWindowCloseRequests.delete(requestId);
    pending.resolve(data?.allow === true);

    return true;
};

const proceedWithWindowClose = (browserWindow) => {
    beginShutdown();
    approvedWindowCloseByWindow.add(browserWindow);
    browserWindow.close();
};

const allowNativeWindowClose = (browserWindow) => {
    // The frontend's browser-oriented beforeunload handler is useful in a tab,
    // but native desktop windows must be allowed to close.
    browserWindow.webContents.on("will-prevent-unload", (event) => {
        event.preventDefault();
    });
};

const preventCloseWhileMigrationRuns = (browserWindow) => {
    browserWindow.on("close", (event) => {
        if (getRunningMigrationWindow() !== browserWindow) {
            return;
        }

        event.preventDefault();
        showMigrationRunningMessage(browserWindow, "Stop the migration before closing this window.");
    });
};

const requestMigrationAssistantWindowCloseApproval = (browserWindow) => {
    browserWindow.on("close", (event) => {
        if (getRunningMigrationWindow() === browserWindow) {
            return;
        }

        if (approvedWindowCloseByWindow.has(browserWindow)) {
            approvedWindowCloseByWindow.delete(browserWindow);

            return;
        }

        event.preventDefault();

        if (windowCloseCheckByWindow.has(browserWindow)) {
            return;
        }

        windowCloseCheckByWindow.add(browserWindow);
        void requestWindowCloseApproval(browserWindow).then((allow) => {
            windowCloseCheckByWindow.delete(browserWindow);

            if (browserWindow.isDestroyed()) {
                return;
            }

            if (!allow) {
                appendDesktopLog("migration assistant window close canceled by renderer");

                return;
            }

            approvedWindowCloseByWindow.add(browserWindow);
            browserWindow.close();
        }).catch((error) => {
            windowCloseCheckByWindow.delete(browserWindow);
            appendDesktopLog(`migration assistant window close approval failed: ${error.stack ?? error.message}`);

            if (!browserWindow.isDestroyed()) {
                approvedWindowCloseByWindow.add(browserWindow);
                browserWindow.close();
            }
        });
    });
};

const forwardThemeToMigrationAssistant = () => {
    if (migrationAssistantWindow && !migrationAssistantWindow.isDestroyed()) {
        sendHostMessage(migrationAssistantWindow, "hostThemeChange", buildHostThemeData());
    }
};

const requestDesktopCommandState = (browserWindow) => {
    if (isShuttingDown) {
        return;
    }

    sendHostMessage(browserWindow, "getDesktopCommandState");
};

const getDesktopCommand = (id) => {
    return desktopCommandState.get(id);
};

const rebuildApplicationMenu = () => {
    if (isShuttingDown) {
        return;
    }

    Menu.setApplicationMenu(createMenu());
};

const sendNativeMenuEvent = (browserWindow, event) => {
    if (isShuttingDown || browserWindow.isDestroyed()) {
        return;
    }

    browserWindow.webContents.send("electron-host-native-menu-event", event);
};

const clearActiveNativeMenu = (browserWindow, requestId) => {
    const activeMenu = activeNativeMenuByWindow.get(browserWindow);
    if (activeMenu?.requestId === requestId) {
        activeNativeMenuByWindow.delete(browserWindow);
    }
};

const closeNativeMenu = (browserWindow, requestId) => {
    const activeMenu = activeNativeMenuByWindow.get(browserWindow);
    if (!activeMenu) {
        return;
    }

    if (requestId && activeMenu.requestId !== requestId) {
        return;
    }

    try {
        activeMenu.menu.closePopup(browserWindow);
    } catch (error) {
        appendDesktopLog(`closeNativeMenu failed: ${error.stack ?? error.message}`);
    }
};

const showNativeMenu = (browserWindow, request) => {
    if (!request || typeof request.id !== "string" || !Array.isArray(request.items) || request.items.length === 0) {
        return;
    }

    closeNativeMenu(browserWindow);

    let selected = false;
    const template = buildNativeMenuTemplate(request.items, (itemId) => {
        selected = true;
        sendNativeMenuEvent(browserWindow, {
            type: "select",
            requestId: request.id,
            itemId,
        });
    });

    const menu = Menu.buildFromTemplate(template);
    activeNativeMenuByWindow.set(browserWindow, {
        menu,
        requestId: request.id,
    });

    const positioningItem = resolvePositioningItem(request.positioningItem);

    const popupOptions = {
        window: browserWindow,
        positioningItem: positioningItem > -1 ? positioningItem : undefined,
        callback: () => {
            clearActiveNativeMenu(browserWindow, request.id);
            sendNativeMenuEvent(browserWindow, {
                type: "close",
                requestId: request.id,
                cancelled: !selected,
            });
        },
    };

    const popupCoordinates = translatePopupCoordinates(
        request,
        browserWindow.getContentBounds(),
        browserWindow.webContents.getZoomFactor(),
    );
    if (popupCoordinates.x !== undefined) {
        popupOptions.x = popupCoordinates.x;
    }

    if (popupCoordinates.y !== undefined) {
        popupOptions.y = popupCoordinates.y;
    }

    menu.popup(popupOptions);
};

const withMainWindow = (callback) => {
    return () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            return;
        }

        callback(mainWindow);
    };
};

const clampZoomFactor = (value) => {
    return Math.min(3, Math.max(0.5, value));
};

const captureWindowState = (browserWindow) => {
    const bounds = browserWindow.isMaximized() || browserWindow.isFullScreen()
        ? browserWindow.getNormalBounds()
        : browserWindow.getBounds();

    return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: browserWindow.isMaximized(),
        zoomFactor: clampZoomFactor(browserWindow.webContents.getZoomFactor()),
    };
};

let windowStatePersistTimer;

const persistWindowState = (browserWindow) => {
    if (browserWindow.isDestroyed()) {
        return;
    }

    writeWindowState(captureWindowState(browserWindow));
};

const scheduleWindowStatePersist = (browserWindow) => {
    clearTimeout(windowStatePersistTimer);
    windowStatePersistTimer = setTimeout(() => {
        persistWindowState(browserWindow);
    }, 200);
};

const changeZoomFactor = (delta) => withMainWindow((browserWindow) => {
    const currentFactor = browserWindow.webContents.getZoomFactor();
    browserWindow.webContents.setZoomFactor(clampZoomFactor(currentFactor + delta));
    scheduleWindowStatePersist(browserWindow);
});

const adjustZoomFactor = changeZoomFactor(0.1);
const decreaseZoomFactor = changeZoomFactor(-0.1);

const resetZoomFactor = withMainWindow((browserWindow) => {
    browserWindow.webContents.setZoomFactor(1);
    scheduleWindowStatePersist(browserWindow);
});

const invokeDesktopCommand = (id) => withMainWindow((browserWindow) => {
    sendHostMessage(browserWindow, "executeDesktopCommand", { id });
});

const buildMigrationSourceArguments = (details = {}) => {
    const options = details.options ?? {};
    const source = {
        name: details.caption ?? "",
        user: options.user ?? "",
        host: options.host ?? options.socket ?? "",
        port: String(options.port ?? 3306),
        id: String(details.id ?? ""),
    };
    if (typeof details.password === "string") {
        source.password = details.password;
    }

    const migrate = Buffer.from(JSON.stringify(source), "utf8").toString("base64");

    return {
        ...commandLineArguments,
        subApp: "migration",
        migrate,
    };
};

const openMigrationAssistantWindow = (details, requesterWindow) => {
    if (migrationAssistantWindow?.isDestroyed() || migrationAssistantWindow?.webContents.isDestroyed()) {
        migrationAssistantWindow = undefined;
    }

    const startStatus = getMigrationAssistantStartStatus();
    if (!startStatus.allowed) {
        if (migrationIsRunning()) {
            showMigrationRunningMessage(requesterWindow, "Stop the migration before starting another one.");
        } else {
            showMigrationAssistantAlreadyOpenMessage(requesterWindow);
        }

        return;
    }

    const migrationArguments = buildMigrationSourceArguments(details);
    const browserWindow = new BrowserWindow({
        width: 1200,
        height: 860,
        minWidth: 900,
        minHeight: 700,
        title: migrationAssistantTitle,
        backgroundColor: nativeTheme.shouldUseDarkColors ? "#181818" : "#f6f8fa",
        ...(process.platform === "darwin"
            ? {
                titleBarStyle: "hiddenInset",
            }
            : { icon: desktopIconPath }),
        trafficLightPosition: { x: 10, y: 10 },
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: preloadPath,
            sandbox: false,
        },
    });
    migrationAssistantWindow = browserWindow;
    browserWindow.setMenu(null);

    registerPrivilegedRendererWindow(browserWindow);
    backendBridge?.addWindow(browserWindow);
    commandLineArgumentsByWebContents.set(browserWindow.webContents, migrationArguments);
    installNavigationGuards(browserWindow.webContents);
    allowNativeWindowClose(browserWindow);
    preventCloseWhileMigrationRuns(browserWindow);
    requestMigrationAssistantWindowCloseApproval(browserWindow);

    browserWindow.webContents.on("did-finish-load", () => {
        forwardThemeToMigrationAssistant();
    });

    browserWindow.on("page-title-updated", (event) => {
        event.preventDefault();
    });

    browserWindow.on("closed", () => {
        clearPendingWindowCloseRequests(browserWindow);
        if (runningMigrationWindow === browserWindow) {
            runningMigrationWindow = undefined;
        }
        if (migrationAssistantWindow === browserWindow) {
            migrationAssistantWindow = undefined;
        }
    });

    void browserWindow.loadURL(migrationAssistantEntryUrl);
};

const createDesktopCommandMenuItem = (id, label, options = {}) => {
    const command = getDesktopCommand(options.stateId ?? id);

    return {
        label: options.label ?? (options.stateId ? label : command?.label ?? label),
        type: options.type,
        accelerator: options.accelerator ?? command?.accelerator,
        enabled: command?.enabled ?? false,
        checked: options.type === "checkbox" ? (command?.checked ?? false) : undefined,
        click: invokeDesktopCommand(id),
    };
};

const createDesktopCommandStateMenuItem = (id, fallbackLabel, options = {}) => {
    return createDesktopCommandMenuItem(id, fallbackLabel, options);
};

const handleHostMessage = (browserWindow, message) => {
    if (isShuttingDown) {
        return;
    }

    switch (message.command) {
        case "getCommandLineArguments": {
            sendHostMessage(browserWindow, "setCommandLineArguments",
                JSON.stringify(getCommandLineArgumentsForWindow(browserWindow)));
            break;
        }

        case "getApplicationData": {
            sendHostMessage(browserWindow, "setApplicationData", JSON.stringify(buildApplicationData()));
            break;
        }

        case "closeInstance": {
            browserWindow.close();
            break;
        }

        case "migrationAssistantMounted": {
            forwardThemeToMigrationAssistant();
            break;
        }

        case "startMigrationAssistant": {
            openMigrationAssistantWindow(message.data, browserWindow);
            break;
        }

        case "showPreferences": {
            sendHostMessage(browserWindow, "showPreferences");
            break;
        }

        case "showOpenDialog": {
            void showOpenDialog(browserWindow, message.data, false).catch((error) => {
                appendDesktopLog(`showOpenDialog failed: ${error.stack ?? error.message}`);
            });
            break;
        }

        case "showOpenDialogWithRead": {
            void showOpenDialog(browserWindow, message.data, true).catch((error) => {
                appendDesktopLog(`showOpenDialogWithRead failed: ${error.stack ?? error.message}`);
            });
            break;
        }

        case "showSaveDialog": {
            void showSaveDialog(browserWindow, message.data).catch((error) => {
                appendDesktopLog(`showSaveDialog failed: ${error.stack ?? error.message}`);
            });
            break;
        }

        case "saveFile": {
            void saveFile(browserWindow, message.data).catch((error) => {
                appendDesktopLog(`saveFile failed: ${error.stack ?? error.message}`);
                void dialog.showErrorBox("Save Failed", error.message);
            });
            break;
        }

        case "editorSaveNotebook": {
            void saveNotebook(browserWindow, message.data).catch((error) => {
                appendDesktopLog(`editorSaveNotebook failed: ${error.stack ?? error.message}`);
                void dialog.showErrorBox("Save Failed", error.message);
            });
            break;
        }

        case "editorSaveScript": {
            void saveScript(browserWindow, message.data).catch((error) => {
                appendDesktopLog(`editorSaveScript failed: ${error.stack ?? error.message}`);
                void dialog.showErrorBox("Save Failed", error.message);
            });
            break;
        }

        case "desktopCommandStateChanged": {
            const commands = Array.isArray(message.data?.commands) ? message.data.commands : [];
            desktopCommandState = new Map(commands
                .filter((command) => typeof command?.id === "string")
                .map((command) => [command.id, command]));
            rebuildApplicationMenu();

            break;
        }

        case "desktopWindowCloseResponse": {
            resolveWindowCloseApproval(browserWindow, message.data);
            break;
        }

        case "desktopWindowDirtyStateChanged": {
            browserWindow.setDocumentEdited(message.data?.dirty === true);
            break;
        }

        case "migrationStarted": {
            runningMigrationWindow = browserWindow;
            browserWindow.setTitle(`${migrationAssistantTitle} - Running`);
            break;
        }

        case "migrationStopped": {
            if (runningMigrationWindow === browserWindow) {
                runningMigrationWindow = undefined;
            }
            browserWindow.setTitle(migrationAssistantTitle);
            break;
        }

        case "themeChanged":
        default:
    }
};

const getTrustedIpcWindow = (event, channel) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow || !privilegedRendererWindows.has(browserWindow)) {
        return undefined;
    }

    const senderUrl = event.senderFrame?.url ?? event.sender.getURL();
    if (!isTrustedRendererUrl(senderUrl)) {
        appendDesktopLog(`blocked untrusted IPC ${channel} from ${senderUrl}`);

        return undefined;
    }

    return browserWindow;
};

const isPathWithinDirectory = (directory, candidatePath) => {
    const relativePath = path.relative(directory, candidatePath);

    return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
};

const createAppProtocol = () => {
    protocol.handle("app", async (request) => {
        const url = new URL(request.url);
        if (url.hostname !== "renderer") {
            return new Response("Not Found", { status: 404 });
        }

        let relativePath = decodeURIComponent(url.pathname);
        if (relativePath === "/" || relativePath.length === 0) {
            relativePath = "/index.html";
        }

        const resolvedPath = path.normalize(path.join(frontendBuildDir, relativePath));
        if (!isPathWithinDirectory(frontendBuildDir, resolvedPath)) {
            return new Response("Forbidden", { status: 403 });
        }

        let targetPath = resolvedPath;
        if (!fs.existsSync(targetPath)) {
            if (path.extname(targetPath).length === 0) {
                targetPath = path.join(frontendBuildDir, "index.html");
            } else {
                return new Response("Not Found", { status: 404 });
            }
        }

        const extension = path.extname(targetPath).toLowerCase();
        const contentType = contentTypeByExtension.get(extension) ?? "application/octet-stream";

        try {
            const payload = await fs.promises.readFile(targetPath);
            return new Response(payload, {
                status: 200,
                headers: {
                    "content-type": contentType,
                },
            });
        } catch (error) {
            appendDesktopLog(`protocol read failure path=${targetPath} error=${error.message}`);
            return new Response("Internal Server Error", { status: 500 });
        }
    });
};

const createMenu = () => {
    const currentWindow = mainWindow;
    const recentFiles = currentWindow ? getRecentFiles(currentWindow) : [];
    const aboutItem = createDesktopCommandMenuItem("app.about", `About ${appName}`);

    const preferencesItem = createDesktopCommandMenuItem("app.preferences", "Preferences...");
    const resetRememberedUiStateItem = createDesktopCommandMenuItem(
        "app.resetRememberedUiState", "Reset Remembered UI State...",
    );

    const fileMenu = {
        label: "File",
        submenu: [
            createDesktopCommandMenuItem("desktop.newScriptTab", "New SQL Script"),
            createDesktopCommandMenuItem("desktop.newNotebookTab", "New Notebook"),
            { type: "separator" },
            {
                ...createDesktopCommandMenuItem("file.open", "Open..."),
            },
            {
                label: "Open Recent",
                enabled: (getDesktopCommand("file.open")?.enabled ?? false) && recentFiles.length > 0,
                submenu: recentFiles.length > 0 ? recentFiles.map((file) => {
                    return {
                        label: file,
                        click: () => {
                            if (currentWindow) {
                                void openRecentFile(currentWindow, file);
                            }
                        },
                    };
                }) : [{ label: "No Recent Files", enabled: false }],
            },
            { type: "separator" },
            createDesktopCommandMenuItem("file.save", "Save"),
            createDesktopCommandMenuItem("file.saveAs", "Save As..."),
            { type: "separator" },
            createDesktopCommandMenuItem("file.closeDocument", "Close Tab"),
            createDesktopCommandMenuItem("file.close", "Close Connection"),
        ],
    };

    const editMenu = {
        label: "Edit",
        submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "delete" },
            { role: "selectAll" },
            { type: "separator" },
            createDesktopCommandMenuItem("view.find", "Find", { accelerator: "CmdOrCtrl+F" }),
            { type: "separator" },
            createDesktopCommandMenuItem("edit.reformat", "Format Code", { accelerator: "Shift+Alt+F" }),
            { type: "separator" },
            createDesktopCommandMenuItem("edit.previousCommand", "Previous Command", {
                accelerator: isMac ? "Cmd+Up" : undefined,
            }),
            createDesktopCommandMenuItem("edit.nextCommand", "Next Command", {
                accelerator: isMac ? "Cmd+Down" : undefined,
            }),
        ],
    };

    const developerMenu = {
        label: "Developer",
        submenu: [
            ...(communicationDebuggerAvailable ? [
                createDesktopCommandMenuItem("dev.toggleDebugger", "Toggle Communication Debugger", {
                    type: "checkbox",
                }),
            ] : []),
            { role: "toggleDevTools" },
            { type: "separator" },
            {
                label: "Open mysqlsh.log File",
                click: openMysqlShellLogFile,
            },
        ],
    };

    const viewMenu = {
        label: "View",
        submenu: [
            createDesktopCommandMenuItem("view.toggleSidebar", "Toggle Sidebar", {
                accelerator: "CmdOrCtrl+B",
            }),
            { type: "separator" },
            createDesktopCommandMenuItem("view.showHiddenCharacters", "Show Hidden Characters", { type: "checkbox" }),
            createDesktopCommandMenuItem("view.softWrap", "Soft Wrap Lines", {
                type: "checkbox",
                accelerator: "Alt+Z",
            }),
            createDesktopCommandMenuItem("view.showConnectionInfo", "Show Connection Info", {
                type: "checkbox",
            }),
            { type: "separator" },
            {
                label: "Schemas",
                submenu: [
                    createDesktopCommandMenuItem("view.schemas.showSystemSchemas", "Show System Schemas", {
                        type: "checkbox",
                    }),
                ],
            },
            { type: "separator" },
            { label: "Zoom In", accelerator: "CmdOrCtrl+Plus", click: adjustZoomFactor },
            { label: "Zoom Out", accelerator: "CmdOrCtrl+-", click: decreaseZoomFactor },
            { label: "Actual Size", accelerator: "CmdOrCtrl+0", click: resetZoomFactor },
            { role: "togglefullscreen" },
            { type: "separator" },
            developerMenu
        ],
    };

    const runMenu = {
        label: "Run",
        submenu: [
            createDesktopCommandMenuItem("run.execute", "Run", {
                accelerator: "CmdOrCtrl+Enter",
            }),
            createDesktopCommandMenuItem("run.executeCurrent", "Run Current Statement", {
                accelerator: "Shift+CmdOrCtrl+Enter",
            }),
            createDesktopCommandMenuItem("run.executeAsText", "Run (Results as Text)", {
                accelerator: "Alt+Enter",
            }),
            createDesktopCommandMenuItem("run.stop", "Stop"),
            { type: "separator" },
            createDesktopCommandMenuItem("run.explain", "Explain"),
            createDesktopCommandMenuItem("run.explainAnalyze", "Explain Analyze"),
            createDesktopCommandMenuItem("run.visualExplain", "Visual Explain"),
            createDesktopCommandMenuItem("run.visualExplainAnalyze", "Visual Explain Analyze"),
            { type: "separator" },
            createDesktopCommandMenuItem("run.stopOnError", "Stop on Error", { type: "checkbox" }),
            createDesktopCommandMenuItem("run.autoCommit", "Auto-commit", { type: "checkbox" }),
        ]
    };

    const databaseMenu = {
        label: "Database",
        submenu: [
            ...adminPageDefinitions.map((definition) => {
                return createDesktopCommandStateMenuItem(definition.desktopCommandId, definition.label);
            }),
            { type: "separator" },
            createDesktopCommandStateMenuItem("database.migrationAssistant.start",
                "Start MySQL HeatWave Cloud Migration Assistant"),
        ],
    };

    const windowMenu = {
        label: "Window",
        submenu: isMac
            ? [
                { role: "minimize" },
                { role: "zoom" },
                { type: "separator" },
                { role: "front" },
            ]
            : [
                { role: "minimize" },
                { role: "close" },
            ],
    };

    const helpMenu = {
        label: "Help",
        submenu: [
            ...(isMac ? [] : [preferencesItem, resetRememberedUiStateItem, aboutItem, { type: "separator" }]),
            {
                label: `${appName} Help`,
                click: () => {
                    openExternalUrl(workbenchHelpUrl);
                },
            },
        ],
    };

    const template = [
        ...(isMac ? [{
            label: appName,
            submenu: [
                aboutItem,
                { type: "separator" },
                preferencesItem,
                resetRememberedUiStateItem,
                { type: "separator" },
                { role: "services" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" },
            ],
        }] : []),
        fileMenu,
        editMenu,
        viewMenu,
        runMenu,
        databaseMenu,
        windowMenu,
        helpMenu,
    ];

    return Menu.buildFromTemplate(template);
};

const createWindow = async () => {
    if (!rendererDevUrl && !fs.existsSync(frontendBuildDir)) {
        appendDesktopLog(`frontend build missing at ${frontendBuildDir}`);
        await dialog.showErrorBox(
            "Frontend Build Missing",
            `The Electron POC expects built frontend assets in:\n${frontendBuildDir}\n\n` +
            "Run `npm run build` in gui/frontend first.",
        );
        app.quit();

        return;
    }

    if (rendererDevUrl) {
        appendDesktopLog(`using renderer dev server ${rendererEntryUrl}`);
    }

    const restoredWindowState = readWindowState();
    const browserWindowOptions = {
        width: restoredWindowState.width,
        height: restoredWindowState.height,
        minWidth: 1100,
        minHeight: 760,
        show: !shouldUseHiddenE2EWindow,
        title: appName,
        backgroundColor: nativeTheme.shouldUseDarkColors ? "#181818" : "#f6f8fa",
        ...(process.platform === "darwin"
            ? {
                titleBarStyle: "hiddenInset",
            }
            : { icon: desktopIconPath }),
        trafficLightPosition: { x: 10, y: 10 },
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: preloadPath,
            sandbox: false,
        },
    };

    if (intersectsAnyDisplay(restoredWindowState)) {
        browserWindowOptions.x = restoredWindowState.x;
        browserWindowOptions.y = restoredWindowState.y;
    }

    mainWindow = new BrowserWindow(browserWindowOptions);
    registerPrivilegedRendererWindow(mainWindow);
    installNavigationGuards(mainWindow.webContents);
    mainWindow.webContents.setZoomFactor(restoredWindowState.zoomFactor);

    if (restoredWindowState.isMaximized) {
        mainWindow.maximize();
    }

    backendBridge = new DesktopBackendBridge(mainWindow);

    mainWindow.webContents.on("did-finish-load", () => {
        appendDesktopLog("window did-finish-load");
        requestDesktopCommandState(mainWindow);
    });

    mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
        appendDesktopLog(`window did-fail-load code=${errorCode} description=${errorDescription} url=${validatedURL}`);
    });

    mainWindow.webContents.on("render-process-gone", (_event, details) => {
        appendDesktopLog(`render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
    });

    mainWindow.webContents.on("console-message", (details) => {
        const { level, message, lineNumber, sourceId } = details;
        appendDesktopLog(`renderer console level=${level} source=${sourceId}:${lineNumber} message=${message}`);
    });

    allowNativeWindowClose(mainWindow);

    mainWindow.on("closed", () => {
        const browserWindow = mainWindow;
        appendDesktopLog("main window closed");
        if (browserWindow) {
            clearPendingWindowCloseRequests(browserWindow);
        }
        clearTimeout(windowStatePersistTimer);
        if (backendBridge) {
            void backendBridge.disconnect();
        }
        backendBridge = undefined;
        mainWindow = undefined;
        desktopCommandState = new Map();
        finishPendingQuit();
    });

    mainWindow.on("close", (event) => {
        const browserWindow = mainWindow;
        persistWindowState(browserWindow);

        if (migrationIsRunning()) {
            event.preventDefault();
            if (isQuitting) {
                isQuitting = false;
            }
            showMigrationRunningMessage(browserWindow, "Stop the migration before closing MySQL Workbench.");

            return;
        }

        if (approvedWindowCloseByWindow.has(browserWindow)) {
            approvedWindowCloseByWindow.delete(browserWindow);

            return;
        }

        event.preventDefault();

        if (windowCloseCheckByWindow.has(browserWindow)) {
            return;
        }

        windowCloseCheckByWindow.add(browserWindow);
        void requestWindowCloseApproval(browserWindow).then((allow) => {
            windowCloseCheckByWindow.delete(browserWindow);

            if (browserWindow.isDestroyed()) {
                return;
            }

            if (!allow) {
                appendDesktopLog("main window close canceled by renderer");
                if (isQuitting) {
                    isQuitting = false;
                }

                return;
            }

            proceedWithWindowClose(browserWindow);
        }).catch((error) => {
            windowCloseCheckByWindow.delete(browserWindow);
            appendDesktopLog(`window close approval failed: ${error.stack ?? error.message}`);

            if (!browserWindow.isDestroyed()) {
                proceedWithWindowClose(browserWindow);
            }
        });
    });

    mainWindow.on("move", () => {
        scheduleWindowStatePersist(mainWindow);
    });

    mainWindow.on("resize", () => {
        scheduleWindowStatePersist(mainWindow);
    });

    mainWindow.on("maximize", () => {
        scheduleWindowStatePersist(mainWindow);
    });

    mainWindow.on("unmaximize", () => {
        scheduleWindowStatePersist(mainWindow);
    });

    Menu.setApplicationMenu(createMenu());

    await mainWindow.loadURL(rendererEntryUrl);
    appendDesktopLog("window loadURL resolved");
};

ipcMain.on("electron-host-post-message", (event, message) => {
    const browserWindow = getTrustedIpcWindow(event, "electron-host-post-message");
    if (!browserWindow) {
        return;
    }

    handleHostMessage(browserWindow, message);
});

ipcMain.handle("electron-host-show-native-menu", async (event, request) => {
    const browserWindow = getTrustedIpcWindow(event, "electron-host-show-native-menu");
    if (!browserWindow) {
        return;
    }

    showNativeMenu(browserWindow, request);
});

ipcMain.handle("electron-host-close-native-menu", async (event, requestId) => {
    const browserWindow = getTrustedIpcWindow(event, "electron-host-close-native-menu");
    if (!browserWindow) {
        return;
    }

    closeNativeMenu(browserWindow, requestId);
});

ipcMain.handle("electron-host-can-start-migration-assistant", async (event) => {
    const browserWindow = getTrustedIpcWindow(event, "electron-host-can-start-migration-assistant");
    if (!browserWindow) {
        return {
            allowed: false,
            message: "Cannot start Migration Assistant from this window.",
        };
    }

    if (migrationAssistantWindow?.isDestroyed() || migrationAssistantWindow?.webContents.isDestroyed()) {
        migrationAssistantWindow = undefined;
    }

    return getMigrationAssistantStartStatus();
});

ipcMain.handle("electron-file-viewer-read", async (event, request) => {
    return fileViewerHost.read(event, request);
});

ipcMain.handle("electron-file-viewer-browse", async (event) => {
    return fileViewerHost.browse(event);
});

ipcMain.handle("electron-backend-connect", async (event) => {
    if (!getTrustedIpcWindow(event, "electron-backend-connect") || !backendBridge) {
        return undefined;
    }

    return backendBridge.connect();
});

ipcMain.handle("electron-backend-disconnect", async (event) => {
    const browserWindow = getTrustedIpcWindow(event, "electron-backend-disconnect");
    if (!browserWindow) {
        return;
    }

    if (browserWindow !== mainWindow) {
        backendBridge?.removeWindow(browserWindow);

        return;
    }

    if (backendBridge) {
        await backendBridge.disconnect();
    }
});

ipcMain.on("electron-backend-send", (event, payload) => {
    const browserWindow = getTrustedIpcWindow(event, "electron-backend-send");
    if (!browserWindow || !backendBridge) {
        return;
    }

    backendBridge.send(payload, browserWindow);
});

if (isPrimaryInstance) {
    app.whenReady().then(async () => {
        appendDesktopLog("app.whenReady");

        createAppProtocol();
        await createWindow();

        nativeTheme.on("updated", () => {
            forwardThemeToMigrationAssistant();
        });
    });
}

app.on("window-all-closed", () => {
    appendDesktopLog("window-all-closed");
    beginShutdown();
    app.quit();
});

app.on("before-quit", () => {
    appendDesktopLog("before-quit");
    isQuitting = true;
});

app.on("activate", async () => {
    appendDesktopLog("activate");
    if (!mainWindow) {
        isQuitting = false;
        isShuttingDown = false;
        await createWindow();
    } else if (!mainWindow.isVisible()) {
        mainWindow.show();
    }
});

app.on("child-process-gone", (_event, details) => {
    appendDesktopLog(`child-process-gone type=${details.type} reason=${details.reason} exitCode=${details.exitCode} serviceName=${details.serviceName ?? ""}`);
});

app.on("render-process-gone", (_event, webContents, details) => {
    appendDesktopLog(`app render-process-gone reason=${details.reason} exitCode=${details.exitCode} url=${webContents.getURL()}`);
});

app.on("web-contents-created", (_event, webContents) => {
    appendDesktopLog(`web-contents-created type=${webContents.getType()}`);
    installNavigationGuards(webContents);
});

process.on("uncaughtException", (error) => {
    appendDesktopLog(`uncaughtException: ${error.stack ?? error.message}`);
});

process.on("unhandledRejection", (reason) => {
    appendDesktopLog(`unhandledRejection: ${reason && reason.stack ? reason.stack : String(reason)}`);
});
