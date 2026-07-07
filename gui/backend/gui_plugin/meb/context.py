# Copyright (c) 2012, 2026, Oracle and/or its affiliates.
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

from typing import Any

from .backend_controller import LocalMebServerHelper, MebControllerBackend
from .target import BackupTarget


class BackupContext(object):
    def __init__(
        self,
        target: BackupTarget,
        backend: MebControllerBackend,
        session: Any | None = None,
    ) -> None:
        self.target: BackupTarget = target
        self.backend: MebControllerBackend = backend
        self.session: Any | None = session
        self.session_user: str | None = None

    @property
    def is_local(self) -> bool:
        return self.target.is_local

    @property
    def has_connection(self) -> bool:
        if self.session is None:
            return False

        is_connected = getattr(self.session, "is_connected", None)
        if callable(is_connected):
            return bool(is_connected())
        if is_connected is not None:
            return bool(is_connected)

        is_open = getattr(self.session, "is_open", None)
        if callable(is_open):
            return bool(is_open())
        if is_open is not None:
            return bool(is_open)

        return False


def create_local_backup_context(
    datadir: str | None = None,
    config_file_path: str = "",
    is_windows: bool | None = None,
    session: Any | None = None,
) -> BackupContext:
    """Create a local-only BackupContext for Windows, macOS, or Linux targets."""
    target = BackupTarget.local(
        datadir=datadir,
        config_file_path=config_file_path,
        is_windows=is_windows,
    )
    if session is not None:
        result = session.run_sql(
            "SHOW VARIABLES WHERE Variable_name IN ("
            "?, ?, ?, ?, ?, ?, ?, ?, ?, ?"
            ")",
            [
                "basedir",
                "datadir",
                "hostname",
                "innodb_data_home_dir",
                "port",
                "skip_name_resolve",
                "skip_networking",
                "socket",
                "version",
                "version_compile_os",
            ],
        )
        if result is not None:
            for row in iter(result.fetch_one, None):
                variable_name = str(row[0])
                value = "" if row[1] is None else str(row[1])
                if variable_name == "basedir":
                    target.basedir = value
                elif variable_name == "datadir":
                    target.datadir = value
                elif variable_name == "hostname":
                    target.hostname = value
                elif variable_name == "innodb_data_home_dir":
                    target.innodb_data_home_dir = value
                elif variable_name == "port":
                    target.port = value
                elif variable_name == "skip_name_resolve":
                    target.skip_name_resolve = value
                elif variable_name == "skip_networking":
                    target.skip_networking = value
                elif variable_name == "socket":
                    target.socket = value
                elif variable_name == "version":
                    target.version = value
                elif variable_name == "version_compile_os":
                    target.version_compile_os = value

    backend = MebControllerBackend(LocalMebServerHelper(target))

    return BackupContext(target, backend, session)
