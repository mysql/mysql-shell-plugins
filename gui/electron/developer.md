# MySQL Workbench Electron Build Process

This document covers Electron packaging, distributable artifacts, package
contents, and test commands. For general Workbench setup, architecture,
debugging, and development, see the
[MySQL Workbench Developer Guide](../WORKBENCH_DEV.md).

## Directory Layout

- `gui/electron/src`: Electron main process and preload code.
- `gui/electron/images`: MySQL Workbench desktop images and icons.
- `gui/electron/scripts`: development, test, and packaging scripts.
- `gui/electron/packaging/electron/<platform>`: unpacked Electron runtime cache.
- `gui/electron/packaging/mysql-shell-staging/<platform>`: staged and stripped
  MySQL Shell tree.
- `gui/electron/packaging/mysql-shell-dev-staging/<platform>`: development
  runtime with plugin symlinks.
- `gui/electron/packaging/desktop-packages/<platform>`: final packaged MySQL
  Workbench unpacked app output.
- `gui/electron/packaging/desktop-artifacts/<platform>`: optional ZIP, DMG,
  MSI, DEB, and RPM artifact outputs.
- `gui/electron/packaging/temp/<platform>`: temporary packaging output.

Supported package targets are:

- `darwin-arm64`
- `darwin-x64`
- `win32-x64`
- `linux-arm64`
- `linux-x64`

## Prerequisites

