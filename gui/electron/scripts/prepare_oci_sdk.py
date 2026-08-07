#!/usr/bin/env python3
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

import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Dict, List, Optional


def _is_within_tree(path: Path, tree: Path) -> bool:
    try:
        path.resolve().relative_to(tree.resolve())
    except ValueError:
        return False

    return True


def find_oci_directory(tree: Path) -> Path:
    candidates = sorted(
        path
        for root, pattern in (
            (
                tree / "lib" / "mysqlsh" / "lib",
                "python*/site-packages/oci",
            ),
            (tree / "lib", "Python*/Lib/site-packages/oci"),
        )
        for path in root.glob(pattern)
        if path.is_dir() and not path.is_symlink() and _is_within_tree(path, tree)
    )
    if not candidates:
        raise ValueError(f"OCI SDK directory does not exist under {tree}")
    if len(candidates) != 1:
        raise ValueError(f"Found multiple OCI SDK directories under {tree}")

    return candidates[0]


def find_mysqlsh_executable(tree: Path) -> Path:
    candidates = [
        path
        for path in (tree / "bin" / "mysqlsh", tree / "bin" / "mysqlsh.exe")
        if path.is_file() and _is_within_tree(path, tree)
    ]
    if len(candidates) != 1:
        raise ValueError(
            f"Expected one MySQL Shell executable under {tree / 'bin'}"
        )

    return candidates[0]


def _compile_bytecode(tree: Path, oci_directory: Path) -> None:
    environment = os.environ.copy()
    with tempfile.TemporaryDirectory(prefix="mysqlsh-oci-sdk-") as config_home:
        environment["MYSQLSH_USER_CONFIG_HOME"] = config_home
        compile_directory = str(oci_directory)
        if os.name == "nt":
            resolved_oci_directory = str(oci_directory.resolve())
            compile_directory = "\\\\?\\" + resolved_oci_directory

        command = [
            str(find_mysqlsh_executable(tree)),
            "--disable-builtin-plugins",
            "--pym",
            "compileall",
            "-q",
            "-f",
            "-b",
            compile_directory,
        ]
        creationflags = (
            subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        )
        subprocess.run(
            command,
            check=True,
            creationflags=creationflags,
            env=environment,
        )


def _find_expected_files(oci_directory: Path) -> List[Path]:
    python_files: List[Path] = []
    bytecode_files: List[Path] = []
    for path in sorted(oci_directory.rglob("*"), key=lambda candidate: str(candidate)):
        if "__pycache__" in path.relative_to(oci_directory).parts:
            continue
        if path.is_symlink():
            raise ValueError(f"Unexpected OCI SDK symlink: {path}")
        if not path.is_file():
            continue
        if path.suffix == ".py":
            python_files.append(path)
        elif path.suffix == ".pyc":
            bytecode_files.append(path)
        else:
            raise ValueError(f"Unexpected OCI SDK file: {path}")

    expected_bytecode_files = {
        path.with_suffix(".pyc") for path in python_files
    }
    missing_bytecode_files = expected_bytecode_files - set(bytecode_files)
    if missing_bytecode_files:
        raise ValueError(
            f"Missing bytecode for OCI SDK files: {oci_directory}"
        )
    if set(bytecode_files) - expected_bytecode_files:
        raise ValueError(f"Unexpected OCI SDK bytecode files: {oci_directory}")

    return sorted(python_files + bytecode_files, key=lambda path: str(path))


def _temporary_sibling(site_packages: Path, suffix: str) -> Path:
    descriptor, name = tempfile.mkstemp(
        dir=site_packages,
        prefix=".oci-",
        suffix=suffix,
    )
    os.close(descriptor)

    return Path(name)


