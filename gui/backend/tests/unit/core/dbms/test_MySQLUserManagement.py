# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.

from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = (
    Path(__file__).resolve().parents[4]
    / "gui_plugin"
    / "core"
    / "dbms"
    / "MySQLUserManagement.py"
)
SPEC = importlib.util.spec_from_file_location("MySQLUserManagement", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
mysql_user_management = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = mysql_user_management
SPEC.loader.exec_module(mysql_user_management)

MySQLGrantRequirement = mysql_user_management.MySQLGrantRequirement
create_mysql_user = mysql_user_management.create_mysql_user
grant_mysql_user_privileges = mysql_user_management.grant_mysql_user_privileges
reset_mysql_user_password = mysql_user_management.reset_mysql_user_password
reset_mysql_user_query_limit = mysql_user_management.reset_mysql_user_query_limit


class FakeResult:
    def __init__(self, rows: list[tuple[str, ...]]) -> None:
        self._rows = rows

    def fetch_all(self) -> list[tuple[str, ...]]:
        return self._rows


class FakeSession:
    def __init__(self, available_privileges: tuple[str, ...] = ()) -> None:
        self.available_privileges = available_privileges
        self.calls: list[tuple[str, list[str] | None]] = []

    def run_sql(self, statement: str, parameters: list[str] | None = None) -> FakeResult:
        self.calls.append((statement, parameters))
        if statement == "SHOW PRIVILEGES":
            return FakeResult([(privilege, "", "") for privilege in self.available_privileges])

        return FakeResult([])


class MySQLUserManagementTests(unittest.TestCase):
    def test_account_password_operations_use_parameterized_sql(self) -> None:
        session = FakeSession()

        create_mysql_user(session, "mysqlbackup", "localhost", "created-secret")
        reset_mysql_user_password(session, "mysqlbackup", "localhost", "reset-secret")
        reset_mysql_user_query_limit(session, "mysqlbackup", "localhost")

        self.assertEqual(session.calls, [
            (
                "CREATE USER ?@? IDENTIFIED BY ?",
                ["mysqlbackup", "localhost", "created-secret"],
            ),
            (
                "ALTER USER ?@? IDENTIFIED BY ?",
                ["mysqlbackup", "localhost", "reset-secret"],
            ),
            (
                "ALTER USER ?@? WITH MAX_QUERIES_PER_HOUR 0",
                ["mysqlbackup", "localhost"],
            ),
        ])

    def test_grants_only_selected_privileges_available_on_target(self) -> None:
        session = FakeSession((
            "Select",
            "System_Variables_Admin",
            "Lock Tables",
            "Create",
        ))
        requirements = [
            MySQLGrantRequirement(
                "*.*",
                ("SELECT", "SYSTEM_VARIABLES_ADMIN", "SUPER", "LOCK TABLES"),
            ),
            MySQLGrantRequirement(
                "`mysql`.`backup_history`",
                ("CREATE", "ALTER"),
            ),
        ]

        granted = grant_mysql_user_privileges(
            session,
            "mysqlbackup",
            "localhost",
            requirements,
        )

        self.assertEqual(granted, [
            MySQLGrantRequirement(
                "*.*",
                ("SELECT", "SYSTEM_VARIABLES_ADMIN", "LOCK TABLES"),
            ),
            MySQLGrantRequirement("`mysql`.`backup_history`", ("CREATE",)),
        ])
        self.assertEqual(session.calls, [
            ("SHOW PRIVILEGES", None),
            (
                "GRANT SELECT, SYSTEM_VARIABLES_ADMIN, LOCK TABLES ON *.* TO ?@?",
                ["mysqlbackup", "localhost"],
            ),
            (
                "GRANT CREATE ON `mysql`.`backup_history` TO ?@?",
                ["mysqlbackup", "localhost"],
            ),
        ])

    def test_rejects_untrusted_grant_scope(self) -> None:
        session = FakeSession(("Select",))

        with self.assertRaisesRegex(ValueError, "grant target"):
            grant_mysql_user_privileges(
                session,
                "mysqlbackup",
                "localhost",
                [MySQLGrantRequirement("mysql.*; DROP USER root", ("SELECT",))],
            )

        self.assertEqual(session.calls, [])


if __name__ == "__main__":
    unittest.main()
