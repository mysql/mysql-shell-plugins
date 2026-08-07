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
import os
import py_compile
import shutil
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from types import ModuleType
from unittest import mock


SCRIPT_PATH = Path(__file__).resolve().parents[2] / "scripts" / "prepare_oci_sdk.py"


class PrepareOciSdkTest(unittest.TestCase):

    def load_helper(self) -> ModuleType:
        if not SCRIPT_PATH.is_file():
            self.fail(f"Missing OCI SDK preparation helper: {SCRIPT_PATH}")

        spec = importlib.util.spec_from_file_location("prepare_oci_sdk", SCRIPT_PATH)
        if spec is None or spec.loader is None:
            self.fail(f"Could not load OCI SDK preparation helper: {SCRIPT_PATH}")

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        return module

    def create_shell_tree(self) -> Path:
        root = Path(self.temporary_dir.name) / "mysqlsh"
        (root / "bin").mkdir(parents=True)
        (root / "bin" / "mysqlsh").write_bytes(b"mysqlsh")
        (root / "lib" / "mysqlsh" / "plugins").mkdir(parents=True)
        oci_directory = (
            root / "lib/mysqlsh/lib/python3.13/site-packages/oci"
        )
        oci_directory.mkdir(parents=True)
        (oci_directory / "__init__.py").write_text("\n", encoding="utf-8")
        (oci_directory / "service.py").write_text("VALUE = 1\n", encoding="utf-8")

        return root

    def compile_bytecode(self, tree: Path, oci_directory: Path) -> None:
        del tree
        for source in oci_directory.rglob("*.py"):
            py_compile.compile(
                str(source),
                cfile=str(source.with_suffix(".pyc")),
                doraise=True,
            )

    def assert_original_directory_is_retained(self, tree: Path) -> None:
        site_packages = tree / "lib/mysqlsh/lib/python3.13/site-packages"
        self.assertTrue((site_packages / "oci").is_dir())
        self.assertFalse((site_packages / "oci.zip").exists())
        self.assertFalse((site_packages / "oci.pth").exists())

    def setUp(self) -> None:
        self.temporary_dir = tempfile.TemporaryDirectory()

    def tearDown(self) -> None:
        self.temporary_dir.cleanup()

    def test_finds_single_oci_directory_and_mysqlsh_executable(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()

        self.assertEqual(
            helper.find_oci_directory(tree),
            tree / "lib/mysqlsh/lib/python3.13/site-packages/oci",
        )
        self.assertEqual(helper.find_mysqlsh_executable(tree), tree / "bin/mysqlsh")

    def test_finds_windows_oci_directory(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        oci_directory = helper.find_oci_directory(tree)
        windows_oci_directory = (
            tree / "lib" / "Python3.13" / "Lib" / "site-packages" / "oci"
        )
        windows_oci_directory.parent.mkdir(parents=True)
        oci_directory.replace(windows_oci_directory)

        try:
            found = helper.find_oci_directory(tree)
        except ValueError:
            found = None

        self.assertEqual(found, windows_oci_directory)

    def test_rejects_missing_or_ambiguous_oci_directory(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        shutil.rmtree(helper.find_oci_directory(tree))

        with self.assertRaisesRegex(ValueError, "OCI SDK directory"):
            helper.find_oci_directory(tree)

        first = tree / "lib/mysqlsh/lib/python3.12/site-packages/oci"
        second = tree / "lib/mysqlsh/lib/python3.13/site-packages/oci"
        first.mkdir(parents=True)
        second.mkdir(parents=True)

        with self.assertRaisesRegex(ValueError, "multiple OCI SDK directories"):
            helper.find_oci_directory(tree)

    def test_rejects_symlinked_oci_directory_before_mutating_sdk(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        oci_directory = helper.find_oci_directory(tree)
        external_oci_directory = tree.parent / "external-oci"
        oci_directory.replace(external_oci_directory)
        oci_directory.symlink_to(external_oci_directory, target_is_directory=True)

        with mock.patch.object(helper, "_compile_bytecode"):
            with self.assertRaisesRegex(ValueError, "OCI SDK directory"):
                helper.prepare_oci_sdk(tree)

        self.assertTrue(oci_directory.is_symlink())
        self.assertEqual(
            sorted(path.name for path in external_oci_directory.iterdir()),
            ["__init__.py", "service.py"],
        )
        self.assertFalse((oci_directory.parent / "oci.zip").exists())
        self.assertFalse((oci_directory.parent / "oci.pth").exists())

    def test_rejects_oci_directory_escaping_through_python_symlink(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        python_directory = (
            tree / "lib/mysqlsh/lib/python3.13"
        )
        external_python_directory = tree.parent / "external-python"
        python_directory.replace(external_python_directory)
        python_directory.symlink_to(
            external_python_directory,
            target_is_directory=True,
        )
        external_oci_directory = (
            external_python_directory / "site-packages/oci"
        )

        with mock.patch.object(helper, "_compile_bytecode"):
            with self.assertRaisesRegex(ValueError, "OCI SDK directory"):
                helper.prepare_oci_sdk(tree)

        self.assertTrue(python_directory.is_symlink())
        self.assertEqual(
            sorted(path.name for path in external_oci_directory.iterdir()),
            ["__init__.py", "service.py"],
        )
        self.assertFalse((external_oci_directory.parent / "oci.zip").exists())
        self.assertFalse((external_oci_directory.parent / "oci.pth").exists())

    def test_rejects_mysqlsh_executable_symlink_escaping_tree(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        oci_directory = helper.find_oci_directory(tree)
        executable = tree / "bin/mysqlsh"
        external_executable = tree.parent / "external-mysqlsh"
        executable.replace(external_executable)
        executable.symlink_to(external_executable)

        with mock.patch.object(helper.subprocess, "run") as run:
            with self.assertRaisesRegex(ValueError, "MySQL Shell executable"):
                helper._compile_bytecode(tree, oci_directory)

        run.assert_not_called()
        self.assertEqual(external_executable.read_bytes(), b"mysqlsh")

    def test_rejects_mysqlsh_executable_escaping_through_bin_symlink(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        oci_directory = helper.find_oci_directory(tree)
        bin_directory = tree / "bin"
        external_bin_directory = tree.parent / "external-bin"
        bin_directory.replace(external_bin_directory)
        bin_directory.symlink_to(external_bin_directory, target_is_directory=True)
        external_executable = external_bin_directory / "mysqlsh"

        with mock.patch.object(helper.subprocess, "run") as run:
            with self.assertRaisesRegex(ValueError, "MySQL Shell executable"):
                helper._compile_bytecode(tree, oci_directory)

        run.assert_not_called()
        self.assertEqual(external_executable.read_bytes(), b"mysqlsh")

    def test_prepares_oci_sdk_as_a_verified_zip(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        oci_directory = helper.find_oci_directory(tree)
        site_packages = oci_directory.parent

        with mock.patch.object(
            helper, "_compile_bytecode", self.compile_bytecode
        ):
            helper.prepare_oci_sdk(tree)

        self.assertFalse(oci_directory.exists())
        self.assertEqual(
            (site_packages / "oci.pth").read_bytes(), b"oci.zip\n"
        )

        with zipfile.ZipFile(site_packages / "oci.zip") as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(
                set(archive.namelist()),
                {
                    "oci/__init__.py",
                    "oci/__init__.pyc",
                    "oci/service.py",
                    "oci/service.pyc",
                },
            )
            self.assertEqual(
                archive.getinfo("oci/service.py").compress_type,
                zipfile.ZIP_DEFLATED,
            )

    def test_prepares_oci_sdk_with_python_3_6_zipfile(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        oci_directory = helper.find_oci_directory(tree)
        archive_path = oci_directory.parent / "oci.zip"
        original_zip_file = zipfile.ZipFile

        def python_3_6_zip_file(
            file: object,
            mode: str = "r",
            compression: int = zipfile.ZIP_STORED,
            allowZip64: bool = True,
        ) -> zipfile.ZipFile:
            return original_zip_file(file, mode, compression, allowZip64)

        with mock.patch.object(
            helper, "_compile_bytecode", self.compile_bytecode
        ), mock.patch.object(
            sys, "version_info", (3, 6)
        ), mock.patch.object(
            helper.zipfile, "ZipFile", new=python_3_6_zip_file
        ):
            helper.prepare_oci_sdk(tree)

        with original_zip_file(archive_path) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(
                archive.getinfo("oci/service.py").compress_type,
                zipfile.ZIP_DEFLATED,
            )

    def test_reports_oci_preparation_progress(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        oci_directory = helper.find_oci_directory(tree)
        archive_path = oci_directory.parent / "oci.zip"
        output = io.StringIO()

        with mock.patch.object(
            helper, "_compile_bytecode", self.compile_bytecode
        ), contextlib.redirect_stdout(output):
            helper.prepare_oci_sdk(tree)

        self.assertEqual(
            output.getvalue().splitlines(),
            [
                "Preparing OCI SDK:",
                f"  From: {oci_directory}",
                f"  To:   {archive_path}",
                "Compiling OCI SDK bytecode...",
                "Compressing OCI SDK...",
                "Verifying OCI SDK archive...",
                "OCI SDK preparation complete.",
            ],
        )

    def test_writes_path_file_with_literal_lf_bytes(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        site_packages = tree / "lib/mysqlsh/lib/python3.13/site-packages"
        original_write_text = Path.write_text

        def write_text(path: Path, text: str, *arguments: object, **keywords: object) -> int:
            if path.suffix == ".pth" and path.name.startswith(".oci-"):
                text = text.replace("\n", "\r\n")

            return original_write_text(path, text, *arguments, **keywords)

        with mock.patch.object(
            helper, "_compile_bytecode", self.compile_bytecode
        ), mock.patch.object(Path, "write_text", new=write_text):
            helper.prepare_oci_sdk(tree)

        self.assertEqual(
            (site_packages / "oci.pth").read_bytes(), b"oci.zip\n"
        )

    @unittest.skipUnless(os.name == "posix", "POSIX file modes required")
    def test_prepares_world_readable_oci_outputs(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        site_packages = tree / "lib/mysqlsh/lib/python3.13/site-packages"

        with mock.patch.object(
            helper, "_compile_bytecode", self.compile_bytecode
        ):
            helper.prepare_oci_sdk(tree)

        self.assertEqual(
            (site_packages / "oci.zip").stat().st_mode & 0o777,
            0o644,
        )
        self.assertEqual(
            (site_packages / "oci.pth").stat().st_mode & 0o777,
            0o644,
        )

    def test_keeps_original_directory_when_compilation_fails(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()

        with mock.patch.object(
            helper, "_compile_bytecode", side_effect=RuntimeError("compile failed")
        ):
            with self.assertRaisesRegex(RuntimeError, "compile failed"):
                helper.prepare_oci_sdk(tree)

        self.assert_original_directory_is_retained(tree)

    def test_keeps_original_directory_when_bytecode_is_missing(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()

        with mock.patch.object(helper, "_compile_bytecode"):
            with self.assertRaisesRegex(ValueError, "Missing bytecode"):
                helper.prepare_oci_sdk(tree)

        self.assert_original_directory_is_retained(tree)

    def test_keeps_original_directory_when_unexpected_file_is_present(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        oci_directory = helper.find_oci_directory(tree)
        (oci_directory / "unexpected.txt").write_text("unexpected\n", encoding="utf-8")

        with mock.patch.object(
            helper, "_compile_bytecode", self.compile_bytecode
        ):
            with self.assertRaisesRegex(ValueError, "Unexpected OCI SDK file"):
                helper.prepare_oci_sdk(tree)

        self.assert_original_directory_is_retained(tree)

    def test_excludes_cache_directory_from_archive(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        oci_directory = helper.find_oci_directory(tree)
        archive_path = oci_directory.parent / "oci.zip"
        cache_directory = oci_directory / "__pycache__"
        cache_directory.mkdir()
        (cache_directory / "service.cpython-313.pyc").write_bytes(b"stale")

        with mock.patch.object(
            helper, "_compile_bytecode", self.compile_bytecode
        ):
            helper.prepare_oci_sdk(tree)

        with zipfile.ZipFile(archive_path) as archive:
            self.assertFalse(
                any("__pycache__" in name for name in archive.namelist())
            )

    def test_keeps_original_directory_when_stale_bytecode_is_present(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        oci_directory = helper.find_oci_directory(tree)
        (oci_directory / "stale.pyc").write_bytes(b"stale")

        with mock.patch.object(
            helper, "_compile_bytecode", self.compile_bytecode
        ):
            with self.assertRaisesRegex(ValueError, "OCI SDK bytecode"):
                helper.prepare_oci_sdk(tree)

        self.assert_original_directory_is_retained(tree)

    def test_keeps_original_directory_when_archive_verification_fails(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()

        with mock.patch.object(
            helper, "_compile_bytecode", self.compile_bytecode
        ), mock.patch.object(
            helper,
            "_verify_archive",
            side_effect=ValueError("Archive verification failed"),
        ):
            with self.assertRaisesRegex(ValueError, "Archive verification failed"):
                helper.prepare_oci_sdk(tree)

        self.assert_original_directory_is_retained(tree)

    def test_keeps_original_directory_when_path_file_verification_fails(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        original_read_bytes = Path.read_bytes

        def read_bytes(path: Path) -> bytes:
            if path.suffix == ".pth" and path.name.startswith(".oci-"):
                return b"invalid path file\n"

            return original_read_bytes(path)

        with mock.patch.object(
            helper, "_compile_bytecode", self.compile_bytecode
        ), mock.patch.object(Path, "read_bytes", new=read_bytes):
            with self.assertRaisesRegex(ValueError, "OCI SDK path file"):
                helper.prepare_oci_sdk(tree)

        self.assert_original_directory_is_retained(tree)

    def test_restores_final_outputs_when_path_replacement_fails(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        oci_directory = helper.find_oci_directory(tree)
        site_packages = oci_directory.parent
        archive_path = site_packages / "oci.zip"
        path_file = site_packages / "oci.pth"
        archive_path.write_bytes(b"previous archive")
        path_file.write_text("previous path file\n", encoding="utf-8")
        original_replace = Path.replace
        source_backups = []

        def replace(path: Path, target: Path) -> Path:
            if path == oci_directory:
                source_backups.append(Path(target))
            if path.suffix == ".pth" and Path(target) == path_file:
                raise OSError("path replacement failed")

            return original_replace(path, target)

        with mock.patch.object(
            helper, "_compile_bytecode", self.compile_bytecode
        ), mock.patch.object(Path, "replace", new=replace):
            with self.assertRaisesRegex(OSError, "path replacement failed"):
                helper.prepare_oci_sdk(tree)

        self.assertTrue(oci_directory.is_dir())
        self.assertEqual(archive_path.read_bytes(), b"previous archive")
        self.assertEqual(
            path_file.read_text(encoding="utf-8"), "previous path file\n"
        )
        self.assertEqual(len(source_backups), 1)
        self.assertFalse(source_backups[0].exists())

    def test_preserves_new_outputs_when_source_backup_cleanup_fails(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        oci_directory = helper.find_oci_directory(tree)
        site_packages = oci_directory.parent
        archive_path = site_packages / "oci.zip"
        path_file = site_packages / "oci.pth"

        def partially_remove_backup(path: Path) -> None:
            if path == oci_directory:
                raise OSError("source backup cleanup failed")

            source_backup = path / "oci"
            (source_backup / "__init__.py").unlink()
            raise OSError("source backup cleanup failed")

        with mock.patch.object(
            helper, "_compile_bytecode", self.compile_bytecode
        ), mock.patch.object(
            helper.shutil,
            "rmtree",
            side_effect=partially_remove_backup,
        ):
            with self.assertRaisesRegex(OSError, "source backup cleanup failed"):
                helper.prepare_oci_sdk(tree)

        self.assertFalse(oci_directory.exists())
        self.assertEqual(path_file.read_bytes(), b"oci.zip\n")
        with zipfile.ZipFile(archive_path) as archive:
            self.assertIsNone(archive.testzip())

    def test_removes_archive_temp_when_path_temp_creation_fails(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        site_packages = (
            tree / "lib/mysqlsh/lib/python3.13/site-packages"
        )
        temporary_archive = site_packages / ".oci-archive.zip"
        temporary_archive.write_bytes(b"temporary archive")

        with mock.patch.object(
            helper, "_compile_bytecode", self.compile_bytecode
        ), mock.patch.object(
            helper,
            "_temporary_sibling",
            side_effect=[temporary_archive, OSError("path temp creation failed")],
        ):
            with self.assertRaisesRegex(OSError, "path temp creation failed"):
                helper.prepare_oci_sdk(tree)

        self.assertFalse(temporary_archive.exists())
        self.assert_original_directory_is_retained(tree)

    def test_compiler_uses_staged_mysqlsh_compileall_command(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        oci_directory = helper.find_oci_directory(tree)

        def record_command(command: object, **keywords: object) -> None:
            environment = keywords["env"]
            self.assertIsInstance(environment, dict)
            self.assertTrue(
                Path(environment["MYSQLSH_USER_CONFIG_HOME"]).is_dir()
            )

        with mock.patch.object(
            helper.subprocess, "run", side_effect=record_command
        ) as run:
            helper._compile_bytecode(tree, oci_directory)

        self.assertEqual(
            run.call_args.args[0],
            [
                str(tree / "bin/mysqlsh"),
                "--disable-builtin-plugins",
                "--pym",
                "compileall",
                "-q",
                "-f",
                "-b",
                str(oci_directory),
            ],
        )
        self.assertTrue(run.call_args.kwargs["check"])
        self.assertNotIn("cwd", run.call_args.kwargs)

    def test_compiler_uses_extended_path_on_windows(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        oci_directory = helper.find_oci_directory(tree)

        with mock.patch.object(helper.os, "name", "nt"), mock.patch.object(
            helper.subprocess,
            "CREATE_NO_WINDOW",
            0x08000000,
            create=True,
        ), mock.patch.object(helper.subprocess, "run") as run:
            helper._compile_bytecode(tree, oci_directory)

        self.assertEqual(
            run.call_args.args[0][-1],
            "\\\\?\\" + str(oci_directory.resolve()),
        )

    def test_compiler_does_not_attach_to_windows_console(self) -> None:
        helper = self.load_helper()
        tree = self.create_shell_tree()
        oci_directory = helper.find_oci_directory(tree)

        with mock.patch.object(helper.os, "name", "nt"), mock.patch.object(
            helper.subprocess,
            "CREATE_NO_WINDOW",
            0x08000000,
            create=True,
        ), mock.patch.object(helper.subprocess, "run") as run:
            helper._compile_bytecode(tree, oci_directory)

        self.assertEqual(
            run.call_args.kwargs.get("creationflags"),
            0x08000000,
        )
