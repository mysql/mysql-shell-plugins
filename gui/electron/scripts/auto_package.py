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
import contextlib
import json
import os
import platform
import shlex
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Iterator, Optional, Sequence

from prepare_mysqlsh_tree import stage_mysqlsh_tree


def resolve_platform(system_name: str, machine_name: str) -> str:
    architectures = {
        "aarch64": "arm64",
        "amd64": "x64",
        "arm64": "arm64",
        "x86_64": "x64",
    }

    architecture = architectures.get(machine_name.lower())
    if system_name == "Darwin" and architecture is not None:
        return f"darwin-{architecture}"

    if system_name == "Linux" and architecture is not None:
        return f"linux-{architecture}"

    if system_name == "Windows" and architecture == "x64":
        return "win32-x64"

    raise RuntimeError(f"Unsupported platform: {system_name} {machine_name}")


def parse_arguments(arguments: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Package MySQL Workbench for the current platform.",
    )
    parser.add_argument(
        "--mysqlsh",
        required=True,
        type=Path,
        help="Path to an unpacked MySQL Shell directory.",
    )
    parser.add_argument(
        "--electron",
        required=True,
        type=Path,
        help="Path to a directory containing Electron runtime ZIP packages.",
    )
    parser.add_argument(
        "--router",
        required=True,
        type=Path,
        help=(
            "Path to an unpacked MySQL Router directory, reserved for future "
            "packaging integration."
        ),
    )

    output_mode = parser.add_mutually_exclusive_group(required=True)
    output_mode.add_argument(
        "--zip",
        action="store_true",
        help="Create a ZIP archive.",
    )
    output_mode.add_argument(
        "--installer",
        action="store_true",
        help="Create the native installer packages for the current platform.",
    )
    parser.add_argument(
        "--win-sign",
        action="store_true",
        help=(
            "Sign the Windows application payload; requires a provisioned "
            "signing implementation."
        ),
    )
    parser.add_argument(
        "--commercial",
        action="store_true",
        help="Build the commercial package edition instead of community.",
    )
    parser.add_argument(
        "--wix-archive",
        type=Path,
        help="Path to an official electron-builder WiX archive.",
    )

    return parser.parse_args(arguments)


def validate_wix_archive_option(
    wix_archive: Optional[Path],
    installer: bool,
    target: str,
) -> Optional[Path]:
    if wix_archive is None:
        return None

    if not installer:
        raise ValueError("--wix-archive can only be used with --installer.")

    if not target.startswith("win32-"):
        raise ValueError(
            "--wix-archive can only be used when building on Windows."
        )

    resolved_wix = wix_archive.resolve()
    if not resolved_wix.is_file():
        raise ValueError(f"WiX archive is not a file: {resolved_wix}")

    return resolved_wix


def validate_win_sign_option(win_sign: bool, target: str) -> None:
    if win_sign and not target.startswith("win32-"):
        raise ValueError("--win-sign can only be used when building on Windows.")


def format_command(command: Sequence[str]) -> str:
    if platform.system() == "Windows":
        return subprocess.list2cmdline(command)

    return shlex.join(command)


def print_path_operation(
    action: str,
    source: Path,
    destination: Path,
) -> None:
    print(f"{action}:")
    print(f"  From: {source}")
    print(f"  To:   {destination}", flush=True)


