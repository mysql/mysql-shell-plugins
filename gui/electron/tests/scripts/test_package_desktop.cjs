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
const { spawnSync } = require("node:child_process");
const {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const test = require("node:test");
const { dirname, join, resolve } = require("node:path");
const packageMetadata = require("../../package.json");
const {
    copyFiles,
    getFileMatchers,
} = require("../../node_modules/app-builder-lib/out/fileMatcher.js");

const {
    buildAppManifest,
    buildElectronBuilderConfig,
    cleanShellBundle,
    compilePythonFiles,
    copyArtifactFiles,
    finalizeShellBundle,
    findMysqlshExecutable,
    getPythonCompilationRoot,
    getDesktopPackageName,
    getArtifactFileNames,
    installProductBundleHelper,
    parseArguments,
    resolveElectronBuilderCacheFolder,
    resolveElectronBuilderInvocation,
    validateDesktopMsiUpgradeCode,
    validateDesktopPackageSuffixes,
    writeArtifactManifest,
} = require("../../scripts/package_desktop.ts");

const writeFixtureFile = (path) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "fixture", { encoding: "utf8" });
};

test("Windows product helpers are installed in the app payload", (context) => {
    const root = mkdtempSync(join(tmpdir(), "product-bundle-helper-"));
    context.after(() => {
        rmSync(root, { recursive: true, force: true });
    });
    const appFolder = join(root, "app");

    installProductBundleHelper("win32-x64", appFolder);

    const helpersFolder = join(appFolder, "helpers");
    assert.equal(
        readFileSync(join(helpersFolder, "task-helper.py"), "utf8"),
        readFileSync(resolve(__dirname, "../../../task-helper/task-helper"), "utf8"),
    );
    assert.equal(
        readFileSync(join(helpersFolder, "task-helper-setup.py"), "utf8"),
        readFileSync(resolve(__dirname, "../../../task-helper/task-helper-setup"), "utf8"),
    );
    assert.equal(
        readFileSync(join(helpersFolder, "task_helper_setup.py"), "utf8"),
        readFileSync(resolve(__dirname, "../../../task-helper/task_helper_setup.py"), "utf8"),
    );
    assert.equal(
        readFileSync(join(helpersFolder, "task-helper.cmd"), "utf8"),
        "@echo off\r\n"
        + "setlocal\r\n"
        + "\"%~dp0..\\shell\\bin\\mysqlsh.exe\" --py -f \"%~dp0task-helper.py\" %*\r\n"
        + "exit /b %ERRORLEVEL%\r\n",
    );
    assert.equal(
        readFileSync(join(helpersFolder, "task-helper-setup.cmd"), "utf8"),
        "@echo off\r\n"
        + "setlocal\r\n"
        + "\"%~dp0..\\shell\\bin\\mysqlsh.exe\" --py -f \"%~dp0task-helper-setup.py\" %*\r\n"
        + "exit /b %ERRORLEVEL%\r\n",
    );
});

test("bundled MySQL Shell discovery accepts one in-tree executable", (context) => {
    const root = mkdtempSync(join(tmpdir(), "mysqlsh-discovery-"));
    context.after(() => {
        rmSync(root, { recursive: true, force: true });
    });

    for (const executableName of ["mysqlsh", "mysqlsh.exe"]) {
        const shell = join(root, executableName);
        const executable = join(shell, "bin", executableName);
        writeFixtureFile(executable);

        assert.equal(findMysqlshExecutable(shell), executable);
    }
});

test("bundled MySQL Shell discovery rejects missing and ambiguous candidates", (context) => {
    const root = mkdtempSync(join(tmpdir(), "mysqlsh-discovery-errors-"));
    context.after(() => {
        rmSync(root, { recursive: true, force: true });
    });
    const shell = join(root, "shell");
    mkdirSync(join(shell, "bin"), { recursive: true });

    assert.throws(() => {
        findMysqlshExecutable(shell);
    }, /Expected one bundled MySQL Shell executable/);

    writeFixtureFile(join(shell, "bin", "mysqlsh"));
    writeFixtureFile(join(shell, "bin", "mysqlsh.exe"));
    assert.throws(() => {
        findMysqlshExecutable(shell);
    }, /Expected one bundled MySQL Shell executable/);
});

