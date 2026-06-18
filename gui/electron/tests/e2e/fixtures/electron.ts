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

import { test as base, expect, type Page, type TestInfo } from "@playwright/test";
import { _electron as electron, type ElectronApplication } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { ElectronWorkbench } from "../helpers/ElectronWorkbench.js";

const require = createRequire(__filename);
const fixturesDir = __dirname;
const electronRoot = resolve(fixturesDir, "../../..");
const repoRoot = resolve(electronRoot, "../..");
const guiPluginSourceDir = resolve(electronRoot, "../backend/gui_plugin");
const pluginSourceDirs = new Map([
    ["gui_plugin", guiPluginSourceDir],
    ["mds_plugin", resolve(repoRoot, "mds_plugin")],
    ["mrs_plugin", resolve(repoRoot, "mrs_plugin")],
    ["msm_plugin", resolve(repoRoot, "msm_plugin")],
    ["util_plugin", resolve(repoRoot, "util_plugin")],
    ["migration_plugin", resolve(repoRoot, "migration_plugin")],
]);
const rendererHost = process.env.ELECTRON_E2E_VITE_HOST ?? "127.0.0.1";
const rendererPort = process.env.ELECTRON_E2E_VITE_PORT ?? "5174";
const rendererUrl = process.env.ELECTRON_E2E_RENDERER_URL ?? `http://${rendererHost}:${rendererPort}/`;
const packagedAppPath = process.env.ELECTRON_E2E_PACKAGED_APP;
const isPackagedAppMode = Boolean(packagedAppPath);
const slowMoValue = process.env.ELECTRON_E2E_SLOWMO ?? process.env.ELECTRON_E2E_SLOW_MO;
const slowMoPatchedMethods = Symbol("electronE2ESlowMoPatchedMethods");

interface IElectronFixtures {
    electronApp: ElectronApplication;
    page: Page;
    workbench: ElectronWorkbench;
}

type SlowMoPatchTarget = Record<string | symbol, unknown>;

const parseSlowMo = (): number | undefined => {
    if (!slowMoValue) {
        return undefined;
    }

    const slowMo = Number(slowMoValue);
    if (!Number.isFinite(slowMo) || slowMo < 0) {
        throw new Error("ELECTRON_E2E_SLOWMO must be a non-negative number of milliseconds.");
    }

    return slowMo;
};

const slowMo = parseSlowMo();

const resolveHostPlatform = (): string => {
    if (process.platform === "darwin") {
        return process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
    }

    if (process.platform === "linux") {
        return process.arch === "arm64" ? "linux-arm64" : "linux-x64";
    }

    if (process.platform === "win32" && process.arch === "x64") {
        return "win32-x64";
    }

    throw new Error(`Unsupported Electron e2e host platform: ${process.platform}-${process.arch}`);
};

const resolveMysqlShellRuntimeDir = (): string => {
    return process.env.ELECTRON_MYSQLSH_RUNTIME_DIR
        ?? join(electronRoot, "packaging", "mysql-shell-staging", resolveHostPlatform());
};

const validateMysqlShellRuntimeDir = (runtimeDir: string): void => {
    const mysqlshBinary = join(runtimeDir, "bin", process.platform === "win32" ? "mysqlsh.exe" : "mysqlsh");
    const pluginsDir = join(runtimeDir, "lib", "mysqlsh", "plugins");

    if (!existsSync(mysqlshBinary)) {
        throw new Error(`Missing e2e MySQL Shell runtime binary: ${mysqlshBinary}`);
    }

    if (!existsSync(pluginsDir)) {
        throw new Error(`Missing e2e MySQL Shell builtin plugin directory: ${pluginsDir}`);
    }
};

const waitForSlowMo = (delay: number): Promise<void> => {
    return new Promise((resolvePromise) => {
        setTimeout(resolvePromise, delay);
    });
};

const patchSlowMoMethod = (target: object, methodName: string, delay: number): void => {
    const patchTarget = target as SlowMoPatchTarget;
    const original = patchTarget[methodName];
    if (typeof original !== "function") {
        return;
    }

    let patchedMethods = patchTarget[slowMoPatchedMethods] as Set<string> | undefined;
    patchedMethods ??= new Set<string>();
    patchTarget[slowMoPatchedMethods] = patchedMethods;
    if (patchedMethods.has(methodName)) {
        return;
    }

    patchTarget[methodName] = async function patchedSlowMoMethod(this: unknown, ...args: unknown[]) {
        await waitForSlowMo(delay);

        return (original as (...methodArgs: unknown[]) => unknown).apply(this, args);
    };
    patchedMethods.add(methodName);
};

