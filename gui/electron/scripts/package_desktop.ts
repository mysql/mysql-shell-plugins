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

const { spawnSync } = require("child_process");
const { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } = require("fs");
const { join, resolve } = require("path");

class Logger {

    static success = (message) => {
        console.log(`[OK] ${message}`);
    };

    static info = (message) => {
        process.stdout.write(`[INF] ${message}`);
    };

    static done = () => {
        console.log("DONE");
    };

}

const supportedPlatforms = [
    "darwin-arm64",
    "darwin-x64",
    "win32-x64",
    "linux-arm64",
    "linux-x64",
];
const pluginNames = [
    "gui_plugin",
    "mds_plugin",
    "mrs_plugin",
    "msm_plugin",
    "util_plugin",
    "migration_plugin",
];
const desktopProductName = "MySQL Workbench";
const desktopBundleStem = "MySQL Workbench";
const desktopPackageName = "mysql-workbench";
const desktopBundleIdentifier = "com.oracle.mysqlworkbench";
const electronFolder = resolve(__dirname, "..");
const guiFolder = resolve(electronFolder, "..");
const frontEndFolder = join(guiFolder, "frontend");
const extensionFolder = join(guiFolder, "extension");
const buildFolder = join(frontEndFolder, "build");
const outputFolder = join(electronFolder, "output");
const packagedDesktopFolder = join(electronFolder, "packaging", "desktop-packages");
const shellCacheFolder = resolve(process.env.MYSQL_SHELL_STAGING_ROOT ?? join(extensionFolder, "packaging", "mysql-shell"));
const electronCacheFolder = join(electronFolder, "packaging", "electron");
const electronSourceFolder = join(electronFolder, "src");
const electronImagesFolder = join(electronFolder, "images");
const desktopIconIcns = join(electronImagesFolder, "app-icon.icns");
const pluginSourceFolders = new Map([
    ["gui_plugin", join(guiFolder, "backend", "gui_plugin")],
    ["mds_plugin", resolve(guiFolder, "..", "mds_plugin")],
    ["mrs_plugin", resolve(guiFolder, "..", "mrs_plugin")],
    ["msm_plugin", resolve(guiFolder, "..", "msm_plugin")],
    ["util_plugin", resolve(guiFolder, "..", "util_plugin")],
    ["migration_plugin", resolve(guiFolder, "..", "migration_plugin")],
]);
const packageJson = require(join(electronFolder, "package.json"));
const extensionPackageJson = require(join(extensionFolder, "package.json"));
const desktopPackageVersion = extensionPackageJson.version ?? packageJson.version;

if (typeof desktopPackageVersion !== "string" || desktopPackageVersion.length === 0) {
    throw new Error("Could not determine the desktop package version.");
}

const executeTask = (cmd, message) => {
    Logger.info(message);
    const result = spawnSync(cmd, { shell: true, stdio: "inherit" });

    if (result.status !== 0) {
        console.log(result.error);
        throw new Error(`Command failed: ${cmd}`);
    }

    Logger.done();
};

const parseArguments = (argv) => {
    const result = { targets: [], quick: false };

    for (let index = 2; index < argv.length; index += 1) {
        const argument = argv[index];

        if (argument.startsWith("--targets=")) {
            result.targets = argument.slice("--targets=".length).split(",").filter(Boolean);
            continue;
        }

        if (argument === "--targets" || argument === "--target") {
            const next = argv[index + 1];
            if (!next) {
                throw new Error(`Missing value for ${argument}`);
            }

            result.targets = next.split(",").filter(Boolean);
            index += 1;

            continue;
        }

        if (argument.startsWith("--target=")) {
            result.targets = argument.slice("--target=".length).split(",").filter(Boolean);
            continue;
        }

        if (argument === "--quick") {
            result.quick = true;
            continue;
        }

        throw new Error(`Unknown argument '${argument}'.`);
    }

    if (result.targets.length === 0) {
        throw new Error("Please provide at least one target via --targets.");
    }

    for (const target of result.targets) {
        if (!supportedPlatforms.includes(target)) {
            throw new Error(`Unsupported target '${target}'.`);
        }
    }

    return result;
};

