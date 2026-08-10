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

const assert = require("node:assert/strict");
const {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const test = require("node:test");
const { join, resolve } = require("node:path");
const packageMetadata = require("../../package.json");

const {
    buildAppManifest,
    buildElectronBuilderConfig,
    copyArtifactFiles,
    getDesktopPackageName,
    getArtifactFileNames,
    parseArguments,
    resolveElectronBuilderCacheFolder,
    resolveElectronBuilderInvocation,
    validateDesktopPackageSuffixes,
    writeArtifactManifest,
} = require("../../scripts/package_desktop.ts");

test("Electron Builder runs its JavaScript CLI with Node", () => {
    const projectFolder = resolve("electron-project");
    const invocation = resolveElectronBuilderInvocation(projectFolder, [
        "--win",
        "--x64",
    ]);

    assert.equal(invocation.command, process.execPath);
    assert.deepEqual(invocation.args, [
        resolve(projectFolder, "node_modules/electron-builder/cli.js"),
        "--win",
        "--x64",
    ]);
});

test("package metadata defines the Electron Builder cache location", () => {
    assert.equal(
        packageMetadata.desktopElectronBuilderCache,
        "packaging/electron-builder-cache",
    );
    assert.equal(
        resolveElectronBuilderCacheFolder(packageMetadata, resolve(__dirname, "../..")),
        resolve(__dirname, "../../packaging/electron-builder-cache"),
    );
});

test("Electron Builder cache location must be relative", () => {
    assert.throws(() => {
        resolveElectronBuilderCacheFolder(
            { desktopElectronBuilderCache: resolve("/tmp/electron-builder-cache") },
            resolve(__dirname, "../.."),
        );
    }, /desktopElectronBuilderCache must be a non-empty relative path/);
});

test("package metadata defines the shared suffixes", () => {
    assert.deepEqual(packageMetadata.desktopPackageSuffixes, {
        community: "",
        commercial: "-commercial",
    });
});

test("package name suffix defaults to the configured community suffix", () => {
    const options = parseArguments([
        "node", "package_desktop.ts", "--targets=linux-x64", "--zip",
    ]);

    assert.equal(options.packageNameSuffix, "");
    assert.equal(getDesktopPackageName(options.packageNameSuffix), "mysql-workbench");
});

test("Linux installer skip options default to false", () => {
    const options = parseArguments([
        "node", "package_desktop.ts", "--targets=linux-x64", "--artifacts",
    ]);

    assert.equal(options.skipDeb, false);
    assert.equal(options.skipRpm, false);
});

test("Windows signing is opt-in", () => {
    const unsigned = parseArguments([
        "node", "package_desktop.ts", "--targets=win32-x64", "--zip",
    ]);
    const signed = parseArguments([
        "node", "package_desktop.ts", "--targets=win32-x64", "--zip", "--win-sign",
    ]);

    assert.equal(unsigned.sign, false);
    assert.equal(signed.sign, true);
});

for (const targets of ["linux-x64", "darwin-arm64", "win32-x64,linux-x64"]) {
    test(`signing rejects non-Windows target set ${targets}`, () => {
        assert.throws(() => {
            parseArguments([
                "node", "package_desktop.ts", `--targets=${targets}`, "--zip", "--win-sign",
            ]);
        }, /--win-sign can only be used with Windows targets/);
    });
}

test("unsigned Windows builds have no signing configuration", () => {
    const options = parseArguments([
        "node", "package_desktop.ts", "--targets=win32-x64", "--zip",
    ]);
    const config = JSON.parse(buildElectronBuilderConfig(
        "win32-x64",
        "/tmp/desktop-output",
        options,
        "mysql-workbench",
    ));

    assert.equal(config.win.signExecutable, false);
    assert.equal(config.win.signExts, undefined);
    assert.equal(config.win.signtoolOptions, undefined);
});

for (const packageOption of ["--zip", "--artifacts"]) {
    test(`signed Windows ${packageOption} builds configure the payload signing hook`, () => {
        const options = parseArguments([
            "node", "package_desktop.ts", "--targets=win32-x64", packageOption, "--win-sign",
        ]);
        const config = JSON.parse(buildElectronBuilderConfig(
            "win32-x64",
            "/tmp/desktop-output",
            options,
            "mysql-workbench",
        ));

        assert.equal(config.win.signExecutable, true);
        assert.deepEqual(config.win.signExts, [".dll", "!.msi"]);
        assert.deepEqual(config.win.signtoolOptions.signingHashAlgorithms, ["sha256"]);
        assert.equal(
            config.win.signtoolOptions.sign,
            resolve(__dirname, "../../scripts/windows_sign.cjs"),
        );
    });
}

test("artifact manifest is accepted for artifact output", () => {
    const manifest = resolve("artifacts.json");
    const options = parseArguments([
        "node",
        "package_desktop.ts",
        "--targets=linux-x64",
        "--zip",
        `--artifact-manifest=${manifest}`,
    ]);

    assert.equal(options.artifactManifest, manifest);
});

test("artifact manifest requires artifact output", () => {
    assert.throws(() => {
        parseArguments([
            "node",
            "package_desktop.ts",
            "--targets=linux-x64",
            "--artifact-manifest=artifacts.json",
        ]);
    }, /--artifact-manifest can only be used with --zip or --artifacts/);
});

test("artifact filenames match the requested Electron Builder targets", () => {
    const installerOptions = parseArguments([
        "node", "package_desktop.ts", "--targets=win32-x64", "--artifacts",
    ]);
    const combinedOptions = parseArguments([
        "node", "package_desktop.ts", "--targets=win32-x64", "--zip", "--artifacts",
    ]);

    assert.deepEqual(
        getArtifactFileNames("win32-x64", installerOptions, "mysql-workbench"),
        ["mysql-workbench-26.7.0-win32-x64.msi"],
    );
    assert.deepEqual(
        getArtifactFileNames("win32-x64", combinedOptions, "mysql-workbench"),
        [
            "mysql-workbench-26.7.0-win32-x64.zip",
            "mysql-workbench-26.7.0-win32-x64.msi",
        ],
    );
});

test("copied artifacts contain only the exact requested outputs", (context) => {
    const root = mkdtempSync(join(tmpdir(), "package-desktop-artifacts-"));
    context.after(() => {
        rmSync(root, { recursive: true, force: true });
    });
    const source = join(root, "source");
    const nested = join(source, "win-unpacked", "resources", "app");
    const destination = join(root, "destination");
    const expected = "mysql-workbench-26.7.0-win32-x64.msi";
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(source, expected), "msi");
    writeFileSync(join(source, "unrelated.zip"), "zip");
    writeFileSync(join(nested, "oci.zip"), "oci");

    assert.deepEqual(copyArtifactFiles(source, destination, [expected]), [
        join(destination, expected),
    ]);
    assert.equal(existsSync(join(destination, "unrelated.zip")), false);
    assert.equal(existsSync(join(destination, "oci.zip")), false);
});