const installSlowMo = (page: Page, delay: number | undefined): void => {
    if (!delay) {
        return;
    }

    const pageActionMethods = [
        "check", "click", "dblclick", "dispatchEvent", "fill", "focus", "hover", "press", "selectOption",
        "setInputFiles", "tap", "type", "uncheck",
    ];
    const locatorActionMethods = [
        ...pageActionMethods,
        "clear", "dragTo", "evaluate", "selectText",
    ];

    for (const methodName of pageActionMethods) {
        patchSlowMoMethod(Object.getPrototypeOf(page) as object, methodName, delay);
    }

    for (const methodName of locatorActionMethods) {
        patchSlowMoMethod(Object.getPrototypeOf(page.locator("body")) as object, methodName, delay);
    }

    for (const methodName of ["down", "insertText", "press", "type", "up"]) {
        patchSlowMoMethod(Object.getPrototypeOf(page.keyboard) as object, methodName, delay);
    }

    for (const methodName of ["click", "dblclick", "down", "move", "up", "wheel"]) {
        patchSlowMoMethod(Object.getPrototypeOf(page.mouse) as object, methodName, delay);
    }

    patchSlowMoMethod(Object.getPrototypeOf(page.touchscreen) as object, "tap", delay);
};

const createLaunchArguments = (testInfo: TestInfo): string[] => {
    const shellUserConfigDir = testInfo.outputPath("mysqlsh-user-config");
    const electronUserDataDir = testInfo.outputPath("electron-user-data");
    const args = [
        "--electron-user-data-dir",
        electronUserDataDir,
        "--mysqlsh-user-config-home",
        shellUserConfigDir,
    ];

    if (process.env.ELECTRON_E2E_BACKGROUND === "1" || process.env.ELECTRON_E2E_BACKGROUND === "true") {
        args.push("--electron-e2e-background");
    }

    if (isPackagedAppMode) {
        return args;
    }

    args.unshift(
        join(electronRoot, "src", "main.cjs"),
        "--renderer-url",
        rendererUrl,
    );

    return args;
};

const resolveMacAppBundleExecutable = (bundlePath: string): string => {
    const plistPath = join(bundlePath, "Contents", "Info.plist");
    const macOsDir = join(bundlePath, "Contents", "MacOS");

    if (existsSync(plistPath)) {
        const plist = readFileSync(plistPath, "utf8");
        const executableMatch = /<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/.exec(plist);
        if (executableMatch?.[1]) {
            return join(macOsDir, executableMatch[1]);
        }
    }

    return join(macOsDir, basename(bundlePath, ".app"));
};

const resolvePackagedAppExecutablePath = (appPath: string): string => {
    const resolvedAppPath = resolve(appPath);
    const executablePath = process.platform === "darwin" && resolvedAppPath.endsWith(".app")
        ? resolveMacAppBundleExecutable(resolvedAppPath)
        : resolvedAppPath;

    if (!existsSync(executablePath)) {
        throw new Error(`The packaged Electron app executable does not exist: ${executablePath}`);
    }

    return executablePath;
};

const resolveElectronExecutablePath = (): string => {
    if (packagedAppPath) {
        return resolvePackagedAppExecutablePath(packagedAppPath);
    }

    const explicitPath = process.env.ELECTRON_E2E_ELECTRON_EXECUTABLE ?? process.env.ELECTRON_EXECUTABLE_PATH;
    if (explicitPath) {
        return explicitPath;
    }

    try {
        const electronPackageJson = require.resolve("electron/package.json");
        const electronPackageDir = dirname(electronPackageJson);
        const electronPathFile = join(electronPackageDir, "path.txt");

        if (!existsSync(electronPathFile)) {
            throw new Error("The Electron npm package is installed, but the Electron binary is missing. " +
                "Install the binary from the internal Electron mirror, or set " +
                "`ELECTRON_E2E_ELECTRON_EXECUTABLE` to an existing Electron executable.");
        }

        const executablePath = join(electronPackageDir, "dist", readFileSync(electronPathFile, "utf8"));
        if (!existsSync(executablePath)) {
            throw new Error(`The Electron binary referenced by ${electronPathFile} does not exist: ` +
                executablePath);
        }

        return executablePath;
    } catch (error) {
        throw new Error("Electron is not available for the e2e runner. Run `npm install` in gui/electron, " +
            "install the Electron binary from the internal mirror, or set " +
            "`ELECTRON_E2E_ELECTRON_EXECUTABLE` to an Electron executable path.", {
            cause: error,
        });
    }
};