const ensureDirectory = (folder) => {
    mkdirSync(folder, { recursive: true });
};

const resetDirectory = (folder) => {
    rmSync(folder, { recursive: true, force: true });
    mkdirSync(folder, { recursive: true });
};

const copyDirectoryContents = (source, target) => {
    ensureDirectory(target);

    for (const entry of readdirSync(source)) {
        cpSync(join(source, entry), join(target, entry), {
            recursive: true,
            force: true,
            dereference: false,
        });
    }
};

const copyElectronRuntime = (target, source, destination) => {
    resetDirectory(destination);

    if (target.startsWith("darwin")) {
        const sourceBundle = join(source, "Electron.app");
        if (!existsSync(sourceBundle)) {
            throw new Error(`Could not find Electron.app in ${source}`);
        }

        cpSync(sourceBundle, join(destination, "Electron.app"), { recursive: true, force: true });

        return;
    }

    copyDirectoryContents(source, destination);
};

const findPythonPluginFolder = (shellFolder) => {
    const candidate = join(shellFolder, "lib", "mysqlsh", "plugins");
    if (!existsSync(candidate)) {
        throw new Error(`Could not find plugin directory in ${shellFolder}.`);
    }

    return candidate;
};

const cleanPluginArtifacts = (folder) => {
    for (const entry of readdirSync(folder)) {
        const fullPath = join(folder, entry);
        const stats = statSync(fullPath);

        if (stats.isDirectory()) {
            if ([".vscode", "__pycache__", "docs", "examples", "htmlcov", "node_modules", "tests"].includes(entry)) {
                rmSync(fullPath, { recursive: true, force: true });
                continue;
            }

            cleanPluginArtifacts(fullPath);
            continue;
        }

        if (["cspell.json", "python.env", "pytest-coverage.ini", "pytest.ini", "run_tests.py"].includes(entry)
            || entry.endsWith(".pyc") || entry.endsWith(".pyo")) {
            rmSync(fullPath, { force: true });
        }
    }
};

const buildAppManifest = () => {
    return JSON.stringify({
        name: desktopPackageName,
        productName: desktopProductName,
        version: desktopPackageVersion,
        description: packageJson.description,
        main: "src/main.cjs",
    }, null, 4);
};

const getResourcesDirectory = (target, targetOutputFolder) => {
    if (target.startsWith("darwin")) {
        return join(targetOutputFolder, "Electron.app", "Contents", "Resources");
    }

    return join(targetOutputFolder, "resources");
};

const getPackagedResourcesDirectory = (target, targetOutputFolder) => {
    if (target.startsWith("darwin")) {
        return join(targetOutputFolder, `${desktopBundleStem}.app`, "Contents", "Resources");
    }

    return join(targetOutputFolder, "resources");
};

const prepareShellBundle = (target, appFolder) => {
    const shellSourceFolder = join(shellCacheFolder, target);
    if (!existsSync(shellSourceFolder)) {
        throw new Error(`Missing MySQL Shell cache for ${target} at ${shellSourceFolder}`);
    }

    const shellTargetFolder = join(appFolder, "shell");
    resetDirectory(shellTargetFolder);

    for (const entry of ["bin", "lib", "share"]) {
        const source = join(shellSourceFolder, entry);
        if (!existsSync(source)) {
            throw new Error(`Expected ${source} to exist.`);
        }

        cpSync(source, join(shellTargetFolder, entry), { recursive: true, force: true });
    }

    const libexecSource = join(shellSourceFolder, "libexec");
    if (existsSync(libexecSource)) {
        cpSync(libexecSource, join(shellTargetFolder, "libexec"), { recursive: true, force: true });
    }

    const pluginsTargetFolder = findPythonPluginFolder(shellTargetFolder);
    for (const pluginName of pluginNames) {
        rmSync(join(pluginsTargetFolder, pluginName), { recursive: true, force: true });
    }

    for (const pluginName of pluginNames) {
        const pluginSourceFolder = pluginSourceFolders.get(pluginName);
        if (!existsSync(pluginSourceFolder)) {
            throw new Error(`Missing plugin ${pluginName} at ${pluginSourceFolder}`);
        }

        cpSync(pluginSourceFolder, join(pluginsTargetFolder, pluginName), {
            recursive: true,
            force: true,
            dereference: true,
        });
    }

    cleanPluginArtifacts(pluginsTargetFolder);
    rmSync(join(pluginsTargetFolder, "gui_plugin", "wrappers"), { recursive: true, force: true });
};

