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

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from gui_plugin.migration.lib.backend.model import ServerType
from gui_plugin.migration.lib.dbsession import detect_server_type


@pytest.mark.parametrize(
    "version, comment",
    [
        ("10.11.19-MariaDB-ubu2404", "Ubuntu 24.04"),
        ("11.4.8-MariaDB", "mariadb.org binary distribution"),
        ("5.5.5-10.11.19-MariaDB", "Source distribution"),
        ("10.3.39", "MariaDB Server"),
        ("10.11.19", "mariadb.org binary distribution"),
        ("11.4.8", "MARIADB SERVER"),
    ],
)
def test_detect_mariadb(version, comment):
    session = SimpleNamespace(version=version, version_comment=comment, run_sql=Mock())

    assert detect_server_type(session) == ServerType.MariaDB
    session.run_sql.assert_not_called()


@pytest.mark.parametrize(
    "comment, basedir, expected",
    [
        ("MySQL Community Server - GPL", "/usr/", ServerType.MySQL),
        ("Percona Server (GPL)", "/usr/", ServerType.Percona),
        ("MySQL Enterprise - Cloud", "/usr/", ServerType.HeatWave),
        ("Source distribution", "/rdsdbbin/mysql/", ServerType.RDS),
        ("Source distribution", "/rdsdbbin/oscar/", ServerType.Aurora),
    ],
)
def test_detect_mysql_variants(comment, basedir, expected):
    session = SimpleNamespace(
        version="8.4.6-cloud", version_comment=comment, run_sql=Mock()
    )
    session.run_sql.return_value.fetch_one.return_value = (basedir,)

    assert detect_server_type(session) == expected
