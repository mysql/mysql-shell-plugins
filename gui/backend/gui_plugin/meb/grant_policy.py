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

from gui_plugin.core.dbms.MySQLUserManagement import MySQLGrantRequirement


ServerVersion = tuple[int, int, int]


def general_grant_requirements(server_version: ServerVersion) -> list[MySQLGrantRequirement]:
    if server_version < (8, 0, 0):
        raise ValueError("MEB management requires MySQL 8.0 or later.")

    logging_privilege = "SUPER" if server_version < (8, 4, 0) else "SYSTEM_VARIABLES_ADMIN"

    return [
        MySQLGrantRequirement(
            "*.*",
            (
                "SELECT",
                "BACKUP_ADMIN",
                "RELOAD",
                "PROCESS",
                logging_privilege,
                "REPLICATION CLIENT",
            ),
        ),
        MySQLGrantRequirement(
            "`mysql`.`backup_progress`",
            ("CREATE", "INSERT", "DROP", "UPDATE", "ALTER"),
        ),
        MySQLGrantRequirement(
            "`mysql`.`backup_history`",
            ("CREATE", "INSERT", "DROP", "UPDATE", "SELECT", "ALTER"),
        ),
        MySQLGrantRequirement(
            "`mysql`.`backup_progress_old`",
            ("CREATE", "INSERT", "DROP"),
        ),
        MySQLGrantRequirement(
            "`mysql`.`backup_progress_new`",
            ("CREATE", "INSERT", "DROP", "ALTER"),
        ),
        MySQLGrantRequirement(
            "`mysql`.`backup_history_old`",
            ("CREATE", "INSERT", "DROP"),
        ),
        MySQLGrantRequirement(
            "`mysql`.`backup_history_new`",
            ("CREATE", "INSERT", "DROP", "ALTER"),
        ),
    ]

def recovery_grant_requirements() -> list[MySQLGrantRequirement]:
    return [
        MySQLGrantRequirement(
            "*.*",
            ("LOCK TABLES", "CREATE", "DROP", "FILE", "INSERT", "ALTER"),
        ),
    ]