def _verify_archive(
    archive_path: Path, expected_files: List[Path], site_packages: Path
) -> None:
    expected_names = {
        source.relative_to(site_packages).as_posix() for source in expected_files
    }
    with zipfile.ZipFile(archive_path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError(f"OCI SDK archive has duplicate entries: {archive_path}")
        if set(names) != expected_names:
            raise ValueError(f"OCI SDK archive has an unexpected manifest: {archive_path}")
        if archive.testzip() is not None:
            raise ValueError(f"OCI SDK archive verification failed: {archive_path}")
        for source in expected_files:
            name = source.relative_to(site_packages).as_posix()
            if archive.read(name) != source.read_bytes():
                raise ValueError(f"OCI SDK archive content differs for: {name}")


def _verify_path_file(path_file: Path) -> None:
    if path_file.read_bytes() != b"oci.zip\n":
        raise ValueError(f"OCI SDK path file verification failed: {path_file}")


def _path_exists(path: Path) -> bool:
    return path.exists() or path.is_symlink()


def prepare_oci_sdk(tree: Path) -> None:
    oci_directory = find_oci_directory(tree)
    site_packages = oci_directory.parent
    final_archive = site_packages / "oci.zip"
    final_pth = site_packages / "oci.pth"
    print("Preparing OCI SDK:")
    print(f"  From: {oci_directory}")
    print(f"  To:   {final_archive}", flush=True)
    print("Compiling OCI SDK bytecode...", flush=True)
    _compile_bytecode(tree, oci_directory)
    expected_files = _find_expected_files(oci_directory)
    temporary_archive: Optional[Path] = None
    temporary_pth: Optional[Path] = None
    backups: Dict[Path, Path] = {}
    installed_outputs: List[Path] = []
    source_backup_parent: Optional[Path] = None
    source_backup: Optional[Path] = None
    outputs_committed = False

    try:
        temporary_archive = _temporary_sibling(site_packages, ".zip")
        temporary_pth = _temporary_sibling(site_packages, ".pth")
        print("Compressing OCI SDK...", flush=True)
        zip_options = {"compression": zipfile.ZIP_DEFLATED}
        if sys.version_info >= (3, 7):
            zip_options["compresslevel"] = 6

        with zipfile.ZipFile(
            temporary_archive,
            "w",
            **zip_options,
        ) as archive:
            for source in sorted(expected_files, key=lambda path: str(path)):
                archive.write(
                    source,
                    source.relative_to(site_packages).as_posix(),
                )

        print("Verifying OCI SDK archive...", flush=True)
        _verify_archive(temporary_archive, expected_files, site_packages)
        temporary_pth.write_bytes(b"oci.zip\n")
        _verify_path_file(temporary_pth)
        temporary_archive.chmod(0o644)
        temporary_pth.chmod(0o644)
        for final_output in (final_archive, final_pth):
            if _path_exists(final_output):
                backup = _temporary_sibling(
                    site_packages,
                    f".{final_output.name}.backup",
                )
                try:
                    final_output.replace(backup)
                except Exception:
                    backup.unlink()
                    raise
                backups[final_output] = backup

        source_backup_parent = Path(
            tempfile.mkdtemp(dir=site_packages, prefix=".oci-")
        )
        source_backup = source_backup_parent / "oci"
        oci_directory.replace(source_backup)

        for temporary_output, final_output in (
            (temporary_archive, final_archive),
            (temporary_pth, final_pth),
        ):
            temporary_output.replace(final_output)
            installed_outputs.append(final_output)

        outputs_committed = True
        shutil.rmtree(source_backup_parent)
    except Exception:
        if not outputs_committed:
            for final_output in installed_outputs:
                if _path_exists(final_output):
                    final_output.unlink()
            for final_output, backup in backups.items():
                if _path_exists(backup):
                    backup.replace(final_output)
            if source_backup is not None and _path_exists(source_backup):
                source_backup.replace(oci_directory)
            if (
                source_backup_parent is not None
                and source_backup_parent.exists()
            ):
                source_backup_parent.rmdir()
        for temporary_output in (temporary_archive, temporary_pth):
            if temporary_output is not None and temporary_output.exists():
                temporary_output.unlink()
        raise
    else:
        for backup in backups.values():
            backup.unlink()
        print("OCI SDK preparation complete.", flush=True)
