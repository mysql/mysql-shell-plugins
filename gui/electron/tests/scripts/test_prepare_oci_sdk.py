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
import marshal
import os
import py_compile
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from types import ModuleType
from typing import Optional
from unittest import mock


SCRIPT_PATH = Path(__file__).resolve().parents[2] / "scripts" / "prepare_oci_sdk.py"


class PrepareOciSdkTest(unittest.TestCase):

    def setUp(self) -> None:
        self.temporary_dir = tempfile.TemporaryDirectory()

    def tearDown(self) -> None:
        self.temporary_dir.cleanup()

    def load_helper(self) -> ModuleType:
        spec = importlib.util.spec_from_file_location("prepare_oci_sdk", SCRIPT_PATH)
        if spec is None or spec.loader is None:
            self.fail(f"Could not load OCI SDK preparation helper: {SCRIPT_PATH}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def create_site_packages(self, name: str = "site-packages") -> Path:
        site_packages = Path(self.temporary_dir.name) / name
        oci_directory = site_packages / "oci"
        oci_directory.mkdir(parents=True)
        (oci_directory / "__init__.py").write_text("\n", encoding="utf-8")
        (oci_directory / "service.py").write_text("VALUE = 1\n", encoding="utf-8")
        return site_packages

    def assert_original_directory_is_retained(self, site_packages: Path) -> None:
        self.assertTrue((site_packages / "oci").is_dir())
        self.assertFalse((site_packages / "oci.zip").exists())
        self.assertFalse((site_packages / "oci.pth").exists())

    def test_prepares_oci_sdk_with_invoking_python(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()

        helper.prepare_oci_sdk(site_packages)

        self.assertFalse((site_packages / "oci").exists())
        self.assertEqual((site_packages / "oci.pth").read_bytes(), b"oci.zip\n")
        with zipfile.ZipFile(site_packages / "oci.zip") as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(
                sorted(archive.namelist()),
                ["oci/__init__.pyc", "oci/service.pyc"],
            )
            self.assertEqual(
                archive.read("oci/service.pyc")[:4],
                importlib.util.MAGIC_NUMBER,
            )

    def test_bytecode_only_archive_is_importable(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        helper.prepare_oci_sdk(site_packages)
        archive_path = site_packages / "oci.zip"

        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import sys; "
                    f"sys.path.insert(0, {str(archive_path)!r}); "
                    "import oci; "
                    "from oci.service import VALUE; "
                    "assert VALUE == 1; "
                    "assert type(oci.__loader__).__name__ == 'zipimporter'"
                ),
            ],
            capture_output=True,
            check=False,
            text=True,
        )

        self.assertEqual(result.returncode, 0, result.stderr)

    @unittest.skipUnless(
        sys.version_info >= (3, 7),
        "checked-hash bytecode requires Python 3.7",
    )
    def test_oci_bytecode_is_stable_across_staging_directories(self) -> None:
        helper = self.load_helper()
        first_site_packages = self.create_site_packages("first/site-packages")
        second_site_packages = self.create_site_packages("second/site-packages")

        helper.prepare_oci_sdk(first_site_packages)
        helper.prepare_oci_sdk(second_site_packages)

        with zipfile.ZipFile(first_site_packages / "oci.zip") as first_archive:
            first_bytecode = first_archive.read("oci/service.pyc")
        with zipfile.ZipFile(second_site_packages / "oci.zip") as second_archive:
            second_bytecode = second_archive.read("oci/service.pyc")

        self.assertEqual(first_bytecode, second_bytecode)
        self.assertEqual(int.from_bytes(first_bytecode[4:8], "little"), 3)
        self.assertEqual(
            marshal.loads(first_bytecode[16:]).co_filename,
            "oci/service.py",
        )

    def test_cli_prepares_supplied_site_packages(self) -> None:
        site_packages = self.create_site_packages()

        result = subprocess.run(
            [sys.executable, str(SCRIPT_PATH), str(site_packages)],
            capture_output=True,
            check=False,
            text=True,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((site_packages / "oci").exists())
        self.assertTrue((site_packages / "oci.zip").is_file())
        self.assertEqual((site_packages / "oci.pth").read_bytes(), b"oci.zip\n")

    def test_rejects_failed_in_process_compilation(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()

        with mock.patch.object(
            helper.compileall, "compile_dir", return_value=False
        ) as compile_dir:
            with self.assertRaisesRegex(RuntimeError, "compilation failed"):
                helper.prepare_oci_sdk(site_packages)

        compile_options = {
            "ddir": "oci",
            "force": True,
            "quiet": 1,
            "legacy": True,
        }
        if sys.version_info >= (3, 7):
            compile_options["invalidation_mode"] = (
                py_compile.PycInvalidationMode.CHECKED_HASH
            )
        compile_dir.assert_called_once_with(
            str(site_packages / "oci"),
            **compile_options,
        )
        self.assert_original_directory_is_retained(site_packages)

    def test_rejects_symlinked_generated_outputs_before_compilation(self) -> None:
        helper = self.load_helper()
        for output_name in ("oci.zip", "oci.pth"):
            with self.subTest(output_name=output_name):
                site_packages = self.create_site_packages(output_name)
                external = Path(self.temporary_dir.name) / f"external-{output_name}"
                external.write_bytes(b"external")
                (site_packages / output_name).symlink_to(external)
                with mock.patch.object(helper.compileall, "compile_dir") as compile_dir:
                    with self.assertRaisesRegex(ValueError, "symlink"):
                        helper.prepare_oci_sdk(site_packages)
                compile_dir.assert_not_called()
                self.assertTrue((site_packages / "oci").is_dir())

    def test_rejects_symlinked_oci_directory_before_compilation(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        oci_directory = site_packages / "oci"
        external = Path(self.temporary_dir.name) / "external-oci"
        oci_directory.replace(external)
        oci_directory.symlink_to(external, target_is_directory=True)

        with mock.patch.object(helper.compileall, "compile_dir") as compile_dir:
            with self.assertRaisesRegex(ValueError, "symlink"):
                helper.prepare_oci_sdk(site_packages)

        compile_dir.assert_not_called()
        self.assertEqual(sorted(path.name for path in external.iterdir()), ["__init__.py", "service.py"])

    def test_rejects_existing_oci_file_before_accepting_prepared_outputs(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        oci_path = site_packages / "oci"
        shutil.rmtree(oci_path)
        oci_path.write_bytes(b"not a directory")
        archive_path = site_packages / "oci.zip"
        path_file = site_packages / "oci.pth"
        archive_path.write_bytes(b"existing archive")
        path_file.write_bytes(b"oci.zip\n")

        with mock.patch.object(helper.compileall, "compile_dir") as compile_dir:
            with self.assertRaisesRegex(ValueError, "OCI SDK directory"):
                helper.prepare_oci_sdk(site_packages)

        compile_dir.assert_not_called()
        self.assertEqual(oci_path.read_bytes(), b"not a directory")
        self.assertEqual(archive_path.read_bytes(), b"existing archive")
        self.assertEqual(path_file.read_bytes(), b"oci.zip\n")

    def test_skips_only_complete_prepared_oci_sdk(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        archive_path = site_packages / "oci.zip"
        path_file = site_packages / "oci.pth"
        archive_path.write_bytes(b"existing archive")
        shutil.rmtree(site_packages / "oci")
        output = io.StringIO()

        with self.assertRaisesRegex(ValueError, "OCI SDK directory"):
            helper.prepare_oci_sdk(site_packages)
        path_file.write_bytes(b"oci.zip\n")
        with contextlib.redirect_stdout(output):
            helper.prepare_oci_sdk(site_packages)

        self.assertEqual(archive_path.read_bytes(), b"existing archive")
        self.assertEqual(output.getvalue(), f"OCI SDK is already prepared: {archive_path}\n")

    def test_reports_oci_preparation_progress(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            helper.prepare_oci_sdk(site_packages)
        self.assertEqual(output.getvalue().splitlines(), [
            "Preparing OCI SDK:",
            f"  From: {site_packages / 'oci'}",
            f"  To:   {site_packages / 'oci.zip'}",
            "Compiling OCI SDK bytecode...",
            "Compressing OCI SDK...",
            "Verifying OCI SDK archive...",
            "OCI SDK preparation complete.",
        ])

    def test_writes_path_file_with_literal_lf_bytes(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        helper.prepare_oci_sdk(site_packages)
        self.assertEqual((site_packages / "oci.pth").read_bytes(), b"oci.zip\n")

    @unittest.skipUnless(os.name == "posix", "POSIX file modes required")
    def test_prepares_world_readable_oci_outputs(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        helper.prepare_oci_sdk(site_packages)
        self.assertEqual((site_packages / "oci.zip").stat().st_mode & 0o777, 0o644)
        self.assertEqual((site_packages / "oci.pth").stat().st_mode & 0o777, 0o644)

    def test_keeps_original_directory_when_bytecode_is_missing(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        with mock.patch.object(helper.compileall, "compile_dir", return_value=True):
            with self.assertRaisesRegex(ValueError, "Missing bytecode"):
                helper.prepare_oci_sdk(site_packages)
        self.assert_original_directory_is_retained(site_packages)

    def test_keeps_original_directory_when_unexpected_file_is_present(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        (site_packages / "oci" / "unexpected.txt").write_text("unexpected\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Unexpected OCI SDK file"):
            helper.prepare_oci_sdk(site_packages)
        self.assert_original_directory_is_retained(site_packages)

    def test_excludes_cache_directory_from_archive(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        cache_directory = site_packages / "oci" / "__pycache__"
        cache_directory.mkdir()
        (cache_directory / "service.cpython-313.pyc").write_bytes(b"stale")
        helper.prepare_oci_sdk(site_packages)
        with zipfile.ZipFile(site_packages / "oci.zip") as archive:
            self.assertFalse(any("__pycache__" in name for name in archive.namelist()))

    def test_keeps_original_directory_when_stale_bytecode_is_present(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        (site_packages / "oci" / "stale.pyc").write_bytes(b"stale")
        with self.assertRaisesRegex(ValueError, "OCI SDK bytecode"):
            helper.prepare_oci_sdk(site_packages)
        self.assert_original_directory_is_retained(site_packages)

    def test_keeps_original_directory_when_archive_verification_fails(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        with mock.patch.object(
            helper,
            "_verify_archive",
            side_effect=ValueError("Archive verification failed"),
        ):
            with self.assertRaisesRegex(ValueError, "Archive verification failed"):
                helper.prepare_oci_sdk(site_packages)
        self.assert_original_directory_is_retained(site_packages)

    def test_keeps_original_directory_when_path_file_verification_fails(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        original_read_bytes = Path.read_bytes

        def read_bytes(path: Path) -> bytes:
            if path.suffix == ".pth" and path.name.startswith(".oci-"):
                return b"invalid path file\n"
            return original_read_bytes(path)

        with mock.patch.object(Path, "read_bytes", new=read_bytes):
            with self.assertRaisesRegex(ValueError, "OCI SDK path file"):
                helper.prepare_oci_sdk(site_packages)
        self.assert_original_directory_is_retained(site_packages)

    def test_restores_final_outputs_when_path_replacement_fails(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        oci_directory = site_packages / "oci"
        archive_path = site_packages / "oci.zip"
        path_file = site_packages / "oci.pth"
        archive_path.write_bytes(b"previous archive")
        path_file.write_text("previous path file\n", encoding="utf-8")
        original_replace = Path.replace

        def replace(path: Path, target: Path) -> Path:
            if path.suffix == ".pth" and Path(target) == path_file:
                raise OSError("path replacement failed")
            return original_replace(path, target)

        with mock.patch.object(Path, "replace", new=replace):
            with self.assertRaisesRegex(OSError, "path replacement failed"):
                helper.prepare_oci_sdk(site_packages)
        self.assertTrue(oci_directory.is_dir())
        self.assertEqual(archive_path.read_bytes(), b"previous archive")
        self.assertEqual(path_file.read_text(encoding="utf-8"), "previous path file\n")

    def test_preserves_new_outputs_when_source_backup_cleanup_fails(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        oci_directory = site_packages / "oci"

        def partially_remove_backup(path: Path) -> None:
            if path == oci_directory:
                raise OSError("source backup cleanup failed")
            (path / "oci" / "__init__.py").unlink()
            raise OSError("source backup cleanup failed")

        with mock.patch.object(
            helper.shutil,
            "rmtree",
            side_effect=partially_remove_backup,
        ):
            with self.assertRaisesRegex(OSError, "source backup cleanup failed"):
                helper.prepare_oci_sdk(site_packages)

        self.assertFalse(oci_directory.exists())
        self.assertEqual((site_packages / "oci.pth").read_bytes(), b"oci.zip\n")
        with zipfile.ZipFile(site_packages / "oci.zip") as archive:
            self.assertIsNone(archive.testzip())

    def test_removes_archive_temp_when_path_temp_creation_fails(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        temporary_archive = site_packages / ".oci-archive.zip"
        temporary_archive.write_bytes(b"temporary archive")
        with mock.patch.object(helper, "_temporary_sibling", side_effect=[temporary_archive, OSError("path temp creation failed")]):
            with self.assertRaisesRegex(OSError, "path temp creation failed"):
                helper.prepare_oci_sdk(site_packages)
        self.assertFalse(temporary_archive.exists())
        self.assert_original_directory_is_retained(site_packages)

    def test_prepares_oci_sdk_with_python_3_6_zipfile(self) -> None:
        helper = self.load_helper()
        site_packages = self.create_site_packages()
        original_compile_dir = helper.compileall.compile_dir
        original_zip_file = zipfile.ZipFile

        def python_3_6_compile_dir(
            directory: str,
            maxlevels: Optional[int] = None,
            ddir: Optional[str] = None,
            force: bool = False,
            rx: Optional[object] = None,
            quiet: int = 0,
            legacy: bool = False,
            optimize: int = -1,
            workers: int = 1,
        ) -> bool:
            return original_compile_dir(
                directory,
                maxlevels=maxlevels,
                ddir=ddir,
                force=force,
                rx=rx,
                quiet=quiet,
                legacy=legacy,
                optimize=optimize,
                workers=workers,
            )

        def python_3_6_zip_file(
            file: object,
            mode: str = "r",
            compression: int = zipfile.ZIP_STORED,
            allow_zip64: bool = True,
        ) -> zipfile.ZipFile:
            return original_zip_file(file, mode, compression, allow_zip64)

        with mock.patch.object(sys, "version_info", (3, 6)), mock.patch.object(
            helper.compileall,
            "compile_dir",
            new=python_3_6_compile_dir,
        ), mock.patch.object(
            helper.zipfile, "ZipFile", new=python_3_6_zip_file
        ):
            helper.prepare_oci_sdk(site_packages)

        with original_zip_file(site_packages / "oci.zip") as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(
                archive.getinfo("oci/service.pyc").compress_type,
                zipfile.ZIP_DEFLATED,
            )
            bytecode = archive.read("oci/service.pyc")

        header_size = 16 if sys.version_info >= (3, 7) else 12
        self.assertEqual(
            marshal.loads(bytecode[header_size:]).co_filename,
            "oci/service.py",
        )

    def test_cli_reports_invalid_site_packages_without_traceback(self) -> None:
        missing = Path(self.temporary_dir.name) / "missing"
        result = subprocess.run([sys.executable, str(SCRIPT_PATH), str(missing)], capture_output=True, check=False, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("ERROR:", result.stderr)
        self.assertIn(str(missing), result.stderr)
        self.assertNotIn("Traceback", result.stderr)
