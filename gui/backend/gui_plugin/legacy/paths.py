# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

"""Platform paths and safety checks for legacy application data."""

import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Sequence


@dataclass(frozen=True)
class SourceCandidate:
    source_id: str
    path: Path
    approved_root: Path


@dataclass(frozen=True)
class LegacySourceRoots:
    workbench_connections: Sequence[SourceCandidate]
    workbench_wrapper: Path
    vscode_extension: Path
    target_root: Path

    @property
    def workbench_projects(self) -> Path:
        return self.workbench_wrapper / "plugin_data" / "migration_plugin"

    @property
    def vscode_projects(self) -> Path:
        return self.vscode_extension / "plugin_data" / "migration_plugin"


def _default_app_data(home: Path, platform: str) -> Path:
    if platform == "win32":
        app_data = os.environ.get("APPDATA")
        if not app_data:
            raise RuntimeError("APPDATA is required to discover legacy data on Windows")

        return Path(app_data)

    return home


def platform_source_roots(
    *,
    home: Optional[Path] = None,
    app_data: Optional[Path] = None,
    platform: Optional[str] = None,
    target_root: Path,
) -> LegacySourceRoots:
    """Return deterministic legacy source candidates for the host platform."""
    host_platform = platform or sys.platform
    user_home = (home or Path.home()).expanduser()
    application_data = app_data or _default_app_data(user_home, host_platform)

    if host_platform == "win32":
        workbench_root = application_data / "MySQL" / "Workbench"
        workbench_connections = (
            SourceCandidate(
                "classic-workbench",
                workbench_root / "connections.xml",
                workbench_root,
            ),
        )
        workbench_wrapper = application_data / "MySQL" / "mysqlsh-wb"
        vscode_extension = application_data / "MySQL" / "mysqlsh-gui"
    else:
        dot_mysql_root = user_home / ".mysql" / "workbench"
        if host_platform == "darwin":
            application_support_root = (
                user_home
                / "Library"
                / "Application Support"
                / "MySQL"
                / "Workbench"
            )
            workbench_connections = (
                SourceCandidate(
                    "classic-workbench-application-support",
                    application_support_root / "connections.xml",
                    application_support_root,
                ),
                SourceCandidate(
                    "classic-workbench-dot-mysql",
                    dot_mysql_root / "connections.xml",
                    dot_mysql_root,
                ),
            )
        else:
            workbench_connections = (
                SourceCandidate(
                    "classic-workbench",
                    dot_mysql_root / "connections.xml",
                    dot_mysql_root,
                ),
            )
        workbench_wrapper = user_home / ".mysqlsh-wb"
        vscode_extension = user_home / ".mysqlsh-gui"

    return LegacySourceRoots(
        workbench_connections=workbench_connections,
        workbench_wrapper=workbench_wrapper,
        vscode_extension=vscode_extension,
        target_root=target_root,
    )


def resolve_source_roots(
    *,
    target_root: Path,
    home: Optional[Path] = None,
    app_data: Optional[Path] = None,
    platform: Optional[str] = None,
) -> LegacySourceRoots:
    """Resolve production roots, with isolated overrides for Electron E2E."""
    if os.environ.get("ELECTRON_E2E") == "1":
        test_home = os.environ.get("ELECTRON_E2E_LEGACY_HOME")
        test_app_data = os.environ.get("ELECTRON_E2E_LEGACY_APP_DATA")
        if test_home:
            home = Path(test_home)
        if test_app_data:
            app_data = Path(test_app_data)

    return platform_source_roots(
        home=home,
        app_data=app_data,
        platform=platform,
        target_root=target_root,
    )


def raise_injected_e2e_failure(name: str) -> None:
    """Raise a deterministic E2E-only failure selected by a marker file."""
    if (
        os.environ.get("ELECTRON_E2E") != "1"
        or "/" in name
        or "\\" in name
        or name in {"", ".", ".."}
    ):
        return
    failure_root = os.environ.get("ELECTRON_E2E_LEGACY_FAILURE_ROOT")
    if not failure_root:
        return
    marker = Path(failure_root) / name
    if marker.is_file():
        raise OSError(
            f"Injected legacy configuration import E2E failure: {name}"
        )


def validate_source_path(
    path: Path,
    *,
    approved_root: Path,
    target_root: Path,
    expect_directory: bool,
) -> Path:
    """Resolve a source and validate its location and expected type."""
    resolved_source = path.expanduser().resolve(strict=True)
    resolved_approved = approved_root.expanduser().resolve(strict=True)
    resolved_target = target_root.expanduser().resolve(strict=False)

    if not resolved_source.is_relative_to(resolved_approved):
        raise ValueError(f"Source escapes its approved legacy root: {path}")
    if resolved_source.is_relative_to(resolved_target):
        raise ValueError(f"Source resolves inside the target data root: {path}")

    if expect_directory and not resolved_source.is_dir():
        raise ValueError(f"Expected a source directory: {path}")
    if not expect_directory and not resolved_source.is_file():
        raise ValueError(f"Expected a regular source file: {path}")

    return resolved_source