test("bundled MySQL Shell discovery accepts file symlinks and rejects directories", (context) => {
    const root = mkdtempSync(join(tmpdir(), "mysqlsh-discovery-paths-"));
    context.after(() => {
        rmSync(root, { recursive: true, force: true });
    });

    const outsideTarget = join(root, "outside", "mysqlsh-real");
    const outsideShell = join(root, "outside-shell");
    const outsideExecutable = join(outsideShell, "bin", "mysqlsh");
    writeFixtureFile(outsideTarget);
    mkdirSync(dirname(outsideExecutable), { recursive: true });
    symlinkSync(outsideTarget, outsideExecutable, "file");
    assert.equal(findMysqlshExecutable(outsideShell), outsideExecutable);

    const directoryShell = join(root, "directory-shell");
    mkdirSync(join(directoryShell, "bin", "mysqlsh"), { recursive: true });
    assert.throws(() => {
        findMysqlshExecutable(directoryShell);
    }, /regular file/);
});

test("Python compilation uses bundled mysqlsh and reports progress", (context) => {
    const root = mkdtempSync(join(tmpdir(), "mysqlsh-compile-"));
    context.after(() => {
        rmSync(root, { recursive: true, force: true });
    });
    const shell = join(root, "shell");
    const executableName = process.platform === "win32" ? "mysqlsh.exe" : "mysqlsh";
    const executable = join(shell, "bin", executableName);
    writeFixtureFile(executable);
    const compilationRoot = getPythonCompilationRoot(shell);
    const messages = [];
    let configHome;

    compilePythonFiles(shell, (command, args, options) => {
        assert.equal(command, executable);
        assert.deepEqual(args, [
            "--disable-builtin-plugins",
            "--pym",
            "compileall",
            "-q",
            "-f",
            "--invalidation-mode",
            "checked-hash",
            "-s",
            compilationRoot,
            compilationRoot,
        ]);
        assert.equal(options.stdio, "inherit");
        assert.equal(options.windowsHide, process.platform === "win32");
        assert.equal(options.env.PYTHONDONTWRITEBYTECODE, "1");
        configHome = options.env.MYSQLSH_USER_CONFIG_HOME;
        assert.equal(existsSync(configHome), true);

        return { status: 0, signal: null };
    }, (message) => messages.push(message));

    assert.equal(existsSync(configHome), false);
    assert.deepEqual(messages, [
        "\nCompiling packaged Python files:",
        `  With: ${executable}`,
        `  Root: ${resolve(shell)}`,
        "Python bytecode compilation complete.",
    ]);
});

test("Python compilation cleans its config home after a nonzero exit", (context) => {
    const root = mkdtempSync(join(tmpdir(), "mysqlsh-compile-exit-"));
    context.after(() => {
        rmSync(root, { recursive: true, force: true });
    });
    const shell = join(root, "shell");
    writeFixtureFile(join(
        shell,
        "bin",
        process.platform === "win32" ? "mysqlsh.exe" : "mysqlsh",
    ));
    const messages = [];
    let configHome;

    assert.throws(() => {
        compilePythonFiles(shell, (_command, _args, options) => {
            configHome = options.env.MYSQLSH_USER_CONFIG_HOME;

            return { status: 7, signal: null };
        }, (message) => messages.push(message));
    }, /exit status 7/);

    assert.equal(existsSync(configHome), false);
    assert.equal(messages.includes("Python bytecode compilation complete."), false);
});

test("Python compilation reports a failure to start bundled mysqlsh", (context) => {
    const root = mkdtempSync(join(tmpdir(), "mysqlsh-compile-spawn-"));
    context.after(() => {
        rmSync(root, { recursive: true, force: true });
    });
    const shell = join(root, "shell");
    writeFixtureFile(join(
        shell,
        "bin",
        process.platform === "win32" ? "mysqlsh.exe" : "mysqlsh",
    ));

    assert.throws(() => {
        compilePythonFiles(shell, () => {
            return { error: new Error("spawn failed"), status: null, signal: null };
        }, () => undefined);
    }, /spawn failed/);
});