test("artifact manifest contains the canonical artifact paths", (context) => {
    const root = mkdtempSync(join(tmpdir(), "package-desktop-manifest-"));
    context.after(() => {
        rmSync(root, { recursive: true, force: true });
    });
    const manifest = join(root, "nested", "artifacts.json");
    const artifacts = [
        join(root, "mysql-workbench.custom"),
        join(root, "mysql-workbench.future"),
    ];

    writeArtifactManifest(manifest, artifacts);

    assert.deepEqual(JSON.parse(readFileSync(manifest, "utf8")), { artifacts });
});

const linuxInstallerTargetCases = [
    [[], ["dir", "deb", "rpm"]],
    [["--skip-deb"], ["dir", "rpm"]],
    [["--skip-rpm"], ["dir", "deb"]],
];

for (const [argumentsToAdd, expectedTargets] of linuxInstallerTargetCases) {
    test(`Linux installer targets for ${argumentsToAdd.join(" ") || "defaults"}`, () => {
        const options = parseArguments([
            "node", "package_desktop.ts", "--targets=linux-x64", "--artifacts",
            ...argumentsToAdd,
        ]);
        const config = JSON.parse(buildElectronBuilderConfig(
            "linux-x64",
            "/tmp/desktop-output",
            options,
            "mysql-workbench",
        ));

        assert.deepEqual(config.linux.target, expectedTargets);
    });
}

for (const skipOption of ["--skip-deb", "--skip-rpm"]) {
    test(`${skipOption} requires artifacts`, () => {
        assert.throws(() => {
            parseArguments([
                "node", "package_desktop.ts", "--targets=linux-x64", "--zip",
                skipOption,
            ]);
        }, /can only be used with --artifacts/);
    });
}

