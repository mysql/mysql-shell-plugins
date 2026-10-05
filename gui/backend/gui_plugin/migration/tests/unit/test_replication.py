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

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, call

import mysqlsh
import pytest

from gui_plugin.migration.lib.backend.checks import check_inbound_replication_requirements
from gui_plugin.migration.lib.backend.model import MessageLevel, ServerType
from gui_plugin.migration.lib.backend.replication import get_binlog_info


def mock_result(*rows):
    result = Mock()
    result.fetch_one.side_effect = [*rows, None]
    return result


@pytest.mark.parametrize("nversion", [100339, 100511, 100600])
@pytest.mark.parametrize(
    "days, expiration",
    [(Decimal("0"), None), (Decimal("1.5"), 129600), (Decimal("7"), 604800)],
)
def test_older_mariadb_binlog_info(nversion, days, expiration):
    session = SimpleNamespace(
        nversion=nversion, server_type=ServerType.MariaDB, run_sql=Mock()
    )
    session.run_sql.side_effect = [
        mock_result((1, "ROW")),
        mock_result((days,)),
    ]

    assert get_binlog_info(session) == ("ROW", None, expiration)
    assert session.run_sql.call_args_list == [
        call("select @@log_bin, @@binlog_format"),
        call("select @@expire_logs_days"),
    ]


@pytest.mark.parametrize("nversion", [100601, 101119, 110408])
@pytest.mark.parametrize("seconds, expiration", [(0, None), (1800, 1800), (3600, 3600)])
def test_mariadb_binlog_info(nversion, seconds, expiration):
    session = SimpleNamespace(
        nversion=nversion, server_type=ServerType.MariaDB, run_sql=Mock()
    )
    session.run_sql.side_effect = [
        mock_result((1, "ROW")),
        mock_result((seconds,)),
    ]

    assert get_binlog_info(session) == ("ROW", None, expiration)
    assert session.run_sql.call_args_list == [
        call("select @@log_bin, @@binlog_format"),
        call("select @@binlog_expire_logs_seconds"),
    ]


@pytest.mark.parametrize(
    "nversion, retention, expected_level",
    [
        (100339, Decimal("0"), None),
        (100600, Decimal("0"), None),
        (100601, 0, None),
        (101119, 0, None),
        (110408, 0, None),
        (100339, Decimal("0.000001"), MessageLevel.ERROR),
        (100339, Decimal("0.5"), MessageLevel.WARNING),
        (100339, Decimal("1"), None),
        (101119, 900, MessageLevel.ERROR),
        (101119, 3600, MessageLevel.WARNING),
        (101119, 86400, None),
    ],
)
def test_mariadb_retention_replication_check(nversion, retention, expected_level):
    session = SimpleNamespace(
        nversion=nversion, server_type=ServerType.MariaDB, run_sql=Mock()
    )
    session.run_sql.side_effect = [
        mock_result((1, "ROW")),
        mock_result((retention,)),
    ]

    error = check_inbound_replication_requirements(
        session, SimpleNamespace(sslSupported=True)
    )

    if expected_level is None:
        assert error is None
    else:
        assert error is not None
        assert error.level == expected_level


@pytest.mark.parametrize("server_type", [ServerType.MySQL, ServerType.MariaDB])
def test_disabled_binlog(server_type):
    session = SimpleNamespace(nversion=101119, server_type=server_type, run_sql=Mock())
    session.run_sql.return_value = mock_result((0, "ROW"))

    assert get_binlog_info(session) == (None, None, None)
    session.run_sql.assert_called_once_with("select @@log_bin, @@binlog_format")


@pytest.mark.parametrize(
    "nversion, gtid_mode, expire_row, expiration",
    [
        (50562, None, None, None),
        (50600, None, None, None),
        (50604, None, None, None),
        (50605, "OFF", None, None),
        (50744, "ON", None, None),
        (80000, "ON", (3600,), 3600),
        (80029, "OFF", (3600, 0), None),
        (80406, "ON", (3600, 1), 3600),
        (260700, "ON", (3600, 1), 3600),
    ],
)
def test_mysql_binlog_info(nversion, gtid_mode, expire_row, expiration):
    session = SimpleNamespace(
        nversion=nversion, server_type=ServerType.MySQL, run_sql=Mock()
    )
    queries = [call("select @@log_bin, @@binlog_format")]
    results = [mock_result((1, "ROW"))]
    if gtid_mode is not None:
        queries.append(call("select @@gtid_mode"))
        results.append(mock_result((gtid_mode,)))
    if expire_row is not None:
        queries.append(
            call(
                "select @@binlog_expire_logs_seconds /*!80029 , @@binlog_expire_logs_auto_purge */"
            )
        )
        results.append(mock_result(expire_row))
    session.run_sql.side_effect = results

    assert get_binlog_info(session) == ("ROW", gtid_mode, expiration)
    assert session.run_sql.call_args_list == queries


@pytest.mark.parametrize("server_type", [ServerType.RDS, ServerType.Aurora])
def test_rds_binlog_retention(server_type):
    session = SimpleNamespace(nversion=80406, server_type=server_type, run_sql=Mock())
    session.run_sql.side_effect = [
        mock_result((1, "ROW")),
        mock_result(("ON",)),
        mock_result(("other setting", 0), ("binlog retention hours", 24)),
    ]

    assert get_binlog_info(session) == ("ROW", "ON", 86400)
    assert session.run_sql.call_args_list == [
        call("select @@log_bin, @@binlog_format"),
        call("select @@gtid_mode"),
        call("CALL mysql.rds_show_configuration"),
    ]


@pytest.mark.parametrize("code", [1193, 2013])
def test_mysql_gtid_error_is_not_ignored(code):
    session = SimpleNamespace(
        nversion=80406, server_type=ServerType.MySQL, run_sql=Mock()
    )
    error = mysqlsh.DBError(code, "GTID query failed", "HY000")
    session.run_sql.side_effect = [mock_result((1, "ROW")), error]

    with pytest.raises(mysqlsh.DBError) as exp:
        get_binlog_info(session)
    assert exp.value is error
