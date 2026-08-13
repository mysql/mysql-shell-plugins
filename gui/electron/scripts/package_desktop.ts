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
const {
    chmodSync,
    cpSync,
    existsSync,
    lstatSync,
    mkdirSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync,
} = require("fs");
const { basename, dirname, isAbsolute, join, resolve } = require("path");

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
];
const desktopProductName = "MySQL Workbench";
const desktopBundleStem = "MySQL Workbench";
const desktopLinuxExecutableName = "mysql-workbench";
const desktopBundleIdentifier = "com.oracle.mysqlworkbench";
const desktopPackageAuthor = {
    name: "Oracle and/or its affiliates",
};
const desktopPackageHomepage = "https://www.mysql.com/products/workbench/";
const desktopPackageLicense = "GPL-2.0";
const desktopDebianShellDependencies = [
    "libbz2-1.0",
    "libc6 (>= 2.28)",
    "libcrypt1 (>= 1:4.1.0)",
    "libgcc-s1 (>= 4.2)",
    "libgdbm-compat4 (>= 1.16)",
    "libgdbm6 (>= 1.16)",
    "libkeyutils1 (>= 1.5.9)",
    "libncursesw6 (>= 6)",
    "libstdc++6 (>= 10.2)",
    "libtinfo6 (>= 6)",
    "libudev1 (>= 183)",
    "libyaml-0-2",
    "zlib1g (>= 1:1.2.0)",
];
const desktopRpmCommonShellDependencies = [
    "libbz2.so.1()(64bit)",
    "libc.so.6(GLIBC_2.28)(64bit)",
    "libcrypt.so.1()(64bit)",
    "libkeyutils.so.1(KEYUTILS_1.5)(64bit)",
    "libncursesw.so.6()(64bit)",
    "libpanelw.so.6()(64bit)",
    "libstdc++.so.6(CXXABI_1.3.11)(64bit)",
    "libstdc++.so.6(GLIBCXX_3.4.22)(64bit)",
    "libtinfo.so.6()(64bit)",
    "libudev.so.1(LIBUDEV_183)(64bit)",
    "libyaml-0.so.2()(64bit)",
    "libz.so.1(ZLIB_1.2.0)(64bit)",
];
const desktopRpmTargetShellDependencies = new Map([
    ["linux-x64", [
        "libgcc_s.so.1(GCC_4.2.0)(64bit)",
        "libgdbm.so.6()(64bit)",
        "libgdbm_compat.so.4()(64bit)",
    ]],
    ["linux-arm64", [
        "libgcc_s.so.1(GCC_4.5.0)(64bit)",
    ]],
]);
const electronFolder = resolve(__dirname, "..");
const packageJson = require(join(electronFolder, "package.json"));
const resolveElectronBuilderCacheFolder = (metadata, projectFolder) => {
    const configuredPath = metadata.desktopElectronBuilderCache;
    if (typeof configuredPath !== "string"
        || configuredPath.length === 0
        || isAbsolute(configuredPath)) {
        throw new Error(
            "desktopElectronBuilderCache must be a non-empty relative path.",
        );
    }

    return resolve(projectFolder, configuredPath);
};