test("Python compilation retains sources and writes checked-hash bytecode", {
    skip: process.platform === "win32",
}, (context) => {
    const root = mkdtempSync(join(tmpdir(), "mysqlsh-compile-integration-"));
    context.after(() => {
        rmSync(root, { recursive: true, force: true });
    });
    const shell = join(root, "shell");
    const executable = join(shell, "bin", "mysqlsh");
    const source = join(shell, "lib", "module.py");
    mkdirSync(dirname(executable), { recursive: true });
    mkdirSync(dirname(source), { recursive: true });
    writeFileSync(executable, "#!/bin/sh\nshift 3\nexec python3 -m compileall \"$@\"\n");
    chmodSync(executable, 0o755);
    writeFileSync(source, "value = 1\n", { encoding: "utf8" });

    compilePythonFiles(shell, undefined, () => undefined);

    assert.equal(existsSync(source), true);
    const cacheFolder = join(shell, "lib", "__pycache__");
    const bytecodeName = readdirSync(cacheFolder)
        .find((name) => /^module\.cpython-\d+\.pyc$/.test(name));
    assert.ok(bytecodeName);
    const bytecodePath = join(cacheFolder, bytecodeName);
    const bytecode = readFileSync(bytecodePath);
    assert.equal(bytecode.readUInt32LE(4), 3);

    const inspection = spawnSync("python3", [
        "-c",
        "import marshal, sys; f = open(sys.argv[1], 'rb'); f.read(16); "
            + "print(marshal.load(f).co_filename)",
        bytecodePath,
    ], { encoding: "utf8" });
    assert.equal(inspection.status, 0, inspection.stderr);
    assert.equal(inspection.stdout.trim(), "lib/module.py");
});

