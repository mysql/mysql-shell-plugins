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

from typing import Optional, Tuple

from .model import ServerType
from ..dbsession import MigrationSession


def get_binlog_info(
    session: MigrationSession,
) -> Tuple[Optional[str], Optional[str], Optional[int]]:
    row = session.run_sql("select @@log_bin, @@binlog_format").fetch_one()
    log_bin = int(row[0])
    format = row[1]
    expiration = None
    gtid_mode = None

    if log_bin:
        if session.nversion >= 56000:
            gtid_mode = session.run_sql("select @@gtid_mode").fetch_one()[0]

        if session.server_type in [ServerType.RDS, ServerType.Aurora]:
            # in rds, we need to use a stored procedure to get expire time
            res = session.run_sql("CALL mysql.rds_show_configuration")
            for row in iter(res.fetch_one, None):
                if row[0] == "binlog retention hours":
                    expiration = int(row[1] or 0) * 3600
        elif session.nversion >= 80000:
            row = session.run_sql(
                "select @@binlog_expire_logs_seconds /*!80029 , @@binlog_expire_logs_auto_purge */"
            ).fetch_one()
            # if auto_purge option doesn't exist, then auto_purge is enabled
            if len(row) == 1 or int(row[1]):
                expiration = int(row[0])

    if log_bin:
        return format, gtid_mode, expiration
    else:
        return None, None, None