const electronBuilderCacheFolder = resolveElectronBuilderCacheFolder(
    packageJson,
    electronFolder,
);
const guiFolder = resolve(electronFolder, "..");
const frontEndFolder = join(guiFolder, "frontend");
const buildFolder = join(frontEndFolder, "build");
const tempPackageFolder = join(electronFolder, "packaging", "temp");
const packagedDesktopFolder = join(electronFolder, "packaging", "desktop-packages");
const packagedArtifactsFolder = join(electronFolder, "packaging", "desktop-artifacts");
const shellCacheFolder = resolve(process.env.MYSQL_SHELL_STAGING_ROOT ?? join(electronFolder, "packaging", "mysql-shell-staging"));
const electronCacheFolder = join(electronFolder, "packaging", "electron");
const electronSourceFolder = join(electronFolder, "src");
const electronImagesFolder = join(electronFolder, "images");
const taskHelperFolder = join(guiFolder, "task-helper");
const desktopIconIcns = join(electronImagesFolder, "app-icon.icns");
const desktopIconIco = join(electronImagesFolder, "app-icon.ico");
const desktopIconPng = join(electronImagesFolder, "app-icon.png");
const windowsSignHook = join(__dirname, "windows_sign.cjs");
const resolveElectronBuilderInvocation = (projectFolder, args) => {
    return {
        command: process.execPath,
        args: [resolve(projectFolder, "node_modules/electron-builder/cli.js"), ...args],
    };
};
const pluginSourceFolders = new Map([
    ["gui_plugin", join(guiFolder, "backend", "gui_plugin")],
    ["mds_plugin", resolve(guiFolder, "..", "mds_plugin")],
    ["mrs_plugin", resolve(guiFolder, "..", "mrs_plugin")],
    ["msm_plugin", resolve(guiFolder, "..", "msm_plugin")],
    ["util_plugin", resolve(guiFolder, "..", "util_plugin")],
]);
const validateDesktopPackageSuffixes = (metadata) => {
    const suffixes = metadata.desktopPackageSuffixes;
    if (!suffixes || typeof suffixes !== "object" || Array.isArray(suffixes)) {
        throw new Error("desktopPackageSuffixes must be an object.");
    }

    const entries = Object.entries(suffixes);
    if (entries.length === 0
        || entries.some(([name, suffix]) => name.length === 0 || typeof suffix !== "string")) {
        throw new Error("desktopPackageSuffixes must map non-empty names to string suffixes.");
    }

    if (new Set(entries.map(([, suffix]) => suffix)).size !== entries.length) {
        throw new Error("desktopPackageSuffixes values must be unique.");
    }

    if (typeof suffixes.community !== "string") {
        throw new Error("desktopPackageSuffixes must define community.");
    }

    return suffixes;
};

const validateDesktopMsiUpgradeCode = (metadata) => {
    const upgradeCode = metadata.desktopMsiUpgradeCode;
    if (typeof upgradeCode !== "string"
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(upgradeCode)) {
        throw new Error("desktopMsiUpgradeCode must be a canonical UUID.");
    }

    return upgradeCode;
};

const desktopPackageSuffixes = validateDesktopPackageSuffixes(packageJson);
const desktopMsiUpgradeCode = validateDesktopMsiUpgradeCode(packageJson);
const desktopPackageName = packageJson.name;
const desktopPackageVersion = packageJson.version;

if (typeof desktopPackageName !== "string" || desktopPackageName.length === 0) {
    throw new Error("Could not determine the desktop package name.");
}

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

const getDesktopPackageName = (packageNameSuffix) => {
    return `${desktopPackageName}${packageNameSuffix}`;
};

