# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation. The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import contextlib
import importlib.util
import io
import json
import os
import platform
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from types import ModuleType
from typing import Optional
from unittest import mock


SCRIPT_PATH = Path(__file__).resolve().parents[2] / "scripts" / "auto_package.py"
HELPER_PATH = SCRIPT_PATH.parent / "prepare_mysqlsh_tree.py"
OCI_HELPER_PATH = SCRIPT_PATH.parent / "prepare_oci_sdk.py"


class FlushingStringIO(io.StringIO):

    def __init__(self) -> None:
        super().__init__()
        self.flush_count = 0

    def flush(self) -> None:
        self.flush_count += 1


class AutoPackageTest(unittest.TestCase):

    def load_auto_package(self, script_path: Path = SCRIPT_PATH) -> ModuleType:
        if not script_path.is_file():
            self.fail(f"Missing auto packaging script: {script_path}")

        spec = importlib.util.spec_from_file_location("auto_package", script_path)
        if spec is None or spec.loader is None:
            self.fail(f"Could not load auto packaging script: {script_path}")

        module = importlib.util.module_from_spec(spec)
        sys.path.insert(0, str(script_path.parent))
        try:
            spec.loader.exec_module(module)
        finally:
            sys.path.pop(0)

        return module

    def create_mysqlsh_tree(self, root: Path) -> Path:
        (root / "bin").mkdir(parents=True)
        mysqlsh = root / "bin" / "mysqlsh"
        mysqlsh.write_text(
            "#!/usr/bin/env python3\n"
            "import compileall\n"
            "import sys\n"
            "raise SystemExit(\n"
            "    0 if compileall.compile_dir(\n"
            "        sys.argv[-1], force=True, legacy=True, quiet=1\n"
            "    ) else 1\n"
            ")\n",
            encoding="utf-8",
        )
        mysqlsh.chmod(0o755)
        oci = (
            root / "lib" / "mysqlsh" / "lib" / "python3.13"
            / "site-packages" / "oci"
        )
        oci.mkdir(parents=True)
        (oci / "__init__.py").write_text("oci = True\n", encoding="utf-8")
        (oci.parent / "oci-2.177.0.dist-info").mkdir()
        plugin = root / "lib" / "mysqlsh" / "plugins" / "gui_plugin"
        plugin.mkdir(parents=True)
        (plugin / "init.py").write_text("plugin = True\n", encoding="utf-8")
        tests = plugin / "tests"
        tests.mkdir()
        (tests / "test_plugin.py").write_text("remove\n", encoding="utf-8")
        (root / "share").mkdir()

        return root

    def prepare_test_tree(self, root: Path) -> tuple[Path, Path, Path, Path, Path]:
        electron_dir = root / "electron"
        scripts_dir = electron_dir / "scripts"
        scripts_dir.mkdir(parents=True)
        (electron_dir / "package.json").write_text(
            json.dumps({
                "name": "mysql-workbench",
                "version": "26.7.0",
                "dependencies": {"electron": "43.2.0"},
                "desktopPackageSuffixes": {
                    "community": "",
                    "commercial": "-commercial",
                },
                "desktopElectronBuilderCache": "packaging/electron-builder-cache",
            }),
            encoding="utf-8",
        )

        script_path = scripts_dir / "auto_package.py"
        if SCRIPT_PATH.is_file():
            shutil.copy2(SCRIPT_PATH, script_path)
        if HELPER_PATH.is_file():
            shutil.copy2(HELPER_PATH, scripts_dir / HELPER_PATH.name)
        if OCI_HELPER_PATH.is_file():
            shutil.copy2(OCI_HELPER_PATH, scripts_dir / OCI_HELPER_PATH.name)

        (scripts_dir / "package_desktop.ts").touch()

        fake_bin = root / "bin"
        fake_bin.mkdir()
        fake_node = fake_bin / "node"
        fake_node.write_text(
            "#!/usr/bin/env python3\n"
            "import json\n"
            "import os\n"
            "import shutil\n"
            "import sys\n"
            "from pathlib import Path\n"
            "arguments = sys.argv[1:]\n"
            "electron_dir = Path.cwd()\n"
            "package = json.loads((electron_dir / 'package.json').read_text(encoding='utf-8'))\n"
            "suffix_argument = next((argument for argument in arguments "
            "if argument.startswith('--package-name-suffix=')), None)\n"
            "suffix = (suffix_argument.split('=', 1)[1] "
            "if suffix_argument is not None "
            "else package['desktopPackageSuffixes']['community'])\n"
            "package_name = f\"{package['name']}{suffix}\"\n"
            "target = next(argument.split('=', 1)[1] for argument in arguments "
            "if argument.startswith('--targets='))\n"
            "artifact_dir = electron_dir / 'packaging' / 'desktop-artifacts' / target\n"
            "artifacts = []\n"
            "if '--zip' in arguments and os.environ.get('AUTO_PACKAGE_TEST_SKIP_ZIP') != '1':\n"
            "    artifact = artifact_dir / (\n"
            "        f\"{package_name}-{package['version']}-{target}.zip\")\n"
            "    artifact.parent.mkdir(parents=True, exist_ok=True)\n"
            "    artifact.write_bytes(b'desktop zip')\n"
            "    artifacts.append(str(artifact.resolve()))\n"
            "if '--artifacts' in arguments:\n"
            "    extensions = (\n"
            "        ('dmg',) if target.startswith('darwin-')\n"
            "        else ('msi',) if target.startswith('win32-')\n"
            "        else tuple(extension for extension in ('deb', 'rpm')\n"
            "            if f'--skip-{extension}' not in arguments))\n"
            "    artifact_dir.mkdir(parents=True, exist_ok=True)\n"
            "    for extension in extensions:\n"
            "        artifact = artifact_dir / (\n"
            "            f\"{package_name}-{package['version']}-{target}.{extension}\")\n"
            "        artifact.write_bytes(f'desktop {extension}'.encode('utf-8'))\n"
            "        artifacts.append(str(artifact.resolve()))\n"
            "manifest_argument = next((argument for argument in arguments "
            "if argument.startswith('--artifact-manifest=')), None)\n"
            "if manifest_argument is not None:\n"
            "    manifest = Path(manifest_argument.split('=', 1)[1])\n"
            "    manifest.parent.mkdir(parents=True, exist_ok=True)\n"
            "    manifest.write_text(json.dumps({'artifacts': artifacts}), "
            "encoding='utf-8')\n"
            "Path(os.environ['AUTO_PACKAGE_TEST_LOG']).write_text(\n"
            "    json.dumps({\n"
            "        'arguments': arguments,\n"
            "        'cwd': os.getcwd(),\n"
            "        'mysql_shell_staging_root': os.environ.get(\n"
            "            'MYSQL_SHELL_STAGING_ROOT'),\n"
            "        'electron_builder_7zip_path': os.environ.get(\n"
            "            'ELECTRON_BUILDER_7ZIP_PATH'),\n"
            "        'custom_dmgbuild_path': os.environ.get(\n"
            "            'CUSTOM_DMGBUILD_PATH'),\n"
            "        'use_system_fpm': os.environ.get('USE_SYSTEM_FPM'),\n"
            "        'path': os.environ.get('PATH'),\n"
            "        'rpmbuild': shutil.which('rpmbuild'),\n"
            "        'staging_tests_exist': any(\n"
            "            Path(os.environ['MYSQL_SHELL_STAGING_ROOT']).glob(\n"
            "                '*/lib/mysqlsh/plugins/*/tests')),\n"
            "    }), encoding='utf-8')\n"
            "raise SystemExit(int(os.environ.get('AUTO_PACKAGE_TEST_EXIT', '0')))\n",
            encoding="utf-8",
        )
        fake_node.chmod(0o755)

        mysqlsh_source = self.create_mysqlsh_tree(root / "mysqlsh")
        electron_source = root / "electron-source"
        electron_source.mkdir()
        router_source = root / "router"
        router_source.mkdir()

        return script_path, fake_bin, mysqlsh_source, electron_source, router_source

    def run_script(
        self,
        script_path: Path,
        fake_bin: Path,
        arguments: list[str],
        log_path: Path,
        exit_code: Optional[int] = None,
        skip_zip: bool = False,
    ) -> subprocess.CompletedProcess[str]:
        environment = os.environ.copy()
        environment["PATH"] = os.pathsep.join((str(fake_bin), environment["PATH"]))
        environment["AUTO_PACKAGE_TEST_LOG"] = str(log_path)
        if exit_code is not None:
            environment["AUTO_PACKAGE_TEST_EXIT"] = str(exit_code)
        if skip_zip:
            environment["AUTO_PACKAGE_TEST_SKIP_ZIP"] = "1"

        return subprocess.run(
            [sys.executable, str(script_path), *arguments],
            capture_output=True,
            check=False,
            env=environment,
            text=True,
        )

    def host_target(self) -> str:
        system_name = platform.system()
        machine_name = platform.machine().lower()
        architecture = {
            "aarch64": "arm64",
            "amd64": "x64",
            "arm64": "arm64",
            "x86_64": "x64",
        }.get(machine_name)

        if system_name == "Darwin" and architecture is not None:
            return f"darwin-{architecture}"

        if system_name == "Linux" and architecture is not None:
            return f"linux-{architecture}"

        self.skipTest(f"Unsupported test host: {system_name} {machine_name}")

    def write_artifact_manifest(
        self,
        command: list[str],
        artifacts: list[Path],
    ) -> None:
        manifest_argument = next(
            argument for argument in command
            if argument.startswith("--artifact-manifest=")
        )
        manifest_path = Path(manifest_argument.split("=", 1)[1])
        manifest_path.write_text(
            json.dumps({
                "artifacts": [str(artifact.resolve()) for artifact in artifacts],
            }),
            encoding="utf-8",
        )

    def test_formats_commands_for_posix_and_windows(self) -> None:
        auto_package = self.load_auto_package()
        command = ["node", "argument with spaces", "--zip"]

        with mock.patch.object(
            auto_package.platform, "system", return_value="Linux"
        ):
            self.assertEqual(
                auto_package.format_command(command),
                "node 'argument with spaces' --zip",
            )

        with mock.patch.object(
            auto_package.platform, "system", return_value="Windows"
        ):
            self.assertEqual(
                auto_package.format_command(command),
                'node "argument with spaces" --zip',
            )

    def test_prints_path_operation(self) -> None:
        auto_package = self.load_auto_package()
        output = io.StringIO()

        with contextlib.redirect_stdout(output):
            auto_package.print_path_operation(
                "Copying artifact output",
                Path("/source/workbench.zip"),
                Path("/destination/workbench.zip"),
            )

        self.assertEqual(
            output.getvalue().splitlines(),
            [
                "Copying artifact output:",
                "  From: /source/workbench.zip",
                "  To:   /destination/workbench.zip",
            ],
        )

    def test_resolves_supported_platform_aliases(self) -> None:
        auto_package = self.load_auto_package()
        cases = (
            ("Darwin", "arm64", "darwin-arm64"),
            ("Darwin", "x86_64", "darwin-x64"),
            ("Linux", "aarch64", "linux-arm64"),
            ("Linux", "arm64", "linux-arm64"),
            ("Linux", "amd64", "linux-x64"),
            ("Linux", "x86_64", "linux-x64"),
            ("Windows", "AMD64", "win32-x64"),
            ("Windows", "x86_64", "win32-x64"),
        )

        for system_name, machine_name, expected in cases:
            with self.subTest(system_name=system_name, machine_name=machine_name):
                self.assertEqual(
                    auto_package.resolve_platform(system_name, machine_name),
                    expected,
                )

    def test_rejects_unsupported_platforms(self) -> None:
        auto_package = self.load_auto_package()

        with self.assertRaisesRegex(RuntimeError, "Unsupported platform"):
            auto_package.resolve_platform("Windows", "ARM64")

        with self.assertRaisesRegex(RuntimeError, "Unsupported platform"):
            auto_package.resolve_platform("Linux", "riscv64")

    def test_router_help_marks_option_as_reserved(self) -> None:
        auto_package = self.load_auto_package()

        output = io.StringIO()
        with (
            contextlib.redirect_stdout(output),
            self.assertRaises(SystemExit) as exit_context,
        ):
            auto_package.parse_arguments(["--help"])

        self.assertEqual(exit_context.exception.code, 0)
        self.assertIn("reserved", output.getvalue())
        self.assertIn("for future packaging integration", output.getvalue())

    def test_parses_wix_archive(self) -> None:
        auto_package = self.load_auto_package()
        options = auto_package.parse_arguments([
            "--mysqlsh", "/mysqlsh",
            "--electron", "/electron",
            "--router", "/router",
            "--installer",
            "--wix-archive", "/packages/wix-4.0.0.5512.2.7z",
        ])

        self.assertEqual(
            options.wix_archive,
            Path("/packages/wix-4.0.0.5512.2.7z"),
        )

    def test_parses_windows_sign_option(self) -> None:
        auto_package = self.load_auto_package()
        options = auto_package.parse_arguments([
            "--mysqlsh", "/mysqlsh",
            "--electron", "/electron",
            "--router", "/router",
            "--zip",
            "--win-sign",
        ])

        self.assertTrue(options.win_sign)

    def test_windows_sign_requires_windows(self) -> None:
        auto_package = self.load_auto_package()

        auto_package.validate_win_sign_option(True, "win32-x64")
        for target in ("linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64"):
            with self.subTest(target=target):
                with self.assertRaisesRegex(
                    ValueError,
                    "--win-sign can only be used when building on Windows",
                ):
                    auto_package.validate_win_sign_option(True, target)

        for target in (
            "win32-x64",
            "linux-x64",
            "linux-arm64",
            "darwin-x64",
            "darwin-arm64",
        ):
            with self.subTest(target=target):
                auto_package.validate_win_sign_option(False, target)

    def test_wix_requires_windows_installer(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            wix = Path(temp) / "wix-4.0.0.5512.2.7z"
            wix.touch()
            cases = (
                (False, "win32-x64", "--installer"),
                (True, "linux-x64", "Windows"),
            )
            for installer, target, message in cases:
                with self.subTest(installer=installer, target=target):
                    with self.assertRaisesRegex(ValueError, message):
                        auto_package.validate_wix_archive_option(
                            wix, installer, target
                        )

    def test_wix_must_be_a_file(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for wix in (root / "missing.7z", root):
                with self.subTest(wix=wix):
                    with self.assertRaisesRegex(ValueError, "WiX archive is not a file"):
                        auto_package.validate_wix_archive_option(
                            wix, True, "win32-x64"
                        )

    def test_package_metadata_reads_shared_suffixes(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            package_path = Path(temp) / "package.json"
            package_path.write_text(
                json.dumps({
                    "name": "mysql-workbench",
                    "version": "26.7.0",
                    "dependencies": {"electron": "43.2.0"},
                    "desktopPackageSuffixes": {
                        "community": "",
                        "commercial": "-commercial",
                    },
                    "desktopElectronBuilderCache": "packaging/electron-builder-cache",
                }),
                encoding="utf-8",
            )

            self.assertEqual(
                auto_package.package_metadata(package_path)[1],
                {
                    "community": "",
                    "commercial": "-commercial",
                },
            )

    def test_package_metadata_leaves_suffix_validation_to_packager(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            package_path = Path(temp) / "package.json"
            package_path.write_text(
                json.dumps({
                    "name": "mysql-workbench",
                    "version": "26.7.0",
                    "dependencies": {"electron": "43.2.0"},
                    "desktopPackageSuffixes": {
                        "community": "",
                        "commercial": "",
                    },
                    "desktopElectronBuilderCache": "packaging/electron-builder-cache",
                }),
                encoding="utf-8",
            )

            self.assertEqual(
                auto_package.package_metadata(package_path)[1],
                {
                    "community": "",
                    "commercial": "",
                },
            )

    def test_stages_wix_archive_in_configured_cache(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "input" / "wix-4.0.0.5512.2.7z"
            source.parent.mkdir()
            source.write_bytes(b"official wix")
            cache = root / "cache"
            destination = cache / "wix-4.0.0.5512.2" / source.name
            destination.parent.mkdir(parents=True)
            destination.write_bytes(b"stale")
            output = io.StringIO()

            with contextlib.redirect_stdout(output):
                result = auto_package.stage_wix_archive(source, cache)

            self.assertEqual(result, destination.resolve())
            self.assertEqual(destination.read_bytes(), b"official wix")
            self.assertEqual(output.getvalue().splitlines(), [
                "Copying WiX archive:",
                f"  From: {source.resolve()}",
                f"  To:   {destination.resolve()}",
            ])

    def test_wix_archive_already_in_cache_is_not_copied(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            cache = Path(temp) / "cache"
            source = cache / "wix-4.0.0.5512.2" / "wix-4.0.0.5512.2.7z"
            source.parent.mkdir(parents=True)
            source.write_bytes(b"official wix")

            with mock.patch.object(auto_package.shutil, "copy2") as copy:
                result = auto_package.stage_wix_archive(source, cache)

            copy.assert_not_called()
            self.assertEqual(result, source.resolve())

    def test_rejects_invalid_electron_builder_cache(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "missing-cache"
            destination = root / "destination-cache"

            with self.assertRaisesRegex(
                ValueError, r"is not a directory"
            ):
                auto_package.stage_electron_builder_cache(
                    {"ELECTRON_BUILDER_CACHE": str(source)},
                    destination,
                )

            self.assertFalse(destination.exists())

    def test_configures_7zip_from_path(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            bin_dir = Path(temp) / "bin"
            bin_dir.mkdir()
            executable = bin_dir / "7za"
            executable.touch(mode=0o755)
            environment = {"PATH": str(bin_dir)}
            output = io.StringIO()

            with contextlib.redirect_stdout(output):
                auto_package.configure_7zip_environment(environment)

            self.assertEqual(
                environment["ELECTRON_BUILDER_7ZIP_PATH"],
                str(executable.resolve()),
            )
            self.assertEqual(
                output.getvalue().splitlines(),
                [
                    "Set ELECTRON_BUILDER_7ZIP_PATH to "
                    f"{executable.resolve()}",
                ],
            )

    def test_configures_7zip_from_path_on_windows(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            bin_dir = Path(temp) / "bin"
            bin_dir.mkdir()
            executable = bin_dir / "7za"
            executable.touch(mode=0o755)
            environment = {"PATH": str(bin_dir)}

            with mock.patch.object(
                auto_package.platform,
                "system",
                return_value="Windows",
            ):
                auto_package.configure_7zip_environment(environment)

            self.assertEqual(
                environment["ELECTRON_BUILDER_7ZIP_PATH"],
                str(executable.resolve()),
            )

    def test_preserves_configured_7zip_path_on_windows(self) -> None:
        auto_package = self.load_auto_package()
        environment = {
            "ELECTRON_BUILDER_7ZIP_PATH": "/configured/7za",
            "PATH": "",
        }

        with mock.patch.object(
            auto_package.platform,
            "system",
            return_value="Windows",
        ):
            auto_package.configure_7zip_environment(environment)

        self.assertEqual(
            environment["ELECTRON_BUILDER_7ZIP_PATH"],
            "/configured/7za",
        )

    def test_leaves_7zip_unconfigured_when_not_found(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            environment = {"PATH": temp}

            auto_package.configure_7zip_environment(environment)

            self.assertNotIn("ELECTRON_BUILDER_7ZIP_PATH", environment)

    def test_configures_dmgbuild_from_path(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            bin_dir = Path(temp) / "bin"
            bin_dir.mkdir()
            executable = bin_dir / "dmgbuild"
            executable.touch(mode=0o755)
            environment = {"PATH": str(bin_dir)}
            output = io.StringIO()

            with contextlib.redirect_stdout(output):
                auto_package.configure_dmgbuild_environment(environment)

            self.assertEqual(
                environment["CUSTOM_DMGBUILD_PATH"],
                str(executable.resolve()),
            )
            self.assertEqual(
                output.getvalue().splitlines(),
                [f"Set CUSTOM_DMGBUILD_PATH to {executable.resolve()}"],
            )

    def test_preserves_configured_dmgbuild_path(self) -> None:
        auto_package = self.load_auto_package()
        environment = {
            "CUSTOM_DMGBUILD_PATH": "/configured/dmgbuild",
            "PATH": "",
        }

        auto_package.configure_dmgbuild_environment(environment)

        self.assertEqual(
            environment["CUSTOM_DMGBUILD_PATH"],
            "/configured/dmgbuild",
        )

    def test_leaves_dmgbuild_unconfigured_when_not_found(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            environment = {"PATH": temp}

            auto_package.configure_dmgbuild_environment(environment)

            self.assertNotIn("CUSTOM_DMGBUILD_PATH", environment)

    def test_rpmbuild_workaround_removes_library_path(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            real_bin = root / "real bin"
            real_bin.mkdir()
            invocation_path = root / "rpmbuild.json"
            executable = real_bin / "rpmbuild"
            executable.write_text(
                "#!/usr/bin/env python3\n"
                "import json\n"
                "import os\n"
                "import sys\n"
                "from pathlib import Path\n"
                "Path(os.environ['RPMBUILD_TEST_LOG']).write_text(\n"
                "    json.dumps({\n"
                "        'arguments': sys.argv[1:],\n"
                "        'ld_library_path': os.environ.get('LD_LIBRARY_PATH'),\n"
                "        'preserved': os.environ.get('RPMBUILD_TEST_PRESERVED'),\n"
                "    }), encoding='utf-8')\n",
                encoding="utf-8",
            )
            executable.chmod(0o755)
            original_path = os.pathsep.join((str(real_bin), os.environ["PATH"]))
            environment = {
                "PATH": original_path,
                "LD_LIBRARY_PATH": "/portable/fpm/lib",
                "RPMBUILD_TEST_LOG": str(invocation_path),
                "RPMBUILD_TEST_PRESERVED": "preserved-value",
            }
            output = io.StringIO()

            with (
                contextlib.redirect_stdout(output),
                auto_package.rpmbuild_openssl_workaround(environment),
            ):
                launcher = shutil.which("rpmbuild", path=environment["PATH"])
                self.assertIsNotNone(launcher)
                self.assertNotEqual(
                    Path(str(launcher)).resolve(),
                    executable.resolve(),
                )
                subprocess.run(
                    ["rpmbuild", "--define", "value with spaces"],
                    check=True,
                    env=environment,
                )

            invocation = json.loads(invocation_path.read_text(encoding="utf-8"))
            self.assertEqual(
                invocation["arguments"],
                ["--define", "value with spaces"],
            )
            self.assertIsNone(invocation["ld_library_path"])
            self.assertEqual(invocation["preserved"], "preserved-value")
            self.assertEqual(environment["PATH"], original_path)
            self.assertIn(
                f"Set rpmbuild OpenSSL workaround using {executable.resolve()}",
                output.getvalue().splitlines(),
            )

    def test_rpmbuild_workaround_is_inactive_when_not_found(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            environment = {
                "PATH": temp,
                "LD_LIBRARY_PATH": "/unchanged",
            }
            original_environment = environment.copy()
            output = io.StringIO()

            with (
                contextlib.redirect_stdout(output),
                auto_package.rpmbuild_openssl_workaround(environment),
            ):
                self.assertEqual(environment, original_environment)

            self.assertEqual(environment, original_environment)
            self.assertEqual(output.getvalue(), "")

    def test_copies_and_reports_all_manifest_artifacts(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            electron_dir = Path(temp) / "electron"
            artifact_dir = (
                electron_dir / "packaging" / "desktop-artifacts" / "linux-x64"
            )
            artifact_dir.mkdir(parents=True)
            deb = artifact_dir / "renamed-workbench.deb"
            rpm = artifact_dir / "renamed-workbench.rpm"
            deb.write_bytes(b"new deb")
            rpm.write_bytes(b"new rpm")
            manifest = Path(temp) / "artifacts.json"
            manifest.write_text(
                json.dumps({"artifacts": [str(deb), str(rpm)]}),
                encoding="utf-8",
            )
            dist = electron_dir / "dist"
            dist.mkdir()
            (dist / deb.name).write_bytes(b"old deb")
            output = io.StringIO()

            with contextlib.redirect_stdout(output):
                result = auto_package.copy_artifact_outputs(manifest, electron_dir)

            self.assertEqual(result, 0)
            self.assertEqual((dist / deb.name).read_bytes(), b"new deb")
            self.assertEqual((dist / rpm.name).read_bytes(), b"new rpm")
            self.assertEqual(
                output.getvalue().splitlines(),
                [
                    "Copying artifact output:",
                    f"  From: {deb.resolve()}",
                    f"  To:   {(dist / deb.name).resolve()}",
                    f"Artifact output: {(dist / deb.name).resolve()}",
                    "Copying artifact output:",
                    f"  From: {rpm.resolve()}",
                    f"  To:   {(dist / rpm.name).resolve()}",
                    f"Artifact output: {(dist / rpm.name).resolve()}",
                ],
            )

    def test_missing_manifest_artifact_does_not_copy_partial_output(self) -> None:
        auto_package = self.load_auto_package()

        with tempfile.TemporaryDirectory() as temp:
            electron_dir = Path(temp) / "electron"
            artifact_dir = (
                electron_dir / "packaging" / "desktop-artifacts" / "linux-x64"
            )
            artifact_dir.mkdir(parents=True)
            deb = artifact_dir / "renamed-workbench.deb"
            rpm = artifact_dir / "renamed-workbench.rpm"
            deb.write_bytes(b"new deb")
            manifest = Path(temp) / "artifacts.json"
            manifest.write_text(
                json.dumps({"artifacts": [str(deb), str(rpm)]}),
                encoding="utf-8",
            )
            dist = electron_dir / "dist"
            dist.mkdir()
            (dist / deb.name).write_bytes(b"old deb")
            error_output = io.StringIO()

            with contextlib.redirect_stderr(error_output):
                result = auto_package.copy_artifact_outputs(manifest, electron_dir)

            self.assertEqual(result, 1)
            self.assertEqual((dist / deb.name).read_bytes(), b"old deb")
            self.assertFalse((dist / rpm.name).exists())
            self.assertIn(
                f"ERROR: Expected artifact output was not produced: {rpm}",
                error_output.getvalue(),
            )

    def test_rejects_malformed_artifact_manifest(self) -> None:
        auto_package = self.load_auto_package()

        cases = ({}, {"artifacts": []}, {"artifacts": [17]})
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            electron_dir = root / "electron"
            for index, data in enumerate(cases):
                with self.subTest(data=data):
                    manifest = root / f"artifacts-{index}.json"
                    manifest.write_text(json.dumps(data), encoding="utf-8")
                    with self.assertRaisesRegex(
                        ValueError,
                        "artifact manifest",
                    ):
                        auto_package.copy_artifact_outputs(
                            manifest,
                            electron_dir,
                        )

    def test_requires_exactly_one_output_mode_before_extracting(self) -> None:
        target = self.host_target()

        for output_arguments in ([], ["--zip", "--installer"]):
            with self.subTest(output_arguments=output_arguments), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                script_path, fake_bin, mysqlsh_source, electron_source, router_source = self.prepare_test_tree(root)
                destination = root / "electron" / "packaging" / "electron" / target
                destination.mkdir(parents=True)
                stale_file = destination / "stale"
                stale_file.touch()
                log_path = root / "arguments.json"

                result = self.run_script(
                    script_path,
                    fake_bin,
                    [
                        "--mysqlsh",
                        str(mysqlsh_source),
                        "--electron",
                        str(electron_source),
                        "--router",
                        str(router_source),
                        *output_arguments,
                    ],
                    log_path,
                )

                self.assertEqual(result.returncode, 2)
                self.assertTrue(stale_file.exists())
                self.assertFalse(log_path.exists())

    def test_requires_router_before_extracting(self) -> None:
        target = self.host_target()

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_path, fake_bin, mysqlsh_source, electron_source, _router_source = self.prepare_test_tree(root)
            destination = root / "electron" / "packaging" / "electron" / target
            destination.mkdir(parents=True)
            stale_file = destination / "stale"
            stale_file.touch()
            log_path = root / "arguments.json"

            result = self.run_script(
                script_path,
                fake_bin,
                [
                    "--mysqlsh",
                    str(mysqlsh_source),
                    "--electron",
                    str(electron_source),
                    "--zip",
                ],
                log_path,
            )

            self.assertEqual(result.returncode, 2)
            self.assertTrue(stale_file.exists())
            self.assertFalse(log_path.exists())

    def test_missing_matching_archive_preserves_existing_tree(self) -> None:
        target = self.host_target()

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_path, fake_bin, mysqlsh_source, electron_source, router_source = self.prepare_test_tree(root)
            destination = root / "electron" / "packaging" / "electron" / target
            destination.mkdir(parents=True)
            stale_file = destination / "stale"
            stale_file.touch()
            log_path = root / "arguments.json"

            result = self.run_script(
                script_path,
                fake_bin,
                [
                    "--mysqlsh",
                    str(mysqlsh_source),
                    "--electron",
                    str(electron_source),
                    "--router",
                    str(router_source),
                    "--zip",
                ],
                log_path,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn(f"electron-v43.2.0-{target}.zip", result.stderr)
            self.assertTrue(stale_file.exists())
            self.assertFalse(log_path.exists())

    def test_corrupt_archive_preserves_existing_tree(self) -> None:
        target = self.host_target()

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_path, fake_bin, mysqlsh_source, electron_source, router_source = self.prepare_test_tree(root)
            archive_path = electron_source / f"electron-v43.2.0-{target}.zip"
            archive_path.write_bytes(b"not a zip")
            destination = root / "electron" / "packaging" / "electron" / target
            destination.mkdir(parents=True)
            stale_file = destination / "stale"
            stale_file.touch()
            log_path = root / "arguments.json"

            result = self.run_script(
                script_path,
                fake_bin,
                [
                    "--mysqlsh",
                    str(mysqlsh_source),
                    "--electron",
                    str(electron_source),
                    "--router",
                    str(router_source),
                    "--zip",
                ],
                log_path,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertTrue(stale_file.exists())
            self.assertFalse(log_path.exists())

    def test_partial_extraction_failure_preserves_existing_tree(self) -> None:
        target = self.host_target()

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_path, fake_bin, mysqlsh_source, electron_source, router_source = self.prepare_test_tree(root)
            archive_path = electron_source / f"electron-v43.2.0-{target}.zip"
            link_info = zipfile.ZipInfo("invalid-link")
            link_info.create_system = 3
            link_info.external_attr = (stat.S_IFLNK | 0o755) << 16
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("runtime", b"electron")
                archive.writestr(link_info, b"\xff")

            destination = root / "electron" / "packaging" / "electron" / target
            destination.mkdir(parents=True)
            stale_file = destination / "stale"
            stale_file.touch()
            log_path = root / "arguments.json"

            result = self.run_script(
                script_path,
                fake_bin,
                [
                    "--mysqlsh",
                    str(mysqlsh_source),
                    "--electron",
                    str(electron_source),
                    "--router",
                    str(router_source),
                    "--zip",
                ],
                log_path,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertTrue(stale_file.exists())
            self.assertFalse((destination / "runtime").exists())
            self.assertFalse(log_path.exists())

    def test_zip_extracts_matching_archive_and_invokes_packaging(self) -> None:
        target = self.host_target()

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_path, fake_bin, mysqlsh_source, electron_source, router_source = self.prepare_test_tree(root)
            archive_path = electron_source / f"electron-v43.2.0-{target}.zip"
            runtime_info = zipfile.ZipInfo("runtime")
            runtime_info.create_system = 3
            runtime_info.external_attr = (stat.S_IFREG | 0o755) << 16
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr(runtime_info, b"electron")

            wrong_archive = electron_source / f"electron-v42.4.1-{target}.zip"
            with zipfile.ZipFile(wrong_archive, "w") as archive:
                archive.writestr("runtime", b"wrong electron")

            destination = root / "electron" / "packaging" / "electron" / target
            destination.mkdir(parents=True)
            (destination / "stale").touch()
            seven_zip = fake_bin / "7za"
            seven_zip.touch(mode=0o755)
            log_path = root / "arguments.json"

            result = self.run_script(
                script_path,
                fake_bin,
                [
                    "--mysqlsh",
                    str(mysqlsh_source),
                    "--electron",
                    str(electron_source),
                    "--router",
                    str(router_source),
                    "--zip",
                ],
                log_path,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertFalse((destination / "stale").exists())
            self.assertTrue((destination / "runtime").is_file())
            self.assertEqual((destination / "runtime").read_text(encoding="utf-8"), "electron")
            self.assertTrue(os.access(destination / "runtime", os.X_OK))
            zip_output = root / "electron" / "dist" / f"mysql-workbench-26.7.0-{target}.zip"
            self.assertTrue(zip_output.is_file())
            self.assertEqual(zip_output.read_bytes(), b"desktop zip")
            self.assertIn(f"Artifact output: {zip_output.resolve()}", result.stdout)
            lines = result.stdout.splitlines()
            self.assertIn(f"Packaging target: {target}", lines)
            self.assertIn("Package edition: community", lines)
            self.assertIn("Output mode: ZIP", lines)
            self.assertIn("Extracting Electron runtime:", lines)
            self.assertIn(f"  From: {archive_path.resolve()}", lines)
            self.assertIn(f"  To:   {destination.resolve()}", lines)
            self.assertIn("Staging MySQL Shell:", lines)
            self.assertIn(f"  From: {mysqlsh_source.resolve()}", lines)
            self.assertIn(
                "  To:   "
                f"{(root / 'electron' / 'packaging' / 'mysql-shell-staging' / target).resolve()}",
                lines,
            )
            self.assertIn("Running packaging command:", lines)
            self.assertIn(
                f"  Working directory: {(root / 'electron').resolve()}", lines
            )
            self.assertTrue(any(line.startswith("  Command: node ") for line in lines))
            self.assertIn("Copying artifact output:", lines)
            self.assertIn(
                "  From: "
                f"{(root / 'electron' / 'packaging' / 'desktop-artifacts' / target / zip_output.name).resolve()}",
                lines,
            )
            self.assertIn(f"  To:   {zip_output.resolve()}", lines)
            self.assertNotIn(str(router_source.resolve()), result.stdout)
            invocation = json.loads(log_path.read_text(encoding="utf-8"))
            manifest_arguments = [
                argument for argument in invocation["arguments"]
                if argument.startswith("--artifact-manifest=")
            ]
            self.assertEqual(len(manifest_arguments), 1)
            self.assertEqual(
                [
                    argument for argument in invocation["arguments"]
                    if not argument.startswith("--artifact-manifest=")
                ],
                [
                    "--experimental-strip-types",
                    str(root / "electron" / "scripts" / "package_desktop.ts"),
                    f"--targets={target}",
                    "--zip",
                ],
            )
            self.assertNotIn(
                "--package-name-suffix=-commercial",
                invocation["arguments"],
            )
            self.assertEqual(invocation["cwd"], str(root / "electron"))
            self.assertEqual(
                invocation["mysql_shell_staging_root"],
                str(root / "electron" / "packaging" / "mysql-shell-staging"),
            )
            self.assertEqual(
                invocation["electron_builder_7zip_path"],
                str(seven_zip.resolve()),
            )
            self.assertTrue(invocation["staging_tests_exist"])

    def test_commercial_zip_uses_configured_suffix_and_exact_output(self) -> None:
        target = self.host_target()

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (
                script_path,
                fake_bin,
                mysqlsh_source,
                electron_source,
                router_source,
            ) = self.prepare_test_tree(root)
            archive_path = electron_source / f"electron-v43.2.0-{target}.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("runtime", b"electron")

            log_path = root / "arguments.json"
            result = self.run_script(
                script_path,
                fake_bin,
                [
                    "--mysqlsh",
                    str(mysqlsh_source),
                    "--electron",
                    str(electron_source),
                    "--router",
                    str(router_source),
                    "--zip",
                    "--commercial",
                ],
                log_path,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            zip_output = (
                root / "electron" / "dist"
                / f"mysql-workbench-commercial-26.7.0-{target}.zip"
            )
            self.assertEqual(zip_output.read_bytes(), b"desktop zip")
            self.assertIn(f"Artifact output: {zip_output.resolve()}", result.stdout)
            invocation = json.loads(log_path.read_text(encoding="utf-8"))
            self.assertIn(
                "--package-name-suffix=-commercial",
                invocation["arguments"],
            )
            self.assertNotIn("--commercial", invocation["arguments"])

    def test_zip_preserves_symbolic_links(self) -> None:
        target = self.host_target()

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_path, fake_bin, mysqlsh_source, electron_source, router_source = self.prepare_test_tree(root)
            archive_path = electron_source / f"electron-v43.2.0-{target}.zip"
            link_info = zipfile.ZipInfo("runtime-link")
            link_info.create_system = 3
            link_info.external_attr = (stat.S_IFLNK | 0o755) << 16
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("runtime", b"electron")
                archive.writestr(link_info, b"runtime")

            log_path = root / "arguments.json"
            result = self.run_script(
                script_path,
                fake_bin,
                [
                    "--mysqlsh",
                    str(mysqlsh_source),
                    "--electron",
                    str(electron_source),
                    "--router",
                    str(router_source),
                    "--zip",
                ],
                log_path,
            )

            destination = root / "electron" / "packaging" / "electron" / target
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue((destination / "runtime-link").is_symlink())
            self.assertEqual(os.readlink(destination / "runtime-link"), "runtime")

    def test_zip_fails_when_packaging_does_not_create_output(self) -> None:
        target = self.host_target()

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_path, fake_bin, mysqlsh_source, electron_source, router_source = self.prepare_test_tree(root)
            archive_path = electron_source / f"electron-v43.2.0-{target}.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("runtime", b"electron")

            log_path = root / "arguments.json"
            result = self.run_script(
                script_path,
                fake_bin,
                [
                    "--mysqlsh",
                    str(mysqlsh_source),
                    "--electron",
                    str(electron_source),
                    "--router",
                    str(router_source),
                    "--zip",
                ],
                log_path,
                skip_zip=True,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn(
                "ERROR: Invalid artifact manifest:",
                result.stderr,
            )
            self.assertFalse((root / "electron" / "dist").exists())

    def test_installer_maps_to_artifacts_and_propagates_failure(self) -> None:
        target = self.host_target()

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_path, fake_bin, mysqlsh_source, electron_source, router_source = self.prepare_test_tree(root)
            archive_path = electron_source / f"electron-v43.2.0-{target}.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("runtime", b"electron")
            log_path = root / "arguments.json"

            result = self.run_script(
                script_path,
                fake_bin,
                [
                    "--mysqlsh",
                    str(mysqlsh_source),
                    "--electron",
                    str(electron_source),
                    "--router",
                    str(router_source),
                    "--installer",
                ],
                log_path,
                exit_code=7,
            )

            self.assertEqual(result.returncode, 7)
            invocation = json.loads(log_path.read_text(encoding="utf-8"))
            expected_arguments = [
                "--experimental-strip-types",
                str(root / "electron" / "scripts" / "package_desktop.ts"),
                f"--targets={target}",
                "--artifacts",
            ]
            if target == "linux-arm64":
                expected_arguments.append("--skip-deb")
            manifest_arguments = [
                argument for argument in invocation["arguments"]
                if argument.startswith("--artifact-manifest=")
            ]
            self.assertEqual(len(manifest_arguments), 1)
            self.assertEqual(
                [
                    argument for argument in invocation["arguments"]
                    if not argument.startswith("--artifact-manifest=")
                ],
                expected_arguments,
            )
            self.assertEqual(invocation["cwd"], str(root / "electron"))
            self.assertTrue(invocation["staging_tests_exist"])
            self.assertFalse((root / "electron" / "dist").exists())

    def test_linux_arm64_installer_skips_deb(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_path, _, mysqlsh_source, electron_source, router_source = (
                self.prepare_test_tree(root)
            )
            auto_package = self.load_auto_package(script_path)
            options = auto_package.parse_arguments([
                "--mysqlsh",
                str(mysqlsh_source),
                "--electron",
                str(electron_source),
                "--router",
                str(router_source),
                "--installer",
            ])
            invocations: list[list[str]] = []

            def run_package(
                command: list[str], **_kwargs: object
            ) -> subprocess.CompletedProcess[str]:
                invocations.append(command)
                artifact = (
                    root / "electron" / "packaging" / "desktop-artifacts"
                    / "linux-arm64"
                    / "mysql-workbench-26.7.0-linux-arm64.rpm"
                )
                artifact.parent.mkdir(parents=True)
                artifact.write_bytes(b"rpm")
                self.write_artifact_manifest(command, [artifact])

                return subprocess.CompletedProcess(command, 0)

            output = FlushingStringIO()
            with (
                mock.patch.object(auto_package, "replace_electron_tree_from_zip"),
                mock.patch.object(auto_package, "stage_mysqlsh_tree") as stage,
                mock.patch.object(auto_package, "configure_7zip_environment"),
                mock.patch.object(auto_package, "configure_fpm_environment"),
                mock.patch.object(
                    auto_package,
                    "rpmbuild_openssl_workaround",
                    return_value=contextlib.nullcontext(),
                ),
                mock.patch.object(
                    auto_package.subprocess,
                    "run",
                    side_effect=run_package,
                ),
                contextlib.redirect_stdout(output),
            ):
                result = auto_package.package_target(
                    options,
                    "linux-arm64",
                    script_path.parent,
                )

            self.assertEqual(result, 0)
            stage.assert_called_once_with(
                mysqlsh_source,
                root / "electron" / "packaging" / "mysql-shell-staging"
                / "linux-arm64",
                optimize_oci=True,
            )
            self.assertEqual(output.flush_count, 5)
            self.assertIn("--artifacts", invocations[0])
            self.assertIn("--skip-deb", invocations[0])
            self.assertNotIn("--skip-rpm", invocations[0])
            self.assertTrue(
                (root / "electron" / "dist"
                 / "mysql-workbench-26.7.0-linux-arm64.rpm").is_file()
            )
            self.assertFalse(
                (root / "electron" / "dist"
                 / "mysql-workbench-26.7.0-linux-arm64.deb").exists()
            )

    def test_darwin_installer_uses_dmgbuild_from_path(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_path, fake_bin, mysqlsh_source, electron_source, router_source = (
                self.prepare_test_tree(root)
            )
            target = "darwin-arm64"
            archive_path = electron_source / f"electron-v43.2.0-{target}.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("Electron.app/Contents/MacOS/Electron", b"electron")
            executable = fake_bin / "dmgbuild"
            executable.touch(mode=0o755)
            log_path = root / "arguments.json"
            auto_package = self.load_auto_package(script_path)
            options = auto_package.parse_arguments([
                "--mysqlsh",
                str(mysqlsh_source),
                "--electron",
                str(electron_source),
                "--router",
                str(router_source),
                "--installer",
            ])
            environment = os.environ.copy()
            environment["PATH"] = os.pathsep.join(
                (str(fake_bin), environment["PATH"])
            )
            environment.pop("CUSTOM_DMGBUILD_PATH", None)
            environment["AUTO_PACKAGE_TEST_LOG"] = str(log_path)
            output = io.StringIO()

            with (
                mock.patch.dict(os.environ, environment, clear=True),
                contextlib.redirect_stdout(output),
            ):
                result = auto_package.package_target(
                    options,
                    target,
                    script_path.parent,
                )

            self.assertEqual(result, 0)
            invocation = json.loads(log_path.read_text(encoding="utf-8"))
            self.assertEqual(
                invocation["custom_dmgbuild_path"],
                str(executable.resolve()),
            )
            self.assertIn(
                f"Set CUSTOM_DMGBUILD_PATH to {executable.resolve()}",
                output.getvalue().splitlines(),
            )

    def test_linux_installer_uses_fpm_from_path(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_path, fake_bin, mysqlsh_source, electron_source, router_source = (
                self.prepare_test_tree(root)
            )
            target = "linux-x64"
            archive_path = electron_source / f"electron-v43.2.0-{target}.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("electron", b"electron")
            executable = fake_bin / "fpm"
            executable.touch(mode=0o755)
            real_rpmbuild = fake_bin / "rpmbuild"
            real_rpmbuild.touch(mode=0o755)
            log_path = root / "arguments.json"
            auto_package = self.load_auto_package(script_path)
            options = auto_package.parse_arguments([
                "--mysqlsh",
                str(mysqlsh_source),
                "--electron",
                str(electron_source),
                "--router",
                str(router_source),
                "--installer",
            ])
            environment = os.environ.copy()
            environment["PATH"] = os.pathsep.join(
                (str(fake_bin), environment["PATH"])
            )
            environment["ELECTRON_BUILDER_7ZIP_PATH"] = "/configured/7za"
            environment.pop("CUSTOM_FPM_PATH", None)
            environment.pop("USE_SYSTEM_FPM", None)
            environment["AUTO_PACKAGE_TEST_LOG"] = str(log_path)
            output = io.StringIO()

            with (
                mock.patch.dict(os.environ, environment, clear=True),
                contextlib.redirect_stdout(output),
            ):
                result = auto_package.package_target(
                    options,
                    target,
                    script_path.parent,
                )

            self.assertEqual(result, 0)
            invocation = json.loads(log_path.read_text(encoding="utf-8"))
            self.assertEqual(invocation["use_system_fpm"], "true")
            invocation_path = str(invocation["path"]).split(os.pathsep)
            self.assertNotEqual(invocation_path[0], str(fake_bin))
            self.assertEqual(
                Path(str(invocation["rpmbuild"])).name,
                "rpmbuild",
            )
            self.assertNotEqual(
                Path(str(invocation["rpmbuild"])).resolve(),
                real_rpmbuild.resolve(),
            )
            self.assertIn(
                f"Set USE_SYSTEM_FPM=true using {executable.resolve()}",
                output.getvalue().splitlines(),
            )
            self.assertIn(
                "Set rpmbuild OpenSSL workaround using "
                f"{real_rpmbuild.resolve()}",
                output.getvalue().splitlines(),
            )

    def test_package_target_supports_windows_without_bash(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_path, fake_bin, mysqlsh_source, electron_source, router_source = (
                self.prepare_test_tree(root)
            )
            target = "win32-x64"
            archive_path = electron_source / f"electron-v43.2.0-{target}.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("electron.exe", b"electron")
            wix_source = root / "wix-4.0.0.5512.2.7z"
            wix_source.write_bytes(b"official wix")
            external_cache = root / "external-cache"
            cached_fpm = external_cache / "fpm@2.1.4" / "fpm.7z"
            cached_fpm.parent.mkdir(parents=True)
            cached_fpm.write_bytes(b"external fpm")
            cached_wix = (
                external_cache / "wix-4.0.0.5512.2" / wix_source.name
            )
            cached_wix.parent.mkdir(parents=True)
            cached_wix.write_bytes(b"cached wix")
            project_cache = (
                root / "electron" / "packaging" / "electron-builder-cache"
            )
            staged_fpm = project_cache / "fpm@2.1.4" / cached_fpm.name
            staged_fpm.parent.mkdir(parents=True)
            staged_fpm.write_bytes(b"stale fpm")
            nested_cache_entry = staged_fpm.parent / "preserve"
            nested_cache_entry.write_bytes(b"preserve")
            unrelated_cache_entry = project_cache / "unrelated" / "preserve"
            unrelated_cache_entry.parent.mkdir()
            unrelated_cache_entry.write_bytes(b"preserve")
            log_path = root / "arguments.json"
            auto_package = self.load_auto_package(script_path)
            options = auto_package.parse_arguments([
                "--mysqlsh",
                str(mysqlsh_source),
                "--electron",
                str(electron_source),
                "--router",
                str(router_source),
                "--installer",
                "--commercial",
                "--win-sign",
                "--wix-archive",
                str(wix_source),
            ])
            environment = os.environ.copy()
            environment["PATH"] = os.pathsep.join(
                (str(fake_bin), environment["PATH"])
            )
            environment["ELECTRON_BUILDER_7ZIP_PATH"] = "/configured/7za"
            environment["ELECTRON_BUILDER_CACHE"] = str(external_cache)
            environment["AUTO_PACKAGE_TEST_LOG"] = str(log_path)
            output = io.StringIO()

            with (
                mock.patch.dict(os.environ, environment, clear=True),
                contextlib.redirect_stdout(output),
            ):
                result = auto_package.package_target(options, target, script_path.parent)

            self.assertEqual(result, 0)
            installer = (
                root / "electron" / "dist"
                / "mysql-workbench-commercial-26.7.0-win32-x64.msi"
            )
            self.assertEqual(installer.read_bytes(), b"desktop msi")
            lines = output.getvalue().splitlines()
            self.assertIn("Package edition: commercial", lines)
            self.assertIn("Output mode: installer", lines)
            self.assertIn(f"Artifact output: {installer.resolve()}", lines)
            self.assertIn(
                "  From: "
                f"{(root / 'electron' / 'packaging' / 'desktop-artifacts' / target / installer.name).resolve()}",
                lines,
            )
            self.assertIn(f"  To:   {installer.resolve()}", lines)
            wix_destination = (
                root / "electron" / "packaging" / "electron-builder-cache"
                / "wix-4.0.0.5512.2" / wix_source.name
            )
            self.assertEqual(wix_destination.read_bytes(), b"official wix")
            self.assertIn("Copying WiX archive:", lines)
            self.assertIn(f"  From: {wix_source.resolve()}", lines)
            self.assertIn(f"  To:   {wix_destination.resolve()}", lines)
            self.assertEqual(staged_fpm.read_bytes(), b"external fpm")
            self.assertTrue(nested_cache_entry.is_file())
            self.assertEqual(nested_cache_entry.read_bytes(), b"preserve")
            self.assertEqual(unrelated_cache_entry.read_bytes(), b"preserve")
            self.assertLess(
                lines.index("Copying Electron Builder cache:"),
                lines.index("Copying WiX archive:"),
            )
            invocation = json.loads(log_path.read_text(encoding="utf-8"))
            self.assertIn(f"--targets={target}", invocation["arguments"])
            self.assertIn("--artifacts", invocation["arguments"])
            self.assertEqual(invocation["arguments"].count("--win-sign"), 1)
            self.assertIn(
                "--package-name-suffix=-commercial",
                invocation["arguments"],
            )
            self.assertNotIn("--commercial", invocation["arguments"])
            self.assertNotIn("--wix-archive", " ".join(invocation["arguments"]))
            self.assertEqual(
                invocation["electron_builder_7zip_path"],
                "/configured/7za",
            )
            self.assertTrue(invocation["staging_tests_exist"])

    def test_signed_windows_zip_forwards_sign_to_packager(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_path, fake_bin, mysqlsh, electron, router = (
                self.prepare_test_tree(root)
            )
            target = "win32-x64"
            archive_path = electron / f"electron-v43.2.0-{target}.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("electron.exe", b"electron")

            log_path = root / "arguments.json"
            auto_package = self.load_auto_package(script_path)
            options = auto_package.parse_arguments([
                "--mysqlsh", str(mysqlsh),
                "--electron", str(electron),
                "--router", str(router),
                "--zip",
                "--win-sign",
            ])
            environment = os.environ.copy()
            environment["PATH"] = os.pathsep.join(
                (str(fake_bin), environment["PATH"])
            )
            environment["AUTO_PACKAGE_TEST_LOG"] = str(log_path)

            with mock.patch.dict(os.environ, environment, clear=True):
                result = auto_package.package_target(options, target, script_path.parent)

            self.assertEqual(result, 0)
            invocation = json.loads(log_path.read_text(encoding="utf-8"))
            self.assertEqual(invocation["arguments"].count("--zip"), 1)
            self.assertEqual(invocation["arguments"].count("--win-sign"), 1)

    def test_signed_non_windows_target_does_not_stage_inputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_path, _, mysqlsh, electron, router = self.prepare_test_tree(root)
            auto_package = self.load_auto_package(script_path)
            options = auto_package.parse_arguments([
                "--mysqlsh", str(mysqlsh),
                "--electron", str(electron),
                "--router", str(router),
                "--zip",
                "--win-sign",
            ])

            with (
                mock.patch.object(auto_package, "replace_electron_tree_from_zip") as extract,
                mock.patch.object(auto_package, "stage_mysqlsh_tree") as stage,
            ):
                with self.assertRaisesRegex(
                    ValueError,
                    "--win-sign can only be used when building on Windows",
                ):
                    auto_package.package_target(options, "linux-x64", script_path.parent)

            extract.assert_not_called()
            stage.assert_not_called()

    def test_main_reports_mysqlsh_preparation_failure(self) -> None:
        auto_package = self.load_auto_package()
        compilation_error = subprocess.CalledProcessError(1, ["mysqlsh"])
        stderr = io.StringIO()
        caught_error: Optional[Exception] = None
        result: Optional[int] = None

        with (
            mock.patch.object(
                auto_package,
                "parse_arguments",
                return_value=mock.sentinel.options,
            ),
            mock.patch.object(
                auto_package,
                "resolve_platform",
                return_value="linux-x64",
            ),
            mock.patch.object(
                auto_package,
                "package_target",
                side_effect=compilation_error,
            ),
            contextlib.redirect_stderr(stderr),
        ):
            try:
                result = auto_package.main([])
            except Exception as error:
                caught_error = error

        self.assertIsNone(caught_error)
        self.assertEqual(result, 1)
        self.assertEqual(stderr.getvalue(), f"ERROR: {compilation_error}\n")
        self.assertNotIn("Traceback", stderr.getvalue())

    def test_invalid_wix_options_do_not_change_staged_runtime(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_path, _, mysqlsh, electron, router = self.prepare_test_tree(root)
            auto_package = self.load_auto_package(script_path)
            wix_file = root / "wix-4.0.0.5512.2.7z"
            wix_file.write_bytes(b"official wix")
            cases = (
                ("win32-x64", "--zip", wix_file, "--installer"),
                ("linux-x64", "--installer", wix_file, "Windows"),
                ("win32-x64", "--installer", root / "missing.7z", "not a file"),
                ("win32-x64", "--installer", root, "not a file"),
            )

            for target, mode, wix, message in cases:
                with self.subTest(target=target, mode=mode, wix=wix):
                    destination = (
                        root / "electron" / "packaging" / "electron" / target
                    )
                    destination.mkdir(parents=True, exist_ok=True)
                    marker = destination / "preserve"
                    marker.touch()
                    options = auto_package.parse_arguments([
                        "--mysqlsh", str(mysqlsh),
                        "--electron", str(electron),
                        "--router", str(router),
                        mode,
                        "--wix-archive", str(wix),
                    ])

                    with self.assertRaisesRegex(ValueError, message):
                        auto_package.package_target(options, target, script_path.parent)

                    self.assertTrue(marker.exists())
                    self.assertFalse(
                        (root / "electron" / "packaging"
                         / "electron-builder-cache").exists()
                    )


if __name__ == "__main__":
    unittest.main()
