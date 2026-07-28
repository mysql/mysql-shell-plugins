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
import { lstat, mkdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { basename, delimiter, dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { ElectronWorkbench } from "../helpers/ElectronWorkbench.js";

const require = createRequire(__filename);
const fixturesDir = __dirname;
const electronRoot = resolve(fixturesDir, "../../..");
const repoRoot = resolve(electronRoot, "../..");
const guiPluginSourceDir = resolve(electronRoot, "../backend/gui_plugin");
const vsCodeDatabaseFixture = resolve(
    repoRoot,
    "gui/backend/tests/unit/legacy/fixtures/vscode/mysqlsh_gui_backend_1.20.sql",
);
const pluginSourceDirs = new Map([
    ["gui_plugin", guiPluginSourceDir],
    ["mds_plugin", resolve(repoRoot, "mds_plugin")],
    ["mrs_plugin", resolve(repoRoot, "mrs_plugin")],
    ["msm_plugin", resolve(repoRoot, "msm_plugin")],
    ["util_plugin", resolve(repoRoot, "util_plugin")],
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

interface IElectronOptions {
    electronLaunchEnvironment: Record<string, string | undefined>;
}

export interface ILegacyConfigurationImportFixtureOptions {
    workbenchConnections?: boolean;
    vsCodeConnections?: boolean;
    vsCodeLogs?: boolean;
    workbenchProject?: boolean;
    vsCodeProject?: boolean;
}

export interface ILegacyConfigurationImportTestSources {
    home: string;
    appData: string;
    failureRoot: string;
    workbenchConnections: string;
    workbenchProjects: string;
    vsCodeRoot: string;
    vsCodeDatabase: string;
    vsCodeLogs: string[];
    vsCodeProjects: string;
    workbenchProject?: string;
    vsCodeProject?: string;
    close: () => void;
}

type SlowMoPatchTarget = Record<string | symbol, unknown>;
type ElectronLaunchOptions = NonNullable<Parameters<typeof electron.launch>[0]>;

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

const createLaunchArguments = (testInfo: TestInfo, userDataDir?: string): string[] => {
    const electronUserDataDir = userDataDir ?? testInfo.outputPath("electron-user-data");
    const args = [
        "--electron-user-data-dir",
        electronUserDataDir,
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
    mysqlshRuntimeDir: string | undefined,
    environmentOverrides: Record<string, string | undefined>,
): Record<string, string> => {
    const launchEnv = Object.fromEntries(
        Object.entries(process.env).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
        ),
    );
    delete launchEnv.ELECTRON_RUN_AS_NODE;
    delete launchEnv.MYSQLSH_USER_CONFIG_HOME;

    if (isPackagedAppMode) {
        delete launchEnv.ELECTRON_RENDERER_URL;

        return applyEnvironmentOverrides(launchEnv, environmentOverrides);
    }

    const mysqlshGuiExtraArgs = process.env.MYSQLSH_GUI_EXTRA_ARGS ?? "";
    const mysqlshPluginPath = mysqlshRuntimeDir
        ? join(mysqlshRuntimeDir, "lib", "mysqlsh", "plugins")
        : undefined;
    const pythonPath = [mysqlshPluginPath, process.env.PYTHONPATH]
        .filter((value): value is string => value !== undefined && value.length > 0)
        .join(delimiter);

    return applyEnvironmentOverrides({
        ...launchEnv,
        ELECTRON_RENDERER_URL: rendererUrl,
        ...(mysqlshRuntimeDir ? { ELECTRON_MYSQLSH_RUNTIME_DIR: mysqlshRuntimeDir } : {}),
        ...(pythonPath.length > 0 ? { PYTHONPATH: pythonPath } : {}),
        ...(mysqlshGuiExtraArgs.length > 0 ? { MYSQLSH_GUI_EXTRA_ARGS: mysqlshGuiExtraArgs } : {}),
    }, environmentOverrides);
};

const applyEnvironmentOverrides = (
    environment: Record<string, string>,
    overrides: Record<string, string | undefined>,
): Record<string, string> => {
    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) {
            delete environment[key];
        } else {
            environment[key] = value;
        }
    }

    return environment;
};

const legacySourcePaths = (testInfo: TestInfo) => {
    const home = testInfo.outputPath("legacy-home");
    const appData = testInfo.outputPath("legacy-app-data");
    const failureRoot = join(home, ".electron-e2e-failures");
    if (process.platform === "win32") {
        return {
            home,
            appData,
            failureRoot,
            workbenchConnections: join(appData, "MySQL", "Workbench", "connections.xml"),
            workbenchWrapper: join(appData, "MySQL", "mysqlsh-wb"),
            vsCodeRoot: join(appData, "MySQL", "mysqlsh-gui"),
        };
    }

    return {
        home,
        appData,
        failureRoot,
        workbenchConnections: process.platform === "darwin"
            ? join(home, "Library", "Application Support", "MySQL", "Workbench", "connections.xml")
            : join(home, ".mysql", "workbench", "connections.xml"),
        workbenchWrapper: join(home, ".mysqlsh-wb"),
        vsCodeRoot: join(home, ".mysqlsh-gui"),
    };
};

const workbenchConnectionsXml = (): string => {
    return `<?xml version="1.0"?>
<data grt_format="2.0">
  <value type="list" content-type="object"
      content-struct-name="db.mgmt.Connection">
    <value type="object" struct-name="db.mgmt.Connection">
      <link type="object" struct-name="db.mgmt.Driver"
          key="driver">com.mysql.rdbms.mysql.driver.native</link>
      <value type="string" key="hostIdentifier">Mysql@db.example:3306</value>
      <value type="dict" key="parameterValues">
        <value type="string" key="hostName">db.example</value>
        <value type="string" key="port">3306</value>
        <value type="string" key="userName">scott</value>
      </value>
      <value type="string" key="name">Workbench Production</value>
    </value>
  </value>
</data>
`;
};

const createVsCodeDatabase = async (databasePath: string): Promise<DatabaseSync> => {
    await mkdir(dirname(databasePath), { recursive: true });
    const database = new DatabaseSync(databasePath);
    database.exec(readFileSync(vsCodeDatabaseFixture, "utf8"));
    database.exec(`
        PRAGMA journal_mode=WAL;
        PRAGMA wal_autocheckpoint=0;
    `);

    return database;
};

const createLegacyProject = async (
    projectRoot: string,
    projectId: string,
    options: { includeKeys: boolean; },
): Promise<string> => {
    const projectPath = join(projectRoot, projectId);
    const nestedPath = join(projectPath, "nested");
    await mkdir(nestedPath, { recursive: true });
    await writeFile(join(nestedPath, "state.txt"), `${projectId} state\n`, "utf8");

    let sshPrivateKeyFile = "";
    let sshSharedKeyFile = "";
    if (options.includeKeys) {
        sshPrivateKeyFile = join(projectPath, "project-key");
        sshSharedKeyFile = join(projectRoot, "ssh", "shared-key");
        await mkdir(dirname(sshSharedKeyFile), { recursive: true });
        await writeFile(sshPrivateKeyFile, "project private key fixture\n", "utf8");
        await writeFile(sshSharedKeyFile, "shared private key fixture\n", "utf8");
    }

    await writeFile(join(projectPath, "data.json"), JSON.stringify({
        version: "1.0.0",
        id: projectId,
        name: `Legacy ${projectId}`,
        options: {
            _class: "MigrationOptions",
            sourceConnectionOptions: {
                scheme: "mysql",
                user: "scott",
                host: "db.example",
                port: 3306,
            },
        },
        ociConfigFile: "",
        ociProfile: "DEFAULT",
        ociConfigOwned: false,
        sshSharedKeyFile,
        sshPrivateKeyFile,
        sshPublicKeyFile: "",
        replicationCoordinates: {},
        planStepData: {},
        createTime: "2026-07-28T00:00:00",
        modifyTime: "2026-07-28T00:00:00",
        dataMigrationDidFinish: false,
    }, undefined, 2), "utf8");

    return projectPath;
};

export const createLegacyConfigurationImportTestSources = async (
    testInfo: TestInfo,
    options: ILegacyConfigurationImportFixtureOptions,
): Promise<ILegacyConfigurationImportTestSources> => {
    const paths = legacySourcePaths(testInfo);
    const workbenchProjects = join(paths.workbenchWrapper, "plugin_data", "migration_plugin");
    const vsCodePluginRoot = join(paths.vsCodeRoot, "plugin_data", "gui_plugin");
    const vsCodeDatabase = join(vsCodePluginRoot, "mysqlsh_gui_backend.sqlite3");
    const vsCodeProjects = join(paths.vsCodeRoot, "plugin_data", "migration_plugin");
    const vsCodeLogs = [
        join(vsCodePluginRoot, "mysqlsh_gui_backend_log.sqlite3"),
        join(vsCodePluginRoot, "mysqlsh_gui_backend_log.sqlite3-wal"),
        join(vsCodePluginRoot, "mysqlsh_gui_backend_log.sqlite3-shm"),
    ];
    let sourceDatabase: DatabaseSync | undefined;

    await mkdir(paths.home, { recursive: true });
    await mkdir(paths.appData, { recursive: true });
    if (options.workbenchConnections) {
        await mkdir(dirname(paths.workbenchConnections), { recursive: true });
        await writeFile(paths.workbenchConnections, workbenchConnectionsXml(), "utf8");
    }
    if (options.vsCodeConnections) {
        sourceDatabase = await createVsCodeDatabase(vsCodeDatabase);
    }
    if (options.vsCodeLogs) {
        await mkdir(vsCodePluginRoot, { recursive: true });
        await Promise.all(vsCodeLogs.map(async (logPath) => {
            await writeFile(logPath, `legacy log fixture: ${basename(logPath)}\n`, "utf8");
        }));
    }

    const workbenchProject = options.workbenchProject
        ? await createLegacyProject(workbenchProjects, "workbench-project", { includeKeys: true })
        : undefined;
    const vsCodeProject = options.vsCodeProject
        ? await createLegacyProject(vsCodeProjects, "vscode-project", { includeKeys: false })
        : undefined;

    return {
        home: paths.home,
        appData: paths.appData,
        failureRoot: paths.failureRoot,
        workbenchConnections: paths.workbenchConnections,
        workbenchProjects,
        vsCodeRoot: paths.vsCodeRoot,
        vsCodeDatabase,
        vsCodeLogs,
        vsCodeProjects,
        workbenchProject,
        vsCodeProject,
        close: () => {
            sourceDatabase?.close();
        },
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

export const createElectronLaunchOptions = async (
    testInfo: TestInfo,
    environmentOverrides: Record<string, string | undefined>,
    userDataDir?: string,
): Promise<ElectronLaunchOptions> => {
    const electronUserDataDir = userDataDir ?? testInfo.outputPath("electron-user-data");
    const mysqlshRuntimeDir = isPackagedAppMode ? undefined : resolveMysqlShellRuntimeDir();
    await mkdir(electronUserDataDir, { recursive: true });

    if (mysqlshRuntimeDir) {
        validateMysqlShellRuntimeDir(mysqlshRuntimeDir);
        await installPluginLinks(mysqlshRuntimeDir);
    }
    const legacyPaths = legacySourcePaths(testInfo);

    return {
        executablePath: resolveElectronExecutablePath(),
        args: createLaunchArguments(testInfo, electronUserDataDir),
        env: createLaunchEnvironment(mysqlshRuntimeDir, {
            ELECTRON_E2E: "1",
            ELECTRON_E2E_LEGACY_HOME: legacyPaths.home,
            ELECTRON_E2E_LEGACY_APP_DATA: legacyPaths.appData,
            ELECTRON_E2E_LEGACY_FAILURE_ROOT: legacyPaths.failureRoot,
            ...environmentOverrides,
        }),
        timeout: 60000,
    };
};

export const launchElectronApp = async (
    testInfo: TestInfo,
    environmentOverrides: Record<string, string | undefined> = {},
    userDataDir?: string,
): Promise<ElectronApplication> => {
    return electron.launch(await createElectronLaunchOptions(
        testInfo,
        environmentOverrides,
        userDataDir,
    ));
};

export const closeElectronApp = async (electronApp: ElectronApplication): Promise<void> => {
    const closePromise = electronApp.waitForEvent("close", { timeout: 15000 }).catch(() => {
        // The runner can already have closed the application after a startup failure.
    });

    await electronApp.evaluate(({ app }) => {
        app.exit(0);
    }).catch(async () => {
        await electronApp.close().catch(() => {
            // The application may already have exited.
        });
    });
    await closePromise;
};

export const test = base.extend<IElectronFixtures & IElectronOptions>({
    electronLaunchEnvironment: [{}, { option: true }],

    electronApp: async ({ electronLaunchEnvironment }, use, testInfo) => {
        const electronApp = await launchElectronApp(testInfo, electronLaunchEnvironment);

        try {
            await use(electronApp);
        } finally {
            await closeElectronApp(electronApp);
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
