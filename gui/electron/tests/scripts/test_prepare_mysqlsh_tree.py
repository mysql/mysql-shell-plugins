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
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import ModuleType
from unittest import mock


SCRIPT_DIR = Path(__file__).resolve().parents[2] / "scripts"
SCRIPT_PATH = SCRIPT_DIR / "prepare_mysqlsh_tree.py"
PACKAGE_SCRIPT_PATH = SCRIPT_DIR / "package_desktop.sh"


class PrepareMysqlshTreeTest(unittest.TestCase):

    def load_helper(self) -> ModuleType:
        if not SCRIPT_PATH.is_file():
            self.fail(f"Missing MySQL Shell preparation helper: {SCRIPT_PATH}")

        spec = importlib.util.spec_from_file_location(
            "prepare_mysqlsh_tree", SCRIPT_PATH
        )
        if spec is None or spec.loader is None:
            self.fail(f"Could not load MySQL Shell preparation helper: {SCRIPT_PATH}")

        module = importlib.util.module_from_spec(spec)
        sys.path.insert(0, str(SCRIPT_DIR))
        try:
            spec.loader.exec_module(module)
        finally:
            sys.path.pop(0)

        return module

    def create_shell_tree(self, root: Path, with_libexec: bool = False) -> Path:
        (root / "bin").mkdir(parents=True)
        (root / "bin" / "mysqlsh.exe").write_bytes(b"mysqlsh")
        plugin_root = root / "lib" / "mysqlsh" / "plugins" / "gui_plugin"
        plugin_root.mkdir(parents=True)
        (plugin_root / "init.py").write_text("plugin = True\n", encoding="utf-8")
        (root / "share").mkdir()
        (root / "share" / "mysqlsh.txt").write_text("share\n", encoding="utf-8")

        if with_libexec:
            (root / "libexec").mkdir()
            (root / "libexec" / "helper.exe").write_bytes(b"helper")

        return root

    def add_oci_installation(self, tree: Path) -> Path:
        site_packages = tree / "runtime" / "python3.13" / "site-packages"
        (site_packages / "oci").mkdir(parents=True)
        (site_packages / "oci-2.177.0.dist-info").mkdir()
        return site_packages

    def run_helper(self, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT_PATH), *arguments],
            capture_output=True,
            check=False,
            text=True,
        )

    def prepare_package_wrapper_fixture(
        self, root: Path
    ) -> tuple[Path, Path, Path, Path, dict[str, str]]:
        electron_dir = root / "gui" / "electron"
        scripts_dir = electron_dir / "scripts"
        scripts_dir.mkdir(parents=True)
        shutil.copy2(PACKAGE_SCRIPT_PATH, scripts_dir / PACKAGE_SCRIPT_PATH.name)

        event_log = root / "package-wrapper-events.jsonl"
        prepare_script = scripts_dir / SCRIPT_PATH.name
        prepare_script.write_text(
            "#!/usr/bin/env python3\n"
            "import json\n"
            "import os\n"
            "import shutil\n"
            "import sys\n"
            "from pathlib import Path\n"
            "arguments = sys.argv[1:]\n"
            "event = {'tool': 'prepare', 'arguments': arguments}\n"
            "with Path(os.environ['PACKAGE_WRAPPER_EVENT_LOG']).open(\n"
            "    'a', encoding='utf-8'\n"
            ") as output:\n"
            "    output.write(json.dumps(event) + '\\n')\n"
            "if arguments[0] == 'stage':\n"
            "    source = Path(arguments[-2])\n"
            "    destination = Path(arguments[-1])\n"
            "    shutil.copytree(source, destination, symlinks=True)\n"
            "elif arguments[0] == 'optimize-oci':\n"
            "    tree = Path(arguments[1])\n"
            "    site_packages = (\n"
            "        tree / 'lib/mysqlsh/lib/python3.13/site-packages'\n"
            "    )\n"
            "    oci = site_packages / 'oci'\n"
            "    if not oci.is_dir():\n"
            "        raise SystemExit(8)\n"
            "    shutil.rmtree(oci)\n"
            "    (site_packages / 'oci.zip').write_bytes(b'committed zip')\n"
            "    (site_packages / 'oci.pth').write_bytes(b'oci.zip\\n')\n"
            "    failure_marker_name = os.environ.get(\n"
            "        'PACKAGE_WRAPPER_OPTIMIZE_FAILURE_MARKER'\n"
            "    )\n"
            "    if failure_marker_name is not None:\n"
            "        failure_marker = Path(failure_marker_name)\n"
            "        if not failure_marker.exists():\n"
            "            failure_marker.write_text(\n"
            "                'failed after commit', encoding='utf-8'\n"
            "            )\n"
            "            raise SystemExit(9)\n",
            encoding="utf-8",
        )

        for plugin in (
            root / "gui" / "backend" / "gui_plugin",
            root / "mds_plugin",
            root / "mrs_plugin",
            root / "msm_plugin",
            root / "util_plugin",
        ):
            plugin.mkdir(parents=True)

        source = self.create_shell_tree(root / "mysqlsh")
        source_tests = (
            source / "lib" / "mysqlsh" / "plugins" / "gui_plugin" / "tests"
        )
        source_tests.mkdir()
        oci = (
            source / "lib" / "mysqlsh" / "lib" / "python3.13"
            / "site-packages" / "oci"
        )
        oci.mkdir(parents=True)
        (oci / "__init__.py").write_text("oci = True\n", encoding="utf-8")

        fake_bin = root / "bin"
        fake_bin.mkdir()
        node_log = root / "node.json"
        fake_node = fake_bin / "node"
        fake_node.write_text(
            "#!/usr/bin/env python3\n"
            "import json\n"
            "import os\n"
            "import sys\n"
            "from pathlib import Path\n"
            "Path(os.environ['PACKAGE_WRAPPER_TEST_LOG']).write_text(\n"
            "    json.dumps({'arguments': sys.argv[1:], 'cwd': os.getcwd()}),\n"
            "    encoding='utf-8')\n",
            encoding="utf-8",
        )
        fake_node.chmod(0o755)
        environment = os.environ.copy()
        environment["PATH"] = os.pathsep.join(
            (str(fake_bin), environment["PATH"])
        )
        environment["ELECTRON_VERSION"] = "43.2.0"
        environment["PACKAGE_WRAPPER_EVENT_LOG"] = str(event_log)
        environment["PACKAGE_WRAPPER_TEST_LOG"] = str(node_log)

        return electron_dir, source, event_log, node_log, environment

    def read_package_wrapper_events(
        self, event_log: Path
    ) -> list[dict[str, object]]:
        return [
            json.loads(line)
            for line in event_log.read_text(encoding="utf-8").splitlines()
        ]

    def test_cli_starts_with_python_3_6(self) -> None:
        python = shutil.which("python3.6")
        if python is None:
            self.skipTest("python3.6 is not available")

        result = subprocess.run(
            [python, str(SCRIPT_PATH), "--help"],
            capture_output=True,
            check=False,
            text=True,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Prepare an unpacked MySQL Shell tree", result.stdout)

    def test_finds_oci_site_packages_from_distribution_metadata(self) -> None:
        helper = self.load_helper()
        with tempfile.TemporaryDirectory() as temporary_dir:
            tree = self.create_shell_tree(Path(temporary_dir) / "mysqlsh")
            site_packages = self.add_oci_installation(tree)
            self.assertEqual(helper.find_oci_site_packages(tree), site_packages)

    def test_rejects_missing_oci_metadata(self) -> None:
        helper = self.load_helper()
        with tempfile.TemporaryDirectory() as temporary_dir:
            tree = self.create_shell_tree(Path(temporary_dir) / "mysqlsh")
            with self.assertRaisesRegex(ValueError, "OCI SDK metadata"):
                helper.find_oci_site_packages(tree)

    def test_rejects_ambiguous_oci_metadata(self) -> None:
        helper = self.load_helper()
        with tempfile.TemporaryDirectory() as temporary_dir:
            tree = self.create_shell_tree(Path(temporary_dir) / "mysqlsh")
            self.add_oci_installation(tree)
            second = tree / "other" / "site-packages"
            (second / "oci-2.176.0.dist-info").mkdir(parents=True)
            with self.assertRaisesRegex(ValueError, "multiple OCI SDK metadata"):
                helper.find_oci_site_packages(tree)

    def test_rejects_symlinked_oci_metadata(self) -> None:
        helper = self.load_helper()
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            tree = self.create_shell_tree(root / "mysqlsh")
            site_packages = self.add_oci_installation(tree)
            metadata = site_packages / "oci-2.177.0.dist-info"
            external = root / "external-oci.dist-info"
            metadata.replace(external)
            metadata.symlink_to(external, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "OCI SDK metadata"):
                helper.find_oci_site_packages(tree)

    def test_rejects_mysqlsh_executable_symlink_escaping_tree(self) -> None:
        helper = self.load_helper()
        with tempfile.TemporaryDirectory() as temporary_dir:
            tree = self.create_shell_tree(Path(temporary_dir) / "mysqlsh")
            executable = tree / "bin" / "mysqlsh.exe"
            external = tree.parent / "external-mysqlsh.exe"
            executable.replace(external)
            executable.symlink_to(external)
            with self.assertRaisesRegex(ValueError, "MySQL Shell executable"):
                helper.find_mysqlsh_executable(tree)

    def test_oci_preparation_uses_staged_mysqlsh(self) -> None:
        helper = self.load_helper()
        with tempfile.TemporaryDirectory() as temporary_dir:
            tree = self.create_shell_tree(Path(temporary_dir) / "mysqlsh")
            site_packages = self.add_oci_installation(tree)

            def record_command(
                command: object, **keywords: object
            ) -> subprocess.CompletedProcess[str]:
                environment = keywords["env"]
                self.assertIsInstance(environment, dict)
                self.assertTrue(Path(environment["MYSQLSH_USER_CONFIG_HOME"]).is_dir())
                return subprocess.CompletedProcess(
                    args=[],
                    returncode=0,
                    stdout="",
                )

            with mock.patch.object(helper.subprocess, "run", side_effect=record_command) as run:
                helper.prepare_oci_sdk(tree)

            self.assertEqual(run.call_args.args[0], [
                str(tree / "bin/mysqlsh.exe"),
                "--disable-builtin-plugins",
                "--py",
                "-f",
                str(helper.PREPARE_OCI_SDK_SCRIPT),
                str(site_packages),
            ])
            self.assertFalse(run.call_args.kwargs["check"])
            self.assertEqual(run.call_args.kwargs["creationflags"], 0)

    def test_oci_preparation_uses_python_36_subprocess_arguments(self) -> None:
        helper = self.load_helper()
        with tempfile.TemporaryDirectory() as temporary_dir:
            tree = self.create_shell_tree(Path(temporary_dir) / "mysqlsh")
            self.add_oci_installation(tree)
            output = io.StringIO()

            def python_36_run(
                command,
                *,
                check,
                creationflags,
                env,
                stdout,
                stderr,
                universal_newlines,
                encoding,
                errors,
            ):
                return subprocess.CompletedProcess(
                    args=command,
                    returncode=0,
                    stdout="Preparing OCI SDK\n",
                )

            with mock.patch.object(
                helper.subprocess, "run", side_effect=python_36_run
            ), contextlib.redirect_stdout(output):
                helper.prepare_oci_sdk(tree)

            self.assertEqual(output.getvalue(), "Preparing OCI SDK\n")

    def test_oci_preparation_uses_extended_path_and_no_console_on_windows(self) -> None:
        helper = self.load_helper()
        with tempfile.TemporaryDirectory() as temporary_dir:
            tree = self.create_shell_tree(Path(temporary_dir) / "mysqlsh")
            site_packages = self.add_oci_installation(tree)
            output = io.StringIO()
            completed = subprocess.CompletedProcess(
                args=[],
                returncode=0,
                stdout="Preparing OCI SDK\n",
            )
            with mock.patch.object(helper.os, "name", "nt"), mock.patch.object(
                helper.subprocess, "CREATE_NO_WINDOW", 0x08000000, create=True
            ), mock.patch.object(
                helper.subprocess, "run", return_value=completed
            ) as run, contextlib.redirect_stdout(output):
                helper.prepare_oci_sdk(tree)
            self.assertEqual(run.call_args.args[0][-1], "\\\\?\\" + str(site_packages.resolve()))
            self.assertEqual(run.call_args.kwargs["creationflags"], 0x08000000)
            self.assertIs(run.call_args.kwargs.get("stdout"), subprocess.PIPE)
            self.assertIs(run.call_args.kwargs.get("stderr"), subprocess.STDOUT)
            self.assertEqual(output.getvalue(), "Preparing OCI SDK\n")

    def test_stage_copies_required_tree_and_optional_libexec(self) -> None:
        helper = self.load_helper()

        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            source = self.create_shell_tree(root / "source", with_libexec=True)
            destination = root / "staging" / "win32-x64"

            helper.stage_mysqlsh_tree(source, destination)

            self.assertEqual(
                (destination / "bin" / "mysqlsh.exe").read_bytes(), b"mysqlsh"
            )
            self.assertTrue((destination / "libexec" / "helper.exe").is_file())
            self.assertEqual(
                (destination / "lib" / "mysqlsh" / "plugins" / "gui_plugin"
                 / "init.py").read_text(encoding="utf-8"),
                "plugin = True\n",
            )

    def test_stage_preserves_symlinks(self) -> None:
        helper = self.load_helper()

        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            source = self.create_shell_tree(root / "source")
            link = source / "bin" / "mysqlsh-link"
            link.symlink_to("mysqlsh.exe")
            destination = root / "staging" / "linux-x64"

            helper.stage_mysqlsh_tree(source, destination)

            staged_link = destination / "bin" / "mysqlsh-link"
            self.assertTrue(staged_link.is_symlink())
            self.assertEqual(staged_link.readlink(), Path("mysqlsh.exe"))

    def test_stage_preserves_development_content(self) -> None:
        helper = self.load_helper()

        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            source = self.create_shell_tree(root / "source")
            plugin_test = (
                source / "lib" / "mysqlsh" / "plugins" / "gui_plugin"
                / "tests" / "test_plugin.py"
            )
            plugin_test.parent.mkdir()
            plugin_test.write_text("keep", encoding="utf-8")
            python_test = (
                source / "lib" / "mysqlsh" / "lib" / "python3.13"
                / "test" / "test_os.py"
            )
            python_test.parent.mkdir(parents=True)
            python_test.write_text("keep", encoding="utf-8")
            destination = root / "staging" / "linux-x64"

            helper.stage_mysqlsh_tree(source, destination)

            self.assertTrue(
                (destination / plugin_test.relative_to(source)).is_file()
            )
            self.assertTrue(
                (destination / python_test.relative_to(source)).is_file()
            )

    def test_stage_oci_optimization_is_opt_in(self) -> None:
        helper = self.load_helper()

        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            source = self.create_shell_tree(root / "source")
            destination = root / "staging" / "linux-x64"

            with mock.patch.object(
                helper, "prepare_oci_sdk", create=True
            ) as prepare_oci:
                helper.stage_mysqlsh_tree(source, destination)
                prepare_oci.assert_not_called()

                def mark_prepared(staged_tree: Path) -> None:
                    (staged_tree / "oci-prepared").write_text(
                        "prepared", encoding="utf-8"
                    )

                prepare_oci.side_effect = mark_prepared
                helper.stage_mysqlsh_tree(source, destination, optimize_oci=True)

            self.assertEqual(
                (destination / "oci-prepared").read_text(encoding="utf-8"),
                "prepared",
            )
            self.assertEqual(prepare_oci.call_count, 1)

    def test_oci_optimization_failure_keeps_existing_destination(self) -> None:
        helper = self.load_helper()

        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            source = self.create_shell_tree(root / "source")
            destination = root / "staging" / "linux-x64"
            stale = destination / "stale" / "saved.bin"
            stale.parent.mkdir(parents=True)
            stale.write_bytes(b"preserve this destination")
            before = {
                path.relative_to(destination): path.read_bytes()
                for path in destination.rglob("*")
                if path.is_file()
            }

            with mock.patch.object(
                helper,
                "prepare_oci_sdk",
                create=True,
                side_effect=RuntimeError("compile failed"),
            ):
                with self.assertRaisesRegex(RuntimeError, "compile failed"):
                    helper.stage_mysqlsh_tree(
                        source, destination, optimize_oci=True
                    )

            after = {
                path.relative_to(destination): path.read_bytes()
                for path in destination.rglob("*")
                if path.is_file()
            }
            self.assertEqual(after, before)

    def test_validation_reports_each_missing_required_path(self) -> None:
        helper = self.load_helper()

        for relative_path in (
            Path("bin"),
            Path("lib"),
            Path("share"),
            Path("lib/mysqlsh/plugins"),
        ):
            with self.subTest(relative_path=relative_path):
                with tempfile.TemporaryDirectory() as temporary_dir:
                    source = self.create_shell_tree(Path(temporary_dir) / "source")
                    missing = source / relative_path
                    if missing.is_dir():
                        shutil.rmtree(missing)

                    with self.assertRaisesRegex(
                        ValueError, str(missing).replace("\\", "\\\\")
                    ):
                        helper.validate_mysqlsh_tree(source)

    def test_validation_failure_keeps_existing_destination(self) -> None:
        helper = self.load_helper()

        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            source = self.create_shell_tree(root / "source")
            shutil.rmtree(source / "share")
            destination = root / "staging" / "linux-x64"
            destination.mkdir(parents=True)
            stale = destination / "stale"
            stale.write_text("keep", encoding="utf-8")

            with self.assertRaises(ValueError):
                helper.stage_mysqlsh_tree(source, destination)

            self.assertEqual(stale.read_text(encoding="utf-8"), "keep")

    def test_stage_cli_rejects_cleanup(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            source = self.create_shell_tree(root / "source")
            destination = root / "staging" / "linux-x64"

            result = self.run_helper(
                "stage", "--clean", str(source), str(destination)
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("unrecognized arguments: --clean", result.stderr)
            self.assertFalse(destination.exists())

    def test_stage_cli_supports_oci_optimization(self) -> None:
        helper = self.load_helper()

        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            source = self.create_shell_tree(root / "source")
            destination = root / "staging" / "linux-x64"

            with mock.patch.object(
                helper, "prepare_oci_sdk", create=True
            ) as prepare_oci:
                self.assertEqual(
                    helper.main(
                        ["stage", "--optimize-oci", str(source), str(destination)]
                    ),
                    0,
                )

            prepare_oci.assert_called_once()
            self.assertTrue((destination / "bin" / "mysqlsh.exe").is_file())

    def test_stage_cli_reports_oci_compilation_failure(self) -> None:
        helper = self.load_helper()

        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            source = self.create_shell_tree(root / "source")
            destination = root / "staging" / "linux-x64"
            compilation_error = subprocess.CalledProcessError(1, ["mysqlsh"])
            stderr = io.StringIO()

            with mock.patch.object(
                helper, "prepare_oci_sdk", side_effect=compilation_error
            ):
                with contextlib.redirect_stderr(stderr):
                    self.assertEqual(
                        helper.main(
                            [
                                "stage",
                                "--optimize-oci",
                                str(source),
                                str(destination),
                            ]
                        ),
                        1,
                    )

            self.assertEqual(stderr.getvalue(), f"ERROR: {compilation_error}\n")
            self.assertNotIn("Traceback", stderr.getvalue())

    def test_optimize_oci_cli_prepares_resolved_tree(self) -> None:
        helper = self.load_helper()

        with tempfile.TemporaryDirectory() as temporary_dir:
            tree = Path(temporary_dir) / "mysqlsh"
            tree.mkdir()

            with mock.patch.object(
                helper, "prepare_oci_sdk", create=True
            ) as prepare_oci:
                self.assertEqual(helper.main(["optimize-oci", str(tree)]), 0)

            prepare_oci.assert_called_once_with(tree.resolve())

    def test_optimize_oci_cli_reports_compilation_failure(self) -> None:
        helper = self.load_helper()

        with tempfile.TemporaryDirectory() as temporary_dir:
            tree = Path(temporary_dir) / "mysqlsh"
            tree.mkdir()
            compilation_error = subprocess.CalledProcessError(1, ["mysqlsh"])
            stderr = io.StringIO()

            with mock.patch.object(
                helper, "prepare_oci_sdk", side_effect=compilation_error
            ):
                with contextlib.redirect_stderr(stderr):
                    self.assertEqual(
                        helper.main(["optimize-oci", str(tree)]),
                        1,
                    )

            self.assertEqual(stderr.getvalue(), f"ERROR: {compilation_error}\n")
            self.assertNotIn("Traceback", stderr.getvalue())

    def test_cli_reports_invalid_tree(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            source = Path(temporary_dir) / "invalid"
            source.mkdir()
            destination = Path(temporary_dir) / "staging"

            result = self.run_helper("stage", str(source), str(destination))

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("ERROR:", result.stderr)
            self.assertIn(str(source / "bin"), result.stderr)

    def test_package_wrapper_optimizes_final_payloads(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            electron_dir, source, event_log, node_log, environment = (
                self.prepare_package_wrapper_fixture(root)
            )
            (electron_dir / "packaging" / "electron" / "linux-x64").mkdir(
                parents=True
            )

            result = subprocess.run(
                [
                    "bash",
                    str(electron_dir / "scripts" / PACKAGE_SCRIPT_PATH.name),
                    "linux-x64",
                    "--mysqlsh-tree",
                    str(source),
                ],
                capture_output=True,
                check=False,
                env=environment,
                text=True,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            staging = (
                electron_dir / "packaging" / "mysql-shell-staging" / "linux-x64"
            )
            for required in ("bin", "lib", "share"):
                self.assertTrue((staging / required).is_dir())
            self.assertTrue(
                (staging / "lib" / "mysqlsh" / "plugins" / "gui_plugin"
                 / "tests").exists()
            )
            self.assertEqual(
                self.read_package_wrapper_events(event_log),
                [
                    {
                        "tool": "prepare",
                        "arguments": [
                            "stage",
                            "--optimize-oci",
                            str(source),
                            str(staging),
                        ],
                    }
                ],
            )
            invocation = json.loads(node_log.read_text(encoding="utf-8"))
            self.assertEqual(invocation["cwd"], str(electron_dir))
            self.assertIn("--targets=linux-x64", invocation["arguments"])

        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            electron_dir, source, event_log, _, environment = (
                self.prepare_package_wrapper_fixture(root)
            )
            cache = electron_dir / "packaging" / "mysql-shell"
            cache.mkdir(parents=True)
            shutil.make_archive(
                str(cache / "linux-x64"),
                "gztar",
                root_dir=source.parent,
                base_dir=source.name,
            )
            staging = (
                electron_dir / "packaging" / "mysql-shell-staging" / "linux-x64"
            )

            first_result = subprocess.run(
                [
                    "bash",
                    str(electron_dir / "scripts" / PACKAGE_SCRIPT_PATH.name),
                    "linux-x64",
                ],
                capture_output=True,
                check=False,
                env=environment,
                text=True,
            )
            stale = staging / "stale-optimized-cache"
            stale.write_text("replace me", encoding="utf-8")
            second_result = subprocess.run(
                [
                    "bash",
                    str(electron_dir / "scripts" / PACKAGE_SCRIPT_PATH.name),
                    "linux-x64",
                ],
                capture_output=True,
                check=False,
                env=environment,
                text=True,
            )

            self.assertEqual(first_result.returncode, 0, first_result.stderr)
            self.assertEqual(second_result.returncode, 0, second_result.stderr)
            self.assertFalse(stale.exists())
            self.assertIn(
                "Extracting MySQL Shell archive for linux-x64",
                second_result.stdout,
            )
            self.assertNotIn(
                "Using cached MySQL Shell staging for linux-x64",
                second_result.stdout,
            )
            self.assertEqual(
                self.read_package_wrapper_events(event_log),
                [
                    {
                        "tool": "prepare",
                        "arguments": ["optimize-oci", str(staging)],
                    },
                    {
                        "tool": "prepare",
                        "arguments": ["optimize-oci", str(staging)],
                    },
                ],
            )
            self.assertFalse(
                (staging / ".mysql-shell-staging-source").exists()
            )

    def test_package_wrapper_recovers_from_late_optimization_failure(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            electron_dir, source, event_log, node_log, environment = (
                self.prepare_package_wrapper_fixture(root)
            )
            cache = electron_dir / "packaging" / "mysql-shell"
            cache.mkdir(parents=True)
            shutil.make_archive(
                str(cache / "linux-x64"),
                "gztar",
                root_dir=source.parent,
                base_dir=source.name,
            )
            staging = (
                electron_dir / "packaging" / "mysql-shell-staging" / "linux-x64"
            )
            failure_marker = root / "optimization-failed-once"
            environment["PACKAGE_WRAPPER_OPTIMIZE_FAILURE_MARKER"] = str(
                failure_marker
            )
            command = [
                "bash",
                str(electron_dir / "scripts" / PACKAGE_SCRIPT_PATH.name),
                "linux-x64",
            ]

            first_result = subprocess.run(
                command,
                capture_output=True,
                check=False,
                env=environment,
                text=True,
            )
            node_ran_after_failure = node_log.exists()
            marker_existed_after_failure = (
                staging / ".mysql-shell-staging-source"
            ).exists()
            site_packages = (
                staging / "lib" / "mysqlsh" / "lib" / "python3.13"
                / "site-packages"
            )
            oci_existed_after_failure = (site_packages / "oci").exists()
            zip_existed_after_failure = (site_packages / "oci.zip").is_file()
            pth_after_failure = (site_packages / "oci.pth").read_bytes()
            second_result = subprocess.run(
                command,
                capture_output=True,
                check=False,
                env=environment,
                text=True,
            )

            self.assertEqual(first_result.returncode, 9, first_result.stderr)
            self.assertFalse(node_ran_after_failure)
            self.assertFalse(oci_existed_after_failure)
            self.assertTrue(zip_existed_after_failure)
            self.assertEqual(pth_after_failure, b"oci.zip\n")
            self.assertEqual(second_result.returncode, 0, second_result.stderr)
            self.assertFalse(marker_existed_after_failure)
            self.assertIn(
                "Extracting MySQL Shell archive for linux-x64",
                second_result.stdout,
            )
            self.assertNotIn(
                "Using cached MySQL Shell staging for linux-x64",
                second_result.stdout,
            )
            self.assertTrue(node_log.is_file())
            self.assertEqual(
                self.read_package_wrapper_events(event_log),
                [
                    {
                        "tool": "prepare",
                        "arguments": ["optimize-oci", str(staging)],
                    },
                    {
                        "tool": "prepare",
                        "arguments": ["optimize-oci", str(staging)],
                    },
                ],
            )

    def test_package_wrapper_stage_only_does_not_optimize_oci(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            electron_dir, source, event_log, node_log, environment = (
                self.prepare_package_wrapper_fixture(root)
            )
            staging = (
                electron_dir / "packaging" / "mysql-shell-staging" / "linux-x64"
            )

            result = subprocess.run(
                [
                    "bash",
                    str(electron_dir / "scripts" / PACKAGE_SCRIPT_PATH.name),
                    "--mysqlsh-tree",
                    str(source),
                ],
                capture_output=True,
                check=False,
                env=environment,
                text=True,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            events = self.read_package_wrapper_events(event_log)
            self.assertEqual(
                events,
                [
                    {
                        "tool": "prepare",
                        "arguments": [
                            "stage",
                            str(source),
                            str(staging),
                        ],
                    }
                ],
            )
            self.assertFalse(node_log.exists())
            self.assertNotIn("--optimize-oci", events[0]["arguments"])
            self.assertNotIn("optimize-oci", events[0]["arguments"])
            self.assertTrue(
                (staging / "lib" / "mysqlsh" / "plugins" / "gui_plugin"
                 / "tests").is_dir()
            )
            self.assertEqual(
                (staging / ".mysql-shell-staging-source").read_text(
                    encoding="utf-8"
                ),
                f"tree:{source}\n",
            )


if __name__ == "__main__":
    unittest.main()
