# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.

from __future__ import annotations

import importlib.util
import sys
import types
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[3]
GUI_PLUGIN_ROOT = BACKEND_ROOT / "gui_plugin"
MEB_ROOT = GUI_PLUGIN_ROOT / "meb"
DBMS_ROOT = GUI_PLUGIN_ROOT / "core" / "dbms"

gui_plugin_package = types.ModuleType("gui_plugin")
gui_plugin_package.__path__ = [GUI_PLUGIN_ROOT.as_posix()]  # type: ignore[attr-defined]
core_package = types.ModuleType("gui_plugin.core")
core_package.__path__ = [(GUI_PLUGIN_ROOT / "core").as_posix()]  # type: ignore[attr-defined]
dbms_package = types.ModuleType("gui_plugin.core.dbms")
dbms_package.__path__ = [DBMS_ROOT.as_posix()]  # type: ignore[attr-defined]
meb_package = types.ModuleType("gui_plugin.meb")
meb_package.__path__ = [MEB_ROOT.as_posix()]  # type: ignore[attr-defined]

sys.modules.setdefault("gui_plugin", gui_plugin_package)
sys.modules.setdefault("gui_plugin.core", core_package)
sys.modules.setdefault("gui_plugin.core.dbms", dbms_package)
sys.modules.setdefault("gui_plugin.meb", meb_package)


def load_module(module_name: str, path: Path) -> types.ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)

    return module


user_management = load_module(
    "gui_plugin.core.dbms.MySQLUserManagement",
    DBMS_ROOT / "MySQLUserManagement.py",
)
grant_policy = load_module(
    "gui_plugin.meb.grant_policy",
    MEB_ROOT / "grant_policy.py",
)
MySQLGrantRequirement = user_management.MySQLGrantRequirement


class GrantResult:
    def __init__(self, rows: list[tuple[object, ...]]) -> None:
        self.rows = rows

    def fetch_all(self) -> list[tuple[object, ...]]:
        return self.rows


class GrantSession:
    def __init__(
        self,
        grants: list[str],
        roles: list[tuple[str, str]] | None = None,
        all_roles: list[tuple[str, str]] | None = None,
        role_variables: dict[str, object] | None = None,
    ) -> None:
        self.grants = grants
        self.roles = roles or []
        self.all_roles = all_roles or []
        self.role_variables = role_variables or {
            "activate_all_roles_on_login": "OFF",
            "mandatory_roles": "",
        }
        self.statements: list[tuple[str, object]] = []

    def run_sql(self, statement: str, params: object = None) -> GrantResult:
        self.statements.append((statement, params))
        if statement == "SHOW PRIVILEGES":
            return GrantResult([
                ("SELECT",), ("BACKUP_ADMIN",), ("CREATE",), ("INSERT",), ("DROP",),
                ("UPDATE",), ("ALTER",),
            ])
        if statement.startswith("SELECT DEFAULT_ROLE_USER"):
            return GrantResult(self.roles)
        if statement.startswith("SHOW GLOBAL VARIABLES WHERE Variable_name IN"):
            return GrantResult([(name, value) for name, value in self.role_variables.items()])
        if statement.startswith("SELECT FROM_USER, FROM_HOST FROM mysql.role_edges"):
            return GrantResult(self.all_roles)
        if statement.startswith("SHOW GRANTS FOR"):
            return GrantResult([(grant,) for grant in self.grants])
        raise AssertionError(statement)


