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
# separately licensed software that they have either included with the
# program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from __future__ import annotations

from dataclasses import dataclass
import ntpath
import posixpath
import sys


@dataclass
class BackupTarget:
    is_windows: bool
    datadir: str | None = None
    config_file_path: str = ""
    is_local: bool = True
    hostname: str = ""
    port: str = ""
    socket: str = ""
    version: str = ""
    basedir: str = ""
    version_compile_os: str = ""
    innodb_data_home_dir: str = ""
    skip_name_resolve: str = ""
    skip_networking: str = "OFF"

    @property
    def version_parts(self) -> tuple[int, int, int]:
        parts: list[int] = []
        for part in self.version.split("-", 1)[0].split("."):
            try:
                parts.append(int(part))
            except ValueError:
                parts.append(0)

        while len(parts) < 3:
            parts.append(0)

        return (parts[0], parts[1], parts[2])

    @classmethod
    def local(
        cls: type[BackupTarget],
        datadir: str | None = None,
        config_file_path: str = "",
        is_windows: bool | None = None,
    ) -> BackupTarget:
        return cls(
            is_windows=sys.platform == "win32" if is_windows is None else is_windows,
            datadir=datadir,
            config_file_path=config_file_path,
            is_local=True,
        )

    def join_path(self, path: str, *paths: str) -> str:
        path_module = ntpath if self.is_windows else posixpath
        return path_module.join(path, *paths)

    def dirname(self, path: str) -> str:
        path_module = ntpath if self.is_windows else posixpath
        return path_module.dirname(path)