test("final Shell cleanup removes Unix runtime and plugin development artifacts", () => {
    const root = mkdtempSync(join(tmpdir(), "shell-cleanup-unix-"));
    try {
        const shell = join(root, "shell");
        const python = join(shell, "lib", "mysqlsh", "lib", "python3.13");
        const plugins = join(shell, "lib", "mysqlsh", "plugins");
        const remove = [
            join(python, "test", "test_os.py"),
            join(python, "__phello__", "spam.py"),
            join(python, "idlelib", "idle_test", "test_idle.py"),
            join(python, "site-packages", "tests", "test_dependency.py"),
            join(python, "site-packages", "docs", "index.md"),
            join(shell, "lib", "mysqlsh", "python-packages", "mysql_gadgets",
                "tests", "test_gadget.py"),
            join(plugins, "debug", "tests", "test_debug.py"),
            join(plugins, "gui_plugin", "docs", "development.md"),
            join(plugins, "gui_plugin", "pytest.ini"),
            join(plugins, "gui_plugin", "cached.pyc"),
            join(plugins, "gui_plugin", "internal", "certificates", "server.key"),
            join(plugins, "gui_plugin", "migration", "internal", "update_api_metadata.py"),
            join(plugins, "mds_plugin", "internal", "testutils", "testutils.py"),
            join(plugins, "mrs_plugin", "internal", "login_complete.html"),
            join(plugins, "mrs_plugin", "grammar", "test", "query.sql"),
            join(plugins, "mrs_plugin", "scripts", "run_grammar_test.sh"),
            join(plugins, "mrs_plugin", "db_schema", "mrs.msm.project",
                "development", "schema.json"),
            join(plugins, "mrs_plugin", "db_schema", "tasks.msm.project",
                "development", "schema.json"),
            join(plugins, "gui_plugin", "debugger", "init.py"),
            join(plugins, "gui_plugin", "wrappers", "init.py"),
        ];
        const retain = [
            join(python, "unittest", "__init__.py"),
            join(python, "unittest", "mock.py"),
            join(python, "doctest.py"),
            join(python, "site-packages", "cryptography-45.0.0.dist-info",
                "licenses", "LICENSE"),
            join(plugins, "debug", "test", "keep.py"),
            join(plugins, "mds_plugin", "scripts", "init_router_script.sh"),
            join(plugins, "mrs_plugin", "grammar", "MySQLParser.g4"),
            join(plugins, "mrs_plugin", "lib", "mrs_parser", "parser.py"),
        ];
        for (const path of [...remove, ...retain]) {
            writeFixtureFile(path);
        }

        const outside = join(root, "outside");
        const outsideTests = join(outside, "tests", "keep.py");
        writeFixtureFile(outsideTests);
        symlinkSync(outside, join(plugins, "debug", "outside-link"), "dir");
        const internalLink = join(plugins, "debug", "internal");
        symlinkSync(outside, internalLink, "dir");

        cleanShellBundle(shell);

        for (const path of remove) {
            assert.equal(existsSync(path), false, `expected removal: ${path}`);
        }
        for (const path of retain) {
            assert.equal(existsSync(path), true, `expected retained file: ${path}`);
        }
        assert.equal(existsSync(outsideTests), true);
        assert.equal(existsSync(internalLink), false);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("final Shell cleanup supports the Windows Python layout", () => {
    const root = mkdtempSync(join(tmpdir(), "shell-cleanup-windows-"));
    try {
        const shell = join(root, "shell");
        const python = join(shell, "lib", "Python3.13", "Lib");
        const plugins = join(shell, "lib", "mysqlsh", "plugins");
        const remove = [
            join(python, "test", "test_os.py"),
            join(python, "__phello__", "spam.py"),
            join(python, "idlelib", "idle_test", "test_idle.py"),
            join(python, "site-packages", "tests", "test_dependency.py"),
            join(plugins, "gui_plugin", "internal", "certificates", "server.key"),
            join(plugins, "gui_plugin", "migration", "internal", "update_api_metadata.py"),
        ];
        const retain = [
            join(python, "unittest", "__init__.py"),
            join(python, "unittest", "mock.py"),
            join(plugins, "mds_plugin", "scripts", "init_router_script.sh"),
        ];
        for (const path of [...remove, ...retain]) {
            writeFixtureFile(path);
        }
        writeFixtureFile(join(plugins, "debug", "init.py"));

        cleanShellBundle(shell);

        for (const path of remove) {
            assert.equal(existsSync(path), false, `expected removal: ${path}`);
        }
        for (const path of retain) {
            assert.equal(existsSync(path), true, `expected retained file: ${path}`);
        }
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("Shell finalization cleans before optional Python compilation", (context) => {
    const root = mkdtempSync(join(tmpdir(), "shell-finalization-"));
    context.after(() => {
        rmSync(root, { recursive: true, force: true });
    });
    const shell = join(root, "shell");
    const plugins = join(shell, "lib", "mysqlsh", "plugins");
    const source = join(plugins, "gui_plugin", "module.py");
    const staleBytecode = join(plugins, "gui_plugin", "module.pyc");
    writeFixtureFile(source);
    writeFixtureFile(staleBytecode);
    let compiledRoot;

    finalizeShellBundle(shell, true, (compilationRoot) => {
        assert.equal(existsSync(source), true);
        assert.equal(existsSync(staleBytecode), false);
        compiledRoot = compilationRoot;
    });

    assert.equal(compiledRoot, shell);

    let disabledCompilerCalls = 0;
    finalizeShellBundle(shell, false, () => {
        disabledCompilerCalls += 1;
    });
    assert.equal(disabledCompilerCalls, 0);
});

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

test("Electron Builder packages the Workbench license as a macOS resource", () => {
    const config = JSON.parse(buildElectronBuilderConfig(
        "darwin-arm64",
        "/tmp/desktop-output",
        { artifacts: true, zip: true, packageNameSuffix: "" },
        "mysql-workbench",
    ));
    const license = resolve(__dirname, "../../LICENSE.txt");

    assert.equal(existsSync(license), true);
    assert.deepEqual(config.extraResources, [
        {
            from: license,
            to: "LICENSE.txt",
        },
    ]);
    assert.equal("extraFiles" in config, false);
});

test("Electron Builder retains the Workbench license location on Linux and Windows", () => {
    const license = resolve(__dirname, "../../LICENSE.txt");

    for (const target of ["linux-x64", "win32-x64"]) {
        const config = JSON.parse(buildElectronBuilderConfig(
            target,
            "/tmp/desktop-output",
            { artifacts: true, zip: true, packageNameSuffix: "" },
            "mysql-workbench",
        ));

        assert.deepEqual(config.extraFiles, [
            {
                from: license,
                to: "LICENSE.txt",
            },
        ]);
        assert.equal("extraResources" in config, false);
    }
});

test("Electron Builder copies compiled Python as an app resource", async (context) => {
    const root = mkdtempSync(join(tmpdir(), "package-desktop-python-files-"));
    context.after(() => {
        rmSync(root, { recursive: true, force: true });
    });
    const appFolder = join(root, "app");
    const bytecode = join(
        appFolder,
        "shell",
        "__pycache__",
        "module.cpython-313.pyc",
    );
    writeFixtureFile(bytecode);

    const outputFolder = join(root, "builder-output");
    const resourcesFolder = join(root, "resources");
    const config = JSON.parse(buildElectronBuilderConfig(
        "linux-x64",
        outputFolder,
        { artifacts: true, compilePython: true, packageNameSuffix: "", zip: true },
        "mysql-workbench",
    ));
    const matchers = getFileMatchers(
        config,
        "extraResources",
        resourcesFolder,
        {
            customBuildOptions: config.linux,
            defaultSrc: appFolder,
            globalOutDir: outputFolder,
            macroExpander: (value) => value,
        },
    );
    await copyFiles(matchers, null, false);

    assert.equal(existsSync(join(
        resourcesFolder,
        "app",
        "shell",
        "__pycache__",
        "module.cpython-313.pyc",
    )), true);
});

test("package metadata defines the shared suffixes", () => {
    assert.deepEqual(packageMetadata.desktopPackageSuffixes, {
        community: "",
        commercial: "-commercial",
    });
});

test("package metadata defines the shared MSI upgrade code", () => {
    assert.equal(
        validateDesktopMsiUpgradeCode(packageMetadata),
        "b1b42b98-a76f-4301-8689-99759b1696b2",
    );
});

for (const upgradeCode of [undefined, "", "not-a-uuid"]) {
    test(`MSI upgrade code rejects ${upgradeCode ?? "missing metadata"}`, () => {
        assert.throws(() => {
            validateDesktopMsiUpgradeCode({ desktopMsiUpgradeCode: upgradeCode });
        }, /desktopMsiUpgradeCode must be a canonical UUID/);
    });
}

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

test("Python compilation is opt in and incompatible with quick mode", () => {
    const defaults = parseArguments([
        "node", "package_desktop.ts", "--targets=linux-x64", "--zip",
    ]);
    const enabled = parseArguments([
        "node", "package_desktop.ts", "--targets=linux-x64", "--zip",
        "--compile-python",
    ]);

    assert.equal(defaults.compilePython, false);
    assert.equal(enabled.compilePython, true);
    assert.throws(() => {
        parseArguments([
            "node", "package_desktop.ts", "--targets=linux-x64", "--quick",
            "--compile-python",
        ]);
    }, /--quick cannot be combined with --compile-python/);
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

for (const packageNameSuffix of ["", "-commercial"]) {
    test(`Windows ${packageNameSuffix || "community"} config allows choosing the MSI install scope`, () => {
        const packageName = getDesktopPackageName(packageNameSuffix);
        const config = JSON.parse(buildElectronBuilderConfig(
            "win32-x64",
            "/tmp/desktop-output",
            { artifacts: true, zip: false, packageNameSuffix, sign: false },
            packageName,
        ));

        assert.equal(config.msi.oneClick, false);
        assert.equal(config.msi.perMachine, false);
        assert.equal(config.msi.menuCategory, "MySQL");
        assert.equal(config.msi.upgradeCode, packageMetadata.desktopMsiUpgradeCode);
    });
}

test("non-Windows config has no MSI settings", () => {
    const config = JSON.parse(buildElectronBuilderConfig(
        "linux-x64",
        "/tmp/desktop-output",
        { artifacts: true, zip: false, packageNameSuffix: "" },
        "mysql-workbench",
    ));

    assert.equal(config.msi, undefined);
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
        [`mysql-workbench-${packageMetadata.version}-win32-x64.msi`],
    );
    assert.deepEqual(
        getArtifactFileNames("win32-x64", combinedOptions, "mysql-workbench"),
        [
            `mysql-workbench-${packageMetadata.version}-win32-x64.zip`,
            `mysql-workbench-${packageMetadata.version}-win32-x64.msi`,
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
    const expected = `mysql-workbench-${packageMetadata.version}-win32-x64.msi`;
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

test("community app manifest keeps the base version and an empty desktop suffix", () => {
    const manifest = JSON.parse(buildAppManifest("mysql-workbench", ""));

    assert.equal(manifest.version, packageMetadata.version);
    assert.equal(manifest.desktopPackageSuffix, "");
});

test("app manifest identifies Oracle Corporation as the package author", () => {
    const manifest = JSON.parse(buildAppManifest("mysql-workbench", ""));

    assert.deepEqual(manifest.author, { name: "Oracle Corporation" });
});

test("commercial app manifest keeps the base version and commercial desktop suffix", () => {
    const manifest = JSON.parse(buildAppManifest("mysql-workbench-commercial", "-commercial"));

    assert.equal(manifest.version, packageMetadata.version);
    assert.equal(manifest.desktopPackageSuffix, "-commercial");
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
        const manifest = JSON.parse(buildAppManifest(packageName, "-commercial"));
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
