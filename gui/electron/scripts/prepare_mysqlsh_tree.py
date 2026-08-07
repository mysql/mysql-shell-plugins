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

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List, Optional, Sequence

from prepare_oci_sdk import prepare_oci_sdk


CLEANUP_DIRECTORY_NAMES = {
    ".vscode",
    "__pycache__",
    "docs",
    "examples",
    "node_modules",
    "tests",
}
CLEANUP_FILE_NAMES = {
    "cspell.json",
    "pytest-coverage.ini",
    "pytest.ini",
    "python.env",
    "run_tests.py",
}


def validate_mysqlsh_tree(tree: Path) -> None:
    for name in ("bin", "lib", "share"):
        required_path = tree / name
        if not required_path.is_dir():
            raise ValueError(f"Expected MySQL Shell directory: {required_path}")

    plugin_root = tree / "lib" / "mysqlsh" / "plugins"
    if not plugin_root.is_dir():
        raise ValueError(f"Plugin root does not exist: {plugin_root}")


def find_cleanup_candidates(tree: Path) -> List[Path]:
    validate_mysqlsh_tree(tree)
    plugin_root = tree / "lib" / "mysqlsh" / "plugins"
    candidates = [
        path
        for root, pattern in (
            (
                tree / "lib" / "mysqlsh" / "lib",
                "python*/site-packages/docs",
            ),
            (tree / "lib", "Python*/Lib/site-packages/docs"),
        )
        for path in root.glob(pattern)
        if path.is_dir() or path.is_symlink()
    ]

    for directory, directory_names, file_names in os.walk(
        plugin_root, topdown=True, followlinks=False
    ):
        directory_names.sort()
        file_names.sort()
        current = Path(directory)
        removable_directories = [
            name for name in directory_names if name in CLEANUP_DIRECTORY_NAMES
        ]
        candidates.extend(current / name for name in removable_directories)
        directory_names[:] = [
            name for name in directory_names if name not in CLEANUP_DIRECTORY_NAMES
        ]
        candidates.extend(
            current / name for name in file_names if name in CLEANUP_FILE_NAMES
        )

    return sorted(candidates, key=lambda path: str(path))


def _remove_path(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.exists():
        shutil.rmtree(path)


def clean_mysqlsh_tree(tree: Path) -> List[Path]:
    candidates = find_cleanup_candidates(tree)
    for candidate in candidates:
        _remove_path(candidate)

    return candidates


def stage_mysqlsh_tree(
    source: Path,
    destination: Path,
    cleanup: bool = False,
    optimize_oci: bool = False,
) -> None:
    source = source.resolve()
    destination = destination.absolute()
    validate_mysqlsh_tree(source)
    destination.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(
        dir=destination.parent,
        prefix=f".{destination.name}-",
    ) as temporary_dir:
        temporary_root = Path(temporary_dir)
        staged_tree = temporary_root / "staged"
        staged_tree.mkdir()

        for name in ("bin", "lib", "share"):
            shutil.copytree(source / name, staged_tree / name, symlinks=True)

        libexec = source / "libexec"
        if libexec.exists():
            shutil.copytree(libexec, staged_tree / "libexec", symlinks=True)

        if cleanup:
            clean_mysqlsh_tree(staged_tree)

        if optimize_oci:
            prepare_oci_sdk(staged_tree)

        backup = temporary_root / "previous"
        destination_existed = destination.exists() or destination.is_symlink()
        if destination_existed:
            destination.replace(backup)

        try:
            staged_tree.replace(destination)
        except OSError:
            if destination_existed:
                backup.replace(destination)

            raise


def _path_size(path: Path) -> int:
    if path.is_symlink() or path.is_file():
        return path.lstat().st_size

    total = path.lstat().st_size
    for child in path.iterdir():
        total += _path_size(child)

    return total


def _format_size(size: int) -> str:
    units = ("B", "KB", "MB", "GB")
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.1f} {unit}"

        value /= 1024

    raise AssertionError("Unreachable size unit")


def _report_cleanup(tree: Path, candidates: List[Path], apply: bool) -> None:
    if not candidates:
        print(f"No cleanup candidates found under {tree / 'lib/mysqlsh/plugins'}")

        return

    print(f"mysqlsh tree: {tree}")
    print(f"Mode: {'apply' if apply else 'dry-run'}")
    print("\nCleanup candidates:")
    total_size = 0
    for candidate in candidates:
        size = _path_size(candidate)
        total_size += size
        print(f"  {_format_size(size):>10}  {candidate}")

    print(f"\nEstimated removable size: {_format_size(total_size)}")


def parse_arguments(arguments: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare an unpacked MySQL Shell tree for desktop packaging."
    )
    commands = parser.add_subparsers(dest="command")

    stage_parser = commands.add_parser("stage", help="Stage an unpacked tree.")
    stage_parser.add_argument("--clean", action="store_true")
    stage_parser.add_argument("--optimize-oci", action="store_true")
    stage_parser.add_argument("source", type=Path)
    stage_parser.add_argument("destination", type=Path)

    clean_parser = commands.add_parser("clean", help="Clean a staged tree.")
    clean_parser.add_argument("--apply", action="store_true")
    clean_parser.add_argument("tree", type=Path)

    optimize_oci_parser = commands.add_parser(
        "optimize-oci", help="Prepare the OCI SDK in an unpacked tree."
    )
    optimize_oci_parser.add_argument("tree", type=Path)

    options = parser.parse_args(arguments)
    if options.command is None:
        parser.error("the following arguments are required: command")

    return options


def main(arguments: Optional[Sequence[str]] = None) -> int:
    options = parse_arguments(arguments)

    try:
        if options.command == "stage":
            stage_mysqlsh_tree(
                options.source,
                options.destination,
                options.clean,
                options.optimize_oci,
            )
        elif options.command == "optimize-oci":
            prepare_oci_sdk(options.tree.resolve())
        else:
            tree = options.tree.resolve()
            candidates = find_cleanup_candidates(tree)
            _report_cleanup(tree, candidates, options.apply)
            if options.apply:
                for candidate in candidates:
                    _remove_path(candidate)
                if candidates:
                    print("Cleanup complete.")
            elif candidates:
                print("Dry run complete. Re-run with --apply to delete these paths.")
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        print(f"ERROR: {error}", file=sys.stderr)

        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
