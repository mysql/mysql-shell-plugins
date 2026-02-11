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

from migration_plugin.lib.backend.model import CheckStatus, CompatibilityFlags, DBSystemOptions, IncludeList, MessageLevel, MigrationCheckResults, MigrationOptions, CompatibilityFlags
from migration_plugin.lib.backend.source_check import MySQLSourceCheck
import mysqlsh  # type: ignore
import pathlib
import pytest

from .helpers import execute_script, server_version, shell_version
from .test_check_compatibility import validate_checks


def load_upgrade_issues(session):
    execute_script(session, pathlib.Path(__file__).parent.parent /
                   "sql" / "upgrade_issues.sql")


def cleanup_upgrade_issues(session):
    execute_script(session, pathlib.Path(__file__).parent.parent /
                   "sql" / "upgrade_issues_cleanup.sql")


@pytest.fixture(scope="module", autouse=True)
def setup_test(sandbox_session):
    if server_version(sandbox_session) >= (8, 0, 0):
        pytest.skip("This test requires 5.7 server")

    cleanup_upgrade_issues(session=sandbox_session)
    load_upgrade_issues(session=sandbox_session)
    yield
    cleanup_upgrade_issues(session=sandbox_session)


def setup_migration_options(session) -> MigrationOptions:
    options = MigrationOptions()

    options.sourceConnectionOptions = mysqlsh.globals.shell.parse_uri(
        session.uri
    )

    options.filters.schemas = IncludeList()
    options.filters.schemas.include = ["upgrade_issues", "upgrade_issues_ex"]

    options.filters.users = IncludeList()
    options.filters.users.exclude = ["admin", "root"]

    options.targetMySQLOptions = DBSystemOptions()
    options.targetMySQLOptions.mysqlVersion = shell_version()

    return options


def run_upgrade_checks(options: MigrationOptions) -> MigrationCheckResults:
    source_check = MySQLSourceCheck(options)
    assert not source_check.check_connection().connectError

    return source_check.check_upgrade(options.filters)


