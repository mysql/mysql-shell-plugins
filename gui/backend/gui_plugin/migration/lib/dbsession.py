# Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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

import mysqlsh  # type: ignore
from mysqlsh import DBError  # type: ignore
from typing import Optional
from .backend.model import ServerType
from . import util
from . import logging
import re

shell = mysqlsh.globals.shell


def _parse_version(version: str) -> tuple[int, int, int]:
    m = re.match(r"^(\d+)\.(\d+)(\.(\d+))?", version)
    if m:
        major, minor, _, patch = m.groups()
        return int(major), int(minor), int(patch or 0)

    raise ValueError(f"Could not parse version '{version}'")


def version_to_nversion(version: str) -> int:
    major, minor, patch = _parse_version(version)
    return major * 10000 + minor * 100 + patch


def version_to_release_series(version: str) -> int:
    """Return the OCI target compatibility series for a MySQL version.

    Legacy versions through 9.x use their major version as the series.
    Calendar versions from 26.7 onward are grouped into 24-month series so
    target selection can compare versions in the same supported upgrade
    series without requiring the minor version to be a scheduled release
    month.
    """
    major, minor, _ = _parse_version(version)

    if major <= 9:
        return major

    if major <= 25:
        raise ValueError(f"Version '{version}' is not a supported calendar release")

    months_since_calendar_start = (major - 26) * 12 + minor - 7
    if months_since_calendar_start < 0:
        raise ValueError(f"Version '{version}' predates calendar release 26.7")

    return 10 + months_since_calendar_start // 24


class Session:
    _session = None
    _last_use_schema = None

    def __init__(self, connection_options: dict):
        self.connection_options = connection_options.copy()
        # always require SSL if ssl-mode is not set
        self.connection_options.setdefault("ssl-mode", "REQUIRED")
        self._session = shell.open_session(self.connection_options)

    def __del__(self):
        self.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()

    def use(self, schema: str):
        if schema == self._last_use_schema:
            return
        self.run_sql("USE !", [schema])
        self._last_use_schema = schema

    def run_sql(self, query, args=[]):
        assert self._session
        return self._session.run_sql(query, args)

    def close(self):
        if self._session:
            self._session.close()
            self._session = None


class MigrationSession(Session):
    version: str
    nversion: int
    version_comment: str
    license: str
    _server_type: Optional[ServerType] = None

    def __init__(self, connection_options: dict):
        super().__init__(connection_options)

        self._init()

    def __str__(self):
        opts = util.sanitize_dict(
            self.connection_options.copy(), util.k_san_dict_connection
        )
        return f"<{shell.unparse_uri(opts)}>"

    def _init(self):
        assert self._session
        self.version, self.version_comment, self.license = self._session.run_sql(
            "select @@version, @@version_comment, @@license"
        ).fetch_one()

        # TODO - handle mariadb versions
        self.nversion = version_to_nversion(self.version)

    @property
    def server_type(self) -> ServerType:
        if not self._server_type:
            self._server_type = detect_server_type(self)
            logging.info(f"Server type of {self} is '{self._server_type}'")
        return self._server_type

    @property
    def full_version(self):
        return f"{self.version_comment} {self.version}"


def detect_server_type(session: MigrationSession) -> ServerType:
    # Checked with mariadb 10.3.39
    if "MariaDB" in session.version_comment:
        return ServerType.MariaDB
    # Checked with percona 5.7.44
    if "Percona" in session.version_comment:
        return ServerType.Percona
    if (
        "MySQL Enterprise - Cloud" == session.version_comment
        and session.version.endswith("-cloud")
    ):
        return ServerType.HeatWave

    (datadir,) = session.run_sql("select @@basedir").fetch_one()
    if datadir.startswith("/rdsdbbin/mysql"):
        return ServerType.RDS

    if datadir.startswith("/rdsdbbin/oscar"):
        return ServerType.Aurora

    return ServerType.MySQL
