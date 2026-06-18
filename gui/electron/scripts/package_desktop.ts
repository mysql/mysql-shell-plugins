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
const { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } = require("fs");
const { basename, dirname, join, resolve } = require("path");

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
const desktopPackageAuthor = {
    name: "Oracle and/or its affiliates",
};
const desktopPackageHomepage = "https://www.mysql.com/products/workbench/";
const desktopPackageLicense = "GPL-2.0";
const electronFolder = resolve(__dirname, "..");
const guiFolder = resolve(electronFolder, "..");
const frontEndFolder = join(guiFolder, "frontend");
const buildFolder = join(frontEndFolder, "build");
const tempPackageFolder = join(electronFolder, "packaging", "temp");
const packagedDesktopFolder = join(electronFolder, "packaging", "desktop-packages");
const packagedArtifactsFolder = join(electronFolder, "packaging", "desktop-artifacts");
const shellCacheFolder = resolve(process.env.MYSQL_SHELL_STAGING_ROOT ?? join(electronFolder, "packaging", "mysql-shell-staging"));
const electronCacheFolder = join(electronFolder, "packaging", "electron");
const electronBuilderCacheFolder = join(electronFolder, "packaging", "electron-builder-cache");
const electronSourceFolder = join(electronFolder, "src");
const electronImagesFolder = join(electronFolder, "images");
const desktopIconIcns = join(electronImagesFolder, "app-icon.icns");
const desktopIconIco = join(electronImagesFolder, "app-icon.ico");
const desktopIconPng = join(electronImagesFolder, "app-icon.png");
const electronBuilderExecutable = join(
    electronFolder,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "electron-builder.cmd" : "electron-builder",
);
const pluginSourceFolders = new Map([
    ["gui_plugin", join(guiFolder, "backend", "gui_plugin")],
    ["mds_plugin", resolve(guiFolder, "..", "mds_plugin")],
    ["mrs_plugin", resolve(guiFolder, "..", "mrs_plugin")],
    ["msm_plugin", resolve(guiFolder, "..", "msm_plugin")],
    ["util_plugin", resolve(guiFolder, "..", "util_plugin")],
    ["migration_plugin", resolve(guiFolder, "..", "migration_plugin")],
]);
const packageJson = require(join(electronFolder, "package.json"));
const desktopPackageVersion = packageJson.version;

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
    const result = { targets: [], quick: false, artifacts: false, zip: false };

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

        if (argument === "--artifacts") {
            result.artifacts = true;
            continue;
        }

        if (argument === "--zip") {
            result.zip = true;
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

    if (result.quick && result.artifacts) {
        throw new Error("--quick cannot be combined with --artifacts.");
    }

    if (result.quick && result.zip) {
        throw new Error("--quick cannot be combined with --zip.");
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

const copyMacBundle = (sourceBundle, targetBundle) => {
    const result = spawnSync("/usr/bin/ditto", [sourceBundle, targetBundle], { stdio: "inherit" });
    if (result.status !== 0) {
        throw new Error(`Could not copy ${sourceBundle} to ${targetBundle}.`);
    }
};

const copyPackagedRuntime = (target, source, destination) => {
    if (target.startsWith("darwin")) {
        resetDirectory(destination);
        copyMacBundle(source, join(destination, basename(source)));

        return;
    }

    resetDirectory(destination);
    cpSync(source, destination, { recursive: true, force: true });
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
        author: desktopPackageAuthor,
        homepage: desktopPackageHomepage,
        license: desktopPackageLicense,
        main: "src/main.cjs",
    }, null, 4);
};

const getPackagedResourcesDirectory = (target, targetOutputFolder) => {
    if (target.startsWith("darwin")) {
        return join(targetOutputFolder, `${desktopBundleStem}.app`, "Contents", "Resources");
    }

    return join(targetOutputFolder, "resources");
};