def test_check_upgrade(sandbox_session):
    if server_version(sandbox_session) >= (8, 0, 0):
        pytest.skip("This test requires 5.7 server")

    acutal_issues = run_upgrade_checks(
        setup_migration_options(sandbox_session))

    expected_issues = MigrationCheckResults()

    # TODO: oldTemporal - requires server < 5.6.4

    expected_issues._add_check(
        "reservedKeywords",
        MessageLevel.WARNING,
        "Usage of db objects with names conflicting with new reserved keywords",
        "<li>upgrade_issues.array: Routine name\n"
        "<li>upgrade_issues.lateral: View name\n"
        "<li>upgrade_issues.lead: Event name\n"
        "<li>upgrade_issues.rows: Routine name\n"
        "<li>upgrade_issues.system: Table name\n"
        "<li>upgrade_issues.system.cube: Column name\n"
        "<li>upgrade_issues.system.first_value: Trigger name\n"
        "<li>upgrade_issues.system.json_table: Column name",
        """Warning: The following objects have names that conflict with new reserved keywords. Ensure queries sent by your applications use `quotes` when referring to them or they will result in errors.

For more information, please refer to the <a href="https://dev.mysql.com/doc/refman/en/keywords.html">documentation</a>.""",
        [
            "routine:upgrade_issues.array",
            "view:upgrade_issues.lateral",
            "event:upgrade_issues.lead",
            "routine:upgrade_issues.rows",
            "table:upgrade_issues.system",
            "column:upgrade_issues.system.cube",
            "trigger:upgrade_issues.system.first_value",
            "column:upgrade_issues.system.json_table",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "utf8mb3",
        MessageLevel.WARNING,
        "Usage of utf8mb3 charset",
        "<li>upgrade_issues.test_utf8mb3.a: column's default character set: utf8",
        """Warning: The following objects use the deprecated utf8mb3 character set. It is recommended to convert them to use utf8mb4 instead, for improved Unicode support. The utf8mb3 character is subject to removal in the future.

For more information, please refer to the <a href="https://dev.mysql.com/doc/refman/en/charset-unicode-utf8mb3.html">documentation</a>.""",
        [
            "column:upgrade_issues.test_utf8mb3.a",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "nonNativePartitioning",
        MessageLevel.ERROR,
        "Partitioned tables using engines with non native partitioning",
        "<li>Table upgrade_issues.non_native_partitioning: MyISAM engine does not support native partitioning",
        """Error: In the latest MySQL storage engine is responsible for providing its own partitioning handler, and the MySQL server no longer provides generic partitioning support. InnoDB and NDB are the only storage engines that provide a native partitioning handler that is supported in the latest MySQL. A partitioned table using any other storage engine must be altered—either to convert it to InnoDB or NDB, or to remove its partitioning—before upgrading the server, else it cannot be used afterwards.

For more information, please refer to the <a href="https://dev.mysql.com/doc/refman/8.0/en/upgrading-from-previous-series.html#upgrade-configuration-changes">documentation</a>.""",
        [
            "table:upgrade_issues.non_native_partitioning",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "foreignKeyLength",
        MessageLevel.ERROR,
        "Foreign key constraint names longer than 64 characters",
        "<li>Foreign key of table upgrade_issues._123456789112345678921234567893123456789412345678951234567896123: Foreign key longer than 64 characters",
        """Error: The following tables must be altered to have constraint names shorter than 64 characters (use ALTER TABLE).

For more information, please refer to the <a href="https://dev.mysql.com/doc/refman/en/upgrade-before-you-begin.html">documentation</a>.""",
        [
            "foreignkey:upgrade_issues._123456789112345678921234567893123456789412345678951234567896123",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "maxdbSqlModeFlags",
        MessageLevel.WARNING,
        "Usage of obsolete MAXDB sql_mode flag",
        "<li>upgrade_issues.system.maxdb_sql_mode_flags: TRIGGER uses obsolete MAXDB sql_mode",
        """Warning: The following DB objects have the obsolete MAXDB option persisted for sql_mode, which will be cleared during the upgrade. It can potentially change the datatype DATETIME into TIMESTAMP if it is used inside object's definition, and this in turn can change the behavior in case of dates earlier than 1970 or later than 2037. If this is a concern, please redefine these objects so that they do not rely on the MAXDB flag before running the upgrade.

For more information, please refer to the <a href="https://dev.mysql.com/doc/refman/8.0/en/mysql-nutshell.html#mysql-nutshell-removals">documentation</a>.""",
        [
            "trigger:upgrade_issues.system.maxdb_sql_mode_flags",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "obsoleteSqlModeFlags",
        MessageLevel.NOTICE,
        "Usage of obsolete sql_mode flags",
        "<li>upgrade_issues.system.maxdb_sql_mode_flags: TRIGGER uses obsolete NO_AUTO_CREATE_USER sql_mode\n"
        "<li>upgrade_issues.system.maxdb_sql_mode_flags: TRIGGER uses obsolete NO_FIELD_OPTIONS sql_mode\n"
        "<li>upgrade_issues.system.maxdb_sql_mode_flags: TRIGGER uses obsolete NO_KEY_OPTIONS sql_mode\n"
        "<li>upgrade_issues.system.maxdb_sql_mode_flags: TRIGGER uses obsolete NO_TABLE_OPTIONS sql_mode",
        """The following DB objects have obsolete options persisted for sql_mode.

For more information, please refer to the <a href="https://dev.mysql.com/doc/refman/8.0/en/mysql-nutshell.html#mysql-nutshell-removals">documentation</a>.""",
        [
            "trigger:upgrade_issues.system.maxdb_sql_mode_flags",
            "trigger:upgrade_issues.system.maxdb_sql_mode_flags",
            "trigger:upgrade_issues.system.maxdb_sql_mode_flags",
            "trigger:upgrade_issues.system.maxdb_sql_mode_flags",
        ],
        [
            CompatibilityFlags.IGNORE,
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    expected_issues._add_check(
        "enumSetElementLength",
        MessageLevel.ERROR,
        "ENUM/SET column definitions containing elements longer than 255 characters",
        "<li>Column upgrade_issues.enum_element_length.e: ENUM contains element longer than 255 characters\n"
        "<li>Column upgrade_issues.set_element_length.s: SET contains element longer than 255 characters",
        """Error: The following columns are defined as either ENUM or SET and contain at least one element longer that 255 characters. They need to be altered so that all elements fit into the 255 characters limit.

For more information, please refer to the <a href="https://dev.mysql.com/doc/refman/en/string-type-syntax.html">documentation</a>.""",
        [
            "column:upgrade_issues.enum_element_length.e",
            "column:upgrade_issues.set_element_length.s",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "removedFunctions",
        MessageLevel.ERROR,
        "Usage of removed functions",
        "<li>Routine upgrade_issues.removed_functions: FUNCTION uses removed function ENCRYPT (consider using SHA2 instead)",
        """Error: The following DB objects use functions that were removed in the latest MySQL version. Please make sure to update them to use supported alternatives before upgrade.

For more information, please refer to the <a href="https://dev.mysql.com/doc/refman/8.0/en/mysql-nutshell.html#mysql-nutshell-removals">documentation</a>.""",
        [
            "routine:upgrade_issues.removed_functions",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "groupbyAscSyntax",
        MessageLevel.ERROR,
        "Usage of removed GROUP BY ASC/DESC syntax",
        "<li>upgrade_issues.group_by_asc_syntax_v: VIEW uses removed GROUP BY DESC syntax",
        """Error: The following DB objects use removed GROUP BY ASC/DESC syntax. They need to be altered so that ASC/DESC keyword is removed from GROUP BY clause and placed in appropriate ORDER BY clause.

For more information, please refer to the <a href="https://dev.mysql.com/doc/relnotes/mysql/8.0/en/news-8-0-13.html#mysqld-8-0-13-sql-syntax">documentation</a>.""",
        [
            "view:upgrade_issues.group_by_asc_syntax_v",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "zeroDates",
        MessageLevel.WARNING,
        "Zero Date, Datetime, and Timestamp values",
        "<li>upgrade_issues.zero_dates.d: column has zero default value: 0000-00-00\n"
        "<li>upgrade_issues.zero_dates.dt: column has zero default value: 0000-00-00 00:00:00\n"
        "<li>upgrade_issues.zero_dates.ts: column has zero default value: 0000-00-00 00:00:00",
        """Warning: By default zero date/datetime/timestamp values are no longer allowed in MySQL, as of 5.7.8 NO_ZERO_IN_DATE and NO_ZERO_DATE are included in SQL_MODE by default. These modes should be used with strict mode as they will be merged with strict mode in a future release. If you do not include these modes in your SQL_MODE setting, you are able to insert date/datetime/timestamp values that contain zeros. It is strongly advised to replace zero values with valid ones, as they may not work correctly in the future.

For more information, please refer to the <a href="https://dev.mysql.com/doc/refman/8.0/en/datetime.html
https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html#sqlmode_no_zero_date
https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html#sqlmode_no_zero_in_date">documentation</a>.""",
        [
            "column:upgrade_issues.zero_dates.d",
            "column:upgrade_issues.zero_dates.dt",
            "column:upgrade_issues.zero_dates.ts",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    # TODO: schemaInconsistency - requires manipulation of datadir

    # TODO: engineMixup - requires manipulation of datadir

    expected_issues._add_check(
        "columnsWhichCannotHaveDefaults",
        MessageLevel.ERROR,
        "Columns which cannot have default values",
        "<li>Column upgrade_issues.columns_which_cannot_have_defaults.p: point",
        """Error: The following columns are defined as either BLOB, TEXT, GEOMETRY or JSON and have a default value set. These data types cannot have default values in MySQL versions prior to 8.0.13, while starting with 8.0.13, the default value must be specified as an expression. In order to fix this issue, please use the ALTER TABLE ... ALTER COLUMN ... DROP DEFAULT statement.

For more information, please refer to the <a href="https://dev.mysql.com/doc/refman/en/data-type-defaults.html#data-type-defaults-explicit">documentation</a>.""",
        [
            "column:upgrade_issues.columns_which_cannot_have_defaults.p",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    # TODO: invalid57Names - requires manipulation of datadir (adding a directory)

    expected_issues._add_check(
        "orphanedObjects",
        MessageLevel.ERROR,
        "Check for orphaned routines and events in 5.7",
        "<li>upgrade_issues_ex.orphaned_procedure: this routine is associated to a schema that no longer exists.",
        """Error: The following objects have been orphaned. Schemas that they are referencing no longer exists.
They have to be cleaned up or the upgrade will fail.""",
        [
            "routine:upgrade_issues_ex.orphaned_procedure",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "dollarSignName",
        MessageLevel.WARNING,
        "Check for deprecated usage of single dollar signs in object names",
        "<li>Table upgrade_issues.$dollar_sign_name:  name starts with $ sign.\n"
        "<li>Column upgrade_issues.$dollar_sign_name.$c1:  name starts with $ sign.\n"
        "<li>Column upgrade_issues.$dollar_sign_name.$c2:  name starts with $ sign.",
        """Warning: The following objects have names with deprecated usage of a dollar sign ($) at the beginning of the identifier. To correct this warning, ensure that names starting with a dollar sign also end with one, similar to quotes ($example$).""",
        [
            "table:upgrade_issues.$dollar_sign_name",
            "column:upgrade_issues.$dollar_sign_name.$c1",
            "column:upgrade_issues.$dollar_sign_name.$c2",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    # TODO: indexTooLarge - requires server <= 5.7.34

    expected_issues._add_check(
        "emptyDotTableSyntax",
        MessageLevel.ERROR,
        "Check for deprecated '.<table>' syntax used in routines.",
        "<li>upgrade_issues.empty_dot_table_syntax_p:  routine body contains deprecated identifiers.",
        """Error: The following routines contain identifiers in deprecated identifier syntax (".<table>"), and should be corrected before upgrade:""",
        [
            "routine:upgrade_issues.empty_dot_table_syntax_p",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    # TODO: add syntax validation - not reported due to BUG#38555376

    expected_issues._add_check(
        "invalidEngineForeignKey",
        MessageLevel.ERROR,
        "Check for columns that have foreign keys pointing to tables from a different database engine.",
        "<li>Foreign key upgrade_issues.invalid_engine_foreign_key_1.column_idColumn: column has invalid foreign key to column 'idColumn' from table 'upgrade_issues/invalid_engine_foreign_key_2' that is from a different database engine (MyISAM).",
        """Error: The following columns have foreign keys pointing to tables from different database engines than originating table. This is invalid and probably a mistake done when FOREIGN_KEY_CHECKS was turned OFF:""",
        [
            "foreignkey:upgrade_issues.invalid_engine_foreign_key_1.column_idColumn",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "foreignKeyReferences",
        MessageLevel.WARNING,
        "Checks for foreign keys not referencing a full unique index",
        "<li>invalid foreign key defined as 'upgrade_issues.non_standard_fks(a)' references a partial key at table 'non_standard_fks_parent'.",
        """Foreign keys to partial indexes may be forbidden as of 8.4.0, this check identifies such cases to warn the user.

You may:
<li>Convert non unique key to unique key if values do not have any duplicates. In case of foreign keys involving partial columns of key, create composite  unique key containing all the referencing columns if values do not have any  duplicates.
<li>Remove foreign keys referring to non unique key/partial columns of key.
<li>In case of multi level references which involves more than two tables change foreign key reference.""",
        [
            "foreignkey:upgrade_issues.non_standard_fks.non_standard_fks_ibfk_1",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "deprecatedTemporalDelimiter",
        MessageLevel.ERROR,
        "Check for deprecated temporal delimiters in table partitions.",
        "<li>Column upgrade_issues.deprecated_temporal_delimiter.id:  - partition px_2024_01 uses deprecated temporal delimiters",
        """Error: The following columns are referenced in partitioning function using custom temporal delimiters.
Custom temporal delimiters were deprecated since 8.0.29. Partitions using them will make partitioned tables unaccessible after upgrade.
These partitions need to be updated to standard temporal delimiters before the upgrade.

For more information, please refer to the <a href="https://dev.mysql.com/doc/relnotes/mysql/8.0/en/news-8-0-29.html#mysqld-8-0-29-deprecation-removal https://dev.mysql.com/doc/refman/en/datetime.html">documentation</a>.""",
        [
            "column:upgrade_issues.deprecated_temporal_delimiter.id",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "columnDefinition",
        MessageLevel.ERROR,
        "Checks for errors in column definitions",
        "<li>upgrade_issues.column_definition.c1: The column is of type DOUBLE and has the AUTO_INCREMENT flag set, this is no longer supported.",
        """Identifies column definitions that may not be supported in future versions of MySQL""",
        [
            "column:upgrade_issues.column_definition.c1",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    expected_issues._add_check(
        "invalidPrivileges",
        MessageLevel.NOTICE,
        "Checks for user privileges that will be removed",
        "<li>The user 'invalid_privileges'@'localhost' has the following privileges that will be removed as part of the upgrade process: SUPER",
        """Verifies for users containing grants to be removed as part of the upgrade process.

You may:
<li>If the privileges are not being used, no action is required, otherwise, ensure they stop being used before the upgrade as they will be lost.""",
        [
            "user:'invalid_privileges'@'localhost'",
        ],
        [
            CompatibilityFlags.IGNORE,
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.CONFIRMATION_REQUIRED
    )

    expected_issues._add_check(
        "partitionsWithPrefixKeys",
        MessageLevel.ERROR,
        "Checks for partitions by key using columns with prefix key indexes",
        "<li>Error: the `upgrade_issues`.`partitions_with_prefix_keys` table uses partition by KEY using the following columns with prefix index: f1,f3.",
        """Indexes on column prefixes are not supported for key partitioning, they are ignored by the partition function and so they are not allowed as of 8.4.0. This check identifies tables with partitions defined this way, they should be fixed before upgrading to 8.4.0.

For more information, please refer to the <a href="https://dev.mysql.com/doc/refman/en/partitioning-limitations.html">documentation</a>.""",
        [
            "table:upgrade_issues.partitions_with_prefix_keys",
        ],
        [
            CompatibilityFlags.EXCLUDE_OBJECT,
        ],
        CheckStatus.ACTION_REQUIRED
    )

    validate_checks(expected_issues, acutal_issues)
