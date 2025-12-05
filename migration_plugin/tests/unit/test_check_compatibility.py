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

from migration_plugin.lib.backend.model import CheckStatus, CompatibilityFlags, DBSystemOptions, IncludeList, MessageLevel, MigrationCheckResults, MigrationOptions, CompatibilityFlags
from migration_plugin.lib.backend.source_check import MySQLSourceCheck
import mysqlsh  # type: ignore
import pathlib
import pytest

from .helpers import execute_script, server_version, shell_version


def load_compatibility_issues(session):
    execute_script(session, pathlib.Path(__file__).parent.parent /
                   "sql" / "compatibility_issues.sql")


def cleanup_compatibility_issues(session):
    execute_script(session, pathlib.Path(__file__).parent.parent /
                   "sql" / "compatibility_issues_cleanup.sql")


@pytest.fixture(scope="module", autouse=True)
def setup_test(sandbox_session):
    cleanup_compatibility_issues(session=sandbox_session)
    load_compatibility_issues(session=sandbox_session)
    yield
    cleanup_compatibility_issues(session=sandbox_session)


def setup_migration_options(session) -> MigrationOptions:
    options = MigrationOptions()

    options.sourceConnectionOptions = mysqlsh.globals.shell.parse_uri(
        session.uri
    )

    options.filters.schemas = IncludeList()
    options.filters.schemas.include = ["compatibility_issues"]

    options.filters.users = IncludeList()
    options.filters.users.exclude = [
        "admin", "root", "skipped_role", "skipped_user",
    ]

    options.targetMySQLOptions = DBSystemOptions()
    options.targetMySQLOptions.mysqlVersion = shell_version()

    return options


def run_compatibility_checks(options: MigrationOptions) -> MigrationCheckResults:
    source_check = MySQLSourceCheck(options)
    assert not source_check.check_connection().connectError

    return source_check.check_compatibility(options.compatibilityFlags, options.filters)


def validate_checks(expected: MigrationCheckResults, actual: MigrationCheckResults) -> None:
    for expected_check in expected.checks:
        check = None

        for c in actual.checks:
            if expected_check.checkId == c.checkId:
                check = c
                break

        assert check, f"Check: {expected_check.checkId}, all checks: {actual.checks}"

        for attribute in ["level", "title", "result", "description", "objects", "choices", "status"]:
            if getattr(expected_check, attribute) is not None:
                assert getattr(expected_check, attribute) == getattr(
                    check, attribute), f"Check: {expected_check.checkId}, attribute: {attribute}"