def common_object_requirements() -> list[object]:
    return [
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


class MebGrantPolicyTests(unittest.TestCase):
    def test_grant_coverage_accepts_required_direct_grants(self) -> None:
        requirements = [
            MySQLGrantRequirement("*.*", ("SELECT", "BACKUP_ADMIN")),
            MySQLGrantRequirement("`mysql`.`backup_history`", ("CREATE", "INSERT")),
        ]
        session = GrantSession([
            "GRANT SELECT, BACKUP_ADMIN ON *.* TO 'mysqlbackup'@'localhost'",
            "GRANT CREATE, INSERT ON `mysql`.`backup_history` TO 'mysqlbackup'@'localhost'",
        ])

        validation = user_management.validate_mysql_user_grants(
            session, "mysqlbackup", "localhost", requirements,
        )
        self.assertTrue(validation.valid)
        self.assertEqual(validation.missing_requirements, ())

    def test_grant_coverage_reports_missing_object_and_dynamic_privileges(self) -> None:
        requirements = [
            MySQLGrantRequirement("*.*", ("SELECT", "BACKUP_ADMIN")),
            MySQLGrantRequirement("`mysql`.`backup_history`", ("CREATE", "INSERT")),
        ]
        session = GrantSession([
            "GRANT ALL PRIVILEGES ON *.* TO 'mysqlbackup'@'localhost'",
            "GRANT CREATE ON `mysql`.`backup_history` TO 'mysqlbackup'@'localhost'",
        ])

        self.assertEqual(
            user_management.missing_mysql_user_privileges(session, "mysqlbackup", "localhost", requirements),
            [
                MySQLGrantRequirement("*.*", ("BACKUP_ADMIN",)),
            ],
        )

    def test_grant_coverage_uses_default_roles(self) -> None:
        requirements = [MySQLGrantRequirement("*.*", ("SELECT", "BACKUP_ADMIN"))]
        session = GrantSession(
            ["GRANT SELECT, BACKUP_ADMIN ON *.* TO 'backup_role'@'%'"],
            [("backup_role", "%")],
        )

        self.assertEqual(
            user_management.missing_mysql_user_privileges(session, "mysqlbackup", "localhost", requirements),
            [],
        )
        self.assertEqual(
            session.statements[-1],
            ("SHOW GRANTS FOR !@! USING !@!", ["mysqlbackup", "localhost", "backup_role", "%"]),
        )

    def test_grant_coverage_uses_all_granted_and_mandatory_roles_when_activated(self) -> None:
        requirements = [MySQLGrantRequirement("*.*", ("SELECT", "BACKUP_ADMIN"))]
        session = GrantSession(
            ["GRANT SELECT, BACKUP_ADMIN ON *.* TO 'backup_role'@'%'"],
            all_roles=[("all_roles_role", "%")],
            role_variables={
                "activate_all_roles_on_login": "ON",
                "activate_mandatory_roles": "OFF",
                "mandatory_roles": "'mandatory_role'@'%'",
            },
        )

        self.assertEqual(
            user_management.missing_mysql_user_privileges(session, "mysqlbackup", "localhost", requirements),
            [],
        )
        self.assertEqual(
            session.statements[-1],
            (
                "SHOW GRANTS FOR !@! USING !@!, !@!",
                [
                    "mysqlbackup", "localhost",
                    "all_roles_role", "%",
                    "mandatory_role", "%",
                ],
            ),
        )

    def test_grant_coverage_uses_mandatory_roles_when_activated(self) -> None:
        requirements = [MySQLGrantRequirement("*.*", ("SELECT",))]
        session = GrantSession(
            ["GRANT SELECT ON *.* TO 'mandatory_role'@'%'"],
            role_variables={
                "activate_all_roles_on_login": "OFF",
                "activate_mandatory_roles": "ON",
                "mandatory_roles": "'mandatory_role'@'%'",
            },
        )

        self.assertEqual(
            user_management.missing_mysql_user_privileges(session, "mysqlbackup", "localhost", requirements),
            [],
        )
        self.assertEqual(
            session.statements[-1],
            ("SHOW GRANTS FOR !@! USING !@!", ["mysqlbackup", "localhost", "mandatory_role", "%"]),
        )

    def test_mandatory_role_parser_accepts_omitted_hosts_and_quoted_commas(self) -> None:
        self.assertEqual(
            user_management._mandatory_role_accounts("`role,one`@`%`,role2,'role,three'@'localhost'"),
            [
                ("role,one", "%"),
                ("role2", "%"),
                ("role,three", "localhost"),
            ],
        )

    def test_grant_coverage_uses_identifier_quoted_account_names(self) -> None:
        requirements = [MySQLGrantRequirement("*.*", ("SELECT",))]
        session = GrantSession(["GRANT SELECT ON *.* TO `backup`@`localhost`"])

        validation = user_management.validate_mysql_user_grants(
            session,
            "backup\\'@example",
            "local\\host'",
            requirements,
        )

        self.assertTrue(validation.valid)
        self.assertEqual(
            session.statements[-1],
            ("SHOW GRANTS FOR !@!", ["backup\\'@example", "local\\host'"]),
        )

    def test_grant_coverage_inherits_global_and_database_privileges(self) -> None:
        requirements = [
            MySQLGrantRequirement("`mysql`.`backup_history`", ("CREATE", "INSERT")),
        ]
        session = GrantSession([
            "GRANT CREATE ON *.* TO `mysqlbackup`@`localhost`",
            "GRANT INSERT ON `mysql`.* TO `mysqlbackup`@`localhost`",
        ])

        validation = user_management.validate_mysql_user_grants(
            session, "mysqlbackup", "localhost", requirements,
        )

        self.assertTrue(validation.valid)

    def test_grant_coverage_recognizes_all_without_privileges_keyword(self) -> None:
        requirements = [MySQLGrantRequirement("*.*", ("SELECT", "CREATE"))]
        session = GrantSession([
            "GRANT ALL ON *.* TO 'mysqlbackup'@'localhost'",
        ])

        validation = user_management.validate_mysql_user_grants(
            session, "mysqlbackup", "localhost", requirements,
        )

        self.assertTrue(validation.valid)

    def test_grant_coverage_parses_trailing_grant_option_clause(self) -> None:
        requirements = [MySQLGrantRequirement("*.*", ("SELECT",))]
        session = GrantSession([
            "GRANT SELECT ON *.* TO 'mysqlbackup'@'localhost' WITH GRANT OPTION",
        ])

        validation = user_management.validate_mysql_user_grants(
            session, "mysqlbackup", "localhost", requirements,
        )

        self.assertTrue(validation.valid)

    def test_mysql_80_policy_uses_documented_super_privilege(self) -> None:
        expected = [
            MySQLGrantRequirement(
                "*.*",
                (
                    "SELECT",
                    "BACKUP_ADMIN",
                    "RELOAD",
                    "PROCESS",
                    "SUPER",
                    "REPLICATION CLIENT",
                ),
            ),
            *common_object_requirements(),
        ]

        self.assertEqual(grant_policy.general_grant_requirements((8, 0, 46)), expected)
        self.assertEqual(grant_policy.general_grant_requirements((8, 3, 0)), expected)

    def test_mysql_84_and_later_policy_uses_system_variables_admin(self) -> None:
        expected = [
            MySQLGrantRequirement(
                "*.*",
                (
                    "SELECT",
                    "BACKUP_ADMIN",
                    "RELOAD",
                    "PROCESS",
                    "SYSTEM_VARIABLES_ADMIN",
                    "REPLICATION CLIENT",
                ),
            ),
            *common_object_requirements(),
        ]

        self.assertEqual(grant_policy.general_grant_requirements((8, 4, 7)), expected)
        self.assertEqual(grant_policy.general_grant_requirements((9, 7, 0)), expected)

    def test_recovery_policy_supports_tts_and_non_tts_operations(self) -> None:
        self.assertEqual(
            grant_policy.recovery_grant_requirements(),
            [
                MySQLGrantRequirement(
                    "*.*",
                    ("LOCK TABLES", "CREATE", "DROP", "FILE", "INSERT", "ALTER"),
                ),
            ],
        )

    def test_policy_rejects_servers_older_than_mysql_80(self) -> None:
        with self.assertRaisesRegex(ValueError, "MySQL 8.0 or later"):
            grant_policy.general_grant_requirements((5, 7, 44))


if __name__ == "__main__":
    unittest.main()