test("Linux artifacts cannot skip both installer formats", () => {
    assert.throws(() => {
        parseArguments([
            "node", "package_desktop.ts", "--targets=linux-arm64", "--artifacts",
            "--skip-deb", "--skip-rpm",
        ]);
    }, /At least one Linux installer format must remain enabled/);
});

test("macOS artifacts ignore Linux installer skip options", () => {
    const options = parseArguments([
        "node", "package_desktop.ts", "--targets=darwin-arm64", "--artifacts",
        "--skip-deb", "--skip-rpm",
    ]);
    const config = JSON.parse(buildElectronBuilderConfig(
        "darwin-arm64",
        "/tmp/desktop-output",
        options,
        "mysql-workbench",
    ));

    assert.deepEqual(config.mac.target, ["dir", "dmg"]);
});

test("macOS artifacts configure the branded DMG layout", () => {
    const options = parseArguments([
        "node", "package_desktop.ts", "--targets=darwin-arm64", "--artifacts",
    ]);
    const config = JSON.parse(buildElectronBuilderConfig(
        "darwin-arm64",
        "/tmp/desktop-output",
        options,
        "mysql-workbench",
    ));
    const background = resolve(__dirname, "../../images/dmg-background.png");
    const retinaBackground = resolve(__dirname, "../../images/dmg-background@2x.png");

    assert.equal(config.dmg.background, background);
    assert.equal(existsSync(background), true);
    assert.equal(existsSync(retinaBackground), true);
    assert.deepEqual(config.dmg.contents, [
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
    ]);
});

test("configured commercial suffix is accepted", () => {
    const options = parseArguments([
        "node", "package_desktop.ts", "--targets=linux-x64", "--zip",
        "--package-name-suffix=-commercial",
    ]);

    assert.equal(options.packageNameSuffix, "-commercial");
    assert.equal(
        getDesktopPackageName(options.packageNameSuffix),
        "mysql-workbench-commercial",
    );
});

test("unknown suffix is rejected", () => {
    assert.throws(() => {
        parseArguments([
            "node", "package_desktop.ts", "--targets=linux-x64", "--zip",
            "--package-name-suffix=-unknown",
        ]);
    }, /Unknown package name suffix '-unknown'/);
});

test("suffix mapping rejects duplicate values", () => {
    assert.throws(() => {
        validateDesktopPackageSuffixes({
            desktopPackageSuffixes: { community: "", commercial: "" },
        });
    }, /unique/);
});

test("community DEB conflicts with and replaces the commercial package", () => {
    const config = JSON.parse(buildElectronBuilderConfig(
        "linux-x64",
        "/tmp/desktop-output",
        { artifacts: true, zip: false, packageNameSuffix: "" },
        "mysql-workbench",
    ));

    assert.deepEqual(config.deb.fpm.filter((option) => option.startsWith("--conflicts=")
        || option.startsWith("--replaces=")), [
        "--conflicts=mysql-workbench-commercial",
        "--replaces=mysql-workbench-commercial",
    ]);
});

test("commercial DEB conflicts with and replaces the community package", () => {
    const config = JSON.parse(buildElectronBuilderConfig(
        "linux-x64",
        "/tmp/desktop-output",
        { artifacts: true, zip: false, packageNameSuffix: "-commercial" },
        "mysql-workbench-commercial",
    ));

    assert.deepEqual(config.deb.fpm.filter((option) => option.startsWith("--conflicts=")
        || option.startsWith("--replaces=")), [
        "--conflicts=mysql-workbench",
        "--replaces=mysql-workbench",
    ]);
});

test("DEB includes the MySQL Shell runtime dependencies", () => {
    const config = JSON.parse(buildElectronBuilderConfig(
        "linux-x64",
        "/tmp/desktop-output",
        { artifacts: true, zip: false, packageNameSuffix: "" },
        "mysql-workbench",
    ));

    assert.deepEqual(config.deb.fpm.filter((option) => option.startsWith("--depends=")), [
        "--depends=libbz2-1.0",
        "--depends=libc6 (>= 2.28)",
        "--depends=libcrypt1 (>= 1:4.1.0)",
        "--depends=libgcc-s1 (>= 4.2)",
        "--depends=libgdbm-compat4 (>= 1.16)",
        "--depends=libgdbm6 (>= 1.16)",
        "--depends=libkeyutils1 (>= 1.5.9)",
        "--depends=libncursesw6 (>= 6)",
        "--depends=libstdc++6 (>= 10.2)",
        "--depends=libtinfo6 (>= 6)",
        "--depends=libudev1 (>= 183)",
        "--depends=libyaml-0-2",
        "--depends=zlib1g (>= 1:1.2.0)",
    ]);
});