const getTargetBuildOptions = (target) => {
    if (target === "darwin-arm64") {
        return { platform: "mac", arch: "arm64" };
    }

    if (target === "darwin-x64") {
        return { platform: "mac", arch: "x64" };
    }

    if (target === "win32-x64") {
        return { platform: "win", arch: "x64" };
    }

    if (target === "linux-arm64") {
        return { platform: "linux", arch: "arm64" };
    }

    if (target === "linux-x64") {
        return { platform: "linux", arch: "x64" };
    }

    throw new Error(`Unsupported target '${target}'.`);
};

const getElectronBuilderTargets = (target, options) => {
    const targets = [
        "dir",
    ];

    if (options.zip) {
        targets.push("zip");
    }

    if (!options.artifacts) {
        return targets;
    }

    if (target.startsWith("darwin")) {
        targets.push("dmg");

        return targets;
    }

    if (target.startsWith("win32")) {
        targets.push("msi");

        return targets;
    }

    targets.push("deb", "rpm");

    return targets;
};

const buildElectronBuilderConfig = (target, outputFolder, packageOptions) => {
    const targets = getElectronBuilderTargets(target, packageOptions);
    const config = {
        appId: desktopBundleIdentifier,
        productName: desktopProductName,
        executableName: desktopBundleStem,
        copyright: "Copyright (c) 2026, Oracle and/or its affiliates.",
        electronVersion: packageJson.dependencies.electron,
        asar: false,
        npmRebuild: false,
        nodeGypRebuild: false,
        directories: {
            output: outputFolder,
        },
        files: [
            "**/*",
        ],
        artifactName: `${desktopPackageName}-${desktopPackageVersion}-${target}.\${ext}`,
        mac: {
            target: targets,
            category: "public.app-category.developer-tools",
            icon: desktopIconIcns,
            identity: null,
        },
        dmg: {
            sign: false,
        },
        win: {
            target: targets,
            icon: desktopIconIco,
            signExecutable: false,
        },
        linux: {
            target: targets,
            category: "Development",
            icon: desktopIconPng,
            maintainer: desktopPackageAuthor.name,
            vendor: desktopPackageAuthor.name,
            synopsis: desktopProductName,
            description: packageJson.description,
        },
        deb: {
            packageName: desktopPackageName,
        },
        rpm: {
            packageName: desktopPackageName,
        },
    };

    const runtimeSourceFolder = join(electronCacheFolder, target);
    if (existsSync(runtimeSourceFolder)) {
        config.electronDist = runtimeSourceFolder;
    }

    return JSON.stringify(config, null, 4);
};

const findEntry = (folder, predicate) => {
    for (const entry of readdirSync(folder)) {
        const fullPath = join(folder, entry);
        const stats = statSync(fullPath);

        if (predicate(fullPath, entry, stats)) {
            return fullPath;
        }

        if (stats.isDirectory()) {
            const match = findEntry(fullPath, predicate);
            if (match) {
                return match;
            }
        }
    }

    return undefined;
};

const findBuiltPackageRoot = (target, outputFolder) => {
    if (target.startsWith("darwin")) {
        const appBundle = findEntry(outputFolder, (_fullPath, entry, stats) => {
            return stats.isDirectory() && entry === `${desktopBundleStem}.app`;
        });
        if (!appBundle) {
            throw new Error(`Could not find ${desktopBundleStem}.app under ${outputFolder}`);
        }

        return appBundle;
    }

    if (target.startsWith("win32")) {
        const executable = findEntry(outputFolder, (_fullPath, entry, stats) => {
            return stats.isFile() && entry === `${desktopBundleStem}.exe`;
        });
        if (!executable) {
            throw new Error(`Could not find ${desktopBundleStem}.exe under ${outputFolder}`);
        }

        return dirname(executable);
    }

    const executable = findEntry(outputFolder, (_fullPath, entry, stats) => {
        return stats.isFile() && entry === desktopBundleStem;
    });
    if (!executable) {
        throw new Error(`Could not find ${desktopBundleStem} under ${outputFolder}`);
    }

    return dirname(executable);
};

