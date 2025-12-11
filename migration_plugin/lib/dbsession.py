# Copyright (c) 2025, Oracle and/or its affiliates.
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


def version_to_nversion(v):
    m = re.match(r"^(\d+)\.(\d+)(\.(\d+))?", v)
    if m:
        major, minor, _, patch = m.groups()

        if patch is not None:
            return int(major) * 10000 + int(minor) * 100 + int(patch)
        else:
            return int(major) * 10000 + int(minor) * 100

    raise ValueError(f"Could not parse version '{v}'")


class Session:
    _session = None

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

    # TODO - check whats @@basedir in aurora
    try:
        session.run_sql("select aurora_version()").fetch_one()
        return ServerType.Aurora
    except:
        pass

    (datadir,) = session.run_sql("select @@basedir").fetch_one()
    if datadir.startswith("/rdsdbbin/mysql"):
        return ServerType.RDS

    return ServerType.MySQL
