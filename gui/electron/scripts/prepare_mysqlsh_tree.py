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
from typing import Optional, Sequence


PREPARE_OCI_SDK_SCRIPT = Path(__file__).resolve().with_name(
    "prepare_oci_sdk.py"
)


def _is_within_tree(path: Path, tree: Path) -> bool:
    try:
        path.resolve().relative_to(tree.resolve())
    except ValueError:
        return False

    return True


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


def find_oci_site_packages(tree: Path) -> Path:
    candidates = sorted(
        metadata
        for metadata in tree.glob("**/site-packages/oci-*.dist-info")
        if metadata.is_dir()
        and not metadata.is_symlink()
        and _is_within_tree(metadata, tree)
    )
    if not candidates:
        raise ValueError(f"OCI SDK metadata does not exist under {tree}")
    if len(candidates) != 1:
        raise ValueError(
            f"Found multiple OCI SDK metadata directories under {tree}"
        )

    return candidates[0].parent


def prepare_oci_sdk(tree: Path) -> None:
    tree = tree.resolve()
    site_packages = find_oci_site_packages(tree)
    site_packages_argument = str(site_packages)
    if os.name == "nt":
        site_packages_argument = "\\\\?\\" + str(site_packages.resolve())

    environment = os.environ.copy()
    with tempfile.TemporaryDirectory(prefix="mysqlsh-oci-sdk-") as config_home:
        environment["MYSQLSH_USER_CONFIG_HOME"] = config_home
        command = [
            str(find_mysqlsh_executable(tree)),
            "--disable-builtin-plugins",
            "--py",
            "-f",
            str(PREPARE_OCI_SDK_SCRIPT),
            site_packages_argument,
        ]
        creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        result = subprocess.run(
            command,
            check=False,
            creationflags=creationflags,
            env=environment,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            encoding="utf-8",
            errors="replace",
        )
        if result.stdout:
            print(result.stdout, end="", flush=True)

        result.check_returncode()


def validate_mysqlsh_tree(tree: Path) -> None:
    for name in ("bin", "lib", "share"):
        required_path = tree / name
        if not required_path.is_dir():
            raise ValueError(f"Expected MySQL Shell directory: {required_path}")

    plugin_root = tree / "lib" / "mysqlsh" / "plugins"
    if not plugin_root.is_dir():
        raise ValueError(f"Plugin root does not exist: {plugin_root}")


def stage_mysqlsh_tree(
    source: Path,
    destination: Path,
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


def parse_arguments(arguments: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare an unpacked MySQL Shell tree for desktop packaging."
    )
    commands = parser.add_subparsers(dest="command")

    stage_parser = commands.add_parser("stage", help="Stage an unpacked tree.")
    stage_parser.add_argument("--optimize-oci", action="store_true")
    stage_parser.add_argument("source", type=Path)
    stage_parser.add_argument("destination", type=Path)

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
                options.optimize_oci,
            )
        else:
            prepare_oci_sdk(options.tree.resolve())
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        print(f"ERROR: {error}", file=sys.stderr)

        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