const copyArtifactFiles = (sourceFolder, targetFolder) => {
    const artifactExtensions = new Set([
        ".deb",
        ".dmg",
        ".msi",
        ".rpm",
        ".zip",
    ]);
    const artifacts = [];

    const collect = (folder) => {
        for (const entry of readdirSync(folder)) {
            const fullPath = join(folder, entry);
            const stats = statSync(fullPath);

            if (stats.isDirectory()) {
                collect(fullPath);
                continue;
            }

            for (const extension of artifactExtensions) {
                if (entry.endsWith(extension)) {
                    artifacts.push(fullPath);
                    break;
                }
            }
        }
    };

    collect(sourceFolder);
    if (artifacts.length === 0) {
        throw new Error(`No desktop artifacts were generated under ${sourceFolder}`);
    }

    resetDirectory(targetFolder);
    for (const artifact of artifacts) {
        cpSync(artifact, join(targetFolder, basename(artifact)), { force: true });
    }
};

const runElectronBuilder = (target, appFolder, configPath, packageOptions) => {
    const targetOptions = getTargetBuildOptions(target);
    const args = [
        `--projectDir=${appFolder}`,
        `--config=${configPath}`,
        `--${targetOptions.platform}`,
        `--${targetOptions.arch}`,
        "--publish=never",
    ];

    if (!packageOptions.artifacts && !packageOptions.zip) {
        args.push("--dir");
    }

    const result = spawnSync(electronBuilderExecutable, args, {
        stdio: "inherit",
        env: {
            ...process.env,
            CSC_IDENTITY_AUTO_DISCOVERY: "false",
            ELECTRON_BUILDER_CACHE: electronBuilderCacheFolder,
        },
    });

    if (result.status !== 0) {
        console.log(result.error);
        throw new Error(`electron-builder failed for ${target}`);
    }
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

const packageTarget = (target, packageOptions) => {
    const targetOutputFolder = join(packagedDesktopFolder, target);
    const targetArtifactFolder = join(packagedArtifactsFolder, target);
    const targetStagingFolder = join(tempPackageFolder, target);
    const appFolder = join(targetStagingFolder, "app");
    const builderOutputFolder = join(targetStagingFolder, "builder-output");
    const builderConfigPath = join(targetStagingFolder, "electron-builder.json");

    resetDirectory(targetStagingFolder);
    installAppPayload(target, appFolder, true);
    writeFileSync(builderConfigPath, buildElectronBuilderConfig(target, builderOutputFolder, packageOptions));
    runElectronBuilder(target, appFolder, builderConfigPath, packageOptions);

    ensureDirectory(packagedDesktopFolder);
    copyPackagedRuntime(target, findBuiltPackageRoot(target, builderOutputFolder), targetOutputFolder);
    if (packageOptions.artifacts || packageOptions.zip) {
        copyArtifactFiles(builderOutputFolder, targetArtifactFolder);
    }

    Logger.success(`Created desktop package for ${target} in ${targetOutputFolder}`);
    if (packageOptions.artifacts || packageOptions.zip) {
        Logger.success(`Created desktop artifacts for ${target} in ${targetArtifactFolder}`);
    }
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
    rmSync(tempPackageFolder, { recursive: true, force: true });
    rmSync(packagedDesktopFolder, { recursive: true, force: true });
    if (options.artifacts || options.zip) {
        rmSync(packagedArtifactsFolder, { recursive: true, force: true });
    }
    Logger.done();
}

for (const target of options.targets) {
    Logger.info(`${options.quick ? "Quick-updating" : "Packaging"} desktop runtime for ${target}...`);
    if (options.quick) {
        quickPackageTarget(target);
    } else {
        packageTarget(target, options);
    }
    Logger.done();
}