def remove_path(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.exists():
        shutil.rmtree(path)


def force_copy_directory_contents(source: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for entry in source.iterdir():
        target = destination / entry.name
        if entry.is_symlink():
            remove_path(target)
            target.symlink_to(
                os.readlink(entry), target_is_directory=entry.is_dir()
            )
            shutil.copystat(entry, target, follow_symlinks=False)

            continue

        if entry.is_dir():
            if target.is_symlink() or (target.exists() and not target.is_dir()):
                remove_path(target)
            force_copy_directory_contents(entry, target)
            shutil.copystat(entry, target)

            continue

        if target.is_symlink() or target.is_dir():
            remove_path(target)
        shutil.copy2(entry, target)


def package_metadata(
    package_path: Path,
) -> tuple[str, dict[str, str], str]:
    package = json.loads(package_path.read_text(encoding="utf-8"))
    suffixes: dict[str, str] = package["desktopPackageSuffixes"]

    return (
        str(package["dependencies"]["electron"]),
        suffixes,
        str(package["desktopElectronBuilderCache"]),
    )


def stage_wix_archive(source: Path, cache_folder: Path) -> Path:
    resolved_source = source.resolve()
    resolved_cache = cache_folder.resolve()
    destination = resolved_cache / resolved_source.stem / resolved_source.name
    print_path_operation("Copying WiX archive", resolved_source, destination)
    if resolved_source == destination:
        return destination

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(resolved_source, destination)

    return destination


def stage_electron_builder_cache(
    environment: dict[str, str], cache_folder: Path
) -> Optional[Path]:
    configured_cache = environment.get("ELECTRON_BUILDER_CACHE")
    if not configured_cache:
        return None

    source = Path(configured_cache).resolve()
    if not source.is_dir():
        raise ValueError(f"ELECTRON_BUILDER_CACHE is not a directory: {source}")

    destination = cache_folder.resolve()
    print_path_operation("Copying Electron Builder cache", source, destination)
    if source == destination:
        return destination

    force_copy_directory_contents(source, destination)

    return destination


def configure_7zip_environment(environment: dict[str, str]) -> None:
    if "ELECTRON_BUILDER_7ZIP_PATH" in environment:
        return

    executable = shutil.which("7za", path=environment.get("PATH"))
    if executable is not None:
        resolved_executable = str(Path(executable).resolve())
        environment["ELECTRON_BUILDER_7ZIP_PATH"] = resolved_executable
        print(f"Set ELECTRON_BUILDER_7ZIP_PATH to {resolved_executable}")


def configure_dmgbuild_environment(environment: dict[str, str]) -> None:
    if "CUSTOM_DMGBUILD_PATH" in environment:
        return

    executable = shutil.which("dmgbuild", path=environment.get("PATH"))
    if executable is not None:
        resolved_executable = str(Path(executable).resolve())
        environment["CUSTOM_DMGBUILD_PATH"] = resolved_executable
        print(f"Set CUSTOM_DMGBUILD_PATH to {resolved_executable}")


def configure_fpm_environment(environment: dict[str, str]) -> None:
    if "CUSTOM_FPM_PATH" in environment or "USE_SYSTEM_FPM" in environment:
        return

    executable = shutil.which("fpm", path=environment.get("PATH"))
    if executable is not None:
        resolved_executable = str(Path(executable).resolve())
        environment["USE_SYSTEM_FPM"] = "true"
        print(f"Set USE_SYSTEM_FPM=true using {resolved_executable}")


@contextlib.contextmanager
def rpmbuild_openssl_workaround(
    environment: dict[str, str],
) -> Iterator[None]:
    original_path = environment.get("PATH")
    if original_path is None:
        yield

        return

    executable = shutil.which("rpmbuild", path=original_path)
    if executable is None:
        yield

        return

    resolved_executable = str(Path(executable).resolve())
    with tempfile.TemporaryDirectory(
        prefix="auto-package-rpmbuild-",
    ) as temporary_dir:
        launcher = Path(temporary_dir) / "rpmbuild"
        launcher.write_text(
            "#!/bin/sh\n"
            "unset LD_LIBRARY_PATH\n"
            f"exec {shlex.quote(resolved_executable)} \"$@\"\n",
            encoding="utf-8",
        )
        launcher.chmod(0o755)
        environment["PATH"] = os.pathsep.join((temporary_dir, original_path))
        print(
            "Set rpmbuild OpenSSL workaround using "
            f"{resolved_executable}"
        )
        try:
            yield
        finally:
            environment["PATH"] = original_path


def copy_artifact_outputs(manifest_path: Path, electron_dir: Path) -> int:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    artifacts = manifest.get("artifacts") if isinstance(manifest, dict) else None
    if (
        not isinstance(artifacts, list)
        or not artifacts
        or any(not isinstance(artifact, str) or not artifact for artifact in artifacts)
    ):
        raise ValueError(f"Invalid artifact manifest: {manifest_path}")

    sources = [Path(artifact).resolve() for artifact in artifacts]
    missing_sources = [source for source in sources if not source.is_file()]
    if missing_sources:
        for source in missing_sources:
            print(
                f"ERROR: Expected artifact output was not produced: {source}",
                file=sys.stderr,
            )

        return 1

    dist_dir = electron_dir / "dist"
    dist_dir.mkdir(parents=True, exist_ok=True)
    for source in sources:
        destination = dist_dir / source.name
        print_path_operation("Copying artifact output", source, destination)
        shutil.copy2(source, destination)
        print(f"Artifact output: {destination.resolve()}")

    return 0


def replace_electron_tree_from_zip(archive: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        dir=destination.parent,
        prefix=f".{destination.name}-",
    ) as temporary_dir:
        staged_destination = Path(temporary_dir) / "runtime"
        staged_destination.mkdir()
        with zipfile.ZipFile(archive) as runtime_zip:
            for member in runtime_zip.infolist():
                archived_mode = member.external_attr >> 16
                if stat.S_ISLNK(archived_mode):
                    link_target = runtime_zip.read(member).decode("utf-8")
                    extracted = staged_destination / member.filename
                    extracted.parent.mkdir(parents=True, exist_ok=True)
                    os.symlink(link_target, extracted)

                    continue

                extracted = Path(runtime_zip.extract(member, staged_destination))
                mode = archived_mode & 0o7777
                if mode:
                    extracted.chmod(mode)

        remove_path(destination)
        staged_destination.replace(destination)


def package_target(
    options: argparse.Namespace, target: str, script_dir: Path
) -> int:
    script_dir = script_dir.resolve()
    validate_win_sign_option(options.win_sign, target)
    electron_dir = script_dir.parent
    mysqlsh_source = options.mysqlsh.resolve()
    electron_archives = options.electron.resolve()
    electron_destination = electron_dir / "packaging" / "electron" / target
    (
        electron_version,
        package_suffixes,
        electron_builder_cache,
    ) = package_metadata(electron_dir / "package.json")
    wix_source = validate_wix_archive_option(
        options.wix_archive,
        options.installer,
        target,
    )
    environment = os.environ.copy()
    cache_folder = electron_dir / electron_builder_cache
    stage_electron_builder_cache(environment, cache_folder)
    if wix_source is not None:
        stage_wix_archive(wix_source, cache_folder)

    edition = "commercial" if options.commercial else "community"
    output_mode = "installer" if options.installer else "ZIP"
    print(f"Packaging target: {target}")
    print(f"Package edition: {edition}")
    print(f"Output mode: {output_mode}", flush=True)
    package_name_suffix = package_suffixes[edition]
    electron_archive = electron_archives / f"electron-v{electron_version}-{target}.zip"

    print_path_operation(
        "Extracting Electron runtime",
        electron_archive,
        electron_destination,
    )
    replace_electron_tree_from_zip(electron_archive, electron_destination)

    mysqlsh_staging_root = electron_dir / "packaging" / "mysql-shell-staging"
    mysqlsh_destination = mysqlsh_staging_root / target
    print_path_operation(
        "Staging MySQL Shell",
        mysqlsh_source,
        mysqlsh_destination,
    )
    stage_mysqlsh_tree(
        mysqlsh_source,
        mysqlsh_destination,
        cleanup=True,
        optimize_oci=True,
    )

    environment["MYSQL_SHELL_STAGING_ROOT"] = str(mysqlsh_staging_root.resolve())
    configure_7zip_environment(environment)
    mac_installer = options.installer and target.startswith("darwin-")
    if mac_installer:
        configure_dmgbuild_environment(environment)

    linux_installer = options.installer and target.startswith("linux-")
    if linux_installer:
        configure_fpm_environment(environment)

    with tempfile.TemporaryDirectory(
        prefix="auto-package-artifacts-",
    ) as manifest_directory:
        manifest_path = Path(manifest_directory) / "artifacts.json"
        output_argument = "--artifacts" if options.installer else "--zip"
        command = [
            "node",
            "--experimental-strip-types",
            str(script_dir / "package_desktop.ts"),
            f"--targets={target}",
            output_argument,
            f"--artifact-manifest={manifest_path}",
        ]
        if options.win_sign:
            command.append("--win-sign")

        if options.installer and target == "linux-arm64":
            command.append("--skip-deb")

        if options.commercial:
            command.append(f"--package-name-suffix={package_name_suffix}")

        rpmbuild_context = (
            rpmbuild_openssl_workaround(environment)
            if linux_installer
            else contextlib.nullcontext()
        )
        print("Running packaging command:")
        print(f"  Working directory: {electron_dir}")
        print(f"  Command: {format_command(command)}", flush=True)
        with rpmbuild_context:
            result = subprocess.run(
                command,
                check=False,
                cwd=electron_dir,
                env=environment,
            )

        if result.returncode != 0:
            return result.returncode

        return copy_artifact_outputs(manifest_path, electron_dir)


def main(arguments: Optional[Sequence[str]] = None) -> int:
    options = parse_arguments(arguments)

    try:
        target = resolve_platform(platform.system(), platform.machine())

        return package_target(options, target, Path(__file__).resolve().parent)
    except (
        OSError,
        RuntimeError,
        ValueError,
        subprocess.CalledProcessError,
        zipfile.BadZipFile,
    ) as error:
        print(f"ERROR: {error}", file=sys.stderr)

        return 1


if __name__ == "__main__":
    sys.exit(main())