const installAppImages = (appFolder) => {
    const imagesTargetFolder = join(appFolder, "images");
    resetDirectory(imagesTargetFolder);
    cpSync(electronImagesFolder, imagesTargetFolder, { recursive: true, force: true });
};

const renamePackagedApp = (target, targetFolder) => {
    if (target.startsWith("win32")) {
        const windowsExecutablePath = join(targetFolder, "electron.exe");
        const renamedWindowsExecutablePath = join(targetFolder, `${desktopBundleStem}.exe`);

        if (existsSync(windowsExecutablePath)) {
            rmSync(renamedWindowsExecutablePath, { force: true });
            renameSync(windowsExecutablePath, renamedWindowsExecutablePath);
        }

        return;
    }

    if (target.startsWith("linux")) {
        const linuxExecutablePath = join(targetFolder, "electron");
        const renamedLinuxExecutablePath = join(targetFolder, desktopBundleStem);

        if (existsSync(linuxExecutablePath)) {
            rmSync(renamedLinuxExecutablePath, { force: true });
            renameSync(linuxExecutablePath, renamedLinuxExecutablePath);
        }

        return;
    }

    if (!target.startsWith("darwin")) {
        return;
    }

    const appBundlePath = join(targetFolder, "Electron.app");
    const renamedBundlePath = join(targetFolder, `${desktopBundleStem}.app`);

    if (existsSync(appBundlePath)) {
        rmSync(renamedBundlePath, { recursive: true, force: true });
        renameSync(appBundlePath, renamedBundlePath);
    }
};