Complete [Getting Started](../WORKBENCH_DEV.md#1-getting-started) before using
the development or packaging commands in this document.

The Electron dependency in `gui/electron/package.json` must be an exact version,
not a semver range. The packaging script uses that version unless
`ELECTRON_VERSION` is set in the environment.

## Development Launch

Use the Vite workflow described in
[Getting Started](../WORKBENCH_DEV.md#start-workbench-with-vite). The main guide
also explains runtime preparation, reload behavior, logging, and passing extra
arguments to MySQL Shell.

## Full Desktop Packaging

Run a package target from `gui/electron`:

```sh
npm run package:darwin-arm64
```

or call the packaging script directly:

```sh
bash ./scripts/package_desktop.sh darwin-arm64
```

Without a target, `package_desktop.sh` builds every supported platform.

The full packaging flow is:

1. Resolve `ELECTRON_VERSION` from the environment or from
   `gui/electron/package.json`.
2. Resolve a MySQL Shell tree for each target.
3. Stage the MySQL Shell tree under
   `gui/electron/packaging/mysql-shell-staging/<platform>`.
4. Prepare the staged OCI SDK for full packaging. Stage-only and development
   trees are left otherwise unchanged.
5. Use the unpacked Electron runtime under
   `gui/electron/packaging/electron/<platform>` when present, download it when
   `--download-electron` is used, or let electron-builder download it.
6. Run `gui/electron/scripts/package_desktop.ts`.
7. Ensure the frontend build is current with
   `npm --prefix gui/frontend run build-if-needed`.
8. Stage the Electron source, frontend build, images, and bundled MySQL Shell
   tree into the MySQL Workbench payload. Plugin entries in the payload are
   replaced with copied plugin sources from this checkout, so a dev staging tree
   may use plugin symlinks while packaged apps contain real plugin directories.
   After replacement, clean development artifacts from the complete assembled
   Shell bundle, including built-in plugins and embedded Python test content.
9. Invoke electron-builder with the `dir` target to create an unpacked desktop
   package and normalize the result back to the existing output directory. When
   `--artifacts` is used, electron-builder also creates the platform
   distributable artifacts.

Final output is written to:

```text
gui/electron/packaging/desktop-packages/<platform>
```

For macOS the final bundle is:

```text
gui/electron/packaging/desktop-packages/<platform>/MySQL Workbench.app
```

## Distributable Artifacts

Archive and installer packaging is opt-in. It keeps the unpacked package output
above and also writes platform artifact files under:

```text
gui/electron/packaging/desktop-artifacts/<platform>
```

Run ZIP packaging from `gui/electron`:

```sh
npm run package:zip:darwin-arm64
```

or call the packaging script directly:

```sh
bash ./scripts/package_desktop.sh darwin-arm64 --zip
```

Run installer/package artifact packaging from `gui/electron`:

```sh
npm run package:artifacts:darwin-arm64
```

or call the packaging script directly:

```sh
bash ./scripts/package_desktop.sh darwin-arm64 --artifacts
```

ZIP mode produces `.zip` archives for all platforms.

Artifact mode produces:

- macOS: `.dmg`
- Windows: `.msi`
- Linux: `.deb` and `.rpm`

Use `--zip --artifacts` together to produce both ZIP archives and platform
installer/package artifacts in one run.

Artifact packages are unsigned local build outputs. Code signing,
notarization, and release publishing are not enabled by this script.

## MySQL Shell Inputs

By default, `package_desktop.sh` looks for MySQL Shell packages under:

```text
gui/electron/packaging/mysql-shell
```

See [Prepare the MySQL Shell runtime](../WORKBENCH_DEV.md#prepare-the-mysql-shell-runtime)
for the accepted short archive names and input-tree requirements. Official
MySQL Shell archive names are also accepted when they match the target
platform.

### Using an unpacked tree

To package with an unpacked MySQL Shell tree, select the package target:

```sh
bash ./scripts/package_desktop.sh darwin-arm64 --mysqlsh-tree=/path/to/mysqlsh
```

For multiple package targets, pass a directory containing per-platform trees:

```text
/path/to/mysqlsh-trees/darwin-arm64
/path/to/mysqlsh-trees/linux-x64
```

Each per-platform tree must contain `bin`, `lib`, and `share`. `libexec` is
copied when it is present.

## Electron Runtime Inputs

The script can use an unpacked Electron runtime at:

```text
gui/electron/packaging/electron/<platform>
```

To download the runtime for the resolved Electron version:

```sh
bash ./scripts/package_desktop.sh darwin-arm64 --download-electron
```

Downloaded Electron zip files are cached under `gui/electron/packaging/electron`
and extracted into the corresponding platform directory.

If that cache is absent, electron-builder downloads the Electron runtime for
the version declared in `gui/electron/package.json`.

## Quick Packaging

Quick mode updates only the MySQL Workbench payload inside an existing package.
It does not rebuild the Electron runtime bundle or replace the bundled MySQL
Shell tree.

```sh
cd gui/electron
bash ./scripts/package_desktop.sh darwin-arm64 --quick
```

Quick mode requires:

- exactly one target platform
- an existing full package in
  `gui/electron/packaging/desktop-packages/<platform>`

It still refreshes the frontend build if needed, then replaces:

- `resources/app/package.json`
- `resources/app/src`
- `resources/app/frontend`
- `resources/app/images`

The existing `resources/app/shell` bundle is preserved.

## Tests

There are three test groups that are commonly relevant to MySQL Workbench
Electron changes:

- Electron-specific Playwright end-to-end tests in `gui/electron`.
- Python backend unit tests in `gui/backend`.
- Shared frontend Vitest unit tests in `gui/frontend`.

### Electron End-to-End Tests

Electron end-to-end tests are under `gui/electron/tests/e2e`.

Run setup, tests, and teardown together:

```sh
cd gui/electron
npm run e2e-tests-setup-and-run
```

Pass Playwright filters after `--`:

```sh
npm run e2e-tests-setup-and-run -- desktop-commands.spec.ts -g "reuses the same two"
```

To run setup, test execution, and teardown separately:

```sh
cd gui/electron
npm run e2e-tests-setup
npm run e2e-tests-run -- desktop-commands.spec.ts
npm run e2e-tests-teardown
```

To debug or inspect tests interactively:

```sh
cd gui/electron
npm run e2e-tests-ui
```

To run the same tests against a packaged desktop app instead of the source
Electron entrypoint:

```sh
cd gui/electron
ELECTRON_E2E_PACKAGED_APP="packaging/desktop-packages/darwin-arm64/MySQL Workbench.app" \
  npm run e2e-tests-setup-and-run
```

When `ELECTRON_E2E_PACKAGED_APP` is set, the tests launch the packaged app
executable, do not start the Vite renderer server, and let the app load its
bundled frontend and MySQL Shell payload. On macOS the variable may point to
the `.app` bundle; on Windows and Linux it should point to the executable.

To keep Electron from stealing focus while tests run:

```sh
cd gui/electron
ELECTRON_E2E_BACKGROUND=1 npm run e2e-tests-setup-and-run
```

This creates the Electron test window hidden. For packaged-app tests, rebuild
the package after this change so the packaged `main.cjs` understands the
background flag. If a full package already exists, quick packaging is enough:

```sh
bash ./scripts/package_desktop.sh darwin-arm64 --quick
```

The setup script deploys a local MySQL sandbox and writes runtime configuration
under `gui/electron/tests/e2e/execution`. Teardown kills and deletes the sandbox.

Useful test environment variables:

- `ELECTRON_E2E_BACKGROUND`: set to `1` or `true` to keep the Electron test
  window hidden.
- `ELECTRON_E2E_PACKAGED_APP`: packaged app bundle or executable used by tests.
- `ELECTRON_E2E_MYSQLSH`, then `MYSQLSH`: mysqlsh executable precedence for
  sandbox setup utilities.
- `ELECTRON_E2E_MYSQLD_PATH`, then `MYSQLD_PATH`: mysqld executable or MySQL
  installation root used for sandbox deployment.
- `ELECTRON_E2E_MYSQL_PORT`, then `MYSQL_PORT`: sandbox MySQL port precedence.
- `ELECTRON_E2E_VITE_HOST`: renderer dev server host, default `127.0.0.1`.
- `ELECTRON_E2E_VITE_PORT`: renderer dev server port, default `5174`.
- `ELECTRON_E2E_RENDERER_URL`: explicit renderer URL.
- `ELECTRON_E2E_ELECTRON_EXECUTABLE`, then `ELECTRON_EXECUTABLE_PATH`: explicit
  Electron executable used by tests.
- `ELECTRON_E2E_SLOWMO` or `ELECTRON_E2E_SLOW_MO`: Playwright slow motion in
  milliseconds.

### Backend Unit Tests

Backend tests are driven by `gui/backend/run_tests.py` and must be launched with
MySQL Shell:

```sh
cd gui/backend
mysqlsh --py -f run_tests.py
```

Run a focused backend test selection with pytest's `-k` expression:

```sh
cd gui/backend
mysqlsh --py -f run_tests.py -k test_logger
```

Useful backend test options:

- `-k, --only`: run tests matching a pytest expression.
- `-l, --logs`: print backend and MySQL Shell logs after failures.
- `-c, --color`: enable colored pytest output.
- `-d TESTS` or `-d BACKEND`: wait for a debugger to attach to the tests or
  backend process.
- `-s, --shell <path>`: choose the MySQL Shell binary used by the test runner's
  child process.
- `-u, --userhome <path>`: choose the MySQL Shell user config home.

The runner sets `MYSQLSH_USER_CONFIG_HOME` to its runtime directory and runs
pytest through `mysqlsh --disable-builtin-plugins --pym pytest`.

### Frontend Unit Tests

MySQL Workbench uses the shared GUI frontend, so frontend unit tests are run from
`gui/frontend`.

Run the full Vitest unit test suite:

```sh
cd gui/frontend
npm run unit-tests
```

Run a focused frontend unit test file:

```sh
cd gui/frontend
npx vitest run --no-watch --no-coverage src/tests/unit-tests/modules/documents/DocumentSideBar.spec.tsx
```

Update frontend snapshots when the intended output changed:

```sh
cd gui/frontend
npm run update-snapshots
```

The frontend package also contains non-Electron browser E2E tests. Those are run
with `npm run e2e-tests-setup-and-run` from `gui/frontend`; they are separate
from the Electron Playwright tests in `gui/electron`.

## Package Contents

The MySQL Workbench payload is installed under Electron's resources directory:

- macOS: `MySQL Workbench.app/Contents/Resources/app`
- Windows/Linux: `resources/app`

The payload contains:

- `package.json`: generated package manifest with product name, version, and main
  script.
- `src`: Electron main process and preload files.
- `frontend/build`: production frontend build.
- `images`: MySQL Workbench desktop images.
- `shell`: stripped MySQL Shell tree with bundled plugins.

The package version comes from `gui/electron/package.json`.

## Troubleshooting

Electron download issues:

Use `--download-electron` to prefill `gui/electron/packaging/electron/<platform>`
or unpack the Electron runtime there. Otherwise electron-builder downloads and
caches Electron during packaging.

Missing MySQL Shell archive:

```text
ERROR: Missing MySQL Shell archive for <platform>
```

Place a matching archive under `gui/electron/packaging/mysql-shell`, or use
`--mysqlsh-tree`.

Quick mode fails with missing package:

```text
Missing existing desktop package for <platform>
```

Run a full package for that platform first.

Code signing, notarization, and release publishing are not enabled by the
current packaging scripts. The default output is an unpacked MySQL Workbench
bundle/runtime directory produced by electron-builder. Use `--artifacts` to
also produce DMG, MSI, DEB, or RPM files, or `--zip` to produce ZIP archives.

Copyright &copy; 2026, Oracle and/or its affiliates.