const commonRpmShellDependencies = [
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
const rpmShellDependencyCases = [
    ["linux-x64", [
        ...commonRpmShellDependencies,
        "libgcc_s.so.1(GCC_4.2.0)(64bit)",
        "libgdbm.so.6()(64bit)",
        "libgdbm_compat.so.4()(64bit)",
    ]],
    ["linux-arm64", [
        ...commonRpmShellDependencies,
        "libgcc_s.so.1(GCC_4.5.0)(64bit)",
    ]],
];

for (const [target, dependencies] of rpmShellDependencyCases) {
    test(`${target} RPM includes its MySQL Shell runtime dependencies`, () => {
        const config = JSON.parse(buildElectronBuilderConfig(
            target,
            "/tmp/desktop-output",
            { artifacts: true, zip: false, packageNameSuffix: "" },
            "mysql-workbench",
        ));

        assert.deepEqual(
            config.rpm.fpm.filter((option) => option.startsWith("--depends=")),
            dependencies.map((dependency) => `--depends=${dependency}`),
        );
    });
}

test("community RPM has no explicit generic provides or obsoletes", () => {
    const config = JSON.parse(buildElectronBuilderConfig(
        "linux-x64",
        "/tmp/desktop-output",
        { artifacts: true, zip: false, packageNameSuffix: "" },
        "mysql-workbench",
    ));

    assert.deepEqual(config.rpm.fpm.filter((option) =>
        option.startsWith("--provides=") || option.startsWith("--replaces=")), []);
});

test("commercial RPM provides Workbench and obsoletes older community packages", () => {
    const config = JSON.parse(buildElectronBuilderConfig(
        "linux-x64",
        "/tmp/desktop-output",
        { artifacts: true, zip: false, packageNameSuffix: "-commercial" },
        "mysql-workbench-commercial",
    ));

    assert.deepEqual(config.rpm.fpm.filter((option) =>
        option.startsWith("--provides=") || option.startsWith("--replaces=")), [
        "--provides=mysql-workbench = %{version}-%{release}",
        "--provides=mysql-workbench%{?_isa} = %{version}-%{release}",
        "--replaces=mysql-workbench < %{version}-%{release}",
    ]);
});

test("non-Linux targets have no RPM FPM options", () => {
    const config = JSON.parse(buildElectronBuilderConfig(
        "darwin-arm64",
        "/tmp/desktop-output",
        { artifacts: true, zip: false, packageNameSuffix: "-commercial" },
        "mysql-workbench-commercial",
    ));

    assert.equal(config.rpm.fpm, undefined);
});

const targetCases = [
    ["darwin-arm64", "mac", "dmg", "MySQL Workbench"],
    ["darwin-x64", "mac", "dmg", "MySQL Workbench"],
    ["win32-x64", "win", "msi", "MySQL Workbench"],
    ["linux-arm64", "linux", "deb", "mysql-workbench"],
    ["linux-x64", "linux", "deb", "mysql-workbench"],
];

for (const [target, platform, installerTarget, executableName] of targetCases) {
    test(`commercial package metadata is consistent for ${target}`, () => {
        const packageName = getDesktopPackageName("-commercial");
        const manifest = JSON.parse(buildAppManifest(packageName));
        const config = JSON.parse(buildElectronBuilderConfig(
            target,
            "/tmp/desktop-output",
            { artifacts: true, zip: true, packageNameSuffix: "-commercial" },
            packageName,
        ));

        assert.equal(manifest.name, "mysql-workbench-commercial");
        assert.equal(
            config.artifactName,
            `mysql-workbench-commercial-${packageMetadata.version}-${target}.\${ext}`,
        );
        assert.equal(config.deb.packageName, "mysql-workbench-commercial");
        assert.equal(config.rpm.packageName, "mysql-workbench-commercial");
        assert.equal(manifest.productName, "MySQL Workbench");
        assert.equal(config.productName, "MySQL Workbench");
        assert.equal(config.executableName, executableName);
        assert.equal(config.appId, "com.oracle.mysqlworkbench");
        assert.ok(config[platform].target.includes("zip"));
        assert.ok(config[platform].target.includes(installerTarget));
        if (platform === "linux") {
            assert.ok(config.linux.target.includes("rpm"));
        }
    });
}