const parseArguments = (argv) => {
    const result = {
        targets: [],
        quick: false,
        artifacts: false,
        zip: false,
        sign: false,
        artifactManifest: undefined,
        skipDeb: false,
        skipRpm: false,
        packageNameSuffix: desktopPackageSuffixes.community,
    };

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

        if (argument === "--win-sign") {
            result.sign = true;
            continue;
        }

        if (argument.startsWith("--artifact-manifest=")) {
            const manifestPath = argument.slice("--artifact-manifest=".length);
            if (manifestPath.length === 0) {
                throw new Error("--artifact-manifest requires a path.");
            }

            result.artifactManifest = resolve(manifestPath);
            continue;
        }

        if (argument === "--skip-deb") {
            result.skipDeb = true;
            continue;
        }

        if (argument === "--skip-rpm") {
            result.skipRpm = true;
            continue;
        }

        if (argument.startsWith("--package-name-suffix=")) {
            const packageNameSuffix = argument.slice("--package-name-suffix=".length);
            if (!Object.values(desktopPackageSuffixes).includes(packageNameSuffix)) {
                throw new Error(`Unknown package name suffix '${packageNameSuffix}'.`);
            }

            result.packageNameSuffix = packageNameSuffix;
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

    if (result.sign && result.targets.some((target) => !target.startsWith("win32-"))) {
        throw new Error("--win-sign can only be used with Windows targets.");
    }

    if (result.quick && result.artifacts) {
        throw new Error("--quick cannot be combined with --artifacts.");
    }

    if (result.quick && result.zip) {
        throw new Error("--quick cannot be combined with --zip.");
    }

    if ((result.skipDeb || result.skipRpm) && !result.artifacts) {
        throw new Error("--skip-deb and --skip-rpm can only be used with --artifacts.");
    }

    if (result.artifactManifest !== undefined && !result.artifacts && !result.zip) {
        throw new Error("--artifact-manifest can only be used with --zip or --artifacts.");
    }

    const hasLinuxTarget = result.targets.some((target) => target.startsWith("linux-"));
    if (hasLinuxTarget && result.skipDeb && result.skipRpm) {
        throw new Error("At least one Linux installer format must remain enabled.");
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
        const stats = lstatSync(fullPath);

        if ([".vscode", "__pycache__", "docs", "examples", "htmlcov", "node_modules", "tests"]
            .includes(entry) && (stats.isDirectory() || stats.isSymbolicLink())) {
            rmSync(fullPath, { recursive: true, force: true });
            continue;
        }

        if (stats.isDirectory()) {
            cleanPluginArtifacts(fullPath);
            continue;
        }

        if (["cspell.json", "python.env", "pytest-coverage.ini", "pytest.ini", "run_tests.py"].includes(entry)
            || entry.endsWith(".pyc") || entry.endsWith(".pyo")) {
            rmSync(fullPath, { force: true });
        }
    }
};

const removePaths = (root, relativePaths) => {
    for (const relativePath of relativePaths) {
        rmSync(join(root, relativePath), { recursive: true, force: true });
    }
};

const findDirectories = (parent, matches) => {
    if (!existsSync(parent)) {
        return [];
    }

    return readdirSync(parent, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && matches(entry.name))
        .map((entry) => join(parent, entry.name));
};

const findPythonLibraryFolders = (shellFolder) => {
    const unixParent = join(shellFolder, "lib", "mysqlsh", "lib");
    const unixFolders = findDirectories(unixParent, (name) => name.startsWith("python"));
    const windowsParent = join(shellFolder, "lib");
    const windowsFolders = findDirectories(windowsParent, (name) => name.startsWith("Python"))
        .map((folder) => join(folder, "Lib"))
        .filter((folder) => existsSync(folder) && lstatSync(folder).isDirectory());

    return [...unixFolders, ...windowsFolders];
};

const cleanShellBundle = (shellFolder) => {
    const pluginsFolder = findPythonPluginFolder(shellFolder);
    cleanPluginArtifacts(pluginsFolder);
    removePaths(pluginsFolder, [
        join("mrs_plugin", "db_schema", "mrs.msm.project", "development"),
        join("mrs_plugin", "db_schema", "tasks.msm.project", "development"),
        join("gui_plugin", "debugger"),
        join("gui_plugin", "wrappers"),
        join("mrs_plugin", "grammar", "test"),
        join("mrs_plugin", "scripts", "run_grammar_test.sh"),
    ]);

    const pythonPathsToRemove = [
        "test",
        "__phello__",
        join("idlelib", "idle_test"),
        join("site-packages", "tests"),
        join("site-packages", "docs"),
    ];
    for (const pythonFolder of findPythonLibraryFolders(shellFolder)) {
        removePaths(pythonFolder, pythonPathsToRemove);
    }

    removePaths(shellFolder, [
        join("lib", "mysqlsh", "python-packages", "mysql_gadgets", "tests"),
    ]);
};

const buildAppManifest = (packageName, packageNameSuffix) => {
    return JSON.stringify({
        name: packageName,
        productName: desktopProductName,
        version: desktopPackageVersion,
        desktopPackageSuffix: packageNameSuffix,
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

const getDesktopExecutableName = (target) => {
    return target.startsWith("linux") ? desktopLinuxExecutableName : desktopBundleStem;
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

    if (!options.skipDeb) {
        targets.push("deb");
    }

    if (!options.skipRpm) {
        targets.push("rpm");
    }

    return targets;
};

const getArtifactFileName = (packageName, target, extension) => {
    return `${packageName}-${desktopPackageVersion}-${target}.${extension}`;
};

const getArtifactFileNames = (target, packageOptions, packageName) => {
    return getElectronBuilderTargets(target, packageOptions)
        .filter((builderTarget) => builderTarget !== "dir")
        .map((extension) => getArtifactFileName(packageName, target, extension));
};

const getDesktopRpmShellDependencies = (target) => {
    const targetDependencies = desktopRpmTargetShellDependencies.get(target);
    if (targetDependencies === undefined) {
        return [];
    }

    return [
        ...desktopRpmCommonShellDependencies,
        ...targetDependencies,
    ];
};

const buildElectronBuilderConfig = (target, outputFolder, packageOptions, packageName) => {
    const targets = getElectronBuilderTargets(target, packageOptions);
    const alternativePackageNames = Object.values(desktopPackageSuffixes)
        .filter((suffix) => suffix !== packageOptions.packageNameSuffix)
        .map((suffix) => getDesktopPackageName(suffix));
    const debFpmOptions = [
        ...alternativePackageNames.flatMap((alternativePackageName) => [
            `--conflicts=${alternativePackageName}`,
            `--replaces=${alternativePackageName}`,
        ]),
        ...desktopDebianShellDependencies.map((dependency) => `--depends=${dependency}`),
    ];
    const rpmFpmOptions = target.startsWith("linux-")
        ? [
            ...getDesktopRpmShellDependencies(target)
                .map((dependency) => `--depends=${dependency}`),
            ...(packageOptions.packageNameSuffix === desktopPackageSuffixes.community
                ? []
                : [
                    `--provides=${getDesktopPackageName(desktopPackageSuffixes.community)} `
                        + "= %{version}-%{release}",
                    `--provides=${getDesktopPackageName(desktopPackageSuffixes.community)}`
                        + "%{?_isa} = %{version}-%{release}",
                    `--replaces=${getDesktopPackageName(desktopPackageSuffixes.community)} `
                        + "< %{version}-%{release}",
                ]),
        ]
        : undefined;
    const config = {
        appId: desktopBundleIdentifier,
        productName: desktopProductName,
        executableName: getDesktopExecutableName(target),
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
        extraFiles: [
            {
                from: join(electronFolder, "LICENSE"),
                to: "LICENSE",
            },
        ],
        artifactName: getArtifactFileName(packageName, target, "${ext}"),
        mac: {
            target: target.startsWith("darwin") ? targets : null,
            category: "public.app-category.developer-tools",
            icon: desktopIconIcns,
            identity: null,
        },
        dmg: {
            sign: false,
            background: join(electronImagesFolder, "dmg-background.png"),
            contents: [
                {
                    x: 160,
                    y: 200,
                },
                {
                    x: 370,
                    y: 200,
                    type: "link",
                    path: "/Applications",
                },
            ],
        },
        win: {
            target: target.startsWith("win32") ? targets : null,
            icon: desktopIconIco,
            signExecutable: packageOptions.sign === true,
            signExts: packageOptions.sign === true ? [".dll", "!.msi"] : undefined,
            signtoolOptions: packageOptions.sign === true
                ? {
                    sign: windowsSignHook,
                    signingHashAlgorithms: ["sha256"],
                }
                : undefined,
        },
        msi: target.startsWith("win32")
            ? {
                // Keep both false to let users choose per-user or per-machine installation.
                oneClick: false,
                perMachine: false,
                menuCategory: "MySQL",
                upgradeCode: desktopMsiUpgradeCode,
            }
            : undefined,
        linux: {
            target: target.startsWith("linux") ? targets : null,
            category: "Development",
            icon: desktopIconPng,
            maintainer: desktopPackageAuthor.name,
            vendor: desktopPackageAuthor.name,
            synopsis: desktopProductName,
            description: packageJson.description,
        },
        deb: {
            packageName,
            fpm: debFpmOptions,
        },
        rpm: {
            packageName,
            fpm: rpmFpmOptions,
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

    const executableName = getDesktopExecutableName(target);
    const executable = findEntry(outputFolder, (_fullPath, entry, stats) => {
        return stats.isFile() && entry === executableName;
    });
    if (!executable) {
        throw new Error(`Could not find ${executableName} under ${outputFolder}`);
    }

    return dirname(executable);
};

const copyArtifactFiles = (sourceFolder, targetFolder, artifactFileNames) => {
    const artifacts = artifactFileNames.map((artifactFileName) => {
        return resolve(sourceFolder, artifactFileName);
    });
    const missingArtifacts = artifacts.filter((artifact) => {
        return !existsSync(artifact) || !statSync(artifact).isFile();
    });
    if (missingArtifacts.length > 0) {
        throw new Error(`Expected desktop artifact was not generated: ${missingArtifacts[0]}`);
    }

    resetDirectory(targetFolder);
    return artifacts.map((artifact) => {
        const target = resolve(targetFolder, basename(artifact));
        cpSync(artifact, target, { force: true });

        return target;
    });
};

const writeArtifactManifest = (manifestPath, artifacts) => {
    ensureDirectory(dirname(manifestPath));
    writeFileSync(
        manifestPath,
        `${JSON.stringify({ artifacts }, null, 2)}\n`,
        "utf8",
    );
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

    const invocation = resolveElectronBuilderInvocation(electronFolder, args);
    const result = spawnSync(invocation.command, invocation.args, {
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

    cleanShellBundle(shellTargetFolder);
};

const installAppImages = (appFolder) => {
    const imagesTargetFolder = join(appFolder, "images");
    resetDirectory(imagesTargetFolder);
    cpSync(electronImagesFolder, imagesTargetFolder, { recursive: true, force: true });
};

const getTaskHelperInstallFolder = (target, targetFolder) => {
    return join(getPackagedResourcesDirectory(target, targetFolder), "app", "helpers");
};

const installProductBundleHelper = (target, targetFolder) => {
    const helperSourcePath = join(taskHelperFolder, "task-helper");
    const setupSourcePath = join(taskHelperFolder, "task-helper-setup");
    const setupModuleSourcePath = join(taskHelperFolder, "task_helper_setup.py");
    for (const path of [helperSourcePath, setupSourcePath, setupModuleSourcePath]) {
        if (!existsSync(path)) {
            throw new Error(`Could not find task helper file at ${path}`);
        }
    }

    const helpersFolder = getTaskHelperInstallFolder(target, targetFolder);
    ensureDirectory(helpersFolder);

    if (target.startsWith("win32")) {
        const helperScriptPath = join(helpersFolder, "task-helper.py");
        const helperTargetPath = join(helpersFolder, "task-helper.cmd");
        const setupScriptPath = join(helpersFolder, "task-helper-setup.py");
        const setupTargetPath = join(helpersFolder, "task-helper-setup.cmd");

        cpSync(helperSourcePath, helperScriptPath, { force: true });
        cpSync(setupSourcePath, setupScriptPath, { force: true });
        cpSync(setupModuleSourcePath, join(helpersFolder, "task_helper_setup.py"), { force: true });
        writeFileSync(
            helperTargetPath,
            "@echo off\r\n"
            + "setlocal\r\n"
            + "\"%~dp0..\\shell\\bin\\mysqlsh.exe\" --py -f \"%~dp0task-helper.py\" %*\r\n"
            + "exit /b %ERRORLEVEL%\r\n",
        );
        writeFileSync(
            setupTargetPath,
            "@echo off\r\n"
            + "setlocal\r\n"
            + "\"%~dp0..\\shell\\bin\\mysqlsh.exe\" --py -f \"%~dp0task-helper-setup.py\" %*\r\n"
            + "exit /b %ERRORLEVEL%\r\n",
        );
    } else {
        const helperTargetPath = join(helpersFolder, "task-helper");
        const setupTargetPath = join(helpersFolder, "task-helper-setup");

        cpSync(helperSourcePath, helperTargetPath, { force: true });
        cpSync(setupSourcePath, setupTargetPath, { force: true });
        cpSync(setupModuleSourcePath, join(helpersFolder, "task_helper_setup.py"), { force: true });
        chmodSync(helperTargetPath, 0o755);
        chmodSync(setupTargetPath, 0o755);
    }
};

const installAppPayload = (target, appFolder, includeShellBundle, packageName, packageNameSuffix) => {
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

    writeFileSync(join(appFolder, "package.json"), buildAppManifest(packageName, packageNameSuffix));
    cpSync(electronSourceFolder, join(appFolder, "src"), { recursive: true, force: true });
    ensureDirectory(join(appFolder, "frontend"));
    cpSync(buildFolder, join(appFolder, "frontend", "build"), { recursive: true, force: true });
    ensureDirectory(join(appFolder, "frontend", "src", "data-models"));
    cpSync(join(frontEndFolder, "src", "data-models", "admin-pages.json"),
        join(appFolder, "frontend", "src", "data-models", "admin-pages.json"));
    installAppImages(appFolder);

    if (includeShellBundle) {
        prepareShellBundle(target, appFolder);
    }
};

const packageTarget = (target, packageOptions) => {
    const packageName = getDesktopPackageName(packageOptions.packageNameSuffix);
    const targetOutputFolder = join(packagedDesktopFolder, target);
    const targetArtifactFolder = join(packagedArtifactsFolder, target);
    const targetStagingFolder = join(tempPackageFolder, target);
    const appFolder = join(targetStagingFolder, "app");
    const builderOutputFolder = join(targetStagingFolder, "builder-output");
    const builderConfigPath = join(targetStagingFolder, "electron-builder.json");

    resetDirectory(targetStagingFolder);
    installAppPayload(target, appFolder, true, packageName, packageOptions.packageNameSuffix);
    writeFileSync(
        builderConfigPath,
        buildElectronBuilderConfig(target, builderOutputFolder, packageOptions, packageName),
    );
    runElectronBuilder(target, appFolder, builderConfigPath, packageOptions);

    ensureDirectory(packagedDesktopFolder);
    copyPackagedRuntime(target, findBuiltPackageRoot(target, builderOutputFolder), targetOutputFolder);
    const artifacts = packageOptions.artifacts || packageOptions.zip
        ? copyArtifactFiles(
            builderOutputFolder,
            targetArtifactFolder,
            getArtifactFileNames(target, packageOptions, packageName),
        )
        : [];
    installProductBundleHelper(target, targetOutputFolder);

    Logger.success(`Created desktop package for ${target} in ${targetOutputFolder}`);
    if (packageOptions.artifacts || packageOptions.zip) {
        Logger.success(`Created desktop artifacts for ${target} in ${targetArtifactFolder}`);
    }

    return artifacts;
};

const quickPackageTarget = (target, packageOptions) => {
    const packageName = getDesktopPackageName(packageOptions.packageNameSuffix);
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

    installAppPayload(target, appFolder, false, packageName, packageOptions.packageNameSuffix);
    installProductBundleHelper(target, targetOutputFolder);
    Logger.success(`Updated desktop package app payload for ${target} in ${targetOutputFolder}`);
};

const main = (argv) => {
    const options = parseArguments(argv);
    const artifacts = [];

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
            quickPackageTarget(target, options);
        } else {
            artifacts.push(...packageTarget(target, options));
        }
        Logger.done();
    }

    if (options.artifactManifest !== undefined) {
        writeArtifactManifest(options.artifactManifest, artifacts);
    }
};

module.exports = {
    buildAppManifest,
    buildElectronBuilderConfig,
    cleanShellBundle,
    copyArtifactFiles,
    getArtifactFileName,
    getArtifactFileNames,
    getDesktopPackageName,
    parseArguments,
    resolveElectronBuilderCacheFolder,
    resolveElectronBuilderInvocation,
    validateDesktopMsiUpgradeCode,
    validateDesktopPackageSuffixes,
    writeArtifactManifest,
};

if (require.main === module) {
    main(process.argv);
}
