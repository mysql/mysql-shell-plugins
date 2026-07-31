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

import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import ModuleType


SCRIPT_DIR = Path(__file__).resolve().parents[2] / "scripts"
SCRIPT_PATH = SCRIPT_DIR / "prepare_mysqlsh_tree.py"
STRIP_SCRIPT_PATH = SCRIPT_DIR / "strip_mysqlsh_tree.sh"
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
        spec.loader.exec_module(module)

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

    def run_helper(self, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT_PATH), *arguments],
            capture_output=True,
            check=False,
            text=True,
        )

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

    def test_cleanup_discovery_is_sorted_and_prunes_nested_candidates(self) -> None:
        helper = self.load_helper()

        with tempfile.TemporaryDirectory() as temporary_dir:
            tree = self.create_shell_tree(Path(temporary_dir) / "mysqlsh")
            plugin_root = tree / "lib" / "mysqlsh" / "plugins"
            nested = plugin_root / "gui_plugin"
            candidates = (
                nested / "tests",
                nested / "docs",
                nested / "examples",
                nested / "node_modules",
                nested / ".vscode",
                nested / "__pycache__",
            )
            for candidate in candidates:
                candidate.mkdir()

            (nested / "tests" / "pytest.ini").write_text("nested", encoding="utf-8")
            cleanup_files = (
                "cspell.json",
                "pytest-coverage.ini",
                "pytest.ini",
                "python.env",
                "run_tests.py",
            )
            for name in cleanup_files:
                (nested / name).write_text(name, encoding="utf-8")

            (nested / "keep.py").write_text("keep", encoding="utf-8")
            found = helper.find_cleanup_candidates(tree)

            self.assertEqual(found, sorted(found, key=lambda path: str(path)))
            self.assertEqual(set(found), set(candidates) | {
                nested / name for name in cleanup_files
            })
            self.assertNotIn(nested / "tests" / "pytest.ini", found)

    def test_cleanup_discovers_python_package_docs_on_all_platforms(self) -> None:
        helper = self.load_helper()

        with tempfile.TemporaryDirectory() as temporary_dir:
            tree = self.create_shell_tree(Path(temporary_dir) / "mysqlsh")
            candidates = (
                tree / "lib" / "mysqlsh" / "lib" / "python3.13"
                / "site-packages" / "docs",
                tree / "lib" / "Python3.13" / "Lib" / "site-packages"
                / "docs",
            )
            for candidate in candidates:
                candidate.mkdir(parents=True)

            found = helper.find_cleanup_candidates(tree)

            self.assertEqual(
                found,
                sorted(candidates, key=lambda path: str(path)),
            )

    def test_cleanup_removes_candidates_and_retains_other_content(self) -> None:
        helper = self.load_helper()

        with tempfile.TemporaryDirectory() as temporary_dir:
            tree = self.create_shell_tree(Path(temporary_dir) / "mysqlsh")
            plugin = tree / "lib" / "mysqlsh" / "plugins" / "gui_plugin"
            tests = plugin / "tests"
            tests.mkdir()
            (tests / "test_plugin.py").write_text("remove", encoding="utf-8")
            pytest_ini = plugin / "pytest.ini"
            pytest_ini.write_text("remove", encoding="utf-8")
            keep = plugin / "keep.py"
            keep.write_text("keep", encoding="utf-8")

            removed = helper.clean_mysqlsh_tree(tree)

            self.assertEqual(
                removed,
                sorted((pytest_ini, tests), key=lambda path: str(path)),
            )
            self.assertFalse(tests.exists())
            self.assertFalse(pytest_ini.exists())
            self.assertEqual(keep.read_text(encoding="utf-8"), "keep")

    def test_clean_cli_supports_dry_run_and_apply(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            tree = self.create_shell_tree(Path(temporary_dir) / "mysqlsh")
            tests = tree / "lib" / "mysqlsh" / "plugins" / "gui_plugin" / "tests"
            tests.mkdir()

            dry_run = self.run_helper("clean", str(tree))
            self.assertEqual(dry_run.returncode, 0, dry_run.stderr)
            self.assertIn("Mode: dry-run", dry_run.stdout)
            self.assertIn(str(tests), dry_run.stdout)
            self.assertTrue(tests.is_dir())

            apply = self.run_helper("clean", "--apply", str(tree))
            self.assertEqual(apply.returncode, 0, apply.stderr)
            self.assertIn("Mode: apply", apply.stdout)
            self.assertFalse(tests.exists())

    def test_stage_clean_cli_stages_cleaned_tree(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            source = self.create_shell_tree(root / "source")
            tests = source / "lib" / "mysqlsh" / "plugins" / "gui_plugin" / "tests"
            tests.mkdir()
            destination = root / "staging" / "linux-x64"

            result = self.run_helper(
                "stage", "--clean", str(source), str(destination)
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue((destination / "bin" / "mysqlsh.exe").is_file())
            self.assertFalse(
                (destination / "lib" / "mysqlsh" / "plugins" / "gui_plugin"
                 / "tests").exists()
            )

    def test_cli_reports_invalid_tree(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            source = Path(temporary_dir) / "invalid"
            source.mkdir()
            destination = Path(temporary_dir) / "staging"

            result = self.run_helper("stage", str(source), str(destination))

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("ERROR:", result.stderr)
            self.assertIn(str(source / "bin"), result.stderr)

    def test_strip_wrapper_preserves_dry_run_and_apply_interface(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            tree = self.create_shell_tree(Path(temporary_dir) / "mysqlsh")
            tests = tree / "lib" / "mysqlsh" / "plugins" / "gui_plugin" / "tests"
            tests.mkdir()

            dry_run = subprocess.run(
                ["bash", str(STRIP_SCRIPT_PATH), str(tree)],
                capture_output=True,
                check=False,
                text=True,
            )
            self.assertEqual(dry_run.returncode, 0, dry_run.stderr)
            self.assertIn("Mode: dry-run", dry_run.stdout)
            self.assertTrue(tests.is_dir())

            apply = subprocess.run(
                ["bash", str(STRIP_SCRIPT_PATH), "--apply", str(tree)],
                capture_output=True,
                check=False,
                text=True,
            )
            self.assertEqual(apply.returncode, 0, apply.stderr)
            self.assertIn("Mode: apply", apply.stdout)
            self.assertFalse(tests.exists())

    def test_package_wrapper_stages_and_cleans_unpacked_tree(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            electron_dir = root / "gui" / "electron"
            scripts_dir = electron_dir / "scripts"
            scripts_dir.mkdir(parents=True)
            for script in (
                PACKAGE_SCRIPT_PATH,
                SCRIPT_PATH,
                STRIP_SCRIPT_PATH,
            ):
                shutil.copy2(script, scripts_dir / script.name)

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
            (electron_dir / "packaging" / "electron" / "linux-x64").mkdir(
                parents=True
            )

            fake_bin = root / "bin"
            fake_bin.mkdir()
            log_path = root / "node.json"
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
            environment["PACKAGE_WRAPPER_TEST_LOG"] = str(log_path)

            result = subprocess.run(
                [
                    "bash",
                    str(scripts_dir / PACKAGE_SCRIPT_PATH.name),
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
            self.assertFalse(
                (staging / "lib" / "mysqlsh" / "plugins" / "gui_plugin"
                 / "tests").exists()
            )
            invocation = json.loads(log_path.read_text(encoding="utf-8"))
            self.assertEqual(invocation["cwd"], str(electron_dir))
            self.assertIn("--targets=linux-x64", invocation["arguments"])


if __name__ == "__main__":
    unittest.main()