const replacePlistStringValue = (plistContents, key, value) => {
    const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)([^<]*)(</string>)`);

    if (!pattern.test(plistContents)) {
        throw new Error(`Could not find ${key} in the macOS app bundle Info.plist.`);
    }

    return plistContents.replace(pattern, `$1${value}$3`);
};

const updateMacBundleMetadata = (targetFolder) => {
    const plistPath = join(targetFolder, `${desktopBundleStem}.app`, "Contents", "Info.plist");
    if (!existsSync(plistPath)) {
        throw new Error(`Could not find Info.plist at ${plistPath}`);
    }

    let plistContents = readFileSync(plistPath, "utf8");
    plistContents = replacePlistStringValue(plistContents, "CFBundleDisplayName", desktopBundleStem);
    plistContents = replacePlistStringValue(plistContents, "CFBundleName", desktopBundleStem);
    plistContents = replacePlistStringValue(plistContents, "CFBundleIdentifier", desktopBundleIdentifier);
    plistContents = replacePlistStringValue(plistContents, "CFBundleShortVersionString", desktopPackageVersion);
    plistContents = replacePlistStringValue(plistContents, "CFBundleVersion", desktopPackageVersion);
    writeFileSync(plistPath, plistContents);
};

const installMacBundleIcon = (targetFolder) => {
    if (!existsSync(desktopIconIcns)) {
        throw new Error(`Could not find macOS app icon at ${desktopIconIcns}`);
    }

    const iconTargetPath = join(targetFolder, `${desktopBundleStem}.app`, "Contents", "Resources", "electron.icns");
    cpSync(desktopIconIcns, iconTargetPath, { force: true });
};

const installAppPayload = (target, appFolder, includeShellBundle) => {
    if (includeShellBundle) {
        resetDirectory(appFolder);
    } else {
        ensureDirectory(appFolder);
        rmSync(join(appFolder, "package.json"), { force: true });
        rmSync(join(appFolder, "src"), { recursive: true, force: true });
        rmSync(join(appFolder, "frontend"), { recursive: true, force: true });
        rmSync(join(appFolder, "images"), { recursive: true, force: true });

        if (!existsSync(join(appFolder, "shell"))) {
            throw new Error(`Could not find an existing shell bundle in ${appFolder}.`);
        }
    }

    writeFileSync(join(appFolder, "package.json"), buildAppManifest());
    cpSync(electronSourceFolder, join(appFolder, "src"), { recursive: true, force: true });
    ensureDirectory(join(appFolder, "frontend"));
    cpSync(buildFolder, join(appFolder, "frontend", "build"), { recursive: true, force: true });
    installAppImages(appFolder);

    if (includeShellBundle) {
        prepareShellBundle(target, appFolder);
    }
};

const packageTarget = (target) => {
    const runtimeSourceFolder = join(electronCacheFolder, target);
    if (!existsSync(runtimeSourceFolder)) {
        throw new Error(`Missing Electron runtime for ${target} at ${runtimeSourceFolder}`);
    }

    const targetOutputFolder = join(packagedDesktopFolder, target);
    const targetStagingFolder = join(outputFolder, target);
    copyElectronRuntime(target, runtimeSourceFolder, targetStagingFolder);

    const resourcesFolder = getResourcesDirectory(target, targetStagingFolder);
    if (!existsSync(resourcesFolder)) {
        throw new Error(`Could not locate Electron resources directory for ${target} at ${resourcesFolder}`);
    }

    const appFolder = join(resourcesFolder, "app");
    installAppPayload(target, appFolder, true);

    rmSync(targetOutputFolder, { recursive: true, force: true });
    ensureDirectory(packagedDesktopFolder);
    cpSync(targetStagingFolder, targetOutputFolder, { recursive: true, force: true });
    renamePackagedApp(target, targetOutputFolder);
    if (target.startsWith("darwin")) {
        updateMacBundleMetadata(targetOutputFolder);
        installMacBundleIcon(targetOutputFolder);
    }

    Logger.success(`Created desktop package for ${target} in ${targetOutputFolder}`);
};

const quickPackageTarget = (target) => {
    const targetOutputFolder = join(packagedDesktopFolder, target);
    const resourcesFolder = getPackagedResourcesDirectory(target, targetOutputFolder);
    if (!existsSync(resourcesFolder)) {
        throw new Error(
            `Missing existing desktop package for ${target} at ${targetOutputFolder}. Run a full package first.`,
        );
    }

    const appFolder = join(resourcesFolder, "app");
    if (!existsSync(appFolder)) {
        throw new Error(`Could not locate the packaged app payload for ${target} at ${appFolder}`);
    }

    installAppPayload(target, appFolder, false);
    Logger.success(`Updated desktop package app payload for ${target} in ${targetOutputFolder}`);
};

const options = parseArguments(process.argv);

if (!options.quick) {
    for (const pluginName of pluginNames) {
        const pluginFolder = pluginSourceFolders.get(pluginName);
        if (!existsSync(pluginFolder)) {
            throw new Error(`Missing plugin source in this repo: ${pluginFolder}`);
        }
    }
}

process.chdir(frontEndFolder);
executeTask("npm run build-if-needed", "Ensuring the frontend build is up to date...");
process.chdir(electronFolder);

if (!options.quick) {
    Logger.info("Clearing the desktop packaging output...");
    rmSync(outputFolder, { recursive: true, force: true });
    rmSync(packagedDesktopFolder, { recursive: true, force: true });
    Logger.done();
}

for (const target of options.targets) {
    Logger.info(`${options.quick ? "Quick-updating" : "Packaging"} desktop runtime for ${target}...`);
    if (options.quick) {
        quickPackageTarget(target);
    } else {
        packageTarget(target);
    }
    Logger.done();
}