def test_check_compatibility(sandbox_session):
    acutal_issues = run_compatibility_checks(
        setup_migration_options(sandbox_session))

    expected_issues = MigrationCheckResults()

    expected_issues._add_check(
        "user/unsupported_auth_plugin",
        MessageLevel.ERROR,
        "Authentication Plugin Compatibility",
        "<li>User 'unsupported_auth_plugin'@'localhost' is using an unsupported authentication plugin 'mysql_no_login'",
        """The following user accounts use unsupported authentication plugins and will be locked in the target MySQL.

The listed accounts use authentication plugins that are not supported by MySQL.
They will still be migrated, but they will be created LOCKED and their password
must be changed before they can connect to MySQL.

You may also manually convert these accounts to
<a href="https://dev.mysql.com/doc/refman/en/caching-sha2-pluggable-authentication.html">caching_sha2_password</a>
before migrating and reset their password; or exclude them from being migrated.""",
        ["user:'unsupported_auth_plugin'@'localhost'"],
        [
            CompatibilityFlags.lock_invalid_accounts,
            CompatibilityFlags.skip_invalid_accounts,
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    expected_issues._add_check(
        "user/deprecated_auth_plugin",
        MessageLevel.WARNING,
        "Authentication Plugin Deprecation",
        "<li>User 'deprecated_auth_plugin'@'localhost' is using a deprecated authentication plugin 'sha256_password'",
        """The following user accounts use deprecated authentication plugins.

The listed accounts use authentication plugins that soon will not be supported
by MySQL. They will still be migrated, but they may require some additional
maintenance once the migration is finished.

Note: the deprecated mysql_native_password plugin has been replaced by
caching_sha2_password, which is more secure.

You may also manually convert these accounts to
<a href="https://dev.mysql.com/doc/refman/en/caching-sha2-pluggable-authentication.html">
caching_sha2_password</a> before
migrating and reset their password; or exclude them from being migrated.""",
        ["user:'deprecated_auth_plugin'@'localhost'"],
        [
            CompatibilityFlags.IGNORE,
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    expected_issues._add_check(
        "user/no_password",
        MessageLevel.ERROR,
        "User Password Requirements",
        "<li>User 'no_password'@'localhost' does not have a password set",
        """The following user accounts have no password and will be locked in the target MySQL.

The listed accounts have a blank password, which is
<a href="https://docs.oracle.com/en-us/iaas/mysql-database/doc/plugins-and-components.html#GUID-0EE82DBE-75A0-4ABA-8C4C-1DB47FB05C7F__UL_M12_CHZ_CTB">
not allowed</a> in the MySQL
HeatWave Service. They will still be migrated, but they will be created LOCKED
and their password must be changed before they can connect to MySQL.

You may also set a password before migrating or exclude the user from being
migrated.""",
        ["user:'no_password'@'localhost'"],
        [
            CompatibilityFlags.lock_invalid_accounts,
            CompatibilityFlags.skip_invalid_accounts,
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    expected_issues._add_check(
        "user/restricted_grants",
        MessageLevel.ERROR,
        "Restricted Grants",
        "<li>User 'restricted_grants'@'localhost' is granted restricted privilege: FILE",
        """The following user accounts have GRANTs that are restricted and will be updated.

MySQL HeatWave Service restricts certain privileges from regular user accounts
so they will be removed from the grant list of accounts when created at the
target database. All other things will remain the same, including password and
remaining grants.

<a href="https://docs.oracle.com/en-us/iaas/mysql-database/doc/default-mysql-privileges.html">
Read more</a>""",
        ["user:'restricted_grants'@'localhost'"],
        [
            CompatibilityFlags.strip_restricted_grants,
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    expected_issues._add_check(
        "user/invalid_grants",
        MessageLevel.ERROR,
        "Invalid Grants",
        "<li>User 'invalid_grants'@'localhost' has grant statement on a non-existent table (GRANT SELECT ON `compatibility_issues`.`invalid_grants_v` TO `invalid_grants`@`localhost`)",
        """The following user accounts have GRANTs on non-existent objects and will be updated.

GRANTs on non-existent objects will be commented out and will not be executed
at the target database.""",
        ["user:'invalid_grants'@'localhost'"],
        [
            CompatibilityFlags.strip_invalid_grants,
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    expected_issues._add_check(
        "user/wildcard_grant",
        MessageLevel.ERROR,
        "Grant Syntax Compatibility",
        "<li>User 'escaped_wildcard_grant'@'localhost' has a wildcard grant statement at the database level (GRANT SELECT ON `compatibility_issues\\%`.* TO `escaped_wildcard_grant`@`localhost`)\n"
        "<li>User 'wildcard_grant'@'localhost' has a wildcard grant statement at the database level (GRANT SELECT ON `compatibility_issues%`.* TO `wildcard_grant`@`localhost`)",
        """The following user accounts have wildcard GRANTs at schema level.

MySQL HeatWave Service has the
<a href="https://dev.mysql.com/doc/refman/en/server-system-variables.html#sysvar_partial_revokes">
partial_revokes</a> system variable enabled by
default, which causes wildcard characters to be interpreted literally.""",
        [
            "user:'escaped_wildcard_grant'@'localhost'",
            "user:'wildcard_grant'@'localhost'"
        ],
        [
            CompatibilityFlags.ignore_wildcard_grants,
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    expected_issues._add_check(
        "user/escaped_wildcard_grant",
        MessageLevel.WARNING,
        "Grant Syntax Compatibility",
        "<li>User 'escaped_wildcard_grant'@'localhost' has a wildcard grant statement at the database level which is using escaped wildcard characters (compatibility_issues\\%)",
        """The following user accounts have escaped wildcard GRANTs at schema level.

MySQL HeatWave Service has the
<a href="https://dev.mysql.com/doc/refman/en/server-system-variables.html#sysvar_partial_revokes">
partial_revokes</a> system variable enabled by
default, which causes both escape characters and wildcard characters to be
interpreted literally.""",
        ["user:'escaped_wildcard_grant'@'localhost'"],
        [
            CompatibilityFlags.unescape_wildcard_grants,
            CompatibilityFlags.IGNORE,
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    expected_issues._add_check(
        "user/grant_on_missing_object",
        MessageLevel.WARNING,
        "Grants on Missing Objects",
        "<li>User 'grant_on_missing_object'@'localhost' has a grant statement on an object which is not included in the dump (GRANT SELECT ON `compatibility_issues_skipped`.`grant_on_missing_object` TO `grant_on_missing_object`@`localhost`)",
        """The following user accounts have grants on objects that will not be migrated.

Grants on objects that do not exist will fail to execute, so they must be removed.""",
        ["user:'grant_on_missing_object'@'localhost'"],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    expected_issues._add_check(
        "user/grant_on_missing_role",
        MessageLevel.WARNING,
        "Grants on Missing Roles",
        "<li>User 'grant_on_missing_role'@'localhost' has a grant statement on a role `skipped_role`@`%` which is not included in the dump (GRANT `skipped_role`@`%` TO `grant_on_missing_role`@`localhost`)",
        """The following user accounts have roles that will not be migrated.

All such roles will not be granted to the migrated user accounts.""",
        ["user:'grant_on_missing_role'@'localhost'"],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    # TODO: schema/encryption - requires keyring plugin/component

    expected_issues._add_check(
        "view/invalid_reference",
        MessageLevel.WARNING,
        "View with Invalid References",
        "<li>View `compatibility_issues`.`invalid_reference` references table/view `compatibility_issues_skipped`.`invalid_reference` which is not included in the dump",
        """Views containing references to skipped tables must be excluded or manually repaired.

The following views contain references to tables that could not be found in list
of tables to be migrated. They must be manually fixed or excluded before
continuing.""",
        ["view:`compatibility_issues`.`invalid_reference`"],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    # TODO: view/mismatched_reference - requires MacOS/Windows

    expected_issues._add_check(
        "view/invalid_definition",
        MessageLevel.ERROR,
        "View with Invalid Definition",
        "<li>View `compatibility_issues`.`invalid_definition_v` references invalid table(s) or column(s) or function(s) or definer/invoker of view lack rights to use them",
        """Views containing invalid references must be excluded or manually repaired.

The following views contain references to invalid tables/columns/functions or
definer/invoker of these views lack rights to use them. They must be manually
fixed or excluded before continuing.""",
        ["view:`compatibility_issues`.`invalid_definition_v`"],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "table/unsupported_engine",
        MessageLevel.ERROR,
        "Table with Unsupported Storage Engine",
        "<li>Table `compatibility_issues`.`unsupported_engine` uses unsupported storage engine MyISAM\n"
        "<li>Table `compatibility_issues`.`unsupported_row_format` uses unsupported storage engine MyISAM",
        """The tables below will be converted to the InnoDB storage engine.

Tables are required to use the high-performance, transactional InnoDB storage
engine. Non-InnoDB tables will be automatically converted to InnoDB in the
migrated database.""",
        [
            "table:`compatibility_issues`.`unsupported_engine`",
            "table:`compatibility_issues`.`unsupported_row_format`",
        ],
        [
            CompatibilityFlags.force_innodb,
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    expected_issues._add_check(
        "table/cannot_replace_engine",
        MessageLevel.ERROR,
        "Incompatible Table with Unsupported Storage Engine",
        "<li>Table `compatibility_issues`.`incompatible_with_innodb` uses unsupported storage engine MyISAM which cannot be changed to InnoDB due to the following error: Incorrect table definition; there can be only one auto column and it must be defined as a key\n"
        "<li>Table `compatibility_issues`.`too_many_columns` uses unsupported storage engine MyISAM which cannot be changed to InnoDB due to the following error: Table has too many columns",
        """The tables below cannot be converted to the InnoDB storage engine.

The following tables are incompatible with the InnoDB storage engine and must be
excluded or manually repaired.""",
        [
            "table:`compatibility_issues`.`incompatible_with_innodb`",
            "table:`compatibility_issues`.`too_many_columns`",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "table/missing_pk",
        MessageLevel.ERROR,
        "Table Missing Primary Key or Equivalent",
        "<li>Table `compatibility_issues`.`missing_pk_manual_fix` does not have a Primary Key, which is required for High Availability in MySQL HeatWave Service\n"
        "<li>Table `compatibility_issues`.`missing_pk` does not have a Primary Key, which is required for High Availability in MySQL HeatWave Service",
        """The tables below do not have PRIMARY KEYs and will have one added.

In order to offer High Availability, the MySQL HeatWave Service requires all
tables to have either a PRIMARY KEY or a UNIQUE KEY on a NOT NULL column.

The MySQL HeatWave Service will automatically and transparently add a
<a href="https://dev.mysql.com/doc/refman/8.4/en/create-table-gipks.html">
Generated Invisible Primary Key (GIPK)</a> to your migrated tables at the destination.

You may select specific tables to be Excluded instead, if you prefer to not
migrate them.

<a href="https://docs.oracle.com/en-us/iaas/mysql-database/doc/prerequisites1.html">
MySQL HeatWave Service Pre-requisites</a>""",
        [
            "table:`compatibility_issues`.`missing_pk_manual_fix`",
            "table:`compatibility_issues`.`missing_pk`",
        ],
        [
            CompatibilityFlags.create_invisible_pks,
            CompatibilityFlags.ignore_missing_pks,
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    # TODO: table/data_or_index_directory - requires server to be started with
    # --symbolic-links (MyISAM) or adding DATA directory to i.e.
    # innodb_directories sysvar (InnoDB)

    # TODO: table/encryption - requires keyring plugin/component

    expected_issues._add_check(
        "table/tablespace",
        MessageLevel.ERROR,
        "Unsupported Tablespace Option for Table",
        "<li>Table `compatibility_issues`.`t_space` uses unsupported tablespace option",
        """The <code>TABLESPACE</code> option will be removed from the following tables.

The MySQL HeatWave Service places some restrictions on tablespaces and they will
not be migrated. Tables that use the <code>TABLESPACE</code> option will be
modified to be placed in the default tablespace in the migrated database.""",
        ["table:`compatibility_issues`.`t_space`"],
        [
            CompatibilityFlags.strip_tablespaces,
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    expected_issues._add_check(
        "table/unsupported_row_format",
        MessageLevel.ERROR,
        "Unsupported Row Format for Table",
        "<li>Table `compatibility_issues`.`unsupported_row_format` uses unsupported ROW_FORMAT=FIXED option",
        """The <code>ROW_FORMAT=FIXED</code> option will be removed from the following tables.

The MySQL HeatWave Service does not support fixed row format. Tables that use
this format will be modified and <code>ROW_FORMAT</code> option will be removed.""",
        ["table:`compatibility_issues`.`unsupported_row_format`"],
        [
            CompatibilityFlags.force_innodb,
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    expected_issues._add_check(
        "table/too_many_columns",
        MessageLevel.ERROR,
        "Table Has Too Many Columns",
        "<li>Table `compatibility_issues`.`too_many_columns` has 1018 columns, while the limit for the InnoDB engine is 1017 columns",
        """Table has too many columns and must be excluded or manually repaired.

The following tables have more columns than the limit for the InnoDB engine
(1017). They must be manually fixed or excluded before continuing.""",
        ["table:`compatibility_issues`.`too_many_columns`"],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "object/restricted_definer",
        MessageLevel.ERROR,
        "DEFINER Set to a Restricted User",
        "<li>View `compatibility_issues`.`restricted_definer_v` - definition uses DEFINER clause set to user `ociadmin`@`localhost` whose user name is restricted in MySQL HeatWave Service",
        """The <code>DEFINER</code> clause of the following objects will be removed because they are set to a restricted account.

Certain user account names are
<a href="https://docs.oracle.com/en-us/iaas/mysql-database/doc/reserved-usernames.html">reserved</a>
to MySQL HeatWave Service and cannot be
used by regular users. Any objects that have the <code>DEFINER</code> clause set
to such a user will have to be modified to remove the definer and default to the
<code>admin@%</code> account.

You may manually update the DEFINER to a different one before or after migrating
them or exclude them altogether.""",
        ["view:`compatibility_issues`.`restricted_definer_v`"],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    # TODO: object/invalid_definer - this is reported only if target server does not support SET_ANY_DEFINER

    # object/invalid_definer_users_not_dumped - tested in test_check_compatibility_no_users()

    expected_issues._add_check(
        "object/invalid_definer_missing_user",
        MessageLevel.WARNING,
        "Invalid DEFINER Clause",
        "<li>Event `compatibility_issues`.`invalid_definer_missing_user_e` - definition uses DEFINER clause set to user `skipped_user`@`localhost` which does not exist or is not included\n"
        "<li>Function `compatibility_issues`.`invalid_definer_missing_user_f` - definition uses DEFINER clause set to user `skipped_user`@`localhost` which does not exist or is not included\n"
        "<li>Procedure `compatibility_issues`.`invalid_definer_missing_user_p` - definition uses DEFINER clause set to user `skipped_user`@`localhost` which does not exist or is not included\n"
        "<li>Trigger `compatibility_issues`.`invalid_definer_missing_user_t`.`invalid_definer_missing_user_tt` - definition uses DEFINER clause set to user `skipped_user`@`localhost` which does not exist or is not included\n"
        "<li>View `compatibility_issues`.`invalid_definer_missing_user_v` - definition uses DEFINER clause set to user `skipped_user`@`localhost` which does not exist or is not included\n"
        "<li>View `compatibility_issues`.`invalid_definition_v` - definition uses DEFINER clause set to user `root`@`%` which does not exist or is not included\n"
        "<li>View `compatibility_issues`.`invalid_reference` - definition uses DEFINER clause set to user `root`@`%` which does not exist or is not included\n"
        "<li>View `compatibility_issues`.`restricted_definer_v` - definition uses DEFINER clause set to user `ociadmin`@`localhost` which does not exist or is not included",
        """<code>DEFINER</code> of the following objects will be removed because it is set to a user account that does not exist or will not be migrated.

The <code>DEFINER</code> clause can be used together with the
<code>SQL SECURITY DEFINER</code> clause to force objects such as views and
stored procedures to execute under the security context of the user account
specified as their definer.""",
        [
            "event:`compatibility_issues`.`invalid_definer_missing_user_e`",
            "function:`compatibility_issues`.`invalid_definer_missing_user_f`",
            "procedure:`compatibility_issues`.`invalid_definer_missing_user_p`",
            "trigger:`compatibility_issues`.`invalid_definer_missing_user_t`.`invalid_definer_missing_user_tt`",
            "view:`compatibility_issues`.`invalid_definer_missing_user_v`",
            "view:`compatibility_issues`.`invalid_definition_v`",
            "view:`compatibility_issues`.`invalid_reference`",
            "view:`compatibility_issues`.`restricted_definer_v`",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    # TODO: object/missing_sql_security - this is reported only if target server does not support SET_ANY_DEFINER

    # TODO: object/missing_sql_security_and_definer - this is reported only if
    # target server supports SET_ANY_DEFINER and DEFINER is not present, which
    # doesn't seem to be possible, since if DEFINER is omitted when creating an
    # object, it's assumed to be set to CURRENT_USER

    # TODO: object/object_collation_unsupported - requires MariaDB

    # TODO: object/object_collation_replaced - requires MariaDB

    if server_version(sandbox_session) >= (9, 2, 0):
        expected_issues._add_check(
            "routine/missing_dependency",
            MessageLevel.WARNING,
            "Missing Dependency for Stored Routine",
            "<li>Function `compatibility_issues`.`missing_dependency` references library `compatibility_issues`.`missing_dependency` which does not exist",
            """The following routines are referencing a library which does not exist or will not be migrated.

The following routines contain references to libraries that could not be found
in list of libraries to be migrated. They must be manually fixed or excluded
before continuing.""",
            [
                "function:`compatibility_issues`.`missing_dependency`",
            ],
            [
                CompatibilityFlags.EXCLUDE_OBJECT,
            ],
            CheckStatus.ACTION_REQUIRED
        )

    validate_checks(expected_issues, acutal_issues)


def test_check_compatibility_no_users(sandbox_session):
    options = setup_migration_options(sandbox_session)
    options.migrateUsers = False

    acutal_issues = run_compatibility_checks(options)

    expected_issues = MigrationCheckResults()

    expected_issues._add_check(
        "object/invalid_definer_users_not_dumped",
        MessageLevel.WARNING,
        "Users Not Dumped",
        "<li>One or more DDL statements contain DEFINER clause but user information is not included in the dump. Loading will fail if accounts set as definers do not already exist in the target DB System instance.",
        """The migrated objects have <code>DEFINER</code> clause and user accounts are not migrated.

Some of the migrated objects have the <code>DEFINER</code> clause, yet user
accounts are not migrated. This needs to be fixed before continuing.""",
        [""],
        [
            CompatibilityFlags.strip_definers,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    validate_checks(expected_issues, acutal_issues)


def test_check_compatibility_fixed(sandbox_session):
    options = setup_migration_options(sandbox_session)
    options.compatibilityFlags = [
        CompatibilityFlags.create_invisible_pks,
        CompatibilityFlags.force_innodb,
        CompatibilityFlags.force_non_standard_fks,
        CompatibilityFlags.ignore_wildcard_grants,
        CompatibilityFlags.lock_invalid_accounts,
        CompatibilityFlags.strip_definers,
        CompatibilityFlags.strip_invalid_grants,
        CompatibilityFlags.strip_restricted_grants,
        CompatibilityFlags.strip_tablespaces,
        CompatibilityFlags.unescape_wildcard_grants,
    ]

    acutal_issues = run_compatibility_checks(options)

    expected_issues = MigrationCheckResults()

    expected_issues._add_check(
        "user/unsupported_auth_plugin",
        MessageLevel.NOTICE,
        None,  # type: ignore
        "<li>User 'unsupported_auth_plugin'@'localhost' is using an unsupported authentication plugin 'mysql_no_login', this account has been updated and locked",
        None,  # type: ignore
        ["user:'unsupported_auth_plugin'@'localhost'"],
        [CompatibilityFlags.lock_invalid_accounts],
        CheckStatus.OK
    )

    expected_issues._add_check(
        "user/no_password",
        MessageLevel.NOTICE,
        None,  # type: ignore
        "<li>User 'no_password'@'localhost' does not have a password set, this account has been updated and locked",
        None,  # type: ignore
        ["user:'no_password'@'localhost'"],
        [CompatibilityFlags.lock_invalid_accounts],
        CheckStatus.OK
    )

    expected_issues._add_check(
        "user/restricted_grants",
        MessageLevel.NOTICE,
        None,  # type: ignore
        "<li>User 'restricted_grants'@'localhost' had restricted privilege (FILE) removed",
        None,  # type: ignore
        ["user:'restricted_grants'@'localhost'"],
        [CompatibilityFlags.strip_restricted_grants],
        CheckStatus.OK
    )

    expected_issues._add_check(
        "user/invalid_grants",
        MessageLevel.NOTICE,
        None,  # type: ignore
        "<li>User 'invalid_grants'@'localhost' had grant statement on a non-existent table removed (GRANT SELECT ON `compatibility_issues`.`invalid_grants_v` TO `invalid_grants`@`localhost`)",
        None,  # type: ignore
        ["user:'invalid_grants'@'localhost'"],
        [CompatibilityFlags.strip_invalid_grants],
        CheckStatus.OK
    )

    expected_issues._add_check(
        "user/wildcard_grant",
        MessageLevel.NOTICE,
        None,  # type: ignore
        "<li>User 'escaped_wildcard_grant'@'localhost' has a wildcard grant statement at the database level (GRANT SELECT ON `compatibility_issues%`.* TO `escaped_wildcard_grant`@`localhost`), this issue is ignored\n"
        "<li>User 'wildcard_grant'@'localhost' has a wildcard grant statement at the database level (GRANT SELECT ON `compatibility_issues%`.* TO `wildcard_grant`@`localhost`), this issue is ignored",
        None,  # type: ignore
        [
            "user:'escaped_wildcard_grant'@'localhost'",
            "user:'wildcard_grant'@'localhost'"
        ],
        [CompatibilityFlags.ignore_wildcard_grants],
        CheckStatus.OK
    )

    expected_issues._add_check(
        "user/escaped_wildcard_grant",
        MessageLevel.NOTICE,
        None,  # type: ignore
        "<li>User 'escaped_wildcard_grant'@'localhost' has a wildcard grant statement at the database level which is using escaped wildcard characters (compatibility_issues\\%), schema name has been replaced with: compatibility_issues%",
        None,  # type: ignore
        ["user:'escaped_wildcard_grant'@'localhost'"],
        [CompatibilityFlags.unescape_wildcard_grants],
        CheckStatus.OK
    )

    expected_issues._add_check(
        "table/unsupported_engine",
        MessageLevel.NOTICE,
        None,  # type: ignore
        "<li>Table `compatibility_issues`.`unsupported_engine` had unsupported engine MyISAM changed to InnoDB\n"
        "<li>Table `compatibility_issues`.`unsupported_row_format` had unsupported engine MyISAM changed to InnoDB",
        None,  # type: ignore
        [
            "table:`compatibility_issues`.`unsupported_engine`",
            "table:`compatibility_issues`.`unsupported_row_format`",
        ],
        [CompatibilityFlags.force_innodb],
        CheckStatus.OK
    )

    expected_issues._add_check(
        "table/missing_pk",
        MessageLevel.NOTICE,
        None,  # type: ignore
        "<li>Table `compatibility_issues`.`missing_pk` does not have a Primary Key, this will be fixed when the dump is loaded",
        None,  # type: ignore
        ["table:`compatibility_issues`.`missing_pk`"],
        [CompatibilityFlags.create_invisible_pks],
        CheckStatus.OK
    )

    expected_issues._add_check(
        "table/missing_pk_manual_fix",
        MessageLevel.ERROR,
        "Table not Eligible for Automatic Primary Key Creation",
        "<li>Table `compatibility_issues`.`missing_pk_manual_fix` does not have a Primary Key, this cannot be fixed automatically because the table is partitioned",
        """The tables below do not have PRIMARY KEYs and cannot have one created automatically.

In order to offer High Availability, the MySQL HeatWave Service requires all
tables to have either a PRIMARY KEY or a UNIQUE KEY on a NOT NULL column.

The following tables cannot have a PRIMARY KEY created automatically and must be
either excluded or manually repaired.

<a href="https://docs.oracle.com/en-us/iaas/mysql-database/doc/prerequisites1.html">
MySQL HeatWave Service Pre-requisites</a>""",
        ["table:`compatibility_issues`.`missing_pk_manual_fix`"],
        [CompatibilityFlags.EXCLUDE_OBJECT],
        CheckStatus.ACTION_REQUIRED,
    )

    expected_issues._add_check(
        "table/tablespace",
        MessageLevel.NOTICE,
        None,  # type: ignore
        "<li>Table `compatibility_issues`.`t_space` had unsupported tablespace option removed",
        None,  # type: ignore
        ["table:`compatibility_issues`.`t_space`"],
        [CompatibilityFlags.strip_tablespaces],
        CheckStatus.OK
    )

    expected_issues._add_check(
        "table/unsupported_row_format",
        MessageLevel.NOTICE,
        None,  # type: ignore
        "<li>Table `compatibility_issues`.`unsupported_row_format` had unsupported ROW_FORMAT=FIXED option removed",
        None,  # type: ignore
        ["table:`compatibility_issues`.`unsupported_row_format`"],
        [CompatibilityFlags.force_innodb],
        CheckStatus.OK
    )

    expected_issues._add_check(
        "object/invalid_definer",
        MessageLevel.NOTICE,
        None,  # type: ignore
        "<li>Event `compatibility_issues`.`invalid_definer_missing_user_e` had definer clause removed\n"
        "<li>Function `compatibility_issues`.`invalid_definer_missing_user_f` had definer clause removed\n"
        "<li>Function `compatibility_issues`.`missing_dependency` had definer clause removed\n"
        "<li>Procedure `compatibility_issues`.`invalid_definer_missing_user_p` had definer clause removed\n"
        "<li>Trigger `compatibility_issues`.`invalid_definer_missing_user_t`.`invalid_definer_missing_user_tt` had definer clause removed\n"
        "<li>View `compatibility_issues`.`invalid_definer_missing_user_v` had definer clause removed\n"
        "<li>View `compatibility_issues`.`invalid_definition_v` had definer clause removed\n"
        "<li>View `compatibility_issues`.`invalid_reference` had definer clause removed\n"
        "<li>View `compatibility_issues`.`restricted_definer_v` had definer clause removed",
        None,  # type: ignore
        [
            "event:`compatibility_issues`.`invalid_definer_missing_user_e`",
            "function:`compatibility_issues`.`invalid_definer_missing_user_f`",
            "function:`compatibility_issues`.`missing_dependency`",
            "procedure:`compatibility_issues`.`invalid_definer_missing_user_p`",
            "trigger:`compatibility_issues`.`invalid_definer_missing_user_t`.`invalid_definer_missing_user_tt`",
            "view:`compatibility_issues`.`invalid_definer_missing_user_v`",
            "view:`compatibility_issues`.`invalid_definition_v`",
            "view:`compatibility_issues`.`invalid_reference`",
            "view:`compatibility_issues`.`restricted_definer_v`",
        ],
        [CompatibilityFlags.strip_definers],
        CheckStatus.OK
    )

    expected_issues._add_check(
        "object/missing_sql_security",
        MessageLevel.NOTICE,
        None,  # type: ignore
        "<li>Function `compatibility_issues`.`invalid_definer_missing_user_f` had SQL SECURITY characteristic set to INVOKER\n"
        "<li>Function `compatibility_issues`.`missing_dependency` had SQL SECURITY characteristic set to INVOKER\n"
        "<li>Procedure `compatibility_issues`.`invalid_definer_missing_user_p` had SQL SECURITY characteristic set to INVOKER\n"
        "<li>View `compatibility_issues`.`invalid_definer_missing_user_v` had SQL SECURITY characteristic set to INVOKER\n"
        "<li>View `compatibility_issues`.`invalid_definition_v` had SQL SECURITY characteristic set to INVOKER\n"
        "<li>View `compatibility_issues`.`invalid_reference` had SQL SECURITY characteristic set to INVOKER\n"
        "<li>View `compatibility_issues`.`restricted_definer_v` had SQL SECURITY characteristic set to INVOKER",
        None,  # type: ignore
        [
            "function:`compatibility_issues`.`invalid_definer_missing_user_f`",
            "function:`compatibility_issues`.`missing_dependency`",
            "procedure:`compatibility_issues`.`invalid_definer_missing_user_p`",
            "view:`compatibility_issues`.`invalid_definer_missing_user_v`",
            "view:`compatibility_issues`.`invalid_definition_v`",
            "view:`compatibility_issues`.`invalid_reference`",
            "view:`compatibility_issues`.`restricted_definer_v`",
        ],
        [CompatibilityFlags.strip_definers],
        CheckStatus.OK
    )

    validate_checks(expected_issues, acutal_issues)
