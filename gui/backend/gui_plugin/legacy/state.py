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

"""Persistent state for legacy configuration import."""

import json
import os
import tempfile
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, Optional

from gui_plugin.core.Files import (
    ensure_private_directory,
    ensure_private_file,
    get_plugin_data_path,
    secure_existing_file,
)
from gui_plugin.legacy.model import (
    ConfigurationImportManifest,
)

MANIFEST_VERSION = 1
MANIFEST_NAME = "legacy_configuration_import.json"


def empty_state() -> ConfigurationImportManifest:
    return {
        "version": MANIFEST_VERSION,
        "completedPhases": [],
        "records": {
            "connections": {},
        },
    }


def _validate_manifest(data: Any) -> ConfigurationImportManifest:
    if not isinstance(data, dict) or data.get("version") != MANIFEST_VERSION:
        raise ValueError("Unsupported legacy configuration import manifest")
    completed_phases = data.get("completedPhases")
    if (
        not isinstance(completed_phases, list)
        or len(completed_phases) != len(set(completed_phases))
        or not all(isinstance(phase, str) for phase in completed_phases)
    ):
        raise ValueError("Invalid legacy configuration import completion state")
    if not isinstance(data.get("records"), dict):
        raise ValueError("Invalid legacy configuration import records")

    connection_records = data["records"].setdefault("connections", {})
    if not isinstance(connection_records, dict):
        raise ValueError("Invalid imported connection records")

    return data


class ConfigurationImportStateStore:
    """Read and atomically update the legacy configuration import manifest."""

    def __init__(self, shell_root: Optional[Path] = None):
        if shell_root is None:
            manifest_directory = Path(get_plugin_data_path("gui_plugin"))
        else:
            manifest_directory = (
                Path(shell_root) / "plugin_data" / "gui_plugin"
            )
        self.path = manifest_directory / MANIFEST_NAME

    def snapshot(self) -> ConfigurationImportManifest:
        if not self.path.exists():
            return empty_state()
        if self.path.is_symlink() or not self.path.is_file():
            raise ValueError(
                f"Invalid configuration import manifest path: {self.path}"
            )

        with self.path.open("r", encoding="utf8") as manifest_file:
            return _validate_manifest(json.load(manifest_file))

    def is_completed(self, phase_name: str) -> bool:
        return phase_name in self.snapshot()["completedPhases"]

    def complete_phase(self, phase_name: str) -> None:
        manifest = self.snapshot()
        if phase_name not in manifest["completedPhases"]:
            manifest["completedPhases"].append(phase_name)
            manifest["completedPhases"].sort()
            self._write(manifest)

    def connection_mappings(self) -> Dict[str, Any]:
        return deepcopy(self.snapshot()["records"]["connections"])

    def replace_connection_mappings(
        self,
        mappings: Dict[str, Any],
    ) -> None:
        manifest = self.snapshot()
        manifest["records"]["connections"] = deepcopy(mappings)
        self._write(manifest)

    def _write(self, manifest: ConfigurationImportManifest) -> None:
        _validate_manifest(manifest)
        ensure_private_directory(self.path.parent)
        if self.path.exists() or self.path.is_symlink():
            ensure_private_file(self.path)

        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf8",
                prefix=f".{self.path.name}.",
                suffix=".tmp",
                dir=self.path.parent,
                delete=False,
            ) as manifest_file:
                temporary_path = Path(manifest_file.name)
                json.dump(manifest, manifest_file, indent=2, sort_keys=True)
                manifest_file.write("\n")
            secure_existing_file(temporary_path)
            os.replace(temporary_path, self.path)
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