const createLaunchEnvironment = (
    shellUserConfigDir: string,
    mysqlshRuntimeDir: string | undefined,
): NodeJS.ProcessEnv => {
    const launchEnv: NodeJS.ProcessEnv = {
        ...process.env,
        MYSQLSH_USER_CONFIG_HOME: shellUserConfigDir,
    };

    if (isPackagedAppMode) {
        delete launchEnv.ELECTRON_RENDERER_URL;

        return launchEnv;
    }

    const mysqlshGuiExtraArgs = process.env.MYSQLSH_GUI_EXTRA_ARGS ?? "";

    return {
        ...launchEnv,
        ELECTRON_RENDERER_URL: rendererUrl,
        ELECTRON_MYSQLSH_RUNTIME_DIR: mysqlshRuntimeDir,
        ...(mysqlshGuiExtraArgs.length > 0 ? { MYSQLSH_GUI_EXTRA_ARGS: mysqlshGuiExtraArgs } : {}),
    };
};

const installPluginLinks = async (mysqlshRuntimeDir: string): Promise<void> => {
    const pluginsDir = join(mysqlshRuntimeDir, "lib", "mysqlsh", "plugins");

    for (const [pluginName, sourceDir] of pluginSourceDirs) {
        const targetDir = join(pluginsDir, pluginName);
        try {
            const targetStats = await lstat(targetDir);
            if (targetStats.isSymbolicLink() && resolve(pluginsDir, await readlink(targetDir)) === sourceDir) {
                continue;
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                throw error;
            }
        }

        await rm(targetDir, { recursive: true, force: true });
        await symlink(sourceDir, targetDir, process.platform === "win32" ? "junction" : "dir");
    }
};

export const test = base.extend<IElectronFixtures>({
    electronApp: async ({}, use, testInfo) => {
        const shellUserConfigDir = testInfo.outputPath("mysqlsh-user-config");
        const electronUserDataDir = testInfo.outputPath("electron-user-data");
        const mysqlshRuntimeDir = isPackagedAppMode ? undefined : resolveMysqlShellRuntimeDir();
        await mkdir(shellUserConfigDir, { recursive: true });
        await mkdir(electronUserDataDir, { recursive: true });

        if (mysqlshRuntimeDir) {
            validateMysqlShellRuntimeDir(mysqlshRuntimeDir);
            await installPluginLinks(mysqlshRuntimeDir);
        }

        const launchOptions = {
            executablePath: resolveElectronExecutablePath(),
            args: createLaunchArguments(testInfo),
            env: createLaunchEnvironment(shellUserConfigDir, mysqlshRuntimeDir),
            timeout: 60000,
        };

        const electronApp = await electron.launch(launchOptions);

        try {
            await use(electronApp);
        } finally {
            await electronApp.evaluate(({ app }) => {
                app.exit(0);
            }).catch(async () => {
                await electronApp.close().catch(() => {
                    // The runner can already have closed the application after a startup failure.
                });
            });
        }
    },

    page: async ({ electronApp }, use, testInfo) => {
        const page = await electronApp.firstWindow({ timeout: 60000 });
        installSlowMo(page, slowMo);
        const rendererErrors: string[] = [];

        page.on("pageerror", (error) => {
            rendererErrors.push(error.stack ?? error.message);
        });

        page.on("console", (message) => {
            if (message.type() === "error") {
                rendererErrors.push(message.text());
            }
        });

        try {
            await use(page);
        } finally {
            if (rendererErrors.length > 0) {
                await testInfo.attach("renderer-errors", {
                    body: rendererErrors.join("\n"),
                    contentType: "text/plain",
                });
            }
        }
    },

    workbench: async ({ electronApp, page }, use) => {
        await use(new ElectronWorkbench(electronApp, page));
    },
});

export { expect };
